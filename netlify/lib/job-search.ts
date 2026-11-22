import { dropReason, deriveRoleTerms } from '../../src/lib/jobs/filters.js';
import { matchedRoleTerms } from '../../src/lib/jobs/normalize.js';
import { withinAgeWindow } from '../../src/lib/jobs/age.js';
import type { FeedIntent, FeedPosting } from '../../src/lib/jobs/types.js';
import classifications from '../../src/lib/jobs/employer-classifications.json';

/** Reviewed primary-source metadata; identity is the ATS pair, never a display name. */
export function classifyEmployer<T extends {
    source?: string; token?: string; company_category?: string; sector?: string | null;
    classification_source?: string | null; classification_verified_at?: string | null;
}>(company: T) {
    const reviewed = classifications[`${company.source}:${company.token}` as keyof typeof classifications];
    const databaseEvidence = company.classification_source ? {
        source: company.classification_source, verifiedAt: company.classification_verified_at ?? null,
        basis: 'Database-reviewed employer metadata.',
    } : null;
    const databaseTime = Date.parse(company.classification_verified_at ?? '');
    const auditedTime = Date.parse(reviewed?.verifiedAt ?? '');
    const newerDatabase = databaseTime >= auditedTime;
    const olderDatabase = Number.isFinite(databaseTime) && databaseTime < auditedTime;
    const useCategory = reviewed && !newerDatabase && reviewed.category !== 'unclassified'
        && (!company.company_category || company.company_category === 'unclassified' || olderDatabase);
    const useSector = reviewed && !newerDatabase && (!company.sector?.trim() || olderDatabase);
    const auditedEvidence = reviewed ? { source: reviewed.evidenceUrl, verifiedAt: reviewed.verifiedAt, basis: reviewed.basis } : null;
    const categoryEvidence = useCategory ? auditedEvidence : databaseEvidence;
    const sectorEvidence = useSector ? auditedEvidence : databaseEvidence;
    // A shared source describes the category when known; field evidence keeps mixed origins explicit.
    const evidence = useCategory || ((!company.company_category || company.company_category === 'unclassified') && useSector)
        ? auditedEvidence : databaseEvidence;
    return {
        ...company,
        company_category: useCategory ? reviewed.category : company.company_category,
        sector: useSector ? reviewed.sector : company.sector,
        classification_source: evidence?.source ?? company.classification_source ?? null,
        classification_verified_at: evidence?.verifiedAt ?? company.classification_verified_at ?? null,
        category_evidence: categoryEvidence,
        sector_evidence: sectorEvidence,
    };
}

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
