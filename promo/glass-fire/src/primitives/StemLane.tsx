// One stem on the arrangement: scrolling amplitude envelope, onset event blocks that
// quantize-lock onto the grid before they play, and onset ticks that fire at the
// playhead. Everything is read from the stem's data at the current time.
import {useId} from 'react';
import type {StemTrack} from '../data/contract.ts';
import {clamp01, envAt, hitAt, onsetsBetween} from '../data/signals.ts';
import {hash01, SPRINGS, springStep} from '../motion/physics.ts';
import {C, IRIS, MONO} from '../theme.ts';
import {crisp, tx, visibleTimes, type TimeView} from './view.ts';

export type StemLaneProps = {
  stem: StemTrack;
  label: string;
  index: number;
  view: TimeView;
  /** Data region of the lane. The label sits left of it at labelX. */
  y: number;
  height: number;
  labelX: number;
  u?: number;
  /** Baseline draw-on and label type-on, 0…1. */
  reveal?: number;
  showWave?: boolean;
  showBlocks?: boolean;
  /** Seconds before the playhead at which incoming blocks snap onto the grid (0 = always locked). */
  lockLead?: number;
  /** Minimum block width in px (hats are thin, notes use their duration). */
  blockWidth?: number;
  /** Envelope gain for the scrolling wave. */
  waveGain?: number;
  /** 0…1: split into two half-lanes that pull apart (Drop 2). */
  split?: number;
  opacity?: number;
  /** Tint fresh hits with the glass accent. */
  iris?: boolean;
};

const HIT = {decay: 0.07};

export const StemLane = ({
  stem,
  label,
  index,
  view,
  y,
  height,
  labelX,
  u = 1,
  reveal = 1,
  showWave = true,
  showBlocks = true,
  lockLead = 0,
  blockWidth = 8,
  waveGain = 1,
  split = 0,
  opacity = 1,
  iris = false,
}: StemLaneProps) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  if (opacity <= 0 || reveal <= 0) return null;
  const now = view.now;
  const [t0, t1] = visibleTimes(view);
  const cy = y + height / 2;
  const hit = hitAt(stem.onsets, now, HIT);
  const level = envAt(stem.envelope, now);
  const half = height / 2 - 2 * u;
  const lineRight = view.left + (view.right - view.left) * clamp01(reveal);

  // Scrolling envelope, mirrored around the lane centre. Past = filled, future = outline.
  const step = 3;
  const top: string[] = [];
  const bottom: string[] = [];
  let playX = view.playheadX;
  if (showWave) {
    for (let x = view.left; x <= lineRight; x += step) {
      const t = view.now + (x - view.playheadX) / view.pps;
      const a = Math.min(1, envAt(stem.envelope, t) * waveGain) * half;
      top.push(`${x.toFixed(1)} ${(cy - a).toFixed(1)}`);
      bottom.push(`${x.toFixed(1)} ${(cy + a).toFixed(1)}`);
    }
    playX = Math.min(view.playheadX, lineRight);
  }
  const wavePath = top.length > 1 ? `M${top.join('L')}L${bottom.reverse().join('L')}Z` : '';
  const clipId = `${uid}-past`;
  const futureId = `${uid}-future`;

  const blocks = showBlocks ? onsetsBetween(stem.onsets, t0 - 0.5, t1) : [];
  const splitOffset = split * height * 0.42;

  const content = (
    <>
      {wavePath ? (
        <>
          <path d={wavePath} fill={C.g6} opacity={0.55 + 0.45 * level} clipPath={`url(#${clipId})`} />
          <path d={wavePath} fill="none" stroke={C.g4} strokeWidth={1} clipPath={`url(#${futureId})`} />
        </>
      ) : null}
      {blocks.map((o, k) => {
        const jitter = (hash01(Math.round(o.t * 1e4), index) - 0.5) * 0.12;
        let lock = 1;
        if (lockLead > 0) lock = springStep(now - (o.t - lockLead), SPRINGS.lock);
        const t = o.t + jitter * (1 - lock);
        const x = tx(view, t);
        const w = Math.max(blockWidth * u, (o.duration ?? 0) * view.pps);
        if (x + w < view.left || x > lineRight) return null;
        const dt = now - o.t;
        const fresh = dt >= 0 ? Math.exp(-dt / 0.09) : 0;
        const h = Math.max(4 * u, height * (0.28 + 0.6 * o.strength));
        const fill = dt >= 0 ? (fresh > 0.05 ? (iris && fresh > 0.5 ? IRIS[k % IRIS.length]! : C.ink) : C.g5) : 'none';
        const stroke = dt >= 0 ? 'none' : lock < 0.98 ? C.g5 : C.g7;
        return (
          <rect
            key={`${o.t}-${k}`}
            x={x}
            y={cy - h / 2 - fresh * 3 * u}
            width={w}
            height={h + fresh * 6 * u}
            fill={fill}
            fillOpacity={dt >= 0 ? 0.35 + 0.65 * Math.max(fresh, 0.3) : 0}
            stroke={stroke}
            strokeWidth={1}
            opacity={lockLead > 0 ? 0.35 + 0.65 * lock : 1}
          />
        );
      })}
    </>
  );

  return (
    <g opacity={opacity}>
      <defs>
        <clipPath id={clipId}>
          <rect x={view.left} y={y - height} width={Math.max(0, playX - view.left)} height={height * 3} />
        </clipPath>
        <clipPath id={futureId}>
          <rect x={playX} y={y - height} width={Math.max(0, lineRight - playX)} height={height * 3} />
        </clipPath>
        <clipPath id={`${clipId}-top`}>
          <rect x={view.left} y={y - height} width={view.right - view.left} height={height * 1.5} />
        </clipPath>
        <clipPath id={`${clipId}-bottom`}>
          <rect x={view.left} y={cy} width={view.right - view.left} height={height * 1.5} />
        </clipPath>
      </defs>
      <line x1={view.left} x2={lineRight} y1={crisp(cy)} y2={crisp(cy)} stroke={C.g3} strokeWidth={1} />
      {split > 0.001 ? (
        <>
          <g clipPath={`url(#${clipId}-top)`} transform={`translate(0 ${-splitOffset})`}>
            {content}
          </g>
          <g clipPath={`url(#${clipId}-bottom)`} transform={`translate(0 ${splitOffset})`}>
            {content}
          </g>
        </>
      ) : (
        content
      )}
      <rect x={labelX} y={cy - 5 * u} width={10 * u} height={10 * u} fill={hit > 0.05 ? C.ink : 'none'} stroke={hit > 0.05 ? 'none' : C.g5} opacity={0.35 + 0.65 * Math.max(hit, 0.3)} />
      <text x={labelX + 22 * u} y={cy + 6 * u} fill={hit > 0.3 ? C.ink : C.g7} fontFamily={MONO} fontSize={17 * u} fontWeight={500} letterSpacing="0.14em">
        {`${String(index + 1).padStart(2, '0')} ${label}`.slice(0, Math.ceil(clamp01(reveal / 0.55) * (label.length + 3)))}
      </text>
    </g>
  );
};
