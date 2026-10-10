// Spectral energy as a scrolling analysis strip: one column per analysis frame, one row
// per band, written only behind the playhead (what has actually sounded). Peaks take the
// thin-film accent. No bouncing bars.
import type {ReactNode} from 'react';
import type {Spectrum} from '../data/contract.ts';
import {C, IRIS} from '../theme.ts';
import {visibleTimes, tx, type TimeView} from './view.ts';

type Props = {
  spectrum: Spectrum;
  view: TimeView;
  y: number;
  height: number;
  u?: number;
  opacity?: number;
  /** Rows gap in px. */
  gap?: number;
  /** Values above this take the accent colour. */
  peakThreshold?: number;
};

export const EnergyBand = ({spectrum, view, y, height, u = 1, opacity = 1, gap = 2, peakThreshold = 0.84}: Props) => {
  if (opacity <= 0) return null;
  const [t0] = visibleTimes(view);
  const bands = spectrum.bandEdgesHz.length - 1;
  const rowH = (height - gap * u * (bands - 1)) / bands;
  const colW = view.pps / spectrum.rate;
  const first = Math.max(0, Math.floor(t0 * spectrum.rate));
  const last = Math.min(spectrum.values.length - 1, Math.floor(view.now * spectrum.rate));
  const cells: ReactNode[] = [];
  for (let i = first; i <= last; i++) {
    const x = tx(view, i / spectrum.rate);
    if (x + colW < view.left) continue;
    const row = spectrum.values[i]!;
    for (let k = 0; k < bands; k++) {
      const v = row[k] ?? 0;
      if (v < 0.04) continue;
      const peak = v > peakThreshold;
      cells.push(
        <rect
          key={`${i}.${k}`}
          x={x}
          y={y + height - (k + 1) * rowH - k * gap * u}
          width={colW + 0.6}
          height={rowH}
          fill={peak ? IRIS[k % IRIS.length] : C.ink}
          opacity={peak ? 0.9 : Math.pow(v, 1.6) * 0.85}
        />,
      );
    }
  }
  return <g opacity={opacity}>{cells}</g>;
};
