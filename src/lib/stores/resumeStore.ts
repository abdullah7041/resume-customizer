import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ResumeSchema } from '../../types/resume';
import type {
  ResumeState,
  OptimizationResult,
  KeywordSuggestion,
  TemplateId,
} from '../../types/templates';

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
      showOptimized: false, // Start with original
      selectedTemplate: 'modern-professional',

      // Actions
      setOriginalResume: (resume: ResumeSchema) => {
        console.log('[ResumeStore] Setting original resume:', resume?.basics?.name);
        set({ originalResume: resume });
      },

      setParsedResumeText: (text: string) => {
        console.log('[ResumeStore] Setting parsed text, length:', text?.length);
        set({ parsedResumeText: text });
      },

      addOptimization: (optimization: Omit<OptimizationResult, 'timestamp'>) => {
        const fullOptimization: OptimizationResult = {
          ...optimization,
          timestamp: new Date().toISOString(),
        };

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

        // Apply each optimization
        for (const opt of state.optimizations) {
          if (!opt.applied) continue;

          switch (opt.sectionType) {
            case 'summary':
              if (merged.basics) {
                merged.basics.summary = opt.optimized as string;
              }
              break;

            case 'headline':
              if (merged.basics) {
                merged.basics.label = opt.optimized as string;
              }
              break;

            case 'experience': {
              const workIndex = merged.work?.findIndex(
                (w, i) => `work-${i}` === opt.sectionId || w.name === opt.sectionId
              );
              if (workIndex !== undefined && workIndex !== -1 && merged.work) {
                merged.work[workIndex] = {
                  ...merged.work[workIndex],
                  highlights: opt.optimized as string[],
                };
              }
              break;
            }

            case 'skills': {
              // Skills optimization replaces keywords or adds new skills
              const optimizedSkills = opt.optimized as string[];
              if (merged.skills && merged.skills.length > 0) {
                // Add optimized skills to first skill group or create new
                const existingKeywords = merged.skills.flatMap(
                  (s) => s.keywords || []
                );
                const newSkills = optimizedSkills.filter(
                  (s) => !existingKeywords.includes(s)
                );
                if (newSkills.length > 0) {
                  merged.skills.push({
                    name: 'Recommended Skills',
                    keywords: newSkills,
                  });
                }
              } else {
                merged.skills = [
                  {
                    name: 'Skills',
                    keywords: optimizedSkills,
                  },
                ];
              }
              break;
            }

            case 'projects': {
              const projectIndex = merged.projects?.findIndex(
                (p, i) => `project-${i}` === opt.sectionId || p.name === opt.sectionId
              );
              if (
                projectIndex !== undefined &&
                projectIndex !== -1 &&
                merged.projects
              ) {
                merged.projects[projectIndex] = {
                  ...merged.projects[projectIndex],
                  highlights: opt.optimized as string[],
                };
              }
              break;
            }
          }
        }

        return merged;
      },

      clearAll: () => {
        console.log('[ResumeStore] Clearing all data');
        set({
          originalResume: null,
          parsedResumeText: null,
          optimizations: [],
          keywordSuggestions: [],
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
