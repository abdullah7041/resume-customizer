/**
 * Client-side circuit breaker for API resilience.
 *
 * Tracks consecutive failures per service key. After a threshold of failures
 * within a time window, the circuit "opens" and rejects calls for a cooldown
 * period, preventing request floods against a degraded backend.
 */

interface CircuitState {
  failures: number;
  lastFailure: number;
  openedAt: number | null;
}

const FAILURE_THRESHOLD = 3;
const FAILURE_WINDOW_MS = 60_000; // 1 minute
const COOLDOWN_MS = 30_000; // 30 seconds

const circuits = new Map<string, CircuitState>();

function getOrCreate(key: string): CircuitState {
  let state = circuits.get(key);
  if (!state) {
    state = { failures: 0, lastFailure: 0, openedAt: null };
    circuits.set(key, state);
  }
  return state;
}

/**
 * Record a failure for the given service key.
 * If the threshold is crossed within the window, the circuit opens.
 */
export function recordFailure(key: string): void {
  const state = getOrCreate(key);
  const now = Date.now();

  // Reset stale failures outside the window
  if (now - state.lastFailure > FAILURE_WINDOW_MS) {
    state.failures = 0;
  }

  state.failures++;
  state.lastFailure = now;

  if (state.failures >= FAILURE_THRESHOLD && !state.openedAt) {
    state.openedAt = now;
    console.warn(`[CircuitBreaker] Circuit OPEN for "${key}" after ${state.failures} failures`);
  }
}

/**
 * Record a success, resetting the circuit to closed.
 */
export function recordSuccess(key: string): void {
  const state = circuits.get(key);
  if (state) {
    state.failures = 0;
    state.lastFailure = 0;
    if (state.openedAt) {
      console.warn(`[CircuitBreaker] Circuit CLOSED for "${key}" after success`);
    }
    state.openedAt = null;
  }
}

/**
 * Returns true if the circuit is open (calls should be rejected).
 */
export function isCircuitOpen(key: string): boolean {
  const state = circuits.get(key);
  if (!state || !state.openedAt) return false;

  const elapsed = Date.now() - state.openedAt;
  if (elapsed >= COOLDOWN_MS) {
    // Cooldown expired — allow a probe request (half-open)
    state.openedAt = null;
    state.failures = 0;
    console.warn(`[CircuitBreaker] Circuit HALF-OPEN for "${key}" — allowing probe`);
    return false;
  }

  return true;
}

/**
 * Returns human-readable circuit status for UI display.
 */
export function getCircuitStatus(key: string): {
  open: boolean;
  remainingCooldownMs: number;
} {
  const state = circuits.get(key);
  if (!state || !state.openedAt) {
    return { open: false, remainingCooldownMs: 0 };
  }

  const elapsed = Date.now() - state.openedAt;
  if (elapsed >= COOLDOWN_MS) {
    return { open: false, remainingCooldownMs: 0 };
  }

  return { open: true, remainingCooldownMs: COOLDOWN_MS - elapsed };
}
