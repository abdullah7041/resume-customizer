/**
 * Pure job-description extraction from fetched HTML — no network, fully
 * unit-testable. Strategy, in order of reliability:
 *
 *   1. schema.org JSON-LD JobPosting (emitted by LinkedIn guest pages,
 *      Greenhouse, Lever, Indeed, Bayt, GulfTalent and most career sites) —
 *      high confidence.
 *   2. Main-content heuristic (<main>/<article>/[role=main]) for plain career
 *      pages without structured data — low confidence, user must review.
 *
 * Anything else is an honest typed failure (jd_not_found) — og:description
 * alone is truncated and is never imported as if it were the full JD.
 *
 * LinkedIn: only public guest pages are read. Auth walls, checkpoints and
 * anti-bot responses are detected and surfaced as `login_required` — never
 * bypassed.
 */

export interface ExtractedJob {
  jobText: string;
  jobTitle: string | null;
  companyName: string | null;
  source: 'json-ld' | 'heuristic';
  confidence: 'high' | 'low';
}

const MIN_JSONLD_DESCRIPTION_CHARS = 200;
const MIN_HEURISTIC_CHARS = 350;
export const MAX_JOB_TEXT_CHARS = 30000;

const NOISE_ELEMENT_PATTERN = /<(nav|header|footer|aside|form|button|dialog|select|svg|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const NOISE_CLASS_OR_ID_PATTERN = /\b(similar|related|recommend|also[-_]?viewed|footer|sign[-_]?in|login|join[-_]?now|nav|breadcrumb|cookie|banner|share|apply[-_]?button|top[-_]?card[-_]?actions)/i;
const DESCRIPTION_CLASS_OR_ID_PATTERN = /job[-_]?desc|description|show-more-less-html|posting/i;
const STANDALONE_CTA_PATTERN = /^(sign in|join now|apply|easy apply|save|share|report this job|show more|see more jobs|get notified|set alert)$/i;
const TRAILING_BOILERPLATE_PATTERN = /^(similar jobs|people also viewed|recommended for you|explore more)$/i;

const NOISE_CLASS_OR_ID_ELEMENT_PATTERN = new RegExp(
  `<([a-z][\\w:-]*)\\b(?=[^>]*(?:class|id)\\s*=\\s*["'][^"']*(?:${NOISE_CLASS_OR_ID_PATTERN.source})[^"']*["'])[^>]*>[\\s\\S]*?<\\/\\1\\s*>`,
  'gi',
);

const DESCRIPTION_CONTAINER_PATTERN = new RegExp(
  `<(div|section)\\b(?=[^>]*(?:class|id)\\s*=\\s*["'][^"']*(?:${DESCRIPTION_CLASS_OR_ID_PATTERN.source})[^"']*["'])[^>]*>[\\s\\S]*?<\\/\\1\\s*>`,
  'gi',
);

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
  ndash: '–', mdash: '—', hellip: '…', bull: '•',
  middot: '·', copy: '©', reg: '®', trade: '™',
};

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

/** Flatten an HTML fragment to readable plain text (bullets/paragraphs kept). */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(/<\/\s*(p|div|li|tr|h[1-6]|ul|ol|section|article|header|blockquote)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return decodeHtmlEntities(text)
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripNoiseElements(html: string): string {
  let cleaned = html;
  for (let pass = 0; pass < 5; pass += 1) {
    const next = cleaned
      .replace(NOISE_ELEMENT_PATTERN, ' ')
      .replace(NOISE_CLASS_OR_ID_ELEMENT_PATTERN, ' ');
    if (next === cleaned) break;
    cleaned = next;
  }
  return cleaned;
}

function preferDescriptionContainer(region: string): string {
  DESCRIPTION_CONTAINER_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DESCRIPTION_CONTAINER_PATTERN.exec(region)) !== null) {
    if (htmlToText(match[0]).length >= MIN_HEURISTIC_CHARS) return match[0];
  }
  return region;
}

function cleanExtractedJobText(text: string): string {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    const normalized = line.replace(/\s+/g, ' ');
    if (!normalized) {
      if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('');
      continue;
    }
    if (STANDALONE_CTA_PATTERN.test(normalized)) continue;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
  }

  const cleaned = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const halfway = cleaned.length / 2;
  let offset = 0;
  for (const line of cleaned.split('\n')) {
    if (offset >= halfway && TRAILING_BOILERPLATE_PATTERN.test(line.trim())) {
      return cleaned.slice(0, offset).trim();
    }
    offset += line.length + 1;
  }
  return cleaned;
}

function parseJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const scriptPattern = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptPattern.exec(html)) !== null) {
    const raw = match[1]
      .replace(/^\s*<!\[CDATA\[/, '')
      .replace(/\]\]>\s*$/, '')
      .trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Malformed embedded JSON is common in the wild — skip the block.
    }
  }
  return blocks;
}

interface JobPostingNode {
  description?: unknown;
  title?: unknown;
  hiringOrganization?: { name?: unknown } | string;
}

function findJobPosting(node: unknown, depth = 0): JobPostingNode | null {
  if (depth > 6 || node === null || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJobPosting(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const record = node as Record<string, unknown>;
  const type = record['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((value) => typeof value === 'string' && value.toLowerCase() === 'jobposting')) {
    return record as JobPostingNode;
  }
  if (record['@graph']) {
    const found = findJobPosting(record['@graph'], depth + 1);
    if (found) return found;
  }
  return null;
}

const asTrimmedString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

function extractFromJsonLd(html: string): ExtractedJob | null {
  for (const block of parseJsonLdBlocks(html)) {
    const posting = findJobPosting(block);
    if (!posting) continue;

    const descriptionHtml = asTrimmedString(posting.description);
    if (!descriptionHtml) continue;
    const jobText = htmlToText(descriptionHtml);
    if (jobText.length < MIN_JSONLD_DESCRIPTION_CHARS) continue;

    const company = typeof posting.hiringOrganization === 'string'
      ? posting.hiringOrganization
      : asTrimmedString(posting.hiringOrganization?.name);

    return {
      jobText: jobText.slice(0, MAX_JOB_TEXT_CHARS),
      jobTitle: asTrimmedString(posting.title),
      companyName: company ? decodeHtmlEntities(company) : null,
      source: 'json-ld',
      confidence: 'high',
    };
  }
  return null;
}

function pageTitle(html: string): string | null {
  const og = html.match(/<meta[^>]+property\s*=\s*["']og:title["'][^>]+content\s*=\s*["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+property\s*=\s*["']og:title["']/i);
  if (og?.[1]) return decodeHtmlEntities(og[1]).trim() || null;
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title?.[1] ? decodeHtmlEntities(title[1]).replace(/\s+/g, ' ').trim() || null : null;
}

function extractFromMainContent(html: string): ExtractedJob | null {
  const region = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0]
    ?? html.match(/<article\b[\s\S]*?<\/article>/i)?.[0]
    ?? html.match(/<[a-z]+\b[^>]*role\s*=\s*["']main["'][\s\S]*?>[\s\S]*<\/[a-z]+>/i)?.[0]
    ?? null;
  if (!region) return null;

  const cleanedRegion = stripNoiseElements(region);
  const preferredRegion = preferDescriptionContainer(cleanedRegion);
  const jobText = cleanExtractedJobText(htmlToText(preferredRegion));
  if (jobText.length < MIN_HEURISTIC_CHARS || jobText.length > MAX_JOB_TEXT_CHARS * 2) return null;

  return {
    jobText: jobText.slice(0, MAX_JOB_TEXT_CHARS),
    jobTitle: pageTitle(html),
    companyName: null,
    source: 'heuristic',
    confidence: 'low',
  };
}

/** Extract a job description from a fetched page, or null when none is reliable. */
export function extractJobFromHtml(html: string): ExtractedJob | null {
  if (!html || typeof html !== 'string') return null;
  return extractFromJsonLd(html) ?? extractFromMainContent(html);
}

// ---------------------------------------------------------------------------
// LinkedIn specifics
// ---------------------------------------------------------------------------

export interface LinkedInUrlInfo {
  isLinkedIn: boolean;
  /** Canonical public job URL when a job id could be identified. */
  canonicalUrl: string | null;
  jobId: string | null;
}

/**
 * Recognize LinkedIn job URLs and canonicalize them to the public guest page:
 * /jobs/view/<id>/ — also handles collection/search links that carry
 * currentJobId=<id>. No auth bypass: if the guest page is walled, the import
 * reports login_required.
 */
export function normalizeLinkedInUrl(rawUrl: string): LinkedInUrlInfo {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { isLinkedIn: false, canonicalUrl: null, jobId: null };
  }
  const host = url.hostname.toLowerCase();
  const isLinkedIn = host === 'linkedin.com' || host.endsWith('.linkedin.com');
  if (!isLinkedIn) return { isLinkedIn: false, canonicalUrl: null, jobId: null };

  const viewMatch = url.pathname.match(/\/jobs\/view\/(?:[^/]*?-)?(\d+)/i);
  const queryId = url.searchParams.get('currentJobId');
  const jobId = viewMatch?.[1] ?? (queryId && /^\d+$/.test(queryId) ? queryId : null);

  return {
    isLinkedIn: true,
    jobId,
    canonicalUrl: jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : null,
  };
}

/** Detect LinkedIn (and similar) auth walls / anti-bot interstitials. */
export function detectLoginWall(finalUrl: string, statusCode: number, html: string): boolean {
  if (statusCode === 999 || statusCode === 403 || statusCode === 429) return true;
  const lowerUrl = finalUrl.toLowerCase();
  if (/\/(authwall|checkpoint|uas\/login|login|signup)([/?]|$)/.test(lowerUrl)) return true;
  const head = html.slice(0, 4000).toLowerCase();
  return head.includes('authwall') || head.includes('join linkedin to view') || head.includes('sign in to view');
}
