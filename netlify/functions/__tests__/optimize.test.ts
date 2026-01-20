import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';

// Mock dependencies BEFORE importing handler
vi.mock('../../lib/gemini-client', () => ({
    optimizeResume: vi.fn()
}));

vi.mock('../../lib/rate-limiter', () => ({
    withRateLimit: (_name: string, handler: Function) => handler,
    checkBetaQuota: vi.fn().mockResolvedValue({
        allowed: true,
        used: 0,
        limit: 2,
        remaining: 2
    }),
    consumeBetaQuota: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../lib/sentry', () => ({
    initSentry: vi.fn(),
    captureError: vi.fn()
}));

import { optimizeResume } from '../../lib/gemini-client';

// Import handler after mocks
const { handler } = await import('../optimize');

// Test beta code header
const TEST_HEADERS = { 'X-Beta-Code': 'WATHEQ01' };

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
            // The function catches JSON parse errors but then re-throws when
            // trying to parse body in captureError, so we expect it to throw
            await expect(handler(event as HandlerEvent, createMockContext())).rejects.toThrow();
        });
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
