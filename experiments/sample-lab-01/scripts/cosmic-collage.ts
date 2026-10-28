/** Candidate B — COSMIC COLLAGE. 96 BPM, four bars (exactly 10.000 s), a sinking key.
 *
 * One CRATE-01 chop, the Dbmaj9 "oh"/"ah" pair, is replayed a whole tone lower every bar: Dbmaj9 | Bmaj9 | Amaj9 |
 * Gmaj9(#11). Each step down is also slower and darker, like a record losing speed; at the loop point everything snaps
 * back up a tritone to Db. Above it floats one constant hook played on GLASS CHOIR, a second-generation resample (ghost-vox,
 * the same voice an octave down and glass-hit printed together through a room) built by glass-choir.json. The hook sits on
 * the notes the first three chords share (Ab, Eb, Db) so the same phrase is recoloured as 5-9-1, 6-3-9 and 7-#11-3; in
 * bar 4 it bends into G lydian and turns on C#, the one note common to all four chords.
 *
 * Rhythm: a half-time snare, hats that change subdivision from beat to beat (single hits, quintuplets, sextuplets), a glass
 * knock on a dotted-eighth cross-rhythm, kicks displaced around the hook's 3+3+3+3+2+2 phrase, a bass that slides down into
 * every new bar, authored sidechain breathing on the chord bed, and a rising ghost-vox stutter that throws the loop back to
 * the top. The same chop an octave below the bed (the record dragging to a halt) rises underneath bars 3-4.
 *
 * Run: node experiments/sample-lab-01/scripts/cosmic-collage.ts (writes projects/glass-choir.json and cosmic-collage.json) */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { place, rate, position, samplerTrack, msToTicks, BAR, type Ev } from './score.ts';
import { CRATE_CHOPS } from './crate-01.ts';

export const BPM = 96, BARS = 4, CYCLES = 2;
const P = 'assets/palette/', CRATE = 'assets/resampled/crate-01.wav', CHOIR = 'assets/resampled/glass-choir.wav';
const at = (bar: number, sixteenth: number, ms = 0) => place(BPM, bar, sixteenth, ms);
/** Each bar sinks a whole tone: the bed, drone and bass all follow this. */
const SINK = [0, -2, -4, -6];

// ---------------------------------------------------------------- resample stage: GLASS CHOIR (one C#4 note)
export function glassChoir() {
  const one = (velocity: number, playbackRate?: number): Ev[] => [{ t: 0, note: { velocity, ...(playbackRate ? { playbackRate } : {}) } }];
  const o = { bars: 1, cycles: 1 };
  return {
    formatVersion: 1,
    title: 'GLASS CHOIR (SAMPLE LAB 01 resample for candidate B)',
    description: 'A hybrid instrument printed from the palette: ghost-vox at C#4, the same voice an octave down, and glass-hit at C#5, struck together into a shared room. Candidate B plays this print as its hook.',
    bpm: BPM, timeSignature: '4/4', bars: 1, seed: 1,
    render: { duration: { seconds: 3 }, tail: 'auto' },
    master: { gainDb: 0, effects: [{ type: 'highpass', frequencyHz: 90 }, { type: 'reverb', roomSize: 0.62, decaySeconds: 2.1, wet: 0.3 }] },
    tracks: [
      samplerTrack('voice', 'ghost-vox at its own pitch, C#4.', `${P}ghost-vox.wav`, one(0.82), { ...o, gainDb: 4 }),
      samplerTrack('voice-low', 'ghost-vox an octave down: half speed, formants halved.', `${P}ghost-vox.wav`, one(0.6, 0.5), { ...o, gainDb: -3, effects: [{ type: 'lowpass', frequencyHz: 2400 }] }),
      samplerTrack('glass', 'glass-hit at C#5, the octave above the voice.', `${P}glass-hit.wav`, one(0.78), { ...o, gainDb: 3 }),
    ],
  };
}

// ---------------------------------------------------------------- the sinking bed and its drone
type ChopId = keyof typeof CRATE_CHOPS;
function chop(id: ChopId, velocity: number, gate: string, semitones: number, extra: { release?: number; attack?: number; into?: number; group?: string } = {}) {
  const c = CRATE_CHOPS[id]!;
  return {
    velocity, gate, offsetSeconds: c.offsetSeconds + (extra.into ?? 0), endSeconds: c.endSeconds, playbackRate: rate(semitones),
    envelope: { attackSeconds: extra.attack ?? 0.003, releaseSeconds: extra.release ?? 0.08 }, chokeGroup: extra.group ?? 'bed',
  };
}
const BED: Ev[] = [];
SINK.forEach((s, i) => {
  const bar = i + 1;
  BED.push({ ...at(bar, 0, 4), note: chop('Dbmaj9-oh', 0.9, '7/16', s) });
  BED.push({ ...at(bar, 8, -10 + 3 * i), note: chop('Dbmaj9-ah', 0.78, i === 3 ? '5/16' : '7/16', s, { release: 0.12 }) });
});
// The same chop an octave below the bed (well under half speed): the record dragging to a halt under bars 3-4.
const DRONE: Ev[] = [
  { ...at(3, 0, 0), note: chop('Dbmaj9-oh', 0.85, '7/8', -12 + SINK[2]!, { attack: 0.9, release: 0.25, group: 'drone' }) },
  { ...at(4, 0, 0), note: chop('Dbmaj9-oh', 0.95, '13/16', -12 + SINK[3]!, { attack: 0.3, release: 0.2, group: 'drone' }) },
];

// ---------------------------------------------------------------- the hook: 3+3+3+3+2+2 on GLASS CHOIR (print is C#4)
const C4s = 61;
const HOOK_STEPS = [0, 3, 6, 9, 12, 14];
const HOOK_BARS: number[][] = [
  [68, 63, 61, 56, 61, 63],   // Ab4 Eb4 Db4 Ab3 Db4 Eb4
  [68, 63, 61, 56, 61, 63],
  [68, 63, 61, 56, 61, 63],
  [66, 62, 61, 57, 61, 64],   // G lydian: F#4 D4 C#4 A3 C#4 E4
];
const HOOK_MS = [[0, -9, 7, -12, 9, -5], [-4, -11, 6, -8, 12, -3], [-2, -7, 9, -13, 6, -6], [3, -6, 11, -9, 8, -14]];
const HOOK_GATE = ['1/8', '1/8', '1/8', '1/8', '3/32', '3/32'];
const HOOK_VEL = [0.95, 0.72, 0.8, 0.7, 0.84, 0.68];
const HOOK: Ev[] = [];
HOOK_BARS.forEach((line, b) => line.forEach((midi, k) => {
  const into = k === 2 || k === 4 ? 0.16 : 0; // the 3rd and 5th notes start inside the vowel: "ah" rather than "oh"
  HOOK.push({ ...at(b + 1, HOOK_STEPS[k]!, HOOK_MS[b]![k]!), note: {
    velocity: HOOK_VEL[k]! - (b === 3 ? 0.04 : 0) + (b === 1 && k === 0 ? -0.06 : 0), playbackRate: rate(midi - C4s),
    ...(into ? { offsetSeconds: into } : {}), gate: HOOK_GATE[k]!,
    envelope: { attackSeconds: into ? 0.006 : 0.002, releaseSeconds: 0.11 }, chokeGroup: 'hook' } });
}));

// ---------------------------------------------------------------- ghost-vox stutter that throws bar 4 back to the top
const GHOST: Ev[] = [];
const STUTTER = [[13, 0], [13, 2], [14, 0], [14, 2], [15, 0], [15, 1], [15, 2], [15, 3]]; // sixteenth, 64th within it
STUTTER.forEach(([s, q], k) => GHOST.push({ ...at(4, s! + q! / 4, k < 4 ? 4 : 0), note: {
  velocity: 0.36 + 0.055 * k, offsetSeconds: 0.42, endSeconds: 0.9, playbackRate: +(1.122462 * 2 ** (k / 14)).toFixed(6),
  gate: k < 4 ? '1/32' : '1/64', envelope: { attackSeconds: 0.001, releaseSeconds: 0.012 }, chokeGroup: 'stutter' } }));
// a single low answer in bar 2: the voice an octave and a fourth down, slow and breathy, panned by the delay
GHOST.push({ ...at(2, 10, 14), note: { velocity: 0.55, offsetSeconds: 0.08, playbackRate: rate(-17), gate: '1/4', envelope: { attackSeconds: 0.04, releaseSeconds: 0.2 } } });

// ---------------------------------------------------------------- bass: roots sink and slide into every new bar
function bass(semitones: number, velocity: number, gate: string, glideTo?: number, glide = '1/8') {
  return {
    velocity, gate, playbackRate: rate(semitones), ...(glideTo !== undefined ? { glide: { to: rate(glideTo), duration: glide } } : {}),
    envelope: { attackSeconds: 0.003, releaseSeconds: 0.06 }, chokeGroup: 'bass',
  };
}
const BASS: Ev[] = [];
SINK.forEach((r, i) => {
  const bar = i + 1, last = i === 3;
  BASS.push({ ...at(bar, 0, 9), note: bass(r, 0.94, '3/16') });
  BASS.push({ ...at(bar, 4, 6), note: bass(r + 12, 0.46, '1/32') });
  BASS.push({ ...at(bar, 6, 12), note: bass(r, 0.76, '1/16') });
  BASS.push({ ...at(bar, 10, 5), note: bass(r + 7, 0.7, '1/8') });
  if (!last) BASS.push({ ...at(bar, 13, -6), note: bass(r, 0.82, '3/16', r - 2, '3/16') });
  else BASS.push({ ...at(bar, 12, -4), note: bass(r, 0.9, '1/4', r - 18, '1/4') }); // the dive: G1 falls 18 semitones into the snap
});

// ---------------------------------------------------------------- drums
const KICK: Ev[] = [
  [1, 0, 0, 0.96], [1, 3, 9, 0.55], [1, 10, -6, 0.86], [1, 13, 4, 0.66],
  [2, 0, -5, 0.92], [2, 6, 12, 0.78], [2, 11, -8, 0.84],
  [3, 0, 3, 0.94], [3, 3, 7, 0.52], [3, 10, -10, 0.86], [3, 14, 5, 0.62],
  [4, 0, -2, 0.93], [4, 7, 14, 0.74], [4, 9, -4, 0.82],
].map(([b, s, ms, v]) => ({ ...at(b!, s!, ms!), note: { velocity: v!, playbackRate: 0.93 } }));
const SNARE: Ev[] = [
  [1, 8, 18, 0.95], [1, 13, 6, 0.28],
  [2, 8, 24, 0.93], [2, 5, 9, 0.24], [2, 15, 4, 0.3],
  [3, 8, 15, 0.96], [3, 13, 8, 0.3],
  [4, 8, 27, 0.92], [4, 11, 10, 0.34],
].map(([b, s, ms, v]) => ({ ...at(b!, s!, ms!), note: { velocity: v!, playbackRate: 0.8 } }));
// Hats change gear by beat: a pair, a quintuplet, a pair, a sextuplet. Bar 2 answers with quintuplets, bar 3 straightens
// beat 2, bar 4 ends in a 32nd crescendo under the stutter.
const HAT: Ev[] = [];
const hat = (t: number, nominal: number, v: number) => HAT.push({ t, nominal, note: { velocity: v, playbackRate: 0.86 } });
const drift = (n: number) => ((n * 37) % 9) - 4;
for (let bar = 1; bar <= 4; bar++) {
  const b0 = (bar - 1) * BAR;
  const tuplet = (beat: number, n: number, vels: number[]) => { for (let k = 0; k < n; k++) { const g = b0 + (beat - 1) * 960 + Math.round(k * 960 / n); hat(g + msToTicks(drift(bar * 10 + beat * 7 + k), BPM), g, vels[k % vels.length]!); } };
  hat(b0 + msToTicks(drift(bar), BPM), b0, 0.62); hat(b0 + 480 + msToTicks(12 + drift(bar + 3), BPM), b0 + 480, 0.4);
  if (bar === 3) tuplet(2, 4, [0.6, 0.32, 0.48, 0.34]); else tuplet(2, 5, [0.66, 0.34, 0.46, 0.33, 0.52]);
  hat(b0 + 1920 + msToTicks(drift(bar + 5), BPM), b0 + 1920, 0.56); hat(b0 + 2640 + msToTicks(15, BPM), b0 + 2640, 0.4);
  if (bar === 4) for (let k = 0; k < 8; k++) hat(b0 + 2880 + k * 120 + msToTicks(drift(k), BPM), b0 + 2880 + k * 120, 0.3 + 0.06 * k);
  else if (bar === 2) tuplet(4, 5, [0.6, 0.3, 0.44, 0.3, 0.5]);
  else tuplet(4, 6, [0.6, 0.3, 0.45, 0.3, 0.5, 0.35]);
}
// Glass knock: glass-hit two octaves down (C#3, the note every chord keeps), on a dotted-eighth cycle that skips the snare.
const KNOCK: Ev[] = [];
for (let bar = 1; bar <= 4; bar++) for (const [k, s] of [2, 5, 11, 14].entries()) {
  if (bar === 4 && s === 14) continue;
  KNOCK.push({ ...at(bar, s, ((bar * 3 + k * 5) % 13) - 6), note: { velocity: 0.5 + 0.08 * ((bar + k) % 3), playbackRate: 0.25, gate: '1/32', envelope: { attackSeconds: 0.001, releaseSeconds: 0.03 } } });
}
// Air: a swell (slow attack) that breathes into the downbeat, and a short gust into bar 3.
const AIR: Ev[] = [
  { ...at(4, 4, 0), note: { velocity: 0.9, offsetSeconds: 3.6, gate: '3/4', envelope: { attackSeconds: 1.75, releaseSeconds: 0.05 } } },
  { ...at(2, 12, 0), note: { velocity: 0.5, offsetSeconds: 1.2, gate: '1/4', envelope: { attackSeconds: 0.55, releaseSeconds: 0.04 } } },
];

// ---------------------------------------------------------------- automation (project-absolute, both cycles)
/** Gain lane at `base` dB that ducks by `depth` dB at each main kick and recovers linearly over `recoverMs`. Automation
 * values are absolute and replace the static mix gain, so the lane carries the track's level itself. */
function pump(base: number, depth: number, recoverMs: number, cycles: number) {
  const hits = [[1, 0, 0], [1, 10, -6], [2, 0, -5], [2, 11, -8], [3, 0, 3], [3, 10, -10], [4, 0, -2], [4, 9, -4]];
  const points: { at: { musical: string }; value: number; transition?: string }[] = [];
  for (let c = 0; c < cycles; c++) for (const [b, s, ms] of hits) {
    const t = c * BARS * BAR + at(b!, s!, ms!).t;
    points.push({ at: { musical: position(Math.max(0, t - 3)) }, value: base, transition: 'linear' });
    points.push({ at: { musical: position(t + 4) }, value: base - depth, transition: 'linear' });
    points.push({ at: { musical: position(t + msToTicks(recoverMs, BPM)) }, value: base });
  }
  return points;
}
function swirl(cycles: number) {
  const points = [];
  for (let k = 0; k <= cycles * 2; k++) points.push({ at: { musical: `${1 + 2 * k}:1` }, value: k % 2 ? 0.32 : -0.32, ...(k < cycles * 2 ? { transition: 'linear' } : {}) });
  return points;
}

/** Authored events per track id, with their nominal grid ticks (for the event map's human-offset column). */
export const TRACK_EVENTS: Record<string, Ev[]> = { hook: HOOK, bed: BED, drone: DRONE, ghost: GHOST, bass: BASS, kick: KICK, snare: SNARE, hat: HAT, knock: KNOCK, air: AIR };

/** `cycles` identical four-bar cycles: the delivered project uses two; the seam check renders three. */
export function cosmicCollage(cycles = CYCLES) {
  const opts = { bars: BARS, cycles };
  return {
    formatVersion: 1,
    title: 'COSMIC COLLAGE (SAMPLE LAB 01, candidate B)',
    description: 'Psychedelic loop: one CRATE-01 chord chop sinks a whole tone per bar (Dbmaj9 | Bmaj9 | Amaj9 | Gmaj9#11) under a constant GLASS CHOIR hook, then snaps back up a tritone at the loop. Two identical cycles plus a bar of tail room; the deliverable is the second cycle.',
    bpm: BPM, timeSignature: '4/4', key: 'Db major', bars: BARS * cycles, seed: 1,
    render: { duration: { bars: BARS * cycles + 1 }, tail: 'auto' }, // one bar of margin: voices ringing over the last
    // cycle boundary must not meet the render's end, where the engine forces their release
    master: {
      gainDb: -2.8,
      effects: [
        { type: 'highpass', frequencyHz: 28 },
        { type: 'compressor', thresholdDb: -16.8, ratio: 2, attackMs: 15, releaseMs: 150, makeupGainDb: 3 },
        { type: 'saturation', driveDb: 3, mix: 0.25 },
      ],
    },
    tracks: [
      samplerTrack('hook', 'GLASS CHOIR hook, 3+3+3+3+2+2, drifting across the stereo field.', CHOIR, HOOK,
        { ...opts, gainDb: -1.5, effects: [{ type: 'highpass', frequencyHz: 220 }, { type: 'delay', timeMs: 234, wet: 0.22 }], automation: { pan: swirl(cycles) } }),
      samplerTrack('bed', 'CRATE-01 Dbmaj9 chop pair, a whole tone lower each bar, filtered and breathing against the kick.', CRATE, BED,
        { ...opts, gainDb: -5, effects: [{ type: 'highpass', frequencyHz: 170 }, { type: 'lowpass', frequencyHz: 1800 }, { type: 'saturation', driveDb: 6, mix: 0.35 }, { type: 'reverb', roomSize: 0.5, decaySeconds: 1.4, wet: 0.18 }], automation: { gainDb: pump(-5, 6, 230, cycles) } }),
      samplerTrack('drone', 'The same chop an octave below the bed, swelling under bars 3-4: the record dragging to a halt.', CRATE, DRONE,
        { ...opts, gainDb: -6, effects: [{ type: 'highpass', frequencyHz: 70 }, { type: 'lowpass', frequencyHz: 900 }, { type: 'reverb', roomSize: 0.8, decaySeconds: 2.5, wet: 0.3 }], automation: { gainDb: pump(-6, 4, 260, cycles) } }),
      samplerTrack('ghost', 'ghost-vox grains: a rising stutter into the loop point and one low answer.', `${P}ghost-vox.wav`, GHOST,
        { ...opts, gainDb: 0, pan: 0.15, effects: [{ type: 'highpass', frequencyHz: 160 }, { type: 'delay', timeMs: 156, wet: 0.3 }, { type: 'reverb', roomSize: 0.6, decaySeconds: 1.6, wet: 0.25 }] }),
      samplerTrack('bass', 'bass-db.wav: sinking roots that slide down into each bar, then an 18-semitone dive.', `${P}bass-db.wav`, BASS,
        { ...opts, gainDb: -5.5, effects: [{ type: 'lowpass', frequencyHz: 1600 }, { type: 'saturation', driveDb: 5, mix: 0.3 }] }),
      samplerTrack('kick', 'mechanical-kick at 0.93, displaced around the hook.', `${P}mechanical-kick.wav`, KICK,
        { ...opts, gainDb: 1.5, effects: [{ type: 'saturation', driveDb: 9, mix: 0.45 }, { type: 'lowpass', frequencyHz: 7000 }] }),
      samplerTrack('snare', 'industrial-snare at 0.8: a late half-time backbeat with ghosts, in a bigger room.', `${P}industrial-snare.wav`, SNARE,
        { ...opts, gainDb: 1, effects: [{ type: 'highpass', frequencyHz: 130 }, { type: 'saturation', driveDb: 5, mix: 0.35 }, { type: 'reverb', roomSize: 0.6, decaySeconds: 1.2, wet: 0.2 }] }),
      samplerTrack('hat', 'pixel-hat at 0.86 changing subdivision by beat.', `${P}pixel-hat.wav`, HAT,
        { ...opts, gainDb: 2, pan: 0.2, effects: [{ type: 'highpass', frequencyHz: 3000 }] }),
      samplerTrack('knock', 'glass-hit at a quarter speed, gated to a wooden knock on a dotted-eighth cycle.', `${P}glass-hit.wav`, KNOCK,
        { ...opts, gainDb: -4, pan: -0.3, effects: [{ type: 'lowpass', frequencyHz: 3800 }, { type: 'reverb', roomSize: 0.4, decaySeconds: 0.8, wet: 0.2 }] }),
      samplerTrack('air', 'air-texture swells breathing into bar 3 and into the loop point.', `${P}air-texture.wav`, AIR,
        { ...opts, gainDb: -6, effects: [{ type: 'highpass', frequencyHz: 1500 }] }),
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'projects');
  writeFileSync(join(dir, 'glass-choir.json'), JSON.stringify(glassChoir(), null, 2) + '\n');
  writeFileSync(join(dir, 'cosmic-collage.json'), JSON.stringify(cosmicCollage(), null, 2) + '\n');
  console.log(dir);
}
