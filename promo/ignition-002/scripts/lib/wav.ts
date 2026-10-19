// Minimal RIFF/WAVE reader for the analysis tooling (no dependencies). Shared design with promo/glass-fire.
// Reads PCM 16/24/32-bit integer and 32/64-bit float, including WAVE_FORMAT_EXTENSIBLE.
import {readFileSync} from 'node:fs';

export type Pcm = {
  sampleRate: number;
  channels: Float32Array[];
  frames: number;
  bitsPerSample: number;
  format: 'int' | 'float';
};

export const decodeWav = (bytes: Uint8Array, label = 'WAV'): Pcm => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (bytes.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error(`${label}: not a RIFF/WAVE file`);
  let offset = 12;
  let fmt: {format: number; channels: number; sampleRate: number; bits: number; blockAlign: number} | null = null;
  let data: {start: number; length: number} | null = null;
  while (offset + 8 <= bytes.length) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      let format = view.getUint16(body, true);
      if (format === 0xfffe && size >= 26) format = view.getUint16(body + 24, true);
      fmt = {
        format,
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        blockAlign: view.getUint16(body + 12, true),
        bits: view.getUint16(body + 14, true),
      };
    } else if (id === 'data') {
      data = {start: body, length: Math.min(size, bytes.length - body)};
    }
    offset = body + size + (size % 2);
  }
  if (!fmt) throw new Error(`${label}: missing fmt chunk`);
  if (!data) throw new Error(`${label}: missing data chunk`);
  const isFloat = fmt.format === 3;
  if (!isFloat && fmt.format !== 1) throw new Error(`${label}: unsupported format tag ${fmt.format} (PCM or IEEE float only)`);
  const bytesPer = fmt.bits / 8;
  const frames = Math.floor(data.length / fmt.blockAlign);
  const channels = Array.from({length: fmt.channels}, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < fmt.channels; c++) {
      const at = data.start + i * fmt.blockAlign + c * bytesPer;
      let v: number;
      if (isFloat) v = fmt.bits === 64 ? view.getFloat64(at, true) : view.getFloat32(at, true);
      else if (fmt.bits === 16) v = view.getInt16(at, true) / 32768;
      else if (fmt.bits === 24) v = ((view.getUint8(at) | (view.getUint8(at + 1) << 8) | (view.getInt8(at + 2) << 16)) / 8388608);
      else if (fmt.bits === 32) v = view.getInt32(at, true) / 2147483648;
      else if (fmt.bits === 8) v = (view.getUint8(at) - 128) / 128;
      else throw new Error(`${label}: unsupported ${fmt.bits}-bit PCM`);
      channels[c]![i] = v;
    }
  }
  return {sampleRate: fmt.sampleRate, channels, frames, bitsPerSample: fmt.bits, format: isFloat ? 'float' : 'int'};
};

export const readWav = (path: string): Pcm => decodeWav(readFileSync(path), path);

/** Average all channels into one. */
export const mixdown = (pcm: Pcm): Float32Array => {
  if (pcm.channels.length === 1) return pcm.channels[0]!;
  const out = new Float32Array(pcm.frames);
  for (const channel of pcm.channels) for (let i = 0; i < pcm.frames; i++) out[i]! += channel[i]! / pcm.channels.length;
  return out;
};

