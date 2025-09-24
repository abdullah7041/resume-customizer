import { beforeEach, describe, expect, it, vi } from "vitest";

const loadModule = async () => import("./assets");

describe("withVersion", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("appends the build version when available", async () => {
    vi.stubEnv("VITE_BUILD_ID", "123");
    const { withVersion } = await loadModule();
    expect(withVersion("https://example.com/hero.webp")).toBe(
      "https://example.com/hero.webp?v=123",
    );
  });

  it("returns the original url when no build id is provided", async () => {
    const { withVersion } = await loadModule();
    expect(withVersion("https://example.com/hero.webp")).toBe(
      "https://example.com/hero.webp",
    );
  });
});

describe("asset", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("normalizes the configured asset base", async () => {
    vi.stubEnv("VITE_ASSETS_BASE_URL", "https://cdn.example.com/media/");
    const { asset } = await loadModule();
    expect(asset("/KAFDHD.webp")).toBe("https://cdn.example.com/media/KAFDHD.webp");
  });

  it("returns absolute urls unchanged", async () => {
    const { asset } = await loadModule();
    expect(asset("https://storage.supabase.co/object/public/hero.webp")).toBe(
      "https://storage.supabase.co/object/public/hero.webp",
    );
  });
});

describe("skyline", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("applies cache-busting when build metadata is available", async () => {
    vi.stubEnv("VITE_ASSETS_BASE_URL", "https://cdn.example.com/media");
    vi.stubEnv("VITE_BUILD_ID", "20240924");
    const { skyline } = await loadModule();
    expect(skyline()).toBe("https://cdn.example.com/media/KAEDHero.webp?v=20240924");
  });

  it("prefers the configured skyline asset when provided", async () => {
    vi.stubEnv("VITE_SKYLINE_ASSET", "hero/custom.webp");
    const { skyline } = await loadModule();
    expect(skyline()).toBe("/hero/custom.webp");
  });
});
