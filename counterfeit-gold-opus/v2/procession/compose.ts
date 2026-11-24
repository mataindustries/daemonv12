/**
 * THE VELVET HEARSE · "Two Coins for the Ferryman (Procession Take)". Unreleased; an imaginary recording.
 *
 * The LP (*Music for the Viewing Room*, 1971) is the band indoors. This is the band outdoors, on the day the song
 * was written for: the funeral of Silas Vane, founder of Vane & Sons, who asked to be buried with two gold coins
 * for the ferryman. The family buried him with two brass ones painted gold. Lazarus Sound Library's engineer left
 * a portable recorder running on the hearse; the reel was found in the LP's master box, labelled only "PROCESSION".
 *
 * There is no Rhodes and no vibraphone on the street. Lucius carries a bell lyre; the Deacon's bass is strapped to
 * a pram and played with a bow-blat (it sounds like a tuba, roughly); the mourners sing back.
 *
 *   dirge      4 bars  to the cemetery: the bell tolls each bar; the theme at half speed, F minor; a muffled drum
 *   cut-loose  1 bar   the last toll; a press roll swells; Odile's shout bends up a fifth; the mourners: HAH
 *   line       8 bars  the second line home: the same tune in F7 blues, call and response, a pram tuba,
 *                      a parade snare that never shuts up, a cowbell log; bar 7 slips into Gb7#11 anyway
 *   break      2 bars  Brother Ezra alone: THE RIFF (F minor pentatonic with a blue curl, so it sits on F7 and
 *                      on Fm alike); then once more with the crowd clapping
 *   shout      4 bars  the riff as the shout chorus, Odile above everyone
 *   home       2 bars  the band holds F major: the resolution the LP never gives; the bell rings for the living
 *
 * F, 104.650226 BPM (the LP's tempo: 88 x 2^(3/12)), swing 0.6, 21 bars.
 *   node counterfeit-gold-opus/v2/procession/compose.ts
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type O = Record<string, number | string>;
type N = [number, number, string, number, O?];
const sh = (notes: N[], d: number): N[] => notes.map(([b, l, p, v, o]) => (o ? [b + d, l, p, v, { ...o }] : [b + d, l, p, v]));
const MIDI: Record<string, number> = { C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const midi = (p: string) => { const m = /^([A-G]b?)(-?\d)$/.exec(p)!; return MIDI[m[1]!]! + 12 * (Number(m[2]) + 1); };
const name = (m: number) => `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;

export const BPM = 88 * 2 ** (3 / 12);
export const SEC = { dirge: 0, cut: 16, line: 20, brk: 52, shout: 60, home: 76, end: 84 };
const { dirge: DG, cut: CUT, line: LN, brk: BRK, shout: SH, home: HOME, end: END } = SEC;

// ------------------------------------------------------------------------------------------------ the reed (Brother Ezra)
const DIRGE_THEME: N[] = [
  [1, 0.5, 'C5', 0.6, { articulation: 'tongued' }], [1.5, 0.5, 'C5', 0.66, { articulation: 'tongued' }], [2, 3, 'Eb5', 0.7, { articulation: 'scoop', bend: 2 }],
  [5.5, 0.5, 'Db5', 0.55], [6, 1, 'C5', 0.6], [7, 3.5, 'Ab4', 0.66], [11, 1, 'G4', 0.55], [12, 1, 'Ab4', 0.6], [13, 2.5, 'F4', 0.62, { articulation: 'fall', fall: 3 }],
];
// the same tune, home from the cemetery: F7 blues, the Ab of the LP now an A
const PARADE: N[] = [
  [0.5, 0.25, 'C5', 0.78, { articulation: 'tongued' }], [0.75, 0.25, 'C5', 0.9, { articulation: 'tongued' }], [1, 1.25, 'Eb5', 0.92, { articulation: 'scoop', bend: 2 }],
  [2.5, 0.5, 'D5', 0.75], [3, 0.5, 'C5', 0.78], [3.5, 1.5, 'A4', 0.82],
  [5.5, 0.5, 'G4', 0.7, { articulation: 'tongued' }], [6, 0.5, 'Ab4', 0.75], [6.5, 0.75, 'F4', 0.8, { articulation: 'fall', fall: 3 }],
  [8.5, 0.25, 'D5', 0.8, { articulation: 'tongued' }], [8.75, 0.25, 'D5', 0.9, { articulation: 'tongued' }], [9, 1.25, 'F5', 0.95, { articulation: 'scoop', bend: 3 }],
  [10.25, 0.25, 'Eb5', 0.65], [10.5, 0.5, 'D5', 0.75], [11, 0.5, 'C5', 0.75], [11.5, 0.5, 'A4', 0.8],
  [12, 2, 'C5', 0.92, { articulation: 'growl' }], [14, 0.5, 'Bb4', 0.75, { articulation: 'tongued' }], [14.5, 0.5, 'A4', 0.75], [15, 0.75, 'E4', 0.78],
  [16.5, 0.25, 'C5', 0.8, { articulation: 'tongued' }], [16.75, 0.25, 'C5', 0.92, { articulation: 'tongued' }], [17, 1.25, 'Eb5', 0.95, { articulation: 'growl' }],
  [18.5, 0.5, 'D5', 0.78], [19, 0.5, 'C5', 0.8], [19.5, 1.5, 'A4', 0.84],
  [21.5, 0.5, 'G4', 0.72, { articulation: 'tongued' }], [22, 0.5, 'Ab4', 0.78], [22.5, 0.75, 'F4', 0.82, { articulation: 'fall', fall: 3 }],
  [24.5, 0.25, 'F5', 0.82, { articulation: 'tongued' }], [24.75, 0.25, 'F5', 0.92, { articulation: 'tongued' }], [25, 1, 'Ab5', 0.95, { articulation: 'scoop', bend: 2 }],
  [26, 2, 'C5', 0.95, { articulation: 'growl' }],                       // over Gb7#11: the ferryman's note, even on the way home
  [28, 1.5, 'A4', 0.86], [29.5, 0.5, 'C5', 0.8], [30, 1, 'F5', 0.92, { articulation: 'fall', fall: 5 }],
];
/** THE RIFF: F minor pentatonic with a blue curl on the Ab, so it belongs to F7 and to Fm alike. */
export const RIFF: N[] = [
  [0, 0.5, 'F4', 0.95, { articulation: 'accent' }], [0.5, 0.25, 'Ab4', 0.8, { articulation: 'scoop', bend: 1 }], [0.75, 0.25, 'F4', 0.72, { articulation: 'tongued' }],
  [1, 0.5, 'C5', 0.92, { articulation: 'accent' }], [1.5, 0.5, 'Eb5', 0.86, { articulation: 'growl' }], [2, 1, 'F5', 0.97, { articulation: 'scoop', bend: 2 }],
  [3, 0.25, 'Eb5', 0.75, { articulation: 'tongued' }], [3.25, 0.25, 'C5', 0.75], [3.5, 0.5, 'Ab4', 0.8, { articulation: 'fall', fall: 2 }],
];
const up = (notes: N[], semis: number): N[] => notes.map(([b, l, p, v, o]) => (o ? [b, l, name(midi(p) + semis), v, { ...o }] : [b, l, name(midi(p) + semis), v]));
const reed: N[] = [
  ...sh(DIRGE_THEME, DG),
  [CUT + 3.5, 0.5, 'E4', 0.85, { articulation: 'scoop', bend: 3 }],
  ...sh(PARADE, LN),
  ...sh(RIFF, BRK), ...sh(RIFF, BRK + 4),
  ...sh(RIFF, SH), ...sh(up(RIFF, 5), SH + 4), ...sh(RIFF, SH + 8),
  [SH + 12, 2, 'C5', 0.95, { articulation: 'growl' }], [SH + 14, 0.5, 'Bb4', 0.8], [SH + 14.5, 0.5, 'A4', 0.8], [SH + 15, 0.5, 'E4', 0.82], [SH + 15.5, 0.5, 'G4', 0.82],
  [HOME, 5.5, 'F5', 0.85],
];

// ------------------------------------------------------------------------------------------------ the pram tuba (the Deacon)
const CH_LINE = ['F7', 'Bb7', 'F7', 'C7', 'F7', 'Bb7', 'F7|Gb7', 'F7'];
const CH_SHOUT = ['F7', 'Bb7', 'F7', 'C7'];
const ROOT: Record<string, number> = { F7: midi('F1'), Bb7: midi('Bb1'), C7: midi('C2'), Gb7: midi('Gb1') };
const THIRD: Record<string, number> = { F7: 4, Bb7: 4, C7: 4, Gb7: 4 };
function tubaBar(at: number, ch: string, next: string): N[] {
  const nextRoot = ROOT[next.split('|')[0]!]!;
  if (ch.includes('|')) {   // two beats of F7, two of Gb7#11, sliding into the next F
    const g = ROOT.Gb7!;
    return [[at, 0.75, 'F1', 0.95, { articulation: 'accent' }], [at + 1, 0.5, 'C2', 0.8], [at + 2, 0.75, name(g), 0.95, { articulation: 'accent' }], [at + 3, 0.5, name(g + 7), 0.8], [at + 3.5, 0.5, name(g), 0.85, { slide: 0.15 }]];
  }
  const r = ROOT[ch]!;
  return [[at, 0.75, name(r), 0.95, { articulation: 'accent' }], [at + 1, 0.5, name(r + THIRD[ch]!), 0.75], [at + 1.5, 0.5, name(r + 7), 0.8],
    [at + 2, 0.75, name(r + 12), 0.85], [at + 3, 0.5, name(r + 10), 0.8], [at + 3.5, 0.5, name(nextRoot - 1), 0.82]];
}
const tuba: N[] = [
  [DG, 3.5, 'F1', 0.7], [DG + 4, 3.5, 'C2', 0.65], [DG + 8, 3.5, 'Db2', 0.68], [DG + 12, 3.5, 'Ab1', 0.66],
  [CUT + 3, 0.5, 'C2', 0.8], [CUT + 3.5, 0.5, 'E1', 0.85],
  ...CH_LINE.flatMap((ch, i) => tubaBar(LN + 4 * i, ch, CH_LINE[i + 1] ?? 'F7')),
  [BRK + 4, 0.75, 'F1', 0.9, { articulation: 'accent' }], [BRK + 7, 0.5, 'C2', 0.8], [BRK + 7.5, 0.5, 'E1', 0.85],
  ...CH_SHOUT.flatMap((ch, i) => tubaBar(SH + 4 * i, ch, CH_SHOUT[i + 1] ?? 'F7')),
  [HOME, 5.5, 'F1', 1, { articulation: 'accent' }],
];

// ------------------------------------------------------------------------------------------------ Iggy: bass drum, parade snare, cowbell log, the crowd's claps
const kick: N[] = [], snare: N[] = [], log: N[] = [], claps: N[] = [];
const K = (b: number, v: number) => kick.push([b, 0.5, 'F1', v]);
const S = (b: number, v: number) => snare.push([b, 0.25, 'C4', v, { articulation: v < 0.42 ? 'ghost' : 'snare' }]);
for (let bar = 0; bar < 4; bar++) {
  K(DG + 4 * bar, 0.55); K(DG + 4 * bar + 2, 0.4);
  for (const [x, v] of [[3, 0.22], [3.25, 0.26], [3.5, 0.3]] as [number, number][]) S(DG + 4 * bar + x, v);
}
for (let i = 0; i < 32; i++) S(CUT + i * 0.125, 0.12 + 0.83 * (i / 31) ** 1.6);      // the press roll
K(CUT + 2, 0.7); K(CUT + 3, 0.8); K(CUT + 3.5, 0.85);
const PK: [number, number][] = [[0, 0.95], [1.5, 0.65], [2.75, 0.8], [3.5, 0.55], [4, 0.9], [5.75, 0.7], [6.5, 0.85]];
const PS: [number, number][] = [[1, 0.85], [2.25, 0.65], [3, 0.88], [3.75, 0.7], [5, 0.85], [6, 0.55], [7, 0.9], [7.25, 0.55]];
const PG = [0.25, 0.5, 1.25, 1.75, 2.5, 3.25, 4.25, 4.5, 5.25, 5.5, 6.25, 6.75, 7.5, 7.75];
const BELL_LOG: [number, string, number][] = [[0, 'knuckle', 0.72], [0.75, 'rim', 0.42], [1.5, 'knuckle', 0.62], [2.5, 'knuckle', 0.66], [3, 'rim', 0.45],
  [4.5, 'knuckle', 0.64], [5, 'rim', 0.42], [6, 'knuckle', 0.68], [6.75, 'rim', 0.42], [7.5, 'knuckle', 0.6]];
function parade(from: number, bars: number, hot: number) {
  for (let b = 0; b < bars; b += 2) {
    const o = from + 4 * b;
    for (const [x, v] of PK) K(o + x, v);
    for (const [x, v] of PS) S(o + x, Math.min(1, v * hot));
    for (const x of PG) S(o + x, 0.16 + 0.1 * ((x * 7) % 1) + (hot > 1 ? 0.06 : 0));
    for (const [x, art, v] of BELL_LOG) log.push([o + x, 0.25, art === 'rim' ? 'C4' : x % 2 < 1 ? 'F4' : 'C4', v, { articulation: art }]);
  }
}
parade(LN, 8, 1);
for (const x of [15.5, 15.625, 15.75, 15.875]) S(LN + x, 0.62 + (x - 15.5));            // fill into bar 5
K(LN + 31, 0.9); S(LN + 31.75, 0.85);                                                        // the band stops for Ezra
K(BRK + 4, 0.9);
for (const beat of [BRK + 5, BRK + 7]) for (const [dt, v, pan] of [[-0.018, 0.7, 0], [0, 0.85, 0], [0.021, 0.62, 0]] as number[][]) claps.push([beat + dt!, 0.25, 'C4', v!, { articulation: 'clap' }]);
parade(SH, 4, 1.12);
for (let i = 0; i < 8; i++) S(SH + 15 + i * 0.125, 0.5 + 0.06 * i);                         // into home
K(HOME, 1); for (let i = 0; i < 8; i++) S(HOME + i * 0.125, 0.45 + 0.06 * i); S(HOME + 1, 1); K(HOME + 2, 0.8);

// ------------------------------------------------------------------------------------------------ voices: Odile and the mourners
const odile: N[] = [
  [DG + 0.5, 3.5, 'Ab3', 0.45, { vowel: 'mm', articulation: 'hum' }], [DG + 4, 4, 'G3', 0.45, { vowel: 'mm', to: 'oo' }],
  [DG + 8, 4, 'F3', 0.46, { vowel: 'oo', to: 'oh' }], [DG + 12, 3.5, 'Ab3', 0.46, { vowel: 'oh', to: 'mm' }],
  [CUT + 1.5, 2.25, 'C5', 0.86, { vowel: 'oh', to: 'eh', scoop: 7 }],                     // CUT HIM LOOSE: a fifth, bent up
  [LN + 6.75, 0.75, 'F5', 0.7, { vowel: 'oh', to: 'eh', articulation: 'cry', cry: 2 }], [LN + 7.5, 0.5, 'D5', 0.62, { vowel: 'ah', articulation: 'detached' }],
  [LN + 14.5, 1.5, 'C5', 0.7, { vowel: 'ah', to: 'oh', articulation: 'fall', fall: 4 }],
  [LN + 22.75, 0.75, 'Ab5', 0.72, { vowel: 'ah', articulation: 'cry', cry: 3 }], [LN + 23.5, 0.5, 'F5', 0.62, { vowel: 'eh', articulation: 'detached' }],
  ...([['F5', 'ee'], ['Eb5', 'ah'], ['C5', 'oo'], ['A4', 'ah']] as [string, string][]).map(([p, vw], i) => [LN + 31 + 0.25 * i, 0.25, p, 0.66, { vowel: vw, articulation: 'detached' }] as N),
  [BRK + 7, 1, 'F5', 0.74, { vowel: 'ah', to: 'oh', articulation: 'fall', fall: 7 }],
  [SH, 1.5, 'F5', 0.78, { vowel: 'ah', to: 'eh', articulation: 'cry', cry: 3 }], [SH + 2.5, 0.5, 'Eb5', 0.66, { vowel: 'oh' }], [SH + 3, 1, 'C5', 0.7, { vowel: 'ah', articulation: 'fall', fall: 3 }],
  [SH + 8, 2, 'Ab5', 0.8, { vowel: 'oh', to: 'ah', scoop: 3 }], [SH + 10.5, 1.5, 'F5', 0.74, { vowel: 'eh', to: 'oh', articulation: 'fall', fall: 5 }],
  [SH + 14.5, 1, 'C5', 0.7, { vowel: 'ah', articulation: 'cry', cry: 2 }],
  [HOME, 6, 'A4', 0.74, { vowel: 'ah', to: 'oo' }],
];
const m1: N[] = [
  [DG, 8, 'C4', 0.38, { vowel: 'oo' }], [DG + 8, 7.5, 'Db4', 0.38, { vowel: 'oo', to: 'oh' }],
  [CUT + 3.25, 0.5, 'A3', 0.7, { vowel: 'ah', articulation: 'detached' }],
  [LN + 4, 2, 'D4', 0.42, { vowel: 'oh' }], [LN + 12, 2, 'E4', 0.42, { vowel: 'oh' }], [LN + 15.5, 0.5, 'E4', 0.62, { vowel: 'ah', articulation: 'detached' }],
  [LN + 20, 2, 'D4', 0.45, { vowel: 'oh' }], [LN + 26, 2, 'E4', 0.42, { vowel: 'mm' }],
  [SH + 4, 3, 'D4', 0.48, { vowel: 'ah' }], [SH + 12, 3, 'E4', 0.48, { vowel: 'ah' }],
  [HOME, 6, 'C4', 0.5, { vowel: 'ah', to: 'oo' }],
];
const m2: N[] = [
  [DG, 8, 'F3', 0.36, { vowel: 'oo' }], [DG + 8, 7.5, 'F3', 0.36, { vowel: 'oo' }],
  [CUT + 3.25, 0.5, 'F3', 0.7, { vowel: 'ah', articulation: 'detached' }],
  [LN + 4, 2, 'Ab3', 0.42, { vowel: 'oh' }], [LN + 12, 2, 'Bb3', 0.42, { vowel: 'oh' }], [LN + 15.5, 0.5, 'C4', 0.62, { vowel: 'ah', articulation: 'detached' }],
  [LN + 20, 2, 'Ab3', 0.45, { vowel: 'oh' }], [LN + 26, 2, 'Bb3', 0.42, { vowel: 'mm' }],
  [SH + 4, 3, 'Ab3', 0.48, { vowel: 'ah' }], [SH + 12, 3, 'Bb3', 0.48, { vowel: 'ah' }],
  [HOME, 6, 'F3', 0.5, { vowel: 'oh', to: 'oo' }],
];

// ------------------------------------------------------------------------------------------------ the bell lyre and the bell
const lyre: N[] = [];
for (const [x, p] of [[0.5, 'C6'], [0.75, 'C6'], [8.5, 'D6'], [8.75, 'D6'], [16.5, 'C6'], [16.75, 'C6'], [24.5, 'F6'], [24.75, 'F6']] as [number, string][]) lyre.push([LN + x, 0.25, p, 0.62, { articulation: 'hard' }]);
lyre.push([LN + 26, 1, 'Bb5', 0.5], [LN + 26.05, 1, 'C6', 0.5], [LN + 26.1, 1, 'E6', 0.52]);
for (const [i, ch] of CH_SHOUT.entries()) { const r = ROOT[ch]! + 48; [0, 4, 7, 10].forEach((s, k) => lyre.push([SH + 4 * i + k * 0.125, 0.5, name(r + s), 0.55, { articulation: 'hard' }])); }
['F5', 'A5', 'C6', 'F6'].forEach((p, k) => lyre.push([HOME + k * 0.06, 4, p, 0.6, { articulation: 'ring' }]));
const bell: N[] = [[DG, 4, 'F3', 0.8, { articulation: 'ring' }], [DG + 4, 4, 'F3', 0.74, { articulation: 'ring' }], [DG + 8, 4, 'F3', 0.72, { articulation: 'ring' }],
  [DG + 12, 4, 'F3', 0.7, { articulation: 'ring' }], [HOME + 2, 6, 'F3', 0.66, { articulation: 'ring' }]];

const step = (pts: [number, number][], glide = 0.25) => ({ steps: pts, glide });
const score = {
  schema: 'daemonv12.signature-rack.score/1', title: 'Two Coins for the Ferryman (Procession Take)', bpm: +BPM.toFixed(6), key: 'F minor', timeSignature: '4/4', swing: 0.6, seed: 1972,
  tailSeconds: 3.5, masterGainDb: -3,
  description: 'THE VELVET HEARSE (imaginary), unreleased street take recorded at the funeral of Silas Vane: the dirge to the cemetery, the press roll that cuts the body loose, the second line home in F7, a solo horn break, the shout, and the F major chord the LP never reaches.',
  sections: [
    { id: 'dirge', bars: 4, development: 'the bell tolls each bar; the theme at half speed in F minor; muffled bass drum; Odile and the mourners hum' },
    { id: 'cut-loose', bars: 1, development: 'a press roll swells from nothing; Odile bends a shout up a fifth; the mourners answer' },
    { id: 'line', bars: 8, development: 'the second line home: the tune in F7 blues, pram tuba, parade snare, cowbell log, call and response; bar 7 slips into Gb7#11' },
    { id: 'break', bars: 2, development: 'Brother Ezra alone: the riff; then again with the crowd clapping' },
    { id: 'shout', bars: 4, development: 'the riff as the shout chorus over the band, Odile above everyone' },
    { id: 'home', bars: 2, development: 'the band holds F major; the bell rings for the living' },
  ],
  room: { rt60: 0.95, size: 1.8, damp: 4200, predelayMs: 32, lowCut: 160 },
  parts: [
    { id: 'bass-drum', instrument: 'context/kick', gainDb: -3, context: false, humanize: { timingMs: 7, velocity: 0.07 }, notes: kick },
    { id: 'snare', instrument: 'context/snare', gainDb: -7, room: 0.14, context: false, humanize: { timingMs: 6, velocity: 0.08 }, notes: snare },
    { id: 'claps', instrument: 'context/snare', gainDb: -9, pan: 0.15, room: 0.2, context: false, humanize: { timingMs: 4, velocity: 0.1 }, notes: claps },
    { id: 'log', instrument: 'organic-percussion/log', gainDb: -10, pan: 0.3, room: 0.14, macro: 0.25, controls: { hard: 0.9 }, setup: { seed: 41 }, humanize: { timingMs: 6, velocity: 0.1 }, notes: log },
    { id: 'tuba', instrument: 'living-bass', gainDb: -4, room: 0.08, macro: 0.12,
      controls: { hold: 0.8, bright: 0.55, drive: 0.6, fold: 0.28, pm: 0.55, chassis: 0, servo: 0.2, ratchet: 0 }, expression: [[0, 0.6], [LN, 0.78], [END, 0.82]], setup: { seed: 71 },
      humanize: { timingMs: 7, velocity: 0.06 }, notes: tuba },
    { id: 'reed', instrument: 'breath-reed', gainDb: -4, pan: 0.06, room: 0.2,
      macro: step([[0, 0.22], [CUT, 0.5], [LN, 0.62], [BRK, 0.72], [SH, 0.86], [HOME, 0.6]]), controls: { vib: 1.15, bite: step([[0, 0.25], [LN, 0.55], [SH, 0.7], [HOME, 0.4]]), air: step([[0, 0.6], [LN, 0.3], [SH, 0.18], [HOME, 0.3]]) },
      expression: [[0, 0.55], [CUT, 0.62], [LN, 0.86], [SH, 0.92], [END, 0.85]], setup: { seed: 1938 }, humanize: { timingMs: 9, velocity: 0.05 }, notes: reed },
    { id: 'odile', instrument: 'impossible-voice', gainDb: -2, pan: -0.08, room: 0.2, macro: step([[0, 0.06], [CUT, 0.2], [SH, 0.28], [HOME, 0.12]]),
      controls: { breath: 0.32, vib: 1.1, glass: 0.06 }, expression: [[0, 0.55], [CUT, 0.85], [END, 0.8]], setup: { vibRate: 5.6, vibCents: 34, seed: 1945 },
      breaths: [{ beat: CUT + 1, beats: 0.45, kind: 'in', velocity: 0.6 }, { beat: SH - 0.5, beats: 0.4, kind: 'in', velocity: 0.55 }, { beat: HOME + 6.2, beats: 1.4, kind: 'out', velocity: 0.5 }],
      humanize: { timingMs: 10, velocity: 0.05 }, notes: odile },
    { id: 'mourner-1', instrument: 'impossible-voice', gainDb: -9, pan: 0.32, room: 0.28, macro: 0.1, controls: { breath: 0.4, glass: 0.04 }, setup: { size: -0.45, detune: -8, vibRate: 4.9, vibCents: 24, seed: 3 },
      humanize: { timingMs: 14, velocity: 0.06 }, notes: m1 },
    { id: 'mourner-2', instrument: 'impossible-voice', gainDb: -10, pan: -0.34, room: 0.28, macro: 0.08, controls: { breath: 0.45, glass: 0.04 }, setup: { size: 0.25, detune: 7, vibRate: 5.3, vibCents: 28, seed: 4 },
      humanize: { timingMs: 14, velocity: 0.06 }, notes: m2 },
    { id: 'lyre', instrument: 'mechanical-orchestra/bar', gainDb: -14, pan: 0.22, room: 0.2, macro: 0.16, controls: { hardness: 1.05, damp: 0.9 }, setup: { spread: 0.3, seed: 61 },
      humanize: { timingMs: 5, velocity: 0.07 }, notes: lyre },
    { id: 'bell', instrument: 'mechanical-orchestra/bar', gainDb: -11, room: 0.35, macro: 0.88, controls: { hardness: 0.6, damp: 1.3, detune: -22 }, setup: { spread: 0.1, seed: 13 }, notes: bell },
  ],
};
const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, 'two-coins-procession-take.score.json'), JSON.stringify(score, null, 1) + '\n');
console.log(`procession take: ${score.parts.length} parts, ${score.parts.reduce((a, p) => a + p.notes.length, 0)} notes, ${END / 4} bars at ${score.bpm} BPM`);
