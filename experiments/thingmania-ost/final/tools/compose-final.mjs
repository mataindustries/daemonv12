#!/usr/bin/env node
// Writes the DaemonV12 projects for the THING//MANIA official soundtrack:
//   main-theme.json          16-bar main game theme loop (render.duration = 16 bars = 36.2 s, tail none)
//   menu-mix.json            16-bar lighter arrangement on the same harmonic map (bar-synchronous with the theme)
//   demo-mix.json            18 bars + a decay bar: cold open, theme, payoff and a real ending (non-looping)
//   <slug>-x3.json           loop-extraction renders: the loop at bars 1, 17 and 33, then a closing downbeat
// The JSON files are the canonical, editable projects; this script is how they were authored.
// Editing a JSON by hand is fine, but rerunning this script overwrites it.
//
// Source: hybrid-ac/ AC-01 GROOVE FIRST, approved by the listener. Its sounds, swing, mix,
// master and gestures are carried over unchanged (the helpers below are copied from
// hybrid-ac/tools/compose-ac.mjs). 106.0773 BPM (96000/905): one quarter is exactly 565,625 us,
// so 16 bars are exactly 36.2 s = 1,596,420 frames and every loop repeat lands on the same frame.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { semis } from '../../tools/dsp.mjs';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const frac = (ticks) => { const g = gcd(ticks, 3840); return `${ticks / g}/${3840 / g}`; };
const SIXTEENTH = 240;
const BEAT_SECONDS = 0.565625;

// A's swing: tick offset of each sixteenth inside a quarter-note beat (272/240, about 57%).
const swing16 = (s) => Math.floor(s / 4) * 960 + [0, 272, 480, 752][s % 4];
const pos = (bar, step) => {
  const ticks = swing16(step), beat = Math.floor(ticks / 960) + 1, off = ticks % 960;
  return off ? `${bar}:${beat}+${frac(off)}` : `${bar}:${beat}`;
};

// Event: [bar, step, pitch, len16, velocity, options]. len16 = gate in straight sixteenths
// (0 = no gate). Options: rate, glide [to, duration], short (ticks off the gate), env (per-note
// envelope), offset (offsetSeconds into the source).
function notes(events, { env, choke } = {}) {
  return events.map(([bar, step, pitch, len, vel, o = {}]) => {
    const n = { start: pos(bar, step), pitch, velocity: vel };
    if (o.rate) n.playbackRate = o.rate;
    if (o.offset) n.offsetSeconds = o.offset;
    if (o.glide) n.glide = { to: o.glide[0], duration: o.glide[1] };
    if (len) n.gate = frac(len * SIXTEENTH - (o.short ?? 0));
    const e = o.env ?? env;
    if (e && (len || choke)) n.envelope = e;
    if (choke) n.chokeGroup = choke;
    return n;
  });
}
const perBar = (bars) => bars.flatMap((evs, b) => (evs ?? []).map((e) => [b + 1, ...e]));

// One note/clip/effect per line, as in the repository examples.
function fmt(v, ind = '') {
  const one = JSON.stringify(v);
  if (v === null || typeof v !== 'object' || (!Array.isArray(v) && 'start' in v) || one.length <= 90) return one;
  const ni = ind + '  ';
  if (Array.isArray(v)) return `[\n${v.map((x) => ni + fmt(x, ni)).join(',\n')}\n${ind}]`;
  return `{\n${Object.entries(v).map(([k, x]) => `${ni}${JSON.stringify(k)}: ${fmt(x, ni)}`).join(',\n')}\n${ind}}`;
}

// ===================== AC-01 MATERIAL (unchanged) =====================
const pop = { rate: 2, short: 40 };
const bend = { glide: [semis(1), '1/32'] };
const RIFF = [[0, 'E1', 2, 1.0], [3, 'E1', 1, 0.8, pop], [5, 'D2', 1, 0.85], [6, 'B1', 1, 0.85],
  [9, 'G1', 1, 0.6], [10, 'A1', 2, 0.9], [12, 'Bb1', 2, 0.95, bend], [15, 'E1', 1, 0.75]];
const WALK = [[0, 'E1', 3, 1.0], [3, 'E1', 1, 0.7, pop], [6, 'E1', 1, 0.5], [7, 'G1', 1, 0.8], [8, 'A1', 1, 0.85],
  [10, 'B1', 2, 0.85], [14, 'D2', 1, 0.8], [15, 'Eb2', 1, 0.85]];
const RIFF_HEAD = RIFF.slice(0, 4);
// AC-01 bar 6: stop-time. The walk freezes after G1; nothing on beat 3; back in on the bend.
const STOP = [...WALK.slice(0, 4), [12, 'Bb1', 2, 0.95, bend], [14, 'D2', 1, 0.8], [15, 'Eb2', 1, 0.85]];
// AC-01 bar 8: A's slip to F, sliding home a semitone into the downbeat.
const SLIP = [...RIFF_HEAD, [8, 'F1', 3, 1.0], [11, 'F1', 1, 0.8, pop], [13, 'Eb2', 1, 0.8], [14, 'F1', 2, 0.95, { glide: [semis(-1), '1/8'] }]];

const swoop = { rate: semis(-2), glide: [1, '1/32'] };
const HOOK = [[0, 'E6', 3, 0.95, swoop], [3, 'D6', 1, 0.72], [5, 'B5', 1, 0.72], [6, 'C#6', 2, 0.85]];
const HOOK_CLIPPED = [...HOOK.slice(0, 3), [6, 'C#6', 2, 0.85, { short: 120 }]];
const PICKUP = [[13, 'B5', 1, 0.7], [14, 'D6', 2, 0.8]];
const LONG = [8, 'B5', 4, 0.85];
const LONG_BENT = [8, 'B5', 4, 0.85, { rate: semis(-1), glide: [1, '1/16'] }];

const CLAV_A = [[6, 'em9', 1, 0.75], [11, 'chk', 1, 0.45], [14, 'em9', 1, 0.6]];
const KICK = [[0, 'kick', 0, 1.0], [10, 'kick', 0, 0.85]];
const KICK_WALK = [...KICK, [13, 'kick', 0, 0.55]];
const SNARE = [[4, 'snare', 0, 0.95], [7, 'snare', 0, 0.22], [9, 'snare', 0, 0.18], [12, 'snare', 0, 0.95], [14, 'snare', 0, 0.22]];
const hatsBar = (open, keep = () => true) => Array.from({ length: 16 }, (_, s) => (open && s === 14 ? [s, 'hat-o', 0, 0.55]
  : [s, 'hat-c', 0, s % 4 === 0 ? 0.5 : s % 4 === 2 ? 0.72 : 0.32])).filter(([s]) => keep(s));
const H = (open) => hatsBar(open);
const HATS_HALF = hatsBar(false, (s) => s < 8);

// The appliance tag: ba (E) da (G) DEE (A#, the raised 4th) on beats 3, 3-and and 4, the DEE
// riding the bass's Bb->B bend three octaves up. The kettle sings it a fourth below.
const TAG_BEND = [[8, 'ba-e4', 2, 0.85, { short: 60 }], [10, 'da-g4', 2, 0.75, { short: 60 }], [12, 'dee-as4', 2, 0.95, bend]];
const KETTLE_BEND = [[8, 'ba-b3', 2, 0.7, { short: 60 }], [10, 'da-d4', 2, 0.65, { short: 60 }], [12, 'dee-f4', 2, 0.85, bend]];
const TAG_DOUBLE = [[8, 'ba-e4', 1, 0.8, { short: 30 }], [9, 'da-g4', 1, 0.75, { short: 20 }], [10, 'dee-as4', 2, 0.95, { short: 40 }], [12, 'yah-b4', 2, 0.95]];
const STAB = { env: { attackSeconds: 0.002, releaseSeconds: 0.05 } };
const SAG = [[8, 'aah-slip', 0, 0.85, { env: { attackSeconds: 0.03, releaseSeconds: 0.015 } }],
  [12, 'aah-slip', 5, 0.85, { offset: BEAT_SECONDS, glide: [semis(-1), '1/4'], env: { attackSeconds: 0.015, releaseSeconds: 0.12 } }]];

// ===================== NEW MATERIAL: the development (bars 9-12) =====================
// Harmony i -> IV -> bVI -> bVII -> i (Em9 | A13 | Cmaj9 | D6/9 | Em9). The riff keeps its shape
// and its signature bend in every key: the raised 4th always bends up into the 5th
// (A: D#->E, C: F#->G, D: G#->A), so the bend climbs E, G, A before the hook returns on E.
const A_RIFF = [[0, 'A1', 2, 1.0], [3, 'A1', 1, 0.8, pop], [5, 'G2', 1, 0.85], [6, 'E2', 1, 0.85],
  [9, 'C2', 1, 0.45], [10, 'D2', 2, 0.9], [12, 'Eb2', 2, 0.95, bend], [15, 'A1', 1, 0.75]];
const A_WALK = [[0, 'A1', 3, 1.0], [3, 'A1', 1, 0.7, pop], [6, 'A1', 1, 0.5], [7, 'C2', 1, 0.8], [8, 'D2', 1, 0.85],
  [10, 'E2', 2, 0.85], [14, 'A1', 1, 0.8], [15, 'B1', 1, 0.85]];
// bVI and bVII: the whole band hits 3+3+2 (steps 0, 3, 6) with the bass, then the riff's back half.
const C_HITS = [[0, 'C2', 2, 1.0], [3, 'C2', 1, 0.75, pop], [6, 'C2', 2, 0.9], [9, 'Eb2', 1, 0.45], [10, 'F2', 2, 0.9], [12, 'F#2', 2, 0.95, bend], [15, 'C2', 1, 0.75]];
const D_HITS = [[0, 'D2', 2, 1.0], [3, 'D2', 1, 0.75, pop], [6, 'D2', 2, 0.9], [9, 'F2', 1, 0.45], [10, 'G2', 2, 0.9], [12, 'G#2', 2, 0.95, bend], [14, 'D2', 1, 0.8], [15, 'Eb2', 1, 0.85]];
const A_TAG = [[8, 'ba-a4', 2, 0.85, { short: 60 }], [10, 'da-cs5', 2, 0.75, { short: 60 }], [12, 'dee-ds5', 2, 0.95, bend]];
// Role reversal: the whistle copies the toaster's A tag (A5 C#6 D#6->E6).
const WHISTLE_TAG_A = [[8, 'A5', 2, 0.8, { short: 60 }], [10, 'C#6', 2, 0.75, { short: 60 }], [12, 'D#6', 3, 0.9, bend]];
const HITS = (chord, vel = 0.85) => [[0, chord, 1, vel], [3, chord, 1, vel - 0.05], [6, chord, 1, vel]];
const CHOIR_HITS = (chord) => [[0, chord, 2, 0.85, STAB], [3, chord, 2, 0.75, STAB], [6, chord, 2, 0.85, STAB]];
const KICK_HITS = [[0, 'kick', 0, 1.0], [3, 'kick', 0, 0.6], [6, 'kick', 0, 0.85], [10, 'kick', 0, 0.8]];
// Bar 12: the snare rolls in on beats 3-4 while the kettle comes to the boil.
const SNARE_ROLL = [[4, 'snare', 0, 0.95], [7, 'snare', 0, 0.22], [8, 'snare', 0, 0.3], [9, 'snare', 0, 0.36], [10, 'snare', 0, 0.44],
  [11, 'snare', 0, 0.52], [12, 'snare', 0, 0.95], [13, 'snare', 0, 0.6], [14, 'snare', 0, 0.72], [15, 'snare', 0, 0.85]];
const BOIL = [[8, 'boil', 7, 0.6, { glide: [2, '7/16'] }]];
const SHAKER = Array.from({ length: 16 }, (_, s) => [s, 'shaker', 0, s % 4 === 2 ? 0.6 : s % 4 === 0 ? 0.4 : 0.22]);
const SHAKER_LID = [...SHAKER, [4, 'lid', 0, 0.5], [12, 'lid', 0, 0.5]];

// ===================== NEW MATERIAL: the hook return (bars 13-16) =====================
// Two whistlers: the hook with a second whistle a sixth below (G5 F#5 D5 E5 | D5).
const HOOK_SIXTHS = [[0, 'G5', 3, 0.85, swoop], [3, 'F#5', 1, 0.65], [5, 'D5', 1, 0.65], [6, 'E5', 2, 0.75]];
const HOOK_SIXTHS_CLIPPED = [...HOOK_SIXTHS.slice(0, 3), [6, 'E5', 2, 0.75, { short: 120 }]];
// Everybody bends: whistle A#5->B5 with the toaster, the kettle and the bass on beat 4.
const WHISTLE_BEND = [[12, 'B5', 2, 0.85, { rate: semis(-1), glide: [1, '1/32'] }]];
// The toaster steals the hook's long note: "YAAAH" on B4.
const YAH_STEAL = [[8, 'yah-b4', 6, 0.9, { short: 40 }]];

// ===================== TRACKS (AC-01's sounds, mix and processing) =====================
const BASS_FX = [{ type: 'highpass', frequencyHz: 32 }, { type: 'compressor', thresholdDb: -16, ratio: 3, attackMs: 4, releaseMs: 90, makeupGainDb: 1 }, { type: 'saturation', driveDb: 6, mix: 0.35 }];
const GRIT_FX = [{ type: 'highpass', frequencyHz: 350 }, { type: 'saturation', driveDb: 18, mix: 0.5 }, { type: 'lowpass', frequencyHz: 4000 }];
const BASS_ENV = { attackSeconds: 0.001, releaseSeconds: 0.02 };
const WHISTLE_ENV = { attackSeconds: 0.004, releaseSeconds: 0.06 };
const WHISTLE_FX = [{ type: 'highpass', frequencyHz: 400 }, { type: 'delay', timeMs: 424.5, wet: 0.14 }, { type: 'reverb', roomSize: 0.4, decaySeconds: 1.0, wet: 0.18 }];
const WHISTLE_DRY_FX = [{ type: 'highpass', frequencyHz: 400 }, { type: 'reverb', roomSize: 0.4, decaySeconds: 1.0, wet: 0.18 }];
const VOICE_FX = [{ type: 'highpass', frequencyHz: 160 }, { type: 'saturation', driveDb: 3, mix: 0.2 },
  { type: 'delay', timeMs: 282.8, wet: 0.1 }, { type: 'reverb', roomSize: 0.4, decaySeconds: 1.0, wet: 0.16 }];
const KETTLE_FX = [{ type: 'highpass', frequencyHz: 200 }, { type: 'delay', timeMs: 424.2, wet: 0.12 }, { type: 'reverb', roomSize: 0.4, decaySeconds: 1.0, wet: 0.18 }];
const CHOIR_FX = [{ type: 'highpass', frequencyHz: 150 }, { type: 'reverb', roomSize: 0.6, decaySeconds: 1.6, wet: 0.28 }];
const CRUNCH_FX = [{ type: 'highpass', frequencyHz: 140 }, { type: 'saturation', driveDb: 20, mix: 0.8 }, { type: 'lowpass', frequencyHz: 6500 },
  { type: 'compressor', thresholdDb: -20, ratio: 4, attackMs: 3, releaseMs: 80, makeupGainDb: 0 }];
const MASTER = { gainDb: -3.3, effects: [{ type: 'highpass', frequencyHz: 28 }, { type: 'compressor', thresholdDb: -16, ratio: 2, attackMs: 8, releaseMs: 120, makeupGainDb: 1 }] };

const DEFS = {
  bass: { description: "A's squelch bass riff (AC-01's sound, choke and processing).", kit: 'bass', env: BASS_ENV, choke: 'bass', mix: { gainDb: 0 }, effects: BASS_FX },
  'bass-grit': { description: 'Parallel high-passed, driven copy of the bass so the riff carries on phone speakers.', kit: 'bass', env: BASS_ENV, choke: 'bass', mix: { gainDb: -8 }, effects: GRIT_FX },
  whistle: { description: "A's whistle: hook, pickups and bends, with its dotted-eighth echo.", kit: 'whistle', env: WHISTLE_ENV, choke: 'lead', mix: { gainDb: -8, pan: 0.3 }, effects: WHISTLE_FX },
  'whistle-dry': { description: 'The same whistle without the echo, for phrases that hand straight over to an appliance or a hit.', kit: 'whistle', env: WHISTLE_ENV, choke: 'lead', mix: { gainDb: -8, pan: 0.3 }, effects: WHISTLE_DRY_FX },
  'whistle-harmony': { description: 'A second whistler a sixth under the hook in the return (bars 13 and 15), opposite the lead.', kit: 'whistle', env: WHISTLE_ENV, choke: 'lead2', mix: { gainDb: -13, pan: -0.35 }, effects: WHISTLE_DRY_FX },
  clav: { description: 'Rootless clav stabs on the swung off-beats; they step aside whenever an appliance sings.', kit: 'clav', env: { attackSeconds: 0.001, releaseSeconds: 0.03 }, choke: 'clav', mix: { gainDb: -4.5, pan: -0.6 },
    effects: [{ type: 'highpass', frequencyHz: 200 }, { type: 'reverb', roomSize: 0.25, decaySeconds: 0.4, wet: 0.08 }] },
  hum: { description: 'The appliance choir humming the harmony on "oo" (menu only): one pad per bar.', kit: 'hum', env: { attackSeconds: 0.12, releaseSeconds: 0.3 }, mix: { gainDb: -9 },
    effects: [{ type: 'highpass', frequencyHz: 150 }, { type: 'lowpass', frequencyHz: 2500 }, { type: 'reverb', roomSize: 0.6, decaySeconds: 1.6, wet: 0.25 }] },
  kick: { description: "A's kick, locked to the bass.", kit: 'drums', mix: { gainDb: -3 } },
  snare: { description: "A's backbeat with ghost notes.", kit: 'drums', mix: { gainDb: -4, pan: 0.05 }, effects: [{ type: 'reverb', roomSize: 0.3, decaySeconds: 0.6, wet: 0.12 }] },
  'drum-crunch': { description: 'Parallel crunch bus: the kick and snare hits again, high-passed and driven hard so the kit reads on phones.', kit: 'drums', mix: { gainDb: -13 }, effects: CRUNCH_FX },
  hats: { description: 'Swung 16ths accenting the off-beat eighths; open hat on 4-and, choked by the next closed hat.', kit: 'drums', choke: 'hat', env: { attackSeconds: 0.0005, releaseSeconds: 0.01 }, mix: { gainDb: -9.5, pan: 0.55 } },
  kitchen: { description: "C's rice-jar shaker opposite the hats from the development on, and spoon-on-pot-lid on the backbeat in the hook return.", kit: 'kitchen', mix: { gainDb: -11, pan: -0.55 } },
  voice: { description: 'The lead appliance (toaster): the ba-da-DEE tag riding the bass bend.', kit: 'voice', env: { attackSeconds: 0.002, releaseSeconds: 0.04 }, choke: 'lead-voice', mix: { gainDb: -6, pan: -0.35 }, effects: VOICE_FX },
  kettle: { description: 'The kettle: the tag a fourth below the toaster.', kit: 'kettle', env: { attackSeconds: 0.002, releaseSeconds: 0.04 }, choke: 'kettle', mix: { gainDb: -9.5, pan: 0.65 }, effects: KETTLE_FX },
  choir: { description: 'Close-harmony appliance choir: hits, the return chord and the battery sag.', kit: 'choir', env: { attackSeconds: 0.03, releaseSeconds: 0.09 }, choke: 'choir', mix: { gainDb: -5 }, effects: CHOIR_FX },
  fx: { description: 'Kitchen FX: the E7 timer ding (power restored) and the kettle coming to the boil.', kit: 'fx', env: { attackSeconds: 0.01, releaseSeconds: 0.08 }, mix: { gainDb: -11, pan: 0.5 },
    effects: [{ type: 'reverb', roomSize: 0.5, decaySeconds: 1.2, wet: 0.25 }] },
};
const ORDER = ['bass', 'bass-grit', 'whistle', 'whistle-dry', 'whistle-harmony', 'clav', 'hum', 'kick', 'snare', 'drum-crunch', 'hats', 'kitchen', 'voice', 'kettle', 'choir', 'fx'];

// The closing downbeat of the x3 listening/extraction copies (AC-01's button).
const BUTTON = {
  bass: [[0, 'E1', 8, 1.0]], 'bass-grit': [[0, 'E1', 8, 1.0]], whistle: [[0, 'E6', 8, 0.85, swoop]], clav: [[0, 'em9', 4, 0.8]],
  hum: [[0, 'hum-em9', 16, 0.7]], kick: [[0, 'kick', 0, 1.0]], 'drum-crunch': [[0, 'kick', 0, 1.0]], hats: [[0, 'hat-o', 0, 0.55]], fx: [[0, 'ding', 0, 0.8]],
};

// ===================== DELIVERABLE 1: MAIN THEME (16 bars, 36.2 s) =====================
// 1-4 establish: riff + whistle hook; the whistle catches the bass bend in bar 4.
// 5-8 the appliances: the toaster answers on the bend; the whistle calls (bent); toaster and
//     kettle in fourths; AC-01's stop-time with the tag at double speed in the hole.
// 9-12 development: i -> IV (A13: the toaster sings the tag in A, the whistle copies it back),
//     then bVI and bVII band hits in 3+3+2 with choir "da" stabs, a snare roll and the kettle boiling.
// 13-16 return: the hook on E with a second whistler and the choir; everyone bends together;
//     the toaster steals the long note; AC-01's F13 slip and the battery sag into the loop.
const MAIN = {
  bass: [RIFF, WALK, RIFF, WALK, RIFF, WALK, RIFF, STOP, A_RIFF, A_WALK, C_HITS, D_HITS, WALK, RIFF, WALK, SLIP],
  whistle: [PICKUP, [...HOOK, LONG], PICKUP, [...HOOK, LONG_BENT], null, [...HOOK, LONG_BENT], null, null,
    null, null, null, null, [...HOOK, LONG], WHISTLE_BEND, null, null],
  'whistle-dry': [null, null, null, null, null, null, null, HOOK_CLIPPED, null, WHISTLE_TAG_A, null, null, null, null, HOOK_CLIPPED, HOOK_CLIPPED],
  'whistle-harmony': [null, null, null, null, null, null, null, null, null, null, null, null, [...HOOK_SIXTHS, [8, 'D5', 4, 0.75]], null, HOOK_SIXTHS_CLIPPED, null],
  clav: [[[0, 'em9', 1, 0.7], ...CLAV_A], CLAV_A, CLAV_A, CLAV_A, [[6, 'em9', 1, 0.75]], CLAV_A, [[6, 'em9', 1, 0.75]], [[6, 'em9', 1, 0.75], [14, 'em9', 1, 0.6]],
    [[6, 'a13', 1, 0.75]], [[6, 'a13', 1, 0.75], [11, 'chk', 1, 0.45], [14, 'a13', 1, 0.6]], HITS('cmaj9'), HITS('d69'),
    [[0, 'em9', 1, 0.75], ...CLAV_A], [[6, 'em9', 1, 0.75]], [[6, 'em9', 1, 0.75], [14, 'em9', 1, 0.6]], [[6, 'em9', 1, 0.75], [8, 'f13', 3, 0.9]]],
  hum: Array(16).fill(null),
  kick: [KICK, KICK_WALK, KICK, KICK_WALK, KICK, KICK_WALK, KICK, [[0, 'kick', 0, 1.0], [12, 'kick', 0, 0.95]],
    KICK, KICK_WALK, KICK_HITS, KICK_HITS, KICK_WALK, KICK, KICK_WALK, [[0, 'kick', 0, 1.0], [6, 'kick', 0, 0.75]]],
  snare: [SNARE, SNARE, SNARE, SNARE, SNARE, SNARE, SNARE, [[4, 'snare', 0, 0.95], [7, 'snare', 0, 0.22], [12, 'snare', 0, 1.0], [14, 'snare', 0, 0.22]],
    SNARE, SNARE, SNARE, SNARE_ROLL, SNARE, SNARE, SNARE, [[4, 'snare', 0, 0.95], [7, 'snare', 0, 0.22], [15, 'snare', 0, 0.45]]],
  hats: [H(true), H(false), H(true), H(false), H(true), H(false), H(true), hatsBar(false, (s) => s < 8 || s >= 12),
    H(true), H(false), H(true), HATS_HALF, H(true), H(false), H(true), HATS_HALF],
  kitchen: [null, null, null, null, null, null, null, null, SHAKER, SHAKER, SHAKER, SHAKER, SHAKER_LID, SHAKER_LID, SHAKER_LID, null],
  voice: [null, null, null, null, TAG_BEND, null, TAG_BEND, TAG_DOUBLE, A_TAG, null, null, null, null, TAG_BEND, YAH_STEAL, null],
  kettle: [null, null, null, null, null, null, KETTLE_BEND, null, null, null, null, null, null, KETTLE_BEND, null, null],
  choir: [null, null, null, null, null, null, null, null, null, null, CHOIR_HITS('dat-c'), CHOIR_HITS('dat-d'),
    [[0, 'aah-em', 8, 0.7]], null, null, SAG],
  fx: [[[0, 'ding', 0, 0.8]], null, null, null, null, null, null, null, null, null, null, BOIL, null, null, null, null],
};
MAIN['bass-grit'] = MAIN.bass;
// Crunch = the kick and snare hits of the same bar (only the backbeat of the bar-12 roll).
MAIN['drum-crunch'] = MAIN.kick.map((k, b) => [...(k ?? []), ...(MAIN.snare[b] === SNARE_ROLL ? [[4, 'snare', 0, 0.95], [12, 'snare', 0, 0.95]] : MAIN.snare[b] ?? [])]);

// ===================== DELIVERABLE 2: MENU MIX (16 bars, same harmonic map) =====================
// Same form, bass and chords as the theme, so the game can switch between them on any bar.
// Lighter: no clav, crunch, kitchen percussion or band hits; the appliance choir hums the
// harmony instead; a soft kick, a quiet backbeat without ghosts and off-beat eighth hats.
// The hook appears in bars 2, 6 and 13; the appliances answer three times; the sag stays.
const MKICK = [[0, 'kick', 0, 0.8], [10, 'kick', 0, 0.65]], MKICK_WALK = [...MKICK, [13, 'kick', 0, 0.42]];
const MSNARE = [[4, 'snare', 0, 0.38], [12, 'snare', 0, 0.38]];
const MHATS = [2, 6, 10, 14].map((s) => [s, 'hat-c', 0, 0.5]);
const pad = (name) => [[0, name, 16, 0.7]];
const MENU = {
  bass: [RIFF, WALK, RIFF, WALK, RIFF, WALK, RIFF, WALK, A_RIFF, A_WALK, C_HITS, D_HITS, WALK, RIFF, WALK, SLIP],
  whistle: [PICKUP, [...HOOK, LONG], null, null, null, [...HOOK, LONG_BENT], null, null, null, null, null, PICKUP, [...HOOK, LONG], null, null, null],
  'whistle-dry': [null, null, null, null, null, null, null, null, null, WHISTLE_TAG_A, null, null, null, null, null, HOOK_CLIPPED],
  hum: [...Array(8).fill(pad('hum-em9')), pad('hum-a13'), pad('hum-a13'), pad('hum-c'), pad('hum-d'), pad('hum-em9'), pad('hum-em9'), pad('hum-em9'), [[0, 'hum-em9', 8, 0.7]]],
  kick: [MKICK, MKICK_WALK, MKICK, MKICK_WALK, MKICK, MKICK_WALK, MKICK, MKICK_WALK, MKICK, MKICK_WALK, MKICK, MKICK, MKICK_WALK, MKICK, MKICK_WALK, [[0, 'kick', 0, 0.8], [6, 'kick', 0, 0.6]]],
  snare: [...Array(15).fill(MSNARE), [[4, 'snare', 0, 0.38]]],
  hats: [...Array(15).fill(MHATS), MHATS.slice(0, 2)],
  voice: [null, null, null, null, TAG_BEND, null, null, null, A_TAG, null, null, null, null, TAG_BEND, null, null],
  kettle: [null, null, null, null, null, null, null, null, null, null, null, null, null, KETTLE_BEND, null, null],
  choir: [...Array(15).fill(null), SAG],
  fx: [[[0, 'ding', 0, 0.55]], ...Array(15).fill(null)],
};
MENU['bass-grit'] = MENU.bass;
const MENU_DEFS = {
  ...DEFS,
  // The grit is the loudest thing in 2-6 kHz once the drums are light: a lower low-pass keeps the
  // 350 Hz-2 kHz harmonics phones need and clears the band where UI clicks live.
  'bass-grit': { ...DEFS['bass-grit'], description: 'Parallel driven copy of the bass for phone speakers, low-passed at 2.2 kHz to keep 2-6 kHz free for UI sounds.',
    mix: { gainDb: -8 }, effects: [{ type: 'highpass', frequencyHz: 350 }, { type: 'saturation', driveDb: 18, mix: 0.5 }, { type: 'lowpass', frequencyHz: 2200 }] },
  kick: { ...DEFS.kick, mix: { gainDb: -5 } },
  snare: { ...DEFS.snare, description: 'A quiet backbeat on 2 and 4, no ghost notes.' },
  hats: { ...DEFS.hats, description: 'Off-beat eighths only, closed.', mix: { gainDb: -12, pan: 0.55 } },
  voice: { ...DEFS.voice, mix: { gainDb: -8, pan: -0.35 } },
  kettle: { ...DEFS.kettle, mix: { gainDb: -11.5, pan: 0.65 } },
  whistle: { ...DEFS.whistle, mix: { gainDb: -9, pan: 0.3 } },
  'whistle-dry': { ...DEFS['whistle-dry'], mix: { gainDb: -9, pan: 0.3 } },
};

// ===================== DELIVERABLE 3: DEMO MIX (cold open, theme, real ending) =====================
// Bar 1: cold open. One full-band hit with the ding, the band drops out and the toaster sings
//        the tag at double speed into the gap; the snare picks up into the groove.
// Bars 2-17: the main theme (the ding of its bar 1 already happened in the cold open).
// Bar 18: ending. The battery sag of bar 17 lands on a final E hit: ding, whistle swoop, choir.
// Bar 19: decay only.
const INTRO = {
  bass: [[0, 'E1', 2, 1.0], [12, 'Bb1', 2, 0.95, bend], [14, 'D2', 1, 0.8], [15, 'Eb2', 1, 0.85]],
  clav: [[0, 'em9', 2, 0.85]],
  kick: [[0, 'kick', 0, 1.0], [12, 'kick', 0, 0.95]],
  snare: [[12, 'snare', 0, 1.0], [14, 'snare', 0, 0.45], [15, 'snare', 0, 0.7]],
  hats: [[0, 'hat-o', 0, 0.6], [12, 'hat-c', 0, 0.5], [13, 'hat-c', 0, 0.32], [14, 'hat-c', 0, 0.72], [15, 'hat-c', 0, 0.32]],
  voice: TAG_DOUBLE,
  choir: [[0, 'dat-em7', 2, 0.85, STAB]],
  fx: [[0, 'ding', 0, 0.8]],
};
INTRO['bass-grit'] = INTRO.bass;
INTRO['drum-crunch'] = [...INTRO.kick, [12, 'snare', 0, 1.0], [15, 'snare', 0, 0.7]];
const ENDING = {
  bass: [[0, 'E1', 8, 1.0]], 'bass-grit': [[0, 'E1', 8, 1.0]], whistle: [[0, 'E6', 8, 0.9, swoop]], 'whistle-harmony': [[0, 'G5', 8, 0.8, swoop]],
  clav: [[0, 'em9', 4, 0.85]], kick: [[0, 'kick', 0, 1.0]], snare: [[0, 'snare', 0, 0.8]], 'drum-crunch': [[0, 'kick', 0, 1.0], [0, 'snare', 0, 0.8]],
  hats: [[0, 'hat-o', 0, 0.6]], kitchen: [[0, 'lid', 0, 0.6]], choir: [[1, 'aah-em', 8, 0.65]], fx: [[0, 'ding', 0, 0.8]],
};
const DEMO = Object.fromEntries(ORDER.map((id) => {
  const theme = (MAIN[id] ?? Array(16).fill(null)).map((bar, b) => (id === 'fx' && b === 0 ? null : bar));
  return [id, [INTRO[id] ?? null, ...theme, ENDING[id] ?? null, null]];
}));

// ===================== PROJECT ASSEMBLY =====================
function buildTracks(defs, score, bars, button) {
  return ORDER.filter((id) => (score[id] ?? []).some((b) => b && b.length)).map((id) => {
    const d = defs[id], t = { id, description: d.description, instrument: { type: 'drumkit', kit: `assets/${d.kit}/kit.json` } };
    if (d.mix) t.mix = d.mix;
    if (d.effects) t.effects = d.effects;
    t.clips = [{ bar: 1, pattern: 'loop' }];
    t.patterns = [{ id: 'loop', bars, notes: notes(perBar(score[id]), d) }];
    if (button && button[id]) t.button = notes(button[id].map((e) => [1, ...e]), d);
    return t;
  });
}
const head = (title, description) => ({ formatVersion: 1, title, description, bpm: 106.0773, timeSignature: '4/4', key: 'E minor' });

function loopProjects({ slug, title, description, defs, score }) {
  const tracks = buildTracks(defs, score, 16, BUTTON);
  const loop = { ...head(title, description), bars: 16, seed: 0, render: { duration: { bars: 16 }, tail: 'none' }, master: MASTER,
    tracks: tracks.map(({ button, ...t }) => t) };
  const starts = [1, 17, 33];
  const x3 = { ...head(`${title} (x3 extraction copy)`, `Loop-extraction copy of ${slug}.json: the identical 16-bar loop at bars 1, 17 and 33 (continuous, so effect tails carry across every boundary), then one closing downbeat at bar 49 that decays inside that bar. Cycle 2 (bars 17-32) is the seamless loop master; cycle 3 must be bit-identical to it.`),
    bars: 49, seed: 0, render: { tail: 'none' }, master: MASTER,
    tracks: tracks.map(({ button, ...t }) => ({ ...t,
      clips: starts.map((bar) => ({ bar, pattern: 'loop' })).concat(button ? [{ bar: 49, pattern: 'button' }] : []),
      patterns: button ? [...t.patterns, { id: 'button', bars: 1, notes: button }] : t.patterns })) };
  return { [slug]: loop, [`${slug}-x3`]: x3 };
}

const out = {
  ...loopProjects({ slug: 'main-theme', title: 'THING//MANIA - Main Theme', defs: DEFS, score: MAIN,
    description: 'Official main game theme, built from AC-01 GROOVE FIRST. 16 bars, 106.0773 BPM, E Dorian, 4/4, exactly 36.2 s. Bars 1-4: the squelch riff and the whistle hook; the whistle catches the bass bend. Bars 5-8: the toaster answers on the bend, the whistle calls back bent, toaster and kettle in fourths, then stop-time with the tag at double speed in the hole. Bars 9-12: i -> IV (A13: the toaster sings the tag in A and the whistle copies it back), then bVI and bVII band hits in 3+3+2 with choir "da" stabs, a snare roll and a kettle coming to the boil. Bars 13-16: the hook returns on E with a second whistler a sixth below and the choir; bass, toaster, kettle and whistle bend together; the toaster steals the long note; the F13 slip and the battery sag (one semitone, bII -> I) slide into the loop, where the kitchen-timer ding restores power.' }),
  ...loopProjects({ slug: 'menu-mix', title: 'THING//MANIA - Menu', defs: MENU_DEFS, score: MENU,
    description: 'Menu arrangement of the main theme: same 16-bar form, bassline and harmonic map (Em9 | A13 | Cmaj9 | D6/9 | Em9 with the F13 slip), so it can be swapped with the theme on any bar. Lighter: the appliance choir hums the chords on "oo" instead of clav stabs; soft kick, a quiet ghost-free backbeat and off-beat eighth hats; no crunch bus, kitchen percussion or band hits, which leaves 2-6 kHz open for button clicks. The whistle hook sounds in bars 2, 6 and 13, the appliances answer in bars 5, 9 and 14, and the battery sag still carries the loop home.' }),
};
out['demo-mix'] = { ...head('THING//MANIA - Demo Mix', 'Short, punchy arrangement for a hackathon demo video: a cold open (one full-band hit with the ding, then the toaster sings its tag at double speed into the silence and the snare picks up), the 16-bar main theme, and a real ending (the battery sag lands on a final E hit with the ding, the whistle swoop and the choir). 18 bars plus one decay bar, 42.99 s. Section starts for editing: theme 2.2625 s, appliances 11.3125 s, development 20.3625 s, hook return 29.4125 s, ending 38.4625 s.'),
  bars: 19, seed: 0, render: { duration: { bars: 19 }, tail: 'none' }, master: MASTER, tracks: buildTracks(DEFS, DEMO, 19).map(({ button, ...t }) => t) };

for (const [slug, project] of Object.entries(out)) {
  writeFileSync(join(HERE, `${slug}.json`), fmt(project) + '\n');
  console.log(`${slug}: ${project.tracks.length} tracks, ${project.tracks.reduce((s, t) => s + t.patterns.reduce((q, p) => q + p.notes.length, 0), 0)} events`);
}
