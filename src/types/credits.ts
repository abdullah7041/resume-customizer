/**
 * Credit System Type Definitions
 *
 * Defines interfaces and constants for the credit system.
 * Used across credit components and hooks.
 */

export interface UserCredits {
  remaining: number;
  total: number;
  feedbackCreditsEarned: number;
  referralCreditsEarned: number;
  resetDate: string;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  feature: string;
  amount: number;
  creditsBefore: number;
  creditsAfter: number;
  transactionType: 'consumption' | 'referral_reward' | 'feedback_reward' | 'monthly_reset';
  metadata: Record<string, any>;
  createdAt: string;
}

/**
 * Credit costs for each feature
 * Free features cost 0 credits
 */
export const FEATURE_COSTS = {
  parse_resume: 0,
  ai_match: 2,
  vision2030: 2,
  optimize: 5,
  interview_prep: 3,
  cover_letter: 4,
  export_template: 0,
} as const;

export type FeatureName = keyof typeof FEATURE_COSTS;

/**
 * Feature names mapped to display labels
 */
export const FEATURE_LABELS: Record<FeatureName, string> = {
  parse_resume: 'Resume Parsing',
  ai_match: 'AI Match Analysis',
  vision2030: 'Vision 2030 Alignment',
  optimize: 'Resume Optimization',
  interview_prep: 'Interview Preparation',
  cover_letter: 'Cover Letter Generation',
  export_template: 'Template Export',
};
