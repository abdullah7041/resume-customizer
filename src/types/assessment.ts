export type AssessmentKind = 'match' | 'optimize';

export interface AssessmentInput {
  resumeText: string;
  jobDescription: string;
  language: 'en' | 'ar';
  kind: AssessmentKind;
  isOptimized: boolean;
  rubricVersion: string;
}

export interface AssessmentContext {
  key: string;
  resumeFingerprint: string;
  jobFingerprint: string;
  language: 'en' | 'ar';
  kind: AssessmentKind;
  isOptimized: boolean;
  rubricVersion: string;
}

export interface AssessmentRecord<T> {
  context: AssessmentContext;
  jobSnapshot: string;
  requestId: string;
  createdAt: string;
  result: T;
  model?: string;
}
