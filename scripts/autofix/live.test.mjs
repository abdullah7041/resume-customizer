import assert from 'node:assert/strict';
import { test } from 'node:test';
import { incidentFromMerge, inspectPdf, verifyProduction } from './live.mjs';

const merge = 'b'.repeat(40);
const release = 'a'.repeat(40);
const origin = 'https://watheq.example';
const env = {
  AUTOFIX_PRODUCTION_ORIGIN: origin,
  AUTOFIX_PROBE_TOKEN: 'synthetic-secret-valid-for-testing-only',
};
const human = { type: 'User', login: 'human' };
const repo = { full_name: 'owner/watheq' };
const branch = 'codex/autofix-12-' + release + '-generate-pdf';
const event = {
  action: 'closed', sender: human,
  pull_request: {
    number: 13, merged: true, merge_commit_sha: merge,
    base: { ref: 'main', repo }, head: { ref: branch, repo },
  },
};
const incident = { issue: '12', release, signal: 'generate-pdf', merge, pr: 13 };

test('identifies same-repository incident merges attributed to the human actor', () => {
  assert.deepEqual(incidentFromMerge(event, repo.full_name, human), incident);
  assert.equal(incidentFromMerge(event, repo.full_name, { type: 'Bot', login: 'human' }), null);
  assert.equal(incidentFromMerge(event, repo.full_name, { type: 'User', login: 'other' }), null);
  const fork = structuredClone(event);
  fork.pull_request.head.repo.full_name = 'fork/watheq';
  assert.equal(incidentFromMerge(fork, repo.full_name, human), null);
  const unknown = structuredClone(event);
  unknown.pull_request.head.ref = branch + '-unrecognized';
  assert.equal(incidentFromMerge(unknown, repo.full_name, human), null);
});

test('waits for the exact release and executes both PDF function paths once', async () => {
  const seen = [];
  let markers = 0;
  const report = await verifyProduction(incident, env, {
    pause: async () => {}, attempts: 2,
    readPdf: async () => null,
    fetcher: async (url, options) => {
      assert.equal(options.redirect, 'error');
      if (url.startsWith(origin + '/autofix-release.json?')) {
        markers++;
        assert.equal(options.headers['x-watheq-autofix-probe'], undefined);
        return Response.json({ commit: markers === 1 ? release : merge });
      }
      assert.equal(url, origin + '/.netlify/functions/generate-pdf');
      assert.equal(options.headers['x-watheq-autofix-probe'], env.AUTOFIX_PROBE_TOKEN);
      const document = JSON.parse(options.body);
      assert.match(options.body, /مهندسة برمجيات/);
      assert.match(options.body, /Watheq Example/);
      seen.push(document.format ?? 'html');
      return new Response('%PDF-fixture', { headers: { 'content-type': 'application/pdf' } });
    },
  });
  assert.equal(markers, 3);
  assert.deepEqual(seen, ['styled', 'html']);
  assert.match(report, /^Verified synthetic endpoint check/);
});

test('refuses pre-deployment probes and leaves browser outcomes pending', async () => {
  let marker = release;
  const fetcher = async url => {
    if (url.startsWith(origin + '/autofix-release.json?')) return Response.json({ commit: marker });
    assert.equal(marker, merge);
    return new Response('%PDF-fixture', { headers: { 'content-type': 'application/pdf' } });
  };
  assert.match(await verifyProduction(incident, env, { fetcher, attempts: 1 }), /^Verification pending/);
  marker = merge;
  assert.match(await verifyProduction({ ...incident, signal: 'pdf_text_mismatch' }, env, {
    fetcher, readPdf: async () => null,
  }), /^Partial verification.*browser journey remains pending/);
});

test('reports a release change and a PDF endpoint response without promoting either to verified', async () => {
  let markers = 0;
  const report = await verifyProduction(incident, env, {
    fetcher: async url => url.startsWith(origin + '/autofix-release.json?')
      ? Response.json({ commit: ++markers === 1 ? merge : release })
      : new Response(null, { status: 503 }),
  });
  assert.match(report, /^Verification pending.*release marker changed.*HTTP 503/);
  assert.equal(await inspectPdf(new Uint8Array(15)), 'missing PDF signature');
});

test('requires a public key and uses only the dedicated account and read-only job-search request', async () => {
  const supabase = 'https://synthetic.supabase.example';
  const credentials = {
    ...env,
    AUTOFIX_SYNTHETIC_SUPABASE_ORIGIN: supabase,
    AUTOFIX_SYNTHETIC_SUPABASE_PUBLIC_KEY: 'sb_publishable_synthetic',
    AUTOFIX_SYNTHETIC_EMAIL: 'probe@example.com',
    AUTOFIX_SYNTHETIC_PASSWORD: 'synthetic-password',
  };
  const requests = [];
  const fetcher = async (url, options) => {
    if (url.startsWith(origin + '/autofix-release.json?')) return Response.json({ commit: merge });
    requests.push(url);
    if (url === supabase + '/auth/v1/token?grant_type=password') {
      assert.equal(options.headers['x-watheq-autofix-probe'], undefined);
      return Response.json({ access_token: 'fixture-token' });
    }
    assert.equal(url, origin + '/.netlify/functions/job-search');
    assert.equal(options.headers.Authorization, 'Bearer fixture-token');
    assert.equal(options.headers['x-watheq-autofix-probe'], env.AUTOFIX_PROBE_TOKEN);
    assert.deepEqual(JSON.parse(options.body), { targetRoles: ['Software Engineer'], limit: 1 });
    return Response.json({ postings: [], companies: [{}], nextOffset: null });
  };
  const job = { ...incident, signal: 'job-search' };
  assert.match(await verifyProduction(job, { ...credentials, AUTOFIX_SYNTHETIC_SUPABASE_PUBLIC_KEY: 'sb_secret_fixture' },
    { fetcher }), /^Verification pending.*public key/);
  assert.deepEqual(requests, []);
  const report = await verifyProduction(job, credentials, { fetcher });
  assert.match(report, /^Verified synthetic endpoint check.*0 posting\(s\) and 1 catalogue companies/);
  assert.equal(requests.length, 2);
});
