import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';

// Mock dependencies
const mockNormalizeResume = {
    buildResumeDocument: vi.fn()
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

vi.mock('../../lib/normalize-resume.js', () => mockNormalizeResume);
vi.mock('../../lib/resumeText.js', () => mockResumeText);
vi.mock('../../lib/rate-limiter', () => mockRateLimiter);
vi.mock('../../lib/sentry', () => mockSentry);

// Mock global fetch for DeepSeek OCR
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import handler
const { handler } = await import('../parse-resume');

// Helper to create mock context
const createMockContext = (): HandlerContext => ({
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'parse-resume',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:parse-resume',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/parse-resume',
    logStreamName: '2024/01/01/[$LATEST]test',
    getRemainingTimeInMillis: () => 30000,
    done: () => { },
    fail: () => { },
    succeed: () => { },
    clientContext: undefined
});

describe('parse-resume function', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.DEEPSEEK_API_KEY = 'test-key';
    });

    describe('basic validation', () => {
        it('rejects GET requests with 405', async () => {
            const event = { httpMethod: 'GET', body: null } as Partial<HandlerEvent>;
            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(405);
        });

        it('handles OPTIONS requests (CORS)', async () => {
            const event = { httpMethod: 'OPTIONS', body: null } as Partial<HandlerEvent>;
            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(200);
            expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
        });
    });

    describe('text parsing', () => {
        it('processes valid text input', async () => {
            const text = "John Doe\nSoftware Engineer";
            mockNormalizeResume.buildResumeDocument.mockReturnValue({
                plainText: text,
                sections: []
            });

            const event = {
                httpMethod: 'POST',
                body: JSON.stringify({ kind: 'text', value: text })
            } as Partial<HandlerEvent>;

            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(200);

            const body = JSON.parse(result.body);
            expect(body.quality).toBeGreaterThan(0);
            expect(body.usedOCR).toBe(false);
            expect(mockNormalizeResume.buildResumeDocument).toHaveBeenCalledWith(text);
        });

        it('warns about low quality input', async () => {
            const text = "Too short";
            mockNormalizeResume.buildResumeDocument.mockReturnValue({
                plainText: text,
                sections: []
            });

            const event = {
                httpMethod: 'POST',
                body: JSON.stringify({ kind: 'text', value: text })
            } as Partial<HandlerEvent>;

            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            const body = JSON.parse(result.body);

            expect(body.warnings).toHaveLength(1);
            expect(body.warnings[0]).toContain('Text quality is low');
        });
    });

    describe('file parsing', () => {
        it('successfully parses valid PDF file', async () => {
            const mockText = "Valid resume content with significant length and keywords like experience and education.";
            mockResumeText.inferMimeType.mockReturnValue('application/pdf');
            mockResumeText.extractPlainTextFromArrayBuffer.mockResolvedValue(mockText);
            mockNormalizeResume.buildResumeDocument.mockReturnValue({
                plainText: mockText,
                sections: []
            });

            const event = {
                httpMethod: 'POST',
                body: JSON.stringify({
                    kind: 'file',
                    name: 'test.pdf',
                    data: Buffer.from('fake-pdf-content').toString('base64')
                })
            } as Partial<HandlerEvent>;

            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(200);
            expect(JSON.parse(result.body).usedOCR).toBe(false);
        });

        it('rejects too large files', async () => {
            // Mock file larger than 8MB
            const largeData = Buffer.alloc(8 * 1024 * 1024 + 100).toString('base64');

            const event = {
                httpMethod: 'POST',
                body: JSON.stringify({
                    kind: 'file',
                    name: 'large.pdf',
                    data: largeData
                })
            } as Partial<HandlerEvent>;

            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            expect(result.statusCode).toBe(400);
            expect(JSON.parse(result.body).error).toContain('too large');
        });
    });

    describe('OCR fallback', () => {
        it('attempts OCR when text extraction is low quality', async () => {
            // Mock poor extraction result
            mockResumeText.inferMimeType.mockReturnValue('application/pdf');
            mockResumeText.extractPlainTextFromArrayBuffer.mockResolvedValue("Garbled extraction result");

            // Mock successful OCR response
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                name: "OCR Name",
                                summary: "Recovered summary from OCR"
                            })
                        }
                    }]
                })
            });

            mockNormalizeResume.buildResumeDocument.mockReturnValue({
                plainText: "OCR Name\n\nSUMMARY\nRecovered summary from OCR",
                sections: []
            });

            const event = {
                httpMethod: 'POST',
                body: JSON.stringify({
                    kind: 'file',
                    name: 'scanned.pdf',
                    data: Buffer.from('scanned-content').toString('base64')
                })
            } as Partial<HandlerEvent>;

            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            const body = JSON.parse(result.body);

            expect(result.statusCode).toBe(200);
            expect(body.usedOCR).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('deepseek.com'),
                expect.anything()
            );
        });

        it('falls back to original text if OCR fails', async () => {
            // Mock poor extraction result
            const poorText = "Garbled extraction result";
            mockResumeText.inferMimeType.mockReturnValue('application/pdf');
            mockResumeText.extractPlainTextFromArrayBuffer.mockResolvedValue(poorText);

            // Mock failed OCR response
            mockFetch.mockRejectedValue(new Error('OCR Failed'));

            mockNormalizeResume.buildResumeDocument.mockReturnValue({
                plainText: poorText,
                sections: []
            });

            const event = {
                httpMethod: 'POST',
                body: JSON.stringify({
                    kind: 'file',
                    name: 'scanned.pdf',
                    data: Buffer.from('scanned-content').toString('base64')
                })
            } as Partial<HandlerEvent>;

            const result = await handler(event as HandlerEvent, createMockContext()) as HandlerResponse;
            const body = JSON.parse(result.body);

            expect(result.statusCode).toBe(200);
            expect(body.usedOCR).toBe(false);
            expect(body.warnings).toContainEqual(expect.stringContaining('Text extraction quality is low'));
        });
    });
});
