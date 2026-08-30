// Live probe for the Tier 2 (JobPosting structured data) reader.
// Run: npx tsx scripts/jsonld-smoke.ts
import { jsonld } from '../netlify/lib/ats/jsonld.js';

const TARGETS = [
  'https://job-boards.greenhouse.io/hala',
  'https://www.stc.com.sa/content/stc/sa/en/personal/careers.html',
  'https://careers.neom.com',
  'https://www.aramco.com/en/careers',
  'https://jobs.ashbyhq.com/LeanTech',
];

async function main() {
  for (const url of TARGETS) {
    const started = Date.now();
    const outcome = await jsonld.fetchPostings({ source: 'jsonld', token: url });
    const ms = Date.now() - started;
    console.log(
      `${url.padEnd(62)} ok=${String(outcome.ok).padEnd(5)} jobs=${String(outcome.postings.length).padEnd(4)} ${ms}ms ${outcome.error ?? ''}`,
    );
    const sample = outcome.postings[0];
    if (sample) {
      console.log(`   e.g. ${sample.title} | ${sample.location || '(no location)'} | jd=${sample.description.length}c`);
    }
  }

  console.log('\n--- token guard ---');
  for (const bad of ['http://localhost:3000/jobs', 'http://169.254.169.254/latest', 'not-a-url', 'file:///etc/passwd']) {
    console.log(`${bad.padEnd(40)} valid=${jsonld.isValidToken(bad)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
