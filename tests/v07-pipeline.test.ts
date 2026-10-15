import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileProjectFile, runCommand } from '../src/pipeline.ts';
import { createAudioProcessor, decodePcm } from '../src/render/index.ts';
import { ticksToFrames } from '../src/timing/musical-time.ts';
import { wav } from './helpers/tones.ts';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const processor = await createAudioProcessor({ env: process.env }), skip = processor.diagnostic?.message ?? false;
function workspace(t: TestContext, sources: Record<string, Buffer>) {
  const root = mkdtempSync(join(tmpdir(), 'daemon-v07-pipeline-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'assets'));
  for (const [name, bytes] of Object.entries(sources)) writeFileSync(join(root, 'assets', name), bytes);
  const path = join(root, 'cue.json');
  const save = (project: unknown) => writeFileSync(path, JSON.stringify(project));
  return { root, path, save };
}
const track = (id: string, sample: string, notes: unknown[], extra: Record<string, unknown> = {}) => ({
  id, instrument: { type: 'sampler', sample }, clips: [{ bar: 1, pattern: 'p' }], patterns: [{ id: 'p', bars: 1, notes }], ...extra,
});
const project = (tracks: unknown[], extra: Record<string, unknown> = {}) => ({
  formatVersion: 1, title: 'V0.7 articulation', bpm: 96, timeSignature: '4/4', bars: 1, tracks, ...extra,
});
const errors = (path: string) => compileProjectFile(path).diagnostics.filter(d => d.severity === 'error');

test('V0.7 assets: exclusive endpoints resolve against the actual mono/stereo kit source, including unused patterns', t => {
  const w = workspace(t, {
    'mono.wav': wav(new Int16Array([1000, 2000])),
    'stereo.wav': wav(new Int16Array([1000, -1000, 2000, -2000, 3000, -3000, 4000, -4000, 5000, -5000]), 2),
  });
  writeFileSync(join(w.root, 'assets', 'kit.json'), JSON.stringify({ formatVersion: 1, samples: [
    { name: 'short', pitch: 36, file: 'mono.wav' }, { name: 'long', pitch: 38, file: 'stereo.wav' },
  ] }));
  const kit = { id: 'kit', instrument: { type: 'drumkit', kit: 'assets/kit.json' }, clips: [{ bar: 1, pattern: 'p' }], patterns: [
    { id: 'p', bars: 1, notes: [{ start: '1:1', pitch: 'short', endSeconds: 0.000023, gate: '1/3840' },
      { start: '1:2', pitch: 'long', endSeconds: 0.000113 }] },
    { id: 'unused', bars: 1, notes: [{ start: '1:1', pitch: 'short', endSeconds: 0.000045 }] },
  ] };
  w.save(project([kit]));
  assert.deepEqual(errors(w.path), [], 'one-frame slice, full two-frame mono and full five-frame stereo endpoints are legal');
  assert.ok(compileProjectFile(w.path).diagnostics.some(d => d.code === 'PATTERN_UNUSED'));

  const malformed = structuredClone(kit);
  malformed.patterns[0]!.notes[0]!.endSeconds = 0.000113; // five source frames exceeds the mapped two-frame WAV
  malformed.patterns[1]!.notes[0]!.endSeconds = 0.000068; // unused notes are checked too
  w.save(project([malformed, track('empty-slice', 'assets/stereo.wav', [
    { start: '1:1', offsetSeconds: 0.000023, endSeconds: 0.000024 }, // both round to source frame 1
  ])]));
  const ds = errors(w.path);
  assert.equal(compileProjectFile(w.path).timeline, null);
  assert.deepEqual(ds.map(d => d.path), [
    'tracks[0].patterns[0].notes[0].endSeconds', 'tracks[0].patterns[1].notes[0].endSeconds',
    'tracks[1].patterns[0].notes[0].endSeconds',
  ]);
  for (const d of ds) {
    assert.equal(d.code, 'OUT_OF_RANGE');
    assert.ok(d.expected?.includes('frame'), 'repair information names the resolved source-frame bound');
    assert.ok(d.hint, 'asset-dependent errors give a useful repair');
  }
});

test('V0.7 PCM route: articulation changes only opted-in voices and records source identities without derivative files', async t => {
  const source = wav(new Int16Array(1000).fill(6000));
  const w = workspace(t, { 'one.wav': source });
  w.save(project([track('one', 'assets/one.wav', [
    { start: '1:1', velocity: 1, endSeconds: 0.01, envelope: { attackSeconds: 0.001, releaseSeconds: 0.002 } },
    { start: '1:2', velocity: 1 },
  ])]));
  const result = await runCommand('render', w.path, { outDir: join(w.root, 'out'), stems: true });
  assert.equal(result.exitCode, 0, JSON.stringify(result.result.errors));
  const manifest = result.result.manifest as any, pcm = decodePcm(readFileSync(result.result.artifacts.wav!)).pcm!;
  assert.equal(pcm.samples[0], 0, 'opted-in attack starts at zero');
  assert.equal(pcm.samples[440 * 2], 0, 'source endpoint release ends at zero');
  assert.ok(pcm.samples.slice(441 * 2, 27563 * 2).every(v => v === 0));
  assert.equal(pcm.samples[27563 * 2], 6000, 'historical one-shot has no implicit attack');
  assert.equal(manifest.samples.assets.length, 1);
  assert.equal(manifest.samples.assets[0].sha256, hash(source));
  assert.ok(manifest.samples.articulation);
  assert.equal(manifest.samples.tracks[0].triggers[0].articulation.voiceFrames, 441);
  assert.equal('articulation' in manifest.samples.tracks[0].triggers[1], false);
  assert.deepEqual(readdirSync(join(w.root, 'assets')), ['one.wav']);
});

test('V0.7 production: absolute musical gates, gliding sliced voices, track-local chokes, exact duration and two fresh master/stem hashes', { skip }, async t => {
  const mono = wav(new Int16Array(44100).fill(3000));
  const stereo = wav(Int16Array.from({ length: 44100 * 2 }, (_, i) => i % 2 ? -4500 : 1500), 2);
  const w = workspace(t, { 'mono.wav': mono, 'stereo.wav': stereo });
  w.save(project([
    track('percussion', 'assets/mono.wav', [
      { start: '1:1', velocity: 1, playbackRate: 0.5, offsetSeconds: 0.01, endSeconds: 0.4, gate: '1/2', chokeGroup: 'shared', envelope: { attackSeconds: 0.002, releaseSeconds: 0.01 } },
      { start: '1:1+1/8', velocity: 1, playbackRate: 1.5, glide: { to: 0.5, duration: '1/2' }, gate: '1/4', chokeGroup: 'shared', envelope: { attackSeconds: 0.001, releaseSeconds: 0.002 } },
      { start: '1:1+1/8', velocity: 1, endSeconds: 0.4, chokeGroup: 'shared' },
      { start: '1:2', velocity: 1, gate: '1/8', chokeGroup: 'shared' },
    ]),
    track('stereo', 'assets/stereo.wav', [
      { start: '1:1', velocity: 1, gate: '1/4', chokeGroup: 'shared', envelope: { attackSeconds: 0.002, releaseSeconds: 0.01 } },
    ]),
    track('boundary', 'assets/mono.wav', [
      { start: '1:2', velocity: 1, playbackRate: 0.25, glide: { to: 4, duration: '1/1' }, gate: '1/4', envelope: { attackSeconds: 0.001, releaseSeconds: 0.005 } },
    ]),
  ], { render: { duration: { seconds: 1.25 }, tail: 'none' } }));
  const renders = [];
  for (const suffix of ['fresh-a', 'fresh-b']) {
    const r = await runCommand('render', w.path, { outDir: join(w.root, suffix), stems: true, env: process.env });
    assert.equal(r.exitCode, 0, JSON.stringify(r.result.errors)); renders.push(r.result);
  }
  const a = renders[0]!, b = renders[1]!, manifest = a.manifest as any;
  const master = decodePcm(readFileSync(a.artifacts.wav!)).pcm!, frames = 55125;
  assert.equal(master.frames, frames);
  assert.equal(hash(readFileSync(a.artifacts.wav!)), hash(readFileSync(b.artifacts.wav!)));
  const stems = a.artifacts.stems!.map((stem, i) => {
    const bytes = readFileSync(stem.wav), decoded = decodePcm(bytes).pcm!;
    assert.equal(decoded.frames, frames, stem.trackId);
    assert.equal(hash(bytes), hash(readFileSync(b.artifacts.stems![i]!.wav)), stem.trackId);
    assert.equal(manifest.stems[i].wav.sha256, hash(bytes));
    return decoded;
  });
  for (let i = 0; i < master.samples.length; i++) assert.equal(master.samples[i], stems.reduce((sum, s) => sum + s.samples[i]!, 0));
  assert.equal(manifest.mix.clippedSamples, 0);
  assert.equal(manifest.production.master.clippedSamples, 0);
  assert.equal(manifest.timeline.resultingFrames, frames);
  assert.deepEqual(manifest.samples.assets.map((a: any) => [a.file, a.sha256]), [['assets/mono.wav', hash(mono)], ['assets/stereo.wav', hash(stereo)]]);
  const triggers = manifest.samples.tracks[0].triggers;
  assert.equal(triggers[0].articulation.sourceEnd.frames, 17640);
  assert.deepEqual(triggers[0].articulation.choke, { frame: 13781, frames: 13781 });
  assert.equal(triggers[0].articulation.voiceFrames, 13781 + 441);
  assert.equal(triggers[1].frame, triggers[2].frame, 'simultaneous voices coexist');
  assert.deepEqual(triggers[1].articulation.choke, { frame: 27563, frames: 13782 });
  assert.deepEqual(triggers[2].articulation.choke, { frame: 27563, frames: 13782 });
  assert.equal('choke' in manifest.samples.tracks[1].triggers[0].articulation, false, 'same group on another track is independent');
  const boundary = manifest.samples.tracks[2].triggers[0];
  assert.equal(boundary.frame, 27563);
  assert.deepEqual(boundary.articulation.gate, { duration: '1/4', frames: 27562 }, 'gate is rounded at absolute note-off, avoiding a relative rounding drift');
  assert.equal(ticksToFrames(1920, 625000) - ticksToFrames(960, 625000), 27562);
  assert.equal(boundary.articulation.voiceFrames, 27562 + 221);
  assert.equal(boundary.articulation.renderedFrames, 27562);
  assert.deepEqual(Array.from(stems[2]!.samples.slice(-2)), [0, 0], 'release reaches zero at the exact output boundary');
  const stereoStem = stems[1]!, f = 2000;
  assert.equal(stereoStem.samples[f * 2 + 1], -3 * stereoStem.samples[f * 2]!, 'stereo channels retain independent source values through an envelope');
  assert.equal(stereoStem.samples[16000 * 2], 1500, 'another track cannot choke this voice');
  assert.deepEqual(manifest, b.manifest, 'fresh renders have identical provenance');
});

test('V0.7 failure: malformed articulation clears stale master, stems, manifest and temporary artifacts', async t => {
  const w = workspace(t, { 'mono.wav': wav(new Int16Array(1000).fill(1000)) });
  const outDir = join(w.root, 'out'); mkdirSync(join(outDir, 'cue.stems'), { recursive: true });
  for (const name of ['cue.wav', 'cue.mid', 'cue.render.json', 'cue.wav.tmp']) writeFileSync(join(outDir, name), 'stale');
  writeFileSync(join(outDir, 'cue.stems', 'one.wav'), 'stale');
  w.save(project([track('one', 'assets/mono.wav', [{ start: '1:1', offsetSeconds: 0.01, endSeconds: 0.005 }])]));
  const r = await runCommand('render', w.path, { outDir, stems: true });
  assert.equal(r.exitCode, 1); assert.equal(r.result.ok, false);
  assert.ok(r.result.errors.some(d => d.path.endsWith('.endSeconds')));
  assert.equal(r.result.manifest, null); assert.deepEqual(r.result.artifacts, {});
  assert.deepEqual(readdirSync(outDir), []);
  assert.equal(existsSync(join(outDir, 'cue.stems')), false);
  assert.deepEqual(readdirSync(join(w.root, 'assets')), ['mono.wav']);
});

test('V0.7 choke groups: later clips and different kit mappings release older voices regardless of clip enumeration', async t => {
  const w = workspace(t, { 'open.wav': wav(new Int16Array(44100).fill(2000)), 'closed.wav': wav(new Int16Array(1000).fill(3000)) });
  writeFileSync(join(w.root, 'assets', 'kit.json'), JSON.stringify({ formatVersion: 1, samples: [
    { name: 'open', pitch: 42, file: 'open.wav' }, { name: 'closed', pitch: 46, file: 'closed.wav' },
  ] }));
  const kit = { id: 'hats', instrument: { type: 'drumkit', kit: 'assets/kit.json' },
    clips: [{ bar: 2, pattern: 'close' }, { bar: 1, pattern: 'open' }], patterns: [
      { id: 'open', bars: 1, notes: [{ start: '1:1', pitch: 'open', velocity: 1, chokeGroup: 'hats', envelope: { releaseSeconds: 0.01 } }] },
      { id: 'close', bars: 1, notes: [{ start: '1:1', pitch: 'closed', velocity: 1, chokeGroup: 'hats' }] },
    ] };
  const value = project([kit], { bpm: 300, bars: 2 });
  w.save(value);
  const first = await runCommand('render', w.path, { outDir: join(w.root, 'a'), stems: true });
  assert.equal(first.exitCode, 0, JSON.stringify(first.result.errors));
  const triggers = (first.result.manifest as any).samples.tracks[0].triggers;
  assert.equal(triggers[0].file, 'assets/open.wav'); assert.equal(triggers[1].file, 'assets/closed.wav');
  assert.deepEqual(triggers[0].articulation.choke, { frame: 35280, frames: 35280 });
  assert.equal(triggers[0].articulation.voiceFrames, 35721);
  kit.clips.reverse(); w.save(value);
  const reordered = await runCommand('render', w.path, { outDir: join(w.root, 'b'), stems: true });
  assert.equal(reordered.exitCode, 0);
  assert.deepEqual(readFileSync(first.result.artifacts.wav!), readFileSync(reordered.result.artifacts.wav!));
  assert.deepEqual(triggers, (reordered.result.manifest as any).samples.tracks[0].triggers);
});
