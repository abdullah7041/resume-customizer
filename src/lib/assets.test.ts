import { beforeEach, describe, expect, it, vi } from "vitest";

const loadModule = async () => import("./assets");

describe("validatePublicUrl", () => {
  it("rejects empty strings", async () => {
    const { validatePublicUrl } = await loadModule();
    expect(() => validatePublicUrl("")).toThrow(/cannot be empty/i);
  });

  it("normalizes redundant slashes in the pathname", async () => {
    const { validatePublicUrl } = await loadModule();
    expect(validatePublicUrl("https://example.com////foo//bar")).toBe(
      "https://example.com/foo/bar",
    );
  });
});

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

  it("returns a single segment URL for the skyline asset", async () => {
    vi.stubEnv("VITE_BUILD_TIMESTAMP", "20240924");
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { getSkylineUrl } = await loadModule();
    const url = getSkylineUrl();
    expect(url).toBe(
      "https://cwcjeujextkwpmzdfzdz.supabase.co/storage/v1/object/public/ui-assets/KAFDH.webp?v=20240924",
    );
    expect(url.split("KAFDH.webp").length - 1).toBe(1);
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });
  it("trims accidental double slashes", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://cwcjeujextkwpmzdfzdz.supabase.co////");
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { getSkylineUrl } = await loadModule();
    const url = getSkylineUrl();
    expect(url).toBe(
      "https://cwcjeujextkwpmzdfzdz.supabase.co/storage/v1/object/public/ui-assets/KAFDH.webp?v=__dev__",
    );
    consoleSpy.mockRestore();
  });

  it("prefers VITE_ASSETS_BASE_URL over VITE_SUPABASE_URL when both are set", async () => {
    vi.stubEnv("VITE_ASSETS_BASE_URL", "https://cdn.example.com");
    vi.stubEnv("VITE_SUPABASE_URL", "https://cwcjeujextkwpmzdfzdz.supabase.co");
    vi.stubEnv("VITE_BUILD_TIMESTAMP", "20240925");
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { getSkylineUrl } = await loadModule();
    const url = getSkylineUrl();
    expect(url).toBe(
      "https://cdn.example.com/storage/v1/object/public/ui-assets/KAFDH.webp?v=20240925",
    );
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });

  it("falls back to VITE_SUPABASE_URL when VITE_ASSETS_BASE_URL is not set", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://cwcjeujextkwpmzdfzdz.supabase.co");
    vi.stubEnv("VITE_BUILD_TIMESTAMP", "20240926");
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { getSkylineUrl } = await loadModule();
    const url = getSkylineUrl();
    expect(url).toBe(
      "https://cwcjeujextkwpmzdfzdz.supabase.co/storage/v1/object/public/ui-assets/KAFDH.webp?v=20240926",
    );
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });
});
