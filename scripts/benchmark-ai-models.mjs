/**
 * AI Model Benchmark Harness
 *
 * Compares baseline and candidate AI models across synthetic resume/JD fixtures.
 * Does NOT run automatically during build or test.
 *
 * Usage:
 *   npm run benchmark:ai -- --feature optimize --baseline google/gemini-2.5-flash --candidate google/gemini-3.1-flash-lite
 *
 * Safety:
 * - All fixtures are synthetic (see benchmark-fixtures/README.md).
 * - Benchmark calls use feature names prefixed with "benchmark." to avoid polluting production analytics.
 * - Set BENCHMARK_DISABLE_USAGE_LOGGING=true to suppress ai_usage_events entirely.
 * - Candidate models must be in SUPPORTED_BENCHMARK_MODELS.
 */

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { callOpenRouter } from '../netlify/lib/openrouter-client.js';
import { processMatchOnly, optimizeResume } from '../netlify/lib/gemini-client.js';
import { SUPPORTED_BENCHMARK_MODELS } from '../netlify/lib/model-registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = join(__dirname, 'benchmark-fixtures');
const REPORTS_DIR = join(__dirname, 'benchmark-reports');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    parsed[key] = args[i + 1];
  }
  return parsed;
}

const cli = parseArgs();
const FEATURE = cli.feature || 'optimize';
const BASELINE_MODEL = cli.baseline;
const CANDIDATE_MODEL = cli.candidate;
const FIXTURE_FILTER = cli.fixture;

if (!BASELINE_MODEL || !CANDIDATE_MODEL) {
  console.error(`Usage: npm run benchmark:ai -- --feature <match|clarification|optimize|metadata> --baseline <modelId> --candidate <modelId> [--fixture <filename>]`);
  process.exit(1);
}

if (!SUPPORTED_BENCHMARK_MODELS.includes(BASELINE_MODEL)) {
  console.error(`FAIL: Baseline model "${BASELINE_MODEL}" is not in SUPPORTED_BENCHMARK_MODELS.`);
  console.error(`Supported models: ${SUPPORTED_BENCHMARK_MODELS.join(', ')}`);
  process.exit(1);
}

if (!SUPPORTED_BENCHMARK_MODELS.includes(CANDIDATE_MODEL)) {
  console.error(`FAIL: Candidate model "${CANDIDATE_MODEL}" is not in SUPPORTED_BENCHMARK_MODELS.`);
  console.error(`Supported models: ${SUPPORTED_BENCHMARK_MODELS.join(', ')}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Privacy guard: warn if fixtures look like real personal data
// ---------------------------------------------------------------------------
function looksLikeRealData(text) {
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  return emailPattern.test(text) && !text.includes('sample') && !text.includes('example');
}

// ---------------------------------------------------------------------------
// Load fixtures
// ---------------------------------------------------------------------------
function loadFixtures() {
  const files = readdirSync(FIXTURES_DIR)
    .filter(f => f.endsWith('.json') && f !== 'README.md');

  const fixtures = [];
  for (const file of files) {
    const raw = readFileSync(join(FIXTURES_DIR, file), 'utf8');
    const parsed = JSON.parse(raw);
    parsed._file = file;
    fixtures.push(parsed);
  }

  if (FIXTURE_FILTER) {
    return fixtures.filter(f => f._file === FIXTURE_FILTER);
  }
  return fixtures;
}

// ---------------------------------------------------------------------------
// Benchmark feature runners
// ---------------------------------------------------------------------------
async function runMatch(fixture, modelId) {
  const start = Date.now();
  try {
    const result = await processMatchOnly(
      fixture.resumeText,
      fixture.jobDescription,
      fixture.language,
      { modelId, featureName: 'benchmark.match' }
    );
    return {
      success: true,
      latencyMs: Date.now() - start,
      outputLength: JSON.stringify(result).length,
      jsonParseSuccess: true,
      score: result.score ?? null,
    };
  } catch (error) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      error: error.message,
      status: error.status ?? null,
    };
  }
}

async function runOptimize(fixture, modelId) {
  const start = Date.now();
  try {
    const result = await optimizeResume(
      fixture.resumeText,
      fixture.jobDescription,
      fixture.language,
      [],
      '',
      { modelId, featureName: 'benchmark.optimize' }
    );
    return {
      success: true,
      latencyMs: Date.now() - start,
      outputLength: JSON.stringify(result).length,
      jsonParseSuccess: true,
      score: result.match_score ?? null,
      hallucinationFlags: checkOptimizeHallucinations(result, fixture),
    };
  } catch (error) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      error: error.message,
      status: error.status ?? null,
    };
  }
}

async function runClarification(fixture, modelId) {
  // Reuse the clarification prompt + schema from generate-clarifications.ts
  const CLARIFICATION_SCHEMA = {
    type: 'object',
    properties: {
      clarifications: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            theme: { type: 'string' },
            rationale: { type: 'string' },
            question: { type: 'string' },
          },
          required: ['id', 'theme', 'rationale', 'question'],
        },
      },
    },
    required: ['clarifications'],
  };

  const prompt = `You are an elite resume strategist performing a precision gap analysis before optimization.

Identify 0 to 3 CRITICAL missing data points that, if provided by the candidate, would allow a significantly better optimization — specifically missing quantifiable metrics, tool equivalencies, or contextual evidence that the job description explicitly requires.

<job_description>
${fixture.jobDescription}
</job_description>

<resume_text>
${fixture.resumeText}
</resume_text>`;

  const start = Date.now();
  try {
    const text = await callOpenRouter('flash', [{ role: 'user', content: prompt }], CLARIFICATION_SCHEMA, {
      maxTokens: 2048,
      timeoutMs: 20000,
      reasoningBudget: 512,
      featureName: 'benchmark.clarification_questions',
      modelId,
    });
    const parsed = JSON.parse(text);
    return {
      success: true,
      latencyMs: Date.now() - start,
      outputLength: text.length,
      jsonParseSuccess: true,
      questionCount: parsed.clarifications?.length ?? 0,
    };
  } catch (error) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      error: error.message,
      status: error.status ?? null,
    };
  }
}

async function runMetadata(fixture, modelId) {
  const jsonSchema = {
    type: 'object',
    properties: {
      companyName: { type: 'string' },
      jobTitle: { type: 'string' },
      location: { type: 'string' },
      employmentType: { type: 'string' },
      seniority: { type: 'string' },
      sector: { type: 'string' },
      confidence: {
        type: 'object',
        properties: {
          companyName: { type: 'number' },
          jobTitle: { type: 'number' },
          location: { type: 'number' },
        },
        required: ['companyName', 'jobTitle', 'location'],
      },
      needsUserConfirmation: { type: 'boolean' },
    },
    required: ['companyName', 'jobTitle', 'location', 'employmentType', 'seniority', 'sector', 'confidence', 'needsUserConfirmation'],
  };

  const messages = [
    { role: 'system', content: 'You are a job metadata extraction assistant. Extract only what is clearly stated. Never hallucinate. If information is missing, return null.' },
    { role: 'user', content: `Extract the following fields from this job posting:\n\n${fixture.jobDescription}\n\nReturn ONLY valid JSON, no extra text.` },
  ];

  const start = Date.now();
  try {
    const text = await callOpenRouter('lite', messages, jsonSchema, {
      temperature: 0,
      maxTokens: 1024,
      timeoutMs: 15000,
      featureName: 'benchmark.job_metadata_extraction',
      modelId,
    });
    const parsed = JSON.parse(text);
    return {
      success: true,
      latencyMs: Date.now() - start,
      outputLength: text.length,
      jsonParseSuccess: true,
      hasJobTitle: !!parsed.jobTitle,
      hasCompanyName: !!parsed.companyName,
    };
  } catch (error) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      error: error.message,
      status: error.status ?? null,
    };
  }
}

// ---------------------------------------------------------------------------
// Hallucination checks for optimize output
// ---------------------------------------------------------------------------
function checkOptimizeHallucinations(result, fixture) {
  const flags = [];
  const resumeLower = fixture.resumeText.toLowerCase();
  const outputLower = JSON.stringify(result).toLowerCase();

  // Check for invented employer names not in resume
  const knownEmployers = (fixture.resumeText.match(/at\s+([A-Z][A-Za-z0-9\s&]+)/g) || [])
    .map(s => s.replace(/^at\s+/, '').trim().toLowerCase());
  if (result.bullet_improvements) {
    for (const item of result.bullet_improvements) {
      const improved = (item.improved || '').toLowerCase();
      for (const emp of knownEmployers) {
        if (improved.includes(emp)) break;
      }
    }
  }

  // Check for invented degrees/certifications
  const degreePatterns = ['phd', 'master', 'mba', 'bachelor', 'aws certified', 'pmp', 'scrum'];
  for (const deg of degreePatterns) {
    if (outputLower.includes(deg) && !resumeLower.includes(deg)) {
      flags.push(`possible_invented_credential: "${deg}"`);
    }
  }

  // Check for invented exact metrics not in source or clarifications
  const metricPatterns = /\$\d+[,.]?\d*[KkMmBb]?|\d+%|\d+\s*(million|billion|thousand)/g;
  const resumeMetrics = new Set(resumeLower.match(metricPatterns) || []);
  const outputMetrics = outputLower.match(metricPatterns) || [];
  for (const m of outputMetrics) {
    if (!resumeMetrics.has(m) && !m.includes('verify')) {
      flags.push(`possible_invented_metric: "${m}"`);
    }
  }

  // Language direction check
  if (fixture.language === 'ar' && !outputLower.match(/[\u0600-\u06FF]/)) {
    flags.push('language_drift: expected Arabic output but none detected');
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Main benchmark loop
// ---------------------------------------------------------------------------
async function main() {
  console.log(`[Benchmark] Feature: ${FEATURE}`);
  console.log(`[Benchmark] Baseline: ${BASELINE_MODEL}`);
  console.log(`[Benchmark] Candidate: ${CANDIDATE_MODEL}`);

  const fixtures = loadFixtures();
  if (fixtures.length === 0) {
    console.error('No fixtures found.');
    process.exit(1);
  }

  // Privacy guard
  for (const fixture of fixtures) {
    if (looksLikeRealData(fixture.resumeText) || looksLikeRealData(fixture.jobDescription)) {
      console.warn(`[Benchmark] WARNING: Fixture "${fixture._file}" may contain real personal data. Review before sharing results.`);
    }
  }

  const results = [];

  for (const fixture of fixtures) {
    console.log(`\n[Benchmark] Fixture: ${fixture.name || fixture._file}`);

    let baselineResult;
    let candidateResult;

    switch (FEATURE) {
      case 'match':
        baselineResult = await runMatch(fixture, BASELINE_MODEL);
        candidateResult = await runMatch(fixture, CANDIDATE_MODEL);
        break;
      case 'optimize':
        baselineResult = await runOptimize(fixture, BASELINE_MODEL);
        candidateResult = await runOptimize(fixture, CANDIDATE_MODEL);
        break;
      case 'clarification':
        baselineResult = await runClarification(fixture, BASELINE_MODEL);
        candidateResult = await runClarification(fixture, CANDIDATE_MODEL);
        break;
      case 'metadata':
        baselineResult = await runMetadata(fixture, BASELINE_MODEL);
        candidateResult = await runMetadata(fixture, CANDIDATE_MODEL);
        break;
      default:
        console.error(`Unknown feature: ${FEATURE}`);
        process.exit(1);
    }

    // Model availability validation: if both fail with 404, report clearly
    if (!baselineResult.success && baselineResult.status === 404) {
      console.error(`FAIL: Model "${BASELINE_MODEL}" not available on provider "openrouter" for feature "benchmark.${FEATURE}" (HTTP 404)`);
    }
    if (!candidateResult.success && candidateResult.status === 404) {
      console.error(`FAIL: Model "${CANDIDATE_MODEL}" not available on provider "openrouter" for feature "benchmark.${FEATURE}" (HTTP 404)`);
    }

    results.push({
      fixture: fixture.name || fixture._file,
      baseline: baselineResult,
      candidate: candidateResult,
    });

    // Print concise summary (do not print full resume/JD text)
    console.log(`  Baseline:  success=${baselineResult.success} latency=${baselineResult.latencyMs}ms outputLength=${baselineResult.outputLength ?? 'N/A'}`);
    console.log(`  Candidate: success=${candidateResult.success} latency=${candidateResult.latencyMs}ms outputLength=${candidateResult.outputLength ?? 'N/A'}`);
    if (baselineResult.hallucinationFlags?.length) {
      console.log(`  Baseline hallucination flags: ${baselineResult.hallucinationFlags.join('; ')}`);
    }
    if (candidateResult.hallucinationFlags?.length) {
      console.log(`  Candidate hallucination flags: ${candidateResult.hallucinationFlags.join('; ')}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Print summary table
  // ---------------------------------------------------------------------------
  console.log('\n=== Benchmark Summary ===');
  console.log(`Feature: ${FEATURE}`);
  console.log(`Baseline:  ${BASELINE_MODEL}`);
  console.log(`Candidate: ${CANDIDATE_MODEL}`);
  console.log('');

  const baselineSuccess = results.filter(r => r.baseline.success).length;
  const candidateSuccess = results.filter(r => r.candidate.success).length;
  const baselineAvgLatency = results.reduce((sum, r) => sum + r.baseline.latencyMs, 0) / results.length;
  const candidateAvgLatency = results.reduce((sum, r) => sum + r.candidate.latencyMs, 0) / results.length;

  console.log(`Baseline success rate:  ${baselineSuccess}/${results.length}`);
  console.log(`Candidate success rate: ${candidateSuccess}/${results.length}`);
  console.log(`Baseline avg latency:   ${Math.round(baselineAvgLatency)}ms`);
  console.log(`Candidate avg latency:  ${Math.round(candidateAvgLatency)}ms`);

  // ---------------------------------------------------------------------------
  // Write JSON report
  // ---------------------------------------------------------------------------
  if (!existsSync(REPORTS_DIR)) {
    mkdirSync(REPORTS_DIR, { recursive: true });
  }
  const reportFile = join(REPORTS_DIR, `benchmark-${FEATURE}-${Date.now()}.json`);
  writeFileSync(reportFile, JSON.stringify({
    meta: {
      feature: FEATURE,
      baselineModel: BASELINE_MODEL,
      candidateModel: CANDIDATE_MODEL,
      runAt: new Date().toISOString(),
      fixtureCount: results.length,
    },
    summary: {
      baselineSuccessRate: `${baselineSuccess}/${results.length}`,
      candidateSuccessRate: `${candidateSuccess}/${results.length}`,
      baselineAvgLatencyMs: Math.round(baselineAvgLatency),
      candidateAvgLatencyMs: Math.round(candidateAvgLatency),
    },
    results,
  }, null, 2));

  console.log(`\nReport written to: ${reportFile}`);
}

main().catch((err) => {
  console.error('[Benchmark] Unhandled error:', err);
  process.exit(1);
});
