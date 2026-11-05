import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compileScore, synthesize, monoWav, validatePerformance, type Performance, type Score } from '../scripts/generate-westghost.ts';
import { referencePerformances } from '../scripts/westghost-scores.ts';
import { SR, frequency } from '../scripts/westghost-dsp.ts';
import { pitchTrack } from '../scripts/inspect-v12-signature.ts';
import { compileProjectFile, runCommand } from '../src/pipeline.ts';
import { ticksToFrames, usPerQuarter } from '../src/timing/musical-time.ts';
const energy = (x: Float64Array) => x.reduce((n, v) => n + v * v, 0);
const sha = (x: Uint8Array) => createHash('sha256').update(x).digest('hex');

test('WEST//GHOST references reproduce committed PCM and catalog; all sources are mono with silent edges and fixed headroom', () => {
  const catalog = JSON.parse(readFileSync('packs/westghost-001/westghost001.catalog.json', 'utf8'));
  assert.equal(catalog.license, 'pending-owner-declaration');
  for (const sound of catalog.sounds) {
    const samples = synthesize(referencePerformances[sound.id]!); const bytes = monoWav(samples);
    assert.equal(sha(bytes), sound.sha256, sound.id);
    assert.deepEqual(bytes, readFileSync(join('packs/westghost-001', sound.file)));
    assert.equal(bytes.readUInt16LE(22), 1, 'native source is mono');
    assert.ok(samples[0] === 0); assert.ok(samples.at(-1) === 0);
    assert.ok(sound.peakDbfs < -5); assert.ok(sound.rmsDbfs > -35);
  }
});

test('WEST//GHOST arbitrary native pitch keeps gate/duration independent and replay deterministic', () => {
  for (const [instrument, a, b] of [['gravity', 26, 45], ['vandal', 38, 55], ['apparition', 50, 74], ['iron-bloom', 38, 74]] as const) {
    const p: Performance = { instrument, note: a, gate: 0.6, release: 0.15, seed: 123 };
    const first = synthesize(p), second = synthesize(p), high = synthesize({ ...p, note: b });
    assert.deepEqual(first, second); assert.equal(first.length, high.length);
    assert.equal(first.length, Math.round(0.75 * SR));
    assert.notDeepEqual(first, high); assert.equal(first[0], 0); assert.equal(first.at(-1), 0);
  }
});

test('WEST//GHOST range endpoints and both articulations retain finite headroom at maximum control values', () => {
  for (const [instrument, range, arts] of [
    ['gravity', [24, 60], ['sustain', 'impact']], ['vandal', [28, 64], ['sustain', 'bite']],
    ['apparition', [48, 84], ['sustain', 'whisper']], ['iron-bloom', [36, 84], ['strike', 'bow']],
  ] as const) for (const note of range) for (const articulation of arts) for (const timbre of [0, 1]) {
    const samples = synthesize({ instrument, note, articulation, gate: 0.1, release: 0.01, velocity: 1,
      expression: [{ time: 0, value: 1 }], timbre: [{ time: 0, value: timbre }],
      motion: [{ time: 0, value: 1 }], breath: [{ time: 0, value: 1 }] });
    assert.ok(samples.every(v => Number.isFinite(v) && Math.abs(v) < 0.95));
  }
});

test('WEST//GHOST controls affect sustained synthesis, pressure and articulation rather than only the onset', () => {
  for (const [instrument, note] of [['gravity', 38], ['vandal', 38], ['apparition', 62], ['iron-bloom', 50]] as const) {
    const p: Performance = { instrument, note, gate: 1.2, release: 0.2, ...(instrument === 'iron-bloom' ? { articulation: 'bow' } : {}) };
    const base = synthesize(p), moving = synthesize({ ...p, timbre: [{ time: 0, value: 0.05 }, { time: 1.2, value: 0.95 }] });
    const quiet = synthesize({ ...p, expression: [{ time: 0, value: 0.1 }] });
    assert.ok(energy(base.slice(Math.round(0.8 * SR), SR)) > 0.1, `${instrument}: held interior remains active`);
    assert.ok(energy(moving.map((v, i) => v - base[i]!)) / energy(base) > 0.002, `${instrument}: moving timbre changes source`);
    assert.ok(energy(quiet) < 0.4 * energy(base), `${instrument}: pressure changes energy`);
  }
});

test('GRAVITY phase-continuous slides preserve a stable native target pitch', () => {
  for (const note of [26, 38, 50]) {
    const samples = synthesize({ instrument: 'gravity', note, gate: 1.8, release: 0.1, timbre: [{ time: 0, value: 0.4 }] });
    const pitch = pitchTrack(samples, frequency(note), 0.3, 1.6);
    assert.ok(pitch.windows > 1); assert.ok(Math.abs(pitch.medianCents!) < 0.3, JSON.stringify({ note, pitch }));
  }
  const pitch = [{ time: 0, value: 26 }, { time: 0.6, value: 26 }, { time: 1, value: 38 }, { time: 1.8, value: 38 }];
  const slide = synthesize({ instrument: 'gravity', note: 26, gate: 1.8, release: 0.1, pitch });
  const landed = pitchTrack(slide, frequency(38), 1.15, 1.75);
  assert.ok(Math.abs(landed.medianCents!) < 0.3, JSON.stringify(landed));
});

test('WEST//GHOST fails unsupported controls and unsafe processing requests before output', t => {
  const base: Performance = { instrument: 'gravity', note: 38, gate: 0.5 };
  for (const update of [{ gate: 31 }, { release: 6 }, { note: 12 }, { seed: -1 }, { articulation: 'invented' }, { timbre: [{ time: 0, value: 1.1 }] }, { pitch: [{ time: 0.4, value: 38 }, { time: 0.2, value: 40 }] }, { breath: [{ time: 2, value: 0.5 }] }, { wrongField: 1 }]) assert.throws(() => validatePerformance({ ...base, ...update } as Performance));
  const root = mkdtempSync(join(tmpdir(), 'westghost-invalid-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const tempo = usPerQuarter(137), end = ticksToFrames(3840, tempo), start = ticksToFrames(15 * 240, tempo);
  const overrun: Score = { id: 'overrun', title: 'boundary', description: '', bars: 1, bpm: 137, tracks: [{ id: 'sub', gainDb: 0, events: [{ step: 15, performance: { ...base, gate: (end - start + 0.6) / SR - 0.01, release: 0.01 } }] }] };
  assert.throws(() => compileScore(overrun, root), /release exceeds/);
  assert.deepEqual(readdirSync(root), [], 'complete preflight occurs before any writes');
  for (const title of ['', ' '.repeat(3), 'x'.repeat(201), null]) {
    assert.throws(() => compileScore({ ...overrun, title } as Score, root), /title/);
    assert.deepEqual(readdirSync(root), []);
  }
  const enormous = structuredClone(overrun); enormous.bpm = 40; enormous.bars = 64; enormous.tracks[0]!.events = Array.from({ length: 21 }, (_, k) => ({ step: k, performance: { ...base, gate: 30, seed: k } }));
  assert.throws(() => compileScore(enormous, root), /600 seconds/);
  assert.deepEqual(readdirSync(root), []);
});

test('WEST//GHOST compiler produces existing v0.7 projects, with portable deterministic sampler playback', async t => {
  const root = mkdtempSync(join(tmpdir(), 'westghost-portable-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const score: Score = { id: 'portable', title: 'native', description: '', bpm: 120, bars: 1, tracks: [{ id: 'voice', gainDb: -3, events: [{ step: 0, performance: { instrument: 'gravity', note: 38, gate: 0.3, release: 0.1 } }, { step: 5, performance: { instrument: 'gravity', note: 45, gate: 0.6, release: 0.1 } }] }] };
  const { project } = compileScore(score, root), file = join(root, 'portable.json');
  assert.deepEqual(compileProjectFile(file).diagnostics, []);
  // Portable sample sources also work on the existing Node-only route.
  const raw = structuredClone(project) as any; delete raw.render; for (const track of raw.tracks) delete track.mix;
  writeFileSync(file, JSON.stringify(raw));
  const a = await runCommand('render', file, { outDir: join(root, 'a'), env: {} });
  const b = await runCommand('render', file, { outDir: join(root, 'b'), env: {} });
  assert.equal(a.exitCode, 0, JSON.stringify(a.diagnostics)); assert.equal(b.exitCode, 0, JSON.stringify(b.diagnostics));
  assert.deepEqual(readFileSync(a.result.artifacts.wav!), readFileSync(b.result.artifacts.wav!));
  assert.equal((a.result.manifest as any).mix.clippedSamples, 0);
});
