import { callOpenRouter } from '../openrouter-client.js';
import { summarizeErrorForLog } from '../sentry.js';
import { getAiContract } from './contracts/index.js';
import { AiContractError, toAiContractError } from './errors.js';
import { parseAiJson } from './json.js';
import { emptyRagContextProvider } from './rag-context.js';

async function resolveRetrievedContext(contractId, input, options) {
  const provider = options.contextProvider || emptyRagContextProvider;
  if (!provider || typeof provider.getContext !== 'function') {
    return { documents: [], citations: [] };
  }
  return provider.getContext({ contractId, input });
}

function buildCallOptions(contract, options) {
  const timeoutMs = Number.isFinite(options.timeoutMs)
    ? Math.min(contract.timeoutMs, options.timeoutMs)
    : contract.timeoutMs;

  return {
    temperature: contract.temperature,
    maxTokens: contract.maxTokens,
    timeoutMs,
    reasoningBudget: contract.reasoningBudget,
    schemaName: contract.schemaName,
    featureName: options.featureName || contract.featureName,
    responseFormat: contract.responseFormat,
    modelId: options.modelId,
    disableFallback: options.disableFallback === true,
    includeResponseMetadata: options.includeResponseMetadata === true,
    userRef: options.userRef,
    // Telemetry options map to user_ref / jd_fingerprint at the logger boundary.
    jdFingerprint: options.jdFingerprint,
  };
}

export async function executeAiContract(contractId, input, options = {}) {
  const contract = getAiContract(contractId);
  const retrievedContext = await resolveRetrievedContext(contractId, input, options);
  const messages = contract.buildMessages(input, {
    ...options,
    retrievedContext,
  });
  const callOptions = buildCallOptions(contract, options);

  try {
    const response = await callOpenRouter(
      contract.modelType,
      messages,
      contract.jsonSchema,
      callOptions,
    );
    const text = typeof response === 'string' ? response : response?.text;
    const parsed = parseAiJson(text, contractId);
    const validation = contract.outputSchema.safeParse(parsed);
    if (!validation.success) {
      console.warn(`[AI Contract:${contractId}] Output validation failed:`, {
        issues: validation.error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      throw new AiContractError('AI response did not match the expected contract.', {
        contractId,
        code: 'AI_CONTRACT_VALIDATION_FAILED',
        status: 502,
        retryable: true,
        cause: validation.error,
      });
    }
    const data = contract.transform
      ? contract.transform(validation.data, input, options)
      : validation.data;
    return options.includeResponseMetadata === true
      ? {
        data,
        metadata: typeof response === 'object' ? response.metadata ?? null : null,
      }
      : data;
  } catch (error) {
    if (error instanceof AiContractError) throw error;
    if (error?.name === 'TimeoutError' || error?.status === 504) throw error;

    console.error(`[AI Contract:${contractId}] Execution failed:`, summarizeErrorForLog(error));
    throw toAiContractError(error, contractId);
  }
}

export { getAiContract };
