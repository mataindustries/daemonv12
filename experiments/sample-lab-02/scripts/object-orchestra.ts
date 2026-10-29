/** Sketch B — OBJECT ORCHESTRA. 120 BPM, two bars of 4/4 (4.000 s), A minor.
 *
 * A kitchen plays a groove. The primary instrument is one spoon tap on a mug, resampled twice at quarter speed: the
 * engine prints the tap two octaves down and four times longer (mug-quarter.wav), and the sketch plays that print at
 * a quarter speed again, so the bassline is the same tap four octaves down and sixteen times slower. The spoon click
 * becomes a soft thock, the mug's bell-like partials (1 : 2.40, a minor tenth) become a gong-bass with a built-in minor
 * colour, and the kitchen's few milliseconds of echo become a long, dark bloom. On the first downbeat the mug also rings
 * at its own pitch, so you hear the object and its sixteen-times shadow together.
 *  - Drips are the hi-hats and the melody at once: each drop is retuned (barely) to the A minor pentatonic, swung.
 *  - The kick is a fist on a cardboard box, the snare a book slapped on the table, laid back.
 *  - The fill is physics: a spun coin accelerates from 12 to 125 contacts per second over the last 2¼ beats and falls
 *    flat exactly on the loop's downbeat, under the next mug boom.
 * The bass avoids C and G as roots on purpose: the mug's tierce would turn them minor against the key.
 * Run: node experiments/sample-lab-02/scripts/object-orchestra.ts (writes projects/mug-quarter.json and object-orchestra.json) */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { clock, printProject, rate, type Ev, type Note } from './score.ts';
import { MUG_HZ, COIN } from './object-sources.ts';

export const c = clock(120, '4/4', 2);
const S = 'assets/sources/', PRINT = 'assets/prints/mug-quarter.wav';
/** Where each performance starts in its take (seconds), as recorded by object-sources.ts. */
export const HITS = {
  mug: [0.15, 1.95, 3.75, 5.55], box: [0.15, 0.85, 1.55, 2.25], book: [0.15, 0.85, 1.55, 2.25],
  drips: [0.2, 0.72, 1.19, 1.8, 2.24, 2.82, 3.32, 3.98, 4.41, 4.96, 5.45, 6.05],
  dripHz: [1180, 1570, 990, 0, 1330, 1760, 1050, 1420, 0, 2090, 1240, 1880],
};
const hzOf = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const ev = (bar: number, sixteenth: number, ms: number, note: Omit<Note, 'start'>): Ev => ({ ...c.at(1 + 4 * (bar - 1), sixteenth, ms), note });

// ---------------------------------------------------------------- generation 1: the tap, two octaves down
export function mugQuarter() {
  return printProject({
    title: 'MUG ÷4 (SAMPLE LAB 02 print for sketch B)',
    description: 'The first spoon tap of mug.wav played at quarter speed: A5 becomes A3, 1.8 s becomes 7.2 s. Sketch B plays this print at a quarter speed again.',
    sample: `${S}mug.wav`, seconds: 7.2,
    note: { velocity: 1, offsetSeconds: HITS.mug[0]! - 0.001, endSeconds: HITS.mug[1]! - 0.01, playbackRate: 0.25 },
  });
}
const PRINT_HZ = MUG_HZ / 4;   // A3 in the print; the sketch's rates put it on A1..A2

// ---------------------------------------------------------------- the mug, sixteen times slower: the bassline
const A1 = 33, D2 = 38, E2 = 40, A2 = 45;
function boom(midi: number, velocity: number, gate: string, from?: number): Omit<Note, 'start'> {
  const r = (m: number) => +(hzOf(m) / PRINT_HZ).toFixed(6);
  return { velocity, gate, playbackRate: r(from ?? midi), ...(from !== undefined ? { glide: { to: r(midi), duration: '1/16' } } : {}),
    envelope: { attackSeconds: 0.003, releaseSeconds: 0.07 }, chokeGroup: 'bass' };
}
const BASS: Ev[] = [
  ev(1, 0, 4, boom(A1, 1.0, '3/16')), ev(1, 3, 10, boom(A1, 0.55, '1/16')), ev(1, 6, 6, boom(E2, 0.85, '1/8')),
  ev(1, 10, 8, boom(D2, 0.7, '1/16')), ev(1, 11, 14, boom(E2, 0.8, '1/8', D2)),
  ev(2, 0, 2, boom(A1, 0.95, '3/16')), ev(2, 3, 12, boom(A1, 0.5, '1/16')), ev(2, 6, 4, boom(E2, 0.85, '1/8')),
  ev(2, 9, 10, boom(A2, 0.6, '1/16')), ev(2, 10, 6, boom(D2, 0.8, '3/16')),
];

// ---------------------------------------------------------------- the mug at its own pitch: a slow bell
const tink = (bar: number, s: number, ms: number, v: number, semis: number, hit: number): Ev =>
  ev(bar, s, ms, { velocity: v, offsetSeconds: HITS.mug[hit]! - 0.001, endSeconds: HITS.mug[hit]! + 1.6, ...(semis ? { playbackRate: rate(semis) } : {}), gate: '1/4', envelope: { attackSeconds: 0.001, releaseSeconds: 0.25 } });
const MUG: Ev[] = [tink(1, 0, 14, 0.8, 0, 0), tink(1, 7, 9, 0.42, -5, 2), tink(2, 0, -3, 0.48, 0, 1), tink(2, 7, 11, 0.4, -5, 3), tink(2, 14, 6, 0.3, 3, 2)];

// ---------------------------------------------------------------- drips: hi-hat and melody in one
/** A drop retuned to `midi` from the nearest-sounding drop of the take. */
function drip(midi: number, velocity: number): Omit<Note, 'start'> {
  const target = hzOf(midi);
  let best = 0;
  HITS.dripHz.forEach((h, k) => { if (h && Math.abs(Math.log(h / target)) < Math.abs(Math.log((HITS.dripHz[best] || 1) / target))) best = k; });
  const r = target / HITS.dripHz[best]!;
  return { velocity, offsetSeconds: HITS.drips[best]! - 0.002, endSeconds: HITS.drips[best]! + 0.3, ...(Math.abs(r - 1) > 1e-4 ? { playbackRate: +r.toFixed(6) } : {}),
    gate: '1/16', envelope: { attackSeconds: 0.0005, releaseSeconds: 0.04 } };
}
const C6 = 84, D6 = 86, E6 = 88, G6 = 91, A6 = 93, C7 = 96;
// [bar, sixteenth, midi, velocity]; odd sixteenths swing late by 17-21 ms.
const DRIP_LINE: [number, number, number, number][] = [
  [1, 1, E6, 0.55], [1, 2, A6, 0.7], [1, 5, G6, 0.5], [1, 6, E6, 0.65], [1, 9, D6, 0.5], [1, 11, E6, 0.55], [1, 13, C6, 0.45], [1, 14, D6, 0.6],
  [2, 1, E6, 0.55], [2, 2, G6, 0.65], [2, 3, A6, 0.5], [2, 5, C7, 0.6], [2, 6, A6, 0.55], [2, 8, G6, 0.45], [2, 9, E6, 0.5], [2, 10, D6, 0.55],
];
const DRIPS: Ev[] = DRIP_LINE.map(([bar, s, midi, v], k) => ev(bar, s, s % 2 ? 17 + (k * 7) % 5 : (k * 3) % 5 - 2, drip(midi, v)));

// ---------------------------------------------------------------- box kick, book snare, the coin
const box = (bar: number, s: number, ms: number, v: number, hit: number): Ev =>
  ev(bar, s, ms, { velocity: v, offsetSeconds: HITS.box[hit]! - 0.001, endSeconds: HITS.box[hit]! + 0.6, gate: '1/8', envelope: { attackSeconds: 0.0005, releaseSeconds: 0.06 } });
const KICK: Ev[] = [box(1, 0, 0, 0.9, 0), box(1, 7, 9, 0.62, 1), box(1, 10, 5, 0.85, 2), box(2, 0, -2, 0.95, 2), box(2, 6, 11, 0.7, 3), box(2, 9, 6, 0.8, 1)];
const book = (bar: number, s: number, ms: number, v: number, hit: number): Ev =>
  ev(bar, s, ms, { velocity: v, offsetSeconds: HITS.book[hit]! - 0.001, endSeconds: HITS.book[hit]! + 0.5, gate: '1/8', envelope: { attackSeconds: 0.0005, releaseSeconds: 0.08 } });
const SNARE: Ev[] = [book(1, 4, 24, 0.92, 0), book(1, 12, 29, 0.95, 2), book(1, 15, 12, 0.28, 3), book(2, 4, 21, 0.9, 1), book(2, 12, 31, 0.88, 2)];
// The coin is set spinning so that it falls (COIN.startAt + spinSeconds into coin.wav) exactly on the next downbeat.
const coinStart = c.at(5, 7, 0), fallAt = COIN.startAt + COIN.spinSeconds, lead = (c.cycle - coinStart.t) * 60 / (c.bpm * 960);
const COIN_EVENTS: Ev[] = [{ ...coinStart, note: { velocity: 0.9, offsetSeconds: +(fallAt - lead).toFixed(6), gate: '3/4', envelope: { attackSeconds: 0.05, releaseSeconds: 0.2 } } }];

export const TRACK_EVENTS: Record<string, Ev[]> = { bass: BASS, mug: MUG, drips: DRIPS, kick: KICK, snare: SNARE, coin: COIN_EVENTS };

/** `cycles` identical two-bar cycles: the delivered project uses two, the seam proof three. */
export function objectOrchestra(cycles = 2) {
  const o = { cycles };
  return {
    formatVersion: 1,
    title: 'OBJECT ORCHESTRA (SAMPLE LAB 02, sketch B)',
    description: 'A kitchen groove: one spoon tap on a mug, resampled twice at quarter speed, is the bassline; drips are hats and melody; box kick, book snare and a spun coin that falls on the downbeat. 120 BPM, two bars (4.000 s); two cycles plus a bar of tail room, the deliverable is the second cycle.',
    bpm: c.bpm, timeSignature: c.ts, key: 'A minor', bars: 2 * cycles, seed: 1,
    render: { duration: { bars: 2 * cycles + 1 }, tail: 'auto' },
    master: {
      gainDb: -2,
      effects: [
        { type: 'highpass', frequencyHz: 28 },
        { type: 'compressor', thresholdDb: -17, ratio: 2.2, attackMs: 10, releaseMs: 120, makeupGainDb: 3 },
        { type: 'saturation', driveDb: 3, mix: 0.25 },
      ],
    },
    tracks: [
      c.track('bass', 'One spoon tap on a mug, four octaves down: the mug-quarter print played at a quarter speed again.', PRINT, BASS,
        { ...o, gainDb: -3.8, effects: [{ type: 'highpass', frequencyHz: 36 }, { type: 'lowpass', frequencyHz: 1100 }, { type: 'saturation', driveDb: 4, mix: 0.3 }] }),
      c.track('mug', 'The same mug at its own pitch (A5) and a fourth down: a slow kitchen bell.', `${S}mug.wav`, MUG,
        { ...o, gainDb: 0.3, pan: 0.3, effects: [{ type: 'highpass', frequencyHz: 400 }, { type: 'lowpass', frequencyHz: 11000 }] }),
      c.track('drips', 'Water drops retuned to A minor pentatonic: the hi-hat and the melody.', `${S}drips.wav`, DRIPS,
        { ...o, gainDb: 0.9, pan: -0.25, effects: [{ type: 'highpass', frequencyHz: 600 }, { type: 'delay', timeMs: 188, wet: 0.16 }] }),
      c.track('kick', 'A fist on a cardboard box.', `${S}box.wav`, KICK,
        { ...o, gainDb: 0, effects: [{ type: 'lowpass', frequencyHz: 5000 }, { type: 'saturation', driveDb: 9, mix: 0.5 }] }),
      c.track('snare', 'A hardback book slapped flat on the table, laid back.', `${S}book.wav`, SNARE,
        { ...o, gainDb: 0.8, pan: -0.05, effects: [{ type: 'highpass', frequencyHz: 120 }, { type: 'saturation', driveDb: 6, mix: 0.4 }, { type: 'lowpass', frequencyHz: 11000 }] }),
      c.track('coin', 'A spun coin: 12 to 125 contacts a second, falling flat on the downbeat.', `${S}coin.wav`, COIN_EVENTS,
        { ...o, gainDb: -0.5, pan: 0.15, effects: [{ type: 'highpass', frequencyHz: 150 }] }),
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'projects');
  writeFileSync(join(dir, 'mug-quarter.json'), JSON.stringify(mugQuarter(), null, 2) + '\n');
  writeFileSync(join(dir, 'object-orchestra.json'), JSON.stringify(objectOrchestra(), null, 2) + '\n');
  console.log(dir);
}
