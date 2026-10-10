// ACT 4 · FAKEOUT · frames 720–899 · bars 9–10
// The system is gone. One glass waveform on black: ONE SOUND. It mutates: MUTATED.
// Then its family tree draws itself: GLASS.HIT ↓ REVERSE · CRUSH · CHOP, each child
// thrown from the parent and landing on its own hit. Everything is sucked into a single
// point for the drop.
import {AbsoluteFill} from 'remotion';
import {useTime, usePromoData} from '../context.tsx';
import {glassSound} from '../data/glasshouse.ts';
import {onsetsBetween} from '../data/signals.ts';
import {cubicOut, cutIn, expoIn, expoOut, impact, lerp, progress, quartIn, SPRINGS, springStep, springTo, stepped, velocity} from '../motion/physics.ts';
import {SampleShard} from '../primitives/SampleShard.tsx';
import {TypeHit} from '../primitives/TypeHit.tsx';
import {Waveform} from '../primitives/Waveform.tsx';
import {C, mono, useStage} from '../theme.ts';
import {ACT} from '../timeline/acts.ts';
import {cue} from '../timeline/cues.ts';
import {FPS, framesToSeconds} from '../timeline/grid.ts';

const THROW = 0.12;

export const Act4Fakeout = () => {
  const data = usePromoData();
  const {t, frame} = useTime();
  const stage = useStage();
  const {W, H, u, cx, cy} = stage;

  const tOne = cue(data, 'oneSound');
  const tMut = cue(data, 'mutated');
  const tRoot = cue(data, 'treeRoot');
  const tRev = cue(data, 'treeReverse');
  const tCrush = cue(data, 'treeCrush');
  const tChop = cue(data, 'treeChop');
  const tCollapse = cue(data, 'collapse');
  const tEnd = framesToSeconds(ACT.fakeout.from + ACT.fakeout.durationInFrames) - 1 / FPS;

  const hit = glassSound('glass-hit');
  const rev = glassSound('glass-reverse');
  const crush = glassSound('glass-crush');

  // Collapse: every element accelerates into the centre point.
  const sink = expoIn(progress(t, tCollapse, tEnd));
  const toCentre = (x: number, y: number) => [lerp(x, cx, sink), lerp(y, cy, sink)] as const;
  const shrink = 1 - sink;

  // Root: centred hero, then lifted to the top of the tree.
  const lift = springStep(t - tRoot, SPRINGS.heavy);
  const rootW = lerp(720 * u, 380 * u, lift);
  const rootH = lerp(180 * u, 90 * u, lift);
  const [rootX, rootY] = toCentre(cx, lerp(cy - 50 * u, 250 * u, lift));
  const mutating = t >= tMut && t < tMut + 0.3;
  const variant = mutating ? (stepped(frame, 3) / 3) % 3 : -1;

  const branchY = 468 * u;
  const childY = 660 * u;
  const childW = 380 * u;
  const childH = 120 * u;
  const spread = 560 * u;
  const children = [
    {key: 'REVERSE', sub: 'BLOOM · TIME-REVERSED', at: tRev, x: cx - spread, peaks: rev, crush: 0, chop: 0},
    {key: 'CRUSH', sub: '−2 OCT · DRIVEN', at: tCrush, x: cx, peaks: crush, crush: 0.8, chop: 0},
    {key: 'CHOP', sub: '1/32 GATE', at: tChop, x: cx + spread, peaks: hit, crush: 0, chop: 0},
  ];
  const chops = onsetsBetween(data.stems.glass.onsets, tChop - 0.01, tCollapse).filter(o => o.variant === 'chop').filter(o => o.t <= t).length;
  children[2]!.chop = chops > 0 ? 2 + chops * 3 : 0;

  const stemDraw = expoOut(progress(t, tRoot + 0.04, tRoot + 0.16));
  const branchDraw = expoOut(progress(t, tRoot + 0.12, tRoot + 0.3));

  return (
    <AbsoluteFill style={{background: C.void}}>
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        {t >= tRoot && shrink > 0 ? (
          <g opacity={shrink}>
            {(() => {
              const [x1, y1] = toCentre(cx, 250 * u + 45 * u + 18 * u);
              const [, y2] = toCentre(cx, branchY);
              const yEnd = lerp(y1, y2, stemDraw);
              const [bl] = toCentre(cx - spread * branchDraw, branchY);
              const [br] = toCentre(cx + spread * branchDraw, branchY);
              return (
                <>
                  <line x1={x1} x2={x1} y1={y1} y2={yEnd} stroke={C.ink} strokeWidth={1.5 * u} />
                  {stemDraw >= 1 ? <path d={`M${x1 - 7 * u} ${yEnd - 10 * u} L${x1} ${yEnd} L${x1 + 7 * u} ${yEnd - 10 * u}`} stroke={C.ink} strokeWidth={1.5 * u} fill="none" /> : null}
                  {branchDraw > 0 ? <line x1={bl} x2={br} y1={y2} y2={y2} stroke={C.g5} strokeWidth={1} /> : null}
                </>
              );
            })()}
            {children.map(c => {
              if (t < c.at) return null;
              const [x, y1] = toCentre(c.x, branchY);
              const [, y2] = toCentre(c.x, childY - childH / 2 - 16 * u);
              return <line key={c.key} x1={x} x2={x} y1={y1} y2={lerp(y1, y2, expoOut(progress(t, c.at, c.at + 0.08)))} stroke={C.g5} strokeWidth={1} />;
            })}
          </g>
        ) : null}

        {t >= tOne && shrink > 0 ? (
          <Waveform
            peaks={variant === 0 ? crush : variant === 1 ? rev : hit}
            x={rootX - (rootW * shrink) / 2}
            y={rootY - (rootH * shrink) / 2}
            width={rootW * shrink}
            height={rootH * shrink}
            gain={springTo(t, tOne, 0.35, 1, SPRINGS.hit)}
            reveal={cutIn(t, tOne, 0.1)}
            crush={variant === 0 ? 0.8 : 0}
            chop={variant === 2 ? 9 : 0}
            sheen={lerp(-0.25, 1.25, expoOut(progress(t, tOne + 0.04, tOne + 0.8)))}
            edge={0.5}
            reflection={t < tRoot ? 0.14 : 0}
            chroma={7 * u * Math.max(impact(t, tOne, 0.05), mutating ? 0.8 : 0)}
          />
        ) : null}

        {children.map(c => {
          if (t < c.at - THROW || shrink <= 0) return null;
          if (t < c.at) {
            // In flight from the parent: accelerating, smeared along its path.
            const xAt = (time: number) => lerp(cx, c.x, quartIn(progress(time, c.at - THROW, c.at)));
            const yAt = (time: number) => lerp(250 * u, childY, quartIn(progress(time, c.at - THROW, c.at)));
            return <SampleShard key={c.key} peaks={c.peaks} cx={xAt(t)} cy={yAt(t)} vx={velocity(xAt, t)} vy={velocity(yAt, t)} width={childW * 0.4} height={childH * 0.6} edge={0.4} />;
          }
          const [x, y] = toCentre(c.x, childY);
          const land = springTo(t, c.at, 0.4, 1, SPRINGS.hit);
          const w = childW * land * shrink;
          return (
            <Waveform
              key={c.key}
              peaks={c.peaks}
              x={x - w / 2}
              y={y - (childH * shrink) / 2}
              width={w}
              height={childH * shrink}
              crush={c.crush}
              chop={c.chop}
              edge={0.45}
              chroma={7 * u * impact(t, c.at, 0.05)}
            />
          );
        })}

        {sink > 0.6 ? <circle cx={cx} cy={cy} r={lerp(1, 5, cubicOut(progress(sink, 0.6, 1))) * u} fill={C.ink} /> : null}
      </svg>

      <TypeHit lines={['ONE SOUND.']} t={t} t0={tOne} t1={tMut} size={84 * u} weight={720} stretch={[100, 100]} tracking={0.01} x={cx} y={cy + 185 * u} entry="mask" />
      <TypeHit lines={['MUTATED.']} t={t} t0={tMut} t1={tRoot} size={84 * u} weight={900} stretch={[125, 125]} tracking={-0.01} x={cx} y={cy + 185 * u} entry="cut" chroma={10 * u} />

      {t >= tRoot && shrink > 0.05 ? (
        <div style={{position: 'absolute', left: rootX, top: rootY + rootH / 2 + 20 * u, translate: '-50% 0', ...mono(18 * u, 600, 0.16), color: C.ink, opacity: shrink}}>GLASS.HIT</div>
      ) : null}
      {children.map(c =>
        t >= c.at && shrink > 0.05 ? (
          <div key={c.key} style={{position: 'absolute', left: c.x, top: childY + childH / 2 + 22 * u, translate: '-50% 0', textAlign: 'center', opacity: shrink}}>
            <div style={{...mono(20 * u, 600, 0.16), color: C.ink}}>{c.key}</div>
            <div style={{...mono(13 * u, 500, 0.12), color: C.g6, marginTop: 8 * u}}>{c.sub}</div>
          </div>
        ) : null,
      )}
    </AbsoluteFill>
  );
};
