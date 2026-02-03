/**
 * OpenRouter API Client for Gemini Models
 * Replaces Google AI SDK with OpenRouter for gemini-2.5-flash and gemini-2.5-flash-lite
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Model mapping: Internal names → OpenRouter model IDs
const MODELS = {
  lite: 'google/gemini-2.5-flash-lite',
  flash: 'google/gemini-2.5-flash'
};

if (!OPENROUTER_API_KEY) {
  console.error('[OpenRouter] Error: OPENROUTER_API_KEY is not set');
}

/**
 * Convert Google AI SDK JSON Schema format to OpenRouter format
 * Google AI uses SchemaType enums, OpenRouter uses standard JSON Schema
 */
function convertGoogleSchemaToOpenRouter(googleSchema) {
  // Deep clone to avoid mutating the original
  const schema = JSON.parse(JSON.stringify(googleSchema));

  // OpenRouter requires these top-level properties
  return {
    type: schema.type || 'object',
    properties: schema.properties || {},
    required: schema.required || [],
    additionalProperties: false  // Strict mode
  };
}

/**
 * Call OpenRouter API with structured output support
 *
 * @param {'lite' | 'flash'} modelType - Model to use
 * @param {Array} messages - Array of {role, content} messages
 * @param {Object} jsonSchema - Optional JSON schema for structured output
 * @param {Object} options - Additional options (temperature, maxTokens, timeoutMs, etc.)
 * @returns {Promise<string>} - Response text (JSON string if schema provided)
 */
export async function callOpenRouter(modelType, messages, jsonSchema = null, options = {}) {
  const model = MODELS[modelType] || MODELS.flash;

  // Timeout configuration: 40s default (provides buffer for 60s Netlify timeout)
  // Can be overridden via options.timeoutMs for functions with longer Netlify timeouts
  const TIMEOUT_MS = options.timeoutMs ?? 40000;

  const requestBody = {
    model,
    messages,
    temperature: options.temperature ?? 0,
    max_tokens: options.maxTokens ?? 16384,
  };

  // Add structured output if schema provided
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
  }

  console.log(`[OpenRouter] Calling ${model} with ${messages.length} messages${jsonSchema ? ' (structured output)' : ''} (timeout: ${TIMEOUT_MS}ms)`);

  // AbortController for timeout protection
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
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
      throw new Error(`OpenRouter API error (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    // Extract content from response
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('OpenRouter returned empty response');
    }

    console.log(`[OpenRouter] Response received (${content.length} chars)`);

    return content;

  } catch (error) {
    // Handle timeout errors specifically
    if (error.name === 'AbortError') {
      console.error(`[OpenRouter] Request timed out after ${TIMEOUT_MS}ms`);
      const timeoutError = new Error(`OpenRouter API request timed out after ${TIMEOUT_MS}ms. The AI service may be experiencing high load. This is automatically retried on the client.`);
      timeoutError.name = 'TimeoutError';
      timeoutError.status = 504;
      throw timeoutError;
    }

    console.error('[OpenRouter] API call failed:', error);
    throw error;
  } finally {
    // Always clear timeout to prevent memory leaks
    clearTimeout(timeoutId);
  }
}

export { MODELS };
