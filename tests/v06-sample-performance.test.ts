import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileProjectFile, compileProjectText, runCommand } from '../src/pipeline.ts';
import { validateProject } from '../src/project/validate.ts';
import { decodePcm, encodePcm, mixPcm, sumFloat, voiceFrames, voiceSamples, playbackPosition, playbackRateAt, type Pcm, type PcmTrigger, type VoicePlayback } from '../src/render/index.ts';
import { ticksToFrames } from '../src/timing/musical-time.ts';
import { frequency, level, tone, wav } from './helpers/tones.ts';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const pcmOf = (samples: Int16Array, channels: 1 | 2 = 1): Pcm => ({ frames: samples.length / channels, channels, samples });
const ramp = pcmOf(Int16Array.from({ length: 32000 }, (_, k) => k - 16000));
const track = (id: string, sample: string, notes: unknown[], bars = 1) =>
  ({ id, instrument: { type: 'sampler', sample }, clips: [{ bar: 1, pattern: 'p' }], patterns: [{ id: 'p', bars, notes }] });
const project = (tracks: unknown[], bars = 1, bpm = 120) => ({ formatVersion: 1, title: 'V0.6', bpm, timeSignature: '4/4', bars, tracks });
function workspace(t: TestContext, sources: Record<string, Buffer>) {
  const root = mkdtempSync(join(tmpdir(), 'daemon-v06-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [file, bytes] of Object.entries(sources)) { mkdirSync(join(root, 'assets', file, '..'), { recursive: true }); writeFileSync(join(root, 'assets', file), bytes); }
  const path = join(root, 'cue.json'), outDir = join(root, 'out');
  const save = (value: unknown) => writeFileSync(path, JSON.stringify(value));
  const render = async (value: unknown) => { save(value); return runCommand('render', path, { outDir, stems: true }); };
  const stem = (id: string) => decodePcm(readFileSync(join(outDir, `cue.stems/${id}.wav`))).pcm!;
  return { root, path, outDir, save, render, stem };
}
const trigger = (manifest: unknown, trackIndex = 0, index = 0) => (manifest as { samples: { tracks: { triggers: Record<string, unknown>[] }[] } }).samples.tracks[trackIndex]!.triggers[index]!;

test('V0.6 schema: sampler and drum-kit notes accept playbackRate, offsetSeconds and a closed glide; explicit defaults normalize away', () => {
  const kits = new Map([['assets/kit/kit.json', [{ name: 'tone', pitch: 36, sample: 'assets/kit/tone.wav' }]]]);
  const value = project([
    track('vox', 'assets/vox.wav', [
      { start: '1:1', velocity: 0.7, playbackRate: 1.5, offsetSeconds: 0.125, glide: { to: 0.5, duration: '1/8' } },
      { start: '1:2', playbackRate: 1, offsetSeconds: 0 },
      // A glide may outlast its pattern and its voice.
      { start: '1:3', glide: { to: 2, duration: '4/1' } },
    ]),
    { id: 'kit', instrument: { type: 'drumkit', kit: 'assets/kit/kit.json' }, clips: [{ bar: 1, pattern: 'p' }],
      patterns: [{ id: 'p', bars: 1, notes: [{ start: '1:1', pitch: 'tone', playbackRate: 2 }, { start: '1:2', pitch: 36, offsetSeconds: 0.01 }] }] },
  ]);
  const compiled = compileProjectText(JSON.stringify(value), kits);
  assert.deepEqual(compiled.diagnostics, []);
  const [vox, kit] = compiled.timeline!.tracks;
  assert.deepEqual(vox!.notes.map(n => n.playback), [{ rate: 1.5, offsetSeconds: 0.125, glide: { to: 0.5, durationTicks: 480 } }, undefined, { rate: 1, offsetSeconds: 0, glide: { to: 2, durationTicks: 15360 } }]);
  assert.equal(Object.hasOwn(vox!.notes[1]!, 'playback'), false, 'explicit defaults are an unperformed note');
  assert.deepEqual(kit!.notes.map(n => [n.pitch, n.playback]), [[36, { rate: 2, offsetSeconds: 0 }], [36, { rate: 1, offsetSeconds: 0.01 }]]);
});

test('V0.6 playbackRate rejects zero, negative, out-of-range, nonfinite and non-numeric rates with agent hints', () => {
  const at = 'tracks[0].patterns[0].notes[0].playbackRate';
  const check = (rate: unknown) => {
    const result = validateProject(project([track('vox', 'assets/vox.wav', [{ start: '1:1', playbackRate: rate }])]));
    assert.equal(result.project, null, String(rate));
    assert.equal(result.diagnostics.length, 1, JSON.stringify(result.diagnostics));
    assert.equal(result.diagnostics[0]!.path, at);
    return result.diagnostics[0]!;
  };
  for (const rate of [0, -0, -1, 0.2499, 4.0001, 8, 1e9]) assert.equal(check(rate).code, 'OUT_OF_RANGE', String(rate));
  for (const rate of [NaN, Infinity, -Infinity, '2', null, true, [2], { rate: 2 }]) assert.equal(check(rate).code, 'WRONG_TYPE', String(rate));
  assert.equal(check(0).expected, '0.25 through 4');
  assert.match(check(12).hint!, /For 12 semitones use 2 \(2\^\(12\/12\)\)/);
  assert.match(check(-12).hint!, /For -12 semitones use 0\.5 /);
  assert.match(check(7).hint!, /For 7 semitones use 1\.498307 /);
  assert.match(check(0).hint!, /For 0 semitones use 1 /);
  assert.match(check(4.5).hint!, /pitch and duration change together.*2\^\(n\/12\)/);
  for (const rate of [0.25, 0.5, 1.25, 1.5, 2, 4]) assert.deepEqual(validateProject(project([track('vox', 'assets/vox.wav', [{ start: '1:1', playbackRate: rate }])])).diagnostics, [], String(rate));
});

test('V0.6 offsetSeconds and glide are strict: precision, ranges, closed objects, the tick grid and glides that do not move', () => {
  const codes = (note: Record<string, unknown>) => validateProject(project([track('vox', 'assets/vox.wav', [{ start: '1:1', ...note }])]))
    .diagnostics.map(d => `${d.code} ${d.path.replace('tracks[0].patterns[0].notes[0].', '')}`);
  assert.deepEqual(codes({ offsetSeconds: -0.5 }), ['OUT_OF_RANGE offsetSeconds']);
  assert.deepEqual(codes({ offsetSeconds: 0.0000001 }), ['INVALID_DURATION offsetSeconds']);
  assert.deepEqual(codes({ offsetSeconds: '0.1' }), ['WRONG_TYPE offsetSeconds']);
  assert.deepEqual(codes({ offsetSeconds: 601 }), ['OUT_OF_RANGE offsetSeconds']);
  assert.deepEqual(codes({ glide: 2 }), ['WRONG_TYPE glide']);
  assert.deepEqual(codes({ glide: {} }), ['MISSING_FIELD glide.to', 'MISSING_FIELD glide.duration']);
  assert.deepEqual(codes({ glide: { to: 2 } }), ['MISSING_FIELD glide.duration']);
  assert.deepEqual(codes({ glide: { to: 2, duration: '1/7' } }), ['OFF_GRID glide.duration']);
  assert.deepEqual(codes({ glide: { to: 2, duration: '4n' } }), ['INVALID_DURATION glide.duration']);
  assert.deepEqual(codes({ glide: { to: 5, duration: '1/4' } }), ['OUT_OF_RANGE glide.to']);
  assert.deepEqual(codes({ glide: { to: 2, duration: '1/4', curve: 'exponential' } }), ['UNKNOWN_FIELD glide.curve']);
  assert.deepEqual(codes({ glide: { to: 1, duration: '1/4' } }), ['OUT_OF_RANGE glide.to']);
  assert.deepEqual(codes({ playbackRate: 1.5, glide: { to: 1.5, duration: '1/4' } }), ['OUT_OF_RANGE glide.to']);
  // An invalid starting rate is reported once, without a cascading glide diagnostic.
  assert.deepEqual(codes({ playbackRate: 9, glide: { to: 1, duration: '1/4' } }), ['OUT_OF_RANGE playbackRate']);
  const still = validateProject(project([track('vox', 'assets/vox.wav', [{ start: '1:1', glide: { to: 1, duration: '1/4' } }])])).diagnostics[0]!;
  assert.equal(still.hint, 'Remove glide to hold one playbackRate.');
  const alias = validateProject(project([track('vox', 'assets/vox.wav', [{ start: '1:1', glide: { rate: 2, duration: '1/4' } }])])).diagnostics;
  assert.deepEqual(alias.map(d => [d.code, d.path.split('.').at(-1), d.hint]), [['MISSING_FIELD', 'to', 'Add "to": 0.5.'], ['UNKNOWN_FIELD', 'rate', 'Use to.']]);
});

test('V0.6 hints: GM notes reject performance fields; aliases and semitone guesses point agents to the real fields', () => {
  const gm = validateProject(project([{ id: 'lead', instrument: { type: 'gm', program: 'acoustic_grand_piano' }, clips: [{ bar: 1, pattern: 'p' }],
    patterns: [{ id: 'p', bars: 1, notes: [{ start: '1:1', pitch: 'C4', duration: '1/4', playbackRate: 2, offsetSeconds: 0.1, glide: { to: 2, duration: '1/4' } }] }] }]));
  const only = 'playbackRate, offsetSeconds and glide apply only to sampler and drum-kit notes.';
  assert.deepEqual(gm.diagnostics.map(d => [d.code, d.path.split('.').at(-1), d.hint]), [['UNKNOWN_FIELD', 'playbackRate', only], ['UNKNOWN_FIELD', 'offsetSeconds', only], ['UNKNOWN_FIELD', 'glide', only]]);
  const hints = (note: Record<string, unknown>) => validateProject(project([track('vox', 'assets/vox.wav', [{ start: '1:1', ...note }])])).diagnostics.map(d => [d.code, d.hint]);
  assert.deepEqual(hints({ rate: 1.5 }), [['UNKNOWN_FIELD', 'Use playbackRate.']]);
  assert.deepEqual(hints({ playbackrate: 1.5 }), [['UNKNOWN_FIELD', 'Use playbackRate.']]);
  assert.deepEqual(hints({ semitones: 7 }), [['UNKNOWN_FIELD', 'Use playbackRate: 1.498307 for 7 semitones (2^(n/12)); pitch and duration change together.']]);
  assert.deepEqual(hints({ transpose: -12 }), [['UNKNOWN_FIELD', 'Use playbackRate: 0.5 for -12 semitones (2^(n/12)); pitch and duration change together.']]);
  assert.deepEqual(hints({ offset: 0.1 }), [['UNKNOWN_FIELD', 'Use offsetSeconds.']]);
  assert.deepEqual(hints({ glideTo: 0.5 }), [['UNKNOWN_FIELD', 'Use glide: {"to": 0.5, "duration": "1/8"}, the destination playbackRate and the musical time to reach it.']]);
  assert.deepEqual(hints({ duration: '1/4' }), [['UNKNOWN_FIELD', 'Use duration.']], 'existing sample-note behavior is unchanged');
});

test('V0.6 rates 1, 2, 0.5, 1.25 and 1.5 scale measured pitch and voice length together; rate 1 is the source itself', async t => {
  const source = tone(441, 22050), w = workspace(t, { 'tone.wav': wav(source) });
  const rates = [1, 2, 0.5, 1.25, 1.5];
  const r = await w.render(project(rates.map((rate, i) => track(`r${i}`, 'assets/tone.wav', [{ start: '1:1', velocity: 1, ...(rate === 1 ? {} : { playbackRate: rate }) }])), 2));
  assert.equal(r.exitCode, 0, JSON.stringify(r.result.errors));
  rates.forEach((rate, i) => {
    const audio = w.stem(`r${i}`), frames = Math.ceil(22050 / rate);
    if (rate === 1) {
      assert.equal(trigger(r.result.manifest, i).playback, undefined);
      for (let k = 0; k < 22050; k++) assert.equal(audio.samples[k * 2], source[k]);
    } else assert.deepEqual(trigger(r.result.manifest, i).playback, { rate, voiceFrames: frames });
    assert.ok(audio.samples.slice(frames * 2).every(v => v === 0), `rate ${rate} ends at frame ${frames}`);
    assert.ok(audio.samples.slice((frames - 50) * 2, frames * 2).some(v => Math.abs(v) > 1000), `rate ${rate} sounds until its end`);
    const measured = frequency(audio.samples, 100, frames - 100, 2);
    assert.ok(Math.abs(measured / (441 * rate) - 1) < 5e-4, `rate ${rate}: ${measured} Hz`);
  });
  assert.equal((r.result.manifest as { samples: { playback: { name: string } } }).samples.playback.name, 'daemonv12-playback');
});

test('V0.6 glides 1→0.5, 0.5→2, 1→2, short and longer than the source: monotonic continuous read position, exact destination rate, no click', () => {
  const sine = pcmOf(tone(300, 3 * 44100, 12000));
  const cases: VoicePlayback[] = [
    { rate: 1, offset: 1000, glide: { to: 0.5, frames: 8000 } },
    { rate: 0.5, offset: 1000, glide: { to: 2, frames: 8000 } },
    { rate: 1, offset: 1000, glide: { to: 2, frames: 8000 } },
    { rate: 1, offset: 1000, glide: { to: 2, frames: 345 } },
    { rate: 1, offset: 1000, glide: { to: 4, frames: 100000 } },
  ];
  for (const playback of cases) {
    const glide = playback.glide!, low = Math.min(playback.rate, glide.to), high = Math.max(playback.rate, glide.to), label = JSON.stringify(playback);
    // A ramp source turns each output value back into the read position that produced it.
    const n = voiceFrames(ramp, playback), positions = voiceSamples(ramp, playback) as Float64Array;
    assert.equal(positions.length, n);
    assert.ok(playbackPosition(playback, n - 1) < ramp.frames && playbackPosition(playback, n) >= ramp.frames, label);
    for (let i = 0; i < n - 1; i++) {
      const at = playbackPosition(playback, i);
      if (at < 160 || at > ramp.frames - 160) continue; // the kernel reaches the source edges
      assert.ok(Math.abs(positions[i]! + 16000 - at) < 1e-3, `${label}: position at ${i}`);
      const step = positions[i + 1]! - positions[i]!;
      assert.ok(step > low - 1e-3 && step < high + 1e-3, `${label}: step ${step} at ${i}`);
    }
    if (n > glide.frames + 1) assert.ok(Math.abs(playbackPosition(playback, glide.frames + 1) - playbackPosition(playback, glide.frames) - glide.to) < 1e-9, label);
    else assert.ok(playbackRateAt(playback, n - 1) < high, `${label} ends before its glide completes`);
    // Continuous phase: the voice stays within one LSB of the ideal sine at the same read positions.
    const voice = voiceSamples(sine, playback) as Float64Array;
    for (let i = 0; i < voice.length; i++) {
      const at = playbackPosition(playback, i);
      if (at < 160 || at > sine.frames - 160) continue;
      assert.ok(Math.abs(voice[i]! - 12000 * Math.sin(2 * Math.PI * 300 * at / 44100)) < 1, `${label}: residual at ${i}`);
    }
    if (voice.length > glide.frames + 4000) {
      const measured = frequency(voice, glide.frames + 200, voice.length - 200);
      assert.ok(Math.abs(measured / (300 * glide.to) - 1) < 1e-3, `${label}: holds ${measured} Hz`);
    }
  }
});

test('V0.6 musical glide durations resolve to absolute frame differences; manifests record canonical values; renders repeat byte for byte', async t => {
  const w = workspace(t, { 'tone.wav': wav(tone(441, 22050)) });
  const notes = [
    { start: '1:2', velocity: 1, glide: { to: 0.5, duration: '2/16' } },
    { start: '1:3+1/12', velocity: 1, playbackRate: 0.5, glide: { to: 2, duration: '1/12' } },
    { start: '2:1', velocity: 1, glide: { to: 2, duration: '1/256' } },
    { start: '2:3', velocity: 1, glide: { to: 4, duration: '8/1' } },
  ];
  const first = await w.render(project([track('vox', 'assets/tone.wav', notes, 2)], 2, 140));
  assert.equal(first.exitCode, 0, JSON.stringify(first.result.errors));
  const tempo = Math.round(60000000 / 140);
  [[960, 480, '1/8', 0.5], [2240, 320, '1/12', 2], [3840, 15, '1/256', 2], [5760, 30720, '8/1', 4]].forEach(([tick, ticks, duration, to], i) => {
    const frame = ticksToFrames(tick as number, tempo), record = trigger(first.result.manifest, 0, i);
    assert.equal(record.frame, frame);
    assert.deepEqual((record.playback as { glide: unknown }).glide, { to, duration, frames: ticksToFrames((tick as number) + (ticks as number), tempo) - frame });
  });
  const outputs = [first.result.artifacts.wav!, first.result.artifacts.manifest!, ...first.result.artifacts.stems!.map(s => s.wav)].map(path => [path, readFileSync(path)] as const);
  assert.equal((await runCommand('render', w.path, { outDir: w.outDir, stems: true })).exitCode, 0);
  for (const [path, bytes] of outputs) assert.deepEqual(readFileSync(path), bytes, path);
});

test('V0.6 offsets: zero is historical, interior offsets start in the right section, microsecond rounding, near-end voices, past-end errors', async t => {
  const sections = Int16Array.from([...tone(220.5, 10000, 8000), ...tone(441, 10000, 8000), ...tone(882, 10000, 8000)]);
  const w = workspace(t, { 'sections.wav': wav(sections) });
  const render = (note: Record<string, unknown>) => w.render(project([track('vox', 'assets/sections.wav', [{ start: '1:1', velocity: 1, ...note }])]));
  const plain = await render({});
  const historical = readFileSync(plain.result.artifacts.wav!), historicalTrigger = trigger(plain.result.manifest);
  const zero = await render({ offsetSeconds: 0, playbackRate: 1 });
  assert.deepEqual(readFileSync(zero.result.artifacts.wav!), historical);
  assert.deepEqual(trigger(zero.result.manifest), historicalTrigger);
  for (const [seconds, frame] of [[0.226757, 10000], [0.453515, 20000], [0.005, 221], [0.000012, 1], [0.000011, 0], [0.68026, 29999]] as const) {
    const r = await render({ offsetSeconds: seconds });
    assert.equal(r.exitCode, 0, JSON.stringify(r.result.errors));
    assert.deepEqual(trigger(r.result.manifest).playback, { rate: 1, offset: { seconds, frames: frame }, voiceFrames: 30000 - frame });
    const audio = w.stem('vox');
    for (let k = 0; k < 30000 - frame; k++) assert.equal(audio.samples[k * 2], sections[frame + k], `offset ${seconds} sample ${k}`);
    assert.ok(audio.samples.slice((30000 - frame) * 2).every(v => v === 0));
    if (frame === 10000 || frame === 20000) assert.ok(Math.abs(frequency(audio.samples, 100, 9900, 2) - (frame === 10000 ? 441 : 882)) < 0.5);
  }
  const nearEnd = await render({ offsetSeconds: 0.68026, playbackRate: 0.5 });
  assert.equal(nearEnd.exitCode, 0);
  assert.equal((trigger(nearEnd.result.manifest).playback as { voiceFrames: number }).voiceFrames, 2);
  for (const seconds of [0.680272, 0.7, 5]) {
    w.save(project([track('vox', 'assets/sections.wav', [{ start: '1:1', offsetSeconds: seconds }])]));
    const compiled = compileProjectFile(w.path);
    assert.equal(compiled.timeline, null);
    assert.deepEqual(compiled.diagnostics.map(d => [d.code, d.path, d.hint]), [['OUT_OF_RANGE', 'tracks[0].patterns[0].notes[0].offsetSeconds', 'Use at most 0.68026 seconds.']]);
    assert.match(compiled.diagnostics[0]!.expected!, /before the end of assets\/sections\.wav \(30000 frames, 0\.680272 s\)/);
    const failed = await runCommand('render', w.path, { outDir: w.outDir, stems: true });
    assert.equal(failed.exitCode, 1); assert.deepEqual(readdirSync(w.outDir), [], 'no stale or partial artifacts');
    assert.equal((await runCommand('validate', w.path)).exitCode, 1);
  }
});

test('V0.6 drum kits: named and pitch-mapped hits keep their meaning; rate, offset and bounds apply to the hit that plays', async t => {
  const w = workspace(t, { 'kit/tone.wav': wav(tone(441, 22050)), 'kit/short.wav': wav(tone(882, 1000)),
    'kit/kit.json': Buffer.from(JSON.stringify({ formatVersion: 1, samples: [{ name: 'tone', pitch: 36, file: 'tone.wav' }, { name: 'short', pitch: 38, file: 'short.wav' }] })) });
  const kit = (notes: unknown[]) => project([{ id: 'kit', instrument: { type: 'drumkit', kit: 'assets/kit/kit.json' }, clips: [{ bar: 1, pattern: 'p' }], patterns: [{ id: 'p', bars: 2, notes }] }], 2);
  const r = await w.render(kit([{ start: '1:1', pitch: 'tone', velocity: 1, playbackRate: 2 }, { start: '1:3', pitch: 36, velocity: 1, playbackRate: 2 }, { start: '2:1', pitch: 'C2', velocity: 1 }, { start: '2:3', pitch: 'short', velocity: 1, offsetSeconds: 0.01 }]));
  assert.equal(r.exitCode, 0, JSON.stringify(r.result.errors));
  const audio = w.stem('kit'), beat = 22050, voice = Math.ceil(22050 / 2);
  for (let k = 0; k < voice * 2; k++) assert.equal(audio.samples[k], audio.samples[2 * beat * 2 + k], 'name and pitch number select the same performed hit');
  assert.ok(Math.abs(frequency(audio.samples, 100, voice - 100, 2) - 882) < 0.5);
  assert.ok(Math.abs(frequency(audio.samples, 4 * beat + 100, 4 * beat + 22000, 2) - 441) < 0.5, 'unperformed hit unchanged');
  const triggers = (r.result.manifest as { samples: { tracks: { triggers: { file: string; playback?: unknown }[] }[] } }).samples.tracks[0]!.triggers;
  assert.deepEqual(triggers.map(x => [x.file, x.playback]), [
    ['assets/kit/tone.wav', { rate: 2, voiceFrames: voice }], ['assets/kit/tone.wav', { rate: 2, voiceFrames: voice }],
    ['assets/kit/tone.wav', undefined], ['assets/kit/short.wav', { rate: 1, offset: { seconds: 0.01, frames: 441 }, voiceFrames: 559 }]]);
  w.save(kit([{ start: '1:1', pitch: 'short', offsetSeconds: 0.03 }, { start: '1:2', pitch: 'tone', offsetSeconds: 0.03 }]));
  const compiled = compileProjectFile(w.path);
  assert.deepEqual(compiled.diagnostics.map(d => [d.code, d.path]), [['OUT_OF_RANGE', 'tracks[0].patterns[0].notes[0].offsetSeconds']]);
  assert.match(compiled.diagnostics[0]!.expected!, /assets\/kit\/short\.wav \(1000 frames/);
});

test('V0.6 combinations: offset with a fixed rate or a glide reads exactly the expected source positions', async t => {
  const w = workspace(t, { 'ramp.wav': wav(ramp.samples) });
  for (const [note, playback] of [[{ playbackRate: 1.5 }, { rate: 1.5, offset: 4410 }], [{ glide: { to: 0.5, duration: '1/4' } }, { rate: 1, offset: 4410, glide: { to: 0.5, frames: 22050 } }]] as const) {
    const r = await w.render(project([track('vox', 'assets/ramp.wav', [{ start: '1:1', velocity: 1, offsetSeconds: 0.1, ...note }])]));
    assert.equal(r.exitCode, 0, JSON.stringify(r.result.errors));
    const audio = w.stem('vox'), n = voiceFrames(ramp, playback);
    assert.equal((trigger(r.result.manifest).playback as { voiceFrames: number }).voiceFrames, n);
    for (let i = 0; i < n; i++) {
      const at = playbackPosition(playback, i);
      if (at > 160 && at < ramp.frames - 160) assert.ok(Math.abs(audio.samples[i * 2]! + 16000 - at) <= 0.501, `${JSON.stringify(playback)} at ${i}`);
    }
  }
});

test('V0.6 combinations: overlapping differently pitched copies of one sample stay independent voices', async t => {
  const source = tone(441, 22050), w = workspace(t, { 'tone.wav': wav(source) });
  const rates = [1, 1.25, 1.5];
  const r = await w.render(project([track('chord', 'assets/tone.wav', rates.map(rate => ({ start: '1:1', velocity: 0.5, playbackRate: rate })))]));
  assert.equal(r.exitCode, 0, JSON.stringify(r.result.errors));
  const audio = w.stem('chord'), voices = rates.map(rate => voiceSamples(pcmOf(source), { rate, offset: 0 }));
  for (let i = 0; i < 22050; i++) assert.equal(audio.samples[i * 2], voices.reduce((sum, v) => sum + (i < v.length ? Math.round(v[i]! * 0.5) : 0), 0));
  for (const rate of rates) assert.ok(level(audio.samples, 441 * rate, 0, 14000, 2) > 4900, `component ${441 * rate} Hz`);
  assert.ok(level(audio.samples, 500, 0, 14000, 2) < 50);
});

test('V0.6 quality: finite output, no interpolation overshoot or clipping near full scale, aliasing and imaging suppressed', () => {
  const loud = pcmOf(tone(1000, 44100, 32000));
  for (const playback of [{ rate: 0.25, offset: 0 }, { rate: 0.5, offset: 0 }, { rate: 1.25, offset: 0 }, { rate: 2, offset: 0 }, { rate: 4, offset: 0 },
    { rate: 0.25, offset: 0, glide: { to: 4, frames: 30000 } }, { rate: 4, offset: 0, glide: { to: 0.25, frames: 5000 } }]) {
    const voice = voiceSamples(loud, playback);
    let peak = 0;
    for (const v of voice) { assert.ok(Number.isFinite(v)); peak = Math.max(peak, Math.abs(v)); }
    assert.ok(peak <= 32000 * 1.0002, `${JSON.stringify(playback)} peak ${peak}`);
    assert.equal(mixPcm([{ frame: 0, velocity: 1, pcm: loud, playback }], 1).clippedSamples, 0);
  }
  // A 15 kHz tone at rate 2 would sit at 30 kHz: it is removed, not folded down to 14.1 kHz.
  const folded = voiceSamples(pcmOf(tone(15000, 44100, 16000)), { rate: 2, offset: 0 });
  assert.ok(level(folded, 14100, 2000, 20000) < 16000 * 1e-4);
  // A 20 kHz tone at rate 0.5 lands at 10 kHz; its 24.1 kHz image would land at 12.05 kHz.
  const imaged = voiceSamples(pcmOf(tone(20000, 44100, 16000)), { rate: 0.5, offset: 0 });
  assert.ok(level(imaged, 12050, 2000, 80000) < 16000 * 1e-4);
  const passband = voiceSamples(pcmOf(tone(5000, 44100, 16000)), { rate: 1.5, offset: 0 });
  assert.ok(Math.abs(level(passband, 7500, 2000, 28000) / 16000 - 1) < 1e-3);
});

test('V0.6 determinism: performed voices are bit-exact from basic IEEE-754 arithmetic (golden hashes)', () => {
  let state = 0x9e3779b9;
  const noise = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) % 20001 - 10000; };
  const stereo = pcmOf(Int16Array.from({ length: 16000 }, noise), 2);
  const playback = { rate: 1.37, offset: 123, glide: { to: 0.61, frames: 1500 } };
  const voice = voiceSamples(stereo, playback) as Float64Array;
  assert.equal(voice.length / 2, voiceFrames(stereo, playback));
  assert.equal(hash(new Uint8Array(voice.buffer)), '60be01a740cf6be97c324663645e6295e7f886787b413a6c66a12f2271de09f7');
  assert.equal(hash(mixPcm([{ frame: 7, velocity: 0.8, pcm: stereo, playback }, { frame: 1000, velocity: 0.5, pcm: stereo, playback: { rate: 3.1, offset: 0 } }], 100).bytes), '8ef4aa955dbdcd138d5e4515e289869a675fd54822b9c9c7d85805e3b4acdf8d');
});

// The V0.5 implementations, kept verbatim as the reference for unperformed voices.
function v05Mix(triggers: PcmTrigger[], minimumFrames: number) {
  const frames = triggers.reduce((end, t) => Math.max(end, t.frame + t.pcm.frames), minimumFrames), sum = new Float64Array(frames * 2);
  for (const { pcm, frame, velocity } of triggers) for (let i = 0; i < pcm.frames; i++) for (let c = 0; c < 2; c++)
    sum[(frame + i) * 2 + c]! += Math.round(pcm.samples[i * pcm.channels + (pcm.channels === 1 ? 0 : c)]! * velocity);
  return encodePcm(Int16Array.from(sum, v => Math.max(-32768, Math.min(32767, v))));
}
function v05Sum(triggers: PcmTrigger[], minimumFrames: number, maximumFrames = Infinity) {
  const frames = Math.min(maximumFrames, triggers.reduce((end, t) => Math.max(end, t.frame + t.pcm.frames), minimumFrames)), sum = new Float64Array(frames * 2);
  for (const { pcm, frame, velocity } of triggers) for (let i = 0; i < Math.min(pcm.frames, frames - frame); i++) for (let c = 0; c < 2; c++)
    sum[(frame + i) * 2 + c]! += Math.round(pcm.samples[i * pcm.channels + (pcm.channels === 1 ? 0 : c)]! * velocity);
  return sum;
}
test('V0.6 compatibility: unperformed voices mix exactly as V0.5; explicit rate 1 at offset 0 equals no playback', () => {
  let state = 12345;
  const next = (n: number) => { state = (state * 1103515245 + 12345) % 2147483648; return state % n; };
  for (let round = 0; round < 25; round++) {
    const triggers: PcmTrigger[] = Array.from({ length: 1 + next(6) }, () => {
      const channels = 1 + next(2) as 1 | 2, frames = 1 + next(400);
      return { frame: next(300), velocity: (1 + next(1000)) / 1000, pcm: pcmOf(Int16Array.from({ length: frames * channels }, () => next(65536) - 32768), channels) };
    });
    const minimum = 1 + next(900);
    assert.deepEqual(mixPcm(triggers, minimum).bytes, v05Mix(triggers, minimum), `round ${round}`);
    assert.deepEqual(sumFloat(triggers, minimum, 500), v05Sum(triggers, minimum, 500));
    const explicit = triggers.map(t => ({ ...t, playback: { rate: 1, offset: 0 } }));
    assert.deepEqual(mixPcm(explicit, minimum).bytes, v05Mix(triggers, minimum));
    assert.deepEqual(sumFloat(explicit, minimum, 500), v05Sum(triggers, minimum, 500));
  }
});
