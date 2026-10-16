#!/usr/bin/env node
// SIGNAL instrument prototype: three small sustained-instrument families for DaemonV12 0.7.
//   node generate-signal-instruments.mjs <output-directory>
// Writes <out>/assets/signal-lab/{pad,lead,swell}/*.wav plus a kit.json per family,
// and <out>/signal-lab.catalog.json (kept outside assets/, as the bundled packs do).
//
// Pure additive synthesis in float64 at 44.1 kHz. Every partial is a sine kept
// below 18 kHz, so nothing aliases. All randomness comes from explicit xorshift32
// seeds; there is no Math.random, clock, input file, recording or download.
// PCM16 by explicit rounding, no dither. First and last frames are exactly zero.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const GENERATOR = 'generate-signal-instruments.mjs';
const GENERATOR_VERSION = '0.2.0';
const SR = 44100;
const TAU = 2 * Math.PI;
const MAX_PARTIALS = 64;
const MAX_HZ = 18000;
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'E#', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const midiHz = m => 440 * 2 ** ((m - 69) / 12);
const noteName = m => (m % 12 === 5 ? 'E#' : NAMES[m % 12]) + (Math.floor(m / 12) - 1);
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (a, b, t) => { const u = clamp01((t - a) / (b - a)); return u * u * (3 - 2 * u); };
const fadeIn = (a, b, t) => Math.sin((Math.PI / 2) * clamp01((t - a) / (b - a)));   // equal-power
const fadeOut = (a, b, t) => Math.cos((Math.PI / 2) * clamp01((t - a) / (b - a)));

function xorshift32(seed) {
  let s = seed >>> 0 || 0x9e3779b9;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// Cosine-interpolated value noise in [-1, 1]: smooth, seeded, slow modulation.
function smoothNoise(rng, rateHz, seconds) {
  const n = Math.ceil(seconds * rateHz) + 3;
  const pts = new Float64Array(n);
  for (let i = 0; i < n; i++) pts[i] = rng() * 2 - 1;
  return t => {
    const x = Math.max(0, t) * rateHz, i = Math.floor(x), f = x - i, w = (1 - Math.cos(Math.PI * f)) / 2;
    return pts[i] * (1 - w) + pts[i + 1] * w;
  };
}

// Sum of a harmonic series with time-varying f0 and per-partial amplitudes.
// harmAmps(t, f0, arr) fills arr[1..MAX_PARTIALS]; gainAt(t) is the overall envelope.
// Amplitudes are recomputed every `block` samples and ramped linearly inside the block.
function additive(len, f0At, gainAt, harmAmps, rng, block = 32) {
  const out = new Float64Array(len);
  const phase = new Float64Array(MAX_PARTIALS + 1);
  for (let n = 1; n <= MAX_PARTIALS; n++) phase[n] = rng() * TAU;
  let prev = new Float64Array(MAX_PARTIALS + 1), cur = new Float64Array(MAX_PARTIALS + 1);
  const fill = (t, f, arr) => {
    harmAmps(t, f, arr);
    const g = gainAt(t);
    for (let n = 1; n <= MAX_PARTIALS; n++) arr[n] = n * f < MAX_HZ && arr[n] > 1e-4 ? arr[n] * g : 0;
  };
  fill(0, f0At(0), prev);
  for (let b = 0; b < len; b += block) {
    const bl = Math.min(block, len - b);
    const f = f0At((b + bl / 2) / SR);
    fill((b + bl) / SR, f, cur);
    for (let n = 1; n <= MAX_PARTIALS; n++) {
      const dp = (TAU * n * f) / SR;
      if (prev[n] === 0 && cur[n] === 0) { phase[n] = (phase[n] + dp * bl) % TAU; continue; }
      const da = (cur[n] - prev[n]) / bl;
      let p = phase[n], a = prev[n];
      for (let i = 0; i < bl; i++) { a += da; out[b + i] += a * Math.sin(p); p += dp; }
      phase[n] = p % TAU;
    }
    const tmp = prev; prev = cur; cur = tmp;
  }
  return out;
}

const formantGain = (fHz, formants) => {
  let w = 1;
  for (const [F, g, B] of formants) w += g * Math.exp(-0.5 * ((fHz - F) / B) ** 2);
  return w;
};

// Two-pole resonant band-pass (RBJ constant-peak), deterministic float64.
function bandpass(x, fc, q) {
  const w = (TAU * fc) / SR, alpha = Math.sin(w) / (2 * q), a0 = 1 + alpha;
  const b0 = alpha / a0, b2 = -alpha / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - alpha) / a0;
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

function zeroEndpoints(chs, taper = 64) {
  for (const c of chs) {
    const n = c.length;
    for (let i = 0; i < taper; i++) { const w = i / taper; c[i] *= w; c[n - 1 - i] *= w; }
    c[0] = 0; c[n - 1] = 0;
  }
}

function normalize(chs, peakDbfs) {
  let pk = 0;
  for (const c of chs) for (let i = 0; i < c.length; i++) pk = Math.max(pk, Math.abs(c[i]));
  const g = 10 ** (peakDbfs / 20) / pk;
  for (const c of chs) for (let i = 0; i < c.length; i++) c[i] *= g;
}

// Equal loudness across pitches: scale so the 1-3 s sustain sits at a target RMS (peak-capped).
function normalizeSustain(chs, rmsDbfs, ceilingDbfs, [a, b]) {
  let ss = 0, n = 0, pk = 0;
  for (const c of chs) { for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) { ss += c[i] * c[i]; n++; } for (let i = 0; i < c.length; i++) pk = Math.max(pk, Math.abs(c[i])); }
  let g = 10 ** (rmsDbfs / 20) / Math.sqrt(ss / n);
  g = Math.min(g, 10 ** (ceilingDbfs / 20) / pk);
  for (const c of chs) for (let i = 0; i < c.length; i++) c[i] *= g;
}

function wavBytes(chs) {
  const ch = chs.length, n = chs[0].length, data = n * ch * 2;
  const buf = Buffer.alloc(44 + data);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + data, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(ch, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * ch * 2, 28); buf.writeUInt16LE(ch * 2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(data, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const v = Math.max(-32768, Math.min(32767, Math.round(chs[c][i] * 32767)));
    buf.writeInt16LE(v, o); o += 2;
  }
  return buf;
}

// Measurements stored in the catalog (computed from the quantized PCM).
function measure(bytes, ch) {
  const n = (bytes.length - 44) / (2 * ch), L = new Float64Array(n), R = new Float64Array(n);
  for (let i = 0; i < n; i++) { L[i] = bytes.readInt16LE(44 + i * ch * 2) / 32768; R[i] = ch === 2 ? bytes.readInt16LE(46 + i * ch * 2) / 32768 : L[i]; }
  let pk = 0, ss = 0, sm = 0, sd = 0;
  for (let i = 0; i < n; i++) {
    pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
    ss += (L[i] * L[i] + R[i] * R[i]) / 2;
    const m = (L[i] + R[i]) / 2, s = (L[i] - R[i]) / 2; sm += m * m; sd += s * s;
  }
  const db = v => Math.round(200 * Math.log10(Math.max(v, 1e-12))) / 10;
  return {
    frames: n, seconds: n / SR, peakDbfs: db(pk), rmsDbfs: db(Math.sqrt(ss / n)),
    ...(ch === 2 ? { sideEnergyPercent: Math.round((1000 * sd) / (sm + sd)) / 10, monoSumMinusStereoRmsDb: Math.round(10 * (db(Math.sqrt(sm / n)) - db(Math.sqrt(ss / n)))) / 10 } : {}),
    firstFrameZero: L[0] === 0 && R[0] === 0, lastFrameZero: L[n - 1] === 0 && R[n - 1] === 0,
  };
}

// ---------------------------------------------------------------- EXPRESSIVE LEAD
// A bowed-glass voice: harmonic body with fixed (pitch-independent) alto/viola formants,
// a 30-cent onset scoop, delayed vibrato, a bow-bite accent then swell, loudness-linked
// brightness, a brief inharmonic glass-mode sheen on the attack (the GLASSHOUSE glass bar
// ratios 2.756 / 5.404 / 8.933) and band-limited bow/breath noise. Mono, 4.0 s.
const LEAD = {
  seconds: 4.0, sustainRmsDbfs: -14, peakCeilingDbfs: -3, releaseStart: 3.35,
  scoopCents: -20, scoopTau: 0.025, biteGain: 0.25, biteTau: 0.06, vibratoDelay: [0.30, 1.10], vibratoCents: 14, vibratoHz: 5.3, vibratoHzSpread: 0.4,
  formants: [[600, 2.0, 220], [1400, 2.6, 380], [3000, 1.8, 700]], slope: 0.95, evenGain: 0.82,
  brightnessHz: [2600, 5200], sheenRatios: [2.756, 5.404, 8.933], sheenAmps: [0.30, 0.14, 0.06], sheenTau: [0.30, 0.18, 0.10],
  noiseCenterHz: 2600, noiseQ: 1.2, noiseAttackDb: -18, noiseSustainDb: -32,
};
function makeLead(midi, seed) {
  const P = LEAD, len = Math.round(P.seconds * SR), rng = xorshift32(seed), fN = midiHz(midi);
  const wob = smoothNoise(rng, 0.7, P.seconds), jit = smoothNoise(rng, 7, P.seconds);
  const vibDepth = t => smoothstep(P.vibratoDelay[0], P.vibratoDelay[1], t);
  const vibHz = P.vibratoHz + P.vibratoHzSpread * (rng() - 0.5);   // seeded per-pitch vibrato rate
  const vibPhase = t => TAU * vibHz * t + 0.8 * wob(t);
  const cents = t => P.scoopCents * Math.exp(-t / P.scoopTau) + 3 * Math.exp(-(((t - 0.12) / 0.05) ** 2))
    + P.vibratoCents * vibDepth(t) * Math.sin(vibPhase(t)) + 1.5 * jit(t);
  const f0At = t => fN * 2 ** (cents(t) / 1200);
  const rel = t => (t < P.releaseStart ? 1 : 0.5 * (1 + Math.cos((Math.PI * (t - P.releaseStart)) / (P.seconds - P.releaseStart))));
  const env = t => (1 - Math.exp(-t / 0.008)) * (1 + P.biteGain * Math.exp(-t / P.biteTau)) * (0.86 + 0.14 * smoothstep(0.25, 1.8, t))
    * (1 + 0.035 * vibDepth(t) * Math.sin(vibPhase(t) + 0.9)) * rel(t);
  const harm = (t, f, arr) => {
    const fc = P.brightnessHz[0] + (P.brightnessHz[1] - P.brightnessHz[0]) * smoothstep(0.05, 1.6, t);
    for (let n = 1; n <= MAX_PARTIALS; n++) {
      const fn = n * f;
      arr[n] = n ** -P.slope * (n % 2 === 0 ? P.evenGain : 1) * formantGain(fn, P.formants) * Math.exp(-((fn / fc) ** 2) * 0.5);
    }
  };
  const tone = additive(len, f0At, env, harm, rng);
  // glass-mode sheen on the attack
  for (let k = 0; k < P.sheenRatios.length; k++) {
    let p = rng() * TAU;
    for (let i = 0; i < len; i++) {
      const t = i / SR; tone[i] += P.sheenAmps[k] * 2.2 * Math.exp(-t / P.sheenTau[k]) * (1 - Math.exp(-t / 0.004)) * Math.sin(p);
      p += (TAU * P.sheenRatios[k] * f0At(t)) / SR;
    }
  }
  // bow/breath noise, scaled against the tone's sustained RMS
  let ss = 0; for (let i = Math.round(SR); i < Math.round(3 * SR); i++) ss += tone[i] * tone[i];
  const toneRms = Math.sqrt(ss / Math.round(2 * SR));
  const white = new Float64Array(len); for (let i = 0; i < len; i++) white[i] = rng() * 2 - 1;
  const bp = bandpass(white, P.noiseCenterHz, P.noiseQ);
  let sn = 0; for (let i = 0; i < len; i++) sn += bp[i] * bp[i];
  const bpRms = Math.sqrt(sn / len), aA = 10 ** (P.noiseAttackDb / 20), aS = 10 ** (P.noiseSustainDb / 20);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    tone[i] += (bp[i] / bpRms) * toneRms * (aA * Math.exp(-t / 0.03) * (1 - Math.exp(-t / 0.003)) + aS * env(t));
  }
  const chs = [tone]; zeroEndpoints(chs); normalizeSustain(chs, P.sustainRmsDbfs, P.peakCeilingDbfs, [1.0, 3.0]); zeroEndpoints(chs, 1);
  return chs;
}

// ---------------------------------------------------------------- ensemble helper
// Each chord tone = three detuned voices (left-leaning, centre, right-leaning) with slow
// seeded drift; tones below 200 Hz are kept centred so the low end stays mono.
const ENSEMBLE = { detuneCents: [-7, 0, 6.5], driftCents: 2.5, driftHz: 0.25, pans: [[1.0, 0.32], [0.8, 0.8], [0.32, 1.0]], monoBelowHz: 200 };
function ensembleTone(L, R, { midiAt, gainAt, harm, rng, seconds }) {
  const len = L.length;
  const low = midiHz(midiAt(0)) < ENSEMBLE.monoBelowHz;
  ENSEMBLE.detuneCents.forEach((det, v) => {
    const drift = smoothNoise(rng, ENSEMBLE.driftHz, seconds);
    const d = low ? det * 0.5 : det;
    const f0At = t => midiHz(midiAt(t)) * 2 ** ((d + ENSEMBLE.driftCents * drift(t)) / 1200);
    const sig = additive(len, f0At, gainAt, harm, rng);
    const [gl, gr] = low ? [0.78, 0.78] : ENSEMBLE.pans[v];
    for (let i = 0; i < len; i++) { L[i] += gl * sig[i]; R[i] += gr * sig[i]; }
  });
}

// ---------------------------------------------------------------- EVOLVING PAD
// A string-choir hybrid. The chord opens as sus2 (C# D# G#) and the third arrives at
// 1.4-2.4 s (E for minor, E# for major): the "one note changes" idea of SIGNAL, inside the
// instrument. Internal movement: spectral tilt opens then settles, a vowel formant pair
// morphs oo -> ah -> eh -> oo, odd/even balance breathes, and each partial has its own
// slow seeded shimmer. 8.0 s, stereo; release 6.0-8.0 s to exact zero.
const PAD = {
  seconds: 8.0, peakDbfs: -8, attack: 1.0, releaseStart: 6.0, thirdCrossfade: [1.4, 2.4], lowpassHz: 8500,
  tilt: [[0, 1.45], [3.6, 0.9], [8, 1.15]], vowels: [[0, 350, 820], [3.0, 720, 1150], [5.5, 520, 1700], [8, 380, 900]],
  formantGains: [2.4, 1.6], formantBw: [140, 260], shimmerDepth: 0.3, shimmerHz: [0.15, 0.55],
};
const PAD_VOICING = third => [
  { midi: 49, gain: 0.7 }, { midi: 56, gain: 0.7 }, { midi: 61, gain: 0.7 },
  { midi: 63, gain: 0.66, out: true }, { midi: third, gain: 0.66, in: true }, { midi: 68, gain: 0.55 },
];
const interp = (pts, t) => {
  if (t <= pts[0][0]) return pts[0].slice(1);
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) {
    const [t0, ...a] = pts[i - 1], [t1, ...b] = pts[i], w = smoothstep(t0, t1, t);
    return a.map((v, k) => v + (b[k] - v) * w);
  }
  return pts[pts.length - 1].slice(1);
};
function makePad(third, seed) {
  const P = PAD, len = Math.round(P.seconds * SR), rng = xorshift32(seed);
  const L = new Float64Array(len), R = new Float64Array(len);
  const env = t => Math.sin((Math.PI / 2) * clamp01(t / P.attack)) ** 2 * (1 + 0.08 * Math.sin(Math.PI * clamp01(t / 7)))
    * (t < P.releaseStart ? 1 : 0.5 * (1 + Math.cos((Math.PI * (t - P.releaseStart)) / (P.seconds - P.releaseStart))));
  for (const tone of PAD_VOICING(third)) {
    const shimmer = Array.from({ length: MAX_PARTIALS + 1 }, () => smoothNoise(rng, P.shimmerHz[0] + rng() * (P.shimmerHz[1] - P.shimmerHz[0]), P.seconds));
    const oddEven = smoothNoise(rng, 0.09, P.seconds);
    const harm = (t, f, arr) => {
      const [tilt] = interp(P.tilt, t), [F1, F2] = interp(P.vowels, t), oe = 0.78 + 0.22 * oddEven(t);
      const fm = [[F1, P.formantGains[0], P.formantBw[0]], [F2, P.formantGains[1], P.formantBw[1]]];
      for (let n = 1; n <= MAX_PARTIALS; n++) {
        const fn = n * f;
        arr[n] = n ** -tilt * (n % 2 === 0 ? oe : 1) * formantGain(fn, fm) * (1 + P.shimmerDepth * shimmer[n](t)) * Math.exp(-((fn / P.lowpassHz) ** 2));
      }
    };
    const [a, b] = P.thirdCrossfade;
    const xf = t => (tone.out ? fadeOut(a, b, t) : tone.in ? fadeIn(a, b, t) : 1);
    ensembleTone(L, R, { midiAt: () => tone.midi, gainAt: t => tone.gain * env(t) * xf(t), harm, rng, seconds: P.seconds });
  }
  const chs = [L, R]; zeroEndpoints(chs); normalize(chs, P.peakDbfs); zeroEndpoints(chs, 1);
  return chs;
}

// ---------------------------------------------------------------- HARMONIC SWELL
// Bowed-ensemble crescendo (-24 dB -> 0 dB) whose harmony moves while it grows; spectral
// tilt opens with loudness. It ends AT full level with a 12 ms taper, so it can butt into a
// downbeat or a hard cut. No noise riser: the build is voices, harmony and bowing.
//   dark:   G#5 (open) -> + F#4 and C#5 (G#7sus4, 1.2 s) -> C#5 slides to B#4 and A4 enters (G#7b9, 2.6 s);
//           tremolo accelerates 3 -> 11 Hz ("radio flutter").
//   bright: A major (add9) -> every voice slides up a whole step into B major at 1.0 s;
//           the top climbs C#5 -> D#5 at 2.0 s; vibrato deepens.
const SWELL = { seconds: 4.0, peakDbfs: -6, startDb: -24, curve: 1.7, tilt: [2.1, 0.95], endTaper: 0.012, lowpassHz: 9000 };
const SWELL_VOICES = {
  dark: [
    { midi: 56, t0: 0, t1: 4, gain: 0.9 }, { midi: 63, t0: 0, t1: 4, gain: 0.7 },
    { midi: 66, t0: 1.2, t1: 4, gain: 0.6 }, { midi: 73, t0: 1.2, t1: 4, gain: 0.62, glides: [{ at: 2.6, to: 72, dur: 0.18 }] },
    { midi: 69, t0: 2.6, t1: 4, gain: 0.58 },
  ],
  bright: [
    { midi: 52, t0: 0, t1: 4, gain: 0.8, glides: [{ at: 1.0, to: 54, dur: 0.15 }] },
    { midi: 57, t0: 0, t1: 4, gain: 0.75, glides: [{ at: 1.0, to: 59, dur: 0.15 }] },
    { midi: 61, t0: 0, t1: 4, gain: 0.7, glides: [{ at: 1.0, to: 63, dur: 0.15 }] },
    { midi: 64, t0: 0, t1: 4, gain: 0.65, glides: [{ at: 1.0, to: 66, dur: 0.15 }] },
    { midi: 71, t0: 0, t1: 4, gain: 0.6, glides: [{ at: 1.0, to: 73, dur: 0.15 }, { at: 2.0, to: 75, dur: 0.15 }] },
  ],
};
const TREMOLO = { dark: { fromHz: 3, toHz: 11, maxDepth: 0.4 }, bright: null };
const VIBRATO = { dark: null, bright: { hz: 5.6, maxCents: 12 } };
function makeSwell(kind, seed) {
  const P = SWELL, T = P.seconds, len = Math.round(T * SR), rng = xorshift32(seed);
  const L = new Float64Array(len), R = new Float64Array(len);
  const u = t => clamp01(t / T);
  const cresc = t => 10 ** ((P.startDb * (1 - u(t) ** P.curve)) / 20);
  const trem = TREMOLO[kind], vib = VIBRATO[kind];
  const tremAt = t => (trem ? 1 - trem.maxDepth * u(t) * 0.5 * (1 + Math.sin(TAU * (trem.fromHz * t + ((trem.toHz - trem.fromHz) / (2 * T)) * t * t))) : 1);
  for (const v of SWELL_VOICES[kind]) {
    const midiAt = t => { let m = v.midi, from = v.midi; for (const g of v.glides ?? []) { m += (g.to - from) * smoothstep(g.at, g.at + g.dur, t); from = g.to; } return m; };
    const vibAt = t => (vib ? vib.maxCents * u(t) ** 1.5 * Math.sin(TAU * vib.hz * t + v.midi) : 0);
    const harm = (t, f, arr) => {
      const tilt = P.tilt[0] + (P.tilt[1] - P.tilt[0]) * u(t) ** 1.2;
      for (let n = 1; n <= MAX_PARTIALS; n++) arr[n] = n ** -tilt * (n % 2 === 0 ? 0.85 : 1) * Math.exp(-(((n * f) / P.lowpassHz) ** 2));
    };
    const gate = t => (v.t0 > 0 ? fadeIn(v.t0, v.t0 + 0.25, t) : 1) * (v.t1 < T ? fadeOut(v.t1 - 0.25, v.t1, t) : 1);
    const midiWithVib = t => midiAt(t) + vibAt(t) / 100;
    ensembleTone(L, R, { midiAt: midiWithVib, gainAt: t => v.gain * cresc(t) * tremAt(t) * gate(t), harm, rng, seconds: T });
  }
  const chs = [L, R];
  const lead = Math.round(0.006 * SR);                     // 6 ms fade-in: no step at the first frames
  for (const c of chs) for (let i = 0; i < lead; i++) c[i] *= i / lead;
  normalize(chs, P.peakDbfs);
  const tap = Math.round(P.endTaper * SR);
  for (const c of chs) for (let i = 0; i < tap; i++) c[len - 1 - i] *= i / tap;
  zeroEndpoints(chs, 1);
  return chs;
}

// ---------------------------------------------------------------- build
const ASSETS = [
  { id: 'pad-csm', family: 'pad', file: 'pad/pad-csm.wav', kitPitch: 49, seed: 0x51a1c0de, chord: 'C# minor (opens sus2: C# D# G#; E arrives 1.4-2.4 s)', voicing: PAD_VOICING(64).map(v => noteName(v.midi)), make: () => makePad(64, 0x51a1c0de), synthesis: { recipe: 'PAD', params: PAD, ensemble: ENSEMBLE } },
  { id: 'pad-cs', family: 'pad', file: 'pad/pad-cs.wav', kitPitch: 50, seed: 0x51a1c0df, chord: 'C# major (opens sus2: C# D# G#; E# arrives 1.4-2.4 s)', voicing: PAD_VOICING(65).map(v => noteName(v.midi)), make: () => makePad(65, 0x51a1c0df), synthesis: { recipe: 'PAD', params: PAD, ensemble: ENSEMBLE } },
  ...[61, 64, 65, 68, 69].map((m, i) => ({
    id: `lead-${noteName(m).replace('#', 's').toLowerCase()}`, family: 'lead', file: `lead/lead-${noteName(m).replace('#', 's').toLowerCase()}.wav`, kitPitch: m,
    seed: 0x1ead0000 + i, pitch: noteName(m), hz: Math.round(midiHz(m) * 1000) / 1000, make: () => makeLead(m, 0x1ead0000 + i), synthesis: { recipe: 'LEAD', params: LEAD },
  })),
  { id: 'swell-dark', family: 'swell', file: 'swell/swell-dark.wav', kitPitch: 56, seed: 0x5e11da7c, chord: 'G#5 -> G#7sus4 -> G#7b9 (dominant of C# minor)', voices: SWELL_VOICES.dark, make: () => makeSwell('dark', 0x5e11da7c), synthesis: { recipe: 'SWELL', params: SWELL, tremolo: TREMOLO.dark, ensemble: ENSEMBLE } },
  { id: 'swell-bright', family: 'swell', file: 'swell/swell-bright.wav', kitPitch: 57, seed: 0x5e11b417, chord: 'A(add9) -> B major (bVI -> bVII of C#), top climbs B4 -> C#5 -> D#5', voices: SWELL_VOICES.bright, make: () => makeSwell('bright', 0x5e11b417), synthesis: { recipe: 'SWELL', params: SWELL, vibrato: VIBRATO.bright, ensemble: ENSEMBLE } },
];

const out = process.argv[2];
if (!out) { console.error('usage: node generate-signal-instruments.mjs <output-directory>'); process.exit(2); }
const root = join(out, 'assets', 'signal-lab');
const entries = [];
for (const a of ASSETS) {
  const chs = a.make();
  const bytes = wavBytes(chs);
  mkdirSync(join(root, a.family), { recursive: true });
  writeFileSync(join(root, a.file), bytes);
  const { make, ...meta } = a;
  entries.push({ ...meta, channels: chs.length, sha256: createHash('sha256').update(bytes).digest('hex'), measured: measure(bytes, chs.length) });
  process.stderr.write(`${a.file}\n`);
}
const kits = [];
for (const fam of ['pad', 'lead', 'swell']) {
  const kit = { formatVersion: 1, samples: entries.filter(e => e.family === fam).map(e => ({ name: e.id, pitch: e.kitPitch, file: e.file.split('/')[1] })) };
  const text = JSON.stringify(kit, null, 2) + '\n';
  writeFileSync(join(root, fam, 'kit.json'), text);
  kits.push({ family: fam, file: `${fam}/kit.json`, sha256: createHash('sha256').update(text).digest('hex') });
}
const catalog = {
  schema: 'signal-lab.catalog/1', name: 'SIGNAL instrument prototype', generator: GENERATOR, generatorVersion: GENERATOR_VERSION,
  sampleRate: SR, format: 'RIFF PCM16 little-endian', tuning: 'A4 = 440 Hz, 12-TET',
  provenance: 'Generated entirely by this script with deterministic float64 additive synthesis and explicit xorshift32 seeds. No recordings, downloaded samples, loops, SoundFonts, impulse responses, pretrained-model audio, third-party audio or existing melodies contribute to these files.',
  rights: { status: 'PENDING OWNER REVIEW', note: 'No licence is granted or implied by this prototype. Commercial-use authorization and any dedication (for example CC0) are decisions for the repository owner, pending review.' },
  determinism: 'Byte-identical on repeated runs with the same Node build. Floating-point transcendental differences across Node/CPU implementations could change least-significant bits; cross-environment byte identity is not promised.',
  assets: entries,
  kits,
};
writeFileSync(join(out, 'signal-lab.catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
