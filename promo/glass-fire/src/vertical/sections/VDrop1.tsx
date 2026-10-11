// 2 · DROP 1 · output bars 2–3 · frames 90–269 · song bars 5 and 8
// The machinery, all of it read from the cut: six columns where every GLASSHOUSE trigger is drawn
// as its own waveform falling into a horizontal playhead, the real gain automation running down
// the SUB and GLASS columns, sample names flashing where they fire. On the drop the hook's cracked
// glass shatters outward and the playhead rises into place. COMPOSE. PROCESS. RENDER. each hold
// for two beats, each over a fact from the render; the last beats belong to the fill.
import {AbsoluteFill} from 'remotion';
import {hitAt, lastOnset} from '../../data/signals.ts';
import {expoOut, hash01, impact, lerp, progress, SPRINGS, springTo} from '../../motion/physics.ts';
import {LANES_FULL} from '../../primitives/Arrangement.tsx';
import {TypeHit} from '../../primitives/TypeHit.tsx';
import {crisp} from '../../primitives/view.ts';
import {C, mono, useStage} from '../../theme.ts';
import {Machinery, useOutTime, useVData} from '../context.tsx';
import type {VData} from '../data.ts';
import {vCue} from '../cues.ts';
import {SAFE_CX} from '../layout.ts';
import {Columns, timeY, type ColumnsGeometry} from '../primitives/Columns.tsx';
import {TriggerTags} from '../primitives/TriggerTags.tsx';
import {DROP1_COLUMNS, HOOK_COLUMNS, sampleLanesOf} from './shared.ts';
import {HeroGlass, heroSlices} from './VHook.tsx';

/** One fact per verb, from the render manifest; tool names when the data has no render report. */
export const verbFacts = (data: VData): [string, string, string] => {
  const r = data.render;
  if (!r) return ['daemonv12_project_patch', 'daemonv12_project_validate', 'daemonv12_render'];
  const signed = (v: number) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`;
  return [
    `${r.tracks} TRACKS · ${data.song.triggers} SAMPLE HITS`,
    `${data.song.automationLanes} AUTOMATION LANES · MASTER GATE`,
    `${signed(r.integratedLufs)} LUFS · ${signed(r.truePeakDbfs)} dBTP · ${r.clippedSamples} CLIPS`,
  ];
};

export const VDrop1 = () => {
  const data = useVData();
  const {t} = useOutTime();
  const stage = useStage();
  const {W, H, u} = stage;
  const promo = data.promo;

  const tDrop = vCue(promo, 'drop1');
  const tProcess = vCue(promo, 'process');
  const tRender = vCue(promo, 'render');
  const tOut = vCue(promo, 'wordsOut');
  const facts = verbFacts(data);
  const words = [
    {text: 'COMPOSE.', fact: facts[0], t0: tDrop, t1: tProcess, stretch: 100},
    {text: 'PROCESS.', fact: facts[1], t0: tProcess, t1: tRender, stretch: 100},
    {text: 'RENDER.', fact: facts[2], t0: tRender, t1: tOut, stretch: 125},
  ];
  const wordOn = words.some(w => t >= w.t0 && t < w.t1);

  const kick = hitAt(promo.stems.kick.onsets, t, {decay: 0.07});
  const landing = springTo(t, tDrop, 1.07, 1, SPRINGS.hit);
  const body = landing * (1 + 0.01 * kick);
  // The hook's low playhead rises into the drop layout with one heavy overshoot.
  const geometry: ColumnsGeometry = {...DROP1_COLUMNS, playheadY: springTo(t, tDrop, HOOK_COLUMNS.playheadY, DROP1_COLUMNS.playheadY, SPRINGS.heavy)};
  const clap = lastOnset(promo.stems.clap.onsets, t);
  const clapFlash = clap ? impact(t, clap.onset.t, 0.05) * clap.onset.strength : 0;

  // The hook's cracked glass, shattering outward from where it hung.
  const slices = heroSlices(data, tDrop - 1e-3);
  const burst = expoOut(progress(t, tDrop, tDrop + 0.42));
  const shatterOpacity = 1 - progress(t, tDrop + 0.12, tDrop + 0.42);

  return (
    <AbsoluteFill style={{background: C.void}}>
      <Machinery>
        <AbsoluteFill style={{opacity: wordOn ? 0.62 : 1, scale: String(body), translate: `0px ${(kick * 5 * u).toFixed(2)}px`}}>
          <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
            <Columns
              data={promo}
              stage={stage}
              geometry={geometry}
              now={t}
              lanes={LANES_FULL}
              sixteenths
              waveGain={1.2}
              sampleLanes={sampleLanesOf(data)}
              automation={[
                {laneId: 'track.sub.gain', over: 'sub', label: 'never'},
                {laneId: 'track.glass.gain', over: 'glass', label: 'never'},
                {laneId: 'vox.delay', over: 'vox', label: 'never'},
              ]}
              iris
            />
            {clapFlash > 0.02 ? <line x1={0} x2={W} y1={crisp(timeY(geometry, t, clap!.onset.t))} y2={crisp(timeY(geometry, t, clap!.onset.t))} stroke={C.ink} strokeWidth={2 * u} opacity={clapFlash} /> : null}
          </svg>
          <TriggerTags triggers={data.triggers} lanes={LANES_FULL} geometry={geometry} now={t} u={u} />
        </AbsoluteFill>

        {shatterOpacity > 0 ? (
          <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
            <HeroGlass
              data={data}
              t={t}
              slices={slices}
              opacity={shatterOpacity}
              chroma={8 * u * impact(t, tDrop, 0.08)}
              offset={(slice, i) => {
                const centre = (slice.from + slice.to) / 2 - 0.5;
                const lift = (hash01(i, 5) - 0.5) * 2;
                return {x: centre * 1100 * u * burst, y: (lift * 520 - 120) * u * burst, r: (hash01(i, 9) - 0.5) * 50 * burst};
              }}
            />
          </svg>
        ) : null}

        {/* Drop impact: transient lines snap across the full frame. */}
        {t >= tDrop && t < tDrop + 0.12 ? (
          <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
            {[0.16, 0.29, 0.6, 0.81].map((f, i) => (
              <line key={i} x1={0} x2={W} y1={crisp(H * f)} y2={crisp(H * f)} stroke={C.ink} strokeWidth={i % 2 ? 1 : 3 * u} opacity={impact(t, tDrop + i / 120, 0.03)} />
            ))}
          </svg>
        ) : null}
      </Machinery>

      {t < tProcess ? <div style={{position: 'absolute', left: SAFE_CX, top: 318 * u, translate: '-50% 0', ...mono(24 * u, 600, 0.16), color: C.g8, opacity: 1 - progress(t, tDrop + 0.5, tProcess)}}>GLASS//FIRE · MADE BY AN AGENT</div> : null}
      {words.map(w =>
        t >= w.t0 && t < w.t1 ? (
          <div key={w.text}>
            <TypeHit lines={[w.text]} t={t} t0={w.t0} t1={w.t1} size={124 * u} weight={900} stretch={[w.stretch, w.stretch]} tracking={-0.03} x={SAFE_CX} y={548 * u} entry="cut" punch={{onsets: promo.stems.kick.onsets, amount: 0.035}} chroma={8 * u} />
            <div style={{position: 'absolute', left: SAFE_CX, top: 640 * u, translate: '-50% 0', ...mono(28 * u, 600, 0.08), color: C.ink, opacity: lerp(0.4, 1, progress(t, w.t0, w.t0 + 0.06))}}>{w.fact}</div>
          </div>
        ) : null,
      )}
    </AbsoluteFill>
  );
};
