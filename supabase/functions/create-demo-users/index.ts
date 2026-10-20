import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const demoUsers = [
      {
        email: "demo_admin@stratefix.com",
        password: "Demo@123",
        full_name: "Demo Admin",
        role: "admin",
        employee_code: "EMP-ADM-001",
      },
      {
        email: "demo_hr@stratefix.com",
        password: "Demo@123",
        full_name: "Demo HR Manager",
        role: "hr",
        employee_code: "EMP-HR-001",
      },
      {
        email: "demo_ld@stratefix.com",
        password: "Demo@123",
        full_name: "Demo L&D Manager",
        role: "l_d_manager",
        employee_code: "EMP-LD-001",
      },
      {
        email: "demo_manager@stratefix.com",
        password: "Demo@123",
        full_name: "Demo Manager",
        role: "manager",
        employee_code: "EMP-MGR-001",
      },
      {
        email: "demo_employee@stratefix.com",
        password: "Demo@123",
        full_name: "Demo Employee",
        role: "employee",
        employee_code: "EMP-EMP-001",
      },
    ];

    const results = [];

    // Get Stratefix organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id")
      .eq("name", "Stratefix")
      .limit(1)
      .single();

    if (orgError) {
      throw new Error(`Error fetching organization: ${orgError.message}`);
    }

    const orgId = org?.id;
    if (!orgId) {
      throw new Error("Stratefix organization not found");
    }

    // Get department and designation
    const { data: dept } = await supabase
      .from("departments")
      .select("id")
      .eq("organization_id", orgId)
      .limit(1)
      .maybeSingle();

    const { data: designation } = await supabase
      .from("designations")
      .select("id")
      .eq("organization_id", orgId)
      .limit(1)
      .maybeSingle();

    const deptId = dept?.id;
    const designationId = designation?.id;

    if (!deptId || !designationId) {
      throw new Error("Department or designation not found for Stratefix");
    }

    // Create each demo user
    for (const user of demoUsers) {
      try {
        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin
          .createUser({
            email: user.email,
            password: user.password,
            email_confirm: true,
            user_metadata: {
              full_name: user.full_name,
            },
          });

        if (authError) {
          if (authError.message.includes("already registered")) {
            // User exists, try to update
            const { data: existingUsers } = await supabase.auth.admin
              .listUsers();
            const existingUser = existingUsers?.users.find((u) =>
              u.email === user.email
            );

            if (existingUser) {
              // Update profile
              await supabase
                .from("user_profiles")
                .upsert({
                  id: existingUser.id,
                  organization_id: orgId,
                  email: user.email,
                  full_name: user.full_name,
                  role: user.role,
                  is_active: true,
                });

              // Update employee
              await supabase
                .from("employees")
                .upsert({
                  user_id: existingUser.id,
                  organization_id: orgId,
                  employee_code: user.employee_code,
                  department_id: deptId,
                  designation_id: designationId,
                  date_of_joining: "2024-01-01",
                  employment_type: "full_time",
                  status: "active",
                }, {
                  onConflict: "employee_code",
                });

              results.push({
                email: user.email,
                status: "updated",
                role: user.role,
              });
            }
          } else {
            throw authError;
          }
        } else {
          // Create profile
          await supabase
            .from("user_profiles")
            .insert({
              id: authData.user.id,
              organization_id: orgId,
              email: user.email,
              full_name: user.full_name,
              role: user.role,
              is_active: true,
            });

          // Create employee
          await supabase
            .from("employees")
            .insert({
              user_id: authData.user.id,
              organization_id: orgId,
              employee_code: user.employee_code,
              department_id: deptId,
              designation_id: designationId,
              date_of_joining: "2024-01-01",
              employment_type: "full_time",
              status: "active",
            });

          results.push({
            email: user.email,
            status: "created",
            role: user.role,
          });
        }
      } catch (userError) {
        results.push({
          email: user.email,
          status: "error",
          error: userError.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Demo users processing completed",
        results,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
