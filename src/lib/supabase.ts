import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'platform_admin' | 'admin' | 'hr' | 'l_d_manager' | 'manager' | 'employee';

export interface UserProfile {
  id: string;
  organization_id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Minimum percentage to pass a course or module quiz. One value for every quiz runner. */
export const QUIZ_PASS_MARK = 70;
