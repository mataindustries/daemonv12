/**
 * Saved performance scores: validation and normalisation. A score is portable JSON in musical time (beats), so the
 * same performance renders at any tempo (`bpm` override) and in any key (`transpose`). Generators (repeats,
 * seeded textures, seeded humanisation) expand deterministically into explicit notes; the expanded performance is
 * saved beside the authored score in every package.
 */
import { SCORE_SCHEMA, type Breath, type Curve, type Key, type MotionSpan, type NoteEvent, type NoteInput, type PartInput, type PartPerformance, type RackInstrument, type ScoreInput } from './types.ts';
import { beatSecondsOf, curveAt, keyOf, pitchOf, swung } from './curves.ts';
import { getInstrument } from './registry.ts';
import { VOWELS } from './instruments.ts';

export interface NormalizedPart { id: string; instrument: RackInstrument; gainDb: number; pan: number; room: number; context: boolean; perf: PartPerformance }
export interface NormalizedSection { id: string; bars: number; development: string; startBeat: number }
export interface NormalizedScore {
  authored: ScoreInput; title: string; bpm: number; beatSeconds: number; swing: number; key: Key; seed: number; transpose: number;
  tailSeconds: number; masterGainDb: number; bars: number; endBeat: number; sections: NormalizedSection[]; parts: NormalizedPart[];
  room: { rt60: number; size: number; damp: number; predelayMs: number; lowCut: number };
}
export interface NormalizeOptions { transpose?: number; bpm?: number }

const ID = /^[a-z][a-z0-9-]{0,31}$/;
class Problems {
  list: string[] = [];
  check(ok: boolean, msg: string) { if (!ok) this.list.push(msg); return ok; }
  range(v: unknown, lo: number, hi: number, path: string): v is number { return this.check(typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi, `${path}: expected a number ${lo}..${hi}, got ${JSON.stringify(v)}`); }
}
/** Small deterministic PRNG (mulberry32) for score generators; independent of the audio engines. */
function prng(seed: number) {
  let s = seed >>> 0;
  return () => { let t = (s = (s + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function checkCurve(c: unknown, path: string, p: Problems) {
  if (typeof c === 'number') { p.check(Number.isFinite(c), `${path}: not finite`); return; }
  const pts = Array.isArray(c) ? c : c && typeof c === 'object' && Array.isArray((c as { steps?: unknown }).steps) ? (c as { steps: unknown[] }).steps : undefined;
  if (!p.check(!!pts && pts.length > 0, `${path}: a number, [[beat, value], ...] or { steps: [[beat, value], ...], glide }`)) return;
  let last = -Infinity;
  for (const [i, pt] of pts!.entries()) {
    if (!p.check(Array.isArray(pt) && pt.length === 2 && pt.every(x => typeof x === 'number' && Number.isFinite(x)), `${path}[${i}]: [beat, value]`)) continue;
    const b = (pt as number[])[0]!; p.check(b >= last, `${path}[${i}]: beats must not decrease`); last = b;
  }
}

interface RawNote { beat: number; beats: number; pitch: number; velocity: number; articulation?: string; slide?: number; params: Record<string, number | string> }
function noteOf(n: NoteInput, path: string, p: Problems): RawNote | null {
  let beat: unknown, beats: unknown, pitch: unknown, velocity: unknown, rest: Record<string, unknown> = {};
  if (Array.isArray(n)) { [beat, beats, pitch, velocity] = n; rest = (n[4] ?? {}) as Record<string, unknown>; }
  else if (n && typeof n === 'object') { ({ beat, beats, pitch, velocity, ...rest } = n as Record<string, unknown>); }
  else { p.check(false, `${path}: a note is [beat, beats, pitch, velocity?, options?] or an object`); return null; }
  if (!p.range(beat, 0, 4000, `${path}.beat`) || !p.range(beats, 0.001, 400, `${path}.beats`)) return null;
  let midi: number;
  try { midi = pitchOf(pitch as string | number); } catch (e) { p.check(false, `${path}.pitch: ${(e as Error).message}`); return null; }
  const vel = velocity === undefined ? 0.8 : velocity;
  if (!p.range(vel, 0, 1, `${path}.velocity`)) return null;
  const { articulation, slide, ...params } = rest;
  if (articulation !== undefined) p.check(typeof articulation === 'string', `${path}.articulation: a string`);
  if (slide !== undefined) p.range(slide, 0, 16, `${path}.slide (beats)`);
  const clean: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(params)) if (p.check(typeof v === 'number' || typeof v === 'string', `${path}.${k}: number or string`)) clean[k] = v as number | string;
  return { beat: beat as number, beats: beats as number, pitch: midi, velocity: vel as number, ...(typeof articulation === 'string' ? { articulation } : {}), ...(typeof slide === 'number' ? { slide } : {}), params: clean };
}

function partNotes(part: PartInput, path: string, p: Problems, endBeat: number, beatSeconds: number, seed: number): RawNote[] {
  const out: RawNote[] = [];
  const push = (n: ReturnType<typeof noteOf>, shift = 0) => { if (n) out.push({ ...n, beat: n.beat + shift }); };
  (part.notes ?? []).forEach((n, i) => push(noteOf(n, `${path}.notes[${i}]`, p)));
  (part.repeats ?? []).forEach((r, i) => {
    const rp = `${path}.repeats[${i}]`;
    if (!p.range(r.fromBeat, 0, endBeat, `${rp}.fromBeat`) || !p.range(r.toBeat, r.fromBeat, endBeat, `${rp}.toBeat`) || !p.range(r.lengthBeats, 0.25, 64, `${rp}.lengthBeats`)) return;
    const cell = r.notes.map((n, k) => noteOf(n, `${rp}.notes[${k}]`, p));
    for (let start = r.fromBeat; start < r.toBeat - 1e-9; start += r.lengthBeats) for (const n of cell) if (n && start + n.beat < r.toBeat - 1e-9) push(n, start);
  });
  (part.textures ?? []).forEach((tx, i) => {
    const tp = `${path}.textures[${i}]`;
    if (!p.range(tx.fromBeat, 0, endBeat, `${tp}.fromBeat`) || !p.range(tx.toBeat, tx.fromBeat, endBeat, `${tp}.toBeat`)) return;
    checkCurve(tx.density, `${tp}.density`, p);
    let pitches: number[];
    try { pitches = tx.pitches.map(pitchOf); } catch (e) { p.check(false, `${tp}.pitches: ${(e as Error).message}`); return; }
    if (!p.check(pitches.length > 0, `${tp}.pitches: at least one`)) return;
    const r = prng(tx.seed ?? seed + 977 * (i + 1)), [vlo, vhi] = tx.velocity ?? [0.25, 0.55];
    for (let b = tx.fromBeat; ;) {
      const rate = Math.max(0.01, curveAt(tx.density, b)) * beatSeconds; // events per beat
      b += -Math.log(1 - r()) / rate;
      if (b >= tx.toBeat) break;
      out.push({ beat: b, beats: tx.beats ?? 0.5, pitch: pitches[Math.floor(r() * pitches.length)]!, velocity: vlo + (vhi - vlo) * r(), params: {} });
    }
  });
  return out;
}

export function normalizeScore(input: unknown, opts: NormalizeOptions = {}): NormalizedScore {
  const p = new Problems(), s = input as ScoreInput;
  if (!s || typeof s !== 'object') throw new Error('score: a JSON object is required');
  p.check(s.schema === SCORE_SCHEMA, `schema: expected "${SCORE_SCHEMA}"`);
  p.check(typeof s.title === 'string' && s.title.length > 0 && s.title.length <= 200, 'title: 1..200 characters');
  const bpm = opts.bpm ?? s.bpm;
  p.range(bpm, 20, 300, opts.bpm !== undefined ? '--bpm' : 'bpm');
  p.check(s.timeSignature === undefined || s.timeSignature === '4/4', 'timeSignature: only "4/4" in rack 1.x');
  const swing = s.swing ?? 0.5, seed = s.seed ?? 1, transpose = (s.transpose ?? 0) + (opts.transpose ?? 0), tailSeconds = s.tailSeconds ?? 2, masterGainDb = s.masterGainDb ?? -3;
  p.range(swing, 0.5, 0.75, 'swing'); p.check(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff, 'seed: integer 0..4294967295');
  p.check(Number.isInteger(transpose) && Math.abs(transpose) <= 24, 'transpose: integer -24..24'); p.range(tailSeconds, 0.1, 10, 'tailSeconds'); p.range(masterGainDb, -60, 12, 'masterGainDb');
  let key: Key = { tonic: 0, mode: 'minor', label: 'C minor' };
  try { key = keyOf(s.key, transpose); } catch (e) { p.check(false, `key: ${(e as Error).message}`); }
  const sections: NormalizedSection[] = []; let bars = 0;
  if (p.check(Array.isArray(s.sections) && s.sections.length >= 1 && s.sections.length <= 64, 'sections: 1..64 entries'))
    for (const [i, sec] of s.sections.entries()) {
      p.check(typeof sec.id === 'string' && ID.test(sec.id), `sections[${i}].id: lowercase id (a-z, 0-9, -)`);
      if (p.check(Number.isInteger(sec.bars) && sec.bars >= 1 && sec.bars <= 256, `sections[${i}].bars: integer 1..256`)) {
        sections.push({ id: sec.id, bars: sec.bars, development: sec.development ?? '', startBeat: bars * 4 }); bars += sec.bars;
      }
    }
  p.check(new Set(sections.map(x => x.id)).size === sections.length, 'sections: duplicate id');
  const beatSeconds = beatSecondsOf(typeof bpm === 'number' ? bpm : 120), endBeat = bars * 4;
  p.check(endBeat * beatSeconds + tailSeconds <= 600, 'duration: the engine renders at most 600 s including the tail');
  const parts: NormalizedPart[] = [];
  if (p.check(Array.isArray(s.parts) && s.parts.length >= 1 && s.parts.length <= 14, 'parts: 1..14 (the engine allows 15 tracks; one is the room)')) {
    for (const [i, part] of s.parts.entries()) {
      const path = `parts[${i}]${typeof part.id === 'string' ? ` (${part.id})` : ''}`;
      p.check(typeof part.id === 'string' && ID.test(part.id) && part.id !== 'room', `${path}.id: lowercase id, not "room"`);
      const inst = getInstrument(part.instrument);
      if (!p.check(!!inst, `${path}.instrument: unknown "${part.instrument}" (see: node studio-001/rack/cli.ts list)`)) continue;
      const gainDb = part.gainDb ?? inst!.suggestedGainDb, pan = part.pan ?? 0, room = part.room ?? (inst!.family === 'context' ? 0 : 0.18);
      p.range(gainDb, -60, 12, `${path}.gainDb`); p.range(pan, -1, 1, `${path}.pan`); p.range(room, 0, 1, `${path}.room`);
      const raw = partNotes(part, path, p, endBeat, beatSeconds, seed + 31 * (i + 1));
      const hz = part.humanize, r = prng(hz?.seed ?? seed + 7919 * (i + 1));
      if (hz) { p.range(hz.timingMs ?? 0, 0, 40, `${path}.humanize.timingMs`); p.range(hz.velocity ?? 0, 0, 0.5, `${path}.humanize.velocity`); }
      const gauss = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, r()))) * Math.cos(2 * Math.PI * r());
      const notes: NoteEvent[] = raw.map((n, k) => {
        let beat = swung(n.beat, swing), velocity = n.velocity;
        if (hz) { beat = Math.max(0, beat + gauss() * (hz.timingMs ?? 0) / 1000 / beatSeconds); velocity = Math.min(1, Math.max(0.01, velocity * (1 + (hz.velocity ?? 0) * (2 * r() - 1)))); }
        const pitch = n.pitch + (inst!.family === 'context' ? 0 : transpose), np = `${path} note ${k + 1} at beat ${n.beat}`;
        p.check(pitch >= inst!.range[0] && pitch <= inst!.range[1], `${np}: pitch ${pitch} outside ${inst!.id} range ${inst!.range[0]}..${inst!.range[1]} (transpose the part or the score)`);
        p.check(beat < endBeat, `${np}: starts after the last bar`);
        if (n.articulation !== undefined) p.check(n.articulation in inst!.articulations, `${np}: articulation "${n.articulation}" not in ${Object.keys(inst!.articulations).join(', ')}`);
        for (const [k2, v] of Object.entries(n.params)) {
          p.check(k2 in inst!.params, `${np}: unknown parameter "${k2}" for ${inst!.id} (${Object.keys(inst!.params).join(', ') || 'none'})`);
          if (k2 === 'vowel' || k2 === 'to') p.check(typeof v === 'string' && VOWELS.includes(v), `${np}: ${k2} must be one of ${VOWELS.join(', ')}`);
        }
        return { beat, beats: n.beats, pitch, velocity, ...(n.articulation ? { articulation: n.articulation } : {}), ...(n.slide !== undefined ? { slide: n.slide } : {}), ...(Object.keys(n.params).length ? { params: n.params } : {}) };
      }).sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
      const names = new Set(inst!.controls.map(c => c.name));
      for (const [kind, rec] of [['controls', part.controls], ['offsets', part.offsets]] as const)
        for (const [name, c] of Object.entries(rec ?? {})) { p.check(names.has(name), `${path}.${kind}.${name}: not a control of ${inst!.id} (${[...names].join(', ') || 'none'})`); checkCurve(c, `${path}.${kind}.${name}`, p); }
      if (part.macro !== undefined) checkCurve(part.macro, `${path}.macro`, p);
      if (part.expression !== undefined) checkCurve(part.expression, `${path}.expression`, p);
      if (part.overtone !== undefined) { p.check(inst!.family === 'impossible-voice', `${path}.overtone: only for impossible-voice`); checkCurve(part.overtone, `${path}.overtone`, p); }
      if (part.breaths?.length) p.check(inst!.family === 'impossible-voice', `${path}.breaths: only for impossible-voice`);
      if (part.motion?.length) p.check(inst!.family === 'living-bass', `${path}.motion: only for living-bass`);
      const breaths: Breath[] = (part.breaths ?? []).filter((b, k) => p.check(b && (b.kind === 'in' || b.kind === 'out') && typeof b.beat === 'number' && typeof b.beats === 'number' && b.beats > 0, `${path}.breaths[${k}]: { beat, beats, kind: in|out, velocity? }`));
      const motion: MotionSpan[] = part.motion ?? [];
      const setup: Record<string, number | string | number[]> = {};
      for (const [k2, v] of Object.entries(part.setup ?? {})) {
        if (k2 === 'halo') { try { setup.halo = (v as (string | number)[]).map(x => pitchOf(x) + transpose); } catch (e) { p.check(false, `${path}.setup.halo: ${(e as Error).message}`); } continue; }
        if (p.check(inst!.setup.some(x => x.name === k2), `${path}.setup.${k2}: not a setup option of ${inst!.id} (${inst!.setup.map(x => x.name).join(', ') || 'none'})`)) setup[k2] = v as number | string;
      }
      const perf: PartPerformance = { notes, macro: (part.macro ?? 0) as Curve, controls: (part.controls ?? {}) as Record<string, Curve>, offsets: (part.offsets ?? {}) as Record<string, Curve>,
        expression: (part.expression ?? 0.7) as Curve, setup, breaths, motion, ...(part.overtone !== undefined ? { overtone: part.overtone } : {}) };
      parts.push({ id: part.id, instrument: inst!, gainDb, pan, room, context: part.context ?? inst!.family === 'context', perf });
    }
    p.check(new Set(parts.map(x => x.id)).size === parts.length, 'parts: duplicate id');
  }
  const rm = s.room ?? {};
  const room = { rt60: rm.rt60 ?? 2.4, size: rm.size ?? 1.15, damp: rm.damp ?? 5600, predelayMs: rm.predelayMs ?? 22, lowCut: rm.lowCut ?? 220 };
  p.range(room.rt60, 0.2, 8, 'room.rt60'); p.range(room.size, 0.3, 2, 'room.size');
  if (p.list.length) throw new Error(`score is invalid (${p.list.length} problem${p.list.length > 1 ? 's' : ''}):\n- ${p.list.slice(0, 12).join('\n- ')}${p.list.length > 12 ? `\n- ... and ${p.list.length - 12} more` : ''}`);
  return { authored: s, title: s.title, bpm: bpm as number, beatSeconds, swing, key, seed, transpose, tailSeconds, masterGainDb, bars, endBeat, sections, parts, room };
}

/** The expanded, normalised performance (what was actually played), for saving beside the authored score. */
export function performanceJson(n: NormalizedScore) {
  return {
    title: n.title, bpm: n.bpm, beatSeconds: n.beatSeconds, key: n.key.label, transpose: n.transpose, swing: n.swing, seed: n.seed,
    sections: n.sections, parts: n.parts.map(pt => ({ id: pt.id, instrument: pt.instrument.id, instrumentVersion: pt.instrument.version, gainDb: pt.gainDb, pan: pt.pan, room: pt.room, context: pt.context, ...pt.perf })),
  };
}
