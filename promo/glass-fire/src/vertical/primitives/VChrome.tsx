// Precision chrome for portrait: registration corners, the musical position, timecode and a
// ten-bar strip for the cut. It lives in the top and bottom margins that platform overlays
// cover, so it is texture, never information.
import {C, mono, type Stage} from '../../theme.ts';
import {V_BARS, V_DURATION_IN_FRAMES, V_FRAMES_PER_BAR} from '../edit.ts';
import {V_SECTIONS} from '../sections.ts';

type Props = {stage: Stage; frame: number; opacity: number};

const timecode = (frame: number) => {
  const ms = Math.round((frame * 1000) / 60);
  return `00:${String(Math.floor(ms / 1000)).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
};

export const VChrome = ({stage, frame, opacity}: Props) => {
  if (opacity <= 0) return null;
  const {W, H, u} = stage;
  const sx = 64 * u;
  const sy = 72 * u;
  const corner = 18 * u;
  const stripY = H - sy * 0.62;
  const stripW = W - sx * 2;
  const playX = sx + (Math.min(frame, V_DURATION_IN_FRAMES) / V_DURATION_IN_FRAMES) * stripW;
  const beats = Math.max(0, frame) / 22.5;
  const bar = Math.min(V_BARS, Math.floor(beats / 4) + 1);
  const beat = Math.floor(beats % 4) + 1;
  const sixteenth = Math.floor((beats % 1) * 4) + 1;
  const label = {...mono(15 * u, 500, 0.14), color: C.g6, position: 'absolute' as const};
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
        {Array.from({length: V_BARS + 1}, (_, b) => {
          const x = sx + ((b * V_FRAMES_PER_BAR) / V_DURATION_IN_FRAMES) * stripW;
          const major = V_SECTIONS.some(s => s.from === b * V_FRAMES_PER_BAR) || b === V_BARS;
          return <line key={b} x1={x} x2={x} y1={stripY - (major ? 7 : 3) * u} y2={stripY + (major ? 7 : 3) * u} stroke={major ? C.g6 : C.g4} strokeWidth={1} />;
        })}
        <rect x={playX - 2 * u} y={stripY - 5 * u} width={4 * u} height={10 * u} fill={C.ink} />
      </svg>
      <div style={{...label, left: sx + corner + 10 * u, top: sy - 7 * u}}>DAEMONV12 · GLASS//FIRE</div>
      <div style={{...label, right: sx + corner + 10 * u, top: sy - 7 * u}}>160 BPM · C#m</div>
      <div style={{...label, left: sx, top: stripY - 32 * u, color: C.g7}}>{`BAR ${String(bar).padStart(2, '0')} · ${beat} · ${sixteenth}`}</div>
      <div style={{...label, right: sx, top: stripY - 32 * u}}>{`${timecode(frame)} · F${String(Math.max(0, frame)).padStart(3, '0')}`}</div>
    </div>
  );
};
