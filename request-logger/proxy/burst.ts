// ---------------------------------------------------------------------------
// Retry-burst guard
// ---------------------------------------------------------------------------

/**
 * Tell a tight client-side retry loop apart from ordinary traffic, so one can
 * be throttled without touching the other.
 *
 * This exists because a wrong scheme or bad credentials against a
 * fast-failing endpoint can make an agent retry immediately and forever
 * instead of giving up on a 4xx — witnessed with OMP against
 * `http://api.anthropic.com` (should have been `https://`): Anthropic's edge
 * rejects plaintext HTTP in ~30ms with a 400 that carries none of the
 * `x-should-retry` guidance its real API responses do, and OMP's retry policy
 * reads the absence of that header as "retry", producing thousands of
 * identical requests within seconds. Every one of them is a real POST, so
 * `shouldLogRequest` alone cannot tell it apart from real traffic — this can.
 *
 * A well-behaved agent, and a human retrying by hand, never produce the same
 * method+path+status more than a handful of times in a couple of seconds. A
 * retry loop with no backoff does. Once a signature crosses BURST_THRESHOLD
 * inside BURST_WINDOW_MS, further repeats come back `suppressed`. A fresh
 * signature, or a gap wider than the window, restarts the count from zero —
 * this only ever fires on requests that are actually piling up fast.
 */
export const BURST_THRESHOLD = 20;
export const BURST_WINDOW_MS = 2_000;

export type BurstState = {
  key: string;
  windowStart: number;
  count: number;
  warned: boolean;
};

export type BurstResult = {
  state: BurstState;
  suppressed: boolean;
  /** True on the one call that crosses the threshold — print the warning here, not every time. */
  justDetected: boolean;
};

export function burstKey(
  method: string,
  reqPath: string,
  statusCode: number
): string {
  return `${method} ${reqPath} ${statusCode}`;
}

export function trackBurst(
  state: BurstState | null,
  key: string,
  now: number
): BurstResult {
  const current =
    state && state.key === key && now - state.windowStart <= BURST_WINDOW_MS
      ? state
      : null;
  const count = current ? current.count + 1 : 1;
  const windowStart = current ? current.windowStart : now;
  const wasWarned = current ? current.warned : false;
  const suppressed = count > BURST_THRESHOLD;
  return {
    state: { key, windowStart, count, warned: wasWarned || suppressed },
    suppressed,
    justDetected: suppressed && !wasWarned,
  };
}

/** Module-level on purpose: one guard for the whole process, the same as LOG_DIR. */
