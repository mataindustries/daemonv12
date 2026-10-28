/** Candidate A — DUSTY POCKET. 96 BPM, four bars (exactly 10.000 s), Bb minor.
 *
 * The CRATE-01 record is chopped into its "oh" (chord attack + first syllable) and "ah" (second syllable) regions and
 * replayed in a choked, mono-sampler style: a long chop, a short re-stab, an answer. The rootless chops take their
 * harmony from the Moog bass under them: Bbm9 | Ebm11 | Bbm9 -> Db/Ab | Gbmaj9 -> Dmaj9. The surprise is the Gbmaj9 chop
 * replayed a major third down (rate 0.7937): a slowed, darker D major 9 a hexatonic pole away from the Bb minor that
 * returns at the loop point (C#=Db stays, A->Bb, E->F, F#->F).
 *
 * Feel: no global swing. Each player has its own clock — the kick pushes and drags by hand, the snare sits 20-35 ms
 * behind, the chops lean early, the bass trails the kick by about 10 ms and anticipates bar lines, the hat drags its
 * off-beats about 20 ms and the air shaker drags its off-sixteenths about 30 ms.
 *
 * The pattern is placed twice (8 bars plus a bar of tail room); the deliverable is the second cycle, which already
 * contains the first cycle's wrapped tails. Run: node experiments/sample-lab-01/scripts/dusty-pocket.ts */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { place, rate, samplerTrack, type Ev } from './score.ts';
import { CRATE_CHOPS } from './crate-01.ts';

export const BPM = 96, BARS = 4, CYCLES = 2;
const P = 'assets/palette/', CRATE = 'assets/resampled/crate-01.wav';
/** Bar (1-4), sixteenth index (0-15) and a human offset in ms. */
const at = (bar: number, sixteenth: number, ms = 0) => place(BPM, bar, sixteenth, ms);

// ---------------------------------------------------------------- chops
type ChopId = keyof typeof CRATE_CHOPS;
function chop(id: ChopId, velocity: number, gate: string, extra: { semitones?: number; release?: number; attack?: number; into?: number } = {}) {
  const c = CRATE_CHOPS[id]!;
  return {
    velocity, gate, offsetSeconds: c.offsetSeconds + (extra.into ?? 0), endSeconds: c.endSeconds,
    ...(extra.semitones ? { playbackRate: rate(extra.semitones) } : {}),
    envelope: { attackSeconds: extra.attack ?? 0.002, releaseSeconds: extra.release ?? 0.06 }, chokeGroup: 'chops',
  };
}
const CHOPS: Ev[] = [
  // Bar 1 — Bbm9: the "oh" lands with the kick, a short re-stab rushes the 2a, the "ah" answers on the 3&.
  { ...at(1, 0, 2), note: chop('Bbm9-oh', 0.92, '3/8', { release: 0.09 }) },
  { ...at(1, 7, -13), note: chop('Bbm9-oh', 0.6, '1/16', { release: 0.025 }) },
  { ...at(1, 10, -6), note: chop('Bbm9-ah', 0.8, '1/4', { release: 0.12 }) },
  // Bar 2 — Ebm11: same shape, the whole phrase leaning earlier.
  { ...at(2, 0, -9), note: chop('Ebm11-oh', 0.88, '3/8', { release: 0.09 }) },
  { ...at(2, 7, -15), note: chop('Ebm11-oh', 0.58, '1/16', { release: 0.025 }) },
  { ...at(2, 10, -4), note: chop('Ebm11-ah', 0.78, '1/4', { release: 0.12 }) },
  // Two grains from inside the held vowel stutter into bar 3 (offsets skip the attack, so they swell rather than strike).
  { ...at(2, 13, 10), note: chop('Ebm11-ah', 0.46, '1/32', { into: 0.31, attack: 0.008, release: 0.02 }) },
  { ...at(2, 15, -8), note: chop('Bbm9-ah', 0.42, '1/32', { into: 0.18, attack: 0.006, release: 0.02 }) },
  // Bar 3 — Bbm9 again, but the stab moves to the 2& and the answer holds over the bass walking down to Ab (Db/Ab).
  { ...at(3, 0, 4), note: chop('Bbm9-oh', 0.9, '3/8', { release: 0.09 }) },
  { ...at(3, 6, -10), note: chop('Bbm9-oh', 0.56, '1/16', { release: 0.025 }) },
  { ...at(3, 10, -8), note: chop('Bbm9-ah', 0.82, '3/8', { release: 0.14 }) },
  // Bar 4 — Gbmaj9, a stab, then the same chop a major third down: D major 9, slower and darker, released before the loop.
  { ...at(4, 0, -7), note: chop('Gbmaj9-oh', 0.88, '1/4', { release: 0.08 }) },
  { ...at(4, 5, -12), note: chop('Gbmaj9-oh', 0.58, '1/16', { release: 0.025 }) },
  { ...at(4, 7, 6), note: chop('Gbmaj9-oh', 0.4, '1/32', { into: 0.42, attack: 0.01, release: 0.02 }) },
  { ...at(4, 8, 3), note: chop('Gbmaj9-oh', 0.94, '7/16', { semitones: -4, release: 0.12 }) },
];

// ---------------------------------------------------------------- bass (bass-db.wav is Db2)
function bass(semitones: number, velocity: number, gate: string, glideFrom?: number, glide = '1/32') {
  return {
    velocity, gate, playbackRate: rate(glideFrom ?? semitones),
    ...(glideFrom !== undefined ? { glide: { to: rate(semitones), duration: glide } } : {}),
    envelope: { attackSeconds: 0.003, releaseSeconds: 0.05 }, chokeGroup: 'bass',
  };
}
const Bb1 = -3, Ab1 = -5, G1 = -6, Gb1 = -7, A1 = -4, Db2 = 0, D2 = 1, Eb2 = 2, Gb2 = 5, Bb2 = 9;
const BASS: Ev[] = [
  { ...at(1, 0, 12), note: bass(Bb1, 0.92, '5/16') },
  { ...at(1, 7, 4), note: bass(Db2, 0.6, '1/16') },
  { ...at(1, 10, 14), note: bass(Bb1, 0.85, '3/16') },
  { ...at(1, 14, -8), note: bass(D2, 0.62, '1/16') },
  { ...at(2, 0, 9), note: bass(Eb2, 0.92, '5/16', D2) },
  { ...at(2, 6, 20), note: bass(Bb1, 0.5, '1/32') },
  { ...at(2, 8, 6), note: bass(Gb2, 0.68, '1/16') },
  { ...at(2, 10, 11), note: bass(Eb2, 0.84, '3/16') },
  { ...at(2, 14, -10), note: bass(Db2, 0.66, '1/8') },
  { ...at(3, 0, 13), note: bass(Bb1, 0.92, '1/4') },
  { ...at(3, 6, 5), note: bass(Bb2, 0.48, '1/32') },
  { ...at(3, 8, 9), note: bass(Ab1, 0.88, '5/16') },
  { ...at(3, 13, 4), note: bass(Ab1, 0.5, '1/32') },
  { ...at(3, 15, -9), note: bass(G1, 0.6, '1/16') },
  { ...at(4, 0, 10), note: bass(Gb1, 0.94, '3/8') },
  { ...at(4, 8, 8), note: bass(D2, 0.9, '5/16', Db2, '1/16') },
  { ...at(4, 13, 2), note: bass(D2, 0.48, '1/32') },
  { ...at(4, 14, -14), note: bass(A1, 0.74, '1/8') },
];

// ---------------------------------------------------------------- drums
const kick = (v: number, r = 0.985) => ({ velocity: v, playbackRate: r });
const KICK: Ev[] = [
  { ...at(1, 0, 3), note: kick(0.95) }, { ...at(1, 7, -11), note: kick(0.7, 0.99) }, { ...at(1, 10, 9), note: kick(0.86) },
  { ...at(2, 0, -4), note: kick(0.9, 0.98) }, { ...at(2, 3, 14), note: kick(0.52, 0.995) }, { ...at(2, 10, 6), note: kick(0.85) }, { ...at(2, 15, -8), note: kick(0.6, 0.99) },
  { ...at(3, 0, 2), note: kick(0.93) }, { ...at(3, 7, -14), note: kick(0.68, 0.99) }, { ...at(3, 10, 11), note: kick(0.83, 0.98) }, { ...at(3, 13, 5), note: kick(0.58) },
  { ...at(4, 0, -3), note: kick(0.9) }, { ...at(4, 6, 18), note: kick(0.72, 0.99) }, { ...at(4, 10, 2), note: kick(0.78, 0.98) },
];
const snare = (v: number, r = 0.84) => ({ velocity: v, playbackRate: r });
const SNARE: Ev[] = [
  { ...at(1, 4, 24), note: snare(0.9) }, { ...at(1, 12, 29), note: snare(0.93, 0.835) },
  { ...at(2, 4, 21), note: snare(0.88) }, { ...at(2, 9, 8), note: snare(0.27, 0.86) }, { ...at(2, 12, 31), note: snare(0.95, 0.835) }, { ...at(2, 14, 12), note: snare(0.22, 0.86) },
  { ...at(3, 4, 26), note: snare(0.9) }, { ...at(3, 12, 23), note: snare(0.9, 0.835) }, { ...at(3, 15, 5), note: snare(0.3, 0.86) },
  { ...at(4, 4, 28), note: snare(0.92) }, { ...at(4, 12, 17), note: snare(0.48, 0.85) }, { ...at(4, 12, 35), note: snare(0.88, 0.835) },
];
// Hat: eighths, accented and dragged off-beats; a few sixteenth pickups. Bar 4's third beat breathes for the D chord.
const HAT: Ev[] = [];
for (let bar = 1; bar <= 4; bar++) for (let e = 0; e < 8; e++) {
  if (bar === 4 && (e === 4 || e === 5)) continue;
  const off = e % 2 === 1, drag = off ? 16 + ((bar * 7 + e * 5) % 11) : ((bar + e * 3) % 5) - 2;
  HAT.push({ ...at(bar, e * 2, drag), note: { velocity: off ? 0.72 + 0.04 * ((bar + e) % 3) : 0.5 + 0.04 * ((bar * e) % 3), playbackRate: 0.72 } });
}
HAT.push({ ...at(2, 15, 27), note: { velocity: 0.38, playbackRate: 0.74 } }, { ...at(4, 15, 22), note: { velocity: 0.42, playbackRate: 0.74 } },
  { ...at(3, 3, 30), note: { velocity: 0.3, playbackRate: 0.74 } });
// Air shaker: sixteenth slices from different places in air-texture, so no two hits are the same grain.
const SHAKER: Ev[] = [];
for (let bar = 1; bar <= 4; bar++) for (let s = 0; s < 16; s++) {
  if ((bar === 2 && s >= 12) || (bar === 4 && s >= 8 && s < 12)) continue;
  const odd = s % 2 === 1, k = (bar - 1) * 16 + s;
  SHAKER.push({ ...at(bar, s, odd ? 28 + (k % 4) * 2 : (k % 3) - 1), note: {
    velocity: odd ? 0.32 + 0.06 * (k % 3) : s % 4 === 2 ? 0.55 : 0.4,
    offsetSeconds: +(0.6 + ((k * 0.377) % 6.6)).toFixed(3), gate: '1/32', envelope: { attackSeconds: 0.002, releaseSeconds: 0.035 } } });
}

/** Authored events per track id, with their nominal grid ticks (for the event map's human-offset column). */
export const TRACK_EVENTS: Record<string, Ev[]> = { chops: CHOPS, bass: BASS, kick: KICK, snare: SNARE, hat: HAT, shaker: SHAKER };

/** `cycles` identical four-bar cycles: the delivered project uses two; the seam check renders three. */
export function dustyPocket(cycles = CYCLES) {
  const opts = { bars: BARS, cycles };
  return {
    formatVersion: 1,
    title: 'DUSTY POCKET (SAMPLE LAB 01, candidate A)',
    description: 'Warm, minimal, head-nodding loop chopped from CRATE-01 over a Moog-style bass. Bbm9 | Ebm11 | Bbm9 -> Db/Ab | Gbmaj9 -> Dmaj9 (the Gbmaj9 chop replayed a major third down). Two identical cycles plus a bar of tail room; the deliverable is the second cycle.',
    bpm: BPM, timeSignature: '4/4', key: 'Bb minor', bars: BARS * cycles, seed: 1,
    render: { duration: { bars: BARS * cycles + 1 }, tail: 'auto' }, // one bar of margin: voices ringing over the last
    // cycle boundary must not meet the render's end, where the engine forces their release
    master: {
      gainDb: -1.8,
      effects: [
        { type: 'highpass', frequencyHz: 28 },
        { type: 'compressor', thresholdDb: -15.8, ratio: 2, attackMs: 18, releaseMs: 120, makeupGainDb: 3 },
        { type: 'saturation', driveDb: 3, mix: 0.3 },
      ],
    },
    tracks: [
      samplerTrack('chops', 'CRATE-01 chops: oh/ah regions, choked like a mono sampler pad.', CRATE, CHOPS,
        { ...opts, gainDb: -4, effects: [{ type: 'highpass', frequencyHz: 210 }, { type: 'lowpass', frequencyHz: 7800 }, { type: 'saturation', driveDb: 5, mix: 0.3 }] }),
      samplerTrack('bass', 'bass-db.wav played as a mono Moog line with gates and two slides.', `${P}bass-db.wav`, BASS,
        { ...opts, gainDb: -5.5, effects: [{ type: 'lowpass', frequencyHz: 1400 }, { type: 'saturation', driveDb: 4, mix: 0.25 }] }),
      samplerTrack('kick', 'mechanical-kick, hand-placed, with tiny per-hit tuning differences.', `${P}mechanical-kick.wav`, KICK,
        { ...opts, gainDb: 0, effects: [{ type: 'saturation', driveDb: 9, mix: 0.45 }, { type: 'lowpass', frequencyHz: 7000 }] }),
      samplerTrack('snare', 'industrial-snare down three semitones, laid back 20-35 ms, ghost notes and one flam.', `${P}industrial-snare.wav`, SNARE,
        { ...opts, gainDb: 0, effects: [{ type: 'highpass', frequencyHz: 140 }, { type: 'lowpass', frequencyHz: 8500 }, { type: 'saturation', driveDb: 5, mix: 0.35 }, { type: 'reverb', roomSize: 0.35, decaySeconds: 0.7, wet: 0.14 }] }),
      samplerTrack('hat', 'pixel-hat slowed to 0.72 for a softer closed hat; dragged accented off-beats.', `${P}pixel-hat.wav`, HAT,
        { ...opts, gainDb: 1, pan: 0.22, effects: [{ type: 'highpass', frequencyHz: 2500 }, { type: 'lowpass', frequencyHz: 11000 }] }),
      samplerTrack('shaker', 'air-texture sliced into sixteenth grains as a dragging shaker.', `${P}air-texture.wav`, SHAKER,
        { ...opts, gainDb: 0, pan: -0.28, effects: [{ type: 'highpass', frequencyHz: 4500 }] }),
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'projects', 'dusty-pocket.json');
  writeFileSync(out, JSON.stringify(dustyPocket(), null, 2) + '\n');
  console.log(out);
}
