// STILL HERE V3 — L: LIFT. Same tempo map as P (bars 1-2 at 120 BPM, 3-7 at 150 BPM; ignition at
// pos 32 = 4.000 s = frame 176,400), a different hook and arrangement. E major; the intro sits on
// the dominant (B). Hook: B's spark E-F#-B-C# (-> E'), which grows note by note in the factory and
// completes at ignition, where the harmony opens to Emaj9. The payoff restates the spark in
// diminution over a rising bass and lands it an octave higher, on E6, at 10.4 s.
import { SR, mtof, norm, split } from '../lib/dsp.mjs';
import { cable } from '../lib/cable.mjs';
import { eKick, backbeat, eSnare, eHat, eShaker, eCrash, synthNote, synthLine, PATCH } from '../src/synths.mjs';
import { room } from '../src/instruments.mjs';
import { duckLane } from '../src/project.mjs';
import { PROPULSION_MAP } from '../src/tempo-map.mjs';
import { P, TRESILLO, heartbeat, tickKit, turbine, pitchedKit, gatedNotes, sendSum } from './v3-common.mjs';

const SECONDS = 12;
const B1 = 35, E2 = 40, E3 = 52, Cs2 = 37, A1 = 33, Ds2 = 39;
const SPARK = [[0, 4], [4, 2], [6, 6], [12, 4]];          // the spark's rhythm in a 4-beat cell: [offset, length] in sixteenths
const FAST = [[0, 2], [2, 1], [3, 3], [6, 2]];            // its diminution (twice as fast)

const CHORDS = [ // [pos, length, name, pad voicing, arp tones]
  [P(3), 16, 'emaj9', [52, 59, 63, 66, 68], [64, 68, 71, 75, 78]],
  [P(4), 16, 'fs-e', [52, 58, 61, 66, 70], [64, 66, 70, 73, 78]],          // F#/E: B's Lydian II over the tonic pedal
  [P(5), 8, 'csm9', [49, 56, 59, 63, 64], [61, 64, 68, 71, 75]],
  [P(5, 3), 8, 'amaj9', [45, 52, 56, 59, 61], [57, 64, 68, 71, 73]],
  [P(6), 4, 'a', [45, 52, 57, 61], [57, 61, 64, 69]],
  [P(6, 2), 4, 'b', [47, 54, 59, 63], [59, 63, 66, 71]],
  [P(6, 3), 4, 'csm', [49, 56, 61, 64], [61, 64, 68, 73]],
  [P(6, 4), 4, 'b-ds', [51, 54, 59, 63], [63, 66, 71, 75]],
  [P(7), 16, 'eadd9', [52, 59, 64, 66, 68, 71], [64, 68, 71, 76, 78]],
];
const ARP_STEPS = [0, 1, 2, 1, 2, 3, 2, 4, 0, 1, 2, 1, 2, 3, 2, 4];   // 3+3+2 waves

export function score(version = 'v1') {
  // V2 is the one revision after the V1 critique (REVIEW-V3.md), "withhold, then open": the build keeps the machine
  // audible and the sub out, so the low end, the full 16th motion and the harmony arrive together at 4.000 s
  const V = { v1: {}, v2: { machineIntro: true, withheldLow: true, drive: true } }[version];
  if (!V) throw new Error(`unknown version ${version}`);
  const M = PROPULSION_MAP(), IGN = P(3), SUMMIT = P(7), FINAL = P(7, 3);

  // ---------------- the spark
  const bellNotes = [
    ...SPARK.slice(0, 3).map(([x, len], k) => ({ pos: x, midi: [64, 66, 71][k], len, vel: 0.5 + 0.04 * k })),                 // E4 F#4 B4 (incomplete)
    ...SPARK.map(([x, len], k) => ({ pos: P(2) + x, midi: [64, 66, 71, 73][k], len, vel: 0.6 + 0.05 * k })),                  // E4 F#4 B4 C#5
  ];
  const LEAD = [
    [IGN, 76, 6], [P(3, 3), 78, 2], [P(3, 3, 2), 80, 2], [P(3, 4), 83, 4],                          // E5 (the spark completes) F#5 G#5 B5
    [P(4), 82, 4], [P(4, 2), 80, 2], [P(4, 2, 2), 78, 6], [P(4, 4), 76, 4],                         // A#5 (Lydian) G#5 F#5 E5
    ...SPARK.map(([x, len], k) => [P(5) + x, [76, 78, 83, 85][k], k === 3 ? 8 : len]),              // the spark: E5 F#5 B5 C#6 (held over the bar line)
    [P(6, 2), 83, 4],                                                                                // B5
    ...FAST.map(([x, len], k) => [P(6, 3) + x, [76, 78, 83, 85][k], len]),                          // the spark in diminution...
    [SUMMIT, 88, 12],                                                                                // ...lands on E6 at 10.4 s
  ].map(([pos, midi, len]) => ({ pos, midi, len }));
  const lead = synthLine({ seconds: SECONDS, notes: LEAD.map(n => ({ t: M.sec(n.pos), dur: M.span(n.pos, n.len), midi: n.midi, vib: n.midi === 88 ? 22 : undefined })), patch: PATCH.soarLead, seed: 5, glide: 0.045 });

  // ---------------- bass, pad, arpeggio
  const bassBar = (b, root, ...extra) => [[0, root, 2, 1], [3, root, 1, 0.7], [6, root, 2, 0.9], [8, root + 12, 1, 0.7], [10, root, 2, 0.85], [13, root, 1, 0.6], ...extra].map(([x, m, len, vel]) => ({ pos: P(b) + x, midi: m, len, vel }));
  const bass = [
    ...bassBar(3, E2, [14, B1, 2, 0.75]), ...bassBar(4, E2, [14, B1, 2, 0.75]),
    ...[[0, Cs2, 2, 1], [3, Cs2, 1, 0.7], [6, Cs2, 2, 0.9], [8, A1, 2, 0.95], [11, A1, 1, 0.7], [14, A1, 2, 0.85]].map(([x, m, len, vel]) => ({ pos: P(5) + x, midi: m, len, vel })),
    ...[A1, A1, B1, B1, Cs2, Cs2, Ds2, Ds2].map((m, k) => ({ pos: P(6) + 2 * k, midi: m, len: 1.5, vel: 0.8 + 0.025 * k })),     // the rising bass
    { pos: SUMMIT, midi: E2, len: 8, vel: 1 }, { pos: FINAL, midi: E2, len: 4, vel: 0.7 },
  ];
  const kitBass = pitchedKit('b', bass.map(n => n.midi), m => synthNote({ midis: [m], seconds: 1.0, gate: 0.9, patch: PATCH.bass, seed: m }));
  const swellPatch = { ...PATCH.pad, amp: { a: 0.85, d: 0.5, s: 1, r: 0.04 } };
  const kitPad = [
    { name: 'swell-bsus4', pitch: 50, audio: synthNote({ midis: [47, 52, 54, 59], seconds: 1.0, gate: 0.97, patch: swellPatch, seed: 80 }) },
    ...CHORDS.map(([pos, len, name, voicing], k) => {
      const dur = M.span(pos, len), last = k === CHORDS.length - 1, seconds = last ? M.sec(P(8)) - M.sec(pos) : dur + 0.35;
      return { name: `pad-${name}`, pitch: 51 + k, audio: synthNote({ midis: voicing, seconds, gate: last ? seconds - 0.36 : dur, patch: PATCH.pad, seed: 81 + k }) };
    }),
  ];
  const padNotes = [{ pos: P(2, 3), hit: 'swell-bsus4', vel: 0.8 }, ...CHORDS.map(([pos, , name]) => ({ pos, hit: `pad-${name}`, vel: 0.85 }))];
  const arpNotes = [];
  for (let pos = IGN; pos < FINAL; pos++) {
    const c = CHORDS.findLast(ch => pos >= ch[0]), tones = c[4], m = tones[ARP_STEPS[pos % 16] % tones.length];
    const ramp = V.drive ? 0.92 : Math.min(0.92, 0.55 + 0.37 * (pos - IGN) / 64);   // V2: full strength from the ignition downbeat
    arpNotes.push({ pos, midi: m, len: 1, vel: (TRESILLO.includes(pos % 16) ? 1 : 0.62) * ramp });
  }
  const kitArp = pitchedKit('a', arpNotes.map(n => n.midi), m => synthNote({ midis: [m], seconds: 0.45, gate: 0.2, patch: PATCH.arp, seed: 150 + m }));
  const kitBell = pitchedKit('e', bellNotes.map(n => n.midi), m => synthNote({ midis: [m], seconds: 1.4, gate: 0.5, patch: PATCH.bell, seed: 60 + m }));

  // ---------------- drums and the factory
  const kitKick = [{ name: 'kick', pitch: 36, audio: eKick({ f0: 52, decay: 0.38, seed: 1 }) }, { name: 'kick-big', pitch: 35, audio: eKick({ f0: 49, fStart: 260, decay: 0.6, click: 1, drive: 2.3, seed: 2 }) }];
  const kitSnare = [{ name: 'clap', pitch: 39, audio: backbeat({ seed: 13, snareOpts: { tone: [176, 320] } }) }, { name: 'roll', pitch: 38, audio: eSnare({ seed: 19, noiseDecay: 0.09, toneDecay: 0.06 }) }];
  const kitHats = [{ name: 'hat-1', pitch: 42, audio: eHat({ seed: 27 }) }, { name: 'hat-2', pitch: 44, audio: eHat({ seed: 28, tune: 1.63 }) }, { name: 'ohat', pitch: 46, audio: eHat({ seed: 29, decay: 0.28 }) },
    { name: 'shaker', pitch: 70, audio: eShaker({ seed: 31 }) }];
  const kitCrash = [{ name: 'crash', pitch: 49, audio: eCrash({ seed: 33, decay: 1.9 }) }];
  const kitHeart = [{ name: 'heart', pitch: 60, audio: heartbeat(61.74, { seed: 7 }) }];
  const kitTicks = tickKit();

  // the cable: the machine answers the incomplete spark at 1.5 s, then the turbine winds into B1 and runs into ignition (no breath)
  const cableTrack = new Float64Array(SECONDS * SR);
  const answer = cable({ seconds: 1.2, period: 1 / mtof(B1), disp: -0.3, stages: 160, gain: 0.99, bright: 4200, drive: 2.2, buzz: 0.2, damp: x => (x < 0.45 ? 1 : 0.4),
    events: [{ t: 0, kind: 'slap', hard: 0.9, amp: 0.8, pos: 0.08 }], seed: 51 }).out;
  const answerOut = Float64Array.from(answer, (v, i) => v * Math.min(1, (answer.length - i) / 2000));
  if (!V.machineIntro) for (let i = 0, s0 = M.frame(P(1, 4)); i < answer.length; i++) cableTrack[s0 + i] += 0.5 * answerOut[i];
  const spool = turbine({ from: M.sec(P(2, 3)), pitched: M.sec(P(2, 4, 1)), cut: M.sec(IGN) - 0.006, fadeOut: 0.012, target: B1, seed: 39 });
  // V2: the turbine keeps its pitch in its harmonics but gives up its B1 fundamental; the sub arrives with the kick and bass at 4.000 s
  const spoolOut = V.withheldLow ? split(spool.audio, 150).hi : spool.audio;
  for (let i = 0, s0 = M.frame(P(2, 3)); i < spoolOut.length; i++) cableTrack[s0 + i] += spoolOut[i];
  norm(cableTrack, 0.9);
  // V2: the answer as its own native one-shot, high-passed into the mids (where a phone can play it) at full scale
  const kitAnswer = [{ name: 'machine-answer', pitch: 35, audio: norm(split(answerOut, 140).hi, 0.9) }];

  const kicks = [], claps = [], hats = [], crashes = [], ticks = [], hearts = [];
  for (const b of [3, 4, 5]) for (const x of [0, 6, 10, ...(b === 5 ? [14] : [])]) kicks.push({ pos: P(b) + x, hit: x === 0 && b === 3 ? 'kick-big' : 'kick', vel: x === 0 ? 1 : 0.85 });
  for (const x of [0, 4, 8, 12, 14]) kicks.push({ pos: P(6) + x, hit: 'kick', vel: x === 14 ? 0.75 : 0.95 });
  kicks.push({ pos: SUMMIT, hit: 'kick-big', vel: 1 }, { pos: FINAL, hit: 'kick', vel: 0.8 });
  for (const b of [3, 4, 5]) claps.push({ pos: P(b, 2), hit: 'clap', vel: 0.95 }, { pos: P(b, 4), hit: 'clap', vel: 0.95 });
  claps.push({ pos: P(6, 2), hit: 'clap', vel: 0.95 });
  for (let x = 8; x < 16; x++) claps.push({ pos: P(6) + x, hit: 'roll', vel: 0.3 + 0.6 * (x - 8) / 7 });
  claps.push({ pos: P(7, 2), hit: 'clap', vel: 0.9 });
  for (let pos = IGN; pos < P(7); pos++) {
    const x = pos % 16, b = Math.floor(pos / 16) + 1;
    hats.push({ pos, hit: x === 14 && b < 6 ? 'ohat' : `hat-${(pos % 2) + 1}`, vel: x === 14 && b < 6 ? 0.55 : x % 4 === 2 ? 0.68 : x % 2 ? 0.38 : 0.5 });
    if (b >= 4 && x % 4 === 2) hats.push({ pos, hit: 'shaker', vel: 0.5 });
  }
  for (let pos = P(7); pos < FINAL; pos += 2) hats.push({ pos, hit: `hat-${(pos % 4) / 2 + 1}`, vel: 0.5 });
  crashes.push({ pos: IGN, hit: 'crash', vel: 0.95 }, { pos: SUMMIT, hit: 'crash', vel: 0.9 });
  for (let pos = 0; pos < P(2, 3); pos++) ticks.push({ pos, hit: `tick-${(pos % 4) + 1}`, vel: V.machineIntro ? (TRESILLO.includes(pos % 16) ? 1 : 0.45) : (TRESILLO.includes(pos % 16) ? 0.8 : 0.36) * (pos < 16 ? 0.8 : 1) });
  spool.trips.slice(1).forEach((tt, k) => { if (tt < M.sec(IGN) - 0.02) ticks.push({ tick: M.tickOfSeconds(tt), hit: `tick-${(k % 4) + 1}`, vel: Math.min(0.9, 0.35 + 0.05 * k),
    endSeconds: 0.06, envelope: { attackSeconds: 0, releaseSeconds: 0.003 } }); });
  // V2: no heartbeat at 3.0 s: the turbine takes over the pulse, so no sub sounds in the last second before ignition
  hearts.push(...[0, 8, 16, ...(V.withheldLow ? [] : [24])].map((pos, k) => ({ pos, hit: 'heart', vel: 0.68 + 0.07 * k, gate: M.duration(0.5), envelope: { attackSeconds: 0.0005, releaseSeconds: 0.12 } })));
  hearts.push({ pos: P(7, 4), hit: 'heart', vel: 0.5, gate: M.duration(0.25), envelope: { attackSeconds: 0.0005, releaseSeconds: 0.12 } });  // ends before 12.0 s, no crop

  const bassNotes = gatedNotes(M, 'b', bass, { release: 0.03 }), arpGated = gatedNotes(M, 'a', arpNotes, { release: 0.05 }), bellGated = gatedNotes(M, 'e', bellNotes, { release: 0.25 });
  const sends = [sendSum(M, kitPad, padNotes), sendSum(M, kitArp, arpGated), sendSum(M, kitBell, bellGated)];
  const sL = Float64Array.from(lead.L, (v, i) => v + 0.45 * sends[0].L[i] + 0.55 * sends[1].L[i] + 0.9 * sends[2].L[i]);
  const sR = Float64Array.from(lead.R, (v, i) => v + 0.45 * sends[0].R[i] + 0.55 * sends[1].R[i] + 0.9 * sends[2].R[i]);
  const wet = room(sL, sR, { rt60: 2.0, predelay: 0.03, seed: 11 });

  const kickTimes = kicks.map(k => M.sec(k.pos));
  const tracks = [
    { id: 'heart', description: V.withheldLow ? 'The factory heartbeat on the B pedal (the kick asleep inside the MORPH press clank) at 0, 1 and 2 s, until the turbine takes over; a last beat at 11.6 s.'
      : 'The factory heartbeat on the B pedal (the kick asleep inside the MORPH press clank), once per second; a last beat at 11.6 s.', kit: kitHeart, notes: hearts, mix: { gainDb: -6 } },
    { id: 'kick', description: 'Electronic kick: a broken beat (1, the "a" of 2, 3-and) from ignition, four on the floor into the summit.', kit: kitKick, notes: kicks, mix: { gainDb: -3 } },
    { id: 'clap', description: 'Clap on an electronic snare on 2 and 4; a 16th roll into the payoff.', kit: kitSnare, notes: claps, mix: { gainDb: -7 }, effects: [{ type: 'reverb', roomSize: 0.45, decaySeconds: 1.0, wet: 0.12 }] },
    { id: 'hats', description: 'Metallic hats in 16ths with an open hat on the last off-beat; shaker eighths from bar 4.', kit: kitHats, notes: hats, mix: { gainDb: V.drive ? -12 : -16, pan: 0.25 } },
    { id: 'ticks', description: 'MORPH//04 cable ticks: the 3+3+2 precision rhythm, then the turbine ratchet.', kit: kitTicks, notes: ticks, mix: { gainDb: V.machineIntro ? -8 : -14, pan: -0.3 } },
    { id: 'crash', description: 'Electronic crash at ignition and at the summit.', kit: kitCrash, notes: crashes, mix: { gainDb: -11 } },
    { id: 'bass', description: 'Analog-style bass one-shots, gated natively: syncopated roots, the rising A-B-C#-D# eighths into the payoff; ducked under the kick.', kit: kitBass, notes: bassNotes,
      mix: { gainDb: -5 }, automation: { gainDb: duckLane(-5, kickTimes, { depth: V.drive ? 11 : 7, recover: V.drive ? 0.09 : 0.1 }) } },
    { id: 'lead', description: 'EXTERNAL: the soaring analog lead (two detuned saws and a pulse, legato glides, delayed vibrato, ensemble).', sample: [lead.L, lead.R], notes: [{ pos: 0, vel: 1 }],
      mix: { gainDb: -5 }, effects: [{ type: 'delay', timeMs: 300, wet: 0.14 }] },
    { id: 'bell', description: 'A warm triangle/sine bell-pluck: the spark growing in the factory (E4-F#4-B4, then E4-F#4-B4-C#5).', kit: kitBell, notes: bellGated,
      mix: { gainDb: -8, pan: 0.2 }, effects: [{ type: 'delay', timeMs: 375, wet: 0.25 }] },
    { id: 'pad', description: 'Warm polysynth: the Bsus4 swell into ignition, then Emaj9, F#/E, C#m9, Amaj9, the rising chords and Eadd9; ducked by the kick.', kit: kitPad, notes: padNotes,
      mix: { gainDb: -12 }, automation: { gainDb: duckLane(-12, kickTimes.filter(x => x >= 4), { depth: 5, recover: 0.18 }) } },
    { id: 'arp', description: 'Pulse/saw pluck arpeggio in 16ths (3+3+2 waves) from ignition, dotted-eighth echo.', kit: kitArp, notes: arpGated,
      mix: { gainDb: -14, pan: -0.3 }, effects: [{ type: 'delay', timeMs: 300, wet: 0.22 }] },
    ...(V.machineIntro ? [{ id: 'answer', description: 'MORPH//03 Tempo String one-shot: the machine answers the incomplete spark at 1.5 s (a B1 slap, high-passed at 140 Hz).', kit: kitAnswer,
      notes: [{ pos: P(1, 4), hit: 'machine-answer', vel: 1 }], mix: { gainDb: -9, pan: -0.15 } }] : []),
    { id: 'cable', description: V.machineIntro ? 'EXTERNAL: MORPH//03 Tempo String: the turbine winds into B1 (its fundamental high-passed out) and runs into ignition.'
      : 'EXTERNAL: MORPH//03 Tempo String: the machine answers the spark (1.5 s), then the turbine winds into B1 and runs into ignition.', sample: cableTrack, notes: [{ pos: 0, vel: 1 }], mix: { gainDb: V.withheldLow ? -14 : -12 } },
    { id: 'room', description: 'EXTERNAL: MORPH FDN room of lead, pad, arpeggio and bell, re-created at their exact frames.', sample: [wet.L, wet.R], notes: [{ pos: 0, vel: 1 }], mix: { gainDb: -14 } },
  ];
  return {
    name: `still-here-l-${version}`, title: `STILL HERE L: LIFT (${version.toUpperCase()})`,
    description: 'L: LIFT. Two bars at 120 BPM (the factory on a B pedal, the spark growing), then five at 150 BPM in E, carried by a fixed 150 BPM engine project (2/4) whose ticks hold both tempos exactly. Ignition 4.000 s = frame 176,400 opens Emaj9.',
    bpm: M.engineBpm, timeSignature: M.engineMeter, bars: M.engineBars, key: 'E major', seed: 4, grid: M, tempoMap: M.sections.map(s => ({ bpm: s.bpm, bars: s.bars })),
    master: { gainDb: 0, effects: [{ type: 'highpass', frequencyHz: 24 }, { type: 'compressor', thresholdDb: -14, ratio: 2, attackMs: 12, releaseMs: 110 }] },
    tracks,
    cues: [
      { pos: 0, cue: 'spark (3 notes)', what: 'Heartbeat on B; bell E4-F#4-B4; 3+3+2 ticks' },
      { pos: P(1, 4), cue: 'machine answers', what: V.machineIntro ? 'Cable slap on B, high-passed into the mids, where the 4th note is missing' : 'Low cable pluck where the 4th note is missing' },
      { pos: P(2), cue: 'spark (4 notes)', what: 'E4-F#4-B4-C#5' },
      { pos: P(2, 3), cue: 'turbine + swell', what: V.withheldLow ? 'The heartbeat hands over to the turbine (wound into B1 without its sub), ticks ratchet, Bsus4 swell; no breath, no low end' : 'Cable wound into B1, ticks ratchet, Bsus4 swell; no breath' },
      { pos: IGN, cue: 'IGNITION', what: V.withheldLow ? 'Tempo 150: the spark completes on E5 as the harmony opens to Emaj9; the sub arrives (bass, big kick), crash, arpeggio at full strength, broken beat'
        : 'Tempo 150: the spark completes on E5 as the harmony opens to Emaj9; bass, big kick, crash, arpeggio, broken beat' },
      { pos: P(4), cue: 'Lydian II', what: 'F#/E: A#5-G#5-F#5-E5' },
      { pos: P(5), cue: 'the spark sung', what: 'E5-F#5-B5-C#6 over C#m9 -> Amaj9' },
      { pos: P(6), cue: 'ASCENT', what: 'Rising bass A-B-C#-D#, four on the floor, snare roll' },
      { pos: P(6, 3), cue: 'payoff pickup', what: 'The spark in diminution E5-F#5-B5-C#6' },
      { pos: SUMMIT, cue: 'SUMMIT', what: 'E6 (the spark completed an octave above ignition) over Eadd9; big kick, crash' },
      { pos: P(7, 4), cue: 'heartbeat', what: 'The factory pulse returns under the ringing chord' },
    ],
  };
}
