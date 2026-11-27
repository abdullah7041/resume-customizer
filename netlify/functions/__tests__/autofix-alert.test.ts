import { createHash, createHmac } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { handler, incidentInputs } from '../autofix-alert.js';

const event = { project: 18, issue_id: '123', release: 'b'.repeat(40), message: 'private CV',
  tags: [['environment','production'],['watheq.origin','browser'],['watheq.outcome','pdf_raster_only']] };
const send = async (data = event, signed = true) => {
  vi.stubEnv('AUTOFIX_SENTRY_SECRET','secret'); vi.stubEnv('AUTOFIX_SENTRY_PROJECT','18');
  vi.stubEnv('AUTOFIX_DISPATCH_TOKEN','dispatch'); vi.stubEnv('AUTOFIX_REPOSITORY','owner/repo');
  const body = Buffer.from(JSON.stringify({action:'triggered',data:{event:data}}));
  return handler({httpMethod:'POST',body:body.toString('base64'),isBase64Encoded:true,headers:{
    'sentry-hook-resource':'event_alert', 'sentry-hook-signature':createHmac('sha256','secret')
      .update(signed ? body : 'different').digest('hex') }} as never, {} as never, () => {});
};
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('forwards only a digest and line for a mapped source frame', () => {
  const frame = { filename: 'app:///src/services/api.js', lineno: 42, vars: { raw: 'private' } };
  const inputs = incidentInputs({ action:'triggered', data:{ event:{ ...event, exception:{
    values:[{ stacktrace:{ frames:[frame] } }] },
    tags:[['environment','production'],['watheq.origin','user-function'],['watheq.function','ai-match']] } } }, '18');
  expect(inputs?.location).toBe(createHash('sha256').update('src/services/api.js').digest('hex') + ':42');
  expect(inputs?.signal).toBe('ai-match');
  expect(JSON.stringify(inputs)).not.toContain('private');
});
it('dispatches only fixed technical fields for an authenticated production user event', async () => {
  const fetch = vi.fn().mockResolvedValue({ok:true}); vi.stubGlobal('fetch',fetch);
  expect(await send()).toMatchObject({statusCode:202});
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ref:'main',inputs:{
    issue:'123',release:event.release,signal:'pdf_raster_only',kind:'Error',location:'none'}});
});
it('rejects invalid signatures, foreign projects, previews and scheduled failures', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch',fetch);
  expect(await send(event,false)).toMatchObject({statusCode:401});
  for (const other of [{...event,project:20},{...event,environment:'deploy-preview'},
    {...event,tags:[['environment','production'],['watheq.function','cron-job-alerts']]}]) {
    expect(await send(other)).toMatchObject({statusCode:204});
  }
  expect(fetch).not.toHaveBeenCalled();
});
it('retains Sentry retry semantics when dispatch fails', async () => {
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}));
  expect(await send()).toMatchObject({statusCode:503});
});
