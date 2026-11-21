/**
 * CONCRETE GOSPEL V2 · drum surgery. The V1 composition (experiments/concrete-gospel-001/compose.ts) is imported
 * unchanged: hook, choir, 808 notes, bell, clank, form and the far/near intro. Only these change:
 *   - kick: IRON PULSE (C2 body, gated 1/8) + skin slap C3 (knock, 1.5 ms early-aligned) + log rim C5 (click),
 *     all triggered per hit; V1's slow palm-stroke layer (peak 18 ms late) is gone
 *   - snare: TITANIUM CRACK (-2 st) + HEADLINER context snare (body, its own clap layer) + skin slap F3 (front crack),
 *     gated short; NEON CLAP and the reverb are gone
 *   - groove: new kick placement (an after-snare kick, the swoop left alone), occasional ghost snares,
 *     hats that leave the backbeat alone and roll only into section changes
 *   - 808: a short, deep duck under each kick (-10 dB, back by about 110 ms) instead of V1's -5 dB
 *   - mix: drums up, 808 down 1 dB, the reed darkened with a 5.5 kHz low-pass, gentler master
 *
 *   node experiments/concrete-gospel-002/compose.ts      writes source/
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as V1 from '../concrete-gospel-001/compose.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const { pos, dur, BARS, TAIL_SECONDS } = V1;
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const semis = (n: number) => r6(Math.pow(2, n / 12));
const jit = (i: number, amount: number) => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return (s - Math.floor(s) - 0.5) * 2 * amount; };
type EngineNote = Record<string, unknown>;

// ------------------------------------------------------------------------------------------------ the pocket
// Cycle = two bars (call bar, answer bar); backbeat on beat 3 of each bar (cycle beats 2 and 6).
// A2: kick on the one and the and-of-two as before, then a kick on the a-of-three right AFTER the snare
//     ("crack . boom") together with the 808's F2 jump; the F2->Ab1 swoop is now left alone (no kick under it),
//     so the next downbeat lands as a release. Bar 2 mirrors it (kick a-of-three after the snare), then nothing
//     until the downbeat while the 808 C2 pickup and the moan finish.
// B2: the 808's stutter gets three kicks, the after-snare kick, the octave hop and the Db2 walk-down get one each.
interface Cycle { kicks: [number, number][]; ghosts: [number, number][] }
const A2 = (c: number, ghosts: [number, number][] = [[3.25, 0.22]]): Cycle => ({
  kicks: [[0, 1], [1.5, 0.92], [2.75, 0.86], [4, 1], [5.5, 0.92], [6.75, 0.84]].map(([b, v]) => [c + b!, v!] as [number, number]),
  ghosts: ghosts.map(([b, v]) => [c + b, v] as [number, number]),
});
const B2 = (c: number, first = 1): Cycle => ({
  kicks: [[0, first], [0.75, 0.84], [1.5, 0.92], [2.75, 0.86], [4, 1], [5.25, 0.88], [7.25, 0.9]].map(([b, v]) => [c + b!, v!] as [number, number]),
  ghosts: [[c + 3.25, 0.22], [c + 7.75, 0.3]],
});
const cycles: Cycle[] = [
  A2(16),                                            // bars 5-6: the doors open
  A2(24, [[3.25, 0.22], [7.75, 0.32]]),              // bars 7-8: a ghost pickup into groove B
  B2(32),                                            // bars 9-10
  // bar 11, then a snare drag into... nothing: bar 12 is the drop-out
  { kicks: [[40, 1], [41.5, 0.92], [42.75, 0.86]], ghosts: [[43.5, 0.26], [43.75, 0.42]] },
  B2(48, 1),                                         // bars 13-14: the slam
  // bar 15 like groove B; bar 16: the last kick lands with the 808's final F1, the last snare on beat 3
  { kicks: [[56, 1], [56.75, 0.84], [57.5, 0.92], [58.75, 0.86], [60, 1], [61.5, 0.95]], ghosts: [[59.25, 0.22]] },
];
export const KICKS: [number, number][] = cycles.flatMap(c => c.kicks);
const GHOSTS: [number, number][] = cycles.flatMap(c => c.ghosts);
const BACKBEATS: number[] = [16, 24, 32, 48, 56].flatMap(c => [c + 2, c + 6]).filter(b => b !== 62).concat([42, 62]).sort((a, b) => a - b);

// ------------------------------------------------------------------------------------------------ kick and snare hits
// Layer levels are relative to the one-shot files the build renders (see build.ts). Measured on the first A/B render:
// with the click at 0.75 the kick's 1.5-6 kHz attack sat 5.5 dB under its low body (V1: 5.1 dB under), so the body
// is trimmed 1.4 dB and the click is rendered hotter and played at full layer level.
export const KICK_LAYER = { body: 0.85, knock: 0.9, click: 1 };
const kickHits: EngineNote[] = KICKS.flatMap(([b, v]) => [
  { start: pos(b), pitch: 'iron-pulse', velocity: r6(v * KICK_LAYER.body), playbackRate: semis(3), gate: dur(0.5), envelope: { attackSeconds: 0, releaseSeconds: 0.04 }, chokeGroup: 'body' },
  { start: pos(b), pitch: 'knock', velocity: r6(v * KICK_LAYER.knock), offsetSeconds: 0.0015, envelope: { attackSeconds: 0.0005, releaseSeconds: 0.02 }, gate: dur(0.25), chokeGroup: 'knock' },
  { start: pos(b), pitch: 'click', velocity: r6(v * KICK_LAYER.click), gate: dur(0.125), envelope: { attackSeconds: 0, releaseSeconds: 0.01 }, chokeGroup: 'click' },
]);
export const SNARE_LAYER = { crack: 0.83, body: 1, front: 0.83 };
const snareHits: EngineNote[] = [
  ...BACKBEATS.flatMap(b => [
    { start: pos(b), pitch: 'crack', velocity: SNARE_LAYER.crack, playbackRate: semis(-2), gate: dur(0.5), envelope: { attackSeconds: 0, releaseSeconds: 0.06 }, chokeGroup: 'crack' },
    { start: pos(b), pitch: 'body', velocity: SNARE_LAYER.body, gate: dur(0.5), envelope: { attackSeconds: 0, releaseSeconds: 0.05 }, chokeGroup: 'body' },
    { start: pos(b), pitch: 'front', velocity: SNARE_LAYER.front, chokeGroup: 'front' },
  ]),
  // ghosts: the TITANIUM layer alone, soft and short
  ...GHOSTS.map(([b, v]) => ({ start: pos(b), pitch: 'crack', velocity: v, playbackRate: semis(-2), gate: dur(0.125), envelope: { attackSeconds: 0.001, releaseSeconds: 0.02 }, chokeGroup: 'crack' })),
];

// ------------------------------------------------------------------------------------------------ hats
// The backbeat is left alone (no hat on the snare), the answer bar of groove B switches to triplet eighths under the
// hook's own triplet, and the only rolls are the ones that announce a change (into groove B, into the ending).
const hatHits: EngineNote[] = [];
let hi = 0;
const hat = (b: number, v: number, rate = 1, lean = true) => {
  const late = lean && Math.abs((b * 2) % 2 - 1) < 1e-9 ? 6 / 960 : 0;
  const n: EngineNote = { start: pos(b + late), pitch: 'ghost-tick', velocity: r6(Math.min(1, Math.max(0.05, v + jit(hi++, 0.03)))), chokeGroup: 'hats' };
  if (rate !== 1) n.playbackRate = r6(rate);
  hatHits.push(n);
};
const openHat = (b: number, v: number) => hatHits.push({ start: pos(b), pitch: 'open-circuit', velocity: v, gate: dur(0.5), envelope: { attackSeconds: 0.001, releaseSeconds: 0.06 }, chokeGroup: 'hats' });
const ON = 0.66, OFF = 0.42;
const eighths = (from: number, to: number, skip: number[] = [], on = ON, off = OFF) => {
  for (let b = from; b < to - 1e-9; b += 0.5) if (!skip.some(s => Math.abs(s - b) < 1e-9)) hat(b, Math.abs(b % 1) < 1e-9 ? on : off);
};
const triplets = (from: number, to: number, v0 = 0.5, v1 = 0.4) => { for (let b = from, i = 0; b < to - 1e-9; b += 1 / 3, i++) hat(r6(b), i % 3 === 0 ? v0 : v1, 1, false); };
const roll = (from: number, to: number, step: number, v0: number, v1: number, rate0 = 1, rate1 = 1) => {
  const n = Math.round((to - from) / step);
  for (let i = 0; i < n; i++) { const x = n > 1 ? i / (n - 1) : 0; hat(from + i * step, v0 + (v1 - v0) * x, rate0 + (rate1 - rate0) * x, false); }
};
eighths(8, 14, [], 0.26, 0.2);                                                          // bars 3-4 behind the wall (as V1)
eighths(16, 20, [18]); eighths(20, 22.5, [22]); openHat(23.5, 0.45);                    // bars 5-6: room under the moan
eighths(24, 28, [26]); eighths(28, 31, [30]);                                           // bars 7-8
roll(31, 31.5, 1 / 6, 0.34, 0.5, 1, 1.12); roll(31.5, 32, 0.125, 0.5, 0.72, 1.12, 1.26); //   the one roll: into groove B
eighths(32, 36, [34]); triplets(36, 37.5); eighths(37.5, 39, [38]); hat(39.5, 0.4, 1, false); hat(39.75, 0.5, 1, false); // bars 9-10
eighths(40, 42.5, [42]);                                                                // bar 11, then silence (snare drag only)
eighths(48, 51.5, [50]); openHat(51.5, 0.48); triplets(52, 53.5); eighths(53.5, 55, [54]); // bars 13-14
roll(55, 55.5, 1 / 6, 0.36, 0.52, 1, 1.12); roll(55.5, 56, 0.125, 0.52, 0.74, 1.12, 1.26); //   the roll into the ending
eighths(56, 59.5, [58]); hat(59.5, 0.42, 1, false); hat(59.75, 0.52, 1, false); eighths(60, 62, []);  // bars 15-16, stop at the last snare

// ------------------------------------------------------------------------------------------------ 808 duck and automation
type Point = { at: { musical: string }; value: number; transition?: 'linear' };
const pt = (beat: number, value: number, linear = true): Point => ({ at: { musical: pos(beat) }, value: r6(value), ...(linear ? { transition: 'linear' as const } : {}) });
export const DUCK = { depthDb: 14, holdDb: 8, holdTicks: 96, backTicks: 250, preTicks: 30 };
/** -14 dB on the kick, -8 dB at about 42 ms, back to the base by about 108 ms; the V1 bar-12 and ending fades kept. */
function duck808(base: number): Point[] {
  const pts: Point[] = [];
  const t = (n: number) => n / 960;
  for (const [k] of KICKS) {
    if (k === 48) pts.push(pt(44.2, base), pt(44.6, base - 40, false));
    pts.push(pt(k - t(DUCK.preTicks), base), pt(k, base - DUCK.depthDb), pt(k + t(DUCK.holdTicks), base - DUCK.holdDb), pt(k + t(DUCK.backTicks), base, k !== 61.5));
  }
  pts.push(pt(62.25, base), pt(63.75, base - 45, false));
  return pts;
}

// ------------------------------------------------------------------------------------------------ mix
// Track gains before TRIM_DB. Kick +1 and snare +1 dB relative to the first A/B (measured: kick 3.1 LU and snare 2.0 LU
// under the 808); the kick track has no headroom left, so everything else is trimmed instead of the kick raised.
// Master gain: chosen so the master chain rounds kick peaks by under 3 dB (at +5 dB it took 5.2 dB off the kick and
// 6.6 dB off the snare) with true peak under -1 dBTP; it lands at about V1's loudness.
export const MIX2 = { kick: 3, snare: 2.5, hats: 1, bass: -1, master: -2.3 };
const kitTrack = (id: string, description: string, kit: string, notes: EngineNote[], mix: Record<string, number>, effects: unknown[]) => ({
  id, description, instrument: { type: 'drumkit', kit }, mix, effects, clips: [{ bar: 1, pattern: 'all' }], patterns: [{ id: 'all', bars: BARS, notes }],
});
const v1 = (id: string) => structuredClone(V1.project.tracks.find(t => t.id === id)!) as Record<string, unknown>;
const bass = v1('bass808'); bass.mix = { gainDb: MIX2.bass }; bass.automation = { gainDb: duck808(MIX2.bass) };
const reed = v1('reed');
// the hook, subtly darkened so the snare crack and hats sit above it (V1 chain + a 5.5 kHz two-pole low-pass)
reed.effects = [...(reed.effects as unknown[]), { type: 'lowpass', frequencyHz: 5500 }];

const KICK_KIT_PATH = 'assets/kick-kit.json', SNARE_KIT_PATH = 'assets/snare-kit.json', V12 = 'assets/v12/kit.json';
const drumTracks = [
  kitTrack('kick', 'IRON PULSE at C2 (body, gated 1/8) + skin slap C3 (knock) + log rim C5 (click), one hit = three layers.', KICK_KIT_PATH, kickHits,
    { gainDb: MIX2.kick }, [{ type: 'highpass', frequencyHz: 32 }, { type: 'saturation', driveDb: 4, mix: 0.3 }]),
  kitTrack('snare', 'TITANIUM CRACK -2 st + HEADLINER context snare + skin slap F3, gated short; TITANIUM ghosts.', SNARE_KIT_PATH, snareHits,
    { gainDb: MIX2.snare }, [{ type: 'highpass', frequencyHz: 90 }, { type: 'saturation', driveDb: 5, mix: 0.35 }, { type: 'reverb', roomSize: 0.2, decaySeconds: 0.35, wet: 0.05 }]),
  kitTrack('hats', 'V12 GHOST TICK and OPEN CIRCUIT: the backbeat left alone, triplets under the hook, two announcing rolls.', V12, hatHits,
    { gainDb: MIX2.hats, pan: 0.12 }, [{ type: 'highpass', frequencyHz: 4000 }]),
];
/**
 * Gain staging: the layered kick peaks above full scale at the V1 track levels, so every track (and every automation
 * point) is trimmed by TRIM_DB and the master gain raised by the same amount. Balance is unchanged; tracks keep headroom.
 */
export const TRIM_DB = -4;
type Track = { mix?: { gainDb?: number }; automation?: { gainDb?: Point[] } };
function trim<T>(t: T): T {
  const x = t as Track, f = (v: number) => Math.max(-60, r6(v + TRIM_DB));
  if (x.mix && typeof x.mix.gainDb === 'number') x.mix.gainDb = f(x.mix.gainDb);
  if (x.automation?.gainDb) x.automation.gainDb = x.automation.gainDb.map(p => ({ ...p, value: f(p.value) }));
  return t;
}
const MASTER = { gainDb: MIX2.master - TRIM_DB, effects: [{ type: 'highpass', frequencyHz: 25 }, { type: 'compressor', thresholdDb: -14, ratio: 1.6, attackMs: 30, releaseMs: 150 }, { type: 'saturation', driveDb: 1.5, mix: 1 }] };

export const project = {
  ...V1.project,
  title: 'Concrete Gospel V2',
  description: 'DaemonV12 First Listening Benchmark, V2 (drum surgery). V1 composition unchanged; new kick and snare layering, pocket, hats, 808 duck and mix.',
  master: MASTER,
  tracks: [
    ...drumTracks,
    v1('toll'), v1('clank'), bass, v1('reed-far'), reed, v1('choir-far'), v1('choir'), v1('room-far'), v1('room'),
  ].map(t => trim(structuredClone(t))),
};
/** Drum-and-bass only, no master processing: the bus that the A/B compares against V1's equivalent stems. */
export const drumBassProject = {
  formatVersion: 1, title: 'Concrete Gospel V2 drum and bass', bpm: V1.BPM, timeSignature: '4/4', key: 'F minor', bars: BARS, seed: 1440,
  render: { tail: { seconds: TAIL_SECONDS } },
  master: { gainDb: -3 },  // headroom only: the A/B is loudness-matched afterwards
  tracks: [...drumTracks, bass].map(t => trim(structuredClone(t))),
};
/** The V1 rack score without its kick layers (the kick is now one-shots in the engine); reed, choir and 808 unchanged. */
export const rackScore = { ...V1.rackScore, title: 'Concrete Gospel V2', parts: V1.rackScore.parts.filter(p => !p.id.startsWith('kick-')) };

/** One-shots rendered with the rack's own `kit` command: [package, instrument, MIDI pitch, articulation, velocity, macro]. */
export const ONE_SHOTS: [string, string, number, string, number, number | undefined][] = [
  ['kick-knock', 'organic-percussion/skin', 48, 'slap', 0.7, 0.05],
  ['kick-click', 'organic-percussion/log', 72, 'rim', 0.85, 0.05],
  ['snare-front', 'organic-percussion/skin', 53, 'slap', 0.7, 0.05],
  ['snare-body', 'context/snare', 60, 'snare', 0.8, undefined],
];
const shot = (pkg: string, inst: string, pitch: number) => `oneshots/${pkg}/assets/${inst.replace(/\//g, '-')}/note-${pitch}.wav`;
export const KICK_KIT = { formatVersion: 1, samples: [
  { name: 'iron-pulse', pitch: 35, file: 'v12/02-iron-pulse.wav' },
  { name: 'knock', pitch: 36, file: shot('kick-knock', 'organic-percussion/skin', 48) },
  { name: 'click', pitch: 37, file: shot('kick-click', 'organic-percussion/log', 72) },
] };
export const SNARE_KIT = { formatVersion: 1, samples: [
  { name: 'crack', pitch: 38, file: 'v12/03-titanium-crack.wav' },
  { name: 'body', pitch: 40, file: shot('snare-body', 'context/snare', 60) },
  { name: 'front', pitch: 41, file: shot('snare-front', 'organic-percussion/skin', 53) },
] };
export const CHOIR_KIT_JSON = V1.CHOIR_KIT_JSON;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = join(HERE, 'source');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'concrete-gospel-v2.rack.json'), JSON.stringify(rackScore, null, 1) + '\n');
  writeFileSync(join(out, 'concrete-gospel-v2.project.json'), JSON.stringify(project, null, 1) + '\n');
  writeFileSync(join(out, 'drum-bass-v2.project.json'), JSON.stringify(drumBassProject, null, 1) + '\n');
  writeFileSync(join(out, 'kick-kit.json'), JSON.stringify(KICK_KIT, null, 2) + '\n');
  writeFileSync(join(out, 'snare-kit.json'), JSON.stringify(SNARE_KIT, null, 2) + '\n');
  console.log(`wrote ${out}: ${KICKS.length} kicks (${kickHits.length} layer triggers), ${BACKBEATS.length} backbeats + ${GHOSTS.length} ghosts, ${hatHits.length} hats`);
}
