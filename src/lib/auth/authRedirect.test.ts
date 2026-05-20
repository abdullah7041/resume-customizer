import { describe, expect, it, vi } from "vitest";

import { resolveAuthRedirectUrl } from "./authRedirect";

const buildLocation = (url: string) => {
  const parsedUrl = new URL(url);

  return {
    hostname: parsedUrl.hostname,
    origin: parsedUrl.origin,
    pathname: parsedUrl.pathname,
  };
};

describe("resolveAuthRedirectUrl", () => {
  it("uses the localhost origin and path when no override is configured", () => {
    expect(
      resolveAuthRedirectUrl({
        location: buildLocation("http://localhost:5173/upload"),
      })
    ).toBe("http://localhost:5173/upload");
  });

  it("uses the production override when configured", () => {
    expect(
      resolveAuthRedirectUrl({
        envRedirectUrl: "https://watheqai.app",
        location: buildLocation("https://preview.example.netlify.app"),
      })
    ).toBe("https://watheqai.app/");
  });

  it("falls back to the current origin and path for invalid overrides", () => {
    const logger = { warn: vi.fn() };

    expect(
      resolveAuthRedirectUrl({
        envRedirectUrl: "https://[invalid",
        location: buildLocation("https://watheqai.app/dashboard"),
        logger,
      })
    ).toBe("https://watheqai.app/dashboard");
    expect(logger.warn).toHaveBeenCalledWith(
      "Invalid VITE_SUPABASE_REDIRECT_URL, falling back to window origin",
      expect.any(TypeError)
    );
  });

  it("ignores accidental localhost overrides on remote hosts", () => {
    expect(
      resolveAuthRedirectUrl({
        envRedirectUrl: "http://localhost:5173",
        location: buildLocation("https://watheqai.app/workspace"),
      })
    ).toBe("https://watheqai.app/workspace");
  });
});
