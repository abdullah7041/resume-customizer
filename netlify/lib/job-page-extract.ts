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
// Bound regex work on attacker-influenced HTML: the role=main heuristic has
// sequential greedy quantifiers, while safeFetch allows bodies up to 2 MB.
const MAX_HTML_SCAN_CHARS = 400_000;

const PAIRED_NOISE_TAGS = new Set([
  'nav', 'header', 'footer', 'aside', 'form', 'button', 'dialog', 'select', 'svg', 'iframe',
]);
// Bare "ad" is deliberately NOT matched — job boards class the posting itself
// "job-ad"/"jobad"; only explicit ad compounds are treated as noise.
const NOISE_CLASS_OR_ID_PATTERN = /\b(similar|related|recommend|also[-_]?viewed|footer|sign[-_]?in|login|join[-_]?now|nav|breadcrumb|cookie|consent|gdpr|banner|share|apply[-_]?button|top[-_]?card[-_]?actions|sidebar|widget|promo|advert|adsense|ad[-_]?slot|ad[-_]?banner|sponsor|subscribe|newsletter|social|follow[-_]?us|job[-_]?alert|modal|popup|overlay|pagination|comments|toolbar|menu)/i;
const DESCRIPTION_CLASS_OR_ID_PATTERN = /job[-_]?desc|description|show-more-less-html|posting/i;
const STANDALONE_CTA_PATTERN = /^(sign in|sign up|join now|apply|apply now|easy apply|save|save job|share|share this job|email this job|print|report this job|show more|see more jobs|view all jobs|get notified|set alert|create (job )?alert|back to (results|search)|accept (all )?cookies|cookie settings|subscribe|see who you know|قدم الآن|تقديم|حفظ الوظيفة|مشاركة|سجل الدخول|انضم الآن|اشترك)$/i;
const TRAILING_BOILERPLATE_PATTERN = /^(similar jobs|people also viewed|recommended for you|explore more|more jobs( like this)?|related jobs|jobs you may like|share this job|get job alerts|see who you know|وظائف مشابهة|وظائف ذات صلة|وظائف قد تعجبك|شارك هذه الوظيفة|تنبيهات الوظائف)$/i;
// Footer CTAs whose remainder varies (company name, referral multiplier, job
// category) — prefix-matched rather than folded into the exact-line patterns
// above. Once one of these lines appears, everything from it onward is the
// LinkedIn "grow your network" footer, not job content.
const TRAILING_BOILERPLATE_PREFIX_PATTERN = /^(referrals increase your chances of interviewing at|get notified about new)\b/i;
const HTML_TAG_PATTERN = /<\/?([a-z][\w:-]*)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi;
const HTML_ATTRIBUTE_PATTERN = /(?:^|\s)([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

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

function parseOpeningTagAttributes(openingTag: string): Map<string, string> {
  const tagName = openingTag.match(/^<([a-z][\w:-]*)\b/i)?.[0];
  if (!tagName) return new Map();

  const closingLength = /\/\s*>$/.test(openingTag) ? 2 : 1;
  const attributeSource = openingTag.slice(tagName.length, -closingLength);
  const attributes = new Map<string, string>();
  HTML_ATTRIBUTE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = HTML_ATTRIBUTE_PATTERN.exec(attributeSource)) !== null) {
    attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

function tagHasMatchingClassOrId(openingTag: string, pattern: RegExp): boolean {
  const attributes = parseOpeningTagAttributes(openingTag);
  const className = attributes.get('class');
  const id = attributes.get('id');
  return (className !== undefined && pattern.test(className))
    || (id !== undefined && pattern.test(id));
}

function createTagScanner(): RegExp {
  return new RegExp(HTML_TAG_PATTERN.source, HTML_TAG_PATTERN.flags);
}

function isClosingTag(tag: string): boolean {
  return /^<\//.test(tag);
}

function isSelfClosingTag(tag: string): boolean {
  return /\/\s*>$/.test(tag);
}

function findBalancedElementEnd(
  html: string,
  openingMatch: RegExpExecArray,
): number | null {
  const openingTag = openingMatch[0];
  if (isSelfClosingTag(openingTag)) return openingMatch.index + openingTag.length;

  const tagName = openingMatch[1].toLowerCase();
  const scanner = createTagScanner();
  scanner.lastIndex = openingMatch.index + openingTag.length;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = scanner.exec(html)) !== null) {
    if (match[1].toLowerCase() !== tagName) continue;
    if (isClosingTag(match[0])) {
      depth -= 1;
      if (depth === 0) return scanner.lastIndex;
    } else if (!isSelfClosingTag(match[0])) {
      depth += 1;
    }
  }
  return null;
}

function removeMatchingElementBlocks(
  html: string,
  matchesOpeningTag: (tagName: string, openingTag: string) => boolean,
): string {
  const scanner = createTagScanner();
  let cursor = 0;
  let output = '';
  let changed = false;
  let match: RegExpExecArray | null;

  while ((match = scanner.exec(html)) !== null) {
    if (isClosingTag(match[0]) || !matchesOpeningTag(match[1].toLowerCase(), match[0])) continue;
    const end = findBalancedElementEnd(html, match);
    if (end === null) continue;

    output += `${html.slice(cursor, match.index)} `;
    cursor = end;
    scanner.lastIndex = end;
    changed = true;
  }

  return changed ? output + html.slice(cursor) : html;
}

function stripNoiseElements(html: string): string {
  let cleaned = html;
  for (let pass = 0; pass < 5; pass += 1) {
    const withoutNoiseTags = removeMatchingElementBlocks(
      cleaned,
      (tagName) => PAIRED_NOISE_TAGS.has(tagName),
    );
    const next = removeMatchingElementBlocks(
      withoutNoiseTags,
      (_tagName, openingTag) => tagHasMatchingClassOrId(openingTag, NOISE_CLASS_OR_ID_PATTERN),
    );
    if (next === cleaned) break;
    cleaned = next;
  }
  return cleaned;
}

function preferDescriptionContainer(region: string): string {
  const scanner = createTagScanner();
  let match: RegExpExecArray | null;
  while ((match = scanner.exec(region)) !== null) {
    const tagName = match[1].toLowerCase();
    if (
      isClosingTag(match[0])
      || (tagName !== 'div' && tagName !== 'section')
      || !tagHasMatchingClassOrId(match[0], DESCRIPTION_CLASS_OR_ID_PATTERN)
    ) {
      continue;
    }

    const end = findBalancedElementEnd(region, match);
    if (end === null) continue;
    const candidate = region.slice(match.index, end);
    if (htmlToText(candidate).length >= MIN_HEURISTIC_CHARS) return candidate;
  }
  return region;
}

/**
 * Readability-lite content score for an HTML block. Link-heavy blocks (nav,
 * "similar jobs" rails, footers) score low even when their class names match
 * no noise pattern. The squared content ratio makes a region that wraps both
 * the JD and a link-heavy sibling score BELOW the clean JD child alone, so
 * `selectBestContentBlock` can descend past unlabelled chrome.
 */
function scoreBlock(html: string): number {
  const text = htmlToText(html);
  if (text.length < MIN_HEURISTIC_CHARS) return 0;
  let linkChars = 0;
  for (const anchor of html.match(/<a\b[\s\S]*?<\/a>/gi) ?? []) {
    linkChars += htmlToText(anchor).length;
  }
  const contentChars = Math.max(0, text.length - linkChars);
  const bulletBonus = Math.min(500, (html.match(/<li\b/gi)?.length ?? 0) * 20);
  return (contentChars * contentChars) / text.length + bulletBonus;
}

/** Direct child elements of a region whose first tag is the region's root. */
function directChildElements(region: string): string[] {
  const scanner = createTagScanner();
  const rootMatch = scanner.exec(region);
  if (!rootMatch || isClosingTag(rootMatch[0]) || isSelfClosingTag(rootMatch[0])) return [];

  const children: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = scanner.exec(region)) !== null) {
    if (isClosingTag(match[0]) || isSelfClosingTag(match[0])) continue;
    const end = findBalancedElementEnd(region, match);
    if (end === null) break;
    children.push(region.slice(match.index, end));
    scanner.lastIndex = end;
  }
  return children;
}

/**
 * Fallback for pages with no description-classed container: pick the densest
 * text block instead of admitting the whole region. Descends at most two
 * levels, and only when a child genuinely outscores its parent — a region
 * whose loose text matters always wins over any single child.
 */
function selectBestContentBlock(region: string, depth = 0): string {
  if (depth >= 2) return region;
  const regionScore = scoreBlock(region);
  const children = directChildElements(region);
  let best: string | null = null;
  let bestScore = regionScore;
  for (const child of children) {
    const childScore = scoreBlock(child);
    if (childScore > bestScore) {
      best = child;
      bestScore = childScore;
    }
  }
  // Layout-only wrappers and their parent contain the same text/link mix, so
  // their scores tie. Descend through that single neutral wrapper before
  // comparing its real body/rail children; otherwise a common two-column page
  // leaks the rail despite block scoring.
  if (best === null && children.length === 1 && scoreBlock(children[0]) === regionScore) {
    return selectBestContentBlock(children[0], depth + 1);
  }
  return best === null ? region : selectBestContentBlock(best, depth + 1);
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
  // Cut at the first footer/boilerplate line once enough real content precedes
  // it. A halfway-of-total-length gate missed short JDs whose footer starts
  // early; MIN_HEURISTIC_CHARS is the same "this is real content" bar used
  // elsewhere in this file.
  let offset = 0;
  for (const line of cleaned.split('\n')) {
    const trimmedLine = line.trim();
    if (
      offset >= MIN_HEURISTIC_CHARS &&
      (TRAILING_BOILERPLATE_PATTERN.test(trimmedLine) || TRAILING_BOILERPLATE_PREFIX_PATTERN.test(trimmedLine))
    ) {
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
  const heuristicHtml = html.slice(0, MAX_HTML_SCAN_CHARS);
  const region = heuristicHtml.match(/<main\b[\s\S]*?<\/main>/i)?.[0]
    ?? heuristicHtml.match(/<article\b[\s\S]*?<\/article>/i)?.[0]
    ?? heuristicHtml.match(/<[a-z]+\b[^>]*role\s*=\s*["']main["'][\s\S]*?>[\s\S]*<\/[a-z]+>/i)?.[0]
    ?? null;
  if (!region) return null;

  const cleanedRegion = stripNoiseElements(region);
  let preferredRegion = preferDescriptionContainer(cleanedRegion);
  if (preferredRegion === cleanedRegion) {
    // No description-classed container qualified — score blocks instead of
    // admitting the whole region (nav/ads/related rails would leak through).
    preferredRegion = selectBestContentBlock(cleanedRegion);
  }
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
