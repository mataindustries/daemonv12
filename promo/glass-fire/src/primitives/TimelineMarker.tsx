// Playhead and structural markers. Musical silence (stop markers) is drawn as a "//"
// hatched void: negative space made visible on the timeline.
import {useId} from 'react';
import type {Marker} from '../data/contract.ts';
import {C, MONO} from '../theme.ts';
import {crisp, tx, visibleTimes, type TimeView} from './view.ts';

export const Playhead = ({x, y, height, u = 1, flash = 0, opacity = 1}: {x: number; y: number; height: number; u?: number; flash?: number; opacity?: number}) => {
  const px = crisp(x);
  return (
    <g opacity={opacity}>
      {flash > 0.01 ? <rect x={px - 6 * u} y={y} width={12 * u} height={height} fill={C.ink} opacity={0.08 * flash} /> : null}
      <line x1={px} x2={px} y1={y} y2={y + height} stroke={C.ink} strokeWidth={1.5} />
      <path d={`M${px - 6 * u} ${y} L${px + 6 * u} ${y} L${px} ${y + 8 * u} Z`} fill={C.ink} />
    </g>
  );
};

type Props = {
  view: TimeView;
  markers: readonly Marker[];
  y: number;
  height: number;
  /** Ruler line where marker labels sit. */
  labelY: number;
  u?: number;
  opacity?: number;
};

export const TimelineMarkers = ({view, markers, y, height, labelY, u = 1, opacity = 1}: Props) => {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [t0, t1] = visibleTimes(view);
  const visible = markers.filter(m => m.t + (m.duration ?? 0) >= t0 && m.t <= t1);
  if (!visible.length || opacity <= 0) return null;
  return (
    <g opacity={opacity}>
      <defs>
        <pattern id={`${id}-hatch`} width={10 * u} height={10 * u} patternUnits="userSpaceOnUse" patternTransform="rotate(-60)">
          <line x1={0} y1={0} x2={0} y2={10 * u} stroke={C.g4} strokeWidth={1.2 * u} />
        </pattern>
      </defs>
      {visible.map(m => {
        const x = tx(view, m.t);
        if (m.kind === 'stop') {
          const w = (m.duration ?? 0) * view.pps;
          const left = Math.max(view.left, x);
          const right = Math.min(view.right, x + w);
          if (right <= left) return null;
          return (
            <g key={m.id}>
              <rect x={left} y={y} width={right - left} height={height} fill={`url(#${id}-hatch)`} />
              <text x={left + 4 * u} y={labelY} fill={C.g6} fontFamily={MONO} fontSize={12 * u} letterSpacing="0.1em">
                //
              </text>
            </g>
          );
        }
        if (x < view.left || x > view.right) return null;
        const strong = m.kind === 'drop' || m.kind === 'hit';
        return (
          <g key={m.id}>
            <line x1={crisp(x)} x2={crisp(x)} y1={y} y2={y + height} stroke={strong ? C.g6 : C.g5} strokeWidth={1} />
            {m.label ? (
              <text x={x + 6 * u} y={labelY} fill={strong ? C.g8 : C.g6} fontFamily={MONO} fontSize={12 * u} letterSpacing="0.12em">
                {m.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
};
