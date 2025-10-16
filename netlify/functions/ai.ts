import type { Handler } from "@netlify/functions";
import { performance } from "node:perf_hooks";
import { resolveOpenAIOptions } from "../lib/ai-config";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
} as const;

const getRequestId = (event: Parameters<Handler>[0]) =>
  event.headers?.["x-nf-request-id"] ?? crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

const sanitize = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

type ResponseContentItem = { type: string; [key: string]: unknown };
type ResponseMessage = { role: string; content: string };

const toInputText = (text: string): string => text;

const normalizeContentItem = (item: unknown): string | null => {
  if (typeof item === "string") {
    const text = sanitize(item);
    return text || null;
  }

  if (!item || typeof item !== "object") {
    return null;
  }

  const candidate = item as Record<string, unknown>;
  if (typeof candidate.text === "string") {
    const text = candidate.text.trim();
    return text || null;
  }

  return null;
};

const normalizeContent = (content: unknown): string | null => {
  if (Array.isArray(content)) {
    // Join array items into a single string
    const texts = content
      .map((item) => normalizeContentItem(item))
      .filter((item): item is string => Boolean(item));
    return texts.length > 0 ? texts.join("\n") : null;
  }

  if (typeof content === "string") {
    const text = sanitize(content);
    return text || null;
  }

  if (content && typeof content === "object") {
    const candidate = content as Record<string, unknown>;
    if (typeof candidate.text === "string") {
      const text = candidate.text.trim();
      return text || null;
    }
  }

  return null;
};

const normalizeMessage = (value: unknown): ResponseMessage | null => {
  if (typeof value === "string") {
    const text = sanitize(value);
    return text ? { role: "user", content: text } : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const role = typeof candidate.role === "string" ? candidate.role.trim() : "user";
  const content = normalizeContent(candidate.content ?? candidate.text ?? null);

  if (!content) {
    return null;
  }

  return { role: role || "user", content };
};

const createUserMessage = (text: string): ResponseMessage => ({
  role: "user",
  content: text,
});

const normalizeInput = (value: unknown): ResponseMessage[] | null => {
  if (!value) return null;

  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => normalizeMessage(item))
      .filter((item): item is ResponseMessage => Boolean(item));
    return normalized.length > 0 ? normalized : null;
  }

  const single = normalizeMessage(value);
  return single ? [single] : null;
};

const buildMessages = (body: any): ResponseMessage[] | null => {
  const fromMessages = normalizeInput(body?.messages);
  if (fromMessages) {
    return fromMessages;
  }

  const fromInput = normalizeInput(body?.input);
  if (fromInput) {
    return fromInput;
  }

  const prompt = sanitize(body?.prompt);
  if (prompt) {
    return [createUserMessage(prompt)];
  }

  const resume = sanitize(body?.resumeText ?? body?.resume);
  const job = sanitize(body?.jobText ?? body?.jobDesc ?? body?.job);
  const systemPrompt = sanitize(body?.systemPrompt);

  if (resume || job) {
    const segments: string[] = [];
    if (resume) {
      segments.push(`RESUME:\n${resume}`);
    }
    if (job) {
      segments.push(`JOB DESCRIPTION:\n${job}`);
    }

    const compiled = segments.join("\n\n");
    const messages: ResponseMessage[] = [];

    if (systemPrompt) {
      messages.push({
        role: "system",
        content: systemPrompt,
      });
    }

    messages.push(createUserMessage(compiled));
    return messages;
  }

  const text = sanitize(body?.text);
  if (text) {
    return [createUserMessage(text)];
  }

  return null;
};

const extractOutputText = (data: any): string => {
  if (!data) return "";
  
  // OpenAI chat completions format
  if (Array.isArray(data.choices) && data.choices.length > 0) {
    const choice = data.choices[0];
    if (choice?.message?.content && typeof choice.message.content === "string") {
      return choice.message.content;
    }
  }
  
  // Legacy format support
  if (typeof data.output_text === "string") return data.output_text;
  if (Array.isArray(data.output_text)) {
    for (const entry of data.output_text) {
      if (typeof entry === "string" && entry.trim().length > 0) {
        return entry;
      }
    }
  }
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      const text =
        (item?.content && Array.isArray(item.content) ? item.content[0]?.text : undefined) ?? item?.text;
      if (typeof text === "string" && text.trim().length > 0) {
        return text;
      }
    }
  }
  
  return "";
};

const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const requestId = getRequestId(event);
  const start = performance.now();

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const resume = sanitize(body?.resumeText ?? body?.resume);
    const job = sanitize(body?.jobText ?? body?.jobDesc ?? body?.job);
    const hasMessages = Array.isArray(body?.messages) && body.messages.length > 0;

    if (!resume && !job && !hasMessages) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ error: "Request must include resumeText, jobText, or messages." }),
      };
    }

    const messages = buildMessages(body);

    if (!messages) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ error: "Request must include prompt, text, messages, or input." }),
      };
    }

    const apiKey = process.env.OPENAI_API_KEY ?? process.env.VITE_OPENAI_KEY;
    if (!apiKey) {
      console.error("[ai] missing OPENAI_API_KEY", { requestId });
      return {
        statusCode: 503,
        headers: HEADERS,
        body: JSON.stringify({ error: "OpenAI is not configured." }),
      };
    }

    const options = resolveOpenAIOptions(
      {
        model: body?.model,
        temperature: body?.temperature,
        max_output_tokens: body?.max_output_tokens,
        max_completion_tokens: body?.max_completion_tokens,
      },
      typeof body?.fallback_max_tokens === "number" ? body.fallback_max_tokens : undefined,
    );

    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        ...options,
        messages: messages,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = typeof data?.error?.message === "string" ? data.error.message : "OpenAI request failed";
      const code = data?.error?.code;
      console.error("[ai] request failed", {
        requestId,
        status: response.status,
        code,
        message,
      });
      return {
        statusCode: response.status,
        headers: HEADERS,
        body: JSON.stringify({ error: message, code: code ?? null }),
      };
    }

    const outputText = extractOutputText(data);
    const latency = Math.round(performance.now() - start);
    console.info("[ai] request complete", {
      requestId,
      model: options.model,
      temperature: options.temperature,
      max_output_tokens: options.max_output_tokens ?? null,
      latency_ms: latency,
    });

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        model: data?.model ?? options.model,
        usage: data?.usage ?? null,
        output_text: outputText,
      }),
    };
  } catch (error) {
    const latency = Math.round(performance.now() - start);
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[ai] request error", { requestId, message, latency_ms: latency });
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: message }),
    };
  }
};

export { handler };
