// ACT 6 · PAYOFF · frames 1260–1439 · bars 15–16
// The fragments lock into one organized form: all six stems over the whole 24 seconds,
// the finished render. The stems merge into the master; the master flattens into the
// hairline the film began with; the line opens into the wordmark; the tagline lands on
// the beat; hard cut to black on bar 16 beat 4, which holds to the last frame.
import {AbsoluteFill} from 'remotion';
import {useTime, usePromoData} from '../context.tsx';
import type {Envelope} from '../data/contract.ts';
import {envAt} from '../data/signals.ts';
import {hash01, impact, lerp, SPRINGS, springChain, springStep, springTo, type SpringParams} from '../motion/physics.ts';
import {LANES_FULL} from '../primitives/Arrangement.tsx';
import {TypeHit} from '../primitives/TypeHit.tsx';
import {crisp} from '../primitives/view.ts';
import {C, mono, MONO, useStage} from '../theme.ts';
import {ACTS} from '../timeline/acts.ts';
import {cue} from '../timeline/cues.ts';
import {DURATION_SECONDS, framesToSeconds, SECONDS_PER_BEAT} from '../timeline/grid.ts';

const LOCK: SpringParams = {freq: 7, damping: 0.78};

/** A whole-piece envelope as a mirrored outline over [x, x + w]. */
const overviewPath = (env: Envelope, x: number, w: number, cy: number, amp: number, from = 0, to = DURATION_SECONDS) => {
  const top: string[] = [];
  const bottom: string[] = [];
  const x0 = x + (from / DURATION_SECONDS) * w;
  const x1 = x + (to / DURATION_SECONDS) * w;
  for (let px = x0; px <= x1 + 0.01; px += 2) {
    const a = envAt(env, ((px - x) / w) * DURATION_SECONDS) * amp;
    top.push(`${px.toFixed(1)} ${(cy - a).toFixed(1)}`);
    bottom.push(`${px.toFixed(1)} ${(cy + a).toFixed(1)}`);
  }
  return top.length > 1 ? `M${top.join('L')}L${bottom.reverse().join('L')}Z` : '';
};

export const Act6Payoff = () => {
  const data = usePromoData();
  const {t} = useTime();
  const stage = useStage();
  const {W, H, u, cx, cy} = stage;

  const tLock = cue(data, 'payoff');
  const tMerge = cue(data, 'merge');
  const tSimplify = cue(data, 'simplify');
  const tMark = cue(data, 'finalWordmark');
  const tGive = cue(data, 'giveAgents');
  const tInst = cue(data, 'giveInstruments');
  const tBlack = cue(data, 'black');
  if (t >= tBlack) return <AbsoluteFill style={{background: C.void}} />;

  const bx = 210 * u;
  const bw = W - 2 * bx;
  const laneH = 62 * u;
  const gap = 14 * u;
  const blockTop = cy - (LANES_FULL.length * laneH + (LANES_FULL.length - 1) * gap) / 2 + 20 * u;
  const merge = springTo(t, tMerge, 0, 1, SPRINGS.heavy);
  const flatten = springStep(t - tSimplify, SPRINGS.lock);
  const nowX = bx + (t / DURATION_SECONDS) * bw;
  const showSystem = t < tMark;

  const masterAmp = lerp(0, 110 * u, Math.min(1, merge)) * (1 - flatten);
  const lineW = lerp(bw, 980 * u, flatten);

  // The wordmark lifts and shrinks when the tagline lands, with velocity continuity.
  // It starts a sixteenth early so the tagline lands on clear space, on the beat.
  const lift = tGive - SECONDS_PER_BEAT / 4;
  const markY = springChain(t, [{t: 0, v: cy}, {t: lift, v: cy - 250 * u}], SPRINGS.heavy);
  const markScale = springChain(t, [{t: 0, v: 1}, {t: lift, v: 0.42}], SPRINGS.heavy);

  return (
    <AbsoluteFill style={{background: C.void}}>
      {showSystem ? (
        <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
          {/* Six stems, each in six act fragments that lock into place on the impact. */}
          {LANES_FULL.map((lane, i) => {
            const laneCy = blockTop + i * (laneH + gap) + laneH / 2;
            const y = lerp(laneCy, cy, Math.min(1, merge));
            const fade = 1 - Math.min(1, merge * 1.4);
            if (fade <= 0) return null;
            const env = data.stems[lane.id].envelope;
            return (
              <g key={lane.id} opacity={fade}>
                {ACTS.map((act, k) => {
                  const seed = i * 7 + k;
                  const dx = (hash01(seed, 1) - 0.5) * 180 * u;
                  const dy = (hash01(seed, 2) - 0.5) * 120 * u;
                  const lock = springTo(t, tLock + (hash01(seed, 3) * 2) / 60, 1, 0, LOCK);
                  const from = framesToSeconds(act.from);
                  const to = framesToSeconds(act.from + act.durationInFrames);
                  const played = overviewPath(env, bx, bw, 0, laneH / 2 - 2 * u, from, Math.min(to, t));
                  const ahead = t < to ? overviewPath(env, bx, bw, 0, laneH / 2 - 2 * u, Math.max(from, t), to) : '';
                  return (
                    <g key={act.id} transform={`translate(${(dx * lock).toFixed(2)} ${(y + dy * lock).toFixed(2)})`}>
                      {played ? <path d={played} fill={C.paper} opacity={0.92} /> : null}
                      {ahead ? <path d={ahead} fill="none" stroke={C.g5} strokeWidth={1} /> : null}
                    </g>
                  );
                })}
                <text x={bx - 24 * u} y={y + 5 * u} textAnchor="end" fill={C.g7} fontFamily={MONO} fontSize={14 * u} letterSpacing="0.14em">
                  {lane.label}
                </text>
              </g>
            );
          })}

          {/* Act boundaries and numbers. */}
          {merge < 0.9
            ? ACTS.map(act => {
                const x = crisp(bx + (framesToSeconds(act.from) / DURATION_SECONDS) * bw);
                return (
                  <g key={act.id} opacity={1 - merge}>
                    <line x1={x} x2={x} y1={blockTop - 28 * u} y2={blockTop + 6 * (laneH + gap)} stroke={C.g4} strokeWidth={1} />
                    <text x={x + 6 * u} y={blockTop - 16 * u} fill={C.g6} fontFamily={MONO} fontSize={12 * u} letterSpacing="0.14em">
                      {`0${act.index} ${act.title}`}
                    </text>
                  </g>
                );
              })
            : null}

          {/* Master: the stems' sum, then the hairline. */}
          {merge > 0.01 ? (
            <>
              {masterAmp > 0.5 ? <path d={overviewPath(data.master.envelope, cx - lineW / 2, lineW, cy, masterAmp)} fill={C.ink} /> : null}
              <line x1={cx - lineW / 2} x2={cx + lineW / 2} y1={crisp(cy)} y2={crisp(cy)} stroke={C.ink} strokeWidth={1} />
            </>
          ) : null}

          {merge < 0.6 ? <line x1={crisp(nowX)} x2={crisp(nowX)} y1={blockTop - 36 * u} y2={blockTop + 6 * (laneH + gap) + 8 * u} stroke={C.ink} strokeWidth={1.5} opacity={1 - merge / 0.6} /> : null}
        </svg>
      ) : null}

      {showSystem && merge < 0.9 ? (
        <>
          <div style={{position: 'absolute', left: bx, top: blockTop - 92 * u, display: 'flex', gap: 20 * u, alignItems: 'baseline', opacity: 1 - merge}}>
            <span style={{...mono(20 * u, 700, 0.18), color: C.ink}}>RENDER</span>
            <span style={{...mono(15 * u, 500, 0.12), color: C.g6}}>MASTER.WAV · 24.000 S · 1,440 F · 6 STEMS · SHA-256</span>
          </div>
          <div style={{position: 'absolute', right: bx, top: blockTop - 88 * u, opacity: 1 - merge, ...mono(15 * u, 500, 0.12), color: C.g6}}>160 BPM · 16 BARS</div>
        </>
      ) : null}

      {t >= tMark ? (
        <>
          <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
            {t < tGive ? <line x1={cx - 490 * u} x2={cx + 490 * u} y1={crisp(cy)} y2={crisp(cy)} stroke={C.g4} strokeWidth={1} /> : null}
          </svg>
          <AbsoluteFill style={{translate: `0px ${(markY - cy).toFixed(2)}px`, scale: markScale.toFixed(4), transformOrigin: `${cx}px ${cy}px`}}>
            <TypeHit lines={['DAEMONV12']} t={t} t0={tMark} t1={tBlack} size={150 * u} weight={860} stretch={[78, 112]} tracking={0.02} x={cx} y={cy} entry="mask" chroma={6 * u} />
          </AbsoluteFill>
          <TypeHit
            lines={['GIVE AGENTS', 'INSTRUMENTS.']}
            t={t}
            t0={tGive}
            t1={tBlack}
            stagger={tInst - tGive}
            size={168 * u}
            weight={900}
            stretch={[100, 100]}
            tracking={-0.025}
            x={cx}
            y={cy + 90 * u}
            entry="mask"
            lineGap={0.08}
            chroma={7 * u}
            style={{filter: impact(t, tInst, 0.05) > 0.3 ? 'brightness(1.4)' : undefined}}
          />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
