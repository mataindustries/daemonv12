/**
 * Anti-Formula Gate 1: apply one declared expectation/payoff decision to a score/2 and write the ledger.
 * Pure and deterministic: the result is a function of (source score, plan). No random numbers, no planner.
 *
 * The composer decides what happens (the plan). This file checks that the decision is legitimate, performs it
 * with an existing v0.9 transform, and proves what did and did not change:
 *   1. the motif's first statement and everything the plan protects stay note-identical;
 *   2. the expectation was really established (enough whole statements) before it is broken;
 *   3. the changed statement keeps its head exactly;
 *   4. the payoff really sounds what was owed, in time, or the debt is declared open on purpose.
 * A plan that fails any of these is rejected with the reasons; nothing is written.
 */
import { sha256 } from '../rack/frozen.ts';
import { normalizeScore } from '../rack/score.ts';
import { lowerScore, transformLabel } from '../motif/motif.ts';
import { onsetFrame } from '../motif/report.ts';
import { MOTIF_INTERFACE_VERSION, SCORE_SCHEMA_V2, type LoweredPhrase, type LoweredScore, type PhraseInput, type ScoreInputV2, type Transform } from '../motif/types.ts';
import { fact, literalMotifs, r6, recallStatements, trackExpectation } from './memory.ts';
import { AF_DISCLAIMER, AF_INTERFACE_VERSION, AF_LEDGER_SCHEMA, AF_PLAN_SCHEMA, type AntiFormulaPlan, type InterventionKind, type Ledger, type NoteFact } from './types.ts';

const EPS = 1e-6, KINDS: InterventionKind[] = ['withhold', 'defer', 'reframe'];
const say = (v: unknown) => JSON.stringify(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 600;
const jsonHash = (v: unknown) => sha256(Buffer.from(JSON.stringify(v)));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const fail = (problems: string[]): never => { const n = problems.length; throw new Error(`plan is invalid (${n} problem${n > 1 ? 's' : ''}):\n- ${problems.join('\n- ')}`); };
const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;
type Note = LoweredPhrase['notes'][number];
/**
 * Where a run of notes restates `owed` (a single owed note: where its pitch class sounds). A run of two or more
 * must agree three ways: the same up/down contour, onsets that are `owed`'s onsets times one positive factor, and
 * every interval within a semitone of the owed one (so a diatonic transposition, an octave move or a uniformly
 * faster statement still counts, and the head of a motif is not mistaken for its tail). Returns the index of the
 * run's first note, or -1.
 */
export function findRun(notes: Note[], owed: Note[]): number {
  const m = owed.length;
  if (m === 1) return notes.findIndex(x => (x.pitch - owed[0]!.pitch) % 12 === 0);
  for (let a = 0; a + m <= notes.length; a++) {
    const w = notes.slice(a, a + m), f = (w[m - 1]!.beat - w[0]!.beat) / (owed[m - 1]!.beat - owed[0]!.beat);
    if (f > 0 && w.every((x, i) => Math.abs(x.beat - w[0]!.beat - f * (owed[i]!.beat - owed[0]!.beat)) < 1e-4
      && (i === 0 || (Math.sign(x.pitch - w[i - 1]!.pitch) === Math.sign(owed[i]!.pitch - owed[i - 1]!.pitch) && Math.abs(x.pitch - w[i - 1]!.pitch - (owed[i]!.pitch - owed[i - 1]!.pitch)) <= 1)))) return a;
  }
  return -1;
}
const MECHANISM: Record<InterventionKind, (k: number) => string> = {
  withhold: k => `v0.9 fragment keeps the first ${k} note${k > 1 ? 's' : ''} exactly as stated (pitch, rhythm, gesture, dynamics) and puts nothing in place of the rest; no note is added or moved`,
  defer: k => `v0.9 fragment keeps the first ${k} note${k > 1 ? 's' : ''} exactly as stated; the notes it cuts are placed later as their own phrase, also with fragment`,
  reframe: () => 'v0.9 endOn changes the scale step of the last note only; every onset and every other pitch stays as stated',
};

export interface Applied { score: ScoreInputV2; lowered: LoweredScore; ledger: Ledger }
/** Apply the plan's single decision to a score/2. Throws `plan is invalid (n problems)` with every reason; never returns a partial result. */
export function applyAntiFormula(sourceInput: unknown, planInput: unknown): Applied {
  const source = sourceInput as ScoreInputV2, plan = planInput as AntiFormulaPlan, p: string[] = [];
  if (!source || typeof source !== 'object' || source.schema !== SCORE_SCHEMA_V2) throw new Error(`source: a "${SCORE_SCHEMA_V2}" score is required (Anti-Formula works on named motifs; a score/1 has none)`);
  if (!plan || typeof plan !== 'object') throw new Error('plan: a JSON object is required');
  const before = lowerScore(source), statements = recallStatements(source, before), roots = literalMotifs(source);
  const beforePhrase = new Map(before.phrases.map(ph => [ph.id, ph])), partIds = source.parts.map(x => x.id);
  const { identity: id, expectation: ex, intervention: iv, payoff: po, output } = plan;
  if (plan.schema !== AF_PLAN_SCHEMA) p.push(`schema: expected "${AF_PLAN_SCHEMA}"`);
  if (!id || !ex || !iv || !po || [id, ex, iv, po].some(x => typeof x !== 'object')) { p.push('identity, expectation, intervention and payoff are all required objects'); fail(p); }

  // ---- identity
  const root = roots.get(id.motif), derived = source.motifs.find(m => m.id === id.motif && m.from !== undefined);
  if (!root) p.push(derived ? `identity.motif: "${id.motif}" is derived from another motif; name the literal motif it comes from (${[...roots.keys()].join(', ')})` : `identity.motif: unknown motif ${say(id.motif)} (literal motifs: ${[...roots.keys()].join(', ')})`);
  const k = id.headNotes, n = root?.length ?? 0;
  if (root && !(Number.isInteger(k) && k >= 1 && k < n)) p.push(`identity.headNotes: expected an integer 1..${n - 1} ("${id.motif}" has ${n} notes; the head must leave a tail), got ${say(k)}`);
  if (!text(id.essence)) p.push('identity.essence: say in a sentence what must stay recognisable (1..600 characters)');
  const protectPhrases = id.protect?.phrases ?? [], protectParts = id.protect?.parts ?? [];
  for (const x of protectPhrases) if (!beforePhrase.has(x)) p.push(`identity.protect.phrases: unknown phrase ${say(x)}`);
  for (const x of protectParts) if (!partIds.includes(x)) p.push(`identity.protect.parts: unknown part ${say(x)} (parts: ${partIds.join(', ')})`);

  // ---- expectation and target
  const min = ex.minStatements ?? 2;
  if (!partIds.includes(ex.part)) p.push(`expectation.part: unknown part ${say(ex.part)} (parts: ${partIds.join(', ')})`);
  if (!(Number.isInteger(min) && min >= 2 && min <= 16)) p.push(`expectation.minStatements: expected an integer 2..16 (one statement teaches nothing to expect), got ${say(ex.minStatements)}`);
  if (!text(ex.statement)) p.push('expectation.statement: say in a sentence what the listener is led to expect (1..600 characters)');
  if (!KINDS.includes(iv.kind)) p.push(`intervention.kind: ${say(iv.kind)} is not one of ${KINDS.join(', ')}`);
  if (!text(iv.intent)) p.push('intervention.intent: say what this should do to the listener (1..600 characters)');
  if (!text(iv.reason)) p.push('intervention.reason: say why this decision and not another (1..600 characters)');
  if (!(typeof iv.resolveWithinBeats === 'number' && iv.resolveWithinBeats > 0 && iv.resolveWithinBeats <= 64)) p.push(`intervention.resolveWithinBeats: expected a number of beats, 0 < n <= 64, got ${say(iv.resolveWithinBeats)}`);
  const list = root ? statements[id.motif] ?? [] : [], target = list.find(s => s.id === iv.target), tp = beforePhrase.get(iv.target);
  const heard = target ? list.filter(s => s.part === ex.part && s.form === 'complete' && s.endBeat <= target.beat + EPS) : [];
  if (root && !tp) p.push(`intervention.target: unknown phrase ${say(iv.target)}`);
  else if (root && !target) p.push(`intervention.target: "${iv.target}" states "${tp!.root}", not "${id.motif}"`);
  else if (target) {
    if (target.part !== ex.part) p.push(`intervention.target: "${target.id}" is in part "${target.part}", but the expectation is taught in "${ex.part}"`);
    if (target.index === 0) p.push(`intervention.target: "${target.id}" is the first statement of "${id.motif}"; the first statement is never changed (there is nothing yet to expect)`);
    if (target.form !== 'complete') p.push(`intervention.target: "${target.id}" is not a whole statement of "${id.motif}" (it is ${target.form}: ${target.chain.join(' ') || 'no transforms'}); only a whole statement has a tail to withhold or a landing to move`);
    if (protectPhrases.includes(target.id)) p.push(`intervention.target: "${target.id}" is listed in identity.protect.phrases`);
    if (protectParts.includes(target.part)) p.push(`intervention.target: part "${target.part}" is listed in identity.protect.parts`);
    if (target.index > 0 && target.part === ex.part && heard.length < min) p.push(`intervention.target: the expectation is not established before "${target.id}" (bar ${target.bar}): "${ex.part}" has stated "${id.motif}" whole ${heard.length} time${heard.length === 1 ? '' : 's'} by then${heard.length ? ` (${heard.map(s => s.id).join(', ')})` : ''} and ${min} are needed. Choose a later statement, or leave the passage as it is`);
  }
  if (iv.kind === 'reframe' ? !(iv.landOn && Number.isInteger(iv.landOn.step) && [undefined, -1, 0, 1].includes(iv.landOn.alt)) : iv.landOn !== undefined)
    p.push(iv.kind === 'reframe' ? 'intervention.landOn: a reframe needs { step, alt? }: the scale step the statement lands on instead' : `intervention.landOn: only a reframe moves the landing (kind is ${say(iv.kind)})`);

  // ---- payoff declaration
  const forms = ['phrase', 'place', 'unresolved'].filter(f => f in po);
  const existing = 'phrase' in po ? po : undefined, placed = 'place' in po ? po : undefined, open = 'unresolved' in po ? po : undefined;
  if (forms.length !== 1) p.push(`payoff: give exactly one of { phrase, delivers, intent }, { place, intent } or { unresolved: true, reason } (got ${forms.join(' + ') || 'none'})`);
  if (iv.kind === 'defer' && forms.length === 1 && !placed) p.push('payoff: a deferral returns the owed tail later; give { place: { at, ... }, intent }');
  if (iv.kind === 'withhold' && placed) p.push('payoff: a withholding does not place new notes; use kind "defer" to bring the tail back, or name an existing phrase');
  if (existing) {
    if (!beforePhrase.has(existing.phrase)) p.push(`payoff.phrase: unknown phrase ${say(existing.phrase)}`);
    else if (existing.phrase === iv.target) p.push('payoff.phrase: the payoff cannot be the statement that withholds');
    if (existing.delivers !== 'landing' && existing.delivers !== 'tail') p.push(`payoff.delivers: "landing" (the owed last note) or "tail" (the owed notes), got ${say(existing.delivers)}`);
  }
  const placePart = placed?.place?.part ?? target?.part, placeId = placed?.place?.id ?? `${iv.target}.payoff`;
  if (placed) {
    if (!placed.place || typeof placed.place !== 'object' || placed.place.at === undefined) p.push('payoff.place: { at, part?, id?, transforms?, velocity?, fit? }');
    if (placePart !== undefined && !partIds.includes(placePart)) p.push(`payoff.place.part: unknown part ${say(placePart)} (parts: ${partIds.join(', ')})`);
    if (placePart !== undefined && protectParts.includes(placePart)) p.push(`payoff.place.part: part "${placePart}" is listed in identity.protect.parts`);
    if (beforePhrase.has(placeId)) p.push(`payoff.place.id: phrase id "${placeId}" already exists`);
  }
  if ((existing || placed) && !text((existing ?? placed)!.intent)) p.push('payoff.intent: say what the payoff should mean when it arrives (1..600 characters)');
  if (open && (open.unresolved !== true || !text(open.reason))) p.push('payoff: a debt left open needs { unresolved: true, reason }: say why it is left open (1..600 characters)');
  if (output !== undefined) {
    if (!output || typeof output !== 'object') p.push('output: { title?, description?, developments? }');
    else for (const s of Object.keys(output.developments ?? {})) if (!source.sections.some(x => x.id === s)) p.push(`output.developments: unknown section ${say(s)} (sections: ${source.sections.map(x => x.id).join(', ')})`);
  }
  if (p.length) fail(p);

  // ---- perform the one edit, with existing v0.9 transforms only
  const cut: Transform = iv.kind === 'reframe' ? { op: 'endOn', step: iv.landOn!.step, ...(iv.landOn!.alt !== undefined ? { alt: iv.landOn!.alt } : {}) } : { op: 'fragment', from: 0, to: k };
  const tail: Transform = { op: 'fragment', from: k, to: n };
  const score = structuredClone(source) as ScoreInputV2;
  let original: PhraseInput | undefined;
  for (const part of score.parts) for (const [j, ph] of (part.phrases ?? []).entries()) if ((ph.id ?? `${part.id}.p${j}`) === iv.target) { original = structuredClone(ph); ph.transforms = [...(ph.transforms ?? []), cut]; }
  if (placed) {
    const part = score.parts.find(x => x.id === placePart)!, { at, transforms = [], velocity = original!.velocity, fit } = placed.place;
    (part.phrases ??= []).push({ id: placeId, motif: original!.motif, at, transforms: [...(original!.transforms ?? []), tail, ...transforms], ...(velocity !== undefined ? { velocity } : {}), ...(fit !== undefined ? { fit } : {}) });
  }
  if (output?.title !== undefined) score.title = output.title;
  if (output?.description !== undefined) score.description = output.description;
  for (const sec of score.sections) if (output?.developments?.[sec.id] !== undefined) sec.development = output.developments[sec.id]!;

  let after: LoweredScore;
  try { after = lowerScore(score); normalizeScore(after.score); } catch (e) { throw new Error(`plan is invalid (1 problem):\n- the changed score does not lower to a valid rack score: ${(e as Error).message.replace(/\n/g, ' ')}`); }
  const afterPhrase = new Map(after.phrases.map(ph => [ph.id, ph])), src = tp!, out = afterPhrase.get(iv.target)!, afterList = recallStatements(score, after)[id.motif]!;

  // ---- what changed at the target, and what is owed
  const reframe = iv.kind === 'reframe', kept = reframe ? src.notes.slice(0, n - 1) : src.notes.slice(0, k), owedNotes = reframe ? src.notes.slice(n - 1) : src.notes.slice(k), landing = src.notes[n - 1]!;
  if (!same(out.notes.slice(0, kept.length), kept) || out.notes.length !== (reframe ? n : k)) p.push(`intervention: "${iv.target}" did not keep its opening notes exactly; this is a defect in the layer, not in the plan`);
  const altered = reframe ? [{ from: fact(landing), to: fact(out.notes[n - 1]!) }] : [];
  if (reframe && (out.notes[n - 1]!.pitch - landing.pitch) % 12 === 0) p.push(`intervention.landOn: step ${iv.landOn!.step} is ${fact(landing).name.replace(/-?\d+$/, '')}, the note "${iv.target}" already lands on; nothing would be reframed`);
  const expectedAtBeat = owedNotes[0]!.beat;

  // ---- everything else must be note-identical, and every curve and setting identical
  const unchangedPhrases = before.phrases.filter(ph => ph.id !== iv.target).map(ph => ph.id);
  for (const x of unchangedPhrases) if (!same(afterPhrase.get(x)?.notes, beforePhrase.get(x)!.notes)) p.push(`"${x}" changed although the plan does not touch it; this is a defect in the layer, not in the plan`);
  const unchangedParts = before.score.parts.filter((part, i) => same(part.notes ?? [], after.score.parts[i]!.notes ?? [])).map(part => part.id);
  for (const x of protectParts) if (!unchangedParts.includes(x)) p.push(`identity.protect.parts: part "${x}" changed`);
  if (before.score.parts.some((part, i) => !same({ ...part, notes: 0 }, { ...after.score.parts[i]!, notes: 0 }))) p.push('a curve, setting or generator of a part changed; this is a defect in the layer, not in the plan');

  // ---- the payoff: does it sound what is owed, and in time?
  let payoff: Ledger['payoff'] = { state: 'unresolved', reason: open?.reason ?? '', withinBeats: iv.resolveWithinBeats };
  if (existing || placed) {
    const ph = afterPhrase.get(existing ? existing.phrase : placeId)!, delivers = existing ? existing.delivers : 'tail', want = delivers === 'landing' ? [landing] : owedNotes;
    const candidates = placed ? ph.notes : ph.notes.filter(x => x.beat >= expectedAtBeat - EPS), whole = afterList.find(s => s.id === ph.id)?.form === 'complete';
    // a landing: the owed pitch class. A placed tail: the placed phrase is the tail, and the motif layer must still recognise it.
    // An existing whole statement: its own tail. Any other existing statement of the motif: a strict run (findRun).
    const at = delivers === 'landing' ? findRun(candidates, want)
      : placed ? (owedNotes.length === 1 || ph.keepsContour || ph.keepsRhythm ? 0 : -1)
      : whole ? candidates.indexOf(ph.notes[reframe ? n - 1 : k]!)
      : ph.root === id.motif ? findRun(candidates, want) : -1;
    const names = (x: Note[]) => x.map(y => fact(y).name).join(' ');
    if (at < 0) p.push(`payoff: "${ph.id}" does not sound ${delivers === 'landing' ? `the owed landing ${fact(landing).name} (any octave)` : `the owed tail (${names(owedNotes)}) in a recognisable form`} at or after beat ${expectedAtBeat}; it has ${names(candidates) || 'no notes there'}`);
    else {
      const note = candidates[at]!, waited = r6(note.beat - expectedAtBeat);
      if (placed && waited < EPS) p.push(`payoff.place.at: the tail returns at beat ${note.beat}, where it was already expected; a deferral has to arrive later`);
      if (waited > iv.resolveWithinBeats + EPS) p.push(`payoff: "${ph.id}" delivers at beat ${note.beat}, ${waited} beats after the owed material was expected (beat ${expectedAtBeat}); intervention.resolveWithinBeats allows ${iv.resolveWithinBeats}. Move the payoff earlier, or declare the longer wait`);
      const bpm = score.bpm, swing = score.swing ?? 0.5, frame = onsetFrame(note.beat, bpm, swing);
      payoff = { state: 'resolved', by: existing ? 'existing-phrase' : 'placed-phrase', changedByAntiFormula: !existing, phrase: ph.id, part: ph.part, delivers, intent: (existing ?? placed)!.intent,
        beat: note.beat, bar: Math.floor(note.beat / 4 + EPS) + 1, beatInBar: r6(note.beat - 4 * Math.floor(note.beat / 4 + EPS)), seconds: r6(frame / 44100), frame, note: fact(note),
        sameOctave: note.pitch === want[0]!.pitch, transform: placed ? [tail, ...(placed.place.transforms ?? [])].map(transformLabel).join(' ') : null, waitedBeats: waited, withinBeats: iv.resolveWithinBeats };
    }
  }
  if (p.length) fail(p);

  // ---- the stretch where the owed material would have been
  const endBeat = 4 * score.sections.reduce((s, sec) => s + sec.bars, 0), gapTo = payoff.state === 'resolved' ? payoff.beat : r6(src.at + src.lengthBeats);
  const sounding = normalizeScore(after.score).parts.find(x => x.id === src.part)!.perf.notes.filter(x => x.beat >= expectedAtBeat - EPS && x.beat < gapTo - EPS);
  const gap = { fromBeat: expectedAtBeat, toBeat: gapTo, restInPart: sounding.length === 0, alsoStatedBy: afterList.filter(s => s.part !== src.part && s.beat >= expectedAtBeat - EPS && s.beat < gapTo - EPS).map(s => s.id) };
  const track = trackExpectation(afterList, id.motif, ex.part, { minStatements: min, endBeat,
    intervention: { target: iv.target, event: iv.kind === 'withhold' ? 'withheld' : iv.kind === 'defer' ? 'deferred' : 'reframed', expectedAtBeat },
    payoff: payoff.state === 'resolved' ? { statement: payoff.phrase, beat: payoff.beat } : null });
  const count = (l: LoweredScore) => l.score.parts.reduce((s, part) => s + (part.notes?.length ?? 0), 0), facts = (x: Note[]): NoteFact[] => x.map(fact);
  const ledger: Ledger = {
    schema: AF_LEDGER_SCHEMA, interfaceVersion: AF_INTERFACE_VERSION, motifInterfaceVersion: MOTIF_INTERFACE_VERSION, disclaimer: AF_DISCLAIMER,
    source: { title: source.title, sha256: jsonHash(source) }, plan: { sha256: jsonHash(plan) }, output: { title: score.title, sha256: jsonHash(score) },
    identity: { motif: id.motif, essence: id.essence, head: facts(src.notes.slice(0, k)), tail: facts(src.notes.slice(k)),
      protected: { firstStatement: list[0]!.id, phrases: [...new Set([list[0]!.id, ...protectPhrases])], parts: protectParts } },
    memory: afterList.map(s => ({ ...s, status: s.id === iv.target ? 'intervention' as const : beforePhrase.has(s.id) ? 'unchanged' as const : 'placed' as const })),
    expectation: { kind: 'completion', part: ex.part, statement: ex.statement, minStatements: min, establishedBy: track.establishedBy, establishedAtBeat: track.establishedAtBeat!, owed: { notes: facts(owedNotes), landing: fact(landing), expectedAtBeat } },
    intervention: { kind: iv.kind, target: iv.target, bar: target!.bar, beatInBar: target!.beatInBar, intent: iv.intent, reason: iv.reason, transform: transformLabel(cut), mechanism: MECHANISM[iv.kind](k),
      keptNotes: facts(kept), removedNotes: reframe ? [] : facts(owedNotes), alteredNotes: altered, gap },
    payoff, timeline: track.timeline,
    unchanged: { phrases: unchangedPhrases, parts: unchangedParts, curvesAndSetup: 'identical in every part',
      notes: { source: count(before), output: count(after), removed: reframe ? 0 : owedNotes.length, added: placed ? afterPhrase.get(placeId)!.notes.length : 0, altered: altered.length } },
    determinism: 'A pure function of the source score and the plan. No random numbers are drawn and nothing is chosen automatically: the composer names the statement, the kind and the payoff; the layer checks them and applies one existing v0.9 transform. The score seed is the source seed, unchanged.',
  };
  if (ledger.timeline.length === 0 || (track.state !== 'resolved' && track.state !== 'unresolved')) throw new Error(`anti-formula: expectation tracking ended in state "${track.state}" (${ordinal(target!.index + 1)} statement); this is a defect in the layer`);
  return { score, lowered: after, ledger };
}
