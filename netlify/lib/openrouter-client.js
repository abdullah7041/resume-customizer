/**
 * AI API Client with Smart Fallback
 * Primary: OpenRouter API (cost-effective, unified quota)
 * Fallback: Direct Google Gemini API (when OpenRouter returns 502/503)
 */

import { summarizeErrorForLog } from './sentry.js';
import { recordAiUsageEvent } from './ai-usage-logger.js';
import {
  MODELS,
  GEMINI_MODELS,
  DEFAULT_MAX_TOKENS,
  estimateCostUsd,
} from './model-registry.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

if (!OPENROUTER_API_KEY && !GEMINI_API_KEY) {
  console.error('[AI Client] Error: Neither OPENROUTER_API_KEY nor GEMINI_API_KEY is set');
}

function toGeminiModelId(modelId, modelType) {
  if (!modelId) return GEMINI_MODELS[modelType] || GEMINI_MODELS.flash;
  return modelId.startsWith('google/') ? modelId.replace('google/', '') : modelId;
}

/**
 * Parse a data URL (data:<mime>;base64,<payload>) into Gemini inlineData.
 * Returns null if the value is not a base64 data URL.
 */
function dataUrlToInlineData(url) {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(typeof url === 'string' ? url : '');
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

/**
 * Convert OpenAI-style message content (string OR multimodal parts array) into
 * Gemini `parts`. Text parts map to { text }; OpenRouter `file` parts and
 * `image_url` parts (base64 data URLs) map to { inlineData } so the Gemini-direct
 * fallback can read the same PDF/image the OpenRouter path was given.
 */
function toGeminiParts(content) {
  if (typeof content === 'string') return [{ text: content }];
  if (!Array.isArray(content)) return [{ text: String(content ?? '') }];

  const parts = [];
  for (const part of content) {
    if (!part || typeof part !== 'object') continue;
    if (part.type === 'text' && typeof part.text === 'string') {
      parts.push({ text: part.text });
    } else if (part.type === 'file' && part.file?.file_data) {
      const inline = dataUrlToInlineData(part.file.file_data);
      if (inline) parts.push({ inlineData: inline });
    } else if (part.type === 'image_url' && part.image_url?.url) {
      const inline = dataUrlToInlineData(part.image_url.url);
      if (inline) parts.push({ inlineData: inline });
    }
  }
  return parts.length > 0 ? parts : [{ text: '' }];
}

async function recordUsageEvent({
  options,
  model,
  provider,
  usage = {},
  reasoningTokens = 0,
  startTime,
  success,
  errorCode = null,
}) {
  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;
  const estimatedCost = estimateCostUsd(model, promptTokens, completionTokens);

  await recordAiUsageEvent({
    feature_name: options.featureName || 'unknown',
    model,
    provider,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    reasoning_tokens: reasoningTokens,
    total_tokens: usage.total_tokens || 0,
    estimated_cost_usd: estimatedCost,
    latency_ms: Date.now() - startTime,
    success,
    error_code: errorCode,
    user_ref: options.userRef || null,
    jd_fingerprint: options.jdFingerprint || null,
  });
}

/**
 * Convert Google AI SDK JSON Schema format to OpenRouter format
 */
function convertGoogleSchemaToOpenRouter(googleSchema) {
  const schema = structuredClone(googleSchema);
  return {
    type: schema.type || 'object',
    properties: schema.properties || {},
    required: schema.required || [],
    additionalProperties: false
  };
}

/**
 * Check if an error is a provider-level failure that warrants fallback.
 * Broadened to catch auth failures (401/403), timeouts, and all 5xx errors
 * so that the Gemini fallback is triggered in more failure scenarios.
 */
function isFallbackEligible(error) {
  // Check HTTP status code directly (set by callOpenRouterDirect)
  const status = error.status;
  if (status === 401 || status === 403 || status === 408 || (status >= 500 && status <= 599)) {
    return true;
  }

  const msg = error.message || '';
  // OpenRouter Clerk auth failures, gateway errors, network failures, timeouts
  return (
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('Bad Gateway') ||
    msg.includes('Clerk') ||
    msg.includes('Failed to fetch') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('socket hang up')
  );
}

const safeTokenCount = (value) => (
  Number.isInteger(value) && value >= 0 ? value : null
);

const buildResponseMetadata = ({ provider, modelId, usage = {}, reasoningTokens }) => ({
  provider,
  modelId,
  tokenUsage: {
    promptTokens: safeTokenCount(usage.prompt_tokens),
    completionTokens: safeTokenCount(usage.completion_tokens),
    totalTokens: safeTokenCount(usage.total_tokens),
    reasoningTokens: safeTokenCount(reasoningTokens),
  },
});

const formatResponse = ({ content, metadata }, options) => (
  options.includeResponseMetadata === true
    ? { text: content, metadata }
    : content
);

/**
 * Call OpenRouter API (primary provider)
 */
async function callOpenRouterDirect(modelType, model, messages, jsonSchema, options, controller) {
  const startTime = Date.now();
  const requestBody = {
    model,
    messages,
    temperature: options.temperature ?? 0,
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS[modelType] ?? 6144,
  };

  // Multimodal/file routing (e.g. file-parser for scanned-PDF OCR). Passed
  // through verbatim to OpenRouter; ignored by text-only requests.
  if (Array.isArray(options.plugins) && options.plugins.length > 0) {
    requestBody.plugins = options.plugins;
  }

  // Reasoning control:
  //  - 0    → disable thinking entirely (extraction-only features like parsing).
  //  - >0   → cap thinking tokens (exclude:true = used internally, not returned).
  //  - null → omit the field, leaving the model's default thinking behavior.
  if (options.reasoningBudget === 0) {
    requestBody.reasoning = { enabled: false };
  } else if (options.reasoningBudget != null) {
    requestBody.reasoning = {
      max_tokens: options.reasoningBudget,
      exclude: true
    };
  }

  if (options.responseFormat === 'json_object') {
    // Opt out of provider grammar-constrained decoding. OpenRouter's json_schema
    // structured output for google/gemini-2.5-flash-lite regressed to runaway
    // generation (finish_reason "length") on some inputs — strict, non-strict,
    // and fully-closed (additionalProperties:false everywhere) schemas all loop,
    // while json_object returns clean, complete, schema-valid JSON. Callers that
    // set this must enforce shape via their prompt + Zod outputSchema instead.
    requestBody.response_format = { type: 'json_object' };
  } else if (jsonSchema) {
    const convertedSchema = convertGoogleSchemaToOpenRouter(jsonSchema);
    requestBody.response_format = {
      type: 'json_schema',
      json_schema: {
        name: options.schemaName || 'response',
        strict: true,
        schema: convertedSchema
      }
    };
  } else {
    // Force JSON output even without strict schema if the prompt expects JSON
    requestBody.response_format = { type: 'json_object' };
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.SITE_URL || 'https://watheqai.app',
      'X-Title': 'Watheq Resume Optimizer'
    },
    body: JSON.stringify(requestBody),
    signal: controller.signal
  });

  if (!response.ok) {
    await response.json().catch(() => ({}));
    const error = new Error(`OpenRouter API error (${response.status})`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const content = choice?.message?.content;

  if (!content) {
    throw new Error('OpenRouter returned empty response');
  }

  // Log token usage up front (before the truncation guard) so a truncation
  // shows its reasoning-vs-completion split — i.e. whether thinking ate the
  // budget or the JSON output genuinely overran maxTokens.
  const usage = data.usage || {};
  const reasoning = usage.reasoning_tokens || usage.completion_tokens_details?.reasoning_tokens || 0;
  console.log(`[AI Client] Tokens — prompt: ${usage.prompt_tokens || 0}, completion: ${usage.completion_tokens || 0}, reasoning: ${reasoning}, total: ${usage.total_tokens || 0}`);

  // Fail loud on truncated output. A response cut off at max_tokens
  // (finish_reason "length") returns invalid, unterminated JSON that downstream
  // repair silently degrades into empty sections. Surface it as a distinct error
  // (not a gateway 5xx, so it does NOT trigger the Gemini fallback) instead of
  // returning a partial result.
  const finishReason = choice?.finish_reason || choice?.native_finish_reason;
  if (finishReason === 'length') {
    const error = new Error(`OpenRouter response truncated at max_tokens=${requestBody.max_tokens} for "${options.featureName || 'unknown'}". Increase the feature's maxTokens.`);
    error.name = 'TruncationError';
    error.code = 'AI_RESPONSE_TRUNCATED';
    throw error;
  }

  await recordUsageEvent({
    options,
    model,
    provider: 'openrouter',
    usage,
    reasoningTokens: reasoning,
    startTime,
    success: true,
  });

  return {
    content,
    metadata: buildResponseMetadata({
      provider: 'openrouter',
      modelId: model,
      usage,
      reasoningTokens: usage.reasoning_tokens
        ?? usage.completion_tokens_details?.reasoning_tokens,
    }),
  };
}

/**
 * Call Google Gemini API directly (fallback provider)
 * Uses REST API — no SDK dependency
 */
async function callGeminiDirect(modelType, messages, jsonSchema, options, controller) {
  const model = options.modelId || MODELS[modelType] || MODELS.flash;
  const geminiModel = toGeminiModelId(model, modelType);
  const url = `${GEMINI_BASE_URL}/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`;

  // Convert OpenAI-style messages to Gemini format
  const contents = [];
  let systemInstruction = null;

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = { parts: toGeminiParts(msg.content) };
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: toGeminiParts(msg.content)
      });
    }
  }

  const requestBody = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0,
      maxOutputTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS[modelType] ?? 6144,
    }
  };

  // Reasoning control (parity with the OpenRouter path):
  //  - 0    → disable thinking (thinkingBudget 0; valid for flash/flash-lite,
  //           NOT 2.5 Pro which requires min 128).
  //  - >0   → cap thinking tokens.
  //  - null → omit, leaving the model default.
  if (options.reasoningBudget != null) {
    requestBody.generationConfig.thinkingConfig = {
      thinkingBudget: options.reasoningBudget
    };
  }

  // Add system instruction if present
  if (systemInstruction) {
    requestBody.systemInstruction = systemInstruction;
  }

  // Add structured output via responseMimeType + responseSchema
  if (jsonSchema) {
    requestBody.generationConfig.responseMimeType = 'application/json';
    requestBody.generationConfig.responseSchema = jsonSchema;
  } else {
    // Force JSON output even without strict schema if the prompt expects JSON
    requestBody.generationConfig.responseMimeType = 'application/json';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    signal: controller.signal
  });

  if (!response.ok) {
    await response.json().catch(() => ({}));
    const error = new Error(`Gemini API error (${response.status})`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const content = candidate?.content?.parts?.[0]?.text;

  if (!content) {
    throw new Error('Gemini returned empty response');
  }

  // Log token usage before the truncation guard (parity with OpenRouter) so a
  // truncation shows its thinking-vs-output split.
  const gUsage = data.usageMetadata || {};
  console.log(`[AI Client] Tokens (Gemini) — prompt: ${gUsage.promptTokenCount || 0}, candidates: ${gUsage.candidatesTokenCount || 0}, thoughts: ${gUsage.thoughtsTokenCount || 0}, total: ${gUsage.totalTokenCount || 0}`);

  // Fail loud on truncated output (parity with the OpenRouter path).
  if (candidate?.finishReason === 'MAX_TOKENS') {
    const error = new Error(`Gemini response truncated at maxOutputTokens for "${options.featureName || 'unknown'}". Increase the feature's maxTokens.`);
    error.name = 'TruncationError';
    error.code = 'AI_RESPONSE_TRUNCATED';
    throw error;
  }

  return {
    content,
    metadata: buildResponseMetadata({
      provider: 'gemini',
      modelId: geminiModel,
      usage: {
        prompt_tokens: gUsage.promptTokenCount,
        completion_tokens: gUsage.candidatesTokenCount,
        total_tokens: gUsage.totalTokenCount,
      },
      reasoningTokens: gUsage.thoughtsTokenCount,
    }),
  };
}

/**
 * Call AI API with smart fallback
 *
 * Primary: OpenRouter (if OPENROUTER_API_KEY is set)
 * Fallback: Direct Google Gemini (if GEMINI_API_KEY is set and OpenRouter returns 502/503)
 *
 * @param {'lite' | 'flash'} modelType - Model tier to use
 * @param {Array} messages - Array of {role, content} messages
 * @param {Object} jsonSchema - Optional JSON schema for structured output
 * @param {Object} options - Additional options (temperature, maxTokens, timeoutMs, reasoningBudget, etc.)
 * @returns {Promise<string>} - Response text (JSON string if schema provided)
 */
export async function callOpenRouter(modelType, messages, jsonSchema = null, options = {}) {
  const model = options.modelId || MODELS[modelType] || MODELS.flash;
  const geminiModel = toGeminiModelId(model, modelType);
  const TIMEOUT_MS = options.timeoutMs ?? 40000;
  const deadlineAt = Date.now() + TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    if (options.disableFallback && !OPENROUTER_API_KEY) {
      throw new Error('OpenRouter execution requires OPENROUTER_API_KEY when fallback is disabled.');
    }

    // Strategy 1: Try OpenRouter (primary)
    if (OPENROUTER_API_KEY) {
      console.log(`[AI Client] PRIMARY: OpenRouter ${model} (${messages.length} msgs, timeout: ${TIMEOUT_MS}ms)`);

      const openRouterStartTime = Date.now();
      try {
        const result = await callOpenRouterDirect(modelType, model, messages, jsonSchema, options, controller);
        console.log(`[AI Client] OpenRouter success (${result.content.length} chars)`);
        return formatResponse(result, options);
      } catch (openRouterError) {
        await recordUsageEvent({
          options,
          model,
          provider: 'openrouter',
          startTime: openRouterStartTime,
          success: false,
          errorCode: openRouterError.status?.toString?.() || openRouterError.name || 'unknown',
        });

        // Do NOT fall back to Gemini on a truncation. Re-parsing the full resume
        // on a second provider is another multi-second generation that, stacked
        // after the truncated attempt, overran the 30s function limit in
        // production (→ a hard 500 before any result could be returned). A
        // truncation is not a provider outage, so we throw it fast: parse_resume
        // callers recover deterministically from the already-extracted raw text,
        // and other callers surface the truncation directly. Gemini fallback is
        // reserved for genuine provider failures (5xx / auth / network / timeout).
        if (!options.disableFallback && GEMINI_API_KEY && isFallbackEligible(openRouterError)) {
          console.warn('[AI Client] OpenRouter failed, falling back to Gemini direct:', summarizeErrorForLog(openRouterError));
          // Use the original call deadline. A fallback must never double the
          // configured timeout and overrun the hosting function's hard limit.
          clearTimeout(timeoutId);
          const remainingMs = deadlineAt - Date.now();
          if (remainingMs <= 0) throw openRouterError;
          const fallbackController = new AbortController();
          const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), remainingMs);

          const geminiStartTime = Date.now();
          try {
            const result = await callGeminiDirect(modelType, messages, jsonSchema, options, fallbackController);
            await recordUsageEvent({
              options,
              model: geminiModel,
              provider: 'gemini',
              startTime: geminiStartTime,
              success: true,
            });
            console.log(`[AI Client] Gemini fallback success (${result.content.length} chars)`);
            return formatResponse(result, options);
          } catch (geminiError) {
            await recordUsageEvent({
              options,
              model: geminiModel,
              provider: 'gemini',
              startTime: geminiStartTime,
              success: false,
              errorCode: geminiError.status?.toString?.() || geminiError.name || 'unknown',
            });
            console.error('[AI Client] Gemini fallback also failed:', summarizeErrorForLog(geminiError));
            // Throw original OpenRouter error (more informative)
            throw openRouterError;
          } finally {
            clearTimeout(fallbackTimeoutId);
          }
        }

        // No fallback available or error not eligible — log why and re-throw
        if (options.disableFallback) {
          console.warn('[AI Client] OpenRouter fallback disabled; re-throwing OpenRouter error:', summarizeErrorForLog(openRouterError));
        } else if (!GEMINI_API_KEY) {
          console.warn('[AI Client] No GEMINI_API_KEY set — cannot fall back from OpenRouter error:', summarizeErrorForLog(openRouterError));
        } else {
          console.warn('[AI Client] OpenRouter error not fallback-eligible:', summarizeErrorForLog(openRouterError));
        }
        throw openRouterError;
      }
    }

    // Strategy 2: Gemini-only (no OpenRouter key)
    if (GEMINI_API_KEY) {
      console.log(`[AI Client] DIRECT: Gemini ${geminiModel} (${messages.length} msgs, timeout: ${TIMEOUT_MS}ms)`);
      const geminiStartTime = Date.now();
      try {
        const result = await callGeminiDirect(modelType, messages, jsonSchema, options, controller);
        await recordUsageEvent({
          options,
          model: geminiModel,
          provider: 'gemini',
          startTime: geminiStartTime,
          success: true,
        });
        console.log(`[AI Client] Gemini success (${result.content.length} chars)`);
        return formatResponse(result, options);
      } catch (geminiError) {
        await recordUsageEvent({
          options,
          model: geminiModel,
          provider: 'gemini',
          startTime: geminiStartTime,
          success: false,
          errorCode: geminiError.status?.toString?.() || geminiError.name || 'unknown',
        });
        throw geminiError;
      }
    }

    throw new Error('No AI provider configured. Set OPENROUTER_API_KEY or GEMINI_API_KEY.');

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`[AI Client] Request timed out after ${TIMEOUT_MS}ms`);
      const timeoutError = new Error(`AI request timed out after ${TIMEOUT_MS}ms. The AI service may be experiencing high load. This is automatically retried on the client.`);
      timeoutError.name = 'TimeoutError';
      timeoutError.status = 504;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export { MODELS, DEFAULT_MAX_TOKENS };
