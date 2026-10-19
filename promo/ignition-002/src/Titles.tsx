// The three lines of copy. Always on screen (a loop has no title reveal), always inside the
// platform-safe box, lit by the reactor: a heat sweep crosses IGNITION on every bar line and
// the glow breathes with the kick and the loop's power curve.
import type {CSSProperties} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import type {Choreo} from './choreo.ts';
import {DISPLAY, MONO} from './fonts.ts';
import {SAFE} from './layout.ts';
import {hitEnv, type Hit} from './motion/periodic.ts';
import {BEAT, BARS, bar} from './timeline.ts';


const WORD = 'IGNITION';
const sweeps: Hit[][] = [...WORD].map((_, i) => Array.from({length: BARS}, (_, b) => ({t: bar(b) + (i * BEAT) / 9, s: b % 2 === 0 ? 1 : 0.6})));

const display = (size: number, weight: number, tracking: number): CSSProperties => ({
  fontFamily: DISPLAY,
  fontSize: size,
  fontWeight: weight,
  fontStretch: '125%',
  letterSpacing: `${tracking}em`,
  lineHeight: 1,
  textTransform: 'uppercase',
  whiteSpace: 'pre',
});

export const Titles: React.FC<{choreo: Choreo; timeOffset: number}> = ({choreo, timeOffset}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps + timeOffset;
  const s = choreo.at(t);
  const glow = 0.3 + 0.35 * s.power + 0.2 * s.kick;

  const ignition = display(112, 800, 0.1);
  const centred: CSSProperties = {position: 'absolute', left: 0, right: 0, display: 'flex', justifyContent: 'center'};

  return (
    <>
      {/* Scrims keep the copy legible over the brightest moments without boxing it in. */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 640, background: 'linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.38) 55%, rgba(0,0,0,0) 100%)'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: SAFE.bottom - 150, height: 230, background: 'radial-gradient(ellipse 48% 50% at 50% 50%, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 55%, rgba(0,0,0,0) 100%)'}} />

      <div style={{...centred, top: SAFE.top + 22}}>
        <div style={{position: 'relative', paddingLeft: '0.1em', ...ignition}}>
          <div style={{position: 'absolute', inset: 0, paddingLeft: '0.1em', color: 'rgb(255,128,40)', filter: 'blur(18px)', opacity: glow}}>{WORD}</div>
          {[...WORD].map((ch, i) => {
            const h = Math.min(1, hitEnv(t, sweeps[i]!, 0.22) + 0.25 * s.kick * s.power);
            const top = `rgb(${Math.round(226 + 29 * h)},${Math.round(230 + 22 * h)},${Math.round(236 + 6 * h)})`;
            const low = `rgb(255,${Math.round(150 + 80 * h)},${Math.round(62 + 120 * h)})`;
            return (
              <span
                key={i}
                style={{
                  position: 'relative',
                  backgroundImage: `linear-gradient(180deg, ${top} 0%, #B9BFC6 46%, #8E949C 54%, ${low} 100%)`,
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                  filter: `drop-shadow(0 0 ${(4 + 14 * h).toFixed(1)}px rgba(255,150,60,${(0.25 + 0.55 * h).toFixed(3)}))`,
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
      </div>

      <div style={{...centred, top: SAFE.top + 168, alignItems: 'center', gap: 22}}>
        <div style={{width: 64, height: 2, background: `linear-gradient(90deg, rgba(255,160,70,0), rgba(255,170,80,${(0.5 + 0.4 * s.kick).toFixed(3)}))`}} />
        <div style={{...display(44, 600, 0.36), paddingLeft: '0.36em', color: '#FFB75E', textShadow: `0 0 ${(10 + 10 * glow).toFixed(1)}px rgba(255,120,30,${(0.35 + 0.3 * glow).toFixed(3)})`}}>SECOND WIND</div>
        <div style={{width: 64, height: 2, background: `linear-gradient(270deg, rgba(255,160,70,0), rgba(255,170,80,${(0.5 + 0.4 * s.kick).toFixed(3)}))`}} />
      </div>

      <div style={{...centred, top: SAFE.bottom - 44, alignItems: 'center', gap: 18}}>
        <div style={{width: 12, height: 12, background: `rgba(255,${Math.round(150 + 80 * s.kick)},70,${(0.55 + 0.45 * s.kick).toFixed(3)})`, boxShadow: `0 0 ${(8 + 14 * s.kick).toFixed(1)}px rgba(255,140,40,0.8)`}} />
        <div style={{fontFamily: MONO, fontSize: 40, fontWeight: 600, letterSpacing: '0.46em', paddingLeft: '0.46em', lineHeight: 1, color: '#AEB4BC', whiteSpace: 'pre'}}>DAEMONV12</div>
      </div>
    </>
  );
};
