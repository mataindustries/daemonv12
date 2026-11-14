/**
 * FABLE mix helpers: small, deterministic buffer operations used by the two candidates' mix functions.
 * Loop handling: a stem is rendered once with its tail and folded to exactly one loop (the tail lands on the start).
 * Everything stateful (filters, DAEMON//CRUSH, the room) then runs on an extended buffer, the loop's last seconds,
 * the loop, and its first half second, so every processor is in its steady state when the loop starts and
 * the last frame of the loop continues into the first.
 */
import { crush, type Stereo, type CrushOptions } from '../crush/crush.ts';
import { ampDb, dbAmp, peak, rms } from '../crush/measure.ts';
import { fdnReverb, Biquad } from '../../mutation-001/tools/dsp.ts';

export const SR = 44100;
export interface Ctx {
  loop: number;              // frames in one loop
  pre: number; post: number; // frames of lead-in (the loop's end) and lead-out (the loop's start)
  bpm: number;
  /** kick onsets in frames inside one loop */
  kicks: number[];
}
export const silence = (n: number): Stereo => [new Float64Array(n), new Float64Array(n)];
/** Fold everything after `loop` frames back onto the start: the steady state of the one-shot retriggered every loop. */
export function fold(x: Stereo, loop: number): Stereo {
  if (x[0].length < loop || x[0].length > 2 * loop) throw new Error(`fold: ${x[0].length} frames for a ${loop}-frame loop`);
  return x.map(c => { const y = c.slice(0, loop); for (let i = loop; i < c.length; i++) y[i - loop] = y[i - loop]! + c[i]!; return y; }) as Stereo;
}
/** Loop -> extended buffer [last `pre` frames][loop][first `post` frames]. */
export function extend(x: Stereo, c: Ctx): Stereo {
  return x.map(ch => { const y = new Float64Array(c.pre + c.loop + c.post); for (let i = 0; i < y.length; i++) y[i] = ch[(((i - c.pre) % c.loop) + c.loop) % c.loop]!; return y; }) as Stereo;
}
export const cut = (x: Stereo, c: Ctx): Stereo => [x[0].slice(c.pre, c.pre + c.loop), x[1].slice(c.pre, c.pre + c.loop)];

export function sum(...xs: Stereo[]): Stereo {
  const n = Math.max(...xs.map(x => x[0].length)), y = silence(n);
  for (const x of xs) for (let c = 0; c < 2; c++) for (let i = 0; i < x[c]!.length; i++) y[c]![i] = y[c]![i]! + x[c]![i]!;
  return y;
}
export const gainDb = (x: Stereo, db: number): Stereo => { const g = dbAmp(db); return [x[0].map(v => v * g), x[1].map(v => v * g)]; };
/** Static gain that puts the largest sample at `db` dBFS. */
export const toPeak = (x: Stereo, db: number): Stereo => { const p = peak(x); return p > 0 ? gainDb(x, db - ampDb(p)) : x; };
/** Static gain that puts the RMS of the whole buffer at `db` dBFS. */
export const toRms = (x: Stereo, db: number): Stereo => { const r = rms(x); return r > 0 ? gainDb(x, db - ampDb(r)) : x; };
export const mono = (x: Stereo): Stereo => { const m = x[0].map((v, i) => 0.5 * (v + x[1][i]!)); return [m, m.slice()]; };
/** Mid/side width: 0 mono, 1 unchanged, above 1 wider. */
export const width = (x: Stereo, w: number): Stereo => {
  const l = new Float64Array(x[0].length), r = new Float64Array(x[0].length);
  for (let i = 0; i < l.length; i++) { const m = 0.5 * (x[0][i]! + x[1][i]!), s = 0.5 * (x[0][i]! - x[1][i]!) * w; l[i] = m + s; r[i] = m - s; }
  return [l, r];
};
function filter(x: Stereo, kind: 'hp' | 'lp' | 'peak' | 'highshelf' | 'lowshelf', f: number, q = Math.SQRT1_2, db = 0, passes = 1): Stereo {
  return x.map(ch => { let y = ch; for (let p = 0; p < passes; p++) { const b = new Biquad(kind, f, q, db), z = new Float64Array(y.length); for (let i = 0; i < y.length; i++) z[i] = b.tick(y[i]!); y = z; } return y; }) as Stereo;
}
/** Butterworth high-pass / low-pass; `steep` cascades two sections (24 dB per octave, Linkwitz-Riley). */
export const hp = (x: Stereo, f: number, steep = false) => filter(x, 'hp', f, Math.SQRT1_2, 0, steep ? 2 : 1);
export const lp = (x: Stereo, f: number, steep = false) => filter(x, 'lp', f, Math.SQRT1_2, 0, steep ? 2 : 1);
export const bell = (x: Stereo, f: number, db: number, q = 1) => filter(x, 'peak', f, q, db);
export const shelfHi = (x: Stereo, f: number, db: number) => filter(x, 'highshelf', f, Math.SQRT1_2, db);
export const shelfLo = (x: Stereo, f: number, db: number) => filter(x, 'lowshelf', f, Math.SQRT1_2, db);

/**
 * DAEMON//CRUSH on a bus. The bus is brought to the processor's -3 dBFS reference first; `driveDb` pushes it past
 * the reference (harder distortion). The result is returned at the input's RMS, so crushing never changes a bus's
 * place in the balance; levels are set separately.
 */
export function crushed(x: Stereo, amount: number, driveDb = 0, options: Partial<CrushOptions> = {}): Stereo {
  const p = peak(x); if (!(p > 0) || amount <= 0) return x;
  const y = crush(gainDb(x, -3 + driveDb - ampDb(p)), { amount, ceilingDb: -1, referenceDb: -3, ...options }).audio;
  return toRms(y, ampDb(rms(x)));
}
/** Soft-clip a bus at `ceilingDb` with the DAEMON//CRUSH clipper alone (oversampled; the knee starts 4 dB under the ceiling). */
export const clipTo = (x: Stereo, ceilingDb: number): Stereo => crush(x, { amount: 1, ceilingDb, drive: false, squeeze: false }).audio;
/**
 * Kick-keyed gain: a sidechain pump without a sidechain. From 4 ms before each kick the gain falls to -depthDb,
 * holds, then eases back over `releaseMs`. Deterministic and independent of the audio it is applied to.
 */
export function pump(x: Stereo, c: Ctx, depthDb: number, releaseMs = 190, holdMs = 35): Stereo {
  const n = x[0].length, env = new Float64Array(n).fill(0), fall = Math.round(0.004 * SR), hold = Math.round(holdMs * SR / 1000), rel = Math.round(releaseMs * SR / 1000);
  for (let k = -2; k <= 2; k++) for (const kick of c.kicks) {
    const at = kick + c.pre + k * c.loop;
    for (let i = Math.max(0, at - fall); i < Math.min(n, at + hold + rel); i++) {
      const t = i - at; let d: number;
      if (t < 0) d = 1 + t / fall; else if (t < hold) d = 1; else { const u = (t - hold) / rel; d = (Math.exp(-3.5 * u) - Math.exp(-3.5)) / (1 - Math.exp(-3.5)); } // a compressor's exponential release, reaching zero at the end
      if (d > env[i]!) env[i] = d;
    }
  }
  return x.map(ch => ch.map((v, i) => v * dbAmp(-depthDb * env[i]!))) as Stereo;
}
/** Wet-only room from the frozen HEADLINER FDN, same length as the input. */
export function room(x: Stereo, rt60: number, lowCut = 300, seed = 2099): Stereo {
  const [l, r] = fdnReverb(x[0], x[1], { rt60, size: 0.9, damp: 5200, predelayMs: 14, lowCut, mod: 1, seed }, 0);
  return [l.slice(0, x[0].length), r.slice(0, x[0].length)];
}
/** Mute a bus between two beats of the loop (a hard cut with 3 ms edges): the dramatic silence. */
export function muteBeats(x: Stereo, c: Ctx, fromBeat: number, toBeat: number): Stereo {
  const f = (b: number) => Math.round(b * 60 / c.bpm * SR), a = f(fromBeat), z = f(toBeat), e = Math.round(0.003 * SR);
  return x.map(ch => ch.map((v, i) => { const t = (((i - c.pre) % c.loop) + c.loop) % c.loop; if (t < a - e || t >= z + e) return v; if (t < a) return v * (a - t) / e; if (t >= z) return v * (t - z) / e; return 0; })) as Stereo;
}
