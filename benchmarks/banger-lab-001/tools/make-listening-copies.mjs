#!/usr/bin/env node
// Dependency-free organizer utility. Never forward child output or source errors.
import { readFileSync, writeFileSync, realpathSync, statSync, existsSync, mkdirSync,
  mkdtempSync, rmSync, renameSync, lstatSync } from 'node:fs';
import { resolve, dirname, join, basename, delimiter } from 'node:path';
import { createHash, createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

const fail = () => { throw new Error('validation failed'); };
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const save = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
const keys = (value, allowed) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) fail();
};
function file(path) {
  if (typeof path !== 'string' || !path || path.includes('\0')) fail();
  const p = realpathSync(path);
  if (!statSync(p).isFile()) fail();
  return p;
}
function executable(command) {
  const found = command.includes('/') ? command : (process.env.PATH || '').split(delimiter)
    .map(p => join(p, command)).find(p => existsSync(p));
  return file(found);
}
function run(command, args, cwd, env) {
  const r = spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  if (r.error || r.status !== 0) fail();
  return r.stdout;
}
// Domain-separated HMAC stream, rejection sampling and Fisher-Yates: no Math.random.
function random(seed, domain) {
  let counter = 0;
  return n => {
    const limit = Math.floor(0x100000000 / n) * n;
    let v;
    do { v = createHmac('sha256', seed).update(`${domain}:${counter++}`).digest().readUInt32BE(0); } while (v >= limit);
    return v % n;
  };
}
function shuffled(items, next) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = next(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

let stage;
try {
  const { values: v } = parseArgs({ strict: true, options: Object.fromEntries(
    ['pool', 'engine', 'out', 'seed', 'ffmpeg'].map(k => [k, { type: 'string' }])) });
  if (['pool', 'engine', 'out', 'seed'].some(k => !v[k]?.trim())) fail();
  const poolFile = file(resolve(v.pool)), poolHash = sha(poolFile), pool = json(poolFile);
  keys(pool, ['pool', 'edgeTreatment', 'listeners', 'entries']);
  if (!['hook', 'version', 'confirmation'].includes(pool.pool) || typeof pool.edgeTreatment !== 'boolean' ||
      pool.edgeTreatment !== (pool.pool === 'hook') || !Number.isSafeInteger(pool.listeners) || pool.listeners < 1 || pool.listeners > 1000 ||
      !Array.isArray(pool.entries) || pool.entries.length < 2 || pool.entries.length > 100) fail();
  const entries = pool.entries.map(e => {
    keys(e, ['source', 'startFrame', 'frames', 'role']);
    if (typeof e.source !== 'string' || (e.role !== undefined && typeof e.role !== 'string')) fail();
    const startFrame = e.startFrame === undefined ? 0 : e.startFrame;
    if (!Number.isSafeInteger(startFrame) || startFrame < 0 || ![661500, 3307500].includes(e.frames) ||
        (pool.pool === 'hook' && e.frames !== 661500) || (pool.pool === 'version' && e.frames !== 3307500) ||
        (!pool.edgeTreatment && startFrame !== 0)) fail();
    const source = file(resolve(dirname(poolFile), e.source));
    return { source, startFrame, frames: e.frames, role: e.role ?? '', sourceSha256: sha(source) };
  });
  if (entries.some(e => e.frames !== entries[0].frames) || new Set(entries.map(e => `${e.source}:${e.startFrame}`)).size !== entries.length) fail();
  const engine = realpathSync(resolve(v.engine)), cli = file(join(engine, 'bin/daemonv12.js'));
  const ffmpeg = executable(v.ffmpeg || process.env.DAEMONV12_FFMPEG || 'ffmpeg');
  const env = { ...process.env, DAEMONV12_FFMPEG: ffmpeg };
  if (run(process.execPath, [cli, '--version'], engine, env).trim() !== 'daemonv12 0.7.0') fail();
  const toolchain = { node: process.version, nodeSha256: sha(process.execPath),
    ffmpeg: run(ffmpeg, ['-version'], engine, env).split('\n')[0], ffmpegSha256: sha(ffmpeg), engineCliSha256: sha(cli) };
  const out = join(realpathSync(dirname(resolve(v.out))), basename(resolve(v.out)));
  try { lstatSync(out); fail(); } catch (error) { if (error.code !== 'ENOENT') throw error; } // Also reject dangling symlinks.
  stage = mkdtempSync(join(dirname(out), '.blind-'));
  mkdirSync(join(stage, 'private'), { mode: 0o700 });
  mkdirSync(join(stage, 'copies'), { mode: 0o700 });
  const work = join(stage, 'private', 'work');
  mkdirSync(work, { mode: 0o700 });
  const analyze = path => {
    const r = JSON.parse(run(process.execPath, [cli, 'analyze', path, '--json'], engine, env)), a = r.analysis;
    if (!r.ok || !a || !Number.isFinite(a.integratedLufs) || !Number.isFinite(a.truePeakDbfs) ||
        a.sampleRate !== 44100 || a.channels !== 2 || a.bitsPerSample !== 16) fail();
    return a;
  };
  const clean = a => a.fullScaleSamples === 0 && a.clipping === false;
  const convert = (input, filter, output) => run(ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', '-i', input,
    '-map', '0:a:0', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact',
    '-af', filter, '-c:a', 'pcm_s16le', output], engine, env);
  const next = random(v.seed, 'ids'), alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', used = new Set();
  for (const e of entries) {
    do { e.id = Array.from({ length: 4 }, () => alphabet[next(alphabet.length)]).join(''); } while (used.has(e.id));
    used.add(e.id);
  }
  // Write and process in anonymous order, including directory insertion order.
  entries.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  for (const e of entries) {
    const original = analyze(e.source);
    if (!clean(original) || e.startFrame + e.frames > original.frames || (!pool.edgeTreatment && original.frames !== e.frames)) fail();
    e.input = e.source;
    if (pool.edgeTreatment) {
      e.input = join(work, `${e.id}.wav`);
      convert(e.source, `atrim=start_sample=${e.startFrame}:end_sample=${e.startFrame + e.frames},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.01,afade=t=out:st=14.99:d=0.01`, e.input);
    }
    e.before = analyze(e.input);
    if (!clean(e.before) || e.before.frames !== e.frames) fail();
  }
  let target = Math.floor(10 * Math.min(-16, ...entries.map(e => e.before.integratedLufs - e.before.truePeakDbfs - 1))) / 10;
  let verified = false;
  // RULES §6: lower the entire pool by 0.5 LU and redo on verification failure.
  for (let attempt = 0; attempt < 4 && !verified; attempt++, target -= verified ? 0 : 0.5) {
    if (!Number.isFinite(target) || target < -70) fail(); // Below the loudness gate is not a measurable target.
    verified = true;
    for (const e of entries) {
      const dest = join(stage, 'copies', `${e.id}.wav`);
      rmSync(dest, { force: true });
      e.gainDb = target - e.before.integratedLufs;
      convert(e.input, `volume=${e.gainDb}dB`, dest);
      e.after = analyze(dest);
      if (!clean(e.after) || e.after.frames !== e.frames || Math.abs(e.after.integratedLufs - target) > 0.3 || e.after.truePeakDbfs > -1) verified = false;
      // Check repeatability of every encoded WAV before publishing it.
      const repeat = join(work, `${e.id}-repeat.wav`);
      rmSync(repeat, { force: true });
      convert(e.input, `volume=${e.gainDb}dB`, repeat);
      e.copySha256 = sha(dest);
      if (sha(repeat) !== e.copySha256) fail();
    }
  }
  if (!verified || sha(poolFile) !== poolHash || entries.some(e => sha(e.source) !== e.sourceSha256)) fail();
  const ids = entries.map(e => e.id), starts = shuffled(ids, random(v.seed, 'starts'));
  const orders = Array.from({ length: pool.listeners }, (_, i) => {
    const order = shuffled(ids, random(v.seed, `listener-${i + 1}`));
    // For panels >=3, rotate openers across a shuffled cycle (as many listeners as available).
    if (pool.listeners >= 3) { const first = starts[i % starts.length]; order.splice(order.indexOf(first), 1); order.unshift(first); }
    return { listener: i + 1, order };
  });
  save(join(stage, 'copies', 'listening.json'), { ids, orders });
  const key = join(stage, 'private', 'blind-key.json');
  save(key, { seed: v.seed, pool: pool.pool, edgeTreatment: pool.edgeTreatment, poolSha256: poolHash, targetLufs: target, toolchain,
    entries: entries.map(({ input, ...e }) => e) });
  rmSync(work, { recursive: true });
  const keySha256 = sha(key);
  renameSync(stage, out);
  stage = undefined;
  process.stdout.write(JSON.stringify({ targetLufs: target, ids, orders, keySha256 }, null, 2) + '\n');
} catch {
  if (stage) rmSync(stage, { recursive: true, force: true });
  process.stderr.write('Blind-copy preparation failed; no bundle published. Check inputs, paths, toolchain, headroom and verification.\n');
  process.exitCode = 1;
}
