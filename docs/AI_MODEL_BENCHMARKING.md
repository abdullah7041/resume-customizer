# AI Model Benchmarking

## Overview

This document describes how to benchmark AI models for Watheq using the local-only benchmark harness.

**Important:** Benchmark results measure model behavior (latency, JSON reliability, hallucination risk). They do NOT prove hiring outcomes.

## Prerequisites

- Node.js 20+
- `OPENROUTER_API_KEY` or `GEMINI_API_KEY` configured in your environment

## How to Run a Benchmark

```bash
# Compare current production model vs candidate model for optimize
npm run benchmark:ai -- --feature optimize --baseline google/gemini-2.5-flash --candidate google/gemini-3.1-flash-lite

# Run match benchmark
npm run benchmark:ai -- --feature match --baseline google/gemini-2.5-flash --candidate google/gemini-3.1-flash-lite

# Run clarification benchmark on a specific fixture
npm run benchmark:ai -- --feature clarification --baseline google/gemini-2.5-flash --candidate google/gemini-3.1-flash-lite --fixture low-quality-resume-jd.json
```

### Supported Features

- `match` — `processMatchOnly()`
- `clarification` — `generate-clarifications` prompt + schema
- `optimize` — `optimizeResume()`
- `metadata` — `extract-job-metadata` prompt + schema

### Supported Models

The benchmark only accepts models explicitly listed in `SUPPORTED_BENCHMARK_MODELS`:

- `google/gemini-2.5-flash-lite`
- `google/gemini-2.5-flash`
- `google/gemini-3.1-flash-lite`

## How to Add Local Fixtures

1. Create a new `.json` file in `scripts/benchmark-fixtures/`.
2. Use **completely synthetic (fake)** data. Never use real resumes or job descriptions.
3. Include these fields:
   - `name` — short description of the scenario
   - `language` — `en`, `ar`, or `mixed`
   - `resumeText` — the synthetic resume
   - `jobDescription` — the synthetic job description
   - `expectedLanguageDirection` — `ltr` or `rtl`

See `scripts/benchmark-fixtures/README.md` for the synthetic-data mandate.

## How to Compare Models

The benchmark runs every fixture twice:
- Once with the **baseline** model
- Once with the **candidate** model

For each run it collects:
- `success` / `failure`
- `latency_ms`
- `output_length`
- `json_parse_success`
- `hallucination_flags` (for optimize)

Results are printed to the console and saved as a JSON report in `scripts/benchmark-reports/`.

## Decision Rule for Switching

Do **not** switch `optimize` (or any production feature) to a new model unless:

1. Quality is equal or better in at least **60–70%** of benchmark cases.
2. JSON/schema success rate is **>= 98%**.
3. Hallucination rate is **zero or lower** than the current model.
4. Latency is **better or acceptable**.
5. Approximate cost is **acceptable**.

## Cost Caveats

- `estimated_cost_usd` in benchmark reports is **approximate** only.
- It is computed from the `APPROXIMATE_PRICING` map in `netlify/lib/model-registry.js`.
- **Do not use it as a billing source of truth.** Actual cost comes from OpenRouter/provider billing.
- Pricing updates may lag behind provider announcements.

## Analytics Separation

- Benchmark calls use feature names prefixed with `benchmark.` (e.g., `benchmark.optimize`).
- This separates benchmark traffic from production `ai_usage_events`.
- To suppress usage logging entirely, set:
  ```bash
  BENCHMARK_DISABLE_USAGE_LOGGING=true npm run benchmark:ai -- ...
  ```

## Privacy Warning

- **Never commit real resumes or job descriptions.**
- All fixtures in `scripts/benchmark-fixtures/` are synthetic.
- The benchmark script warns if fixture content looks like real personal data.
- Reports in `scripts/benchmark-reports/` are gitignored.

## Troubleshooting

### "Model X is not in SUPPORTED_BENCHMARK_MODELS"

Add the model ID to `SUPPORTED_BENCHMARK_MODELS` in `netlify/lib/model-registry.js` and include approximate pricing before benchmarking.

### "Model not available (HTTP 404)"

The candidate model may not yet be live on OpenRouter or direct Gemini. The benchmark reports this as a failure and continues with remaining fixtures.
