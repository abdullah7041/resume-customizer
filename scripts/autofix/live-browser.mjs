import { randomUUID } from 'node:crypto';
import puppeteer from 'puppeteer-core';

// Exercise the deployed UI with a fresh authenticated browser, two distinct
// postings, and synthetic responses. Only static production assets reach the network.
export async function checkBrowserHandoff(origin, supabase) {
  const user = { id: randomUUID(), aud: 'authenticated', role: 'authenticated',
    email: 'fixture@example.test', app_metadata: {}, user_metadata: {}, identities: [], created_at: new Date().toISOString() };
  const session = { access_token: 'synthetic-offline-session', refresh_token: 'unused-fixture',
    expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user };
  const browser = await puppeteer.launch({ channel: 'chrome', executablePath: process.env.PDF_TEST_BROWSER || undefined,
    env: { PATH: process.env.PATH, HOME: process.env.HOME || process.env.USERPROFILE, SystemRoot: process.env.SystemRoot },
    headless: true,
    args: ['--no-sandbox', '--disable-background-networking', '--disable-dev-shm-usage',
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE ' + new URL(origin).hostname] });
  const posting = (title) => ({ id: randomUUID(), companyId: 'fixture', companyName: 'Watheq Fixture',
    title, location: 'Riyadh', applyUrl: 'https://example.test/job', postedAt: new Date().toISOString(),
    firstSeenAt: new Date().toISOString(), publicationKind: 'published', publicationPrecision: 'timestamp' });
  const postings = [posting('Synthetic first role'), posting('Synthetic selected role')];
  const selected = postings[1];
  const description = 'Synthetic job description ' + selected.id;
  let fetchedSelected = false;
  try {
    const page = await browser.newPage();
    const network = await page.createCDPSession();
    await network.send('Network.enable');
    await network.send('Network.setBlockedURLs', { urls: ['ws://*', 'wss://*'] });
    await page.setBypassServiceWorker(true);
    await page.setRequestInterception(true);
    page.on('request', async req => {
      try {
        const url = new URL(req.url());
        const json = data => req.respond({ status: 200, contentType: 'application/json',
          headers: { 'access-control-allow-origin': origin, 'access-control-allow-headers': '*' }, body: JSON.stringify(data) });
        if (url.origin === origin && url.pathname === '/.netlify/functions/job-search' && req.method() === 'POST') {
          return await json({ postings, companies: [], nextOffset: null });
        }
        if (url.origin === supabase && req.method() === 'OPTIONS') {
          return await req.respond({ status: 204, headers: { 'access-control-allow-origin': origin,
            'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': req.headers()['access-control-request-headers'] || '*' } });
        }
        if (url.origin === supabase && req.method() === 'GET') {
          if (url.pathname === '/auth/v1/user') return await json(session.user);
          if (url.pathname === '/rest/v1/job_postings' && url.searchParams.get('id') === 'eq.' + selected.id) {
            fetchedSelected = true;
            const row = { id: selected.id, description, apply_url: selected.applyUrl };
            return await json(req.headers().accept?.includes('vnd.pgrst.object') ? row : [row]);
          }
          if (url.pathname.startsWith('/rest/v1/')) return await json([]);
        }
        if (url.origin === origin && req.method() === 'GET' && (url.pathname === '/' ||
            url.pathname.startsWith('/assets/') || /\.(woff2?|ttf|png|svg|ico)$/.test(url.pathname))) return await req.continue();
        await req.abort();
      } catch { if (!req.isInterceptResolutionHandled()) await req.abort().catch(() => {}); }
    });
    await page.evaluateOnNewDocument((site, store, auth) => {
      if (location.origin !== site) return;
      localStorage.setItem(store, JSON.stringify(auth));
      localStorage.setItem('watheq:onboarded', 'true');
      localStorage.setItem('watheq:landingSeen', 'true');
      const owner = 'user:' + auth.user.id;
      localStorage.setItem('watheq:privateOwner', owner);
      const resume = JSON.stringify({ plainText: 'Synthetic software engineer, Riyadh. Sample CV for verification.' });
      localStorage.setItem('watheq:resumeData', resume);
      localStorage.setItem('watheq:privateValue:' + encodeURIComponent(owner) + ':watheq:resumeData', resume);
    }, origin, 'sb-' + new URL(supabase).hostname.split('.')[0] + '-auth-token', session);
    await page.goto(origin + '/?tab=job-feed', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(title => [...document.querySelectorAll('article h3')].some(h => h.textContent === title), {}, selected.title);
    await page.evaluate(title => {
      const heading = [...document.querySelectorAll('article h3')].find(h => h.textContent === title);
      const button = [...heading.closest('article').querySelectorAll('button')].find(b => /review.*tailor|راجع وخصّص/i.test(b.textContent));
      if (!button || button.disabled) throw new Error('Handoff unavailable');
      button.click();
    }, selected.title);
    await page.waitForFunction(text => document.querySelector('#jobDescription')?.value === text, {}, description);
    return { passed: fetchedSelected, observation: fetchedSelected
      ? 'The deployed browser opened the second synthetic job and placed its exact description in the match editor.'
      : 'The browser did not request the selected posting.' };
  } finally { await browser.close(); }
}
