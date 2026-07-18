import { describe, expect, it } from 'vitest';
import {
  decodeHtmlEntities,
  detectLoginWall,
  extractJobFromHtml,
  htmlToText,
  normalizeLinkedInUrl,
} from '../job-page-extract.js';

const LONG_DESCRIPTION_HTML = `
  <p>We are hiring a Senior Backend Engineer to join our payments platform team in Riyadh.</p>
  <p>You will design, build and operate high-throughput APIs used by merchants across the Gulf region.</p>
  <ul>
    <li>5&#43; years of production experience with Node.js or Go</li>
    <li>Deep knowledge of PostgreSQL &amp; distributed systems</li>
    <li>Experience with observability, on-call rotations and incident response</li>
  </ul>
  <p>We offer a competitive package, relocation support and an inclusive team culture.</p>
`;

const jsonLdPage = (jsonLd: unknown) => `
  <html><head>
    <title>Senior Backend Engineer - Acme</title>
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  </head><body><div>chrome nav footer</div></body></html>
`;

const jobPosting = {
  '@context': 'https://schema.org/',
  '@type': 'JobPosting',
  title: 'Senior Backend Engineer',
  hiringOrganization: { '@type': 'Organization', name: 'Acme Payments' },
  description: LONG_DESCRIPTION_HTML,
};

describe('decodeHtmlEntities / htmlToText', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeHtmlEntities('Tom &amp; Jerry &#43; friends &#x41;&nbsp;team')).toBe('Tom & Jerry + friends A team');
  });

  it('flattens block tags to newlines and list items to bullets', () => {
    const text = htmlToText('<p>Intro</p><ul><li>First</li><li>Second</li></ul><script>evil()</script>');
    expect(text).toContain('Intro\n');
    expect(text).toContain('• First');
    expect(text).toContain('• Second');
    expect(text).not.toContain('evil');
  });
});

describe('extractJobFromHtml — JSON-LD JobPosting', () => {
  it('extracts a LinkedIn-guest-style posting with high confidence', () => {
    const result = extractJobFromHtml(jsonLdPage(jobPosting));
    expect(result).not.toBeNull();
    expect(result!.source).toBe('json-ld');
    expect(result!.confidence).toBe('high');
    expect(result!.jobTitle).toBe('Senior Backend Engineer');
    expect(result!.companyName).toBe('Acme Payments');
    expect(result!.jobText).toContain('Senior Backend Engineer');
    expect(result!.jobText).toContain('• 5+ years of production experience');
    expect(result!.jobText).toContain('PostgreSQL & distributed systems');
  });

  it('finds a posting nested inside @graph (Greenhouse/Lever-style pages)', () => {
    const graphPage = jsonLdPage({
      '@context': 'https://schema.org',
      '@graph': [{ '@type': 'WebSite', name: 'Acme' }, jobPosting],
    });
    expect(extractJobFromHtml(graphPage)?.source).toBe('json-ld');
  });

  it('finds a posting inside a top-level array of JSON-LD nodes', () => {
    const arrayPage = jsonLdPage([{ '@type': 'BreadcrumbList' }, jobPosting]);
    expect(extractJobFromHtml(arrayPage)?.jobTitle).toBe('Senior Backend Engineer');
  });

  it('skips malformed JSON-LD blocks and keeps searching', () => {
    const page = `
      <script type="application/ld+json">{not valid json</script>
      ${jsonLdPage(jobPosting)}
    `;
    expect(extractJobFromHtml(page)?.source).toBe('json-ld');
  });

  it('rejects postings whose description is too short to be a real JD', () => {
    const page = jsonLdPage({ ...jobPosting, description: '<p>Great job!</p>' });
    expect(extractJobFromHtml(page)).toBeNull();
  });
});

describe('extractJobFromHtml — main-content heuristic', () => {
  it('falls back to <main> content with low confidence', () => {
    const page = `
      <html><head><title>Careers — Acme</title>
      <meta property="og:title" content="Backend Engineer at Acme" /></head>
      <body><nav>menu menu menu</nav><main>${LONG_DESCRIPTION_HTML}</main><footer>foot</footer></body></html>
    `;
    const result = extractJobFromHtml(page);
    expect(result).not.toBeNull();
    expect(result!.source).toBe('heuristic');
    expect(result!.confidence).toBe('low');
    expect(result!.jobTitle).toBe('Backend Engineer at Acme');
    expect(result!.jobText).not.toContain('menu menu');
  });

  it('returns null when only a truncated og:description exists (never imports partial JDs)', () => {
    const page = `
      <html><head><meta property="og:description" content="We are hiring an engineer..." /></head>
      <body><div>app shell</div></body></html>
    `;
    expect(extractJobFromHtml(page)).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(extractJobFromHtml('')).toBeNull();
  });
});

describe('normalizeLinkedInUrl', () => {
  it('canonicalizes /jobs/view/ links (with and without slug)', () => {
    expect(normalizeLinkedInUrl('https://www.linkedin.com/jobs/view/3812345678/?ref=x').canonicalUrl)
      .toBe('https://www.linkedin.com/jobs/view/3812345678/');
    expect(normalizeLinkedInUrl('https://sa.linkedin.com/jobs/view/senior-engineer-at-acme-3812345678').canonicalUrl)
      .toBe('https://www.linkedin.com/jobs/view/3812345678/');
  });

  it('canonicalizes collection/search links that carry currentJobId', () => {
    const info = normalizeLinkedInUrl('https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4012345678');
    expect(info.isLinkedIn).toBe(true);
    expect(info.canonicalUrl).toBe('https://www.linkedin.com/jobs/view/4012345678/');
  });

  it('flags LinkedIn URLs without an identifiable job id', () => {
    const info = normalizeLinkedInUrl('https://www.linkedin.com/feed/');
    expect(info.isLinkedIn).toBe(true);
    expect(info.canonicalUrl).toBeNull();
  });

  it('ignores non-LinkedIn hosts (including lookalikes)', () => {
    expect(normalizeLinkedInUrl('https://boards.greenhouse.io/acme/jobs/1').isLinkedIn).toBe(false);
    expect(normalizeLinkedInUrl('https://evillinkedin.com/jobs/view/1').isLinkedIn).toBe(false);
  });
});

describe('detectLoginWall', () => {
  it('detects LinkedIn anti-bot status codes', () => {
    expect(detectLoginWall('https://www.linkedin.com/jobs/view/1/', 999, '')).toBe(true);
    expect(detectLoginWall('https://www.linkedin.com/jobs/view/1/', 403, '')).toBe(true);
    expect(detectLoginWall('https://www.linkedin.com/jobs/view/1/', 429, '')).toBe(true);
  });

  it('detects authwall/login redirect targets', () => {
    expect(detectLoginWall('https://www.linkedin.com/authwall?trk=x', 200, '<html></html>')).toBe(true);
    expect(detectLoginWall('https://example.com/login?next=/careers', 200, '<html></html>')).toBe(true);
  });

  it('detects authwall markers in the page body', () => {
    expect(detectLoginWall('https://www.linkedin.com/jobs/view/1/', 200, '<html>join linkedin to view this job</html>')).toBe(true);
  });

  it('passes clean public pages', () => {
    expect(detectLoginWall('https://www.linkedin.com/jobs/view/1/', 200, jsonLdPage(jobPosting))).toBe(false);
  });
});
