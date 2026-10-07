import { diagnostic, type Parsed } from '../diagnostics.ts';
export interface Key { text: string; sharpsFlats: number; mode: 'major' | 'minor' }
export const keyTonics = {
  major: ['Cb','Gb','Db','Ab','Eb','Bb','F','C','G','D','A','E','B','F#','C#'],
  minor: ['Ab','Eb','Bb','F','C','G','D','A','E','B','F#','C#','G#','D#','A#'],
};
function pitchClass(tonic: string): number {
  return (({ C:0,D:2,E:4,F:5,G:7,A:9,B:11 }[tonic[0] as 'C'] ?? 0) + (tonic[1] === '#' ? 1 : tonic[1] === 'b' ? -1 : 0) + 12) % 12;
}
export function parseKey(value: unknown, path = 'key'): Parsed<Key> {
  const m = typeof value === 'string' && /^([A-G])(#|b)? (major|minor)$/.exec(value);
  if (m) {
    const mode = m[3] as 'major' | 'minor', tonic = m[1]! + (m[2] ?? '');
    const index = keyTonics[mode].indexOf(tonic);
    if (index >= 0) return { value: { text: value as string, sharpsFlats: index - 7, mode } };
    const equivalent = keyTonics[mode].find(k => pitchClass(k) === pitchClass(tonic));
    return { diagnostic: diagnostic('INVALID_KEY', path, value, 'one of the 30 major/minor key signatures', equivalent ? `Use "${equivalent} ${mode}".` : undefined) };
  }
  const short = typeof value === 'string' && /^([a-gA-G])(#|b)?(?:m| min| minor| major)$/.exec(value);
  const hint = short ? `Use "${short[1]!.toUpperCase()}${short[2] ?? ''} ${String(value).endsWith('major') ? 'major' : 'minor'}".` : 'Use e.g. "D minor" or "Bb major".';
  return { diagnostic: diagnostic(typeof value === 'string' ? 'INVALID_KEY' : 'WRONG_TYPE', path, value, 'a supported tonic followed by major or minor', hint) };
}
