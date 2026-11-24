/**
 * THE VELVET HEARSE · "Two Coins for the Ferryman"
 * from the LP *Music for the Viewing Room* (Lazarus Sound Library LSL-019, 1971). An imaginary record.
 *
 * The house combo of Vane & Sons Funeral Home recorded one album of background music for wakes. It was too
 * funky for the viewing room; most copies were buried with the customers. This is side B, track 3.
 *
 *   Deacon Mortimer Vane .... upright bass               living-bass, warm
 *   Odile Vane .............. voice (wordless)           impossible-voice, human -> impossible in the crossing
 *   Brother Ezra Coffin ..... reed                       breath-reed, sings -> feral
 *   Lucius Vane ............. vibes, electric tines      mechanical-orchestra/bar (motor tremolo), /tine (clean)
 *   Ignatius "Iggy" Plank ... drums, congas, temple log  context kick/snare, clock tick, organic skin and log
 *   Mrs. Vane ............... bowed saw                  mechanical-orchestra/bow
 *   the building ............ the viewing-room chime     mechanical-orchestra/bar at the alien end
 *
 * F minor, 104.65 BPM (exactly 88 x 2^(3/12): the record slowed three semitones sits on an 88 BPM grid in D minor),
 * swing 0.56, 34 bars. Head: Fm9 | Dbmaj9 | Bbm9 | Gb7#11, a bII7 that drags every chorus back to F.
 *
 *   chime   2 bars  the funeral home's bell alone, Odile breathes in and sighs one note; the saw and the clock
 *   head-a  4 bars  the theme, politely: no drum kit, reed and voice, Rhodes tines, vibes, bass, a few conga tones
 *   break   2 bars  Iggy cannot help himself: the drums alone, one late snare, a conga roll into the band
 *   head-b  4 bars  the whole band grooving; Odile doubles the reed an octave down in the last bar
 *   odile   4 bars  the kit drops out; Odile sings the theme over bass and vibes, scats, then falls a fourth
 *   crossing 7 bars eight cycles of 7/8 (2+2+3): the ferry; vibes riff turning metallic, hand drums, saw, bell,
 *                   Odile turns impossible (undertone, overtone whistle), the reed barks
 *   stop    1 bar   two band stabs, silence, the Deacon alone on a low F
 *   shout   8 bars  two hot choruses: the reed feral (one overblown note), Odile crying; then reed and voice in unison
 *   out     2 bars  they hit the ferryman chord and never resolve; the bell; two coins; Odile breathes out
 *
 * Writes the rack score next to this file:   node counterfeit-gold-opus/source/compose.ts
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type O = Record<string, number | string>;
type N = [number, number, string, number, O?];
const sh = (notes: N[], d: number): N[] => notes.map(([b, l, p, v, o]) => (o ? [b + d, l, p, v, { ...o }] : [b + d, l, p, v]));
const tweak = (notes: N[], f: (n: N, i: number) => N | null): N[] => notes.map((n, i) => f([n[0], n[1], n[2], n[3], n[4] ? { ...n[4] } : undefined] as N, i)).filter((n): n is N => n !== null).map(n => (n[4] === undefined ? [n[0], n[1], n[2], n[3]] : n) as N);

// ------------------------------------------------------------------------------------------------ form (beats)
export const BPM = 88 * 2 ** (3 / 12);
export const SEC = { chime: 0, headA: 8, brk: 24, headB: 32, odile: 48, cross: 64, stop: 92, shout: 96, out: 128, end: 136 };
const { chime: CHIME, headA: HA, brk: BRK, headB: HB, odile: OD, cross: CR, stop: ST, shout: SH, out: OUT, end: END } = SEC;

// ------------------------------------------------------------------------------------------------ the theme (reed)
// "Two coins": two quick repeated notes, then a scooped leap. Bar 2 sighs onto the #11; bar 3 repeats the coins a
// step up and reaches F5; bar 4 sits on C, the #11 of the Gb7 (the ferryman's note), and leans on E into F.
const THEME: N[] = [
  [0.5, 0.25, 'C5', 0.72, { articulation: 'tongued' }], [0.75, 0.25, 'C5', 0.86, { articulation: 'tongued' }],
  [1.0, 1.5, 'Eb5', 0.9, { articulation: 'scoop', bend: 2 }],
  [2.75, 0.25, 'Db5', 0.6, { articulation: 'tongued' }], [3.0, 0.5, 'C5', 0.75], [3.5, 1.75, 'Ab4', 0.8],
  [5.5, 0.5, 'G4', 0.62, { articulation: 'tongued' }], [6.0, 0.5, 'Ab4', 0.7], [6.5, 1.25, 'F4', 0.75, { articulation: 'fall', fall: 3 }],
  [8.5, 0.25, 'Db5', 0.75, { articulation: 'tongued' }], [8.75, 0.25, 'Db5', 0.88, { articulation: 'tongued' }],
  [9.0, 1.25, 'F5', 0.95, { articulation: 'scoop', bend: 3 }],
  [10.25, 0.25, 'Eb5', 0.6], [10.5, 0.5, 'Db5', 0.7], [11.0, 0.5, 'C5', 0.7], [11.5, 0.5, 'Bb4', 0.75],
  [12.0, 2.0, 'C5', 0.88], [14.0, 0.5, 'Bb4', 0.7, { articulation: 'tongued' }], [14.5, 0.5, 'Ab4', 0.7], [15.0, 0.75, 'E4', 0.72],
];
// head-b: the last bar climbs to the Gb7's seventh instead of sitting on the #11
const THEME_B: N[] = [
  ...THEME.filter(n => n[0] < 12),
  [12.0, 0.5, 'C5', 0.9, { articulation: 'accent' }], [12.5, 0.5, 'Db5', 0.78], [13.0, 1.5, 'E5', 0.92, { articulation: 'scoop', bend: 2 }],
  [14.5, 0.5, 'Db5', 0.74], [15.0, 0.5, 'Bb4', 0.74], [15.5, 0.5, 'Gb4', 0.7],
];
// shout, chorus 1: feral; growls on the long notes, the one overblown note on the ferryman's C
const THEME_HOT: N[] = tweak(THEME, n => {
  if (n[2] === 'Eb5' && n[0] === 1) n[4] = { articulation: 'growl' };
  if (n[2] === 'F5') n[4] = { articulation: 'growl' };
  if (n[0] === 6.5) n[4] = { articulation: 'fall', fall: 5 };
  if (n[0] === 12) return [12.0, 2.25, 'C5', 0.95, { articulation: 'overblow' }];
  if (n[0] === 14) return [14.25, 0.25, 'Bb4', 0.75, { articulation: 'accent' }];
  return n;
});

const CH = ['Fm9', 'Db', 'Bbm9', 'Gb7'] as const;
type Chord = (typeof CH)[number];
const RHODES: Record<Chord, string[]> = { Fm9: ['Ab4', 'C5', 'Eb5', 'G5'], Db: ['F4', 'Ab4', 'C5', 'Eb5'], Bbm9: ['Ab4', 'C5', 'Db5', 'F5'], Gb7: ['Bb4', 'C5', 'E5', 'Ab5'] };
const VIBES: Record<Chord, string[]> = { Fm9: ['F4', 'C5', 'Eb5', 'G5', 'Ab5'], Db: ['Db4', 'Ab4', 'C5', 'F5', 'G5'], Bbm9: ['Bb3', 'F4', 'Db5', 'Ab5', 'C6'], Gb7: ['Gb3', 'E4', 'Bb4', 'C5', 'Ab5'] };
const chordAt = (bar: number) => CH[((bar % 4) + 4) % 4]!;
const chord = (beat: number, len: number, notes: string[], v: number, o?: O, roll = 0): N[] => notes.map((p, i) => (o ? [beat + i * roll, len, p, v - i * 0.02, { ...o }] : [beat + i * roll, len, p, v - i * 0.02]) as N);

// ------------------------------------------------------------------------------------------------ bass (the Deacon)
const LINE: N[] = [
  [0, 1.25, 'F1', 0.95, { articulation: 'accent', scoop: 1 }], [1.5, 0.25, 'F1', 0.45, { articulation: 'ghost' }], [1.75, 0.25, 'C2', 0.7], [2, 0.75, 'Eb2', 0.8],
  [3, 0.5, 'F2', 0.7, { articulation: 'staccato' }], [3.5, 0.5, 'D2', 0.7, { slide: 0.08 }],
  [4, 1.25, 'Db2', 0.95, { articulation: 'accent' }], [5.5, 0.25, 'Db2', 0.45, { articulation: 'ghost' }], [5.75, 0.25, 'Ab1', 0.7], [6, 0.75, 'C2', 0.8],
  [7, 0.5, 'Db2', 0.7, { articulation: 'staccato' }], [7.5, 0.5, 'B1', 0.7, { slide: 0.08 }],
  [8, 1.25, 'Bb1', 0.95, { articulation: 'accent' }], [9.5, 0.25, 'Bb1', 0.45, { articulation: 'ghost' }], [9.75, 0.25, 'F1', 0.7], [10, 0.75, 'Ab1', 0.8],
  [11, 0.5, 'Bb1', 0.7, { articulation: 'staccato' }], [11.5, 0.5, 'Db2', 0.7],
  [12, 1, 'Gb1', 0.95, { articulation: 'accent', scoop: 2 }], [13.25, 0.25, 'Gb1', 0.45, { articulation: 'ghost' }], [13.5, 0.5, 'Db2', 0.75], [14, 0.5, 'E2', 0.8],
  [14.5, 0.5, 'Db2', 0.7], [15, 0.5, 'Bb1', 0.75], [15.5, 0.5, 'Gb1', 0.8, { slide: 0.12 }],
];
const bass: N[] = [
  ...tweak(LINE, n => { n[3] *= 0.88; return n; }).map(n => sh([n], HA)[0]!).filter(n => n[0] < HA + 15.5),
  [HA + 15.5, 0.5, 'Gb1', 0.7],
  ...sh(LINE, HB),
  // odile: long notes under the voice
  [OD, 3.5, 'F1', 0.82, { articulation: 'accent', scoop: 1 }], [OD + 4, 3.5, 'Db2', 0.78], [OD + 8, 3.5, 'Bb1', 0.78], [OD + 12, 3, 'Gb1', 0.82, { scoop: 2 }], [OD + 15, 1, 'Gb1', 0.6, { slide: 0.5 }],
];
// crossing: 7/8, 2+2+3 (F, C, then the Phrygian Gb on the long group)
for (let k = 0; k < 8; k++) {
  const c = CR + 3.5 * k;
  bass.push([c, 0.75, 'F1', 0.92, { articulation: 'accent' }], [c + 1, 0.5, 'C2', 0.7], [c + 2, 0.75, 'Gb1', 0.86, { articulation: 'accent' }], [c + 3, 0.5, k % 2 ? 'Eb2' : 'F2', 0.62, { articulation: 'staccato' }]);
}
// stop: two stabs, silence, then the Deacon alone
bass.push([ST, 0.5, 'F1', 0.95, { articulation: 'staccato' }], [ST + 0.75, 0.5, 'Gb1', 0.95, { articulation: 'staccato' }],
  [ST + 2, 1.5, 'F1', 0.97, { articulation: 'accent', scoop: 2 }], [ST + 3.5, 0.25, 'C2', 0.62, { articulation: 'staccato' }], [ST + 3.75, 0.25, 'E1', 0.72]);
bass.push(...sh(LINE, SH), ...sh(LINE.filter(n => n[0] < 12), SH + 16),
  [SH + 28, 1, 'Gb1', 1, { articulation: 'accent', scoop: 2 }], [SH + 29, 0.5, 'Gb1', 0.5, { articulation: 'ghost' }], [SH + 29.5, 0.5, 'G1', 0.8], [SH + 30, 0.5, 'Ab1', 0.85],
  [SH + 30.5, 0.5, 'A1', 0.85], [SH + 31, 0.5, 'Bb1', 0.9], [SH + 31.5, 0.5, 'Gb1', 0.9, { slide: 0.1 }],
  [OUT, 2.5, 'Gb1', 1, { articulation: 'accent', dive: 5, diveBeats: 2 }]);

// ------------------------------------------------------------------------------------------------ drums (Iggy)
const kick: N[] = [], snare: N[] = [], hat: N[] = [], congas: N[] = [], log: N[] = [];
const K = (b: number, v: number, o?: O) => kick.push(o ? [b, 0.5, 'F1', v, o] : [b, 0.5, 'F1', v]);
const S = (b: number, v: number, art?: string) => snare.push(art ? [b, 0.5, 'C4', v, { articulation: art }] : [b, 0.5, 'C4', v]);
const H = (b: number, v: number, art = 'tick') => hat.push([b, 0.25, art === 'tick' ? 'C6' : 'G4', v, { articulation: art }]);
const C = (b: number, hand: string, p: string, v: number) => congas.push([b, hand === 'roll' ? 0.75 : 0.25, p, v, { articulation: hand }]);

// the break: kicks and snares never collide with a hat, so a digger can lift each one clean
const BREAK_K: [number, number][] = [[0, 1], [1.75, 0.62], [2.5, 0.86], [4, 0.95], [5.5, 0.72], [6.25, 0.6]];
const BREAK_S: [number, number, string?][] = [[1, 0.96], [3, 0.95], [3.75, 0.3, 'ghost'], [5, 0.92], [6.75, 0.9], [7.5, 0.28, 'ghost']];
const BREAK_H: [number, number][] = [[0.5, 0.5], [1.5, 0.45], [2.0, 0.3], [3.5, 0.5], [4.5, 0.5], [5.25, 0.3], [6.0, 0.42]];
for (const [b, v] of BREAK_K) K(BRK + b, v);
for (const [b, v, a] of BREAK_S) S(BRK + b, v, a);
for (const [b, v] of BREAK_H) H(BRK + b, v);
C(BRK + 7.0, 'slap', 'F3', 0.82); C(BRK + 7.25, 'open', 'F3', 0.6); C(BRK + 7.5, 'open', 'C3', 0.78); C(BRK + 7.75, 'bass', 'C3', 0.7);

// the groove (two bars), used in head-b and the shout
const GROOVE_K: [number, number][] = [[0, 0.95], [0.75, 0.45], [2.5, 0.85], [4, 0.9], [5.5, 0.6], [6.5, 0.8], [6.75, 0.5]];
const GROOVE_S: [number, number][] = [[1, 0.85], [3, 0.9], [5, 0.85], [7, 0.92]];
const GHOSTS: [number, number][] = [[1.75, 0.22], [2.25, 0.18], [3.75, 0.28], [4.75, 0.2], [6.25, 0.2], [7.75, 0.3]];
function groove(from: number, bars: number, hot: boolean) {
  for (let b = 0; b < bars; b += 2) {
    const o = from + 4 * b;
    for (const [x, v] of GROOVE_K) K(o + x, v);
    for (const [x, v] of GROOVE_S) S(o + x, v, hot && (x === 3 || x === 7) ? 'clap' : undefined);
    for (const [x, v] of GHOSTS) S(o + x, v, 'ghost');
    for (let e = 0; e < 16; e++) H(o + e * 0.5, e % 2 ? 0.3 : 0.52);
    H(o + 3.75, 0.24); H(o + 7.25, 0.24);
    if (hot) K(o + 3.5, 0.55);
  }
}
groove(HB, 4, false);
groove(SH, 8, true);
const TUMBAO: [number, string, string, number][] = [[0, 'bass', 'C3', 0.5], [0.5, 'tap', 'F3', 0.3], [1, 'slap', 'F3', 0.66], [1.5, 'tap', 'F3', 0.3], [2, 'bass', 'C3', 0.45],
  [2.5, 'tap', 'F3', 0.28], [3, 'open', 'F3', 0.6], [3.5, 'open', 'F3', 0.55], [3.75, 'open', 'C3', 0.62]];
for (let bar = 0; bar < 4; bar++) {
  const o = HA + 4 * bar;   // head-a: only the bar-end tones, the band is polite
  if (bar % 2 === 1) for (const [x, h, p, v] of TUMBAO.filter(t => t[0] >= 3)) C(o + x, h, p, v * 0.8);
}
for (const from of [HB, SH, SH + 16]) for (let bar = 0; bar < 4; bar++) for (const [x, h, p, v] of TUMBAO) C(from + 4 * bar + x, h, p, v);
for (let bar = 0; bar < 4; bar++) for (let e = 0; e < 8; e++) C(OD + 4 * bar + e * 0.5, 'tap', e % 2 ? 'F3' : 'C3', e % 4 === 0 ? 0.32 : 0.2);
for (let bar = 0; bar < 4; bar++) for (const x of [1, 3]) H(OD + 4 * bar + x, 0.28);
// the chime bars: the clock in the viewing room
for (const [x, v] of [[4, 0.26], [5, 0.3], [6, 0.28], [7, 0.34], [7.5, 0.3]] as [number, number][]) H(CHIME + x, v, 'tock');
// crossing: hands and log in 2+2+3, a soft heartbeat kick, a tock on the long group
for (let k = 0; k < 8; k++) {
  const c = CR + 3.5 * k;
  C(c, 'bass', 'C3', 0.7); C(c + 0.5, 'tap', 'F3', 0.3); C(c + 1, 'slap', 'F3', 0.7); C(c + 1.5, 'tap', 'F3', 0.3);
  C(c + 2, 'open', 'C3', 0.65); C(c + 2.5, 'open', 'F3', 0.55); C(c + 3, 'mute', 'F3', 0.45);
  log.push([c, 0.25, 'F4', 0.7, { articulation: 'knuckle' }], [c + 1, 0.25, 'C4', 0.6, { articulation: 'knuckle' }], [c + 2, 0.25, 'C4', 0.66, { articulation: 'knuckle' }],
    [c + 1.5, 0.25, 'C4', 0.35, { articulation: 'rim' }], [c + 3, 0.25, 'C4', 0.4, { articulation: 'rim' }]);
  if (k >= 6) log.push([c + 2.5, 1, 'C4', 0.5, { articulation: 'scrape' }]);
  K(c, 0.55); H(c + 2, 0.34, 'tock');
}
// stop and out: the band hits together
for (const b of [ST, ST + 0.75]) { K(b, 1); S(b, 0.95, 'clap'); }
C(ST + 3.5, 'slap', 'F3', 0.7); C(ST + 3.75, 'slap', 'F3', 0.8);
K(SH + 28, 1); S(SH + 31, 0.6); S(SH + 31.25, 0.7); S(SH + 31.5, 0.8); S(SH + 31.75, 0.9);
K(OUT, 1); S(OUT, 1, 'clap');

// ------------------------------------------------------------------------------------------------ Rhodes tines and vibes (Lucius)
const rhodes: N[] = [], vibes: N[] = [], bell: N[] = [], saw: N[] = [], chank: N[] = [];
for (let bar = 0; bar < 4; bar++) {   // head-a: sparse, gentle
  const o = HA + 4 * bar, ch = RHODES[chordAt(bar)];
  rhodes.push(...chord(o, 1.75, ch, 0.58), ...chord(o + 2.75, 0.5, ch, 0.42));
}
const COMP: [number, number, number, boolean][] = [[0, 0.75, 0.62, false], [1.5, 0.25, 0.45, false], [2.5, 0.75, 0.55, false], [3.75, 0.25, 0.5, true]];
for (const from of [HB, SH, SH + 16]) for (let bar = 0; bar < 4; bar++) {
  const o = from + 4 * bar;
  for (const [x, l, v, next] of COMP) rhodes.push(...chord(o + x, l, RHODES[chordAt(next ? bar + 1 : bar)], v));
}
// head-a vibes: a roll on bars 1 and 3, a climbing fill out of bar 4
vibes.push(...chord(HA, 3, VIBES.Fm9, 0.5, { articulation: 'soft' }, 0.06), ...chord(HA + 8, 3, VIBES.Bbm9, 0.48, { articulation: 'soft' }, 0.06),
  [HA + 15, 0.25, 'Bb4', 0.5, { damp: 0.45 }], [HA + 15.25, 0.25, 'C5', 0.5, { damp: 0.45 }], [HA + 15.5, 0.25, 'E5', 0.55, { damp: 0.45 }], [HA + 15.75, 0.25, 'Ab5', 0.6, { damp: 0.4 }]);
// head-b: double the coins an octave up
for (const n of THEME_B.filter(n => n[1] <= 0.25 && /^(C5|Db5)$/.test(n[2]))) vibes.push([HB + n[0], 0.25, n[2].replace('5', '6'), 0.5]);
vibes.push(...chord(HB + 12, 2, VIBES.Gb7, 0.5, { articulation: 'soft' }, 0.05));
// odile: rolled chords
for (let bar = 0; bar < 4; bar++) vibes.push(...chord(OD + 4 * bar, 3.5, VIBES[chordAt(bar)], 0.5, { articulation: 'soft' }, 0.07), ...chord(OD + 4 * bar + 2.5, 1.25, VIBES[chordAt(bar)].slice(2), 0.36, { articulation: 'soft' }));
// crossing: the 7/8 riff. Accents on the 2+2+3 group starts; every fourth cycle bends its tail.
const RIFF = ['F4', 'Ab4', 'C5', 'Db5', 'C5', 'Ab4', 'Gb4'];
for (let k = 0; k < 8; k++) RIFF.forEach((p, i) => {
  const pitch = k % 4 === 3 && i === 5 ? 'Bb4' : k % 4 === 3 && i === 3 ? 'Eb5' : p;
  vibes.push([CR + 3.5 * k + 0.5 * i, 0.5, pitch, i % 2 === 0 ? 0.74 : 0.5, { articulation: i % 2 === 0 ? 'hard' : 'strike' }]);
});
// stop and out stabs
for (const [b, c, l] of [[ST, 'Fm9', 0.5], [ST + 0.75, 'Gb7', 0.6]] as [number, Chord, number][]) {
  rhodes.push(...chord(b, l, RHODES[c], 0.85)); vibes.push(...chord(b, l, VIBES[c], 0.78, { articulation: 'hard' }));
}
// shout: vibes double the coins and the high notes
for (const from of [SH, SH + 16]) for (const n of THEME.filter(n => /^(C5|Db5|F5|Eb5)$/.test(n[2]) && n[0] < 10)) vibes.push([from + n[0], Math.min(n[1], 1), n[2], 0.55, { articulation: 'hard' }]);
rhodes.push(...chord(OUT, 3, RHODES.Gb7, 0.85));
vibes.push(...chord(OUT, 4, VIBES.Gb7, 0.7, { articulation: 'ring' }, 0.03));
// the two coins, at the very end
rhodes.push([OUT + 5.5, 0.5, 'C6', 0.62], [OUT + 5.75, 1.5, 'C6', 0.72]);

// ------------------------------------------------------------------------------------------------ bell, saw, steel string
bell.push([CHIME, 6, 'F3', 0.85, { articulation: 'ring', damp: 1.15 }], [CR, 6, 'F3', 0.72, { articulation: 'ring' }], [CR + 14, 6, 'F3', 0.6, { articulation: 'ring' }],
  [CR + 24.5, 3.5, 'C4', 0.6, { articulation: 'ring' }], [SH, 4, 'F3', 0.8, { articulation: 'ring' }], [OUT + 3, 5, 'F3', 0.85, { articulation: 'ring' }]);
saw.push([CHIME + 4, 3.75, 'C4', 0.34, { articulation: 'swell' }], [CHIME + 4.5, 3.25, 'F3', 0.3, { articulation: 'swell' }],
  [CR, 14, 'F3', 0.55, { articulation: 'swell' }], [CR + 14, 14, 'F3', 0.6, { articulation: 'fifth-under' }], [CR, 28, 'C4', 0.42, { articulation: 'swell' }],
  [OUT + 1, 7, 'F3', 0.42, { articulation: 'swell' }]);
for (const from of [HB, SH, SH + 16]) for (let bar = 0; bar < 4; bar++) for (const [x, p] of [[0.5, 'C4'], [1.5, 'Eb4'], [2.5, 'C4'], [3.5, 'Ab3']] as [number, string][])
  chank.push([from + 4 * bar + x, 0.25, chordAt(bar) === 'Gb7' && p === 'Eb4' ? 'E4' : p, x === 1.5 || x === 3.5 ? 0.5 : 0.36, { articulation: 'damped' }]);
chank.push([CR + 27, 1, 'C5', 0.7, { articulation: 'laser' }]);

// ------------------------------------------------------------------------------------------------ the reed (Brother Ezra)
const reed: N[] = [
  ...sh(THEME, HA), ...sh(THEME_B, HB),
  // crossing: barks on the long group
  [CR + 14 + 2, 0.5, 'Gb4', 0.82, { articulation: 'accent' }], [CR + 14 + 2.5, 0.75, 'F4', 0.7, { articulation: 'growl' }],
  [CR + 17.5 + 2, 0.5, 'Ab4', 0.82, { articulation: 'accent' }], [CR + 17.5 + 2.5, 0.75, 'Gb4', 0.72, { articulation: 'growl' }],
  [CR + 21 + 2, 1, 'C5', 0.85, { articulation: 'growl' }], [CR + 21 + 3, 0.5, 'Db5', 0.8, { articulation: 'accent' }],
  [CR + 24.5 + 2, 1.25, 'Gb5', 0.88, { articulation: 'flutter' }],
  // stop
  [ST, 0.45, 'C5', 0.95, { articulation: 'accent' }], [ST + 0.75, 0.55, 'E5', 0.95, { articulation: 'accent' }],
  ...sh(THEME_HOT, SH), ...sh(THEME.filter(n => n[0] < 12), SH + 16),
  [SH + 28, 1, 'C5', 0.9, { articulation: 'accent' }], [SH + 29.5, 0.5, 'Db5', 0.8], [SH + 30, 0.5, 'D5', 0.82], [SH + 30.5, 0.5, 'Eb5', 0.85], [SH + 31, 0.75, 'E5', 0.9, { articulation: 'growl' }],
  [OUT, 3, 'C5', 0.9, { articulation: 'fall', fall: 7 }],
];

// ------------------------------------------------------------------------------------------------ Odile
const voice: N[] = [
  // chime: one sigh over the bell
  [CHIME + 2.5, 1.25, 'C5', 0.56, { vowel: 'oo', to: 'oh', articulation: 'fall', fall: 3 }],
  // head-a answers
  [HA + 7.75, 0.75, 'Ab4', 0.55, { vowel: 'oh', to: 'oo', articulation: 'cry', cry: 2 }],
  [HA + 12.25, 1.5, 'E4', 0.42, { vowel: 'mm', articulation: 'hum' }],
  // head-b: an answer, then the last bar an octave under the reed
  [HB + 7.75, 0.75, 'C5', 0.6, { vowel: 'ah', to: 'oh', articulation: 'cry', cry: 2 }],
  [HB + 12, 0.5, 'C4', 0.6, { vowel: 'oh' }], [HB + 12.5, 0.5, 'Db4', 0.58, { vowel: 'ah' }], [HB + 13, 1.5, 'E4', 0.66, { vowel: 'ah', to: 'oh', scoop: 2 }],
  [HB + 14.5, 0.5, 'Db4', 0.58, { vowel: 'oh' }], [HB + 15, 0.5, 'Bb3', 0.56, { vowel: 'uh' }], [HB + 15.5, 0.5, 'Gb3', 0.55, { vowel: 'oh', to: 'mm' }],
  // odile: the theme sung, then a scat run, then a fall of a fourth
  [OD + 0.5, 0.25, 'C5', 0.62, { vowel: 'eh', articulation: 'detached' }], [OD + 0.75, 0.25, 'C5', 0.7, { vowel: 'ah', articulation: 'detached' }],
  [OD + 1, 1.5, 'Eb5', 0.78, { vowel: 'oh', to: 'oo', scoop: 2 }], [OD + 2.75, 0.25, 'Db5', 0.55, { vowel: 'ee', articulation: 'detached' }],
  [OD + 3, 0.5, 'C5', 0.62, { vowel: 'ah' }], [OD + 3.5, 1.75, 'Ab4', 0.66, { vowel: 'oh', to: 'mm' }],
  [OD + 5.5, 0.5, 'G4', 0.55, { vowel: 'oo' }], [OD + 6, 0.5, 'Ab4', 0.6, { vowel: 'ah' }], [OD + 6.5, 1.25, 'F4', 0.62, { vowel: 'oh', articulation: 'fall', fall: 2 }],
  ...([['Bb4', 'ee'], ['Db5', 'ah'], ['F5', 'oo'], ['Ab5', 'ah'], ['F5', 'eh'], ['Eb5', 'oh'], ['Db5', 'uh'], ['C5', 'ah']] as [string, string][])
    .map(([p, vw], i) => [OD + 8 + 0.25 * i, 0.25, p, 0.6 + (i === 3 ? 0.1 : 0), { vowel: vw, articulation: 'detached' }] as N),
  [OD + 10, 1.5, 'F5', 0.78, { vowel: 'ah', to: 'eh', articulation: 'cry', cry: 3 }], [OD + 11.5, 0.5, 'Eb5', 0.6, { vowel: 'eh', to: 'oh' }],
  [OD + 12, 2.75, 'C5', 0.74, { vowel: 'oh', to: 'aw', articulation: 'fall', fall: 5 }],
  [OD + 15, 0.5, 'Ab4', 0.5, { vowel: 'mm', articulation: 'hum' }], [OD + 15.5, 0.5, 'E4', 0.5, { vowel: 'mm', articulation: 'hum' }],
  // crossing: somewhere she should not be
  [CR + 7, 3, 'Ab4', 0.6, { vowel: 'oo', to: 'oh' }], [CR + 10, 1, 'Gb4', 0.56, { vowel: 'oh', slide: 0.3 }], [CR + 11, 2.4, 'F4', 0.55, { vowel: 'oh', to: 'oo', articulation: 'fall', fall: 0.8 }],
  [CR + 17.5, 2, 'C5', 0.62, { vowel: 'ah', to: 'aw', articulation: 'cry', cry: 1 }], [CR + 19.5, 1.5, 'Db5', 0.6, { vowel: 'aw', slide: 0.2 }], [CR + 21, 3, 'C5', 0.58, { vowel: 'oh', to: 'mm' }],
  // shout, chorus 1: cries in the holes
  [SH + 7.75, 0.75, 'C5', 0.68, { vowel: 'ah', articulation: 'cry', cry: 3 }], [SH + 14.5, 1.25, 'F5', 0.66, { vowel: 'ah', to: 'oh', articulation: 'fall', fall: 4 }],
  // shout, chorus 2: unison with the reed
  ...sh(THEME.filter(n => n[0] < 12), SH + 16).map(([b, l, p, v], i) => [b, l, p, v * 0.82, { vowel: ['ah', 'eh', 'oh', 'ee', 'ah', 'oh', 'oo', 'ah', 'oh'][i % 9]!, ...(l <= 0.25 ? { articulation: 'detached' } : {}) }] as N),
  [SH + 28, 1, 'C5', 0.7, { vowel: 'ah' }], [SH + 29.5, 2.25, 'E5', 0.72, { vowel: 'ah', to: 'ee', articulation: 'cry', cry: 2 }],
  [OUT, 2.5, 'C5', 0.66, { vowel: 'oh', to: 'oo', articulation: 'fall', fall: 7 }],
];
const breaths = [[CHIME + 2.05, 0.4], [HA + 7.35, 0.35], [OD - 0.4, 0.4], [OD + 7.6, 0.35], [OD + 11.85, 0.3], [CR + 6.5, 0.45], [CR + 17, 0.45], [ST + 3.4, 0.5], [SH + 15.4, 0.5]]
  .map(([beat, beats]) => ({ beat, beats, kind: 'in', velocity: 0.5 }))
  .concat([{ beat: OUT + 6.3, beats: 1.6, kind: 'out', velocity: 0.5 }]);

// ------------------------------------------------------------------------------------------------ score
const stepCurve = (pts: [number, number][], glide = 0.25) => ({ steps: pts, glide });
const score = {
  schema: 'daemonv12.signature-rack.score/1', title: 'Two Coins for the Ferryman', bpm: +BPM.toFixed(6), key: 'F minor', timeSignature: '4/4', swing: 0.56, seed: 1971,
  tailSeconds: 3.5, masterGainDb: -3,
  description: 'THE VELVET HEARSE, "Two Coins for the Ferryman" (an imaginary record): the house combo of a funeral home, 1971. Funeral chime, a polite theme, a drum break the drummer could not resist, a sung chorus, a 7/8 crossing, stop-time, two hot choruses and an unresolved ferryman chord.',
  sections: [
    { id: 'chime', bars: 2, development: 'the viewing-room bell alone; Odile breathes in and sighs one note; the bowed saw and the clock' },
    { id: 'head-a', bars: 4, development: 'the theme politely: reed, voice, Rhodes tines, vibes, bass, conga tones; no drum kit' },
    { id: 'break', bars: 2, development: 'the drums alone, one late snare, a conga roll' },
    { id: 'head-b', bars: 4, development: 'the whole band; Odile doubles the reed an octave down in the last bar' },
    { id: 'odile', bars: 4, development: 'kit out; the theme sung over bass and vibes, a scat run, a long fall' },
    { id: 'crossing', bars: 7, development: 'eight cycles of 7/8 (2+2+3): vibes riff turning metallic, hands, log, saw, bell, the impossible voice, reed barks' },
    { id: 'stop', bars: 1, development: 'two stabs, silence, the bass alone on low F' },
    { id: 'shout', bars: 8, development: 'feral reed with one overblown note, cries; then reed and voice in unison, a chromatic climb' },
    { id: 'out', bars: 2, development: 'the ferryman chord, unresolved; the bell; two coins; a breath out' },
  ],
  room: { rt60: 1.7, size: 0.95, damp: 5000, predelayMs: 16, lowCut: 200 },
  parts: [
    { id: 'kick', instrument: 'context/kick', gainDb: -4, context: false, humanize: { timingMs: 4, velocity: 0.06 }, notes: kick },
    { id: 'snare', instrument: 'context/snare', gainDb: -7, room: 0.1, context: false, humanize: { timingMs: 5, velocity: 0.06 }, notes: snare },
    { id: 'clock', instrument: 'mechanical-orchestra/clock', gainDb: -14, pan: -0.2, room: 0.08, macro: 0.12, controls: { zip: 0 }, humanize: { timingMs: 3, velocity: 0.1 }, notes: hat },
    { id: 'congas', instrument: 'organic-percussion/skin', gainDb: -8, pan: 0.35, room: 0.14, macro: [[0, 0.15], [CR, 0.15], [CR + 0.5, 0.4], [ST, 0.4], [ST + 0.5, 0.2], [END, 0.25]],
      controls: { buzz: 0.1 }, setup: { spread: 0.5, seed: 7 }, humanize: { timingMs: 6, velocity: 0.1 }, notes: congas },
    { id: 'log', instrument: 'organic-percussion/log', gainDb: -11, pan: -0.35, room: 0.16, macro: 0.35, setup: { seed: 9 }, humanize: { timingMs: 4, velocity: 0.08 }, notes: log },
    { id: 'bass', instrument: 'living-bass', gainDb: -3, room: 0.04, macro: [[0, 0.08], [CR, 0.08], [CR + 0.5, 0.24], [ST, 0.24], [ST + 0.5, 0.08], [SH, 0.16], [END, 0.26]],
      controls: { servo: 0.3, ratchet: 0, chassis: 0 }, expression: [[0, 0.62], [HB, 0.72], [SH, 0.8], [END, 0.8]], setup: { seed: 33 }, humanize: { timingMs: 5, velocity: 0.06 }, notes: bass },
    { id: 'rhodes', instrument: 'mechanical-orchestra/tine', gainDb: -13, pan: -0.15, room: 0.2, macro: 0.02, controls: { buzz: 0.04, detune: 4 }, setup: { spread: 0.3, seed: 5 },
      humanize: { timingMs: 5, velocity: 0.07 }, notes: rhodes.map(n => [n[0], n[1], n[2], n[3], { articulation: 'clean' }] as N) },
    { id: 'vibes', instrument: 'mechanical-orchestra/bar', gainDb: -12, pan: 0.2, room: 0.22,
      macro: [[0, 0.05], [CR, 0.05], [CR + 0.5, 0.12], [ST - 0.5, 0.56], [ST, 0.05], [END, 0.05]],
      controls: { hardness: [[0, 0.45], [CR, 0.45], [CR + 0.5, 0.75], [ST, 0.55], [END, 0.55]], damp: [[0, 1.3], [CR, 1.3], [CR + 0.5, 0.8], [ST, 1.25], [END, 1.25]] },
      setup: { spread: 0.35, seed: 21 }, humanize: { timingMs: 4, velocity: 0.07 }, notes: vibes },
    { id: 'bell', instrument: 'mechanical-orchestra/bar', gainDb: -9, room: 0.3, macro: 0.88, controls: { hardness: 0.6, damp: 1.45, detune: -22 }, setup: { spread: 0.1, seed: 13 }, notes: bell },
    { id: 'saw', instrument: 'mechanical-orchestra/bow', gainDb: -16, pan: -0.25, room: 0.3, macro: [[0, 0.4], [CR, 0.4], [ST, 0.72], [OUT, 0.5], [END, 0.5]], controls: { chatter: 0.25 }, setup: { seed: 17 }, notes: saw },
    { id: 'chank', instrument: 'mechanical-orchestra/spring', gainDb: -13, pan: 0.4, room: 0.12, macro: 0.05, controls: { decay: 0.35 }, setup: { seed: 23 }, humanize: { timingMs: 5, velocity: 0.1 }, notes: chank },
    { id: 'reed', instrument: 'breath-reed', gainDb: -5, pan: 0.08, room: 0.24,
      macro: stepCurve([[0, 0.3], [HB, 0.42], [CR, 0.66], [ST, 0.6], [SH, 0.84], [SH + 16, 0.66], [SH + 28, 0.8], [END, 0.8]]),
      controls: { air: stepCurve([[0, 0.5], [HB, 0.4], [SH, 0.2], [SH + 16, 0.3]]), vib: 1.1, bite: stepCurve([[0, 0.28], [SH, 0.6], [SH + 16, 0.45]]) },
      expression: [[0, 0.68], [HB, 0.74], [SH, 0.86], [END, 0.86]], setup: { seed: 1937 }, humanize: { timingMs: 6, velocity: 0.05 }, notes: reed },
    { id: 'odile', instrument: 'impossible-voice', gainDb: -2, pan: -0.06, room: 0.22,
      macro: stepCurve([[0, 0.06], [CR, 0.72], [ST, 0.12], [SH, 0.22], [OUT, 0.3]], 0.5),
      controls: { breath: 0.34, vib: 1.0, glass: stepCurve([[0, 0.05], [CR, 0.55], [ST, 0.08], [OUT, 0.08], [OUT + 6, 0.7]], 0.5),
        whistle: stepCurve([[0, 0], [CR, 0.6], [ST, 0]], 0.5), under: stepCurve([[0, 0], [CR, 0.45], [ST, 0]], 0.5) },
      expression: [[0, 0.62], [OD, 0.7], [CR, 0.62], [SH, 0.8], [END, 0.75]], setup: { vibRate: 5.4, vibCents: 30, seed: 1944 },
      overtone: { steps: [[CR + 7, 6], [CR + 8.5, 8], [CR + 10, 7], [CR + 11, 6], [CR + 17.5, 8], [CR + 19.5, 9], [CR + 21, 8], [CR + 22.5, 6]], glide: 0.12 },
      breaths, humanize: { timingMs: 7, velocity: 0.05 }, notes: voice },
  ],
};

const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, 'two-coins-for-the-ferryman.score.json'), JSON.stringify(score, null, 1) + '\n');
console.log(`wrote two-coins-for-the-ferryman.score.json: ${score.parts.length} parts, ${score.parts.reduce((a, p) => a + p.notes.length, 0)} notes, ${END / 4} bars at ${score.bpm} BPM`);
