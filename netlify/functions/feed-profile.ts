import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { executeAiContract } from '../lib/ai-contracts/executor.js';
import { feedProfileOutput } from '../lib/ai-contracts/contracts/feed-profile.js';
import { buildCacheKey, getCached, setCached } from '../lib/redis-cache.js';
import { getSupabaseClient } from '../lib/supabase-client.js';
import { withRateLimit } from '../lib/rate-limiter.js';

const RequestSchema = z.object({
  sources: z.array(z.object({ id: z.string().regex(/^(work|project|education|certificate):\d+$/), text: z.string().min(1).max(6000) })).max(60),
  claimedSkills: z.array(z.string().max(100)).max(100).default([]),
});
const reply = (status: number, body: object) => ({ statusCode: status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const error = (status: number, code: string, message: string) => reply(status, { status, code, message });

const baseHandler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return error(405, 'method/not-allowed', 'Method not allowed');
  if ((event.body?.length ?? 0) > 180000) return error(413, 'request/too-large', 'Evidence is too large');
  try {
    const client = getSupabaseClient();
    const token = (event.headers.authorization ?? event.headers.Authorization ?? '').replace(/^Bearer\s+/i, '');
    if (!client || !token) return error(401, 'auth/required', 'Sign in to personalize your feed');
    const { data: { user }, error: authError } = await client.auth.getUser(token);
    if (!user || authError) return error(401, 'auth/invalid', 'Invalid authentication');
    let raw: unknown;
    try { raw = JSON.parse(event.body ?? '{}'); } catch { return error(400, 'request/invalid', 'Invalid JSON'); }
    const parsed = RequestSchema.safeParse(raw);
    if (!parsed.success) return error(400, 'request/invalid', 'Invalid candidate evidence');
    // Keep the candidate profile scoped to both the signed-in user and exact evidence.
    const key = buildCacheKey('feed-profile-v1', { userId: user.id, evidence: JSON.stringify(parsed.data) });
    const cached = feedProfileOutput.safeParse(await getCached(key));
    if (cached.success) return reply(200, { profile: cached.data, cached: true });
    if (parsed.data.sources.length === 0) return reply(200, { profile: { capabilities: [] }, cached: false });
    const generated = feedProfileOutput.parse(await executeAiContract('feed_candidate_profile', parsed.data, { disableFallback: true, userRef: user.id }));
    const sources = new Map(parsed.data.sources.map((source) => [source.id, source.text.replace(/\s+/g, ' ').trim()]));
    const profile = { capabilities: generated.capabilities.filter((capability) => sources.get(capability.sourceId)?.includes(capability.evidence.replace(/\s+/g, ' ').trim())) };
    await setCached(key, profile, 1800);
    return reply(200, { profile, cached: false });
  } catch {
    return error(503, 'feed/profile-unavailable', 'Candidate evidence could not be refreshed');
  }
};

// Existing authenticated API limit bounds profile cost without charging a Match credit.
export const handler = withRateLimit('job-sources-api', baseHandler);
