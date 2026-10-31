// LOWRIDER//2099 instruments. Every sound is synthesized here from oscillators, noise and
// physical models: no recordings, no downloaded samples, no SoundFont. Deterministic (seeded),
// Node built-ins only. The talkbox mouth is the MORPH//03 Kelly-Lochbaum throat, vendored
// unchanged under ./vendor (see README for commit and SHA-256).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SR, TAU, mtof, clamp, smooth, rng, bipolar, Osc, Biquad, shape, split, modal } from './vendor/morph-03/dsp.mjs';
import { throat, articulation } from './vendor/morph-03/throat.mjs';

export { SR, mtof };
export const BPM = 96;
export const S16 = 60 / BPM / 4; // 0.15625 s

const n = seconds => Math.round(seconds * SR);
const expDecay = (t, tau) => Math.exp(-t / tau);
function fadeEdges(x, inS = 0.0005, outS = 0.02) {
  const a = n(inS), b = n(outS), len = x.length;
  for (let i = 0; i < a && i < len; i++) x[i] *= i / a;
  for (let i = 0; i < b && i < len; i++) x[len - 1 - i] *= smooth(i / b);
  return x;
}

// ---------- the hook lead: a G-funk "whine" ----------
// Sine core with a little second harmonic and a filtered narrow pulse for bite on small speakers.
// Delayed vibrato (it blooms only on held notes). One file per pitch, so the engine plays every
// note at rate 1 (exact copy) and uses playbackRate/glide only for scoops, slides and falls.
export function lead(midi, seconds = 1.9) {
  const len = n(seconds), f0 = mtof(midi), out = new Float64Array(len);
  const core = new Osc(0), oct = new Osc(0.1), reed = new Osc(0.3);
  const reedLp = new Biquad('lp', Math.min(5200, f0 * 4.5), 0.7), body = new Biquad('peak', 2400, 0.9, 2);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const depth = 0.26 * smooth((t - 0.24) / 0.4); // semitones, peak
    const f = f0 * 2 ** (depth * Math.sin(TAU * 5.4 * Math.max(0, t - 0.24)) / 12);
    const amp = Math.min(1, t / 0.004) * (0.8 + 0.2 * expDecay(t, 0.35));
    const v = core.sine(f) + 0.14 * oct.sine(2 * f) + 0.2 * reedLp.tick(reed.square(f, 0.22));
    out[i] = body.tick(v) * amp;
  }
  return fadeEdges(out, 0.001, 0.12);
}

// ---------- 808 ----------
// Sine with a fast pitch drop, long body for slides, and oversampled asymmetric saturation:
// the 2nd-5th harmonics are what a phone speaker actually reproduces of an F1.
export function bass808(midi, seconds = 2.6, growlMix = 0.22, drive = 2.6) {
  const len = n(seconds), f0 = mtof(midi), x = new Float64Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR, f = f0 * (1 + 0.85 * expDecay(t, 0.02));
    ph += f / SR; if (ph >= 1) ph -= 1;
    x[i] = Math.sin(TAU * ph) * Math.min(1, t / 0.0012) * (0.32 + 0.68 * expDecay(t, 0.75));
  }
  const sat = shape(x, v => Math.tanh(v + 0.18 * v * v) + 0.07 * Math.sin(3.1 * v), drive);
  // a touch more upper-harmonic "growl" (150 Hz-1.2 kHz) for translation, still tied to the body
  const { hi } = split(sat, 160);
  const growl = shape(hi, Math.tanh, 3.2), glp = new Biquad('lp', 1500, 0.7), lp = new Biquad('lp', 5500, 0.7);
  const dc = new Biquad('hp', 18, 0.7);
  for (let i = 0; i < len; i++) x[i] = lp.tick(dc.tick(sat[i] + growlMix * glp.tick(growl[i])));
  return fadeEdges(x, 0.0005, 0.3);
}

// ---------- drums ----------
// A short knock, not a boom: the 808 owns everything below 60 Hz, so the kick's body is gone
// within ~150 ms (a long 49 Hz body beat at ~5 Hz against the F1 808 in the first draft).
export function kick(seconds = 0.3) {
  const len = n(seconds), x = new Float64Array(len), noise = bipolar(rng(11));
  const clickHp = new Biquad('hp', 2500, 0.7);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR, f = 58 + 190 * expDecay(t, 0.022) + 480 * expDecay(t, 0.003);
    ph += f / SR; if (ph >= 1) ph -= 1;
    const bodyEnv = Math.min(1, t / 0.0004) * expDecay(t, 0.05);
    const click = clickHp.tick(noise()) * expDecay(t, 0.0025) * 0.55 + Math.sin(TAU * 3100 * t) * expDecay(t, 0.003) * 0.4;
    x[i] = Math.sin(TAU * ph) * bodyEnv + click;
  }
  return fadeEdges(shape(x, Math.tanh, 2.2), 0.0003, 0.05);
}

// Dry clap: four hand bursts then a short tail. Band-limited noise, no room.
export function clap(seconds = 0.32, seed = 21) {
  const len = n(seconds), x = new Float64Array(len), noise = bipolar(rng(seed));
  const bp = new Biquad('bp', 1250, 1.1), hp = new Biquad('hp', 700, 0.7), air = new Biquad('hp', 4500, 0.7);
  const bursts = [0, 0.0085, 0.0185, 0.027];
  for (let i = 0; i < len; i++) {
    const t = i / SR; let e = 0;
    for (const b of bursts) if (t >= b) e = Math.max(e, (b === 0.027 ? 1 : 0.85) * expDecay(t - b, b === 0.027 ? 0.075 : 0.0055));
    const v = noise();
    x[i] = (hp.tick(bp.tick(v)) * 2.2 + air.tick(v) * 0.35) * e;
  }
  return fadeEdges(x, 0.0002, 0.04);
}

// B's snare: a tuned body (190 -> 172 Hz) under bright, tight noise; layered with the clap.
export function snare(seconds = 0.3) {
  const len = n(seconds), x = new Float64Array(len), noise = bipolar(rng(27));
  const bp = new Biquad('bp', 3800, 0.7), hp = new Biquad('hp', 1800, 0.7);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR, f = 172 + 60 * expDecay(t, 0.012);
    ph += f / SR; if (ph >= 1) ph -= 1;
    x[i] = Math.sin(TAU * ph) * expDecay(t, 0.05) * 0.8 + hp.tick(bp.tick(noise())) * Math.min(1, t / 0.0005) * expDecay(t, 0.07) * 1.4;
  }
  return fadeEdges(shape(x, Math.tanh, 1.8), 0.0002, 0.04);
}

// One-bar noise riser: band-pass sweeping 400 Hz -> 9 kHz, crescendo, hard stop.
export function riser(seconds = 2.5) {
  const len = n(seconds), x = new Float64Array(len), noise = bipolar(rng(81));
  const bp = new Biquad('bp', 400, 2);
  for (let i = 0; i < len; i++) {
    const u = i / len;
    if (i % 32 === 0) bp.set('bp', 400 * (9000 / 400) ** (u * u), 2.2);
    x[i] = bp.tick(noise()) * (0.05 + 0.95 * u ** 2.2);
  }
  return fadeEdges(x, 0.01, 0.004);
}

export function snap(seconds = 0.15) {
  const len = n(seconds), x = new Float64Array(len), noise = bipolar(rng(33));
  const bp = new Biquad('bp', 3000, 2.2);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    x[i] = bp.tick(noise()) * 2.5 * Math.min(1, t / 0.0008) * expDecay(t, 0.016) + Math.sin(TAU * 1850 * t) * expDecay(t, 0.004) * 0.5;
  }
  return fadeEdges(x, 0.0002, 0.03);
}

// Six detuned square oscillators (the classic analog metal recipe) through a high band-pass.
export function hat(decay = 0.035, seconds = 0.2, seed = 41) {
  const len = n(seconds), x = new Float64Array(len), noise = bipolar(rng(seed));
  const freqs = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0].map(f => f * 1.62);
  const oscs = freqs.map((_, k) => new Osc(k * 0.137));
  const bp = new Biquad('bp', 9200, 0.9), hp = new Biquad('hp', 6800, 0.7), hp2 = new Biquad('hp', 6800, 0.7);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let m = 0; for (let k = 0; k < 6; k++) m += oscs[k].square(freqs[k]);
    const e = Math.min(1, t / 0.0004) * expDecay(t, decay);
    x[i] = hp2.tick(hp.tick(bp.tick(m * 0.2 + noise() * 0.35))) * e;
  }
  return fadeEdges(x, 0.0002, Math.min(0.03, seconds / 4));
}

// Shaker: two motions (push/pull) with different grain envelopes for a human swing.
export function shaker(pull = false, seconds = 0.14) {
  const len = n(seconds), x = new Float64Array(len), noise = bipolar(rng(pull ? 52 : 51));
  const bp = new Biquad('bp', pull ? 5600 : 7000, 0.8), hp = new Biquad('hp', 3800, 0.7);
  const att = pull ? 0.012 : 0.004, dec = pull ? 0.04 : 0.055;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    x[i] = hp.tick(bp.tick(noise())) * smooth(t / att) * expDecay(Math.max(0, t - att), dec);
  }
  return fadeEdges(x, 0.0002, 0.03);
}

export function rim(seconds = 0.2) {
  const len = n(seconds), imp = new Float64Array(len), noise = bipolar(rng(61));
  for (let i = 0; i < n(0.0012); i++) imp[i] = noise() * (1 - i / n(0.0012));
  const body = modal(imp, [{ f: 1720, t60: 0.05, gain: 1 }, { f: 830, t60: 0.07, gain: 0.7 }, { f: 3300, t60: 0.02, gain: 0.3 }]);
  const hp = new Biquad('hp', 400, 0.7);
  for (let i = 0; i < len; i++) body[i] = hp.tick(body[i] + imp[i] * 0.4);
  return fadeEdges(body, 0.0002, 0.03);
}

// The hop: a hydraulic "pssht" (pneumatic valve) and a chassis "clunk" landing 120 ms later.
export function hop(seconds = 0.75) {
  const len = n(seconds), x = new Float64Array(len), noise = bipolar(rng(71));
  const bp = new Biquad('bp', 2500, 1.4), hp = new Biquad('hp', 1200, 0.7);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    if (i % 32 === 0) bp.set('bp', 2200 + 3400 * smooth(t / 0.28), 1.4);
    x[i] = hp.tick(bp.tick(noise())) * Math.min(1, t / 0.003) * expDecay(t, 0.09) * 1.6;
  }
  const imp = new Float64Array(len); const k0 = n(0.12);
  for (let i = 0; i < n(0.002); i++) imp[k0 + i] = 1 - i / n(0.002);
  const clunk = modal(imp, [{ f: 72, t60: 0.35, gain: 1 }, { f: 187, t60: 0.2, gain: 0.8 }, { f: 461, t60: 0.12, gain: 0.5 }, { f: 1130, t60: 0.06, gain: 0.35 }]);
  let p = 0; for (const v of clunk) p = Math.max(p, Math.abs(v));
  for (let i = 0; i < len; i++) x[i] += 0.9 * clunk[i] / p;
  return fadeEdges(x, 0.0002, 0.08);
}

// ---------- minimal keys: two-operator FM electric piano, rendered as whole chords ----------
export function keysChord(midis, seconds = 2.2) {
  const len = n(seconds), x = new Float64Array(len);
  midis.forEach((m, k) => {
    const f = mtof(m), car = new Osc(k * 0.21), mod = new Osc(k * 0.37);
    for (let i = 0; i < len; i++) {
      const t = i / SR, idx = 1.6 * expDecay(t, 0.18) + 0.25;
      const ph = mod.sine(f) * idx; // modulator at 1:1
      x[i] += Math.sin(TAU * (car.p + ph / TAU)) * Math.min(1, t / 0.003) * expDecay(t, 1.4) / midis.length;
      car.p += f / SR; if (car.p >= 1) car.p -= 1;
    }
  });
  const hp = new Biquad('hp', 180, 0.7), lp = new Biquad('lp', 3200, 0.7);
  for (let i = 0; i < len; i++) x[i] = lp.tick(hp.tick(x[i]));
  return fadeEdges(x, 0.001, 0.25);
}

// ---------- the signature: TALKBOX//2099 ----------
// A bright synth (two detuned saws and a narrow pulse) is "played" into the MORPH//03
// Kelly-Lochbaum vocal tract, the way a talkbox pipes a keyboard into a player's mouth.
// The mouth is a physical model, so it can do what no player can: `size` rescales the
// tract mid-word (formants move, pitch does not). Notes: [{t, len, midi, syl, from?, to?, bendAt?, size?: [a, b]}]
const SYL = {
  wow: [['ww', 0, 0.02], ['ah', 0.06, 0.16], ['oh', 0.55, 0.2], ['oo', 0.78, 0.15]],
  ow: [['ah', 0, 0.03], ['oh', 0.45, 0.25], ['oo', 0.78, 0.15]],
  wah: [['ww', 0, 0.02], ['ah', 0.08, 0.18]],
  yeah: [['ee', 0, 0.02], ['eh', 0.08, 0.14], ['ah', 0.3, 0.3]],
  ya: [['ee', 0, 0.02], ['ah', 0.12, 0.2]],
  oh: [['uh', 0, 0.02], ['oh', 0.1, 0.2]],
  ooh: [['oo', 0, 0.05]],
  wee: [['oo', 0, 0.02], ['ee', 0.15, 0.25]],
};

export function talkbox({ seconds, notes, metal = 0.12, breath = 0.3, seed = 9, vibrato = 0.18 }) {
  const len = n(seconds), src = new Float64Array(len);
  const sorted = [...notes].sort((a, b) => a.t - b.t);
  // pitch: legato portamento into each note (from the previous pitch, or a scoop from below), optional late bend
  const pitchAt = t => {
    let cur = sorted[0].from ?? sorted[0].midi - 1, active = sorted[0];
    for (let k = 0; k < sorted.length; k++) {
      const nt = sorted[k];
      if (t < nt.t) break;
      const start = k === 0 ? (nt.from ?? nt.midi - 1) : (nt.from ?? cur);
      const g = nt.glide ?? 0.045;
      cur = start + (nt.midi - start) * smooth((t - nt.t) / g);
      if (nt.to !== undefined && t >= nt.t + nt.bendAt) cur = nt.midi + (nt.to - nt.midi) * smooth((t - nt.t - nt.bendAt) / (nt.bendLen ?? 0.12));
      active = nt;
    }
    const age = t - active.t;
    return cur + vibrato * smooth((age - 0.18) / 0.25) * Math.sin(TAU * 5.6 * Math.max(0, age - 0.18));
  };
  // the source stops before the lips seal (sealing a sounding tract pops)
  const gateAt = t => {
    let g = 0;
    for (const nt of sorted) if (t >= nt.t && t < nt.t + nt.len) g = Math.max(g, smooth((t - nt.t) / 0.006) * smooth((nt.t + nt.len - t) / 0.035));
    return g;
  };
  const a = new Osc(0), b = new Osc(0.33), c = new Osc(0.71);
  for (let i = 0; i < len; i++) {
    const t = i / SR, f = mtof(pitchAt(t));
    src[i] = (0.5 * a.saw(f * 1.0035) + 0.5 * b.saw(f * 0.9965) + 0.35 * c.square(f, 0.3)) * gateAt(t);
  }
  const folds = shape(src, Math.tanh, 1.4);
  // mouth: already in the first vowel at the onset (opening from closed lips there is a plosive
  // burst ~3x the sustain level), closed between detached notes, one syllable trajectory per note
  const seq = [{ t: 0, ph: SYL[sorted[0].syl][0][0] }];
  for (const nt of sorted) {
    for (const [ph, at, gl] of SYL[nt.syl]) seq.push({ t: nt.t + at * nt.len, ph, glide: Math.max(0.008, gl * nt.len) });
    const next = sorted.find(o => o.t > nt.t);
    if (!next || next.t > nt.t + nt.len + 0.02) seq.push({ t: nt.t + nt.len + 0.01, ph: 'mm', glide: 0.05 });
  }
  const art = articulation(seq);
  const sizeAt = t => {
    for (const nt of sorted) if (nt.size && t >= nt.t && t < nt.t + nt.len + 0.06) return nt.size[0] + (nt.size[1] - nt.size[0]) * smooth((t - nt.t) / nt.len);
    return 1;
  };
  const mouth = throat(folds, { art, size: sizeAt, metal: () => metal, breath, seed });
  // radiation: no low end comes out of a mouth; a little presence for intelligibility
  const { hi } = split(mouth, 150);
  const pres = new Biquad('peak', 2600, 1.0, 3), air = new Biquad('hs', 6000, 0.7, -3);
  for (let i = 0; i < len; i++) hi[i] = air.tick(pres.tick(hi[i]));
  return fadeEdges(hi, 0.0005, 0.05);
}

// ---------- WAV (PCM16 mono, 44.1 kHz: the engine's sampler contract) ----------
export function writeWav16(path, x, peakDb = -1) {
  let p = 0; for (const v of x) p = Math.max(p, Math.abs(v));
  const g = p > 0 ? 10 ** (peakDb / 20) / p : 1, frames = x.length, data = frames * 2;
  const wav = Buffer.alloc(44 + data);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + data, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(data, 40);
  for (let i = 0; i < frames; i++) wav.writeInt16LE(clamp(Math.round(x[i] * g * 32767), -32768, 32767), 44 + 2 * i);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, wav);
  return { frames, seconds: frames / SR, gain: g };
}
