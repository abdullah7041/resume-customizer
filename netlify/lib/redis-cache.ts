/**
 * redis-cache.ts
 * Shared Upstash Redis client + caching helpers for Netlify functions.
 *
 * Usage:
 *   import { buildCacheKey, getCached, setCached } from '../lib/redis-cache.js';
 *
 *   const key = buildCacheKey('optimize', { resumeText, jobText, language, mode });
 *   const hit = await getCached<MyType>(key);
 *   if (hit) return hit;
 *   const result = await expensiveAiCall();
 *   await setCached(key, result, 1800); // 30-minute TTL
 */

import { Redis } from '@upstash/redis';
import { createHash } from 'crypto';
import { summarizeErrorForLog } from './sentry.js';

// ---------------------------------------------------------------------------
// Singleton Redis client (lazy-initialized)
// ---------------------------------------------------------------------------
let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn('[redis-cache] UPSTASH env vars missing — caching disabled.');
    return null;
  }

  try {
    _redis = new Redis({ url, token });
    return _redis;
  } catch (err) {
    console.error('[redis-cache] Failed to initialize Redis client:', summarizeErrorForLog(err));
    return null;
  }
}

// ---------------------------------------------------------------------------
// Key builder — deterministic SHA-256 hash over a plain-object payload
// ---------------------------------------------------------------------------

/**
 * Build a deterministic Redis cache key for a given namespace + data object.
 * The data is JSON-serialised with sorted keys so argument order is irrelevant.
 *
 * @param namespace  Short prefix, e.g. "optimize" or "ai-match"
 * @param data       Arbitrary key/value object to hash
 * @returns          e.g. "watheq:optimize:a3f9c1..."
 */
export function buildCacheKey(namespace: string, data: Record<string, unknown>): string {
  const normalized = JSON.stringify(data, Object.keys(data).sort());
  const hash = createHash('sha256').update(normalized).digest('hex');
  return `watheq:${namespace}:${hash}`;
}

export interface OptimizeCacheKeyInput {
  userScope: string;
  resumeText: string;
  jobText: string;
  language: string;
  vulnerabilities: string[];
  userClarifications: string;
  userHardStops: string[];
}

export function buildOptimizeCacheKey(input: OptimizeCacheKeyInput): string {
  return buildCacheKey('optimize', {
    userId: input.userScope,
    resumeText: input.resumeText.trim(),
    jobText: input.jobText.trim(),
    language: input.language || 'en',
    vulnerabilities: [...input.vulnerabilities].sort(),
    userClarifications: input.userClarifications || '',
    userHardStops: input.userHardStops || [],
  });
}

// ---------------------------------------------------------------------------
// get / set helpers
// ---------------------------------------------------------------------------

/**
 * Retrieve a cached value from Redis.
 * Returns `null` on a miss, Redis errors, or when Redis is unavailable.
 */
export async function getCached<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const raw = await redis.get<string>(key);
    if (!raw) return null;

    // Upstash may auto-parse JSON; if it already gave us an object, return it.
    if (typeof raw === 'object') return raw as unknown as T;

    return JSON.parse(raw) as T;
  } catch (err) {
    // Log but never throw — a cache failure should never break the request.
    console.error('[redis-cache] GET error:', summarizeErrorForLog(err));
    return null;
  }
}

/**
 * Store a value in Redis with an expiry (seconds).
 * Silently no-ops when Redis is unavailable.
 *
 * @param key      Cache key (from `buildCacheKey`)
 * @param value    Serialisable object to cache
 * @param ttlSecs  TTL in seconds (default: 1800 = 30 minutes)
 */
export async function setCached(
  key: string,
  value: unknown,
  ttlSecs = 1800
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(key, JSON.stringify(value), { ex: ttlSecs });
    console.log(`[redis-cache] SET ${key.substring(0, 40)}... (TTL ${ttlSecs}s)`);
  } catch (err) {
    console.error('[redis-cache] SET error:', summarizeErrorForLog(err));
  }
}
