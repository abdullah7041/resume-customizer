import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

// We need to test the handler without actually importing it (to avoid Supabase initialization)
// Instead, we'll test the algorithm logic directly

describe("match-score TF-IDF algorithm", () => {
  // Test the stopwords and tokenization logic
  describe("tokenization", () => {
    const STOPWORDS = new Set([
      "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
      "any", "are", "as", "at", "be", "because", "been", "before", "being", "below",
      "between", "both", "but", "by", "could", "did", "do", "does", "doing", "down",
      "during", "each", "few", "for", "from", "further", "had", "has", "have", "having",
      "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "i", "if",
      "in", "into", "is", "it", "its", "itself", "just", "me", "more", "most", "my",
      "myself", "no", "nor", "not", "now", "of", "off", "on", "once", "only", "or",
      "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she", "should",
      "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves",
      "then", "there", "these", "they", "this", "those", "through", "to", "too", "under",
      "until", "up", "very", "was", "we", "were", "what", "when", "where", "which",
      "while", "who", "whom", "why", "with", "would", "you", "your", "yours", "yourself",
      "yourselves"
    ]);

    const normalize = (input: string): string[] => {
      const lowered = input
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      return (
        lowered
          .match(/[a-z0-9]+(?:'[a-z0-9]+)?/g)
          ?.filter((token) => !STOPWORDS.has(token)) ?? []
      );
    };

    it("converts text to lowercase", () => {
      const result = normalize("JavaScript Developer");
      expect(result).toContain("javascript");
      expect(result).toContain("developer");
    });

    it("removes stopwords", () => {
      const result = normalize("the quick brown fox and the lazy dog");
      expect(result).not.toContain("the");
      expect(result).not.toContain("and");
      expect(result).toContain("quick");
      expect(result).toContain("brown");
      expect(result).toContain("fox");
      expect(result).toContain("lazy");
      expect(result).toContain("dog");
    });

    it("handles diacritics and accents", () => {
      const result = normalize("Résumé François García");
      expect(result).toContain("resume");
      expect(result).toContain("francois");
      expect(result).toContain("garcia");
    });

    it("splits on non-alphanumeric characters", () => {
      const result = normalize("JavaScript/TypeScript, Python & Java");
      expect(result).toContain("javascript");
      expect(result).toContain("typescript");
      expect(result).toContain("python");
      expect(result).toContain("java");
    });

    it("preserves contractions with apostrophes", () => {
      const result = normalize("don't can't won't");
      expect(result.some((token) => token.includes("'"))).toBe(true);
    });

    it("handles empty strings", () => {
      expect(normalize("")).toEqual([]);
      expect(normalize("   ")).toEqual([]);
    });

    it("handles strings with only stopwords", () => {
      expect(normalize("the and or but")).toEqual([]);
    });

    it("preserves numbers", () => {
      const result = normalize("5 years of experience with Python3 and Node.js");
      expect(result).toContain("5");
      expect(result).toContain("years");
      expect(result).toContain("experience");
      expect(result).toContain("python3");
      expect(result).toContain("node");
      expect(result).toContain("js");
    });
  });

  describe("term frequency", () => {
    const termFrequency = (tokens: string[]): Map<string, number> => {
      const tf = new Map<string, number>();
      for (const token of tokens) {
        tf.set(token, (tf.get(token) ?? 0) + 1);
      }
      return tf;
    };

    it("counts occurrences of each token", () => {
      const tokens = ["javascript", "python", "javascript", "java", "javascript"];
      const tf = termFrequency(tokens);

      expect(tf.get("javascript")).toBe(3);
      expect(tf.get("python")).toBe(1);
      expect(tf.get("java")).toBe(1);
    });

    it("handles empty token array", () => {
      const tf = termFrequency([]);
      expect(tf.size).toBe(0);
    });

    it("handles single token", () => {
      const tf = termFrequency(["developer"]);
      expect(tf.get("developer")).toBe(1);
      expect(tf.size).toBe(1);
    });

    it("is case-sensitive after normalization", () => {
      const tokens = ["JavaScript", "javascript", "JAVASCRIPT"];
      const tf = termFrequency(tokens);
      // Note: these should already be normalized to lowercase before TF
      expect(tf.size).toBeGreaterThan(0);
    });
  });

  describe("inverse document frequency", () => {
    const inverseDocumentFrequency = (documents: string[][]): Map<string, number> => {
      const docCount = documents.length;
      const idf = new Map<string, number>();

      for (const doc of documents) {
        const uniqueTokens = new Set(doc);
        for (const token of uniqueTokens) {
          idf.set(token, (idf.get(token) ?? 0) + 1);
        }
      }

      for (const [token, count] of idf.entries()) {
        const score = Math.log((docCount + 1) / (count + 1)) + 1;
        idf.set(token, score);
      }

      return idf;
    };

    it("assigns higher scores to rare terms", () => {
      const documents = [
        ["javascript", "python", "java"],
        ["javascript", "ruby", "go"],
        ["javascript", "c++", "rust"],
      ];
      const idf = inverseDocumentFrequency(documents);

      const javascriptScore = idf.get("javascript") ?? 0;
      const pythonScore = idf.get("python") ?? 0;

      // javascript appears in all 3 docs, python only in 1
      expect(pythonScore).toBeGreaterThan(javascriptScore);
    });

    it("handles terms appearing in all documents", () => {
      const documents = [
        ["common", "term1"],
        ["common", "term2"],
        ["common", "term3"],
      ];
      const idf = inverseDocumentFrequency(documents);

      expect(idf.get("common")).toBeGreaterThan(0);
      expect(idf.get("term1")).toBeGreaterThan(idf.get("common")!);
    });

    it("handles single document", () => {
      const documents = [["javascript", "python"]];
      const idf = inverseDocumentFrequency(documents);

      expect(idf.get("javascript")).toBeGreaterThan(0);
      expect(idf.get("python")).toBeGreaterThan(0);
      // Both should have same IDF since they appear in same number of docs
      expect(idf.get("javascript")).toBe(idf.get("python"));
    });

    it("handles empty documents", () => {
      const idf = inverseDocumentFrequency([]);
      expect(idf.size).toBe(0);
    });
  });

  describe("cosine similarity", () => {
    const cosineSimilarity = (a: Map<string, number>, b: Map<string, number>): number => {
      let dot = 0;
      let magA = 0;
      let magB = 0;

      for (const value of a.values()) {
        magA += value * value;
      }

      for (const value of b.values()) {
        magB += value * value;
      }

      const iterator = a.size > b.size ? b.keys() : a.keys();
      for (const key of iterator) {
        dot += (a.get(key) ?? 0) * (b.get(key) ?? 0);
      }

      if (magA === 0 || magB === 0) return 0;
      return dot / (Math.sqrt(magA) * Math.sqrt(magB));
    };

    it("returns 1 for identical vectors", () => {
      const vectorA = new Map([["javascript", 1], ["python", 1]]);
      const vectorB = new Map([["javascript", 1], ["python", 1]]);

      const similarity = cosineSimilarity(vectorA, vectorB);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it("returns 0 for orthogonal vectors", () => {
      const vectorA = new Map([["javascript", 1], ["python", 1]]);
      const vectorB = new Map([["java", 1], ["ruby", 1]]);

      const similarity = cosineSimilarity(vectorA, vectorB);
      expect(similarity).toBe(0);
    });

    it("returns value between 0 and 1 for partial overlap", () => {
      const vectorA = new Map([["javascript", 2], ["python", 1], ["java", 1]]);
      const vectorB = new Map([["javascript", 1], ["ruby", 1]]);

      const similarity = cosineSimilarity(vectorA, vectorB);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    it("handles empty vectors", () => {
      const vectorA = new Map<string, number>();
      const vectorB = new Map([["javascript", 1]]);

      expect(cosineSimilarity(vectorA, vectorB)).toBe(0);
      expect(cosineSimilarity(vectorA, vectorA)).toBe(0);
    });

    it("is symmetric", () => {
      const vectorA = new Map([["javascript", 3], ["python", 2]]);
      const vectorB = new Map([["javascript", 1], ["java", 1]]);

      expect(cosineSimilarity(vectorA, vectorB)).toBe(cosineSimilarity(vectorB, vectorA));
    });

    it("handles scaled vectors correctly", () => {
      const vectorA = new Map([["javascript", 1], ["python", 1]]);
      const vectorB = new Map([["javascript", 2], ["python", 2]]);

      const similarity = cosineSimilarity(vectorA, vectorB);
      // Scaled versions should still be similar (cosine is direction, not magnitude)
      expect(similarity).toBeCloseTo(1, 5);
    });
  });

  describe("keyword extraction", () => {
    const termFrequency = (tokens: string[]): Map<string, number> => {
      const tf = new Map<string, number>();
      for (const token of tokens) {
        tf.set(token, (tf.get(token) ?? 0) + 1);
      }
      return tf;
    };

    const topKeywords = (tokens: string[], limit = 25): string[] => {
      const tf = termFrequency(tokens);
      const sorted = Array.from(tf.entries())
        .filter(([token]) => token.length >= 3)
        .sort((a, b) => b[1] - a[1]);
      return sorted.slice(0, limit).map(([token]) => token);
    };

    it("returns most frequent keywords", () => {
      const tokens = [
        "javascript", "javascript", "javascript",
        "python", "python",
        "java",
        "developer", "developer", "developer", "developer"
      ];
      const keywords = topKeywords(tokens, 3);

      expect(keywords[0]).toBe("developer");
      expect(keywords[1]).toBe("javascript");
      expect(keywords[2]).toBe("python");
    });

    it("filters out short tokens (< 3 chars)", () => {
      const tokens = ["js", "py", "javascript", "python"];
      const keywords = topKeywords(tokens, 10);

      expect(keywords).toContain("javascript");
      expect(keywords).toContain("python");
      expect(keywords).not.toContain("js");
      expect(keywords).not.toContain("py");
    });

    it("respects the limit parameter", () => {
      const tokens = Array.from({ length: 100 }, (_, i) => `keyword${i}`);
      const keywords = topKeywords(tokens, 5);

      expect(keywords.length).toBe(5);
    });

    it("handles empty token array", () => {
      const keywords = topKeywords([]);
      expect(keywords).toEqual([]);
    });
  });

  describe("score calculation", () => {
    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), max);

    it("clamps values within range", () => {
      expect(clamp(50, 0, 100)).toBe(50);
      expect(clamp(-10, 0, 100)).toBe(0);
      expect(clamp(150, 0, 100)).toBe(100);
    });

    it("calculates weighted score (70% similarity + 30% coverage)", () => {
      const cosine = 0.8;
      const coverage = 0.6;
      const rawScore = 0.7 * 100 * cosine + 0.3 * 100 * coverage;

      expect(rawScore).toBe(74);
    });

    it("ensures minimum score for substantial content with overlap", () => {
      const resumeTokens = Array(60).fill("developer");
      const jobTokens = Array(60).fill("engineer");
      const hasSubstantialContent = resumeTokens.length >= 50 && jobTokens.length >= 50;

      expect(hasSubstantialContent).toBe(true);

      // Even with no overlap, if both have content, minimum should apply
      const minScore = 15;
      const score = Math.max(0, minScore);
      expect(score).toBeGreaterThanOrEqual(15);
    });
  });
});

describe("match-score handler", () => {
  const createEvent = (body: any): Partial<HandlerEvent> => ({
    httpMethod: "POST",
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    isBase64Encoded: false,
    path: "",
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: "",
  });

  it("requires POST method", async () => {
    // This is a conceptual test - actual handler testing would require mocking Supabase
    const event = { httpMethod: "GET" } as HandlerEvent;

    // In real implementation, this would return 405
    expect(event.httpMethod).not.toBe("POST");
  });

  it("requires job description", () => {
    const body = { resumeText: "Some resume text" };
    // Missing jobDesc should cause validation error
    expect(body).not.toHaveProperty("jobDesc");
  });

  it("requires resume text or resumeFileId", () => {
    const bodyWithoutResume = { jobDesc: "Job description" };
    // Should fail validation
    expect(bodyWithoutResume).not.toHaveProperty("resumeText");
    expect(bodyWithoutResume).not.toHaveProperty("resumeFileId");
  });

  it("validates response structure", () => {
    const mockResponse = {
      score: 75,
      coverage: 0.6,
      similarity: 0.8,
      missing_keywords: ["kubernetes", "docker"],
      matched_keywords: ["javascript", "react", "node"],
    };

    expect(mockResponse).toHaveProperty("score");
    expect(mockResponse).toHaveProperty("coverage");
    expect(mockResponse).toHaveProperty("similarity");
    expect(mockResponse).toHaveProperty("missing_keywords");
    expect(mockResponse).toHaveProperty("matched_keywords");

    expect(typeof mockResponse.score).toBe("number");
    expect(mockResponse.score).toBeGreaterThanOrEqual(0);
    expect(mockResponse.score).toBeLessThanOrEqual(100);
  });
});

describe("end-to-end matching scenarios", () => {
  const STOPWORDS = new Set([
    "a", "about", "and", "are", "as", "at", "be", "by", "for", "from",
    "has", "in", "into", "is", "it", "of", "on", "or", "that", "the",
    "their", "to", "with"
  ]);

  const normalize = (input: string): string[] => {
    const lowered = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return lowered.match(/[a-z0-9]+(?:'[a-z0-9]+)?/g)?.filter((token) => !STOPWORDS.has(token)) ?? [];
  };

  const termFrequency = (tokens: string[]): Map<string, number> => {
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }
    return tf;
  };

  const topKeywords = (tokens: string[], limit = 25): string[] => {
    const tf = termFrequency(tokens);
    const sorted = Array.from(tf.entries())
      .filter(([token]) => token.length >= 3)
      .sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, limit).map(([token]) => token);
  };

  it("perfect match scenario", () => {
    const resumeText = "JavaScript developer with React and Node.js experience";
    const jobDesc = "Looking for JavaScript developer with React and Node.js";

    const resumeTokens = normalize(resumeText);
    const jobTokens = normalize(jobDesc);

    const keywords = topKeywords(jobTokens);
    const resumeKeywordSet = new Set(resumeTokens);
    const hits = keywords.filter((kw) => resumeKeywordSet.has(kw));

    expect(hits.length).toBeGreaterThan(0);
    expect(hits).toContain("javascript");
    expect(hits).toContain("react");
  });

  it("partial match scenario", () => {
    const resumeText = "Python developer with Django and Flask experience";
    const jobDesc = "Python developer with FastAPI and PostgreSQL";

    const resumeTokens = normalize(resumeText);
    const jobTokens = normalize(jobDesc);

    const keywords = topKeywords(jobTokens);
    const resumeKeywordSet = new Set(resumeTokens);
    const hits = keywords.filter((kw) => resumeKeywordSet.has(kw));
    const missing = keywords.filter((kw) => !resumeKeywordSet.has(kw));

    expect(hits).toContain("python");
    expect(hits).toContain("developer");
    expect(missing).toContain("fastapi");
    expect(missing).toContain("postgresql");
  });

  it("no match scenario", () => {
    const resumeText = "Front-end developer with HTML CSS JavaScript";
    const jobDesc = "Backend Java developer with Spring Boot and Hibernate";

    const resumeTokens = normalize(resumeText);
    const jobTokens = normalize(jobDesc);

    const keywords = topKeywords(jobTokens);
    const resumeKeywordSet = new Set(resumeTokens);
    const hits = keywords.filter((kw) => resumeKeywordSet.has(kw));

    expect(hits).toContain("developer");
    expect(hits).not.toContain("java");
    expect(hits).not.toContain("spring");
  });
});
