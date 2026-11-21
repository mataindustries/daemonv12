/**
 * BLACKOUT//ENGINE · DaemonV12 Sound Lab 02. Industrial hip-hop, 128 BPM, G minor, 16 bars = exactly 30.000 s.
 *
 * One idea: the machine's riff is a lament in disguise. The Living Bass strikes G three times, leaps an octave and
 * ratchets down the chromatic stair G-F#-F-E-Eb-D (gear teeth clicking, a servo overshooting). When the power fails, a
 * lone voice sings that same stair slowly in the dark. When the power returns the engine coughs back to life, warm to
 * machine, in the riff's own rhythm, and catches the voice in its gears; the voice sings the stair with the bass but
 * is never allowed the last step. The engine blacks out again on its own octave scream, and only in the dark does the
 * voice finish the phrase: Eb -> D, a sigh on the dominant.
 *
 * This file is the single source of truth. It writes, into source/:
 *   blackout-engine.rack.json     Signature Rack + Timbre Lab score (bass, voice, clock, log, spring, bearings, gong)
 *   blackout-engine.project.json  DaemonV12 v0.7 project: rack stems + kit one-shots, mix, automation, master
 *   kick-kit.json, snare-kit.json, anvil-kit.json, breaker-kit.json
 * build.ts renders the rack score, the one-shots (ONE_SHOTS, with the rack's `kit` command) and the project.
 *
 *   node experiments/blackout-engine-001/compose.ts
 *
 * Times are beats (quarter notes) from the start of bar 1; a bar is 4 beats; the piece is 64 beats = 30 s.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/** The one bounded QA/fix pass (README). BLACKOUT_ENGINE_PRE_QA=1 reproduces the candidate exactly as measured before it. */
export const PRE_QA = process.env.BLACKOUT_ENGINE_PRE_QA === '1';
export const BPM = 128, BARS = 16, END = BARS * 4;
export const BEAT_SECONDS = 60 / BPM;

// ------------------------------------------------------------------------------------------------ helpers
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** Engine position (960 PPQ, 4/4) of an absolute beat: "BAR:BEAT" or "BAR:BEAT+N/D" (N/D of a whole note). */
export function pos(beat: number): string {
  const tick = Math.round(beat * 960), bar = Math.floor(tick / 3840) + 1, inBar = tick % 3840, b = Math.floor(inBar / 960) + 1, off = inBar % 960;
  if (!off) return `${bar}:${b}`;
  const g = gcd(off, 3840);
  return `${bar}:${b}+${off / g}/${3840 / g}`;
}
/** Engine duration ("N/D" of a whole note) of a length in beats. */
export function dur(beats: number): string {
  const t = Math.round(beats * 960), g = gcd(t, 3840);
  return `${t / g}/${3840 / g}`;
}
const semis = (n: number) => r6(Math.pow(2, n / 12));
/** Seconds -> beats (for millisecond offsets such as the breaker's two contacts). */
const ms = (m: number) => m / 1000 / BEAT_SECONDS;
type Opts = Record<string, string | number>;
type RackNote = [number, number, string, number, Opts?];
const rn = (beat: number, beats: number, pitch: string, vel: number, o?: Opts): RackNote => (o ? [r6(beat), r6(beats), pitch, r6(vel), o] : [r6(beat), r6(beats), pitch, r6(vel)]);
type Curve = [number, number][];

// ------------------------------------------------------------------------------------------------ form
// Landmarks (beats). The two blackouts land where the riff's octave scream and the snare should be (beat 3 of the bar).
export const BLACKOUT_1 = 30;   // bar 8 beat 3, 0:14.06
export const COLD_START = 40;   // bar 11, 0:18.75
export const RETURN = 48;       // bar 13, 0:22.50
export const BLACKOUT_2 = 62;   // bar 16 beat 3, 0:29.06
export const SECTIONS = [
  { id: 'ignition', bars: 2, development: 'The riff at once, already a machine: three G strokes, the octave scream, the ratchet stair. Kick, snare, bass only.' },
  { id: 'engine-room', bars: 4, development: 'The engine room joins: clock escapement, anvil taps, wood knocks, a spring recoil after each hammer. The bass heats up.' },
  { id: 'brownout', bars: 2, development: 'Bar 7 misfires (a stroke and the hammer missing, a spring snaps instead). Bar 8 the strokes weaken; on beat 3 the breaker trips.' },
  { id: 'dark', bars: 2, development: 'Silence and a ringing room. A breath. One human voice sings the stair slowly. Hot metal ticks as it cools.' },
  { id: 'cold-start', bars: 2, development: 'The engine coughs warm in the riff rhythm, chopping the held note; stroke by stroke it heats up and the stair returns in unison.' },
  { id: 'in-the-gears', bars: 4, development: 'Full machine, the voice gated into the riff and pushed toward impossible, never allowed the D. Second blackout on the scream; the voice sighs Eb-D alone.' },
];

// ------------------------------------------------------------------------------------------------ the riff (Living Bass)
// Bar A ("the engine"): G1 strokes on 1, the a-of-1, the and-of-2 (3+3+2 sixteenths); the octave scream G2 on beat 3
// (with the snare) ratchets down to D2 in one servo glide; D2 growls and cuts off, leaving a hole before Ab1 (the
// Phrygian b2) as the pickup. Calibration: the first render's strokes nearly touched (4-10 dB dips) and smeared the
// 3+3+2, so the strokes are short and the D2 stops early: space is the weight. Bar B ("the fall"): two strokes, the scream earlier (the and-of-2), then the stair
// written out on eighths, F#2 F2 E2 Eb2, and D2 as a sixteenth pickup: V -> i into every second downbeat.
export interface RiffOpts { v?: number; scoop?: number; glide?: number; missing?: number[]; }
function riffA(c: number, o: RiffOpts = {}): RackNote[] {
  const v = o.v ?? 1, miss = new Set(o.missing ?? []);
  const notes: RackNote[] = [];
  if (!miss.has(0)) notes.push(rn(c, 0.55, 'G1', 0.95 * v, { articulation: 'accent', scoop: o.scoop ?? 4 }));
  if (!miss.has(0.75)) notes.push(rn(c + 0.75, 0.45, 'G1', 0.86 * v));
  if (!miss.has(1.5)) notes.push(rn(c + 1.5, 0.35, 'G1', 0.8 * v));
  notes.push(rn(c + 2, 0.3, 'G2', 0.98 * v, { articulation: 'accent' }));
  notes.push(rn(c + 2.3, 0.8, 'D2', 0.92 * v, { articulation: 'legato', slide: o.glide ?? 0.5 }));
  if (!miss.has(3.5)) notes.push(rn(c + 3.5, 0.45, 'Ab1', 0.88 * v));
  return notes;
}
function riffB(c: number, o: RiffOpts = {}): RackNote[] {
  const v = o.v ?? 1;
  return [
    rn(c, 0.55, 'G1', 0.95 * v, { articulation: 'accent', scoop: o.scoop ?? 4 }),
    rn(c + 0.75, 0.45, 'G1', 0.86 * v),
    rn(c + 1.5, 0.5, 'G2', 0.98 * v, { articulation: 'accent' }),
    rn(c + 2, 0.5, 'F#2', 0.9 * v, { articulation: 'legato', slide: 0.06 }),
    rn(c + 2.5, 0.5, 'F2', 0.88 * v, { articulation: 'legato', slide: 0.06 }),
    rn(c + 3, 0.5, 'E2', 0.88 * v, { articulation: 'legato', slide: 0.06 }),
    rn(c + 3.5, 0.25, 'Eb2', 0.88 * v, { articulation: 'legato', slide: 0.06 }),
    rn(c + 3.75, 0.25, 'D2', 0.9 * v, { articulation: 'legato', slide: 0.06 }),
  ];
}
const bassNotes: RackNote[] = [
  ...riffA(0, { scoop: 7 }), ...riffB(4),                       // ignition: the first stroke growls up from a fifth below
  ...riffA(8), ...riffB(12), ...riffA(16, { glide: 0.6 }), ...riffB(20),
  ...riffA(24, { missing: [1.5], glide: 0.8 }),                 // bar 7: the third stroke misfires; the glide alone in the hole
  // bar 8: three strokes, each weaker and warmer (the macro sags below); the scream never comes: the breaker trips at 30
  rn(28, 0.55, 'G1', 0.95, { articulation: 'accent', scoop: 3 }), rn(28.75, 0.45, 'G1', 0.8), rn(29.5, 0.35, 'G1', 0.66),
  // bar 11, cold start: the same bar A, warm and soft (no ratchet: the scream's descent is a finger slide), stroke by stroke hotter
  rn(40, 0.5, 'G1', 0.62, { scoop: 1 }), rn(40.75, 0.45, 'G1', 0.66), rn(41.5, 0.35, 'G1', 0.72),
  rn(42, 0.3, 'G2', 0.8), rn(42.3, 0.8, 'D2', 0.78, { articulation: 'legato', slide: 0.9 }), rn(43.5, 0.45, 'Ab1', 0.8),
  // bar 12: bar B catches (the stair returns, in unison with the voice)
  ...riffB(44, { v: 0.97, scoop: 3 }),
  // in the gears: the hottest statement, the first stroke growls up from a fifth below again
  ...riffA(48, { scoop: 7, glide: 0.6 }), ...riffB(52), ...riffA(56, { glide: 0.7 }),
  // bar 16: two strokes and the scream; the breaker trips under it at 62
  rn(60, 0.55, 'G1', 0.97, { articulation: 'accent', scoop: 4 }), rn(60.75, 0.45, 'G1', 0.88), rn(61.5, 0.5, 'G2', 1, { articulation: 'accent' }),
];
/** warm -> machine is the engine's power: 0.82 at ignition, 0.97 by bar 6, sagging in bar 8, warm at the cold start, 1 in the gears. */
const bassMacro: { steps: Curve; glide: number } = {
  steps: [
    [0, 0.82], [8, 0.86], [12, 0.9], [16, 0.93], [20, 0.96], [24, 0.97],
    [28, 0.9], [28.75, 0.66], [29.5, 0.42],                             // brownout: each stroke warmer
    [40, 0.04], [40.75, 0.12], [41.5, 0.2], [42, 0.3], [43.5, 0.42],   // cold start, stroke by stroke
    [44, 0.52], [44.75, 0.62], [45.5, 0.72], [46, 0.82], [47, 0.9],
    [48, 1],
  ],
  glide: 0.04,
};
/** Motion lane: steady strokes; triplet motion on the D2 growl after each glide (a texture: the folding is saturated, so it
 * ripples about 3 dB in 1-4 kHz rather than stuttering); a 64th growl on it in the gears. */
function bassMotion() {
  const spans: { fromBeat: number; toBeat: number; preset: string }[] = [];
  let at = 0;
  const add = (to: number, preset: string) => { if (to > at) { spans.push({ fromBeat: at, toBeat: to, preset }); at = to; } };
  for (const c of [0, 8, 16, 24]) { add(c + 2.3, 'none'); add(c + 3.5, 'triplets'); }
  add(48 + 2.3, 'none'); add(48 + 3.5, 'growl'); add(56 + 2.3, 'none'); add(56 + 3.5, 'growl');
  add(END, 'none');
  return spans;
}

// ------------------------------------------------------------------------------------------------ the voice (Impossible Voice)
// One singer for the whole piece. In the dark (human end): a breath, a low hum, the octave cry, the stair descending one
// sigh per beat, Eb held and unresolved. Cold start: the held Eb is chopped by the engine (see VOICE_GATE). In the gears
// the voice follows the riff two octaves up and is gated into its rhythm: G4 strokes and a cry on the scream, the stair
// in bar B; the gate is always shut when the bass reaches D. Coda: after the second blackout, Eb -> D, alone.
const voiceNotes: RackNote[] = [
  rn(31.5, 0.5, 'G3', 0.48, { articulation: 'hum', vowel: 'mm' }),
  rn(32, 2, 'G4', 0.8, { articulation: 'cry', cry: 1.5, vowel: 'ah' }),
  rn(34, 1, 'F#4', 0.74, { articulation: 'legato', vowel: 'ah' }),
  rn(35, 1, 'F4', 0.72, { articulation: 'legato', vowel: 'ah', to: 'oh' }),
  rn(36, 1.5, 'E4', 0.7, { articulation: 'legato', vowel: 'oh' }),
  rn(37.5, 5, 'Eb4', 0.68, { articulation: 'legato', vowel: 'oh', to: 'oo' }),
  // bar 12: the stair with the bass (G4 strokes, cry on the scream, F# F E Eb)
  rn(44, 1.5, 'G4', 0.78, { articulation: 'cry', cry: 1.2, vowel: 'ah' }),
  rn(45.5, 0.5, 'G4', 0.82, { articulation: 'cry', cry: 2, vowel: 'ah' }),
  rn(46, 0.5, 'F#4', 0.78, { articulation: 'legato', vowel: 'ah' }), rn(46.5, 0.5, 'F4', 0.76, { articulation: 'legato', vowel: 'oh' }),
  rn(47, 0.5, 'E4', 0.76, { articulation: 'legato', vowel: 'ah' }), rn(47.5, 0.5, 'Eb4', 0.74, { articulation: 'legato', vowel: 'oh' }),
];
/** In the gears: bar A = G4 strokes, a cry on the scream, the voice sliding down with the glide (gated off before D). */
function voiceA(c: number): RackNote[] {
  return [
    rn(c, 2, 'G4', 0.8, { articulation: 'cry', cry: 1.2, vowel: 'ah' }),
    rn(c + 2, 0.3, 'G4', 0.86, { articulation: 'cry', cry: 2.5, vowel: 'ah' }),
    rn(c + 2.3, 1.2, 'Eb4', 0.74, { articulation: 'legato', slide: 0.4, vowel: 'oh' }),
  ];
}
function voiceB(c: number): RackNote[] {
  return [
    rn(c, 1.5, 'G4', 0.8, { articulation: 'cry', cry: 1.2, vowel: 'ah' }),
    rn(c + 1.5, 0.5, 'G4', 0.86, { articulation: 'cry', cry: 2, vowel: 'ah' }),
    rn(c + 2, 0.5, 'F#4', 0.8, { articulation: 'legato', vowel: 'ah' }), rn(c + 2.5, 0.5, 'F4', 0.78, { articulation: 'legato', vowel: 'oh' }),
    rn(c + 3, 0.5, 'E4', 0.78, { articulation: 'legato', vowel: 'ah' }), rn(c + 3.5, 0.5, 'Eb4', 0.76, { articulation: 'legato', vowel: 'oh' }),
  ];
}
voiceNotes.push(...voiceA(48), ...voiceB(52), ...voiceA(56),
  rn(60, 1.5, 'G4', 0.82, { articulation: 'cry', cry: 1.2, vowel: 'ah' }), rn(61.5, 0.5, 'G4', 0.9, { articulation: 'cry', cry: 2.5, vowel: 'ah' }),
  // coda, in the dark again: the sigh the machine never allowed
  rn(62.3, 0.6, 'Eb4', 0.62, { vowel: 'oh', scoop: 0.3 }), rn(62.9, 0.95, 'D4', 0.56, { articulation: 'legato', slide: 0.25, vowel: 'oh', to: 'mm' }));
/** human -> impossible is the voice being taken by the machine: human in the dark, impossible in the gears, human again at the end. */
const voiceMacro: { steps: Curve; glide: number } = {
  steps: [[0, 0.03], [40, 0.08], [41.5, 0.16], [43, 0.24], [44, 0.32], [46, 0.4], [48, 0.5], [52, 0.6], [56, 0.7], [60, 0.78], [62, 0.03]],
  glide: 0.3,
};

// ------------------------------------------------------------------------------------------------ the engine room (Mechanical Orchestra, Hollow Log)
// Each part is one moving piece of the same machine, with one job: the clock is the escapement (ticks on the off-beat
// eighths, tocks on 2 and 4, never on 1 or the hammer); the anvil is tapped right before the hammer; a spring recoils
// after the hammer; wood knocks in the holes. Nothing runs in sixteenths.
const clockNotes: RackNote[] = [];
const clockBar = (c: number, v = 1) => {
  for (const [b, art, vel] of [[0.5, 'tick', 0.46], [1, 'tock', 0.6], [1.5, 'tick', 0.4], [2.5, 'tick', 0.46], [3, 'tock', 0.6], [3.5, 'tick', 0.4]] as const)
    clockNotes.push(rn(c + b, 0.25, art === 'tick' ? 'D6' : 'G5', vel * v, { articulation: art }));
};
for (const c of [8, 12, 16, 20, 24]) clockBar(c);
clockNotes.push(rn(28.5, 0.25, 'D6', 0.36, { articulation: 'tick' }), rn(29, 0.25, 'G5', 0.44, { articulation: 'tock' }), rn(29.5, 0.25, 'D6', 0.28, { articulation: 'tick' }));
// cold start: the escapement restarts, hesitating
clockNotes.push(rn(41, 0.25, 'G5', 0.36, { articulation: 'tock' }), rn(42.5, 0.25, 'D6', 0.34, { articulation: 'tick' }), rn(43, 0.25, 'G5', 0.46, { articulation: 'tock' }), rn(43.5, 0.25, 'D6', 0.4, { articulation: 'tick' }));
for (const c of [44, 48, 52, 56]) clockBar(c, c === 44 ? 0.9 : 1.06);
clockNotes.push(rn(60.5, 0.25, 'D6', 0.5, { articulation: 'tick' }), rn(61, 0.25, 'G5', 0.62, { articulation: 'tock' }), rn(61.5, 0.25, 'D6', 0.44, { articulation: 'tick' }));

const logNotes: RackNote[] = [];
for (const c of [16, 48, 56]) logNotes.push(rn(c + 1.25, 0.25, 'D4', 0.34, { articulation: 'knuckle' }), rn(c + 2.75, 0.25, 'G4', 0.3, { articulation: 'rim' }));
for (const c of [20, 44, 52]) logNotes.push(rn(c + 1.25, 0.25, 'D4', 0.34, { articulation: 'knuckle' }), rn(c + 3.25, 0.25, 'D4', 0.3, { articulation: 'knuckle' }));
// in the gears the ratchet glide is doubled by a stick dragged across the log's ridges
for (const c of [48, 56]) logNotes.push(rn(c + 2.3, 0.32, 'G4', 0.5, { articulation: 'scrape' }));

const springNotes: RackNote[] = [];
for (const c of [8, 16, 48, 56]) springNotes.push(rn(c + 2.25, 0.5, 'D3', 0.55, { articulation: 'damped' }));
springNotes.push(rn(26, 1.5, 'G2', 0.62, { articulation: 'laser' }));  // bar 7: the hammer misfires, a spring snaps instead
springNotes.push(rn(54.25, 0.5, 'D3', 0.5, { articulation: 'damped' }));

// cooling metal in the dark: sparse, slowing, softer
const bearingNotes: RackNote[] = [[30.45, 'G6', 0.55], [31.2, 'D7', 0.42], [32.75, 'Bb6', 0.45], [34.35, 'G6', 0.36], [35.9, 'D7', 0.3], [37.8, 'Bb6', 0.28], [39.4, 'G6', 0.22], [41.2, 'D6', 0.18]]
  .map(([b, p, v]) => rn(b as number, 0.25, p as string, v as number, { articulation: 'ping' }));

// ------------------------------------------------------------------------------------------------ rack score
export const rackScore = {
  schema: 'daemonv12.signature-rack.score/1',
  title: 'BLACKOUT//ENGINE',
  description: 'DaemonV12 Sound Lab 02: 16 bars of industrial hip-hop, 128 BPM, G minor. Rack and Timbre Lab parts; kick, snare, anvil, breaker and mix in the engine project.',
  bpm: BPM, key: 'G minor', swing: 0.5, seed: 1280, tailSeconds: 0.5, masterGainDb: 0,
  sections: SECTIONS,
  room: { rt60: 2.1, size: 1.35, damp: 4800, predelayMs: 28, lowCut: 260 },
  parts: [
    {
      id: 'bass', instrument: 'living-bass', gainDb: 0, pan: 0, room: 0.02,
      setup: { seed: 1201 },
      macro: bassMacro,
      expression: [[0, 0.8], [39.9, 0.8], [40, 0.55], [44, 0.68], [48, 0.84], [END, 0.84]],
      controls: {
        // ratchet stairs and an overshooting servo while the machine runs; a damped finger slide at the cold start
        ratchet: { steps: [[0, 1], [40, 0], [45.5, 0.6], [46, 1]], glide: 0.05 },
        servo: { steps: [[0, 0.85], [40, 0.25], [46, 0.85], [48, 0.92]], glide: 0.05 },
      },
      // the cold-start coughs knock the chassis even though the timbre is warm
      offsets: { chassis: { steps: [[0, 0], [40, 0.55], [44, 0.25], [48, 0]], glide: 0.05 } },
      motion: bassMotion(),
      notes: bassNotes,
    },
    {
      id: 'voice', instrument: 'impossible-voice', gainDb: 0, pan: 0, room: 0.34,
      setup: { seed: 77, size: -0.15, vibRate: 4.9, vibCents: 34, vowelTau: 0.16, haloDecay: 0.7 },
      macro: voiceMacro,
      expression: [[0, 0.66], [39, 0.66], [44, 0.74], [48, 0.8], [61.9, 0.8], [62, 0.6]],
      controls: { breath: { steps: [[0, 0.42], [44, 0.3], [62, 0.45]], glide: 0.2 } },
      // calibration: the glass halo excited in the gears rang on into the coda louder than the voice (its G5 resonator
      // sits on the 2nd harmonic of every G4 cry; 61-67 % of the coda's 200 Hz-4 kHz energy). Bar 16 releases the voice
      // from the glass, so its last cry before the breaker is the most human one and the sigh is alone in the dark.
      offsets: { glass: { steps: [[0, 0], [59.6, 0], [60.3, -1]], glide: 0.35 } },
      breaths: [{ beat: 30.55, beats: 0.85, kind: 'in', velocity: 0.6 }, { beat: 62.02, beats: 0.24, kind: 'in', velocity: 0.35 }],
      notes: voiceNotes,
    },
    {
      id: 'clock', instrument: 'mechanical-orchestra/clock', gainDb: -4, pan: 0, room: 0.08,
      setup: { seed: 41, spread: 0.12 },
      macro: { steps: [[0, 0.3], [24, 0.45], [44, 0.55], [48, 0.85]], glide: 0.1 },
      notes: clockNotes,
    },
    { id: 'log', instrument: 'organic-percussion/log', gainDb: -2, pan: 0, room: 0.1, setup: { seed: 42, spread: 0.3 }, macro: 0.2, notes: logNotes },
    { id: 'spring', instrument: 'mechanical-orchestra/spring', gainDb: -6, pan: 0, room: 0.14, setup: { seed: 43 }, macro: 0.85, notes: springNotes },
    { id: 'bearings', instrument: 'mechanical-orchestra/bearings', gainDb: -10, pan: 0, room: 0.55, setup: { seed: 44, spread: 0.85 }, macro: 0.7, notes: bearingNotes },
    {
      id: 'gong', instrument: 'mechanical-orchestra/bar', gainDb: -8, pan: 0, room: 0.3, setup: { seed: 45, spread: 0 },
      macro: 0.95, controls: { detune: -18 },
      notes: [rn(RETURN, 4, 'G3', 0.8, { articulation: 'ring', hardness: 0.7 })],
    },
  ],
};

// ------------------------------------------------------------------------------------------------ one-shots (rendered with the rack's `kit` command)
/** [package, instrument, MIDI pitches, articulation, velocity, macro]. Nothing new is synthesised: these are rack instruments. */
export const ONE_SHOTS: [string, string, number[], string, number, number | undefined][] = [
  ['kick-knock', 'organic-percussion/skin', [50], 'slap', 0.7, 0.05],          // D3 slap: the kick's 120-300 Hz knock
  ['kick-click', 'organic-percussion/log', [74], 'rim', 0.85, 0.05],           // D5 rim: the kick's click
  ['snare-front', 'organic-percussion/skin', [55], 'slap', 0.7, 0.05],         // G3 slap: the snare's front crack
  ['snare-body', 'context/snare', [60], 'snare', 0.8, undefined],              // HEADLINER context snare: body and clap
  ['anvil', 'mechanical-orchestra/bar', [70, 74, 79], 'hard', 0.8, 0.95],      // alien bar, hard mallet: gated to anvil taps
  ['breaker-click', 'mechanical-orchestra/clock', [79], 'tick', 1, 0.2],      // the breaker: contact click...
  ['breaker-rim', 'organic-percussion/log', [67], 'rim', 0.85, 0.1],
  ['breaker-knock', 'mechanical-orchestra/clock', [67], 'tock', 1, 0.2],      // ...then the lever stop
  ['breaker-thud', 'organic-percussion/skin', [43], 'mute', 0.85, 0.15],
];
const shot = (pkg: string, inst: string, pitch: number) => `oneshots/${pkg}/assets/${inst.replace(/\//g, '-')}/note-${pitch}.wav`;
export const KICK_KIT = { formatVersion: 1, samples: [
  { name: 'iron-pulse', pitch: 35, file: 'v12/02-iron-pulse.wav' },
  { name: 'knock', pitch: 36, file: shot('kick-knock', 'organic-percussion/skin', 50) },
  { name: 'click', pitch: 37, file: shot('kick-click', 'organic-percussion/log', 74) },
] };
export const SNARE_KIT = { formatVersion: 1, samples: [
  { name: 'crack', pitch: 38, file: 'v12/03-titanium-crack.wav' },
  { name: 'body', pitch: 40, file: shot('snare-body', 'context/snare', 60) },
  { name: 'front', pitch: 41, file: shot('snare-front', 'organic-percussion/skin', 55) },
  { name: 'metal', pitch: 42, file: shot('anvil', 'mechanical-orchestra/bar', 74) },
] };
export const ANVIL_KIT = { formatVersion: 1, samples: [
  { name: 'bb4', pitch: 70, file: shot('anvil', 'mechanical-orchestra/bar', 70) },
  { name: 'd5', pitch: 74, file: shot('anvil', 'mechanical-orchestra/bar', 74) },
  { name: 'g5', pitch: 79, file: shot('anvil', 'mechanical-orchestra/bar', 79) },
] };
export const BREAKER_KIT = { formatVersion: 1, samples: [
  { name: 'click', pitch: 60, file: shot('breaker-click', 'mechanical-orchestra/clock', 79) },
  { name: 'rim', pitch: 61, file: shot('breaker-rim', 'organic-percussion/log', 67) },
  { name: 'knock', pitch: 62, file: shot('breaker-knock', 'mechanical-orchestra/clock', 67) },
  { name: 'thud', pitch: 63, file: shot('breaker-thud', 'organic-percussion/skin', 43) },
] };

// ------------------------------------------------------------------------------------------------ engine drums
type EngineNote = Record<string, unknown>;
/** Kick strokes [beat, velocity]: the riff's G1 strokes and its pickups, nothing under the stair. */
export const KICKS: [number, number][] = [];
const kicksA = (c: number, v = 1) => KICKS.push([c, v], [c + 0.75, 0.9 * v], [c + 3.5, 0.84 * v]);
const kicksB = (c: number, v = 1) => KICKS.push([c, v], [c + 0.75, 0.9 * v], [c + 3.75, 0.86 * v]);
kicksA(0); kicksB(4); kicksA(8); kicksB(12); kicksA(16); kicksB(20);
KICKS.push([24, 1], [24.75, 0.9], [27.5, 0.84]);         // bar 7: no kick in the misfire hole
KICKS.push([28, 0.96], [28.75, 0.78]);                    // bar 8: the strokes weaken
KICKS.push([44, 0.72], [44.75, 0.78], [47.75, 0.86]);     // bar 12: the engine catches
kicksA(48); kicksB(52); kicksA(56);
KICKS.push([60, 1], [60.75, 0.92]);
KICKS.sort((a, b) => a[0] - b[0]);
/** Snare (the hammer) on beat 3 of every running bar; missing in bar 7 (misfire), replaced by the breaker in bars 8 and 16. */
export const SNARES: [number, number][] = [2, 6, 10, 14, 18, 22, 46, 50, 54, 58].map(b => [b, b === 46 ? 0.92 : 1]);
const GHOSTS: [number, number][] = [[21.25, 0.24], [23.25, 0.3], [53.25, 0.26], [57.25, 0.24], [59.5, 0.3], [59.75, 0.42]];

export const KICK_LAYER = { body: 0.85, knock: 0.9, click: 1 };
const kickHits: EngineNote[] = KICKS.flatMap(([b, v]) => [
  // IRON PULSE at D2 (+5 st): its body settles a fifth above the G1 sub, so the kick punches instead of booming
  { start: pos(b), pitch: 'iron-pulse', velocity: r6(v * KICK_LAYER.body), playbackRate: semis(5), gate: dur(0.5), envelope: { attackSeconds: 0, releaseSeconds: 0.04 }, chokeGroup: 'body' },
  { start: pos(b), pitch: 'knock', velocity: r6(v * KICK_LAYER.knock), offsetSeconds: 0.0015, envelope: { attackSeconds: 0.0005, releaseSeconds: 0.02 }, gate: dur(0.25), chokeGroup: 'knock' },
  { start: pos(b), pitch: 'click', velocity: r6(v * KICK_LAYER.click), gate: dur(0.125), envelope: { attackSeconds: 0, releaseSeconds: 0.01 }, chokeGroup: 'click' },
]);
export const SNARE_LAYER = { crack: 0.83, body: 1, front: 0.83, metal: 0.42 };
const snareHits: EngineNote[] = [
  ...SNARES.flatMap(([b, v]) => [
    { start: pos(b), pitch: 'crack', velocity: r6(SNARE_LAYER.crack * v), playbackRate: semis(-2), gate: dur(0.5), envelope: { attackSeconds: 0, releaseSeconds: 0.06 }, chokeGroup: 'crack' },
    { start: pos(b), pitch: 'body', velocity: r6(SNARE_LAYER.body * v), gate: dur(0.5), envelope: { attackSeconds: 0, releaseSeconds: 0.05 }, chokeGroup: 'body' },
    { start: pos(b), pitch: 'front', velocity: r6(SNARE_LAYER.front * v), chokeGroup: 'front' },
    // the hammer hits metal: the alien bar gated to a sixteenth, a sheet-metal ring inside the snare
    { start: pos(b), pitch: 'metal', velocity: r6(SNARE_LAYER.metal * v), gate: dur(0.25), envelope: { attackSeconds: 0, releaseSeconds: 0.07 }, chokeGroup: 'metal' },
  ]),
  ...GHOSTS.map(([b, v]) => ({ start: pos(b), pitch: 'crack', velocity: v, playbackRate: semis(-2), gate: dur(0.125), envelope: { attackSeconds: 0.001, releaseSeconds: 0.02 }, chokeGroup: 'crack' })),
];
/** Anvil taps, right before the hammer (the a-of-2) and after the glide; in the gears one more tap on the and-of-1. */
const anvilHits: EngineNote[] = [];
const tap = (b: number, pitch: string, v: number) => anvilHits.push({ start: pos(b), pitch, velocity: r6(v), gate: dur(0.25), envelope: { attackSeconds: 0, releaseSeconds: 0.06 }, chokeGroup: 'anvil' });
for (const c of [8, 12, 16, 20]) { tap(c + 1.75, 'd5', 0.72); tap(c + 3.25, c % 8 === 0 ? 'g5' : 'bb4', 0.5); }
tap(25.75, 'd5', 0.72); tap(27.25, 'g5', 0.5);            // bar 7: the tap before the missing hammer
tap(29.75, 'd5', 0.6);                                     // the last metal sound before the breaker
tap(45.75, 'd5', 0.66); tap(47.25, 'bb4', 0.48);
for (const c of [48, 52, 56]) { tap(c + 0.5, 'bb4', 0.38); tap(c + 1.75, 'd5', 0.76); tap(c + 3.25, c === 52 ? 'bb4' : 'g5', 0.52); }
tap(60.5, 'bb4', 0.4); tap(61.75, 'd5', 0.78);
/** The breaker: a contact click, then 35 ms later the lever stop. Bars 8 and 16, beat 3. */
const breakerHits: EngineNote[] = [BLACKOUT_1, BLACKOUT_2].flatMap(b => [
  { start: pos(b), pitch: 'click', velocity: 1 }, { start: pos(b), pitch: 'rim', velocity: 0.9 },
  { start: pos(b + ms(35)), pitch: 'knock', velocity: 1 }, { start: pos(b + ms(35)), pitch: 'thud', velocity: 1 },
]);

// ------------------------------------------------------------------------------------------------ automation
// Every lane is built from piecewise-linear shapes in ticks (960 per beat), evaluated on the union of their
// breakpoints: ducks and cuts combine by minimum (overlapping ducks merge, a cut wins), gate windows by maximum.
// Every cut and gate edge is a RAMP-long linear segment, never a step, so nothing clicks.
type Point = { at: { musical: string }; value: number; transition?: 'linear' };
const TPB = 960, RAMP = 6;                                   // 6 ticks = 2.9 ms
const tk = (beat: number) => Math.round(beat * TPB);
const ptT = (tick: number, value: number): Point => ({ at: { musical: pos(tick / TPB) }, value: r6(Math.max(-60, Math.min(12, value))), transition: 'linear' });
type Shape = [number, number][];                             // [tick, dB]; the shape is `outside` beyond its first and last breakpoints
function evalShape(s: Shape, t: number, outside: number): number {
  if (t < s[0]![0] || t > s[s.length - 1]![0]) return outside;
  for (let i = 1; i < s.length; i++) {
    const [t0, v0] = s[i - 1]!, [t1, v1] = s[i]!;
    if (t <= t1) return t1 === t0 ? v1 : v0 + (v1 - v0) * (t - t0) / (t1 - t0);
  }
  return s[s.length - 1]![1];
}
function combine(base: number, shapes: Shape[], mode: 'min' | 'max', endTick = tk(END) - RAMP): Point[] {
  const ts = [...new Set([0, endTick, ...shapes.flat().map(([t]) => t)])].filter(t => t >= 0 && t <= endTick).sort((a, b) => a - b);
  const vals = ts.map(t => shapes.reduce((acc, s) => (mode === 'min' ? Math.min : Math.max)(acc, evalShape(s, t, base)), base));
  const out: Point[] = [];
  for (let i = 0; i < ts.length; i++) {
    const v = Math.max(-60, vals[i]!);
    if (i > 0 && i < ts.length - 1 && Math.abs(v - Math.max(-60, vals[i - 1]!)) < 1e-9 && Math.abs(v - Math.max(-60, vals[i + 1]!)) < 1e-9) continue;
    out.push(ptT(ts[i]!, v));
  }
  return out;
}
/** Kick duck: `depthDb` down on the kick (from 30 ticks before), `holdDb` down at 96 ticks (47 ms), back by 240 ticks (117 ms). */
const duck = (k: number, base: number, depthDb: number, holdDb: number): Shape => [[tk(k) - 30, base], [tk(k), base - depthDb], [tk(k) + 96, base - holdDb], [tk(k) + 240, base]];
/** Silence from `from` (a RAMP fade ending on it) until `to` (a RAMP fade-in starting there). */
const blackout = (from: number, to: number, base: number): Shape => [[tk(from) - RAMP, base], [tk(from), -60], [tk(to), -60], [tk(to) + RAMP, base]];
/**
 * Bass lanes: ducks under every kick, cut at both blackouts, silent from the first until the cold start; `gearsDb`
 * more from the return (calibration: with the voice forward, the gears' low end measured 6.4 dB under the mix RMS
 * below 100 Hz against 3.2-4.4 dB in the other running sections).
 */
function bassLane(base: number, depthDb: number, holdDb: number, gearsDb = 0): Point[] {
  const at = (k: number) => base + (k >= RETURN ? gearsDb : 0);
  return combine(base + gearsDb, [[[0, base], [tk(RETURN) - RAMP, base], [tk(RETURN), base + gearsDb]], ...KICKS.map(([k]) => duck(k, at(k), depthDb, holdDb)),
    blackout(BLACKOUT_1, COLD_START - 0.1, base), blackout(BLACKOUT_2, END, base + gearsDb)], 'min');
}
/** Engine-room parts: cut at both blackouts, back at `back`. */
const roomPartLane = (base: number, back = COLD_START): Point[] => combine(base, [blackout(BLACKOUT_1, back, base), blackout(BLACKOUT_2, END, base)], 'min');
/**
 * Voice gate (beats, [open, close, dB relative to the track]): open in the dark and the coda; in the riff's rhythm
 * while the engine runs; shut before every D. Calibration: the voice measured 12.5 dB over the rest of the mix
 * (300 Hz-4 kHz) in the dark but -0.4 dB in the gears, so it is intimate in the dark and pushed forward in the machine.
 */
const DARK_DB = -5, COLD_DB = 3, GEARS_DB = 5, CODA_DB = -1;
export const VOICE_GATE: [number, number, number][] = [
  [30, 40.45, DARK_DB], ...([[40.75, 41.2], [41.5, 41.9], [42, 42.55]] as const).map(([a, b]) => [a, b, COLD_DB] as [number, number, number]),
  ...([[44, 44.45], [44.75, 45.2], [45.5, 45.95], [46, 46.4], [46.5, 46.9], [47, 47.4], [47.5, 47.72]] as const).map(([a, b]) => [a, b, GEARS_DB] as [number, number, number]),
  ...[48, 56].flatMap(c => [[c, c + 0.45], [c + 0.75, c + 1.2], [c + 1.5, c + 1.9], [c + 2, c + 2.6]].map(([a, b]) => [a!, b!, GEARS_DB] as [number, number, number])),
  ...([[52, 52.45], [52.75, 53.2], [53.5, 53.95], [54, 54.4], [54.5, 54.9], [55, 55.4], [55.5, 55.72], [60, 60.45], [60.75, 61.2], [61.5, BLACKOUT_2]] as const)
    .map(([a, b]) => [a, b, GEARS_DB] as [number, number, number]),
  [62.05, 63.55, CODA_DB],                                                                                  // coda (faded below)
];
const gateWindow = ([a, b, g]: [number, number, number], base: number): Shape => [[tk(a), -60], [tk(a) + RAMP, base + g], [tk(b) - RAMP, base + g], [tk(b), -60]];
const voiceLane = (base: number): Point[] => combine(-60, [...VOICE_GATE.map(w => gateWindow(w, base)), [[tk(63.55), base + CODA_DB], [tk(END) - RAMP, -60]]], 'max');
/** The shared rack room: lower under the groove, open in the dark, faded out over the last quarter second. */
const roomLane = (base: number): Point[] => combine(base, [[
  [0, base - 4], [tk(BLACKOUT_1), base - 4], [tk(BLACKOUT_1 + 0.5), base], [tk(RETURN - 1), base], [tk(RETURN), base - 3],
  [tk(BLACKOUT_2), base - 3], [tk(BLACKOUT_2 + 0.5), base], [tk(63.5), base], [tk(END) - RAMP, -60]]], 'min');
const fadeLane = (base: number): Point[] => combine(base, [[[tk(63.5), base], [tk(END) - RAMP, -60]]], 'min');
const bearingsLane = fadeLane;

// ------------------------------------------------------------------------------------------------ engine project
/**
 * Track gains (dB) before TRIM, set from per-stem loudness on calibration render 1 (README, "Before the first master"):
 * the engine room measured far too quiet (clock -45, anvil -39, log -40 LUFS) and was raised 7-13 dB (part of it in the
 * rack part gains); the sub sat 5.9 dB under the mix RMS below 100 Hz and was raised 5 dB; the breaker came down 3 dB.
 */
export const MIX = {
  kick: -1, snare: -1, anvil: 3, breaker: -6, bassSub: 5, bassGrind: -0.5, clock: 4, log: 1, spring: 0, bearings: 0, gong: -2, voice: 1, room: 0,
  master: 0,
};
/** Headroom: the layered kick stem peaked at 0.0 dBFS, so every track is trimmed 3 dB and the master gain raised to match. */
export const TRIM_DB = -3;
const kitTrack = (id: string, description: string, kit: string, notes: EngineNote[], mix: Record<string, number>, effects: unknown[], automation?: unknown) => ({
  id, description, instrument: { type: 'drumkit', kit }, mix, effects, ...(automation ? { automation } : {}),
  clips: [{ bar: 1, pattern: 'all' }], patterns: [{ id: 'all', bars: BARS, notes }],
});
const stemTrack = (id: string, description: string, sample: string, mix: Record<string, number>, effects: unknown[], automation?: unknown) => ({
  id, description, instrument: { type: 'sampler', sample }, mix, effects, ...(automation ? { automation } : {}),
  clips: [{ bar: 1, pattern: 'all' }], patterns: [{ id: 'all', bars: BARS, notes: [{ start: '1:1', velocity: 1 }] }],
});
/** Linkwitz-Riley crossover at 110 Hz: two cascaded two-pole Butterworth sections on each side sum flat. */
const XOVER = 110;
const t = (db: number) => db + TRIM_DB;
export const MASTER = { gainDb: MIX.master - TRIM_DB, effects: [{ type: 'highpass', frequencyHz: 24 }, { type: 'compressor', thresholdDb: -15, ratio: 1.6, attackMs: 30, releaseMs: 160 }, { type: 'saturation', driveDb: 1.5, mix: 1 }] };

export const project = {
  formatVersion: 1,
  title: 'BLACKOUT//ENGINE',
  description: 'DaemonV12 Sound Lab 02. 16 bars of industrial hip-hop, 128 BPM, G minor, exactly 30 s. Living Bass riff, Mechanical Orchestra engine room, Impossible Voice lament.',
  bpm: BPM, timeSignature: '4/4', key: 'G minor', bars: BARS, seed: 1280,
  render: { tail: 'none' },
  master: MASTER,
  tracks: [
    kitTrack('kick', 'V12 IRON PULSE at D2 (gated 1/8) + skin slap D3 (knock) + log rim D5 (click), one hit = three layers, on the riff strokes.', 'assets/kick-kit.json', kickHits,
      { gainDb: t(MIX.kick) }, [{ type: 'highpass', frequencyHz: 32 }, { type: 'saturation', driveDb: 4, mix: 0.3 }]),
    kitTrack('snare', 'The hammer: TITANIUM CRACK -2 st + HEADLINER context snare + skin slap G3 + the alien bar gated as sheet metal; TITANIUM ghosts.', 'assets/snare-kit.json', snareHits,
      { gainDb: t(MIX.snare) }, [{ type: 'highpass', frequencyHz: 90 }, { type: 'saturation', driveDb: 5, mix: 0.35 }, { type: 'reverb', roomSize: 0.25, decaySeconds: 0.4, wet: 0.06 }]),
    kitTrack('anvil', 'Alien modal bar (hard mallet) gated to anvil taps before the hammer; a dotted-eighth echo.', 'assets/anvil-kit.json', anvilHits,
      { gainDb: t(MIX.anvil), pan: -0.32 }, [{ type: 'highpass', frequencyHz: 380 }, { type: 'delay', timeMs: 351.5625, wet: 0.14 }]),
    kitTrack('breaker', 'The breaker that trips the blackouts: contact click, then the lever stop (clock, log, skin one-shots).', 'assets/breaker-kit.json', breakerHits,
      { gainDb: t(MIX.breaker) }, [{ type: 'highpass', frequencyHz: 60 }, { type: 'reverb', roomSize: 0.8, decaySeconds: 1.6, wet: 0.18 }]),
    // QA fix 2: the gears' low end measured 6.0 dB under the mix RMS below 100 Hz (3.8-5.1 dB elsewhere): +4 dB sub from the return
    stemTrack('bass-sub', 'Living Bass below 110 Hz (LR4): the clean phase-locked sub, mono, ducked under every kick.', 'assets/rack/bass.wav',
      { gainDb: t(MIX.bassSub) }, [{ type: 'lowpass', frequencyHz: XOVER }, { type: 'lowpass', frequencyHz: XOVER }, { type: 'highpass', frequencyHz: 28 }],
      { gainDb: bassLane(t(MIX.bassSub), 14, 8, PRE_QA ? 2 : 4) }),
    // QA fix 3: the kick led the bass by only 7.9 dB in the phone band (first 30 ms): the grind ducks 10 dB, not 8
    stemTrack('bass-grind', 'Living Bass above 110 Hz (LR4): folded, geared, driven body, saturated again for small speakers; ducked under the kick.', 'assets/rack/bass.wav',
      { gainDb: t(MIX.bassGrind) }, [{ type: 'highpass', frequencyHz: XOVER }, { type: 'highpass', frequencyHz: XOVER }, { type: 'saturation', driveDb: 7, mix: 0.55 }, { type: 'lowpass', frequencyHz: 6500 }],
      { gainDb: bassLane(t(MIX.bassGrind), PRE_QA ? 8 : 10, PRE_QA ? 3 : 4) }),
    stemTrack('clock', 'Escapement clock: ticks on the off-beat eighths, tocks on 2 and 4; hot, the accents sprout spring zips.', 'assets/rack/clock.wav',
      { gainDb: t(MIX.clock), pan: 0.28 }, [{ type: 'highpass', frequencyHz: 500 }], { gainDb: roomPartLane(t(MIX.clock)) }),
    stemTrack('log', 'Hollow log: knuckle and rim ghosts in the holes; a scrape that doubles the ratchet glide in the gears.', 'assets/rack/log.wav',
      { gainDb: t(MIX.log), pan: -0.18 }, [{ type: 'highpass', frequencyHz: 150 }], { gainDb: roomPartLane(t(MIX.log)) }),
    stemTrack('spring', 'Dispersive spring: a damped recoil after the hammer; the laser snap that replaces the missing hammer in bar 7.', 'assets/rack/spring.wav',
      { gainDb: t(MIX.spring), pan: 0.12 }, [{ type: 'highpass', frequencyHz: 110 }], { gainDb: roomPartLane(t(MIX.spring)) }),
    stemTrack('bearings', 'Tuned bearings: hot metal ticking as it cools in the dark.', 'assets/rack/bearings.wav',
      { gainDb: t(MIX.bearings) }, [{ type: 'highpass', frequencyHz: 1200 }], { gainDb: bearingsLane(t(MIX.bearings)) }),
    stemTrack('gong', 'Alien gong bar (beating twin modes): one hit, the return.', 'assets/rack/gong.wav',
      { gainDb: t(MIX.gong) }, [{ type: 'highpass', frequencyHz: 150 }], { gainDb: roomPartLane(t(MIX.gong), RETURN - 0.5) }),
    // QA fix 1: track effects follow the gain automation, so the voice's own 1.1 s reverb outlived the end fade (-41.5 dBFS
    // in the file's last 10 ms); now a 0.45 s booth, and the long space is the rack room, which is faded
    stemTrack('voice', 'Impossible Voice: the lament in the dark, then gated into the riff and pushed toward impossible; the last sigh.', 'assets/rack/voice.wav',
      { gainDb: t(MIX.voice) }, [{ type: 'highpass', frequencyHz: 140 }, { type: 'compressor', thresholdDb: -22, ratio: 2.5, attackMs: 8, releaseMs: 140, makeupGainDb: 3 }, { type: 'saturation', driveDb: 3, mix: 0.2 }, PRE_QA ? { type: 'reverb', roomSize: 0.55, decaySeconds: 1.1, wet: 0.12 } : { type: 'reverb', roomSize: 0.35, decaySeconds: 0.45, wet: 0.1 }],
      { gainDb: voiceLane(t(MIX.voice)) }),
    stemTrack('room', 'The shared rack room (FDN, wet only): low under the groove, open in the dark.', 'assets/rack/room.wav',
      { gainDb: t(MIX.room) }, [{ type: 'highpass', frequencyHz: 220 }], { gainDb: roomLane(t(MIX.room)) }),
  ],
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = process.argv[2] ? resolve(process.argv[2]) : join(HERE, 'source');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'blackout-engine.rack.json'), JSON.stringify(rackScore, null, 1) + '\n');
  writeFileSync(join(out, 'blackout-engine.project.json'), JSON.stringify(project, null, 1) + '\n');
  writeFileSync(join(out, 'kick-kit.json'), JSON.stringify(KICK_KIT, null, 2) + '\n');
  writeFileSync(join(out, 'snare-kit.json'), JSON.stringify(SNARE_KIT, null, 2) + '\n');
  writeFileSync(join(out, 'anvil-kit.json'), JSON.stringify(ANVIL_KIT, null, 2) + '\n');
  writeFileSync(join(out, 'breaker-kit.json'), JSON.stringify(BREAKER_KIT, null, 2) + '\n');
  console.log(`wrote ${out}: ${bassNotes.length} bass notes, ${voiceNotes.length} voice notes, ${KICKS.length} kicks (${kickHits.length} layer triggers), ${SNARES.length} snares + ${GHOSTS.length} ghosts, ${anvilHits.length} anvil taps, ${clockNotes.length} clock, ${logNotes.length} log, ${springNotes.length} spring, ${bearingNotes.length} bearings`);
}
