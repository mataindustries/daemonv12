// Browser -> compiled Pages router -> real local D1. No fake vote responses.
import assert from 'node:assert/strict';
import {readFileSync, existsSync, statSync, mkdirSync, readdirSync} from 'node:fs';
import {resolve, extname, sep} from 'node:path';
import {Miniflare, Response as WorkerResponse, Request as WorkerRequest} from 'miniflare';
import {chromium, devices} from 'playwright-core';
import {mockTurnstile} from './lib/mock-turnstile.ts';
import {applyVotingMigrations} from './lib/voting-migrations.ts';
const base = 'http://localhost:8789';
const dist = resolve('dist');
const mime: Record<string, string> = {'.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg'};
const mapping = {A: 'Synthetic Alpha', B: 'Synthetic Beta', C: 'Synthetic Gamma'};
let rejectVerification = false;
let verificationCalls = 0;
const usedTokens = new Set<string>();
const options = {
  outboundService: async (request: WorkerRequest) => {
    assert.equal(new URL(request.url).hostname, 'challenges.cloudflare.com');
    verificationCalls++;
    const token = (await request.formData()).get('response');
    assert.ok(typeof token === 'string' && token.startsWith('synthetic-token-'));
    const success = !rejectVerification && !usedTokens.has(token);
    usedTokens.add(token);
    return WorkerResponse.json({success, hostname: 'localhost', action: 'one-sound-vote', challenge_ts: new Date().toISOString()});
  },
  modules: true, scriptPath: '.wrangler/functions-build/index.js', compatibilityDate: '2026-07-30', host: '127.0.0.1', port: 8789,
  d1Databases: ['VOTES_DB'], bindings: {
    TURNSTILE_SECRET_KEY: 'synthetic-provider-secret', ALLOWED_ORIGIN: base, EXPERIMENT_ID: 'one-sound-001', VOTING_OPEN: 'true', MODEL_TRACK_MAP: JSON.stringify(mapping),
    VOTE_COOKIE_SECRET: 'cookie-qa-'.repeat(5), VOTER_HASH_SECRET: 'voter-qa-'.repeat(5), RATE_LIMIT_SECRET: 'rate-qa-'.repeat(5),
  },
  serviceBindings: {ASSETS: async (request: WorkerRequest) => {
    let path = resolve(dist, '.' + new URL(request.url).pathname);
    if (!path.startsWith(dist + sep) && path !== dist) return new WorkerResponse('', {status: 403});
    if (existsSync(path) && statSync(path).isDirectory()) path = resolve(path, 'index.html');
    if (!existsSync(path)) return new WorkerResponse('', {status: 404});
    return new WorkerResponse(readFileSync(path), {headers: {'Content-Type': mime[extname(path)] ?? 'application/octet-stream'}});
  }},
};
const mf = new Miniflare(options);
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox']});
try {
  await mf.ready;
  let db = await mf.getD1Database('VOTES_DB');
  await applyVotingMigrations(db);
  mkdirSync('qa-output', {recursive: true});
  for (const width of [360, 390, 1440]) {
    const context = await browser.newContext({...width < 768 ? devices['Pixel 7'] : {}, viewport: {width, height: 900}});
    await mockTurnstile(context);
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
    const callsBeforeReload = verificationCalls;
    await page.reload();
    await page.locator('#vote-results').waitFor({state: 'visible'});
    assert.ok(await page.getByText('Your vote', {exact: true}).isVisible());
    assert.equal(verificationCalls, callsBeforeReload);
    assert.equal(await page.locator('script[src*="challenges.cloudflare.com"]').count(), 0, 'reload recovery must not load a widget');
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
  await mockTurnstile(fresh);
  await page.goto(`${base}/one-sound/`);
  await page.waitForFunction(() => document.querySelector('#vote-note')?.textContent?.includes('Choose your favorite'));
  // A dropped response AFTER a real committed vote: retry must not create another row.
  let dropped = false;
  let firstBody: Record<string, unknown> | undefined;
  let firstVerifyCalls = 0;
  await page.route('**/api/one-sound/vote', async route => {
    const response = await route.fetch();
    if (!dropped) { dropped = true; firstBody = route.request().postDataJSON(); firstVerifyCalls = verificationCalls; assert.equal(response.status(), 201); await route.abort(); }
    else { assert.deepEqual(route.request().postDataJSON(), firstBody); assert.equal(verificationCalls, firstVerifyCalls); await route.fulfill({response}); }
  });
  await page.getByRole('radio', {name: 'Track C', exact: true}).check();
  await page.locator('.os-vote-button').click();
  await page.waitForFunction(() => document.querySelector('#vote-note')?.textContent?.includes('could not confirm'));
  await page.evaluate('window.__turnstileMock.expire()');
  assert.ok(await page.locator('.os-vote-button').isEnabled(), 'persisted retry must not require a fresh challenge');
  await page.locator('.os-vote-button').click();
  await page.locator('#vote-results').waitFor({state: 'visible'});
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM votes').first<{n: number}>())!.n, 4);
  await fresh.close();
  let expectedVotes = 4;
  // Close the actual compiled worker after the browser has loaded an open ballot.
  const closing = await browser.newContext();
  await mockTurnstile(closing);
  const closingPage = await closing.newPage();
  await closingPage.goto(`${base}/one-sound/`);
  await closingPage.waitForFunction(() => document.querySelector('#vote-note')?.textContent?.includes('Choose your favorite'));
  await closingPage.getByRole('radio', {name: 'Track A', exact: true}).check();
  await mf.setOptions({...options, bindings: {...options.bindings, VOTING_OPEN: 'false'}});
  db = await mf.getD1Database('VOTES_DB');
  await closingPage.locator('.os-vote-button').click();
  await closingPage.waitForFunction(() => document.querySelector('#vote-note')?.textContent?.includes('Voting is currently closed'));
  assert.ok(await closingPage.locator('.os-vote-button').isDisabled());
  assert.equal(await closingPage.locator('.os-vote-button').textContent(), 'Voting is closed');
  assert.ok(await closingPage.locator('#vote-results').isHidden());
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM votes').first<{n: number}>())!.n, expectedVotes);
  await mf.setOptions(options);
  db = await mf.getD1Database('VOTES_DB');
  await closingPage.getByRole('button', {name: 'Check voting status'}).click();
  await closingPage.waitForFunction(() => document.querySelector('#vote-note')?.textContent?.includes('Choose your favorite'));
  await closingPage.waitForFunction(() => !(document.querySelector('.os-vote-button') as HTMLButtonElement).disabled);
  await closing.close();
  console.log('PASS real server closure disables ballot; explicit status recheck recovers after reopening');

  for (const recovery of ['changed-selection', 'failed-reveal']) {
    const context = await browser.newContext();
    await mockTurnstile(context);
    const recoveryPage = await context.newPage();
    await recoveryPage.goto(`${base}/one-sound/`);
    await recoveryPage.waitForFunction(() => document.querySelector('#vote-note')?.textContent?.includes('Choose your favorite'));
    let lost = false;
    await recoveryPage.route('**/api/one-sound/vote', async route => {
      const response = await route.fetch();
      if (!lost) { lost = true; assert.equal(response.status(), 201); await route.abort(); }
      else await route.fulfill({response});
    });
    await recoveryPage.getByRole('radio', {name: 'Track C', exact: true}).check();
    await recoveryPage.locator('.os-vote-button').click();
    await recoveryPage.waitForFunction(() => document.querySelector('#vote-note')?.textContent?.includes('could not confirm'));
    if (recovery === 'changed-selection') {
      await recoveryPage.getByRole('radio', {name: 'Track A', exact: true}).check();
      await recoveryPage.locator('.os-vote-button').click();
    } else {
      await recoveryPage.route('**/api/one-sound/reveal', route => route.abort(), {times: 1});
      await recoveryPage.getByRole('button', {name: 'Check voting status'}).click();
      await recoveryPage.waitForFunction(() => document.querySelector('#vote-note')?.textContent?.includes('could not confirm'));
      assert.ok(await recoveryPage.locator('.os-vote-button').isDisabled());
      await recoveryPage.getByRole('button', {name: 'Check voting status'}).click();
    }
    await recoveryPage.locator('#vote-results').waitFor({state: 'visible'});
    assert.ok(await recoveryPage.getByRole('radio', {name: 'Track C', exact: true}).isChecked());
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM votes').first<{n: number}>())!.n, ++expectedVotes);
    assert.equal((await db.prepare('SELECT SUM(count) AS n FROM vote_totals').first<{n: number}>())!.n, expectedVotes);
    await context.close();
    console.log(`PASS ${recovery}: committed selection and counters recovered without an extra vote`);
  }
  // Client callbacks must invalidate the token and block submission until reverified.
  const challengeContext = await browser.newContext({viewport: {width: 320, height: 800}});
  await mockTurnstile(challengeContext);
  const challengePage = await challengeContext.newPage();
  await challengePage.goto(`${base}/one-sound/`);
  await challengePage.getByRole('radio', {name: 'Track A', exact: true}).check();
  for (const method of ['expire', 'fail', 'timeout']) {
    await challengePage.waitForFunction(() => !(document.querySelector('.os-vote-button') as HTMLButtonElement).disabled);
    await challengePage.evaluate(`window.__turnstileMock.${method}()`);
    assert.ok(await challengePage.locator('.os-vote-button').isDisabled());
    assert.ok(await challengePage.getByRole('button', {name: 'Retry verification'}).isVisible());
    await challengePage.getByRole('button', {name: 'Retry verification'}).click();
  }
  await challengePage.waitForFunction(() => !(document.querySelector('.os-vote-button') as HTMLButtonElement).disabled);
  // Provider rejects a token: a new challenge is required, but UUID stays unchanged.
  rejectVerification = true;
  const bodies: Array<Record<string, unknown>> = [];
  challengePage.on('request', request => { if (request.url().endsWith('/vote')) bodies.push(request.postDataJSON()); });
  await challengePage.locator('.os-vote-button').click();
  await challengePage.waitForFunction(() => document.querySelector('#vote-note')?.textContent?.includes('rejected or expired'));
  rejectVerification = false;
  await challengePage.locator('.os-vote-button').click();
  await challengePage.locator('#vote-results').waitFor({state: 'visible'});
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0]!.requestId, bodies[1]!.requestId);
  assert.notEqual(bodies[0]!.turnstileToken, bodies[1]!.turnstileToken);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM votes').first<{n: number}>())!.n, ++expectedVotes);
  assert.ok(await challengePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await challengeContext.close();
  const blocked = await browser.newContext();
  await mockTurnstile(blocked);
  await blocked.route('**/turnstile/v0/api.js?render=explicit', route => route.abort(), {times: 1});
  const blockedPage = await blocked.newPage();
  await blockedPage.goto(`${base}/one-sound/`);
  await blockedPage.getByRole('radio', {name: 'Track B', exact: true}).check();
  await blockedPage.waitForFunction(() => document.querySelector('#verification-note')?.textContent?.includes('could not load'));
  assert.ok(await blockedPage.locator('.os-vote-button').isDisabled());
  await blockedPage.getByRole('button', {name: 'Retry verification'}).click();
  await blockedPage.waitForFunction(() => !(document.querySelector('.os-vote-button') as HTMLButtonElement).disabled);
  await blocked.close();
  console.log('PASS Turnstile token/action, expiry/error/timeout, script retry, provider rejection, UUID preservation and challenge-free persisted recovery');
  const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => statSync(resolve(dir, name)).isDirectory() ? walk(resolve(dir, name)) : [resolve(dir, name)]);
  for (const path of walk(dist)) {
    const bytes = readFileSync(path);
    for (const value of [...Object.values(mapping), 'MODEL_TRACK_MAP', 'VOTE_COOKIE_SECRET', 'VOTER_HASH_SECRET', 'RATE_LIMIT_SECRET']) assert.ok(!bytes.includes(value), `server data leaked to ${path}`);
  }
  console.log('PASS dropped-response idempotent retry; public-artifact secret/synthetic identity scan');
} finally { await browser.close(); await mf.dispose(); }
