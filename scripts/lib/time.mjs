// The one time scale of the scripts: every timeout, throttle and backoff is
// spelled as a multiple of these, never as a bare number of milliseconds.
export const SECOND_MS = 1_000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
