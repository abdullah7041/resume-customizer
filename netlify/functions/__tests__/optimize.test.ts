import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';

// Mock dependencies BEFORE importing handler
vi.mock('../../lib/gemini-client', () => ({
    optimizeResume: vi.fn()
}));

vi.mock('../../lib/rate-limiter', () => ({
    withRateLimit: (_name: string, handler: Function) => handler
}));

vi.mock('../../lib/sentry', () => ({
    initSentry: vi.fn(),
    captureError: vi.fn(),
    summarizeErrorForLog: vi.fn((error: unknown) => error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) })
}));

const mockRedisCache = vi.hoisted(() => ({
    buildCacheKey: vi.fn(() => 'mock-cache-key'),
    buildOptimizeCacheKey: vi.fn(() => 'mock-cache-key'),
    getCached: vi.fn().mockResolvedValue(null),
    setCached: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../lib/redis-cache', () => mockRedisCache);

vi.mock('../../lib/supabase-client', () => ({
    getSupabaseClient: vi.fn(() => ({
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: 'test-user-123', email: 'user@example.com', email_confirmed_at: '2026-01-01T00:00:00.000Z' } },
                error: null
            })
        }
    }))
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: 'test-user-123', email: 'user@example.com', email_confirmed_at: '2026-01-01T00:00:00.000Z' } },
                error: null
            })
        }
    }))
}));

vi.mock('../../lib/credit-manager', () => ({
    checkCredits: vi.fn().mockResolvedValue({
        hasCredits: true,
        required: 5,
        available: 15
    }),
    consumeCredits: vi.fn().mockResolvedValue({
        success: true,
        creditsRemaining: 10
    }),
    isEmailVerified: vi.fn((user: { email_confirmed_at?: string | null } | null) => Boolean(user?.email_confirmed_at))
}));

import { optimizeResume } from '../../lib/gemini-client.js';
import { buildOptimizeCacheKey, getCached, setCached } from '../../lib/redis-cache.js';
import { checkCredits, consumeCredits } from '../../lib/credit-manager.js';

// Import handler after mocks
const { handler } = await import('../optimize.js');

// Test auth header
const TEST_HEADERS = { 'Authorization': 'Bearer test-token' };

// Helper to create mock context
const createMockContext = (): HandlerContext => ({
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'optimize',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:optimize',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/optimize',
    logStreamName: '2024/01/01/[$LATEST]test',
    getRemainingTimeInMillis: () => 30000,
    done: () => { },
    fail: () => { },
    succeed: () => { },
    clientContext: undefined
});

describe('optimize function', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRedisCache.getCached.mockResolvedValue(null);
        mockRedisCache.setCached.mockResolvedValue(undefined);
        vi.mocked(checkCredits).mockResolvedValue({
            hasCredits: true,
            required: 5,
            available: 15,
        });
        vi.mocked(consumeCredits).mockResolvedValue({
            success: true,
            creditsRemaining: 10,
        });
    });

    describe('HTTP method validation', () => {
        it('rejects GET requests with 405', async () => {
            const event = { httpMethod: 'GET', body: null } as Partial<HandlerEvent>;
            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(405);
        });

        it('accepts POST requests', async () => {
            (optimizeResume as any).mockResolvedValue({ match_score: 55 });

            const event = {
                httpMethod: 'POST',
                headers: TEST_HEADERS,
                body: JSON.stringify({ resumeText: 'test', jobText: 'test job' })
            } as Partial<HandlerEvent>;
            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(200);
        });
    });

    describe('request validation', () => {
        it('rejects missing resumeText with 400', async () => {
            const event = {
                httpMethod: 'POST',
                headers: TEST_HEADERS,
                body: JSON.stringify({ jobText: 'test job' })
            } as Partial<HandlerEvent>;
            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(400);
            expect(JSON.parse(result.body).error).toContain('resumeText');
        });

        it('rejects missing jobText with 400', async () => {
            const event = {
                httpMethod: 'POST',
                headers: TEST_HEADERS,
                body: JSON.stringify({ resumeText: 'test resume' })
            } as Partial<HandlerEvent>;
            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(400);
            expect(JSON.parse(result.body).error).toContain('jobText');
        });

        it('rejects empty strings', async () => {
            const event = {
                httpMethod: 'POST',
                headers: TEST_HEADERS,
                body: JSON.stringify({ resumeText: '', jobText: '' })
            } as Partial<HandlerEvent>;
            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(400);
        });

        it('rejects malformed JSON with error', async () => {
            const event = {
                httpMethod: 'POST',
                headers: TEST_HEADERS,
                body: 'not json'
            } as Partial<HandlerEvent>;
            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(400);
            expect(JSON.parse(result.body).error).toBe('Invalid JSON body');
        });
    });

    it('threads user hard stops through the cache key and legacy optimize contract', async () => {
        vi.mocked(optimizeResume).mockResolvedValue({ match_score: 55 });
        const event = {
            httpMethod: 'POST',
            headers: TEST_HEADERS,
            body: JSON.stringify({
                resumeText: 'test resume',
                jobText: 'Excel job',
                userHardStops: ['Excel'],
            }),
        } as Partial<HandlerEvent>;

        const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;

        expect(result.statusCode).toBe(200);
        expect(buildOptimizeCacheKey).toHaveBeenCalledWith(expect.objectContaining({
            userHardStops: ['Excel'],
        }));
        expect(optimizeResume).toHaveBeenCalledWith(
            'test resume',
            'Excel job',
            'en',
            [],
            undefined,
            ['Excel'],
        );
    });

    it('does not return a cached empty card payload as a successful optimization', async () => {
        mockRedisCache.getCached.mockResolvedValue({
            cards: [],
            keywords: { add: [], neutral: [], remove: [] },
            source: 'gemini',
        });
        vi.mocked(optimizeResume).mockResolvedValue({
            match_score: 60,
            missing_keywords: ['React'],
            keywords_to_keep: [],
            keywords_to_avoid: [],
        });
        const event = {
            httpMethod: 'POST',
            headers: TEST_HEADERS,
            body: JSON.stringify({ resumeText: 'test resume', jobText: 'React job' }),
        } as Partial<HandlerEvent>;

        const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
        const body = JSON.parse(result.body);

        expect(result.statusCode).toBe(200);
        expect(body.cards.length).toBeGreaterThan(0);
        expect(JSON.stringify(body)).toContain('React');
        expect(optimizeResume).toHaveBeenCalled();
    });

    it('returns cached optimize results before enforcing the live credit check', async () => {
        vi.mocked(getCached).mockResolvedValue({
            cards: [{
                section: 'General',
                issue: 'Cached issue',
                suggestion: 'Cached suggestion',
                exampleBefore: 'Before',
                exampleAfter: 'After',
            }],
            creditsRemaining: 99,
            source: 'gemini',
        });
        vi.mocked(checkCredits).mockResolvedValue({
            hasCredits: false,
            required: 5,
            available: 0,
        });

        const event = {
            httpMethod: 'POST',
            headers: TEST_HEADERS,
            body: JSON.stringify({ resumeText: 'test resume', jobText: 'React job' }),
        } as Partial<HandlerEvent>;

        const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
        const body = JSON.parse(result.body);

        expect(result.statusCode).toBe(200);
        expect(result.headers?.['X-Cache']).toBe('HIT');
        expect(body.cards).toHaveLength(1);
        expect(body.creditsRemaining).toBe(0);
        expect(optimizeResume).not.toHaveBeenCalled();
        expect(consumeCredits).not.toHaveBeenCalled();
    });

    it('does not cache or return paid output when credit consumption loses the race', async () => {
        vi.mocked(optimizeResume).mockResolvedValue({
            match_score: 60,
            missing_keywords: ['React'],
            keywords_to_keep: [],
            keywords_to_avoid: [],
        });
        vi.mocked(consumeCredits).mockResolvedValue({
            success: false,
            creditsRemaining: 0,
        });

        const event = {
            httpMethod: 'POST',
            headers: TEST_HEADERS,
            body: JSON.stringify({ resumeText: 'test resume', jobText: 'React job' }),
        } as Partial<HandlerEvent>;

        const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;

        expect(result.statusCode).toBe(403);
        expect(JSON.parse(result.body).error).toBe('Insufficient credits');
        expect(setCached).not.toHaveBeenCalled();
    });

    describe('card generation', () => {
        it('generates headline card when suggested_headline exists', async () => {
            (optimizeResume as any).mockResolvedValue({
                suggested_headline: 'Senior Software Engineer',
                original_headline: 'Developer',
                match_score: 65
            });

            const event = {
                httpMethod: 'POST',
                headers: TEST_HEADERS,
                body: JSON.stringify({ resumeText: 'test', jobText: 'job' })
            } as Partial<HandlerEvent>;

            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            const body = JSON.parse(result.body);

            expect(body.cards).toContainEqual(
                expect.objectContaining({
                    section: 'Headline',
                    exampleAfter: 'Senior Software Engineer'
                })
            );
        });

        it('generates summary card when summary_rewrite exists', async () => {
            (optimizeResume as any).mockResolvedValue({
                summary_rewrite: 'Optimized summary text',
                original_summary: 'Original summary',
                match_score: 70
            });

            const event = {
                httpMethod: 'POST',
                headers: TEST_HEADERS,
                body: JSON.stringify({ resumeText: 'test', jobText: 'job' })
            } as Partial<HandlerEvent>;

            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            const body = JSON.parse(result.body);

            expect(body.cards).toContainEqual(
                expect.objectContaining({
                    section: 'Summary',
                    exampleAfter: 'Optimized summary text'
                })
            );
        });

        it('generates experience cards from bullet_point_improvements', async () => {
            (optimizeResume as any).mockResolvedValue({
                bullet_improvements: [
                    { original: 'Did stuff', improved: 'Led team of 5 to deliver project' }
                ],
                match_score: 68
            });

            const event = {
                httpMethod: 'POST',
                headers: TEST_HEADERS,
                body: JSON.stringify({ resumeText: 'test', jobText: 'job' })
            } as Partial<HandlerEvent>;

            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            const body = JSON.parse(result.body);

            expect(body.cards.filter((c: any) => c.section === 'Experience')).toHaveLength(1);
        });

        it('returns empty cards array when no optimizations exist', async () => {
            (optimizeResume as any).mockResolvedValue({ match_score: 50 });

            const event = {
                httpMethod: 'POST',
                headers: TEST_HEADERS,
                body: JSON.stringify({ resumeText: 'test', jobText: 'job' })
            } as Partial<HandlerEvent>;

            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            const body = JSON.parse(result.body);

            // With no optimizations, fallback card should be generated
            expect(body.cards.length).toBeGreaterThan(0);
        });

        it('clamps score and improvement so projected score cannot exceed 100', async () => {
            (optimizeResume as any).mockResolvedValue({
                match_score: 95,
                after_score: 150,
                missing_keywords: ['React']
            });

            const event = {
                httpMethod: 'POST',
                headers: TEST_HEADERS,
                body: JSON.stringify({ resumeText: 'test', jobText: 'job' })
            } as Partial<HandlerEvent>;

            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            const body = JSON.parse(result.body);

            expect(result.statusCode).toBe(200);
            expect(body.matchScoring.beforeScore).toBe(95);
            expect(body.matchScoring.estimatedImprovement).toBe(5);
            expect(setCached).toHaveBeenCalledWith(
                'mock-cache-key',
                expect.not.objectContaining({ creditsRemaining: expect.anything() }),
                600,
            );
        });

        it('fails instead of returning a placeholder score when AI omits score data', async () => {
            (optimizeResume as any).mockResolvedValue({
                missing_keywords: ['React']
            });

            const event = {
                httpMethod: 'POST',
                headers: TEST_HEADERS,
                body: JSON.stringify({ resumeText: 'test', jobText: 'job' })
            } as Partial<HandlerEvent>;

            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(500);
            expect(JSON.parse(result.body).error).toBe('Failed to optimize resume');
        });
    });

    describe('error handling', () => {
        it('returns 500 when AI service fails', async () => {
            (optimizeResume as any).mockRejectedValue(new Error('AI service unavailable'));

            const event = {
                httpMethod: 'POST',
                headers: TEST_HEADERS,
                body: JSON.stringify({ resumeText: 'test', jobText: 'job' })
            } as Partial<HandlerEvent>;

            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(500);
            expect(JSON.parse(result.body).error).toBe('Failed to optimize resume');
        });
    });
});
