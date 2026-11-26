import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { withRateLimit } from '../lib/rate-limiter.js';
import { getSupabaseClient } from '../lib/supabase-client.js';
import { classifyEmployer, searchPostings } from '../lib/job-search.js';
import { initSentry, captureError } from '../lib/sentry.js';
import type { FeedPosting } from '../../src/lib/jobs/types.js';
import { autofixProbeStatus } from '../lib/autofix-probe.js';
initSentry();
const schema = z.object({ targetRoles: z.array(z.string().trim().min(1).max(120)).max(10), locations: z.array(z.string().max(100)).max(10).optional(), seniority: z.enum(['junior', 'mid', 'senior', 'lead', 'manager']).optional(), followedOnly: z.boolean().default(false), offset: z.number().int().min(0).max(100000).default(0), limit: z.number().int().min(1).max(50).default(20), maxAgeDays: z.number().min(1).max(365).optional() });
const json = (statusCode: number, body: unknown) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const baseHandler: Handler = async (event) => {
    const probe = autofixProbeStatus(event.headers['x-watheq-autofix-probe']);
    if (probe === 'rejected') return json(403, { status: 403, code: 'probe', message: 'Synthetic probe unavailable' });
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
        const parsed = schema.safeParse(input);
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
            const followed = await db.from('ats_companies').select('id,display_name').in('id', trackedIds);
            if (followed.error)
                throw followed.error;
            followed.data?.forEach(row => names.set(row.id, row.display_name));
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
        return json(200, { ...searchPostings(postings, parsed.data, parsed.data), companies });
    }
    catch {
        captureError(new Error('Job search failed'), probe === 'authorized' ? { synthetic: true } : { function: 'job-search' });
        return json(503, { status: 503, code: 'search_failed', message: 'Could not search jobs. Try again.' });
    }
};

export const handler = withRateLimit('job-search', baseHandler);
