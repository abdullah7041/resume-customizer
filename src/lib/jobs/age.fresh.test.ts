import { describe, it, expect } from 'vitest';
import { withinAgeWindow } from './age';
import type { FeedPosting } from './types';
const now = Date.parse('2026-11-14T12:00:00Z');
const posting = (postedAt: string | null, extra = {}): FeedPosting => ({ id: '1', companyId: 'c', companyName: 'Co', title: 'Engineer', location: 'Riyadh', applyUrl: 'https://example.com', firstSeenAt: new Date(now).toISOString(), postedAt, ...extra });
describe('strict 24 hour window', () => {
  it('accepts verified publication timestamps with offsets', () => {
    expect(withinAgeWindow(posting('2026-11-13T16:00:00+03:00', { publicationKind: 'published', publicationPrecision: 'timestamp' }), 1, now)).toBe(true);
  });
  it.each([null, 'bad', '2026-11-14', '2026-11-14T13:00:00Z', '2026-11-13T12:00:00Z'])('rejects %s', date => {
    expect(withinAgeWindow(posting(date, { publicationKind: 'published', publicationPrecision: 'timestamp' }), 1, now)).toBe(false);
  });
  it('rejects updates and legacy dates without provenance', () => {
    expect(withinAgeWindow(posting('2026-11-14T10:00:00Z'), 1, now)).toBe(false);
    expect(withinAgeWindow(posting('2026-11-14T10:00:00Z', { publicationKind: 'updated', publicationPrecision: 'timestamp' }), 1, now)).toBe(false);
  });
});
