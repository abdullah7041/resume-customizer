import { beforeEach, describe, expect, it } from 'vitest';
import { useResumeStore } from '../lib/stores/resumeStore';

/**
 * The optimize deliverable has to outlive the page.
 *
 * The rewrite cards lived in MainContent's local state while the scores derived from
 * them were persisted to this store, so navigating to a real route unmounted
 * MainContent and brought the user back to a match score and keyword chips with no
 * cards behind them. And a run that was in flight when the page went away left no
 * trace at all, so "it apparently failed" was the only conclusion available.
 */

const freshRun = () => ({
  status: 'running' as const,
  startedAt: '2026-09-06T10:00:00.000Z',
  finishedAt: null,
  phase: 'validating',
  error: null,
  cards: [],
  data: null,
  keywords: { add: [], remove: [], neutral: [] },
});

beforeEach(() => {
  useResumeStore.getState().setOptimizeRun(null);
});

describe('optimizeRun', () => {
  it('starts empty', () => {
    expect(useResumeStore.getState().optimizeRun).toBeNull();
  });

  it('opens a run record when one starts', () => {
    useResumeStore.getState().setOptimizeRun(freshRun());

    const run = useResumeStore.getState().optimizeRun;
    expect(run?.status).toBe('running');
    expect(run?.phase).toBe('validating');
    expect(run?.finishedAt).toBeNull();
  });

  it('merges a phase update without discarding the rest of the record', () => {
    useResumeStore.getState().setOptimizeRun(freshRun());
    useResumeStore.getState().setOptimizeRun({ phase: 'ai_processing' });

    const run = useResumeStore.getState().optimizeRun;
    expect(run?.phase).toBe('ai_processing');
    expect(run?.status).toBe('running');
    expect(run?.startedAt).toBe('2026-09-06T10:00:00.000Z');
  });

  it('keeps the cards, not just the scores derived from them', () => {
    useResumeStore.getState().setOptimizeRun(freshRun());
    useResumeStore.getState().setOptimizeRun({
      status: 'succeeded',
      finishedAt: '2026-09-06T10:00:40.000Z',
      cards: [{ id: 'c1', sectionType: 'experience', improved: 'Rewritten bullet' }],
      keywords: { add: ['Power BI'], remove: [], neutral: [] },
    });

    const run = useResumeStore.getState().optimizeRun;
    expect(run?.status).toBe('succeeded');
    expect(run?.cards).toHaveLength(1);
    expect(run?.keywords.add).toEqual(['Power BI']);
  });

  it('records a failure with its reason', () => {
    useResumeStore.getState().setOptimizeRun(freshRun());
    useResumeStore.getState().setOptimizeRun({
      status: 'failed',
      finishedAt: '2026-09-06T10:00:12.000Z',
      error: 'Insufficient credits',
    });

    expect(useResumeStore.getState().optimizeRun?.status).toBe('failed');
    expect(useResumeStore.getState().optimizeRun?.error).toBe('Insufficient credits');
  });

  it('leaves an interrupted run marked running, so a remount can report it', () => {
    // Nothing closes the record when the page goes away — that is the whole point:
    // a run still marked "running" at mount is the evidence it was interrupted.
    useResumeStore.getState().setOptimizeRun({ ...freshRun(), phase: 'ai_processing' });

    expect(useResumeStore.getState().optimizeRun?.status).toBe('running');
    expect(useResumeStore.getState().optimizeRun?.phase).toBe('ai_processing');
  });

  it('clears the record outright when passed null', () => {
    useResumeStore.getState().setOptimizeRun(freshRun());
    useResumeStore.getState().setOptimizeRun(null);

    expect(useResumeStore.getState().optimizeRun).toBeNull();
  });
});

describe('pageSessionId — telling an in-flight run from an interrupted one', () => {
  it('carries the page session that opened the run', () => {
    useResumeStore.getState().setOptimizeRun({ ...freshRun(), pageSessionId: 'page-a' });

    expect(useResumeStore.getState().optimizeRun?.pageSessionId).toBe('page-a');
  });

  it('keeps the session id across a phase update', () => {
    useResumeStore.getState().setOptimizeRun({ ...freshRun(), pageSessionId: 'page-a' });
    useResumeStore.getState().setOptimizeRun({ phase: 'building_response' });

    const run = useResumeStore.getState().optimizeRun;
    expect(run?.pageSessionId).toBe('page-a');
    expect(run?.phase).toBe('building_response');
  });

  it("a running record from ANOTHER page is what proves an interruption", () => {
    // The mount check in MainContent is exactly this comparison: same id means the
    // run may still be in flight, a different id means the page that started it is
    // gone. Without it, a remount during a live run declared that run failed.
    useResumeStore.getState().setOptimizeRun({ ...freshRun(), pageSessionId: 'page-a' });
    const run = useResumeStore.getState().optimizeRun;

    expect(run?.status === 'running' && run.pageSessionId !== 'page-b').toBe(true);
    expect(run?.status === 'running' && run.pageSessionId !== 'page-a').toBe(false);
  });
});
