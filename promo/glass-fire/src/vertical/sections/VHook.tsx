// 1 · HOOK · output bar 1 · frames 0–89 · song bar 4 (the pre-drop)
// Frame 0 is the thumbnail: the wordmark over the real GLASS.HIT waveform, struck by the bar's
// first TING, with the machinery already running behind it. The tagline is played in by the
// hook's own rhythm (ti-ti TANG). The glass ruff then cracks the waveform open, one "//" cut per
// real glass hit; the master gate's stop blacks the machinery out and the copy holds alone over
// the silence into the drop.
import {AbsoluteFill} from 'remotion';
import {glassSound} from '../../data/glasshouse.ts';
import {hitAt} from '../../data/signals.ts';
import {expoOut, impact, lerp, progress, SPRINGS, springStep} from '../../motion/physics.ts';
import {LANES_FULL} from '../../primitives/Arrangement.tsx';
import {TypeHit} from '../../primitives/TypeHit.tsx';
import {Waveform} from '../../primitives/Waveform.tsx';
import {C, mono, useStage} from '../../theme.ts';
import {Machinery, useOutTime, useVData} from '../context.tsx';
import {triggersBetween, type VData} from '../data.ts';
import {vCue} from '../cues.ts';
import {SAFE_CX} from '../layout.ts';
import {V_SECTION} from '../sections.ts';
import {Columns} from '../primitives/Columns.tsx';
import {firstStopIn, HOOK_COLUMNS, sampleLanesOf} from './shared.ts';

export const HERO = {x: 140, y: 610, width: 800, height: 250};
/** Where successive "//" cuts land across the waveform, in the order the ruff makes them. */
const CUT_AT = [0.5, 0.27, 0.73, 0.39, 0.61, 0.15, 0.86, 0.45, 0.56];
const SLANT = 0.42;
const GAP = 16;

export type HeroSlice = {from: number; to: number; dx: number; dy: number; padFrom: number; padTo: number};

/** The hero waveform's slices at time t: one per glass hit of the ruff, each crack springing open. */
export const heroSlices = (data: VData, t: number): HeroSlice[] => {
  const tRoll = vCue(data.promo, 'roll');
  const tStop = firstStopIn(data, V_SECTION.hook) ?? V_SECTION.hook.durationInFrames / 60;
  const hits = triggersBetween(data.triggers, tRoll - 0.001, tStop, tr => tr.sample === 'glass-hit' && tr.track === 'glass');
  const cuts = hits.slice(0, CUT_AT.length).map((h, k) => ({at: CUT_AT[k]!, t: h.t})).filter(c => c.t <= t);
  const edges = [0, ...cuts.map(c => c.at).sort((a, b) => a - b), 1];
  const open = (c: {t: number}) => springStep(t - c.t, SPRINGS.hit);
  const total = cuts.reduce((sum, c) => sum + GAP * open(c), 0);
  const pad = (HERO.height * 0.55 * SLANT) / HERO.width;
  return edges.slice(0, -1).map((from, i) => {
    const to = edges[i + 1]!;
    const pushed = cuts.filter(c => c.at <= from + 1e-9).reduce((sum, c) => sum + GAP * open(c), 0);
    const shear = cuts.filter(c => c.at <= from + 1e-9).reduce((sum, c, k) => sum + (k % 2 ? -1 : 1) * 7 * open(c), 0);
    return {from, to, dx: pushed - total / 2, dy: shear, padFrom: i === 0 ? 0 : pad, padTo: i === edges.length - 2 ? 0 : pad};
  });
};

/** The hero waveform in its current slices. Used by the hook and by Drop 1's opening shatter. */
export const HeroGlass = ({data, t, slices, offset = () => ({x: 0, y: 0, r: 0}), opacity = 1, chroma = 0, sheen = null}: {
  data: VData;
  t: number;
  slices: HeroSlice[];
  offset?: (slice: HeroSlice, index: number) => {x: number; y: number; r: number};
  opacity?: number;
  chroma?: number;
  sheen?: number | null;
}) => {
  const hit = glassSound('glass-hit');
  const pulse = hitAt(data.promo.stems.glass.onsets, t, {decay: 0.09});
  const {x, y, width, height} = HERO;
  const s = (height / 2) * SLANT;
  const floor = y + height * 1.6;
  return (
    <g opacity={opacity}>
      {slices.map((slice, i) => {
        const o = offset(slice, i);
        const from = Math.max(0, slice.from - slice.padFrom);
        const to = Math.min(1, slice.to + slice.padTo);
        const left = x + slice.from * width;
        const right = x + slice.to * width;
        const whole = slices.length === 1;
        return (
          <g key={`${slice.from}`} transform={`translate(${(slice.dx + o.x).toFixed(2)} ${(slice.dy + o.y).toFixed(2)}) rotate(${o.r.toFixed(3)} ${((left + right) / 2).toFixed(1)} ${(y + height / 2).toFixed(1)})`}>
            <Waveform
              peaks={hit}
              x={x + from * width}
              y={y}
              width={(to - from) * width}
              height={height}
              from={from}
              to={to}
              gain={1 + 0.1 * pulse}
              edge={0.6}
              sheen={whole ? sheen : null}
              reflection={0.2}
              chroma={chroma}
              clipPolygon={
                whole
                  ? undefined
                  : [
                      [slice.padFrom ? left + s * 1.4 : x - 40, y - height],
                      [slice.padTo ? right + s * 1.4 : x + width + 40, y - height],
                      [slice.padTo ? right - s * 1.4 * 1.6 : x + width + 40, floor],
                      [slice.padFrom ? left - s * 1.4 * 1.6 : x - 40, floor],
                    ]
              }
            />
          </g>
        );
      })}
    </g>
  );
};

export const VHook = () => {
  const data = useVData();
  const {t} = useOutTime();
  const stage = useStage();
  const {W, H, u} = stage;
  const promo = data.promo;

  const tWord = vCue(promo, 'wordmark');
  const tBuilt = vCue(promo, 'built');
  const tInstruments = vCue(promo, 'instruments');
  const tAgents = vCue(promo, 'agents');
  const tEnd = (V_SECTION.hook.from + V_SECTION.hook.durationInFrames) / 60;
  const tStop = firstStopIn(data, V_SECTION.hook) ?? tEnd;
  const dark = t >= tStop;

  const glassHits = promo.stems.glass.onsets;
  const lastHit = [...glassHits].reverse().find(o => o.t <= t + 1e-9);
  const sheen = lastHit && lastHit.t > 0.01 ? lerp(-0.25, 1.25, expoOut(progress(t, lastHit.t, lastHit.t + 0.55))) : lerp(0.32, 1.25, expoOut(progress(t, 0.05, 0.65)));
  const slices = heroSlices(data, t);
  const kick = hitAt(promo.stems.kick.onsets, t, {decay: 0.07});

  return (
    <AbsoluteFill style={{background: C.void}}>
      <Machinery>
        {!dark ? (
          <AbsoluteFill style={{translate: `0px ${(kick * 4 * u).toFixed(2)}px`}}>
            <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
              <g opacity={0.36}>
                <Columns data={promo} stage={stage} geometry={HOOK_COLUMNS} now={t} lanes={LANES_FULL} sixteenths waveGain={1.2} sampleLanes={sampleLanesOf(data)} iris />
              </g>
              <HeroGlass data={data} t={t} slices={slices} sheen={sheen} chroma={6 * u * Math.max(impact(t, lastHit?.t ?? 0, 0.06), 0)} />
            </svg>
          </AbsoluteFill>
        ) : null}
      </Machinery>

      <div style={{position: 'absolute', left: SAFE_CX, top: 318 * u, translate: '-50% 0', ...mono(24 * u, 600, 0.16), color: C.g8}}>GLASS//FIRE · MADE BY AN AGENT</div>
      <TypeHit lines={['DAEMONV12']} t={t} t0={tWord} t1={tEnd} size={104 * u} weight={860} stretch={[100, 100]} tracking={0.02} x={SAFE_CX} y={470 * u} entry="cut" punch={{onsets: glassHits, amount: 0.025}} />
      <TypeHit lines={['I BUILT']} t={t} t0={tBuilt} t1={tEnd} size={106 * u} weight={900} tracking={-0.02} x={SAFE_CX} y={1068 * u} entry="cut" chroma={6 * u} />
      <TypeHit lines={['INSTRUMENTS']} t={t} t0={tInstruments} t1={tEnd} size={106 * u} weight={900} stretch={[86, 86]} tracking={-0.02} x={SAFE_CX} y={1164 * u} entry="cut" chroma={6 * u} />
      <TypeHit lines={['FOR AGENTS.']} t={t} t0={tAgents} t1={tEnd} size={106 * u} weight={900} stretch={[92, 92]} tracking={-0.02} x={SAFE_CX} y={1260 * u} entry="cut" chroma={6 * u} />
    </AbsoluteFill>
  );
};
