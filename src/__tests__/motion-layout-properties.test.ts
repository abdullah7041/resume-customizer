import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("motion layout performance", () => {
  it("does not animate grid tracks in the score breakdown expansion", () => {
    const source = readSource("../components/ScoreBreakdown.tsx");

    expect(source).not.toContain("gridTemplateRows");
  });

  it("does not animate grid tracks in the formatting title reveal", () => {
    const source = readSource("../components/ui/FormattingPanel.tsx");

    expect(source).not.toContain("gridTemplateColumns");
  });
});
