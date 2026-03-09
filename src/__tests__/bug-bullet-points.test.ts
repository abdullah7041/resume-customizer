/**
 * Bug: Bullet points render incorrectly in all templates except
 * ExecutiveProfessional.  Some use custom positioned spans (fragile),
 * some use en-dashes, some use Tailwind-only padding for disc markers.
 *
 * Expected: Every template uses the ExecutiveProfessional pattern —
 *   <ul style={{ paddingLeft: '16px', listStyleType: 'disc' }}>
 *     <li>text</li>
 *
 * This test checks that no template uses the broken bullet patterns:
 * - listStyleType: 'none' (hides native disc)
 * - absolute positioned spans for custom dots
 * - manual "•" <span> bullets with flex layout
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const TEMPLATE_DIR = resolve(__dirname, "..", "components", "templates");

// Templates that need fixing (all except ExecutiveProfessional)
const TEMPLATES_TO_FIX = [
  "ModernProfessional.tsx",
  "ClassicTraditional.tsx",
  "TechnicalEngineer.tsx",
  "ATSOptimized.tsx",
];

describe("Bug: bullet points must use native disc markers", () => {
  for (const file of TEMPLATES_TO_FIX) {
    const filePath = resolve(TEMPLATE_DIR, file);
    const src = readFileSync(filePath, "utf-8");

    describe(file, () => {
      it("does NOT use listStyleType: 'none' (which hides native bullets)", () => {
        // listStyleType: 'none' suppresses the native disc bullet —
        // the correct pattern uses listStyleType: 'disc' on the <ul>
        expect(src).not.toContain("listStyleType: 'none'");
      });

      it("does NOT use absolutely-positioned custom bullet spans", () => {
        // The ModernProfessional pattern used a tiny rounded-full span
        // positioned absolutely — this is fragile in PDF export
        expect(src).not.toContain("bg-gray-900 rounded-full");
      });

      it("does NOT use manual bullet character spans", () => {
        // ATSOptimized used <span className="me-2">•</span> — fragile
        expect(src).not.toContain('>•</span>');
      });

      it("does NOT use en-dash as bullet replacement", () => {
        // ClassicTraditional used an absolutely-positioned "–" span
        // We check for the insetInlineStart pattern used with en-dash bullets
        expect(src).not.toMatch(/insetInlineStart.*['"]0['"]/);
      });

      it("uses paddingLeft on <ul> for bullet indentation (inline style)", () => {
        // The correct pattern has paddingLeft as an inline style on <ul>
        expect(src).toContain("paddingLeft: '16px'");
      });

      it("uses listStyleType: 'disc' on <ul> (inline style)", () => {
        expect(src).toContain("listStyleType: 'disc'");
      });
    });
  }

  // Verify the reference template (ExecutiveProfessional) still has correct pattern
  describe("ExecutiveProfessional.tsx (reference)", () => {
    const src = readFileSync(
      resolve(TEMPLATE_DIR, "ExecutiveProfessional.tsx"),
      "utf-8"
    );

    it("uses the correct bullet pattern", () => {
      expect(src).toContain("listStyleType: 'disc'");
      expect(src).toContain("paddingLeft: '16px'");
      expect(src).not.toContain("listStyleType: 'none'");
    });
  });
});
