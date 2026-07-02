import { describe, expect, it } from "vitest";
import {
  buildDeterministicBaseline,
  detectSectionSignals,
  findMissingSections,
  mergeWithEvidence,
  parseWorkBlocks,
  recoverSectionsFromRawText,
  segmentSections,
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

// A realistic two-page resume whose extracted text mirrors pdf.js output:
// the SKILLS line is a space/chip-separated badge row (NOT comma-separated),
// EXPERIENCE has 3 "<role> at <company>  <dates>" header blocks with bullets,
// and LANGUAGES uses "Arabic: Native" / "English: Professional" lines.
function buildRealisticResume() {
  return [
    "ABDULLAH BIN AHMED",
    "abdullah@example.com | +966 50 123 4567 | Dammam, Saudi Arabia",
    "linkedin.com/in/abdullah-ahmed",
    "",
    "SUMMARY",
    "Saudi enterprise IT analyst bridging digital transformation and industrial operations.",
    "",
    "EXPERIENCE",
    "Lead Technical Support & Integrations Engineer at CB&I    Mar 2021 - Present",
    "Delivered measurable enterprise outcomes across cloud workflows and teams.",
    "Automated recurring asset reports, cutting manual effort by 40%.",
    "IT Operations & Asset Support Analyst at CB&I    Jan 2019 - Feb 2021",
    "Maintained asset data pipelines and support documentation.",
    "Asset Data Support Specialist at Saudi Aramco    2017 - 2018",
    "Supported enterprise reporting and data quality initiatives.",
    "",
    "SKILLS",
    "SQL    Power BI    PostgreSQL (Supabase)    React 19    TypeScript    Power Query (M Language)    Technical Support Documentation    Sentry/Telegram Webhooks    CI/CD (Netlify)",
    "",
    "PROJECTS",
    "Automated Application Support Bot",
    "Built a Telegram bot that triages support tickets and routes them automatically.",
    "",
    "EDUCATION",
    "Saudi Petroleum Services Polytechnic",
    "Diploma in Information Technology    2016",
    "",
    "CERTIFICATIONS",
    "AI Fluency & Prompt Engineering Frameworks (Anthropic/Claude)",
    "AWS Certified Cloud Practitioner",
    "",
    "LANGUAGES",
    "Arabic: Native",
    "English: Professional",
  ].join("\n");
}

const flattenSkills = (skills) =>
  (Array.isArray(skills) ? skills : []).flatMap((s) =>
    typeof s === "string" ? [s] : Array.isArray(s.keywords) ? s.keywords : [],
  );

describe("buildDeterministicBaseline — evidence-only section recovery (Test B)", () => {
  const raw = buildRealisticResume();
  const signals = detectSectionSignals(raw);
  const baseline = buildDeterministicBaseline(raw, signals);

  it("recovers space/chip-separated skills, preserving compound tokens", () => {
    const keywords = flattenSkills(baseline.skills);
    expect(keywords).toEqual(
      expect.arrayContaining([
        "SQL",
        "Power BI",
        "PostgreSQL (Supabase)",
        "React 19",
        "TypeScript",
        "Power Query (M Language)",
        "Technical Support Documentation",
        "Sentry/Telegram Webhooks",
        "CI/CD (Netlify)",
      ]),
    );
  });

  it("recovers projects, education, and certificates from headings", () => {
    expect(JSON.stringify(baseline.projects)).toContain("Automated Application Support Bot");
    expect(JSON.stringify(baseline.education)).toContain("Saudi Petroleum Services Polytechnic");
    const certText = JSON.stringify(baseline.certificates);
    expect(certText).toContain("AI Fluency & Prompt Engineering Frameworks");
    expect(certText).toContain("Anthropic/Claude");
  });

  it("recovers languages from 'Arabic: Native' / 'English: Professional' lines", () => {
    const langs = (baseline.languages || []).map((l) => l.language);
    expect(langs).toEqual(expect.arrayContaining(["Arabic", "English"]));
  });

  it("recovers multiple work entries from '<role> at <company>  <dates>' blocks", () => {
    expect(Array.isArray(baseline.work)).toBe(true);
    expect(baseline.work.length).toBeGreaterThanOrEqual(3);
    const positions = baseline.work.map((w) => w.position).join(" | ");
    expect(positions).toContain("Lead Technical Support & Integrations Engineer");
    expect(positions).toContain("Asset Data Support Specialist");
    const names = baseline.work.map((w) => w.name).join(" | ");
    expect(names).toContain("CB&I");
  });
});

describe("recoverSectionsFromRawText — work recovery when AI drops entries", () => {
  const raw = buildRealisticResume();
  const signals = detectSectionSignals(raw);

  it("fills work entirely when the AI parser returned none", () => {
    const { analysis, fallbackSections } = recoverSectionsFromRawText({ work: [] }, signals, raw);
    expect(analysis.work.length).toBeGreaterThanOrEqual(3);
    expect(fallbackSections).toContain("experience");
  });

  it("appends evidence-backed blocks the AI missed without duplicating existing ones", () => {
    const firstPass = {
      work: [
        {
          position: "Lead Technical Support & Integrations Engineer",
          name: "CB&I",
          highlights: ["Delivered measurable enterprise outcomes across cloud workflows and teams."],
        },
      ],
    };
    const { analysis, fallbackSections } = recoverSectionsFromRawText(firstPass, signals, raw);
    expect(analysis.work.length).toBeGreaterThanOrEqual(3);
    expect(fallbackSections).toContain("experience");
    // The already-present lead role must not be duplicated.
    const leadCount = analysis.work.filter(
      (w) => /Lead Technical Support/.test(w.position || ""),
    ).length;
    expect(leadCount).toBe(1);
  });

  it("does not touch work or flag experience when the AI already has every block", () => {
    const firstPass = {
      work: [
        { position: "Lead Technical Support & Integrations Engineer", name: "CB&I", highlights: ["x"] },
        { position: "IT Operations & Asset Support Analyst", name: "CB&I", highlights: ["y"] },
        { position: "Asset Data Support Specialist", name: "Saudi Aramco", highlights: ["z"] },
      ],
    };
    const { fallbackSections } = recoverSectionsFromRawText(firstPass, signals, raw);
    expect(fallbackSections).not.toContain("experience");
  });
});

describe("parseWorkBlocks — conservative header detection", () => {
  it("keeps year-bearing achievement lines as highlights", () => {
    const work = parseWorkBlocks([
      "Senior Engineer at Acme | 2022 - Present",
      "Improved latency by 30% in 2024",
      "Led a team of 5 engineers",
    ]);

    expect(work).toEqual([
      {
        position: "Senior Engineer",
        name: "Acme",
        startDate: "2022",
        endDate: "Present",
        highlights: [
          "Improved latency by 30% in 2024",
          "Led a team of 5 engineers",
        ],
      },
    ]);
  });
});

describe("findMissingSections — experience mapping (Test C)", () => {
  const signals = detectSectionSignals(buildRealisticResume());

  it("does NOT flag experience when work has >= 1 entry, even if partial", () => {
    const missing = findMissingSections(signals, {
      basics: { email: "abdullah@example.com", phone: "+966 50 123 4567" },
      work: [{ position: "Lead IT" }], // no name, no highlights — still present
      education: [{ institution: "x" }],
      certificates: [{ name: "y" }],
      projects: [{ name: "z" }],
      skills: [{ keywords: ["SQL"] }],
      languages: [{ language: "Arabic" }],
    });
    expect(missing).not.toContain("experience");
  });

  it("DOES flag experience when work is empty but the raw text has an experience section", () => {
    const missing = findMissingSections(signals, { work: [] });
    expect(missing).toContain("experience");
  });

  it("flags skills when skills are empty but raw text has a skills section", () => {
    const missing = findMissingSections(signals, {
      work: [{ position: "Lead IT", name: "CB&I", highlights: ["x"] }],
      skills: [],
    });
    expect(missing).toContain("skills");
  });
});

// Decorated headings: lines that contain a section keyword but also have
// additional ALL-CAPS descriptive words (e.g. "TECHNICAL TOOLCHAIN & ANALYTICS").
// These fail the old residual-≤2-chars check but are clearly headings.
describe("segmentSections — decorated / ALL-CAPS heading detection", () => {
  it("opens skills section for 'TECHNICAL TOOLCHAIN & ANALYTICS'", () => {
    const raw = [
      "TECHNICAL TOOLCHAIN & ANALYTICS",
      "SQL    Power BI    Power Query (M Language)    PostgreSQL (Supabase)",
    ].join("\n");
    const sections = segmentSections(raw);
    expect(sections.skills).toBeDefined();
    expect(sections.skills.length).toBeGreaterThan(0);
    expect(sections.skills.join(" ")).toContain("SQL");
  });

  it("opens summary section for 'PROFESSIONAL SUMMARY'", () => {
    const raw = "PROFESSIONAL SUMMARY\nExperienced engineer.";
    const sections = segmentSections(raw);
    expect(sections.summary).toBeDefined();
    expect(sections.summary.join(" ")).toContain("Experienced engineer");
  });

  it("does NOT treat a long lowercase sentence containing 'experience' as a heading", () => {
    const raw = "I have 5+ years of experience in software development across multiple platforms.";
    const sections = segmentSections(raw);
    // No section should be opened — the line is a sentence, not a heading.
    expect(Object.keys(sections)).toHaveLength(0);
  });

  it("does NOT treat an achievement bullet as a heading even if it contains a keyword", () => {
    const raw = [
      "EXPERIENCE",
      "Led digital transformation experience across 3 business units.",
    ].join("\n");
    const sections = segmentSections(raw);
    // Body line belongs to experience section, not opens a new one.
    expect(sections.experience).toBeDefined();
    expect(sections.experience.join(" ")).toContain("Led digital transformation");
  });

  it("buildDeterministicBaseline recovers skills from a 'TECHNICAL TOOLCHAIN & ANALYTICS' heading", () => {
    const raw = [
      "JANE SMITH",
      "jane@example.com",
      "",
      "TECHNICAL TOOLCHAIN & ANALYTICS",
      "SQL    Power BI    Power Query (M Language)    PostgreSQL (Supabase)    React 19",
    ].join("\n");
    const signals = detectSectionSignals(raw);
    const baseline = buildDeterministicBaseline(raw, signals);
    expect(baseline.skills).toBeDefined();
    const keywords = (baseline.skills ?? []).flatMap((s) => s.keywords ?? []);
    expect(keywords).toEqual(
      expect.arrayContaining(["SQL", "Power BI", "Power Query (M Language)", "PostgreSQL (Supabase)", "React 19"]),
    );
  });
});

describe("buildDeterministicBaseline — basics.name extraction", () => {
  it("extracts the candidate name from the first non-contact header line", () => {
    const raw = [
      "ABDULLAH BIN AHMED",
      "abdullah@example.com | +966 50 123 4567 | Dammam, Saudi Arabia",
      "",
      "SUMMARY",
      "Saudi enterprise IT analyst.",
    ].join("\n");
    const baseline = buildDeterministicBaseline(raw, detectSectionSignals(raw));
    expect(baseline.basics?.name).toBe("ABDULLAH BIN AHMED");
  });

  it("does NOT pick an email, heading, or long sentence as the name", () => {
    const raw = [
      "summary@example.com",
      "EXPERIENCE",
      "I have more than five years of professional experience building data systems.",
      "Jane Doe",
    ].join("\n");
    const baseline = buildDeterministicBaseline(raw, detectSectionSignals(raw));
    // First valid name-like line is "Jane Doe" — the email/heading/sentence are skipped.
    expect(baseline.basics?.name).toBe("Jane Doe");
  });

  it("leaves name unset when no name-like line exists", () => {
    const raw = "contact@example.com\n+966 50 123 4567\nEXPERIENCE\nLead Analyst at Acme 2020 - Present";
    const baseline = buildDeterministicBaseline(raw, detectSectionSignals(raw));
    expect(baseline.basics?.name).toBeUndefined();
  });
});

describe("buildDeterministicBaseline — multi-line work headers", () => {
  it("keeps role, company, adjacent dates, and bullets in one evidence-backed entry", () => {
    const raw = [
      "JANE SMITH",
      "jane@example.com",
      "EXPERIENCE",
      "Senior Data Analyst",
      "Acme Analytics",
      "Mar 2021 - Present",
      "• Built 15 executive dashboards.",
      "EDUCATION",
      "King Saud University",
    ].join("\n");

    const baseline = buildDeterministicBaseline(raw, detectSectionSignals(raw));
    expect(baseline.work).toEqual([
      {
        position: "Senior Data Analyst",
        name: "Acme Analytics",
        startDate: "Mar 2021",
        endDate: "Present",
        highlights: ["Built 15 executive dashboards."],
      },
    ]);
  });
});

describe("recoverSectionsFromRawText — basics.name recovery", () => {
  it("fills a missing name from the raw text and lists it in fallbackSections", () => {
    const raw = [
      "ABDULLAH BIN AHMED",
      "abdullah@example.com",
      "EXPERIENCE",
      "Lead Analyst at Acme 2020 - Present",
    ].join("\n");
    const signals = detectSectionSignals(raw);
    const { analysis, fallbackSections } = recoverSectionsFromRawText(
      { basics: { email: "abdullah@example.com" } },
      signals,
      raw,
    );
    expect(analysis.basics.name).toBe("ABDULLAH BIN AHMED");
    expect(fallbackSections).toContain("name");
  });

  it("does not overwrite a name the AI parser already produced", () => {
    const raw = "ABDULLAH BIN AHMED\nabdullah@example.com\nEXPERIENCE\nLead Analyst at Acme 2020";
    const signals = detectSectionSignals(raw);
    const { analysis, fallbackSections } = recoverSectionsFromRawText(
      { basics: { name: "Abdullah B. Ahmed" } },
      signals,
      raw,
    );
    expect(analysis.basics.name).toBe("Abdullah B. Ahmed");
    expect(fallbackSections).not.toContain("name");
  });
});

describe("buildParseResumeMessages — prompt hardening rules", () => {
  it("instructs the parser to put the header title in basics.label, not work", () => {
    const [, userMsg] = buildParseResumeMessages({ inputData: "Jane Smith\nData Engineer\nEXPERIENCE\nLead Analyst at Acme" });
    expect(userMsg.content).toMatch(/basics\.label/);
    expect(userMsg.content).toMatch(/not.*work|headline/i);
  });

  it("explains that skills may be grouped as 'Category: item, item'", () => {
    const [, userMsg] = buildParseResumeMessages({ inputData: "SKILLS\nData: SQL, Power BI" });
    expect(userMsg.content).toMatch(/Category:|category.*item/i);
  });

  it("reminds the parser to capture the education institution", () => {
    const [, userMsg] = buildParseResumeMessages({ inputData: "EDUCATION\nDiploma\nKing Fahd University" });
    expect(userMsg.content).toMatch(/institution/i);
  });
});

// Real production failure: a combined heading ("EDUCATION, CERTIFICATIONS &
// LANGUAGES") whose body lines are bulleted inline-prefix lines. Before the fix,
// the ^-anchored prefix matchers missed the leading "• " so certificates and
// languages dumped into education and were lost. The title line under the name
// (basics.label) was also never recovered.
describe("combined heading + bulleted inline-prefix recovery (real CV)", () => {
  const RAW = [
    "ABDULLAH BIN AHMED",
    "Senior Business Intelligence Analyst & Data Architect",
    "Dammam, Saudi Arabia | LinkedIn: linkedin.com/in/3binahmed/",
    "",
    "CHRONOLOGICAL EXPERIENCE",
    "Senior Data Analyst & BI Specialist at Al Ghalia (Saudi Arabia) Mar 2020 - Present",
    "• Delivered 15+ Power BI dashboards for executive stakeholders.",
    "",
    "EDUCATION, CERTIFICATIONS & LANGUAGES",
    "• Education: Diploma in Pipefitting Technology, Saudi Petroleum Services Polytechnic (GPA: 4.6/5, 2018).",
    "• Certificates & Courses: Intro to Management Consulting (Emory University & PwC), Leadership & Business Management (McKinsey & Company Forward Program), Google Data Analytics Professional Certificate (Capstone Phase), AI Fluency & Prompt Engineering Frameworks (Anthropic/Claude).",
    "• Languages: Arabic (Native), English (Professional).",
  ].join("\n");

  it("segments certificates and languages out of the combined/education block", () => {
    const sections = segmentSections(RAW);
    expect(sections.certificates?.length).toBeGreaterThan(0);
    expect(sections.languages?.length).toBeGreaterThan(0);
    // The literal "Education:" prefix and the bullet must NOT survive in education.
    expect(sections.education.join(" ")).toContain("Diploma in Pipefitting Technology");
    expect(sections.education.join(" ")).not.toMatch(/Education:/i);
    expect(sections.education.join(" ")).not.toMatch(/Languages:/i);
  });

  it("builds 4 distinct certificates and both languages with fluency", () => {
    const signals = detectSectionSignals(RAW);
    const baseline = buildDeterministicBaseline(RAW, signals);
    expect(baseline.certificates).toHaveLength(4);
    expect(baseline.certificates[0].name).toMatch(/Intro to Management Consulting/);
    expect(baseline.languages).toEqual([
      { language: "Arabic", fluency: "Native" },
      { language: "English", fluency: "Professional" },
    ]);
    expect(baseline.basics.label).toBe("Senior Business Intelligence Analyst & Data Architect");
  });

  it("recovers certs, languages and the title into an empty AI analysis", () => {
    const signals = detectSectionSignals(RAW);
    const { analysis, fallbackSections } = recoverSectionsFromRawText(
      { basics: { name: "ABDULLAH BIN AHMED" }, work: [], education: [], certificates: [], languages: [] },
      signals,
      RAW,
    );
    expect(analysis.certificates.length).toBe(4);
    expect(analysis.languages.length).toBe(2);
    expect(analysis.basics.label).toBe("Senior Business Intelligence Analyst & Data Architect");
    expect(fallbackSections).toEqual(expect.arrayContaining(["certificates", "languages", "label"]));
  });

  it("does not flag certs/languages as missing after recovery", () => {
    const signals = detectSectionSignals(RAW);
    const { analysis } = recoverSectionsFromRawText(
      { basics: {}, work: [], education: [], certificates: [], languages: [] },
      signals,
      RAW,
    );
    const missing = findMissingSections(signals, analysis);
    expect(missing).not.toContain("certificates");
    expect(missing).not.toContain("languages");
  });
});

// Regression: the "Abdullah BIN AHMED — BI Analyst" resume exposed three
// deterministic-fallback bugs vs the source PDF:
//   1. no summary (heading was "Core Identity & Value Proposition")
//   2. the company/location line ("Al Ghalia (Saudi Arabia)") rendered as the
//      first achievement bullet instead of the employer
//   3. a "Title: description" project dumped the whole line into project.name,
//      which templates render bold ("highlighted text")
describe("deterministic fallback — BI Analyst regression", () => {
  const RESUME = [
    "ABDULLAH BIN AHMED",
    "Senior Business Intelligence Analyst & Data Architect",
    "Dammam, Saudi Arabia | LinkedIn: linkedin.com/in/3binahmed/ | Portfolio: abdullahfile.vercel.app",
    "CORE IDENTITY & VALUE PROPOSITION",
    "Data-driven Senior Business Intelligence Analyst with 5+ years of experience delivering enterprise BI solutions.",
    "CHRONOLOGICAL EXPERIENCE",
    "Senior Data Analyst & BI Specialist Mar 2020 – Present",
    "Al Ghalia (Saudi Arabia)",
    "Oversaw the delivery of BI solutions for a 50+ product inventory.",
    "• Enabled data-driven decision-making by delivering 15+ interactive Power BI dashboards.",
    "Construction Data Specialist Jun 2018 – Jun 2019",
    "CB&I (Dammam, KSA)",
    "Data compliance and workflow management in a high-stakes environment.",
    "INDEPENDENT PROJECTS",
    "• Automated Data Pipeline Bot: Built an automated n8n workflow utilizing the OpenAI API, reducing manual anomaly identification time by 90%.",
    "EDUCATION, CERTIFICATIONS & LANGUAGES",
    "• Languages: Arabic (Native), English (Professional).",
  ].join("\n");

  it("recovers a summary under a non-standard heading (Core Identity & Value Proposition)", () => {
    const baseline = buildDeterministicBaseline(RESUME);
    expect(baseline.basics?.summary || "").toContain("Data-driven Senior Business Intelligence Analyst");
  });

  it("maps the company/location line to name+location, not a highlight bullet", () => {
    const baseline = buildDeterministicBaseline(RESUME);
    const first = (baseline.work || [])[0];
    expect(first?.name).toBe("Al Ghalia");
    expect(first?.location).toBe("Saudi Arabia");
    expect((first?.highlights || []).some((h) => /Al Ghalia/.test(h))).toBe(false);
  });

  it("does not treat a dash-prefixed achievement as the company name", () => {
    const work = parseWorkBlocks([
      "Senior Data Analyst Mar 2020 – Present",
      "- Delivered BI dashboards",
      "Al Ghalia (Saudi Arabia)",
    ]);
    expect(work[0]?.name).toBe("Al Ghalia");
    expect(work[0]?.location).toBe("Saudi Arabia");
    expect(work[0]?.highlights || []).toContain("Delivered BI dashboards");
  });

  it("keeps an '&' company name intact and parses a comma location", () => {
    const baseline = buildDeterministicBaseline(RESUME);
    const cbi = (baseline.work || []).find((w) => /Construction Data Specialist/.test(w.position || ""));
    expect(cbi?.name).toBe("CB&I");
    expect(cbi?.location).toBe("Dammam, KSA");
  });

  it("splits 'Title: description' projects so only the short title is the name", () => {
    const baseline = buildDeterministicBaseline(RESUME);
    const project = (baseline.projects || [])[0];
    expect(project?.name).toBe("Automated Data Pipeline Bot");
    expect(project?.description || "").toContain("n8n workflow");
  });

  it("does not lose summary when recovering into an AI result that dropped it", () => {
    const signals = detectSectionSignals(RESUME);
    const { analysis, fallbackSections } = recoverSectionsFromRawText(
      { basics: { name: "Abdullah Bin Ahmed" }, work: [] },
      signals,
      RESUME,
    );
    expect(analysis.basics?.summary || "").toContain("Data-driven");
    expect(fallbackSections).toContain("summary");
  });
});
