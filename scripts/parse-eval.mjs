#!/usr/bin/env node
// Gold-set eval for the resume parser. Runs each fixture in eval/fixtures/ through
// the REAL parse_resume contract and scores the JSON field-by-field against the
// fixture's expected values. Use it to measure parser changes instead of eyeballing
// one CV.
//
//   npm run eval:parse                 # run all fixtures (needs OPENROUTER_API_KEY)
//   npm run eval:parse -- --selftest   # validate the scorer offline, no API key
//   EVAL_THRESHOLD=0.85 npm run eval:parse
//
// Offline: if a fixture has no API key available but a sibling cache file
// eval/fixtures/<name>.actual.json exists, that cached parser output is scored
// instead — so you can re-score without spending tokens.

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";

import {
  APPROXIMATE_PRICING_SNAPSHOT_DATE,
  MODELS,
} from "../netlify/lib/model-registry.js";
import {
  aggregateGoldAttempts,
  buildGoldEvaluationAttempts,
  buildGoldScoreSummaries,
  classifyGoldResult,
  parseGoldEvaluatorOptions,
  unwrapEvaluationResponse,
} from "./lib/model-eval/gold-evaluator-options.mjs";
import {
  createEvaluationSession,
  writeEvaluationReport,
} from "./lib/model-eval/reporting.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");
const FIXTURE_DIR = join(ROOT, "eval", "fixtures");
const THRESHOLD = Number(process.env.EVAL_THRESHOLD ?? "0.8");

// Dynamic import() needs a file:// URL, not a bare absolute path — required on Windows.
const importPath = (...segments) => import(pathToFileURL(join(...segments)).href);

const { scoreResume } = await importPath(ROOT, "eval", "score.mjs");

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

const parseJsonLoose = (content) => {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(content.slice(start, end + 1));
    throw new Error("parser did not return JSON");
  }
};

const MAX_RETRY = 2;
const isTransient = (err) =>
  /timed out|timeout|aborted/i.test(err?.message || "") || [429, 500, 502, 503, 504].includes(err?.status);

const runParser = async (text, contractOptions = {}, retryTransient = true) => {
  const { aiContracts } = await importPath(ROOT, "netlify", "lib", "ai-contracts", "contracts", "index.js");
  if (contractOptions.disableFallback === true) {
    const { executeAiContract } = await importPath(ROOT, "netlify", "lib", "ai-contracts", "executor.js");
    return executeAiContract("parse_resume", { inputData: text }, contractOptions);
  }

  const { callOpenRouter } = await importPath(ROOT, "netlify", "lib", "openrouter-client.js");
  const contract = aiContracts.parse_resume;
  const messages = contract.buildMessages({ inputData: text });
  // Production retries transient failures client-side; mirror that so a load blip
  // (timeout/5xx) doesn't zero a fixture. Parse errors are NOT retried — at temp 0
  // they are deterministic, so a retry would just burn tokens for the same result.
  for (let attempt = 0; ; attempt++) {
    let content;
    try {
      content = await callOpenRouter(contract.modelType, messages, contract.jsonSchema, {
        maxTokens: contract.maxTokens,
        timeoutMs: contract.timeoutMs,
        temperature: contract.temperature,
        reasoningBudget: contract.reasoningBudget,
        responseFormat: contract.responseFormat,
        featureName: contract.featureName,
      });
    } catch (err) {
      if (retryTransient && isTransient(err) && attempt < MAX_RETRY) {
        console.log(`${C.dim}  transient (${err.message?.slice(0, 40)}…) — retry ${attempt + 1}/${MAX_RETRY}${C.reset}`);
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
    return parseJsonLoose(content);
  }
};

const fixtureIdFor = (file) => file.replace(/\.json$/, "");
const matchesFixture = (file, fixture, filter) => (
  !filter
  || filter === file
  || filter === fixtureIdFor(file)
  || filter === fixture.name
);

const runCandidateEvaluation = async (options, files) => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("Candidate evaluation requires OPENROUTER_API_KEY for direct OpenRouter execution.");
  }

  const fixtures = files
    .map((file) => ({
      file,
      fixture: JSON.parse(readFileSync(join(FIXTURE_DIR, file), "utf8")),
    }))
    .filter(({ file, fixture }) => matchesFixture(file, fixture, options.fixture));
  if (fixtures.length === 0) {
    throw new Error(`No fixtures matched ${options.fixture || FIXTURE_DIR}.`);
  }

  const fixtureById = new Map(fixtures.map(({ file, fixture }) => [fixtureIdFor(file), { file, fixture }]));
  const plan = buildGoldEvaluationAttempts({
    feature: "parse",
    fixtureIds: [...fixtureById.keys()],
    models: options.models,
    runs: options.runs,
  });
  const attempts = [];

  for (const planned of plan) {
    const { file, fixture } = fixtureById.get(planned.fixtureId);
    const startedAt = Date.now();
    try {
      const execution = await runParser(fixture.text, planned.contractOptions, false);
      const {
        value: actual,
        approximateCostUsd,
      } = unwrapEvaluationResponse({
        response: execution,
        modelId: planned.modelId,
      });
      const latencyMs = Date.now() - startedAt;
      const result = scoreResume(fixture.expected, actual);
      const qualityPassed = result.overall >= THRESHOLD;
      if (options.cachePolicy.write) {
        const cachePath = join(FIXTURE_DIR, file.replace(/\.json$/, ".actual.json"));
        writeFileSync(cachePath, JSON.stringify(actual, null, 2) + "\n");
      }
      printCard(
        `${fixture.name} [${planned.modelId}, run ${planned.run}/${options.runs}]`,
        result,
      );
      attempts.push({
        ...planned,
        latencyMs,
        score: result.overall,
        qualityPassed,
        approximateCostUsd,
        classification: classifyGoldResult({ schemaValid: true }),
      });
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      console.log(`\n${C.red}FAIL ${fixture.name} [${planned.modelId}, run ${planned.run}/${options.runs}]: ${error.message}${C.reset}`);
      attempts.push({
        ...planned,
        latencyMs,
        score: 0,
        qualityPassed: false,
        classification: classifyGoldResult({ error }),
      });
    }
  }

  const aggregate = aggregateGoldAttempts(attempts);
  const session = createEvaluationSession({
    feature: "parse",
    reportDir: options.reportDir || undefined,
  });
  const report = writeEvaluationReport(session, {
    models: options.models,
    fixtureIds: [...fixtureById.keys()],
    options: {
      runs: options.runs,
      fixture: options.fixture,
      stage: options.stage,
      updateCache: options.updateCache,
      disableFallback: true,
      reportDir: options.reportDir,
    },
    outcomeSummary: aggregate.outcomeSummary,
    scoreSummaries: buildGoldScoreSummaries(attempts),
    latencies: aggregate.latencies,
    approximateCostUsd: aggregate.approximateCostUsd,
    pricingSnapshotTimestamp: APPROXIMATE_PRICING_SNAPSHOT_DATE,
  });
  const qualityFailed = aggregate.outcomeSummary.qualityFailures > 0;

  console.log(`\n${C.bold}═══ ${attempts.length} direct attempts, mean ${pct(aggregate.meanScore ?? 0)}, approximate cost ${aggregate.approximateCostUsd ?? "unknown"} USD ═══${C.reset}`);
  console.log(`${C.dim}Report: ${report.directory}${C.reset}`);
  process.exit(aggregate.requiredFailure || qualityFailed ? 1 : 0);
};

const printCard = (fixtureName, result) => {
  const overallStatus = result.overall >= 0.999 ? "pass" : result.overall >= THRESHOLD ? "partial" : "fail";
  console.log(`\n${C.bold}${fixtureName}${C.reset}  ${colorFor(overallStatus)}${pct(result.overall)} overall${C.reset}`);
  for (const cat of result.categories) {
    console.log(`  ${colorFor(cat.status)}${pct(cat.score)}${C.reset}  ${cat.name.padEnd(26)} ${C.dim}${cat.detail}${C.reset}`);
  }
};

const selftest = async () => {
  // Feed a near-perfect actual and a broken one; confirm the scorer separates them.
  const expected = JSON.parse(readFileSync(join(FIXTURE_DIR, "abdullah-bi-analyst.json"), "utf8")).expected;
  const good = {
    basics: {
      name: "Abdullah Bin Ahmed",
      label: "Senior Business Intelligence Analyst & Data Architect",
      location: { city: "Dammam", countryCode: "Saudi Arabia" },
      summary: "Data-driven Business Intelligence analyst, expert in SQL databases, Power BI dashboards and data warehousing.",
      url: "abdullahfile.vercel.app",
      profiles: [ { network: "LinkedIn", url: "linkedin.com/in/3binahmed" }, { network: "GitHub", url: "github.com/abdullah7041" }, { network: "Portfolio", url: "abdullahfile.vercel.app" } ],
    },
    work: [
      { name: "Al Ghalia", position: "Senior Data Analyst & BI Specialist", startDate: "Mar 2020", endDate: "Present", highlights: ["a", "b", "c", "d"] },
      { name: "Watheq", position: "Lead Product Engineer & Data Architect", startDate: "Jan 2026", endDate: "Present", highlights: ["a", "b", "c"] },
      { name: "CB&I", position: "Construction Data Specialist", startDate: "Jun 2018", endDate: "Jun 2019", highlights: ["a", "b"] },
    ],
    education: [{ institution: "Saudi Petroleum Services Polytechnic", area: "Pipefitting Technology" }],
    skills: [{ name: "BI", keywords: ["Power BI", "Power Query", "SQL", "PostgreSQL", "ETL", "Node.js", "TypeScript", "n8n"] }],
    languages: [{ language: "Arabic", fluency: "Native" }, { language: "English", fluency: "Professional" }],
    certificates: [{ name: "Google Data Analytics Professional Certificate" }, { name: "Leadership & Business Management (McKinsey & Company)" }],
  };
  const broken = { basics: { name: "Abdullah Bin Ahmed" }, work: [] };

  const g = scoreResume(expected, good);
  const b = scoreResume(expected, broken);
  printCard("selftest: complete parse", g);
  printCard("selftest: broken parse (no location/summary/work)", b);
  const okay = g.overall > 0.9 && b.overall < 0.5;
  console.log(`\n${okay ? C.green + "selftest PASSED" : C.red + "selftest FAILED"}${C.reset}  (good=${pct(g.overall)}, broken=${pct(b.overall)})`);
  process.exit(okay ? 0 : 1);
};

const main = async () => {
  const options = parseGoldEvaluatorOptions({
    feature: "parse",
    defaultModelId: MODELS.lite,
    argv: process.argv.slice(2),
  });
  if (options.selftest) return selftest();

  const files = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".json") && !f.endsWith(".actual.json"));
  if (files.length === 0) {
    console.error(`No fixtures in ${FIXTURE_DIR}`);
    process.exit(1);
  }
  if (options.mode === "evaluation") {
    return runCandidateEvaluation(options, files);
  }

  const hasKey = Boolean(process.env.OPENROUTER_API_KEY);
  if (!hasKey) console.log(`${C.yellow}No OPENROUTER_API_KEY — scoring cached *.actual.json where present, skipping the rest.${C.reset}`);

  const results = [];
  for (const file of files) {
    const fixture = JSON.parse(readFileSync(join(FIXTURE_DIR, file), "utf8"));
    const cachePath = join(FIXTURE_DIR, file.replace(/\.json$/, ".actual.json"));
    let actual;
    try {
      if (hasKey) {
        actual = await runParser(fixture.text);
        // Cache the live output so the set can be re-scored offline without tokens.
        writeFileSync(cachePath, JSON.stringify(actual, null, 2) + "\n");
      } else if (existsSync(cachePath)) actual = JSON.parse(readFileSync(cachePath, "utf8"));
      else {
        console.log(`\n${C.dim}skip ${fixture.name} (no key, no cache)${C.reset}`);
        continue;
      }
    } catch (err) {
      console.log(`\n${C.red}FAIL ${fixture.name}: ${err.message}${C.reset}`);
      results.push({ name: fixture.name, overall: 0 });
      continue;
    }
    const result = scoreResume(fixture.expected, actual);
    printCard(fixture.name, result);
    results.push({ name: fixture.name, overall: result.overall });
  }

  if (results.length === 0) {
    console.log(`\n${C.yellow}Nothing scored. Set OPENROUTER_API_KEY or add *.actual.json caches.${C.reset}`);
    process.exit(0);
  }

  const avg = results.reduce((a, r) => a + r.overall, 0) / results.length;
  const below = results.filter((r) => r.overall < THRESHOLD);
  console.log(`\n${C.bold}═══ ${results.length} fixtures, mean ${pct(avg)}, threshold ${pct(THRESHOLD)} ═══${C.reset}`);
  for (const r of below) console.log(`  ${C.red}below threshold:${C.reset} ${r.name} (${pct(r.overall)})`);
  process.exit(below.length > 0 ? 1 : 0);
};

if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
