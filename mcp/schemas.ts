import * as z from 'zod/v4';
import { effectParameters } from '../src/audio-types.ts';

const id = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);
const description = z.string().max(2000);
const bars = z.number().int().min(1).max(1000);
const pitch = z.union([z.string(), z.number().int().min(0).max(127)]);
const range=(bounds:readonly [number,number])=>z.number().min(bounds[0]).max(bounds[1]);
const effect = z.discriminatedUnion('type', [
  z.strictObject({type: z.literal('highpass'), frequencyHz: z.number().min(20).max(20000)}),
  z.strictObject({type: z.literal('lowpass'), frequencyHz: z.number().min(20).max(20000)}),
  z.strictObject({type: z.literal('delay'), timeMs: z.number().min(1).max(2000), wet: z.number().min(0).max(0.5)}),
  z.strictObject({type:z.literal('compressor'),thresholdDb:range(effectParameters.compressor.thresholdDb),ratio:range(effectParameters.compressor.ratio),attackMs:range(effectParameters.compressor.attackMs),releaseMs:range(effectParameters.compressor.releaseMs),makeupGainDb:range(effectParameters.compressor.makeupGainDb).optional()}),
  z.strictObject({type:z.literal('reverb'),roomSize:range(effectParameters.reverb.roomSize),decaySeconds:range(effectParameters.reverb.decaySeconds),wet:range(effectParameters.reverb.wet)}),
  z.strictObject({type:z.literal('saturation'),driveDb:range(effectParameters.saturation.driveDb),mix:range(effectParameters.saturation.mix)}),
]);
const effects = z.array(effect).max(8);
const gainDb = z.number().min(-60).max(12);
const mix = z.strictObject({gainDb: gainDb.optional(), pan: z.number().min(-1).max(1).optional()});
const seconds=z.number().min(0).max(600).describe('Decimal seconds with at most six places; engine rejects excess precision.');
const time=z.union([z.strictObject({musical:z.string().describe('Canonical project-absolute BAR:BEAT(+N/D).')}),z.strictObject({seconds})]);
const point=(value:z.ZodNumber)=>z.strictObject({at:time,value,transition:z.enum(['step','linear']).optional().describe('Outgoing segment toward the next point; default step.')});
const automation=z.strictObject({gainDb:z.array(point(gainDb)).min(1).max(1024).optional(),pan:z.array(point(z.number().min(-1).max(1))).min(1).max(1024).optional()});
const render=z.strictObject({duration:z.union([z.strictObject({bars}),z.strictObject({musical:z.string().describe('Whole-note fraction N/D.')}),z.strictObject({seconds})]).optional().describe('Exact final file length, including permitted tails.'),tail:z.union([z.enum(['auto','none']),z.strictObject({seconds:seconds.gt(0)})]).optional().describe('Tail allowance after authored project end; auto by default. Final duration always caps/pads.')});
const ducking=z.strictObject({source:z.string().describe('Project-relative assets/ reference WAV, never mixed into music.'),amountDb:z.number().min(0).max(36),thresholdDb:z.number().min(-60).max(0),attackMs:z.number().min(1).max(2000),releaseMs:z.number().min(10).max(9000)});
const master = z.strictObject({gainDb: gainDb.optional(), effects: effects.optional(),ducking:ducking.optional()});
export const instrument = z.discriminatedUnion('type', [
  z.strictObject({type: z.literal('gm'), program: z.string().describe('Exact GM name from instruments_list.')}),
  z.strictObject({type: z.literal('sampler'), sample: z.string().describe('Project-relative assets/ WAV path.')}),
  z.strictObject({type: z.literal('drumkit'), kit: z.string().describe('Project-relative assets/ kit JSON path.')}),
]);
const note = z.strictObject({
  start: z.string().describe('Pattern-relative BAR:BEAT or BAR:BEAT+N/D; 1-based.'),
  pitch: z.union([pitch, z.array(pitch).min(1).max(128)]).optional().describe('Required for GM/drumkit; omitted for sampler. Chords only for GM.'),
  duration: z.string().optional().describe('Whole-note fraction, e.g. 1/4. Required only for GM; omitted for samples.'),
  velocity: z.number().gt(0).max(1).optional(),
});
const notes = z.array(note).max(10000);
const pattern = z.strictObject({id, description: description.optional(), bars, notes});
const clips = z.array(z.strictObject({bar: z.number().int().min(1), pattern: id})).max(10000);
const track = z.strictObject({id, description: description.optional(), instrument,
  patterns: z.array(pattern).max(1000).default([]), clips: clips.default([]), mix: mix.optional(), effects: effects.optional(),automation:automation.optional()});
const metadata = {
  title: z.string().min(1).max(200), bpm: z.number().min(20).max(300), timeSignature: z.string(),
  key: z.string(), bars, seed: z.number().int().min(0).max(4294967295), description,
};
export const editSchema = z.discriminatedUnion('op', [
  z.strictObject({op: z.literal('project_update'), fields: z.strictObject({
    title: metadata.title.optional(), bpm: metadata.bpm.optional(), timeSignature: metadata.timeSignature.optional(),
    key: metadata.key.nullable().optional(), bars: bars.optional(), seed: metadata.seed.optional(),
    description: description.nullable().optional(), master: master.nullable().optional(),render:render.nullable().optional(),
  })}),
  z.strictObject({op: z.literal('track_add'), track}),
  z.strictObject({op: z.literal('track_remove'), trackId: id}),
  z.strictObject({op: z.literal('track_update'), trackId: id, fields: z.strictObject({
    instrument: instrument.optional(), description: description.nullable().optional(),
    mix: mix.nullable().optional(), effects: effects.nullable().optional(),automation:automation.nullable().optional(),
  })}),
  z.strictObject({op: z.literal('pattern_put'), trackId: id, pattern}),
  z.strictObject({op: z.literal('pattern_remove'), trackId: id, patternId: id}),
  z.strictObject({op: z.literal('notes_append'), trackId: id, patternId: id, notes}),
  z.strictObject({op: z.literal('clips_set'), trackId: id, clips}),
]);
export type Edit = z.infer<typeof editSchema>;
export type TrackDocument = z.infer<typeof track>;
export type ProjectDocument = {formatVersion: number; title: string; bpm: number; timeSignature: string; bars: number;
  seed?: number; key?: string; description?: string; master?: z.infer<typeof master>;render?:z.infer<typeof render>; tracks: TrackDocument[]};
const project = z.string().max(512).describe('Workspace-relative project JSON path. No traversal or symlinks.');
const sha256 = z.string().regex(/^[a-f0-9]{64}$/).describe('Revision returned by project_read/create/patch. Required to prevent stale edits.');
export const schemas = {
  daemonv12_project_create: z.strictObject({project, title: metadata.title, bpm: metadata.bpm.default(120),
    timeSignature: metadata.timeSignature.default('4/4'), key: metadata.key.optional(), bars: bars.default(4), seed: metadata.seed.default(0),render:render.optional(),master:master.optional()}),
  daemonv12_project_read: z.strictObject({project, trackId: id.optional(), patternId: id.optional(),
    patternOffset: z.number().int().min(0).default(0), patternLimit: z.number().int().min(1).max(20).default(20),
    noteOffset: z.number().int().min(0).default(0), noteLimit: z.number().int().min(0).max(128).default(32),
    clipOffset: z.number().int().min(0).default(0)}),
  daemonv12_project_validate: z.strictObject({project}),
  daemonv12_project_patch: z.strictObject({project, expectedSha256: sha256, edits: z.array(editSchema).min(1).max(100)}),
  daemonv12_instruments_list: z.strictObject({project: project.optional(), query: z.string().max(100).default(''),
    offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(128).default(128)}),
  daemonv12_drumkits_list: z.strictObject({project, offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(50).default(20)}),
  daemonv12_render: z.strictObject({project, stems: z.boolean().default(false), format: z.enum(['wav', 'mp3', 'wav,mp3']).optional()
    .describe('Omit for a plain WAV render. Any explicit format also writes loudness analysis and requires FFmpeg.')}),
  daemonv12_analyze: z.strictObject({audio: z.string().max(512).describe('Workspace-relative WAV path returned by render.')}),
  daemonv12_render_info: z.strictObject({manifest: z.string().max(512).describe('Workspace-relative manifest path returned by render.'),
    detail: z.enum(['summary', 'full']).default('summary')}),
};
export type ToolName = keyof typeof schemas;
