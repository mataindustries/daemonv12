// ACT 3 · DROP 1 · frames 360–719 · bars 5–8
// Maximum first-wave motion, all of it read from data: six lanes scrolling at 720 px/s,
// real sample clips on GLASS and VOX, spectral energy, the master envelope, transient
// lines on claps and a body punch on kicks. Typography cuts the system away: NO DAW.
// over a dimmed system, the stop as pure black, then JUST TOOLS. alone on black.
import {AbsoluteFill} from 'remotion';
import {useTime, usePromoData} from '../context.tsx';
import type {PromoData} from '../data/contract.ts';
import {envAt, hitAt, lastOnset, stopAt} from '../data/signals.ts';
import {impact, SPRINGS, springTo} from '../motion/physics.ts';
import {Arrangement, LANES_FULL} from '../primitives/Arrangement.tsx';
import {TypeHit} from '../primitives/TypeHit.tsx';
import {crisp, tx, type TimeView} from '../primitives/view.ts';
import {C, MONO, useStage} from '../theme.ts';
import {cue} from '../timeline/cues.ts';

/** Time the first stop after `from` begins, or `fallback`. */
export const stopAfter = (data: PromoData, from: number, fallback: number) => data.markers.find(m => m.kind === 'stop' && m.t > from && m.t < fallback)?.t ?? fallback;

export const Act3Drop1 = () => {
  const data = usePromoData();
  const {t} = useTime();
  const stage = useStage();
  const {W, H, u, sx} = stage;
  if (stopAt(data.markers, t)) return <AbsoluteFill style={{background: C.void}} />;

  const tDrop = cue(data, 'drop1');
  const tNoDaw = cue(data, 'noDaw');
  const tJust = cue(data, 'justTools');
  const tJustOut = cue(data, 'justToolsOut');
  const tNoDawOut = stopAfter(data, tNoDaw, tJust);
  const justOnBlack = t >= tJust && t < tJustOut;
  const typeDim = t >= tNoDaw && t < tNoDawOut ? 0.16 : 1;

  const kick = hitAt(data.stems.kick.onsets, t, {decay: 0.07});
  const clap = lastOnset(data.stems.clap.onsets, t);
  const left = sx + 210 * u;
  const right = W - sx;
  const view: TimeView = {now: t, playheadX: W / 2, pps: 720 * u, left, right};
  const top = 178 * u;
  const laneHeight = 88 * u;
  const laneGap = 18 * u;
  const specY = 840 * u;
  const specH = 100 * u;

  // The drop lands with one scale punch; every kick after it nudges the whole body.
  const landing = springTo(t, tDrop, 1.07, 1, SPRINGS.hit);
  const body = landing * (1 + 0.01 * kick);

  // Master amplitude, drawn over the spectrum strip behind the playhead.
  const master: string[] = [];
  for (let x = left; x <= view.playheadX; x += 3) {
    const tt = t + (x - view.playheadX) / view.pps;
    master.push(`${x.toFixed(1)} ${(specY + specH - envAt(data.master.envelope, tt) * specH).toFixed(1)}`);
  }

  const clapFlash = clap ? impact(t, clap.onset.t, 0.05) * clap.onset.strength : 0;

  return (
    <AbsoluteFill style={{background: C.void}}>
      {!justOnBlack ? (
        <AbsoluteFill style={{opacity: typeDim, scale: String(body), translate: `0px ${(kick * 5 * u).toFixed(2)}px`}}>
          <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
            <Arrangement
              data={data}
              stage={stage}
              view={view}
              lanes={LANES_FULL}
              top={top}
              laneHeight={laneHeight}
              laneGap={laneGap}
              labelX={sx}
              sixteenths
              waveGain={1.2}
              sampleLanes={['glass', 'vox']}
              automation={[{laneId: 'vox.delay', over: 'vox', label: 'motion'}]}
              spectrum={{y: specY, height: specH}}
              iris
            >
              {master.length > 1 ? <path d={`M${master.join('L')}`} fill="none" stroke={C.ink} strokeWidth={1.5 * u} /> : null}
              <text x={sx} y={specY + 14 * u} fill={C.g6} fontFamily={MONO} fontSize={13 * u} letterSpacing="0.14em">
                SPECTRUM
              </text>
              <text x={sx} y={specY + specH} fill={C.g6} fontFamily={MONO} fontSize={13 * u} letterSpacing="0.14em">
                MASTER
              </text>
              {clapFlash > 0.02 ? <line x1={crisp(tx(view, clap!.onset.t))} x2={crisp(tx(view, clap!.onset.t))} y1={0} y2={H} stroke={C.ink} strokeWidth={2 * u} opacity={clapFlash} /> : null}
            </Arrangement>
          </svg>
        </AbsoluteFill>
      ) : null}

      {/* Drop impact: transient lines snap across the full frame. */}
      {t >= tDrop && t < tDrop + 0.12 ? (
        <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
          {[0.18, 0.31, 0.62, 0.83].map((f, i) => (
            <line key={i} x1={0} x2={W} y1={crisp(H * f)} y2={crisp(H * f)} stroke={C.ink} strokeWidth={i % 2 ? 1 : 3 * u} opacity={impact(t, tDrop + i / 120, 0.03)} />
          ))}
        </svg>
      ) : null}

      <TypeHit
        lines={['NO DAW.']}
        t={t}
        t0={tNoDaw}
        t1={tNoDawOut}
        size={270 * u}
        weight={900}
        stretch={[125, 125]}
        tracking={-0.03}
        x={W / 2}
        y={H / 2}
        entry="slam"
        punch={{onsets: data.stems.kick.onsets, amount: 0.035}}
        chroma={9 * u}
      />
      <TypeHit
        lines={['JUST TOOLS.']}
        t={t}
        t0={tJust}
        t1={tJustOut}
        size={250 * u}
        weight={880}
        stretch={[62, 112]}
        tracking={-0.03}
        x={W / 2}
        y={H / 2}
        entry="stretch"
        chroma={7 * u}
      />
    </AbsoluteFill>
  );
};
