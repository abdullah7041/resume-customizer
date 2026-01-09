import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';

// Mock dependencies
const mockGeminiClient = {
    processResume: vi.fn(),
    processMatchOnly: vi.fn()
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
            getUser: vi.fn().mockResolvedValue({ data: { user: null } })
        },
        from: vi.fn(() => ({
            insert: vi.fn().mockResolvedValue({ data: null, error: null })
        }))
    }))
};

vi.mock('../../lib/gemini-client', () => mockGeminiClient);
vi.mock('../../lib/rate-limiter', () => mockRateLimiter);
vi.mock('../../lib/sentry', () => mockSentry);
vi.mock('@supabase/supabase-js', () => mockSupabase);

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
    });

    describe('ai-match function', () => {
        let aiMatchHandler: any;

        beforeEach(async () => {
            const mod = await import('../ai-match');
            aiMatchHandler = mod.handler;
        });

        it('validates input schema', async () => {
            const event = {
                httpMethod: 'POST',
                headers: {},
                body: JSON.stringify({ resumeText: 'test' }) // Missing jobDesc
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
                headers: {},
                body: JSON.stringify({ resumeText: 'resume', jobDesc: 'job' })
            } as Partial<HandlerEvent>;

            const result = await aiMatchHandler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(200);

            const body = JSON.parse(result.body);
            expect(body.score).toBe(85);
            expect(body.strongMatches).toContain('typescript');
        });
    });

    describe('generate-cover-letter function', () => {
        let coverLetterHandler: any;

        beforeEach(async () => {
            const mod = await import('../generate-cover-letter');
            coverLetterHandler = mod.handler;
        });

        it('validates input schema', async () => {
            const event = {
                httpMethod: 'POST',
                body: JSON.stringify({ jobDescription: 'job' }) // Missing resumeText
            } as Partial<HandlerEvent>;

            const result = await coverLetterHandler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(400);
        });

        it('returns cover letter draft', async () => {
            mockGeminiClient.processResume.mockResolvedValue({
                coverLetter: {
                    draft_text: "Dear Hiring Manager..."
                }
            });

            const event = {
                httpMethod: 'POST',
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
            const mod = await import('../predict-questions');
            predictQuestionsHandler = mod.handler;
        });

        it('validates input schema', async () => {
            const event = {
                httpMethod: 'POST',
                body: JSON.stringify({ jobDescription: 'job' }) // Missing resumeText
            } as Partial<HandlerEvent>;

            const result = await predictQuestionsHandler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(400);
        });

        it('returns interview prep data', async () => {
            mockGeminiClient.processResume.mockResolvedValue({
                interviewPrep: {
                    predicted_questions: ['Tell me about yourself'],
                    role_level: 'Senior',
                    focus_areas: ['System Design']
                }
            });

            const event = {
                httpMethod: 'POST',
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
