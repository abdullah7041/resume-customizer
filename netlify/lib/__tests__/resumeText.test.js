import { beforeEach, describe, expect, it, vi } from "vitest";

// `loadPdfjs` in `netlify/lib/resumeText.js` memoises its dynamic import at
// module scope (`pdfjsLibPromise`), so each test that needs different pdfjs
// behaviour must reset the module registry and re-import fresh.
beforeEach(() => {
  vi.resetModules();
  vi.doUnmock("pdfjs-dist/legacy/build/pdf.mjs");
});

// Minimal PDF content-stream bytes that `extractPdfTextFallback` (the raw-text
// regex parser) can genuinely recover a string from: a `BT ... ET` text block
// containing a literal string operand. Do not assert on empty output — empty
// is exactly what the bug under test produces.
const buildPdfIshBuffer = (text) => new TextEncoder().encode(`BT (${text}) Tj ET`).buffer;

describe("resumeText.js (server) - extractPlainTextFromArrayBuffer / PDF path", () => {
  it("falls back to the raw-text parser (without crashing on a detached buffer) when pdfjs.getDocument throws", async () => {
    vi.doMock(
      "pdfjs-dist/legacy/build/pdf.mjs",
      () => ({
        version: "5.7.284",
        getDocument: (options) => {
          // Mirror real pdfjs: `getDocument({ data })` transfers/detaches the
          // ArrayBuffer it is handed. Detach whatever buffer we actually
          // received so this test fails the same way production did when the
          // code passed the original (undetached-copy) buffer straight through.
          try {
            structuredClone(options.data, { transfer: [options.data] });
          } catch {
            // ignore - not fatal to the test if the runtime can't transfer
          }
          return { promise: Promise.reject(new Error("simulated pdfjs failure")) };
        },
      }),
      { virtual: true },
    );

    const { extractPlainTextFromArrayBuffer } = await import("../resumeText.js");
    const buffer = buildPdfIshBuffer("Hello Fallback World");

    const text = await extractPlainTextFromArrayBuffer(buffer, { mimeType: "application/pdf" });

    expect(text).toContain("Hello Fallback World");
  });

  it("returns pdfjs-extracted text unchanged on the happy path", async () => {
    vi.doMock(
      "pdfjs-dist/legacy/build/pdf.mjs",
      () => ({
        version: "5.7.284",
        getDocument: () => ({
          promise: Promise.resolve({
            numPages: 1,
            getPage: async () => ({
              getTextContent: async () => ({
                items: [{ str: "Hello Riyadh", transform: [1, 0, 0, 1, 0, 100] }],
              }),
              cleanup: () => {},
            }),
            cleanup: () => {},
            destroy: () => {},
          }),
        }),
      }),
      { virtual: true },
    );

    const { extractPlainTextFromArrayBuffer } = await import("../resumeText.js");
    const buffer = new Uint8Array([1, 2, 3]).buffer;

    const text = await extractPlainTextFromArrayBuffer(buffer, { mimeType: "application/pdf" });

    expect(text).toBe("Hello Riyadh");
  });
});
