import { diagnostic, type Parsed } from '../diagnostics.ts';
const pcs: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const pitchExpected = 'note name A-G, optional # or b, octave -1..9 (e.g. "D2", "F#4", "Bb3"), or MIDI number 0-127';
export function parsePitch(value: unknown, path = ''): Parsed<number> {
  let n: number | undefined;
  if (typeof value === 'number' && Number.isInteger(value)) n = value;
  const m = typeof value === 'string' && /^([A-G])(#|b)?(-1|[0-9])$/.exec(value);
  if (m) n = 12 * (+m[3]! + 1) + pcs[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  if (n !== undefined && n >= 0 && n <= 127) return { value: n };
  let hint = 'Use a pitch in the MIDI range 0–127 (C-1 through G9).';
  if (typeof value === 'string') {
    if (/^[a-g]/.test(value)) hint = `Use "${value[0]!.toUpperCase() + value.slice(1)}".`;
    else if (/[♯♭]/.test(value)) hint = `Use "${value.replaceAll('♯', '#').replaceAll('♭', 'b')}".`;
    else if (/^H/.test(value)) hint = 'The letter must be A-G; German "H" is "B" in this notation, e.g. "B4".';
    else if (/^[A-G](#|b)?$/.test(value)) hint = `Include an octave, e.g. "${value}4".`;
  }
  return { diagnostic: diagnostic(typeof value === 'string' || typeof value === 'number' ? 'INVALID_PITCH' : 'WRONG_TYPE', path, value, pitchExpected, hint) };
}
