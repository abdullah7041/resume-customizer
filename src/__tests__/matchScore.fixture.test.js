import { describe, expect, it, vi, afterEach } from "vitest";
import { analyzeResume } from "../services/api";

const mockResponse = (payload) => ({
  ok: true,
  json: vi.fn().mockResolvedValue(payload),
});

describe("analyzeResume", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clamps and returns non-zero scores when API responds with numeric strings", async () => {
    const payload = {
      score: "82.4",
      coverage: "0.45",
      similarity: "0.61",
      missing_keywords: ["python"],
      matched_keywords: ["react"],
    };

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse(payload));

    const result = await analyzeResume(
      { plainText: "Experienced React engineer" },
      "React developer role",
    );

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(result.score).toBe(82);
    expect(result.coverage).toBeCloseTo(0.45, 2);
    expect(result.cosine).toBeCloseTo(0.61, 2);
    expect(result.missingKeywords).toContain("python");
  });

  it("ensures non-zero score for valid fixture with matching content", async () => {
    const payload = {
      score: 45,
      coverage: 0.35,
      similarity: 0.52,
      missing_keywords: ["kubernetes", "docker"],
      matched_keywords: ["javascript", "frontend", "react"],
    };

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse(payload));

    const result = await analyzeResume(
      { plainText: "JavaScript developer with React experience and frontend skills" },
      "Looking for JavaScript frontend developer with React and Docker knowledge",
    );

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBe(45);
    expect(result.topHits.length).toBeGreaterThan(0);
  });

  it("clamps score to 0 when inputs have no overlap", async () => {
    const payload = {
      score: 0,
      coverage: 0,
      similarity: 0,
      missing_keywords: ["backend", "java"],
      matched_keywords: [],
    };

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse(payload));

    const result = await analyzeResume(
      { plainText: "Frontend designer with Figma skills" },
      "Backend Java developer needed",
    );

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(result.score).toBe(0);
    expect(result.topHits.length).toBe(0);
  });

  it("clamps score to 100 when API returns value above 100", async () => {
    const payload = {
      score: 150,
      coverage: 1.5,
      similarity: 1.2,
      missing_keywords: [],
      matched_keywords: ["react", "javascript", "node"],
    };

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse(payload));

    const result = await analyzeResume(
      { plainText: "React JavaScript Node developer" },
      "React JavaScript Node developer needed",
    );

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(result.score).toBe(100);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.coverage).toBeLessThanOrEqual(1);
    expect(result.cosine).toBeLessThanOrEqual(1);
  });

  it("handles invalid score values gracefully", async () => {
    const payload = {
      score: NaN,
      coverage: "invalid",
      similarity: null,
      missing_keywords: ["python"],
      matched_keywords: [],
    };

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse(payload));

    const result = await analyzeResume(
      { plainText: "Some resume text" },
      "Some job description",
    );

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(result.score).toBe(0);
    expect(result.coverage).toBe(0);
    expect(result.cosine).toBe(0);
  });

  it("throws error when resume text is empty", async () => {
    await expect(
      analyzeResume({ plainText: "" }, "Valid job description")
    ).rejects.toThrow("Resume text is required");
  });

  it("throws error when job description is empty", async () => {
    await expect(
      analyzeResume({ plainText: "Valid resume" }, "")
    ).rejects.toThrow("Paste the job description");
  });
});
