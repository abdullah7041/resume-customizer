import { describe, expect, it } from "vitest";
import { __internal } from "../lib/utils/resumeText";

const { collectPdfPageText, normalizeResumeText, classifyExtraction } = __internal as {
  collectPdfPageText: (items: Array<{ str: string; transform: number[] }>) => string;
  normalizeResumeText: (text: string) => string;
  classifyExtraction: (text: string) => string;
};

// PDF.js transform matrix: [scaleX, skewX, skewY, scaleY, x(=4), y(=5)].
const item = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 1, x, y] });

// Width-aware item for column-detection tests (needs real horizontal spans).
const witem = (str: string, x: number, y: number, width: number) => ({
  str,
  transform: [1, 0, 0, 1, x, y],
  width,
});

// Font-aware item for wrap-merge tests (needs real font height in transform[3]).
const fitem = (str: string, x: number, y: number, width: number, fontSize: number) => ({
  str,
  transform: [fontSize, 0, 0, fontSize, x, y],
  width,
});

describe("collectPdfPageText — reading-order reconstruction", () => {
  it("groups by Y then sorts each line left-to-right by X (out-of-order items)", () => {
    // Items deliberately supplied out of reading order within each line.
    const out = collectPdfPageText([
      item("World", 80, 700), // line 1, right
      item("Hello", 10, 700), // line 1, left (same Y)
      item("bar", 60, 670), // line 2, right (Y differs > threshold)
      item("foo", 10, 670), // line 2, left
    ]);
    const lines = out.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0].indexOf("Hello")).toBeLessThan(lines[0].indexOf("World"));
    expect(lines[1].indexOf("foo")).toBeLessThan(lines[1].indexOf("bar"));
  });
});

describe("collectPdfPageText — column-separated stream order (bullet+text columns)", () => {
  it("reassembles rows when bullet column is emitted before text column in stream order", () => {
    // Reproduces the production failure: a PDF that streams all bullets first,
    // then all text items — both sharing the same Y values per row.
    const out = collectPdfPageText([
      // Bullet column (stream order: emitted first)
      item("•", 10, 700),
      item("•", 10, 680),
      item("•", 10, 660),
      // Text column (same Y values, larger X — emitted second)
      item("Built a Telegram bot", 50, 700),
      item("Automated recurring reports", 50, 680),
      item("Led cross-functional teams", 50, 660),
    ]);
    const lines = out.split("\n");
    expect(lines).toHaveLength(3);
    // Each row must contain both the bullet and its corresponding text.
    expect(lines[0]).toContain("•");
    expect(lines[0]).toContain("Built a Telegram bot");
    expect(lines[1]).toContain("•");
    expect(lines[1]).toContain("Automated recurring reports");
    expect(lines[2]).toContain("•");
    expect(lines[2]).toContain("Led cross-functional teams");
    // Bullet must appear before text on each row (sorted by X).
    lines.forEach((line) => {
      const bulletIdx = line.indexOf("•");
      expect(bulletIdx).toBeGreaterThanOrEqual(0);
      expect(bulletIdx).toBeLessThan(line.indexOf("•") + 5); // bullet near start
    });
  });

  it("places a right-aligned date on the same row as the job title", () => {
    // Title at x=50, date at x=450 — same Y. In a column-order stream the date
    // might arrive after items at a different Y; the bucket approach reunites them.
    const out = collectPdfPageText([
      item("Mar 2021 - Present", 450, 700), // date first in stream
      item("Acme Corp", 50, 685),           // company on next physical row
      item("Senior Engineer", 50, 700),     // title later in stream, same Y as date
    ]);
    const lines = out.split("\n");
    // Title and date must be on the same output line.
    const titleLine = lines.find((l) => l.includes("Senior Engineer")) ?? "";
    expect(titleLine).toContain("Senior Engineer");
    expect(titleLine).toContain("Mar 2021 - Present");
    // Company is on its own row.
    expect(lines.some((l) => l.includes("Acme Corp"))).toBe(true);
    expect(lines.filter((l) => l.includes("Acme Corp"))[0]).not.toContain("Senior Engineer");
  });
});

describe("collectPdfPageText — two-column layout", () => {
  it("reads each column fully instead of merging left+right rows", () => {
    // Left column (main, x 50-250) and right column (sidebar, x 350-500) with a
    // clear gutter at 250-350. Right Ys are offset from left Ys so rows don't pair.
    const items = [
      witem("Experience one", 50, 700, 200),
      witem("Experience two", 50, 680, 200),
      witem("Experience three", 50, 660, 200),
      witem("Experience four", 50, 640, 200),
      witem("Experience five", 50, 620, 200),
      witem("Experience six", 50, 600, 200),
      witem("Skill one", 350, 690, 150),
      witem("Skill two", 350, 670, 150),
      witem("Skill three", 350, 650, 150),
      witem("Skill four", 350, 630, 150),
      witem("Skill five", 350, 610, 150),
      witem("Skill six", 350, 590, 150),
    ];
    const out = collectPdfPageText(items);
    // No line may contain content from both columns.
    out.split("\n").forEach((line) => {
      expect(line.includes("Experience") && line.includes("Skill")).toBe(false);
    });
    // All left-column content precedes all right-column content.
    expect(out.lastIndexOf("Experience")).toBeLessThan(out.indexOf("Skill"));
  });
});

describe("collectPdfPageText — single column with right-aligned dates", () => {
  it("keeps dates on the same row as titles (no false column split)", () => {
    // 12 items: body lines on the left, dates right-aligned on the SAME Y. This must
    // NOT be split into columns — the date belongs with its title's row.
    const items = [
      witem("Senior Engineer at Acme", 50, 700, 180),
      witem("Jan 2022 - Now", 420, 700, 70),
      witem("Built internal tooling", 50, 680, 180),
      witem("Software Engineer at Beta", 50, 640, 180),
      witem("Jun 2019 - Dec 2021", 420, 640, 70),
      witem("Shipped the billing system", 50, 620, 180),
      witem("Junior Developer at Gamma", 50, 580, 180),
      witem("Aug 2017 - May 2019", 420, 580, 70),
      witem("Maintained the API", 50, 560, 180),
      witem("Intern at Delta", 50, 520, 180),
      witem("Jun 2016 - Jul 2017", 420, 520, 70),
      witem("Wrote unit tests", 50, 500, 180),
    ];
    const out = collectPdfPageText(items);
    const titleLine = out.split("\n").find((l) => l.includes("Senior Engineer")) ?? "";
    expect(titleLine).toContain("Jan 2022 - Now");
  });
});

describe("collectPdfPageText — soft-wrapped line merging", () => {
  it("rejoins a wrapped bullet so it stays one line (no mid-word split)", () => {
    // A bullet whose text fills the line and wraps. The continuation has no bullet
    // and sits one line-height below. It must merge, keeping "Power BI" together.
    const out = collectPdfPageText([
      fitem("•", 51, 700, 4, 11),
      fitem(
        "Enabled data-driven decision-making by designing and delivering 15+ interactive Power",
        57,
        700,
        490,
        11,
      ),
      fitem("BI dashboards, establishing a single source of truth.", 57, 686, 360, 11),
    ]);
    const lines = out.split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("interactive Power BI dashboards");
  });

  it("joins a hyphenated wrap without inserting a space", () => {
    const out = collectPdfPageText([
      fitem("•", 51, 700, 4, 11),
      fitem("Business Intelligence & Reporting: Power BI, Executive Dashboards, Data-", 57, 700, 480, 11),
      fitem("Driven Decision Making.", 57, 686, 130, 11),
    ]);
    expect(out.split("\n")).toHaveLength(1);
    expect(out).toContain("Data-Driven Decision Making");
  });

  it("does not merge a short standalone line (company) into the next line", () => {
    // "Al Ghalia (Saudi Arabia)" is short (not filled), so the description below
    // must stay on its own line.
    const out = collectPdfPageText([
      fitem("Al Ghalia (Saudi Arabia)", 42, 446, 107, 11),
      fitem("Oversaw the delivery of BI solutions for a 50+ product inventory.", 42, 432, 387, 11),
    ]);
    expect(out.split("\n")).toHaveLength(2);
  });
});

describe("normalizeResumeText", () => {
  it("collapses bullet/whitespace runs and strips page-break noise", () => {
    const input = "John  Doe\n•••  Engineer\nPage 1 of 3\n\n\n\nSkills";
    const out = normalizeResumeText(input);
    expect(out).toContain("John Doe");
    expect(out).toContain("• Engineer");
    expect(out).not.toContain("Page 1 of 3");
    expect(out).not.toMatch(/\n{3,}/);
  });
});

describe("classifyExtraction", () => {
  it("classifies extraction quality into stable states", () => {
    expect(classifyExtraction("")).toBe("empty");
    expect(classifyExtraction("Short bit of text")).toBe("too-short");
    const readable =
      "Experienced software engineer with a strong background in building reliable distributed systems and leading teams across multiple cloud platforms and projects.";
    expect(classifyExtraction(readable)).toBe("readable");
    const garbage = "ö#ü~ã|ÿ@ø^þ`ð*æ%œ$ß".repeat(20);
    expect(classifyExtraction(garbage)).toBe("cid-glyph");
  });
});
