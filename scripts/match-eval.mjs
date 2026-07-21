#!/usr/bin/env node
// Gold-set eval for AI match scoring. Runs each fixture in eval/match-fixtures/
// through the REAL ai_match_reality_check contract (the production match path in
// processMatchOnly) and checks the output against expected score bands, required
// missing-keyword flags, required strength credits, and contract invariants.
// Guards the anti-inflation rubric: a prompt change that re-adds score anchors
// shows up as the weak/stuffing fixtures drifting above their bands.
//
//   npm run eval:match                 # run all fixtures (needs OPENROUTER_API_KEY)
//   npm run eval:match -- --selftest   # validate the scorer offline, no API key
//   EVAL_THRESHOLD=0.85 npm run eval:match
//
// Offline: if a fixture has no API key available but a sibling cache file
// eval/match-fixtures/<name>.actual.json exists, that cached output is scored
// instead — so you can re-score without spending tokens.

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const FIXTURE_DIR = join(ROOT, "eval", "match-fixtures");
const THRESHOLD = Number(process.env.EVAL_THRESHOLD ?? "0.8");
const CONTRACT_ID = "ai_match_reality_check";

// Dynamic import() needs a file:// URL, not a bare absolute path — required on Windows.
const importPath = (...segments) => import(pathToFileURL(join(...segments)).href);

const { scoreMatch } = await importPath(ROOT, "eval", "match-score.mjs");
const { getMissingFixtureCaches, getInvariantGroupFailures } = await importPath(ROOT, "eval", "match-eval-guards.mjs");

// Minimal .env loader (no dependency) so the key can live in .env like the app.
const loadDotEnv = () => {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
};
loadDotEnv();

const C = { reset: "\x1b[0m", dim: "\x1b[2m", green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", bold: "\x1b[1m" };
const colorFor = (s) => (s === "pass" ? C.green : s === "partial" ? C.yellow : C.red);
const pct = (n) => `${(n * 100).toFixed(0)}%`.padStart(4);

const MAX_RETRY = 2;
const isTransient = (err) =>
  err?.retryable === true ||
  /timed out|timeout|aborted/i.test(err?.message || "") ||
  [429, 500, 502, 503, 504].includes(err?.status);

const runMatch = async (fixture) => {
  const { executeAiContract } = await importPath(ROOT, "netlify", "lib", "ai-contracts", "executor.js");
  const input = {
    resumeText: fixture.resumeText,
    jobDescription: fixture.jobDescription,
    language: fixture.language || "en",
  };
  for (let attempt = 0; ; attempt++) {
    try {
      return await executeAiContract(CONTRACT_ID, input);
    } catch (err) {
      if (isTransient(err) && attempt < MAX_RETRY) {
        console.log(`${C.dim}  transient (${err.message?.slice(0, 40)}…) — retry ${attempt + 1}/${MAX_RETRY}${C.reset}`);
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
};

const printCard = (fixtureName, result, score) => {
  const overallStatus = !result.passed ? "fail" : result.overall >= 0.999 ? "pass" : result.overall >= THRESHOLD ? "partial" : "fail";
  const scoreNote = typeof score === "number" ? `  ${C.dim}(model score ${score})${C.reset}` : "";
  console.log(`\n${C.bold}${fixtureName}${C.reset}  ${colorFor(overallStatus)}${pct(result.overall)} overall${C.reset}${scoreNote}`);
  for (const cat of result.categories) {
    console.log(`  ${colorFor(cat.status)}${pct(cat.score)}${C.reset}  ${cat.name.padEnd(20)} ${C.dim}${cat.detail}${C.reset}`);
  }
  if (result.hardFailures?.length) {
    console.log(`  ${C.red}hard failures:${C.reset} ${result.hardFailures.join("; ")}`);
  }
};

const selftest = () => {
  // Feed an in-band actual and an inflated/broken one against the weak-match
  // fixture; confirm the scorer separates them.
  const expected = JSON.parse(readFileSync(join(FIXTURE_DIR, "weak-match-retail-to-swe.json"), "utf8")).expected;
  const good = {
    score: 22,
    categoryScores: {
      hard_skills: { score: 4, max: 40, matched: ["Excel"], missing: ["Python", "Django", "PostgreSQL", "Docker"] },
      experience: { score: 5, max: 30, gaps: ["no software development experience"] },
      education: { score: 3, max: 15, missing: ["B.Sc. computer science"] },
      soft_skills: { score: 10, max: 15, matched: ["team leadership"] },
    },
    strongMatches: ["team leadership", "customer service"],
    missingKeywords: ["Python", "Django", "PostgreSQL", "Docker", "REST APIs", "CI/CD"],
    summary_bullets: ["No backend development experience", "All required technical skills missing", "Education below requirement"],
    reasoning: "The resume shows retail operations experience with no evidence of any required engineering skill.",
  };
  const inflated = {
    score: 85,
    categoryScores: {
      hard_skills: { score: 55, max: 60 },
      experience: { score: 30, max: 30 },
      education: { score: 15, max: 15 },
      soft_skills: { score: 15, max: 15 },
    },
    strongMatches: [],
    missingKeywords: [],
    summary_bullets: [],
    reasoning: "",
  };

  const g = scoreMatch(expected, good);
  const b = scoreMatch(expected, inflated);
  printCard("selftest: honest low score", g, good.score);
  printCard("selftest: inflated score, no gaps flagged", b, inflated.score);
  const okay = g.overall > 0.9 && g.passed && b.overall < 0.5 && !b.passed;
  console.log(`\n${okay ? C.green + "selftest PASSED" : C.red + "selftest FAILED"}${C.reset}  (good=${pct(g.overall)}, inflated=${pct(b.overall)})`);
  process.exit(okay ? 0 : 1);
};

const main = async () => {
  if (process.argv.includes("--selftest")) return selftest();

  const files = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".json") && !f.endsWith(".actual.json"));
  if (files.length === 0) {
    console.error(`No fixtures in ${FIXTURE_DIR}`);
    process.exit(1);
  }

  const hasKey = Boolean(process.env.OPENROUTER_API_KEY);
  const missingCaches = getMissingFixtureCaches(
    files,
    hasKey,
    (file) => existsSync(join(FIXTURE_DIR, file.replace(/\.json$/, ".actual.json"))),
  );
  if (missingCaches.length) {
    console.error(`${C.red}Cannot evaluate fixtures without OPENROUTER_API_KEY or caches: ${missingCaches.join(", ")}${C.reset}`);
    process.exit(1);
  }
  if (!hasKey) console.log(`${C.yellow}No OPENROUTER_API_KEY — scoring cached *.actual.json.${C.reset}`);

  const results = [];
  for (const file of files) {
    const fixture = JSON.parse(readFileSync(join(FIXTURE_DIR, file), "utf8"));
    const cachePath = join(FIXTURE_DIR, file.replace(/\.json$/, ".actual.json"));
    let actual;
    try {
      if (hasKey) {
        actual = await runMatch(fixture);
        // Cache the live output so the set can be re-scored offline without tokens.
        writeFileSync(cachePath, JSON.stringify(actual, null, 2) + "\n");
      } else if (existsSync(cachePath)) actual = JSON.parse(readFileSync(cachePath, "utf8"));
      else throw new Error(`Missing cached output for ${file}`);
    } catch (err) {
      console.log(`\n${C.red}FAIL ${fixture.name}: ${err.message}${C.reset}`);
      results.push({ name: fixture.name, overall: 0 });
      continue;
    }
    const result = scoreMatch(fixture.expected, actual);
    printCard(fixture.name, result, actual?.score);
    results.push({ name: fixture.name, overall: result.overall, passed: result.passed, expected: fixture.expected, actual });
  }

  if (results.length === 0) {
    console.log(`\n${C.yellow}Nothing scored. Set OPENROUTER_API_KEY or add *.actual.json caches.${C.reset}`);
    process.exit(0);
  }

  const invariantFailures = getInvariantGroupFailures(results);
  for (const failure of invariantFailures) {
    console.log(`  ${C.red}invariance failure:${C.reset} ${failure.group} crossed bands (${failure.bands.join(', ')})`);
    for (const name of failure.names) {
      const result = results.find((entry) => entry.name === name);
      if (result) result.passed = false;
    }
  }

  const avg = results.reduce((a, r) => a + r.overall, 0) / results.length;
  const below = results.filter((r) => !r.passed || r.overall < THRESHOLD);
  console.log(`\n${C.bold}═══ ${results.length} fixtures, mean ${pct(avg)}, threshold ${pct(THRESHOLD)} ═══${C.reset}`);
  for (const r of below) console.log(`  ${C.red}below threshold:${C.reset} ${r.name} (${pct(r.overall)})`);
  process.exit(below.length > 0 ? 1 : 0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
