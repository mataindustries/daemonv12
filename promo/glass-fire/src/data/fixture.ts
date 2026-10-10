// Placeholder music data so the full promo renders before the final song exists.
//
// This is NOT the song. It is a plausible 160 BPM arrangement written against the locked
// structure, turned into the exact PromoData shape the analyzer will produce from the real
// master and stems. Replace it by rendering with dataSource "sync" (SYNC_HANDOFF.md).
// Deterministic: a seeded PRNG, no Date, no Math.random.
import {dur, FPS, pos, ticksToSeconds, DURATION_SECONDS} from '../timeline/grid.ts';
import {
  SCHEMA_ID,
  STEM_IDS,
  type AutomationLane,
  type Marker,
  type Onset,
  type PromoData,
  type SampleId,
  type StemId,
} from './contract.ts';

export const FIXTURE_SEED = 0x47465f31;
const RATE = FPS;
const SAMPLES = RATE * DURATION_SECONDS + 1;

/** mulberry32: tiny, fast, and identical on every JS engine. */
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

type Event = {at: string; s: number; sample?: SampleId; variant?: string; len?: string};

const sec = (position: string) => ticksToSeconds(pos(position));
const len = (fraction: string) => ticksToSeconds(dur(fraction));

const beatsIn = (bars: number[], offsets: string[] = ['']) =>
  bars.flatMap(bar => [1, 2, 3, 4].flatMap(beat => offsets.map(o => `${bar}:${beat}${o}`)));

const SIXTEENTHS = ['', '+1/16', '+1/8', '+3/16'];
const STOPS: {id: string; at: string; len: string; label: string}[] = [
  {id: 'stop.pre-drop1', at: '4:4+1/8', len: '1/8', label: 'PRE-DROP GAP'},
  {id: 'stop.drop1', at: '6:4', len: '1/4', label: 'STOP'},
  {id: 'stop.pre-drop2', at: '10:4+1/8', len: '1/8', label: 'PRE-DROP GAP'},
  {id: 'stop.pre-payoff', at: '14:4+1/8', len: '1/8', label: 'PRE-PAYOFF GAP'},
];
const inStop = (position: string) => {
  const t = sec(position);
  return STOPS.some(s => t >= sec(s.at) - 1e-9 && t < sec(s.at) + len(s.len) - 1e-9);
};
const playable = (events: Event[]) => events.filter(e => !inStop(e.at));

// ---------------------------------------------------------------------------------------
// Arrangement (positions are DaemonV12 notation: BAR:BEAT+N/D, whole-note fractions)
// ---------------------------------------------------------------------------------------

const kick: Event[] = playable([
  ...['3:1', '3:3', '3:4+1/8', '4:1', '4:2', '4:3', '4:4'].map(at => ({at, s: 0.8})),
  ...beatsIn([5, 6, 7, 8]).map(at => ({at, s: at.endsWith(':1') ? 1 : 0.88})),
  {at: '7:3+1/8', s: 0.7},
  {at: '8:4+1/8', s: 0.75},
  ...beatsIn([11, 12, 13]).map(at => ({at, s: at.endsWith(':1') ? 1 : 0.9})),
  ...['11:4+1/8', '12:2+1/8', '12:4+1/8', '13:2+1/8', '13:4+1/8'].map(at => ({at, s: 0.72})),
  ...['14:1', '14:2', '14:3', '14:4'].map(at => ({at, s: 1})),
  {at: '15:1', s: 1},
]);

const sub: Event[] = playable([
  {at: '3:1', s: 0.75, len: '1/2'},
  {at: '3:3', s: 0.7, len: '1/4'},
  {at: '3:4+1/8', s: 0.7, len: '1/8'},
  {at: '4:1', s: 0.85, len: '7/8'},
  ...beatsIn([5, 6, 7, 8], ['+1/8']).map(at => ({at, s: 0.9, len: '1/8'})),
  ...beatsIn([11, 12, 13], ['+1/8']).map(at => ({at, s: 0.95, len: '1/16'})),
  ...beatsIn([11, 12, 13], ['+3/16']).filter(at => /:[24]\+/.test(at)).map(at => ({at, s: 0.8, len: '1/16'})),
  ...['14:1', '14:2', '14:3', '14:4'].map(at => ({at, s: 1, len: '1/16'})),
  {at: '15:1', s: 1, len: '1/2'},
  {at: '16:1', s: 0.7, len: '1/2'},
]);

const clap: Event[] = playable([
  {at: '4:2', s: 0.7},
  {at: '4:4', s: 0.75},
  ...beatsIn([5, 6, 7, 8]).filter(at => /:[24]$/.test(at)).map(at => ({at, s: 0.9})),
  ...beatsIn([11, 12, 13, 14]).filter(at => /:[24]$/.test(at)).map(at => ({at, s: 0.95})),
  {at: '12:4+1/16', s: 0.55},
  {at: '13:4+1/16', s: 0.55},
  {at: '15:1', s: 1},
]);

const roll = (bar: number) => ['', '+1/32', '+1/16', '+3/32', '+1/8', '+5/32', '+3/16', '+7/32'].map(o => `${bar}:4${o}`);
const hat: Event[] = playable([
  ...beatsIn([3], ['', '+1/8']).map(at => ({at, s: at.includes('+') ? 0.7 : 0.45})),
  ...beatsIn([4], SIXTEENTHS).filter(at => !at.startsWith('4:4')).map(at => ({at, s: at.endsWith('+1/8') ? 0.8 : 0.5})),
  ...['4:4', '4:4+1/32', '4:4+1/16', '4:4+3/32'].map((at, i) => ({at, s: 0.5 + i * 0.12})),
  ...beatsIn([5, 6, 7, 8], SIXTEENTHS).map(at => ({at, s: at.endsWith('+1/8') ? 0.9 : 0.55})),
  ...beatsIn([11, 12, 13], SIXTEENTHS).filter(at => !/:4/.test(at)).map(at => ({at, s: at.endsWith('+1/8') ? 0.95 : 0.6})),
  ...[11, 12, 13].flatMap(roll).map((at, i) => ({at, s: 0.45 + (i % 8) * 0.07})),
  ...beatsIn([14], SIXTEENTHS).map(at => ({at, s: at.endsWith('+1/8') ? 0.95 : 0.6})),
]);

const motifA = (bar: number, first: SampleId = 'glass-hit'): Event[] => [
  {at: `${bar}:1`, s: 1, sample: first},
  {at: `${bar}:1+3/16`, s: 0.7, sample: 'glass-hit'},
  {at: `${bar}:2+1/8`, s: 0.75, sample: 'glass-crush'},
  {at: `${bar}:3+1/16`, s: 0.65, sample: 'glass-hit'},
  {at: `${bar}:4`, s: 0.8, sample: 'glass-hit'},
];
const motifB = (bar: number): Event[] => [
  {at: `${bar}:1+1/8`, s: 0.8, sample: 'glass-hit'},
  {at: `${bar}:2`, s: 0.6, sample: 'glass-hit'},
  {at: `${bar}:3`, s: 0.8, sample: 'glass-crush'},
  {at: `${bar}:3+3/16`, s: 0.6, sample: 'glass-hit'},
  {at: `${bar}:4+1/8`, s: 0.7, sample: 'glass-hit'},
];
const motifC = (bar: number, first: SampleId = 'glass-hit'): Event[] => [
  {at: `${bar}:1`, s: 1, sample: first},
  {at: `${bar}:1+1/8`, s: 0.7, sample: 'glass-hit', variant: 'chop', len: '1/32'},
  {at: `${bar}:1+3/16`, s: 0.65, sample: 'glass-hit', variant: 'chop', len: '1/32'},
  {at: `${bar}:2+1/16`, s: 0.75, sample: 'glass-hit'},
  {at: `${bar}:2+3/16`, s: 0.8, sample: 'glass-crush'},
  {at: `${bar}:3`, s: 0.85, sample: 'glass-hit'},
  {at: `${bar}:3+3/16`, s: 0.6, sample: 'glass-hit', variant: 'chop', len: '1/32'},
  {at: `${bar}:4+1/16`, s: 0.75, sample: 'glass-hit'},
];

const glass: Event[] = playable([
  // Act 1: one sound, then its first mutations.
  {at: '1:3', s: 0.95, sample: 'glass-hit'},
  {at: '2:1', s: 0.9, sample: 'glass-hit'},
  {at: '2:2', s: 0.85, sample: 'glass-crush'},
  {at: '2:3', s: 0.75, sample: 'glass-reverse', len: '1/2'},
  // Act 2
  {at: '3:2+1/8', s: 0.6, sample: 'glass-hit'},
  {at: '3:4', s: 0.55, sample: 'glass-hit'},
  {at: '4:1+3/16', s: 0.6, sample: 'glass-crush'},
  {at: '4:2+1/8', s: 0.7, sample: 'glass-reverse', len: '1/2'},
  // Drop 1
  ...motifA(5, 'prism-impact'),
  ...motifB(6),
  ...motifA(7),
  ...motifB(8),
  // Fakeout: ONE SOUND. MUTATED. GLASS.HIT → REVERSE, CRUSH, CHOP
  {at: '9:1', s: 1, sample: 'glass-hit'},
  {at: '9:3', s: 0.9, sample: 'glass-crush'},
  {at: '10:1', s: 0.95, sample: 'glass-hit'},
  {at: '10:2', s: 0.8, sample: 'glass-reverse', len: '1/4'},
  {at: '10:3', s: 0.85, sample: 'glass-crush'},
  ...['10:4', '10:4+1/32', '10:4+1/16', '10:4+3/32'].map((at, i) => ({at, s: 0.9 - i * 0.05, sample: 'glass-hit' as const, variant: 'chop', len: '1/32'})),
  // Drop 2
  ...motifC(11, 'prism-impact'),
  ...motifC(12),
  ...motifC(13),
  ...['14:1', '14:2', '14:3', '14:4'].map((at, i) => ({at, s: 1, sample: (i === 2 ? 'glass-crush' : 'glass-hit') as SampleId})),
  // Payoff
  {at: '15:1', s: 1, sample: 'prism-impact'},
  {at: '15:3', s: 0.5, sample: 'glass-hit'},
  {at: '15:4', s: 0.7, sample: 'glass-hit'},
  {at: '16:1', s: 0.8, sample: 'glass-hit'},
  {at: '16:2', s: 0.6, sample: 'glass-hit'},
]);

const vox: Event[] = playable([
  {at: '3:3+1/16', s: 0.6, sample: 'vox-chip'},
  {at: '4:1+1/8', s: 0.65, sample: 'vox-chip'},
  {at: '4:3', s: 0.5, sample: 'ghost-vox', len: '1/8'},
  {at: '5:2+1/8', s: 0.8, sample: 'vox-chip'},
  {at: '5:4+1/16', s: 0.7, sample: 'vox-chip'},
  {at: '6:2+1/8', s: 0.8, sample: 'vox-chip'},
  {at: '7:1+1/8', s: 0.75, sample: 'vox-chip'},
  {at: '7:3', s: 0.6, sample: 'ghost-vox', len: '1/8'},
  {at: '8:2+1/8', s: 0.8, sample: 'vox-chip'},
  {at: '8:4', s: 0.75, sample: 'ghost-vox', len: '3/16'},
  ...[11, 12, 13].flatMap(bar => [`${bar}:1+1/8`, `${bar}:2+3/16`, `${bar}:3+1/8`]).filter(at => at !== '12:3+1/8').map(at => ({at, s: 0.8, sample: 'vox-chip' as const})),
  {at: '12:3', s: 0.9, sample: 'ghost-vox', len: '3/16'},
]);

const ARRANGEMENT: Record<StemId, Event[]> = {kick, sub, glass, vox, clap, hat};

// ---------------------------------------------------------------------------------------
// Envelope synthesis: each onset contributes a characteristic amplitude shape
// ---------------------------------------------------------------------------------------

type Shape = (dt: number, e: Event) => number;
const decay = (tau: number, attack = 0.002): Shape => dt => (dt < 0 ? 0 : Math.min(1, dt / attack) * Math.exp(-Math.max(0, dt - attack) / tau));
const sustained = (attack: number, release: number, fallback: string): Shape => (dt, e) => {
  if (dt < 0) return 0;
  const length = len(e.len ?? fallback);
  const body = Math.min(1, dt / attack) * (0.92 - 0.12 * Math.min(1, dt / Math.max(length, 0.01)));
  return dt <= length ? body : body * Math.exp(-(dt - length) / release);
};
const reverse: Shape = (dt, e) => {
  const length = len(e.len ?? '1/2');
  if (dt < 0 || dt > length) return 0;
  const x = dt / length;
  return (Math.exp(4.2 * x) - 1) / (Math.exp(4.2) - 1);
};

const SHAPES: Record<StemId, Shape> = {
  kick: decay(0.11),
  sub: sustained(0.008, 0.05, '1/8'),
  glass: (dt, e) => {
    if (e.sample === 'glass-reverse') return reverse(dt, e);
    if (e.variant === 'chop') return sustained(0.002, 0.012, '1/32')(dt, e);
    if (e.sample === 'prism-impact') return decay(0.55)(dt, e);
    if (e.sample === 'glass-crush') return decay(0.16)(dt, e);
    return decay(0.3)(dt, e);
  },
  vox: (dt, e) => (e.sample === 'ghost-vox' ? sustained(0.05, 0.14, '1/8')(dt, e) : decay(0.075, 0.004)(dt, e)),
  clap: decay(0.075, 0.003),
  hat: decay(0.028, 0.001),
};

const SHAPE_HORIZON = 1.6;

const toOnset = (e: Event, strength: number): Onset => {
  const onset: Onset = {t: sec(e.at), strength};
  if (e.sample) onset.sample = e.sample;
  if (e.variant) onset.variant = e.variant;
  if (e.len) onset.duration = len(e.len);
  return onset;
};

const round = (v: number, digits = 4) => Math.round(v * 10 ** digits) / 10 ** digits;

// Rough spectral fingerprints per stem across the 8 bands below.
const BAND_EDGES = [20, 60, 150, 400, 1000, 2500, 6000, 12000, 20000];
const PROFILES: Record<StemId, number[]> = {
  kick: [0.75, 1, 0.55, 0.22, 0.1, 0.05, 0.02, 0.01],
  sub: [1, 0.65, 0.12, 0.02, 0, 0, 0, 0],
  glass: [0, 0, 0.04, 0.22, 0.62, 1, 0.82, 0.5],
  vox: [0, 0.05, 0.32, 0.85, 1, 0.5, 0.22, 0.06],
  clap: [0, 0.08, 0.3, 0.62, 0.92, 1, 0.66, 0.36],
  hat: [0, 0, 0, 0.04, 0.18, 0.5, 1, 0.9],
};
const MASTER_WEIGHTS: Record<StemId, number> = {kick: 0.95, sub: 0.75, glass: 0.6, vox: 0.5, clap: 0.6, hat: 0.22};

const automation = (): AutomationLane[] => {
  const p = (at: string, v: number) => ({t: round(sec(at), 6), v});
  const kicks = ARRANGEMENT.kick.filter(e => sec(e.at) >= sec('12:1') && sec(e.at) < sec('14:1')).map(e => sec(e.at)).sort((a, b) => a - b);
  const duck = [{t: 0, v: 0}];
  for (const k of kicks) duck.push({t: round(k, 6), v: 0}, {t: round(k + 0.006, 6), v: -9}, {t: round(k + 0.17, 6), v: -1.5});
  duck.push({t: round(sec('14:1'), 6), v: 0});
  return [
    {
      id: 'glass.lpf', label: 'LPF', target: 'glass', unit: 'Hz', range: [200, 20000],
      points: [p('1:1', 18000), p('3:1', 700), p('4:4+1/8', 18000), p('8:4+1/8', 18000), p('9:1', 900), p('10:4+1/8', 900), p('11:1', 18000), p('13:1', 18000), p('13:3', 1600), p('14:1', 18000)],
    },
    {id: 'sub.duck', label: 'DUCK', target: 'sub', unit: 'dB', range: [-12, 0], points: duck},
    {
      id: 'vox.delay', label: 'DELAY 3/16', target: 'vox', unit: '%', range: [0, 100],
      points: [p('1:1', 0), p('8:4', 0), p('8:4+1/32', 80), p('9:1', 80), p('9:1+1/16', 0), p('12:3', 0), p('12:3+1/32', 100), p('12:4+1/8', 100), p('13:1', 0)],
    },
    {
      id: 'master.hpf', label: 'HPF', target: 'master', unit: 'Hz', range: [20, 2000],
      points: [p('1:1', 20), p('8:4+1/8', 20), p('9:1', 420), p('10:4', 420), p('10:4+1/8', 20)],
    },
    {
      id: 'glass.pan', label: 'PAN', target: 'glass', unit: 'pan', range: [-1, 1],
      points: [p('1:1', 0), p('11:1', 0), p('11:2', -0.85), p('11:3', 0.85), p('11:4', -0.6), p('12:1', 0), p('12:2', 0.9), p('12:3', -0.9), p('13:1', 0), p('13:2', -0.7), p('13:3', 0.7), p('14:1', 0)],
    },
  ];
};

const markers = (): Marker[] => {
  const list: Marker[] = [
    {t: 0, kind: 'section', id: 'hook', label: 'HOOK'},
    {t: sec('3:1'), kind: 'section', id: 'ignition', label: 'IGNITION'},
    {t: sec('5:1'), kind: 'drop', id: 'drop1', label: 'DROP 1'},
    {t: sec('9:1'), kind: 'section', id: 'fakeout', label: 'FAKEOUT'},
    {t: sec('11:1'), kind: 'drop', id: 'drop2', label: 'DROP 2'},
    {t: sec('15:1'), kind: 'section', id: 'payoff', label: 'PAYOFF'},
    {t: sec('15:1'), kind: 'hit', id: 'final-impact', label: 'PRISM IMPACT'},
    {t: sec('16:4'), kind: 'end', id: 'end', label: 'END'},
    ...STOPS.map(s => ({t: sec(s.at), kind: 'stop' as const, id: s.id, label: s.label, duration: len(s.len)})),
  ];
  return list.sort((a, b) => a.t - b.t || a.id.localeCompare(b.id)).map(m => ({...m, t: round(m.t, 6), ...(m.duration ? {duration: round(m.duration, 6)} : {})}));
};

export const buildFixture = (seed = FIXTURE_SEED): PromoData => {
  const random = mulberry32(seed);
  const stems = {} as PromoData['stems'];
  const envs = {} as Record<StemId, number[]>;

  for (const id of STEM_IDS) {
    const events = [...ARRANGEMENT[id]].sort((a, b) => sec(a.at) - sec(b.at));
    const strengths = events.map(e => Math.min(1, Math.max(0.05, e.s + (random() - 0.5) * 0.06)));
    const values = new Array<number>(SAMPLES).fill(0);
    for (let i = 0; i < SAMPLES; i++) {
      const t = i / RATE;
      let quiet = 1;
      for (let k = 0; k < events.length; k++) {
        const dt = t - sec(events[k]!.at);
        if (dt < 0) break;
        if (dt > SHAPE_HORIZON) continue;
        quiet *= 1 - Math.min(0.999, strengths[k]! * SHAPES[id](dt, events[k]!));
      }
      values[i] = 1 - quiet;
    }
    envs[id] = values;
    stems[id] = {
      envelope: {rate: RATE, values: values.map(v => round(v))},
      onsets: events.map((e, k) => toOnset(e, round(strengths[k]!, 3))),
    };
  }

  const masterRaw = envs.kick.map((_, i) => 1 - Math.exp(-1.8 * STEM_IDS.reduce((sum, id) => sum + MASTER_WEIGHTS[id] * envs[id][i]!, 0)));
  const masterPeak = Math.max(...masterRaw);

  const spectrumValues = envs.kick.map((_, i) => {
    const activity = masterRaw[i]! / masterPeak;
    return PROFILES.kick.map((__, band) => {
      const energy = STEM_IDS.reduce((sum, id) => sum + envs[id][i]! * PROFILES[id][band]!, 0);
      const flicker = (random() - 0.5) * 0.08 * activity;
      return round(Math.min(1, Math.max(0, 1 - Math.exp(-1.7 * energy) + flicker)), 3);
    });
  });

  return {
    schema: SCHEMA_ID,
    source: {
      kind: 'fixture',
      generator: `glass-fire fixture (seed 0x${seed.toString(16)})`,
      note: 'Placeholder arrangement for development. Not the song.',
    },
    timing: {bpm: 160, beatsPerBar: 4, bars: 16, durationSeconds: DURATION_SECONDS},
    master: {envelope: {rate: RATE, values: masterRaw.map(v => round(v / masterPeak))}},
    stems,
    spectrum: {rate: RATE, bandEdgesHz: BAND_EDGES, values: spectrumValues},
    automation: automation(),
    markers: markers(),
  };
};
