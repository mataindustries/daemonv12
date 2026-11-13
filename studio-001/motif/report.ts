/**
 * Symbolic motif report and motif event map (v0.9). Pure and deterministic: computed from the lowered score and its
 * phrases, never from audio. The report says how a piece was built (statements, variations, repetition); it does
 * not say whether the piece is good. Contract: docs/V0_9_MOTIF_DEVELOPMENT.md.
 */
import { normalizeScore } from '../rack/score.ts';
import { RATE, beatFrame, beatSecondsOf, swung } from '../rack/curves.ts';
import type { PartInput, ScoreInput } from '../rack/types.ts';
import { lowerScore, NON_DEVELOPING, SCALES } from './motif.ts';
import { EVENTS_SCHEMA, REPORT_SCHEMA, type LoweredScore } from './types.ts';

const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const mod = (a: number, n: number) => ((a % n) + n) % n;

export interface MotifReport {
  schema: 'daemonv12.motif-report/1';
  title: string; key: string;
  /** share of note onsets in non-context parts that come from phrases (repeats and textures count as not from phrases) */
  coverage: number; phraseNotes: number; partNotes: number;
  /** per literal (root) motif: how often it is stated unchanged and varied, and by which parts */
  statements: Record<string, { literal: number; varied: number; parts: string[] }>;
  /** distinct transform ops used by placed statements; `developingKinds` leaves out octave, gesture and dynamics */
  transformKinds: string[]; developingKinds: string[];
  /** root motifs stated by two or more parts */
  crossPart: string[];
  /** fraction of varied statements that keep the root motif's contour or its rhythm (1 when nothing is varied) */
  recognizability: number; variedStatements: number; unrecognizable: string[];
  /** per part: the longest run of consecutive identical one-bar windows (pitches, onsets, durations); empty bars break a run */
  maxLiteralRun: Record<string, number>;
  /** last note of the lead part: the highest part (mean pitch) among those stating a hook or answer motif */
  cadence: { part: string; pitch: number; step: number | null } | null;
  droppedParams: number;
}

/** The symbolic report of a `score/2` score. */
export function motifReport(input: unknown, lowered: LoweredScore = lowerScore(input)): MotifReport {
  // repeats and textures expand in normalizeScore; humanisation is removed so identical bars compare equal
  const plain: ScoreInput = { ...lowered.score, parts: lowered.score.parts.map(({ humanize: _humanize, ...part }: PartInput) => part) };
  const n = normalizeScore(plain), pitched = n.parts.filter(pt => !pt.context && pt.instrument.family !== 'context');
  const partNotes = pitched.reduce((s, pt) => s + pt.perf.notes.length, 0), ids = new Set(pitched.map(pt => pt.id));
  const phraseNotes = lowered.phrases.filter(ph => ids.has(ph.part)).reduce((s, ph) => s + ph.notes.length, 0);
  const statements: MotifReport['statements'] = {}, kinds = new Set<string>(), unrecognizable: string[] = []; let varied = 0;
  for (const ph of lowered.phrases) {
    const st = (statements[ph.root] ??= { literal: 0, varied: 0, parts: [] });
    if (ph.literal) st.literal++; else { st.varied++; varied++; if (!ph.keepsContour && !ph.keepsRhythm) unrecognizable.push(ph.id); }
    if (!st.parts.includes(ph.part)) st.parts.push(ph.part);
    for (const c of ph.chain) kinds.add(c.split(':')[0]!);
  }
  const maxLiteralRun: Record<string, number> = {};
  for (const pt of n.parts) {
    const bars = Array.from({ length: n.bars }, (_, k) => pt.perf.notes.filter(x => x.beat >= 4 * k && x.beat < 4 * k + 4).map(x => `${r6(x.beat - 4 * k)}/${r6(x.beats)}/${x.pitch}`).sort().join(' '));
    let best = 0, run = 0;
    bars.forEach((b, k) => { run = b === '' ? 0 : k > 0 && b === bars[k - 1] ? run + 1 : 1; best = Math.max(best, run); });
    maxLiteralRun[pt.id] = best;
  }
  const melodic = new Set(lowered.phrases.filter(ph => ph.role === 'hook' || ph.role === 'answer').map(ph => ph.part));
  const mean = (pt: (typeof pitched)[number]) => pt.perf.notes.reduce((s, x) => s + x.pitch, 0) / pt.perf.notes.length;
  const lead = pitched.filter(pt => pt.perf.notes.length && (melodic.size === 0 || melodic.has(pt.id))).sort((a, b) => mean(b) - mean(a))[0];
  let cadence: MotifReport['cadence'] = null;
  if (lead) {
    const last = [...lead.perf.notes].sort((a, b) => a.beat - b.beat || a.pitch - b.pitch).at(-1)!, step = SCALES[n.key.mode].indexOf(mod(Math.round(last.pitch) - n.key.tonic, 12));
    cadence = { part: lead.id, pitch: last.pitch, step: step < 0 ? null : step };
  }
  return {
    schema: REPORT_SCHEMA, title: n.title, key: n.key.label,
    coverage: partNotes ? r6(phraseNotes / partNotes) : 0, phraseNotes, partNotes, statements,
    transformKinds: [...kinds].sort(), developingKinds: [...kinds].filter(k => !NON_DEVELOPING.has(k)).sort(),
    crossPart: Object.entries(statements).filter(([, st]) => st.parts.length >= 2).map(([id]) => id),
    recognizability: varied ? r6((varied - unrecognizable.length) / varied) : 1, variedStatements: varied, unrecognizable,
    maxLiteralRun, cadence, droppedParams: lowered.droppedParams,
  };
}

/** The HOOK//10 structure gate (spec section 7). It shows a piece was built like composed music, not that it is good. */
export function hook10Gate(r: MotifReport) {
  const checks = {
    'coverage >= 0.6': r.coverage >= 0.6,
    'at least 3 pitch- or rhythm-changing transform kinds': r.developingKinds.length >= 3,
    'recognizability = 1.0': r.recognizability === 1,
    'maxLiteralRun <= 2 in every part': Object.values(r.maxLiteralRun).every(x => x <= 2),
    'crossPart >= 1': r.crossPart.length >= 1,
    'cadence on a tonic-triad step (0, 2 or 4)': r.cadence !== null && r.cadence.step !== null && [0, 2, 4].includes(r.cadence.step),
  };
  return { pass: Object.values(checks).every(Boolean), checks };
}

export interface MotifEvent {
  id: string; kind: 'phrase' | 'note'; beat: number; frame: number;
  part: string; motif?: string; root?: string; role?: string | null; chain?: string[]; literal?: boolean; lengthBeats?: number; endFrame?: number;
  phrase?: string; pitch?: number; velocity?: number; beats?: number;
}
export interface MotifEvents { schema: 'daemonv12.motif-events/1'; title: string; sampleRate: number; bpm: number; swing: number; endBeat: number; endFrame: number; events: MotifEvent[] }
/**
 * Onset frame of a notated beat at 44.1 kHz: swing, then `round(beat * beatSeconds * 44100)`, the expression the rack's
 * one-shot instruments place a note with (beatSeconds is the engine's integer-microsecond tempo). On the engine's
 * 960-PPQ grid this is the engine's own tick frame.
 */
export const onsetFrame = (beat: number, bpm: number, swing: number) => Math.round(swung(beat, swing) * beatSecondsOf(bpm) * RATE);

/**
 * The motif event map: one `phrase` event per statement and one `note` event per lowered note, each with the sample
 * frame of its onset at 44.1 kHz. `beat` is the notated beat (before swing); a phrase's beat and frame are those of
 * its first note. Frames are the notated onsets: a part's `humanize.timingMs` moves the audio, not these frames.
 */
export function motifEvents(input: unknown, lowered: LoweredScore = lowerScore(input), opts: { bpm?: number } = {}): MotifEvents {
  const s = lowered.score, bpm = opts.bpm ?? s.bpm, swing = s.swing ?? 0.5, frame = (beat: number) => onsetFrame(beat, bpm, swing), events: MotifEvent[] = [];
  const endBeat = 4 * s.sections.reduce((sum, sec) => sum + sec.bars, 0);
  for (const ph of lowered.phrases) {
    events.push({ id: ph.id, kind: 'phrase', part: ph.part, motif: ph.motif, root: ph.root, role: ph.role, chain: ph.chain, literal: ph.literal, beat: ph.beat, frame: frame(ph.beat),
      lengthBeats: ph.lengthBeats, endFrame: onsetFrame(ph.at + ph.lengthBeats, bpm, 0.5) });
    ph.notes.forEach((nt, k) => events.push({ id: `${ph.id}.n${k}`, kind: 'note', part: ph.part, phrase: ph.id, beat: nt.beat, frame: frame(nt.beat), beats: nt.beats, pitch: nt.pitch, velocity: nt.velocity }));
  }
  return { schema: EVENTS_SCHEMA, title: s.title, sampleRate: RATE, bpm, swing, endBeat, endFrame: beatFrame(endBeat, bpm), events };
}
