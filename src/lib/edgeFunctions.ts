import { supabase } from './supabase';

/**
 * Call a Supabase edge function as the signed-in user.
 * The function sees the user's session token and decides what they may do.
 */
export async function callEdgeFunction<T = unknown>(name: string, body: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('You are not signed in.');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      Apikey: supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });

  let payload: unknown = null;
  try { payload = await res.json(); } catch { /* non-JSON body */ }

  if (!res.ok) {
    const msg = (payload as { error?: string } | null)?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return payload as T;
}

/**
 * Make a one-off temporary password that is easy to read out and type:
 * three groups of four, no look-alike characters (0/O, 1/l/I).
 */
export function generateTemporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, b => alphabet[b % alphabet.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`;
}
