import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { runCommand } from '../src/pipeline.ts';
import { createAudioProcessor, decodePcm } from '../src/render/index.ts';
import { inspect } from '../scripts/inspect-orbital-foundry.ts';
const env = { ...process.env, DAEMONV12_FLUIDSYNTH: '/intentionally-unused', DAEMONV12_SOUNDFONT: '/intentionally-unused' };
const processor = await createAudioProcessor({ env });
const beat = (n: number) => Math.round(n * 428571 * 44100 / 1e6); // 140 BPM: round(60e6/140) µs per beat, nearest frame
test('real GLASSHOUSE audition: headroom, balance, aligned stems, exact reverse/payoff placement, provenance and byte repeatability', { skip: processor.diagnostic?.message ?? false }, async t => {
  const outDir = mkdtempSync(join(tmpdir(), 'glasshouse-render-')); t.after(() => rmSync(outDir, { recursive: true, force: true }));
  const options = { outDir, stems: true, format: 'wav,mp3' as const, env };
  const first = await runCommand('render', 'examples/glasshouse-audition.json', options);
  assert.equal(first.exitCode, 0, JSON.stringify(first.result.errors)); assert.deepEqual(first.result.warnings, []);
  const artifacts = first.result.artifacts, manifest: any = first.result.manifest, analysis = manifest.analysis.master;
  assert.ok(analysis.durationSeconds >= 24 && analysis.durationSeconds <= 30, String(analysis.durationSeconds));
  assert.equal(analysis.clipping, false); assert.equal(analysis.fullScaleSamples, 0); assert.ok(analysis.truePeakDbfs < -1.5);
  assert.ok(analysis.integratedLufs >= -19 && analysis.integratedLufs <= -16, JSON.stringify(analysis));
  assert.equal(manifest.production.master.clippedSamples, 0);
  assert.ok(manifest.production.tracks.every((track: any) => track.clippedSamples === 0));
  assert.equal(manifest.soundfont, null); assert.equal(manifest.midi.notes, 0);
  assert.equal(artifacts.stems!.length, 10); assert.ok(readFileSync(artifacts.mp3!).length > 10000);
  const before = new Map<string, Buffer>();
  for (const path of [artifacts.wav!, artifacts.manifest!, artifacts.analysis!, ...artifacts.stems!.map(s => s.wav)]) before.set(path, readFileSync(path));
  const stems = new Map<string, Int16Array>();
  for (const stem of artifacts.stems!) {
    const bytes = readFileSync(stem.wav), pcm = decodePcm(bytes).pcm!;
    assert.equal(pcm.frames, analysis.frames); assert.ok(pcm.samples.some(v => Math.abs(v) > 100), stem.trackId);
    assert.equal(manifest.stems.find((s: any) => s.trackId === stem.trackId).wav.sha256, createHash('sha256').update(bytes).digest('hex'));
    stems.set(stem.trackId, pcm.samples);
  }
  for (const asset of manifest.samples.assets) assert.equal(asset.sha256, createHash('sha256').update(readFileSync(join('examples', asset.file))).digest('hex'));
  // The payoff starts exactly at bar 13; nothing of it before.
  const prism = stems.get('prism-impact')!, payoff = beat(48);
  assert.ok(prism.slice(0, payoff * 2).every(v => v === 0)); assert.ok(prism.slice(payoff * 2, (payoff + 441) * 2).some(v => Math.abs(v) > 1000));
  // The reverse ending at bar 3 rises into the boundary and stops exactly there.
  const reverse = stems.get('glass-reverse')!, edge = beat(8), rms = (a: number, b: number) => Math.sqrt(reverse.slice(a * 2, b * 2).reduce((s, v) => s + v * v, 0) / ((b - a) * 2));
  assert.ok(rms(edge - 2205, edge) > 10 * rms(edge - 26460, edge - 24255), 'rising swell');
  assert.ok(reverse.slice(edge * 2, (edge + 2 * 18900) * 2).every(v => v === 0), 'silent after the boundary until the next reverse');
  const spectral = inspect(artifacts.wav!);
  assert.ok(spectral.bandPowerPercent['30-120 Hz']! < 60, 'low pair does not swamp the mix');
  assert.ok(spectral.bandPowerPercent['2000-6000 Hz']! + spectral.bandPowerPercent['6000-12000 Hz']! > 2.5, 'top end is present');
  const levels = spectral.perSecondRmsDbfs;
  assert.ok(levels.slice(0, 22).every(v => v !== null && v > -30), 'continuous activity through the payoff');
  assert.ok(levels[20]! > levels[23]! + 12, 'the payoff releases instead of stopping abruptly');
  assert.equal((await runCommand('render', 'examples/glasshouse-audition.json', options)).exitCode, 0);
  for (const [path, bytes] of before) assert.deepEqual(readFileSync(path), bytes, path);
  t.diagnostic(JSON.stringify(analysis));
});
