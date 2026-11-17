// Synthetic browser qualification with the installed browser and dependencies.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import puppeteer from 'puppeteer';

process.env.VITE_JOB_CATALOGUE_ENABLED = 'true';
process.env.VITE_SUPABASE_URL = 'https://fixture.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'fixture-public-key';
const output = resolve(process.argv[2] ?? '.verification/jobs-ui');
await mkdir(output, { recursive: true });
const html = `<!doctype html><html><body><div id="root"></div><script type="module">
 import React from 'react'; import { createRoot } from 'react-dom/client';
 import '/src/index.css'; import i18n from '/src/lib/i18n';
 import Jobs from '/src/components/sections/JobsFirstSection.tsx';
 import {WorkflowStepper} from '/src/components/ui/WorkflowStepper.tsx';
 import {supabase} from '/src/services/supabase.js';
 import {useResumeLibraryStore} from '/src/lib/resumeLibrary';
 import {useResumeStore} from '/src/lib/stores/resumeStore';
 const params=new URLSearchParams(location.search);const lang=params.get('lang') ?? 'en';
 await i18n.changeLanguage(lang); document.documentElement.dir=lang==='ar'?'rtl':'ltr';
 document.documentElement.classList.toggle('dark',params.get('theme')==='dark');
 supabase.auth.getSession=async()=>({data:{session:{user:{id:'fixture-user'},access_token:'synthetic-test-token'}},error:null});
 useResumeStore.setState({searchIntent:{targetRoles:['AI Engineer'],meta:{confidence:'high',completeness:100,updatedAt:new Date().toISOString()}}});
 useResumeLibraryStore.setState({activeResumeId:'cv',entries:[{id:'cv',fingerprint:'fixture',name:'Example CV',plainText:'Built AI products',parsedResume:{basics:{name:'Example'}}}]});
 const steps=[['resume','Resume','Add or update your CV'],['truth-check','Truth check','Keep your information accurate'],['match','Match','Find roles that fit your profile'],['optimize','Tailor','Adapt your CV for each role'],['templates','Export & track','Save, apply and track']].map(([id,label,hint])=>({id,label,hint,targetTab:id,status:id==='resume'?'completed':'upcoming'}));
 createRoot(document.getElementById('root')).render(React.createElement('main',{className:'mx-auto max-w-[1440px] space-y-4 bg-background p-4 text-ink'},React.createElement('div',{className:'hidden md:block'},React.createElement(WorkflowStepper,{steps,onStepClick:()=>{}})),React.createElement(Jobs,{onMatchPosting:input=>window.selectedJob=input,onToast:()=>{}})));
 </script></body></html>`;
const server=await createServer({server:{host:'127.0.0.1',port:5176,strictPort:true,watch:{ignored:['**/.verification/**']}} ,clearScreen:false,plugins:[{
 name:'jobs-ui-fixture',configureServer(vite){vite.middlewares.use('/__jobs',async(_req,res)=>{
  res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/__jobs',html));
 });},
}]});
await server.listen();
const browser=await puppeteer.launch({headless:true,executablePath:process.env.PDF_TEST_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.setRequestInterception(true);
page.on('request',async request=>{
 const url=request.url();
 const respond=body=>request.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
 if(url.includes('/job-search'))return respond({postings:[{id:'job',companyId:'company',companyName:'Example Company',title:'AI Engineer',location:'Riyadh',applyUrl:'https://example.test/job',postedAt:new Date().toISOString(),publicationKind:'published',publicationPrecision:'timestamp',firstSeenAt:new Date().toISOString()}],companies:[{id:'company',display_name:'Example Company',company_category:'startup',sector:'Software',last_status:'ok',last_fetched_at:new Date().toISOString(),source:'workable',token:'example',followed:false}],nextOffset:null});
 if(url.includes('/job-alert-preferences'))return respond({enabled:true,language:'en',scope:'followed',serviceAvailable:true,lastOutcome:'empty',lastCheckedAt:new Date().toISOString(),lastProviderAcceptedAt:null});
 if(url.includes('/feed-match'))return respond({results:[{resumeId:'cv',resumeFingerprint:'fixture',cached:true,match:{score:72,summary_bullets:['AI project experience'],gapAnalysis:[{requirement:'Production ownership'}]}}],failures:[]});
 if(url.includes('fixture.supabase.co'))return respond([]);
 return request.continue();
});
try{
 for(const [language,theme,width] of [['en','light',1280],['ar','dark',1280],['en','dark',390],['ar','light',390]]){
  await page.setViewport({width,height:900});
  await page.goto(`${server.resolvedUrls.local[0]}__jobs?lang=${language}&theme=${theme}`,{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>document.body.textContent.includes('AI Engineer'));
  const dimensions=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth,dir:document.documentElement.dir}));
  assert.ok(dimensions.content<=dimensions.width+1,JSON.stringify(dimensions));
  assert.equal(dimensions.dir,language==='ar'?'rtl':'ltr');
  const buttonText=language==='ar'?'افحص التوافق (حتى 10)':'Check my matches (up to 10)';
  await page.evaluate(label=>[...document.querySelectorAll('button')].find(button=>button.textContent===label).click(),buttonText);
  await page.waitForFunction(()=>document.body.textContent.includes('72%'));
  await page.screenshot({path:resolve(output,`${language}-${theme}-${width}.png`),fullPage:true});
  assert.equal(await page.$eval('a[target="_blank"]',link=>link.getAttribute('href')),'https://example.test/job');
  console.log('Jobs UI passed',language,theme,width);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();await server.close();}
