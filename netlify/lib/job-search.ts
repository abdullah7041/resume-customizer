import { dropReason, deriveRoleTerms } from '../../src/lib/jobs/filters.js';
import { matchedRoleTerms } from '../../src/lib/jobs/normalize.js';
import { withinAgeWindow } from '../../src/lib/jobs/age.js';
import type { FeedIntent, FeedPosting } from '../../src/lib/jobs/types.js';
export function searchPostings(rows: FeedPosting[], intent: FeedIntent, page: {
    offset: number;
    limit: number;
    maxAgeDays?: number;
}) {
    if (!intent.targetRoles.some(role => role.trim())) return { postings: [], nextOffset: null };
    const terms = deriveRoleTerms(intent.targetRoles);
    const filtered = rows.filter(row => !dropReason(row, intent) && (page.maxAgeDays === undefined || withinAgeWindow(row, page.maxAgeDays, Date.now())));
    filtered.sort((a, b) => matchedRoleTerms(b.title, terms).length - matchedRoleTerms(a.title, terms).length || (b.postedAt ?? b.firstSeenAt).localeCompare(a.postedAt ?? a.firstSeenAt) || a.id.localeCompare(b.id));
    const end = page.offset + page.limit;
    return { postings: filtered.slice(page.offset, end), nextOffset: end < filtered.length ? end : null };
}
