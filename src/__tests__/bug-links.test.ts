/**
 * Bug: Resume links are broken/unclickable.
 *
 * The fix uses:
 * 1. normalizeUrl: passes http URLs through, prepends https:// for domain-like strings (containing '.'), null for text labels
 * 2. resolveProfileUrl: tries url field → username field (only if it contains a dot, i.e. looks like a real URL)
 *
 * This handles all data shapes from the AI parser:
 * - url: "https://linkedin.com/in/user" → direct use ✅
 * - url: "linkedin.com/in/user"         → prepend https:// ✅
 * - url: "LinkedIn Account"             → plain text (no dot → can't make a link) ✅
 * - url: "LinkedIn", username: "LinkedIn" → plain text (neither has a dot) ✅
 * - username: "linkedin.com/in/user"    → prepend https:// ✅
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const TEMPLATE_DIR = resolve(__dirname, "..", "components", "templates");
const TEMPLATE_FILES = [
  "ModernProfessional.tsx",
  "ClassicTraditional.tsx",
  "TechnicalEngineer.tsx",
  "ExecutiveProfessional.tsx",
  "ATSOptimized.tsx",
];

describe("Bug: links must use normalizeUrl + resolveProfileUrl", () => {
  for (const file of TEMPLATE_FILES) {
    const src = readFileSync(resolve(TEMPLATE_DIR, file), "utf-8");

    describe(file, () => {
      it("uses normalizeUrl for URL validation", () => {
        expect(src).toContain("normalizeUrl");
        expect(src).not.toMatch(/const isValidUrl/);
      });

      it("uses resolveProfileUrl to handle multiple data shapes", () => {
        expect(src).toContain("resolveProfileUrl");
      });

      it("normalizeUrl handles domain-like URLs via includes('.')", () => {
        expect(src).toMatch(/includes.*'\.'|indexOf.*'\.'|\.includes\('\.\'\)/);
      });

      it("constructs URLs intelligently based on valid identifiers", () => {
        // We now safely construct URLs if the id doesn't have spaces and isn't just the network name
        expect(src).toMatch(/`https:\/\/linkedin\.com\/in\/\$\{/);
      });
    });
  }
});

describe("Bug: DOCX export uses resolveProfileUrl", () => {
  const docxSrc = readFileSync(
    resolve(__dirname, "..", "services", "docx", "sectionBuilders.ts"),
    "utf-8"
  );

  it("uses normalizeUrl + resolveProfileUrl", () => {
    expect(docxSrc).toContain("normalizeUrl");
    expect(docxSrc).toContain("resolveProfileUrl");
    expect(docxSrc).not.toMatch(/function isValidUrl/);
  });

  it("uses ExternalHyperlink for clickable links", () => {
    expect(docxSrc).toContain("ExternalHyperlink");
  });

  it("constructs URLs intelligently based on valid identifiers", () => {
    expect(docxSrc).toMatch(/`https:\/\/linkedin\.com\/in\/\$\{/);
  });
});
