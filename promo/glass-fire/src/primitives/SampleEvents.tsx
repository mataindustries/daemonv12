// Sample events as arrangement clips: every onset that names a GLASSHOUSE sound is drawn
// as that sound's real waveform, at its trigger time, at its true length (choked by the
// next trigger, like a monophonic sampler voice).
import type {Onset, SampleId} from '../data/contract.ts';
import {glassSound} from '../data/glasshouse.ts';
import {onsetsBetween} from '../data/signals.ts';
import {impact} from '../motion/physics.ts';
import {C} from '../theme.ts';
import {Waveform} from './Waveform.tsx';
import {tx, visibleTimes, type TimeView} from './view.ts';

type Props = {
  onsets: readonly Onset[];
  view: TimeView;
  y: number;
  height: number;
  u?: number;
  /** Sound to draw for onsets that do not name one. */
  fallback?: SampleId;
  opacity?: number;
};

export const SampleEvents = ({onsets, view, y, height, u = 1, fallback = 'glass-hit', opacity = 1}: Props) => {
  if (opacity <= 0) return null;
  const [t0, t1] = visibleTimes(view);
  const visible = onsetsBetween(onsets, t0 - 2, t1);
  return (
    <g opacity={opacity}>
      {visible.map((o, k) => {
        const next = visible[k + 1];
        const sound = glassSound(o.sample ?? fallback);
        const length = Math.min(o.duration ?? sound.seconds, sound.seconds, next ? next.t - o.t : Infinity);
        const x = tx(view, o.t);
        const w = Math.max(6 * u, length * view.pps);
        if (x + w < view.left || x > view.right) return null;
        const played = o.t <= view.now;
        const flash = impact(view.now, o.t, 0.07);
        const reverse = o.sample === 'glass-reverse';
        return (
          <g key={`${o.t}-${k}`}>
            <rect x={x} y={y} width={w} height={height} fill="none" stroke={played ? C.g4 : C.g5} strokeWidth={1} />
            <Waveform
              peaks={sound}
              x={x}
              y={y + 2 * u}
              width={w}
              height={height - 4 * u}
              to={Math.min(1, length / sound.seconds)}
              gain={0.4 + 0.6 * o.strength}
              tone={played ? (flash > 0.2 ? 'white' : 'chrome') : 'outline'}
              crush={o.sample === 'glass-crush' ? 0.65 : 0}
              chop={o.variant === 'chop' ? 3 : 0}
              edge={played ? 0.4 * flash : 0}
              opacity={played ? 0.65 + 0.35 * flash : 0.8}
            />
            {reverse ? <line x1={x + w} x2={x + w} y1={y - 4 * u} y2={y + height + 4 * u} stroke={C.ink} strokeWidth={1.5} /> : null}
          </g>
        );
      })}
    </g>
  );
};
