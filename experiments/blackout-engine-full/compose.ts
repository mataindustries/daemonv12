/**
 * BLACKOUT//ENGINE · full-length edition. Industrial hip-hop, 128 BPM, G minor, 72 bars = exactly 2:15.000.
 *
 * Built from the approved 30-second experiment (experiments/blackout-engine-001, unchanged): the Living Bass riff
 * whose octave scream ratchets down the stair G-F#-F-E-Eb-D, the mechanical engine room, and the Impossible Voice
 * lament revealed by a power failure. New here:
 *
 *   Hook B, "the answer": D-F-G | Bb-A-G on struck metal, in the riff's own 3+3+2 rhythm doubled in length (one
 *     note on beats 1, the and-of-2 and 4). In the first collapse the voice sings it after the stair, which reveals
 *     that the machine's second hook is the second half of the human's song.
 *   The overload: the escalation builds toward a drop and the breaker trips instead.
 *   The transformation: the riff limps in triplets over a G pedal while bowed metal moves the harmony
 *     i - bVI - iv - V, then i - bVI - bII - V (the riff's Ab pickup grown into a chord).
 *   The drop: the stair in slow motion, one gear tooth at a time.
 *   The climax: riff, Hook B, the voice's high stair and climb, a slow chromatic climb on bowed metal (the stair
 *     inverted) and contrary-motion wedges on the bells, then the second blackout.
 *   The resolution: the voice sings the whole song for the first time (stair + answer); the engine returns warm;
 *     the last cadence is Ab major -> G major, every voice down one semitone: the riff's Ab-G pickup as harmony,
 *     and the first B natural in the record.
 *
 * Writes into source/ (or the directory given as the first argument):
 *   blackout-engine-full.rack.json, blackout-engine-full.project.json, kick/snare/anvil/breaker-kit.json, stem-groups.json
 *
 *   node experiments/blackout-engine-full/compose.ts [OUT_DIR]
 *
 * Times are beats (quarter notes) from the start of bar 1; a bar is 4 beats; bar n starts at beat 4(n-1).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/** The one bounded QA/fix pass (README). BLACKOUT_FULL_PRE_QA=1 reproduces the candidate exactly as measured before it. */
export const PRE_QA = process.env.BLACKOUT_FULL_PRE_QA === '1';
export const BPM = 128, BARS = 72, END = BARS * 4;
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
const ms = (m: number) => m / 1000 / BEAT_SECONDS;                 // milliseconds -> beats
/** Deterministic humanisation (no Math.random): a fixed hash of an index, in [-1, 1). */
const hash = (i: number) => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
type Opts = Record<string, string | number>;
type RackNote = [number, number, string, number, Opts?];
const rn = (beat: number, beats: number, pitch: string, vel: number, o?: Opts): RackNote => (o ? [r6(beat), r6(beats), pitch, r6(vel), o] : [r6(beat), r6(beats), pitch, r6(vel)]);
type Curve = [number, number][];
const T = 1 / 3;                                                      // a triplet eighth, in beats
const bar = (n: number) => 4 * (n - 1);                               // first beat of bar n

// ------------------------------------------------------------------------------------------------ form
export const TRIP = 72;            // bar 19: the overload trip, where the drop should land        0:33.75
export const COLD = 96;            // bar 25: the engine coughs                                    0:45.00
export const TRANS = 112;          // bar 29: the machine returns changed (triplets)              0:52.50
export const CYCLE2 = 144;         // bar 37: second harmonic cycle, voice enters                 1:07.50
export const DROP = 176;           // bar 45: the stair in slow motion                            1:22.50
export const CLIMAX = 184;         // bar 47                                                      1:26.25
export const PHASE2 = 200, PHASE3 = 216;
export const BLACKOUT_2 = 238;     // bar 60 beat 3: the breaker trips under the scream           1:51.56
export const WARM = 260;           // bar 66: the engine returns warm                             2:01.88
export const FINAL = 280;          // bar 71: Ab major -> G major lands                          2:11.25
export const SECTIONS = [
  { id: 'ignition', bars: 8, development: 'The approved riff from the first downbeat; the engine room joins from bar 3. Kick on the riff strokes, snare on 3.' },
  { id: 'escalation', bars: 10, development: 'Hook B (the answer) on bells in the riff rhythm augmented; the kick follows the bells; the scream gets stuck, the clock races; overload.' },
  { id: 'collapse', bars: 6, development: 'The breaker trips on the downbeat the build promised. Silence; the lament reaches D for the first time; the voice starts the answer and the bells echo it.' },
  { id: 'cold-start', bars: 4, development: 'Warm coughs chop the held Bb; stroke by stroke hotter; bar 28 shifts gear into triplets.' },
  { id: 'transformation', bars: 16, development: 'The riff limping in triplets over a G pedal; bowed-metal chords i-bVI-iv-V then i-bVI-bII-V; Hook B sequenced through them; hand drums; a chopped vocal line.' },
  { id: 'drop', bars: 2, development: 'The stair in slow motion: the bass alone, one gear tooth every 1.5 beats; the clock; one high cry.' },
  { id: 'climax', bars: 14, development: 'Riff + Hook B; the voice sings the stair high, then climbs to C6; bowed metal climbs D-G chromatically; bell wedges in contrary motion; second blackout.' },
  { id: 'resolution', bars: 12, development: 'The whole song sung alone; the machine answers warm; Ab major -> G major.' },
];

// ================================================================================================ LIVING BASS
// Bar A: G1 strokes (0, 3, 6 sixteenths), octave scream G2 with the snare, ratchet glide to D2, a hole, Ab1 pickup.
// Bar B: two strokes, the scream on the and-of-2, the stair on eighths F#2 F2 E2 Eb2, D2 pickup. (Approved, unchanged.)
interface RiffOpts { v?: number; scoop?: number; glide?: number }
function riffA(c: number, o: RiffOpts = {}): RackNote[] {
  const v = o.v ?? 1;
  return [
    rn(c, 0.55, 'G1', 0.95 * v, { articulation: 'accent', scoop: o.scoop ?? 4 }), rn(c + 0.75, 0.45, 'G1', 0.86 * v), rn(c + 1.5, 0.35, 'G1', 0.8 * v),
    rn(c + 2, 0.3, 'G2', 0.98 * v, { articulation: 'accent' }), rn(c + 2.3, 0.8, 'D2', 0.92 * v, { articulation: 'legato', slide: o.glide ?? 0.5 }),
    rn(c + 3.5, 0.45, 'Ab1', 0.88 * v),
  ];
}
function riffB(c: number, o: RiffOpts = {}): RackNote[] {
  const v = o.v ?? 1;
  return [
    rn(c, 0.55, 'G1', 0.95 * v, { articulation: 'accent', scoop: o.scoop ?? 4 }), rn(c + 0.75, 0.45, 'G1', 0.86 * v),
    rn(c + 1.5, 0.5, 'G2', 0.98 * v, { articulation: 'accent' }),
    ...([['F#2', 2, 0.5, 0.9], ['F2', 2.5, 0.5, 0.88], ['E2', 3, 0.5, 0.88], ['Eb2', 3.5, 0.25, 0.88], ['D2', 3.75, 0.25, 0.9]] as const)
      .map(([p, b, d, vv]) => rn(c + b, d, p, vv * v, { articulation: 'legato', slide: 0.06 })),
  ];
}
/** Pressure: the scream sticks, four fresh strikes on G2 (the gear slipping), then a fast glide and the pickup. */
function riffP(c: number): RackNote[] {
  return [
    rn(c, 0.55, 'G1', 0.97, { articulation: 'accent', scoop: 5 }), rn(c + 0.75, 0.45, 'G1', 0.88), rn(c + 1.5, 0.35, 'G1', 0.84),
    ...[2, 2.25, 2.5, 2.75].map((b, i) => rn(c + b, 0.22, 'G2', 0.9 + 0.03 * i, { articulation: 'accent' })),
    rn(c + 3, 0.45, 'D2', 0.92, { articulation: 'legato', slide: 0.25 }), rn(c + 3.5, 0.45, 'Ab1', 0.9),
  ];
}
/** The changed machine: strokes and scream on four even quarter-note triplets (the 3+3+2 squashed into a limp). */
function riffAT(c: number, v = 1): RackNote[] {
  return [
    rn(c, 0.45, 'G1', 0.95 * v, { articulation: 'accent', scoop: 4 }), rn(c + 2 * T, 0.45, 'G1', 0.86 * v), rn(c + 4 * T, 0.45, 'G1', 0.82 * v),
    rn(c + 2, T, 'G2', 0.98 * v, { articulation: 'accent' }), rn(c + 2 + T, 1, 'D2', 0.9 * v, { articulation: 'legato', slide: 0.45 }),
    rn(c + 11 * T, T, 'Ab1', 0.86 * v),
  ];
}
/** ...and the stair as six triplet eighths from the scream: G2 F#2 F2 E2 Eb2 D2 fill beats 3-4 exactly. */
function riffBT(c: number, v = 1): RackNote[] {
  return [
    rn(c, 0.45, 'G1', 0.95 * v, { articulation: 'accent', scoop: 4 }), rn(c + 2 * T, 0.45, 'G1', 0.86 * v), rn(c + 4 * T, 0.45, 'G1', 0.82 * v),
    rn(c + 2, T, 'G2', 0.98 * v, { articulation: 'accent' }),
    ...(['F#2', 'F2', 'E2', 'Eb2', 'D2'] as const).map((p, i) => rn(c + 2 + (i + 1) * T, T, p, (0.9 - 0.01 * i) * v, { articulation: 'legato', slide: 0.05 })),
  ];
}
const bassNotes: RackNote[] = [
  // ignition (bars 1-8)
  ...riffA(0, { scoop: 7 }), ...riffB(4), ...riffA(8), ...riffB(12), ...riffA(16, { glide: 0.6 }), ...riffB(20), ...riffA(24), ...riffB(28),
  // escalation: bar A under Hook B's first statement (the bells take the melody), the stair returns in bar 12
  ...riffA(32), ...riffA(36, { glide: 0.6 }), ...riffA(40), ...riffB(44),
  ...riffA(48, { scoop: 5 }), ...riffB(52), ...riffA(56, { glide: 0.6 }), ...riffB(60),
  ...riffP(64), ...riffB(68),                                       // pressure; the D2 pickup at 71.75 leads into a downbeat that never comes
  // cold start: bar A warm and soft (no ratchet: a finger slide), stroke by stroke hotter; bar B catches; bar A; then the gear change
  rn(96, 0.5, 'G1', 0.62, { scoop: 1 }), rn(96.75, 0.45, 'G1', 0.66), rn(97.5, 0.35, 'G1', 0.72),
  rn(98, 0.3, 'G2', 0.8), rn(98.3, 0.8, 'D2', 0.78, { articulation: 'legato', slide: 0.9 }), rn(99.5, 0.45, 'Ab1', 0.8),
  ...riffB(100, { v: 0.9, scoop: 2 }), ...riffA(104, { v: 0.96, scoop: 3 }), ...riffBT(108, 0.97),
  // transformation (bars 29-44): the limping riff, alternating
  ...[112, 120, 128, 136, 144, 152, 160, 168].flatMap(c => [...riffAT(c), ...riffBT(c + 4)]),
  // drop: the stair in slow motion, a fresh scream then one ratchet tooth every 1.5 beats
  rn(176, 1.5, 'G2', 1, { articulation: 'accent' }),
  ...([['F#2', 177.5], ['F2', 179], ['E2', 180.5], ['Eb2', 182], ['D2', 183]] as const).map(([p, b], i) => rn(b, b === 183 ? 0.75 : b === 182 ? 1 : 1.5, p, 0.92 - 0.01 * i, { articulation: 'legato', slide: 0.08 })),
  // climax (bars 47-60)
  ...riffA(184, { scoop: 7 }), ...riffB(188), ...riffA(192), ...riffB(196), ...riffA(200, { scoop: 5 }), ...riffB(204), ...riffA(208), ...riffB(212),
  ...riffA(216, { scoop: 7 }), ...riffB(220), ...riffA(224), ...riffB(228), ...riffA(232, { glide: 0.7 }),
  rn(236, 0.55, 'G1', 0.97, { articulation: 'accent', scoop: 4 }), rn(236.75, 0.45, 'G1', 0.9), rn(237.5, 0.5, 'G2', 1, { articulation: 'accent' }),
  // resolution: warm. Under the song: Bb1 when the voice reaches D, then Bb - Eb - D - G under the answer
  rn(248, 3.7, 'Bb1', 0.7), rn(252, 2.8, 'Bb1', 0.68), rn(255, 2.3, 'Eb2', 0.66), rn(257.5, 1.4, 'D2', 0.66), rn(259, 0.9, 'G1', 0.7),
  // the engine returns warm: the riff with finger slides, then the last strokes, Ab1 and the final G1
  ...riffB(260, { v: 0.8, scoop: 1 }), ...riffA(264, { v: 0.8, scoop: 1, glide: 0.9 }), ...riffB(268, { v: 0.78, scoop: 1 }), ...riffA(272, { v: 0.76, scoop: 1, glide: 0.9 }),
  rn(276, 0.55, 'G1', 0.74), rn(276.75, 0.45, 'G1', 0.7), rn(277.5, 0.35, 'G1', 0.66), rn(278, 1.9, 'Ab1', 0.72), rn(280, 5, 'G1', 0.7),
];
/** warm -> machine is the engine's power. The transformation runs a little cooler so the triplet motion is audible. */
const bassMacro = {
  steps: [
    [0, 0.82], [8, 0.86], [16, 0.9], [24, 0.92], [32, 0.93], [48, 0.96], [64, 1],
    [96, 0.04], [96.75, 0.1], [97.5, 0.16], [98, 0.22], [99.5, 0.3], [100, 0.36], [100.75, 0.42], [101.5, 0.5],
    [104, 0.58], [104.75, 0.66], [105.5, 0.74], [108, 0.72], [144, 0.8], [168, 0.86], [176, 1],
    [238, 0.18], [272, 0.14], [280, 0.08],
  ] as Curve,
  glide: 0.04,
};
function bassMotion() {
  const spans: { fromBeat: number; toBeat: number; preset: string }[] = [];
  let at = 0;
  const add = (to: number, preset: string) => { if (to > at) { spans.push({ fromBeat: at, toBeat: to, preset }); at = to; } };
  for (const c of [0, 8, 16, 24, 32, 36, 40, 48, 56]) { add(c + 2.3, 'none'); add(c + 3.5, 'triplets'); }
  add(64, 'none'); add(72, 'thirty-seconds');                       // pressure: the timbre rattles in 32nds
  add(108, 'none'); add(176, 'triplets');                           // the changed machine pulses with its own gait
  add(184, 'revving');                                              // the slow stair revs
  for (const c of [184, 192, 200, 208, 216, 224, 232]) { add(c + 2.3, 'none'); add(c + 3.5, 'growl'); }
  add(238, 'none'); add(END, 'breath');
  return spans;
}

// ================================================================================================ IMPOSSIBLE VOICE (the singer)
const voiceNotes: RackNote[] = [
  // (calibration: three ghost cries in the escalation measured 13-14 dB under the rest wherever they were placed, under
  // the snare or under Hook B, and were removed; the voice is first heard after the trip)
  // collapse: the stair, and for the first time D; then the answer begins and is cut off on Bb
  rn(75.5, 0.5, 'G3', 0.48, { articulation: 'hum', vowel: 'mm' }),
  rn(76, 2, 'G4', 0.8, { articulation: 'cry', cry: 1.5, vowel: 'ah' }), rn(78, 1, 'F#4', 0.74, { articulation: 'legato', vowel: 'ah' }),
  rn(79, 1, 'F4', 0.72, { articulation: 'legato', vowel: 'ah', to: 'oh' }), rn(80, 1.5, 'E4', 0.7, { articulation: 'legato', vowel: 'oh' }),
  rn(81.5, 2.5, 'Eb4', 0.68, { articulation: 'legato', vowel: 'oh' }), rn(84, 3, 'D4', 0.7, { articulation: 'legato', vowel: 'oh', to: 'ah' }),
  rn(88, 1.5, 'D4', 0.66, { vowel: 'oh' }), rn(89.5, 1.5, 'F4', 0.7, { articulation: 'legato', vowel: 'ah' }), rn(91, 1, 'G4', 0.72, { articulation: 'legato', vowel: 'ah' }),
  rn(92, 6.6, 'Bb4', 0.78, { articulation: 'cry', cry: 1, vowel: 'ah', to: 'oh' }),
  // cold start: caught in the gears (bar 26 the stair in unison with the bass, bar 27 the scream and the glide)
  rn(100, 1.5, 'G4', 0.76, { articulation: 'cry', cry: 1.2, vowel: 'ah' }), rn(101.5, 0.5, 'G4', 0.8, { articulation: 'cry', cry: 2, vowel: 'ah' }),
  ...([['F#4', 102, 'ah'], ['F4', 102.5, 'oh'], ['E4', 103, 'ah'], ['Eb4', 103.5, 'oh']] as const).map(([p, b, vw]) => rn(b, 0.5, p, 0.75, { articulation: 'legato', vowel: vw })),
  rn(104, 2, 'G4', 0.8, { articulation: 'cry', cry: 1.2, vowel: 'ah' }), rn(106, 0.3, 'G4', 0.86, { articulation: 'cry', cry: 2.5, vowel: 'ah' }),
  rn(106.3, 1.2, 'Eb4', 0.74, { articulation: 'legato', slide: 0.4, vowel: 'oh' }),
  // transformation, second cycle: one long line falling across the chords, D5 Eb5-D5 C5-Bb4 A4 F#4 (chopped in the triplet gait)
  rn(144, 8, 'D5', 0.74, { vowel: 'ah' }), rn(152, 4, 'Eb5', 0.76, { articulation: 'legato', slide: 0.3, vowel: 'ah' }), rn(156, 4, 'D5', 0.72, { articulation: 'legato', vowel: 'oh' }),
  rn(160, 4, 'C5', 0.74, { articulation: 'legato', vowel: 'ah' }), rn(164, 4, 'Bb4', 0.72, { articulation: 'legato', vowel: 'oh' }),
  rn(168, 4, 'A4', 0.74, { articulation: 'legato', vowel: 'ah' }), rn(172, 4, 'F#4', 0.76, { articulation: 'legato', vowel: 'ah', to: 'oh' }),
  // drop: one cry, high
  rn(180, 3.9, 'G5', 0.82, { articulation: 'cry', cry: 2, vowel: 'ah' }),
  // climax: the stair high (twice, never reaching D), then the climb to C6
  ...[200, 208].flatMap(c => [rn(c, 2, 'G5', 0.82, { articulation: 'cry', cry: 2, vowel: 'ah' }), rn(c + 2, 1, 'F#5', 0.78, { articulation: 'legato', vowel: 'ah' }),
    rn(c + 3, 1, 'F5', 0.78, { articulation: 'legato', vowel: 'ah' }), rn(c + 4, 2, 'E5', 0.78, { articulation: 'legato', vowel: 'oh' }), rn(c + 6, 2, 'Eb5', 0.8, { articulation: 'legato', vowel: 'ah' })]),
  ...([['G5', 216], ['A5', 220], ['Bb5', 224], ['C6', 228]] as const).map(([p, b], i) => rn(b, 4, p, 0.84 + 0.01 * i, { articulation: 'cry', cry: 1.5, vowel: 'ah' })),
  rn(232, 2, 'Bb5', 0.84, { articulation: 'legato', vowel: 'ah' }), rn(234, 3.9, 'G5', 0.86, { articulation: 'cry', cry: 2, vowel: 'ah' }),
];
const voiceMacro = { steps: [[0, 0.03], [96, 0.1], [100, 0.18], [104, 0.26], [112, 0.4], [144, 0.45], [176, 0.5], [200, 0.55], [216, 0.62], [228, 0.7], [238, 0.05]] as Curve, glide: 0.3 };
/**
 * Voice gate (beats, [open, close, dB relative to the track]). Open in the collapse, the drop and the climax (the voice
 * is free above the machine there); chopped in the riff's rhythm in the cold start and in a swung triplet gait in the
 * transformation; tight around the three ghost cries.
 */
export const VOICE_GATE: [number, number, number][] = [
  [74.5, 96.45, -5],
  ...([[96.75, 97.2], [97.5, 97.9], [98, 98.6], [100, 100.45], [100.75, 101.2], [101.5, 101.95], [102, 102.4], [102.5, 102.9], [103, 103.4], [103.5, 103.72],
    [104, 104.45], [104.75, 105.2], [105.5, 105.9], [106, 106.6]] as [number, number][]).map(([a, b]) => [a, b, 3] as [number, number, number]),
  ...Array.from({ length: 32 }, (_, k) => 144 + k).flatMap(k => [[k, k + 0.5, 2], [k + 2 * T, k + 0.92, 2]] as [number, number, number][]),
  [180, 184, 0],
  [200, BLACKOUT_2, 7.5],
];

// ================================================================================================ IMPOSSIBLE VOICE (the last song)
// A separate part so its glass halo can be tuned to G MAJOR (G5 B5 D6 G6). The send stays shut until the final note.
const endNotes: RackNote[] = [
  rn(240, 2, 'G4', 0.66, { vowel: 'ah', scoop: 0.4 }), rn(242, 1, 'F#4', 0.64, { articulation: 'legato', vowel: 'ah' }),
  rn(243, 1, 'F4', 0.62, { articulation: 'legato', vowel: 'ah', to: 'oh' }), rn(244, 1.5, 'E4', 0.62, { articulation: 'legato', vowel: 'oh' }),
  rn(245.5, 2.5, 'Eb4', 0.6, { articulation: 'legato', vowel: 'oh' }), rn(248, 3, 'D4', 0.64, { articulation: 'legato', vowel: 'oh', to: 'ah' }),
  rn(252, 1.5, 'D4', 0.6, { vowel: 'oh' }), rn(253.5, 1.5, 'F4', 0.64, { articulation: 'legato', vowel: 'ah' }), rn(255, 1, 'G4', 0.66, { articulation: 'legato', vowel: 'ah' }),
  rn(256, 1.5, 'Bb4', 0.7, { articulation: 'cry', cry: 1, vowel: 'ah' }), rn(257.5, 1.5, 'A4', 0.66, { articulation: 'legato', vowel: 'ah' }),
  rn(259, 3, 'G4', 0.64, { articulation: 'legato', vowel: 'ah', to: 'oh' }),
  rn(263, 4, 'G3', 0.5, { articulation: 'hum', vowel: 'mm' }),
  rn(268, 1.5, 'Bb3', 0.48, { articulation: 'hum', vowel: 'mm' }), rn(269.5, 1.5, 'A3', 0.46, { articulation: 'legato', vowel: 'mm' }), rn(271, 3, 'G3', 0.46, { articulation: 'legato', vowel: 'mm' }),
  rn(278, 2, 'C5', 0.62, { vowel: 'ah' }), rn(280, 3.5, 'B4', 0.6, { articulation: 'legato', slide: 0.3, vowel: 'ah', to: 'oh' }),
];

// ================================================================================================ MECHANICAL ORCHESTRA: the bells (Hook B)
// Hook B on a struck modal bar, each note bounced by its hammer a sixteenth later; doubled by the buzzing tine.
const bellNotes: RackNote[] = [], tineNotes: RackNote[] = [];
const BIG = [0, 1.5, 3];                                              // the riff's 3+3+2, twice as long
function hookB(c: number, pitches: string[], v: number, o: { bounce?: boolean; tine?: string[] | false; tineV?: number; times?: number[]; art?: string } = {}) {
  const times = o.times ?? BIG;
  pitches.forEach((p, i) => {
    bellNotes.push(rn(c + times[i]!, 1, p, v, { articulation: o.art ?? 'hard' }));
    if (o.bounce !== false) bellNotes.push(rn(c + times[i]! + 0.25, 0.5, p, v * 0.42, { articulation: 'strike' }));
    if (o.tine !== false) tineNotes.push(rn(c + times[i]!, 0.5, (o.tine ?? pitches)[i]!, o.tineV ?? 0.5));
  });
}
const ANSWER: [string[], string[], string[], string[]] = [['D5', 'F5', 'G5'], ['Bb5', 'A5', 'G5'], ['D5', 'F5', 'G5'], ['C6', 'Bb5', 'A5']];
// escalation, phrase 1 and 2; pressure an octave up
ANSWER.forEach((ps, i) => hookB(32 + 4 * i, ps, 0.74));
[['D5', 'F5', 'G5'], ['Bb5', 'A5', 'G5'], ['D5', 'F5', 'G5'], ['D6', 'C6', 'Bb5']].forEach((ps, i) => hookB(48 + 4 * i, ps, 0.76));
hookB(64, ['D6', 'F6', 'G6'], 0.78); hookB(68, ['Bb6', 'A6', 'G6'], 0.8);
// collapse: the machine echoes the human's answer, softly, a dotted eighth late and an octave up
[[88.75, 'D5'], [90.25, 'F5'], [91.75, 'G5'], [92.75, 'Bb5']].forEach(([b, p]) => bellNotes.push(rn(b as number, 1.5, p as string, 0.44, { articulation: 'soft' })));
// transformation: half-note triplets (three even notes per bar), Hook B sequenced through the chords
const TRIPLET_HALF = [0, 4 * T, 8 * T];
const CYCLE: [number, string[]][] = [
  [112, ['D5', 'F5', 'G5']], [116, ['Bb5', 'A5', 'G5']], [120, ['Eb5', 'G5', 'Bb5']], [124, ['C6', 'Bb5', 'G5']],
  [128, ['C5', 'Eb5', 'G5']], [132, ['Ab5', 'G5', 'Eb5']], [136, ['D5', 'F#5', 'A5']], [140, ['C6', 'A5', 'F#5']],
  [144, ['D5', 'F5', 'G5']], [148, ['Bb5', 'A5', 'G5']], [152, ['Eb5', 'G5', 'Bb5']], [156, ['C6', 'Bb5', 'G5']],
  [160, ['C5', 'Eb5', 'Ab5']], [164, ['Bb5', 'Ab5', 'Eb5']], [168, ['D5', 'F#5', 'A5']], [172, ['C6', 'A5', 'F#5']],
];
for (const [c, ps] of CYCLE) hookB(c, ps, 0.62, { bounce: false, times: TRIPLET_HALF, art: 'strike', tine: c >= CYCLE2 ? ps : false, tineV: 0.42 });
// climax: the original Hook B (tine an octave up while the voice is silent), then the voice's register is left clear
const up = (ps: string[]) => ps.map(p => p.replace(/(\d)$/, d => String(Number(d) + 1)));
[184, 188, 192, 196].forEach((c, i) => hookB(c, ANSWER[i]!, 0.78, { tine: up(ANSWER[i]!), tineV: 0.48 }));
[200, 204, 208, 212].forEach((c, i) => hookB(c, ANSWER[i]!, 0.74, { tine: false }));
// phase 3: tolls on the A bars, wedges (contrary to the bass stair) on the B bars
for (const c of [216, 224]) bellNotes.push(rn(c, 2, 'G4', 0.66, { articulation: 'ring' }), rn(c, 2, 'D5', 0.58, { articulation: 'ring' }));
for (const c of [220, 228]) ([['D5', 1.5], ['Eb5', 2], ['E5', 2.5], ['F5', 3], ['F#5', 3.5], ['G5', 3.75]] as const).forEach(([p, b], i) => {
  bellNotes.push(rn(c + b, 0.5, p, 0.62 + 0.03 * i, { articulation: 'hard' }));
  tineNotes.push(rn(c + b, 0.5, up([p])[0]!, 0.42 + 0.02 * i, { articulation: 'buzz' }));
});
hookB(232, ANSWER[0]!, 0.8, { tine: up(ANSWER[0]!), tineV: 0.5 }); bellNotes.push(rn(236, 1, 'Bb5', 0.8, { articulation: 'hard' }), rn(237.5, 1, 'A5', 0.8, { articulation: 'hard' }));
// resolution: the clockwork end of the same bar, a music box; chords under the song, Hook B at rest, the last cadence
const chord = (b: number, ps: string[], v: number, art = 'soft', spread = 0) => ps.forEach((p, i) => bellNotes.push(rn(b + i * spread, 2, p, v, { articulation: art })));
chord(248, ['Bb4', 'D5', 'F5'], 0.4, 'soft', T); chord(255, ['Bb4', 'Eb5', 'G5'], 0.4); chord(257.5, ['A4', 'D5', 'F#5'], 0.4); chord(259, ['Bb4', 'D5', 'G5'], 0.42);
[[260, ANSWER[0]!], [264, ANSWER[1]!], [268, ANSWER[0]!], [272, ANSWER[1]!]].forEach(([c, ps]) => hookB(c as number, ps as string[], 0.46, { bounce: false, tine: false, art: 'soft' }));
chord(278, ['Ab4', 'C5', 'Eb5', 'Ab5'], 0.5, 'ring'); chord(FINAL, ['G4', 'B4', 'D5', 'G5'], 0.56, 'ring');
tineNotes.push(rn(278, 2, 'C6', 0.36, { articulation: 'clean' }), rn(278, 2, 'Eb6', 0.32, { articulation: 'clean' }),
  rn(FINAL, 4, 'B5', 0.38, { articulation: 'clean' }), rn(FINAL, 4, 'D6', 0.32, { articulation: 'clean' }), rn(FINAL, 4, 'G6', 0.3, { articulation: 'clean' }));

// ================================================================================================ MECHANICAL ORCHESTRA: bowed metal
const bowNotes: RackNote[] = [
  // collapse: the dead machine hums an open fifth when the voice first reaches D
  rn(84, 12, 'G2', 0.42, { articulation: 'swell' }), rn(84, 12, 'D3', 0.38, { articulation: 'swell' }),
  // transformation: the harmony moves around the pedal; cycle 2 swaps iv for bII (Ab major)
  ...([[112, ['G3', 'Bb3', 'D4']], [120, ['G3', 'Bb3', 'Eb4']], [128, ['G3', 'C4', 'Eb4']], [136, ['F#3', 'A3', 'D4']],
    [144, ['G3', 'Bb3', 'D4']], [152, ['G3', 'Bb3', 'Eb4']], [160, ['Ab3', 'C4', 'Eb4']], [168, ['F#3', 'A3', 'D4']]] as [number, string[]][])
    .flatMap(([b, ps]) => ps.map(p => rn(b, 7.9, p, 0.42, { articulation: 'swell' }))),
  // climax: the stair inverted and slowed, D4 up to G4 under the voice, then G4 + D5 until the breaker
  ...([['D4', 200, 8], ['Eb4', 208, 4], ['E4', 212, 4], ['F4', 216, 4], ['F#4', 220, 4], ['G4', 224, 8]] as const).map(([p, b, d], i) => rn(b, d, p, 0.5 + 0.02 * i, { articulation: 'swell' })),
  rn(232, 6, 'G4', 0.62, { articulation: 'swell' }), rn(232, 6, 'D5', 0.52, { articulation: 'swell' }),
];

// ================================================================================================ HAND SKIN: the human drummer
const skinNotes: RackNote[] = [];
const sk = (b: number, p: string, art: string, v: number, beats = 0.3) => skinNotes.push(rn(b, beats, p, v, { articulation: art }));
// bar 28: the gear-change fill
sk(108 + 8 * T, 'D3', 'open', 0.5); sk(111, 'D3', 'open', 0.55); sk(111 + T, 'C3', 'open', 0.6); sk(111 + 2 * T, 'G2', 'bass', 0.7);
// transformation: a talking-drum part in the triplet gait, answering the machine in its holes
for (let c = TRANS; c < DROP; c += 8) {
  sk(c + T, 'G3', 'tap', 0.32); sk(c + 1, 'D3', 'open', 0.55); sk(c + 1 + 2 * T, 'G3', 'tap', 0.3); sk(c + 2 + T, 'G3', 'slap', 0.5); sk(c + 3, 'C3', 'open', 0.55); sk(c + 3 + T, 'G3', 'tap', 0.28);
  const d = c + 4;
  sk(d + 2 * T, 'D3', 'open', 0.5); sk(d + 1 + T, 'G3', 'tap', 0.3); sk(d + 2 + 2 * T, 'G3', 'slap', 0.55);
  if (c >= CYCLE2 && c + 8 < DROP) sk(d + 3 + T, 'D3', 'roll', 0.5, 2 * T); else sk(d + 3 + T, 'G2', 'bass', 0.62);
}
sk(174 + 2 * T, 'G3', 'slap', 0.5); sk(175, 'D3', 'open', 0.55); sk(175 + T, 'C3', 'open', 0.6); sk(175 + 2 * T, 'G2', 'bass', 0.7);
// climax phase 3: palm booms on 4 with the bells' third note
for (let c = PHASE3; c < 232; c += 4) sk(c + 3, 'G2', 'bass', 0.6);
// resolution: hands instead of the kit under the warm engine (palm on the strokes, an open tone where the hammer was)
for (let c = WARM; c < 276; c += 4) { sk(c, 'G2', 'bass', 0.5); sk(c + 0.75, 'G2', 'bass', 0.45); sk(c + 1.5, 'G3', 'tap', 0.25); sk(c + 2, 'D3', 'open', 0.5); sk(c + 3.5, 'G3', 'tap', 0.22); }
sk(276, 'G2', 'bass', 0.45); sk(276.75, 'G2', 'bass', 0.4);

// ================================================================================================ the engine room: clock, log, spring, bearings, gong
const clockNotes: RackNote[] = [];
const tick = (b: number, v: number) => clockNotes.push(rn(b, 0.25, 'D6', v, { articulation: 'tick' }));
const tock = (b: number, v: number) => clockNotes.push(rn(b, 0.25, 'G5', v, { articulation: 'tock' }));
const clockBar = (c: number, v = 1) => { for (const b of [0.5, 1.5, 2.5, 3.5]) tick(c + b, (b === 1.5 || b === 3.5 ? 0.4 : 0.46) * v); tock(c + 1, 0.6 * v); tock(c + 3, 0.6 * v); };
for (let c = 8; c < 68; c += 4) clockBar(c);
for (let k = 0; k < 16; k++) if (k % 4 !== 0 || k === 0) tick(68 + k / 4, k % 2 ? 0.3 + 0.012 * k : 0.5);   // bar 18: the escapement races
tock(69, 0.62); tock(71, 0.66);
tock(97, 0.36); tick(98.5, 0.34); tock(99, 0.46); tick(99.5, 0.4); clockBar(100, 0.8); clockBar(104);
const shuffle = (c: number, v = 1) => { for (let k = 0; k < 4; k++) tick(c + k + 2 * T, 0.44 * v); tock(c + 1, 0.58 * v); tock(c + 3, 0.58 * v); };
for (let c = 108; c < DROP; c += 4) shuffle(c, c >= CYCLE2 ? 1.06 : 1);
for (let b = DROP; b < CLIMAX; b += 0.5) tick(b, 0.4 + 0.15 * (b - DROP) / 8);
for (let c = CLIMAX; c < 236; c += 4) clockBar(c, 1.06);
tick(236.5, 0.5); tock(237, 0.62); tick(237.5, 0.44);
for (let c = WARM; c < 276; c += 4) for (const b of [0.5, 1.5, 2.5, 3.5]) tick(c + b, 0.3);

const logNotes: RackNote[] = [];
const ghostsA = (c: number) => logNotes.push(rn(c + 1.25, 0.25, 'D4', 0.34, { articulation: 'knuckle' }), rn(c + 2.75, 0.25, 'G4', 0.3, { articulation: 'rim' }));
const ghostsB = (c: number) => logNotes.push(rn(c + 1.25, 0.25, 'D4', 0.34, { articulation: 'knuckle' }), rn(c + 3.25, 0.25, 'D4', 0.3, { articulation: 'knuckle' }));
for (const c of [16, 24, 48, 56, 64]) ghostsA(c);
for (const c of [20, 28, 52, 60, 68]) ghostsB(c);
for (let c = TRANS; c < DROP; c += 8) logNotes.push(rn(c + 11 * T, 0.25, 'G4', 0.28, { articulation: 'rim' }), rn(c + 4 + 2 + T, 0.25, 'D4', 0.3, { articulation: 'knuckle' }));
for (const c of [184, 192, 200, 208]) ghostsA(c);
for (const c of [188, 196, 204, 212]) ghostsB(c);
for (const c of [216, 224, 232]) logNotes.push(rn(c + 2.3, 0.32, 'G4', 0.5, { articulation: 'scrape' }));   // the wooden ratchet under the glide

const springNotes: RackNote[] = [];
for (const c of [16, 24, 48, 56, 184, 192, 200, 208, 216, 224, 232]) springNotes.push(rn(c + 2.25, 0.5, 'D3', 0.55, { articulation: 'damped' }));
for (let c = TRANS; c < DROP; c += 8) springNotes.push(rn(c + 2 + T, 0.5, 'D3', 0.5, { articulation: 'damped' }));
springNotes.push(rn(71, 1, 'G2', 0.62, { articulation: 'laser' }));                                          // the overload chirp

const bearingNotes: RackNote[] = ([[72.4, 'G6', 0.5], [73.2, 'D7', 0.4], [74.1, 'Bb6', 0.42], [75.9, 'G6', 0.34], [77.7, 'D7', 0.3], [80.1, 'Bb6', 0.27],
  [82.7, 'G6', 0.24], [85.4, 'D7', 0.2], [89, 'Bb6', 0.17], [238.5, 'G6', 0.45], [239.6, 'D7', 0.36], [241.8, 'Bb6', 0.3], [244.6, 'G6', 0.25], [247.7, 'D7', 0.2]] as const)
  .map(([b, p, v]) => rn(b, 0.25, p, v, { articulation: 'ping' }));
const gongNotes: RackNote[] = [rn(CLIMAX, 4, 'G3', 0.8, { articulation: 'ring', hardness: 0.7 }), rn(PHASE3, 4, 'D3', 0.7, { articulation: 'ring', hardness: 0.6 })];

// ================================================================================================ rack score
export const rackScore = {
  schema: 'daemonv12.signature-rack.score/1',
  title: 'BLACKOUT//ENGINE (full length)',
  description: 'DaemonV12: 72 bars of industrial hip-hop, 128 BPM, G minor, from the approved 30-second experiment. Rack and Timbre Lab parts; drums, breaker and mix in the engine project.',
  bpm: BPM, key: 'G minor', swing: 0.5, seed: 1280, tailSeconds: 0.5, masterGainDb: 0,
  sections: SECTIONS,
  room: { rt60: 2.1, size: 1.35, damp: 4800, predelayMs: 28, lowCut: 260 },
  parts: [
    {
      id: 'bass', instrument: 'living-bass', gainDb: 0, pan: 0, room: 0.02, setup: { seed: 1201 },
      macro: bassMacro,
      expression: [[0, 0.8], [95.9, 0.8], [96, 0.55], [104, 0.7], [108, 0.8], [237.9, 0.8], [240, 0.62], [END, 0.62]],
      controls: {
        ratchet: { steps: [[0, 1], [96, 0], [101.5, 0.5], [104, 1], [238, 0]], glide: 0.05 },
        servo: { steps: [[0, 0.85], [96, 0.25], [104, 0.85], [108, 0.95], [176, 0.9], [238, 0.2]], glide: 0.05 },
      },
      offsets: { chassis: { steps: [[0, 0], [96, 0.55], [104, 0.2], [108, 0]], glide: 0.05 } },
      motion: bassMotion(),
      notes: bassNotes,
    },
    {
      id: 'voice', instrument: 'impossible-voice', gainDb: 0, pan: 0, room: 0.34,
      setup: { seed: 77, size: -0.15, vibRate: 4.9, vibCents: 34, vowelTau: 0.16, haloDecay: 0.6 },
      macro: voiceMacro,
      expression: [[0, 0.75], [72, 0.66], [96, 0.72], [144, 0.74], [200, 0.82], [237.9, 0.82]],
      // the glass halo is capped: up high it rang louder than the voice in the audition (G5 resonator over F#5, +9.7 dB under C6)
      controls: { breath: { steps: [[0, 0.3], [72, 0.42], [96, 0.32], [176, 0.28]], glide: 0.2 }, glass: { steps: [[0, 0.3], [72, 0.06], [96, 0.12], [112, 0.22], [176, 0.28], [216, 0.32]], glide: 0.3 } },
      breaths: [{ beat: 74.6, beats: 0.8, kind: 'in', velocity: 0.6 }, { beat: 87.25, beats: 0.6, kind: 'in', velocity: 0.45 }, { beat: 199.3, beats: 0.6, kind: 'in', velocity: 0.4 }],
      notes: voiceNotes,
    },
    {
      id: 'voice-end', instrument: 'impossible-voice', gainDb: 0, pan: 0, room: 0.4,
      // QA fix 2: the 2.2 s G-major halo still rang at -31 dBFS when the closing fade began; 1.6 s lets it decay on its own
      setup: { seed: 78, size: -0.15, vibRate: 4.8, vibCents: 22, vowelTau: 0.18, haloDecay: PRE_QA ? 2.2 : 1.6, haloGain: 1.4, halo: ['G5', 'B5', 'D6', 'G6'] },
      macro: { steps: [[0, 0.02], [279, 0.02], [280, 0.1]], glide: 1 },
      expression: 0.66,
      controls: { breath: 0.44, glass: { steps: [[0, 0], [279.6, 0], [280, 0.65]], glide: 0.4 } },
      breaths: [{ beat: 239.3, beats: 0.65, kind: 'in', velocity: 0.55 }, { beat: 251.2, beats: 0.6, kind: 'in', velocity: 0.4 }, { beat: 277.4, beats: 0.5, kind: 'in', velocity: 0.4 },
        { beat: 283.6, beats: 1.6, kind: 'out', velocity: 0.4 }],
      notes: endNotes,
    },
    {
      id: 'bells', instrument: 'mechanical-orchestra/bar', gainDb: -4, pan: -0.1, room: 0.25, setup: { seed: 50, spread: 0.3 },
      macro: { steps: [[0, 0.4], [72, 0.12], [96, 0.4], [112, 0.45], [184, 0.55], [238, 0.04]], glide: 0.05 },
      controls: { damp: { steps: [[0, 0.45], [72, 0.6], [112, 0.5], [184, 0.45], [238, 1.1]], glide: 0.05 } },
      notes: bellNotes,
    },
    { id: 'tine', instrument: 'mechanical-orchestra/tine', gainDb: -3, pan: 0.22, room: 0.18, setup: { seed: 51, spread: 0.2 }, macro: { steps: [[0, 0.55], [238, 0]], glide: 0.05 }, notes: tineNotes },
    { id: 'bow', instrument: 'mechanical-orchestra/bow', gainDb: -3, pan: -0.12, room: 0.22, setup: { seed: 52, spread: 0.25 }, macro: { steps: [[0, 0.2], [112, 0.3], [200, 0.35]], glide: 0.1 }, notes: bowNotes },
    { id: 'skin', instrument: 'organic-percussion/skin', gainDb: -5, pan: 0.15, room: 0.12, setup: { seed: 53, spread: 0.45 }, macro: { steps: [[0, 0.25], [238, 0.15]], glide: 0.1 },
      humanize: { timingMs: 6, velocity: 0.1, seed: 531 }, notes: skinNotes },
    { id: 'clock', instrument: 'mechanical-orchestra/clock', gainDb: -4, pan: 0.28, room: 0.08, setup: { seed: 41, spread: 0.12 },
      macro: { steps: [[0, 0.3], [64, 0.45], [112, 0.4], [184, 0.85], [238, 0.1]], glide: 0.1 }, notes: clockNotes },
    { id: 'log', instrument: 'organic-percussion/log', gainDb: -2, pan: -0.18, room: 0.1, setup: { seed: 42, spread: 0.3 }, macro: 0.2,
      humanize: { timingMs: 4, velocity: 0.08, seed: 421 }, notes: logNotes },
    { id: 'spring', instrument: 'mechanical-orchestra/spring', gainDb: -6, pan: 0.12, room: 0.14, setup: { seed: 43 }, macro: 0.85, notes: springNotes },
    { id: 'bearings', instrument: 'mechanical-orchestra/bearings', gainDb: -10, pan: 0, room: 0.55, setup: { seed: 44, spread: 0.85 }, macro: 0.7, notes: bearingNotes },
    { id: 'gong', instrument: 'mechanical-orchestra/bar', gainDb: -8, pan: 0, room: 0.3, setup: { seed: 45, spread: 0 }, macro: 0.95, controls: { detune: -18 }, notes: gongNotes },
  ],
};
/** Rack stems summed into one engine track each (the engine takes at most 15 tracks). Order is the sum order. */
export const STEM_GROUPS: Record<string, string[]> = { bells: ['bells', 'tine', 'gong'], machines: ['clock', 'log', 'spring'], air: ['bearings'] };

// ================================================================================================ one-shots (rack `kit` command)
export const ONE_SHOTS: [string, string, number[], string, number, number | undefined][] = [
  ['kick-knock', 'organic-percussion/skin', [50], 'slap', 0.7, 0.05],
  ['kick-click', 'organic-percussion/log', [74], 'rim', 0.85, 0.05],
  ['snare-front', 'organic-percussion/skin', [55], 'slap', 0.7, 0.05],
  ['snare-body', 'context/snare', [60], 'snare', 0.8, undefined],
  ['anvil', 'mechanical-orchestra/bar', [70, 74, 79], 'hard', 0.8, 0.95],
  ['breaker-click', 'mechanical-orchestra/clock', [79], 'tick', 1, 0.2],
  ['breaker-rim', 'organic-percussion/log', [67], 'rim', 0.85, 0.1],
  ['breaker-knock', 'mechanical-orchestra/clock', [67], 'tock', 1, 0.2],
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
export const ANVIL_KIT = { formatVersion: 1, samples: [70, 74, 79].map((p, i) => ({ name: ['bb4', 'd5', 'g5'][i]!, pitch: p, file: shot('anvil', 'mechanical-orchestra/bar', p) })) };
export const BREAKER_KIT = { formatVersion: 1, samples: [
  { name: 'click', pitch: 60, file: shot('breaker-click', 'mechanical-orchestra/clock', 79) },
  { name: 'rim', pitch: 61, file: shot('breaker-rim', 'organic-percussion/log', 67) },
  { name: 'knock', pitch: 62, file: shot('breaker-knock', 'mechanical-orchestra/clock', 67) },
  { name: 'thud', pitch: 63, file: shot('breaker-thud', 'organic-percussion/skin', 43) },
] };

// ================================================================================================ engine drums (with a drummer's timing)
// Grid positions first; humanised onsets below. The snare sits 5-9 ms behind the beat, kicks and ghosts wander a
// few milliseconds, the clock (a machine) stays on the grid.
const KG: [number, number][] = [];
const kA = (c: number, v = 1) => KG.push([c, v], [c + 0.75, 0.9 * v], [c + 3.5, 0.84 * v]);
const kB = (c: number, v = 1) => KG.push([c, v], [c + 0.75, 0.9 * v], [c + 3.75, 0.86 * v]);
const kA2 = (c: number) => KG.push([c, 1], [c + 0.75, 0.9], [c + 1.5, 0.86], [c + 3.5, 0.84]);
const kB2 = (c: number) => KG.push([c, 1], [c + 0.75, 0.9], [c + 1.5, 0.86], [c + 3.75, 0.86]);
const kBigA = (c: number) => KG.push([c, 1], [c + 0.75, 0.7], [c + 1.5, 0.88], [c + 3, 0.84], [c + 3.5, 0.8]);
const kBigB = (c: number) => KG.push([c, 1], [c + 0.75, 0.7], [c + 1.5, 0.88], [c + 3, 0.82], [c + 3.75, 0.86]);
kA(0); kB(4); kA(8); kB(12); kA(16); kB(20); kA(24); kB(28);
kBigA(32); kBigA(36); kBigA(40); kBigB(44);
kA2(48); kB2(52); kA2(56); kB2(60);
KG.push([64, 1], [64.75, 0.9], [65.5, 0.88], [66.5, 0.8], [67, 0.85], [67.5, 0.84]);
KG.push([68, 1], [68.75, 0.9], [69.5, 0.88], [71, 0.82], [71.25, 0.84], [71.5, 0.86], [71.75, 0.9]);     // the roll into the trip
KG.push([100, 0.55], [100.75, 0.6]); kA(104, 0.85); KG.push([108, 0.9], [108 + 2 * T, 0.8], [108 + 4 * T, 0.82]);
for (let c = TRANS; c < DROP; c += 8) {
  KG.push([c, 1], [c + 2 * T, 0.86], [c + 4 * T, 0.84], [c + 11 * T, 0.82]);
  KG.push([c + 4, 1], [c + 4 + 2 * T, 0.86], [c + 4 + 4 * T, 0.84]);
  if (c >= CYCLE2) KG.push([c + 7, 0.7]);
}
KG.push([183.75, 0.9]);
kBigA(184); kBigB(188); kBigA(192); kBigB(196); kA2(200); kB2(204); kA2(208); kB2(212); kBigA(216); kBigB(220); kBigA(224); kBigB(228); kBigA(232);
KG.push([236, 1], [236.75, 0.92]);
KG.sort((a, b) => a[0] - b[0]);
/** Humanised kicks: +-2.5 ms, velocity +-4 %. Exported for the bass ducks (which follow them). */
export const KICKS: [number, number][] = KG.map(([b, v], i) => [r6(b + ms(2.5 * hash(i + 11))), r6(Math.min(1, v * (1 + 0.04 * hash(i + 701))))]);

const SG = [...Array.from({ length: 8 }, (_, i) => 2 + 4 * i), ...Array.from({ length: 10 }, (_, i) => 34 + 4 * i), 106, 110,
  ...Array.from({ length: 16 }, (_, i) => 114 + 4 * i), ...Array.from({ length: 13 }, (_, i) => 186 + 4 * i)];
export const SNARES: [number, number][] = SG.map((b, i) => [r6(b + ms(7 + 2 * hash(i + 31))), r6((b === 106 ? 0.9 : 1) * (1 - 0.05 * Math.abs(hash(i + 97))))]);
SNARES.push([r6(67 + ms(6)), 0.9], [r6(71 + ms(6)), 0.95]);                                                   // pressure: a second hammer
for (let c = CYCLE2; c < DROP; c += 4) SNARES.push([r6(c + 1 + ms(8)), 0.45], [r6(c + 3 + ms(8)), 0.5]);   // cycle 2: soft backbeats
for (const c of [216, 224]) SNARES.push([r6(c + 3.5 + ms(5)), 0.62]);
SNARES.sort((a, b) => a[0] - b[0]);
const FLAMS = [CLIMAX + 2, PHASE2 + 2, PHASE3 + 2, 46];
const GHOSTS: [number, number][] = ([[21.25, 0.24], [23.25, 0.3], [31.25, 0.25], [31.5, 0.35], [31.75, 0.5], [45.25, 0.25], [53.25, 0.26], [57.25, 0.24],
  [71.5, 0.4], [71.625, 0.5], [71.75, 0.6], [71.875, 0.7], [183.25, 0.3], [183.5, 0.42], [183.75, 0.55],
  [189.25, 0.24], [193.25, 0.26], [205.25, 0.24], [209.25, 0.26], [221.25, 0.28], [225.25, 0.3], [235.25, 0.3], [235.5, 0.45],
  ...Array.from({ length: 8 }, (_, i) => TRANS + 4 + 8 * i).flatMap(c => [[c + 2 + 2 * T, 0.25], [c + 3 + T, 0.3]])] as [number, number][])
  .map(([b, v], i) => [r6(b + ms(4 * hash(i + 211))), v] as [number, number]);

type EngineNote = Record<string, unknown>;
export const KICK_LAYER = { body: 0.85, knock: 0.9, click: 1 };
const kickHits: EngineNote[] = KICKS.flatMap(([b, v]) => [
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
    { start: pos(b), pitch: 'metal', velocity: r6(SNARE_LAYER.metal * v), gate: dur(0.25), envelope: { attackSeconds: 0, releaseSeconds: 0.07 }, chokeGroup: 'metal' },
  ]),
  ...FLAMS.map(b => ({ start: pos(b - ms(16)), pitch: 'crack', velocity: 0.32, playbackRate: semis(-2), gate: dur(0.125), envelope: { attackSeconds: 0.001, releaseSeconds: 0.02 } })),
  ...GHOSTS.map(([b, v]) => ({ start: pos(b), pitch: 'crack', velocity: v, playbackRate: semis(-2), gate: dur(0.125), envelope: { attackSeconds: 0.001, releaseSeconds: 0.02 }, chokeGroup: 'crack' })),
];
const anvilHits: EngineNote[] = [];
const tap = (b: number, pitch: string, v: number) => anvilHits.push({ start: pos(b), pitch, velocity: r6(v), gate: dur(0.25), envelope: { attackSeconds: 0, releaseSeconds: 0.06 }, chokeGroup: 'anvil' });
for (let c = 8; c < 32; c += 4) { tap(c + 1.75, 'd5', 0.72); tap(c + 3.25, c % 8 === 0 ? 'g5' : 'bb4', 0.5); }
for (let c = 32; c < 64; c += 4) tap(c + 3.25, c % 8 === 0 ? 'g5' : 'bb4', 0.5);
tap(65.75, 'd5', 0.72); tap(67.25, 'g5', 0.55); tap(69.75, 'd5', 0.75); tap(105.75, 'd5', 0.66);
for (let c = 108; c < DROP; c += 4) tap(c + 1 + 2 * T, 'd5', 0.6);
for (let c = CLIMAX; c < 236; c += 4) { tap(c + 0.5, 'bb4', 0.38); tap(c + 3.25, c % 8 === 0 ? 'g5' : 'bb4', 0.52); }
const breakerHits: EngineNote[] = [TRIP, BLACKOUT_2].flatMap(b => [
  { start: pos(b), pitch: 'click', velocity: 1 }, { start: pos(b), pitch: 'rim', velocity: 0.9 },
  { start: pos(b + ms(35)), pitch: 'knock', velocity: 1 }, { start: pos(b + ms(35)), pitch: 'thud', velocity: 1 },
]);

// ================================================================================================ automation
// Lanes are piecewise-linear shapes in ticks, evaluated on the union of their breakpoints: ducks and cuts combine by
// minimum, gate windows by maximum. Every cut and gate edge is a RAMP-long linear segment, never a step.
type Point = { at: { musical: string }; value: number; transition?: 'linear' };
const TPB = 960, RAMP = 6;                                   // 6 ticks = 2.9 ms
const tk = (beat: number) => Math.round(beat * TPB);
const ptT = (tick: number, value: number): Point => ({ at: { musical: pos(tick / TPB) }, value: r6(Math.max(-60, Math.min(12, value))), transition: 'linear' });
type Shape = [number, number][];
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
  const vals = ts.map(t => Math.max(-60, shapes.reduce((acc, s) => (mode === 'min' ? Math.min : Math.max)(acc, evalShape(s, t, base)), base)));
  const out: Point[] = [];
  for (let i = 0; i < ts.length; i++) {
    if (i > 0 && i < ts.length - 1 && Math.abs(vals[i]! - vals[i - 1]!) < 1e-9 && Math.abs(vals[i]! - vals[i + 1]!) < 1e-9) continue;
    out.push(ptT(ts[i]!, vals[i]!));
  }
  return out;
}
const duck = (k: number, base: number, depthDb: number, holdDb: number): Shape => [[tk(k) - 30, base], [tk(k), base - depthDb], [tk(k) + 96, base - holdDb], [tk(k) + 240, base]];
/** Silence from `from` (a RAMP fade ending on it) until `to` (a RAMP fade-in starting there). */
const blackout = (from: number, to: number, base: number): Shape => [[tk(from) - RAMP, base], [tk(from), -60], [tk(to), -60], [tk(to) + RAMP, base]];
/** Level step: `db` relative to base between from and to (beats), with short linear edges. */
const level = (from: number, to: number, base: number, db: number, edge = 0.25): Shape => [[tk(from), base], [tk(from + edge), base + db], [tk(to - edge), base + db], [tk(to), base]];
/** The end: everything still sounding fades over the last 1.2 beats (the final chord has rung for 3 bars). */
const endFade = (base: number): Shape => [[tk(END - 1.2), base], [tk(END) - RAMP, -60]];
/** Section levels: `base` plus dB over [from, to) beats (non-overlapping, sorted), with linear edges of `edge` beats. */
type Seg = [number, number, number];
function levelShape(base: number, segs: Seg[], edge = 0.25): Shape {
  const s: Shape = [[0, base]];
  for (const [a, b, d] of segs) s.push([tk(a), base], [tk(a + edge), base + d], [tk(b - edge), base + d], [tk(b), base]);
  s.push([tk(END), base]);
  return s.filter((p, i) => i === 0 || p[0] > s[i - 1]![0] || p[1] !== s[i - 1]![1]);
}
const top = (base: number, segs: Seg[]) => base + Math.max(0, ...segs.map(x => x[2]));
/** Bass: section levels, ducks under every kick (relative to the level there), both blackouts. */
function bassLane(base: number, depthDb: number, holdDb: number, segs: Seg[]): Point[] {
  const lv = levelShape(base, segs);
  return combine(top(base, segs), [lv, ...KICKS.map(([k]) => duck(k, evalShape(lv, tk(k), base), depthDb, holdDb)),
    blackout(TRIP, COLD - 0.1, base), blackout(BLACKOUT_2, 247.9, base), endFade(base)], 'min');
}
/** A part with section levels, cut by both blackouts, returning at the given beats. */
const cutLane = (base: number, back1: number, back2: number, segs: Seg[] = []): Point[] =>
  combine(top(base, segs), [levelShape(base, segs), blackout(TRIP, back1, base), blackout(BLACKOUT_2, back2, base), endFade(base)], 'min');
const gateWindow = ([a, b, g]: [number, number, number], base: number): Shape => [[tk(a), -60], [tk(a) + RAMP, base + g], [tk(b) - RAMP, base + g], [tk(b), -60]];
const voiceLane = (base: number): Point[] => combine(-60, VOICE_GATE.map(w => gateWindow(w, base)), 'max');
const roomLane = (base: number): Point[] => combine(base, [[
  [0, base - 4], [tk(TRIP), base - 4], [tk(TRIP + 0.5), base], [tk(COLD + 4), base], [tk(COLD + 6), base - 3], [tk(DROP), base - 3], [tk(DROP + 1), base - 1],
  [tk(CLIMAX), base - 4], [tk(BLACKOUT_2), base - 4], [tk(BLACKOUT_2 + 0.5), base], [tk(END - 1.2), base], [tk(END) - RAMP, -60]]], 'min');

// ================================================================================================ engine project
/**
 * Track gains (dB) before TRIM. The drums, bass, engine room and room keep the approved 30-second mix; the new parts
 * were set on calibration render 1 (README): in the phone band Hook B sat 3.6 dB under the rest of the mix where it
 * is introduced, the bowed chords 14 dB under in the transformation and the hand drums 26 dB under.
 */
export const MIX = {
  kick: -1, snare: -1, anvil: 3, breaker: -6, bassSub: 5, bassGrind: -0.5, voice: 1, voiceEnd: 2, bells: 4, bow: 5, hands: 8, machines: 0, air: 0, room: 0,
  master: -0.8,
};
export const TRIM_DB = -3;
const t = (db: number) => db + TRIM_DB;
// QA fix 1: the candidate's true peak was -1.04 dBTP (climax snare hits, bar 59): the master comes down 0.5 dB
export const MASTER = { gainDb: MIX.master - TRIM_DB - (PRE_QA ? 0 : 0.5), effects: [{ type: 'highpass', frequencyHz: 24 }, { type: 'compressor', thresholdDb: -15, ratio: 1.6, attackMs: 30, releaseMs: 160 }, { type: 'saturation', driveDb: 1.5, mix: 1 }] };
const kitTrack = (id: string, description: string, kit: string, notes: EngineNote[], mix: Record<string, number>, effects: unknown[], automation?: unknown) => ({
  id, description, instrument: { type: 'drumkit', kit }, mix, effects, ...(automation ? { automation } : {}),
  clips: [{ bar: 1, pattern: 'all' }], patterns: [{ id: 'all', bars: BARS, notes }],
});
const stemTrack = (id: string, description: string, sample: string, mix: Record<string, number>, effects: unknown[], automation?: unknown) => ({
  id, description, instrument: { type: 'sampler', sample }, mix, effects, ...(automation ? { automation } : {}),
  clips: [{ bar: 1, pattern: 'all' }], patterns: [{ id: 'all', bars: BARS, notes: [{ start: '1:1', velocity: 1 }] }],
});
const XOVER = 110;

export const project = {
  formatVersion: 1,
  title: 'BLACKOUT//ENGINE (full length)',
  description: 'DaemonV12: 72 bars of industrial hip-hop, 128 BPM, G minor, exactly 2:15. Living Bass riff, Mechanical Orchestra engine room and bells, Impossible Voice lament and song.',
  bpm: BPM, timeSignature: '4/4', key: 'G minor', bars: BARS, seed: 1280,
  render: { tail: 'none' },
  master: MASTER,
  tracks: [
    kitTrack('kick', 'V12 IRON PULSE at D2 + skin slap D3 (knock) + log rim D5 (click); humanised +-2.5 ms.', 'assets/kick-kit.json', kickHits,
      { gainDb: t(MIX.kick) }, [{ type: 'highpass', frequencyHz: 32 }, { type: 'saturation', driveDb: 4, mix: 0.3 }]),
    kitTrack('snare', 'The hammer: TITANIUM CRACK -2 st + HEADLINER context snare + skin slap G3 + gated alien bar; laid back 5-9 ms; ghosts, flams, drags.', 'assets/snare-kit.json', snareHits,
      { gainDb: t(MIX.snare) }, [{ type: 'highpass', frequencyHz: 90 }, { type: 'saturation', driveDb: 5, mix: 0.35 }, { type: 'reverb', roomSize: 0.25, decaySeconds: 0.4, wet: 0.06 }]),
    kitTrack('anvil', 'Alien modal bar gated to anvil taps; a dotted-eighth echo.', 'assets/anvil-kit.json', anvilHits,
      { gainDb: t(MIX.anvil), pan: -0.32 }, [{ type: 'highpass', frequencyHz: 380 }, { type: 'delay', timeMs: 351.5625, wet: 0.14 }]),
    kitTrack('breaker', 'The breaker: contact click, then the lever stop (bars 19 and 60).', 'assets/breaker-kit.json', breakerHits,
      { gainDb: t(MIX.breaker) }, [{ type: 'highpass', frequencyHz: 60 }, { type: 'reverb', roomSize: 0.8, decaySeconds: 1.6, wet: 0.18 }]),
    stemTrack('bass-sub', 'Living Bass below 110 Hz (LR4): the clean phase-locked sub, mono, ducked under every kick.', 'assets/rack/bass.wav',
      { gainDb: t(MIX.bassSub) }, [{ type: 'lowpass', frequencyHz: XOVER }, { type: 'lowpass', frequencyHz: XOVER }, { type: 'highpass', frequencyHz: 28 }],
      { gainDb: bassLane(t(MIX.bassSub), 14, 8, [[DROP, CLIMAX, -3], [CLIMAX, BLACKOUT_2, 4]]) }),
    stemTrack('bass-grind', 'Living Bass above 110 Hz (LR4): the folded, geared, driven body, saturated again for small speakers.', 'assets/rack/bass.wav',
      { gainDb: t(MIX.bassGrind) }, [{ type: 'highpass', frequencyHz: XOVER }, { type: 'highpass', frequencyHz: XOVER }, { type: 'saturation', driveDb: 7, mix: 0.55 }, { type: 'lowpass', frequencyHz: 6500 }],
      { gainDb: bassLane(t(MIX.bassGrind), 10, 4, [[32, TRIP, 1.5], [TRANS, DROP, 1], [DROP, CLIMAX, -3], [CLIMAX, BLACKOUT_2, 3]]) }),
    stemTrack('voice', 'Impossible Voice: ghost cries, the lament and the cut-off answer, chopped by the machine, the high stair and climb.', 'assets/rack/voice.wav',
      { gainDb: t(MIX.voice) }, [{ type: 'highpass', frequencyHz: 140 }, { type: 'compressor', thresholdDb: -20, ratio: 2, attackMs: 8, releaseMs: 140, makeupGainDb: 3 }, { type: 'saturation', driveDb: 3, mix: 0.2 }, { type: 'reverb', roomSize: 0.35, decaySeconds: 0.45, wet: 0.1 }],
      { gainDb: voiceLane(t(MIX.voice)) }),
    stemTrack('voice-end', 'Impossible Voice, human: the whole song, the hum, C5 -> B4 over the last cadence; a G-major glass halo blooms on the last note.', 'assets/rack/voice-end.wav',
      { gainDb: t(MIX.voiceEnd) }, [{ type: 'highpass', frequencyHz: 120 }, { type: 'compressor', thresholdDb: -24, ratio: 2, attackMs: 10, releaseMs: 160, makeupGainDb: 2 }, { type: 'reverb', roomSize: 0.4, decaySeconds: 0.5, wet: 0.1 }],
      { gainDb: combine(t(MIX.voiceEnd), [endFade(t(MIX.voiceEnd))], 'min') }),
    stemTrack('bells', 'Hook B on the struck bar (bounced) and buzzing tine; echoes, triplet sequences, wedges, tolls, the music box and the last chords; the gong.', 'assets/groups/bells.wav',
      { gainDb: t(MIX.bells) }, [{ type: 'highpass', frequencyHz: 140 }], { gainDb: cutLane(t(MIX.bells), 88.5, 247.9, [[32, TRIP, 1], [PHASE2, BLACKOUT_2, -4]]) }),
    stemTrack('bow', 'Friction-bowed bars: the open-fifth hum in the collapse, the chords of the transformation, the slow chromatic climb of the climax.', 'assets/rack/bow.wav',
      { gainDb: t(MIX.bow) }, [{ type: 'highpass', frequencyHz: 90 }], { gainDb: cutLane(t(MIX.bow), 83.9, 247.9) }),
    stemTrack('hands', 'Hand Skin: the gear-change fills, the talking drum of the transformation, palm booms, the hands of the warm ending.', 'assets/rack/skin.wav',
      { gainDb: t(MIX.hands) }, [{ type: 'highpass', frequencyHz: 50 }, { type: 'compressor', thresholdDb: -22, ratio: 3, attackMs: 2, releaseMs: 90, makeupGainDb: 4 }], { gainDb: cutLane(t(MIX.hands), COLD - 0.1, WARM - 0.1) }),
    stemTrack('machines', 'Escapement clock, hollow log, dispersive spring: the engine room.', 'assets/groups/machines.wav',
      { gainDb: t(MIX.machines) }, [{ type: 'highpass', frequencyHz: 110 }], { gainDb: cutLane(t(MIX.machines), COLD - 0.1, WARM - 0.1) }),
    stemTrack('air', 'Tuned bearings: hot metal ticking as it cools after each blackout.', 'assets/groups/air.wav',
      { gainDb: t(MIX.air) }, [{ type: 'highpass', frequencyHz: 1200 }], { gainDb: combine(t(MIX.air), [endFade(t(MIX.air))], 'min') }),
    stemTrack('room', 'The shared rack room (FDN, wet only): low under the grooves, open after each blackout.', 'assets/rack/room.wav',
      { gainDb: t(MIX.room) }, [{ type: 'highpass', frequencyHz: 220 }], { gainDb: roomLane(t(MIX.room)) }),
  ],
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = process.argv[2] ? resolve(process.argv[2]) : join(HERE, 'source');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'blackout-engine-full.rack.json'), JSON.stringify(rackScore, null, 1) + '\n');
  writeFileSync(join(out, 'blackout-engine-full.project.json'), JSON.stringify(project, null, 1) + '\n');
  for (const [name, kit] of [['kick', KICK_KIT], ['snare', SNARE_KIT], ['anvil', ANVIL_KIT], ['breaker', BREAKER_KIT]] as const)
    writeFileSync(join(out, `${name}-kit.json`), JSON.stringify(kit, null, 2) + '\n');
  writeFileSync(join(out, 'stem-groups.json'), JSON.stringify(STEM_GROUPS, null, 2) + '\n');
  const n = (p: string) => (rackScore.parts.find(x => x.id === p)!.notes as unknown[]).length;
  console.log(`wrote ${out}: ${n('bass')} bass, ${n('voice')} + ${n('voice-end')} voice, ${n('bells')} bell, ${n('tine')} tine, ${n('bow')} bow, ${n('skin')} hand, ${n('clock')} clock notes; ${KICKS.length} kicks, ${SNARES.length} snares, ${GHOSTS.length} ghosts, ${anvilHits.length} anvil taps`);
}
