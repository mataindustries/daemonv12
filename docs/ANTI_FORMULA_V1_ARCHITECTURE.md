# Anti-Formula v1.0: architecture discovery

Status: **design only.** No code, scores, renders or production behaviour change
with this document. It is based on `main` at
`eee072d71a7581913faebff95c935cae8c9be41b` (the PR #45 merge, engine `0.7.0`).

**Current Fable handoff (2026-11-15):** Read [§11](#11-producer-feedback-and-fable-implementation-handoff-2026-11-15) before following §10. The v0.9 motif implementation in draft PR #49 already supplies the transform layer; §10's original main-based task is historical. The producer's listening criteria and current owner decisions are recorded in §11.

**Gate 1 implemented (2026-11-15, draft):** the first vertical slice of §11.3 exists in `studio-001/anti-formula/`, above the v0.9 motif layer. It supersedes the interfaces of §3 and §4 where they differ. Contract and reconciliation notes: [ANTI_FORMULA_GATE1.md](ANTI_FORMULA_GATE1.md). Listening proof (HOOK//10 A / B1 / C): [proofs/anti-formula-gate1](../proofs/anti-formula-gate1/README.md). No human has listened yet.

**Goal.** Find the smallest addition that helps DaemonV12 make music that is
surprising, memorable and emotionally compelling, rather than only technically
correct, while keeping every existing instrument, renderer, deterministic
control and export path unchanged.

**Thesis.** The repository already avoids naive loops in its guidance. It has
nothing that *represents or tracks how musical ideas relate over time*. Every
recurrence of an idea is either a verbatim copy or an unrelated rewrite.
Neither one builds expectation. Anti-Formula v1.0 adds a small, deterministic
**score-to-score transformer** with three parts:

- a memory of motif statements;
- an explicit expectation ledger of withholdings and payoffs;
- a bounded set of transformation operators.

It writes an ordinary rack score and an auditable ledger. It never replaces a
composer's decisions with randomness.

Evidence labels used throughout:

- **[Observed]**: verified in this repository by reading code or running a
  read-only script on committed JSON.
- **[Hypothesis]**: a claim about how the music sounds. It needs listening. The
  repository holds no listening results for any piece discussed here.

---

## 1. Verified repository findings

### 1.1 What exists

| Layer | Where | What it does (verified) |
|---|---|---|
| Engine core | `src/` | JSON project → validation → ticks → MIDI/PCM → WAV/MP3/stems with provenance. Tracks hold **patterns placed by clips**; notes use `BAR:BEAT+N/D` positions. The core **draws no random numbers**: `tests/architecture.test.ts` forbids `Math.random`/`Date` in `src/`. The project `seed` is only recorded in the manifest. V0_SPEC §1 lists "transpose or repeat sugar", swing and humanize as out of scope for the core. |
| MCP | `mcp/` | Nine stdio tools for typed, revision-checked project edits, rendering and analysis. This is how agents compose today. |
| Signature Rack | `studio-001/rack/` | A beat-based **performance score** (`daemonv12.signature-rack.score/1`) for three original instrument families (Living Bass, Impossible Voice, Mechanical Orchestra) plus context kick/snare. Continuous `macro`/`controls`/`offsets`/`expression` curves, articulations, per-note params and sections. Seeded generators (`repeats`, `textures`, `humanize`) expand deterministically in `normalizeScore`. The rack renders directly (`rack/cli.ts render`) or **bounces** to native engine projects at engine-exact frames. Authored `score.json` and expanded `performance.json` are saved with every render. |
| Authoring scripts | `studio-001/scores/crossing.compose.ts`, `production/headliner/build.ts` | Hand-written TypeScript that emits score JSON. Motif reuse is the helper `at(notes, shift)`: a **verbatim time shift**. |
| Production | `production/`, `docs/PRODUCTION24*.md` | Float64 processing, PCM24 delivery, sealed packages. Downstream of composition and out of scope here. |
| Composer skill | `plugins/daemonv12-composer/` | A detailed prose workflow for agent composers: thesis, 3–4 competing hooks, V1–V3 critique, Risk Pass, opening/impact/ending checks, and "no automatic quality score". |
| Listening protocol | `benchmarks/banger-lab-001/` | Loudness-matched blind copies with byte-reproducible FFmpeg commands (RULES §6), a hashed blind key, a weighted rubric, cold and replay passes, **24-hour recall**, and lock-then-reveal. It has not yet been run: there are no result files. |
| Structural audio evidence | `.../scripts/review-sections.mjs` | Per-section band energy and levels from a WAV. Labelled "evidence only". |

**`AGENTS.md` does not exist** in this repository. The working rules come from
`CONTRIBUTING.md`: determinism, a dependency-free `src/`, additive format
changes, and unchanged golden outputs.

**[Observed] Constraint that shapes the design.** `studio-001/rack/package.ts`
records SHA-256 hashes of the rack sources, including `rack/score.ts`, in every
bounced package's `catalog.json`. The committed CROSSING package manifest lists
them, so **editing anything under `studio-001/rack/` would invalidate approved
evidence**. Anti-Formula must import the rack and never modify it.

### 1.2 What is missing

1. **[Observed] No motif object.** Neither the engine format (patterns/clips)
   nor the rack format (notes/repeats) can say "this is the theme, and this is
   its third statement, varied by X". A recurrence's identity lives only in the
   author's head or a script variable.
2. **[Observed] No transformation vocabulary.** The only reuse primitives are
   verbatim: clips replay a pattern unchanged, rack `repeats` tile a cell
   unchanged, and `at()` shifts notes unchanged. Clips carry only
   `{ bar, pattern }`, with no transpose and no variant.
3. **[Observed] No expectation model.** Nothing records that a regularity has
   been established, that it was deliberately broken, or whether the break was
   ever paid off.
4. **[Observed] No harmony layer in the score.** CROSSING's progression exists
   only as a `CHORDS` array inside `crossing.compose.ts`. The saved JSON holds
   only notes, so harmony cannot be safely changed after authoring.
5. **[Observed] Rhythm and form are fixed.** The rack accepts only 4/4.
   Sections are whole bars. Every committed rack score uses 1-, 2- or 4-bar
   sections. The engine allows one meter per project.
6. **[Observed] Guidance without mechanism.** The Composer skill and V12
   playbook say the right things ("Hypnosis is repetition; memorability is
   mutation", "change one thing each time"). Nothing checks or records
   whether a piece did it.

### 1.3 Read-only measurements on committed scores

These numbers come from a throwaway script that ran `normalizeScore` with swing
and humanize removed. For each part, a bar's **rhythm signature** is the sorted
set of `onsetOffsetInBar.toFixed(3) + "/" + (articulation ?? "")` strings. The
script counts distinct signatures and the longest run of identical consecutive
non-empty signatures. Nothing was rendered. The numbers describe structure, not
quality.

**CROSSING** (`studio-001/scores/crossing.score.json`: 18 bars, 84 BPM,
sections 4/4/4/4/2, about 54 s):

| Part | Active bars | Distinct rhythm bars | Longest run of identical bars |
|---|---:|---:|---|
| kick | 13 | 3 | **11** (bars 5–15, about 31 s) |
| clock | 18 | 3 | **12** (bars 5–16) |
| spring | 17 | 3 | 8 (bars 5–12) |
| bars | 18 | 7 | 6 (bars 5–10) |
| bow | 9 | 2 | 5 |
| voice | 14 | 9 | 1 |
| bass | 13 | 8 | 3 |

- **[Observed]** The 8-beat theme is stated **four times, all with identical
  pitch and rhythm**: voice at bars 3, 5 and 11, and the mallet bars at bar 11.
  An automatic interval-and-onset match found exactly these four. The bass
  cell `BAR5` is reused verbatim at bars 5 and 11.
- **[Observed]** The harmony is `i–VI` alternation, then `iv–V7`, closing with
  `V7 → i` twice. This is a common minor-key progression.
- **[Observed]** CROSSING's development lives mostly in **timbre**: the three
  families' macros cross at bar 11. That concept is distinctive on paper. The
  note and rhythm layer under it is mostly restated, not developed.
- **[Observed]** README: "Unheard. Nobody has listened to CROSSING."

**Other scores.** The V12 Signature showcase (14 bars) has kick, ABYSS and
REACTOR with 2 distinct rhythm bars each, and CHROME, EVENT HORIZON and
AFTERGLOW with 1 each. GLASS//FIRE and Shoot the Moon go the other way: for
example, GLASS//FIRE's lead has 14 distinct rhythm bars out of 16, and
Shoot the Moon places 49 clips from 49 different patterns.

**[Observed] Conclusion: the failure is not "too much repetition" everywhere.**
Hand-composed and agent-composed pieces swing between **verbatim restatement**
and **variation with no recorded relationship**. Nothing in between holds the
identity of an idea while changing what it means.

### 1.4 The bottleneck: observed vs hypothesis

| Candidate cause | Repository evidence | Status |
|---|---|---|
| Predictable phrase structure | All committed rack sections are 1, 2 or 4 bars. The playbook prescribes "vary the fourth bar of every phrase" and "add or remove an element every two to four bars". | **[Observed]** structure. **[Hypothesis]** that listeners hear it as formulaic. Note that the anti-boredom advice is itself a fixed-position formula: if every agent follows it, outputs converge. |
| Repetitive rhythm | Kick 11 identical bars and clock 12 in CROSSING. Showcase pulse parts have 1–2 rhythm bars. | **[Observed]** structure. **[Hypothesis]** that it is a defect: steady pulse can be the point. Anti-Formula must not "fix" every steady layer. |
| Harmonic predictability | CROSSING `i–VI…iv–V7–i`. No harmony representation in saved scores. | **[Observed]** for CROSSING. Harmony beyond local retargeting is **out of reach for v1.0** (§7). |
| Weak tension and release | No construct for set-up, withholding or payoff. | **[Observed]** absence. **[Hypothesis]** about audibility. |
| Insufficient motif development | Theme ×4 verbatim. `BAR5` ×2 verbatim. No transformation primitives. | **[Observed]**. This is the clearest, most actionable gap. |
| Weak sonic identity | The rack families are original. Macros and curves exist and are used heavily in CROSSING. | Sound design is **not the bottleneck**. Timbre is under-used *as a response to motif events*. |
| Fixed templates | The core has no templates. Agents write long literal patterns (all 15 tracks of GLASS//FIRE are single 16-bar patterns placed once). | Templates come from **habit and guidance**, not code. **[Hypothesis]** |

**The bottleneck:** DaemonV12 has no **memory of its own musical ideas**. It
cannot make a later event *mean something because of an earlier one*.
Surprise without memory is noise. Memory without surprise is a loop.
Anti-Formula supplies both, relative to the piece itself.

---

## 2. Design principles

1. **Surprise is relative to the piece's own memory, never to a global
   template.** An operator may break only a regularity this piece has already
   established (at least two statements). It never touches a first statement.
2. **Identity is a constraint, not a score.** Each transformed statement must
   keep declared invariants (head rhythm, contour, head interval). A violation
   is a hard error, not a lower number.
3. **Every withholding opens a debt.** Unpaid debts are reported. In
   `strong` mode they are errors.
4. **Restraint is an operator.** Subtraction is as legitimate as mutation, and
   it comes before arrivals.
5. **Deterministic and auditable.** The output is a pure function of (input
   score, plan, intensity, seed). Every change is recorded in a ledger with a
   reason, so a listener's "best moment at 0:41" can be traced to a decision.
6. **Score in, score out.** The output is an ordinary
   `daemonv12.signature-rack.score/1`. Validation, the `transpose`/`bpm`
   overrides, the seeds, render, bounce, PCM24 and provenance all work
   unchanged.
7. **No aggregate quality number, ever.** The report is a set of separate
   descriptive axes plus flags. Listening decides.

---

## 3. Architecture

### 3.1 Placement

```
studio-001/anti-formula/        NEW: imports studio-001/rack, never edits it
  types.ts      plan, ledger, report types and schema ids
  plan.ts       plan validation (numbered, specific messages, like normalizeScore)
  view.ts       analysisView(): un-swung, un-humanized normalized notes per part
  motifs.ts     detectStatements(): exact and transposed motif matches
  report.ts     structuralReport(): descriptive axes plus flags, no total
  operators.ts  the operator table (task 2 onward)
  planner.ts    applyAntiFormula(): memory, intents, policy, ledger (task 2 onward)
  cli.ts        report | apply
  plans/        experiment plans (task 2 onward)
tests/anti-formula.test.ts      runs in npm test; the typecheck covers it through imports
```

Nothing goes into `src/`, `mcp/`, `studio-001/rack/` or the project format.
There are no new dependencies.

### 3.2 Data flow

```
score.json (rack schema v1, unchanged)      af-plan.json (motifs, arc intents, roles, protect, seed)
            │                                          │
            ▼                                          ▼
   normalizeScore(input) ── input must be valid ──► validatePlan
            │                                          │
            └──────────────► analysisView ◄────────────┘
                                   │
                         detectStatements (memory)
                                   │
              intensity = off ─────┼───── conservative | strong
                    │              ▼
           identical score    planner: per section in time order
                    │            1. pay debts that fall due
                    │            2. vary statements with index >= 1 (policy, invariants, last op)
                    │            3. section intents: restraint, withhold, rupture, recall
                    │              │
                    │       transformed score.json + ledger.json
                    │              │
                    └──────► normalizeScore(output) must pass; invariant and debt checks
                                   │
          ┌────────────────────────┼─────────────────────────────┐
          ▼                        ▼                             ▼
 rack/cli.ts render (unchanged)  rack/cli.ts bounce → engine    report.json (A, B and C alike)
```

### 3.3 Components

**Motif memory (`motifs.ts`).** The plan names each motif by a source span:
`{ id, part, fromBeat, toBeat }`. The detector scans every part for spans with
the same onset offsets and interval sequence, at any transposition, and returns
the **statements** in time order, numbered by occurrence. For CROSSING this
already finds the four theme statements (§1.3). The memory also holds every
statement the planner *creates* (variants, handoffs, recalls), so later
decisions can refer back to an earlier variant, not only to the original.

**Expectation ledger.** A *regularity* is a motif with at least two statements,
or a part whose bar rhythm has repeated at least twice in a row (for example
the kick in bars 5–15). Operators of kind `withhold` remove an expected event
and open a **debt** `{ kind, openedAtBeat, dueByBeat }`. A `deliver` operator
pays it: the withheld event returns transformed and emphasized (accent,
expression lift, register move or a role re-entering). The report lists every
debt and its status.

**Operators (`operators.ts`).** These are small, pure note-list transforms.
Each one declares its class, minimum intensity, which invariants it keeps, and
a `distance` from the source. Distance is the share of motif notes whose
onset or incoming interval changed, plus 0.25 per form-level change, capped at
1. It is a control signal for the planner, not an aesthetic measure.

| Operator | Class | Min. intensity | What it does | Keeps |
|---|---|---|---|---|
| `displace-tail` | rhythm | conservative | Shift the notes after the head by ±¼ or ±½ beat, keeping order and no overlap (mono families trim durations) | head rhythm, contour, head interval |
| `truncate` + debt | expectation | conservative | Drop the last note or notes of a statement. Opens a debt due by the next statement. | head |
| `deliver` | expectation | conservative | Pay a debt: the withheld note returns with accent, an expression bump and, if the policy allows, an octave or register change | everything else |
| `register` | motif | conservative | Move the statement by an octave, or a diatonic third or sixth, inside the instrument's range | rhythm, contour |
| `fragment` | motif | conservative | State only the head, then repeat or sequence it | head |
| `retarget-end` | harmony (local) | conservative | Change the final pitch to another pitch class sounding in other parts at that beat | rhythm, contour, head |
| `subtract` | restraint | conservative | Silence non-carrier roles (by plan `roles`) for a window | n/a |
| `regroup-332` | rhythm | strong | Re-accent and re-onset a repeating eighth pattern as 3+3+2 for one or more bars | pitches |
| `displace-whole` | rhythm | strong | Move a whole statement ½ or 1½ beats across the barline | everything except metric position |
| `withhold-downbeat` | expectation | strong | Remove an established downbeat (or one beat of silence for all non-protected parts). Opens a debt. | n/a |
| `invert` / `augment` | motif | strong | Contour inversion about the head, or a ×2 augmentation of the head | rhythm, or contour |
| `handoff` / `answer` | interplay | strong | Move the statement, or split it as head/tail call and response, to another part. Strips params the target part does not accept, checks range, octave-folds. | rhythm, contour |
| `timbre-gesture` | timbre | strong | Add a short excursion to the part's `macro`/`offsets` curve aligned to the statement head, then return | all note invariants |
| `elide` / `extend` | form | strong | Remove one bar or insert one bar at a section boundary (a 3- or 5-bar phrase). Shifts all later notes, curves, motion spans and breaths and updates `sections[].bars`. | n/a |
| `recall` | memory | strong | Late in the piece, restate an *earlier variant* from memory, usually as a handoff at low dynamic | that variant's invariants |

**Arc intents (in the plan).** For each section, the composer lists a small
set of intents: `establish`, `develop`, `withhold`, `restraint`, `payoff`,
`rupture`, `recall`, `release`. Intents are **what** the section should do to
the listener's expectations. The planner chooses **how**, within the policy.
`establish` and `release` forbid mutation. `rupture` requires `strong`.

**Policy: B and C differ only by data.**

| Setting | B `conservative` | C `strong` |
|---|---|---|
| Operators per statement | ≤ 1 | ≤ 2 |
| Operator classes | rhythm (tail), motif (register, fragment), local harmony, restraint, truncate/deliver | all |
| Target distance by statement index 1, 2, 3, … | 0.15, 0.25, 0.20, … | 0.30, 0.55, 0.35, … (an arch: develop, then return recognizably) |
| Invariants that must hold | all three | at least two of three |
| Share of notes changed per part | ≤ 15 % | ≤ 35 % |
| Form changes | none, so B stays bar-aligned with A | ≤ 1 bar elided or extended per piece |
| Debts | must be paid within one statement | must be paid within 2 sections, or the run fails |
| Same operator twice in a row on one motif | forbidden | forbidden |

**Structural report (`report.ts`).** The report is descriptive only. It runs
on A, B and C alike and has these separate axes:

- **form:** section bars and phrase-length distinctness;
- **repetition:** for each part, active bars, distinct rhythm bars and the
  longest identical run;
- **motifs:** for each statement, its bar, transposition, distance and which
  invariants held, plus the motif's verbatim share;
- **rhythm:** for each part, the share of off-beat onsets and a simple
  metrical-weight syncopation index;
- **contrast:** for each bar, active parts, onset count, register span and mean
  velocity, plus the range of each across the piece;
- **expectation:** debts opened, paid and unpaid;
- **flags:** short human-readable facts, for example
  `theme: 4 statements, all verbatim` or
  `kick: identical rhythm for 11 consecutive bars`.

A fixed `disclaimer` field states that the report is not a quality measure. The
report has **no total and no weighting.**

---

## 4. Interfaces and pseudocode

```ts
// studio-001/anti-formula/types.ts
export const AF_PLAN_SCHEMA = 'daemonv12.anti-formula.plan/1';
export const AF_LEDGER_SCHEMA = 'daemonv12.anti-formula.ledger/1';
export const AF_REPORT_SCHEMA = 'daemonv12.anti-formula.report/1';

export type Intensity = 'off' | 'conservative' | 'strong';
export type Intent = 'establish' | 'develop' | 'withhold' | 'restraint' | 'payoff' | 'rupture' | 'recall' | 'release';
export type Invariant = 'head-rhythm' | 'contour' | 'head-interval';
export type Role = 'carrier' | 'support' | 'pulse' | 'low' | 'color';

export interface MotifSource { id: string; part: string; fromBeat: number; toBeat: number; headNotes?: number /* default 3 */ }
export interface Span { part: string; fromBeat: number; toBeat: number }
export interface AntiFormulaPlan {
  schema: typeof AF_PLAN_SCHEMA;
  seed: number;                          // planner seed, independent of score.seed
  motifs: MotifSource[];
  arc: { section: string; intents: Intent[] }[];
  roles: Record<string, Role>;           // part id -> role (needed by subtract/handoff)
  protect?: Span[];                      // never altered (e.g. CROSSING's bar-11 unison, the coda)
}

export interface Statement { motif: string; part: string; beat: number; transpose: number; index: number; origin: 'detected' | 'created' }
export interface Debt { id: string; kind: 'truncated' | 'withheld-downbeat'; openedAtBeat: number; dueByBeat: number; paidAtBeat?: number }
export interface Decision {
  section: string; op: string; target: Statement | Span; params: Record<string, number | string>;
  distance: number; kept: Invariant[]; intent: Intent; reason: string;
}
export interface Ledger {
  schema: typeof AF_LEDGER_SCHEMA; intensity: Intensity; planSeed: number;
  inputScoreSha256: string; planSha256: string; outputScoreSha256: string; operatorsVersion: string;
  statements: Statement[]; decisions: Decision[]; debts: Debt[];
}

export interface Operator<P = Record<string, number | string>> {
  name: string; class: 'rhythm' | 'motif' | 'harmony' | 'restraint' | 'expectation' | 'interplay' | 'timbre' | 'form' | 'memory';
  minIntensity: Exclude<Intensity, 'off'>;
  keeps: Invariant[];
  candidates(ctx: PlanContext, target: Statement | Span): P[];          // deterministic list, may be empty
  distance(ctx: PlanContext, target: Statement | Span, params: P): number;
  apply(score: ScoreInput, ctx: PlanContext, target: Statement | Span, params: P): { score: ScoreInput; created?: Statement[]; debt?: Debt; pays?: string };
}

// public entry points
export function analysisView(score: ScoreInput): View;                                   // task 1
export function detectStatements(view: View, motifs: MotifSource[]): Statement[];        // task 1
export function structuralReport(view: View, plan?: AntiFormulaPlan, ledger?: Ledger): Report; // task 1
export function validatePlan(plan: unknown, score: NormalizedScore): AntiFormulaPlan;   // task 1
export function applyAntiFormula(score: ScoreInput, plan: AntiFormulaPlan, intensity: Intensity): { score: ScoreInput; ledger: Ledger }; // task 2+
```

```text
analysisView(score):
  s = deepClone(score); s.swing = 0.5; delete each part.humanize       // structure, not performance
  n = normalizeScore(s)                                                  // existing validator and expander
  return per part: notes sorted by (beat, pitch), bars, sections, instrument family

applyAntiFormula(score, plan, intensity):
  normalizeScore(score)                                    // input must already be valid
  plan = validatePlan(plan, normalized)
  if intensity == 'off': return { score: deepClone(score), ledger: emptyLedger(hashes) }   // A path: byte-identical JSON
  rng    = mulberry32(plan.seed ^ fnv1a(intensity))        // local PRNG copy; rack/score.ts is not modified
  memory = detectStatements(analysisView(score), plan.motifs)
  out    = deepClone(score); policy = POLICY[intensity]
  for section in sections (time order):
    intents = plan.arc[section] ?? ['develop']
    for debt in memory.openDebts where debt.dueByBeat <= section.end:
      apply 'deliver' at the next eligible statement or downbeat; mark paid
    if 'establish' or 'release' in intents: continue
    for st in memory.statementsIn(section) where st.index >= 1 and not protected(st):
      want = policy.distanceCurve[min(st.index, last)]
      ops  = OPERATORS.filter(op => allowed(op, policy, intents) and op.name != memory.lastOp(st.motif)
                                    and keepsRequired(op, policy.invariants))
      options = ops.flatMap(op => op.candidates(ctx, st).map(p => (op, p, |op.distance(ctx, st, p) - want|)))
      pick = stable sort by (gap, op.name, params as JSON); choose among the 3 smallest gaps with rng
      out = pick.op.apply(out, ...); record Decision(reason: intent + gap); push created statements and debts
    if 'restraint': subtract non-carrier roles in the bars before the next 'payoff' (or the section's last bar)
    if 'withhold' and memory.establishedRegularity(section): withhold (truncate or downbeat); open debt
    if 'rupture' and intensity == 'strong' and formBudget > 0: elide or extend one bar at the boundary; shift later material
    if 'recall': restate the most-distant earlier variant via handoff at expression <= 0.55
  assert normalizeScore(out) passes; fail naming the decision that broke it
  assert every transformed statement keeps policy.invariants; changed share <= policy.maxChangedShare
  assert unpaid debts == 0 (strong) or list them as warnings (conservative)
  return { score: out, ledger }
```

**CLI** (task 1 adds `report`; task 2 adds `apply`):

```bash
node studio-001/anti-formula/cli.ts report SCORE.json [--plan PLAN.json] [--ledger LEDGER.json] > report.json
```

```bash
node studio-001/anti-formula/cli.ts apply SCORE.json PLAN.json NEW_DIR --intensity off|conservative|strong
```

`apply` writes `score.json`, `ledger.json` and `report.json` into a **new**
directory and refuses an existing path, like the rack CLI. Rendering stays with
the unchanged `node studio-001/rack/cli.ts render NEW_DIR/score.json OUT`.

---

## 5. The experiment: one seed, three conditions

### 5.1 Seed and conditions

- **Seed: CROSSING** (`studio-001/scores/crossing.score.json`, committed,
  original, unheard). It is the richest existing score. Its theme
  restatements are verbatim (§1.3). It was not written for this experiment.
  Using it avoids composing a seed that favours Anti-Formula. Its crossing
  concept must survive: the plan protects the bar-11 unison and the coda, and
  leaves every macro curve alone except through `timbre-gesture` in C.
- **A:** `intensity: off`. The score is byte-identical to the committed one.
  As a determinism check, A's rack render must be byte-identical across two
  runs. If the bounce-plus-engine route is used, it must match the committed
  `studio-001/demo` hashes.
- **B:** `conservative`. The output stays bar-aligned with A (no form
  changes).
- **C:** `strong`. Duration may differ from A by at most one bar (about 2.9 s
  at 84 BPM).
- **Same everything else:** the same `plans/crossing.af-plan.json` and plan
  seed for B and C, the same rack version, the same `rack/cli.ts render` route
  (the `mix-context` WAV), one render per condition, and loudness-matched
  listening copies.

Draft plan for CROSSING. Task 2 finalizes it, and it is hashed before any
render:

| Section (bars) | Intents | Intended effect |
|---|---|---|
| alien-night (1–4) | `establish` | The first theme statement stays untouched. |
| arrival (5–8) | `develop` | The second theme statement varies (B: `displace-tail`; C: `invert` or `displace-whole`). The kick regularity is established here. |
| crossing (9–12) | `restraint`, `withhold`, `payoff` | Subtract before bar 11. Withhold the kick downbeat in bar 10, paying the debt at the protected bar-11 unison. |
| exchange (13–16) | `develop`, `rupture` (C only) | Vary the bass cell. C may elide or extend one bar; the clock cell regroups 3+3+2. |
| coda (17–18) | `recall`, `release` | Restate an earlier variant as a quiet handoff. The final note is protected. |

### 5.2 Pre-registration (no cherry-picking)

Before rendering, commit `experiment/preregistration.json`. It holds the hashes
of the input score, the plan and the three output scores and ledgers, the plan
seed, and the decision rules below. **Exactly one plan seed is listened to.**

As a seed-robustness check with no listening, run the planner with five other
seeds and report the spread of the report axes. This shows the chosen seed is
typical, not lucky.

### 5.3 Blind listening (primary evidence)

Reuse banger-lab-001's organizer procedure:

- RULES §6 loudness-matched copies with the same FFmpeg commands;
- a hashed `blind-key.json`;
- a scoresheet, lock, then reveal.

Changes for this experiment:

- **Panel:** n ≥ 5. Include at least one producer or composer and two listeners
  from the target audience. Operators and implementers do not judge.
- **Order:** neutral IDs and a Latin-square presentation order (ABC, BCA, CAB,
  …) across listeners. Headphones, plus a single phone-speaker pass.
- **Pass 1, cold:** one listen each. Rate "want the next bar" (1–5) and would
  replay (Y/N).
- **Pass 2, free replay:** rate 1–5 on each axis separately: *memorability*,
  *surprise that still made sense*, *coherence (one piece?)*, *tension and
  release*, *emotional response*, *replay*. Rank the three items for "most
  memorable". Mark the **best and worst moments** by timestamp.
- **Discrimination probe:** two 15-second excerpts (A vs B at the same bars),
  asked as "same or different?". This tests whether B is audible at all.
- **Recall after 24 hours, without listening:** "Describe or hum what you
  remember."
- **Moment attribution:** the organizer maps every best or worst timestamp to
  `ledger.decisions` (bar-accurate). This turns listening into operator-level
  evidence.

**Pre-registered decisions.** Raw numbers and n are reported. There are no
significance tests at this sample size.

1. **Manipulation check (structural).** Expected direction on the report axes:
   C > B > A for motif variation and distance; B and A have identical form;
   C has more contrast range. If this fails, the implementation is at fault,
   not the music. Fix it before listening.
2. **B is audible:** most listeners answer "different" on the probe. If not,
   raise the conservative targets before drawing conclusions.
3. **Promote a policy** as the recommended setting only if a majority rank it
   above A for memorability, **and** its median coherence is no more than 0.5
   below A's, **and** no listener reports a new technical defect.
4. **If A wins**, the v1.0 hypothesis fails *for this seed*. Read the
   moment-attribution table before changing anything, and change one operator
   class at a time.
5. **Any operator** that appears in two or more "worst moment" marks and no
   "best moment" marks is disabled in that policy for the next round.

### 5.4 What can be measured, and what that does not prove

Structural differences (the report diff between A, B and C) show that **the
manipulation happened as designed.** They do not show that C is better music.
CROSSING's verbatim kick may be exactly what makes it work. Only the listening
results decide quality. The report and ledger explain listening results; they
never overrule them (the same rule as banger-lab RULES §7).

---

## 6. Minimal implementation sequence

Each step ends with `npm run check` green and no change to any existing output.

1. **Foundations and measurement (read-only).** Types, plan validation, the
   analysis view, statement detection, the structural report, the `report` CLI,
   and the `off` path. Commit A's CROSSING report as baseline evidence. The
   exact task is in §10.
2. **Conservative planner (B).** Add the operators `displace-tail`, `truncate`
   + `deliver`, `register`, `fragment`, `retarget-end` and `subtract`. Add the
   planner, ledger, invariant guard, debt checks and `apply` CLI. Finalize
   `plans/crossing.af-plan.json` and produce B's score (not rendered).
3. **Strong operators (C).** Add `regroup-332`, `displace-whole`,
   `withhold-downbeat`, `invert`/`augment`, `handoff`/`answer`,
   `timbre-gesture`, `elide`/`extend` and `recall`. Form operators get the most
   tests because they shift curves, motion spans, breaths and sections.
4. **Experiment harness.** Pre-registration file, the five-seed robustness
   report, then the **only rendering step**: three rack renders, the listening
   copies and the blind key. CPU only, about 3 minutes.
5. **Human blind listening** (run by the owner, §5.3), the attribution table and
   a decision record.

Explicitly deferred:

- core-project (patterns/clips) and MCP integration;
- a harmony layer and harmonic substitution;
- mixed meter (the rack is 4/4 only);
- memory across pieces (avoiding the same tricks across songs);
- Composer skill changes;
- any model-in-the-loop critique.

---

## 7. Testing strategy

All tests are Node-only, render no audio, and run under the existing
`node --test "tests/**/*.test.ts"`.

| Test | Asserts |
|---|---|
| Determinism | The same (score, plan, intensity, seed) produces byte-identical `score.json`, `ledger.json` and `report.json`, in-process and in a fresh process. |
| Identity path | `off` returns JSON identical to the input. The report on an unmodified score has zero decisions and zero debts. |
| Detection | Synthetic fixtures: exact, transposed, near-miss (one onset off) and overlapping statements. On CROSSING: exactly 4 theme statements, at voice beats 8, 16 and 40 and bars beat 40. |
| Validity | Every operator's output passes `normalizeScore`: ranges, articulations, per-instrument params (`handoff` strips `vowel`/`to` when the target is not a voice), beats < `endBeat`. |
| Invariants | Each operator keeps exactly the invariants it declares (property tests over seeded random motifs from the test's own PRNG). |
| Expectation | Every `truncate` or `withhold` opens a debt. `deliver` pays it. In strong mode an unpaid debt throws a specific message. |
| Policy bounds | B: no form change, ≤ 15 % notes changed, all invariants kept. C: ≤ 1 bar of form change, ≤ 35 % changed. |
| Protection | Notes and curves in `protect` spans are byte-identical before and after. |
| Form shift | After `elide`/`extend`, every later note, curve breakpoint, motion span and breath moves by exactly ±4 beats, and `sections[].bars` sums correctly. |
| Report honesty | The report has no numeric field named or aggregated as a score. The disclaimer is present. Flags are deterministic text. |
| Non-interference | No file under `studio-001/rack/`, `src/` or `mcp/` changes (git-diff guard in CI review). The existing studio-rack and architecture tests stay green. |

---

## 8. Expected compute and token costs

| Item | Cost | Basis |
|---|---|---|
| Anti-Formula runtime (detect, plan, apply, report) | Milliseconds. **Zero model tokens. Zero network.** | Pure functions over at most a few thousand notes. No LLM in the loop. |
| Unit tests | Under 2 s added to `npm test` | No audio. Small fixtures, plus CROSSING JSON parsing. |
| Experiment renders (step 4) | About 2.5–3 min of CPU for three rack renders, plus seconds of FFmpeg for copies | README: the rack renders CROSSING at about 1× real time (about 45 s per 54 s render). |
| Optional bounce plus engine render of B/C | About 1–3 min of CPU each | Same route as the CROSSING package. Not needed for listening. |
| Five-seed robustness check | Milliseconds, no renders | Report only. |
| Implementation tokens (estimate) | Task 1: about 80–150k input and 20–40k output. Tasks 2–3: about 150–250k input and 40–80k output each. | Rough planning figures for an agent session that reads the rack sources and this document. Not measured. |
| Agent authoring a plan file | About 2–5k output tokens per plan | The plan is a small JSON document. |
| Human listening | About 20 min per listener, plus a 2-min recall the next day | 3 × 54 s × 2 passes, a probe and a scoresheet. |

There is no paid compute, no GPU and no new dependency at any step.

---

## 9. Risks and open questions

**Risks**

- **Mutation for its own sake.** The operators could produce "variation" that
  reads as error. *Mitigations:* the identity floor, the first-statement rule,
  B before C, and moment attribution to disable bad operators.
- **Breaking what works.** CROSSING's steady pulse may be its spine.
  *Mitigations:* `pulse` roles are only eligible for `withhold-downbeat`,
  `regroup-332` and `subtract`, never continuous mutation; and protect spans.
- **A new formula.** A fixed policy applied to every piece could converge again
  ("always withhold before the payoff"). *Mitigations:* intents come from the
  composer per piece; policies are data; and the open question on memory
  across pieces.
- **Overfitting to one seed.** One seed gives one data point. *Mitigation:*
  findings are reported as "for CROSSING" until a second, pre-registered seed
  replicates them.
- **Form operators are the riskiest code.** They shift every timeline field.
  *Mitigations:* exhaustive shift tests, and keeping them out of B.
- **Mono families.** Displacements on the voice or bass can create unintended
  slides or legato overlaps. *Mitigation:* operators trim durations and keep
  order; tests cover each family.
- **Small panel.** n ≈ 5 can mislead. *Mitigation:* raw results, recall and
  attribution, no significance claims, and decisions written as provisional.

**Open questions for the owner**

1. Should Anti-Formula reach the **core project / MCP path**, where most agent
   music is made? It would need an adapter from patterns/clips to beat-note
   lists. Grid constraints (`OFF_GRID`) limit some displacements.
2. Should harmony become a **first-class saved layer** (for example a `chords`
   lane in a future rack score version)? Without it, harmonic surprise stays
   limited to `retarget-end`.
3. Should the Composer skill **emit a plan file**? Then an agent declares
   motifs and intents, and the transformer does the bookkeeping.
4. Is a **second seed** worth composing now for replication? It would be a
   plain, original 16-bar rack score with a clear theme.
5. **Cross-piece memory:** should the ledgers of past pieces bias operator
   choice, so a catalogue avoids the same tricks?
6. **Mixed meter:** is a rack 1.x extension beyond 4/4 acceptable, or should
   asymmetry stay limited to phrase lengths and 3+3+2 regrouping?

---

## 10. First implementation task for Fable High

> **Task: Anti-Formula foundations and structural report (read-only), DaemonV12.**
>
> Repository `mataindustries/daemonv12`. Start from current `main` on a new
> feature branch. Read `docs/ANTI_FORMULA_V1_ARCHITECTURE.md` (§§3, 4, 7) and
> `studio-001/rack/{types,score,curves}.ts`. **Do not modify** anything under
> `studio-001/rack/`, `src/`, `mcp/`, `examples/`, `production/`, `packs/` or
> any committed score or audio. The rack sources are hashed into approved
> packages. No new dependencies, no rendering, no model API calls.
>
> Create `studio-001/anti-formula/` with:
>
> 1. `types.ts`: the plan, statement, debt, decision, ledger and report types
>    and the three schema ids, exactly as in §4. Operator and planner types may
>    be declared but not implemented.
> 2. `plan.ts`: `validatePlan(plan, normalizedScore)`. Collect all problems
>    with numbered, path-specific messages, in the same style as
>    `normalizeScore`: unknown parts and sections, empty or out-of-range
>    motif spans, unknown intents and roles, protect spans outside the piece,
>    an integer seed.
> 3. `view.ts`: `analysisView(score)`. Deep-clone, set swing to 0.5, drop
>    `humanize`, call the existing `normalizeScore`, and return per-part
>    sorted notes with bar indices and instrument family.
> 4. `motifs.ts`: `detectStatements(view, motifs)`. Find exact and transposed
>    matches of each source span's (onset offset, interval) sequence in every
>    part, ignoring durations and velocities. Return statements sorted by beat
>    with an occurrence `index`.
> 5. `report.ts`: `structuralReport(view, plan?, ledger?)` with the axes and
>    flags of §3.3 and a fixed disclaimer. Use the rhythm-signature definition
>    in §1.3. **No total, no weights.** Use a
>    simple, documented syncopation index (share of onsets off the beat,
>    weighted by metrical level). Write the formula in a code comment.
> 6. `cli.ts`: `report SCORE.json [--plan PLAN.json]` prints deterministic JSON
>    (sorted keys, fixed number formatting).
> 7. `tests/anti-formula.test.ts`. Required tests:
>    - plan validation messages;
>    - detection on synthetic fixtures (exact, transposed, near-miss,
>      overlapping);
>    - on CROSSING: theme source `{ part: "voice", fromBeat: 8, toBeat: 16 }`
>      gives exactly 4 statements (voice at beats 8, 16 and 40; bars at 40),
>      and the report shows the kick's longest identical run as 11 bars
>      starting at bar 5 and the clock's as 12;
>    - byte-identical report JSON across two runs;
>    - the report contains no aggregate score field.
> 8. Commit `studio-001/anti-formula/baseline/crossing.report.json`, generated
>    with a minimal plan file `studio-001/anti-formula/plans/crossing.motifs.json`
>    that declares only the theme and the `BAR5` bass cell
>    `{ part: "bass", fromBeat: 16, toBeat: 20 }`.
>
> **Acceptance:**
>
> - `npm run check` passes.
> - `git diff --stat main` shows changes only in `studio-001/anti-formula/**`,
>   `tests/anti-formula.test.ts` and a one-line link in
>   `docs/ANTI_FORMULA_V1_ARCHITECTURE.md`.
> - The existing studio-rack and architecture tests are untouched and green.
> - The report on CROSSING reproduces the §1.3 numbers.
>
> Stop after committing and pushing. Do not start operators or the planner
> (task 2). Report what the baseline flags say about CROSSING, without
> claiming anything about how it sounds.
---

## 11. Producer feedback and Fable implementation handoff (2026-11-15)

> **Read this section before executing §10.** The original §10 was written
> against `main` before the separate v0.9 motif implementation was considered.
> It remains useful as an architecture reference, **not** the current instruction
> to implement motif tools from scratch. As of this handoff, draft
> [motif-development PR #49](https://github.com/mataindustries/daemonv12/pull/49)
> supplies `studio-001/motif/`, `score/2`, 15 deterministic transforms, a
> motif report, an event map, and a HOOK//10 listening comparison. That work is
> **draft, not merged or released**. Inspect its actual code and tests first.
>
> **Evidence distinction:** The feedback below comes from the producer's
> earlier listening reactions and creative direction in conversations. It is
> subjective, not a completed blind benchmark or a result stored in this repo.
> Engineering observations from §1 and musical-quality judgments must remain
> separate.

### 11.1 What the producer actually wants

- **Chrome Stallion is the positive reference for identity.** The producer
  selected Wonder's version B ahead of A and C and described it as
  "griiiiiimey and weird" and said they loved it and wanted to push that
  sound. They later said it sounded even better in the car than on headphones.
  Retain the dirty, springy groove, unexpected timbral turns, character and
  replay value; do not flatten an unusual idea into a conventional cinematic
  build.
- **GRIND — IMPOSSIBLE ASCENT is a second directional reference.** Its unusual
  core idea remained recognizable as the arrangement developed. That survival
  of the idea matters more than the number of effects or transformations.
- **CROSSING is not an example of proven bad music.** The producer previously
  called it impressive, warm and deep. §1's findings about verbatim theme
  restatements and repeated pulse cells are structural measurements, **not**
  proof that CROSSING sounds generic or should be automatically "fixed."
  Its pulse, warmth and space may be exactly what makes it work.
- **The negative reference is technically correct but forgettable music.**
  Earlier DaemonV12 soundtrack passes could align to picture or achieve precise
  hit timing yet strike the producer as generic, dull or overly predictable.
  Audio/video synchronization, test counts, LUFS and a clean render do not
  constitute an artistic success.
- **Surprise must serve the song.** The aim is a memorable musical character,
  a hook or gesture worth replaying, emotional movement, tension and release,
  and an arrangement that can surprise without losing its pocket or identity.
  The producer wants music with ambitious finished-record quality, not
  "AI-sounding" filler or complexity for its own sake.

### 11.2 Design constraints for Anti-Formula

1. **Protect a compelling initial idea.** Identify what makes the seed
   recognizable (rhythmic pocket, contour, gesture, timbre, or a relationship
   between instruments). Do not normalize away the weirdness in the name of
   polish, balance or regular phrase length.
2. **Make recurrence mean something.** When a recognizable motif returns, it
   may change function, context, tension or emotional meaning. Mere exact
   repetition and unrelated rewriting are both insufficient as a universal
   development strategy. Neither must be prohibited outright.
3. **Create expectation, then make an intentional decision about it.**
   Withholding, deferral, an incomplete answer, reframing or a payoff are
   available compositional choices, not obligatory steps in a new formula.
   Record the setup, choice and resolution in an auditable ledger.
4. **Keep groove and space.** A strong physical pocket, contrast, restraint
   and silence can matter more than extra notes. Displacement or fragmentation
   must not destroy what listeners liked about the original.
5. **Reject a universal prescription.** Avoid rules such as "always change
   the fourth bar," "always add a drop" or "every payoff must be louder."
   Different pieces should earn different decisions. Bounded controlled
   rule-breaking is useful; aimless randomization is not.
6. **Let listening override metrics.** Reports prove what changed, not whether
   it got better. No aggregate "banger score" or stylistic score that rewards
   complexity for its own sake. Permit a producer to reject all variants.

### 11.3 Reconcile the actual code before building

The intended layering is:

```text
Composer / agent artistic intent
           |
           v
Anti-Formula: motif memory + expectation/debt ledger
              + deliberate intervention selection
           |
           v
Existing v0.9 motif score/2 + existing transformations (PR #49)
           |
           v
Existing score/1 rack -> existing renderer, stems and exports
```

- **Do not write another 15 operators.** Reuse `studio-001/motif/` only after
  inspecting its actual API, input/output contract, determinism guarantees and
  HOOK//10 proof. Preserve `score/1` and `score/2` compatibility.
- First deliverable should be a **thin, tested vertical slice**: reference a
  named motif, recognize its statements, represent one intentionally set-up
  expectation and a later payoff, invoke an existing transformation only when
  needed, and emit a decision/expectation ledger explaining **why** the change
  was selected. The first statement and approved audio remain untouched.
- A focused **A/B/C listening comparison** is useful *after* code passes:
  A = the unchanged original; B = existing authored v0.9 motif treatment;
  C = one Anti-Formula intervention. Keep source motif, length, sound palette,
  render path and listening loudness comparable. Retain all three masters for
  blinded listening; the producer decides the winner. Don't cherry-pick
  multiple C renders until one appears to win.
- If the two draft designs are incompatible, **report the precise conflict
  and a minimal reconciliation plan** rather than launching a parallel
  architecture or modifying approved rack/engine/MCP code.
- Keep the first proof short and CPU-only. No new instruments, paid model calls,
  large music renders, full album production, releases or merges without
  explicit approval.

### 11.4 Owner decisions carried forward

| Question from §9 | Direction for the next implementation |
|---|---|
| MCP/project-file composition | **Yes eventually**, because agent-driven composition uses it; **not** in this first vertical slice |
| Harmony as a score layer | **Eventually**; optional planning metadata first, no immediate rack-schema migration |
| Composer skill generating plan files | **Yes** as an intended interface, but implement only what is needed for the first proof |
| Second new seed | **No for now**; first establish meaningful development on one existing seed |
| Cross-piece memory | **Defer**; do not create a library of fixed tricks |
| Mixed meter | **Defer**; prove musical decisions within current constraints |

### 11.5 Acceptance is musical, not just technical

The next Fable report must answer:

- What distinctive material was protected?
- What expectation was established, deliberately changed, and resolved?
- Which existing v0.9 components were reused?
- Can the ledger trace every intervention to an explicit intention?
- Are the unmodified baseline and all frozen rack/engine outputs still intact?
- What did the producer **actually hear** in a blind comparison?

A passing test suite without a convincing listen is an engineering milestone,
**not** a finished Anti-Formula composition breakthrough.

---

## 12. Gate 1 outcome (2026-11-15)

Gate 1 built the thin slice §11.3 asks for and stopped there. What it is, what it reuses from v0.9, what it
refuses, and which parts of §§3–7 it did not build are in [ANTI_FORMULA_GATE1.md](ANTI_FORMULA_GATE1.md). The
answers to the §11.5 questions, except the last, are in the
[Gate 1 proof](../proofs/anti-formula-gate1/README.md). The last question, what the producer actually heard, is
open: the three files are ready and nobody has listened.
