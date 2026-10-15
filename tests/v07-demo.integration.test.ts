import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileProjectFile } from '../src/pipeline.ts';
import { createAudioProcessor } from '../src/render/index.ts';
import { ONE_SOUND_SOURCE, ONE_SOUND_SOURCE_SHA256, verifyV07 } from '../scripts/verify-v07.ts';

const before = JSON.parse(readFileSync('examples/one-sound-before.json', 'utf8'));
const after = JSON.parse(readFileSync('examples/one-sound-after.json', 'utf8'));
const processor = await createAudioProcessor({ env: process.env });

test('ONE SOUND comparison uses one unchanged original and changes only articulation', () => {
  assert.deepEqual(compileProjectFile('examples/one-sound-before.json').diagnostics, []);
  assert.deepEqual(compileProjectFile('examples/one-sound-after.json').diagnostics, []);
  for (const project of [before, after]) {
    assert.deepEqual(new Set(project.tracks.map((track: any) => track.instrument.sample)), new Set([ONE_SOUND_SOURCE]));
    assert.ok(project.tracks.every((track: any) => track.instrument.type === 'sampler' && !track.effects && !track.mix));
    assert.equal(project.master, undefined);
  }
  assert.equal(createHash('sha256').update(readFileSync(join('examples', ONE_SOUND_SOURCE))).digest('hex'), ONE_SOUND_SOURCE_SHA256);
  const unchanged = structuredClone(after);
  unchanged.title = before.title; unchanged.description = before.description;
  for (const track of unchanged.tracks) for (const pattern of track.patterns) for (const note of pattern.notes) {
    for (const field of ['endSeconds', 'gate', 'envelope', 'chokeGroup']) delete note[field];
  }
  assert.deepEqual(unchanged, before, 'matching onset, rate, glide, offset and velocity make the comparison attributable');
  const bass = after.tracks.find((track: any) => track.id === 'low-end').patterns[0].notes;
  assert.ok(bass.some((note: any) => note.glide && note.gate === '1/8'), 'a glide crosses a musical gate');
  assert.deepEqual(after.tracks[0], before.tracks[0], 'the source is exposed identically before the groove');
});

test('ONE SOUND renders two fresh exact-duration masters/stems per version with tighter percussion and controlled bass tails',
  { skip: processor.diagnostic?.message ?? false }, async t => {
    const outDir = mkdtempSync(join(tmpdir(), 'daemon-one-sound-'));
    t.after(() => rmSync(outDir, { recursive: true, force: true }));
    const report = await verifyV07(outDir);
    assert.equal(report.versions.before.frames, 352800); assert.equal(report.versions.after.frames, 352800);
    assert.equal(report.originalStemUnchanged, true);
    assert.ok(report.tailRegions.every(region => region.beforeRmsPcm > 10 && region.afterRmsPcm === 0));
  });
