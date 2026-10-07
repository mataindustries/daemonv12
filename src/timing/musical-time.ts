import { diagnostic, type Parsed } from '../diagnostics.ts';
export const PPQ = 960;
export const TICKS_PER_WHOLE = 3840;
export interface TimeSignature { numerator: number; denominator: number }
export const durationRegex = /^([1-9][0-9]{0,3})\/([1-9][0-9]{0,3})$/;
export const positionRegex = /^([1-9][0-9]{0,3}):([1-9][0-9]?)(?:\+([1-9][0-9]{0,3})\/([1-9][0-9]{0,3}))?$/;
export const durationHint = 'Durations are strings of whole-note fractions, e.g. "1/4" (quarter), "1/8" (eighth), "3/8" (dotted quarter).';
export const positionHint = 'Write BAR:BEAT or BAR:BEAT+N/D, e.g. "3:2" or "3:2+1/8".';
const gridHint = 'Supported: binary subdivisions down to 1/256, triplets, quintuplets.';
export function parseTimeSignature(value: unknown, path = 'timeSignature'): Parsed<TimeSignature> {
  const m = typeof value === 'string' && /^([1-9][0-9]?)\/([1-9][0-9]?)$/.exec(value);
  if (!m || +m[1]! > 32 || ![1, 2, 4, 8, 16, 32].includes(+m[2]!))
    return { diagnostic: diagnostic(typeof value === 'string' ? 'INVALID_TIME_SIGNATURE' : 'WRONG_TYPE', path, value,
      'N/D: numerator 1–32, denominator 1, 2, 4, 8, 16 or 32', 'Use e.g. "4/4".') };
  return { value: { numerator: +m[1]!, denominator: +m[2]! } };
}
export function durationSyntax(value: unknown, path: string): Parsed<RegExpExecArray> {
  const m = typeof value === 'string' && durationRegex.exec(value);
  if (m) return { value: m };
  const hints: Record<string, string> = { '4n': '1/4', '8t': '1/12', '4n.': '3/8', '1/4.': '3/8', '1': '1/1' };
  return { diagnostic: diagnostic(typeof value === 'string' ? 'INVALID_DURATION' : 'WRONG_TYPE', path, value,
    'positive whole-note fraction N/D', Object.hasOwn(hints,String(value)) ? `Use "${hints[String(value)]}".` : durationHint) };
}
export function positionSyntax(value: unknown, path: string): Parsed<RegExpExecArray> {
  const m = typeof value === 'string' && positionRegex.exec(value);
  return m ? { value: m } : { diagnostic: diagnostic(typeof value === 'string' ? 'INVALID_POSITION' : 'WRONG_TYPE', path, value,
    'BAR:BEAT or BAR:BEAT+N/D', typeof value === 'string' && /(^0:|:0(?:\+|$))/.test(value) ? 'Bars and beats are 1-based.' : positionHint) };
}
export function parseDuration(value: unknown, path = ''): Parsed<number> {
  const parsed = durationSyntax(value, path);
  if (parsed.diagnostic) return parsed;
  const numerator = +parsed.value[1]! * TICKS_PER_WHOLE;
  const denominator = +parsed.value[2]!;
  if (numerator % denominator !== 0) return { diagnostic: diagnostic('OFF_GRID', path, value, 'integer ticks at 960 PPQ', gridHint) };
  return { value: numerator / denominator };
}
export function ticksPerBar(meter: TimeSignature): number { return meter.numerator * TICKS_PER_WHOLE / meter.denominator; }
export function parsePosition(value: unknown, meter: TimeSignature, bars: number, path = ''): Parsed<number> {
  const parsed = positionSyntax(value, path);
  if (parsed.diagnostic) return parsed;
  const m = parsed.value;
  const offset = m[3] ? parseDuration(`${m[3]}/${m[4]}`, path) : { value: 0 };
  if (offset.diagnostic) return { diagnostic: { ...offset.diagnostic, received: value } };
  const beatTicks = TICKS_PER_WHOLE / meter.denominator;
  const tick = (+m[1]! - 1) * ticksPerBar(meter) + (+m[2]! - 1) * beatTicks + offset.value;
  if (+m[1]! > bars || +m[2]! > meter.numerator || offset.value >= beatTicks)
    return { diagnostic: diagnostic('POSITION_OUT_OF_RANGE', path, value, 'position inside the pattern with offset smaller than one beat',
      tick < bars * ticksPerBar(meter) ? `Use "${formatPosition(tick, meter)}".` : `Positions are pattern-relative: valid range 1:1 … ${bars}:${meter.numerator}.`) };
  return { value: tick };
}
export function formatDuration(ticks: number): string {
  let a = ticks, b = TICKS_PER_WHOLE;
  while (b) [a, b] = [b, a % b];
  return `${ticks / a}/${TICKS_PER_WHOLE / a}`;
}
export function formatPosition(tick: number, meter: TimeSignature): string {
  const barTicks = ticksPerBar(meter), beatTicks = TICKS_PER_WHOLE / meter.denominator;
  const remainder = tick % barTicks, offset = remainder % beatTicks;
  return `${Math.floor(tick / barTicks) + 1}:${Math.floor(remainder / beatTicks) + 1}${offset ? '+' + formatDuration(offset) : ''}`;
}
export function usPerQuarter(bpm: number): number { return Math.round(60_000_000 / bpm); }
export function ticksToSeconds(ticks: number, tempo: number): number { return ticks * tempo / (PPQ * 1_000_000); }
// Round each absolute tick independently, ties toward the later frame. BigInt avoids
// precision loss even for the largest accepted project and eliminates accumulated drift.
export function ticksToFrames(tick: number, tempo: number, rate = 44100, ceil = false): number {
  const denominator = 960n * 1000000n;
  const numerator = BigInt(tick) * BigInt(tempo) * BigInt(rate);
  return Number((numerator + (ceil ? denominator - 1n : denominator / 2n)) / denominator);
}
