// LOWRIDER//2099 v2 sound design. Builds on the v1 instruments (experiments/lowrider-2099,
// unchanged) and the vendored MORPH physical models. Everything is synthesized and seeded.
// New here: harder layered drums, stereo percussion with decorrelated tails and air, a stereo
// lead double, an attitude 808, the talking 808, the Mouth Drop, the hover spin-up and the slam.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as V1 from '../../../../experiments/lowrider-2099/instruments.mjs';
import { SR, TAU, mtof, clamp, smooth, rng, bipolar, Osc, Biquad, shape, split, modal } from '../../../../experiments/lowrider-2099/vendor/morph-03/dsp.mjs';
import { throat, articulation } from '../../../../experiments/lowrider-2099/vendor/morph-03/throat.mjs';
import { beast } from '../../../../experiments/lowrider-2099/vendor/morph-06/beast.mjs';

export { V1, SR, mtof };
export const S16 = V1.S16;
const n = s => Math.round(s * SR);
const expDecay = (t, tau) => Math.exp(-t / tau);
const stereo = len => ({ L: new Float64Array(len), R: new Float64Array(len) });
function fade(x, inS = 0.0005, outS = 0.02) {
  const a = n(inS), b = n(outS), len = x.length;
  for (let i = 0; i < a && i < len; i++) x[i] *= i / a;
  for (let i = 0; i < b && i < len; i++) x[len - 1 - i] *= smooth(i / b);
  return x;
}
const fadeSt = (s, a, b) => ({ L: fade(s.L, a, b), R: fade(s.R, a, b) });
const mix = (len, ...parts) => { const o = new Float64Array(len); for (const [x, g] of parts) for (let i = 0; i < Math.min(len, x.length); i++) o[i] += g * x[i]; return o; };

// ---------- drums ----------
/** Layered kick: v1 knock + a 95 -> 68 Hz punch body + a 4 kHz beater. Still short: the 808 owns the sub. */
export function kick2() {
  const knock = V1.kick(0.32), len = knock.length, body = new Float64Array(len), noise = bipolar(rng(13));
  const hp = new Biquad('hp', 3500, 0.7);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR, f = 68 + 60 * expDecay(t, 0.018);
    ph += f / SR; if (ph >= 1) ph -= 1;
    body[i] = Math.sin(TAU * ph) * Math.min(1, t / 0.0006) * expDecay(t, 0.042) + hp.tick(noise()) * expDecay(t, 0.0018) * 0.6;
  }
  // driven harder than v1 (tanh 2.6): a denser kick with ~3 dB less crest hits as hard at a lower peak
  return fade(shape(mix(len, [knock, 0.75], [body, 0.6]), Math.tanh, 2.6), 0.0003, 0.04);
}

/** Stereo clap: the v1 hand bursts in the middle, a decorrelated noise tail and air on each side. */
export function clap2() {
  const core = V1.clap(0.36, 21), len = core.length, out = stereo(len);
  for (const [ch, seed] of [['L', 101], ['R', 202]]) {
    const r = bipolar(rng(seed)), bp = new Biquad('bp', 1700, 0.9), air = new Biquad('hp', 7500, 0.7), crack = new Biquad('peak', 2600, 1.2, 5);
    for (let i = 0; i < len; i++) {
      const t = i / SR, v = r();
      const tail = t > 0.02 ? bp.tick(v) * expDecay(t - 0.02, 0.11) * 0.55 : bp.tick(v) * 0;
      out[ch][i] = crack.tick(core[i]) + tail + air.tick(v) * expDecay(t, 0.05) * 0.35;
    }
  }
  return fadeSt(out, 0.0002, 0.05);
}

/** Stereo snare: the v1 tuned body in the middle, bright decorrelated wires either side. */
export function snare2() {
  const core = V1.snare(0.34), len = core.length, out = stereo(len);
  for (const [ch, seed] of [['L', 303], ['R', 404]]) {
    const r = bipolar(rng(seed)), hp = new Biquad('hp', 2600, 0.7), air = new Biquad('hs', 9000, 0.7, 6);
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      out[ch][i] = core[i] + air.tick(hp.tick(r())) * Math.min(1, t / 0.0004) * expDecay(t, 0.09) * 0.5;
    }
  }
  return fadeSt(out, 0.0002, 0.05);
}

/** Stereo metal hat: each side its own oscillator detune and noise seed (decorrelated, no comb in mono). */
export function hat2(decay = 0.035, seconds = 0.22, seed = 41) {
  const len = n(seconds), out = stereo(len);
  for (const [ch, k] of [['L', 0], ['R', 1]]) {
    const noise = bipolar(rng(seed + 17 * k)), freqs = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0].map(f => f * (1.62 + 0.013 * k));
    const oscs = freqs.map((_, j) => new Osc(j * 0.137 + 0.05 * k));
    const bp = new Biquad('bp', 9800, 0.8), hp = new Biquad('hp', 6500, 0.7), sizzle = new Biquad('hs', 11000, 0.7, 7);
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      let m = 0; for (let j = 0; j < 6; j++) m += oscs[j].square(freqs[j]);
      out[ch][i] = sizzle.tick(hp.tick(bp.tick(m * 0.2 + noise() * 0.4))) * Math.min(1, t / 0.0003) * expDecay(t, decay);
    }
  }
  return fadeSt(out, 0.0002, Math.min(0.03, seconds / 4));
}

export function shaker2(pull = false) {
  const len = n(0.15), out = stereo(len);
  for (const [ch, k] of [['L', 0], ['R', 1]]) {
    const noise = bipolar(rng((pull ? 52 : 51) + 31 * k)), bp = new Biquad('bp', (pull ? 6000 : 7600) + 400 * k, 0.8), hp = new Biquad('hp', 4200, 0.7);
    const att = pull ? 0.012 : 0.004, dec = pull ? 0.04 : 0.055;
    for (let i = 0; i < len; i++) { const t = i / SR; out[ch][i] = hp.tick(bp.tick(noise())) * smooth(t / att) * expDecay(Math.max(0, t - att), dec); }
  }
  return fadeSt(out, 0.0002, 0.03);
}

/** The slam: the drop's impact. A 50 -> 34 Hz sub boom, a noise blast and the hop's chassis clunk. */
export function slam(seconds = 1.6) {
  const len = n(seconds), x = new Float64Array(len), noise = bipolar(rng(91)), bp = new Biquad('bp', 1800, 0.6);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR, f = 34 + 26 * expDecay(t, 0.09);
    ph += f / SR; if (ph >= 1) ph -= 1;
    x[i] = Math.sin(TAU * ph) * Math.min(1, t / 0.001) * expDecay(t, 0.5) + bp.tick(noise()) * expDecay(t, 0.06) * 0.7;
  }
  const imp = new Float64Array(len); for (let i = 0; i < n(0.002); i++) imp[i] = 1 - i / n(0.002);
  const clunk = modal(imp, [{ f: 72, t60: 0.4, gain: 1 }, { f: 187, t60: 0.25, gain: 0.8 }, { f: 461, t60: 0.15, gain: 0.5 }, { f: 1130, t60: 0.08, gain: 0.35 }]);
  let p = 0; for (const v of clunk) p = Math.max(p, Math.abs(v));
  for (let i = 0; i < len; i++) x[i] += 0.6 * clunk[i] / p;
  return fade(shape(x, Math.tanh, 1.6), 0.0003, 0.2);
}

// ---------- 808 with attitude ----------
/** Faster, deeper pitch punch, harder drive, and a folded 500 Hz-2.5 kHz "rasp" so a phone hears the note. */
export function bass808x(midi, seconds = 2.6) {
  const len = n(seconds), f0 = mtof(midi), x = new Float64Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR, f = f0 * (1 + 1.6 * expDecay(t, 0.012) + 0.25 * expDecay(t, 0.06));
    ph += f / SR; if (ph >= 1) ph -= 1;
    x[i] = Math.sin(TAU * ph) * Math.min(1, t / 0.0008) * (0.36 + 0.64 * expDecay(t, 0.85));
  }
  const sat = shape(x, v => Math.tanh(v + 0.2 * v * v) + 0.08 * Math.sin(3.1 * v), 4.6);
  const { hi } = split(sat, 220);
  const rasp = shape(hi, v => Math.sin(1.7 * v), 2.4), bp1 = new Biquad('hp', 500, 0.7), bp2 = new Biquad('lp', 2500, 0.7);
  const glp = new Biquad('lp', 1500, 0.7), lp = new Biquad('lp', 6000, 0.7), dc = new Biquad('hp', 18, 0.7);
  // rasp doubled after v2 QA: the first mix lost the 808 on a phone (worst 10% of windows at -13 dB SMR)
  for (let i = 0; i < len; i++) x[i] = lp.tick(dc.tick(sat[i] + 0.7 * glp.tick(hi[i]) + 0.34 * bp2.tick(bp1.tick(rasp[i]))));
  return fade(x, 0.0005, 0.3);
}

// ---------- lead: stereo double around a mono-anchored centre ----------
/** Centre = the v1 whine (mono-safe). Sides = +-7 cent doubles. An octave whistle adds identity and air. */
export function lead2(midi, seconds = 1.9) {
  const c = V1.lead(midi, seconds), up = V1.lead(midi + 0.07, seconds), dn = V1.lead(midi - 0.07, seconds), oct = V1.lead(midi + 12, seconds);
  const len = c.length, out = stereo(len), noise = bipolar(rng(midi)), pick = new Biquad('bp', 3200, 1.5);
  for (let i = 0; i < len; i++) {
    const t = i / SR, bite = pick.tick(noise()) * expDecay(t, 0.006) * 0.12;
    out.L[i] = c[i] + 0.32 * up[i] + 0.07 * oct[i] + bite;
    out.R[i] = c[i] + 0.32 * dn[i] + 0.07 * oct[i] + bite;
  }
  return out;
}

/** Wide FM keys: the v1 chord detuned +-5 cents per side. */
export function keys2(midis) {
  return { L: V1.keysChord(midis.map(m => m + 0.05)), R: V1.keysChord(midis.map(m => m - 0.05)) };
}

// ---------- the talking 808 ----------
/**
 * A distorted 808 is the glottal source of the MORPH//03 vocal tract, so the bass line speaks.
 * The dry 808 keeps the sub below 110 Hz; the mouth supplies everything above.
 * notes: [{t, len, midi, to?, bendAt?, syl}] (syl from the v1 talkbox vocabulary + 'waah')
 */
const SYL = {
  waah: [['ww', 0, 0.03], ['ah', 0.1, 0.3]],
  wow: [['ww', 0, 0.02], ['ah', 0.08, 0.2], ['oh', 0.55, 0.2], ['oo', 0.8, 0.15]],
  yeah: [['ee', 0, 0.02], ['eh', 0.1, 0.15], ['ah', 0.35, 0.3]],
  oww: [['ah', 0, 0.03], ['oh', 0.45, 0.25], ['oo', 0.8, 0.15]],
};
export function talking808({ seconds, notes, size = 0.9 }) {
  const len = n(seconds), x = new Float64Array(len), sorted = [...notes].sort((a, b) => a.t - b.t);
  const pitchAt = t => {
    let m = sorted[0].midi;
    for (const nt of sorted) {
      if (t < nt.t) break;
      m = nt.midi;
      if (nt.to !== undefined && t >= nt.t + nt.bendAt) m = nt.midi + (nt.to - nt.midi) * smooth((t - nt.t - nt.bendAt) / (nt.bendLen ?? 0.12));
    }
    return m;
  };
  // legato: a note followed within 30 ms by the next neither fades out nor lets the next re-attack
  const tied = sorted.map((nt, k) => sorted[k + 1] && sorted[k + 1].t - (nt.t + nt.len) < 0.03);
  const gateAt = t => {
    let g = 0;
    sorted.forEach((nt, k) => {
      const end = tied[k] ? sorted[k + 1].t + 0.005 : nt.t + nt.len;
      if (t >= nt.t && t < end) g = Math.max(g, (k > 0 && tied[k - 1] ? 1 : Math.min(1, (t - nt.t) / 0.002)) * (tied[k] ? 1 : smooth((end - t) / 0.04)));
    });
    return g;
  };
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR; ph += mtof(pitchAt(t)) / SR; if (ph >= 1) ph -= 1;
    x[i] = Math.sin(TAU * ph) * gateAt(t);
  }
  const src = shape(x, v => Math.tanh(v) + 0.25 * Math.sin(2.7 * v), 6);
  const seq = [{ t: 0, ph: SYL[sorted[0].syl][0][0] }];
  for (const nt of sorted) for (const [p, at, gl] of SYL[nt.syl]) seq.push({ t: nt.t + at * nt.len, ph: p, glide: Math.max(0.01, gl * nt.len) });
  const last = sorted[sorted.length - 1];
  seq.push({ t: last.t + last.len + 0.01, ph: 'mm', glide: 0.05 });
  const mouth = throat(src, { art: articulation(seq), size: () => size, metal: () => 0.35, breath: 0.2, seed: 12 });
  const sub = shape(x, Math.tanh, 2.2), { lo } = split(sub, 110), { hi } = split(mouth, 110);
  const pres = new Biquad('peak', 1400, 0.9, 3);
  const out = new Float64Array(len);
  let pl = 0, pm = 0; for (let i = 0; i < len; i++) { pl = Math.max(pl, Math.abs(lo[i])); pm = Math.max(pm, Math.abs(hi[i])); }
  for (let i = 0; i < len; i++) out[i] = 0.85 * lo[i] / pl + pres.tick(hi[i]) / pm;
  return fade(out, 0.0005, 0.06);
}

// ---------- the Mouth Drop ----------
/**
 * Feed a bar of the finished beat (stereo, from the pre-pass render) through the vocal tract:
 * open "ah", rounding to "oh", "oo", then the lips seal ("mm": only a nasal hum of the beat is
 * left) while the mouth grows to giant size. Then silence, and a reversed breath that rises
 * into the drop. Returns mono (the beat collapses to the centre as it is swallowed).
 * Times are seconds from the bar start; `bar` is the bar length.
 */
export function mouthDrop(bus, { bar, sealAt, silenceAt, breathFrom }) {
  const len = Math.min(bus.L.length, n(bar + 0.05)), mid = new Float64Array(len);
  for (let i = 0; i < len; i++) mid[i] = 0.5 * (bus.L[i] + bus.R[i]);
  const art = articulation([
    { t: 0, ph: 'ah' }, { t: 0.25 * sealAt, ph: 'ah', glide: 0.05 },
    { t: 0.45 * sealAt, ph: 'oh', glide: 0.35 * sealAt }, { t: 0.8 * sealAt, ph: 'oo', glide: 0.18 * sealAt },
    { t: sealAt, ph: 'mm', glide: 0.12 },
  ]);
  const size = t => 1.05 - 0.35 * smooth(t / silenceAt);          // the mouth grows as it closes
  const mouthRaw = throat(mid, { art, size, metal: () => 0.25, breath: 0, seed: 21 });
  // The tract model loses the low end and is darker than the beat, so: the beat's body below
  // 180 Hz stays dry ("through the cheeks") until the seal; above it the mouth takes over during
  // beats 1-2, level-matched by RMS (peak matching followed a resonance spike and sank the bar
  // 10-25 dB in the first draft), with presence restored so the open "ah" is the brightest moment.
  const { lo, hi: dryHi } = split(mid, 180), { hi: mouthHi } = split(mouthRaw, 180);
  const shelf = new Biquad('hs', 2500, 0.7, 7), pres = new Biquad('peak', 1200, 0.8, 3);
  const mouth = Float64Array.from(mouthHi, v => pres.tick(shelf.tick(v)));
  const rms = (x, a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); };
  const k = rms(dryHi, n(0.1), n(0.6)) / Math.max(1e-9, rms(mouth, n(0.1), n(0.6)));
  // the reversed breath: aspiration only, through an opening mouth, played backwards
  const bLen = n(bar - breathFrom), zero = new Float64Array(bLen);
  const bArt = articulation([{ t: 0, ph: 'hh' }, { t: 0.02, ph: 'ah', glide: 0.05 }, { t: 0.06, ph: 'hh', glide: 0.02 }]);
  const breathRaw = throat(zero, { art: t => ({ ...bArt(t), aspiration: 1, voicing: 0 }), metal: () => 0.2, breath: 1, seed: 33 });
  const breath = Float64Array.from(breathRaw, (_, i) => breathRaw[bLen - 1 - i] * smooth(i / bLen) * smooth((bLen - i) / n(0.01)));
  let pb = 0; for (const v of breath) pb = Math.max(pb, Math.abs(v));
  const out = new Float64Array(n(bar + 0.05));
  const sil = n(silenceAt), b0 = n(breathFrom);
  for (let i = 0; i < len; i++) {
    const t = i / SR, wet = smooth((t - 0.12) / 0.5);
    const body = 1 - 0.65 * smooth((t - sealAt) / 0.2);              // muffled thump once sealed
    const g = i < sil ? smooth((sil - i) / n(0.04)) : 0;
    out[i] = (lo[i] * body + (1 - wet) * dryHi[i] + wet * k * mouth[i]) * g;
  }
  let pd = 0; for (let i = 0; i < len; i++) pd = Math.max(pd, Math.abs(mid[i]));
  for (let i = 0; i < bLen && b0 + i < out.length; i++) out[b0 + i] += 0.3 * pd * breath[i] / pb;
  return out;
}

// ---------- the hover spin-up ----------
/**
 * The Wobble Beast's cable winds from slow pulses (a ratchet you can count) into pitch: an
 * electromagnetic engine spinning up, and it opens its mouth ("aah") as it reaches the note.
 * `bars` long at 96 BPM; ends on `midi`.
 */
export function hoverSpinUp({ bars = 1, midi = 41, restPeriod = 0.28, anger = 0.85 }) {
  const steps120 = bars * 16 * 1.25, PRE = 1;
  const { sub, mid } = beast({
    seconds: (PRE + steps120) * 0.125 + 0.2, phrases: [],
    winds: [{ from: PRE, to: PRE + steps120 - 0.6, midi, restPeriod }], seed: 88,
  });
  const from = n(PRE * 0.125), len = sub.length - from, out = new Float64Array(len);
  for (let i = 0; i < len; i++) out[i] = mid[from + i] + 0.6 * sub[from + i];
  void anger;
  return fade(out, 0.002, 0.03);
}

// ---------- WAV (PCM16, mono or stereo) ----------
/** peakDb null writes at the given scale (no normalization). */
export function writeWav(path, x, peakDb = -1) {
  const chans = x.L ? [x.L, x.R] : [x], frames = chans[0].length;
  let p = 0; for (const c of chans) for (const v of c) p = Math.max(p, Math.abs(v));
  const g = peakDb === null ? 1 : p > 0 ? 10 ** (peakDb / 20) / p : 1, nc = chans.length, data = frames * 2 * nc, wav = Buffer.alloc(44 + data);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + data, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(nc, 22);
  wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 2 * nc, 28); wav.writeUInt16LE(2 * nc, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(data, 40);
  for (let i = 0, o = 44; i < frames; i++) for (const c of chans) { wav.writeInt16LE(clamp(Math.round(c[i] * g * 32767), -32768, 32767), o); o += 2; }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, wav);
  return { frames, seconds: frames / SR, channels: nc };
}

/** Read a PCM16 WAV (as the engine writes it) into float channels. */
export function readWav(buf) {
  const nc = buf.readUInt16LE(22); let o = 12, dataAt = -1, dataLen = 0;
  while (o + 8 <= buf.length) { const id = buf.toString('ascii', o, o + 4), sz = buf.readUInt32LE(o + 4); if (id === 'data') { dataAt = o + 8; dataLen = sz; break; } o += 8 + sz + (sz & 1); }
  const frames = dataLen / (2 * nc), L = new Float64Array(frames), R = new Float64Array(frames);
  for (let i = 0; i < frames; i++) { L[i] = buf.readInt16LE(dataAt + 2 * nc * i) / 32768; R[i] = nc > 1 ? buf.readInt16LE(dataAt + 2 * nc * i + 2) / 32768 : L[i]; }
  return { L, R };
}
