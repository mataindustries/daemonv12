// Precision chrome around the frame: registration corners, musical position, timecode
// and a 16-bar arrangement strip that fills as the piece plays. Quiet by design.
import {ACTS} from '../timeline/acts.ts';
import {BARS, DURATION_SECONDS, FRAMES_PER_BAR, musicalTimeAtFrame} from '../timeline/grid.ts';
import {C, mono, type Stage} from '../theme.ts';

type Props = {stage: Stage; frame: number; opacity: number};

const timecode = (frame: number) => {
  const ms = Math.round((frame * 1000) / 60);
  return `00:${String(Math.floor(ms / 1000)).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
};

export const FrameChrome = ({stage, frame, opacity}: Props) => {
  if (opacity <= 0) return null;
  const {W, H, u, sx, sy} = stage;
  const m = musicalTimeAtFrame(frame);
  const corner = 18 * u;
  const stripY = H - sy * 0.62;
  const stripW = W - sx * 2;
  const playX = sx + (frame / (DURATION_SECONDS * 60)) * stripW;
  const label = {...mono(13 * u, 500, 0.14), color: C.g6, position: 'absolute' as const};
  return (
    <div style={{position: 'absolute', inset: 0, opacity}}>
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        {[
          [sx, sy, 1, 1],
          [W - sx, sy, -1, 1],
          [sx, H - sy, 1, -1],
          [W - sx, H - sy, -1, -1],
        ].map(([x, y, dx, dy], i) => (
          <path key={i} d={`M${x! + dx! * corner} ${y} L${x} ${y} L${x} ${y! + dy! * corner}`} stroke={C.g5} strokeWidth={1} fill="none" />
        ))}
        <line x1={sx} x2={sx + stripW} y1={stripY} y2={stripY} stroke={C.g3} strokeWidth={1} />
        <line x1={sx} x2={playX} y1={stripY} y2={stripY} stroke={C.g7} strokeWidth={1.5} />
        {Array.from({length: BARS + 1}, (_, bar) => {
          const x = sx + ((bar * FRAMES_PER_BAR) / (DURATION_SECONDS * 60)) * stripW;
          const actStart = ACTS.some(a => a.from === bar * FRAMES_PER_BAR) || bar === BARS;
          return <line key={bar} x1={x} x2={x} y1={stripY - (actStart ? 7 : 3) * u} y2={stripY + (actStart ? 7 : 3) * u} stroke={actStart ? C.g6 : C.g4} strokeWidth={1} />;
        })}
        <rect x={playX - 2 * u} y={stripY - 5 * u} width={4 * u} height={10 * u} fill={C.ink} />
      </svg>
      <div style={{...label, left: sx + corner + 10 * u, top: sy - 6 * u}}>DAEMONV12 · GLASS//FIRE</div>
      <div style={{...label, right: sx + corner + 10 * u, top: sy - 6 * u}}>160 BPM · 4/4 · C#m</div>
      <div style={{...label, left: sx, top: stripY - 30 * u, color: C.g7}}>
        {`BAR ${String(m.bar).padStart(2, '0')} · ${m.beat} · ${m.sixteenth}`}
      </div>
      <div style={{...label, right: sx, top: stripY - 30 * u}}>{`${timecode(frame)} · F${String(frame).padStart(4, '0')}`}</div>
    </div>
  );
};
