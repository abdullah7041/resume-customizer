import { expect, it } from 'vitest';
import { searchPostings } from '../job-search.js';
import type { FeedPosting } from '../../../src/lib/jobs/types.js';
it('filters and ranks before pagination, without requiring a follow', () => {
 const rows = ['Risk Engineer', 'AI Engineer', 'AI Product Engineer'].map((title, i) => ({id: String(i), title, location:'Riyadh', firstSeenAt:'2026-11-16T00:00:00Z', postedAt:null} as FeedPosting));
 const first = searchPostings(rows, {targetRoles:['AI Product Engineer']}, {offset:0, limit:1});
 expect(first.postings.map(p=>p.id)).toEqual(['2']);
 expect(first.nextOffset).toBe(1);
 const second = searchPostings(rows, {targetRoles:['AI Product Engineer']}, {offset:1, limit:1});
 expect(second.postings.map(p=>p.id)).toEqual(['1']);
 expect(second.nextOffset).toBeNull();
});
