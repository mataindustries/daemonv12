/**
 * MUTATION B · IMPOSSIBLE VOICE. A phrase sung as one continuous performance by an additive source-filter voice.
 *
 * Every harmonic is its own oscillator whose amplitude is computed, at control rate, from a glottal source tilt times
 * a five-formant cascade (all-pole) envelope evaluated at that harmonic's frequency. Vowels therefore move without
 * filter-coefficient jumps, and the voice can do things a throat cannot, each on its own lane:
 *   stretch   partial n sits at n^(1+stretch) x f0: the harmonic series bends into a bell while the pitch holds
 *   split     every formant divides into two peaks: two throats in one mouth
 *   under     an undertone series (odd multiples of f0/2) grows beneath the voice
 *   whistle   an overtone-singing melody: a narrow emphasis that steps between harmonics (`overtone` lane)
 *   shimmer   vibrato migrates from the pitch into the spectrum (stretch and formant positions oscillate)
 *   even      even harmonics fade: the voice hollows
 *   glass     send to a sympathetic glass resonator bank (glassHalo), voice and breath both excite it
 *   disperse  harmonics detune individually and the high ones linger: the note evaporates
 * plus the human dimensions: breath (pitch-synchronous aspiration), tilt (soft..bright), size (tract scale), vib.
 * Pitch, duration, articulation (scoop, cry, fall, legato slide), vowel path and every timbre dimension are
 * independent inputs. No words, no language, not modelled on any singer. Original code; only dsp.ts primitives.
 */
import { SR, TAU, Rng, SVF, Biquad, midiHz, clamp, smooth, edgeFade, type Wave } from './dsp.ts';
import type { Lane } from './score.ts';

export type VowelName = 'mm' | 'oo' | 'oh' | 'aw' | 'ah' | 'uh' | 'eh' | 'ee';
/** Approximate sung-vowel formants for a mid/high voice (F1..F5 Hz, bandwidths Hz) and a mouth-closure low-pass (Hz). */
const VOWEL: Record<VowelName, [number[], number[], number]> = {
  mm: [[270, 1150, 2400, 3300, 4100], [110, 260, 380, 400, 420], 1000],
  oo: [[330, 780, 2450, 3300, 4100], [60, 80, 100, 130, 160], 9000],
  oh: [[460, 840, 2550, 3350, 4150], [70, 85, 100, 130, 160], 9000],
  aw: [[620, 960, 2600, 3350, 4150], [80, 90, 100, 130, 160], 9000],
  ah: [[760, 1250, 2650, 3400, 4200], [85, 100, 100, 130, 160], 9000],
  uh: [[560, 1250, 2550, 3400, 4150], [75, 95, 100, 130, 160], 9000],
  eh: [[560, 1850, 2650, 3450, 4200], [75, 100, 100, 130, 160], 9000],
  ee: [[310, 2250, 3000, 3600, 4300], [60, 100, 110, 130, 160], 9000],
};

export interface VNote {
  t: number; d: number; p: number; v?: number;
  /** vowel at the onset and the vowel it drifts to across the note (slowly, never an onset sweep) */
  vowel?: VowelName; to?: VowelName;
  /** legato glide time from the previous pitch, seconds (no re-attack) */
  slide?: number;
  /** semitones below to rise from on a fresh onset (default 0.45) */
  scoop?: number;
  /** semitones of upward voice-break overshoot at the onset */
  cry?: number;
  /** semitones to sigh down over the last 0.3 s */
  fall?: number;
}
export interface Breath { t: number; d: number; v?: number; kind: 'in' | 'out' }
export interface VoiceTimbre {
  breath: number; tilt: number; size: number; split: number; stretch: number; under: number; whistle: number;
  glass: number; shimmer: number; even: number; disperse: number; vib: number;
}
export type VKey = keyof VoiceTimbre;
/** Default path from a restrained human-like voice (0) to the alien (1). */
export function voiceMacro(m: number): VoiceTimbre {
  const s = (a: number, b: number) => smooth((m - a) / (b - a));
  return {
    breath: 0.3 - 0.17 * s(0.1, 0.8), tilt: 0.45 + 0.5 * s(0.2, 1), size: 0.12 * s(0.55, 1),
    split: 0.13 * s(0.35, 0.9), stretch: 0.024 * s(0.45, 1), under: 0.55 * s(0.55, 1), whistle: s(0.3, 0.7),
    glass: 0.1 + 0.9 * s(0.25, 0.9), shimmer: s(0.5, 1), even: 1 - 0.7 * s(0.4, 0.95), disperse: 0, vib: 1 - 0.45 * s(0.5, 1),
  };
}
export interface VoiceOpts {
  morph: Lane; over?: Partial<Record<VKey, Lane>>;
  /** harmonic number emphasised by `whistle` (fractional values crossfade neighbouring harmonics) */
  overtone?: Lane;
  breaths?: Breath[];
  seed?: number; tail?: number; detune?: number; vibRate?: number; vibCents?: number; size?: number; vowelTau?: number;
}

const NP = 40, NU = 20, CR = 32;
/** Magnitude of the formant cascade at f: product of unity-DC two-pole resonances, times the mouth low-pass. */
function tract(f: number, F: number[], B: number[], split: number, lp: number): number {
  let h = 1;
  for (let k = 0; k < 5; k++) {
    if (split > 0) {
      for (const sgn of [-1, 1]) { const Fk = F[k]! * (1 + sgn * split), Bk = B[k]! * (1 + 2 * split); h *= Fk * Fk / Math.sqrt((Fk * Fk - f * f) ** 2 + (f * Bk) ** 2); }
      h /= F[k]! / B[k]!; // keep the split pair's level near the single formant's
    } else { const Fk = F[k]!; h *= Fk * Fk / Math.sqrt((Fk * Fk - f * f) ** 2 + (f * B[k]!) ** 2); }
  }
  return h / Math.sqrt(1 + (f / lp) ** 4);
}

export function impossibleVoice(notes: VNote[], o: VoiceOpts): { dry: Wave; send: Wave } {
  const seq = [...notes].sort((a, b) => a.t - b.t), breaths = o.breaths ?? [], rng = new Rng(o.seed ?? 21);
  const end = Math.max(...seq.map(x => x.t + x.d), ...breaths.map(b => b.t + b.d)) + (o.tail ?? 1.5), N = Math.round(end * SR);
  const dry = new Float64Array(N), send = new Float64Array(N);
  const ratio = new Float64Array(NP + NU), phase = new Float64Array(NP + NU), aCur = new Float64Array(NP + NU), aNext = new Float64Array(NP + NU);
  const dn = Float64Array.from({ length: NP + NU }, () => rng.bi()), dph = Float64Array.from({ length: NP + NU }, () => rng.next() * TAU);
  const nf = [0, 1, 2, 3].map(() => new SVF()), air = new SVF().set(5200, 0.7), hp = new Biquad('hp', 85, 0.7), lp = new Biquad('lp', 12000, 0.7);
  const F = [...VOWEL.oo[0]], Bw = [...VOWEL.oo[1]]; let lpv = VOWEL.oo[2];
  const vibRate = o.vibRate ?? 5.2, vibC = o.vibCents ?? 30, vowelTau = o.vowelTau ?? 0.12;
  let ni = -1, pitch = seq[0]!.p, glideC = 0.01, off = 0, offDec = 0.999, level = 0, atkC = 0.001, relC = 0.001, vel = 0.7;
  let vibPh = rng.next(), vibEnv = 0, drift = 0, jit = 0, onsetAt = 0, dipAt = -1, T = voiceMacro(0), m = 0, f0 = midiHz(pitch);
  let breathEnv = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    // ------------------------------------------------------------ note events
    while (ni + 1 < seq.length && t >= seq[ni + 1]!.t) {
      ni++;
      const nt = seq[ni]!, prev = seq[ni - 1], legato = !!prev && prev.t + prev.d >= nt.t - 0.03;
      vel = nt.v ?? 0.7;
      const glide = legato ? (nt.slide ?? 0.06) : 0.02;
      glideC = 1 - Math.exp(-1 / ((glide / 3) * SR));
      if (!legato) { pitch = nt.p; off = nt.cry ? nt.cry : -(nt.scoop ?? 0.45); onsetAt = t; }
      else if (nt.cry) off = nt.cry;
      else dipAt = nt.slide ? -1 : t; // a soft re-articulation for un-slid legato notes
      offDec = Math.exp(-1 / ((nt.cry ? 0.05 : 0.07) * SR));
      atkC = 1 - Math.exp(-1 / ((legato ? 0.03 : 0.07) * SR)); relC = 1 - Math.exp(-1 / (0.14 * SR));
      if (!legato) vibEnv = 0;
    }
    const nt = seq[Math.max(0, ni)]!, tn = t - nt.t, gate = ni >= 0 && t < nt.t + nt.d;
    // ------------------------------------------------------------ pitch
    let target = nt.p;
    if (nt.fall && gate && tn > nt.d - 0.3) target -= nt.fall * smooth((tn - (nt.d - 0.3)) / 0.3);
    pitch += (target - pitch) * glideC; off *= offDec;
    vibEnv += ((gate && tn > 0.22 ? 1 : 0) - vibEnv) * (1 / (0.35 * SR));
    vibPh += vibRate * (1 + 0.06 * Math.sin(TAU * 0.23 * t + 1.1)) / SR;
    const vibS = Math.sin(TAU * vibPh);
    // ------------------------------------------------------------ level
    let lT = gate ? vel * (0.82 + 0.22 * Math.sin(Math.PI * clamp(tn / nt.d, 0, 1))) : 0;
    if (dipAt >= 0 && t - dipAt < 0.06) lT *= 0.8 + 0.2 * (t - dipAt) / 0.06;
    level += (lT - level) * (lT > level ? atkC : relC);
    let bT = 0;
    for (const b of breaths) if (t >= b.t && t < b.t + b.d + 0.1) {
      const x = (t - b.t) / b.d;
      bT = Math.max(bT, (b.v ?? 0.5) * (b.kind === 'in' ? (x < 1 ? smooth(x) * smooth(x) : Math.max(0, 1 - (t - b.t - b.d) / 0.03)) : (x < 1 ? smooth(x * 8) * (1 - smooth(x)) : 0)));
    }
    breathEnv += (bT - breathEnv) * 0.01;
    // ------------------------------------------------------------ control block: vowel, timbre, harmonic amplitudes
    if (i % CR === 0) {
      m = clamp(o.morph(t), 0, 1); T = voiceMacro(m);
      if (o.over) for (const k of Object.keys(o.over) as VKey[]) T[k] = o.over[k]!(t);
      drift = drift * 0.9995 + rng.bi() * 0.02; jit = rng.bi();
      // vowel: drift from `vowel` to `to` across the note; between notes, shape the mouth for the next one
      const upcoming = seq[ni + 1], nextSoon = !gate && upcoming && upcoming.t - t < 0.6;
      const va = VOWEL[(nextSoon ? upcoming!.vowel : nt.vowel) ?? 'oh'], vb = VOWEL[(nextSoon ? upcoming!.vowel : nt.to ?? nt.vowel) ?? 'oh'];
      const x = nextSoon ? 0 : smooth(tn / Math.max(0.2, 0.85 * nt.d)), c = 1 - Math.exp(-CR / (vowelTau * SR));
      for (let k = 0; k < 5; k++) {
        F[k] = F[k]! * Math.pow(Math.exp((1 - x) * Math.log(va[0][k]!) + x * Math.log(vb[0][k]!)) / F[k]!, c);
        Bw[k] = Bw[k]! + ((1 - x) * va[1][k]! + x * vb[1][k]! - Bw[k]!) * c;
      }
      lpv = lpv * Math.pow(Math.exp((1 - x) * Math.log(va[2]) + x * Math.log(vb[2])) / lpv, c);
      const sz = Math.pow(2, 0.6 * (T.size + (o.size ?? 0))) * (1 + 0.035 * T.shimmer * vibS);
      const Fe = F.map(v => v * sz);
      Fe[0] = Math.max(Fe[0]!, 1.08 * f0); // a soprano tunes F1 above the fundamental on high notes
      for (let k = 0; k < 4; k++) nf[k]!.set(Fe[k]!, Fe[k]! / (1.5 * Bw[k]!));
      const st = T.stretch + 0.009 * T.shimmer * vibS, tiltExp = 1.55 - 0.75 * T.tilt, h = o.overtone ? o.overtone(t) : 0;
      let ss = 0;
      for (let j = 0; j < NP + NU; j++) {
        const under = j >= NP, n = under ? (j - NP) + 0.5 : j + 1;
        const r = Math.pow(n, 1 + st) * Math.pow(2, (T.disperse * dn[j]! * (18 + 3 * n) * (1 + 0.5 * Math.sin(0.7 * t + dph[j]!))) / 1200);
        ratio[j] = r;
        const f = f0 * r;
        let a = f > 11000 ? 0 : Math.pow(n, -tiltExp) * tract(f, Fe, Bw, T.split, lpv);
        if (!under && (j + 1) % 2 === 0) a *= T.even;
        if (under) a *= T.under * 0.8;
        aNext[j] = a; ss += a * a;
      }
      const norm = 0.25 / Math.sqrt(ss + 1e-12);
      for (let j = 0; j < NP + NU; j++) {
        let a = aNext[j]! * norm * level;
        if (j < NP && T.whistle > 0) a += T.whistle * 0.12 * level * Math.exp(-(((j + 1 - h) / 0.42) ** 2));
        // release: high harmonics linger as `disperse` grows
        if (a < aCur[j]!) a = aCur[j]! + (a - aCur[j]!) * (1 - Math.exp(-CR / (0.012 * (1 + T.disperse * (j % NP) * 0.35) * SR)));
        aNext[j] = a;
      }
    }
    // ------------------------------------------------------------ oscillators
    const cents = T.vib * vibC * vibEnv * vibS * (1 - 0.85 * T.shimmer) + 7 * drift + 2 * jit + (o.detune ?? 0);
    f0 = midiHz(pitch + off) * Math.pow(2, cents / 1200);
    const w = (i % CR) / CR;
    let v = 0;
    for (let j = 0; j < NP + NU; j++) {
      const a = aCur[j]! + (aNext[j]! - aCur[j]!) * w;
      phase[j] = phase[j]! + f0 * ratio[j]! / SR; if (phase[j]! > 1) phase[j] = phase[j]! - Math.floor(phase[j]!);
      if (a > 1e-7) v += a * Math.sin(TAU * phase[j]!);
    }
    if (i % CR === CR - 1) aCur.set(aNext);
    // pitch-synchronous aspiration plus breath events, shaped by the same formants
    const g = 0.5 + 0.5 * Math.cos(TAU * phase[0]!), nz = rng.bi();
    const asp = nz * (T.breath * level * (0.25 + 0.75 * g * g * g) * 0.5 + breathEnv * 0.35);
    let nv = 0; for (let k = 0; k < 4; k++) { nf[k]!.tick(asp); nv += nf[k]!.bpn * [1, 0.6, 0.32, 0.2][k]!; }
    air.tick(asp); nv += air.hp * 0.3;
    const y = lp.tick(hp.tick(v + nv));
    dry[i] = y; send[i] = y * T.glass + nz * breathEnv * T.glass * 0.12;
  }
  return { dry: edgeFade(dry, 0.002, 0.2), send };
}

/** Sympathetic glass resonators (two slightly detuned high-Q band-passes per frequency), spread L/R. */
export function glassHalo(send: Wave, freqs: number[], decay = 1.1, gain = 1): Wave[] {
  const N = send.length, L = new Float64Array(N), R = new Float64Array(N);
  const bank = freqs.flatMap((f, k) => [-1.3, 1.3].map(d => ({ f: new SVF().set(f + d, Math.PI * (f + d) * decay), pan: ((k % 2 ? 1 : -1) * (0.3 + 0.12 * k)) + d * 0.05 })));
  for (let i = 0; i < N; i++) {
    const x = send[i]!;
    let l = 0, r = 0;
    for (const b of bank) { b.f.tick(x); const y = b.f.bpn; l += y * (1 - Math.max(0, b.pan)); r += y * (1 + Math.min(0, b.pan)); }
    L[i] = l * gain; R[i] = r * gain;
  }
  return [edgeFade(L, 0.002, 0.3), edgeFade(R, 0.002, 0.3)];
}
