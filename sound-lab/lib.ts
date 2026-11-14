/**
 * SOUND LAB mix helpers. Small deterministic buffer operations for the GRIND and BOLLO auditions.
 * Nothing here synthesises sound: instruments come from the Signature Rack, the V12 bridge and the BOLLO coin
 * instrument; DAEMON//CRUSH is imported unchanged. No engine, rack, bridge, coin or CRUSH file imports this one.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { crush, type Stereo, type CrushOptions } from '../fable-lab/crush/crush.ts';
import { ampDb, dbAmp, peak, rms, truePeak } from '../fable-lab/crush/measure.ts';
import { bridgeWav } from '../studio-001/v12-bridge/bridge.ts';

// The frozen HEADLINER DSP primitives are loaded at run time (as the rack does), so this lab's type-check never
// re-checks an approved file under stricter settings than it was written for.
type BiquadKind = 'hp' | 'lp' | 'peak' | 'highshelf' | 'lowshelf';
interface FrozenDsp {
  Biquad: new (kind: BiquadKind, f: number, q?: number, gainDb?: number) => { tick(x: number): number };
  fdnReverb(l: Float64Array, r: Float64Array, o: { rt60: number; size?: number; damp?: number; predelayMs?: number; mod?: number; lowCut?: number; seed?: number }, tailSeconds?: number): [Float64Array, Float64Array];
}
const dspPath = '../mutation-001/tools/dsp.ts';
const { Biquad, fdnReverb } = await import(dspPath) as FrozenDsp;

export { ampDb, dbAmp, peak, rms, truePeak };
export type { Stereo };
export const SR = 44100;

export const silence = (n: number): Stereo => [new Float64Array(n), new Float64Array(n)];
export function sum(...xs: Stereo[]): Stereo {
  const n = Math.max(...xs.map(x => x[0].length)), y = silence(n);
  for (const x of xs) for (let c = 0; c < 2; c++) for (let i = 0; i < x[c]!.length; i++) y[c]![i] = y[c]![i]! + x[c]![i]!;
  return y;
}
export const gainDb = (x: Stereo, db: number): Stereo => { const g = dbAmp(db); return [x[0].map(v => v * g), x[1].map(v => v * g)]; };
/** Static gain that puts the largest sample at `db` dBFS. */
export const toPeak = (x: Stereo, db: number): Stereo => { const p = peak(x); return p > 0 ? gainDb(x, db - ampDb(p)) : x; };
export const mono = (x: Stereo): Stereo => { const m = x[0].map((v, i) => 0.5 * (v + x[1][i]!)); return [m, m.slice()]; };
function filter(x: Stereo, kind: BiquadKind, f: number, q = Math.SQRT1_2, db = 0, passes = 1): Stereo {
  return x.map(ch => { let y = ch; for (let p = 0; p < passes; p++) { const b = new Biquad(kind, f, q, db), z = new Float64Array(y.length); for (let i = 0; i < y.length; i++) z[i] = b.tick(y[i]!); y = z; } return y; }) as Stereo;
}
/** Butterworth high-pass / low-pass; `steep` cascades two sections (24 dB per octave). */
export const hp = (x: Stereo, f: number, steep = false) => filter(x, 'hp', f, Math.SQRT1_2, 0, steep ? 2 : 1);
export const lp = (x: Stereo, f: number, steep = false) => filter(x, 'lp', f, Math.SQRT1_2, 0, steep ? 2 : 1);
export const bell = (x: Stereo, f: number, db: number, q = 1) => filter(x, 'peak', f, q, db);
export const shelfHi = (x: Stereo, f: number, db: number) => filter(x, 'highshelf', f, Math.SQRT1_2, db);

/**
 * DAEMON//CRUSH at a calibrated input: the bus peak is brought to the processor's -3 dBFS reference (plus
 * `pushDb` to drive it harder), processed, and returned at the input's RMS so the balance is set elsewhere.
 * `mix` blends the processed signal with the dry one (1 = all processed); CRUSH is zero-latency, so the blend
 * is phase-aligned.
 */
export function crushed(x: Stereo, amount: number, o: { pushDb?: number; mix?: number; options?: Partial<CrushOptions> } = {}): Stereo {
  const p = peak(x); if (!(p > 0) || amount <= 0) return x;
  const wet = crush(gainDb(x, -3 + (o.pushDb ?? 0) - ampDb(p)), { amount, ceilingDb: -1, referenceDb: -3, ...o.options }).audio;
  const level = gainDb(wet, ampDb(rms(x)) - ampDb(rms(wet))), m = o.mix ?? 1;
  return m >= 1 ? level : sum(gainDb(level, ampDb(m)), gainDb(x, ampDb(1 - m)));
}
/** The CRUSH soft clipper alone (4x oversampled, knee 4 dB under the ceiling): a peak stage, no drive or compressor. */
export const clipTo = (x: Stereo, ceilingDb: number): Stereo => crush(x, { amount: 1, ceilingDb, drive: false, squeeze: false }).audio;

/**
 * Keyed duck: from 3 ms before each onset the gain falls by `depthDb`, holds, then releases exponentially.
 * Deterministic and independent of the audio it is applied to (a sidechain without a detector).
 */
export function duck(x: Stereo, onsets: number[], depthDb: number, holdMs: number, releaseMs: number): Stereo {
  const n = x[0].length, env = new Float64Array(n), fall = Math.round(0.003 * SR), hold = Math.round(holdMs * SR / 1000), rel = Math.round(releaseMs * SR / 1000);
  for (const at of onsets) for (let i = Math.max(0, at - fall); i < Math.min(n, at + hold + rel); i++) {
    const t = i - at; let d: number;
    if (t < 0) d = 1 + t / fall; else if (t < hold) d = 1; else { const u = (t - hold) / rel; d = (Math.exp(-3.5 * u) - Math.exp(-3.5)) / (1 - Math.exp(-3.5)); }
    if (d > env[i]!) env[i] = d;
  }
  return x.map(ch => ch.map((v, i) => v * dbAmp(-depthDb * env[i]!))) as Stereo;
}
/** A fader ride: gain moves linearly in dB from `fromDb` at frame `a` to `toDb` at frame `b`, held outside. */
export function ride(x: Stereo, a: number, b: number, fromDb: number, toDb: number): Stereo {
  return x.map(ch => ch.map((v, i) => v * dbAmp(i <= a ? fromDb : i >= b ? toDb : fromDb + (toDb - fromDb) * (i - a) / (b - a)))) as Stereo;
}
/** Wet-only room from the frozen HEADLINER FDN reverb, same length as the input. */
export function room(x: Stereo, rt60: number, lowCut = 300, seed = 2099, predelayMs = 14): Stereo {
  const [l, r] = fdnReverb(x[0], x[1], { rt60, size: 0.9, damp: 5200, predelayMs, lowCut, mod: 1, seed }, 0);
  return [l.slice(0, x[0].length), r.slice(0, x[0].length)];
}
/** `cycles` copies of the first `loop` frames laid end to end; whatever follows `loop` (the tail) rings over the next copy and out at the end. */
export function cycle(x: Stereo, loop: number, cycles: number): Stereo {
  const n = x[0].length, y = silence(loop * (cycles - 1) + n);
  for (let k = 0; k < cycles; k++) for (let c = 0; c < 2; c++) for (let i = 0; i < n; i++) y[c]![k * loop + i] = y[c]![k * loop + i]! + x[c]![i]!;
  return y;
}
/** Fade the last `ms` of a buffer to zero (raised cosine). */
export function fadeOut(x: Stereo, ms: number): Stereo {
  const n = x[0].length, f = Math.min(n, Math.round(ms * SR / 1000));
  return x.map(ch => ch.map((v, i) => i < n - f ? v : v * 0.5 * (1 + Math.cos(Math.PI * (i - (n - f)) / f)))) as Stereo;
}

const ffmpeg = process.env.FFMPEG ?? 'ffmpeg';
/** Write PCM24 WAV (the bridge's writer: refuses clipping, no dither) and optionally a 256 kbps MP3 beside it. */
export function writeAudio(path: string, x: Stereo, withMp3 = true) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bridgeWav(x));
  if (withMp3) {
    const r = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', '-y', '-i', path, '-codec:a', 'libmp3lame', '-b:a', '256k', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', path.replace(/\.wav$/, '.mp3')], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`ffmpeg mp3: ${r.stderr}`);
  }
}
/** EBU R128 integrated loudness, range and true peak of a file (FFmpeg ebur128). */
export function loudness(file: string): { lufs: number; lra: number; truePeakDb: number } {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg ebur128: ${r.stderr}`);
  const s = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  const num = (re: RegExp) => { const m = re.exec(s); return m && m[1] !== '-inf' ? Number(m[1]) : -Infinity; };
  return { lufs: num(/I:\s+(-?[\d.]+|-inf) LUFS/), lra: num(/LRA:\s+(-?[\d.]+) LU/), truePeakDb: num(/Peak:\s+(-?[\d.]+|-inf) dBFS/) };
}
