// Parse-quality gate.
//
// The `lite` parser sometimes drops sections that ARE present in the raw resume
// text (observed: a short resume losing email/phone/education/certifications,
// far below any truncation cap). This module compares raw-text "section signals"
// against the structured parser output so the caller can (a) trigger ONE focused
// retry and (b) flag genuine parser loss separately from genuinely-absent
// sections — so the UI never shows misleading "No education found" warnings when
// the data was actually lost in parsing.
//
// Plain JS to match the surrounding netlify/lib/*.js modules.

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
// Loose phone matcher: a digit run (with spaces / () / - / + ) of >= 9 digits total.
const PHONE_RE = /\+?\d[\d ()-]{7,}\d/g;

const HEADING_PATTERNS = {
  education: /\b(education|academic background|qualifications?)\b/i,
  certificates: /\b(certifications?|certificates?|licen[sc]es?)\b/i,
  projects: /\bprojects?\b/i,
  skills: /\b(technical skills|core competencies|competencies|skills)\b/i,
};

const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

const isEmptyArray = (value) => !Array.isArray(value) || value.length === 0;

/**
 * Scan raw extracted resume text for section/contact signals.
 * Returns booleans per section plus the actual matched email/phone values
 * (used later as merge evidence).
 */
export function detectSectionSignals(rawText) {
  const text = typeof rawText === "string" ? rawText : "";
  const emails = Array.from(new Set(text.match(EMAIL_RE) || []));
  const phones = Array.from(new Set((text.match(PHONE_RE) || []).filter((p) => digitsOnly(p).length >= 9)));
  return {
    text,
    lower: text.toLowerCase(),
    education: HEADING_PATTERNS.education.test(text),
    certificates: HEADING_PATTERNS.certificates.test(text),
    projects: HEADING_PATTERNS.projects.test(text),
    skills: HEADING_PATTERNS.skills.test(text),
    emails,
    phones,
  };
}

/**
 * Sections/contact fields present in the raw text but missing/empty in the
 * structured parser output. Returned values are the focus labels passed back
 * into the parser for a focused retry.
 */
export function findMissingSections(signals, analysis = {}) {
  const missing = [];
  if (signals.education && isEmptyArray(analysis.education)) missing.push("education");
  if (signals.certificates && isEmptyArray(analysis.certificates)) missing.push("certificates");
  if (signals.projects && isEmptyArray(analysis.projects)) missing.push("projects");
  if (signals.skills && isEmptyArray(analysis.skills)) missing.push("skills");

  const basics = analysis.basics || {};
  if (signals.emails.length > 0 && !basics.email) missing.push("email");
  if (signals.phones.length > 0 && !basics.phone) missing.push("phone");
  return missing;
}

const rawHas = (signals, value) => {
  if (!value) return false;
  return signals.lower.includes(String(value).toLowerCase());
};

const entityInRaw = (signals, entry) => {
  const candidates = [];
  if (typeof entry === "string") {
    candidates.push(entry);
  } else if (entry && typeof entry === "object") {
    candidates.push(
      entry.institution,
      entry.area,
      entry.studyType,
      entry.name,
      entry.issuer,
      entry.position,
    );
    if (Array.isArray(entry.keywords)) candidates.push(...entry.keywords);
  }
  return candidates.filter(Boolean).some((candidate) => rawHas(signals, candidate));
};

/**
 * Evidence-gated merge of a focused-retry result into the first-pass result.
 * NEVER blindly overwrites: each retry value is only accepted when supported by
 * evidence in the raw text, so the focused retry cannot hallucinate sections.
 *  - email/phone: accepted only if present in raw text (phone normalized).
 *  - education/certificates/projects/skills: accepted only if the raw text shows
 *    the section heading OR a key entity from a retry entry.
 */
export function mergeWithEvidence(firstPass = {}, retry = {}, signals) {
  const merged = { ...firstPass };
  const basics = { ...(firstPass.basics || {}) };

  const retryEmail = retry.basics?.email;
  if (!basics.email && retryEmail) {
    const accepted = signals.emails.some((e) => e.toLowerCase() === String(retryEmail).toLowerCase())
      || rawHas(signals, retryEmail);
    if (accepted) basics.email = retryEmail;
  }

  const retryPhone = retry.basics?.phone;
  if (!basics.phone && retryPhone) {
    const candidate = digitsOnly(retryPhone);
    const accepted = candidate.length >= 9
      && signals.phones.some((p) => {
        const raw = digitsOnly(p);
        return raw.includes(candidate) || candidate.includes(raw);
      });
    if (accepted) basics.phone = retryPhone;
  }

  merged.basics = basics;

  for (const section of ["education", "certificates", "projects", "skills"]) {
    const firstArr = Array.isArray(firstPass[section]) ? firstPass[section] : [];
    const retryArr = Array.isArray(retry[section]) ? retry[section] : [];
    if (firstArr.length > 0 || retryArr.length === 0) continue;

    const hasEvidence = signals[section] || retryArr.some((entry) => entityInRaw(signals, entry));
    if (hasEvidence) merged[section] = retryArr;
  }

  return merged;
}
