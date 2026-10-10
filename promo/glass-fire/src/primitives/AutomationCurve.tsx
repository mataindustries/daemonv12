// An automation lane on the shared timeline: solid where it has played, dashed ahead,
// breakpoints as squares, and a value readout riding the playhead.
import type {AutomationLane} from '../data/contract.ts';
import {automationAt, automationNormAt, formatAutomation} from '../data/signals.ts';
import {C, MONO} from '../theme.ts';
import {tx, visibleTimes, type TimeView} from './view.ts';

type Props = {
  lane: AutomationLane;
  view: TimeView;
  y: number;
  height: number;
  u?: number;
  /** Left-to-right draw-on across the visible span, 0…1. */
  reveal?: number;
  /** Opacity of the "LPF 2.4k" readout; acts gate it on automation motion. */
  labelOpacity?: number;
  showNodes?: boolean;
  opacity?: number;
  strokeWidth?: number;
};

export const curvePoints = (lane: AutomationLane, view: TimeView, y: number, height: number, from: number, to: number, step = 4) => {
  const pts: string[] = [];
  for (let x = from; x <= to + 0.01; x += step) {
    const t = view.now + (x - view.playheadX) / view.pps;
    pts.push(`${x.toFixed(1)} ${(y + height * (1 - automationNormAt(lane, t))).toFixed(1)}`);
  }
  return pts;
};

export const AutomationCurve = ({lane, view, y, height, u = 1, reveal = 1, labelOpacity = 1, showNodes = true, opacity = 1, strokeWidth = 2}: Props) => {
  if (reveal <= 0 || opacity <= 0) return null;
  const right = view.left + (view.right - view.left) * Math.min(1, reveal);
  const split = Math.min(view.playheadX, right);
  const past = split > view.left ? curvePoints(lane, view, y, height, view.left, split) : [];
  const future = right > split ? curvePoints(lane, view, y, height, split, right) : [];
  const [t0, t1] = visibleTimes(view);
  const nodes = showNodes ? lane.points.filter(p => p.t >= t0 && p.t <= t1 && tx(view, p.t) <= right) : [];
  const value = automationAt(lane, view.now);
  const py = y + height * (1 - automationNormAt(lane, view.now));
  const headVisible = view.playheadX <= right;
  return (
    <g opacity={opacity}>
      {past.length > 1 ? <path d={`M${past.join('L')}`} fill="none" stroke={C.ink} strokeWidth={strokeWidth * u} strokeLinejoin="round" /> : null}
      {future.length > 1 ? <path d={`M${future.join('L')}`} fill="none" stroke={C.g5} strokeWidth={1.2 * u} strokeDasharray={`${4 * u} ${5 * u}`} /> : null}
      {nodes.map((p, i) => {
        const x = tx(view, p.t);
        const ny = y + height * (1 - automationNormAt(lane, p.t));
        const played = p.t <= view.now;
        const s = 7 * u;
        return <rect key={`${p.t}-${i}`} x={x - s / 2} y={ny - s / 2} width={s} height={s} fill={played ? C.g8 : C.void} stroke={played ? 'none' : C.g6} strokeWidth={1} />;
      })}
      {headVisible ? (
        <>
          <circle cx={view.playheadX} cy={py} r={4.5 * u} fill={C.ink} />
          {labelOpacity > 0.01 ? (
            <text x={view.playheadX + 12 * u} y={py - 10 * u} fill={C.ink} fontFamily={MONO} fontSize={16 * u} fontWeight={600} letterSpacing="0.1em" opacity={labelOpacity}>
              {`${lane.label}  ${formatAutomation(lane, value)}`}
            </text>
          ) : null}
        </>
      ) : null}
    </g>
  );
};
