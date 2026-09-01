// Saudi employers whose job boards this app can actually read.
//
// The Job Feed otherwise opens on an empty text box, and a user has to guess a
// company's ATS handle — which is not guessable (Lean's Ashby token is
// "LeanTech", nothing like its name). This list turns first use into one tap.
//
// PROVENANCE: every entry below was fetched from its live board on 2026-08-31 and
// returned a successful response — all thirteen answered HTTP 200, while two
// control tokens that name no company answered 404. That gap is the whole point:
// an empty board here means an employer with nothing posted, never a token we
// invented. That is the same bar the crawler holds itself
// to, and it is the only bar that matters here — a token nobody verified is how a
// registry starts inventing companies.
//
// Tokens rot. Re-verify with `npx tsx scripts/ats-smoke.ts` before adding to this
// list, and drop an entry that stops resolving rather than leaving it to fail
// quietly in every user's feed.

/**
 * The board sources a starter entry may name. Declared here rather than imported
 * from the crawler's types: this file ships to the browser, and the netlify/ tree
 * must not be pulled into the client bundle. The registry test cross-checks these
 * names against the real provider registry, so the two cannot drift.
 */
export type StarterSource = 'greenhouse' | 'ashby' | 'workable' | 'lever' | 'pinpoint';

export interface StarterCompany {
  /** Shown to the user. */
  displayName: string;
  /** Arabic name, shown when the UI is in Arabic. */
  displayNameAr: string;
  source: StarterSource;
  token: string;
  /** Open roles seen at verification time — indicative only, never displayed as current. */
  rolesAtVerification: number;
}

/** When every entry below was last read from its live board. */
export const STARTERS_VERIFIED_AT = '2026-08-31';

/**
 * Ordered by how much this market's job seekers are likely to want them, with the
 * boards carrying open Saudi roles first.
 *
 * The seven entries with zero open roles are deliberately kept. They are real,
 * verified accounts that happen to be empty today, and one cheap call a day means
 * a role surfaces the moment it lands. Dropping them would mean a user who follows
 * Jahez sees nothing and assumes the feature is broken, rather than seeing a
 * company being watched.
 *
 * What they must NOT do is sit in the same row as the six that are hiring, under
 * a label promising boards to follow. Presented identically, seven of the
 * thirteen chips lead to a wait and then nothing, and the user cannot tell that
 * from a broken feature — the same conflation `checkFailed` and `neverChecked`
 * exist to prevent, one level up. `partitionStarters` is what keeps them apart.
 */
export const SAUDI_STARTER_COMPANIES: readonly StarterCompany[] = [
  { displayName: 'Tamara', displayNameAr: 'تمارا', source: 'greenhouse', token: 'tamara', rolesAtVerification: 36 },
  { displayName: 'Tabby', displayNameAr: 'تابي', source: 'pinpoint', token: 'tabby', rolesAtVerification: 33 },
  { displayName: 'Salla', displayNameAr: 'سلة', source: 'workable', token: 'salla', rolesAtVerification: 27 },
  { displayName: 'Careem', displayNameAr: 'كريم', source: 'greenhouse', token: 'careem', rolesAtVerification: 20 },
  { displayName: 'HALA', displayNameAr: 'هلا', source: 'greenhouse', token: 'hala', rolesAtVerification: 16 },
  { displayName: 'Lean Technologies', displayNameAr: 'لين', source: 'ashby', token: 'LeanTech', rolesAtVerification: 4 },
  { displayName: 'Mozn', displayNameAr: 'مزن', source: 'workable', token: 'mozn', rolesAtVerification: 0 },
  { displayName: 'Unifonic', displayNameAr: 'يونيفونك', source: 'workable', token: 'unifonic', rolesAtVerification: 0 },
  { displayName: 'Jahez', displayNameAr: 'جاهز', source: 'workable', token: 'jahez', rolesAtVerification: 0 },
  { displayName: 'Zid', displayNameAr: 'زد', source: 'workable', token: 'zid', rolesAtVerification: 0 },
  { displayName: 'Nana', displayNameAr: 'نعناع', source: 'workable', token: 'nana', rolesAtVerification: 0 },
  { displayName: 'Rasan', displayNameAr: 'رسن', source: 'workable', token: 'rasan', rolesAtVerification: 0 },
  { displayName: 'Sary', displayNameAr: 'ساري', source: 'workable', token: 'sary', rolesAtVerification: 0 },
] as const;

/**
 * Split starters by whether their board held anything when we last read it.
 *
 * `hiring` is a claim about the past, not the present — the count came from one
 * fetch on `STARTERS_VERIFIED_AT` and the view must say so rather than printing
 * it as a live number.
 */
export function partitionStarters(companies: readonly StarterCompany[]): {
  hiring: readonly StarterCompany[];
  quiet: readonly StarterCompany[];
} {
  return {
    hiring: companies.filter((company) => company.rolesAtVerification > 0),
    quiet: companies.filter((company) => company.rolesAtVerification === 0),
  };
}

/** The starter companies a user is not already following. */
export function unfollowedStarters(
  followedTokens: Iterable<string>,
): readonly StarterCompany[] {
  const followed = new Set([...followedTokens].map((token) => token.toLowerCase()));
  return SAUDI_STARTER_COMPANIES.filter((company) => !followed.has(company.token.toLowerCase()));
}
