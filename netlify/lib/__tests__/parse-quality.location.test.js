import { describe, expect, it } from "vitest";
import {
  buildDeterministicBaseline,
  detectSectionSignals,
  findMissingSections,
  recoverSectionsFromRawText,
} from "../parse-quality.js";

/**
 * Cover for the three layout features that made a real resume lose data.
 *
 * The reported symptom was "certificates section, location, and city in experience
 * are gone". None of it was a schema or template problem — the deterministic layer
 * genuinely could not read this layout:
 *
 *   1. `basics.location` had no deterministic path at all, and no way to report the
 *      loss, so a failed AI parse silently dropped the candidate's city.
 *   2. A work header of "Role — Company   City, Country | dates" put the city INSIDE
 *      the company name, so `location` was null and `name` was wrong too.
 *   3. Under the combined heading "EDUCATION, CERTIFICATIONS & LANGUAGES" every body
 *      line was filed under the first keyword, so `certificates` came back empty
 *      while the certificate line sat in `education` — and the five certificates on
 *      that one middle-dot-separated line were never split apart.
 */

const RESUME = [
  "ABDULLAH BIN AHMED",
  "AI Product Engineer",
  "Riyadh, Saudi Arabia · (+966) 54-839-2374 · candidate@example.com",
  "linkedin.com/in/3binahmed · github.com/abdullah7041",
  "",
  "SUMMARY",
  "AI Product Engineer who ships production LLM systems end to end.",
  "",
  "EXPERIENCE",
  "Founder & AI Product Engineer — Watheq   Riyadh, Saudi Arabia  |  Aug 2025 – Present",
  "  - Built and deployed the full platform solo: React 19, TypeScript, Supabase.",
  "",
  "Data Analyst / Senior Sales Specialist — Alghalia   Al-Ahsa, Saudi Arabia  |  Mar 2020 – Present",
  "  - Cut expired-unit waste 60% year-over-year through quantitative analysis.",
  "",
  "Pipefitting Technician — CB&I   Dammam, Saudi Arabia  |  Jun 2018 – Jun 2019",
  "  - Industrial pipefitting and field quality inspection under audit standards.",
  "",
  "EDUCATION, CERTIFICATIONS & LANGUAGES",
  "  - Diploma, Pipefitting Technology — Saudi Petroleum Services Polytechnic (SPSP), GPA 4.6/5, 2018",
  "  - Claude 101 — Anthropic Academy (2026) · AI Fluency and Prompt Engineering Frameworks — Anthropic · Google Data Analytics Professional Certificate — Coursera · Leadership and Business Management — McKinsey Forward Program · Introduction to Management Consulting — Emory University and PwC",
].join("\n");

const signals = () => detectSectionSignals(RESUME);
const baseline = () => buildDeterministicBaseline(RESUME, signals());

describe("basics.location — the candidate's own city", () => {
  it("reads the city and country from the contact line", () => {
    expect(baseline().basics.location).toEqual({
      city: "Riyadh",
      countryCode: "SA",
      region: "",
    });
  });

  it("does not mistake the phone number or the email for a place", () => {
    const location = baseline().basics.location;
    expect(location.city).not.toMatch(/\d/);
    expect(location.city).not.toContain("@");
  });

  it("invents nothing when the resume names no place", () => {
    const raw = "JANE DOE\nSoftware Engineer\njane@example.com\n\nSUMMARY\nEngineer.";
    const built = buildDeterministicBaseline(raw, detectSectionSignals(raw));
    expect(built.basics?.location ?? null).toBeNull();
  });

  it("fills a missing location during recovery, and records that it did", () => {
    const { analysis, fallbackSections } = recoverSectionsFromRawText(
      { basics: { name: "Abdullah Bin Ahmed" } },
      signals(),
      RESUME,
    );
    expect(analysis.basics.location.city).toBe("Riyadh");
    expect(fallbackSections).toContain("location");
  });

  it("never overwrites a location the AI parser already produced", () => {
    const { analysis } = recoverSectionsFromRawText(
      { basics: { name: "A", location: { city: "Jeddah", countryCode: "SA", region: "" } } },
      signals(),
      RESUME,
    );
    expect(analysis.basics.location.city).toBe("Jeddah");
  });
});

describe("work[].location — the city on the title line", () => {
  it("separates the employer from its city instead of merging them", () => {
    expect(baseline().work.map((entry) => ({ name: entry.name, location: entry.location }))).toEqual([
      { name: "Watheq", location: "Riyadh, Saudi Arabia" },
      { name: "Alghalia", location: "Al-Ahsa, Saudi Arabia" },
      { name: "CB&I", location: "Dammam, Saudi Arabia" },
    ]);
  });

  it("leaves a company name alone when its tail is not a place", () => {
    const raw = [
      "EXPERIENCE",
      "Brand Manager — Procter & Gamble  |  Jan 2020 – Dec 2022",
      "  - Ran the category P&L.",
    ].join("\n");
    const built = buildDeterministicBaseline(raw, detectSectionSignals(raw));
    expect(built.work[0].name).toBe("Procter & Gamble");
    expect(built.work[0].location ?? null).toBeNull();
  });
});

describe("combined heading — EDUCATION, CERTIFICATIONS & LANGUAGES", () => {
  it("files the certificate line under certificates, not education", () => {
    const built = baseline();
    expect(built.certificates.length).toBe(5);
    expect(built.certificates.map((c) => c.name)).toEqual([
      "Claude 101 — Anthropic Academy (2026)",
      "AI Fluency and Prompt Engineering Frameworks — Anthropic",
      "Google Data Analytics Professional Certificate — Coursera",
      "Leadership and Business Management — McKinsey Forward Program",
      "Introduction to Management Consulting — Emory University and PwC",
    ]);
  });

  it("keeps the degree line in education", () => {
    const educationText = JSON.stringify(baseline().education);
    expect(educationText).toContain("Pipefitting Technology");
    expect(educationText).not.toContain("Coursera");
  });
});

describe("findMissingSections — a lost city is now reportable", () => {
  const complete = {
    education: [{}],
    certificates: [{}],
    skills: [{}],
    languages: [{}],
  };

  it("reports both location losses when the raw text names a place", () => {
    const missing = findMissingSections(signals(), {
      ...complete,
      basics: { name: "A", email: "a@b.co", phone: "0501234567" },
      work: [{ name: "Watheq", position: "Founder", highlights: ["x"] }],
    });
    expect(missing).toContain("location");
    expect(missing).toContain("work_location");
  });

  it("reports neither when both survived the parse", () => {
    const missing = findMissingSections(signals(), {
      ...complete,
      basics: { name: "A", email: "a@b.co", phone: "0501234567", location: { city: "Riyadh" } },
      work: [{ name: "Watheq", position: "Founder", location: "Riyadh", highlights: ["x"] }],
    });
    expect(missing).not.toContain("location");
    expect(missing).not.toContain("work_location");
  });

  it("does not accuse a resume that simply states no location", () => {
    const raw = "JANE DOE\nEngineer\njane@example.com\n\nEXPERIENCE\nEngineer — Acme | 2020 – 2022\n  - Shipped things.";
    const missing = findMissingSections(detectSectionSignals(raw), {
      basics: { name: "Jane Doe", email: "jane@example.com" },
      work: [{ name: "Acme", position: "Engineer", highlights: ["x"] }],
    });
    expect(missing).not.toContain("location");
    expect(missing).not.toContain("work_location");
  });
});
