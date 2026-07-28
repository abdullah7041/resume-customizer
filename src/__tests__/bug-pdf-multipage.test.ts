// src/__tests__/bug-pdf-multipage.test.ts
// Bug: Downloaded PDF shows massive blank gaps + page 2+ has no top breathing room.
// Root cause:
//   1. generate-pdf.ts was using emulateMediaType('screen'), bypassing @media print CSS rules.
//   2. TemplatesSection.tsx clone mutation hardcoded minHeight: '297mm', forcing blank gaps.
//   3. Page 2+ started flush (no top margin) because Puppeteer margin was zero.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Multi-page PDF pagination bugs (revised root cause)', () => {
  const pdfFn = readFileSync(
    join(__dirname, '../../netlify/functions/generate-pdf.ts'),
    'utf-8'
  );
  const templateSection = readFileSync(
    join(__dirname, '../components/sections/TemplatesSection.tsx'),
    'utf-8'
  );

  // ─── generate-pdf.ts checks ───────────────────────────────────────────────

  it('BUG 1: generate-pdf.ts must use print media type so @media print CSS fires', () => {
    // @media print rules in index.css set min-height: auto !important on the template root,
    // strip transforms, and handle @page margins. With 'screen' media, all these rules are ignored.
    expect(
      pdfFn,
      "generate-pdf.ts must use emulateMediaType('print') so @media print CSS rules are active"
    ).toContain("emulateMediaType('print')");

    expect(
      pdfFn,
      "generate-pdf.ts must NOT use emulateMediaType('screen') — this bypasses all @media print rules"
    ).not.toContain("emulateMediaType('screen')");
  });

  it('BUG 1 (corollary): the injected @page rule must set a non-zero top margin so page 2+ have breathing room', () => {
    // The @page CSS rule (not a page.pdf() margin option — see the blank-PDF fix)
    // repeats on every page, including page 2+. A zero top margin leaves page 2
    // content flush at the very top with no breathing room. The template's own
    // paddingTop is a CSS property on the root div; it does NOT repeat per page.
    const nonZeroPageTopMargin = /@page\s*\{\s*margin:\s*\$\{topMm\}mm/;
    expect(
      pdfFn,
      'generate-pdf.ts must inject an @page rule with a non-zero top margin (topMm) so every page has top breathing room'
    ).toMatch(nonZeroPageTopMargin);

    // page.pdf() must NOT also pass a margin option — that would fight the @page rule.
    expect(
      pdfFn,
      'page.pdf() must not pass its own margin option — the injected @page rule is the sole margin source'
    ).not.toMatch(/page\.pdf\(\{[^)]*margin:\s*\{/s);
  });

  it('BUG 1 (page 1 padding): server CSS must zero template paddingTop to avoid double-padding on page 1', () => {
    // The Puppeteer margin provides top spacing on every page.
    // The template root also has paddingTop (e.g. 12.7mm) for the browser preview.
    // Without zeroing it in the PDF context, page 1 gets Puppeteer margin + template padding = double spacing.
    expect(
      pdfFn,
      'generate-pdf.ts must inject padding-top: 0 on [data-resume-preview] > div to avoid double top padding on page 1'
    ).toMatch(/\[data-resume-preview\]\s*>\s*div[^}]*padding-top:\s*0/);
  });

  it('BUG 2: generate-pdf.ts must include h2 { break-after: avoid } to prevent orphaned headers', () => {
    // Section headers should not appear alone at the bottom of a page.
    // This CSS rule works in both screen and print rendering modes.
    expect(
      pdfFn,
      'generate-pdf.ts must inject `h2 { break-after: avoid }` CSS to prevent orphaned headings'
    ).toMatch(/h2\s*\{[^}]*break-after:\s*avoid/);
  });

  // ─── TemplatesSection.tsx checks ─────────────────────────────────────────

  it('BUG 3: DOM clone must NOT hardcode minHeight: 297mm — must use auto for multi-page flow', () => {
    // The clone mutation sets minHeight on every transformed element.
    // '297mm' forces the template root to fill exactly one A4 page, leaving blank gaps below sparse content.
    // 'auto' lets the template grow to fit its actual content and flow naturally across pages.
    expect(
      templateSection,
      "DOM clone mutation must set minHeight to 'auto', not '297mm', to allow multi-page flow"
    ).not.toMatch(/htmlEl\.style\.minHeight\s*=\s*'297mm'/);

    expect(
      templateSection,
      "DOM clone mutation must set minHeight to 'auto'"
    ).toMatch(/htmlEl\.style\.minHeight\s*=\s*'auto'/);
  });
});
