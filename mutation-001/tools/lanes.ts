/**
 * Extra lane helpers for Mutations B and C. A new file so that score.ts, whose SHA-256 is recorded in Mutation A's
 * manifest, stays byte-identical.
 */
import { smooth } from './dsp.ts';
import type { Lane } from './score.ts';

/** Stepped lane: holds each [seconds, value] point's value, gliding into it over `glide` seconds (smoothstep). */
export function steps(points: [number, number][], glide: number): Lane {
  return (t: number) => {
    let i = -1;
    for (let k = 0; k < points.length; k++) if (t >= points[k]![0]) i = k; else break;
    if (i < 0) return points[0]![1];
    const from = i > 0 ? points[i - 1]![1] : points[0]![1], [ti, vi] = points[i]!;
    return from + (vi - from) * smooth((t - ti) / Math.max(1e-6, glide));
  };
}
/** Shift a lane in time (lane(t - offset)). */
export const shifted = (lane: Lane, offset: number): Lane => (t: number) => lane(t - offset);
