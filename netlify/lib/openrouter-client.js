/**
 * AI API Client with Smart Fallback
 * Primary: OpenRouter API (cost-effective, unified quota)
 * Fallback: Direct Google Gemini API (when OpenRouter returns 502/503)
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Model mapping: Internal names → provider-specific model IDs
const MODELS = {
  lite: 'google/gemini-2.5-flash-lite',
  flash: 'google/gemini-2.5-flash'
};

// Direct Google model IDs (without the google/ prefix)
const GEMINI_MODELS = {
  lite: 'gemini-2.5-flash-lite',
  flash: 'gemini-2.5-flash'
};

if (!OPENROUTER_API_KEY && !GEMINI_API_KEY) {
  console.error('[AI Client] Error: Neither OPENROUTER_API_KEY nor GEMINI_API_KEY is set');
}

/**
 * Convert Google AI SDK JSON Schema format to OpenRouter format
 */
function convertGoogleSchemaToOpenRouter(googleSchema) {
  const schema = JSON.parse(JSON.stringify(googleSchema));
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

/**
 * Call OpenRouter API (primary provider)
 */
async function callOpenRouterDirect(model, messages, jsonSchema, options, controller) {
  const requestBody = {
    model,
    messages,
    temperature: options.temperature ?? 0,
    max_tokens: options.maxTokens ?? 16384,
  };

  if (jsonSchema) {
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
      'HTTP-Referer': process.env.SITE_URL || 'https://watheq.netlify.app',
      'X-Title': 'Watheq Resume Optimizer'
    },
    body: JSON.stringify(requestBody),
    signal: controller.signal
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(`OpenRouter API error (${response.status}): ${errorData.error?.message || response.statusText}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('OpenRouter returned empty response');
  }

  return content;
}

/**
 * Call Google Gemini API directly (fallback provider)
 * Uses REST API — no SDK dependency
 */
async function callGeminiDirect(modelType, messages, jsonSchema, options, controller) {
  const geminiModel = GEMINI_MODELS[modelType] || GEMINI_MODELS.flash;
  const url = `${GEMINI_BASE_URL}/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`;

  // Convert OpenAI-style messages to Gemini format
  const contents = [];
  let systemInstruction = null;

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = { parts: [{ text: msg.content }] };
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }
  }

  const requestBody = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0,
      maxOutputTokens: options.maxTokens ?? 16384,
    }
  };

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
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Gemini API error (${response.status}): ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new Error('Gemini returned empty response');
  }

  return content;
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
 * @param {Object} options - Additional options (temperature, maxTokens, timeoutMs, etc.)
 * @returns {Promise<string>} - Response text (JSON string if schema provided)
 */
export async function callOpenRouter(modelType, messages, jsonSchema = null, options = {}) {
  const model = MODELS[modelType] || MODELS.flash;
  const TIMEOUT_MS = options.timeoutMs ?? 40000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Strategy 1: Try OpenRouter (primary)
    if (OPENROUTER_API_KEY) {
      console.log(`[AI Client] PRIMARY: OpenRouter ${model} (${messages.length} msgs, timeout: ${TIMEOUT_MS}ms)`);

      try {
        const content = await callOpenRouterDirect(model, messages, jsonSchema, options, controller);
        console.log(`[AI Client] OpenRouter success (${content.length} chars)`);
        return content;
      } catch (openRouterError) {
        // If fallback is available and error is eligible, try Gemini
        if (GEMINI_API_KEY && isFallbackEligible(openRouterError)) {
          console.warn(`[AI Client] OpenRouter failed (${openRouterError.message}), falling back to Gemini direct`);
          // Reset abort controller for fallback (create new one with remaining time)
          clearTimeout(timeoutId);
          const fallbackController = new AbortController();
          const remainingMs = Math.max(TIMEOUT_MS - 5000, 10000); // At least 10s for fallback
          const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), remainingMs);

          try {
            const content = await callGeminiDirect(modelType, messages, jsonSchema, options, fallbackController);
            console.log(`[AI Client] Gemini fallback success (${content.length} chars)`);
            return content;
          } catch (geminiError) {
            console.error(`[AI Client] Gemini fallback also failed:`, geminiError.message);
            // Throw original OpenRouter error (more informative)
            throw openRouterError;
          } finally {
            clearTimeout(fallbackTimeoutId);
          }
        }

        // No fallback available or error not eligible — log why and re-throw
        if (!GEMINI_API_KEY) {
          console.warn(`[AI Client] No GEMINI_API_KEY set — cannot fall back from OpenRouter error: ${openRouterError.message}`);
        } else {
          console.warn(`[AI Client] OpenRouter error not fallback-eligible (status: ${openRouterError.status}): ${openRouterError.message}`);
        }
        throw openRouterError;
      }
    }

    // Strategy 2: Gemini-only (no OpenRouter key)
    if (GEMINI_API_KEY) {
      console.log(`[AI Client] DIRECT: Gemini ${GEMINI_MODELS[modelType]} (${messages.length} msgs, timeout: ${TIMEOUT_MS}ms)`);
      const content = await callGeminiDirect(modelType, messages, jsonSchema, options, controller);
      console.log(`[AI Client] Gemini success (${content.length} chars)`);
      return content;
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

export { MODELS };
