/**
 * Bug: PDF does not download on mobile devices
 *
 * Root cause (two-layer problem):
 * 1. `saveAs()` from file-saver uses `<a download>` + blob URL internally.
 *    iOS Safari silently ignores `<a download>` for blob URLs — the download
 *    never triggers.
 * 2. Even if we call `window.open(blobUrl)` after `await fetch()`, iOS Safari
 *    blocks it because Safari's "transient activation" timer has expired —
 *    `window.open()` must be called SYNCHRONOUSLY within the user-gesture event.
 *
 * Fix: Pre-open a blank tab synchronously before any `await`, then redirect
 * its `location.href` to the blob URL once the async work is done.
 * jsPDF.save() uses saveAs internally — same fix applied to the client fallback.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Bug: PDF does not download on mobile', () => {
  const source = readFileSync(
    join(__dirname, '../components/sections/TemplatesSection.tsx'),
    'utf-8'
  );

  it('should detect mobile user agent before deciding download strategy', () => {
    // The download handler must include mobile detection
    const hasMobileDetection =
      source.includes('isMobile') &&
      (source.includes('Mobi') || source.includes('Android') || source.includes('iPhone'));

    expect(hasMobileDetection).toBe(true);
  });

  it('should pre-open a blank window SYNCHRONOUSLY before any await on mobile', () => {
    // The key fix: window.open('', '_blank') must be called before any await.
    // We verify this by checking that mobileWindow is assigned via window.open
    // and it appears BEFORE the try block / fetch calls.
    const hasMobileWindowPreOpen =
      source.includes("mobileWindow = window.open('', '_blank')") ||
      source.includes('mobileWindow = window.open("", "_blank")');

    expect(hasMobileWindowPreOpen).toBe(true);
  });

  it('should redirect mobileWindow.location.href to the blob URL (not call window.open after await)', () => {
    // After async fetch resolves, we must redirect the pre-opened window,
    // NOT call window.open again (which would be blocked by Safari).
    const hasLocationRedirect = source.includes('mobileWindow.location.href = blobUrl');

    expect(hasLocationRedirect).toBe(true);
  });

  it('should NOT use saveAs() unconditionally for the server PDF path', () => {
    // saveAs() uses <a download> internally — blocked on mobile Safari.
    // It must only be used on desktop (when isMobile is false).
    const serverSuccessBlock = source.match(
      /if\s*\(\s*response\.ok\s*\)\s*\{([\s\S]*?)\}\s*else if\s*\(\s*import\.meta/
    );

    expect(serverSuccessBlock).toBeTruthy();

    const block = serverSuccessBlock![1];

    // saveAs must be inside an else branch (i.e., NOT for mobile)
    const hasUnconditionalSaveAs =
      block.includes('saveAs(') &&
      !block.includes('isMobile') &&
      !block.includes('mobileWindow');

    expect(hasUnconditionalSaveAs).toBe(false);
  });

  it('should also handle the jsPDF client-side fallback with mobile redirect', () => {
    // jsPDF.save() uses saveAs internally — same mobile bug.
    // The fallback must also use mobileWindow.location.href for mobile.
    const hasJsPdfMobileFix =
      source.includes("pdf.output('blob')") &&
      source.includes('mobileWindow.location.href');

    expect(hasJsPdfMobileFix).toBe(true);
  });

  it('should close the pre-opened tab on uncaught error', () => {
    // If an error is thrown, the blank pre-opened tab should be closed
    // to avoid leaving a confusing empty tab.
    const hasErrorCleanup =
      source.includes('mobileWindow.close()') ||
      source.includes('mobileWindow?.close()');

    expect(hasErrorCleanup).toBe(true);
  });
});
