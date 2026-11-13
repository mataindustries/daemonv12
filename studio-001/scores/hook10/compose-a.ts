/**
 * Authoring helper for HOOK//10 condition A (the existing v0.8 workflow: `notes`, `repeats`, curves, articulations).
 * A is matched to B1 on purpose, so the only thing a listener compares is what happens to the hook:
 *   - bar 1 (the hook, the bass riff, the mallet echo, the clock) is note-for-note B1's bar 1;
 *   - bar 4 (the turnaround) is note-for-note B1's bar 4, written out as plain notes;
 *   - bars 2 and 3 are bar 1 again, tiled with `repeats`: the only repetition primitive a score/1 has;
 *   - instruments, gains, pans, room, macros, expression curves, seed and tempo are B1's.
 * The output is a plain score/1 file with no motifs; the JSON is the source of truth.
 *   node studio-001/scores/hook10/compose-a.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { lowerScore } from '../../motif/index.ts';
import type { NoteInput, PartInput } from '../../rack/types.ts';

const b1 = lowerScore(JSON.parse(readFileSync(new URL('./hook10-b1.score.json', import.meta.url), 'utf8'))).score;
type Obj = Extract<NoteInput, { beat: number }>;
const shift = (n: Obj, by: number): Obj => ({ ...n, beat: +(n.beat - by).toFixed(6) });
const parts: PartInput[] = b1.parts.map(part => {
  const notes = (part.notes ?? []).map(n => (Array.isArray(n) ? { beat: n[0], beats: n[1], pitch: n[2], ...(n[3] !== undefined ? { velocity: n[3] } : {}), ...n[4] } as Obj : n));
  const cell = notes.filter(n => n.beat < 4), turn = notes.filter(n => n.beat >= 12);
  const { notes: _notes, ...rest } = part;
  return { ...rest, repeats: [{ fromBeat: 0, toBeat: 12, lengthBeats: 4, notes: cell.map(n => shift(n, 0)) }], notes: turn };
});
const score = {
  ...b1, title: 'HOOK//10 A (existing workflow: the hook tiled with repeats, hand-written turnaround)',
  description: 'HOOK//10, condition A (score/1). The same hook, bass riff, mallet echo and clock as B1, repeated literally for three bars with `repeats`; bar 4 is the same hand-written turnaround. Timbre macros and expression move exactly as in B1.',
  sections: [{ id: 'loop', bars: 3, development: 'the hook, three times, unchanged; the macros and the expression curve move the timbre' }, { id: 'turn', bars: 1, development: 'hand-written turnaround over D minor and A7' }],
  parts,
};
writeFileSync(new URL('./hook10-a.score.json', import.meta.url), JSON.stringify(score, null, 2) + '\n');
console.log('wrote studio-001/scores/hook10/hook10-a.score.json');
