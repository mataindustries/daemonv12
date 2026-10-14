// Browser -> compiled Pages router -> real local D1. No fake vote responses.
import assert from 'node:assert/strict';
import {readFileSync, existsSync, statSync, mkdirSync, readdirSync} from 'node:fs';
import {resolve, extname, sep} from 'node:path';
import {Miniflare, Response as WorkerResponse, Request as WorkerRequest} from 'miniflare';
import {chromium, devices} from 'playwright-core';
const base = 'http://localhost:8789';
const dist = resolve('dist');
const mime: Record<string, string> = {'.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg'};
const mapping = {A: 'Synthetic Alpha', B: 'Synthetic Beta', C: 'Synthetic Gamma'};
const mf = new Miniflare({
  modules: true, scriptPath: '.wrangler/functions-build/index.js', compatibilityDate: '2026-07-30', host: '127.0.0.1', port: 8789,
  d1Databases: ['VOTES_DB'], bindings: {
    ALLOWED_ORIGIN: base, EXPERIMENT_ID: 'one-sound-001', VOTING_OPEN: 'true', MODEL_TRACK_MAP: JSON.stringify(mapping),
    VOTE_COOKIE_SECRET: 'cookie-qa-'.repeat(5), VOTER_HASH_SECRET: 'voter-qa-'.repeat(5), RATE_LIMIT_SECRET: 'rate-qa-'.repeat(5),
  },
  serviceBindings: {ASSETS: async (request: WorkerRequest) => {
    let path = resolve(dist, '.' + new URL(request.url).pathname);
    if (!path.startsWith(dist + sep) && path !== dist) return new WorkerResponse('', {status: 403});
    if (existsSync(path) && statSync(path).isDirectory()) path = resolve(path, 'index.html');
    if (!existsSync(path)) return new WorkerResponse('', {status: 404});
    return new WorkerResponse(readFileSync(path), {headers: {'Content-Type': mime[extname(path)] ?? 'application/octet-stream'}});
  }},
});
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox']});
try {
  await mf.ready;
  const db = await mf.getD1Database('VOTES_DB');
  for (const sql of readFileSync('migrations/0001_one_sound.sql', 'utf8').replace(/--[^\n]*/g, '').split(';').filter(s => s.trim())) await db.prepare(sql).run();
  mkdirSync('qa-output', {recursive: true});
  for (const width of [360, 390, 1440]) {
    const context = await browser.newContext({...width < 768 ? devices['Pixel 7'] : {}, viewport: {width, height: 900}});
    await context.route('https://**/*', route => route.fulfill({status: 200, body: ''}));
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/one-sound/`);
    await page.waitForFunction(() => document.querySelector('#vote-note')?.textContent?.includes('Choose your favorite'));
    assert.ok(!(await page.content()).includes('Synthetic Alpha'));
    assert.ok(await page.locator('.os-vote-button').isDisabled());
    await page.getByRole('radio', {name: 'Track B', exact: true}).check();
    await page.locator('.os-vote-button').click();
    await page.locator('#vote-results').waitFor({state: 'visible'});
    for (const name of Object.values(mapping)) assert.ok(await page.getByText(name, {exact: true}).isVisible());
    assert.ok(await page.getByText('100.0% ·', {exact: false}).isVisible());
    assert.ok(await page.locator('.os-vote-button').isDisabled());
    await page.reload();
    await page.locator('#vote-results').waitFor({state: 'visible'});
    assert.ok(await page.getByText('Your vote', {exact: true}).isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    const cookies = await context.cookies();
    const cookie = cookies.find(c => c.name === '__Host-one-sound')!;
    assert.ok(cookie.secure && cookie.httpOnly && cookie.sameSite === 'Lax');
    await page.screenshot({path: `qa-output/voting-${width}.png`, fullPage: true});
    await context.close();
    console.log(`PASS ${width}px: real D1 vote, authorized reveal, percentages, reload recovery, cookie flags, no browser storage`);
  }
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM votes').first<{n: number}>())!.n, 3);
  const fresh = await browser.newContext();
  const page = await fresh.newPage();
  await fresh.route('https://**/*', route => route.fulfill({status: 200, body: ''}));
  await page.goto(`${base}/one-sound/`);
  await page.waitForFunction(() => document.querySelector('#vote-note')?.textContent?.includes('Choose your favorite'));
  // A dropped response AFTER a real committed vote: retry must not create another row.
  let dropped = false;
  await page.route('**/api/one-sound/vote', async route => {
    const response = await route.fetch();
    if (!dropped) { dropped = true; assert.equal(response.status(), 201); await route.abort(); }
    else await route.fulfill({response});
  });
  await page.getByRole('radio', {name: 'Track C', exact: true}).check();
  await page.locator('.os-vote-button').click();
  await page.waitForFunction(() => document.querySelector('#vote-note')?.textContent?.includes('could not confirm'));
  await page.locator('.os-vote-button').click();
  await page.locator('#vote-results').waitFor({state: 'visible'});
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM votes').first<{n: number}>())!.n, 4);
  await fresh.close();
  const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => statSync(resolve(dir, name)).isDirectory() ? walk(resolve(dir, name)) : [resolve(dir, name)]);
  for (const path of walk(dist)) {
    const bytes = readFileSync(path);
    for (const value of [...Object.values(mapping), 'MODEL_TRACK_MAP', 'VOTE_COOKIE_SECRET', 'VOTER_HASH_SECRET', 'RATE_LIMIT_SECRET']) assert.ok(!bytes.includes(value), `server data leaked to ${path}`);
  }
  console.log('PASS dropped-response idempotent retry; public-artifact secret/synthetic identity scan');
} finally { await browser.close(); await mf.dispose(); }
