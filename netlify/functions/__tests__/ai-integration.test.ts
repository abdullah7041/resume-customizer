import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';

// Mock dependencies
const mockGeminiClient = {
    processResume: vi.fn(),
    processMatchOnly: vi.fn(),
    generateCoverLetter: vi.fn(),
    predictInterviewQuestions: vi.fn()
};

const mockRateLimiter = {
    withRateLimit: (_name: string, handler: Function) => handler
};

const mockSentry = {
    initSentry: vi.fn(),
    captureError: vi.fn()
};

const mockSupabase = {
    createClient: vi.fn(() => ({
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: 'test-user-123' } },
                error: null
            })
        },
        from: vi.fn(() => ({
            insert: vi.fn().mockResolvedValue({ data: null, error: null })
        }))
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
    })
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
                reasoning: 'Good match'
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
