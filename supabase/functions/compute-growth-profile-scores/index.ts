import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DIMENSION_WEIGHTS: Record<string, Record<string, number>> = {
  entry: {
    adaptability_learning: 0.25,
    initiative_ownership: 0.15,
    collaboration_team: 0.25,
    resilience_stress: 0.15,
    growth_curiosity: 0.20,
  },
  mid: {
    adaptability_learning: 0.20,
    initiative_ownership: 0.25,
    collaboration_team: 0.20,
    resilience_stress: 0.20,
    growth_curiosity: 0.15,
  },
  senior: {
    adaptability_learning: 0.20,
    initiative_ownership: 0.30,
    collaboration_team: 0.15,
    resilience_stress: 0.25,
    growth_curiosity: 0.10,
  },
};

const DIMENSIONS = [
  "adaptability_learning",
  "initiative_ownership",
  "collaboration_team",
  "resilience_stress",
  "growth_curiosity",
];

function getFitLevel(score: number): string {
  if (score >= 85) return "exceptional";
  if (score >= 70) return "strong";
  if (score >= 55) return "good";
  if (score >= 40) return "developing";
  return "limited";
}

function getStrengthsAndAreas(
  dimScores: Record<string, number>
): { strengths: string[]; development_areas: string[] } {
  const LABEL: Record<string, string> = {
    adaptability_learning: "Adaptability & Learning",
    initiative_ownership: "Initiative & Ownership",
    collaboration_team: "Collaboration & Teamwork",
    resilience_stress: "Resilience & Stress Management",
    growth_curiosity: "Growth Orientation & Curiosity",
  };
  const sorted = Object.entries(dimScores).sort((a, b) => b[1] - a[1]);
  const strengths = sorted.slice(0, 2).filter(([, v]) => v >= 60).map(([k]) => LABEL[k]);
  const development_areas = sorted.slice(-2).filter(([, v]) => v < 65).map(([k]) => LABEL[k]);
  return { strengths, development_areas };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { assessment_id } = await req.json();
    if (!assessment_id) {
      return new Response(JSON.stringify({ error: "assessment_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: assessment, error: aErr } = await supabase
      .from("candidate_growth_assessments")
      .select("id, candidate_id, level")
      .eq("id", assessment_id)
      .maybeSingle();

    if (aErr || !assessment) {
      return new Response(JSON.stringify({ error: "Assessment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: questions, error: qErr } = await supabase
      .from("growth_profile_questions")
      .select(
        "id, question_number, dimension, sub_dimension, question_format, is_reverse_scored, is_social_desirability_trap, scoring_key, sub_dimension_weight"
      )
      .order("question_number", { ascending: true });

    if (qErr || !questions) {
      return new Response(JSON.stringify({ error: "Failed to load questions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: responses, error: rErr } = await supabase
      .from("candidate_growth_responses")
      .select("question_id, answer_value")
      .eq("assessment_id", assessment_id);

    if (rErr || !responses) {
      return new Response(JSON.stringify({ error: "Failed to load responses" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const responseMap: Record<string, number> = {};
    for (const r of responses) {
      responseMap[r.question_id] = r.answer_value;
    }

    function getEffectiveScore(q: {
      id: string;
      question_format: string;
      is_reverse_scored: boolean;
      scoring_key: Record<string, number> | null;
    }): number | null {
      const raw = responseMap[q.id];
      if (raw === undefined || raw === null) return null;

      if (q.scoring_key) {
        const mapped = q.scoring_key[String(raw)];
        return mapped !== undefined ? mapped : raw;
      }

      if (q.is_reverse_scored) {
        return 6 - raw;
      }

      return raw;
    }

    const subDimScores: Record<string, { total: number; count: number; weight: number }> = {};
    const dimRaw: Record<string, { weightedTotal: number; weightSum: number }> = {};
    for (const dim of DIMENSIONS) {
      dimRaw[dim] = { weightedTotal: 0, weightSum: 0 };
    }

    const trapScores: number[] = [];

    for (const q of questions) {
      const score = getEffectiveScore(q);
      if (score === null) continue;

      if (q.is_social_desirability_trap) {
        if (score !== null) trapScores.push(score);
      }

      const subKey = `${q.dimension}::${q.sub_dimension}`;
      if (!subDimScores[subKey]) {
        subDimScores[subKey] = { total: 0, count: 0, weight: q.sub_dimension_weight };
      }
      subDimScores[subKey].total += score;
      subDimScores[subKey].count += 1;
    }

    const subDimNormalized: Record<string, number> = {};
    for (const [key, val] of Object.entries(subDimScores)) {
      if (val.count === 0) continue;
      const avg = val.total / val.count;
      subDimNormalized[key] = Math.round((avg / 5) * 100);
    }

    for (const dim of DIMENSIONS) {
      const dimKeys = Object.keys(subDimScores).filter((k) => k.startsWith(`${dim}::`));
      for (const key of dimKeys) {
        const weight = subDimScores[key].weight;
        const norm = subDimNormalized[key] ?? 0;
        dimRaw[dim].weightedTotal += norm * weight;
        dimRaw[dim].weightSum += weight;
      }
    }

    const dimScores: Record<string, number> = {};
    for (const dim of DIMENSIONS) {
      const { weightedTotal, weightSum } = dimRaw[dim];
      dimScores[dim] = weightSum > 0 ? Math.round(weightedTotal / weightSum) : 0;
    }

    const level = (assessment.level as string) in DIMENSION_WEIGHTS ? assessment.level as string : "mid";
    const levelWeights = DIMENSION_WEIGHTS[level];
    let overallScore = 0;
    let totalWeight = 0;
    for (const dim of DIMENSIONS) {
      overallScore += (dimScores[dim] ?? 0) * (levelWeights[dim] ?? 0);
      totalWeight += levelWeights[dim] ?? 0;
    }
    overallScore = totalWeight > 0 ? Math.round(overallScore / totalWeight) : 0;

    let socialDesirabilityIndex: number | null = null;
    let responseValidity: string = "valid";
    if (trapScores.length === 5) {
      const avgTrapScore = trapScores.reduce((a, b) => a + b, 0) / trapScores.length;
      socialDesirabilityIndex = Math.round((avgTrapScore / 5) * 100);
      if (socialDesirabilityIndex < 40) {
        responseValidity = "suspect";
      } else if (socialDesirabilityIndex < 55) {
        responseValidity = "caution";
      } else {
        responseValidity = "valid";
      }
    }

    const fitLevel = getFitLevel(overallScore);
    const { strengths, development_areas } = getStrengthsAndAreas(dimScores);

    const subDimScoresForStorage: Record<string, number> = {};
    for (const [key, val] of Object.entries(subDimNormalized)) {
      const shortKey = key.replace("::", "_");
      subDimScoresForStorage[shortKey] = val;
    }

    const { data: existing } = await supabase
      .from("growth_profile_scores")
      .select("id")
      .eq("assessment_id", assessment_id)
      .maybeSingle();

    const scoreRecord = {
      assessment_id: assessment_id,
      candidate_id: assessment.candidate_id,
      overall_score: overallScore,
      overall_percentile: null,
      fit_level: fitLevel,
      adaptability_learning_score: dimScores["adaptability_learning"] ?? 0,
      adaptability_learning_percentile: null,
      initiative_ownership_score: dimScores["initiative_ownership"] ?? 0,
      initiative_ownership_percentile: null,
      collaboration_team_score: dimScores["collaboration_team"] ?? 0,
      collaboration_team_percentile: null,
      resilience_stress_score: dimScores["resilience_stress"] ?? 0,
      resilience_stress_percentile: null,
      growth_curiosity_score: dimScores["growth_curiosity"] ?? 0,
      growth_curiosity_percentile: null,
      sub_dimension_scores: subDimScoresForStorage,
      calculation_details: {
        level,
        dimension_weights: levelWeights,
        dim_scores: dimScores,
        response_count: responses.length,
        question_count: questions.length,
        trap_scores: trapScores,
        computed_at: new Date().toISOString(),
      },
      strengths,
      development_areas,
      social_desirability_index: socialDesirabilityIndex,
      response_validity: responseValidity,
      calculated_at: new Date().toISOString(),
    };

    let saveError;
    if (existing) {
      const { error } = await supabase
        .from("growth_profile_scores")
        .update(scoreRecord)
        .eq("id", existing.id);
      saveError = error;
    } else {
      const { error } = await supabase.from("growth_profile_scores").insert(scoreRecord);
      saveError = error;
    }

    if (saveError) {
      console.error("Save error:", saveError);
      return new Response(JSON.stringify({ error: "Failed to save scores", detail: saveError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        overall_score: overallScore,
        fit_level: fitLevel,
        dim_scores: dimScores,
        social_desirability_index: socialDesirabilityIndex,
        response_validity: responseValidity,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
