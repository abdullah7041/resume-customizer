import { describe, expect, it } from 'vitest';
import { hydratePostingDescriptions } from '../crawl-jobs-background.js';
import type { AtsProvider, CompanyRef, RawPosting } from '../../lib/ats/types.js';

const posting = (index: number): RawPosting => ({
  externalId: String(index), title: `Role ${index}`, location: 'Riyadh',
  applyUrl: `https://example.com/${index}`, postedAt: null, description: '',
});

describe('crawl description hydration', () => {
  it('bounds provider requests and preserves postings whose detail request fails', async () => {
    let active = 0;
    let maxActive = 0;
    let calls = 0;
    const provider = {
      source: 'workday',
      isValidToken: () => true,
      fetchPostings: async () => ({ ok: true, status: 200, postings: [] }),
      probe: async () => ({ found: true, count: 0 }),
      fetchDescription: async (_ref: CompanyRef, item: RawPosting) => {
        calls += 1;
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise(resolve => setTimeout(resolve, 1));
        active -= 1;
        if (item.externalId === '3') throw new Error('detail unavailable');
        return `Description ${item.externalId}`;
      },
    } satisfies AtsProvider;
    const result = await hydratePostingDescriptions(provider, { source: 'workday', token: 'tenant:host:site' }, Array.from({ length: 25 }, (_, index) => posting(index)));
    expect(maxActive).toBeLessThanOrEqual(4);
    expect(calls).toBe(20);
    expect(result[2].description).toBe('Description 2');
    expect(result[3].description).toBe('');
    expect(result[24].description).toBe('');
  });
});
