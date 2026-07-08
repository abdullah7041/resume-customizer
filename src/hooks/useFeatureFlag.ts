import { FEATURE_FLAGS, resolveFlag } from "@/lib/featureFlags/registry";
import { useFeatureFlagStore } from "@/lib/stores/featureFlagStore";
import type { FeatureFlagName } from "@/types/featureFlags";

// Overrides apply in BOTH dev and prod. Prod is safe because the only way to
// write an override is the admin-gated /dev/flags dashboard, and every flag
// defaults to `true` (an override can only HIDE a shipped feature for the one
// browser that set it — never reveal something or affect other users).
// NOTE: this trades away the old "prod tree-shakes the flag runtime" property —
// that was the cost of allowing prod toggles. If a future flag ships
// `defaultEnabled: false`, revisit: a user could reveal it by editing
// localStorage. Today all defaults are true, so there is nothing to reveal.
const APPLY_OVERRIDES = true;

/**
 * Resolve a single feature flag. Subscribes unconditionally to the override
 * store so hook-order rules stay stable across renders.
 */
export function useFeatureFlag(name: FeatureFlagName): boolean {
  const overrides = useFeatureFlagStore((state) => state.overrides);
  return resolveFlag(name, overrides, APPLY_OVERRIDES);
}

/** Resolve every registered feature flag at once — used by MainContent's tab filters. */
export function useFeatureFlags(): Record<FeatureFlagName, boolean> {
  const overrides = useFeatureFlagStore((state) => state.overrides);
  const names = Object.keys(FEATURE_FLAGS) as FeatureFlagName[];
  return names.reduce((acc, name) => {
    acc[name] = resolveFlag(name, overrides, APPLY_OVERRIDES);
    return acc;
  }, {} as Record<FeatureFlagName, boolean>);
}
