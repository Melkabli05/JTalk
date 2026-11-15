// Scenarios: ways the backend can misbehave, so the UI's other states can be seen. Switch with
// POST /__mock/scenario {"name": "..."}, or start in one with MOCK_SCENARIO=... .
export const SCENARIOS = {
  default: 'everything works',
  slow: 'responses take 2-3 seconds',
  flaky: '20% of data requests fail with 500 and 5% drop the connection',
  errors: 'every data request fails with 500',
  'auth-required': 'data requests need an Authorization: Bearer token, else 401',
  'session-expired': 'data requests always answer 401, even with a token',
};

/** Paths that are never subject to the failure scenarios: sign-in (and the mock's own controls, handled earlier). */
const EXEMPT = new Set(['auth']);

/** How long to wait before answering. */
export function delayFor(scenario, baseLatency) {
  return scenario === 'slow'
    ? 2000 + Math.random() * 1000
    : baseLatency + Math.random() * (baseLatency / 2);
}

/**
 * A scenario that fails the request before its route runs: `{ status, body }`, `'drop'` (hang up), or undefined.
 * @param {string} scenario
 * @param {{ resource: string, token: string | undefined }} request
 */
export function interceptFor(scenario, { resource, token }) {
  if (EXEMPT.has(resource)) return undefined;
  switch (scenario) {
    case 'errors':
      return { status: 500, body: { message: 'Mock scenario: errors' } };
    case 'flaky': {
      const roll = Math.random();
      if (roll < 0.05) return 'drop';
      return roll < 0.25 ? { status: 500, body: { message: 'Mock scenario: flaky' } } : undefined;
    }
    case 'auth-required':
      return token === undefined ? { status: 401, body: { message: 'Sign in first' } } : undefined;
    case 'session-expired':
      return { status: 401, body: { message: 'Your session has expired' } };
    default:
      return undefined;
  }
}
