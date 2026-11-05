import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareAudio } from '../scripts/verify-sodium-production24.ts';

function wav(bits: 16 | 24, frames: number, value: (frame: number, channel: number) => number) {
  const width = bits / 8, bytes = Buffer.alloc(44 + frames * 2 * width);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(44100, 24); bytes.writeUInt32LE(44100 * 2 * width, 28);
  bytes.writeUInt16LE(2 * width, 32); bytes.writeUInt16LE(bits, 34); bytes.write('data', 36);
  bytes.writeUInt32LE(frames * 2 * width, 40);
  for (let f = 0; f < frames; f++) for (let c = 0; c < 2; c++) bytes.writeIntLE(value(f, c), 44 + (f * 2 + c) * width, width);
  return bytes;
}
const noise = (frame: number) => {
  let x = (frame + 1) | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return (x % 20001) - 10000;
};
test('A/B measures exact normalized PCM16/24 identity and one-step residual', () => {
  const original = wav(16, 4096, f => noise(f));
  const exact = wav(24, 4096, f => noise(f) * 256);
  const same = compareAudio(original, exact);
  assert.equal(same.residual.changedSamples, 0); assert.equal(same.residual.rmsDbfs, null);
  assert.equal(same.alignment.bestLagFrames, 0); assert.equal(same.alignment.fullLengthZeroLagCorrelation, 1);
  const shiftedPrecision = wav(24, 4096, f => noise(f) * 256 + 1);
  const detail = compareAudio(original, shiftedPrecision);
  assert.equal(detail.residual.changedSamples, 8192);
  assert.ok(Math.abs(detail.residual.peakDbfs! - 20 * Math.log10(1 / 8388608)) < 1e-8);
  assert.equal(detail.candidate.nonzeroLowBytes, 8192);
});
test('A/B lag search detects delay and stereo cancellation without correcting it', () => {
  const original = wav(16, 4096, (f, c) => noise(f) * (c ? -1 : 1));
  const delayed = wav(24, 4096, (f, c) => (f < 4 ? 0 : noise(f - 4)) * 256 * (c ? -1 : 1));
  const comparison = compareAudio(original, delayed);
  assert.equal(comparison.alignment.bestLagFrames, 4);
  assert.ok(comparison.residual.changedSamples > 0);
  assert.equal(comparison.original.stereoCorrelation, -1);
  assert.equal(comparison.original.monoFoldChangeDb, null);
});
