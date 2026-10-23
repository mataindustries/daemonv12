// STILL HERE — A: PRECISION IGNITION. 120 BPM, 4/4, 6 bars of 2 s, A major (Mixolydian edge).
// Hook: the cable states A–E–A (tresillo 3+3+2), a talkbox answers C#–E–F# in the same rhythm.
// Positions are absolute sixteenths (pos 32 = bar 3 = 4.000 s = frame 176,400 = ignition).
import { SR, mtof, smooth, norm, split, shape, filt } from '../lib/dsp.mjs';
import { cable, curve } from '../lib/cable.mjs';
import { kick, snare, cableTom, cableTick, cableScrape } from '../lib/kit.mjs';
import { notesOf, notePoints, noteEvents, muteLane, grabGain, harmonicLanes, buzzLane, zapDisp, periodLane, roundTrips } from '../lib/perform.mjs';
import { talkbox, tine, sawStab, strikePlate, press, cablePluck, room, hp4, edges, peak } from '../src/instruments.mjs';
import { duckLane } from '../src/project.mjs';
import { grid } from '../src/timing.mjs';

export const g = grid(120);
const SECONDS = 12, N = SECONDS * SR;
const P = (bar, beat = 1, six = 0) => (bar - 1) * 16 + (beat - 1) * 4 + six;
const t = pos => g.sec(pos);
export const IGNITION = P(3), GASP = P(2, 4, 3), PAYOFF = P(6), FINAL = P(6, 3);

// ------------------------------------------------------------------ the hook
// statement (cable): A1 slap, E2, A1 + flageolet pop (sounds A2): 1–5–8 on 0, 3, 6
// answer (talkbox):  C#4, E4, F#4 (3–5–6) on 8, 11, 14
const A1 = 33, E2 = 40, D2 = 38, A2 = 45, F1 = 29, C2 = 36, G1 = 31, Cs2 = 37, Gs1 = 32;
const statement = (at, root, fifth, { amp = 1, kind = 'slap' } = {}) => [
  [at, root, kind, 3, { amp }], [at + 3, fifth, 'pluck', 3, { amp: 0.9 * amp }], [at + 6, root, 'pluck', 2, { amp: 0.85 * amp, pop: 2 }],
];

export function score(version = 'v1') {
  // V2, one purposeful revision: make the hook and the ignition read (REVIEW.md A1-A3)
  const V = { v1: {}, v2: { clearAnswer: true, physicalIntro: true, bigIgnition: true } }[version];
  if (!V) throw new Error(`unknown version ${version}`);

  // ---------------- cable bass: one Tempo String for the whole piece
  const BASS = [
    ...statement(P(1), A1, E2, V.physicalIntro ? { amp: 0.6 } : { amp: 0.55, kind: 'pluck' }),  // 0.0 s: dormant (V2: slap chirps)
    ...statement(P(2), A1, E2, { amp: 0.75 }),                           // 2.0 s: waking
    ...statement(P(3), A1, E2, { amp: 1.15 }),                           // 4.0 s: IGNITION
    ...(V.clearAnswer ? [] : [[P(3, 4, 2), A1, 'ghost', 1, { amp: 0.6 }]]), [P(3, 4, 3), Cs2, 'pluck', 1, { amp: V.clearAnswer ? 0.7 : 0.8 }],  // pickup C#→D
    ...statement(P(4), D2, A2, { amp: 1.05 }),
    ...(V.clearAnswer ? [] : [[P(4, 4, 2), D2, 'ghost', 1, { amp: 0.6 }]]), [P(4, 4, 3), E2, 'pluck', 1, { amp: V.clearAnswer ? 0.7 : 0.8 }],   // pickup E→F
    ...statement(P(5), F1, C2, { amp: 1.05 }),                           // ascent: ♭VI
    ...statement(P(5, 3), G1, D2, { amp: 1.1 }),                         //         ♭VII
    [P(5, 4, 3), Gs1, 'ghost', 1, { amp: 0.7 }],                          // G#→A
    ...statement(P(6), A1, E2, { amp: 1.2 }),                            // 10.0 s: payoff
    [FINAL, A1, 'slap', 6, { amp: 1.2 }],                                // 11.0 s: final
  ];
  const notes = notesOf(BASS);
  const grabs = [{ from: P(2, 3), to: IGNITION }, { from: P(6, 4, 2), to: P(7) }];
  const period = periodLane(notePoints(notes), 1 / mtof(A1));
  const mute = muteLane(notes, { from: 0, to: P(7), grabs }), grab = grabGain(grabs);
  const dark = V.physicalIntro ? t => (t < 1.95 ? 0.8 : t < 3.9 ? 0.9 : 1) : t => (t < 1.95 ? 0.55 : t < 3.9 ? 0.8 : 1);
  const introBright = V.physicalIntro ? [4200, 4800] : [2600, 3800];
  const bassRaw = cable({
    seconds: SECONDS, period, disp: zapDisp(-0.22, notes), gain: t => 0.992 * grab(t),
    bright: t => (t < 1.95 ? introBright[0] : t < 3.9 ? introBright[1] : 5200), damp: t => mute(t) * dark(t), drive: 2.4,
    buzz: buzzLane(notes, () => 0.05), ...harmonicLanes(notes), bow: 0, events: noteEvents(notes), stages: 160, seed: 31,
  }).out;
  const { lo, hi } = split(bassRaw, 110);
  const presence = filt(filt(shape(hi, v => 0.7 * Math.tanh(v) + 0.3 * Math.sin(v), 2.2), 'hp', 300, 0.7), 'peak', 1400, 0.9, 3);
  const body = filt(filt(hi.slice(), 'lp', 420, 0.7), 'hp', 95, 0.7);
  norm(lo); norm(presence); norm(body);
  const bassSub = hp4(Float64Array.from(lo, v => 0.95 * Math.tanh(1.2 * v)), 30);
  const bassTop = Float64Array.from(presence, (v, i) => 0.6 * v + 0.5 * body[i]);

  // ---------------- the spool-up: a second cable wound from an eighth-note round trip into A1
  const SPOOL0 = t(P(2, 3)), SPOOL1 = t(P(2, 4, 1)), CUT = t(GASP);           // 3.0, 3.625, 3.875 s
  const spoolPeriod = periodLane([{ t: SPOOL0, period: 0.25, glide: 0.001 }, { t: SPOOL0 + 0.002, period: 1 / mtof(A1), glide: SPOOL1 - SPOOL0, curve: 'ease' }], 0.25);
  const trips = roundTrips(spoolPeriod, SPOOL0, CUT);
  const spoolRaw = cable({
    seconds: SECONDS, period: spoolPeriod, disp: t => (t < SPOOL1 ? -0.88 + 0.66 * smooth((t - SPOOL0) / (SPOOL1 - SPOOL0)) : -0.22), stages: 160,
    gain: t => (t < SPOOL0 ? 0.6 : t < SPOOL0 + 0.6 ? 0.9 + 0.09 * smooth((t - SPOOL0) / 0.6) : 1.03), bright: t => 5200 + 2800 * smooth((t - SPOOL0) / 0.8),
    drive: 2.2, bow: t => smooth((t - SPOOL0 - 0.35) / 0.4), buzz: 0.2,
    events: [{ t: SPOOL0, kind: 'slap', hard: 1, amp: 1.1 }, ...trips.slice(1).map((tt, k) => ({ t: tt, kind: 'pluck', hard: 0.75, amp: 0.4 + 0.5 * k / trips.length, pos: 0.13 }))], seed: 37,
  }).out;
  // the hand grabs the cable: a 4 ms raised-cosine fade to exact zero at 3.875 s, held through 4.0 s
  const spool = hp4(spoolRaw.slice(), 35);
  const c0 = Math.round(CUT * SR), f4 = Math.round(0.004 * SR);
  for (let i = 0; i < N; i++) spool[i] *= i < Math.round(SPOOL0 * SR) ? 0 : i < c0 - f4 ? 1 : i < c0 ? 0.5 + 0.5 * Math.cos(Math.PI * (i - c0 + f4) / f4) : 0;

  // ---------------- talkbox answer (first heard at 5.0 s), and its harmony in the climb
  const cell = (at, midis, syls, { last = 0.3, vel = 1 } = {}) => midis.map((m, k) => ({ t: t(at + 3 * k), dur: k < 2 ? 0.3 : last, midi: m, syl: syls[k], vel }));
  const LEAD = [
    ...cell(P(3, 3), [61, 64, 66], ['wa', 'ow', 'yeah'], { last: V.clearAnswer ? 0.45 : 0.32 }),   // C#4 E4 F#4 over A (V2: the sixth rings)
    ...cell(P(4, 3), [66, 69, 71], ['wa', 'ow', 'yeah'], { last: V.clearAnswer ? 0.45 : 0.32 }),   // F#4 A4 B4 over D
    ...cell(P(5), [69, 72, 74], ['ya', 'oh', 'ah']),                                 // A4 C5 D5 over F (with the bass)
    ...cell(P(5, 3), [71, 74, 76], ['ya', 'oh', 'ah'], { last: 0.34 }),              // B4 D5 E5 over G
    ...cell(P(6), [73, 76, 78], ['ya', 'oh', 'ah'], { last: 0.24 }),                 // C#5 E5 F#5 over A
    { t: t(FINAL), dur: 0.72, midi: 81, syl: 'ah', vel: 1, vib: 22 },                // A5: the answer completed
  ];
  const HARM = [
    ...cell(P(5), [65, 69, 69], ['ya', 'oh', 'ah'], { vel: 0.8 }),                   // F4 A4 A4
    ...cell(P(5, 3), [67, 71, 71], ['ya', 'oh', 'ah'], { last: 0.34, vel: 0.8 }),    // G4 B4 B4
    ...cell(P(6), [69, 73, 74], ['ya', 'oh', 'ah'], { last: 0.24, vel: 0.8 }),       // A4 C#5 D5
    { t: t(FINAL), dur: 0.72, midi: 76, syl: 'ah', vel: 0.75, vib: 18 },             // E5 under A5
  ];
  const lead = talkbox({ seconds: SECONDS, notes: LEAD, seed: 3, size: 1.0 });
  const harm = talkbox({ seconds: SECONDS, notes: HARM, seed: 9, size: 1.08, width: 0.5 });
  const leadRoom = room(Float64Array.from(lead.L, (v, i) => v + 0.6 * harm.L[i]), Float64Array.from(lead.R, (v, i) => v + 0.6 * harm.R[i]), { rt60: 1.5, predelay: 0.025, seed: 7 });

  // ---------------- one-shots
  const kitKick = [
    { name: 'kick', pitch: 36, audio: kick({ f0: 50, lift: 14, decay: 0.28, hard: 0.85, beater: 10, drive: 2.2 }) },
    { name: 'kick-ignite', pitch: 35, audio: kick({ f0: 47, lift: 16, decay: 0.42, hard: 0.95, beater: 14, drive: 2.6, seed: 8 }) },
  ];
  const kitSnare = [
    { name: 'snare', pitch: 38, audio: snare({ f0: 190, decay: 0.22, wires: 0.18, crack: 0.4, crackMidi: 57, seed: 23 }) },
    { name: 'snare-big', pitch: 40, audio: snare({ f0: 176, decay: 0.34, wires: 0.28, crack: 0.8, crackMidi: 57, seed: 29 }) },
    { name: 'snare-roll', pitch: 37, audio: snare({ f0: 205, decay: 0.12, wires: 0.1, hard: 0.6, seed: 31 }) },
  ];
  const kitTicks = [
    ...[0, 1, 2, 3].map(k => ({ name: `tick-${k + 1}`, pitch: 42 + k, audio: cableTick({ midi: 98 + k, decay: 0.045, seed: 100 + k }) })),
    { name: 'scrape', pitch: 46 + 4, audio: cableScrape({ midi: 88, seconds: 0.08, seed: 13 }) },
  ];
  const plate = strikePlate({ seconds: 2.4, seed: 9, base: 360, ring: 1.6 });
  const kitMetal = [
    { name: 'crash', pitch: 49, audio: plate },
    ...[[43, 'tom-g'], [45, 'tom-a'], [47, 'tom-b'], [49, 'tom-cs']].map(([m, name], k) => ({ name, pitch: 60 + k, audio: cableTom(m, { seed: 41 + k }) })),
  ];
  const kitPress = [
    { name: 'press', pitch: 60, audio: press({ seed: 3, tune: 110 }) },
    { name: 'lock', pitch: 61, audio: press({ seed: 5, tune: 220, thump: 0.25, plate: 0.8 }) },
  ];
  const chord = { A: [45, 52, 57, 61, 64], D: [50, 54, 57, 62, 66], F: [41, 48, 53, 57, 60], G: [43, 50, 55, 59, 62], Afin: [45, 52, 57, 61, 64, 71] };
  const kitStabs = [
    { name: 'a-big', pitch: 57, audio: sawStab(chord.A, { seconds: 0.95, decay: 0.32, sustain: 0.28, seed: 1 }) },
    V.clearAnswer ? { name: 'd', pitch: 62, audio: sawStab(chord.D, { seconds: 0.95, decay: 0.3, sustain: 0.3, seed: 2 }) }
      : { name: 'd-push', pitch: 62, audio: sawStab(chord.D, { seconds: 0.5, decay: 0.16, sustain: 0.2, seed: 2 }) },
    { name: 'f', pitch: 65, audio: sawStab(chord.F, { seconds: 0.95, decay: 0.3, sustain: 0.3, seed: 3 }) },
    { name: 'g', pitch: 67, audio: sawStab(chord.G, { seconds: 0.95, decay: 0.3, sustain: 0.3, seed: 4 }) },
    { name: 'a-final', pitch: 69, audio: sawStab(chord.Afin, { seconds: 1.2, decay: 0.45, sustain: 0.3, release: 0.25, cutoff: [5200, 1300], seed: 5 }) },
  ];
  // arpeggio: cable plucks an octave above the voice, outlining each chord (enters at 6.0 s)
  const arpChord = { D: [74, 78, 81, 86], F: [77, 81, 84, 89], G: [79, 83, 86, 91], A: [81, 85, 88, 93] };
  const arpPitches = [...new Set(Object.values(arpChord).flat())].sort((a, b) => a - b);
  const kitArp = arpPitches.map(m => ({ name: `p${m}`, pitch: m, audio: cablePluck(m, { seed: 200 + m }) }));
  const glassPitches = [73, 76, 78, 81, 88];
  const kitGlass = glassPitches.map(m => ({ name: `g${m}`, pitch: m, audio: tine(m, { decay: m >= 81 ? 1.6 : 0.4, seed: 300 + m }) }));

  // ---------------- patterns
  const kicks = [], snares = [], ticks = [], metal = [], presses = [], stabs = [], arp = [], glass = [];
  for (let p = IGNITION; p < FINAL; p += 4) kicks.push({ pos: p, hit: p === IGNITION || p === PAYOFF ? 'kick-ignite' : 'kick', vel: p === IGNITION || p === PAYOFF ? 1 : 0.88 });
  kicks.push({ pos: P(5, 4, 2), hit: 'kick', vel: 0.62 }, { pos: FINAL, hit: 'kick-ignite', vel: 0.95 });
  for (const b of [3, 4, 5]) for (const beat of [2, 4]) snares.push({ pos: P(b, beat), hit: 'snare', vel: 0.9 });
  for (let k = 0; k < 7; k++) snares.push({ pos: P(5, 3, 0) + k, hit: 'snare-roll', vel: 0.25 + 0.5 * k / 6 });   // the climb's roll
  snares.push({ pos: P(6, 2), hit: 'snare', vel: 0.9 }, { pos: FINAL, hit: 'snare-big', vel: 0.95 });
  // precision ticks: 16ths, accents on the hook's 3+3+2; quiet before ignition; they ratchet with the spool
  const accent = s => [0, 3, 6, 8, 11, 14].includes(s % 16);
  for (let p = 0; p < P(6, 4, 2); p++) {
    if (p >= P(2, 3) && p < IGNITION) continue;
    const pre = p < IGNITION, end = p >= FINAL;
    const v = (accent(p) ? 0.85 : 0.42) * (pre ? (V.physicalIntro ? 1 : 0.55) : end ? 0.6 - 0.35 * (p - FINAL) / 6 : 1);
    ticks.push({ pos: p, hit: `tick-${(p % 4) + 1}`, vel: v });
  }
  // each ratchet tick is sliced (endSeconds) so nothing rings into the breath at 3.875 s
  for (const [k, tt] of trips.entries()) if (tt < CUT - 0.012 && k > 0) ticks.push({ pos: null, sec: tt, hit: `tick-${(k % 4) + 1}`, vel: Math.min(0.9, 0.35 + 0.05 * k),
    endSeconds: Math.round(Math.min(0.11, CUT - tt - 0.006) * 1e6) / 1e6, envelope: { attackSeconds: 0, releaseSeconds: 0.003 } });
  for (let p = IGNITION + 2; p < FINAL; p += 4) ticks.push({ pos: p, hit: 'scrape', vel: 0.55 });
  const crashes = [{ pos: IGNITION, hit: 'crash', vel: 0.9 }, { pos: PAYOFF, hit: 'crash', vel: 0.85 }, { pos: FINAL, hit: 'crash', vel: 0.8 }];
  if (!V.bigIgnition) metal.push(...crashes);
  for (const [k, name] of ['tom-g', 'tom-a', 'tom-b', 'tom-cs'].entries()) metal.push({ pos: P(5, 3) + 2 * k, hit: name, vel: 0.55 + 0.1 * k });
  for (const b of [0, 4, 8]) presses.push({ pos: b * 2, hit: 'press', vel: 0.8 + 0.05 * b / 4, gate: '1/4', envelope: { attackSeconds: 0.0005, releaseSeconds: 0.12 } });
  presses.push({ pos: P(2, 3), hit: 'press', vel: 0.95, gate: '1/16', envelope: { attackSeconds: 0.0005, releaseSeconds: 0.08 } });
  presses.push({ pos: P(6, 4, 3), hit: 'lock', vel: 0.7 });
  stabs.push({ pos: IGNITION, hit: 'a-big', vel: V.bigIgnition ? 1 : 0.95 }, V.clearAnswer ? { pos: P(4), hit: 'd', vel: 0.75 } : { pos: P(3, 4, 2), hit: 'd-push', vel: 0.6 }, { pos: P(5), hit: 'f', vel: 0.8 },
    { pos: P(5, 3), hit: 'g', vel: 0.85 }, { pos: PAYOFF, hit: 'a-big', vel: 0.95 }, { pos: FINAL, hit: 'a-final', vel: 0.9 });
  const arpOrder = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3];
  const chordAt = p => (p < P(4) ? 'A' : p < P(5) ? 'D' : p < P(5, 3) ? 'F' : p < P(6) ? 'G' : 'A');
  // V2: the precision arpeggio starts AT ignition (accents only in bar 3), so the high register opens at 4.0 s
  for (let p = V.bigIgnition ? IGNITION : P(4); p < FINAL; p++) {
    if (p < P(4) && !accent(p)) continue;
    const notesC = arpChord[chordAt(p)], m = notesC[arpOrder[p % 16]];
    const ramp = p < P(4) ? 0.55 : p < P(5) ? 0.45 + 0.2 * (p - P(4)) / 16 : p < P(6) ? 0.6 + 0.3 * (p - P(5)) / 16 : 0.85;
    arp.push({ pos: p, hit: `p${m}`, vel: (accent(p) ? 1 : 0.7) * ramp, gate: '1/16', envelope: { attackSeconds: 0.0005, releaseSeconds: 0.04 } });
  }
  // the intro's tiny robot answer: C#5 E5 F#5 in the answer rhythm at 1.0 s; a final sparkle on A
  glass.push({ pos: P(1, 3), hit: 'g73', vel: 0.55 }, { pos: P(1, 3, 3), hit: 'g76', vel: 0.6 }, { pos: P(1, 4, 2), hit: 'g78', vel: 0.65 });
  glass.push({ pos: FINAL, hit: 'g81', vel: 0.6 }, { pos: FINAL, hit: 'g88', vel: 0.45 });

  // ticks placed by seconds (spool ratchet) need a grid position: snap to the 960-PPQ grid (1 tick = 0.52 ms)
  const snapped = ticks.map(n => n.pos !== null ? n : { ...n, pos: Math.round(n.sec * 120 / 60 * 960) / 240 });
  for (const n of snapped) delete n.sec;

  // ---------------- mix (absolute dB; automation replaces static gain)
  const kickTimes = kicks.map(k => t(k.pos));
  const tracks = [
    { id: 'press', description: 'The dormant press: MORPH household clank tuned to A2 over a membrane thump; one per second, then the 11.75 s lock.', kit: kitPress, notes: presses, mix: { gainDb: -7 } },
    { id: 'kick', description: 'MORPH//04 membrane kick: four on the floor from ignition; bigger hits at 4.0, 10.0 and 11.0 s.', kit: kitKick, notes: kicks, mix: { gainDb: -4 } },
    { id: 'snare', description: 'MORPH//04 membrane snare with a cable crack tuned to A3; the climb roll.', kit: kitSnare, notes: snares, mix: { gainDb: -8 }, effects: [{ type: 'reverb', roomSize: 0.35, decaySeconds: 0.9, wet: 0.12 }] },
    { id: 'ticks', description: 'Cable ticks in 16ths accenting the 3+3+2 hook rhythm; the ratchet follows the spool; cable scrape off-beats.', kit: kitTicks, notes: snapped, mix: V.physicalIntro ? { gainDb: -12, pan: 0.3 } : { gainDb: -15, pan: 0.15 } },
    { id: 'metal', description: V.bigIgnition ? 'Cable toms climbing G-A-B-C# into the payoff.' : 'Struck steel plate (crash) at ignition, payoff and final; cable toms climbing G-A-B-C# into the payoff.',
      kit: V.bigIgnition ? kitMetal.filter(k => k.name !== 'crash') : kitMetal, notes: metal, mix: { gainDb: -11 } },
    ...(V.bigIgnition ? [{ id: 'crash', description: 'Struck steel plate (stereo: different modes per side) at ignition, payoff and final, on its own track.',
      kit: [kitMetal.find(k => k.name === 'crash')], notes: crashes, mix: { gainDb: -5 } }] : []),
    { id: 'bass', description: 'EXTERNAL: the Tempo String bass performance above 110 Hz (driven presence + body).', sample: bassTop, notes: [{ pos: 0, vel: 1 }], mix: { gainDb: -6 } },
    { id: 'bass-sub', description: 'EXTERNAL: the same performance below 110 Hz; authored gain ducks it under every kick.', sample: bassSub, notes: [{ pos: 0, vel: 1 }],
      mix: { gainDb: -7 }, automation: { gainDb: duckLane(-7, kickTimes, { depth: 9, recover: 0.12 }) } },
    { id: 'spool', description: 'EXTERNAL: a second cable wound from an eighth-note round trip into A1 (3.0-3.875 s), then grabbed to exact silence.', sample: spool, notes: [{ pos: 0, vel: 1 }], mix: { gainDb: -8 } },
    { id: 'lead', description: 'EXTERNAL: the talkbox answer, a saw driving the MORPH Kelly-Lochbaum throat (wa-ow-yeah).', sample: [lead.L, lead.R], notes: [{ pos: 0, vel: 1 }], mix: { gainDb: V.clearAnswer ? -4 : -6 },
      ...(V.clearAnswer ? { automation: { gainDb: [{ at: { seconds: 0 }, value: -2.5 }, { at: { seconds: 7.98 }, value: -2.5, transition: 'linear' }, { at: { seconds: 8.0 }, value: -4 }] } } : {}),
      effects: [{ type: 'delay', timeMs: 375, wet: 0.14 }] },
    { id: 'lead-harm', description: 'EXTERNAL: the talkbox harmony in the climb and payoff.', sample: [harm.L, harm.R], notes: [{ pos: 0, vel: 1 }], mix: { gainDb: -12 } },
    { id: 'lead-room', description: 'EXTERNAL: MORPH FDN room return of lead + harmony.', sample: [leadRoom.L, leadRoom.R], notes: [{ pos: 0, vel: 1 }], mix: { gainDb: -14 } },
    { id: 'stabs', description: 'Saw-ensemble brass stabs: A at ignition, D push, F and G in the climb, A payoff, A(add9) final.', kit: kitStabs, notes: stabs,
      mix: { gainDb: -13 }, automation: { gainDb: duckLane(-13, kickTimes.filter(x => x > 4.3), { depth: 5, recover: 0.15 }) } },
    { id: 'arp', description: V.bigIgnition ? 'Cable-pluck arpeggio, an octave above the voice (precision components): accents from ignition, 16ths from 6.0 s.' : 'Cable-pluck arpeggio in 16ths, an octave above the voice (precision components), from 6.0 s.', kit: kitArp, notes: arp, mix: { gainDb: -21, pan: V.bigIgnition ? -0.45 : -0.2 },
      effects: [{ type: 'delay', timeMs: 250, wet: 0.2 }] },
    { id: 'glass', description: 'Glass tines: the robot answer at 1.0 s and the final sparkle.', kit: kitGlass, notes: glass, mix: { gainDb: -12, pan: V.bigIgnition ? 0.4 : 0.25 },
      effects: [{ type: 'reverb', roomSize: 0.7, decaySeconds: 1.4, wet: 0.3 }] },
  ];
  // the breath before ignition is exact digital silence in every external stem
  for (const tr of tracks) if (tr.sample) gapZero(tr.sample, CUT, t(IGNITION));
  return {
    name: `still-here-a-${version}`, title: `STILL HERE A: PRECISION IGNITION (${version.toUpperCase()})`,
    description: 'A 12-second aerospace spec score. 120 BPM in A: a Tempo String statement answered by a talkbox in the same 3+3+2 rhythm; the cable spools up, the factory breathes for 125 ms, and ignition lands on 4.000 s (frame 176,400).',
    bpm: 120, bars: 6, key: 'A major', seed: 1, grid: g,
    master: { gainDb: 0, effects: [{ type: 'highpass', frequencyHz: 24 }, { type: 'compressor', thresholdDb: -14, ratio: 2, attackMs: 15, releaseMs: 120 }] },
    tracks,
    // the breath: exact digital silence before ignition, also after the external master stage
    silence: [{ from: CUT, to: t(IGNITION), fade: 0.004 }],
    cues: [
      { pos: 0, cue: 'statement (dormant)', what: V.physicalIntro ? 'Press thump + dark slapped cable A1-E2-A2 (chirps); precision ticks in 3+3+2' : 'Press thump + palm-muted cable A1-E2-A2' },
      { pos: P(1, 3), cue: 'robot answer', what: 'Glass C#5-E5-F#5 in the answer rhythm' },
      { pos: P(2), cue: 'statement (waking)', what: 'Brighter cable statement' },
      { pos: P(2, 3), cue: 'spool-up', what: 'Cable wound from eighth-note round trips into A1; ticks ratchet with it' },
      { pos: GASP, cue: 'breath', what: 'Exact silence 3.875-4.000 s' },
      { pos: IGNITION, cue: 'IGNITION', what: V.bigIgnition ? 'Kick + cable slap A1 + crash plate + A stab; groove and arpeggio accents start' : 'Kick + cable slap A1 + crash plate + A stab; groove starts' },
      { pos: P(3, 3), cue: 'first answer', what: V.clearAnswer ? 'Talkbox C#4-E4-F#4; the F#4 rings over the bar line' : 'Talkbox C#4-E4-F#4' },
      { pos: P(4), cue: 'IV', what: V.bigIgnition ? 'D stab; statement on D, answer F#4-A4-B4; arpeggio in full 16ths' : 'Statement on D, answer F#4-A4-B4; arpeggio enters' },
      { pos: P(5), cue: 'ASCENT', what: 'bVI-bVII: bass and voice in rhythmic unison, A4-C5-D5 / B4-D5-E5; roll and toms climb' },
      { pos: PAYOFF, cue: 'BREAKTHROUGH', what: 'C#5-E5-F#5 over A' },
      { pos: FINAL, cue: 'answer completed', what: 'F#5 resolves to A5; A(add9) final hit, crash' },
      { pos: P(6, 4, 3), cue: 'lock', what: 'Servo lock click; ring-out to 12.0 s' },
    ],
  };
}

function gapZero(audio, from, to) {
  const chs = Array.isArray(audio) ? audio : [audio];
  for (const x of chs) for (let i = Math.round(from * SR); i < Math.min(x.length, Math.round(to * SR)); i++) x[i] = 0;
}
