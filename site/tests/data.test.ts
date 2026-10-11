// The figures draw repository data; keep the extracted files sane and in step with the
// documented facts.
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const site = fileURLToPath(new URL('..', import.meta.url));
const json = (path: string) => JSON.parse(readFileSync(join(site, path), 'utf8'));

test('waveform outlines are normalized envelopes of real pack files', () => {
  const waves = json('src/data/waveforms.json') as Record<string, {file: string; seconds: number; env: number[]}>;
  assert.equal(Object.keys(waves).length, 8);
  for (const [id, w] of Object.entries(waves)) {
    assert.match(w.file, /^examples\/assets\/(glasshouse|orbital-foundry)\/\d\d-[\w-]+\.wav$/, id);
    assert.equal(w.env.length, 120, id);
    assert.ok(w.env.every(v => v >= 0 && v <= 1), id);
    assert.equal(Math.max(...w.env), 1, `${id} reaches its own peak`);
    const source = join(site, '..', w.file);
    if (existsSync(source)) assert.ok(readFileSync(source).length > 44, `${w.file} exists`);
  }
});

test('GHOST//SHIFT trace matches docs/V0_6_SAMPLE_PERFORMANCE.md', () => {
  const ghost = json('src/data/ghost-shift.json');
  assert.equal(ghost.seconds, 12);
  assert.equal(ghost.bpm, 140);
  assert.equal(ghost.sourceSeconds, 0.95);
  // "14 playback rates, 21 source offsets, 3 upward and 6 downward glides"
  assert.deepEqual(ghost.counts, {rates: 14, offsets: 21, glidesUp: 3, glidesDown: 6});
  assert.deepEqual(Object.keys(ghost.voices), ['ghost-hook', 'ghost-high', 'ghost-fx', 'ghost-bass']);
  for (const voices of Object.values(ghost.voices) as {t0: number; t1: number; points: [number, number][]}[][]) {
    for (const v of voices) {
      assert.ok(v.t0 >= 0 && v.t1 <= 12 && v.t1 > v.t0);
      // playbackRate 0.25–4 is ±24 semitones.
      assert.ok(v.points.every(([, s]) => s >= -24.001 && s <= 24.001));
    }
  }
});
