import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express, { type Request, type Response } from 'express';
import { join } from 'node:path';
import { Readable } from 'node:stream';

const browserDistFolder = join(import.meta.dirname, '../browser');

const DEFAULT_USER_SERVICE_URL = 'https://jtalk-user-service.onrender.com';
const DEFAULT_VOICE_SERVICE_URL = 'https://live-communication-service.onrender.com';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

function resolveUpstreamOrigin(envValue: string | undefined, fallback: string): string {
  if (!envValue) return fallback;
  try {
    const parsed = new URL(envValue);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.origin;
    }
  } catch {
    // Fall back to default production Render origin when env var is malformed
  }
  return fallback;
}

const userServiceOrigin = resolveUpstreamOrigin(
  process.env['USER_SERVICE_URL'],
  DEFAULT_USER_SERVICE_URL,
);
const voiceServiceOrigin = resolveUpstreamOrigin(
  process.env['VOICE_SERVICE_URL'],
  DEFAULT_VOICE_SERVICE_URL,
);

async function proxyToUpstream(req: Request, res: Response, upstreamOrigin: string): Promise<void> {
  const targetUrl = new URL(req.originalUrl, upstreamOrigin);
  const controller = new AbortController();

  res.on('close', () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  });

  const forwardHeaders = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower) || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) forwardHeaders.append(key, v);
    } else {
      forwardHeaders.set(key, value);
    }
  }

  try {
    const init: RequestInit & { duplex?: 'half' } = {};
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = Readable.toWeb(req) as ReadableStream<Uint8Array<ArrayBuffer>>;
      init.duplex = 'half';
    }
    const upstream = await fetch(targetUrl, {
      ...init,
      method: req.method,
      headers: forwardHeaders,
      redirect: 'manual',
      signal: controller.signal,
    });

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (HOP_BY_HOP_HEADERS.has(lower) || lower === 'content-encoding') return;
      res.setHeader(key, value);
    });

    if (!upstream.headers.has('cache-control')) res.setHeader('Cache-Control', 'private, no-store');
    const contentType = upstream.headers.get('content-type') ?? '';
    if (contentType.includes('text/event-stream')) {
      res.setHeader('Cache-Control', 'private, no-store, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
    }

    if (!upstream.body) {
      res.end();
      return;
    }

    const nodeStream = Readable.fromWeb(
      upstream.body as unknown as import('node:stream/web').ReadableStream,
    );
    nodeStream.on('error', () => {
      if (!res.writableEnded) {
        res.end();
      }
    });
    nodeStream.pipe(res);
  } catch (err) {
    if (controller.signal.aborted || res.writableEnded) {
      return;
    }
    const detail =
      err instanceof Error ? err.message : 'Unable to reach the JTalk backend service.';
    res.status(502).type('application/problem+json').json({
      type: 'urn:jtalk:proxy:problem:upstream-unavailable',
      title: 'Backend service unavailable',
      status: 502,
      detail,
    });
  }
}

const app = express();
const angularApp = new AngularNodeAppEngine({
  allowedHosts: ['localhost', '127.0.0.1', '[::1]'],
});

/**
 * Reverse proxy mirroring vercel.json rewrites so local development, SSR preview,
 * and Render CORS restrictions work seamlessly over same-origin /api/* paths.
 */
app.use('/api/v1/users', (req, res) => {
  void proxyToUpstream(req, res, userServiceOrigin);
});

app.use('/api', (req, res) => {
  void proxyToUpstream(req, res, voiceServiceOrigin);
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
