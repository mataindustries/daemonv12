import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generatePack, sounds, sourceReferences } from '../scripts/generate-morph-pack.ts';
import { compileProjectFile, runCommand } from '../src/pipeline.ts';
import { decodePcm } from '../src/render/index.ts';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const golden: Record<string, string> = {
  'cable-pluck': '899a5345fa40df54fbadd1e4ee31bf1d9c876d53cbb16501ac7bbd3ea450e48d',
  'cable-slap': 'a93582eb06f9b69cceb890d2bf25b0ba3046b0200b6d022d36339e19e97adc27',
  'beast-wom': '0b077a31fa9f66370cb23f1bc7401f3e7a1a75ea77e1643a01afa598eff03232',
  'ratchet-open': '7e1696400651d04307e86bbc3b5e4f122985e5ac906ec142d6fc2bf57b2324c6',
  'ratchet-tight': 'd3efb3c62c14a59d398f812d03986685c2169d89dc307d0ba1398f29d8f87ff4',
};
interface Catalog { version: string; generatorSourceSha256: string; sources: typeof sourceReferences; sounds: { id: string; file: string; sha256: string; frames: number; bytes: number; peakDbfs: number }[] }

test('MORPH v1: regenerate the frozen pack and catalog without historical sources or audio tools', t => {
  const root = mkdtempSync(join(tmpdir(), 'daemon-morph-pack-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  generatePack(root);
  assert.deepEqual(readFileSync(join(root, 'morph-v1.catalog.json')), readFileSync('examples/morph-v1.catalog.json'));
  assert.deepEqual(readFileSync(join(root, 'assets/morph-v1/kit.json')), readFileSync('examples/assets/morph-v1/kit.json'));
  const catalog: Catalog = JSON.parse(readFileSync('examples/morph-v1.catalog.json', 'utf8'));
  assert.equal(catalog.version, '1.0.0');
  assert.equal(catalog.generatorSourceSha256, hash(readFileSync('scripts/generate-morph-pack.ts')));
  assert.deepEqual(catalog.sources, sourceReferences);
  assert.equal(catalog.sounds.length, 5);
  for (const sound of catalog.sounds) {
    const bytes = readFileSync(join(root, sound.file));
    assert.deepEqual(bytes, readFileSync(join('examples', sound.file)), sound.id);
    assert.equal(hash(bytes), golden[sound.id], sound.id);
    assert.equal(sound.sha256, golden[sound.id]); assert.equal(sound.bytes, bytes.length);
    const decoded = decodePcm(bytes); assert.equal(decoded.error, undefined);
    const pcm = decoded.pcm!; assert.equal(pcm.channels, 1); assert.equal(pcm.frames, sound.frames);
    assert.equal(pcm.samples[0], 0); assert.equal(pcm.samples.at(-1), 0);
    let peak = 0, energy = 0;
    for (const x of pcm.samples) { peak = Math.max(peak, Math.abs(x)); energy += x * x; }
    assert.ok(Math.abs(20 * Math.log10(peak / 32768) - sound.peakDbfs) < 0.01, `${sound.id} has its recorded headroom`);
    assert.ok(10 * Math.log10(energy / pcm.samples.length / 32768 ** 2) > -40, `${sound.id} is audible`);
  }
});

test('MORPH demo: existing sampler and drum kit perform all five sounds, deterministically and without audio tools', async t => {
  const root = mkdtempSync(join(tmpdir(), 'daemon-morph-demo-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const compilation = compileProjectFile('examples/morph-sync-demo.json');
  assert.deepEqual(compilation.diagnostics, []); assert.ok(compilation.timeline);
  assert.equal(compilation.timeline.tracks.reduce((n, track) => n + track.notes.length, 0), 46);
  assert.deepEqual(new Set(compilation.timeline.tracks.map(track => track.instrument.type)), new Set(['drumkit', 'sampler']));
  const notes = compilation.timeline.tracks.flatMap(track => track.notes);
  assert.ok(notes.some(note => note.playback?.glide));
  assert.ok(notes.some(note => note.articulation?.gateTicks));
  assert.ok(new Set(notes.map(note => note.velocity)).size >= 4);
  const first = await runCommand('render', 'examples/morph-sync-demo.json', { outDir: join(root, 'first'), env: {} });
  const second = await runCommand('render', 'examples/morph-sync-demo.json', { outDir: join(root, 'second'), env: {} });
  assert.equal(first.exitCode, 0, JSON.stringify(first.diagnostics)); assert.equal(second.exitCode, 0, JSON.stringify(second.diagnostics));
  const bytes = readFileSync(first.result.artifacts.wav!);
  assert.deepEqual(bytes, readFileSync(second.result.artifacts.wav!));
  assert.equal(hash(bytes), '4687a4b239196a49075083edc2fae5e043519e43db3ca21d4bf53855a0b50275');
  const manifest = first.result.manifest as { mix: { clippedSamples: number }; soundfont: null; samples: { tracks: { triggers: { file: string }[]; clippedSamples: number }[] } };
  assert.equal(manifest.soundfont, null); assert.equal(manifest.mix.clippedSamples, 0);
  assert.ok(manifest.samples.tracks.every(track => track.clippedSamples === 0));
  const used = new Set(manifest.samples.tracks.flatMap(track => track.triggers.map(trigger => trigger.file)));
  assert.deepEqual(used, new Set(sounds.map(sound => `assets/morph-v1/${sound.id}.wav`)));
  const pcm = decodePcm(bytes).pcm!; assert.equal(pcm.frames, 352800); assert.equal(pcm.channels, 2);
  let energy = 0; for (const x of pcm.samples) energy += x * x;
  assert.ok(10 * Math.log10(energy / pcm.samples.length / 32768 ** 2) > -35);
});
