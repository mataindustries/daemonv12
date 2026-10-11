// Small, data-driven SVG figures. Shapes come from repository data: waveform outlines
// are extracted from the sound-pack WAVs (scripts/extract-waveforms.ts), the sync map is
// the Shoot the Moon report's locked cue list, and the act ruler is GLASS//FIRE's grid.
import ghost from './data/ghost-shift.json';
import waveforms from './data/waveforms.json';
import {outlinePath} from './outline.ts';

const f = (v: number) => Math.round(v * 10) / 10;

export type SoundId = keyof typeof waveforms;

type WaveProps = {
  sound: SoundId;
  /** 'iris' strokes the outline with the thin-film accent; 'steel' keeps it graphite. */
  tone?: 'iris' | 'steel' | 'ink';
  width?: number;
  height?: number;
  className?: string;
  label?: string;
};

export const Wave = ({sound, tone = 'ink', width = 240, height = 64, className, label}: WaveProps) => {
  const d = outlinePath(waveforms[sound], width, height);
  return (
    <svg
      className={['wave', `wave--${tone}`, className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <line x1="0" x2={width} y1={height / 2} y2={height / 2} className="wave__zero" />
      <path d={d} className="wave__body" />
    </svg>
  );
};

/** Shared thin-film gradient, referenced by id from every iris stroke on the page. */
export const IrisDefs = () => (
  <svg width="0" height="0" aria-hidden="true" focusable="false" style={{position: 'absolute'}}>
    <defs>
      <linearGradient id="iris" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#8FE6FF" />
        <stop offset="0.36" stopColor="#B3A6FF" />
        <stop offset="0.68" stopColor="#FFB0D6" />
        <stop offset="1" stopColor="#FFE0A6" />
      </linearGradient>
      <linearGradient id="steel" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#6C6F76" />
        <stop offset="0.7" stopColor="#D2D4D7" />
        <stop offset="1" stopColor="#FFE0A6" />
      </linearGradient>
    </defs>
  </svg>
);

// reports/shoot-the-moon/REPORT.md, "Locked sync map": cue times in seconds on a
// 57.6 s reel. Major cues are the act-defining impacts and the final chord.
const SYNC = [0, 4.8, 7.2, 9.6, 12, 13.2, 14.4, 19.2, 21, 21.6, 24, 27, 28.8, 30, 31.2, 33.6, 36, 37.8, 39, 40.8, 42.6, 43.8, 45.6, 52.8, 57.6];
const SYNC_MAJOR = new Set([21.6, 31.2, 52.8]);
const REEL = 57.6;

export const SyncMap = () => {
  const W = 240;
  const H = 64;
  return (
    <svg className="fig" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Locked sync map: 25 sync points across the 57.6-second reel" focusable="false">
      <line x1="0" x2={W} y1={H - 18} y2={H - 18} className="fig__rule" />
      {SYNC.map(t => {
        const x = f((t / REEL) * (W - 1) + 0.5);
        const major = SYNC_MAJOR.has(t);
        return <line key={t} x1={x} x2={x} y1={major ? 4 : 24} y2={H - 18} className={major ? 'fig__mark fig__mark--major' : 'fig__mark'} />;
      })}
      {[0, 21.6, REEL].map(t => (
        <text key={t} x={f((t / REEL) * W)} y={H - 4} className="fig__label" textAnchor={t === 0 ? 'start' : t === REEL ? 'end' : 'middle'}>
          {t === REEL ? `${t.toFixed(1)} S` : t.toFixed(1)}
        </text>
      ))}
    </svg>
  );
};

// docs/V0_5_TIMELINE_DYNAMICS.md: game layers share tempo, meter, bar count and exact
// output boundaries; the host game crossfades them. Four bars at 100 BPM.
const LAYERS = [
  {id: 'SURFACE', on: [1, 1, 1, 1]},
  {id: 'THREAT', on: [0, 1, 1, 1]},
  {id: 'COMBAT', on: [0, 0, 1, 1]},
  {id: 'CLAIM', on: [0, 0, 0, 1]},
];

export const LoopLayers = () => {
  const W = 240;
  const lane = 12;
  const gap = 4;
  const left = 62;
  const H = LAYERS.length * (lane + gap) + 18;
  const bar = (W - left) / 4;
  return (
    <svg className="fig" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Four game layers locked to the same four-bar boundary" focusable="false">
      {LAYERS.map((layer, row) => (
        <g key={layer.id} transform={`translate(0 ${row * (lane + gap)})`}>
          <text x="0" y={lane - 3} className="fig__label">
            {layer.id}
          </text>
          {layer.on.map((on, b) => (
            <rect
              key={b}
              x={f(left + b * bar + 1)}
              y="0"
              width={f(bar - 2)}
              height={lane}
              className={on ? 'fig__block fig__block--on' : 'fig__block'}
            />
          ))}
        </g>
      ))}
      {[0, 1, 2, 3, 4].map(b => (
        <line key={b} x1={f(left + b * bar)} x2={f(left + b * bar)} y1="0" y2={H - 14} className="fig__rule" />
      ))}
      <text x={left} y={H - 2} className="fig__label">
        BAR 1
      </text>
      <text x={W} y={H - 2} className="fig__label" textAnchor="end">
        423,360 FRAMES
      </text>
    </svg>
  );
};

// promo/glass-fire/src/timeline/acts.ts: six bar-aligned acts over 16 bars.
export const ACTS = [
  {id: 'HOOK', bars: 2},
  {id: 'IGNITION', bars: 2},
  {id: 'DROP 1', bars: 4},
  {id: 'FAKEOUT', bars: 2},
  {id: 'DROP 2', bars: 4},
  {id: 'PAYOFF', bars: 2},
];

export const ActRuler = () => {
  const W = 240;
  const H = 52;
  const unit = W / 16;
  let at = 0;
  return (
    <svg className="fig" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="GLASS//FIRE structure: six acts across sixteen bars" focusable="false">
      {Array.from({length: 17}, (_, b) => (
        <line key={b} x1={f(b * unit)} x2={f(b * unit)} y1="42" y2="52" className="fig__rule" />
      ))}
      {ACTS.map(act => {
        const x = at * unit;
        at += act.bars;
        const drop = act.id.startsWith('DROP');
        return (
          <g key={act.id}>
            <rect x={f(x + 1)} y={drop ? 4 : 18} width={f(act.bars * unit - 2)} height={drop ? 34 : 20} className={drop ? 'fig__block fig__block--iris' : 'fig__block fig__block--on'} />
          </g>
        );
      })}
    </svg>
  );
};

/** Corner registration marks, as in the promo's FrameChrome. */
export const Registration = () => (
  <>
    <span className="reg reg--tl" aria-hidden="true" />
    <span className="reg reg--tr" aria-hidden="true" />
    <span className="reg reg--bl" aria-hidden="true" />
    <span className="reg reg--br" aria-hidden="true" />
  </>
);

// GHOST//SHIFT pitch trace: every ghost-vox voice in examples/ghost-shift.json as
// semitones from the source's C#4 over the 12-second render (scripts/extract-ghost-shift.ts).

const TRACE_TRACKS = [
  {id: 'ghost-hook', className: 'trace--hook'},
  {id: 'ghost-high', className: 'trace--high'},
  {id: 'ghost-fx', className: 'trace--fx'},
  {id: 'ghost-bass', className: 'trace--bass'},
] as const;

export const ghostCounts = ghost.counts;
export const ghostSourceSeconds = ghost.sourceSeconds;

export const PitchTrace = () => {
  const W = 640;
  const H = 260;
  const top = 12;
  const bottom = 26;
  const span = 26; // ±26 semitones
  const x = (t: number) => f((t / ghost.seconds) * W);
  const y = (s: number) => f(top + ((span - s) / (2 * span)) * (H - top - bottom));
  const voices = ghost.voices as unknown as Record<string, {points: [number, number][]; glide: string | null}[]>;
  const beat = 60 / ghost.bpm;
  return (
    <svg className="trace" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="trace-title" focusable="false" preserveAspectRatio="none">
      <title id="trace-title">
        GHOST//SHIFT pitch trace: one ghost-vox source performed as a hook, an octave-up double, risers, bass dives and a tape stop over 12 seconds
      </title>
      {Array.from({length: Math.floor(ghost.seconds / (beat * 4)) + 1}, (_, b) => (
        <line key={b} x1={x(b * beat * 4)} x2={x(b * beat * 4)} y1={top} y2={H - bottom} className="trace__bar" />
      ))}
      {[24, 12, 0, -12, -24].map(s => (
        <line key={s} x1="0" x2={W} y1={y(s)} y2={y(s)} className={s === 0 ? 'trace__zero' : 'trace__oct'} />
      ))}
      {TRACE_TRACKS.map(track =>
        (voices[track.id] ?? []).map((v, i) => (
          <polyline
            key={`${track.id}-${i}`}
            points={v.points.map(([t, s]) => `${x(t)},${y(s)}`).join(' ')}
            className={`trace__voice ${track.className}${v.glide ? ' trace__voice--glide' : ''}`}
            vectorEffect="non-scaling-stroke"
          />
        )),
      )}
    </svg>
  );
};
