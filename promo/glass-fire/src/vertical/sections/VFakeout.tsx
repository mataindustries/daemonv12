// 3 · FAKEOUT · output bars 4–5 · frames 270–449 · song bars 9–10
// The expected hit lands, then the tape dies: the song's decelerating retrigger (the shred
// track) is drawn as the machinery losing speed and tearing apart, each column peeling off and
// falling, a tear line per retrigger. The master gate cuts to black. Out of the silence: ONE
// SOUND., the real GLASS.HIT. On the quarter-speed crush it MUTATES. Bar 5 stacks its family
// down the frame, one beat each: GLASS.HIT, REVERSE (written on with the real reverse swell,
// which ends exactly on the next downbeat), CRUSH, CHOP (sliced by the hat riser). On the last
// eighth everything is sucked into one point; Drop 2 detonates from it.
import {AbsoluteFill} from 'remotion';
import type {SampleId} from '../../data/contract.ts';
import {glassSound} from '../../data/glasshouse.ts';
import {hitAt} from '../../data/signals.ts';
import {cubicOut, cutIn, expoIn, expoOut, hash01, impact, lerp, progress, quartIn, SPRINGS, springStep, springTo, stepped, velocity} from '../../motion/physics.ts';
import {LANES_FULL} from '../../primitives/Arrangement.tsx';
import {SampleShard} from '../../primitives/SampleShard.tsx';
import {TypeHit} from '../../primitives/TypeHit.tsx';
import {Waveform} from '../../primitives/Waveform.tsx';
import {crisp} from '../../primitives/view.ts';
import {SECONDS_PER_BEAT} from '../../timeline/grid.ts';
import {C, display, mono, useStage} from '../../theme.ts';
import {Machinery, useOutTime, useVData} from '../context.tsx';
import {triggersBetween} from '../data.ts';
import {vCue} from '../cues.ts';
import {SAFE, SAFE_CX} from '../layout.ts';
import {V_SECTION} from '../sections.ts';
import {Columns, type ColumnsGeometry} from '../primitives/Columns.tsx';
import {DROP1_COLUMNS, sampleLanesOf} from './shared.ts';

const ROW_Y = [452, 702, 952, 1202];
const ROW_WAVE = {left: SAFE.left, width: SAFE.right - SAFE.left, offset: 54, height: 104};
const HERO = {width: 740, height: 230, y: 760};

type Row = {key: string; sub: string; at: number; peaks: SampleId; crush: number; chop: number; reveal: number};

export const VFakeout = () => {
  const data = useVData();
  const {t, frame} = useOutTime();
  const stage = useStage();
  const {W, H, u, cx, cy} = stage;
  const promo = data.promo;

  const from = V_SECTION.fakeout.from / 60;
  const tEnd = (V_SECTION.fakeout.from + V_SECTION.fakeout.durationInFrames) / 60;
  const tHit = vCue(promo, 'fakeHit');
  // The tape dies within a beat of the hit; the master gate ends it (a fixed fallback without gate data).
  const tGate = data.gates.find(g => g.t > tHit && g.t < tHit + SECONDS_PER_BEAT)?.t ?? tHit + 0.26;
  const tOne = vCue(promo, 'oneSound');
  const tMut = vCue(promo, 'mutated');
  const tGlass = vCue(promo, 'treeGlass');
  const tRev = vCue(promo, 'treeReverse');
  const tCrush = vCue(promo, 'treeCrush');
  const tChop = vCue(promo, 'treeChop');
  const tCollapse = vCue(promo, 'collapse');
  const last = tEnd - 1 / 60;

  // ---- A · the tape stop: speed falls to zero by the gate; the columns peel apart and drop.
  const stutter = triggersBetween(data.triggers, tHit + 0.005, tGate, tr => tr.track === 'shred');
  const tear = progress(t, tHit + 0.02, tGate);
  const tapeNow = tHit + ((tGate - tHit) / 3) * (1 - Math.pow(1 - progress(t, tHit, tGate), 3));
  const stutterHits = stutter.filter(s => s.t <= t);

  // ---- B/C · ONE SOUND., MUTATED.
  const reverseTrigger = triggersBetween(data.triggers, from, tEnd, tr => tr.sample === 'glass-reverse')[0];
  const mutating = t >= tMut && t < tMut + 0.3;
  const variant = mutating ? (stepped(frame, 3) / 3) % 4 : t >= tMut ? 0 : -1;
  const heroPeaks: SampleId = variant === 0 ? 'glass-crush' : variant === 1 ? 'glass-reverse' : 'glass-hit';
  const crushPulse = hitAt(promo.stems.glass.onsets, t, {decay: 0.1});

  // ---- D · the family, one row per beat of bar 5.
  const riser = triggersBetween(data.triggers, tCrush, tCollapse, tr => tr.sample === 'pixel-hat').filter(h => h.t <= t).length;
  const rows: Row[] = [
    {key: 'GLASS.HIT', sub: `${glassSound('glass-hit').note} · ${glassSound('glass-hit').fundamentalHz?.toFixed(1)} HZ · THE SOURCE`, at: tGlass, peaks: 'glass-hit', crush: 0, chop: 0, reveal: 1},
    {key: 'REVERSE', sub: 'FROM GLASS.HIT · TIME-REVERSED', at: tRev, peaks: 'glass-reverse', crush: 0, chop: 0, reveal: reverseTrigger ? Math.max(0.06, progress(t, reverseTrigger.t, reverseTrigger.t + reverseTrigger.duration)) : 1},
    {key: 'CRUSH', sub: `FROM GLASS.HIT · ${glassSound('glass-crush').note} · DRIVEN`, at: tCrush, peaks: 'glass-crush', crush: 0.8, chop: 0, reveal: 1},
    {key: 'CHOP', sub: 'RETRIGGERED TO A BUZZ', at: tChop, peaks: 'glass-hit', crush: 0, chop: 3 + Math.min(40, riser), reveal: 1},
  ];

  // ---- E · collapse into one point.
  const sink = expoIn(progress(t, tCollapse, last));
  const toCentre = (x: number, y: number) => [lerp(x, cx, sink), lerp(y, cy, sink)] as const;
  const shrink = 1 - sink;

  const lift = springStep(t - tGlass, SPRINGS.heavy);
  const heroW = lerp(HERO.width, ROW_WAVE.width, lift);
  const heroH = lerp(HERO.height, ROW_WAVE.height, lift);
  const heroCy = lerp(HERO.y, ROW_Y[0]! + ROW_WAVE.offset + ROW_WAVE.height / 2, lift);
  const [heroX, heroY] = toCentre(cx, heroCy);
  const geometry: ColumnsGeometry = DROP1_COLUMNS;

  return (
    <AbsoluteFill style={{background: C.void}}>
      <Machinery>
        {t < tGate ? (
          <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
            {LANES_FULL.map((lane, i) => {
              const g: ColumnsGeometry = {...geometry, left: geometry.left + i * (geometry.columnWidth + geometry.gap)};
              const seed = hash01(i, 13);
              const fall = tear * tear;
              const dx = (i - 2.5) * 70 * u * fall + (seed - 0.5) * 90 * u * fall;
              const dy = (260 + 900 * seed) * u * fall;
              const rot = (seed - 0.5) * 38 * fall;
              const colCx = g.left + g.columnWidth / 2;
              return (
                <g key={lane.id} transform={`translate(${dx.toFixed(2)} ${dy.toFixed(2)}) rotate(${rot.toFixed(3)} ${colCx.toFixed(1)} ${geometry.playheadY})`} opacity={1 - progress(t, tGate - 0.05, tGate)}>
                  <Columns data={promo} stage={stage} geometry={g} now={tapeNow} lanes={[lane]} gridReveal={0} showMarkers={false} waveGain={1.2} sampleLanes={sampleLanesOf(data).includes(lane.id) ? [lane.id] : []} iris />
                </g>
              );
            })}
            {/* The hit: the playhead line flashes across the frame, then sags with the tape. */}
            <line x1={0} x2={W} y1={crisp(geometry.playheadY + 420 * u * tear * tear)} y2={crisp(geometry.playheadY + 420 * u * tear * tear)} stroke={C.ink} strokeWidth={(1.5 + 4 * impact(t, tHit, 0.05)) * u} opacity={1 - tear} />
            {/* One tear line per retrigger, wider as the stutter slows. */}
            {stutterHits.slice(-6).map((s, k) => {
              const y = H * (0.08 + 0.84 * hash01(Math.round(s.t * 1e5), 3));
              const fade = impact(t, s.t, 0.035);
              return fade > 0.03 ? <rect key={`${s.t}-${k}`} x={0} y={y} width={W} height={(2 + 26 * hash01(k, 7) * tear) * u} fill={C.ink} opacity={fade * 0.9} /> : null;
            })}
          </svg>
        ) : null}

        {t >= tOne && shrink > 0 ? (
          <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
            {/* The family line: one source, its derivatives below it. */}
            {t >= tRev
              ? (() => {
                  const x0 = SAFE.left - 26 * u;
                  const yTop = ROW_Y[0]! + ROW_WAVE.offset + ROW_WAVE.height / 2;
                  const lastRow = rows.reduce((n, r, i) => (t >= r.at ? i : n), 0);
                  const yBottom = ROW_Y[lastRow]! + ROW_WAVE.offset + ROW_WAVE.height / 2;
                  const [ax, ay] = toCentre(x0, yTop);
                  const [, by] = toCentre(x0, yBottom);
                  return (
                    <g opacity={shrink}>
                      <line x1={ax} x2={ax} y1={ay} y2={lerp(ay, by, expoOut(progress(t, rows[lastRow]!.at, rows[lastRow]!.at + 0.1)))} stroke={C.g6} strokeWidth={1.5 * u} />
                      {rows.slice(1).map((r, i) => {
                        if (t < r.at) return null;
                        const [, y] = toCentre(x0, ROW_Y[i + 1]! + ROW_WAVE.offset + ROW_WAVE.height / 2);
                        return <path key={r.key} d={`M${ax} ${y} L${ax + 16 * u * shrink} ${y}`} stroke={C.g6} strokeWidth={1.5 * u} />;
                      })}
                    </g>
                  );
                })()
              : null}

            {/* The hero: ONE SOUND., then the root of the family. */}
            <Waveform
              peaks={glassSound(t >= tGlass ? 'glass-hit' : heroPeaks)}
              x={heroX - (heroW * shrink) / 2}
              y={heroY - (heroH * shrink) / 2}
              width={heroW * shrink}
              height={heroH * shrink}
              gain={springTo(t, tOne, 0.35, 1, SPRINGS.hit) * (1 + 0.15 * crushPulse * (t < tGlass ? 1 : 0))}
              reveal={cutIn(t, tOne, 0.1)}
              crush={t < tGlass && variant === 0 ? 0.8 : 0}
              chop={t < tGlass && variant === 2 ? 9 : 0}
              sheen={t < tGlass ? lerp(-0.25, 1.25, expoOut(progress(t, tOne + 0.04, tOne + 0.8))) : null}
              edge={0.55}
              reflection={t < tGlass ? 0.18 : 0}
              chroma={7 * u * Math.max(impact(t, tOne, 0.05), mutating ? 0.8 : 0, impact(t, tGlass, 0.05))}
            />

            {/* Bar 5: each derivative is thrown down from the row above and lands on its beat. */}
            {rows.slice(1).map((r, i) => {
              const row = i + 1;
              const yRow = ROW_Y[row]! + ROW_WAVE.offset + ROW_WAVE.height / 2;
              const flight = 0.1;
              if (t < r.at - flight) return null;
              if (t < r.at) {
                const yFrom = ROW_Y[row - 1]! + ROW_WAVE.offset + ROW_WAVE.height / 2;
                const yAt = (time: number) => lerp(yFrom, yRow, quartIn(progress(time, r.at - flight, r.at)));
                return <SampleShard key={r.key} peaks={glassSound(r.peaks)} cx={cx} cy={yAt(t)} vy={velocity(yAt, t)} width={ROW_WAVE.width * 0.5} height={ROW_WAVE.height * 0.7} edge={0.4} crush={r.crush} />;
              }
              const land = springTo(t, r.at, 0.55, 1, SPRINGS.hit);
              const w = ROW_WAVE.width * land * shrink;
              const [x, y] = toCentre(SAFE_CX, yRow);
              return (
                <Waveform
                  key={r.key}
                  peaks={glassSound(r.peaks)}
                  x={x - w / 2}
                  y={y - (ROW_WAVE.height * shrink) / 2}
                  width={w}
                  height={ROW_WAVE.height * shrink}
                  crush={r.crush}
                  chop={r.chop}
                  reveal={r.reveal}
                  edge={0.5}
                  chroma={7 * u * impact(t, r.at, 0.05)}
                />
              );
            })}
            {reverseTrigger && t >= tRev && t >= reverseTrigger.t && shrink > 0.05
              ? (() => {
                  const [x] = toCentre(SAFE.left + ROW_WAVE.width * rows[1]!.reveal, 0);
                  const [, y] = toCentre(0, ROW_Y[1]! + ROW_WAVE.offset + ROW_WAVE.height / 2);
                  return <line x1={crisp(x)} x2={crisp(x)} y1={y - ROW_WAVE.height * 0.65 * shrink} y2={y + ROW_WAVE.height * 0.65 * shrink} stroke={C.ink} strokeWidth={1.5} />;
                })()
              : null}
            {sink > 0.55 ? <circle cx={cx} cy={cy} r={lerp(1, 6, cubicOut(progress(sink, 0.55, 1))) * u} fill={C.ink} /> : null}
          </svg>
        ) : null}
      </Machinery>

      <TypeHit lines={['ONE SOUND.']} t={t} t0={tOne} t1={tMut} size={112 * u} weight={900} stretch={[100, 100]} tracking={-0.02} x={SAFE_CX} y={1150 * u} entry="mask" chroma={4 * u} />
      <TypeHit lines={['MUTATED.']} t={t} t0={tMut} t1={tGlass} size={120 * u} weight={900} stretch={[116, 108]} tracking={-0.02} x={SAFE_CX} y={1150 * u} entry="stretch" chroma={11 * u} />

      {rows.map((r, i) => {
        if (t < r.at || shrink <= 0.04) return null;
        const [x, y] = toCentre(SAFE.left, ROW_Y[i]!);
        const reveal = cutIn(t, r.at, 0.08);
        return (
          <div key={r.key} style={{position: 'absolute', left: x, top: y, translate: '0 -50%', scale: String(shrink), transformOrigin: '0 50%', opacity: Math.min(1, reveal * 1.4)}}>
            <div style={{...display(76 * u, 860, 100, -0.01), color: C.ink}}>{r.key}</div>
            <div style={{position: 'absolute', left: 2 * u, top: (ROW_WAVE.offset + ROW_WAVE.height + 58) * u, ...mono(18 * u, 600, 0.1), color: C.g7}}>{r.sub}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
