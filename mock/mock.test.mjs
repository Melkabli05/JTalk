// Tests for the mock backend itself (node:test, no dependencies): `pnpm mock:test`.
// The Angular app is tested against HttpTestingController, so this is what keeps the mock honest.
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { startMockApi } from './server.mjs';

let server;
let base;

before(async () => {
  server = await startMockApi({ port: 0, latency: 0, log: false });
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());
beforeEach(async () => {
  await call('/__mock/reset', { method: 'POST' });
  await scenario('default');
});

/** A request to the mock: the parsed JSON body (when there is one) and the response. */
async function call(path, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    response,
    status: response.status,
    json:
      text && response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : undefined,
    text,
  };
}
const api = (path, init) => call(`/api${path}`, init);
const scenario = (name) => call('/__mock/scenario', { method: 'POST', body: { name } });

describe('auth', () => {
  const login = (email, password) =>
    api('/auth/login', { method: 'POST', body: { email, password } });

  it('signs in with any password but "wrong"', async () => {
    assert.equal((await login('a@b.co', 'anything')).json.token, 'mock-token');
    assert.equal((await login('a@b.co', 'wrong')).status, 401);
    assert.equal((await login('not-an-email', 'x')).status, 422);
    assert.equal((await login('a@b.co', '')).status, 422);
  });

  it('locks an address out after five failures (429), and a good sign-in clears the count', async () => {
    for (let i = 0; i < 4; i += 1) await login('lock@b.co', 'wrong');
    assert.equal((await login('lock@b.co', 'fine')).status, 200); // the fifth try, with the right password
    for (let i = 0; i < 5; i += 1) assert.equal((await login('lock@b.co', 'wrong')).status, 401);
    assert.equal((await login('lock@b.co', 'fine')).status, 429);
    assert.equal(
      (await login('other@b.co', 'fine')).status,
      200,
      'other addresses are not affected',
    );
    await call('/__mock/reset', { method: 'POST' });
    assert.equal((await login('lock@b.co', 'fine')).status, 200);
  });

  it('registers and resets with the same answers for everyone', async () => {
    assert.equal(
      (
        await api('/auth/register', {
          method: 'POST',
          body: { email: 'a@b.co', password: 'correct horse battery' },
        })
      ).status,
      202,
    );
    assert.equal(
      (
        await api('/auth/register', {
          method: 'POST',
          body: { email: 'a@b.co', password: 'short' },
        })
      ).status,
      422,
    );
    assert.equal(
      (await api('/auth/forgot-password', { method: 'POST', body: { email: 'ghost@b.co' } }))
        .status,
      202,
    );
    assert.equal((await api('/auth/forgot-password', { method: 'POST', body: {} })).status, 422);
    const reset = (token, password = 'correct horse battery') =>
      api('/auth/reset-password', { method: 'POST', body: { token, password } });
    assert.equal((await reset('abc')).status, 204);
    assert.equal((await reset('expired')).status, 400);
    assert.equal((await reset('abc', 'short')).status, 422);
  });
});

describe('scenarios', () => {
  it('are listed, switched, and refused when unknown', async () => {
    const info = await call('/__mock');
    assert.equal(info.json.scenario, 'default');
    assert.ok('flaky' in info.json.scenarios && 'auth-required' in info.json.scenarios);
    assert.equal((await scenario('errors')).json.scenario, 'errors');
    assert.equal((await scenario('nope')).status, 400);
    assert.equal((await call('/__mock/scenario', { method: 'POST', body: '{oops' })).status, 400);
  });

  // A scenario fails the request before the router runs, so any data path shows it.
  it('errors fail data requests but never sign-in', async () => {
    assert.equal((await api('/anything')).status, 404);

    await scenario('errors');
    assert.equal((await api('/anything')).status, 500);
    assert.equal(
      (await api('/auth/login', { method: 'POST', body: { email: 'a@b.co', password: 'x' } }))
        .status,
      200,
    );
  });

  it('auth-required wants a token, and session-expired refuses even a good one', async () => {
    const withToken = { headers: { authorization: 'Bearer mock-token' } };

    await scenario('auth-required');
    assert.equal((await api('/anything')).status, 401);
    assert.equal(
      (await api('/anything', withToken)).status,
      404,
      'a token gets through to the router',
    );

    await scenario('session-expired');
    assert.equal((await api('/anything', withToken)).status, 401);
    assert.equal(
      (await api('/auth/login', { method: 'POST', body: { email: 'a@b.co', password: 'x' } }))
        .status,
      200,
    );
  });

  it('reset puts the seed state back', async () => {
    for (let i = 0; i < 5; i += 1) {
      await api('/auth/login', { method: 'POST', body: { email: 'lock@b.co', password: 'wrong' } });
    }
    assert.equal((await call('/__mock')).json.counts.lockedOutAddresses, 1);
    const reset = await call('/__mock/reset', { method: 'POST' });
    assert.equal(reset.json.counts.lockedOutAddresses, 0);
  });
});

describe('the HTTP edges', () => {
  it('answers a preflight and allows any origin', async () => {
    const preflight = await call('/api/auth/login', { method: 'OPTIONS' });
    assert.equal(preflight.status, 204);
    assert.match(preflight.response.headers.get('access-control-allow-methods'), /PATCH/);
    assert.equal(
      (await api('/auth/login', { method: 'POST', body: {} })).response.headers.get(
        'access-control-allow-origin',
      ),
      '*',
    );
  });

  it('tells a wrong path (404) from a wrong method (405), and refuses broken JSON (400)', async () => {
    assert.equal((await api('/nothing')).status, 404);
    assert.equal((await call('/elsewhere')).status, 404);
    assert.equal((await api('/auth/login', { method: 'DELETE' })).status, 405);
    assert.equal((await api('/auth/login', { method: 'POST', body: '{oops' })).status, 400);
  });
});
