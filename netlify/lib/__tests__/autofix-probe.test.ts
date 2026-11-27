import { describe, expect, it } from 'vitest';
import { autofixProbeStatus } from '../autofix-probe.js';

describe('synthetic production probe credential', () => {
    it('keeps real user requests in the usual incident lane', () => {
        expect(autofixProbeStatus(undefined, 'x'.repeat(40))).toBe('absent');
    });

    it('requires an exact configured token before admitting a synthetic request', () => {
        const token = 'x'.repeat(40);
        expect(autofixProbeStatus(token, token)).toBe('authorized');
        expect(autofixProbeStatus('y'.repeat(40), token)).toBe('rejected');
        expect(autofixProbeStatus('é'.repeat(40), token)).toBe('rejected');
        expect(autofixProbeStatus('short', 'short')).toBe('rejected');
        expect(autofixProbeStatus(token, '')).toBe('rejected');
    });
});
