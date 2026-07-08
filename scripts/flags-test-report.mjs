/**
 * Generates the feature-flag test report consumed by the dev dashboard
 * (`/dev/flags`). Runs vitest ONLY over the test files mapped in the flag
 * registry and writes a normalized pass/fail summary per flag.
 *
 * Run via tsx: `npm run flags:report`. The registry is a `.ts` module whose
 * only import is `import type`, which esbuild/tsx elides — so no `@/` path
 * alias resolution is needed at runtime.
 *
 * Output: src/lib/featureFlags/report/flag-test-report.json (gitignored).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const TESTS_ROOT = join(REPO_ROOT, "src", "__tests__");
const REPORT_DIR = join(REPO_ROOT, "src", "lib", "featureFlags", "report");
const REPORT_FILE = join(REPORT_DIR, "flag-test-report.json");
const TMP_JSON = join(REPORT_DIR, ".vitest-raw.json");

const norm = (p) => p.replace(/\\/g, "/");

/** Resolve a registry test-file entry to an absolute path. */
function resolveTestFile(file) {
  return file.startsWith("src/") ? join(REPO_ROOT, file) : join(TESTS_ROOT, file);
}

async function main() {
  const registryUrl = pathToFileURL(
    join(REPO_ROOT, "src", "lib", "featureFlags", "registry.ts")
  ).href;
  const { FEATURE_FLAGS } = await import(registryUrl);

  const flagNames = Object.keys(FEATURE_FLAGS);

  // Union of all mapped test files (absolute, normalized) that exist on disk.
  const fileToFlags = new Map();
  for (const name of flagNames) {
    for (const file of FEATURE_FLAGS[name].testFiles) {
      const abs = norm(resolveTestFile(file));
      if (!existsSync(abs)) {
        console.warn(`[flags:report] mapped test file missing: ${name} -> ${file}`);
        continue;
      }
      if (!fileToFlags.has(abs)) fileToFlags.set(abs, []);
      fileToFlags.get(abs).push(name);
    }
  }

  const allFiles = [...fileToFlags.keys()];
  mkdirSync(REPORT_DIR, { recursive: true });

  /** @type {Record<string, {status:"pass"|"fail",total:number,failed:number}>} */
  const perFile = {};

  // Paths RELATIVE to the repo root. The repo path itself contains a space
  // (…/NoteBook Pc/…); an absolute path would risk being split as a shell arg.
  // Repo-relative paths have no spaces.
  const relTmp = norm(relative(REPO_ROOT, TMP_JSON));

  // Resolve vitest's JS entry and run it with `node` directly. Invoking the
  // `npx`/`.cmd` wrapper via execFileSync mangles args on Windows (the
  // `--outputFile` never lands); node + the .mjs entry passes args cleanly.
  const require = createRequire(import.meta.url);
  const vitestPkg = require.resolve("vitest/package.json");
  const vitestBin = join(dirname(vitestPkg), "vitest.mjs");

  // Run ONE file per vitest invocation. On this 8GB box a single 16-file run can
  // OOM/crash a worker before the JSON reporter writes anything, losing the whole
  // report; per-file runs keep memory low and isolate any single-file failure.
  for (const abs of allFiles) {
    const rel = norm(relative(REPO_ROOT, abs));
    console.log(`[flags:report] running: ${rel}`);
    try {
      execFileSync(
        process.execPath,
        [vitestBin, "run", rel, "--reporter=json", `--outputFile=${relTmp}`, "--pool=forks", "--maxWorkers=1"],
        { cwd: REPO_ROOT, stdio: ["ignore", "ignore", "inherit"] }
      );
    } catch {
      // Non-zero exit just means tests failed — the JSON report is still written.
    }

    if (!existsSync(TMP_JSON)) {
      console.warn(`[flags:report] no report produced for ${rel} (crash?) — marking fail`);
      perFile[norm(abs)] = { status: "fail", total: 0, failed: 0 };
      continue;
    }
    const raw = JSON.parse(readFileSync(TMP_JSON, "utf8"));
    for (const tr of raw.testResults ?? []) {
      const key = norm(tr.name);
      const assertions = tr.assertionResults ?? [];
      const failed = assertions.filter((a) => a.status === "failed").length;
      perFile[key] = {
        status: tr.status === "passed" && failed === 0 ? "pass" : "fail",
        total: assertions.length,
        failed,
      };
    }
    rmSync(TMP_JSON, { force: true });
  }

  /** @type {Record<string, Array<{file:string,status:string,total:number,failed:number}>>} */
  const results = {};
  for (const name of flagNames) {
    results[name] = FEATURE_FLAGS[name].testFiles.map((file) => {
      const abs = norm(resolveTestFile(file));
      const r = perFile[abs];
      return {
        file,
        status: r?.status ?? "fail",
        total: r?.total ?? 0,
        failed: r?.failed ?? 0,
      };
    });
  }

  const report = { generatedAt: new Date().toISOString(), results };
  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`[flags:report] wrote ${norm(REPORT_FILE)}`);
}

main().catch((err) => {
  console.error("[flags:report] failed:", err);
  process.exit(1);
});
