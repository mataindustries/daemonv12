// The 15-second vertical edit of GLASS//FIRE: 1080×1920, 60 fps, 900 frames.
//
// Ten whole bars of the final 24-second master, cut only on bar lines, so the 160 BPM grid
// never breaks: output bar k starts at (k − 1) · 1.5 s, exactly as a song bar does.
// scripts/vertical-prepare.ts cuts the audio from this table and the composition remaps
// every piece of music data through it, so what you hear and what the lanes show are the
// same edit.
//
//   out bars  1–2   ← song bars  4–5    pre-drop riser and stop → DROP 1 impact
//   out bars  3–7   ← song bars  8–12   DROP 1 fill → FAKEOUT → DROP 2 entry + master slicing
//   out bars  8–10  ← song bars 14–16   DROP 2 convergence and stop → PAYOFF, to the last sample
//
// Both cuts join bars that share a groove and open on the same downbeat figure: 5 → 8
// (halftime Drop 1) and 12 → 14 (two-step Drop 2). The song's own transitions into the
// fakeout (8 → 9), into Drop 2 (10 → 11) and into the payoff (14 → 15, after its beat of
// silence) are kept intact.
import {SECONDS_PER_BAR} from '../timeline/grid.ts';

export const V_FPS = 60;
export const V_BARS = 10;
export const V_FRAMES_PER_BAR = 90;
export const V_DURATION_IN_FRAMES = V_BARS * V_FRAMES_PER_BAR;
export const V_DURATION_SECONDS = V_BARS * SECONDS_PER_BAR;
export const V_WIDTH = 1080;
export const V_HEIGHT = 1920;

/** A run of consecutive song bars (1-based, inclusive). */
export type EditSegment = {firstBar: number; lastBar: number};

export const EDIT: readonly EditSegment[] = [
  {firstBar: 4, lastBar: 5},
  {firstBar: 8, lastBar: 12},
  {firstBar: 14, lastBar: 16},
];

/** Equal-power crossfade at each cut, ending exactly on the bar line so the downbeat is untouched. */
export const CROSSFADE_SECONDS = 0.008;
/** Half-cosine fade-in on the very first samples: the cut into bar 4 starts mid-tail. */
export const FADE_IN_SECONDS = 0.002;

export type Span = {
  /** Song time in seconds, [songStart, songEnd). */
  songStart: number;
  songEnd: number;
  /** Output time in seconds, [outStart, outEnd). */
  outStart: number;
  outEnd: number;
  firstBar: number;
  lastBar: number;
  /** First output bar (1-based). */
  outBar: number;
};

export const SPANS: readonly Span[] = (() => {
  let out = 0;
  let outBar = 1;
  return EDIT.map(segment => {
    const bars = segment.lastBar - segment.firstBar + 1;
    const span: Span = {
      songStart: (segment.firstBar - 1) * SECONDS_PER_BAR,
      songEnd: segment.lastBar * SECONDS_PER_BAR,
      outStart: out,
      outEnd: out + bars * SECONDS_PER_BAR,
      firstBar: segment.firstBar,
      lastBar: segment.lastBar,
      outBar,
    };
    out = span.outEnd;
    outBar += bars;
    return span;
  });
})();

/** Output times (seconds) of the cuts between spans. */
export const CUTS: readonly number[] = SPANS.slice(1).map(s => s.outStart);

/** The span playing at an output time; times outside 0…15 s extend the first or last span. */
export const spanAt = (outSeconds: number): Span => {
  for (const span of SPANS) if (outSeconds < span.outEnd - 1e-9) return span;
  return SPANS[SPANS.length - 1]!;
};

/** Song time heard at an output time. */
export const songSecondsAt = (outSeconds: number): number => {
  const span = spanAt(outSeconds);
  return span.songStart + (outSeconds - span.outStart);
};

/** Output time of a song time, or null when the edit leaves it out. */
export const outSecondsOf = (songSeconds: number): number | null => {
  for (const span of SPANS) {
    if (songSeconds >= span.songStart - 1e-9 && songSeconds < span.songEnd - 1e-9) return span.outStart + (songSeconds - span.songStart);
  }
  return null;
};

/** Song bar (1-based) heard in an output bar (1-based). */
export const songBarOf = (outBar: number): number => {
  for (const span of SPANS) {
    const bars = span.lastBar - span.firstBar + 1;
    if (outBar >= span.outBar && outBar < span.outBar + bars) return span.firstBar + (outBar - span.outBar);
  }
  throw new RangeError(`output bar ${outBar} is outside 1…${V_BARS}`);
};

// Structural sanity, checked at import so a bad edit fails loudly in Studio and tests.
{
  const total = SPANS.reduce((sum, s) => sum + (s.lastBar - s.firstBar + 1), 0);
  if (total !== V_BARS) throw new Error(`the vertical edit covers ${total} bars, expected ${V_BARS}`);
  for (const s of SPANS) {
    if (!Number.isInteger(s.firstBar) || s.firstBar < 1 || s.lastBar > 16 || s.lastBar < s.firstBar) throw new Error(`bad edit segment ${s.firstBar}–${s.lastBar}`);
  }
  for (let i = 1; i < SPANS.length; i++) if (SPANS[i]!.firstBar <= SPANS[i - 1]!.lastBar) throw new Error('edit segments must move forward through the song');
}
