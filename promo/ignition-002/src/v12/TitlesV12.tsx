// The V1 copy, restrained: smaller than the engine, engraved steel with a warm underlight,
// inside the same platform-safe box. A spark of ignition runs under IGNITION on every bar.
import type {CSSProperties} from 'react';
import {DISPLAY, MONO} from '../fonts.ts';
import {SAFE} from '../layout.ts';
import {BAR} from '../timeline.ts';
import type {V12State} from './choreo.ts';

const display = (size: number, weight: number, tracking: number): CSSProperties => ({
  fontFamily: DISPLAY,
  fontSize: size,
  fontWeight: weight,
  fontStretch: '125%',
  letterSpacing: `${tracking}em`,
  paddingLeft: `${tracking}em`,
  lineHeight: 1,
  textTransform: 'uppercase',
  whiteSpace: 'pre',
});

export const TitlesV12: React.FC<{s: V12State}> = ({s}) => {
  const centred: CSSProperties = {position: 'absolute', left: 0, right: 0, display: 'flex', justifyContent: 'center'};
  const heat = Math.min(1, 0.35 + 0.35 * s.power + 0.3 * s.overdrive + 0.2 * s.kick);
  const sweep = (s.t % BAR) / BAR;
  return (
    <>
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 560, background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 55%, rgba(0,0,0,0) 100%)'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: SAFE.bottom - 170, height: 260, background: 'radial-gradient(ellipse 46% 50% at 50% 50%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0) 100%)'}} />
      <div style={{...centred, top: SAFE.top + 16}}>
        <div
          style={{
            ...display(86, 800, 0.16),
            backgroundImage: `linear-gradient(180deg, #F2F4F7 0%, #B8BEC6 48%, #7E858E 52%, rgb(255,${Math.round(150 + 70 * heat)},${Math.round(70 + 60 * heat)}) 100%)`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            filter: `drop-shadow(0 2px 0 rgba(0,0,0,0.85)) drop-shadow(0 0 ${(6 + 10 * heat).toFixed(1)}px rgba(255,130,40,${(0.25 + 0.35 * heat).toFixed(3)}))`,
          }}
        >
          IGNITION
        </div>
      </div>
      <div style={{...centred, top: SAFE.top + 124}}>
        <div style={{position: 'relative', width: 520, height: 2, background: 'rgba(255,170,90,0.18)'}}>
          <div style={{position: 'absolute', top: -1, height: 4, width: 70, left: `${(sweep * 590 - 70).toFixed(1)}px`, background: 'linear-gradient(90deg, rgba(255,170,80,0), rgba(255,220,170,0.95), rgba(255,170,80,0))', boxShadow: '0 0 10px rgba(255,150,60,0.9)'}} />
        </div>
      </div>
      <div style={{...centred, top: SAFE.top + 146}}>
        <div style={{...display(38, 600, 0.42), color: '#FFB25A', textShadow: `0 1px 0 rgba(0,0,0,0.8), 0 0 ${(8 + 8 * heat).toFixed(1)}px rgba(255,120,30,${(0.3 + 0.3 * heat).toFixed(3)})`}}>SECOND WIND</div>
      </div>
      <div style={{...centred, top: SAFE.bottom - 40, alignItems: 'center', gap: 16}}>
        <div style={{width: 10, height: 10, background: `rgba(${Math.round(110 + 145 * s.phrase)},${Math.round(180 + 40 * s.phrase)},255,${(0.5 + 0.5 * Math.max(s.brass, s.phrase)).toFixed(3)})`, boxShadow: '0 0 12px rgba(95,180,255,0.8)'}} />
        <div style={{fontFamily: MONO, fontSize: 34, fontWeight: 600, letterSpacing: '0.5em', paddingLeft: '0.5em', lineHeight: 1, color: '#AEB4BC', whiteSpace: 'pre', textShadow: '0 1px 0 rgba(0,0,0,0.9)'}}>DAEMONV12</div>
      </div>
    </>
  );
};
