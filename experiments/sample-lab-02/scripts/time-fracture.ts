/** Sketch C — TIME FRACTURE. 75 BPM, one bar of 5/4 (4.000 s), B minor.
 *
 * One recording (stairwell.wav: a whistled phrase with foot taps and finger snaps) heard in three states of time:
 *  - Beats 1-2, forward: the first two beats of the take exactly as recorded (F#6 scooped, E6, D6, landing on B5), with
 *    the whistler's own foot on 1 and snap on 2.
 *  - Beat 3, frozen: the held B5 continues in the phase-vocoder slow-motion generation (4x longer, same pitch), so its
 *    vibrato slows to a seasick wobble. The frozen beat then fractures into three shards cut at golden-ratio points
 *    (593, 227 and 140 ticks), read from later and later in the slowed note and sagging 40 then 100 cents, like a tape
 *    stopping.
 *  - Beats 4-5, rewound: the same two beats from the reversed generation. A reversal mirrors the grid, so the reversed
 *    snap swells into beat 5, the reversed foot swells into the next downbeat, and the reversed scoop slides down off
 *    F#6 just before the forward scoop slides up onto it.
 *  - Bass: the B5 note printed at quarter speed by the engine, played at quarter speed again: the whistle four octaves
 *    down, sixteen times slower, over B | G | A | F# (i VI VII v), answering the foot a sixteenth late. Saturation
 *    gives it harmonics a phone can play.
 * Foot and snap on beats 3 and 4 (and a snap doubling beat 2) come from the count-in bar of the same take.
 * Run: node experiments/sample-lab-02/scripts/time-fracture.ts (writes projects/whistle-quarter.json and time-fracture.json) */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { clock, printProject, type Ev, type Note } from './score.ts';
import { beatTime, TAKE_SECONDS, FOOT, SNAPS } from './whistle-source.ts';

export const c = clock(75, '5/4', 1);
const TAKE = 'assets/sources/stairwell.wav', REVERSED = 'assets/derived/stairwell-reversed.wav', SLOWMO = 'assets/derived/stairwell-slowmo.wav';
const PRINT = 'assets/prints/whistle-quarter.wav';
const BEAT_S = 60 / c.bpm;

// ---------------------------------------------------------------- where everything is in the take
/** The forward phrase: the first two beats of the tune, from 4 ms before the downbeat foot tap. */
export const PHRASE = { start: +(beatTime(0) - 0.004).toFixed(6), end: +(beatTime(0) - 0.004 + 2 * BEAT_S).toFixed(6) };
/** The same window in the reversed generation (a mirror: t -> TAKE_SECONDS - t). */
export const REWIND = { start: +(TAKE_SECONDS - PHRASE.end).toFixed(6), end: +(TAKE_SECONDS - PHRASE.start).toFixed(6) };
/** The slow-motion generation is stretch(take[4.66 s, 5.66 s], x4): the held B5, its vibrato and its fall. */
export const SLOWMO_SPEC = { startSeconds: 4.66, endSeconds: 5.66, factor: 4 };
const slow = (takeSeconds: number) => +((takeSeconds - SLOWMO_SPEC.startSeconds) * SLOWMO_SPEC.factor).toFixed(6);
/** The bass print reads the steady start of the held B5 (after the glide from D6, before the vibrato). */
export const BASS_SOURCE = { start: 4.75, end: 5.1, rate: 0.25 };
const countInFoot = beatTime(FOOT[1]![0]) + FOOT[1]![1] / 1000, countInSnap = beatTime(SNAPS[1]![0]) + SNAPS[1]![1] / 1000;

// ---------------------------------------------------------------- generation 3: the held note, two octaves down
export function whistleQuarter() {
  return printProject({
    title: 'WHISTLE ÷4 (SAMPLE LAB 02 print for sketch C)',
    description: 'The steady start of the held B5 in stairwell.wav at quarter speed: B5 becomes B3 and 0.35 s becomes 1.4 s. Sketch C plays this print at a quarter speed again for its bass.',
    sample: TAKE, seconds: 1.45,
    note: { velocity: 1, offsetSeconds: BASS_SOURCE.start, endSeconds: BASS_SOURCE.end, playbackRate: BASS_SOURCE.rate },
  });
}
const PRINT_HZ = 987.767 * BASS_SOURCE.rate;   // B3

const ev = (beat: number, sixteenths: number, ms: number, note: Omit<Note, 'start'>): Ev => ({ ...c.at(beat, sixteenths, ms), note });
const env = (attack: number, release: number) => ({ attackSeconds: attack, releaseSeconds: release });

// ---------------------------------------------------------------- forward: the phrase as recorded, and the count-in kit
const FORWARD: Ev[] = [
  ev(1, 0, 0, { velocity: 0.95, offsetSeconds: PHRASE.start, endSeconds: +(PHRASE.end + 0.04).toFixed(6), gate: '1/2', envelope: env(0.001, 0.03) }),
  ev(3, 0, 6, { velocity: 0.92, offsetSeconds: +(countInFoot - 0.004).toFixed(6), endSeconds: +(countInFoot + 0.4).toFixed(6), gate: '1/8', envelope: env(0.001, 0.08) }),
  ev(4, 0, 16, { velocity: 0.88, offsetSeconds: +(countInSnap - 0.004).toFixed(6), endSeconds: +(countInSnap + 0.4).toFixed(6), gate: '1/8', envelope: env(0.001, 0.1) }),
  // The count-in snap again under the phrase's own snap on beat 2 (aligned to its onset, 0.821 s), to carry the backbeat.
  ev(2, 0, 17, { velocity: 0.9, offsetSeconds: +(countInSnap - 0.004).toFixed(6), endSeconds: +(countInSnap + 0.4).toFixed(6), gate: '1/8', envelope: env(0.001, 0.1) }),
];

// ---------------------------------------------------------------- frozen: slow motion, then three golden-ratio shards
// One beat is 960 ticks; 960 / phi = 593, 367 / phi = 227, leaving 140.
const SHARDS: [ticks: number, from: number, cents: number, toCents: number | null][] = [
  [593, slow(PHRASE.end), 0, null],     // continues the held B5 exactly where the forward phrase stops
  [227, slow(5.38), -40, null],          // a later moment of the same note, a little flat
  [140, slow(5.5), -40, -100],           // the note's fall, sagging further: the tape stopping
];
const FREEZE: Ev[] = [];
let shardAt = c.at(3).t;
for (const [k, [ticks, from, cents, toCents]] of SHARDS.entries()) {
  const r = +(2 ** (cents / 1200)).toFixed(6);
  FREEZE.push({ t: shardAt, nominal: shardAt, note: {
    velocity: [0.95, 0.85, 0.8][k]!, offsetSeconds: from, ...(r !== 1 ? { playbackRate: r } : {}),
    ...(toCents !== null ? { glide: { to: +(2 ** (toCents / 1200)).toFixed(6), duration: '1/16' } } : {}),
    gate: `${ticks}/3840`, envelope: env(k ? 0.006 : 0.025, k === 2 ? 0.02 : 0.015) } });
  shardAt += ticks;
}

// ---------------------------------------------------------------- rewound: the two forward beats, mirrored
const REWOUND: Ev[] = [ev(4, 0, 0, { velocity: 0.95, offsetSeconds: REWIND.start, endSeconds: REWIND.end, gate: '1/2', envelope: env(0.012, 0.003) })];

// ---------------------------------------------------------------- bass: the whistle sixteen times slower
// The line answers the foot a sixteenth later instead of sitting on it, so the whistler's own foot stays audible.
const B1 = 35, D2 = 38, G2 = 43, A2 = 45, Fs2 = 42;
const bassRate = (midi: number) => +(440 * 2 ** ((midi - 69) / 12) / PRINT_HZ).toFixed(6);
const bass = (beat: number, s: number, ms: number, midi: number, v: number, gate: string) => ev(beat, s, ms, { velocity: v, playbackRate: bassRate(midi), gate, envelope: env(0.012, 0.09), chokeGroup: 'bass' });
const BASS: Ev[] = [
  bass(1, 1, 6, B1, 1, '1/8'), bass(1, 3, 4, B1, 0.6, '1/16'), bass(2, 1, 8, D2, 0.7, '1/16'), bass(2, 2, 5, B1, 0.8, '1/16'),
  bass(3, 1, 10, G2, 0.9, '3/16'),
  bass(4, 1, 6, A2, 0.85, '1/8'), bass(4, 3, 4, A2, 0.6, '1/16'),
  bass(5, 0, 4, Fs2, 0.9, '1/8'), bass(5, 2, 6, Fs2, 0.6, '1/16'),
];

export const TRACK_EVENTS: Record<string, Ev[]> = { forward: FORWARD, freeze: FREEZE, rewind: REWOUND, bass: BASS };

/** `cycles` identical one-bar cycles: the delivered project uses two, the seam proof three. */
export function timeFracture(cycles = 2) {
  const o = { cycles };
  return {
    formatVersion: 1,
    title: 'TIME FRACTURE (SAMPLE LAB 02, sketch C)',
    description: 'One whistled take with foot and snaps, in three states of time: two beats forward, one beat frozen in slow motion that fractures at golden-ratio points, and the first two beats rewound. Bass is the whistle sixteen times slower. 75 BPM, 5/4, one 4.000 s cycle; two cycles plus a bar of tail room, the deliverable is the second cycle.',
    bpm: c.bpm, timeSignature: c.ts, key: 'B minor', bars: cycles, seed: 1,
    render: { duration: { bars: cycles + 1 }, tail: 'auto' },
    master: {
      gainDb: -5.1,
      effects: [
        { type: 'highpass', frequencyHz: 28 },
        { type: 'compressor', thresholdDb: -18, ratio: 2.2, attackMs: 12, releaseMs: 140, makeupGainDb: 2.1 },
        { type: 'saturation', driveDb: 3, mix: 0.25 },
      ],
    },
    tracks: [
      c.track('forward', 'The take as recorded: beats 1-2 of the tune with its foot and snap, plus the count-in foot (beat 3) and snap (beat 4).', TAKE, FORWARD,
        { ...o, gainDb: 0, effects: [{ type: 'highpass', frequencyHz: 40 }] }),
      c.track('freeze', 'Beat 3: the held B5 in 4x slow motion, then three golden-ratio shards sagging like a stopping tape.', SLOWMO, FREEZE,
        { ...o, gainDb: 3, effects: [{ type: 'highpass', frequencyHz: 250 }, { type: 'reverb', roomSize: 0.75, decaySeconds: 2, wet: 0.28 }] }),
      c.track('rewind', 'Beats 4-5: beats 1-2 from the reversed take, mirrored onto the grid.', REVERSED, REWOUND,
        { ...o, gainDb: 0, effects: [{ type: 'highpass', frequencyHz: 60 }] }),
      c.track('bass', 'The held B5 at a sixteenth of its speed: B | G | A | F#.', PRINT, BASS,
        { ...o, gainDb: -11, effects: [{ type: 'highpass', frequencyHz: 30 }, { type: 'saturation', driveDb: 22, mix: 0.25 }, { type: 'lowpass', frequencyHz: 900 }] }),
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'projects');
  writeFileSync(join(dir, 'whistle-quarter.json'), JSON.stringify(whistleQuarter(), null, 2) + '\n');
  writeFileSync(join(dir, 'time-fracture.json'), JSON.stringify(timeFracture(), null, 2) + '\n');
  console.log(dir);
}
