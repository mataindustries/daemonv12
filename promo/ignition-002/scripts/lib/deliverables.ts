// The films this project renders, their delivered file names (written to their output
// directory, never committed) and how the pipeline drives each one.

export type FilmKey = 'reactor' | 'v12';

export type Film = {
  key: FilmKey;
  composition: string;
  /** Output directory, relative to the project root. */
  outDir: string;
  master: string;
  /** Written instead of `master` when the approved WAV is unavailable, where allowed. */
  masterPictureOnly: string;
  pictureOnlyAllowed: boolean;
  poster: string;
  posterFrame: number;
  preview: string;
  /** Music data the film reads, relative to the project root. */
  sync: string;
  /** Command that regenerates `sync` from the approved WAV. */
  analyze: string;
  /** Extra flags for `remotion render` and `remotion still`. */
  remotionFlags: string[];
  concurrency: number;
  /** Props that leave only the copy on screen, for the safe-box check. */
  copyOnlyProps: Record<string, unknown>;
  /** Copy lines as [label, first row, last row, luma threshold] for the safe-box check. */
  copyLines: [string, number, number, number][];
  /** Screen region (fractions x0, y0, x1, y1) whose brightness must answer the kicks. */
  responseRegion: [number, number, number, number];
};

export const FILMS: Record<FilmKey, Film> = {
  reactor: {
    key: 'reactor',
    composition: 'InfiniteReactor',
    outDir: 'out',
    master: 'IGNITION-002-INFINITE-REACTOR-15S-1080x1920.mp4',
    masterPictureOnly: 'IGNITION-002-INFINITE-REACTOR-15S-1080x1920.PICTURE-ONLY.mp4',
    pictureOnlyAllowed: true,
    poster: 'IGNITION-002-INFINITE-REACTOR-POSTER-1080x1920.png',
    /** A frame from OPEN: the armillary cage, jets and field at full extension. */
    posterFrame: 560,
    preview: 'IGNITION-002-preview-540x960.mp4',
    sync: 'src/sync/sync.json',
    analyze: 'node scripts/analyze.ts',
    remotionFlags: [],
    concurrency: 4,
    copyOnlyProps: {audio: false, skip: ['tunnel', 'haze', 'machinery', 'field', 'core', 'glare', 'jets', 'arcs', 'shocks', 'bloom', 'foreground', 'grade']},
    copyLines: [
      ['IGNITION', 300, 450, 120],
      ['SECOND WIND', 450, 520, 90],
      ['DAEMONV12', 1380, 1470, 90],
    ],
    responseRegion: [0.39, 0.445, 0.61, 0.57],
  },
  v12: {
    key: 'v12',
    composition: 'V12Overdrive',
    outDir: 'out/v12',
    master: 'IGNITION-002-V12-OVERDRIVE-15S.mp4',
    masterPictureOnly: 'IGNITION-002-V12-OVERDRIVE-15S.PICTURE-ONLY.mp4',
    // The brief forbids another silent final: no WAV, no master.
    pictureOnlyAllowed: false,
    poster: 'IGNITION-002-V12-OVERDRIVE-POSTER-1080x1920.png',
    /** Just after the payoff downbeat (9.375 s): full heat, low three-quarter. */
    posterFrame: 572,
    preview: 'IGNITION-002-V12-OVERDRIVE-preview-540x960.mp4',
    sync: 'src/v12/sync.json',
    analyze: 'node scripts/analyze-v12.ts',
    // Software WebGL (no GPU): SwiftShader through ANGLE; frames can take seconds each.
    remotionFlags: ['--gl=swangle', '--timeout=180000'],
    concurrency: 2,
    copyOnlyProps: {audio: false, hideEngine: true},
    copyLines: [
      ['IGNITION', 300, 420, 120],
      ['SECOND WIND', 436, 500, 90],
      ['DAEMONV12', 1380, 1470, 90],
    ],
    responseRegion: [0.15, 0.28, 0.85, 0.78],
  },
};

export const filmOf = (key: string | undefined): Film => {
  const f = FILMS[(key ?? 'reactor') as FilmKey];
  if (!f) throw new Error(`unknown film ${key}; one of ${Object.keys(FILMS).join(', ')}`);
  return f;
};

// The original single-film names, unchanged.
export const MASTER = FILMS.reactor.master;
export const MASTER_PICTURE_ONLY = FILMS.reactor.masterPictureOnly;
export const POSTER = FILMS.reactor.poster;
export const PREVIEW = FILMS.reactor.preview;
export const POSTER_FRAME = FILMS.reactor.posterFrame;
