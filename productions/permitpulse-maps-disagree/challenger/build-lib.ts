/** Shared build machinery: renders every distinct instrument sample once, writes one
 * DaemonV12 drum kit per (project, track), and emits ordinary DaemonV12 projects whose
 * container tempo is 150 BPM (1 tick = 1/2400 s; the 0.1 s picture grid is the 16th note). */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RATE, peakOf, wav } from './synth/dsp.ts';
import type { SampleSpec } from './synth/instruments.ts';

export const TICKS_PER_SECOND = 2400;
export const BAR = 1.6, STEP = 0.1;
/** Section-1/3 grid (150 BPM from frame 0): bar 1..n, sixteenth 1..16. */
export const at = (bar: number, step = 1) => round6((bar - 1) * BAR + (step - 1) * STEP);
export const round6 = (x: number) => Number(x.toFixed(6));

export interface Hit {
  at: number; s: SampleSpec; v: number; gate?: number; attack?: number; release?: number;
  rate?: number; glideTo?: number; glideSeconds?: number; offset?: number; choke?: string; why?: string;
}
export type Effect = Record<string, number | string>;
export interface TrackDef {
  id: string; role: 'music' | 'sound-design'; description: string; hits: Hit[];
  gainDb: number; pan?: number; effects: Effect[];
  gain?: [number, number, boolean?][]; panLane?: [number, number, boolean?][];
}
export interface SyncEvent { id: string; track: string; at: number; roles: string[] }
export interface Score { id: string; title: string; description: string; seconds: number; tracks: TrackDef[]; master: Record<string, unknown>; sync: SyncEvent[] }

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
export const ticks = (seconds: number) => Math.round(seconds * TICKS_PER_SECOND);
export const frameOfTick = (tick: number) => Number((BigInt(tick) * 400000n * 44100n + 480000000n) / 960000000n);
function position(seconds: number, bars: number): string {
  const t = ticks(seconds); if (t < 0 || t >= bars * 3840) throw new RangeError(`Onset outside container: ${seconds}`);
  const bar = Math.floor(t / 3840) + 1, r = t % 3840, b = Math.floor(r / 960) + 1, o = r % 960;
  if (!o) return `${bar}:${b}`;
  const g = gcd(o, 3840); return `${bar}:${b}+${o / g}/${3840 / g}`;
}
function fraction(seconds: number): string {
  let t = Math.max(1, ticks(seconds)), g = gcd(t, 3840);
  if (t / g > 9999) { t = Math.max(15, Math.round(t / 15) * 15); g = gcd(t, 3840); }
  return `${t / g}/${3840 / g}`;
}

/** Render the union of samples used by all scores into assets/ppc/s/<kit>/<name>.wav. */
export function renderSamples(projectDir: string, scores: Score[]) {
  const unique = new Map<string, SampleSpec>();
  for (const score of scores) for (const track of score.tracks) for (const hit of track.hits) unique.set(`${hit.s.kit}/${hit.s.name}`, hit.s);
  const catalog: Record<string, unknown>[] = [];
  for (const [path, s] of [...unique].sort(([a], [b]) => a.localeCompare(b))) {
    const data = s.render(), bytes = wav(data, s.gain), file = join(projectDir, 'assets/ppc/s', `${path}.wav`);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, bytes);
    catalog.push({ file: `assets/ppc/s/${path}.wav`, kit: s.kit, name: s.name, params: s.params, frames: (data instanceof Float64Array ? data : data[0]).length,
      channels: data instanceof Float64Array ? 1 : 2, peakDbfs: Number((20 * Math.log10(peakOf(data) * s.gain)).toFixed(2)), sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  return catalog;
}

/** Emit the DaemonV12 project plus a `daemonv12 sync` schedule. */
export function writeProject(projectDir: string, score: Score) {
  const bars = Math.ceil(score.seconds / BAR - 1e-9);
  const kitDir = join(projectDir, 'assets/ppc');
  const tracks = score.tracks.map(track => {
    const names = [...new Set(track.hits.map(h => `${h.s.kit}/${h.s.name}`))].sort();
    if (names.length > 128) throw new Error(`${track.id}: ${names.length} distinct samples (kit limit 128)`);
    const kitFile = `${score.id}-${track.id}.kit.json`;
    writeFileSync(join(kitDir, kitFile), JSON.stringify({ formatVersion: 1, samples: names.map((path, i) => ({ name: path.split('/')[1], pitch: i, file: `s/${path}.wav` })) }, null, 1) + '\n');
    const notes = track.hits.slice().sort((a, b) => a.at - b.at || a.s.name.localeCompare(b.s.name)).map(h => {
      const n: Record<string, unknown> = { start: position(h.at, bars), pitch: h.s.name, velocity: Number(Math.min(1, Math.max(0.01, h.v)).toFixed(4)) };
      if (h.rate !== undefined && h.rate !== 1) n.playbackRate = Number(h.rate.toFixed(6));
      if (h.offset !== undefined) n.offsetSeconds = h.offset;
      if (h.glideTo !== undefined) n.glide = { to: Number(h.glideTo.toFixed(6)), duration: fraction(h.glideSeconds!) };
      if (h.gate !== undefined) n.gate = fraction(h.gate);
      if (h.attack !== undefined || h.release !== undefined) n.envelope = { attackSeconds: round6(h.attack ?? 0.001), releaseSeconds: round6(h.release ?? 0.005) };
      if (h.choke) n.chokeGroup = h.choke;
      return n;
    });
    const lane = (points: [number, number, boolean?][]) => points.map(([t, v, lin]) => ({ at: { seconds: round6(t) }, value: round6(v), ...(lin ? { transition: 'linear' } : {}) }));
    const automation: Record<string, unknown> = {};
    if (track.gain) automation.gainDb = lane(track.gain);
    if (track.panLane) automation.pan = lane(track.panLane);
    return {
      id: track.id, description: `[${track.role}] ${track.description}`,
      instrument: { type: 'drumkit', kit: `assets/ppc/${kitFile}` },
      clips: [{ bar: 1, pattern: 'cue' }], patterns: [{ id: 'cue', bars, notes }],
      mix: { gainDb: track.gainDb, ...(track.pan ? { pan: track.pan } : {}) }, effects: track.effects,
      ...(Object.keys(automation).length ? { automation } : {}),
    };
  });
  const project = {
    formatVersion: 1, title: score.title, description: score.description, bpm: 150, timeSignature: '4/4', key: 'F minor', bars,
    render: { duration: { seconds: score.seconds }, tail: 'auto' }, master: score.master, tracks,
  };
  writeFileSync(join(projectDir, `${score.id}.json`), serialize(project) + '\n');
  const schedule = {
    sampleRate: RATE, fps: { numerator: 60, denominator: 1 },
    source: { repository: 'mataindustries/daemonv12', path: `productions/permitpulse-maps-disagree/challenger/project/${score.id}.json`, generator: 'productions/permitpulse-maps-disagree/challenger/build.ts' },
    events: score.sync.map((e, index) => ({ sampleFrame: frameOfTick(ticks(e.at)), trackId: e.track, eventId: e.id, velocity: 1, visualRoles: e.roles, source: { index, pictureSeconds: round6(e.at), engineTick: ticks(e.at) } })),
  };
  writeFileSync(join(projectDir, `${score.id}.sync-schedule.json`), JSON.stringify(schedule, null, 1) + '\n');
  return { bars, tracks: tracks.length, notes: tracks.reduce((n, t) => n + t.patterns[0]!.notes.length, 0) };
}

function serialize(value: unknown, indent = ''): string {
  if (Array.isArray(value)) {
    const flat = value.every(v => typeof v !== 'object' || v === null || Object.values(v as object).every(x => typeof x !== 'object' || (x !== null && !Array.isArray(x) && Object.values(x as object).every(y => typeof y !== 'object'))));
    if (flat) return value.length ? `[\n${value.map(v => `${indent}  ${JSON.stringify(v)}`).join(',\n')}\n${indent}]` : '[]';
    return `[\n${value.map(v => `${indent}  ${serialize(v, indent + '  ')}`).join(',\n')}\n${indent}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.every(([, v]) => typeof v !== 'object' || v === null)) return JSON.stringify(value);
    return `{\n${entries.map(([k, v]) => `${indent}  ${JSON.stringify(k)}: ${serialize(v, indent + '  ')}`).join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value);
}
