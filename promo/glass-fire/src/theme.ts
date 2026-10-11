// Palette, type and stage geometry. Black, white and graphite carry the film; the
// GLASSHOUSE thin-film accent only ever touches edges, sheens and chromatic fringes.
import {loadFont} from '@remotion/fonts';
import type {CSSProperties} from 'react';
import {useVideoConfig} from 'remotion';
import archivoUrl from '@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2';
import monoUrl from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2';

export const C = {
  void: '#000000',
  ink: '#FFFFFF',
  paper: '#F3F3F1',
  g1: '#0B0B0C',
  g2: '#141416',
  g3: '#1E1F22',
  g4: '#2B2C30',
  g5: '#44464C',
  g6: '#6C6F76',
  g7: '#A2A5AB',
  g8: '#D2D4D7',
} as const;

/** Thin-film iridescence: cyan → violet → rose → amber, deliberately desaturated. */
export const IRIS = ['#8FE6FF', '#B3A6FF', '#FFB0D6', '#FFE0A6'] as const;

export const DISPLAY = 'GF Display';
export const MONO = 'GF Mono';

// Bundled with the promo (fontsource, OFL), never fetched at render time.
// loadFont delays rendering until both faces are ready.
loadFont({family: DISPLAY, url: archivoUrl, weight: '100 900', stretch: '62% 125%', display: 'block'});
loadFont({family: MONO, url: monoUrl, weight: '100 800', display: 'block'});

/** Archivo: brutal grotesk with a 62–125% width axis that the motion system animates. */
export const display = (size: number, weight = 800, stretch = 100, tracking = -0.02): CSSProperties => ({
  fontFamily: DISPLAY,
  fontSize: size,
  fontWeight: weight,
  fontStretch: `${stretch}%`,
  letterSpacing: `${tracking}em`,
  lineHeight: 0.86,
  textTransform: 'uppercase',
  whiteSpace: 'pre',
  fontKerning: 'normal',
});

export const mono = (size: number, weight = 500, tracking = 0.08): CSSProperties => ({
  fontFamily: MONO,
  fontSize: size,
  fontWeight: weight,
  letterSpacing: `${tracking}em`,
  lineHeight: 1,
  whiteSpace: 'pre',
  fontVariantNumeric: 'tabular-nums',
});

export type Stage = {
  W: number;
  H: number;
  /** One design pixel: 1 at 1920×1080, scales with the short edge. */
  u: number;
  landscape: boolean;
  cx: number;
  cy: number;
  /** Safe margins for key content. */
  sx: number;
  sy: number;
};

/**
 * All layout reads the stage instead of hard-coding 1920×1080. Acts position by
 * fractions of W/H and sizes by u, which keeps a later 9:16 derivative a layout pass
 * rather than a rebuild.
 */
export const useStage = (): Stage => {
  const {width, height} = useVideoConfig();
  const u = Math.min(width, height) / 1080;
  return {W: width, H: height, u, landscape: width >= height, cx: width / 2, cy: height / 2, sx: 96 * u, sy: 80 * u};
};
