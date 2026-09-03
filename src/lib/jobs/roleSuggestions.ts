// Target roles the CV already implies.
//
// The feed cannot rank anything without a target role, and asking someone to type
// one they have already written at the top of their CV is asking them to repeat
// themselves. These are suggestions only — nothing here writes intent on its own,
// because silently deciding what the feed filters on is drift the user cannot see.

import { deriveRoleTerms } from './filters';
import type { ResumeSchema } from '@/types/resume';

/** How many chips a row can carry before it stops reading as a shortlist. */
const DEFAULT_LIMIT = 4;

export interface RoleSuggestionOptions {
  limit?: number;
  /** Roles the feed already filters on. A chip that changes nothing looks broken. */
  exclude?: readonly string[];
}

/** Two titles with the same key filter the feed identically. */
function roleKey(title: string): string {
  return [...deriveRoleTerms([title])].sort().join('|');
}

/**
 * Role titles from the parsed CV, headline first, then the work entries in the
 * order the CV lists them.
 *
 * Deterministic on purpose: no model runs in the feed, and `basics.label` and
 * `work[].position` are already role titles — an AI call would spend a request to
 * retype them.
 *
 * Two titles that derive the same terms are the same chip twice ("Senior AI
 * Engineer" and "AI Engineer" filter the feed identically, since a level is not a
 * function), so only the first is kept. A title that derives no terms at all is
 * dropped rather than offered: it would match every posting on every board.
 */
export function suggestRolesFromResume(
  resume: ResumeSchema | null | undefined,
  options: RoleSuggestionOptions = {},
): string[] {
  if (!resume) return [];

  const { limit = DEFAULT_LIMIT, exclude = [] } = options;

  const candidates = [
    resume.basics?.label ?? '',
    ...(resume.work ?? []).map((entry) => entry?.position ?? ''),
  ];

  const seen = new Set(exclude.map(roleKey));
  const roles: string[] = [];

  for (const candidate of candidates) {
    const title = candidate.trim();
    if (!title) continue;

    if (deriveRoleTerms([title]).length === 0) continue;

    const key = roleKey(title);
    if (seen.has(key)) continue;

    seen.add(key);
    roles.push(title);
    if (roles.length >= limit) break;
  }

  return roles;
}
