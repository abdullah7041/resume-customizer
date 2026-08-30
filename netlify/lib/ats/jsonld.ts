// Tier 2: the company's own careers site.
//
// For employers with no public board API — stc on SuccessFactors, NEOM's SPA,
// Aramco — the only readable, allowed source is the `JobPosting` structured data
// the site already publishes for search engines. This is one generic reader, not
// per-company code, and it works only where a site actually publishes that data:
// resolution records whether it did, and never promises it in advance.
//
// Closure is NOT trusted from this source. An API returning an empty array means
// the board is empty; a careers page returning no JSON-LD usually means a layout
// change, a bot wall, or a rendering path we did not follow. Treating that as
// "every role closed" would wipe a company's feed on a template tweak, so
// `closureSignal` is 'untrusted' and the crawler skips reconciliation.

import { safeFetch, SafeFetchError, assertPublicHttpUrl } from '../safe-fetch.js';
import { boundDescription, stripHtml } from './http.js';
import type { AtsProvider, CompanyRef, FetchOutcome, ProbeResult, RawPosting } from './types.js';

/** Bounded follow-through when the listing page itself carries no JobPosting data. */
const MAX_FOLLOWED_LINKS = 20;
const FOLLOW_CONCURRENCY = 4;
const PAGE_TIMEOUT_MS = 10000;
const PAGE_MAX_BYTES = 2 * 1024 * 1024;

const LD_SCRIPT = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const HREF = /<a[^>]+href=["']([^"'#]+)["']/gi;
const POSTING_PATH = /(\/job|\/jobs\/|\/career|\/vacan|\/position|\/opening|\/requisition)/i;

interface JsonLdNode {
  '@type'?: string | string[];
  '@graph'?: unknown;
  itemListElement?: unknown;
  item?: unknown;
  title?: string;
  url?: string;
  identifier?: unknown;
  datePosted?: string;
  description?: string;
  jobLocation?: unknown;
  hiringOrganization?: unknown;
}

function typesOf(node: JsonLdNode): string[] {
  const raw = node['@type'];
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]).map((value) => String(value).toLowerCase());
}

/** Walk any JSON-LD payload and collect every JobPosting, however it is nested. */
function collectJobPostings(value: unknown, found: JsonLdNode[] = [], depth = 0): JsonLdNode[] {
  if (depth > 6 || value === null || typeof value !== 'object') return found;

  if (Array.isArray(value)) {
    for (const entry of value) collectJobPostings(entry, found, depth + 1);
    return found;
  }

  const node = value as JsonLdNode;
  if (typesOf(node).includes('jobposting')) {
    found.push(node);
    return found;
  }

  // ItemList wrappers and @graph containers are both common on listing pages.
  for (const key of ['@graph', 'itemListElement', 'item'] as const) {
    if (node[key] !== undefined) collectJobPostings(node[key], found, depth + 1);
  }
  return found;
}

function extractStructuredData(html: string): JsonLdNode[] {
  const postings: JsonLdNode[] = [];
  LD_SCRIPT.lastIndex = 0;

  let match = LD_SCRIPT.exec(html);
  while (match !== null) {
    try {
      collectJobPostings(JSON.parse(match[1].trim()), postings);
    } catch {
      // A malformed block on the page is not a reason to abandon the others.
    }
    match = LD_SCRIPT.exec(html);
  }
  return postings;
}

function readLocation(jobLocation: unknown): string {
  const entries = Array.isArray(jobLocation) ? jobLocation : [jobLocation];
  const parts: string[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const address = (entry as { address?: unknown }).address;
    if (!address || typeof address !== 'object') continue;

    const a = address as { addressLocality?: string; addressRegion?: string; addressCountry?: unknown };
    const country =
      typeof a.addressCountry === 'string'
        ? a.addressCountry
        : (a.addressCountry as { name?: string } | undefined)?.name;

    for (const part of [a.addressLocality, a.addressRegion, country]) {
      if (part && !parts.includes(part)) parts.push(part);
    }
  }
  return parts.join(', ');
}

function readIdentifier(node: JsonLdNode): string {
  const { identifier } = node;
  if (typeof identifier === 'string') return identifier;
  if (identifier && typeof identifier === 'object') {
    const value = (identifier as { value?: unknown }).value;
    if (typeof value === 'string' || typeof value === 'number') return String(value);
  }
  return node.url ?? node.title ?? '';
}

function toPosting(node: JsonLdNode, pageUrl: string): RawPosting | null {
  const title = (node.title ?? '').trim();
  if (!title) return null;

  const applyUrl = node.url ?? pageUrl;
  const externalId = readIdentifier(node) || applyUrl;
  const posted = node.datePosted ? new Date(node.datePosted) : null;

  return {
    externalId: String(externalId).slice(0, 300),
    title,
    location: readLocation(node.jobLocation),
    applyUrl,
    postedAt: posted && !Number.isNaN(posted.getTime()) ? posted.toISOString() : null,
    description: boundDescription(stripHtml(node.description ?? '')),
  };
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const result = await safeFetch(url, { timeoutMs: PAGE_TIMEOUT_MS, maxBytes: PAGE_MAX_BYTES });
    return result.status === 200 ? result.body : null;
  } catch (error) {
    if (error instanceof SafeFetchError) return null;
    return null;
  }
}

/** Same-origin links that look like individual postings, deduplicated and capped. */
function candidateLinks(html: string, pageUrl: string): string[] {
  const base = new URL(pageUrl);
  const seen = new Set<string>();
  const links: string[] = [];

  HREF.lastIndex = 0;
  let match = HREF.exec(html);
  while (match !== null && links.length < MAX_FOLLOWED_LINKS) {
    try {
      const resolved = new URL(match[1], base);
      if (
        resolved.origin === base.origin &&
        POSTING_PATH.test(resolved.pathname) &&
        resolved.href !== base.href &&
        !seen.has(resolved.href)
      ) {
        seen.add(resolved.href);
        links.push(resolved.href);
      }
    } catch {
      // Not a usable URL; skip it.
    }
    match = HREF.exec(html);
  }
  return links;
}

export const jsonld: AtsProvider = {
  source: 'jsonld',

  // Closure is never inferred from this source — see the note at the top.
  closureSignal: 'untrusted',

  isValidToken(token: string): boolean {
    try {
      assertPublicHttpUrl(token);
      return true;
    } catch {
      return false;
    }
  },

  async fetchPostings(ref: CompanyRef): Promise<FetchOutcome> {
    if (!jsonld.isValidToken(ref.token)) {
      return { ok: false, status: null, postings: [], error: 'invalid careers URL' };
    }

    const html = await fetchPage(ref.token);
    if (html === null) {
      return { ok: false, status: null, postings: [], error: 'careers page unreachable' };
    }

    const postings: RawPosting[] = [];
    const seenIds = new Set<string>();

    const push = (node: JsonLdNode, pageUrl: string) => {
      const posting = toPosting(node, pageUrl);
      if (posting && !seenIds.has(posting.externalId)) {
        seenIds.add(posting.externalId);
        postings.push(posting);
      }
    };

    for (const node of extractStructuredData(html)) push(node, ref.token);

    // Most sites publish JobPosting on the posting page, not the index, so follow a
    // bounded set of same-origin links when the listing itself carried nothing.
    if (postings.length === 0) {
      const links = candidateLinks(html, ref.token);
      for (let index = 0; index < links.length; index += FOLLOW_CONCURRENCY) {
        const batch = links.slice(index, index + FOLLOW_CONCURRENCY);
        const pages = await Promise.all(batch.map((link) => fetchPage(link)));
        pages.forEach((page, offset) => {
          if (!page) return;
          for (const node of extractStructuredData(page)) push(node, batch[offset]);
        });
      }
    }

    if (postings.length === 0) {
      // Reached the site and found nothing readable. Reported as unsuccessful on
      // purpose: it is a "we cannot read this" and must never be mistaken for
      // "this employer has no open roles".
      return { ok: false, status: 200, postings: [], error: 'no JobPosting data published' };
    }

    return { ok: true, status: 200, postings };
  },

  async probe(token: string): Promise<ProbeResult> {
    const outcome = await jsonld.fetchPostings({ source: 'jsonld', token });
    return { found: outcome.ok, count: outcome.postings.length };
  },
};
