/**
 * THE CATHEDRAL EXPERIMENT · build everything into experiments/cathedral-experiment-001/build/ (recreated per stage).
 *
 *   node experiments/cathedral-experiment-001/build.ts            V2 check, rack renders, engine renders, listening files
 *   node experiments/cathedral-experiment-001/build.ts --rebuild-v2   also rebuild and re-verify the V2 backing first
 *   node experiments/cathedral-experiment-001/build.ts --pre-qa      the candidate as measured before the QA/fix pass
 *
 * 1. The approved V2 backing is rebuilt (backing.ts) unless build/v2 already holds a verified, bit-identical rebuild.
 * 2. compose.ts writes source/ (rack scores, engine projects).
 * 3. The rack renders every score with the new instruments registered by instruments/register.ts (opt-in hook; the
 *    rack and the frozen engines are untouched).
 * 4. Each audition becomes an isolated engine project: V2's own assets (V12 kit copies, drum one-shots, the rack 808
 *    stem) plus the new instrument stems; the unchanged DaemonV12 engine validates and renders it.
 * 5. Listening files: each audition is cut at engine-exact frames (bars 5-16, or 1-12 for the choir); the V2 reference
 *    is the same bars of V2's own master. All four are matched to one integrated loudness (EBU R128) under one
 *    true-peak ceiling, so no version wins by level. The dry examples are matched to their own, lower, target.
 *    Lossless 24-bit WAV and 320 kbps MP3 for each; build/manifest.json records every measurement and hash.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beatFrame, engineEndFrames } from '../../studio-001/rack/curves.ts';
import { HERE, REPO, V2_BUILD, V2_PROJECT_DIR, buildV2, run, verifyV2 } from './backing.ts';
import { AUDITIONS, BPM, DRY, PRE_QA } from './compose.ts';

const BUILD = join(HERE, 'build'), SOURCE = join(HERE, 'source'), RACK = join(BUILD, 'rack'), ENGINE = join(BUILD, 'engine'), LISTEN = join(BUILD, 'listen');
const REGISTER = './experiments/cathedral-experiment-001/instruments/register.ts';
const ffmpeg = process.env.DAEMONV12_FFMPEG || 'ffmpeg', SR = 44100;
export const TARGET_LUFS = -14, DRY_LUFS = -16, MAX_TP = -1;
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const ff = (args: string[]) => { const r = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', ...args], { maxBuffer: 1 << 30 }); if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ')}: ${r.stderr}`); return r; };

// ------------------------------------------------------------------ WAV I/O (PCM16/24 in, PCM24 or float out)
export function readWav(file: string): { ch: number; frames: number; data: Float64Array[] } {
  const b = readFileSync(file);
  let off = 12, fmt: { ch: number; bits: number; tag: number } | undefined, dataOff = -1, dataLen = 0;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4), len = b.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { tag: b.readUInt16LE(off + 8), ch: b.readUInt16LE(off + 10), bits: b.readUInt16LE(off + 22) };
    if (id === 'data') { dataOff = off + 8; dataLen = len; break; }
    off += 8 + len + (len & 1);
  }
  if (!fmt || dataOff < 0) throw new Error(`${file}: not a WAV`);
  const bps = fmt.bits / 8, frames = Math.floor(dataLen / (bps * fmt.ch)), data = Array.from({ length: fmt.ch }, () => new Float64Array(frames));
  for (let i = 0; i < frames; i++) for (let c = 0; c < fmt.ch; c++) {
    const p = dataOff + (i * fmt.ch + c) * bps;
    data[c]![i] = fmt.tag === 3 ? (bps === 4 ? b.readFloatLE(p) : b.readDoubleLE(p)) : bps === 2 ? b.readInt16LE(p) / 32768 : bps === 3 ? b.readIntLE(p, 3) / 8388608 : b.readInt32LE(p) / 2147483648;
  }
  return { ch: fmt.ch, frames, data };
}
export function writeWav24(file: string, data: Float64Array[]): void {
  const ch = data.length, n = data[0]!.length, b = Buffer.alloc(44 + n * ch * 3);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * ch * 3, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * ch * 3, 28); b.writeUInt16LE(ch * 3, 32); b.writeUInt16LE(24, 34); b.write('data', 36); b.writeUInt32LE(n * ch * 3, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) b.writeIntLE(Math.max(-8388608, Math.min(8388607, Math.round(data[c]![i]! * 8388608))), 44 + (i * ch + c) * 3, 3);
  writeFileSync(file, b);
}
export function loudness(file: string): { lufs: number; tp: number; lra: number } {
  const e = String(ff(['-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr), s = e.slice(e.lastIndexOf('Summary:'));
  const g = (re: RegExp) => { const m = re.exec(s); return m ? (m[1] === '-inf' ? -Infinity : Number(m[1])) : NaN; };
  return { lufs: g(/I:\s+(-?[\d.]+|-inf) LUFS/), tp: g(/Peak:\s+(-?[\d.]+|-inf) dBFS/), lra: g(/LRA:\s+(-?[\d.]+) LU/) };
}
const mp3 = (wav: string, out: string) => ff(['-v', 'error', '-y', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '320k', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', out]);
/** Cut [from, to) frames, raised-cosine edges (fade-in at a mid-song cut, fade-out over the last frames). */
function cut(data: Float64Array[], from: number, to: number, fadeIn = 0.005, fadeOut = 0.05): Float64Array[] {
  return data.map(c => {
    const x = c.slice(from, Math.min(to, c.length)), a = Math.round(fadeIn * SR), z = Math.round(fadeOut * SR);
    for (let i = 0; i < a && i < x.length; i++) x[i] = x[i]! * (0.5 - 0.5 * Math.cos(Math.PI * i / a));
    for (let i = 0; i < z && i < x.length; i++) x[x.length - 1 - i] = x[x.length - 1 - i]! * (0.5 - 0.5 * Math.cos(Math.PI * i / z));
    return x;
  });
}
const gainOf = (data: Float64Array[], db: number) => data.map(c => c.map(v => v * Math.pow(10, db / 20)));

// ------------------------------------------------------------------ stages
function composeSources() {
  run([join(HERE, 'compose.ts')], 'compose', PRE_QA ? { CATHEDRAL_PRE_QA: '1' } : {});
}
function rackRender(id: string) {
  const out = join(RACK, id);
  rmSync(out, { recursive: true, force: true });
  run(['--import', REGISTER, 'studio-001/rack/cli.ts', 'render', join(SOURCE, `${id}.score.json`), out, '--no-mp3'], `rack ${id}`);
  const r = JSON.parse(readFileSync(join(out, 'render.json'), 'utf8')) as { files: { file: string; clipped: number; peak: number }[] };
  const clipped = r.files.filter(f => f.clipped > 0 && f.file.startsWith('stems/'));
  if (clipped.length) throw new Error(`rack ${id}: clipped stems ${clipped.map(f => `${f.file} (${f.clipped})`).join(', ')}`);
  // a part with notes must not be silent (the rack's peak meter reads NaN as 0, so this also catches NaN)
  const score = JSON.parse(readFileSync(join(SOURCE, `${id}.score.json`), 'utf8')) as { parts: { id: string; notes: unknown[] }[] };
  const silent = score.parts.filter(p => p.notes.length && !(r.files.find(f => f.file === `stems/${p.id}.wav`)?.peak! > 1e-4));
  if (silent.length) throw new Error(`rack ${id}: silent or NaN stems: ${silent.map(p => p.id).join(', ')}`);
}
function engineRender(a: (typeof AUDITIONS)[number]) {
  const dir = join(ENGINE, a.id), assets = join(dir, 'assets');
  rmSync(dir, { recursive: true, force: true });
  cpSync(join(V2_PROJECT_DIR, 'assets'), assets, { recursive: true });
  mkdirSync(join(assets, 'lab'), { recursive: true });
  const stems = join(RACK, a.id, 'stems');
  for (const f of readdirSync(stems).filter(x => x.endsWith('.wav'))) copyFileSync(join(stems, f), join(assets, 'lab', f));
  const file = join(dir, `${a.id}.json`);
  writeFileSync(file, JSON.stringify(a.project, null, 1) + '\n');
  run(['bin/daemonv12.js', 'validate', file], `engine validate ${a.id}`);
  const out = run(['bin/daemonv12.js', 'render', file, '--out-dir', join(dir, 'render'), '--stems', '--format', 'wav', '--json'], `engine render ${a.id}`);
  writeFileSync(join(dir, 'render-result.json'), out);
  // frame check: the rack stems and the engine output must have the engine's own length
  const want = engineEndFrames(a.project.bars * 4, BPM, a.project.render.tail.seconds), got = readWav(join(dir, 'render', `${a.id}.wav`)).frames;
  if (got !== want) throw new Error(`${a.id}: engine output ${got} frames, expected ${want}`);
}

interface Listen { id: string; label: string; source: string; fromFrame: number; toFrame: number; seconds: number; lufsBefore: number; tpBefore: number; gainDb: number; lufs: number; tp: number; lra: number; wav: string; mp3: string; wavSha256: string; mp3Sha256: string }
function listeningFiles(): Listen[] {
  rmSync(LISTEN, { recursive: true, force: true }); mkdirSync(LISTEN, { recursive: true });
  const tmp = join(BUILD, 'tmp'); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp);
  const from16 = beatFrame(16, BPM);
  type Src = { id: string; label: string; source: string; data: Float64Array[]; from: number; to: number; dry?: boolean };
  const v2 = readWav(join(V2_BUILD, 'render', 'concrete-gospel.wav'));
  const srcs: Src[] = [
    { id: '0-v2-reference', label: 'Concrete Gospel V2 (the approved master, reed lead), bars 5-16: the A/B reference', source: 'build/v2/render/concrete-gospel.wav (bit-identical to the delivered V2 master)', data: v2.data, from: from16, to: v2.frames },
    ...AUDITIONS.map(a => { const w = readWav(join(ENGINE, a.id, 'render', `${a.id}.wav`)); return { id: a.id, label: a.label, source: `build/engine/${a.id}/render/${a.id}.wav`, data: w.data, from: beatFrame(a.fromBeat, BPM), to: w.frames }; }),
    ...DRY.map(d => { const w = readWav(join(RACK, d.id, 'mix-dry.wav')); return { id: d.id, label: d.label, source: `build/rack/${d.id}/mix-dry.wav`, data: w.data, from: 0, to: w.frames, dry: true }; }),
  ];
  // measure, then one gain per file to its target; one common reduction per group if a true peak would pass -1 dBTP
  const measured = srcs.map(s => {
    const x = cut(s.data, s.from, s.to, s.from > 0 ? 0.005 : 0.0005), f = join(tmp, `${s.id}.wav`);
    writeWav24(f, x);
    return { s, x, l: loudness(f) };
  });
  for (const group of [measured.filter(m => !m.s.dry), measured.filter(m => m.s.dry)]) {
    const target = group[0]?.s.dry ? DRY_LUFS : TARGET_LUFS;
    let over = 0; for (const m of group) over = Math.max(over, m.l.tp + (target - m.l.lufs) - MAX_TP);
    for (const m of group) (m as typeof m & { g: number }).g = target - m.l.lufs - over;
  }
  const out: Listen[] = [];
  for (const m of measured as (typeof measured[number] & { g: number })[]) {
    const wav = join(LISTEN, `${m.s.id}.wav`), mp = join(LISTEN, `${m.s.id}.mp3`);
    writeWav24(wav, gainOf(m.x, m.g)); mp3(wav, mp);
    const l = loudness(wav);
    out.push({ id: m.s.id, label: m.s.label, source: m.s.source, fromFrame: m.s.from, toFrame: m.s.to, seconds: +(m.x[0]!.length / SR).toFixed(3), lufsBefore: m.l.lufs, tpBefore: m.l.tp,
      gainDb: +m.g.toFixed(2), lufs: l.lufs, tp: l.tp, lra: l.lra, wav: relative(HERE, wav), mp3: relative(HERE, mp), wavSha256: sha(readFileSync(wav)), mp3Sha256: sha(readFileSync(mp)) });
  }
  rmSync(tmp, { recursive: true, force: true });
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const t0 = Date.now();
  if (process.argv.includes('--rebuild-v2') || !existsSync(join(V2_BUILD, 'verify.json'))) { buildV2(); writeFileSync(join(V2_BUILD, 'verify.json'), JSON.stringify(verifyV2(), null, 1) + '\n'); }
  const v2 = verifyV2(); // throws unless the backing on disk is bit-identical to the delivered V2
  for (const d of [RACK, ENGINE]) { rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); }
  composeSources();
  for (const a of AUDITIONS) rackRender(a.id);
  for (const d of DRY) rackRender(d.id);
  for (const a of AUDITIONS) engineRender(a);
  const files = listeningFiles();
  const manifest = {
    schema: 'daemonv12.cathedral-experiment.build/1', stage: PRE_QA ? 'pre-qa (candidate)' : 'final (after the QA/fix pass)', node: process.version, ffmpeg: String(ff(['-version']).stdout).split('\n')[0],
    v2Backing: { masterSha256: v2.master.sha256, identicalToDeliveredV2: v2.master.identical, stemsIdentical: Object.values(v2.stems).every(s => s.identical) },
    targets: { auditionsLufs: TARGET_LUFS, dryLufs: DRY_LUFS, maxTruePeakDbtp: MAX_TP }, files,
    seconds: +((Date.now() - t0) / 1000).toFixed(1), repo: relative(process.cwd(), REPO) || '.',
  };
  writeFileSync(join(BUILD, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
  console.log(JSON.stringify(files.map(f => ({ id: f.id, s: f.seconds, lufsBefore: f.lufsBefore, gain: f.gainDb, lufs: f.lufs, tp: f.tp })), null, 1));
  console.error(`build: ${manifest.seconds} s`);
}
