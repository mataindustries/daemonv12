// V0.6 compatibility gates: renders without playback fields reproduce the bytes DaemonV12 0.5.0
// wrote before sample performance existed (tests/fixtures/v05-reference-renders.json).
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileProjectFile, runCommand, type CommandOptions } from '../src/pipeline.ts';
import { createAudioProcessor, createDefaultRenderer, resolveSoundfont } from '../src/render/index.ts';
const reference = JSON.parse(readFileSync('tests/fixtures/v05-reference-renders.json', 'utf8'));
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const processor = await createAudioProcessor({ env: process.env });
const soundfont = await resolveSoundfont({ env: process.env }), fluidsynth = soundfont.value ? await createDefaultRenderer({ soundfont: soundfont.value, env: process.env }) : null;
const ffmpeg = processor.value?.identity.version;
const sameFfmpeg = ffmpeg === reference.environment.ffmpeg ? false : `recorded with FFmpeg ${reference.environment.ffmpeg}; this machine has ${ffmpeg ?? 'none'}`;
function outDir(t: TestContext) { const dir = mkdtempSync(join(tmpdir(), 'daemon-v06-compat-')); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; }
async function matches(t: TestContext, name: string, path = `examples/${name}.json`, options: CommandOptions = {}) {
  const expected = reference.renders[name], dir = outDir(t);
  const r = await runCommand('render', path, { outDir: dir, stems: true, env: process.env, ...options });
  assert.equal(r.exitCode, 0, JSON.stringify(r.result.errors));
  assert.equal(hash(readFileSync(r.result.artifacts.wav!)), expected.wav, `${name} master`);
  assert.deepEqual(Object.fromEntries(r.result.artifacts.stems!.map(s => [s.trackId, hash(readFileSync(s.wav))])), expected.stems, `${name} stems`);
  return r.result.manifest as Record<string, any>;
}

test('Gate A: a V0.5 sample project (Node-only route) renders the exact 0.5.0 master and stem bytes', async t => {
  const manifest = await matches(t, 'sample-only-demo');
  assert.equal(manifest.samples.playback, undefined, 'no resampler provenance without performance');
  assert.ok(manifest.samples.tracks.every((track: { triggers: object[] }) => track.triggers.every(trigger => !('playback' in trigger))));
});

test('Gate B: explicit playbackRate 1, offsetSeconds 0 and no glide on every note equal the default project, bytes and triggers', async t => {
  const root = outDir(t);
  cpSync('examples/assets/pulse-kit', join(root, 'assets/pulse-kit'), { recursive: true });
  const project = JSON.parse(readFileSync('examples/sample-only-demo.json', 'utf8'));
  for (const track of project.tracks) for (const pattern of track.patterns) for (const note of pattern.notes) Object.assign(note, { playbackRate: 1, offsetSeconds: 0 });
  writeFileSync(join(root, 'sample-only-demo.json'), JSON.stringify(project));
  assert.deepEqual(compileProjectFile(join(root, 'sample-only-demo.json')).timeline, compileProjectFile('examples/sample-only-demo.json').timeline);
  const explicit = await matches(t, 'sample-only-demo', join(root, 'sample-only-demo.json'));
  const plain = (await runCommand('render', 'examples/sample-only-demo.json', { outDir: outDir(t) })).result.manifest as Record<string, any>;
  assert.deepEqual(explicit.samples.tracks, plain.samples.tracks);
});

test('Gate C: the Orbital Foundry audition renders its recorded 0.5.0 master (c1dd6439…) and twelve stems', { skip: processor.diagnostic?.message ?? false }, async t => {
  await matches(t, 'orbital-foundry-audition');
});

test('Gate D: the GLASSHOUSE audition renders its recorded 0.5.0 master (fed00829…) and ten stems', { skip: processor.diagnostic?.message ?? sameFfmpeg }, async t => {
  await matches(t, 'glasshouse-audition');
});

test('Gate E: GLASS//FIRE validates and renders its recorded 0.5.0 master (22c0d1a5…) and fifteen stems', async t => {
  assert.deepEqual(compileProjectFile('examples/glass-fire.json').diagnostics, []);
  const missing = processor.diagnostic?.message ?? soundfont.diagnostic?.message ?? fluidsynth?.diagnostic?.message;
  if (missing) { t.skip(missing); return; }
  if (sameFfmpeg) { t.skip(sameFfmpeg); return; }
  const manifest = await matches(t, 'glass-fire');
  assert.equal(manifest.soundfont.sha256, reference.environment.soundfontSha256);
  assert.equal(manifest.gmRenderer.version, reference.environment.fluidsynth);
});
