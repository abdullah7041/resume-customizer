import { afterEach, describe, expect, it, vi } from 'vitest';
import { GATEWAY_WALL_CLOCK_MS, remainingBudgetMs } from '../generate-pdf.js';

/**
 * The PDF renderer used to budget against a timeout that does not exist.
 *
 * netlify.toml sets `timeout = 90` for this function, so it allowed 30s of setContent
 * PLUS a 60s page.pdf race. But Netlify's HTTP gateway cuts a synchronous response at
 * ~30s regardless of the Lambda timeout — the same trap already documented in
 * extract-resume-json.ts. A request landing on a cold container (the function's own
 * comment says a browser launch takes 30-60s) blew the real window, the gateway killed
 * it, and the client got a dead response with no usable error. It then fell back to the
 * raster path and reported a fallback timeout whose message blamed background-tab
 * throttling — a cause that had nothing to do with it.
 *
 * Every budget is now measured against the window that actually exists.
 */

afterEach(() => {
  vi.useRealTimers();
});

describe('remainingBudgetMs', () => {
  it('starts with the full gateway window, not the Lambda timeout', () => {
    const now = Date.now();
    // Well under the 90s configured in netlify.toml — that number was the bug.
    expect(remainingBudgetMs(now)).toBeLessThanOrEqual(GATEWAY_WALL_CLOCK_MS);
    expect(remainingBudgetMs(now)).toBeGreaterThan(GATEWAY_WALL_CLOCK_MS - 1_000);
    expect(GATEWAY_WALL_CLOCK_MS).toBeLessThan(30_000);
  });

  it('shrinks as the request burns its window', () => {
    vi.useFakeTimers();
    const startedAt = Date.now();

    vi.advanceTimersByTime(10_000);

    expect(remainingBudgetMs(startedAt)).toBe(GATEWAY_WALL_CLOCK_MS - 10_000);
  });

  it('subtracts the reserve kept for returning the PDF', () => {
    vi.useFakeTimers();
    const startedAt = Date.now();

    expect(remainingBudgetMs(startedAt, 2_000)).toBe(GATEWAY_WALL_CLOCK_MS - 2_000);
  });

  it('never returns a non-positive timeout', () => {
    vi.useFakeTimers();
    const startedAt = Date.now();

    // A cold browser launch that ate the whole window and then some.
    vi.advanceTimersByTime(GATEWAY_WALL_CLOCK_MS + 30_000);

    // 0 or a negative value would be passed straight to setTimeout/page.pdf and
    // either fire instantly or throw — the floor keeps the timeout meaningful.
    expect(remainingBudgetMs(startedAt)).toBe(1);
    expect(remainingBudgetMs(startedAt, 2_000)).toBe(1);
  });

  it('reports too little budget to be worth starting a render', () => {
    vi.useFakeTimers();
    const startedAt = Date.now();

    // This is the branch that returns 503 pdf/renderer-cold instead of rendering
    // into a response the gateway will never deliver.
    vi.advanceTimersByTime(GATEWAY_WALL_CLOCK_MS - 4_000);

    expect(remainingBudgetMs(startedAt, 2_000)).toBeLessThan(5_000);
  });

  it('still has room to render on a warm container', () => {
    vi.useFakeTimers();
    const startedAt = Date.now();

    // A pooled browser answers in well under a second.
    vi.advanceTimersByTime(400);

    expect(remainingBudgetMs(startedAt, 2_000)).toBeGreaterThan(5_000);
  });
});
