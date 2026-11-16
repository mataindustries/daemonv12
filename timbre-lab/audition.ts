/**
 * Timbre Lab auditions: short clips that show the range of the two lab families, plus the closest existing rack sound
 * playing the same notes.
 *   node timbre-lab/audition.ts            render every clip to timbre-lab/auditions/<id>.mp3 and write auditions.json
 *   node timbre-lab/audition.ts p1-hands   render only the named clips
 */
import './register.ts';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Opt = Record<string, number | string>;
type N = [number, number, string, number, Opt?];
interface Part { id: string; instrument: string; notes: N[]; [k: string]: unknown }
interface Clip { id: string; family: 'organic-percussion' | 'breath-reed'; compare?: boolean; title: string; listen: string; bpm: number; key: string; bars: number; swing?: number; parts: Part[] }

const HERE = new URL('.', import.meta.url).pathname;
const a = (articulation: string, extra: Opt = {}): Opt => ({ articulation, ...extra });
/** Repeat a cell of notes every `len` beats, `times` times, starting at `at`. */
const loop = (cell: N[], len: number, times: number, at = 0): N[] => Array.from({ length: times }, (_, k) => cell.map(([b, d, p, v, o]): N => [at + k * len + b, d, p, v, o])).flat();

// ---------------------------------------------------------------- organic percussion
/** Two hand drums (low D3, high A3): bass, ghost taps, slaps and open tones, nothing on the grid twice the same way. */
const hands: N[] = [
  [0, 0.4, 'D3', 0.9, a('bass')], [0.5, 0.2, 'A3', 0.32, a('tap')], [0.75, 0.2, 'A3', 0.26, a('tap')], [1, 0.3, 'A3', 0.86, a('slap')], [1.5, 0.2, 'A3', 0.3, a('tap')], [1.75, 0.4, 'D3', 0.62, a('open')],
  [2, 0.4, 'D3', 0.8, a('bass')], [2.5, 0.4, 'A3', 0.76, a('open')], [2.75, 0.4, 'A3', 0.58, a('open')], [3, 0.3, 'A3', 0.92, a('slap')], [3.5, 0.4, 'D3', 0.7, a('open')], [3.75, 0.2, 'A3', 0.34, a('tap')],
];
const handsMuted: N[] = hands.map(([b, d, p, v, o]): N => (b === 2.5 || b === 2.75 ? [b, d, p, v, a('mute')] : [b, d, p, v, o]));
const talk: N[] = [ // one drum, squeezed: the pitch speaks
  [12, 0.5, 'A3', 0.8, a('open')], [12.5, 0.5, 'C4', 0.7, a('open', { slide: 0.2 })], [13, 0.5, 'E4', 0.8, a('open', { slide: 0.2 })], [13.5, 0.75, 'D4', 0.85, a('open', { slide: 0.15, bend: -5 })],
  [14.5, 1, 'D3', 0.75, a('roll')], [15.5, 0.5, 'D3', 1, a('bass')],
];
const P1: Clip = {
  id: 'p1-hands', family: 'organic-percussion', title: 'Hands on skin', bpm: 96, key: 'D minor', bars: 4, swing: 0.54,
  listen: 'Two hand drums. Bass, ghost taps, slaps and open tones are one drum hit in different places with different parts of the hand. Bar 2 mutes two tones (hand stays on). Bar 4: one drum is squeezed so its pitch talks, then a finger roll and a last bass.',
  parts: [{ id: 'skin', instrument: 'organic-percussion/skin', macro: [[0, 0.12], [8, 0.2], [16, 0.5]], gainDb: -4, room: 0.14, humanize: { timingMs: 4, velocity: 0.1 },
    notes: [...hands, ...loop(handsMuted, 4, 1, 4), ...loop(hands, 4, 1, 8), ...talk] }],
};
const logLine: N[] = [
  [0, 0.5, 'D3', 0.85, a('strike')], [0.75, 0.25, 'A3', 0.5, a('knuckle')], [1, 0.5, 'F3', 0.7, a('strike')], [1.5, 0.25, 'D3', 0.4, a('rim')], [1.75, 0.25, 'D3', 0.55, a('rim')], [2, 0.5, 'G3', 0.8, a('strike')],
  [2.5, 0.25, 'A3', 0.6, a('mute')], [2.75, 0.25, 'A3', 0.45, a('mute')], [3, 0.5, 'C4', 0.75, a('knuckle')], [3.5, 0.5, 'A3', 0.65, a('strike')],
];
const potLine: N[] = [[0, 1, 'D2', 0.9, a('whoop')], [1.5, 0.25, 'A2', 0.5, a('tap')], [1.75, 0.25, 'A2', 0.7, a('tap')], [2.5, 1.2, 'F2', 0.85, a('drop')], [3.75, 0.25, 'A2', 0.6, a('tap')]];
const P2: Clip = {
  id: 'p2-log-and-pot', family: 'organic-percussion', title: 'Hollow log, clay pot', bpm: 104, key: 'D minor', bars: 4,
  listen: 'A wooden tongue over a box: each note is a slow doublet with the air inside, so it wobbles as it dies; rim clicks and muted notes are the same mallet elsewhere or staying down. Under it a clay pot whose pitch is the air in it: whoops up when the hand leaves the hole, sags when it closes. A scrape leads into bar 3; the log grows more hollow to the end.',
  parts: [
    { id: 'log', instrument: 'organic-percussion/log', macro: [[0, 0.15], [8, 0.3], [16, 0.8]], gainDb: -6, room: 0.16, humanize: { timingMs: 3, velocity: 0.08 },
      notes: [...loop(logLine, 4, 2), [7, 1, 'D4', 0.7, a('scrape')], ...loop(logLine, 4, 2, 8)] },
    { id: 'pot', instrument: 'organic-percussion/pot', macro: 0.5, gainDb: -5, room: 0.12, notes: [...loop(potLine, 4, 3, 4), [4, 1, 'D2', 0.9, a('whoop')], [15, 1, 'D2', 1, a('palm')]] },
  ],
};
const P3: Clip = {
  id: 'p3-friction-and-thunder', family: 'organic-percussion', title: 'Friction and thunder', bpm: 72, key: 'G minor', bars: 4,
  listen: 'A wet finger rubbed on a skin: a moan at the skin\'s own pitch that follows the squeeze (no oscillator, the friction sticks and slips). It is answered by a huge slack skin: hit hard, the pitch starts high and settles, an air boom sits an octave under it, and loose beads rattle until the skin calms. The last pot note is bent by a hand over the hole while it rings.',
  parts: [
    { id: 'rub', instrument: 'organic-percussion/skin', macro: 0.25, gainDb: -3, pan: -0.25, room: 0.2, controls: { buzz: 0 },
      notes: [[0.5, 1.2, 'G3', 0.6, a('rub', { bend: 4 })], [2, 0.5, 'Bb3', 0.75, a('rub')], [2.5, 1, 'D4', 0.8, a('rub', { slide: 0.3, bend: -7 })],
        [8.5, 0.4, 'D4', 0.7, a('rub')], [9, 0.4, 'C4', 0.7, a('rub', { slide: 0.1 })], [9.5, 0.4, 'D4', 0.75, a('rub', { slide: 0.1 })], [10, 1.6, 'G3', 0.9, a('rub', { slide: 0.4, bend: 7 })]] },
    { id: 'thunder', instrument: 'organic-percussion/skin', macro: 0.95, gainDb: -5, pan: 0.2, room: 0.3,
      notes: [[4, 2, 'G2', 1, a('bass')], [5.5, 1, 'D3', 0.55, a('open')], [6, 1, 'D3', 0.9, a('open')], [7.5, 0.5, 'G2', 0.5, a('tap')],
        [12, 2, 'G2', 1, a('open')], [13, 0.25, 'D3', 0.5, a('slap')], [13.5, 2, 'D3', 0.95, a('open', { bend: -4 })], [14.5, 1.5, 'G2', 0.7, a('roll')]] },
    { id: 'pot', instrument: 'organic-percussion/pot', macro: 0.9, gainDb: -6, room: 0.2, controls: { wah: [[14, 0], [14.6, 0.9], [15.1, 0.1], [15.5, 0.9], [16, 0]], damp: 0.45 },
      notes: [[7, 1, 'G2', 0.8, a('drop')], [14, 2, 'D2', 0.9, a('whoop')]] },
  ],
};
const cell: N[] = [[0, 0.5, 'D3', 0.95, a('bass')], [0.75, 0.25, 'A3', 0.4, a('tap')], [1, 0.4, 'A3', 0.9, a('slap')], [1.5, 0.5, 'D3', 0.7, a('open')], [2.25, 0.5, 'A3', 0.8, a('open')], [2.75, 0.25, 'A3', 0.35, a('tap')], [3, 0.5, 'D3', 0.85, a('open')], [3.5, 0.4, 'A3', 0.75, a('slap')]];
const cellLog: N[] = [[0.5, 0.25, 'F3', 0.6, a('knuckle')], [1.25, 0.25, 'D3', 0.5, a('rim')], [2, 0.5, 'G3', 0.8, a('strike')], [3.25, 0.25, 'A3', 0.6, a('strike')], [3.75, 0.25, 'D3', 0.5, a('rim')]];
const P4: Clip = {
  id: 'p4-tight-to-cavernous', family: 'organic-percussion', title: 'One bar, tight to cavernous', bpm: 100, key: 'D minor', bars: 4,
  listen: 'The same bar four times while the family macro travels from tight to cavernous: the skin goes slack (pitch glide on hard hits, boom under the tone, beads from bar 3), the log turns hollow and slow, decays lengthen. Same notes, same velocities.',
  parts: [
    { id: 'skin', instrument: 'organic-percussion/skin', macro: { steps: [[0, 0], [4, 0.35], [8, 0.7], [12, 1]], glide: 0.25 }, gainDb: -5, room: 0.16, notes: loop(cell, 4, 4) },
    { id: 'log', instrument: 'organic-percussion/log', macro: { steps: [[0, 0], [4, 0.35], [8, 0.7], [12, 1]], glide: 0.25 }, gainDb: -9, pan: 0.3, room: 0.16, notes: loop(cellLog, 4, 4) },
  ],
};
/** Closest existing rack sounds on the notes of clip 1: context kick and snare, the dead-marimba bar, the clock. */
const PX: Clip = {
  id: 'px-existing-rack', family: 'organic-percussion', compare: true, title: 'For comparison: the existing rack on clip 1', bpm: 96, key: 'D minor', bars: 4, swing: 0.54,
  listen: 'The notes of "Hands on skin" on the closest sounds the rack already had: context kick for the bass strokes, context snare for the slaps, the dead-marimba bar for open tones and the escapement clock for ghost taps. Four different machines, each note identical to the last one like it; nothing answers how or where it is hit, nothing can be muted, squeezed or rolled.',
  parts: (() => {
    const all = [...hands, ...loop(handsMuted, 4, 1, 4), ...loop(hands, 4, 1, 8), ...talk], pick = (arts: string[]) => all.filter(n => arts.includes(String(n[4]?.articulation)));
    return [
      { id: 'kick', instrument: 'context/kick', gainDb: -8, notes: pick(['bass']).map(([b, d, , v]): N => [b, d, 'D2', v]) },
      { id: 'snare', instrument: 'context/snare', gainDb: -13, notes: pick(['slap']).map(([b, d, , v]): N => [b, d, 'D3', v, a('snare')]) },
      { id: 'bar', instrument: 'mechanical-orchestra/bar', macro: 0.1, controls: { hardness: 0.9, damp: 0.28 }, setup: { spread: 0.5 }, gainDb: -7, room: 0.1, notes: pick(['open', 'mute', 'roll']).map(([b, d, p, v, o]): N => [b, d, p, v, a(o?.articulation === 'mute' ? 'muted' : 'strike')]) },
      { id: 'clock', instrument: 'mechanical-orchestra/clock', macro: 0.2, gainDb: -14, pan: -0.15, room: 0.1, notes: pick(['tap']).map(([b, d, , v]): N => [b, d, 'A5', v, a('tick')]) },
    ];
  })(),
};

// ---------------------------------------------------------------- breath reed
const phrase: N[] = [
  [0, 1.5, 'D4', 0.75, a('scoop')], [1.5, 0.5, 'F4', 0.7, a('legato')], [2, 1, 'G4', 0.8, a('legato')], [3, 1, 'A4', 0.85, a('tongued')],
  [4, 0.75, 'C5', 0.9, a('tongued')], [4.75, 0.75, 'A4', 0.75, a('legato')], [5.5, 0.5, 'G4', 0.7, a('tongued')], [6, 0.75, 'F4', 0.75, a('legato')], [6.75, 1.1, 'D4', 0.8, a('fall')],
];
const soft = (ns: N[], f: number): N[] => ns.map(([b, d, p, v, o]): N => [b, d, p, v * f, o]);
const R1: Clip = {
  id: 'r1-whisper-to-feral', family: 'breath-reed', title: 'One phrase, whisper to feral', bpm: 80, key: 'D minor', bars: 6,
  listen: 'The same phrase three times. First barely blown: the note is air until it finds itself, and it wanders. Then plainly: tongued starts, legato moves without a new attack, a scoop in, a fall out. Then pushed: harder embouchure, the reed itself buzzing in the sound, throat growl, a bark on the top note.',
  parts: [{ id: 'reed', instrument: 'breath-reed', macro: { steps: [[0, 0.02], [8, 0.45], [16, 1]], glide: 0.5 }, gainDb: -4, room: 0.22,
    notes: [...soft(phrase, 0.45).map(([b, d, p, v, o]): N => [b, d, p, v, b === 0 || b === 4 ? a('breathy') : o]), ...loop(phrase, 8, 1, 8),
      ...loop(phrase, 8, 1, 16).map(([b, d, p, v, o]): N => [b, d, p, Math.min(1, v * 1.15), b === 20 ? a('accent') : o])] }],
};
const R2: Clip = {
  id: 'r2-gestures', family: 'breath-reed', title: 'Gestures', bpm: 84, key: 'D minor', bars: 4,
  listen: 'Bar 1: a deep scoop, then a slow slide up a fifth under one breath. Bar 2: flutter-tongue, a growled note, a long fall. Bar 3: six tongued repeats of one pitch (accents, soft ones nearly air: no two alike), then a legato run. Bar 4: a low note pushed until it breaks into its upper register.',
  parts: [{ id: 'reed', instrument: 'breath-reed', macro: 0.4, gainDb: -4, room: 0.2,
    notes: [[0, 2, 'A3', 0.8, a('scoop', { bend: 4 })], [2, 1.9, 'E4', 0.85, a('legato', { slide: 1 })],
      [4, 1.4, 'G4', 0.85, a('flutter')], [5.5, 1.4, 'A4', 0.9, a('growl')], [7, 1, 'C5', 0.95, a('fall', { fall: 9 })],
      [8, 0.2, 'D4', 0.9, a('accent')], [8.25, 0.2, 'D4', 0.3, a('tongued')], [8.5, 0.2, 'D4', 0.55, a('tongued')], [8.75, 0.2, 'D4', 0.9, a('accent')], [9, 0.2, 'D4', 0.25, a('tongued')], [9.25, 0.2, 'D4', 0.6, a('tongued')],
      [9.5, 0.5, 'D4', 0.7, a('tongued')], [10, 0.5, 'E4', 0.72, a('legato')], [10.5, 0.5, 'F4', 0.76, a('legato')], [11, 0.5, 'G4', 0.8, a('legato')], [11.5, 0.5, 'A4', 0.88, a('legato')],
      [12, 3.8, 'D3', 0.95, a('overblow')]] }],
};
const R3: Clip = {
  id: 'r3-one-breath', family: 'breath-reed', title: 'Two held notes', bpm: 60, key: 'D minor', bars: 4,
  listen: 'Nothing but two long notes. The first is ridden on the breath: from air into tone, swelling until the throat growls, a lip bend down and back, vibrato arriving late, then let go. The second opens its register vent halfway (a split tone), closes it, and ends on flutter-tongue.',
  parts: [{ id: 'reed', instrument: 'breath-reed', macro: 0.3, gainDb: -4, room: 0.25,
    controls: { breath: [[0, 0.12], [2.5, 0.7], [4.5, 1.25], [6, 0.8], [7.5, 0.3], [8.5, 0.9], [15, 0.9]], growl: [[3.5, 0], [4.5, 0.7], [5.5, 0]], bend: [[5.2, 0], [5.9, -2], [6.6, 0]], vib: [[0, 0.2], [6, 1.2], [8, 0.6]],
      overblow: [[10, 0], [11.2, 0.55], [12.2, 0.55], [13, 0]], flutter: [[13.4, 0], [14, 0.9]] },
    notes: [[0, 7.8, 'A3', 0.9, a('tongued')], [8.5, 6.5, 'D4', 0.85, a('tongued')]] }],
};
const R4: Clip = {
  id: 'r4-reed-over-hands', family: 'breath-reed', title: 'Reed over hands (both families)', bpm: 96, key: 'D minor', bars: 4, swing: 0.54,
  listen: 'The two families together, briefly: the hand-drum bar and a pot bass under a reed line that leans into the drum\'s slaps. Not a song: four bars to hear them share a room.',
  parts: [
    { id: 'skin', instrument: 'organic-percussion/skin', macro: 0.3, gainDb: -7, room: 0.14, humanize: { timingMs: 4, velocity: 0.1 }, notes: loop(hands, 4, 4) },
    { id: 'pot', instrument: 'organic-percussion/pot', macro: 0.5, gainDb: -8, room: 0.1, notes: loop([[0, 1, 'D2', 0.9, a('whoop')], [2.5, 1, 'D2', 0.8, a('drop')]], 4, 4) },
    { id: 'reed', instrument: 'breath-reed', macro: [[0, 0.3], [12, 0.75]], gainDb: -5, pan: 0.1, room: 0.22,
      notes: [[1, 0.9, 'A4', 0.8, a('scoop')], [2, 0.5, 'G4', 0.7, a('legato')], [2.5, 1.4, 'F4', 0.75, a('legato')], [5, 0.9, 'A4', 0.85, a('tongued')], [6, 0.5, 'C5', 0.85, a('legato')], [6.5, 1.3, 'D5', 0.9, a('legato', { fall: 3 })],
        [9, 0.4, 'D5', 0.9, a('accent')], [9.5, 0.4, 'C5', 0.7, a('tongued')], [10, 0.5, 'A4', 0.8, a('tongued')], [10.5, 1.4, 'G4', 0.85, a('growl')], [13, 0.9, 'F4', 0.8, a('scoop')], [14, 1.8, 'D4', 0.85, a('fall', { slide: 0.3 })]] },
  ],
};
/** Closest existing rack sound on the phrase of clip 1: the Impossible Voice's hollow-whistle patch (Composer Kit palette). */
const voice = (ns: N[]): N[] => ns.map(([b, d, p, v, o]): N => [b, d, p, v, { vowel: 'oo', articulation: o?.articulation === 'legato' ? 'legato' : o?.articulation === 'fall' ? 'fall' : 'sung' }]);
const RX: Clip = {
  id: 'rx-existing-rack', family: 'breath-reed', compare: true, title: 'For comparison: the existing rack on clip 1', bpm: 80, key: 'D minor', bars: 4,
  listen: 'The phrase of "whisper to feral" on the closest sound the rack already had, the Impossible Voice in its hollow, reed-like "hollow-whistle" setting, cold then hot. It is a sung vowel made by adding partials: it can glide and fall, but there is no breath pressure to lean on, no reed to push shut, no tongue, growl or register break.',
  parts: [{ id: 'voice', instrument: 'impossible-voice', macro: { steps: [[0, 0.45], [8, 0.8]], glide: 0.5 }, gainDb: -3, room: 0.22,
    controls: { even: [[0, 0.15], [16, 0]], whistle: [[0, 0.7], [16, 1]], stretch: [[0, 0.008], [16, 0.04]], vib: 0.4, breath: 0.1 }, notes: [...voice(phrase), ...loop(voice(phrase), 8, 1, 8)] }],
};

export const CLIPS: Clip[] = [P1, P2, P3, P4, PX, R1, R2, R3, R4, RX];
export function scoreOf(c: Clip) {
  return { schema: 'daemonv12.signature-rack.score/1', title: c.title, bpm: c.bpm, key: c.key, swing: c.swing ?? 0.5, seed: 11, tailSeconds: 2.5, description: c.listen,
    sections: [{ id: 'clip', bars: c.bars }], room: { rt60: 1.3, size: 0.9, damp: 5200, predelayMs: 12 }, parts: c.parts };
}

async function main() {
  const { renderMp3 } = await import('../composer-kit/render.ts');
  const only = process.argv.slice(2), index: Record<string, unknown>[] = [];
  for (const c of CLIPS) {
    const entry = { id: c.id, family: c.family, compare: c.compare ?? false, title: c.title, listen: c.listen, bpm: c.bpm, key: c.key, bars: c.bars, instruments: [...new Set(c.parts.map(p => p.instrument))] };
    index.push(entry);
    if (only.length && !only.includes(c.id)) continue;
    const t0 = performance.now(), info = await renderMp3(scoreOf(c), `${HERE}auditions/${c.id}.mp3`, { lufs: c.family === 'organic-percussion' ? -22.3 : c.id === 'r4-reed-over-hands' ? -19 : -17, kbps: 128 }); // drums are all peak: one level per family so the comparison is fair
    console.log(`${c.id.padEnd(26)} ${info.seconds.toFixed(1)} s  raw ${info.rawLufs} LUFS -> ${info.lufs}  tp ${info.truePeakDb} dB  (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
  }
  if (!only.length) writeFileSync(`${HERE}auditions/auditions.json`, JSON.stringify({ schema: 'daemonv12.timbre-lab.auditions/1', clips: index }, null, 2) + '\n');
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) main().catch(e => { console.error((e as Error).message); process.exitCode = 1; });
