import type { HandlerEvent } from '@netlify/functions';
import { createHash, timingSafeEqual } from 'node:crypto';

const UNSAFE_ADMIN_SECRETS = new Set(['', 'change-me-in-production']);

type GateResult =
  | { ok: true }
  | {
      ok: false;
      statusCode: number;
      error: string;
    };

function getHeader(event: HandlerEvent, headerName: string): string | undefined {
  const target = headerName.toLowerCase();
  for (const [key, value] of Object.entries(event.headers || {})) {
    if (key.toLowerCase() === target) {
      return Array.isArray(value) ? value[0] : value;
    }
  }
  return undefined;
}

function isLocalDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NETLIFY_DEV === 'true';
}

function getRequestAdminSecret(event: HandlerEvent): string | undefined {
  return (
    getHeader(event, 'x-admin-secret') ||
    getHeader(event, 'x-watheq-admin-secret') ||
    undefined
  );
}

function getConfiguredAdminSecret(): string | undefined {
  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret || UNSAFE_ADMIN_SECRETS.has(secret)) {
    return undefined;
  }
  return secret;
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return timingSafeEqual(left, right);
}

export function requireScheduledFunctionGate(event: HandlerEvent): GateResult {
  const isScheduledCall = getHeader(event, 'x-netlify-internal-functions') === 'true';
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = getHeader(event, 'x-cron-secret');
  const secretMatches = Boolean(
    cronSecret && providedSecret && timingSafeEqualStrings(providedSecret, cronSecret)
  );

  if (secretMatches || isLocalDevelopment()) {
    return { ok: true };
  }

  if (isScheduledCall) {
    if (!cronSecret) {
      console.warn('[AdminGates] Scheduled call accepted via header only - set CRON_SECRET to harden');
    }
    return { ok: true };
  }

  return {
    ok: false,
    statusCode: 403,
    error: 'Unauthorized',
  };
}

export function requireAdminMutationGate(
  event: HandlerEvent,
  allowFlagName?: string
): GateResult {
  if (isLocalDevelopment()) {
    return { ok: true };
  }

  if (allowFlagName && process.env[allowFlagName] !== 'true') {
    return {
      ok: false,
      statusCode: 403,
      error: 'Not available in this environment',
    };
  }

  const configuredSecret = getConfiguredAdminSecret();
  if (!configuredSecret) {
    return {
      ok: false,
      statusCode: 500,
      error: 'Admin secret is not configured',
    };
  }

  const provided = getRequestAdminSecret(event);
  if (!provided || !timingSafeEqualStrings(provided, configuredSecret)) {
    return {
      ok: false,
      statusCode: 401,
      error: 'Unauthorized',
    };
  }

  return { ok: true };
}
