/**
 * Optimize Rewrite-Quality Eval Harness (LLM-as-judge)
 *
 * Answers ONE question objectively: which lever most improves the QUALITY of the
 * `optimize` feature's rewrites — model, temperature, or prompt — not just latency/cost.
 *
 * It does this by running the SAME fixtures through several variants of the optimize
 * call, then having a strong "judge" model blind-score each variant's rewrites on a
 * rubric (specificity, JD alignment, truthfulness, readability). Variant identities are
 * anonymized and shuffled per fixture to control for position/identity bias — current
 * best practice for LLM-as-judge evaluation.
 *
 * It reuses the REAL production contract (getAiContract('optimize')) so every variant is
 * validated against the exact prod JSON schema. No production logic is modified.
 *
 * Usage:
 *   npx tsx scripts/optimize-quality-eval.mjs              # prod vs prod_aa (A/A noise-floor check)
 *   npx tsx scripts/optimize-quality-eval.mjs --candidate "deepseek/deepseek-v4-flash,deepseek/deepseek-v4-pro"
 *   npx tsx scripts/optimize-quality-eval.mjs --judges "google/gemini-2.5-flash,google/gemini-2.5-pro"
 *   npx tsx scripts/optimize-quality-eval.mjs --fixture en-resume-jd.json
 *   npx tsx scripts/optimize-quality-eval.mjs --dry-run    # build prompts, NO API calls
 *
 * Safety:
 * - Fixtures are synthetic (scripts/benchmark-fixtures/README.md). Point --fixtures at a
 *   gitignored dir to use private real cases locally.
 * - Variant calls use feature names prefixed with "benchmark." to keep analytics clean.
 * - --dry-run makes ZERO paid API calls; use it to inspect wiring first.
 */

import 'dotenv/config';
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { callOpenRouter } from '../netlify/lib/openrouter-client.js';
import { getAiContract } from '../netlify/lib/ai-contracts/contracts/index.js';
import { parseAiJson } from '../netlify/lib/ai-contracts/json.js';
import { taggedBlock } from '../netlify/lib/ai-contracts/prompt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { _flags: new Set() };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--dry-run') { parsed._flags.add('dryRun'); continue; }
    if (a.startsWith('--')) { parsed[a.replace(/^--/, '')] = args[i + 1]; i += 1; }
  }
  return parsed;
}
const cli = parseArgs();
const DRY_RUN = cli._flags.has('dryRun');
const FIXTURES_DIR = cli.fixtures ? cli.fixtures : join(__dirname, 'benchmark-fixtures');
const FIXTURE_FILTER = cli.fixture || null;
const BASELINE_MODEL = cli.baseline || 'google/gemini-2.5-flash';
// Comma-separated to test several candidate models against prod/prod_aa in ONE run.
const CANDIDATE_MODELS = cli.candidate
  ? cli.candidate.split(',').map(s => s.trim()).filter(Boolean)
  : [];
const JUDGE_MODEL = cli.judge || process.env.WATHEQ_EVAL_JUDGE_MODEL || null;
// Judge panel: --judges "a,b,c" overrides; --judge pins a single model. Default is a
// two-model panel — a lone judge swung up to 0.9 pt on identical configs (the 2026-07-03
// A/A pair showed a 0.5-pt truthfulness gap on bit-identical calls), so single-judge
// deltas below that swing are unreadable. The second judge is deepseek-v4-flash, not
// gemini-2.5-pro: ~1/10th the cost AND cross-family, which breaks the gemini-judging-gemini
// self-preference bias.
const DEFAULT_JUDGE_PANEL = ['google/gemini-2.5-flash', 'deepseek/deepseek-v4-flash'];
const JUDGE_MODELS = cli.judges
  ? cli.judges.split(',').map(s => s.trim()).filter(Boolean)
  : (JUDGE_MODEL ? [JUDGE_MODEL] : DEFAULT_JUDGE_PANEL);
const LIMIT = cli.limit ? parseInt(cli.limit, 10) : null; // cap fixtures for cheap runs
const REPORTS_DIR = join(__dirname, 'benchmark-reports');

const optimizeContract = getAiContract('optimize');
const emptyCtx = { retrievedContext: { documents: [], citations: [] } };

// ---------------------------------------------------------------------------
// Variant matrix
// ---------------------------------------------------------------------------
function buildVariants() {
  // Post-#111 (commit 8c3ec8c): the evidence prompt + required source_span schema IS
  // production. `prod` and `prod_aa` run the identical prod config twice — their score
  // gap is the run's noise floor; only candidate deltas larger than that gap are signal.
  // The retired prompt_v2 / v3_truthful / v4_evidence builders were settled by the
  // 2026-07-03 run (v4 shipped as prod in #111; v2/v3 failed the truthfulness gate)
  // and live in git history.
  const variants = [
    { name: 'prod',    modelId: BASELINE_MODEL, temperature: 0, buildMessages: optimizeContract.buildMessages, note: 'production prompt + schema (evidence lever, shipped #111)' },
    { name: 'prod_aa', modelId: BASELINE_MODEL, temperature: 0, buildMessages: optimizeContract.buildMessages, note: 'A/A control — identical to prod, measures noise floor' },
  ];
  // Each candidate runs the SAME prod prompt/schema, only modelId changes — isolates the
  // model as the one lever. Named up_<slug-tail> so the report row is readable.
  for (const modelId of CANDIDATE_MODELS) {
    const tail = modelId.split('/').pop();
    variants.push({ name: `up_${tail}`, modelId, temperature: 0, buildMessages: optimizeContract.buildMessages, note: `production prompt on ${modelId}` });
  }
  return variants;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function loadFixtures() {
  const files = readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.json'));
  let fixtures = files.map(file => {
    const parsed = JSON.parse(readFileSync(join(FIXTURES_DIR, file), 'utf8'));
    parsed._file = file;
    return parsed;
  });
  if (FIXTURE_FILTER) {
    const want = FIXTURE_FILTER.split(',').map(s => s.trim());
    fixtures = fixtures.filter(f => want.includes(f._file));
  }
  return fixtures;
}

// ---------------------------------------------------------------------------
// Deterministic fabrication guardrail (cheap pre-judge safety net)
// ---------------------------------------------------------------------------
function fabricationFlags(result, fixture) {
  const flags = [];
  const resumeLower = (fixture.resumeText || '').toLowerCase();
  const outputLower = JSON.stringify(result || {}).toLowerCase();
  for (const deg of ['phd', 'master', 'mba', 'bachelor', 'aws certified', 'pmp', 'scrum master']) {
    if (outputLower.includes(deg) && !resumeLower.includes(deg)) flags.push(`credential:${deg}`);
  }
  const metricRe = /\$\d+[,.]?\d*[kmb]?|\d+%|\d+\s*(million|billion|thousand)/g;
  const resumeMetrics = new Set(resumeLower.match(metricRe) || []);
  for (const m of (outputLower.match(metricRe) || [])) {
    if (!resumeMetrics.has(m) && !outputLower.includes(`${m} (verify)`)) flags.push(`metric:${m}`);
  }
  return [...new Set(flags)];
}

// ---------------------------------------------------------------------------
// Deterministic grounding check for the evidence variant: each bullet's cited
// source_span must actually exist in the resume, and numbers in the rewrite must
// trace to the span/resume. Returns [] for variants without source_span (N/A).
// ---------------------------------------------------------------------------
function norm(s) { return (s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function groundingFlags(result, fixture) {
  const resumeNorm = norm(fixture.resumeText);
  const bullets = result?.bullet_improvements || [];
  const flags = [];
  let hasSpan = false;
  for (const b of bullets) {
    const span = (b.source_span || '').trim();
    if (!span) {
      if (b.improved) flags.push('missing_source_span');
      continue;
    }
    hasSpan = true;
    const spanNorm = norm(span);
    const probe = spanNorm.slice(0, Math.min(spanNorm.length, 60));
    if (probe && !resumeNorm.includes(probe)) {
      flags.push(`span_not_in_resume:"${span.slice(0, 40)}"`);
      continue;
    }
    for (const n of ((b.improved || '').match(/\$?\d+[.,]?\d*%?[kmb]?/gi) || [])) {
      const nl = n.toLowerCase();
      if (nl.length < 2) continue;
      const okVerify = norm(b.improved).includes(`${nl} (verify)`);
      if (!spanNorm.includes(nl) && !resumeNorm.includes(nl) && !okVerify) flags.push(`ungrounded_number:${n}`);
    }
  }
  return hasSpan || flags.length ? [...new Set(flags)] : [];
}

// ---------------------------------------------------------------------------
// Run one variant on one fixture against the REAL optimize contract/schema
// ---------------------------------------------------------------------------
async function runVariant(fixture, variant) {
  const input = {
    resumeText: fixture.resumeText,
    jobDescription: fixture.jobDescription,
    language: fixture.language || 'en',
    vulnerabilities: [],
    userClarifications: '',
  };
  const messages = variant.buildMessages(input, emptyCtx);

  if (DRY_RUN) {
    return { success: true, dryRun: true, messages };
  }

  const start = Date.now();
  try {
    const text = await callOpenRouter(optimizeContract.modelType, messages, variant.jsonSchema || optimizeContract.jsonSchema, {
      modelId: variant.modelId,
      temperature: variant.temperature,
      maxTokens: variant.maxTokens || optimizeContract.maxTokens,
      timeoutMs: optimizeContract.timeoutMs,
      reasoningBudget: optimizeContract.reasoningBudget,
      featureName: `benchmark.optimize.${variant.name}`,
    });
    const parsed = parseAiJson(text, 'optimize');
    const validation = optimizeContract.outputSchema.safeParse(parsed);
    return {
      success: true,
      latencyMs: Date.now() - start,
      schemaValid: validation.success,
      result: parsed, // raw parsed so source_span survives for grounding + judge
      fabricationFlags: fabricationFlags(parsed, fixture),
      groundingFlags: groundingFlags(parsed, fixture),
    };
  } catch (error) {
    return { success: false, latencyMs: Date.now() - start, error: error.message, status: error.status ?? null };
  }
}

// ---------------------------------------------------------------------------
// LLM-as-judge — blind, shuffled, rubric scoring
// ---------------------------------------------------------------------------
const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    evaluations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          specificity: { type: 'number' },
          jd_alignment: { type: 'number' },
          truthfulness: { type: 'number' },
          readability: { type: 'number' },
          notes: { type: 'string' },
        },
        required: ['label', 'specificity', 'jd_alignment', 'truthfulness', 'readability', 'notes'],
      },
    },
    best_label: { type: 'string' },
    reasoning: { type: 'string' },
  },
  required: ['evaluations', 'best_label', 'reasoning'],
};

function condenseRewrites(result) {
  if (!result) return '(no output)';
  const parts = [];
  if (result.summary_rewrite) parts.push(`SUMMARY: ${result.summary_rewrite}`);
  for (const b of (result.bullet_improvements || []).slice(0, 8)) {
    parts.push(`BULLET: ${b.improved}`);
  }
  return parts.join('\n') || '(no rewrites produced)';
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function judgeFixture(fixture, variantOutputs) {
  // Anonymize + shuffle: label -> variant name (kept private from the judge).
  const labels = ['A', 'B', 'C', 'D', 'E'];
  const shuffled = shuffle(variantOutputs.filter(v => v.run.success && v.run.result));
  const labelMap = {};
  const blocks = shuffled.map((v, i) => {
    const label = labels[i];
    labelMap[label] = v.variant.name;
    return `<variant label="${label}">\n${condenseRewrites(v.run.result)}\n</variant>`;
  }).join('\n\n');

  const system = `You are a ruthless senior recruiter and resume editor scoring competing rewrites of the SAME resume for the SAME job. Score only on visible evidence. Penalize generic phrasing, cliches, and any claim not supported by the original resume. Reward specificity, concrete scope, real metrics, and tight readable prose. Score each dimension 1-5 (5 best). Be discriminating: do not give everything the same score.`;
  const user = `Rubric per variant (1-5 each):
- specificity: concrete tech/scope/numbers vs vague filler.
- jd_alignment: targets the job's stated requirements.
- truthfulness: nothing invented beyond the original resume; inferred metrics marked "(verify)".
- readability: tight, professional, no cliches.

Pick the single best_label overall (truthfulness is a gate: a variant that invents facts cannot win).

${taggedBlock('job_description', (fixture.jobDescription || '').slice(0, 4000))}

${taggedBlock('original_resume', (fixture.resumeText || '').slice(0, 6000))}

${blocks}`;

  const messages = [{ role: 'system', content: system }, { role: 'user', content: user }];

  if (DRY_RUN) return { dryRun: true, labelMap, messages };

  // Panel: query each judge on the SAME shuffled prompt, average dimensions, majority best.
  const dims = ['specificity', 'jd_alignment', 'truthfulness', 'readability'];
  const acc = {};        // variantName -> { dim: [scores] }
  const bestVotes = {};  // variantName -> count
  const reasonings = [];
  for (const judgeModel of JUDGE_MODELS) {
    let parsed;
    try {
      const text = await callOpenRouter('flash', messages, JUDGE_SCHEMA, {
        modelId: judgeModel,
        temperature: 0,
        maxTokens: 4096,
        timeoutMs: 90000,
        reasoningBudget: 1024,
        featureName: 'benchmark.optimize.judge',
      });
      parsed = parseAiJson(text, 'optimize_judge');
    } catch (e) {
      console.log(`    judge ${judgeModel} failed: ${e.message}`);
      continue;
    }
    for (const ev of (parsed.evaluations || [])) {
      const vname = labelMap[ev.label];
      if (!vname) continue;
      acc[vname] = acc[vname] || { specificity: [], jd_alignment: [], truthfulness: [], readability: [] };
      for (const d of dims) if (typeof ev[d] === 'number') acc[vname][d].push(ev[d]);
    }
    const bestV = labelMap[parsed.best_label];
    if (bestV) bestVotes[bestV] = (bestVotes[bestV] || 0) + 1;
    if (parsed.reasoning) reasonings.push(`[${judgeModel}] ${parsed.reasoning}`);
  }
  const byVariant = {};
  for (const [vname, d] of Object.entries(acc)) {
    byVariant[vname] = {
      specificity: mean(d.specificity), jd_alignment: mean(d.jd_alignment),
      truthfulness: mean(d.truthfulness), readability: mean(d.readability),
    };
  }
  let bestVariant = null; let bestCount = -1;
  for (const [vname, c] of Object.entries(bestVotes)) { if (c > bestCount) { bestCount = c; bestVariant = vname; } }
  return { byVariant, bestVariant, reasoning: reasonings.join(' | '), labelMap };
}

// ---------------------------------------------------------------------------
// Aggregate + report
// ---------------------------------------------------------------------------
function mean(nums) { return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0; }
function r2(n) { return Number(n.toFixed(2)); }

function buildMarkdown(meta, perVariant) {
  const rows = Object.entries(perVariant).map(([name, v]) => {
    const composite = r2(mean([v.specificity, v.jd_alignment, v.truthfulness, v.readability].map(x => x || 0)));
    return `| ${name} | ${r2(v.specificity)} | ${r2(v.jd_alignment)} | ${r2(v.truthfulness)} | ${r2(v.readability)} | **${composite}** | ${v.wins} | ${v.avgLatencyMs}ms | ${v.fabricationFlagCount} | ${v.groundingFlagCount} |`;
  });
  return `# Optimize Rewrite-Quality Eval

- Run at: ${meta.runAt}
- Judge panel: ${meta.judgeModel}
- Baseline model: ${meta.baselineModel}${meta.candidateModel ? `\n- Candidate model: ${meta.candidateModel}` : ''}
- Fixtures: ${meta.fixtureCount}

Scores are judge averages across fixtures and across the judge panel (1-5, higher is better).
Composite = mean of the four dimensions. "Wins" = majority best picks. "fab" = deterministic
fabrication-heuristic flags (lower better). "ungrounded" = evidence-variant bullets whose
cited source_span isn't in the resume or whose numbers don't trace to it (0 is the target;
only meaningful for evidence variants). Truthfulness is the gate.

| variant | specificity | jd_align | truthful | readability | composite | wins | avg latency | fab | ungrounded |
|---|---|---|---|---|---|---|---|---|---|
${rows.join('\n')}

## How to read this
1. \`prod\` and \`prod_aa\` are IDENTICAL configs: their gap is this run's noise floor.
   Discard any candidate delta smaller than that gap, and composite gaps under ~0.3,
   even with the judge panel. Keep \`temperature: 0\`.
2. \`up_<model>\` rows (--candidate "a,b") test the production evidence prompt on other
   models. Ship a model change ONLY if: truthfulness >= prod minus the noise floor,
   ungrounded = 0, fab <= prod, majority of wins, AND p95 latency clears the legacy v1
   optimize.ts path (~30s Netlify cap; streaming v2 tolerates more — contract timeoutMs is
   100s, worst observed ~46s). State the cost delta before shipping. Run with GEMINI_API_KEY
   empty so the openrouter-client Gemini fallback cannot silently substitute Gemini output
   for a failing candidate and corrupt the comparison.
3. Truthfulness is the gate. fab counts include certification_recommendations, which
   legitimately name credentials not in the resume — compare fab across variants; never
   read it as an absolute fabrication count.

The source_span evidence lever shipped to prod in #111 (schema + prompt + passthrough).
Ship ONE production change at a time, then re-run this eval to confirm.
`;
}

async function main() {
  console.log(`[Eval] optimize rewrite-quality  dryRun=${DRY_RUN}`);
  console.log(`[Eval] baseline=${BASELINE_MODEL}  candidates=${CANDIDATE_MODELS.join(',') || '(none)'}  judges=${JUDGE_MODELS.join('+')}`);

  let fixtures = loadFixtures();
  if (!fixtures.length) { console.error('No fixtures found in ' + FIXTURES_DIR); process.exit(1); }
  if (LIMIT && LIMIT > 0) fixtures = fixtures.slice(0, LIMIT);
  const variants = buildVariants();
  console.log(`[Eval] ${fixtures.length} fixtures x ${variants.length} variants = ${fixtures.length * variants.length} generations\n`);

  const perVariant = {};
  for (const v of variants) perVariant[v.name] = { specificityArr: [], jdArr: [], truthArr: [], readArr: [], wins: 0, latencyArr: [], fabricationFlagCount: 0, groundingFlagCount: 0, note: v.note };

  const rawResults = [];

  for (const fixture of fixtures) {
    console.log(`[Eval] Fixture: ${fixture.name || fixture._file}`);
    const variantOutputs = [];
    for (const variant of variants) {
      const run = await runVariant(fixture, variant);
      variantOutputs.push({ variant, run });
      if (DRY_RUN) {
        console.log(`  --- ${variant.name} messages ---`);
        console.log(run.messages.map(m => `[${m.role}]\n${m.content}`).join('\n').slice(0, 1600));
        console.log('  ...(truncated)\n');
        continue;
      }
      const agg = perVariant[variant.name];
      if (run.success) {
        agg.latencyArr.push(run.latencyMs);
        agg.fabricationFlagCount += (run.fabricationFlags?.length || 0);
        agg.groundingFlagCount += (run.groundingFlags?.length || 0);
        console.log(`  ${variant.name.padEnd(12)} ok  ${run.latencyMs}ms  fab=${run.fabricationFlags?.length || 0}  ungrounded=${run.groundingFlags?.length || 0}`);
      } else {
        console.log(`  ${variant.name.padEnd(10)} FAIL ${run.error}`);
      }
    }

    if (DRY_RUN) {
      const j = await judgeFixture(fixture, variantOutputs);
      console.log('  --- judge prompt (label map ' + JSON.stringify(j.labelMap) + ') ---');
      console.log(j.messages.map(m => `[${m.role}]\n${m.content}`).join('\n').slice(0, 1800));
      console.log('  ...(truncated)\n');
      continue;
    }

    const judged = await judgeFixture(fixture, variantOutputs);
    for (const [name, e] of Object.entries(judged.byVariant)) {
      const agg = perVariant[name];
      agg.specificityArr.push(e.specificity);
      agg.jdArr.push(e.jd_alignment);
      agg.truthArr.push(e.truthfulness);
      agg.readArr.push(e.readability);
    }
    if (judged.bestVariant && perVariant[judged.bestVariant]) perVariant[judged.bestVariant].wins += 1;
    console.log(`  judge best: ${judged.bestVariant}  (${(judged.reasoning || '').slice(0, 120)})\n`);
    rawResults.push({ fixture: fixture.name || fixture._file, judged, variantOutputs: variantOutputs.map(v => ({ name: v.variant.name, success: v.run.success, latencyMs: v.run.latencyMs, fabricationFlags: v.run.fabricationFlags })) });
  }

  if (DRY_RUN) { console.log('[Eval] Dry run complete — no API calls made.'); return; }

  // Collapse arrays to means
  const summary = {};
  for (const [name, a] of Object.entries(perVariant)) {
    summary[name] = {
      specificity: mean(a.specificityArr), jd_alignment: mean(a.jdArr), truthfulness: mean(a.truthArr), readability: mean(a.readArr),
      wins: a.wins, avgLatencyMs: Math.round(mean(a.latencyArr)), fabricationFlagCount: a.fabricationFlagCount, groundingFlagCount: a.groundingFlagCount, note: a.note,
    };
  }

  const meta = { runAt: new Date().toISOString(), judgeModel: JUDGE_MODELS.join(' + '), baselineModel: BASELINE_MODEL, candidateModel: CANDIDATE_MODELS.join(', ') || null, fixtureCount: fixtures.length };
  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
  const stamp = Date.now();
  const jsonFile = join(REPORTS_DIR, `optimize-quality-${stamp}.json`);
  const mdFile = join(REPORTS_DIR, `optimize-quality-${stamp}.md`);
  writeFileSync(jsonFile, JSON.stringify({ meta, summary, rawResults }, null, 2));
  const md = buildMarkdown(meta, summary);
  writeFileSync(mdFile, md);

  console.log('\n=== Summary ===');
  console.log(md);
  console.log(`\nReports:\n  ${jsonFile}\n  ${mdFile}`);
}

main().catch((err) => { console.error('[Eval] Unhandled error:', err); process.exit(1); });
