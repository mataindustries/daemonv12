// GLASS//FIRE VERTICAL · 15.000 s · 60 fps · 900 frames · 1080×1920 · 160 BPM · 10 bars.
// The social cut: ten bars of the final master (edit.ts) in five portrait sections, built from
// the same data, primitives and motion system as the landscape film.
import {Audio} from '@remotion/media';
import {AbsoluteFill, staticFile, useCurrentFrame, type CalculateMetadataFunction} from 'remotion';
import {z} from 'zod';
import {loadPromoData} from '../GlassFire.tsx';
import {PromoDataProvider} from '../context.tsx';
import {C, useStage} from '../theme.ts';
import {VDataProvider, SectionSequence, type VLayers} from './context.tsx';
import {vCue} from './cues.ts';
import {buildVData, extrasSchema, type VData} from './data.ts';
import {V_DURATION_IN_FRAMES, V_FPS} from './edit.ts';
import {VChrome} from './primitives/VChrome.tsx';
import {sectionAtFrame, V_SECTION} from './sections.ts';
import {VDrop1} from './sections/VDrop1.tsx';
import {VDrop2} from './sections/VDrop2.tsx';
import {VFakeout} from './sections/VFakeout.tsx';
import {VHook} from './sections/VHook.tsx';
import {VPayoff} from './sections/VPayoff.tsx';
import {firstStopIn, gateAt} from './sections/shared.ts';

export const glassFireVerticalSchema = z.object({
  /** fixture: deterministic placeholder data. sync: the final delivery in public/sync/ (run npm run vertical:prepare). */
  dataSource: z.enum(['fixture', 'sync']),
  /** none: silent. master: public/sync/vertical-15s.wav, the edited final master. */
  audio: z.enum(['none', 'master']),
  /** all: the film. copy: copy layers only, for the safe-zone QA. */
  layers: z.enum(['all', 'copy']),
});

export type GlassFireVerticalProps = z.infer<typeof glassFireVerticalSchema> & {
  /** Filled by calculateMetadata; never authored by hand. */
  vdata?: VData;
};

export const V_EXTRAS = 'sync/vertical-extras.json';
export const V_AUDIO = 'sync/vertical-15s.wav';

export const loadVData = async (dataSource: GlassFireVerticalProps['dataSource'], signal?: AbortSignal): Promise<VData> => {
  const song = await loadPromoData(dataSource, signal);
  if (dataSource === 'fixture') return buildVData(song, null);
  const response = await fetch(staticFile(V_EXTRAS), {signal});
  if (!response.ok) throw new Error(`dataSource "sync" needs public/${V_EXTRAS} (HTTP ${response.status}). Run npm run vertical:prepare first.`);
  return buildVData(song, extrasSchema.parse(await response.json()));
};

/** Duration and frame rate are locked; only the data varies. */
export const calculateVerticalMetadata: CalculateMetadataFunction<GlassFireVerticalProps> = async ({props, abortSignal}) => ({
  durationInFrames: V_DURATION_IN_FRAMES,
  fps: V_FPS,
  props: {...props, vdata: await loadVData(props.dataSource, abortSignal)},
});

const Chrome = ({data}: {data: VData}) => {
  const frame = useCurrentFrame();
  const stage = useStage();
  const t = frame / V_FPS;
  const section = sectionAtFrame(frame);
  const stop = firstStopIn(data, section);
  let opacity = 0;
  if (section.id === 'hook') opacity = 0.7;
  if (section.id === 'drop1' || section.id === 'drop2') opacity = 1;
  if (section.id === 'payoff') opacity = t < vCue(data.promo, 'simplify') ? 0.6 : 0;
  if ((stop !== null && t >= stop) || gateAt(data, t)) opacity = 0;
  return <VChrome stage={stage} frame={frame} opacity={opacity} />;
};

export const GlassFireVertical = ({vdata, audio, layers}: GlassFireVerticalProps) => {
  if (!vdata) throw new Error('GlassFireVertical: data is loaded by calculateMetadata; render through the GlassFireVertical composition.');
  const mode: VLayers = layers;
  return (
    <PromoDataProvider data={vdata.promo}>
      <VDataProvider data={vdata} layers={mode}>
        <AbsoluteFill style={{background: C.void}}>
          <SectionSequence section={V_SECTION.hook}>
            <VHook />
          </SectionSequence>
          <SectionSequence section={V_SECTION.drop1}>
            <VDrop1 />
          </SectionSequence>
          <SectionSequence section={V_SECTION.fakeout}>
            <VFakeout />
          </SectionSequence>
          <SectionSequence section={V_SECTION.drop2}>
            <VDrop2 />
          </SectionSequence>
          <SectionSequence section={V_SECTION.payoff}>
            <VPayoff />
          </SectionSequence>
          {mode === 'all' ? <Chrome data={vdata} /> : null}
          {audio === 'master' ? <Audio src={staticFile(V_AUDIO)} /> : null}
        </AbsoluteFill>
      </VDataProvider>
    </PromoDataProvider>
  );
};
