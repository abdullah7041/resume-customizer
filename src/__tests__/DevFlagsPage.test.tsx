import { render, screen, fireEvent, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// DevFlagsPage calls useAuth for its prod admin gate; mock it so the bare render
// works without an AuthProvider. import.meta.env.DEV is true under vitest, so the
// panel renders regardless of role.
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, loading: false, signInWithGoogle: vi.fn(), signOut: vi.fn() }),
}));

import DevFlagsPage from "@/pages/DevFlagsPage";
import { FEATURE_FLAGS } from "@/lib/featureFlags/registry";
import { useFeatureFlagStore } from "@/lib/stores/featureFlagStore";

const FLAG_COUNT = Object.keys(FEATURE_FLAGS).length;

beforeEach(() => {
  useFeatureFlagStore.setState({ overrides: {} });
});

describe("DevFlagsPage", () => {
  it("renders one toggle row per registered flag", () => {
    render(<DevFlagsPage />);
    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(FLAG_COUNT);
    // every flag label is shown
    for (const flag of Object.values(FEATURE_FLAGS)) {
      expect(screen.getByText(flag.label)).toBeInTheDocument();
    }
  });

  it("defaults every switch to enabled", () => {
    render(<DevFlagsPage />);
    for (const s of screen.getAllByRole("switch")) {
      expect(s).toHaveAttribute("aria-checked", "true");
    }
  });

  it("toggling a switch writes an override to the store", () => {
    render(<DevFlagsPage />);
    const toggle = screen.getByRole("switch", { name: /Toggle Truth Check/i });
    fireEvent.click(toggle);
    expect(useFeatureFlagStore.getState().overrides.truthCheck).toBe(false);
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("shows a reset control for overridden flags that clears the override", () => {
    useFeatureFlagStore.setState({ overrides: { optimize: false } });
    render(<DevFlagsPage />);
    const resetButton = screen.getByTitle(/Clear override/i);
    fireEvent.click(resetButton);
    expect(useFeatureFlagStore.getState().overrides.optimize).toBeUndefined();
  });

  it("renders a 'no report' hint for flags without test results", () => {
    render(<DevFlagsPage />);
    // No report generated in the test env → every flag shows the placeholder.
    expect(screen.getAllByText("no report").length).toBeGreaterThan(0);
  });

  it("Reset all clears every override", () => {
    useFeatureFlagStore.setState({ overrides: { optimize: false, aiMatch: false } });
    render(<DevFlagsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Reset all/i }));
    expect(useFeatureFlagStore.getState().overrides).toEqual({});
  });

  it("keeps switch state independent per flag", () => {
    render(<DevFlagsPage />);
    fireEvent.click(screen.getByRole("switch", { name: /Toggle Interview Prep/i }));
    const optimizeRow = screen.getByRole("switch", { name: /Toggle Optimize/i });
    // toggling interview must not flip optimize
    expect(within(optimizeRow.closest("tr")!).getByRole("switch")).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });
});
