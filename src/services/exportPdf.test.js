import { describe, expect, it } from "vitest";
import { deriveResumeSections, buildExportHtml, exportResumeToPdf } from "./exportPdf";

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
      resumeText: sampleResume,
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

  it("throws in non-browser environments", () => {
    expect(() => exportResumeToPdf({ resumeText: sampleResume })).toThrow(
      /Export is only available in the browser|Popup blocked/,
    );
  });
});
