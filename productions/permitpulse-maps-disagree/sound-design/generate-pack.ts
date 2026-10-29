/** PERMITPULSE // THE MAPS DISAGREE — original one-shot sound pack.
 *
 * Every sound is synthesized here from math and a seeded integer PRNG: no
 * recordings, downloaded libraries or third-party samples. Output is the only
 * format the DaemonV12 sampler accepts (RIFF PCM16, 44,100 Hz, mono or stereo).
 *
 *   node productions/permitpulse-maps-disagree/sound-design/generate-pack.ts
 *
 * Writes project/assets/permitpulse/*.wav, three kit JSON files and
 * sound-design/catalog.json (parameters, frame counts, SHA-256).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 44100, TAU = 2 * Math.PI;
const here = dirname(fileURLToPath(import.meta.url));
const production = join(here, '..');
const assetDir = join(production, 'project/assets/permitpulse');

// Tuning reference: every pitched source is rooted on D so the score repitches
// by exact equal-tempered playback rates (2^(n/12)).
const D1 = 36.708096, D2 = 73.416192, D3 = 146.832384, D4 = 293.664768, D5 = 587.329536;


function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2147483648 - 1;
  };
}
const frames = (seconds: number) => Math.round(seconds * RATE);
const decay = (t: number, t60: number) => Math.exp(-6.907755 * t / t60);

/** RBJ biquad, used only to shape noise. */
function biquad(kind: 'bp' | 'lp' | 'hp', hz: number, q: number) {
  const w = TAU * hz / RATE, cos = Math.cos(w), alpha = Math.sin(w) / (2 * q);
  let b0: number, b1: number, b2: number;
  if (kind === 'lp') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0; }
  else if (kind === 'hp') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0; }
  else { b0 = alpha; b1 = 0; b2 = -alpha; }
  const a0 = 1 + alpha, a1 = -2 * cos, a2 = 1 - alpha;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x: number) => {
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y; return y;
  };
}

interface Partial { ratio: number; amp: number; t60: number }
/** Modal resonator bank: inharmonic struck-object partials with seeded phases. */
function modal(out: Float64Array, f0: number, partials: Partial[], seed: number, drift = 0, driftTime = 0.1) {
  const random = prng(seed);
  for (const p of partials) {
    const phase0 = (random() + 1) * Math.PI;
    let phase = phase0;
    for (let i = 0; i < out.length; i++) {
      const t = i / RATE, hz = f0 * p.ratio * (1 + drift * Math.exp(-t / driftTime));
      if (hz >= RATE * 0.45) break;
      phase += TAU * hz / RATE;
      out[i]! += p.amp * Math.sin(phase) * decay(t, p.t60);
    }
  }
}
/** Band-limited sawtooth through a two-pole low-pass, computed additively (no aliasing). */
function filteredSaw(t: number, phase: number, f0: number, cutoff: number, harmonics: number) {
  let sum = 0;
  for (let k = 1; k <= harmonics; k++) {
    const hz = k * f0; if (hz > 16000) break;
    const ratio = hz / cutoff;
    sum += Math.sin(k * phase) / k / Math.sqrt(1 + ratio * ratio * ratio * ratio);
  }
  return sum;
}
function strike(out: Float64Array, seed: number, seconds: number, amp: number, centerHz: number, q: number) {
  const random = prng(seed), filter = biquad('bp', centerHz, q), n = frames(seconds);
  for (let i = 0; i < n && i < out.length; i++) out[i]! += amp * filter(random()) * Math.sin(Math.PI * i / n);
}

// ---------------------------------------------------------------- sounds
type Mono = Float64Array; type Stereo = [Float64Array, Float64Array];

/** Heartbeat LUB: deep analog thump on D2 with a sub-octave and a filtered saw body. */
function pulseLub(f0 = D2): Mono {
  const out = new Float64Array(frames(0.95)); let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE, hz = f0 * (1 + 1.1 * Math.exp(-t / 0.016));
    phase += TAU * hz / RATE;
    const cutoff = 260 + 1900 * Math.exp(-t / 0.07);
    const v = 0.9 * Math.sin(phase) + 0.45 * Math.sin(phase / 2) + 1.1 * filteredSaw(t, phase, f0, cutoff, 40);
    const env = Math.min(1, t / 0.0025) * (0.78 * decay(t, 0.9) + 0.22 * decay(t, 0.12));
    out[i] = Math.tanh(2.2 * v * env) / Math.tanh(2.2);
  }
  strike(out, 11, 0.004, 0.16, 2600, 0.9);
  return out;
}
/** Heartbeat DUB: shorter, lighter, slightly brighter second beat. */
function pulseDub(f0 = D2): Mono {
  const out = new Float64Array(frames(0.6)); let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE, hz = f0 * (1 + 0.7 * Math.exp(-t / 0.012));
    phase += TAU * hz / RATE;
    const cutoff = 320 + 2300 * Math.exp(-t / 0.05);
    const v = 0.85 * Math.sin(phase) + 0.2 * Math.sin(phase / 2) + 1.15 * filteredSaw(t, phase, f0, cutoff, 40);
    const env = Math.min(1, t / 0.002) * (0.7 * decay(t, 0.5) + 0.3 * decay(t, 0.08));
    out[i] = Math.tanh(2.1 * v * env) / Math.tanh(2.1);
  }
  strike(out, 12, 0.003, 0.18, 3400, 0.9);
  return out;
}
/** Sustained analog bass on D2: two detuned saws, sub sine, slow filter breath. */
function bassSustain(f0 = D2): Mono {
  const out = new Float64Array(frames(5.2)); let pa = 0, pb = 0, ps = 0;
  const da = 2 ** (-5 / 1200), db = 2 ** (4 / 1200);
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    pa += TAU * f0 * da / RATE; pb += TAU * f0 * db / RATE; ps += TAU * f0 / 2 / RATE;
    const cutoff = 400 + 300 * Math.exp(-t / 0.35) + 50 * Math.sin(TAU * 0.23 * t);
    const v = 0.5 * filteredSaw(t, pa, f0 * da, cutoff, 48) + 0.5 * filteredSaw(t, pb, f0 * db, cutoff, 48) + 0.55 * Math.sin(ps) + 0.35 * Math.sin(pa);
    const env = Math.min(1, t / 0.012) * (0.86 + 0.14 * Math.exp(-t / 0.25)) * Math.exp(-t / 9);
    out[i] = Math.tanh(1.6 * v * env) / Math.tanh(1.6);
  }
  return out;
}
/** Controlled sub: D1 sine with a whisper of 2nd/3rd harmonic so small speakers imply it. */
function subSine(): Mono {
  const out = new Float64Array(frames(6)); let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE; phase += TAU * D1 * (1 + 0.035 * Math.exp(-t / 0.06)) / RATE;
    const env = Math.min(1, t / 0.035) * Math.exp(-t / 3.4);
    out[i] = env * (Math.sin(phase) + 0.2 * Math.sin(2 * phase) + 0.07 * Math.sin(3 * phase));
  }
  return out;
}
/** Map A: beautiful glass with one uneasy inharmonic partial and a slow fundamental beat. */
function glassA(): Stereo {
  const make = (detune: number, beat: number, seed: number) => {
    const out = new Float64Array(frames(4.6));
    modal(out, D5, [
      { ratio: 1, amp: 1, t60: 3.8 }, { ratio: beat, amp: 0.5, t60: 3.3 },
      { ratio: 2.003 * detune, amp: 0.3, t60: 2.3 }, { ratio: 2.758 * detune, amp: 0.11, t60: 0.95 },
      { ratio: 3.992 * detune, amp: 0.12, t60: 1.25 }, { ratio: 5.42 * detune, amp: 0.06, t60: 0.6 },
      { ratio: 6.91 * detune, amp: 0.035, t60: 0.35 }, { ratio: 9.1 * detune, amp: 0.02, t60: 0.2 },
    ], seed);
    strike(out, seed + 100, 0.004, 0.22, 5200, 1.2);
    for (let i = 0; i < out.length; i++) out[i]! *= Math.min(1, i / frames(0.0015));
    return out;
  };
  return [make(1, 1.0011, 21), make(1.0004, 1.0016, 21)];
}
/** Map B: darker struck metal; faster beating, a minor-tenth "tierce" partial, unstable onset pitch. */
function metalB(): Stereo {
  const make = (detune: number, beat: number, seed: number) => {
    const out = new Float64Array(frames(4.2));
    modal(out, D5, [
      { ratio: 1, amp: 1, t60: 2.7 }, { ratio: beat, amp: 0.62, t60: 2.3 },
      { ratio: 2.0 * detune, amp: 0.18, t60: 1.5 }, { ratio: 2.385 * detune, amp: 0.26, t60: 1.35 },
      { ratio: 3.0 * detune, amp: 0.1, t60: 1.0 }, { ratio: 4.17 * detune, amp: 0.1, t60: 0.7 },
      { ratio: 5.4 * detune, amp: 0.08, t60: 0.5 }, { ratio: 6.8 * detune, amp: 0.05, t60: 0.3 },
      { ratio: 8.93 * detune, amp: 0.035, t60: 0.18 },
    ], seed, 0.006, 0.15);
    strike(out, seed + 100, 0.006, 0.3, 3200, 1.6);
    strike(out, seed + 200, 0.003, 0.18, 7000, 2);
    for (let i = 0; i < out.length; i++) out[i]! *= Math.min(1, i / frames(0.001));
    return out;
  };
  return [make(1, 1.0045, 31), make(1.0007, 1.0039, 31)];
}
/** Clean evidence bell: harmonic partials only, no beating, focused center. */
function sigBell(): Stereo {
  const make = (seed: number) => {
    const out = new Float64Array(frames(4.2));
    modal(out, D5, [
      { ratio: 1, amp: 1, t60: 3.0 }, { ratio: 2, amp: 0.26, t60: 1.7 },
      { ratio: 3, amp: 0.07, t60: 0.9 }, { ratio: 4, amp: 0.04, t60: 0.55 },
    ], seed);
    const random = prng(seed + 50), lp = biquad('lp', 3800, 0.7);
    for (let i = 0; i < frames(0.0012); i++) out[i]! += 0.12 * lp(random());
    for (let i = 0; i < out.length; i++) out[i]! *= Math.min(1, i / frames(0.003));
    return out;
  };
  return [make(41), make(41)];
}
/** Amber trace: warm sustained tone with a breath of noise; made to glide.
 * Both sides share the centre tone; a quieter, oppositely detuned partner per side
 * gives width without mono nulls. */
function amberTone(): Stereo {
  const make = (cents: number, seed: number) => {
    const out = new Float64Array(frames(6.5)); const random = prng(seed), bp = biquad('bp', 2 * D5, 3);
    const partner = D5 * 2 ** (cents / 1200); let phase = 0, phaseB = 0;
    for (let i = 0; i < out.length; i++) {
      const t = i / RATE; phase += TAU * D5 / RATE; phaseB += TAU * partner / RATE;
      const env = 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, t / 0.14));
      const tone = Math.sin(phase) + 0.22 * Math.sin(2 * phase) + 0.1 * Math.sin(3 * phase) + 0.035 * Math.sin(4 * phase);
      out[i] = env * Math.exp(-t / 9) * (tone + 0.28 * Math.sin(phaseB) + 0.06 * bp(random()));
    }
    return out;
  };
  return [make(-4, 51), make(4, 52)];
}
/** Bowed-glass pad: slow bloom, two detuned voices per side, gentle shimmer. One file per pitch. */
function padGlass(f0 = D4): Stereo {
  const make = (cents: number[], shimmerPhase: number) => {
    const out = new Float64Array(frames(7));
    const weights = [1, 0.42, 0.2, 0.12, 0.05, 0.03];
    const phases = cents.map(() => 0);
    for (let i = 0; i < out.length; i++) {
      const t = i / RATE; let v = 0;
      cents.forEach((c, voice) => {
        phases[voice]! += TAU * f0 * 2 ** (c / 1200) / RATE;
        const p = phases[voice]!;
        weights.forEach((w, k) => { v += w * Math.sin((k + 1) * p); });
        v += 0.05 * Math.sin(2.76 * p);
      });
      const bloom = 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, t / 0.55));
      const shimmer = 1 + 0.04 * Math.sin(TAU * 0.31 * t + shimmerPhase);
      out[i] = v * bloom * shimmer * Math.exp(-t / 11);
    }
    return out;
  };
  return [make([-4, 3], 0), make([-2, 5], 2.1)];
}
/** Map A tick: dry escapement click with a tuned body. */
function tickA(): Mono {
  const out = new Float64Array(frames(0.09));
  modal(out, 1, [{ ratio: 2350, amp: 0.6, t60: 0.04 }, { ratio: 4100, amp: 0.35, t60: 0.02 }, { ratio: 900, amp: 0.3, t60: 0.03 }], 61);
  for (let i = 0; i < frames(0.001); i++) out[i]! += Math.sin(Math.PI * i / frames(0.001));
  for (let i = 0; i < out.length; i++) out[i]! *= Math.min(1, i / 6);
  return out;
}
/** Map B ratchet: two-stage metallic catch with inharmonic ring. */
function tickB(): Mono {
  const out = new Float64Array(frames(0.13));
  const ring = new Float64Array(out.length);
  modal(ring, 1, [{ ratio: 3300, amp: 0.55, t60: 0.07 }, { ratio: 5610, amp: 0.3, t60: 0.035 }, { ratio: 1450, amp: 0.35, t60: 0.06 }], 71);
  const second = frames(0.009);
  for (let i = 0; i < out.length; i++) out[i] = ring[i]! + (i >= second ? 0.6 * ring[i - second]! : 0);
  strike(out, 72, 0.005, 0.4, 4500, 1.5);
  for (let i = 0; i < out.length; i++) out[i]! *= Math.min(1, i / 6);
  return out;
}
/** Model rear unit landing on the tabletop: D3 body, card knock, one tiny bounce. */
function thock(): Mono {
  const out = new Float64Array(frames(0.55));
  const hit = (offset: number, gain: number, seed: number) => {
    let phase = 0; const random = prng(seed), lp = biquad('lp', 1900, 0.7);
    for (let i = offset; i < out.length; i++) {
      const t = (i - offset) / RATE; phase += TAU * D3 * (1 + 0.4 * Math.exp(-t / 0.015)) / RATE;
      out[i]! += gain * (Math.sin(phase) * decay(t, 0.2) + 0.5 * Math.sin(TAU * 60 * t) * decay(t, 0.12) + 0.35 * lp(random()) * decay(t, 0.025));
    }
    const knock = new Float64Array(out.length - offset);
    modal(knock, 1, [{ ratio: 440, amp: 0.85, t60: 0.09 }, { ratio: 1130, amp: 0.55, t60: 0.05 }, { ratio: 2680, amp: 0.3, t60: 0.025 }], seed + 1);
    for (let i = 0; i < knock.length; i++) out[i + offset]! += gain * knock[i]!;
  };
  hit(0, 1, 81); hit(frames(0.028), 0.22, 83);
  for (let i = 0; i < out.length; i++) out[i]! *= Math.min(1, i / 8);
  return out;
}
/** Glass plate seating: bright contact, short A-tuned ring, small low seat. */
function plateSeat(): Stereo {
  const make = (detune: number, seed: number) => {
    const out = new Float64Array(frames(1.3));
    modal(out, 880, [{ ratio: 2 * detune, amp: 0.55, t60: 0.75 }, { ratio: 2.83 * detune, amp: 0.3, t60: 0.45 }, { ratio: 4.42 * detune, amp: 0.18, t60: 0.25 }, { ratio: 1, amp: 0.25, t60: 0.6 }], seed);
    for (let i = 0; i < out.length; i++) { const t = i / RATE; out[i]! += 0.45 * Math.sin(TAU * 110 * t) * decay(t, 0.09); }
    strike(out, seed + 9, 0.0025, 0.5, 6000, 1);
    for (let i = 0; i < out.length; i++) out[i]! *= Math.min(1, i / 6);
    return out;
  };
  return [make(1, 91), make(1.0006, 91)];
}
/** Map B sliding in: acrylic friction, rising band and a faint singing tone, hard stop. */
function slide(): Stereo {
  const length = frames(1.4), make = (seed: number, tilt: number) => {
    const out = new Float64Array(length), random = prng(seed);
    let phase = 0;
    const bands = [0, 1, 2].map(() => ({ y1: 0, y2: 0, x1: 0, x2: 0 }));
    for (let i = 0; i < length; i++) {
      const t = i / RATE, progress = t / 1.3;
      const amp = progress < 1 ? progress ** 1.8 : Math.max(0, 1 - (t - 1.3) / 0.03);
      const center = (900 + 1500 * Math.min(1, progress)) * tilt;
      let v = 0; const x = random();
      bands.forEach((band, k) => {
        const hz = center * [1, 1.6, 2.7][k]!, w = TAU * hz / RATE, alpha = Math.sin(w) / 12, cos = Math.cos(w);
        const y = (alpha * x - alpha * band.x2 + 2 * cos * band.y1 - (1 - alpha) * band.y2) / (1 + alpha);
        band.x2 = band.x1; band.x1 = x; band.y2 = band.y1; band.y1 = y; v += y * [1, 0.6, 0.3][k]!;
      });
      phase += TAU * (1100 + 160 * Math.min(1, progress)) / RATE;
      out[i] = amp * (v + 0.05 * Math.sin(phase) * (1 + 0.3 * random()));
    }
    return out;
  };
  return [make(101, 1), make(102, 1.04)];
}
/** The editorial cut: one crisp sheet snap and a short settling flutter. */
function paper(): Stereo {
  const make = (seed: number) => {
    const out = new Float64Array(frames(0.6)), random = prng(seed), hp = biquad('hp', 2200, 0.7), bp = biquad('bp', 2600, 0.8);
    let gate = 1;
    for (let i = 0; i < out.length; i++) {
      const t = i / RATE;
      if (i % 300 === 0) gate = 0.4 + 0.6 * Math.abs(random());
      out[i] = hp(random()) * decay(t, 0.03) * 0.9 + bp(random()) * gate * decay(t, 0.28) * 0.45;
    }
    for (let i = 0; i < out.length; i++) out[i]! *= Math.min(1, i / 4);
    return out;
  };
  return [make(111), make(112)];
}
/** A single reversed glass bloom (A5) that ends exactly at its file end. */
function glassReverse(): Stereo {
  const [left, right] = glassA();
  const n = frames(1.1);
  const flip = (src: Float64Array) => {
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = src[n - 1 - i]! * Math.min(1, (n - 1 - i) / frames(0.004));
    return out;
  };
  return [flip(left), flip(right)];
}

/** V3 accent: a tiny crystalline D/A glint (D7, A7, D8, E8 + air) for picture-locked hits on small speakers. */
function glint(): Stereo {
  const make = (detune: number) => {
    const out = new Float64Array(frames(0.7));
    modal(out, D5, [
      { ratio: 4 * detune, amp: 1, t60: 0.5 }, { ratio: 6 * detune, amp: 0.55, t60: 0.33 },
      { ratio: 8.004 * detune, amp: 0.32, t60: 0.22 }, { ratio: 8.98 * detune, amp: 0.18, t60: 0.16 },
    ], 121);
    strike(out, 122, 0.012, 0.3, 9000, 0.8);
    for (let i = 0; i < out.length; i++) out[i]! *= Math.min(1, i / frames(0.0008));
    return out;
  };
  return [make(1), make(1.0005)];
}

// ---------------------------------------------------------------- output
function wav(data: Mono | Stereo, peakDbfs: number): Buffer {
  const channels = data instanceof Float64Array ? [data] : data;
  const length = channels[0]!.length;
  let measured = 0; for (const c of channels) for (const x of c) measured = Math.max(measured, Math.abs(x));
  if (!measured) throw new Error('Silent synthesis');
  const fadeOut = frames(0.012), scale = 10 ** (peakDbfs / 20) / measured;
  const bytes = Buffer.alloc(44 + length * channels.length * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8); bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(channels.length, 22); bytes.writeUInt32LE(RATE, 24);
  bytes.writeUInt32LE(RATE * 2 * channels.length, 28); bytes.writeUInt16LE(2 * channels.length, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(length * channels.length * 2, 40);
  for (let i = 0; i < length; i++) {
    const tail = Math.min(1, (length - 1 - i) / fadeOut);
    channels.forEach((c, k) => {
      const v = c[i]! * scale * tail;
      if (!Number.isFinite(v)) throw new Error('Nonfinite synthesis');
      bytes.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), 44 + (i * channels.length + k) * 2);
    });
  }
  return bytes;
}

const semis = (root: number, n: number) => root * 2 ** (n / 12);
interface Sound { id: string; kit: string | null; pitch: number | null; peakDbfs: number; root: string; role: string; make: () => Mono | Stereo }
// Multi-sampled where the score holds notes for a long time (zero interpolation cost, true decays).
const pulsePitches: [string, number][] = [['d', 0], ['c', -2], ['bb', -4], ['a', -5], ['g', -7]];
const padPitches: [string, number][] = [['d3', -12], ['f3', -9], ['g3', -7], ['a3', -5], ['bb3', -4], ['c4', -2], ['d4', 0], ['e4', 2], ['f4', 3], ['fs4', 4], ['g4', 5], ['a4', 7], ['bb4', 8], ['b4', 9], ['c5', 10], ['d5', 12], ['e5', 14]];
export const sounds: Sound[] = [
  ...pulsePitches.flatMap(([name, n]): Sound[] => [
    { id: `pulse-lub-${name}`, kit: 'pulse', pitch: 38 + n, peakDbfs: -3, root: `${name.toUpperCase()}1/2`, role: 'Heartbeat LUB: the PermitPulse rhythmic identity', make: () => pulseLub(semis(D2, n)) },
    { id: `pulse-dub-${name}`, kit: 'pulse', pitch: 38 + n + 24, peakDbfs: -4, root: `${name.toUpperCase()}1/2`, role: 'Heartbeat DUB', make: () => pulseDub(semis(D2, n)) },
  ]),
  ...pulsePitches.map(([name, n]): Sound => ({ id: `bass-${name}`, kit: 'bass', pitch: 38 + n, peakDbfs: -3, root: `${name.toUpperCase()} (D2 family)`, role: 'Deep controlled analog bass', make: () => bassSustain(semis(D2, n)) })),
  { id: 'sub-sine', kit: null, pitch: null, peakDbfs: -3, root: 'D1', role: 'Controlled sub for the hook, the cut and the brand bloom', make: subSine },
  { id: 'glass-a', kit: null, pitch: null, peakDbfs: -3, root: 'D5', role: 'Map A identity: glass, slow beat, one uneasy partial', make: glassA },
  { id: 'metal-b', kit: null, pitch: null, peakDbfs: -3, root: 'D5', role: 'Map B identity: darker metal, faster beat, minor-tenth partial', make: metalB },
  { id: 'sig-bell', kit: null, pitch: null, peakDbfs: -3, root: 'D5', role: 'Evidence/brand voice: the motif made clean', make: sigBell },
  { id: 'amber-tone', kit: null, pitch: null, peakDbfs: -3, root: 'D5', role: 'Amber evidence line: sustained tone for glides', make: amberTone },
  ...padPitches.map(([name, n]): Sound => ({ id: `pad-${name}`, kit: 'pad', pitch: 62 + n, peakDbfs: -3, root: name.toUpperCase().replace('S', '#'), role: 'Bowed-glass harmony pad', make: () => padGlass(semis(D4, n)) })),
  { id: 'tick-a', kit: 'ticks', pitch: 42, peakDbfs: -4, root: 'unpitched', role: 'Map A precise mechanical tick', make: tickA },
  { id: 'tick-b', kit: 'ticks', pitch: 44, peakDbfs: -4, root: 'unpitched', role: 'Map B ratchet catch', make: tickB },
  { id: 'thock', kit: 'foley', pitch: 36, peakDbfs: -3, root: 'D3 body', role: 'Proposed rear unit lands (1.600)', make: thock },
  { id: 'plate-seat', kit: 'foley', pitch: 38, peakDbfs: -3, root: 'A tuned', role: 'Source A map seats (3.100)', make: plateSeat },
  { id: 'slide', kit: 'foley', pitch: 40, peakDbfs: -4, root: 'unpitched', role: 'Source B slides in (5.500-6.800)', make: slide },
  { id: 'paper', kit: 'foley', pitch: 42, peakDbfs: -4, root: 'unpitched', role: 'Editorial evidence cut (13.667)', make: paper },
  { id: 'glass-reverse', kit: 'foley', pitch: 44, peakDbfs: -4, root: 'D5 glass, reversed', role: 'Single inhale into the brand', make: glassReverse },
  { id: 'glint', kit: null, pitch: null, peakDbfs: -4, root: 'D7/A7', role: 'V3 accent: crystalline glint on picture hits', make: glint },
];

export function generate(): void {
  rmSync(assetDir, { recursive: true, force: true });
  mkdirSync(assetDir, { recursive: true });
  const catalog = sounds.map(sound => {
    const data = sound.make();
    const bytes = wav(data, sound.peakDbfs), file = `${sound.id}.wav`;
    writeFileSync(join(assetDir, file), bytes);
    return {
      id: sound.id, file: `assets/permitpulse/${file}`, kit: sound.kit, kitPitch: sound.pitch, root: sound.root, role: sound.role,
      channels: data instanceof Float64Array ? 1 : 2, frames: (data instanceof Float64Array ? data : data[0]).length,
      peakDbfs: sound.peakDbfs, sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  });
  for (const kit of ['pulse', 'bass', 'pad', 'ticks', 'foley']) {
    const samples = sounds.filter(s => s.kit === kit).map(s => ({ name: s.id, pitch: s.pitch, file: `${s.id}.wav` }));
    writeFileSync(join(assetDir, `${kit}.kit.json`), JSON.stringify({ formatVersion: 1, samples }, null, 2) + '\n');
  }
  writeFileSync(join(here, 'catalog.json'), JSON.stringify({
    pack: 'PERMITPULSE // THE MAPS DISAGREE', sampleRate: RATE, bitsPerSample: 16,
    generator: 'productions/permitpulse-maps-disagree/sound-design/generate-pack.ts',
    generatorSourceSha256: createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
    provenance: 'Original offline synthesis (modal resonators, additive filtered saws, seeded mulberry32 noise). No recordings, libraries or third-party audio.',
    tuning: { D1, D2, D3, D4, D5, note: 'All pitched sources rooted on D; the score repitches by 2^(n/12) playback rates.' },
    sounds: catalog,
  }, null, 2) + '\n');
  for (const s of catalog) console.log(`${s.id.padEnd(14)} ${String(s.channels)}ch ${(s.frames / RATE).toFixed(3)}s ${s.sha256.slice(0, 12)}`);
}
generate();
