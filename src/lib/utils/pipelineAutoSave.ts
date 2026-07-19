/**
 * Gate for auto-saving an analyzed job into the pipeline.
 *
 * Auto-save fires silently after a successful match analysis, so it must only
 * run for signed-in (non-guest) users and only when metadata extraction found
 * a real company AND title — junk rows would pollute the pipeline, and the
 * manual SaveJobToPipelineCard still covers the low-confidence case.
 */
import type { ExtractedJobMetadata } from '@/types/pipeline';
import { sanitizeCompanyName, sanitizeJobMetadataField } from '@/lib/utils/jobMetadata';

export function shouldAutoSaveJob(params: {
  isSignedIn: boolean;
  isGuestMode: boolean;
  metadata: ExtractedJobMetadata | null;
}): boolean {
  const { isSignedIn, isGuestMode, metadata } = params;
  if (!isSignedIn || isGuestMode) return false;
  const companyName = sanitizeCompanyName(metadata?.companyName);
  const jobTitle = sanitizeJobMetadataField(metadata?.jobTitle);
  return Boolean(companyName && jobTitle);
}
