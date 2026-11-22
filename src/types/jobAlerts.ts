export type JobAlertScope = 'followed' | 'catalogue';
export type JobAlertOutcome = 'empty' | 'accepted' | 'failed' | 'setup_required';
export interface JobAlertTestResult {
  status: 'accepted' | 'unknown' | 'failed';
  operationId: string;
  acceptedAt?: string;
  code?: 'method_not_allowed' | 'auth_required' | 'verify_email' | 'invalid_request' | 'operation_expired' | 'service_unavailable' | 'quota_unavailable' | 'limit_reached' | 'acceptance_unknown';
  retryAfter?: number;
}

export interface JobAlertPreferences {
  enabled: boolean;
  language: 'ar' | 'en';
  scope: JobAlertScope;
  serviceAvailable: boolean;
  serviceState?: 'paused' | 'manual' | 'unconfigured' | 'scheduled';
  lastCheckedAt: string | null;
  lastOutcome: JobAlertOutcome | null;
  lastProviderAcceptedAt: string | null;
}
