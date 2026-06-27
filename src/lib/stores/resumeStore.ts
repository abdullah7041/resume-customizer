import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ResumeSchema } from '../../types/resume';
import type { AiSuggestionEntry } from '../../types/analysis';
import type {
  ResumeState,
  OptimizationResult,
  KeywordSuggestion,
  TemplateId,
  CachedAnalysis,
  MergeDiagnostics,
} from '../../types/templates';
import {
  validateResume,
  validateParsedText,
  validateOptimization,
} from '../validation/store-schemas';
import { deduplicateByName } from '../utils/resumeUtils';
import { fuzzyTextMatch } from '../utils/textMatcher';

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
                suggestedSkills = optimizedValue.map(s => typeof s === 'string' ? s.trim() : String(s)).filter(Boolean);
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
        });
      },

      resetForNewUpload: () => {
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
        });
      },
    }),
    {
      name: 'resume-storage',
      storage: createJSONStorage(() => localStorage),
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

// Re-export types for convenience
export type { OptimizationResult, KeywordSuggestion };
