/**
 * Anti-Formula Gate 1: motif memory and the expectation state machine. Pure; no audio, no I/O, no random numbers.
 *
 * Memory is read from what the v0.9 motif layer already knows: `lowerScore` returns every placed phrase with the
 * literal motif it derives from, its transform chain and its notes. This file only adds what that layer does not
 * say: the listening order of a motif's statements, whether a statement is the whole motif, and what a part has
 * therefore taught the listener to expect.
 */
import { keyOf, pitchName } from '../rack/curves.ts';
import { cellPitches, expandMotif, lowerScore } from '../motif/motif.ts';
import type { LoweredPhrase, LoweredScore, MotifInput, ScoreInputV2 } from '../motif/types.ts';
import { AF_DISCLAIMER, AF_MEMORY_SCHEMA, type ExpectationState, type ExpectationTrack, type Memory, type NoteFact, type Statement, type StatementForm, type TimelineEvent } from './types.ts';

const EPS = 1e-6;
export const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
export const fact = (n: { beat: number; beats: number; pitch: number; velocity: number }): NoteFact => ({ beat: n.beat, beats: n.beats, pitch: n.pitch, name: pitchName(n.pitch), velocity: n.velocity });
const contour = (p: number[]) => p.slice(1).map((x, i) => Math.sign(x - p[i]!)).join(',');

/** `[beat, beats, midi]` of every literal motif of a score, as the motif layer resolves it (no phrase transforms). */
export function literalMotifs(score: ScoreInputV2): Map<string, [number, number, number][]> {
  const key = keyOf(score.key, 0), all = new Map(score.motifs.map(m => [m.id, m] as [string, MotifInput]));
  return new Map(score.motifs.filter(m => m.from === undefined).map(m => [m.id, cellPitches(expandMotif(m, all, key), key)]));
}

/**
 * complete: as many notes as the literal motif, the same up/down/repeat contour, and onsets that are the motif's
 * onsets times one positive factor (so a transposed, octave-moved or uniformly faster statement is still complete).
 * partial: fewer notes, and the motif layer's own recognisability test passes. developed: everything else.
 */
export function formOf(ph: LoweredPhrase, root: [number, number, number][]): StatementForm {
  const n = ph.notes;
  if (n.length === root.length && n.length >= 2) {
    const span = root.at(-1)![0] - root[0]![0], f = span > 0 ? (n.at(-1)!.beat - n[0]!.beat) / span : 1;
    const onsets = f > 0 && n.every((x, i) => Math.abs(x.beat - n[0]!.beat - f * (root[i]![0] - root[0]![0])) < 1e-4);
    if (onsets && contour(n.map(x => x.pitch)) === contour(root.map(x => x[2]))) return 'complete';
  }
  return n.length < root.length && (ph.keepsContour || ph.keepsRhythm) ? 'partial' : 'developed';
}

/** Every statement of every literal motif, grouped by motif, in listening order (onset, then part order, then phrase order). */
export function recallStatements(score: ScoreInputV2, lowered: LoweredScore = lowerScore(score)): Record<string, Statement[]> {
  const roots = literalMotifs(score), partOrder = new Map(score.parts.map((p, i) => [p.id, i])), out: Record<string, Statement[]> = {};
  const ordered = lowered.phrases.map((ph, i) => ({ ph, i })).sort((a, b) => a.ph.beat - b.ph.beat || partOrder.get(a.ph.part)! - partOrder.get(b.ph.part)! || a.i - b.i);
  for (const { ph } of ordered) {
    const list = (out[ph.root] ??= []);
    list.push({ id: ph.id, part: ph.part, motif: ph.motif, root: ph.root, index: list.length, bar: Math.floor(ph.beat / 4 + EPS) + 1, beatInBar: r6(ph.beat - 4 * Math.floor(ph.beat / 4 + EPS)),
      beat: ph.beat, endBeat: r6(ph.at + ph.lengthBeats), chain: ph.chain, form: formOf(ph, roots.get(ph.root)!), notes: ph.notes.length });
  }
  return out;
}

export interface TrackOptions {
  minStatements?: number;
  /** a declared intervention: the target statement, the label of what happens there and the beat the owed material was expected */
  intervention?: { target: string; event: 'withheld' | 'deferred' | 'reframed'; expectedAtBeat: number };
  /** the statement that resolves it and the beat it does so, or `null` for a debt left open on purpose */
  payoff?: { statement: string; beat: number } | null;
  endBeat?: number;
}
/**
 * Follow one expectation through a piece: "in this part, the motif is stated whole".
 * latent -> established after `minStatements` complete statements in the part (at the end of the last one).
 * While established, a complete statement confirms it and any other statement of the motif departs from it.
 * A declared intervention opens it; the declared payoff resolves it; a debt declared open stays unresolved.
 * Without a declared intervention nothing is ever opened: a departure is only noted.
 */
export function trackExpectation(statements: Statement[], motif: string, part: string, o: TrackOptions = {}): ExpectationTrack {
  const min = o.minStatements ?? 2, establishedBy: string[] = [], events: (Omit<TimelineEvent, 'state'> & { sets?: ExpectationState })[] = [];
  let taught = false, opened = false, establishedAtBeat: number | null = null;
  for (const st of statements.filter(s => s.part === part)) {
    if (o.intervention?.target === st.id) { if (taught) { opened = true; events.push({ beat: o.intervention.expectedAtBeat, event: o.intervention.event, statement: st.id, sets: 'open' }); } continue; }
    if (o.payoff?.statement === st.id) continue;
    if (st.form === 'complete' && !taught) {
      establishedBy.push(st.id); events.push({ beat: st.beat, event: 'stated', statement: st.id });
      if (establishedBy.length === min) { taught = true; establishedAtBeat = st.endBeat; events.push({ beat: st.endBeat, event: 'established', statement: st.id, sets: 'established' }); }
    } else if (taught) events.push({ beat: st.beat, event: st.form === 'complete' ? 'confirmed' : 'departed', statement: st.id });
  }
  if (opened && o.payoff) events.push({ beat: o.payoff.beat, event: 'resolved', statement: o.payoff.statement, sets: 'resolved' });
  else if (opened) events.push({ beat: Math.max(o.endBeat ?? 0, ...events.map(e => e.beat)), event: 'left-open', sets: 'unresolved' });
  // listening order; events at the same beat keep the order they were found in
  const found = new Map(events.map((e, i) => [e, i]));
  events.sort((x, y) => x.beat - y.beat || found.get(x)! - found.get(y)!);
  let state: ExpectationState = 'latent';
  const timeline = events.map(({ sets, ...e }): TimelineEvent => { state = sets ?? state; return { beat: e.beat, state, event: e.event, ...(e.statement !== undefined ? { statement: e.statement } : {}) }; });
  return { motif, part, minStatements: min, state, establishedBy, establishedAtBeat, timeline };
}

/**
 * What the layer remembers about any score/2, with no plan: the statements of each literal motif, and for each
 * part that states a motif whole at least once, how far the "stated whole" expectation got. Descriptive only.
 */
export function observe(score: ScoreInputV2, minStatements = 2): Memory {
  const statements = recallStatements(score), expectations: ExpectationTrack[] = [];
  for (const [motif, list] of Object.entries(statements))
    for (const part of [...new Set(list.filter(s => s.form === 'complete').map(s => s.part))]) expectations.push(trackExpectation(list, motif, part, { minStatements }));
  return { schema: AF_MEMORY_SCHEMA, title: score.title, disclaimer: AF_DISCLAIMER, statements, expectations };
}
