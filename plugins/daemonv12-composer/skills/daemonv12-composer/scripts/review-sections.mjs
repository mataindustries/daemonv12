#!/usr/bin/env node
// Section evidence only: these measurements do not rank musical quality.
import { open, readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FFT_SIZE = 2048;
const FFT_HOP = FFT_SIZE / 2;
const BAND_NAMES = ['sub', 'lowMid', 'mid', 'upperMid', 'high'];
const BAND_EDGES = [20, 120, 500, 2000, 6000, Infinity];
const USAGE = 'Usage: node review-sections.mjs TRACK.wav SECTIONS.json\nSECTIONS.json: {"sections":[{"name":"opening","start":0,"end":5}]}\nMono/stereo RIFF WAV: PCM 8/16/24/32-bit or IEEE float 32/64-bit.\nBoundaries use the nearest sample; start is inclusive, end exclusive.\nEvidence only; use native DaemonV12 analysis for whole-file metrics.';

function fail(message) { throw new Error(message); }
function rounded(value) {
  if (!Number.isFinite(value)) fail('WAV sample magnitudes exceed the finite analysis range.');
  return Number(value.toPrecision(10));
}
function db(value) { return value > 0 ? rounded(20 * Math.log10(value)) : null; }
function deltaDb(value, reference) {
  return value > 0 && reference > 0 ? rounded(20 * (Math.log10(value) - Math.log10(reference))) : null;
}

async function readExact(file, size, position) {
  const buffer = Buffer.alloc(size);
  let offset = 0;
  while (offset < size) {
    const { bytesRead } = await file.read(buffer, offset, size - offset, position + offset);
    if (!bytesRead) fail('Truncated WAV file.');
    offset += bytesRead;
  }
  return buffer;
}

async function wavInfo(file) {
  const { size } = await file.stat();
  if (size < 12) fail('Expected a RIFF/WAVE file.');
  const header = await readExact(file, 12, 0);
  if (header.toString('ascii', 0, 4) !== 'RIFF' || header.toString('ascii', 8, 12) !== 'WAVE') {
    fail('Expected little-endian RIFF/WAVE; RF64, RIFX and compressed audio are unsupported.');
  }
  const riffEnd = header.readUInt32LE(4) + 8;
  if (riffEnd > size || riffEnd < 12) fail('Invalid or truncated RIFF length.');
  let format;
  let data;
  for (let position = 12; position < riffEnd;) {
    if (position + 8 > riffEnd) fail('Truncated WAV chunk header.');
    const chunk = await readExact(file, 8, position);
    const name = chunk.toString('ascii', 0, 4);
    const length = chunk.readUInt32LE(4);
    const body = position + 8;
    if (body + length > riffEnd) fail(`Truncated WAV ${name} chunk.`);
    if (name === 'fmt ') {
      if (format) fail('Multiple WAV format chunks are unsupported.');
      if (length < 16) fail('Invalid WAV format chunk.');
      const bytes = await readExact(file, Math.min(length, 40), body);
      let tag = bytes.readUInt16LE(0);
      const channels = bytes.readUInt16LE(2);
      const sampleRate = bytes.readUInt32LE(4);
      const byteRate = bytes.readUInt32LE(8);
      const blockAlign = bytes.readUInt16LE(12);
      const bits = bytes.readUInt16LE(14);
      if (tag === 0xfffe) {
        if (length < 40 || bytes.readUInt16LE(16) < 22) fail('Invalid extensible WAV format.');
        const guidTail = Buffer.from('00001000800000aa00389b71', 'hex');
        if (!bytes.subarray(28, 40).equals(guidTail)) fail('Unsupported extensible WAV subformat.');
        tag = bytes.readUInt32LE(24);
        const validBits = bytes.readUInt16LE(18);
        if (!validBits || validBits > bits || (tag === 3 && validBits !== bits)) {
          fail('Invalid extensible WAV bit depth.');
        }
      }
      if (channels !== 1 && channels !== 2) fail('Only mono and stereo WAV files are supported.');
      if (!(tag === 1 && [8, 16, 24, 32].includes(bits)) && !(tag === 3 && [32, 64].includes(bits))) {
        fail('Supported WAV formats: PCM 8/16/24/32-bit and IEEE float 32/64-bit.');
      }
      if (!sampleRate || blockAlign !== channels * bits / 8 || byteRate !== sampleRate * blockAlign) {
        fail('Invalid WAV sample rate or frame alignment.');
      }
      format = { channels, sampleRate, blockAlign, bits, tag };
    } else if (name === 'data') {
      if (data) fail('Multiple WAV data chunks are unsupported.');
      data = { offset: body, bytes: length };
    }
    position = body + length + (length % 2);
    if (position > riffEnd) fail('Missing WAV chunk padding.');
  }
  if (!format || !data) fail('WAV needs both format and data chunks.');
  if (!data.bytes || data.bytes % format.blockAlign) fail('WAV data must contain complete, nonempty frames.');
  return { ...format, ...data, frames: data.bytes / format.blockAlign };
}

function sectionsFor(definition, info) {
  if (!definition || typeof definition !== 'object' || !Array.isArray(definition.sections) || !definition.sections.length) {
    fail('Section JSON must contain a nonempty "sections" array.');
  }
  const names = new Set();
  const duration = info.frames / info.sampleRate;
  return definition.sections.map((section, index) => {
    if (!section || typeof section !== 'object') fail(`Section ${index + 1} must be an object.`);
    const { name, start, end } = section;
    if (typeof name !== 'string' || !name.trim() || names.has(name)) fail('Section names must be nonempty, unique strings.');
    names.add(name);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > duration + 1e-9) {
      fail(`Section "${name}" needs finite times with 0 <= start < end <= WAV duration (${rounded(duration)}s).`);
    }
    const startFrame = Math.round(start * info.sampleRate);
    const endFrame = Math.min(info.frames, Math.round(end * info.sampleRate));
    if (endFrame <= startFrame) fail(`Section "${name}" contains no frames after sample alignment.`);
    return { name, startFrame, endFrame };
  });
}

function sampleAt(buffer, offset, info) {
  let value;
  if (info.tag === 3) value = info.bits === 32 ? buffer.readFloatLE(offset) : buffer.readDoubleLE(offset);
  else if (info.bits === 8) value = (buffer.readUInt8(offset) - 128) / 128;
  else value = buffer.readIntLE(offset, info.bits / 8) / (2 ** (info.bits - 1));
  if (!Number.isFinite(value) || !Number.isFinite(value * value)) fail('WAV contains nonfinite or unrepresentable floating-point samples.');
  return value;
}

function fft(real, imaginary) {
  const size = real.length;
  for (let index = 1, reversed = 0; index < size; index++) {
    let bit = size >> 1;
    for (; reversed & bit; bit >>= 1) reversed ^= bit;
    reversed ^= bit;
    if (index < reversed) {
      [real[index], real[reversed]] = [real[reversed], real[index]];
      [imaginary[index], imaginary[reversed]] = [imaginary[reversed], imaginary[index]];
    }
  }
  for (let length = 2; length <= size; length *= 2) {
    const angle = -2 * Math.PI / length;
    for (let start = 0; start < size; start += length) {
      for (let offset = 0; offset < length / 2; offset++) {
        const cosine = Math.cos(angle * offset);
        const sine = Math.sin(angle * offset);
        const even = start + offset;
        const odd = even + length / 2;
        const realOdd = real[odd] * cosine - imaginary[odd] * sine;
        const imaginaryOdd = real[odd] * sine + imaginary[odd] * cosine;
        real[odd] = real[even] - realOdd;
        imaginary[odd] = imaginary[even] - imaginaryOdd;
        real[even] += realOdd;
        imaginary[even] += imaginaryOdd;
      }
    }
  }
}

function bandDefinitions(sampleRate) {
  const nyquist = sampleRate / 2;
  return BAND_NAMES.map((name, index) => ({
    name,
    lowHz: Math.min(BAND_EDGES[index], nyquist),
    highHz: Math.min(BAND_EDGES[index + 1], nyquist),
    available: BAND_EDGES[index] < nyquist,
  }));
}

function bandEnergies(previous, current, sampleRate) {
  const real = new Float64Array(FFT_SIZE);
  const imaginary = new Float64Array(FFT_SIZE);
  for (let index = 0; index < FFT_SIZE; index++) {
    // sqrt(periodic Hann); half-window overlap makes squared weights sum to 1.
    const weight = Math.sin(Math.PI * index / FFT_SIZE);
    real[index] = (index < FFT_HOP ? previous[index] : current[index - FFT_HOP]) * weight;
  }
  fft(real, imaginary);
  const powers = BAND_NAMES.map(() => 0);
  for (let bin = 0; bin <= FFT_SIZE / 2; bin++) {
    const frequency = bin * sampleRate / FFT_SIZE;
    const band = BAND_EDGES.findIndex((edge, index) => index < BAND_NAMES.length && frequency >= edge && frequency < BAND_EDGES[index + 1]);
    if (band < 0) continue;
    const doubled = bin === 0 || bin === FFT_SIZE / 2 ? 1 : 2;
    // Parseval gives windowed energy. Coverage normalization happens once per section.
    powers[band] += doubled * (real[bin] ** 2 + imaginary[bin] ** 2) / FFT_SIZE;
  }
  return powers;
}

async function measureSection(file, info, section) {
  const frames = section.endFrame - section.startFrame;
  let squares = 0;
  let peak = 0;
  let stereoCount = 0;
  let leftMean = 0;
  let rightMean = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  let covariance = 0;
  let midSquares = 0;
  let sideSquares = 0;
  const powers = BAND_NAMES.map(() => 0);
  let previousChannels = Array.from({ length: info.channels }, () => new Float64Array(FFT_HOP));
  const activityFrames = Math.max(1, Math.round(info.sampleRate * 0.01));
  let activitySquares = 0;
  let activityCount = 0;
  let previousActivityRms = null;
  let rises = 0;
  function activityBlock() {
    const rms = Math.sqrt(activitySquares / (activityCount * info.channels));
    if (previousActivityRms !== null && rms > 0.001 && rms > previousActivityRms * 10 ** (6 / 20)) rises++;
    previousActivityRms = rms;
    activitySquares = 0;
    activityCount = 0;
  }
  for (let start = section.startFrame; start < section.endFrame; start += FFT_HOP) {
    const count = Math.min(FFT_HOP, section.endFrame - start);
    const bytes = await readExact(file, count * info.blockAlign, info.offset + start * info.blockAlign);
    const channels = Array.from({ length: info.channels }, () => new Float64Array(FFT_HOP));
    for (let frame = 0; frame < count; frame++) {
      for (let channel = 0; channel < info.channels; channel++) {
        const sample = sampleAt(bytes, frame * info.blockAlign + channel * info.bits / 8, info);
        channels[channel][frame] = sample;
        squares += sample * sample;
        activitySquares += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
      }
      if (info.channels === 2) {
        const left = channels[0][frame];
        const right = channels[1][frame];
        stereoCount++;
        const leftDelta = left - leftMean;
        const rightDelta = right - rightMean;
        leftMean += leftDelta / stereoCount;
        rightMean += rightDelta / stereoCount;
        leftVariance += leftDelta * (left - leftMean);
        rightVariance += rightDelta * (right - rightMean);
        covariance += leftDelta * (right - rightMean);
        midSquares += ((left + right) / 2) ** 2;
        sideSquares += ((left - right) / 2) ** 2;
      }
      if (++activityCount === activityFrames) activityBlock();
    }
    for (let channel = 0; channel < info.channels; channel++) {
      const windowEnergies = bandEnergies(previousChannels[channel], channels[channel], info.sampleRate);
      for (let band = 0; band < powers.length; band++) powers[band] += windowEnergies[band];
    }
    previousChannels = channels;
  }
  // Include the final padded half-window, completing unit coverage of the last samples.
  const padding = new Float64Array(FFT_HOP);
  for (const channel of previousChannels) {
    const windowEnergies = bandEnergies(channel, padding, info.sampleRate);
    for (let band = 0; band < powers.length; band++) powers[band] += windowEnergies[band];
  }
  if (activityCount) activityBlock();
  const duration = frames / info.sampleRate;
  const rms = Math.sqrt(squares / (frames * info.channels));
  const bandRms = Object.fromEntries(bandDefinitions(info.sampleRate).map(({ name, available }, index) => [name, available ? rounded(Math.sqrt(powers[index] / (frames * info.channels))) : null]));
  const result = {
    name: section.name,
    start: rounded(section.startFrame / info.sampleRate),
    end: rounded(section.endFrame / info.sampleRate),
    duration: rounded(duration),
    rms: rounded(rms), peak: rounded(peak), rmsDbfs: db(rms), peakDbfs: db(peak),
    bandRms,
    activity: { rmsRisesPerSecond: rounded(rises / duration) },
  };
  if (info.channels === 2) {
    const denominator = Math.sqrt(Math.max(0, leftVariance)) * Math.sqrt(Math.max(0, rightVariance));
    result.stereo = {
      correlation: denominator > 0 ? rounded(Math.max(-1, Math.min(1, covariance / denominator))) : null,
      midRms: rounded(Math.sqrt(midSquares / frames)),
      sideRms: rounded(Math.sqrt(sideSquares / frames)),
      sideEnergyFraction: midSquares + sideSquares > 0 ? rounded(sideSquares / (midSquares + sideSquares)) : 0,
    };
  }
  return result;
}

/** Analyze bounded sections without importing or changing the DaemonV12 engine. */
export async function reviewSections(wavPath, definition) {
  const file = await open(wavPath, 'r');
  try {
    const info = await wavInfo(file);
    const sections = sectionsFor(definition, info);
    const measurements = [];
    for (const section of sections) measurements.push(await measureSection(file, info, section));
    const reference = measurements[0];
    for (const section of measurements) {
      section.relativeToFirst = {
        rmsDb: deltaDb(section.rms, reference.rms),
        peakDb: deltaDb(section.peak, reference.peak),
        bandDb: Object.fromEntries(BAND_NAMES.map(name => [name, deltaDb(section.bandRms[name], reference.bandRms[name])])),
      };
      if (section.stereo) section.relativeToFirst.sideEnergyFractionDelta = rounded(section.stereo.sideEnergyFraction - reference.stereo.sideEnergyFraction);
    }
    return {
      wav: { sampleRate: info.sampleRate, channels: info.channels, duration: rounded(info.frames / info.sampleRate) },
      method: {
        fftFrames: FFT_SIZE, fftHopFrames: FFT_HOP,
        window: 'sqrt-periodic-Hann, padded boundaries, unit squared-weight coverage',
        bands: bandDefinitions(info.sampleRate),
        activityWindowMs: 10, rmsRiseDb: 6, rmsRiseFloorDbfs: -60,
        comparisonReference: reference.name,
        note: 'Approximate section evidence, not musical quality. Correlation and side energy do not prove stereo arrangement or device translation.',
      },
      sections: measurements,
    };
  } finally {
    await file.close();
  }
}

function isMainModule() {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && ['--help', '-h'].includes(args[0])) console.log(USAGE);
    else {
      if (args.length !== 2) fail(USAGE);
      let definition;
      try { definition = JSON.parse(await readFile(args[1], 'utf8')); }
      catch (error) { fail(`Cannot read section JSON: ${error.message}`); }
      console.log(JSON.stringify(await reviewSections(args[0], definition), null, 2));
    }
  } catch (error) {
    console.error(`review-sections: ${error.message}`);
    process.exitCode = 1;
  }
}
