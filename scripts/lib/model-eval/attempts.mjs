const PROVIDERS = new Set(['openrouter', 'gemini', 'cache']);
const FAILURE_REASONS = new Set([
  'malformed_json',
  'timeout',
  'provider_unavailable',
  'schema_invalid',
  'skipped',
  'contract_error',
  'request_error',
  'unknown_error',
]);

const hasReason = (reason, expected) => reason === expected;

export const classifyAttempt = (attempt) => {
  if (!attempt || typeof attempt !== 'object') {
    throw new TypeError('Attempt metadata is required.');
  }
  if (!PROVIDERS.has(attempt.provider)) {
    throw new TypeError('Attempt provider must be openrouter, gemini, or cache.');
  }
  if (attempt.failureReason != null && !FAILURE_REASONS.has(attempt.failureReason)) {
    throw new TypeError('Attempt failureReason must be a durable machine-readable code.');
  }

  const failureReason = attempt.failureReason ?? null;
  const fallbackUsed = attempt.provider === 'gemini';
  const cacheUsed = attempt.provider === 'cache' || attempt.cacheUsed === true;
  const skipped = attempt.skipped === true || hasReason(failureReason, 'skipped');
  const malformedJson = hasReason(failureReason, 'malformed_json');
  const timeout = hasReason(failureReason, 'timeout');
  const providerUnavailable = hasReason(failureReason, 'provider_unavailable');
  const schemaValid = attempt.schemaValid === true;
  const failureReasons = [];

  if (skipped) failureReasons.push('skipped');
  if (cacheUsed) failureReasons.push('cache_used');
  if (fallbackUsed) failureReasons.push('fallback_used');
  if (malformedJson) failureReasons.push('malformed_json');
  if (timeout) failureReasons.push('timeout');
  if (providerUnavailable) failureReasons.push('provider_unavailable');
  if (failureReason && !failureReasons.includes(failureReason)) failureReasons.push(failureReason);
  if (!schemaValid && !skipped && !malformedJson && !timeout && !providerUnavailable) {
    failureReasons.push('schema_invalid');
  }

  const primarySuccess = attempt.provider === 'openrouter'
    && schemaValid
    && !cacheUsed
    && !skipped
    && !failureReason;

  return {
    provider: attempt.provider,
    fallbackUsed,
    schemaValid,
    malformedJson,
    timeout,
    providerUnavailable,
    cacheUsed,
    skipped,
    primarySuccess,
    failureReasons,
  };
};

export const isConfirmationFailure = (attemptOrClassification) => {
  const classification = Object.hasOwn(attemptOrClassification ?? {}, 'primarySuccess')
    ? attemptOrClassification
    : classifyAttempt(attemptOrClassification);

  return classification.primarySuccess !== true;
};
