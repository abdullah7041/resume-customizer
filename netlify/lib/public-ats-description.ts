import { assertPublicHttpUrl, safeFetch } from './safe-fetch.js';
import { htmlToText, MAX_JOB_TEXT_CHARS } from './job-page-extract.js';

/** Public detail APIs for boards whose HTML is only a JavaScript shell. */
export async function publicAtsDescription(rawUrl: string) {
  const url = assertPublicHttpUrl(rawUrl);
  if (url.protocol !== 'https:' || url.port) return null;
  let endpoint: string;
  let provider: 'oracle' | 'greenhouse' | 'lever' | 'workday';
  const oracle = url.pathname.match(/\/CandidateExperience\/en\/sites\/([^/]+)\/job\/(\d+)/i)
    ?? url.pathname.match(/\/CandidateExperience\/[^/]+\/sites\/([^/]+)\/job\/(\d+)/i);
  const greenhouse = url.pathname.match(/^\/([^/]+)\/jobs\/(\d+)/);
  const lever = url.pathname.match(/^\/([^/]+)\/([a-f0-9-]{36})/i);
  const workday = url.pathname.match(/^\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/]+)(\/job\/.+)/);
  if (url.hostname.endsWith('.oraclecloud.com') && oracle) {
    provider = 'oracle';
    const api = new URL('/hcmRestApi/resources/11.13.18.05/recruitingCEJobRequisitionDetails', url);
    api.searchParams.set('onlyData', 'true');
    api.searchParams.set('finder', `ById;Id="${oracle[2]}",siteNumber=${oracle[1]}`);
    endpoint = api.href;
  } else if (['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(url.hostname) && greenhouse) {
    provider = 'greenhouse';
    endpoint = `https://boards-api.greenhouse.io/v1/boards/${greenhouse[1]}/jobs/${greenhouse[2]}`;
  } else if (['jobs.lever.co', 'jobs.eu.lever.co'].includes(url.hostname) && lever) {
    provider = 'lever';
    endpoint = `https://${url.hostname === 'jobs.eu.lever.co' ? 'api.eu.lever.co' : 'api.lever.co'}/v0/postings/${lever[1]}/${lever[2]}`;
  } else if (/^[\w-]+\.wd\d+\.myworkdayjobs\.com$/.test(url.hostname) && workday) {
    provider = 'workday';
    endpoint = `${url.origin}/wday/cxs/${url.hostname.split('.')[0]}/${workday[1]}${workday[2]}`;
  } else return null;

  const response = await safeFetch(endpoint, { acceptJson: true, timeoutMs: 8000, maxBytes: 2 * 1024 * 1024, maxRedirects: 2 });
  if (response.status >= 400) return null;
  const data = JSON.parse(response.body);
  const job = provider === 'oracle' ? data.items?.find((item: { Id?: number | string }) => String(item.Id) === oracle?.[2])
    : provider === 'workday' ? data.jobPostingInfo : data;
  if (!job) return null;
  const title = provider === 'oracle' ? job.Title : provider === 'lever' ? job.text : job.title;
  const fragments = provider === 'oracle' ? [job.ExternalDescriptionStr, job.ExternalResponsibilitiesStr, job.ExternalQualificationsStr]
    : provider === 'lever' ? [job.description, ...(Array.isArray(job.lists) ? job.lists.map((list: { text?: string; content?: string }) => `${list.text ?? ''}\n${list.content ?? ''}`) : []), job.additional]
      : [job.content ?? job.jobDescription];
  const body = htmlToText(fragments.filter(value => typeof value === 'string').join('\n'));
  if (body.length < 200) return null;
  return { jobText: [title, body].filter(Boolean).join('\n\n').slice(0, MAX_JOB_TEXT_CHARS), jobTitle: typeof title === 'string' ? title : null,
    companyName: null, source: 'ats-api' as const, confidence: 'high' as const, criteria: null };
}
