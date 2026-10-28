/** CRATE-01: the shared "record". A DaemonV12 session that performs the palette into one printed, drumless soul passage:
 * the felt keys take, a two-voice ghost-vox backing group ("oh-ah" twice a bar), soft glass doubling the top line and a
 * low air bed, glued by tape-like saturation and a gentle compressor. Both candidates chop this print; it is the record
 * in the crate, made by us. 100 BPM, four bars of 2.4 s; chord attacks follow the keys take (bar + 50 ms, rolled).
 * Run: node experiments/sample-lab-01/scripts/crate-01.ts  (writes projects/crate-01.json) */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tick, rate, round6, samplerTrack, type Ev } from './score.ts';

export const CRATE_BPM = 100;
const B = CRATE_BPM, P = 'assets/palette/';
// ghost-vox sings C#4 at rate 1. Two syllables per bar: [top, low] on beat 1 and beat 3, as semitones from C#4.
const LINES: [number, number][][] = [
  [[4, 0], [2, -1]],     // Dbmaj9: F4/Db4, then Eb4/C4
  [[4, 0], [0, -3]],     // Bbm9:   F4/Db4, then Db4/Bb3
  [[5, 2], [4, 0]],      // Ebm11:  Gb4/Eb4, then F4/Db4
  [[4, 0], [2, -1]],     // Gbmaj9 -> Ab13sus: F4/Db4, then Eb4/C4
];
// Human placement (ms) and level for each singer; the low voice breathes in a little later than the top.
const TOP_MS = [[24, 10], [18, 30], [36, 14], [20, 26]], LOW_MS = [[41, 33], [37, 44], [52, 29], [44, 47]];
const TOP_VEL = [[0.66, 0.6], [0.7, 0.58], [0.72, 0.62], [0.68, 0.6]], LOW_VEL = [[0.5, 0.44], [0.52, 0.46], [0.55, 0.47], [0.5, 0.45]];

/** Chop points in the printed record (seconds). Each bar has an "oh" region (chord attack + first syllable) and an "ah"
 * region (second syllable over the held chord with the keys' inner-voice move). Starts sit 6 ms before the earliest
 * onset; ends sit 6 ms before the next region's earliest onset, so a chop never reaches the next event. */
export const CHORDS = ['Dbmaj9', 'Bbm9', 'Ebm11', 'Gbmaj9'] as const;
const KEYS_LATE_MS = 50, BAR_SECONDS = 2.4;
function regionStart(b: number, s: number): number {
  const first = Math.min(TOP_MS[b]![s]!, LOW_MS[b]![s]!, s === 0 ? KEYS_LATE_MS : Infinity);
  return b * BAR_SECONDS + s * BAR_SECONDS / 2 + first / 1000 - 0.006;
}
export const CRATE_CHOPS = Object.fromEntries(CHORDS.flatMap((name, b) => [0, 1].map(s => {
  const end = b === 3 && s === 1 ? 10.9 : s === 0 ? regionStart(b, 1) : regionStart(b + 1, 0);
  return [`${name}-${s ? 'ah' : 'oh'}`, { offsetSeconds: round6(regionStart(b, s)), endSeconds: round6(end) }];
}))) as Record<string, { offsetSeconds: number; endSeconds: number }>;

export function crate() {
  const top: Ev[] = [], low: Ev[] = [], glass: Ev[] = [];
  LINES.forEach((bar, b) => bar.forEach(([hi, lo], s) => {
    top.push({ t: tick(B, b + 1, 1 + 2 * s, 0, TOP_MS[b]![s]!), note: { velocity: TOP_VEL[b]![s]!, playbackRate: rate(hi) } });
    low.push({ t: tick(B, b + 1, 1 + 2 * s, 0, LOW_MS[b]![s]!), note: { velocity: LOW_VEL[b]![s]!, playbackRate: rate(lo) } });
    if (s === 0) glass.push({ t: tick(B, b + 1, 1, 0, 48 + 6 * b), note: { velocity: 0.5 + 0.06 * (b % 2), playbackRate: rate(hi) } });
  }));
  const opts = { bars: 4, cycles: 1 };
  return {
    formatVersion: 1,
    title: 'CRATE-01 (SAMPLE LAB 01 source record)',
    description: 'The shared source record for SAMPLE LAB 01: keys take, two-voice ghost-vox backing group, glass doubling and air, printed once and chopped by both candidates. Drumless, no bass register.',
    bpm: B, timeSignature: '4/4', key: 'Db major', bars: 4, seed: 1,
    render: { duration: { seconds: 11 }, tail: 'auto' },
    master: {
      gainDb: 0,
      effects: [
        { type: 'highpass', frequencyHz: 110 },
        { type: 'compressor', thresholdDb: -20, ratio: 2, attackMs: 25, releaseMs: 220, makeupGainDb: 2 },
        { type: 'saturation', driveDb: 5, mix: 0.35 },
        { type: 'lowpass', frequencyHz: 10500 },
      ],
    },
    tracks: [
      samplerTrack('keys', 'The felt keys take, untouched, from 0 s.', `${P}keys-take.wav`,
        [{ t: 0, note: { velocity: 0.9 } }], { ...opts, gainDb: -1 }),
      samplerTrack('vox-top', 'Top singer: ghost-vox repitched to the line F4 Eb4 | F4 Db4 | Gb4 F4 | F4 Eb4.', `${P}ghost-vox.wav`,
        top, { ...opts, gainDb: 3, pan: -0.18, effects: [{ type: 'highpass', frequencyHz: 200 }, { type: 'reverb', roomSize: 0.55, decaySeconds: 1.6, wet: 0.24 }] }),
      samplerTrack('vox-low', 'Low singer a third or sixth below, breathing in late.', `${P}ghost-vox.wav`,
        low, { ...opts, gainDb: -1, pan: 0.22, effects: [{ type: 'highpass', frequencyHz: 180 }, { type: 'reverb', roomSize: 0.6, decaySeconds: 1.8, wet: 0.28 }] }),
      samplerTrack('glass', 'Glass hit doubling the top note an octave up on each downbeat, like a soft vibraphone.', `${P}glass-hit.wav`,
        glass, { ...opts, gainDb: 8, pan: 0.3, effects: [{ type: 'lowpass', frequencyHz: 6000 }, { type: 'reverb', roomSize: 0.7, decaySeconds: 2.2, wet: 0.35 }] }),
      samplerTrack('air', 'Air bed: two overlapping passes of air-texture as the record\'s room tone.', `${P}air-texture.wav`,
        [{ t: 0, note: { velocity: 0.5 } }, { t: tick(B, 3, 3), note: { velocity: 0.5, offsetSeconds: 1.5 } }], { ...opts, gainDb: -12, effects: [{ type: 'lowpass', frequencyHz: 7000 }] }),
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'projects', 'crate-01.json');
  writeFileSync(out, JSON.stringify(crate(), null, 2) + '\n');
  console.log(out);
}
