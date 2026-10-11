// Minimal 16-bit PCM WAV reader for the repository's sound packs (their only format).
import {readFileSync} from 'node:fs';

/** Mono-mixed float samples from a 16-bit PCM WAV (the packs' only format). */
export const readWav = (path: string): {samples: Float32Array; seconds: number; rate: number} => {
  const buf = readFileSync(path);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${path}: not a WAV`);
  let offset = 12;
  let channels = 0;
  let rate = 0;
  let bits = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(body + 2);
      rate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
    } else if (id === 'data') {
      if (bits !== 16) throw new Error(`${path}: expected 16-bit PCM`);
      const frames = Math.floor(size / (2 * channels));
      const samples = new Float32Array(frames);
      for (let f = 0; f < frames; f++) {
        let sum = 0;
        for (let c = 0; c < channels; c++) sum += buf.readInt16LE(body + (f * channels + c) * 2) / 32768;
        samples[f] = sum / channels;
      }
      return {samples, seconds: frames / rate, rate};
    }
    offset = body + size + (size % 2);
  }
  throw new Error(`${path}: no data chunk`);
};
