import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ResumeSchema } from '../../types/resume';
import type {
  ResumeState,
  OptimizationResult,
  KeywordSuggestion,
  TemplateId,
  CachedAnalysis,
} from '../../types/templates';
import {
  validateResume,
  validateParsedText,
  validateOptimization,
} from '../validation/store-schemas';

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
      showOptimized: false, // Start with original
      selectedTemplate: 'modern-professional',

      // Actions
      setOriginalResume: (resume: ResumeSchema) => {
        // Zod validation at store boundary
        const validation = validateResume(resume);
        if (!validation.success) {
          console.warn('[ResumeStore] ⚠️ Resume validation issues:', validation.error);
          // Still allow storage but log the issues for debugging
        } else {
          console.log('[ResumeStore] ✓ Resume passed Zod validation');
        }

        // Use validated data if available, otherwise fallback to original
        const validatedResume = (validation.data ?? resume) as ResumeSchema;

        console.log('[ResumeStore] Setting original resume:', validatedResume?.basics?.name);
        console.log('[ResumeStore] Resume has basics:', !!validatedResume?.basics);
        console.log('[ResumeStore] Resume has work:', validatedResume?.work?.length || 0, 'entries');
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

        console.log('[ResumeStore] Setting parsed text, length:', length);

        // Warn if text seems too short
        if (length > 0 && length < 100) {
          console.warn('[ResumeStore] ⚠️ WARNING: Parsed text is very short! This may indicate a PDF extraction issue.');
          console.warn('[ResumeStore] Text preview:', resolvedText.substring(0, 200));
        } else if (length >= 100) {
          console.log('[ResumeStore] ✓ Text looks valid. Preview:', resolvedText.substring(0, 150).replace(/\s+/g, ' '));
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

        console.log('[ResumeStore] Adding optimization:', optimization.sectionId);
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
        console.log('[ResumeStore] Setting optimizations:', optimizations.length);
        set({ optimizations });
      },

      applyOptimization: (sectionId: string) => {
        console.log('[ResumeStore] Applying optimization:', sectionId);
        set((state) => ({
          optimizations: state.optimizations.map((o) =>
            o.sectionId === sectionId ? { ...o, applied: true } : o
          ),
        }));
      },

      revertOptimization: (sectionId: string) => {
        console.log('[ResumeStore] Reverting optimization:', sectionId);
        set((state) => ({
          optimizations: state.optimizations.map((o) =>
            o.sectionId === sectionId ? { ...o, applied: false } : o
          ),
        }));
      },

      applyAllOptimizations: () => {
        console.log('[ResumeStore] Applying all optimizations');
        set((state) => ({
          optimizations: state.optimizations.map((o) => ({
            ...o,
            applied: true,
          })),
          showOptimized: true,
        }));
      },

      revertAllOptimizations: () => {
        console.log('[ResumeStore] Reverting all optimizations');
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
        console.log('[ResumeStore] Toggling showOptimized:', !current);
        set({ showOptimized: !current });
      },

      setShowOptimized: (show: boolean) => {
        console.log('[ResumeStore] Setting showOptimized:', show);
        set({ showOptimized: show });
      },

      setSelectedTemplate: (templateId: TemplateId) => {
        console.log('[ResumeStore] Setting template:', templateId);
        set({ selectedTemplate: templateId });
      },

      setKeywordSuggestions: (suggestions: KeywordSuggestion[]) => {
        console.log('[ResumeStore] Setting keyword suggestions:', suggestions.length);
        set({ keywordSuggestions: suggestions });
      },

      getActiveResume: (): ResumeSchema | null => {
        const state = get();
        if (!state.originalResume) {
          console.log('[ResumeStore] getActiveResume: No original resume');
          return null;
        }

        // If not showing optimized, return original
        if (!state.showOptimized) {
          console.log('[ResumeStore] getActiveResume: Returning original');
          return state.originalResume;
        }

        console.log('[ResumeStore] getActiveResume: Merging optimizations');

        // Deep clone to avoid mutating original
        const merged = JSON.parse(
          JSON.stringify(state.originalResume)
        ) as ResumeSchema;

        // Type-safe value extraction
        const getStringValue = (val: unknown): string => {
          if (typeof val === 'string') return val;
          if (Array.isArray(val)) return val.join(' ');
          return String(val || '');
        };

        const getArrayValue = (val: unknown): string[] => {
          if (Array.isArray(val)) return val;
          if (typeof val === 'string' && val.trim()) return [val];
          return [];
        };

        // Extract index from sectionId (e.g., "experience-0" → 0, "headline-0" → 0)
        const extractIndex = (sectionId: string): number => {
          const match = sectionId.match(/-(\d+)$/);
          return match ? parseInt(match[1], 10) : -1;
        };

        // Apply each optimization
        for (const opt of state.optimizations) {
          if (!opt.applied) continue;

          switch (opt.sectionType) {
            case 'summary':
              if (merged.basics) {
                merged.basics.summary = getStringValue(opt.optimized);
              }
              break;

            case 'headline':
              if (merged.basics) {
                merged.basics.label = getStringValue(opt.optimized);
              }
              break;

            case 'experience': {
              // sectionId is "experience-0", "experience-1", etc.
              const workIndex = extractIndex(opt.sectionId);

              if (workIndex >= 0 && merged.work && merged.work[workIndex]) {
                const newBullet = getStringValue(opt.optimized);
                const originalBullet = getStringValue(opt.original);
                const currentHighlights = [...(merged.work[workIndex].highlights || [])];

                // Find and replace the original bullet, or prepend if not found
                if (originalBullet && newBullet) {
                  const matchIdx = currentHighlights.findIndex(h =>
                    h.toLowerCase().trim() === originalBullet.toLowerCase().trim() ||
                    h.toLowerCase().includes(originalBullet.toLowerCase().substring(0, 50))
                  );

                  if (matchIdx >= 0) {
                    currentHighlights[matchIdx] = newBullet;
                  } else {
                    // Original not found, prepend the optimized version
                    currentHighlights.unshift(newBullet);
                  }
                } else if (newBullet) {
                  currentHighlights.unshift(newBullet);
                }

                merged.work[workIndex] = {
                  ...merged.work[workIndex],
                  highlights: currentHighlights,
                };
              }
              break;
            }

            case 'skills': {
              const optimizedSkills = getArrayValue(opt.optimized);
              if (optimizedSkills.length === 0) break;

              if (!merged.skills) merged.skills = [];

              const existingKeywords = merged.skills.flatMap(s => s.keywords || []);
              const newSkills = optimizedSkills.filter(
                skill => !existingKeywords.some(
                  existing => existing.toLowerCase() === skill.toLowerCase()
                )
              );

              if (newSkills.length > 0) {
                const recommendedGroup = merged.skills.find(s => s.name === 'Recommended Skills');
                if (recommendedGroup) {
                  recommendedGroup.keywords = [...(recommendedGroup.keywords || []), ...newSkills];
                } else {
                  merged.skills.push({
                    name: 'Recommended Skills',
                    keywords: newSkills,
                  });
                }
              }
              break;
            }

            case 'projects': {
              // sectionId is "projects-0", "projects-1", etc.
              const projectIndex = extractIndex(opt.sectionId);

              if (projectIndex >= 0 && merged.projects && merged.projects[projectIndex]) {
                const newDescription = getStringValue(opt.optimized);
                if (newDescription) {
                  merged.projects[projectIndex] = {
                    ...merged.projects[projectIndex],
                    description: newDescription,
                  };
                }
              }
              break;
            }

            case 'education': {
              // sectionId is "education-0", "education-1", etc.
              const eduIndex = extractIndex(opt.sectionId);

              if (eduIndex >= 0 && merged.education && merged.education[eduIndex]) {
                const improved = getStringValue(opt.optimized);
                if (improved) {
                  merged.education[eduIndex] = {
                    ...merged.education[eduIndex],
                    area: improved,
                  };
                }
              }
              break;
            }

            default:
              console.warn(`[ResumeStore] Unknown sectionType: ${opt.sectionType}`);
          }
        }

        // DEBUG: Verify merge is working (remove after confirming fix)
        console.log('[ResumeStore] Merged headline:', merged.basics?.label);
        console.log('[ResumeStore] Merged summary preview:', merged.basics?.summary?.substring(0, 50));

        return merged;
      },

      // Analysis caching methods
      getCachedAnalysis: (resumeText: string, jobDescription: string): CachedAnalysis | null => {
        const state = get();
        const cacheKey = generateCacheKey(resumeText, jobDescription);
        const cached = state.analysisCache[cacheKey];

        if (!cached) {
          console.log('[ResumeStore] Cache miss for analysis');
          return null;
        }

        // Check if cache is still valid
        const age = Date.now() - cached.timestamp;
        if (age > CACHE_TTL_MS) {
          console.log('[ResumeStore] Cache expired (age:', Math.round(age / 1000), 'seconds)');
          return null;
        }

        console.log('[ResumeStore] Cache hit! Using cached analysis (age:', Math.round(age / 1000), 'seconds)');
        return cached;
      },

      setCachedAnalysis: (resumeText: string, jobDescription: string, analysis: Omit<CachedAnalysis, 'timestamp'>) => {
        const cacheKey = generateCacheKey(resumeText, jobDescription);
        console.log('[ResumeStore] Caching analysis result, score:', analysis.score);

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
        console.log('[ResumeStore] Clearing analysis cache');
        set({ analysisCache: {} });
      },

      clearAll: () => {
        console.log('[ResumeStore] Clearing all data');
        set({
          originalResume: null,
          parsedResumeText: null,
          optimizations: [],
          keywordSuggestions: [],
          analysisCache: {},
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
        // Note: Not persisting analysisCache to localStorage to avoid stale data
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
