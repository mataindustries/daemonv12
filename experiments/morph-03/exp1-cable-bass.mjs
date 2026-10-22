// MORPH//03 — EXPERIMENT 1: CABLE BASS
// One 8-second loop (4 bars, 120 BPM, E Phrygian) in which the physics tells the story:
//   0-1.5 s    metallic reflections: the slack cable's round trip is a quarter note (a second
//              cable answers in dotted eighths, 3:4); these are the echoes of the snap that ends
//              the previous cycle (the render is folded, so the loop is physically continuous)
//   1.5-2.5 s  tightening: the round trip shrinks geometrically, self-strikes ratchet into pitch
//   2.5-4 s    the bowed cable lands on E1 and "talks" in triplets, then a 32nd-note stutter run
//   bars 3-4   the riff: slaps whose pitch dives fall out of tension physics, palm-muted ghosts,
//              flageolet octave/twelfth pops, a Phrygian F bend, an abrupt tritone re-tension;
//              every note opens with a dispersion "zap" (the cable's laser chirp) before its pitch
//   bar 4 end  THE CABLE BREAKS: a crack, the tension collapses, the pitch dives back into rhythm
import {
  SR, mtof, clamp, smooth, stereo, addPan, addStereo, dbToGain as db, SVF, Biquad, filt, shape, tube, reverb, echo, modal,
  split, foldLoop, foldMono, circular, circularWet, compress, master, eqStereo, norm, lufs,
} from './dsp.mjs';
import { cable, curve, tensionLane, zapLane } from './cable.mjs';

export const BPM = 120, BEAT = 0.5, S16 = 0.125, BARS = 4, SECONDS = 8, TAIL = 3;
const at = step => step * S16;           // absolute 16th-note steps from the loop start
const hz = m => mtof(m);
const E1 = 28, F1 = 29, G1 = 31, A1 = 33, Bb1 = 34, B1 = 35, E2 = 40, D2 = 38;

// ------------------------------------------------------------------ the riff (absolute 16ths)
// [step, midi, kind, length in 16ths, extras]
export const RIFF = [
  // bar 2, beat 4: after the bowed, talking E1 (bow lane), a 32nd-note stutter run into bar 3
  [28, E1, 'pluck', 0.5, { hard: 0.5, amp: 0.55 }], [28.5, E1, 'pluck', 0.5, { hard: 0.55, amp: 0.6 }], [29, E1, 'pluck', 0.5, { hard: 0.6, amp: 0.65 }], [29.5, E1, 'pluck', 0.5, { hard: 0.65, amp: 0.7 }],
  [30, G1, 'pluck', 0.5, { hard: 0.7, amp: 0.75 }], [30.5, G1, 'pluck', 0.5, { hard: 0.75, amp: 0.8 }], [31, A1, 'pluck', 0.5, { hard: 0.85, amp: 0.85 }], [31.5, B1, 'pluck', 0.5, { hard: 1, amp: 0.9 }],
  // bar 3
  [32, E1, 'slap', 1.75, { amp: 1.5, stretch: 0.3 }], [34, E1, 'ghost', 0.6], [35, E1, 'pluck', 1, { pop: 2 }],
  [37, E1, 'pluck', 0.75], [38, G1, 'pluck', 1.5, { vowel: 'ow' }], [40, E1, 'slap', 1, { amp: 1.2, stretch: 0.18 }], [41, E1, 'ghost', 0.6],
  [42, F1, 'pluck', 1.6, { bendTo: E1 }], [44, B1, 'pluck', 1], [45, A1, 'pluck', 0.8],
  [46, G1, 'pluck', 0.5], [46.5, G1, 'pluck', 0.5], [47, A1, 'pluck', 0.5], [47.5, B1, 'pluck', 0.5, { hard: 1 }],
  // bar 4
  [48, E1, 'slap', 1.75, { amp: 1.7, stretch: 0.45 }], [50, E1, 'ghost', 0.6], [51, E1, 'pluck', 1, { pop: 2 }],
  [53, E1, 'pluck', 0.75], [54, G1, 'pluck', 1, { snapTo: Bb1, snapAt: 55 }],
  [56, E1, 'pluck', 1.5, { pop: 3, hard: 1 }], [58, E1, 'pluck', 2, { vowel: 'aa', hard: 0.9, bow: true }],
];
const SNAP = 60; // step: the crack
const NOTES = RIFF.map(([step, midi, kind, len, x = {}]) => ({ step, midi, kind, len, ...x }));

// ------------------------------------------------------------------ automation lanes
export function automation() {
  const T_TIGHT = at(12), T_LAND = at(20), T_SNAP = at(SNAP), END = SECONDS + TAIL;
  // tension (round-trip period) of the main cable
  const lane = [{ t: 0, period: BEAT }];
  lane.push({ t: T_TIGHT, period: 1 / hz(E1), glide: T_LAND - T_TIGHT, curve: 'lin' }); // geometric accelerando
  for (const n of NOTES) {
    lane.push({ t: at(n.step) - 0.004, hz: hz(n.midi), glide: n.kind === 'slap' ? 0.004 : 0.012 });
    if (n.bendTo) lane.push({ t: at(n.step + 0.5), hz: hz(n.bendTo), glide: at(1.1), curve: 'lin' });
    if (n.snapTo) lane.push({ t: at(n.snapAt), hz: hz(n.snapTo), glide: 0.002 }); // abrupt re-tension
  }
  lane.push({ t: at(58) - 0.004, hz: hz(E1), glide: 0.01 });
  const pitched = tensionLane(lane, { restPeriod: BEAT });
  // the snap: the cable slackens as fast as physics allows (read point never reverses)
  const snapDive = (() => {
    const p0 = 1 / hz(E1), rate = 0.92; // seconds of round trip gained per second
    return t => Math.min(BEAT, p0 + rate * Math.max(0, t - T_SNAP) * smooth((t - T_SNAP) / 0.06 + 0.5));
  })();
  const period = t => (t < T_SNAP ? pitched(t) : snapDive(t));

  // palm mutes: between a note's end and the next onset the hand lands on the cable
  const mute = t => {
    if (t < at(28) - 0.01 || t >= T_SNAP) return 1;
    let m = 1;
    for (let k = 0; k < NOTES.length; k++) {
      const nt = NOTES[k], stop = at(nt.step + nt.len), nextOn = k + 1 < NOTES.length ? at(NOTES[k + 1].step) : T_SNAP;
      if (t >= stop && t < nextOn - 0.003) m = Math.min(m, 0.5 + 0.5 * (1 - smooth((t - stop) / 0.01)));
      if (nt.kind === 'ghost' && t >= at(nt.step) && t < at(nt.step + nt.len)) m = Math.min(m, 0.62);
    }
    return m;
  };
  // flageolet touches: lightly touching a node right after the pluck
  const harm = t => {
    for (const nt of NOTES) if (nt.pop && t >= at(nt.step) + 0.006 && t < at(nt.step + nt.len)) return smooth((t - at(nt.step) - 0.006) / 0.012);
    return 0;
  };
  const harmN = t => { for (const nt of NOTES) if (nt.pop && t >= at(nt.step) && t < at(nt.step + nt.len) + 0.05) return nt.pop; return 2; };

  return {
    period,
    // every riff note starts with a laser "zap" (deep dispersion) and settles into a clean pitch
    disp: zapLane(curve([[0, -0.88], [T_TIGHT, -0.88], [T_LAND, -0.22, 'lin'], [T_SNAP, -0.22], [T_SNAP + 0.08, -0.9], [END, -0.9]]),
      NOTES.map(nt => ({ t: at(nt.step), depth: nt.kind === 'slap' ? -0.6 : nt.kind === 'ghost' ? -0.2 : nt.len <= 0.5 ? -0.25 : -0.5 }))),
    gain: curve([[0, 0.86], [T_TIGHT, 0.88], [T_TIGHT + 0.6, 0.99], [T_LAND, 1.035], [at(27.5), 1.035], [at(28), 0.992], [at(58), 0.992], [at(58.2), 1.05],
      [T_SNAP, 1.05], [T_SNAP + 0.05, 0.93], [SECONDS, 0.88], [END, 0.86]]),
    bright: curve([[0, 7000], [T_TIGHT, 7000], [T_LAND, 3800], [at(32), 5200], [T_SNAP, 5200], [T_SNAP + 0.1, 8000], [END, 7000]]),
    damp: mute,
    drive: curve([[0, 1.6], [T_LAND, 2.4], [T_SNAP, 2.6], [T_SNAP + 0.2, 1.6]]),
    buzz: t => {
      // the cable slaps its guide on accents; bar 4 plays harder
      for (const nt of NOTES) if (t >= at(nt.step) && t < at(nt.step + Math.min(nt.len, 1.2))) {
        const base = nt.kind === 'slap' ? 0.75 : nt.kind === 'ghost' ? 0.1 : 0.35;
        return base * (nt.step >= 48 ? 1.15 : 1) * (1 - 0.6 * smooth((t - at(nt.step)) / at(1.2)));
      }
      return t >= T_LAND && t < at(28) ? 0.25 : 0.05;
    },
    harmonic: harm,
    harmonicN: harmN,
    bow: curve([[0, 0], [T_TIGHT + 0.5, 0], [T_LAND, 1], [at(27.5), 1], [at(28), 0], [at(58), 0], [at(58.2), 1], [T_SNAP, 1], [T_SNAP + 0.02, 0]]),
    pulse: curve([[0, 0], [T_TIGHT, 0], [T_TIGHT + 0.25, 0.3], [T_LAND - 0.12, 0.5], [T_LAND, 0]]),
  };
}

/** Rhythmic band-pass "talk" on the bowed pickup and the final swell: stepped shapes, not an LFO. */
function talkFilter(x) {
  const y = new Float64Array(x.length), bp = new SVF(400, 4), vowels = { ow: [520, 900], aa: [750, 1150] };
  // pickup: 8th-note triplet "yow" shapes (cut-off leaps up, then sags), louder each time
  const triplets = [0, 1, 2, 3, 4, 5].map(k => at(20) + k * (BEAT / 3));
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    let f = 0, amt = 0;
    if (t >= at(20) && t < at(28)) {
      const k = triplets.findLastIndex(s => t >= s), u = (t - triplets[k]) / (BEAT / 3);
      f = 300 + (900 + 250 * k) * Math.exp(-u * 3.5); amt = 0.55 + 0.07 * k;
    }
    for (const n of NOTES) if (n.vowel && t >= at(n.step) && t < at(n.step + n.len + 0.5)) {
      const [lo, hi] = vowels[n.vowel], u = (t - at(n.step)) / at(n.len);
      f = n.vowel === 'aa' ? lo + (hi - lo) * smooth(u * 1.4) : hi - (hi - lo) * smooth(u); amt = 0.6;
    }
    if (amt > 0) { bp.set(f, 4); bp.tick(x[i]); y[i] = x[i] * (1 - amt) + bp.bp * amt * 2.6; }
    else { bp.tick(x[i]); y[i] = x[i]; }
  }
  return y;
}

/** The anchor bolt booms when the cable is struck hard: a short pitched thump under slaps/strikes. */
function anchorThump(level = 1) {
  const n = Math.round(0.5 * SR), out = new Float64Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += 2 * Math.PI * (44 + 70 * Math.exp(-t / 0.025)) / SR; out[i] = Math.sin(ph) * Math.exp(-t / 0.13) * smooth(t / 0.002); }
  return norm(shape(out, Math.tanh, 1.6), level);
}

export function render({ stems = false } = {}) {
  const A = automation(), LEN = SECONDS + TAIL, T_TIGHT = at(16);
  const events = [
    { t: 0, kind: 'pluck', hard: 1, amp: 1.1, pos: 0.13 },
    { t: at(5), kind: 'ghost', hard: 0.6, amp: 0.7 },          // a syncopated nudge in the reflections
    { t: T_TIGHT, kind: 'pluck', hard: 1, amp: 0.9 },
    ...NOTES.map(nt => ({
      t: at(nt.step), kind: nt.kind, hard: nt.hard ?? (nt.kind === 'slap' ? 1 : 0.8),
      amp: nt.amp ?? (nt.kind === 'ghost' ? 0.6 : 1), pos: nt.kind === 'slap' ? 0.08 : 0.2,
      ...(nt.stretch !== undefined ? { stretch: nt.stretch } : {}),
    })),
    { t: at(SNAP), kind: 'crack', hard: 1, amp: 1.4 },
  ];
  const main = cable({ seconds: LEN, ...A, events, stages: 160, seed: 31 });

  // second cable: dotted-eighth round trip (3:4); it answers in bar 1 and snaps with the main cable
  const partner = cable({
    seconds: LEN, period: 3 * S16, disp: -0.92, stages: 120, gain: curve([[0, 0.82], [at(20), 0.7], [at(SNAP), 0.7], [at(SNAP) + 0.02, 0.84]]),
    bright: 9000, drive: 1.5,
    events: [{ t: at(3), kind: 'pluck', hard: 1, amp: 0.8 }, { t: at(10), kind: 'pluck', hard: 0.9, amp: 0.5 }, { t: at(SNAP) + 0.01, kind: 'crack', hard: 1, amp: 0.9 }],
    seed: 47,
  });

  // ---- bass processing: physics first, then a clean sub and a talkative upper band
  const body = talkFilter(main.out);
  const { lo, hi } = split(body, 110);
  const hiDriven = shape(hi, v => 0.7 * Math.tanh(v) + 0.3 * Math.sin(v), 2.2); // drive + a little fold: upper harmonics for small speakers
  const presence = filt(filt(hiDriven.slice(), 'hp', 300, 0.7), 'peak', 1400, 0.9, 3);
  const n = Math.round(LEN * SR);
  const bassMono = new Float64Array(n);
  norm(lo, 1); norm(presence, 1);
  // the snap's dive sweeps the fundamental down through infrasound: a 4th-order high-pass at 30 Hz
  // keeps the sub honest (E1 at 41 Hz loses 0.3 dB)
  const sub = Float64Array.from(lo, v => 0.95 * Math.tanh(1.2 * v));
  new Biquad('hp', 30, 0.5412).run(sub); new Biquad('hp', 30, 1.3066).run(sub);
  for (let i = 0; i < n; i++) bassMono[i] = sub[i] + 0.55 * presence[i];
  // clip the bass bus gently (4x oversampled) so transients don't drive the master limiter
  const clipped = shape(norm(bassMono, 1), v => Math.tanh(1.35 * v) / Math.tanh(1.35), 1);
  bassMono.set(clipped);

  const thumps = new Float64Array(n);
  for (const e of events) if (e.kind === 'slap' || (e.t === 0)) {
    const th = anchorThump(e.kind === 'slap' ? 0.8 : 1), s = Math.round(e.t * SR);
    for (let i = 0; i < th.length && s + i < n; i++) thumps[s + i] += th[i];
  }
  norm(partner.out, 1); filt(partner.out, 'hp', 60, 0.7); // the high cable has no business below 60 Hz (its snap dives through it)

  // ---- stereo image: sub and thumps mono; the partner cable and chirp space wide
  const dry = stereo(LEN), space = stereo(LEN);
  addPan(dry, bassMono, 0, db(-3), 0);
  addPan(dry, thumps, 0, db(-9), 0);
  addPan(dry, partner.out, 0, db(-9), 0.55);
  // reflections and the snap go into the canyon; the riff stays dry and close
  const sendCurve = curve([[0, 0.8], [at(20), 0.8], [at(22), 0.15], [at(SNAP), 0.15], [at(SNAP) + 0.03, 0.9], [LEN, 0.9]]);
  const send = Float64Array.from(bassMono, (v, i) => v * sendCurve(i / SR));
  addPan(space, send, 0, db(-8), -0.3); addPan(space, partner.out, 0, db(-8), 0.7);
  // Fold the 3-second tail onto the start: the loop is now exactly 4 bars and continuous.
  const dryLoop = foldLoop(dry, SECONDS), spaceLoop = foldLoop(space, SECONDS);
  const canyon = circularWet(spaceLoop, (b, offset) => reverb(b, { size: 2.6, rt60: 3.2, hfRatio: 0.4, predelay: 0.05, lowCut: 220, seed: 9, loopPeriod: SECONDS, loopOffset: offset }), 4);
  const wall = circularWet(spaceLoop, b => echo(b, { left: 3 * S16, right: 4 * S16, feedback: 0.3, lp: 3500, hp: 350, pingpong: true }), 4);
  const mix = stereo(SECONDS);
  addStereo(mix, dryLoop); addStereo(mix, canyon, 0, db(-6)); addStereo(mix, wall, 0, db(-13));
  circular(mix, b => eqStereo(b, [['hp', 28, 0.5412, 0], ['hp', 28, 1.3066, 0], ['peak', 240, 0.9, -2]]));
  const gr = circular(mix, b => compress(b, { threshold: -12, ratio: 2, attack: 0.015, release: 0.12, knee: 8 }));
  const mastering = master(mix, { targetLufs: -14, ceilingDb: -1.2, release: 0.07, loop: true, softClip: 3 });
  if (stems) return {
    mix, bass: foldMono(bassMono, SECONDS), sub: foldMono(sub, SECONDS),
    partner: foldMono(partner.out, SECONDS), automation: A,
  };
  return { bus: mix, meta: { bpm: BPM, bars: BARS, seconds: SECONDS, loop: true, compressorMaxDb: gr.reduce((a, b) => Math.max(a, b), 0), ...mastering } };
}
