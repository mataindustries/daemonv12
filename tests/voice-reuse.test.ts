import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { compileProjectFile, runCommand } from '../src/pipeline.ts';
import { playbackBudget } from '../src/sample-render.ts';
import { VoiceSampleCache, voiceReuseKey, voiceSamples, voiceCost, decodePcm, sumFloat, createAudioProcessor,
  PLAYBACK_WORK_LIMIT, type Pcm, type PcmTrigger } from '../src/render/index.ts';
import { tone, wav } from './helpers/tones.ts';

function workspace(t: TestContext, samples = tone(110, 44100, 1200)) {
  const root = mkdtempSync(join(tmpdir(), 'daemon-reuse-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'assets')); writeFileSync(join(root, 'assets/one.wav'), wav(samples));
  const path = join(root, 'cue.json');
  return { root, path, save: (value: unknown) => writeFileSync(path, JSON.stringify(value)) };
}
const project = (notes: unknown[], extra: Record<string, unknown> = {}) => ({
  formatVersion: 1, title: 'Exact voice reuse', bpm: 120, timeSignature: '4/4', bars: 1,
  tracks: [{ id: 'one', instrument: { type: 'sampler', sample: 'assets/one.wav' },
    patterns: [{ id: 'p', bars: 1, notes }], clips: [{ bar: 1, pattern: 'p' }] }], ...extra,
});
const metric = (d: { received?: unknown } | undefined) => (d?.received as { metric?: string })?.metric;

test('reuse keys preserve interpolation bounds and final voice length while velocity/envelope remain per onset', () => {
  const pcm: Pcm = { frames: 4410, channels: 1, samples: tone(200, 4410) };
  const playback = { rate: 0.75, offset: 100, glide: { to: 1.25, frames: 1000 } };
  const a = { end: 4000, attack: 20, release: 40, stop: 700 };
  const cache = new VoiceSampleCache();
  assert.deepEqual(cache.samples(pcm, playback, Infinity, a), voiceSamples(pcm, playback, Infinity, a));
  assert.equal(cache.samples(pcm, playback, Infinity, a), cache.samples(pcm, playback, Infinity, { ...a, attack: 200 }));
  assert.notEqual(voiceReuseKey(pcm, playback, Infinity, a), voiceReuseKey(pcm, playback, 739, a));
  assert.notEqual(voiceReuseKey(pcm, playback, Infinity, a), voiceReuseKey(pcm, playback, Infinity, { ...a, end: pcm.frames }));
  assert.notEqual(voiceReuseKey(pcm, playback), voiceReuseKey(pcm, playback, Infinity, { attack: 0, release: 0, end: pcm.frames }),
    'explicit full source endpoint still silences interpolation taps before its offset');
  assert.equal(voiceReuseKey(pcm, { rate: 1, offset: 100 }), undefined);
  const triggers: PcmTrigger[] = [
    { pcm, playback, articulation: a, frame: 0, velocity: 0.6 },
    { pcm, playback, articulation: { ...a, attack: 200 }, frame: 500, velocity: 0.4 },
    { pcm, playback, articulation: a, frame: 1300, velocity: 0.2 },
  ];
  assert.deepEqual(sumFloat(triggers, 2000, 2000, cache), sumFloat(triggers, 2000, 2000));
  assert.equal(cache.provenance().uniqueVoices, 2, 'final output cap creates a genuinely different buffer');
  assert.ok(cache.provenance().reusedVoices >= 3);
  assert.equal(cache.provenance().cachedBytes, (740 + 700) * 8);
});

test('reuse cannot collide between different source PCM with identical dimensions and playback settings', () => {
  const a: Pcm = { frames: 1000, channels: 1, samples: new Int16Array(1000).fill(1000) };
  const b: Pcm = { frames: 1000, channels: 1, samples: new Int16Array(1000).fill(-2000) };
  const cache = new VoiceSampleCache(), playback = { rate: 0.8, offset: 0 };
  const first = cache.samples(a, playback), second = cache.samples(b, playback);
  assert.notEqual(first, second);
  assert.deepEqual(first, voiceSamples(a, playback)); assert.deepEqual(second, voiceSamples(b, playback));
  assert.equal(cache.provenance().uniqueVoices, 2);
});

test('opt-in budget charges unique real interpolation work and the aggregate cache; default guard stays unchanged', t => {
  const w = workspace(t, tone(110, 1000));
  const value = project(Array.from({ length: 100 }, () => ({ start: '1:1', playbackRate: 0.5 }))) as any;
  value.tracks[0].clips = Array.from({ length: 100 }, () => ({ bar: 1, pattern: 'p' }));
  w.save(value);
  assert.equal(metric(compileProjectFile(w.path).diagnostics[0]), 'interpolationTaps');
  const c = compileProjectFile(w.path, { reuseVoices: true });
  assert.ok(c.timeline, JSON.stringify(c.diagnostics));
  const cost = voiceCost(c.assets!.get('assets/one.wav')!.pcm!, { rate: 0.5, offset: 0 });
  assert.ok(cost.work * 10000 > PLAYBACK_WORK_LIMIT);
  assert.equal(playbackBudget(c, false, { work: cost.work, bytes: cost.bytes }, true), undefined);
  assert.equal(metric(playbackBudget(c, false, { work: cost.work - 1, bytes: cost.bytes }, true)), 'interpolationTaps');
  assert.equal(metric(playbackBudget(c, false, { work: cost.work, bytes: cost.bytes - 1 }, true)), 'performedVoiceBytes');
  value.tracks[0].patterns[0].notes[1].playbackRate = 0.75; w.save(value);
  const distinct = compileProjectFile(w.path, { reuseVoices: true });
  assert.equal(metric(playbackBudget(distinct, false, { work: PLAYBACK_WORK_LIMIT, bytes: cost.bytes }, true)), 'interpolationCacheBytes');
});

test('reuse PCM mode is byte-identical to historical summing and records deterministic bounded work', async t => {
  const w = workspace(t, tone(100, 4000, 1000));
  w.save(project([
    { start: '1:1', playbackRate: 0.75, velocity: 0.8, gate: '1/16', envelope: { attackSeconds: 0.002, releaseSeconds: 0.01 } },
    { start: '1:2', playbackRate: 0.75, velocity: 0.6, gate: '1/16', envelope: { attackSeconds: 0.02, releaseSeconds: 0.01 } },
    { start: '1:3', playbackRate: 0.75, velocity: 0.4, gate: '1/16', envelope: { attackSeconds: 0.002, releaseSeconds: 0.01 } },
  ]));
  const outputs = [];
  for (const [name, reuseVoices] of [['old', false], ['a', true], ['b', true]] as const) {
    const r = await runCommand('render', w.path, { outDir: join(w.root, name), stems: true, reuseVoices });
    assert.equal(r.exitCode, 0, JSON.stringify(r.result.errors)); outputs.push(r.result);
  }
  for (const r of outputs.slice(1)) {
    assert.deepEqual(readFileSync(r.artifacts.wav!), readFileSync(outputs[0]!.artifacts.wav!));
    assert.deepEqual(readFileSync(r.artifacts.stems![0]!.wav), readFileSync(outputs[0]!.artifacts.stems![0]!.wav));
  }
  assert.deepEqual(outputs[1]!.manifest, outputs[2]!.manifest);
  const provenance = (outputs[1]!.manifest as any).samples.reuse;
  assert.equal(provenance.uniqueVoices, 1); assert.equal(provenance.reusedVoices, 2);
  assert.equal('reuse' in (outputs[0]!.manifest as any).samples, false);
});

const audio = await createAudioProcessor({ env: process.env });
test('reuse preserves absolute glides/gates/chokes, sustained overlaps, automation and continuous effect tails', { skip: audio.diagnostic?.message ?? false }, async t => {
  const w = workspace(t, tone(70, 88200, 800));
  const p = project([
    { start: '1:1', playbackRate: 0.75, gate: '3/8', chokeGroup: 'bass', envelope: { attackSeconds: 0.003, releaseSeconds: 0.02 } },
    { start: '1:2+1/8', playbackRate: 0.75, gate: '3/8', chokeGroup: 'bass', envelope: { attackSeconds: 0.02, releaseSeconds: 0.02 } },
    { start: '1:4', playbackRate: 0.5, glide: { to: 1.5, duration: '1/4' }, endSeconds: 1.75, envelope: { attackSeconds: 0.002, releaseSeconds: 0.03 } },
  ], { render: { duration: { seconds: 3.25 }, tail: { seconds: 2 } }, master: { gainDb: -2, effects: [{ type: 'reverb', roomSize: 0.4, decaySeconds: 0.5, wet: 0.1 }] } }) as any;
  p.tracks[0].effects = [{ type: 'highpass', frequencyHz: 30 }, { type: 'delay', timeMs: 170, wet: 0.2 }];
  p.tracks[0].automation = { gainDb: [{ at: { seconds: 0 }, value: -12, transition: 'linear' }, { at: { seconds: 2 }, value: -3 }],
    pan: [{ at: { seconds: 0 }, value: -0.1, transition: 'linear' }, { at: { seconds: 2 }, value: 0.2 }] };
  w.save(p);
  const outputs = [];
  for (const [name, reuseVoices] of [['old', false], ['reuse', true]] as const) {
    const r = await runCommand('render', w.path, { outDir: join(w.root, name), stems: true, reuseVoices, env: process.env });
    assert.equal(r.exitCode, 0, JSON.stringify(r.result.errors)); outputs.push(r.result);
  }
  assert.deepEqual(readFileSync(outputs[0]!.artifacts.wav!), readFileSync(outputs[1]!.artifacts.wav!));
  assert.deepEqual(readFileSync(outputs[0]!.artifacts.stems![0]!.wav), readFileSync(outputs[1]!.artifacts.stems![0]!.wav));
  const pcm = decodePcm(readFileSync(outputs[1]!.artifacts.wav!)).pcm!;
  assert.equal(pcm.frames, 143325);
  assert.ok(pcm.samples.slice(88200 * 2).some(v => v !== 0), 'sustain and effect tail cross the authored bar boundary');
  assert.deepEqual((outputs[0]!.manifest as any).samples.tracks, (outputs[1]!.manifest as any).samples.tracks);
});

test('reuse flag is explicit on validate/render and rejected on unrelated commands', t => {
  const w = workspace(t, tone(110, 1000)); w.save(project([{ start: '1:1', playbackRate: 0.5 }]));
  for (const command of ['validate', 'midi']) {
    const r = spawnSync(process.execPath, ['bin/daemonv12.js', command, w.path, '--reuse-voices', '--json'], { encoding: 'utf8' });
    const value = JSON.parse(r.stdout);
    assert.equal(r.status, command === 'validate' ? 0 : 2, JSON.stringify(value));
  }
});
