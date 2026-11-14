/**
 * V12 SIGNATURE bridge: the minimal adapter that lets pack sounds be written in a motif score.
 *
 * A FABLE score is an ordinary `score/2` motif score in which a part may name a pack sound instead of a rack
 * instrument:  { "id": "riff", "instrument": "v12/reactor", "v12": { "releaseSeconds": 0.03 }, "phrases": [...] }
 *
 * How it works, without touching the motif layer, the rack, the engine or the pack:
 *  1. For lowering only, every `v12/*` part is given the rack's `context/snare` as a carrier. That instrument accepts
 *     any pitch and has no per-note parameters, so `lowerScore` and `normalizeScore` resolve motifs, transforms,
 *     gestures (accent, soft, short), repeats and swing exactly as they do for rack parts.
 *  2. The carrier parts are then taken out again. Rack parts are rendered by the unchanged rack. The notes of the
 *     V12 parts become an ordinary engine project of `sampler` tracks (playbackRate from the pitch, gate from the
 *     note length, the part's envelope), rendered by the unchanged engine CLI from a scratch copy of the pack.
 *
 * Nothing here synthesises sound.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeScore, type NormalizedScore } from '../../studio-001/rack/score.ts';
import { renderScore, placed } from '../../studio-001/rack/render.ts';
import { lowerScore, motifReport, motifEvents } from '../../studio-001/motif/index.ts';
import type { ScoreInput, PartInput, NoteEvent } from '../../studio-001/rack/types.ts';
import { readWav } from '../crush/measure.ts';
import type { Stereo } from '../crush/crush.ts';

const here = dirname(fileURLToPath(import.meta.url)), repo = resolve(here, '..', '..');
const PACK_DIR = join(repo, 'packs', 'v12-signature-v1');
export const SR = 44100, CARRIER = 'context/snare';
const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';

export interface V12Options {
  /** per-voice envelope in output seconds (defaults 0.002 / 0.03) */
  attackSeconds?: number; releaseSeconds?: number;
  /** start reading inside the source WAV */
  offsetSeconds?: number;
  /** true: ignore note lengths and let every hit play to its end (drums, risers) */
  oneShot?: boolean;
  /** offsetSeconds is chosen per note so the source ends when the note ends (a riser that must land on a beat) */
  endAligned?: boolean;
}
export type FablePart = PartInput & { phrases?: unknown[]; v12?: V12Options };
export interface FableScore extends Omit<ScoreInput, 'parts'> { motifs: unknown[]; parts: FablePart[] }

interface Sound { id: string; file: string; root: number | null; seconds: number }
let sounds: Map<string, Sound> | undefined;
/** Pack sounds by id, read from the pack's own catalog. `root` is the MIDI pitch that plays at rate 1. */
export function packSounds(): Map<string, Sound> {
  if (!sounds) {
    const cat = JSON.parse(readFileSync(join(PACK_DIR, 'v12-signature.catalog.json'), 'utf8')) as { sounds: { id: string; file: string; rootMidi?: number | null; seconds: number }[] };
    sounds = new Map(cat.sounds.map(s => [s.id, { id: s.id, file: s.file, root: s.rootMidi ?? null, seconds: s.seconds }]));
  }
  return sounds;
}
const isV12 = (p: FablePart) => typeof p.instrument === 'string' && p.instrument.startsWith('v12/');
/** Engine position of a beat: "bar:beat+ticks/3840". */
function position(beat: number): string {
  const tick = Math.round(beat * 960), off = tick % 960;
  return `${Math.floor(tick / 3840) + 1}:${Math.floor(tick % 3840 / 960) + 1}${off ? `+${off}/3840` : ''}`;
}
const round6 = (x: number) => Number(x.toFixed(6));

export interface Lowered {
  /** the rack-only score/1 (what the rack renders) and its normalised form */
  rackScore: ScoreInput; rack: NormalizedScore | null;
  /** V12 parts: resolved notes (beats after swing) and their options */
  v12: { id: string; sound: Sound; gainDb: number; pan: number; options: V12Options; notes: NoteEvent[] }[];
  /** motif report and motif event map over all parts (carrier parts keep their own part ids) */
  report: unknown; motifEvents: unknown; warnings: string[];
  bpm: number; swing: number; endBeat: number;
}
/** Lower a FABLE score: motifs to notes for every part, then split into the rack's parts and the pack's parts. */
export function lowerFable(score: FableScore): Lowered {
  const v12Ids = new Map<string, { sound: Sound; options: V12Options; gainDb: number; pan: number }>();
  const carried = { ...score, parts: score.parts.map(p => {
    if (!isV12(p)) { if (p.v12) throw new Error(`part ${p.id}: "v12" options on a rack instrument`); return p; }
    const sound = packSounds().get(p.instrument.slice(4));
    if (!sound) throw new Error(`part ${p.id}: unknown pack sound "${p.instrument}" (${[...packSounds().keys()].join(', ')})`);
    const { v12, ...rest } = p;
    v12Ids.set(p.id, { sound, options: v12 ?? {}, gainDb: p.gainDb ?? 0, pan: p.pan ?? 0 });
    return { ...rest, instrument: CARRIER, gainDb: 0, pan: 0, room: 0 };
  }) };
  const lowered = lowerScore(carried);
  // The motif report covers the parts written as phrases (the rack normaliser takes at most 14 parts; drum parts are plain notes).
  const phrased = new Set(score.parts.filter(p => p.phrases?.length).map(p => p.id)), only = <T extends { id: string }>(ps: T[]) => ps.filter(p => phrased.has(p.id));
  const report = motifReport({ ...carried, parts: only(carried.parts) }, { ...lowered, score: { ...lowered.score, parts: only(lowered.score.parts) } }), events = motifEvents(carried, lowered);
  const all = lowered.score.parts, rackParts = all.filter(p => !v12Ids.has(p.id)), carrierParts = all.filter(p => v12Ids.has(p.id));
  const rackScore: ScoreInput = { ...lowered.score, parts: rackParts };
  const rack = rackParts.length ? normalizeScore(rackScore) : null;
  const v12: Lowered['v12'] = [];
  for (let i = 0; i < carrierParts.length; i += 14) { // the rack normaliser takes at most 14 parts at a time
    const n = normalizeScore({ ...lowered.score, parts: carrierParts.slice(i, i + 14) });
    for (const part of n.parts) { const v = v12Ids.get(part.id)!; v12.push({ id: part.id, ...v, notes: part.perf.notes }); }
  }
  const bars = score.sections.reduce((s, x) => s + x.bars, 0);
  return { rackScore, rack, v12, report, motifEvents: events, warnings: lowered.problems, bpm: score.bpm, swing: score.swing ?? 0.5, endBeat: bars * 4 };
}
/** The engine project that plays the V12 parts. Paths are relative to the scratch project directory. */
export function engineProject(l: Lowered, title: string, seconds: number) {
  const tracks = l.v12.filter(p => p.notes.length).map(p => {
    const o = p.options, envelope = { attackSeconds: o.attackSeconds ?? 0.002, releaseSeconds: o.releaseSeconds ?? 0.03 };
    const notes = p.notes.map(n => {
      const rate = round6(Math.pow(2, (n.pitch - (p.sound.root ?? 60)) / 12));
      if (rate < 0.25 || rate > 4) throw new Error(`part ${p.id}: pitch ${n.pitch} is outside the engine's playback range for ${p.sound.id}`);
      const ticks = Math.max(1, Math.round(n.beats * 960)), seconds = n.beats * 60 / l.bpm;
      const offset = o.endAligned ? Math.max(0, p.sound.seconds - seconds * rate) : o.offsetSeconds ?? 0;
      return { start: position(n.beat), velocity: round6(Math.min(1, Math.max(0.001, n.velocity))), ...(rate !== 1 ? { playbackRate: rate } : {}),
        ...(offset > 0 ? { offsetSeconds: round6(offset) } : {}), ...(o.oneShot || o.endAligned ? {} : { gate: `${ticks}/3840` }), envelope };
    });
    return { id: p.id, instrument: { type: 'sampler', sample: p.sound.file }, mix: { gainDb: p.gainDb, ...(p.pan ? { pan: p.pan } : {}) },
      clips: [{ bar: 1, pattern: 'p' }], patterns: [{ id: 'p', bars: l.endBeat / 4, notes }] };
  });
  return { formatVersion: 1, title, bpm: l.bpm, timeSignature: '4/4', key: 'A minor', bars: l.endBeat / 4, seed: 1, render: { duration: { seconds } }, tracks };
}

export interface RenderedFable { frames: number; stems: Map<string, Stereo>; project: unknown; engineClipped: Record<string, number> }
/**
 * Render every part once, dry, with a tail: rack parts through the rack (with their gain and pan), V12 parts through
 * the engine CLI. Every stem has `frames` = round((loop + tail) seconds x 44100) frames.
 */
export async function renderFable(l: Lowered, title: string, tailSeconds: number, log: (s: string) => void = () => {}): Promise<RenderedFable> {
  const seconds = l.endBeat * 60 / l.bpm + tailSeconds, frames = Math.round(seconds * SR), stems = new Map<string, Stereo>();
  const fit = (x: Stereo): Stereo => x.map(c => { const y = new Float64Array(frames); y.set(c.subarray(0, Math.min(frames, c.length))); return y; }) as Stereo;
  if (l.rack) {
    const r = await renderScore({ ...l.rack, tailSeconds }, log);
    for (const rp of r.parts) stems.set(rp.part.id, fit(placed(rp)));
  }
  const project = engineProject(l, title, round6(seconds)), engineClipped: Record<string, number> = {};
  if (project.tracks.length) {
    const work = mkdtempSync(join(tmpdir(), 'fable-v12-'));
    try {
      mkdirSync(join(work, 'assets')); cpSync(join(PACK_DIR, 'assets', 'v12-signature'), join(work, 'assets', 'v12-signature'), { recursive: true });
      writeFileSync(join(work, 'v12.json'), json(project));
      const r = spawnSync(process.execPath, [join(repo, 'bin', 'daemonv12.js'), 'render', join(work, 'v12.json'), '--out-dir', join(work, 'out'), '--stems', '--json'], { encoding: 'utf8', maxBuffer: 1 << 28 });
      if (r.status !== 0) throw new Error(`engine render failed: ${r.stdout.slice(0, 3000)} ${r.stderr.slice(0, 1000)}`);
      const manifest = (JSON.parse(r.stdout) as { manifest: { production?: { tracks?: { id?: string; trackId?: string; clippedSamples: number }[] } } }).manifest;
      for (const t of manifest.production?.tracks ?? []) engineClipped[t.id ?? t.trackId ?? '?'] = t.clippedSamples;
      for (const t of project.tracks) stems.set(t.id, fit(readWav(join(work, 'out', 'v12.stems', `${t.id}.wav`))));
      log(`engine: ${project.tracks.length} V12 tracks, ${project.tracks.reduce((s, t) => s + t.patterns[0]!.notes.length, 0)} notes`);
    } finally { rmSync(work, { recursive: true, force: true }); }
  }
  return { frames, stems, project, engineClipped };
}
/** Every sounding note of every part with its sample frame (beats are after swing): the map picture is cut to. */
export function noteEvents(l: Lowered) {
  const frame = (beat: number) => Math.round(beat * Math.round(60_000_000 / l.bpm) / 1_000_000 * SR);
  const rows = (id: string, source: string, notes: NoteEvent[]) => notes.map(n => ({ part: id, source, beat: round6(n.beat), frame: frame(n.beat), beats: round6(n.beats), pitch: n.pitch, velocity: round6(n.velocity) }));
  return { schema: 'daemonv12.fable-lab.note-events/1', sampleRate: SR, bpm: l.bpm, swing: l.swing, endBeat: l.endBeat, endFrame: frame(l.endBeat),
    events: [...(l.rack?.parts ?? []).flatMap(p => rows(p.id, p.instrument.id, p.perf.notes)), ...l.v12.flatMap(p => rows(p.id, `v12/${p.sound.id}`, p.notes))].sort((a, b) => a.frame - b.frame || a.part.localeCompare(b.part)) };
}
