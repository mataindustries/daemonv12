# Hook first: choose a reason to keep listening

Use this before the full [Composer workflow](../SKILL.md). It is self-contained,
requires no sound pack, and applies to songs, acoustic parts, ambient gestures,
games and electronic tracks. A hook can be a melody, rhythmic exchange, texture
or recurring silence. Adapt to the brief; no compulsory key, beat or drop.

## Smallest useful decision

1. Write one line: mood, duration, use and rhythmic feel. Assign a foreground,
   support and low-end owner (or intentional absence). Do not add two parts to
   do the same job without a reason. Kick attack and bass sustain need separate
   space; count releases and effect tails, not only note starts.
2. Write **3–4 separate 2–4-bar hooks**, or equally short free-time gestures.
   Keep accompaniment/palette comparable so the ideas can be compared cheaply.
   Each candidate must differ in **rhythm and contour**: e.g. a displaced leap
   with a falling answer; a spacious descent with a pickup; a repeated-note
   call with an ascending response. For textures, change the timing and shape
   of the gesture. New pitches, transposition or a new instrument alone do not
   make another idea. Save each project, not just a prose promise.
3. Prioritize **rhythmic identity → contour → tension → memorable repetition**.
   Tap the rhythm on one pitch as a score-based diagnostic. Is there a clear
   accent/rest/pacing idea? Can a listener learn the shape? A leap/answer,
   sequence or withheld resolution can create expectation; these are options,
   not rules against even rhythms, repetition or consonance. Repeat enough to
   establish identity, then change the answer or harmonic implication.
4. **Cheap technical gate first:** asset-aware CLI `validate --json` for every
   sketch; fix schema, source/rate, gate/release and resource errors before
   audio work. Render short, dry sketches, without stems or decorative effects.
   For plain sampler sketches, omit production-only fields and `--format` to
   use the cheap Node route where appropriate. Read existing render provenance
   for overload; absence of clipping data is unknown, not proof of cleanliness.
   Validate/render the chosen production route before scaling up. Full mixes,
   stems and repeated loudness analysis wait until they can affect a decision.
5. **Choose musically:** offer the short renders to a human listener when
   available, with comparable playback levels and neutral candidate labels.
   Ask which idea is most memorable and worth hearing again, and why. Without
   listening feedback, state a provisional score-based choice and uncertainty
   in the log; do not claim to have heard it. At most one focused repair of a
   weak bar per candidate before selection; avoid polishing four full tracks.

Keep a tiny comparison table: candidate; rhythmic idea; contour/tension;
technical status; human feedback or score inference; select/reject reason.
No automatic quality scores. Validity, frame count, peak/LUFS, band energy,
stereo correlation and note counts cannot decide memorability or groove.

## Expand without burying the winner

Save the selected hook as an unchanged anchor. Plan sections in one line each:
what repeats, what changes, what leaves, and what the arrival resolves or reveals.
Use subtraction, harmonic movement and a different bass/accompaniment pattern
before adding instruments. A setup that already contains everything leaves
little for the arrival. A later return can keep the hook while moving its bass,
harmony, register or response; a fourth-phrase rest can matter more than a fill.
For ambient/acoustic work, the payoff may be an exposed voice or harmonic shift.

Before every revision, name **keep / change / evidence needed**. Protect the
winning rhythm/contour and successful moments; change the implicated bars or
roles. Compare the anchor and the full transition, not only the new excerpt.
Revert a change that fixes masking but erases identity. Replacing the hook needs
an explicit hypothesis or user request; it is not the default form of revision.

Sketched alternatives do not count as complete V1–V3 versions. Continue the
normal critique, opening/impact/ending checks and Risk Pass in the skill. Test
uncertain revisions with an excerpt first; only promote useful changes into
full renders. Reuse analysis. Stop speculative revisions after two marginal
comparisons, preserve the stronger version, and disclose unresolved defects.
If no defensible revision remains before V3, record the early-stop evidence
and omitted versions, then complete review/Risk Pass on the stronger candidate.
Do not invent a weakness or render merely to spend the budget.

Source: distilled from V12 SIGNATURE's Composer Playbook (sections 1–5), catalog
and inventory at repository commit `17468e7ee1df11b8cef361cf4e49601d5f671589`.
All guidance needed here is packaged locally. The playbook's future multi-root
instrument handoff is outside Composer; it adds no available engine capability.
