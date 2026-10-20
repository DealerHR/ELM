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

    const {
      organization_id,
      full_name,
      email,
      password,
      phone,
      role,
      department_id,
      designation_id,
      employment_status,
      reporting_manager_id,
    } = await req.json();

    if (!organization_id || !full_name || !email || !password) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (authError) {
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

    const userId = authData.user.id;

    const { error: profileError } = await adminClient.from("user_profiles").upsert({
      id: userId,
      organization_id,
      email,
      full_name,
      phone: phone || null,
      role: role || "employee",
      is_active: true,
    });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(userId);
      throw new Error(`Failed to create user profile: ${profileError.message}`);
    }

    const employeeCode = `EMP-${Date.now().toString(36).toUpperCase()}`;

    const { data: empRecord, error: empError } = await adminClient
      .from("employees")
      .insert({
        user_id: userId,
        organization_id,
        employee_code: employeeCode,
        date_of_joining: new Date().toISOString().split("T")[0],
        department_id: department_id || null,
        designation_id: designation_id || null,
        status: employment_status || "active",
        reporting_manager_id: reporting_manager_id || null,
      })
      .select()
      .single();

    if (empError) {
      await adminClient.auth.admin.deleteUser(userId);
      throw new Error(`Failed to create employee record: ${empError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: userId, email, full_name },
        employee: { id: empRecord.id, employee_code: employeeCode },
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
