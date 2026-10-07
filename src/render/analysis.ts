import { readFileSync } from 'node:fs';
import { readWavInfo } from './wav.ts';
import { dbfs } from './production.ts';
import { diagnostic, type Parsed } from '../diagnostics.ts';
export interface AudioAnalysis {
  durationSeconds: number; frames: number; sampleRate: number; channels: number;
  bitsPerSample: number; format: 'pcm_s16le'; peakDbfs: number | null; rmsDbfs: number | null;
  fullScaleSamples: number; clipping: boolean;
  integratedLufs?: number | null; loudnessRangeLu?: number | null; truePeakDbfs?: number | null;
}
export function analyzeWav(path: string): Parsed<AudioAnalysis> {
  let bytes: Buffer;
  try { bytes = readFileSync(path); }
  catch (error) { return { diagnostic: diagnostic((error as NodeJS.ErrnoException).code === 'ENOENT' ? 'FILE_NOT_FOUND' : 'FILE_READ_FAILED', '', path, 'readable WAV file') }; }
  const result = readWavInfo(bytes);
  if (!result.ok || result.info.formatTag !== 1 || result.info.bitsPerSample !== 16 || result.info.frames < 1) {
    return { diagnostic: diagnostic('UNSUPPORTED_WAV', '', path, 'nonempty signed 16-bit PCM WAV') };
  }
  const info = result.info;
  let peak = 0, squares = 0, fullScaleSamples = 0;
  for (let i = info.dataOffset; i < info.dataOffset + info.dataBytes; i += 2) {
    const value = bytes.readInt16LE(i);
    peak = Math.max(peak, Math.abs(value)); squares += (value / 32768) ** 2;
    if (value === -32768 || value === 32767) fullScaleSamples++;
  }
  return { value: { durationSeconds: Number((info.frames / info.sampleRate).toFixed(6)), frames: info.frames,
    sampleRate: info.sampleRate, channels: info.channels, bitsPerSample: 16, format: 'pcm_s16le',
    peakDbfs: dbfs(peak / 32768), rmsDbfs: dbfs(Math.sqrt(squares / (info.frames * info.channels))),
    fullScaleSamples, clipping: fullScaleSamples > 0 } };
}
