import { describe, expect, it } from 'vitest';
import { shouldAutoSaveJob } from '@/lib/utils/pipelineAutoSave';
import type { ExtractedJobMetadata } from '@/types/pipeline';

const metadata = (overrides: Partial<ExtractedJobMetadata> = {}): ExtractedJobMetadata => ({
  companyName: 'Tabby',
  jobTitle: 'DevOps Intern',
  location: 'Riyadh',
  employmentType: null,
  seniority: null,
  sector: null,
  confidence: { companyName: 0.9, jobTitle: 0.9, location: 0.8 },
  needsUserConfirmation: false,
  ...overrides,
});

describe('shouldAutoSaveJob', () => {
  it('saves for signed-in users with a real company and title', () => {
    expect(shouldAutoSaveJob({ isSignedIn: true, isGuestMode: false, metadata: metadata() })).toBe(true);
  });

  it('never saves for guests or signed-out users', () => {
    expect(shouldAutoSaveJob({ isSignedIn: false, isGuestMode: false, metadata: metadata() })).toBe(false);
    expect(shouldAutoSaveJob({ isSignedIn: true, isGuestMode: true, metadata: metadata() })).toBe(false);
  });

  it('skips junk rows when extraction found no company or title', () => {
    expect(shouldAutoSaveJob({ isSignedIn: true, isGuestMode: false, metadata: null })).toBe(false);
    expect(shouldAutoSaveJob({ isSignedIn: true, isGuestMode: false, metadata: metadata({ companyName: null }) })).toBe(false);
    expect(shouldAutoSaveJob({ isSignedIn: true, isGuestMode: false, metadata: metadata({ jobTitle: '   ' }) })).toBe(false);
    expect(shouldAutoSaveJob({ isSignedIn: true, isGuestMode: false, metadata: metadata({ companyName: 'Unknown Company' }) })).toBe(false);
  });
});
