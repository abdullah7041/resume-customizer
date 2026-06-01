export class AiContractError extends Error {
  constructor(message, {
    contractId = 'unknown',
    code = 'AI_CONTRACT_ERROR',
    status = 502,
    retryable = true,
    cause = undefined,
  } = {}) {
    super(message);
    this.name = 'AiContractError';
    this.contractId = contractId;
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    if (cause) this.cause = cause;
  }
}

export function toAiContractError(error, contractId, fallbackMessage = 'AI response did not match the expected contract.') {
  if (error instanceof AiContractError) return error;

  return new AiContractError(fallbackMessage, {
    contractId,
    code: 'AI_CONTRACT_VALIDATION_FAILED',
    status: 502,
    retryable: true,
    cause: error,
  });
}
