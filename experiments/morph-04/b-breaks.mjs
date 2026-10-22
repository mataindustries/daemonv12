// MORPH//04 — DRUM EXPERIMENT B: BREAKS (the cable clocks the break)
// The same Cable Bass riff over an intricate breakbeat whose time is driven by the cable's
// tension. 4 bars, 120 BPM, E Phrygian, 8 s loop.
//   bar 1  the cable is slack: its round trip is a dotted eighth, so its chirping reflections
//          land every 3rd 16th (3 against the break's 4). The ticks are accented by the cable's
//          own reflections (their velocity follows its envelope).
//   bar 2  the hand grabs the cable and winds it: the round trip shrinks geometrically, and the
//          break is repeated once per round trip, so the drums ratchet with the cable until the
//          drum roll is a 41 Hz tone, the cable's E1. The bowed cable talks in triplets, then a
//          32nd stutter with snare ghosts and cable toms doubling its last notes.
//   bar 3  the riff; cable toms walk down E Phrygian in its gaps, the ticks accent every 5th 16th
//          (5 against 4) through bars 3-4.
//   bar 4  the riff's answer, a bowed growl, then SNAP: the tension releases, the round trip
//          grows, and the break (a crack and a toaster spring) is repeated once per round trip
//          again: a pitched buzz that slows back into rhythm, into the slack bar 1.
import { SR, stereo, addPan, addStereo, foldLoop, dbToGain as db, circular, circularWet, reverb, echo, compress, master, eqStereo, norm, shape, filt, clamp, follow } from '../morph-03/dsp.mjs';
import { cable, curve } from '../morph-03/cable.mjs';
import { springSnare, bellHat, clank, tick } from '../morph-03/household.mjs';
import { kick, snare, cableTom, cableTick } from './kit.mjs';
import {
  SECONDS, BPM, BARS, BEAT, S16, at, hz, noteName, E1, F1, G1, A1, Bb1, B1, notesOf, periodLane, notePoints, noteEvents, muteLane,
  grabGain, harmonicLanes, buzzLane, zapDisp, talkFilter, bassBands, place, duckUnder, applyGain, ratchet, roundTrips, Mixer,
} from './perform.mjs';
import { row, noteRows, position } from './events.mjs';

const TAIL = 3, END = SECONDS + TAIL;
const SLACK = 3 * S16; // the slack cable's round trip: a dotted eighth
export const WIND = { from: 16, to: 24 };   // tightening (steps)
export const TALK = { from: 24, to: 28, per: 3 }; // bowed triplet talk
export const SNAP = 60;
export const SCORE = [
  // bar 2, beat 4: the 32nd stutter run out of the talk (MORPH//03 Cable Bass, steps 28-31.5)
  [28, E1, 'pluck', 0.5, { hard: 0.5, amp: 0.55 }], [28.5, E1, 'pluck', 0.5, { hard: 0.55, amp: 0.6 }], [29, E1, 'pluck', 0.5, { hard: 0.6, amp: 0.65 }], [29.5, E1, 'pluck', 0.5, { hard: 0.65, amp: 0.7 }],
  [30, G1, 'pluck', 0.5, { hard: 0.7, amp: 0.75 }], [30.5, G1, 'pluck', 0.5, { hard: 0.75, amp: 0.8 }], [31, A1, 'pluck', 0.5, { hard: 0.85, amp: 0.85 }], [31.5, B1, 'pluck', 0.5, { hard: 1, amp: 0.9 }],
  // bar 3: the riff
  [32, E1, 'slap', 1.75, { amp: 1.5, stretch: 0.3 }], [34, E1, 'ghost', 0.6], [35, E1, 'pluck', 1, { pop: 2 }],
  [37, E1, 'pluck', 0.75], [38, G1, 'pluck', 1.5, { vowel: 'ow' }], [40, E1, 'slap', 1, { amp: 1.2, stretch: 0.18 }], [41, E1, 'ghost', 0.6],
  // the B answers the backbeat snare a 32nd late, so the snare doesn't swallow it
  [42, F1, 'pluck', 1.6, { bendTo: E1 }], [44.5, B1, 'pluck', 0.5], [45, A1, 'pluck', 0.8],
  [46, G1, 'pluck', 0.5], [46.5, G1, 'pluck', 0.5], [47, A1, 'pluck', 0.5], [47.5, B1, 'pluck', 0.5, { hard: 1 }],
  // bar 4: the answer
  [48, E1, 'slap', 1.75, { amp: 1.7, stretch: 0.45 }], [50, E1, 'ghost', 0.6], [51, E1, 'pluck', 1, { pop: 2 }],
  [53, E1, 'pluck', 0.75], [54, G1, 'pluck', 1, { snapTo: Bb1, snapAt: 55 }],
  [56, E1, 'pluck', 1.5, { pop: 3, hard: 1 }], [58, E1, 'pluck', 2, { vowel: 'aa', hard: 0.9 }],
];
const NOTES = notesOf(SCORE);
export const STRIKES = [ // strikes on the slack cable (bar 1) and the wind-up
  { step: 0, kind: 'pluck', hard: 1, amp: 1.1, pos: 0.13 }, { step: 12, kind: 'pluck', hard: 0.8, amp: 0.8, pos: 0.13 },
  { step: WIND.from, kind: 'slap', hard: 1, amp: 1.2, pos: 0.1, stretch: 0 },
];
export const GRABS = [{ from: 15.6, to: 15.98 }, { from: 63.9, to: 64.4 }];
export const BOW = { from: 58, to: SNAP };

// ---- the break (steps, velocity). Bar 2 beats 1-2 are the ratchet; bar 4 beat 4 the dive.
export const KICKS = [[0, 1], [7, 0.6], [10, 0.9], [24, 0.9], [28, 0.7], [32, 1], [39, 0.7], [41, 0.85], [48, 1], [54.5, 0.8]];
export const SNARES = [[4, 1], [12, 0.95], [36, 1], [44, 1], [52, 1], [57, 0.7]];
export const GHOSTS = [[2, 0.18], [6, 0.22], [9, 0.2], [11, 0.15], [14, 0.25], [15, 0.3], [26, 0.3], [27, 0.35],
  [28, 0.12], [28.5, 0.15], [29, 0.19], [29.5, 0.24], [33, 0.2], [39.5, 0.15], [43, 0.25], [46.5, 0.2], [47, 0.3], [49, 0.2], [55, 0.25], [59, 0.3]];
// cable toms: a counter-line walking down E Phrygian in the riff's gaps (never on a cable onset),
// landing on F2 a 16th before the cable's twelfth-pop E (4.3.1)
export const TOMS = [[33, 52], [36, 50], [39, 48], [43, 47], [49, 45], [52, 43], [55, 41]];
export const BELLS = [[14, 0.35], [46, 0.3]];
export const CLANK = [24, 0.7]; // the landing after the ratchet
export const RATCHETS = [
  { from: WIND.from, to: 25, capture: 'kick + snare', detail: 'one repeat per round trip of the winding cable: accelerando into a 41 Hz drum tone' },
  { from: SNAP, to: 64, capture: 'crack snare + toaster spring', detail: 'one repeat per round trip of the releasing cable: a pitched buzz slowing into rhythm' },
];
// 16th ticks everywhere except the ratchets; accents from the cable (bar 1: 3 against 4) or a
// 5-step cycle (bars 3-4: 5 against 4)
const TICK_STEPS = [...Array(64).keys()].filter(s => !(s >= 16 && s < 25) && !(s >= 60) && !(s >= 28 && s < 32));

export function automation() {
  const W0 = at(WIND.from), W1 = at(WIND.to), T_SNAP = at(SNAP), grab = grabGain(GRABS);
  const period = periodLane([
    { t: W0, period: 1 / hz(E1), glide: W1 - W0, curve: 'ease' },
    ...notePoints(NOTES),
    { t: T_SNAP, dive: { to: SLACK, rate: 0.92, k: 6 } },
  ], SLACK);
  const base = curve([[0, 0.88], [W0, 0.88], [W0 + 0.6, 0.99], [W1, 1.035], [at(27.5), 1.035], [at(28), 0.992], [at(BOW.from), 0.992], [at(BOW.from + 0.2), 1.05],
    [T_SNAP, 1.05], [T_SNAP + 0.05, 0.93], [END, 0.9]]);
  return {
    period,
    disp: zapDisp(curve([[0, -0.88], [W0, -0.88], [W1, -0.22, 'lin'], [T_SNAP, -0.22], [T_SNAP + 0.08, -0.9], [END, -0.9]]), NOTES),
    gain: t => base(t) * grab(t),
    bright: curve([[0, 7000], [W0, 7000], [W1, 3800], [at(32), 5200], [T_SNAP, 5200], [T_SNAP + 0.1, 8000], [END, 7000]]),
    damp: muteLane(NOTES, { from: 28, to: SNAP, grabs: GRABS }),
    drive: curve([[0, 1.6], [W1, 2.4], [T_SNAP, 2.6], [T_SNAP + 0.2, 1.6], [END, 1.6]]),
    buzz: buzzLane(NOTES, t => (t >= W1 && t < at(28) ? 0.25 : 0.05)),
    ...harmonicLanes(NOTES),
    subLevel: curve([[0, 0.5], [W0, 0.5], [W1, 1], [T_SNAP, 1], [T_SNAP + 0.3, 0.5], [END, 0.5]]),
    bow: curve([[0, 0], [W0 + 0.5, 0], [W1, 1], [at(27.5), 1], [at(28), 0], [at(BOW.from), 0], [at(BOW.from + 0.2), 1], [T_SNAP, 1], [T_SNAP + 0.02, 0], [END, 0]]),
  };
}

export function render({ stems = false } = {}) {
  const A = automation(), n = Math.round(END * SR);
  // while it winds, the hand re-strikes the cable once per round trip: cable and drums ratchet in unison
  const windTimes = roundTrips(A.period, at(WIND.from), at(WIND.to)).slice(1);
  const events = [...STRIKES.map(s => ({ ...s, t: at(s.step) })), ...noteEvents(NOTES), { t: at(SNAP), kind: 'crack', hard: 1, amp: 1.4 },
    ...windTimes.map((t, k) => ({ t, kind: 'pluck', hard: 0.75, amp: 0.35 + 0.35 * k / windTimes.length, pos: 0.13 }))];
  const main = cable({ seconds: END, ...A, events, stages: 160, seed: 37 });

  const { sub, presence } = bassBands(talkFilter(main.out, NOTES, [TALK]));
  // ---- drums
  const K = kick({ f0: 55, lift: 12, decay: 0.24, hard: 0.85, beater: 9, drive: 2 }), Kg = kick({ f0: 58, lift: 9, decay: 0.16, hard: 0.6, beater: 5, seed: 6 });
  const S = snare({ f0: 205, decay: 0.18, wires: 0.15, crack: 0.25, seed: 31 }), SPR = springSnare(21), Sg = snare({ f0: 215, decay: 0.1, wires: 0.08, hard: 0.5, seed: 33 });
  const kicks = new Float64Array(n), snares = new Float64Array(n), toms = new Float64Array(n), perc = { L: new Float64Array(n), R: new Float64Array(n) };
  for (const [s, v] of KICKS) place(kicks, v < 0.75 ? Kg : K, at(s), v);
  for (const [s, v] of SNARES) { place(snares, S, at(s), v); place(snares, SPR, at(s), 0.35 * v); }
  for (const [s, v] of GHOSTS) place(snares, Sg, at(s), v);
  // cable toms, panned by pitch (the walk-down moves right to left)
  const tomL = new Float64Array(n), tomR = new Float64Array(n);
  for (const [s, m] of TOMS) {
    const x = cableTom(m, { seed: 40 + m }), p = clamp((m - 47) / 6, -1, 1) * 0.6, v = 0.7;
    place(tomL, x, at(s), v * Math.cos((p + 1) * Math.PI / 4)); place(tomR, x, at(s), v * Math.sin((p + 1) * Math.PI / 4));
  }
  // ticks: in bar 1 their accents are the cable's reflections (velocity follows its envelope);
  // in bars 3-4 a 3-step accent remembers them
  // (the chirp's top arrives first, so the bright band marks each reflection's onset)
  const env = follow(filt(filt(presence.slice(), 'hp', 1200, 0.7), 'hp', 1200, 0.7), 0.001, 0.04), envMax = env.subarray(0, Math.round(at(16) * SR)).reduce((a, b) => Math.max(a, b), 0);
  const tickVel = s => {
    if (s < 16) return 0.12 + 0.6 * clamp(env[Math.round((at(s) + 0.02) * SR)] / envMax, 0, 1) ** 1.5;
    return 0.15 + (s >= 32 && (s - 32) % 5 === 0 ? 0.45 : 0);
  };
  render.ticks = TICK_STEPS.map(s => [s, +tickVel(s).toFixed(3)]);
  render.ticks.forEach(([s, v], k) => {
    const x = cableTick({ midi: 98 + (k % 4), decay: 0.05, seed: 100 + k }), p = k % 2 ? 0.45 : -0.45;
    place(perc.L, x, at(s), v * Math.cos((p + 1) * Math.PI / 4)); place(perc.R, x, at(s), v * Math.sin((p + 1) * Math.PI / 4));
  });
  for (const [s, v] of BELLS) { const b = bellHat(s % 2, 1.5, 300 + s); place(perc.L, b, at(s), v * 0.8); place(perc.R, b, at(s) + 0.006, v * 0.6); }
  const cl = clank(100, 1.15); place(perc.L, cl, at(CLANK[0]), CLANK[1] * 0.75); place(perc.R, cl, at(CLANK[0]), CLANK[1] * 0.6);

  // ---- the ratchets: the drums repeat once per round trip of the cable
  const hitWind = new Float64Array(Math.round(0.4 * SR)); place(hitWind, K, 0, 1); place(hitWind, S, 0, 0.9);
  const crack = snare({ f0: 170, decay: 0.32, wires: 0.25, crack: 1, crackMidi: 50, seed: 35 }), hitSnap = new Float64Array(Math.round(0.4 * SR));
  place(hitSnap, crack, 0, 1); place(hitSnap, springSnare(29, { boing: 1.4 }), 0, 0.6);
  const wind = ratchet(hitWind, A.period, at(RATCHETS[0].from), at(RATCHETS[0].to), n, { gain: curve([[at(16), 1], [at(23), 0.7], [at(24), 0.5], [at(25), 0]]) });
  const dive = ratchet(hitSnap, A.period, at(RATCHETS[1].from), at(RATCHETS[1].to), n, { gain: () => 0.85 });
  const ratch = new Float64Array(n);
  for (let i = 0; i < n; i++) ratch[i] = wind.out[i] + dive.out[i];
  filt(ratch, 'lp', 7000, 0.7); filt(ratch, 'hp', 35, 0.7);

  // ---- bass: the sub gives way to kicks and to the ratchet's low end
  duckUnder(sub, KICKS.map(([s]) => at(s)), { depth: 0.75, hold: 0.025, release: 0.06 });
  // while the cable is slack it is percussion, and the kick owns the low end
  applyGain(sub, A.subLevel);
  const bass = new Float64Array(n);
  for (let i = 0; i < n; i++) bass[i] = sub[i] + presence[i];
  const bassClip = shape(norm(bass, 1), v => Math.tanh(1.35 * v) / Math.tanh(1.35), 1);

  // ---- mix
  const mx = new Mixer(END);
  mx.add('bass', bassClip, { gain: db(-4) });
  mx.add('kick', kicks, { gain: db(-4.5) });
  mx.add('snare', snares, { gain: db(-3), pan: -0.05 });
  mx.add('toms', tomL, { gain: db(-10), pan: -1 }).add('toms', tomR, { gain: db(-10), pan: 1 });
  mx.add('perc', perc.L, { gain: db(-3), pan: -1 }).add('perc', perc.R, { gain: db(-3), pan: 1 });
  mx.add('ratchet', ratch, { gain: db(-10) });
  // a small kitchen for the break, and a dotted-eighth echo that keeps the slack cable's 3:4 going
  for (const [x, g, p] of [[snares, -8, 0], [tomL, -9, -0.6], [tomR, -9, 0.6], [perc.L, -12, -0.8], [perc.R, -12, 0.8], [ratch, -10, 0]]) mx.send(x, { gain: db(g), pan: p });
  const slackOnly = Float64Array.from(presence, (v, i) => (i / SR < at(WIND.from) || i / SR >= at(SNAP) ? v : 0));
  const { stems: parts, send } = mx.fold();
  parts.room = circularWet(send, (b, offset) => reverb(b, { size: 0.8, rt60: 0.7, hfRatio: 0.5, predelay: 0.012, lowCut: 220, seed: 17, loopPeriod: SECONDS, loopOffset: offset }), 2);
  for (const ch of ['L', 'R']) for (let i = 0; i < parts.room[ch].length; i++) parts.room[ch][i] *= db(-1);
  const echoIn = stereo(END); addPan(echoIn, slackOnly, 0, db(-8), -0.2);
  parts.echo = circularWet(foldLoop(echoIn, SECONDS), b => echo(b, { left: 3 * S16, right: 6 * S16, feedback: 0.35, lp: 4000, hp: 300, pingpong: true }), 4);
  const mix = stereo(SECONDS);
  for (const b of Object.values(parts)) addStereo(mix, b);
  circular(mix, b => eqStereo(b, [['hp', 28, 0.5412, 0], ['hp', 28, 1.3066, 0], ['peak', 240, 0.9, -2]]));
  const gr = circular(mix, b => compress(b, { threshold: -12, ratio: 2, attack: 0.02, release: 0.12, knee: 8 }));
  render.slices = { wind: wind.slices, dive: dive.slices };
  if (stems) return { stems: parts, premaster: mix, automation: A };
  const mastering = master(mix, { targetLufs: -14, ceilingDb: -1.2, release: 0.07, loop: true, softClip: 3 });
  return { bus: mix, meta: { bpm: BPM, bars: BARS, seconds: SECONDS, loop: true, compressorMaxDb: gr.reduce((a, b) => Math.max(a, b), 0), ratchetSlices: { wind: wind.slices.length, dive: dive.slices.length }, ...mastering } };
}

export const SUMMARY = 'B — BREAKS: a straight-16th breakbeat with ghost notes; the slack cable reflects every 3rd 16th (3:4) in bar 1, the drums ratchet with the cable into a 41 Hz tone in bar 2, cable toms walk down E Phrygian in the riff\'s gaps while the ticks accent every 5th 16th in bars 3-4, the snap slows the break back into rhythm.';
export function eventMap() {
  if (!render.slices) render();
  return [
    ...STRIKES.map(s => row(s.step, 'cable bass', `${s.kind} (slack cable strike)`, { pitch: s.step === WIND.from ? 'slack -> E1' : 'slack (dotted-eighth round trip)', velocity: s.amp })),
    row(WIND.from, 'cable bass', 'wind-up', { detail: `round trip shrinks from a dotted eighth to E1 by ${position(WIND.to)} (slow start: r^(u^2)); the cable is re-struck at every round trip, in unison with the drum ratchet` }),
    row(TALK.from, 'cable bass', 'bowed talk', { pitch: noteName(E1), detail: `8th-note-triplet band-pass "yow" shapes until ${position(TALK.to)}` }),
    ...noteRows(NOTES),
    row(BOW.from, 'cable bass', 'bow', { detail: `bowed growl until ${position(BOW.to)}` }),
    row(SNAP, 'cable bass', 'SNAP (crack)', { detail: 'tension releases (x e^6t, at most 0.92 s/s) back to the dotted-eighth slack round trip' }),
    ...GRABS.map(g => row(g.from, 'cable bass', 'grab (hand stops the cable)', { detail: `until ${position(g.to)}` })),
    ...KICKS.map(([s, v]) => row(s, 'kick', v < 0.75 ? 'ghost kick' : 'kick', { velocity: v })),
    ...SNARES.map(([s, v]) => row(s, 'snare', 'snare + toaster spring', { velocity: v })),
    ...GHOSTS.map(([s, v]) => row(s, 'snare', 'ghost snare', { velocity: v })),
    ...TOMS.map(([s, m]) => row(s, 'toms', 'cable tom (Phrygian walk-down in the gaps)', { pitch: noteName(m), velocity: 0.7 })),
    ...BELLS.map(([s, v]) => row(s, 'perc', 'alarm-bell hat (open)', { velocity: v })),
    row(CLANK[0], 'perc', 'press clank (landing)', { velocity: CLANK[1] }),
    ...render.ticks.map(([s, v]) => row(s, 'perc', s < 16 ? 'cable tick (velocity follows the cable)' : s >= 32 && (s - 32) % 5 === 0 ? 'cable tick (5-step accent)' : 'cable tick', { velocity: v })),
    ...RATCHETS.map((r, k) => row(r.from, 'ratchet', `RATCHET: ${r.capture}`, { detail: `${r.detail}; ${(k ? render.slices.dive : render.slices.wind).length} repeats until ${position(r.to)}` })),
    ...(render.slices.wind.concat(render.slices.dive)).map(sl => row(+(sl.t / S16).toFixed(3), 'ratchet', 'repeat', { detail: `${(sl.length * 1000).toFixed(1)} ms (${(1 / sl.length).toFixed(1)} per second)` })),
  ];
}
