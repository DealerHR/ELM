import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { adminClient as adminClient_, corsHeaders, requireRole } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const adminClient = adminClient_();

    const auth = await requireRole(req, adminClient, ["platform_admin", "admin", "hr"]);
    if ("response" in auth) return auth.response;
    const caller = auth.caller;

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
      employee_code,
      date_of_joining,
      employment_type,
      candidate_id,
    } = await req.json();

    if (!organization_id || !full_name || !email || !password) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin and HR can only create people in their own organisation.
    if (caller.role !== "platform_admin" && caller.organization_id !== organization_id) {
      return new Response(
        JSON.stringify({ success: false, error: "You can only add employees to your own organisation" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Nobody creates a platform admin here; HR cannot create admins.
    const requestedRole: string = role || "employee";
    const allowedRoles =
      caller.role === "hr"
        ? ["employee", "manager", "hr", "l_d_manager"]
        : ["employee", "manager", "hr", "l_d_manager", "admin"];
    if (!allowedRoles.includes(requestedRole)) {
      return new Response(
        JSON.stringify({ success: false, error: `You cannot assign the role "${requestedRole}"` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof password !== "string" || password.length < 8) {
      return new Response(
        JSON.stringify({ success: false, error: "Password must be at least 8 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    let userId: string;
    let createdAuthUser = false;

    if (authError) {
      const isAlreadyRegistered =
        authError.message.toLowerCase().includes("already registered") ||
        authError.message.toLowerCase().includes("already been registered");
      if (!isAlreadyRegistered) {
        return new Response(
          JSON.stringify({ success: false, error: authError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // The email already has a login (for example a candidate). Reuse it only
      // if that person is not already an employee of another organisation.
      const { data: existingProfile } = await adminClient
        .from("user_profiles")
        .select("id, organization_id")
        .eq("email", email)
        .maybeSingle();

      if (!existingProfile) {
        return new Response(
          JSON.stringify({ success: false, error: "This email is already registered. Please use a different email." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (existingProfile.organization_id && existingProfile.organization_id !== organization_id) {
        return new Response(
          JSON.stringify({ success: false, error: "This email belongs to a user in another organisation." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = existingProfile.id;
    } else {
      userId = authData.user.id;
      createdAuthUser = true;
    }

    const { error: profileError } = await adminClient.from("user_profiles").upsert({
      id: userId,
      organization_id,
      email,
      full_name,
      phone: phone || null,
      role: requestedRole,
      is_active: true,
      must_change_password: true,
    });

    if (profileError) {
      if (createdAuthUser) await adminClient.auth.admin.deleteUser(userId);
      throw new Error(`Failed to create user profile: ${profileError.message}`);
    }

    const employeeFields: Record<string, unknown> = {
      organization_id,
      department_id: department_id || null,
      designation_id: designation_id || null,
      status: employment_status || "active",
      reporting_manager_id: reporting_manager_id || null,
    };
    if (employment_type) employeeFields.employment_type = employment_type;
    if (date_of_joining) employeeFields.date_of_joining = date_of_joining;
    // Which hire this person came from, when they arrived through Candidates.
    if (typeof candidate_id === "string" && candidate_id) employeeFields.candidate_id = candidate_id;

    const { data: existingEmp } = await adminClient
      .from("employees")
      .select("id, employee_code")
      .eq("user_id", userId)
      .maybeSingle();

    let empRecord: { id: string; employee_code: string } | null = null;
    let empError: { message: string } | null = null;

    if (existingEmp) {
      // Keep the existing employee code; refresh the org details.
      const res = await adminClient
        .from("employees")
        .update(employeeFields)
        .eq("id", existingEmp.id)
        .select("id, employee_code")
        .single();
      empRecord = res.data; empError = res.error;
    } else {
      const res = await adminClient
        .from("employees")
        .insert({
          user_id: userId,
          employee_code: (typeof employee_code === "string" && employee_code.trim()) || `EMP-${Date.now().toString(36).toUpperCase()}`,
          date_of_joining: date_of_joining || new Date().toISOString().split("T")[0],
          ...employeeFields,
        })
        .select("id, employee_code")
        .single();
      empRecord = res.data; empError = res.error;
    }

    if (empError || !empRecord) {
      if (createdAuthUser) await adminClient.auth.admin.deleteUser(userId);
      throw new Error(`Failed to create employee record: ${empError?.message ?? "unknown error"}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: userId, email, full_name },
        employee: { id: empRecord.id, employee_code: empRecord.employee_code },
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
// redeploy
// redeploy password-change
