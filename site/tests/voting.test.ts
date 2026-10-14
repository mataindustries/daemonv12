import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import ts from 'typescript';
import {Miniflare, Response as WorkerResponse} from 'miniflare';
const source = readFileSync(new URL('../functions/_lib/voting.ts', import.meta.url), 'utf8');
const script = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText + '\nexport default {fetch: handle};';
const bindings: Record<string, string> = {
  EXPERIMENT_ID: 'one-sound-001', VOTING_OPEN: 'true', ALLOWED_ORIGIN: 'https://example.test',
  MODEL_TRACK_MAP: JSON.stringify({A: 'Synthetic Alpha', B: 'Synthetic Beta', C: 'Synthetic Gamma'}),
  VOTE_COOKIE_SECRET: 'cookie-test-'.repeat(4), VOTER_HASH_SECRET: 'voter-test-'.repeat(4), RATE_LIMIT_SECRET: 'rate-test-'.repeat(4),
};
async function setup(overrides: Record<string, string> = {}, database = true, provider?: () => WorkerResponse) {
  const mf = new Miniflare({outboundService: provider, modules: true, script, compatibilityDate: '2026-07-30', bindings: {...bindings, ...overrides}, d1Databases: database ? ['VOTES_DB'] : []});
  const db = database ? await mf.getD1Database('VOTES_DB') : null;
  if (db) {
    const sql = readFileSync(new URL('../migrations/0001_one_sound.sql', import.meta.url), 'utf8');
    for (const statement of sql.replace(/--[^\n]*/g, '').split(';').filter(s => s.trim())) await db.prepare(statement).run();
  }
  const request = async (path: string, init: {method?: string; headers?: Record<string, string>; body?: string} = {}) => {
    const headers = new Headers(init.headers);
    if (!headers.has('CF-Connecting-IP')) headers.set('CF-Connecting-IP', '192.0.2.1');
    const res = await mf.dispatchFetch(`https://example.test/api/one-sound/${path}`, {...init, headers: Object.fromEntries(headers)});
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
  return {mf, db, request, session, vote};
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
  const closed = await setup({VOTING_OPEN: 'false'});
  try {
    const s = await closed.session();
    assert.equal((await closed.vote(s)).status, 503);
    await closed.db!.prepare('DROP TABLE votes').run();
    assert.equal((await closed.request('session')).status, 503);
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
