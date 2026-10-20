import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { org, admin } = await req.json();

    if (!org?.name || !admin?.email || !admin?.password || !admin?.full_name) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: newOrg, error: orgError } = await adminClient
      .from("organizations")
      .insert({
        name: org.name,
        website: org.website || null,
        industry: org.industry || null,
        size: org.size || null,
      })
      .select()
      .single();

    if (orgError) throw new Error(`Failed to create organization: ${orgError.message}`);

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: admin.email,
      password: admin.password,
      email_confirm: true,
      user_metadata: { full_name: admin.full_name },
    });

    if (authError) {
      await adminClient.from("organizations").delete().eq("id", newOrg.id);
      const isAlreadyRegistered =
        authError.message.toLowerCase().includes("already registered") ||
        authError.message.toLowerCase().includes("already been registered");
      return new Response(
        JSON.stringify({
          success: false,
          error: isAlreadyRegistered
            ? "This email is already registered. Please use a different email."
            : authError.message,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: profileError } = await adminClient.from("user_profiles").insert({
      id: authData.user.id,
      organization_id: newOrg.id,
      email: admin.email,
      full_name: admin.full_name,
      role: "admin",
      is_active: true,
    });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(authData.user.id);
      await adminClient.from("organizations").delete().eq("id", newOrg.id);
      throw new Error(`Failed to create admin profile: ${profileError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        org: { id: newOrg.id, name: newOrg.name },
        admin: { id: authData.user.id, email: admin.email, full_name: admin.full_name },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
