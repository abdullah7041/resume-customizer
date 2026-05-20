// src/__tests__/bug-pdf-download.test.ts
// Bug: PDF download sends no auth header → 401 from generate-pdf
// Bug: Console logs spam in production (should be dev-only)

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';



describe('generate-pdf server function auth policy', () => {
  it('requires authentication before rendering resume HTML payloads', () => {
    const source = readFileSync(
      join(__dirname, '../../netlify/functions/generate-pdf.ts'),
      'utf-8'
    );

    const authHeaderIndex = source.indexOf('const authHeader = event.headers.authorization || event.headers.Authorization');
    const parseBodyIndex = source.indexOf('JSON.parse(event.body || "{}")');
    const hasAuthBlock = /if\s*\(\s*!authHeader\s*\)\s*\{[\s\S]*?statusCode:\s*401/.test(source);

    expect(authHeaderIndex).toBeGreaterThan(-1);
    expect(parseBodyIndex).toBeGreaterThan(-1);
    expect(authHeaderIndex).toBeLessThan(parseBodyIndex);
    expect(hasAuthBlock).toBe(true);
  });
});

describe('production console log policy', () => {
  it('resumeStore merge warnings should only log in dev mode', () => {
    const source = readFileSync(
      join(__dirname, '../lib/stores/resumeStore.ts'),
      'utf-8'
    );

    // Find all lines with ResumeStore console.warn
    const lines = source.split('\n');
    const warnLines = lines.filter(line =>
      line.includes('console.warn') && line.includes('[ResumeStore]')
    );

    expect(warnLines.length).toBeGreaterThan(0);

    // Every ResumeStore console.warn must be on a line that starts with DEV check
    const ungated = warnLines.filter(line => !line.includes('import.meta.env.DEV'));
    expect(ungated).toEqual([]);
  });
});
