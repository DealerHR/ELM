import { supabase } from './supabase';

/**
 * Candidate portal data access.
 *
 * The portal runs without a login. Every call goes through a database
 * function that requires the exact, unexpired access code, so anonymous
 * users never read or write tables directly.
 */

export interface PortalInvitation {
  id: string;
  candidate_name: string | null;
  organization_name: string | null;
  access_code: string;
  status: string;
  include_growth_profile: boolean;
  include_domain_assessment: boolean;
  growth_profile_level: string | null;
  has_growth_assessment: boolean;
  has_domain_assessment: boolean;
  growth_status: string | null;
  domain_status: string | null;
  expires_at: string;
}

export interface GrowthQuestion {
  id: string;
  question_number: number;
  dimension: string;
  question_text: string;
  question_text_simple: string | null;
  question_text_hi: string | null;
  question_type: string;
  answer_scale: string;
  question_format: string;
  option_1: string | null;
  option_2: string | null;
  option_3: string | null;
  option_4: string | null;
  option_5: string | null;
  option_1_simple: string | null;
  option_2_simple: string | null;
  option_3_simple: string | null;
  option_4_simple: string | null;
  option_5_simple: string | null;
  option_1_hi: string | null;
  option_2_hi: string | null;
  option_3_hi: string | null;
  option_4_hi: string | null;
  option_5_hi: string | null;
}

export interface DomainQuestion {
  id: string;
  question_number: number;
  question_text: string;
  question_type: string;
  options: string[] | null;
  points: number;
}

export interface DomainTestPayload {
  assessment: { id: string; title: string; description: string | null };
  questions: DomainQuestion[];
  attempt_id: string;
  attempt_status: string;
}

export class PortalError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function toPortalError(err: { message?: string } | null): PortalError {
  const msg = err?.message || '';
  if (msg.startsWith('INVALID_CODE')) return new PortalError('INVALID_CODE', 'Access code not found. Please check your code and try again.');
  if (msg.startsWith('EXPIRED')) return new PortalError('EXPIRED', 'This access code has expired. Please contact the organisation for a new invitation.');
  if (msg.startsWith('ALREADY_COMPLETED')) return new PortalError('ALREADY_COMPLETED', 'This assessment has already been submitted.');
  if (msg.startsWith('INCOMPLETE')) return new PortalError('INCOMPLETE', 'Please answer every question before submitting.');
  if (msg.startsWith('NOT_INCLUDED')) return new PortalError('NOT_INCLUDED', 'This assessment is not part of your invitation.');
  return new PortalError('UNKNOWN', 'Something went wrong. Please try again.');
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw toPortalError(error);
  return data as T;
}

export const portalApi = {
  getInvitation: (code: string) =>
    rpc<PortalInvitation>('portal_get_invitation', { p_code: code }),

  getGrowthQuestions: (code: string) =>
    rpc<GrowthQuestion[]>('portal_get_growth_questions', { p_code: code }),

  getGrowthResponses: (code: string) =>
    rpc<{ question_id: string; answer_value: number }[]>('portal_get_growth_responses', { p_code: code }),

  saveGrowthResponses: (code: string, responses: { question_id: string; answer_value: number }[]) =>
    rpc<void>('portal_save_growth_responses', { p_code: code, p_responses: responses }),

  completeGrowth: (code: string) =>
    rpc<{ assessment_id: string }>('portal_complete_growth', { p_code: code }),

  getDomainTest: (code: string) =>
    rpc<DomainTestPayload>('portal_get_domain_test', { p_code: code }),

  submitDomain: (code: string, answers: Record<string, string>) =>
    rpc<{ score: number; max_score: number; percentage: number }>('portal_submit_domain', { p_code: code, p_answers: answers }),

  /** Ask the edge function to score a finished growth assessment. */
  scoreGrowth: async (code: string, assessmentId: string): Promise<boolean> => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/compute-growth-profile-scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
          Apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ assessment_id: assessmentId, access_code: code }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};
