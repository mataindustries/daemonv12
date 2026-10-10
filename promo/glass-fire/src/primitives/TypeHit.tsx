// Rhythm-driven typography. A TypeHit exists only inside [t0, t1): it lands on a musical
// event with a physical entry (slam, mask, width-stretch or hard cut), can punch on a
// stem's onsets while held, and leaves on a hard cut or a collapse to its baseline.
import type {CSSProperties} from 'react';
import type {Onset} from '../data/contract.ts';
import {hitAt} from '../data/signals.ts';
import {clamp01, impact, SPRINGS, springStep, springTo} from '../motion/physics.ts';
import {C, display, IRIS} from '../theme.ts';

export type TypeEntry = 'slam' | 'mask' | 'stretch' | 'cut';

export type TypeHitProps = {
  lines: readonly string[];
  t: number;
  t0: number;
  t1: number;
  size: number;
  weight?: number;
  /** font-stretch %: [at entry, settled]. Archivo spans 62–125. */
  stretch?: readonly [number, number];
  tracking?: number;
  /** Anchor point in stage px. */
  x: number;
  y: number;
  align?: 'left' | 'center' | 'right';
  entry?: TypeEntry;
  /** Seconds between successive lines appearing. */
  stagger?: number;
  punch?: {onsets: readonly Onset[]; amount: number};
  /** Chromatic fringe in px at the moment of entry. */
  chroma?: number;
  color?: string;
  lineGap?: number;
  /** Collapse to a hairline over the last few frames instead of a hard cut. */
  collapse?: boolean;
  style?: CSSProperties;
};

export const TypeHit = ({
  lines,
  t,
  t0,
  t1,
  size,
  weight = 800,
  stretch = [100, 100],
  tracking = -0.02,
  x,
  y,
  align = 'center',
  entry = 'slam',
  stagger = 0,
  punch,
  chroma = 0,
  color = C.ink,
  lineGap = 0.02,
  collapse = false,
  style,
}: TypeHitProps) => {
  if (t < t0 || t >= t1) return null;
  const dt = t - t0;
  const scaleIn = entry === 'slam' ? springTo(t, t0, 1.2, 1, SPRINGS.hit) : 1;
  const punchScale = punch ? 1 + punch.amount * hitAt(punch.onsets, t, {decay: 0.085}) : 1;
  const out = collapse ? clamp01((t1 - t) / 0.06) : 1;
  const fringe = chroma * impact(t, t0, 0.07) + (punch ? chroma * 0.4 * hitAt(punch.onsets, t, {decay: 0.05}) : 0);
  const mask = entry === 'mask' ? springStep(dt, SPRINGS.lock) : 1;
  const blur = entry === 'slam' ? Math.max(0, 8 * (1 - dt / 0.04)) : 0;
  const s = entry === 'stretch' ? springTo(t, t0, stretch[0], stretch[1], SPRINGS.snap) : stretch[1];
  const anchorX = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0%';
  const base = display(size, weight, s, tracking);

  const block = (fill: string, offset: number, key: string, blend?: CSSProperties['mixBlendMode']) => (
    <div
      key={key}
      style={{
        position: 'absolute',
        inset: 0,
        color: fill,
        translate: `${offset}px 0`,
        mixBlendMode: blend,
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        gap: size * lineGap,
      }}
    >
      {lines.map((line, i) => (
        <div key={i} style={{visibility: t >= t0 + i * stagger ? 'visible' : 'hidden'}}>
          {line}
        </div>
      ))}
    </div>
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        translate: `${anchorX} -50%`,
        scale: `${scaleIn * punchScale} ${scaleIn * punchScale * out}`,
        clipPath: mask < 1 ? `inset(${((1 - mask) * 50).toFixed(2)}% 0 ${((1 - mask) * 50).toFixed(2)}% 0)` : undefined,
        filter: blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : undefined,
        ...base,
        ...style,
      }}
    >
      {/* In-flow copy sizes the box; the absolute layers draw. */}
      <div style={{visibility: 'hidden', display: 'flex', flexDirection: 'column', gap: size * lineGap}}>
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
      {fringe > 0.25 ? [block(IRIS[0], -fringe, 'c', 'screen'), block(IRIS[2], fringe, 'm', 'screen')] : null}
      {block(color, 0, 'main')}
    </div>
  );
};
