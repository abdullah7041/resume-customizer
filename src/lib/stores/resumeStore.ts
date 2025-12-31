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
import { deduplicateByName } from '../utils/resumeUtils';

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
      },
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

        // Deduplicate arrays to prevent duplicate entries
        if (validatedResume.projects) {
          validatedResume.projects = deduplicateByName(validatedResume.projects);
        }
        if (validatedResume.work) {
          validatedResume.work = deduplicateByName(validatedResume.work);
        }

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
        const merged = JSON.parse(JSON.stringify(state.originalResume)) as ResumeSchema;

        // Type-safe value extraction helpers
        const getStringValue = (val: unknown): string => {
          if (typeof val === 'string') return val;
          if (Array.isArray(val)) return val.join(' ');
          return String(val || '');
        };


        // Fuzzy text matching - finds if text A is contained in or similar to text B
        const textMatches = (needle: string, haystack: string): boolean => {
          if (!needle || !haystack) return false;
          const n = needle.toLowerCase().trim();
          const h = haystack.toLowerCase().trim();

          // Exact match
          if (n === h) return true;

          // Substring match (first 40 chars to handle truncation)
          const nShort = n.substring(0, 40);
          const hShort = h.substring(0, 40);
          if (h.includes(nShort) || n.includes(hShort)) return true;

          // Word overlap match (at least 60% of words match)
          const nWords = n.split(/\s+/).filter(w => w.length > 3);
          const hWords = h.split(/\s+/).filter(w => w.length > 3);
          if (nWords.length === 0 || hWords.length === 0) return false;

          const matches = nWords.filter(w => hWords.some(hw => hw.includes(w) || w.includes(hw)));
          return matches.length / Math.min(nWords.length, hWords.length) >= 0.5;
        };

        // Track which optimizations were successfully applied
        let appliedCount = 0;

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
                appliedCount++;
                console.log('[ResumeStore] Applied summary optimization');
              }
              break;

            case 'headline':
              if (merged.basics) {
                merged.basics.label = optimizedValue;
                appliedCount++;
                console.log('[ResumeStore] Applied headline optimization');
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
                    if (textMatches(originalValue, highlights[hlIdx])) {
                      // Found a match - replace this highlight
                      merged.work[workIdx].highlights![hlIdx] = optimizedValue;
                      found = true;
                      appliedCount++;
                      console.log(`[ResumeStore] Applied experience optimization to work[${workIdx}].highlights[${hlIdx}]`);
                      break; // Move to next optimization
                    }
                  }

                  // Also check summary field
                  if (!found && workEntry.summary && textMatches(originalValue, workEntry.summary)) {
                    merged.work[workIdx].summary = optimizedValue;
                    found = true;
                    appliedCount++;
                    console.log(`[ResumeStore] Applied experience optimization to work[${workIdx}].summary`);
                  }

                  if (found) break;
                }
              }

              if (!found) {
                console.warn('[ResumeStore] Could not find match for experience optimization:', originalValue.substring(0, 50));
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
                  if (eduEntry.area && textMatches(originalValue, eduEntry.area)) {
                    merged.education[eduIdx].area = optimizedValue;
                    found = true;
                    appliedCount++;
                    console.log(`[ResumeStore] Applied education optimization to education[${eduIdx}].area`);
                    break;
                  }

                  // Check highlights array if present
                  const highlights = eduEntry.highlights || [];
                  for (let hlIdx = 0; hlIdx < highlights.length; hlIdx++) {
                    if (textMatches(originalValue, highlights[hlIdx])) {
                      merged.education[eduIdx].highlights![hlIdx] = optimizedValue;
                      found = true;
                      appliedCount++;
                      console.log(`[ResumeStore] Applied education optimization to education[${eduIdx}].highlights[${hlIdx}]`);
                      break;
                    }
                  }

                  if (found) break;
                }
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
                  if (projEntry.name && textMatches(originalValue, projEntry.name)) {
                    merged.projects[projIdx].name = optimizedValue;
                    found = true;
                    appliedCount++;
                    break;
                  }

                  if (projEntry.description && textMatches(originalValue, projEntry.description)) {
                    merged.projects[projIdx].description = optimizedValue;
                    found = true;
                    appliedCount++;
                    break;
                  }

                  // Check highlights
                  const highlights = projEntry.highlights || [];
                  for (let hlIdx = 0; hlIdx < highlights.length; hlIdx++) {
                    if (textMatches(originalValue, highlights[hlIdx])) {
                      merged.projects[projIdx].highlights![hlIdx] = optimizedValue;
                      found = true;
                      appliedCount++;
                      break;
                    }
                  }

                  if (found) break;
                }
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
              console.log('[ResumeStore] Skills suggestions (not auto-added):', suggestedSkills);
              console.log('[ResumeStore] Note: Skills are shown as recommendations only, not injected into resume');

              // Mark as "applied" for tracking but don't modify resume
              appliedCount++;
              break;
            }

            case 'certifications': {
              // Handle certification optimizations similarly
              if (merged.certificates) {
                for (let certIdx = 0; certIdx < merged.certificates.length; certIdx++) {
                  const cert = merged.certificates[certIdx];
                  if (cert.name && textMatches(originalValue, cert.name)) {
                    merged.certificates[certIdx].name = optimizedValue;
                    appliedCount++;
                    break;
                  }
                }
              }
              break;
            }

            default:
              console.warn(`[ResumeStore] Unknown sectionType: ${opt.sectionType}`);
          }
        }

        console.log('[ResumeStore] Applied', appliedCount, 'of', state.optimizations.filter(o => o.applied).length, 'optimizations');
        console.log('[ResumeStore] Merged headline:', merged.basics?.label);
        console.log('[ResumeStore] Merged summary preview:', merged.basics?.summary?.substring(0, 50));

        // Log experience highlights for debugging
        if (merged.work && merged.work[0]) {
          console.log('[ResumeStore] First work entry highlights count:', merged.work[0].highlights?.length || 0);
          if (merged.work[0].highlights?.[0]) {
            console.log('[ResumeStore] First highlight preview:', merged.work[0].highlights[0].substring(0, 50));
          }
        }

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
        }
      }),

      clearAll: () => {
        console.log('[ResumeStore] Clearing all data');
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
        console.log('[ResumeStore] Resetting for new upload (preserving template)');
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
