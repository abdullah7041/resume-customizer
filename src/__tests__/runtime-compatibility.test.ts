import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runtimeSources = [
  "../components/Vision2030/SectorBreakdown.tsx",
  "../components/Vision2030/Vision2030Section.tsx",
  "../components/sections/BulkAnalysisSection.tsx",
  "../lib/utils/keywordBolder.ts",
  "../lib/utils/resumeText.ts",
  "../lib/utils/truthCheckSummary.ts",
];

describe("ES2020 runtime compatibility", () => {
  it("does not ship Array.prototype.toSorted without a polyfill", () => {
    for (const sourcePath of runtimeSources) {
      const source = readFileSync(new URL(sourcePath, import.meta.url), "utf8");
      expect(source, sourcePath).not.toContain(".toSorted(");
    }
  });
});
