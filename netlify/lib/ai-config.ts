const FALLBACK_MODEL = "gpt-5-nano";
const DEFAULT_TEMPERATURE = 1;
const MIN_TOKENS = 1;
const MAX_TOKENS = 4096;

let aliasWarningLogged = false;

export type OpenAIOptions = {
  model?: string | null;
  temperature?: number | null;
  max_completion_tokens?: number | null;
  max_tokens?: number | null;
  max_output_tokens?: number | null;
};

const sanitizeModel = (value?: string | null): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const clampTokens = (value?: number | null): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded)) return undefined;
  return Math.min(Math.max(rounded, MIN_TOKENS), MAX_TOKENS);
};

const getDefaultModel = () => sanitizeModel(process.env.OPENAI_MODEL) ?? FALLBACK_MODEL;

export const getDefaultOpenAIConfig = () => ({
  model: getDefaultModel(),
  temperature: DEFAULT_TEMPERATURE,
});

export const resolveOpenAIOptions = (
  overrides: OpenAIOptions = {},
  fallbackMaxTokens?: number,
) => {
  const defaults = getDefaultOpenAIConfig();

  const resolved: {
    model: string;
    temperature: number;
    max_output_tokens?: number;
  } = {
    model: sanitizeModel(overrides.model) ?? defaults.model,
    temperature:
      typeof overrides.temperature === "number" && Number.isFinite(overrides.temperature)
        ? overrides.temperature
        : defaults.temperature,
  };

  // Prefer max_output_tokens, then fall back to deprecated aliases
  let tokenValue = clampTokens(overrides.max_output_tokens ?? overrides.max_tokens ?? overrides.max_completion_tokens ?? undefined);

  const aliasValue = clampTokens(overrides.max_completion_tokens ?? undefined);
  if (aliasValue !== undefined && !overrides.max_output_tokens) {
    if (!aliasWarningLogged) {
      console.warn("max_completion_tokens is deprecated, use max_output_tokens instead");
      aliasWarningLogged = true;
    }
  }

  const fallbackValue = clampTokens(fallbackMaxTokens ?? undefined);
  if (tokenValue === undefined && fallbackValue !== undefined) {
    tokenValue = fallbackValue;
  }

  if (tokenValue !== undefined) {
    resolved.max_output_tokens = tokenValue;
  }

  return resolved;
};
