// Hard filters, ported from the job-search-digest engine (digest.py:655-684).
// Each rule here is a bug that pipeline already paid for once.

import { containsAny, matchedRoleTerms, normalizeTerms, normalizeText } from './normalize';
import type { FeedIntent, FeedDropReason, FeedPosting, Seniority } from './types';

/** Saudi locations, English and Arabic. Normalized at load, so ة/ه folding is already applied. */
export const SAUDI_LOCATIONS = normalizeTerms([
  'saudi', 'ksa', 'k.s.a', 'riyadh', 'jeddah', 'jedda', 'dammam', 'khobar', 'dhahran',
  'mecca', 'makkah', 'medina', 'madinah', 'tabuk', 'abha', 'jubail', 'yanbu', 'neom',
  'qassim', 'buraidah', 'hail', 'najran', 'jazan', 'taif', 'hofuf', 'ahsa', 'remote - saudi',
  'السعودية', 'الرياض', 'جدة', 'الدمام', 'الخبر', 'الظهران', 'مكة', 'المدينة', 'المنورة',
  'تبوك', 'أبها', 'الجبيل', 'ينبع', 'نيوم', 'القصيم', 'بريدة', 'حائل', 'نجران', 'جازان',
  'الطائف', 'الهفوف', 'الأحساء',
]);

/** Below the user's level — never wanted once someone is mid-career or above. */
export const BELOW_LEVEL_TERMS = normalizeTerms([
  'intern', 'internship', 'trainee', 'graduate program', 'fresh graduate', 'entry level',
  'entry-level', 'apprentice', 'co-op', 'coop student', 'tamheer', 'junior',
  'متدرب', 'تدريب', 'مبتدئ', 'حديث التخرج', 'تمهير',
]);

/**
 * Above a senior individual contributor. The digest scored Lead/Staff roles 85-98
 * for months because seniority was only ever bounded from below.
 */
export const ABOVE_LEVEL_TERMS = normalizeTerms([
  'lead ', ' lead', 'staff ', 'principal', 'head of', 'director', 'chief', 'vp ',
  'vice president', 'engineering manager', 'team leader', 'team lead', 'people manager',
  'رئيس', 'مدير إدارة', 'قائد فريق', 'نائب الرئيس',
]);

/** Words that carry level, not function — dropped before deriving role terms. */
const LEVEL_WORDS = normalizeTerms([
  'senior', 'sr', 'junior', 'jr', 'lead', 'staff', 'principal', 'mid', 'mid-level',
  'entry', 'level', 'i', 'ii', 'iii', 'iv', 'أول', 'أقدم', 'مبتدئ',
]);

/**
 * Function words, including the two-letter ones. These carry the filtering that a
 * minimum token length used to do crudely — see `deriveRoleTerms`.
 */
const STOPWORDS = normalizeTerms([
  'and', 'or', 'the', 'of', 'for', 'a', 'an', 'in', 'at', 'to', 'with', 'on', 'by',
  'as', 'is', 'be', 'it', 'we', 'do', 'up', 'no', 'so', 'if', 'my', 'me',
  'في', 'من', 'الى', 'على', 'و', 'أو', 'عن', 'مع', 'ما', 'ان', 'لا',
]);

const SENIORITY_RANK: Record<Seniority, number> = {
  junior: 0, mid: 1, senior: 2, lead: 3, manager: 4,
};

/**
 * The terms a title must support, derived from the user's own target roles rather
 * than a fixed tech vocabulary — an accountant or a nurse gets the same treatment
 * as an engineer.
 */
export function deriveRoleTerms(targetRoles: readonly string[]): string[] {
  const terms = new Set<string>();

  for (const role of targetRoles) {
    for (const token of normalizeText(role).split(/[\s/,·|()-]+/)) {
      // Two characters is the floor, not three. A three-character minimum silently
      // discarded AI, ML, BI, QA, UX and HR — precisely the terms that distinguish
      // roles in this market. With them gone every engineering role scored an
      // identical 40 + 15, so "Senior AI Backend Engineer" ranked level with
      // "Senior Product Designer" and the ordering meant nothing. Function words
      // are excluded by STOPWORDS rather than by length.
      if (token.length < 2) continue;
      if (LEVEL_WORDS.includes(token)) continue;
      if (STOPWORDS.includes(token)) continue;
      terms.add(token);
    }
  }

  return [...terms];
}

/**
 * True when the TITLE says the job is really somewhere else, whatever the board's
 * location metadata claims. The 2026-07-31 digest delivered Agoda's "Staff Data
 * Engineer (Bangkok based, relocation provided)" as Riyadh because only the
 * metadata was ever read.
 */
export function locationConflict(title: string, allowedLocations: readonly string[]): boolean {
  const normalized = normalizeText(title);
  if (normalized.includes('relocat')) return true;
  if (normalized.includes('based') && !containsAny(normalized, allowedLocations)) return true;
  return false;
}

/** Which level terms apply, given where the user sits. */
export function excludedLevelTerms(seniority: Seniority | undefined): string[] {
  const rank = seniority ? SENIORITY_RANK[seniority] : SENIORITY_RANK.senior;
  const excluded: string[] = [];
  if (rank >= SENIORITY_RANK.mid) excluded.push(...BELOW_LEVEL_TERMS);
  if (rank <= SENIORITY_RANK.senior) excluded.push(...ABOVE_LEVEL_TERMS);
  return excluded;
}

/**
 * The first rule a posting breaks, or null when it clears them all. Order matters:
 * the reason is shown to the user, and "outside Saudi" is more useful than "wrong role".
 */
export function dropReason(posting: FeedPosting, intent: FeedIntent): FeedDropReason | null {
  const locations = intent.locations?.length ? normalizeTerms(intent.locations) : SAUDI_LOCATIONS;
  const title = normalizeText(posting.title);
  const location = normalizeText(posting.location);

  if (!containsAny(location, locations)) return 'location';
  if (locationConflict(posting.title, locations)) return 'location_conflict';
  if (containsAny(title, excludedLevelTerms(intent.seniority))) return 'seniority';

  const roleTerms = deriveRoleTerms(intent.targetRoles);
  if (roleTerms.length > 0 && matchedRoleTerms(posting.title, roleTerms).length === 0) return 'role';

  return null;
}
