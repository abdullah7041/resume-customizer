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
      meta: { parseQuality: { incompleteSections: ["education"], retried: true } },
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
});
