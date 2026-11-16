/**
 * Groove library: two-bar kick / snare / hat / bass patterns. None is four-on-the-floor. Every one is built on the
 * same idea: the kick and the bass are one instrument (they hit together for weight or the bass answers in the
 * kick's holes), the snare is left alone, and ghost notes set up the accents.
 * Grids are one string per bar (16 steps, or 12 for triplet feels): x accent, o normal, - ghost, . rest.
 * Bass lines are [beat, beats, semitones above the tonic, velocity, options] in a minor-ish scale (0 3 5 7 10, -2).
 */
import type { Opts } from './core.ts';

export type Hit = [number, number, string?];
export type Tone = [number, number, number, number, Opts?];
export interface PercLine { patch: string; octave: number; notes: Tone[] }
export interface Groove {
  id: string; feel: string; where: string; bpm: number; swing: number;
  kick: Hit[]; snare: Hit[];
  /** hat: [beat, beats, semitones above the tonic (octave 6), velocity, {articulation}] for the clock */
  hat: Tone[];
  /** optional pitched percussion on another patch (part `perc`), and a second layer (part `perc2`); the `perc` token plays both */
  perc?: PercLine; perc2?: PercLine;
  bass: Tone[]; bassPatch: string;
}

const KICK: Record<string, Hit> = { x: [0, 1], o: [0, 0.8], '-': [0, 0.55] };
const SNARE: Record<string, Hit> = { x: [0, 0.92, 'snare'], o: [0, 0.75, 'snare'], '-': [0, 0.42, 'ghost'], c: [0, 0.85, 'clap'] };
const HAT: Record<string, [number, number, string]> = { X: [0, 0.85, 'tock'], x: [7, 0.6, 'tick'], o: [3, 0.5, 'tick'], '-': [7, 0.32, 'tick'] };
function grid<T>(pattern: string, map: Record<string, T>, make: (beat: number, v: T) => unknown): unknown[] {
  const out: unknown[] = [];
  pattern.split('|').forEach((bar, b) => [...bar].forEach((ch, i) => { const v = map[ch]; if (v !== undefined) out.push(make(b * 4 + (i * 4) / bar.length, v)); }));
  return out;
}
const r = (x: number) => Math.round(x * 1000) / 1000;
const kick = (p: string) => grid(p, KICK, (b, v) => [r(b), v[1]]) as Hit[];
const snare = (p: string) => grid(p, SNARE, (b, v) => [r(b), v[1], v[2]]) as Hit[];
const hat = (p: string) => grid(p, HAT, (b, v) => [r(b), 0.1, v[0], v[1], { articulation: v[2] }]) as Tone[];
const late = (hits: Hit[], by: number) => hits.map(h => [r(h[0] + by), h[1], h[2]] as Hit);
/** Hand percussion written as a grid: each character is [semitones above the low drum, velocity, articulation]. */
const hands = (p: string, map: Record<string, [number, number, string]>, beats = 0.4) => grid(p, map, (b, v) => [r(b), beats, v[0], v[1], { articulation: v[2] }]) as Tone[];
const SKIN: Record<string, [number, number, string]> = { B: [0, 0.95, 'bass'], b: [0, 0.75, 'bass'], o: [7, 0.72, 'open'], l: [5, 0.7, 'open'], h: [12, 0.75, 'open'], S: [12, 0.92, 'slap'], s: [7, 0.8, 'slap'], t: [7, 0.4, 'tap'], '-': [12, 0.32, 'tap'], m: [7, 0.55, 'mute'] };
const LOG: Record<string, [number, number, string]> = { K: [7, 0.7, 'knuckle'], k: [0, 0.6, 'knuckle'], s: [3, 0.7, 'strike'], S: [10, 0.75, 'strike'], r: [0, 0.45, 'rim'], '-': [7, 0.3, 'rim'] };
const POT: Record<string, [number, number, string]> = { W: [0, 0.85, 'whoop'], w: [7, 0.65, 'whoop'], D: [5, 0.8, 'drop'], d: [3, 0.75, 'drop'], P: [0, 0.8, 'palm'], t: [7, 0.45, 'tap'], '-': [12, 0.35, 'tap'] };
const A: Opts = { articulation: 'accent' }, GH: Opts = { articulation: 'ghost' }, ST: Opts = { articulation: 'staccato' };

export const GROOVES: Groove[] = [
  { id: 'limp', bpm: 92, swing: 0.6, bassPatch: 'rubber-swagger',
    feel: 'Head-nod with a limp: bar 2 has no kick on one, it arrives an eighth late and the bass has been holding its breath for it.',
    where: 'Mid-tempo swagger. The default home for a bass-owned hook.',
    kick: kick('x.........o..o..|..x.......x....o'), snare: snare('....x.......x..-|....x..-....x...'), hat: hat('X.-.x.-.X.-.x.--|X.-.x.-.X.-.x.-.'),
    bass: [[0, 1.25, 0, 0.95, { ...A, scoop: 2 }], [1.5, 0.25, 0, 0.5, GH], [2.5, 0.5, 0, 0.8], [3.25, 0.5, 3, 0.75], [3.75, 0.75, -2, 0.8, { slide: 0.1 }],
      [4.5, 1, 0, 0.9, A], [5.75, 0.25, 0, 0.45, GH], [6.5, 0.5, 5, 0.8], [7, 0.5, 3, 0.7, ST], [7.5, 0.5, -2, 0.75, { slide: 0.08 }]] },
  { id: 'lean-back', bpm: 80, swing: 0.56, bassPatch: 'sub-whale',
    feel: 'Half-time lean: one snare per bar on three, kicks pushed just ahead of where you expect, long bass under everything.',
    where: 'Heavy, slow, wide. Verses with space for a voice; the calm before something rude.',
    kick: kick('x..o......o.....|x.....o...o..o..'), snare: snare('........x......-|........x.....-.'), hat: hat('X.x.x.x-X.x.x.x.|X.x.x.x-X.x.x-x-'),
    bass: [[0, 1.75, 0, 0.95, { ...A, scoop: 3 }], [2.5, 1, 0, 0.8], [3.5, 0.5, -2, 0.7, { slide: 0.1 }],
      [4, 1.25, 0, 0.9, A], [5.5, 0.5, 3, 0.75], [6.5, 0.5, 5, 0.8], [7.25, 0.5, 3, 0.55, GH]] },
  { id: 'skip-two', bpm: 130, swing: 0.56, bassPatch: 'hollow-knock',
    feel: 'Two-step skip: kick on one and the and-of-three, shuffled hats with holes, the bass never lands on a downbeat.',
    where: 'Fast and light on its feet. Hooks in a high instrument; bass as percussion.',
    kick: kick('x.........x.....|x......o..x.....'), snare: snare('....x.......x...|....x.......x.-.'), hat: hat('..x.-.x...x.-.x-|..x.-.x-..x.-.x.'),
    bass: [[0.75, 0.5, 0, 0.85], [1.5, 0.25, 0, 0.5, GH], [1.75, 0.5, 0, 0.8], [2.75, 0.75, 3, 0.85, { slide: 0.08 }], [3.5, 0.5, -2, 0.75],
      [4.75, 0.5, 0, 0.85], [5.75, 0.5, 7, 0.8, ST], [6.5, 0.75, 5, 0.85, A], [7.5, 0.5, 3, 0.75, { slide: 0.06 }]] },
  { id: 'tresillo-clank', bpm: 102, swing: 0.5, bassPatch: 'ratchet-servo',
    feel: 'Kick and bass on 3+3+2, one fat snare on three, hats filling every hole the kick leaves, a metal clank answering off the grid.',
    where: 'Rolling, bodily, a little menacing. Carries call-and-answer well because the bar has three clear landing spots.',
    kick: kick('x.....x.....x...|x.....x.....x.o.'), snare: snare('....-...x......-|....-...x...-..x'), hat: hat('.-x-x-.-x-x-.-x-|.-x-x-.-x-x-.-xx'),
    perc: { patch: 'dead-marimba', octave: 5, notes: [[0.75, 0.3, 7, 0.6], [2.25, 0.3, 10, 0.55], [4.75, 0.3, 7, 0.6], [6.25, 0.3, 12, 0.6], [6.75, 0.3, 10, 0.45]] },
    bass: [[0, 1, 0, 0.95, A], [1.5, 0.75, 0, 0.85], [2.5, 0.25, 0, 0.5, GH], [3, 0.75, -2, 0.85],
      [4, 1, 0, 0.9, A], [5.5, 0.75, 3, 0.85], [6.5, 0.25, 3, 0.5, GH], [7, 0.5, 5, 0.85, ST], [7.5, 0.5, 7, 0.8, ST]] },
  { id: 'drunk-clock', bpm: 88, swing: 0.66, bassPatch: 'rubber-swagger',
    feel: 'Hard-swung hats, snare dragged late, the second kick rushed early: nothing sits on the grid and it still walks.',
    where: 'Loose, human, slightly wrong. Put the cleanest, most mechanical hook on top of it.',
    kick: [[0, 1], [2.44, 0.85], [3.5, 0.6], [4, 1], [5.44, 0.7], [6.44, 0.85]],
    snare: [...late(snare('....x.......x...|....x.......x...'), 0.07), [7.8, 0.4, 'ghost']], hat: hat('X-x-x-x-X-x-x-x-|X-x-x-x-X-x-x-xx'),
    bass: [[0, 1, 0, 0.9, { ...A, scoop: 2 }], [1.25, 0.25, 0, 0.5, GH], [2.44, 0.8, 0, 0.8], [3.5, 0.5, 3, 0.75, { slide: 0.1 }],
      [4, 1.25, 5, 0.85, A], [5.44, 0.5, 3, 0.75], [6.44, 0.75, 0, 0.85], [7.5, 0.5, -2, 0.7, { slide: 0.1 }]] },
  { id: 'stutter-step', bpm: 106, swing: 0.54, bassPatch: 'hollow-knock',
    feel: 'Double-hit kick, and the first backbeat comes an eighth late (on the and-of-two) so every bar trips and catches itself.',
    where: 'Jerky, funny, robotic. Short stabby hooks; anything displaced sounds intentional here.',
    kick: kick('xo......x.o.....|xo....o...x..o..'), snare: snare('......x.....x...|......x.....x.-x'), hat: hat('X...x.-.X...x.-.|X...x.-.X...x.xx'),
    bass: [[0, 0.25, 0, 0.9, ST], [0.25, 0.75, 0, 0.85], [2, 0.5, 0, 0.85], [2.5, 0.5, 3, 0.8], [3.5, 0.5, -2, 0.7, { slide: 0.08 }],
      [4, 0.25, 0, 0.9, ST], [4.25, 0.75, 0, 0.85], [5.5, 0.75, 5, 0.8], [6.5, 0.5, 3, 0.85], [7.25, 0.75, 0, 0.8, { ...A, dive: 2, diveBeats: 0.4 }]] },
  { id: 'five-wheel', bpm: 116, swing: 0.5, bassPatch: 'gear-chopper',
    feel: 'A five-sixteenth tick cycle rolls across a plain backbeat, re-phasing every bar; bass in 3+3+2 under it.',
    where: 'Machine slightly out of phase with itself. Good bed for a simple, slow hook: the rhythm is already complicated.',
    kick: kick('x.....o...x.....|x.....o...x...o.'), snare: snare('....x.......x...|....x.......x..-'), hat: hat('..x...x...x...x.|..x...x...x...x.'),
    perc: { patch: 'sitar-tine', octave: 6, notes: [0, 5, 10, 15, 20, 25, 30].map((s, i) => [s / 4, 0.2, i % 2 ? 7 : 0, i % 3 === 0 ? 0.6 : 0.42] as Tone) },
    bass: [[0, 0.75, 0, 0.9, A], [1.5, 0.75, 0, 0.8], [3, 0.5, 3, 0.8], [3.5, 0.5, 5, 0.75, ST],
      [4, 0.75, 0, 0.9, A], [5.5, 0.75, -2, 0.8], [7, 0.5, 3, 0.8], [7.5, 0.5, -2, 0.75, { slide: 0.08 }]] },
  { id: 'ghost-train', bpm: 96, swing: 0.58, bassPatch: 'rubber-swagger',
    feel: 'A drummer who cannot stop talking: snare ghosts between every backbeat, bass ghosts interlocked with them.',
    where: 'Busy, funky, alive. Needs a sparse hook; pair with long notes or a voice.',
    kick: kick('x..o......x..o..|x.....o..ox.....'), snare: snare('.-..x.-..-.-x.-.|.-..x..-.-..x.--'), hat: hat('X.x.X.x.X.x.X.x.|X.x.X.x.X.x.X.x.'),
    bass: [[0, 0.5, 0, 0.9, A], [0.75, 0.25, 0, 0.8], [1.5, 0.25, 0, 0.45, GH], [2.5, 0.5, 0, 0.85], [3.25, 0.5, 3, 0.8], [3.75, 0.25, 5, 0.5, GH],
      [4, 0.75, 7, 0.9, A], [5.5, 0.5, 5, 0.8], [6.25, 0.25, 3, 0.75], [6.5, 0.75, 0, 0.85, { slide: 0.06 }], [7.5, 0.25, 0, 0.45, GH], [7.75, 0.25, -2, 0.5, GH]] },
  { id: 'half-stomp', bpm: 144, swing: 0.5, bassPatch: 'sub-whale',
    feel: 'Fast clock, slow body: snare only on three, kicks in lopsided pairs, a hat roll into the turn, bass sliding like an 808.',
    where: 'Weight and menace at a high tempo. Leave the middle of the bar empty and let the slides do the talking.',
    kick: kick('x.....x.......o.|x..x......o.....'), snare: snare('........x.......|........x.....-x'),
    hat: [...hat('X.x.x.x.X.x.x.x.|X.x.x.x.X.x.....'), ...[7, 7.125, 7.25, 7.375, 7.5, 7.625, 7.75, 7.875].map((b, i) => [b, 0.08, 7, 0.3 + 0.05 * i, { articulation: 'tick' }] as Tone)],
    bass: [[0, 1.5, 0, 0.95, { ...A, scoop: 2 }], [1.5, 1.75, 0, 0.85], [3.5, 0.5, 3, 0.75, { slide: 0.2 }],
      [4, 0.75, 0, 0.95, A], [4.75, 1.5, -2, 0.85], [6.5, 1.5, 5, 0.85, { slide: 0.25 }]] },
  { id: 'one-drop', bpm: 84, swing: 0.58, bassPatch: 'rubber-swagger',
    feel: 'Nothing on one. Kick and snare fall together on three, hats skank the off-beats, and the bass sings the bar in.',
    where: 'The bass is the lead here: give it the hook. Feels like falling forward into every bar.',
    kick: kick('........x.......|........x.....o.'), snare: snare('....-...x...-...|....-...x..-..-.'), hat: hat('..x...x...x...x.|..x...x...x..xx.'),
    bass: [[0, 0.75, 0, 0.9], [0.75, 0.25, 0, 0.5, GH], [1, 0.5, 3, 0.8], [1.5, 0.5, 5, 0.8], [2.5, 1, 7, 0.85, { slide: 0.08 }], [3.5, 0.5, 5, 0.7, ST],
      [4, 0.75, 3, 0.85], [5, 0.5, 0, 0.8], [5.5, 0.5, -2, 0.75], [6.5, 1, 0, 0.85, { slide: 0.1 }], [7.75, 0.25, 0, 0.45, GH]] },
  { id: 'gallop-hole', bpm: 122, swing: 0.5, bassPatch: 'chrome-grinder',
    feel: 'Galloping kick triplets-in-sixteenths, then half of bar 2 simply missing: one bass slide falls through the hole alone.',
    where: 'Aggressive with a built-in gasp. The hole is where an answer or a cry goes.',
    kick: kick('x.xo....x.xo....|x.xo..........o.'), snare: snare('....x.......x...|....x...........'), hat: hat('..x...x...x...x.|..x...x.........'),
    bass: [[0, 0.5, 0, 0.9, A], [0.5, 0.25, 0, 0.75, ST], [0.75, 0.25, 0, 0.7, ST], [2, 0.5, 0, 0.85], [2.5, 0.25, 3, 0.75, ST], [2.75, 0.25, 3, 0.7, ST],
      [4, 0.5, 0, 0.9, A], [4.5, 0.25, 0, 0.75, ST], [4.75, 0.25, 0, 0.7, ST], [6, 1.5, 5, 0.9, { ...A, dive: 5, diveBeats: 1 }], [7.5, 0.5, -2, 0.8]] },
  { id: 'swamp-shuffle', bpm: 72, swing: 0.5, bassPatch: 'tube-fuzz',
    feel: 'Slow triplet shuffle (12 to the bar): kick pickups on the last triplet, backbeat snare, bass dragging its feet between them.',
    where: 'Thick, humid, bluesy without quoting the blues. Fuzz bass or a low voice owns it.',
    kick: kick('x....ox.....|x.....x.o..o'), snare: snare('...x.....x.-|...x.-...x..'), hat: hat('X-xX-xX-xX-x|X-xX-xX-xX-x'),
    bass: [[0, 0.667, 0, 0.9, { ...A, scoop: 2 }], [0.667, 0.333, 0, 0.5, GH], [1.667, 0.333, -2, 0.7], [2, 1, 0, 0.85], [3.333, 0.333, 3, 0.7], [3.667, 0.333, 5, 0.75],
      [4, 1, 7, 0.9, A], [5.667, 0.333, 5, 0.7], [6, 0.667, 3, 0.85], [6.667, 0.333, 0, 0.6], [7, 0.667, -2, 0.8, { slide: 0.1 }], [7.667, 0.333, -2, 0.5, GH]] },
  // ---------------------------------------------------------------- hand grooves (Timbre Lab organic percussion)
  { id: 'hand-procession', bpm: 88, swing: 0.54, bassPatch: 'sub-whale',
    feel: 'A procession on hands: palm booms on a slow 3+3+2, one cracking slap on three, finger taps talking in between, and a log knocking a three-sixteenth wheel across it. No snare drum at all.',
    where: 'Ceremonial, wide, heavy without machines. Long notes and slow hooks sit on it like banners; raise the heat and the drums turn cavernous.',
    kick: kick('x.....o.........|x.....o...o.....'), snare: [], hat: hat('..x...x...x...x.|..x...x...x..-x.'),
    perc: { patch: 'talking-skin', octave: 2, notes: hands('B..tt.b.S..to.l.|B..t..b.S.otSol.', SKIN) },
    perc2: { patch: 'log-tongue', octave: 3, notes: hands('..k..K..s..k..K.|.s..k..K..S..k.K', LOG, 0.3) },
    bass: [[0, 1.4, 0, 0.95, { ...A, scoop: 2 }], [1.5, 1.9, 0, 0.85], [3.5, 0.5, -2, 0.7, { slide: 0.12 }],
      [4, 1.4, 0, 0.9, A], [5.5, 0.9, 3, 0.8], [6.5, 1.3, 5, 0.85, { slide: 0.15 }]] },
  { id: 'clay-skip', bpm: 126, swing: 0.56, bassPatch: 'hollow-knock',
    feel: 'Quick and barefoot: a clay pot whoops in the holes the kick leaves, a wooden rim chatters where a hi-hat would be, a light backbeat, and the bass knocks rather than sings.',
    where: 'Fast, small, bright-eyed. A short clean hook in a high instrument; nothing heavy belongs here until the last section.',
    kick: kick('x.....o...x.....|x..o......x...o.'), snare: snare('....o.......o...|....o.......o.-.'), hat: hat('..x.....-.x.....|..x.....-.x...x.'),
    perc: { patch: 'clay-whoop', octave: 3, notes: hands('...W..t..t..D..w|...W..t.t..-.d..', POT) },
    perc2: { patch: 'log-tongue', octave: 4, notes: hands('r.rK.r.rr.K.r.rK|r.rK.r.rr.K.rKrK', LOG, 0.2) },
    bass: [[0.75, 0.5, 0, 0.85], [1.5, 0.25, 0, 0.5, GH], [2.5, 0.5, 3, 0.8], [3.5, 0.5, -2, 0.75],
      [4, 0.5, 0, 0.9, A], [4.75, 0.5, 0, 0.8], [5.75, 0.5, 7, 0.8, ST], [6.5, 0.75, 5, 0.85, A], [7.5, 0.5, 3, 0.75, { slide: 0.06 }]] },
  { id: 'twelve-hands', bpm: 96, swing: 0.5, bassPatch: 'sub-whale',
    feel: 'Twelve to the bar on hands: a wooden bell line (2+2+1+2+2+2+1) that never agrees with the palm, a slap on four, and the low drum answering itself late. It sways in three and walks in four at once.',
    where: 'Night, fire, patience. The bed for a breath or a low voice; its triplet is the hinge for a switch into a straight groove at 144 (three of these = two of those).',
    kick: kick('x.......o...|x.....x..o..'), snare: [], hat: [],
    perc: { patch: 'talking-skin', octave: 2, notes: hands('B.to.tb.oSto|B.to.tB.oS.l', SKIN) },
    perc2: { patch: 'log-tongue', octave: 4, notes: hands('K.r.rK.r.r.K|K.r.rK.r.r.r', LOG, 0.2) },
    bass: [[0, 2.3, 0, 0.9, { ...A, scoop: 2 }], [2.667, 1, -2, 0.75, { slide: 0.15 }],
      [4, 1.667, 0, 0.9, A], [6, 0.9, 3, 0.8], [7, 0.9, 5, 0.8, { slide: 0.12 }]] },
];
export function groove(id: string): Groove {
  const g = GROOVES.find(x => x.id === id);
  if (!g) throw new Error(`unknown groove "${id}" (have: ${GROOVES.map(x => x.id).join(', ')})`);
  return g;
}
