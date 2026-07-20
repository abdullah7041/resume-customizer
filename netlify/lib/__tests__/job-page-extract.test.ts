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

  it('cleans a LinkedIn guest-shaped main region while keeping the job description', () => {
    const page = `
      <html><head><title>Senior Backend Engineer | Acme</title></head><body>
        <main>
          <div class="top-card-actions"><button>Apply</button><button>Save</button></div>
          <section class="show-more-less-html__markup">${LONG_DESCRIPTION_HTML}</section>
          <aside class="recruiter-card">
            <h2>Meet the recruiter</h2><p>Message Taylor about this role.</p>
          </aside>
          <section class="similar-jobs">
            <h2>Similar jobs</h2><p>Staff Engineer at Another Company</p>
          </section>
          <form class="sign-in"><p>Sign in to apply</p></form>
        </main>
      </body></html>
    `;

    const result = extractJobFromHtml(page);

    expect(result?.source).toBe('heuristic');
    expect(result?.jobText).toContain('design, build and operate high-throughput APIs');
    expect(result?.jobText).not.toMatch(/apply|save|meet the recruiter|taylor|similar jobs|sign in/i);
  });

  it('prefers a qualified description container over the broader cleaned region', () => {
    const page = `
      <main>
        <p>Page-level promotional copy that is not part of the role.</p>
        <div class="posting-description">${LONG_DESCRIPTION_HTML}</div>
        <section><h2>Company updates</h2><p>Follow Acme for weekly product news.</p></section>
      </main>
    `;

    const result = extractJobFromHtml(page);

    expect(result?.jobText).toContain('Senior Backend Engineer');
    expect(result?.jobText).not.toContain('Page-level promotional copy');
    expect(result?.jobText).not.toContain('Company updates');
  });

  it('deduplicates exact normalized lines and keeps the first occurrence', () => {
    const repeated = 'Own platform reliability and partner with product teams across the full delivery lifecycle.';
    const page = `
      <main>
        ${LONG_DESCRIPTION_HTML}
        <p>${repeated}</p>
        <p>  OWN   PLATFORM RELIABILITY and partner with product teams across the full delivery lifecycle.  </p>
      </main>
    `;

    const result = extractJobFromHtml(page);
    const normalizedMatches = result?.jobText.match(/own\s+platform reliability and partner with product teams across the full delivery lifecycle\./gi);

    expect(normalizedMatches).toHaveLength(1);
    expect(result?.jobText).toContain(repeated);
  });

  it('truncates trailing similar-jobs content when its heading starts in the second half', () => {
    const page = `
      <main>
        ${LONG_DESCRIPTION_HTML}
        <p>You will mentor engineers and improve delivery practices across the organization.</p>
        <h2>Similar jobs</h2>
        <p>Staff Engineer at Another Company</p>
        <p>Engineering Manager at Example Limited</p>
      </main>
    `;

    const result = extractJobFromHtml(page);

    expect(result?.jobText).toContain('mentor engineers');
    expect(result?.jobText).not.toContain('Similar jobs');
    expect(result?.jobText).not.toContain('Another Company');
  });

  it('uses the whole cleaned region when no description container is qualified', () => {
    const page = `
      <main>
        <section class="description"><p>Short role summary.</p></section>
        <div>${LONG_DESCRIPTION_HTML}</div>
        <p>This final requirement is only available in the broader main region.</p>
      </main>
    `;

    const result = extractJobFromHtml(page);

    expect(result?.jobText).toContain('Short role summary.');
    expect(result?.jobText).toContain('This final requirement is only available in the broader main region.');
  });

  it('strips cookie-consent, newsletter and sidebar blocks by class name', () => {
    const page = `
      <main>
        <div class="cookie-consent"><p>We use cookies to improve your experience. Accept all cookies.</p></div>
        <div class="job-content">${LONG_DESCRIPTION_HTML}</div>
        <div class="newsletter-signup"><p>Subscribe to weekly job alerts in your inbox.</p></div>
        <div class="sidebar-widget"><a href="/j/1">Marketing Manager</a><a href="/j/2">HR Generalist</a></div>
      </main>
    `;

    const result = extractJobFromHtml(page);

    expect(result?.jobText).toContain('design, build and operate high-throughput APIs');
    expect(result?.jobText).not.toMatch(/cookies|subscribe|marketing manager|hr generalist/i);
  });

  it('drops a link-heavy rail with neutral class names via block scoring', () => {
    // No class/id matches any noise pattern — only text/link density can
    // separate the JD body from the related-jobs rail.
    const page = `
      <main>
        <div class="col-left">${LONG_DESCRIPTION_HTML}</div>
        <div class="col-right">
          <a href="/jobs/1">Senior Accountant — Riyadh, full time, competitive salary package</a>
          <a href="/jobs/2">Warehouse Supervisor — Dammam, rotating shifts, transport provided</a>
          <a href="/jobs/3">Sales Executive — Khobar, automotive sector, commission scheme</a>
          <a href="/jobs/4">Executive Assistant — Jeddah, immediate start, bilingual preferred</a>
          <a href="/jobs/5">Graphic Designer — Riyadh, agency environment, portfolio required</a>
          <a href="/jobs/6">HR Generalist — Riyadh, 2 years experience, CIPD a plus</a>
        </div>
      </main>
    `;

    const result = extractJobFromHtml(page);

    expect(result?.jobText).toContain('design, build and operate high-throughput APIs');
    expect(result?.jobText).not.toMatch(/senior accountant|warehouse supervisor|graphic designer/i);
  });

  it('truncates trailing Arabic similar-jobs boilerplate in the second half', () => {
    const page = `
      <main>
        ${LONG_DESCRIPTION_HTML}
        <p>You will mentor engineers and improve delivery practices across the organization.</p>
        <h2>وظائف مشابهة</h2>
        <p>مهندس برمجيات أول في شركة أخرى</p>
      </main>
    `;

    const result = extractJobFromHtml(page);

    expect(result?.jobText).toContain('mentor engineers');
    expect(result?.jobText).not.toContain('وظائف مشابهة');
    expect(result?.jobText).not.toContain('مهندس برمجيات أول');
  });

  it('keeps a description container classed job-ad__description (bare "ad" is not noise)', () => {
    const page = `
      <main>
        <p>Page-level promotional copy that is not part of the role.</p>
        <div class="job-ad__description">${LONG_DESCRIPTION_HTML}</div>
      </main>
    `;

    const result = extractJobFromHtml(page);

    expect(result?.jobText).toContain('design, build and operate high-throughput APIs');
    expect(result?.jobText).not.toContain('Page-level promotional copy');
  });

  it('removes an entire noise block with nested elements of the same tag', () => {
    const page = `
      <main>
        ${LONG_DESCRIPTION_HTML}
        <div class="similar-jobs">
          <div>First unrelated recommendation.</div>
          <div>Second unrelated recommendation.</div>
        </div>
      </main>
    `;

    const result = extractJobFromHtml(page);

    expect(result?.jobText).not.toContain('First unrelated recommendation.');
    expect(result?.jobText).not.toContain('Second unrelated recommendation.');
  });

  it('keeps every nested same-tag child in a qualified description container', () => {
    const page = `
      <main>
        <div class="description">
          <div>${LONG_DESCRIPTION_HTML}</div>
          <div>Critical requirement: lead production incident reviews and mentor platform engineers.</div>
        </div>
        <p>Page promotion outside the job description.</p>
      </main>
    `;

    const result = extractJobFromHtml(page);

    expect(result?.jobText).toContain('Critical requirement: lead production incident reviews');
    expect(result?.jobText).not.toContain('Page promotion outside the job description.');
  });

  it('does not treat data-testid as an id attribute', () => {
    const page = `
      <main>
        ${LONG_DESCRIPTION_HTML}
        <div data-testid="related-content">
          <p>Required role context carried by a prefixed attribute.</p>
        </div>
      </main>
    `;

    expect(extractJobFromHtml(page)?.jobText)
      .toContain('Required role context carried by a prefixed attribute.');
  });

  it('does not treat data-class as a class attribute', () => {
    const page = `
      <main>
        <div data-class="job-description">${LONG_DESCRIPTION_HTML}</div>
        <p>Required role context from the broader main region.</p>
      </main>
    `;

    expect(extractJobFromHtml(page)?.jobText)
      .toContain('Required role context from the broader main region.');
  });

  it('recognizes an unquoted class attribute on a noise block', () => {
    const page = `
      <main>
        ${LONG_DESCRIPTION_HTML}
        <div class=similar-jobs><p>Unquoted-class recommendation noise.</p></div>
      </main>
    `;

    expect(extractJobFromHtml(page)?.jobText)
      .not.toContain('Unquoted-class recommendation noise.');
  });

  it('recognizes an unquoted id attribute on a description container', () => {
    const page = `
      <main>
        <div id=job-description>${LONG_DESCRIPTION_HTML}</div>
        <p>Page promotion outside the unquoted description container.</p>
      </main>
    `;

    expect(extractJobFromHtml(page)?.jobText)
      .not.toContain('Page promotion outside the unquoted description container.');
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
