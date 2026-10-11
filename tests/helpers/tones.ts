// Synthetic reference sources and objective pitch measurements for sample-performance tests.
export function wav(samples: Int16Array, channels: 1 | 2 = 1): Buffer {
  const bytes = Buffer.alloc(44 + samples.length * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(36 + samples.length * 2, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(channels, 22);
  bytes.writeUInt32LE(44100, 24); bytes.writeUInt32LE(44100 * channels * 2, 28); bytes.writeUInt16LE(channels * 2, 32);
  bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => bytes.writeInt16LE(v, 44 + i * 2));
  return bytes;
}
export function tone(hz: number, frames: number, amplitude = 10000): Int16Array {
  return Int16Array.from({ length: frames }, (_, i) => Math.round(amplitude * Math.sin(2 * Math.PI * hz * i / 44100)));
}
// Mean frequency between the first and last upward zero crossings, located by linear interpolation.
export function frequency(samples: ArrayLike<number>, start: number, end: number, stride = 1, channel = 0): number {
  let first: number | undefined, last = 0, count = 0;
  for (let i = start; i < end - 1; i++) {
    const a = samples[i * stride + channel]!, b = samples[(i + 1) * stride + channel]!;
    if (a < 0 && b >= 0) { const t = i + a / (a - b); first ??= t; last = t; count++; }
  }
  return (count - 1) * 44100 / (last - first!);
}
// Fundamental near `expected` (within +-semitones) by the minimum squared difference over lags, refined parabolically.
export function pitch(samples: ArrayLike<number>, start: number, length: number, expected: number, semitones = 5, stride = 1): number {
  const value = (i: number) => samples[i * stride]!;
  const difference = (lag: number) => { let sum = 0; for (let i = start; i < start + length; i++) sum += (value(i) - value(i + lag)) ** 2; return sum; };
  const low = Math.floor(44100 / (expected * 2 ** (semitones / 12))), high = Math.ceil(44100 / (expected * 2 ** (-semitones / 12)));
  let best = low, smallest = Infinity;
  for (let lag = low; lag <= high; lag++) { const d = difference(lag); if (d < smallest) { smallest = d; best = lag; } }
  const a = difference(best - 1), c = difference(best + 1), shift = (a - c) / (2 * (a - 2 * smallest + c));
  return 44100 / (best + (Number.isFinite(shift) ? shift : 0));
}
// Amplitude of one frequency component (Goertzel), normalized so a full sine of amplitude A reads A.
export function level(samples: ArrayLike<number>, hz: number, start: number, end: number, stride = 1, channel = 0): number {
  const w = 2 * Math.PI * hz / 44100, c = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = start; i < end; i++) { const s0 = samples[i * stride + channel]! + c * s1 - s2; s2 = s1; s1 = s0; }
  return 2 * Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2)) / (end - start);
}
