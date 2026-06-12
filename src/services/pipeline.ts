// src/services/pipeline.ts
// Service layer for job application pipeline (Supabase RLS)

import { supabase } from './supabase';
import type {
  JobApplication,
  CreateJobApplicationInput,
  UpdateJobApplicationInput,
  JobApplicationStatus,
} from '@/types/pipeline';

const TABLE = 'job_applications';

function summarizeError(error: unknown) {
  const e = error as { message?: string; code?: string; status?: number };
  return { message: e.message || 'Unknown error', code: e.code || 'unknown', status: e.status || 500 };
}

/**
 * Build auto-timestamp fields based on status transition.
 * Only sets timestamps if they are currently null.
 */
function buildTimestampFields(
  current: Pick<JobApplication, 'applied_at' | 'outcome_at'> | null,
  newStatus: JobApplicationStatus
): Partial<Pick<JobApplication, 'applied_at' | 'outcome_at'>> {
  const updates: Partial<Pick<JobApplication, 'applied_at' | 'outcome_at'>> = {};

  if (newStatus === 'applied' && !current?.applied_at) {
    updates.applied_at = new Date().toISOString();
  }
  if (['offer', 'rejected', 'withdrawn'].includes(newStatus) && !current?.outcome_at) {
    updates.outcome_at = new Date().toISOString();
  }

  return updates;
}

/**
 * Check for recent duplicate job applications (same user + company + title within 7 days).
 */
async function findRecentDuplicate(
  userId: string,
  companyName: string | null | undefined,
  jobTitle: string | null | undefined
): Promise<JobApplication | null> {
  if (!companyName || !jobTitle) return null;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .ilike('company_name', companyName)
    .ilike('job_title', jobTitle)
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0] as JobApplication;
}

/**
 * Create a new job application. Deduplicates against recent company+title matches.
 */
export async function createJobApplication(
  input: CreateJobApplicationInput
): Promise<{ data: JobApplication | null; error: string | null; isDuplicate?: boolean }> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Authentication required. Please sign in.' };
    }

    // Deduplication check
    const duplicate = await findRecentDuplicate(user.id, input.company_name, input.job_title);
    if (duplicate) {
      const status = input.status || duplicate.status;
      const timestampUpdates = buildTimestampFields(duplicate, status);
      const mergedMetadata = {
        ...(duplicate.metadata || {}),
        ...(input.metadata || {}),
      };

      const { data, error } = await supabase
        .from(TABLE)
        .update({
          ...input,
          status,
          metadata: mergedMetadata,
          ...timestampUpdates,
        })
        .eq('id', duplicate.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.warn('[PipelineService] createJobApplication duplicate update error:', summarizeError(error));
        return { data: null, error: error.message, isDuplicate: true };
      }

      return { data: data as JobApplication, error: null, isDuplicate: true };
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        ...input,
        user_id: user.id,
        status: input.status || 'saved',
      })
      .select()
      .single();

    if (error) {
      console.warn('[PipelineService] createJobApplication error:', summarizeError(error));
      return { data: null, error: error.message };
    }

    return { data: data as JobApplication, error: null };
  } catch (error) {
    console.warn('[PipelineService] createJobApplication exception:', summarizeError(error));
    return { data: null, error: 'Failed to save job application.' };
  }
}

/**
 * Update an existing job application. Auto-manages timestamp fields on status changes.
 */
export async function updateJobApplication(
  id: string,
  input: UpdateJobApplicationInput
): Promise<{ data: JobApplication | null; error: string | null }> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: 'Authentication required. Please sign in.' };
    }

    // If status is changing, fetch current record to apply timestamp rules
    let timestampUpdates: Partial<Pick<JobApplication, 'applied_at' | 'outcome_at'>> = {};
    if (input.status) {
      const { data: current } = await supabase
        .from(TABLE)
        .select('applied_at, outcome_at')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      timestampUpdates = buildTimestampFields(current as JobApplication | null, input.status);
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update({
        ...input,
        ...timestampUpdates,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.warn('[PipelineService] updateJobApplication error:', summarizeError(error));
      return { data: null, error: error.message };
    }

    return { data: data as JobApplication, error: null };
  } catch (error) {
    console.warn('[PipelineService] updateJobApplication exception:', summarizeError(error));
    return { data: null, error: 'Failed to update job application.' };
  }
}

/**
 * List all job applications for the authenticated user.
 */
export async function listJobApplications(): Promise<{
  data: JobApplication[];
  error: string | null;
}> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: [], error: 'Authentication required. Please sign in.' };
    }

    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('[PipelineService] listJobApplications error:', summarizeError(error));
      return { data: [], error: error.message };
    }

    return { data: (data || []) as JobApplication[], error: null };
  } catch (error) {
    console.warn('[PipelineService] listJobApplications exception:', summarizeError(error));
    return { data: [], error: 'Failed to load pipeline.' };
  }
}

/**
 * Delete a job application.
 */
export async function deleteJobApplication(id: string): Promise<{ error: string | null }> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'Authentication required. Please sign in.' };
    }

    const { error } = await supabase.from(TABLE).delete().eq('id', id).eq('user_id', user.id);

    if (error) {
      console.warn('[PipelineService] deleteJobApplication error:', summarizeError(error));
      return { error: error.message };
    }

    return { error: null };
  } catch (error) {
    console.warn('[PipelineService] deleteJobApplication exception:', summarizeError(error));
    return { error: 'Failed to delete job application.' };
  }
}

/**
 * Attach an exported resume file path to a saved job application.
 */
export async function attachExportToJobApplication(
  id: string,
  filePath: string,
  fileName: string
): Promise<{ data: JobApplication | null; error: string | null }> {
  return updateJobApplication(id, {
    resume_export_file_path: filePath,
    resume_export_file_name: fileName,
  });
}
