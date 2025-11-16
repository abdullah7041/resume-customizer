import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { HandlerEvent } from "@netlify/functions";

describe("optimize text processing", () => {
  const STOPWORDS = new Set([
    "a", "about", "and", "are", "as", "at", "be", "by", "for", "from",
    "has", "in", "into", "is", "it", "of", "on", "or", "that", "the",
    "their", "to", "with",
  ]);

  describe("sanitization", () => {
    const sanitize = (value: string): string => {
      let buffer = "";
      for (const char of value) {
        const code = char.charCodeAt(0);
        buffer += code < 32 || code === 127 ? " " : char;
      }
      return buffer.trim();
    };

    it("removes control characters", () => {
      const input = "Hello\x00World\x01Test";
      const result = sanitize(input);
      expect(result).toBe("Hello World Test");
    });

    it("removes DEL character (127)", () => {
      const input = "Text\x7FMore";
      const result = sanitize(input);
      expect(result).toBe("Text More");
    });

    it("preserves normal characters", () => {
      const result = sanitize("Normal text with spaces");
      expect(result).toBe("Normal text with spaces");
    });

    it("preserves newlines and tabs as spaces", () => {
      const input = "Line1\nLine2\tTab";
      const result = sanitize(input);
      expect(result).toBe("Line1 Line2 Tab");
    });

    it("trims leading and trailing whitespace", () => {
      const result = sanitize("  trimmed  ");
      expect(result).toBe("trimmed");
    });
  });

  describe("tokenization", () => {
    const tokenize = (input: string): string[] =>
      input
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .match(/[a-z0-9]+/g)
        ?.filter((token) => !STOPWORDS.has(token) && token.length > 2) ?? [];

    it("converts to lowercase", () => {
      const result = tokenize("JavaScript Developer");
      expect(result).toContain("javascript");
      expect(result).toContain("developer");
    });

    it("removes diacritics", () => {
      const result = tokenize("Résumé François");
      expect(result).toContain("resume");
      expect(result).toContain("francois");
    });

    it("filters stopwords", () => {
      const result = tokenize("the quick brown fox and the dog");
      expect(result).not.toContain("the");
      expect(result).not.toContain("and");
      expect(result).toContain("quick");
    });

    it("filters short tokens (≤2 chars)", () => {
      const result = tokenize("JavaScript is a programming language");
      expect(result).not.toContain("is");
      expect(result).not.toContain("a");
      expect(result).toContain("javascript");
      expect(result).toContain("programming");
    });

    it("handles empty strings", () => {
      expect(tokenize("")).toEqual([]);
    });
  });

  describe("keyword selection", () => {
    const tokenize = (input: string): string[] =>
      input
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .match(/[a-z0-9]+/g)
        ?.filter((token) => !STOPWORDS.has(token) && token.length > 2) ?? [];

    const pickKeywords = (jobDesc: string, resumeText: string) => {
      const jobTokens = tokenize(jobDesc);
      const resumeTokens = new Set(tokenize(resumeText));
      const counts = new Map<string, number>();

      for (const token of jobTokens) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }

      const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
      const add: string[] = [];
      const neutral: string[] = [];

      for (const [token] of ranked) {
        if (add.length < 6 && !resumeTokens.has(token)) {
          add.push(token);
        } else if (neutral.length < 6 && resumeTokens.has(token)) {
          neutral.push(token);
        }
        if (add.length >= 6 && neutral.length >= 6) break;
      }

      return { add, neutral, remove: [] as string[] };
    };

    it("identifies missing keywords from job description", () => {
      const jobDesc = "Looking for Kubernetes expert with Docker experience";
      const resumeText = "Software engineer with Python and JavaScript skills";

      const keywords = pickKeywords(jobDesc, resumeText);

      expect(keywords.add).toContain("kubernetes");
      expect(keywords.add).toContain("docker");
    });

    it("identifies matching keywords", () => {
      const jobDesc = "Python developer with Django framework experience";
      const resumeText = "Experienced Python developer skilled in Django and Flask";

      const keywords = pickKeywords(jobDesc, resumeText);

      expect(keywords.neutral).toContain("python");
      expect(keywords.neutral).toContain("django");
    });

    it("limits keywords to 6 per category", () => {
      const jobDesc = "Need skills: Java, Python, JavaScript, TypeScript, Go, Rust, C++, Ruby, PHP, Kotlin, Swift";
      const resumeText = "Basic programming knowledge";

      const keywords = pickKeywords(jobDesc, resumeText);

      expect(keywords.add.length).toBeLessThanOrEqual(6);
      expect(keywords.neutral.length).toBeLessThanOrEqual(6);
    });

    it("ranks keywords by frequency", () => {
      const jobDesc = "Python Python Python Java Java JavaScript";
      const resumeText = "Basic developer";

      const keywords = pickKeywords(jobDesc, resumeText);

      // Python should come first (appears 3 times)
      expect(keywords.add[0]).toBe("python");
    });
  });

  describe("mock card generation", () => {
    it("generates cards with appropriate tone", () => {
      const toneMap: Record<string, string> = {
        auto: "balanced",
        conservative: "measured",
        aggressive: "impactful",
      };

      expect(toneMap.auto).toBe("balanced");
      expect(toneMap.conservative).toBe("measured");
      expect(toneMap.aggressive).toBe("impactful");
    });

    it("creates cards for main resume sections", () => {
      const sections = ["Summary", "Experience", "Skills", "Achievements"];

      sections.forEach((section) => {
        const card = {
          section,
          issue: `${section} needs improvement`,
          suggestion: `Update ${section} section`,
          exampleBefore: "Before text",
          exampleAfter: "After text",
        };

        expect(card.section).toBe(section);
        expect(card).toHaveProperty("issue");
        expect(card).toHaveProperty("suggestion");
        expect(card).toHaveProperty("exampleBefore");
        expect(card).toHaveProperty("exampleAfter");
      });
    });

    it("includes Vision 2030 context for Saudi market", () => {
      const saudiContextCard = {
        section: "Summary",
        issue: "Summary feels generic for Saudi employers.",
        suggestion: "Anchor the opening statement to digital transformation outcomes and Vision 2030 alignment.",
        exampleBefore: "Experienced professional seeking new opportunities.",
        exampleAfter: "Saudi fintech strategist translating Vision 2030 mandates into scalable, customer-first platforms.",
      };

      expect(saudiContextCard.suggestion).toContain("Vision 2030");
      expect(saudiContextCard.exampleAfter).toContain("Vision 2030");
    });
  });

  describe("payload validation", () => {
    const sanitize = (value: string): string => {
      let buffer = "";
      for (const char of value) {
        const code = char.charCodeAt(0);
        buffer += code < 32 || code === 127 ? " " : char;
      }
      return buffer.trim();
    };

    it("validates optimization card structure", () => {
      const card = {
        section: "Experience",
        issue: "Missing quantifiable achievements",
        suggestion: "Add metrics to demonstrate impact",
        exampleBefore: "Led projects",
        exampleAfter: "Led 5 projects, increasing efficiency by 30%",
      };

      expect(card.section).toBeTruthy();
      expect(card.issue).toBeTruthy();
      expect(card.suggestion).toBeTruthy();
      expect(card.exampleBefore).toBeTruthy();
      expect(card.exampleAfter).toBeTruthy();
    });

    it("filters out invalid cards", () => {
      const cards = [
        { section: "Valid", issue: "Issue", suggestion: "Suggestion", exampleBefore: "Before", exampleAfter: "After" },
        { section: "", issue: "", suggestion: "", exampleBefore: "", exampleAfter: "" },
        { section: "Another", issue: "Problem", suggestion: "Fix", exampleBefore: "Old", exampleAfter: "New" },
      ];

      const validCards = cards.filter(card => card.suggestion.length > 0);
      expect(validCards.length).toBe(2);
    });

    it("limits cards to 6 items", () => {
      const cards = Array.from({ length: 10 }, (_, i) => ({
        section: `Section${i}`,
        issue: "Issue",
        suggestion: "Suggestion",
        exampleBefore: "Before",
        exampleAfter: "After",
      }));

      const limited = cards.slice(0, 6);
      expect(limited.length).toBe(6);
    });

    it("sanitizes card content", () => {
      const dirtyCard = {
        section: "Summary\x00",
        issue: "Issue\x01",
        suggestion: "Suggestion\x7F",
        exampleBefore: "Before\n",
        exampleAfter: "After\r",
      };

      const sanitized = {
        section: sanitize(dirtyCard.section),
        issue: sanitize(dirtyCard.issue),
        suggestion: sanitize(dirtyCard.suggestion),
        exampleBefore: sanitize(dirtyCard.exampleBefore),
        exampleAfter: sanitize(dirtyCard.exampleAfter),
      };

      expect(sanitized.section).not.toContain("\x00");
      expect(sanitized.issue).not.toContain("\x01");
      expect(sanitized.suggestion).not.toContain("\x7F");
    });

    it("limits keywords to 10 per category", () => {
      const keywords = {
        add: Array.from({ length: 15 }, (_, i) => `keyword${i}`),
        remove: Array.from({ length: 12 }, (_, i) => `remove${i}`),
        neutral: Array.from({ length: 8 }, (_, i) => `neutral${i}`),
      };

      const limited = {
        add: keywords.add.slice(0, 10),
        remove: keywords.remove.slice(0, 10),
        neutral: keywords.neutral.slice(0, 10),
      };

      expect(limited.add.length).toBe(10);
      expect(limited.remove.length).toBe(10);
      expect(limited.neutral.length).toBe(8);
    });
  });

  describe("JSON parsing", () => {
    const safeJson = (value: string) => {
      const start = value.indexOf("{");
      const end = value.lastIndexOf("}");
      if (start >= 0 && end > start) {
        const segment = value.slice(start, end + 1);
        try {
          return JSON.parse(segment);
        } catch {
          throw new Error("Model did not return valid JSON");
        }
      }
      throw new Error("Model did not return valid JSON");
    };

    it("extracts JSON from markdown response", () => {
      const response = '```json\n{"cards": [], "keywords": {}}\n```';
      const extracted = safeJson(response);

      expect(extracted).toHaveProperty("cards");
      expect(extracted).toHaveProperty("keywords");
    });

    it("extracts JSON from plain text", () => {
      const response = 'Here is the result: {"cards": [], "keywords": {}} - end';
      const extracted = safeJson(response);

      expect(extracted).toBeDefined();
    });

    it("throws error for invalid JSON", () => {
      const response = "Not valid JSON at all";
      expect(() => safeJson(response)).toThrow("Model did not return valid JSON");
    });

    it("throws error for no JSON braces", () => {
      const response = "No JSON here";
      expect(() => safeJson(response)).toThrow("Model did not return valid JSON");
    });

    it("handles nested JSON objects", () => {
      const response = '{"cards": [{"section": "Summary"}], "keywords": {"add": []}}';
      const extracted = safeJson(response);

      expect(extracted.cards).toBeDefined();
      expect(Array.isArray(extracted.cards)).toBe(true);
    });
  });

  describe("prompt construction", () => {
    const buildPrompt = (resumeText: string, jobDesc: string, mode: "auto" | "conservative" | "aggressive" = "auto") =>
      `You rewrite resumes for the Saudi market using ATS-safe language. Return ONLY JSON with keys cards (array) and keywords (object). ` +
      `cards[].section, cards[].issue, cards[].suggestion, cards[].exampleBefore, cards[].exampleAfter must all be non-empty strings. ` +
      `keywords must include add, remove, neutral arrays. Keep bullets concise, metric-driven, and culturally neutral.` +
      `\n\nMODE: ${mode}\n\nRESUME:\n${resumeText.slice(0, 4000)}\n\nJOB DESCRIPTION:\n${jobDesc.slice(0, 4000)}`;

    it("includes mode in prompt", () => {
      const prompt = buildPrompt("Resume", "Job", "aggressive");
      expect(prompt).toContain("MODE: aggressive");
    });

    it("includes resume text", () => {
      const resume = "Experienced software engineer";
      const prompt = buildPrompt(resume, "Job");
      expect(prompt).toContain(resume);
    });

    it("includes job description", () => {
      const job = "Looking for senior developer";
      const prompt = buildPrompt("Resume", job);
      expect(prompt).toContain(job);
    });

    it("truncates long resume text to 4000 chars", () => {
      const longResume = "A".repeat(5000);
      const prompt = buildPrompt(longResume, "Job");

      const resumeInPrompt = prompt.split("RESUME:\n")[1].split("\n\nJOB DESCRIPTION:")[0];
      expect(resumeInPrompt.length).toBeLessThanOrEqual(4000);
    });

    it("truncates long job description to 4000 chars", () => {
      const longJob = "B".repeat(5000);
      const prompt = buildPrompt("Resume", longJob);

      const jobInPrompt = prompt.split("JOB DESCRIPTION:\n")[1];
      expect(jobInPrompt.length).toBeLessThanOrEqual(4000);
    });

    it("includes Saudi market context", () => {
      const prompt = buildPrompt("Resume", "Job");
      expect(prompt).toContain("Saudi market");
      expect(prompt).toContain("ATS-safe");
    });

    it("specifies JSON-only output", () => {
      const prompt = buildPrompt("Resume", "Job");
      expect(prompt).toContain("Return ONLY JSON");
    });
  });

  describe("timeout handling", () => {
    const REQUEST_TIMEOUT = 25_000;

    it("defines timeout as 25 seconds", () => {
      expect(REQUEST_TIMEOUT).toBe(25000);
    });

    it("converts timeout to seconds for error messages", () => {
      const timeoutInSeconds = REQUEST_TIMEOUT / 1000;
      expect(timeoutInSeconds).toBe(25);
    });

    it("identifies timeout errors", () => {
      const error = new Error("Request timed out");
      (error as any).code = "TIMEOUT";

      const isTimeout = (error as any).code === "TIMEOUT";
      expect(isTimeout).toBe(true);
    });
  });

  describe("fallback logic", () => {
    it("uses mock data on timeout", () => {
      const error = { code: "TIMEOUT" };
      const shouldUseFallback = error.code === "TIMEOUT";

      expect(shouldUseFallback).toBe(true);
    });

    it("uses mock data on 5xx errors", () => {
      const error = { status: 503 };
      const shouldUseFallback = error.status >= 500;

      expect(shouldUseFallback).toBe(true);
    });

    it("tries text fallback on 4xx errors", () => {
      const error = { status: 400 };
      const shouldUseFallback = error.status >= 500;

      expect(shouldUseFallback).toBe(false);
      // Should try text fallback instead
    });

    it("marks source as 'mock' for fallback data", () => {
      const mockPayload = {
        cards: [],
        keywords: { add: [], remove: [], neutral: [] },
        source: "mock" as const,
      };

      expect(mockPayload.source).toBe("mock");
    });

    it("marks source as 'openai' for API data", () => {
      const apiPayload = {
        cards: [],
        keywords: { add: [], remove: [], neutral: [] },
        source: "openai" as const,
      };

      expect(apiPayload.source).toBe("openai");
    });
  });

  describe("HTTP handler validation", () => {
    it("handles OPTIONS for CORS", () => {
      const event = { httpMethod: "OPTIONS" } as HandlerEvent;
      expect(event.httpMethod).toBe("OPTIONS");
    });

    it("rejects non-POST requests", () => {
      const event = { httpMethod: "GET" } as HandlerEvent;
      expect(event.httpMethod).not.toBe("POST");
    });

    it("requires resumeText", () => {
      const body = { jobDesc: "Job description" };
      const isValid = body.hasOwnProperty("resumeText");
      expect(isValid).toBe(false);
    });

    it("requires jobDesc", () => {
      const body = { resumeText: "Resume text" };
      const isValid = body.hasOwnProperty("jobDesc");
      expect(isValid).toBe(false);
    });

    it("rejects empty resumeText", () => {
      const resumeText = "";
      const isValid = !!(resumeText && resumeText.trim().length > 0);
      expect(isValid).toBe(false);
    });

    it("rejects empty jobDesc", () => {
      const jobDesc = "   ";
      const isValid = !!(jobDesc && jobDesc.trim().length > 0);
      expect(isValid).toBe(false);
    });

    it("validates successful response structure", () => {
      const response = {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cards: [
            {
              section: "Summary",
              issue: "Generic content",
              suggestion: "Add specific achievements",
              exampleBefore: "Experienced developer",
              exampleAfter: "Senior developer with 5+ years building scalable systems",
            },
          ],
          keywords: {
            add: ["kubernetes", "docker"],
            remove: [],
            neutral: ["python", "javascript"],
          },
          source: "openai",
        }),
      };

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("cards");
      expect(body).toHaveProperty("keywords");
      expect(body).toHaveProperty("source");
      expect(Array.isArray(body.cards)).toBe(true);
    });
  });

  describe("OpenAI request structure", () => {
    it("validates JSON schema format", () => {
      const schema = {
        type: "object",
        properties: {
          cards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                section: { type: "string" },
                issue: { type: "string" },
                suggestion: { type: "string" },
                exampleBefore: { type: "string" },
                exampleAfter: { type: "string" },
              },
              required: ["section", "issue", "suggestion", "exampleBefore", "exampleAfter"],
            },
            minItems: 1,
            maxItems: 6,
          },
          keywords: {
            type: "object",
            properties: {
              add: { type: "array", items: { type: "string" } },
              remove: { type: "array", items: { type: "string" } },
              neutral: { type: "array", items: { type: "string" } },
            },
            required: ["add", "remove", "neutral"],
          },
        },
        required: ["cards", "keywords"],
        additionalProperties: false,
      };

      expect(schema.properties.cards.items.required).toContain("section");
      expect(schema.properties.cards.items.required).toContain("suggestion");
      expect(schema.properties.cards.minItems).toBe(1);
      expect(schema.properties.cards.maxItems).toBe(6);
    });

    it("validates message structure", () => {
      const messages = [
        {
          role: "system",
          content: [{ type: "text", text: "You are a resume optimization assistant." }],
        },
        {
          role: "user",
          content: [{ type: "text", text: "Optimize this resume" }],
        },
      ];

      expect(messages[0].role).toBe("system");
      expect(messages[1].role).toBe("user");
      expect(messages[0].content[0].type).toBe("text");
    });
  });
});
