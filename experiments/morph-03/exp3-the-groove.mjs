// MORPH//03 — EXPERIMENT 3: THE GROOVE
// 4 bars at 120 BPM, E Phrygian, swung 16ths, a seamless loop. A two-bar phrase in three parts:
//   A  the alarm asks      piezo double-beeps (MORPH//02 B's hook), hocketed with the bass
//   B  the cable answers   slaps that dive, octave pops, ghosts, a slide up the scale
//   C  the punchline       toaster POP, press CLANK, the alarm's wrong note (F) - and the cable
//                          answers it with a Phrygian F -> E slide, then a 32nd stutter
// Bar 3 is the surprise: the alarm hook falls an octave per beep, down a well, until the cable
// is playing it in the bass and finds the wrong note itself. Bar 4 answers, the cable dives an
// octave under a microwave DING, and the alarm starts again.
import {
  SR, mtof, smooth, stereo, addPan, addStereo, dbToGain as db, Biquad, filt, shape, reverb, echo, norm,
  split, foldLoop, foldMono, circular, circularWet, compress, master, eqStereo,
} from './dsp.mjs';
import { cable, curve, tensionLane, zapLane } from './cable.mjs';
import { piezo, washerKick, springSnare, bellHat, clank, tick, ding } from './household.mjs';

export const BPM = 120, BEAT = 0.5, S16 = 0.125, BARS = 4, SECONDS = 8, TAIL = 2.5;
const SWING = 0.018;                                    // late odd 16ths
const at = step => step * S16 + (step % 2 === 1 ? SWING : 0);
const hz = m => mtof(m);
const E1 = 28, F1 = 29, G1 = 31, A1 = 33, Bb1 = 34, B1 = 35, D2 = 38, E2 = 40;

// ------------------------------------------------------------------ the phrase
// alarm: [step, midi, length in 16ths, fall (semitones)]
export const ALARM = [
  [0, 88, 0.55], [1, 88, 0.55], [3, 83, 1.2], [6, 88, 0.55], [7, 88, 0.55], [9, 83, 1.2],
  [26, 89, 1.4],                                                                    // the wrong note
  // bar 3: down the well, an octave per beep, each one falling as it sounds
  [32, 88, 0.55, 3], [33, 76, 0.55, 5], [35, 71, 1.2, 8], [38, 64, 0.55, 8], [39, 52, 0.55, 10], [41, 47, 1.3, 12],     // the last beep lands exactly on the cable's B1
  [58, 89, 1.2],                                                                    // wrong note, last time
];
// cable: [step, midi, kind, length in 16ths, extras]
export const BASS = [
  // A/B (bar 1): hocket with the beeps, then the answer
  [2, E1, 'pluck', 1], [4, E1, 'pluck', 0.8, { pop: 2 }], [5, E1, 'ghost', 0.5],
  [8, E1, 'slap', 1.5, { amp: 1.3, stretch: 0.3 }], [10, G1, 'pluck', 0.75], [11, A1, 'pluck', 0.75],
  [12, B1, 'pluck', 1.8, { bendTo: D2 }], [14, E2, 'pluck', 0.8, { pop: 2 }], [15, E1, 'ghost', 0.5],
  // B (bar 2)
  [16, E1, 'slap', 1.5, { amp: 1.5, stretch: 0.35 }], [18, E1, 'pluck', 0.8, { pop: 2 }], [19, G1, 'pluck', 0.8],
  [21, E1, 'pluck', 0.8], [22, G1, 'pluck', 1.2], [23, E1, 'ghost', 0.5],
  // C: the punchline answers the wrong note
  [27, F1, 'pluck', 1.6, { bendTo: E1, hard: 1 }],
  [30, E1, 'pluck', 0.5, { amp: 0.7 }], [30.5, E1, 'pluck', 0.5, { amp: 0.75 }], [31, E1, 'pluck', 0.5, { amp: 0.8 }], [31.5, G1, 'pluck', 0.5, { amp: 0.9 }],
  // bar 3: the cable takes the alarm's rhythm, then finds the wrong note itself
  [32, E1, 'pluck', 0.55, { amp: 0.7 }], [33, E1, 'pluck', 0.55, { amp: 0.75 }], [35, B1, 'pluck', 1.2, { amp: 0.85 }],
  [38, E1, 'pluck', 0.55, { amp: 0.9 }], [39, E1, 'pluck', 0.55, { amp: 0.95 }], [41, B1, 'slap', 1.3, { amp: 1.2, stretch: 0.2 }],
  [44, G1, 'slap', 1, { amp: 1.3, stretch: 0.25 }], [46, F1, 'pluck', 1.6, { bendTo: E1, hard: 1 }],
  // bar 4: the answer again, a tritone twist, a twelfth squeal, then the dive under the DING
  [48, E1, 'slap', 1.5, { amp: 1.6, stretch: 0.4 }], [50, E1, 'pluck', 0.8, { pop: 2 }], [51, G1, 'pluck', 0.8], [52.5, E1, 'ghost', 0.4],
  [53, A1, 'pluck', 0.8], [54, Bb1, 'pluck', 0.8, { hard: 1 }], [55, B1, 'pluck', 0.8],
  [57, E1, 'pluck', 1, { pop: 3, hard: 1 }], [59, F1, 'pluck', 0.8],
  [60, E2, 'slap', 3.4, { amp: 1.5, stretch: 0.2, diveTo: E1 }],
];
const NOTES = BASS.map(([step, midi, kind, len, x = {}]) => ({ step, midi, kind, len, ...x }));
const KICKS = [0, 4, 8, 12, 16, 20, 24, 27, 32, 44, 48, 52, 56];   // bar 3 beats 2-3: the floor opens under the falling alarm
const SNARES = [4, 12, 20, 28, 36, 44, 52];
const POPS = [24, 56], CLANKS = [25, 57], DING_AT = 62;

export function automation() {
  const lane = [];
  for (const n of NOTES) {
    lane.push({ t: at(n.step) - 0.004, hz: hz(n.midi), glide: n.kind === 'slap' ? 0.004 : 0.01 });
    if (n.bendTo) lane.push({ t: at(n.step) + 0.6 * S16, hz: hz(n.bendTo), glide: S16, curve: 'lin' });
    if (n.diveTo) lane.push({ t: at(n.step) + 0.06, hz: hz(n.diveTo), glide: 2.6 * S16, curve: 'lin' });
  }
  const period = tensionLane(lane, { restPeriod: 1 / hz(E1) });
  const mute = t => {
    let m = 1;
    for (let k = 0; k < NOTES.length; k++) {
      const nt = NOTES[k], stop = at(nt.step) + nt.len * S16, nextOn = k + 1 < NOTES.length ? at(NOTES[k + 1].step) : SECONDS + 2 * S16;
      if (t >= stop && t < nextOn - 0.003) m = Math.min(m, 0.5 + 0.5 * (1 - smooth((t - stop) / 0.01)));
      if (nt.kind === 'ghost' && t >= at(nt.step) && t < at(nt.step) + nt.len * S16) m = Math.min(m, 0.62);
    }
    return m;
  };
  const harm = t => { for (const nt of NOTES) if (nt.pop && t >= at(nt.step) + 0.006 && t < at(nt.step) + nt.len * S16) return smooth((t - at(nt.step) - 0.006) / 0.012); return 0; };
  const harmN = t => { for (const nt of NOTES) if (nt.pop && t >= at(nt.step) && t < at(nt.step) + nt.len * S16 + 0.05) return nt.pop; return 2; };
  return {
    period, gain: 0.993, bright: 5200, damp: mute, drive: 2.4,
    disp: zapLane(-0.24, NOTES.map(nt => ({ t: at(nt.step), depth: nt.kind === 'slap' ? -0.55 : nt.kind === 'ghost' ? -0.2 : nt.len <= 0.5 ? -0.2 : -0.45 }))),
    buzz: t => { for (const nt of NOTES) if (t >= at(nt.step) && t < at(nt.step) + Math.min(nt.len, 1.2) * S16) return (nt.kind === 'slap' ? 0.8 : nt.kind === 'ghost' ? 0.1 : 0.4) * (1 - 0.6 * smooth((t - at(nt.step)) / (1.2 * S16))); return 0.05; },
    harmonic: harm, harmonicN: harmN,
  };
}

export function render({ stems = false } = {}) {
  const LEN = SECONDS + TAIL, n = Math.round(LEN * SR);
  // ---- the cable bass
  const A = automation();
  const events = NOTES.map(nt => ({ t: at(nt.step), kind: nt.kind, hard: nt.hard ?? (nt.kind === 'slap' ? 1 : 0.8), amp: nt.amp ?? (nt.kind === 'ghost' ? 0.6 : 1),
    pos: nt.kind === 'slap' ? 0.08 : 0.2, ...(nt.stretch !== undefined ? { stretch: nt.stretch } : {}) }));
  const bass = cable({ seconds: LEN, ...A, events, stages: 160, seed: 53 }).out;
  const { lo, hi } = split(bass, 110);
  const sub = Float64Array.from(lo, v => 0.95 * Math.tanh(1.2 * v));
  new Biquad('hp', 30, 0.5412).run(sub); new Biquad('hp', 30, 1.3066).run(sub);
  const mid = filt(filt(shape(hi, v => 0.7 * Math.tanh(v) + 0.3 * Math.sin(v), 2.2), 'hp', 280, 0.7), 'peak', 1300, 0.9, 3);
  norm(sub); norm(mid);
  const bassBus = new Float64Array(n);
  for (let i = 0; i < n; i++) bassBus[i] = 0.7 * sub[i] + 0.7 * mid[i];

  // ---- household drums
  const kit = { kick: washerKick(11), snare: springSnare(21), pop: springSnare(29, { boing: 1.4 }), clank: clank(100, 1.15), tick: tick(5), ding: ding() };
  const drums = stereo(LEN), kitchen = stereo(LEN), hangar = stereo(LEN);
  const kickTimes = KICKS.map(at);
  for (const t of kickTimes) addPan(drums, kit.kick, t, db(-5), 0);
  for (const s of SNARES) addPan(drums, kit.snare, at(s), db(-7), 0.05);
  for (const s of POPS) { addPan(drums, kit.pop, at(s), db(-6), -0.15); addPan(hangar, kit.pop, at(s), db(-12), 0); }
  for (const s of CLANKS) { addPan(drums, kit.clank, at(s), db(-8), -0.35); addPan(hangar, kit.clank, at(s), db(-12), 0); }
  for (let s = 0; s < 64; s++) {
    if (s >= 60 && s < 63) continue;                                       // the floor drops for the dive
    const accent = s % 4 === 2 ? 0 : s % 2 ? -6 : -9;
    addPan(drums, bellHat(s % 2, s % 4 === 2 ? 1.5 : 1, 300 + s), at(s), db(-19 + accent), s % 2 ? 0.45 : -0.3);
  }
  for (let s = 0; s < 64; s += 2) if (s < 16 || (s >= 32 && s < 48)) addPan(kitchen, kit.tick, at(s) + 0.004, db(-23), -0.5);
  addPan(drums, kit.ding, at(DING_AT), db(-9), 0.1); addPan(hangar, kit.ding, at(DING_AT), db(-10), 0);
  // ---- the alarm
  const alarm = stereo(LEN);
  for (const [s, m, len, fall = 0] of ALARM) {
    const deep = s >= 32 && s < 48;                                          // down the well: wetter, wider, bigger
    const beep = piezo(m, len * S16, { fall, size: deep ? 2 ** ((88 - m) / 15) : 1 });
    addPan(alarm, beep, at(s), db(deep ? -6 - (m < 60 ? 1 : 0) : -10), deep ? (s % 2 ? 0.4 : -0.4) : 0.15);
    if (deep) addPan(hangar, beep, at(s), db(-5), 0);
    else addPan(kitchen, beep, at(s), db(-14), 0.15);
  }

  // ---- sidechain: the bass gives way to each kick (shared low end, no masking)
  const duck = new Float64Array(n).fill(1);
  for (const t of kickTimes) { const s0 = Math.round(t * SR); for (let i = 0; i < Math.round(0.22 * SR) && s0 + i < n; i++) { const u = i / SR; duck[s0 + i] = Math.min(duck[s0 + i], 1 - 0.75 * (u < 0.006 ? smooth(u / 0.006) : Math.exp(-(u - 0.006) / 0.055))); } }
  for (let i = 0; i < n; i++) bassBus[i] *= duck[i];
  const bassClip = shape(norm(bassBus, 1), v => Math.tanh(1.4 * v) / Math.tanh(1.4), 1);

  const dry = stereo(LEN);
  addPan(dry, bassClip, 0, db(-1), 0);
  addStereo(dry, drums); addStereo(dry, alarm); addStereo(dry, kitchen);
  const midSend = Float64Array.from(mid, (v, i) => v * duck[i]);
  addPan(hangar, midSend, 0, db(-16), 0);
  const dryLoop = foldLoop(dry, SECONDS), kitchenLoop = foldLoop(kitchen, SECONDS), hangarLoop = foldLoop(hangar, SECONDS);
  const room = circularWet(kitchenLoop, (b, offset) => reverb(b, { size: 0.25, rt60: 0.4, hfRatio: 0.6, predelay: 0.003, lowCut: 250, seed: 2, loopPeriod: SECONDS, loopOffset: offset }), 2);
  const hall = circularWet(hangarLoop, (b, offset) => reverb(b, { size: 2.4, rt60: 2.8, hfRatio: 0.45, predelay: 0.035, lowCut: 200, seed: 4, loopPeriod: SECONDS, loopOffset: offset }), 4);
  const dly = circularWet(hangarLoop, b => echo(b, { left: 3 * S16, right: 4 * S16, feedback: 0.3, lp: 3500, hp: 400, pingpong: true }), 4);
  const mix = stereo(SECONDS);
  addStereo(mix, dryLoop); addStereo(mix, room, 0, db(-9)); addStereo(mix, hall, 0, db(-9)); addStereo(mix, dly, 0, db(-16));
  circular(mix, b => eqStereo(b, [['hp', 28, 0.5412, 0], ['hp', 28, 1.3066, 0], ['peak', 300, 0.9, -1.5], ['hs', 9000, 0.7, 1]]));
  const gr = circular(mix, b => compress(b, { threshold: -12, ratio: 2, attack: 0.012, release: 0.12, knee: 8 }));
  const mastering = master(mix, { targetLufs: -14, ceilingDb: -1.2, release: 0.07, loop: true, softClip: 3 });
  if (stems) return { mix, bass: foldMono(Float64Array.from(bassClip), SECONDS), drums: foldLoop(drums, SECONDS), alarm: foldLoop(alarm, SECONDS) };
  return { bus: mix, meta: { bpm: BPM, bars: BARS, seconds: SECONDS, loop: true, swing: SWING, compressorMaxDb: gr.reduce((a, b) => Math.max(a, b), 0), ...mastering } };
}
