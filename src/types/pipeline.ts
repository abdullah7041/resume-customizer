// src/types/pipeline.ts
// Type definitions for the job application pipeline

export type JobApplicationStatus =
  | 'saved'
  | 'applied'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

/** LinkedIn's "Seniority level / Employment type / Job function / Industries"
 * sidebar, parsed verbatim server-side (netlify/lib/job-page-extract.ts) from
 * a page import. Verbatim values win over the AI-inferred equivalents in
 * ExtractedJobMetadata since they came directly off the page. */
export interface ExtractedJobCriteria {
  seniority: string | null;
  employmentType: string | null;
  jobFunction: string | null;
  industries: string | null;
}

export interface ExtractedJobMetadata {
  companyName: string | null;
  jobTitle: string | null;
  location: string | null;
  employmentType: string | null;
  seniority: string | null;
  sector: string | null;
  confidence: {
    companyName: number;
    jobTitle: number;
    location: number;
  };
  needsUserConfirmation: boolean;
}

export interface JobApplication {
  id: string;
  user_id: string;
  company_name: string | null;
  job_title: string | null;
  job_description: string;
  job_url: string | null;
  location: string | null;
  employment_type: string | null;
  seniority: string | null;
  sector: string | null;
  match_score: number | null;
  status: JobApplicationStatus;
  resume_export_file_path: string | null;
  resume_export_file_name: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  applied_at: string | null;
  outcome_at: string | null;
  outcome_source: string;
  created_at: string;
  updated_at: string;
}

export interface CreateJobApplicationInput {
  company_name?: string | null;
  job_title?: string | null;
  job_description: string;
  job_url?: string | null;
  location?: string | null;
  employment_type?: string | null;
  seniority?: string | null;
  sector?: string | null;
  match_score?: number | null;
  status?: JobApplicationStatus;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateJobApplicationOptions {
  duplicateStrategy?: 'overwrite' | 'preserve_user_fields';
}

export interface UpdateJobApplicationInput {
  company_name?: string | null;
  job_title?: string | null;
  job_url?: string | null;
  location?: string | null;
  employment_type?: string | null;
  seniority?: string | null;
  sector?: string | null;
  match_score?: number | null;
  status?: JobApplicationStatus;
  resume_export_file_path?: string | null;
  resume_export_file_name?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  applied_at?: string | null;
  outcome_at?: string | null;
  outcome_source?: string;
}
