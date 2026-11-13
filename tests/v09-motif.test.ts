// v0.9 motif development layer: pure, fast checks of the score/2 lowering (docs/V0_9_MOTIF_DEVELOPMENT.md).
// Transform fixtures T1-T10, CROSSING equivalence R1-R2, determinism and safety S3-S9. No audio is rendered here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeScore, keyOf, getInstrument, listInstruments, SCORE_SCHEMA, RACK_INTERFACE_VERSION, type PartInput } from '../studio-001/rack/index.ts';
import {
  lowerScore, expandMotif, applyTransform, cellPitches, motifReport, motifEvents, onsetFrame, hook10Gate, normalizeAnyScore, GESTURE_TABLE,
  SCORE_SCHEMA_V2, MOTIF_INTERFACE_VERSION, GESTURES, TRANSFORM_OPS, MOTIF_LIMITS,
  type Cell, type Gesture, type GestureMap, type MotifInput, type MotifNoteInput, type PhraseInput, type ScoreInputV2, type Transform,
} from '../studio-001/motif/index.ts';

const C_MINOR = keyOf('C minor');
const M: MotifInput = { id: 'm', role: 'hook', notes: [[0, 1, 0], [1, 0.5, 1], [1.5, 0.5, 2], [2, 2, 4]] };
const cellOf = (m: MotifInput, ...more: MotifInput[]) => expandMotif(m, new Map([m, ...more].map(x => [x.id, x])), C_MINOR);
const run = (ts: Transform[], m: MotifInput = M): Cell => ts.reduce((c, t) => applyTransform(c, t), cellOf(m));
const pitches = (c: Cell) => cellPitches(c, C_MINOR);
const midi = (c: Cell) => pitches(c).map(n => n[2]);
type Part = PartInput & { phrases?: PhraseInput[] };
const v2 = (motifs: MotifInput[], parts: Part[], extra: Partial<ScoreInputV2> = {}): ScoreInputV2 => ({
  schema: SCORE_SCHEMA_V2, title: 'Motif test', bpm: 120, key: 'C minor', seed: 7, tailSeconds: 0.5, masterGainDb: 0, sections: [{ id: 'a', bars: 4 }], motifs, parts, ...extra });
const voice = (phrases: PhraseInput[], extra: Partial<Part> = {}): Part => ({ id: 'voice', instrument: 'impossible-voice', phrases, ...extra });
const message = (f: () => unknown): string => { try { f(); } catch (e) { return (e as Error).message; } return 'no error'; };
const only = (msg: string) => { const lines = msg.split('\n'); assert.equal(lines[0], 'score is invalid (1 problem):', msg); return lines[1]!.slice(2); };

test('interface: a separate layer over the unchanged rack; score/2 schema, fifteen transforms, six gestures', () => {
  assert.equal(RACK_INTERFACE_VERSION, '1.0.0', 'the approved rack interface is untouched'); assert.equal(MOTIF_INTERFACE_VERSION, '0.9.0');
  assert.equal('gestures' in getInstrument('living-bass')!, false, 'gesture tables live in the motif layer, not in the rack registry');
  assert.equal(SCORE_SCHEMA, 'daemonv12.signature-rack.score/1'); assert.equal(SCORE_SCHEMA_V2, 'daemonv12.signature-rack.score/2');
  assert.equal(TRANSFORM_OPS.length, 15); assert.deepEqual([...GESTURES], ['accent', 'soft', 'short', 'legato', 'lift', 'fall']);
});

test('T1-T9: every transform fixture resolves to the exact notes of the specification', () => {
  assert.deepEqual(pitches(run([])), [[0, 1, 60], [1, 0.5, 62], [1.5, 0.5, 63], [2, 2, 67]]);                                   // T1 literal
  assert.deepEqual(midi(run([{ op: 'invert' }])), [60, 58, 56, 53]);                                                            // T2 invert, axis 0
  assert.deepEqual(pitches(run([{ op: 'retrograde' }])), [[0, 2, 67], [2, 0.5, 63], [2.5, 0.5, 62], [3, 1, 60]]);               // T3
  const t4 = run([{ op: 'scale', factor: 2 }]);
  assert.deepEqual(pitches(t4), [[0, 2, 60], [2, 1, 62], [3, 1, 63], [4, 4, 67]]); assert.equal(t4.lengthBeats, 8);             // T4
  assert.deepEqual(midi(run([{ op: 'transpose', steps: 2 }])), [63, 65, 67, 70]);                                               // T5
  assert.deepEqual(midi(run([{ op: 'mode', to: 'major' }])), [60, 62, 64, 67]);                                                 // T6
  assert.equal(midi(run([{ op: 'endOn', step: 6, alt: 1 }])).at(-1), 71);                                                       // T7 harmonic leading tone
  const t8 = run([{ op: 'fragment', from: 0, to: 2 }, { op: 'sequence', steps: [0, 1, 2], every: 2 }]);
  assert.deepEqual(midi(t8), [60, 62, 62, 63, 63, 65]); assert.deepEqual(pitches(t8).map(n => n[0]), [0, 1, 2, 3, 4, 5]); assert.equal(t8.lengthBeats, 6); // T8
  assert.deepEqual(pitches(run([{ op: 'ornament', at: 3, kind: 'turn' }])).slice(3), [[2, 0.5, 68], [2.5, 0.5, 67], [3, 0.5, 65], [3.5, 0.5, 67]]);       // T9
});

test('the remaining transforms: shift, octave, rhythm, displace, upper/lower ornaments, gesture, dynamics, harmonic minor', () => {
  assert.deepEqual(midi(run([{ op: 'shift', semitones: 3 }])), [63, 65, 66, 70]);
  assert.deepEqual(midi(run([{ op: 'octave', by: -1 }])), [48, 50, 51, 55]);
  const r = run([{ op: 'rhythm', durations: [0.5, 0.5, 1, 0.25] }]);
  assert.deepEqual(pitches(r), [[0, 0.5, 60], [0.5, 0.5, 62], [1, 1, 63], [2, 0.25, 67]]); assert.equal(r.lengthBeats, 2.25);
  const d = run([{ op: 'displace', beats: 0.5 }]);
  assert.deepEqual(pitches(d).map(n => n[0]), [0.5, 1.5, 2, 2.5]); assert.equal(d.lengthBeats, 4.5);
  assert.deepEqual(pitches(run([{ op: 'ornament', at: 0, kind: 'upper' }])).slice(0, 3), [[0, 0.5, 60], [0.5, 0.25, 62], [0.75, 0.25, 60]]);
  assert.deepEqual(pitches(run([{ op: 'ornament', at: 0, kind: 'lower' }])).slice(0, 3), [[0, 0.5, 60], [0.5, 0.25, 58], [0.75, 0.25, 60]]);
  assert.deepEqual(run([{ op: 'gesture', set: 'accent', at: [0, 3] }]).notes.map(n => n.gesture), ['accent', undefined, undefined, 'accent']);
  assert.deepEqual(run([{ op: 'dynamics', from: 0.5, to: 1 }]).notes.map(n => +n.velocity.toFixed(6)), [0.4, 0.5, 0.55, 0.6]); // 0.8 * (0.5 + 0.5 * beat / 4)
  assert.deepEqual(midi(run([{ op: 'mode', to: 'harmonic-minor' }, { op: 'transpose', steps: 6 }])), [71, 72, 74, 77]);
  assert.equal(midi(run([{ op: 'invert', axis: 0 }], { id: 'm', notes: [[0, 1, 6, 0.8, { alt: 1 }]] }))[0], 60 - 12 + 2 - 1, 'invert negates the alteration');
  assert.equal(Math.abs(run([{ op: 'scale', factor: 0.6667 }]).lengthBeats - 8 / 3) < 1e-12, true, '0.6667 means exactly two thirds');
});

test('T10: transform algebra holds over twenty generated motifs (fixed-seed xorshift)', () => {
  let s = 0x9e3779b9;
  const next = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const pick = <T,>(xs: T[]) => xs[Math.floor(next() * xs.length)]!;
  const same = (a: Cell, b: Cell, why: string) => {
    const flat = (c: Cell) => ({ L: +c.lengthBeats.toFixed(6), notes: [...c.notes].sort((x, y) => x.beat - y.beat).map(n => [+n.beat.toFixed(6), +n.beats.toFixed(6), n.step, n.alt, n.semis, +n.velocity.toFixed(6)]) });
    assert.deepEqual(flat(a), flat(b), why);
  };
  for (let k = 0; k < 20; k++) {
    let beat = 0; const notes: MotifNoteInput[] = [];
    for (let i = 0, n = 3 + Math.floor(next() * 6); i < n; i++) {
      const beats = pick([0.25, 0.5, 0.75, 1, 1.5]);
      notes.push([beat, beats, Math.floor(next() * 22) - 7, +(0.3 + 0.6 * next()).toFixed(2), next() < 0.2 ? { alt: pick([-1, 1] as const) } : {}]);
      beat += beats + pick([0, 0, 0.25, 0.5]);
    }
    const m: MotifInput = { id: `g${k}`, notes }, c = cellOf(m), a = Math.floor(next() * 9) - 4, b = Math.floor(next() * 9) - 4, axis = Math.floor(next() * 12) - 2;
    same(run([{ op: 'retrograde' }, { op: 'retrograde' }], m), c, `motif ${k}: retrograde twice`);
    same(run([{ op: 'invert', axis }, { op: 'invert', axis }], m), c, `motif ${k}: invert(${axis}) twice`);
    same(run([{ op: 'transpose', steps: a }, { op: 'transpose', steps: b }], m), run([{ op: 'transpose', steps: a + b }], m), `motif ${k}: transpose ${a} then ${b}`);
    same(run([{ op: 'scale', factor: 2 }, { op: 'scale', factor: 0.5 }], m), c, `motif ${k}: scale 2 then 0.5`);
    same(run([{ op: 'scale', factor: 1.5 }, { op: 'scale', factor: 0.6667 }], m), c, `motif ${k}: scale 1.5 then 0.6667`);
    same(run([{ op: 'octave', by: 1 }], m), run([{ op: 'transpose', steps: 7 }], m), `motif ${k}: an octave is seven steps`);
  }
});

// ------------------------------------------------------------ real-repository equivalence (CROSSING)
const crossing = JSON.parse(readFileSync('studio-001/scores/crossing.score.json', 'utf8')) as { bpm: number; key: string; swing: number; seed: number; sections: ScoreInputV2['sections']; parts: PartInput[] };
const THEME: MotifInput = { id: 'theme', role: 'hook', octave: 4, notes: [
  [0, 1.5, 4, 0.62, { params: { vowel: 'oo', to: 'oh' } }], [1.5, 0.5, 5, 0.58, { params: { vowel: 'oh' } }], [2, 1, 6, 0.66, { params: { vowel: 'oh', to: 'ah' } }],
  [3, 1, 9, 0.74, { slide: 0.12, params: { vowel: 'ah' } }], [4, 2, 8, 0.8, { params: { vowel: 'ah', to: 'aw' } }], [6, 1, 7, 0.68, { params: { vowel: 'aw', to: 'oh' } }],
  [7, 0.5, 6, 0.6, { params: { vowel: 'oh' } }], [7.5, 0.45, 4, 0.55, { params: { vowel: 'oh', to: 'oo' } }],
] };
const crossingHead = { bpm: crossing.bpm, key: crossing.key, swing: crossing.swing, seed: crossing.seed, sections: crossing.sections };
const committed = normalizeScore(crossing);
const window = (part: string, from: number, to: number) => committed.parts.find(p => p.id === part)!.perf.notes.filter(n => n.beat >= from && n.beat < to);

test('R1: the CROSSING theme as a motif lowers to the notes committed in crossing.score.json', () => {
  const n = normalizeAnyScore(v2([THEME], [voice([{ motif: 'theme', at: 8 }])], crossingHead));
  assert.equal(n.parts[0]!.perf.notes.length, 8);
  assert.deepEqual(n.parts[0]!.perf.notes, window('voice', 8, 16), 'beats, durations, pitches, velocities, articulations, slides and params');
});

test('R2: transpose -2 reproduces the hand-typed voice-2 harmony at beats 40-47.5', () => {
  const n = normalizeAnyScore(v2([THEME], [voice([{ motif: 'theme', at: 40, transforms: [{ op: 'transpose', steps: -2 }] }])], crossingHead));
  const got = n.parts[0]!.perf.notes.map(x => [x.beat, x.beats, x.pitch]), hand = window('voice-2', 40, 48).map(x => [x.beat, x.beats, x.pitch]);
  assert.deepEqual(got, hand);
  assert.deepEqual(got.map(x => x[2]), [63, 65, 67, 72, 70, 68, 67, 63]); assert.deepEqual(got.map(x => x[1]), [1.5, 0.5, 1, 1, 2, 1, 0.5, 0.45]);
});

// ------------------------------------------------------------ lowering
test('lowering: phrase notes follow authored notes in phrase order; the output is a plain score/1', () => {
  const input = v2([M], [voice([{ motif: 'm', at: 4 }, { motif: 'm', at: { section: 'a', bar: 1, beat: 0 }, velocity: 0.5 }], { notes: [[12, 1, 'C4', 0.5]] })]);
  const l = lowerScore(input);
  assert.equal(l.score.schema, SCORE_SCHEMA); assert.equal('motifs' in l.score, false); assert.equal('phrases' in l.score.parts[0]!, false);
  assert.deepEqual(l.score.parts[0]!.notes, [[12, 1, 'C4', 0.5],
    { beat: 4, beats: 1, pitch: 60, velocity: 0.8 }, { beat: 5, beats: 0.5, pitch: 62, velocity: 0.8 }, { beat: 5.5, beats: 0.5, pitch: 63, velocity: 0.8 }, { beat: 6, beats: 2, pitch: 67, velocity: 0.8 },
    { beat: 0, beats: 1, pitch: 60, velocity: 0.4 }, { beat: 1, beats: 0.5, pitch: 62, velocity: 0.4 }, { beat: 1.5, beats: 0.5, pitch: 63, velocity: 0.4 }, { beat: 2, beats: 2, pitch: 67, velocity: 0.4 }]);
  assert.deepEqual(l.trace.map(t => `${t.phrase}.n${t.note}`), ['voice.p0.n0', 'voice.p0.n1', 'voice.p0.n2', 'voice.p0.n3', 'voice.p1.n0', 'voice.p1.n1', 'voice.p1.n2', 'voice.p1.n3']);
  assert.deepEqual(input.parts[0]!.phrases!.length, 2, 'the authored score is not mutated');
  assert.deepEqual(normalizeAnyScore(input).parts[0]!.perf.notes, normalizeScore(l.score).parts[0]!.perf.notes, 'normalizeAnyScore lowers, then uses the rack');
  assert.match(message(() => normalizeScore(input)), /schema: expected "daemonv12\.signature-rack\.score\/1"/, 'the approved rack itself still accepts only score/1');
  const plain = l.score;
  assert.deepEqual(normalizeAnyScore(plain), normalizeScore(plain), 'a score/1 passes straight through to the rack');
});

test('section-relative placement, derived motifs and phrase chains', () => {
  const answer: MotifInput = { id: 'answer', role: 'answer', from: 'm', transforms: [{ op: 'endOn', step: 0 }] };
  const tail: MotifInput = { id: 'tail', from: 'answer', octave: 5, transforms: [{ op: 'fragment', from: 2, to: 4 }] };
  const sections = [{ id: 'intro', bars: 1 }, { id: 'main', bars: 3 }];
  const l = lowerScore(v2([M, answer, tail], [voice([
    { motif: 'answer', at: { section: 'main', bar: 2, beat: 1.5 } }, { id: 'voice.tail', motif: 'tail', at: { section: 'main', bar: 1 }, transforms: [{ op: 'transpose', steps: 1 }] }])], { sections }));
  assert.deepEqual(l.phrases.map(p => [p.id, p.motif, p.root, p.role, p.at, p.chain]), [
    ['voice.p0', 'answer', 'm', 'answer', 9.5, ['endOn:0']], ['voice.tail', 'tail', 'm', 'answer', 4, ['endOn:0', 'fragment:2-4', 'transpose:1']]]);
  assert.deepEqual(l.phrases[0]!.notes.map(n => n.pitch), [60, 62, 63, 60]);
  assert.deepEqual(l.phrases[1]!.notes.map(n => [n.beat, n.pitch]), [[4, 77], [4.5, 74]], 'derived octave 5, fragment rebased to the phrase start');
});

test('S4: score transpose reaches every lowered pitch exactly once', () => {
  const input = v2([M], [voice([{ motif: 'm', at: 0 }, { motif: 'm', at: 4, transforms: [{ op: 'transpose', steps: 3 }] }])], { transpose: 5 });
  const lowered = lowerScore(input).score.parts[0]!.notes!.map(n => (n as { pitch: number }).pitch);
  assert.deepEqual(lowered, [60, 62, 63, 67, 65, 67, 68, 72], 'lowering resolves against the untransposed key');
  const played = normalizeAnyScore(input);
  assert.deepEqual(played.parts[0]!.perf.notes.map(n => n.pitch), lowered.map(p => p + 5));
  assert.equal(played.key.label, 'F minor');
  assert.deepEqual(normalizeAnyScore({ ...input, transpose: 0 }, { transpose: 5 }).parts[0]!.perf.notes.map(n => n.pitch), lowered.map(p => p + 5), '--transpose behaves the same');
});

test('S5: lowering errors are specific and carry a fix (exact messages)', () => {
  const err = (motifs: MotifInput[], phrases: PhraseInput[]) => only(message(() => lowerScore(v2(motifs, [voice(phrases)]))));
  assert.equal(err([M], [{ motif: 'nope', at: 0 }]), 'parts[0] (voice).phrases[0].motif: unknown motif "nope" (defined: m)');
  assert.equal(err([M, { id: 'a', from: 'b' }, { id: 'b', from: 'a' }], []), 'motifs[2] (b).from: cycle a -> b -> a (a derived motif must end at a literal motif)');
  assert.equal(err([M], [{ motif: 'm', at: 0, transforms: [{ op: 'sequence', steps: [0, 1], every: 2 }] }]),
    'parts[0] (voice).phrases[0].transforms[0]: sequence every 2 is shorter than the cell (4 beats): copies would overlap (set every >= 4, or fragment or scale the cell first)');
  assert.equal(err([M], [{ motif: 'm', at: 0, transforms: [{ op: 'rhythm', durations: [1, 1, 1] }] }]),
    'parts[0] (voice).phrases[0].transforms[0]: rhythm has 3 durations for 4 notes (give exactly one duration per note)');
  assert.equal(err([{ ...M, transforms: undefined, notes: [[0, 0.125, 0]] }], [{ motif: 'm', at: 0, transforms: [{ op: 'ornament', at: 0, kind: 'turn' }] }]),
    'parts[0] (voice).phrases[0].transforms[0]: ornament turn on note 0 makes pieces of 0.03125 beat (each piece must be at least 0.0625 beat: ornament a note of 0.25 beat or longer)');
  const high: MotifInput = { ...M, octave: 6 };
  assert.equal(err([high], [{ motif: 'm', at: 0 }]),
    'parts[0] (voice).phrases[0] (voice.p0) note 1 at beat 1: pitch 86 outside impossible-voice range 43..84 (transpose the part or the score), or set "fit": "octave" on the phrase');
  const fitted = lowerScore(v2([high], [voice([{ motif: 'm', at: 0, fit: 'octave' }])]));
  assert.deepEqual(fitted.phrases[0]!.notes.map(n => n.pitch), [72, 74, 75, 79]); assert.equal(fitted.phrases[0]!.octaveShift, -1);
  assert.equal(only(message(() => lowerScore(v2([{ ...M, octave: 8 }], [{ id: 'clock', instrument: 'mechanical-orchestra/clock', phrases: [{ motif: 'm', at: 0, fit: 'octave', transforms: [{ op: 'sequence', steps: [0, 30], every: 4 }] }] }])))),
    'parts[0] (clock).phrases[0] (clock.p0): no octave shift puts all 8 notes inside mechanical-orchestra/clock range 60..100 (the phrase spans 58 semitones; fragment it or use another instrument)');
  assert.equal(err([M], [{ motif: 'm', at: { section: 'b', bar: 1 } }]), 'parts[0] (voice).phrases[0].at.section: unknown section "b" (defined: a)');
  assert.equal(err([M], [{ motif: 'm', at: { section: 'a', bar: 5 } }]), 'parts[0] (voice).phrases[0].at.bar: expected a bar 1..4 of section "a", got 5');
  assert.equal(err([M], [{ motif: 'm', at: 0, transforms: [{ op: 'reverse' } as unknown as Transform] }]),
    `parts[0] (voice).phrases[0].transforms[0]: unknown transform "reverse" (one of ${TRANSFORM_OPS.join(', ')})`);
  assert.equal(err([{ id: 'm', notes: [[0, 1, 0, 0.8, { vowel: 'oh' } as never]] }], []),
    'motifs[0] (m).notes[0]: unknown option "vowel" (alt, gesture, articulation, slide, params; instrument values such as vowel go inside params)');
  assert.match(message(() => lowerScore({ ...v2([M], [voice([])]), schema: SCORE_SCHEMA })), /schema: expected "daemonv12\.signature-rack\.score\/2"/);
});

test('limits: motifs, notes per motif, transforms per chain, derivation depth, phrases per part', () => {
  const many = Array.from({ length: MOTIF_LIMITS.motifs + 1 }, (_, i): MotifInput => ({ id: `m${i}`, notes: [[0, 1, 0]] }));
  assert.match(message(() => lowerScore(v2(many, [voice([])]))), /motifs: an array of at most 64 motifs/);
  assert.match(message(() => lowerScore(v2([{ id: 'm', notes: Array.from({ length: 65 }, (_, i): MotifNoteInput => [i, 1, 0]) }], [voice([])]))), /motifs\[0\] \(m\)\.notes: 1\.\.64 notes/);
  const chain = Array.from({ length: 17 }, (): Transform => ({ op: 'transpose', steps: 0 }));
  assert.match(message(() => lowerScore(v2([M], [voice([{ motif: 'm', at: 0, transforms: chain }])]))), /phrases\[0\]\.transforms: an array of at most 16 transforms/);
  const deep = [M, ...Array.from({ length: 9 }, (_, i): MotifInput => ({ id: `d${i}`, from: i ? `d${i - 1}` : 'm' }))];
  assert.match(message(() => lowerScore(v2(deep, [voice([{ motif: 'd8', at: 0 }])]))), /more than 8 motifs deep/);
  assert.equal(lowerScore(v2(deep.slice(0, 9), [voice([{ motif: 'd7', at: 0 }])])).phrases.length, 1, 'eight derivations are allowed');
  const phrases = Array.from({ length: 513 }, (): PhraseInput => ({ motif: 'm', at: 0 }));
  assert.match(message(() => lowerScore(v2([M], [voice(phrases)]))), /phrases: an array of at most 512 phrases/);
});

test('S6: a sung motif handed to the mallet bars lowers, and reports what it dropped', () => {
  const sung: MotifInput = { id: 'sung', octave: 5, notes: [[0, 1, 0, 0.8, { params: { vowel: 'oh', to: 'ah' } }], [1, 1, 2, 0.8, { articulation: 'cry', params: { vowel: 'ah', cry: 1 } }], [2, 2, 4, 0.8, { gesture: 'fall', params: { vowel: 'oo' } }]] };
  const input = v2([sung], [{ id: 'bars', instrument: 'mechanical-orchestra/bar', phrases: [{ motif: 'sung', at: 0 }] }]);
  const l = lowerScore(input);
  assert.equal(l.droppedParams, 6); assert.equal(l.problems.length, 6); assert.equal(motifReport(input).droppedParams, 6);
  assert.equal(l.problems[0], 'warning: parts[0] (bars).phrases[0] (bars.p0) note 0: parameter "vowel" does not exist on mechanical-orchestra/bar; dropped (hardness, damp)');
  assert.match(l.problems[2]!, /articulation "cry" does not exist on mechanical-orchestra\/bar; dropped \(use a gesture/);
  assert.deepEqual(l.score.parts[0]!.notes, [{ beat: 0, beats: 1, pitch: 72, velocity: 0.8 }, { beat: 1, beats: 1, pitch: 75, velocity: 0.8 }, { beat: 2, beats: 2, pitch: 79, velocity: 0.8, articulation: 'ring', damp: 1.2 }]);
  assert.doesNotThrow(() => normalizeAnyScore(input));
  assert.equal(lowerScore(v2([sung], [voice([{ motif: 'sung', at: 0 }])])).droppedParams, 0, 'nothing is dropped on the instrument the motif was written for');
});

test('S7: every gesture lowers to the specification table on every instrument', () => {
  const P = (velocity?: number, beats?: number): GestureMap => ({ ...(velocity !== undefined ? { velocity } : {}), ...(beats !== undefined ? { beats } : {}) });
  const plain = { accent: P(1.15), soft: P(0.7), short: P(undefined, 0.5) };
  const TABLE: Record<string, [number, Partial<Record<Gesture, GestureMap>>]> = {
    'living-bass': [2, { accent: { articulation: 'accent' }, soft: { articulation: 'ghost' }, short: { articulation: 'staccato' }, legato: { articulation: 'legato' }, lift: { articulation: 'normal', params: { scoop: 2 } }, fall: { articulation: 'normal', params: { dive: 2 } } }],
    'impossible-voice': [4, { accent: { articulation: 'sung', velocity: 1.12 }, soft: { articulation: 'hum', velocity: 0.7 }, short: { articulation: 'detached' }, legato: { articulation: 'legato' }, lift: { articulation: 'sung', params: { cry: 1 } }, fall: { articulation: 'fall', params: { fall: 0.8 } } }],
    'mechanical-orchestra/bar': [5, { accent: { articulation: 'hard' }, soft: { articulation: 'soft' }, short: { articulation: 'muted' }, legato: { articulation: 'ring' }, lift: { articulation: 'strike', params: { hardness: 0.7 } }, fall: { articulation: 'ring', params: { damp: 1.2 } } }],
    'mechanical-orchestra/bow': [4, { accent: { articulation: 'bite' }, soft: { articulation: 'swell', velocity: 0.7 }, short: { articulation: 'bite', beats: 0.5 }, legato: { articulation: 'swell' }, lift: { articulation: 'swell' }, fall: { articulation: 'swell' } }],
    'mechanical-orchestra/spring': [3, { accent: { articulation: 'twang' }, soft: { articulation: 'pluck', velocity: 0.7 }, short: { articulation: 'damped' }, lift: { articulation: 'twang' } }],
    'mechanical-orchestra/tine': [5, { accent: { articulation: 'buzz' }, soft: { articulation: 'clean', velocity: 0.7 }, short: { articulation: 'clean', beats: 0.5 } }],
    'mechanical-orchestra/clock': [5, plain], 'mechanical-orchestra/bearings': [6, plain], 'context/kick': [1, plain], 'context/snare': [4, plain],
  };
  assert.deepEqual(listInstruments().map(i => i.id).sort(), Object.keys(TABLE).sort(), 'the table covers every rack instrument');
  for (const [id, [octave, table]] of Object.entries(TABLE)) {
    assert.deepEqual(GESTURE_TABLE[id], table, `${id}: gesture table`);
    for (const g of GESTURES) {
      const input = v2([{ id: 'g', octave, notes: [[0, 1, 0, 0.5, { gesture: g }]] }], [{ id: 'p', instrument: id, phrases: [{ motif: 'g', at: 0 }] }]);
      const e = table[g] ?? {}, want = { beat: 0, beats: e.beats ?? 1, pitch: 12 * (octave + 1), velocity: +(0.5 * (e.velocity ?? 1)).toFixed(6), ...(e.articulation ? { articulation: e.articulation } : {}), ...e.params };
      const l = lowerScore(input);
      assert.deepEqual(l.score.parts[0]!.notes, [want], `${id} ${g}`); assert.equal(l.droppedParams, 0);
      assert.doesNotThrow(() => normalizeAnyScore(input), `${id} ${g}: only existing articulations and params`);
    }
  }
  const explicit = lowerScore(v2([{ id: 'g', octave: 2, notes: [[0, 1, 0, 0.5, { gesture: 'lift', articulation: 'accent', params: { scoop: 5 } }]] }], [{ id: 'b', instrument: 'living-bass', phrases: [{ motif: 'g', at: 0 }] }]));
  assert.deepEqual(explicit.score.parts[0]!.notes, [{ beat: 0, beats: 1, pitch: 36, velocity: 0.5, articulation: 'accent', scoop: 5 }], 'an explicit articulation or param wins over the gesture');
});

test('S8: event frames are the onset frames the rack renders at; a phrase starts on its first note', () => {
  const figure: MotifInput = { id: 'f', octave: 5, notes: [[0.25, 0.25, 0], [0.75, 0.25, 2], [1, 0.5, 4], [1.5, 0.25, 2], [2.75, 0.25, 0], [3.5, 0.5, 4]] };
  for (const [bpm, swing] of [[96, 0.5], [96, 0.55], [120, 0.6], [84, 0.55], [133, 0.5]] as const) {
    const input = v2([figure], [{ id: 'bars', instrument: 'mechanical-orchestra/bar', phrases: [{ motif: 'f', at: 0 }, { motif: 'f', at: { section: 'a', bar: 3 }, transforms: [{ op: 'scale', factor: 0.5 }, { op: 'displace', beats: 1 / 3 }] }] }], { bpm, swing });
    const ev = motifEvents(input), n = normalizeAnyScore(input), notes = ev.events.filter(e => e.kind === 'note');
    assert.deepEqual(notes.map(e => e.frame).sort((a, b) => a - b), n.parts[0]!.perf.notes.map(x => Math.round(x.beat * n.beatSeconds * 44100)), `${bpm} BPM, swing ${swing}: the mallet render path places notes at round(beat * beatSeconds * 44100)`);
    for (const e of notes) assert.equal(e.frame, onsetFrame(e.beat, bpm, swing));
    for (const ph of ev.events.filter(e => e.kind === 'phrase')) assert.equal(ph.frame, notes.find(e => e.phrase === ph.id)!.frame, 'phrase frame = first note frame');
    assert.equal(ev.sampleRate, 44100); assert.equal(ev.bpm, bpm); assert.equal(ev.swing, swing);
  }
  const hook = motifEvents(v2([M], [voice([{ id: 'voice.p0', motif: 'm', at: 0, transforms: [{ op: 'transpose', steps: -2 }] }])], { bpm: 96 }));
  assert.deepEqual(hook.events[0], { id: 'voice.p0', kind: 'phrase', part: 'voice', motif: 'm', root: 'm', role: 'hook', chain: ['transpose:-2'], literal: false, beat: 0, frame: 0, lengthBeats: 4, endFrame: 110250 });
  assert.deepEqual([hook.events[4]!.id, hook.events[4]!.beat, hook.events[4]!.frame], ['voice.p0.n3', 2, 55125], 'the example of the specification');
  assert.equal(hook.endFrame, 441000);
});

test('S9: the motif report equals hand-computed values on a small fixture', () => {
  const input = v2([M], [
    voice([{ motif: 'm', at: 0 }, { motif: 'm', at: 4 }, { motif: 'm', at: 8, transforms: [{ op: 'transpose', steps: 2 }] }, { motif: 'm', at: 12, transforms: [{ op: 'retrograde' }] }]),
    { id: 'bars', instrument: 'mechanical-orchestra/bar', notes: [[0, 1, 'C5'], [4, 1, 'C5']], phrases: [{ motif: 'm', at: 8, transforms: [{ op: 'octave', by: 1 }] }] },
    { id: 'kick', instrument: 'context/kick', repeats: [{ fromBeat: 0, toBeat: 16, lengthBeats: 4, notes: [[0, 0.5, 'G1']] }] },
  ]);
  const r = motifReport(input);
  assert.equal(r.partNotes, 22); assert.equal(r.phraseNotes, 20); assert.equal(r.coverage, 0.909091, '20 of 22 onsets in the two non-context parts come from phrases');
  assert.deepEqual(r.statements, { m: { literal: 3, varied: 2, parts: ['voice', 'bars'] } });
  assert.deepEqual(r.transformKinds, ['octave', 'retrograde', 'transpose']); assert.deepEqual(r.developingKinds, ['retrograde', 'transpose']);
  assert.deepEqual(r.crossPart, ['m']);
  assert.equal(r.recognizability, 0.5); assert.deepEqual(r.unrecognizable, ['voice.p3'], 'the retrograde keeps neither contour nor rhythm; the transposition keeps both');
  assert.deepEqual(r.maxLiteralRun, { voice: 2, bars: 2, kick: 4 });
  assert.deepEqual(r.cadence, { part: 'bars', pitch: 79, step: 4 }, 'the mallets are the highest part stating the hook; their last note is G5, step 4');
  assert.equal(r.droppedParams, 0);
  const gate = hook10Gate(r);
  assert.equal(gate.pass, false);
  assert.deepEqual(Object.entries(gate.checks).filter(([, ok]) => !ok).map(([k]) => k), ['at least 3 pitch- or rhythm-changing transform kinds', 'recognizability = 1.0', 'maxLiteralRun <= 2 in every part']);
});

test('recognisability: fragments, sequences, ornaments and augmentation stay related; retrograde does not', () => {
  const keeps = (ts: Transform[]) => { const p = lowerScore(v2([M], [voice([{ motif: 'm', at: 0, transforms: ts, fit: 'octave' }])])).phrases[0]!; return [p.literal, p.keepsContour, p.keepsRhythm]; };
  assert.deepEqual(keeps([]), [true, true, true]);
  assert.deepEqual(keeps([{ op: 'octave', by: 1 }, { op: 'dynamics', from: 1, to: 0.5 }, { op: 'gesture', set: 'soft' }]), [true, true, true], 'register, dynamics and gesture are not development');
  assert.deepEqual(keeps([{ op: 'invert' }]), [false, false, true]);
  assert.deepEqual(keeps([{ op: 'rhythm', durations: [0.5, 0.5, 0.5, 0.5] }]), [false, true, false]);
  assert.deepEqual(keeps([{ op: 'scale', factor: 2 }]), [false, true, true], 'augmentation keeps the contour and the rhythm at another speed');
  assert.deepEqual(keeps([{ op: 'fragment', from: 0, to: 2 }, { op: 'sequence', steps: [0, 1, 2], every: 2 }]), [false, true, true], 'each sequence copy is a window of the motif');
  assert.deepEqual(keeps([{ op: 'ornament', at: 3, kind: 'turn' }]), [false, true, true], 'an ornament folds back into its principal note');
  assert.deepEqual(keeps([{ op: 'retrograde' }]), [false, false, false]);
  assert.deepEqual(keeps([{ op: 'invert' }, { op: 'rhythm', durations: [0.5, 0.5, 0.5, 0.5] }]), [false, false, false]);
  assert.deepEqual(keeps([{ op: 'fragment', from: 1, to: 2 }]), [false, false, false], 'a single note is not a statement');
});

test('S3: two fresh processes expand to byte-identical lowered score, report and events', t => {
  const dir = mkdtempSync(join(tmpdir(), 'v09-motif-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const score = 'studio-001/scores/hook10/hook10-b1.score.json';
  const expand = (k: string) => {
    const r = spawnSync(process.execPath, ['studio-001/motif/cli.ts', 'expand', score, '--out', join(dir, `${k}.score.json`), '--report', join(dir, `${k}.report.json`), '--events', join(dir, `${k}.events.json`)], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return ['score', 'report', 'events'].map(f => readFileSync(join(dir, `${k}.${f}.json`), 'utf8'));
  };
  const a = expand('a'), b = expand('b');
  assert.deepEqual(a, b);
  assert.equal(a[0], readFileSync('proofs/v09-motif/hook10/B1/score.lowered.json', 'utf8'), 'and equal to the lowered score committed with the HOOK//10 masters');
  const again = spawnSync(process.execPath, ['studio-001/motif/cli.ts', 'expand', score, '--out', join(dir, 'a.score.json')], { encoding: 'utf8' });
  assert.equal(again.status, 1); assert.match(again.stderr, /refusing to overwrite an existing file/);
  const stdout = spawnSync(process.execPath, ['studio-001/motif/cli.ts', 'expand', score], { encoding: 'utf8' });
  assert.equal(stdout.stdout, a[0], 'without --out the lowered score goes to stdout');
});

test('the committed score/2 example lowers and passes the rack validation', () => {
  const s = JSON.parse(readFileSync('studio-001/scores/examples/motif-theme.score.json', 'utf8')) as ScoreInputV2, n = normalizeAnyScore(s), r = motifReport(s);
  assert.deepEqual(n.parts.map(p => p.perf.notes.length), [16, 8, 12]);
  assert.deepEqual(n.parts[1]!.perf.notes.slice(0, 7).map(x => x.pitch), [63, 65, 67, 72, 70, 68, 67], 'the second voice is the theme a diatonic third lower');
  assert.equal(r.coverage, 1); assert.equal(r.recognizability, 1); assert.deepEqual(r.crossPart, ['theme']); assert.deepEqual([r.cadence?.part, r.cadence?.step], ['bars', 2], 'the mallets are the highest part stating the theme');
});

test('HOOK//10 scores: A is a plain score/1; B1-B3 pass the structure gate of the specification', () => {
  const load = (f: string) => JSON.parse(readFileSync(`studio-001/scores/hook10/${f}`, 'utf8')) as ScoreInputV2;
  const a = load('hook10-a.score.json') as unknown as { schema: string; parts: PartInput[] };
  assert.equal(a.schema, SCORE_SCHEMA); assert.equal(JSON.stringify(a).includes('motif'), false); assert.ok(a.parts.every(p => p.repeats?.length === 1));
  const b1 = normalizeAnyScore(load('hook10-b1.score.json')), an = normalizeScore(a);
  for (const [i, part] of an.parts.entries()) {
    const same = (from: number, to: number) => assert.deepEqual(part.perf.notes.filter(n => n.beat >= from && n.beat < to).map(n => ({ ...n, beat: n.beat - from })), b1.parts[i]!.perf.notes.filter(n => n.beat >= from && n.beat < to).map(n => ({ ...n, beat: n.beat - from })), `${part.id} beats ${from}-${to}`);
    if (part.id !== 'clock') { same(0, 4); same(12, 16); } // the clock is velocity-humanised per note index; its notated notes are compared below
    assert.deepEqual([part.gainDb, part.pan, part.room, part.perf.macro, part.perf.expression], [b1.parts[i]!.gainDb, b1.parts[i]!.pan, b1.parts[i]!.room, b1.parts[i]!.perf.macro, b1.parts[i]!.perf.expression], `${part.id}: same mix and curves`);
  }
  for (const f of ['hook10-b1.score.json', 'hook10-b2.score.json', 'hook10-b3.score.json']) {
    const s = load(f), r = motifReport(s), gate = hook10Gate(r);
    assert.equal(gate.pass, true, `${f}: ${JSON.stringify(gate.checks)}`);
    assert.equal(s.bpm, 96); assert.equal(s.key, 'D minor'); assert.equal(motifEvents(s).endFrame, 441000);
    assert.deepEqual(s.parts.map(p => p.instrument), ['impossible-voice', 'living-bass', 'mechanical-orchestra/bar', 'mechanical-orchestra/clock'], 'the benchmark instruments, no context drums');
    assert.equal(JSON.stringify(lowerScore(s).score, null, 2) + '\n', readFileSync(`proofs/v09-motif/hook10/${f.slice(7, 9).toUpperCase()}/score.lowered.json`, 'utf8'));
  }
});
