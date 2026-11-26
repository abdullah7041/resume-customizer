import { timingSafeEqual } from 'node:crypto';

/** Keep synthetic requests out of the user-incident repair lane. */
export function autofixProbeStatus(header: string | undefined, expected = process.env.AUTOFIX_PROBE_TOKEN) {
    if (header === undefined) return 'absent';
    if (!expected || !/^[a-zA-Z0-9_-]{32,128}$/.test(expected) || header.length !== expected.length) return 'rejected';
    const supplied = Buffer.from(header);
    const token = Buffer.from(expected);
    return supplied.length === token.length && timingSafeEqual(supplied, token) ? 'authorized' : 'rejected';
}
