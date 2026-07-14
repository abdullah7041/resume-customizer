import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PartialResumeSchema, ResumeSchema } from '../../types/resume';
import type { AiSuggestionEntry } from '../../types/analysis';
import type { SearchIntent } from '../../types/onboarding';
import type {
  ResumeState,
  OptimizationResult,
  KeywordSuggestion,
  TemplateId,
  CachedAnalysis,
  MergeDiagnostics,
  JobVariant,
  JobVariantSnapshot,
} from '../../types/templates';
import {
  validateResume,
  validateParsedText,
  validateOptimization,
  validateSearchIntent,
} from '../validation/store-schemas';
import { deduplicateByName } from '../utils/resumeUtils';
import { fuzzyTextMatch } from '../utils/textMatcher';

/** Minimal valid resume skeleton — basics required fields as empty strings. */
const emptyResume = (): ResumeSchema => ({
  basics: { name: '', label: '', email: '', phone: '', summary: '', location: { city: '', countryCode: '', region: '' }, profiles: [] },
  work: [],
  education: [],
  skills: [],
  projects: [],
});

/**
 * Fuzzy-merge an onboarding patch into a resume. basics fields prefer non-empty
 * patch values; array sections are appended then de-duplicated by name (work,
 * projects) so re-running a slot never creates duplicates. The single onboarding
 * writer (patchProfile) is the only caller.
 */
const mergeProfilePatch = (base: ResumeSchema, patch: PartialResumeSchema): ResumeSchema => {
  const merged: ResumeSchema = structuredClone(base);

  if (patch.basics) {
    merged.basics = { ...merged.basics };
    for (const [key, value] of Object.entries(patch.basics)) {
      if (value === undefined || value === null) continue;
      if (typeof value === 'string' && value.trim() === '') continue;
      // location is an object — shallow-merge so a partial location patch keeps existing fields.
      if (key === 'location' && typeof value === 'object') {
        merged.basics.location = { ...merged.basics.location, ...(value as object) };
        continue;
      }
      (merged.basics as unknown as Record<string, unknown>)[key] = value;
    }
  }

  if (patch.work?.length) {
    merged.work = deduplicateByName([...(merged.work ?? []), ...patch.work]);
  }
  if (patch.projects?.length) {
    merged.projects = deduplicateByName([...(merged.projects ?? []), ...patch.projects]);
  }
  if (patch.skills?.length) {
    merged.skills = [...(merged.skills ?? []), ...patch.skills];
  }
  if (patch.education?.length) {
    merged.education = [...(merged.education ?? []), ...patch.education];
  }

  return merged;
};

/**
 * 0-100 profile completeness across resume + searchIntent. Pure so the selector and
 * setSearchIntent share one definition. Foundation for the item-2 "add one more
 * thing" nudge.
 */
const computeCompleteness = (resume: ResumeSchema | null, intent: SearchIntent | null): number => {
  let score = 0;
  if (resume?.basics?.name?.trim()) score += 20;
  if (resume?.basics?.label?.trim()) score += 15;
  if ((resume?.work?.length ?? 0) > 0 || (resume?.projects?.length ?? 0) > 0) score += 25;
  if ((intent?.targetRoles?.length ?? 0) > 0) score += 20;
  if (intent?.location) score += 20;
  return Math.min(100, score);
};

// Cache validity duration: 30 minutes
// Users re-analyzing the same resume+JD pair within this window hit cache instead of burning credits
const CACHE_TTL_MS = 30 * 60 * 1000;

// Memoization cache for cache key generation (performance optimization)
const cacheKeyMemo = new Map<string, string>();

/**
 * Generate a cache key from resume and job description
 * Uses FNV-1a hash with memoization for performance
 * CRITICAL: Now includes isOptimized flag to prevent cache collisions
 */
const generateCacheKey = (resumeText: string, jobDescription: string, isOptimized: boolean = false): string => {
  // Use FULL text for hash to prevent collisions between original/optimized versions
  // Include isOptimized flag to separate cache entries
  const fullKey = `${resumeText || ''}|${jobDescription || ''}|${isOptimized ? 'opt' : 'orig'}`;

  // Check memo cache first (key now includes optimization flag)
  const memoKey = `${fullKey.slice(0, 100)}|${fullKey.length}|${isOptimized}`;
  const cached = cacheKeyMemo.get(memoKey);
  if (cached) return cached;

  // FNV-1a hash - faster than djb2 and works with Arabic
  let hash = 2166136261;
  for (let i = 0; i < fullKey.length; i++) {
    hash ^= fullKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const result = `match-${(hash >>> 0).toString(36)}`;

  // Memoize result (limit size to prevent memory leak)
  cacheKeyMemo.set(memoKey, result);
  if (cacheKeyMemo.size > 100) {
    const firstKey = cacheKeyMemo.keys().next().value;
    if (firstKey) cacheKeyMemo.delete(firstKey);
  }

  return result;
};

// --- Job variant helpers (module-level, pure) -----------------------------
// JD stored truncated for retention hygiene (ADR §5); variants are local-only.
const JOB_DESCRIPTION_MAX_CHARS = 8000;

const truncateJobDescription = (jd: string): string => {
  if (typeof jd !== 'string') return '';
  return jd.length > JOB_DESCRIPTION_MAX_CHARS ? jd.slice(0, JOB_DESCRIPTION_MAX_CHARS) : jd;
};

const generateVariantId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `variant-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Deep-copy the current working optimization set. structuredClone decouples the
 * snapshot from later apply/revert on the live cards — the base resume is never
 * touched (variants only carry cards + view state).
 */
const snapshotWorkingSet = (state: ResumeState): JobVariantSnapshot => ({
  optimizations: structuredClone(state.optimizations),
  keywordSuggestions: structuredClone(state.keywordSuggestions),
  optimizationMetrics: structuredClone(state.optimizationMetrics),
  baselineMatchScore: state.baselineMatchScore,
  selectedTemplate: state.selectedTemplate,
});

/**
 * Resume store with optimization merge logic
 * Handles original/optimized toggle and template selection
 */
export const useResumeStore = create<ResumeState>()(
  persist(
    (set, get) => ({
      // Initial state
      originalResume: null,
      parsedResumeText: null,
      optimizations: [],
      keywordSuggestions: [],
      analysisCache: {},
      optimizationMetrics: {
        beforeScore: null,
        afterScore: null,
        improvement: null,
        jdKeywords: [],
        matchedKeywords: [],
        reasoning: null,
        hasJobDescription: false,
        vision2030: null,
        gapAnalysis: [], // null = not loaded yet, [] = AI returned no gaps
        keywordStrategy: {
          mirroredPhrases: [],
          structuralChanges: [],
          hiddenMatches: []
        },
        scoreBreakdown: null,
      },
      baselineMatchScore: null, // Original resume's match score (before any optimizations)
      isSaudiNational: false, // Saudi nationality flag for Saudization ATS
      searchIntent: null, // Onboarding job-search intent (target role / comp / location)
      jobVariants: [], // Job-specific resume variants (Phase 1, local-only)
      activeVariantId: null,
      variantRestoreNonce: 0, // Ephemeral open-variant signal (not persisted)
      showOptimized: false, // Start with original
      selectedTemplate: 'modern-professional',
      displayOptions: {
        fontSize: 1, // Legacy 100% scale
        baseFontSize: 10.5,   // pt
        headingSize: 13,      // pt
        nameSize: 20,         // pt
        fontFamily: 'Georgia, serif',
        sectionSpacing: 8,    // px
        paragraphSpacing: 6,  // px
        lineHeight: 1.55,
        marginTop: 0.5,       // inches
        marginBottom: 0.5,    // inches
        marginSide: 0.6,      // inches
        showPageBreaks: false, // Page break indicators off by default
        boldKeywords: true,    // Bold important keywords in DOCX exports (default: enabled)
      },
      hasDownloaded: false,
      contentLanguage: null, // Detected from resume text

      // Actions
      setOriginalResume: (resume: ResumeSchema) => {
        // Zod validation at store boundary
        const validation = validateResume(resume);
        if (!validation.success) {
          if (import.meta.env.DEV) console.warn('[ResumeStore] ⚠️ Resume validation issues:', validation.error);
          // Still allow storage but log the issues for debugging
        }

        // Use validated data if available, otherwise fallback to original
        const validatedResume = (validation.data ?? resume) as ResumeSchema;

        // Deduplicate arrays to prevent duplicate entries
        if (validatedResume.projects) {
          validatedResume.projects = deduplicateByName(validatedResume.projects);
        }
        if (validatedResume.work) {
          validatedResume.work = deduplicateByName(validatedResume.work);
        }

        set({
          originalResume: validatedResume,
          hasDownloaded: false // Reset download status on content change
        });
      },

      setParsedResumeText: (text: unknown) => {
        // Zod validation at store boundary with automatic object extraction
        const validation = validateParsedText(text);

        if (!validation.success) {
          console.error('[ResumeStore] ❌ Parsed text validation failed:', validation.error);
          console.error('[ResumeStore] Received type:', typeof text, 'preview:', String(text).substring(0, 100));
          return; // Don't store invalid data
        }

        const resolvedText = validation.data!;
        const length = resolvedText.length;

        // Warn if text seems too short
        if (length > 0 && length < 100) {
          if (import.meta.env.DEV) console.warn('[ResumeStore] ⚠️ WARNING: Parsed text is very short! This may indicate a PDF extraction issue.');
        }

        set({
          parsedResumeText: resolvedText,
          hasDownloaded: false
        });
      },


      addOptimization: (optimization: Omit<OptimizationResult, 'timestamp'>) => {
        const fullOptimization: OptimizationResult = {
          ...optimization,
          timestamp: new Date().toISOString(),
        };

        // Zod validation at store boundary
        const validation = validateOptimization(fullOptimization);
        if (!validation.success) {
          if (import.meta.env.DEV) console.warn('[ResumeStore] ⚠️ Optimization validation issues:', validation.error);
          // Still allow storage but log the issues
        }

        set((state) => ({
          optimizations: [
            // Remove existing optimization for same section
            ...state.optimizations.filter(
              (o) => o.sectionId !== optimization.sectionId
            ),
            fullOptimization,
          ],
          hasDownloaded: false
        }));
      },


      setOptimizations: (optimizations: OptimizationResult[]) => {
        set({
          optimizations,
          hasDownloaded: false
        });
      },

      applyOptimization: (sectionId: string) => {
        set((state) => ({
          optimizations: state.optimizations.map((o) =>
            o.sectionId === sectionId ? { ...o, applied: true } : o
          ),
          hasDownloaded: false
        }));
      },

      revertOptimization: (sectionId: string) => {
        set((state) => ({
          optimizations: state.optimizations.map((o) =>
            o.sectionId === sectionId ? { ...o, applied: false } : o
          ),
          hasDownloaded: false
        }));
      },

      // Single-bullet correction loop. Replaces only `optimized` (+ rationale/issue)
      // for one card and keeps `original`/`applied` intact, so getActiveResume's
      // content-based merge picks up the refined text automatically — even when the
      // bullet is already applied. Records only metadata on meta.ai_suggestions
      // to preserve schema integrity without persisting raw instructions or AI text.
      refineOptimization: (sectionId, refinement) => {
        set((state) => {
          const optimizations = state.optimizations.map((o) =>
            o.sectionId === sectionId
              ? {
                ...o,
                optimized: refinement.improved,
                rationale: refinement.rationale,
                issue: refinement.issue,
              }
              : o
          );

          let originalResume = state.originalResume;
          if (originalResume) {
            const entry: AiSuggestionEntry = {
              type: 'refine_bullet',
              sectionId,
              timestamp: new Date().toISOString(),
            };
            const existingMeta = originalResume.meta ?? {};
            originalResume = {
              ...originalResume,
              meta: {
                ...existingMeta,
                ai_suggestions: [...(existingMeta.ai_suggestions ?? []), entry],
              },
            };
          }

          return { optimizations, originalResume, hasDownloaded: false };
        });
      },

      applyAllOptimizations: () => {
        set((state) => ({
          optimizations: state.optimizations.map((o) => ({
            ...o,
            applied: true,
          })),
          showOptimized: true,
          hasDownloaded: false
        }));
      },

      revertAllOptimizations: () => {
        set((state) => ({
          optimizations: state.optimizations.map((o) => ({
            ...o,
            applied: false,
          })),
          showOptimized: false,
          hasDownloaded: false
        }));
      },

      toggleShowOptimized: () => {
        const current = get().showOptimized;
        set({
          showOptimized: !current,
          hasDownloaded: false
        });
      },

      setShowOptimized: (show: boolean) => {
        set({
          showOptimized: show,
          hasDownloaded: false
        });
      },

      setSelectedTemplate: (templateId: TemplateId) => {
        set({
          selectedTemplate: templateId,
          hasDownloaded: false
        });
      },

      setHasDownloaded: (value: boolean) => {
        set({ hasDownloaded: value });
      },

      setKeywordSuggestions: (suggestions: KeywordSuggestion[]) => {
        set({ keywordSuggestions: suggestions });
      },

      getActiveResume: (): ResumeSchema | null => {
        const state = get();
        if (!state.originalResume) {
          return null;
        }

        // If not showing optimized, return original (with Saudi prepend if applicable)
        if (!state.showOptimized) {
          if (state.isSaudiNational && state.originalResume.basics?.summary) {
            if (!state.originalResume.basics.summary.toLowerCase().startsWith('saudi')) {
              const cloned = structuredClone(state.originalResume) as ResumeSchema;
              cloned.basics!.summary = `Saudi ${cloned.basics!.summary}`;
              return cloned;
            }
          }
          return state.originalResume;
        }

        // Deep clone to avoid mutating original - use structuredClone (2-3x faster than JSON)
        const merged = structuredClone(state.originalResume) as ResumeSchema;

        // Type-safe value extraction helpers
        const getStringValue = (val: unknown): string => {
          if (typeof val === 'string') return val;
          if (Array.isArray(val)) return val.join(' ');
          return String(val || '');
        };

        // Track merge diagnostics for debugging
        const diagnostics: MergeDiagnostics = {
          appliedCount: 0,
          failedCount: 0,
          failedMatches: [],
        };

        // Apply each optimization using CONTENT-BASED MATCHING
        for (const opt of state.optimizations) {
          if (!opt.applied) continue;

          const optimizedValue = getStringValue(opt.optimized);
          const originalValue = getStringValue(opt.original);

          if (!optimizedValue) continue;

          switch (opt.sectionType) {
            case 'summary':
              if (merged.basics) {
                merged.basics.summary = optimizedValue;
                diagnostics.appliedCount++;
              }
              break;

            case 'headline':
              if (merged.basics) {
                merged.basics.label = optimizedValue;
                diagnostics.appliedCount++;
              }
              break;

            case 'experience': {
              // CONTENT-BASED MATCHING: Search ALL work entries for the original text
              let found = false;

              if (merged.work) {
                for (let workIdx = 0; workIdx < merged.work.length; workIdx++) {
                  const workEntry = merged.work[workIdx];
                  const highlights = workEntry.highlights || [];

                  // Search each highlight for the original text
                  for (let hlIdx = 0; hlIdx < highlights.length; hlIdx++) {
                    const matchResult = fuzzyTextMatch(originalValue, highlights[hlIdx]);
                    if (matchResult.matched) {
                      // Found a match - replace this highlight
                      merged.work[workIdx].highlights![hlIdx] = optimizedValue;
                      found = true;
                      diagnostics.appliedCount++;
                      break; // Move to next optimization
                    }
                  }

                  // Also check summary field
                  if (!found && workEntry.summary) {
                    const matchResult = fuzzyTextMatch(originalValue, workEntry.summary);
                    if (matchResult.matched) {
                      merged.work[workIdx].summary = optimizedValue;
                      found = true;
                      diagnostics.appliedCount++;
                    }
                  }

                  if (found) break;
                }
              }

              if (!found) {
                diagnostics.failedCount++;
                diagnostics.failedMatches.push({
                  sectionType: opt.sectionType,
                  sectionId: opt.sectionId,
                  originalPreview: originalValue.substring(0, 60),
                });
                if (import.meta.env.DEV) console.warn(`[ResumeStore] ⚠️ Match failed for ${opt.sectionType}`, {
                  originalPreview: originalValue.substring(0, 60),
                  sectionId: opt.sectionId,
                });
              }
              break;
            }

            case 'education': {
              // CONTENT-BASED MATCHING for education
              let found = false;

              if (merged.education) {
                for (let eduIdx = 0; eduIdx < merged.education.length; eduIdx++) {
                  const eduEntry = merged.education[eduIdx];

                  // Check area, studyType, and highlights
                  if (eduEntry.area) {
                    const matchResult = fuzzyTextMatch(originalValue, eduEntry.area);
                    if (matchResult.matched) {
                      merged.education[eduIdx].area = optimizedValue;
                      found = true;
                      diagnostics.appliedCount++;
                      break;
                    }
                  }

                  // Check highlights array if present
                  const highlights = eduEntry.highlights || [];
                  for (let hlIdx = 0; hlIdx < highlights.length; hlIdx++) {
                    const matchResult = fuzzyTextMatch(originalValue, highlights[hlIdx]);
                    if (matchResult.matched) {
                      merged.education[eduIdx].highlights![hlIdx] = optimizedValue;
                      found = true;
                      diagnostics.appliedCount++;
                      break;
                    }
                  }

                  if (found) break;
                }
              }

              if (!found) {
                diagnostics.failedCount++;
                diagnostics.failedMatches.push({
                  sectionType: opt.sectionType,
                  sectionId: opt.sectionId,
                  originalPreview: originalValue.substring(0, 60),
                });
                if (import.meta.env.DEV) console.warn(`[ResumeStore] ⚠️ Match failed for ${opt.sectionType}`, {
                  originalPreview: originalValue.substring(0, 60),
                  sectionId: opt.sectionId,
                });
              }
              break;
            }

            case 'projects': {
              // CONTENT-BASED MATCHING for projects
              let found = false;

              if (merged.projects) {
                for (let projIdx = 0; projIdx < merged.projects.length; projIdx++) {
                  const projEntry = merged.projects[projIdx];

                  // Check name and description
                  if (projEntry.name) {
                    const matchResult = fuzzyTextMatch(originalValue, projEntry.name);
                    if (matchResult.matched) {
                      merged.projects[projIdx].name = optimizedValue;
                      found = true;
                      diagnostics.appliedCount++;
                      break;
                    }
                  }

                  if (projEntry.description) {
                    const matchResult = fuzzyTextMatch(originalValue, projEntry.description);
                    if (matchResult.matched) {
                      merged.projects[projIdx].description = optimizedValue;
                      found = true;
                      diagnostics.appliedCount++;
                      break;
                    }
                  }

                  // Check highlights
                  const highlights = projEntry.highlights || [];
                  for (let hlIdx = 0; hlIdx < highlights.length; hlIdx++) {
                    const matchResult = fuzzyTextMatch(originalValue, highlights[hlIdx]);
                    if (matchResult.matched) {
                      merged.projects[projIdx].highlights![hlIdx] = optimizedValue;
                      found = true;
                      diagnostics.appliedCount++;
                      break;
                    }
                  }

                  if (found) break;
                }
              }

              if (!found) {
                diagnostics.failedCount++;
                diagnostics.failedMatches.push({
                  sectionType: opt.sectionType,
                  sectionId: opt.sectionId,
                  originalPreview: originalValue.substring(0, 60),
                });
                if (import.meta.env.DEV) console.warn(`[ResumeStore] ⚠️ Match failed for ${opt.sectionType}`, {
                  originalPreview: originalValue.substring(0, 60),
                  sectionId: opt.sectionId,
                });
              }
              break;
            }

            case 'skills': {
              // IMPORTANT: We do NOT auto-inject skills the user doesn't have
              // This would be misleading to employers
              // Instead, we just log that these are recommended skills to consider

              const optimizedValue = opt.optimized;
              let suggestedSkills: string[] = [];

              if (typeof optimizedValue === 'string') {
                let cleanedValue = optimizedValue;
                if (cleanedValue.toLowerCase().startsWith('add:')) {
                  cleanedValue = cleanedValue.substring(4).trim();
                }
                if (cleanedValue.toLowerCase().startsWith('current:')) {
                  // This is the "before" value, skip
                  break;
                }
                suggestedSkills = cleanedValue.split(',').map(s => s.trim()).filter(Boolean);
              } else if (Array.isArray(optimizedValue)) {
                suggestedSkills = optimizedValue.flatMap(s => {
                  const skill = typeof s === 'string' ? s.trim() : String(s);
                  return skill ? [skill] : [];
                });
              }

              // Log the suggestions but DO NOT add to resume
              // The user should manually add skills they actually have
              // (suggestedSkills contains the recommended skills)
              void suggestedSkills; // Acknowledge variable is intentionally unused

              // Mark as "applied" for tracking but don't modify resume
              diagnostics.appliedCount++;
              break;
            }

            case 'certifications': {
              // Handle certification optimizations similarly
              let found = false;

              if (merged.certificates) {
                for (let certIdx = 0; certIdx < merged.certificates.length; certIdx++) {
                  const cert = merged.certificates[certIdx];
                  if (cert.name) {
                    const matchResult = fuzzyTextMatch(originalValue, cert.name);
                    if (matchResult.matched) {
                      merged.certificates[certIdx].name = optimizedValue;
                      found = true;
                      diagnostics.appliedCount++;
                      break;
                    }
                  }
                }
              }

              if (!found) {
                diagnostics.failedCount++;
                diagnostics.failedMatches.push({
                  sectionType: opt.sectionType,
                  sectionId: opt.sectionId,
                  originalPreview: originalValue.substring(0, 60),
                });
                if (import.meta.env.DEV) console.warn(`[ResumeStore] ⚠️ Match failed for ${opt.sectionType}`, {
                  originalPreview: originalValue.substring(0, 60),
                  optimizedPreview: optimizedValue.substring(0, 60),
                  sectionId: opt.sectionId,
                  availableCerts: merged.certificates?.map(c => c.name) || []
                });
              }
              break;
            }

            default:
              if (import.meta.env.DEV) console.warn(`[ResumeStore] Unknown sectionType: ${opt.sectionType}`);
          }
        }

        // Log merge diagnostics for debugging
        if (diagnostics.failedCount > 0) {
          if (import.meta.env.DEV) console.warn('[ResumeStore] Merge diagnostics:', diagnostics);
        }

        // Saudi nationality: prepend "Saudi" to summary for Saudization ATS
        if (state.isSaudiNational && merged.basics?.summary) {
          if (!merged.basics.summary.toLowerCase().startsWith('saudi')) {
            merged.basics.summary = `Saudi ${merged.basics.summary}`;
          }
        }

        return merged;
      },

      // Analysis caching methods
      getCachedAnalysis: (resumeText: string, jobDescription: string, forceIsOptimized?: boolean): CachedAnalysis | null => {
        const state = get();
        // Allow explicit override of isOptimized flag for specific lookups
        // This is needed when OptimizeSection wants the original score regardless of current showOptimized state
        const isOptimized = forceIsOptimized !== undefined ? forceIsOptimized : state.showOptimized;
        const cacheKey = generateCacheKey(resumeText, jobDescription, isOptimized);
        const cached = state.analysisCache[cacheKey];

        if (!cached) {
          return null;
        }

        // Check if cache is still valid
        const age = Date.now() - cached.timestamp;
        if (age > CACHE_TTL_MS) {
          return null;
        }

        return cached;
      },

      setCachedAnalysis: (resumeText: string, jobDescription: string, analysis: Omit<CachedAnalysis, 'timestamp'>, forceIsOptimized?: boolean) => {
        const state = get();
        // Fix B2: Allow explicit override of isOptimized flag, matching getCachedAnalysis
        const isOptimized = forceIsOptimized !== undefined ? forceIsOptimized : state.showOptimized;
        const cacheKey = generateCacheKey(resumeText, jobDescription, isOptimized);

        set((state) => {
          const newCache = {
            ...state.analysisCache,
            [cacheKey]: {
              ...analysis,
              timestamp: Date.now(),
            },
          };

          // Evict oldest entries if cache exceeds 10 entries
          const MAX_CACHE_SIZE = 10;
          const cacheEntries = Object.entries(newCache);
          if (cacheEntries.length > MAX_CACHE_SIZE) {
            // Sort by timestamp (oldest first) and keep only newest MAX_CACHE_SIZE
            const sortedEntries = cacheEntries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            const keepEntries = sortedEntries.slice(-MAX_CACHE_SIZE);
            return {
              analysisCache: Object.fromEntries(keepEntries),
            };
          }

          return { analysisCache: newCache };
        });
      },

      clearAnalysisCache: () => {
        set({ analysisCache: {} });
      },

      // Optimization metrics actions
      setOptimizationMetrics: (metrics) =>
        set((state) => ({
          optimizationMetrics: { ...state.optimizationMetrics, ...metrics }
        })),

      resetOptimizationMetrics: () => set({
        optimizationMetrics: {
          beforeScore: null,
          afterScore: null,
          improvement: null,
          jdKeywords: [],
          matchedKeywords: [],
          reasoning: null,
          hasJobDescription: false,
          vision2030: null,
          gapAnalysis: [], // Initialize as empty array, not null
          keywordStrategy: {
            mirroredPhrases: [],
            structuralChanges: [],
            hiddenMatches: []
          },
          scoreBreakdown: null,
          categoryScores: null,
          positionSuggestion: null,
        }
      }),

      setDisplayOptions: (options) =>
        set((state) => ({
          displayOptions: { ...state.displayOptions, ...options }
        })),

      togglePageBreaks: () =>
        set((state) => ({
          displayOptions: { ...state.displayOptions, showPageBreaks: !state.displayOptions.showPageBreaks }
        })),

      setContentLanguage: (lang) => set({ contentLanguage: lang }),

      setBaselineMatchScore: (score: number) => {
        set({ baselineMatchScore: score });
      },

      setSaudiNational: (value: boolean) => {
        set({ isSaudiNational: value, hasDownloaded: false });
      },

      // ----- Onboarding -----
      setSearchIntent: (intent: SearchIntent | null) => {
        if (intent === null) {
          set({ searchIntent: null });
          return;
        }

        // Stamp meta with current completeness + timestamp so the slice is always
        // self-describing for the item-2 nudge.
        const stamped: SearchIntent = {
          ...intent,
          meta: {
            ...intent.meta,
            completeness: computeCompleteness(get().originalResume, intent),
            updatedAt: new Date().toISOString(),
          },
        };

        const validation = validateSearchIntent(stamped);
        if (!validation.success) {
          if (import.meta.env.DEV) console.warn('[ResumeStore] ⚠️ SearchIntent validation issues:', validation.error);
        }

        set({ searchIntent: stamped });
      },

      patchProfile: (patch: PartialResumeSchema) => {
        set((state) => {
          const base = state.originalResume ?? emptyResume();
          const merged = mergeProfilePatch(base, patch);

          // Record provenance without persisting raw text — preserves schema integrity.
          const entry: AiSuggestionEntry = {
            type: 'onboarding',
            sectionId: 'onboarding',
            timestamp: new Date().toISOString(),
          };
          merged.meta = {
            ...merged.meta,
            ai_suggestions: [...(merged.meta?.ai_suggestions ?? []), entry],
          };

          // Validate at the store boundary (mirrors setOriginalResume); store regardless.
          const validation = validateResume(merged);
          if (!validation.success) {
            if (import.meta.env.DEV) console.warn('[ResumeStore] ⚠️ patchProfile validation issues:', validation.error);
          }

          return { originalResume: merged, hasDownloaded: false };
        });
      },

      getProfileCompleteness: () => {
        const state = get();
        return computeCompleteness(state.originalResume, state.searchIntent);
      },

      // --- Job variants (Phase 1) -------------------------------------------
      // Snapshot/restore over the shared, immutable base resume. structuredClone
      // decouples the snapshot from later working-set edits so a saved variant is
      // never mutated by subsequent apply/revert on the live cards.
      saveCurrentAsVariant: (label, jobDescription, jobTitle) => {
        const state = get();
        const id = generateVariantId();
        const now = new Date().toISOString();
        const variant: JobVariant = {
          id,
          label: label.trim() || 'Untitled',
          jobTitle: jobTitle?.trim() || undefined,
          jobDescription: truncateJobDescription(jobDescription),
          createdAt: now,
          updatedAt: now,
          snapshot: snapshotWorkingSet(state),
        };
        set((s) => ({
          jobVariants: [...s.jobVariants, variant],
          activeVariantId: id,
        }));
        return id;
      },

      updateVariant: (id, jobDescription) => {
        const state = get();
        const snapshot = snapshotWorkingSet(state);
        const now = new Date().toISOString();
        set((s) => ({
          jobVariants: s.jobVariants.map((v) =>
            v.id === id
              ? { ...v, snapshot, jobDescription: truncateJobDescription(jobDescription), updatedAt: now }
              : v
          ),
        }));
      },

      openVariant: (id) => {
        const variant = get().jobVariants.find((v) => v.id === id);
        if (!variant) return null;
        const snap = variant.snapshot;
        set({
          optimizations: structuredClone(snap.optimizations),
          keywordSuggestions: structuredClone(snap.keywordSuggestions),
          optimizationMetrics: structuredClone(snap.optimizationMetrics),
          baselineMatchScore: snap.baselineMatchScore,
          selectedTemplate: snap.selectedTemplate,
          activeVariantId: id,
          variantRestoreNonce: get().variantRestoreNonce + 1,
          hasDownloaded: false,
        });
        return variant;
      },

      renameVariant: (id, label) => {
        set((s) => ({
          jobVariants: s.jobVariants.map((v) =>
            v.id === id ? { ...v, label: label.trim() || v.label, updatedAt: new Date().toISOString() } : v
          ),
        }));
      },

      deleteVariant: (id) => {
        set((s) => ({
          jobVariants: s.jobVariants.filter((v) => v.id !== id),
          activeVariantId: s.activeVariantId === id ? null : s.activeVariantId,
        }));
      },

      clearAll: () => {
        cacheKeyMemo.clear();
        set({
          originalResume: null,
          parsedResumeText: null,
          hasDownloaded: false,
          optimizations: [],
          keywordSuggestions: [],
          analysisCache: {},
          optimizationMetrics: {
            beforeScore: null,
            afterScore: null,
            improvement: null,
            jdKeywords: [],
            matchedKeywords: [],
            reasoning: null,
            hasJobDescription: false,
            vision2030: null,
            gapAnalysis: [],
            keywordStrategy: {
              mirroredPhrases: [],
              structuralChanges: [],
              hiddenMatches: []
            },
            scoreBreakdown: null,
            categoryScores: null,
          },
          baselineMatchScore: null,
          showOptimized: false,
          searchIntent: null, // Full reset clears job-search intent too
          jobVariants: [], // Variants are job-specific to a resume — clear them
          activeVariantId: null,
        });
      },

      resetForNewUpload: () => {
        // NOTE: searchIntent is intentionally NOT reset here — target role / comp /
        // location are profile-level intent that should survive a new resume upload.
        cacheKeyMemo.clear();
        set({
          originalResume: null,
          parsedResumeText: null,
          hasDownloaded: false,
          optimizations: [],
          keywordSuggestions: [],
          analysisCache: {},
          optimizationMetrics: {
            beforeScore: null,
            afterScore: null,
            improvement: null,
            jdKeywords: [],
            matchedKeywords: [],
            reasoning: null,
            hasJobDescription: false,
            vision2030: null,
            gapAnalysis: [],
            keywordStrategy: {
              mirroredPhrases: [],
              structuralChanges: [],
              hiddenMatches: []
            },
            scoreBreakdown: null,
            categoryScores: null,
          },
          baselineMatchScore: null,
          showOptimized: false,
          jobVariants: [], // Variants belong to the previous resume — clear on new upload
          activeVariantId: null,
        });
      },
    }),
    {
      name: 'resume-storage',
      storage: createJSONStorage(() => localStorage),
      // v1: added jobVariants/activeVariantId slice (job-specific resume builder).
      version: 1,
      migrate: (persistedState, fromVersion) => {
        const state = (persistedState ?? {}) as Partial<ResumeState>;
        if (fromVersion < 1) {
          // Older persisted state predates variants — seed empty defaults so
          // hydration never reads undefined.
          return { ...state, jobVariants: [], activeVariantId: null };
        }
        return state;
      },
      partialize: (state) => ({
        originalResume: state.originalResume,
        parsedResumeText: state.parsedResumeText,
        optimizations: state.optimizations,
        selectedTemplate: state.selectedTemplate,
        showOptimized: state.showOptimized,
        keywordSuggestions: state.keywordSuggestions,
        optimizationMetrics: state.optimizationMetrics,
        displayOptions: state.displayOptions,
        hasDownloaded: state.hasDownloaded,
        // Persist analysisCache so match analysis score survives refresh
        analysisCache: state.analysisCache,
        // Persist baseline score so it survives refresh
        baselineMatchScore: state.baselineMatchScore,
        // Persist Saudi nationality flag
        isSaudiNational: state.isSaudiNational,
        // Persist onboarding job-search intent (survives refresh; flushed to Supabase on sign-in)
        searchIntent: state.searchIntent,
        // Persist job variants (Phase 1, local-only)
        jobVariants: state.jobVariants,
        activeVariantId: state.activeVariantId,
      }),
      // Custom merge to properly handle nested optimizationMetrics
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ResumeState>;
        return {
          ...currentState,
          ...persisted,
          // Deep merge optimizationMetrics to preserve all nested fields
          optimizationMetrics: {
            ...currentState.optimizationMetrics,
            ...(persisted.optimizationMetrics || {}),
            keywordStrategy: {
              ...(currentState.optimizationMetrics?.keywordStrategy || {}),
              ...(persisted.optimizationMetrics?.keywordStrategy || {}),
            },
          },
        };
      },
    }
  )
);

/**
 * Selector hooks for common use cases
 */
export const useActiveResume = () => {
  // Fixed: Subscribe to actual state fields that affect the active resume
  // This ensures re-renders happen when the merged resume changes
  return useResumeStore((state) => {
    // Trigger re-render when any of these change:
    // - originalResume (base data)
    // - optimizations (array reference or applied states)
    // - showOptimized (toggle flag)
    // - isSaudiNational (affects summary)
    return state.getActiveResume();
  });
};

export const useShowOptimized = () =>
  useResumeStore((state) => state.showOptimized);

export const useSelectedTemplate = () =>
  useResumeStore((state) => state.selectedTemplate);

export const useOptimizations = () =>
  useResumeStore((state) => state.optimizations);

export const useKeywordSuggestions = () =>
  useResumeStore((state) => state.keywordSuggestions);

export const useSearchIntent = () =>
  useResumeStore((state) => state.searchIntent);

// Re-derives on any change to resume data or searchIntent.
export const useProfileCompleteness = () =>
  useResumeStore((state) => state.getProfileCompleteness());

// Re-export types for convenience
export type { OptimizationResult, KeywordSuggestion };
