import type { AssessmentContext, AssessmentInput } from '@/types/assessment';

export async function fingerprintText(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function createAssessmentContext(input: AssessmentInput): Promise<AssessmentContext> {
  const [resumeFingerprint, jobFingerprint] = await Promise.all([
    fingerprintText(input.resumeText),
    fingerprintText(input.jobDescription),
  ]);
  const { language, kind, isOptimized, rubricVersion } = input;

  return {
    key: JSON.stringify([resumeFingerprint, jobFingerprint, language, kind, isOptimized, rubricVersion]),
    resumeFingerprint,
    jobFingerprint,
    language,
    kind,
    isOptimized,
    rubricVersion,
  };
}

export function isCurrentAssessment(saved: AssessmentContext | undefined, active: AssessmentContext): boolean {
  return saved?.key === active.key;
}

export function canAcceptAssessment(
  activeRequestId: string | null,
  responseRequestId: string,
  saved: AssessmentContext,
  active: AssessmentContext,
): boolean {
  return activeRequestId === responseRequestId && saved.key === active.key;
}
