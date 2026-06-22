import { describe, expect, it } from "vitest";
import { getParsingWarnings } from "../lib/validation/parsingWarnings";
import type { ResumeSchema } from "../types/resume";

// Minimal resume with everything empty; tests override meta / sections per case.
function makeResume(overrides: Partial<ResumeSchema> = {}): ResumeSchema {
  return {
    basics: { name: "Test", email: "", phone: "", summary: "A sufficiently long professional summary line goes here." },
    work: [{ name: "Acme", position: "Engineer", startDate: "2020", endDate: "Present", location: "Riyadh" }],
    education: [],
    skills: [],
    certificates: [],
    ...overrides,
  } as ResumeSchema;
}

const codes = (resume: ResumeSchema) => getParsingWarnings(resume).map((w) => w.code);

describe("getParsingWarnings — parse-quality gating", () => {
  it("suppresses hard missing-section warnings when the guest preview was truncated", () => {
    const resume = makeResume({
      meta: { parseQuality: { previewTruncated: true } },
    });
    const result = codes(resume);
    expect(result).toContain("preview_truncated");
    // Hard "missing" warnings must NOT fire — the tail was cut, data likely exists.
    expect(result).not.toContain("no_education");
    expect(result).not.toContain("no_certs");
    // Softer, accurate guidance instead.
    expect(result).toContain("incomplete_education");
    expect(result).toContain("incomplete_certs");
  });

  it("downgrades a parser-lost section to an info 'incomplete' warning", () => {
    const resume = makeResume({
      meta: { parseQuality: { incompleteSections: ["education"] } },
    });
    const result = codes(resume);
    expect(result).not.toContain("no_education");
    expect(result).toContain("incomplete_education");
    // Certs were NOT flagged as lost, so the normal info warning still applies.
    expect(result).toContain("no_certs");
  });

  it("keeps the hard 'no_education' warning when the section is genuinely absent (no flag)", () => {
    const resume = makeResume(); // no meta.parseQuality
    const result = codes(resume);
    expect(result).toContain("no_education");
    expect(result).not.toContain("incomplete_education");
  });

  it("downgrades contact warning when email/phone were lost in parsing", () => {
    const resume = makeResume({
      meta: { parseQuality: { incompleteSections: ["email", "phone"] } },
    });
    const result = codes(resume);
    expect(result).not.toContain("missing_contact");
    expect(result).toContain("incomplete_contact");
  });

  it("emits a gentle contact_suggestion (not missing_contact) when a profile link exists", () => {
    const resume = makeResume({
      basics: {
        name: "Test",
        email: "",
        phone: "",
        summary: "A sufficiently long professional summary line goes here.",
        url: "https://linkedin.com/in/test",
      } as ResumeSchema["basics"],
    });
    const result = codes(resume);
    expect(result).toContain("contact_suggestion");
    expect(result).not.toContain("missing_contact");
  });

  it("surfaces incomplete_languages only when parser-loss/recovery is flagged", () => {
    const recovered = makeResume({
      languages: [],
      meta: { parseQuality: { fallbackSections: ["languages"] } },
    });
    expect(codes(recovered)).toContain("incomplete_languages");

    const absent = makeResume({ languages: [] });
    expect(codes(absent)).not.toContain("incomplete_languages");
  });

  it("suppresses hard missing-section warnings when sections were recovered from raw text", () => {
    // fallbackSections records deterministic raw-text recovery. Even if a recovered
    // section ends up empty in an edge case, no hard "No X found" warning should fire.
    const resume = makeResume({
      meta: { parseQuality: { fallbackSections: ["education", "certificates"] } },
    });
    const result = codes(resume);
    expect(result).not.toContain("no_education");
    expect(result).not.toContain("no_certs");
    expect(result).toContain("incomplete_education");
    expect(result).toContain("incomplete_certs");
  });

  it("emits exactly one low_confidence_parse warning and suppresses all per-section warnings when confidence is 'low'", () => {
    // When AI parse failed and deterministic fallback rebuilt the resume, we emit
    // a single human-readable notice and suppress the per-section noisy warnings.
    const resume = makeResume({
      education: [],
      certificates: [],
      meta: { parseQuality: { confidence: 'low', aiParseFailed: true } },
    });
    const result = codes(resume);
    expect(result).toEqual(['low_confidence_parse']);
  });
});
