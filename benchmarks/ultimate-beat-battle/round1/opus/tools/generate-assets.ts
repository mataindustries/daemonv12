// Deterministic benchmark-only sounds for "Glass Lung" (Ultimate Beat Battle, Round 1, Opus).
//
// Usage (from the repository root):
//   node benchmarks/ultimate-beat-battle/round1/opus/tools/generate-assets.ts
//
// Node built-ins only. Every sound is computed in float64 from closed-form oscillators,
// RBJ biquads and an explicit xorshift32 noise seed, then peak-scaled and rounded once
// to PCM16 (44.1 kHz). No recordings, downloaded samples, SoundFonts or impulse responses.
// The shipped DaemonV12 packs are not touched; the three GLASSHOUSE files this project
// plays are copied byte-for-byte (hash-checked) into assets/glasshouse/.

import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const FS = 44100;
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const ASSETS = join(ROOT, 'assets');
const REPO = join(ROOT, '..', '..', '..', '..');

type Wave = Float64Array;

// ---------------------------------------------------------------- primitives

function xorshift(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296 * 2 - 1;
  };
}

function noise(n: number, seed: number): Wave {
  const r = xorshift(seed);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = r();
  return out;
}

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

function rbj(kind: 'lp' | 'hp' | 'bp' | 'peak' | 'hshelf', f: number, q: number, gainDb = 0, rate = FS): Biquad {
  const w = 2 * Math.PI * f / rate;
  const cw = Math.cos(w), sw = Math.sin(w), alpha = sw / (2 * q);
  const A = 10 ** (gainDb / 40);
  let b0 = 0, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;
  if (kind === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; }
  if (kind === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; }
  if (kind === 'bp') { b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; }
  if (kind === 'peak') { b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A; }
  if (kind === 'hshelf') {
    const s = 2 * Math.sqrt(A) * alpha;
    b0 = A * ((A + 1) + (A - 1) * cw + s); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - s);
    a0 = (A + 1) - (A - 1) * cw + s; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - s;
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function filt(x: Wave, c: Biquad): Wave {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

const lp = (x: Wave, f: number, q = Math.SQRT1_2, rate = FS) => filt(x, rbj('lp', f, q, 0, rate));
const hp = (x: Wave, f: number, q = Math.SQRT1_2, rate = FS) => filt(x, rbj('hp', f, q, 0, rate));
const bp = (x: Wave, f: number, q: number, rate = FS) => filt(x, rbj('bp', f, q, 0, rate));

// Time-varying two-pole resonator (constant peak gain), coefficients recomputed per sample.
function resonator(x: Wave, freq: (i: number) => number, bw: (i: number) => number, rate = FS): Wave {
  const y = new Float64Array(x.length);
  let y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const r = Math.exp(-Math.PI * bw(i) / rate);
    const th = 2 * Math.PI * freq(i) / rate;
    const a1 = -2 * r * Math.cos(th), a2 = r * r;
    const g = (1 - r) * Math.sqrt(1 - 2 * r * Math.cos(2 * th) + r * r);
    const v = g * x[i] - a1 * y1 - a2 * y2;
    y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

function besselI0(x: number): number {
  let sum = 1, term = 1;
  for (let k = 1; k <= 40; k++) { term *= (x / (2 * k)) ** 2; sum += term; }
  return sum;
}

// 4x oversampled source -> 44.1 kHz with a 255-tap Kaiser windowed sinc (beta 8.6, cutoff 19.5 kHz).
const DECIM = (() => {
  const taps = 255, mid = (taps - 1) / 2, fc = 19500 / (FS * 4), beta = 8.6;
  const h = new Float64Array(taps);
  let sum = 0;
  for (let n = 0; n < taps; n++) {
    const t = n - mid;
    const sinc = t === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * t) / (Math.PI * t);
    const w = besselI0(beta * Math.sqrt(1 - (t / mid) ** 2)) / besselI0(beta);
    h[n] = sinc * w; sum += h[n];
  }
  for (let n = 0; n < taps; n++) h[n] /= sum;
  return h;
})();

function decimate4(x: Wave): Wave {
  const n = Math.floor(x.length / 4);
  const y = new Float64Array(n);
  const mid = (DECIM.length - 1) / 2;
  for (let m = 0; m < n; m++) {
    let acc = 0;
    const c = m * 4;
    for (let k = 0; k < DECIM.length; k++) {
      const idx = c + k - mid;
      if (idx >= 0 && idx < x.length) acc += DECIM[k] * x[idx];
    }
    y[m] = acc;
  }
  return y;
}

const smooth = (u: number) => u <= 0 ? 0 : u >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * u);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

function taper(x: Wave, inMs: number, outMs: number): Wave {
  const y = Float64Array.from(x);
  const a = Math.max(1, Math.round(inMs * FS / 1000)), b = Math.max(1, Math.round(outMs * FS / 1000));
  for (let i = 0; i < a && i < y.length; i++) y[i] *= smooth(i / a);
  for (let i = 0; i < b && i < y.length; i++) y[y.length - 1 - i] *= smooth(i / b);
  y[0] = 0; y[y.length - 1] = 0;
  return y;
}

function peakOf(chans: Wave[]): number {
  let p = 0;
  for (const c of chans) for (let i = 0; i < c.length; i++) p = Math.max(p, Math.abs(c[i]));
  return p;
}

function toPcm(chans: Wave[], peakDb: number): Buffer {
  const target = 32767 * 10 ** (peakDb / 20);
  const scale = target / (peakOf(chans) || 1);
  const frames = chans[0].length, ch = chans.length;
  const buf = Buffer.alloc(44 + frames * ch * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + frames * ch * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(ch, 22);
  buf.writeUInt32LE(FS, 24); buf.writeUInt32LE(FS * ch * 2, 28); buf.writeUInt16LE(ch * 2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(frames * ch * 2, 40);
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-32768, Math.min(32767, Math.round(chans[c][i] * scale)));
      buf.writeInt16LE(v, 44 + (i * ch + c) * 2);
    }
  }
  return buf;
}

const sec = (s: number) => Math.round(s * FS);
const NOTE = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

// ---------------------------------------------------------------- voice

// Female sung-vowel targets: formant centres (Hz) and parallel formant levels (dB re F1), F1..F5.
// A parallel model is used (not a cascade) because at a 415 Hz fundamental the harmonics sample the
// envelope sparsely; explicit levels keep F3-F5 where a produced pop vocal has them.
type Vowel = { f: number[]; l: number[] };
const V: Record<string, Vowel> = {
  a: { f: [830, 1250, 2850, 3550, 4700], l: [0, -4, -15, -18, -24] },
  o: { f: [520, 880, 2800, 3450, 4700], l: [0, -3, -21, -24, -30] },
  u: { f: [360, 760, 2700, 3450, 4700], l: [0, -12, -27, -30, -36] },
  i: { f: [320, 2650, 3250, 3900, 4800], l: [0, -16, -14, -18, -24] },
  e: { f: [580, 2150, 2900, 3700, 4700], l: [0, -12, -14, -20, -26] },
  E: { f: [700, 1800, 2800, 3600, 4700], l: [0, -8, -15, -20, -26] }, // open "ae/eh" between a and e
};
const FORMANT_WIDTH = [180, 220, 320, 380, 450];

function mixVowel(a: Vowel, b: Vowel, u: number): Vowel {
  return { f: a.f.map((v, k) => lerp(v, b.f[k], u)), l: a.l.map((v, k) => lerp(v, b.l[k], u)) };
}

// Spectral envelope (linear amplitude) at frequency f: a -34 dB floor plus a glottal low formant
// (-6 dB around 300 Hz, so sung fundamentals keep body) and five Lorentzian formants, times a
// -3.3 dB/oct source tilt above 400 Hz.
function vowelGain(f: number, v: Vowel): number {
  let s = 10 ** (-34 / 20) + 10 ** (-6 / 20) / (1 + ((f - 300) / 220) ** 2);
  for (let k = 0; k < v.f.length; k++) s += 10 ** (v.l[k] / 20) / (1 + ((f - v.f[k]) / (FORMANT_WIDTH[k] / 2)) ** 2);
  return s * (Math.max(f, 400) / 400) ** -0.55;
}

type VoiceSpec = {
  seconds: number;
  midi: number;
  seed: number;
  vowel: (t: number) => Vowel;          // formant trajectory over time (seconds)
  amp: (t: number) => number;           // voiced amplitude envelope
  aspiration: (t: number) => number;    // unvoiced (h/breath) amplitude envelope
  scoopCents: number;                   // onset pitch scoop (negative = from below)
  vibrato: { start: number; full: number; cents: number; hz: number };
  breath: number;                       // pulsed breath noise level relative to voice
  tilt: number;                         // source spectral tilt exponent (amplitude ~ k^-tilt)
};

function voice(spec: VoiceSpec): Wave {
  const n = sec(spec.seconds);
  const f0 = NOTE(spec.midi);
  const rnd = xorshift(spec.seed);
  // Slow deterministic drift: three incommensurate sines with seeded phases (cents).
  const ph = [rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI];
  const drift = (t: number) => 2.2 * Math.sin(2 * Math.PI * 1.13 * t + ph[0]) + 1.4 * Math.sin(2 * Math.PI * 2.71 * t + ph[1]) + 0.9 * Math.sin(2 * Math.PI * 0.47 * t + ph[2]);
  const shimmer = (t: number) => 1 + 0.03 * Math.sin(2 * Math.PI * 3.3 * t + ph[1]) + 0.02 * Math.sin(2 * Math.PI * 7.9 * t + ph[2]);
  const H = Math.floor(11500 / (f0 * 1.05));
  const out = new Float64Array(n);
  const glottal = new Float64Array(n);
  let phase = 0;
  // Harmonic amplitudes are refreshed every 32 samples (1.4 kHz control rate) and interpolated.
  const CTRL = 32;
  let prevA = new Float64Array(H + 1), nextA = new Float64Array(H + 1);
  const ampsAt = (i: number, fNow: number, arr: Float64Array) => {
    const t = i / FS;
    const v = spec.vowel(t);
    for (let k = 1; k <= H; k++) {
      const fk = k * fNow;
      arr[k] = fk < 15000 ? (k ** -spec.tilt) * vowelGain(fk, v) : 0;
    }
    // Produced-vocal presence (+10 dB around 3.5 kHz) and air (+6 dB shelf from 6 kHz), like a
    // vocal-chain EQ, so the voice reads on small speakers and stays bright when pitched.
    for (let k = 1; k <= H; k++) {
      const fk = k * fNow;
      arr[k] *= (1 + 1.9 * Math.exp(-(((fk - 3500) / 1600) ** 2))) * (1 + 1.0 * smooth((fk - 6000) / 3000));
    }
  };
  const fAt = (i: number) => {
    const t = i / FS;
    const vibDepth = spec.vibrato.cents * smooth((t - spec.vibrato.start) / Math.max(1e-6, spec.vibrato.full - spec.vibrato.start));
    const cents = spec.scoopCents * Math.exp(-t / 0.045) + vibDepth * Math.sin(2 * Math.PI * spec.vibrato.hz * t) + drift(t);
    return f0 * 2 ** (cents / 1200);
  };
  ampsAt(0, fAt(0), prevA);
  ampsAt(CTRL, fAt(CTRL), nextA);
  for (let i = 0; i < n; i++) {
    if (i > 0 && i % CTRL === 0) { prevA = nextA; nextA = new Float64Array(H + 1); ampsAt(i + CTRL, fAt(i + CTRL), nextA); }
    const u = (i % CTRL) / CTRL;
    const f = fAt(i);
    phase += 2 * Math.PI * f / FS;
    if (phase > 2 * Math.PI * 1e6) phase -= 2 * Math.PI * 1e6;
    let s = 0;
    for (let k = 1; k <= H; k++) {
      if (k * f >= 15000) break;
      s += lerp(prevA[k], nextA[k], u) * Math.sin(k * phase);
    }
    const t = i / FS;
    out[i] = s * spec.amp(t) * shimmer(t);
    glottal[i] = 0.55 + 0.45 * Math.max(0, Math.sin(phase)); // pulsed breath follows the glottal cycle
  }
  // Unvoiced part: noise through three moving formant resonators plus an air band.
  const nz = noise(n, spec.seed ^ 0x5bd1e995);
  const vowelAt = (i: number) => spec.vowel(i / FS);
  const r1 = resonator(nz, i => vowelAt(i).f[0], () => 220);
  const r2 = resonator(nz, i => vowelAt(i).f[1], () => 260);
  const r3 = resonator(nz, i => vowelAt(i).f[2], () => 320);
  const air = hp(lp(nz, 13000), 5000);
  const unv = new Float64Array(n);
  for (let i = 0; i < n; i++) unv[i] = 0.9 * r1[i] + 0.7 * r2[i] + 0.6 * r3[i] + 0.9 * air[i];
  // Level-match the noise bed to the voiced part so `breath`/`aspiration` are relative amounts.
  let pv = 0, pn = 0;
  for (let i = 0; i < n; i++) { pv += out[i] * out[i]; pn += unv[i] * unv[i]; }
  const norm = Math.sqrt(pv / Math.max(pn, 1e-20)) || 1;
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / FS;
    y[i] = out[i] + unv[i] * norm * (spec.breath * glottal[i] * spec.amp(t) + spec.aspiration(t));
  }
  return hp(y, 90);
}

type Syllable = { name: string; pitch: number; onset: 'y' | 'w' | 'h' | 'soft' | 'd'; from: string; to: string; end?: string; seconds: number };

function syllable(s: Syllable, seed: number): Wave {
  const short = s.seconds < 0.25;
  const glide = s.onset === 'y' || s.onset === 'w' ? (short ? 0.045 : 0.075) : s.onset === 'd' ? 0.03 : 0.0;
  const hLen = s.onset === 'h' ? (short ? 0.03 : 0.05) : 0;
  const attack = s.onset === 'soft' ? (short ? 0.012 : 0.04) : short ? 0.006 : 0.012;
  const release = s.seconds < 0.1 ? 0.02 : short ? 0.055 : Math.min(0.22, s.seconds * 0.3);
  const from = V[s.from], to = V[s.to], end = s.end ? V[s.end] : null;
  const vowel = (t: number) => {
    let v = glide > 0 ? mixVowel(from, to, smooth(t / glide)) : to;
    if (s.onset === 'h') v = to;
    if (end) v = mixVowel(v, end, smooth((t - s.seconds * 0.45) / (s.seconds * 0.4)));
    return v;
  };
  const voicedStart = hLen * 0.6;
  const amp = (t: number) => {
    const tt = t - voicedStart;
    if (tt < 0) return 0;
    let a = smooth(tt / attack);
    if (s.onset === 'y' || s.onset === 'w') a *= 0.55 + 0.45 * smooth(tt / glide); // semivowels are softer
    if (s.onset === 'd') a *= 1 + 0.35 * Math.exp(-tt / 0.02);                    // a little front-loaded bite
    const rel = smooth((s.seconds - t) / release);
    const sag = short ? 1 : 1 - 0.18 * smooth((t - 0.15) / 0.5);                     // natural sustain sag
    return a * rel * sag;
  };
  const aspiration = (t: number) => {
    if (s.onset === 'h') return 0.45 * Math.sin(Math.PI * Math.min(1, Math.max(0, t / (hLen * 1.3))));
    if (s.onset === 'd') return t < 0.012 ? 1.4 * (1 - t / 0.012) : 0;
    return 0;
  };
  const w = voice({
    seconds: s.seconds,
    midi: s.pitch,
    seed,
    vowel,
    amp,
    aspiration,
    scoopCents: short ? -15 : -45,
    // 4.2 Hz at source: playbackRate scales vibrato like tape speed, so the hook's held notes
    // (rates 1.3-1.5) vibrate at a natural 5.5-6.3 Hz rather than a 7-8 Hz warble.
    vibrato: { start: 0.24, full: 0.5, cents: 20, hz: 4.2 },
    breath: 0.2,
    tilt: 0,
  });
  return taper(w, 0.5, short ? 4 : 8);
}

// ---------------------------------------------------------------- sounds

type Sound = { file: string; name?: string; pitch?: number; seed: number; peak: number; recipe: string; make: () => Wave[] };

const VOX_PITCH = 68; // G#4 = 415.30 Hz: every syllable is sung on this note; the score transposes with playbackRate.

const voxSyllables: (Syllable & { seed: number; recipe: string })[] = [
  { name: 'ya-s', pitch: VOX_PITCH, onset: 'y', from: 'i', to: 'a', seconds: 0.17, seed: 1101, recipe: 'Short "ya": i->a formant glide (45 ms), 6 ms attack, 55 ms release.' },
  { name: 'ya-m', pitch: VOX_PITCH, onset: 'y', from: 'i', to: 'a', seconds: 0.34, seed: 1102, recipe: 'Medium "ya": i->a glide (75 ms), scoop from -55 cents.' },
  { name: 'ya-l', pitch: VOX_PITCH, onset: 'y', from: 'i', to: 'a', seconds: 0.85, seed: 1103, recipe: 'Long "ya" with delayed 4.2 Hz vibrato (20 cents) and natural sag.' },
  { name: 'wo-s', pitch: VOX_PITCH, onset: 'w', from: 'u', to: 'o', seconds: 0.17, seed: 1201, recipe: 'Short "wo": u->o glide.' },
  { name: 'wo-m', pitch: VOX_PITCH, onset: 'w', from: 'u', to: 'o', seconds: 0.34, seed: 1202, recipe: 'Medium "wo".' },
  { name: 'wo-l', pitch: VOX_PITCH, onset: 'w', from: 'u', to: 'o', end: 'a', seconds: 0.85, seed: 1203, recipe: 'Long "wo-ah": u->o glide, then opens toward a; vibrato.' },
  { name: 'hey-s', pitch: VOX_PITCH, onset: 'h', from: 'E', to: 'E', end: 'i', seconds: 0.17, seed: 1301, recipe: 'Short "hey": 30 ms aspiration, E vowel closing to i.' },
  { name: 'hey-m', pitch: VOX_PITCH, onset: 'h', from: 'E', to: 'E', end: 'i', seconds: 0.34, seed: 1302, recipe: 'Medium "hey".' },
  { name: 'da-s', pitch: VOX_PITCH, onset: 'd', from: 'e', to: 'a', seconds: 0.17, seed: 1401, recipe: 'Short "da": 12 ms burst, e->a 30 ms transition, front-loaded.' },
  { name: 'da-m', pitch: VOX_PITCH, onset: 'd', from: 'e', to: 'a', seconds: 0.34, seed: 1402, recipe: 'Medium "da".' },
  { name: 'ah-l', pitch: VOX_PITCH, onset: 'soft', from: 'a', to: 'a', seconds: 0.85, seed: 1501, recipe: 'Soft-onset sustained "ah" (40 ms attack), vibrato.' },
  { name: 'oo-l', pitch: VOX_PITCH, onset: 'soft', from: 'u', to: 'u', seconds: 1.2, seed: 1601, recipe: 'Soft, breathy sustained "oo" for low/answer voices.' },
];

function breathIn(): Wave {
  // An inhale: formant-coloured noise, rising in level and brightness, cut sharply (the singer is ready).
  const n = sec(0.42);
  const nz = noise(n, 1701);
  const r1 = resonator(nz, i => lerp(650, 900, i / n), () => 260);
  const r2 = resonator(nz, i => lerp(1400, 1900, i / n), () => 420);
  const r3 = resonator(nz, () => 2900, () => 600);
  const air = hp(nz, 4500);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const env = (t ** 1.6) * smooth((1 - t) / 0.06);
    y[i] = env * (r1[i] + 0.8 * r2[i] + 0.5 * r3[i] + (0.15 + 0.35 * t) * air[i] * 0.25);
  }
  return taper(hp(y, 200), 1, 3);
}

function sub808(seconds: number): Wave {
  // C#2 sine with a short +2.4x pitch punch, soft-clipped for 2nd/3rd harmonics, long exponential body.
  const n = sec(seconds), f0 = NOTE(37);
  const y = new Float64Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / FS;
    const f = f0 * (1 + 1.4 * Math.exp(-t / 0.009));
    ph += 2 * Math.PI * f / FS;
    const env = smooth(t / 0.0015) * (t < 0.04 ? 1 : Math.exp(-(t - 0.04) / 0.62));
    const x = Math.sin(ph) + 0.06 * Math.sin(2 * ph + 0.3);
    y[i] = env * Math.tanh(2.0 * x) / Math.tanh(2.0);
  }
  return taper(lp(hp(y, 25), 1800), 0.2, 60);
}

function kick(): Wave {
  // Garage kick: 140->58 Hz body with a fast 0.11 s decay (the 808 owns the sub), knock and click.
  const n = sec(0.36);
  const os = 4, N = n * os, R = FS * os;
  const y = new Float64Array(N);
  let ph = 0;
  for (let i = 0; i < N; i++) {
    const t = i / R;
    const f = 62 + 110 * Math.exp(-t / 0.024) + 900 * Math.exp(-t / 0.0022);
    ph += 2 * Math.PI * f / R;
    const body = Math.exp(-t / 0.085) * smooth(t / 0.0006);
    const knock = 0.32 * Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t / 0.016);
    y[i] = Math.tanh(1.7 * (body * Math.sin(ph) + knock)) / Math.tanh(1.7);
  }
  const down = decimate4(y);
  const click = bp(noise(n, 1801), 4200, 1.1);
  for (let i = 0; i < n; i++) down[i] += 0.6 * click[i] * Math.exp(-i / FS / 0.0025);
  return taper(hp(down, 32), 0.1, 40);
}

function clapChannel(seed: number): Wave {
  const n = sec(0.42);
  const nz = noise(n, seed);
  const body = bp(bp(nz, 1100, 1.2), 1600, 0.9);
  const top = lp(hp(nz, 3000), 8000);
  const crack = bp(nz, 3000, 1.1);
  const y = new Float64Array(n);
  const bursts = [0, 0.0085, 0.0175, 0.026];
  for (let i = 0; i < n; i++) {
    const t = i / FS;
    let e = 0;
    for (const b of bursts) if (t >= b) e = Math.max(e, Math.exp(-(t - b) / 0.0045));
    const tail = t >= 0.026 ? Math.exp(-(t - 0.026) / 0.115) * 0.62 : 0;
    y[i] = (e + tail) * (1.0 * body[i] + 0.07 * top[i]) + e * 0.45 * crack[i];
  }
  return taper(y, 0.2, 30);
}

function snare(): Wave {
  const n = sec(0.32);
  const y = new Float64Array(n);
  let ph1 = 0, ph2 = 0;
  const nz = lp(hp(noise(n, 1901), 1400), 7500);
  const snap = bp(noise(n, 1902), 4300, 0.9);
  for (let i = 0; i < n; i++) {
    const t = i / FS;
    ph1 += 2 * Math.PI * (190 + 60 * Math.exp(-t / 0.01)) / FS;
    ph2 += 2 * Math.PI * (330 + 40 * Math.exp(-t / 0.01)) / FS;
    const tone = (Math.sin(ph1) + 0.5 * Math.sin(ph2)) * Math.exp(-t / 0.055);
    y[i] = 0.9 * tone + 0.45 * nz[i] * Math.exp(-t / 0.12) + 0.35 * snap[i] * Math.exp(-t / 0.012);
  }
  return taper(y, 0.1, 30);
}

function rim(): Wave {
  const n = sec(0.13);
  const y = new Float64Array(n);
  const click = bp(noise(n, 2001), 3800, 1.5);
  for (let i = 0; i < n; i++) {
    const t = i / FS;
    y[i] = Math.sin(2 * Math.PI * 1720 * t) * Math.exp(-t / 0.016) + 0.7 * Math.sin(2 * Math.PI * 810 * t + 0.4) * Math.exp(-t / 0.03)
      + 0.5 * click[i] * Math.exp(-t / 0.003);
  }
  return taper(hp(y, 300), 0.1, 15);
}

function metal(n: number, seed: number, decay: number): Wave {
  // Six detuned squares (808 ratios) at 4x rate, band-limited by decimation, then 7-14 kHz band.
  const os = 4, N = n * os, R = FS * os;
  const freqs = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0].map(f => f * 1.62);
  const y = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / R;
    let s = 0;
    for (let k = 0; k < freqs.length; k++) s += Math.sin(2 * Math.PI * freqs[k] * t + k) >= 0 ? 1 : -1;
    y[i] = s / freqs.length;
  }
  const d = decimate4(y);
  const nz = noise(n, seed);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = 0.8 * d[i] + 0.3 * nz[i];
  const band = lp(hp(hp(out, 5600), 5600), 12500);
  for (let i = 0; i < n; i++) {
    const t = i / FS;
    band[i] *= smooth(t / 0.0004) * Math.exp(-t / decay);
  }
  return band;
}

function shaker(): Wave {
  const n = sec(0.12);
  const nz = bp(bp(noise(n, 2201), 7200, 1.1), 9000, 1.3);
  for (let i = 0; i < n; i++) {
    const t = i / FS;
    nz[i] *= smooth(t / 0.011) * Math.exp(-Math.max(0, t - 0.011) / 0.032);
  }
  return taper(nz, 0.1, 10);
}

const SOUNDS: Sound[] = [
  ...voxSyllables.map((s, idx): Sound => ({
    file: `opus-vox/${String(idx + 1).padStart(2, '0')}-${s.name}.wav`, name: s.name, pitch: 60 + idx, seed: s.seed, peak: -6, recipe: s.recipe,
    make: () => [syllable(s, s.seed)],
  })),
  { file: 'opus-vox/13-breath-in.wav', name: 'breath-in', pitch: 72, seed: 1701, peak: -6, recipe: 'Inhale: noise through rising 650->900 / 1400->1900 Hz and 2.9 kHz resonators plus air, level rising as t^1.6, 25 ms cut.', make: () => [breathIn()] },
  ...[{ name: 'da-x', pitch: VOX_PITCH, onset: 'd' as const, from: 'e', to: 'a', seconds: 0.06, seed: 1403, recipe: 'Stutter slice "da": 60 ms, 12 ms burst, 30 ms e->a transition, 20 ms release (for 32nd-note repeats).' }].map((s): Sound => ({
    file: 'opus-vox/14-da-x.wav', name: s.name, pitch: 73, seed: s.seed, peak: -6, recipe: s.recipe, make: () => [syllable(s, s.seed)],
  })),
  { file: 'opus-bass/sub-808-cs2.wav', seed: 0, peak: -5, recipe: 'C#2 (69.30 Hz) sine, +140% pitch punch (tau 9 ms), tanh(2x) soft clip, 40 ms hold, 0.62 s exponential body, 1.8 kHz low-pass, 2.4 s.', make: () => [sub808(2.4)] },
  { file: 'opus-drums/kick.wav', name: 'kick', pitch: 36, seed: 1801, peak: -4, recipe: 'Body 62 Hz + 110 Hz (tau 24 ms) + 900 Hz (tau 2.2 ms) sweep at 4x, 85 ms decay, 185 Hz knock (16 ms), tanh(1.7), 4.2 kHz click, 32 Hz high-pass.', make: () => [kick()] },
  { file: 'opus-drums/clap.wav', name: 'clap', pitch: 39, seed: 2101, peak: -5, recipe: 'Four noise bursts (0/8.5/17.5/26 ms, tau 4.5 ms) and a 115 ms tail through 1.1/1.6 kHz band-passes plus 3-8 kHz air, a 3 kHz crack on the bursts; decorrelated L/R noise.', make: () => [clapChannel(2101), clapChannel(2102)] },
  { file: 'opus-drums/snare.wav', name: 'snare', pitch: 38, seed: 1901, peak: -5, recipe: '190/330 Hz drum tones (55 ms), 1.4-7.5 kHz noise (120 ms), 4.3 kHz snap.', make: () => [snare()] },
  { file: 'opus-drums/rim.wav', name: 'rim', pitch: 37, seed: 2001, peak: -7, recipe: '1720 Hz (16 ms) + 810 Hz (30 ms) partials with a 3.8 kHz click.', make: () => [rim()] },
  { file: 'opus-drums/hat-closed.wav', name: 'hat', pitch: 42, seed: 2301, peak: -8, recipe: 'Six square oscillators at 1.62x the 808 hat ratios (4x rate, decimated) + noise, double 5.6 kHz high-pass, 12.5 kHz low-pass, 32 ms decay.', make: () => [taper(metal(sec(0.11), 2301, 0.032), 0.05, 8)] },
  { file: 'opus-drums/hat-open.wav', name: 'hat-open', pitch: 46, seed: 2302, peak: -10, recipe: 'Same metal source, 210 ms decay.', make: () => [taper(metal(sec(0.6), 2302, 0.21), 0.05, 40)] },
  { file: 'opus-drums/shaker.wav', name: 'shaker', pitch: 70, seed: 2201, peak: -10, recipe: 'Noise through 7.2/9 kHz band-passes, 11 ms swell, 32 ms decay.', make: () => [shaker()] },
];

const GLASS_COPIES = ['01-glass-hit.wav', '02-glass-reverse.wav', '10-prism-impact.wav'];

function sha256(b: Buffer): string { return createHash('sha256').update(b).digest('hex'); }

export function generate(): void {
  for (const dir of ['opus-vox', 'opus-bass', 'opus-drums']) rmSync(join(ASSETS, dir), { recursive: true, force: true });
  const catalog: Record<string, unknown>[] = [];
  const kits: Record<string, { name: string; pitch: number; file: string }[]> = {};
  for (const s of SOUNDS) {
    const chans = s.make();
    const pcm = toPcm(chans, s.peak);
    const path = join(ASSETS, s.file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, pcm);
    const kitDir = s.file.split('/')[0];
    if (s.name !== undefined && s.pitch !== undefined) (kits[kitDir] ??= []).push({ name: s.name, pitch: s.pitch, file: s.file.split('/').slice(1).join('/') });
    catalog.push({ file: `assets/${s.file}`, name: s.name ?? null, seed: s.seed, channels: chans.length, frames: chans[0].length, seconds: +(chans[0].length / FS).toFixed(6), peakDbfs: s.peak, recipe: s.recipe, sha256: sha256(pcm), bytes: pcm.length });
  }
  for (const [dir, samples] of Object.entries(kits)) {
    writeFileSync(join(ASSETS, dir, 'kit.json'), JSON.stringify({ formatVersion: 1, samples }, null, 2) + '\n');
  }
  const shipped = JSON.parse(readFileSync(join(REPO, 'examples', 'glasshouse.catalog.json'), 'utf8')) as { sounds: { file: string; sha256: string }[] };
  mkdirSync(join(ASSETS, 'glasshouse'), { recursive: true });
  for (const f of GLASS_COPIES) {
    const src = join(REPO, 'examples', 'assets', 'glasshouse', f);
    const dst = join(ASSETS, 'glasshouse', f);
    copyFileSync(src, dst);
    const got = sha256(readFileSync(dst));
    const want = shipped.sounds.find(s => s.file.endsWith(f))?.sha256;
    if (got !== want) throw new Error(`GLASSHOUSE copy ${f} does not match the shipped catalog hash`);
    catalog.push({ file: `assets/glasshouse/${f}`, name: null, copiedFrom: `examples/assets/glasshouse/${f}`, unmodified: true, sha256: got, bytes: readFileSync(dst).length });
  }
  copyFileSync(join(REPO, 'examples', 'assets', 'glasshouse', 'LICENSE'), join(ASSETS, 'glasshouse', 'LICENSE'));
  // A project-local kit over the copied files (the shipped kit.json is not copied or changed).
  writeFileSync(join(ASSETS, 'glasshouse', 'glass-kit.json'), JSON.stringify({ formatVersion: 1, samples: [
    { name: 'glass-hit', pitch: 81, file: '01-glass-hit.wav' },
    { name: 'glass-reverse', pitch: 80, file: '02-glass-reverse.wav' },
    { name: 'prism-impact', pitch: 79, file: '10-prism-impact.wav' },
  ] }, null, 2) + '\n');
  writeFileSync(join(ROOT, 'assets.catalog.json'), JSON.stringify({
    generator: relative(ROOT, fileURLToPath(import.meta.url)),
    sampleRate: FS, bitsPerSample: 16,
    provenance: 'Synthesized in this repository from closed-form oscillators, biquads and xorshift32 seeds. GLASSHOUSE files are unmodified copies of the shipped CC0 pack.',
    voxBasePitch: 'G#4 (MIDI 68, 415.30 Hz); the score transposes every syllable with playbackRate = 2^(semitones/12)',
    sounds: catalog,
  }, null, 2) + '\n');
}

generate();
