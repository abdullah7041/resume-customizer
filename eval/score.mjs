// Pure field-level scorer for resume-parse evals. No deps, no I/O.
// scoreResume(expected, actual) -> { overall, categories: [{ name, weight, score, status, detail }] }
//
// "expected" is the gold spec for a fixture (see eval/README.md). It only lists
// the fields worth asserting, using a small matching DSL:
//   - exact strings     -> normalized equality (name, email)
//   - "...Contains" keys -> list of substrings that must appear (summary, label)
//   - set keys           -> recall of expected items (profiles, skills, languages)
//   - work[]             -> matched by company, then position/dates/highlight count

const norm = (s) => (typeof s === "string" ? s : "").toLowerCase().replace(/\s+/g, " ").trim();
const stripPunct = (s) => norm(s).replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
const contains = (hay, needle) => {
  const h = stripPunct(hay);
  const n = stripPunct(needle);
  return n.length > 0 && h.includes(n);
};
const years = (s) => Array.from(norm(s).matchAll(/\b(19|20)\d{2}\b/g)).map((m) => m[0]);
const hasPresent = (s) => /present|current|now/.test(norm(s));

// Date match that tolerates format differences: share a year, or both say "present".
const dateMatch = (actual, expected) => {
  if (!expected) return true;
  if (hasPresent(expected)) return hasPresent(actual) || years(expected).some((y) => years(actual).includes(y));
  const ey = years(expected);
  if (ey.length === 0) return contains(actual, expected);
  return ey.some((y) => years(actual).includes(y));
};

const ratio = (matched, total) => (total === 0 ? 1 : matched / total);
const statusOf = (score) => (score >= 0.999 ? "pass" : score >= 0.5 ? "partial" : "fail");

const flattenStrings = (arr, keys) => {
  if (!Array.isArray(arr)) return "";
  return arr
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") return keys.map((k) => item[k]).filter(Boolean).join(" ");
      return "";
    })
    .join(" | ");
};

const recall = (haystack, expectedItems) => {
  if (!Array.isArray(expectedItems) || expectedItems.length === 0) return { score: 1, detail: "none expected" };
  const matched = expectedItems.filter((e) => contains(haystack, e));
  return {
    score: ratio(matched.length, expectedItems.length),
    detail: `${matched.length}/${expectedItems.length}` + (matched.length < expectedItems.length ? ` (missing: ${expectedItems.filter((e) => !contains(haystack, e)).join(", ")})` : ""),
  };
};

export function scoreResume(expected = {}, actual = {}) {
  const cats = [];
  const add = (name, weight, score, detail) => cats.push({ name, weight, score: Math.max(0, Math.min(1, score)), status: statusOf(score), detail });

  const eb = expected.basics || {};
  const ab = actual.basics || {};

  if (eb.name) {
    const ok = norm(ab.name) === norm(eb.name) || contains(ab.name, eb.name);
    add("basics.name", 1, ok ? 1 : 0, ok ? ab.name : `got "${ab.name ?? ""}"`);
  }
  if (eb.labelContains) {
    const r = recall(ab.label || "", eb.labelContains);
    add("basics.label", 1, r.score, r.detail);
  }
  if (eb.location) {
    const loc = ab.location || {};
    const locStr = [loc.city, loc.region, loc.countryCode, loc.country].filter(Boolean).join(" ");
    if (eb.location.city) add("basics.location.city", 1, contains(locStr, eb.location.city) ? 1 : 0, contains(locStr, eb.location.city) ? eb.location.city : `got "${locStr}"`);
    if (eb.location.country) add("basics.location.country", 1, contains(locStr, eb.location.country) ? 1 : 0, contains(locStr, eb.location.country) ? eb.location.country : `got "${locStr}"`);
  }
  if (eb.summaryContains) {
    const present = norm(ab.summary).length > 0;
    const r = recall(ab.summary || "", eb.summaryContains);
    const score = present ? r.score : 0;
    add("basics.summary", 2, score, present ? r.detail : "summary empty");
  }
  if (eb.profiles) {
    const profStr = flattenStrings(ab.profiles, ["network", "url", "username"]) + " " + (ab.url || "");
    const r = recall(profStr, eb.profiles);
    add("basics.profiles", 1, r.score, r.detail);
  }

  if (Array.isArray(expected.work)) {
    const aw = Array.isArray(actual.work) ? actual.work : [];
    const expLen = expected.work.length;
    const countScore = expLen === 0 ? 1 : 1 - Math.min(1, Math.abs(aw.length - expLen) / expLen);
    add("work.count", 1, countScore, `expected ${expLen}, got ${aw.length}`);

    for (const ew of expected.work) {
      const match = aw.find((w) => contains(w.name || w.company || "", ew.name));
      if (!match) {
        add(`work: ${ew.name}`, 1, 0, "company not found");
        continue;
      }
      const checks = [];
      if (ew.position) checks.push(contains(match.position || match.jobTitle || "", ew.position) ? 1 : 0);
      if (ew.startDate) checks.push(dateMatch(match.startDate || "", ew.startDate) ? 1 : 0);
      if (ew.endDate) checks.push(dateMatch(match.endDate || "", ew.endDate) ? 1 : 0);
      if (ew.minHighlights) checks.push((Array.isArray(match.highlights) ? match.highlights.length : 0) >= ew.minHighlights ? 1 : 0);
      const s = checks.length ? checks.reduce((a, b) => a + b, 0) / checks.length : 1;
      const hl = Array.isArray(match.highlights) ? match.highlights.length : 0;
      add(`work: ${ew.name}`, 1, s, `pos/dates/highlights ok=${checks.filter(Boolean).length}/${checks.length}, highlights=${hl}`);
    }
  }

  if (Array.isArray(expected.education)) {
    const ae = flattenStrings(actual.education, ["institution", "area", "studyType"]);
    const insts = expected.education.map((e) => e.institution).filter(Boolean);
    const r = recall(ae, insts);
    add("education", 1, r.score, r.detail);
  }
  if (expected.skillsKeywords) {
    const sk = flattenStrings(actual.skills, ["name", "keywords"]) + " " + flattenStrings(actual.skills?.flatMap?.((s) => s.keywords || []) || [], []);
    const r = recall(sk, expected.skillsKeywords);
    add("skills.keywords", 2, r.score, r.detail);
  }
  if (expected.languages) {
    const lg = flattenStrings(actual.languages, ["language", "fluency"]);
    const r = recall(lg, expected.languages);
    add("languages", 1, r.score, r.detail);
  }
  if (expected.certificatesContains) {
    const ce = flattenStrings(actual.certificates, ["name", "issuer"]);
    const r = recall(ce, expected.certificatesContains);
    add("certificates", 1, r.score, r.detail);
  }

  const totalWeight = cats.reduce((a, c) => a + c.weight, 0);
  const overall = totalWeight === 0 ? 0 : cats.reduce((a, c) => a + c.score * c.weight, 0) / totalWeight;
  return { overall, categories: cats };
}
