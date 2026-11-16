/**
 * One-command builder: spec (palette + groove + hook + form + moves) -> score.json -> render.
 *   node composer-kit/build.ts SPEC.json OUT_DIR [--seed N] [--no-render]
 *   node composer-kit/build.ts SPEC.json --check        (critique only, writes nothing)
 * Same spec + same seed = the same score, byte for byte. See composer-kit/KIT.md for the catalogue.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { cut, degree, finalize, hasPart, heatAt, isDrum, keyInfo, midi, notesIn, part, r3, rng, setHeat, tonicFrom, type Draft, type DPart, type N, type NoteIn, type Opts } from './core.ts';
import { patch } from './palette.ts';
import { groove, type Groove, type Tone } from './grooves.ts';
import { form, type MoveSpec, type SectionSpec } from './forms.ts';
import { move } from './moves.ts';

export interface Cell { bars: number; notes: NoteIn[]; alt?: NoteIn[] }
export interface VoiceSpec { patch?: string; cell?: Cell; gainDb?: number; pan?: number }
export interface Spec {
  title: string; key: string; groove: string;
  /** one line: what world this is (kept in the score description) */
  world?: string;
  seed?: number; bpm?: number; swing?: number; grooveB?: string; tailSeconds?: number;
  /** bass (required), then any of lead, answer, pad, texture, hat, or your own names */
  voices: Record<string, VoiceSpec>;
  /** which voice owns the hook (default "bass"); its cell is the hook */
  hook?: string;
  form?: string; sections?: SectionSpec[]; moves?: MoveSpec[];
  room?: Record<string, number>;
}

const RHYTHM_TOKENS = ['kick', 'snare', 'hat', 'perc'];
const cellNotes = (notes: NoteIn[]): N[] => notes.map(n => [n[0], n[1], midi(n[2]), n[3] ?? 0.8, n[4] ? { ...n[4] } : undefined]);
const tones = (line: Tone[], base: number, minor: boolean): N[] => line.map(n => [n[0], n[1], base + degree(n[2], minor), n[3], n[4] ? { ...n[4] } : undefined]);
const shift = (notes: N[], by: number): N[] => notes.map(n => [r3(n[0] + by), n[1], n[2], n[3], n[4] ? { ...n[4] } : undefined]);

/** Spec -> Draft with every section laid out, before any move. */
export function assemble(spec: Spec, seedOverride?: number): Draft {
  if (!spec || typeof spec !== 'object') throw new Error('spec: a JSON object is required');
  if (!spec.voices?.bass) throw new Error('spec.voices.bass is required (give it at least {} to use the groove\'s bass patch)');
  const g = groove(spec.groove), gB = spec.grooveB ? groove(spec.grooveB) : g, seed = seedOverride ?? spec.seed ?? 1, rand = rng(seed * 7919 + 13);
  const { tonic, minor } = keyInfo(spec.key), owner = spec.hook ?? 'bass';
  if (!spec.voices[owner]) throw new Error(`hook: voice "${owner}" is not in voices (${Object.keys(spec.voices).join(', ')})`);
  const fm = form(spec.form ?? 'stallion').make(owner, v => v in spec.voices);
  const secs = spec.sections ?? fm.sections, moves = spec.moves ?? (spec.sections ? [] : fm.moves);
  const bassT = tonicFrom({ tonic }, 28), hatT = tonicFrom({ tonic }, 84);
  const mk = (id: string, patchId: string, v: VoiceSpec = {}): DPart => ({ id, patch: patch(patchId), notes: [], heat: [], motionBars: [], textures: [], ...(v.gainDb !== undefined ? { gainDb: v.gainDb } : {}), ...(v.pan !== undefined ? { pan: v.pan } : {}) });
  const percPatch = g.perc?.patch ?? gB.perc?.patch;
  const parts: DPart[] = [mk('bass', spec.voices.bass.patch ?? g.bassPatch, spec.voices.bass), mk('kick', 'kick'), mk('snare', 'snare'), mk('hat', spec.voices.hat?.patch ?? 'clock-hat', spec.voices.hat),
    ...(percPatch ? [mk('perc', spec.voices.perc?.patch ?? percPatch, spec.voices.perc)] : [])];
  for (const [name, v] of Object.entries(spec.voices)) {
    if (['bass', 'hat', 'perc'].includes(name)) continue;
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(name) || ['kick', 'snare', 'drums', 'room'].includes(name)) throw new Error(`voices.${name}: use a lowercase name other than kick/snare/drums/room`);
    if (!v.patch) throw new Error(`voices.${name}.patch is required`);
    parts.push(mk(name, v.patch, v));
  }
  const cells = new Map<string, { bars: number; notes: N[]; alt?: N[] }>();
  for (const [name, v] of Object.entries(spec.voices)) if (v.cell) {
    if (!Number.isInteger(v.cell.bars) || v.cell.bars < 1 || v.cell.bars > 8 || !Array.isArray(v.cell.notes) || !v.cell.notes.length) throw new Error(`voices.${name}.cell: { bars: 1..8, notes: [[beat, beats, pitch, velocity?, options?], ...] }`);
    for (const n of [...v.cell.notes, ...(v.cell.alt ?? [])]) if (!(n[0] >= 0 && n[0] < v.cell.bars * 4)) throw new Error(`voices.${name}.cell: note at beat ${n[0]} is outside the ${v.cell.bars}-bar cell (beats 0..${v.cell.bars * 4})`);
    cells.set(name, { bars: v.cell.bars, notes: cellNotes(v.cell.notes), ...(v.cell.alt ? { alt: cellNotes(v.cell.alt) } : {}) });
  }
  const hookCell = cells.get(owner) ?? (owner === 'bass' ? { bars: 2, notes: tones(g.bass, bassT, minor) } : undefined);
  if (!hookCell) throw new Error(`hook: voices.${owner}.cell is required (the hook is its owner's cell)`);

  const sections: Draft['sections'] = []; let at = 0;
  for (const s of secs) {
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(s.id) || !Number.isInteger(s.bars) || s.bars < 1 || !Array.isArray(s.play)) throw new Error(`section ${JSON.stringify(s.id)}: { id (lowercase), bars, play: [...] }`);
    sections.push({ id: s.id, bars: s.bars, start: at, end: at + s.bars * 4, note: s.note ?? '' }); at += s.bars * 4;
  }
  const d: Draft = { title: spec.title, bpm: spec.bpm ?? g.bpm, key: spec.key, tonic, minor, swing: spec.swing ?? g.swing, seed, tailSeconds: spec.tailSeconds ?? 2,
    room: spec.room ?? { rt60: 1.6, size: 1, damp: 6000, predelayMs: 12, lowCut: 250 }, description: spec.world ?? '', sections, parts, hook: { owner, bars: hookCell.bars, notes: hookCell.notes, ...('alt' in hookCell && hookCell.alt ? { alt: hookCell.alt } : {}) }, log: [] };

  secs.forEach((s, si) => {
    const { start, end } = sections[si]!, sg = s.groove === 'B' ? gB : s.groove ? groove(s.groove) : g, bars = s.bars;
    const tile = (line: N[]): N[] => Array.from({ length: bars }, (_, b) => shift(line.filter(n => n[0] >= (b % 2) * 4 && n[0] < (b % 2) * 4 + 4), start + (b - (b % 2)) * 4)).flat();
    for (const p of parts) setHeat(p, start, end, typeof s.heat === 'number' ? s.heat : s.heat?.[p.id] ?? (s.heat ? 0.3 : 0.3));
    const tokens = s.play.flatMap(t => (t === 'drums' ? ['kick', 'snare'] : [t]));
    for (const token of tokens) {
      const [name, variant] = token.split(':') as [string, string | undefined];
      const p = parts.find(x => x.id === name);
      if (!p) { if (name === 'perc') continue; throw new Error(`section ${s.id}: "${token}" is not a voice (have: ${parts.map(x => x.id).join(', ')}, drums)`); }
      if (name === 'kick') p.notes.push(...tile(sg.kick.map(h => [h[0], 0.5, bassT, h[1]] as N)));
      else if (name === 'snare') p.notes.push(...tile(sg.snare.map(h => [h[0], 0.5, 60, h[1], { articulation: h[2] ?? 'snare' }] as N)));
      else if (name === 'hat') p.notes.push(...tile(tones(sg.hat, hatT, minor)));
      else if (name === 'perc') { if (sg.perc) p.notes.push(...tile(tones(sg.perc.notes, tonicFrom({ tonic }, 12 * (sg.perc.octave + 1)), minor))); }
      else if (name === 'bass' && (variant === 'groove' || !cells.has('bass'))) p.notes.push(...tile(tones(sg.bass, bassT, minor)));
      else {
        const cell = cells.get(name);
        if (cell) {
          const L = cell.bars * 4, loops = Math.ceil((end - start) / L);
          for (let i = 0; i < loops; i++) {
            if ((variant === 'once' && i > 0) || (variant === 'last' && i < loops - 1)) continue;
            const src = (i % 2 === 1 && cell.alt ? cell.alt : cell.notes).filter(n => variant === 'head' ? n[0] < L / 2 : variant === 'tail' ? n[0] >= L / 2 : true);
            p.notes.push(...shift(src, start + i * L).filter(n => n[0] < end - 1e-6));
          }
        } else if (p.patch.instrument.endsWith('/bearings')) {
          p.textures.push({ fromBeat: start, toBeat: end, density: r3(1.5 + 4 * heatAt(p, start)), pitches: [0, 3, 7, 10, 12, 14].map(x => hatT + degree(x, minor)) });
        } else { // a voice with no cell is a drone: tonic and fifth, re-bowed every two bars
          const root = tonicFrom({ tonic }, 48);
          for (let b = start; b < end; b += 8) p.notes.push([b, Math.min(8, end - b) - 0.25, root, 0.7], [b, Math.min(8, end - b) - 0.25, root + 7, 0.55]);
        }
      }
    }
    // a seeded turnaround in the last bar of a section that leads somewhere
    if (s.fill !== false && si < secs.length - 1 && tokens.includes('snare')) {
      const b = end - 4, kind = Math.floor(rand() * 3), kickP = part(d, 'kick'), snareP = part(d, 'snare'), hatP = part(d, 'hat');
      if (kind === 0) { cut(snareP, b + 3.2, end); cut(hatP, b + 3, end); snareP.notes.push([b + 3.25, 0.25, 60, 0.4, { articulation: 'ghost' }], [b + 3.5, 0.25, 60, 0.55, { articulation: 'ghost' }], [b + 3.75, 0.25, 60, 0.75, { articulation: 'snare' }]); }
      else if (kind === 1) { cut(kickP, b + 3.2, end); cut(hatP, b + 3.5, end); kickP.notes.push([b + 3.5, 0.25, bassT, 0.8], [b + 3.75, 0.25, bassT, 0.95]); }
      else { for (const q of [kickP, snareP, hatP]) cut(q, b + 3, end); snareP.notes.push([b + 3.5, 0.25, 60, 0.8, { articulation: 'clap' }]); }
    }
  });
  for (const m of moves) { move(m.move).apply(d, m); d.log.push(`${m.move}(${m.section})`); }
  return d;
}
export function buildScore(spec: Spec, seed?: number) { return finalize(assemble(spec, seed)); }

/** Facts and taste warnings about a draft, before it costs a render. Warnings are prompts to think, not rules. */
export function critique(d: Draft): { table: string[]; warnings: string[] } {
  const own = part(d, d.hook.owner), beatSec = 60 / d.bpm, total = d.sections.reduce((a, s) => a + s.bars * 4, 0) * beatSec;
  const rows = d.sections.map(s => {
    const active = d.parts.filter(p => notesIn(p, s.start, s.end).length || p.textures.some(t => t.fromBeat < s.end && t.toBeat > s.start));
    const notes = active.reduce((a, p) => a + notesIn(p, s.start, s.end).length, 0), pitched = active.filter(p => !isDrum(p));
    return { s, ids: active.map(p => p.id), perBar: notes / s.bars, heat: pitched.length ? pitched.reduce((a, p) => a + heatAt(p, (s.start + s.end) / 2), 0) / pitched.length : 0,
      ownHeat: heatAt(own, s.end - 2), hook: notesIn(own, s.start, s.end).length, kicks: hasPart(d, 'kick') ? notesIn(part(d, 'kick'), s.start, s.end).length / s.bars : 0 };
  });
  const table = [`${d.title} · ${d.key} · ${d.bpm} BPM · swing ${d.swing} · ${Math.round(total)} s · hook owner: ${d.hook.owner} (${own.patch.id}) · moves: ${d.log.join(', ') || 'none'}`,
    ...rows.map(r => `  ${r.s.id.padEnd(12)} ${String(r.s.bars).padStart(2)} bars  heat ${r.heat.toFixed(2)}  ${r.perBar.toFixed(1).padStart(5)} notes/bar  hook ${r.hook ? 'yes' : ' no'}  kicks/bar ${r.kicks.toFixed(1)}  [${r.ids.join(' ')}]`)];
  const w: string[] = [], withHook = rows.filter(r => r.hook >= 2), dens = rows.map(r => r.perBar);
  const hookPitches = new Set(d.hook.notes.map(n => n[2])).size, hookSpan = d.hook.notes.reduce((a, n) => a + n[1], 0) / (d.hook.bars * 4);
  if (hookPitches < 3) w.push(`hook: only ${hookPitches} different pitch${hookPitches === 1 ? '' : 'es'} — is it a shape someone could hum?`);
  if (hookSpan > 0.92) w.push('hook: it never rests. Cut a note; the gap is where the answer and the groove get heard.');
  if (d.hook.notes.length / d.hook.bars > 10) w.push('hook: more than 10 notes a bar — that is a texture, not a hook.');
  if (withHook.length < 2) w.push('the hook is stated in fewer than two sections: nobody will know it when it returns.');
  if (withHook.length === rows.length && rows.length > 2) w.push('the hook owner plays the hook in every section: take it away somewhere so its return is an event.');
  rows.forEach((r, i) => { const n = rows[i + 1]; if (n && r.ids.join() === n.ids.join() && Math.abs(r.heat - n.heat) < 0.15 && Math.abs(r.perBar - n.perBar) < 0.2 * Math.max(r.perBar, n.perBar)) w.push(`${r.s.id} -> ${n.s.id}: same parts, same heat, same density. What changes?`); });
  if (Math.min(...dens) > 0.6 * Math.max(...dens)) w.push('no section is much emptier than the rest: there is no floor, so there is no arrival.');
  const first = withHook[0], last = withHook[withHook.length - 1];
  if (first && last && first !== last && last.ownHeat - first.ownHeat < 0.25) w.push(`the last hook section (${last.s.id}) is not clearly hotter than the first (${first.s.id}): a repeat, not a return. Raise its heat or use riffReturn.`);
  if (last && last !== rows[rows.length - 1] && rows[rows.length - 1]!.s.bars > 2) w.push('the track ends on a section without the hook: is that an ending or a fade?');
  if (new Set(rows.map(r => r.kicks.toFixed(1))).size < 2) w.push('the kick pattern never changes density: consider floorDrop, a second groove, or a section without drums.');
  if (d.log.length === 0) w.push('no moves: the sections differ only by layers. Pick one move with a reason.');
  if (d.log.length > 4) w.push(`${d.log.length} moves: each one is weaker for the company. Keep the one to three you can justify.`);
  if (total < 28 || total > 65) w.push(`length ${Math.round(total)} s: a sketch is about 40 s.`);
  return { table, warnings: w };
}

/** Kick, snare, hat, perc and the groove's own bass line: the two-bar pattern once. */
export function grooveAudition(id: string) {
  const g: Groove = groove(id), bars = 2;
  const d = assemble({ title: `groove ${id}`, key: 'G minor', groove: id, voices: { bass: {} }, sections: [{ id: 'loop', bars, heat: 0.3, play: ['bass', 'drums', 'hat', 'perc'], fill: false }], tailSeconds: 0.6 });
  return finalize(d);
}

async function main() {
  const argv = process.argv.slice(2), flags = new Set(argv.filter(a => a.startsWith('--'))), seedAt = argv.indexOf('--seed');
  const seed = seedAt >= 0 ? Number(argv[seedAt + 1]) : undefined, pos = argv.filter((a, i) => !a.startsWith('--') && !(seedAt >= 0 && i === seedAt + 1));
  if (!pos[0] || (!pos[1] && !flags.has('--check'))) { console.error(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 6).join('\n')); process.exitCode = 2; return; }
  const spec = JSON.parse(readFileSync(pos[0], 'utf8')) as Spec, d = assemble(spec, seed), c = critique(d);
  console.log(c.table.join('\n')); console.log(c.warnings.length ? `\nTASTE CHECK (${c.warnings.length}):\n${c.warnings.map(x => `  ! ${x}`).join('\n')}` : '\nTASTE CHECK: nothing flagged (that is not the same as good).');
  if (flags.has('--check')) return;
  const out = resolve(pos[1]!), score = finalize(d), slug = spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sketch';
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'score.json'), JSON.stringify(score, null, 2) + '\n');
  if (flags.has('--no-render')) { console.log(`\nwrote ${join(out, 'score.json')}`); return; }
  const { renderMp3 } = await import('./render.ts');
  const r = await renderMp3(score, join(out, `${slug}.mp3`), { kbps: 160 });
  console.log(`\nwrote ${join(out, 'score.json')}\nwrote ${r.mp3}  (${r.seconds} s, ${r.lufs} LUFS, true peak ${r.truePeakDb} dB)`);
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) main().catch(e => { console.error((e as Error).message); process.exitCode = 1; });
