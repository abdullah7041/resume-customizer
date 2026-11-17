import { beforeEach, expect, it, vi } from 'vitest';
import type { HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';
const mocks = vi.hoisted(() => ({ user:vi.fn(), from:vi.fn(), companies:[] as Record<string,unknown>[] }));
vi.mock('../../lib/rate-limiter.js',()=>({withRateLimit:(_key:string,handler:unknown)=>handler}));
vi.mock('../../lib/sentry.js',()=>({initSentry:vi.fn(),captureError:vi.fn()}));
vi.mock('../../lib/supabase-client.js',()=>({getSupabaseClient:()=>({auth:{getUser:mocks.user},from:mocks.from})}));
import { handler } from '../job-search.js';
const invoke = async(body:unknown) => await handler({httpMethod:'POST',headers:{authorization:'Bearer fixture'},body:JSON.stringify(body)} as unknown as HandlerEvent,{} as HandlerContext,()=>{}) as HandlerResponse;
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv('JOB_CATALOGUE_ENABLED','true');
 mocks.user.mockResolvedValue({data:{user:{id:'user'}},error:null});
 mocks.companies=[{id:'company',display_name:'Example',company_category:'unclassified'}];
 mocks.from.mockImplementation((table:string)=>{
  const data=table==='ats_companies'?mocks.companies:table==='job_postings'?[{id:'job',company_id:'company',title:'AI Engineer',location:'Riyadh',apply_url:'https://example.test/apply',posted_at:null,first_seen_at:'2026-11-16T00:00:00Z'}]:[];
  const result={data,error:null};const chain:Record<string,unknown>={then:(resolve:(value:unknown)=>unknown)=>resolve(result)};
  for(const method of ['select','eq','in','is','order','range'])chain[method]=()=>chain;
  return chain;
 });
});
it('returns audited employer categories and evidence before the owner migration is applied',async()=>{
 mocks.companies=[{id:'salla',source:'workable',token:'salla',display_name:'Salla',company_category:'unclassified',sector:null}];
 const result=await invoke({targetRoles:[]});
 expect(result.statusCode).toBe(200);
 expect(JSON.parse(result.body!).companies).toEqual([expect.objectContaining({company_category:'scaleup',sector:'E-commerce software',followed:false,classification_source:'https://salla.com/en/ai-info',category_evidence:expect.objectContaining({verifiedAt:'2026-11-17'})})]);
});
it('returns catalogue jobs to authenticated users without follows and excludes descriptions',async()=>{
 const result=await invoke({targetRoles:['AI Engineer']});
 expect(result.statusCode).toBe(200);
 expect(JSON.parse(result.body!).postings).toEqual([expect.objectContaining({id:'job',companyName:'Example'})]);
 expect(JSON.parse(result.body!).postings[0]).not.toHaveProperty('description');
});
it('rejects missing authentication before reading the catalogue',async()=>{
 mocks.user.mockResolvedValue({data:{user:null},error:null});
 expect((await invoke({targetRoles:['AI Engineer']})).statusCode).toBe(401);
 expect(mocks.from).not.toHaveBeenCalled();
});
it('rejects invalid page sizes and returns an unavailable status while rollout is disabled',async()=>{
 expect((await invoke({targetRoles:['AI Engineer'],limit:500})).statusCode).toBe(400);
 vi.stubEnv('JOB_CATALOGUE_ENABLED','false');
 expect((await invoke({targetRoles:['AI Engineer']})).statusCode).toBe(503);
});
