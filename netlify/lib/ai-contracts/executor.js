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
  return {
    temperature: options.temperature ?? contract.temperature,
    maxTokens: options.maxTokens ?? contract.maxTokens,
    timeoutMs: options.timeoutMs ?? contract.timeoutMs,
    reasoningBudget: options.reasoningBudget ?? contract.reasoningBudget,
    schemaName: options.schemaName || contract.schemaName,
    featureName: options.featureName || contract.featureName,
    responseFormat: options.responseFormat ?? contract.responseFormat,
    modelId: options.modelId,
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
    const text = await callOpenRouter(
      contract.modelType,
      messages,
      contract.jsonSchema,
      callOptions,
    );
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
    return contract.transform
      ? contract.transform(validation.data, input, options)
      : validation.data;
  } catch (error) {
    if (error instanceof AiContractError) throw error;
    if (error?.name === 'TimeoutError' || error?.status === 504) throw error;

    console.error(`[AI Contract:${contractId}] Execution failed:`, summarizeErrorForLog(error));
    throw toAiContractError(error, contractId);
  }
}

export { getAiContract };
