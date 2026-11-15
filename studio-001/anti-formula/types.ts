/**
 * DaemonV12 Anti-Formula, Gate 1: musical memory, expectation and payoff. Public types and schema ids only.
 *
 * The layer sits ABOVE the v0.9 motif layer and never replaces it:
 *   composer intent (plan) -> Anti-Formula (memory + expectation ledger) -> score/2 -> studio-001/motif lowerScore
 *   -> score/1 -> the unchanged rack.
 * It reads a score/2, edits at most one placed phrase (and may place one more) using existing v0.9 transforms, and
 * writes an ordinary score/2 plus a ledger. It draws no random numbers and contains no quality score.
 * Notes: docs/ANTI_FORMULA_GATE1.md.
 */
import type { PhraseInput, Transform } from '../motif/types.ts';

export const AF_INTERFACE_VERSION = '1.0.0-gate1';
export const AF_PLAN_SCHEMA = 'daemonv12.anti-formula.plan/1';
export const AF_LEDGER_SCHEMA = 'daemonv12.anti-formula.ledger/1';
export const AF_MEMORY_SCHEMA = 'daemonv12.anti-formula.memory/1';
export const AF_DISCLAIMER = 'This file records what was changed and why the composer chose it. It is not a quality measure: nothing here says the music got better. Only listening decides that, and the listener may reject every version.';

/**
 * What happens at the target statement.
 * - `withhold`: the statement keeps its head and its tail is left out (v0.9 `fragment`); the payoff is a later phrase that already exists.
 * - `defer`: the same, and the tail itself returns later as a newly placed phrase (v0.9 `fragment`, plus any transforms the composer adds).
 * - `reframe`: the statement stays whole but lands on another scale step (v0.9 `endOn`); the original landing is owed.
 */
export type InterventionKind = 'withhold' | 'defer' | 'reframe';
/** latent: not yet learnable. established: stated often enough to be expected. open: deliberately not met. */
export type ExpectationState = 'latent' | 'established' | 'open' | 'resolved' | 'unresolved';
/**
 * How a placed phrase relates to its literal motif.
 * complete: every note, same contour, same onset pattern (any transposition, octave or uniform speed).
 * partial: fewer notes, and the motif layer still recognises its contour or rhythm. developed: anything else.
 */
export type StatementForm = 'complete' | 'partial' | 'developed';

export type PayoffPlan =
  /** an existing phrase that is left exactly as written; it must sound the owed landing note or restate the owed tail */
  | { phrase: string; delivers: 'landing' | 'tail'; intent: string }
  /** the owed tail, placed later (required for `defer`); `transforms` run after the cut */
  | { place: { id?: string; part?: string; at: PhraseInput['at']; transforms?: Transform[]; velocity?: number; fit?: 'error' | 'octave' }; intent: string }
  /** a debt left open on purpose: allowed, but it has to be said */
  | { unresolved: true; reason: string };

/** The composer's declaration. Every sentence in it is the composer's; the layer checks the facts around it. */
export interface AntiFormulaPlan {
  schema: typeof AF_PLAN_SCHEMA;
  identity: {
    /** a literal motif of the score (one written with `notes`) */
    motif: string;
    /** how many opening notes carry the identity: the head. The rest is the tail. */
    headNotes: number;
    /** in the composer's words: what must stay recognisable */
    essence: string;
    /** phrases and parts that must come out note-identical. The first statement of the motif is always protected. */
    protect?: { phrases?: string[]; parts?: string[] };
  };
  expectation: {
    /** the part whose statements teach the expectation and in which it is broken */
    part: string;
    /** complete statements needed before the expectation counts as established; 2 or more (default 2) */
    minStatements?: number;
    /** in the composer's words: what the listener is led to expect */
    statement: string;
  };
  intervention: {
    kind: InterventionKind;
    /** phrase id of the statement that is changed */
    target: string;
    /** `reframe` only: the scale step the statement lands on instead */
    landOn?: { step: number; alt?: -1 | 0 | 1 };
    /** the payoff must arrive at most this many beats after the owed material was expected */
    resolveWithinBeats: number;
    /** in the composer's words: what this should do to the listener, and why this and not something else */
    intent: string; reason: string;
  };
  payoff: PayoffPlan;
  /** text of the written score only; no effect on sound */
  output?: { title?: string; description?: string; developments?: Record<string, string> };
}

export interface NoteFact { beat: number; beats: number; pitch: number; name: string; velocity: number }
export interface Statement {
  id: string; part: string; motif: string; root: string;
  /** 0-based position among the statements of this literal motif, in listening order */
  index: number;
  bar: number; beatInBar: number; beat: number; endBeat: number;
  chain: string[]; form: StatementForm; notes: number;
}
export interface TimelineEvent {
  beat: number; state: ExpectationState; statement?: string;
  /** stated | established | confirmed | departed | withheld | deferred | reframed | resolved | left-open */
  event: string;
}
export interface ExpectationTrack { motif: string; part: string; minStatements: number; state: ExpectationState; establishedBy: string[]; establishedAtBeat: number | null; timeline: TimelineEvent[] }
/** What the layer remembers about a score/2: every statement of every literal motif, and which completions a part has taught. */
export interface Memory {
  schema: typeof AF_MEMORY_SCHEMA; title: string; disclaimer: string;
  statements: Record<string, Statement[]>;
  expectations: ExpectationTrack[];
}

export interface Ledger {
  schema: typeof AF_LEDGER_SCHEMA; interfaceVersion: string; motifInterfaceVersion: string; disclaimer: string;
  source: { title: string; sha256: string }; plan: { sha256: string }; output: { title: string; sha256: string };
  /** what musical identity is protected */
  identity: { motif: string; essence: string; head: NoteFact[]; tail: NoteFact[]; protected: { firstStatement: string; phrases: string[]; parts: string[] } };
  /** every statement of the motif in the written output, in listening order */
  memory: (Statement & { status: 'unchanged' | 'intervention' | 'placed' })[];
  /** what expectation was established */
  expectation: { kind: 'completion'; part: string; statement: string; minStatements: number; establishedBy: string[]; establishedAtBeat: number; owed: { notes: NoteFact[]; landing: NoteFact; expectedAtBeat: number } };
  /** what the composer intended, which transformation was selected, and why */
  intervention: {
    kind: InterventionKind; target: string; bar: number; beatInBar: number; intent: string; reason: string;
    transform: string; mechanism: string;
    keptNotes: NoteFact[]; removedNotes: NoteFact[]; alteredNotes: { from: NoteFact; to: NoteFact }[];
    /** the stretch of the target part where the owed material would have been, and who else states the motif there */
    gap: { fromBeat: number; toBeat: number; restInPart: boolean; alsoStatedBy: string[] };
  };
  /** where the payoff occurs */
  payoff:
    | { state: 'resolved'; by: 'existing-phrase' | 'placed-phrase'; changedByAntiFormula: boolean; phrase: string; part: string; delivers: 'landing' | 'tail'; intent: string;
        beat: number; bar: number; beatInBar: number; seconds: number; frame: number; note: NoteFact; sameOctave: boolean; transform: string | null; waitedBeats: number; withinBeats: number }
    | { state: 'unresolved'; reason: string; withinBeats: number };
  timeline: TimelineEvent[];
  /** what was deliberately left unchanged, checked note by note against the source */
  unchanged: { phrases: string[]; parts: string[]; curvesAndSetup: 'identical in every part'; notes: { source: number; output: number; removed: number; added: number; altered: number } };
  determinism: string;
}
