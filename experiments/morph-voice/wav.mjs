// Minimal, timestamp-free PCM16 RIFF encoding. No resampling or implicit gain.
export function encodeWav(samples, sampleRate = 44100, channels = 1) {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000 ||
      ![1, 2].includes(channels) || !samples.length || samples.length % channels) {
    throw new RangeError('Expected nonempty interleaved mono/stereo PCM and an integer sample rate');
  }
  const bytes = samples.length * 2;
  const wav = Buffer.alloc(44 + bytes);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + bytes, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * channels * 2, 28);
  wav.writeUInt16LE(channels * 2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(bytes, 40);
  for (let i = 0; i < samples.length; i++) {
    const value = samples[i];
    if (!Number.isFinite(value) || value < -1 || value > 1) {
      throw new RangeError(`PCM sample ${i} is nonfinite or clips: ${value}`);
    }
    wav.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(value * 32767))), 44 + i * 2);
  }
  return wav;
}

export function decodeWav(bytes) {
  if (bytes.length < 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' ||
      bytes.toString('ascii', 8, 12) !== 'WAVE' || bytes.readUInt32LE(4) + 8 !== bytes.length) {
    throw new TypeError('Malformed RIFF/WAVE');
  }
  let fmt, data;
  for (let at = 12; at + 8 <= bytes.length;) {
    const id = bytes.toString('ascii', at, at + 4), size = bytes.readUInt32LE(at + 4);
    if (at + 8 + size > bytes.length) throw new TypeError('Truncated WAV chunk');
    if (id === 'fmt ') {
      if (size < 16) throw new TypeError('Truncated fmt');
      fmt = { tag: bytes.readUInt16LE(at + 8), channels: bytes.readUInt16LE(at + 10),
        sampleRate: bytes.readUInt32LE(at + 12), byteRate: bytes.readUInt32LE(at + 16),
        align: bytes.readUInt16LE(at + 20), bits: bytes.readUInt16LE(at + 22) };
    }
    if (id === 'data') data = bytes.subarray(at + 8, at + 8 + size);
    at += 8 + size + size % 2;
  }
  if (!fmt || !data || fmt.tag !== 1 || fmt.bits !== 16 || ![1, 2].includes(fmt.channels) ||
      fmt.align !== fmt.channels * 2 || fmt.byteRate !== fmt.sampleRate * fmt.align ||
      !data.length || data.length % fmt.align) throw new TypeError('Expected valid PCM16 mono/stereo WAV');
  const samples = new Float64Array(data.length / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = data.readInt16LE(i * 2) / 32768;
  return { samples, sampleRate: fmt.sampleRate, channels: fmt.channels, frames: samples.length / fmt.channels };
}

const db = x => x > 0 ? 20 * Math.log10(x) : null;
export function analyzeWav(bytes) {
  const { samples, sampleRate, channels, frames } = decodeWav(bytes);
  let peak = 0, energy = 0, dc = 0, maxDelta = 0, fullScaleSamples = 0;
  const first = [], last = [], windows = [];
  for (let c = 0; c < channels; c++) {
    first.push(samples[c]); last.push(samples[samples.length - channels + c]);
  }
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    peak = Math.max(peak, Math.abs(x)); energy += x * x; dc += x;
    if (x === -1 || x === 32767 / 32768) fullScaleSamples++;
    if (i >= channels) maxDelta = Math.max(maxDelta, Math.abs(x - samples[i - channels]));
  }
  const windowFrames = Math.round(sampleRate * 0.25);
  for (let start = 0; start < frames; start += windowFrames) {
    const stop = Math.min(frames, start + windowFrames);
    let sum = 0, localPeak = 0;
    for (let i = start * channels; i < stop * channels; i++) {
      sum += samples[i] ** 2; localPeak = Math.max(localPeak, Math.abs(samples[i]));
    }
    windows.push({ at: start / sampleRate, rmsDbfs: db(Math.sqrt(sum / ((stop - start) * channels))), peakDbfs: db(localPeak) });
  }
  return { frames, seconds: frames / sampleRate, sampleRate, channels, bitsPerSample: 16,
    format: 'PCM16LE', peakDbfs: db(peak), rmsDbfs: db(Math.sqrt(energy / samples.length)),
    dc: dc / samples.length, fullScaleSamples, maxAdjacentDelta: maxDelta,
    firstFrame: first, lastFrame: last, windows };
}
