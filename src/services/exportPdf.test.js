import { describe, expect, it, vi } from "vitest";
import {
  deriveResumeSections,
  buildExportHtml,
  buildPlainExportHtml,
  exportResumeToPdf,
  normalizeVariant,
} from "./exportPdf";

describe("exportPdf", () => {
  const sampleResume = `John Doe
Riyadh, Saudi Arabia | john@example.com | +966 555 555 555

SUMMARY
Product leader with 10+ years delivering digital experiences for GCC markets.

SKILLS
Product strategy, Stakeholder management, Agile delivery

EXPERIENCE
Alpha Corp – Directed cross-functional squads to launch Riyadh fintech platform.

EDUCATION
King Saud University – BSc Computer Science

PROJECTS
Vision 2030 Dashboard – Built analytics portal for executive leadership.`;

  it("extracts resume sections with heuristics", () => {
    const sections = deriveResumeSections(sampleResume);
    expect(sections.contactLines[0]).toContain("John Doe");
    expect(sections.summary[0]).toContain("Product leader");
    expect(sections.skills).toContain("Product strategy");
    expect(sections.experience[0]).toContain("Alpha Corp");
    expect(sections.education[0]).toContain("King Saud University");
    expect(sections.projects[0]).toContain("Vision 2030");
  });

  it("builds printable html template", () => {
    const html = buildExportHtml({
      resumeDocument: { plainText: sampleResume },
      jobDescription: "Lead product manager for Riyadh digital bank.",
      matchAnalysis: { score: 82, coverage: 0.74, cosine: 0.81 },
      optimizations: [
        {
          section: "Summary",
          suggestion: "Mention digital banking leadership in the opening paragraph.",
        },
      ],
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Summary");
    expect(html).toContain("Skills");
    expect(html).toContain("Riyadh digital bank");
    expect(html).toContain("Match Score");
  });

  it("builds ATS-friendly export html", () => {
    const html = buildPlainExportHtml({
      resumeDocument: { plainText: sampleResume, bullets: ["• Launched product"], sections: [] },
      jobDescription: "Modern banking lead.",
      matchAnalysis: { score: 70, coverage: 0.5, cosine: 0.62 },
      optimizations: [
        {
          section: "Experience",
          suggestion: "Highlight Vision 2030 impact",
        },
      ],
    });

    expect(html).toContain("ATS Resume Export");
    expect(html).toContain("Experience Highlights");
    expect(html).toContain("AI Suggestions");
  });

  it("removes noisy glyphs before exporting", () => {
    const noisyResume = `John Doe\nÿå§×ñ Contact\nSUMMARY\nDriven leader\nEXPERIENCE\n• Built Riyadh data platform`;
    const sections = deriveResumeSections(noisyResume);
    expect(sections.contactLines[0]).toBe("John Doe");
    expect(sections.contactLines).not.toContain(expect.stringContaining("ÿ"));
    const html = buildPlainExportHtml({
      resumeDocument: { plainText: noisyResume },
      jobDescription: "Data platform lead",
      matchAnalysis: { score: 0, coverage: 0, cosine: 0 },
      optimizations: [],
    });
    expect(html).not.toContain("ÿ");
  });

  it("normalizes export variant aliases", () => {
    expect(normalizeVariant()).toBe("styled");
    expect(normalizeVariant("styled")).toBe("styled");
    expect(normalizeVariant("ats")).toBe("ats-plain");
    expect(normalizeVariant("ats-plain")).toBe("ats-plain");
    expect(normalizeVariant("ATS_SAFE")).toBe("ats-plain");
    expect(normalizeVariant("plain")).toBe("ats-plain");
    expect(normalizeVariant("unknown")).toBe("styled");
  });

  it("throws in non-browser environments", () => {
    const originalDocument = globalThis.document;
    vi.stubGlobal("document", undefined);

    try {
      expect(() => exportResumeToPdf({ resumeDocument: { plainText: sampleResume } })).toThrow(
        /Export is only available in the browser/,
      );
    } finally {
      vi.unstubAllGlobals();
    }

    expect(globalThis.document).toBe(originalDocument);
  });
});
