import type { Handler } from "@netlify/functions";
import { performance } from "node:perf_hooks";
import { resolveOpenAIOptions } from "../lib/ai-config";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
} as const;

const getRequestId = (event: Parameters<Handler>[0]) =>
  event.headers?.["x-nf-request-id"] ?? crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

const buildInput = (body: any) => {
  if (Array.isArray(body?.input) && body.input.length > 0) {
    return body.input;
  }

  if (Array.isArray(body?.messages) && body.messages.length > 0) {
    return body.messages;
  }

  if (typeof body?.prompt === "string" && body.prompt.trim().length > 0) {
    return [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: body.prompt,
          },
        ],
      },
    ];
  }

  if (typeof body?.text === "string" && body.text.trim().length > 0) {
    return [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: body.text,
          },
        ],
      },
    ];
  }

  return null;
};

const extractOutputText = (data: any): string => {
  if (!data) return "";
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
  if (Array.isArray(data.choices)) {
    const text = data.choices[0]?.message?.content;
    if (typeof text === "string") {
      return text;
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
    const input = buildInput(body);

    if (!input) {
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
        input,
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
      max_output_tokens: options.max_output_tokens ?? null,
      latency_ms: latency,
    });

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        id: data?.id ?? null,
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
