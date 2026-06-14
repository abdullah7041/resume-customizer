import { describe, expect, it } from "vitest";
import {
  detectSectionSignals,
  findMissingSections,
  mergeWithEvidence,
} from "../parse-quality.js";
import {
  MAX_PARSE_INPUT_CHARS,
  buildParseResumeMessages,
} from "../ai-contracts/contracts/index.js";

// A synthetic resume where EDUCATION and CERTIFICATIONS appear only AFTER the
// old 10,000-char truncation point. This reproduces the production bug where
// late sections were silently dropped.
function buildLongResume() {
  const header = [
    "ABDULLAH BIN AHMED",
    "abdullah@example.com | +966 50 123 4567 | Dammam, Saudi Arabia",
    "",
    "SUMMARY",
    "Saudi Enterprise IT Analyst bridging digital transformation and industrial operations.",
    "",
    "EXPERIENCE",
    "Lead IT Systems Builder & Data Architect — Watheq (Mar 2020 - Present)",
  ].join("\n");

  // Padding pushes the tail sections well past the legacy 10k cut.
  const padding = "\n" + "Delivered measurable outcomes across enterprise workflows. ".repeat(400);

  const tail = [
    "",
    "EDUCATION",
    "BSc Computer Science — King Fahd University of Petroleum and Minerals (2018)",
    "",
    "CERTIFICATIONS",
    "AWS Certified Solutions Architect — Amazon Web Services (2021)",
  ].join("\n");

  return header + padding + tail;
}

describe("detectSectionSignals", () => {
  it("detects section headings and contact values present in raw text", () => {
    const signals = detectSectionSignals(buildLongResume());
    expect(signals.education).toBe(true);
    expect(signals.certificates).toBe(true);
    expect(signals.emails).toContain("abdullah@example.com");
    expect(signals.phones.length).toBeGreaterThan(0);
  });
});

describe("findMissingSections", () => {
  it("flags sections present in raw text but empty in structured output", () => {
    const signals = detectSectionSignals(buildLongResume());
    const analysis = {
      basics: { name: "Abdullah" }, // email/phone dropped
      work: [{ position: "Lead IT" }],
      education: [],
      certificates: [],
    };
    const missing = findMissingSections(signals, analysis);
    expect(missing).toEqual(expect.arrayContaining(["education", "certificates", "email", "phone"]));
  });

  it("does not flag genuinely-absent sections (no raw-text signal)", () => {
    const signals = detectSectionSignals("Just a name and a summary line.");
    const missing = findMissingSections(signals, { basics: {}, education: [], certificates: [] });
    expect(missing).not.toContain("education");
    expect(missing).not.toContain("certificates");
  });
});

describe("buildParseResumeMessages (focusSections plumbing)", () => {
  it("does NOT truncate input below the shared parse cap", () => {
    const resume = buildLongResume();
    expect(resume.length).toBeGreaterThan(10000);
    expect(resume.length).toBeLessThanOrEqual(MAX_PARSE_INPUT_CHARS);
    const [, userMsg] = buildParseResumeMessages({ inputData: resume });
    // The legacy 10k cut would have removed these; with the 50k cap they survive.
    expect(userMsg.content).toContain("EDUCATION");
    expect(userMsg.content).toContain("CERTIFICATIONS");
  });

  it("injects the focused instruction with the named sections into the prompt", () => {
    const [, userMsg] = buildParseResumeMessages({
      inputData: "EDUCATION\nBSc CS\nCERTIFICATIONS\nAWS",
      focusSections: ["education", "certificates"],
    });
    expect(userMsg.content).toContain("education, certificates");
    expect(userMsg.content).toMatch(/extract every one of them/i);
  });

  it("omits the focused instruction when no focusSections are given", () => {
    const [, userMsg] = buildParseResumeMessages({ inputData: "EXPERIENCE\nLead IT" });
    expect(userMsg.content).not.toMatch(/extract every one of them/i);
  });
});

describe("mergeWithEvidence (evidence-gated retry merge)", () => {
  it("rejects a retry email that is NOT present in the raw text", () => {
    const signals = detectSectionSignals("Jane Doe\nLead Engineer\nEXPERIENCE");
    const merged = mergeWithEvidence(
      { basics: {} },
      { basics: { email: "hallucinated@evil.com" } },
      signals,
    );
    expect(merged.basics.email).toBeUndefined();
  });

  it("accepts a retry email that IS present in the raw text", () => {
    const signals = detectSectionSignals("Jane Doe jane@corp.com\nEXPERIENCE");
    const merged = mergeWithEvidence(
      { basics: {} },
      { basics: { email: "jane@corp.com" } },
      signals,
    );
    expect(merged.basics.email).toBe("jane@corp.com");
  });

  it("accepts retry education when its institution appears in raw text", () => {
    const signals = detectSectionSignals("EDUCATION\nBSc — King Fahd University (2018)");
    const merged = mergeWithEvidence(
      { education: [] },
      { education: [{ institution: "King Fahd University", area: "CS" }] },
      signals,
    );
    expect(merged.education).toHaveLength(1);
  });

  it("does not overwrite first-pass sections that already have data", () => {
    const signals = detectSectionSignals("EDUCATION\nKing Fahd University");
    const merged = mergeWithEvidence(
      { education: [{ institution: "Original" }] },
      { education: [{ institution: "King Fahd University" }] },
      signals,
    );
    expect(merged.education[0].institution).toBe("Original");
  });
});
