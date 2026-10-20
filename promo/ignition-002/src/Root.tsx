import {Composition, Folder} from 'remotion';
import {InfiniteReactor} from './InfiniteReactor.tsx';
import {V12Overdrive} from './v12/V12Overdrive.tsx';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="InfiniteReactor"
        component={InfiniteReactor}
        durationInFrames={900}
        fps={60}
        width={1080}
        height={1920}
        defaultProps={{audio: false}}
      />
      <Folder name="V12">
        <Composition
          id="V12Overdrive"
          component={V12Overdrive}
          durationInFrames={900}
          fps={60}
          width={1080}
          height={1920}
          defaultProps={{audio: false}}
        />
      </Folder>
    </>
  );
};
