import {Audio} from '@remotion/media';
import {AbsoluteFill, staticFile} from 'remotion';
import {makeChoreo} from './choreo.ts';
import './fonts.ts';
import {ReactorCanvas} from './reactor/ReactorCanvas.tsx';
import {assertSync, type SyncData} from './sync/contract.ts';
import syncJson from './sync/sync.json';
import {Titles} from './Titles.tsx';

/** The approved master, placed by hand (git-ignored). See README. */
export const AUDIO_FILE = 'audio/ignition-002-second-wind.wav';

const choreo = makeChoreo(assertSync(syncJson as SyncData));

export type InfiniteReactorProps = {
  /** Play the approved WAV in Studio and previews. The master is muxed from the WAV instead. */
  audio: boolean;
  /** QA only: renderer layers to switch off, e.g. ["bloom", "haze"]. */
  skip?: string[];
  /** QA only: seconds added to every frame's time, e.g. 1/60 renders frame 899 as virtual frame 900. */
  timeOffset?: number;
};

export const InfiniteReactor: React.FC<InfiniteReactorProps> = ({audio, skip, timeOffset = 0}) => {
  return (
    <AbsoluteFill style={{backgroundColor: '#040303'}}>
      <ReactorCanvas choreo={choreo} skip={skip} timeOffset={timeOffset} />
      <Titles choreo={choreo} timeOffset={timeOffset} />
      {audio ? <Audio src={staticFile(AUDIO_FILE)} /> : null}
    </AbsoluteFill>
  );
};
