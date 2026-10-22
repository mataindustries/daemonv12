// MORPH//04 — DRUM EXPERIMENT A: HEAVY
// The MORPH//03 Cable Bass riff (E Phrygian, 120 BPM) as a half-time groove, 4 bars, 8 s loop.
//   bar 1  statement: SLAP, ghost, octave POP, G "ow", SLAP on the half-time snare, F~E bend
//   bar 2  answer: the big slap, the G->Bb re-tension... the snare hits and EVERYTHING CHOKES
//          (the hand grabs the cable, the drums and the room stop) for most of a beat; the cable
//          re-enters alone with a twelfth pop and a 32nd run
//   bar 3  statement again, heavier: cable ticks enter, extra syncopated kicks, an eighth-note
//          stop-time hiccup before the last beat
//   bar 4  the cable breaks: twelfth pop on the snare, the drums drop out under a bowed growl,
//          SNAP, the tension collapses into a 16th-note ratchet of reflections into the downbeat
// Kick and bass interlock: the kick lands on every slap (unison) or where the bass rests
// (hocket), and the bass's sub makes room under every kick (the presence band never ducks, so
// the slap's dive and the zap stay audible).
import { SR, stereo, addPan, addStereo, foldLoop, dbToGain as db, circular, circularWet, reverb, compress, master, eqStereo, norm, shape } from '../morph-03/dsp.mjs';
import { cable, curve } from '../morph-03/cable.mjs';
import { kick, snare, cableTick } from './kit.mjs';
import {
  SECONDS, BPM, BARS, S16, at, hz, E1, F1, G1, A1, Bb1, B1, notesOf, periodLane, notePoints, noteEvents, muteLane, grabGain,
  harmonicLanes, buzzLane, zapDisp, talkFilter, bassBands, place, duckUnder, holes, applyGain, Mixer,
} from './perform.mjs';
import { row, noteRows, position } from './events.mjs';

const TAIL = 3, END = SECONDS + TAIL;
// [step, midi, kind, length in 16ths, extras]; steps are absolute 16ths from the loop start
export const SCORE = [
  // bar 1: statement
  [0, E1, 'slap', 1.75, { amp: 1.5, stretch: 0.3 }], [2, E1, 'ghost', 0.6], [3, E1, 'pluck', 1.25, { pop: 2 }],
  [6, G1, 'pluck', 1.5, { vowel: 'ow' }], [9, E1, 'slap', 1, { amp: 1.2, stretch: 0.18 }],
  [10, F1, 'pluck', 1.9, { bendTo: E1 }], [12, B1, 'pluck', 0.75], [13, A1, 'pluck', 0.75], [15, B1, 'pluck', 0.5, { hard: 1 }],
  // bar 2: answer, then the choke
  [16, E1, 'slap', 1.75, { amp: 1.7, stretch: 0.45 }], [18, E1, 'ghost', 0.6], [19, E1, 'pluck', 1, { pop: 2 }],
  [22, G1, 'pluck', 2, { snapTo: Bb1, snapAt: 23 }],
  [28, E1, 'pluck', 1, { pop: 3, hard: 1 }], [29, E1, 'ghost', 0.5],
  [30, G1, 'pluck', 0.5], [30.5, G1, 'pluck', 0.5], [31, A1, 'pluck', 0.5], [31.5, B1, 'pluck', 0.5, { hard: 1 }],
  // bar 3: statement, heavier
  [32, E1, 'slap', 1.75, { amp: 1.5, stretch: 0.3 }], [34, E1, 'ghost', 0.6], [35, E1, 'pluck', 1.25, { pop: 2 }],
  [38, G1, 'pluck', 1.5, { vowel: 'ow' }], [41, E1, 'slap', 1, { amp: 1.2, stretch: 0.18 }],
  [42, F1, 'pluck', 1.4, { bendTo: E1 }], [44, B1, 'pluck', 0.75], [45, A1, 'pluck', 0.75], [47, B1, 'pluck', 0.5, { hard: 1 }],
  // bar 4: the cable breaks
  [48, E1, 'slap', 1.75, { amp: 1.7, stretch: 0.45 }], [50, E1, 'ghost', 0.6], [51, E1, 'pluck', 1, { pop: 2 }],
  [54, G1, 'pluck', 2, { snapTo: Bb1, snapAt: 55 }], [57, E1, 'pluck', 1, { pop: 3, hard: 1 }],
  [58, E1, 'pluck', 2, { vowel: 'aa', hard: 0.9 }],
];
const NOTES = notesOf(SCORE);
export const SNAP = 60;
// the hand stops the cable: the choke after bar 2's snare, the stop-time hiccup in bar 3, and the
// re-tension at the loop point (the next cycle's slap)
export const GRABS = [{ from: 24.5, to: 27.95 }, { from: 43.3, to: 43.97 }, { from: 63.9, to: 64.4 }];
export const BOW = { from: 58, to: SNAP };
// [step, velocity]
export const KICKS = [[0, 1], [5, 0.85], [14, 0.85], [16, 1], [21, 0.85], [32, 1], [37, 0.85], [43, 0.9], [46, 0.85], [48, 1], [53, 0.85]];
export const SNARES = [[8, 1], [24, 1], [40, 1], [56, 1]];
export const BREAK_HIT = [SNAP, 1.1]; // the snap's crack doubled by a snare with the cable inside it
// cable ticks enter in bar 3; none on the ghost notes, so the muted thumps stay audible
export const TICKS = [[36, 0.35], [38, 0.5], [39, 0.22], [42, 0.5], [44, 0.35], [46, 0.5], [52, 0.35], [54, 0.5], [55, 0.22]];
export const CHOKE = { from: 24.55, to: 27.95 }; // drums and room gated shut (steps)
export const STOP = { from: 43.3, to: 43.97 }; // stop-time hiccup: the kick on 43 is cut short and everything holds its breath

export function automation() {
  const T_SNAP = at(SNAP), grab = grabGain(GRABS);
  const base = curve([[0, 0.992], [at(BOW.from), 0.992], [at(BOW.from + 0.2), 1.05], [T_SNAP, 1.05], [T_SNAP + 0.05, 0.93], [END, 0.93]]);
  return {
    period: periodLane([...notePoints(NOTES), { t: T_SNAP, dive: { to: S16, rate: 0.92 } }], 1 / hz(E1)),
    disp: zapDisp(curve([[0, -0.22], [T_SNAP, -0.22], [T_SNAP + 0.08, -0.9], [END, -0.9]]), NOTES),
    gain: t => base(t) * grab(t),
    bright: curve([[0, 5200], [T_SNAP, 5200], [T_SNAP + 0.1, 8000], [END, 8000]]),
    damp: muteLane(NOTES, { from: 0, to: SNAP, grabs: GRABS }),
    drive: curve([[0, 2.4], [T_SNAP, 2.6], [T_SNAP + 0.2, 1.6], [END, 1.6]]),
    buzz: buzzLane(NOTES),
    ...harmonicLanes(NOTES),
    bow: curve([[0, 0], [at(BOW.from), 0], [at(BOW.from + 0.2), 1], [T_SNAP, 1], [T_SNAP + 0.02, 0], [END, 0]]),
    drumGate: holes([CHOKE, STOP]),
  };
}

export function render({ stems = false } = {}) {
  const A = automation(), n = Math.round(END * SR);
  const events = [...noteEvents(NOTES), { t: at(SNAP), kind: 'crack', hard: 1, amp: 1.4 }];
  const main = cable({ seconds: END, ...A, events, stages: 160, seed: 31 });
  // a second, slack cable answers the snap in dotted eighths, off to the right
  const partner = cable({
    seconds: END, period: 3 * S16, disp: -0.92, stages: 120, gain: curve([[0, 0.7], [at(SNAP), 0.7], [at(SNAP) + 0.02, 0.84], [at(63.9), 0.84], [at(64.2), 0.3]]),
    bright: 9000, drive: 1.5, events: [{ t: at(SNAP) + 0.01, kind: 'crack', hard: 1, amp: 0.9 }], seed: 47,
  });

  // ---- bass: physics, then a sub that gives way to the kick and a presence band that never does
  const { sub, presence } = bassBands(talkFilter(main.out, NOTES));
  const kickTimes = KICKS.map(([s]) => at(s));
  duckUnder(sub, kickTimes, { depth: 0.8, hold: 0.025, release: 0.06 });
  const bass = new Float64Array(n);
  for (let i = 0; i < n; i++) bass[i] = sub[i] + presence[i];
  const bassClip = shape(norm(bass, 1), v => Math.tanh(1.35 * v) / Math.tanh(1.35), 1);
  norm(partner.out, 1);

  // ---- drums
  const K = kick({ f0: 50, lift: 14, decay: 0.3, hard: 0.85, beater: 12, drive: 2.4 }), S = snare({ f0: 178, decay: 0.28, wires: 0.24, crack: 0.45, seed: 23 });
  const BIG = snare({ f0: 165, decay: 0.4, wires: 0.32, crack: 0.9, crackMidi: 52, seed: 29 });
  const kicks = new Float64Array(n), snares = new Float64Array(n), ticks = new Float64Array(n);
  for (const [s, v] of KICKS) place(kicks, K, at(s), v);
  for (const [s, v] of SNARES) place(snares, S, at(s), v);
  place(snares, BIG, at(BREAK_HIT[0]), BREAK_HIT[1]);
  TICKS.forEach(([s, v], k) => place(ticks, cableTick({ midi: 99 + (k % 3), decay: 0.08, seed: 7 + k }), at(s), v));
  // the choke: drums stop dead after bar 2's snare
  for (const x of [kicks, snares, ticks]) applyGain(x, A.drumGate);

  // ---- mix: sub, kick and bass mono; ticks and the partner wide; one dark room for the snare
  const mx = new Mixer(END);
  mx.add('bass', bassClip, { gain: db(-4) });
  mx.add('kick', kicks, { gain: db(-3) });
  mx.add('snare', snares, { gain: db(-2), pan: 0.05 });
  // ticks: a 9 ms offset copy on the other side gives width without cancelling in mono
  mx.add('perc', ticks, { gain: db(0), pan: -0.6 }).add('perc', ticks, { gain: db(-2), pan: 0.6, delay: 0.009 });
  mx.add('cablePartner', partner.out, { gain: db(-10), pan: 0.7 });
  mx.send(snares, { gain: db(-4) });
  mx.send(Float64Array.from(bassClip, (v, i) => (i / SR >= at(SNAP) ? v : 0)), { gain: db(-10), pan: -0.35 });
  mx.send(partner.out, { gain: db(-9), pan: 0.7 });
  // a small, dark garage around the cable and kick (depth for headphones; the big room is the snare's)
  const near = stereo(END);
  addPan(near, presence, 0, db(-6), -0.2); addPan(near, kicks, 0, db(-14), 0.2);
  const { stems: parts, send } = mx.fold();
  for (const ch of ['L', 'R']) applyGain(send[ch], A.drumGate);
  const room = circularWet(send, (b, offset) => reverb(b, { size: 1.8, rt60: 1.5, hfRatio: 0.35, predelay: 0.022, lowCut: 260, seed: 5, loopPeriod: SECONDS, loopOffset: offset }), 4);
  for (const ch of ['L', 'R']) { applyGain(room[ch], A.drumGate); for (let i = 0; i < room[ch].length; i++) room[ch][i] *= db(1.5); }
  parts.room = room;
  parts.garage = circularWet(foldLoop(near, SECONDS), (b, offset) => reverb(b, { size: 0.55, rt60: 0.45, hfRatio: 0.4, predelay: 0.006, lowCut: 300, seed: 13, loopPeriod: SECONDS, loopOffset: offset }), 2);
  for (const ch of ['L', 'R']) applyGain(parts.garage[ch], A.drumGate);
  const mix = stereo(SECONDS);
  for (const b of Object.values(parts)) addStereo(mix, b);
  circular(mix, b => eqStereo(b, [['hp', 28, 0.5412, 0], ['hp', 28, 1.3066, 0], ['peak', 240, 0.9, -2]]));
  const gr = circular(mix, b => compress(b, { threshold: -12, ratio: 2, attack: 0.02, release: 0.12, knee: 8 }));
  if (stems) return { stems: parts, premaster: mix, automation: A };
  const mastering = master(mix, { targetLufs: -14, ceilingDb: -1.2, release: 0.07, loop: true, softClip: 3 });
  return { bus: mix, meta: { bpm: BPM, bars: BARS, seconds: SECONDS, loop: true, compressorMaxDb: gr.reduce((a, b) => Math.max(a, b), 0), ...mastering } };
}

export const SUMMARY = 'A — HEAVY: half-time (snare on beat 3), kick on every slap or in the bass\'s rests, a full choke in bar 2, a stop-time hiccup in bar 3, the snap at 3.75 s of bar 4.';
export function eventMap() {
  return [
    ...noteRows(NOTES),
    row(SNAP, 'cable bass', 'SNAP (crack)', { detail: 'tension collapses at 0.92 s of round trip per second into 16th-note reflections' }),
    row(BOW.from, 'cable bass', 'bow', { detail: `bowed growl until ${position(BOW.to)}` }),
    ...GRABS.map(g => row(g.from, 'cable bass', 'grab (hand stops the cable)', { detail: `until ${position(g.to)}` })),
    row(SNAP + 0.08, 'partner cable', 'crack', { detail: 'slack dotted-eighth reflections, panned right' }),
    ...KICKS.map(([s, v]) => row(s, 'kick', NOTES.some(n => n.step === s) ? 'kick (unison with bass)' : 'kick (in a bass rest)', { velocity: v })),
    ...SNARES.map(([s, v]) => row(s, 'snare', 'half-time snare', { velocity: v })),
    row(BREAK_HIT[0], 'snare', 'break snare (cable crack inside)', { velocity: BREAK_HIT[1] }),
    ...TICKS.map(([s, v]) => row(s, 'perc', 'cable tick', { velocity: v })),
    row(CHOKE.from, 'all', 'CHOKE: drums, room and cable gated', { end: +at(CHOKE.to).toFixed(4), detail: `until ${position(CHOKE.to)}` }),
    row(STOP.from, 'all', 'STOP: stop-time hiccup', { end: +at(STOP.to).toFixed(4), detail: `until ${position(STOP.to)}` }),
  ];
}
