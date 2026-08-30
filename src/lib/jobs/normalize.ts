// Arabic-aware text normalization for job matching.
//
// Watheq is Arabic-first and Tier 2 company career sites are the most likely to
// post in Arabic, so every keyword comparison runs through here. Without folding
// the alef and ta-marbuta variants, half the real-world spellings of the same
// word miss: "جدة" and "جده" are the same city, "أول" and "اول" the same word.

/** Tashkeel (harakat), superscript alef, and tatweel — decorative, never semantic. */
const DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;

/** Zero-width joiners and marks that survive copy-paste from job boards. */
const INVISIBLES = /[\u200B-\u200F\u202A-\u202E\uFEFF]/g;

const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g;

/**
 * Fold a string to its comparison form: lowercase, diacritic-free, with the
 * Arabic letter variants that carry no distinction for matching collapsed.
 */
export function normalizeText(value: string | null | undefined): string {
  if (!value) return '';

  return value
    .normalize('NFKC')
    .replace(INVISIBLES, '')
    .replace(DIACRITICS, '')
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627') // أ إ آ ٱ -> ا
    .replace(/\u0629/g, '\u0647') // ة -> ه
    .replace(/\u0649/g, '\u064A') // ى -> ي
    .replace(/\u0624/g, '\u0648') // ؤ -> و
    .replace(/\u0626/g, '\u064A') // ئ -> ي
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .toLowerCase()
    .replace(/[\s\u00A0]+/g, ' ')
    .trim();
}

/** Normalize a keyword list once, at module load, so matching compares like with like. */
export function normalizeTerms(terms: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const term of terms) {
    const normalized = normalizeText(term);
    if (normalized) seen.add(normalized);
  }
  return [...seen];
}

/** True when `haystack` contains any of the already-normalized `terms`. */
export function containsAny(haystack: string, terms: readonly string[]): boolean {
  return terms.some((term) => haystack.includes(term));
}

/** Every already-normalized term present in `haystack`, in list order. */
export function matchedTerms(haystack: string, terms: readonly string[]): string[] {
  return terms.filter((term) => haystack.includes(term));
}

/** Split a title into comparable word tokens, keeping `c++` and `c#` intact. */
export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^\p{L}\p{N}+#]+/u)
    .filter(Boolean);
}

/**
 * Whether two tokens are the same word for matching purposes. Plain substring
 * matching fails the common case in both directions — "engineering" does not
 * contain "engineer" as a term, and "develop" does not contain "developer" —
 * so a shared prefix of at least four characters counts as the same stem.
 */
export function sharesStem(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 4) return false;
  return a.startsWith(b) || b.startsWith(a);
}

/** Role terms the title supports, compared token by token rather than as substrings. */
export function matchedRoleTerms(title: string, terms: readonly string[]): string[] {
  const tokens = tokenize(title);
  return terms.filter((term) => tokens.some((token) => sharesStem(token, term)));
}

/**
 * A loose key for comparing Arabic names that differ only in long vowels.
 *
 * Transliterated company names are spelled inconsistently — Tamara appears as both
 * تمارا and تامارا — so exact comparison fails on the spelling a user happens to
 * pick. Dropping the long vowels leaves a consonant skeleton that both spellings
 * share. Applied only to Arabic text: doing this to Latin script would collapse
 * genuinely different words.
 */
export function looseArabicKey(value: string): string {
  const normalized = normalizeText(value);
  if (!/[؀-ۿ]/.test(normalized)) return normalized;
  return normalized.replace(/[اويه]/g, '');
}
