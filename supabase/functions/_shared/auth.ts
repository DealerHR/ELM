import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

export const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

export type Role = "platform_admin" | "admin" | "hr" | "l_d_manager" | "manager" | "employee";

export interface Caller {
  id: string;
  email: string | null;
  role: Role;
  organization_id: string | null;
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * Identify the signed-in user from the request's bearer token.
 * Returns null when there is no valid user session (anon key alone does not count).
 */
export async function getCaller(req: Request, client: SupabaseClient): Promise<Caller | null> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: profile } = await client
    .from("user_profiles")
    .select("id, email, role, organization_id, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile || profile.is_active === false) return null;
  return {
    id: profile.id,
    email: profile.email,
    role: profile.role as Role,
    organization_id: profile.organization_id,
  };
}

/** Require a signed-in caller with one of the given roles, or return a 401/403 response. */
export async function requireRole(
  req: Request,
  client: SupabaseClient,
  roles: Role[],
): Promise<{ caller: Caller } | { response: Response }> {
  const caller = await getCaller(req, client);
  if (!caller) return { response: json({ success: false, error: "Sign in required" }, 401) };
  if (!roles.includes(caller.role)) {
    return { response: json({ success: false, error: "You do not have permission to do this" }, 403) };
  }
  return { caller };
}
