import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('PDF Page Proliferation Bug', () => {
  it('Should not contain aggressive break-inside: avoid CSS that conflicts with Chromium Flexbox pagination', () => {
    const source = readFileSync(
      join(__dirname, '../../netlify/functions/generate-pdf.ts'),
      'utf-8'
    );

    // If we apply break-inside: avoid to every p, li, h1, h2, h3, h4, and section > div > div
    // inside a flexbox container, Chromium's pagination algorithm crashes and throws each node
    // onto a separate page, resulting in 16+ pages of isolated text.
    // The test asserts that these aggressive native CSS pagination rules have been removed,
    // relying instead entirely on the user's custom Intelligent Pagination Engine (JS margins).
    
    expect(source).not.toContain('li, p, h1, h2, h3, h4 {');
    expect(source).not.toContain('page-break-inside: avoid !important;');
    expect(source).not.toContain('section > div > div { break-inside: avoid !important;');
  });
});
