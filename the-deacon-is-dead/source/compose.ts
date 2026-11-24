/**
 * THE VELVET HEARSE · "The Deacon Is Dead"
 * Lazarus Sound Library LSL-45-013 (1972), a 7-inch single. An imaginary record.
 *
 * Deacon Mortimer Vane, who played the upright bass, died in the spring of 1972. The night before his funeral his widow
 * locked the band's instruments in the hearse with him: no music in the house while he lay in it. So the band played
 * the house. Lazarus's engineer left the portable recorder running in the preparation room.
 *
 *   Ignatius "Iggy" Plank ... the Deacon's coffin, a slit drum      organic-percussion/log: two tongues, lid knuckle, rail, scrape
 *                             rosary beads on a tambourine skin     organic-percussion/skin, slap with the beads rattling (the snare)
 *   Brother Ezra Coffin ..... the cremation urn (his reed split)    organic-percussion/pot: palm thud (the kick), whoops
 *   Mrs. Vane ............... the hearse's spare coil spring        mechanical-orchestra/spring: the boing bass, laser at the end
 *   Lucius Vane ............. a likembe built that night from the   mechanical-orchestra/tine with full bridge buzz
 *                             casket-handle springs and a cigar box
 *   Odile Vane .............. a friction drum (she would not sing)  organic-percussion/skin, rub: a wet finger that moans and laughs
 *   the mourners ............ the collection plate of coins         mechanical-orchestra/bearings, one ping per coin
 *                             the hearse's brake drum               mechanical-orchestra/bar, hard and muted: the bell pattern
 *   the house ............... the preparation-room door             mechanical-orchestra/bow: the hinge
 *   the Deacon .............. knocks from inside                    organic-percussion/log, muffled, a step lower
 *
 * Nobody plays a bass, a voice or a reed. The Deacon's line is split three ways (urn, coffin, spring), so the bass line
 * only exists between three objects.
 *
 * TUNING. Lucius had nothing to tune the likembe against, so he tuned it to nothing: seven equal steps to the octave
 * (171.4 cents each). Everything pitched on the record (the coffin's tongues, the urn, the spring, the brake drum) was
 * matched to it. In seven equal steps every triad has the same shape (root, a neutral third of 343 cents, a fifth 16
 * cents flat), so no chord is major or minor and a chord change is only a change of root. The tonic is A.
 *
 * 117.03 BPM (96 x 2^(2/7): slowed two steps of its own scale the record sits on a 96 BPM grid, still in seven equal
 * steps), swing 0.54, 38 bars, 4/4. The hook: a bass line hocketed between urn, coffin and spring, and every second bar
 * the band drops out for three knocks on the coffin lid.
 *
 *   lid      3 bars  the door creaks; three knocks on the lid; the spring and the urn tried once each; coins;
 *                    the likembe picks up
 *   thumb    2 bars  the likembe alone, then Iggy's three knocks: the hook's skeleton
 *   wake     8 bars  the hook: urn, coffin and spring split the Deacon's line; bead snare, coins. Bars 5-8 add Odile's
 *                    friction drum in the holes and the brake drum. Roots 0 0 5 3 | 0 0 5 6
 *   break    2 bars  drums alone: urn, beads, coins, the coffin scraped like a guiro, the three knocks
 *   odile    4 bars  the floor: Odile's drum talks and laughs over the likembe, the spring and one urn thud per bar
 *   stairs   7 bars  the pallbearers carry him up seven steps: half time, the whole band one step higher every bar,
 *                    home an octave up on the seventh
 *   knock    2 bars  two stabs, silence; three knocks answer from inside the coffin; the door creaks
 *   shout    8 bars  the hook hot: cavernous drums, the spring chirping, the likembe fully buzzing; every knock bar's
 *                    third knock comes from inside
 *   out      2 bars  the last hit; the spring rings out as a laser; the coins spill; one knock from inside; the door
 *
 * Writes the rack score next to this file:   node the-deacon-is-dead/source/compose.ts
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type O = Record<string, number | string>;
type N = [number, number, number, number, O?];

// ------------------------------------------------------------------------------------------------ tuning and form
/** One step of seven equal steps per octave, in semitones. */
export const STEP = 12 / 7;
/** Degree `k` (any integer, 7 = the octave) above a base MIDI pitch, rounded to 1/10000 semitone. */
export const deg = (k: number, base: number) => +(base + k * STEP).toFixed(4);
export const BPM = 96 * 2 ** (2 / 7);
export const SEC = { lid: 0, thumb: 12, wake: 20, brk: 52, odile: 60, stairs: 76, knock: 104, shout: 112, out: 144, end: 152 };
const { lid: LID, thumb: TH, wake: WK, brk: BRK, odile: OD, stairs: ST, knock: KN, shout: SH, out: OUT, end: END } = SEC;
const s16 = (slot: number) => slot / 4;   // sixteenth slot -> beats

// bases (degree 0 = A)
const LIK = 69, COF = 45, URN = 45, WHOOP = 57, SPR = 33, CUI = 57, BEAD = 62, BRAKE = 81;
/** fold a pitch into [lo, hi] by octaves */
const fold = (p: number, lo: number, hi: number) => { while (p > hi) p -= 12; while (p < lo) p += 12; return +p.toFixed(4); };

// ------------------------------------------------------------------------------------------------ parts
const likembe: N[] = [], coffin: N[] = [], inside: N[] = [], urn: N[] = [], spring: N[] = [], cuica: N[] = [], beads: N[] = [],
  coins: N[] = [], brake: N[] = [], door: N[] = [];

/** The likembe ostinato, one bar: [slot, degree above the root, accent]. The accented top line (slots 0 3 6 9 12 14)
 * wobbles around the octave and peaks on the high neutral third; the fifth (4) is the stride in between. */
const LIK_BAR: [number, number, boolean][] = [
  [0, 0, true], [2, 4, false], [3, 7, true], [5, 4, false], [6, 6, true], [8, 4, false], [9, 7, true], [10, 2, false],
  [11, 4, false], [12, 9, true], [13, 7, false], [14, 6, true], [15, 4, false],
];
function lik(bar0: number, root: number, o: { upTo?: number; vel?: number; from?: number } = {}) {
  for (const [slot, k, acc] of LIK_BAR) {
    if (slot >= (o.upTo ?? 16) || slot < (o.from ?? 0)) continue;
    likembe.push([bar0 + s16(slot), 0.5, fold(deg(root + k, LIK), 60, 99), (acc ? 0.86 : 0.5) * (o.vel ?? 1)]);
  }
}
/** Iggy's three knocks on the lid (slots 10 12 14 of a bar): the motto. `insideThird` hands the last one to the Deacon. */
function knocks(bar0: number, v = 0.9, insideThird = false) {
  coffin.push([bar0 + 2.5, 0.25, deg(0, COF), v, { articulation: 'knuckle' }], [bar0 + 3, 0.25, deg(0, COF), v * 0.95, { articulation: 'knuckle' }]);
  if (insideThird) inside.push([bar0 + 3.5, 0.5, deg(-3, COF), 0.95, { articulation: 'strike' }]);
  else coffin.push([bar0 + 3.5, 0.25, deg(0, COF), v * 1.05, { articulation: 'knuckle' }]);
}
/** The hook bar A: the Deacon's line split three ways. */
function hookA(bar0: number, r: number, hot = false) {
  urn.push([bar0, 0.5, deg(0, URN), 1, { articulation: 'palm' }]);
  coffin.push([bar0 + s16(3), 0.5, deg(0, COF), 0.85, { articulation: 'strike' }]);
  spring.push([bar0 + s16(6), 0.9, fold(deg(r + 4, SPR), 28, 46), 0.92, { articulation: 'twang' }]);
  urn.push([bar0 + s16(10), 0.25, fold(deg(r + 2, WHOOP), 50, 66), 0.85, { articulation: 'whoop' }]);
  coffin.push([bar0 + s16(11), 0.25, deg(4, COF), 0.6, { articulation: 'knuckle' }], [bar0 + s16(13), 0.25, deg(0, COF), 0.32, { articulation: 'rim' }]);
  spring.push([bar0 + s16(14), 0.5, fold(deg(r + 6, SPR), 28, 46), 0.8, { articulation: hot ? 'twang' : 'pluck' }]);
  urn.push([bar0 + s16(9), 0.25, deg(0, URN), 0.55, { articulation: 'palm' }]);
}
/** The hook bar B: the same start, then the band drops out for the knocks. */
function hookB(bar0: number, r: number, insideThird = false) {
  urn.push([bar0, 0.5, deg(0, URN), 1, { articulation: 'palm' }]);
  coffin.push([bar0 + s16(3), 0.5, deg(0, COF), 0.85, { articulation: 'strike' }]);
  spring.push([bar0 + s16(6), 0.9, fold(deg(r + 4, SPR), 28, 46), 0.92, { articulation: 'twang' }]);
  urn.push([bar0 + s16(7), 0.25, deg(0, URN), 0.6, { articulation: 'palm' }]);
  knocks(bar0, 0.9, insideThird);
}
/** Drums under the hook: bead snare on 2 and 4 (none on the knock bar's 4), coins on every sixteenth. */
function drums(bar0: number, knockBar: boolean, hot = false) {
  beads.push([bar0 + 1, 0.25, BEAD, 0.95, { articulation: 'slap' }]);
  if (!knockBar) beads.push([bar0 + 3, 0.25, BEAD, 0.95, { articulation: 'slap' }], [bar0 + s16(7), 0.25, BEAD, 0.3, { articulation: 'tap' }], [bar0 + s16(15), 0.25, BEAD, 0.34, { articulation: 'tap' }]);
  if (hot && !knockBar) beads.push([bar0 + s16(10), 0.25, BEAD, 0.28, { articulation: 'tap' }], [bar0 + s16(2), 0.25, BEAD, 0.25, { articulation: 'tap' }]);
  for (let s = 0; s < (knockBar ? 10 : 16); s++) coin(bar0 + s16(s), s % 4 === 2 ? 0.62 : s % 2 ? 0.34 : 0.45, hot);
}
const COIN_P = [deg(0, 84), deg(2, 84), deg(4, 84), deg(6, 84), deg(1, 96), deg(3, 96)];
let cseed = 7;
const crnd = () => { cseed = (cseed * 1103515245 + 12345) >>> 0; return cseed / 4294967296; };
/** Two coins per shake, a hair apart. */
function coin(b: number, v: number, hot = false) {
  coins.push([b, 0.2, COIN_P[Math.floor(crnd() * COIN_P.length)]!, v], [b + 0.012, 0.2, COIN_P[Math.floor(crnd() * COIN_P.length)]!, v * 0.7]);
  if (hot) coins.push([b + 0.03, 0.2, COIN_P[Math.floor(crnd() * COIN_P.length)]!, v * 0.5]);
}
/** The brake drum's bell pattern (bar A: 0 3 6 10 12; bar B stops before the knocks). */
function brakeBell(bar0: number, knockBar: boolean, hot = false) {
  const slots = knockBar ? [0, 3, 6] : hot ? [0, 2, 3, 6, 8, 10, 12, 14] : [0, 3, 6, 10, 12];
  for (const s of slots) brake.push([bar0 + s16(s), 0.25, s === 6 || s === 12 ? deg(3, BRAKE) : deg(0, BRAKE), s % 4 === 0 ? 0.85 : 0.68, { articulation: 'hard' }]);
}
/** Odile's answer in a bar-A hole (under the spring's ring): "wee-oo". */
function weeOo(bar0: number, v = 0.85, up = 0) {
  cuica.push([bar0 + s16(7), 0.25, deg(up, CUI), v, { articulation: 'rub', bend: 7 }], [bar0 + s16(8), 0.5, deg(up, CUI), v * 0.9, { articulation: 'rub', bend: -5 }]);
}

// ------------------------------------------------------------------------------------------------ lid (2 bars)
door.push([LID, 1.6, 47, 0.85, { articulation: 'bite', attack: 0.12 }]);
knocks(LID, 0.95);
// Mrs. Vane tries the spring, Ezra the urn: each sound alone once before the band starts
spring.push([LID + 4, 1.5, deg(0, SPR), 0.95, { articulation: 'twang' }], [LID + 6, 1, deg(4, SPR), 0.9, { articulation: 'twang' }]);
urn.push([LID + 7, 0.25, deg(2, WHOOP), 0.88, { articulation: 'whoop' }], [LID + 7.5, 0.5, deg(0, URN), 0.95, { articulation: 'palm' }]);
for (const s of [0, 1, 2, 3, 4, 5, 6, 7]) coin(LID + 8 + s16(s), 0.24 + 0.05 * s);
lik(LID + 8, 0, { from: 9 });

// ------------------------------------------------------------------------------------------------ thumb (2 bars)
lik(TH, 0);
lik(TH + 4, 0, { upTo: 10 });
knocks(TH + 4, 0.9);

// ------------------------------------------------------------------------------------------------ wake (8 bars)
const WAKE_ROOTS = [0, 0, 5, 3, 0, 0, 5, 6];
WAKE_ROOTS.forEach((r, i) => {
  const b0 = WK + 4 * i, knockBar = i % 2 === 1;
  lik(b0, r, knockBar ? { upTo: 10 } : {});
  if (knockBar) hookB(b0, r); else hookA(b0, r);
  drums(b0, knockBar);
  if (i >= 4) { brakeBell(b0, knockBar); if (!knockBar) weeOo(b0, 0.85, i === 6 ? 2 : 0); }
});

// ------------------------------------------------------------------------------------------------ break (2 bars): every hit lands clean
// urn kicks, bead slaps and coffin rim clicks never share a sixteenth; the coins only shake on the off-sixteenths
for (const [s, v] of [[0, 1], [7, 0.75], [10, 0.92]] as [number, number][]) urn.push([BRK + s16(s), 0.5, deg(0, URN), v, { articulation: 'palm' }]);
for (const [s, v] of [[0, 1], [10, 0.6]] as [number, number][]) urn.push([BRK + 4 + s16(s), 0.5, deg(0, URN), v, { articulation: 'palm' }]);
for (const [s, v, a] of [[4, 0.98, 'slap'], [12, 0.98, 'slap'], [15, 0.32, 'tap']] as [number, number, string][]) beads.push([BRK + s16(s), 0.25, BEAD, v, { articulation: a }]);
beads.push([BRK + 4 + 1, 0.25, BEAD, 0.98, { articulation: 'slap' }]);
for (const s of [2, 6, 14]) coffin.push([BRK + s16(s), 0.25, deg(0, COF), 0.45, { articulation: 'rim' }]);
coffin.push([BRK + 4 + s16(6), 0.9, deg(4, COF), 0.7, { articulation: 'scrape' }]);
for (let s = 1; s < 16; s += 2) coin(BRK + s16(s), 0.4);
for (let s = 1; s < 10; s += 2) coin(BRK + 4 + s16(s), 0.4);
knocks(BRK + 4, 0.95);

// ------------------------------------------------------------------------------------------------ odile (4 bars): the floor
// likembe on root 3, quiet; the spring holds each bar's root; one urn thud per bar; coins on the off-beats. Four parts.
const ODILE_ROOTS = [3, 3, 1, 6];
ODILE_ROOTS.forEach((r, i) => {
  const b0 = OD + 4 * i;
  lik(b0, r, { vel: 0.72 });
  spring.push([b0, 1.75, fold(deg(r, SPR), 28, 46), 0.88, { articulation: 'pluck' }]);
  urn.push([b0, 0.5, deg(0, URN), 0.85, { articulation: 'palm' }]);
  for (const s of [2, 6, 10, 14]) coin(b0 + s16(s), 0.36);
});
// Odile's drum talks: [beat in the section, beats, degree above CUI, velocity, bend]
const ODILE_PHRASE: [number, number, number, number, number][] = [
  [0, 0.5, 3, 0.9, 7], [0.75, 0.25, 3, 0.75, 9], [1, 0.25, 3, 0.8, 9], [1.5, 0.75, 3, 0.85, -5], [3, 0.25, 5, 0.8, 12], [3.25, 0.25, 5, 0.85, 12], [3.5, 0.5, 5, 0.9, -7],
  [6, 0.2, 7, 0.75, 10], [6.25, 0.2, 7, 0.8, 10], [6.5, 0.2, 7, 0.85, 10], [6.75, 0.2, 7, 0.9, 10], [7, 1, 5, 0.9, -4],
  [8, 0.5, 1, 0.9, 7], [8.75, 0.25, 1, 0.75, 9], [9, 0.25, 1, 0.8, 9], [9.5, 0.75, 1, 0.85, -5], [11, 0.25, 4, 0.8, 12], [11.25, 0.25, 4, 0.85, 12], [11.5, 0.5, 4, 0.9, -7],
  [12.5, 0.25, 6, 0.8, 9], [13, 0.25, 6, 0.85, 9], [13.5, 2, 6, 0.95, 12],
];
for (const [b, l, k, v, bend] of ODILE_PHRASE) cuica.push([OD + b, l, deg(k, CUI), v, { articulation: 'rub', bend }]);

// ------------------------------------------------------------------------------------------------ stairs (7 bars): up seven steps
for (let i = 0; i < 7; i++) {
  const b0 = ST + 4 * i, r = i + 1;
  lik(b0, r, { vel: 0.9 });
  urn.push([b0, 0.5, deg(0, URN), 1, { articulation: 'palm' }], [b0 + s16(10), 0.5, deg(0, URN), 0.8, { articulation: 'palm' }]);
  beads.push([b0 + 2, 0.25, BEAD, 1, { articulation: 'slap' }], [b0 + s16(15), 0.25, BEAD, 0.3, { articulation: 'tap' }]);
  // the pallbearers' feet on the coffin: low, high, low, high; a scrape drags into the next step
  coffin.push([b0, 0.5, deg(0, COF), 0.8, { articulation: 'strike' }], [b0 + 1, 0.5, deg(4, COF), 0.7, { articulation: 'strike' }],
    [b0 + 2, 0.5, deg(0, COF), 0.78, { articulation: 'strike' }], [b0 + 3, 0.7, deg(4, COF), 0.62, { articulation: 'scrape' }]);
  spring.push([b0, 1.75, fold(deg(r, SPR), 28, 50), 0.95, { articulation: 'twang' }], [b0 + 2, 1.5, fold(deg(r + 4, SPR), 28, 50), 0.82, { articulation: 'twang' }]);
  for (let q = 0; q < 4; q++) brake.push([b0 + q, 0.25, deg(r + (q % 2 ? 3 : 0), BRAKE - 12), q === 0 ? 0.85 : 0.6, { articulation: 'hard' }]);
  for (let s = 0; s < 16; s += 2) coin(b0 + s16(s), s % 4 ? 0.5 : 0.36);
  cuica.push([b0 + s16(14), 0.5, fold(deg(r, CUI), 50, 68), 0.82, { articulation: 'rub', bend: 9 }]);
}

// ------------------------------------------------------------------------------------------------ knock (2 bars)
for (const b of [KN, KN + 0.75]) {
  urn.push([b, 0.5, deg(0, URN), 1, { articulation: 'palm' }]);
  coffin.push([b, 0.5, deg(0, COF), 0.95, { articulation: 'strike' }]);
  beads.push([b, 0.25, BEAD, 1, { articulation: 'slap' }]);
  spring.push([b, 0.6, deg(0, SPR), 1, { articulation: 'damped' }]);
  brake.push([b, 0.25, deg(0, BRAKE), 0.9, { articulation: 'hard' }], [b, 0.25, deg(2, BRAKE), 0.8, { articulation: 'hard' }]);
}   // no likembe here: its tines cannot be damped and would ring through the silence
// silence; then from inside: knock ... knock .. knock; the door
inside.push([KN + 4.5, 0.5, deg(-3, COF), 0.85, { articulation: 'strike' }], [KN + 5.25, 0.5, deg(-3, COF), 0.9, { articulation: 'strike' }],
  [KN + 6, 0.5, deg(-3, COF), 1, { articulation: 'strike' }]);
door.push([KN + 6.75, 1.25, 44, 0.95, { articulation: 'overpressure', attack: 0.2 }]);

// ------------------------------------------------------------------------------------------------ shout (8 bars)
WAKE_ROOTS.forEach((r, i) => {
  const b0 = SH + 4 * i, knockBar = i % 2 === 1;
  lik(b0, r, knockBar ? { upTo: 10 } : {});
  if (knockBar) hookB(b0, r, true); else hookA(b0, r, true);
  drums(b0, knockBar, true);
  brakeBell(b0, knockBar, true);
  if (!knockBar) {   // Odile screams: higher, wider bends, a laugh in the last bar-A
    cuica.push([b0 + s16(7), 0.25, deg(4, CUI), 0.95, { articulation: 'rub', bend: 12 }], [b0 + s16(8), 0.5, deg(4, CUI), 0.9, { articulation: 'rub', bend: -9 }]);
    if (i === 6) for (const s of [12, 13, 14, 15]) cuica.push([b0 + s16(s), 0.2, deg(7, CUI), 0.9, { articulation: 'rub', bend: 10 }]);
  } else spring.push([b0 + 2, 0.5, deg(r + 2, SPR + 12), 0.85, { articulation: 'laser' }]);
});

// ------------------------------------------------------------------------------------------------ out (2 bars)
urn.push([OUT, 0.5, deg(0, URN), 1, { articulation: 'palm' }]);
coffin.push([OUT, 0.5, deg(0, COF), 1, { articulation: 'strike' }], [OUT, 0.5, deg(4, COF), 0.9, { articulation: 'strike' }]);
beads.push([OUT, 0.25, BEAD, 1, { articulation: 'slap' }]);
brake.push([OUT, 0.25, deg(0, BRAKE), 0.95, { articulation: 'hard' }]);
for (const k of [0, 2, 4, 6, 7]) likembe.push([OUT, 1.5, fold(deg(k, LIK), 60, 99), 0.95]);
spring.push([OUT, 3.5, deg(0, SPR), 1, { articulation: 'laser' }]);
for (const [s, k, v] of [[3, 7, 0.6], [6, 6, 0.45], [9, 7, 0.32]] as [number, number, number][]) likembe.push([OUT + s16(s), 0.5, deg(k, LIK), v]);
inside.push([OUT + 5, 0.5, deg(-3, COF), 0.7, { articulation: 'strike' }]);
door.push([OUT + 6, 1.6, 43, 0.8, { articulation: 'overpressure', attack: 0.3 }]);

// ------------------------------------------------------------------------------------------------ score
const stepCurve = (pts: [number, number][], glide = 0.25) => ({ steps: pts, glide });
const score = {
  schema: 'daemonv12.signature-rack.score/1', title: 'The Deacon Is Dead', bpm: +BPM.toFixed(6), key: 'A minor', timeSignature: '4/4', swing: 0.54, seed: 1972,
  tailSeconds: 3, masterGainDb: -3,
  description: 'THE VELVET HEARSE, "The Deacon Is Dead" (an imaginary 1972 single): the band plays the funeral home the night before the bass player\'s funeral, because their instruments are locked in the hearse with him. Coffin, urn, a hearse spring, a likembe tuned to seven equal steps, a friction drum, beads, coins, a brake drum and a door. No bass, no voice, no reed.',
  sections: [
    { id: 'lid', bars: 3, development: 'the door creaks; three knocks on the lid; the spring and the urn tried once each; coins; the likembe picks up' },
    { id: 'thumb', bars: 2, development: 'the likembe alone, then the three knocks' },
    { id: 'wake', bars: 8, development: 'the hook: urn, coffin and spring split the bass line; every second bar drops out for the knocks; friction drum and brake drum join' },
    { id: 'break', bars: 2, development: 'drums alone: urn, beads, coins, rim, scrape, the knocks' },
    { id: 'odile', bars: 4, development: 'the floor: the friction drum talks and laughs over likembe, spring and urn' },
    { id: 'stairs', bars: 7, development: 'half time, one step of seven higher every bar, home an octave up' },
    { id: 'knock', bars: 2, development: 'two stabs, silence, three knocks from inside the coffin, the door' },
    { id: 'shout', bars: 8, development: 'the hook hot; every knock bar ends with a knock from inside' },
    { id: 'out', bars: 2, development: 'the last hit, the spring as a laser, the coins spill, one knock from inside, the door' },
  ],
  // the preparation room: small, tiled, bright
  room: { rt60: 1.05, size: 0.55, damp: 8500, predelayMs: 6, lowCut: 260 },
  parts: [
    { id: 'urn', instrument: 'organic-percussion/pot', gainDb: -1, room: 0.06, macro: stepCurve([[0, 0.2], [ST, 0.32], [KN, 0.2], [SH, 0.55], [OUT, 0.7]]),
      controls: { air: 0.25 }, setup: { seed: 11 }, humanize: { timingMs: 4, velocity: 0.05 }, notes: urn },
    { id: 'coffin', instrument: 'organic-percussion/log', gainDb: -7, pan: -0.12, room: 0.12, macro: stepCurve([[0, 0.12], [ST, 0.3], [KN, 0.15], [SH, 0.62], [OUT, 0.85]]),
      controls: { hard: 0.78 }, setup: { seed: 13, spread: 0.3 }, humanize: { timingMs: 4, velocity: 0.06 }, notes: coffin },
    { id: 'inside', instrument: 'organic-percussion/log', gainDb: -9, pan: 0.05, room: 0.03, macro: 0.55, controls: { hard: 0.25, pos: -0.3, damp: 1.4 },
      setup: { seed: 1972 }, notes: inside },
    { id: 'spring', instrument: 'mechanical-orchestra/spring', gainDb: -2, pan: 0.06, room: 0.08,
      macro: stepCurve([[0, 0], [OD, 0.04], [ST, 0.22], [KN, 0.05], [SH, 0.62], [OUT, 0.9]]),
      controls: { bend: stepCurve([[0, 0.2], [ST, 0.16], [SH, 0.26]]), decay: stepCurve([[0, 1.3], [ST, 1.8], [SH, 1.1], [OUT, 3.5]]) },
      setup: { seed: 29 }, humanize: { timingMs: 5, velocity: 0.05 }, notes: spring },
    { id: 'likembe', instrument: 'mechanical-orchestra/tine', gainDb: -5, pan: 0.22, room: 0.14,
      macro: stepCurve([[0, 0.5], [ST, 0.6], [KN, 0.55], [SH, 0.82], [OUT, 0.9]]), controls: { buzz: stepCurve([[0, 0.68], [ST, 0.78], [KN, 0.7], [SH, 1]]), detune: -6 },
      setup: { spread: 0.45, seed: 31 }, humanize: { timingMs: 4, velocity: 0.08 }, notes: likembe },
    { id: 'odile', instrument: 'organic-percussion/skin', gainDb: -3, pan: -0.28, room: 0.16, macro: stepCurve([[0, 0.15], [SH, 0.45]]),
      controls: { damp: 0.9 }, setup: { seed: 1944 }, humanize: { timingMs: 6, velocity: 0.05 }, notes: cuica },
    { id: 'beads', instrument: 'organic-percussion/skin', gainDb: 0, pan: 0.1, room: 0.12, macro: stepCurve([[0, 0.2], [SH, 0.42]]),
      controls: { buzz: 1, glide: 1.5 }, setup: { seed: 17 }, humanize: { timingMs: 5, velocity: 0.06 }, notes: beads },
    { id: 'coins', instrument: 'mechanical-orchestra/bearings', gainDb: -13, pan: -0.2, room: 0.1, macro: 0.25, setup: { spread: 0.6, seed: 2 },
      humanize: { timingMs: 4, velocity: 0.12 }, notes: coins,
      textures: [{ fromBeat: OUT + 1, toBeat: OUT + 5, density: [[OUT + 1, 28], [OUT + 5, 2]], pitches: COIN_P, beats: 0.2, velocity: [0.2, 0.7], seed: 5 }] },
    { id: 'brake', instrument: 'mechanical-orchestra/bar', gainDb: -7, pan: 0.32, room: 0.1, macro: 0.52, controls: { hardness: 1.1, damp: 0.32 },
      setup: { spread: 0.2, seed: 41 }, humanize: { timingMs: 3, velocity: 0.07 }, notes: brake },
    { id: 'door', instrument: 'mechanical-orchestra/bow', gainDb: 4, pan: -0.4, room: 0.25, macro: 0.95, controls: { chatter: 0.6 }, setup: { seed: 3 }, notes: door },
  ],
};

const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, 'the-deacon-is-dead.score.json'), JSON.stringify(score, null, 1) + '\n');
console.log(`wrote the-deacon-is-dead.score.json: ${score.parts.length} parts, ${score.parts.reduce((a, p) => a + p.notes.length, 0)} notes, ${END / 4} bars at ${score.bpm} BPM`);
