/** Original challenger instruments. Each call returns one renderable sample spec;
 * the build renders every distinct spec once and maps it into a DaemonV12 kit. */
import { createHash } from 'node:crypto';
import {
  Ladder, OnePole, Osc, RATE, SVF, TAU, adsr, biquad, clamp, dbLin, decay, fadeEdges, frames, midiHz,
  mix, modal, mono, noiseBurst, prng, seedOf, smooth, softClip, stereo, toStereo, type Mono, type Stereo,
} from './dsp.ts';

export interface SampleSpec { kit: string; name: string; gain: number; params: unknown; render: () => Mono | Stereo }
function spec(kit: string, code: string, params: object, gain: number, render: () => Mono | Stereo): SampleSpec {
  const hash = createHash('sha256').update(JSON.stringify([kit, params])).digest('hex').slice(0, 6);
  return { kit, name: `${code}-${hash}`, gain, params, render };
}

// ------------------------------------------------------------------ voice
/** Formant data (Hz, dB, Hz): soprano vowel tables, a public-domain acoustic-phonetics staple. */
const VOWELS: Record<string, { f: number[]; a: number[]; b: number[] }> = {
  a: { f: [800, 1150, 2900, 3900, 4950], a: [0, -6, -32, -20, -50], b: [80, 90, 120, 130, 140] },
  e: { f: [350, 2000, 2800, 3600, 4950], a: [0, -20, -15, -40, -56], b: [60, 100, 120, 150, 200] },
  i: { f: [270, 2140, 2950, 3900, 4950], a: [0, -12, -26, -26, -44], b: [60, 90, 100, 120, 120] },
  o: { f: [450, 800, 2830, 3800, 4950], a: [0, -11, -22, -22, -50], b: [70, 80, 100, 130, 135] },
  u: { f: [325, 700, 2700, 3800, 4950], a: [0, -16, -35, -40, -60], b: [50, 60, 170, 180, 200] },
};
type Key<T> = [number, T];
function track<T>(keys: Key<T>[], t: number, lerp: (a: T, b: T, x: number) => T): T {
  if (t <= keys[0]![0]) return keys[0]![1];
  for (let i = 1; i < keys.length; i++) if (t < keys[i]![0]) {
    const [t0, a] = keys[i - 1]!, [t1, b] = keys[i]!;
    return lerp(a, b, smooth((t - t0) / (t1 - t0)));
  }
  return keys[keys.length - 1]![1];
}
const lerpN = (a: number, b: number, x: number) => a + (b - a) * x;

export interface VoiceParams {
  midi: number; dur: number; vowels: Key<string>[]; pitch?: Key<number>[];
  vib?: { cents: number; hz: number; delay: number }; attack?: number; release?: number;
  breath?: number; width?: number; formantShift?: number; grit?: number; tag?: string;
}
/** Interpolated formant set (centre Hz, linear gain, bandwidth Hz) at time t. */
function vowelAt(keys: Key<string>[], t: number): { f: number[]; g: number[]; b: number[] } {
  const pick = (a: string, b: string, x: number) => {
    const A = VOWELS[a]!, B = VOWELS[b]!;
    return { f: A.f.map((v, k) => v + (B.f[k]! - v) * x), g: A.a.map((v, k) => dbLin(v + (B.a[k]! - v) * x)), b: A.b.map((v, k) => v + (B.b[k]! - v) * x) };
  };
  if (t <= keys[0]![0]) return pick(keys[0]![1], keys[0]![1], 0);
  for (let i = 1; i < keys.length; i++) if (t < keys[i]![0]) {
    const [t0, a] = keys[i - 1]!, [t1, b] = keys[i]!;
    return pick(a, b, smooth((t - t0) / (t1 - t0)));
  }
  const last = keys[keys.length - 1]![1]; return pick(last, last, 0);
}
/** "Machine voice": band-limited buzz through a moving five-formant bank. Formants stay put
 * while pitch moves, so every pitch is rendered natively (never repitched by the sampler). */
function renderVoice(p: VoiceParams, voices: { cents: number; side: number; amp: number; seed: number }[]): Stereo {
  const tail = p.release ?? 0.07, n = frames(p.dur + tail + 0.02), out = stereo(n);
  const shift = p.formantShift ?? 1, grit = p.grit ?? 0;
  for (const voice of voices) {
    const osc = new Osc((voice.seed % 997) / 997), osc2 = new Osc(((voice.seed >> 3) % 991) / 991);
    const bank = [0, 1, 2, 3, 4].map(() => new SVF()), breathBank = [0, 1, 2].map(() => new SVF()), random = prng(voice.seed);
    const tilt = new OnePole(), vibPhase = (voice.seed % 628) / 100, vibRate = (p.vib?.hz ?? 5.3) * (1 + 0.03 * ((voice.seed % 7) - 3) / 3);
    let formants = vowelAt(p.vowels, 0);
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      if (i % 32 === 0) formants = vowelAt(p.vowels, t);
      const semis = p.pitch ? track(p.pitch, t, lerpN) : 0;
      const vibDepth = p.vib ? p.vib.cents * smooth((t - p.vib.delay) / 0.18) : 0;
      const cents = voice.cents + vibDepth * Math.sin(TAU * vibRate * t + vibPhase);
      const hz = midiHz(p.midi + semis) * 2 ** (cents / 1200);
      const buzz = 0.62 * osc.saw(hz) + 0.38 * osc2.pulse(hz, 0.32);
      const src = tilt.lp(buzz, 5200) + grit * softClip(buzz * 3, 2) * 0.3;
      let y = 0;
      for (let k = 0; k < 5; k++) {
        const center = Math.max(k === 0 ? hz * 1.08 : 0, formants.f[k]! * shift);
        const q = center / Math.max(40, formants.b[k]! * 1.15);
        y += bank[k]!.process(src, center, q) / q * formants.g[k]!;
      }
      let breath = 0;
      if (p.breath) {
        const w = random();
        for (let k = 0; k < 3; k++) breath += breathBank[k]!.process(w, formants.f[k]! * shift, 3) / 3 * formants.g[k]!;
        breath *= p.breath;
      }
      const env = adsr(t, p.dur, p.attack ?? 0.012, 0.25, 0.86, tail / 3);
      const v = (y * 2.4 + breath) * env * voice.amp;
      if (voice.side <= 0) out[0][i]! += v;
      if (voice.side >= 0) out[1][i]! += v;
    }
  }
  for (const c of out) { for (let i = 0; i < c.length; i++) c[i] = softClip(c[i]!, 1.3); fadeEdges(c, 0.0015, 0.01); }
  return out;
}
function voiceStack(p: VoiceParams, chorus: number) {
  const seed = seedOf(JSON.stringify(p));
  const w = p.width ?? 0.35;
  return [
    { cents: 0, side: 0, amp: 1, seed },
    { cents: -chorus, side: -1, amp: w, seed: seed + 11 },
    { cents: chorus, side: 1, amp: w, seed: seed + 23 },
  ];
}
export const voice = (p: VoiceParams) => spec('voice', `vx${p.midi}`, p, 0.42, () => renderVoice(p, voiceStack(p, 7)));
/** Choir: the same engine, slower, three detuned singers per side around a shared centre. */
export const choir = (p: VoiceParams & { wide?: boolean }) => spec('choir', `ch${p.midi}`, p, 0.3, () => {
  const seed = seedOf(JSON.stringify(p)), extra = p.wide
    ? [{ cents: -17, side: -1, amp: 0.55, seed: seed + 37 }, { cents: 16, side: 1, amp: 0.55, seed: seed + 41 }, { cents: -6, side: -1, amp: 0.5, seed: seed + 53 }, { cents: 8, side: 1, amp: 0.5, seed: seed + 59 }]
    : [{ cents: -15, side: -1, amp: 0.3, seed: seed + 37 }, { cents: 14, side: 1, amp: 0.3, seed: seed + 41 }];
  return renderVoice({ attack: 0.22, release: 0.5, ...p }, [...voiceStack(p, 9), ...extra]);
});

// ------------------------------------------------------------------ bass
export interface BassParams { midi: number; dur: number; accent?: number; cut?: number; res?: number; decay?: number; slideFrom?: number }
/** Ladder-filtered saw/pulse with an unfiltered sub: resonant upper harmonics for phones, weight below. */
export const bass = (p: BassParams) => spec('bass', `bs${p.midi}`, p, 0.5, () => {
  const n = frames(p.dur + 0.05), out = mono(n), a = new Osc(0), b = new Osc(0.37), s = new Osc(0), lad = new Ladder();
  const accent = p.accent ?? 0, cut = p.cut ?? 0.5, res = p.res ?? 0.5, dec = p.decay ?? 0.14;
  for (let i = 0; i < n; i++) {
    const t = i / RATE, slide = p.slideFrom ? p.slideFrom * Math.exp(-t / 0.045) : 0;
    const hz = midiHz(p.midi + slide);
    const raw = 0.62 * a.saw(hz) + 0.38 * b.pulse(hz * 1.002, 0.42);
    const env = Math.exp(-t / (dec * (1 + 0.4 * accent)));
    const cutoff = hz * 1.6 + (420 + 3000 * cut) * (1 + 0.7 * accent) * env;
    const f = lad.process(raw * 0.9, cutoff, clamp(0.42 + 0.35 * res + 0.12 * accent, 0, 0.88));
    const amp = adsr(t, p.dur, 0.0025, 0.4, 0.75, 0.012);
    out[i] = (softClip(f * (1.6 + accent), 1.6) * 0.75 + 0.55 * s.sine(hz)) * amp * (0.82 + 0.18 * accent);
  }
  fadeEdges(out, 0.001, 0.004);
  return out;
});
/** Round sub for the reveal and the payoff: sine with a little second harmonic. */
export const sub = (p: { midi: number; dur: number; attack?: number }) => spec('sub', `sb${p.midi}`, p, 0.55, () => {
  const n = frames(p.dur + 0.3), out = mono(n), o = new Osc(0);
  for (let i = 0; i < n; i++) {
    const t = i / RATE, v = o.sine(midiHz(p.midi));
    out[i] = softClip(v + 0.18 * Math.sin(2 * Math.asin(clamp(v, -1, 1))), 1.2) * adsr(t, p.dur, p.attack ?? 0.012, 2, 0.9, 0.09);
  }
  fadeEdges(out, 0.001, 0.01);
  return out;
});

// ------------------------------------------------------------------ drums
const F1 = midiHz(29);
/** Variants are frozen once rendered into a delivered version; new sounds get new variants. */
export const kick = (variant: 'main' | 'land' | 'soft' | 'deep' | 'tight') => spec('kick', `kk-${variant}`, { variant }, 0.6, () => {
  const long = variant === 'land' ? 0.95 : variant === 'deep' ? 0.8 : 0.5;
  const n = frames(long), out = mono(n), seed = seedOf('kick' + variant); let ph = 0;
  const top = variant === 'soft' ? 120 : variant === 'land' ? 230 : 190;
  for (let i = 0; i < n; i++) {
    const t = i / RATE, hz = F1 + (top - F1) * Math.exp(-t / (variant === 'land' ? 0.05 : 0.032));
    ph += TAU * hz / RATE;
    const body = Math.sin(ph) * decay(t, variant === 'land' ? 0.85 : variant === 'deep' ? 0.75 : variant === 'soft' ? 0.32 : variant === 'tight' ? 0.27 : 0.42);
    out[i] = softClip(body * 1.25, variant === 'soft' ? 1.4 : 2.3);
  }
  const hp = biquad('hp', 2500, 0.7);
  noiseBurst(out, seed, 0, 0.006, variant === 'soft' ? 0.12 : 0.35, x => hp(x), 0.006);
  if (variant === 'land') {
    // The proposed unit landing: a tuned thunk (F2) and a latch ring (C6/F6) inside the kick.
    const thunk = mono(n); modal(thunk, [{ hz: midiHz(41), amp: 0.5, t60: 0.22 }, { hz: midiHz(53), amp: 0.18, t60: 0.12 }]);
    const latch = mono(n); modal(latch, [{ hz: midiHz(84), amp: 0.12, t60: 0.45 }, { hz: midiHz(89), amp: 0.08, t60: 0.32 }, { hz: midiHz(84) * 2.76, amp: 0.05, t60: 0.12 }], frames(0.012));
    const bp = biquad('bp', 1800, 1.2); noiseBurst(latch, seed + 1, frames(0.012), 0.004, 0.25, x => bp(x), 0.004);
    mix(out, thunk); mix(out, latch);
  }
  fadeEdges(out, 0.0003, 0.02);
  return out;
});
export const snare = (variant: 'main' | 'ghost' | 'big') => spec('snare', `sn-${variant}`, { variant }, 0.42, () => {
  const len = variant === 'big' ? 0.75 : variant === 'ghost' ? 0.14 : 0.42, n = frames(len), out = stereo(n), seed = seedOf('snare' + variant);
  const amp = variant === 'ghost' ? 0.35 : 1;
  out.forEach((c, side) => {
    const bp = biquad('bp', 1650, 0.8), hp = biquad('hp', 900, 0.7), bp2 = biquad('bp', 2400, 0.6);
    // main crack plus two quick mechanical re-strikes (a clap that starts on the beat)
    [[0, 1], [0.011, 0.55], [0.023, 0.4]].forEach(([at, g]) => noiseBurst(c, seed + side * 7 + at! * 1000, frames(at!), 0.007, amp * g!, x => bp(x) * 2.2, 0.007));
    noiseBurst(c, seed + 50 + side, 0, len, amp * 0.55, x => hp(bp2(x)) * 1.4, variant === 'big' ? 0.55 : variant === 'ghost' ? 0.07 : 0.26);
    const metal = mono(n); modal(metal, [{ hz: 418, amp: 0.22, t60: 0.09 }, { hz: 1031, amp: 0.16, t60: 0.08 }, { hz: 1797, amp: 0.1, t60: 0.06 }, { hz: 2933, amp: 0.06, t60: 0.05 }]);
    let ph = 0; for (let i = 0; i < n; i++) { const t = i / RATE; ph += TAU * (165 + 60 * Math.exp(-t / 0.02)) / RATE; c[i]! += amp * (0.45 * Math.sin(ph) * decay(t, 0.12) + metal[i]!); c[i] = softClip(c[i]!, 1.4); }
    fadeEdges(c, 0.0003, 0.015);
  });
  return out;
});
export const hat = (variant: 'closed' | 'open' | 'tick' | 'accent') => spec('hat', `ht-${variant}`, { variant }, 0.38, () => {
  const len = variant === 'open' ? 0.4 : variant === 'tick' ? 0.06 : 0.09, n = frames(len), out = stereo(n), seed = seedOf('hat' + variant);
  out.forEach((c, side) => {
    if (variant === 'tick') {
      // mechanical escapement: a click and two tuned pings
      modal(c, [{ hz: 4730, amp: 0.45, t60: 0.028 }, { hz: 7310 + side * 30, amp: 0.25, t60: 0.016 }, { hz: 1180, amp: 0.25, t60: 0.02 }]);
      for (let i = 0; i < frames(0.0006); i++) c[i]! += Math.sin(Math.PI * i / frames(0.0006));
    } else {
      const oscs = [263, 400, 421, 474, 587, 845].map((f, k) => ({ o: new Osc(((k * 37 + side * 11) % 100) / 100), f: f * 1.9 }));
      const bp = biquad('bp', 9000, 1.1), hp = biquad('hp', 6500, 0.7), random = prng(seed + side);
      const t60 = variant === 'open' ? 0.34 : variant === 'accent' ? 0.07 : 0.045;
      for (let i = 0; i < n; i++) {
        const t = i / RATE; let m = 0; for (const { o, f } of oscs) m += o.pulse(f, 0.5);
        c[i] = hp(bp(m * 0.25 + 0.35 * random())) * decay(t, t60) * 2.2;
      }
    }
    fadeEdges(c, 0.0002, 0.006);
  });
  return out;
});
/** Pitched mechanical "tok": two-operator FM blip, tuned (gear teeth that play notes). */
export const tok = (p: { midi: number; bright?: number; len?: number }) => spec('tok', `tk${p.midi}`, p, 0.4, () => {
  const n = frames(p.len ?? 0.18), out = mono(n), f = midiHz(p.midi); let pc = 0, pm = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE, index = (2.5 + 2 * (p.bright ?? 0.5)) * Math.exp(-t / 0.018);
    out[i] = Math.sin(pc + index * Math.sin(pm)) * decay(t, (p.len ?? 0.18) * 0.7);
    pc += TAU * f / RATE; pm += TAU * f * 3.5 / RATE;
  }
  fadeEdges(out, 0.0003, 0.008);
  return out;
});

// ------------------------------------------------------------------ melodic
/** Plucked analog arp: two detuned saws (one per side) through a snappy ladder envelope. */
export const pluck = (p: { midi: number; dur: number; bright?: number }) => spec('pluck', `pl${p.midi}`, p, 0.42, () => {
  const n = frames(p.dur + 0.25), out = stereo(n), f = midiHz(p.midi);
  out.forEach((c, side) => {
    const o = new Osc(side * 0.31), o2 = new Osc(0.6), lad = new Ladder();
    for (let i = 0; i < n; i++) {
      const t = i / RATE, x = 0.55 * o.saw(f * 2 ** ((side ? 5 : -5) / 1200)) + 0.45 * o2.saw(f);
      const cutoff = f * 1.4 + (900 + 3600 * (p.bright ?? 0.5)) * Math.exp(-t / 0.09);
      c[i] = softClip(lad.process(x * 0.8, cutoff, 0.35), 1.3) * adsr(t, p.dur, 0.002, 0.2, 0.35, 0.09);
    }
    fadeEdges(c, 0.0005, 0.02);
  });
  return out;
});
/** FM glass keys for the reveal: warm 1:1 body with a short 14:1 tine. Centred and mono-safe. */
export const keys = (p: { midi: number; dur: number; pan?: number }) => spec('keys', `ky${p.midi}`, p, 0.4, () => {
  const n = frames(p.dur + 0.8), out = mono(n), f = midiHz(p.midi); let pc = 0, pm = 0, pt = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE, i1 = 1.6 * Math.exp(-t / 0.5) + 0.25, i2 = 0.9 * Math.exp(-t / 0.035);
    pm += TAU * f / RATE; pt += TAU * f * 14 / RATE; pc += TAU * f / RATE;
    out[i] = Math.sin(pc + i1 * Math.sin(pm) + i2 * Math.sin(pt)) * adsr(t, p.dur, 0.002, 1.4, 0.35, 0.35);
  }
  fadeEdges(out, 0.0004, 0.02);
  const pan = p.pan ?? 0, st = toStereo(out);
  if (pan) for (let i = 0; i < out.length; i++) { st[0][i]! *= 1 - Math.max(0, pan); st[1][i]! *= 1 + Math.min(0, pan); }
  return st;
});

// ------------------------------------------------------------------ direction B voices
/** "Electric cello": bowed double saw through fixed body resonances, swelling vibrato. */
export const cello = (p: { midi: number; dur: number; scoop?: number; swell?: number }) => spec('cello', `ce${p.midi}`, p, 0.4, () => {
  const n = frames(p.dur + 0.25), out = stereo(n), f0 = midiHz(p.midi), seed = seedOf(JSON.stringify(p));
  out.forEach((c, side) => {
    const a = new Osc(side * 0.2), b = new Osc(0.5), random = prng(seed + side), body = [new SVF(), new SVF(), new SVF(), new SVF()];
    const res = [[280, 3, 1], [610, 4, 0.8], [1150, 5, 0.55], [2500, 4, 0.35]] as const;
    for (let i = 0; i < n; i++) {
      const t = i / RATE, scoop = (p.scoop ?? -1) * Math.exp(-t / 0.05), vib = 16 * smooth((t - 0.18) / 0.3) * Math.sin(TAU * 5.4 * t + side);
      const hz = f0 * 2 ** ((scoop * 100 + vib) / 1200);
      const x = 0.5 * a.saw(hz * 2 ** ((side ? 3 : -3) / 1200)) + 0.5 * b.saw(hz) + 0.05 * random();
      let y = 0; res.forEach(([fq, q, g], k) => { y += body[k]!.process(x, fq, q) / q * g; });
      const swell = p.swell ?? 0.5, env = adsr(t, p.dur, 0.06 + 0.2 * swell, 0.6, 0.9, 0.12) * (1 + swell * 0.35 * smooth(t / p.dur));
      c[i] = softClip((y * 1.6 + 0.15 * x) * env, 1.2);
    }
    fadeEdges(c, 0.001, 0.03);
  });
  return out;
});
export const tom = (p: { midi: number }) => spec('tom', `tm${p.midi}`, p, 0.55, () => {
  const n = frames(0.9), out = mono(n), f = midiHz(p.midi); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / RATE; ph += TAU * f * (1 + 0.55 * Math.exp(-t / 0.04)) / RATE; out[i] = softClip(Math.sin(ph) * decay(t, 0.75), 1.8); }
  const bp = biquad('bp', 900, 0.7); noiseBurst(out, seedOf('tom' + p.midi), 0, 0.05, 0.25, x => bp(x), 0.05);
  fadeEdges(out, 0.0003, 0.02);
  return out;
});
export const strings = (p: { midi: number; dur: number }) => spec('strings', `st${p.midi}`, p, 0.3, () => {
  const n = frames(p.dur + 0.6), out = stereo(n), f = midiHz(p.midi);
  out.forEach((c, side) => {
    const oscs = [-11, -4, 0, 6, 12].map((cents, k) => ({ o: new Osc(((k * 13 + side * 29) % 50) / 50), r: 2 ** ((cents + (side ? 2 : -2) * (k - 2)) / 1200) }));
    const lp = biquad('lp', 2600, 0.6);
    for (let i = 0; i < n; i++) { const t = i / RATE; let x = 0; for (const { o, r } of oscs) x += o.saw(f * r); c[i] = lp(x * 0.22) * adsr(t, p.dur, 0.35, 1, 0.9, 0.45); }
    fadeEdges(c, 0.002, 0.04);
  });
  return out;
});

// ------------------------------------------------------------------ sound design (tuned, in-key)
export const sfx = (variant: 'seat' | 'servo' | 'stop' | 'snap' | 'zip' | 'reverse' | 'latch', midi = 72) => spec('sfx', `fx-${variant}`, { variant, midi }, 0.45, () => {
  const seed = seedOf('sfx' + variant + midi);
  if (variant === 'seat') {
    // acrylic plate seats: bright clack, short ring tuned to C6, a small low seat
    const n = frames(0.6), out = mono(n), f = midiHz(midi);
    modal(out, [{ hz: f, amp: 0.4, t60: 0.38 }, { hz: f * 2.32, amp: 0.22, t60: 0.2 }, { hz: f * 4.07, amp: 0.12, t60: 0.1 }, { hz: midiHz(43), amp: 0.5, t60: 0.08 }]);
    const hp = biquad('hp', 2500, 0.7); noiseBurst(out, seed, 0, 0.004, 0.6, x => hp(x), 0.004);
    fadeEdges(out, 0.0002, 0.02); return toStereo(out);
  }
  if (variant === 'latch') {
    // the proposed unit lands: a tuned F2 thunk, card-stock knock and a C6/F6 latch ring
    const n = frames(0.8), out = mono(n);
    modal(out, [{ hz: midiHz(41), amp: 0.55, t60: 0.22 }, { hz: midiHz(53), amp: 0.2, t60: 0.12 }, { hz: 610, amp: 0.25, t60: 0.06 }, { hz: 1430, amp: 0.15, t60: 0.04 }]);
    modal(out, [{ hz: midiHz(84), amp: 0.16, t60: 0.5 }, { hz: midiHz(89), amp: 0.1, t60: 0.35 }, { hz: midiHz(84) * 2.76, amp: 0.06, t60: 0.12 }], frames(0.012));
    const bp = biquad('bp', 1800, 1.2); noiseBurst(out, seed, 0, 0.006, 0.4, x => bp(x), 0.006); noiseBurst(out, seed + 1, frames(0.012), 0.004, 0.3, x => bp(x), 0.004);
    fadeEdges(out, 0.0002, 0.02); return toStereo(out);
  }
  if (variant === 'servo') {
    // Map B slides in: a geared servo whir rising a minor sixth, ends hard on its target
    const len = 1.3, n = frames(len + 0.02), out = stereo(n);
    out.forEach((c, side) => {
      const o = new Osc(side * 0.13), bp = new SVF(), random = prng(seed + side);
      for (let i = 0; i < n; i++) {
        const t = i / RATE, x = clamp(t / len, 0, 1), hz = midiHz(midi + 8 * x * x);
        const teeth = 0.55 + 0.45 * Math.sin(TAU * (28 + 30 * x) * t);
        const raw = o.saw(hz) * teeth + 0.4 * random();
        c[i] = bp.process(raw, 500 + 2600 * x * x, 2.2) * (0.15 + 0.85 * x ** 1.6) * (t > len ? Math.max(0, 1 - (t - len) / 0.008) : 1);
      }
      fadeEdges(c, 0.005, 0.004);
    });
    return out;
  }
  if (variant === 'stop') {
    // the machine stops: latch clunk tuned to F with a short metal ring
    const n = frames(0.5), out = mono(n);
    modal(out, [{ hz: midiHz(41), amp: 0.6, t60: 0.14 }, { hz: midiHz(77), amp: 0.2, t60: 0.2 }, { hz: midiHz(77) * 2.4, amp: 0.1, t60: 0.08 }]);
    const lp = biquad('lp', 3000, 0.7); noiseBurst(out, seed, 0, 0.01, 0.4, x => lp(x), 0.01);
    fadeEdges(out, 0.0002, 0.02); return toStereo(out);
  }
  if (variant === 'snap') {
    // editorial cut: a crisp sheet snap
    const n = frames(0.3), out = stereo(n);
    out.forEach((c, side) => { const hp = biquad('hp', 2600, 0.7), bp = biquad('bp', 3100, 1); noiseBurst(c, seed + side, 0, 0.3, 0.8, x => hp(x) + 0.5 * bp(x), 0.05); fadeEdges(c, 0.0002, 0.01); });
    return out;
  }
  if (variant === 'zip') {
    // the underline drawing itself: a fast rising pitched tick ramp (12 ticks, minor-pentatonic)
    const n = frames(0.42), out = mono(n), scale = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24, 27];
    scale.forEach((s, k) => modal(out, [{ hz: midiHz(midi + s), amp: 0.2 + 0.02 * k, t60: 0.06 }, { hz: midiHz(midi + s) * 3.01, amp: 0.05, t60: 0.02 }], frames(k * 0.03)));
    fadeEdges(out, 0.0002, 0.02); return toStereo(out);
  }
  // reverse: a reversed choir-like bloom that ends exactly at its file end
  const n = frames(0.9), out = stereo(n);
  out.forEach((c, side) => {
    const tmp = mono(n); modal(tmp, [0, 7, 12, 16, 19].map((s, k) => ({ hz: midiHz(midi + s) * (1 + side * 0.0007), amp: 0.25 / (k + 1) + 0.05, t60: 1.2 })));
    for (let i = 0; i < n; i++) c[i] = tmp[n - 1 - i]! * (i / n) ** 0.5;
    fadeEdges(c, 0.02, 0.004);
  });
  return out;
});
