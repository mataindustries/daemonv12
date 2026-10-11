import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCommand } from '../src/pipeline.ts';
import { automatedGainPan, createAudioProcessor, decodePcm, fitFloat, quantize, sumFloat, type Pcm } from '../src/render/index.ts';
import { frequency, tone, wav } from './helpers/tones.ts';
const processor = await createAudioProcessor({ env: process.env }), skip = processor.diagnostic?.message ?? false;

test('V0.6 production: performed voices feed stems, static mix, gain automation, effects, exact duration, tail policy, analysis and MP3 through the one render path', { skip }, async t => {
  const root = mkdtempSync(join(tmpdir(), 'daemon-v06-production-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'assets'));
  const source: Pcm = { frames: 44100, channels: 1, samples: tone(441, 44100) };
  writeFileSync(join(root, 'assets/tone.wav'), wav(source.samples));
  const effects = [{ type: 'highpass', frequencyHz: 200 }, { type: 'reverb', roomSize: 0.4, decaySeconds: 0.6, wet: 0.2 }, { type: 'saturation', driveDb: 3, mix: 0.3 }] as const;
  const sampler = (id: string, notes: unknown[], extra: Record<string, unknown> = {}, bar = 1) =>
    ({ id, instrument: { type: 'sampler', sample: 'assets/tone.wav' }, ...extra, clips: [{ bar, pattern: 'p' }], patterns: [{ id: 'p', bars: 1, notes }] });
  const project = { formatVersion: 1, title: 'V0.6 production', bpm: 120, timeSignature: '4/4', bars: 2, render: { duration: { seconds: 3 }, tail: 'none' }, tracks: [
    sampler('auto', [{ start: '1:1', velocity: 1, playbackRate: 0.5 }], { mix: { pan: -0.3 }, automation: { gainDb: [{ at: { seconds: 0 }, value: 0, transition: 'linear' }, { at: { seconds: 1 }, value: -12 }] } }),
    sampler('fx', [{ start: '1:1', velocity: 0.8, playbackRate: 1.5, offsetSeconds: 0.1 }, { start: '1:3', velocity: 0.8, glide: { to: 0.25, duration: '1/2' } }], { mix: { gainDb: -3 }, effects }),
    sampler('long', [{ start: '1:1', velocity: 0.6, playbackRate: 0.25 }], {}, 2),
  ] };
  const path = join(root, 'cue.json'), outDir = join(root, 'out'), options = { outDir, stems: true, format: 'wav,mp3' as const, env: process.env };
  writeFileSync(path, JSON.stringify(project));
  const first = await runCommand('render', path, options);
  assert.equal(first.exitCode, 0, JSON.stringify(first.result.errors));
  const artifacts = first.result.artifacts, manifest = first.result.manifest as any, frames = 132300;
  const master = decodePcm(readFileSync(artifacts.wav!)).pcm!, stems = Object.fromEntries(artifacts.stems!.map(s => [s.trackId, readFileSync(s.wav)]));
  assert.equal(master.frames, frames);
  for (const bytes of Object.values(stems)) assert.equal(decodePcm(bytes).pcm!.frames, frames, 'stems align with the exact master length');

  // Recompute two stems from the public render functions: the performed voice is ordinary track input.
  const auto = quantize(automatedGainPan(sumFloat([{ frame: 0, velocity: 1, pcm: source, playback: { rate: 0.5, offset: 0 } }], frames, frames), 0, -0.3,
    { gainDb: [{ frame: 0, value: 0, transition: 'linear' }, { frame: 44100, value: -12, transition: 'step' }] }));
  assert.deepEqual(stems.auto, auto.bytes, 'rate + gain automation + pan');
  const fxSum = sumFloat([{ frame: 0, velocity: 0.8, pcm: source, playback: { rate: 1.5, offset: 4410 } },
    { frame: 44100, velocity: 0.8, pcm: source, playback: { rate: 1, offset: 0, glide: { to: 0.25, frames: 44100 } } }], frames, frames);
  const processed = await processor.value!.effects(automatedGainPan(fxSum, -3, 0), [...effects], frames);
  assert.ok(processed.value);
  assert.deepEqual(stems.fx, quantize(processed.value!.length / 2 > frames ? fitFloat(processed.value!, frames) : processed.value!).bytes, 'rate + offset + glide + effects');
  // Without master processing the stems sum to the master.
  const parts = Object.values(stems).map(bytes => decodePcm(bytes).pcm!.samples);
  for (let i = 0; i < master.samples.length; i++) assert.equal(master.samples[i], Math.max(-32768, Math.min(32767, parts.reduce((n, s) => n + s[i]!, 0))));
  // The quarter-speed voice is still sounding at the hard boundary: no implicit fade.
  const long = decodePcm(stems.long!).pcm!;
  assert.ok(long.samples.slice(0, 88200 * 2).every(v => v === 0));
  assert.ok(Math.abs(frequency(long.samples, 88300, frames - 100, 2) - 110.25) < 0.05);
  assert.ok(long.samples.slice(-200).some(v => Math.abs(v) > 1000));
  const longTrigger = manifest.samples.tracks[2].triggers[0];
  assert.deepEqual(longTrigger.playback, { rate: 0.25, voiceFrames: 176400 });
  assert.equal(manifest.samples.tracks[1].triggers[1].playback.glide.frames, 44100);
  assert.equal(manifest.timeline.resultingFrames, frames);
  assert.equal(manifest.analysis.master.clipping, false); assert.equal(manifest.analysis.tracks.length, 3);
  assert.equal(typeof manifest.analysis.master.integratedLufs, 'number');
  const mp3 = readFileSync(artifacts.mp3!);
  assert.ok(mp3.length > 1000 && (mp3.toString('ascii', 0, 3) === 'ID3' || mp3[0] === 255)); assert.equal(manifest.mp3.codec, 'libmp3lame');

  const before = [artifacts.wav!, artifacts.manifest!, artifacts.analysis!, ...artifacts.stems!.map(s => s.wav)].map(file => [file, readFileSync(file)] as const);
  assert.equal((await runCommand('render', path, options)).exitCode, 0);
  for (const [file, bytes] of before) assert.deepEqual(readFileSync(file), bytes, file);

  // Natural tails: without a fixed duration, a slowed voice extends the production timeline it belongs to.
  writeFileSync(path, JSON.stringify({ ...project, render: { tail: 'auto' } }));
  const natural = await runCommand('render', path, { outDir, stems: true, env: process.env });
  assert.equal(natural.exitCode, 0, JSON.stringify(natural.result.errors));
  assert.equal(decodePcm(readFileSync(natural.result.artifacts.wav!)).pcm!.frames, 88200 + 176400, 'the slowed voice outlasts the reverb tail of the other track');
});
