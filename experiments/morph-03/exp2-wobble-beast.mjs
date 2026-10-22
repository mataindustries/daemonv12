// MORPH//03 — EXPERIMENT 2: THE WOBBLE BEAST
// Call and response, 4 bars at 120 BPM in a half-time feel (snare on beat 3), E minor.
//   bar 1  CALL    the Tempo String: a strike, 3:4 chirp reflections, a fast ratchet into
//                  pitch, then a slapped "question" that bends upward
//   bar 2  ANSWER  the Beast: the same cable, bowed, growling through a physical throat.
//                  Wobbles are mouth shapes in time: WOM (quarter) wa-wa (eighths)
//                  ya-ya-ya (triplets) yoi + a choke
//   bar 3  CALL    angrier: slap dives, an abrupt tritone re-tension, a 32nd stutter, a
//                  twelfth squeal, and the cable snaps into reflections
//   bar 4  ANSWER  the Beast breaks: quintuplet chokes, an "EEE-YOOW" octave dive,
//                  3+3+2 wobs, a bit-crushed stutter glitch, a gasp, silence -> loop
// Rhythmic contrast: the cable and the Beast never wobble at the same time.
import {
  SR, mtof, smooth, stereo, addPan, addStereo, dbToGain as db, Biquad, filt, shape, reverb, echo, norm, rng, bipolar,
  split, foldLoop, foldMono, circular, circularWet, compress, master, eqStereo, combRes, crush, Delay,
} from './dsp.mjs';
import { cable, curve, tensionLane, zapLane } from './cable.mjs';
import { throat, articulation, wobbles } from './throat.mjs';

export const BPM = 120, BEAT = 0.5, S16 = 0.125, BARS = 4, SECONDS = 8, TAIL = 3;
const at = step => step * S16;
const hz = m => mtof(m);
const E1 = 28, F1 = 29, G1 = 31, A1 = 33, Bb1 = 34, B1 = 35, E2 = 40;

// ------------------------------------------------------------------ the caller (cable)
const CALLS = [
  // bar 1: strike at 0 (reflections), ratchet 0.5-1.0, then the question
  [8, E1, 'slap', 1.5, { amp: 1.4, stretch: 0.3 }], [10, E1, 'pluck', 0.8, { pop: 2 }], [11, G1, 'pluck', 0.8],
  [12, A1, 'pluck', 1.8, { bendTo: B1 }],
  // bar 3
  [32, E1, 'slap', 1.5, { amp: 1.7, stretch: 0.45 }], [34, E1, 'ghost', 0.6], [35, E1, 'pluck', 1, { pop: 2 }],
  [36, Bb1, 'pluck', 0.9, { hard: 1 }], [37, B1, 'pluck', 0.5], [37.5, B1, 'pluck', 0.5], [38, B1, 'pluck', 0.5], [38.5, B1, 'pluck', 0.5],
  [40, G1, 'slap', 1.5, { amp: 1.4, stretch: 0.3 }], [42, E1, 'pluck', 1.6, { pop: 3, hard: 1 }],
];
const CALL_NOTES = CALLS.map(([step, midi, kind, len, x = {}]) => ({ step, midi, kind, len, ...x }));
const SNAP = 44; // 5.5 s

function caller() {
  const lane = [{ t: 0, period: BEAT }, { t: at(4), period: 1 / hz(E1), glide: at(4), curve: 'lin' }];
  for (const nt of CALL_NOTES) {
    lane.push({ t: at(nt.step) - 0.004, hz: hz(nt.midi), glide: nt.kind === 'slap' ? 0.004 : 0.01 });
    if (nt.bendTo) lane.push({ t: at(nt.step + 0.6), hz: hz(nt.bendTo), glide: at(1.0), curve: 'lin' });
  }
  // between the calls the (damped, silent) cable slackens to an eighth-note round trip, slowly
  // enough that its read point never runs backwards, then ratchets back up under the Beast's "yoi"
  lane.push({ t: at(15), period: BEAT / 2, glide: 1.0, curve: 'lin' });
  lane.push({ t: at(28), period: 1 / hz(E1), glide: at(3.5), curve: 'lin' });
  const pitched = tensionLane(lane, { restPeriod: BEAT });
  const snapDive = t => Math.min(BEAT, 1 / hz(E1) + 0.92 * Math.max(0, t - at(SNAP)));
  const period = t => (t < at(SNAP) ? pitched(t) : snapDive(t));
  const mute = t => {
    let m = 1;
    for (let k = 0; k < CALL_NOTES.length; k++) {
      const nt = CALL_NOTES[k], stop = at(nt.step + nt.len), nextOn = k + 1 < CALL_NOTES.length ? at(CALL_NOTES[k + 1].step) : at(SNAP);
      if (t >= stop && t < nextOn - 0.003 && nextOn - stop < 0.6) m = Math.min(m, 0.5 + 0.5 * (1 - smooth((t - stop) / 0.01)));
      if (nt.kind === 'ghost' && t >= at(nt.step) && t < at(nt.step + nt.len)) m = Math.min(m, 0.62);
    }
    return m;
  };
  const harm = t => { for (const nt of CALL_NOTES) if (nt.pop && t >= at(nt.step) + 0.006 && t < at(nt.step + nt.len)) return smooth((t - at(nt.step) - 0.006) / 0.012); return 0; };
  const harmN = t => { for (const nt of CALL_NOTES) if (nt.pop && t >= at(nt.step) && t < at(nt.step + nt.len) + 0.05) return nt.pop; return 2; };
  return {
    period,
    disp: zapLane(curve([[0, -0.88], [at(4), -0.88], [at(8), -0.22, 'lin'], [at(15), -0.22], [at(16), -0.88], [at(28), -0.88], [at(32), -0.22, 'lin'], [at(SNAP), -0.22], [at(SNAP) + 0.08, -0.9]]),
      CALL_NOTES.map(nt => ({ t: at(nt.step), depth: nt.kind === 'slap' ? -0.6 : nt.kind === 'ghost' ? -0.2 : nt.len <= 0.5 ? -0.25 : -0.5 }))),
    gain: curve([[0, 0.86], [at(4), 0.9], [at(8), 0.99], [at(15), 0.99], [at(15.5), 0.6], [at(28), 0.6], [at(30), 0.95], [at(32), 0.99], [at(SNAP), 0.99], [at(SNAP) + 0.05, 0.88], [at(48), 0.72], [at(49), 0.5], [SECONDS, 0.5]]),
    bright: curve([[0, 7000], [at(8), 5200], [at(SNAP), 5200], [at(SNAP) + 0.1, 8000]]),
    damp: mute, drive: 2.4,
    buzz: t => { for (const nt of CALL_NOTES) if (t >= at(nt.step) && t < at(nt.step + Math.min(nt.len, 1.2))) return (nt.kind === 'slap' ? 0.8 : 0.4) * (1 - 0.6 * smooth((t - at(nt.step)) / at(1.2))); return 0.05; },
    harmonic: harm, harmonicN: harmN,
    pulse: curve([[0, 0], [at(4), 0], [at(4.5), 0.35], [at(7.6), 0.5], [at(8), 0], [at(28), 0], [at(29), 0.3], [at(31.6), 0.45], [at(32), 0]]),
  };
}

// ------------------------------------------------------------------ the Beast
const B3 = BEAT / 3, B5 = BEAT / 5;
const ANSWER_1 = [
  { t: at(16), len: BEAT, from: 'ww', to: 'ah', open: 0.35, close: 0.5 },                         // beat 1: WOM
  { t: at(20), len: BEAT / 2, from: 'ww', to: 'ah', open: 0.2, close: 0.6 },                      // beat 2: wa
  { t: at(22), len: BEAT / 2, from: 'ww', to: 'ah', open: 0.2, close: 0.6 },                      //         wa
  ...[0, 1, 2].map(k => ({ t: at(24) + k * B3, len: B3, from: 'ee', to: 'ah', open: 0.25, close: 0.6 })), // beat 3: ya ya ya
  { t: at(28), len: at(3), from: 'ee', to: 'oh', back: 'ee', open: 0.4, close: 0.4, end: 'kk' },  // beat 4: yoi + choke
];
const ANSWER_2 = [
  ...[0, 1, 2, 3, 4].map(k => ({ t: at(48) + k * B5, len: B5, from: k % 2 ? 'kk' : 'ww', to: 'ah', open: 0.2, close: 0.5 })), // quintuplet chokes
  { t: at(52), len: BEAT, from: 'ee', to: 'oh', back: 'ww', open: 0.55, close: 0.35 },            // EEE-YOOW
  { t: at(56), len: at(3), from: 'ww', to: 'ah', open: 0.25, close: 0.6 },                         // 3
  { t: at(59), len: at(3), from: 'ww', to: 'eh', open: 0.25, close: 0.6 },                         // 3
  { t: at(62), len: at(1.6), from: 'ng', to: 'ah', back: 'kk', open: 0.3, close: 0.5 },            // 2 (then the glitch)
];
function beastArticulation() {
  return articulation([
    { t: 0, ph: 'mm' },
    { t: at(15), ph: 'hh', glide: 0.02 },               // inhale before answering
    { t: at(15.8), ph: 'ww', glide: 0.01 },
    ...wobbles(ANSWER_1),
    { t: at(31.2), ph: 'mm', glide: 0.02 },
    { t: at(47), ph: 'hh', glide: 0.02 },
    { t: at(47.8), ph: 'ww', glide: 0.01 },
    ...wobbles(ANSWER_2),
    { t: at(63.6), ph: 'hh', glide: 0.01 },             // the gasp
    { t: SECONDS, ph: 'mm', glide: 0.05 },
  ]);
}
function beastPitch() {
  return tensionLane([
    { t: 0, hz: hz(E1) },
    { t: at(28) + 0.04, hz: hz(A1), glide: at(2) },            // the "yoi" rises a fourth
    { t: at(31.2), hz: hz(E1), glide: 0.02 },
    { t: at(48), hz: hz(E1), glide: 0.005 },
    { t: at(52), hz: hz(E2), glide: 0.005 },                    // EEE-...
    { t: at(52) + 0.12, hz: hz(E1), glide: 0.33 },               // ...YOOW: an octave dive
    { t: at(56), hz: hz(E1), glide: 0.005 }, { t: at(59), hz: hz(G1), glide: 0.01 }, { t: at(62), hz: hz(F1), glide: 0.01 },
    { t: at(62) + 0.09, hz: hz(E2), glide: 0.002 },             // the broken yelp
    { t: at(62) + 0.15, hz: hz(E1), glide: 0.02 },
  ], { restPeriod: 1 / hz(E1) });
}
function beastSource() {
  // the Beast's vocal folds are the cable itself, bowed hard; tension = pitch
  const lane = beastPitch();
  const on = (a, b) => curve([[0, 0], [a - 0.01, 0], [a, 1], [b - 0.02, 1], [b, 0]]);
  const answer1 = on(at(16), at(31.2)), answer2 = on(at(48), at(63.6));
  return cable({
    seconds: SECONDS + TAIL, period: lane, disp: -0.16, stages: 120,
    gain: t => (answer1(t) || answer2(t) ? 1.045 : 0.55), bright: 6500, drive: 2.8,
    buzz: t => 0.35 + 0.35 * (t > at(48) ? 1 : 0), bow: t => Math.max(answer1(t), answer2(t)),
    // sputter: the bow chokes for an instant inside some wobs (unstable, not periodic)
    damp: t => ([at(25.3), at(49.3), at(50.9), at(61.2)].some(s => t > s && t < s + 0.035) ? 0.4 : 1),
    events: [{ t: at(16), hard: 0.9, amp: 1.2 }, { t: at(48), hard: 1, amp: 1.3 }, { t: at(56), kind: 'slap', hard: 1, amp: 1, stretch: 0.25 }],
    seed: 77,
  }).out;
}

// ------------------------------------------------------------------ drums from cable materials
function anchorKick() {
  const n = Math.round(0.7 * SR), out = new Float64Array(n), r = bipolar(rng(9)); let ph = 0;
  for (let i = 0; i < n; i++) {
    // punchy, not boomy: a short 50 Hz body leaves the low end to the basses
    const t = i / SR; ph += 2 * Math.PI * (50 + 130 * Math.exp(-t / 0.025) + 15 * Math.exp(-t / 0.12)) / SR;
    out[i] = Math.sin(ph) * (t < 0.03 ? 1 : Math.exp(-(t - 0.03) / 0.13)) * smooth(t / 0.0015) + (i < 220 ? 0.3 * r() * Math.exp(-i / 30) * smooth(i / 14) : 0);
  }
  const hot = shape(out, Math.tanh, 1.6);
  new Biquad('hp', 30, 0.5412).run(hot); new Biquad('hp', 30, 1.3066).run(hot);
  return norm(hot);
}
function crackSnare(seed = 3) {
  // a short, tight cable (G3) struck with a crack: dispersive metallic body + a noise burst
  const body = cable({ seconds: 0.5, period: 1 / hz(55), disp: -0.7, stages: 80, gain: 0.82, bright: 9000, drive: 1.5, events: [{ t: 0, kind: 'crack', amp: 1, hard: 1 }], seed }).out;
  const n = body.length, r = bipolar(rng(seed + 1)), noise = new Float64Array(n), bp = new Biquad('bp', 2600, 0.7);
  for (let i = 0; i < n; i++) { const t = i / SR; noise[i] = bp.tick(r()) * Math.exp(-t / 0.09) * smooth(t / 0.001); }
  norm(body); norm(noise);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = 0.55 * body[i] + 0.8 * noise[i];
  return norm(filt(out, 'hp', 150, 0.7));
}

export function automation() {
  const c = caller(), art = beastArticulation(), pitch = beastPitch();
  return {
    callerPeriod: c.period, callerDisp: c.disp, callerDamp: c.damp, callerHarmonic: c.harmonic, callerBuzz: c.buzz,
    beastPitchHz: t => 1 / pitch(t), beastLipDiameter: t => art(t).lipDiam, beastTongueIndex: t => art(t).tongueIndex,
    beastTongueDiameter: t => art(t).tongueDiam, beastVelum: t => art(t).velum, beastVoicing: t => art(t).voicing,
  };
}

export function render({ stems = false } = {}) {
  const LEN = SECONDS + TAIL, n = Math.round(LEN * SR);
  // ---- the caller
  const C = caller();
  const callEvents = [
    { t: 0, kind: 'pluck', hard: 1, amp: 1.1, pos: 0.13 },
    ...CALL_NOTES.map(nt => ({ t: at(nt.step), kind: nt.kind, hard: nt.hard ?? (nt.kind === 'slap' ? 1 : 0.8), amp: nt.amp ?? (nt.kind === 'ghost' ? 0.6 : 1),
      pos: nt.kind === 'slap' ? 0.08 : 0.2, ...(nt.stretch !== undefined ? { stretch: nt.stretch } : {}) })),
    { t: at(SNAP), kind: 'crack', hard: 1, amp: 1.3 },
  ];
  const call = cable({ seconds: LEN, ...C, events: callEvents, stages: 160, seed: 31 }).out;
  const partner = cable({ seconds: LEN, period: 3 * S16, disp: -0.92, stages: 120, gain: curve([[0, 0.8], [at(6), 0.6], [at(SNAP), 0.6], [at(SNAP) + 0.02, 0.8], [at(48), 0.6], [SECONDS, 0.5]]),
    bright: 9000, drive: 1.5, events: [{ t: at(3), hard: 1, amp: 0.8 }, { t: at(SNAP) + 0.01, kind: 'crack', hard: 1, amp: 0.8 }], seed: 47 }).out;
  const { lo: callLo, hi: callHi } = split(call, 110);
  const callSub = Float64Array.from(callLo, v => 0.95 * Math.tanh(1.2 * v));
  const callMid = filt(shape(callHi, v => 0.7 * Math.tanh(v) + 0.3 * Math.sin(v), 2.2), 'hp', 250, 0.7);
  norm(callSub); norm(callMid); norm(partner);

  // ---- the Beast: bowed cable -> throat -> metal + drive; its sub stays clean and mono
  const src = beastSource();
  const art = beastArticulation();
  // distort the vocal folds, not the mouth: harmonics are made BEFORE the formants shape them,
  // so the wobble stays legible (distorting after the throat smears the vowels)
  const folds = shape(norm(src.slice(), 1), v => 0.6 * Math.tanh(v) + 0.4 * Math.sin(1.3 * v), 3.0);
  const mouth = throat(folds, { art, size: t => (t > at(48) ? 0.78 : 0.85), metal: t => (t > at(48) ? 0.95 : 0.6), breath: 0.9, seed: 5 });
  const { lo: beastLo } = split(src, 100);
  const { hi: mouthHi } = split(mouth, 100);
  // the sub follows the mouth: closed lips/chokes duck it, so the low end wobbles with the words
  const openness = Float64Array.from({ length: n }, (_, i) => { const a = art(i / SR); return a.voicing * Math.min(1, a.lipDiam / 1.2) * Math.min(1, 0.25 + a.tongueDiam) * (a.velum > 0.3 ? 0.5 : 1); });
  const sm = new Float64Array(n); let e = 0;
  for (let i = 0; i < n; i++) { e += (openness[i] - e) * 0.004; sm[i] = e; }
  const beastSub = Float64Array.from(beastLo, (v, i) => 0.95 * Math.tanh(1.3 * v) * (0.35 + 0.65 * sm[i]));
  norm(mouthHi);
  const grit = shape(mouthHi, Math.tanh, 1.5);                                                          // glue only
  const ring = combRes(grit, t => (t > at(48) ? 1 / hz(76) : 1 / hz(88)), 0.62, 0.25);                    // metal throat ring (E5/E6)
  const beastMid = new Float64Array(n);
  for (let i = 0; i < n; i++) beastMid[i] = 0.85 * grit[i] + 0.22 * ring[i];
  filt(beastMid, 'hp', 120, 0.7); filt(beastMid, 'peak', 1100, 0.8, 3); filt(beastMid, 'peak', 2600, 1, 2.5);
  // the broken moment: bit-crush and a beat-repeat of a 1/64 slice (bar 4, beat 4)
  const g0 = Math.round((at(62) + 0.09) * SR), slice = Math.round(at(0.25) * SR);
  const stut = beastMid.slice(g0, g0 + slice);
  for (let k = 1; k <= 4; k++) for (let i = 0; i < slice; i++) {
    const j = g0 + k * slice + i, w = Math.min(1, i / 30, (slice - i) / 30);
    if (j < n) beastMid[j] = beastMid[j] * (1 - w) + stut[i] * w * (1 - 0.15 * k);
  }
  crush(beastMid, at(62) + 0.09, at(63.6), { bits: 4, hold: 5 });
  norm(beastSub); norm(beastMid);
  // when the Beast speaks, the cable steps back (sidechain from the mouth's envelope)
  const mouthEnv = new Float64Array(n); { let v = 0; for (let i = 0; i < n; i++) { const a = Math.abs(beastMid[i]); v = a > v ? a + (v - a) * 0.995 : v * 0.99995; mouthEnv[i] = v; } }
  for (let i = 0; i < n; i++) { const d = 1 / (1 + 1.6 * mouthEnv[i]); callMid[i] *= d; partner[i] *= d; }

  // ---- drums: half time (snare on 3), a few syncopated kicks
  const kick = anchorKick(), snare = crackSnare();
  const drums = new Float64Array(n);
  const place = (x, t, g) => { const s = Math.round(t * SR); for (let i = 0; i < x.length && s + i < n; i++) drums[s + i] += x[i] * g; };
  const KICKS = [0, at(14), at(16), at(26), at(32), at(48), at(54)];
  for (const t of KICKS) place(kick, t, t === 0 || t === at(32) ? 1 : 0.85);
  // the subs give way to each kick for ~120 ms (shared low end, not stacked)
  const duck = new Float64Array(n).fill(1);
  for (const t of KICKS) { const s0 = Math.round(t * SR); for (let i = 0; i < Math.round(0.2 * SR) && s0 + i < n; i++) { const u = i / SR; duck[s0 + i] = Math.min(duck[s0 + i], 1 - 0.6 * (u < 0.01 ? smooth(u / 0.01) : Math.exp(-(u - 0.01) / 0.06))); } }
  for (let i = 0; i < n; i++) { callSub[i] *= duck[i]; beastSub[i] *= duck[i]; }
  for (const t of [at(8), at(24), at(40), at(56)]) place(snare, t, 0.8);
  place(snare, at(63), 0.35); // a ghost before the loop turns over

  // ---- mix
  const dry = stereo(LEN), space = stereo(LEN);
  // the caller as one bass bus, clipped gently (4x oversampled) so its strikes don't hit the limiter
  const callBus = new Float64Array(n);
  for (let i = 0; i < n; i++) callBus[i] = 0.5 * callSub[i] + 0.63 * callMid[i];
  const callClip = shape(norm(callBus, 1), v => Math.tanh(1.5 * v) / Math.tanh(1.5), 1);
  addPan(dry, callClip, 0, db(-3), 0);
  addPan(dry, partner, 0, db(-11), 0.55);
  addPan(dry, beastSub, 0, db(-9), 0);
  // the Beast's mouth fills the stereo field: two micro-offset copies, hard-ish left/right
  const beastClip = shape(beastMid, v => Math.tanh(1.3 * v) / Math.tanh(1.3), 1);
  addPan(dry, beastClip, 0, db(-0.5), -0.45); addPan(dry, beastClip, 0.007, db(-0.5), 0.45);
  const drumBus = shape(norm(drums.slice(), 1), v => Math.tanh(1.8 * v) / Math.tanh(1.8), 1); // round off kick/snare peaks
  addPan(dry, drumBus, 0, db(-7), 0);
  addPan(space, callMid, 0, db(-10), -0.3); addPan(space, partner, 0, db(-6), 0.6); addPan(space, drums, 0, db(-16), 0);
  addPan(space, beastMid, 0, db(-14), 0);
  const dryLoop = foldLoop(dry, SECONDS), spaceLoop = foldLoop(space, SECONDS);
  const hall = circularWet(spaceLoop, (b, offset) => reverb(b, { size: 2.2, rt60: 2.4, hfRatio: 0.45, predelay: 0.03, lowCut: 250, seed: 11, loopPeriod: SECONDS, loopOffset: offset }), 4);
  const slap = circularWet(spaceLoop, b => echo(b, { left: 3 * S16, right: 4 * S16, feedback: 0.25, lp: 3000, hp: 400, pingpong: true }), 4);
  const mix = stereo(SECONDS);
  addStereo(mix, dryLoop); addStereo(mix, hall, 0, db(-8)); addStereo(mix, slap, 0, db(-15));
  circular(mix, b => eqStereo(b, [['hp', 28, 0.5412, 0], ['hp', 28, 1.3066, 0], ['peak', 300, 0.9, -1.5]]));
  const gr = circular(mix, b => compress(b, { threshold: -12, ratio: 2, attack: 0.012, release: 0.12, knee: 8 }));
  const mastering = master(mix, { targetLufs: -14, ceilingDb: -1.2, release: 0.07, loop: true, softClip: 3 });
  if (stems) return { mix, callBass: foldMono(Float64Array.from(callSub, (v, i) => v + callMid[i] * 0.5), SECONDS), beastSub: foldMono(beastSub, SECONDS), beastMid: foldMono(beastMid, SECONDS), drums: foldMono(drums, SECONDS) };
  return { bus: mix, meta: { bpm: BPM, bars: BARS, seconds: SECONDS, loop: true, compressorMaxDb: gr.reduce((a, b) => Math.max(a, b), 0), ...mastering } };
}
