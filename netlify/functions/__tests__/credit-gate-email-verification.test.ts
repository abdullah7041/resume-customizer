import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * Every credit-gated handler must derive email verification through
 * `isEmailVerified`, which is `Boolean(user?.email_confirmed_at)`.
 *
 * Comparing the field directly (`user?.email_confirmed_at !== null`) reads as
 * "verified" whenever the field is absent or the user object is missing, since
 * `undefined !== null`. That silently disables the anti-abuse gate on the
 * initial credit grant, which is the exact check plan 007 restored.
 */
const creditGatedHandlers = [
  'ai-match.ts',
  'generate-cover-letter.ts',
  'optimize.ts',
  'optimize-stream.ts',
  'predict-questions.ts',
  'vision2030-alignment.ts',
];

const sources = creditGatedHandlers.map((fileName) => [
  fileName,
  readFileSync(resolve(__dirname, '..', fileName), 'utf-8'),
] as const);

describe('credit-gated handlers derive email verification safely', () => {
  it.each(sources)('%s imports isEmailVerified from credit-manager', (_fileName, source) => {
    expect(source).toMatch(/import\s*\{[^}]*\bisEmailVerified\b[^}]*\}\s*from\s*["']\.\.\/lib\/credit-manager\.js["']/);
  });

  it.each(sources)('%s uses isEmailVerified() to build emailVerified', (_fileName, source) => {
    expect(source).toMatch(/const\s+emailVerified\s*=\s*isEmailVerified\(/);
  });

  it.each(sources)('%s never compares email_confirmed_at directly', (_fileName, source) => {
    expect(source).not.toMatch(/email_confirmed_at\s*(!==|===|!=|==)/);
  });
});
