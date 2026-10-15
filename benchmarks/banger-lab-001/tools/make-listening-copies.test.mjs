import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, statSync, existsSync, rmSync, symlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../../..');
const engine = resolve(process.env.BL001_ENGINE || root), cli = join(engine, 'bin/daemonv12.js');
const script = join(here, 'make-listening-copies.mjs'), checker = join(here, 'check-delivery.sh');
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const load = p => JSON.parse(readFileSync(p, 'utf8'));
const put = (p, data) => writeFileSync(p, JSON.stringify(data));
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { env, encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
  assert.ifError(result.error);
  return result;
}
function analyze(p) {
  const r = run(process.execPath, [cli, 'analyze', p, '--json']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return JSON.parse(r.stdout).analysis;
}
// Real PCM fixtures, with a quiet end for the delivery check. No source assets are edited.
function tone(p, frames, frequency, scale = 0.12) {
  const b = Buffer.alloc(44 + frames * 4);
  b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(44100, 24); b.writeUInt32LE(176400, 28); b.writeUInt16LE(4, 32);
  b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(frames * 4, 40);
  for (let f = 0; f < frames - 882; f++) {
    const x = Math.round(32767 * scale * (Math.sin(f * 2 * Math.PI * frequency / 44100) + 0.2 * Math.sin(f * 2 * Math.PI * 31 / 44100)));
    b.writeInt16LE(x, 44 + f * 4); b.writeInt16LE(x, 46 + f * 4);
  }
  writeFileSync(p, b);
}
function tree(p) {
  return Object.fromEntries(readdirSync(p).sort().flatMap(n => {
    const full = join(p, n);
    return statSync(full).isDirectory() ? Object.entries(tree(full)).map(([k, v]) => [`${n}/${k}`, v]) : [[n, hash(full)]];
  }));
}

test('real blind pools: exact length, edges, static gain, anonymity, repeatability and immutable masters', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bl001-'));
  try {
    const a = join(dir, 'secret-lead.wav'), b = join(dir, 'secret-sketch.wav');
    tone(a, 3307500, 220); tone(b, 661500, 330, 0.06);
    const originals = [hash(a), hash(b)], poolFile = join(dir, 'pool.json');
    const pool = { pool: 'hook', edgeTreatment: true, listeners: 4, entries: [
      { source: a, startFrame: 12345, frames: 661500, role: 'secret-role' }, { source: b, frames: 661500 } ] };
    put(poolFile, pool);
    const call = (out, seed = 'secret-seed', extra = []) => run(process.execPath,
      [script, '--pool', poolFile, '--engine', engine, '--out', join(dir, out), '--seed', seed, ...extra]);
    const first = call('one'), second = call('two');
    assert.equal(first.status, 0, first.stderr); assert.equal(second.status, 0, second.stderr);
    assert.equal(first.stdout, second.stdout); assert.deepEqual(tree(join(dir, 'one')), tree(join(dir, 'two')));
    const summary = JSON.parse(first.stdout), key = load(join(dir, 'one/private/blind-key.json'));
    assert.equal(summary.keySha256, hash(join(dir, 'one/private/blind-key.json')));
    assert.equal(statSync(join(dir, 'one/private')).mode & 0o777, 0o700);
    assert.equal(statSync(join(dir, 'one/private/blind-key.json')).mode & 0o777, 0o600);
    const publicText = readFileSync(join(dir, 'one/copies/listening.json'), 'utf8') + first.stdout + first.stderr;
    for (const secret of [a, b, 'secret-role', 'secret-seed', ...originals]) assert.ok(!publicText.includes(secret));
    assert.deepEqual(Object.keys(load(join(dir, 'one/copies/listening.json'))), ['ids', 'orders']);
    const openers = summary.orders.map(x => x.order[0]);
    assert.equal(new Set(openers.slice(0, 2)).size, 2);
    for (const { order } of summary.orders) assert.deepEqual([...order].sort(), [...summary.ids].sort());
    for (const e of key.entries) {
      assert.match(e.id, /^[A-Z2-9]{4}$/);
      const copy = join(dir, 'one/copies', `${e.id}.wav`), measured = analyze(copy), bytes = readFileSync(copy);
      assert.equal(bytes.length, 44 + 661500 * 4); // Plain header: no identifying chunks.
      assert.equal(bytes.subarray(36, 40).toString(), 'data');
      assert.equal(bytes.readInt16LE(44), 0); // Both hooks start at the identical fade boundary.
      assert.equal(measured.frames, 661500); assert.equal(measured.fullScaleSamples, 0);
      assert.ok(Math.abs(measured.integratedLufs - summary.targetLufs) <= 0.3); assert.ok(measured.truePeakDbfs <= -1);
      // Independent execution of the exact documented two-pass recipe.
      const excerpt = join(dir, 'edge.wav'), expected = join(dir, 'expected.wav');
      for (const f of [excerpt, expected]) rmSync(f, { force: true });
      const ff = process.env.DAEMONV12_FFMPEG || 'ffmpeg';
      const convert = (input, filter, output) => {
        const r = run(ff, ['-hide_banner', '-nostdin', '-v', 'error', '-i', input, '-map', '0:a:0', '-map_metadata', '-1',
          '-fflags', '+bitexact', '-flags:a', '+bitexact', '-af', filter, '-c:a', 'pcm_s16le', output]);
        assert.equal(r.status, 0, r.stderr);
      };
      convert(e.source, `atrim=start_sample=${e.startFrame}:end_sample=${e.startFrame + 661500},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.01,afade=t=out:st=14.99:d=0.01`, excerpt);
      convert(excerpt, `volume=${e.gainDb}dB`, expected);
      assert.equal(hash(copy), hash(expected));
    }
    assert.equal(summary.targetLufs, Math.floor(10 * Math.min(-16, ...key.entries.map(e => e.before.integratedLufs - e.before.truePeakDbfs - 1))) / 10);
    const third = call('three', 'another-seed'); assert.equal(third.status, 0, third.stderr);
    assert.notDeepEqual(JSON.parse(third.stdout).ids, summary.ids);
    const audioHashes = p => readdirSync(p).filter(x => x.endsWith('.wav')).map(x => hash(join(p, x))).sort();
    assert.deepEqual(audioHashes(join(dir, 'three/copies')), audioHashes(join(dir, 'one/copies')));
    // Full version and confirmation pools never fade or excerpt canonical masters.
    const long = join(dir, 'secret-version.wav'); tone(long, 3307500, 440);
    for (const kind of ['version', 'confirmation']) {
      put(poolFile, { pool: kind, edgeTreatment: false, listeners: 1, entries: [a, long].map(source => ({ source, frames: 3307500 })) });
      const r = call(kind); assert.equal(r.status, 0, r.stderr);
      for (const e of load(join(dir, kind, 'private/blind-key.json')).entries) assert.equal(analyze(join(dir, kind, 'copies', `${e.id}.wav`)).frames, 3307500);
    }
    put(poolFile, { pool: 'confirmation', edgeTreatment: false, listeners: 1, entries: [b, b].map((source, i) => ({ source: i ? join(dir, 'short.wav') : source, frames: 661500 })) });
    tone(join(dir, 'short.wav'), 661500, 440);
    assert.equal(call('promo-confirmation').status, 0);
    assert.deepEqual([hash(a), hash(b)], originals);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('fail closed without paths on missing, malformed, silent, short, unsafe and failed-verification inputs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bl001-negative-'));
  try {
    const a = join(dir, 'secret-a.wav'), b = join(dir, 'secret-b.wav');
    tone(a, 661500, 220); tone(b, 661500, 330);
    const poolFile = join(dir, 'pool.json'), out = join(dir, 'out');
    const valid = { pool: 'hook', edgeTreatment: true, listeners: 3, entries: [a, b].map(source => ({ source, frames: 661500 })) };
    const args = [script, '--pool', poolFile, '--engine', engine, '--out', out, '--seed', 'private-seed'];
    const rejected = (argsOverride = args) => {
      const r = run(process.execPath, argsOverride);
      assert.equal(r.status, 1); assert.equal(r.stdout, ''); assert.ok(!r.stderr.includes('secret-'));
      assert.ok(!existsSync(out)); assert.ok(!readdirSync(dir).some(x => x.startsWith('.blind-')));
    };
    rejected([script]);
    for (const p of [null, { ...valid, extra: 'no' }, { ...valid, edgeTreatment: false }, { ...valid, listeners: 0 },
      { ...valid, entries: [{ source: a, frames: 1 }, valid.entries[1]] },
      { ...valid, entries: [{ source: a, startFrame: null, frames: 661500 }, valid.entries[1]] },
      { ...valid, entries: [{ source: a, startFrame: 1, frames: 661500 }, valid.entries[1]] },
      { ...valid, entries: [{ source: dir, frames: 661500 }, valid.entries[1]] },
      { ...valid, entries: [{ source: join(dir, 'missing.wav'), frames: 661500 }, valid.entries[1]] }]) { put(poolFile, p); rejected(); }
    put(poolFile, valid);
    rejected([...args, '--unknown', 'x']);
    rejected([...args, '--ffmpeg', '/missing/ffmpeg']);
    symlinkSync(join(dir, 'absent'), out); rejected(); rmSync(out);
    tone(b, 661500, 330, 0); rejected(); // Silence has no finite loudness/headroom.
    tone(b, 661500, 330);
    const clipped = readFileSync(b); clipped.writeInt16LE(32767, 100); writeFileSync(b, clipped); rejected();
    tone(b, 661500, 330);
    // Sabotage only the gain pass while leaving genuine FFmpeg analysis intact.
    const wrapper = join(dir, 'ffmpeg.mjs');
    writeFileSync(wrapper, `#!${process.execPath}\nimport {spawnSync} from 'node:child_process';\nconst a=process.argv.slice(2);const i=a.indexOf('-af');if(i>=0&&a[i+1].startsWith('volume='))a[i+1]+=',volume=3dB';const r=spawnSync(${JSON.stringify(process.env.DAEMONV12_FFMPEG || 'ffmpeg')},a,{stdio:'inherit'});process.exit(r.status??1);\n`, { mode: 0o700 });
    rejected([...args, '--ffmpeg', wrapper]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('delivery checker rejects an unauthorized sample and clipped master against an otherwise passing fixture', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bl001-delivery-'));
  try {
    const wav = join(dir, 'fixture.wav'); tone(wav, 661500, 220);
    mkdirSync(join(dir, 'fixture.stems')); writeFileSync(join(dir, 'fixture.stems/one.wav'), readFileSync(wav));
    const paletteFile = join(here, '../approved-palette.json');
    const pal = load(paletteFile), asset = pal.packs[0].sounds[0];
    const analysis = analyze(wav);
    put(join(dir, 'fixture.analysis.json'), { master: analysis, tracks: [{ trackId: 'one', analysis }] });
    const manifest = { engine: { version: '0.7.0' }, timeline: { resultingFrames: 661500 }, wav: { frames: 661500, sha256: hash(wav) },
      samples: { tracks: [{ trackId: 'one' }], assets: [{ file: asset.file, sha256: asset.sha256 }] },
      stems: [{ wav: { file: 'fixture.stems/one.wav', sha256: hash(wav) } }],
      production: { tracks: [{ trackId: 'one', clippedSamples: 0 }], master: { clippedSamples: 0 } }, mix: { clippedSamples: 0 },
      gmRenderer: null, soundfont: null, midi: { notes: 0 } };
    const check = () => run('bash', [checker, dir, 'fixture', paletteFile, '661500']);
    const path = join(dir, 'fixture.render.json'); put(path, manifest);
    const baseline = check(); assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
    const unauthorized = structuredClone(manifest); unauthorized.samples.assets.push({ file: 'assets/unauthorized.wav', sha256: '0'.repeat(64) });
    put(path, unauthorized); const sample = check(); assert.equal(sample.status, 1); assert.match(sample.stdout, /FAIL approved palette only/);
    assert.equal(sample.stdout.split('\n').filter(x => x.startsWith('FAIL')).length, 1);
    const clipped = structuredClone(manifest); clipped.production.master.clippedSamples = 1;
    put(path, clipped); const clip = check(); assert.equal(clip.status, 1); assert.match(clip.stdout, /FAIL no clipping at any production stage/);
    assert.equal(clip.stdout.split('\n').filter(x => x.startsWith('FAIL')).length, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
