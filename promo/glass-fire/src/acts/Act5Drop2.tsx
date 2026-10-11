// ACT 5 · DROP 2 · frames 900–1259 · bars 11–14
// The system returns transformed, not replayed. The arrangement falls into a perspective
// plane whose camera is driven by automation (pan → yaw, filter → dolly, duck → pump);
// lanes split on beat 3 and recombine on the bar; glass shards fly in and land as note
// events; clap transients snap across the frame; vox chops are thrown to the edges;
// effect names surface only while their automation is moving.
import {AbsoluteFill} from 'remotion';
import {useTime, usePromoData} from '../context.tsx';
import type {AutomationLane} from '../data/contract.ts';
import {glassSound} from '../data/glasshouse.ts';
import {automationAt, automationMotion, automationNormAt, formatAutomation, hitAt, lastOnset, onsetsBetween, stopAt} from '../data/signals.ts';
import {clamp01, expoOut, hash01, lerp, progress, quartIn, SPRINGS, springChain, springTo, velocity, type Key} from '../motion/physics.ts';
import {Arrangement, laneCentre, LANES_FULL} from '../primitives/Arrangement.tsx';
import {MCP_TOOLS} from '../primitives/MCPCall.tsx';
import {SampleShard} from '../primitives/SampleShard.tsx';
import {TypeHit} from '../primitives/TypeHit.tsx';
import {crisp, type TimeView} from '../primitives/view.ts';
import {C, mono, useStage} from '../theme.ts';
import {cue} from '../timeline/cues.ts';
import {barTicks, BEATS_PER_BAR, SECONDS_PER_BEAT, ticksToSeconds, TICKS_PER_BEAT} from '../timeline/grid.ts';
import {stopAfter} from './Act3Drop1.tsx';

const SHARD_FLIGHT = 0.3;
const SIXTEENTH = SECONDS_PER_BEAT / 4;
const EFFECT_LANES = ['glass.lpf', 'sub.duck', 'vox.delay', 'glass.pan'];

/** Automation breakpoints as spring targets: the camera follows the curve with mass. */
const keysOf = (lane: AutomationLane | undefined, scale: number): Key[] => (lane ? lane.points.map(p => ({t: p.t, v: p.v * scale})) : [{t: 0, v: 0}]);

export const Act5Drop2 = () => {
  const data = usePromoData();
  const {t} = useTime();
  const stage = useStage();
  const {W, H, u, sx, cx, cy} = stage;
  if (stopAt(data.markers, t)) return <AbsoluteFill style={{background: C.void}} />;

  const tDrop = cue(data, 'drop2');
  const tToolsOut = cue(data, 'mcpToolsOut');
  const tInst = cue(data, 'instruments');
  const tInstOut = cue(data, 'instrumentsOut');
  const words = [
    {text: 'COMPOSE', t0: cue(data, 'compose'), t1: cue(data, 'edit'), align: 'left' as const, stretch: 125, size: 240},
    {text: 'EDIT', t0: cue(data, 'edit'), t1: cue(data, 'process'), align: 'right' as const, stretch: 62, size: 430},
    {text: 'PROCESS', t0: cue(data, 'process'), t1: cue(data, 'render'), align: 'center' as const, stretch: 100, size: 300},
    {text: 'RENDER', t0: cue(data, 'render'), t1: stopAfter(data, cue(data, 'render'), cue(data, 'wordsOut') + SECONDS_PER_BEAT), align: 'center' as const, stretch: 125, size: 280},
  ];

  const lane = (id: string) => data.automation.find(a => a.id === id);
  const pan = lane('glass.pan');
  const lpf = lane('glass.lpf');
  const duck = lane('sub.duck');

  // Camera: the plane falls into perspective on the drop, then automation drives it.
  const fall = springTo(t, tDrop, 0, 1, SPRINGS.heavy);
  const yaw = springChain(t, keysOf(pan, 13), SPRINGS.heavy);
  const roll = springChain(t, keysOf(pan, -1.6), SPRINGS.heavy);
  const dolly = lpf ? 0.9 + 0.1 * automationNormAt(lpf, t) : 1;
  const pump = duck ? 1 + 0.012 * (1 - automationNormAt(duck, t)) : 1;
  const kick = hitAt(data.stems.kick.onsets, t, {decay: 0.07});

  // Split on beat 3, recombine on every bar line.
  const splitKeys: Key[] = [{t: 0, v: 0}];
  for (let bar = 11; bar <= 14; bar++) {
    splitKeys.push({t: ticksToSeconds(barTicks(bar)), v: 0}, {t: ticksToSeconds(barTicks(bar) + 2 * TICKS_PER_BEAT), v: 1});
  }
  const split = clamp01(springChain(t, splitKeys, SPRINGS.lock));

  const toolsOn = t >= tDrop && t < tToolsOut;
  const instOn = t >= tInst && t < tInstOut;
  const wordOn = words.some(w => t >= w.t0 && t < w.t1);
  const dim = toolsOn || instOn ? 0.22 : wordOn ? 0.32 : 1;

  const view: TimeView = {now: t, playheadX: W * 0.5, pps: 900 * u, left: -W * 0.15, right: W * 1.15};
  const top = 196 * u;
  const laneHeight = 96 * u;
  const laneGap = 26 * u;
  const glassY = laneCentre(2, top, laneHeight, laneGap);

  // Glass shards in flight toward the playhead, landing exactly on their onset.
  const incoming = onsetsBetween(data.stems.glass.onsets, t, t + SHARD_FLIGHT);
  // Vox chops thrown to the screen edges after they sound.
  const thrown = onsetsBetween(data.stems.vox.onsets, t - 0.28, t);
  const clap = lastOnset(data.stems.clap.onsets, t);
  const hats = onsetsBetween(data.stems.hat.onsets, tDrop - 1e-6, t).length;

  return (
    <AbsoluteFill style={{background: C.void}}>
      <AbsoluteFill style={{opacity: dim}}>
        <AbsoluteFill
          style={{
            transformOrigin: '50% 58%',
            transform: `perspective(${1500 * u}px) rotateX(${(30 * fall).toFixed(3)}deg) rotateY(${yaw.toFixed(3)}deg) rotateZ(${roll.toFixed(3)}deg) scale(${(dolly * pump * (1 + 0.008 * kick)).toFixed(4)})`,
          }}
        >
          <svg width={W} height={H} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
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
              waveGain={1.3}
              split={split}
              sampleLanes={['vox']}
              automation={[
                {laneId: 'glass.lpf', over: 'glass', label: 'never'},
                {laneId: 'sub.duck', over: 'sub', label: 'never'},
              ]}
              iris
            >
              {incoming.map((o, k) => {
                const side = hash01(Math.round(o.t * 1e4), 7) > 0.5 ? 1 : -1;
                const lift = (hash01(Math.round(o.t * 1e4), 3) - 0.5) * 520 * u;
                const xAt = (time: number) => lerp(view.playheadX + side * 820 * u, view.playheadX, quartIn(progress(time, o.t - SHARD_FLIGHT, o.t)));
                const yAt = (time: number) => lerp(glassY + lift, glassY, quartIn(progress(time, o.t - SHARD_FLIGHT, o.t)));
                return (
                  <SampleShard
                    key={`${o.t}-${k}`}
                    peaks={glassSound(o.sample ?? 'glass-hit')}
                    cx={xAt(t)}
                    cy={yAt(t)}
                    vx={velocity(xAt, t)}
                    vy={velocity(yAt, t)}
                    width={170 * u}
                    height={64 * u}
                    crush={o.sample === 'glass-crush' ? 0.7 : 0}
                    rotate={side * 8 * (1 - progress(t, o.t - SHARD_FLIGHT, o.t))}
                    edge={0.5}
                    opacity={0.5 + 0.5 * progress(t, o.t - SHARD_FLIGHT, o.t)}
                  />
                );
              })}
            </Arrangement>
          </svg>
        </AbsoluteFill>

        <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
          {/* Clap transients: one hairline snapping across the whole frame. */}
          {clap && t - clap.onset.t < 0.14
            ? (() => {
                const y = crisp(H * (0.14 + 0.72 * hash01(Math.round(clap.onset.t * 1e4), 11)));
                const fromLeft = hash01(Math.round(clap.onset.t * 1e4), 5) > 0.5;
                const draw = expoOut(progress(t, clap.onset.t, clap.onset.t + 0.035));
                const fade = 1 - progress(t, clap.onset.t + 0.04, clap.onset.t + 0.14);
                return <line x1={fromLeft ? 0 : W * (1 - draw)} x2={fromLeft ? W * draw : W} y1={y} y2={y} stroke={C.ink} strokeWidth={2 * u} opacity={fade * clap.onset.strength} />;
              })()
            : null}
          {/* Vox chops thrown to the edges. */}
          {thrown.map((o, k) => {
            const side = k % 2 === 0 === hash01(Math.round(o.t * 1e4), 2) > 0.5 ? 1 : -1;
            const xAt = (time: number) => lerp(cx, cx + side * (W / 2 + 160 * u), expoOut(progress(time, o.t, o.t + 0.28)));
            return (
              <SampleShard
                key={`${o.t}-${k}`}
                peaks={glassSound(o.sample ?? 'vox-chip')}
                cx={xAt(t)}
                cy={cy + (hash01(Math.round(o.t * 1e4), 9) - 0.5) * 300 * u}
                vx={velocity(xAt, t)}
                width={260 * u}
                height={90 * u}
                tone="white"
                opacity={1 - progress(t, o.t + 0.1, o.t + 0.28)}
              />
            );
          })}
        </svg>
      </AbsoluteFill>

      {/* Effect names, only while their automation moves. */}
      {!toolsOn && !instOn && !wordOn
        ? EFFECT_LANES.map((id, i) => {
            const a = lane(id);
            if (!a) return null;
            const motion = Math.min(1, automationMotion(a, t) * 3);
            if (motion < 0.02) return null;
            return (
              <div key={id} style={{position: 'absolute', left: sx, top: 140 * u + i * 48 * u, display: 'flex', alignItems: 'center', gap: 18 * u, opacity: motion}}>
                <span style={{...mono(28 * u, 700, 0.12), color: C.ink}}>{a.label}</span>
                <span style={{...mono(28 * u, 400, 0.06), color: C.g7}}>{formatAutomation(a, automationAt(a, t))}</span>
                <div style={{width: 160 * u, height: 3 * u, background: C.g4}}>
                  <div style={{width: `${automationNormAt(a, t) * 100}%`, height: '100%', background: C.ink}} />
                </div>
              </div>
            );
          })
        : null}

      {toolsOn ? (
        <>
          <TypeHit lines={['9']} t={t} t0={tDrop} t1={tToolsOut} size={600 * u} weight={900} stretch={[62, 62]} tracking={0} x={sx + 40 * u} y={cy + 20 * u} align="left" entry="slam" punch={{onsets: data.stems.kick.onsets, amount: 0.03}} chroma={9 * u} />
          <TypeHit lines={['MCP', 'TOOLS']} t={t} t0={tDrop + SIXTEENTH * 2} t1={tToolsOut} size={150 * u} weight={880} stretch={[125, 125]} x={sx + 350 * u} y={cy} align="left" entry="cut" />
          <div style={{position: 'absolute', right: sx, top: cy - 4.5 * 44 * u, display: 'flex', flexDirection: 'column', gap: 18 * u}}>
            {MCP_TOOLS.map((tool, i) => (
              <div key={tool} style={{...mono(22 * u, 500, 0.06), color: hats > i ? C.ink : C.g4}}>{`daemonv12_${tool}`}</div>
            ))}
          </div>
        </>
      ) : null}

      {instOn ? (
        <>
          <TypeHit lines={['12']} t={t} t0={tInst} t1={tInstOut} size={600 * u} weight={900} stretch={[62, 62]} tracking={-0.02} x={sx + 20 * u} y={cy + 20 * u} align="left" entry="slam" punch={{onsets: data.stems.kick.onsets, amount: 0.03}} chroma={9 * u} />
          <TypeHit lines={['INSTRUMENTS']} t={t} t0={tInst} t1={tInstOut} size={128 * u} weight={880} stretch={[100, 100]} x={sx + 560 * u} y={cy - 40 * u} align="left" entry="cut" />
          <div style={{position: 'absolute', left: sx + 566 * u, top: cy + 70 * u, display: 'flex', gap: 12 * u}}>
            {Array.from({length: 12}, (_, i) => (
              <div key={i} style={{width: 34 * u, height: 34 * u, border: `1px solid ${C.g5}`, background: t >= tInst + i * SIXTEENTH * (BEATS_PER_BAR / 6) ? C.ink : 'transparent'}} />
            ))}
          </div>
        </>
      ) : null}

      {words.map(w => (
        <TypeHit
          key={w.text}
          lines={[w.text]}
          t={t}
          t0={w.t0}
          t1={w.t1}
          size={w.size * u}
          weight={900}
          stretch={[w.stretch, w.stretch]}
          tracking={-0.03}
          x={w.align === 'left' ? sx : w.align === 'right' ? W - sx : cx}
          y={cy}
          align={w.align}
          entry="cut"
          punch={{onsets: data.stems.kick.onsets, amount: 0.04}}
          chroma={w.text === 'RENDER' ? 10 * u : 4 * u}
        />
      ))}
      {/* Drop impact: the "//" cut from the opening, slashed across the full frame. */}
      {t >= tDrop && t < tDrop + 0.1 ? (
        <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
          {[-1, 1].map(k => {
            const x = cx + k * 70 * u;
            const draw = expoOut(progress(t, tDrop, tDrop + 0.03));
            return <line key={k} x1={x + H * 0.32} y1={0} x2={x + H * 0.32 - H * 0.64 * draw} y2={H * draw} stroke={C.ink} strokeWidth={6 * u} opacity={1 - progress(t, tDrop + 0.04, tDrop + 0.1)} />;
          })}
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};
