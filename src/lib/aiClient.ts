const AI_ENDPOINT = "/.netlify/functions/ai";
const USE_MOCK = import.meta.env.VITE_USE_MOCK_AI === "true";
const DEFAULT_MODEL = "gpt-5-nano";
const DEFAULT_TEMPERATURE = 1;

export type RunOptimizationPayload = Record<string, unknown>;

export type RunOptimizationDebug = {
  status: "success" | "error";
  model?: string | null;
  tokens?: number | null;
  temperature?: number | null;
  maxOutputTokens?: number | null;
  latencyMs?: number;
  requestId?: string | null;
  statusCode?: number | null;
  errorCode?: string | null;
};

export type RunOptimizationOptions = {
  signal?: AbortSignal;
  // eslint-disable-next-line no-unused-vars
  onError?: (error: Error) => void;
  // eslint-disable-next-line no-unused-vars
  onDebug?: (info: RunOptimizationDebug) => void;
};

export type RunOptimizationResponse = {
  text: string;
  raw: any;
};

export class AiRequestError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status: number, code?: string | null) {
    super(message);
    this.name = "AiRequestError";
    this.status = status;
    this.code = code ?? null;
  }
}

const canUseMock = () => import.meta.env.MODE === "development" && USE_MOCK;

const toNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const parseError = (payload: any): { message: string; code: string | null } => {
  if (!payload || typeof payload !== "object") {
    return { message: "Request failed", code: null };
  }

  const messageSource =
    typeof payload.error === "string" && payload.error.trim().length > 0
      ? payload.error
      : typeof payload.message === "string" && payload.message.trim().length > 0
      ? payload.message
      : "Request failed";

  const code =
    typeof payload.code === "string" && payload.code.trim().length > 0
      ? payload.code.trim()
      : typeof payload.error?.code === "string" && payload.error.code.trim().length > 0
      ? payload.error.code.trim()
      : null;

  return { message: messageSource, code };
};

export async function runOptimization(
  payload: RunOptimizationPayload,
  options: RunOptimizationOptions = {},
): Promise<RunOptimizationResponse> {
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const started = now();
  const controller = new AbortController();
  const signal = options.signal;

  const abortHandler = () => {
    controller.abort();
    signal?.removeEventListener?.("abort", abortHandler);
  };
  signal?.addEventListener?.("abort", abortHandler);

  const normalizedPayload = (() => {
    const base = { ...(payload ?? {}) } as Record<string, unknown>;
    if (base.max_output_tokens == null && typeof base.max_completion_tokens === "number") {
      base.max_output_tokens = base.max_completion_tokens;
    }
    delete base.max_completion_tokens;

    if (typeof base.model !== "string" || base.model.trim().length === 0) {
      base.model = DEFAULT_MODEL;
    }

    if (typeof base.temperature !== "number" || !Number.isFinite(base.temperature)) {
      base.temperature = DEFAULT_TEMPERATURE;
    }

    return base;
  })();

  try {
    // Set a reasonable timeout for AI requests (30 seconds)
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip, deflate", // Enable compression
      },
      body: JSON.stringify(normalizedPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));
    const latencyMs = now() - started;
    const requestedTemperature = toNumber(normalizedPayload.temperature) ?? DEFAULT_TEMPERATURE;
    const requestedMaxTokens =
      toNumber(normalizedPayload.max_output_tokens) ?? toNumber(payload?.max_completion_tokens);
    const responseRequestId =
      typeof response.headers?.get === "function" ? response.headers.get("x-nf-request-id") : null;

    if (!response.ok) {
      const { message, code } = parseError(data);
      
      // Enhanced error message for missing API key
      let enhancedMessage = message;
      if (response.status === 503 && message.includes("not configured")) {
        enhancedMessage = "⚙️ OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.";
      } else if (response.status === 401) {
        enhancedMessage = "🔑 Invalid OpenAI API key. Please check your OPENAI_API_KEY environment variable.";
      } else if (response.status === 429) {
        enhancedMessage = "⏳ OpenAI rate limit exceeded. Please wait a moment and try again.";
      } else if (response.status >= 500) {
        enhancedMessage = `🔧 OpenAI server error: ${message}`;
      }
      
      const error = new AiRequestError(enhancedMessage, response.status, code);
      options.onDebug?.({
        status: "error",
        model: (typeof data?.model === "string" ? data.model : null) ?? (normalizedPayload.model as string | undefined) ?? null,
        latencyMs,
        statusCode: response.status,
        errorCode: code ?? null,
        temperature: requestedTemperature,
        maxOutputTokens: requestedMaxTokens ?? null,
        requestId: responseRequestId,
      });
      options.onError?.(error);
      throw error;
    }

    const text = typeof data?.output_text === "string" ? data.output_text : "";
    const tokens =
      typeof data?.usage?.output_tokens === "number"
        ? data.usage.output_tokens
        : typeof data?.usage?.total_tokens === "number"
        ? data.usage.total_tokens
        : null;

    options.onDebug?.({
      status: "success",
      model: typeof data?.model === "string" ? data.model : (normalizedPayload.model as string | undefined) ?? null,
      tokens: tokens ?? null,
      latencyMs,
      requestId: responseRequestId ?? (typeof data?.id === "string" ? data.id : null),
      statusCode: 200,
      errorCode: null,
      temperature: requestedTemperature,
      maxOutputTokens: requestedMaxTokens ?? null,
    });

    return { text, raw: data };
  } catch (error) {
    const latencyMs = now() - started;
    const normalized =
      error instanceof Error
        ? error
        : new Error(typeof error === "string" ? error : "Unable to reach AI service");
    const statusCode = error instanceof AiRequestError ? error.status : null;
    const errorCode = error instanceof AiRequestError ? error.code : null;
    const finalError = (() => {
      if (normalized.name === "AbortError") {
        const abortError = new Error("AI request timed out");
        abortError.name = normalized.name;
        return abortError;
      }

      return normalized;
    })();

    options.onDebug?.({
      status: "error",
      model: (normalizedPayload.model as string | undefined) ?? null,
      latencyMs,
      statusCode,
      errorCode,
      temperature: toNumber(normalizedPayload.temperature) ?? DEFAULT_TEMPERATURE,
      maxOutputTokens:
        toNumber(normalizedPayload.max_output_tokens) ?? toNumber(payload?.max_completion_tokens) ?? null,
    });
    options.onError?.(finalError);

    if (canUseMock()) {
      return { text: "", raw: null };
    }

    throw finalError;
  } finally {
    signal?.removeEventListener?.("abort", abortHandler);
  }
}

export { USE_MOCK };
