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

  it("defaults the model, temperature, and max tokens", async () => {
    const responsePayload = { output_text: "ok", usage: { output_tokens: 12 }, model: "gpt-5-nano" };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(responsePayload),
      headers: { get: () => null },
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await runOptimization({ max_completion_tokens: 256 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request?.body as string);
    expect(body).toMatchObject({
      model: "gpt-5-nano",
      temperature: 0.7,
      max_output_tokens: 256,
    });
  });
});
