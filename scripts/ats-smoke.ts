// Live smoke test for the ATS readers. Hits the real public board APIs — no keys.
// Run: npx tsx scripts/ats-smoke.ts
import { fetchCompany } from '../netlify/lib/ats/index.js';
import { CONTROL_TOKEN } from '../netlify/lib/ats/probe.js';
import { NAME_PROBEABLE } from '../netlify/lib/ats/index.js';
import type { CompanyRef } from '../netlify/lib/ats/types.js';

const TARGETS: CompanyRef[] = [
  { source: 'greenhouse', token: 'hala', name: 'HALA' },
  { source: 'greenhouse', token: 'tamara', name: 'Tamara (EU board, global API host)' },
  { source: 'ashby', token: 'LeanTech', name: 'Lean Technologies' },
  { source: 'workable', token: 'salla', name: 'Salla' },
  { source: 'pinpoint', token: 'tabby', name: 'Tabby' },
  { source: 'workday', token: 'nvidia:wd5:NVIDIAExternalCareerSite', name: 'NVIDIA (Workday)' },
];

async function main() {
  console.log('=== control probe: every provider must MISS a nonsense token ===');
  for (const provider of NAME_PROBEABLE) {
    const result = await provider.probe(CONTROL_TOKEN);
    console.log(`${provider.source.padEnd(12)} ${result.found ? 'ANSWERED -> UNRELIABLE' : 'miss (good)'}`);
  }

  console.log('\n=== live board reads ===');
  for (const ref of TARGETS) {
    const outcome = await fetchCompany(ref);
    const withDesc = outcome.postings.filter((p) => p.description.length > 100).length;
    const withDate = outcome.postings.filter((p) => p.postedAt).length;
    console.log(
      `${(ref.name ?? ref.token).padEnd(34)} ok=${String(outcome.ok).padEnd(5)} ` +
        `jobs=${String(outcome.postings.length).padEnd(4)} jd=${String(withDesc).padEnd(4)} ` +
        `dated=${String(withDate).padEnd(4)} ${outcome.error ?? ''}`,
    );
    const sample = outcome.postings[0];
    if (sample) {
      console.log(`   e.g. ${sample.title} | ${sample.location} | ${sample.applyUrl.slice(0, 70)}`);
    }
  }

  console.log('\n=== failure must not look like an empty board ===');
  const bad = await fetchCompany({ source: 'greenhouse', token: 'watheq-nope-9931' });
  console.log(`bad token -> ok=${bad.ok} postings=${bad.postings.length} error=${bad.error}`);
  const badToken = await fetchCompany({ source: 'pinpoint', token: 'has spaces/../etc' });
  console.log(`unsafe token -> ok=${badToken.ok} error=${badToken.error}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
