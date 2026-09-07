import { describe, expect, it, vi } from "vitest";
import { __internal } from "../lib/utils/resumeText";

/**
 * Regression cover for Sentry JAVASCRIPT-REACT-1G (Safari 26.6.1, `area: pdf-extract`).
 *
 * pdfjs 5.x implements `page.getTextContent()` as
 * `for await (const chunk of this.streamTextContent(...))`, which requires
 * `ReadableStream.prototype[Symbol.asyncIterator]`. Safari does not implement that,
 * so the call threw `TypeError: undefined is not a function` from inside pdfjs. The
 * caller batched four pages under `Promise.all`, so ONE such page rejected the whole
 * batch, the outer catch discarded every page already extracted, and the upload
 * silently degraded to a raw-byte scrape whose output still cleared the caller's
 * 100-character threshold. That is how a resume reached the AI parser with its
 * certificates, home city and work cities missing.
 */

const { readPdfPageTextItems, looksLikeReadableText } = __internal as {
  readPdfPageTextItems: (page: unknown) => Promise<Array<{ str: string }>>;
  looksLikeReadableText: (text: string) => boolean;
};

/** A ReadableStream-alike with NO Symbol.asyncIterator, exactly as Safari exposes it. */
const streamOf = (chunks: Array<{ items: Array<{ str: string }> }>) => {
  let index = 0;
  return {
    getReader: () => ({
      read: async () =>
        index < chunks.length
          ? { value: chunks[index++], done: false }
          : { value: undefined, done: true },
      releaseLock: () => {},
    }),
  };
};

describe("readPdfPageTextItems — Safari has no ReadableStream async iterator", () => {
  it("drains streamTextContent with an explicit reader instead of for-await", async () => {
    const page = {
      streamTextContent: () => streamOf([{ items: [{ str: "Riyadh" }] }, { items: [{ str: "Dammam" }] }]),
      // Simulates Safari: pdfjs's own getTextContent throws on the async iteration.
      getTextContent: async () => {
        throw new TypeError("undefined is not a function");
      },
    };

    const items = await readPdfPageTextItems(page);

    expect(items.map((i) => i.str)).toEqual(["Riyadh", "Dammam"]);
  });

  it("releases the reader lock even after the stream is fully drained", async () => {
    const releaseLock = vi.fn();
    const page = {
      streamTextContent: () => ({
        getReader: () => ({
          read: async () => ({ value: undefined, done: true }),
          releaseLock,
        }),
      }),
      getTextContent: async () => ({ items: [] }),
    };

    await readPdfPageTextItems(page);

    expect(releaseLock).toHaveBeenCalledTimes(1);
  });

  it("falls back to getTextContent when the build exposes no streamTextContent", async () => {
    const page = { getTextContent: async () => ({ items: [{ str: "Al-Ahsa" }] }) };

    const items = await readPdfPageTextItems(page);

    expect(items.map((i) => i.str)).toEqual(["Al-Ahsa"]);
  });

  it("falls back to getTextContent when streamTextContent itself throws", async () => {
    const page = {
      streamTextContent: () => {
        throw new Error("stream unavailable");
      },
      getTextContent: async () => ({ items: [{ str: "Jeddah" }] }),
    };

    const items = await readPdfPageTextItems(page);

    expect(items.map((i) => i.str)).toEqual(["Jeddah"]);
  });

  it("tolerates a page whose text content has no items array", async () => {
    const page = { getTextContent: async () => ({}) };

    await expect(readPdfPageTextItems(page)).resolves.toEqual([]);
  });
});

describe("looksLikeReadableText — the raw-byte scraper must not pose as a resume", () => {
  // Long enough to clear the caller's 100-character threshold, which is precisely
  // why length alone was never a sufficient gate.
  const resumeProse = [
    "ABDULLAH BIN AHMED AI Product Engineer Riyadh Saudi Arabia",
    "Founder and AI Product Engineer at Watheq in Riyadh Saudi Arabia",
    "Data Analyst and Senior Sales Specialist at Alghalia in Al-Ahsa Saudi Arabia",
    "Pipefitting Technician at CB and I in Dammam Saudi Arabia",
    "Certifications Claude 101 Anthropic Academy Google Data Analytics Coursera",
  ].join("\n");

  it("accepts real resume prose", () => {
    expect(looksLikeReadableText(resumeProse)).toBe(true);
  });

  it("accepts Arabic resume prose", () => {
    const arabic = Array.from(
      { length: 30 },
      () => "المملكة العربية السعودية الرياض مهندس منتجات الذكاء الاصطناعي",
    ).join(" ");

    expect(looksLikeReadableText(arabic)).toBe(true);
  });

  it("rejects control-character noise from a compressed content stream", () => {
    const noise = Array.from({ length: 400 }, (_, i) => String.fromCharCode((i % 30) + 1)).join("");

    expect(looksLikeReadableText(noise)).toBe(false);
  });

  it("rejects symbol soup that contains too few real words", () => {
    const soup = Array.from({ length: 60 }, () => "?#%&*+=~^").join(" ");

    expect(looksLikeReadableText(soup)).toBe(false);
  });

  it("rejects output too short to be a resume, so the file goes to the server", () => {
    expect(looksLikeReadableText("Abdullah Bin Ahmed")).toBe(false);
  });

  it("rejects an empty or non-string value", () => {
    expect(looksLikeReadableText("")).toBe(false);
    expect(looksLikeReadableText(undefined as unknown as string)).toBe(false);
  });
});
