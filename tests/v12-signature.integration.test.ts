import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { runCommand } from '../src/pipeline.ts';
import { createAudioProcessor, decodePcm, extractWavFrames, type Pcm } from '../src/render/index.ts';
import { DEFAULT_OUTPUT } from '../scripts/generate-v12-signature.ts';

const pack = DEFAULT_OUTPUT, hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const verification = JSON.parse(readFileSync(join(pack, 'v12-signature.verification.json'), 'utf8'));
const committed = (name: string) => hash(readFileSync(join(pack, 'audio', `v12-signature-${name}.wav`)));
const rms = (pcm: Pcm, from: number, to: number) => {
  let sum = 0, n = 0; for (let i = Math.round(from * 44100) * pcm.channels; i < Math.min(pcm.samples.length, Math.round(to * 44100) * pcm.channels); i++) { sum += pcm.samples[i]! ** 2; n++; }
  return n ? Math.sqrt(sum / n) : 0;
};

test('V12 SIGNATURE audition renders Node-only, byte-identical to the committed WAV, one sound at a time', async t => {
  const outDir = mkdtempSync(join(tmpdir(), 'v12-audition-')); t.after(() => rmSync(outDir, { recursive: true, force: true }));
  const env = { ...process.env, DAEMONV12_FFMPEG: '/intentionally-unused', DAEMONV12_FLUIDSYNTH: '/intentionally-unused', DAEMONV12_SOUNDFONT: '/intentionally-unused' };
  const first = await runCommand('render', join(pack, 'v12-signature-audition.json'), { outDir: join(outDir, 'a'), stems: true, env });
  assert.equal(first.exitCode, 0, JSON.stringify(first.result.errors)); assert.deepEqual(first.result.warnings, []);
  const manifest: any = first.result.manifest, wav = readFileSync(first.result.artifacts.wav!), master = decodePcm(wav).pcm!;
  assert.equal(master.frames, 2513700); assert.equal(manifest.mix.clippedSamples, 0); assert.equal(manifest.soundfont, null);
  assert.equal(hash(wav), committed('audition'), 'matches packs/v12-signature-v1/audio/v12-signature-audition.wav');
  const second = await runCommand('render', join(pack, 'v12-signature-audition.json'), { outDir: join(outDir, 'b'), stems: true, env });
  assert.deepEqual(readFileSync(second.result.artifacts.wav!), wav);
  // Each sampler sound is silent before its slot, clearly present in it, and has faded (-40 dB) shortly after it.
  const slots: Record<string, [number, number]> = { abyss: [12, 16], reactor: [16, 20], signal: [20, 24], phantom: [24, 28], 'event-horizon': [28, 34],
    afterglow: [34, 38], specter: [38, 42], ascension: [46, 52], convergence: [52, 57] };
  for (const stem of first.result.artifacts.stems!) {
    const pcm = decodePcm(readFileSync(stem.wav)).pcm!, slot = slots[stem.trackId];
    if (!slot) continue;
    const inside = rms(pcm, slot[0], slot[1]);
    assert.ok(inside > 300, `${stem.trackId} is audible in its slot`);
    assert.equal(rms(pcm, 0, slot[0]), 0, `${stem.trackId} is silent before ${slot[0]} s`);
    if (stem.trackId !== 'convergence') assert.ok(rms(pcm, slot[1] + 0.7, slot[1] + 2) < inside / 100, `${stem.trackId} has cleared by ${slot[1] + 0.7} s`);
  }
  const kit = decodePcm(readFileSync(first.result.artifacts.stems!.find(s => s.trackId === 'kit')!.wav)).pcm!;
  for (const [bar, label] of [[1, 'sub-hammer'], [2, 'iron-pulse'], [3, 'titanium-crack'], [4, 'neon-clap'], [5, 'ghost-tick'], [6, 'open-circuit'], [22, 'chrome-strike']] as const)
    assert.ok(rms(kit, (bar - 1) * 2, bar * 2) > 100, `${label} sounds in bar ${bar}`);
  assert.equal(rms(kit, 12, 42), 0, 'percussion stays out of the melodic slots');
});

const env = { ...process.env, DAEMONV12_FLUIDSYNTH: '/intentionally-unused', DAEMONV12_SOUNDFONT: '/intentionally-unused' };
const processor = await createAudioProcessor({ env });
test('V12 SIGNATURE showcase: exact 28 s, aligned stems, headroom, mono-safe low end, a louder drop', { skip: processor.diagnostic?.message ?? false }, async t => {
  const outDir = mkdtempSync(join(tmpdir(), 'v12-showcase-')); t.after(() => rmSync(outDir, { recursive: true, force: true }));
  const result = await runCommand('render', join(pack, 'v12-signature-showcase.json'), { outDir, stems: true, env });
  assert.equal(result.exitCode, 0, JSON.stringify(result.result.errors)); assert.deepEqual(result.result.warnings, []);
  const manifest: any = result.result.manifest, analysis = manifest.analysis.master, wav = readFileSync(result.result.artifacts.wav!), master = decodePcm(wav).pcm!;
  assert.equal(master.frames, 1234800); assert.equal(analysis.clipping, false); assert.equal(analysis.fullScaleSamples, 0);
  assert.equal(manifest.production.master.clippedSamples, 0); assert.ok(manifest.production.tracks.every((track: any) => track.clippedSamples === 0));
  assert.ok(analysis.truePeakDbfs < -1, String(analysis.truePeakDbfs)); assert.ok(analysis.integratedLufs > -16 && analysis.integratedLufs < -12, String(analysis.integratedLufs));
  assert.equal(manifest.soundfont, null); assert.equal(manifest.midi.notes, 0);
  assert.ok(manifest.samples.assets.every((a: { file: string }) => a.file.startsWith('assets/v12-signature/')));
  assert.equal(result.result.artifacts.stems!.length, 13);
  for (const stem of result.result.artifacts.stems!) assert.equal(decodePcm(readFileSync(stem.wav)).pcm!.frames, master.frames, stem.trackId);
  // Low end: below ~150 Hz the two channels are the same signal (mono-safe sub and kick).
  let lr = 0, ll = 0, rr = 0; const a = 1 - Math.exp(-2 * Math.PI * 150 / 44100); let yl = 0, yr = 0;
  for (let i = 0; i < master.frames; i++) { yl += a * (master.samples[2 * i]! - yl); yr += a * (master.samples[2 * i + 1]! - yr); lr += yl * yr; ll += yl * yl; rr += yr * yr; }
  assert.ok(lr / Math.sqrt(ll * rr) > 0.97, 'low band is mono');
  // The drop (bars 9–12) is the loudest section; the groove sits below it; the ending releases before 28 s.
  const section = async (from: number, to: number) => { const path = join(outDir, `${from}.wav`); writeFileSync(path, extractWavFrames(wav, Math.round(from * 44100), Math.round(to * 44100))); return (await processor.value!.loudness(path)).value!.integratedLufs!; };
  const orbit = await section(3.75, 11.25), drop = await section(15, 22.5), ignition = await section(0, 3.75);
  assert.ok(drop > orbit + 1.5 && orbit > ignition + 1.5, JSON.stringify({ ignition, orbit, drop }));
  assert.ok(rms(master, 27.9, 28) < 30, 'nothing is still sounding at the 28 s boundary');
  if (processor.value!.identity.version === verification.projects.showcase.render.tools.ffmpeg) assert.equal(hash(wav), committed('showcase'), 'matches the committed showcase');
  else t.diagnostic(`FFmpeg ${processor.value!.identity.version} differs from the recorded ${verification.projects.showcase.render.tools.ffmpeg}; byte comparison skipped`);
});
