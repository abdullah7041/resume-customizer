import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { checkBrowserHandoff } from './live-browser.mjs';

const shaPattern = /^[0-9a-f]{40}$/;
const branchPattern = /^codex\/autofix-([0-9]{1,20})-([0-9a-f]{40})-([A-Za-z0-9_-]{1,80})$/;
const requestTimeout = 35_000;
const candidateSignals = JSON.parse(await readFile(new URL('../../src/types/autofix-signals.json', import.meta.url), 'utf8'));

export function incidentFromMerge(event, repository, merger) {
  const pr = event.pull_request;
  const branch = pr?.head?.ref?.match(branchPattern);
  if (event.action !== 'closed' || pr?.merged !== true || pr.base?.ref !== 'main' ||
      pr.base.repo?.full_name !== repository || pr.head?.repo?.full_name !== repository ||
      event.sender?.type !== 'User' || merger?.type !== 'User' || merger.login !== event.sender.login ||
      !branch || !shaPattern.test(pr.merge_commit_sha) || !Number.isSafeInteger(pr.number)) return null;
  const [, issue, release, signal] = branch;
  if (![...candidateSignals.functions, ...candidateSignals.outcomes, ...candidateSignals.browser, 'browser_error'].includes(signal)) return null;
  return { issue, release, signal, merge: pr.merge_commit_sha, pr: pr.number };
}

function httpsOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.origin === value) return url.origin;
  } catch { /* Invalid configuration. */ }
  return null;
}

function request(fetcher, url, options = {}, timeout = requestTimeout) {
  return fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(timeout) });
}

async function deployedCommit(origin, fetcher) {
  try {
    const result = await request(fetcher, origin + '/autofix-release.json?probe=' + randomUUID(),
      { headers: { 'Cache-Control': 'no-cache' } }, 8_000);
    if (result.ok) {
      const { commit } = await result.json();
      if (shaPattern.test(commit)) return commit;
    }
  } catch { /* Temporary deploy, network, or release-marker failure. */ }
  return null;
}

const english = 'Watheq Example';
const arabic = 'مهندسة برمجيات';

export async function inspectPdf(bytes) {
  if (bytes.length < 10 || Buffer.from(bytes.subarray(0, 5)).toString() !== '%PDF-') return 'missing PDF signature';
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true });
  try {
    const pdf = await document.promise;
    if (pdf.numPages !== 1) return 'unexpected PDF page count';
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str || '').join(' ').replace(/\s+/g, ' ');
    if (!text.includes(english) || !text.includes(arabic)) return 'selectable English or Arabic fixture text missing in PDF.js';
    return null;
  } catch {
    return 'PDF.js could not read the response';
  } finally {
    await document.destroy();
  }
}

async function checkPdf(origin, fetcher, headers, readPdf) {
  const common = { filename: 'Synthetic-Watheq', templateId: 'modern-professional' };
  const styled = {
    format: 'styled',
    blocks: [arabic, english].map(text => ({ kind: 'body', runs: [{ text }] })),
    presentation: ['rtl', 'ltr'].map(direction => ({
      direction, align: direction === 'rtl' ? 'right' : 'left',
      fontSize: 11, lineHeight: 16.5, color: '#123456', bold: false, italic: false, spacingAfter: 6,
    })),
  };
  const html = {
    html: '<main lang="ar" dir="rtl"><h1>' + arabic + '</h1><p lang="en" dir="ltr">' + english + '</p></main>',
    styles: 'body { font-family: Arial, sans-serif; }',
    direction: 'rtl',
  };
  const observations = [];
  let passed = true;
  for (const [label, input] of [['Styled', styled], ['HTML', html]]) {
    const response = await request(fetcher, origin + '/.netlify/functions/generate-pdf', {
      method: 'POST', headers, body: JSON.stringify({ ...common, ...input }),
    });
    if (!response.ok) {
      observations.push(label + ' PDF generation returned HTTP ' + response.status + '.');
      passed = false;
      continue;
    }
    const problem = response.headers.get('content-type')?.startsWith('application/pdf')
      ? await readPdf(new Uint8Array(await response.arrayBuffer()))
      : 'an unexpected content type';
    if (problem) {
      observations.push(label + ' PDF generation returned HTTP 200 with ' + problem + '.');
      passed = false;
    } else {
      observations.push(label + ' PDF generation returned HTTP 200 and PDF.js extracted both fixture phrases from one page.');
    }
  }
  return { passed, observation: observations.join(' ') };
}

function isPublicKey(key) {
  if (key?.startsWith('sb_publishable_')) return true;
  try {
    return JSON.parse(Buffer.from(key?.split('.')[1] ?? '', 'base64url').toString()).role === 'anon';
  } catch {
    return false;
  }
}

async function syntheticSession(fetcher, env) {
  const supabase = httpsOrigin(env.AUTOFIX_SYNTHETIC_SUPABASE_ORIGIN);
  const key = env.AUTOFIX_SYNTHETIC_SUPABASE_PUBLIC_KEY;
  const email = env.AUTOFIX_SYNTHETIC_EMAIL;
  const password = env.AUTOFIX_SYNTHETIC_PASSWORD;
  if (!supabase || !isPublicKey(key) || !email || !password) {
    return { passed: false, observation: 'Read-only job search requires a dedicated synthetic account and a Supabase public key.' };
  }
  const login = await request(fetcher, supabase + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!login.ok) return { passed: false, observation: 'Synthetic sign-in returned HTTP ' + login.status + '.' };
  const session = await login.json();
  if (typeof session.access_token !== 'string' || !session.access_token) return { passed: false, observation: 'Synthetic sign-in returned no session.' };
  return { supabase, session };
}

async function checkJobSearch(origin, fetcher, headers, env) {
  const credentials = await syntheticSession(fetcher, env);
  if (!credentials.session) return credentials;
  const response = await request(fetcher, origin + '/.netlify/functions/job-search', {
    method: 'POST', headers: { ...headers, Authorization: 'Bearer ' + credentials.session.access_token },
    body: JSON.stringify({ targetRoles: ['Software Engineer'], limit: 1 }),
  });
  if (!response.ok) return { passed: false, observation: 'Read-only synthetic job search returned HTTP ' + response.status + '.' };
  const { postings, companies, nextOffset } = await response.json();
  if (!Array.isArray(postings) || postings.length > 1 || !Array.isArray(companies) ||
      nextOffset !== null && !Number.isInteger(nextOffset)) {
    return { passed: false, observation: 'Read-only synthetic job search returned an invalid catalogue response.' };
  }
  return { passed: true, observation: 'Read-only synthetic job search returned HTTP 200 with ' +
    postings.length + ' posting(s) and ' + companies.length + ' catalogue companies.' };
}

export async function verifyProduction(incident, env, {
  fetcher = fetch, pause = sleep, attempts = 32, readPdf = inspectPdf, browserHandoff = checkBrowserHandoff,
} = {}) {
  const origin = httpsOrigin(env.AUTOFIX_PRODUCTION_ORIGIN);
  if (!origin) return 'Verification pending. The production HTTPS origin is missing or invalid.';
  let observed = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    observed = await deployedCommit(origin, fetcher);
    if (observed === incident.merge) break;
    if (attempt + 1 < attempts) await pause(15_000);
  }
  if (observed !== incident.merge) {
    return 'Verification pending. The production release marker did not match the merged commit within the wait window. Last valid observation ' +
      (observed ?? 'unavailable') + '.';
  }
  const signal = incident.signal;
  const pdf = signal === 'generate-pdf' || signal.startsWith('pdf_');
  const jobSearch = signal === 'job-search' || signal === 'feed_load_failed';
  const handoff = signal === 'job_handoff_missing' || signal === 'job_handoff_mismatch';
  if (!pdf && !jobSearch && !handoff) {
    return 'Verification pending. Production served the merged release marker. The affected journey requires a separate safe production check.';
  }
  const token = env.AUTOFIX_PROBE_TOKEN;
  if (!handoff && !/^[a-zA-Z0-9_-]{32,128}$/.test(token ?? '')) {
    return 'Verification pending. Production served the merged release marker. The synthetic probe credential is unavailable.';
  }
  const headers = { 'Content-Type': 'application/json', 'x-watheq-autofix-probe': token };
  let result;
  try {
    if (handoff) {
      const supabase = httpsOrigin(env.AUTOFIX_SYNTHETIC_SUPABASE_ORIGIN);
      result = supabase ? await browserHandoff(origin, supabase)
        : { passed: false, observation: 'The public Supabase origin for the isolated browser fixture is missing.' };
    } else {
      result = pdf ? await checkPdf(origin, fetcher, headers, readPdf) : await checkJobSearch(origin, fetcher, headers, env);
    }
  } catch {
    result = { passed: false, observation: 'The synthetic request or response inspection did not complete.' };
  }
  const after = await deployedCommit(origin, fetcher);
  if (after !== incident.merge) {
    return 'Verification pending. The release marker changed or became unavailable during the probe. ' + result.observation;
  }
  if (!result.passed) return 'Verification pending. ' + result.observation + ' The merged release marker matched before and after.';
  if (handoff) {
    return 'Partial verification. ' + result.observation +
      ' The merged release marker matched before and after. Other posting conditions and cached match handoff remain pending.';
  }
  if (signal !== 'generate-pdf' && signal !== 'job-search') {
    return 'Partial verification. ' + result.observation + ' The merged release marker matched before and after. The affected browser journey remains pending.';
  }
  return 'Verified synthetic endpoint check. ' + result.observation + ' The merged release marker matched before and after.';
}

async function main() {
  const env = process.env;
  const event = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, 'utf8'));
  const number = event.pull_request?.number;
  if (!Number.isSafeInteger(number) || !/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY ?? '')) return;
  const response = await request(fetch, 'https://api.github.com/repos/' + env.GITHUB_REPOSITORY + '/pulls/' + number, {
    headers: { Authorization: 'Bearer ' + env.GH_TOKEN, Accept: 'application/vnd.github+json' },
  }, 8_000);
  if (!response.ok) throw new Error('Could not confirm the merge actor from GitHub.');
  const confirmed = await response.json();
  const incident = incidentFromMerge(event, env.GITHUB_REPOSITORY, confirmed.merged_by);
  if (!incident || confirmed.merge_commit_sha !== incident.merge) return;
  const result = await verifyProduction(incident, env);
  const message = 'Watheq production verification for incident #' + incident.issue + ', PR #' + incident.pr +
    '\nSignal ' + incident.signal + '\nMerged commit ' + incident.merge + '\n' + result;
  await writeFile(env.AUTOFIX_LIVE_REPORT, message + '\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
