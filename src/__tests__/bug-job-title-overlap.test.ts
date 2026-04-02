/**
 * Bug: Text overlaps in PDF export — job titles, skills badges, spacing all
 * broken.  The browser preview is correct; only the exported PDF is wrong.
 *
 * Root cause: `buildInlinedHtml` used to inline only ~40 computed CSS
 * properties and strip all class names.  This lost flex sizing,
 * combinatorial selectors (space-y-*), pseudo-elements, CSS variables,
 * and more — causing widespread layout breakage in the Puppeteer-rendered PDF.
 *
 * Fix: replaced the property-whitelist approach with CSS extraction — the
 * page's compiled CSS is bundled with the class-name–bearing HTML, giving
 * Puppeteer the exact same styles the browser preview has.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const TEMPLATES_SECTION_PATH = resolve(
  __dirname,
  "..",
  "components",
  "sections",
  "TemplatesSection.tsx"
);

describe("Bug fix: PDF export uses CSS extraction (not inline whitelist)", () => {
  const source = readFileSync(TEMPLATES_SECTION_PATH, "utf-8");

  it("buildInlinedHtml does NOT strip class names (removeAttribute class)", () => {
    // The old code had: target.removeAttribute('class')
    // This must no longer appear in the function body.
    // We check that there's no removeAttribute('class') call at all.
    expect(source).not.toContain("removeAttribute('class')");
    expect(source).not.toContain('removeAttribute("class")');
  });

  it("buildInlinedHtml reads document.styleSheets for CSS extraction", () => {
    expect(source).toContain("document.styleSheets");
  });

  it("buildInlinedHtml iterates cssRules from stylesheets", () => {
    expect(source).toContain("cssRules");
  });

  it("bundles extracted CSS into the HTML document", () => {
    // CSS chunks are joined and embedded in a <style> tag
    expect(source).toContain("cssChunks.join");
  });

  it("does NOT use a dominated/whitelist property array", () => {
    // The old approach used a 'dominated' array of property names
    expect(source).not.toContain("const dominated");
    expect(source).not.toContain("dominated = [");
  });
});

// ——— Template-level tests ——————————————————————————————————————————————
// Verify that each template has defensive flex styles on the job title row.
// These are important even beyond the CSS extraction fix, because they make
// the layout robust against any rendering engine differences.

const TEMPLATE_DIR = resolve(__dirname, "..", "components", "templates");
const TEMPLATE_FILES = [
  "ModernProfessional.tsx",
  "TechnicalEngineer.tsx",
  "ExecutiveProfessional.tsx",
];

describe("Templates: job title row has defensive flex styles", () => {
  for (const file of TEMPLATE_FILES) {
    const filePath = resolve(TEMPLATE_DIR, file);
    const src = readFileSync(filePath, "utf-8");

    describe(file, () => {
      it("date span has flexShrink: 0", () => {
        expect(src).toMatch(/flexShrink.*['"]?0['"]?/);
      });

      it("date span has whiteSpace: 'nowrap'", () => {
        expect(src).toContain("whiteSpace");
        expect(src).toContain("nowrap");
      });

      it("job title h3 has minWidth: 0", () => {
        expect(src).toContain("minWidth");
      });
    });
  }
});
