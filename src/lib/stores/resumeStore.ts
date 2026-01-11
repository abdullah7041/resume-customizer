import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ResumeSchema } from '../../types/resume';
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

// Cache validity duration: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Generate a cache key from resume and job description
 * Uses first 100 chars + length as fingerprint
 */
const generateCacheKey = (resumeText: string, jobDescription: string): string => {
  const resumeFingerprint = (resumeText || '').substring(0, 100) + (resumeText || '').length;
  const jobFingerprint = (jobDescription || '').substring(0, 100) + (jobDescription || '').length;
  // Simple hash using btoa
  try {
    return btoa(resumeFingerprint + '|' + jobFingerprint).substring(0, 32);
  } catch {
    // Fallback for non-ASCII characters
    return `${resumeFingerprint.length}-${jobFingerprint.length}-${Date.now()}`;
  }
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
        gapAnalysis: null, // null = not loaded yet, [] = AI returned no gaps
        keywordStrategy: {
          mirroredPhrases: [],
          structuralChanges: [],
          hiddenMatches: []
        },
        scoreBreakdown: null,
      },
      showOptimized: false, // Start with original
      selectedTemplate: 'modern-professional',
      displayOptions: {
        fontSize: 1, // 100% scale by default
      },

      // Actions
      setOriginalResume: (resume: ResumeSchema) => {
        // Zod validation at store boundary
        const validation = validateResume(resume);
        if (!validation.success) {
          console.warn('[ResumeStore] ⚠️ Resume validation issues:', validation.error);
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

        set({ originalResume: validatedResume });
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
          console.warn('[ResumeStore] ⚠️ WARNING: Parsed text is very short! This may indicate a PDF extraction issue.');
        }

        set({ parsedResumeText: resolvedText });
      },


      addOptimization: (optimization: Omit<OptimizationResult, 'timestamp'>) => {
        const fullOptimization: OptimizationResult = {
          ...optimization,
          timestamp: new Date().toISOString(),
        };

        // Zod validation at store boundary
        const validation = validateOptimization(fullOptimization);
        if (!validation.success) {
          console.warn('[ResumeStore] ⚠️ Optimization validation issues:', validation.error);
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
        }));
      },


      setOptimizations: (optimizations: OptimizationResult[]) => {
        set({ optimizations });
      },

      applyOptimization: (sectionId: string) => {
        set((state) => ({
          optimizations: state.optimizations.map((o) =>
            o.sectionId === sectionId ? { ...o, applied: true } : o
          ),
        }));
      },

      revertOptimization: (sectionId: string) => {
        set((state) => ({
          optimizations: state.optimizations.map((o) =>
            o.sectionId === sectionId ? { ...o, applied: false } : o
          ),
        }));
      },

      applyAllOptimizations: () => {
        set((state) => ({
          optimizations: state.optimizations.map((o) => ({
            ...o,
            applied: true,
          })),
          showOptimized: true,
        }));
      },

      revertAllOptimizations: () => {
        set((state) => ({
          optimizations: state.optimizations.map((o) => ({
            ...o,
            applied: false,
          })),
          showOptimized: false,
        }));
      },

      toggleShowOptimized: () => {
        const current = get().showOptimized;
        set({ showOptimized: !current });
      },

      setShowOptimized: (show: boolean) => {
        set({ showOptimized: show });
      },

      setSelectedTemplate: (templateId: TemplateId) => {
        set({ selectedTemplate: templateId });
      },

      setKeywordSuggestions: (suggestions: KeywordSuggestion[]) => {
        set({ keywordSuggestions: suggestions });
      },

      getActiveResume: (): ResumeSchema | null => {
        const state = get();
        if (!state.originalResume) {
          return null;
        }

        // If not showing optimized, return original
        if (!state.showOptimized) {
          return state.originalResume;
        }

        // Deep clone to avoid mutating original
        const merged = JSON.parse(JSON.stringify(state.originalResume)) as ResumeSchema;

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
                console.warn(`[ResumeStore] ⚠️ Match failed for ${opt.sectionType}`, {
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
                console.warn(`[ResumeStore] ⚠️ Match failed for ${opt.sectionType}`, {
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
                console.warn(`[ResumeStore] ⚠️ Match failed for ${opt.sectionType}`, {
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
                console.warn(`[ResumeStore] ⚠️ Match failed for ${opt.sectionType}`, {
                  originalPreview: originalValue.substring(0, 60),
                  sectionId: opt.sectionId,
                });
              }
              break;
            }

            default:
              console.warn(`[ResumeStore] Unknown sectionType: ${opt.sectionType}`);
          }
        }

        // Log merge diagnostics for debugging
        if (diagnostics.failedCount > 0) {
          console.warn('[ResumeStore] Merge diagnostics:', diagnostics);
        } else if (diagnostics.appliedCount > 0) {
          console.log(`[ResumeStore] Successfully applied ${diagnostics.appliedCount} optimizations`);
        }

        return merged;
      },

      // Analysis caching methods
      getCachedAnalysis: (resumeText: string, jobDescription: string): CachedAnalysis | null => {
        const state = get();
        const cacheKey = generateCacheKey(resumeText, jobDescription);
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

      setCachedAnalysis: (resumeText: string, jobDescription: string, analysis: Omit<CachedAnalysis, 'timestamp'>) => {
        const cacheKey = generateCacheKey(resumeText, jobDescription);

        set((state) => ({
          analysisCache: {
            ...state.analysisCache,
            [cacheKey]: {
              ...analysis,
              timestamp: Date.now(),
            },
          },
        }));
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
          gapAnalysis: [],
          keywordStrategy: {
            mirroredPhrases: [],
            structuralChanges: [],
            hiddenMatches: []
          },
          scoreBreakdown: null,
        }
      }),

      setDisplayOptions: (options) =>
        set((state) => ({
          displayOptions: { ...state.displayOptions, ...options }
        })),

      clearAll: () => {
        set({
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
          },
          showOptimized: false,
        });
      },

      resetForNewUpload: () => {
        set({
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
          },
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
        // Persist analysisCache so match analysis score survives refresh
        analysisCache: state.analysisCache,
      }),
    }
  )
);

/**
 * Selector hooks for common use cases
 */
export const useActiveResume = () => {
  const getActiveResume = useResumeStore((state) => state.getActiveResume);
  return getActiveResume();
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
