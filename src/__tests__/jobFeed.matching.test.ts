import { describe, expect, it } from 'vitest';
import { normalizeText } from '@/lib/jobs/normalize';
import { deriveRoleTerms, dropReason, locationConflict, SAUDI_LOCATIONS } from '@/lib/jobs/filters';
import { buildFeed, isNew, scorePosting } from '@/lib/jobs/score';
import type { FeedIntent, FeedPosting } from '@/lib/jobs/types';

function posting(overrides: Partial<FeedPosting> = {}): FeedPosting {
  return {
    id: 'p1',
    companyId: 'c1',
    companyName: 'Salla',
    title: 'Senior AI Backend Engineer',
    location: 'Riyadh, Saudi Arabia',
    applyUrl: 'https://apply.workable.com/salla/j/ABC/',
    postedAt: '2026-08-20',
    firstSeenAt: '2026-08-20T00:00:00.000Z',
    ...overrides,
  };
}

const seniorEngineer: FeedIntent = {
  targetRoles: ['Senior AI Engineer', 'Senior Backend Engineer'],
  seniority: 'senior',
};

describe('normalizeText', () => {
  it('folds Arabic alef, ta marbuta and diacritics', () => {
    expect(normalizeText('جدة')).toBe(normalizeText('جده'));
    expect(normalizeText('أول')).toBe(normalizeText('اول'));
    expect(normalizeText('مُهَنْدِس')).toBe(normalizeText('مهندس'));
  });

  it('strips invisible marks that survive copy-paste from job boards', () => {
    expect(normalizeText('\u200fالرياض\u200e')).toBe(normalizeText('الرياض'));
  });
});

describe('location filter', () => {
  it('keeps Saudi postings written in Arabic', () => {
    const job = posting({ title: 'مهندس برمجيات', location: 'الرياض، السعودية' });
    const intent: FeedIntent = { targetRoles: ['مهندس برمجيات'], seniority: 'senior' };
    expect(dropReason(job, intent)).toBeNull();
  });

  it('drops postings outside the allowed locations', () => {
    expect(dropReason(posting({ location: 'Dubai, UAE' }), seniorEngineer)).toBe('location');
  });
});

describe('locationConflict — the 2026-07-31 Agoda regression', () => {
  it('drops a Bangkok-based role whose board metadata claims Riyadh', () => {
    const job = posting({
      title: 'Staff Data Engineer (Bangkok based, relocation provided)',
      location: 'Riyadh',
      companyName: 'Agoda',
    });
    expect(locationConflict(job.title, SAUDI_LOCATIONS)).toBe(true);
    expect(dropReason(job, seniorEngineer)).toBe('location_conflict');
  });

  it('trusts a title that names a Saudi city', () => {
    expect(locationConflict('Backend Engineer (Riyadh based)', SAUDI_LOCATIONS)).toBe(false);
  });
});

describe('seniority bounds both ends', () => {
  it.each([
    'Lead Data Engineer',
    'Staff Software Engineer',
    'Principal Backend Engineer',
    'Head of Engineering',
    'Engineering Manager, Platform',
  ])('drops %s for a senior IC', (title) => {
    expect(dropReason(posting({ title }), seniorEngineer)).toBe('seniority');
  });

  it.each(['Backend Engineer Intern', 'Junior AI Engineer', 'مهندس برمجيات متدرب'])(
    'drops %s as below level',
    (title) => {
      expect(dropReason(posting({ title }), seniorEngineer)).toBe('seniority');
    },
  );

  it('allows a lead role when the user is looking for lead roles', () => {
    const intent: FeedIntent = { targetRoles: ['Engineering Lead'], seniority: 'lead' };
    expect(dropReason(posting({ title: 'Lead Data Engineer' }), intent)).toBeNull();
  });
});

describe('role terms derive from the user, not a tech vocabulary', () => {
  it('drops the level words and keeps the function', () => {
    // "Senior" is a level word; "AI" and "Engineer" both describe the work.
    expect(deriveRoleTerms(['Senior AI Engineer'])).toEqual(['ai', 'engineer']);
  });

  it('keeps two-letter domain terms like AI and ML', () => {
    // A three-character floor dropped these, which flattened every engineering
    // role to the same score and made the ranking meaningless.
    expect(deriveRoleTerms(['Senior AI Engineer'])).toEqual(['ai', 'engineer']);
    expect(deriveRoleTerms(['ML Engineer'])).toContain('ml');
    expect(deriveRoleTerms(['BI Developer'])).toContain('bi');
  });

  it('still drops two-letter function words', () => {
    expect(deriveRoleTerms(['Head of Data'])).not.toContain('of');
    expect(deriveRoleTerms(['Analyst in Riyadh'])).not.toContain('in');
  });

  it('ranks a role matching more of the target above one matching less', () => {
    const intent: FeedIntent = { targetRoles: ['Senior AI Engineer'], seniority: 'senior' };
    const feed = buildFeed(
      [
        posting({ id: 'designer', title: 'Senior Product Designer' }),
        posting({ id: 'ai', title: 'Senior AI Backend Engineer' }),
        posting({ id: 'backend', title: 'Senior Backend Engineer' }),
      ],
      intent,
    );

    expect(feed.kept[0].posting.id).toBe('ai');
    expect(feed.kept[0].score).toBeGreaterThan(feed.kept[1].score);
  });

  it('works for a non-tech role', () => {
    const intent: FeedIntent = { targetRoles: ['Staff Nurse'], seniority: 'mid' };
    expect(dropReason(posting({ title: 'Registered Nurse' }), intent)).toBeNull();
    expect(dropReason(posting({ title: 'Backend Engineer' }), intent)).toBe('role');
  });
});

describe('scoring', () => {
  it('is 40 for clearing the filters, plus 15 per supported term', () => {
    const terms = deriveRoleTerms(['Senior AI Engineer', 'Backend Developer']);
    // ai + backend + engineer = three supported terms.
    expect(scorePosting(posting({ title: 'AI Backend Engineer' }), terms).score).toBe(85);
    expect(scorePosting(posting({ title: 'Product Owner' }), terms).score).toBe(40);
  });

  it('ranks the better match first and reports why', () => {
    const feed = buildFeed(
      [
        posting({ id: 'weak', title: 'Senior Engineer' }),
        posting({ id: 'strong', title: 'Senior AI Backend Engineer' }),
        posting({ id: 'out', title: 'Staff Engineer' }),
      ],
      seniorEngineer,
    );

    expect(feed.kept.map((k) => k.posting.id)).toEqual(['strong', 'weak']);
    expect(feed.kept[0].matched).toContain('engineer');
    expect(feed.dropped).toEqual([
      { posting: expect.objectContaining({ id: 'out' }), reason: 'seniority' },
    ]);
  });
});

describe('isNew suppresses the backfill flood', () => {
  const trackedSince = '2026-08-10T00:00:00.000Z';

  it('ignores postings that predate tracking the company', () => {
    expect(isNew(posting({ firstSeenAt: '2026-07-01T00:00:00.000Z' }), trackedSince, null)).toBe(false);
  });

  it('flags a posting first seen after tracking began', () => {
    expect(isNew(posting({ firstSeenAt: '2026-08-20T00:00:00.000Z' }), trackedSince, null)).toBe(true);
  });

  it('stops flagging once the feed has been opened', () => {
    const job = posting({ firstSeenAt: '2026-08-20T00:00:00.000Z' });
    expect(isNew(job, trackedSince, '2026-08-21T00:00:00.000Z')).toBe(false);
  });
});
