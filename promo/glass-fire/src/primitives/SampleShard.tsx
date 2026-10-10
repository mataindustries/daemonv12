// A fragment of a real GLASSHOUSE waveform moving through space. Position, rotation and
// velocity come from the caller's closed-form motion; the shard turns velocity into a
// directional smear, so fast throws blur along their path and settle crisp.
import {smear} from '../motion/physics.ts';
import {Waveform, type WaveformProps} from './Waveform.tsx';

export type SampleShardProps = Omit<WaveformProps, 'x' | 'y' | 'blurX' | 'blurY'> & {
  /** Centre of the shard in stage px. */
  cx: number;
  cy: number;
  /** Velocity in px/s, for motion blur. */
  vx?: number;
  vy?: number;
  rotate?: number;
  scale?: number;
};

export const SampleShard = ({cx, cy, vx = 0, vy = 0, rotate = 0, scale = 1, width, height, ...wave}: SampleShardProps) => {
  if ((wave.opacity ?? 1) <= 0 || scale <= 0) return null;
  return (
    <g transform={`translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${rotate.toFixed(3)}) scale(${scale.toFixed(4)})`}>
      <Waveform {...wave} x={-width / 2} y={-height / 2} width={width} height={height} blurX={smear(vx) / 3} blurY={smear(vy) / 3} />
    </g>
  );
};
