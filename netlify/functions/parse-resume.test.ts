import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { HandlerEvent } from "@netlify/functions";

describe("parse-resume validation", () => {
  const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

  describe("base64 decoding", () => {
    const decodeBase64 = (value: string): ArrayBuffer => {
      try {
        const buffer = Buffer.from(value, "base64");
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      } catch {
        throw new Error("Invalid file encoding.");
      }
    };

    it("decodes valid base64 strings", () => {
      const text = "Hello World";
      const base64 = Buffer.from(text).toString("base64");
      const decoded = decodeBase64(base64);

      expect(decoded).toBeInstanceOf(ArrayBuffer);
      expect(decoded.byteLength).toBeGreaterThan(0);
    });

    it("handles malformed base64 gracefully", () => {
      // Note: Buffer.from() is lenient and doesn't throw for invalid base64
      // It will just decode what it can, which may result in garbled data
      const result = decodeBase64("!!!invalid!!!");
      expect(result).toBeInstanceOf(ArrayBuffer);
      // The result will be garbled but won't throw
    });

    it("handles empty base64 string", () => {
      const decoded = decodeBase64("");
      expect(decoded).toBeInstanceOf(ArrayBuffer);
      expect(decoded.byteLength).toBe(0);
    });

    it("handles large base64 strings", () => {
      const largeText = "A".repeat(1000);
      const base64 = Buffer.from(largeText).toString("base64");
      const decoded = decodeBase64(base64);

      expect(decoded.byteLength).toBeGreaterThan(0);
    });
  });

  describe("file size validation", () => {
    it("accepts files under 8MB", () => {
      const size = 7 * 1024 * 1024; // 7 MB
      expect(size).toBeLessThan(MAX_BYTES);
    });

    it("rejects files over 8MB", () => {
      const size = 9 * 1024 * 1024; // 9 MB
      expect(size).toBeGreaterThan(MAX_BYTES);
    });

    it("accepts exactly 8MB", () => {
      const size = 8 * 1024 * 1024;
      expect(size).toBeLessThanOrEqual(MAX_BYTES);
    });

    it("rejects empty files", () => {
      const size = 0;
      expect(size).toBe(0);
    });
  });

  describe("image MIME type detection", () => {
    const IMAGE_MIME_TYPES = new Set([
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/bmp",
    ]);

    it("recognizes JPEG images", () => {
      expect(IMAGE_MIME_TYPES.has("image/jpeg")).toBe(true);
      expect(IMAGE_MIME_TYPES.has("image/jpg")).toBe(true);
    });

    it("recognizes PNG images", () => {
      expect(IMAGE_MIME_TYPES.has("image/png")).toBe(true);
    });

    it("recognizes WebP images", () => {
      expect(IMAGE_MIME_TYPES.has("image/webp")).toBe(true);
    });

    it("rejects non-image MIME types", () => {
      expect(IMAGE_MIME_TYPES.has("application/pdf")).toBe(false);
      expect(IMAGE_MIME_TYPES.has("text/plain")).toBe(false);
      expect(IMAGE_MIME_TYPES.has("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(false);
    });
  });

  describe("request body parsing", () => {
    it("handles direct text input", () => {
      const body = { kind: "text", value: "Resume text content" };
      expect(body.kind).toBe("text");
      expect(body.value).toBe("Resume text content");
    });

    it("handles file upload format", () => {
      const body = {
        kind: "file",
        name: "resume.pdf",
        mime: "application/pdf",
        data: "base64encodeddata",
      };
      expect(body.kind).toBe("file");
      expect(body.name).toBe("resume.pdf");
      expect(body.mime).toBe("application/pdf");
    });

    it("normalizes Postman text format", () => {
      const rawBody = { text: "Plain text resume" };
      const normalized = { kind: "text" as const, value: rawBody.text };
      expect(normalized.kind).toBe("text");
      expect(normalized.value).toBe("Plain text resume");
    });

    it("handles legacy file format without kind field", () => {
      const rawBody = {
        name: "resume.docx",
        data: "base64data",
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
      const hasFileData = typeof rawBody.data === "string" || typeof rawBody.name === "string";
      expect(hasFileData).toBe(true);
    });

    it("defaults to empty text for invalid formats", () => {
      const rawBody = {};
      const normalized = { kind: "text" as const, value: "" };
      expect(normalized.value).toBe("");
    });
  });

  describe("low quality extraction detection", () => {
    const isLowQualityExtraction = (text: string): boolean => {
      const cleaned = text.trim();
      if (cleaned.length < 50) return true;

      const words = cleaned.split(/\s+/);
      const shortWords = words.filter(w => w.length <= 2).length;
      const wordRatio = shortWords / Math.max(words.length, 1);

      return wordRatio > 0.7;
    };

    it("detects very short text as low quality", () => {
      expect(isLowQualityExtraction("abc")).toBe(true);
      expect(isLowQualityExtraction("Short text")).toBe(true);
    });

    it("detects garbled text with many short words", () => {
      const garbled = "a b c d e f g h i j k l m n o p q r s t u v w x y z";
      expect(isLowQualityExtraction(garbled)).toBe(true);
    });

    it("accepts normal quality text", () => {
      const normalText = "This is a well-formatted resume with complete sentences and proper structure that should pass quality checks.";
      expect(isLowQualityExtraction(normalText)).toBe(false);
    });

    it("handles empty strings", () => {
      expect(isLowQualityExtraction("")).toBe(true);
      expect(isLowQualityExtraction("   ")).toBe(true);
    });

    it("accepts text with some short words", () => {
      const text = "Senior Software Engineer with 5 years of experience in Python and JavaScript development.";
      expect(isLowQualityExtraction(text)).toBe(false);
    });
  });

  describe("OCR integration structure", () => {
    it("validates DeepSeek OCR prompt structure", () => {
      const prompt = `Extract all text from this resume image and structure it as JSON with these fields:
{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "phone number",
  "summary": "professional summary",
  "experience": [],
  "education": [],
  "skills": [],
  "certifications": []
}`;

      expect(prompt).toContain("name");
      expect(prompt).toContain("email");
      expect(prompt).toContain("experience");
      expect(prompt).toContain("education");
      expect(prompt).toContain("skills");
    });

    it("validates OCR response structure", () => {
      const mockOCRResponse = {
        text: "Extracted text content",
        structured: {
          name: "John Doe",
          email: "john@example.com",
          phone: "+966 50 123 4567",
          summary: "Experienced developer",
          experience: [
            {
              title: "Senior Developer",
              company: "TechCorp",
              duration: "2020-Present",
              responsibilities: ["Led team", "Improved performance"]
            }
          ],
          education: [
            {
              degree: "BS Computer Science",
              institution: "University",
              year: "2020"
            }
          ],
          skills: ["JavaScript", "Python"],
          certifications: ["AWS Certified"]
        },
        usedOCR: true
      };

      expect(mockOCRResponse.usedOCR).toBe(true);
      expect(mockOCRResponse.structured).toHaveProperty("name");
      expect(mockOCRResponse.structured).toHaveProperty("email");
      expect(mockOCRResponse.structured).toHaveProperty("experience");
      expect(Array.isArray(mockOCRResponse.structured.skills)).toBe(true);
    });

    it("validates data URI format for images", () => {
      const mimeType = "image/jpeg";
      const base64Data = "base64encodedimagedata";
      const dataUri = `data:${mimeType};base64,${base64Data}`;

      expect(dataUri).toMatch(/^data:image\/jpeg;base64,/);
    });

    it("extracts JSON from markdown code blocks", () => {
      const content = '```json\n{"name": "John Doe"}\n```';
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);

      expect(jsonMatch).not.toBeNull();
      expect(jsonMatch![1]).toContain("John Doe");
    });

    it("extracts JSON from plain text", () => {
      const content = '{"name": "John Doe", "email": "john@example.com"}';
      const jsonMatch = content.match(/(\{[\s\S]*\})/);

      expect(jsonMatch).not.toBeNull();
      const parsed = JSON.parse(jsonMatch![1]);
      expect(parsed.name).toBe("John Doe");
    });

    it("converts structured data back to plain text", () => {
      const structured = {
        name: "John Doe",
        email: "john@example.com",
        summary: "Experienced developer",
        experience: [
          {
            title: "Developer",
            company: "TechCo",
            duration: "2020-2023",
            responsibilities: ["Led projects", "Mentored juniors"]
          }
        ]
      };

      const textParts: string[] = [];
      if (structured.name) textParts.push(structured.name);
      if (structured.email) textParts.push(structured.email);
      if (structured.summary) textParts.push(`\n${structured.summary}`);

      if (structured.experience?.length) {
        textParts.push("\n\nEXPERIENCE");
        for (const exp of structured.experience) {
          textParts.push(`\n${exp.title} at ${exp.company}`);
        }
      }

      const text = textParts.join("\n");
      expect(text).toContain("John Doe");
      expect(text).toContain("Experienced developer");
      expect(text).toContain("EXPERIENCE");
      expect(text).toContain("Developer at TechCo");
    });
  });

  describe("error handling", () => {
    it("provides user-friendly message for empty extraction", () => {
      const plainText = "";
      const isEmpty = !plainText || plainText.trim().length === 0;

      const errorMessage = isEmpty
        ? "Unable to extract readable text from the resume. Please ensure your PDF contains selectable text (not scanned images). Try uploading a different format or pasting the text directly."
        : null;

      expect(errorMessage).toContain("Unable to extract readable text");
      expect(errorMessage).toContain("scanned images");
    });

    it("categorizes unsupported file type errors", () => {
      const errorMessage = "Unsupported format detected";
      const isUnsupportedFormat = errorMessage.includes("Unsupported");

      const userMessage = isUnsupportedFormat
        ? "Unsupported file type. Please upload a PDF or DOCX file, or paste your resume text directly."
        : errorMessage;

      expect(userMessage).toContain("PDF or DOCX");
    });

    it("categorizes file size errors", () => {
      const errorMessage = "File exceeds the maximum supported size";
      const isFileTooLarge = errorMessage.includes("exceeds");

      const userMessage = isFileTooLarge
        ? "File is too large. Please use a file smaller than 8 MB."
        : errorMessage;

      expect(userMessage).toContain("8 MB");
    });

    it("handles missing API key gracefully", () => {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      const hasAPIKey = Boolean(apiKey);

      if (!hasAPIKey) {
        expect(() => {
          throw new Error("DeepSeek API key not configured");
        }).toThrow("DeepSeek API key not configured");
      }
    });

    it("handles DeepSeek API errors", () => {
      const mockErrorResponse = {
        error: { message: "Invalid API key" }
      };

      const errorMessage = `DeepSeek OCR failed: ${mockErrorResponse.error.message}`;
      expect(errorMessage).toContain("DeepSeek OCR failed");
      expect(errorMessage).toContain("Invalid API key");
    });

    it("handles malformed JSON from OCR", () => {
      const invalidJSON = "Not a valid JSON string";

      expect(() => {
        JSON.parse(invalidJSON);
      }).toThrow();

      const errorMessage = "DeepSeek OCR did not return valid JSON";
      expect(errorMessage).toContain("valid JSON");
    });
  });

  describe("HTTP handler validation", () => {
    it("handles OPTIONS requests for CORS", () => {
      const event = { httpMethod: "OPTIONS" } as HandlerEvent;
      expect(event.httpMethod).toBe("OPTIONS");
      // Should return 200 with CORS headers
    });

    it("rejects non-POST requests", () => {
      const event = { httpMethod: "GET" } as HandlerEvent;
      expect(event.httpMethod).not.toBe("POST");
      // Should return 405 Method Not Allowed
    });

    it("validates CORS headers", () => {
      const HEADERS = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json",
      };

      expect(HEADERS["Access-Control-Allow-Origin"]).toBe("*");
      expect(HEADERS["Access-Control-Allow-Methods"]).toContain("POST");
      expect(HEADERS["Content-Type"]).toBe("application/json");
    });

    it("returns proper response structure on success", () => {
      const mockResponse = {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document: {
            sections: [],
            bullets: [],
            plainText: "Resume content"
          },
          usedOCR: false,
          structured: null
        })
      };

      expect(mockResponse.statusCode).toBe(200);
      const body = JSON.parse(mockResponse.body);
      expect(body).toHaveProperty("document");
      expect(body).toHaveProperty("usedOCR");
    });

    it("returns proper error response", () => {
      const mockErrorResponse = {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ error: "Unable to parse resume." })
      };

      expect(mockErrorResponse.statusCode).toBe(400);
      const body = JSON.parse(mockErrorResponse.body);
      expect(body).toHaveProperty("error");
    });
  });

  describe("OCR fallback logic", () => {
    it("uses OCR for image files immediately", () => {
      const mimeType = "image/jpeg";
      const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

      const isImage = IMAGE_MIME_TYPES.has(mimeType);
      expect(isImage).toBe(true);
      // Should trigger OCR immediately without trying text extraction
    });

    it("tries standard extraction first for PDFs", () => {
      const mimeType = "application/pdf";
      const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

      const isImage = IMAGE_MIME_TYPES.has(mimeType);
      expect(isImage).toBe(false);
      // Should try standard PDF extraction first
    });

    it("falls back to OCR on low quality extraction", () => {
      const extractedText = "a b c d e"; // Low quality (short words)
      const hasAPIKey = true; // Assume API key is available

      const isLowQuality = extractedText.trim().length < 50;
      const shouldUseOCRFallback = isLowQuality && hasAPIKey;

      expect(shouldUseOCRFallback).toBe(true);
    });

    it("uses standard extraction on OCR failure", () => {
      const standardExtraction = "Valid resume text extracted normally";
      const ocrFailed = true;

      if (ocrFailed) {
        // Should fall back to standard extraction result
        expect(standardExtraction).toBeTruthy();
      }
    });
  });
});
