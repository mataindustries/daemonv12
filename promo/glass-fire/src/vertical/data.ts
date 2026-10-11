// Music data for the vertical cut, in OUTPUT time (0…15 s).
//
// Two inputs, both in song time:
//   - PromoData (public/sync/promo-data.json or the fixture): envelopes, spectrum, onsets,
//     markers, automation, exactly as the landscape film reads them;
//   - VerticalExtras (public/sync/vertical-extras.json, from scripts/vertical-prepare.ts):
//     the render manifest's exact sample triggers with their GLASSHOUSE identities, the
//     project's real gain/pan automation, the master gate's silences, the GM programs and
//     the render's loudness report.
// Everything is remapped through the edit (edit.ts), so a lane, a cue or a camera move
// reads the music at the time it is actually heard in the 15-second cut.
import {z} from 'zod';
import {automationSchema, SAMPLE_IDS, STEM_IDS, type AutomationLane, type Envelope, type Marker, type Onset, type PromoData, type SampleId, type Spectrum, type StemId} from '../data/contract.ts';
import {automationAt, envAt, spectrumAt} from '../data/signals.ts';
import {SPANS, songSecondsAt, V_DURATION_SECONDS} from './edit.ts';
import {V_SECTIONS} from './sections.ts';

export const EXTRAS_SCHEMA_ID = 'glass-fire.vertical-extras/1';

const songTime = z.number().min(0).max(24);
const sha = z.string().regex(/^[0-9a-f]{64}$/);

export const triggerSchema = z.strictObject({
  t: songTime,
  /** DaemonV12 track id from the render manifest. */
  track: z.string().min(1).max(40),
  sample: z.enum(SAMPLE_IDS),
  /** The visual role the sound belongs to (from its GLASSHOUSE identity). */
  role: z.enum(STEM_IDS),
  velocity: z.number().min(0).max(1),
  /** Asset length in seconds. */
  duration: z.number().positive().max(24),
});
export type Trigger = z.infer<typeof triggerSchema>;

export const extrasSchema = z.strictObject({
  schema: z.literal(EXTRAS_SCHEMA_ID),
  source: z.strictObject({
    master: sha,
    manifest: sha,
    project: sha.optional(),
    gate: sha.optional(),
  }),
  triggers: z.array(triggerSchema),
  /** Real track automation, linearized (steps are duplicate points), in song time. */
  automation: z.array(automationSchema),
  /** Silences: the master gate's regions (or, without the gate file, detected from the master). */
  gates: z.array(z.strictObject({t: songTime, duration: z.number().positive().max(24)})),
  gm: z.array(z.strictObject({track: z.string(), program: z.number().int().min(0).max(127), name: z.string()})),
  render: z
    .strictObject({
      durationSeconds: z.number(),
      integratedLufs: z.number(),
      truePeakDbfs: z.number(),
      loudnessRangeLu: z.number(),
      clippedSamples: z.number().int(),
      tracks: z.number().int(),
      sampleRate: z.number().int(),
    })
    .nullable(),
});
export type VerticalExtras = z.infer<typeof extrasSchema>;

export type Gate = {t: number; duration: number};

export type VData = {
  /** Song data remapped to output time. Its `timing` still describes the source song. */
  promo: PromoData;
  /** Exact sample triggers in output time (empty without extras). */
  triggers: Trigger[];
  gates: Gate[];
  gm: VerticalExtras['gm'];
  render: VerticalExtras['render'];
  /** True when onsets come from the render manifest rather than detection or the fixture. */
  exact: boolean;
  /** Whole-song totals for labels (0 without extras). */
  song: {triggers: number; automationLanes: number};
};

const round = (v: number, digits = 6) => Math.round(v * 10 ** digits) / 10 ** digits;
const inSpan = (t: number, s: (typeof SPANS)[number]) => t >= s.songStart - 1e-9 && t < s.songEnd - 1e-9;

const remapEnvelope = (env: Envelope): Envelope => {
  const count = Math.floor(env.rate * V_DURATION_SECONDS) + 1;
  return {rate: env.rate, values: Array.from({length: count}, (_, i) => round(envAt(env, songSecondsAt(i / env.rate)), 5))};
};

const remapSpectrum = (spectrum: Spectrum): Spectrum => {
  const count = Math.floor(spectrum.rate * V_DURATION_SECONDS) + 1;
  return {
    rate: spectrum.rate,
    bandEdgesHz: spectrum.bandEdgesHz,
    values: Array.from({length: count}, (_, i) => spectrumAt(spectrum, songSecondsAt(i / spectrum.rate)).map(v => round(v, 4))),
  };
};

/** Events inside the edit, moved to output time; lengths stop at the cut that ends them. */
const remapEvents = <T extends {t: number; duration?: number}>(events: readonly T[]): T[] => {
  const out: T[] = [];
  for (const span of SPANS) {
    for (const e of events) {
      if (!inSpan(e.t, span)) continue;
      const moved = {...e, t: round(span.outStart + (e.t - span.songStart))};
      if (e.duration !== undefined) moved.duration = round(Math.min(e.duration, span.songEnd - e.t));
      out.push(moved);
    }
  }
  return out.sort((a, b) => a.t - b.t);
};

/** A lane cut and re-joined at the edit: its shape inside every span is exact, with a step at each cut. */
const remapLane = (lane: AutomationLane): AutomationLane => {
  const points: {t: number; v: number}[] = [];
  for (const span of SPANS) {
    const shift = (t: number) => round(span.outStart + (t - span.songStart));
    points.push({t: shift(span.songStart), v: automationAt(lane, span.songStart)});
    for (const p of lane.points) if (p.t > span.songStart + 1e-9 && p.t < span.songEnd - 1e-9) points.push({t: shift(p.t), v: p.v});
    points.push({t: shift(span.songEnd - 1e-6), v: automationAt(lane, span.songEnd - 1e-6)});
  }
  return {...lane, points};
};

const remapGates = (gates: readonly Gate[]): Gate[] => {
  const out: Gate[] = [];
  for (const span of SPANS) {
    for (const g of gates) {
      const from = Math.max(g.t, span.songStart);
      const to = Math.min(g.t + g.duration, span.songEnd);
      if (to - from > 1e-6) out.push({t: round(span.outStart + from - span.songStart), duration: round(to - from)});
    }
  }
  return out.sort((a, b) => a.t - b.t);
};

/** Onsets per role from the manifest triggers: exact times, GLASSHOUSE identity, true lengths. */
const onsetsFromTriggers = (triggers: readonly Trigger[], role: StemId): Onset[] => {
  const mine = triggers.filter(tr => tr.role === role);
  const strongest = Math.max(1e-9, ...mine.map(tr => tr.velocity));
  return mine.map(tr => ({t: tr.t, strength: round(tr.velocity / strongest, 3), sample: tr.sample as SampleId, duration: tr.duration}));
};

/** Silences long enough to read as a stop (the slicing in Drop 2 is shorter). */
export const STOP_MIN_SECONDS = 0.06;

export const buildVData = (song: PromoData, extras: VerticalExtras | null): VData => {
  const exact = extras !== null && extras.triggers.length > 0;
  const stems = {} as PromoData['stems'];
  for (const id of STEM_IDS) {
    const onsets = exact ? onsetsFromTriggers(extras.triggers, id) : song.stems[id].onsets;
    stems[id] = {envelope: remapEnvelope(song.stems[id].envelope), onsets: remapEvents(onsets)};
  }
  const gates = extras ? remapGates(extras.gates) : remapGates(song.markers.filter(m => m.kind === 'stop').map(m => ({t: m.t, duration: m.duration ?? 0})).filter(g => g.duration > 0));
  const stopMarkers: Marker[] = gates.filter(g => g.duration >= STOP_MIN_SECONDS).map((g, i) => ({t: g.t, kind: 'stop', id: `stop.${i + 1}`, label: 'STOP', duration: g.duration}));
  const sectionMarkers: Marker[] = V_SECTIONS.map(s => ({t: round(s.from / 60), kind: s.id.startsWith('drop') ? 'drop' : 'section', id: s.id, label: s.title}));
  const lanes = extras && extras.automation.length > 0 ? extras.automation : song.automation;
  const promo: PromoData = {
    ...song,
    source: {...song.source, note: `vertical edit: ${SPANS.map(s => `bars ${s.firstBar}–${s.lastBar}`).join(' + ')}`},
    master: {envelope: remapEnvelope(song.master.envelope)},
    stems,
    spectrum: remapSpectrum(song.spectrum),
    automation: lanes.map(remapLane),
    markers: [...sectionMarkers, ...stopMarkers].sort((a, b) => a.t - b.t || a.id.localeCompare(b.id)),
  };
  return {
    promo,
    triggers: extras ? remapEvents(extras.triggers) : [],
    gates,
    gm: extras?.gm ?? [],
    render: extras?.render ?? null,
    exact,
    song: {triggers: extras?.triggers.length ?? 0, automationLanes: extras?.automation.length ?? 0},
  };
};

/** Index of the last item at or before t (items sorted by t), or −1. */
export const lastIndexAt = (items: readonly {t: number}[], t: number): number => {
  let lo = 0;
  let hi = items.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (items[mid]!.t <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
};

/** Triggers in [t0, t1], optionally of one track or sample. */
export const triggersBetween = (triggers: readonly Trigger[], t0: number, t1: number, filter?: (tr: Trigger) => boolean): Trigger[] => {
  const out: Trigger[] = [];
  for (let i = Math.max(0, lastIndexAt(triggers, t0 - 1e-9) + 1); i < triggers.length; i++) {
    const tr = triggers[i]!;
    if (tr.t > t1) break;
    if (tr.t >= t0 - 1e-9 && (!filter || filter(tr))) out.push(tr);
  }
  return out;
};
