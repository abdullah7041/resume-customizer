import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { withRateLimit } from '../lib/rate-limiter.js';
import { getSupabaseClient } from '../lib/supabase-client.js';
import { classifyEmployer, FEED_MATCH_CONTRACT, searchPostings } from '../lib/job-search.js';
import { initSentry, captureError } from '../lib/sentry.js';
import type { FeedPosting } from '../../src/lib/jobs/types.js';
initSentry();
const schema = z.object({ targetRoles: z.array(z.string().trim().min(1).max(120)).max(10), locations: z.array(z.string().max(100)).max(10).optional(), seniority: z.enum(['junior', 'mid', 'senior', 'lead', 'manager']).optional(), followedOnly: z.boolean().default(false), offset: z.number().int().min(0).max(100000).default(0), limit: z.number().int().min(1).max(50).default(20), maxAgeDays: z.number().min(1).max(365).optional() });
const searchSchema = schema.extend({ cv: z.object({
    id: z.string().min(1).max(200), revision: z.string().regex(/^[a-f0-9]{64}$/), language: z.enum(['en', 'ar']),
}).optional() });
const json = (statusCode: number, body: unknown) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }, body: JSON.stringify(body) });
const baseHandler: Handler = async (event) => {
    try {
        if (event.httpMethod !== 'POST')
            return json(405, { status: 405, code: 'method', message: 'Method not allowed' });
        const db = getSupabaseClient();
        if (!db)
            return json(503, { status: 503, code: 'unavailable', message: 'Search unavailable' });
        const token = (event.headers.authorization ?? event.headers.Authorization ?? '').replace(/^Bearer\s+/i, '');
        const { data: { user }, error: authError } = await db.auth.getUser(token);
        if (authError || !user)
            return json(401, { status: 401, code: 'auth', message: 'Sign in to search jobs' });
        let input: unknown;
        try {
            input = JSON.parse(event.body ?? '{}');
        }
        catch {
            return json(400, { status: 400, code: 'invalid', message: 'Invalid search' });
        }
        const parsed = searchSchema.safeParse(input);
        if (!parsed.success)
            return json(400, { status: 400, code: 'invalid', message: 'Invalid search' });
        if (process.env.JOB_CATALOGUE_ENABLED !== 'true')
            return json(503, { status: 503, code: 'catalogue_disabled', message: 'Catalogue search is not available yet' });
        const tracked = await db.from('user_tracked_companies').select('company_id').eq('user_id', user.id);
        if (tracked.error)
            throw tracked.error;
        const trackedIds = (tracked.data ?? []).map(row => row.company_id as string);
        const registry = await db.from('ats_companies').select('id,display_name,company_category,sector,classification_source,classification_verified_at,last_status,last_fetched_at,source,token').eq('catalog_enabled', true);
        if (registry.error)
            throw registry.error;
        const companies = (registry.data ?? []).map(company => ({ ...classifyEmployer(company), followed: trackedIds.includes(company.id) }));
        const dismissed = await db.from('user_job_feed_state').select('posting_id').eq('user_id', user.id).eq('state', 'dismissed');
        if (dismissed.error)
            throw dismissed.error;
        const hidden = new Set(dismissed.data?.map(row => row.posting_id));
        const ids = parsed.data.followedOnly ? trackedIds : [...new Set([...trackedIds, ...companies.map(row => row.id as string)])];
        const names = new Map(companies.map(row => [row.id, row.display_name]));
        if (trackedIds.length) {
            const followed = await db.from('ats_companies').select('id,display_name,company_category,sector,classification_source,classification_verified_at,last_status,last_fetched_at,source,token').in('id', trackedIds);
            if (followed.error)
                throw followed.error;
            for (const row of followed.data ?? []) {
                if (!names.has(row.id)) companies.push({ ...classifyEmployer(row), followed: true });
                names.set(row.id, row.display_name);
            }
        }
        if (!parsed.data.targetRoles.length) return json(200, {postings:[], nextOffset:null, companies});
        const postings: FeedPosting[] = [];
        // ponytail: scan lightweight catalogue rows server-side; move ranking to a SQL RPC if catalogue latency approaches the function budget.
        // Keep descriptions on demand. Process server-side so the browser only receives a result page.
        for (let offset = 0; ids.length; offset += 500) {
            const result = await db.from('job_postings').select('id,company_id,title,location,apply_url,posted_at,publication_kind,publication_precision,first_seen_at').in('company_id', ids).is('closed_at', null).order('id').range(offset, offset + 499);
            if (result.error)
                throw result.error;
            for (const row of result.data ?? [])
                if (!hidden.has(row.id) && /^https:\/\//i.test(row.apply_url))
                    postings.push({ id: row.id, companyId: row.company_id, companyName: names.get(row.company_id) ?? '', title: row.title, location: row.location, applyUrl: row.apply_url, postedAt: row.posted_at, publicationKind: row.publication_kind, publicationPrecision: row.publication_precision, firstSeenAt: row.first_seen_at });
            if ((result.data?.length ?? 0) < 500)
                break;
        }
        const page = searchPostings(postings, parsed.data, parsed.data);
        const cv = parsed.data.cv;
        if (!cv || !page.postings.length) return json(200, { ...page, companies });
        const history = await db.rpc('read_feed_checks', {
            p_user: user.id, p_postings: page.postings.map(posting => posting.id),
            p_resume: cv.id, p_revision: cv.revision, p_language: cv.language, p_contract: FEED_MATCH_CONTRACT,
        });
        if (history.error) {
            captureError(new Error('Feed check history read failed'), { function: 'job-search' });
            return json(200, { ...page, companies, historyUnavailable: true });
        }
        const checks = Object.fromEntries((history.data ?? []).map((row: { posting_id: string; job_revision: string | null; match: unknown }) =>
            [row.posting_id, row.match ? { status: 'ready', match: row.match, jobRevision: row.job_revision } : { status: 'stale' }]));
        return json(200, { ...page, companies, checks });
    }
    catch {
        captureError(new Error('Job search failed'), { function: 'job-search' });
        return json(503, { status: 503, code: 'search_failed', message: 'Could not search jobs. Try again.' });
    }
};

export const handler = withRateLimit('job-search', baseHandler);
