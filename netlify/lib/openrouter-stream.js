/**
 * AI API Client – Streaming Extension
 * Adds streaming support for OpenRouter and Gemini APIs.
 * Used by the optimize-stream.ts SSE endpoint.
 */

import { summarizeErrorForLog } from './sentry.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const MODELS = {
  lite:  'google/gemini-2.5-flash-lite',
  flash: 'google/gemini-2.5-flash',
};

const GEMINI_MODELS = {
  lite:  'gemini-2.5-flash-lite',
  flash: 'gemini-2.5-flash',
};

const DEFAULT_MAX_TOKENS = { lite: 4096, flash: 6144 };

/**
 * Convert Google AI SDK JSON Schema format to OpenRouter format
 */
function convertGoogleSchemaToOpenRouter(googleSchema) {
  const schema = JSON.parse(JSON.stringify(googleSchema));
  return {
    type: schema.type || 'object',
    properties: schema.properties || {},
    required: schema.required || [],
    additionalProperties: false,
  };
}

/**
 * Stream tokens from OpenRouter API using SSE.
 * Returns a ReadableStream of raw SSE lines from OpenRouter.
 *
 * @param {'lite'|'flash'} modelType
 * @param {Array<{role:string,content:string}>} messages
 * @param {object|null} jsonSchema
 * @param {object} options
 * @returns {Promise<ReadableStream<Uint8Array>>}
 */
export async function streamFromOpenRouter(modelType, messages, jsonSchema = null, options = {}) {
  const model = MODELS[modelType] || MODELS.flash;

  const requestBody = {
    model,
    messages,
    temperature: options.temperature ?? 0,
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS[modelType] ?? 6144,
    stream: true, // ← Enable SSE streaming
  };

  if (options.reasoningBudget != null) {
    requestBody.reasoning = {
      max_tokens: options.reasoningBudget,
      exclude: true,
    };
  }

  if (jsonSchema) {
    const converted = convertGoogleSchemaToOpenRouter(jsonSchema);
    requestBody.response_format = {
      type: 'json_schema',
      json_schema: {
        name: options.schemaName || 'response',
        strict: true,
        schema: converted,
      },
    };
  } else {
    requestBody.response_format = { type: 'json_object' };
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.SITE_URL || 'https://watheqai.app',
      'X-Title': 'Watheq Resume Optimizer',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = new Error(
      `OpenRouter streaming error (${response.status})`
    );
    error.details = summarizeErrorForLog(await response.json().catch(() => ({})));
    error.status = response.status;
    throw error;
  }

  return response.body; // ReadableStream<Uint8Array> — raw SSE from OpenRouter
}

/**
 * Stream tokens from Gemini Direct API using SSE.
 *
 * @param {'lite'|'flash'} modelType
 * @param {Array<{role:string,content:string}>} messages
 * @param {object|null} jsonSchema
 * @param {object} options
 * @returns {Promise<ReadableStream<Uint8Array>>}
 */
export async function streamFromGemini(modelType, messages, jsonSchema = null, options = {}) {
  const geminiModel = GEMINI_MODELS[modelType] || GEMINI_MODELS.flash;
  // streamGenerateContent with alt=sse returns Server-Sent Events
  const url = `${GEMINI_BASE_URL}/${geminiModel}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

  const contents = [];
  let systemInstruction = null;

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = { parts: [{ text: msg.content }] };
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  }

  const requestBody = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0,
      maxOutputTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS[modelType] ?? 6144,
    },
  };

  if (options.reasoningBudget != null) {
    requestBody.generationConfig.thinkingConfig = {
      thinkingBudget: options.reasoningBudget,
    };
  }

  if (systemInstruction) {
    requestBody.systemInstruction = systemInstruction;
  }

  if (jsonSchema) {
    requestBody.generationConfig.responseMimeType = 'application/json';
    requestBody.generationConfig.responseSchema = jsonSchema;
  } else {
    requestBody.generationConfig.responseMimeType = 'application/json';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = new Error(`Gemini streaming error (${response.status})`);
    error.details = summarizeErrorForLog(await response.json().catch(() => ({})));
    error.status = response.status;
    throw error;
  }

  return response.body;
}

export { MODELS, DEFAULT_MAX_TOKENS };
