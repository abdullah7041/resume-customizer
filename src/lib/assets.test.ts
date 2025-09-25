import { beforeEach, describe, expect, it, vi } from "vitest";

const loadModule = async () => import("./assets");

describe("withVersion", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("prefers build timestamps when provided", async () => {
    vi.stubEnv("VITE_BUILD_TIMESTAMP", "1727200000");
    const { withVersion } = await loadModule();
    expect(withVersion("https://example.com/hero.webp")).toBe(
      "https://example.com/hero.webp?v=1727200000",
    );
  });

  it("falls back to build ids when timestamps are missing", async () => {
    vi.stubEnv("VITE_BUILD_ID", "build-123");
    const { withVersion } = await loadModule();
    expect(withVersion("https://example.com/hero.webp")).toBe(
      "https://example.com/hero.webp?v=build-123",
    );
  });

  it("falls back to a dev tag when no metadata is present", async () => {
    const { withVersion } = await loadModule();
    expect(withVersion("https://example.com/hero.webp")).toBe(
      "https://example.com/hero.webp?v=__dev__",
    );
  });

  it("respects existing query params", async () => {
    vi.stubEnv("VITE_BUILD_TIMESTAMP", "next");
    const { withVersion } = await loadModule();
    expect(withVersion("https://example.com/hero.webp?quality=80")).toBe(
      "https://example.com/hero.webp?quality=80&v=next",
    );
  });
});

describe("getSkylineUrl", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_SUPABASE_URL", "https://cwcjeujextkwpmzdfzdz.supabase.co/");
  });

  it("always returns the Supabase skyline asset with cache busting", async () => {
    vi.stubEnv("VITE_BUILD_TIMESTAMP", "20240924");
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { getSkylineUrl } = await loadModule();
    expect(getSkylineUrl()).toBe(
      "https://cwcjeujextkwpmzdfzdz.supabase.co/storage/v1/object/public/ui-assets/KAFDH.webp?v=20240924",
    );
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });

  it("defaults to the dev tag when build metadata is missing", async () => {
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { getSkylineUrl } = await loadModule();
    expect(getSkylineUrl()).toBe(
      "https://cwcjeujextkwpmzdfzdz.supabase.co/storage/v1/object/public/ui-assets/KAFDH.webp?v=__dev__",
    );
    consoleSpy.mockRestore();
  });

  it("never repeats the skyline filename in the resolved URL", async () => {
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { getSkylineUrl } = await loadModule();
    const url = getSkylineUrl();
    consoleSpy.mockRestore();

    expect(url).not.toContain("KAFDH.webp/KAFDH.webp");
    expect(url.split("KAFDH.webp").length - 1).toBe(1);
  });

  it("normalizes redundant slashes between segments", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://cwcjeujextkwpmzdfzdz.supabase.co////");
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { getSkylineUrl } = await loadModule();
    const url = getSkylineUrl();
    consoleSpy.mockRestore();

    expect(url).toBe(
      "https://cwcjeujextkwpmzdfzdz.supabase.co/storage/v1/object/public/ui-assets/KAFDH.webp?v=__dev__",
    );
  });
});
