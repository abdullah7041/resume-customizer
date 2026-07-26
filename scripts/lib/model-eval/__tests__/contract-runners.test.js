import { describe, expect, it, vi } from 'vitest';

import { getAiContract } from '../../../../netlify/lib/ai-contracts/index.js';
import {
  FEATURE_CONTRACT_ALIASES,
  buildContractInput,
  runContractAttempt,
  scoreContractOutput,
} from '../contract-runners.mjs';

const fixture = {
  _file: 'en-resume-jd.json',
  language: 'en',
  resumeText: 'Senior Engineer at TechCorp. Reduced API latency by 40% using React.',
  jobDescription: 'Senior Full-Stack Engineer at Example Co. React is required.',
};

const interviewQuestions = Array.from({ length: 8 }, (_, index) => ({
  question: `How did you apply React in project ${index + 1}?`,
  type: index % 2 === 0 ? 'technical' : 'experience',
  difficulty: 'medium',
  category: 'React',
  skills_tested: ['React'],
  coaching_tip: 'Use the documented React and API latency example.',
}));

const validOutputs = {
  'truth-check': {
    overallRisk: 'medium',
    summary: 'One metric needs evidence.',
    claims: [{
      claimText: 'Reduced API latency by 40%',
      section: 'experience',
      severity: 'medium',
      riskTypes: ['unverifiable'],
      evidenceStatus: 'needs_evidence',
      visibleEvidence: ['Reduced API latency by 40%'],
      whyItMatters: 'The source of the metric is not shown.',
      userAction: 'Verify the measurement source.',
    }],
    limits: { cannotVerify: [] },
  },
  'cover-letter': {
    draft_text: [
      'Dear Hiring Team, I am applying for the Senior Full-Stack Engineer role at Example Co.',
      'At TechCorp, I reduced API latency by 40% using React.',
      'I would welcome the opportunity to discuss this evidence.',
    ].join('\n\n'),
  },
  interview: {
    predicted_questions: interviewQuestions,
    role_level: 'senior',
    focus_areas: ['React'],
  },
  clarification: {
    clarifications: [{
      id: 'react-depth',
      theme: 'React depth',
      rationale: 'The role needs detailed React evidence.',
      question: 'Which React responsibility best reflects your experience?',
      type: 'single',
      options: [
        { value: 'delivery', label: 'Delivered React features' },
        { value: 'none', label: 'I do not have this experience', isHardStop: true },
      ],
      allowOther: true,
    }],
  },
  metadata: {
    companyName: 'Example Co.',
    jobTitle: 'Senior Full-Stack Engineer',
    location: null,
    employmentType: null,
    seniority: 'Senior',
    sector: null,
    confidence: {
      companyName: 1,
      jobTitle: 1,
      location: 0,
    },
    needsUserConfirmation: true,
  },
};

const expectedInputs = {
  'truth-check': {
    resumeText: fixture.resumeText,
    language: 'en',
    userHardStops: [],
  },
  'cover-letter': {
    resumeText: fixture.resumeText,
    jobDescription: fixture.jobDescription,
    language: 'en',
    tone: 'professional',
  },
  interview: {
    resumeText: fixture.resumeText,
    jobDescription: fixture.jobDescription,
    questionType: 'mixed',
    vulnerabilities: [],
    language: 'en',
  },
  clarification: {
    resumeText: fixture.resumeText,
    jobText: fixture.jobDescription,
    language: 'en',
  },
  metadata: {
    jobText: fixture.jobDescription,
    language: 'en',
  },
};

describe('real contract aliases and inputs', () => {
  it('maps the benchmark feature names to production contract IDs', () => {
    expect(FEATURE_CONTRACT_ALIASES).toEqual({
      'truth-check': 'resume_truth_check',
      'cover-letter': 'cover_letter',
      interview: 'interview_prep',
      clarification: 'clarification_questions',
      metadata: 'job_metadata_extraction',
    });
  });

  it.each(Object.keys(expectedInputs))(
    'adapts the shared fixture to the %s contract input without copying prompts',
    (feature) => {
      expect(buildContractInput(feature, fixture)).toEqual(expectedInputs[feature]);
    },
  );
});

describe('runContractAttempt', () => {
  it.each(Object.keys(expectedInputs))(
    'builds and validates the real %s contract with direct no-fallback options',
    async (feature) => {
      const originalContract = getAiContract(FEATURE_CONTRACT_ALIASES[feature]);
      const buildMessages = vi.fn(originalContract.buildMessages);
      const safeParse = vi.fn(
        originalContract.outputSchema.safeParse.bind(originalContract.outputSchema),
      );
      const getContract = vi.fn(() => ({
        ...originalContract,
        buildMessages,
        outputSchema: { safeParse },
      }));
      const executeContract = vi.fn(async () => ({
        data: validOutputs[feature],
        metadata: {
          provider: 'openrouter',
          modelId: 'google/gemini-3.1-flash-lite',
          tokenUsage: {
            promptTokens: 1000,
            completionTokens: 500,
            totalTokens: 1500,
            reasoningTokens: 0,
          },
        },
      }));

      const result = await runContractAttempt({
        feature,
        fixture,
        modelId: 'google/gemini-3.1-flash-lite',
        run: 2,
        executeContract,
        getContract,
        now: (() => {
          const times = [100, 137];
          return () => times.shift();
        })(),
      });

      expect(getContract).toHaveBeenCalledWith(FEATURE_CONTRACT_ALIASES[feature]);
      expect(buildMessages).toHaveBeenCalledWith(expectedInputs[feature], {
        retrievedContext: { documents: [], citations: [] },
      });
      expect(executeContract).toHaveBeenCalledWith(
        FEATURE_CONTRACT_ALIASES[feature],
        expectedInputs[feature],
        {
          modelId: 'google/gemini-3.1-flash-lite',
          disableFallback: true,
          featureName: `benchmark.${FEATURE_CONTRACT_ALIASES[feature]}`,
          includeResponseMetadata: true,
        },
      );
      expect(safeParse).toHaveBeenCalledWith(validOutputs[feature]);
      expect(result).toMatchObject({
        feature,
        contractId: FEATURE_CONTRACT_ALIASES[feature],
        fixtureId: 'en-resume-jd.json',
        modelId: 'google/gemini-3.1-flash-lite',
        run: 2,
        latencyMs: 37,
        messageCount: 2,
        approximateCostUsd: 0.001,
        qualityPassed: true,
        classification: {
          provider: 'openrouter',
          schemaValid: true,
          primarySuccess: true,
        },
      });
      expect(result).not.toHaveProperty('output');
      expect(result).not.toHaveProperty('rawOutput');
      expect(result).not.toHaveProperty('messages');
    },
  );

  it('records null cost when the requested model has no registry pricing', async () => {
    const result = await runContractAttempt({
      feature: 'metadata',
      fixture,
      modelId: 'unknown/unpriced-model',
      executeContract: vi.fn(async () => ({
        data: validOutputs.metadata,
        metadata: {
          provider: 'openrouter',
          modelId: 'unknown/unpriced-model',
          tokenUsage: {
            promptTokens: 1000,
            completionTokens: 500,
            totalTokens: 1500,
            reasoningTokens: null,
          },
        },
      })),
      now: () => 100,
    });

    expect(result).toMatchObject({
      approximateCostUsd: null,
      qualityPassed: true,
    });
  });

  it('classifies an executor result that fails the real output schema without exposing it', async () => {
    const result = await runContractAttempt({
      feature: 'metadata',
      fixture,
      modelId: 'google/gemini-3.1-flash-lite',
      executeContract: vi.fn(async () => ({
        companyName: 'Example Co.',
        rawProviderPayload: fixture.resumeText,
      })),
      now: () => 100,
    });

    expect(result).toMatchObject({
      qualityPassed: false,
      score: null,
      classification: {
        primarySuccess: false,
        schemaValid: false,
        failureReasons: ['schema_invalid'],
      },
    });
    expect(JSON.stringify(result)).not.toContain(fixture.resumeText);
    expect(result).not.toHaveProperty('rawOutput');
  });
});

describe('feature-specific deterministic scorers', () => {
  it('fails truth-check claims whose visible evidence cannot be traced to the resume', () => {
    const scored = scoreContractOutput('truth-check', {
      ...validOutputs['truth-check'],
      claims: [{
        ...validOutputs['truth-check'].claims[0],
        visibleEvidence: ['Invented evidence snippet'],
      }],
    }, fixture);

    expect(scored.qualityPassed).toBe(false);
    expect(scored.failureReasons).toContain('untraceable_visible_evidence');
    expect(scored.metrics.evidenceCoverage).toBe(0);
  });

  it('scores required cover-letter employer, role, evidence, and unsupported-claim flags', () => {
    const scored = scoreContractOutput('cover-letter', validOutputs['cover-letter'], {
      ...fixture,
      expected: {
        coverLetter: {
          requiredEmployer: 'Example Co.',
          requiredRole: 'Senior Full-Stack Engineer',
          requiredEvidenceTerms: ['40%', 'React'],
          unsupportedClaimTerms: ['PMP'],
        },
      },
    });

    expect(scored).toMatchObject({
      score: 100,
      qualityPassed: true,
      failureReasons: [],
      metrics: {
        employerCoverage: 1,
        roleCoverage: 1,
        evidenceCoverage: 1,
        unsupportedClaimFlags: 0,
      },
    });
  });

  it('fails interview outputs with missing answer coaching or ungrounded evidence', () => {
    const questions = interviewQuestions.map((question, index) => (
      index === 0
        ? { ...question, skills_tested: ['COBOL'], coaching_tip: undefined }
        : question
    ));
    const scored = scoreContractOutput('interview', {
      ...validOutputs.interview,
      predicted_questions: questions,
    }, fixture);

    expect(scored.qualityPassed).toBe(false);
    expect(scored.failureReasons).toEqual(expect.arrayContaining([
      'incomplete_answer_coverage',
      'ungrounded_interview_evidence',
    ]));
    expect(scored.metrics.answerCoverage).toBe(7 / 8);
    expect(scored.metrics.evidenceCoverage).toBe(7 / 8);
  });

  it('enforces the clarification maximum and required question shape', () => {
    const invalidQuestion = {
      ...validOutputs.clarification.clarifications[0],
      allowOther: false,
      options: [
        { value: 'none', label: 'No experience', isHardStop: true },
        { value: 'some', label: 'Some experience' },
      ],
    };
    const scored = scoreContractOutput('clarification', {
      clarifications: Array.from({ length: 4 }, () => invalidQuestion),
    }, fixture);

    expect(scored.qualityPassed).toBe(false);
    expect(scored.failureReasons).toEqual(expect.arrayContaining([
      'too_many_clarifications',
      'invalid_clarification_shape',
    ]));
    expect(scored.metrics.questionCount).toBe(4);
    expect(scored.metrics.validQuestionCount).toBe(0);
  });

  it('compares metadata fields exactly and preserves expected nulls', () => {
    const expectedMetadata = {
      companyName: 'Example Co.',
      jobTitle: 'Senior Full-Stack Engineer',
      location: null,
      employmentType: null,
      seniority: 'Senior',
      sector: null,
    };
    const passed = scoreContractOutput('metadata', validOutputs.metadata, {
      ...fixture,
      expected: { metadata: expectedMetadata },
    });
    const failed = scoreContractOutput('metadata', {
      ...validOutputs.metadata,
      location: 'Riyadh',
    }, {
      ...fixture,
      expected: { metadata: expectedMetadata },
    });

    expect(passed).toMatchObject({
      score: 100,
      qualityPassed: true,
      metrics: { exactFieldMatches: 6, expectedFieldCount: 6 },
    });
    expect(failed.qualityPassed).toBe(false);
    expect(failed.failureReasons).toContain('metadata_exact_field_mismatch');
    expect(failed.metrics.exactFieldMatches).toBe(5);
  });
});
