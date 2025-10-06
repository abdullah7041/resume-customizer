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
});
