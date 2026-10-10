import {Composition, Folder, Sequence, type CalculateMetadataFunction} from 'remotion';
import {z} from 'zod';
import {ContactSheet, SHEET_HEIGHT, SHEET_WIDTH} from './ContactSheet.tsx';
import {calculateGlassFireMetadata, GlassFire, glassFireSchema, loadPromoData, type GlassFireProps} from './GlassFire.tsx';
import {ACT, type ActId} from './timeline/acts.ts';
import {FPS} from './timeline/grid.ts';

const actPreviewSchema = glassFireSchema.extend({act: z.enum(['hook', 'ignition', 'drop1', 'fakeout', 'drop2', 'payoff'])});
type ActPreviewProps = GlassFireProps & {act: ActId};

/** One act in isolation: the full film shifted so the act starts at frame 0. */
const ActPreview = ({act, ...props}: ActPreviewProps) => (
  <Sequence from={-ACT[act].from} name={ACT[act].title}>
    <GlassFire {...props} />
  </Sequence>
);

const calculateActMetadata: CalculateMetadataFunction<ActPreviewProps> = async ({props, abortSignal}) => ({
  durationInFrames: ACT[props.act].durationInFrames,
  fps: FPS,
  props: {...props, data: await loadPromoData(props.dataSource, abortSignal)},
});

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="GlassFire"
        component={GlassFire}
        durationInFrames={1440}
        fps={60}
        width={1920}
        height={1080}
        schema={glassFireSchema}
        defaultProps={{dataSource: 'fixture', audio: 'none'}}
        calculateMetadata={calculateGlassFireMetadata}
      />
      <Folder name="Acts">
        <Composition id="Act1-Hook" component={ActPreview} durationInFrames={180} fps={60} width={1920} height={1080} schema={actPreviewSchema} defaultProps={{act: 'hook', dataSource: 'fixture', audio: 'none'}} calculateMetadata={calculateActMetadata} />
        <Composition id="Act2-Ignition" component={ActPreview} durationInFrames={180} fps={60} width={1920} height={1080} schema={actPreviewSchema} defaultProps={{act: 'ignition', dataSource: 'fixture', audio: 'none'}} calculateMetadata={calculateActMetadata} />
        <Composition id="Act3-Drop1" component={ActPreview} durationInFrames={360} fps={60} width={1920} height={1080} schema={actPreviewSchema} defaultProps={{act: 'drop1', dataSource: 'fixture', audio: 'none'}} calculateMetadata={calculateActMetadata} />
        <Composition id="Act4-Fakeout" component={ActPreview} durationInFrames={180} fps={60} width={1920} height={1080} schema={actPreviewSchema} defaultProps={{act: 'fakeout', dataSource: 'fixture', audio: 'none'}} calculateMetadata={calculateActMetadata} />
        <Composition id="Act5-Drop2" component={ActPreview} durationInFrames={360} fps={60} width={1920} height={1080} schema={actPreviewSchema} defaultProps={{act: 'drop2', dataSource: 'fixture', audio: 'none'}} calculateMetadata={calculateActMetadata} />
        <Composition id="Act6-Payoff" component={ActPreview} durationInFrames={180} fps={60} width={1920} height={1080} schema={actPreviewSchema} defaultProps={{act: 'payoff', dataSource: 'fixture', audio: 'none'}} calculateMetadata={calculateActMetadata} />
      </Folder>
      {/* A still (render frame 0), but it keeps the film's duration: nested acts are clamped to it. */}
      <Folder name="QA">
        <Composition
          id="ContactSheet"
          component={ContactSheet}
          durationInFrames={1440}
          fps={60}
          width={SHEET_WIDTH}
          height={SHEET_HEIGHT}
          schema={glassFireSchema}
          defaultProps={{dataSource: 'fixture', audio: 'none'}}
          calculateMetadata={async ({props, abortSignal}) => ({props: {...props, data: await loadPromoData(props.dataSource, abortSignal)}})}
        />
      </Folder>
    </>
  );
};
