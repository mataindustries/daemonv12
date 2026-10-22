// MORPH//04 percussion: struck physical objects, built from the MORPH//03 instruments where
// possible (the cable model, MORPH//02 B's household kit) plus two small modal drums.
// Every one-shot starts from a zero sample and has no energy below 28 Hz.
import { SR, TAU, mtof, smooth, rng, bipolar, SVF, Biquad, filt, shape, modal, norm } from '../morph-03/dsp.mjs';
import { cable, curve } from '../morph-03/cable.mjs';

/** A 0.3 ms fade-in: oversampled shaping leaves a few samples of pre-ring before the hit. */
const onset = x => { for (let i = 0; i < 13; i++) x[i] *= smooth(i / 13); return x; };
const hp4 = (x, fc) => { new Biquad('hp', fc, 0.5412).run(x); new Biquad('hp', fc, 1.3066).run(x); return x; };
// circular membrane modes (Bessel zeros relative to the (0,1) mode) and the share each gets
// from a strike near the centre (axisymmetric modes dominate) or off-centre (the rest wake up)
const MEMBRANE = [1, 1.594, 2.136, 2.296, 2.653, 2.918, 3.156, 3.501, 3.6];
const AXISYMMETRIC = new Set([0, 3, 8]);

/**
 * A struck membrane whose tension rises with displacement: the pitch starts `lift` semitones
 * high and falls back as the skin's swing decays (the physics behind every kick's "drop").
 * f0 Hz at rest; decay = T60 of the fundamental; hard = beater hardness 0..1; centre 0..1.
 */
export function membrane({ f0, lift = 12, liftTau = 0.03, decay = 0.3, hard = 0.7, centre = 0.9, beater = 1, seconds, seed = 1 }) {
  const n = Math.round((seconds ?? decay * 1.4 + 0.05) * SR), out = new Float64Array(n);
  const contact = 0.004 - 0.0034 * hard; // beater contact time: a hard beater excites higher modes
  MEMBRANE.forEach((r, k) => {
    const share = AXISYMMETRIC.has(k) ? 1 / (1 + 0.6 * k / 8) : (1 - centre) * 0.8 / (1 + k / 4);
    const f = f0 * r, spectrum = 1 / (1 + (f * contact * 1.6) ** 4); // contact pulse's spectrum
    const g = share * spectrum * (k ? 0.55 : 1), t60 = decay / r ** 1.6;
    if (g < 0.003 || f > SR * 0.4) return;
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, bend = 2 ** (lift / 12 * Math.exp(-t / liftTau));
      ph += TAU * f * bend / SR;
      out[i] += g * Math.sin(ph) * 10 ** (-3 * t / t60) * smooth(t / contact);
    }
  });
  // beater contact: a click (the beater's own impact) and a knock (the head's dense upper modes,
  // which a sinusoidal mode list doesn't reach); both scale with hardness
  const r = bipolar(rng(seed)), clickF = new SVF(2600, 1.1), knockF = new SVF(f0 * 9, 1.6);
  for (let i = 0; i < Math.min(n, Math.round(0.05 * SR)); i++) {
    const t = i / SR, v = r(), on = smooth(t / contact);
    clickF.tick(v); knockF.tick(v);
    out[i] += beater * hard * on * (0.9 * hard * clickF.bp * Math.exp(-t / 0.0015) + 0.5 * knockF.bp * Math.exp(-t / 0.009));
  }
  return out;
}

/** Kick: a big membrane, tension drop of about an octave, a short boom that leaves room for the bass. */
export function kick({ f0 = 52, lift = 13, decay = 0.32, hard = 0.75, beater = 5, drive = 1.8, seed = 5 } = {}) {
  const x = membrane({ f0, lift, liftTau: 0.028, decay, hard, centre: 0.95, beater, seed });
  const hot = shape(norm(x), Math.tanh, drive);
  return norm(onset(hp4(hot, 30)));
}

/**
 * Snare: a tighter membrane whose swing slaps the snare wires (one-sided contact: the wires buzz
 * when the bottom head moves away from them), plus the stick. `wires` sets the rattle's length;
 * `crack` layers a struck cable (the instrument's own laser chirp inside the snare).
 */
export function snare({ f0 = 185, decay = 0.22, wires = 0.18, hard = 0.85, crack = 0, crackMidi = 55, seed = 21 } = {}) {
  const head = membrane({ f0, lift: 2.5, liftTau: 0.012, decay, hard, centre: 0.35, seconds: Math.max(decay * 1.3, wires * 3) + 0.05, seed });
  const n = head.length, r = bipolar(rng(seed + 1)), wire = new Float64Array(n);
  const peak = head.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
  const bpLo = new Biquad('hp', 1700, 0.7), bpHi = new Biquad('lp', 9500, 0.7);
  let env = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, away = Math.max(0, -head[i] / peak); // bottom head swinging away from the wires
    env = Math.max(env * Math.exp(-1 / (wires * 0.35 * SR)), away);
    wire[i] = bpHi.tick(bpLo.tick(r())) * (0.25 * env + 0.75 * away) * smooth(t / 0.0008);
  }
  norm(head); norm(wire);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = 0.75 * head[i] + 0.9 * wire[i];
  if (crack > 0) {
    const c = cable({ seconds: n / SR, period: 1 / mtof(crackMidi), disp: -0.72, stages: 80, gain: 0.8, bright: 9000, drive: 1.5,
      events: [{ t: 0, kind: 'crack', amp: 1, hard: 1 }], seed: seed + 2 }).out;
    norm(c);
    for (let i = 0; i < n; i++) out[i] += crack * c[i];
  }
  return norm(onset(hp4(shape(norm(out), Math.tanh, 1.4), 90)));
}

/**
 * Cable tom: a short slapped cable tuned to a note. The slap's tension spike makes the pitch
 * dive into the note (the cable's own "tom" physics), and the dispersion gives it a chirp.
 */
export function cableTom(midi, { stretch = 0.35, dive = 1, decay = 0.35, disp = -0.45, bright = 3500, buzz = 0.2, seed = 41 } = {}) {
  const sec = decay + 0.1;
  const c = cable({
    seconds: sec, period: 1 / mtof(midi), disp, stages: 96, gain: 0.97, bright, drive: 1.6,
    damp: curve([[0, 1], [decay * 0.4, 1], [decay, 0.15]]), buzz,
    events: [{ t: 0, kind: 'slap', hard: 1, amp: 1, stretch: stretch * dive, pos: 0.1 }], seed,
  }).out;
  const fade = Math.round(0.02 * SR);
  for (let i = 0; i < fade; i++) c[c.length - 1 - i] *= i / fade;
  return norm(hp4(c, 45));
}

/** Cable tick: a tiny, very tight cable flicked: an inharmonic metallic tick (closed-hat role). */
export function cableTick({ midi = 100, decay = 0.05, disp = -0.8, seed = 7 } = {}) {
  const c = cable({
    seconds: decay * 2 + 0.03, period: 1 / mtof(midi), disp, stages: 24, gain: 0.96, bright: 16000, drive: 1.3,
    damp: curve([[0, 1], [decay, 0.4], [decay * 2, 0]]), events: [{ t: 0, kind: 'crack', amp: 1, hard: 1 }], seed,
  }).out;
  return norm(filt(filt(c, 'hp', 3000, 0.7), 'hp', 3000, 0.7));
}

/** Cable shaker: a scrape along a short tight cable (rough grain, pitched metal underneath). */
export function cableScrape({ midi = 88, seconds = 0.09, seed = 13 } = {}) {
  const c = cable({
    seconds: seconds + 0.05, period: 1 / mtof(midi), disp: -0.7, stages: 32, gain: 0.9, bright: 14000, drive: 1.4,
    damp: curve([[0, 1], [seconds, 0.6], [seconds + 0.04, 0]]),
    events: [{ t: 0, kind: 'scrape', amp: 1, hard: 0.9 }], seed,
  }).out;
  return norm(filt(filt(c, 'hp', 2500, 0.7), 'hp', 2500, 0.7));
}
