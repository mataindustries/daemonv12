import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, after } from 'node:test';
import { reviewSections } from './review-sections.mjs';

// All audio is generated here. No benchmark or production audio is used.
const directory = await mkdtemp(join(tmpdir(), 'composer-section-tests-'));
after(() => rm(directory, { recursive: true, force: true }));
let fixtureNumber = 0;

async function fixture({ sampleRate = 48000, channels = 1, frames = sampleRate, bits = 32, tag = 3, extensible = false, sample = () => 0 } = {}) {
  const formatBytes = extensible ? 40 : 16;
  const blockAlign = channels * bits / 8;
  const dataBytes = frames * blockAlign;
  const dataOffset = 12 + 8 + formatBytes + 8;
  const wav = Buffer.alloc(dataOffset + dataBytes + dataBytes % 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(formatBytes, 16);
  wav.writeUInt16LE(extensible ? 0xfffe : tag, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * blockAlign, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(bits, 34);
  if (extensible) {
    wav.writeUInt16LE(22, 36);
    wav.writeUInt16LE(bits, 38);
    wav.writeUInt32LE(channels === 1 ? 4 : 3, 40);
    wav.writeUInt32LE(tag, 44);
    Buffer.from('00001000800000aa00389b71', 'hex').copy(wav, 48);
  }
  wav.write('data', dataOffset - 8);
  wav.writeUInt32LE(dataBytes, dataOffset - 4);
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const value = sample(frame / sampleRate, channel, frame);
      const offset = dataOffset + frame * blockAlign + channel * bits / 8;
      if (tag === 3) {
        if (bits === 32) wav.writeFloatLE(value, offset);
        else wav.writeDoubleLE(value, offset);
      } else if (bits === 8) wav.writeUInt8(Math.max(0, Math.min(255, Math.round(value * 128 + 128))), offset);
      else wav.writeIntLE(Math.max(-(2 ** (bits - 1)), Math.min(2 ** (bits - 1) - 1, Math.round(value * 2 ** (bits - 1)))), offset, bits / 8);
    }
  }
  const path = join(directory, `fixture-${fixtureNumber++}.wav`);
  await writeFile(path, wav);
  return { path, wav };
}

function definition(...sections) { return { sections }; }
function finiteTree(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `Nonfinite number: ${value}`);
  else if (Array.isArray(value)) value.forEach(finiteTree);
  else if (value && typeof value === 'object') Object.values(value).forEach(finiteTree);
}
function near(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}

test('section boundaries are sample-aligned, end-exclusive, bounded and deterministic', async () => {
  const { path } = await fixture({ sampleRate: 1000, frames: 300, sample: (_time, _channel, frame) => frame < 100 ? 0.1 : frame < 200 ? 0.4 : 0 });
  const input = definition({ name: 'quiet', start: 0, end: 0.1 }, { name: 'loud', start: 0.1002, end: 0.1998 }, { name: 'silent', start: 0.2, end: 0.3 });
  const result = await reviewSections(path, input);
  assert.deepEqual(await reviewSections(path, input), result);
  const [quiet, loud, silent] = result.sections;
  near(quiet.rms, 0.1);
  near(loud.start, 0.1);
  near(loud.end, 0.2);
  near(loud.duration, 0.1);
  near(loud.rms, 0.4);
  near(loud.relativeToFirst.rmsDb, 20 * Math.log10(4));
  assert.equal(silent.rms, 0);
  assert.equal(silent.peakDbfs, null);
  assert.equal(silent.relativeToFirst.rmsDb, null);
  assert.ok(!('stereo' in quiet));
  finiteTree(result);
});

test('mono silence has finite zeros and undefined logarithms', async () => {
  const { path } = await fixture();
  const result = await reviewSections(path, definition({ name: 'silence', start: 0, end: 1 }));
  const [section] = result.sections;
  assert.equal(section.rms, 0);
  assert.equal(section.peak, 0);
  assert.equal(section.rmsDbfs, null);
  assert.deepEqual(Object.values(section.bandRms), [0, 0, 0, 0, 0]);
  assert.equal(section.activity.rmsRisesPerSecond, 0);
  finiteTree(result);
});

test('equal-level bass, low-mid and bright fixtures occupy different approximate bands', async () => {
  const { path } = await fixture({ frames: 144000, sample: time => 0.3 * Math.sin(2 * Math.PI * (time < 1 ? 80 : time < 2 ? 250 : 8000) * time) });
  const result = await reviewSections(path, definition({ name: 'bass', start: 0, end: 1 }, { name: 'body', start: 1, end: 2 }, { name: 'bright', start: 2, end: 3 }));
  const [bass, body, bright] = result.sections;
  near(bass.rms, bright.rms, 0.00001);
  assert.ok(bass.bandRms.sub > bass.bandRms.high * 100);
  // Coarse bands allow window/boundary leakage; require clear separation, not analyzer-grade rejection.
  assert.ok(body.bandRms.lowMid > body.bandRms.sub * 20);
  assert.ok(bright.bandRms.high > bright.bandRms.sub * 100);
  assert.ok(bright.relativeToFirst.bandDb.high > 60);
  finiteTree(result);
});

test('FFT block edges and section boundaries retain the same impulse energy as block centers', async () => {
  const attacks = new Set([0, 2048, 5120, 7168]);
  const { path } = await fixture({ frames: 8192, sample: (_time, _channel, frame) => attacks.has(frame) ? 0.5 : 0 });
  const result = await reviewSections(path, definition({ name: 'edges', start: 0, end: 4096 / 48000 }, { name: 'centers', start: 4096 / 48000, end: 8192 / 48000 }));
  const [edges, centers] = result.sections;
  near(edges.rms, centers.rms);
  assert.equal(edges.peak, centers.peak);
  for (const name of Object.keys(edges.bandRms)) {
    assert.ok(edges.bandRms[name] > 0, `${name} loses edge impulses`);
    near(edges.bandRms[name], centers.bandRms[name], 1e-10);
    near(centers.relativeToFirst.bandDb[name], 0, 1e-6);
  }
  finiteTree(result);
});

test('first, internal and final samples have equal spectral coverage in partial windows', async () => {
  const length = 2051;
  const attacks = new Set([0, length + 2048, 3 * length - 1]);
  const { path } = await fixture({ frames: 3 * length, sample: (_time, _channel, frame) => attacks.has(frame) ? 0.5 : 0 });
  const input = definition(...['first', 'internal', 'last'].map((name, index) => ({ name, start: index * length / 48000, end: (index + 1) * length / 48000 })));
  const result = await reviewSections(path, input);
  for (const section of result.sections) {
    for (const name of Object.keys(section.bandRms)) near(section.bandRms[name], result.sections[0].bandRms[name], 1e-10);
  }
  finiteTree(result);
});

test('low-rate WAV reports clipped available bands and null for bands above Nyquist', async () => {
  const { path } = await fixture({ sampleRate: 8000, sample: time => 0.2 * Math.sin(2 * Math.PI * 1500 * time) });
  const result = await reviewSections(path, definition({ name: 'tone', start: 0, end: 1 }));
  assert.deepEqual(result.method.bands, [
    { name: 'sub', lowHz: 20, highHz: 120, available: true },
    { name: 'lowMid', lowHz: 120, highHz: 500, available: true },
    { name: 'mid', lowHz: 500, highHz: 2000, available: true },
    { name: 'upperMid', lowHz: 2000, highHz: 4000, available: true },
    { name: 'high', lowHz: 4000, highHz: 4000, available: false },
  ]);
  assert.equal(result.sections[0].bandRms.high, null);
  assert.equal(result.sections[0].relativeToFirst.bandDb.high, null);
  const silent = await fixture({ sampleRate: 1000 });
  const silentResult = await reviewSections(silent.path, definition({ name: 'silent', start: 0, end: 1 }));
  assert.equal(silentResult.sections[0].bandRms.mid, null);
  assert.equal(silentResult.sections[0].bandRms.sub, 0);
  finiteTree(result);
  finiteTree(silentResult);
});

test('activity measures strong short-window rises without claiming onset quality', async () => {
  const { path } = await fixture({ sample: time => Math.floor(time * 10) % 2 ? 0.2 : 0 });
  const result = await reviewSections(path, definition({ name: 'pulses', start: 0, end: 1 }));
  assert.equal(result.sections[0].activity.rmsRisesPerSecond, 5);
  finiteTree(result);
});

test('stereo identical, decorrelated and anti-phase content produce distinct width evidence', async () => {
  const { path } = await fixture({ channels: 2, frames: 144000, sample: (time, channel) => {
    if (time < 1) return 0.2 * Math.sin(2 * Math.PI * 440 * time);
    if (time < 2) return 0.2 * Math.sin(2 * Math.PI * (channel ? 660 : 440) * time);
    return (channel ? -1 : 1) * 0.2 * Math.sin(2 * Math.PI * 440 * time);
  } });
  const result = await reviewSections(path, definition({ name: 'same', start: 0, end: 1 }, { name: 'different', start: 1, end: 2 }, { name: 'antiphase', start: 2, end: 3 }));
  const [same, different, antiphase] = result.sections.map(section => section.stereo);
  near(same.correlation, 1);
  assert.equal(same.sideRms, 0);
  near(different.correlation, 0);
  near(different.sideEnergyFraction, 0.5);
  near(antiphase.correlation, -1);
  assert.equal(antiphase.midRms, 0);
  assert.equal(antiphase.sideEnergyFraction, 1);
  finiteTree(result);
});

test('balance alone increases side fraction without decorrelation; empty channels give null correlation', async () => {
  const { path } = await fixture({ channels: 2, frames: 96000, sample: (time, channel) => (channel ? (time < 1 ? 0.5 : 0) : 1) * 0.2 * Math.sin(2 * Math.PI * 440 * time) });
  const result = await reviewSections(path, definition({ name: 'unbalanced', start: 0, end: 1 }, { name: 'hard-left', start: 1, end: 2 }));
  near(result.sections[0].stereo.correlation, 1);
  assert.ok(result.sections[0].stereo.sideEnergyFraction > 0);
  assert.equal(result.sections[1].stereo.correlation, null);
  near(result.sections[1].stereo.sideEnergyFraction, 0.5);
  const silent = await fixture({ channels: 2 });
  const silentResult = await reviewSections(silent.path, definition({ name: 'silent', start: 0, end: 1 }));
  assert.equal(silentResult.sections[0].stereo.correlation, null);
  assert.equal(silentResult.sections[0].stereo.sideEnergyFraction, 0);
  finiteTree(result);
  finiteTree(silentResult);
});

test('PCM depths, floating point and extensible WAV decode consistently', async () => {
  for (const [tag, bits, extensible, channels] of [[1, 8, false, 1], [1, 16, false, 1], [1, 16, false, 2], [1, 24, true, 1], [1, 32, false, 1], [3, 32, true, 1], [3, 64, false, 1]]) {
    const { path } = await fixture({ tag, bits, extensible, channels, frames: 4800, sample: () => 0.25 });
    const result = await reviewSections(path, definition({ name: 'constant', start: 0, end: 0.1 }));
    near(result.sections[0].rms, 0.25);
    near(result.sections[0].peak, 0.25);
    if (channels === 2) assert.equal(result.sections[0].stereo.correlation, null);
    finiteTree(result);
  }
  const padded = await fixture({ tag: 1, bits: 8, frames: 1 });
  finiteTree(await reviewSections(padded.path, definition({ name: 'one-frame', start: 0, end: 1 / 48000 })));
});

test('malformed definitions and out-of-range boundaries fail clearly', async () => {
  const { path } = await fixture();
  const bad = [null, {}, { sections: [] }, definition(null), definition({ name: '', start: 0, end: 1 }), definition({ name: 'x', start: -1, end: 1 }), definition({ name: 'x', start: 1, end: 0 }), definition({ name: 'x', start: 0, end: 2 }), definition({ name: 'x', start: '0', end: 1 }), definition({ name: 'x', start: 0, end: Infinity }), definition({ name: 'x', start: 0, end: 1e-10 }), definition({ name: 'x', start: 0, end: 1 }, { name: 'x', start: 0, end: 1 })];
  for (const input of bad) await assert.rejects(reviewSections(path, input), /Section|section/);
});

test('malformed/unsupported WAV and nonfinite samples fail without invalid JSON numbers', async () => {
  const brokenPath = join(directory, 'broken.wav');
  await writeFile(brokenPath, Buffer.from('not a wav'));
  await assert.rejects(reviewSections(brokenPath, definition({ name: 'x', start: 0, end: 1 })), /RIFF/);
  const normal = await fixture();
  const truncatedPath = join(directory, 'truncated.wav');
  await writeFile(truncatedPath, normal.wav.subarray(0, 100));
  await assert.rejects(reviewSections(truncatedPath, definition({ name: 'x', start: 0, end: 1 })), /truncated/i);
  const multichannel = await fixture({ channels: 3 });
  await assert.rejects(reviewSections(multichannel.path, definition({ name: 'x', start: 0, end: 1 })), /mono and stereo/);
  for (const value of [NaN, Infinity, -Infinity, 1e300]) {
    const invalid = await fixture({ bits: 64, sample: () => value });
    await assert.rejects(reviewSections(invalid.path, definition({ name: 'x', start: 0, end: 1 })), /nonfinite|finite analysis/);
  }
});

test('CLI emits JSON on success, clear errors on failure and a small help message', async () => {
  const { path } = await fixture({ frames: 4800 });
  const sectionPath = join(directory, 'sections.json');
  await writeFile(sectionPath, JSON.stringify(definition({ name: 'x', start: 0, end: 0.1 })));
  const script = fileURLToPath(new URL('./review-sections.mjs', import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  const success = run(path, sectionPath);
  assert.equal(success.status, 0, success.stderr);
  finiteTree(JSON.parse(success.stdout));
  const badJson = join(directory, 'bad.json');
  await writeFile(badJson, '{oops');
  const failure = run(path, badJson);
  assert.equal(failure.status, 1);
  assert.equal(failure.stdout, '');
  assert.match(failure.stderr, /review-sections: Cannot read section JSON/);
  assert.equal(run(path).status, 1);
  assert.equal(run('--help').status, 0);
});
