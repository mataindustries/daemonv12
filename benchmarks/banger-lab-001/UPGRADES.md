# BANGER LAB 001 · Recommended engine upgrades (Phase 7)

**Recommendation: defer v0.8 and v0.9 engine work until LAB 001's human results
are in.** Nothing below is required to compose, judge or deliver LAB 001
(`AUDIT.md` §1.4 lists a working v0.7 approach for every limitation). Build an
upgrade only when listeners' comments point at a limitation, not because a
feature is missing on paper.

Ranked by likely effect on what a listener hears, within each category, with the
LAB 001 evidence that would justify starting it.

## Sound-library limitations (largest likely effect; no engine change needed)

| Rank | Gap | Why it matters to the ear | Proposed response | Trigger evidence from LAB 001 |
|---:|---|---|---|---|
| 1 | No sustained tonal sources (pad, long bass, lead) and no rights-cleared melodic instrument set (GM excluded) | Harmony and sustained melody are thin; every entry leans on the same 22 sounds | A new **CC0 generated pack** made like GLASSHOUSE (deterministic Node generator, catalog, tests): sustained pad and lead vowels at several pitches, a long 808-style bass, a chord-stab family, two more kicks. Assets only, no engine change. | Comments such as "thin", "no harmony", "samey sound" on two or more items, or low Emotional scores while Groove is high |
| 2 | One synthetic voice identity (`ghost-vox`/`vox-chip`) | Vocal-chop hooks converge and may sound like the GHOST//SHIFT demo | Add contrasting synthetic vowel and consonant families to the pack above | Resemblance flags pointing at the bundled demos, or similar hooks across contestants |
| 3 | FluidR3 GM not rights-cleared | Excludes 128 instruments entirely | Owner/counsel review of FluidR3, or swap to a SoundFont with a verifiable per-sample chain of title | Only if the new pack proves insufficient |

## Composition and workflow limitations

| Rank | Gap | Effect on listening | Response | Trigger |
|---:|---|---|---|---|
| 1 | No sustain/loop points (a held note ends with its source) | Long notes need retrigger crossfades | Engine: sample loop points with crossfade (deferred since v0.6) | Listeners hear seams or "short" bass notes in held passages |
| 2 | Only track gain/pan automation (no master fade, no filter cutoff lane) | Builds and endings approximated with per-track fades and stepped filters | Engine: master gain automation first (small change), then filter cutoff automation | Weak builds, or abrupt and awkward endings in comments, despite E1/E5 fixes |
| 3 | No sidechain (kick-driven ducking) | Pumping is hand-authored point by point | Engine: track-to-track ducking reusing the existing master ducking detector | Only if authored pumping visibly limits entries |
| 4 | One tempo and meter | No tempo ramps or meter shifts | Tempo map (roadmap V1) | Low priority for 75 s pieces |

## Rendering and DSP limitations

| Rank | Gap | Effect | Response | Trigger |
|---:|---|---|---|---|
| 1 | No true-peak limiter or loudness maximizer | No effect on blind matched listening. Release masters sit around −15 to −18 LUFS, quieter than commercial electronic references | Engine: an oversampled true-peak limiter as an explicit master effect (never implicit) | A licensing partner needs louder masters. A post-lab mastering pass is the cheaper first answer. |
| 2 | Delay is one tap with no feedback, identical on both channels | Hypnotic echo throws must be written as notes | Engine: feedback and ping-pong delay parameters | Recurring "static space" comments |
| 3 | Only two-pole high/low-pass filters | No surgical EQ | Parametric bell/shelf effect | Masking that arrangement fixes did not solve |
| 4 | Linear-only envelopes and glides | Slightly mechanical bends and fades | Exponential curve option | Low |

## Video-synchronization limitations

| Rank | Gap | Effect | Response | Trigger |
|---:|---|---|---|---|
| 1 | No native deterministic timeline or cue export (v0.8 CueSync) | None on the music; the handoff uses the `cues.json` sidecar resolved by engine functions, plus manifest trigger frames | Build CueSync when a video production is actually scheduled, and use LAB 001's `cues.json` and manifest as its regression fixtures (same position → tick → frame triples, 735 frames per 60 fps video frame) | A scheduled video for the LAB 001 track |

## What not to build now

Plugin hosting, a GUI, granular synthesis, time-stretching, new MCP tools and
analysis dashboards would not change what LAB 001 listeners hear. The cheapest
high-impact next step, if listeners ask for it, is **rank 1 in the sound
library: a new CC0 generated pack**. It needs no engine version change and keeps
every existing render byte-identical.
