/**
 * Onboarding slot extraction — one freeform reply → one structured slot value.
 *
 * Stateless and guest-friendly (onboarding completes for guests; persistence is
 * gated behind sign-in elsewhere). The LLM is called ONCE per answer, only to parse
 * a single slot. No multi-turn agent loop — that keeps us debuggable and well under
 * the 30s function limit.
 *
 *   POST /api/onboard-extract
 *   body: { slot, userText, currentIntent? }
 *   resp: { value: <slot-shaped JSON>, confidence: 'low'|'medium'|'high' }
 */
import { Handler } from '@netlify/functions';
import { callOpenRouter } from '../lib/openrouter-client.js';
import { withRateLimit } from '../lib/rate-limiter.js';
import { OnboardExtractRequestSchema, formatZodError } from '../lib/resume-schemas.js';
import { initSentry, captureError, summarizeErrorForLog } from '../lib/sentry.js';

initSentry();

type SlotConfidence = 'low' | 'medium' | 'high';

// Each slot schema is fully-required with empty/zero sentinels so it satisfies
// OpenRouter strict structured output without optional-field gymnastics. Real
// optionality is restored by normalizeSlotValue() below (empty → omitted).
const SLOT_SCHEMAS: Record<string, object> = {
  cv_basics: {
    type: 'object',
    properties: {
      value: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          label: { type: 'string' },
          achievements: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'label', 'achievements'],
      },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    },
    required: ['value', 'confidence'],
  },
  role: {
    type: 'object',
    properties: {
      value: {
        type: 'object',
        properties: {
          targetRoles: { type: 'array', items: { type: 'string' } },
          seniority: { type: 'string', enum: ['', 'junior', 'mid', 'senior', 'lead', 'manager'] },
        },
        required: ['targetRoles', 'seniority'],
      },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    },
    required: ['value', 'confidence'],
  },
  location: {
    type: 'object',
    properties: {
      value: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          country: { type: 'string' },
          workMode: { type: 'string', enum: ['', 'remote', 'hybrid', 'onsite'] },
        },
        required: ['city', 'country', 'workMode'],
      },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    },
    required: ['value', 'confidence'],
  },
};

const SLOT_INSTRUCTIONS: Record<string, string> = {
  cv_basics:
    'Extract the person\'s full name into "name", their current/target job title into "label", and up to two concrete things they have done into "achievements" (each a short phrase). Leave a field as an empty string / empty array if the answer does not contain it. Do not invent details.',
  role:
    'Extract the target job role(s) the person wants into "targetRoles" (usually one, at most a few). Infer "seniority" only if the role text clearly states it (e.g. "senior", "lead", "manager"); otherwise return an empty string. Do not invent a seniority.',
  location:
    'Extract the preferred work "city" and "country" (use the country code like "SA" when obvious). Set "workMode" to remote, hybrid, or onsite if stated, else empty string. Leave city/country empty if not stated.',
};

function normalizeConfidence(value: unknown): SlotConfidence {
  return value === 'low' || value === 'medium' || value === 'high' ? value : 'low';
}

/**
 * Strip empty sentinels so the returned value is the real partial slot shape the
 * store/component merges into searchIntent (or the resume, for cv_basics).
 */
function normalizeSlotValue(slot: string, raw: unknown): Record<string, unknown> {
  const v = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};

  if (slot === 'cv_basics') {
    const out: Record<string, unknown> = {};
    if (typeof v.name === 'string' && v.name.trim()) out.name = v.name.trim();
    if (typeof v.label === 'string' && v.label.trim()) out.label = v.label.trim();
    const achievements = Array.isArray(v.achievements)
      ? v.achievements.filter((a): a is string => typeof a === 'string' && a.trim().length > 0).slice(0, 2)
      : [];
    if (achievements.length) out.achievements = achievements;
    return out;
  }

  if (slot === 'role') {
    const out: Record<string, unknown> = {};
    out.targetRoles = Array.isArray(v.targetRoles)
      ? v.targetRoles.filter((r): r is string => typeof r === 'string' && r.trim().length > 0).slice(0, 10)
      : [];
    if (v.seniority && ['junior', 'mid', 'senior', 'lead', 'manager'].includes(v.seniority as string)) {
      out.seniority = v.seniority;
    }
    return out;
  }

  if (slot === 'location') {
    const workMode = v.workMode === 'remote' || v.workMode === 'hybrid' || v.workMode === 'onsite'
      ? v.workMode
      : 'onsite';
    const location: Record<string, unknown> = { workMode };
    if (typeof v.city === 'string' && v.city.trim()) location.city = v.city.trim();
    if (typeof v.country === 'string' && v.country.trim()) location.country = v.country.trim();
    return { location };
  }

  return {};
}

const baseHandler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ status: 405, code: 'method_not_allowed', message: 'Method Not Allowed' }) };
  }

  try {
    const rawBody = JSON.parse(event.body || '{}');
    const parseResult = OnboardExtractRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 400, code: 'invalid_request', message: formatZodError(parseResult.error) }),
      };
    }

    const { slot, userText, currentIntent } = parseResult.data;

    const intentContext = currentIntent
      ? `\nKnown so far (do not contradict it): ${JSON.stringify({
          targetRoles: currentIntent.targetRoles,
          seniority: currentIntent.seniority,
          location: currentIntent.location,
        })}`
      : '';

    const system = `You parse ONE field of a job seeker's onboarding answer into JSON. Extract only what the text states. Never invent facts. Report "confidence" as low when the answer is vague or you had to guess.`;
    const user = `${SLOT_INSTRUCTIONS[slot]}${intentContext}\n\nThe user's answer:\n"""${userText}"""`;

    console.log(`[OnboardExtract] slot=${slot} textLen=${userText.length}`);

    const content = await callOpenRouter(
      'lite',
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      SLOT_SCHEMAS[slot],
      {
        reasoningBudget: 0,
        maxTokens: 1024,
        timeoutMs: 15000,
        featureName: 'onboard_extract',
        schemaName: 'onboard_slot',
      },
    );

    let parsed: { value?: unknown; confidence?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw Object.assign(new Error('AI returned non-JSON for onboarding slot'), {
        status: 502,
        code: 'onboard/parse_failed',
      });
    }

    const value = normalizeSlotValue(slot, parsed.value);
    const confidence = normalizeConfidence(parsed.confidence);

    console.log(`[OnboardExtract] slot=${slot} confidence=${confidence} keys=${Object.keys(value).join(',') || 'none'}`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value, confidence }),
    };
  } catch (error: unknown) {
    console.error('[OnboardExtract] Error:', summarizeErrorForLog(error));
    const err = error as { status?: number; code?: string; name?: string; message?: string };
    const isTimeout = err?.name === 'TimeoutError' || err?.status === 504;
    if (!isTimeout) {
      captureError(error, { function: 'onboard-extract' });
    }
    const status = err?.status && err.status >= 400 && err.status <= 599 ? err.status : 500;
    return {
      statusCode: isTimeout ? 504 : status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: isTimeout ? 504 : status,
        code: err?.code || (isTimeout ? 'onboard/timeout' : 'onboard/failed'),
        message: isTimeout ? 'Slot extraction timed out. Please try again.' : 'Failed to extract onboarding slot',
        retryable: isTimeout,
      }),
    };
  }
};

export const handler = withRateLimit('onboard-extract', baseHandler);
