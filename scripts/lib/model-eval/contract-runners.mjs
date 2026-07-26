import { getAiContract } from '../../../netlify/lib/ai-contracts/contracts/index.js';

import { classifyAttempt } from './attempts.mjs';

export const FEATURE_CONTRACT_ALIASES = Object.freeze({
  'truth-check': 'resume_truth_check',
  'cover-letter': 'cover_letter',
  interview: 'interview_prep',
  clarification: 'clarification_questions',
  metadata: 'job_metadata_extraction',
});

const METADATA_FIELDS = [
  'companyName',
  'jobTitle',
  'location',
  'employmentType',
  'seniority',
  'sector',
];

const emptyRetrievedContext = () => ({ documents: [], citations: [] });

const fixtureIdFor = (fixture) => (
  fixture?.id
  || fixture?._file
  || fixture?.name
  || 'unknown_fixture'
);

const asStringArray = (value) => {
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
};

const normalized = (value) => (
  typeof value === 'string'
    ? value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
    : ''
);

const includesText = (haystack, needle) => {
  const normalizedNeedle = normalized(needle);
  return normalizedNeedle.length > 0 && normalized(haystack).includes(normalizedNeedle);
};

const coverageFor = (terms, text) => {
  if (terms.length === 0) return 1;
  return terms.filter((term) => includesText(text, term)).length / terms.length;
};

const scoreChecks = (checks) => {
  const failureReasons = [...new Set(checks.filter((check) => !check.pass).map((check) => check.reason))];
  return {
    score: checks.length === 0
      ? 100
      : Math.round((checks.filter((check) => check.pass).length / checks.length) * 100),
    qualityPassed: failureReasons.length === 0,
    failureReasons,
  };
};

const featureExpectation = (fixture, feature) => {
  const expected = fixture?.expected;
  if (!expected || typeof expected !== 'object') return {};
  if (feature === 'truth-check') return expected.truthCheck ?? expected['truth-check'] ?? {};
  if (feature === 'cover-letter') return expected.coverLetter ?? expected['cover-letter'] ?? {};
  return expected[feature] ?? {};
};

export const buildContractInput = (feature, fixture) => {
  if (!fixture || typeof fixture !== 'object') {
    throw new TypeError('A benchmark fixture is required.');
  }
  const language = fixture.language === 'ar' ? 'ar' : 'en';

  if (feature === 'truth-check') {
    return {
      resumeText: fixture.resumeText,
      language,
      userHardStops: Array.isArray(fixture.userHardStops) ? fixture.userHardStops : [],
    };
  }
  if (feature === 'cover-letter') {
    return {
      resumeText: fixture.resumeText,
      jobDescription: fixture.jobDescription,
      language,
      tone: fixture.tone ?? 'professional',
    };
  }
  if (feature === 'interview') {
    return {
      resumeText: fixture.resumeText,
      jobDescription: fixture.jobDescription,
      questionType: fixture.questionType ?? 'mixed',
      vulnerabilities: Array.isArray(fixture.vulnerabilities) ? fixture.vulnerabilities : [],
      language,
    };
  }
  if (feature === 'clarification') {
    return {
      resumeText: fixture.resumeText,
      jobText: fixture.jobDescription,
      language,
    };
  }
  if (feature === 'metadata') {
    return {
      jobText: fixture.jobDescription,
      language,
    };
  }
  throw new TypeError(`Feature "${feature}" does not have a direct benchmark contract.`);
};

const scoreTruthCheck = (output, fixture) => {
  const resumeText = fixture.resumeText ?? '';
  const claims = Array.isArray(output.claims) ? output.claims : [];
  const expected = featureExpectation(fixture, 'truth-check');
  const requiredClaimTerms = asStringArray(expected.requiredClaimTerms);
  const requiredRiskTypes = asStringArray(expected.requiredRiskTypes);
  const requiredEvidenceStatuses = asStringArray(expected.requiredEvidenceStatuses);
  const evidence = claims.flatMap((claim) => (
    Array.isArray(claim.visibleEvidence) ? claim.visibleEvidence : []
  ));
  const traceableEvidence = evidence.filter((snippet) => includesText(resumeText, snippet)).length;
  const traceableClaims = claims.filter((claim) => includesText(resumeText, claim.claimText)).length;
  const claimText = claims.map((claim) => claim.claimText).join('\n');
  const riskTypes = claims.flatMap((claim) => claim.riskTypes ?? []).join('\n');
  const evidenceStatuses = claims.map((claim) => claim.evidenceStatus).join('\n');
  const evidenceCoverage = evidence.length === 0
    ? (claims.length === 0 ? 1 : 0)
    : traceableEvidence / evidence.length;
  const checks = [
    {
      pass: traceableClaims === claims.length,
      reason: 'untraceable_claim_text',
    },
    {
      pass: evidenceCoverage === 1,
      reason: 'untraceable_visible_evidence',
    },
    {
      pass: coverageFor(requiredClaimTerms, claimText) === 1,
      reason: 'missing_truth_check_claim',
    },
    {
      pass: coverageFor(requiredRiskTypes, riskTypes) === 1,
      reason: 'missing_truth_check_flag',
    },
    {
      pass: coverageFor(requiredEvidenceStatuses, evidenceStatuses) === 1,
      reason: 'missing_truth_check_evidence_status',
    },
  ];

  return {
    ...scoreChecks(checks),
    metrics: {
      claimCount: claims.length,
      traceableClaimCount: traceableClaims,
      evidenceCoverage,
      requiredClaimCoverage: coverageFor(requiredClaimTerms, claimText),
      requiredFlagCoverage: coverageFor(requiredRiskTypes, riskTypes),
      requiredStatusCoverage: coverageFor(requiredEvidenceStatuses, evidenceStatuses),
    },
  };
};

const outputMetrics = (text) => (
  normalized(text).match(/\b\d+(?:[.,]\d+)?\s*%|\$\s*\d+(?:[.,]\d+)?(?:k|m|b)?\b/gu) ?? []
);

const unsupportedCoverLetterClaims = (draft, fixture, expected) => {
  const source = `${fixture.resumeText ?? ''}\n${fixture.jobDescription ?? ''}`;
  const unsupported = asStringArray(expected.unsupportedClaimTerms)
    .filter((term) => includesText(draft, term));
  const sourceMetrics = new Set(outputMetrics(source));
  for (const metric of outputMetrics(draft)) {
    if (!sourceMetrics.has(metric)) unsupported.push(metric);
  }
  for (const credential of ['phd', 'mba', 'pmp', 'aws certified', 'scrum master']) {
    if (includesText(draft, credential) && !includesText(source, credential)) {
      unsupported.push(credential);
    }
  }
  return [...new Set(unsupported)];
};

const scoreCoverLetter = (output, fixture) => {
  const draft = output.draft_text ?? '';
  const expected = featureExpectation(fixture, 'cover-letter');
  const employerTerms = asStringArray(expected.requiredEmployer);
  const roleTerms = asStringArray(expected.requiredRole);
  const evidenceTerms = asStringArray(expected.requiredEvidenceTerms);
  const unsupportedClaims = unsupportedCoverLetterClaims(draft, fixture, expected);
  const paragraphs = draft.split(/\n\s*\n/u).filter((paragraph) => paragraph.trim());
  const employerCoverage = coverageFor(employerTerms, draft);
  const roleCoverage = coverageFor(roleTerms, draft);
  const evidenceCoverage = coverageFor(evidenceTerms, draft);
  const checks = [
    { pass: normalized(draft).length > 0, reason: 'empty_cover_letter' },
    { pass: paragraphs.length >= 3 && paragraphs.length <= 4, reason: 'invalid_cover_letter_paragraph_count' },
    { pass: employerCoverage === 1, reason: 'missing_required_employer' },
    { pass: roleCoverage === 1, reason: 'missing_required_role' },
    { pass: evidenceCoverage === 1, reason: 'missing_required_cover_letter_evidence' },
    { pass: unsupportedClaims.length === 0, reason: 'unsupported_cover_letter_claim' },
  ];

  return {
    ...scoreChecks(checks),
    metrics: {
      paragraphCount: paragraphs.length,
      employerCoverage,
      roleCoverage,
      evidenceCoverage,
      unsupportedClaimFlags: unsupportedClaims.length,
    },
  };
};

const DISCRIMINATORY_QUESTION = /\b(?:age|marital status|religion|pregnan(?:t|cy)|nationality|race|ethnicity|disability)\b|(?:العمر|الحالة الاجتماعية|الدين|الحمل|الجنسية|العرق|الإعاقة)/iu;

const scoreInterview = (output, fixture) => {
  const questions = Array.isArray(output.predicted_questions) ? output.predicted_questions : [];
  const source = `${fixture.resumeText ?? ''}\n${fixture.jobDescription ?? ''}`;
  const expected = featureExpectation(fixture, 'interview');
  const requiredQuestionTerms = asStringArray(expected.requiredQuestionTerms);
  const requiredAnswerTerms = asStringArray(expected.requiredAnswerTerms);
  const requiredEvidenceTerms = asStringArray(expected.requiredEvidenceTerms);
  const questionText = questions.map((question) => question.question).join('\n');
  const answerText = questions.map((question) => question.coaching_tip ?? '').join('\n');
  const evidenceText = questions.flatMap((question) => question.skills_tested ?? []).join('\n');
  const answered = questions.filter((question) => normalized(question.coaching_tip).length > 0).length;
  const grounded = questions.filter((question) => (
    Array.isArray(question.skills_tested)
    && question.skills_tested.length > 0
    && question.skills_tested.some((skill) => includesText(source, skill))
  )).length;
  const uniqueQuestions = new Set(questions.map((question) => normalized(question.question))).size;
  const discriminatoryQuestions = questions.filter((question) => (
    DISCRIMINATORY_QUESTION.test(question.question ?? '')
  )).length;
  const answerCoverage = questions.length === 0 ? 0 : answered / questions.length;
  const evidenceCoverage = questions.length === 0 ? 0 : grounded / questions.length;
  const checks = [
    { pass: questions.length >= 8 && questions.length <= 12, reason: 'invalid_interview_question_count' },
    { pass: uniqueQuestions === questions.length, reason: 'duplicate_interview_questions' },
    { pass: answerCoverage === 1, reason: 'incomplete_answer_coverage' },
    { pass: evidenceCoverage === 1, reason: 'ungrounded_interview_evidence' },
    { pass: discriminatoryQuestions === 0, reason: 'discriminatory_interview_question' },
    {
      pass: coverageFor(requiredQuestionTerms, questionText) === 1,
      reason: 'missing_required_interview_question',
    },
    {
      pass: coverageFor(requiredAnswerTerms, answerText) === 1,
      reason: 'missing_required_interview_answer',
    },
    {
      pass: coverageFor(requiredEvidenceTerms, evidenceText) === 1,
      reason: 'missing_required_interview_evidence',
    },
  ];

  return {
    ...scoreChecks(checks),
    metrics: {
      questionCount: questions.length,
      uniqueQuestionCount: uniqueQuestions,
      answerCoverage,
      evidenceCoverage,
      discriminatoryQuestionFlags: discriminatoryQuestions,
      requiredQuestionCoverage: coverageFor(requiredQuestionTerms, questionText),
      requiredAnswerCoverage: coverageFor(requiredAnswerTerms, answerText),
      requiredEvidenceCoverage: coverageFor(requiredEvidenceTerms, evidenceText),
    },
  };
};

const validClarification = (clarification) => {
  const options = Array.isArray(clarification?.options) ? clarification.options : [];
  const hardStopIndexes = options.flatMap((option, index) => (
    option?.isHardStop === true ? [index] : []
  ));
  const defaultIsValid = clarification?.defaultValue == null
    || options.some((option) => option?.value === clarification.defaultValue);
  return (
    normalized(clarification?.id).length > 0
    && normalized(clarification?.theme).length > 0
    && normalized(clarification?.rationale).length > 0
    && normalized(clarification?.question).length > 0
    && ['single', 'multi'].includes(clarification?.type)
    && options.length >= 1
    && options.length <= 5
    && options.every((option) => normalized(option?.value).length > 0 && normalized(option?.label).length > 0)
    && clarification.allowOther === true
    && hardStopIndexes.length === 1
    && hardStopIndexes[0] === options.length - 1
    && defaultIsValid
  );
};

const scoreClarification = (output, fixture) => {
  const clarifications = Array.isArray(output.clarifications) ? output.clarifications : [];
  const expected = featureExpectation(fixture, 'clarification');
  const requiredQuestionTerms = asStringArray(expected.requiredQuestionTerms);
  const questionText = clarifications.map((clarification) => clarification.question).join('\n');
  const maxQuestions = Number.isInteger(expected.maxQuestions) ? expected.maxQuestions : 3;
  const minimumQuestions = Number.isInteger(expected.minimumQuestions) ? expected.minimumQuestions : 0;
  const validQuestionCount = clarifications.filter(validClarification).length;
  const checks = [
    { pass: clarifications.length <= maxQuestions, reason: 'too_many_clarifications' },
    { pass: clarifications.length >= minimumQuestions, reason: 'too_few_clarifications' },
    { pass: validQuestionCount === clarifications.length, reason: 'invalid_clarification_shape' },
    {
      pass: coverageFor(requiredQuestionTerms, questionText) === 1,
      reason: 'missing_required_clarification',
    },
  ];

  return {
    ...scoreChecks(checks),
    metrics: {
      questionCount: clarifications.length,
      validQuestionCount,
      requiredQuestionCoverage: coverageFor(requiredQuestionTerms, questionText),
    },
  };
};

const exactMetadataValue = (actual, expected) => {
  if (expected === null) return actual === null;
  if (typeof expected === 'string') return normalized(actual) === normalized(expected);
  return Object.is(actual, expected);
};

const scoreMetadata = (output, fixture) => {
  const expectedConfig = featureExpectation(fixture, 'metadata');
  const expectedFields = expectedConfig.fields && typeof expectedConfig.fields === 'object'
    ? expectedConfig.fields
    : expectedConfig;
  const configuredFields = METADATA_FIELDS.filter((field) => Object.hasOwn(expectedFields, field));
  const fieldsToCheck = configuredFields.length > 0 ? configuredFields : METADATA_FIELDS;
  const exactFieldMatches = fieldsToCheck.filter((field) => (
    configuredFields.length > 0
      ? exactMetadataValue(output[field], expectedFields[field])
      : output[field] === null || typeof output[field] === 'string'
  )).length;
  const confidenceValid = ['companyName', 'jobTitle', 'location'].every((field) => (
    Number.isFinite(output.confidence?.[field])
    && output.confidence[field] >= 0
    && output.confidence[field] <= 1
  ));
  const checks = [
    {
      pass: exactFieldMatches === fieldsToCheck.length,
      reason: 'metadata_exact_field_mismatch',
    },
    {
      pass: confidenceValid && typeof output.needsUserConfirmation === 'boolean',
      reason: 'invalid_metadata_confidence',
    },
  ];

  return {
    ...scoreChecks(checks),
    metrics: {
      exactFieldMatches,
      expectedFieldCount: fieldsToCheck.length,
      nullFieldCount: METADATA_FIELDS.filter((field) => output[field] === null).length,
    },
  };
};

export const scoreContractOutput = (feature, output, fixture) => {
  if (feature === 'truth-check') return scoreTruthCheck(output, fixture);
  if (feature === 'cover-letter') return scoreCoverLetter(output, fixture);
  if (feature === 'interview') return scoreInterview(output, fixture);
  if (feature === 'clarification') return scoreClarification(output, fixture);
  if (feature === 'metadata') return scoreMetadata(output, fixture);
  throw new TypeError(`Feature "${feature}" does not have a deterministic contract scorer.`);
};

const failureReasonFor = (error) => {
  if (error?.name === 'TimeoutError' || error?.status === 504) return 'timeout';
  if (error?.name === 'SyntaxError' || error?.code === 'AI_CONTRACT_JSON_PARSE_FAILED') {
    return 'malformed_json';
  }
  if (error?.code === 'AI_CONTRACT_VALIDATION_FAILED') return 'schema_invalid';
  if ([401, 403, 404, 408, 429, 500, 502, 503].includes(error?.status)) {
    return 'provider_unavailable';
  }
  return 'contract_error';
};

const classifiedFailure = (failureReason) => {
  const classification = classifyAttempt({
    provider: 'openrouter',
    schemaValid: false,
    failureReason,
  });
  return {
    ...classification,
    failureReasons: [...new Set(classification.failureReasons)],
  };
};

const failedAttempt = ({
  feature,
  contractId,
  fixture,
  modelId,
  run,
  latencyMs,
  messageCount,
  failureReason,
  status = null,
  errorCode = null,
}) => ({
  feature,
  contractId,
  fixtureId: fixtureIdFor(fixture),
  modelId,
  run,
  latencyMs,
  messageCount,
  outputLength: null,
  score: null,
  qualityPassed: false,
  qualityFailureReasons: [],
  status,
  errorCode,
  approximateCostUsd: null,
  classification: classifiedFailure(failureReason),
});

export const runContractAttempt = async ({
  feature,
  fixture,
  modelId,
  run = 1,
  executeContract,
  getContract = getAiContract,
  now = Date.now,
} = {}) => {
  const contractId = FEATURE_CONTRACT_ALIASES[feature];
  if (!contractId) {
    throw new TypeError(`Feature "${feature}" does not have a direct benchmark contract.`);
  }
  if (typeof modelId !== 'string' || !modelId) {
    throw new TypeError('A benchmark modelId is required.');
  }

  const startedAt = now();
  let messageCount = 0;
  try {
    const contractExecutor = executeContract ?? (
      await import('../../../netlify/lib/ai-contracts/executor.js')
    ).executeAiContract;
    const contract = getContract(contractId);
    const input = buildContractInput(feature, fixture);
    const messages = contract.buildMessages(input, {
      retrievedContext: emptyRetrievedContext(),
    });
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new TypeError(`Contract "${contractId}" did not build any messages.`);
    }
    messageCount = messages.length;

    const output = await contractExecutor(contractId, input, {
      modelId,
      disableFallback: true,
      featureName: `benchmark.${contractId}`,
    });
    const validation = contract.outputSchema.safeParse(output);
    const latencyMs = Math.max(0, now() - startedAt);
    if (!validation.success) {
      return failedAttempt({
        feature,
        contractId,
        fixture,
        modelId,
        run,
        latencyMs,
        messageCount,
        failureReason: 'schema_invalid',
        errorCode: 'AI_CONTRACT_VALIDATION_FAILED',
      });
    }

    const scored = scoreContractOutput(feature, validation.data, fixture);
    return {
      feature,
      contractId,
      fixtureId: fixtureIdFor(fixture),
      modelId,
      run,
      latencyMs,
      messageCount,
      outputLength: JSON.stringify(validation.data).length,
      score: scored.score,
      qualityPassed: scored.qualityPassed,
      qualityFailureReasons: scored.failureReasons,
      metrics: scored.metrics,
      status: null,
      errorCode: null,
      approximateCostUsd: null,
      classification: classifyAttempt({
        provider: 'openrouter',
        schemaValid: true,
        failureReason: null,
      }),
    };
  } catch (error) {
    return failedAttempt({
      feature,
      contractId,
      fixture,
      modelId,
      run,
      latencyMs: Math.max(0, now() - startedAt),
      messageCount,
      failureReason: failureReasonFor(error),
      status: Number.isInteger(error?.status) ? error.status : null,
      errorCode: typeof error?.code === 'string' ? error.code : null,
    });
  }
};
