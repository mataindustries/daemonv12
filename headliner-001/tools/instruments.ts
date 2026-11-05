/**
 * HEADLINER 001 instrument patches. Every sound is computed from the numbers in this file and dsp.ts.
 * No recordings, samples, SoundFonts, impulse responses or presets are read. Each function returns
 * float channels (1 = mono, 2 = stereo) at 44.1 kHz; the build normalizes per instrument family.
 */
import {
  SR, TAU, Rng, Osc, SVF, Ladder, OnePole, Biquad, DelayLine, midiHz, dbAmp, clamp, lerp, smooth, cents,
  sineFold, triFold, tube, white, pink, brown, drift, fdnReverb, pingPong, chorus, decimate, zeros, addInto,
  scale, dcBlock, edgeFade, type Wave,
} from './dsp.ts';

const exp = (t: number, tau: number) => Math.exp(-t / tau);
const n = (sec: number, os = 1) => Math.round(sec * SR * os);

// ============================================================ DRUMS
export interface KickOpts { f0?: number; len?: number; decay?: number; punch?: number; click?: number; drive?: number; start?: number; seed?: number }
/** Tuned kick: two-stage exponential pitch drop onto F1, beater click, tanh drive (2x oversampled). */
export function kick(o: KickOpts = {}): Wave[] {
  const os = 2, fs = SR * os, f0 = o.f0 ?? midiHz(29), len = o.len ?? 0.62, decay = o.decay ?? 0.3, drive = o.drive ?? 1.7;
  const N = n(len, os), y = new Float64Array(N), rng = new Rng(o.seed ?? 11), start = o.start ?? 300;
  const hp = new SVF(fs).set(2600, 0.7);
  let ph = 0;
  for (let i = 0; i < N; i++) {
    const t = i / fs;
    const f = f0 + (start - f0) * (0.55 * exp(t, 0.0045) + 0.45 * exp(t, 0.038));
    ph += f / fs;
    const amp = (t < 0.012 ? 1 : exp(t - 0.012, decay)) * Math.min(1, t / 0.0004);
    let v = Math.sin(TAU * ph) * amp * (o.punch ?? 1);
    hp.tick(rng.bi());
    v += (o.click ?? 1) * (hp.hp * 0.5 * exp(t, 0.0025) + 0.32 * Math.sin(TAU * 3100 * t) * exp(t, 0.0013) + 0.22 * Math.sin(TAU * 1450 * t) * exp(t, 0.004));
    y[i] = Math.tanh(drive * v) / Math.tanh(drive);
  }
  const out = decimate(y, os), lp = new Biquad('lp', 9500, 0.6);
  for (let i = 0; i < out.length; i++) out[i] = lp.tick(out[i]!);
  return [edgeFade(dcBlock(out, 8), 0.0002, 0.03)];
}

export interface SnareOpts { body?: number; noise?: number; clap?: number; room?: number; len?: number; tone?: number; decay?: number; seed?: number; snap?: number; verb?: number }
/** West Coast snare: tuned two-mode body, band-passed noise, optional clap bursts and FDN room. */
export function snare(o: SnareOpts = {}): Wave[] {
  const len = o.len ?? 0.55, N = n(len), rng = new Rng(o.seed ?? 21), dry = new Float64Array(N);
  const tone = o.tone ?? 1, bp = new SVF().set(4200, 0.75), hp = new SVF().set(1100, 0.7), clapBp = new SVF().set(1350, 1.4), snapHp = new SVF().set(5200, 0.7);
  let p1 = 0, p2 = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR, bend = 1 + 0.28 * exp(t, 0.012);
    p1 += 182 * tone * bend / SR; p2 += 287 * tone * bend / SR;
    const body = (Math.sin(TAU * p1) * exp(t, 0.055) + 0.55 * Math.sin(TAU * p2) * exp(t, 0.04)) * (o.body ?? 1) * Math.min(1, t / 0.0006);
    const w = rng.bi(); bp.tick(w); hp.tick(bp.lp + bp.bp * 0.6 + w * 0.25);
    const nz = hp.hp * (0.85 * exp(t, o.decay ?? 0.085) + 0.25 * exp(t, 0.21)) * (o.noise ?? 1) * Math.min(1, t / 0.0008);
    snapHp.tick(w); const snap = snapHp.hp * exp(t, 0.0025) * (o.snap ?? 0.6);
    let clap = 0;
    if (o.clap) {
      clapBp.tick(rng.bi());
      let e = 0; for (const off of [0, 0.0095, 0.0185, 0.029]) if (t >= off) e = Math.max(e, exp(t - off, 0.0042));
      e = Math.max(e * 0.9, t > 0.029 ? 0.55 * exp(t - 0.029, 0.075) : 0);
      clap = clapBp.bp * 2.2 * e * o.clap;
    }
    dry[i] = Math.tanh(1.4 * (body * 0.75 + nz * 0.7 + snap + clap));
  }
  const room = o.room ?? 0.16, verb = o.verb ?? 0;
  const [rl, rr] = fdnReverb(dry, dry, { rt60: 0.42, size: 0.42, damp: 7200, predelayMs: 2.5, mod: 0.5, lowCut: 220, seed: 31 }, 0);
  let L = new Float64Array(N), R = new Float64Array(N);
  for (let i = 0; i < N; i++) { L[i] = dry[i]! + rl[i]! * room; R[i] = dry[i]! + rr[i]! * room; }
  if (verb > 0) {
    const tail = 2.2, [vl, vr] = fdnReverb(dry, dry, { rt60: 2.1, size: 1.1, damp: 5200, predelayMs: 18, mod: 1, lowCut: 300, seed: 37 }, tail);
    const M = N + n(tail), L2 = new Float64Array(M), R2 = new Float64Array(M);
    L2.set(L); R2.set(R); for (let i = 0; i < M; i++) { L2[i] = L2[i]! + vl[i]! * verb; R2[i] = R2[i]! + vr[i]! * verb; }
    L = L2; R = R2;
  }
  return [edgeFade(dcBlock(L, 20), 0.0002, 0.04), edgeFade(dcBlock(R, 20), 0.0002, 0.04)];
}
/** Rimshot / stick click for ghost notes. */
export function rim(seed = 41): Wave[] {
  const N = n(0.12), y = new Float64Array(N), rng = new Rng(seed), bp = new SVF().set(2600, 2.5);
  for (let i = 0; i < N; i++) {
    const t = i / SR; bp.tick(rng.bi());
    y[i] = Math.tanh(2 * ((Math.sin(TAU * 1720 * t) * 0.6 + Math.sin(TAU * 870 * t) * 0.5) * exp(t, 0.011) + bp.bp * 0.9 * exp(t, 0.006)));
  }
  return [edgeFade(dcBlock(y, 40), 0.0002, 0.01)];
}
const METAL = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0];
/** Square-cluster metal (generic analog cymbal method) through band-pass; closed/open by decay. */
export function hat(decay: number, len: number, bright = 1, seed = 51): Wave[] {
  const os = 2, fs = SR * os, N = n(len, os), y = new Float64Array(N), rng = new Rng(seed);
  const oscs = METAL.map((f, k) => ({ o: new Osc(rng.next(), fs), f: f * 1.62 * (1 + 0.003 * k) }));
  const bp = new SVF(fs).set(9400 * bright, 1.1), hp = new SVF(fs).set(6800 * bright, 0.7);
  for (let i = 0; i < N; i++) {
    const t = i / fs; let m = 0; for (const { o, f } of oscs) m += o.pulse(f, 0.5);
    bp.tick(m * 0.2 + rng.bi() * 0.25); hp.tick(bp.bp);
    y[i] = hp.hp * (exp(t, decay) * 0.9 + 0.1 * exp(t, decay * 3)) * Math.min(1, t / 0.0005);
  }
  return [edgeFade(dcBlock(decimate(y, os), 200), 0.0001, Math.min(0.03, len / 4))];
}
export function shaker(seed = 61): Wave[] {
  const N = n(0.13), y = new Float64Array(N), rng = new Rng(seed), bp = new SVF().set(6800, 1.2);
  for (let i = 0; i < N; i++) { const t = i / SR; bp.tick(rng.bi()); y[i] = bp.bp * Math.min(1, t / 0.006) * exp(Math.max(0, t - 0.006), 0.035); }
  return [edgeFade(y, 0.0001, 0.02)];
}
/** Lowrider hydraulics: pneumatic hiss sweeping down plus a low piston thump; stereo hiss. */
export function hydraulic(seed = 71): Wave[] {
  const N = n(0.42), L = new Float64Array(N), R = new Float64Array(N), rng = new Rng(seed);
  const bl = new SVF(), br = new SVF(); let ph = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR, fc = 2100 + 5200 * exp(t, 0.07);
    if (i % 16 === 0) { bl.set(fc, 2.2); br.set(fc * 1.06, 2.2); }
    bl.tick(rng.bi()); br.tick(rng.bi());
    const env = Math.min(1, t / 0.003) * exp(t, 0.11);
    ph += (52 + 46 * exp(t, 0.025)) / SR;
    const thump = Math.sin(TAU * ph) * exp(t, 0.055) * 0.7;
    L[i] = bl.bp * env * 1.6 + thump; R[i] = br.bp * env * 1.6 + thump;
  }
  return [edgeFade(L, 0.0002, 0.04), edgeFade(R, 0.0002, 0.04)];
}
/** Tiny machine tick (2-9 kHz) for the straight-grid machine layer. */
export function tick(seed = 81): Wave[] {
  const N = n(0.06), y = new Float64Array(N), rng = new Rng(seed), bp = new SVF().set(5200, 3);
  for (let i = 0; i < N; i++) { const t = i / SR; bp.tick(rng.bi()); y[i] = (bp.bp * 1.4 + Math.sin(TAU * 7300 * t) * 0.25) * exp(t, 0.0055); }
  return [edgeFade(y, 0.0001, 0.01)];
}
/** Modal metal strike: inharmonic bar modes, tuned. */
export function modal(f: number, ratios: number[], decays: number[], amps: number[], len: number, strike = 0.4, seed = 91, bright = 1): Wave[] {
  const N = n(len), L = new Float64Array(N), R = new Float64Array(N), rng = new Rng(seed), hp = new SVF().set(2500 * bright, 0.7);
  const ph = ratios.map(() => rng.next());
  for (let i = 0; i < N; i++) {
    const t = i / SR; let l = 0, r = 0;
    for (let k = 0; k < ratios.length; k++) {
      const fk = f * ratios[k]!; if (fk > SR * 0.45) continue;
      const a = amps[k]! * exp(t, decays[k]!);
      l += a * Math.sin(TAU * (fk * t + ph[k]!)); r += a * Math.sin(TAU * (fk * 1.0011 * t + ph[k]! + 0.13 * k));
    }
    hp.tick(rng.bi()); const s = hp.hp * strike * exp(t, 0.003) * Math.min(1, t / 0.0003);
    L[i] = Math.tanh(l + s); R[i] = Math.tanh(r + s);
  }
  return [edgeFade(L, 0.0002, 0.05), edgeFade(R, 0.0002, 0.05)];
}
/** Chain rattle: a burst of small metallic contacts. */
export function chain(seed = 101): Wave[] {
  const N = n(0.5), L = zeros(N), R = zeros(N), rng = new Rng(seed);
  let t0 = 0;
  for (let k = 0; k < 11; k++) {
    t0 += 0.006 + rng.next() * 0.022 * (1 + k * 0.18);
    const f = 2600 + rng.next() * 4200, amp = 0.9 * Math.pow(0.8, k), pan = rng.bi() * 0.6;
    const [m] = modal(f, [1, 1.47, 2.09], [0.018, 0.012, 0.008], [1, 0.6, 0.4], 0.08, 0.5, 200 + k);
    addInto(L, m!, n(t0), amp * (1 - Math.max(0, pan))); addInto(R, m!, n(t0), amp * (1 + Math.min(0, pan)));
  }
  return [edgeFade(L, 0.0002, 0.05), edgeFade(R, 0.0002, 0.05)];
}
/** Pitched tom/pipe: sine drop with breath noise. */
export function tom(f: number, len = 0.6, seed = 111): Wave[] {
  const N = n(len), y = new Float64Array(N), rng = new Rng(seed), bp = new SVF().set(f * 3, 1.5); let ph = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR; ph += f * (1 + 0.45 * exp(t, 0.03)) / SR; bp.tick(rng.bi());
    y[i] = Math.tanh(1.5 * (Math.sin(TAU * ph) * exp(t, 0.16) + bp.bp * 0.35 * exp(t, 0.02)));
  }
  return [edgeFade(y, 0.0002, 0.04)];
}
/** Servo chirp: short rising FM motion, the city machinery. */
export function servo(seed = 121): Wave[] {
  const N = n(0.26), L = new Float64Array(N), R = new Float64Array(N); let pc = 0, pm = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR, f = 380 + 1400 * smooth(t / 0.2); pm += f * 2.01 / SR; pc += (f + 900 * Math.sin(TAU * pm) * exp(t, 0.08)) / SR;
    const e = Math.min(1, t / 0.01) * exp(t, 0.07), v = Math.sin(TAU * pc) * e * 0.6;
    L[i] = v * (1 - 0.4 * t / 0.26); R[i] = v * (0.6 + 0.4 * t / 0.26);
  }
  return [edgeFade(L, 0.0002, 0.03), edgeFade(R, 0.0002, 0.03)];
}

// ============================================================ BASS
/** West Coast round bass: sine fundamental plus a saw through a gently driven ladder whose short filter
 *  envelope gives each note a soft "bwom"; harmonics to ~400 Hz so the line survives small speakers. Mono. */
export function bassWarm(midi: number, len = 3.0, bright = 1, seed = 125): Wave[] {
  const os = 2, fs = SR * os, f = midiHz(midi), N = n(len, os), y = new Float64Array(N), saw = new Osc(0, fs), lad = new Ladder(fs);
  let ph = 0;
  for (let i = 0; i < N; i++) {
    const t = i / fs; ph += f / fs;
    if (i % 8 === 0) lad.set(f * (2.2 + 6 * bright * exp(t, 0.07)) + 60);
    const harm = lad.tick(saw.saw(f), 0.9, 1.3);
    const v = Math.sin(TAU * ph) * 0.85 + harm * 0.55 * bright;
    const amp = Math.min(1, t / 0.0025) * (0.82 + 0.18 * exp(t, 0.18)) * exp(t, 7);
    y[i] = Math.tanh(1.35 * v) * amp;
  }
  return [edgeFade(dcBlock(decimate(y, os), 10), 0.0001, 0.05)];
}
/** Clean sub: sine with a little second harmonic for translation; slow decay; mono. */
export function sub(midi: number, len = 3.2): Wave[] {
  const f = midiHz(midi), N = n(len), y = new Float64Array(N); let ph = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR; ph += f / SR;
    const s = Math.sin(TAU * ph);
    y[i] = Math.tanh(1.25 * (s + 0.06 * Math.sin(2 * TAU * ph))) * (0.88 + 0.12 * exp(t, 0.25)) * exp(t, 9) * Math.min(1, t / 0.002);
  }
  return [edgeFade(y, 0.0001, 0.05)];
}
/** Industrial grit bass: detuned saws + pulse through a driven ZDF ladder, West Coast sine folder and tube stage.
 *  `pluck` closes the filter quickly; otherwise a slow growl keeps moving. High-passed to leave the sub alone. */
export function grit(midi: number, pluck: boolean, len = 2.6, seed = 131): Wave[] {
  const os = 4, fs = SR * os, f = midiHz(midi), N = n(len, os), y = new Float64Array(N), rng = new Rng(seed + midi);
  const o1 = new Osc(0, fs), o2 = new Osc(rng.next(), fs), o3 = new Osc(rng.next(), fs), lad = new Ladder(fs);
  const wob = drift(N, seed + midi * 7, 2.2, fs);
  for (let i = 0; i < N; i++) {
    const t = i / fs;
    const env = pluck ? exp(t, 0.11) : 0.45 + 0.55 * exp(t, 0.35);
    const move = pluck ? 0 : 0.5 + 0.5 * Math.sin(TAU * 0.9 * t + 1.3) * 0.6 + wob[i]! * 0.25;
    if (i % 8 === 0) lad.set(f * (1.6 + 10 * env + 5 * move));
    const src = o1.saw(f) * 0.5 + o2.saw(f * cents(9)) * 0.4 + o3.pulse(f * 0.5, 0.32) * 0.45;
    let v = lad.tick(src, 2.4, 1.8);
    v = sineFold(v, 1.2 + 1.1 * env + 0.6 * move);
    v = tube(v, 2.2, 0.2);
    const amp = Math.min(1, t / 0.003) * (pluck ? 0.25 + 0.75 * exp(t, 0.35) : 1) * exp(t, 6);
    y[i] = v * amp;
  }
  let out = decimate(y, os);
  const hp1 = new Biquad('hp', 95, 0.75), hp2 = new Biquad('hp', 95, 0.75), lp = new Biquad('lp', 5200, 0.7), mid = new Biquad('peak', 900, 0.8, 3);
  out = out.map(v => mid.tick(lp.tick(hp2.tick(hp1.tick(v)))));
  return [edgeFade(out, 0.0002, 0.05)];
}

// ============================================================ THE MACHINE: low-pass-gate pluck
/** Buchla-style complex oscillator into a sine folder and a vactrol low-pass gate. Woody, organic decay.
 *  The vactrol level falls quickly and then lingers (time constant grows as it dims). */
export function lpgPluck(midi: number, len = 1.7, ratio = 2, seed = 141, bright = 1): Wave[] {
  const os = 2, fs = SR * os, f = midiHz(midi), N = n(len, os), y = new Float64Array(N), rng = new Rng(seed + midi);
  const mod = new Osc(0, fs), car = new Osc(0, fs), lpg = new SVF(fs), lpg2 = new SVF(fs);
  let lev = 0;
  for (let i = 0; i < N; i++) {
    const t = i / fs;
    if (t < 0.0016) lev += (1 - lev) * 0.02; else lev -= lev / (fs * 0.07 * (1 + 5.5 * (1 - lev)));
    const idx = 2.2 * lev + 0.15, m = mod.sine(f * ratio);
    const c = Math.sin(TAU * car.phase + idx * m); car.sine(f);
    const folded = sineFold(c * (0.55 + 1.5 * lev * bright), 1);
    const strike = rng.bi() * 0.25 * exp(t, 0.002);
    if (i % 8 === 0) { const fc = 90 + 7800 * bright * Math.pow(lev, 1.7); lpg.set(fc, 0.8); lpg2.set(fc * 1.4, 0.6); }
    y[i] = lpg2.tick(lpg.tick(folded + strike)) * Math.pow(lev, 1.05);
  }
  return [edgeFade(dcBlock(decimate(y, os), 30), 0.0001, 0.05)];
}

// ============================================================ THE VOICE: synthetic talkbox
export type Vowel = 'a' | 'o' | 'u' | 'e' | 'i' | 'ae' | 'er';
/** Textbook adult formant averages (F1..F5 Hz, bandwidths Hz, relative dB), scaled for a higher voice. */
const VOWELS: Record<Vowel, [number[], number[], number[]]> = {
  a: [[800, 1150, 2800, 3500, 4500], [90, 110, 140, 180, 220], [0, -4, -12, -18, -26]],
  o: [[600, 900, 2700, 3400, 4400], [80, 100, 140, 180, 220], [0, -6, -18, -24, -30]],
  u: [[350, 900, 2500, 3300, 4300], [70, 90, 130, 170, 220], [0, -10, -24, -30, -34]],
  e: [[560, 1900, 2700, 3600, 4500], [80, 110, 140, 180, 220], [0, -7, -12, -18, -26]],
  i: [[300, 2400, 3100, 3700, 4600], [70, 110, 140, 180, 220], [0, -14, -15, -20, -28]],
  ae: [[720, 1750, 2600, 3500, 4500], [90, 110, 140, 180, 220], [0, -5, -12, -18, -26]],
  er: [[520, 1400, 1800, 3300, 4400], [80, 100, 120, 170, 220], [0, -6, -10, -20, -28]],
};
export interface VNote { t: number; d: number; p: number; v?: number; vowel?: Vowel; to?: Vowel; slide?: number; vib?: number; fall?: number; scoop?: number }
export interface VoiceOpts { tickSec: number; seed?: number; formantScale?: number; breath?: number; buzz?: number; vibRate?: number; vibCents?: number; glideSec?: number; gain?: number; detune?: number }
/**
 * Renders a legato phrase as one continuous performance: exponential portamento, delayed vibrato,
 * per-note vowel motion through a five-formant parallel bank, breath at onsets. Returns mono dry.
 * Note times are in engine ticks relative to the phrase start; `tickSec` converts at the song tempo.
 */
export function voicePhrase(notes: VNote[], o: VoiceOpts): Wave {
  const os = 2, fs = SR * os, tickSec = o.tickSec, rng = new Rng(o.seed ?? 151);
  const end = Math.max(...notes.map(x => x.t + x.d)) * tickSec + 0.45, N = n(end, os);
  const y = new Float64Array(N), saw = new Osc(0, fs), pul = new Osc(0.3, fs), sub = new Osc(0, fs);
  const fbank = [0, 1, 2, 3, 4].map(() => new SVF(fs)), fizz = new SVF(fs).set(2600, 0.7), breathBp = new SVF(fs);
  const jitter = drift(N, (o.seed ?? 151) + 3, 6, fs), wander = drift(N, (o.seed ?? 151) + 5, 0.7, fs);
  const sorted = [...notes].sort((a, b) => a.t - b.t);
  const fsc = o.formantScale ?? 1, vibRate = o.vibRate ?? 5.3, vibC = o.vibCents ?? 28, glide = o.glideSec ?? 0.035;
  let pitch = sorted[0]!.p - (sorted[0]!.scoop ?? 1), amp = 0, vibPh = 0, ni = 0, lastNi = -1;
  let F = [...VOWELS.a[0]], B = [...VOWELS.a[1]], G = VOWELS.a[2].map(dbAmp);
  for (let i = 0; i < N; i++) {
    const t = i / fs;
    while (ni + 1 < sorted.length && t >= sorted[ni + 1]!.t * tickSec) ni++;
    const note = sorted[ni]!, ns = note.t * tickSec, ne = (note.t + note.d) * tickSec, prev = sorted[ni - 1];
    const inNote = t >= ns && t < ne, tn = t - ns;
    const legato = !!prev && Math.abs(prev.t + prev.d - note.t) * tickSec < 0.03;
    if (ni !== lastNi && t >= ns) { lastNi = ni; if (!legato && !note.slide) pitch = note.p - (note.scoop ?? 0.5); }
    // pitch: slide (ticks) from the previous pitch, else a short legato glide, else a small scoop from below
    let target = note.p;
    if (note.slide && tn < note.slide * tickSec) {
      const from = prev ? prev.p : note.p - (note.scoop ?? 2), x = smooth(tn / (note.slide * tickSec));
      target = from + (note.p - from) * x;
      pitch = target;
    } else {
      const g = legato ? glide : 0.05;
      pitch += (target - pitch) * (1 - Math.exp(-1 / (g * fs)));
    }
    let fallOff = 0;
    if (note.fall) { const fd = note.fall * tickSec; if (t > ne - fd) fallOff = -2.5 * smooth((t - (ne - fd)) / fd); }
    // vibrato blooms after 170 ms of a held note
    const vd = (note.vib ?? 1) * vibC * smooth((tn - 0.17) / 0.38) * (inNote ? 1 : 0.6);
    vibPh += (vibRate + 0.4 * wander[i]!) / fs;
    const cent = vd * Math.sin(TAU * vibPh) + 6 * wander[i]! + 2.5 * jitter[i]!;
    const f0 = midiHz(pitch + fallOff) * cents(cent + (o.detune ?? 0));
    // amplitude: attack from rest, small dip at re-articulation, release into rests
    const vel = note.v ?? 0.85;
    const nextStart = sorted[ni + 1] ? sorted[ni + 1]!.t * tickSec : Infinity;
    const gap = nextStart - ne > 0.03;
    let targetAmp = 0;
    if (t < ne || (!gap && t < nextStart)) targetAmp = vel * (1 + 0.12 * smooth(tn / Math.max(0.2, ne - ns)));
    if (legato && tn < 0.03) targetAmp *= 0.82 + 0.18 * (tn / 0.03);
    const atk = amp < targetAmp ? (legato ? 0.012 : 0.009) : (t >= ne ? 0.045 : 0.02);
    amp += (targetAmp - amp) * (1 - Math.exp(-1 / (atk * fs)));
    // vowel: move from `vowel` to `to` across the onset (a talkbox "w-ah"), then hold
    if (i % 16 === 0) {
      // Vowel targets follow the note's trajectory; formant state glides toward them (about 22 ms),
      // so a new vowel never jumps (a jump in filter gains is an audible click).
      const va = VOWELS[note.vowel ?? 'a'], vb = VOWELS[note.to ?? note.vowel ?? 'a'];
      const x = smooth(tn / 0.11), bright = 0.85 + 0.3 * vel, c = 1 - Math.exp(-16 / (0.022 * fs));
      for (let k = 0; k < 5; k++) {
        const fk = Math.exp(lerp(Math.log(va[0][k]!), Math.log(vb[0][k]!), x)) * fsc;
        const bk = lerp(va[1][k]!, vb[1][k]!, x) * fsc, gk = dbAmp(lerp(va[2][k]!, vb[2][k]!, x) * (k > 1 ? 1 / bright : 1));
        F[k] = F[k]! + (fk - F[k]!) * c; B[k] = B[k]! + (bk - B[k]!) * c; G[k] = G[k]! + (gk - G[k]!) * c;
        fbank[k]!.set(F[k]!, F[k]! / B[k]!);
      }
      breathBp.set(F[2]!, 1.2);
    }
    const src = saw.saw(f0) * 0.75 + pul.pulse(f0, 0.38) * (o.buzz ?? 0.3) + sub.sine(f0) * 0.25;
    const asp = rng.bi() * ((o.breath ?? 0.05) + 0.5 * Math.max(0, 1 - tn / 0.05) * (legato ? 0.15 : 1));
    let v = 0;
    for (let k = 0; k < 5; k++) { fbank[k]!.tick(src + asp * 0.6); v += fbank[k]!.bpn * G[k]!; }
    fizz.tick(src); breathBp.tick(asp);
    v = v * 1.1 + fizz.hp * 0.05 + breathBp.bpn * 0.5;
    y[i] = tube(v * amp, 1.4, 0.1);
  }
  let out = decimate(y, os);
  const hp = new Biquad('hp', 170, 0.7), pres = new Biquad('peak', 2900, 0.9, 3.5), low = new Biquad('peak', 380, 1.0, -2), lp = new Biquad('lp', 11000, 0.7);
  out = out.map(v => lp.tick(pres.tick(low.tick(hp.tick(v)))));
  scale(out, o.gain ?? 1);
  return edgeFade(out, 0.0005, 0.05);
}
/** The city sings: a melody rendered by several formant voices (independent seed, vibrato, detune and a few ms of
 *  timing spread), spread across the stereo field, with a baked hall. `octave` shifts the whole line. Stereo. */
export function ensemblePhrase(notes: VNote[], o: VoiceOpts, voices = 4, octave = -12, spreadMs = 12, hall = 0.45): Wave[] {
  const rng = new Rng((o.seed ?? 401) + 7); let L = new Float64Array(0), R = new Float64Array(0);
  const takes: { w: Wave; pan: number; off: number }[] = [];
  for (let k = 0; k < voices; k++) {
    const shifted = notes.map(x => ({ ...x, p: x.p + octave, vib: (x.vib ?? 1) * (0.7 + 0.5 * rng.next()) }));
    const w = voicePhrase(shifted, { ...o, seed: (o.seed ?? 401) + 31 * k, detune: rng.bi() * 10, vibRate: (o.vibRate ?? 5.3) * (0.9 + 0.2 * rng.next()), formantScale: (o.formantScale ?? 1) * (0.95 + 0.08 * rng.next()), gain: 0.4 });
    takes.push({ w, pan: voices === 1 ? 0 : (k / (voices - 1)) * 1.5 - 0.75, off: n(rng.next() * spreadMs / 1000) });
  }
  const len = Math.max(...takes.map(t => t.w.length + t.off)); L = new Float64Array(len); R = new Float64Array(len);
  for (const { w, pan, off } of takes) for (let i = 0; i < w.length; i++) { L[i + off] += w[i]! * (1 - Math.max(0, pan)); R[i + off] += w[i]! * (1 + Math.min(0, pan)); }
  const [vl, vr] = fdnReverb(L, R, { rt60: 3.0, size: 1.25, damp: 4600, predelayMs: 24, mod: 1.4, lowCut: 240, seed: (o.seed ?? 401) + 3 }, 3.2);
  const M = vl.length, OL = new Float64Array(M), OR = new Float64Array(M);
  for (let i = 0; i < M; i++) { OL[i] = (L[i] ?? 0) + vl[i]! * hall; OR[i] = (R[i] ?? 0) + vr[i]! * hall; }
  return [edgeFade(OL, 0.001, 0.3), edgeFade(OR, 0.001, 0.3)];
}
/** Wet-only space for a dry mono part: damped FDN hall plus a dotted-eighth ping-pong. */
export function spaceFor(dry: Wave, beatSec: number, o: { rt60?: number; verb?: number; delay?: number; fb?: number; predelayMs?: number; seed?: number; damp?: number } = {}): Wave[] {
  const [rl, rr] = fdnReverb(dry, dry, { rt60: o.rt60 ?? 2.6, size: 1.15, damp: o.damp ?? 5200, predelayMs: o.predelayMs ?? 26, mod: 1.2, lowCut: 260, seed: o.seed ?? 161 }, (o.rt60 ?? 2.6) * 1.2);
  const [dl, dr] = pingPong(dry, dry, beatSec * 0.75, o.fb ?? 0.38, 3600, 3.2, 320);
  const M = Math.max(rl.length, dl.length), L = new Float64Array(M), R = new Float64Array(M);
  const vg = o.verb ?? 0.8, dg = o.delay ?? 0.45;
  for (let i = 0; i < M; i++) { L[i] = (rl[i] ?? 0) * vg + (dl[i] ?? 0) * dg; R[i] = (rr[i] ?? 0) * vg + (dr[i] ?? 0) * dg; }
  return [edgeFade(L, 0.001, 0.2), edgeFade(R, 0.001, 0.2)];
}

// ============================================================ HARMONY: keys, strings, choir
/** FM electric piano voice (tine + bark), stereo tremolo; chord = several voices with a tiny strum. */
export function epChord(midis: number[], len = 3.6, vel = 0.8, seed = 171): Wave[] {
  const N = n(len), L = new Float64Array(N), R = new Float64Array(N), rng = new Rng(seed);
  midis.forEach((m, k) => {
    const f = midiHz(m), off = n(0.004 * k + rng.next() * 0.003), dec = 1.9 * Math.pow(220 / f, 0.35);
    let pc = rng.next() * 0.1, pm = 0;
    for (let i = 0; i + off < N; i++) {
      const t = i / SR; pm += f / SR;
      const idx = (1.5 * vel * exp(t, 0.2) + 0.12) * Math.pow(261 / f, 0.25);
      pc += f / SR;
      const tine = Math.sin(TAU * pc + idx * Math.sin(TAU * pm));
      const bark = Math.sin(TAU * f * 13.98 * t) * 0.09 * vel * exp(t, 0.012);
      const v = tube((tine + bark) * exp(t, dec) * Math.min(1, t / 0.0015), 1.2, 0.08) * 0.32;
      const trem = 0.22 * Math.sin(TAU * 4.6 * t + k * 0.4);
      L[i + off] += v * (1 + trem); R[i + off] += v * (1 - trem);
    }
  });
  const lp = new Biquad('lp', 6800, 0.7), lp2 = new Biquad('lp', 6800, 0.7), hp = new Biquad('hp', 110, 0.7), hp2 = new Biquad('hp', 110, 0.7);
  return [edgeFade(L.map(v => hp.tick(lp.tick(v))), 0.0005, 0.08), edgeFade(R.map(v => hp2.tick(lp2.tick(v))), 0.0005, 0.08)];
}
/** Night strings: six detuned saws per note, slow-breathing low-pass, true L/R decorrelation, baked hall. */
export function padChord(midis: number[], len = 6.2, seed = 181, bright = 1, attack = 0.55): Wave[] {
  const N = n(len), L = new Float64Array(N), R = new Float64Array(N), rng = new Rng(seed);
  const breathe = drift(N, seed + 1, 0.35);
  for (const m of midis) {
    const f = midiHz(m), voices = [-13, -8, -3, 3, 8, 13].map((c, k) => ({ o: new Osc(rng.next()), r: cents(c + rng.bi() * 1.5), side: k % 2 }));
    const fl = new SVF(), fr = new SVF();
    for (let i = 0; i < N; i++) {
      const t = i / SR;
      if (i % 32 === 0) { const fc = (650 + 1500 * bright * (0.6 + 0.4 * breathe[i]!)) * Math.min(1.6, Math.pow(f / 260, 0.3)); fl.set(fc, 0.8); fr.set(fc * 1.04, 0.8); }
      let l = 0, r = 0; for (const v of voices) { const s = v.o.saw(f * v.r); if (v.side) r += s; else l += s; }
      const env = smooth(t / attack) * (0.92 + 0.08 * Math.sin(TAU * 0.21 * t + m));
      L[i] += fl.tick(l) * env * 0.09; R[i] += fr.tick(r) * env * 0.09;
    }
  }
  const [vl, vr] = fdnReverb(L, R, { rt60: 3.2, size: 1.2, damp: 4800, predelayMs: 20, mod: 1.5, lowCut: 200, seed: seed + 2 }, 0);
  const hp = new Biquad('hp', 140, 0.7), hp2 = new Biquad('hp', 140, 0.7);
  for (let i = 0; i < N; i++) { L[i] = hp.tick(L[i]! + vl[i]! * 0.35); R[i] = hp2.tick(R[i]! + vr[i]! * 0.35); }
  return [edgeFade(L, 0.001, 0.3), edgeFade(R, 0.001, 0.3)];
}
/** Synthetic choir chord: four formant voices per note with independent vibrato, baked hall. */
export function choirChord(midis: number[], vowel: Vowel = 'a', len = 7, seed = 191, attack = 0.7, hold = len - 0.6, fade = 0): Wave[] {
  const N = n(len), L = new Float64Array(N), R = new Float64Array(N), rng = new Rng(seed);
  for (const m of midis) for (let k = 0; k < 4; k++) {
    const notes: VNote[] = [{ t: 0, d: Math.round(hold / 0.0006793), p: m, vowel: k % 2 ? 'o' : vowel, to: vowel, vib: 0.55 + 0.3 * rng.next() }];
    const v = voicePhrase(notes, { tickSec: 0.0006793, seed: seed + m * 13 + k, formantScale: 0.97 + 0.06 * rng.next(), breath: 0.08, buzz: 0.12, vibRate: 4.6 + rng.next() * 1.2, vibCents: 16, detune: rng.bi() * 9, gain: 0.25 });
    const pan = (k / 3) * 1.4 - 0.7 + rng.bi() * 0.15, off = n(rng.next() * 0.04);
    for (let i = 0; i < v.length && i + off < N; i++) {
      const t = i / SR, e = smooth(t / attack) * (fade > 0 ? 1 - smooth((t - (hold - fade)) / fade) : 1);
      L[i + off] += v[i]! * e * (1 - Math.max(0, pan)); R[i + off] += v[i]! * e * (1 + Math.min(0, pan));
    }
  }
  const [vl, vr] = fdnReverb(L, R, { rt60: 3.6, size: 1.3, damp: 4200, predelayMs: 30, mod: 1.5, lowCut: 220, seed: seed + 9 }, 0);
  for (let i = 0; i < N; i++) { L[i] = L[i]! + vl[i]! * 0.55; R[i] = R[i]! + vr[i]! * 0.55; }
  return [edgeFade(L, 0.001, 0.4), edgeFade(R, 0.001, 0.4)];
}

// ============================================================ ATMOSPHERE AND FX
/** Night rain over distant traffic: droplets, hiss bed, a low freeway rumble and two passing cars. */
export function rain(len = 24, seed = 201): Wave[] {
  const N = n(len), L = new Float64Array(N), R = new Float64Array(N), rng = new Rng(seed);
  const bedL = pink(N, seed + 1), bedR = pink(N, seed + 2), rum = brown(N, seed + 3), sw = drift(N, seed + 4, 0.15);
  const hl = new Biquad('hp', 500, 0.7), hr = new Biquad('hp', 500, 0.7), ll = new Biquad('lp', 6500, 0.7), lr = new Biquad('lp', 6500, 0.7), rl = new Biquad('lp', 160, 0.7);
  for (let i = 0; i < N; i++) {
    const s = 0.75 + 0.25 * sw[i]!;
    L[i] = ll.tick(hl.tick(bedL[i]!)) * 0.18 * s; R[i] = lr.tick(hr.tick(bedR[i]!)) * 0.18 * s;
    const r = rl.tick(rum[i]!) * 0.8 * (0.7 + 0.3 * sw[i]!); L[i] += r; R[i] += r;
  }
  const drops = Math.round(len * 70);
  for (let k = 0; k < drops; k++) {
    const at = n(rng.next() * (len - 0.05)), f = 1400 + rng.next() * 4800, d = 0.004 + rng.next() * 0.012, a = 0.04 + rng.next() * 0.12, pan = rng.bi();
    const bp = new SVF().set(f, 5), M = n(d * 5);
    for (let i = 0; i < M && at + i < N; i++) { bp.tick(i < 3 ? rng.bi() : 0); const v = bp.bp * a * exp(i / SR, d) * 4; L[at + i] += v * (1 - Math.max(0, pan)); R[at + i] += v * (1 + Math.min(0, pan)); }
  }
  for (const [c, dir] of [[len * 0.28, 1], [len * 0.71, -1]] as const) {
    const bp = new SVF(), dur = 3.2;
    for (let i = 0; i < n(dur); i++) {
      const t = i / SR, x = t / dur, at = n(c - dur / 2) + i; if (at >= N) break;
      if (i % 32 === 0) bp.set(380 + 1100 * Math.sin(Math.PI * x) * (x < 0.5 ? 1 : 0.78), 1.3);
      const v = bp.tick(rng.bi()) * 0.22 * Math.pow(Math.sin(Math.PI * x), 2), p = dir * (x * 2 - 1);
      L[at] += v * (1 - Math.max(0, p)); R[at] += v * (1 + Math.min(0, p));
    }
  }
  return [edgeFade(L, 0.3, 0.3), edgeFade(R, 0.3, 0.3)];
}
/** Sodium lamp: a buzzing, flickering electrical drone tuned to F; the city's pilot light. */
export function lamp(len = 12, seed = 211): Wave[] {
  const N = n(len), L = new Float64Array(N), R = new Float64Array(N), fl = drift(N, seed, 3), f = midiHz(41);
  const bp = new Biquad('bp', 1400, 0.8), bp2 = new Biquad('bp', 1500, 0.8);
  let ph = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR; ph += f / SR;
    let v = 0; for (let h = 1; h <= 9; h++) v += Math.sin(TAU * ph * h + h * h * 0.3) / h * (h % 2 ? 1 : 0.6);
    const fl2 = 0.8 + 0.2 * fl[i]!, e = smooth(t / 2) * smooth((len - t) / 2);
    const buzz = Math.tanh(v * 2.5) * 0.25 * fl2 * e;
    L[i] = buzz * 0.6 + bp.tick(buzz) * 0.8; R[i] = buzz * 0.6 + bp2.tick(buzz) * 0.8;
  }
  return [edgeFade(L, 0.01, 0.1), edgeFade(R, 0.01, 0.1)];
}
/** A distant siren that is secretly the hook's slide contour, far away in a wet hall. */
export function siren(contour: [number, number][], len = 9, seed = 221): Wave[] {
  const N = n(len), y = new Float64Array(N), o1 = new Osc(0), o2 = new Osc(0.25); let pitch = contour[0]![1];
  for (let i = 0; i < N; i++) {
    const t = i / SR; let target = contour[0]![1];
    for (const [ct, cp] of contour) if (t >= ct) target = cp;
    pitch += (target - pitch) * (1 - Math.exp(-1 / (0.22 * SR)));
    const f = midiHz(pitch) * cents(18 * Math.sin(TAU * 4.1 * t) * smooth(t / 1.5));
    y[i] = (o1.sine(f) * 0.7 + o2.tri(f) * 0.3) * smooth(t / 1.2) * smooth((len - 2.4 - t) / 1.6);
  }
  const lp = new Biquad('lp', 1800, 0.7), hp = new Biquad('hp', 300, 0.7), d = y.map(v => hp.tick(lp.tick(v)));
  const [wl, wr] = fdnReverb(d, d, { rt60: 4.8, size: 1.4, damp: 2600, predelayMs: 45, mod: 2, lowCut: 280, seed }, 0);
  return [edgeFade(wl.map((v, i) => v + d[i]! * 0.12), 0.01, 0.5), edgeFade(wr.map((v, i) => v + d[i]! * 0.12), 0.01, 0.5)];
}
/** Cinematic impact: sub drop, noise burst, an F-tuned metal ring and a long hall. */
export function impact(seed = 231): Wave[] {
  const len = 5, N = n(len), dry = new Float64Array(N), rng = new Rng(seed), lp = new SVF().set(2800, 0.7); let ph = 0;
  const ring = modal(midiHz(65), [1, 2.76, 5.4, 8.93, 1.5], [1.4, 0.9, 0.45, 0.25, 1.1], [0.35, 0.25, 0.15, 0.08, 0.2], len, 0.2, seed + 1)[0]!;
  for (let i = 0; i < N; i++) {
    const t = i / SR; ph += (31 + 52 * exp(t, 0.09)) / SR; lp.tick(rng.bi());
    dry[i] = Math.tanh(1.6 * (Math.sin(TAU * ph) * exp(t, 0.9) * Math.min(1, t / 0.001) + lp.lp * 0.7 * exp(t, 0.12) + ring[i]! * 0.5));
  }
  const [wl, wr] = fdnReverb(dry, dry, { rt60: 3.8, size: 1.4, damp: 4000, predelayMs: 10, mod: 1.2, lowCut: 160, seed: seed + 2 }, 0);
  return [edgeFade(dry.map((v, i) => v + wl[i]! * 0.5), 0.0002, 0.4), edgeFade(dry.map((v, i) => v + wr[i]! * 0.5), 0.0002, 0.4)];
}
/** Reverse swell: a chord drowned in a hall, reversed so it breathes in toward a downbeat. */
export function reverseSwell(chord: Wave[], len: number): Wave[] {
  const N = n(len), L0 = chord[0]!.slice(0, n(0.8)), R0 = (chord[1] ?? chord[0]!).slice(0, n(0.8));
  const [wl, wr] = fdnReverb(L0, R0, { rt60: len * 0.9, size: 1.5, damp: 6000, predelayMs: 5, mod: 1.5, lowCut: 200, seed: 241 }, len);
  const L = new Float64Array(N), R = new Float64Array(N);
  for (let i = 0; i < N; i++) { const j = N - 1 - i; L[i] = (wl[j] ?? 0) * smooth(i / (N * 0.6)); R[i] = (wr[j] ?? 0) * smooth(i / (N * 0.6)); }
  return [edgeFade(L, 0.05, 0.004), edgeFade(R, 0.05, 0.004)];
}
/** Signal-loss glitch: a bit-crushed, sample-held burst of the F-minor buzz. */
export function glitch(len = 0.5, seed = 251): Wave[] {
  const N = n(len), L = new Float64Array(N), R = new Float64Array(N), rng = new Rng(seed); let hold = 0, hv = 0, ph = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR; ph += midiHz(53 + 12 * Math.floor(t * 16 % 2)) / SR;
    if (hold-- <= 0) { hold = 6 + Math.floor(rng.next() * 30); hv = Math.round((Math.sin(TAU * ph) * 0.6 + rng.bi() * 0.4) * 6) / 6; }
    const e = (Math.floor(t * 32) % 3 === 2 ? 0.15 : 1) * exp(t, 0.25);
    L[i] = hv * e; R[i] = hv * e * (Math.floor(t * 24) % 2 ? 1 : -0.7);
  }
  return [edgeFade(L, 0.0005, 0.02), edgeFade(R, 0.0005, 0.02)];
}
export { addInto, zeros, scale, dbAmp, midiHz, clamp, white, triFold, chorus, OnePole, DelayLine };
