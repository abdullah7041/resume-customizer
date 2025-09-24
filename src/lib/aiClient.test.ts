import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { runOptimization } from "./aiClient";

describe("runOptimization", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      // @ts-expect-error - cleanup for environments without fetch
      delete global.fetch;
    }
    vi.restoreAllMocks();
  });

  it("wraps abort errors with a friendly message", async () => {
    const abortDomError = new DOMException("The operation was aborted.", "AbortError");
    global.fetch = vi.fn().mockRejectedValueOnce(abortDomError) as unknown as typeof fetch;

    const onError = vi.fn();

    await expect(runOptimization({}, { onError })).rejects.toThrow("AI request timed out");

    expect(onError).toHaveBeenCalledTimes(1);
    const [error] = onError.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("AI request timed out");
    expect(error.name).toBe("AbortError");
  });
});
