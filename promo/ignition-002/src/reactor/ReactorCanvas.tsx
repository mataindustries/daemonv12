import {useLayoutEffect, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import type {Choreo} from '../choreo.ts';
import {renderFrame} from './render.ts';

/** The whole reactor on one canvas, redrawn synchronously for every frame. */
export const ReactorCanvas: React.FC<{choreo: Choreo; skip?: readonly string[]; timeOffset: number}> = ({choreo, skip, timeOffset}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    renderFrame(ctx, choreo.at(frame / fps + timeOffset), {width, height, skip});
  }, [choreo, frame, fps, width, height, skip, timeOffset]);

  return <canvas ref={ref} width={width} height={height} style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}} />;
};
