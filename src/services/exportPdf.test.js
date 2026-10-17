import { describe, expect, it, vi } from "vitest";
import {
  deriveResumeSections,
  buildExportHtml,
  buildPlainExportHtml,
  exportResumeToPdf,
  normalizeVariant,
} from "./exportPdf";


describe("exportPdf", () => {
  it.each(["styled", "ats-plain"])("preserves legacy string and structured skills in %s reviewed print", async variant => {
    const html = await exportResumeToPdf({ resumeDocument: {
      basics: { name: "Sara", location: {} },
      skills: ["Legacy SQL", { name: "Reporting", level: "Advanced", keywords: ["Power BI"] }],
    }, variant, skipPrint: true });
    const text = new DOMParser().parseFromString(html, "text/html").body.textContent;
    for (const skill of ["Legacy SQL", "Reporting", "Advanced", "Power BI"]) expect(text).toContain(skill);
  });
  it.each(["styled", "ats-plain"])("keeps supplied contact URLs as visible escaped text in %s print export", async variant => {
    const urls = ["https://sara.example.test/?a=1&b=2", "https://github.com/sara-example", "https://linkedin.com/in/sara-example"];
    const resumeDocument = {
      basics: { name: "Sara", email: "sara@example.test", location: {}, url: urls[0],
        profiles: [{ network: "GitHub", url: urls[1] }, { network: "LinkedIn", url: urls[2] },
          { network: "Portfolio", url: urls[0] }, { network: "Other", url: '<script>alert("profile")</script>' }] },
      work: [], education: [], skills: [], projects: [],
    };
    const html = await exportResumeToPdf({ resumeDocument, variant, skipPrint: true });
    const doc = new DOMParser().parseFromString(html, "text/html");
    for (const url of urls) {
      expect(doc.body.textContent).toContain(url);
      expect(doc.body.textContent.split(url)).toHaveLength(2);
    }
    expect(doc.body.textContent).toContain('<script>alert("profile")</script>');
    expect(doc.querySelector("script")).toBeNull();
  });

  it.each(["styled", "ats-plain"])("keeps legacy LinkedIn contacts in %s print export", async variant => {
    const html = await exportResumeToPdf({ resumeDocument: {
      header: { name: "Sara", linkedin: "https://linkedin.com/in/sara-legacy" },
      summary: [], skills: [], experience: [], education: [], projects: [],
    }, variant, skipPrint: true });
    expect(new DOMParser().parseFromString(html, "text/html").body.textContent)
      .toContain("https://linkedin.com/in/sara-legacy");
  });

  it("renders the reviewed structured resume without raw suggestions or job-only facts", async () => {
    const resumeDocument = {
      basics: { name: "Sara", summary: "Confirmed summary", email: "sara@example.com", phone: "", location: { city: "Riyadh" }, profiles: [] },
      work: [{ name: "Acme", position: "Engineer", startDate: "2020", endDate: "2024", highlights: ["Built the platform"] }],
      education: [], skills: [], projects: [],
    };
    for (const variant of ["styled", "ats-plain"]) {
      const html = await exportResumeToPdf({ resumeDocument, variant,
        optimizations: [{ suggestion: "Unreviewed claim" }], keywords: { add: ["Unsupported skill"] },
        jobDescription: "Private job description", skipPrint: true });
      expect(html).toContain("Confirmed summary");
      expect(html).toContain("Built the platform");
      expect(html).toContain("Acme");
      expect(html).not.toContain("Unreviewed claim");
      expect(html).not.toContain("Unsupported skill");
      expect(html).not.toContain("Private job description");
    }
  });
  it("renders a sparse reviewed resume", async () => {
    const html = await exportResumeToPdf({ resumeDocument: {
      basics: { name: "Sara", summary: "", location: {} }, work: [], education: [], skills: [],
    }, skipPrint: true });
    expect(html).toContain("Sara");
  });
  it("keeps every canonical section in both reviewed HTML variants", async () => {
    const resumeDocument = {
      basics: { name: "Sara", summary: "Original summary", location: { city: "Riyadh" }, profiles: [] },
      work: [],
      education: [{ institution: "University A", studyType: "Master", area: "Data Science", startDate: "2020", endDate: "2022", score: "4.0", courses: ["Statistics"], highlights: ["Research distinction"] }],
      skills: [], projects: [],
      certificates: [{ name: "Security Certificate", issuer: "Issuer A", date: "2023" }],
      languages: [{ language: "Arabic", fluency: "Native" }],
      volunteer: [{ organization: "Community A", position: "Mentor", summary: "Mentored graduates", startDate: "2021", endDate: "2022", highlights: ["Coached 20 students"] }],
      awards: [{ title: "Leadership Award", awarder: "Association A", date: "2024", summary: "For service" }],
      publications: [{ name: "Research Paper", publisher: "Journal A", releaseDate: "2025", summary: "Study abstract" }],
      interests: [{ name: "Robotics", keywords: ["Open source"] }],
      references: [{ name: "Reference A", reference: "Available on request" }],
    };
    for (const variant of ["styled", "ats-plain"]) {
      const html = await exportResumeToPdf({ resumeDocument, variant, skipPrint: true,
        optimizations: [{ suggestion: "Unreviewed claim" }] });
      for (const text of ["Master", "Data Science", "Statistics", "Research distinction",
        "Security Certificate", "Arabic", "Native", "Community A", "Coached 20 students",
        "Leadership Award", "Research Paper", "Robotics", "Reference A"]) {
        expect(html).toContain(text);
      }
      expect(html).not.toContain("Unreviewed claim");
    }
  });
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
    expect(html).toContain("Estimated alignment with this job description");
    expect(html).not.toContain("Keyword coverage:");
    expect(html).not.toContain("Similarity index:");
  });

  it("preserves utf-8 characters in export html", () => {
    const resumeDocument = { plainText: "محمد علي\nSenior Engineer – تجربة" };
    const html = buildExportHtml({ resumeDocument });
    expect(html).toContain("محمد علي");
    expect(html).toContain("تجربة");
  });

  it("renders mixed Arabic/English styled export html as RTL", () => {
    const resumeDocument = {
      plainText: [
        "سارة الأحمد",
        "Product Manager",
        "قادت مبادرات التحول الرقمي using Jira and SQL",
        "رفعت كفاءة العمليات بنسبة 22%",
      ].join("\n"),
    };

    const html = buildExportHtml({ resumeDocument });

    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain("direction: rtl");
    expect(html).toContain("text-align: right");
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

  it("renders mixed Arabic/English ATS export html as RTL", () => {
    const html = buildPlainExportHtml({
      resumeDocument: {
        plainText: [
          "سارة الأحمد",
          "Product Manager",
          "قادت مبادرات التحول الرقمي using Jira and SQL",
          "رفعت كفاءة العمليات بنسبة 22%",
        ].join("\n"),
        bullets: ["• قادت فريق المنتج using Agile rituals"],
        sections: [],
      },
    });

    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain("direction: rtl");
    expect(html).toContain("text-align: right");
    expect(html).toContain("ul { margin: 0 18px 12px 0");
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

  it("throws in non-browser environments", async () => {
    const originalDocument = globalThis.document;
    vi.stubGlobal("document", undefined);

    try {
      await expect(async () =>
        await exportResumeToPdf({ resumeDocument: { plainText: sampleResume } })
      ).rejects.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }

    expect(globalThis.document).toBe(originalDocument);
  });
});



