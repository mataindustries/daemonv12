import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

test('two independent demonstration builds reproduce the checked map, sound and unaligned PCM edit', t => {
  const dir = mkdtempSync(join(tmpdir(), 'daemon-sync-reproduce-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const a = join(dir, 'a'), b = join(dir, 'b');
  for (const destination of [a, b]) {
    const result = spawnSync(process.execPath, ['scripts/verify-morph-sync.ts', destination], { encoding: 'utf8', env: { PATH: process.env.PATH } });
    assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stdout + result.stderr);
  }
  for (const file of ['verification.json', 'morph-sync-demo.events.json', 'morph-sync-demo.clip.events.json', 'morph-sync-demo.clip.wav', 'render/morph-sync-demo.wav'])
    assert.deepEqual(readFileSync(join(a, file)), readFileSync(join(b, file)), file);
  assert.deepEqual(readFileSync(join(a, 'morph-sync-demo.events.json')), readFileSync('examples/morph-sync-demo.events.json'));
  assert.deepEqual(readFileSync(join(a, 'render/morph-sync-demo.wav')), readFileSync('examples/morph-sync-demo.wav'));
  assert.deepEqual(readFileSync(join(a, 'verification.json')), readFileSync('examples/morph-sync-demo.verification.json'));
  const report = JSON.parse(readFileSync(join(a, 'verification.json'), 'utf8'));
  assert.equal(report.composition.frames, 352800); assert.equal(report.composition.events, 46);
  assert.equal(report.composition.sha256, '4687a4b239196a49075083edc2fae5e043519e43db3ca21d4bf53855a0b50275');
  assert.equal(report.composition.clippedSamples, 0);
  assert.equal(report.clip.frames, 176416); assert.equal(report.clip.events, 20);
  const wav = readFileSync(join(a, 'render/morph-sync-demo.wav'));
  const clip = readFileSync(join(a, 'morph-sync-demo.clip.wav'));
  assert.deepEqual(clip.subarray(44), wav.subarray(44 + 44101 * 4, 44 + 220517 * 4));
  assert.equal(report.clip.sha256, createHash('sha256').update(clip).digest('hex'));
});
