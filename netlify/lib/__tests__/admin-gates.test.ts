import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HandlerEvent } from '@netlify/functions';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  requireAdminMutationGate,
  requireScheduledFunctionGate,
} from '../admin-gates.js';

const originalEnv = { ...process.env };
const here = dirname(fileURLToPath(import.meta.url));

function buildEvent(
  headers: Record<string, string> = {},
  queryStringParameters: Record<string, string> | null = null
): HandlerEvent {
  return {
    headers,
    queryStringParameters,
  } as HandlerEvent;
}

describe('admin and scheduled function gates', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('allows Netlify scheduled calls through the internal scheduler header', () => {
    process.env.NODE_ENV = 'production';

    const gate = requireScheduledFunctionGate(
      buildEvent({ 'x-netlify-internal-functions': 'true' })
    );

    expect(gate).toEqual({ ok: true });
  });

  it('blocks direct scheduled function calls outside local development', () => {
    process.env.NODE_ENV = 'production';

    const gate = requireScheduledFunctionGate(buildEvent());

    expect(gate).toEqual({
      ok: false,
      statusCode: 403,
      error: 'Unauthorized',
    });
  });

  it('allows scheduled functions with the cron secret header', () => {
    process.env.NODE_ENV = 'production';
    process.env.CRON_SECRET = 'strong-cron-secret';

    const gate = requireScheduledFunctionGate(
      buildEvent({ 'x-cron-secret': 'strong-cron-secret' })
    );

    expect(gate).toEqual({ ok: true });
  });

  it('rejects incorrect cron secrets without the scheduler header', () => {
    process.env.NODE_ENV = 'production';
    process.env.CRON_SECRET = 'strong-cron-secret';

    const gate = requireScheduledFunctionGate(
      buildEvent({ 'x-cron-secret': 'wrong-secret' })
    );

    expect(gate).toEqual({
      ok: false,
      statusCode: 403,
      error: 'Unauthorized',
    });
  });

  it('keeps scheduler-header compatibility when CRON_SECRET is not configured', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CRON_SECRET;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const gate = requireScheduledFunctionGate(
      buildEvent({ 'x-netlify-internal-functions': 'true' })
    );

    expect(gate).toEqual({ ok: true });
    expect(warnSpy).toHaveBeenCalledWith(
      '[AdminGates] Scheduled call accepted via header only - set CRON_SECRET to harden'
    );
  });

  it('requires an explicit environment flag before non-local dev mutations', () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_SECRET = 'strong-secret';
    delete process.env.ALLOW_DEV_RESET;

    const gate = requireAdminMutationGate(
      buildEvent({}, { secret: 'strong-secret' }),
      'ALLOW_DEV_RESET'
    );

    expect(gate).toEqual({
      ok: false,
      statusCode: 403,
      error: 'Not available in this environment',
    });
  });

  it('fails closed when the admin secret is missing or unsafe', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_DEV_RESET = 'true';
    process.env.ADMIN_SECRET = 'change-me-in-production';

    const gate = requireAdminMutationGate(
      buildEvent({}, { secret: 'change-me-in-production' }),
      'ALLOW_DEV_RESET'
    );

    expect(gate).toEqual({
      ok: false,
      statusCode: 500,
      error: 'Admin secret is not configured',
    });
  });

  it('accepts configured admin secrets from headers only', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_DEV_RESET = 'true';
    process.env.ADMIN_SECRET = 'strong-secret';

    expect(
      requireAdminMutationGate(
        buildEvent({ 'x-admin-secret': 'strong-secret' }),
        'ALLOW_DEV_RESET'
      )
    ).toEqual({ ok: true });

    expect(
      requireAdminMutationGate(
        buildEvent({}, { secret: 'strong-secret' }),
        'ALLOW_DEV_RESET'
      )
    ).toEqual({
      ok: false,
      statusCode: 401,
      error: 'Unauthorized',
    });
  });

  it('rejects incorrect admin secrets before protected work can run', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_DEV_RESET = 'true';
    process.env.ADMIN_SECRET = 'strong-secret';

    const gate = requireAdminMutationGate(
      buildEvent({ 'x-admin-secret': 'wrong-secret' }),
      'ALLOW_DEV_RESET'
    );

    expect(gate).toEqual({
      ok: false,
      statusCode: 401,
      error: 'Unauthorized',
    });
  });

  it('uses the constant-time helper for supplied admin secrets', () => {
    const source = readFileSync(resolve(here, '../admin-gates.ts'), 'utf8');

    expect(source).not.toContain('getRequestAdminSecret(event) !== configuredSecret');
    expect(source).toContain('!provided || !timingSafeEqualStrings(provided, configuredSecret)');
  });
});
