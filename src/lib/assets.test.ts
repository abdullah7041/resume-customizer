import { beforeEach, describe, expect, it, vi } from "vitest";

const loadModule = async () => import("./assets");

describe("withVersion", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("appends a build id when provided", async () => {
    vi.stubEnv("VITE_BUILD_ID", "build-123");
    const { withVersion } = await loadModule();
    expect(withVersion("https://example.com/hero.webp")).toBe(
      "https://example.com/hero.webp?v=build-123",
    );
  });

  it("falls back to a dev tag when the id is missing", async () => {
    const { withVersion } = await loadModule();
    expect(withVersion("https://example.com/hero.webp")).toBe(
      "https://example.com/hero.webp?v=__dev__",
    );
  });

  it("respects existing query params", async () => {
    vi.stubEnv("VITE_BUILD_ID", "next");
    const { withVersion } = await loadModule();
    expect(withVersion("https://example.com/hero.webp?quality=80")).toBe(
      "https://example.com/hero.webp?quality=80&v=next",
    );
  });
});

describe("skyline", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("always returns the Supabase skyline asset with cache busting", async () => {
    vi.stubEnv("VITE_BUILD_ID", "20240924");
    const { skyline } = await loadModule();
    expect(skyline()).toBe(
      "https://cwcjeujextkwpmzdfzdz.supabase.co/storage/v1/object/public/ui-assets/KAFDH.webp?v=20240924",
    );
  });

  it("defaults to the dev tag when build metadata is missing", async () => {
    const { skyline } = await loadModule();
    expect(skyline()).toBe(
      "https://cwcjeujextkwpmzdfzdz.supabase.co/storage/v1/object/public/ui-assets/KAFDH.webp?v=__dev__",
    );
  });
});
