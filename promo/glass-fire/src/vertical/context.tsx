import {createContext, useContext, type ReactNode} from 'react';
import {Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import type {VData} from './data.ts';
import {V_FPS} from './edit.ts';
import type {VSection} from './sections.ts';

/** all: the film. copy: only the copy layers, for the safe-zone QA in scripts/verify-vertical.ts. */
export type VLayers = 'all' | 'copy';

const VDataContext = createContext<VData | null>(null);
const OffsetContext = createContext(0);
const LayersContext = createContext<VLayers>('all');

export const VDataProvider = ({data, layers, children}: {data: VData; layers: VLayers; children: ReactNode}) => (
  <VDataContext.Provider value={data}>
    <LayersContext.Provider value={layers}>{children}</LayersContext.Provider>
  </VDataContext.Provider>
);

export const useVData = (): VData => {
  const data = useContext(VDataContext);
  if (!data) throw new Error('useVData() outside <VDataProvider>');
  return data;
};

/** Output time inside any section (the music data is indexed from the start of the cut). */
export const useOutTime = () => {
  const local = useCurrentFrame();
  const offset = useContext(OffsetContext);
  const frame = local + offset;
  return {frame, local, t: frame / V_FPS};
};

/** One section on the vertical timeline: a bar-aligned <Sequence> that publishes its offset. */
export const SectionSequence = ({section, children}: {section: VSection; children: ReactNode}) => {
  const {fps} = useVideoConfig();
  return (
    <Sequence name={section.title} from={section.from} durationInFrames={section.durationInFrames} premountFor={fps}>
      <OffsetContext.Provider value={section.from}>{children}</OffsetContext.Provider>
    </Sequence>
  );
};

/** Everything that is not copy. Hidden in the copy-only QA render. */
export const Machinery = ({children}: {children: ReactNode}) => (useContext(LayersContext) === 'copy' ? null : <>{children}</>);
