// The glass identity: a real GLASSHOUSE waveform outline drawn as a glossy object.
// Data-driven by min/max peaks; every visual mutation (reverse, crush, chop, slice) is a
// transformation of the same data, mirroring how the pack derives its sounds.
import {useId} from 'react';
import {C, IRIS} from '../theme.ts';

export type Peaks = {min: readonly number[]; max: readonly number[]; peak: number};

export type WaveformTone = 'chrome' | 'white' | 'graphite' | 'outline';

export type WaveformProps = {
  peaks: Peaks;
  /** Box: the waveform's zero line runs through its vertical centre. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Amplitude multiplier; 1 = the sound's own peak touches the box edge. */
  gain?: number;
  /** Portion of the sound to draw, 0…1 (shards). */
  from?: number;
  to?: number;
  /** Left-to-right write-on, 0…1. */
  reveal?: number;
  reverse?: boolean;
  /** 0…1: quantize amplitude and sample-and-hold, the visual of bit/rate reduction. */
  crush?: number;
  /** Gate into this many slices (0 = off). */
  chop?: number;
  tone?: WaveformTone;
  /** Opacity of the thin-film edge stroke. */
  edge?: number;
  /** Specular band position across the width, roughly −0.2…1.2; null hides it. */
  sheen?: number | null;
  /** Opacity of the floor reflection. */
  reflection?: number;
  /** Chromatic fringe in px. */
  chroma?: number;
  blurX?: number;
  blurY?: number;
  opacity?: number;
  /** Optional clip polygon in stage coordinates (fracture cuts). */
  clipPolygon?: readonly (readonly [number, number])[];
};

const sid = (raw: string) => raw.replace(/[^a-zA-Z0-9_-]/g, '');

export const waveformPath = (
  peaks: Peaks,
  {x, y, width, height, gain = 1, from = 0, to = 1, reverse = false, crush = 0, chop = 0}: Pick<WaveformProps, 'x' | 'y' | 'width' | 'height' | 'gain' | 'from' | 'to' | 'reverse' | 'crush' | 'chop'>,
): string => {
  const n = peaks.max.length;
  const i0 = Math.max(0, Math.floor(from * (n - 1)));
  const i1 = Math.min(n - 1, Math.ceil(to * (n - 1)));
  const count = i1 - i0 + 1;
  if (count < 2 || gain <= 0) return '';
  const norm = peaks.peak > 0 ? 1 / peaks.peak : 1;
  const hold = crush > 0 ? 1 + Math.round(crush * 9) : 1;
  const levels = crush > 0 ? Math.max(3, Math.round(40 - crush * 36)) : 0;
  const quant = (v: number) => (levels ? Math.round(v * levels) / levels : v);
  const cy = y + height / 2;
  const amp = (height / 2) * gain;
  const tops: [number, number][] = [];
  const bottoms: [number, number][] = [];
  let prevTop = NaN;
  let prevBottom = NaN;
  for (let k = 0; k < count; k++) {
    const held = k - (k % hold);
    const i = i0 + held;
    const j = reverse ? n - 1 - i : i;
    let top = quant(Math.min(1, (peaks.max[j] ?? 0) * norm));
    let bottom = quant(Math.max(-1, (peaks.min[j] ?? 0) * norm));
    if (chop > 0 && ((k / count) * chop) % 1 > 0.56) {
      top = 0;
      bottom = 0;
    }
    const px = x + (k / (count - 1)) * width;
    const ty = cy - top * amp;
    const by = cy - bottom * amp;
    if (hold > 1 || chop > 0) {
      if (!Number.isNaN(prevTop) && ty !== prevTop) tops.push([px, prevTop]);
      if (!Number.isNaN(prevBottom) && by !== prevBottom) bottoms.push([px, prevBottom]);
    }
    tops.push([px, ty]);
    bottoms.push([px, by]);
    prevTop = ty;
    prevBottom = by;
  }
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(tops[0]![0])} ${f(cy)}`;
  for (const [px, py] of tops) d += `L${f(px)} ${f(py)}`;
  d += `L${f(x + width)} ${f(cy)}`;
  for (let k = bottoms.length - 1; k >= 0; k--) d += `L${f(bottoms[k]![0])} ${f(bottoms[k]![1])}`;
  return d + 'Z';
};

export const Waveform = (props: WaveformProps) => {
  const {x, y, width, height, reveal = 1, tone = 'chrome', edge = 0, sheen = null, reflection = 0, chroma = 0, blurX = 0, blurY = 0, opacity = 1, clipPolygon} = props;
  const id = sid(useId());
  const d = waveformPath(props.peaks, props);
  if (!d || opacity <= 0 || reveal <= 0) return null;
  const blurred = blurX > 0.3 || blurY > 0.3;
  const fill = tone === 'chrome' ? `url(#${id}-chrome)` : tone === 'white' ? C.ink : tone === 'graphite' ? C.g5 : 'none';
  const floor = y + height;
  const sheenWidth = width * 0.28;
  return (
    <g opacity={opacity} filter={blurred ? `url(#${id}-blur)` : undefined} clipPath={clipPolygon ? `url(#${id}-cut)` : undefined}>
      <defs>
        <linearGradient id={`${id}-chrome`} gradientUnits="userSpaceOnUse" x1={0} y1={y} x2={0} y2={y + height}>
          <stop offset={0} stopColor="#FFFFFF" />
          <stop offset={0.5} stopColor="#F2F2F2" />
          <stop offset={0.5} stopColor="#BFC1C5" />
          <stop offset={1} stopColor="#80838A" />
        </linearGradient>
        <linearGradient id={`${id}-iris`} gradientUnits="userSpaceOnUse" x1={x} y1={0} x2={x + width} y2={0}>
          {IRIS.map((c, i) => (
            <stop key={c} offset={i / (IRIS.length - 1)} stopColor={c} />
          ))}
        </linearGradient>
        {sheen !== null ? (
          <linearGradient id={`${id}-sheen`} gradientUnits="userSpaceOnUse" x1={x + sheen * width - sheenWidth / 2} y1={0} x2={x + sheen * width + sheenWidth / 2} y2={0}>
            <stop offset={0} stopColor="#FFFFFF" />
            <stop offset={0.3} stopColor={IRIS[0]} />
            <stop offset={0.5} stopColor={IRIS[1]} />
            <stop offset={0.7} stopColor={IRIS[2]} />
            <stop offset={1} stopColor="#FFFFFF" />
          </linearGradient>
        ) : null}
        <linearGradient id={`${id}-fade`} gradientUnits="userSpaceOnUse" x1={0} y1={floor} x2={0} y2={floor + height * 0.55}>
          <stop offset={0} stopColor="#FFFFFF" stopOpacity={0.5} />
          <stop offset={1} stopColor="#FFFFFF" stopOpacity={0} />
        </linearGradient>
        <clipPath id={`${id}-reveal`}>
          <rect x={x - 2} y={y - height} width={(width + 4) * Math.min(1, reveal)} height={height * 3} />
        </clipPath>
        <clipPath id={`${id}-shape`}>
          <path d={d} />
        </clipPath>
        {clipPolygon ? (
          <clipPath id={`${id}-cut`}>
            <polygon points={clipPolygon.map(p => p.join(',')).join(' ')} />
          </clipPath>
        ) : null}
        {blurred ? (
          <filter id={`${id}-blur`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={`${blurX.toFixed(2)} ${blurY.toFixed(2)}`} />
          </filter>
        ) : null}
      </defs>
      <g clipPath={`url(#${id}-reveal)`}>
        {reflection > 0 ? (
          <path d={d} fill={`url(#${id}-fade)`} opacity={reflection} transform={`translate(0 ${2 * floor + height * 0.04}) scale(1 -1)`} />
        ) : null}
        {chroma > 0.2 ? (
          <>
            <path d={d} fill={IRIS[0]} transform={`translate(${-chroma} 0)`} opacity={0.85} />
            <path d={d} fill={IRIS[2]} transform={`translate(${chroma} 0)`} opacity={0.85} />
          </>
        ) : null}
        <path d={d} fill={fill} stroke={tone === 'outline' ? C.g6 : 'none'} strokeWidth={tone === 'outline' ? 1 : 0} />
        {sheen !== null && sheen > -0.3 && sheen < 1.3 ? (
          <rect
            x={x + sheen * width - sheenWidth / 2}
            y={y}
            width={sheenWidth}
            height={height}
            fill={`url(#${id}-sheen)`}
            clipPath={`url(#${id}-shape)`}
            style={{mixBlendMode: 'multiply'}}
          />
        ) : null}
        {edge > 0 ? <path d={d} fill="none" stroke={`url(#${id}-iris)`} strokeWidth={1.4} opacity={edge} /> : null}
      </g>
    </g>
  );
};
