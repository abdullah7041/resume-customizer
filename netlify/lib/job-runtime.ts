/** Never forward worker credentials to a request host outside this Netlify site. */
export function jobRuntime(rawUrl?: string): { origin: string | null; scheduled: boolean } {
 const canonical=httpsOrigin(process.env.URL);
 const requested=httpsOrigin(rawUrl || process.env.DEPLOY_URL || process.env.DEPLOY_PRIME_URL || process.env.URL);
 const site=process.env.SITE_NAME;
 const hostname=requested ? new URL(requested).hostname : '';
 const ownSite=site && (hostname===`${site}.netlify.app` || hostname.endsWith(`--${site}.netlify.app`));
 const origin=requested && (requested===canonical || ownSite) ? requested : null;
 const context=process.env.CONTEXT;
 const productionHost=origin===canonical || (!!site && hostname===`${site}.netlify.app`);
 return {origin,scheduled:!!origin && productionHost && (!context || context==='production')};
}

function httpsOrigin(value?: string): string | null {
 try {const url=new URL(value ?? '');return url.protocol==='https:' && !url.username && !url.password && !url.port ? url.origin : null;}
 catch {return null;}
}
