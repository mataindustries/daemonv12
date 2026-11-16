import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assemble, buildScore, critique, grooveAudition, type Spec } from '../composer-kit/build.ts';
import { patchAudition } from '../composer-kit/audition.ts';
import { finalize, notesIn, part, section } from '../composer-kit/core.ts';
import { PATCHES } from '../composer-kit/palette.ts';
import { GROOVES } from '../composer-kit/grooves.ts';
import { FORMS } from '../composer-kit/forms.ts';
import { MOVES } from '../composer-kit/moves.ts';
import { normalizeScore } from '../studio-001/rack/score.ts';

const hook = { bars: 2, notes: [[0, 0.5, 'G4', 0.9], [0.75, 0.25, 'D4', 0.6], [1.5, 0.5, 'F4', 0.85], [3, 0.75, 'Bb3', 0.8], [4.5, 0.5, 'C4', 0.75], [6, 1, 'G3', 0.9]] } as Spec['voices'][string]['cell'];
const spec = (over: Partial<Spec> = {}): Spec => ({
  title: 'Test Sketch', key: 'G minor', groove: 'limp', seed: 5, hook: 'lead',
  voices: { bass: {}, lead: { patch: 'dead-marimba', cell: hook! }, answer: { patch: 'warm-throat' }, pad: { patch: 'rosin-drone' }, texture: { patch: 'bearing-rain' } }, ...over,
});
const plainSections = [{ id: 'a', bars: 4, heat: 0.2, play: ['bass', 'drums', 'hat', 'lead', 'pad'], fill: false }, { id: 'b', bars: 4, heat: 0.4, play: ['bass', 'drums', 'hat', 'lead', 'pad'], fill: false }];

test('composer kit: every patch and groove is a valid rack score', () => {
  assert.ok(PATCHES.filter(p => !p.internal && p.character !== 'utility').length >= 15);
  assert.ok(GROOVES.length >= 10);
  for (const p of PATCHES.filter(x => !x.internal)) { assert.ok(p.where.length > 20, p.id); assert.doesNotThrow(() => normalizeScore(finalize(patchAudition(p))), p.id); }
  for (const g of GROOVES) {
    assert.doesNotThrow(() => normalizeScore(grooveAudition(g.id)), g.id);
    const onBeats = [0, 1, 2, 3].every(b => g.kick.some(h => h[0] === b)); // no four-on-the-floor
    assert.equal(onBeats, false, `${g.id} is four-on-the-floor`);
  }
});

test('composer kit: every form builds a 30–60 s score for a bass-owned and a lead-owned hook', () => {
  for (const f of FORMS) for (const owner of ['bass', 'lead']) {
    const s = spec({ form: f.id, hook: owner, grooveB: 'lean-back' }), n = normalizeScore(buildScore(s));
    const seconds = n.endBeat * n.beatSeconds;
    assert.ok(seconds > 30 && seconds < 60, `${f.id}/${owner}: ${seconds}s`);
    assert.ok(critique(assemble(s)).table.length === n.sections.length + 1);
  }
});

test('composer kit: the build is seeded and reproducible', () => {
  const a = JSON.stringify(buildScore(spec())), b = JSON.stringify(buildScore(spec()));
  assert.equal(a, b);
  assert.notEqual(a, JSON.stringify(buildScore(spec(), 6)));
  assert.equal(JSON.stringify(buildScore(spec({ seed: 6 }))), JSON.stringify(buildScore(spec(), 6)));
});

test('composer kit: every move applies and leaves a valid score', () => {
  assert.ok(MOVES.length >= 8 && MOVES.length <= 12);
  for (const m of MOVES) {
    assert.ok(m.works.length > 20 && m.cheap.length > 20, m.id);
    const s = spec({ sections: plainSections, moves: [{ move: m.id, section: 'b', to: 'answer', answer: 'answer' }] });
    assert.doesNotThrow(() => normalizeScore(buildScore(s)), m.id);
  }
});

test('composer kit: moves do what they say', () => {
  const draft = (moves: Spec['moves']) => assemble(spec({ sections: plainSections, moves }));
  const base = draft([]), b = section(base, 'b');
  let d = draft([{ move: 'floorDrop', section: 'b' }]);
  assert.equal(notesIn(part(d, 'kick'), b.start, b.end).length, 4);
  assert.deepEqual(notesIn(part(d, 'snare'), b.start, b.end).map(n => n[0] % 4), [2, 2, 2, 2]);
  d = draft([{ move: 'negativeSpace', section: 'b', beats: 2 }]);
  for (const p of d.parts) assert.equal(notesIn(p, b.end - 2, b.end).length, 0, p.id);
  d = draft([{ move: 'handOff', section: 'b', to: 'answer' }]);
  assert.equal(notesIn(part(d, 'lead'), b.start, b.end).length, 0);
  assert.ok(notesIn(part(d, 'answer'), b.start, b.end).length >= 8);
  d = draft([{ move: 'displace', section: 'b', by: 0.75 }]);
  assert.equal(notesIn(part(d, 'lead'), b.start, b.end).length, notesIn(part(base, 'lead'), b.start, b.end).length);
  assert.ok(notesIn(part(d, 'lead'), b.start, b.end).some(n => n[0] === b.start + 0.75));
  d = draft([{ move: 'callAnswer', section: 'b', answer: 'answer' }]);
  assert.ok(notesIn(part(d, 'lead'), b.start, b.end).every(n => (n[0] - b.start) % 8 < 4));
  assert.ok(notesIn(part(d, 'answer'), b.start, b.end).every(n => (n[0] - b.start) % 8 >= 4));
  d = draft([{ move: 'riffReturn', section: 'b', heat: 0.9 }]);
  const lead = finalize(d).parts.find(p => p.id === 'lead')!, macro = lead.macro as [number, number][];
  assert.ok(macro[macro.length - 1]![1] > macro[0]![1]);
  d = draft([{ move: 'stagger', section: 'a' }]);
  assert.ok(notesIn(part(d, 'kick'), 0, 16)[0]![0] > notesIn(part(d, 'pad'), 0, 16)[0]![0]);
});

test('composer kit: the critique flags a track where nothing changes, and mistakes are named', () => {
  const flat = critique(assemble(spec({ sections: plainSections.map(s => ({ ...s, heat: 0.3 })) })));
  assert.ok(flat.warnings.some(w => w.includes('What changes?')));
  assert.ok(flat.warnings.some(w => w.includes('no moves')));
  assert.throws(() => buildScore(spec({ groove: 'four-on-the-floor' })), /unknown groove/);
  assert.throws(() => buildScore(spec({ voices: { bass: { patch: 'supersaw' } }, hook: 'bass' })), /unknown patch/);
  assert.throws(() => buildScore(spec({ sections: plainSections, moves: [{ move: 'riser', section: 'b' }] })), /unknown move/);
  assert.throws(() => buildScore(spec({ sections: [{ id: 'a', bars: 4, play: ['bass', 'vocals'] }] })), /not a voice/);
});
