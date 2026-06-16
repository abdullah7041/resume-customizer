import { describe, expect, it } from 'vitest';
import { buildTruthCheckView } from '../lib/utils/truthCheckSummary';
import type { ResumeTruthCheckResult, TruthCheckClaim } from '../types/truth-check';

function makeClaim(overrides: Partial<TruthCheckClaim> = {}): TruthCheckClaim {
  return {
    claimText: 'Led a team of 5 engineers.',
    section: 'Experience',
    severity: 'medium',
    riskTypes: [],
    evidenceStatus: 'needs_evidence',
    visibleEvidence: [],
    whyItMatters: 'Hiring managers may probe this.',
    userAction: 'Add a metric to back this up.',
    ...overrides,
  };
}

function makeResult(claims: TruthCheckClaim[]): ResumeTruthCheckResult {
  return {
    overallRisk: 'medium',
    summary: 'Some claims need clearer evidence.',
    claims,
    limits: { cannotVerify: [] },
  };
}

describe('buildTruthCheckView', () => {
  it('derives counts from claims correctly', () => {
    const claims = [
      makeClaim({ section: 'Experience', evidenceStatus: 'needs_evidence' }),
      makeClaim({ section: 'Skills', evidenceStatus: 'contradicted', severity: 'high' }),
      makeClaim({ section: 'Projects', evidenceStatus: 'unclear', riskTypes: ['unverifiable'] }),
      makeClaim({ section: 'Experience', evidenceStatus: 'supported' }),
    ];
    const view = buildTruthCheckView(makeResult(claims));

    expect(view.counts.claimsToReview).toBe(3);
    expect(view.counts.needsEvidence).toBe(1);
    // contradicted + unverifiable -> 2
    expect(view.counts.needsVerification).toBe(2);
    // distinct sections across ALL claims: Experience, Skills, Projects
    expect(view.counts.sectionsScanned).toBe(3);
  });

  it('priorities only include non-supported claims, capped at 3, severity-ordered', () => {
    const claims = [
      makeClaim({ section: 'Experience', severity: 'low', evidenceStatus: 'needs_evidence', claimText: 'low-1' }),
      makeClaim({ section: 'Experience', severity: 'high', evidenceStatus: 'needs_evidence', claimText: 'high-1' }),
      makeClaim({ section: 'Skills', severity: 'medium', evidenceStatus: 'needs_evidence', claimText: 'medium-1' }),
      makeClaim({ section: 'Skills', severity: 'high', evidenceStatus: 'contradicted', claimText: 'high-2' }),
      makeClaim({ section: 'Projects', severity: 'medium', evidenceStatus: 'supported', claimText: 'supported-1' }),
    ];
    const view = buildTruthCheckView(makeResult(claims));

    expect(view.priorities).toHaveLength(3);
    // Never includes a supported claim.
    expect(view.priorities.every((c) => c.evidenceStatus !== 'supported')).toBe(true);
    // High severity first.
    expect(view.priorities[0].severity).toBe('high');
    expect(view.priorities[1].severity).toBe('high');
    // Tie-break: contradicted ranks above needs_evidence at same severity.
    expect(view.priorities[0].evidenceStatus).toBe('contradicted');
    expect(view.priorities[1].evidenceStatus).toBe('needs_evidence');
    // Third item is the medium severity claim.
    expect(view.priorities[2].severity).toBe('medium');
  });

  it('groups date/inconsistent/unverifiable claims under "dates" even when section is experience', () => {
    const claims = [
      makeClaim({ section: 'Experience', riskTypes: ['inconsistent'], claimText: 'inconsistent dates' }),
      makeClaim({ section: 'Experience', riskTypes: ['unverifiable'], claimText: 'unverifiable timeline' }),
      makeClaim({ section: 'Experience', riskTypes: [], claimText: 'regular experience claim' }),
    ];
    const view = buildTruthCheckView(makeResult(claims));

    const datesGroup = view.groups.find((g) => g.key === 'dates');
    const experienceGroup = view.groups.find((g) => g.key === 'experience');

    expect(datesGroup?.claims).toHaveLength(2);
    expect(experienceGroup?.claims).toHaveLength(1);
  });

  it('marks isEmpty true when all claims are supported', () => {
    const claims = [
      makeClaim({ evidenceStatus: 'supported' }),
      makeClaim({ evidenceStatus: 'supported', section: 'Skills' }),
    ];
    const view = buildTruthCheckView(makeResult(claims));

    expect(view.isEmpty).toBe(true);
    expect(view.counts.claimsToReview).toBe(0);
    expect(view.priorities).toHaveLength(0);
    expect(view.groups).toHaveLength(0);
  });

  it('omits empty groups and preserves fixed display order', () => {
    const claims = [
      makeClaim({ section: 'Certificates', evidenceStatus: 'needs_evidence', claimText: 'cert claim' }),
      makeClaim({ section: 'Experience', evidenceStatus: 'needs_evidence', claimText: 'exp claim' }),
    ];
    const view = buildTruthCheckView(makeResult(claims));

    expect(view.groups.map((g) => g.key)).toEqual(['experience', 'certificates']);
  });

  it('maps unrecognized sections to "other"', () => {
    const claims = [
      makeClaim({ section: 'Volunteering', evidenceStatus: 'unclear', claimText: 'volunteer claim' }),
    ];
    const view = buildTruthCheckView(makeResult(claims));

    expect(view.groups.map((g) => g.key)).toEqual(['other']);
  });
});
