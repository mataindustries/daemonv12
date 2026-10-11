// The 160 BPM grid: bar lines, beat lines, optional sixteenth ticks and bar numbers.
// Beat times come from the rational grid (exact), positions from the shared TimeView.
import {beatsBetween, SECONDS_PER_BEAT} from '../timeline/grid.ts';
import {C, MONO} from '../theme.ts';
import {crisp, tx, visibleTimes, type TimeView} from './view.ts';

type Props = {
  view: TimeView;
  y: number;
  height: number;
  /** Top-down draw-on of every line, 0…1. */
  reveal?: number;
  sixteenths?: boolean;
  numbers?: boolean;
  numberY?: number;
  u?: number;
  opacity?: number;
};

export const BeatGrid = ({view, y, height, reveal = 1, sixteenths = false, numbers = true, numberY, u = 1, opacity = 1}: Props) => {
  if (reveal <= 0 || opacity <= 0) return null;
  const [t0, t1] = visibleTimes(view);
  const beats = beatsBetween(t0, t1);
  const h = height * reveal;
  return (
    <g opacity={opacity}>
      {sixteenths
        ? beats.flatMap(b =>
            [1, 2, 3].map(k => {
              const x = crisp(tx(view, b.seconds + (k * SECONDS_PER_BEAT) / 4));
              return x < view.left || x > view.right ? null : <line key={`${b.index}.${k}`} x1={x} x2={x} y1={y} y2={y + 6 * u * reveal} stroke={C.g4} strokeWidth={1} />;
            }),
          )
        : null}
      {beats.map(b => {
        const x = crisp(tx(view, b.seconds));
        if (x < view.left || x > view.right) return null;
        return <line key={b.index} x1={x} x2={x} y1={y} y2={y + h} stroke={b.isBar ? C.g4 : C.g3} strokeWidth={1} />;
      })}
      {numbers
        ? beats
            .filter(b => b.isBar && b.bar <= 16)
            .map(b => {
              const x = tx(view, b.seconds);
              if (x < view.left || x > view.right - 30 * u) return null;
              return (
                <text key={`n${b.index}`} x={x + 6 * u} y={(numberY ?? y) + 14 * u} fill={C.g6} fontFamily={MONO} fontSize={13 * u} letterSpacing="0.08em" opacity={reveal}>
                  {String(b.bar).padStart(2, '0')}
                </text>
              );
            })
        : null}
    </g>
  );
};
