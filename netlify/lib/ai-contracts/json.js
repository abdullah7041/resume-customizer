import { summarizeErrorForLog } from '../sentry.js';
import { AiContractError } from './errors.js';

export function parseAiJson(text, contractId = 'unknown') {
  if (typeof text !== 'string') {
    throw new AiContractError('AI response was not text.', {
      contractId,
      code: 'AI_CONTRACT_NON_TEXT_RESPONSE',
      status: 502,
    });
  }

  let cleaned = text
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (parseError) {
    console.warn(`[AI Contract:${contractId}] JSON parse failed, attempting repair:`, summarizeErrorForLog(parseError));
  }

  // eslint-disable-next-line no-control-regex
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
  cleaned = cleaned.replace(/\\([^"\\/bfnrtu])/g, '\\\\$1');

  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escaped = false;
  let lastValidEnd = -1;

  for (let index = 0; index < cleaned.length; index++) {
    const char = cleaned[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') braceCount++;
      if (char === '}') {
        braceCount--;
        lastValidEnd = index;
      }
      if (char === '[') bracketCount++;
      if (char === ']') {
        bracketCount--;
        lastValidEnd = index;
      }
    }
  }

  if (!inString && lastValidEnd > 0 && lastValidEnd < cleaned.length - 1) {
    cleaned = cleaned.substring(0, lastValidEnd + 1);
  }

  if (inString) cleaned += '"';
  cleaned = cleaned.replace(/,\s*$/, '');

  while (bracketCount > 0) {
    cleaned += ']';
    bracketCount--;
  }
  while (braceCount > 0) {
    cleaned += '}';
    braceCount--;
  }

  try {
    return JSON.parse(cleaned);
  } catch (repairError) {
    console.error(`[AI Contract:${contractId}] JSON repair failed:`, {
      length: text.length,
      startsWithBrace: text.trim().startsWith('{'),
      endsWithBrace: text.trim().endsWith('}'),
      error: summarizeErrorForLog(repairError),
    });
    throw new AiContractError('Failed to parse AI response JSON.', {
      contractId,
      code: 'AI_CONTRACT_JSON_PARSE_FAILED',
      status: 502,
      retryable: true,
      cause: repairError,
    });
  }
}
