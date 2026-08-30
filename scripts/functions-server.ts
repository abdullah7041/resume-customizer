/**
 * Minimal HTTP shim over the real Netlify function handlers.
 *
 * `netlify dev` OOMs esbuild on this machine (it bundles every function at once),
 * so the repo's standing advice is to exercise handlers through a tsx harness.
 * This is that harness with an HTTP front door, so the browser can drive the real
 * handler code during local development. It is a dev tool: no bundling, no
 * emulation of Netlify's edge, just import-and-invoke.
 *
 *   npx tsx scripts/functions-server.ts     (listens on 9999)
 */
import 'dotenv/config';
import { createServer } from 'node:http';

const PORT = Number(process.env.FUNCTIONS_PORT ?? 9999);
const ROUTE = /^\/\.netlify\/functions\/([A-Za-z0-9_-]+)/;

interface HandlerEventLike {
  httpMethod: string;
  headers: Record<string, string>;
  body: string;
  queryStringParameters: Record<string, string>;
  path: string;
}

interface HandlerResultLike {
  statusCode?: number;
  headers?: Record<string, string>;
  body?: string;
}

type NetlifyHandler = (
  event: HandlerEventLike,
  context: unknown,
  callback: () => void,
) => Promise<HandlerResultLike | undefined>;

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const match = ROUTE.exec(url.pathname);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type,authorization,x-watheq-crawl-secret',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    });
    return res.end();
  }

  if (!match) {
    res.writeHead(404, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Not a function route' }));
  }

  const name = match[1];
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);

  try {
    const mod = (await import(`../netlify/functions/${name}.js`)) as { handler?: NetlifyHandler };
    if (typeof mod.handler !== 'function') {
      res.writeHead(500, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: `${name} has no v1 handler export` }));
    }

    const event: HandlerEventLike = {
      httpMethod: req.method ?? 'GET',
      headers: Object.fromEntries(
        Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value[0] : String(value ?? '')]),
      ),
      body: Buffer.concat(chunks).toString('utf8'),
      queryStringParameters: Object.fromEntries(url.searchParams),
      path: url.pathname,
    };

    const started = Date.now();
    const result = (await mod.handler(event, {}, () => undefined)) ?? { statusCode: 200, body: '' };
    console.log(`${req.method} ${name} -> ${result.statusCode ?? 200} (${Date.now() - started}ms)`);

    res.writeHead(result.statusCode ?? 200, {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      ...(result.headers ?? {}),
    });
    res.end(result.body ?? '');
  } catch (error) {
    console.error(`${name} threw:`, error);
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'handler failed' }));
  }
});

server.listen(PORT, () => {
  console.log(`Netlify function shim listening on http://localhost:${PORT}`);
});
