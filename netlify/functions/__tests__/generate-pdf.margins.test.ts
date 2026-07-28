// Bug: downloaded PDF was an empty white page.
// Root cause: generate-pdf.ts read the user's margin settings via a bare
// `page.evaluate()` call AFTER hardenPageForRender() had already disabled page
// JavaScript (a deliberate SSRF/XSS guard against attacker-controlled resume
// HTML). That evaluate() call throws once JS is disabled, is NOT caught, and
// propagates to the outer catch block, which returns a 500. The client's
// silent client-side (html-to-image + jsPDF) fallback then rendered a blank
// off-screen clone, so the user saw a downloaded PDF with no visible error.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractPageMarginsMm } from '../generate-pdf.js';

const sourcePath = resolve(process.cwd(), 'netlify/functions/generate-pdf.ts');

describe('extractPageMarginsMm', () => {
  it('reads --margin-top/--margin-bottom in inches and converts to millimeters', () => {
    const html = '<div style="--margin-top: 0.5in; --margin-bottom: 0.75in;"></div>';
    const result = extractPageMarginsMm(html);
    expect(result.topMm).toBeCloseTo(12.7, 1);
    expect(result.bottomMm).toBeCloseTo(19.05, 1);
  });

  it('reads --margin-top/--margin-bottom already expressed in millimeters', () => {
    const html = '<div style="--margin-top: 12.7mm; --margin-bottom: 25.4mm;"></div>';
    const result = extractPageMarginsMm(html);
    expect(result.topMm).toBeCloseTo(12.7, 1);
    expect(result.bottomMm).toBeCloseTo(25.4, 1);
  });

  it('falls back to the default 19.05mm margin when the custom properties are missing', () => {
    const result = extractPageMarginsMm('<div style="color: red;"></div>');
    expect(result.topMm).toBeCloseTo(19.05, 1);
    expect(result.bottomMm).toBeCloseTo(19.05, 1);
  });

  it('falls back to the default when the value is not a finite number', () => {
    const html = '<div style="--margin-top: notanumber; --margin-bottom: 0.5in;"></div>';
    const result = extractPageMarginsMm(html);
    expect(result.topMm).toBeCloseTo(19.05, 1);
    expect(result.bottomMm).toBeCloseTo(12.7, 1);
  });
});

describe('generate-pdf margin handling does not rely on page.evaluate()', () => {
  const source = readFileSync(sourcePath, 'utf8');

  it('computes page margins via extractPageMarginsMm before setContent, not via page.evaluate()', () => {
    const extractIndex = source.indexOf('extractPageMarginsMm(html)');
    const setContentIndex = source.indexOf('await page.setContent(');
    const hardenIndex = source.indexOf('await hardenPageForRender(page);');

    expect(extractIndex).toBeGreaterThan(hardenIndex);
    expect(extractIndex).toBeLessThan(setContentIndex);
  });

  it('injects the @page margin rule directly into the setContent HTML string', () => {
    expect(source).toMatch(/@page\s*\{\s*margin:\s*\$\{topMm\}mm\s*0\s*\$\{bottomMm\}mm\s*0\s*!important;\s*\}/);
  });

  it('does not call page.evaluate() to read or mutate template margins after setContent', () => {
    const setContentEnd = source.indexOf('await page.waitForNetworkIdle(');
    const pdfCallIndex = source.indexOf('page.pdf({');
    const between = source.slice(setContentEnd, pdfCallIndex);

    // The only page.evaluate()/evaluateHandle() calls left in this window
    // are the font/image-wait block, which is already wrapped in try/catch
    // and tolerates JS being disabled. No bare (uncaught) evaluate() call for
    // margins should exist here.
    expect(between).not.toMatch(/await page\.evaluate\(`/);
  });
});
