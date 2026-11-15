# Anti-Formula Gate 1: musical memory, expectation and payoff

**Status: draft for owner review.** Nothing is merged, released or tagged. The rack, the frozen engines, `src/`,
`mcp/`, the v0.9 motif layer, `package.json` and every approved score and audio file are unchanged. Whether the
result is better music is a listening question that only the producer can answer; see
[the Gate 1 proof](../proofs/anti-formula-gate1/README.md).

Design background: [ANTI_FORMULA_V1_ARCHITECTURE.md](ANTI_FORMULA_V1_ARCHITECTURE.md), §11 first.
Motif layer contract: [V0_9_MOTIF_DEVELOPMENT.md](V0_9_MOTIF_DEVELOPMENT.md).

## What Gate 1 is

One thin layer above the v0.9 motif layer. The composer declares one decision about one motif: what must stay
recognisable, what the listener has been led to expect, where that expectation is deliberately not met, and where
it is paid. The layer checks that the declaration is true of the score, performs it with one existing v0.9
transform, and writes a ledger that says what changed, what did not, and why.

```
composer intent ──► plan.json ─┐
                               ▼
score/2 (source) ──► studio-001/anti-formula ──► score/2 (changed) + ledger.json
                       memory, expectation            │
                       state, checks                  ▼
                                         studio-001/motif lowerScore ──► score/1 ──► rack   (all unchanged)
```

There is no planner, no search and no random number. The layer never decides what the music should do.

## Gate 0: what was found, and how it was reconciled

| Question | Finding |
|---|---|
| Does the v0.9 motif layer already hold the facts a memory needs? | Yes. `lowerScore` returns every placed phrase with the literal motif it derives from (`root`), its transform chain, its notes and two recognisability flags. Gate 1 reads these and adds no second representation of a motif. |
| Do the fifteen v0.9 transforms cover withholding, deferral and reframing? | Yes: `fragment` (keep the head, or cut out the tail) and `endOn` (move the landing). Gate 1 adds no transform and no operator table. |
| Is there an architectural conflict with PR #49? | **No.** Gate 1 imports `studio-001/motif` and edits no file in it (a test pins all six file hashes). Its output is an ordinary `score/2`. |
| What in the architecture document is superseded? | §3 and §4 were written against `main`, before `score/2` existed. Their beat-span motif detector, operator table, intensity policies, seeded choice and structural report are **not** built: statements are named phrases now, not detected spans; the transforms exist; and a seeded automatic choice is exactly the "new formula" §11.2 warns about. The plan and ledger schema ids of §4 are kept, with the shapes described here. |
| One difference in values, not in code | The v0.9 HOOK//10 structure gate asks for no bar repeated more than once in a row in any part. Gate 1 lets a composer protect a repeating pocket on purpose. C therefore fails that one v0.9 check by design. The result is recorded in the manifest. The v0.9 gate is unchanged and still applies to v0.9 pieces. |

## Where it lives

| File | Role |
|---|---|
| `studio-001/anti-formula/types.ts` | Plan, memory and ledger types; schema ids |
| `studio-001/anti-formula/memory.ts` | Pure: statements in listening order, statement form, the expectation state machine, `observe` |
| `studio-001/anti-formula/apply.ts` | Pure: plan validation, the one edit, the checks, the ledger |
| `studio-001/anti-formula/cli.ts` | `observe`, `apply` (JSON in, JSON out; never overwrites) |
| `studio-001/anti-formula/hook10/` | The HOOK//10 source, plan, C score, ledger and build script |
| `tests/anti-formula.test.ts`, `tests/anti-formula.integration.test.ts` | 13 pure tests; audio checks of the committed C master |

About 470 lines of code, plus a 95-line build script for the proof. No new dependency.

## Memory

`recallStatements(score)` lists every statement of every literal motif in listening order (onset, then part order).
Each statement has a **form**:

| Form | Meaning |
|---|---|
| `complete` | As many notes as the motif, the same up/down contour, and onsets that are the motif's onsets times one factor. A transposed, octave-moved or uniformly faster statement is still complete. |
| `partial` | Fewer notes, and the motif layer's own test still recognises its contour or rhythm (a head, an echo of the tail). |
| `developed` | Anything else (inverted, sequenced, ornamented, backwards). |

`observe(score)` works on any `score/2` without a plan and reports, for each part that states a motif whole, how far
the expectation "this part states the motif whole" got. It is a description. It opens no debt and rates nothing.

## Expectation states

Gate 1 tracks one kind of expectation, **completion**: after its head, the motif goes on to its tail and lands.

```
latent ──(minStatements whole statements in the part, default and minimum 2)──► established
established ──(a whole statement)──► established        event: confirmed
established ──(another statement of the motif, no declared intent)──► established   event: departed
established ──(the declared intervention)──► open       event: withheld | deferred | reframed
open ──(the declared payoff sounds what is owed, in time)──► resolved
open ──(the plan says the debt stays open, and why)──► unresolved   event: left-open
```

Without a declared intervention nothing is ever opened. A piece that simply develops a motif away from its
statement (HOOK//10 B1 does) shows `departed` events and no debt.

## The plan (`daemonv12.anti-formula.plan/1`)

| Field | Meaning |
|---|---|
| `identity.motif`, `headNotes` | A literal motif of the score, and how many opening notes carry its identity. The rest is the tail. |
| `identity.essence` | The composer's sentence: what must stay recognisable. |
| `identity.protect.phrases`, `.parts` | Material that must come out note-identical. The motif's first statement is always protected. |
| `expectation.part`, `minStatements`, `statement` | The part that teaches the expectation; how many whole statements establish it (2 or more); the composer's sentence. |
| `intervention.kind`, `target` | `withhold`, `defer` or `reframe`, and the phrase id it happens at. |
| `intervention.landOn` | `reframe` only: the scale step the statement lands on instead. |
| `intervention.resolveWithinBeats` | The longest the payoff may wait after the owed material was expected. |
| `intervention.intent`, `reason` | The composer's sentences: what this should do to the listener, and why this and not something else. |
| `payoff` | One of: `{ phrase, delivers: "landing" \| "tail", intent }` (an existing phrase, left as written); `{ place: { at, part?, id?, transforms?, velocity?, fit? }, intent }` (the owed tail, placed later); `{ unresolved: true, reason }`. |
| `output` | Title, description and section texts of the written score. No effect on sound. |

| Kind | What happens at the target | v0.9 transform | Payoff |
|---|---|---|---|
| `withhold` | The statement keeps its head; the tail is left out and nothing replaces it | `fragment 0..headNotes` | An existing phrase, or declared open |
| `defer` | The same, and the tail itself returns later (it may be moved to another part or transformed) | `fragment 0..headNotes`, and `fragment headNotes..n` on the placed phrase | The placed phrase |
| `reframe` | The statement stays whole and lands on another step; the original landing is owed | `endOn` | Any of the three |

## What the layer refuses

A plan is rejected, with every reason listed and nothing written, when:

- the target is the first statement of the motif anywhere in the piece (nothing is expected yet);
- the part has not stated the motif whole `minStatements` times before the target;
- the target is not a whole statement, or is protected, or is in a protected part;
- the payoff does not sound what is owed: the landing's pitch class, or the tail in a recognisable form;
- the payoff arrives later than `resolveWithinBeats`, or a deferred tail does not arrive later than it was expected;
- a debt is left open without `unresolved: true` and a reason;
- a reframe lands on the note the statement already lands on;
- the changed score does not lower to a valid rack score;
- any composer sentence (essence, expectation, intent, reason) is missing.

After the edit the layer re-lowers the score and checks, note by note, that every phrase other than the target is
identical to the source, that protected parts are identical, that every curve, setting and generator is identical,
and that the target kept its opening notes exactly.

## The ledger (`daemonv12.anti-formula.ledger/1`)

| Question | Field | Who says it |
|---|---|---|
| What musical identity is protected? | `identity` (essence, head and tail notes, protected phrases and parts) | Composer's sentence; notes and protection checked |
| What expectation was established? | `expectation` (`establishedBy`, `establishedAtBeat`, `owed`) | Composer's sentence; statements counted by the layer |
| What did the composer intend? | `intervention.intent`, `payoff.intent` | Composer, verbatim |
| Which transformation was selected? | `intervention.transform`, `mechanism`, `payoff.transform` | Layer |
| Why was it selected? | `intervention.reason` (musical), `mechanism` (what the transform does and does not touch) | Composer; layer |
| What was deliberately left unchanged? | `unchanged` (phrases, parts, curves, note counts), `payoff.changedByAntiFormula` | Layer, checked against the source |
| Where does the payoff occur? | `payoff` (phrase, bar, beat, seconds, sample frame, note, beats waited) | Layer |
| How did the expectation move? | `timeline` | Layer |

It also holds SHA-256 hashes of the source, plan and output (of `JSON.stringify` of each parsed file), every
statement of the motif in the output (`memory`), and the stretch where the owed material would have been (`gap`:
whether the part rests there and which other statements of the motif sound). It has no total, weight or rating; a
test checks that no such field exists.

## Commands

```bash
node studio-001/anti-formula/cli.ts observe studio-001/scores/hook10/hook10-b1.score.json
```

```bash
node studio-001/anti-formula/cli.ts apply studio-001/anti-formula/hook10/hook10-literal.score.json studio-001/anti-formula/hook10/hook10-c.plan.json --out work/c.score.json --ledger work/c.ledger.json
```

```bash
node studio-001/motif/cli.ts render work/c.score.json work/c-render
```

```bash
node --test tests/anti-formula.test.ts tests/anti-formula.integration.test.ts
```

## Not in Gate 1

- A planner, intensity policies, seeded choice, more than one intervention per plan, or more than one expectation kind.
- Detection of motifs in plain notes. A `score/1` has no named motifs; write the material as `score/2` first (HOOK//10 A was transcribed this way, and a test proves the transcription is exact).
- Expectations about rhythm, harmony, register, timbre or form. Curves and macros are never touched.
- MCP or core-project integration, a harmony layer, mixed meter, cross-piece memory, Composer skill changes.
- Any audio analysis, model call or quality score.

## Open questions for the owner

1. **Is completion the right first expectation?** It is the one the hook material makes audible. Rhythm ("the kick
   is on the downbeat") and timbre ("the macro opens here") are the obvious next two, and both need their own
   memory.
2. **Who writes the plan?** Gate 1 expects a composer or a composing agent to write four sentences and name a
   phrase. §11.4 says the Composer skill should eventually emit plans. That is a Composer-only change for a later
   gate.
3. **Should `observe` be shown to composers before they plan?** It lists where an expectation is established and
   where a piece departs from it without saying why. It could prompt a decision; it could also become a checklist
   that makes every piece withhold in bar 3. It is left as a plain command for now.
4. **The v0.9 structure gate.** It rewards non-repetition in every part. If Gate 1's direction is confirmed by
   listening, that gate should stop counting protected pocket parts. Not changed here.
