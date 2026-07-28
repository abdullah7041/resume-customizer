import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';

// Mock dependencies
const mockGeminiClient = {
    processResume: vi.fn(),
    processMatchOnly: vi.fn(),
    analyzeResumeTruthCheck: vi.fn(),
    generateCoverLetter: vi.fn(),
    predictInterviewQuestions: vi.fn()
};

const mockRateLimiter = {
    withRateLimit: (_name: string, handler: Function) => handler,
    checkFreePreviewRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
    // No Upstash in tests — mirrors the real fail-closed behavior (no free
    // allowance granted, so verify mode still checks/consumes credits).
    tryConsumeFreeAllowance: vi.fn().mockResolvedValue(false),
    releaseFreeAllowance: vi.fn().mockResolvedValue(undefined),
};

const mockSentry = {
    initSentry: vi.fn(),
    captureError: vi.fn(),
    summarizeErrorForLog: vi.fn((error: unknown) => error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) })
};

const mockDbInsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockDbFrom = vi.fn((table: string) => ({
    insert: (payload: unknown) => mockDbInsert(table, payload)
}));

const mockSupabase = {
    createClient: vi.fn(() => ({
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: 'test-user-123', email: 'user@example.com', email_confirmed_at: new Date().toISOString() } },
                error: null
            })
        },
        from: mockDbFrom
    }))
};

const mockCreditManager = {
    checkCredits: vi.fn().mockResolvedValue({
        hasCredits: true,
        required: 2,
        available: 15
    }),
    consumeCredits: vi.fn().mockResolvedValue({
        success: true,
        creditsRemaining: 13
    }),
    isEmailVerified: vi.fn((user) => Boolean(user?.email_confirmed_at))
};

vi.mock('../../lib/gemini-client', () => mockGeminiClient);
vi.mock('../../lib/openrouter-client', () => ({
    callOpenRouter: vi.fn().mockResolvedValue('{}'),
    MODELS: { lite: 'google/gemini-2.5-flash-lite', flash: 'google/gemini-2.5-flash' },
    DEFAULT_MAX_TOKENS: { lite: 4096, flash: 6144 }
}));
vi.mock('../../lib/rate-limiter', () => mockRateLimiter);
vi.mock('../../lib/sentry', () => mockSentry);
vi.mock('@supabase/supabase-js', () => mockSupabase);
vi.mock('../../lib/credit-manager', () => mockCreditManager);

// Helper to create mock context
const createMockContext = (): HandlerContext => ({
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'test-function',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:test',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/test',
    logStreamName: '2024/01/01/[$LATEST]test',
    getRemainingTimeInMillis: () => 30000,
    done: () => { },
    fail: () => { },
    succeed: () => { },
    clientContext: undefined
});

describe('AI Integration Functions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Set required env vars for Supabase client initialization
        process.env.SUPABASE_URL = 'https://test.supabase.co';
        process.env.SUPABASE_ANON_KEY = 'test-anon-key';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
        process.env.STRATEGIC_REALITY_CHECK_HASH_SECRET = 'test-secret';
        mockDbInsert.mockResolvedValue({ data: null, error: null });
        mockDbFrom.mockClear();
    });

    describe('ai-match function', () => {
        let aiMatchHandler: any;

        beforeEach(async () => {
            const mod = await import('../ai-match.js');
            aiMatchHandler = mod.handler;
        }, 30000);

        it('validates input schema', async () => {
            const event = {
                httpMethod: 'POST',
                headers: { 'Authorization': 'Bearer test-token' },
                body: JSON.stringify({ resumeText: 'test' }) // Missing jobText
            } as Partial<HandlerEvent>;

            const result = await aiMatchHandler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(400);
            expect(JSON.parse(result.body).error).toBeDefined();
        });

        it('returns formatted match analysis', async () => {
            mockGeminiClient.processMatchOnly.mockResolvedValue({
                score: 85,
                strongMatches: ['typescript'],
                missingKeywords: ['react'],
                summary_bullets: ['Strong TypeScript evidence', 'React is the main gap'],
                reasoning: 'Good match',
                strategicRealityCheck: {
                    riskTier: 'low',
                    recommendation: 'optimize_now',
                    confidence: 'high',
                    riskTypes: ['other'],
                    summary: 'Evidence supports optimization.',
                    strengths: [],
                    confirmedRisks: [],
                    unclearRisks: [],
                    limits: { cannotDetermine: [], assumptions: [] },
                },
            });

            const event = {
                httpMethod: 'POST',
                headers: { 'Authorization': 'Bearer test-token' },
                body: JSON.stringify({ resumeText: 'resume', jobText: 'job' })
            } as Partial<HandlerEvent>;

            const result = await aiMatchHandler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(200);

            const body = JSON.parse(result.body);
            expect(body.score).toBe(85);
            expect(body.strongMatches).toContain('typescript');
            expect(body.summary_bullets).toEqual(['Strong TypeScript evidence', 'React is the main gap']);
            expect(body.strategicRealityCheck.riskTier).toBe('low');
            expect(mockDbFrom).toHaveBeenCalledWith('strategic_reality_checks');
            expect(mockDbFrom).not.toHaveBeenCalledWith('job_matches');
            expect(mockDbInsert).toHaveBeenCalledWith(
                'strategic_reality_checks',
                expect.objectContaining({
                    user_id: 'test-user-123',
                    match_score: 85,
                    resume_hash: expect.any(String),
                    job_hash: expect.any(String),
                })
            );
        });

        it('returns critical Reality Check and treats summary persistence failure as non-fatal', async () => {
            mockGeminiClient.processMatchOnly.mockResolvedValue({
                score: 42,
                strongMatches: ['SQL'],
                missingKeywords: ['machine learning'],
                reasoning: 'Significant gaps',
                strategicRealityCheck: {
                    riskTier: 'critical',
                    recommendation: 'add_evidence_first',
                    confidence: 'medium',
                    riskTypes: ['missing_required_skill'],
                    summary: 'Critical evidence gap.',
                    strengths: [],
                    confirmedRisks: [],
                    unclearRisks: [{
                        type: 'missing_required_skill',
                        topic: 'Machine learning',
                        reason: 'Resume evidence is unclear.',
                        evidenceNeeded: 'Add verifiable machine learning work only if it exists.',
                    }],
                    limits: { cannotDetermine: ['Employer decisions'], assumptions: [] },
                },
            });
            mockDbInsert.mockRejectedValueOnce(new Error('insert failed'));

            const event = {
                httpMethod: 'POST',
                headers: { 'Authorization': 'Bearer test-token' },
                body: JSON.stringify({ resumeText: 'SQL resume', jobText: 'machine learning job' })
            } as Partial<HandlerEvent>;

            const result = await aiMatchHandler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(200);

            const body = JSON.parse(result.body);
            expect(body.score).toBe(42);
            expect(body.strategicRealityCheck.riskTier).toBe('critical');
            expect(mockCreditManager.consumeCredits).toHaveBeenCalledWith('user@example.com', 'ai_match');
            expect(mockDbFrom).toHaveBeenCalledWith('strategic_reality_checks');
        });

        it('skips Reality Check summary persistence when the hash secret is missing', async () => {
            delete process.env.STRATEGIC_REALITY_CHECK_HASH_SECRET;
            mockGeminiClient.processMatchOnly.mockResolvedValue({
                score: 72,
                strongMatches: ['SQL'],
                missingKeywords: ['Python'],
                reasoning: 'Competitive with gaps',
                strategicRealityCheck: {
                    riskTier: 'medium',
                    recommendation: 'answer_clarifications_first',
                    confidence: 'low',
                    riskTypes: ['evidence_quality'],
                    summary: 'Needs clearer evidence.',
                    strengths: [],
                    confirmedRisks: [],
                    unclearRisks: [],
                    limits: { cannotDetermine: ['Employer decisions'], assumptions: [] },
                },
            });

            const event = {
                httpMethod: 'POST',
                headers: { 'Authorization': 'Bearer test-token' },
                body: JSON.stringify({ resumeText: 'SQL resume', jobText: 'Python job' })
            } as Partial<HandlerEvent>;

            const result = await aiMatchHandler(event as HandlerEvent, createMockContext()) as HandlerResponse;

            expect(result.statusCode).toBe(200);
            expect(JSON.parse(result.body).score).toBe(72);
            expect(mockCreditManager.consumeCredits).toHaveBeenCalledWith('user@example.com', 'ai_match');
            expect(mockDbFrom).not.toHaveBeenCalledWith('strategic_reality_checks');
            expect(mockDbFrom).not.toHaveBeenCalledWith('job_matches');
            expect(mockDbInsert).not.toHaveBeenCalled();
        });

        it('clamps out-of-range match scores before responding and storing', async () => {
            mockGeminiClient.processMatchOnly.mockResolvedValue({
                score: 150,
                strongMatches: ['typescript'],
                missingKeywords: [],
                reasoning: 'Score should be clamped'
            });

            const event = {
                httpMethod: 'POST',
                headers: { 'Authorization': 'Bearer test-token' },
                body: JSON.stringify({ resumeText: 'resume', jobText: 'job' })
            } as Partial<HandlerEvent>;

            const result = await aiMatchHandler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(200);

            const body = JSON.parse(result.body);
            expect(body.score).toBe(100);
            expect(body.coverage).toBe(1);
            expect(body.similarity).toBe(1);
        });

        it('preserves a valid zero match score before responding', async () => {
            mockGeminiClient.processMatchOnly.mockResolvedValue({
                score: 0,
                strongMatches: [],
                missingKeywords: ['react'],
                reasoning: 'No relevant evidence'
            });

            const event = {
                httpMethod: 'POST',
                headers: { 'Authorization': 'Bearer test-token' },
                body: JSON.stringify({ resumeText: 'resume', jobText: 'job' })
            } as Partial<HandlerEvent>;

            const result = await aiMatchHandler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(200);

            const body = JSON.parse(result.body);
            expect(body.score).toBe(0);
            expect(body.coverage).toBe(0);
            expect(body.similarity).toBe(0);
        });

        it('still checks and consumes credits when a client sends verify mode directly', async () => {
            mockGeminiClient.processMatchOnly.mockResolvedValue({
                score: 84,
                strongMatches: ['typescript'],
                missingKeywords: [],
                summary_bullets: ['Verified optimized resume evidence'],
                reasoning: 'Verified score',
            });

            const event = {
                httpMethod: 'POST',
                headers: { 'Authorization': 'Bearer test-token' },
                body: JSON.stringify({ resumeText: 'optimized resume', jobText: 'job', mode: 'verify' })
            } as Partial<HandlerEvent>;

            const result = await aiMatchHandler(event as HandlerEvent, createMockContext()) as HandlerResponse;

            expect(result.statusCode).toBe(200);
            expect(JSON.parse(result.body).score).toBe(84);
            expect(mockCreditManager.checkCredits).toHaveBeenCalledWith(
                'user@example.com',
                'ai_match',
                expect.objectContaining({ emailVerified: true })
            );
            expect(mockCreditManager.consumeCredits).toHaveBeenCalledWith('user@example.com', 'ai_match');
        });

        it('skips credit checks entirely when the free applied-subset verify allowance is granted', async () => {
            mockRateLimiter.tryConsumeFreeAllowance.mockResolvedValueOnce(true);
            mockGeminiClient.processMatchOnly.mockResolvedValue({
                score: 84,
                strongMatches: ['typescript'],
                missingKeywords: [],
                reasoning: 'Verified score',
            });

            const event = {
                httpMethod: 'POST',
                headers: { 'Authorization': 'Bearer test-token' },
                body: JSON.stringify({ resumeText: 'optimized resume', jobText: 'job', mode: 'verify', verifyKind: 'applied_subset' })
            } as Partial<HandlerEvent>;

            const result = await aiMatchHandler(event as HandlerEvent, createMockContext()) as HandlerResponse;

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.score).toBe(84);
            expect(body.freeVerify).toBe(true);
            expect(mockCreditManager.checkCredits).not.toHaveBeenCalled();
            expect(mockCreditManager.consumeCredits).not.toHaveBeenCalled();
        });

        it('does not grant the free allowance for the automatic post-optimize verify (no verifyKind)', async () => {
            mockRateLimiter.tryConsumeFreeAllowance.mockResolvedValueOnce(true);
            mockGeminiClient.processMatchOnly.mockResolvedValue({
                score: 84,
                strongMatches: ['typescript'],
                missingKeywords: [],
                reasoning: 'Verified score',
            });

            const event = {
                httpMethod: 'POST',
                headers: { 'Authorization': 'Bearer test-token' },
                // No verifyKind — this is what the automatic post-optimize verify
                // sends. Even though the (misconfigured, for this test) mock would
                // grant a free allowance, the handler must never consult it here.
                body: JSON.stringify({ resumeText: 'optimized resume', jobText: 'job', mode: 'verify' })
            } as Partial<HandlerEvent>;

            const result = await aiMatchHandler(event as HandlerEvent, createMockContext()) as HandlerResponse;

            expect(result.statusCode).toBe(200);
            expect(mockRateLimiter.tryConsumeFreeAllowance).not.toHaveBeenCalled();
            expect(mockCreditManager.checkCredits).toHaveBeenCalled();
            expect(mockCreditManager.consumeCredits).toHaveBeenCalledWith('user@example.com', 'ai_match');
        });

        it('releases the free allowance back when the AI call fails, instead of burning it on a dud request', async () => {
            mockRateLimiter.tryConsumeFreeAllowance.mockResolvedValueOnce(true);
            mockGeminiClient.processMatchOnly.mockRejectedValue(new Error('provider outage'));

            const event = {
                httpMethod: 'POST',
                headers: { 'Authorization': 'Bearer test-token' },
                body: JSON.stringify({ resumeText: 'optimized resume', jobText: 'job', mode: 'verify', verifyKind: 'applied_subset' })
            } as Partial<HandlerEvent>;

            const result = await aiMatchHandler(event as HandlerEvent, createMockContext()) as HandlerResponse;

            expect(result.statusCode).toBe(500);
            expect(mockRateLimiter.releaseFreeAllowance).toHaveBeenCalledWith(
                'applied-verify-free',
                expect.stringContaining('test-user-123:')
            );
            expect(mockCreditManager.consumeCredits).not.toHaveBeenCalled();
        });

        it('returns a retryable user-facing timeout response', async () => {
            const timeoutError = new Error('AI request timed out after 65000ms.');
            timeoutError.name = 'TimeoutError';
            (timeoutError as any).status = 504;
            mockGeminiClient.processMatchOnly.mockRejectedValue(timeoutError);

            const event = {
                httpMethod: 'POST',
                headers: { 'Authorization': 'Bearer test-token' },
                body: JSON.stringify({ resumeText: 'resume', jobText: 'job' })
            } as Partial<HandlerEvent>;

            const result = await aiMatchHandler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(504);
            expect(result.headers?.['Retry-After']).toBe('30');

            const body = JSON.parse(result.body);
            expect(body.retryable).toBe(true);
            expect(body.error).toContain('automatically retried');
            expect(body.troubleshooting).toContain('Automatic retries');
            expect(mockSentry.captureError).not.toHaveBeenCalled();
        });
    });

    describe('generate-cover-letter function', () => {
        let coverLetterHandler: any;

        beforeEach(async () => {
            const mod = await import('../generate-cover-letter.js');
            coverLetterHandler = mod.handler;
        });

        it('validates input schema', async () => {
            const event = {
                httpMethod: 'POST',
                headers: { 'Authorization': 'Bearer test-token' },
                body: JSON.stringify({ jobDescription: 'job' }) // Missing resumeText
            } as Partial<HandlerEvent>;

            const result = await coverLetterHandler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(400);
        });

        it('returns cover letter draft', async () => {
            mockGeminiClient.generateCoverLetter.mockResolvedValue({
                draft_text: "Dear Hiring Manager..."
            });

            const event = {
                httpMethod: 'POST',
                headers: { 'Authorization': 'Bearer test-token' },
                body: JSON.stringify({ resumeText: 'resume', jobDescription: 'job' })
            } as Partial<HandlerEvent>;

            const result = await coverLetterHandler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(200);

            const body = JSON.parse(result.body);
            expect(body.coverLetter).toBe("Dear Hiring Manager...");
        });
    });

    describe('resume-truth-check function', () => {
        let truthCheckHandler: any;

        beforeEach(async () => {
            const mod = await import('../resume-truth-check.js');
            truthCheckHandler = mod.handler;
        });

        it('requires authentication', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {},
                body: JSON.stringify({ resumeText: 'resume' })
            } as Partial<HandlerEvent>;

            const result = await truthCheckHandler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(401);
            expect(mockGeminiClient.analyzeResumeTruthCheck).not.toHaveBeenCalled();
        });

        it('validates input schema', async () => {
            const event = {
                httpMethod: 'POST',
                headers: { 'Authorization': 'Bearer test-token' },
                body: JSON.stringify({ resumeText: '' })
            } as Partial<HandlerEvent>;

            const result = await truthCheckHandler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(400);
            expect(mockGeminiClient.analyzeResumeTruthCheck).not.toHaveBeenCalled();
        });

        it('returns structured truth check results without consuming credits', async () => {
            mockGeminiClient.analyzeResumeTruthCheck.mockResolvedValue({
                overallRisk: 'medium',
                summary: 'Some claims need clearer evidence.',
                claims: [{
                    claimText: 'Owned national transformation',
                    section: 'summary',
                    severity: 'medium',
                    riskTypes: ['unsupported'],
                    evidenceStatus: 'needs_evidence',
                    visibleEvidence: ['Owned national transformation'],
                    whyItMatters: 'The scope is broad.',
                    userAction: 'Add scope only if true.',
                }],
                limits: { cannotVerify: ['External employer records'] },
            });

            const event = {
                httpMethod: 'POST',
                headers: { 'Authorization': 'Bearer test-token' },
                body: JSON.stringify({
                    resumeText: 'Owned national transformation',
                    language: 'en',
                    userHardStops: ['Excel'],
                })
            } as Partial<HandlerEvent>;

            const result = await truthCheckHandler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            const body = JSON.parse(result.body);

            expect(result.statusCode).toBe(200);
            expect(body.overallRisk).toBe('medium');
            expect(body.claims[0].claimText).toContain('Owned national transformation');
            expect(body.creditsRemaining).toBeUndefined();
            expect(mockGeminiClient.analyzeResumeTruthCheck).toHaveBeenCalledWith(
                'Owned national transformation',
                'en',
                { userHardStops: ['Excel'] },
            );
            expect(mockCreditManager.checkCredits).not.toHaveBeenCalledWith('user@example.com', 'resume_truth_check', expect.anything());
            expect(mockCreditManager.consumeCredits).not.toHaveBeenCalledWith('user@example.com', 'resume_truth_check');
        });

        it('returns a retryable timeout response', async () => {
            const timeoutError = new Error('AI request timed out.');
            timeoutError.name = 'TimeoutError';
            (timeoutError as any).status = 504;
            mockGeminiClient.analyzeResumeTruthCheck.mockRejectedValue(timeoutError);

            const event = {
                httpMethod: 'POST',
                headers: { 'Authorization': 'Bearer test-token' },
                body: JSON.stringify({ resumeText: 'resume' })
            } as Partial<HandlerEvent>;

            const result = await truthCheckHandler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            const body = JSON.parse(result.body);

            expect(result.statusCode).toBe(504);
            expect(result.headers?.['Retry-After']).toBe('30');
            expect(body.retryable).toBe(true);
            expect(mockSentry.captureError).not.toHaveBeenCalled();
        });
    });

    describe('predict-questions function', () => {
        let predictQuestionsHandler: any;

        beforeEach(async () => {
            const mod = await import('../predict-questions.js');
            predictQuestionsHandler = mod.handler;
        });

        it('validates input schema', async () => {
            const event = {
                httpMethod: 'POST',
                headers: { 'Authorization': 'Bearer test-token' },
                body: JSON.stringify({ jobDescription: 'job' }) // Missing resumeText
            } as Partial<HandlerEvent>;

            const result = await predictQuestionsHandler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(400);
        });

        it('returns interview prep data', async () => {
            mockGeminiClient.predictInterviewQuestions.mockResolvedValue({
                predicted_questions: ['Tell me about yourself'],
                role_level: 'Senior',
                focus_areas: ['System Design']
            });

            const event = {
                httpMethod: 'POST',
                headers: { 'Authorization': 'Bearer test-token' },
                body: JSON.stringify({ resumeText: 'resume', jobDescription: 'job' })
            } as Partial<HandlerEvent>;

            const result = await predictQuestionsHandler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(200);

            const body = JSON.parse(result.body);
            expect(body.questions).toContain('Tell me about yourself');
            expect(body.roleLevel).toBe('Senior');
        });
    });
});
