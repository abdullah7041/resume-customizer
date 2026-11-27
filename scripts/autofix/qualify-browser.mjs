import assert from 'node:assert/strict';
import { preview } from 'vite';
import { checkBrowserHandoff } from './live-browser.mjs';

const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
try {
  const origin = server.resolvedUrls.local[0].replace(/\/$/, '');
  const result = await checkBrowserHandoff(origin, process.env.VITE_SUPABASE_URL);
  assert.equal(result.passed, true, result.observation);
  console.log(result.observation);
} finally {
  await new Promise(resolve => server.httpServer.close(resolve));
}
