import { describe, expect, it } from "vitest";

import { extractPlainTextFromArrayBuffer, inferMimeType } from "../lib/resumeText.js";

describe("resume text helpers", () => {
  it("infers mime type from explicit value", () => {
    expect(inferMimeType({ mimeType: "application/pdf" })).toBe("application/pdf");
  });

  it("falls back to file extension when mime type missing", () => {
    expect(inferMimeType({ fileName: "resume.DOCX" })).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  });

  it("returns octet-stream when mime type unknown", () => {
    expect(inferMimeType({ fileName: "resume.unknown" })).toBe("application/octet-stream");
  });

  it("extracts text from simple pdf content", async () => {
    const pdfContent = `%PDF-1.3\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R >> endobj\n4 0 obj << /Length 55 >> stream\nBT /F1 12 Tf 72 100 Td (Hello Riyadh) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000067 00000 n \n0000000120 00000 n \n0000000203 00000 n \ntrailer << /Size 5 /Root 1 0 R >>\nstartxref\n250\n%%EOF`;
    const buffer = new TextEncoder().encode(pdfContent).buffer;
    const text = await extractPlainTextFromArrayBuffer(buffer, { mimeType: "application/pdf" });
    expect(text).toContain("Hello Riyadh");
  });

  it("decodes utf-8 text when not a pdf", async () => {
    const encoded = new TextEncoder().encode("Résumé تجربة").buffer;
    const text = await extractPlainTextFromArrayBuffer(encoded, { mimeType: "text/plain" });
    expect(text).toBe("Résumé تجربة");
  });
});
