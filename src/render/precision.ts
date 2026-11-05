// Opt-in production path. Float64 values use signed-16 sample units, without integer rounding.
// Source PCM16 cannot regain lost detail; fractional performance, mix and effect results survive.
import { MAX_PCM_FRAMES, PCM_RATE, type PcmTrigger } from './pcm.ts';
import { voiceFrames, voiceSamples, voiceGain, voiceCost, PLAYBACK_WORK_LIMIT, PLAYBACK_VOICE_BYTES_LIMIT } from './playback.ts';
import { dbfs } from './production.ts';
import { readWavInfo } from './wav.ts';
import type { VoiceSampleCache } from './voice-cache.ts';

function checkLength(samples: Float64Array): void {
  if (!samples.length || samples.length % 2 || samples.length / 2 > MAX_PCM_FRAMES)
    throw new RangeError('Expected nonempty stereo audio of at most 600 seconds.');
}
export function sumFloatPrecise(triggers: PcmTrigger[], minimumFrames: number, maximumFrames = Infinity, cache?: VoiceSampleCache): Float64Array {
  const frames = Math.min(maximumFrames, triggers.reduce((n, t) => Math.max(n, t.frame + voiceFrames(t.pcm, t.playback, t.articulation)), minimumFrames));
  if (!Number.isSafeInteger(frames) || frames < 1 || frames > MAX_PCM_FRAMES) throw new RangeError('Precision render exceeds the 600 second frame limit.');
  let work = 0;
  for (const t of triggers) {
    if (!Number.isSafeInteger(t.frame) || t.frame < 0 || !Number.isFinite(t.velocity) || t.velocity <= 0 || t.velocity > 1) throw new RangeError('Invalid PCM trigger.');
    const cost = voiceCost(t.pcm, t.playback, frames - t.frame, t.articulation);
    // A shared cache enforces its total unique-work budget across all tracks at runtime.
    // Project orchestration preflights the same cache keys before any audio processing.
    if (!cache) work += cost.work;
    if (cost.bytes > PLAYBACK_VOICE_BYTES_LIMIT || work > PLAYBACK_WORK_LIMIT) throw new RangeError('Precision render exceeds the existing sample-performance budget.');
  }
  const output = new Float64Array(frames * 2);
  for (const t of triggers) {
    if (t.frame >= frames) continue;
    const voice = cache ? cache.samples(t.pcm, t.playback, frames - t.frame, t.articulation) : voiceSamples(t.pcm, t.playback, frames - t.frame, t.articulation);
    const count = Math.min(voice.length / t.pcm.channels, frames - t.frame);
    for (let n = 0; n < count; n++) {
      const gain = t.velocity * voiceGain(t.articulation, n, count);
      for (let c = 0; c < 2; c++) output[(t.frame + n) * 2 + c]! += voice[n * t.pcm.channels + (t.pcm.channels === 1 ? 0 : c)]! * gain;
    }
  }
  return output;
}

function allocatePcm24(frames: number): Buffer {
  const bytes = Buffer.alloc(44 + frames * 6);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(PCM_RATE, 24); bytes.writeUInt32LE(PCM_RATE * 6, 28);
  bytes.writeUInt16LE(6, 32); bytes.writeUInt16LE(24, 34); bytes.write('data', 36); bytes.writeUInt32LE(frames * 6, 40);
  return bytes;
}
export function quantize24(samples: Float64Array) {
  checkLength(samples);
  const bytes = allocatePcm24(samples.length / 2);
  let clippedSamples = 0, peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = samples[i]!;
    if (!Number.isFinite(value)) throw new RangeError('Non-finite precision audio.');
    const integer = Math.round(value * 256);
    if (integer < -8388608 || integer > 8388607) clippedSamples++;
    peak = Math.max(peak, Math.abs(value));
    bytes.writeIntLE(Math.max(-8388608, Math.min(8388607, integer)), 44 + i * 3, 3);
  }
  return { bytes, frames: samples.length / 2, clippedSamples, preClipPeakDbfs: dbfs(peak / 32768) };
}

// Exact PCM24 frame fitting; no decode/requantization and no change to existing frame values.
export function fitPcm24(bytes: Buffer, frames: number): Buffer {
  const parsed = readWavInfo(bytes);
  if (!parsed.ok || parsed.info.formatTag !== 1 || parsed.info.bitsPerSample !== 24 || parsed.info.channels !== 2 || parsed.info.sampleRate !== PCM_RATE)
    throw new RangeError('Expected stereo 44100 Hz PCM24.');
  if (!Number.isSafeInteger(frames) || frames < 1 || frames > MAX_PCM_FRAMES) throw new RangeError('Invalid PCM24 boundary.');
  const output = allocatePcm24(frames);
  bytes.copy(output, 44, parsed.info.dataOffset, parsed.info.dataOffset + Math.min(frames * 6, parsed.info.dataBytes));
  return output;
}

export function analyzePcm24(bytes: Buffer) {
  const parsed = readWavInfo(bytes);
  if (!parsed.ok || parsed.info.formatTag !== 1 || parsed.info.bitsPerSample !== 24 || parsed.info.channels !== 2 || parsed.info.sampleRate !== PCM_RATE || parsed.info.frames < 1)
    throw new RangeError('Expected nonempty stereo 44100 Hz PCM24.');
  const info = parsed.info;
  let peak = 0, left = 0, right = 0, cross = 0, mono = 0, fullScaleSamples = 0, nonzeroLowBytes = 0;
  for (let i = 0; i < info.frames; i++) {
    const offset = info.dataOffset + i * 6, l = bytes.readIntLE(offset, 3), r = bytes.readIntLE(offset + 3, 3);
    peak = Math.max(peak, Math.abs(l), Math.abs(r)); left += l * l; right += r * r; cross += l * r; mono += ((l + r) / 2) ** 2;
    for (const [v, at] of [[l, offset], [r, offset + 3]] as const) {
      if (v === -8388608 || v === 8388607) fullScaleSamples++;
      if (bytes[at] !== 0) nonzeroLowBytes++;
    }
  }
  const stereoEnergy = (left + right) / 2;
  return { format: 'pcm_s24le' as const, frames: info.frames, sampleRate: PCM_RATE, channels: 2, bitsPerSample: 24,
    durationSeconds: Number((info.frames / PCM_RATE).toFixed(6)), peakDbfs: dbfs(peak / 8388608),
    rmsDbfs: dbfs(Math.sqrt(stereoEnergy / info.frames) / 8388608), fullScaleSamples, clipping: fullScaleSamples > 0,
    stereoCorrelation: left && right ? Number(Math.max(-1, Math.min(1, cross / Math.sqrt(left * right))).toFixed(6)) : null,
    monoFoldRmsDbfs: dbfs(Math.sqrt(mono / info.frames) / 8388608),
    monoFoldChangeDb: stereoEnergy ? dbfs(Math.sqrt(mono / stereoEnergy)) : null,
    nonzeroLowBytes,
  };
}
