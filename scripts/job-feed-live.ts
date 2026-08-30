/**
 * End-to-end live exercise of the Job Feed backend against the real database.
 *
 * `npm run dev:netlify` OOMs esbuild on this machine, so the crawler is invoked as
 * its actual handler through this harness rather than over HTTP.
 *
 *   npx tsx scripts/job-feed-live.ts
 *   npx tsx scripts/job-feed-live.ts --cleanup   (removes everything it created)
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { resolveCompany } from '../netlify/lib/ats/probe.js';

process.env.JOB_CRAWL_SECRET ||= 'local-harness-secret';

const USER_ID = 'f9ef22d5-c18f-41f2-a2c9-8b05c62eca67';

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const FIXTURES = [
  { source: 'workable', token: 'salla', display_name: 'Salla' },
  { source: 'greenhouse', token: 'hala', display_name: 'HALA' },
  { source: 'pinpoint', token: 'tabby', display_name: 'Tabby' },
  // Deliberately broken: proves a failed fetch closes nothing.
  { source: 'greenhouse', token: 'watheq-not-a-company-9931', display_name: 'Broken Board' },
];

async function cleanup() {
  const tokens = FIXTURES.map((f) => f.token);
  const { data: companies } = await supabase.from('ats_companies').select('id').in('token', tokens);
  const ids = (companies ?? []).map((c: { id: string }) => c.id);
  if (ids.length === 0) return console.log('Nothing to clean up.');

  await supabase.from('user_tracked_companies').delete().in('company_id', ids);
  await supabase.from('job_postings').delete().in('company_id', ids);
  await supabase.from('ats_companies').delete().in('id', ids);
  console.log(`Cleaned up ${ids.length} companies and everything hanging off them.`);
}

async function main() {
  if (process.argv.includes('--cleanup')) return cleanup();

  console.log('=== 1. resolver, live ===');
  for (const query of ['salla', 'tabby', 'definitely-not-a-real-company-9931']) {
    const report = await resolveCompany(query);
    console.log(
      `${query.padEnd(38)} candidates=${report.candidates.map((c) => `${c.source}(${c.jobCount})`).join(',') || 'none'}` +
        ` exhausted=${report.exhausted} unreliable=${report.unreliable.join(',') || 'none'}`,
    );
  }

  console.log('\n=== 2. seed + track ===');
  const companyIds: string[] = [];
  for (const fixture of FIXTURES) {
    const { data, error } = await supabase
      .from('ats_companies')
      .upsert(fixture, { onConflict: 'source,token' })
      .select('id, display_name')
      .single();
    if (error || !data) throw new Error(`upsert failed: ${error?.message}`);

    await supabase
      .from('user_tracked_companies')
      .upsert({ user_id: USER_ID, company_id: data.id }, { onConflict: 'user_id,company_id' });

    companyIds.push(data.id);
    console.log(`tracked ${data.display_name}`);
  }

  console.log('\n=== 3. crawl (the real handler) ===');
  const { handler } = await import('../netlify/functions/crawl-jobs-background.js');
  const response = await handler(
    {
      httpMethod: 'POST',
      headers: { 'x-watheq-crawl-secret': process.env.JOB_CRAWL_SECRET as string },
      body: JSON.stringify({ companyIds }),
    } as never,
    {} as never,
    () => undefined,
  );
  const body = JSON.parse((response as { body: string }).body);
  console.table(body.results);

  console.log('\n=== 4. what landed ===');
  const { data: rows } = await supabase
    .from('job_postings')
    .select('title, location, posted_at, description, apply_url, company_id')
    .in('company_id', companyIds)
    .is('closed_at', null);

  const postings = (rows ?? []) as {
    title: string;
    location: string;
    posted_at: string | null;
    description: string;
    apply_url: string;
  }[];

  console.log(`open postings: ${postings.length}`);
  console.log(`with a description: ${postings.filter((p) => p.description.length > 100).length}`);
  console.log(`with a date: ${postings.filter((p) => p.posted_at).length}`);
  console.log(`Saudi-located: ${postings.filter((p) => /saudi|riyadh|jeddah|makkah|dammam|khobar/i.test(p.location)).length}`);
  console.log(`every apply link on an employer host: ${postings.every((p) => /^https:\/\//.test(p.apply_url))}`);
  for (const posting of postings.slice(0, 3)) {
    console.log(`  - ${posting.title} | ${posting.location}`);
  }

  console.log('\n=== 5. a failed board must close nothing ===');
  const { data: broken } = await supabase
    .from('ats_companies')
    .select('display_name, last_status, last_error, last_job_count, crawl_lease_until')
    .eq('token', 'watheq-not-a-company-9931')
    .single();
  console.log(broken);

  console.log('\n=== 6. the claim RPC ===');
  const { data: claimed, error: claimError } = await supabase.rpc('claim_job_crawl_batch', {
    p_lease_until: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    p_stale_before: new Date(Date.now() + 60 * 1000).toISOString(),
    p_limit: 10,
  });
  console.log(`first claim: ${claimed?.length ?? 0} companies ${claimError?.message ?? ''}`);

  const { data: second } = await supabase.rpc('claim_job_crawl_batch', {
    p_lease_until: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    p_stale_before: new Date(Date.now() + 60 * 1000).toISOString(),
    p_limit: 10,
  });
  console.log(`second claim (leases held, must be 0): ${second?.length ?? 0}`);

  await supabase.from('ats_companies').update({ crawl_lease_until: null }).in('id', companyIds);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
