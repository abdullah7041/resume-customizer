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

  it("is idempotent - does not append version twice", async () => {
    vi.stubEnv("VITE_BUILD_TIMESTAMP", "1234567890");
    const { withVersion } = await loadModule();
    const url = "https://example.com/hero.webp";
    const versionedOnce = withVersion(url);
    const versionedTwice = withVersion(versionedOnce);
    expect(versionedTwice).toBe(versionedOnce);
    expect(versionedTwice).toBe("https://example.com/hero.webp?v=1234567890");
  });

  it("returns the same value when nested calls are made", async () => {
    const { withVersion } = await loadModule();
    const url = "https://example.com/hero.webp";
    expect(withVersion(withVersion(url))).toBe(withVersion(url));
  });

  it("preserves hash fragments while versioning", async () => {
    vi.stubEnv("VITE_BUILD_ID", "hashy");
    const { withVersion } = await loadModule();
    const url = "https://example.com/hero.webp#hero";
    expect(withVersion(url)).toBe("https://example.com/hero.webp?v=hashy#hero");
  });

  it("does not append version if v= query param already exists", async () => {
    vi.stubEnv("VITE_BUILD_TIMESTAMP", "newversion");
    const { withVersion } = await loadModule();
    const urlWithVersion = "https://example.com/hero.webp?v=oldversion";
    expect(withVersion(urlWithVersion)).toBe(urlWithVersion);
  });

  it("does not append version if v= exists with other params", async () => {
    vi.stubEnv("VITE_BUILD_TIMESTAMP", "newversion");
    const { withVersion } = await loadModule();
    const urlWithVersion = "https://example.com/hero.webp?quality=80&v=oldversion&format=webp";
    expect(withVersion(urlWithVersion)).toBe(urlWithVersion);
  });

  it("treats already versioned URLs as idempotent", async () => {
    const { withVersion } = await loadModule();
    const urlWithVersion = "https://example.com/hero.webp?quality=80&v=precedent";
    expect(withVersion(withVersion(urlWithVersion))).toBe(urlWithVersion);
  });
});

describe("publicAssetUrl", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("builds a single well-formed public asset URL", async () => {
    vi.stubEnv("VITE_ASSETS_BASE_URL", "https://cdn.example.com/");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { publicAssetUrl } = await loadModule();
    expect(publicAssetUrl("ui-assets", "/hero//KAFDH.webp")).toBe(
      "https://cdn.example.com/storage/v1/object/public/ui-assets/hero/KAFDH.webp",
    );
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("coerces pathful base URLs to the origin and warns in dev", async () => {
    vi.stubEnv(
      "VITE_ASSETS_BASE_URL",
      "https://project.supabase.co/storage/v1/object/public/ui-assets",
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { publicAssetUrl } = await loadModule();
    expect(publicAssetUrl("ui-assets", "KAFDH.webp")).toBe(
      "https://project.supabase.co/storage/v1/object/public/ui-assets/KAFDH.webp",
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("VITE_ASSETS_BASE_URL should be host-only"),
    );
    warnSpy.mockRestore();
  });

  it("only emits one warning per invalid base host", async () => {
    vi.stubEnv(
      "VITE_ASSETS_BASE_URL",
      "https://project.supabase.co/storage/v1/object/public/ui-assets",
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { publicAssetUrl, __internal } = await loadModule();
    const expectedUrl =
      "https://project.supabase.co/storage/v1/object/public/ui-assets/KAFDH.webp";

    expect(publicAssetUrl("ui-assets", "KAFDH.webp")).toBe(expectedUrl);
    expect(publicAssetUrl("ui-assets", "KAFDH.webp")).toBe(expectedUrl);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    __internal.resetCache();
    warnSpy.mockRestore();
  });

  it("falls back to an empty string when neither env is valid", async () => {
    vi.stubEnv("VITE_ASSETS_BASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { publicAssetUrl } = await loadModule();
    expect(publicAssetUrl("ui-assets", "KAFDH.webp")).toBe("");
    warnSpy.mockRestore();
  });
});

describe("getSkylineUrl", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the versioned skyline asset URL", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_BUILD_ID", "build-xyz");
    const { getSkylineUrl } = await loadModule();
    expect(getSkylineUrl()).toBe(
      "https://project.supabase.co/storage/v1/object/public/ui-assets/KAFDH.webp?v=build-xyz",
    );
  });

  it("falls back to a Saudi gradient when env config is missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getSkylineUrl, __internal } = await loadModule();
    __internal.resetCache();
    const skyline = getSkylineUrl();
    expect(skyline).toMatch(/^data:image\/svg\+xml,/);
    expect(skyline.length).toBeGreaterThan(120);
    warnSpy.mockRestore();
  });
});
