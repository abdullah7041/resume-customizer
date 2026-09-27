import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRequestEvidenceSources } from '../optimization-evidence.js';

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

  it('keeps clarification answers separate and duplicate resume lines ambiguous', () => {
    const repeated = buildRequestEvidenceSources(`${source.text}\n${source.text}`, '[Impact]\nQ: What did you do?\nA: Built Excel dashboards');
    expect(repeated[0]).toEqual(repeated[1]);
    expect(repeated[2]).toMatchObject({ kind: 'clarification', text: 'Built Excel dashboards' });
    expect(repeated[2].targetId).not.toBe(source.targetId);
  });

  it('keeps candidate clarification provenance on an accepted edit', async () => {
    const userClarifications = '[Impact]\nQ: Which tools did you use?\nA: Built Excel dashboards';
    const clarification = buildRequestEvidenceSources(resumeText, userClarifications).at(-1)!;
    mocks.optimizeResume.mockResolvedValue({ match_score: 60, bullet_improvements: [{ ...valid,
      improved: 'Maintained customer reports and built Excel dashboards.', target_id: clarification.targetId,
      evidence_references: [{ sourceId: clarification.id, quote: clarification.text }],
    }] });
    const response = await ordinary({ httpMethod: 'POST', headers: { authorization: 'Bearer token' },
      body: JSON.stringify({ resumeText, jobText, userClarifications }) } as never, {} as never) as { statusCode: number; body: string };
    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.cards[0].evidence).toMatchObject({ status: 'needs_review', targetId: clarification.targetId });
    expect(body.evidenceSources.at(-1)).toEqual(clarification);
  });
});
