import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {ReadableStream} from 'node:stream/web';
import ts from 'typescript';
import {Miniflare, Response as WorkerResponse} from 'miniflare';
import {applyVotingMigrations} from '../scripts/lib/voting-migrations.ts';
const source = readFileSync(new URL('../functions/_lib/voting.ts', import.meta.url), 'utf8');
// Instrument only the test entry point; every SQL operation still uses real D1.
const script = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText + `
let faultInjected = false;
const originalNow = Date.now;
export default {async fetch(request, env) {
  const testNow = request.headers.get('X-Test-Now');
  Date.now = testNow ? () => Number(testNow) : originalNow;
  // Miniflare supplies a default CF IP for an empty header. Inject malformed
  // values only in this test entry point, after that platform normalization.
  if (request.headers.has('X-Test-IP')) {
    const headers = new Headers(request.headers);
    const ip = JSON.parse(request.headers.get('X-Test-IP'));
    if (ip === null) headers.delete('CF-Connecting-IP');
    else headers.set('CF-Connecting-IP', ip);
    request = new Request(request, {headers});
  }
  let queries = 0, writes = 0, resultRows = 0, inserted = false;
  const db = env.VOTES_DB && {withSession(mode) {
    const session = env.VOTES_DB.withSession(mode);
    return {prepare(sql) {
      const wrap = statement => new Proxy(statement, {get(target, key) {
        if (key === 'bind') return (...args) => wrap(target.bind(...args));
        if (['first', 'all', 'run'].includes(key)) return async (...args) => {
          queries++;
          if (/^(INSERT|UPDATE|DELETE)/.test(sql)) writes++;
          const fault = (env.TEST_FAULT === 'read' && inserted && sql.startsWith('SELECT track_id, request_id')) ||
            (env.TEST_FAULT === 'totals' && sql.includes('FROM vote_totals'));
          if (fault && !faultInjected) { faultInjected = true; throw Error('synthetic sensitive database details'); }
          const result = await target[key](...args);
          if (sql.startsWith('INSERT INTO votes')) inserted = true;
          if (sql.includes('FROM vote_totals')) resultRows += result.meta.rows_read;
          return result;
        };
        return Reflect.get(target, key);
      }});
      return wrap(session.prepare(sql));
    }};
  }};
  const response = await handle(request, {...env, VOTES_DB: db});
  response.headers.set('X-Test-Queries', String(queries));
  response.headers.set('X-Test-Writes', String(writes));
  response.headers.set('X-Test-Result-Rows', String(resultRows));
  return response;
}};`;
const bindings: Record<string, string> = {
  EXPERIMENT_ID: 'one-sound-001', VOTING_OPEN: 'true', ALLOWED_ORIGIN: 'https://example.test',
  MODEL_TRACK_MAP: JSON.stringify({A: 'Synthetic Alpha', B: 'Synthetic Beta', C: 'Synthetic Gamma'}),
  VOTE_COOKIE_SECRET: 'cookie-test-'.repeat(4), VOTER_HASH_SECRET: 'voter-test-'.repeat(4), RATE_LIMIT_SECRET: 'rate-test-'.repeat(4),
};
async function setup(overrides: Record<string, string> = {}, database = true, provider?: () => WorkerResponse | Promise<WorkerResponse>, migrations?: string[]) {
  const options = {outboundService: provider, modules: true, script, compatibilityDate: '2026-07-30', bindings: {...bindings, ...overrides}, d1Databases: database ? ['VOTES_DB'] : []};
  const mf = new Miniflare(options);
  let db = database ? await mf.getD1Database('VOTES_DB') : null;
  if (db) {
    await applyVotingMigrations(db, migrations);
  }
  const request = async (path: string, init: {method?: string; headers?: Record<string, string>; body?: string | Uint8Array | ReadableStream<Uint8Array>} = {}) => {
    const headers = new Headers(init.headers);
    if (!headers.has('CF-Connecting-IP')) headers.set('CF-Connecting-IP', '192.0.2.1');
    const res = await mf.dispatchFetch(`https://example.test/api/one-sound/${path}`, {...init, duplex: 'half', headers: Object.fromEntries(headers)});
    assert.equal(res.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(res.headers.get('CDN-Cache-Control'), 'no-store');
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
    return res;
  };
  const session = async () => {
    const res = await request('session');
    assert.equal(res.status, 200);
    const body = await res.json() as {csrfToken: string; hasVoted: boolean};
    const setCookie = res.headers.get('Set-Cookie')!;
    assert.match(setCookie, /Secure; HttpOnly; SameSite=Lax; Path=\/; Max-Age=7776000/);
    assert.ok(!setCookie.includes('Domain='));
    assert.equal(body.hasVoted, false);
    assert.ok(!('reveal' in body) && !('results' in body));
    return {cookie: setCookie.split(';')[0]!, body: {experimentId: 'one-sound-001', trackId: 'B', requestId: crypto.randomUUID(), csrfToken: body.csrfToken}};
  };
  const vote = (s: Awaited<ReturnType<typeof session>>, change = {}, headers = {}) => request('vote', {method: 'POST', headers: {'Content-Type': 'application/json', Origin: bindings.ALLOWED_ORIGIN!, Cookie: s.cookie, ...headers}, body: JSON.stringify({...s.body, ...change})});
  const setVotingOpen = async (open: boolean) => {
    options.bindings.VOTING_OPEN = String(open);
    await mf.setOptions(options);
    db = database ? await mf.getD1Database('VOTES_DB') : null;
  };
  return {mf, get db() { return db; }, request, session, vote, setVotingOpen};
}

test('D1: concurrent identical votes persist once; retry, conflict, counts and reload recovery', async () => {
  const h = await setup();
  try {
    const s = await h.session();
    const responses = await Promise.all(Array.from({length: 12}, () => h.vote(s)));
    assert.equal(responses.filter(r => r.status === 201).length, 1);
    assert.equal(responses.filter(r => r.status === 200).length, 11);
    for (const res of responses) {
      const data = await res.json() as {reveal: object; results: object};
      assert.deepEqual(data.reveal, JSON.parse(bindings.MODEL_TRACK_MAP!));
      assert.deepEqual(data.results, {A: 0, B: 1, C: 0, total: 1});
    }
    assert.equal((await h.vote(s, {trackId: 'C'})).status, 409);
    assert.equal((await h.vote(s, {requestId: crypto.randomUUID()})).status, 409);
    const second = await h.session();
    assert.equal((await h.vote(second, {trackId: 'A'})).status, 201);
    const recovery = await h.request('reveal', {headers: {Cookie: s.cookie}});
    assert.equal(recovery.status, 200);
    assert.deepEqual((await recovery.json() as {results: object}).results, {A: 1, B: 1, C: 0, total: 2});
    const state = await h.request('session', {headers: {Cookie: s.cookie}});
    assert.equal((await state.json() as {hasVoted: boolean}).hasVoted, true);
    const rows = await h.db!.prepare('SELECT * FROM votes').all();
    assert.equal(rows.results.length, 2);
    assert.ok(!JSON.stringify(rows.results).includes(s.cookie));
  } finally { await h.mf.dispose(); }
});

test('D1: different concurrent votes and cross-session request ID collision cannot add duplicates', async () => {
  const h = await setup();
  try {
    const s = await h.session();
    const responses = await Promise.all(['A', 'B', 'C'].map(trackId => h.vote(s, {trackId, requestId: crypto.randomUUID()})));
    assert.deepEqual(responses.map(r => r.status).sort(), [201, 409, 409]);
    const row = await h.db!.prepare('SELECT request_id FROM votes').first<{request_id: string}>();
    const other = await h.session();
    assert.equal((await h.vote(other, {requestId: row!.request_id})).status, 409);
    assert.equal((await h.db!.prepare('SELECT COUNT(*) AS n FROM votes').first<{n: number}>())!.n, 1);
  } finally { await h.mf.dispose(); }
});

test('authorization and strict request validation never leak the mapping', async () => {
  const h = await setup();
  try {
    const s = await h.session();
    const expiredPayload = `${'a'.repeat(64)}.${Math.floor(Date.now() / 1000) - 1}`;
    const expiredMac = createHmac('sha256', bindings.VOTE_COOKIE_SECRET!).update(`cookie:${expiredPayload}`).digest('hex');
    const denied = [
      await h.request('session', {headers: {Cookie: `__Host-one-sound=${expiredPayload}.${expiredMac}`}}),
      await h.request('session', {headers: {Cookie: `${s.cookie}; ${s.cookie}`}}),
      await h.request('reveal'), await h.request('reveal', {headers: {Cookie: s.cookie}}),
      await h.request('session', {headers: {Cookie: s.cookie.slice(0, -1) + (s.cookie.endsWith('0') ? '1' : '0')}}),
      await h.vote(s, {csrfToken: 'forged'}), await h.vote(s, {}, {Origin: 'https://evil.test'}),
      await h.vote(s, {}, {Origin: ''}), await h.vote(s, {}, {Cookie: ''}),
      await h.vote(s, {trackId: 'D'}), await h.vote(s, {results: {A: 500}}),
      await h.vote(s, {requestId: 'invalid'}), await h.vote(s, {experimentId: 'other'}),
      await h.request('session', {headers: {'Sec-Fetch-Site': 'cross-site'}}),
    ];
    for (const res of denied) {
      assert.ok([400, 403].includes(res.status));
      const text = await res.text();
      assert.ok(!text.includes('Synthetic') && !text.includes('results'));
    }
    for (const [body, expected] of [['{', 400], ['[]', 400], [' '.repeat(2049), 413]] as const) {
      assert.equal((await h.request('vote', {method: 'POST', headers: {Cookie: s.cookie, Origin: bindings.ALLOWED_ORIGIN!, 'Content-Type': 'application/json'}, body})).status, expected);
    }
    assert.equal((await h.vote(s, {}, {'Content-Type': 'text/plain'})).status, 415);
    assert.equal((await h.request('vote')).status, 405);
    assert.equal((await h.request('unknown')).status, 404);
    assert.equal((await h.db!.prepare('SELECT COUNT(*) AS n FROM votes').first<{n: number}>())!.n, 0);
  } finally { await h.mf.dispose(); }
});

test('missing configuration, database, tables and closed voting fail closed', async () => {
  for (const name of ['MODEL_TRACK_MAP', 'VOTE_COOKIE_SECRET', 'VOTER_HASH_SECRET', 'RATE_LIMIT_SECRET', 'ALLOWED_ORIGIN', 'EXPERIMENT_ID']) {
    const h = await setup({[name]: ''});
    try { assert.equal((await h.request('session')).status, 503); } finally { await h.mf.dispose(); }
  }
  const absent = await setup({}, false);
  try { assert.equal((await absent.request('session')).status, 503); } finally { await absent.mf.dispose(); }
  const closed = await setup();
  try {
    const s = await closed.session();
    await closed.setVotingOpen(false);
    assert.equal((await closed.vote(s)).status, 503);
    await closed.db!.prepare('DROP TABLE votes').run();
    assert.equal((await closed.request('session', {headers: {Cookie: s.cookie}})).status, 503);
  } finally { await closed.mf.dispose(); }
});

test('rate limits use temporary hashed keys and optional challenge fails closed', async () => {
  const h = await setup();
  try {
    for (let i = 0; i < 60; i++) assert.equal((await h.request('session')).status, 200);
    const limited = await h.request('session');
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('Retry-After'), '600');
    const records = await h.db!.prepare('SELECT * FROM rate_limits').all<{key: string; expires_at: number}>();
    for (const row of records.results) {
      assert.match(row.key, /^[a-f0-9]{64}$/);
      assert.ok(row.expires_at <= Date.now() / 1000 + 600);
    }
    await h.db!.prepare('INSERT INTO rate_limits VALUES (?, 1, 0)').bind('expired').run();
    await h.request('session', {headers: {'CF-Connecting-IP': '2001:db8::1'}});
    // Cleanup is a private maintenance task, not attacker-triggered request work.
    assert.notEqual(await h.db!.prepare("SELECT * FROM rate_limits WHERE key = 'expired'").first(), null);
    await h.db!.prepare('DELETE FROM rate_limits WHERE expires_at <= unixepoch()').run();
    assert.equal(await h.db!.prepare("SELECT * FROM rate_limits WHERE key = 'expired'").first(), null);
  } finally { await h.mf.dispose(); }
  const challenged = await setup({TURNSTILE_SECRET_KEY: 'synthetic-test-key'});
  try {
    assert.equal((await challenged.vote(await challenged.session())).status, 403);
  } finally { await challenged.mf.dispose(); }
});


test('optional challenge validates provider success, hostname, action, age and rejects replay/failure', async () => {
  let result: Record<string, unknown> = {success: false};
  const h = await setup({TURNSTILE_SECRET_KEY: 'synthetic-test-key'}, true, () => WorkerResponse.json(result));
  try {
    const good = {success: true, hostname: 'example.test', action: 'one-sound-vote', challenge_ts: new Date().toISOString()};
    for (const invalid of [{success: false}, {...good, hostname: 'evil.test'}, {...good, action: 'other'}, {...good, challenge_ts: 'invalid'}, {...good, challenge_ts: new Date(0).toISOString()}]) {
      result = invalid;
      assert.equal((await h.vote(await h.session(), {turnstileToken: 'synthetic-token'})).status, 403);
    }
    result = good;
    const s = await h.session();
    assert.equal((await h.vote(s, {turnstileToken: 'synthetic-token'})).status, 201);
    result = {success: false, 'error-codes': ['timeout-or-duplicate']};
    assert.equal((await h.vote(await h.session(), {turnstileToken: 'synthetic-token'})).status, 403);
    assert.equal((await h.vote(s, {turnstileToken: 'synthetic-token'})).status, 200);
    assert.equal((await h.db!.prepare('SELECT COUNT(*) AS n FROM votes').first<{n: number}>())!.n, 1);
  } finally { await h.mf.dispose(); }
});

test('D1: concurrent limiter saturation stops writes and never exceeds its cap', async () => {
  const h = await setup();
  try {
    const responses = await Promise.all(Array.from({length: 65}, () => h.request('session')));
    assert.equal(responses.filter(r => r.status === 200).length, 60);
    assert.equal(responses.filter(r => r.status === 429).length, 5);
    assert.equal((await h.db!.prepare('SELECT attempts FROM rate_limits').first<{attempts: number}>())!.attempts, 60);
    for (let i = 0; i < 5; i++) {
      const denied = await h.request('session');
      assert.equal(denied.status, 429);
      assert.equal(denied.headers.get('X-Test-Writes'), '0');
      assert.equal(denied.headers.get('X-Test-Queries'), '0');
    }
    // An independently running isolate has no rejection cache, but the D1 cap
    // must still deny it without executing a mutation statement.
    await h.setVotingOpen(true);
    const denied = await h.request('session');
    assert.equal(denied.status, 429);
    assert.equal(denied.headers.get('X-Test-Writes'), '0');
    assert.equal((await h.request('session', {headers: {'CF-Connecting-IP': '192.0.2.99'}})).status, 429);
    assert.equal((await h.request('session', {headers: {'CF-Connecting-IP': '192.0.3.1'}})).status, 200);
  } finally { await h.mf.dispose(); }
});

test('D1: closed anonymous visits and unauthenticated/invalid votes execute no SQL', async () => {
  const h = await setup();
  try {
    const s = await h.session();
    await h.setVotingOpen(false);
    await h.db!.prepare('DELETE FROM rate_limits').run();
    const requests = [
      h.request('session'), h.request('reveal'),
      h.request('vote', {method: 'POST', headers: {Origin: bindings.ALLOWED_ORIGIN!}}),
      h.request('session', {headers: {Cookie: '__Host-one-sound=forged'}}),
      h.vote(s, {csrfToken: 'forged'}), h.vote(s, {trackId: 'D'}),
    ];
    const responses = await Promise.all(requests);
    assert.deepEqual(responses.map(res => res.status), [200, 403, 403, 403, 403, 400]);
    assert.equal(responses[0]!.headers.get('Set-Cookie'), null, 'closed preview must not mint unlimited voting credentials');
    for (const res of responses) {
      assert.equal(res.headers.get('X-Test-Queries'), '0');
      assert.ok(!(await res.text()).includes('Synthetic'));
    }
    assert.equal((await h.db!.prepare('SELECT COUNT(*) AS n FROM rate_limits').first<{n: number}>())!.n, 0);
  } finally { await h.mf.dispose(); }
});

test('D1: vote retries and reveals share one per-voter budget across client networks', async () => {
  const h = await setup();
  try {
    const s = await h.session();
    assert.equal((await h.vote(s)).status, 201);
    const responses = await Promise.all(Array.from({length: 34}, (_, i) => i % 2
      ? h.vote(s, {}, {'CF-Connecting-IP': `198.51.${i}.1`})
      : h.request('reveal', {headers: {Cookie: s.cookie, 'CF-Connecting-IP': `203.0.${i}.1`}})));
    assert.equal(responses.filter(res => res.status === 200).length, 29);
    assert.equal(responses.filter(res => res.status === 429).length, 5);
    const denied = await h.request('reveal', {headers: {Cookie: s.cookie, 'CF-Connecting-IP': '192.0.99.1'}});
    assert.equal(denied.status, 429);
    assert.equal(denied.headers.get('X-Test-Queries'), '0');
    assert.equal((await h.db!.prepare('SELECT COUNT(*) AS n FROM votes').first<{n: number}>())!.n, 1);
    assert.equal((await h.db!.prepare("SELECT count FROM vote_totals WHERE track_id = 'B'").first<{count: number}>())!.count, 1);
  } finally { await h.mf.dispose(); }
});

test('D1: migration backfills votes, counters remain atomic, and result reads stay bounded', async () => {
  const h = await setup({}, true, undefined, ['0001_one_sound.sql']);
  try {
    await h.db!.prepare("INSERT INTO votes VALUES ('one-sound-001', 'synthetic-before-migration', 'C', 'synthetic-request', unixepoch())").run();
    await applyVotingMigrations(h.db!, ['0002_vote_totals.sql']);
    const s = await h.session();
    const initial = await h.vote(s);
    assert.equal(initial.status, 201);
    assert.deepEqual((await initial.json() as {results: object}).results, {A: 0, B: 1, C: 1, total: 2});
    const before = Number(initial.headers.get('X-Test-Result-Rows'));
    await h.db!.prepare(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 1500)
      INSERT INTO votes(experiment_id, voter_hash, track_id, request_id)
      SELECT 'one-sound-001', 'synthetic-bulk-' || i, 'A', 'synthetic-bulk-' || i FROM n`).run();
    const after = await h.request('reveal', {headers: {Cookie: s.cookie}});
    assert.equal(after.status, 200);
    assert.deepEqual((await after.json() as {results: object}).results, {A: 1500, B: 1, C: 1, total: 1502});
    assert.ok(before > 0 && before <= 6);
    assert.equal(Number(after.headers.get('X-Test-Result-Rows')), before);
    await assert.rejects(h.db!.prepare("UPDATE votes SET track_id = 'B' WHERE voter_hash = 'synthetic-before-migration'").run());
    await h.db!.prepare("DELETE FROM votes WHERE voter_hash = 'synthetic-before-migration'").run();
    assert.equal((await h.db!.prepare("SELECT count FROM vote_totals WHERE track_id = 'C'").first<{count: number}>())!.count, 0);
    // Break a synthetic counter: its trigger must abort the vote, not drift.
    await h.db!.prepare("DELETE FROM vote_totals WHERE track_id = 'C'").run();
    await assert.rejects(h.db!.prepare("INSERT INTO votes VALUES ('one-sound-001', 'synthetic-rollback', 'C', 'synthetic-rollback', unixepoch())").run());
    assert.equal(await h.db!.prepare("SELECT 1 FROM votes WHERE voter_hash = 'synthetic-rollback'").first(), null);
  } finally { await h.mf.dispose(); }
});

test('D1: concurrent distinct voters produce exact counters and retries never increment them', async () => {
  const h = await setup();
  try {
    const sessions = await Promise.all(Array.from({length: 18}, () => h.session()));
    const responses = await Promise.all(sessions.map((s, i) => h.vote(s, {trackId: ['A', 'B', 'C'][i % 3]})));
    assert.ok(responses.every(res => res.status === 201));
    const retries = await Promise.all(sessions.map((s, i) => h.vote(s, {trackId: ['A', 'B', 'C'][i % 3]})));
    assert.ok(retries.every(res => res.status === 200));
    const result = await h.request('reveal', {headers: {Cookie: sessions[0]!.cookie}});
    assert.deepEqual((await result.json() as {results: object}).results, {A: 6, B: 6, C: 6, total: 18});
  } finally { await h.mf.dispose(); }
});

test('D1: post-commit failures are generic; exact retry and reveal recover while closed', async () => {
  for (const fault of ['read', 'totals']) {
    const h = await setup({TEST_FAULT: fault});
    try {
      const s = await h.session();
      const failed = await h.vote(s);
      assert.equal(failed.status, 503);
      assert.deepEqual(await failed.json(), {error: 'unavailable'});
      assert.equal((await h.db!.prepare('SELECT COUNT(*) AS n FROM votes').first<{n: number}>())!.n, 1);
      const retry = await h.vote(s);
      assert.equal(retry.status, 200);
      assert.deepEqual((await retry.json() as {results: object}).results, {A: 0, B: 1, C: 0, total: 1});
      const other = await h.session();
      // Worker reload resets the one-shot fault; persisted data must survive it.
      await h.setVotingOpen(false);
      if (fault === 'totals') assert.equal((await h.vote(s)).status, 503);
      assert.equal((await h.vote(s)).status, 200);
      assert.equal((await h.request('reveal', {headers: {Cookie: s.cookie}})).status, 200);
      assert.equal((await h.vote(other)).status, 503);
      assert.equal((await h.db!.prepare('SELECT COUNT(*) AS n FROM votes').first<{n: number}>())!.n, 1);
    } finally { await h.mf.dispose(); }
  }
});

test('streamed oversized and malformed UTF-8 vote bodies fail before SQL', async () => {
  const h = await setup();
  try {
    const s = await h.session();
    const stream = new ReadableStream<Uint8Array>({start(controller) {
      controller.enqueue(new Uint8Array(2048).fill(32));
      controller.enqueue(new Uint8Array([32]));
      controller.close();
    }});
    for (const [body, expected] of [[stream, 413], [new Uint8Array([0xc3, 0x28]), 400]] as const) {
      const res = await h.request('vote', {method: 'POST', headers: {Cookie: s.cookie, Origin: bindings.ALLOWED_ORIGIN!, 'Content-Type': 'application/json'}, body});
      assert.equal(res.status, expected);
      assert.equal(res.headers.get('X-Test-Queries'), '0');
    }
  } finally { await h.mf.dispose(); }
});

test('cookie horizon, cross-session CSRF, missing/null origins and authorized cross-site reveal fail closed', async () => {
  const h = await setup();
  try {
    const s = await h.session(), other = await h.session();
    const denied = [await h.vote(s, {csrfToken: other.body.csrfToken})];
    for (const expiry of [Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000) + 90 * 86400 + 3600]) {
      const payload = `${'a'.repeat(64)}.${expiry}`;
      const sig = createHmac('sha256', bindings.VOTE_COOKIE_SECRET!).update(`cookie:${payload}`).digest('hex');
      denied.push(await h.request('session', {headers: {Cookie: `__Host-one-sound=${payload}.${sig}`}}));
    }
    const origins: Record<string, string>[] = [{}, {Origin: 'null'}];
    for (const headers of origins) denied.push(await h.request('vote', {method: 'POST', headers: {Cookie: s.cookie, 'Content-Type': 'application/json', ...headers}, body: JSON.stringify(s.body)}));
    assert.equal((await h.vote(s)).status, 201);
    denied.push(await h.request('reveal', {headers: {Cookie: s.cookie, Origin: 'https://evil.test'}}));
    denied.push(await h.request('reveal', {headers: {Cookie: s.cookie, 'Sec-Fetch-Site': 'cross-site'}}));
    for (const res of denied) {
      assert.equal(res.status, 403);
      assert.equal(res.headers.get('X-Test-Queries'), '0');
      assert.ok(!(await res.text()).includes('Synthetic'));
    }
  } finally { await h.mf.dispose(); }
});

test('challenge provider HTTP and malformed JSON failures cannot persist votes', async () => {
  for (const provider of [() => new WorkerResponse('', {status: 503}), () => new WorkerResponse('not JSON')]) {
    const h = await setup({TURNSTILE_SECRET_KEY: 'synthetic-test-key'}, true, provider);
    try {
      const res = await h.vote(await h.session(), {turnstileToken: 'synthetic-token'});
      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), {error: 'unavailable'});
      assert.equal((await h.db!.prepare('SELECT COUNT(*) AS n FROM votes').first<{n: number}>())!.n, 0);
    } finally { await h.mf.dispose(); }
  }
});

test('D1: cached result throttling expires at the next window and exact retry recovers', async () => {
  const h = await setup();
  try {
    const s = await h.session();
    const now = Date.now();
    const headers = {'X-Test-Now': String(now)};
    assert.equal((await h.vote(s, {}, headers)).status, 201);
    for (let i = 0; i < 29; i++) assert.equal((await h.request('reveal', {headers: {Cookie: s.cookie, ...headers}})).status, 200);
    const denied = await h.vote(s, {}, headers);
    assert.equal(denied.status, 429);
    assert.equal(denied.headers.get('X-Test-Queries'), '0');
    const nextWindow = (Math.floor(now / 600000) + 1) * 600000 + 1000;
    const recovered = await h.vote(s, {}, {'X-Test-Now': String(nextWindow)});
    assert.equal(recovered.status, 200);
    assert.deepEqual((await recovered.json() as {results: object}).results, {A: 0, B: 1, C: 0, total: 1});
  } finally { await h.mf.dispose(); }
});

test('D1: IPv6 normalization preserves /56 buckets; malformed IPs fail before SQL', async () => {
  const h = await setup();
  try {
    for (const ip of ['2001:db8:1234:5600::1', '2001:0db8:1234:56ff:0000:0000:0000:0002', '2001:db8:1234:5700::1']) {
      assert.equal((await h.request('session', {headers: {'CF-Connecting-IP': ip}})).status, 200);
    }
    const {results} = await h.db!.prepare('SELECT attempts FROM rate_limits ORDER BY attempts').all<{attempts: number}>();
    assert.deepEqual(results.map(row => row.attempts), [1, 2]);
    for (const ip of [null, '', '999.1.1.1', 'not-an-ip', '2001:db8::1%eth0']) {
      const res = await h.request('session', {headers: {'X-Test-IP': JSON.stringify(ip)}});
      assert.equal(res.status, 503, `malformed IP ${JSON.stringify(ip)}`);
      assert.equal(res.headers.get('X-Test-Queries'), '0');
      assert.deepEqual(await res.json(), {error: 'unavailable'});
    }
  } finally { await h.mf.dispose(); }
});

test('challenge provider timeout fails closed without recording a vote', async () => {
  const h = await setup({TURNSTILE_SECRET_KEY: 'synthetic-test-key'}, true, async () => {
    await new Promise(resolve => setTimeout(resolve, 5500));
    return WorkerResponse.json({success: true, hostname: 'example.test', action: 'one-sound-vote', challenge_ts: new Date().toISOString()});
  });
  try {
    const res = await h.vote(await h.session(), {turnstileToken: 'synthetic-token'});
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), {error: 'unavailable'});
    assert.equal((await h.db!.prepare('SELECT COUNT(*) AS n FROM votes').first<{n: number}>())!.n, 0);
  } finally { await h.mf.dispose(); }
});
