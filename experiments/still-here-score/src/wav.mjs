// Minimal WAV IO. Engine assets must be RIFF PCM16, 44.1 kHz, mono or stereo (docs/V0_2_SAMPLES.md);
// they are written without dither so a rerender is byte-identical. Masters are written by
// lib/dsp.mjs encodeWav (24-bit). readWav accepts the PCM16/24 files the engine and master write.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const RATE = 44100;

/** chans: [Float64Array] (mono) or [L, R]; values in [-1, 1]. Refuses to clip. */
export function writePcm16(path, chans, label = path) {
  const n = chans[0].length, c = chans.length, buf = Buffer.alloc(44 + n * c * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * c * 2, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(c, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * c * 2, 28); buf.writeUInt16LE(c * 2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * c * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) {
    const v = chans[k][i];
    if (!Number.isFinite(v)) throw new RangeError(`${label}: non-finite sample at ${i}`);
    if (Math.abs(v) > 1) throw new RangeError(`${label}: sample ${i} exceeds full scale (${v.toFixed(3)})`);
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), o); o += 2;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  return buf;
}

/** Returns { rate, channels: [Float64Array...], frames, bits }. */
export function readWav(path) {
  const b = readFileSync(path);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${path}: not RIFF/WAVE`);
  let p = 12, fmt = null, data = null;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { tag: b.readUInt16LE(p + 8), channels: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') data = { start: p + 8, size };
    p += 8 + size + (size & 1);
  }
  if (!fmt || !data || fmt.tag !== 1) throw new Error(`${path}: expected PCM`);
  const bytes = fmt.bits / 8, frames = data.size / (bytes * fmt.channels), ch = Array.from({ length: fmt.channels }, () => new Float64Array(frames));
  const full = fmt.bits === 24 ? 8388608 : 32768;
  for (let i = 0, o = data.start; i < frames; i++) for (let k = 0; k < fmt.channels; k++, o += bytes)
    ch[k][i] = (fmt.bits === 24 ? b.readIntLE(o, 3) : b.readInt16LE(o)) / full;
  return { rate: fmt.rate, channels: ch, frames, bits: fmt.bits };
}
