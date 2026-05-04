import { afterEach, describe, expect, it } from 'vitest';
import type { HandlerEvent } from '@netlify/functions';
import {
  requireAdminMutationGate,
  requireScheduledFunctionGate,
} from '../admin-gates.js';

const originalEnv = { ...process.env };

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

  it('accepts configured admin secrets from headers or query parameters', () => {
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
    ).toEqual({ ok: true });
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
});
