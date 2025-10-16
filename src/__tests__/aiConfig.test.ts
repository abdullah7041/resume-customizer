import { beforeEach, describe, expect, it, vi } from "vitest";

const loadConfigModule = async () => import("../../netlify/lib/ai-config");

describe("ai-config", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    delete process.env.OPENAI_MODEL;
  });

  it("returns defaults and applies fallback tokens", async () => {
    const { resolveOpenAIOptions } = await loadConfigModule();
    const options = resolveOpenAIOptions({}, 900);
    expect(options.model).toBe("gpt-5-nano");
    expect(options.temperature).toBe(1);
    expect(options.max_output_tokens).toBe(900);
  });

  it("uses env override and clamps token requests", async () => {
    process.env.OPENAI_MODEL = " custom-model ";
    const { resolveOpenAIOptions } = await loadConfigModule();
    const options = resolveOpenAIOptions({ max_output_tokens: 9999 }, 0);
    expect(options.model).toBe("custom-model");
    expect(options.max_output_tokens).toBe(4096);
  });

  it("maps the alias once and prefers explicit overrides", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { resolveOpenAIOptions } = await loadConfigModule();

    const first = resolveOpenAIOptions({ max_completion_tokens: 2500 }, 0);
    expect(first.max_output_tokens).toBe(2500);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    const second = resolveOpenAIOptions(
      { max_completion_tokens: 3000, max_output_tokens: 1500 },
      0,
    );
    expect(second.max_output_tokens).toBe(1500);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });
});
