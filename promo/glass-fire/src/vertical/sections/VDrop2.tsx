// 4 · DROP 2 · output bars 6–8 · frames 450–719 · song bars 11, 12 and 14
// The system returns transformed: the columns fall into a perspective plane, so every sample
// travels from the horizon to the playhead. The camera sways with the real chip-pan automation,
// the lanes split on beat 3 and rejoin on the bar, glass shards fly in and land as notes, vox
// chips are thrown to whichever side the chip-pan automation sends them, claps snap hairlines
// across the frame, and the master gate's sixteenth slices cut the picture to black under the
// copy. One capability per bar: 9 MCP TOOLS (lit by the chip shaker), 128 GM VOICES (the two
// this track used, lit), SAMPLE PERFORMANCE (rate, glide and offset performed on GLASS.HIT).
// The song's beat of silence before the payoff is black.
import {AbsoluteFill} from 'remotion';
import type {AutomationLane} from '../../data/contract.ts';
import {glassSound} from '../../data/glasshouse.ts';
import {automationAt, hitAt, lastOnset, onsetsBetween} from '../../data/signals.ts';
import {clamp01, expoOut, hash01, impact, lerp, progress, quartIn, SPRINGS, springChain, springTo, velocity, type Key} from '../../motion/physics.ts';
import {LANES_FULL} from '../../primitives/Arrangement.tsx';
import {MCP_TOOLS} from '../../primitives/MCPCall.tsx';
import {SampleShard} from '../../primitives/SampleShard.tsx';
import {TypeHit} from '../../primitives/TypeHit.tsx';
import {Waveform, type Peaks} from '../../primitives/Waveform.tsx';
import {crisp} from '../../primitives/view.ts';
import {C, IRIS, mono, useStage} from '../../theme.ts';
import {SECONDS_PER_BEAT, SECONDS_PER_BAR} from '../../timeline/grid.ts';
import {Machinery, useOutTime, useVData} from '../context.tsx';
import {triggersBetween} from '../data.ts';
import {vCue} from '../cues.ts';
import {SAFE, SAFE_CX, SAFE_WIDTH} from '../layout.ts';
import {V_SECTION} from '../sections.ts';
import {columnX, Columns, type ColumnsGeometry} from '../primitives/Columns.tsx';
import {TriggerTags} from '../primitives/TriggerTags.tsx';
import {firstStopIn, gateAt, sampleLanesOf} from './shared.ts';

const SIXTEENTH = SECONDS_PER_BEAT / 4;
const SHARD_FLIGHT = 0.3;
export const DROP2_COLUMNS: ColumnsGeometry = {H: 1920, playheadY: 1560, pps: 980, top: -1700, bottom: 1910, left: 47, columnWidth: 152, gap: 13};

const keysOf = (lane: AutomationLane | undefined, scale: number): Key[] => (lane ? lane.points.map(p => ({t: p.t, v: p.v * scale})) : [{t: 0, v: 0}]);

/** GLASS.HIT played with a rate that glides from r0 to r1 over the sound (V0.6 `glide`), as peaks. */
const glidePeaks = (peaks: Peaks, r0: number, r1: number, buckets = 240): Peaks => {
  const n = peaks.max.length;
  // Output time τ ∈ [0, T]; source position σ(τ) = r0·τ + (r1 − r0)·τ²/(2T). Choose T so σ(T) = 1.
  const T = 2 / (r0 + r1);
  const min: number[] = [];
  const max: number[] = [];
  for (let j = 0; j < buckets; j++) {
    const tau = (j / (buckets - 1)) * T;
    const sigma = Math.min(1, r0 * tau + ((r1 - r0) * tau * tau) / (2 * T));
    const i = Math.min(n - 1, Math.round(sigma * (n - 1)));
    min.push(peaks.min[i] ?? 0);
    max.push(peaks.max[i] ?? 0);
  }
  return {min, max, peak: peaks.peak};
};

const GmGrid = ({t, t0, programs, x, y, u, lights}: {t: number; t0: number; programs: number[]; x: number; y: number; u: number; lights: number}) => {
  const cell = 38 * u;
  const gap = 8.2 * u;
  return (
    <svg width={16 * (cell + gap)} height={8 * (cell + gap)} style={{position: 'absolute', left: x, top: y, overflow: 'visible'}}>
      {Array.from({length: 128}, (_, p) => {
        const used = programs.includes(p);
        const order = hash01(p, 31) * 128;
        const lit = order < lights;
        const col = p % 16;
        const row = Math.floor(p / 16);
        const flash = used ? impact(t, t0 + 0.75, 0.12) : 0;
        return (
          <rect
            key={p}
            x={col * (cell + gap)}
            y={row * (cell + gap)}
            width={cell}
            height={cell}
            fill={used && t >= t0 + 0.75 ? IRIS[programs.indexOf(p) % IRIS.length] : lit ? C.g5 : 'none'}
            stroke={used ? C.ink : C.g4}
            strokeWidth={used ? 2 * u : 1}
            opacity={used ? 1 : lit ? 0.9 : 0.8}
            transform={flash > 0.02 ? `translate(${cell / 2} ${cell / 2}) scale(${1 + 0.25 * flash}) translate(${-cell / 2} ${-cell / 2})` : undefined}
          />
        );
      })}
    </svg>
  );
};

export const VDrop2 = () => {
  const data = useVData();
  const {t} = useOutTime();
  const stage = useStage();
  const {W, H, u, cx, cy} = stage;
  const promo = data.promo;

  const tDrop = vCue(promo, 'drop2');
  const tToolsOut = vCue(promo, 'mcpOut');
  const tGm = vCue(promo, 'gm');
  const tPerf = vCue(promo, 'performance');
  const tStop = firstStopIn(data, V_SECTION.drop2) ?? (V_SECTION.drop2.from + V_SECTION.drop2.durationInFrames) / 60;
  if (t >= tStop) return <AbsoluteFill style={{background: C.void}} />;

  const chipPan = promo.automation.find(a => a.id === 'track.chip.pan');
  const kick = hitAt(promo.stems.kick.onsets, t, {decay: 0.07});
  // The plane falls into perspective on the drop, pitches up to show the machinery on the one beat
  // without copy, and slams back down for the next capability.
  const pitch = springChain(t, [{t: 0, v: 0}, {t: tDrop, v: 60}, {t: tToolsOut, v: 30}, {t: tGm, v: 60}], SPRINGS.heavy);
  const roll = springChain(t, keysOf(chipPan, -2.4), SPRINGS.heavy);
  const pump = 1 + 0.012 * kick;

  // Split on beat 3, rejoin on every bar line.
  const splitKeys: Key[] = [{t: 0, v: 0}];
  for (let bar = 6; bar <= 8; bar++) {
    const start = (bar - 1) * SECONDS_PER_BAR;
    splitKeys.push({t: start, v: 0}, {t: start + 2 * SECONDS_PER_BEAT, v: 1});
  }
  const split = clamp01(springChain(t, splitKeys, SPRINGS.lock));

  const toolsOn = t >= tDrop && t < tToolsOut;
  const gmOn = t >= tGm && t < tPerf;
  const perfOn = t >= tPerf && t < tStop;
  const copyOn = toolsOn || gmOn || perfOn;
  const sliced = gateAt(data, t);

  const g = DROP2_COLUMNS;
  const glassX = columnX(g, 2);
  const incoming = onsetsBetween(promo.stems.glass.onsets, t, t + SHARD_FLIGHT);
  const chips = triggersBetween(data.triggers, t - 0.3, t, tr => tr.sample === 'vox-chip');
  const clap = lastOnset(promo.stems.clap.onsets, t);
  const chipsSinceDrop = triggersBetween(data.triggers, tDrop - 1e-6, t, tr => tr.sample === 'vox-chip' || tr.sample === 'pixel-hat').length;
  const sweep = triggersBetween(data.triggers, tGm - 1e-6, t).length;
  const gmPrograms = data.gm.map(p => p.program);

  const hit = glassSound('glass-hit');
  const demos = [
    {label: 'RATE', value: '2.0 · +12 ST', at: tPerf, peaks: hit as Peaks, width: 0.5, from: 0},
    {label: 'GLIDE', value: '1.0 → 0.25', at: tPerf + SECONDS_PER_BEAT, peaks: glidePeaks(hit, 1, 0.25), width: 1, from: 0},
    {label: 'OFFSET', value: '0.120 S IN', at: tPerf + 2 * SECONDS_PER_BEAT, peaks: hit as Peaks, width: 0.88, from: 0.12},
  ];

  return (
    <AbsoluteFill style={{background: C.void}}>
      <Machinery>
        {!sliced ? (
          <AbsoluteFill style={{opacity: copyOn ? 0.5 : 1}}>
            <AbsoluteFill
              style={{
                transformOrigin: `50% ${((g.playheadY / H) * 100).toFixed(2)}%`,
                transform: `perspective(${1500 * u}px) rotateX(${pitch.toFixed(3)}deg) rotateZ(${roll.toFixed(3)}deg) scale(${pump.toFixed(4)})`,
              }}
            >
              <svg width={W} height={H} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
                <Columns data={promo} stage={stage} geometry={g} now={t} lanes={LANES_FULL} sixteenths waveGain={1.3} split={split} sampleLanes={sampleLanesOf(data)} automation={[{laneId: 'track.sub.gain', over: 'sub', label: 'never'}, {laneId: 'sub.duck', over: 'sub', label: 'never'}]} iris />
                {incoming.map((o, k) => {
                  const side = hash01(Math.round(o.t * 1e4), 7) > 0.5 ? 1 : -1;
                  const lift = (hash01(Math.round(o.t * 1e4), 3) - 0.5) * 700 * u;
                  const xAt = (time: number) => lerp(glassX + side * 760 * u, glassX, quartIn(progress(time, o.t - SHARD_FLIGHT, o.t)));
                  const yAt = (time: number) => lerp(g.playheadY - 520 * u + lift, g.playheadY, quartIn(progress(time, o.t - SHARD_FLIGHT, o.t)));
                  return (
                    <SampleShard
                      key={`${o.t}-${k}`}
                      peaks={glassSound(o.sample ?? 'glass-hit')}
                      cx={xAt(t)}
                      cy={yAt(t)}
                      vx={velocity(xAt, t)}
                      vy={velocity(yAt, t)}
                      width={190 * u}
                      height={70 * u}
                      crush={o.sample === 'glass-crush' ? 0.7 : 0}
                      rotate={side * 10 * (1 - progress(t, o.t - SHARD_FLIGHT, o.t))}
                      edge={0.5}
                      opacity={0.5 + 0.5 * progress(t, o.t - SHARD_FLIGHT, o.t)}
                    />
                  );
                })}
              </svg>
              <TriggerTags triggers={data.triggers} lanes={LANES_FULL} geometry={g} now={t} u={u} />
            </AbsoluteFill>

            <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
              {/* Claps: one hairline snapping across the whole frame. */}
              {clap && t - clap.onset.t < 0.14
                ? (() => {
                    const y = crisp(H * (0.12 + 0.76 * hash01(Math.round(clap.onset.t * 1e4), 11)));
                    const fromLeft = hash01(Math.round(clap.onset.t * 1e4), 5) > 0.5;
                    const draw = expoOut(progress(t, clap.onset.t, clap.onset.t + 0.035));
                    const fade = 1 - progress(t, clap.onset.t + 0.04, clap.onset.t + 0.14);
                    return <line x1={fromLeft ? 0 : W * (1 - draw)} x2={fromLeft ? W * draw : W} y1={y} y2={y} stroke={C.ink} strokeWidth={2 * u} opacity={fade * clap.onset.strength} />;
                  })()
                : null}
              {/* Vox chips thrown to the side the chip-pan automation sends them. */}
              {chips.map((o, k) => {
                const pan = chipPan ? automationAt(chipPan, o.t + 1e-4) : hash01(k, 2) - 0.5;
                const side = pan < 0 ? -1 : 1;
                const xAt = (time: number) => lerp(cx + side * 60 * u, cx + side * (W / 2 + 180 * u), expoOut(progress(time, o.t, o.t + 0.3)));
                return (
                  <SampleShard
                    key={`${o.t}-${k}`}
                    peaks={glassSound('vox-chip')}
                    cx={xAt(t)}
                    cy={cy + (hash01(Math.round(o.t * 1e4), 9) - 0.5) * 900 * u}
                    vx={velocity(xAt, t)}
                    width={250 * u}
                    height={86 * u}
                    tone="white"
                    opacity={(1 - progress(t, o.t + 0.1, o.t + 0.3)) * (0.5 + 0.5 * o.velocity)}
                  />
                );
              })}
            </svg>
          </AbsoluteFill>
        ) : null}

        {/* Drop impact: the "//" cut, slashed across the frame out of the collapse point. */}
        {t >= tDrop && t < tDrop + 0.12 ? (
          <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
            {[-1, 1].map(k => {
              const x = cx + k * 60 * u;
              const draw = expoOut(progress(t, tDrop, tDrop + 0.03));
              return <line key={k} x1={x + H * 0.2} y1={0} x2={x + H * 0.2 - H * 0.4 * draw} y2={H * draw} stroke={C.ink} strokeWidth={7 * u} opacity={1 - progress(t, tDrop + 0.05, tDrop + 0.12)} />;
            })}
            <circle cx={cx} cy={cy} r={lerp(6, 900, expoOut(progress(t, tDrop, tDrop + 0.12))) * u} fill="none" stroke={C.ink} strokeWidth={3 * u} opacity={1 - progress(t, tDrop, tDrop + 0.12)} />
          </svg>
        ) : null}
        {/* The master gate's slices: a blade across the frame where each one cuts. */}
        {data.gates
          .filter(gate => gate.duration < 0.06 && t >= gate.t && t < gate.t + 0.05)
          .map(gate => (
            <svg key={gate.t} width={W} height={H} style={{position: 'absolute', inset: 0}}>
              <rect x={0} y={H * (0.18 + 0.64 * hash01(Math.round(gate.t * 1e4), 4))} width={W} height={3 * u} fill={C.ink} opacity={1 - progress(t, gate.t, gate.t + 0.05)} />
            </svg>
          ))}
      </Machinery>

      {toolsOn ? (
        <>
          <TypeHit lines={['9']} t={t} t0={tDrop} t1={tToolsOut} size={540 * u} weight={900} stretch={[62, 62]} tracking={0} x={SAFE.left + 18 * u} y={560 * u} align="left" entry="slam" punch={{onsets: promo.stems.kick.onsets, amount: 0.03}} chroma={9 * u} />
          <TypeHit lines={['MCP', 'TOOLS']} t={t} t0={tDrop + SIXTEENTH * 2} t1={tToolsOut} size={128 * u} weight={900} stretch={[108, 108]} tracking={-0.02} x={SAFE.left + 252 * u} y={560 * u} align="left" entry="cut" lineGap={0.06} />
          <div style={{position: 'absolute', left: SAFE.left, top: 838 * u, width: SAFE_WIDTH}}>
            <div style={{...mono(22 * u, 600, 0.06), color: C.g7, marginBottom: 16 * u}}>daemonv12_</div>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', rowGap: 16 * u, columnGap: 10 * u}}>
              {MCP_TOOLS.map((tool, i) => (
                <div key={tool} style={{...mono(22 * u, 600, 0.02), color: chipsSinceDrop > i ? C.ink : C.g4}}>{tool}</div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {gmOn ? (
        <>
          <TypeHit lines={['128']} t={t} t0={tGm} t1={tPerf} size={380 * u} weight={900} stretch={[62, 62]} tracking={-0.02} x={SAFE_CX} y={486 * u} entry="slam" punch={{onsets: promo.stems.kick.onsets, amount: 0.03}} chroma={9 * u} />
          <TypeHit lines={['GM VOICES']} t={t} t0={tGm + SIXTEENTH * 2} t1={tPerf} size={104 * u} weight={900} stretch={[100, 100]} tracking={-0.02} x={SAFE_CX} y={716 * u} entry="cut" />
          <GmGrid t={t} t0={tGm} programs={gmPrograms} x={SAFE_CX - (16 * 46.2 * u) / 2} y={796 * u} u={u} lights={Math.min(128, sweep * 6)} />
          {gmPrograms.length && t >= tGm + 0.75 ? (
            <div style={{position: 'absolute', left: SAFE_CX, top: 1186 * u, translate: '-50% 0', ...mono(22 * u, 600, 0.08), color: C.ink}}>
              {`IN THIS TRACK: ${data.gm.map(p => p.name.replace(/_/g, ' ').toUpperCase()).join(' · ')}`}
            </div>
          ) : null}
        </>
      ) : null}

      {perfOn ? (
        <>
          <TypeHit lines={['SAMPLE', 'PERFORMANCE']} t={t} t0={tPerf} t1={tStop} size={90 * u} weight={900} stretch={[92, 92]} tracking={-0.02} x={SAFE_CX} y={446 * u} entry="cut" lineGap={0.04} punch={{onsets: promo.stems.kick.onsets, amount: 0.025}} chroma={8 * u} />
          {demos.map((d, i) => {
            if (t < d.at) return null;
            const y = (660 + i * 178) * u;
            const land = springTo(t, d.at, 0.7, 1, SPRINGS.lock);
            const w = SAFE_WIDTH * d.width * land;
            return (
              <div key={d.label} style={{position: 'absolute', left: 0, top: 0, width: W, height: H}}>
                <div style={{position: 'absolute', left: SAFE.left, top: y - 46 * u, display: 'flex', gap: 18 * u, alignItems: 'baseline'}}>
                  <span style={{...mono(30 * u, 700, 0.1), color: C.ink}}>{d.label}</span>
                  <span style={{...mono(24 * u, 500, 0.06), color: C.g7}}>{d.value}</span>
                </div>
                <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
                  {d.from > 0 ? <Waveform peaks={hit} x={SAFE.left} y={y} width={SAFE_WIDTH} height={96 * u} tone="outline" /> : null}
                  <Waveform
                    peaks={d.peaks}
                    x={SAFE.left + d.from * SAFE_WIDTH}
                    y={y}
                    width={d.from > 0 ? SAFE_WIDTH * (1 - d.from) * land : w}
                    height={96 * u}
                    from={d.from}
                    edge={0.55}
                    chroma={6 * u * impact(t, d.at, 0.06)}
                  />
                  {d.from > 0 ? <line x1={crisp(SAFE.left + d.from * SAFE_WIDTH)} x2={crisp(SAFE.left + d.from * SAFE_WIDTH)} y1={y - 10 * u} y2={y + 106 * u} stroke={C.ink} strokeWidth={2 * u} /> : null}
                </svg>
              </div>
            );
          })}
          <div style={{position: 'absolute', left: SAFE_CX, top: 1196 * u, translate: '-50% 0', ...mono(22 * u, 600, 0.1), color: C.g8, opacity: t >= tPerf + 3 * SECONDS_PER_BEAT - 0.2 ? 1 : 0}}>V0.6 · ONE WAV, THREE PERFORMANCES</div>
        </>
      ) : null}
    </AbsoluteFill>
  );
};
