// The data contract between the music and the motion system.
//
// The composition never reads audio directly. It reads one PromoData document: the
// deterministic fixture today (fixture.ts), and later the document produced from the
// final master and stems by scripts/analyze-stems.ts (see SYNC_HANDOFF.md).
// All times are seconds from the first sample of the master.
import {z} from 'zod';
import {BARS, BEATS_PER_BAR, BPM, DURATION_SECONDS} from '../timeline/grid.ts';

export const SCHEMA_ID = 'glass-fire.promo-data/1';

export const STEM_IDS = ['kick', 'sub', 'glass', 'vox', 'clap', 'hat'] as const;
export type StemId = (typeof STEM_IDS)[number];

/** GLASSHOUSE sounds the visuals know how to draw (examples/glasshouse.catalog.json ids). */
export const SAMPLE_IDS = [
  'glass-hit',
  'glass-reverse',
  'glass-crush',
  'ghost-vox',
  'vox-chip',
  'bass-punch-cs',
  'sub-cs',
  'chrome-clap',
  'pixel-hat',
  'prism-impact',
] as const;
export type SampleId = (typeof SAMPLE_IDS)[number];

const unit = z.number().min(0).max(1);
const time = z.number().min(0).max(DURATION_SECONDS);

export const envelopeSchema = z.strictObject({
  /** Values per second. 60 (one per video frame) is recommended. */
  rate: z.number().positive().max(1000),
  /** 0…1, normalized to the track's own loudest moment. */
  values: z.array(unit).min(2),
});
export type Envelope = z.infer<typeof envelopeSchema>;

export const onsetSchema = z.strictObject({
  t: time,
  /** 0…1 relative to the strongest onset of the same stem. */
  strength: unit,
  /** Which GLASSHOUSE sound fired, when known (from the render manifest's sample triggers). */
  sample: z.enum(SAMPLE_IDS).optional(),
  /** Arrangement-level transformation, e.g. "chop" for gated slices of glass-hit. */
  variant: z.string().max(24).optional(),
  /** Sounding length in seconds, when known (notes, reverses). Draws as block length. */
  duration: z.number().positive().max(DURATION_SECONDS).optional(),
  /** MIDI pitch, when known. */
  pitch: z.number().int().min(0).max(127).optional(),
});
export type Onset = z.infer<typeof onsetSchema>;

export const stemSchema = z.strictObject({
  envelope: envelopeSchema,
  /** Sorted ascending by t. */
  onsets: z.array(onsetSchema),
});
export type StemTrack = z.infer<typeof stemSchema>;

export const spectrumSchema = z.strictObject({
  rate: z.number().positive().max(1000),
  /** Band edges in Hz, ascending; bands = edges − 1. */
  bandEdgesHz: z.array(z.number().positive()).min(3).max(33),
  /** values[frame][band], 0…1. */
  values: z.array(z.array(unit)).min(2),
});
export type Spectrum = z.infer<typeof spectrumSchema>;

export const automationSchema = z.strictObject({
  /** Stable id, e.g. "glass.lpf". */
  id: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)*$/),
  /** On-screen effect name, e.g. "LPF". Shown only while the lane is moving. */
  label: z.string().min(1).max(16),
  target: z.union([z.enum(STEM_IDS), z.literal('master')]),
  unit: z.enum(['Hz', 'dB', '%', 'pan']),
  /** Display range [min, max] in `unit`. Hz lanes are drawn on a log scale. */
  range: z.tuple([z.number(), z.number()]),
  /** Breakpoints, sorted by t, linearly interpolated (log-linear for Hz). */
  points: z.array(z.strictObject({t: time, v: z.number()})).min(1),
});
export type AutomationLane = z.infer<typeof automationSchema>;

export const MARKER_KINDS = ['section', 'drop', 'stop', 'hit', 'end'] as const;
export const markerSchema = z.strictObject({
  t: time,
  kind: z.enum(MARKER_KINDS),
  /** e.g. "hook", "drop1", "stop.pre-drop1". */
  id: z.string().min(1).max(40),
  label: z.string().max(40).optional(),
  /** Stops only: length of the silence in seconds. */
  duration: z.number().positive().max(DURATION_SECONDS).optional(),
});
export type Marker = z.infer<typeof markerSchema>;

export const promoDataSchema = z.strictObject({
  schema: z.literal(SCHEMA_ID),
  source: z.strictObject({
    kind: z.enum(['fixture', 'analysis']),
    generator: z.string(),
    master: z.string().optional(),
    masterSha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
    stems: z.record(z.string(), z.string()).optional(),
    sampleRate: z.number().int().positive().optional(),
    note: z.string().optional(),
  }),
  timing: z.strictObject({
    bpm: z.literal(BPM),
    beatsPerBar: z.literal(BEATS_PER_BAR),
    bars: z.literal(BARS),
    durationSeconds: z.literal(DURATION_SECONDS),
  }),
  master: z.strictObject({envelope: envelopeSchema}),
  stems: z.strictObject({
    kick: stemSchema,
    sub: stemSchema,
    glass: stemSchema,
    vox: stemSchema,
    clap: stemSchema,
    hat: stemSchema,
  }),
  spectrum: spectrumSchema,
  automation: z.array(automationSchema),
  markers: z.array(markerSchema),
});
export type PromoData = z.infer<typeof promoDataSchema>;

export class PromoDataError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Invalid GLASS//FIRE promo data:\n  - ${issues.join('\n  - ')}`);
    this.name = 'PromoDataError';
    this.issues = issues;
  }
}

const sorted = (values: number[]) => values.every((v, i) => i === 0 || v >= values[i - 1]!);

/** Parse and check an untrusted document. Throws PromoDataError listing every problem. */
export const parsePromoData = (input: unknown): PromoData => {
  const result = promoDataSchema.safeParse(input);
  if (!result.success) {
    throw new PromoDataError(result.error.issues.map(i => `${i.path.join('.') || '(root)'}: ${i.message}`));
  }
  const data = result.data;
  const issues: string[] = [];
  const coversPiece = (path: string, env: {rate: number; values: number[]}) => {
    const needed = Math.floor(env.rate * DURATION_SECONDS);
    if (env.values.length < needed) issues.push(`${path}: ${env.values.length} values cover less than ${DURATION_SECONDS} s at ${env.rate}/s (need ${needed})`);
  };
  coversPiece('master.envelope', data.master.envelope);
  for (const id of STEM_IDS) {
    const stem = data.stems[id];
    coversPiece(`stems.${id}.envelope`, stem.envelope);
    if (!sorted(stem.onsets.map(o => o.t))) issues.push(`stems.${id}.onsets: not sorted by t`);
  }
  const bands = data.spectrum.bandEdgesHz.length - 1;
  if (!sorted(data.spectrum.bandEdgesHz)) issues.push('spectrum.bandEdgesHz: not ascending');
  coversPiece('spectrum', {rate: data.spectrum.rate, values: data.spectrum.values.map(() => 0)});
  data.spectrum.values.forEach((row, i) => {
    if (row.length !== bands && issues.length < 20) issues.push(`spectrum.values[${i}]: ${row.length} bands, expected ${bands}`);
  });
  for (const lane of data.automation) {
    if (!sorted(lane.points.map(p => p.t))) issues.push(`automation ${lane.id}: points not sorted by t`);
    if (lane.unit === 'Hz' && (lane.range[0] <= 0 || lane.points.some(p => p.v <= 0))) issues.push(`automation ${lane.id}: Hz values must be positive`);
    if (lane.range[0] === lane.range[1]) issues.push(`automation ${lane.id}: empty range`);
  }
  if (!sorted(data.markers.map(m => m.t))) issues.push('markers: not sorted by t');
  for (const m of data.markers) {
    if (m.duration !== undefined && m.t + m.duration > DURATION_SECONDS + 1e-6) issues.push(`marker ${m.id}: extends past ${DURATION_SECONDS} s`);
  }
  if (issues.length) throw new PromoDataError(issues);
  return data;
};
