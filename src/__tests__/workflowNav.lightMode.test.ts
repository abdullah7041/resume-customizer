import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

// Light-mode workflow bars must stay readable over the warm hero background:
// dark-enough text on warm surfaces, locked items readable (not pale-on-pale),
// emerald active state. These assertions guard against regressing to dim text.
describe("workflow navigation — light-mode contrast", () => {
  it("MobileWorkflowNav uses readable light-mode text and a surfaced locked state", () => {
    const src = read("../components/ui/MobileWorkflowNav.tsx");
    // Inactive items use darker text than the old gray-700.
    expect(src).toContain("text-gray-800");
    // Locked items sit on a surface (not transparent pale-on-pale) and stay legible.
    expect(src).toContain("bg-[color:var(--surface-control)] text-gray-600 opacity-90");
    // Active state keeps emerald accent + dark text.
    expect(src).toContain("bg-emerald-600 text-white");
  });

  it("WorkflowStepper gives locked steps a readable light-mode surface", () => {
    const src = read("../components/ui/WorkflowStepper.tsx");
    expect(src).toContain("bg-[color:var(--surface-control)] opacity-80 dark:bg-transparent dark:opacity-60");
    // Active label remains emerald, upcoming/locked labels remain dark enough.
    expect(src).toContain("text-emerald-800 dark:text-emerald-200");
    // Locked marker text bumped off the faint gray-400.
    expect(src).not.toContain("text-gray-400 dark:bg-white/5");
  });
});
