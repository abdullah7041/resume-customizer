/**
 * Deploy smoke probe for auth-gated Netlify functions.
 *
 * Hits each function with a GARBAGE bearer token (no real secrets needed) and
 * asserts the function actually executed and returned a controlled error
 * (any 4xx — auth was reached) instead of crashing.
 *
 * A 5xx / 502 means the handler threw before returning — exactly the failure
 * mode of the 2026-07 outage, where a supabase-js bump made every server-side
 * createClient() throw on Node 20 (raw 502 on extract-resume-json, generic 500
 * on referral-api). This probe would have caught that at deploy time.
 *
 * Usage:
 *   node scripts/smoke-functions.mjs                 # defaults to prod
 *   node scripts/smoke-functions.mjs https://deploy-preview-123--watheqai.app
 *   SMOKE_BASE_URL=http://localhost:8888 node scripts/smoke-functions.mjs
 *
 * Exit code 0 = all healthy, 1 = one or more functions crashed / unreachable.
 */

const BASE_URL = (process.argv[2] || process.env.SMOKE_BASE_URL || "https://watheqai.app").replace(/\/+$/, "");
const GARBAGE_TOKEN = "smoke-probe.invalid.token";
const PER_REQUEST_TIMEOUT_MS = 20000;
// A request slower than this still passes, but is flagged — the real Netlify
// gateway window is ~26s and a near-miss is an early warning of the timeout path.
const SLOW_WARN_MS = 10000;

/** Each probe uses a garbage token, so a healthy function returns 4xx (auth reached). */
const PROBES = [
  { name: "referral-api", method: "GET", path: "/.netlify/functions/referral-api?action=get-summary" },
  { name: "extract-resume-json", method: "POST", path: "/.netlify/functions/extract-resume-json", body: { kind: "text", text: "smoke" } },
  { name: "ai-match", method: "POST", path: "/.netlify/functions/ai-match", body: { resumeText: "smoke", jobText: "smoke" } },
  { name: "user-data-api", method: "POST", path: "/.netlify/functions/user-data-api?action=export" },
  { name: "optimize", method: "POST", path: "/.netlify/functions/optimize", body: { resumeText: "smoke", jobText: "smoke" } },
];

function isControlledAuthRejection(status, responseText) {
  if (status !== 401) return false;

  try {
    const payload = JSON.parse(responseText);
    return Boolean(
      payload
      && typeof payload === "object"
      && !Array.isArray(payload)
      && [payload.error, payload.message, payload.code].some((value) => typeof value === "string" && value.length > 0)
    );
  } catch {
    return false;
  }
}

async function probe({ name, method, path, body }) {
  const url = `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${GARBAGE_TOKEN}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const elapsedMs = Date.now() - startedAt;
    const text = await res.text();
    // Healthy = the handler reached its auth gate and returned a controlled JSON
    // rejection. Other statuses can come from a missing route, SPA fallback, or
    // auth bypass and must not green-light the deploy.
    const healthy = isControlledAuthRejection(res.status, text);
    const snippet = text.replace(/\s+/g, " ").slice(0, 160);
    return { name, ok: healthy, status: res.status, elapsedMs, snippet };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const reason = error?.name === "AbortError" ? `timeout >${PER_REQUEST_TIMEOUT_MS}ms` : error?.message || String(error);
    return { name, ok: false, status: 0, elapsedMs, snippet: reason };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log(`[smoke] Probing ${BASE_URL} (garbage token → expect 4xx, not 5xx)\n`);
  const results = await Promise.all(PROBES.map(probe));

  let failed = 0;
  for (const r of results) {
    const mark = r.ok ? "PASS" : "FAIL";
    const slow = r.ok && r.elapsedMs > SLOW_WARN_MS ? "  ⚠ SLOW" : "";
    if (!r.ok) failed += 1;
    console.log(`  [${mark}] ${r.name.padEnd(20)} status=${r.status} ${r.elapsedMs}ms${slow}`);
    console.log(`         ${r.snippet}`);
  }

  console.log("");
  if (failed > 0) {
    console.error(`[smoke] ❌ ${failed}/${results.length} function(s) crashed or unreachable. Deploy is NOT healthy.`);
    process.exitCode = 1;
    return;
  }
  console.log(`[smoke] ✅ All ${results.length} functions returned a controlled response.`);
}

main().catch((error) => {
  console.error("[smoke] Unexpected error:", error);
  process.exitCode = 1;
});
