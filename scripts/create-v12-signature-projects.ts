/** Author the V12 SIGNATURE instrument audition and the signature showcase. Audio always renders through DaemonV12.
 * Run: node scripts/create-v12-signature-projects.ts [pack directory]   (default packs/v12-signature-v1)
 * Every pitch is a playbackRate relative to the source root, every hold is a gate plus an output-time envelope.
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULT_OUTPUT, fileName, PACK, rate, sounds, type SoundId } from './generate-v12-signature.ts';

const KIT = `${PACK.directory}/kit.json`;
const sample = (id: SoundId) => `${PACK.directory}/${fileName(sounds.findIndex(s => s.id === id))}`;
const root = (id: SoundId) => sounds.find(s => s.id === id)!.root!;
const MIDI: Record<string, number> = {};
['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((n, k) => { for (let o = 0; o < 8; o++) MIDI[`${n}${o}`] = 12 * (o + 1) + k; });
/** playbackRate that plays `note` on sound `id` (six decimals; omitted at the root). */
const at = (id: SoundId, note: string) => rate(MIDI[note]! - root(id));
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
const fraction = (n: number, d: number) => { const g = gcd(n, d); return `${n / g}/${d / g}`; };
/** Canonical position from bar and 1/64-note units inside the bar (4/4). */
const pos = (bar: number, u64 = 0) => { const beat = Math.floor(u64 / 16), rem = u64 % 16; return `${bar}:${beat + 1}${rem ? `+${fraction(rem, 64)}` : ''}`; };
const S16 = 4, S8 = 8, BEAT = 16, BAR = 64; // 1/64 units
const v = (x: number) => Number(Math.min(1, x).toFixed(3));

type Note = Record<string, unknown>;
interface Track { id: string; description: string; instrument: object; mix?: object; effects?: object[]; automation?: object; notes: Note[] }
/** One long pattern per track: absolute bar positions are the clearest score for an agent to read and patch. */
const track = (id: string, description: string, instrument: object, extra: Partial<Track> = {}): Track => ({ id, description, instrument, notes: [], ...extra });
function note(t: Track, bar: number, u64: number, fields: Note) { t.notes.push({ start: pos(bar, u64), ...fields }); }
const envelope = (attackSeconds: number, releaseSeconds: number) => ({ attackSeconds, releaseSeconds });
const tonal = (id: SoundId, n: string, velocity: number, gate: string | null, env: { attackSeconds: number; releaseSeconds: number } | null, more: Note = {}): Note => {
  const r = at(id, n);
  return { velocity: v(velocity), ...(r !== 1 ? { playbackRate: r } : {}), ...(gate ? { gate } : {}), ...(env ? { envelope: env } : {}), ...more };
};
function finish(project: object, tracks: Track[], bars: number) {
  return { ...project, tracks: tracks.map(({ notes, ...t }) => ({ ...t, clips: [{ bar: 1, pattern: 'score' }], patterns: [{ id: 'score', bars, notes }] })) };
}

// ---------------- Instrument audition: dry, Node-only, 120 BPM so every bar is exactly two seconds ----------------
export function audition() {
  const drums = track('kit', 'All seven percussion sounds through the pack kit (kit pitches 35–53), one bar each in catalog order.', { type: 'drumkit', kit: KIT });
  const hit = (bar: number, u64: number, pitch: SoundId, velocity: number, more: Note = {}) => note(drums, bar, u64, { pitch, velocity: v(velocity), ...more });
  // 01 SUB HAMMER: a tight pair, then the full tail.
  hit(1, 0, 'sub-hammer', 0.95, { gate: '1/8', envelope: envelope(0.001, 0.04) }); hit(1, BEAT + S8, 'sub-hammer', 0.8, { gate: '1/8', envelope: envelope(0.001, 0.04) }); hit(1, 2 * BEAT, 'sub-hammer', 1);
  // 02 IRON PULSE: four on the floor with a harder fourth hit.
  for (let b = 0; b < 4; b++) hit(2, b * BEAT, 'iron-pulse', [0.95, 0.8, 0.88, 1][b]!);
  // 03 TITANIUM CRACK: backbeats and a short roll.
  hit(3, BEAT, 'titanium-crack', 0.9); hit(3, 3 * BEAT, 'titanium-crack', 0.95);
  for (let k = 0; k < 4; k++) hit(3, 2 * BEAT + k * S16, 'titanium-crack', 0.3 + 0.12 * k, { gate: '1/32', envelope: envelope(0.001, 0.015), chokeGroup: 'snare' });
  // 04 NEON CLAP: backbeats, then the clap a whole tone down.
  hit(4, BEAT, 'neon-clap', 0.9); hit(4, 3 * BEAT, 'neon-clap', 0.95, { playbackRate: rate(-2) });
  // 05 GHOST TICK: sixteenths with accents.
  for (let k = 0; k < 16; k++) hit(5, k * S16, 'ghost-tick', [0.75, 0.32, 0.5, 0.35][k % 4]!, { chokeGroup: 'hats' });
  // 06 OPEN CIRCUIT: gated off-beats, then one full ring that ends with the bar.
  for (let b = 0; b < 2; b++) hit(6, b * BEAT + S8, 'open-circuit', 0.75, { gate: '1/8', envelope: envelope(0.001, 0.06), chokeGroup: 'hats' });
  hit(6, 2 * BEAT, 'open-circuit', 0.85);
  // 14 CHROME STRIKE (bars 22–23): a tuned bell figure on A4, C5, E5, then A4 ringing out through bar 23.
  [['A4', 0, 0.8], ['C5', S8 + S16, 0.6], ['E5', BEAT + S8, 0.65]].forEach(([n, u, vel]) =>
    hit(22, u as number, 'chrome-strike', vel as number, { ...(at('chrome-strike', n as string) !== 1 ? { playbackRate: at('chrome-strike', n as string) } : {}), gate: '1/8', envelope: envelope(0.001, 0.25) }));
  hit(22, 2 * BEAT, 'chrome-strike', 0.85);

  const abyss = track('abyss', '07 ABYSS: one held A1 bar, then G1 and E1 halves (2 bars).', { type: 'sampler', sample: sample('abyss') });
  note(abyss, 7, 0, tonal('abyss', 'A1', 0.9, '1/1', envelope(0.004, 0.12)));
  note(abyss, 8, 0, tonal('abyss', 'G1', 0.85, '1/2', envelope(0.004, 0.08)));
  note(abyss, 8, 2 * BEAT, tonal('abyss', 'E1', 0.9, '7/16', envelope(0.004, 0.2)));
  const reactor = track('reactor', '08 REACTOR: rolling sixteenths on A1, then a held F1 to A1 (2 bars).', { type: 'sampler', sample: sample('reactor') });
  for (let k = 0; k < 16; k++) if (k % 4) note(reactor, 9, k * S16, tonal('reactor', k >= 12 ? 'C2' : 'A1', [0, 0.85, 0.7, 0.78][k % 4]!, '1/16', envelope(0.002, 0.03)));
  note(reactor, 10, 0, tonal('reactor', 'F1', 0.85, '1/2', envelope(0.003, 0.08)));
  note(reactor, 10, 2 * BEAT, tonal('reactor', 'A1', 0.9, '7/16', envelope(0.003, 0.2)));
  const signal = track('signal', '09 SIGNAL: the hypnotic three-note cell, then held E5 and A4 (2 bars).', { type: 'sampler', sample: sample('signal') });
  const cell = ['A4', 'E5', 'C5'];
  for (let k = 0; k < 16; k++) note(signal, 11, k * S16, tonal('signal', cell[k % 3]!, k % 3 === 0 ? 0.8 : 0.58, '1/16', envelope(0.001, 0.04)));
  note(signal, 12, 0, tonal('signal', 'E5', 0.8, '1/2', envelope(0.001, 0.15)));
  note(signal, 12, 2 * BEAT, tonal('signal', 'A4', 0.8, '7/16', envelope(0.001, 0.3)));
  const phantom = track('phantom', '10 PHANTOM: the hook phrase, then a held A5 that blooms into vibrato (2 bars).', { type: 'sampler', sample: sample('phantom') });
  [['E5', 0, '3/8'], ['A5', 6 * S16, '3/8'], ['G5', 3 * BEAT, '1/4']].forEach(([n, u, g]) => note(phantom, 13, u as number, tonal('phantom', n as string, 0.85, g as string, envelope(0.005, 0.12))));
  note(phantom, 14, 0, tonal('phantom', 'A5', 0.9, '7/8', envelope(0.005, 0.3)));
  const horizon = track('event-horizon', '11 EVENT HORIZON: the open-fifth pad swelling on A2 for three bars.', { type: 'sampler', sample: sample('event-horizon') });
  note(horizon, 15, 0, tonal('event-horizon', 'A2', 0.9, '11/4', envelope(0, 0.6)));
  const afterglow = track('afterglow', '12 AFTERGLOW: A minor then F major, four stacked notes each (2 bars).', { type: 'sampler', sample: sample('afterglow') });
  for (const n of ['E3', 'A3', 'C4', 'E4']) note(afterglow, 18, 0, tonal('afterglow', n, 0.6, '1/1', envelope(0.02, 0.3)));
  for (const n of ['F3', 'A3', 'C4', 'F4']) note(afterglow, 19, 0, tonal('afterglow', n, 0.6, '7/8', envelope(0.02, 0.45)));
  const specter = track('specter', '13 SPECTER: the choir vowel held on A3 through oo, oh and ah (2 bars).', { type: 'sampler', sample: sample('specter') });
  note(specter, 20, 0, tonal('specter', 'A3', 0.9, '15/8', envelope(0.05, 0.25)));
  const ascension = track('ascension', '15 ASCENSION: the full six-second riser, ending exactly on bar 27.', { type: 'sampler', sample: sample('ascension') });
  note(ascension, 24, 0, { velocity: 0.9 });
  const convergence = track('convergence', '16 CONVERGENCE: the impact on bar 27, with its full tail.', { type: 'sampler', sample: sample('convergence') });
  note(convergence, 27, 0, { velocity: 0.9 });
  return finish({
    formatVersion: 1, title: 'V12 SIGNATURE — Instrument Audition',
    description: 'Dry audition of all sixteen V12 SIGNATURE sounds, in catalog order, at 120 BPM (one bar = 2.000 s). Bars 1–6 percussion, 7–8 ABYSS, 9–10 REACTOR, 11–12 SIGNAL, 13–14 PHANTOM, 15–17 EVENT HORIZON, 18–19 AFTERGLOW, 20–21 SPECTER, 22–23 CHROME STRIKE, 24–26 ASCENSION, 27 CONVERGENCE (57.000 s with its tail). No effects, mix or automation: the Node-only sample route.',
    bpm: 120, timeSignature: '4/4', key: 'A minor', bars: 27, seed: 12,
  }, [drums, abyss, reactor, signal, phantom, horizon, afterglow, specter, ascension, convergence], 27);
}

// ---------------- Signature showcase: IGNITION, 128 BPM, A minor, 14 bars + released tail = 28.000 s ----------------
// 1–2 IGNITION (bell, boom, swelling space)   3–6 ORBIT (rolling bass, arp, foreshadowed hook)   7–8 ASCENSION (E pedal, roll, riser)
// 9–12 CONVERGENCE (the PHANTOM hook over Am F G E, pumping sub)   13–14 AFTERGLOW (the hook resolves to A5, the bell returns)
const PROGRESSION = ['Am', 'F', 'G', 'E'] as const;
type Chord = typeof PROGRESSION[number];
const BASS: Record<Chord, string> = { Am: 'A1', F: 'F1', G: 'G1', E: 'E1' };
const PAD_ROOT: Record<Chord, string> = { Am: 'A2', F: 'F2', G: 'G2', E: 'E2' };
const VOICING: Record<Chord, string[]> = { Am: ['E3', 'A3', 'C4', 'E4'], F: ['F3', 'A3', 'C4', 'F4'], G: ['G3', 'B3', 'D4', 'G4'], E: ['E3', 'G#3', 'B3', 'E4'] };
const CELL: Record<Chord, string[]> = { Am: ['A4', 'E5', 'C5'], F: ['A4', 'F5', 'C5'], G: ['B4', 'G5', 'D5'], E: ['B4', 'E5', 'G#4'] };
// The hook: a 3+3+2 tresillo per bar. Rising fourths (E-A, D-G) answer each other; the E-major climb resolves to A5.
const HOOK: [string, number, string][][] = [
  [['E5', 0, '3/8'], ['A5', 24, '3/8'], ['G5', 48, '1/4']],
  [['F5', 0, '3/8'], ['E5', 24, '3/8'], ['C5', 48, '1/4']],
  [['D5', 0, '3/8'], ['G5', 24, '3/8'], ['F5', 48, '1/4']],
  [['E5', 0, '3/8'], ['G#5', 24, '3/8'], ['B5', 48, '1/4']],
];
interface Point { at: { musical: string }; value: number; transition?: 'linear' }
/** Kick-locked gain pumping: a 1/64 look-ahead dip to `depth` dB on every beat, recovering over a dotted sixteenth. */
function pump(bars: number[], depth: number, base = 0): Point[] {
  const points: Point[] = [];
  for (const bar of bars) for (let b = 0; b < 4; b++) {
    const u = (bar - 1) * BAR + b * BEAT, abs = (x: number) => ({ musical: pos(Math.floor(x / BAR) + 1, x % BAR) });
    points.push({ at: abs(u - 1), value: base, transition: 'linear' }, { at: abs(u), value: base + depth, transition: 'linear' },
      { at: abs(u + S16), value: v(base + depth * 0.45), transition: 'linear' }, { at: abs(u + 3 * S16), value: base, transition: 'linear' });
  }
  return points;
}
export function showcase() {
  const kick = track('kick', 'SUB HAMMER (tight in the groove, longer in the drop) layered with IRON PULSE from bar 9; choke group "kick".', { type: 'drumkit', kit: KIT }, { mix: { gainDb: -4.5 } });
  const snare = track('snare', 'NEON CLAP backbeats, the TITANIUM CRACK build roll, and both stacked in the drop.', { type: 'drumkit', kit: KIT }, { mix: { gainDb: -2 } });
  const hats = track('hats', 'GHOST TICK sixteenths and gated OPEN CIRCUIT off-beats; choke group "hats".', { type: 'drumkit', kit: KIT }, { mix: { gainDb: -1.5, pan: 0.18 } });
  const chrome = track('chrome', 'CHROME STRIKE: the bell that opens, marks each section and closes the piece.', { type: 'drumkit', kit: KIT },
    { mix: { gainDb: -3, pan: -0.1 }, effects: [{ type: 'reverb', roomSize: 0.8, decaySeconds: 3, wet: 0.3 }] });
  const abyss = track('abyss', 'ABYSS: a held A1 opening, rolling sub sixteenths in the groove, held roots pumping under the drop.', { type: 'sampler', sample: sample('abyss') }, { mix: { gainDb: -6.5 } });
  const reactor = track('reactor', 'REACTOR: the rolling growl over ABYSS in the groove, off-beat stabs in the drop; high-passed so ABYSS owns the sub.', { type: 'sampler', sample: sample('reactor') },
    { mix: { gainDb: 0 }, effects: [{ type: 'highpass', frequencyHz: 110 }] });
  const signal = track('signal', 'SIGNAL: the hypnotic three-note cell that runs from bar 2 to the end, with a dotted-eighth echo.', { type: 'sampler', sample: sample('signal') },
    { mix: { gainDb: -9.5, pan: 0.12 }, effects: [{ type: 'delay', timeMs: 351.5625, wet: 0.28 }, { type: 'reverb', roomSize: 0.5, decaySeconds: 1.4, wet: 0.14 }] });
  const phantom = track('phantom', 'PHANTOM: the hook, stated in the drop and resolved to a held A5.', { type: 'sampler', sample: sample('phantom') },
    { mix: { gainDb: -7 }, effects: [{ type: 'delay', timeMs: 234.375, wet: 0.12 }, { type: 'reverb', roomSize: 0.7, decaySeconds: 2.2, wet: 0.22 }] });
  const horizon = track('event-horizon', 'EVENT HORIZON: the open-fifth space under every section, following the roots in the drop.', { type: 'sampler', sample: sample('event-horizon') },
    { mix: { gainDb: -6 }, effects: [{ type: 'highpass', frequencyHz: 70 }] });
  const afterglow = track('afterglow', 'AFTERGLOW: four-note chords from the groove onward, pumping in the drop.', { type: 'sampler', sample: sample('afterglow') },
    { mix: { gainDb: -9 }, effects: [{ type: 'highpass', frequencyHz: 120 }, { type: 'reverb', roomSize: 0.6, decaySeconds: 1.8, wet: 0.16 }] });
  const specter = track('specter', 'SPECTER: the hook foreshadowed an octave down as a ghost choir, the held "ah" of the build, the final chord top.', { type: 'sampler', sample: sample('specter') },
    { mix: { gainDb: -3, pan: -0.08 }, effects: [{ type: 'reverb', roomSize: 0.75, decaySeconds: 2.6, wet: 0.3 }] });
  const ascension = track('ascension', 'ASCENSION: a one-bar lift into the groove and the two-bar build, each ending exactly on its downbeat.', { type: 'sampler', sample: sample('ascension') }, { mix: { gainDb: -6 } });
  const convergence = track('convergence', 'CONVERGENCE: the drop and the final downbeat.', { type: 'sampler', sample: sample('convergence') }, { mix: { gainDb: -6 } });

  const chordOf = (bar: number): Chord => bar >= 9 && bar <= 12 ? PROGRESSION[bar - 9]! : bar === 7 || bar === 8 ? 'E' : bar === 4 || bar === 6 ? 'F' : 'Am';
  const kickHit = (bar: number, u: number, id: SoundId, velocity: number, gate: string | null) =>
    note(kick, bar, u, { pitch: id, velocity: v(velocity), ...(gate ? { gate, envelope: envelope(0.001, 0.04) } : {}), chokeGroup: 'kick' });

  // IGNITION (bars 1–2): one boom, the bell, a held sub and the opening space; the cell enters in bar 2.
  kickHit(1, 0, 'sub-hammer', 0.85, null);
  note(chrome, 1, 0, { pitch: 'chrome-strike', velocity: 0.85 });
  note(chrome, 1, 0, { pitch: 'chrome-strike', velocity: 0.5, playbackRate: 0.5 });
  note(abyss, 1, 0, tonal('abyss', 'A1', 0.7, '7/4', envelope(0.004, 0.6)));
  note(horizon, 1, 0, tonal('event-horizon', 'A2', 0.9, '4/1', envelope(0, 0.8)));
  note(ascension, 2, 0, { velocity: 0.55, offsetSeconds: 6 - 1.875 }); // the last bar of the riser lands on bar 3

  // The SIGNAL cell: continuous sixteenths from bar 2, a three-note cycle that drifts across the four-beat bar.
  let step = 0;
  for (let bar = 2; bar <= 12; bar++) for (let k = 0; k < 16; k++, step++) {
    if (bar === 8 && k >= 14) continue; // the breath before the drop
    const n = CELL[chordOf(bar)][step % 3]!, accent = step % 3 === 0;
    const level = bar === 2 ? 0.32 + 0.22 * k / 15 : bar === 8 ? 0.5 + 0.4 * k / 13 : bar >= 9 ? 0.5 : 0.52;
    note(signal, bar, k * S16, tonal('signal', n, level * (accent ? 1.18 : 0.9), '1/16', envelope(0.001, 0.04)));
  }
  // The cell's last word over the final chord: three falling echoes.
  ['A4', 'E5', 'C5'].forEach((n, k) => note(signal, 13, 2 * BEAT + k * S8, tonal('signal', n, 0.45 - 0.08 * k, '1/16', envelope(0.001, 0.08))));

  // ORBIT (bars 3–6) and the first build bar (7): tight kicks, three rolling bass sixteenths after each.
  for (let bar = 3; bar <= 7; bar++) for (let b = 0; b < 4; b++) {
    kickHit(bar, b * BEAT, 'sub-hammer', b % 2 ? 0.88 : 0.97, '1/16');
    for (let s = 1; s < 4; s++) {
      const n = BASS[chordOf(bar)], vel = [0, 0.74, 0.62, 0.68][s]!;
      note(abyss, bar, b * BEAT + s * S16, tonal('abyss', n, vel, '1/16', envelope(0.002, 0.02)));
      if (bar >= 4) note(reactor, bar, b * BEAT + s * S16, tonal('reactor', n, 0.85 * vel, '1/16', envelope(0.002, 0.025)));
    }
  }
  for (let bar = 3; bar <= 7; bar++) for (let k = 0; k < 16; k++) {
    if (bar <= 4 && k % 4 !== 2) continue; // off-beat ticks first, sixteenths from bar 5
    if (bar === 6 && k === 15) continue; // let the bar-6 open hat speak for its full eighth
    note(hats, bar, k * S16, { pitch: 'ghost-tick', velocity: v(bar <= 4 ? 0.45 : [0.34, 0.2, 0.5, 0.24][k % 4]!), chokeGroup: 'hats' });
  }
  for (const bar of [4, 6]) note(hats, bar, 3 * BEAT + S8, { pitch: 'open-circuit', velocity: 0.6, gate: '1/8', envelope: envelope(0.001, 0.08), chokeGroup: 'hats' });
  for (let bar = 5; bar <= 6; bar++) for (const b of [1, 3]) note(snare, bar, b * BEAT, { pitch: 'neon-clap', velocity: 0.7 });
  note(chrome, 3, 0, { pitch: 'chrome-strike', velocity: 0.45 });
  for (const bar of [5, 6]) for (const n of VOICING[chordOf(bar)]) note(afterglow, bar, 0, tonal('afterglow', n, 0.45, bar === 5 ? '1/1' : '7/8', envelope(0.02, 0.45)));
  note(horizon, 5, 0, tonal('event-horizon', 'A2', 0.85, '2/1', envelope(0.3, 0.8), { offsetSeconds: 1.6 }));
  // The ghost of the hook: SPECTER sings phrase A an octave down, from inside its "oh" (offset 1.2 s).
  [[5, 'E3', 0, '1/4'], [5, 'A3', 24, '1/4'], [5, 'G3', 48, '3/16'], [6, 'F3', 0, '1/4'], [6, 'E3', 24, '1/4'], [6, 'C3', 48, '1/4']].forEach(([bar, n, u, g]) =>
    note(specter, bar as number, u as number, tonal('specter', n as string, 0.7, g as string, envelope(0.06, 0.25), { offsetSeconds: 1.2 })));

  // ASCENSION (bars 7–8): E pedal; snare roll; riser; bar 8 pulls kick and sub out so the drop lands in a low-end vacuum.
  note(chrome, 7, 0, { pitch: 'chrome-strike', velocity: 0.55, playbackRate: at('chrome-strike', 'E4') });
  note(horizon, 7, 0, tonal('event-horizon', 'E2', 0.8, '2/1', envelope(0.3, 0.2), { offsetSeconds: 1.6 }));
  for (const n of VOICING.E) note(afterglow, 7, 0, tonal('afterglow', n, 0.5, '15/8', envelope(0.3, 0.1)));
  for (let k = 0; k < 8; k++) note(snare, 7, k * S8, { pitch: 'titanium-crack', velocity: v(0.24 + 0.03 * k), gate: '1/16', envelope: envelope(0.001, 0.02), chokeGroup: 'snare' });
  for (let k = 0; k < 14; k++) note(snare, 8, k * S16, { pitch: 'titanium-crack', velocity: v(0.36 + 0.5 * k / 13), gate: '1/32', envelope: envelope(0.001, 0.015), chokeGroup: 'snare' });
  kickHit(8, 0, 'sub-hammer', 0.9, '1/8');
  note(specter, 8, 0, tonal('specter', 'E3', 0.8, '7/8', envelope(0.3, 0.06), { offsetSeconds: 2.0 }));
  note(ascension, 7, 0, { velocity: 0.9, offsetSeconds: 6 - 3.75 }); // the final two bars of the riser end on bar 9

  // CONVERGENCE (bars 9–12): the drop.
  note(convergence, 9, 0, { velocity: 0.9 });
  note(chrome, 9, 0, { pitch: 'chrome-strike', velocity: 0.7 });
  note(chrome, 11, 0, { pitch: 'chrome-strike', velocity: 0.5, playbackRate: at('chrome-strike', 'G4') });
  for (let bar = 9; bar <= 12; bar++) {
    const chord = chordOf(bar);
    for (let b = 0; b < 4; b++) {
      kickHit(bar, b * BEAT, 'sub-hammer', 0.95, '1/8');
      kickHit(bar, b * BEAT, 'iron-pulse', b % 2 ? 0.72 : 0.82, null);
      note(reactor, bar, b * BEAT + S8, tonal('reactor', BASS[chord], b === 3 ? 1 : 0.9, '1/16', envelope(0.002, 0.04)));
      note(hats, bar, b * BEAT + S8, { pitch: 'open-circuit', velocity: 0.62, gate: '1/8', envelope: envelope(0.001, 0.06), chokeGroup: 'hats' });
      for (const s of [1, 3]) note(hats, bar, b * BEAT + s * S16, { pitch: 'ghost-tick', velocity: v(s === 3 ? 0.42 : 0.3) }); // no choke: the gated open hat keeps its eighth
    }
    note(reactor, bar, 3 * BEAT + 3 * S16, tonal('reactor', BASS[chord], 0.7, '1/16', envelope(0.002, 0.03), { playbackRate: rate(MIDI[BASS[chord]]! + 12 - 33) }));
    for (const b of [1, 3]) { note(snare, bar, b * BEAT, { pitch: 'titanium-crack', velocity: 0.92 }); note(snare, bar, b * BEAT, { pitch: 'neon-clap', velocity: 0.78 }); }
    if (bar % 2 === 0) note(snare, bar, 3 * BEAT + 3 * S16, { pitch: 'titanium-crack', velocity: 0.3, gate: '1/32', envelope: envelope(0.001, 0.02) });
    note(abyss, bar, 0, tonal('abyss', BASS[chord], 0.9, bar === 12 ? '15/16' : '1/1', envelope(0.004, 0.06)));
    note(horizon, bar, 0, tonal('event-horizon', PAD_ROOT[chord], 0.85, '1/1', envelope(0.15, 0.35), { offsetSeconds: 1.6 }));
    for (const n of VOICING[chord]) note(afterglow, bar, 0, tonal('afterglow', n, 0.6, '1/1', envelope(0.02, 0.25)));
    for (const [n, u, g] of HOOK[bar - 9]!) note(phantom, bar, u, tonal('phantom', n, 0.95, g, envelope(0.005, 0.12)));
  }

  // AFTERGLOW (bars 13–14): the hook resolves to A5 over A minor; the bell, the boom and the space close the piece.
  kickHit(13, 0, 'sub-hammer', 1, null); kickHit(13, 0, 'iron-pulse', 0.85, null);
  note(convergence, 13, 0, { velocity: 0.7 });
  note(chrome, 13, 0, { pitch: 'chrome-strike', velocity: 0.85 }); note(chrome, 13, 0, { pitch: 'chrome-strike', velocity: 0.55, playbackRate: 0.5 });
  note(phantom, 13, 0, tonal('phantom', 'A5', 0.9, '3/2', envelope(0.005, 0.9)));
  note(abyss, 13, 0, tonal('abyss', 'A1', 0.85, '3/2', envelope(0.004, 1.2)));
  note(horizon, 13, 0, tonal('event-horizon', 'A2', 0.85, '3/2', envelope(0.1, 1.6), { offsetSeconds: 1.6 }));
  for (const n of [...VOICING.Am, 'A4']) note(afterglow, 13, 0, tonal('afterglow', n, 0.55, '3/2', envelope(0.02, 1.4)));
  note(specter, 13, 0, tonal('specter', 'A3', 0.75, '3/2', envelope(0.2, 1.2), { offsetSeconds: 2.2 }));
  note(hats, 13, 0, { pitch: 'open-circuit', velocity: 0.55 });

  // Pumping under every drop kick; the arp steps back while the hook speaks; the bed fades with the ending.
  const drop = [9, 10, 11, 12];
  // Drop levels ramp in over bar 8's last two beats, so no gain step lands on a sounding note.
  abyss.automation = { gainDb: [{ at: { musical: '1:1' }, value: -6.5 }, { at: { musical: '8:3' }, value: -6.5, transition: 'linear' }, ...pump(drop, -9, -5.5), { at: { musical: '13:1' }, value: -6.5 }] };
  afterglow.automation = { gainDb: [{ at: { musical: '1:1' }, value: -9 }, { at: { musical: '8:3' }, value: -9, transition: 'linear' }, ...pump(drop, -7, -7), { at: { musical: '13:1' }, value: -8 }] };
  horizon.automation = { gainDb: [{ at: { musical: '1:1' }, value: -6 }, ...pump(drop, -5, -6), { at: { musical: '13:1' }, value: -6, transition: 'linear' }, { at: { musical: '15:1' }, value: -12 }] };
  signal.automation = { gainDb: [{ at: { musical: '1:1' }, value: -9.5 }, { at: { musical: '8:4+1/8' }, value: -9.5, transition: 'linear' }, { at: { musical: '9:1' }, value: -12 },
    { at: { musical: '12:4+3/16' }, value: -12, transition: 'linear' }, { at: { musical: '13:1' }, value: -9.5 }] };
  reactor.automation = { gainDb: [{ at: { musical: '1:1' }, value: 0 }, { at: { musical: '8:4' }, value: 0, transition: 'linear' }, { at: { musical: '9:1' }, value: 3 },
    { at: { musical: '12:4+3/16' }, value: 3, transition: 'linear' }, { at: { musical: '13:1' }, value: 0 }] };

  return finish({
    formatVersion: 1, title: 'V12 SIGNATURE — IGNITION',
    description: 'Signature showcase for the V12 SIGNATURE pack: 128 BPM, A minor, 14 bars plus a released tail, exactly 28.000 s. IGNITION (1–2) bell, boom and space; ORBIT (3–6) the hypnotic SIGNAL cell over a rolling ABYSS/REACTOR bass with the hook foreshadowed by the SPECTER choir; ASCENSION (7–8) E pedal, snare roll and riser; CONVERGENCE (9–12) the PHANTOM hook over Am–F–G–E with a pumping held sub; AFTERGLOW (13–14) the hook resolves to A5 as the bell returns. Every sound is a V12 SIGNATURE asset; no General MIDI.',
    bpm: 128, timeSignature: '4/4', key: 'A minor', bars: 14, seed: 128,
    render: { duration: { seconds: 28 }, tail: 'auto' },
    master: { gainDb: -0.5, effects: [{ type: 'highpass', frequencyHz: 25 }, { type: 'compressor', thresholdDb: -12, ratio: 1.8, attackMs: 12, releaseMs: 140, makeupGainDb: 1 }] },
  }, [kick, snare, hats, chrome, abyss, reactor, signal, phantom, horizon, afterglow, specter, ascension, convergence], 14);
}

/** Two-space JSON with every object or array that fits in 200 characters on one line: one note per line. */
export function format(value: unknown, indent = ''): string {
  const flat = JSON.stringify(value);
  if (flat.length + indent.length <= 200 || value === null || typeof value !== 'object') return flat;
  const inner = indent + '  ';
  if (Array.isArray(value)) return `[\n${value.map(x => inner + format(x, inner)).join(',\n')}\n${indent}]`;
  return `{\n${Object.entries(value).map(([k, x]) => `${inner}${JSON.stringify(k)}: ${format(x, inner)}`).join(',\n')}\n${indent}}`;
}
export function writeProjects(output = DEFAULT_OUTPUT): void {
  writeFileSync(join(output, 'v12-signature-audition.json'), format(audition()) + '\n');
  writeFileSync(join(output, 'v12-signature-showcase.json'), format(showcase()) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) writeProjects(process.argv[2]);
