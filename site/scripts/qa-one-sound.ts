// Production QA with existing dependencies; no requests to third-party services.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import type {AddressInfo} from 'node:net';
import {chromium, devices} from 'playwright-core';
import {preview} from 'vite';
const server = await preview({preview: {host: '127.0.0.1', port: 0, strictPort: false}});
const base = `http://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}`;
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox']});
mkdirSync('qa-output', {recursive: true});
try {
  for (const width of [320, 360, 390, 430, 768, 1440]) {
    const context = await browser.newContext({...width < 768 ? devices['Pixel 7'] : {}, viewport: {width, height: 900}, reducedMotion: 'reduce'});
    await context.route('https://**/*', route => route.fulfill({status: 200, body: ''}));
    const page = await context.newPage();
    const errors: string[] = [], requests: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', r => { if (/\.(mp3|wav)(\?|$)/.test(r.url())) requests.push(r.url()); });
    await page.goto(`${base}/one-sound/`, {waitUntil: 'networkidle'});
    assert.equal(requests.length, 0, 'no audio preload');
    assert.equal(await page.locator('audio[controls][preload="none"]').count(), 4);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `overflow ${width}`);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.className), 'skip');
    await page.getByRole('radio', {name: 'Track B', exact: true}).check();
    assert.ok(await page.getByRole('button', {name: /Vote & reveal/}).isDisabled());
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    assert.equal((await context.cookies()).length, 0);
    for (const id of ['source', 'A', 'B', 'C', 'A']) {
      const player = page.locator(`#audio-${id}`);
      await player.scrollIntoViewIfNeeded();
      await player.click({position: {x: 22, y: 27}});
      await page.waitForFunction(id => {
        const a = document.getElementById(`audio-${id}`) as HTMLAudioElement;
        return !a.paused && a.currentTime > 0 && a.readyState >= 2;
      }, id);
      await page.waitForFunction(() => [...document.querySelectorAll('audio')].filter(a => !a.paused).length === 1);
      assert.equal(await page.locator('audio').evaluateAll(els => els.filter(el => !(el as HTMLAudioElement).paused).length), 1);
    }
    await page.locator('#audio-A').evaluate(el => { (el as HTMLAudioElement).currentTime = 15; });
    await page.waitForFunction(() => (document.getElementById('audio-A') as HTMLAudioElement).currentTime >= 15);
    await page.locator('#audio-A').evaluate(el => (el as HTMLAudioElement).pause());
    assert.deepEqual(errors, []);
    await page.screenshot({path: `qa-output/one-sound-${width}.png`, fullPage: true});
    console.log(`PASS ${width}px: layout, keyboard, real native playback, exclusive audio, seeking, pending ballot, no preload/storage`);
    await context.close();
  }
  const noJS = await browser.newContext({javaScriptEnabled: false, viewport: {width: 360, height: 800}});
  const staticPage = await noJS.newPage();
  await staticPage.goto(`${base}/one-sound/`);
  assert.equal(await staticPage.locator('audio[controls]').count(), 4);
  assert.ok(await staticPage.locator('noscript p').isVisible());
  assert.ok(await staticPage.getByRole('button', {name: /Vote & reveal/}).isDisabled());
  await noJS.close();
  const failure = await browser.newContext();
  await failure.route('https://**/*', route => route.fulfill({status: 200, body: ''}));
  await failure.route('**/Track_A.mp3', route => route.fulfill({status: 404, body: ''}));
  const errorPage = await failure.newPage();
  await errorPage.goto(`${base}/one-sound/`);
  await errorPage.locator('#audio-A').click({position: {x: 22, y: 27}});
  await errorPage.locator('#audio-A-error').waitFor({state: 'visible'});
  await failure.close();
  for (const [file, mime] of [['Original_One_Sound.wav', 'audio/wav'], ['Track_A.mp3', 'audio/mpeg']]) {
    const response = await fetch(`${base}/media/one-sound/${file}`, {headers: {Range: 'bytes=0-99'}});
    assert.equal(response.status, 206);
    assert.ok(response.headers.get('content-type')?.includes(mime!));
    assert.equal((await response.arrayBuffer()).byteLength, 100);
  }
  const home = await (await fetch(base)).text();
  for (const text of ['G-PXEFNNG7H3', 'https://buy.stripe.com/8x2bJ3bYDgs7arR1Zt3F600', 'https://tally.so/r/yPKRAp', 'id="try"']) assert.ok(home.includes(text));
  console.log('PASS no-JS fallback, audio error link, MIME/ranges, homepage integrations');
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
}
