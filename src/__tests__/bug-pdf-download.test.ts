// src/__tests__/bug-pdf-download.test.ts
// Bug: PDF download sends no auth header → 401 from generate-pdf
// Bug: Console logs spam in production (should be dev-only)

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('PDF download auth bug', () => {
  it('handleDownloadPdf should use getAuthHeaders and have client-side fallback', () => {
    const source = readFileSync(
      join(__dirname, '../components/sections/TemplatesSection.tsx'),
      'utf-8'
    );

    // Must use getAuthHeaders for the server call
    const hasFetchWithAuth = source.includes('getAuthHeaders') && source.includes('generate-pdf');

    // Must have client-side fallback (exportResumeToPdf uses window.print)
    const hasClientFallback = source.includes('exportResumeToPdf');

    expect(hasFetchWithAuth).toBe(true);
    expect(hasClientFallback).toBe(true);
  });
});

describe('generate-pdf server function auth policy', () => {
  it('should not hard-block unauthenticated PDF requests with 401', () => {
    const source = readFileSync(
      join(__dirname, '../../netlify/functions/generate-pdf.ts'),
      'utf-8'
    );

    // The function should NOT return 401 when no auth header is present
    const hasHardAuthBlock = /if\s*\(\s*!authHeader\s*\)\s*\{[\s\S]*?statusCode:\s*401/.test(source);
    expect(hasHardAuthBlock).toBe(false);
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
