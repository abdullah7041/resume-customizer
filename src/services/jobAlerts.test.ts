import {beforeEach,expect,it,vi} from 'vitest';
import {activatePrivateSession} from '@/lib/auth/privateSession';
const mocks=vi.hoisted(()=>({session:vi.fn(),fetch:vi.fn()}));
vi.mock('@/services/supabase',()=>({supabase:{auth:{getSession:mocks.session}}}));
import {sendJobAlertTest} from './jobAlerts';
const operationId='11111111-1111-4111-8111-111111111111';
let requestedAt:string;
beforeEach(()=>{
 vi.clearAllMocks();localStorage.clear();activatePrivateSession('owner',()=>{});requestedAt=new Date().toISOString();
 vi.stubGlobal('fetch',mocks.fetch);mocks.session.mockResolvedValue({data:{session:{access_token:'token',user:{id:'owner'}}}});
 mocks.fetch.mockResolvedValue(new Response(JSON.stringify({status:'accepted',operationId,acceptedAt:requestedAt})));
});
it('sends only the stable operation identity and bearer session on an explicit request',async()=>{
 expect(await sendJobAlertTest(operationId,requestedAt)).toMatchObject({status:'accepted',operationId});
 expect(mocks.fetch).toHaveBeenCalledWith('/.netlify/functions/job-alert-test',expect.objectContaining({method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer token'},body:JSON.stringify({operationId,requestedAt})}));
});
it('keeps provider acceptance unknown after a transport failure so callers can retry the same operation',async()=>{
 mocks.fetch.mockRejectedValue(new Error('timeout'));
 expect(await sendJobAlertTest(operationId,requestedAt)).toMatchObject({status:'unknown',operationId,code:'acceptance_unknown'});
});
it('returns safe quota feedback without automatically retrying',async()=>{
 mocks.fetch.mockResolvedValue(new Response(JSON.stringify({status:'failed',operationId,code:'limit_reached',retryAfter:3600}),{status:429}));
 expect(await sendJobAlertTest(operationId,requestedAt)).toMatchObject({status:'failed',code:'limit_reached',retryAfter:3600});expect(mocks.fetch).toHaveBeenCalledOnce();
});
it('does not send without a session',async()=>{
 mocks.session.mockResolvedValue({data:{session:null}});activatePrivateSession(null,()=>{});
 expect(await sendJobAlertTest(operationId,requestedAt)).toMatchObject({status:'failed',code:'auth_required'});expect(mocks.fetch).not.toHaveBeenCalled();
});
it('discards a response after an account switch',async()=>{
 let complete!:(value:Response)=>void;mocks.fetch.mockImplementation(()=>new Promise<Response>(resolve=>{complete=resolve;}));
 const result=sendJobAlertTest(operationId,requestedAt);await vi.waitFor(()=>expect(mocks.fetch).toHaveBeenCalledOnce());activatePrivateSession('other',()=>{});
 complete(new Response(JSON.stringify({status:'accepted',operationId,acceptedAt:requestedAt})));
 await expect(result).rejects.toMatchObject({code:'auth/session-changed'});
});
