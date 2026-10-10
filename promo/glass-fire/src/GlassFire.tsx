// GLASS//FIRE · 24.000 s · 60 fps · 1,440 frames · 160 BPM · 16 bars.
// The main composition: six bar-aligned acts, global frame chrome and optional audio.
import {Audio} from '@remotion/media';
import {AbsoluteFill, staticFile, useCurrentFrame, type CalculateMetadataFunction} from 'remotion';
import {z} from 'zod';
import {Act1Hook} from './acts/Act1Hook.tsx';
import {Act2Ignition} from './acts/Act2Ignition.tsx';
import {Act3Drop1} from './acts/Act3Drop1.tsx';
import {Act4Fakeout} from './acts/Act4Fakeout.tsx';
import {Act5Drop2} from './acts/Act5Drop2.tsx';
import {Act6Payoff} from './acts/Act6Payoff.tsx';
import {ActSequence, PromoDataProvider} from './context.tsx';
import {parsePromoData, type PromoData} from './data/contract.ts';
import {buildFixture} from './data/fixture.ts';
import {stopAt} from './data/signals.ts';
import {expoOut, progress} from './motion/physics.ts';
import {FrameChrome} from './primitives/FrameChrome.tsx';
import {C, useStage} from './theme.ts';
import {ACT, actAtFrame} from './timeline/acts.ts';
import {cue} from './timeline/cues.ts';
import {DURATION_IN_FRAMES, FPS} from './timeline/grid.ts';

export const glassFireSchema = z.object({
  /** fixture: deterministic placeholder data. sync: public/sync/promo-data.json from the analyzer. */
  dataSource: z.enum(['fixture', 'sync']),
  /** none: silent. click: 160 BPM dev reference (npm run click). master: public/sync/master.wav. */
  audio: z.enum(['none', 'click', 'master']),
});

export type GlassFireProps = z.infer<typeof glassFireSchema> & {
  /** Filled by calculateMetadata; never authored by hand. */
  data?: PromoData;
};

export const SYNC_DATA = 'sync/promo-data.json';
export const SYNC_MASTER = 'sync/master.wav';
export const DEV_CLICK = 'dev/click-160bpm.wav';

export const loadPromoData = async (dataSource: GlassFireProps['dataSource'], signal?: AbortSignal): Promise<PromoData> => {
  if (dataSource === 'fixture') return buildFixture();
  const response = await fetch(staticFile(SYNC_DATA), {signal});
  if (!response.ok) throw new Error(`dataSource "sync" needs public/${SYNC_DATA} (HTTP ${response.status}). Run npm run analyze first; see SYNC_HANDOFF.md.`);
  return parsePromoData(await response.json());
};

/** Duration and frame rate are locked; only the data varies. */
export const calculateGlassFireMetadata: CalculateMetadataFunction<GlassFireProps> = async ({props, abortSignal}) => ({
  durationInFrames: DURATION_IN_FRAMES,
  fps: FPS,
  props: {...props, data: await loadPromoData(props.dataSource, abortSignal)},
});

const Chrome = ({data}: {data: PromoData}) => {
  const frame = useCurrentFrame();
  const stage = useStage();
  const t = frame / FPS;
  const act = actAtFrame(frame);
  let opacity = 0;
  if (act.id === 'ignition') opacity = 0.7 * expoOut(progress(t, cue(data, 'ignition'), cue(data, 'ignition') + 0.25));
  if (act.id === 'drop1') opacity = t >= cue(data, 'justTools') && t < cue(data, 'justToolsOut') ? 0 : 1;
  if (act.id === 'drop2') opacity = 1;
  if (act.id === 'payoff') opacity = t < cue(data, 'simplify') ? 0.7 : 0;
  if (stopAt(data.markers, t)) opacity = 0;
  return <FrameChrome stage={stage} frame={frame} opacity={opacity} />;
};

export const GlassFire = ({data, audio}: GlassFireProps) => {
  if (!data) throw new Error('GlassFire: data is loaded by calculateMetadata; render through the GlassFire composition.');
  return (
    <PromoDataProvider data={data}>
      <AbsoluteFill style={{background: C.void}}>
        <ActSequence act={ACT.hook}>
          <Act1Hook />
        </ActSequence>
        <ActSequence act={ACT.ignition}>
          <Act2Ignition />
        </ActSequence>
        <ActSequence act={ACT.drop1}>
          <Act3Drop1 />
        </ActSequence>
        <ActSequence act={ACT.fakeout}>
          <Act4Fakeout />
        </ActSequence>
        <ActSequence act={ACT.drop2}>
          <Act5Drop2 />
        </ActSequence>
        <ActSequence act={ACT.payoff}>
          <Act6Payoff />
        </ActSequence>
        <Chrome data={data} />
        {audio === 'click' ? <Audio src={staticFile(DEV_CLICK)} volume={0.5} /> : null}
        {audio === 'master' ? <Audio src={staticFile(SYNC_MASTER)} /> : null}
      </AbsoluteFill>
    </PromoDataProvider>
  );
};
