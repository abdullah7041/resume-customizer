import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';

// Mock context object for Netlify functions
const mockContext: HandlerContext = {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'extract-resume-json',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:extract-resume-json',
    memoryLimitInMB: '1024',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/extract-resume-json',
    logStreamName: '2024/01/01/[$LATEST]test',
    getRemainingTimeInMillis: () => 30000,
    done: () => { },
    fail: () => { },
    succeed: () => { }
};

// Mock dependencies
const mockGeminiClient = {
    parseResumeOnly: vi.fn()
};

const mockResumeText = {
    extractPlainTextFromArrayBuffer: vi.fn(),
    inferMimeType: vi.fn()
};

const mockRateLimiter = {
    withRateLimit: (_name: string, handler: Function) => handler,
    checkBetaQuota: vi.fn().mockResolvedValue({
        allowed: true,
        used: 0,
        limit: 2,
        remaining: 2
    }),
    consumeBetaQuota: vi.fn().mockResolvedValue(undefined)
};

const mockSentry = {
    initSentry: vi.fn(),
    captureError: vi.fn()
};

vi.mock('../../lib/gemini-client', () => mockGeminiClient);
vi.mock('../../lib/resumeText.js', () => mockResumeText);
vi.mock('../../lib/rate-limiter', () => mockRateLimiter);
vi.mock('../../lib/sentry', () => mockSentry);

// Import handler
const { handler } = await import('../extract-resume-json');


describe('extract-resume-json function', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.OPENROUTER_API_KEY = 'test-key';
    });

    it('rejects GET requests with 405', async () => {
        const event = { httpMethod: 'GET', body: null } as Partial<HandlerEvent>;
        // function signature only takes 1 argument
        const result = await handler(event as any, mockContext) as HandlerResponse;
        expect(result.statusCode).toBe(405);
    });

    it('returns 500 if OPENROUTER_API_KEY is not set', async () => {
        delete process.env.OPENROUTER_API_KEY;
        const event = {
            httpMethod: 'POST',
            body: '{}',
            headers: { 'X-Beta-Code': 'WATHEQ01' }
        } as Partial<HandlerEvent>;
        const result = await handler(event as any, mockContext) as HandlerResponse;
        expect(result.statusCode).toBe(500);
        expect(result.body).toContain('Server configuration error');
    });

    it('handles direct text input', async () => {
        const text = "John Doe\nSoftware Engineer";
        const mockAnalysis = {
            basics: { name: "John Doe", label: "Software Engineer" },
            meta: { raw_text: text }
        };
        mockGeminiClient.parseResumeOnly.mockResolvedValue(mockAnalysis);

        const event = {
            httpMethod: 'POST',
            body: JSON.stringify({ kind: 'text', value: text }),
            headers: { 'X-Beta-Code': 'WATHEQ01' }
        } as Partial<HandlerEvent>;

        const result = await handler(event as any, mockContext) as HandlerResponse;
        expect(result.statusCode).toBe(200);

        const body = JSON.parse(result.body);
        expect(body.document.basics.name).toBe("John Doe");
        expect(mockGeminiClient.parseResumeOnly).toHaveBeenCalledWith(text, false);
    });

    it('handles file input with pre-extraction success', async () => {
        const mockText = "Valid PDF Content";
        const mockAnalysis = {
            basics: { name: "PDF User" },
            meta: { raw_text: mockText }
        };

        mockResumeText.inferMimeType.mockReturnValue('application/pdf');
        mockResumeText.extractPlainTextFromArrayBuffer.mockResolvedValue(mockText);
        mockGeminiClient.parseResumeOnly.mockResolvedValue(mockAnalysis);

        const event = {
            httpMethod: 'POST',
            body: JSON.stringify({
                kind: 'file',
                name: 'test.pdf',
                data: Buffer.from('fake-pdf').toString('base64'),
                mime: 'application/pdf'
            }),
            headers: { 'X-Beta-Code': 'WATHEQ01' }
        } as Partial<HandlerEvent>;

        const result = await handler(event as any, mockContext) as HandlerResponse;
        expect(result.statusCode).toBe(200);

        const body = JSON.parse(result.body);
        expect(body.document.plainText).toBe(mockText);
        // Should rely on pre-extraction
    });

    it('fails gracefully when Gemini returns placeholder', async () => {
        const placeholderText = "Please provide the resume text";
        mockResumeText.extractPlainTextFromArrayBuffer.mockResolvedValue("");
        mockGeminiClient.parseResumeOnly.mockResolvedValue({
            meta: { raw_text: placeholderText },
            plainText: placeholderText
        });

        const event = {
            httpMethod: 'POST',
            body: JSON.stringify({
                kind: 'file',
                name: 'scanned.pdf',
                data: Buffer.from('image-pdf').toString('base64')
            }),
            headers: { 'X-Beta-Code': 'WATHEQ01' }
        } as Partial<HandlerEvent>;

        const result = await handler(event as any, mockContext) as HandlerResponse;
        // Expect 422 Unprocessable Entity as defined in the handler logic
        expect(result.statusCode).toBe(422);
    });

    it('handles Gemini API errors', async () => {
        mockGeminiClient.parseResumeOnly.mockRejectedValue(new Error('rate limit exceeded'));

        const event = {
            httpMethod: 'POST',
            body: JSON.stringify({ kind: 'text', value: 'test' }),
            headers: { 'X-Beta-Code': 'WATHEQ01' }
        } as Partial<HandlerEvent>;

        const result = await handler(event as any, mockContext) as HandlerResponse;
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toContain('AI service is currently busy');
    });
});
