import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  handleRenderRequest,
  hardenPageForRender,
  isAllowedRenderRequest,
} from '../generate-pdf.js';

const sourcePath = resolve(process.cwd(), 'netlify/functions/generate-pdf.ts');
type RenderRequestHandler = (request: Parameters<typeof handleRenderRequest>[0]) => void;

describe('generate-pdf SSRF guard', () => {
  it('keeps Puppeteer request interception enabled and aborts network fetches', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('setRequestInterception(true)');
    expect(source).toContain('request.abort("blockedbyclient")');
    expect(source).toContain('ALLOWED_RENDER_REQUEST_PROTOCOLS');
    expect(source).not.toContain('setRequestInterception(false)');
  });

  it('hardens the page before setting attacker-provided content', () => {
    const source = readFileSync(sourcePath, 'utf8');
    const hardenPageIndex = source.indexOf('await hardenPageForRender(page);');
    const setContentIndex = source.indexOf('await page.setContent(');

    expect(hardenPageIndex).toBeGreaterThanOrEqual(0);
    expect(setContentIndex).toBeGreaterThan(hardenPageIndex);
  });

  it('uses the supported Puppeteer network-idle API after setting page content', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain("waitUntil: 'load'");
    expect(source).toContain('waitForNetworkIdle({');
    expect(source).toContain('concurrency: 2');
    // One shared deadline for setContent + the network-idle wait, so migrating off
    // waitUntil: 'networkidle2' cannot double the render budget. It is now clamped to
    // whatever is left of the gateway window rather than the flat RENDER_TIMEOUT_MS,
    // because the 90s Lambda timeout this function was written against is not the
    // budget it actually gets (~30s at the gateway).
    expect(source).toContain('const renderDeadline = Date.now() + Math.min(');
    expect(source).toContain('remainingBudgetMs(requestStartedAt, RESPONSE_RESERVE_MS),');
    // The flat 60s page.pdf race inside a ~30s window guaranteed a gateway kill.
    expect(source).not.toContain('const PDF_TIMEOUT_MS = 60_000;');
    expect(source).toContain('timeout: Math.max(1, renderDeadline - Date.now())');
    expect(source).not.toContain("waitUntil: 'networkidle2'");
  });
});

describe('generate-pdf render sandbox', () => {
  it.each([
    'about:blank',
    'data:text/html,<p>safe</p>',
    'blob:https://watheq.test/resume',
  ])('allows the %s protocol', (requestUrl) => {
    expect(isAllowedRenderRequest(requestUrl)).toBe(true);
  });

  it.each([
    'http://169.254.169.254/latest/meta-data',
    'https://example.com/x.png',
    'file:///etc/passwd',
    'ftp://host/f',
    'not a valid URL',
  ])('blocks the %s protocol or malformed URL', (requestUrl) => {
    expect(isAllowedRenderRequest(requestUrl)).toBe(false);
  });

  it('continues an allowed request', () => {
    const calls: string[] = [];
    const request = {
      url: () => 'data:text/html,<p>safe</p>',
      continue: () => calls.push('continue'),
      abort: (reason: string) => calls.push(`abort:${reason}`),
    };

    handleRenderRequest(request);

    expect(calls).toEqual(['continue']);
  });

  it('aborts a network request', () => {
    const calls: string[] = [];
    const request = {
      url: () => 'http://internal.example/metadata',
      continue: () => calls.push('continue'),
      abort: (reason: string) => calls.push(`abort:${reason}`),
    };

    handleRenderRequest(request);

    expect(calls).toEqual(['abort:blockedbyclient']);
  });

  it('enables interception and disables JavaScript before content can load', async () => {
    const calls: string[] = [];
    let registeredHandler: RenderRequestHandler | undefined;
    const fakePage = {
      setRequestInterception: async (enabled: boolean) => {
        calls.push(`setRequestInterception:${enabled}`);
      },
      on: (event: 'request', handler: RenderRequestHandler) => {
        calls.push(`on:${event}`);
        registeredHandler = handler;
      },
      setJavaScriptEnabled: async (enabled: boolean) => {
        calls.push(`setJavaScriptEnabled:${enabled}`);
      },
    };

    await hardenPageForRender(fakePage);

    expect(calls).toEqual([
      'setRequestInterception:true',
      'on:request',
      'setJavaScriptEnabled:false',
    ]);
    expect(registeredHandler).toBe(handleRenderRequest);
  });
});
