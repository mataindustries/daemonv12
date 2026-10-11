// Browser QA against the production build: serves dist/ and checks layout, links, the
// pending config states, the film's autoplay/reduced-motion behavior and console errors
// at desktop and phone widths. Screenshots go to qa-output/ (git-ignored).
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
import {chromium, type Page} from 'playwright-core';

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

const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
  if (!ok) failures.push(message);
};

const VIEWPORTS = [
  {name: 'desktop-1440', width: 1440, height: 900},
  {name: 'laptop-1024', width: 1024, height: 768},
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
    const context = await browser.newContext({viewport: {width: vp.width, height: vp.height}, reducedMotion: motion, deviceScaleFactor: vp.width < 500 ? 2 : 1});
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('console', m => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(base, {waitUntil: 'networkidle'});
    await page.evaluate(() => document.fonts.ready);
    const tag = `${vp.name}/${motion}`;

    const o = await overflowers(page);
    check(o.scroll <= o.client, `${tag}: no horizontal overflow (scrollWidth ${o.scroll}, viewport ${o.client})${o.bad.length ? ' ' + o.bad.join(', ') : ''}`);
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
      else check(!state.paused && state.muted, `${tag}: film autoplays muted in view`);
    } else {
      check((await page.locator('.film__pending').count()) === 1, `${tag}: GLASS//FIRE placeholder frame rendered (no video file)`);
    }
    await context.close();
  }
}

// Film interactions (only when the web cut exists).
if (existsSync(join(dist, 'media', 'glass-fire-720p60.mp4'))) {
  // Autoplay refused by the browser: the play button must appear and controls stay usable.
  const refused = await browser.newContext({viewport: {width: 390, height: 844}});
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
  const watch = await browser.newContext({viewport: {width: 1440, height: 900}});
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
  const lazy = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: 'reduce'});
  page = await lazy.newPage();
  const fetched: string[] = [];
  page.on('request', r => r.url().endsWith('.mp4') && fetched.push(r.url()));
  await page.goto(base, {waitUntil: 'networkidle'});
  check(fetched.length === 0, 'reduced motion: the MP4 is not requested until the viewer presses play');
  await lazy.close();
}

// Static checks on one load.
{
  const page = await browser.newPage();
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
  check(scripts.every(s => s?.startsWith('/assets/')), `only first-party scripts (${scripts.join(', ')})`);
  check(!(await page.content()).toLowerCase().includes('stripe.com/v3'), 'no Stripe SDK');
  const landmarks = await page.evaluate(() => ({header: !!document.querySelector('header'), main: !!document.querySelector('main'), footer: !!document.querySelector('footer'), h1: document.querySelectorAll('h1').length}));
  check(landmarks.header && landmarks.main && landmarks.footer && landmarks.h1 === 1, 'landmarks: header, main, footer, one h1');
  // Keyboard: first Tab reaches the skip link.
  await page.keyboard.press('Tab');
  check((await page.evaluate(() => document.activeElement?.className)) === 'skip', 'first Tab focuses the skip link');
  await page.close();
}

await browser.close();
server.close();
if (failures.length) {
  console.error(`\n${failures.length} QA check(s) failed`);
  process.exit(1);
}
console.log(`\nall QA checks passed · screenshots in qa-output/`);
