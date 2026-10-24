import { readWavInfo } from './wav.ts';

// Exact frame-byte extraction, preserving PCM format (including historical PCM24).
// This is independent of sample playback and never resamples or processes a master.
export function extractWavFrames(input: Uint8Array, start: number, end: number): Buffer {
  const parsed = readWavInfo(input);
  if (!parsed.ok) throw new RangeError(parsed.error);
  const info = parsed.info;
  if (info.formatTag !== 1 || ![8, 16, 24, 32].includes(info.bitsPerSample))
    throw new RangeError('Expected integer PCM WAV (8, 16, 24 or 32 bits).');
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end > info.frames)
    throw new RangeError(`Use integer sample offsets 0 <= start < end <= ${info.frames}; end is exclusive.`);
  const stride = info.channels * info.bitsPerSample / 8;
  const data = input.subarray(info.dataOffset + start * stride, info.dataOffset + end * stride);
  const bytes = Buffer.alloc(44 + data.length + data.length % 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(info.channels, 22);
  bytes.writeUInt32LE(info.sampleRate, 24); bytes.writeUInt32LE(info.sampleRate * stride, 28);
  bytes.writeUInt16LE(stride, 32); bytes.writeUInt16LE(info.bitsPerSample, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(data.length, 40); bytes.set(data, 44);
  return bytes;
}
