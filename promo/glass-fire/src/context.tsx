import {createContext, useContext, type ReactNode} from 'react';
import {Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import type {PromoData} from './data/contract.ts';
import type {Act} from './timeline/acts.ts';
import {FPS} from './timeline/grid.ts';

const DataContext = createContext<PromoData | null>(null);
const OffsetContext = createContext(0);

export const PromoDataProvider = ({data, children}: {data: PromoData; children: ReactNode}) => (
  <DataContext.Provider value={data}>{children}</DataContext.Provider>
);

export const usePromoData = (): PromoData => {
  const data = useContext(DataContext);
  if (!data) throw new Error('usePromoData() outside <PromoDataProvider>');
  return data;
};

/**
 * Global time inside any act. Remotion's useCurrentFrame() is local to its <Sequence>;
 * the music data is indexed from the start of the master, so acts read this instead.
 */
export const useTime = () => {
  const local = useCurrentFrame();
  const offset = useContext(OffsetContext);
  const frame = local + offset;
  return {frame, local, t: frame / FPS};
};

/** One act on the main timeline: a bar-aligned <Sequence> that also publishes its offset. */
export const ActSequence = ({act, children}: {act: Act; children: ReactNode}) => {
  const {fps} = useVideoConfig();
  return (
    <Sequence name={`${act.index} · ${act.title}`} from={act.from} durationInFrames={act.durationInFrames} premountFor={fps}>
      <OffsetContext.Provider value={act.from}>{children}</OffsetContext.Provider>
    </Sequence>
  );
};
