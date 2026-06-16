import { describe, expect, it } from "vitest";
import { __internal } from "../lib/utils/resumeText";

const { collectPdfPageText, normalizeResumeText, classifyExtraction } = __internal as {
  collectPdfPageText: (items: Array<{ str: string; transform: number[] }>) => string;
  normalizeResumeText: (text: string) => string;
  classifyExtraction: (text: string) => string;
};

// PDF.js transform matrix: [scaleX, skewX, skewY, scaleY, x(=4), y(=5)].
const item = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 1, x, y] });

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
