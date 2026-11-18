import { expect, it, vi } from 'vitest';
import type { RootOptions } from 'react-dom/client';
const mocks=vi.hoisted(()=>({createRoot:vi.fn((_container:Element|null,_options?:RootOptions)=>({render:vi.fn()})),capture:vi.fn()}));
vi.mock('react-dom/client',()=>({createRoot:mocks.createRoot}));
vi.mock('@sentry/react',()=>({init:vi.fn(),browserTracingIntegration:vi.fn(),replayIntegration:vi.fn(),captureReactException:mocks.capture}));
vi.mock('../App',()=>({default:()=>null}));
vi.mock('../hooks/useAuth',()=>({AuthProvider:()=>null}));
vi.mock('../contexts/CreditsContext',()=>({CreditsProvider:()=>null}));
vi.mock('../services/analytics',()=>({analytics:{init:vi.fn()}}));
vi.mock('../lib/i18n',()=>({}));
it('reports caught and uncaught React 19 failures without transmitting error content',async()=>{
 document.body.innerHTML='<div id="root"></div>';
 await import('../main');
 const options=mocks.createRoot.mock.calls[0]?.[1] as RootOptions;
 for(const callback of [options?.onCaughtError,options?.onUncaughtError]) {
  expect(callback).toBeTypeOf('function');
  callback?.(new Error('Private resume text +966500000000 owner@example.com'),{componentStack:'at Workspace'});
 }
 expect(mocks.capture).toHaveBeenCalledTimes(2);
 expect(mocks.capture).toHaveBeenCalledWith(expect.objectContaining({message:'Workspace rendering failed'}),{componentStack:'at Workspace'},expect.objectContaining({tags:{stage:'render',code:'UI_RENDER_FAILED'}}));
 expect(mocks.capture.mock.calls.every(call=>(call[0] as Error).message==='Workspace rendering failed')).toBe(true);
 expect(JSON.stringify(mocks.capture.mock.calls)).not.toMatch(/Private resume|966500000000|owner@example/);
});
