/**
 * Bug: Resume links are broken/unclickable.
 *
 * The fix uses shared helpers from `src/lib/utils/profileUrl.ts`:
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
import { normalizeUrl, resolveProfileUrl } from "../lib/utils/profileUrl";

const TEMPLATE_DIR = resolve(__dirname, "..", "components", "templates");
const TEMPLATE_FILES = [
  "ModernProfessional.tsx",
  "TechnicalEngineer.tsx",
  "ExecutiveProfessional.tsx",
  "ATSOptimized.tsx",
];

describe("Bug: links must use normalizeUrl + resolveProfileUrl", () => {
  for (const file of TEMPLATE_FILES) {
    const src = readFileSync(resolve(TEMPLATE_DIR, file), "utf-8");

    describe(file, () => {
      it("imports the shared profileUrl helpers", () => {
        expect(src).toMatch(/from ['"]@\/lib\/utils\/profileUrl['"]/);
        expect(src).toContain("normalizeUrl");
        expect(src).toContain("resolveProfileUrl");
        expect(src).not.toMatch(/const isValidUrl/);
      });
    });
  }
});

describe("Bug: DOCX export uses the shared profileUrl helpers", () => {
  const docxSrc = readFileSync(
    resolve(__dirname, "..", "services", "docx", "sectionBuilders.ts"),
    "utf-8"
  );

  it("imports normalizeUrl + resolveProfileUrl", () => {
    expect(docxSrc).toMatch(/from ['"]\.\.\/\.\.\/lib\/utils\/profileUrl['"]/);
    expect(docxSrc).toContain("normalizeUrl");
    expect(docxSrc).toContain("resolveProfileUrl");
    expect(docxSrc).not.toMatch(/function isValidUrl/);
  });

  it("uses ExternalHyperlink for clickable links", () => {
    expect(docxSrc).toContain("ExternalHyperlink");
  });
});

describe("profileUrl helpers (shared by templates + DOCX export)", () => {
  describe("normalizeUrl", () => {
    it("passes through a full http(s) URL", () => {
      expect(normalizeUrl("https://linkedin.com/in/user")).toBe("https://linkedin.com/in/user");
    });

    it("prepends https:// to domain-like strings", () => {
      expect(normalizeUrl("linkedin.com/in/user")).toBe("https://linkedin.com/in/user");
    });

    it("returns null for plain text labels without a dot", () => {
      expect(normalizeUrl("LinkedIn Account")).toBeNull();
    });

    it("returns null for empty/undefined input", () => {
      expect(normalizeUrl(undefined)).toBeNull();
      expect(normalizeUrl("")).toBeNull();
    });
  });

  describe("resolveProfileUrl", () => {
    it("resolves a direct URL", () => {
      expect(resolveProfileUrl({ url: "https://linkedin.com/in/user", network: "linkedin" })).toBe(
        "https://linkedin.com/in/user"
      );
    });

    it("constructs a LinkedIn URL from a bare username", () => {
      expect(resolveProfileUrl({ username: "jane-doe", network: "linkedin" })).toBe(
        "https://linkedin.com/in/jane-doe"
      );
    });

    it("constructs a GitHub URL from a bare username", () => {
      expect(resolveProfileUrl({ username: "janedoe", network: "github" })).toBe(
        "https://github.com/janedoe"
      );
    });

    it("returns null when neither url nor username has a dot and matches the network name", () => {
      expect(resolveProfileUrl({ url: "LinkedIn", username: "LinkedIn", network: "linkedin" })).toBeNull();
    });

    it("prepends https:// when the username itself looks like a domain", () => {
      expect(resolveProfileUrl({ username: "linkedin.com/in/user", network: "linkedin" })).toBe(
        "https://linkedin.com/in/user"
      );
    });

    it("returns null for an undefined profile", () => {
      expect(resolveProfileUrl(undefined)).toBeNull();
    });
  });
});
