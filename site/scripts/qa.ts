// Browser QA against the production build: serves dist/ and checks layout, links, the
// pending config states, the film's autoplay/reduced-motion behavior and console errors
// at desktop, tablet and phone widths. Screenshots go to qa-output/ (git-ignored).
//
//   npm run build && npm run qa
//
// Uses playwright-core with an existing Chromium: set CHROMIUM_PATH, or it tries the
// Playwright cache at /opt/pw-browsers/chromium.
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import {extname, join, normalize} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium, type BrowserContextOptions, type Page} from 'playwright-core';
import {config} from '../src/config.ts';

const site = fileURLToPath(new URL('..', import.meta.url));
const dist = join(site, 'dist');
const out = join(site, 'qa-output');
mkdirSync(out, {recursive: true});

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
};

// Minimal static server with Range support (video needs it).
const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  let path = normalize(join(dist, decodeURIComponent(url.pathname)));
  if (!path.startsWith(dist)) return void res.writeHead(403).end();
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  if (!existsSync(path)) return void res.writeHead(404).end('not found');
  const body = readFileSync(path);
  const type = TYPES[extname(path)] ?? 'application/octet-stream';
  const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '');
  if (range) {
    const start = Number(range[1]);
    const end = range[2] ? Number(range[2]) : body.length - 1;
    res.writeHead(206, {'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${body.length}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1});
    return void res.end(body.subarray(start, end + 1));
  }
  res.writeHead(200, {'Content-Type': type, 'Content-Length': body.length, 'Accept-Ranges': 'bytes'});
  res.end(body);
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;

const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({executablePath, args: ['--autoplay-policy=no-user-gesture-required']});

// Exercise the real inline GA4 queue without sending QA traffic to Google or loading
// any other external resource. Outbound link tests prevent navigation before clicking.
const newContext = async (options: BrowserContextOptions = {}) => {
  const context = await browser.newContext(options);
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.continue();
    if (url === `https://www.googletagmanager.com/gtag/js?id=${config.analyticsMeasurementId}`)
      return route.fulfill({contentType: 'text/javascript', body: ''});
    return route.abort('blockedbyclient');
  });
  return context;
};

const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
  if (!ok) failures.push(message);
};

const VIEWPORTS = [
  {name: 'desktop-1440', width: 1440, height: 900},
  {name: 'laptop-1024', width: 1024, height: 768},
  {name: 'tablet-768', width: 768, height: 1024},
  {name: 'phone-430', width: 430, height: 932},
  {name: 'phone-390', width: 390, height: 844},
  {name: 'phone-360', width: 360, height: 780},
];

const overflowers = (page: Page) =>
  page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const bad: string[] = [];
    document.querySelectorAll<HTMLElement>('body *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || el.closest('pre, .sr-only, .skip')) return;
      if (r.right > w + 1 || r.left < -1) bad.push(`${el.tagName.toLowerCase()}.${el.className || ''} (${Math.round(r.left)}–${Math.round(r.right)})`);
    });
    return {scroll: document.documentElement.scrollWidth, client: w, bad: bad.slice(0, 8)};
  });

for (const vp of VIEWPORTS) {
  for (const motion of ['no-preference', 'reduce'] as const) {
    const context = await newContext({viewport: {width: vp.width, height: vp.height}, reducedMotion: motion, deviceScaleFactor: vp.width < 500 ? 2 : 1});
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('console', m => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(base, {waitUntil: 'networkidle'});
    await page.evaluate(() => document.fonts.ready);
    const tag = `${vp.name}/${motion}`;

    const o = await overflowers(page);
    check(o.scroll <= o.client && o.bad.length === 0, `${tag}: no horizontal overflow (scrollWidth ${o.scroll}, viewport ${o.client})${o.bad.length ? ' ' + o.bad.join(', ') : ''}`);
    check(errors.length === 0, `${tag}: no console errors ${errors.join(' | ')}`);

    // Smallest rendered text (ignores visually hidden text and SVG figure labels).
    const smallest = await page.evaluate(() => {
      let min = Infinity;
      let who = '';
      document.querySelectorAll<HTMLElement>('body *').forEach(el => {
        if (el.closest('.sr-only, svg') || !el.childNodes.length) return;
        const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim());
        if (!hasText) return;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < min) [min, who] = [size, el.className || el.tagName];
      });
      return {min, who};
    });
    check(smallest.min >= 11, `${tag}: smallest text ${smallest.min}px (${smallest.who})`);

    if (motion === 'no-preference') {
      await page.screenshot({path: join(out, `${vp.name}-fold.png`)});
      await page.screenshot({path: join(out, `${vp.name}-full.png`), fullPage: true});
      for (const id of ['ignition', 'contact']) {
        const section = page.locator(`#${id}`);
        await section.screenshot({path: join(out, `${vp.name}-${id}.png`)});
      }
    }

    const hasVideo = (await page.locator('video[data-promo]').count()) > 0;
    if (hasVideo) {
      await page.locator('video[data-promo]').scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      const state = await page.evaluate(() => {
        const v = document.querySelector('video')!;
        return {paused: v.paused, muted: v.muted, button: !(document.querySelector('[data-promo-play]') as HTMLElement).hidden};
      });
      if (motion === 'reduce') check(state.paused && state.button, `${tag}: film does not autoplay under reduced motion; play button shown`);
      else {
        check(!state.paused && state.muted, `${tag}: film autoplays muted in view`);
        await page.locator('#contact').scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        check(await page.locator('video[data-promo]').evaluate(v => (v as HTMLVideoElement).paused), `${tag}: film pauses when it leaves view`);
      }
    } else {
      check((await page.locator('.film__pending').count()) === 1, `${tag}: GLASS//FIRE placeholder frame rendered (no video file)`);
    }
    await context.close();
  }
}

// The new commercial paths and both showcases remain usable without JavaScript.
{
  const context = await newContext({javaScriptEnabled: false, viewport: {width: 360, height: 780}});
  const page = await context.newPage();
  await page.goto(base, {waitUntil: 'networkidle'});
  check(await page.locator('a[data-outbound="ignition-video"]').isVisible(), 'no JavaScript: public IGNITION video link is usable');
  check(await page.locator('a[data-outbound="contact"]').first().isVisible(), 'no JavaScript: Sergio contact link is usable');
  check(await page.locator('a[data-outbound="request-pack"]').first().isVisible(), 'no JavaScript: sound-pack request link is usable');
  if (existsSync(join(dist, 'media', 'glass-fire-720p60.mp4')))
    check(await page.locator('video[data-promo][controls][preload="none"]').count() === 1, 'no JavaScript: GLASS//FIRE retains native controls and lazy loading');
  await context.close();
}

// Film interactions (only when the web cut exists).
if (existsSync(join(dist, 'media', 'glass-fire-720p60.mp4'))) {
  // Autoplay refused by the browser: the play button must appear and controls stay usable.
  const refused = await newContext({viewport: {width: 390, height: 844}});
  await refused.addInitScript(() => {
    HTMLMediaElement.prototype.play = function () {
      return Promise.reject(new DOMException('blocked', 'NotAllowedError'));
    };
  });
  let page = await refused.newPage();
  await page.goto(base, {waitUntil: 'networkidle'});
  await page.locator('video[data-promo]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  check(await page.locator('[data-promo-play]').isVisible(), 'autoplay refused: play button shown over the poster');
  check((await page.locator('video[data-promo][controls]').count()) === 1, 'autoplay refused: native controls remain');
  await refused.close();

  // "Watch GLASS//FIRE" plays from the start with sound (the click is the gesture).
  const watch = await newContext({viewport: {width: 1440, height: 900}});
  page = await watch.newPage();
  await page.goto(base, {waitUntil: 'networkidle'});
  await page.click('a[data-watch]');
  await page.waitForTimeout(1200);
  const s = await page.evaluate(() => {
    const v = document.querySelector('video')!;
    return {paused: v.paused, muted: v.muted, t: v.currentTime};
  });
  check(!s.paused && !s.muted, `Watch GLASS//FIRE starts playback with sound (paused=${s.paused}, muted=${s.muted})`);
  await watch.close();

  // Nothing fetches the MP4 before the page has loaded.
  const lazy = await newContext({viewport: {width: 1440, height: 900}, reducedMotion: 'reduce'});
  page = await lazy.newPage();
  const fetched: string[] = [];
  page.on('request', r => r.url().endsWith('.mp4') && fetched.push(r.url()));
  await page.goto(base, {waitUntil: 'networkidle'});
  check(fetched.length === 0, 'reduced motion: the MP4 is not requested until the viewer presses play');
  await lazy.close();

  // The existing network-saving fallbacks must still keep the film off the wire.
  for (const mode of ['save-data', '3g']) {
    const constrained = await newContext({viewport: {width: 390, height: 844}});
    await constrained.addInitScript(mode => {
      Object.defineProperty(navigator, 'connection', {value: {saveData: mode === 'save-data', effectiveType: mode === '3g' ? '3g' : '4g'}});
    }, mode);
    const page = await constrained.newPage();
    const fetched: string[] = [];
    page.on('request', r => r.url().endsWith('.mp4') && fetched.push(r.url()));
    await page.goto(base, {waitUntil: 'networkidle'});
    await page.locator('video[data-promo]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    check(await page.locator('video[data-promo]').evaluate(v => (v as HTMLVideoElement).paused), `${mode}: GLASS//FIRE does not autoplay`);
    check(await page.locator('[data-promo-play]').isVisible(), `${mode}: play button remains available`);
    check(fetched.length === 0, `${mode}: no MP4 request before explicit playback`);
    await constrained.close();
  }
}

// Static checks on one load.
{
  const context = await newContext();
  const page = await context.newPage();
  await page.goto(base);
  const links = await page.$$eval('a[target="_blank"]', as => as.map(a => ({href: a.getAttribute('href'), rel: a.getAttribute('rel') ?? ''})));
  check(links.length > 0 && links.every(l => /\bnoopener\b/.test(l.rel) && /\bnoreferrer\b/.test(l.rel)), `all ${links.length} new-tab links carry rel="noopener noreferrer"`);
  check(links.every(l => l.href?.startsWith('https://')), 'all new-tab links are https');
  const pending = await page.$$eval('[data-pending]', els =>
    els.map(e => ({id: e.getAttribute('data-pending'), tag: e.tagName, href: e.hasAttribute('href'), role: e.getAttribute('role'), disabled: e.getAttribute('aria-disabled'), tab: (e as HTMLElement).tabIndex})),
  );
  for (const p of pending)
    check(p.tag === 'SPAN' && !p.href && p.role === 'link' && p.disabled === 'true' && p.tab < 0, `empty ${p.id} URL renders a disabled, non-focusable pending state (no href)`);
  const scripts = await page.$$eval('script[src]', s => s.map(x => x.getAttribute('src')));
  const gaScript = `https://www.googletagmanager.com/gtag/js?id=${config.analyticsMeasurementId}`;
  check(scripts.every(s => s?.startsWith('/assets/') || s === gaScript), `only first-party scripts and configured GA4 (${scripts.join(', ')})`);
  check(scripts.filter(s => s === gaScript).length === (config.analyticsMeasurementId ? 1 : 0), 'exactly one configured GA4 script');
  const metadata = await page.evaluate(() => ({
    version: JSON.parse(document.querySelector('script[type="application/ld+json"]')!.textContent!).softwareVersion,
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
  }));
  check(metadata.version === config.engineVersion, 'structured data identifies the merged v0.7.0 engine');
  check(metadata.canonical === `${config.siteUrl}/` && !!metadata.description, 'canonical URL and description are present');
  check(await page.locator('iframe').count() === 0, 'IGNITION external link adds no embedded player or media load');
  check(await page.locator('a[data-outbound="ignition-video"]').getAttribute('href') === config.ignition.videoUrl, 'IGNITION links to the supplied public Short');
  const unnamed = await page.$$eval('a', links => links.filter(a => !a.textContent?.trim() && !a.getAttribute('aria-label')).length);
  check(unnamed === 0, 'all links have accessible text or a label');
  check(!(await page.content()).toLowerCase().includes('stripe.com/v3'), 'no Stripe SDK');
  const landmarks = await page.evaluate(() => ({header: !!document.querySelector('header'), main: !!document.querySelector('main'), footer: !!document.querySelector('footer'), h1: document.querySelectorAll('h1').length}));
  check(landmarks.header && landmarks.main && landmarks.footer && landmarks.h1 === 1, 'landmarks: header, main, footer, one h1');
  // Keyboard: first Tab reaches the skip link.
  await page.keyboard.press('Tab');
  check((await page.evaluate(() => document.activeElement?.className)) === 'skip', 'first Tab focuses the skip link');
  await context.close();
}

// Every conversion path queues exactly one event per click; navigation is prevented
// only in QA so no payment, form, email, video or portfolio destination is opened.
if (config.analyticsMeasurementId) {
  const context = await newContext({viewport: {width: 390, height: 844}, reducedMotion: 'reduce'});
  await context.addInitScript(() => {
    document.addEventListener('click', event => {
      if ((event.target as Element).closest('a[data-outbound]')) event.preventDefault();
    }, true);
  });
  const page = await context.newPage();
  await page.goto(base, {waitUntil: 'networkidle'});
  const commands = () => page.evaluate(() => ((window as Window & {dataLayer?: ArrayLike<unknown>[]}).dataLayer ?? []).map(entry => Array.from(entry)));
  const initial = await commands();
  check(initial.filter(c => c[0] === 'js').length === 1, 'GA4 initializes once');
  check(initial.filter(c => c[0] === 'config' && c[1] === config.analyticsMeasurementId).length === 1, 'GA4 config sends a single automatic page view');
  check(initial.filter(c => c[0] === 'event' && c[1] === 'page_view').length === 0, 'no duplicate manual page_view');
  for (const name of ['ignition-video', 'contact', 'portfolio', 'github', 'support', 'request-pack']) {
    const links = page.locator(`a[data-outbound="${name}"]`);
    check(await links.count() > 0, `${name}: tracked conversion link exists`);
    for (const link of await links.all()) {
      const href = await link.evaluate(a => (a as HTMLAnchorElement).href);
      const before = await commands();
      await link.click();
      const after = await commands();
      const added = after.slice(before.length);
      const event = added[0];
      const payload = event?.[2] as {cta_name?: string; link_url?: string} | undefined;
      check(added.length === 1 && event?.[0] === 'event' && event[1] === 'daemonv12_cta_click' && payload?.cta_name === name && payload.link_url === href,
        `${name}: one CTA event with the correct URL per click`);
    }
  }
  const final = await commands();
  check(final.filter(c => c[0] === 'config').length === 1 && final.filter(c => c[0] === 'event' && c[1] === 'page_view').length === 0,
    'outbound interactions do not create additional page views');
  await context.close();
}

await browser.close();
server.close();
if (failures.length) {
  console.error(`\n${failures.length} QA check(s) failed`);
  process.exit(1);
}
console.log(`\nall QA checks passed · screenshots in qa-output/`);
