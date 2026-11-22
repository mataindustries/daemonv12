/**
 * AFTERIMAGE//PULSE V2 · build into experiments/afterimage-pulse-002/build/ (V1's build script, adapted: name and stems).
 *
 *   node experiments/afterimage-pulse-002/build.ts              V2 (after the QA/fix pass)
 *   node experiments/afterimage-pulse-002/build.ts --candidate  the composition exactly as measured before the QA/fix pass
 *
 * 1. compose.ts writes source/ (six rack scores, the engine project, three kits, the QA map).
 * 2. The Signature Rack renders the six scores, four at a time, with the Cathedral Experiment instruments (and through
 *    them the Timbre Lab) registered by their opt-in hook. A score whose JSON is unchanged since its last render is not
 *    rendered again, so a mix-only change re-runs only the engine. Stems are checked for clipping, silence and NaN.
 * 3. Rack stems that share an engine track are summed sample for sample into one PCM16 file (overflow-checked).
 * 4. An isolated engine project (copies of those stems and of seven V12 Signature / GLASSHOUSE one-shots) is validated
 *    and rendered by the unchanged DaemonV12 engine, with aligned track stems.
 * 5. The master is matched to -14 LUFS under a -1 dBTP ceiling (gain only), written as 24-bit WAV and 320 kbps MP3.
 *    Key stems are sums of the engine's PCM16 track stems at unchanged level. build/manifest.json records everything.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { engineEndFrames } from '../../studio-001/rack/curves.ts';
import { ASSETS, BARS, BPM, CANDIDATE, KITS, SAMPLE_FILES, SCORES, TAIL_SECONDS, project } from './compose.ts';

export const HERE = dirname(fileURLToPath(import.meta.url)), REPO = resolve(HERE, '..', '..');
const BUILD = join(HERE, 'build'), SOURCE = join(HERE, 'source'), RACK = join(BUILD, 'rack'), ENGINE = join(BUILD, 'engine'), OUT = join(BUILD, 'out');
const REGISTER = './experiments/cathedral-experiment-001/instruments/register.ts';
const ffmpeg = process.env.DAEMONV12_FFMPEG || 'ffmpeg', SR = 44100, JOBS = 4;
export const TARGET_LUFS = -14, MAX_TP = -1, NAME = 'afterimage-pulse-v2';
/** Key stems: engine tracks summed (pre-master, unchanged level). */
export const STEMS: [string, string[]][] = [
  ['01-kick', ['kick']], ['02-snare-and-hats', ['snare', 'hats']], ['03-hand-percussion', ['perc']], ['04-living-bass', ['bass-sub', 'bass-mid']],
  ['05-throne-volt-lead', ['lead']], ['06-throne-volt-pad', ['pad']], ['07-afterimage-music-box', ['echo']],
  ['08-impossible-voice', ['voice']], ['09-heaven-mass-choir', ['choir-low', 'choir-high']], ['10-room', ['room']],
];
export const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
export function run(args: string[], label: string): string {
  const t0 = Date.now(), r = spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', maxBuffer: 256 << 20 });
  if (r.status !== 0) { console.error(r.stdout, r.stderr); throw new Error(`${label} failed (exit ${r.status})`); }
  console.error(`${label}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return r.stdout;
}
export const ff = (args: string[]) => { const r = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', ...args], { maxBuffer: 1 << 30 }); if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ')}: ${r.stderr}`); return r; };
const mp3 = (wav: string, out: string) => ff(['-v', 'error', '-y', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '320k', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', out]);
export function loudness(file: string): { lufs: number; tp: number; lra: number } {
  const e = String(ff(['-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr), s = e.slice(e.lastIndexOf('Summary:'));
  const g = (re: RegExp) => { const m = re.exec(s); return m ? (m[1] === '-inf' ? -Infinity : Number(m[1])) : NaN; };
  return { lufs: g(/I:\s+(-?[\d.]+|-inf) LUFS/), tp: g(/Peak:\s+(-?[\d.]+|-inf) dBFS/), lra: g(/LRA:\s+(-?[\d.]+) LU/) };
}
/** PCM16/24 WAV -> float channels. */
export function readWav(path: string): { channels: number; frames: number; data: Float64Array[] } {
  const b = readFileSync(path);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${path}: not a WAV`);
  let off = 12, channels = 0, bits = 0;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4), size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') { channels = b.readUInt16LE(off + 10); bits = b.readUInt16LE(off + 22); }
    if (id === 'data') {
      const bytes = bits / 8, frames = Math.floor(size / (bytes * channels)), data = Array.from({ length: channels }, () => new Float64Array(frames));
      for (let i = 0; i < frames; i++) for (let c = 0; c < channels; c++) {
        const o = off + 8 + (i * channels + c) * bytes;
        data[c]![i] = bits === 16 ? b.readInt16LE(o) / 32768 : bits === 24 ? b.readIntLE(o, 3) / 8388608 : (() => { throw new Error(`${path}: ${bits}-bit`); })();
      }
      return { channels, frames, data };
    }
    off += 8 + size + (size & 1);
  }
  throw new Error(`${path}: no data chunk`);
}
function header(n: number, ch: number, bytes: number): Buffer {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + n * ch * bytes, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(ch, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * ch * bytes, 28); h.writeUInt16LE(ch * bytes, 32); h.writeUInt16LE(bytes * 8, 34); h.write('data', 36); h.writeUInt32LE(n * ch * bytes, 40);
  return h;
}
/** 24-bit writer with TPDF-free rounding (deterministic). */
export function writeWav24(file: string, data: Float64Array[]): void {
  const ch = data.length, n = data[0]!.length, b = Buffer.alloc(n * ch * 3);
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) b.writeIntLE(Math.max(-8388608, Math.min(8388607, Math.round(data[c]![i]! * 8388608))), (i * ch + c) * 3, 3);
  writeFileSync(file, Buffer.concat([header(n, ch, 3), b]));
}
/** Exact PCM16 writer: every sample must already be a 16-bit value (sums of PCM16 stems at unchanged level are). */
export function writeWav16(file: string, data: Float64Array[]): void {
  const ch = data.length, n = data[0]!.length, b = Buffer.alloc(n * ch * 2);
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const v = data[c]![i]! * 32768, q = Math.round(v);
    if (Math.abs(v - q) > 1e-6) throw new Error(`${file}: sample ${i} is not a 16-bit value`);
    if (q > 32767 || q < -32768) throw new Error(`${file}: overflow at sample ${i}`);
    b.writeInt16LE(q, (i * ch + c) * 2);
  }
  writeFileSync(file, Buffer.concat([header(n, ch, 2), b]));
}
const sum = (files: string[]): Float64Array[] => {
  const parts = files.map(f => readWav(f).data), n = Math.max(...parts.map(p => p[0]!.length)), ch = Math.max(...parts.map(p => p.length));
  return Array.from({ length: ch }, (_, c) => { const y = new Float64Array(n); for (const p of parts) { const x = p[Math.min(c, p.length - 1)]!; for (let i = 0; i < x.length; i++) y[i] = y[i]! + x[i]!; } return y; });
};
const peakDb = (data: Float64Array[]) => { let pk = 0; for (const c of data) for (const v of c) pk = Math.max(pk, Math.abs(v)); return +(20 * Math.log10(Math.max(pk, 1e-12))).toFixed(2); };

/** Render one rack score, unless the same authored score was already rendered (then its stems are reused). */
function rackRender(id: string): Promise<{ id: string; seconds: number; reused: boolean }> {
  const out = join(RACK, id), src = join(SOURCE, `${id}.score.json`), t0 = Date.now();
  const authored = JSON.stringify(JSON.parse(readFileSync(src, 'utf8')), null, 2) + '\n';
  if (existsSync(join(out, 'render.json')) && existsSync(join(out, 'score.json')) && readFileSync(join(out, 'score.json'), 'utf8') === authored) return Promise.resolve({ id, seconds: 0, reused: true });
  rmSync(out, { recursive: true, force: true });
  return new Promise((res, rej) => {
    const c = spawn(process.execPath, ['--import', REGISTER, 'studio-001/rack/cli.ts', 'render', src, out, '--no-mp3'], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = ''; c.stdout.on('data', d => { log += d; }); c.stderr.on('data', d => { log += d; });
    c.on('close', code => {
      if (code !== 0) return rej(new Error(`rack ${id} failed (exit ${code}):\n${log}`));
      const r = JSON.parse(readFileSync(join(out, 'render.json'), 'utf8')) as { files: { file: string; clipped: number; peak: number }[] };
      const clipped = r.files.filter(f => f.clipped > 0 && f.file.startsWith('stems/'));
      if (clipped.length) return rej(new Error(`rack ${id}: clipped ${clipped.map(f => `${f.file} (${f.clipped})`).join(', ')}`));
      const score = JSON.parse(readFileSync(src, 'utf8')) as { parts: { id: string; notes: unknown[] }[] };
      const silent = score.parts.filter(p => p.notes.length && !(r.files.find(f => f.file === `stems/${p.id}.wav`)?.peak! > 1e-4));
      if (silent.length) return rej(new Error(`rack ${id}: silent or NaN stems: ${silent.map(p => p.id).join(', ')}`));
      const s = (Date.now() - t0) / 1000; console.error(`rack ${id}: ${s.toFixed(1)} s`); res({ id, seconds: s, reused: false });
    });
  });
}
async function pool<T>(jobs: (() => Promise<T>)[], n: number): Promise<T[]> {
  const out: T[] = new Array(jobs.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, async () => { while (next < jobs.length) { const i = next++; out[i] = await jobs[i]!(); } }));
  return out;
}

function engineRender(): Record<string, number> {
  rmSync(ENGINE, { recursive: true, force: true });
  const assets = join(ENGINE, 'assets');
  for (const d of ['rack', 'v12', 'glasshouse']) mkdirSync(join(assets, d), { recursive: true });
  for (const [dst, src] of SAMPLE_FILES) copyFileSync(join(REPO, src), join(assets, dst));
  for (const [name, kit] of Object.entries(KITS)) writeFileSync(join(assets, `${name}-kit.json`), JSON.stringify(kit, null, 2) + '\n');
  const groups: Record<string, number> = {};
  for (const [id, files] of Object.entries(ASSETS)) {
    const data = sum(files.map(([score, f]) => join(RACK, score, f)));
    writeWav16(join(assets, 'rack', `${id}.wav`), data);
    groups[id] = peakDb(data);
  }
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
  return groups;
}

function edges(data: Float64Array[], fadeIn = 0.0005, fadeOut = 0.05): Float64Array[] {
  return data.map(c => {
    const x = c.slice(), a = Math.round(fadeIn * SR), z = Math.round(fadeOut * SR);
    for (let i = 0; i < a && i < x.length; i++) x[i] = x[i]! * (0.5 - 0.5 * Math.cos(Math.PI * i / a));
    for (let i = 0; i < z && i < x.length; i++) x[x.length - 1 - i] = x[x.length - 1 - i]! * (0.5 - 0.5 * Math.cos(Math.PI * i / z));
    return x;
  });
}

function outputs() {
  rmSync(OUT, { recursive: true, force: true }); mkdirSync(join(OUT, 'stems'), { recursive: true });
  const x = edges(readWav(join(ENGINE, 'render', `${NAME}.wav`)).data), tmp = join(OUT, 'probe.wav');
  writeWav24(tmp, x); const l0 = loudness(tmp); rmSync(tmp);
  const g = Math.min(TARGET_LUFS - l0.lufs, MAX_TP - 0.2 - l0.tp), wav = join(OUT, `${NAME}.wav`), mp = join(OUT, `${NAME}.mp3`);
  writeWav24(wav, x.map(c => c.map(v => v * Math.pow(10, g / 20)))); mp3(wav, mp);
  const l = loudness(wav), lm = loudness(mp);
  const record = { file: relative(HERE, wav), mp3: relative(HERE, mp), seconds: +(x[0]!.length / SR).toFixed(3), masterLufs: l0.lufs, masterTp: l0.tp, gainDb: +g.toFixed(2),
    lufs: l.lufs, tp: l.tp, lra: l.lra, mp3Lufs: lm.lufs, mp3Tp: lm.tp, wavSha256: sha(readFileSync(wav)), mp3Sha256: sha(readFileSync(mp)) };
  const SD = join(ENGINE, 'render', `${NAME}.stems`);
  const stems = STEMS.map(([id, tracks]) => {
    const data = sum(tracks.map(t => join(SD, `${t}.wav`))), f = join(OUT, 'stems', `${id}.wav`);
    writeWav16(f, data);
    return { id, tracks, wav: relative(HERE, f), peakDbfs: peakDb(data), wavSha256: sha(readFileSync(f)) };
  });
  return { record, stems };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const t0 = Date.now();
  mkdirSync(RACK, { recursive: true });
  run([join(HERE, 'compose.ts'), ...(CANDIDATE ? ['--candidate'] : [])], 'compose');
  const racks = await pool(SCORES.map(s => () => rackRender(s.id)), JOBS);
  const groups = engineRender();
  const { record, stems } = outputs();
  const manifest = {
    schema: 'daemonv12.afterimage-pulse-v2.build/1', stage: CANDIDATE ? 'candidate (before the QA/fix pass)' : 'final (after the QA/fix pass)',
    node: process.version, ffmpeg: String(ff(['-version']).stdout).split('\n')[0],
    targets: { lufs: TARGET_LUFS, maxTruePeakDbtp: MAX_TP }, record, stems, rack: racks, rackGroupsPeakDbfs: groups, seconds: +((Date.now() - t0) / 1000).toFixed(1),
  };
  writeFileSync(join(BUILD, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
  if (CANDIDATE) writeFileSync(join(BUILD, 'manifest-candidate.json'), JSON.stringify(manifest, null, 1) + '\n');
  console.log(JSON.stringify({ record, rack: racks, groups }, null, 1));
  console.error(`build: ${manifest.seconds} s`);
}
