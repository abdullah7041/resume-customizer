import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trustResume } from '../../../src/__tests__/fixtures/candidate-trust.js';
import { buildRequestEvidenceSources } from '../optimization-evidence.js';

const mocks = vi.hoisted(() => ({ optimizeResume: vi.fn(), getCached: vi.fn(), setCached: vi.fn(),
  checkCredits: vi.fn(), consumeCredits: vi.fn(), getUser: vi.fn(), readJob: vi.fn(), claimWorker: vi.fn(), finishJob: vi.fn() }));
vi.mock('../optimization-jobs.js', async importOriginal => ({
  ...await importOriginal<typeof import('../optimization-jobs.js')>(),
  readOptimizationJob: mocks.readJob, claimOptimizationWorker: mocks.claimWorker, finishOptimizationJob: mocks.finishJob,
}));
vi.mock('../gemini-client.js' , () => ({ optimizeResume: mocks.optimizeResume }));
vi.mock('../redis-cache.js', () => ({ buildOptimizeCacheKey: () => 'candidate-trust', getCached: mocks.getCached, setCached: mocks.setCached }));
vi.mock('../credit-manager.js', () => ({ FEATURE_COSTS: { optimize: 5 }, checkCredits: mocks.checkCredits,
  consumeCredits: mocks.consumeCredits, addCredits: vi.fn(), isEmailVerified: () => true }));
vi.mock('../supabase-client.js', () => ({ getSupabaseClient: () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock('../rate-limiter.js', () => ({ withRateLimit: (_name: string, handler: unknown) => handler,
  checkRateLimitForRequest: async () => ({ allowed: true }), checkFreePreviewRateLimitForRequest: async () => ({ allowed: true }) }));
vi.mock('../sentry.js', () => ({ initSentry: vi.fn(), captureError: vi.fn(), summarizeErrorForLog: () => 'error' }));
vi.mock('../vulnerability-detector.js', () => ({ detectVulnerabilities: () => [] }));

const { runOptimization: ordinary } = await import('../../functions/optimize.js');
const { default: background } = await import('../../functions/optimize-background.js');
const { newOptimizationJob, optimizationEnvelope } = await import('../optimization-jobs.js');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCached.mockResolvedValue(null);
  mocks.setCached.mockResolvedValue(undefined);
  mocks.checkCredits.mockResolvedValue({ hasCredits: true, required: 5, available: 10 });
  mocks.consumeCredits.mockResolvedValue({ success: true, creditsRemaining: 5 });
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'fictional-test', email: 'nora@example.test' } }, error: null });
});

describe.each(['en', 'ar'] as const)('%s candidate trust endpoint contract', language => {
  it.each(['ordinary', 'background'] as const)('%s keeps a sourced metric, rejects an invented number and ambiguous employer', async endpoint => {
    const resume = trustResume(language);
    const resumeText = resume.work.flatMap(role => role.highlights).join('\n');
    const sources = buildRequestEvidenceSources(resumeText);
    const metric = sources.find(source => source.text === resume.work[0].highlights[1])!;
    const qualitative = sources.find(source => source.text === resume.work[1].highlights[1])!;
    const repeated = sources.find(source => source.text === resume.work[0].highlights[0])!;
    mocks.optimizeResume.mockResolvedValue({ match_score: 60, bullet_improvements: [
      { original: metric.text, improved: metric.text, target_id: metric.targetId,
        evidence_references: [{ sourceId: metric.id, quote: metric.text }] },
      { original: qualitative.text, improved: language === 'ar' ? 'وفرت ٤٠٪ من التكلفة.' : 'Saved 40% of cost.',
        target_id: qualitative.targetId, evidence_references: [{ sourceId: qualitative.id, quote: qualitative.text }] },
      { original: repeated.text, improved: `${repeated.text} ${resume.work[1].name}`,
        target_id: repeated.targetId, evidence_references: [{ sourceId: repeated.id, quote: repeated.text }] },
    ] });
    const payload = JSON.stringify({ resumeText, jobText: language === 'ar' ? 'مهندسة برمجيات' : 'Software Engineer' });
    let body: { cards: Array<{ evidence: { status: string; targetId: string }; exampleAfter: string }>; evidenceDiagnostics: unknown[]; evidenceSources: unknown[] };
    if (endpoint === 'ordinary') {
      const response = await ordinary({ httpMethod: 'POST', headers: { authorization: 'Bearer token' }, body: payload } as never) as { statusCode: number; body: string };
      expect(response.statusCode).toBe(200);
      body = JSON.parse(response.body);
    } else {
      const job = newOptimizationJob(payload);
      mocks.readJob.mockResolvedValue(job);
      mocks.claimWorker.mockResolvedValue(true);
      mocks.finishJob.mockResolvedValue(true);
      await background(new Request('https://watheqai.app/.netlify/functions/optimize-background', {
        method: 'POST', body: JSON.stringify(optimizationEnvelope(`watheq:optimize:${'a'.repeat(64)}:job`, job, payload, { authorization: 'Bearer token' })),
      }));
      expect(mocks.finishJob.mock.calls[0][1].state).toBe('succeeded');
      body = mocks.finishJob.mock.calls[0][1].result;
    }
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0]).toMatchObject({ exampleAfter: metric.text,
      evidence: { status: 'source_matched', targetId: metric.targetId } });
    expect(body.evidenceDiagnostics).toHaveLength(2);
    expect(body.evidenceSources).toEqual(sources);
    expect(mocks.consumeCredits).toHaveBeenCalledTimes(1);
  });
});
