// ACT 2 · IGNITION · frames 180–359 · bars 3–4
// The arrangement builds. Each stem lane appears when its sound first enters; incoming
// events arrive off-grid and quantize-lock two beats before the playhead; the first
// automation curve draws on; three MCP calls flash in the margin. The pre-drop stop
// takes everything to black.
import {AbsoluteFill} from 'remotion';
import {useTime, usePromoData} from '../context.tsx';
import {nextOnset, stopAt} from '../data/signals.ts';
import {cutIn, expoOut, progress} from '../motion/physics.ts';
import {Arrangement, LANES_IGNITION} from '../primitives/Arrangement.tsx';
import {MCPCall} from '../primitives/MCPCall.tsx';
import {crisp, type TimeView} from '../primitives/view.ts';
import {C, MONO, useStage} from '../theme.ts';
import {ACT} from '../timeline/acts.ts';
import {cue} from '../timeline/cues.ts';
import {framesToSeconds, SECONDS_PER_BAR, SECONDS_PER_BEAT} from '../timeline/grid.ts';

const LOCK_LEAD = SECONDS_PER_BEAT * 2;
const FLASH = 14 / 60;

export const Act2Ignition = () => {
  const data = usePromoData();
  const {t} = useTime();
  const stage = useStage();
  const {W, H, u, sx} = stage;
  if (stopAt(data.markers, t)) return <AbsoluteFill style={{background: C.void}} />;

  const tIgnition = cue(data, 'ignition');
  const actStart = framesToSeconds(ACT.ignition.from);
  const left = 300 * u;
  const right = W - sx;
  const view: TimeView = {now: t, playheadX: left + (right - left) * 0.42, pps: 400 * u, left, right};

  // A lane appears with its stem's first sound in this act, or by the next bar at the latest.
  const laneReveal = LANES_IGNITION.map((lane, i) => {
    const first = nextOnset(data.stems[lane.id].onsets, actStart - 1e-6);
    const enter = Math.min(first && first.t < actStart + SECONDS_PER_BAR * 2 ? first.t : Infinity, tIgnition + SECONDS_PER_BAR + i * SECONDS_PER_BEAT * 0.25);
    return cutIn(t, enter, 0.22);
  });

  const tAuto = cue(data, 'automationIn');
  const lockX = view.playheadX + LOCK_LEAD * view.pps;
  const top = 250 * u;
  const laneHeight = 92 * u;
  const laneGap = 34 * u;
  const bottom = top + 5 * laneHeight + 4 * laneGap;
  const tPatch = cue(data, 'mcpPatch');
  const tValidate = cue(data, 'mcpValidate');
  const tRender = cue(data, 'mcpRender');

  return (
    <AbsoluteFill style={{background: C.void}}>
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <Arrangement
          data={data}
          stage={stage}
          view={view}
          lanes={LANES_IGNITION}
          top={top}
          laneHeight={laneHeight}
          laneGap={laneGap}
          labelX={sx}
          laneReveal={laneReveal}
          gridReveal={cutIn(t, tIgnition, 0.2)}
          sixteenths
          lockLead={LOCK_LEAD}
          automation={[{laneId: 'glass.lpf', over: 'glass', label: 'always', reveal: expoOut(progress(t, tAuto, tAuto + 0.5))}]}
        >
          <line x1={crisp(lockX)} x2={crisp(lockX)} y1={top - 12 * u} y2={bottom + 12 * u} stroke={C.g5} strokeWidth={1} strokeDasharray={`${2 * u} ${6 * u}`} />
          <text x={lockX + 6 * u} y={bottom + 30 * u} fill={C.g6} fontFamily={MONO} fontSize={12 * u} letterSpacing="0.12em">
            QUANTIZE 1/16
          </text>
        </Arrangement>
      </svg>
      <MCPCall tool="project_patch" detail="edits 6 · pattern_put kick, sub, hat" result="rev 4c1e…" t={t} t0={tPatch} t1={tPatch + FLASH} x={sx} y={146 * u} u={u} />
      <MCPCall tool="project_validate" result="0 errors · 0 warnings" t={t} t0={tValidate} t1={tValidate + FLASH} x={sx} y={146 * u} u={u} />
      <MCPCall tool="render" detail="stems · wav · mp3" result="24.000 s" t={t} t0={tRender} t1={tRender + FLASH} x={sx} y={146 * u} u={u} />
    </AbsoluteFill>
  );
};
