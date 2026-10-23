import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { adminClient, requireRole } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OPENAI_MODELS = [
  "gpt-4o-mini",
  "gpt-3.5-turbo",
  "gpt-4o",
];

async function callOpenAI(apiKey: string, model: string, prompt: string): Promise<Response> {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 600,
    }),
  });
}

function shuffleOptions(parsed: {
  question_text: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  correct_option: number;
  difficulty: string;
  explanation: string;
}) {
  const options = [parsed.option_1, parsed.option_2, parsed.option_3, parsed.option_4];
  const correctText = options[parsed.correct_option - 1];

  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return {
    question_text: parsed.question_text,
    option_1: options[0],
    option_2: options[1],
    option_3: options[2],
    option_4: options[3],
    correct_option: options.indexOf(correctText) + 1,
    difficulty: parsed.difficulty,
    explanation: parsed.explanation,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = adminClient();

    // Only staff who build assessments may spend the platform's OpenAI quota.
    const auth = await requireRole(req, supabase, ["platform_admin", "admin", "l_d_manager"]);
    if ("response" in auth) return auth.response;

    const { skill_name, skill_description, difficulty, existing_questions } = await req.json();

    if (!skill_name) {
      return new Response(JSON.stringify({ error: "skill_name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings, error: settingsError } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["openai_api_key", "openai_model"]);

    if (settingsError) throw new Error(`Settings fetch failed: ${settingsError.message}`);

    const apiKey = settings?.find((s: { key: string; value: string }) => s.key === "openai_api_key")?.value || "";
    const preferredModel = settings?.find((s: { key: string; value: string }) => s.key === "openai_model")?.value || OPENAI_MODELS[0];

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OpenAI API key is not configured. Please ask your platform administrator to set up the API key in the Super Admin Dashboard." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const difficultyLevel = difficulty || "medium";

    const existingQuestionsText = existing_questions && existing_questions.length > 0
      ? `\n\nQuestions already created (do NOT repeat these):\n${existing_questions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}`
      : "";

    const prompt = `You are a workplace learning expert creating skill assessment questions.

Skill: ${skill_name}
${skill_description ? `Skill Description:\n${skill_description}` : ""}
Difficulty: ${difficultyLevel}
${existingQuestionsText}

Create ONE multiple-choice question to assess a person's knowledge of "${skill_name}" at ${difficultyLevel} difficulty.

Rules:
- Use simple, clear English. No complex words.
- The question must test a real, practical aspect of this skill.
- Write 4 answer options. Only one is correct.
- The wrong options should be believable, not obviously wrong.
- Do NOT include "Don't Know / Not Sure" — that will be added automatically.
- Do NOT number the question or options.
- Place the correct answer in a RANDOM position (1, 2, 3, or 4) — vary it across questions.

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
  "question_text": "your question here",
  "option_1": "first answer option",
  "option_2": "second answer option",
  "option_3": "third answer option",
  "option_4": "fourth answer option",
  "correct_option": 3,
  "difficulty": "${difficultyLevel}",
  "explanation": "brief explanation of why the correct answer is right"
}`;

    const modelsToTry = [preferredModel, ...OPENAI_MODELS.filter(m => m !== preferredModel)];

    let lastError = "";
    for (const model of modelsToTry) {
      const response = await callOpenAI(apiKey, model, prompt);

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 401) {
          return new Response(JSON.stringify({ error: "Invalid OpenAI API key. Please update it in the Super Admin Dashboard." }), {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 429) {
          lastError = `Model ${model} hit rate limit`;
          continue;
        }
        lastError = `Model ${model} failed (${response.status}): ${errText}`;
        continue;
      }

      const aiResponse = await response.json();
      const content = aiResponse.choices?.[0]?.message?.content;

      if (!content) {
        lastError = `Model ${model} returned no content`;
        continue;
      }

      let parsed;
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const jsonStart = cleaned.indexOf("{");
        const jsonEnd = cleaned.lastIndexOf("}");
        if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON object found");
        parsed = JSON.parse(cleaned.substring(jsonStart, jsonEnd + 1));
      } catch {
        lastError = `Model ${model} returned invalid JSON`;
        continue;
      }

      if (!parsed.question_text || !parsed.option_1 || !parsed.option_2 || !parsed.option_3 || !parsed.option_4 || !parsed.correct_option) {
        lastError = `Model ${model} response missing required fields`;
        continue;
      }

      if (parsed.correct_option < 1 || parsed.correct_option > 4) {
        lastError = `Model ${model} returned invalid correct_option: ${parsed.correct_option}`;
        continue;
      }

      const shuffled = shuffleOptions({
        question_text: parsed.question_text,
        option_1: parsed.option_1,
        option_2: parsed.option_2,
        option_3: parsed.option_3,
        option_4: parsed.option_4,
        correct_option: parsed.correct_option,
        difficulty: parsed.difficulty || difficultyLevel,
        explanation: parsed.explanation || "",
      });

      return new Response(JSON.stringify({
        question: shuffled,
        model_used: model,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`All models failed. Last error: ${lastError}`);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
// verify_jwt=true
