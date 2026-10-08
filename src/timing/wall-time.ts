// Wall time is decimal seconds with at most microsecond precision, never an inferred beat.
export function secondsToMicroseconds(seconds: number): bigint {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 600 || Number(seconds.toFixed(6)) !== seconds)
    throw new RangeError('Seconds must be 0 through 600 with at most six decimal places.');
  return BigInt(seconds.toFixed(6).replace('.', ''));
}
export function microsecondsToFrames(microseconds: bigint, rate = 44100): number {
  return Number((microseconds * BigInt(rate) + 500000n) / 1000000n);
}
export function secondsToFrames(seconds: number, rate = 44100): number {
  return microsecondsToFrames(secondsToMicroseconds(seconds), rate);
}
