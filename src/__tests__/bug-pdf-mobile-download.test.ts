/**
 * Bug: PDF does not download on mobile devices
 *
 * Root cause: TemplatesSection.tsx uses `saveAs(blob, filename)` from file-saver
 * for ALL devices. On mobile Safari (iOS), `saveAs` internally uses
 * `<a download>` + blob URL which is silently ignored. The download never triggers.
 *
 * Fix: On mobile, open the PDF blob URL with `window.open()` instead of `saveAs()`.
 * Mobile browsers natively handle PDF blob URLs by showing a viewer/download prompt.
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
    // The download handler must include mobile detection logic
    const hasMobileDetection =
      source.includes('isMobile') ||
      source.includes('Mobi') ||
      source.includes('Android') ||
      source.includes('iPhone');

    expect(hasMobileDetection).toBe(true);
  });

  it('should NOT use saveAs() unconditionally for the server PDF path', () => {
    // The bug: saveAs is called directly on the server response blob
    // without any mobile check. This line should NOT exist unconditioned:
    //   saveAs(blob, filename)
    // It should be wrapped in a mobile check or replaced with a universal method.

    // Find the server-side success path (response.ok block)
    const serverSuccessBlock = source.match(
      /if\s*\(\s*response\.ok\s*\)\s*\{([\s\S]*?)\}/
    );

    expect(serverSuccessBlock).toBeTruthy();

    const block = serverSuccessBlock![1];

    // The block should NOT contain bare `saveAs(blob, filename)` without mobile handling.
    // It should either:
    //   a) have a mobile branch that uses window.open or URL.createObjectURL, OR
    //   b) use a download utility that handles mobile internally
    const hasUnconditionalSaveAs =
      block.includes('saveAs(blob') &&
      !block.includes('isMobile') &&
      !block.includes('Mobi') &&
      !block.includes('window.open');

    expect(hasUnconditionalSaveAs).toBe(false);
  });

  it('should use window.open for PDF blob on mobile in the server path', () => {
    // After fetching the PDF blob from the server, on mobile,
    // the code should open the blob URL via window.open (not saveAs)
    const hasMobileWindowOpen =
      source.includes('window.open(') &&
      source.includes('createObjectURL') &&
      source.includes('application/pdf');

    expect(hasMobileWindowOpen).toBe(true);
  });
});
