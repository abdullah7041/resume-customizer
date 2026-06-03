export type FeedbackType =
  | 'bug'
  | 'resume_quality'
  | 'confusing_ux'
  | 'feature_request'
  | 'pricing_credits'
  | 'other';

export type FeedbackStatus = 'new' | 'reviewing' | 'resolved' | 'closed';
export type FeedbackPriority = 'low' | 'normal' | 'high' | 'urgent';
export type FeedbackRewardStatus = 'awarded' | 'not_eligible' | 'duplicate' | 'already_awarded';
export type FeedbackTrustToApply = 'yes' | 'somewhat' | 'no';
export type FeedbackWillingnessToPay = 'yes' | 'maybe' | 'no';

export interface FeedbackValidationAnswers {
  trustToApply?: FeedbackTrustToApply | null;
  willingnessToPay?: FeedbackWillingnessToPay | null;
}

export interface FeedbackContext {
  pagePath: string;
  userAgent: string;
  viewport: string;
  contextFeature: string;
}

export interface SubmitFeedbackInput {
  type: FeedbackType;
  message: string;
  rating?: number | null;
  validation?: FeedbackValidationAnswers;
}

export interface SubmitFeedbackResponse {
  success: boolean;
  id: string;
  rewardStatus: FeedbackRewardStatus;
  creditsAwarded: number;
  creditsRemaining: number | null;
}

export interface FeedbackReport {
  id: string;
  user_id: string;
  user_email: string;
  type: FeedbackType;
  message: string;
  page_path: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  reward_status: FeedbackRewardStatus;
  credits_awarded: number;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateFeedbackReportInput {
  id: string;
  status?: FeedbackStatus;
  priority?: FeedbackPriority;
  adminNotes?: string;
}
