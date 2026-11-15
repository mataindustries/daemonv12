// Anti-Formula Gate 1: musical memory, expectation and payoff above the v0.9 motif layer. Pure: no audio is rendered.
// Covers motif recognition, expectation states, valid and invalid payoffs, unresolved debts, determinism and
// backward compatibility (the motif layer and the rack are not edited; condition A is reproduced exactly).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeScore, performanceJson, sha256, type PartInput } from '../studio-001/rack/index.ts';
import { lowerScore, motifReport, normalizeAnyScore, SCORE_SCHEMA_V2, MOTIF_INTERFACE_VERSION, type MotifInput, type PhraseInput, type ScoreInputV2 } from '../studio-001/motif/index.ts';
import { applyAntiFormula, observe, recallStatements, trackExpectation, findRun, AF_PLAN_SCHEMA, AF_LEDGER_SCHEMA, AF_MEMORY_SCHEMA, AF_DISCLAIMER, type AntiFormulaPlan, type Ledger, type PayoffPlan } from '../studio-001/anti-formula/index.ts';
import { json } from '../studio-001/anti-formula/cli.ts';

const read = (f: string) => JSON.parse(readFileSync(f, 'utf8')) as unknown;
const HOOK10 = 'studio-001/anti-formula/hook10';
type Part = PartInput & { phrases?: PhraseInput[] };
// C minor, steps 0 1 2 4 = C4 D4 Eb4 G4. Head: C4 D4. Tail: Eb4 G4, landing on G4 two beats in.
const THEME: MotifInput = { id: 'theme', role: 'hook', notes: [[0, 1, 0], [1, 0.5, 1], [1.5, 0.5, 2], [2, 1, 4]] };
const MOTIFS: MotifInput[] = [THEME, { id: 'back', from: 'theme', transforms: [{ op: 'retrograde' }] }];
const fixture = (voice: PhraseInput[], bars: PhraseInput[] = []): ScoreInputV2 => ({
  schema: SCORE_SCHEMA_V2, title: 'Anti-Formula fixture', bpm: 120, key: 'C minor', seed: 7, tailSeconds: 0.5, masterGainDb: 0, sections: [{ id: 'a', bars: 5 }], motifs: MOTIFS,
  parts: [{ id: 'voice', instrument: 'impossible-voice', expression: [[0, 0.6], [20, 0.8]], phrases: voice }, { id: 'bars', instrument: 'mechanical-orchestra/bar', macro: 0.2, phrases: bars }] as Part[] });
const VOICE: PhraseInput[] = [
  { id: 'v1', motif: 'theme', at: 0 }, { id: 'v2', motif: 'theme', at: 4, transforms: [{ op: 'transpose', steps: 2 }] },
  { id: 'v3', motif: 'theme', at: 8 }, { id: 'v4', motif: 'theme', at: 12 }, { id: 'close', motif: 'back', at: 16 } ];
const BARS: PhraseInput[] = [
  { id: 'b-head', motif: 'theme', at: 0, transforms: [{ op: 'fragment', from: 0, to: 2 }, { op: 'octave', by: 1 }] },
  { id: 'b-mirror', motif: 'theme', at: 4, transforms: [{ op: 'octave', by: 1 }, { op: 'invert' }] },
  { id: 'b-fast', motif: 'theme', at: 10, transforms: [{ op: 'scale', factor: 0.5 }, { op: 'octave', by: 1 }] } ];
const SOURCE = fixture(VOICE, BARS);
const plan = (over: { identity?: Partial<AntiFormulaPlan['identity']>; expectation?: Partial<AntiFormulaPlan['expectation']>; intervention?: Partial<AntiFormulaPlan['intervention']>; payoff?: PayoffPlan } = {}): AntiFormulaPlan => ({
  schema: AF_PLAN_SCHEMA,
  identity: { motif: 'theme', headNotes: 2, essence: 'the rising step C to D', protect: { parts: ['bars'] }, ...over.identity },
  expectation: { part: 'voice', statement: 'the step is always followed by the climb to G', ...over.expectation },
  intervention: { kind: 'withhold', target: 'v3', resolveWithinBeats: 8, intent: 'leave the climb out once', reason: 'two whole statements have taught it', ...over.intervention },
  payoff: over.payoff ?? { phrase: 'v4', delivers: 'tail', intent: 'the climb returns in the next statement' } });
const problems = (f: () => unknown): string[] => { try { f(); } catch (e) { const lines = (e as Error).message.split('\n'); assert.match(lines[0]!, /^plan is invalid \(\d+ problems?\):$/, (e as Error).message); return lines.slice(1).map(l => l.slice(2)); } return assert.fail('expected the plan to be rejected'); };
const only = (f: () => unknown) => { const list = problems(f); assert.equal(list.length, 1, list.join('\n')); return list[0]!; };

test('layering: a separate layer above the motif layer; neither the motif layer nor the rack is edited', () => {
  assert.equal(MOTIF_INTERFACE_VERSION, '0.9.0'); assert.equal(AF_PLAN_SCHEMA, 'daemonv12.anti-formula.plan/1'); assert.equal(AF_LEDGER_SCHEMA, 'daemonv12.anti-formula.ledger/1'); assert.equal(AF_MEMORY_SCHEMA, 'daemonv12.anti-formula.memory/1');
  // SHA-256 of every studio-001/motif source at d65ef67 (the v0.9 draft this gate started from)
  const V09: Record<string, string> = {
    'cli.ts': '826de604f4ff8381d886cf4b9c81fadeede6184584b582421e9334586654898b', 'gestures.ts': 'db57921b42d170dada110f42298d69817eb5764873aeee47212d2d819cb2d1b2', 'index.ts': 'ccf9de1474f7fd999980ffb5f00e68369b18a5589e32ebb291f6803a5ed119a8',
    'motif.ts': 'c5032764d36ec3d0fdf29b7f66598bb142289e5e85406ad7bdcdb7c60dd87d3a', 'report.ts': 'a446becb35a033765a2c6d7912bac432f41c26be201c36eaccb44b8cfd35f612', 'types.ts': '5fd1e6c62de6e5feb0179279c787b669b9cd2c4d10238a3799aa35b5f3a8002d' };
  assert.deepEqual(readdirSync('studio-001/motif').sort(), Object.keys(V09).sort());
  for (const [file, want] of Object.entries(V09)) assert.equal(sha256(readFileSync(`studio-001/motif/${file}`)), want, `studio-001/motif/${file}`);
  // the layer imports the rack and the motif layer; nothing below it imports the layer, and it draws no random numbers
  for (const dir of ['studio-001/rack', 'studio-001/motif', 'src', 'mcp']) for (const f of readdirSync(dir, { recursive: true }) as string[]) if (f.endsWith('.ts')) assert.doesNotMatch(readFileSync(join(dir, f), 'utf8'), /anti-formula/, `${dir}/${f}`);
  for (const f of readdirSync('studio-001/anti-formula')) if (f.endsWith('.ts')) assert.doesNotMatch(readFileSync(`studio-001/anti-formula/${f}`, 'utf8'), /Math\.random|Date\.now|new Date/, f);
});

test('memory: statements of a motif in listening order, each recognised as complete, partial or developed', () => {
  const list = recallStatements(SOURCE).theme!;
  assert.deepEqual(list.map(s => [s.id, s.part, s.index, s.bar, s.beat, s.form]), [
    ['v1', 'voice', 0, 1, 0, 'complete'], ['b-head', 'bars', 1, 1, 0, 'partial'],        // same onset: part order decides
    ['v2', 'voice', 2, 2, 4, 'complete'],                                                  // transposed: still the whole motif
    ['b-mirror', 'bars', 3, 2, 4, 'developed'],                                            // inverted: all notes, another contour
    ['v3', 'voice', 4, 3, 8, 'complete'], ['b-fast', 'bars', 5, 3, 10, 'complete'],        // twice as fast, an octave up: whole
    ['v4', 'voice', 6, 4, 12, 'complete'], ['close', 'voice', 7, 5, 16, 'developed'] ]);    // backwards
  assert.deepEqual(list.find(s => s.id === 'b-head')!.chain, ['fragment:0-2', 'octave:1'], 'the chain is the motif layer\'s own trace');
  assert.equal(list.find(s => s.id === 'v1')!.endBeat, 3); assert.equal(list.every(s => s.root === 'theme'), true);
});

test('expectation states: latent, established after two whole statements, confirmed, departed; nothing opens without a declared intervention', () => {
  const list = (voice: PhraseInput[]) => recallStatements(fixture(voice)).theme!;
  const one = trackExpectation(list(VOICE.slice(0, 1)), 'theme', 'voice');
  assert.equal(one.state, 'latent'); assert.equal(one.establishedAtBeat, null); assert.deepEqual(one.timeline.map(e => e.event), ['stated']);
  const all = trackExpectation(list(VOICE), 'theme', 'voice');
  assert.equal(all.state, 'established'); assert.equal(all.establishedAtBeat, 7, 'at the end of the second whole statement'); assert.deepEqual(all.establishedBy, ['v1', 'v2']);
  assert.deepEqual(all.timeline.map(e => `${e.beat} ${e.event} ${e.statement} -> ${e.state}`), ['0 stated v1 -> latent', '4 stated v2 -> latent', '7 established v2 -> established', '8 confirmed v3 -> established', '12 confirmed v4 -> established', '16 departed close -> established']);
  assert.equal(trackExpectation(list(VOICE), 'theme', 'voice', { minStatements: 3 }).establishedAtBeat, 11);
  assert.equal(trackExpectation(list(VOICE), 'theme', 'bars').state, 'latent', 'another part has taught nothing');
  const open = trackExpectation(list(VOICE), 'theme', 'voice', { intervention: { target: 'v3', event: 'withheld', expectedAtBeat: 9.5 }, payoff: null, endBeat: 20 });
  assert.equal(open.state, 'unresolved'); assert.deepEqual(open.timeline.slice(3).map(e => `${e.beat} ${e.event} -> ${e.state}`), ['9.5 withheld -> open', '12 confirmed -> open', '16 departed -> open', '20 left-open -> unresolved']);
  const paid = trackExpectation(list(VOICE), 'theme', 'voice', { intervention: { target: 'v3', event: 'withheld', expectedAtBeat: 9.5 }, payoff: { statement: 'v4', beat: 13.5 } });
  assert.equal(paid.state, 'resolved'); assert.deepEqual(paid.timeline.at(-2), { beat: 13.5, state: 'resolved', event: 'resolved', statement: 'v4' });
  const early = trackExpectation(list(VOICE), 'theme', 'voice', { intervention: { target: 'v2', event: 'withheld', expectedAtBeat: 5.5 }, payoff: null });
  assert.equal(early.timeline.some(e => e.event === 'withheld'), false, 'an expectation that is not established cannot be opened');
});

test('observe: memory of any score/2 without a plan (descriptive, no score)', () => {
  const m = observe(SOURCE);
  assert.equal(m.schema, AF_MEMORY_SCHEMA); assert.equal(m.disclaimer, AF_DISCLAIMER); assert.deepEqual(Object.keys(m.statements), ['theme']);
  assert.deepEqual(m.expectations.map(e => [e.motif, e.part, e.state]), [['theme', 'voice', 'established'], ['theme', 'bars', 'latent']]);
});

test('withhold: one existing transform on one phrase; head kept, tail owed, an existing statement pays; everything else identical', () => {
  const { score, lowered, ledger } = applyAntiFormula(SOURCE, plan());
  const phrases = (s: ScoreInputV2) => s.parts[0]!.phrases!;
  assert.deepEqual(phrases(score)[2], { id: 'v3', motif: 'theme', at: 8, transforms: [{ op: 'fragment', from: 0, to: 2 }] }, 'the only edit: v0.9 fragment appended to the target');
  assert.deepEqual({ ...score, parts: 0 }, { ...SOURCE, parts: 0 }); assert.deepEqual(score.parts[1], SOURCE.parts[1]);
  assert.deepEqual(phrases(score).filter((_, i) => i !== 2), phrases(SOURCE).filter((_, i) => i !== 2));
  assert.equal(score.schema, SCORE_SCHEMA_V2); assert.deepEqual(lowerScore(score).score, lowered.score, 'the output is an ordinary score/2');
  normalizeScore(lowered.score);
  assert.equal(ledger.schema, AF_LEDGER_SCHEMA); assert.equal(ledger.disclaimer, AF_DISCLAIMER);
  assert.deepEqual(ledger.identity.head.map(n => n.name), ['C4', 'D4']); assert.deepEqual(ledger.identity.tail.map(n => n.name), ['Eb4', 'G4']);
  assert.deepEqual(ledger.identity.protected, { firstStatement: 'v1', phrases: ['v1'], parts: ['bars'] });
  assert.deepEqual([ledger.expectation.establishedBy, ledger.expectation.establishedAtBeat, ledger.expectation.owed.expectedAtBeat, ledger.expectation.owed.landing.name], [['v1', 'v2'], 7, 9.5, 'G4']);
  assert.deepEqual([ledger.intervention.transform, ledger.intervention.bar, ledger.intervention.keptNotes.map(n => n.name), ledger.intervention.removedNotes.map(n => n.name), ledger.intervention.alteredNotes], ['fragment:0-2', 3, ['C4', 'D4'], ['Eb4', 'G4'], []]);
  assert.deepEqual(ledger.intervention.gap, { fromBeat: 9.5, toBeat: 13.5, restInPart: false, alsoStatedBy: ['b-fast'] }, 'v4 begins inside the gap; the mallets state the motif there');
  assert.ok(ledger.payoff.state === 'resolved');
  assert.deepEqual([ledger.payoff.by, ledger.payoff.changedByAntiFormula, ledger.payoff.phrase, ledger.payoff.delivers, ledger.payoff.beat, ledger.payoff.bar, ledger.payoff.beatInBar, ledger.payoff.note.name, ledger.payoff.waitedBeats, ledger.payoff.transform], ['existing-phrase', false, 'v4', 'tail', 13.5, 4, 1.5, 'Eb4', 4, null]);
  assert.equal(ledger.payoff.frame, Math.round(13.5 * 0.5 * 44100)); assert.equal(ledger.payoff.seconds, 6.75);
  assert.deepEqual(ledger.timeline.map(e => `${e.beat} ${e.event} -> ${e.state}`), ['0 stated -> latent', '4 stated -> latent', '7 established -> established', '9.5 withheld -> open', '13.5 resolved -> resolved', '16 departed -> resolved']);
  assert.deepEqual(ledger.unchanged, { phrases: ['v1', 'v2', 'v4', 'close', 'b-head', 'b-mirror', 'b-fast'], parts: ['bars'], curvesAndSetup: 'identical in every part', notes: { source: 30, output: 28, removed: 2, added: 0, altered: 0 } });
  assert.deepEqual(ledger.memory.map(s => s.status).filter(s => s !== 'unchanged'), ['intervention']); assert.equal(ledger.memory.find(s => s.id === 'v3')!.form, 'partial');
  assert.equal(ledger.intervention.intent, 'leave the climb out once', 'the composer\'s words are carried verbatim');
});

test('withhold: the payoff may be an unchanged phrase that only sounds the owed landing note', () => {
  const { ledger } = applyAntiFormula(SOURCE, plan({ intervention: { target: 'v4' }, payoff: { phrase: 'close', delivers: 'landing', intent: 'the G arrives first, on the downbeat' } }));
  assert.ok(ledger.payoff.state === 'resolved');
  assert.deepEqual([ledger.payoff.phrase, ledger.payoff.note.name, ledger.payoff.beat, ledger.payoff.sameOctave, ledger.payoff.waitedBeats, ledger.intervention.gap.restInPart], ['close', 'G4', 16, true, 2.5, true]);
  assert.deepEqual(ledger.expectation.establishedBy, ['v1', 'v2']); assert.equal(ledger.timeline.filter(e => e.event === 'confirmed').length, 1, 'v3 confirmed it before v4 withheld');
});

test('defer: the owed tail is placed later with existing transforms, in the same part or handed to another', () => {
  const same = applyAntiFormula(fixture(VOICE.filter(p => p.id !== 'v4'), BARS), plan({ identity: { protect: { parts: ['bars'] } }, intervention: { kind: 'defer' }, payoff: { place: { at: 13 }, intent: 'the climb arrives a bar late' } }));
  const placed = same.score.parts[0]!.phrases!.at(-1)!;
  assert.deepEqual(placed, { id: 'v3.payoff', motif: 'theme', at: 13, transforms: [{ op: 'fragment', from: 2, to: 4 }] });
  assert.ok(same.ledger.payoff.state === 'resolved');
  assert.deepEqual([same.ledger.payoff.by, same.ledger.payoff.changedByAntiFormula, same.ledger.payoff.phrase, same.ledger.payoff.beat, same.ledger.payoff.transform, same.ledger.payoff.sameOctave], ['placed-phrase', true, 'v3.payoff', 13, 'fragment:2-4', true]);
  assert.deepEqual(same.ledger.unchanged.notes, { source: 26, output: 26, removed: 2, added: 2, altered: 0 });
  assert.deepEqual(same.ledger.memory.filter(s => s.status !== 'unchanged').map(s => [s.id, s.status, s.form]), [['v3', 'intervention', 'partial'], ['v3.payoff', 'placed', 'partial']]);
  assert.deepEqual(same.ledger.timeline.map(e => e.event), ['stated', 'stated', 'established', 'deferred', 'resolved', 'departed']);
  const handed = applyAntiFormula(SOURCE, plan({ identity: { protect: {} }, intervention: { kind: 'defer' }, payoff: { place: { id: 'b-answer', part: 'bars', at: 10.5, transforms: [{ op: 'octave', by: 1 }, { op: 'gesture', set: 'accent', at: [1] }] }, intent: 'the mallets finish the sentence' } }));
  assert.ok(handed.ledger.payoff.state === 'resolved');
  assert.deepEqual([handed.ledger.payoff.part, handed.ledger.payoff.note.name, handed.ledger.payoff.sameOctave, handed.ledger.payoff.transform, handed.ledger.payoff.waitedBeats], ['bars', 'Eb5', false, 'fragment:2-4 octave:1 gesture:accent@1', 1]);
  assert.deepEqual(handed.ledger.unchanged.parts, [], 'both parts changed, and the ledger says so');
});

test('reframe: the statement stays whole and lands elsewhere (v0.9 endOn); the original landing is owed', () => {
  const { score, ledger } = applyAntiFormula(SOURCE, plan({ intervention: { kind: 'reframe', target: 'v4', landOn: { step: 3 }, resolveWithinBeats: 4 }, payoff: { phrase: 'close', delivers: 'landing', intent: 'the G comes a bar late' } }));
  assert.deepEqual(score.parts[0]!.phrases![3]!.transforms, [{ op: 'endOn', step: 3 }]);
  assert.deepEqual([ledger.intervention.transform, ledger.intervention.removedNotes, ledger.intervention.alteredNotes.map(a => `${a.from.name}>${a.to.name}`), ledger.intervention.keptNotes.length], ['endOn:3', [], ['G4>F4'], 3]);
  assert.deepEqual(ledger.unchanged.notes, { source: 30, output: 30, removed: 0, added: 0, altered: 1 }); assert.equal(ledger.expectation.owed.expectedAtBeat, 14);
  assert.ok(ledger.payoff.state === 'resolved'); assert.equal(ledger.payoff.waitedBeats, 2); assert.equal(ledger.timeline.at(-2)!.event, 'reframed');
  assert.match(only(() => applyAntiFormula(SOURCE, plan({ intervention: { kind: 'reframe', target: 'v4', landOn: { step: 11 } }, payoff: { phrase: 'close', delivers: 'landing', intent: 'x' } }))), /^intervention\.landOn: step 11 is G, the note "v4" already lands on; nothing would be reframed$/);
});

test('unresolved debts: a debt may stay open only when the plan says so and why; otherwise an unpaid debt is an error', () => {
  const { ledger } = applyAntiFormula(SOURCE, plan({ intervention: { target: 'v4' }, payoff: { unresolved: true, reason: 'the piece ends on the question' } }));
  assert.deepEqual(ledger.payoff, { state: 'unresolved', reason: 'the piece ends on the question', withinBeats: 8 });
  assert.deepEqual(ledger.timeline.at(-1), { beat: 20, state: 'unresolved', event: 'left-open' }); assert.equal(ledger.timeline.at(-2)!.event, 'departed');
  assert.match(only(() => applyAntiFormula(SOURCE, plan({ payoff: { unresolved: true, reason: '' } }))), /^payoff: a debt left open needs \{ unresolved: true, reason \}/);
  // "close" is the motif backwards: it has the landing note but not the tail in a recognisable form before the deadline
  assert.equal(only(() => applyAntiFormula(SOURCE, plan({ intervention: { target: 'v4', resolveWithinBeats: 2 }, payoff: { phrase: 'close', delivers: 'landing', intent: 'x' } }))),
    'payoff: "close" delivers at beat 16, 2.5 beats after the owed material was expected (beat 13.5); intervention.resolveWithinBeats allows 2. Move the payoff earlier, or declare the longer wait');
  assert.equal(only(() => applyAntiFormula(SOURCE, plan({ payoff: { phrase: 'v2', delivers: 'tail', intent: 'x' } }))),
    'payoff: "v2" does not sound the owed tail (Eb4 G4) in a recognisable form at or after beat 9.5; it has no notes there');
  assert.match(only(() => applyAntiFormula(fixture(VOICE, [{ id: 'b-low', motif: 'theme', at: 16, transforms: [{ op: 'fragment', from: 0, to: 2 }, { op: 'octave', by: 1 }] }]), plan({ identity: { protect: {} }, intervention: { target: 'v4' }, payoff: { phrase: 'b-low', delivers: 'landing', intent: 'x' } }))),
    /^payoff: "b-low" does not sound the owed landing G4 \(any octave\) at or after beat 13\.5; it has C5 D5$/);
  assert.match(only(() => applyAntiFormula(SOURCE, plan({ intervention: { kind: 'defer' }, payoff: { place: { at: 9.5 }, intent: 'x' } }))), /^payoff\.place\.at: the tail returns at beat 9\.5, where it was already expected; a deferral has to arrive later$/);
});

test('guards: the first statement, an unestablished expectation, protected material and malformed plans are rejected with reasons', () => {
  assert.equal(only(() => applyAntiFormula(SOURCE, plan({ intervention: { target: 'v1' } }))), 'intervention.target: "v1" is the first statement of "theme"; the first statement is never changed (there is nothing yet to expect)');
  assert.equal(only(() => applyAntiFormula(SOURCE, plan({ intervention: { target: 'v2' } }))),
    'intervention.target: the expectation is not established before "v2" (bar 2): "voice" has stated "theme" whole 1 time by then (v1) and 2 are needed. Choose a later statement, or leave the passage as it is');
  assert.match(only(() => applyAntiFormula(SOURCE, plan({ expectation: { minStatements: 3 } }))), /whole 2 times by then \(v1, v2\) and 3 are needed/);
  assert.match(only(() => applyAntiFormula(SOURCE, plan({ expectation: { minStatements: 1 } }))), /^expectation\.minStatements: expected an integer 2\.\.16 \(one statement teaches nothing to expect\), got 1$/);
  assert.match(only(() => applyAntiFormula(SOURCE, plan({ intervention: { target: 'close' }, payoff: { unresolved: true, reason: 'x' } }))), /^intervention\.target: "close" is not a whole statement of "theme" \(it is developed: retrograde\)/);
  assert.deepEqual(problems(() => applyAntiFormula(SOURCE, plan({ identity: { protect: { phrases: ['v3'], parts: ['voice'] } } }))), ['intervention.target: "v3" is listed in identity.protect.phrases', 'intervention.target: part "voice" is listed in identity.protect.parts']);
  assert.match(only(() => applyAntiFormula(SOURCE, plan({ intervention: { target: 'b-fast' }, identity: { protect: {} } }))), /^intervention\.target: "b-fast" is in part "bars", but the expectation is taught in "voice"$/);
  assert.match(only(() => applyAntiFormula(SOURCE, plan({ identity: { motif: 'back' } }))), /^identity\.motif: "back" is derived from another motif; name the literal motif it comes from \(theme\)$/);
  assert.match(only(() => applyAntiFormula(SOURCE, plan({ identity: { headNotes: 4 } }))), /^identity\.headNotes: expected an integer 1\.\.3 /);
  assert.match(only(() => applyAntiFormula(SOURCE, plan({ intervention: { kind: 'defer' } }))), /^payoff: a deferral returns the owed tail later/);
  assert.match(only(() => applyAntiFormula(SOURCE, plan({ payoff: { place: { at: 13 }, intent: 'x' } }))), /^payoff: a withholding does not place new notes/);
  assert.match(only(() => applyAntiFormula(SOURCE, plan({ intervention: { kind: 'defer' }, payoff: { place: { at: 13, part: 'bars' }, intent: 'x' } }))), /^payoff\.place\.part: part "bars" is listed in identity\.protect\.parts$/);
  assert.match(only(() => applyAntiFormula(SOURCE, plan({ identity: { protect: {} }, intervention: { kind: 'defer' }, payoff: { place: { at: 12, part: 'bars', transforms: [{ op: 'octave', by: 4 }] }, intent: 'x' } }))), /^the changed score does not lower to a valid rack score: .*outside mechanical-orchestra\/bar range/);
  const empty = problems(() => applyAntiFormula(SOURCE, plan({ identity: { essence: '' }, expectation: { statement: ' ' }, intervention: { intent: '', reason: '' } })));
  assert.equal(empty.length, 4, 'the composer has to say what is protected, what is expected, what is intended and why');
  assert.throws(() => applyAntiFormula(lowerScore(SOURCE).score, plan()), /^Error: source: a "daemonv12\.signature-rack\.score\/2" score is required/);
  const run = (pitches: number[], beats: number[]) => pitches.map((pitch, i) => ({ beat: beats[i]!, beats: 0.5, pitch, velocity: 1 }));
  assert.equal(findRun(run([60], [0]), run([72], [0])), 0, 'a single owed note matches by pitch class');
  assert.equal(findRun(run([60, 62, 75, 79], [0, 1, 1.5, 2]), run([63, 67], [9.5, 10])), 2, 'the tail is found an octave up; the head (also rising) is not mistaken for it');
  assert.equal(findRun(run([60, 58, 65, 68], [0, 1, 1.25, 1.5]), run([63, 67], [9.5, 10])), 2, 'a diatonic transposition at double speed still counts (a third stays a third)');
  assert.equal(findRun(run([60, 62], [0, 1]), run([63, 67], [9.5, 10])), -1);
});

test('no aggregate score: neither the ledger nor the memory has a field that rates the music', () => {
  const keys = (v: unknown): string[] => (v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => [...(Array.isArray(v) ? [] : [k]), ...keys(x)]) : []);
  for (const doc of [applyAntiFormula(SOURCE, plan()).ledger, observe(SOURCE), read(`${HOOK10}/hook10-c.ledger.json`)]) for (const k of keys(doc)) assert.doesNotMatch(k, /score|rating|quality|grade|rank|total|weight|better|points/i, k);
});

test('determinism: the same source and plan give the same bytes, in this process and in a fresh one', t => {
  const a = applyAntiFormula(SOURCE, plan()), b = applyAntiFormula(structuredClone(SOURCE), structuredClone(plan()));
  assert.equal(json(a.score), json(b.score)); assert.equal(json(a.ledger), json(b.ledger));
  const dir = mkdtempSync(join(tmpdir(), 'af-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const run = () => spawnSync(process.execPath, ['studio-001/anti-formula/cli.ts', 'apply', `${HOOK10}/hook10-literal.score.json`, `${HOOK10}/hook10-c.plan.json`, '--out', join(dir, 'c.score.json'), '--ledger', join(dir, 'c.ledger.json')], { encoding: 'utf8' });
  const first = run(); assert.equal(first.status, 0, first.stderr);
  assert.equal(readFileSync(join(dir, 'c.score.json'), 'utf8'), readFileSync(`${HOOK10}/hook10-c.score.json`, 'utf8'), 'the committed C score is exactly what the committed source and plan produce');
  assert.equal(readFileSync(join(dir, 'c.ledger.json'), 'utf8'), readFileSync(`${HOOK10}/hook10-c.ledger.json`, 'utf8'), 'and so is the committed ledger');
  const second = run(); assert.equal(second.status, 1); assert.match(second.stderr, /refusing to overwrite an existing file/);
});

test('HOOK//10: the source is condition A exactly; C is A minus the three notes the ledger names; B1 is untouched', () => {
  const a = performanceJson(normalizeScore(read('studio-001/scores/hook10/hook10-a.score.json'))), source = read(`${HOOK10}/hook10-literal.score.json`) as ScoreInputV2;
  const lit = performanceJson(normalizeAnyScore(source)), c = performanceJson(normalizeAnyScore(read(`${HOOK10}/hook10-c.score.json`)));
  assert.deepEqual({ ...lit, title: 0 }, { ...a, title: 0 }, 'the score/2 transcription lowers to the committed condition A performance, note for note (title aside)');
  const ledger = read(`${HOOK10}/hook10-c.ledger.json`) as Ledger, removed = ledger.intervention.removedNotes.map(n => n.beat);
  assert.deepEqual(removed, [10, 10.5, 11]); assert.deepEqual(ledger.intervention.removedNotes.map(n => n.name), ['E5', 'C5', 'D5']);
  for (const [i, part] of a.parts.entries()) {
    const { notes, ...rest } = part, { notes: cNotes, ...cRest } = c.parts[i]!;
    assert.deepEqual(cRest, rest, `${part.id}: instrument, gain, pan, room, macro, controls, expression, setup, breaths and motion are A's`);
    assert.deepEqual(cNotes, part.id === 'voice' ? notes.filter(n => !removed.includes(n.beat)) : notes, `${part.id}: ${part.id === 'voice' ? 'A minus the three withheld notes' : 'identical to A'}`);
  }
  assert.deepEqual([c.bpm, c.key, c.swing, c.seed, c.transpose], [a.bpm, a.key, a.swing, a.seed, a.transpose]);
  assert.deepEqual(ledger.unchanged.notes, { source: 111, output: 108, removed: 3, added: 0, altered: 0 }); assert.deepEqual(ledger.unchanged.parts, ['bass', 'bars', 'clock']);
  assert.equal(ledger.source.sha256, sha256(Buffer.from(JSON.stringify(source)))); assert.equal(ledger.plan.sha256, sha256(Buffer.from(JSON.stringify(read(`${HOOK10}/hook10-c.plan.json`)))));
  assert.equal(ledger.output.sha256, sha256(Buffer.from(JSON.stringify(read(`${HOOK10}/hook10-c.score.json`)))));
  assert.deepEqual(ledger.timeline.map(e => `${e.beat} ${e.event} ${e.statement} -> ${e.state}`), ['0 stated voice.hook-1 -> latent', '4 stated voice.hook-2 -> latent', '8 established voice.hook-2 -> established', '10 withheld voice.hook-3 -> open', '12 resolved voice.cadence -> resolved']);
  assert.ok(ledger.payoff.state === 'resolved');
  assert.deepEqual([ledger.payoff.by, ledger.payoff.changedByAntiFormula, ledger.payoff.note.name, ledger.payoff.bar, ledger.payoff.beatInBar, ledger.payoff.seconds, ledger.payoff.frame], ['existing-phrase', false, 'D5', 4, 0, 7.5, 330750]);
  assert.deepEqual(ledger.intervention.gap, { fromBeat: 10, toBeat: 12, restInPart: true, alsoStatedBy: ['bars.echo-3'] }, 'two beats of rest in the voice; the mallet echo is the only statement of the hook there');
  // what the memory says about the three conditions (description, not judgement)
  const voice = (s: unknown) => observe(s as ScoreInputV2).expectations.find(e => e.motif === 'hook' && e.part === 'voice')!.timeline.map(e => e.event).join(' ');
  assert.equal(voice(source), 'stated stated established confirmed departed', 'A: the expectation is met a third time');
  assert.equal(voice(read('studio-001/scores/hook10/hook10-b1.score.json')), 'stated stated established departed departed', 'B1: the motif is developed away from it; no debt is recorded anywhere');
  assert.equal(motifReport(read(`${HOOK10}/hook10-c.score.json`)).recognizability, 1, 'the motif layer still recognises every statement in C');
  assert.equal(sha256(readFileSync('studio-001/scores/hook10/hook10-b1.score.json')), (read('proofs/v09-motif/hook10/MANIFEST.json') as { versions: { id: string; scoreSha256: string }[] }).versions.find(v => v.id === 'B1')!.scoreSha256);
});
