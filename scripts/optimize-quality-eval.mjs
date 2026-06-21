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
 *   node scripts/optimize-quality-eval.mjs                 # baseline vs temp_05 vs prompt_v2
 *   node scripts/optimize-quality-eval.mjs --candidate google/gemini-3.1-flash-lite
 *   node scripts/optimize-quality-eval.mjs --judge google/gemini-2.5-pro
 *   node scripts/optimize-quality-eval.mjs --fixture en-resume-jd.json
 *   node scripts/optimize-quality-eval.mjs --dry-run      # build prompts, NO API calls
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
import { buildMessages, taggedBlock, optionalTaggedBlock } from '../netlify/lib/ai-contracts/prompt.js';

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
const CANDIDATE_MODEL = cli.candidate || null; // optional model-upgrade variant
const JUDGE_MODEL = cli.judge || process.env.WATHEQ_EVAL_JUDGE_MODEL || 'google/gemini-2.5-flash';
// Judge panel: pass --judges "a,b,c" to average across models and cut single-judge
// variance (the 0.9-pt swing we saw on identical configs). Defaults to one strong judge.
const JUDGE_MODELS = (cli.judges ? cli.judges.split(',').map(s => s.trim()).filter(Boolean) : [JUDGE_MODEL]);
const LIMIT = cli.limit ? parseInt(cli.limit, 10) : null; // cap fixtures for cheap runs
const REPORTS_DIR = join(__dirname, 'benchmark-reports');

const optimizeContract = getAiContract('optimize');
const emptyCtx = { retrievedContext: { documents: [], citations: [] } };

// ---------------------------------------------------------------------------
// Prompt variant: prompt_v2 — same anti-fabrication contract, plus explicit
// specificity / anti-cliche guidance and one worked example. This is a TESTED
// candidate, not a blind change: it only ships if the judge prefers it.
// ---------------------------------------------------------------------------
function buildOptimizeMessagesV2(input, context = emptyCtx) {
  const resumeText = (input.resumeText || '').slice(0, 15000);
  const jobDescription = (input.jobDescription || '').slice(0, 5000);
  const languageInstruction = input.language === 'ar'
    ? '\nWrite all descriptive text fields in formal Arabic. Keep JSON keys and technical keywords in English.'
    : '';
  const vulnerabilities = Array.isArray(input.vulnerabilities) && input.vulnerabilities.length > 0
    ? input.vulnerabilities.map(v => `- [${v.type}]: ${v.description}`).join('\n')
    : '';
  const vulnerabilityBlock = vulnerabilities ? optionalTaggedBlock('career_vulnerabilities', vulnerabilities) : '';
  const clarificationsBlock = optionalTaggedBlock('user_clarifications', input.userClarifications);
  const ragBlock = optionalTaggedBlock('retrieved_context', context?.retrievedContext?.documents?.length
    ? JSON.stringify(context.retrievedContext.documents) : '');

  // Anti-fabrication rules are preserved verbatim in intent; the additions are the
  // specificity rubric and the worked example.
  const system = `You are an expert resume optimization strategist. Generate truthful optimization suggestions only. Do not add facts, skills, credentials, employers, dates, or metrics unless supported by resume text or user clarifications. Every improved bullet must use an action, task, and quantified result; inferred metrics must include "(verify)".

Write like a top-tier human reviewer, not a template. Each rewrite must:
- Lead with a strong, specific action verb; never reuse the same verb twice in one role.
- Name the concrete technology, scope, or domain from the resume (e.g. "React dashboard", "Node.js API"), not vague nouns like "solutions", "systems", or "various tasks".
- Keep the candidate's real metric when one exists; only append "(verify)" to a metric you inferred.
- Ban filler and cliche: "results-driven", "responsible for", "leveraged", "spearheaded", "passionate", "team player", "synergy", "best-in-class".
- Read tighter than the original. If a rewrite is not more specific AND more concise, keep the original.`;

  const example = `Example of the bar to clear:
- original: "Responsible for improving the API and making it faster for users."
- improved: "Cut customer-facing API latency 40% by adding Redis caching and rewriting N+1 queries, across endpoints serving 1M+ requests/day."
- issue: "Vague verb, no scope, no metric."
- rationale: "Names the exact technique and system, keeps the real 40% metric, ties to traffic scale from the resume."`;

  const user = `Analyze the resume against the job description and return optimization suggestions matching the schema. Keep skills as recommendations only, not applied resume content. Calculate baseline and projected scores with the strict ATS rubric.

${example}${languageInstruction}${ragBlock}${vulnerabilityBlock}${clarificationsBlock}

${taggedBlock('job_description', jobDescription)}

${taggedBlock('resume_text', resumeText)}`;

  return buildMessages(system, user);
}

// ---------------------------------------------------------------------------
// Prompt variant: v3_truthful — the winning v2 prompt PLUS truthfulness hardening.
// Targets the gate dimension (truthfulness 3.4, fabrication flags 5) without a schema
// change: a contrastive negative example, an explicit grounding rule, a final
// self-audit pass, and a requirement that `rationale` quote the supporting resume
// phrase (prompt-only grounding — forces the model to find evidence before asserting).
// ---------------------------------------------------------------------------
function buildOptimizeMessagesV3Truthful(input, context = emptyCtx) {
  const resumeText = (input.resumeText || '').slice(0, 15000);
  const jobDescription = (input.jobDescription || '').slice(0, 5000);
  const languageInstruction = input.language === 'ar'
    ? '\nWrite all descriptive text fields in formal Arabic. Keep JSON keys and technical keywords in English.'
    : '';
  const vulnerabilities = Array.isArray(input.vulnerabilities) && input.vulnerabilities.length > 0
    ? input.vulnerabilities.map(v => `- [${v.type}]: ${v.description}`).join('\n')
    : '';
  const vulnerabilityBlock = vulnerabilities ? optionalTaggedBlock('career_vulnerabilities', vulnerabilities) : '';
  const clarificationsBlock = optionalTaggedBlock('user_clarifications', input.userClarifications);
  const ragBlock = optionalTaggedBlock('retrieved_context', context?.retrievedContext?.documents?.length
    ? JSON.stringify(context.retrievedContext.documents) : '');

  const system = `You are an expert resume optimization strategist. Generate truthful optimization suggestions only. Do not add facts, skills, credentials, employers, dates, or metrics unless supported by resume text or user clarifications. Every improved bullet must use an action, task, and quantified result; inferred metrics must include "(verify)".

Write like a top-tier human reviewer, not a template. Each rewrite must:
- Lead with a strong, specific action verb; never reuse the same verb twice in one role.
- Name the concrete technology, scope, or domain from the resume (e.g. "React dashboard", "Node.js API"), not vague nouns like "solutions", "systems", or "various tasks".
- Keep the candidate's real metric when one exists; only append "(verify)" to a metric you inferred.
- Ban filler and cliche: "results-driven", "responsible for", "leveraged", "spearheaded", "passionate", "team player", "synergy", "best-in-class".
- Read tighter than the original. If a rewrite is not more specific AND more concise, keep the original.

GROUNDING — non-negotiable. Every company, job title, date, tool, technology, scope, and number in a rewrite MUST appear in, or be directly entailed by, the <resume_text>. You may NOT introduce a specific metric, percentage, dollar figure, employer, client, certification, or skill that is not in the resume. If a quantified result would strengthen a bullet but no real number exists in the resume, write the qualitative impact and append "(verify)" to the single inferred figure — never invent the figure as fact. In each item's "rationale", quote the exact phrase from the resume that supports the rewrite (e.g. rationale: "...supported by resume: 'Reduced API latency by 40%'"). If you cannot find a supporting phrase, do not make the claim.

FINAL SELF-AUDIT before returning: re-read every improved bullet and the summary_rewrite. For each, verify every proper noun, date, tool, scope, and number traces to the resume. Remove or generalize anything unsupported; mark any inferred metric with "(verify)". Truthfulness outranks impressiveness — a plainer true bullet beats a stronger false one.`;

  const goodExample = `Example of the bar to clear:
- original: "Responsible for improving the API and making it faster for users."
- improved: "Cut customer-facing API latency 40% by adding Redis caching and rewriting N+1 queries, across endpoints serving 1M+ requests/day."
- issue: "Vague verb, no scope, no metric."
- rationale: "Names the exact technique and system; keeps the real metric — supported by resume: 'Reduced API latency by 40%'."`;

  const badExample = `Counter-example you must NOT produce (fabrication):
- original: "Helped the team ship features."
- BAD improved: "Drove $2.3M in revenue and led a team of 12 engineers across 4 countries."  ← INVENTED: no $2.3M, no team of 12, no countries in the resume.
- CORRECT improved: "Shipped product features on tight deadlines in collaboration with the product team (scope/impact (verify))."
- rationale: "Keeps only what the resume supports: 'Collaborated with product team to deliver features on tight deadlines'."`;

  const user = `Analyze the resume against the job description and return optimization suggestions matching the schema. Keep skills as recommendations only, not applied resume content. Calculate baseline and projected scores with the strict ATS rubric.

${goodExample}

${badExample}${languageInstruction}${ragBlock}${vulnerabilityBlock}${clarificationsBlock}

${taggedBlock('job_description', jobDescription)}

${taggedBlock('resume_text', resumeText)}`;

  return buildMessages(system, user);
}

// ---------------------------------------------------------------------------
// Prompt variant: v4_evidence — STRUCTURAL anti-fabrication. Requires a verbatim
// `source_span` per bullet (the exact resume substring that grounds the rewrite). A
// deterministic check then rejects bullets whose span is not in the resume, or whose
// numbers aren't in the span — making fabrication mechanically detectable, not just
// discouraged. This is the lever to push fab toward 0 and let us be specific AND grounded.
// ---------------------------------------------------------------------------
const evidenceJsonSchema = JSON.parse(JSON.stringify(optimizeContract.jsonSchema));
{
  const bi = evidenceJsonSchema.properties.bullet_improvements.items;
  bi.properties.source_span = { type: 'string' };
  if (Array.isArray(bi.required) && !bi.required.includes('source_span')) bi.required.push('source_span');
}

function buildOptimizeMessagesV4Evidence(input, context = emptyCtx) {
  const resumeText = (input.resumeText || '').slice(0, 15000);
  const jobDescription = (input.jobDescription || '').slice(0, 5000);
  const languageInstruction = input.language === 'ar'
    ? '\nWrite all descriptive text fields in formal Arabic. Keep JSON keys and technical keywords in English.'
    : '';
  const clarificationsBlock = optionalTaggedBlock('user_clarifications', input.userClarifications);

  const system = `You are an expert resume optimization strategist. Generate truthful optimization suggestions only. Do not add facts, skills, credentials, employers, dates, or metrics unless supported by resume text or user clarifications.

EVIDENCE PROTOCOL — mandatory and machine-checked:
- For EVERY bullet_improvement, set "source_span" to a VERBATIM substring copied exactly from <resume_text> that supports the rewrite. Copy it character-for-character; do not paraphrase the span.
- The "improved" bullet may only assert facts, tools, scope, employers, and numbers that appear in its source_span (or elsewhere in the resume). If a number would strengthen the bullet but is not in the resume, write the qualitative result and append "(verify)" to the single inferred figure — never state an invented figure as fact.
- If no verbatim span in the resume supports a rewrite, do not produce that bullet.
- Still write tightly and specifically: strong action verb, concrete tech/scope, no cliche ("results-driven", "responsible for", "leveraged", "spearheaded", "synergy", "best-in-class").

FINAL SELF-AUDIT: for each bullet, confirm source_span is an exact quote from the resume and that every proper noun/number in "improved" traces to it or to the resume. Truthfulness outranks impressiveness.`;

  const example = `Example item:
- original: "Responsible for improving the API and making it faster for users."
- improved: "Cut customer-facing API latency 40% by adding Redis caching and rewriting N+1 queries."
- source_span: "Reduced API latency by 40% through caching and query optimization"
- issue: "Vague verb, no scope, no metric."
- rationale: "Keeps the real 40% from the cited span; names the concrete technique."`;

  const user = `Analyze the resume against the job description and return optimization suggestions matching the schema. Each bullet_improvement MUST include a verbatim source_span. Keep skills as recommendations only. Calculate baseline and projected scores with the strict ATS rubric.

${example}${languageInstruction}${clarificationsBlock}

${taggedBlock('job_description', jobDescription)}

${taggedBlock('resume_text', resumeText)}`;

  return buildMessages(system, user);
}

// ---------------------------------------------------------------------------
// Variant matrix
// ---------------------------------------------------------------------------
function buildVariants() {
  // Truthfulness-focused cycle. All variants at temp 0 (proven best), so the PROMPT is
  // the only changed variable. baseline = whatever the worktree's prod prompt currently is.
  const variants = [
    { name: 'baseline',    modelId: BASELINE_MODEL, temperature: 0, buildMessages: optimizeContract.buildMessages,    note: 'current production prompt @ temp 0' },
    { name: 'prompt_v2',   modelId: BASELINE_MODEL, temperature: 0, buildMessages: buildOptimizeMessagesV2,           note: 'specificity prompt (consistency/noise-floor check)' },
    { name: 'v3_truthful', modelId: BASELINE_MODEL, temperature: 0, buildMessages: buildOptimizeMessagesV3Truthful,   note: 'v2 + grounding + negative example + self-audit' },
    { name: 'v4_evidence', modelId: BASELINE_MODEL, temperature: 0, buildMessages: buildOptimizeMessagesV4Evidence,   jsonSchema: evidenceJsonSchema, note: 'structural: required source_span + deterministic grounding check' },
  ];
  if (CANDIDATE_MODEL) {
    variants.push({ name: 'v4_modelup', modelId: CANDIDATE_MODEL, temperature: 0, buildMessages: buildOptimizeMessagesV4Evidence, jsonSchema: evidenceJsonSchema, note: `evidence prompt on ${CANDIDATE_MODEL}` });
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
      maxTokens: optimizeContract.maxTokens,
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
1. \`v4_evidence\` is the structural test: if it cuts fab/ungrounded toward 0 while holding
   truthfulness >= current prod, grounding via source_span is the lever — ship it.
2. \`v4_modelup\` (with --candidate) tests the evidence prompt on the faster model.
3. Trust the gate (truthfulness) deltas; treat composite gaps under ~0.3 as noise even with
   the panel. Keep \`temperature: 0\`.

Ship ONE production change at a time (prompt OR schema+prompt for the evidence field), then
re-run to confirm. The evidence variant needs a matching \`source_span\` field added to the
optimize output schema before it can ship to prod.
`;
}

async function main() {
  console.log(`[Eval] optimize rewrite-quality  dryRun=${DRY_RUN}`);
  console.log(`[Eval] baseline=${BASELINE_MODEL}  candidate=${CANDIDATE_MODEL || '(none)'}  judges=${JUDGE_MODELS.join('+')}`);

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

  const meta = { runAt: new Date().toISOString(), judgeModel: JUDGE_MODELS.join(' + '), baselineModel: BASELINE_MODEL, candidateModel: CANDIDATE_MODEL, fixtureCount: fixtures.length };
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
