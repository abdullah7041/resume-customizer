import { beforeEach, expect, it, vi } from 'vitest';
import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
const mocks=vi.hoisted(()=>({from:vi.fn(),fetch:vi.fn(),resolve:vi.fn(),getUser:vi.fn(),writes:vi.fn()}));
vi.mock('../../lib/supabase-client.js',()=>({getSupabaseClient:()=>({auth:{getUser:mocks.getUser},from:mocks.from})}));
vi.mock('../../lib/rate-limiter.js',()=>({withRateLimit:(_key:string,handler:Handler)=>handler}));
vi.mock('../../lib/sentry.js',()=>({initSentry:vi.fn(),captureError:vi.fn(),summarizeErrorForLog:()=>({message:'failed'})}));
vi.mock('../../lib/ats/probe.js',async(importOriginal)=>({...await importOriginal<typeof import('../../lib/ats/probe.js')>(),resolveCompany:mocks.resolve}));
vi.mock('../../lib/ats/index.js',()=>({getProvider:()=>({isValidToken:()=>true})}));
vi.mock('../../lib/redis-cache.js',()=>({buildCacheKey:vi.fn(),getCached:vi.fn(),setCached:vi.fn()}));
import {handler} from '../job-sources-api.js';
beforeEach(()=>{
 vi.clearAllMocks();vi.stubGlobal('fetch',mocks.fetch);vi.stubEnv('URL','https://watheqai.app');vi.stubEnv('SITE_NAME','resume-optimizing');vi.stubEnv('DEPLOY_URL','');vi.stubEnv('DEPLOY_PRIME_URL','');vi.stubEnv('JOB_CRAWL_SECRET','test-secret');
 mocks.getUser.mockResolvedValue({data:{user:{id:'owner'}},error:null});mocks.fetch.mockResolvedValue({ok:true,status:202});
 mocks.from.mockImplementation((table:string)=>{
  let operation='read';
  const q={select:()=>q,eq:()=>q,is:()=>q,or:()=>q,single:()=>q,maybeSingle:()=>q,
   upsert:(value:unknown)=>{operation='upsert';mocks.writes(table,value);return q;},update:()=>{operation='update';return q;},
   then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({count:0,error:null,data:table==='ats_companies'?{id:'company',last_fetched_at:null}:operation==='read'?[]:null}).then(resolve)};
  return q;
 });
});
const call=async(body:unknown,rawUrl='https://watheqai.app/.netlify/functions/job-sources-api')=>await handler({httpMethod:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify(body),rawUrl} as unknown as HandlerEvent,{} as never,()=>{}) as HandlerResponse;
const follow={action:'track',source:'ashby',token:'known',displayName:'Known'};
it('saves follow for the authenticated owner and sends only that company to the same preview',async()=>{
 const result=await call(follow,'https://deploy-preview-150--resume-optimizing.netlify.app/.netlify/functions/job-sources-api');
 expect(result.statusCode).toBe(200);expect(mocks.writes).toHaveBeenCalledWith('user_tracked_companies',{user_id:'owner',company_id:'company'});
 expect(mocks.fetch).toHaveBeenCalledWith('https://deploy-preview-150--resume-optimizing.netlify.app/.netlify/functions/crawl-jobs-background',expect.objectContaining({body:JSON.stringify({companyIds:['company']})}));
});
it('does not hand a secret to an unrelated request origin or fall back across environments',async()=>{
 const result=await call(follow,'https://deploy-preview-150--attacker.netlify.app/.netlify/functions/job-sources-api');
 expect(JSON.parse(result.body ?? '{}')).toMatchObject({crawlDispatched:false});expect(mocks.fetch).not.toHaveBeenCalled();
});
it('keeps a successful follow when board dispatch is rejected',async()=>{
 mocks.fetch.mockResolvedValue({ok:false,status:503});const result=await call(follow);
 expect(result.statusCode).toBe(200);expect(JSON.parse(result.body ?? '{}')).toMatchObject({crawlDispatched:false,company:{id:'company'}});
});
it('returns verified resolver candidates and explicit exhausted fallback without inventing matches',async()=>{
 mocks.resolve.mockResolvedValue({candidates:[],unreliable:['workable'],exhausted:true});
 const result=await call({action:'resolve',query:'Unknown employer'});
 expect(JSON.parse(result.body ?? '{}')).toMatchObject({candidates:[],unreliable:['workable'],exhausted:true,fallback:'paste_job_url'});
});

it('records a canonical coverage request under the authenticated user without starting a crawl', async()=>{
 const result=await call({action:'request_coverage',careersUrl:'https://CAREERS.example.org/jobs/?utm_source=test#openings',userId:'another'});
 expect(result.statusCode).toBe(200);
 expect(mocks.writes).toHaveBeenCalledWith('company_coverage_requests',{user_id:'owner',careers_url:'https://careers.example.org/jobs'});
 expect(mocks.fetch).not.toHaveBeenCalled();
});

it.each(['http://example.org/jobs','https://localhost/jobs','https://127.0.0.1/jobs','https://user:password@example.org/jobs'])('rejects an unsuitable saved page', async url=>{
 expect((await call({action:'request_coverage',careersUrl:url})).statusCode).toBe(400);
 expect(mocks.writes).not.toHaveBeenCalled();
});
