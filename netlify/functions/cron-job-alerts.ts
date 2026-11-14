import type { Handler } from '@netlify/functions';
export const handler: Handler = async () => {
 if (process.env.JOB_ALERTS_ENABLED!=='true') return {statusCode:200,body:'Disabled'};
 const origin=process.env.URL; const secret=process.env.JOB_CRAWL_SECRET;
 if (!origin || !secret) return {statusCode:503,body:'Not configured'};
 const response=await fetch(`${origin}/.netlify/functions/job-alerts-background`,{method:'POST',headers:{'x-watheq-crawl-secret':secret},signal:AbortSignal.timeout(10000)});
 return {statusCode:response.ok?200:502,body:'Dispatched'};
};
