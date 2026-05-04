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
    withRateLimit: (_name: string, handler: Function) => handler
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
const { handler } = await import('../extract-resume-json.js');


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
        // Realistic resume snippet with ≥5 words to pass the word-level isReadableText check
        const text = "John Doe\nSoftware Engineer\nExperience working with Python Django REST APIs cloud infrastructure";
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
        // Realistic pre-extracted text with ≥5 words to pass the word-level isReadableText check
        const mockText = "PDF User Software Engineer Python Django REST APIs cloud infrastructure five years experience leading teams and delivering measurable outcomes across enterprise projects.";
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
        expect(mockGeminiClient.parseResumeOnly).toHaveBeenCalledWith(mockText, false);
    });

    it('rejects scanned PDFs without attempting inline PDF AI fallback', async () => {
        mockResumeText.extractPlainTextFromArrayBuffer.mockResolvedValue("");

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
        expect(result.statusCode).toBe(422);
        expect(JSON.parse(result.body).error).toContain('Could not extract readable text');
        expect(mockGeminiClient.parseResumeOnly).not.toHaveBeenCalled();
    });

    it('rejects low-text file extraction without sending unreadable content to AI', async () => {
        mockResumeText.inferMimeType.mockReturnValue('application/pdf');
        mockResumeText.extractPlainTextFromArrayBuffer.mockResolvedValue("Name only");

        const event = {
            httpMethod: 'POST',
            body: JSON.stringify({
                kind: 'file',
                name: 'low-text.pdf',
                data: Buffer.from('low-text-pdf').toString('base64'),
                mime: 'application/pdf'
            }),
            headers: { 'X-Beta-Code': 'WATHEQ01' }
        } as Partial<HandlerEvent>;

        const result = await handler(event as any, mockContext) as HandlerResponse;
        const body = JSON.parse(result.body);

        expect(result.statusCode).toBe(422);
        expect(body.details).toContain('Scanned or image-only resumes are not currently supported');
        expect(mockGeminiClient.parseResumeOnly).not.toHaveBeenCalled();
    });

    it('handles Gemini API errors', async () => {
        // Use realistic text to pass the server-side isReadableText guard
        const realisticText = 'John Doe Software Engineer Python Django REST APIs cloud infrastructure five years';
        mockGeminiClient.parseResumeOnly.mockRejectedValue(new Error('rate limit exceeded'));

        const event = {
            httpMethod: 'POST',
            body: JSON.stringify({ kind: 'text', value: realisticText }),
            headers: { 'X-Beta-Code': 'WATHEQ01' }
        } as Partial<HandlerEvent>;

        const result = await handler(event as any, mockContext) as HandlerResponse;
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toContain('AI service is currently busy');
    });

    it('rejects CID-font garbage from kind:file upload (word-level check)', async () => {
        // Pure symbol/punctuation noise with NO pure-letter word tokens ≥2 chars.
        // This simulates what a CID-font PDF with missing ToUnicode CMap actually emits.
        // Note: we use only symbols and single chars so no token passes /^[\p{L}]{2,}$/u
        const cidGarbage = '§{¶½ú¸=§$~²◄►♦♣♠☺☻☼↑↓←→▲▼±×÷≈≠∞√∑∏∫≤≥¿¡«»—…·•°′″§¶†‡©®™¢£¥€¤ƒ'
            .repeat(8); // 450+ chars, 0 real word tokens

        mockResumeText.inferMimeType.mockReturnValue('application/pdf');
        mockResumeText.extractPlainTextFromArrayBuffer.mockResolvedValue(cidGarbage);

        const event = {
            httpMethod: 'POST',
            body: JSON.stringify({
                kind: 'file',
                name: 'CID-font-resume.pdf',
                data: Buffer.from('fake-pdf').toString('base64'),
                mime: 'application/pdf'
            }),
            headers: { 'X-Beta-Code': 'WATHEQ01' }
        } as Partial<HandlerEvent>;

        const result = await handler(event as any, mockContext) as HandlerResponse;
        // CID garbage must NOT return 200 OK with empty structured data
        expect(result.statusCode).toBe(422);
        expect(mockGeminiClient.parseResumeOnly).not.toHaveBeenCalled();
    });

    it('rejects CID-font garbage sent as kind:text (server-side defense-in-depth)', async () => {
        // Simulates what happens when the client-side isReadableText has a stale bundle
        // or bug, and garbage slips through as kind:'text'. The server must also reject it.
        // Uses pure symbols with zero pure-letter tokens so the word-level check always fails.
        const cidGarbage = '§{¶½ú¸=§$~²◄►♦♣♠☺☻☼↑↓←→▲▼±×÷≈≠∞√∑∏∫≤≥¿¡«»—…·•°′″§¶†‡©®™¢£¥€¤ƒ'
            .repeat(8); // 500+ chars, 0 real word tokens

        const event = {
            httpMethod: 'POST',
            body: JSON.stringify({ kind: 'text', value: cidGarbage }),
            headers: { 'X-Beta-Code': 'WATHEQ01' }
        } as Partial<HandlerEvent>;

        const result = await handler(event as any, mockContext) as HandlerResponse;
        // Server must catch and reject garbage even when sent as kind:'text'
        expect(result.statusCode).toBe(422);
        expect(JSON.parse(result.body).error).toContain('Could not read the uploaded file');
        // parseResumeOnly must NOT be called with garbage
        expect(mockGeminiClient.parseResumeOnly).not.toHaveBeenCalled();
    });
});
