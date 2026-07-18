// src/lib/optimize/mergeResume.ts
// Pure content-based merge of applied optimization cards into a ResumeSchema,
// extracted from resumeStore.getActiveResume so the same walk can serve three
// callers with one definition:
//   - getActiveResume (the live merged view),
//   - applyOptimization's dry-run validation (canMergeOptimization), and
//   - verification's hypothetical all-actionable simulation.
// No store access, no mutation of inputs; the merge clones the base resume.
import type { ResumeSchema } from '@/types/resume';
import type { MergeDiagnostics, OptimizationResult } from '@/types/templates';
import { fuzzyTextMatch } from '@/lib/utils/textMatcher';
import { isRecommendationOnly } from '@/lib/optimize/actionability';

/** Coerce card values (string | string[]) into the merge/replace string. */
export const optimizationTextValue = (val: unknown): string => {
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.join(' ');
  return String(val || '');
};

/** Where a card's original text lives inside a resume. */
export type MergeTarget =
  | { kind: 'basics.summary' }
  | { kind: 'basics.label' }
  | { kind: 'work.highlight'; workIdx: number; hlIdx: number }
  | { kind: 'work.summary'; workIdx: number }
  | { kind: 'education.area'; eduIdx: number }
  | { kind: 'education.highlight'; eduIdx: number; hlIdx: number }
  | { kind: 'project.name'; projIdx: number }
  | { kind: 'project.description'; projIdx: number }
  | { kind: 'project.highlight'; projIdx: number; hlIdx: number };

/**
 * Locate the merge target for one card without mutating anything — the same
 * fuzzyTextMatch walk the merge performs, expressed as a lookup. Returns null when
 * the card cannot land anywhere: no match, empty optimized text, or a
 * recommendation-only card (skills/certifications), which is never content-merged —
 * in particular an existing certificate name is never rewritten into a
 * recommendation.
 */
export function findMergeTarget(opt: OptimizationResult, resume: ResumeSchema): MergeTarget | null {
  if (isRecommendationOnly(opt)) return null;

  const optimizedValue = optimizationTextValue(opt.optimized);
  const originalValue = optimizationTextValue(opt.original);
  if (!optimizedValue) return null;

  switch (opt.sectionType) {
    case 'summary':
      return resume.basics ? { kind: 'basics.summary' } : null;

    case 'headline':
      return resume.basics ? { kind: 'basics.label' } : null;

    case 'experience': {
      const work = resume.work ?? [];
      for (let workIdx = 0; workIdx < work.length; workIdx++) {
        const highlights = work[workIdx].highlights || [];
        for (let hlIdx = 0; hlIdx < highlights.length; hlIdx++) {
          if (fuzzyTextMatch(originalValue, highlights[hlIdx]).matched) {
            return { kind: 'work.highlight', workIdx, hlIdx };
          }
        }
        if (work[workIdx].summary && fuzzyTextMatch(originalValue, work[workIdx].summary!).matched) {
          return { kind: 'work.summary', workIdx };
        }
      }
      return null;
    }

    case 'education': {
      const education = resume.education ?? [];
      for (let eduIdx = 0; eduIdx < education.length; eduIdx++) {
        const entry = education[eduIdx];
        if (entry.area && fuzzyTextMatch(originalValue, entry.area).matched) {
          return { kind: 'education.area', eduIdx };
        }
        const highlights = entry.highlights || [];
        for (let hlIdx = 0; hlIdx < highlights.length; hlIdx++) {
          if (fuzzyTextMatch(originalValue, highlights[hlIdx]).matched) {
            return { kind: 'education.highlight', eduIdx, hlIdx };
          }
        }
      }
      return null;
    }

    case 'projects': {
      const projects = resume.projects ?? [];
      for (let projIdx = 0; projIdx < projects.length; projIdx++) {
        const entry = projects[projIdx];
        if (entry.name && fuzzyTextMatch(originalValue, entry.name).matched) {
          return { kind: 'project.name', projIdx };
        }
        if (entry.description && fuzzyTextMatch(originalValue, entry.description).matched) {
          return { kind: 'project.description', projIdx };
        }
        const highlights = entry.highlights || [];
        for (let hlIdx = 0; hlIdx < highlights.length; hlIdx++) {
          if (fuzzyTextMatch(originalValue, highlights[hlIdx]).matched) {
            return { kind: 'project.highlight', projIdx, hlIdx };
          }
        }
      }
      return null;
    }

    default:
      return null;
  }
}

/** Dry-run: would applying this card change the given resume? */
export function canMergeOptimization(opt: OptimizationResult, resume: ResumeSchema): boolean {
  return findMergeTarget(opt, resume) !== null;
}

/** Write one located target. Mutates `resume` (callers pass their own clone). */
function writeMergeTarget(resume: ResumeSchema, target: MergeTarget, optimizedValue: string): void {
  switch (target.kind) {
    case 'basics.summary':
      resume.basics!.summary = optimizedValue;
      break;
    case 'basics.label':
      resume.basics!.label = optimizedValue;
      break;
    case 'work.highlight':
      resume.work![target.workIdx].highlights![target.hlIdx] = optimizedValue;
      break;
    case 'work.summary':
      resume.work![target.workIdx].summary = optimizedValue;
      break;
    case 'education.area':
      resume.education![target.eduIdx].area = optimizedValue;
      break;
    case 'education.highlight':
      resume.education![target.eduIdx].highlights![target.hlIdx] = optimizedValue;
      break;
    case 'project.name':
      resume.projects![target.projIdx].name = optimizedValue;
      break;
    case 'project.description':
      resume.projects![target.projIdx].description = optimizedValue;
      break;
    case 'project.highlight':
      resume.projects![target.projIdx].highlights![target.hlIdx] = optimizedValue;
      break;
  }
}

export interface MergeOptions {
  /** Prepend "Saudi" to the summary for Saudization ATS when not already present. */
  isSaudiNational: boolean;
}

export interface MergeResult {
  resume: ResumeSchema;
  diagnostics: MergeDiagnostics;
}

/**
 * Clone `original` and apply every applied ACTIONABLE card via content-based
 * matching. Matching runs against the progressively-merged clone (first-match-wins
 * across sequential cards), preserving the store's historical behavior exactly.
 *
 * Recommendation-only cards (skills/certifications) never participate: skills are
 * never auto-injected (that would be misleading to employers) and existing
 * certificates are never rewritten into recommendations. They contribute nothing to
 * the merged resume, its diagnostics, or any applied count.
 */
export function mergeOptimizedResume(
  original: ResumeSchema,
  optimizations: readonly OptimizationResult[],
  options: MergeOptions,
): MergeResult {
  const merged = structuredClone(original) as ResumeSchema;

  const diagnostics: MergeDiagnostics = {
    appliedCount: 0,
    failedCount: 0,
    failedMatches: [],
  };

  const recordFailure = (opt: OptimizationResult, originalValue: string) => {
    diagnostics.failedCount++;
    diagnostics.failedMatches.push({
      sectionType: opt.sectionType,
      sectionId: opt.sectionId,
      originalPreview: originalValue.substring(0, 60),
    });
    if (import.meta.env.DEV) {
      console.warn(`[MergeResume] ⚠️ Match failed for ${opt.sectionType}`, {
        originalPreview: originalValue.substring(0, 60),
        sectionId: opt.sectionId,
      });
    }
  };

  for (const opt of optimizations) {
    if (!opt.applied || isRecommendationOnly(opt)) continue;

    const optimizedValue = optimizationTextValue(opt.optimized);
    const originalValue = optimizationTextValue(opt.original);
    if (!optimizedValue) continue;

    const target = findMergeTarget(opt, merged);
    if (target) {
      writeMergeTarget(merged, target, optimizedValue);
      diagnostics.appliedCount++;
    } else if (opt.sectionType === 'summary' || opt.sectionType === 'headline') {
      // basics missing — historical behavior was a silent skip (no failure record).
    } else {
      recordFailure(opt, originalValue);
    }
  }

  if (diagnostics.failedCount > 0 && import.meta.env.DEV) {
    console.warn('[MergeResume] Merge diagnostics:', diagnostics);
  }

  // Saudi nationality: prepend "Saudi" to summary for Saudization ATS
  if (options.isSaudiNational && merged.basics?.summary) {
    if (!merged.basics.summary.toLowerCase().startsWith('saudi')) {
      merged.basics.summary = `Saudi ${merged.basics.summary}`;
    }
  }

  return { resume: merged, diagnostics };
}
