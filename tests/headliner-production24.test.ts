import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { files, sha256, verifyPackage } from '../production/headliner/build.ts';
import { packageProduction24, packageStarterProduction24, replayProduction24 } from '../scripts/headliner-production24.ts';
import { createAudioProcessor, encodePcm } from '../src/render/index.ts';
import { diagnostic } from '../src/diagnostics.ts';

test('existing project delivery preserves sources, inventories sidechain and derives repeatable MP3 directly from final PCM24', async t => {
  const root = mkdtempSync(join(tmpdir(), 'delivery24-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'assets'));
  const source = encodePcm(Int16Array.from({ length: 8820 * 2 }, (_, i) => Math.round(3000 * Math.sin(Math.floor(i / 2) / 8))));
  writeFileSync(join(root, 'assets/tone.wav'), source); writeFileSync(join(root, 'assets/sidechain.wav'), source);
  const project = JSON.stringify({ formatVersion: 1, title: 'Adapter precision test', bpm: 120, timeSignature: '4/4', bars: 1,
    render: { duration: { seconds: 0.2 }, tail: 'none' },
    master: { gainDb: -3, ducking: { source: 'assets/sidechain.wav', thresholdDb: -30, amountDb: 4, attackMs: 10, releaseMs: 80 } },
    tracks: [{ id: 'voice', instrument: { type: 'sampler', sample: 'assets/tone.wav' }, mix: { gainDb: -6.123 },
      clips: [{ bar: 1, pattern: 'one' }], patterns: [{ id: 'one', bars: 1, notes: [{ start: '1:1', velocity: 0.173 }] }] }] });
  const path = join(root, 'proof.json'); writeFileSync(path, project);
  const rights = join(root, 'RIGHTS.md'); writeFileSync(rights, 'Generated sources: pending owner declaration.\n');
  const real = await createAudioProcessor({ env: process.env }); assert.ok(real.value, JSON.stringify(real.diagnostic));
  const inputs: string[] = [];
  const processor = { ...real.value, async mp3(input: string, output: string) {
    inputs.push(sha256(readFileSync(input))); assert.ok(input.endsWith('/masters/proof.24.wav'));
    return real.value!.mp3(input, output);
  } };
  const options = { processor, licenseFiles: [rights], provenance: { reference: 'locked-test' } };
  const a = await packageProduction24(path, join(root, 'a'), options);
  const b = await replayProduction24(a.directory, join(root, 'b'), { processor });
  assert.deepEqual(inputs, [a.manifest.master.sha256, a.manifest.master.sha256]);
  assert.deepEqual(files(a.directory), files(b.directory));
  for (const file of files(a.directory)) assert.deepEqual(readFileSync(join(a.directory, file)), readFileSync(join(b.directory, file)), file);
  assert.equal(verifyPackage(a.directory), a.members);
  assert.equal(readFileSync(join(a.directory, 'source/proof.json'), 'utf8'), project);
  assert.deepEqual(readFileSync(join(a.directory, 'source/assets/tone.wav')), source);
  assert.deepEqual(readFileSync(join(a.directory, 'source/assets/sidechain.wav')), source);
  assert.equal(readFileSync(path, 'utf8'), project); assert.deepEqual(readFileSync(join(root, 'assets/tone.wav')), source);
  const inventory = JSON.parse(readFileSync(join(a.directory, 'metadata/inventory.json'), 'utf8'));
  assert.ok(inventory.sources.some((s: { file: string; bitsPerSample: number }) => s.file.endsWith('/sidechain.wav') && s.bitsPerSample === 16));
  assert.equal(a.manifest.master.analysis.bitsPerSample, 24); assert.ok(a.manifest.master.analysis.nonzeroLowBytes > 0);
  assert.equal(a.manifest.master.frames, 8820); assert.equal(a.manifest.stems[0]!.analysis.frames, 8820);
  assert.equal(a.manifest.sidechain!.file, 'source/assets/sidechain.wav');
  assert.equal(a.mastering.authoredTracks[0]!.mix.gainDb, -6.123);
  assert.equal(a.mastering.listening.derivedFrom.sha256, a.manifest.master.sha256);
  assert.match(a.mastering.sourcePrecision, /No lost source detail is recovered/);
  assert.ok(a.mastering.releaseBlockers.some(s => s.includes('rights')));
  await assert.rejects(packageProduction24(path, a.directory, options), /new output/);
  const broken = { ...processor, async mp3() { return { diagnostic: diagnostic('AUDIO_PROCESSING_FAILED', '', 'test', 'working encoder') }; } };
  await assert.rejects(packageProduction24(path, join(root, 'failed'), { processor: broken }), /MP3 listening copy/);
  assert.equal(existsSync(join(root, 'failed')), false);
  assert.ok(!readdirSync(root).some(f => f.startsWith('.headliner-production24-')));
});

test('HEADLINER foundation has an explicit independent PCM24 package route', async t => {
  const root = mkdtempSync(join(tmpdir(), 'starter24-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const result = await packageStarterProduction24('production/headliner/example.score.json', join(root, 'delivery'));
  assert.equal(result.manifest.master.frames, 396900); assert.equal(result.manifest.stems.length, 3);
  assert.equal(result.manifest.master.clippedSamples, 0); assert.ok(result.manifest.stems.every(s => s.clippedSamples === 0));
  assert.ok(existsSync(join(result.directory, 'source/score.json')));
  assert.ok(existsSync(join(result.directory, 'source/source/build.ts')));
  assert.equal(verifyPackage(result.directory), result.members);
});
