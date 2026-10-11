// 5 · PAYOFF · output bars 9–10 · frames 720–899 · song bars 15–16
// Out of the silence the whole cut locks into one organized form: all six stems across the
// fifteen seconds just heard, five section fragments snapping into place on the prism impact.
// The stems merge into the master, the master flattens into the hairline the film is built on,
// and the line opens into the end card. The prism's gate-chopped gain automation lights the
// type's glass fringe; the CTA's underline is drawn by the last glass reverse, which ends on the
// final sample, so the loop restarts on a downbeat. No cut to black: the card holds to the end.
import {AbsoluteFill} from 'remotion';
import type {Envelope} from '../../data/contract.ts';
import {automationNormAt, envAt} from '../../data/signals.ts';
import {expoOut, hash01, lerp, progress, SPRINGS, springChain, springStep, springTo, type SpringParams} from '../../motion/physics.ts';
import {LANES_FULL} from '../../primitives/Arrangement.tsx';
import {TypeHit} from '../../primitives/TypeHit.tsx';
import {crisp} from '../../primitives/view.ts';
import {C, mono, MONO, useStage} from '../../theme.ts';
import {CTA_LINE} from '../config.ts';
import {Machinery, useOutTime, useVData} from '../context.tsx';
import {triggersBetween} from '../data.ts';
import {vCue} from '../cues.ts';
import {V_DURATION_SECONDS} from '../edit.ts';
import {SAFE_CX} from '../layout.ts';
import {V_SECTION, V_SECTIONS} from '../sections.ts';

const LOCK: SpringParams = {freq: 7, damping: 0.78};
const BX = 140;
const BW = 800;

/** A whole-cut envelope as a mirrored outline over [x, x + w]. */
const overviewPath = (env: Envelope, x: number, w: number, cy: number, amp: number, from = 0, to = V_DURATION_SECONDS) => {
  const top: string[] = [];
  const bottom: string[] = [];
  const x0 = x + (from / V_DURATION_SECONDS) * w;
  const x1 = x + (to / V_DURATION_SECONDS) * w;
  for (let px = x0; px <= x1 + 0.01; px += 2) {
    const a = envAt(env, ((px - x) / w) * V_DURATION_SECONDS) * amp;
    top.push(`${px.toFixed(1)} ${(cy - a).toFixed(1)}`);
    bottom.push(`${px.toFixed(1)} ${(cy + a).toFixed(1)}`);
  }
  return top.length > 1 ? `M${top.join('L')}L${bottom.reverse().join('L')}Z` : '';
};

export const VPayoff = () => {
  const data = useVData();
  const {t} = useOutTime();
  const stage = useStage();
  const {W, H, u, cy} = stage;
  const promo = data.promo;

  const tLock = vCue(promo, 'payoff');
  const tMerge = vCue(promo, 'merge');
  const tSimplify = vCue(promo, 'simplify');
  const tMark = vCue(promo, 'finalWordmark');
  const tGive = vCue(promo, 'giveAgents');
  const tInst = vCue(promo, 'giveInstruments');
  const tCta = vCue(promo, 'cta');
  const tEnd = (V_SECTION.payoff.from + V_SECTION.payoff.durationInFrames) / 60;

  const laneH = 60 * u;
  const gap = 16 * u;
  const blockTop = cy - (LANES_FULL.length * laneH + (LANES_FULL.length - 1) * gap) / 2;
  const merge = springTo(t, tMerge, 0, 1, SPRINGS.heavy);
  const flatten = springStep(t - tSimplify, SPRINGS.lock);
  const nowX = BX + (t / V_DURATION_SECONDS) * BW;
  const showSystem = t < tMark;
  const masterAmp = lerp(0, 120 * u, Math.min(1, merge)) * (1 - flatten);
  const lineW = lerp(BW, 760 * u, flatten);

  // The wordmark lifts a sixteenth before the tagline lands, with velocity continuity.
  const lift = tGive - 0.375 / 4;
  const markY = springChain(t, [{t: 0, v: cy}, {t: lift, v: 640 * u}], SPRINGS.heavy);
  const prism = promo.automation.find(a => a.id === 'track.prism.gain');
  const shimmer = prism ? automationNormAt(prism, t) : 0;
  const reverse = triggersBetween(data.triggers, tLock, tEnd, tr => tr.sample === 'glass-reverse').at(-1);
  const charge = reverse ? progress(t, reverse.t, reverse.t + reverse.duration) : progress(t, tCta, tEnd);
  const ctaType = Math.ceil(Math.min(1, progress(t, tCta, tCta + 0.12)) * CTA_LINE.length);

  return (
    <AbsoluteFill style={{background: C.void}}>
      <Machinery>
        {showSystem ? (
          <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
            {LANES_FULL.map((lane, i) => {
              const laneCy = blockTop + i * (laneH + gap) + laneH / 2;
              const y = lerp(laneCy, cy, Math.min(1, merge));
              const fade = 1 - Math.min(1, merge * 1.4);
              if (fade <= 0) return null;
              const env = promo.stems[lane.id].envelope;
              return (
                <g key={lane.id} opacity={fade}>
                  {V_SECTIONS.map((section, k) => {
                    const seed = i * 7 + k;
                    const dx = (hash01(seed, 1) - 0.5) * 160 * u;
                    const dy = (hash01(seed, 2) - 0.5) * 140 * u;
                    const lock = springTo(t, tLock + (hash01(seed, 3) * 2) / 60, 1, 0, LOCK);
                    const from = section.from / 60;
                    const to = (section.from + section.durationInFrames) / 60;
                    const played = overviewPath(env, BX, BW, 0, laneH / 2 - 2 * u, from, Math.min(to, t));
                    const ahead = t < to ? overviewPath(env, BX, BW, 0, laneH / 2 - 2 * u, Math.max(from, t), to) : '';
                    return (
                      <g key={section.id} transform={`translate(${(dx * lock).toFixed(2)} ${(y + dy * lock).toFixed(2)})`}>
                        {played ? <path d={played} fill={C.paper} opacity={0.92} /> : null}
                        {ahead ? <path d={ahead} fill="none" stroke={C.g5} strokeWidth={1} /> : null}
                      </g>
                    );
                  })}
                  <text x={BX - 16 * u} y={y + 5 * u} textAnchor="end" fill={C.g7} fontFamily={MONO} fontSize={14 * u} letterSpacing="0.12em">
                    {lane.label}
                  </text>
                </g>
              );
            })}
            {merge < 0.9
              ? V_SECTIONS.map(section => {
                  const x = crisp(BX + (section.from / 60 / V_DURATION_SECONDS) * BW);
                  return <line key={section.id} x1={x} x2={x} y1={blockTop - 24 * u} y2={blockTop + 6 * (laneH + gap)} stroke={C.g4} strokeWidth={1} opacity={1 - merge} />;
                })
              : null}
            {merge > 0.01 ? (
              <>
                {masterAmp > 0.5 ? <path d={overviewPath(promo.master.envelope, SAFE_CX - lineW / 2, lineW, cy, masterAmp)} fill={C.ink} /> : null}
                <line x1={SAFE_CX - lineW / 2} x2={SAFE_CX + lineW / 2} y1={crisp(cy)} y2={crisp(cy)} stroke={C.ink} strokeWidth={1} />
              </>
            ) : null}
            {merge < 0.6 ? <line x1={crisp(nowX)} x2={crisp(nowX)} y1={blockTop - 30 * u} y2={blockTop + 6 * (laneH + gap) + 8 * u} stroke={C.ink} strokeWidth={1.5} opacity={1 - merge / 0.6} /> : null}
          </svg>
        ) : null}
        {showSystem && merge < 0.9 ? (
          <div style={{position: 'absolute', left: BX, top: blockTop - 70 * u, display: 'flex', gap: 16 * u, alignItems: 'baseline', opacity: 1 - merge}}>
            <span style={{...mono(19 * u, 700, 0.16), color: C.ink}}>RENDER</span>
            <span style={{...mono(15 * u, 500, 0.1), color: C.g6}}>15.000 S · 900 F · 6 STEMS · 1 AGENT</span>
          </div>
        ) : null}
        {t >= tMark && t < tGive ? (
          <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
            <line x1={SAFE_CX - 380 * u} x2={SAFE_CX + 380 * u} y1={crisp(cy)} y2={crisp(cy)} stroke={C.g4} strokeWidth={1} />
          </svg>
        ) : null}
      </Machinery>

      {t >= tMark ? (
        <>
          <AbsoluteFill style={{translate: `0px ${(markY - cy).toFixed(2)}px`}}>
            <TypeHit lines={['DAEMONV12']} t={t} t0={tMark} t1={tEnd + 1} size={104 * u} weight={860} stretch={[100, 100]} tracking={0.02} x={SAFE_CX} y={cy} entry="mask" chroma={6 * u} />
          </AbsoluteFill>
          <TypeHit lines={['GIVE AGENTS']} t={t} t0={tGive} t1={tEnd + 1} size={100 * u} weight={900} stretch={[100, 100]} tracking={-0.025} x={SAFE_CX} y={862 * u} entry="mask" chroma={7 * u + 6 * u * shimmer} />
          <TypeHit lines={['INSTRUMENTS.']} t={t} t0={tInst} t1={tEnd + 1} size={100 * u} weight={900} stretch={[88, 88]} tracking={-0.025} x={SAFE_CX} y={956 * u} entry="mask" chroma={7 * u + 6 * u * shimmer} />
        </>
      ) : null}
      {t >= tCta ? (
        <div style={{position: 'absolute', left: SAFE_CX, top: 1150 * u, translate: '-50% 0', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <div style={{...mono(40 * u, 600, 0.04), color: C.ink}}>{CTA_LINE.slice(0, ctaType)}</div>
          <div style={{alignSelf: 'stretch', marginTop: 16 * u, height: 2 * u, background: C.g4, position: 'relative'}}>
            <div style={{position: 'absolute', left: 0, top: 0, height: '100%', width: `${(expoOut(progress(t, tCta, tCta + 0.2)) * 100).toFixed(2)}%`, background: C.g6}} />
            <div style={{position: 'absolute', left: 0, top: 0, height: '100%', width: `${(charge * 100).toFixed(2)}%`, background: C.ink}} />
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
