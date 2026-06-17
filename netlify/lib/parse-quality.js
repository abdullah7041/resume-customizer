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
// LinkedIn profile URL (with or without scheme/www).
const LINKEDIN_RE = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?/i;
// Generic URL (http/https), used as a portfolio/website fallback when no LinkedIn URL exists.
const URL_RE = /https?:\/\/[^\s,)]+/gi;

const HEADING_PATTERNS = {
  summary: /\b(summary|profile|about|objective)\b/i,
  education: /\b(education|academic background|qualifications?)\b/i,
  certificates: /\b(certifications?|certificates?|courses?|licen[sc]es?)\b/i,
  projects: /\b(independent projects|selected projects|projects?)\b/i,
  skills: /\b(technical skills|core competencies|competencies|technical proficienc\w*|technologies|toolchain|skills)\b/i,
  experience: /\b(work experience|professional experience|chronological experience|employment|experience)\b/i,
  languages: /\b(languages?)\b/i,
};

// All known section headings, used to find the END boundary of a sliced section
// (i.e. where the NEXT heading begins).
const ALL_HEADING_PATTERNS = [
  HEADING_PATTERNS.summary,
  HEADING_PATTERNS.education,
  HEADING_PATTERNS.certificates,
  HEADING_PATTERNS.projects,
  HEADING_PATTERNS.skills,
  HEADING_PATTERNS.experience,
  HEADING_PATTERNS.languages,
  /\b(awards?|honors?|honours?)\b/i,
  /\b(references?)\b/i,
  /\b(contact|personal information)\b/i,
];

const NON_RECOVERY_HEADING_PATTERNS = [
  /\b(awards?|honors?|honours?)\b/i,
  /\b(references?)\b/i,
  /\b(contact|personal information)\b/i,
];

// Heading keyword families used to recognize a standalone (possibly COMBINED)
// heading line, e.g. "Education, Certifications & Languages".
const HEADING_KEYWORDS = [
  { key: "summary", re: /\b(summary|profile|about|objective)\b/i },
  { key: "skills", re: /\b(technical skills|core competencies|competencies|technical proficienc\w*|technologies|toolchain|skills)\b/i },
  { key: "experience", re: /\b(work experience|professional experience|chronological experience|employment|experience)\b/i },
  { key: "projects", re: /\b(independent projects|selected projects|projects?)\b/i },
  { key: "education", re: /\b(education|academic background|qualifications?)\b/i },
  { key: "certificates", re: /\b(certifications?|certificates?|courses?|licen[sc]es?)\b/i },
  { key: "languages", re: /\b(languages?)\b/i },
];

// Inline sub-line prefixes that introduce a section mid-block, e.g.
// "Education: BSc ...", "Certificates & Courses: ...", "Languages: English, Arabic".
const PREFIX_LABELS = [
  { key: "summary", re: /^(?:summary|profile|about|objective)\s*[:-]\s*(.*)$/i },
  { key: "skills", re: /^(?:technical\s+skills|core\s+competencies|technologies|toolchain|skills)\s*[:-]\s*(.*)$/i },
  { key: "experience", re: /^(?:work\s+experience|professional\s+experience|employment|experience)\s*[:-]\s*(.*)$/i },
  { key: "projects", re: /^(?:independent\s+projects|selected\s+projects|projects?)\s*[:-]\s*(.*)$/i },
  { key: "education", re: /^(?:education|academic\s+background|qualifications?)\s*[:-]\s*(.*)$/i },
  { key: "certificates", re: /^(?:certifications?|certificates?(?:\s*&\s*courses)?|courses?|licen[sc]es?)\s*[:-]\s*(.*)$/i },
  { key: "languages", re: /^languages?\s*[:-]\s*(.*)$/i },
];

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
    experience: HEADING_PATTERNS.experience.test(text),
    education: HEADING_PATTERNS.education.test(text),
    certificates: HEADING_PATTERNS.certificates.test(text),
    projects: HEADING_PATTERNS.projects.test(text),
    skills: HEADING_PATTERNS.skills.test(text),
    languages: HEADING_PATTERNS.languages.test(text),
    emails,
    phones,
  };
}

/**
 * True when a work array is missing OR any entry lacks a company name or has no
 * highlights — both are observable drops, not genuinely absent data.
 */
const isWorkIncomplete = (work) => {
  if (!Array.isArray(work) || work.length === 0) return true;
  return work.some((entry) => !entry.name || !Array.isArray(entry.highlights) || entry.highlights.length === 0);
};

/**
 * Sections/contact fields present in the raw text but missing/empty in the
 * structured parser output. Returned values are the focus labels passed back
 * into the parser for a focused retry.
 */
export function findMissingSections(signals, analysis = {}) {
  const missing = [];
  if (signals.experience && isWorkIncomplete(analysis.work)) missing.push("experience");
  if (signals.education && isEmptyArray(analysis.education)) missing.push("education");
  if (signals.certificates && isEmptyArray(analysis.certificates)) missing.push("certificates");
  if (signals.projects && isEmptyArray(analysis.projects)) missing.push("projects");
  if (signals.skills && isEmptyArray(analysis.skills)) missing.push("skills");
  if (signals.languages && isEmptyArray(analysis.languages)) missing.push("languages");

  const basics = analysis.basics || {};
  if (signals.emails.length > 0 && !basics.email) missing.push("email");
  if (signals.phones.length > 0 && !basics.phone) missing.push("phone");
  return missing;
}

const rawHas = (signals, value) => {
  if (!value) return false;
  return signals.lower.includes(String(value).toLowerCase());
};

const evidencedText = (signals, value) => (
  typeof value === "string" && value.trim().length > 0 && rawHas(signals, value.trim())
);

const evidencedHighlights = (signals, highlights) => {
  if (!Array.isArray(highlights)) return [];
  return highlights.filter(
    (h) => typeof h === "string" && h.trim().length > 0 && rawHas(signals, h.trim().substring(0, 30)),
  );
};

const buildEvidenceBackedWorkEntry = (signals, entry) => {
  const recovered = {};
  if (evidencedText(signals, entry.position)) recovered.position = entry.position;
  if (evidencedText(signals, entry.name)) recovered.name = entry.name;
  if (evidencedText(signals, entry.location)) recovered.location = entry.location;
  if (evidencedText(signals, entry.startDate)) recovered.startDate = entry.startDate;
  if (evidencedText(signals, entry.endDate)) recovered.endDate = entry.endDate;

  const highlights = evidencedHighlights(signals, entry.highlights);
  if (highlights.length > 0) recovered.highlights = highlights;

  return recovered;
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
      entry.language,
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
 *  - work: per-entry merge — fills missing company name and/or highlights on a
 *    matched first-pass entry (matched by position title); appends new entries
 *    only when evidence-backed. Never overwrites populated fields; never fabricates.
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

  for (const section of ["education", "certificates", "projects", "skills", "languages"]) {
    const firstArr = Array.isArray(firstPass[section]) ? firstPass[section] : [];
    const retryArr = Array.isArray(retry[section]) ? retry[section] : [];
    if (firstArr.length > 0 || retryArr.length === 0) continue;

    const hasEvidence = signals[section] || retryArr.some((entry) => entityInRaw(signals, entry));
    if (hasEvidence) merged[section] = retryArr;
  }

  // Evidence-gated work merge: fill missing company name / highlights per entry.
  // Matches retry entries to first-pass entries by position title (case-insensitive).
  // Only fills empty fields — never overwrites populated ones, never fabricates.
  const firstWork = Array.isArray(firstPass.work) ? firstPass.work.map((e) => ({ ...e })) : [];
  const retryWork = Array.isArray(retry.work) ? retry.work : [];

  if (retryWork.length > 0 && isWorkIncomplete(firstWork)) {
    const mergedWork = firstWork.length > 0 ? firstWork : [];

    for (const retryEntry of retryWork) {
      if (!retryEntry || typeof retryEntry !== "object") continue;

      // Only accept retry entries whose position or company appears in raw text.
      const isEvidenceBacked = rawHas(signals, retryEntry.position) || rawHas(signals, retryEntry.name);
      if (!isEvidenceBacked) continue;

      const positionKey = String(retryEntry.position || "").toLowerCase().trim();
      const existing = mergedWork.find(
        (e) => String(e.position || "").toLowerCase().trim() === positionKey,
      );

      if (existing) {
        // Fill company name if first-pass dropped it and retry value is in raw text.
        if (!existing.name && retryEntry.name && rawHas(signals, retryEntry.name)) {
          existing.name = retryEntry.name;
        }
        // Fill highlights if first-pass dropped them; filter each bullet to raw-text evidence.
        if ((!Array.isArray(existing.highlights) || existing.highlights.length === 0)) {
          const highlights = evidencedHighlights(signals, retryEntry.highlights);
          if (highlights.length > 0) existing.highlights = highlights;
        }
        // Fill dates only when the exact retry value is visible in the raw text.
        if (!existing.startDate && evidencedText(signals, retryEntry.startDate)) existing.startDate = retryEntry.startDate;
        if (!existing.endDate && evidencedText(signals, retryEntry.endDate)) existing.endDate = retryEntry.endDate;
      } else if (signals.experience) {
        const recoveredEntry = buildEvidenceBackedWorkEntry(signals, retryEntry);
        if (Object.keys(recoveredEntry).length > 0) mergedWork.push(recoveredEntry);
      }
    }

    if (mergedWork.length > 0) merged.work = mergedWork;
  }

  return merged;
}

/**
 * Slice the raw text body belonging to a section, from its heading line
 * (exclusive) up to — but not including — the next recognized section heading.
 * Returns an array of non-empty, trimmed lines, or an empty array if the
 * section's heading is not present or has no body lines before the next heading.
 *
 * Evidence-only: this never invents lines, it only returns lines that are
 * literally present in `rawText`.
 */
export function sliceSection(rawText, sectionKey) {
  const text = typeof rawText === "string" ? rawText : "";
  if (!text) return [];

  const headingPattern = HEADING_PATTERNS[sectionKey];
  if (!headingPattern) return [];

  const lines = text.split(/\r?\n/);

  // Find the line that matches the section's own heading.
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingPattern.test(lines[i])) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) return [];

  // Find the next line (after the heading) that matches ANY other known heading.
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const isOtherHeading = ALL_HEADING_PATTERNS.some((pattern) => {
      if (pattern === headingPattern) return false;
      return pattern.test(line);
    });
    // Also stop if the line matches this section's own heading pattern again
    // (defensive — avoids runaway slices on repeated headings).
    const isSameHeadingAgain = i !== startIdx && headingPattern.test(line);
    if (isOtherHeading || isSameHeadingAgain) {
      endIdx = i;
      break;
    }
  }

  return lines
    .slice(startIdx + 1, endIdx)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Split a sliced "skills" block into individual keyword tokens. Splits on
 * commas, bullets, pipes, and semicolons — common delimiters in skills lists.
 */
function splitSkillTokens(lines) {
  return lines
    .join("\n")
    .split(/[\r\n,;|•·]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

/**
 * Determine whether a line is a standalone section heading (optionally a
 * COMBINED heading like "Education, Certifications & Languages"). Returns the
 * list of section keys it introduces, or [] if the line carries real content.
 */
function headingSectionsOf(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed || trimmed.length > 70) return [];

  const matched = new Set();
  let residual = trimmed;
  for (const { key, re } of HEADING_KEYWORDS) {
    if (re.test(trimmed)) {
      matched.add(key);
      residual = residual.replace(new RegExp(re.source, "ig"), " ");
    }
  }
  if (matched.size === 0) return [];

  // Strip separators and connective words; if nothing meaningful remains, the
  // line is purely heading keywords (a real heading, not a content line).
  residual = residual
    .replace(/[,&/|:•·\-–—]+/g, " ")
    .replace(/\b(and|of|amp)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (residual.length <= 2) return [...matched];
  return [];
}

/**
 * Deterministic, generic section segmentation. Splits normalized resume text
 * into `{ sectionKey: lines[] }`. Handles:
 *  - standalone headings (incl. COMBINED headings),
 *  - inline sub-line prefixes ("Education:", "Languages: English, Arabic").
 * Plain body lines are assigned to the currently-open section (the primary of a
 * combined heading). Never invents text — only groups lines literally present.
 */
export function segmentSections(rawText) {
  const text = typeof rawText === "string" ? rawText : "";
  const result = {};
  const ensure = (key) => {
    if (!result[key]) result[key] = [];
    return result[key];
  };

  let current = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // Inline prefix takes priority: opens (or re-opens) a single section.
    let prefixed = false;
    for (const { key, re } of PREFIX_LABELS) {
      const m = line.match(re);
      if (m) {
        current = key;
        ensure(key);
        const rest = (m[1] || "").trim();
        if (rest) result[key].push(rest);
        prefixed = true;
        break;
      }
    }
    if (prefixed) continue;

    // Standalone / combined heading line.
    const hs = headingSectionsOf(line);
    if (hs.length > 0) {
      for (const k of hs) ensure(k);
      current = hs[0];
      continue;
    }

    if (NON_RECOVERY_HEADING_PATTERNS.some((pattern) => pattern.test(line))) {
      current = null;
      continue;
    }

    if (current) ensure(current).push(line);
  }

  return result;
}

/**
 * Parse visible language lines into `{ language, fluency? }` entries. Fluency is
 * only set when explicitly present (e.g. "English (Native)", "Arabic - Fluent").
 * No invention; deduplicates case-insensitively.
 */
export function parseLanguageLines(lines) {
  const joined = (Array.isArray(lines) ? lines : []).join(", ");
  const tokens = joined
    .split(/[,;|/]+|\s+•\s+|·/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  const out = [];
  const seen = new Set();
  for (const token of tokens) {
    const m = token.match(/^([\p{L}][\p{L} ]*?)\s*(?:[([\-–—:]\s*([\p{L} ]+?)\)?\s*)?$/u);
    if (!m) continue;
    const language = m[1].trim();
    if (language.length < 2) continue;
    const key = language.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const fluency = (m[2] || "").trim();
    out.push(fluency ? { language, fluency } : { language });
  }
  return out;
}

/**
 * Build a conservative, evidence-only JSON Resume baseline from raw text using
 * deterministic segmentation. Used both as a standalone baseline and as the
 * source for recovery. Invents nothing — institutions/dates/issuers stay empty.
 */
export function buildDeterministicBaseline(rawText, signals) {
  const text = typeof rawText === "string" ? rawText : "";
  const sig = signals || detectSectionSignals(text);
  const sections = segmentSections(text);
  const baseline = {};

  // ---- basics / contact ----
  const basics = {};
  if (sig.emails?.length > 0) basics.email = sig.emails[0];
  if (sig.phones?.length > 0) basics.phone = sig.phones[0];
  const linkedinMatch = text.match(LINKEDIN_RE);
  if (linkedinMatch) {
    const url = linkedinMatch[0].startsWith("http") ? linkedinMatch[0] : `https://${linkedinMatch[0]}`;
    basics.url = url;
    basics.profiles = [{ network: "LinkedIn", username: "", url }];
  } else {
    const urlMatches = text.match(URL_RE);
    if (urlMatches && urlMatches.length > 0) basics.url = urlMatches[0];
  }
  if (Object.keys(basics).length > 0) baseline.basics = basics;

  // ---- sections (conservative shapes; no fabrication) ----
  if (sections.education?.length > 0) {
    baseline.education = [
      { institution: "", area: "", studyType: "", startDate: "", endDate: "", highlights: sections.education },
    ];
  }
  if (sections.certificates?.length > 0) {
    baseline.certificates = sections.certificates.map((line) => ({ name: line, issuer: "", date: "" }));
  }
  if (sections.projects?.length > 0) {
    baseline.projects = sections.projects.map((line) => ({ name: line, description: "", highlights: [] }));
  }
  if (sections.skills?.length > 0) {
    const keywords = splitSkillTokens(sections.skills);
    if (keywords.length > 0) baseline.skills = [{ name: "Skills", keywords }];
  }
  if (sections.languages?.length > 0) {
    const langs = parseLanguageLines(sections.languages);
    if (langs.length > 0) baseline.languages = langs;
  }

  return baseline;
}

/**
 * Deterministic, evidence-only recovery of sections/contact fields that the
 * structured parser dropped but which ARE visibly present in the raw resume
 * text. Uses ONLY text that literally appears in `rawText` — invents nothing
 * (no fabricated institutions, dates, issuers, etc.).
 *
 * Returns `{ analysis, fallbackSections }` where `fallbackSections` lists every
 * section/contact field that was recovered (e.g. ['education', 'email']).
 */
export function recoverSectionsFromRawText(analysis = {}, signals, rawText) {
  const text = typeof rawText === "string" ? rawText : "";
  const sig = signals || detectSectionSignals(text);
  const recovered = { ...analysis };
  const fallbackSections = [];

  // Deterministic baseline derived from generic segmentation (handles combined
  // headings + inline prefixes + languages). We only ever FILL empty fields —
  // never overwrite anything the AI parser already populated.
  const baseline = buildDeterministicBaseline(text, sig);

  // ---- Contact fields -------------------------------------------------
  const basics = { ...(recovered.basics || {}) };
  let basicsChanged = false;

  if (!basics.email && baseline.basics?.email) {
    basics.email = baseline.basics.email;
    basicsChanged = true;
    fallbackSections.push("email");
  }
  if (!basics.phone && baseline.basics?.phone) {
    basics.phone = baseline.basics.phone;
    basicsChanged = true;
    fallbackSections.push("phone");
  }

  const hasProfiles = Array.isArray(basics.profiles) && basics.profiles.length > 0;
  if (!basics.url && !hasProfiles && baseline.basics?.url) {
    basics.url = baseline.basics.url;
    if (Array.isArray(baseline.basics.profiles)) basics.profiles = baseline.basics.profiles;
    basicsChanged = true;
    fallbackSections.push("url");
  }

  if (basicsChanged) {
    recovered.basics = basics;
  }

  // ---- Sections (education / certificates / projects / skills / languages) ----
  for (const section of ["education", "certificates", "projects", "skills", "languages"]) {
    const existing = Array.isArray(recovered[section]) ? recovered[section] : [];
    if (existing.length > 0) continue;
    const entries = baseline[section];
    if (Array.isArray(entries) && entries.length > 0) {
      recovered[section] = entries;
      fallbackSections.push(section);
    }
  }

  return { analysis: recovered, fallbackSections };
}
