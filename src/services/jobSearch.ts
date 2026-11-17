import { supabase } from '@/services/supabase';
import { assertPrivateSession, getPrivateSessionRevision } from '@/lib/auth/privateSession';
import type { FeedIntent, FeedPosting } from '@/lib/jobs/types';
export interface CatalogueCompany {
    id: string;
    display_name: string;
    company_category: string;
    sector: string | null;
    last_status: string;
    last_fetched_at: string | null;
    source: string;
    token: string;
    followed: boolean;
}
export interface JobSearchPage {
    postings: FeedPosting[];
    companies: CatalogueCompany[];
    nextOffset: number | null;
}
export async function searchJobs(input: FeedIntent & {
    offset: number;
    followedOnly: boolean;
    maxAgeDays?: number;
}, signal: AbortSignal): Promise<JobSearchPage> {
    const revision = getPrivateSessionRevision();
    const { data } = await supabase.auth.getSession();
    assertPrivateSession(revision, data.session?.user?.id ?? null);
    if (!data.session)
        throw new Error('Sign in to search jobs');
    const response = await fetch('/.netlify/functions/job-search', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify(input), signal });
    const result = await response.json();
    assertPrivateSession(revision, data.session.user.id);
    if (!response.ok)
        throw new Error(result.message ?? 'Could not search jobs');
    return result;
}
