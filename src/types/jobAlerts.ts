export type JobAlertScope = 'followed' | 'catalogue';
export type JobAlertOutcome = 'empty' | 'accepted' | 'failed' | 'setup_required';

export interface JobAlertPreferences {
  enabled: boolean;
  language: 'ar' | 'en';
  scope: JobAlertScope;
  serviceAvailable: boolean;
  lastCheckedAt: string | null;
  lastOutcome: JobAlertOutcome | null;
  lastProviderAcceptedAt: string | null;
}
