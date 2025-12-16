import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ResumeSchema, Work } from '../../types/resume';
import type {
  ResumeState,
  OptimizationResult,
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
      optimizations: [],
      showOptimized: true,
      selectedTemplate: 'modern-professional',

      setOriginalResume: (resume: ResumeSchema) => {
        set({ originalResume: resume });
      },

      addOptimization: (optimization: Omit<OptimizationResult, 'timestamp'>) => {
        const fullOptimization: OptimizationResult = {
          ...optimization,
          timestamp: new Date().toISOString(),
        };

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
        }));
      },

      toggleShowOptimized: () => {
        set((state) => ({ showOptimized: !state.showOptimized }));
      },

      setSelectedTemplate: (templateId: TemplateId) => {
        set({ selectedTemplate: templateId });
      },

      getActiveResume: (): ResumeSchema | null => {
        const state = get();
        if (!state.originalResume) return null;
        if (!state.showOptimized) return state.originalResume;

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
        set({
          originalResume: null,
          optimizations: [],
          showOptimized: true,
        });
      },
    }),
    {
      name: 'resume-storage',
      partialize: (state) => ({
        originalResume: state.originalResume,
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
