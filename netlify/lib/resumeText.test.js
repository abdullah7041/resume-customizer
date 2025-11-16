import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  inferMimeType,
  extractPlainTextFromArrayBuffer,
  isPdfMimeType,
  __internal,
} from "./resumeText.js";

describe("inferMimeType", () => {
  it("returns PDF mime type for .pdf extension", () => {
    expect(inferMimeType({ fileName: "resume.pdf" })).toBe("application/pdf");
    expect(inferMimeType({ fileName: "RESUME.PDF" })).toBe("application/pdf");
    expect(inferMimeType({ fileName: "my.resume.pdf" })).toBe("application/pdf");
  });

  it("returns DOCX mime type for .docx extension", () => {
    expect(inferMimeType({ fileName: "resume.docx" })).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(inferMimeType({ fileName: "RESUME.DOCX" })).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  });

  it("returns text/plain for .txt extension", () => {
    expect(inferMimeType({ fileName: "resume.txt" })).toBe("text/plain");
  });

  it("prefers explicit mimeType over fileName", () => {
    expect(
      inferMimeType({
        mimeType: "application/pdf",
        fileName: "resume.docx",
      })
    ).toBe("application/pdf");
  });

  it("strips charset from mimeType", () => {
    expect(
      inferMimeType({
        mimeType: "application/pdf; charset=utf-8",
      })
    ).toBe("application/pdf");
  });

  it("normalizes mimeType case and whitespace", () => {
    expect(
      inferMimeType({
        mimeType: "  APPLICATION/PDF  ",
      })
    ).toBe("application/pdf");
  });

  it("returns octet-stream for unknown extensions", () => {
    expect(inferMimeType({ fileName: "resume.xyz" })).toBe("application/octet-stream");
    expect(inferMimeType({ fileName: "no-extension" })).toBe("application/octet-stream");
    expect(inferMimeType({})).toBe("application/octet-stream");
  });

  it("handles missing or invalid inputs", () => {
    expect(inferMimeType()).toBe("application/octet-stream");
    expect(inferMimeType({ mimeType: "", fileName: "" })).toBe("application/octet-stream");
    expect(inferMimeType({ mimeType: "   ", fileName: "   " })).toBe("application/octet-stream");
  });
});

describe("isPdfMimeType", () => {
  it("returns true for PDF mime type", () => {
    expect(isPdfMimeType("application/pdf")).toBe(true);
    expect(isPdfMimeType("APPLICATION/PDF")).toBe(true);
    expect(isPdfMimeType("application/pdf; charset=utf-8")).toBe(true);
  });

  it("returns false for non-PDF mime types", () => {
    expect(isPdfMimeType("application/docx")).toBe(false);
    expect(isPdfMimeType("text/plain")).toBe(false);
    expect(isPdfMimeType("")).toBe(false);
    expect(isPdfMimeType(undefined)).toBe(false);
  });
});

describe("extractPlainTextFromArrayBuffer", () => {
  it("returns empty string for null or undefined input", async () => {
    expect(await extractPlainTextFromArrayBuffer(null)).toBe("");
    expect(await extractPlainTextFromArrayBuffer(undefined)).toBe("");
  });

  it("extracts UTF-8 text from plain text buffer", async () => {
    const text = "Hello World Resume\nExperience: 5 years";
    const encoder = new TextEncoder();
    const buffer = encoder.encode(text);

    const result = await extractPlainTextFromArrayBuffer(buffer.buffer, {
      mimeType: "text/plain",
    });

    expect(result).toBe(text);
  });

  it("handles Uint8Array views", async () => {
    const text = "John Doe\nSoftware Engineer";
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(text);

    const result = await extractPlainTextFromArrayBuffer(uint8Array, {
      mimeType: "text/plain",
    });

    expect(result).toBe(text);
  });

  it("handles empty buffer", async () => {
    const buffer = new ArrayBuffer(0);
    expect(await extractPlainTextFromArrayBuffer(buffer)).toBe("");
  });

  it("decodes UTF-8 with special characters", async () => {
    const text = "Résumé • François García";
    const encoder = new TextEncoder();
    const buffer = encoder.encode(text);

    const result = await extractPlainTextFromArrayBuffer(buffer.buffer, {
      mimeType: "text/plain",
    });

    expect(result).toBe(text);
  });

  it("defaults to text decoding for unknown mime types", async () => {
    const text = "Plain text content";
    const encoder = new TextEncoder();
    const buffer = encoder.encode(text);

    const result = await extractPlainTextFromArrayBuffer(buffer.buffer, {
      mimeType: "application/unknown",
    });

    expect(result).toBe(text);
  });
});

describe("__internal.decodePdfEscapes", () => {
  const { decodePdfEscapes } = __internal;

  it("decodes newline escape sequences", () => {
    expect(decodePdfEscapes("Hello\\nWorld")).toBe("Hello\nWorld");
  });

  it("decodes carriage return", () => {
    expect(decodePdfEscapes("Line 1\\rLine 2")).toBe("Line 1\rLine 2");
  });

  it("decodes tab characters", () => {
    expect(decodePdfEscapes("Name\\tTitle")).toBe("Name\tTitle");
  });

  it("decodes backspace and form feed", () => {
    expect(decodePdfEscapes("Test\\bBackspace")).toBe("Test\bBackspace");
    expect(decodePdfEscapes("Page\\fBreak")).toBe("Page\fBreak");
  });

  it("decodes escaped parentheses", () => {
    expect(decodePdfEscapes("\\(parentheses\\)")).toBe("(parentheses)");
  });

  it("decodes escaped backslash", () => {
    expect(decodePdfEscapes("Back\\\\slash")).toBe("Back\\slash");
  });

  it("decodes octal escape sequences", () => {
    expect(decodePdfEscapes("\\101")).toBe("A"); // Octal 101 = 65 = 'A'
    expect(decodePdfEscapes("\\102\\103")).toBe("BC"); // B and C
    expect(decodePdfEscapes("\\040")).toBe(" "); // Space
  });

  it("handles mixed escape sequences", () => {
    expect(decodePdfEscapes("Name: \\101\\102\\nTitle: \\(Senior\\)")).toBe(
      "Name: AB\nTitle: (Senior)"
    );
  });

  it("leaves non-escaped text unchanged", () => {
    expect(decodePdfEscapes("Plain text")).toBe("Plain text");
  });
});

describe("__internal.decodeHexString", () => {
  const { decodeHexString } = __internal;

  it("decodes hex string to UTF-8 text", () => {
    // "Hello" in hex: 48 65 6c 6c 6f
    expect(decodeHexString("48656c6c6f")).toBe("Hello");
  });

  it("handles uppercase hex", () => {
    expect(decodeHexString("48656C6C6F")).toBe("Hello");
  });

  it("handles hex with whitespace", () => {
    expect(decodeHexString("48 65 6c 6c 6f")).toBe("Hello");
    expect(decodeHexString("48  65  6c  6c  6f")).toBe("Hello");
  });

  it("pads odd-length hex strings", () => {
    // Odd length should get padded with 0
    expect(decodeHexString("48656c6c6")).toBe("Hell`");
  });

  it("handles empty hex string", () => {
    expect(decodeHexString("")).toBe("");
  });
});

describe("__internal.arrayBufferToLatin1", () => {
  const { arrayBufferToLatin1 } = __internal;

  it("converts ArrayBuffer to Latin-1 string", () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const result = arrayBufferToLatin1(bytes.buffer);
    expect(result).toBe("Hello");
  });

  it("handles large buffers with chunking", () => {
    // Create a buffer larger than chunk size (0x8000)
    const size = 0x10000; // 64KB
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      bytes[i] = 65; // 'A'
    }
    const result = arrayBufferToLatin1(bytes.buffer);
    expect(result.length).toBe(size);
    expect(result[0]).toBe("A");
    expect(result[size - 1]).toBe("A");
  });

  it("handles empty buffer", () => {
    const buffer = new ArrayBuffer(0);
    expect(arrayBufferToLatin1(buffer)).toBe("");
  });

  it("preserves byte values above 127", () => {
    const bytes = new Uint8Array([200, 201, 202]);
    const result = arrayBufferToLatin1(bytes.buffer);
    expect(result.charCodeAt(0)).toBe(200);
    expect(result.charCodeAt(1)).toBe(201);
    expect(result.charCodeAt(2)).toBe(202);
  });
});

describe("__internal.extractPdfTextFallback", () => {
  const { extractPdfTextFallback } = __internal;

  it("extracts text from simple PDF text blocks", () => {
    // Simplified PDF structure with BT/ET blocks
    const pdfContent = `BT
/F1 12 Tf
(John Doe) Tj
ET
BT
/F1 10 Tf
(Software Engineer) Tj
ET`;
    const encoder = new TextEncoder();
    const buffer = encoder.encode(pdfContent);

    const result = extractPdfTextFallback(buffer.buffer);
    expect(result).toContain("John Doe");
    expect(result).toContain("Software Engineer");
  });

  it("handles empty or invalid PDF buffers", () => {
    expect(extractPdfTextFallback(null)).toBe("");
    expect(extractPdfTextFallback(new ArrayBuffer(0))).toBe("");
  });

  it("extracts text with escape sequences", () => {
    const pdfContent = `BT
(Line 1\\nLine 2) Tj
ET`;
    const encoder = new TextEncoder();
    const buffer = encoder.encode(pdfContent);

    const result = extractPdfTextFallback(buffer.buffer);
    expect(result).toContain("Line 1");
    expect(result).toContain("Line 2");
  });

  it("extracts hex-encoded strings", () => {
    // <48656c6c6f> is "Hello" in hex
    const pdfContent = `BT
<48656c6c6f> Tj
ET`;
    const encoder = new TextEncoder();
    const buffer = encoder.encode(pdfContent);

    const result = extractPdfTextFallback(buffer.buffer);
    expect(result).toContain("Hello");
  });

  it("handles mixed string formats in one block", () => {
    const pdfContent = `BT
(Name: ) Tj
<4A6F686E> Tj
( ) Tj
(Doe) Tj
ET`;
    const encoder = new TextEncoder();
    const buffer = encoder.encode(pdfContent);

    const result = extractPdfTextFallback(buffer.buffer);
    expect(result).toContain("Name:");
    expect(result).toContain("John");
    expect(result).toContain("Doe");
  });

  it("falls back to stream extraction when no BT/ET blocks found", () => {
    const pdfContent = `stream
(Fallback text extraction)
endstream`;
    const encoder = new TextEncoder();
    const buffer = encoder.encode(pdfContent);

    const result = extractPdfTextFallback(buffer.buffer);
    expect(result).toContain("Fallback text extraction");
  });

  it("normalizes whitespace in extracted text", () => {
    const pdfContent = `BT
(Too    much    space) Tj
ET`;
    const encoder = new TextEncoder();
    const buffer = encoder.encode(pdfContent);

    const result = extractPdfTextFallback(buffer.buffer);
    expect(result).toBe("Too much space");
  });
});
