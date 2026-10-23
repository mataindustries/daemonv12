// STILL HERE — B: THE HUMAN SPARK. 180 BPM beat (1/3 s), 4/4, 9 bars of 1.333 s, D major (Lydian II).
// Before ignition the machine breathes in 3 (one press per second) against the spark's 4-beat
// cells; the cycles coincide only at 0 and at pos 48 = 4.000 s = frame 176,400 (ignition).
// The spark: D–E–A–B (quarter, eighth, pushed dotted quarter, quarter) completing on D'.
import { SR, mtof, norm, filt, Biquad } from '../lib/dsp.mjs';
import { cable } from '../lib/cable.mjs';
import { kick, snare, cableTom, cableTick, cableScrape } from '../lib/kit.mjs';
import { springSnare } from '../lib/household.mjs';
import { singer, tine, warmBass, strikePlate, breathPress, tock, cablePluck, room, hp4, edges, peak } from '../src/instruments.mjs';
import { duckLane } from '../src/project.mjs';
import { grid } from '../src/timing.mjs';

export const g = grid(180);
const SECONDS = 12;
const P = (bar, beat = 1, six = 0) => (bar - 1) * 16 + (beat - 1) * 4 + six;
const t = pos => g.sec(pos);
const S16 = 1 / 12; // nominal seconds per sixteenth (durations only; onsets use engine frames)
export const IGNITION = P(4), PAYOFF = P(8, 3), LAST = P(9);

// the spark's rhythm inside a 4-beat cell: D on 0, E on 4, A on 6 (pushed), B on 12
const SPARK = [0, 4, 6, 12], SPARK_LEN = [4, 2, 6, 4];
const spark = (at, midis, extra = {}) => midis.map((m, k) => ({ pos: at + SPARK[k], midi: m, len: SPARK_LEN[k], ...extra }));
// the payoff's diminution: twice as fast, so the octave lands on the next bar line
const FAST = [0, 2, 3, 6], FAST_LEN = [2, 1, 3, 2];
const fast = (at, midis, extra = {}) => midis.map((m, k) => ({ pos: at + FAST[k], midi: m, len: FAST_LEN[k], ...extra }));

export function score(version = 'v1') {
  // V2, one purposeful revision: let the groove drive and the spark lift (REVIEW.md B1-B3)
  const V = { v1: {}, v2: { lowEnd: true, drive: true, summit: true } }[version];
  if (!V) throw new Error(`unknown version ${version}`);
  const D2 = 38, E2 = 40, A2 = 45, B2 = 47, B1 = 35, Cs2 = 37, Fs2 = 42, G1 = 31, A1 = 33;

  // ---------------- the voice: hum (bar 3), the cry at ignition, answers, ascent, payoff
  const sec = n => ({ t: t(n.pos), dur: n.len * S16 * (n.legato ?? 0.9), midi: n.midi, ph: n.ph, vel: n.vel ?? 0.85, onset: n.onset, to: n.to, vib: n.vib, tense: n.tense });
  const VOICE = [
    ...spark(P(3), [62, 64, 69, 71], { vel: 0.55 }).map((n, k) => ({ ...n, ph: ['mm', 'mm', 'oo', 'oh'][k], vib: 8 })),     // hummed D4 E4 A4 B4
    { pos: IGNITION, midi: 74, len: 7, ph: 'ah', onset: 'hh', vel: 1, vib: 26, legato: 1 },                                     // D5: the spark completes
    ...spark(P(5), [73, 71, 68, 69], { ph: 'ah', vel: 0.85 }).map((n, k) => (k === 0 ? { ...n, ph: 'oh', onset: 'hh' } : n)),  // C#5 B4 G#4 A4 over E/D
    ...spark(P(6), [71, 74, 76, 78], { ph: 'ah', vel: 0.9 }),                                                                   // B4 D5 E5 F#5 over Bm7
    ...fast(P(7), [67, 69, 74, 76], { ph: 'ah', vel: 0.85 }), ...fast(P(7, 3), [69, 71, 76, 78], { ph: 'ah', vel: 0.9 }),     // the spark climbs (G, A)
    ...fast(P(8), [71, 73, 78, 76], { ph: 'ah', vel: 0.95 }),                                                                   // B4 C#5 F#5 E5 (Bm -> A/C#)
    ...(V.summit
      // V2: the spark from A4 to A5, the summit. Pressed phonation (tense 0.72) renders ~5 dB quieter than
      // V1's D5 at the same velocity (smaller open quotient), so the velocities compensate (REVIEW.md, B V2 log)
      ? [...fast(PAYOFF, [69, 71, 76, 78], { ph: 'ah', vel: 1.25, onset: 'hh', tense: 0.72 }).map((n, k) => (k ? { ...n, onset: undefined } : n)),
        { pos: LAST, midi: 81, len: 11, ph: 'ah', vel: 1.8, vib: 28, legato: 1, tense: 0.72 }]
      : [...fast(PAYOFF, [62, 64, 69, 71], { ph: 'ah', vel: 1, onset: 'hh' }).map((n, k) => (k ? { ...n, onset: undefined } : n)),          // the full spark...
        { pos: LAST, midi: 74, len: 11, ph: 'ah', vel: 1, vib: 28, legato: 1 }]),                                                            // ...lands on D5 at 10.667 s
  ];
  const voice = singer({ seconds: SECONDS, notes: VOICE.map(sec), seed: 11, size: 0.86, tense: 0.5, vibrato: 20 });
  if (V.summit) { filt(voice, 'peak', 2800, 0.8, 4); norm(voice, 0.9); } // presence for small speakers
  // the inhale before ignition: aspiration only, rising into 4.000 s
  const inhale = breath(t(P(3, 4, 2)), t(IGNITION) - 0.004, 17);
  for (let i = 0; i < inhale.length; i++) voice[i] += 0.5 * inhale[i];

  // ---------------- choir: three voices, sustained chord tones per harmony (enters at ignition)
  const CHORDS = [
    [P(4), [57, 62, 66]], [P(5), [59, 64, 68]], [P(6), [57, 62, 66]], [P(7), [59, 62, 67]], [P(7, 3), [61, 64, 69]],
    [P(8), [62, 66, 71]], [P(8, 2), [61, 64, 69]], [PAYOFF, [57, 64, 66]], [LAST, [57, 64, 66]],
  ];
  const choirChords = V.summit ? CHORDS.filter(([pos]) => pos < PAYOFF) : CHORDS;
  const choirPart = k => {
    const held = choirChords.map(([pos, ns], j) => {
      const end = j + 1 < choirChords.length ? choirChords[j + 1][0] : V.summit ? PAYOFF : P(9, 4);
      return { t: t(pos), dur: (end - pos) * S16 * 0.97, midi: ns[k], ph: j === 1 ? 'oh' : 'ah', vel: 0.6, vib: 14 };
    });
    if (!V.summit) return held;
    // V2 payoff: two voices sing the original spark D4-E4-A4-B4, the third a fourth below; then D major under the A5
    const line = k === 2 ? [57, 59, 64, 66] : [62, 64, 69, 71], last = [74, 66, 57][k];
    return [...held, ...fast(PAYOFF, line).map(n => ({ t: t(n.pos), dur: n.len * S16 * 0.9, midi: n.midi, ph: 'ah', vel: 0.6, vib: 10 })),
      { t: t(LAST), dur: 11 * S16, midi: last, ph: 'ah', vel: 0.7, vib: 16 }];
  };
  const choir = [0, 1, 2].map(k => singer({ seconds: SECONDS, notes: choirPart(k), seed: 21 + k, size: [1.02, 0.94, 0.88][k], tense: 0.4, vibrato: 12, attack: 0.12, release: 0.25 }));
  const pans = V.drive ? [-0.8, 0.05, 0.8] : [-0.55, 0.1, 0.6], choirL = new Float64Array(SECONDS * SR), choirR = new Float64Array(SECONDS * SR);
  choir.forEach((c, k) => { const a = (pans[k] + 1) * Math.PI / 4; for (let i = 0; i < c.length; i++) { choirL[i] += c[i] * Math.cos(a); choirR[i] += c[i] * Math.sin(a); } });
  if (V.drive) { const k = 0.9 / peak(choirL, choirR); for (let i = 0; i < choirL.length; i++) { choirL[i] *= k; choirR[i] *= k; } } // V2: joint, keeps the balance
  else { norm(choirL, 0.9); norm(choirR, 0.9); }
  const vRoom = room(Float64Array.from(voice, (v, i) => v + 0.5 * choirL[i]), Float64Array.from(voice, (v, i) => v + 0.5 * choirR[i]), { rt60: 2.1, predelay: 0.03, seed: 5 });

  // ---------------- warm bass: from ignition it plays the spark itself
  const BASS = [
    ...spark(P(4), [D2, E2, A2, B2]),
    { pos: P(5), midi: D2, len: 3 }, { pos: P(5, 1, 3), midi: D2, len: 2 }, { pos: P(5, 2, 2), midi: D2, len: 3 }, { pos: P(5, 4), midi: D2, len: 3 },
    ...spark(P(6), [B1, Cs2, Fs2, A2]),
    ...[0, 2, 4, 6].map(k => ({ pos: P(7) + k, midi: G1, len: 1.6 })), ...[0, 2, 4, 6].map(k => ({ pos: P(7, 3) + k, midi: A1, len: 1.6 })),
    { pos: P(8), midi: B1, len: 1.6 }, { pos: P(8, 1, 2), midi: B1, len: 1.6 }, { pos: P(8, 2), midi: Cs2, len: 1.6 }, { pos: P(8, 2, 2), midi: Cs2, len: 1.6 },
    ...fast(PAYOFF, [D2, E2, A2, B2]),
    { pos: LAST, midi: D2, len: 12 },
  ];
  // V2: phrased with real rests (62 % of each written length; the final D2 still rings)
  const bass = warmBass({ seconds: SECONDS, notes: BASS.map(n => ({ t: t(n.pos), dur: n.len * S16 * (V.lowEnd && n.pos < LAST ? 0.62 : 0.92), midi: n.midi, vel: 1 })) });
  norm(bass.sub, 0.9); norm(bass.body, 0.9);

  // ---------------- one-shots
  const kitMachine = [
    { name: 'press', pitch: 60, audio: breathPress({ seed: 7, tune: 73.42 }) },
    { name: 'tock-hi', pitch: 61, audio: tock(86, 41) }, { name: 'tock-lo', pitch: 62, audio: tock(81, 43) },
  ];
  const sn = snare({ f0: 196, decay: 0.24, wires: 0.2, crack: 0.25, crackMidi: 62, seed: 23 }), sp = springSnare(21, { boing: 0.6 });
  const spSnare = new Float64Array(Math.max(sn.length, sp.length));
  for (let i = 0; i < spSnare.length; i++) spSnare[i] = 0.8 * (sn[i] ?? 0) + 0.55 * (sp[i] ?? 0);
  const kitKick = [{ name: 'kick', pitch: 36, audio: kick({ f0: 47, lift: 12, decay: 0.38, hard: 0.78, beater: 7, drive: 1.9, seed: 5 }) }];
  const kitSnare = [
    { name: 'snare', pitch: 38, audio: norm(edges(spSnare, 0.03), 0.9) },
    { name: 'ghost', pitch: 37, audio: snare({ f0: 220, decay: 0.08, wires: 0.06, hard: 0.45, seed: 33 }) },
    { name: 'roll', pitch: 40, audio: snare({ f0: 210, decay: 0.12, wires: 0.1, hard: 0.6, seed: 31 }) },
  ];
  const kitTicks = [
    ...[0, 1, 2, 3].map(k => ({ name: `tick-${k + 1}`, pitch: 42 + k, audio: cableTick({ midi: 96 + k, decay: 0.04, seed: 120 + k }) })),
    { name: 'shaker', pitch: 50, audio: cableScrape({ midi: 90, seconds: 0.07, seed: 17 }) },
  ];
  const kitMetal = [
    { name: 'crash', pitch: 49, audio: strikePlate({ seconds: 2.6, seed: 19, base: 300, ring: 1.9, wash: 0.3 }) },
    ...[[50, 'tom-d'], [54, 'tom-fs'], [57, 'tom-a']].map(([m, name], k) => ({ name, pitch: 60 + k, audio: cableTom(m, { seed: 51 + k, disp: -0.35 }) })),
  ];
  const boxPitches = [74, 76, 81, 83, 86, 85, 80, 88, 90, 93, 95, 98];
  const kitBox = [...new Set(boxPitches)].map(m => ({ name: `t${m}`, pitch: m, audio: tine(m, { decay: m > 90 ? 1.0 : 1.4, bright: 0.9, seed: 400 + m }) }));
  const cablePitches = [D2, E2, A2, B2, B1, Cs2, Fs2, 26, 33];
  const kitCable = cablePitches.map(m => ({ name: `c${m}`, pitch: m, audio: cablePluck(m, { decay: 0.22, disp: -0.55, bright: 6500, buzz: 0.15, seed: 500 + m, stages: 120 }) }));

  // ---------------- patterns
  const machine = [], kicks = [], snares = [], ticks = [], metal = [], box = [], cab = [];
  for (const p of [0, 12, 24, 36]) machine.push({ pos: p, hit: 'press', vel: 0.75 + 0.06 * p / 12 });
  for (const p of [0, 12, 24, 36]) machine.push({ pos: p + 4, hit: 'tock-hi', vel: 0.45 }, { pos: p + 8, hit: 'tock-lo', vel: 0.4 });
  machine.push({ pos: IGNITION, hit: 'press', vel: 1 }, { pos: LAST, hit: 'press', vel: 0.8 }, { pos: LAST + 12, hit: 'press', vel: 0.6 },
    { pos: LAST + 4, hit: 'tock-hi', vel: 0.35 }, { pos: LAST + 8, hit: 'tock-lo', vel: 0.3 });
  // the spark in the music box: 3 notes, then 4, then 4 over the hum; it completes on D6
  box.push(...spark(P(1), [74, 76, 81]).map(n => ({ pos: n.pos, hit: `t${n.midi}`, vel: 0.55 })));
  box.push(...spark(P(2), [74, 76, 81, 83]).map(n => ({ pos: n.pos, hit: `t${n.midi}`, vel: 0.62 })));
  box.push(...spark(P(3), [74, 76, 81, 83]).map(n => ({ pos: n.pos, hit: `t${n.midi}`, vel: 0.7 })));
  box.push({ pos: IGNITION, hit: 't86', vel: 0.85 });
  box.push(...spark(P(5), [85, 83, 80, 81]).map(n => ({ pos: n.pos, hit: `t${n.midi}`, vel: 0.4 })));           // echoes the answer
  box.push(...fast(PAYOFF, [86, 88, 93, 95]).map(n => ({ pos: n.pos, hit: `t${n.midi}`, vel: V.summit ? 0.9 : 0.7 })), { pos: LAST, hit: 't98', vel: V.summit ? 0.9 : 0.75 });
  box.push({ pos: LAST + 6, hit: 't80', vel: 0.35 }, { pos: LAST + 12, hit: 't86', vel: 0.45 });                       // Lydian G#5 shimmer; D6 with the machine
  // the machine answers the incomplete spark with a low cable pluck; the cable then doubles the bass's spark notes
  cab.push({ pos: P(1, 4), hit: 'c38', vel: 0.5 }, { pos: P(2, 4, 3), hit: 'c33', vel: 0.45 });
  for (const n of BASS) if ([P(4), P(6), PAYOFF].some(a => n.pos >= a && n.pos < a + 16) || n.pos === LAST) cab.push({ pos: n.pos, hit: `c${n.midi}`, vel: 0.8 });
  // drums: half-time (bars 4-6), double-time climb (7), roll (8a), payoff
  for (const b of [4, 5, 6]) {
    if (V.drive && b === 6) { // V2: second gear at 6.67 s, backbeat on 2 and 4
      kicks.push({ pos: P(b), vel: 1 }, { pos: P(b, 2, 2), vel: 0.75 }, { pos: P(b, 3, 2), vel: 0.85 });
      snares.push({ pos: P(b, 2), hit: 'snare', vel: 0.9 }, { pos: P(b, 4), hit: 'snare', vel: 0.92 }, { pos: P(b, 4, 3), hit: 'ghost', vel: 0.35 });
      continue;
    }
    kicks.push({ pos: P(b), vel: 1 }, { pos: P(b, 3, 2), vel: 0.8 });
    if (b === 6) kicks.push({ pos: P(b, 4, 2), vel: 0.7 });
    snares.push({ pos: P(b, 3), hit: 'snare', vel: 0.95 }, { pos: P(b, 4, 1), hit: 'ghost', vel: 0.3 }, { pos: P(b, 4, 3), hit: 'ghost', vel: 0.35 });
  }
  kicks.push({ pos: P(7), vel: 1 }, { pos: P(7, 2, 2), vel: 0.75 }, { pos: P(7, 3, 2), vel: 0.85 }, { pos: P(8), vel: 0.95 }, { pos: P(8, 2), vel: 0.85 });
  snares.push({ pos: P(7, 2), hit: 'snare', vel: 0.9 }, { pos: P(7, 4), hit: 'snare', vel: 0.92 });
  for (let k = 0; k < 8; k++) snares.push({ pos: P(8) + k, hit: 'roll', vel: 0.3 + 0.55 * k / 7 });
  kicks.push({ pos: PAYOFF, vel: 1 }, { pos: P(8, 4, 2), vel: 0.8 }, { pos: LAST, vel: 1 });
  snares.push({ pos: PAYOFF, hit: 'snare', vel: 1 }, { pos: P(8, 4), hit: 'snare', vel: 0.9 }, { pos: LAST + 4, hit: 'snare', vel: 0.75 });
  for (let p = P(3); p < LAST + 9; p++) {
    if (p >= P(3) && p < IGNITION) { ticks.push({ pos: p, hit: `tick-${(p % 4) + 1}`, vel: 0.08 + 0.32 * (p - P(3)) / 16 }); continue; }  // the machine wakes
    const fade = p >= LAST ? 1 - (p - LAST) / 10 : 1;
    ticks.push({ pos: p, hit: `tick-${(p % 4) + 1}`, vel: (p % 2 ? 0.38 : 0.78) * fade });
    if (p % 4 === 2 && p < LAST) ticks.push({ pos: p, hit: 'shaker', vel: 0.5 });
  }
  metal.push({ pos: IGNITION, hit: 'crash', vel: 0.9 }, { pos: PAYOFF, hit: 'crash', vel: 0.85 }, { pos: LAST, hit: 'crash', vel: 0.75 });
  metal.push({ pos: P(8, 2), hit: 'tom-d', vel: 0.6 }, { pos: P(8, 2, 1), hit: 'tom-fs', vel: 0.65 }, { pos: P(8, 2, 2), hit: 'tom-a', vel: 0.7 });

  const kickTimes = kicks.map(k => t(k.pos));
  const tracks = [
    { id: 'machine', description: 'The machine breathing in 3: a soft press (membrane, gear ring, exhale) each second with two light cable tocks; it returns at the end.', kit: kitMachine, notes: machine, mix: { gainDb: -6 } },
    { id: 'kick', description: 'MORPH//04 membrane kick, half-time then double-time.', kit: kitKick, notes: kicks.map(k => ({ ...k, hit: 'kick' })), mix: { gainDb: V.drive ? -3 : -4 } },
    { id: 'snare', description: 'Membrane snare layered with the MORPH//02 toaster spring; ghosts; the climb roll.', kit: kitSnare, notes: snares, mix: { gainDb: V.drive ? -3 : -8 },
      effects: [{ type: 'reverb', roomSize: 0.5, decaySeconds: 1.1, wet: 0.14 }] },
    { id: 'ticks', description: 'Cable ticks: a crescendo while the machine wakes, then rolling 16ths; cable shaker off-beats.', kit: kitTicks, notes: ticks, mix: V.drive ? { gainDb: -10, pan: -0.35 } : { gainDb: -16, pan: -0.15 } },
    { id: 'metal', description: 'Struck steel plate at ignition, payoff and final; cable toms D-F#-A into the payoff.', kit: kitMetal, notes: metal, mix: { gainDb: -11 } },
    { id: 'music-box', description: 'Glass tines: the spark growing note by note, completing on D6; echoes; the payoff two octaves up; Lydian G# shimmer.', kit: kitBox, notes: box,
      mix: { gainDb: -11, pan: V.drive ? 0.35 : 0.2 }, effects: [{ type: 'reverb', roomSize: 0.75, decaySeconds: 1.8, wet: 0.3 }] },
    { id: 'voice', description: 'EXTERNAL: the MORPH//02 glottal voice: hum, inhale, the cry on D5 at ignition, answers, climb, payoff.', sample: voice, notes: [{ pos: 0, vel: 1 }], mix: { gainDb: V.summit ? -2 : -5 } },
    { id: 'choir', description: 'EXTERNAL: three glottal voices of different sizes holding the chord tones.', sample: [choirL, choirR], notes: [{ pos: 0, vel: 1 }], mix: { gainDb: V.drive ? -9 : -12 },
      automation: { gainDb: duckLane(V.drive ? -9 : -12, kickTimes, { depth: 4, recover: 0.2 }) } },
    { id: 'voice-room', description: 'EXTERNAL: MORPH FDN room return of voice + choir.', sample: [vRoom.L, vRoom.R], notes: [{ pos: 0, vel: 1 }], mix: { gainDb: V.drive ? -11 : -13 } },
    { id: 'bass', description: 'EXTERNAL: warm bass above 110 Hz (low-passed saw + sine harmonics), playing the spark from ignition.', sample: bass.body, notes: [{ pos: 0, vel: 1 }], mix: { gainDb: V.lowEnd ? -5 : -7 } },
    { id: 'bass-sub', description: 'EXTERNAL: the warm bass below 110 Hz; authored gain ducks it under every kick.', sample: bass.sub, notes: [{ pos: 0, vel: 1 }],
      mix: { gainDb: V.lowEnd ? -10 : -6 }, automation: { gainDb: V.lowEnd ? duckLane(-10, kickTimes, { depth: 14, recover: 0.17 }) : duckLane(-6, kickTimes, { depth: 9, recover: 0.13 }) } },
    { id: 'cable', description: 'Tempo String plucks: the machine answering the incomplete spark, then the chirp attack on the bass statements.', kit: kitCable, notes: cab, mix: { gainDb: V.lowEnd ? -11 : -15 } },
  ];
  return {
    name: `still-here-b-${version}`, title: `STILL HERE B: THE HUMAN SPARK (${version.toUpperCase()})`,
    description: 'A 12-second aerospace spec score on a 180 BPM beat in D. The machine breathes in 3 against a spark that grows in 4-beat cells; the cycles lock at 4.000 s (frame 176,400) where the spark completes and ignites the groove.',
    bpm: 180, bars: 9, key: 'D major', seed: 2, grid: g,
    master: { gainDb: 0, effects: [{ type: 'highpass', frequencyHz: 24 }, { type: 'compressor', thresholdDb: -14, ratio: 2, attackMs: 15, releaseMs: 120 }] },
    tracks,
    cues: [
      { pos: 0, cue: 'machine + spark (3 notes)', what: 'Press each second (heavy, tock, tock); music box D5-E5-A5' },
      { pos: P(1, 4), cue: 'machine answers', what: 'Low cable pluck where the 4th note is missing' },
      { pos: P(2), cue: 'spark (4 notes)', what: 'D5-E5-A5-B5' },
      { pos: P(3), cue: 'the human hums', what: 'Voice hums D4-E4-A4-B4 under the music box; ticks crescendo' },
      { pos: P(3, 4, 2), cue: 'inhale', what: 'Breath rising into ignition' },
      { pos: IGNITION, cue: 'IGNITION', what: 'Machine pulse and 4/4 lock; the spark completes: voice D5 + music box D6; bass plays the spark low; crash' },
      { pos: P(5), cue: 'answer (Lydian II)', what: 'Voice C#5-B4-G#4-A4 over E/D' },
      { pos: P(6), cue: 'statement on vi', what: V.drive ? 'Bass B1-C#2-F#2-A2; voice rises B4-D5-E5-F#5; drums shift to double-time' : 'Bass B1-C#2-F#2-A2; voice rises B4-D5-E5-F#5' },
      { pos: P(7), cue: 'ASCENT', what: V.drive ? 'The spark in diminution climbs over G, A; rising bass G-A-B-C#' : 'Double-time drums; the spark in diminution climbs over G, A; rising bass G-A-B-C#' },
      { pos: P(8), cue: 'roll', what: 'Snare roll and toms D-F#-A' },
      { pos: PAYOFF, cue: 'BREAKTHROUGH', what: V.summit ? 'The spark transformed: voice A4-B4-E5-F#5 over the choir singing the original D4-E4-A4-B4; bass and music box (two octaves up) in the same rhythm' : 'Full spark D4-E4-A4-B4 (voice, bass, music box two octaves up)' },
      { pos: LAST, cue: 'completion', what: V.summit ? 'Voice lands on A5, the highest note of the piece, over D major (choir D5/F#4/A3); the machine pulse returns' : 'D5 on the last bar line; Dmaj9; the machine pulse returns' },
      { pos: LAST + 6, cue: 'Lydian shimmer', what: 'Music box G#5' },
      { pos: LAST + 12, cue: 'machine', what: 'Press + D6: the 1 Hz pulse again, inviting the replay' },
    ],
  };
}

/** An inhale: band-passed noise swelling from `from` to `to` (seconds), ending in a 4 ms fade. */
function breath(from, to, seed) {
  const n = SECONDS * SR, y = new Float64Array(n), bp = new Biquad('bp', 1500, 0.9), hp = new Biquad('hp', 600, 0.7);
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 * 2 - 1; };
  const a = Math.round(from * SR), b = Math.round(to * SR);
  for (let i = a; i < b; i++) {
    const u = (i - a) / (b - a), env = u ** 1.6 * Math.min(1, (b - i) / (0.004 * SR));
    y[i] = hp.tick(bp.tick(rnd())) * env;
  }
  return norm(y, 0.35);
}
