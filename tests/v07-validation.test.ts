import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProject } from '../src/project/validate.ts';

const project = (note: Record<string, unknown>, gm = false) => ({
  formatVersion: 1, title: 'Articulation validation', bpm: 120, timeSignature: '4/4', bars: 1,
  tracks: [{ id: 'one', instrument: gm ? { type: 'gm', program: 'acoustic_grand_piano' } : { type: 'sampler', sample: 'assets/one.wav' },
    clips: [{ bar: 1, pattern: 'p' }], patterns: [{ id: 'p', bars: 1, notes: [{ start: '1:1', ...note }] }] }],
});

test('V0.7 validation: nonfinite values, closed objects, grid, precision, identifiers and aliases give repair diagnostics', () => {
  const cases: [Record<string, unknown>, string, string][] = [
    [{ endSeconds: NaN }, 'WRONG_TYPE', 'endSeconds'], [{ endSeconds: Infinity }, 'WRONG_TYPE', 'endSeconds'],
    [{ endSeconds: null }, 'WRONG_TYPE', 'endSeconds'], [{ endSeconds: 0.0000001 }, 'INVALID_DURATION', 'endSeconds'],
    [{ gate: '1/7' }, 'OFF_GRID', 'gate'], [{ gate: '0/1' }, 'INVALID_DURATION', 'gate'],
    [{ envelope: null }, 'WRONG_TYPE', 'envelope'], [{ envelope: { attackSeconds: NaN } }, 'WRONG_TYPE', 'envelope.attackSeconds'],
    [{ envelope: { releaseSeconds: -Infinity } }, 'WRONG_TYPE', 'envelope.releaseSeconds'],
    [{ envelope: { attackSeconds: 0.000001 } }, 'OUT_OF_RANGE', 'envelope.attackSeconds'],
    [{ envelope: { releaseSeconds: 10.000001 } }, 'OUT_OF_RANGE', 'envelope.releaseSeconds'],
    [{ envelope: { sustain: 0.5 } }, 'UNKNOWN_FIELD', 'envelope.sustain'], [{ chokeGroup: 'Hi Hats' }, 'INVALID_ID', 'chokeGroup'],
  ];
  for (const [note, code, suffix] of cases) {
    const result = validateProject(project(note));
    assert.equal(result.project, null);
    assert.ok(result.diagnostics.some(d => d.code === code && d.path.endsWith(suffix)), JSON.stringify(result.diagnostics));
  }
  for (const [note, hint] of [[{ endOffset: 0.1 }, 'endSeconds'], [{ noteGate: '1/8' }, 'gate'],
    [{ attack: 0.1 }, 'envelope'], [{ envelope: { releaseMs: 5 } }, 'dividing milliseconds by 1000']] as const) {
    assert.ok(validateProject(project(note)).diagnostics.some(d => d.hint?.includes(hint)));
  }
});

test('V0.7 validation: all four controls are sample-only and independent errors collect without accepting a GM articulation', () => {
  const result = validateProject(project({ pitch: 'C4', duration: '1/4', endSeconds: 0.1, gate: '1/8', envelope: {}, chokeGroup: 'hats' }, true));
  assert.equal(result.project, null);
  assert.deepEqual(result.diagnostics.map(d => [d.code, d.path.split('.').at(-1)]),
    ['endSeconds', 'gate', 'envelope', 'chokeGroup'].map(field => ['UNKNOWN_FIELD', field]));
  assert.ok(result.diagnostics.every(d => d.hint?.includes('sampler and drum-kit')));
  const invalid = validateProject(project({ endSeconds: -1, gate: '1/7', envelope: { attackSeconds: -1, releaseSeconds: 11 }, chokeGroup: 'Bad' }));
  assert.equal(invalid.diagnostics.length, 5);
});

test('V0.7 validation: explicit performance defaults stay unarticulated; empty envelopes and gates normalize separately', () => {
  const plain = validateProject(project({ playbackRate: 1, offsetSeconds: 0 })).project!.tracks[0]!.patterns[0]!.notes[0]!;
  assert.equal(Object.hasOwn(plain, 'playback'), false); assert.equal(Object.hasOwn(plain, 'articulation'), false);
  const articulated = validateProject(project({ envelope: {}, gate: '4/1' })).project!.tracks[0]!.patterns[0]!.notes[0]!;
  assert.deepEqual(articulated.articulation, { attackSeconds: 0.001, releaseSeconds: 0.005, gateTicks: 15360 });
  assert.equal(Object.hasOwn(articulated, 'playback'), false);
});
