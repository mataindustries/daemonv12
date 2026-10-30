#!/usr/bin/env node
// Writes the DaemonV12 projects for the THING//MANIA A+C hybrid auditions:
//   ac-01-groove-first.json            AC-01, 8 bars (render.duration = 8 bars, tail none)
//   ac-02-appliances-take-over.json    AC-02, 8 bars
//   <slug>-x4.json                     listening copies: the loop four times plus a closing downbeat
// The JSON files are the canonical, editable projects; this script is how they were authored.
// Editing a JSON by hand is fine, but rerunning this script overwrites it.
//
// Both variants share SOCK SLIDE's core: 106.0773 BPM (96000/905, so 8 bars are exactly
// 798,210 frames), 16ths swung to 272/240 ticks, E Dorian, the squelch riff with its Bb->B
// bend, the whistle hook, the clav and the kit. They differ only in what the appliances do.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { semis } from '../../tools/dsp.mjs';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const frac = (ticks) => { const g = gcd(ticks, 3840); return `${ticks / g}/${3840 / g}`; };
const SIXTEENTH = 240, BARS = 8;
// One quarter note at 96000/905 BPM is exactly 565,625 us.
const BEAT_SECONDS = 0.565625;

// A's swing: tick offset of each sixteenth inside a quarter-note beat.
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
// bars: array of 8 per-bar event lists ([step, pitch, len, vel, opts]).
const perBar = (bars) => bars.flatMap((evs, b) => (evs ?? []).map((e) => [b + 1, ...e]));

function track(t) {
  const out = { id: t.id, description: t.description, instrument: { type: 'drumkit', kit: t.kit } };
  if (t.mix) out.mix = t.mix;
  if (t.effects) out.effects = t.effects;
  out.clips = [{ bar: 1, pattern: 'loop' }];
  out.patterns = [{ id: 'loop', bars: BARS, notes: notes(perBar(t.bars), t) }];
  if (t.button) out.button = notes(t.button.map((e) => [1, ...e]), t);
  return out;
}

function projects(song) {
  const tracks = song.tracks.map(track);
  const head = { formatVersion: 1, title: song.title, description: song.description, bpm: 106.0773, timeSignature: '4/4', key: 'E minor' };
  const strip = ({ button, ...t }) => t;
  const loop = { ...head, bars: BARS, seed: 0, render: { duration: { bars: BARS }, tail: 'none' }, master: song.master, tracks: tracks.map(strip) };
  const starts = [1, 9, 17, 25];
  const x4 = { ...head, title: `${song.title} (x4 listening copy)`,
    description: `Listening copy of ${song.slug}.json: the identical eight-bar loop placed at bars 1, 9, 17 and 25, then one closing downbeat at bar 33 that decays inside that bar. Same tracks, mix and master.`,
    bars: 33, seed: 0, render: { tail: 'none' }, master: song.master,
    tracks: tracks.map(({ button, ...t }) => ({ ...t,
      clips: starts.map((bar) => ({ bar, pattern: 'loop' })).concat(button ? [{ bar: 33, pattern: 'button' }] : []),
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

// ===================== THE SHARED CORE (SOCK SLIDE) =====================
const pop = { rate: 2, short: 40 };
const bend = { glide: [semis(1), '1/32'] };
// A's riff: E1, octave pop, D-B, ghost G, A, the Bb->B bend on beat 4, pickup.
const RIFF = [[0, 'E1', 2, 1.0], [3, 'E1', 1, 0.8, pop], [5, 'D2', 1, 0.85], [6, 'B1', 1, 0.85],
  [9, 'G1', 1, 0.6], [10, 'A1', 2, 0.9], [12, 'Bb1', 2, 0.95, bend], [15, 'E1', 1, 0.75]];
// A's bar 2: the walk back up through D-Eb.
const WALK = [[0, 'E1', 3, 1.0], [3, 'E1', 1, 0.7, pop], [6, 'E1', 1, 0.5], [7, 'G1', 1, 0.8], [8, 'A1', 1, 0.85],
  [10, 'B1', 2, 0.85], [14, 'D2', 1, 0.8], [15, 'Eb2', 1, 0.85]];
const RIFF_HEAD = RIFF.slice(0, 4);
// A's whistle hook: swoop up to E6, D-B, the Dorian C#.
const swoop = { rate: semis(-2), glide: [1, '1/32'] };
const HOOK = [[0, 'E6', 3, 0.95, swoop], [3, 'D6', 1, 0.72], [5, 'B5', 1, 0.72], [6, 'C#6', 2, 0.85]];
const HOOK_CLIPPED = [...HOOK.slice(0, 3), [6, 'C#6', 2, 0.85, { short: 120 }]];
const PICKUP = [[13, 'B5', 1, 0.7], [14, 'D6', 2, 0.8]];
const CLAV_A = [[6, 'em9', 1, 0.75], [11, 'chk', 1, 0.45], [14, 'em9', 1, 0.6]];
const KICK = [[0, 'kick', 0, 1.0], [10, 'kick', 0, 0.85]];
const KICK_WALK = [...KICK, [13, 'kick', 0, 0.55]];
const SNARE = [[4, 'snare', 0, 0.95], [7, 'snare', 0, 0.22], [9, 'snare', 0, 0.18], [12, 'snare', 0, 0.95], [14, 'snare', 0, 0.22]];
const hatsBar = (open, keep = () => true) => Array.from({ length: 16 }, (_, s) => (open && s === 14 ? [s, 'hat-o', 0, 0.55]
  : [s, 'hat-c', 0, s % 4 === 0 ? 0.5 : s % 4 === 2 ? 0.72 : 0.32])).filter(([s]) => keep(s));
const HATS = (open) => hatsBar(open);
const HATS_HALF = hatsBar(false, (s) => s < 8);

// The appliance tag, C's chant moved into E minor: ba (E) da (G) DEE (A#, the raised 4th) on
// beats 3, 3-and and 4. The DEE lands on A's Bb->B bass bend, three octaves up.
const TAG_BEND = [[8, 'ba-e4', 2, 0.85, { short: 60 }], [10, 'da-g4', 2, 0.75, { short: 60 }], [12, 'dee-as4', 2, 0.95, bend]];
const KETTLE_BEND = [[8, 'ba-b3', 2, 0.7, { short: 60 }], [10, 'da-d4', 2, 0.65, { short: 60 }], [12, 'dee-f4', 2, 0.85, bend]];

const BASS_FX = [{ type: 'highpass', frequencyHz: 32 }, { type: 'compressor', thresholdDb: -16, ratio: 3, attackMs: 4, releaseMs: 90, makeupGainDb: 1 }, { type: 'saturation', driveDb: 6, mix: 0.35 }];
const GRIT_FX = [{ type: 'highpass', frequencyHz: 350 }, { type: 'saturation', driveDb: 18, mix: 0.5 }, { type: 'lowpass', frequencyHz: 4000 }];
const BASS_ENV = { attackSeconds: 0.001, releaseSeconds: 0.02 };
const MASTER = { gainDb: -3, effects: [{ type: 'highpass', frequencyHz: 28 }, { type: 'compressor', thresholdDb: -16, ratio: 2, attackMs: 8, releaseMs: 120, makeupGainDb: 1 }] };

function core({ bass, whistle, whistleDry, clav, kick, snare, hats }) {
  return [
    { id: 'bass', description: "A's squelch bass riff (unchanged sound, same choke and processing).", kit: 'assets/bass/kit.json',
      env: BASS_ENV, choke: 'bass', mix: { gainDb: 0 }, effects: BASS_FX, bars: bass, button: [[0, 'E1', 8, 1.0]] },
    { id: 'bass-grit', description: 'Parallel high-passed, driven copy of the bass so the riff carries on phone speakers (2 dB hotter than A).',
      kit: 'assets/bass/kit.json', env: BASS_ENV, choke: 'bass', mix: { gainDb: -8 }, effects: GRIT_FX, bars: bass, button: [[0, 'E1', 8, 1.0]] },
    { id: 'whistle', description: "A's whistle: hook, pickups and answers. Panned 0.3 and 1 dB up, which keeps A's level under the balance pan law.", kit: 'assets/whistle/kit.json',
      env: { attackSeconds: 0.004, releaseSeconds: 0.06 }, choke: 'lead', mix: { gainDb: -8, pan: 0.3 },
      effects: [{ type: 'highpass', frequencyHz: 400 }, { type: 'delay', timeMs: 424.5, wet: 0.14 }, { type: 'reverb', roomSize: 0.4, decaySeconds: 1.0, wet: 0.18 }],
      bars: whistle, button: [[0, 'E6', 8, 0.85, swoop]] },
    { id: 'whistle-dry', description: "The same whistle without its dotted-eighth echo, for the phrases that hand over to an appliance: the echo would land exactly on the appliance's entry.",
      kit: 'assets/whistle/kit.json', env: { attackSeconds: 0.004, releaseSeconds: 0.06 }, choke: 'lead', mix: { gainDb: -8, pan: 0.3 },
      effects: [{ type: 'highpass', frequencyHz: 400 }, { type: 'reverb', roomSize: 0.4, decaySeconds: 1.0, wet: 0.18 }],
      bars: whistleDry },
    { id: 'clav', description: 'Em9 stabs on the swung off-beats; they step aside whenever an appliance sings.', kit: 'assets/clav/kit.json',
      env: { attackSeconds: 0.001, releaseSeconds: 0.03 }, choke: 'clav', mix: { gainDb: -4.5, pan: -0.6 },
      effects: [{ type: 'highpass', frequencyHz: 200 }, { type: 'reverb', roomSize: 0.25, decaySeconds: 0.4, wet: 0.08 }],
      bars: clav, button: [[0, 'em9', 4, 0.8]] },
    { id: 'kick', description: "A's kick, locked to the bass on 1 and 3-and.", kit: 'assets/drums/kit.json', mix: { gainDb: -3 },
      bars: kick, button: [[0, 'kick', 0, 1.0]] },
    { id: 'snare', description: "A's backbeat with ghost notes.", kit: 'assets/drums/kit.json', mix: { gainDb: -4, pan: 0.05 },
      effects: [{ type: 'reverb', roomSize: 0.3, decaySeconds: 0.6, wet: 0.12 }], bars: snare },
    { id: 'drum-crunch', description: 'Parallel crunch bus: the kick and snare hits again, high-passed and driven hard so the kit has bite and reads on phones.',
      kit: 'assets/drums/kit.json', mix: { gainDb: -13 },
      effects: [{ type: 'highpass', frequencyHz: 140 }, { type: 'saturation', driveDb: 20, mix: 0.8 }, { type: 'lowpass', frequencyHz: 6500 },
        { type: 'compressor', thresholdDb: -20, ratio: 4, attackMs: 3, releaseMs: 80, makeupGainDb: 0 }],
      bars: kick.map((k, b) => [...(k ?? []), ...(snare[b] ?? [])]), button: [[0, 'kick', 0, 1.0]] },
    { id: 'hats', description: 'Swung 16ths accenting the off-beat eighths; open hat on 4-and in odd bars, choked by the next closed hat.',
      kit: 'assets/drums/kit.json', choke: 'hat', env: { attackSeconds: 0.0005, releaseSeconds: 0.01 }, mix: { gainDb: -9.5, pan: 0.55 },
      bars: hats, button: [[0, 'hat-o', 0, 0.55]] },
  ];
}

const VOICE_FX = [{ type: 'highpass', frequencyHz: 160 }, { type: 'saturation', driveDb: 3, mix: 0.2 },
  { type: 'delay', timeMs: 282.8, wet: 0.1 }, { type: 'reverb', roomSize: 0.4, decaySeconds: 1.0, wet: 0.16 }];
const KETTLE_FX = [{ type: 'highpass', frequencyHz: 200 }, { type: 'delay', timeMs: 424.2, wet: 0.12 }, { type: 'reverb', roomSize: 0.4, decaySeconds: 1.0, wet: 0.18 }];
const CHOIR_FX = [{ type: 'highpass', frequencyHz: 150 }, { type: 'reverb', roomSize: 0.6, decaySeconds: 1.6, wet: 0.28 }];
const DING = (bars, button) => ({ id: 'ding', description: 'Kitchen-timer ding (E7): power restored.', kit: 'assets/kitchen/kit.json',
  mix: { gainDb: -11, pan: 0.5 }, effects: [{ type: 'reverb', roomSize: 0.5, decaySeconds: 1.2, wet: 0.25 }], bars, button });

// ===================== AC-01 GROOVE FIRST (80% A / 20% C) =====================
// Whistle calls, an appliance answers. Bar 6 stops the band dead for one beat so the tag can
// be sung at double speed in the hole. Bar 8 is A's F13 slip, but the whistle hands it to the
// choir, whose battery sags exactly one semitone: the sag IS the slide home (bII -> I).
const AC01 = {
  slug: 'ac-01-groove-first', title: 'THING//MANIA hybrid AC-01: GROOVE FIRST',
  description: 'A+C hybrid, 80% SOCK SLIDE / 20% LOW BATTERY CHOIR. Thesis: an irresistibly funky arcade band is interrupted by mischievous singing appliances. SOCK SLIDE stays the foundation (riff, swing, whistle, clav, kit). Bars 1-2: riff and whistle hook. Bars 3-4: an appliance answers the whistle with C\'s chant moved into E minor - ba (E) da (G) DEE (A#) - and the DEE rides the bass\'s Bb->B bend three octaves up; the whistle then borrows that bend. Bars 5-6: a second appliance (the kettle) harmonizes the tag in parallel fourths; then the band stops dead for one beat while the toaster sings the tag at double speed, and the band slams back in on the bend. Bars 7-8: A\'s F13 slip, handed to a close-harmony choir that holds the chord, then sags one semitone onto E as its battery dies - the sag is the slide home - and a kitchen-timer ding on the downbeat restores power.',
  master: MASTER,
  tracks: [
    ...core({
      bass: [RIFF, WALK, RIFF, WALK, RIFF,
        // bar 6: stop-time. The walk freezes after G1; nothing on beat 3; back in on the bend.
        [...WALK.slice(0, 4), [12, 'Bb1', 2, 0.95, bend], [14, 'D2', 1, 0.8], [15, 'Eb2', 1, 0.85]],
        RIFF,
        // bar 8: A's slip to F, sliding home a semitone into the downbeat.
        [...RIFF_HEAD, [8, 'F1', 3, 1.0], [11, 'F1', 1, 0.8, pop], [13, 'Eb2', 1, 0.8], [14, 'F1', 2, 0.95, { glide: [semis(-1), '1/8'] }]]],
      whistle: [PICKUP, [...HOOK, [8, 'B5', 4, 0.85]], null,
        // bar 4: the call again, but the long note now bends up like the appliance did.
        [...HOOK, [8, 'B5', 4, 0.85, { rate: semis(-1), glide: [1, '1/16'] }]], null, null, PICKUP, null],
      // bars 6 and 8: the hook hands straight over to an appliance, so it is played dry.
      whistleDry: [null, null, null, null, null, HOOK_CLIPPED, null, HOOK_CLIPPED],
      clav: [[[0, 'em9', 1, 0.7], ...CLAV_A], CLAV_A, [[6, 'em9', 1, 0.75]], CLAV_A, [[6, 'em9', 1, 0.75]],
        [[6, 'em9', 1, 0.75], [14, 'em9', 1, 0.6]], CLAV_A, [[6, 'em9', 1, 0.75], [8, 'f13', 3, 0.9]]],
      kick: [KICK, KICK_WALK, KICK, KICK_WALK, KICK, [[0, 'kick', 0, 1.0], [12, 'kick', 0, 0.95]], KICK, [[0, 'kick', 0, 1.0], [6, 'kick', 0, 0.75]]],
      snare: [SNARE, SNARE, SNARE, SNARE, SNARE, [[4, 'snare', 0, 0.95], [7, 'snare', 0, 0.22], [12, 'snare', 0, 1.0], [14, 'snare', 0, 0.22]],
        SNARE, [[4, 'snare', 0, 0.95], [7, 'snare', 0, 0.22], [15, 'snare', 0, 0.45]]],
      hats: [HATS(true), HATS(false), HATS(true), HATS(false), HATS(true), hatsBar(false, (s) => s < 8 || s >= 12), HATS(true), HATS_HALF],
    }),
    { id: 'voice', description: 'The lead appliance (toaster): the ba-da-DEE tag in bars 3 and 5, sung at double speed into the bar-6 hole.',
      kit: 'assets/voice/kit.json', env: { attackSeconds: 0.002, releaseSeconds: 0.04 }, choke: 'lead-voice', mix: { gainDb: -6, pan: -0.35 },
      effects: VOICE_FX,
      bars: [null, null, TAG_BEND, null, TAG_BEND,
        [[8, 'ba-e4', 1, 0.8, { short: 30 }], [9, 'da-g4', 1, 0.75, { short: 20 }], [10, 'dee-as4', 2, 0.95, { short: 40 }], [12, 'yah-b4', 2, 0.95]],
        null, null] },
    { id: 'kettle', description: 'A second appliance harmonizing the tag a fourth below in bar 5 (planing, after C).',
      kit: 'assets/kettle/kit.json', env: { attackSeconds: 0.002, releaseSeconds: 0.04 }, choke: 'kettle', mix: { gainDb: -9.5, pan: 0.65 },
      effects: KETTLE_FX, bars: [null, null, null, null, KETTLE_BEND, null, null, null] },
    { id: 'choir', description: 'Close-harmony choir on the bar-8 slip: G4 C5 D5 (with the clav F13) held one beat, then a coherent continuation from the same source position sags one semitone onto F#4 B4 C#5 at the downbeat.',
      kit: 'assets/choir/kit.json', env: { attackSeconds: 0.03, releaseSeconds: 0.09 }, choke: 'choir', mix: { gainDb: -5 },
      effects: CHOIR_FX,
      bars: [null, null, null, null, null, null, null,
        [[8, 'aah-slip', 0, 0.85, { env: { attackSeconds: 0.03, releaseSeconds: 0.015 } }],
          [12, 'aah-slip', 5, 0.85, { offset: BEAT_SECONDS, glide: [semis(-1), '1/4'], env: { attackSeconds: 0.015, releaseSeconds: 0.12 } }]]] },
    DING([[[0, 'ding', 0, 0.8]], null, null, null, null, null, null, null], [[0, 'ding', 0, 0.8]]),
  ],
};

// ===================== AC-02 THE APPLIANCES TAKE OVER (65% A / 35% C) =====================
// The appliances grab the hook in bar 3 and push the whistle off the downbeat in bar 4. In
// bars 5-6 they chant in C's 7/8 grouping (2+2+3 eighths) twice against A's 4/4. In bar 7
// the kitchen replaces the drum kit and the choir replaces the clav. In bar 8 the power fails:
// bass, choir and lead sag three semitones from the F slip to D; the ding restores power.
const TAG_FULL = [[8, 'ba-e4', 2, 0.85, { short: 60 }], [10, 'da-g4', 2, 0.75, { short: 60 }], [12, 'dee-as4', 2, 0.95, { short: 60 }], [14, 'da-b4', 2, 0.8, { short: 60 }]];
const KETTLE_FULL = [[8, 'ba-b3', 2, 0.7, { short: 60 }], [10, 'da-d4', 2, 0.65, { short: 60 }], [12, 'dee-f4', 2, 0.85, { short: 60 }], [14, 'da-fs4', 2, 0.7, { short: 60 }]];
const sag3 = { glide: [semis(-3), '3/8'] };
const AC02 = {
  slug: 'ac-02-appliances-take-over', title: 'THING//MANIA hybrid AC-02: THE APPLIANCES TAKE OVER',
  description: 'A+C hybrid, 65% SOCK SLIDE / 35% LOW BATTERY CHOIR. Same core as AC-01 (riff, swing, whistle, kit). Bars 1-2: riff and whistle hook. Bars 3-4: the appliances grab the hook - toaster and kettle in parallel fourths sing ba-da-DEE-da, the DEE on the bass bend, landing on a held YAAAH with the choir - and the whistle is pushed two beats late. Bars 5-6: the surprise - the toaster chants C\'s 2+2+3 grouping twice against the 4/4 groove (first in E minor, then C\'s own Lydian shape on A, the Dorian IV), so the second chant lands off the beat; the band answers in the one free beat. Bar 7: breakdown - the kitchen kit replaces the drums and choir stabs replace the clav while the riff keeps going. Bar 8: A\'s F slip, then a power failure: bass, choir and lead sag three semitones to D together; the timer dings, power returns, D -> E.',
  master: { ...MASTER, gainDb: -3.5 },
  tracks: [
    ...core({
      bass: [RIFF, WALK, RIFF, WALK, RIFF, WALK, RIFF,
        [...RIFF_HEAD, [8, 'f1-long', 6, 1.0, sag3], [15, 'E1', 1, 0.85]]],
      whistle: [PICKUP, [...HOOK, [8, 'B5', 4, 0.85]], null, null, null, null, null, null],
      // bar 4: the hook, two beats late, answering the appliances (dry: the chant starts on the
      // next downbeat). Bar 8: the hook's head, dry, before the power fails.
      whistleDry: [null, null, null,
        [[8, 'E6', 2, 0.95, swoop], [11, 'D6', 1, 0.72], [13, 'B5', 1, 0.72], [14, 'C#6', 2, 0.85, { short: 60 }]],
        null, null, null, HOOK_CLIPPED],
      clav: [[[0, 'em9', 1, 0.7], ...CLAV_A], CLAV_A, [[6, 'em9', 1, 0.75]], [[11, 'chk', 1, 0.45]], null, null, null, [[8, 'f13', 3, 0.9]]],
      kick: [KICK, KICK_WALK, KICK, KICK_WALK, KICK, KICK_WALK, [[0, 'kick', 0, 1.0]], [[0, 'kick', 0, 1.0], [6, 'kick', 0, 0.75]]],
      snare: [SNARE, SNARE, SNARE, SNARE, SNARE,
        // bar 6: the band's answer in the one beat the chant leaves free.
        [[4, 'snare', 0, 0.95], [7, 'snare', 0, 0.22], [9, 'snare', 0, 0.18], [12, 'snare', 0, 0.95], [13, 'snare', 0, 0.35], [14, 'snare', 0, 0.55], [15, 'snare', 0, 0.75]],
        null, [[4, 'snare', 0, 0.95], [7, 'snare', 0, 0.22], [14, 'snare', 0, 0.6], [15, 'snare', 0, 0.85]]],
      hats: [HATS(true), HATS(false), HATS(true), HATS(false), HATS(true), HATS(false), null, HATS_HALF],
    }),
    { id: 'voice', description: 'The lead appliance (toaster): grabs the hook in bar 3, holds YAAAH in bar 4, chants 2+2+3 twice across bars 5-6, the bent tag in the bar-7 breakdown, and sags with the power failure.',
      kit: 'assets/voice/kit.json', env: { attackSeconds: 0.002, releaseSeconds: 0.04 }, choke: 'lead-voice', mix: { gainDb: -2, pan: -0.35 },
      effects: VOICE_FX,
      bars: [null, null, TAG_FULL, [[0, 'yah-g4', 6, 0.9, { short: 40 }]],
        [[0, 'ba-e4', 2, 0.85, { short: 60 }], [2, 'da-g4', 2, 0.75, { short: 60 }], [4, 'dee-as4', 2, 0.95, { short: 60 }], [6, 'da-b4', 2, 0.8, { short: 60 }],
          [8, 'yah-g4', 6, 0.9, { short: 40 }], [14, 'ba-a4', 2, 0.85, { short: 60 }]],
        [[0, 'da-cs5', 2, 0.75, { short: 60 }], [2, 'dee-ds5', 2, 0.95, { short: 60 }], [4, 'da-e5', 2, 0.8, { short: 60 }], [6, 'yah-cs5', 6, 0.92, { short: 40 }]],
        TAG_BEND,
        [[8, 'yah-d5', 6, 0.95, sag3]]],
      button: [[0, 'yah-g4', 8, 0.85]] },
    { id: 'kettle', description: 'The kettle: parallel fourths under the hook (bar 3) and the breakdown tag (bar 7).',
      kit: 'assets/kettle/kit.json', env: { attackSeconds: 0.002, releaseSeconds: 0.04 }, choke: 'kettle', mix: { gainDb: -8, pan: 0.65 },
      effects: KETTLE_FX, bars: [null, null, KETTLE_FULL, null, null, null, KETTLE_BEND, null] },
    { id: 'choir', description: 'Close-harmony choir: E minor under the bar-4 YAAAH, A major under the bar-6 YAAAH, "da" stabs in place of the clav in bar 7, and the bar-8 slip chord sagging three semitones.',
      kit: 'assets/choir/kit.json', env: { attackSeconds: 0.03, releaseSeconds: 0.09 }, choke: 'choir', mix: { gainDb: -5.5 },
      effects: CHOIR_FX,
      bars: [null, null, null, [[0, 'aah-em', 6, 0.8]], null, [[6, 'aah-a', 6, 0.8]],
        [[0, 'dat-em7', 1, 0.8, { env: { attackSeconds: 0.002, releaseSeconds: 0.05 } }], [6, 'dat-em7', 1, 0.85, { env: { attackSeconds: 0.002, releaseSeconds: 0.05 } }],
          [14, 'dat-em7', 1, 0.7, { env: { attackSeconds: 0.002, releaseSeconds: 0.05 } }]],
        [[8, 'aah-slip', 6, 0.85, sag3]]],
      button: [[0, 'aah-em', 8, 0.8]] },
    // C's cardboard-box kick and spoon-on-pot-lid share one track (DaemonV12 allows 15 tracks).
    // The lid sits 2 dB under the box: velocity is linear gain, so lid velocities are x0.794.
    { id: 'kitchen', description: "C's cardboard-box kick under A's kick and spoon-on-pot-lid under the backbeat once the appliances arrive (bars 3-6); in the bar-7 breakdown they replace the drum kit.",
      kit: 'assets/kitchen/kit.json', mix: { gainDb: -9, pan: -0.06 }, effects: [{ type: 'reverb', roomSize: 0.3, decaySeconds: 0.5, wet: 0.1 }],
      bars: [null, null, KICK, KICK_WALK, KICK, KICK_WALK, [[0, 'kick', 0, 1.0], [10, 'kick', 0, 0.9]], [[0, 'kick', 0, 0.8]]]
        .map((bar) => bar && bar.map(([s, , l, v]) => [s, 'box', l, v]))
        .map((bar, b) => [...(bar ?? []), ...({ 2: 1, 3: 1, 4: 1, 5: 1 }[b] ? [[4, 'lid', 0, 0.7], [12, 'lid', 0, 0.7]]
          : b === 6 ? [[4, 'lid', 0, 1.0], [7, 'lid', 0, 0.3], [12, 'lid', 0, 1.0], [15, 'lid', 0, 0.35]] : [])
          .map(([s, n, l, v]) => [s, n, l, Number((v * 0.794).toFixed(3))])]) },
    { id: 'shaker', description: "C's rice-jar shaker opposite the hats from bar 3; it winds down as the power fails.",
      kit: 'assets/kitchen/kit.json', mix: { gainDb: -10, pan: -0.65 },
      bars: [null, null, ...Array(5).fill(Array.from({ length: 16 }, (_, s) => [s, 'shaker', 0, s % 4 === 2 ? 0.6 : s % 4 === 0 ? 0.4 : 0.22])),
        Array.from({ length: 8 }, (_, s) => [s, 'shaker', 0, Number(((s % 4 === 2 ? 0.6 : s % 4 === 0 ? 0.4 : 0.22) * (1 - s / 9)).toFixed(3))])] },
    DING([null, null, null, null, null, null, null, [[14, 'ding', 0, 0.85]]], [[0, 'ding', 0, 0.7]]),
  ],
};

for (const song of [AC01, AC02]) {
  const { loop, x4 } = projects(song);
  writeFileSync(join(HERE, `${song.slug}.json`), fmt(loop) + '\n');
  writeFileSync(join(HERE, `${song.slug}-x4.json`), fmt(x4) + '\n');
  console.log(`${song.slug}: ${loop.tracks.length} tracks, ${loop.tracks.reduce((s, t) => s + t.patterns[0].notes.length, 0)} events`);
}
