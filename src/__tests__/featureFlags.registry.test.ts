import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { FEATURE_FLAGS, resolveFlag } from "@/lib/featureFlags/registry";
import type { FeatureFlagName } from "@/types/featureFlags";

const ALL_FLAG_NAMES: FeatureFlagName[] = [
  "truthCheck",
  "aiMatch",
  "optimize",
  "templatesExport",
  "interview",
  "bulkAnalysis",
  "coverLetter",
  "vision2030",
  "pipeline",
  "jobFeed",
  "onboardingChat",
  "referral",
  "feedback",
  "hrSuperSaudOverlay",
  "saudiNationalityToggle",
];

const TESTS_ROOT = join(__dirname); // src/__tests__

describe("FEATURE_FLAGS registry", () => {
  it("has a complete entry for every FeatureFlagName", () => {
    for (const name of ALL_FLAG_NAMES) {
      const def = FEATURE_FLAGS[name];
      expect(def, `missing registry entry for ${name}`).toBeDefined();
      expect(def.name).toBe(name);
      expect(typeof def.label).toBe("string");
      expect(def.label.length).toBeGreaterThan(0);
      expect(typeof def.description).toBe("string");
      expect(def.description.length).toBeGreaterThan(0);
      expect(["stable", "beta", "experimental"]).toContain(def.maturity);
      expect(Array.isArray(def.testFiles)).toBe(true);
    }
  });

  it("does not contain any registry keys outside FeatureFlagName", () => {
    const registryKeys = Object.keys(FEATURE_FLAGS);
    expect(registryKeys.sort()).toEqual([...ALL_FLAG_NAMES].sort());
  });

  it("defaults every flag to enabled (ship = zero behavior change)", () => {
    for (const name of ALL_FLAG_NAMES) {
      expect(FEATURE_FLAGS[name].defaultEnabled, `${name} must default to true`).toBe(true);
    }
  });

  it("every testFiles path exists on disk", () => {
    for (const name of ALL_FLAG_NAMES) {
      for (const file of FEATURE_FLAGS[name].testFiles) {
        const resolved = file.startsWith("src/")
          ? join(TESTS_ROOT, "..", "..", file)
          : join(TESTS_ROOT, file);
        expect(existsSync(resolved), `${name} -> ${file} not found at ${resolved}`).toBe(true);
      }
    }
  });
});

describe("resolveFlag", () => {
  it("ignores overrides when isDev is false", () => {
    expect(resolveFlag("truthCheck", { truthCheck: false }, false)).toBe(true);
    expect(resolveFlag("optimize", { optimize: false }, false)).toBe(
      FEATURE_FLAGS.optimize.defaultEnabled
    );
  });

  it("applies overrides when isDev is true", () => {
    expect(resolveFlag("truthCheck", { truthCheck: false }, true)).toBe(false);
    expect(resolveFlag("truthCheck", { truthCheck: true }, true)).toBe(true);
  });

  it("falls back to the default when isDev is true but no override is set", () => {
    expect(resolveFlag("aiMatch", {}, true)).toBe(FEATURE_FLAGS.aiMatch.defaultEnabled);
  });
});
