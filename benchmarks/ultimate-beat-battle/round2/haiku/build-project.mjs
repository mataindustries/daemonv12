#!/usr/bin/env node
// Deterministic source for project.json. Run from anywhere: node build-project.mjs
// Musical intent lives in the score tables below; the output is plain DaemonV12 JSON.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const BPM = 130;
const BARS = 15;
const WHOLE = 3840; // 960 PPQ × 4 beats
const BEAT = 960;
const SIXTEENTH = 240;
const SWING = 120; // off-eighth hats pushed late by 1/32 note

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
const frac = (ticks) => {
  const g = gcd(ticks, WHOLE);
  return `${ticks / g}/${WHOLE / g}`;
};
// Position "bar:beat(+N/D)". Patterns are one bar long, so their notes use bar 1.
const at = (bar, ticks) => {
  const beat = Math.floor(ticks / BEAT) + 1;
  const rem = ticks % BEAT;
  return rem === 0 ? `${bar}:${beat}` : `${bar}:${beat}+${frac(rem)}`;
};
// Equal-tempered rate for a semitone offset from the source's own pitch.
const rate = (semis) => Number((2 ** (semis / 12)).toFixed(6));

// Kit and sampler names.
const K = 'mechanical-kick';
const SN = 'industrial-snare';
const MS = 'metallic-strike';
const MT = 'machine-tick';
const CL = 'chrome-clap';
const HH = 'pixel-hat';
const PU = 'bass-punch-cs';
const SB = 'sub-cs';
const GL = 'glass-hit';
const CR = 'glass-crush';
const CH = 'vox-chip';

// One hit: step is a 16th within the bar (0–15). o may carry r (semitones
// from the source pitch), g (glide {to: rate, d}), off (source offset seconds), sw (swing ticks).
const hk = (s, p, v, o = {}) => ({ t: s * SIXTEENTH + (o.sw || 0), p, v, ...o });
const hats = (lo, hi) =>
  [0, 2, 4, 6, 8, 10, 12, 14].map((s) => hk(s, HH, s % 4 === 2 ? hi : lo, s % 4 === 2 ? { sw: SWING } : {}));
const oddTicks = (a, b) => [1, 3, 5, 7, 9, 11, 13, 15].map((s, i) => hk(s, MT, i % 2 ? b : a));
const kickBar = (second) => [hk(0, K, 0.95), hk(second, K, 0.8)];

// Hook cell: C#5 · F#5 · E5 · G#5, four notes with an asymmetric 5-3-6-2 spacing.
const HOOK = (v = [0.85, 0.7, 0.75, 0.7], shift = 0, semis = 0) => [
  hk(0 + shift, GL, v[0], { r: semis }),
  hk(5 + shift, GL, v[1], { r: semis + 5 }),
  hk(8 + shift, GL, v[2], { r: semis + 3 }),
  hk(14 + shift, GL, v[3], { r: semis + 7 }),
];
// Bass cycle: C#2 · E2 (bar odd) then F#2 · B1 (bar even).
const BASS_ODD = [hk(6, [PU, SB], 0.9, { r: 0 }), hk(14, [PU, SB], 0.75, { r: 3 })];
const BASS_EVEN = [hk(6, [PU, SB], 0.9, { r: 5 }), hk(14, [PU, SB], 0.8, { r: -2 })];
// Answer-hook for glass-crush in the bass register: same intervals, one octave down.
const CRUSH_CELL = (shift = 0, v = [0.6, 0.5, 0.55, 0.5], up = 0) => [
  hk(0 + shift, CR, v[0], { r: up }),
  hk(5 + shift, CR, v[1], { r: up + 5 }),
  hk(8 + shift, CR, v[2], { r: up + 3 }),
  hk(14 + shift, CR, v[3], { r: up + 7 }),
];
const CHIPS = (lo = 0.5, hi = 0.9) => [hk(13, CH, lo), hk(14, CH, hi), hk(15, CH, lo)];

// Score: each track maps a bar number to its hits. Empty bars are omitted.
const SCORE = {
  kick: {
    1: kickBar(10), 2: kickBar(10), 3: kickBar(10), 4: kickBar(10),
    5: [...kickBar(10), hk(14, K, 0.45)], 6: [...kickBar(10), hk(14, K, 0.45)],
    8: kickBar(11), 9: kickBar(11),
    10: [hk(0, K, 0.95)],
    11: [hk(0, K, 1), hk(10, K, 0.85)],
    12: kickBar(10).map((h) => ({ ...h, v: h.v === 0.95 ? 0.95 : 0.85 })),
    13: [hk(0, K, 0.9), hk(10, K, 0.7)],
    14: kickBar(10),
  },
  snare: {
    3: [hk(7, SN, 0.3)], 4: [hk(7, SN, 0.3)], 5: [hk(7, SN, 0.3)], 6: [hk(7, SN, 0.3)],
    8: [hk(12, SN, 0.85), hk(6, MS, 0.6), hk(14, MS, 0.5), ...oddTicks(0.3, 0.45)],
    9: [hk(12, SN, 0.85), hk(6, MS, 0.55), hk(14, MS, 0.6), ...oddTicks(0.3, 0.45)],
    10: [hk(6, MT, 0.4), hk(7, MT, 0.55)],
    11: [hk(12, SN, 0.85), hk(6, MS, 0.55), hk(14, MS, 0.6), ...oddTicks(0.3, 0.45)],
  },
  clap: {
    3: [hk(4, CL, 0.75), hk(12, CL, 0.9)],
    4: [hk(4, CL, 0.75), hk(12, CL, 0.9)],
    5: [hk(4, CL, 0.75), hk(12, CL, 0.9)],
    6: [hk(4, CL, 0.75), hk(12, CL, 0.9)],
    8: [hk(4, CL, 0.8), hk(12, CL, 0.9)],
    9: [hk(4, CL, 0.8), hk(12, CL, 0.9)],
    10: [hk(4, CL, 0.8)],
    11: [hk(4, CL, 0.9), hk(12, CL, 1)],
    12: [hk(4, CL, 0.9), hk(12, CL, 0.95)],
    13: [hk(4, CL, 0.8), hk(12, CL, 0.85)],
    14: [hk(12, CL, 0.85)],
  },
  hats: {
    1: hats(0.45, 0.6), 2: hats(0.45, 0.6),
    3: hats(0.45, 0.6), 4: hats(0.45, 0.6), 5: hats(0.45, 0.6), 6: hats(0.45, 0.6),
    11: hats(0.5, 0.65), 12: hats(0.5, 0.65),
    13: hats(0.4, 0.5), 14: hats(0.4, 0.55),
  },
  low: {
    1: BASS_ODD, 2: BASS_EVEN, 3: BASS_ODD, 4: BASS_EVEN, 5: BASS_ODD,
    6: [hk(6, [PU, SB], 0.9, { r: 5 }), hk(14, [PU, SB], 0.8, { r: -2, g: { to: 0.5, d: '1/4' } })],
    8: [hk(0, [PU, SB], 0.95, { r: 0 })],
    9: [hk(6, [PU, SB], 0.9, { r: 5 })],
    11: [hk(8, [PU, SB], 0.9, { r: 0 }), hk(14, [PU, SB], 0.8, { r: 3 })],
    12: BASS_EVEN,
    13: [hk(6, [PU, SB], 0.85, { r: 0 }), hk(14, [PU, SB], 0.7, { r: 3 })],
    14: [hk(6, [PU, SB], 0.9, { r: 0 }), hk(14, [PU, SB], 0.75, { r: 3 })],
    15: [hk(0, [SB], 0.85, { r: 0 })],
  },
  glass: {
    1: HOOK(),
    2: [hk(10, CR, 0.6, { r: 0 }), hk(13, CR, 0.5, { r: 3 })],
    3: HOOK([0.6, 0.7, 0.6, 0.65], 1, 0),
    4: [hk(10, CR, 0.6, { r: 0 }), ...CHIPS()],
    5: HOOK([0.85, 0.7, 0.75, 0.7], 0, 5),
    6: [
      hk(0, GL, 0.85, { r: 0 }), hk(5, GL, 0.7, { r: 5 }), hk(8, GL, 0.75, { r: 3 }),
      hk(14, GL, 0.7, { r: 7, g: { to: 1, d: '1/8' } }),
    ],
    8: CRUSH_CELL(0, [0.6, 0.5, 0.55, 0.5], 12),
    9: CRUSH_CELL(1, [0.5, 0.55, 0.5, 0.6], 12),
    11: [hk(5, GL, 0.75, { r: 17 }), hk(8, GL, 0.7, { r: 15 }), hk(10, CR, 0.55, { r: 0 }), hk(14, GL, 0.75, { r: 19 })],
    12: [
      hk(5, GL, 0.7, { r: 17 }), hk(8, GL, 0.7, { r: 15 }), hk(10, CR, 0.6, { r: 0 }),
      hk(14, GL, 0.7, { r: 19 }), ...CHIPS(0.5, 0.9),
    ],
    13: [hk(0, GL, 0.6, { r: 0 }), hk(10, CR, 0.5, { r: 0 }), ...CHIPS()],
    14: [...HOOK(), hk(10, CR, 0.6, { r: 0 }), hk(13, CR, 0.5, { r: 3 })],
  },
  vox: {
    2: [hk(4, null, 0.7, { r: 0 }), hk(12, null, 0.75, { r: 7 })],
    7: [hk(0, null, 0.6, { r: 0, off: 0.2 })],
    12: [hk(4, null, 0.75, { r: 7 }), hk(12, null, 0.75, { r: 12, g: { to: rate(7), d: '1/8' } })],
    14: [hk(4, null, 0.7, { r: 0 }), hk(12, null, 0.75, { r: 7 })],
  },
  reverse: {
    7: [hk(8, null, 0.75, { r: 0 })],
    10: [hk(8, null, 0.8, { r: 0 })],
  },
  prism: {
    11: [hk(0, null, 0.9, { r: 0 })],
    15: [hk(0, null, 0.75, { r: 0 })],
  },
  impact: {
    11: [hk(0, null, 0.85)],
  },
};

const TRACKS = [
  { id: 'kick', kit: 'orbital-foundry', mix: { gainDb: -3, pan: 0 } },
  { id: 'snare', kit: 'orbital-foundry', mix: { gainDb: -6, pan: 0.2 } },
  { id: 'clap', kit: 'glasshouse', mix: { gainDb: -1, pan: 0 },
    effects: [{ type: 'reverb', roomSize: 0.3, decaySeconds: 0.9, wet: 0.12 }] },
  { id: 'hats', kit: 'glasshouse', mix: { gainDb: -5, pan: 0 } },
  { id: 'low', kit: 'glasshouse', mix: { gainDb: -8, pan: 0 },
    automation: { gainDb: [
      { at: { musical: '1:1' }, value: -8 },
      { at: { musical: '6:4' }, value: -8, transition: 'linear' },
      { at: { musical: '7:1' }, value: -60, transition: 'linear' },
      { at: { musical: '8:1' }, value: -8 },
      { at: { musical: '10:4' }, value: -8, transition: 'linear' },
      { at: { musical: '11:1' }, value: -4 },
      { at: { musical: '13:1' }, value: -6 },
    ] } },
  { id: 'glass', kit: 'glasshouse', mix: { gainDb: -2, pan: 0 },
    effects: [
      { type: 'saturation', driveDb: 5, mix: 0.3 },
      { type: 'delay', timeMs: 346, wet: 0.2 },
      { type: 'reverb', roomSize: 0.45, decaySeconds: 1.6, wet: 0.18 },
    ],
    automation: { gainDb: [
      { at: { musical: '1:1' }, value: -2 },
      { at: { musical: '10:4' }, value: -2, transition: 'linear' },
      { at: { musical: '11:1' }, value: 0 },
      { at: { musical: '13:1' }, value: -2 },
    ], pan: [
      { at: { musical: '1:1' }, value: 0 },
      { at: { musical: '5:1' }, value: -0.35, transition: 'linear' },
      { at: { musical: '7:1' }, value: 0.35 },
      { at: { musical: '8:1' }, value: -0.1 },
      { at: { musical: '11:1' }, value: -0.4, transition: 'linear' },
      { at: { musical: '13:1' }, value: 0.4 },
      { at: { musical: '14:1' }, value: 0 },
    ] } },
  { id: 'vox', sample: 'assets/glasshouse/04-ghost-vox.wav', mix: { gainDb: -6, pan: -0.2 },
    effects: [
      { type: 'reverb', roomSize: 0.5, decaySeconds: 1.2, wet: 0.2 },
      { type: 'saturation', driveDb: 3, mix: 0.15 },
    ] },
  { id: 'reverse', sample: 'assets/glasshouse/02-glass-reverse.wav', mix: { gainDb: -5, pan: 0 } },
  { id: 'prism', sample: 'assets/glasshouse/10-prism-impact.wav', mix: { gainDb: -1, pan: 0 } },
  { id: 'impact', sample: 'assets/orbital-foundry/07-cinematic-impact.wav', mix: { gainDb: -2, pan: 0 } },
];

const instrumentOf = (t) =>
  t.sample
    ? { type: 'sampler', sample: t.sample }
    : { type: 'drumkit', kit: `assets/${t.kit}/kit.json` };

// Sampler notes carry no pitch; drum-kit notes carry the mapped name.
const noteFor = (h, pitch) => {
  const n = { start: at(1, h.t) };
  if (pitch) n.pitch = pitch;
  if (h.v !== undefined) n.velocity = h.v;
  if (h.r !== undefined && (h.r !== 0 || h.g)) n.playbackRate = rate(h.r);
  if (h.g) n.glide = { to: h.g.to, duration: h.g.d };
  if (h.off) n.offsetSeconds = h.off;
  return n;
};

const patternsFor = (trackId) => {
  const bars = SCORE[trackId] || {};
  const patterns = [];
  const clips = [];
  for (const bar of Object.keys(bars).map(Number).sort((a, b) => a - b)) {
    const hits = bars[bar];
    if (!hits || hits.length === 0) continue;
    const id = `b${String(bar).padStart(2, '0')}`;
    const notes = [];
    for (const h of hits) {
      const names = Array.isArray(h.p) ? h.p : [h.p ?? null];
      for (const p of names) notes.push(noteFor(h, p));
    }
    notes.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
    patterns.push({ id, bars: 1, notes });
    clips.push({ bar, pattern: id });
  }
  return { patterns, clips };
};

const project = {
  formatVersion: 1,
  title: 'Glass Garage Ledger',
  description:
    'One glass-bell hook carried through bass-garage two-step, industrial percussion and a suction-into-impact payoff, then a callback ending.',
  bpm: BPM,
  timeSignature: '4/4',
  key: 'C# minor',
  bars: BARS,
  seed: 1,
  tracks: TRACKS.map((t) => {
    const { patterns, clips } = patternsFor(t.id);
    const track = { id: t.id, instrument: instrumentOf(t), clips, patterns, mix: t.mix };
    if (t.effects) track.effects = t.effects;
    if (t.automation) track.automation = t.automation;
    return track;
  }),
  master: {
    gainDb: -1.5,
    effects: [{ type: 'compressor', thresholdDb: -14, ratio: 2, attackMs: 12, releaseMs: 180, makeupGainDb: 0.5 }],
  },
  render: { duration: { bars: BARS }, tail: 'auto' },
};

const out = join(here, 'project.json');
writeFileSync(out, `${JSON.stringify(project, null, 2)}\n`);
const events = project.tracks.reduce(
  (sum, t) => sum + t.patterns.reduce((s, p) => s + p.notes.length, 0),
  0,
);
console.log(`wrote ${out}: ${project.tracks.length} tracks, ${events} triggers, ${BARS} bars at ${BPM} BPM`);
