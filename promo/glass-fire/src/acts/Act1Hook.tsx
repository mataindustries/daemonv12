// ACT 1 · HOOK · frames 0–179 · bars 1–2
// A hairline, the wordmark, then the real GLASS HIT waveform born from that line. On bar
// 2 the "//" cut fractures it; each shard refactors into a related sound: the hit itself,
// its crush, its reverse. The reverse swells into the hard cut at bar 3.
import {AbsoluteFill} from 'remotion';
import {useTime, usePromoData} from '../context.tsx';
import {glassSound} from '../data/glasshouse.ts';
import {cutIn, expoIn, expoOut, impact, lerp, progress, SPRINGS, springStep, springTo, velocity, type SpringParams} from '../motion/physics.ts';
import {SampleShard} from '../primitives/SampleShard.tsx';
import {TypeHit} from '../primitives/TypeHit.tsx';
import {Waveform, type Peaks} from '../primitives/Waveform.tsx';
import {crisp} from '../primitives/view.ts';
import {C, mono, useStage} from '../theme.ts';
import {ACT} from '../timeline/acts.ts';
import {cue} from '../timeline/cues.ts';
import {framesToSeconds, SECONDS_PER_BEAT} from '../timeline/grid.ts';

const SHARD_SPRING: SpringParams = {freq: 5.5, damping: 0.6};
/** Fracture cut positions across the waveform, and the cut slant (px per px of height). */
const CUTS = [0.2, 0.46];
const SLANT = 0.42;

const slicePeak = (peaks: Peaks, from: number, to: number) => {
  let peak = 0;
  const n = peaks.max.length;
  for (let i = Math.floor(from * (n - 1)); i <= Math.ceil(to * (n - 1)); i++) peak = Math.max(peak, peaks.max[i] ?? 0, -(peaks.min[i] ?? 0));
  return peak;
};

const Flash = ({text, sub, t, t0, x, y, u}: {text: string; sub?: string; t: number; t0: number; x: number; y: number; u: number}) => {
  if (t < t0 || t >= t0 + 0.2) return null;
  return (
    <div style={{position: 'absolute', left: x, top: y, display: 'flex', gap: 16 * u, alignItems: 'baseline'}}>
      <span style={{...mono(20 * u, 600, 0.16), color: C.ink}}>{text}</span>
      {sub ? <span style={{...mono(14 * u, 500, 0.12), color: C.g6}}>{sub}</span> : null}
    </div>
  );
};

export const Act1Hook = () => {
  const data = usePromoData();
  const {t} = useTime();
  const stage = useStage();
  const {W, H, u, cx, cy} = stage;

  const tLine = cue(data, 'hairline');
  const tWord = cue(data, 'wordmark');
  const tBirth = cue(data, 'glassBirth');
  const tFracture = cue(data, 'fracture');
  const tCrush = cue(data, 'crush');
  const tReverse = cue(data, 'reverse');
  const tEnd = framesToSeconds(ACT.hook.from + ACT.hook.durationInFrames);

  const hit = glassSound('glass-hit');
  const crush = glassSound('glass-crush');
  const rev = glassSound('glass-reverse');

  const waveW = Math.min(1240 * u, W - 2 * stage.sx);
  const waveH = 380 * u;
  const waveX = cx - waveW / 2;
  const waveY = cy - waveH / 2;

  // Last 1/8 note: everything is drawn toward the centre, then the bar-3 hard cut.
  const suck = expoIn(progress(t, tEnd - SECONDS_PER_BEAT / 2, tEnd));
  const groupScale = 1 - 0.08 * suck;

  const lineW = waveW * expoOut(progress(t, tLine, tLine + 0.16));
  const born = t >= tBirth;
  const fractured = t >= tFracture;

  // Rows the shards refactor into.
  const rowW = 1040 * u;
  const rowH = 150 * u;
  const rowGap = 215 * u;
  const rows = [
    {peaks: hit, label: 'GLASS.HIT', t0: tFracture + SECONDS_PER_BEAT / 2, crush: 0, reveal: 1},
    {peaks: crush, label: 'CRUSH', t0: tCrush, crush: 0.75, reveal: 1},
    {peaks: rev, label: 'REVERSE', t0: tReverse, crush: 0, reveal: 0},
  ];
  // Reverse plays toward the bar line; its outline is written in sync with it.
  rows[2]!.reveal = progress(t, tReverse, tEnd);

  return (
    <AbsoluteFill style={{background: C.void}}>
      <AbsoluteFill style={{scale: String(groupScale)}}>
        <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
          {!fractured && lineW > 0 ? <line x1={cx - lineW / 2} x2={cx + lineW / 2} y1={crisp(cy)} y2={crisp(cy)} stroke={born ? C.g4 : C.ink} strokeWidth={1} /> : null}

          {born && !fractured ? (
            <>
              <line x1={waveX} x2={waveX + waveW} y1={crisp(waveY + waveH + 2 * u)} y2={crisp(waveY + waveH + 2 * u)} stroke={C.g3} strokeWidth={1} />
              <Waveform
                peaks={hit}
                x={waveX}
                y={waveY}
                width={waveW}
                height={waveH}
                gain={springTo(t, tBirth, 0.35, 1, SPRINGS.hit)}
                reveal={cutIn(t, tBirth, 0.11)}
                sheen={lerp(-0.25, 1.25, expoOut(progress(t, tBirth + 0.05, tBirth + 0.7)))}
                edge={0.55}
                reflection={0.22}
                chroma={7 * u * impact(t, tBirth, 0.05)}
              />
            </>
          ) : null}

          {fractured
            ? rows.map((row, i) => {
                const a = i === 0 ? 0 : CUTS[i - 1]!;
                const b = i === 2 ? 1 : CUTS[i]!;
                const shardW = (b - a) * waveW;
                const startX = waveX + ((a + b) / 2) * waveW;
                const targetY = cy + (i - 1) * rowGap;
                const launch = tFracture;
                const xAt = (time: number) => springTo(time, launch, startX, cx, SHARD_SPRING);
                const yAt = (time: number) => springTo(time, launch, cy, targetY, SHARD_SPRING);
                const spin = (i - 1) * -5 * (1 - springStep(t - launch, SPRINGS.hit));
                const scaleH = springTo(t, launch, 1, rowH / waveH, SHARD_SPRING);
                const refactored = t >= row.t0;
                if (!refactored) {
                  // Shard of the original hit with slanted "/" cut edges, flying to its row.
                  const h = waveH * scaleH;
                  const slant = (h / 2) * SLANT;
                  const padF = (waveH * SLANT) / waveW;
                  const drawFrom = Math.max(0, a - padF);
                  const drawTo = Math.min(1, b + padF);
                  const drawW = (drawTo - drawFrom) * waveW;
                  const centre = waveX + ((drawFrom + drawTo) / 2) * waveW;
                  const leftCut = waveX + a * waveW - centre;
                  const rightCut = waveX + b * waveW - centre;
                  const xFrom = (time: number) => xAt(time) + (centre - startX) * (1 - springStep(time - launch, SHARD_SPRING));
                  // Each fragment is normalized to its own peak as it flies: a refactor, not debris.
                  const localPeak = slicePeak(hit, drawFrom, drawTo);
                  const normalize = springTo(t, launch, 1, Math.min(4, hit.peak / Math.max(localPeak, 1e-3)), SHARD_SPRING);
                  return (
                    <SampleShard
                      key={i}
                      peaks={hit}
                      cx={xFrom(t)}
                      cy={yAt(t)}
                      vx={velocity(xFrom, t)}
                      vy={velocity(yAt, t)}
                      rotate={spin}
                      width={drawW}
                      height={h}
                      from={drawFrom}
                      to={drawTo}
                      gain={normalize}
                      clipPolygon={[
                        [i === 0 ? -drawW : leftCut + slant, -h / 2],
                        [i === 2 ? drawW : rightCut + slant, -h / 2],
                        [i === 2 ? drawW : rightCut - slant, h / 2],
                        [i === 0 ? -drawW : leftCut - slant, h / 2],
                      ]}
                      edge={0.5}
                      chroma={6 * u * impact(t, launch, 0.06)}
                    />
                  );
                }
                // Refactor: the fragment grows back into the complete variant.
                const p = springStep(t - row.t0, SPRINGS.hit);
                const w = lerp(shardW, rowW, Math.min(1, p));
                const fromF = lerp(a, 0, Math.min(1, p));
                const toF = lerp(b, 1, Math.min(1, p));
                return (
                  <Waveform
                    key={i}
                    peaks={row.peaks}
                    x={cx - w / 2}
                    y={targetY - rowH / 2}
                    width={w}
                    height={rowH}
                    from={i === 2 ? 0 : fromF}
                    to={i === 2 ? 1 : toF}
                    crush={row.crush}
                    reveal={i === 2 ? Math.max(0.02, row.reveal) : 1}
                    gain={i === 2 ? 1 : 0.6 + 0.4 * Math.min(1.08, p)}
                    edge={0.45}
                    chroma={6 * u * impact(t, row.t0, 0.05)}
                    tone="chrome"
                  />
                );
              })
            : null}

          {fractured && t < tFracture + 0.12
            ? CUTS.map((c, k) => {
                const x = waveX + c * waveW;
                const dx = (waveH * 0.75) * SLANT;
                const draw = expoOut(progress(t, tFracture, tFracture + 0.035));
                return (
                  <line
                    key={k}
                    x1={x + dx}
                    y1={cy - waveH * 0.75}
                    x2={x + dx - 2 * dx * draw}
                    y2={cy - waveH * 0.75 + 1.5 * waveH * draw}
                    stroke={C.ink}
                    strokeWidth={2 * u}
                    opacity={1 - progress(t, tFracture + 0.04, tFracture + 0.12)}
                  />
                );
              })
            : null}

          {t >= tReverse
            ? (() => {
                const x = cx - rowW / 2 + rowW * rows[2]!.reveal;
                const y = cy + rowGap;
                return <line x1={crisp(x)} x2={crisp(x)} y1={y - rowH * 0.7} y2={y + rowH * 0.7} stroke={C.ink} strokeWidth={1.5} />;
              })()
            : null}
        </svg>

        <TypeHit lines={['DAEMONV12']} t={t} t0={tWord} t1={tBirth} size={150 * u} weight={860} stretch={[78, 112]} tracking={0.02} x={cx} y={cy} entry="mask" collapse chroma={5 * u} />

        <Flash text="GLASS.HIT" sub={`${hit.note} · ${hit.fundamentalHz?.toFixed(1)} Hz`} t={t} t0={tBirth} x={waveX} y={waveY + waveH + 28 * u} u={u} />
        <Flash text="CRUSH" sub="−2 OCT · DRIVEN" t={t} t0={tCrush} x={cx - rowW / 2} y={cy - rowH / 2 - 34 * u} u={u} />
        <Flash text="REVERSE" sub="BLOOM → TIME-REVERSED" t={t} t0={tReverse} x={cx - rowW / 2} y={cy + rowGap - rowH / 2 - 34 * u} u={u} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
