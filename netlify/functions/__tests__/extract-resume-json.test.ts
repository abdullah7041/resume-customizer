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
    checkGuestPreviewRateLimit: vi.fn(
        (): Promise<{ allowed: boolean; response?: HandlerResponse }> => Promise.resolve({ allowed: true })
    )
};

const mockSupabaseClient = {
    auth: {
        getUser: vi.fn()
    }
};

const mockSupabaseClientModule = {
    getSupabaseClient: vi.fn(() => mockSupabaseClient)
};

const mockSentry = {
    initSentry: vi.fn(),
    captureError: vi.fn(),
    summarizeErrorForLog: vi.fn((error: unknown) => error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) })
};

vi.mock('../../lib/gemini-client', () => mockGeminiClient);
vi.mock('../../lib/resumeText.js', () => mockResumeText);
vi.mock('../../lib/rate-limiter', () => mockRateLimiter);
vi.mock('../../lib/supabase-client.js', () => mockSupabaseClientModule);
vi.mock('../../lib/sentry', () => mockSentry);

// Import handler
const { handler } = await import('../extract-resume-json.js');


describe('extract-resume-json function', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.OPENROUTER_API_KEY = 'test-key';
        mockSupabaseClientModule.getSupabaseClient.mockReturnValue(mockSupabaseClient);
        mockSupabaseClient.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-1', email: 'user@example.com' } },
            error: null,
        });
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
            headers: { Authorization: 'Bearer test-token' }
        } as Partial<HandlerEvent>;
        const result = await handler(event as any, mockContext) as HandlerResponse;
        expect(result.statusCode).toBe(500);
        expect(result.body).toContain('Server configuration error');
    });

    it('requires authentication before parsing resume content', async () => {
        const event = {
            httpMethod: 'POST',
            body: JSON.stringify({ kind: 'text', value: 'John Doe Software Engineer Python Django REST APIs cloud infrastructure' }),
            headers: {}
        } as Partial<HandlerEvent>;

        const result = await handler(event as any, mockContext) as HandlerResponse;
        expect(result.statusCode).toBe(401);
        expect(mockGeminiClient.parseResumeOnly).not.toHaveBeenCalled();
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
            headers: { Authorization: 'Bearer test-token' }
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
            headers: { Authorization: 'Bearer test-token' }
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
            headers: { Authorization: 'Bearer test-token' }
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
            headers: { Authorization: 'Bearer test-token' }
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
            headers: { Authorization: 'Bearer test-token' }
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
            headers: { Authorization: 'Bearer test-token' }
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
            headers: { Authorization: 'Bearer test-token' }
        } as Partial<HandlerEvent>;

        const result = await handler(event as any, mockContext) as HandlerResponse;
        // Server must catch and reject garbage even when sent as kind:'text'
        expect(result.statusCode).toBe(422);
        expect(JSON.parse(result.body).error).toContain('Could not read the uploaded file');
        // parseResumeOnly must NOT be called with garbage
        expect(mockGeminiClient.parseResumeOnly).not.toHaveBeenCalled();
    });

    describe('guest preview parse path', () => {
        it('rejects malformed JSON body with 400', async () => {
            const event = {
                httpMethod: 'POST',
                body: '{not json',
                headers: {}
            } as Partial<HandlerEvent>;

            const result = await handler(event as any, mockContext) as HandlerResponse;
            expect(result.statusCode).toBe(400);
            expect(JSON.parse(result.body).error).toContain('Invalid JSON');
        });

        it('rejects unauthenticated request without guestPreview with 401', async () => {
            const event = {
                httpMethod: 'POST',
                body: JSON.stringify({ kind: 'text', value: 'John Doe Software Engineer Python Django REST APIs cloud infrastructure' }),
                headers: {}
            } as Partial<HandlerEvent>;

            const result = await handler(event as any, mockContext) as HandlerResponse;
            expect(result.statusCode).toBe(401);
            expect(mockGeminiClient.parseResumeOnly).not.toHaveBeenCalled();
        });

        it('allows unauthenticated request with guestPreview: true', async () => {
            const text = "John Doe\nSoftware Engineer\nExperience working with Python Django REST APIs cloud infrastructure";
            const mockAnalysis = {
                basics: { name: "John Doe", label: "Software Engineer" },
                meta: { raw_text: text }
            };
            mockGeminiClient.parseResumeOnly.mockResolvedValue(mockAnalysis);

            const event = {
                httpMethod: 'POST',
                body: JSON.stringify({ kind: 'text', value: text, guestPreview: true }),
                headers: {}
            } as Partial<HandlerEvent>;

            const result = await handler(event as any, mockContext) as HandlerResponse;
            expect(result.statusCode).toBe(200);
            expect(mockSupabaseClient.auth.getUser).not.toHaveBeenCalled();
            const body = JSON.parse(result.body);
            expect(body.document.basics.name).toBe("John Doe");
        });

        it('allows guest preview pasted text under 20k characters', async () => {
            const text = "Jane Doe\nBusiness Analyst\nExperience improving finance operations dashboards and stakeholder reporting";
            mockGeminiClient.parseResumeOnly.mockResolvedValue({
                basics: { name: "Jane Doe", label: "Business Analyst" },
                meta: { raw_text: text }
            });

            const event = {
                httpMethod: 'POST',
                body: JSON.stringify({ kind: 'text', value: text, guestPreview: true }),
                headers: {}
            } as Partial<HandlerEvent>;

            const result = await handler(event as any, mockContext) as HandlerResponse;
            expect(result.statusCode).toBe(200);
            expect(mockSupabaseClient.auth.getUser).not.toHaveBeenCalled();
            expect(mockGeminiClient.parseResumeOnly).toHaveBeenCalledWith(text, false);
        });

        it('applies stricter size limits to guest preview text payloads', async () => {
            // Over the 20k guest limit, under the 50k authenticated limit
            const guestTooLong = 'a '.repeat(11_000); // ~22,000 chars

            const guestEvent = {
                httpMethod: 'POST',
                body: JSON.stringify({ kind: 'text', value: guestTooLong, guestPreview: true }),
                headers: {}
            } as Partial<HandlerEvent>;

            const guestResult = await handler(guestEvent as any, mockContext) as HandlerResponse;
            expect(guestResult.statusCode).toBe(413);
            expect(mockGeminiClient.parseResumeOnly).not.toHaveBeenCalled();

            // Same payload size, authenticated — not subject to the guest limit
            const realisticPrefix = 'John Doe Software Engineer Python Django REST APIs cloud infrastructure delivery teams. '.repeat(5);
            const realisticText = `${realisticPrefix}${guestTooLong}`;
            mockGeminiClient.parseResumeOnly.mockResolvedValue({
                basics: { name: "John Doe" },
                meta: { raw_text: realisticText }
            });

            const authEvent = {
                httpMethod: 'POST',
                body: JSON.stringify({ kind: 'text', value: realisticText }),
                headers: { Authorization: 'Bearer test-token' }
            } as Partial<HandlerEvent>;

            const authResult = await handler(authEvent as any, mockContext) as HandlerResponse;
            expect(authResult.statusCode).toBe(200);
            expect(mockGeminiClient.parseResumeOnly).toHaveBeenCalled();
        });

        it('rejects guest preview text payloads sourced from files over 2MB', async () => {
            const text = "John Doe\nSoftware Engineer\nExperience working with Python Django REST APIs cloud infrastructure";
            const event = {
                httpMethod: 'POST',
                body: JSON.stringify({
                    kind: 'text',
                    value: text,
                    guestPreview: true,
                    sourceInputKind: 'file',
                    sourceWasFile: true,
                    sourceFileSizeBytes: 2 * 1024 * 1024 + 1,
                }),
                headers: {}
            } as Partial<HandlerEvent>;

            const result = await handler(event as any, mockContext) as HandlerResponse;
            expect(result.statusCode).toBe(413);
            expect(JSON.parse(result.body).error).toContain('Preview files are limited to 2MB');
            expect(mockGeminiClient.parseResumeOnly).not.toHaveBeenCalled();
        });

        it('fails closed when anonymous rate limiting is unavailable in production', async () => {
            mockRateLimiter.checkGuestPreviewRateLimit.mockResolvedValueOnce({
                allowed: false,
                response: {
                    statusCode: 503,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Preview is temporarily unavailable. Please sign in to continue, or try again shortly.' }),
                },
            });

            const event = {
                httpMethod: 'POST',
                body: JSON.stringify({ kind: 'text', value: 'John Doe Software Engineer Python Django REST APIs cloud infrastructure', guestPreview: true }),
                headers: {}
            } as Partial<HandlerEvent>;

            const result = await handler(event as any, mockContext) as HandlerResponse;
            expect(result.statusCode).toBe(503);
            expect(JSON.parse(result.body).error).toContain('Preview is temporarily unavailable');
            expect(mockGeminiClient.parseResumeOnly).not.toHaveBeenCalled();
        });

        it('authenticated parse path is unchanged', async () => {
            const text = "John Doe\nSoftware Engineer\nExperience working with Python Django REST APIs cloud infrastructure";
            const mockAnalysis = {
                basics: { name: "John Doe", label: "Software Engineer" },
                meta: { raw_text: text }
            };
            mockGeminiClient.parseResumeOnly.mockResolvedValue(mockAnalysis);

            const event = {
                httpMethod: 'POST',
                body: JSON.stringify({ kind: 'text', value: text }),
                headers: { Authorization: 'Bearer test-token' }
            } as Partial<HandlerEvent>;

            const result = await handler(event as any, mockContext) as HandlerResponse;
            expect(result.statusCode).toBe(200);

            const body = JSON.parse(result.body);
            expect(body.document.basics.name).toBe("John Doe");
            expect(mockGeminiClient.parseResumeOnly).toHaveBeenCalledWith(text, false);
            expect(mockRateLimiter.checkGuestPreviewRateLimit).not.toHaveBeenCalled();
        });
    });
});
