#!/usr/bin/env node
// Renders, measures and packages the THING//MANIA official soundtrack with the DaemonV12 CLI.
//
//   node experiments/thingmania-ost/final/tools/render-final.mjs [--fast] [slug ...]
//
// For each deliverable:
//   loops (main-theme, menu-mix): render <slug>-x3.json (the loop three times, continuously) with
//     stems; cycle 2 is the seamless loop master and must be bit-identical to cycle 3, so looping
//     it is exactly continuous playback with every reverb, delay and release tail in place.
//   demo-mix: render once with stems; it has a real start and ending.
//   Stems: the engine's per-track stems are summed into six groups and printed through the
//     master bus (gain, high-pass, compressor) with the compressor keyed by the full mix
//     (FFmpeg sidechaincompress, the same code path as the engine's acompressor). The six group
//     stems therefore sum back to the master (null test recorded) and share its start, length
//     and sample rate.
//   Encodes: Ogg Vorbis and AAC/M4A listening copies, MP3 previews, FLAC stems; every one is
//     decoded again and checked for length, alignment and peaks.
//   Checks: loudness, true peak, clipping, mono fold, stereo width, phone-speaker proxy, masking
//     (per hook bar too), pitch probes for every gesture, loop seams, determinism (second render
//     identical), UI-click headroom (menu), start and ending (demo).
// --fast skips the repeat renders and the encodes (for iterating on the arrangement).
// Large renders stay in final/renders/ (git-ignored); shareable results land next to the projects.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bandShares } from '../../tools/inspect-palette.mjs';
import { noteFreq } from '../../tools/dsp.mjs';
import { STEM_GROUPS } from './stem-groups.mjs';
import * as F from './analysis-final.mjs';

const A = F.A;
const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
const OST = join(HERE, '..');
const REPO = join(OST, '..', '..');
const CLI = join(REPO, 'bin', 'daemonv12.js');
const FFMPEG = process.env.DAEMONV12_FFMPEG || 'ffmpeg';
const RENDERS = join(HERE, 'renders');
const SR = 44100, BEAT = 0.565625, BAR = 4 * BEAT, LOOP_FRAMES = 1596420;
const args = process.argv.slice(2), FAST = args.includes('--fast'), ONLY = args.filter((a) => !a.startsWith('--'));

const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const shaBuf = (b) => createHash('sha256').update(b).digest('hex');
const rel = (p) => resolve(p).replace(REPO + '/', '');
const r = (x, d = 2) => (Number.isFinite(x) ? Number(x.toFixed(d)) : null);
const swingTicks = (s) => Math.floor(s / 4) * 960 + [0, 272, 480, 752][s % 4];
const at = (bar, step, ms = 0) => (bar - 1) * BAR + swingTicks(step) / 960 * BEAT + ms / 1000;
const ms = (bar, step, list) => list.map((m) => at(bar, step, m));
const log = (...x) => console.error(`[${new Date().toISOString().slice(11, 19)}]`, ...x);

function daemon(argv) {
  const out = execFileSync(process.execPath, [CLI, ...argv, '--json'], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 });
  const j = JSON.parse(out);
  if (!j.ok) throw new Error(`${argv.join(' ')}: ${JSON.stringify(j.errors)}`);
  return j;
}
function ff(argv, opts = {}) {
  const res = spawnSync(FFMPEG, ['-hide_banner', '-nostdin', '-nostats', '-threads', '1', '-filter_threads', '1', ...argv], { maxBuffer: 1 << 30, ...opts });
  if (res.status !== 0) throw new Error(`ffmpeg ${argv.join(' ')}\n${res.stderr}`);
  return res;
}

// ---------- PCM16 stereo WAV, canonical 44-byte header (the engine's layout) ----------
function readPcm(path) {
  const b = readFileSync(path);
  if (b.toString('ascii', 36, 40) !== 'data' || b.readUInt16LE(22) !== 2 || b.readUInt32LE(24) !== SR) throw new Error(`unexpected WAV layout: ${path}`);
  const n = b.readUInt32LE(40) / 2, out = new Int16Array(n);
  for (let i = 0; i < n; i++) out[i] = b.readInt16LE(44 + 2 * i);
  return out;
}
function writePcm(path, pcm) {
  const b = Buffer.alloc(44 + pcm.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + pcm.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28);
  b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(pcm.length * 2, 40);
  Buffer.from(pcm.buffer, pcm.byteOffset, pcm.length * 2).copy(b, 44);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, b);
  return path;
}
const toCh = (pcm) => { const n = pcm.length / 2, L = new Float64Array(n), R = new Float64Array(n); for (let i = 0; i < n; i++) { L[i] = pcm[2 * i] / 32768; R[i] = pcm[2 * i + 1] / 32768; } return [L, R]; };
const equalPcm = (a, b) => a.length === b.length && Buffer.from(a.buffer, a.byteOffset, a.length * 2).equals(Buffer.from(b.buffer, b.byteOffset, b.length * 2));

// ---------- master-bus group stems ----------
// The engine's master: sum of the s16 track stems, x master gain, then the master effects in
// FFmpeg (f64), then round to s16. Each group is processed with the same linear filters and the
// compressor keyed by the full mix, so the groups sum to the master.
function filterOf(e) {
  if (e.type === 'highpass' || e.type === 'lowpass') return `${e.type}=f=${e.frequencyHz}:p=2:r=f64`;
  if (e.type === 'compressor') return `threshold=${10 ** (e.thresholdDb / 20)}:ratio=${e.ratio}:attack=${e.attackMs}:release=${e.releaseMs}:makeup=${10 ** ((e.makeupGainDb ?? 0) / 20)}:knee=1:link=maximum:detection=rms`;
  throw new Error(`master effect ${e.type} has no bus-stem equivalent`);
}
function busStems({ project, stems, masterPcm, work, outDir }) {
  const master = project.master, fx = master.effects ?? [];
  if (fx.some((e, i) => e.type === 'compressor' && i !== fx.length - 1) || fx.some((e) => !['highpass', 'lowpass', 'compressor'].includes(e.type))) throw new Error('unsupported master chain');
  const linear = fx.filter((e) => e.type !== 'compressor').map(filterOf).join(','), comp = fx.find((e) => e.type === 'compressor');
  const n = masterPcm.length, g = 10 ** ((master.gainDb ?? 0) / 20);
  const pcm = Object.fromEntries(Object.entries(stems).map(([id, p]) => [id, readPcm(p)]));
  const sum = (ids) => { const o = new Float64Array(n); for (const id of ids) { const s = pcm[id]; if (!s) continue; for (let i = 0; i < n; i++) o[i] += s[i]; } for (let i = 0; i < n; i++) o[i] *= g; return o; };
  const raw = (x, p) => { const b = Buffer.alloc(x.length * 8); for (let i = 0; i < x.length; i++) b.writeDoubleLE(x[i] / 32768, i * 8); writeFileSync(p, b); };
  const back = (p) => { const b = readFileSync(p), o = new Float64Array(n); for (let i = 0; i < n; i++) o[i] = b.readDoubleLE(i * 8) * 32768; return o; };
  const q = (x) => { let clipped = 0; const o = Int16Array.from(x, (v) => { const k = Math.round(v); if (k < -32768 || k > 32767) clipped++; return Math.max(-32768, Math.min(32767, k)); }); return { o, clipped }; };
  const IN = ['-f', 'f64le', '-ar', String(SR), '-ac', '2', '-i'], OUT = ['-c:a', 'pcm_f64le', '-f', 'f64le', '-y'];
  mkdirSync(work, { recursive: true });
  const key = join(work, 'key.f64'), main = join(work, 'main.f64'), res = join(work, 'out.f64');
  raw(sum(Object.keys(pcm)), key);
  // 1. The bus reproduces the engine master exactly.
  ff([...IN, key, '-af', [linear, comp && `acompressor=${filterOf(comp)}`].filter(Boolean).join(','), ...OUT, res]);
  const { o: rebuilt } = q(back(res));
  let rebuildMax = 0; for (let i = 0; i < n; i++) rebuildMax = Math.max(rebuildMax, Math.abs(rebuilt[i] - masterPcm[i]));
  // 2. Each group through the same bus, compressor keyed by the full mix.
  const assigned = new Set(Object.values(STEM_GROUPS).flat()), stray = Object.keys(pcm).filter((id) => !assigned.has(id));
  if (stray.length) throw new Error(`tracks without a stem group: ${stray}`);
  const out = {}, acc = new Float64Array(n);
  for (const [group, ids] of Object.entries(STEM_GROUPS)) {
    raw(sum(ids), main);
    const graph = comp ? `[0:a]${linear}[m];[1:a]${linear}[k];[m][k]sidechaincompress=${filterOf(comp)}[o]` : `[0:a]${linear}[o]`;
    ff([...IN, main, ...IN, key, '-filter_complex', graph, '-map', '[o]', ...OUT, res]);
    const { o, clipped } = q(back(res));
    for (let i = 0; i < n; i++) acc[i] += o[i];
    out[group] = { path: writePcm(join(outDir, `${group}.wav`), o), tracks: ids.filter((id) => pcm[id]), clippedSamples: clipped };
  }
  for (const p of [key, main, res]) rmSync(p, { force: true });
  return { groups: out, masterRebuildMaxDiffLsb: rebuildMax };
}
function nullTest(masterPcm, groupPcms) {
  let max = 0, e = 0, em = 0;
  for (let i = 0; i < masterPcm.length; i++) {
    let s = 0; for (const g of groupPcms) s += g[i];
    const d = s - masterPcm[i]; max = Math.max(max, Math.abs(d)); e += d * d; em += masterPcm[i] ** 2;
  }
  return { method: 'sum of the six s16 group stems minus the s16 master', maxAbsDiffLsb: max, residualDbRelMaster: r(10 * Math.log10(e / em + 1e-30), 1) };
}

// ---------- measurements ----------
const MONO = 'pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1';
const PHONE = `highpass=f=300:poles=2,highpass=f=300:poles=2,${MONO}`;
function loud(wav, filter) {
  const res = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-v', 'verbose', '-i', wav, '-af', `${filter ? filter + ',' : ''}ebur128=framelog=verbose:peak=true`, '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (res.status !== 0) throw new Error(res.stderr);
  const s = res.stderr, tail = s.slice(s.lastIndexOf('Summary:'));
  const num = (re) => { const m = re.exec(tail); return m && !/inf/.test(m[1]) ? Number(m[1]) : null; };
  const mom = [...s.matchAll(/ M:\s*(-?[\d.]+)/g)].map((x) => Number(x[1])).filter((x) => x > -60).sort((a, b) => a - b);
  return { integrated: num(/I:\s+(-?[\d.]+|-inf) LUFS/), lra: num(/LRA:\s+(-?[\d.]+) LU/), truePeak: num(/Peak:\s+(-?[\d.]+|-inf) dBFS/),
    p90Momentary: mom.length ? mom[Math.floor(mom.length * 0.9)] : null, maxMomentary: mom.length ? mom[mom.length - 1] : null };
}
// Arrangement arc: median momentary loudness (EBU R128, 400 ms) inside each bar.
function arc(wav, bars) {
  const res = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-v', 'verbose', '-i', wav, '-af', 'ebur128=framelog=verbose', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const pts = [...res.stderr.matchAll(/ t:\s*([\d.]+)\s+TARGET:\S+ LUFS\s+M:\s*(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  return Array.from({ length: bars }, (_, b) => {
    const v = pts.filter(([t]) => t - 0.2 >= b * BAR && t - 0.2 < (b + 1) * BAR).map(([, m]) => m).sort((a, c) => a - c);
    return v.length ? v[Math.floor(v.length / 2)] : null;
  });
}
function width([L, R]) {
  let ll = 0, rr = 0, lr = 0, mid = 0, side = 0;
  for (let i = 0; i < L.length; i++) { ll += L[i] ** 2; rr += R[i] ** 2; lr += L[i] * R[i]; mid += ((L[i] + R[i]) / 2) ** 2; side += ((L[i] - R[i]) / 2) ** 2; }
  return { correlation: r(lr / Math.sqrt(ll * rr || 1), 3), sideEnergyFraction: r(side / (mid + side), 4) };
}
function samplePeak(pcm) { let p = 0, full = 0; for (const v of pcm) { p = Math.max(p, Math.abs(v)); if (v === 32767 || v === -32768) full++; } return { peakDbfs: r(20 * Math.log10(p / 32768), 2), fullScaleSamples: full }; }

function decodeCheck(file, refPcm, refWav) {
  const res = ff(['-i', file, '-f', 's16le', '-ac', '2', '-ar', String(SR), '-'], { maxBuffer: 1 << 30 });
  const b = res.stdout, dec = new Int16Array(b.length / 2);
  for (let i = 0; i < dec.length; i++) dec[i] = b.readInt16LE(2 * i);
  const frames = dec.length / 2, n = Math.min(dec.length, refPcm.length);
  // Alignment: error energy against the original at lag 0 vs. the best lag within +/-2048 frames.
  const err = (lag) => { let e = 0, s = 0; for (let i = 0; i < n; i += 2) { const j = i + 2 * lag; if (j < 0 || j >= dec.length) continue; e += (dec[j] - refPcm[i]) ** 2; s += refPcm[i] ** 2; } return 10 * Math.log10(s / (e || 1)); };
  let best = 0, bestSnr = -Infinity;
  for (const lag of [0, ...[-2112, -1105, -1024, -576, 576, 1024, 1105, 1152, 1600, 2112]]) { const v = err(lag); if (v > bestSnr) { bestSnr = v; best = lag; } }
  const tmp = join(RENDERS, '_decoded.wav'); writePcm(tmp, Int16Array.from(dec));
  const l = loud(tmp); rmSync(tmp);
  return { file: rel(file), bytes: statSync(file).size, sha256: sha(file), decodedFrames: frames, expectedFrames: refPcm.length / 2, exactLength: frames === refPcm.length / 2,
    snrAtLag0Db: r(err(0), 1), bestLagFrames: best, decodedTruePeakDbtp: l.truePeak, decodedIntegratedLufs: l.integrated };
}
const ENC = {
  ogg: ['-c:a', 'libvorbis', '-q:a', '6'],
  m4a: ['-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart'],
  mp3: ['-c:a', 'libmp3lame', '-b:a', '192k'],
  flac: ['-c:a', 'flac', '-compression_level', '8'],
};
function encode(wav, out, kind) {
  mkdirSync(dirname(out), { recursive: true });
  ff(['-y', '-i', wav, '-map', '0:a:0', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', ...ENC[kind], '-ar', String(SR), '-ac', '2', out]);
  return out;
}

// ---------- pitch probes: does each gesture happen where the score says? ----------
const hookTimes = (bar) => [at(bar, 0, 90), at(bar, 3, 40), at(bar, 5, 40), at(bar, 6, 60), at(bar, 8, 160)];
const THEME_PROBES = (o) => [
  { label: 'bars 2/13: hook (E6 D6 B5 C#6 | B5)', stem: 'whistle', ref: 'E6', lo: 900, hi: 1450, win: 0.03, times: [...hookTimes(2 + o), ...hookTimes(13 + o)] },
  { label: 'bar 4: the whistle catches the bass bend (A#5 -> B5)', stem: 'whistle', ref: 'A#5', lo: 800, hi: 1150, win: 0.03, times: ms(4 + o, 8, [10, 60, 160, 300]) },
  { label: 'bar 5: toaster DEE (A#4) rides the bass bend up to B4', stem: 'voice', ref: 'A#4', lo: 380, hi: 600, win: 0.03, times: ms(5 + o, 12, [5, 30, 60, 120]) },
  { label: 'bar 5: bass Bb1 -> B1 under it', stem: 'bass', ref: 'Bb1', lo: 45, hi: 80, win: 0.05, times: ms(5 + o, 12, [0, 30, 60, 120]) },
  { label: 'bar 7: kettle F4 -> F#4 a fourth under the DEE', stem: 'kettle', ref: 'F4', lo: 290, hi: 450, win: 0.03, times: ms(7 + o, 12, [8, 120]) },
  { label: 'bar 8: tag at double speed into the hole (E4 G4 A#4 B4)', stem: 'voice', ref: 'E4', lo: 280, hi: 560, win: 0.03, times: [at(8 + o, 8, 40), at(8 + o, 9, 40), at(8 + o, 10, 60), at(8 + o, 12, 80)] },
  { label: 'bar 9: the toaster tag in A (A4 C#5, D#5 -> E5)', stem: 'voice', ref: 'A4', lo: 380, hi: 720, win: 0.03, times: [at(9 + o, 8, 50), at(9 + o, 10, 50), ...ms(9 + o, 12, [5, 120])] },
  { label: 'bar 9: bass Eb2 -> E2 under it', stem: 'bass', ref: 'Eb2', lo: 65, hi: 105, win: 0.05, times: ms(9 + o, 12, [0, 120]) },
  { label: 'bar 10: the whistle copies the A tag (A5 C#6, D#6 -> E6)', stem: 'whistle-dry', ref: 'A5', lo: 800, hi: 1450, win: 0.03, times: [at(10 + o, 8, 60), at(10 + o, 10, 60), ...ms(10 + o, 12, [10, 150])] },
  { label: 'bars 11-12: the bend climbs (F#2 -> G2, G#2 -> A2)', stem: 'bass', ref: 'F#2', lo: 80, hi: 125, win: 0.05, times: [...ms(11 + o, 12, [0, 120]), ...ms(12 + o, 12, [0, 120])] },
  { label: 'bar 12: the kettle boils up an octave (E5 -> E6)', stem: 'fx', ref: 'E5', lo: 600, hi: 1400, win: 0.03, times: ms(12 + o, 8, [80, 300, 550, 780]) },
  { label: 'bar 13: second whistler a sixth below (G5 F#5 D5 E5 | D5)', stem: 'whistle-harmony', ref: 'G5', lo: 550, hi: 850, win: 0.03, times: hookTimes(13 + o) },
  { label: 'bar 14: everybody bends - bass Bb1 -> B1', stem: 'bass', ref: 'Bb1', lo: 45, hi: 80, win: 0.05, times: ms(14 + o, 12, [0, 120]) },
  { label: 'bar 14: everybody bends - toaster A#4 -> B4', stem: 'voice', ref: 'A#4', lo: 380, hi: 600, win: 0.03, times: ms(14 + o, 12, [5, 120]) },
  { label: 'bar 14: everybody bends - kettle F4 -> F#4', stem: 'kettle', ref: 'F4', lo: 290, hi: 450, win: 0.03, times: ms(14 + o, 12, [8, 120]) },
  { label: 'bar 14: everybody bends - whistle A#5 -> B5', stem: 'whistle', ref: 'A#5', lo: 800, hi: 1150, win: 0.03, times: ms(14 + o, 12, [5, 120]) },
  { label: 'bar 15: the toaster steals the long note (B4)', stem: 'voice', ref: 'B4', lo: 380, hi: 600, win: 0.04, times: ms(15 + o, 8, [180, 450]) },
  { label: 'bar 16: choir slip chord holds, then sags one semitone (G4 C5 D5 -> F#4 B4 C#5)', stem: 'choir',
    notes: ['G4', 'C5', 'D5', 'F#4', 'B4', 'C#5'], tones: [['hold', at(16 + o, 9)], ['sag midpoint', at(16 + o, 12, 250)], ['downbeat arrival', at(16 + o, 15, 0)]] },
  { label: 'bar 16: bass F1 slides home to E1', stem: 'bass', ref: 'F1', lo: 36, hi: 50, win: 0.06, times: ms(16 + o, 14, [5, 160]) },
];
const MENU_PROBES = [
  { label: 'bars 2/13: hook (E6 D6 B5 C#6 | B5)', stem: 'whistle', ref: 'E6', lo: 900, hi: 1450, win: 0.03, times: [...hookTimes(2), ...hookTimes(13)] },
  { label: 'bar 5: toaster DEE (A#4) rides the bass bend up to B4', stem: 'voice', ref: 'A#4', lo: 380, hi: 600, win: 0.03, times: ms(5, 12, [5, 120]) },
  { label: 'bar 9: the toaster tag in A (D#5 -> E5)', stem: 'voice', ref: 'D#5', lo: 500, hi: 720, win: 0.03, times: ms(9, 12, [5, 120]) },
  { label: 'bar 16: choir slip chord holds, then sags one semitone', stem: 'choir', notes: ['G4', 'C5', 'D5', 'F#4', 'B4', 'C#5'], tones: [['hold', at(16, 9)], ['downbeat arrival', at(16, 15, 0)]] },
  { label: 'menu pads: the hum follows the harmony (Em9 bar 1, A13 bar 9, Cmaj7 bar 11, D bar 12)', stem: 'hum', notes: ['D4', 'C#4', 'B3', 'A3'],
    tones: [['bar 1', at(1, 4)], ['bar 9', at(9, 4)], ['bar 11', at(11, 4)], ['bar 12', at(12, 4)]] },
];
// Bars in which the hook's head (E6 D6 B5 C#6, beats 1-2) is played.
const HOOK_BARS = { 'main-theme': [2, 4, 6, 8, 13, 15, 16], 'menu-mix': [2, 6, 13, 16], 'demo-mix': [3, 5, 7, 9, 14, 16, 17] };

function runProbes(stemMono, probes) {
  return probes.filter((p) => stemMono[p.stem]).map((p) => {
    const x = stemMono[p.stem];
    if (p.tones) return { label: p.label, stem: p.stem, tonesDb: p.tones.map(([name, t]) => ({ at: name, seconds: r(t, 4), ...Object.fromEntries(p.notes.map((n) => [n, A.toneDb(x, t, noteFreq(n))])) })) };
    return { label: p.label, stem: p.stem, reference: p.ref, points: p.times.map((t) => A.probe(x, t, { lo: p.lo, hi: p.hi, ref: noteFreq(p.ref), win: p.win })) };
  });
}

// Everything measured on one finished deliverable (master + track stems + group stems, all aligned).
function measure({ slug, masterPath, masterPcm, trackPcm, groupPaths, project, bars, probes }) {
  const ch = toCh(masterPcm), mono = A.toMono(ch);
  const full = loud(masterPath), monoL = loud(masterPath, MONO), phone = loud(masterPath, PHONE);
  const trackMono = Object.fromEntries(Object.entries(trackPcm).map(([id, p]) => [id, A.toMono(toCh(p))]));
  const frames = Object.fromEntries(Object.entries(trackMono).map(([id, x]) => [id, A.bandFrames(x)]));
  const whistles = ['whistle', 'whistle-dry'].filter((id) => frames[id]), voices = ['voice', 'kettle', 'choir'].filter((id) => frames[id]);
  const comp = project.master.effects.find((e) => e.type === 'compressor');
  const groups = Object.fromEntries(Object.entries(groupPaths).map(([g, p]) => {
    const f = loud(p), ph = loud(p, PHONE);
    return [g, { integratedLufs: f.integrated, p90MomentaryLufs: f.p90Momentary, phoneP90MomentaryLufs: ph.p90Momentary, truePeakDbtp: f.truePeak, ...samplePeak(readPcm(p)) }];
  }));
  const hookBars = (HOOK_BARS[slug] ?? []).map((b) => ({ bar: b, ...F.windowMasking(frames, whistles, (b - 1) * BAR, (b - 1) * BAR + 2 * BEAT) }));
  return {
    loudness: { integratedLufs: full.integrated, loudnessRangeLu: full.lra, p90MomentaryLufs: full.p90Momentary, maxMomentaryLufs: full.maxMomentary },
    peaks: { truePeakDbtp: full.truePeak, ...samplePeak(masterPcm) },
    stereo: { ...width(ch), above300Hz: width(ch.map(A.above300)), monoFoldLufs: monoL.integrated, monoFoldChangeLu: r(monoL.integrated - full.integrated, 2),
      pans: Object.fromEntries(project.tracks.map((t) => [t.id, t.mix?.pan ?? 0])) },
    phoneProxy: { method: 'two 2-pole high-passes at 300 Hz, then mono fold', lufs: phone.integrated, changeLu: r(phone.integrated - full.integrated, 2), masterBandShares: bandShares(mono) },
    stemGroups: groups,
    separation: {
      method: 'per 2048-sample frame and third-octave band (100 Hz-12.5 kHz) on mono track stems; a part is active within 30 dB (conflict: 25 dB) of its loudest frame',
      whistleUnmasked: A.maskingReport(frames, whistles), appliancesUnmasked: voices.length ? A.maskingReport(frames, voices) : null,
      bassUnmasked: A.maskingReport(frames, ['bass', 'bass-grit']), whistleVsAppliances: voices.length ? A.conflictReport(frames, whistles, voices) : null,
      hookHeadUnmaskedByBar: hookBars, centroidHz: Object.fromEntries(Object.entries(frames).map(([id, f]) => [id, A.centroid(f)])),
    },
    masterCompressor: comp ? A.compressorActivity(mono, Object.values(trackMono), project.master.gainDb ?? 0, comp.makeupGainDb ?? 0) : null,
    arcMedianMomentaryLufsByBar: arc(masterPath, bars),
    variety: A.barVariety(mono, bars, BAR * SR, Array.from({ length: 16 }, (_, s) => swingTicks(s) / 960 * BEAT * SR)),
    uiSpace: { ...F.uiClickHeadroom(mono), bandLevel2to6kHz: F.highBandLevel(mono) },
    probes: runProbes(trackMono, probes),
  };
}

// ---------- one deliverable ----------
const DELIVERABLES = {
  'main-theme': { loop: true, bars: 16, probes: THEME_PROBES(0), name: 'main-theme-loop' },
  'menu-mix': { loop: true, bars: 16, probes: MENU_PROBES, name: 'menu-mix-loop' },
  'demo-mix': { loop: false, bars: 19, seconds: 41, probes: THEME_PROBES(1), name: 'demo-mix' },
};
const DIRS = { masters: join(HERE, 'masters'), stems: join(HERE, 'stems'), web: join(HERE, 'web'), previews: join(HERE, 'previews'), analysis: join(HERE, 'analysis') };

function produce(slug) {
  const d = DELIVERABLES[slug], out = join(RENDERS, slug);
  rmSync(out, { recursive: true, force: true });
  const proj = join(HERE, `${slug}.json`), x3 = join(HERE, `${slug}-x3.json`), renderProj = d.loop ? x3 : proj;
  const project = JSON.parse(readFileSync(proj, 'utf8'));
  const validation = (d.loop ? [proj, x3] : [proj]).map((p) => { const v = daemon(['validate', p]); return { project: rel(p), ok: v.ok, warnings: (v.warnings ?? []).map((w) => w.code) }; });
  log(slug, 'render', rel(renderProj));
  const main = daemon(['render', renderProj, '--out-dir', join(out, 'render'), '--stems', '--format', 'wav']);
  const exact = d.loop ? daemon(['render', proj, '--out-dir', join(out, 'exact'), '--format', 'wav']) : null;
  const manifest = JSON.parse(readFileSync(resolve(REPO, main.artifacts.manifest), 'utf8'));
  const masterAll = readPcm(resolve(REPO, main.artifacts.wav));
  const stemPaths = Object.fromEntries(main.artifacts.stems.map((s) => [s.trackId, resolve(REPO, s.wav)]));
  log(slug, 'bus stems');
  const bus = busStems({ project, stems: stemPaths, masterPcm: masterAll, work: join(out, 'work'), outDir: join(out, 'bus') });

  // The deliverable window: cycle 2 of the x3 render for loops, the whole render for the demo.
  const N = d.loop ? LOOP_FRAMES : masterAll.length / 2, from = d.loop ? N : 0;
  const crop = (pcm, k = 1) => pcm.subarray(2 * (d.loop ? k * N : 0), 2 * (d.loop ? (k + 1) * N : N));
  const masterPath = writePcm(join(DIRS.masters, `${d.name}.wav`), crop(masterAll));
  const masterPcm = readPcm(masterPath);
  const groupPcmAll = Object.fromEntries(Object.entries(bus.groups).map(([g, x]) => [g, readPcm(x.path)]));
  const groupPaths = Object.fromEntries(Object.keys(groupPcmAll).map((g) => [g, writePcm(join(out, 'stems', `${g}.wav`), crop(groupPcmAll[g]))]));
  const trackPcm = Object.fromEntries(Object.entries(stemPaths).map(([id, p]) => [id, crop(readPcm(p))]));
  const loop = d.loop ? (() => {
    const exactPcm = readPcm(resolve(REPO, exact.artifacts.wav)), c2 = crop(masterAll, 1), c3 = crop(masterAll, 2);
    const jump = (p) => Math.max(Math.abs(p[p.length - 2] - p[0]), Math.abs(p[p.length - 1] - p[1])) / 32768;
    let cont = 0; for (const o of [-1, 0, 1, 2]) for (let c = 0; c < 2; c++) cont = Math.max(cont, Math.abs(masterAll[2 * (2 * N + o) + c] - masterAll[2 * (2 * N + o - 1) + c]) / 32768);
    let head = 0, headSig = 0; for (let i = 0; i < 2 * Math.round(0.5 * SR); i++) { head += (exactPcm[i] - c2[i]) ** 2; headSig += c2[i] ** 2; }
    return {
      method: 'cycle 2 (frames N..2N) of the continuous x3 render; it starts with cycle 1 tails and must equal cycle 3 bit for bit',
      frames: N, seconds: r(N / SR, 6), exactRenderFrames: exactPcm.length / 2, x3Frames: masterAll.length / 2,
      cycle2EqualsCycle3: { master: equalPcm(c2, c3), ...Object.fromEntries(Object.entries(groupPcmAll).map(([g, p]) => [g, equalPcm(crop(p, 1), crop(p, 2))])) },
      seamlessWrapJump: r(jump(c2), 5), continuousMaxStepNearSameBoundary: r(cont, 5),
      naiveExactRenderWrapJump: r(jump(exactPcm), 5), naiveExactRenderFirst500msMissingTailDb: r(10 * Math.log10(head / headSig), 2),
    };
  })() : null;
  const nul = nullTest(masterPcm, Object.values(groupPaths).map(readPcm));

  log(slug, 'measure');
  const checks = {
    slug, project: rel(proj), renderedProject: rel(renderProj), engineVersion: main.engineVersion, validation,
    duration: { frames: N, seconds: r(N / SR, 6), bars: d.loop ? 16 : d.bars, bpm: main.summary.bpm, timeSignature: main.summary.timeSignature,
      expectedFrames: d.loop ? LOOP_FRAMES : Math.round(d.seconds * SR), target: d.loop ? '16 bars = 36.2 s exactly' : `18 bars and the ending's decay, cut at ${d.seconds} s` },
    engine: { masterClippedSamples: manifest.production?.master?.clippedSamples ?? null, warnings: main.warnings.map((w) => w.code),
      trackStages: (manifest.production?.tracks ?? []).map((t) => ({ trackId: t.trackId, clippedSamples: t.clippedSamples, preClipPeakDbfs: t.preClipPeakDbfs })) },
    stems: { groups: Object.fromEntries(Object.entries(bus.groups).map(([g, x]) => [g, { tracks: x.tracks, clippedSamples: x.clippedSamples }])),
      masterBusRebuildMaxDiffLsb: bus.masterRebuildMaxDiffLsb, nullTest: nul,
      alignment: Object.fromEntries(Object.entries(groupPaths).map(([g, p]) => { const b = readFileSync(p); return [g, { frames: b.readUInt32LE(40) / 4, sampleRate: b.readUInt32LE(24), channels: b.readUInt16LE(22) }]; })) },
    loop,
    ...measure({ slug, masterPath, masterPcm, trackPcm, groupPaths, project, bars: d.loop ? 16 : d.bars, probes: d.probes }),
  };
  if (!d.loop) {
    const ch = toCh(masterPcm);
    checks.shape = { firstOnsetSeconds: F.firstOnsetSeconds(ch), first100ms: F.windowDb(ch, 0, 0.1), coldOpenGap: F.windowDb(ch, at(1, 3), at(1, 7)),
      finalHit: F.windowDb(ch, at(18, 0), at(18, 2)), last250ms: F.windowDb(ch, N / SR - 0.25, N / SR), last20ms: F.windowDb(ch, N / SR - 0.02, N / SR),
      sections: Object.fromEntries([['cold open', 1], ['theme', 2], ['appliances', 6], ['development', 10], ['hook return', 14], ['ending', 18]].map(([k, b]) => [k, r((b - 1) * BAR, 4)])) };
  }

  if (!FAST) {
    log(slug, 'repeat render (determinism)');
    const again = daemon(['render', renderProj, '--out-dir', join(out, 'render-repeat'), '--stems', '--format', 'wav']);
    const busAgain = busStems({ project, stems: Object.fromEntries(again.artifacts.stems.map((s) => [s.trackId, resolve(REPO, s.wav)])),
      masterPcm: readPcm(resolve(REPO, again.artifacts.wav)), work: join(out, 'work-repeat'), outDir: join(out, 'bus-repeat') });
    checks.determinism = { method: 'second full render from the same project, then the same bus-stem processing; SHA-256 compared',
      master: sha(resolve(REPO, main.artifacts.wav)) === sha(resolve(REPO, again.artifacts.wav)),
      trackStems: main.artifacts.stems.every((s, i) => sha(resolve(REPO, s.wav)) === sha(resolve(REPO, again.artifacts.stems[i].wav))),
      groupStems: Object.keys(bus.groups).every((g) => sha(bus.groups[g].path) === sha(busAgain.groups[g].path)) };

    log(slug, 'encodes');
    const web = (ext) => encode(masterPath, join(DIRS.web, `${d.name}.${ext}`), ext);
    const prev = encode(masterPath, join(DIRS.previews, `${d.name}.mp3`), 'mp3');
    checks.encodes = { ogg: decodeCheck(web('ogg'), masterPcm), m4a: decodeCheck(web('m4a'), masterPcm), mp3: decodeCheck(prev, masterPcm) };
    if (d.loop) {
      const listen = writePcm(join(out, `${slug}-x2-listen.wav`), masterAll.subarray(2 * N));
      const mp3 = encode(listen, join(DIRS.previews, `${slug}-x2-listen.mp3`), 'mp3');
      checks.encodes.listenX2 = { file: rel(mp3), bytes: statSync(mp3).size, sha256: sha(mp3), seconds: r(masterAll.subarray(2 * N).length / 2 / SR, 3),
        content: 'cycles 2 and 3 of the continuous x3 render plus the closing downbeat: the loop as heard in game, twice, then a button ending' };
    }
    checks.encodes.stems = Object.fromEntries(Object.entries(groupPaths).map(([g, p]) => {
      const flac = encode(p, join(DIRS.stems, slug, `${g}.flac`), 'flac');
      const dec = ff(['-i', flac, '-f', 's16le', '-'], { maxBuffer: 1 << 30 }).stdout;
      const pcmBytes = readFileSync(p).subarray(44);
      return [g, { file: rel(flac), bytes: statSync(flac).size, sha256: sha(flac), losslessRoundTrip: dec.equals(pcmBytes), wavPcmSha256: shaBuf(pcmBytes) }];
    }));
  }
  checks.hashes = { masterWav: sha(masterPath), project: sha(proj), ...(d.loop ? { x3Project: sha(x3) } : {}),
    groupStemWavs: Object.fromEntries(Object.entries(groupPaths).map(([g, p]) => [g, sha(p)])) };
  mkdirSync(DIRS.analysis, { recursive: true });
  copyFileSync(resolve(REPO, main.artifacts.manifest), join(DIRS.analysis, `${slug}${d.loop ? '-x3' : ''}.render.json`));
  copyFileSync(resolve(REPO, main.artifacts.analysis), join(DIRS.analysis, `${slug}${d.loop ? '-x3' : ''}.analysis.json`));
  writeFileSync(join(DIRS.analysis, `${slug}.checks.json`), JSON.stringify(checks, null, 1) + '\n');
  return checks;
}

// ---------- the approved AC-01, as the reference every number is compared with ----------
function reference() {
  const out = join(RENDERS, 'reference-ac01');
  rmSync(out, { recursive: true, force: true });
  const proj = join(OST, 'hybrid-ac', 'ac-01-groove-first.json');
  const res = daemon(['render', proj, '--out-dir', out, '--stems', '--format', 'wav']);
  const recorded = JSON.parse(readFileSync(join(OST, 'hybrid-ac', 'analysis', 'ac-01-groove-first.checks.json'), 'utf8')).hashes.masterWav;
  const wav = resolve(REPO, res.artifacts.wav), pcm = readPcm(wav);
  const trackMono = Object.fromEntries(res.artifacts.stems.map((s) => [s.trackId, A.toMono(toCh(readPcm(resolve(REPO, s.wav))))]));
  const frames = Object.fromEntries(Object.entries(trackMono).map(([id, x]) => [id, A.bandFrames(x)]));
  const whistles = ['whistle', 'whistle-dry'];
  const stem = (id) => { const p = resolve(REPO, res.artifacts.stems.find((s) => s.trackId === id).wav), f = loud(p), ph = loud(p, PHONE); return [f.p90Momentary, ph.p90Momentary]; };
  const full = loud(wav), phone = loud(wav, PHONE);
  const git = (a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim();
  const ORIGINALS = ['a-sock-slide', 'b-fridge-light', 'c-low-battery-choir', 'hybrid-ac', 'tools', 'README.md', '.gitignore'].map((p) => `experiments/thingmania-ost/${p}`);
  return {
    project: rel(proj), masterWav: sha(wav), recordedMasterWav: recorded, rerenderMatchesRecorded: sha(wav) === recorded,
    gitChangesUnderApprovedAndEarlierExperiments: git(['status', '--porcelain', '--', ...ORIGINALS]) || 'none',
    integratedLufs: full.integrated, truePeakDbtp: full.truePeak, phoneChangeLu: r(phone.integrated - full.integrated, 2),
    whistleUnmasked: A.maskingReport(frames, whistles),
    hookHeadUnmaskedByBar: [2, 4, 6, 8].map((b) => ({ bar: b, ...F.windowMasking(frames, whistles, (b - 1) * BAR, (b - 1) * BAR + 2 * BEAT) })),
    p90MomentaryLufs: Object.fromEntries(['bass', 'bass-grit', 'whistle', 'voice'].map((id) => [id, stem(id)])),
    uiSpace: { ...F.uiClickHeadroom(A.toMono(toCh(pcm))), bandLevel2to6kHz: F.highBandLevel(A.toMono(toCh(pcm))) },
  };
}

mkdirSync(RENDERS, { recursive: true });
const slugs = ONLY.length ? ONLY : Object.keys(DELIVERABLES);
const summary = { generatedBy: 'experiments/thingmania-ost/final/tools/render-final.mjs', fast: FAST };
log('reference AC-01');
summary.referenceAc01 = reference();
for (const slug of slugs) summary[slug] = produce(slug);
const brief = (c) => ({
  seconds: c.duration.seconds, frames: c.duration.frames, lufs: c.loudness.integratedLufs, p90: c.loudness.p90MomentaryLufs, tp: c.peaks.truePeakDbtp,
  fullScale: c.peaks.fullScaleSamples, engineClipped: c.engine.masterClippedSamples, mono: c.stereo.monoFoldChangeLu, corr: c.stereo.correlation, corr300: c.stereo.above300Hz.correlation,
  side300: c.stereo.above300Hz.sideEnergyFraction, phone: c.phoneProxy.changeLu, whistle: c.separation.whistleUnmasked?.unmaskedShare,
  hookBars: c.separation.hookHeadUnmaskedByBar.map((x) => x.unmaskedShare), appliances: c.separation.appliancesUnmasked?.unmaskedShare,
  bass: c.separation.bassUnmasked?.unmaskedShare, overlap: c.separation.whistleVsAppliances?.simultaneousSeconds, comp: c.masterCompressor?.gainReductionDb,
  distinctBars: c.variety.distinctBars, arc: c.arcMedianMomentaryLufsByBar.join(' '), ui: { clickToMusic: c.uiSpace.clickToMusicDb, band: c.uiSpace.bandLevel2to6kHz }, null: c.stems.nullTest, rebuild: c.stems.masterBusRebuildMaxDiffLsb, loop: c.loop && { c2c3: c.loop.cycle2EqualsCycle3, wrap: c.loop.seamlessWrapJump, cont: c.loop.continuousMaxStepNearSameBoundary },
  determinism: c.determinism, encodes: c.encodes && Object.fromEntries(['ogg', 'm4a', 'mp3'].map((k) => [k, { exact: c.encodes[k].exactLength, lag: c.encodes[k].bestLagFrames, snr: c.encodes[k].snrAtLag0Db, tp: c.encodes[k].decodedTruePeakDbtp }])),
  stemsFlac: c.encodes && Object.values(c.encodes.stems).every((s) => s.losslessRoundTrip),
  shape: c.shape,
});
writeFileSync(join(RENDERS, 'summary.json'), JSON.stringify(summary, null, 1));
// A partial run merges into the existing summary; manifest-final.mjs checks that every entry
// still matches its project file.
if (!FAST) {
  const path = join(DIRS.analysis, 'summary.json'), prev = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  writeFileSync(path, JSON.stringify({ ...prev, ...summary }, null, 1) + '\n');
}
console.log(JSON.stringify({ referenceAc01: { ...summary.referenceAc01, hookHeadUnmaskedByBar: summary.referenceAc01.hookHeadUnmaskedByBar.map((x) => x.unmaskedShare) },
  ...Object.fromEntries(slugs.map((s) => [s, brief(summary[s])])) }, null, 1));
