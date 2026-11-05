/**
 * The signature hook of SODIUM HOURS, as data. Bars are 1-based within the phrase, steps are 1-based sixteenths.
 * Over Dbmaj9 | Eb6/9 | Fm9 | C7b9. The call slides into the Ab5 "cry"; the answer ends on the leading tone E5,
 * which falls back to Eb5 each time the hook repeats (V -> bVI deceptive cadence) until the final resolution.
 */
import type { VNote, Vowel } from './instruments.ts';
import { m, swung } from './theory.ts';

export interface HookNote { bar: number; step: number; len: number; p: string; vowel?: Vowel; to?: Vowel; slide?: number; vib?: number; fall?: number; v?: number; scoop?: number; late?: number }
export const SWING = 38;

/** Call: pickup C5 (bar 0, step 15), Eb F . Eb C . Eb F -> slide -> Ab5 (held) G F . . . C */
export const CALL: HookNote[] = [
  { bar: 0, step: 15, len: 2, p: 'C5', vowel: 'u', to: 'a', scoop: 2, v: 0.72 },
  { bar: 1, step: 1, len: 2, p: 'Eb5', vowel: 'a', v: 0.8 },
  { bar: 1, step: 3, len: 6, p: 'F5', vowel: 'o', to: 'a', v: 0.9 },
  { bar: 1, step: 9, len: 1, p: 'Eb5', vowel: 'a', v: 0.74 },
  { bar: 1, step: 10, len: 3, p: 'C5', vowel: 'e', to: 'a', v: 0.78 },
  { bar: 1, step: 13, len: 2, p: 'Eb5', vowel: 'a', v: 0.8 },
  { bar: 1, step: 15, len: 1, p: 'F5', vowel: 'a', v: 0.84 },
  { bar: 1, step: 16, len: 8, p: 'Ab5', vowel: 'u', to: 'a', slide: 230, vib: 1.25, v: 0.98 },
  { bar: 2, step: 8, len: 1, p: 'G5', vowel: 'a', v: 0.8 },
  { bar: 2, step: 9, len: 4, p: 'F5', vowel: 'o', v: 0.84, fall: 0 },
  { bar: 2, step: 16, len: 1, p: 'C5', vowel: 'u', to: 'a', v: 0.7 },
];
/** Answer: Eb F . Eb C . Ab4 Bb4 | Db5 C Bb C E5 (held, yearning) */
export const ANSWER: HookNote[] = [
  { bar: 3, step: 1, len: 2, p: 'Eb5', vowel: 'a', v: 0.8 },
  { bar: 3, step: 3, len: 6, p: 'F5', vowel: 'o', to: 'a', v: 0.9 },
  { bar: 3, step: 9, len: 1, p: 'Eb5', vowel: 'a', v: 0.74 },
  { bar: 3, step: 10, len: 3, p: 'C5', vowel: 'e', to: 'a', v: 0.78 },
  { bar: 3, step: 13, len: 2, p: 'Ab4', vowel: 'o', v: 0.74 },
  { bar: 3, step: 15, len: 2, p: 'Bb4', vowel: 'a', v: 0.78 },
  { bar: 4, step: 1, len: 3, p: 'Db5', vowel: 'ae', to: 'a', v: 0.88, scoop: -1 },
  { bar: 4, step: 4, len: 1, p: 'C5', vowel: 'a', v: 0.74 },
  { bar: 4, step: 5, len: 2, p: 'Bb4', vowel: 'o', v: 0.76 },
  { bar: 4, step: 7, len: 2, p: 'C5', vowel: 'a', v: 0.8 },
  { bar: 4, step: 9, len: 5, p: 'E5', vowel: 'u', to: 'a', vib: 1.35, v: 0.92 },
];
/** Second answer: reaches back up to Ab5 before descending onto a longer E5. */
export const ANSWER2: HookNote[] = [
  ...ANSWER.slice(0, 4),
  { bar: 3, step: 13, len: 2, p: 'Eb5', vowel: 'a', v: 0.8 },
  { bar: 3, step: 15, len: 1, p: 'F5', vowel: 'a', v: 0.84 },
  { bar: 3, step: 16, len: 5, p: 'Ab5', vowel: 'u', to: 'a', slide: 200, vib: 1.2, v: 0.97 },
  { bar: 4, step: 4, len: 1, p: 'G5', vowel: 'a', v: 0.8 },
  { bar: 4, step: 5, len: 2, p: 'F5', vowel: 'o', v: 0.82 },
  { bar: 4, step: 7, len: 2, p: 'Db5', vowel: 'a', v: 0.8 },
  { bar: 4, step: 9, len: 7, p: 'E5', vowel: 'u', to: 'a', vib: 1.4, v: 0.94, fall: 0 },
];

/** Hook notes -> voice notes. Times are ticks relative to the first note; `start` is that note's tick relative
 *  to the start of `originBar`. Onsets and ends both land on the swung sixteenth grid; ends clamp to the next onset. */
export function toVoice(notes: HookNote[], originBar: number, swing = SWING, transpose = 0): { start: number; notes: VNote[] } {
  const at = (s16: number) => s16 * 240 + swung((((s16 % 16) + 16) % 16) + 1, swing);
  const idx = (x: HookNote) => (x.bar - originBar) * 16 + x.step - 1;
  const raw = notes.map((x, i) => {
    const t = at(idx(x)) + (x.late ?? 0), next = notes[i + 1];
    const end = Math.min(at(idx(x) + x.len), next ? at(idx(next)) + (next.late ?? 0) : Infinity);
    return { t, d: Math.max(60, end - t), p: m(x.p) + transpose, vowel: x.vowel, to: x.to, slide: x.slide, vib: x.vib, fall: x.fall, v: x.v, scoop: x.scoop } as VNote;
  });
  const start = raw[0]!.t;
  return { start, notes: raw.map(r => ({ ...r, t: r.t - start })) };
}
/** The same hook as staccato machine onsets (for the low-pass-gate pluck): straight grid, no slides. */
export function toMachine(notes: HookNote[]): { bar: number; step: number; midi: number; v: number }[] {
  return notes.map(x => ({ bar: x.bar, step: x.step, midi: m(x.p), v: x.v ?? 0.8 }));
}

/** Final-hook answer: climbs past the old Ab5 ceiling to a new summit, C6 (never sung before), then the E5. */
export const ANSWER_PEAK: HookNote[] = [
  ...ANSWER.slice(0, 4),
  { bar: 3, step: 13, len: 2, p: 'Eb5', vowel: 'a', v: 0.82 },
  { bar: 3, step: 15, len: 1, p: 'F5', vowel: 'a', v: 0.86 },
  { bar: 3, step: 16, len: 1, p: 'Ab5', vowel: 'a', v: 0.9 },
  { bar: 4, step: 1, len: 4, p: 'C6', vowel: 'u', to: 'a', slide: 170, vib: 1.3, v: 1 },
  { bar: 4, step: 5, len: 2, p: 'Bb5', vowel: 'a', v: 0.86 },
  { bar: 4, step: 7, len: 1, p: 'Ab5', vowel: 'o', v: 0.82 },
  { bar: 4, step: 8, len: 1, p: 'G5', vowel: 'a', v: 0.82 },
  { bar: 4, step: 9, len: 6, p: 'E5', vowel: 'u', to: 'a', vib: 1.4, v: 0.94 },
];
/** The resolution over Gbmaj7 (Neapolitan) -> C7b9 -> F MAJOR: the leading tone finally rises to F. */
export const RESOLVE: HookNote[] = [
  { bar: 3, step: 1, len: 3, p: 'Db5', vowel: 'a', v: 0.86 },
  { bar: 3, step: 4, len: 1, p: 'C5', vowel: 'a', v: 0.76 },
  { bar: 3, step: 5, len: 2, p: 'Bb4', vowel: 'o', v: 0.8 },
  { bar: 3, step: 7, len: 2, p: 'Db5', vowel: 'a', v: 0.84 },
  { bar: 3, step: 9, len: 2, p: 'C5', vowel: 'a', v: 0.84 },
  { bar: 3, step: 11, len: 6, p: 'E5', vowel: 'u', to: 'a', vib: 0.9, v: 0.9 },
  { bar: 4, step: 1, len: 22, p: 'F5', vowel: 'o', to: 'a', slide: 150, vib: 1.5, v: 1, fall: 0 },
];
/** Verse ad-libs built from the hook's cells (bar 1 = the bar the fragment starts in). */
export const FRAGMENTS: Record<string, HookNote[]> = {
  'frag-1': [{ bar: 1, step: 1, len: 2, p: 'C5', vowel: 'u', to: 'a', scoop: 2, v: 0.74 }, { bar: 1, step: 3, len: 2, p: 'Eb5', vowel: 'a', v: 0.8 }, { bar: 1, step: 5, len: 8, p: 'F5', vowel: 'o', to: 'a', vib: 1.1, v: 0.88, fall: 160 }],
  'frag-2': [{ bar: 1, step: 1, len: 1, p: 'F5', vowel: 'a', v: 0.8 }, { bar: 1, step: 2, len: 6, p: 'Ab5', vowel: 'u', to: 'a', slide: 200, vib: 1.2, v: 0.95 }, { bar: 1, step: 8, len: 1, p: 'G5', vowel: 'a', v: 0.8 }, { bar: 1, step: 9, len: 5, p: 'F5', vowel: 'o', v: 0.84, fall: 200 }],
  'frag-3': [{ bar: 1, step: 9, len: 1, p: 'Eb5', vowel: 'a', v: 0.78 }, { bar: 1, step: 10, len: 1, p: 'F5', vowel: 'a', v: 0.8 }, { bar: 1, step: 11, len: 2, p: 'Ab5', vowel: 'a', v: 0.86 }, { bar: 1, step: 13, len: 2, p: 'Bb5', vowel: 'e', to: 'a', v: 0.88 }, { bar: 1, step: 15, len: 10, p: 'C6', vowel: 'u', to: 'a', slide: 160, vib: 1.25, v: 0.94 }, { bar: 2, step: 9, len: 4, p: 'Ab5', vowel: 'o', v: 0.82, fall: 240 }],
  'frag-4': [{ bar: 1, step: 1, len: 2, p: 'Db5', vowel: 'ae', to: 'a', v: 0.86 }, { bar: 1, step: 3, len: 2, p: 'C5', vowel: 'a', v: 0.8 }, { bar: 1, step: 5, len: 8, p: 'E5', vowel: 'u', to: 'a', vib: 1.35, v: 0.9 }],
};
/** Rhythmic augmentation: every position and length doubled (half speed), slides lengthened. */
export function augment(notes: HookNote[], originBar = 0): HookNote[] {
  return notes.map(x => {
    const idx = ((x.bar - originBar) * 16 + x.step - 1) * 2;
    return { ...x, bar: originBar + Math.floor(idx / 16), step: (idx % 16) + 1, len: x.len * 2, slide: x.slide ? x.slide * 1.8 : x.slide, vib: (x.vib ?? 1) * 1.15 };
  });
}

/** Hook 2's second answer: the ceiling climbs one step (Ab5 -> Bb5), preparing the final's C6 summit. */
export const ANSWER3: HookNote[] = [
  ...ANSWER.slice(0, 4),
  { bar: 3, step: 13, len: 2, p: 'Eb5', vowel: 'a', v: 0.82 },
  { bar: 3, step: 15, len: 1, p: 'F5', vowel: 'a', v: 0.85 },
  { bar: 3, step: 16, len: 1, p: 'Ab5', vowel: 'a', v: 0.88 },
  { bar: 4, step: 1, len: 4, p: 'Bb5', vowel: 'u', to: 'a', slide: 160, vib: 1.25, v: 0.97 },
  { bar: 4, step: 5, len: 2, p: 'Ab5', vowel: 'o', v: 0.84 },
  { bar: 4, step: 7, len: 2, p: 'G5', vowel: 'a', v: 0.82 },
  { bar: 4, step: 9, len: 6, p: 'E5', vowel: 'u', to: 'a', vib: 1.4, v: 0.93 },
];
