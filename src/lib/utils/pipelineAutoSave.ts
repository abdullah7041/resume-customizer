/**
 * Gate for auto-saving an analyzed job into the pipeline.
 *
 * Auto-save fires silently after a successful match analysis, so it must only
 * run for signed-in (non-guest) users and only when metadata extraction found
 * a real company AND title — junk rows would pollute the pipeline, and the
 * manual SaveJobToPipelineCard still covers the low-confidence case.
 */
import type { ExtractedJobMetadata } from '@/types/pipeline';

export function shouldAutoSaveJob(params: {
  isSignedIn: boolean;
  isGuestMode: boolean;
  metadata: ExtractedJobMetadata | null;
}): boolean {
  const { isSignedIn, isGuestMode, metadata } = params;
  if (!isSignedIn || isGuestMode) return false;
  const companyName = typeof metadata?.companyName === 'string' ? metadata.companyName.trim() : '';
  const jobTitle = typeof metadata?.jobTitle === 'string' ? metadata.jobTitle.trim() : '';
  if (!companyName || !jobTitle) return false;
  return companyName.toLowerCase() !== 'unknown company';
}
