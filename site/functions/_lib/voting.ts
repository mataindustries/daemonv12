import type {D1Database, D1DatabaseSession} from '@cloudflare/workers-types';

export interface Env {
  VOTES_DB?: D1Database;
  EXPERIMENT_ID?: string;
  VOTING_OPEN?: string;
  ALLOWED_ORIGIN?: string;
  MODEL_TRACK_MAP?: string;
  VOTE_COOKIE_SECRET?: string;
  VOTER_HASH_SECRET?: string;
  RATE_LIMIT_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
}
const EXPERIMENT = 'one-sound-001';
const COOKIE = '__Host-one-sound';
const LIFE = 90 * 86400;
const tracks = ['A', 'B', 'C'] as const;
type Track = typeof tracks[number];
type Mapping = Record<Track, string>;
type Vote = {track_id: Track; request_id: string};
class Failure extends Error {
  status: number;
  constructor(status: number, code: string) { super(code); this.status = status; }
}
const fail = (status: number, code: string): never => { throw new Failure(status, code); };
const hex = (bytes: Uint8Array) => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
async function mac(secret: string, value: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(value))));
}
function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
function response(status: number, body: unknown, cookie?: string): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'CDN-Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Cookie, Origin',
  };
  if (cookie) headers['Set-Cookie'] = cookie;
  if (status === 429) headers['Retry-After'] = '600';
  return new Response(JSON.stringify(body), {status, headers});
}
function configuration(env: Env) {
  if (!env.VOTES_DB || env.EXPERIMENT_ID !== EXPERIMENT || !['true', 'false'].includes(env.VOTING_OPEN ?? '')) fail(503, 'unavailable');
  const secrets = [env.VOTE_COOKIE_SECRET, env.VOTER_HASH_SECRET, env.RATE_LIMIT_SECRET];
  if (secrets.some(s => !s || s.length < 32) || new Set(secrets).size !== 3) fail(503, 'unavailable');
  const origin = new URL(env.ALLOWED_ORIGIN ?? '');
  if (origin.origin !== env.ALLOWED_ORIGIN || (origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname))) fail(503, 'unavailable');
  const mapping = JSON.parse(env.MODEL_TRACK_MAP ?? '{}') as Mapping;
  if (!mapping || Object.keys(mapping).sort().join() !== 'A,B,C' || tracks.some(t => typeof mapping[t] !== 'string' || !mapping[t].trim() || mapping[t].length > 120)) fail(503, 'unavailable');
  return {db: env.VOTES_DB!.withSession('first-primary'), mapping, origin};
}
// CF-Connecting-IP is supplied by Cloudflare, not trusted from a frontend body.
// Coarsen before hashing: IPv4 /24 or IPv6 /56. Malformed/missing addresses fail closed.
function prefix(raw: string | null): string {
  if (!raw) return fail(503, 'unavailable');
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(raw)) {
    const parts = raw.split('.').map(Number);
    if (parts.some(n => n > 255)) return fail(503, 'unavailable');
    return parts.slice(0, 3).join('.') + '.0/24';
  }
  const normalized = new URL(`http://[${raw}]/`).hostname.slice(1, -1);
  const halves = normalized.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const parts = halves.length === 2 ? [...left, ...Array<string>(8 - left.length - right.length).fill('0'), ...right] : left;
  if (parts.length !== 8 || parts.some(p => !/^[\da-f]{1,4}$/i.test(p))) return fail(503, 'unavailable');
  return parts.slice(0, 3).map(p => parseInt(p, 16).toString(16)).join(':') + ':' + (parseInt(parts[3]!, 16) & 0xff00).toString(16) + '::/56';
}
// A bounded isolate-local rejection cache avoids SQL for known exhausted buckets.
// D1 remains the cross-isolate authority; cache eviction never grants an allowance.
const exhausted = new Map<string, number>();
async function limit(db: D1DatabaseSession, env: Env, identity: string, action: string, cap: number, now: number) {
  const window = Math.floor(now / 600);
  const key = await mac(env.RATE_LIMIT_SECRET!, `rate:${Math.floor(now / 86400)}:${identity}:${action}:${window}`);
  for (const [cached, expiry] of exhausted) if (expiry <= now) exhausted.delete(cached);
  if (exhausted.has(key)) fail(429, 'throttled');
  const remember = () => {
    if (exhausted.size >= 1024) exhausted.delete(exhausted.keys().next().value!);
    exhausted.set(key, (window + 1) * 600);
  };
  // This read keeps already-throttled traffic from executing a write statement.
  const existing = await db.prepare('SELECT attempts FROM rate_limits WHERE key = ?').bind(key).first<{attempts: number}>();
  if (existing && existing.attempts >= cap) { remember(); return fail(429, 'throttled'); }
  // The WHERE clause enforces the cap even if multiple requests pass the read.
  const row = await db.prepare('INSERT INTO rate_limits(key, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1 WHERE attempts < ? RETURNING attempts').bind(key, (window + 1) * 600, cap).first<{attempts: number}>();
  if (!row || row.attempts >= cap) remember();
  if (!row) fail(429, 'throttled');
}
async function session(request: Request, env: Env, now: number): Promise<{id: string; token: string} | null> {
  const cookies = (request.headers.get('Cookie') ?? '').split(';').map(s => s.trim()).filter(s => s.startsWith(`${COOKIE}=`));
  if (!cookies.length) return null;
  if (cookies.length !== 1) return fail(403, 'invalid_session');
  const token = cookies[0]!.slice(COOKIE.length + 1);
  const match = /^([a-f0-9]{64})\.(\d{10})\.([a-f0-9]{64})$/.exec(token);
  if (!match || Number(match[2]) <= now || Number(match[2]) > now + LIFE || !equal(match[3]!, await mac(env.VOTE_COOKIE_SECRET!, `cookie:${match[1]}.${match[2]}`))) return fail(403, 'invalid_session');
  return {id: match[1]!, token};
}
async function parseBody(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') return fail(415, 'content_type');
  const reader = request.body?.getReader();
  if (!reader) return fail(400, 'invalid_input');
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const {value, done} = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 2048) { await reader.cancel(); return fail(413, 'body_too_large'); }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; }
  try {
    const body: unknown = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(all));
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(400, 'invalid_input');
    return body as Record<string, unknown>;
  } catch { return fail(400, 'invalid_input'); }
}
async function reveal(db: D1DatabaseSession, mapping: Mapping, vote: Vote) {
  const {results: rows} = await db.prepare('SELECT track_id, count FROM vote_totals WHERE experiment_id = ?').bind(EXPERIMENT).all<{track_id: Track; count: number}>();
  if (rows.length !== 3 || tracks.some(t => !rows.some(row => row.track_id === t)) || rows.some(row => !Number.isSafeInteger(row.count) || row.count < 0)) fail(503, 'unavailable');
  const counts = {A: 0, B: 0, C: 0, total: 0};
  for (const row of rows) { counts[row.track_id] = row.count; counts.total += row.count; }
  if (!Number.isSafeInteger(counts.total) || counts[vote.track_id] < 1) fail(503, 'unavailable');
  return {experimentId: EXPERIMENT, selectedTrack: vote.track_id, reveal: mapping, results: counts};
}
export async function handle(request: Request, env: Env): Promise<Response> {
  try {
    const path = new URL(request.url).pathname;
    const action = path.slice('/api/one-sound/'.length);
    if (!['session', 'vote', 'reveal'].includes(action)) return response(404, {error: 'not_found'});
    if (request.method !== (action === 'vote' ? 'POST' : 'GET')) return response(405, {error: 'method_not_allowed'});
    const {db, mapping, origin} = configuration(env);
    if (new URL(request.url).origin !== origin.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site' || (request.headers.has('Origin') && request.headers.get('Origin') !== origin.origin) || (action === 'vote' && request.headers.get('Origin') !== origin.origin)) return fail(403, 'invalid_origin');
    const now = Math.floor(Date.now() / 1000);
    const network = prefix(request.headers.get('CF-Connecting-IP'));
    let auth = await session(request, env, now);
    if (!auth && action !== 'session') return fail(403, 'session_required');
    const fresh = !auth;
    // A closed preview neither writes D1 nor mints unlimited reusable voting
    // credentials. Existing signed sessions still have authenticated recovery.
    if (fresh && env.VOTING_OPEN === 'false') return response(200, {experimentId: EXPERIMENT, votingOpen: false, hasVoted: false, csrfToken: ''});
    if (action === 'session') await limit(db, env, network, 'session', 60, now);
    let cookie: string | undefined;
    if (!auth && action === 'session') {
      const id = hex(crypto.getRandomValues(new Uint8Array(32)));
      const payload = `${id}.${now + LIFE}`;
      auth = {id, token: `${payload}.${await mac(env.VOTE_COOKIE_SECRET!, `cookie:${payload}`)}`};
      cookie = `${COOKIE}=${auth.token}; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=${LIFE}`;
    }
    if (!auth) return fail(403, 'session_required');
    const voter = await mac(env.VOTER_HASH_SECRET!, `voter:${EXPERIMENT}:${auth.id}`);
    const csrf = await mac(env.VOTE_COOKIE_SECRET!, `csrf:${auth.token}`);
    const findVote = () => db.prepare('SELECT track_id, request_id FROM votes WHERE experiment_id = ? AND voter_hash = ?').bind(EXPERIMENT, voter).first<Vote>();
    // A newly generated identity cannot have a vote.
    if (action === 'session') return response(200, {experimentId: EXPERIMENT, votingOpen: env.VOTING_OPEN === 'true', hasVoted: fresh ? false : !!await findVote(), csrfToken: csrf}, cookie);
    const resultLimit = async () => {
      // Shared across vote/reveal and independent of client IP, so replaying a
      // voted cookie from many networks cannot multiply its result allowance.
      await limit(db, env, `voter:${voter}`, 'results', 30, now);
      await limit(db, env, network, action, 120, now);
    };
    if (action === 'reveal') {
      await resultLimit();
      const vote = await findVote();
      if (!vote) return fail(403, 'vote_required');
      return response(200, await reveal(db, mapping, vote));
    }
    const body = await parseBody(request);
    if (Object.keys(body).some(k => !['experimentId', 'trackId', 'requestId', 'csrfToken', 'turnstileToken'].includes(k)) || body.experimentId !== EXPERIMENT || !tracks.includes(body.trackId as Track) || typeof body.requestId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.requestId) || (body.turnstileToken !== undefined && typeof body.turnstileToken !== 'string')) return fail(400, 'invalid_input');
    if (typeof body.csrfToken !== 'string' || !equal(body.csrfToken, csrf)) return fail(403, 'invalid_csrf');
    await resultLimit();
    const retry = async (existing: Vote) => {
      if (existing.request_id !== body.requestId || existing.track_id !== body.trackId) return fail(409, 'already_voted');
      return response(200, await reveal(db, mapping, existing));
    };
    const existing = await findVote();
    if (existing) return await retry(existing);
    if (env.VOTING_OPEN !== 'true') return fail(503, 'voting_closed');
    if (env.TURNSTILE_SECRET_KEY) {
      if (typeof body.turnstileToken !== 'string' || !body.turnstileToken) return fail(403, 'challenge_required');
      const validation = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {method: 'POST', body: new URLSearchParams({secret: env.TURNSTILE_SECRET_KEY, response: body.turnstileToken}), signal: AbortSignal.timeout(5000)});
      if (!validation.ok) return fail(503, 'unavailable');
      const check = await validation.json() as {success?: boolean; hostname?: string; action?: string; challenge_ts?: string};
      const age = now - Date.parse(check.challenge_ts ?? '') / 1000;
      if (!check.success || check.hostname !== origin.hostname || check.action !== 'one-sound-vote' || !Number.isFinite(age) || age < -30 || age > 300) return fail(403, 'challenge_failed');
    }
    // The unique constraint, not the preceding read, is the concurrency boundary.
    const inserted = await db.prepare('INSERT INTO votes(experiment_id, voter_hash, track_id, request_id) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING').bind(EXPERIMENT, voter, body.trackId, body.requestId).run();
    const persisted = await findVote();
    if (!persisted) return fail(409, 'request_conflict');
    if (!inserted.meta.changes) return await retry(persisted);
    return response(201, await reveal(db, mapping, persisted));
  } catch (error) {
    return response(error instanceof Failure ? error.status : 503, {error: error instanceof Failure ? error.message : 'unavailable'});
  }
}
