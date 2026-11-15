// In-memory mock of the placeholder backend (see core/auth). Add a file under routes/ for each area the app needs.
// State lives in memory and resets on restart. Run it with `pnpm mock`, or with the dev server through
// `pnpm start:mock`. Not part of the Angular build.
//
// Layout: this file is the request pipeline; routes/ has one file per area; state.mjs holds the data;
// scenarios.mjs the ways it can misbehave.
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { readJson, reply, sendJson, sleep } from './http.mjs';
import { createRouter } from './router.mjs';
import { authRoutes } from './routes/auth.mjs';
import { delayFor, interceptFor, SCENARIOS } from './scenarios.mjs';
import { createState } from './state.mjs';

const PREFIX = '/api';
const router = createRouter([...authRoutes]);

/** Settings from the environment: MOCK_PORT, MOCK_LATENCY, MOCK_SCENARIO, MOCK_LOG=0. */
export function optionsFromEnv(env = process.env) {
  return {
    port: Number(env['MOCK_PORT'] ?? 3030),
    latency: Number(env['MOCK_LATENCY'] ?? 300),
    scenario: env['MOCK_SCENARIO'] ?? 'default',
    log: env['MOCK_LOG'] !== '0',
  };
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, accept',
  'access-control-max-age': '600',
};

/** @param {Partial<ReturnType<typeof optionsFromEnv>>} [options] `port: 0` picks a free port (tests). */
export function startMockApi(options = {}) {
  const settings = { ...optionsFromEnv({}), ...options };
  if (!(settings.scenario in SCENARIOS)) {
    throw new Error(
      `Unknown scenario "${settings.scenario}". Use one of: ${Object.keys(SCENARIOS).join(', ')}`,
    );
  }
  const state = createState();
  let scenario = settings.scenario;

  /** The mock's own controls, outside /api so the dev proxy never forwards them. */
  async function control(req, res, pathname) {
    const body = req.method === 'POST' ? await readJson(req) : {};
    if (pathname === '/__mock/reset' && req.method === 'POST') {
      state.reset();
    } else if (pathname === '/__mock/scenario' && req.method === 'POST') {
      if (!body || !(body.name in SCENARIOS)) {
        return sendJson(res, 400, {
          message: `Unknown scenario. Use one of: ${Object.keys(SCENARIOS).join(', ')}`,
        });
      }
      scenario = body.name;
    } else if (pathname !== '/__mock') {
      return sendJson(res, 404, { message: 'Not found' });
    }
    return sendJson(res, 200, {
      scenario,
      scenarios: SCENARIOS,
      counts: { lockedOutAddresses: state.failedLogins.size },
    });
  }

  async function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://mock');
    const method = req.method ?? 'GET';

    if (method === 'OPTIONS') {
      res.writeHead(204, CORS);
      return res.end();
    }
    if (url.pathname.startsWith('/__mock')) {
      return control(req, res, url.pathname);
    }
    if (url.pathname !== PREFIX && !url.pathname.startsWith(`${PREFIX}/`)) {
      return sendJson(res, 404, { message: 'Not found' });
    }

    const pathname = url.pathname.slice(PREFIX.length) || '/';
    const resource = pathname.split('/')[1] ?? '';
    const { route, params, pathMatched } = router.match(method, pathname);

    // Everything takes a moment, like a network.
    await sleep(delayFor(scenario, settings.latency));
    const body = ['POST', 'PUT', 'PATCH'].includes(method) ? await readJson(req) : {};
    if (body === undefined) {
      return sendJson(res, 400, { message: 'Invalid JSON' });
    }

    const token = /^Bearer (.+)$/i.exec(req.headers.authorization ?? '')?.[1];
    const failure = interceptFor(scenario, { resource, token });
    if (failure === 'drop') {
      return req.socket.destroy(); // a dropped connection: no HTTP response at all
    }
    if (failure) {
      return sendJson(res, failure.status, failure.body);
    }

    if (!route) {
      return pathMatched
        ? sendJson(res, 405, { message: 'Method not allowed' })
        : sendJson(res, 404, { message: 'Not found' });
    }
    const result = await route.handle({
      req,
      res,
      params,
      query: url.searchParams,
      body,
      state,
      scenario,
      options: settings,
    });
    const { status, body: payload } = result ?? reply(500, { message: 'Route returned nothing' });
    sendJson(res, status, payload);
  }

  const server = http.createServer((req, res) => {
    const started = performance.now();
    for (const [name, value] of Object.entries(CORS)) res.setHeader(name, value);
    if (settings.log) {
      res.on('close', () => {
        const ms = Math.round(performance.now() - started);
        console.log(`${req.method} ${req.url} ${res.statusCode} ${ms}ms`);
      });
    }
    handle(req, res).catch((error) => {
      console.error(error);
      if (!res.headersSent) sendJson(res, 500, { message: 'The mock failed' });
      else res.end();
    });
  });

  return new Promise((resolve) => server.listen(settings.port, () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = optionsFromEnv();
  const server = await startMockApi(options);
  console.log(
    `Mock API on http://localhost:${server.address().port}${PREFIX} (scenario: ${options.scenario}). GET /__mock lists the scenarios.`,
  );
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
