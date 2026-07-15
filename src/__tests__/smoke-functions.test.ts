import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

import { describe, expect, it } from 'vitest';

interface SmokeRunResult {
  code: number | null;
  output: string;
}

async function runSmokeAgainstResponse(
  statusCode: number,
  body: string,
  contentType = 'application/json',
  requests: Array<{ method?: string; url?: string }> = [],
): Promise<SmokeRunResult> {
  const server = createServer((request, response) => {
    requests.push({ method: request.method, url: request.url });
    response.writeHead(statusCode, { 'Content-Type': contentType });
    response.end(body);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Smoke test server did not expose a TCP port');
  }

  try {
    return await new Promise<SmokeRunResult>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['scripts/smoke-functions.mjs', `http://127.0.0.1:${address.port}`],
        { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] },
      );
      let output = '';
      child.stdout.on('data', (chunk) => {
        output += String(chunk);
      });
      child.stderr.on('data', (chunk) => {
        output += String(chunk);
      });
      child.on('error', reject);
      child.on('close', (code) => resolve({ code, output }));
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe('deploy function smoke probe', () => {
  it('passes when every endpoint returns a controlled JSON auth rejection', async () => {
    const result = await runSmokeAgainstResponse(401, JSON.stringify({ error: 'Invalid token' }));

    expect(result.code).toBe(0);
    expect(result.output).toContain('All 5 functions returned a controlled response');
  });

  it('uses POST for the user-data auth probe', async () => {
    const requests: Array<{ method?: string; url?: string }> = [];
    await runSmokeAgainstResponse(401, JSON.stringify({ error: 'Invalid token' }), 'application/json', requests);

    expect(requests).toContainEqual({
      method: 'POST',
      url: '/.netlify/functions/user-data-api?action=export',
    });
  });

  it('fails when the function route is missing', async () => {
    const result = await runSmokeAgainstResponse(404, JSON.stringify({ error: 'Not found' }));

    expect(result.code).toBe(1);
    expect(result.output).toContain('5/5 function(s) crashed or unreachable');
  });

  it('fails when a 401 response is not controlled JSON', async () => {
    const result = await runSmokeAgainstResponse(401, '<html>Unauthorized</html>', 'text/html');

    expect(result.code).toBe(1);
    expect(result.output).toContain('5/5 function(s) crashed or unreachable');
  });
});
