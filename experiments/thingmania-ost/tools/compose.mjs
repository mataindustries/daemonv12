#!/usr/bin/env node
// Writes the DaemonV12 projects for the three THING//MANIA auditions:
//   <audition>/<slug>.json      the exact four-bar loop (render.duration = 4 bars, tail none)
//   <audition>/<slug>-x4.json   listening copy: the same loop four times plus a final downbeat
// The JSON files are the canonical, editable projects; this script is how they were authored.
// Editing a JSON by hand is fine, but rerunning this script overwrites it.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { semis } from './dsp.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const frac = (ticks) => { const g = gcd(ticks, 3840); return `${ticks / g}/${3840 / g}`; };
const SIXTEENTH = 240;

// A song's grid maps (bar, step) to a canonical DaemonV12 position. `swing` lists the tick
// offset of each sixteenth inside a quarter-note beat (4/4) or eighth-note beat (7/8).
function grid({ den, stepTicks }) {
  const tpb = 3840 / den;
  return (bar, step) => {
    const ticks = stepTicks(step), beat = Math.floor(ticks / tpb) + 1, off = ticks % tpb;
    return off ? `${bar}:${beat}+${frac(off)}` : `${bar}:${beat}`;
  };
}

// Event: [bar, step, pitch, len16, velocity, options]. len16 = gate in sixteenths (0 = no gate).
function notes(pos, events, { env, choke } = {}) {
  return events.map(([bar, step, pitch, len, vel, o = {}]) => {
    const n = { start: pos(bar, step), pitch, velocity: vel };
    if (o.rate) n.playbackRate = o.rate;
    if (o.glide) n.glide = { to: o.glide[0], duration: o.glide[1] };
    if (len) n.gate = frac(len * SIXTEENTH - (o.short ?? 0));
    if (env && (len || choke)) n.envelope = env;
    if (choke) n.chokeGroup = choke;
    return n;
  });
}
const perBar = (bars) => bars.flatMap((evs, b) => evs.map((e) => [b + 1, ...e]));

function track(pos, t) {
  const loop = notes(pos, t.events, t);
  const out = { id: t.id, description: t.description, instrument: { type: 'drumkit', kit: t.kit } };
  if (t.mix) out.mix = t.mix;
  if (t.effects) out.effects = t.effects;
  out.clips = [{ bar: 1, pattern: 'loop' }];
  out.patterns = [{ id: 'loop', bars: 4, notes: loop }];
  if (t.button) out.button = notes(pos, t.button.map((e) => [1, ...e]), t);
  return out;
}

function projects(song) {
  const pos = grid(song.grid);
  const tracks = song.tracks.map((t) => track(pos, t));
  const head = { formatVersion: 1, title: song.title, description: song.description, bpm: song.bpm,
    timeSignature: song.timeSignature, key: song.key };
  const strip = ({ button, ...t }) => t;
  const loop = { ...head, bars: 4, seed: 0, render: { duration: { bars: 4 }, tail: 'none' }, master: song.master, tracks: tracks.map(strip) };
  const x4 = { ...head, title: `${song.title} (x4 listening copy)`,
    description: `Listening copy of ${song.slug}.json: the identical four-bar loop placed at bars 1, 5, 9 and 13, then one closing downbeat at bar 17 that decays inside that bar. Same tracks, mix and master.`,
    bars: 17, seed: 0, render: { tail: 'none' }, master: song.master,
    tracks: tracks.map(({ button, ...t }) => ({ ...t,
      clips: [1, 5, 9, 13].map((bar) => ({ bar, pattern: 'loop' })).concat(button ? [{ bar: 17, pattern: 'button' }] : []),
      patterns: button ? [...t.patterns, { id: 'button', bars: 1, notes: button }] : t.patterns })) };
  return { loop, x4 };
}

// One note/clip/effect per line, as in the repository examples.
function fmt(v, ind = '') {
  const one = JSON.stringify(v);
  if (v === null || typeof v !== 'object' || (!Array.isArray(v) && 'start' in v) || one.length <= 90) return one;
  const ni = ind + '  ';
  if (Array.isArray(v)) return `[\n${v.map((x) => ni + fmt(x, ni)).join(',\n')}\n${ind}]`;
  return `{\n${Object.entries(v).map(([k, x]) => `${ni}${JSON.stringify(k)}: ${fmt(x, ni)}`).join(',\n')}\n${ind}}`;
}

// ===================== A: SOCK SLIDE =====================
// ~106 BPM, 16ths swung to 272/240 ticks (about 57%). E Dorian funk; bII13 slip in bar 4.
// 96000/905 BPM makes the quarter note exactly 565,625 us, so one loop is exactly 399,105 frames
// and every repeat lands on identical frames (106 BPM would drift by 0.41 frames per loop).
const swing16 = (s) => Math.floor(s / 4) * 960 + [0, 272, 480, 752][s % 4];
const riff = [[0, 'E1', 2, 1.0], [3, 'E1', 1, 0.8, { rate: 2, short: 40 }], [5, 'D2', 1, 0.85], [6, 'B1', 1, 0.85],
  [9, 'G1', 1, 0.6], [10, 'A1', 2, 0.9], [12, 'Bb1', 2, 0.95, { glide: [semis(1), '1/32'] }], [15, 'E1', 1, 0.75]];
const sockBass = perBar([riff,
  [[0, 'E1', 3, 1.0], [3, 'E1', 1, 0.7, { rate: 2, short: 40 }], [6, 'E1', 1, 0.5], [7, 'G1', 1, 0.8], [8, 'A1', 1, 0.85], [10, 'B1', 2, 0.85], [14, 'D2', 1, 0.8], [15, 'Eb2', 1, 0.85]],
  riff,
  [[0, 'E1', 2, 1.0], [3, 'E1', 1, 0.8, { rate: 2, short: 40 }], [5, 'D2', 1, 0.85], [6, 'B1', 1, 0.85], [8, 'F1', 3, 1.0], [11, 'F1', 1, 0.8, { rate: 2, short: 40 }], [13, 'Eb2', 1, 0.8], [14, 'F1', 2, 0.95, { glide: [semis(-1), '1/8'] }]]]);
const whistleHook = [[0, 'E6', 3, 0.95, { rate: semis(-2), glide: [1, '1/32'] }], [3, 'D6', 1, 0.72], [5, 'B5', 1, 0.72], [6, 'C#6', 2, 0.85]];
const hatsBar = (open) => Array.from({ length: 16 }, (_, s) => (open && s === 14 ? [s, 'hat-o', 0, 0.55]
  : [s, 'hat-c', 0, s % 4 === 0 ? 0.5 : s % 4 === 2 ? 0.72 : 0.32]));
const SOCK_SLIDE = {
  slug: 'sock-slide', dir: 'a-sock-slide', title: 'THING//MANIA audition A: SOCK SLIDE',
  description: 'Bass-driven arcade funk. Thesis - hook: a squelch-bass riff that bends Bb up to B on beat 4, answered by a nonchalant whistle that leans on the Dorian C#. Rhythm: 16ths swung to about 57%, kick and bass locked on 1 and 3-and. Low end: the bass is the lead instrument; its filter quack carries it on phone speakers. Surprise: in bar 4 the whole band slips up a semitone to an F13 (bII, the tritone substitute) while the drums drop out, then bass and whistle slide back down into the loop downbeat. Loop: the slide resolves across the boundary.',
  bpm: 106.0773, timeSignature: '4/4', key: 'E minor', grid: { den: 4, stepTicks: swing16 },
  master: { gainDb: -2.5, effects: [{ type: 'highpass', frequencyHz: 28 }, { type: 'compressor', thresholdDb: -16, ratio: 2, attackMs: 8, releaseMs: 120, makeupGainDb: 1 }] },
  tracks: [
    { id: 'bass', description: 'Squelch bass riff: E1, octave pop, D-B, ghost G, A, the Bb->B bend, pickup. Bar 4 slips to F and glides home.',
      kit: 'assets/bass/kit.json', env: { attackSeconds: 0.001, releaseSeconds: 0.02 }, choke: 'bass',
      mix: { gainDb: 0 },
      effects: [{ type: 'highpass', frequencyHz: 32 }, { type: 'compressor', thresholdDb: -16, ratio: 3, attackMs: 4, releaseMs: 90, makeupGainDb: 1 }, { type: 'saturation', driveDb: 6, mix: 0.35 }],
      events: sockBass, button: [[0, 'E1', 8, 1.0]] },
    { id: 'bass-grit', description: 'Parallel copy of the bass riff, high-passed and driven hard so its harmonics carry the riff on phone speakers.',
      kit: 'assets/bass/kit.json', env: { attackSeconds: 0.001, releaseSeconds: 0.02 }, choke: 'bass',
      mix: { gainDb: -10 },
      effects: [{ type: 'highpass', frequencyHz: 350 }, { type: 'saturation', driveDb: 18, mix: 0.5 }, { type: 'lowpass', frequencyHz: 4000 }],
      events: sockBass, button: [[0, 'E1', 8, 1.0]] },
    { id: 'whistle', description: 'Whistled answer: B-D pickup, swoop up to E6, D-B, the Dorian C#. Bar 4 slips to C6 and falls back to B5 into the loop.',
      kit: 'assets/whistle/kit.json', env: { attackSeconds: 0.004, releaseSeconds: 0.06 }, choke: 'lead',
      mix: { gainDb: -9, pan: 0.12 },
      effects: [{ type: 'highpass', frequencyHz: 400 }, { type: 'delay', timeMs: 424.5, wet: 0.14 }, { type: 'reverb', roomSize: 0.4, decaySeconds: 1.0, wet: 0.18 }],
      events: perBar([[[13, 'B5', 1, 0.7], [14, 'D6', 2, 0.8]],
        [...whistleHook, [8, 'B5', 4, 0.85]],
        [[13, 'B5', 1, 0.7], [14, 'D6', 2, 0.8]],
        [...whistleHook, [8, 'C6', 5, 0.9], [14, 'B5', 2, 0.8, { rate: semis(1), glide: [1, '1/16'] }]]]),
      button: [[0, 'E6', 8, 0.85, { rate: semis(-2), glide: [1, '1/32'] }]] },
    { id: 'clav', description: 'Em9 stabs on the swung off-beats and a muted scratch; F13 on the slip.',
      kit: 'assets/clav/kit.json', env: { attackSeconds: 0.001, releaseSeconds: 0.03 }, choke: 'clav',
      mix: { gainDb: -5, pan: -0.28 },
      effects: [{ type: 'highpass', frequencyHz: 200 }, { type: 'reverb', roomSize: 0.25, decaySeconds: 0.4, wet: 0.08 }],
      events: perBar([[[0, 'em9', 1, 0.7], [6, 'em9', 1, 0.75], [11, 'chk', 1, 0.45], [14, 'em9', 1, 0.6]],
        [[6, 'em9', 1, 0.75], [11, 'chk', 1, 0.45], [14, 'em9', 1, 0.6]],
        [[6, 'em9', 1, 0.75], [11, 'chk', 1, 0.45], [14, 'em9', 1, 0.6]],
        [[6, 'em9', 1, 0.75], [8, 'f13', 3, 0.9], [14, 'f13', 1, 0.65]]]),
      button: [[0, 'em9', 4, 0.8]] },
    { id: 'kick', description: 'Kick on 1 and 3-and, locked to the bass; bar 4 stops after 2-and.',
      kit: 'assets/drums/kit.json', mix: { gainDb: -3 },
      events: perBar([[[0, 'kick', 0, 1.0], [10, 'kick', 0, 0.85]], [[0, 'kick', 0, 1.0], [10, 'kick', 0, 0.85], [13, 'kick', 0, 0.55]],
        [[0, 'kick', 0, 1.0], [10, 'kick', 0, 0.85]], [[0, 'kick', 0, 1.0], [6, 'kick', 0, 0.75]]]),
      button: [[0, 'kick', 0, 1.0]] },
    { id: 'snare', description: 'Backbeat with ghost notes; the slip is a drum break with one pickup ghost.',
      kit: 'assets/drums/kit.json', mix: { gainDb: -4, pan: 0.05 },
      effects: [{ type: 'reverb', roomSize: 0.3, decaySeconds: 0.6, wet: 0.12 }],
      events: perBar([0, 1, 2].map(() => [[4, 'snare', 0, 0.95], [7, 'snare', 0, 0.22], [9, 'snare', 0, 0.18], [12, 'snare', 0, 0.95], [14, 'snare', 0, 0.22]])
        .concat([[[4, 'snare', 0, 0.95], [7, 'snare', 0, 0.22], [15, 'snare', 0, 0.45]]])) },
    { id: 'hats', description: 'Swung 16ths accenting the off-beat eighths; open hat on 4-and in bars 1 and 3, choked by the next closed hat.',
      kit: 'assets/drums/kit.json', choke: 'hat', env: { attackSeconds: 0.0005, releaseSeconds: 0.01 },
      mix: { gainDb: -10, pan: 0.25 },
      events: perBar([hatsBar(true), hatsBar(false), hatsBar(true), hatsBar(false).slice(0, 8)]),
      button: [[0, 'hat-o', 0, 0.55]] },
  ],
};

// ===================== B: FRIDGE LIGHT =====================
// 96 BPM straight. F Aeolian: Fm11 | Dbmaj9#11 | Bbm9 | Emaj9 (the light) -> Fm11.
// The bell motif lasts three beats, so it rotates against the four-beat bar.
const straight16 = (s) => s * SIXTEENTH;
const atBeat = (beat, pitch, vel, o) => [Math.floor(beat / 4) + 1, Math.round((beat % 4) * 4), pitch, 0, vel, o];
const lightPhrase = [[12, 'Eb6', 0.85], [12.75, 'B5', 0.7], [13.5, 'Ab5', 0.75], [14, 'Bb5', 0.8], [15.5, 'Db6', 0.65]];
const motif = (s) => [[s, 'C6', 0.9], [s + 0.75, 'Ab5', 0.7], [s + 1.5, 'Eb6', 0.8], [s + 2, 'Db6', 0.75]];
const roots = ['F1', 'Db2', 'Bb1', 'E1'];
const fridgeBass = perBar(roots.map((r, b) => {
  const next = roots[(b + 1) % 4];
  return [[0, r, 5, 1.0], [6, r, 1, 0.7, { rate: 2 }], [10, r, 2, 0.9], [14, next, 2, 0.8, { rate: semis(b === 3 ? -1 : 1), glide: [1, '1/8'] }]];
}));
const shakerBar = (thin) => Array.from({ length: 16 }, (_, s) => [s, 'shaker', 0, s % 4 === 2 ? 0.5 : s % 4 === 0 ? 0.3 : 0.18]).filter(([s]) => !thin || s % 2 === 0);
const drips = Array.from({ length: 21 }, (_, k) => {
  const g = 3 * k;
  return [Math.floor(g / 16) + 1, g % 16, ['drip-c6', 'drip-f6', 'drip-eb6', 'drip-ab6'][k % 4], 0, [0.55, 0.35, 0.45, 0.3][k % 4]];
});
const FRIDGE_LIGHT = {
  slug: 'fridge-light', dir: 'b-fridge-light', title: 'THING//MANIA audition B: FRIDGE LIGHT',
  description: 'Mysterious, sophisticated electronic groove. Thesis - hook: a four-note glass-bell motif (C-Ab-Eb-Db) that is three beats long, so it rotates against the four-beat bar and every repeat lands on a different chord; a dotted-eighth echo doubles the three-against-four. Rhythm: straight 16ths, half-time cabinet knock on beat 3, faucet drips every third sixteenth. Low end: FM bass on each root with a semitone slide into every new bar. Harmony: Fm11, Dbmaj9#11, Bbm9 (all F Aeolian), then the surprise. Surprise: bar 4 switches on an Emaj9 voiced an octave higher - the leading-tone chord a semitone below F - with the motif re-sung in E Lydian; the bass climbs E->F into the loop. Loop: the light switches off on the downbeat.',
  bpm: 96, timeSignature: '4/4', key: 'F minor', grid: { den: 4, stepTicks: straight16 },
  master: { gainDb: 0, effects: [{ type: 'highpass', frequencyHz: 28 }, { type: 'compressor', thresholdDb: -15, ratio: 2, attackMs: 10, releaseMs: 150, makeupGainDb: 1 }] },
  tracks: [
    { id: 'bell', description: 'Three-beat motif at beats 0, 3, 6 and 9 of the loop; bar 4 answers in E Lydian (D#-B-G#-A#, C# pickup), doubled an octave up (playbackRate 2) as the glint of the light.',
      kit: 'assets/bell/kit.json', mix: { gainDb: -7, pan: 0.1 },
      effects: [{ type: 'delay', timeMs: 468.75, wet: 0.3 }, { type: 'reverb', roomSize: 0.65, decaySeconds: 2.2, wet: 0.25 }],
      events: [0, 3, 6, 9].flatMap(motif).concat(lightPhrase).map(([b, p, v]) => atBeat(b, p, v))
        .concat(lightPhrase.map(([b, p, v]) => atBeat(b, p, Number((v * 0.7).toFixed(3)), { rate: 2 }))),
      button: [[0, 'C6', 0, 0.85]] },
    { id: 'keys', description: 'Rootless FM electric-piano voicings on 1 and 3-and; the Emaj9 is held and lifted an octave.',
      kit: 'assets/keys/kit.json', env: { attackSeconds: 0.002, releaseSeconds: 0.35 }, choke: 'keys',
      mix: { gainDb: -5 },
      effects: [{ type: 'highpass', frequencyHz: 150 }, { type: 'reverb', roomSize: 0.55, decaySeconds: 1.6, wet: 0.22 }],
      events: perBar([['fm11'], ['dbmaj9s11'], ['bbm9']].map(([c]) => [[0, c, 5, 0.8], [10, c, 3, 0.55]]).concat([[[0, 'emaj9', 12, 0.85]]])),
      button: [[0, 'fm11', 16, 0.8]] },
    { id: 'bass', description: 'Root, octave pop, root on 3-and, then a semitone slide into the next root (from above; from below into the loop).',
      kit: 'assets/bass/kit.json', env: { attackSeconds: 0.002, releaseSeconds: 0.03 }, choke: 'bass',
      mix: { gainDb: -2 },
      effects: [{ type: 'highpass', frequencyHz: 30 }, { type: 'saturation', driveDb: 5, mix: 0.3 }, { type: 'compressor', thresholdDb: -15, ratio: 3, attackMs: 6, releaseMs: 120, makeupGainDb: 1.5 }],
      events: fridgeBass, button: [[0, 'F1', 12, 1.0]] },
    { id: 'bass-grit', description: 'Parallel high-passed, driven copy of the bass so the slides read on phone speakers.',
      kit: 'assets/bass/kit.json', env: { attackSeconds: 0.002, releaseSeconds: 0.03 }, choke: 'bass',
      mix: { gainDb: -8 },
      effects: [{ type: 'highpass', frequencyHz: 300 }, { type: 'saturation', driveDb: 14, mix: 0.45 }, { type: 'lowpass', frequencyHz: 2500 }],
      events: fridgeBass, button: [[0, 'F1', 12, 1.0]] },
    { id: 'kick', description: 'Soft deep kick on 1 and 3-and with the bass; one kick in the light bar.',
      kit: 'assets/drums/kit.json', mix: { gainDb: -3 },
      events: perBar([0, 1, 2].map(() => [[0, 'kick', 0, 1.0], [10, 'kick', 0, 0.8]]).concat([[[0, 'kick', 0, 0.9]]])),
      button: [[0, 'kick', 0, 0.9]] },
    { id: 'knock', description: 'Knuckles on a cabinet door, half-time on beat 3.',
      kit: 'assets/drums/kit.json', mix: { gainDb: -1 },
      effects: [{ type: 'reverb', roomSize: 0.45, decaySeconds: 0.9, wet: 0.22 }],
      events: perBar([[[8, 'knock', 0, 0.9]], [[8, 'knock', 0, 0.9], [15, 'knock', 0, 0.3]], [[8, 'knock', 0, 0.9]], [[8, 'knock', 0, 0.9]]]) },
    { id: 'shaker', description: 'Quiet 16ths, off-beat eighths accented; eighths only under the light.',
      kit: 'assets/drums/kit.json', mix: { gainDb: -11, pan: -0.35 },
      effects: [{ type: 'highpass', frequencyHz: 3000 }],
      events: perBar([shakerBar(false), shakerBar(false), shakerBar(false), shakerBar(true)]) },
    { id: 'drips', description: 'A faucet drip every third sixteenth (a second three-against-four), four tuned pitches.',
      kit: 'assets/drums/kit.json', mix: { gainDb: -5, pan: 0.35 },
      effects: [{ type: 'reverb', roomSize: 0.6, decaySeconds: 1.4, wet: 0.3 }],
      events: drips },
  ],
};

// ===================== C: LOW BATTERY CHOIR =====================
// 120 BPM in 7/8 (2+2+3). C pedal; triads C, D, Bb, Ab above it. The same Lydian motif
// (root, 3rd, #4, 5th, 3rd) is planed onto each triad. Bar 4: the battery sags.
const eighths78 = (s) => s * SIXTEENTH;
const SYL = [['ba-c5', 'da-e5', 'dee-fs5', 'da-g5', 'yah-e5'], ['ba-d5', 'da-fs5', 'dee-gs5', 'da-a5', 'yah-fs5'],
  ['ba-bb4', 'da-d5', 'dee-e5', 'da-f5', 'yah-d5'], ['ba-ab4', 'da-c5', 'dee-d5', 'da-eb5', 'yah-c5']];
const sag = { glide: [semis(-3), '3/8'] };
const bassBar = [[0, 'doom-c2', 3, 1.0], [4, 'doom-c2', 2, 0.7], [7, 'doom-c2', 1, 0.55, { rate: 2 }], [8, 'doom-g1', 2, 0.9], [11, 'doom-bb1', 2, 0.8]];
const kitchenShaker = (b) => Array.from({ length: b === 3 ? 8 : 14 }, (_, s) => [s, 'shaker', 0,
  Number(((s % 4 === 0 ? 0.55 : s % 2 === 0 ? 0.35 : 0.2) * (b === 3 ? 1 - s / 10 : 1)).toFixed(3))]);
const LOW_BATTERY_CHOIR = {
  slug: 'low-battery-choir', dir: 'c-low-battery-choir', title: 'THING//MANIA audition C: LOW BATTERY CHOIR',
  description: 'Wildcard: a choir of singing appliances in 7/8. Thesis - hook: a synthetic voice chants "ba-da-DEE-da-YAAH" (root, 3rd, raised 4th, 5th, 3rd); the raised 4th is the mischief. The identical Lydian shape is planed onto C, D, Bb and Ab triads over a C pedal, so one object visits four rooms. Rhythm: 7/8 grouped 2+2+3, cardboard-box kick, spoon-on-pot-lid snare, rice shaker. Low end: a vocal "doom" bass with a squeaky octave pop. Surprise: in bar 4 the battery dies - lead, choir and bass sag three semitones together while the shaker winds down - and a kitchen-timer ding restores power on the loop downbeat.',
  bpm: 120, timeSignature: '7/8', key: 'C major', grid: { den: 8, stepTicks: eighths78 },
  master: { gainDb: -2.5, effects: [{ type: 'highpass', frequencyHz: 30 }, { type: 'compressor', thresholdDb: -16, ratio: 2, attackMs: 8, releaseMs: 120, makeupGainDb: 1 }] },
  tracks: [
    { id: 'lead', description: 'The chant, one syllable per eighth and a held "yaah"; in bar 4 the held note sags three semitones.',
      kit: 'assets/lead/kit.json', env: { attackSeconds: 0.002, releaseSeconds: 0.04 }, choke: 'lead',
      mix: { gainDb: -2 },
      effects: [{ type: 'highpass', frequencyHz: 180 }, { type: 'saturation', driveDb: 3, mix: 0.2 }, { type: 'delay', timeMs: 250, wet: 0.12 }, { type: 'reverb', roomSize: 0.4, decaySeconds: 1.0, wet: 0.16 }],
      events: perBar(SYL.map(([ba, da1, dee, da2, yah], b) => [[0, ba, 2, 0.85, { short: 40 }], [2, da1, 2, 0.7, { short: 40 }], [4, dee, 2, 0.95, { short: 40 }], [6, da2, 2, 0.72, { short: 40 }], [8, yah, 5, 0.9, b === 3 ? sag : {}]])),
      button: [[0, 'yah-e5', 10, 0.85]] },
    { id: 'choir', description: '"ooh" on the 2+2, "oh-aah" on the 3; Ab chord sags with the lead.',
      kit: 'assets/choir/kit.json', env: { attackSeconds: 0.03, releaseSeconds: 0.09 },
      mix: { gainDb: -5 },
      effects: [{ type: 'highpass', frequencyHz: 150 }, { type: 'reverb', roomSize: 0.6, decaySeconds: 1.6, wet: 0.3 }],
      events: perBar(['c', 'd', 'bb', 'ab'].map((c, b) => [[0, `ooh-${c}`, 8, 0.7], [8, `aah-${c}`, 5, 0.85, b === 3 ? sag : {}]])),
      button: [[0, 'aah-c', 10, 0.85]] },
    { id: 'bass', description: 'Vocal "doom" pedal on C with G and Bb answers and a squeaky octave pop; bar 4 drops to Ab and sags.',
      kit: 'assets/bass/kit.json', env: { attackSeconds: 0.003, releaseSeconds: 0.03 }, choke: 'bass',
      mix: { gainDb: -2 },
      effects: [{ type: 'highpass', frequencyHz: 35 }, { type: 'saturation', driveDb: 10, mix: 0.5 }, { type: 'compressor', thresholdDb: -16, ratio: 3, attackMs: 5, releaseMs: 100, makeupGainDb: 2 }],
      events: perBar([bassBar, bassBar, bassBar, [[0, 'doom-c2', 3, 1.0], [4, 'doom-c2', 2, 0.7], [8, 'doom-ab1', 6, 0.95, sag]]]),
      button: [[0, 'doom-c2', 8, 1.0]] },
    { id: 'box', description: 'Cardboard-box kick on the 1 and the start of the 3-group.',
      kit: 'assets/kitchen/kit.json', mix: { gainDb: -3 },
      events: perBar([0, 1, 2].map(() => [[0, 'box', 0, 1.0], [8, 'box', 0, 0.85]]).concat([[[0, 'box', 0, 1.0], [8, 'box', 0, 0.7]]])),
      button: [[0, 'box', 0, 1.0]] },
    { id: 'lid', description: 'Spoon on a pot lid on the second 2-group and the last eighth; the ding replaces it in bar 4.',
      kit: 'assets/kitchen/kit.json', mix: { gainDb: -6, pan: -0.2 },
      effects: [{ type: 'reverb', roomSize: 0.3, decaySeconds: 0.5, wet: 0.1 }],
      events: perBar([0, 1, 2].map(() => [[4, 'lid', 0, 0.85], [12, 'lid', 0, 0.7]]).concat([[[4, 'lid', 0, 0.85]]])) },
    { id: 'shaker', description: 'Rice-jar 16ths accenting 2+2+3; winds down as the battery dies.',
      kit: 'assets/kitchen/kit.json', mix: { gainDb: -10, pan: 0.3 },
      events: perBar([0, 1, 2, 3].map(kitchenShaker)) },
    { id: 'ding', description: 'Kitchen-timer ding on the last eighth of bar 4: power restored.',
      kit: 'assets/kitchen/kit.json', mix: { gainDb: -10, pan: 0.15 },
      effects: [{ type: 'reverb', roomSize: 0.5, decaySeconds: 1.2, wet: 0.25 }],
      events: [[4, 12, 'ding', 0, 0.8]],
      button: [[0, 'ding', 0, 0.7]] },
  ],
};

const only = process.argv[2];
for (const song of [SOCK_SLIDE, FRIDGE_LIGHT, LOW_BATTERY_CHOIR]) {
  if (only && only !== song.dir) continue;
  const { loop, x4 } = projects(song);
  writeFileSync(join(ROOT, song.dir, `${song.slug}.json`), fmt(loop) + '\n');
  writeFileSync(join(ROOT, song.dir, `${song.slug}-x4.json`), fmt(x4) + '\n');
  console.log(`${song.dir}: ${song.slug}.json, ${song.slug}-x4.json (${loop.tracks.reduce((s, t) => s + t.patterns[0].notes.length, 0)} events)`);
}
