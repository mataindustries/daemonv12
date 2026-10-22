// MORPH//02 A — THE MACHINE LEARNS TO SING
// One continuous physical voice (glottal pulse -> 44-section waveguide throat) learns a
// word. Bar 1: a tiny synthetic child hums "mm-AH" and sings "hel-lo" over a music box,
// finding each pitch from slightly off. Bar 2: more confident; the vibrato turns into a
// stepped machine wobble; a heartbeat starts. Bar 3: the throat physically stretches while
// the pitch falls two octaves into a period-doubled growl, then the tongue jams into an
// accelerating "lo-lo-lo" stutter. Bar 4: the monster sings "HEL-LOOO" over half-time
// drums, rises in anguish and cracks back into the child's falsetto. In the silence: "hello?"
// 90 BPM, D minor.
import {
  SR, TAU, mtof, clamp, smooth, stereo, rng, bipolar, drift, addAt, addPan, addStereo, dbToGain,
  SVF, Biquad, filt, Osc, shape, tube, reverb, echo, modal, compress, norm, monoBass, fadeTail, eqStereo, scale, master,
} from './dsp.mjs';
import { renderVoice, articulation } from './voice.mjs';

export const BPM = 90;
const BEAT = 60 / BPM, LENGTH = 12.0;
const b = beats => beats * BEAT;
const db = dbToGain;

/** Control curve through [t, value, kind?] points (smoothstep by default). */
function curve(points) {
  return t => {
    if (t <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      const [t1, v1, kind] = points[i], [t0, v0] = points[i - 1];
      if (t <= t1) {
        let u = (t - t0) / (t1 - t0);
        u = kind === 'lin' ? u : kind === 'in' ? u * u : kind === 'step' ? (u >= 1 ? 1 : 0) : smooth(u);
        return v0 + (v1 - v0) * u;
      }
    }
    return points[points.length - 1][1];
  };
}

// ------------------------------------------------------------------ the performance
// Pitch: [beat, midi, glide seconds, learning error in cents]
const PITCH = [
  [0, 62, 0, -70], [0.75, 69, 0.38, 0],                       // "mm" D4 blossoming into "AH" A4
  [2.0, 67, 0.05, 55], [2.45, 65, 0.07, -45],                 // "hel-lo" G4 F4
  [4.0, 69, 0.04, 30], [4.45, 65, 0.05, -20],                 // bar 2: "hel-lo" A4 F4
  [5.0, 67, 0.04, 15], [5.45, 64, 0.05, -15],                 // "hel-lo" G4 E4
  [6.0, 62, 0.04, 0], [6.45, 69, 0.09, 0],                    // "hel-lo" D4 -> A4 (held: machine vibrato)
  [8.0, 69, 0.03, 0], [8.25, 50, 1.25, 0],                    // bar 3: "HEL..." A4 falls to D3 as the throat grows
  [10.0, 50, 0.02, 0], [10.5, 51, 0.02, 0], [10.875, 52, 0.02, 0], [11.125, 53, 0.02, 0], [11.3125, 55, 0.02, 0], [11.4375, 57, 0.02, 0],
  [12.0, 53, 0.05, 0], [12.5, 50, 0.12, 0],                   // bar 4: "HEL-LOOO" F3 D3
  [13.5, 57, 0.35, 0],                                        // anguish: up to A3
  [14.5, 69, 0.04, 0],                                        // the crack: falsetto A4, the child inside
  [16.25, 62, 0.03, 0], [16.6, 65, 0.12, 0],                  // "hel-lo?" D4 rising to F4
];
// Voiced spans [startBeat, endBeat]
const VOICED = [[0.02, 3.72], [4.0, 4.95], [5.0, 5.95], [6.0, 7.72], [7.82, 11.48], [11.53, 15.35], [16.22, 17.05]];
// Articulation: [beat, phoneme, glide seconds]
const STUTTER = [10.0, 10.5, 10.875, 11.125, 11.3125, 11.4375];
const SEQ = [
  [0, 'mm'], [0.75, 'ah', 0.22],
  [2.0, 'hh', 0.03], [2.07, 'eh', 0.05], [2.36, 'll', 0.05], [2.47, 'oh', 0.06], [3.3, 'oo', 0.25],
  [4.0, 'hh', 0.02], [4.06, 'eh', 0.04], [4.36, 'll', 0.04], [4.46, 'oh', 0.05],
  [5.0, 'hh', 0.02], [5.06, 'eh', 0.04], [5.36, 'll', 0.04], [5.46, 'oh', 0.05],
  [6.0, 'hh', 0.02], [6.06, 'eh', 0.04], [6.36, 'll', 0.04], [6.46, 'oh', 0.05], [7.3, 'oo', 0.25],
  [7.8, 'hh', 0.02],                                           // a mechanical inhale
  [8.0, 'eh', 0.03], [8.6, 'ah', 0.8],                         // "HEEE-AAA" while the throat stretches
  ...STUTTER.flatMap((beat, k) => [[beat - 0.06, 'll', 0.025], [beat + 0.02, k % 2 ? 'oh' : 'uh', 0.03]]),
  [11.55, 'hh', 0.02],                                         // the monster inhales in the gap
  [12.0, 'eh', 0.03], [12.36, 'll', 0.05], [12.5, 'oh', 0.07], [13.5, 'ah', 0.4], [14.5, 'oo', 0.06],
  [16.22, 'hh', 0.02], [16.27, 'eh', 0.04], [16.5, 'll', 0.04], [16.6, 'oh', 0.05], [16.9, 'oo', 0.12],
].map(([beat, ph, glide]) => ({ t: b(beat), ph, ...(glide ? { glide } : {}) }));

// Character over time
const SIZE = curve([[0, 1.32], [b(6), 1.25], [b(8.0), 1.22], [b(10), 0.56, 'in'], [b(12), 0.52], [b(14.48), 0.5], [b(14.56), 1.3, 'lin'], [b(16), 1.35]]);
const TENSE = curve([[0, 0.3], [b(4), 0.42], [b(7.5), 0.55], [b(8.2), 0.7], [b(10), 0.95], [b(14.48), 0.95], [b(14.56), 0.3, 'lin'], [b(16.2), 0.25]]);
const GROWL = curve([[0, 0], [b(8.4), 0], [b(10), 0.75], [b(11.5), 0.6], [b(12), 0.8], [b(14.4), 0.85], [b(14.5), 0, 'lin']]);
const METAL = curve([[0, 0], [b(5), 0.05], [b(7.5), 0.25], [b(10), 0.7], [b(14.4), 0.75], [b(14.5), 0.1, 'lin'], [b(16), 0]]);
const DRIFT = curve([[0, 1.0], [b(4), 0.45], [b(8), 0.15], [b(14.5), 0.15], [b(14.6), 0.6], [b(16), 0.8]]);
const VIB = curve([[0, 8], [b(1.5), 18], [b(3), 26], [b(4), 14], [b(8), 0], [b(12.6), 0], [b(13.2), 55], [b(14.5), 70], [b(14.6), 30], [b(16), 10]]);
const ASP = curve([[0, 0.25], [b(4), 0.12], [b(8), 0.05], [b(14.5), 0.05], [b(14.6), 0.35], [b(16), 0.3]]);

function pitchAt(t) {
  let midi = PITCH[0][1], cents = 0;
  for (let k = 0; k < PITCH.length; k++) {
    const [beat, m, glide, learn] = PITCH[k], t0 = b(beat);
    if (t < t0) break;
    const prev = k ? PITCH[k - 1][1] : m;
    const u = glide > 0 ? (k >= 7 && beat === 8.25 ? clamp((t - t0) / glide, 0, 1) ** 1.6 : smooth((t - t0) / glide)) : 1;
    midi = prev + (m - prev) * u;
    // "learning": each early note starts off-pitch and is pulled in, like a singer finding it
    cents = learn * Math.exp(-(t - t0) / 0.13);
  }
  // bar 2's held note: the vibrato becomes a stepped machine wobble
  if (t > b(6.7) && t < b(7.72)) {
    const depth = smooth((t - b(6.7)) / 0.3) * 75;
    cents += depth * Math.tanh(6 * Math.sin(TAU * 6.5 * (t - b(6.7))));
  }
  return mtof(midi) * 2 ** (cents / 1200);
}
function voicedAt(t) {
  let v = 0;
  for (const [s, e] of VOICED) v = Math.max(v, smooth((t - b(s)) / 0.03) * (1 - smooth((t - b(e)) / 0.06)));
  return v;
}
const ctl = t => ({
  f0: pitchAt(t), voicing: voicedAt(t), tenseness: TENSE(t), aspiration: ASP(t), growl: GROWL(t),
  jitter: 0.004 + 0.02 * GROWL(t), shimmer: 0.03 + 0.12 * GROWL(t), size: SIZE(t), metal: METAL(t),
  vibratoDepth: VIB(t), vibratoRate: 5.2 + 0.8 * GROWL(t), drift: DRIFT(t),
});

// ------------------------------------------------------------------ instruments
/** Music-box tine: free-free bar modes, soft pluck. */
function tine(midi, detune = 0, seed = 1) {
  const n = Math.round(2.2 * SR), x = new Float64Array(n), r = bipolar(rng(seed)), f = mtof(midi) * 2 ** (detune / 1200);
  for (let i = 0; i < 40; i++) x[i] = r() * Math.exp(-i / 6) + (i < 3 ? 1 : 0);
  return norm(modal(x, [[1, 1.6, 1], [2.756, 0.55, 0.35], [5.404, 0.22, 0.18], [8.933, 0.1, 0.08]].map(([k, t60, gain]) => ({ f: f * k, t60, gain }))));
}
/** Heartbeat thump: sub sine with a tiny pitch drop. */
function thump(level = 1) {
  const n = Math.round(0.4 * SR), out = new Float64Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (48 + 40 * Math.exp(-t / 0.03)) / SR; out[i] = Math.sin(ph) * Math.exp(-t / 0.075) * smooth(t / 0.004) * level; }
  return norm(shape(out, tube, 1.3), level);
}
/** Servo/gear tick: tiny metal escapement. size > 1 makes it bigger and lower. */
function gear(size = 1, seed = 1) {
  const n = Math.round((0.08 + 0.15 * size) * SR), x = new Float64Array(n), r = bipolar(rng(seed));
  for (let i = 0; i < 30; i++) x[i] = r() * Math.exp(-i / 5);
  return norm(modal(x, [2310, 3870, 5120, 7340].map((f, k) => ({ f: f / size, t60: 0.04 * size + 0.01 * k, gain: 1 / (k + 1) }))));
}
/** Colossal kick: long pitch fall, saturated, with a felt click. */
function bigKick(seed = 5) {
  const n = Math.round(1.1 * SR), out = new Float64Array(n), r = bipolar(rng(seed)); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += TAU * (36 + 110 * Math.exp(-t / 0.045) + 20 * Math.exp(-t / 0.3)) / SR;
    out[i] = Math.sin(ph) * (t < 0.05 ? 1 : Math.exp(-(t - 0.05) / 0.45)) * smooth(t / 0.0015) + (i < 300 ? 0.25 * r() * Math.exp(-i / 40) : 0);
  }
  return norm(shape(out, Math.tanh, 2.2));
}
/** Metal slam: a door of a pressure vessel slamming. Noise + steel plate modes + short body. */
function slam(seed = 7) {
  const n = Math.round(1.4 * SR), x = new Float64Array(n), r = bipolar(rng(seed));
  for (let i = 0; i < 2000; i++) x[i] = r() * Math.exp(-i / 260);
  const plate = norm(modal(x, [181, 263, 347, 461, 588, 733, 912, 1187, 1499, 1873].map((f, k) => ({ f, t60: 1.1 - k * 0.07, gain: 1 / (1 + 0.3 * k) }))));
  const crack = norm(filt(x.slice(), 'bp', 2400, 0.8));
  const out = new Float64Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (90 + 80 * Math.exp(-t / 0.02)) / SR; out[i] = 0.6 * plate[i] + 0.7 * crack[i] + 0.6 * Math.sin(ph) * Math.exp(-t / 0.09); }
  return norm(shape(out, tube, 1.6));
}
/** Servo whine riser that follows a pitch curve. */
function whine(seconds, f0, f1, seed = 3) {
  const n = Math.round(seconds * SR), out = new Float64Array(n), w = drift(seed, 9); let ph = 0, ph2 = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n, f = f0 * (f1 / f0) ** (u * u) * (1 + 0.01 * w());
    ph += TAU * f / SR; ph2 += TAU * f * 1.5 / SR;
    out[i] = (Math.sin(ph + 0.8 * Math.sin(ph2)) * 0.7 + 0.3 * Math.sin(2 * ph)) * smooth(u / 0.3) * (1 - smooth((u - 0.92) / 0.08));
  }
  return norm(out);
}

/** The bare physical voice performance (no processing), for the kit integration. */
export function voiceOnly() { return norm(renderVoice({ seconds: LENGTH, seed: 9, ctl, art: articulation(SEQ) })); }

// ------------------------------------------------------------------ arrangement
export function render() {
  const n = Math.round(LENGTH * SR);
  const art = articulation(SEQ);
  const voice = renderVoice({ seconds: LENGTH, seed: 9, ctl, art });
  // The giant's shadow: the same performance through a vaster, all-metal throat an octave down.
  const shadowCtl = t => ({ ...ctl(t), f0: ctl(t).f0 / 2, size: Math.min(0.42, SIZE(t) * 0.8), metal: 1, growl: Math.min(1, GROWL(t) + 0.15), tenseness: 1, drift: 0.1 });
  const shadow = renderVoice({ seconds: LENGTH, seed: 13, ctl: shadowCtl, art });
  // ...and a fifth below it, so the monster sings a power chord with itself.
  const fifthCtl = t => ({ ...shadowCtl(t), f0: ctl(t).f0 * 2 / 3, size: Math.min(0.48, SIZE(t) * 0.9), growl: GROWL(t) });
  const fifth = renderVoice({ seconds: LENGTH, seed: 17, ctl: fifthCtl, art });
  norm(voice); norm(shadow); norm(fifth);

  // Voice processing: clean and close at first, then a throat overdriven by its own growth.
  const drive = new Float64Array(n), shadowGain = curve([[0, 0], [b(9), 0], [b(10.5), 0.5], [b(12), 0.85], [b(14.45), 0.85], [b(14.5), 0, 'lin']]);
  const driveCurve = curve([[0, 0.9], [b(7.5), 1.1], [b(10), 2.0], [b(14.45), 2.4], [b(14.5), 0.9, 'lin']]);
  for (let i = 0; i < n; i++) drive[i] = driveCurve(i / SR);
  const voiceHot = shape(voice, tube, drive);
  // level management: the growing voice gets louder, but not by as much as the drive suggests
  const voiceLevel = curve([[0, db(-2)], [b(8), db(-2)], [b(10), db(-4)], [b(14.45), db(-4)], [b(14.5), db(-3), 'lin']]);
  const shadowHot = filt(filt(shape(shadow, tube, 2.5), 'hp', 110, 0.7), 'hp', 110, 0.7);
  // Sub layer: a sine an octave below the sung pitch, from the moment the throat grows.
  const sub = new Float64Array(n), subGain = curve([[0, 0], [b(11.95), 0], [b(12.1), 1], [b(14.42), 1], [b(14.48), 0, 'lin']]);
  let sph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; sph += TAU * ctl(t).f0 / 2 / SR; sub[i] = Math.sin(sph) * subGain(t) * voicedAt(t); }

  const dry = stereo(LENGTH), roomIn = stereo(LENGTH), hallIn = stereo(LENGTH);
  const vL = new Float64Array(n);
  for (let i = 0; i < n; i++) vL[i] = voiceHot[i] * voiceLevel(i / SR);
  addPan(dry, vL, 0, db(-1), 0);
  // shadow spread wide with a tiny Haas offset: one voice, the size of a building
  const sh = new Float64Array(n);
  for (let i = 0; i < n; i++) sh[i] = shadowHot[i] * shadowGain(i / SR);
  addPan(dry, sh, 0, db(-10), -0.75); addPan(dry, sh, 0.011, db(-10), 0.75);
  const fifthHot = filt(shape(fifth, tube, 2.2), 'hp', 120, 0.7);
  const fh = Float64Array.from(fifthHot, (v, i) => v * shadowGain(i / SR));
  addPan(dry, fh, 0.006, db(-12), 0.45); addPan(dry, fh, 0.017, db(-12), -0.45);
  addPan(dry, sub, 0, db(-11), 0);
  addPan(roomIn, vL, 0, db(-4), 0);
  const hallSend = curve([[0, 0.05], [b(7), 0.15], [b(10), 0.5], [b(14.5), 0.6], [b(16), 0.15]]);
  const vSend = Float64Array.from(vL, (v, i) => v * hallSend(i / SR));
  addPan(hallIn, vSend, 0, 1, 0); addPan(hallIn, sh, 0, db(-6), 0); addPan(hallIn, fh, 0, db(-8), 0);
  const echoSend = curve([[0, 0], [b(3.9), 0], [b(4), 1], [b(7.7), 1], [b(7.9), 0]]);
  const vEcho = stereo(LENGTH);
  addPan(vEcho, Float64Array.from(vL, (v, i) => v * echoSend(i / SR)), 0, 1, 0);
  const machineEcho = echo(vEcho, { left: BEAT * 0.75, right: BEAT * 0.5, feedback: 0.35, lp: 4500, hp: 400, pingpong: true });

  // Music box: Dm(add9) arpeggio; in bar 3 it winds down, detuning and slowing.
  const box = [[0, 86], [1, 81], [2, 89], [3, 88], [4, 86], [5, 81], [6, 89], [6.5, 88], [7, 84], [8.0, 86, -40], [9.2, 81, -110], [10.7, 77, -260]];
  box.forEach(([beat, m, det = 0], k) => {
    const g = beat >= 8 ? db(-17) : db(-14);
    addPan(dry, tine(m, det, 40 + k), b(beat), g, k % 2 ? 0.45 : -0.35);
    addPan(roomIn, tine(m, det, 40 + k), b(beat), g * 0.7, 0);
  });
  // The final "hello?" gets one tine as an answer.
  addPan(dry, tine(86, 0, 99), b(17.4), db(-16), 0.3); addPan(roomIn, tine(86, 0, 99), b(17.4), db(-18), 0);

  // Heartbeat in bar 2, accelerating through bar 3, then a held breath.
  const hearts = [4, 4.33, 6, 6.33, 8, 8.33, 9, 9.33, 9.75, 10, 10.33, 10.67, 10.875, 11.0, 11.125, 11.25, 11.375];
  hearts.forEach((beat, k) => addPan(dry, thump(), b(beat), db(beat < 8 ? -16 : -13) * (k % 2 ? 0.7 : 1), 0));
  // Servo gears: quiet 16ths in bar 2, swelling and growing in bar 3.
  for (let s = 16; s < 46; s++) {
    const beat = s / 4, size = beat < 8 ? 1 : 1 + (beat - 8) * 0.5;
    addPan(dry, gear(size, 200 + s), b(beat), db(beat < 8 ? -26 : -20 + (beat - 8) * 2), s % 2 ? 0.6 : -0.6);
  }
  addPan(dry, whine(b(3.4), 180, 2600, 4), b(8.1), db(-21), 0.2);
  addPan(hallIn, whine(b(3.4), 180, 2600, 4), b(8.1), db(-18), 0);

  // Bar 4: the monster's drums (half time).
  const kicks = [12, 13.5], slams = [14];
  for (const k of kicks) { addPan(dry, bigKick(5 + k), b(k), db(-2), 0); addPan(hallIn, bigKick(5 + k), b(k), db(-16), 0); }
  for (const s of slams) { addPan(dry, slam(7), b(s), db(-6), 0.08); addPan(hallIn, slam(7), b(s), db(-6), 0); }
  // A last enormous hit under the stutter's end -> the drop.
  addPan(dry, slam(17), b(11.45), db(-12), -0.1);

  // Spaces: a nursery-sized room at first; a cathedral-sized machine hall for the monster.
  const room = reverb(roomIn, { size: 0.35, rt60: 0.6, hfRatio: 0.7, predelay: 0.004, lowCut: 200, seed: 3 });
  const hall = reverb(hallIn, { size: 3.2, rt60: 5.5, hfRatio: 0.4, predelay: 0.06, lowCut: 140, seed: 5 });
  const slap = echo(hallIn, { left: BEAT * 0.75, right: BEAT, feedback: 0.2, lp: 2500, hp: 300, pingpong: true });
  const mix = stereo(LENGTH);
  addStereo(mix, dry); addStereo(mix, room, 0, db(-8)); addStereo(mix, hall, 0, db(-5)); addStereo(mix, slap, 0, db(-14)); addStereo(mix, machineEcho, 0, db(-11));
  monoBass(mix, 120);
  eqStereo(mix, [['hp', 28, 0.7, 0], ['peak', 350, 0.9, -1.5], ['peak', 3200, 1.0, 2], ['hs', 8000, 0.7, 2]]);
  const gr = compress(mix, { threshold: -12, ratio: 2, attack: 0.02, release: 0.15, knee: 8 });
  const mastering = master(mix, { targetLufs: -14, ceilingDb: -1.2, release: 0.08 });
  fadeTail(mix, 0.2);
  return { bus: mix, meta: { bpm: BPM, seconds: LENGTH, compressorMaxDb: gr.reduce((a, c) => Math.max(a, c), 0), ...mastering } };
}
