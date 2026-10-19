import {Composition} from 'remotion';
import {InfiniteReactor} from './InfiniteReactor.tsx';

export const RemotionRoot = () => {
  return (
    <Composition
      id="InfiniteReactor"
      component={InfiniteReactor}
      durationInFrames={900}
      fps={60}
      width={1080}
      height={1920}
      defaultProps={{audio: false}}
    />
  );
};
