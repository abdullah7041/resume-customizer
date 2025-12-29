import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';

// Mock dependencies
const mockSupabase = {
    storage: {
        from: vi.fn().mockReturnThis(),
        download: vi.fn()
    }
};

const mockCreateClient = vi.fn(() => mockSupabase);

const mockResumeText = {
    extractPlainTextFromArrayBuffer: vi.fn(),
    inferMimeType: vi.fn()
};

const mockRateLimiter = {
    withRateLimit: (_name: string, handler: Function) => handler
};

const mockSentry = {
    initSentry: vi.fn(),
    captureError: vi.fn()
};

vi.mock('@supabase/supabase-js', () => ({
    createClient: mockCreateClient
}));
vi.mock('../../lib/resumeText.js', () => mockResumeText);
vi.mock('../../lib/rate-limiter', () => mockRateLimiter);
vi.mock('../../lib/sentry', () => mockSentry);

// Import handler
const { handler } = await import('../match-score');

// Helper to create mock context
const createMockContext = (): HandlerContext => ({
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'match-score',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:match-score',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/match-score',
    logStreamName: '2024/01/01/[$LATEST]test',
    getRemainingTimeInMillis: () => 30000,
    done: () => { },
    fail: () => { },
    succeed: () => { },
    clientContext: undefined
});

describe('match-score function', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup environment variables for Supabase
        process.env.SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_ANON_KEY = 'test-key';
    });

    describe('input validation', () => {
        it('rejects GET requests', async () => {
            const event = { httpMethod: 'GET', body: null } as Partial<HandlerEvent>;
            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(405);
        });

        it('requires job description', async () => {
            const event = {
                httpMethod: 'POST',
                body: JSON.stringify({ resumeText: 'some text' })
            } as Partial<HandlerEvent>;

            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(400);
            expect(JSON.parse(result.body).error).toContain('Job description');
        });

        it('requires resume content (text or fileId)', async () => {
            const event = {
                httpMethod: 'POST',
                body: JSON.stringify({ jobDesc: 'some job' })
            } as Partial<HandlerEvent>;

            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(400);
            expect(JSON.parse(result.body).error).toContain('Resume text');
        });
    });

    describe('score calculation', () => {
        it('calculates perfect match for identical text', async () => {
            const text = "software engineer javascript typescript react";
            const event = {
                httpMethod: 'POST',
                body: JSON.stringify({
                    resumeText: text,
                    jobDesc: text
                })
            } as Partial<HandlerEvent>;

            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            const body = JSON.parse(result.body);

            expect(result.statusCode).toBe(200);
            expect(body.score).toBeGreaterThan(90);
            expect(body.similarity).toBeCloseTo(1, 1);
        });

        it('calculates zero match for completely different text', async () => {
            const resume = "chef cooking food kitchen";
            const job = "software engineer computer code";

            const event = {
                httpMethod: 'POST',
                body: JSON.stringify({
                    resumeText: resume,
                    jobDesc: job
                })
            } as Partial<HandlerEvent>;

            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            const body = JSON.parse(result.body);

            // Even with no overlap, our algorithm might give a small minimum score for "substantial resume"
            // But cosine similarity should be 0
            expect(body.similarity).toBe(0);
            expect(body.missing_keywords.length).toBeGreaterThan(0);
        });
    });

    describe('supabase integration', () => {
        it('fetches resume from Supabase when resumeFileId is provided', async () => {
            // Mock successful download
            const mockBuffer = Buffer.from('resume content');
            mockSupabase.storage.download.mockResolvedValue({
                data: {
                    arrayBuffer: async () => mockBuffer,
                    type: 'text/plain'
                },
                error: null
            });

            mockResumeText.inferMimeType.mockReturnValue('text/plain');
            mockResumeText.extractPlainTextFromArrayBuffer.mockResolvedValue('resume content from supabase');

            const event = {
                httpMethod: 'POST',
                body: JSON.stringify({
                    resumeFileId: 'user/resume.txt',
                    jobDesc: 'resume content from supabase' // perfect match
                })
            } as Partial<HandlerEvent>;

            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;

            expect(result.statusCode).toBe(200);
            expect(mockCreateClient).toHaveBeenCalled();
            expect(mockSupabase.storage.download).toHaveBeenCalledWith('user/resume.txt');
        });

        it('handles Supabase download errors', async () => {
            mockSupabase.storage.download.mockResolvedValue({
                data: null,
                error: new Error('File not found')
            });

            const event = {
                httpMethod: 'POST',
                body: JSON.stringify({
                    resumeFileId: 'missing.txt',
                    jobDesc: 'job'
                })
            } as Partial<HandlerEvent>;

            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(500);
            expect(JSON.parse(result.body).error).toContain('File not found');
        });
    });
});
