/**
 * Motif development layer (v0.9). Lowers a `score/2` score (named motifs in scale steps, placed as phrases with
 * transform chains and portable gestures) to an ordinary `score/1` score of plain notes. Pure: no audio, no I/O.
 * Rendering, bouncing, instruments and the engine never see a motif; a `/1` score never enters this file, and no
 * file of the approved rack (studio-001/rack) is changed.
 * Contract: docs/V0_9_MOTIF_DEVELOPMENT.md.
 */
import { SCORE_SCHEMA, type Key, type NoteInput, type PartInput, type ScoreInput } from '../rack/types.ts';
import { keyOf } from '../rack/curves.ts';
import { getInstrument } from '../rack/registry.ts';
import { SCORE_SCHEMA_V2, type Cell, type CellNote, type Gesture, type LoweredPhrase, type LoweredScore, type MotifInput, type PhraseInput, type ScaleName, type Transform } from './types.ts';
import { gesturesOf } from './gestures.ts';

export const SCALES: Record<ScaleName, readonly number[]> = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], 'harmonic-minor': [0, 2, 3, 5, 7, 8, 11] };
export const GESTURES: readonly Gesture[] = ['accent', 'soft', 'short', 'legato', 'lift', 'fall'];
export const TRANSFORM_OPS = ['transpose', 'shift', 'octave', 'invert', 'retrograde', 'scale', 'rhythm', 'fragment', 'sequence', 'displace', 'endOn', 'mode', 'ornament', 'gesture', 'dynamics'] as const;
/** Ops that leave pitch classes and rhythm alone: a statement whose chain uses only these is a literal restatement. */
export const NON_DEVELOPING: ReadonlySet<string> = new Set(['octave', 'gesture', 'dynamics']);
export const LIMITS = { motifs: 64, motifNotes: 64, cellNotes: 256, transforms: 16, depth: 8, phrases: 512, sequenceCopies: 16 } as const;

const ID = /^[a-z][a-z0-9-]{0,31}$/, PHRASE_ID = /^[a-z][a-z0-9.-]{0,63}$/;
const RESERVED = new Set(['beat', 'beats', 'pitch', 'velocity', 'articulation', 'slide']);
const ROLES = ['hook', 'answer', 'figure', 'bass'];
const mod = (a: number, n: number) => ((a % n) + n) % n;
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const fmt = (x: number) => String(r6(x));
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
const say = (v: unknown) => JSON.stringify(v);

/** MIDI pitch of a scale step: `12*(octave+1) + tonic + 12*floor(step/7) + SCALE[mod(step,7)] + alt + semis`. */
export function stepToMidi(step: number, octave: number, tonic: number, scale: ScaleName, alt = 0, semis = 0): number {
  return 12 * (octave + 1) + tonic + 12 * Math.floor(step / 7) + SCALES[scale][mod(step, 7)]! + alt + semis;
}
const byOnset = (notes: CellNote[]) => notes.map((n, i) => [n, i] as const).sort((a, b) => a[0].beat - b[0].beat || a[1] - b[1]).map(x => x[0]);
const endOf = (notes: CellNote[]) => notes.reduce((m, n) => Math.max(m, n.beat + n.beats), 0);

/** Short, stable label of one transform, used in traces, reports and event maps: `transpose:-2`, `sequence:0,1,2@2`. */
export function transformLabel(t: Transform): string {
  switch (t.op) {
    case 'transpose': return `transpose:${t.steps}`;
    case 'shift': return `shift:${t.semitones}`;
    case 'octave': return `octave:${t.by}`;
    case 'invert': return t.axis === undefined ? 'invert' : `invert:${fmt(t.axis)}`;
    case 'retrograde': return 'retrograde';
    case 'scale': return `scale:${t.factor}`;
    case 'rhythm': return `rhythm:${t.durations.map(fmt).join(',')}`;
    case 'fragment': return `fragment:${t.from}-${t.to}`;
    case 'sequence': return `sequence:${t.steps.join(',')}@${fmt(t.every)}`;
    case 'displace': return `displace:${fmt(t.beats)}`;
    case 'endOn': return `endOn:${t.step}${t.alt ? (t.alt > 0 ? '+' : '-') : ''}`;
    case 'mode': return `mode:${t.to}`;
    case 'ornament': return `ornament:${t.kind}@${t.at}`;
    case 'gesture': return `gesture:${t.set}${t.at ? `@${t.at.join(',')}` : ''}`;
    case 'dynamics': return `dynamics:${fmt(t.from)}-${fmt(t.to)}`;
  }
}

/**
 * Apply one transform to a cell (exact semantics: docs/V0_9_MOTIF_DEVELOPMENT.md). Returns a new cell; throws an
 * Error whose message has no path (callers prefix where the transform was written).
 */
export function applyTransform(c: Cell, t: Transform): Cell {
  const raw = t as { op?: unknown } & Record<string, unknown>;
  if (!raw || typeof raw !== 'object' || !TRANSFORM_OPS.includes(raw.op as never)) throw new Error(`unknown transform ${say(raw?.op)} (one of ${TRANSFORM_OPS.join(', ')})`);
  const notes = byOnset(c.notes), L = c.lengthBeats, map = (f: (n: CellNote) => CellNote, len = L): Cell => ({ ...c, lengthBeats: len, notes: notes.map(f) });
  const int = (v: unknown, name: string, lo = -70, hi = 70) => { if (!isInt(v, lo, hi)) throw new Error(`${t.op}.${name}: expected an integer ${lo}..${hi}, got ${say(v)}`); return v; };
  const num = (v: unknown, name: string, lo: number, hi: number) => { if (!isNum(v) || v < lo || v > hi) throw new Error(`${t.op}.${name}: expected a number ${lo}..${hi}, got ${say(v)}`); return v; };
  const index = (v: unknown, name: string) => { if (!isInt(v, 0, notes.length - 1)) throw new Error(`${t.op}.${name}: note index ${say(v)} is outside 0..${notes.length - 1} (the cell has ${notes.length} note${notes.length === 1 ? '' : 's'} here)`); return v; };
  switch (t.op) {
    case 'transpose': { const k = int(t.steps, 'steps'); return map(n => ({ ...n, step: n.step + k })); }
    case 'shift': { const k = int(t.semitones, 'semitones', -48, 48); return map(n => ({ ...n, semis: n.semis + k })); }
    case 'octave': { const k = int(t.by, 'by', -4, 4); return map(n => ({ ...n, step: n.step + 7 * k })); }
    case 'invert': {
      const axis = t.axis === undefined ? notes[0]!.step : num(t.axis, 'axis', -70, 70);
      if (!Number.isInteger(2 * axis)) throw new Error(`invert.axis: ${say(t.axis)} must be a scale step or a half step between two (e.g. 4 or 4.5)`);
      return map(n => ({ ...n, step: 2 * axis - n.step, alt: n.alt ? -n.alt : 0 }));
    }
    case 'retrograde': return { ...c, notes: byOnset([...notes].reverse().map(n => ({ ...n, beat: L - (n.beat + n.beats) }))) };
    case 'scale': {
      const f = [0.25, 0.5, 1.5, 2, 4].includes(t.factor) ? t.factor : Math.abs(t.factor - 2 / 3) < 1e-3 ? 2 / 3 : NaN;
      if (Number.isNaN(f)) throw new Error(`scale.factor: ${say(t.factor)} is not one of 0.25, 0.5, 0.6667, 1.5, 2, 4`);
      return map(n => ({ ...n, beat: n.beat * f, beats: n.beats * f }), L * f);
    }
    case 'rhythm': {
      const d = t.durations;
      if (!Array.isArray(d) || !d.every(x => isNum(x) && x > 0 && x <= 64)) throw new Error(`rhythm.durations: an array of positive beat lengths, got ${say(d)}`);
      if (d.length !== notes.length) throw new Error(`rhythm has ${d.length} duration${d.length === 1 ? '' : 's'} for ${notes.length} note${notes.length === 1 ? '' : 's'} (give exactly one duration per note)`);
      let at = 0; const out = notes.map((n, i) => { const m = { ...n, beat: at, beats: d[i]! }; at += d[i]!; return m; });
      return { ...c, lengthBeats: at, notes: out };
    }
    case 'fragment': {
      if (!isInt(t.from, 0, notes.length - 1) || !isInt(t.to, t.from + 1, notes.length)) throw new Error(`fragment ${say(t.from)}..${say(t.to)} is not a note range inside 0..${notes.length} (from < to; the cell has ${notes.length} notes here)`);
      const kept = notes.slice(t.from, t.to), shift = kept[0]!.beat, out = kept.map(n => ({ ...n, beat: n.beat - shift }));
      return { ...c, lengthBeats: endOf(out), notes: out };
    }
    case 'sequence': {
      if (!Array.isArray(t.steps) || t.steps.length < 1 || t.steps.length > LIMITS.sequenceCopies || !t.steps.every(x => isInt(x, -70, 70))) throw new Error(`sequence.steps: 1..${LIMITS.sequenceCopies} integer diatonic offsets, got ${say(t.steps)}`);
      const every = num(t.every, 'every', 0.0625, 256);
      if (every < L - 1e-9) throw new Error(`sequence every ${fmt(every)} is shorter than the cell (${fmt(L)} beats): copies would overlap (set every >= ${fmt(L)}, or fragment or scale the cell first)`);
      if (notes.length * t.steps.length > LIMITS.cellNotes) throw new Error(`sequence makes ${notes.length * t.steps.length} notes (at most ${LIMITS.cellNotes} per cell)`);
      const K = t.steps.length, out = t.steps.flatMap((s, k) => notes.map(n => ({ ...n, beat: n.beat + k * every, step: n.step + s, seg: n.seg * K + k })));
      return { ...c, lengthBeats: every * K, notes: out };
    }
    case 'displace': {
      const b = num(t.beats, 'beats', -256, 256);
      if (notes[0]!.beat + b < -1e-9 || L + b <= 0) throw new Error(`displace ${fmt(b)} moves the first note before the motif start (the earliest allowed is ${fmt(-notes[0]!.beat)})`);
      return map(n => ({ ...n, beat: n.beat + b }), L + b);
    }
    case 'endOn': {
      const step = int(t.step, 'step'), alt = t.alt === undefined ? 0 : int(t.alt, 'alt', -1, 1), last = notes.length - 1;
      return { ...c, notes: notes.map((n, i) => (i === last ? { ...n, step, alt } : n)) };
    }
    case 'mode': {
      if (!(t.to in SCALES)) throw new Error(`mode.to: ${say(t.to)} is not one of ${Object.keys(SCALES).join(', ')}`);
      return { ...c, scale: t.to };
    }
    case 'ornament': {
      const i = index(t.at, 'at'), n = notes[i]!, d = n.beats, dir = t.kind === 'lower' ? -1 : 1;
      if (!['turn', 'upper', 'lower'].includes(t.kind)) throw new Error(`ornament.kind: ${say(t.kind)} is not one of turn, upper, lower`);
      const pieces: [number, number, boolean][] = t.kind === 'turn' ? [[1, d / 4, false], [0, d / 4, true], [-1, d / 4, false], [0, d / 4, false]] : [[0, d / 2, true], [dir, d / 4, false], [0, d / 4, false]];
      if (d / 4 < 1 / 16 - 1e-9) throw new Error(`ornament ${t.kind} on note ${i} makes pieces of ${fmt(d / 4)} beat (each piece must be at least 0.0625 beat: ornament a note of 0.25 beat or longer)`);
      const group = notes.reduce((m, x) => Math.max(m, x.orn ?? -1), -1) + 1; let at = n.beat;
      const made = pieces.map(([ds, len, main], k) => {
        const { slide: _slide, ...rest } = n;
        const piece: CellNote = { ...rest, beat: at, beats: len, step: n.step + ds, alt: ds === 0 ? n.alt : 0, orn: n.orn ?? group, main: n.orn === undefined ? main : false, ...(k === 0 && n.slide !== undefined ? { slide: n.slide } : {}) };
        at += len; return piece;
      });
      if (notes.length + made.length - 1 > LIMITS.cellNotes) throw new Error(`ornament makes more than ${LIMITS.cellNotes} notes in the cell`);
      return { ...c, notes: [...notes.slice(0, i), ...made, ...notes.slice(i + 1)] };
    }
    case 'gesture': {
      if (!GESTURES.includes(t.set)) throw new Error(`gesture.set: ${say(t.set)} is not one of ${GESTURES.join(', ')}`);
      if (t.at !== undefined && !Array.isArray(t.at)) throw new Error(`gesture.at: an array of note indices, got ${say(t.at)}`);
      const at = t.at === undefined ? undefined : new Set(t.at.map(x => index(x, 'at')));
      return { ...c, notes: notes.map((n, i) => (!at || at.has(i) ? { ...n, gesture: t.set } : n)) };
    }
    case 'dynamics': {
      const from = num(t.from, 'from', 0, 4), to = num(t.to, 'to', 0, 4);
      return map(n => ({ ...n, velocity: n.velocity * (from + (to - from) * (L > 0 ? n.beat / L : 0)) }));
    }
  }
}

interface Resolved { cell: Cell; chain: string[]; root: string; role: string | null; depth: number; path: string[] }
class Issues {
  errors: string[] = []; warnings: string[] = [];
  check(ok: boolean, msg: string) { if (!ok) this.errors.push(msg); return ok; }
  fail(): never { const n = this.errors.length; throw new Error(`score is invalid (${n} problem${n > 1 ? 's' : ''}):\n- ${this.errors.slice(0, 12).join('\n- ')}${n > 12 ? `\n- ... and ${n - 12} more` : ''}`); }
}
function runChain(cell: Cell, transforms: unknown, path: string, p: Issues): { cell: Cell; labels: string[] } | null {
  if (transforms === undefined) return { cell, labels: [] };
  if (!p.check(Array.isArray(transforms) && transforms.length <= LIMITS.transforms, `${path}.transforms: an array of at most ${LIMITS.transforms} transforms`)) return null;
  const labels: string[] = [];
  for (const [i, t] of (transforms as Transform[]).entries()) {
    try { cell = applyTransform(cell, t); labels.push(transformLabel(t)); } catch (e) { p.check(false, `${path}.transforms[${i}]: ${(e as Error).message}`); return null; }
  }
  return { cell, labels };
}
function literalCell(m: MotifInput, path: string, key: Key, p: Issues): Cell | null {
  if (!p.check(Array.isArray(m.notes) && m.notes.length >= 1 && m.notes.length <= LIMITS.motifNotes, `${path}.notes: 1..${LIMITS.motifNotes} notes, each [beat, beats, step, velocity?, options?]`)) return null;
  const notes: CellNote[] = []; let ok = true;
  for (const [i, n] of m.notes!.entries()) {
    const np = `${path}.notes[${i}]`;
    if (!p.check(Array.isArray(n) && n.length >= 3 && n.length <= 5, `${np}: [beat, beats, step, velocity?, options?]`)) { ok = false; continue; }
    const [beat, beats, step, velocity = 0.8, o = {}] = n;
    const good = [p.check(isNum(beat) && beat >= 0 && beat <= 256, `${np}.beat: expected a number 0..256, got ${say(beat)}`), p.check(isNum(beats) && beats >= 0.001 && beats <= 64, `${np}.beats: expected a number 0.001..64, got ${say(beats)}`),
      p.check(isInt(step, -70, 70), `${np}.step: expected an integer scale step -70..70 (0 = tonic, 7 = an octave up), got ${say(step)}`), p.check(isNum(velocity) && velocity >= 0 && velocity <= 1, `${np}.velocity: expected a number 0..1, got ${say(velocity)}`),
      p.check(!!o && typeof o === 'object' && !Array.isArray(o), `${np}: options must be an object`)];
    if (good.includes(false)) { ok = false; continue; }
    const { alt, gesture, articulation, slide, params, ...extra } = o as Record<string, unknown>;
    for (const k of Object.keys(extra)) ok = p.check(false, `${np}: unknown option "${k}" (alt, gesture, articulation, slide, params; instrument values such as vowel go inside params)`) && ok;
    if (alt !== undefined) ok = p.check(isInt(alt, -1, 1), `${np}.alt: -1, 0 or 1`) && ok;
    if (gesture !== undefined) ok = p.check(GESTURES.includes(gesture as Gesture), `${np}.gesture: ${say(gesture)} is not one of ${GESTURES.join(', ')}`) && ok;
    if (articulation !== undefined) ok = p.check(typeof articulation === 'string', `${np}.articulation: a string`) && ok;
    if (slide !== undefined) ok = p.check(isNum(slide) && slide >= 0 && slide <= 16, `${np}.slide: expected a number 0..16 (beats)`) && ok;
    const clean: Record<string, number | string> = {};
    if (params !== undefined && p.check(!!params && typeof params === 'object' && !Array.isArray(params), `${np}.params: an object`))
      for (const [k, v] of Object.entries(params as object)) { if (p.check((typeof v === 'number' || typeof v === 'string') && !RESERVED.has(k), `${np}.params.${k}: a number or string, and not one of ${[...RESERVED].join(', ')}`)) clean[k] = v as number | string; else ok = false; }
    notes.push({ beat, beats, step, alt: (alt as number | undefined) ?? 0, semis: 0, velocity, seg: 0, ...(gesture !== undefined ? { gesture: gesture as Gesture } : {}),
      ...(typeof articulation === 'string' ? { articulation } : {}), ...(isNum(slide) ? { slide } : {}), ...(Object.keys(clean).length ? { params: clean } : {}) });
  }
  if (!ok) return null;
  const sorted = byOnset(notes);
  return { lengthBeats: endOf(sorted), scale: key.mode, octave: 4, notes: sorted };
}
/** Resolves motifs by id with memoisation, `from` depth limit and cycle detection. */
function motifResolver(motifs: MotifInput[], key: Key, p: Issues) {
  const index = new Map<string, number>(), memo = new Map<string, Resolved | null>();
  motifs.forEach((m, i) => { if (typeof m?.id === 'string' && !index.has(m.id)) index.set(m.id, i); });
  const resolve = (id: string, stack: string[]): Resolved | null => {
    if (memo.has(id)) return memo.get(id)!;
    const i = index.get(id)!, m = motifs[i]!, path = `motifs[${i}] (${id})`;
    let out: Resolved | null = null;
    const octaveOk = m.octave === undefined || p.check(isInt(m.octave, -1, 8), `${path}.octave: an integer -1..8`);
    const lengthOk = m.lengthBeats === undefined || p.check(isNum(m.lengthBeats) && m.lengthBeats > 0 && m.lengthBeats <= 256, `${path}.lengthBeats: a number of beats, 0 < n <= 256`);
    if (m.from !== undefined) {
      if (p.check(m.notes === undefined, `${path}: give either notes (a literal motif) or from + transforms (a derived motif), not both`)
        && p.check(typeof m.from === 'string' && index.has(m.from), `${path}.from: unknown motif ${say(m.from)} (defined: ${[...index.keys()].join(', ')})`)
        && p.check(!stack.includes(m.from) && m.from !== id, `${path}.from: cycle ${[...stack.slice(Math.max(0, stack.indexOf(m.from))), id, m.from].join(' -> ')} (a derived motif must end at a literal motif)`)      ) {
        const src = resolve(m.from, [...stack, id]);
        if (src && p.check(src.depth < LIMITS.depth, `${path}.from: more than ${LIMITS.depth} motifs deep (${[id, ...src.path].join(' -> ')}); derive from an earlier motif instead`)) {
          const run = runChain(src.cell, m.transforms, path, p);
          if (run) out = { cell: run.cell, chain: [...src.chain, ...run.labels], root: src.root, role: m.role ?? src.role, depth: src.depth + 1, path: [id, ...src.path] };
        }
      }
    } else {
      p.check(m.transforms === undefined, `${path}.transforms: only a derived motif (with from) takes transforms; place the motif in a phrase to transform it`);
      const cell = literalCell(m, path, key, p);
      if (cell) out = { cell, chain: [], root: id, role: m.role ?? null, depth: 0, path: [id] };
    }
    if (out && octaveOk && lengthOk) {
      if (m.octave !== undefined) out.cell = { ...out.cell, octave: m.octave };
      if (m.lengthBeats !== undefined) out.cell = { ...out.cell, lengthBeats: m.lengthBeats };
    } else out = null;
    memo.set(id, out);
    return out;
  };
  return { has: (id: unknown): id is string => typeof id === 'string' && index.has(id), ids: () => [...index.keys()], resolve: (id: string) => resolve(id, []) };
}
function checkMotifs(motifs: unknown, p: Issues): motifs is MotifInput[] {
  if (!p.check(Array.isArray(motifs) && motifs.length <= LIMITS.motifs, `motifs: an array of at most ${LIMITS.motifs} motifs`)) return false;
  const seen = new Set<string>();
  for (const [i, m] of (motifs as MotifInput[]).entries()) {
    if (!p.check(!!m && typeof m === 'object' && typeof m.id === 'string' && ID.test(m.id), `motifs[${i}].id: lowercase id (a-z, 0-9, -)`)) return false;
    p.check(!seen.has(m.id), `motifs[${i}].id: duplicate "${m.id}"`); seen.add(m.id);
    p.check(m.role === undefined || ROLES.includes(m.role), `motifs[${i}] (${m.id}).role: one of ${ROLES.join(', ')}`);
  }
  return true;
}

/** Expand one motif (following `from` chains) to its cell. Pure; throws on an invalid motif. */
export function expandMotif(m: MotifInput, all: Map<string, MotifInput>, key: Key): Cell {
  const p = new Issues(), list = [...new Map([...all, [m.id, m]]).values()];
  const cell = checkMotifs(list, p) ? motifResolver(list, key, p).resolve(m.id)?.cell : undefined;
  if (!cell || p.errors.length) p.fail();
  return cell!;
}
/** `[beat, beats, midi]` of every note of a cell in a key (beats rounded to 1e-6), as the lowering resolves them. */
export function cellPitches(cell: Cell, key: Key): [number, number, number][] {
  return byOnset(cell.notes).map(n => [r6(n.beat), r6(n.beats), stepToMidi(n.step, cell.octave, key.tonic, cell.scale, n.alt, n.semis)]);
}

// ------------------------------------------------------------ recognisability (symbolic, for the motif report)
interface Plain { beat: number; beats: number; pitch: number }
/** Notes of one `sequence` copy with ornaments folded back into their principal note. */
function skeletons(cell: Cell, key: Key): Plain[][] {
  const segs = new Map<number, Map<string, { beat: number; end: number; pitch: number; main: boolean }>>();
  byOnset(cell.notes).forEach((n, i) => {
    const seg = segs.get(n.seg) ?? new Map(), k = n.orn === undefined ? `n${i}` : `o${n.orn}`, pitch = stepToMidi(n.step, cell.octave, key.tonic, cell.scale, n.alt, n.semis), g = seg.get(k);
    if (!g) seg.set(k, { beat: n.beat, end: n.beat + n.beats, pitch, main: n.main === true || n.orn === undefined });
    else { g.beat = Math.min(g.beat, n.beat); g.end = Math.max(g.end, n.beat + n.beats); if (n.main && !g.main) { g.pitch = pitch; g.main = true; } }
    segs.set(n.seg, seg);
  });
  return [...segs.values()].map(s => [...s.values()].map(g => ({ beat: g.beat, beats: g.end - g.beat, pitch: g.pitch })).sort((a, b) => a.beat - b.beat));
}
const contourOf = (n: Plain[]) => n.slice(1).map((x, i) => (x.pitch > n[i]!.pitch ? 'u' : x.pitch < n[i]!.pitch ? 'd' : 'r')).join('');
const rhythmOf = (n: Plain[]) => n.map((x, i) => `${fmt(x.beats)}${i + 1 < n.length ? `>${fmt(n[i + 1]!.beat - x.beat)}` : ''}`);
/** Does `sub` (as a list) appear as a contiguous window of `full`? The last element of a rhythm window ignores its inter-onset gap. */
function windowOf(sub: string[], full: string[]): boolean {
  const strip = (s: string) => s.split('>')[0]!;
  for (let a = 0; a + sub.length <= full.length; a++) if (sub.every((s, i) => (i === sub.length - 1 ? strip(s) === strip(full[a + i]!) : s === full[a + i]))) return true;
  return false;
}
/** Speeds at which a rhythm still counts as the same pattern: as written, or uniformly augmented / diminished by a `scale` factor. */
const RHYTHM_SPEEDS = [1, 0.25, 0.5, 2 / 3, 1.5, 2, 4];
/**
 * A statement keeps the root motif's contour / rhythm when every `sequence` copy of it (ornaments folded) matches a
 * contiguous window of the root's Parsons contour / onset-duration pattern (the rhythm at the same speed or uniformly
 * augmented or diminished). Copies of fewer than two notes never match.
 */
function relation(cell: Cell, root: Cell, key: Key): { keepsContour: boolean; keepsRhythm: boolean } {
  const src = skeletons(root, key)[0]!, parts = skeletons(cell, key), big = parts.every(s => s.length >= 2);
  return {
    keepsContour: big && parts.every(s => windowOf([...contourOf(s)], [...contourOf(src)])),
    keepsRhythm: big && parts.every(s => RHYTHM_SPEEDS.some(f => windowOf(rhythmOf(s.map(n => ({ ...n, beat: n.beat / f, beats: n.beats / f }))), rhythmOf(src)))),
  };
}

export interface LowerOptions {
  /** extra transposition applied after lowering (the CLI `--transpose`); only used for range checks and `fit: 'octave'` */
  transpose?: number;
}
/**
 * Lower a `score/2` score to a `score/1` score. Errors throw in the rack's `score is invalid (n problems)` form;
 * `problems` holds warnings only. Pitches are resolved against the untransposed key: the rack's `normalizeScore`
 * applies `transpose` afterwards, exactly once.
 */
export function lowerScore(input: unknown, opts: LowerOptions = {}): LoweredScore {
  const p = new Issues(), s = input as ScoreInput & { motifs?: unknown; parts: (PartInput & { phrases?: PhraseInput[] })[] };
  if (!s || typeof s !== 'object') throw new Error('score: a JSON object is required');
  p.check(s.schema === SCORE_SCHEMA_V2, `schema: expected "${SCORE_SCHEMA_V2}" (a "${SCORE_SCHEMA}" score has no motifs to lower)`);
  let key: Key | undefined;
  try { key = keyOf(s.key, 0); } catch (e) { p.check(false, `key: ${(e as Error).message}`); }
  const motifList = s.motifs;
  if (!checkMotifs(motifList, p) || !key) return p.fail();
  const motifs = motifResolver(motifList, key, p);
  for (const id of motifs.ids()) motifs.resolve(id); // every motif is validated, used or not
  const transpose = (isInt(s.transpose, -24, 24) ? s.transpose : 0) + (isInt(opts.transpose, -24, 24) ? opts.transpose : 0);
  const sections = new Map<string, { start: number; bars: number }>(); let bars = 0;
  for (const sec of Array.isArray(s.sections) ? s.sections : []) if (sec && typeof sec.id === 'string' && isInt(sec.bars, 1, 256)) { sections.set(sec.id, { start: bars * 4, bars: sec.bars }); bars += sec.bars; }
  if (!p.check(Array.isArray(s.parts), 'parts: 1..14 (the engine allows 15 tracks; one is the room)')) return p.fail();

  const trace: LoweredScore['trace'] = [], phrases: LoweredPhrase[] = [], ids = new Set<string>(); let dropped = 0;
  const parts = s.parts.map((part, pi) => {
    const { phrases: list, ...rest }: PartInput & { phrases?: PhraseInput[] } = part ?? {};
    if (list === undefined) return rest;
    const path = `parts[${pi}]${typeof part.id === 'string' ? ` (${part.id})` : ''}`, inst = getInstrument(part.instrument), lowered: NoteInput[] = [];
    if (!p.check(Array.isArray(list) && list.length <= LIMITS.phrases, `${path}.phrases: an array of at most ${LIMITS.phrases} phrases`)) return rest;
    if (!p.check(!!inst, `${path}.instrument: unknown "${part.instrument}" (see: node studio-001/rack/cli.ts list)`)) return rest;
    const shift = inst!.family === 'context' ? 0 : transpose;
    for (const [j, ph] of list.entries()) {
      const pp = `${path}.phrases[${j}]`;
      if (!p.check(!!ph && typeof ph === 'object', `${pp}: { motif, at, transforms?, velocity?, fit?, id? }`)) continue;
      const id = ph.id ?? `${part.id}.p${j}`;
      p.check(typeof id === 'string' && PHRASE_ID.test(id), `${pp}.id: lowercase id (a-z, 0-9, -, .)`);
      p.check(!ids.has(id), `${pp}.id: duplicate phrase id "${id}"`); ids.add(id);
      if (!p.check(motifs.has(ph.motif), `${pp}.motif: unknown motif ${say(ph.motif)} (defined: ${motifs.ids().join(', ') || 'none'})`)) continue;
      const src = motifs.resolve(ph.motif), run = src && runChain(src.cell, ph.transforms, pp, p);
      let at: number | undefined;
      if (isNum(ph.at)) { if (p.check(ph.at >= 0 && ph.at <= 4000, `${pp}.at: expected a beat 0..4000, got ${say(ph.at)}`)) at = ph.at; }
      else if (p.check(!!ph.at && typeof ph.at === 'object', `${pp}.at: a beat, or { section, bar, beat? } (bar is 1-based; beat is the 0-based offset inside the bar)`)) {
        const sec = sections.get(ph.at.section), beat = ph.at.beat ?? 0;
        if (p.check(!!sec, `${pp}.at.section: unknown section ${say(ph.at.section)} (defined: ${[...sections.keys()].join(', ') || 'none'})`)
          && p.check(isInt(ph.at.bar, 1, sec!.bars), `${pp}.at.bar: expected a bar 1..${sec!.bars} of section "${ph.at.section}", got ${say(ph.at.bar)}`)
          && p.check(isNum(beat) && beat >= 0 && beat < 4, `${pp}.at.beat: expected a beat offset 0 <= beat < 4 inside the bar, got ${say(beat)}`)) at = sec!.start + (ph.at.bar - 1) * 4 + beat;
      }
      const velocity = ph.velocity ?? 1, fit = ph.fit ?? 'error';
      const vOk = p.check(isNum(velocity) && velocity >= 0 && velocity <= 4, `${pp}.velocity: expected a multiplier 0..4, got ${say(velocity)}`);
      const fOk = p.check(fit === 'error' || fit === 'octave', `${pp}.fit: "error" or "octave"`);
      if (!src || !run || at === undefined || !vOk || !fOk) continue;
      const cell = run.cell, chain = [...src.chain, ...run.labels], label = `${pp} (${id})`;
      const made = byOnset(cell.notes).map((n, k) => {
        const g = n.gesture ? gesturesOf(inst!.id)[n.gesture] : undefined; let articulation = n.articulation;
        if (articulation !== undefined && !(articulation in inst!.articulations)) {
          p.warnings.push(`warning: ${label} note ${k}: articulation "${articulation}" does not exist on ${inst!.id}; dropped (use a gesture, which every instrument maps, or one of ${Object.keys(inst!.articulations).join(', ')})`);
          dropped++; articulation = undefined;
        }
        articulation ??= g?.articulation;
        const params: Record<string, number | string> = { ...g?.params };
        for (const [k2, v] of Object.entries(n.params ?? {})) {
          if (k2 in inst!.params) params[k2] = v;
          else { p.warnings.push(`warning: ${label} note ${k}: parameter "${k2}" does not exist on ${inst!.id}; dropped (${Object.keys(inst!.params).join(', ') || 'this instrument has no per-note parameters'})`); dropped++; }
        }
        return { beat: r6(at! + n.beat), beats: r6(n.beats * (g?.beats ?? 1)), pitch: stepToMidi(n.step, cell.octave, key!.tonic, cell.scale, n.alt, n.semis),
          velocity: r6(Math.min(1, Math.max(0, n.velocity * velocity * (g?.velocity ?? 1)))), articulation, slide: n.slide, params };
      });
      const [lo, hi] = inst!.range, outside = (o: number) => made.findIndex(n => n.pitch + shift + 12 * o < lo || n.pitch + shift + 12 * o > hi);
      let octaveShift = 0;
      if (outside(0) >= 0) {
        const k = outside(0), n = made[k]!;
        if (fit === 'octave') {
          const o = [-1, 1, -2, 2, -3, 3, -4, 4, -5, 5].find(x => outside(x) < 0);
          if (!p.check(o !== undefined, `${label}: no octave shift puts all ${made.length} notes inside ${inst!.id} range ${lo}..${hi} (the phrase spans ${Math.max(...made.map(x => x.pitch)) - Math.min(...made.map(x => x.pitch))} semitones; fragment it or use another instrument)`)) continue;
          octaveShift = o!;
        } else { p.check(false, `${label} note ${k} at beat ${fmt(n.beat)}: pitch ${n.pitch + shift} outside ${inst!.id} range ${lo}..${hi} (transpose the part or the score), or set "fit": "octave" on the phrase`); continue; }
      }
      const notes = made.map(n => ({ ...n, pitch: n.pitch + 12 * octaveShift }));
      notes.forEach((n, k) => {
        lowered.push({ beat: n.beat, beats: n.beats, pitch: n.pitch, velocity: n.velocity, ...(n.articulation !== undefined ? { articulation: n.articulation } : {}), ...(n.slide !== undefined ? { slide: n.slide } : {}), ...n.params });
        trace.push({ part: part.id, phrase: id, motif: ph.motif, note: k, chain });
      });
      const rootCell = motifs.resolve(src.root)!.cell;
      phrases.push({ id, part: part.id, motif: ph.motif, root: src.root, role: src.role, chain, at, beat: notes[0]!.beat, lengthBeats: r6(cell.lengthBeats), octaveShift,
        literal: chain.every(c => NON_DEVELOPING.has(c.split(':')[0]!)), ...relation(cell, rootCell, key!), notes: notes.map(({ beat, beats, pitch, velocity: v }) => ({ beat, beats, pitch, velocity: v })) });
    }
    return lowered.length ? { ...rest, notes: [...(rest.notes ?? []), ...lowered] } : rest;
  });
  if (p.errors.length) p.fail();
  const { motifs: _motifs, ...head } = s;
  return { score: { ...head, schema: SCORE_SCHEMA, parts }, trace, problems: p.warnings, phrases, droppedParams: dropped };
}
