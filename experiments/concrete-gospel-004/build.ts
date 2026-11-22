/**
 * CONCRETE GOSPEL · FULL-LENGTH EDITION · build into experiments/concrete-gospel-004/build/.
 *
 *   node experiments/concrete-gospel-004/build.ts              the record (after the QA/fix pass)
 *   node experiments/concrete-gospel-004/build.ts --candidate  the composition exactly as measured before the QA/fix pass
 *
 * 1. The approved V2 backing must be on disk and bit-identical to the delivered Concrete Gospel V2 (the Cathedral
 *    Experiment's backing.ts rebuilds it with V2's own commands if it is missing, and verifies it either way). Its kits,
 *    one-shots and V12 samples are the drum sounds of this record.
 * 2. compose.ts writes source/ (eight rack scores, the engine project, a map for the QA).
 * 3. The rack renders the eight scores, four at a time, with the Cathedral instruments registered by their opt-in hook.
 *    A score whose JSON is unchanged since its last render is not rendered again (the rack keeps the authored score next
 *    to its stems), so a mix-only fix re-runs only the engine. Stems are checked for clipping, silence and NaN.
 * 4. One engine project: V2's assets plus the new stems; the unchanged DaemonV12 engine validates and renders it.
 * 5. The record: matched to -14 LUFS under -1 dBTP, 24-bit WAV and 320 kbps MP3. Stems: the engine's track stems summed
 *    into seven instrument stems (PCM16, exact, pre-master). build/manifest.json records every measurement and hash.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { engineEndFrames } from '../../studio-001/rack/curves.ts';
import { REPO, V2_BUILD, V2_PROJECT_DIR, buildV2, run, verifyV2 } from '../cathedral-experiment-001/backing.ts';
import { loudness, readWav, writeWav24 } from '../cathedral-experiment-001/build.ts';
import { ASSETS, BARS, BPM, CANDIDATE, SCORES, TAIL_SECONDS, project } from './compose.ts';

export const HERE = dirname(fileURLToPath(import.meta.url));
const BUILD = join(HERE, 'build'), SOURCE = join(HERE, 'source'), RACK = join(BUILD, 'rack'), ENGINE = join(BUILD, 'engine'), OUT = join(BUILD, 'out');
const REGISTER = './experiments/cathedral-experiment-001/instruments/register.ts';
const ffmpeg = process.env.DAEMONV12_FFMPEG || 'ffmpeg', SR = 44100, JOBS = 4;
export const TARGET_LUFS = -14, MAX_TP = -1, NAME = 'concrete-gospel-full-length';
export const STEMS: [string, string[]][] = [
  ['01-kick', ['kick']], ['02-snare', ['snare']], ['03-hats-and-steel', ['hats', 'toll', 'clank']], ['04-808', ['bass808']],
  ['05-throne-volt-lead', ['volt', 'volt-room']], ['06-cathedral-engine-organ', ['great', 'swell', 'pedal']], ['07-heaven-mass-choir', ['choir-low', 'choir-mid', 'choir-high']],
];
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const ff = (args: string[]) => { const r = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', ...args], { maxBuffer: 1 << 30 }); if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ')}: ${r.stderr}`); return r; };
const mp3 = (wav: string, out: string) => ff(['-v', 'error', '-y', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '320k', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', out]);

/** Render one rack score, unless the same authored score was already rendered (then its stems are reused). */
function rackRender(id: string): Promise<{ id: string; seconds: number; reused: boolean }> {
  const out = join(RACK, id), src = join(SOURCE, `${id}.score.json`), t0 = Date.now();
  const authored = JSON.stringify(JSON.parse(readFileSync(src, 'utf8')), null, 2) + '\n';
  if (existsSync(join(out, 'render.json')) && existsSync(join(out, 'score.json')) && readFileSync(join(out, 'score.json'), 'utf8') === authored) return Promise.resolve({ id, seconds: 0, reused: true });
  rmSync(out, { recursive: true, force: true });
  return new Promise((resolve, reject) => {
    const c = spawn(process.execPath, ['--import', REGISTER, 'studio-001/rack/cli.ts', 'render', src, out, '--no-mp3'], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = ''; c.stdout.on('data', d => { log += d; }); c.stderr.on('data', d => { log += d; });
    c.on('close', code => {
      if (code !== 0) return reject(new Error(`rack ${id} failed (exit ${code}):\n${log}`));
      const r = JSON.parse(readFileSync(join(out, 'render.json'), 'utf8')) as { files: { file: string; clipped: number; peak: number }[] };
      const used = Object.values(ASSETS).filter(([s]) => s === id).map(([, f]) => f);
      const clipped = r.files.filter(f => f.clipped > 0 && (f.file.startsWith('stems/') || used.includes(f.file)));
      if (clipped.length) return reject(new Error(`rack ${id}: clipped ${clipped.map(f => `${f.file} (${f.clipped})`).join(', ')}`));
      const score = JSON.parse(readFileSync(src, 'utf8')) as { parts: { id: string; notes: unknown[] }[] };
      const silent = score.parts.filter(p => p.notes.length && !(r.files.find(f => f.file === `stems/${p.id}.wav`)?.peak! > 1e-4));
      if (silent.length) return reject(new Error(`rack ${id}: silent or NaN stems: ${silent.map(p => p.id).join(', ')}`));
      const s = (Date.now() - t0) / 1000; console.error(`rack ${id}: ${s.toFixed(1)} s`); resolve({ id, seconds: s, reused: false });
    });
  });
}
async function pool<T>(jobs: (() => Promise<T>)[], n: number): Promise<T[]> {
  const out: T[] = new Array(jobs.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, async () => { while (next < jobs.length) { const i = next++; out[i] = await jobs[i]!(); } }));
  return out;
}

function engineRender(): void {
  const assets = join(ENGINE, 'assets');
  rmSync(ENGINE, { recursive: true, force: true });
  cpSync(join(V2_PROJECT_DIR, 'assets'), assets, { recursive: true });
  mkdirSync(join(assets, 'lab'), { recursive: true });
  for (const [id, [score, file]] of Object.entries(ASSETS)) copyFileSync(join(RACK, score, file), join(assets, 'lab', `${id}.wav`));
  const file = join(ENGINE, `${NAME}.json`);
  writeFileSync(file, JSON.stringify(project, null, 1) + '\n');
  run(['bin/daemonv12.js', 'validate', file], 'engine validate');
  const out = run(['bin/daemonv12.js', 'render', file, '--out-dir', join(ENGINE, 'render'), '--stems', '--format', 'wav', '--json'], 'engine render');
  writeFileSync(join(ENGINE, 'render-result.json'), out);
  const want = engineEndFrames(BARS * 4, BPM, TAIL_SECONDS), got = readWav(join(ENGINE, 'render', `${NAME}.wav`)).frames;
  if (got !== want) throw new Error(`engine output ${got} frames, expected ${want}`);
  const prod = JSON.parse(readFileSync(join(ENGINE, 'render', `${NAME}.render.json`), 'utf8')).production as { tracks: { trackId: string; clippedSamples: number }[]; master: { clippedSamples: number } };
  const clipped = prod.tracks.filter(t => t.clippedSamples > 0).map(t => `${t.trackId} (${t.clippedSamples})`);
  if (prod.master.clippedSamples > 0) clipped.push(`master (${prod.master.clippedSamples})`);
  if (clipped.length) console.error(`WARNING engine clipping: ${clipped.join(', ')}`);
}

function edges(data: Float64Array[], fadeIn = 0.0005, fadeOut = 0.05): Float64Array[] {
  return data.map(c => {
    const x = c.slice(), a = Math.round(fadeIn * SR), z = Math.round(fadeOut * SR);
    for (let i = 0; i < a && i < x.length; i++) x[i] = x[i]! * (0.5 - 0.5 * Math.cos(Math.PI * i / a));
    for (let i = 0; i < z && i < x.length; i++) x[x.length - 1 - i] = x[x.length - 1 - i]! * (0.5 - 0.5 * Math.cos(Math.PI * i / z));
    return x;
  });
}
/** PCM16 writer for the stems: sums of the engine's PCM16 track stems at unchanged level are exact multiples of 1/32768. */
function writeWav16(file: string, data: Float64Array[]): void {
  const ch = data.length, n = data[0]!.length, b = Buffer.alloc(44 + n * ch * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * ch * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * ch * 2, 28); b.writeUInt16LE(ch * 2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * ch * 2, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const v = data[c]![i]! * 32768, q = Math.round(v);
    if (Math.abs(v - q) > 1e-6) throw new Error(`${file}: sample ${i} is not a 16-bit value`);
    b.writeInt16LE(Math.max(-32768, Math.min(32767, q)), 44 + (i * ch + c) * 2);
  }
  writeFileSync(file, b);
}

function outputs() {
  rmSync(OUT, { recursive: true, force: true }); mkdirSync(join(OUT, 'stems'), { recursive: true });
  const x = edges(readWav(join(ENGINE, 'render', `${NAME}.wav`)).data), tmp = join(OUT, 'probe.wav');
  writeWav24(tmp, x); const l0 = loudness(tmp); rmSync(tmp);
  const g = Math.min(TARGET_LUFS - l0.lufs, MAX_TP - l0.tp), wav = join(OUT, `${NAME}.wav`), mp = join(OUT, `${NAME}.mp3`);
  writeWav24(wav, x.map(c => c.map(v => v * Math.pow(10, g / 20)))); mp3(wav, mp);
  const l = loudness(wav), lm = loudness(mp);
  const record = { file: relative(HERE, wav), mp3: relative(HERE, mp), seconds: +(x[0]!.length / SR).toFixed(3), masterLufs: l0.lufs, masterTp: l0.tp, gainDb: +g.toFixed(2), lufs: l.lufs, tp: l.tp, lra: l.lra, mp3Lufs: lm.lufs, mp3Tp: lm.tp, wavSha256: sha(readFileSync(wav)), mp3Sha256: sha(readFileSync(mp)) };
  const S = join(ENGINE, 'render', `${NAME}.stems`);
  const stems = STEMS.map(([id, tracks]) => {
    const parts = tracks.map(t => readWav(join(S, `${t}.wav`)).data), n = parts[0]![0]!.length;
    const sum = [0, 1].map(c => { const y = new Float64Array(n); for (const p of parts) for (let i = 0; i < n; i++) y[i] = y[i]! + p[c]![i]!; return y; });
    let pk = 0; for (const c of sum) for (const v of c) pk = Math.max(pk, Math.abs(v));
    if (pk >= 1) throw new Error(`stem ${id} would clip (peak ${pk.toFixed(3)})`);
    const f = join(OUT, 'stems', `${id}.wav`); writeWav16(f, sum);
    return { id, tracks, wav: relative(HERE, f), peakDbfs: +(20 * Math.log10(Math.max(pk, 1e-12))).toFixed(2), wavSha256: sha(readFileSync(f)) };
  });
  return { record, stems };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const t0 = Date.now();
  if (!existsSync(join(V2_BUILD, 'verify.json'))) { buildV2(); writeFileSync(join(V2_BUILD, 'verify.json'), JSON.stringify(verifyV2(), null, 1) + '\n'); }
  const v2 = verifyV2();
  mkdirSync(RACK, { recursive: true });
  run([join(HERE, 'compose.ts'), ...(CANDIDATE ? ['--candidate'] : [])], 'compose');
  const racks = await pool(SCORES.map(s => () => rackRender(s.id)), JOBS);
  engineRender();
  const { record, stems } = outputs();
  const manifest = {
    schema: 'daemonv12.concrete-gospel-full-length.build/1', stage: CANDIDATE ? 'candidate (before the QA/fix pass)' : 'final (after the QA/fix pass)', node: process.version, ffmpeg: String(ff(['-version']).stdout).split('\n')[0],
    v2Backing: { masterSha256: v2.master.sha256, identicalToDeliveredV2: v2.master.identical, stemsIdentical: Object.values(v2.stems).every(s => s.identical) },
    targets: { lufs: TARGET_LUFS, maxTruePeakDbtp: MAX_TP }, record, stems, rack: racks, seconds: +((Date.now() - t0) / 1000).toFixed(1),
  };
  writeFileSync(join(BUILD, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
  if (CANDIDATE) writeFileSync(join(BUILD, 'manifest-candidate.json'), JSON.stringify(manifest, null, 1) + '\n');
  console.log(JSON.stringify({ record, rack: racks }, null, 1));
  console.error(`build: ${manifest.seconds} s`);
}
