// Deterministic scorer for the ai_match gold set. Given a fixture's expected
// constraints and the model's actual match output, returns a weighted 0-1 score
// per category plus an overall — same result shape parse-eval's printCard expects.
//
// Categories:
//   score_band       (w3)  actual.score inside expected.scoreBand [lo, hi];
//                          partial credit decays with distance outside the band.
//   missing_keywords (w2)  every expected.mustFlagMissing term appears somewhere
//                          in missingKeywords or categoryScores missing/gaps.
//   strong_matches   (w2)  every expected.mustCredit term appears in strongMatches
//                          or categoryScores matched arrays.
//   structure        (w1)  contract invariants: integer 0-100 score, all four
//                          categories present with integer score within 0..max,
//                          3-5 bullets <=120 chars, reasoning text.
//
// NOTE on category maxes: the prompt states 40/30/15/15 rubric WEIGHTS, but
// gemini-2.5-flash consistently emits each category on its own 0-100 scale
// (max: 100). The frontend (ScoreBreakdown) only uses the score/max ratio, so
// both shapes are valid — assert score-within-max, not a specific max value.

const CATEGORY_KEYS = ["hard_skills", "experience", "education", "soft_skills"];

const norm = (s) => String(s ?? "").toLowerCase().trim();

// A term counts as found if it substring-matches any pool entry in either
// direction ("Node" ~ "Node.js", "Microsoft Power BI" ~ "Power BI").
const termFound = (term, pool) => {
  const t = norm(term);
  return t.length > 0 && pool.some((k) => k.length > 0 && (k.includes(t) || t.includes(k)));
};

const collectPool = (actual, arrayKeys) => {
  const pool = [];
  for (const key of arrayKeys.top) {
    const arr = actual?.[key];
    if (Array.isArray(arr)) pool.push(...arr.map(norm));
  }
  for (const cat of Object.values(actual?.categoryScores ?? {})) {
    for (const key of arrayKeys.category) {
      const arr = cat?.[key];
      if (Array.isArray(arr)) pool.push(...arr.map(norm));
    }
  }
  return pool;
};

const statusFor = (score) => (score >= 0.999 ? "pass" : score >= 0.5 ? "partial" : "fail");

export function scoreMatch(expected, actual) {
  const categories = [];
  const hardFailures = [];
  const add = (name, score, detail, weight) => {
    const clamped = Math.max(0, Math.min(1, score));
    categories.push({ name, score: clamped, status: statusFor(clamped), detail, weight });
  };

  // --- score_band ---
  const [lo, hi] = expected.scoreBand;
  const s = actual?.score;
  if (typeof s !== "number" || Number.isNaN(s)) {
    add("score_band", 0, "no numeric score in output", 3);
  } else if (s >= lo && s <= hi) {
    add("score_band", 1, `score ${s} within [${lo}, ${hi}]`, 3);
  } else {
    const dist = s < lo ? lo - s : s - hi;
    add("score_band", 1 - dist / 15, `score ${s} outside [${lo}, ${hi}] by ${dist}`, 3);
  }

  // --- missing_keywords ---
  if (expected.mustFlagMissing?.length) {
    const pool = collectPool(actual, { top: ["missingKeywords"], category: ["missing", "gaps"] });
    const notFlagged = expected.mustFlagMissing.filter((t) => !termFound(t, pool));
    hardFailures.push(...notFlagged.map((term) => `required_gap_missing:${term}`));
    add(
      "missing_keywords",
      (expected.mustFlagMissing.length - notFlagged.length) / expected.mustFlagMissing.length,
      notFlagged.length === 0
        ? `all ${expected.mustFlagMissing.length} gaps flagged`
        : `not flagged: ${notFlagged.join(", ")}`,
      2,
    );
  }

  // --- strong_matches ---
  if (expected.mustCredit?.length) {
    const pool = collectPool(actual, { top: ["strongMatches"], category: ["matched"] });
    const notCredited = expected.mustCredit.filter((t) => !termFound(t, pool));
    hardFailures.push(...notCredited.map((term) => `required_strength_missing:${term}`));
    add(
      "strong_matches",
      (expected.mustCredit.length - notCredited.length) / expected.mustCredit.length,
      notCredited.length === 0
        ? `all ${expected.mustCredit.length} strengths credited`
        : `not credited: ${notCredited.join(", ")}`,
      2,
    );
  }

  // Listed-only or otherwise unsupported terms that must not be presented as
  // strengths. This is a hard gate for keyword-stuffing fixtures.
  if (expected.mustNotCredit?.length) {
    const pool = collectPool(actual, { top: ["strongMatches"], category: ["matched"] });
    const incorrectlyCredited = expected.mustNotCredit.filter((t) => termFound(t, pool));
    hardFailures.push(...incorrectlyCredited.map((term) => `forbidden_strength_credited:${term}`));
    add(
      "forbidden_strong_matches",
      (expected.mustNotCredit.length - incorrectlyCredited.length) / expected.mustNotCredit.length,
      incorrectlyCredited.length === 0
        ? `no forbidden strengths credited`
        : `incorrectly credited: ${incorrectlyCredited.join(", ")}`,
      2,
    );
  }

  // --- structure ---
  const checks = [];
  const check = (label, ok) => checks.push({ label, ok: Boolean(ok) });
  check("integer score 0-100", Number.isInteger(s) && s >= 0 && s <= 100);
  const cats = actual?.categoryScores;
  for (const key of CATEGORY_KEYS) {
    const cat = cats?.[key];
    check(
      `${key} integer score within 0..max`,
      cat && typeof cat.max === "number" && cat.max > 0 &&
        Number.isInteger(cat.score) && cat.score >= 0 && cat.score <= cat.max,
    );
  }
  const bullets = actual?.summary_bullets;
  check(
    "3-5 summary bullets, each <=120 chars",
    Array.isArray(bullets) && bullets.length >= 3 && bullets.length <= 5 &&
      bullets.every((b) => typeof b === "string" && b.length > 0 && b.length <= 120),
  );
  check("non-empty reasoning", typeof actual?.reasoning === "string" && actual.reasoning.trim().length > 0);
  check("strongMatches is array", Array.isArray(actual?.strongMatches));
  check("missingKeywords is array", Array.isArray(actual?.missingKeywords));
  const failed = checks.filter((c) => !c.ok);
  hardFailures.push(...failed.map((failure) => `structure:${failure.label}`));
  add(
    "structure",
    (checks.length - failed.length) / checks.length,
    failed.length === 0 ? `all ${checks.length} invariants hold` : `broken: ${failed.map((c) => c.label).join("; ")}`,
    1,
  );

  if (expected.proseLanguage === "ar") {
    const hasArabic = (value) => typeof value === "string" && /\p{Script=Arabic}/u.test(value);
    const languageFailures = [];
    if (!hasArabic(actual?.reasoning)) languageFailures.push("reasoning_not_arabic");
    for (const [index, bullet] of (Array.isArray(actual?.summary_bullets) ? actual.summary_bullets : []).entries()) {
      if (!hasArabic(bullet)) languageFailures.push(`summary_bullet_not_arabic:${index + 1}`);
    }
    hardFailures.push(...languageFailures);
    add(
      "prose_language",
      languageFailures.length === 0 ? 1 : 0,
      languageFailures.length === 0 ? "reasoning and bullets contain Arabic prose" : languageFailures.join("; "),
      1,
    );
  }

  const totalWeight = categories.reduce((a, c) => a + c.weight, 0);
  const overall = categories.reduce((a, c) => a + c.score * c.weight, 0) / totalWeight;
  return { overall, categories, passed: hardFailures.length === 0, hardFailures };
}
