import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRequestEvidenceSources, evidenceInputOmissions, requestEvidenceResumeText } from '../optimization-evidence.js';

const mocks = vi.hoisted(() => ({
  optimizeResume: vi.fn(), executeAiContract: vi.fn(), getCached: vi.fn(), setCached: vi.fn(),
  checkCredits: vi.fn(), consumeCredits: vi.fn(), getUser: vi.fn(),
}));
vi.mock('../gemini-client.js', () => ({ optimizeResume: mocks.optimizeResume }));
vi.mock('../ai-contracts/executor.js', () => ({ executeAiContract: mocks.executeAiContract }));
vi.mock('../redis-cache.js', () => ({ buildOptimizeCacheKey: () => 'evidence-flow', getCached: mocks.getCached, setCached: mocks.setCached }));
vi.mock('../credit-manager.js', () => ({ FEATURE_COSTS: { optimize: 5 }, checkCredits: mocks.checkCredits,
  consumeCredits: mocks.consumeCredits, addCredits: vi.fn(), isEmailVerified: () => true }));
vi.mock('../supabase-client.js', () => ({ getSupabaseClient: () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock('../rate-limiter.js', () => ({ withRateLimit: (_: string, handler: unknown) => handler,
  checkRateLimitForRequest: async () => ({ allowed: true }), checkFreePreviewRateLimitForRequest: async () => ({ allowed: true }) }));
vi.mock('../sentry.js', () => ({ initSentry: vi.fn(), captureError: vi.fn(), summarizeErrorForLog: () => 'error' }));
vi.mock('../vulnerability-detector.js', () => ({ detectVulnerabilities: () => [] }));

const { handler: ordinary } = await import('../../functions/optimize.js');
const { default: streaming } = await import('../../functions/optimize-stream.js');
const { handler: refine } = await import('../../functions/refine-bullet.js');
const resumeText = 'Maintained customer reports.\nBuilt Excel dashboards at Example A.';
const jobText = 'Reporting analyst';
const source = buildRequestEvidenceSources(resumeText)[0];
const valid = { original: source.text, improved: 'Maintained useful customer reports.',
  target_id: source.targetId, evidence_references: [{ sourceId: source.id, quote: source.text }],
  issue: 'Vague outcome', rationale: 'Keeps the task qualitative' };
const invalid = { ...valid, improved: 'Saved 40% of costs.', evidence_references: [{ sourceId: 'missing', quote: source.text }] };
const output = () => ({ match_score: 60, bullet_improvements: [valid, invalid] });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCached.mockResolvedValue(null);
  mocks.setCached.mockResolvedValue(undefined);
  mocks.checkCredits.mockResolvedValue({ hasCredits: true, required: 5, available: 10 });
  mocks.consumeCredits.mockResolvedValue({ success: true, creditsRemaining: 5 });
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'u', email: 'user@example.com' } }, error: null });
  mocks.optimizeResume.mockResolvedValue(output());
});

describe('evidence at editing endpoints', () => {
  it('keeps one valid ordinary edit and rejects its invalid sibling before billing', async () => {
    const response = await ordinary({ httpMethod: 'POST', headers: { authorization: 'Bearer token' },
      body: JSON.stringify({ resumeText, jobText }) } as never, {} as never) as { statusCode: number; body: string };
    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0].evidence.status).toBe('needs_review');
    expect(body.evidenceDiagnostics).toMatchObject([{ status: 422, code: 'EVIDENCE_INVALID' }]);
    expect(body.evidenceSources[0]).toEqual(source);
    expect(mocks.consumeCredits).toHaveBeenCalledTimes(1);
    expect(mocks.optimizeResume.mock.calls[0][6].evidenceSources[0]).toEqual(source);
  });

  it('returns the same evidence from the streaming result', async () => {
    const response = await streaming(new Request('http://localhost/api/optimize-stream', { method: 'POST',
      headers: { authorization: 'Bearer token' }, body: JSON.stringify({ resumeText, jobText }) }));
    const text = await response.text();
    const result = JSON.parse(text.match(/event: result\ndata: ([^\n]+)/)?.[1] || '{}');
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].evidence.status).toBe('needs_review');
    expect(result.evidenceDiagnostics).toMatchObject([{ status: 422, code: 'EVIDENCE_INVALID' }]);
    expect(result.evidenceInputOmissions).toEqual({ resumeCharacters: 0, clarificationCharacters: 0 });
    expect(mocks.consumeCredits).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported refinement without returning or billing an edit', async () => {
    mocks.executeAiContract.mockResolvedValue({ improved: 'Saved 40% of costs.', issue: '', rationale: '',
      target_id: source.targetId, evidence_references: [{ sourceId: source.id, quote: source.text }] });
    const response = await refine({ httpMethod: 'POST', headers: { authorization: 'Bearer token' },
      body: JSON.stringify({ original: source.text, currentImproved: source.text, userInstruction: 'Add impact', resumeText }) } as never, {} as never) as { statusCode: number; body: string };
    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body)).toMatchObject({ status: 422, code: 'EVIDENCE_INVALID' });
  });

  it('returns fresh evidence for a sourced refinement', async () => {
    mocks.executeAiContract.mockResolvedValue({ improved: 'Maintained useful customer reports.', issue: '', rationale: '',
      target_id: source.targetId, evidence_references: [{ sourceId: source.id, quote: source.text }] });
    const response = await refine({ httpMethod: 'POST', headers: { authorization: 'Bearer token' },
      body: JSON.stringify({ original: source.text, currentImproved: source.text, userInstruction: 'Clarify task', resumeText }) } as never, {} as never) as { statusCode: number; body: string };
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ evidence: { status: 'needs_review', targetId: source.targetId }, evidenceSources: buildRequestEvidenceSources(resumeText) });
    expect(JSON.parse(response.body).evidenceInputOmissions).toEqual({ resumeCharacters: 0, clarificationCharacters: 0 });
    expect(mocks.executeAiContract.mock.calls[0][1].evidenceSources).toEqual(buildRequestEvidenceSources(resumeText));
  });

  it('does not charge when all proposed edits lack evidence', async () => {
    mocks.optimizeResume.mockResolvedValue({ match_score: 60, bullet_improvements: [invalid] });
    const response = await ordinary({ httpMethod: 'POST', headers: { authorization: 'Bearer token' },
      body: JSON.stringify({ resumeText, jobText }) } as never, {} as never) as { statusCode: number };
    expect(response.statusCode).toBe(500);
    expect(mocks.consumeCredits).not.toHaveBeenCalled();
    expect(mocks.setCached).not.toHaveBeenCalled();
  });

  it('regenerates a legacy cache without evidence before charging', async () => {
    mocks.getCached.mockResolvedValue({ cards: [{ section: 'Experience', exampleAfter: 'Old edit' }] });
    const response = await ordinary({ httpMethod: 'POST', headers: { authorization: 'Bearer token' },
      body: JSON.stringify({ resumeText, jobText }) } as never, {} as never) as { statusCode: number; body: string; headers: Record<string, string> };
    expect(response.statusCode).toBe(200);
    expect(response.headers['X-Cache']).not.toBe('HIT');
    expect(JSON.parse(response.body)).toMatchObject({ evidenceVersion: 2 });
    expect(mocks.optimizeResume).toHaveBeenCalledTimes(1);
    expect(mocks.consumeCredits).toHaveBeenCalledTimes(1);
  });

  it('returns a versioned evidence cache without generation or billing', async () => {
    mocks.getCached.mockResolvedValue({ evidenceVersion: 2, evidenceSources: [source], cards: [{ evidence: {
      version: 1, status: 'needs_review', references: [{ sourceId: source.id, quote: source.text }],
    } }] });
    const response = await ordinary({ httpMethod: 'POST', headers: { authorization: 'Bearer token' },
      body: JSON.stringify({ resumeText, jobText }) } as never, {} as never) as { statusCode: number; headers: Record<string, string> };
    expect(response.headers['X-Cache']).toBe('HIT');
    expect(mocks.optimizeResume).not.toHaveBeenCalled();
    expect(mocks.consumeCredits).not.toHaveBeenCalled();
  });

  it('keeps evidence outside the provider-visible resume window out of the request', () => {
    const sources = buildRequestEvidenceSources(`${'A'.repeat(15000)}\nHidden employer achievement`);
    expect(sources.some(item => item.text.includes('Hidden employer'))).toBe(false);
    expect(JSON.stringify(sources.map(({ id, targetId, kind, text }) => ({ id, targetId, kind, text }))).length).toBeLessThanOrEqual(40000);
    expect(sources.length).toBeGreaterThan(0);
    for (const line of requestEvidenceResumeText(sources).split('\n')) {
      expect(sources.some(source => source.kind === 'resume' && source.text === line)).toBe(true);
    }
  });

  it('keeps later roles and candidate answers in a normal resume', async () => {
    const normalResume = Array.from({ length: 100 }, (_, i) => `Role ${i}: ${'A'.repeat(99)}`).join('\n');
    const userClarifications = 'Q: What was the outcome?\nA: Increased revenue by 25%';
    const sources = buildRequestEvidenceSources(normalResume, userClarifications);
    expect(normalResume.length).toBe(10889);
    expect(sources.some(item => item.text.includes('Role 99:'))).toBe(true);
    expect(sources).toContainEqual(expect.objectContaining({ kind: 'clarification', text: 'Increased revenue by 25%' }));
    expect(evidenceInputOmissions(normalResume, userClarifications, sources)).toEqual({ resumeCharacters: 0, clarificationCharacters: 0 });
    mocks.optimizeResume.mockResolvedValue({ match_score: 60, bullet_improvements: [invalid] });
    await ordinary({ httpMethod: 'POST', headers: { authorization: 'Bearer token' },
      body: JSON.stringify({ resumeText: normalResume, jobText, userClarifications }) } as never, {} as never);
    expect(mocks.optimizeResume.mock.calls[0][0]).toContain('Role 99:');
    expect(mocks.optimizeResume.mock.calls[0][6].evidenceSources).toEqual(sources);
  });

  it('discloses input omitted beyond the provider limit', async () => {
    const longResume = `${source.text}\n${'A'.repeat(40000)}`;
    const response = await ordinary({ httpMethod: 'POST', headers: { authorization: 'Bearer token' },
      body: JSON.stringify({ resumeText: longResume, jobText }) } as never, {} as never) as { statusCode: number; body: string };
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).evidenceInputOmissions).toMatchObject({ clarificationCharacters: 0 });
    expect(JSON.parse(response.body).evidenceInputOmissions.resumeCharacters).toBeGreaterThan(25000);
  });

  it('sends only source-covered resume text to the provider for a long line', async () => {
    const longResume = `Unique achievement ${'A'.repeat(14000)}\nTrailing role`;
    mocks.optimizeResume.mockResolvedValue({ match_score: 60, bullet_improvements: [invalid] });
    await ordinary({ httpMethod: 'POST', headers: { authorization: 'Bearer token' },
      body: JSON.stringify({ resumeText: longResume, jobText }) } as never, {} as never);
    const sent = mocks.optimizeResume.mock.calls[0][0] as string;
    const sentSources = mocks.optimizeResume.mock.calls[0][6].evidenceSources;
    expect(sentSources.length).toBeGreaterThan(0);
    expect(sent).toBe(requestEvidenceResumeText(sentSources));
    for (const line of sent.split('\n')) expect(sentSources.some((item: { text: string }) => item.text === line)).toBe(true);
  });

  it('keeps clarification answers separate and duplicate resume lines ambiguous', () => {
    const repeated = buildRequestEvidenceSources(`${source.text}\n${source.text}`, '[Impact]\nQ: What did you do?\nA: Built Excel dashboards');
    expect(repeated[0]).toEqual(repeated[1]);
    expect(repeated[2]).toMatchObject({ kind: 'clarification', text: 'Built Excel dashboards' });
    expect(repeated[2].targetId).not.toBe(source.targetId);
  });

  it('keeps a string clarification with a unique original target for review', async () => {
    const userClarifications = '[Impact]\nQ: Which tools did you use?\nA: Built Excel dashboards';
    const clarification = buildRequestEvidenceSources(resumeText, userClarifications).slice(-1)[0];
    mocks.optimizeResume.mockResolvedValue({ match_score: 60, bullet_improvements: [{ ...valid,
      improved: 'Maintained customer reports and built Excel dashboards.', target_id: source.targetId,
      evidence_references: [{ sourceId: clarification.id, quote: clarification.text }],
    }] });
    const response = await ordinary({ httpMethod: 'POST', headers: { authorization: 'Bearer token' },
      body: JSON.stringify({ resumeText, jobText, userClarifications }) } as never, {} as never) as { statusCode: number; body: string };
    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.cards[0].evidence).toMatchObject({ status: 'needs_review', targetId: source.targetId, reasons: ['semantic_review'] });
    expect(body.evidenceSources.slice(-1)[0]).toEqual(clarification);
    expect(mocks.consumeCredits).toHaveBeenCalledTimes(1);
  });
});
