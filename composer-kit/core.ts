/**
 * DaemonV12 Composer Kit · core. A Draft is a score-in-progress: explicit notes per part plus a "heat" lane
 * (0 cold .. 1 hot) that each patch turns into macro/control curves at the end. Moves edit Drafts; finalize()
 * turns a Draft into a Signature Rack score (studio-001). Nothing here touches the rack, src/ or mcp/.
 * Importing the kit registers the Timbre Lab instruments (organic percussion, breath reed) for this process, so
 * kit scores that use them render without any flag; the rack's own files stay untouched.
 */
import '../timbre-lab/register.ts';
import { getInstrument } from '../timbre-lab/registry.ts';
import { pitchOf, keyOf } from '../studio-001/rack/curves.ts';

export type Opts = Record<string, number | string>;
/** [beat, beats, MIDI pitch, velocity, options] — options: articulation, slide and the instrument's per-note params. */
export type N = [number, number, number, number, Opts?];
export type NoteIn = [number, number, string | number, number?, Opts?];
export type Pair = number | [number, number];
export type Curve = number | [number, number][];

export interface Patch {
  id: string; instrument: string;
  /** dirty | rubbery | mechanical | glassy | broken | human | utility */
  character: string;
  /** one line: what it sounds like and where it works */
  where: string;
  /** macro at heat 0 and heat 1 (the patch's journey) */
  macro: Pair;
  controls?: Record<string, Pair>;
  setup?: Record<string, number>;
  /** living-bass motion presets, cold .. hot */
  motion?: string[];
  /** default articulation for notes that carry none; hotArt replaces it when heat >= 0.6, coldArt when heat < 0.3 */
  art?: string; hotArt?: string; coldArt?: string;
  /** one player, one breath: a note that touches the previous one is played legato (no new attack) */
  legato?: boolean;
  /** default per-note params (vowel, scoop, ...) for notes that carry none of that name */
  params?: Opts;
  /** legato: notes that touch the previous note slide into it over this many beats */
  slide?: number;
  gainDb?: number; pan?: number; room?: number;
  humanize?: { timingMs: number; velocity: number };
  /** not listed in the palette (drums) */
  internal?: boolean;
}

export interface HeatSeg { from: number; to: number; a: number; b: number }
export interface Texture { fromBeat: number; toBeat: number; density: number; pitches: number[] }
export interface DPart {
  id: string; patch: Patch; notes: N[]; heat: HeatSeg[];
  /** living-bass motion preset override per bar */
  motionBars: (string | undefined)[];
  textures: Texture[]; gainDb?: number; pan?: number;
}
export interface DSection { id: string; bars: number; start: number; end: number; note: string }
export interface Draft {
  title: string; bpm: number; key: string; tonic: number; minor: boolean; swing: number; seed: number;
  tailSeconds: number; room: Record<string, number>; description: string;
  sections: DSection[]; parts: DPart[];
  /** the hook: owner part id and its cell (beats relative to the cell start) */
  hook: { owner: string; bars: number; notes: N[]; alt?: N[] };
  /** what was done, for the score's `kit` block and the critique */
  log: string[];
}

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => { let t = (s = (s + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const r3 = (x: number) => Math.round(x * 1000) / 1000;
export const pairAt = (p: Pair, h: number) => (typeof p === 'number' ? p : lerp(p[0], p[1], h));
export const clone = <T>(x: T): T => structuredClone(x);
export const midi = (p: string | number) => pitchOf(p);
export function keyInfo(key: string) { const k = keyOf(key); return { tonic: k.tonic, minor: k.mode === 'minor' }; }
/** Tonic placed at or above `floor` (MIDI). */
export const tonicFrom = (d: { tonic: number }, floor: number) => { let t = d.tonic; while (t < floor) t += 12; return t; };
/** Kit lines are written in minor-ish semitones; in a major key the third and sixth are raised. */
export const degree = (semi: number, minor: boolean) => { const pc = ((semi % 12) + 12) % 12; return minor || (pc !== 3 && pc !== 8) ? semi : semi + 1; };

export const section = (d: Draft, id: string): DSection => { const s = d.sections.find(x => x.id === id); if (!s) throw new Error(`no section "${id}" (have: ${d.sections.map(x => x.id).join(', ')})`); return s; };
export const part = (d: Draft, id: string): DPart => { const p = d.parts.find(x => x.id === id); if (!p) throw new Error(`no part "${id}" (have: ${d.parts.map(x => x.id).join(', ')})`); return p; };
export const hasPart = (d: Draft, id: string) => d.parts.some(x => x.id === id);
export const inRange = (n: N, from: number, to: number) => n[0] >= from - 1e-6 && n[0] < to - 1e-6;
export const notesIn = (p: DPart, from: number, to: number) => p.notes.filter(n => inRange(n, from, to));
export const cut = (p: DPart, from: number, to: number) => { p.notes = p.notes.filter(n => !inRange(n, from, to)); };
/** Shorten notes that ring into [from, ...) so the window is really empty. */
export function choke(p: DPart, from: number) { for (const n of p.notes) if (n[0] < from && n[0] + n[1] > from) n[1] = Math.max(0.1, r3(from - n[0])); }
export const isDrum = (p: DPart) => p.patch.instrument.startsWith('context/');
export const RHYTHM = ['kick', 'snare', 'hat', 'perc', 'perc2'];

/** Set a part's heat over [from, to): constant, or a ramp a -> b. Replaces whatever was there. */
export function setHeat(p: DPart, from: number, to: number, a: number, b = a) {
  const out: HeatSeg[] = [];
  for (const s of p.heat) {
    if (s.to <= from || s.from >= to) { out.push(s); continue; }
    const at = (x: number) => lerp(s.a, s.b, (x - s.from) / Math.max(1e-9, s.to - s.from));
    if (s.from < from) out.push({ from: s.from, to: from, a: s.a, b: at(from) });
    if (s.to > to) out.push({ from: to, to: s.to, a: at(to), b: s.b });
  }
  out.push({ from, to, a, b });
  p.heat = out.sort((x, y) => x.from - y.from);
}
export function heatAt(p: DPart, beat: number): number {
  let last = 0.3;
  for (const s of p.heat) { if (beat < s.from) return last; if (beat < s.to) return lerp(s.a, s.b, (beat - s.from) / Math.max(1e-9, s.to - s.from)); last = s.b; }
  return last;
}
function curveOf(pair: Pair, heat: HeatSeg[]): Curve {
  if (typeof pair === 'number' || !heat.length) return pairAt(pair, 0.3);
  const pts: [number, number][] = [];
  heat.forEach((s, i) => {
    const prev = heat[i - 1], jump = !!prev && Math.abs(prev.b - s.a) > 1e-6;
    pts.push([r3(s.from + (jump ? Math.min(0.25, (s.to - s.from) / 2) : 0)), r3(pairAt(pair, s.a))], [r3(s.to), r3(pairAt(pair, s.b))]);
  });
  const flat = pts.every(p => p[1] === pts[0]![1]);
  return flat ? pts[0]![1] : pts.filter((p, i) => i === 0 || p[0] > pts[i - 1]![0] || p[1] !== pts[i - 1]![1]);
}

/** Move a whole line by octaves so it sits in the instrument's range; fold single notes only if it still doesn't fit. */
export function fit(notes: N[], range: [number, number]): N[] {
  if (!notes.length) return notes;
  const lo = Math.min(...notes.map(n => n[2])), hi = Math.max(...notes.map(n => n[2]));
  let shift = 0;
  while (lo + shift < range[0]) shift += 12;
  while (hi + shift > range[1] && lo + shift - 12 >= range[0]) shift -= 12;
  return notes.map(n => { let p = n[2] + shift; while (p > range[1]) p -= 12; while (p < range[0]) p += 12; return [n[0], n[1], p, n[3], n[4]] as N; });
}
/** Strip articulations and params another instrument does not know (used when a line changes hands). */
export function plain(notes: N[]): N[] { return notes.map(n => [n[0], n[1], n[2], n[3]] as N); }

/** Draft -> Signature Rack score JSON. */
export function finalize(d: Draft) {
  const endBeat = d.sections.reduce((a, s) => a + s.bars * 4, 0);
  const parts = d.parts.map((p, index) => {
    const inst = getInstrument(p.patch.instrument);
    if (!inst) throw new Error(`patch ${p.patch.id}: unknown instrument ${p.patch.instrument}`);
    const drum = inst.family === 'context';
    let notes = p.notes.filter(n => n[0] >= 0 && n[0] < endBeat - 0.01).sort((a, b) => a[0] - b[0] || a[2] - b[2]);
    if (!drum) notes = fit(notes, inst.range as [number, number]);
    const out = notes.map((n, i) => {
      const o: Opts = { ...(n[4] ?? {}) }, h = heatAt(p, n[0]), prev = notes[i - 1];
      const touches = !!prev && prev[0] + prev[1] >= n[0] - 0.05 && prev[2] !== n[2];
      if (o.articulation === undefined && p.patch.legato && touches) o.articulation = 'legato';
      if (o.articulation === undefined) { const a = h >= 0.6 && p.patch.hotArt ? p.patch.hotArt : h < 0.3 && p.patch.coldArt ? p.patch.coldArt : p.patch.art; if (a) o.articulation = a; }
      if (o.articulation !== undefined && !(String(o.articulation) in inst.articulations)) delete o.articulation;
      for (const [k, v] of Object.entries(p.patch.params ?? {})) if (o[k] === undefined) o[k] = v;
      if (p.patch.slide && o.slide === undefined && touches && (!o.articulation || (p.patch.legato && o.articulation === 'legato'))) o.slide = p.patch.slide;
      for (const k of Object.keys(o)) if (k !== 'articulation' && k !== 'slide' && !(k in inst.params)) delete o[k];
      return [r3(n[0]), r3(Math.max(0.05, n[1])), n[2], r3(Math.min(1, Math.max(0.05, n[3]))), ...(Object.keys(o).length ? [o] : [])];
    });
    const controls: Record<string, Curve> = {};
    for (const [k, v] of Object.entries(p.patch.controls ?? {})) controls[k] = curveOf(v, p.heat);
    const motion: { fromBeat: number; toBeat: number; preset: string }[] = [];
    if (inst.family === 'living-bass') {
      const presets = p.patch.motion ?? ['eighths', 'sixteenths', 'growl'];
      for (let bar = 0; bar < endBeat / 4; bar++) {
        const preset = p.motionBars[bar] ?? presets[Math.min(presets.length - 1, Math.floor(heatAt(p, bar * 4 + 2) * presets.length))]!;
        const last = motion[motion.length - 1];
        if (last && last.preset === preset) last.toBeat = bar * 4 + 4; else motion.push({ fromBeat: bar * 4, toBeat: bar * 4 + 4, preset });
      }
    }
    const hz = p.patch.humanize;
    return {
      id: p.id, instrument: p.patch.instrument, gainDb: p.gainDb ?? p.patch.gainDb ?? inst.suggestedGainDb,
      ...(p.pan ?? p.patch.pan ? { pan: p.pan ?? p.patch.pan } : {}), ...(p.patch.room !== undefined ? { room: p.patch.room } : {}), ...(drum ? { context: true } : {}),
      ...(drum ? {} : { macro: curveOf(p.patch.macro, p.heat), expression: curveOf([0.6, 0.92], p.heat) }),
      ...(Object.keys(controls).length ? { controls } : {}), ...(p.patch.setup ? { setup: p.patch.setup } : {}),
      ...(hz ? { humanize: { ...hz, seed: (d.seed * 131 + index * 17 + 7) >>> 0 } } : {}), ...(motion.length ? { motion } : {}),
      ...(p.textures.length ? { textures: p.textures.map((t, i) => ({ ...t, velocity: [0.25, 0.55], beats: 0.5, seed: (d.seed * 977 + index * 31 + i) >>> 0 })) } : {}),
      notes: out,
    };
  }).filter(p => p.notes.length || 'textures' in p);
  return {
    schema: 'daemonv12.signature-rack.score/1', title: d.title, bpm: d.bpm, key: d.key, timeSignature: '4/4', swing: d.swing, seed: d.seed,
    tailSeconds: d.tailSeconds, masterGainDb: 0, description: d.description,
    sections: d.sections.map(s => ({ id: s.id, bars: s.bars, development: s.note })), room: d.room, parts,
    kit: { hookOwner: d.hook.owner, log: d.log },
  };
}
