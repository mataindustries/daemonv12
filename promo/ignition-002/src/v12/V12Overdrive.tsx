import {Audio} from '@remotion/media';
import {ThreeCanvas} from '@remotion/three';
import {useMemo} from 'react';
import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {AUDIO_FILE} from '../InfiniteReactor.tsx';
import '../fonts.ts';
import {makeV12Choreo, type V12State} from './choreo.ts';
import {Engine} from './Engine.tsx';
import {makeMaterials} from './materials.ts';
import {CameraRig, Embers, EngineHall, Flames, HDR_MAX, Lights, Post} from './Stage.tsx';
import {assertV12Sync, type V12Sync} from './sync.ts';
import syncJson from './sync.json';
import {TitlesV12} from './TitlesV12.tsx';

const choreo = makeV12Choreo(assertV12Sync(syncJson as V12Sync));

export type V12OverdriveProps = {
  /** Play the approved WAV in Studio and previews. The master is muxed from the WAV instead. */
  audio: boolean;
  /** QA only: seconds added to every frame's time (1/60 renders frame 899 as virtual frame 900). */
  timeOffset?: number;
  /** QA only: draw the copy alone, to measure it against the safe box. */
  hideEngine?: boolean;
  /** QA only: scene parts to switch off (engine, hall, embers, flames, lights, fog, post). */
  debug?: string[];
};

const Scene: React.FC<{s: V12State; debug: readonly string[]}> = ({s, debug}) => {
  const on = (k: string) => !debug.includes(k);
  // debug "physical" swaps back to the slower Physical materials for comparison.
  const m = useMemo(() => makeMaterials(!debug.includes('physical')), [debug]);
  return (
    <>
      <CameraRig s={s} />
      {on('lights') ? <Lights s={s} shadows={on('shadow')} few={!on('manylights')} /> : <ambientLight intensity={1} />}
      {on('engine') ? <Engine s={s} m={m} /> : null}
      {on('hall') ? <EngineHall s={s} m={m} /> : null}
      {on('embers') ? <Embers s={s} /> : null}
      {on('flames') ? <Flames s={s} /> : null}
      <Post s={s} fog={on('fog')} post={on('post')} msaa={on('msaa')} bloom={on('bloom')} shadows={on('shadow')} stats={!on('stats')} hdrMax={Number(debug.find(d => d.startsWith('hdr:'))?.slice(4) ?? HDR_MAX)} />
    </>
  );
};

export const V12Overdrive: React.FC<V12OverdriveProps> = ({audio, timeOffset = 0, hideEngine = false, debug = []}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const s = choreo.at(frame / fps + timeOffset);
  return (
    <AbsoluteFill style={{backgroundColor: '#050404'}}>
      {hideEngine ? null : (
        // dpr follows Remotion's --scale (R3F would otherwise clamp it to ≥ 1 and draw full size for previews).
        <ThreeCanvas width={width} height={height} dpr={typeof window === 'undefined' ? 1 : Math.min(1, window.devicePixelRatio)} shadows gl={{antialias: false, powerPreference: 'high-performance'}} camera={{fov: 30, position: [6, 4, 10]}}>
          <Scene s={s} debug={debug} />
        </ThreeCanvas>
      )}
      {/* Vignette as a free HTML overlay instead of a full-screen WebGL pass. */}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse 72% 62% at 50% 52%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.42) 100%)'}} />
      <TitlesV12 s={s} />
      {audio ? <Audio src={staticFile(AUDIO_FILE)} /> : null}
    </AbsoluteFill>
  );
};
