import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { renderBridge, bridgeWav, type BridgeScore, type SampleOptions } from '../studio-001/v12-bridge/bridge.ts';
import { exportBridge } from '../studio-001/v12-bridge/cli.ts';
import { normalizeScore } from '../studio-001/rack/score.ts';
import { renderScore, mixdown, peak } from '../studio-001/rack/render.ts';
import { verifyFrozen, sha256 } from '../studio-001/rack/frozen.ts';
import { lowerScore } from '../studio-001/motif/index.ts';
import { decodePcm } from '../src/render/pcm.ts';
import { readWavInfo } from '../src/render/wav.ts';
import { crush } from '../fable-lab/crush/crush.ts';

const proof = JSON.parse(readFileSync('proofs/v12-motif-bridge/proof.score.json', 'utf8')) as BridgeScore;
const copy = () => structuredClone(proof);
function one(id = 'reactor', pitch = 33, opts: SampleOptions = {}): BridgeScore {
  return { schema: 'daemonv12.signature-rack.score/2', title: 'Sampler test', bpm: 128, key: 'A minor',
    sections: [{ id: 'test', bars: 1 }], tailSeconds: 0.1, masterGainDb: 0, motifs: [],
    parts: [{ id: 'test', instrument: `v12-signature/${id}`, gainDb: 0, room: 0,
      v12: { attackSeconds: 0, releaseSeconds: 0, ...opts }, notes: [[0.25, 0.25, pitch, 1]] }] };
}
const sample = (file: string) => decodePcm(readFileSync(`packs/v12-signature-v1/assets/v12-signature/${file}`)).pcm!;

test('bridge: original catalog mappings for all 16 sounds; native stereo/mono and exact rate-one source values', async () => {
  const catalog = JSON.parse(readFileSync('packs/v12-signature-v1/v12-signature.catalog.json', 'utf8')) as {
    sounds: { id: string; rootMidi: number | null; kitPitch: number | null; channels: number; file: string; sha256: string }[] };
  assert.equal(catalog.sounds.length, 16);
  for (const sound of catalog.sounds) {
    const s = one(sound.id, sound.rootMidi ?? 60, { gate: false });
    const r = await renderBridge(s), e = r.manifest.events[0]!;
    assert.equal(e.sample!.rate, 1, sound.id);
    assert.equal(e.sample!.kitPitch, sound.kitPitch);
    assert.equal(e.sample!.sha256, sound.sha256);
    assert.equal(e.sample!.channels, sound.channels);
    const pcm = decodePcm(readFileSync(`packs/v12-signature-v1/${sound.file}`)).pcm!;
    for (let i = 0; i < Math.min(pcm.frames, r.manifest.frames - e.frame); i++)
      for (let c = 0; c < 2; c++) assert.equal(r.audio[c]![e.frame + i], pcm.samples[i * pcm.channels + (pcm.channels === 1 ? 0 : c)]! / 32768, sound.id);
  }
});

test('bridge: melodic pitch uses acoustic root A1=33, not drum kit pitch 36; transpose once', async () => {
  for (const [pitch, rate] of [[21, 0.5], [33, 1], [36, 2 ** (3 / 12)], [45, 2]] as const) {
    const r = await renderBridge(one('reactor', pitch));
    assert.equal(r.manifest.events[0]!.sample!.rate, rate);
  }
  const s = one('reactor', 33); s.transpose = 12;
  const transposed = await renderBridge(s);
  assert.equal(transposed.manifest.events[0]!.pitch, 45);
  assert.equal(transposed.manifest.events[0]!.sample!.rate, 2);
  const drum = one('sub-hammer', 36); drum.transpose = 12;
  const a = await renderBridge(drum);
  assert.equal(a.manifest.events[0]!.sample!.rate, 1);
  assert.equal(a.manifest.events[0]!.sample!.rootMidi, 33);
  assert.equal(a.manifest.events[0]!.sample!.kitPitch, 36);
  const tuned = await renderBridge(one('sub-hammer', 45, { mode: 'pitched' }));
  assert.equal(tuned.manifest.events[0]!.sample!.rate, 2);
  await assert.rejects(renderBridge(one('reactor', 58)), /24 semitone range/);
  await assert.rejects(renderBridge(one('ghost-tick', 60, { mode: 'pitched' })), /no catalog root/);
});

test('bridge: pitched waveform follows the existing sinc sampler at the requested octave', async () => {
  const r = await renderBridge(one('reactor', 45, { gate: false }));
  const frame = r.manifest.events[0]!.frame;
  // A1 source -> A2 output: measure its strongest low-frequency bin from actual rendered samples.
  const power = (hz: number) => {
    let re = 0, im = 0;
    for (let i = 0; i < 22050; i++) {
      const v = r.audio[0][frame + 4410 + i]!;
      re += v * Math.cos(2 * Math.PI * hz * i / 44100);
      im += v * Math.sin(2 * Math.PI * hz * i / 44100);
    }
    return re * re + im * im;
  };
  assert.ok(power(110) > 100 * power(55), 'octave shifts the acoustic fundamental to 110 Hz');
});

test('bridge: motif transforms, swing, off-grid and humanized notes use actual absolute frames at 44.1 kHz', async () => {
  const s = copy(); s.bpm = 127; s.swing = 0.65; s.transpose = 1;
  s.parts[1]!.phrases![1]!.transforms = [{ op: 'shift', semitones: 2 }, { op: 'gesture', set: 'short' }];
  s.parts[1]!.humanize = { timingMs: 3, velocity: 0.1, seed: 123 };
  s.parts[0]!.notes = [[0.1234567, 0.333333, 33, 0.5]];
  const r = await renderBridge(s), seconds = Math.round(60_000_000 / 127) / 1e6;
  for (const e of r.manifest.events) {
    assert.equal(e.frame, Math.round(e.beat * seconds * 44100));
    assert.equal(e.noteEndFrame, Math.round((e.beat + e.beats) * seconds * 44100));
  }
  const offgrid = r.manifest.events.find(e => e.beat === 0.1234567)!;
  assert.ok(offgrid);
  assert.equal(offgrid.frame, Math.round(0.1234567 * seconds * 44100));
  const bass = r.manifest.events.filter(e => e.part === 'bass');
  assert.equal(bass[0]!.pitch, 34);
  assert.equal(bass[3]!.pitch, 36);
  assert.equal(bass[3]!.beats, 0.25);
  assert.notEqual(bass[0]!.beat, 0, 'metadata records performed humanization');
});

test('bridge: gates release at the absolute note end; sustain, source exhaustion and output caps are explicit', async () => {
  const short = one('reactor', 33, { attackSeconds: 0.002, releaseSeconds: 0.03 });
  const r = await renderBridge(short), e = r.manifest.events[0]!, st = r.stems.get('test')!;
  assert.equal(e.frame, 5168); assert.equal(e.noteEndFrame, 10336);
  assert.equal(e.sample!.endFrame, 10336 + 1323);
  assert.equal(st[0][e.frame], 0);
  assert.equal(st[0][e.sample!.endFrame - 1], 0);
  assert.ok(st[0].slice(e.frame + 1000, e.noteEndFrame).some(v => Math.abs(v) > 0.01));
  assert.ok(st[0].slice(e.sample!.endFrame).every(v => v === 0));
  const held = one('reactor'); held.parts[0]!.notes = [[0.25, 2, 33, 1]];
  const h = await renderBridge(held);
  assert.ok(h.audio[0].slice(25000, 30000).some(v => Math.abs(v) > 0.01), 'sustain survives past a short gate');
  const natural = await renderBridge(one('ghost-tick', 60, { gate: false }));
  const ne = natural.manifest.events[0]!;
  assert.equal(ne.sample!.endFrame, ne.frame + 5292);
  assert.equal(ne.sample!.truncated, false);
  const exhausted = one('ghost-tick', 60, { gate: true }); exhausted.parts[0]!.notes = [[0, 4, 60, 1]];
  assert.equal((await renderBridge(exhausted)).manifest.events[0]!.sample!.endFrame, 5292, 'gate cannot extend a source');
  const cap = await renderBridge(one('reactor', 33, { gate: false, releaseSeconds: 0.01 }));
  assert.equal(cap.manifest.events[0]!.sample!.endFrame, cap.manifest.frames);
  assert.equal(cap.audio[0].at(-1), 0, 'output cap uses existing release fade');
  const muted = one(); muted.parts[0]!.notes = [[0, 1, 33, 0]];
  const silent = await renderBridge(muted);
  assert.equal(peak(silent.audio), 0); assert.equal(silent.manifest.events[0]!.sample!.endFrame, 0);
});

test('bridge: two-bar proof shares onsets, exact frame length, aligned additive stems, no clipping, deterministic exports', async t => {
  const before = JSON.stringify(proof), r = await renderBridge(proof), again = await renderBridge(proof);
  assert.equal(JSON.stringify(proof), before, 'input not mutated');
  assert.equal(r.manifest.frames, 176400, '3.75 s of bars plus 0.25 s tail');
  assert.equal(r.manifest.events.length, 20);
  assert.deepEqual(again.manifest, r.manifest);
  assert.equal(sha256(bridgeWav(again.audio)), sha256(bridgeWav(r.audio)));
  for (const id of ['kick', 'bass', 'rack']) assert.equal(r.manifest.events.find(e => e.part === id)!.frame, 0);
  for (const id of ['bass', 'rack']) assert.deepEqual(r.manifest.events.filter(e => e.part === id).map(e => e.frame), [0, 15504, 31008, 82688, 98191, 113695]);
  for (const st of r.stems.values()) {
    assert.equal(st[0].length, r.manifest.frames); assert.equal(st[1].length, r.manifest.frames);
    assert.ok(peak(st) < 0.9); bridgeWav(st);
  }
  for (let c = 0; c < 2; c++) for (let i = 0; i < r.manifest.frames; i++) {
    let sum = 0; for (const st of r.stems.values()) sum += st[c]![i]!;
    assert.ok(Math.abs(sum - r.audio[c]![i]!) < 1e-14);
  }
  assert.ok(peak(r.audio) < 0.9);
  const wav = readWavInfo(bridgeWav(r.audio)); assert.ok(wav.ok);
  if (wav.ok) { assert.equal(wav.info.frames, 176400); assert.equal(wav.info.bitsPerSample, 24); assert.equal(wav.info.channels, 2); }
  const root = mkdtempSync(join(tmpdir(), 'v12-bridge-export-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  await exportBridge(proof, join(root, 'a')); await exportBridge(proof, join(root, 'b'));
  assert.equal(readFileSync(join(root, 'a/SHA256SUMS'), 'utf8'), readFileSync(join(root, 'b/SHA256SUMS'), 'utf8'));
  await assert.rejects(exportBridge(proof, join(root, 'a')), /EEXIST/);
});

test('bridge: rack-only score/1 and score/2 audio remain bit identical, including room and original seed indices', async () => {
  const s = copy(); s.parts = [s.parts[2]!]; s.parts[0]!.room = 0.2;
  for (const input of [s, lowerScore(s).score]) {
    const old = await mixdown(await renderScore(normalizeScore(input.schema.endsWith('/2') ? lowerScore(input).score : input)));
    const r = await renderBridge(input);
    assert.deepEqual(r.audio, old.context);
  }
  const mixed = copy(), r = await renderBridge(mixed), index = 2;
  const rackOnly = { ...lowerScore({ ...mixed, parts: [mixed.parts[index]!] }).score };
  const n = normalizeScore(rackOnly), pt = n.parts[0]!;
  const raw = await pt.instrument.render(pt.perf, { bpm: n.bpm, beatSeconds: n.beatSeconds, swing: n.swing, key: n.key, seed: n.seed, frames: r.manifest.frames, partIndex: index });
  const gain = 10 ** ((pt.gainDb + n.masterGainDb) / 20);
  for (let i = 0; i < raw[0].length; i++) assert.ok(Math.abs(r.stems.get('rack')![0][i]! - raw[0][i]! * gain) < 1e-15);
});

test('bridge: explicit unsupported controls/gestures fail; bad input, clipping and unknown sounds fail', async () => {
  const cases: [BridgeScore, RegExp][] = [];
  const macro = one(); macro.parts[0]!.macro = 0.5; cases.push([macro, /unsupported/]);
  const gesture = copy(); gesture.parts[1]!.phrases![0]!.transforms = [{ op: 'gesture', set: 'legato' }]; cases.push([gesture, /unsupported sample gesture/]);
  const param = copy(); param.motifs[1]!.notes![0]![4] = { params: { scoop: 2 } }; cases.push([param, /per-note params/]);
  const slide = one(); slide.parts[0]!.notes = [{ beat: 0, beats: 1, pitch: 33, slide: 0.1 }]; cases.push([slide, /slides/]);
  const fit = copy(); fit.parts[1]!.phrases![0]!.fit = 'octave'; cases.push([fit, /fit:error only/]);
  cases.push([one('does-not-exist'), /unknown V12 sound/]);
  const bad = one(); bad.bpm = 0; cases.push([bad, /bpm/]);
  const badOptions = one('reactor', 33, { releaseSeconds: NaN }); cases.push([badOptions, /releaseSeconds/]);
  for (const [s, pattern] of cases) await assert.rejects(renderBridge(s), pattern);
  assert.throws(() => bridgeWav([new Float64Array([1.1]), new Float64Array([0])]), /would clip/);
  assert.throws(() => bridgeWav([new Float64Array([NaN]), new Float64Array([0])]), /Non-finite/);
});

test('bridge: CRUSH accepts amplitude-unit stereo directly, preserves frame alignment and bypass bytes', async () => {
  const r = await renderBridge(one('reactor', 33, { gate: true }));
  assert.deepEqual(crush(r.audio, { amount: 0 }).audio, r.audio);
  const processed = crush(r.audio, { amount: 0.7 }).audio;
  assert.equal(processed[0].length, r.manifest.frames); assert.equal(processed[1].length, r.manifest.frames);
  bridgeWav(processed);
});

test('bridge: committed proof hashes, event metadata and PCM24 stems reconstruct the delivered master', () => {
  const dir = 'proofs/v12-motif-bridge/audio';
  for (const line of readFileSync(`${dir}/SHA256SUMS`, 'utf8').trim().split('\n')) {
    const [hash, file] = line.split('  ');
    assert.equal(sha256(readFileSync(`${dir}/${file}`)), hash, file);
  }
  assert.deepEqual(JSON.parse(readFileSync(`${dir}/score.json`, 'utf8')), proof);
  const bytes = readFileSync(`${dir}/master.wav`), wav = readWavInfo(bytes);
  assert.ok(wav.ok);
  if (!wav.ok) return;
  assert.equal(wav.info.frames, 176400);
  const stems = readdirSync(`${dir}/stems`).map(file => readFileSync(`${dir}/stems/${file}`));
  let maxError = 0;
  for (let i = 44; i < bytes.length; i += 3) {
    const value = bytes.readIntLE(i, 3);
    assert.ok(value > -8388608 && value < 8388607);
    const sum = stems.reduce((n, st) => n + st.readIntLE(i, 3), 0);
    maxError = Math.max(maxError, Math.abs(sum - value));
  }
  assert.ok(maxError <= 2, `24-bit quantization error: ${maxError}`);
  const manifest = JSON.parse(readFileSync(`${dir}/events.json`, 'utf8'));
  assert.equal(manifest.frames, 176400); assert.equal(manifest.events.length, 20);
  assert.equal(manifest.frozenFilesVerified, true);
});

test('bridge: frozen references and protected sources still match their baseline', () => {
  assert.deepEqual(verifyFrozen(), []);
  const inventory = JSON.parse(readFileSync('proofs/v12-motif-bridge/PROTECTED.json', 'utf8')) as Record<string, string>;
  assert.ok(Object.keys(inventory).length > 100);
  for (const [file, hash] of Object.entries(inventory)) assert.equal(sha256(readFileSync(file)), hash, file);
  assert.deepEqual(readdirSync('studio-001/rack').sort(), Object.keys(inventory).filter(f => f.startsWith('studio-001/rack/')).map(f => f.slice('studio-001/rack/'.length)).sort());
});
