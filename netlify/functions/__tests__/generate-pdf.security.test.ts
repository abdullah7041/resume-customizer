import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourcePath = resolve(process.cwd(), 'netlify/functions/generate-pdf.ts');

describe('generate-pdf SSRF guard', () => {
  it('keeps Puppeteer request interception enabled and aborts network fetches', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('setRequestInterception(true)');
    expect(source).toContain('request.abort("blockedbyclient")');
    expect(source).toContain('ALLOWED_RENDER_REQUEST_PROTOCOLS');
    expect(source).not.toContain('setRequestInterception(false)');
  });

  it('uses the supported Puppeteer network-idle API after setting page content', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain("waitUntil: 'load'");
    expect(source).toContain('waitForNetworkIdle({');
    expect(source).toContain('concurrency: 2');
    expect(source).toContain('const renderDeadline = Date.now() + RENDER_TIMEOUT_MS;');
    expect(source).toContain('timeout: Math.max(1, renderDeadline - Date.now())');
    expect(source).not.toContain("waitUntil: 'networkidle2'");
  });
});
