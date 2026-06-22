import { describe, expect, it } from "vitest";
import {
  buildDeterministicBaseline,
  detectSectionSignals,
  findMissingSections,
  mergeWithEvidence,
  parseLanguageLines,
  recoverSectionsFromRawText,
  segmentSections,
  sliceSection,
} from "../../netlify/lib/parse-quality.js";

// The netlify lib is plain JS, so recovery/merge results are loosely typed.
// Describe just the shapes these tests inspect.
interface WorkEntry {
  position?: string;
  name?: string;
  highlights?: string[];
  startDate?: string;
  endDate?: string;
}

interface MergedAnalysis {
  work?: WorkEntry[];
  [key: string]: unknown;
}

interface RecoveredAnalysis {
  basics?: {
    email?: string;
    phone?: string;
    url?: string;
    profiles?: Array<{ network: string; username: string; url: string }>;
  };
  education?: Array<{ institution: string; startDate: string; highlights: string[] }>;
  certificates?: Array<{ name: string; issuer: string; date: string }>;
}

interface RecoveryResult {
  analysis: RecoveredAnalysis;
  fallbackSections: string[];
}

const recover = (analysis: unknown, signals: unknown, raw: string): RecoveryResult =>
  recoverSectionsFromRawText(analysis, signals, raw) as RecoveryResult;

const merge = (firstPass: unknown, retryPass: unknown, signals: unknown): MergedAnalysis =>
  mergeWithEvidence(firstPass, retryPass, signals) as MergedAnalysis;

describe("recoverSectionsFromRawText — deterministic, evidence-only recovery", () => {
  it("recovers email and phone from raw text when the parser omitted them", () => {
    const raw = [
      "ABDULLAH BIN AHMED",
      "abdullah@example.com | +966 50 123 4567 | Dammam",
      "",
      "EXPERIENCE",
      "Lead IT Analyst at Watheq",
    ].join("\n");
    const signals = detectSectionSignals(raw);
    const { analysis: recovered, fallbackSections } = recover({ basics: { name: "Abdullah" } }, signals, raw);

    expect(recovered.basics?.email).toBe("abdullah@example.com");
    expect(recovered.basics?.phone).toBeTruthy();
    expect(fallbackSections).toEqual(expect.arrayContaining(["email", "phone"]));
  });

  it("recovers one conservative education entry from an EDUCATION heading + body lines", () => {
    const raw = [
      "Jane Doe",
      "EXPERIENCE",
      "Engineer at Acme",
      "",
      "EDUCATION",
      "BSc Computer Science",
      "King Fahd University of Petroleum and Minerals (2018)",
      "",
      "SKILLS",
      "Python, SQL",
    ].join("\n");
    const signals = detectSectionSignals(raw);
    const { analysis: recovered, fallbackSections } = recover({ basics: {}, education: [], skills: [] }, signals, raw);

    expect(fallbackSections).toContain("education");
    expect(recovered.education).toHaveLength(1);
    // Conservative: no fabricated institution/dates — raw lines carried as highlights.
    expect(recovered.education?.[0].institution).toBe("");
    expect(recovered.education?.[0].startDate).toBe("");
    expect(recovered.education?.[0].highlights).toEqual(
      expect.arrayContaining(["BSc Computer Science"]),
    );
    // Must NOT spill the next section's lines into education.
    expect(recovered.education?.[0].highlights.join(" ")).not.toContain("Python");
  });

  it("recovers certificate fallback entries from a CERTIFICATIONS heading", () => {
    const raw = [
      "EXPERIENCE",
      "Analyst",
      "",
      "CERTIFICATIONS",
      "AWS Certified Solutions Architect",
      "PMP",
    ].join("\n");
    const signals = detectSectionSignals(raw);
    const { analysis: recovered, fallbackSections } = recover({ basics: {}, certificates: [] }, signals, raw);

    expect(fallbackSections).toContain("certificates");
    expect(recovered.certificates).toHaveLength(2);
    expect(recovered.certificates?.[0]).toMatchObject({
      name: "AWS Certified Solutions Architect",
      issuer: "",
      date: "",
    });
  });

  it("invents nothing: a heading with no body lines yields no fabricated entry", () => {
    const raw = ["EXPERIENCE", "Analyst at Acme", "", "EDUCATION"].join("\n");
    const signals = detectSectionSignals(raw);
    const { analysis: recovered, fallbackSections } = recover({ basics: {}, education: [] }, signals, raw);

    expect(fallbackSections).not.toContain("education");
    expect(recovered.education).toEqual([]);
  });

  it("does not overwrite sections the parser already populated", () => {
    const raw = ["EDUCATION", "BSc CS", "King Fahd University"].join("\n");
    const signals = detectSectionSignals(raw);
    const { analysis: recovered, fallbackSections } = recover(
      { basics: {}, education: [{ institution: "Original University" }] },
      signals,
      raw,
    );

    expect(recovered.education?.[0].institution).toBe("Original University");
    expect(fallbackSections).not.toContain("education");
  });

  it("recovers a LinkedIn URL into basics.url + profiles when empty", () => {
    const raw = ["Jane Doe", "linkedin.com/in/jane-doe", "EXPERIENCE", "Analyst"].join("\n");
    const signals = detectSectionSignals(raw);
    const { analysis: recovered, fallbackSections } = recover({ basics: {} }, signals, raw);

    expect(fallbackSections).toContain("url");
    expect(recovered.basics?.url).toContain("linkedin.com/in/jane-doe");
    expect(recovered.basics?.profiles?.[0]).toMatchObject({ network: "LinkedIn" });
  });
});

describe("segmentSections — generic deterministic segmentation", () => {
  it("detects generic heading families (synonyms), not one specific resume", () => {
    const raw = [
      "Professional Experience",
      "Engineer at Acme",
      "Academic Background",
      "BSc CS",
      "Core Competencies",
      "Python, SQL",
    ].join("\n");
    const sections = segmentSections(raw);
    expect(sections.experience).toEqual(expect.arrayContaining(["Engineer at Acme"]));
    expect(sections.education).toEqual(expect.arrayContaining(["BSc CS"]));
    expect(sections.skills).toEqual(expect.arrayContaining(["Python, SQL"]));
  });

  it("splits a COMBINED heading using inline sub-line prefixes", () => {
    const raw = [
      "EXPERIENCE",
      "Analyst at Acme",
      "",
      "Education, Certifications & Languages",
      "Education: BSc Computer Science, KSU 2018",
      "Certifications: AWS Certified Solutions Architect",
      "Languages: Arabic (Native), English (Fluent)",
    ].join("\n");
    const sections = segmentSections(raw);
    expect(sections.education).toEqual(["BSc Computer Science, KSU 2018"]);
    expect(sections.certificates).toEqual(["AWS Certified Solutions Architect"]);
    expect(sections.languages).toEqual(["Arabic (Native), English (Fluent)"]);
  });

  it("stops collection when a known non-recovered heading follows a recovered section", () => {
    const raw = [
      "CERTIFICATIONS",
      "AWS Certified Solutions Architect",
      "",
      "REFERENCES",
      "Available upon request",
    ].join("\n");
    const sections = segmentSections(raw);
    const baseline = buildDeterministicBaseline(raw, detectSectionSignals(raw));

    expect(sections.certificates).toEqual(["AWS Certified Solutions Architect"]);
    expect(baseline.certificates?.map((cert) => cert.name)).toEqual(["AWS Certified Solutions Architect"]);
  });
});

describe("parseLanguageLines", () => {
  it("parses language + explicit fluency, inventing nothing when fluency is absent", () => {
    expect(parseLanguageLines(["Arabic (Native), English (Fluent)"])).toEqual([
      { language: "Arabic", fluency: "Native" },
      { language: "English", fluency: "Fluent" },
    ]);
    expect(parseLanguageLines(["French, Spanish"])).toEqual([
      { language: "French" },
      { language: "Spanish" },
    ]);
  });
});

describe("buildDeterministicBaseline", () => {
  it("produces conservative education/certs/projects/languages from visible text", () => {
    const raw = [
      "Jane Doe",
      "jane@example.com",
      "",
      "EDUCATION",
      "BSc Computer Science",
      "",
      "CERTIFICATIONS",
      "AWS Certified Solutions Architect",
      "",
      "PROJECTS",
      "Resume Optimizer",
      "",
      "LANGUAGES",
      "Arabic (Native), English",
    ].join("\n");
    const baseline = buildDeterministicBaseline(raw, detectSectionSignals(raw));

    expect(baseline.basics?.email).toBe("jane@example.com");
    expect(baseline.education?.[0].highlights).toEqual(expect.arrayContaining(["BSc Computer Science"]));
    expect(baseline.certificates?.[0]).toMatchObject({ name: "AWS Certified Solutions Architect", issuer: "" });
    expect(baseline.projects?.[0]).toMatchObject({ name: "Resume Optimizer" });
    expect(baseline.languages).toEqual([
      { language: "Arabic", fluency: "Native" },
      { language: "English" },
    ]);
  });

  it("keeps newline-delimited skills as separate recovered keywords", () => {
    const raw = ["SKILLS", "Python", "SQL", "Excel"].join("\n");
    const baseline = buildDeterministicBaseline(raw, detectSectionSignals(raw));

    expect(baseline.skills?.[0].keywords).toEqual(["Python", "SQL", "Excel"]);
  });
});

describe("recoverSectionsFromRawText — languages", () => {
  it("recovers a languages section the parser dropped", () => {
    const raw = ["EXPERIENCE", "Analyst", "", "LANGUAGES", "Arabic (Native), English (Fluent)"].join("\n");
    const signals = detectSectionSignals(raw);
    const { analysis: recovered, fallbackSections } = recover({ basics: {}, languages: [] }, signals, raw) as unknown as {
      analysis: { languages?: Array<{ language: string; fluency?: string }> };
      fallbackSections: string[];
    };
    expect(fallbackSections).toContain("languages");
    expect(recovered.languages?.map((l) => l.language)).toEqual(expect.arrayContaining(["Arabic", "English"]));
  });
});

describe("detectSectionSignals — experience signal", () => {
  it("emits experience:true when an experience heading is present", () => {
    const raw = "CHRONOLOGICAL EXPERIENCE\nSenior Analyst at Al Ghalia";
    const signals = detectSectionSignals(raw);
    expect(signals.experience).toBe(true);
  });

  it("emits experience:false when no experience heading present", () => {
    const raw = "EDUCATION\nBSc CS";
    const signals = detectSectionSignals(raw);
    expect(signals.experience).toBe(false);
  });
});

describe("findMissingSections — work completeness", () => {
  const RAW = [
    "CHRONOLOGICAL EXPERIENCE",
    "Senior Data Analyst",
    "Al Ghalia (Saudi Arabia)",
    "Mar 2020 – Present",
    "• Delivered 15+ Power BI dashboards.",
  ].join("\n");

  it("flags experience when work array is empty", () => {
    const signals = detectSectionSignals(RAW);
    const missing = findMissingSections(signals, { work: [] });
    expect(missing).toContain("experience");
  });

  it("does NOT flag experience when a work entry lacks a company name (partial, not missing)", () => {
    // work.length >= 1 means the EXPERIENCE section is present. A dropped company
    // name is a quality nuance handled by deterministic enrichment + fallbackSections,
    // never reported as a missing section.
    const signals = detectSectionSignals(RAW);
    const missing = findMissingSections(signals, {
      work: [{ position: "Senior Data Analyst", name: "", highlights: ["• Delivered 15+ dashboards."] }],
    });
    expect(missing).not.toContain("experience");
  });

  it("does NOT flag experience when a work entry has no highlights (partial, not missing)", () => {
    const signals = detectSectionSignals(RAW);
    const missing = findMissingSections(signals, {
      work: [{ position: "Senior Data Analyst", name: "Al Ghalia", highlights: [] }],
    });
    expect(missing).not.toContain("experience");
  });

  it("does NOT flag experience when work entries are complete", () => {
    const signals = detectSectionSignals(RAW);
    const missing = findMissingSections(signals, {
      work: [{ position: "Senior Data Analyst", name: "Al Ghalia", highlights: ["Delivered 15+ dashboards."] }],
    });
    expect(missing).not.toContain("experience");
  });

  it("does NOT flag experience when no experience heading in raw text", () => {
    const rawNoExp = "EDUCATION\nBSc CS";
    const signals = detectSectionSignals(rawNoExp);
    const missing = findMissingSections(signals, { work: [] });
    expect(missing).not.toContain("experience");
  });
});

describe("mergeWithEvidence — work merge", () => {
  const RAW = [
    "CHRONOLOGICAL EXPERIENCE",
    "Senior Data Analyst",
    "Al Ghalia",
    "Mar 2020 – Present",
    "• Delivered 15+ Power BI dashboards.",
    "Lead Product Engineer",
    "Watheq",
    "Jan 2026 – Present",
    "• Managed PostgreSQL databases.",
  ].join("\n");

  it("fills missing company name from retry when present in raw text", () => {
    const signals = detectSectionSignals(RAW);
    const firstPass = {
      work: [
        { position: "Senior Data Analyst", name: "", highlights: [], startDate: "Mar 2020", endDate: "Present" },
      ],
    };
    const retryPass = {
      work: [
        { position: "Senior Data Analyst", name: "Al Ghalia", highlights: ["Delivered 15+ Power BI dashboards."], startDate: "Mar 2020", endDate: "Present" },
      ],
    };
    const merged = merge(firstPass, retryPass, signals);
    expect(merged.work?.[0].name).toBe("Al Ghalia");
    expect(merged.work?.[0].highlights).toHaveLength(1);
  });

  it("rejects a fabricated company name not in raw text", () => {
    const signals = detectSectionSignals(RAW);
    const firstPass = {
      work: [
        { position: "Senior Data Analyst", name: "", highlights: [], startDate: "Mar 2020", endDate: "Present" },
      ],
    };
    const retryPass = {
      work: [
        { position: "Senior Data Analyst", name: "INVENTED CORP XYZ", highlights: ["Real bullet from text."], startDate: "Mar 2020", endDate: "Present" },
      ],
    };
    const merged = merge(firstPass, retryPass, signals);
    expect(merged.work?.[0].name).toBe("");
  });

  it("does NOT overwrite an already-populated company name", () => {
    const signals = detectSectionSignals(RAW);
    const firstPass = {
      work: [
        { position: "Senior Data Analyst", name: "Al Ghalia", highlights: ["Original highlight."], startDate: "Mar 2020", endDate: "Present" },
      ],
    };
    const retryPass = {
      work: [
        { position: "Senior Data Analyst", name: "Different Name", highlights: ["Different highlight."], startDate: "Mar 2020", endDate: "Present" },
      ],
    };
    const merged = merge(firstPass, retryPass, signals);
    expect(merged.work?.[0].name).toBe("Al Ghalia");
    expect(merged.work?.[0].highlights?.[0]).toBe("Original highlight.");
  });

  it("rejects retry-only dates that are not present in raw text", () => {
    const signals = detectSectionSignals(RAW);
    const firstPass = {
      work: [
        { position: "Senior Data Analyst", name: "", highlights: [] },
      ],
    };
    const retryPass = {
      work: [
        { position: "Senior Data Analyst", name: "Al Ghalia", highlights: ["Delivered 15+ Power BI dashboards."], startDate: "Jan 1999", endDate: "Dec 2099" },
      ],
    };
    const merged = merge(firstPass, retryPass, signals);
    expect(merged.work?.[0].startDate).toBeUndefined();
    expect(merged.work?.[0].endDate).toBeUndefined();
  });

  it("does not append retry-only work fields without raw-text evidence for each copied field", () => {
    const signals = detectSectionSignals(RAW);
    const firstPass = { work: [] };
    const retryPass = {
      work: [
        { position: "Lead Product Engineer", name: "Watheq", highlights: ["Invented a new market."], startDate: "Jan 1999", endDate: "Dec 2099" },
      ],
    };
    const merged = merge(firstPass, retryPass, signals);
    expect(merged.work?.[0]).toEqual({
      position: "Lead Product Engineer",
      name: "Watheq",
    });
  });
});

describe("sliceSection", () => {
  it("returns the body lines between a heading and the next heading", () => {
    const raw = [
      "EDUCATION",
      "BSc CS",
      "King Fahd University",
      "",
      "SKILLS",
      "Python",
    ].join("\n");
    expect(sliceSection(raw, "education")).toEqual(["BSc CS", "King Fahd University"]);
  });

  it("returns an empty array when the heading is absent", () => {
    expect(sliceSection("EXPERIENCE\nAnalyst", "education")).toEqual([]);
  });
});
