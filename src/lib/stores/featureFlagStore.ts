import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FeatureFlagName } from "@/types/featureFlags";

export interface FeatureFlagState {
  overrides: Partial<Record<FeatureFlagName, boolean>>;
  setOverride: (name: FeatureFlagName, enabled: boolean) => void;
  clearOverride: (name: FeatureFlagName) => void;
  resetAll: () => void;
}

/**
 * Dev-only override store, separate from `resumeStore` on purpose — this is
 * throwaway dev-panel state, not product data, and must never touch the
 * resumeStore persist config.
 */
export const useFeatureFlagStore = create<FeatureFlagState>()(
  persist(
    (set) => ({
      overrides: {},

      setOverride: (name, enabled) => {
        console.log(`[FeatureFlagStore] setOverride: ${name} -> ${enabled}`);
        set((state) => ({ overrides: { ...state.overrides, [name]: enabled } }));
      },

      clearOverride: (name) => {
        console.log(`[FeatureFlagStore] clearOverride: ${name}`);
        set((state) => {
          const next = { ...state.overrides };
          delete next[name];
          return { overrides: next };
        });
      },

      resetAll: () => {
        console.log("[FeatureFlagStore] resetAll");
        set({ overrides: {} });
      },
    }),
    {
      name: "watheq:featureFlags",
      partialize: (state) => ({ overrides: state.overrides }),
    }
  )
);
