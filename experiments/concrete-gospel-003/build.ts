/**
 * CONCRETE GOSPEL V3 · build everything into experiments/concrete-gospel-003/build/ (recreated on each run).
 *
 *   node experiments/concrete-gospel-003/build.ts              the V3 sketch (after the QA/fix pass)
 *   node experiments/concrete-gospel-003/build.ts --candidate  the composition exactly as measured before the QA/fix pass
 *
 * 1. The approved V2 backing must be on disk and bit-identical to the delivered Concrete Gospel V2 (the Cathedral
 *    Experiment's backing.ts rebuilds it with V2's own commands if it is missing, and verifies it either way).
 * 2. compose.ts writes source/ (five rack scores and the engine project).
 * 3. The rack renders the five scores in parallel, with the three Cathedral instruments registered by their opt-in hook
 *    (the rack, its registry and the frozen engines are untouched). Stems are checked for clipping, silence and NaN.
 * 4. One engine project: V2's own assets (V12 kit copies, drum one-shots, the rack 808 stem) plus the new stems and
 *    choir buses; the unchanged DaemonV12 engine validates and renders it, with per-track stems.
 * 5. Listening files: the V3 sketch and the V2 reference (its whole delivered master), matched to one integrated
 *    loudness under one true-peak ceiling (24-bit WAV and 320 kbps MP3). Stems: the engine's track stems summed into
 *    seven instrument stems (PCM16, exact, pre-master, unchanged in level). build/manifest.json records every
 *    measurement and hash.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { engineEndFrames } from '../../studio-001/rack/curves.ts';
import { REPO, V2_BUILD, V2_PROJECT_DIR, buildV2, run, verifyV2 } from '../cathedral-experiment-001/backing.ts';
import { loudness, readWav, writeWav24 } from '../cathedral-experiment-001/build.ts';
import { ASSETS, BPM, BARS, CANDIDATE, SCORES, TAIL_SECONDS, project } from './compose.ts';

export const HERE = dirname(fileURLToPath(import.meta.url));
const BUILD = join(HERE, 'build'), SOURCE = join(HERE, 'source'), RACK = join(BUILD, 'rack'), ENGINE = join(BUILD, 'engine'), OUT = join(BUILD, 'out');
const REGISTER = './experiments/cathedral-experiment-001/instruments/register.ts';
const ffmpeg = process.env.DAEMONV12_FFMPEG || 'ffmpeg', SR = 44100;
export const TARGET_LUFS = -14, MAX_TP = -1;
/** The delivered instrument stems: the engine's track stems summed (sample-exact, pre-master, unchanged in level). */
export const STEMS: [string, string[]][] = [
  ['01-kick', ['kick']], ['02-snare', ['snare']], ['03-hats-and-steel', ['hats', 'toll', 'clank']], ['04-808', ['bass808']],
  ['05-throne-volt-lead', ['volt', 'volt-room']], ['06-cathedral-engine-organ', ['great', 'swell', 'pedal']], ['07-heaven-mass-choir', ['choir-low', 'choir-mid', 'choir-high']],
];
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const ff = (args: string[]) => { const r = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', ...args], { maxBuffer: 1 << 30 }); if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ')}: ${r.stderr}`); return r; };
const mp3 = (wav: string, out: string) => ff(['-v', 'error', '-y', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '320k', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', out]);

function rackRender(id: string): Promise<number> {
  const out = join(RACK, id), t0 = Date.now();
  return new Promise((resolve, reject) => {
    const c = spawn(process.execPath, ['--import', REGISTER, 'studio-001/rack/cli.ts', 'render', join(SOURCE, `${id}.score.json`), out, '--no-mp3'], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = ''; c.stdout.on('data', d => { log += d; }); c.stderr.on('data', d => { log += d; });
    c.on('close', code => {
      if (code !== 0) return reject(new Error(`rack ${id} failed (exit ${code}):\n${log}`));
      const r = JSON.parse(readFileSync(join(out, 'render.json'), 'utf8')) as { files: { file: string; clipped: number; peak: number }[] };
      // every stem, and every rack mix the engine uses as an asset (the choir buses), must be free of clipping
      const used = Object.values(ASSETS).filter(([s]) => s === id).map(([, f]) => f);
      const clipped = r.files.filter(f => f.clipped > 0 && (f.file.startsWith('stems/') || used.includes(f.file)));
      if (clipped.length) return reject(new Error(`rack ${id}: clipped ${clipped.map(f => `${f.file} (${f.clipped})`).join(', ')}`));
      // a part with notes must not be silent (the rack's peak meter reads NaN as 0, so this also catches NaN)
      const score = JSON.parse(readFileSync(join(SOURCE, `${id}.score.json`), 'utf8')) as { parts: { id: string; notes: unknown[] }[] };
      const silent = score.parts.filter(p => p.notes.length && !(r.files.find(f => f.file === `stems/${p.id}.wav`)?.peak! > 1e-4));
      if (silent.length) return reject(new Error(`rack ${id}: silent or NaN stems: ${silent.map(p => p.id).join(', ')}`));
      console.error(`rack ${id}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      resolve((Date.now() - t0) / 1000);
    });
  });
}

function engineRender(): void {
  const dir = ENGINE, assets = join(dir, 'assets');
  rmSync(dir, { recursive: true, force: true });
  cpSync(join(V2_PROJECT_DIR, 'assets'), assets, { recursive: true });
  mkdirSync(join(assets, 'lab'), { recursive: true });
  for (const [id, [score, file]] of Object.entries(ASSETS)) copyFileSync(join(RACK, score, file), join(assets, 'lab', `${id}.wav`));
  const file = join(dir, 'concrete-gospel-v3.json');
  writeFileSync(file, JSON.stringify(project, null, 1) + '\n');
  run(['bin/daemonv12.js', 'validate', file], 'engine validate');
  const out = run(['bin/daemonv12.js', 'render', file, '--out-dir', join(dir, 'render'), '--stems', '--format', 'wav', '--json'], 'engine render');
  writeFileSync(join(dir, 'render-result.json'), out);
  const want = engineEndFrames(BARS * 4, BPM, TAIL_SECONDS), got = readWav(join(dir, 'render', 'concrete-gospel-v3.wav')).frames;
  if (got !== want) throw new Error(`engine output ${got} frames, expected ${want}`);
}

/** Raised-cosine edges: a short fade-in and a fade-out over the last 50 ms (both files end in silence already). */
function edges(data: Float64Array[], fadeIn = 0.0005, fadeOut = 0.05): Float64Array[] {
  return data.map(c => {
    const x = c.slice(), a = Math.round(fadeIn * SR), z = Math.round(fadeOut * SR);
    for (let i = 0; i < a && i < x.length; i++) x[i] = x[i]! * (0.5 - 0.5 * Math.cos(Math.PI * i / a));
    for (let i = 0; i < z && i < x.length; i++) x[x.length - 1 - i] = x[x.length - 1 - i]! * (0.5 - 0.5 * Math.cos(Math.PI * i / z));
    return x;
  });
}
const gainOf = (data: Float64Array[], db: number) => data.map(c => c.map(v => v * Math.pow(10, db / 20)));
/** PCM16 writer for the stems: each stem is a sum of the engine's PCM16 track stems at unchanged level, so every sample is
 * an exact multiple of 1/32768 and 16 bits hold it losslessly (the caller has checked that nothing reaches full scale). */
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

interface Out { id: string; label: string; source: string; seconds: number; lufsBefore: number; tpBefore: number; gainDb: number; lufs: number; tp: number; lra: number; wav: string; mp3?: string; wavSha256: string; mp3Sha256?: string }
function outputs(): { listening: Out[]; stems: { id: string; tracks: string[]; wav: string; peakDbfs: number; wavSha256: string }[] } {
  rmSync(OUT, { recursive: true, force: true }); mkdirSync(join(OUT, 'stems'), { recursive: true });
  const tmp = join(BUILD, 'tmp'); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp);
  const srcs = [
    { id: 'concrete-gospel-v3', label: 'Concrete Gospel V3: Dark to Divine (16 bars, the sketch)', source: 'build/engine/render/concrete-gospel-v3.wav', data: readWav(join(ENGINE, 'render', 'concrete-gospel-v3.wav')).data },
    { id: 'concrete-gospel-v2-reference', label: 'Concrete Gospel V2 (the approved master, all 16 bars): the A/B reference', source: 'cathedral-experiment-001/build/v2/render/concrete-gospel.wav (bit-identical to the delivered V2 master)', data: readWav(join(V2_BUILD, 'render', 'concrete-gospel.wav')).data },
  ];
  // measure, then one gain per file to the target; one common reduction if a true peak would pass the ceiling
  const measured = srcs.map(s => { const x = edges(s.data), f = join(tmp, `${s.id}.wav`); writeWav24(f, x); return { s, x, l: loudness(f) }; });
  let over = 0; for (const m of measured) over = Math.max(over, m.l.tp + (TARGET_LUFS - m.l.lufs) - MAX_TP);
  const listening: Out[] = measured.map(m => {
    const g = TARGET_LUFS - m.l.lufs - over, wav = join(OUT, `${m.s.id}.wav`), mp = join(OUT, `${m.s.id}.mp3`);
    writeWav24(wav, gainOf(m.x, g)); mp3(wav, mp);
    const l = loudness(wav);
    return { id: m.s.id, label: m.s.label, source: m.s.source, seconds: +(m.x[0]!.length / SR).toFixed(3), lufsBefore: m.l.lufs, tpBefore: m.l.tp, gainDb: +g.toFixed(2),
      lufs: l.lufs, tp: l.tp, lra: l.lra, wav: relative(HERE, wav), mp3: relative(HERE, mp), wavSha256: sha(readFileSync(wav)), mp3Sha256: sha(readFileSync(mp)) };
  });
  const S = join(ENGINE, 'render', 'concrete-gospel-v3.stems');
  const stems = STEMS.map(([id, tracks]) => {
    const parts = tracks.map(t => readWav(join(S, `${t}.wav`)).data), n = parts[0]![0]!.length;
    const sum = [0, 1].map(c => { const y = new Float64Array(n); for (const p of parts) for (let i = 0; i < n; i++) y[i] = y[i]! + p[c]![i]!; return y; });
    let pk = 0; for (const c of sum) for (const v of c) pk = Math.max(pk, Math.abs(v));
    if (pk >= 1) throw new Error(`stem ${id} would clip (peak ${pk.toFixed(3)})`);
    const wav = join(OUT, 'stems', `${id}.wav`); writeWav16(wav, sum);
    return { id, tracks, wav: relative(HERE, wav), peakDbfs: +(20 * Math.log10(Math.max(pk, 1e-12))).toFixed(2), wavSha256: sha(readFileSync(wav)) };
  });
  rmSync(tmp, { recursive: true, force: true });
  return { listening, stems };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const t0 = Date.now();
  if (!existsSync(join(V2_BUILD, 'verify.json'))) { buildV2(); writeFileSync(join(V2_BUILD, 'verify.json'), JSON.stringify(verifyV2(), null, 1) + '\n'); }
  const v2 = verifyV2(); // throws unless the backing on disk is bit-identical to the delivered V2
  for (const d of [RACK, ENGINE]) { rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); }
  run([join(HERE, 'compose.ts'), ...(CANDIDATE ? ['--candidate'] : [])], 'compose');
  const rackSeconds = await Promise.all(SCORES.map(s => rackRender(s.id)));
  engineRender();
  const { listening, stems } = outputs();
  const manifest = {
    schema: 'daemonv12.concrete-gospel-v3.build/1', stage: CANDIDATE ? 'candidate (before the QA/fix pass)' : 'final (after the QA/fix pass)', node: process.version, ffmpeg: String(ff(['-version']).stdout).split('\n')[0],
    v2Backing: { masterSha256: v2.master.sha256, identicalToDeliveredV2: v2.master.identical, stemsIdentical: Object.values(v2.stems).every(s => s.identical) },
    targets: { lufs: TARGET_LUFS, maxTruePeakDbtp: MAX_TP }, listening, stems,
    rackSeconds: Object.fromEntries(SCORES.map((s, i) => [s.id, +rackSeconds[i]!.toFixed(1)])), seconds: +((Date.now() - t0) / 1000).toFixed(1),
  };
  writeFileSync(join(BUILD, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
  if (CANDIDATE) writeFileSync(join(BUILD, 'manifest-candidate.json'), JSON.stringify(manifest, null, 1) + '\n'); // kept for the delivery's provenance
  console.log(JSON.stringify(listening.map(f => ({ id: f.id, s: f.seconds, lufsBefore: f.lufsBefore, tpBefore: f.tpBefore, gain: f.gainDb, lufs: f.lufs, tp: f.tp, lra: f.lra })), null, 1));
  console.error(`build: ${manifest.seconds} s`);
}
