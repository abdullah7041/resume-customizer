const AI_ENDPOINT = "/.netlify/functions/ai";
const USE_MOCK = import.meta.env.VITE_USE_MOCK_AI === "true";

export type RunOptimizationPayload = Record<string, unknown>;

export type RunOptimizationDebug = {
  status: "success" | "error";
  model?: string | null;
  tokens?: number | null;
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

  try {
    const response = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    const latencyMs = now() - started;

    if (!response.ok) {
      const { message, code } = parseError(data);
      const error = new AiRequestError(message, response.status, code);
      options.onDebug?.({
        status: "error",
        model: (payload?.model as string | undefined) ?? (typeof data?.model === "string" ? data.model : null),
        latencyMs,
        statusCode: response.status,
        errorCode: code ?? null,
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
      model: typeof data?.model === "string" ? data.model : (payload?.model as string | undefined) ?? null,
      tokens: tokens ?? null,
      latencyMs,
      requestId: typeof data?.id === "string" ? data.id : null,
      statusCode: 200,
      errorCode: null,
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

    options.onDebug?.({
      status: "error",
      model: (payload?.model as string | undefined) ?? null,
      latencyMs,
      statusCode,
      errorCode,
    });
    if (normalized.name === "AbortError") {
      normalized.message = "AI request timed out";
    }
    options.onError?.(normalized);

    if (canUseMock()) {
      return { text: "", raw: null };
    }

    throw normalized;
  } finally {
    signal?.removeEventListener?.("abort", abortHandler);
  }
}

export { USE_MOCK };
