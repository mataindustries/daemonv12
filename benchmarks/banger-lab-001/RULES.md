# BANGER LAB 001 · Rules

Competition design (Phase 3), musical judging (Phase 4) and the delivery
contract (Phase 5). Organizer-facing. Contestants receive only the **brief
folder** (`BRIEF.md`, `approved-palette.json`, `templates/`,
`tools/check-delivery.sh`, mounted read-only at `/input/brief`) and their own
prompt.

---

## 1. Producer room vs. controlled benchmark

These are two different experiments. Never report one as the other.

| | **Producer room** (required; the point of LAB 001) | **Controlled arm** (optional) |
|---|---|---|
| Goal | The best possible release candidate | A fair model-versus-model comparison on one task |
| Tasks | Different by design: lead composer (A), hook lab (B), reviewer (D), refiner (E) | Identical: prompt B (three 15 s hook-and-groove sketches) |
| Who | Sonnet 5.5 (A), Haiku 5.5 (B), humans (C), Opus (D), Astra (E) | Sonnet 5.5 and Haiku 5.5, each in a **fresh** session separate from any producer-room run |
| Information | Opus and Astra see earlier work after judging; cross-pollination is intended | Neither model sees anything but the shared inputs |
| Budgets | Role-specific (section 4) | Identical prompt bytes, palette, engine, Composer, environment and caps; model settings recorded |
| Valid conclusion | "This record was made by this process; these people contributed this" | "Under these conditions, listeners preferred X's sketches in N of M comparisons" |
| Not a valid conclusion | Any model ranking | General model superiority, or statistical significance from 6 items and a few listeners |

Also controlled, and always run: **the version test**. Sonnet's V1, V2 and V3
(and V4/V5 if made) are judged blind against each other. This tests whether the
Composer v0.3 revision loop improved the music as heard.

If the controlled arm runs, its six sketches plus the lead's 15 s excerpt form
the producer-room hook pool, so one listening session serves both. The excerpt
is never counted in the model comparison.

## 2. Roles and sequence

| Stage | Who | Input | Output |
|---|---|---|---|
| 0 Preflight | Organizer (prompt C §0) | This folder, repository | Pins verified, environments fingerprinted, isolated workspaces |
| 1a Lead composition | **A: Sonnet 5.5** | Engine, Composer, `BRIEF.md`, palette, templates | One 75 s record with V1–V3 (≤ V5), cues, log, sealed submission |
| 1b Hook and groove lab | **B: Haiku 5.5** (parallel with 1a) | The same inputs | Three 15 s sketches, sealed submission |
| 1c Controlled arm (optional) | **B′: Sonnet 5.5**, fresh session, prompt B | The same inputs | Three 15 s sketches |
| 2 Validity gate and blind copies | Organizer | Sealed submissions | Gate reports; loudness-matched blind copies; sealed key |
| 3 Listening | **C: human panel** | Blind copies only | S1 hook pool, S2 version pool, R recall after 24 h; locked score sheets |
| 4 Producer review | **D: Opus** | Revealed results, selected material, projects, logs | Revision brief (or "lock as is") |
| 5 Refinement | **E: Astra**, one task per session | Brief, the named project(s) only | One derived project per task, with acceptance evidence |
| 6 Confirmation and lock | C panel + organizer | Final vs. selected lead (blind A/B) | Release candidate, delivery bundle, rights packet |

Who sees what:

| Material | A | B / B′ | Judges | D (Opus) | E (Astra) |
|---|---|---|---|---|---|
| Other contestants' work | never | never | blind copies only | after reveal | only what the brief names |
| Model or version identity | own only | own only | **never before scores lock** | after reveal | as needed |
| Measurements and manifests | own | own | never | yes | yes |
| Human scores and comments | no | no | own only | aggregated + comments | brief's summary only |

## 3. Environment, pins and isolation

**Reference environment.** Linux x86_64, Node **v22.22.0**, FFmpeg
**6.1.1-3ubuntu5** (Ubuntu 24.04 package). This combination reproduced the
recorded audition hashes. Run every contestant render, every Astra render and
the final lock in this environment class. GM tools are not needed. If another
toolchain is unavoidable, run the preflight there, record the difference, and
never compare hashes across toolchains.

**Pins.**

- Engine: `02438eda48506a94d10ad2756c6aafff8c5a9469` (v0.7.0), a clean checkout.
  Its in-tree `plugins/daemonv12-composer` is the old v0.2: contestants must ignore it.
- Composer: the v0.3.0 package exported from
  `f913226e99496eca43b9da0fbcea68516bf9bbb8` (PR #23 merge). Engine paths are
  identical at both commits (zero-path diff, `AUDIT.md`).
- Palette: `approved-palette.json` (22 WAVs, 2 kits).

**Isolation.** One container or session per contestant, mounting only: the
engine (read-only), the Composer package (read-only), the brief folder
(read-only), the contestant's own workspace and output (read-write). There is
no access to the archive, other workspaces, earlier round outputs or this
`RULES.md`. No network is needed.

## 4. Budgets and stop rules

| Role | Serious versions | Other renders | Wall-clock guide | Stop when |
|---|---|---|---|---|
| A (lead) | V1–V3 required, V4/V5 only with Composer §15 hypotheses | ≤ 12 excerpt or test renders, plus the lock render and its repeat | ~4 h | Composer v0.3 lock criteria met, or two consecutive revisions are marginal; never beyond V5 |
| B / B′ (lab) | 3 submitted sketches, each V1 + V2 (an optional V3) | ≤ 3 version renders per sketch, plus the lock render and its repeat | ~90 min | Three sketches sealed |
| D (Opus) | none | `validate`/`analyze` only; no composition | ~60 min | Brief written |
| E (Astra) | one task per session | ≤ 4 renders per task plus the final repeat | per task | Acceptance passes, or three renders fail and the blocker is reported |

Nobody may write new analysis software, install sounds, modify the engine or
Composer, or use MCP in place of the CLI (MCP is allowed only if already
configured; it is not needed).

## 5. Provenance and archive

```
bl001-run/
  00-setup/       pins, composer-package.sha256, doctor JSON, preflight results, owner attestation
  A-lead/         sealed copy of Sonnet's /output (never edited)
  B-lab-haiku/    sealed copy of Haiku's /output
  B-lab-sonnet/   (controlled arm only)
  C-judging/      copies/ (blind WAV/MP3), private/blind-key.json, scores/, recall/, summary.md
  D-review/       revision-brief.md
  E-tasks/E1-…/   one folder per Astra task: input hashes, derived project, renders, checks
  F-release/      final delivery bundle and rights packet
```

- **Sealing.** On receipt, the organizer runs
  `find . -type f ! -name SHA256SUMS -print0 | LC_ALL=C sort -z | xargs -0 sha256sum > SHA256SUMS`
  inside the submission and records that file's SHA-256 in `00-setup/run-log.md`.
  A sealed folder is never modified. Derived work always goes into a new folder.
- **Lineage.** Every derived project's `description` begins
  `Derived from <archive path> sha256 <hash> by <role/task>.`, and its folder
  records the parent hash. Model contributions stay attributable at file level.
- **Human decisions** (selections, brief approvals, waivers) are written to
  `00-setup/run-log.md` with date and reason.

## 6. Equivalent comparisons and blind listening copies

Comparisons are fair only when items differ in music alone. In every pool:

- the same engine, palette, environment and container type (75 s or 15 s);
- identical edge treatment: every hook-pool item gets the same 10 ms fade-in
  and fade-out, including sketches that are already 15 s;
- one loudness target for the pool, static gain only, no limiter;
- no metadata, file names that are random IDs, and an independently randomized
  order per listener;
- canonical masters untouched: copies are derived files.

**Pools.**

| Pool | Items | Length | Session |
|---|---|---|---|
| Hook | B's 3 sketches (+ B′'s 3) + the lead's promo window excerpt | 15.000 s (661,500 frames) | S1 |
| Version | Lead V1, V2, V3 (+ V4/V5) | 75.000 s | S2 |
| Confirmation | Final (after E) vs. the selected lead version | 75.000 s, and the 15 s promo if produced | S3 |

**Procedure** (from the engine root; `$I` input WAV, `$C` copies folder):

1. Hook-pool items only: make the edge-treated excerpt at unity gain. `S` is the
   lead's `promo15.start.frame` from `cues.json`, or 0 for a sketch.
   Version-pool and confirmation items skip this step and use the canonical
   master WAV itself as the step-2 input.
   ```sh
   ffmpeg -hide_banner -nostdin -v error -i "$I" -map 0:a:0 -map_metadata -1 -fflags +bitexact -flags:a +bitexact \
     -af "atrim=start_sample=$S:end_sample=$((S+661500)),asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.01,afade=t=out:st=14.99:d=0.01" \
     -c:a pcm_s16le "$C/work/<item>.wav"
   ```
2. Measure each pool item: `node bin/daemonv12.js analyze <wav> --json` →
   `integratedLufs` (L) and `truePeakDbfs` (TP).
3. Pool target `T = min(-16.0, min over items of (L - TP - 1.0))`, rounded
   **down** to 0.1 LU, so every item reaches T with true peak ≤ −1.0 dBTP.
   Gain per item `g = T - L`.
4. Make the copy from the step-2 input (`$IN`):
   `ffmpeg -hide_banner -nostdin -v error -i "$IN" -map 0:a:0 -map_metadata -1 -fflags +bitexact -flags:a +bitexact -af "volume=${g}dB" -c:a pcm_s16le "$C/<ID>.wav"`.
   An optional phone copy is
   `ffmpeg -hide_banner -nostdin -v error -i "$C/<ID>.wav" -map_metadata -1 -fflags +bitexact -c:a libmp3lame -b:a 192k "$C/<ID>.mp3"`.
5. Verify every copy with `analyze`: `|L' - T| ≤ 0.3` LU, TP' ≤ −1.0 dBTP,
   `fullScaleSamples` 0, exact frames. If any check fails, lower T by 0.5 and
   redo the whole pool.
6. Write `private/blind-key.json` (`ID → source path, source SHA-256, gain, T,
   pool, role`). Record its SHA-256 in the run log **before** S1. Nobody who will
   judge opens it before scores lock. A solo organizer has an agent session
   create the copies and the key without printing the mapping.

Verified in the audit: these commands are repeatable byte for byte, write a
plain 44-byte header, keep exact frame counts, and land within 0.01 LU of the
target.

## 7. Judging rubric

Score each criterion 1–5 (half points allowed). Weighted total =
Σ(score × weight) / 5, out of 100.

| Criterion | Weight | 1 | 3 | 5 |
|---|---:|---|---|---|
| **Memorability** | 20 | Nothing to recall | One element sticks while listening | I could hum, tap or describe it tomorrow |
| **Immediate identity** | 15 | Generic or confusing start | Clear by ~10 s | Unmistakable within ~5 s; I want the next bar |
| **Groove** | 15 | Stiff, static or unsteady | Steady, a little mechanical | Irresistible pulse; push and pull |
| **Bass and percussion impact** | 10 | Thin, muddy or fighting | Solid | Kick and bass hit together with authority |
| **Arrangement and payoff** (hook pool: *development potential*) | 10 | Flat, or random changes | Clear sections, modest arrival | Earned build, real contrast, payoff lands (hook: obviously carries 75 s) |
| **Emotional or physical response** | 10 | None | Mild | Strong: menace, lift, adrenaline, release |
| **Replay appeal** | 10 | Glad it ended | Would replay if asked | Want it again immediately; the ending invites the restart |
| **Production quality** | 10 | Clicks, harshness, masking break the spell | Clean but plain | Release-ready, controlled, nothing distracts |

Also on every score sheet (`templates/scoresheet.csv`): would replay (Y/N),
would license or use it in a project (Y/N, and where), best moment (s), weakest
moment (s), "resembles an existing song?" (title, or blank) and free comments.

**Measurements support, never substitute.** Judges never see metrics, waveforms
or manifests. The organizer may use measurements to explain a listening result
(for example, a masked kick), never to overrule one.

## 8. Human judging process (summary; full steps in `prompts/C-organizer-judging.md`)

- **Panel.** Three or more listeners, ideally five or more: at least one
  producer or music supervisor and at least two target-audience listeners. Fewer
  than three is allowed, and the report states n. Contestant operators do not judge.
- **Conditions.** Good headphones plus one phone speaker. Set volume once on a
  practice item, then leave it. No discussion until scores are locked.
- **S1 hook pool, S2 version pool:** pass 1 is a cold listen (each item once,
  rate identity, groove and "would replay"); pass 2 is free replay with the full
  rubric and comments.
- **R recall** 24 h later, without listening: "Which tracks do you remember?
  Hum, tap or describe each." The organizer maps descriptions to IDs. Recall
  rate is the memorability evidence alongside the rating.
- **Lock, then reveal.** Hash the score files, then open the key.
- **Aggregation.** Per item: mean and median weighted score, per-criterion
  means, recall rate, "would replay" and "would license" counts, resemblance
  flags. Report raw numbers and n. No significance tests.
- **Decisions.**
  - *Lead version:* highest mean weighted score in S2; break a tie with recall,
    then Memorability. If V3 is not best, record that as Composer evidence.
  - *Hook promotion:* a lab sketch is recommended to Opus only if a majority of
    listeners rated it above the lead's own excerpt on both Memorability and
    Identity.
  - *Confirmation:* the final ships only if a majority prefer it to the selected
    lead in S3 **and** no listener reports a new defect. Otherwise ship the
    selected lead or revert the failing task.
  - *Resemblance:* any flagged item is held for owner review before release.

## 9. Technical validity: eligibility, not excellence

A submission is **valid** when every gate below passes. Validity only means
it may be judged. A valid entry can be forgettable, and the rubric decides
quality. An invalid entry stays sealed exactly as submitted, and the organizer
records the failure. It may still be judged (marked invalid at the reveal), but
it cannot ship unless a narrow Astra task repairs it with owner approval, and
the repair is disclosed in the record.

1. Engine 0.7.0 at the pin; Composer package hashes match `composer-package.sha256`.
2. Production route with a fixed container: master `frames` = 3,307,500
   (sketches 661,500), 44,100 Hz, 2 channels, PCM16.
3. One stem per track; every stem has exactly the master's frames; stem and
   master hashes match the manifest.
4. Zero `clippedSamples` on every track, the master and the mix; zero
   full-scale samples; true peak ≤ −1.0 dBTP.
5. Only approved assets, by path and SHA-256; no GM (`gmRenderer`/`soundfont`
   null, `midi.notes` 0).
6. End boundary: final 441 frames peak ≤ −50 dBFS.
7. Determinism: a second render of the locked project, **with the same flags**,
   into a fresh directory is byte-identical for the WAV, MIDI, every stem,
   `.analysis.json` and `.render.json`. MP3 is outside the determinism contract.
   The manifest records the MP3's hash, so if the only `.render.json`
   difference is its `mp3` object, record that as informational rather than as a
   failure. A WAV-only repeat of a WAV+MP3 render can never match: the manifest
   gains an `mp3` key (verified).
8. All required files present (section 11), `submission.json` complete, and the
   `SHA256SUMS` seal verifies.
9. Lead only: V1–V3 are meaningful (section 10).

`tools/check-delivery.sh <render-dir> <name> approved-palette.json [frames]`
runs gates 2–6. Gate 7 is
`diff <(cd renders/final && sha256sum *.wav *.mid *.json *.stems/*.wav) <(cd renders/final-repeat && sha256sum *.wav *.mid *.json *.stems/*.wav)`
(empty output means pass).

## 10. Meaningful V1, V2 and V3 (lead composition)

Following Composer v0.3 §5–9:

- Each of V1, V2 and V3 is a complete 75 s render from its own project snapshot
  (`bl001-a-v1.json`…), with its own output directory, kept unchanged.
- Before V2 and before V3, the log names **three musical weaknesses** of the
  previous version, each with a section or time, evidence (labelled as score
  inspection, measurement or hypothesis), likely cause and intended change.
- Each new version changes **musical content** that addresses at least one named
  weakness: notes, rhythms, rates, slices, gates, clip placement, arrangement,
  sound choice or section structure. Renames, identical re-renders, format
  changes and gain-only or effect-only edits do not count. A mix change counts
  only alongside a musical one.
- The log records the keep or revert decision and its musical reason.
- After V3, the Composer review is recorded: opening continuity, impact test,
  final 3 s, translation proxy, risk pass and stop decision. V4/V5 need the §15
  hypothesis block written **before** the render.
- The organizer checks this by diffing consecutive snapshots
  (`git diff --no-index --stat bl001-a-v1.json bl001-a-v2.json`, then the full
  diff) against the log. A version that fails is reported to the panel as
  "not a meaningful revision"; it is still judged.

## 11. Delivery contract

### 11.1 Lead composer (A): `/output` is the composition workspace itself

| Path | Requirement |
|---|---|
| `assets/orbital-foundry/`, `assets/glasshouse/` | Unchanged pack copies, hashes as in the palette (only these two packs) |
| `bl001-a-v1.json`, `bl001-a-v2.json`, `bl001-a-v3.json` (… `-v5`) | Version snapshots, never edited after rendering |
| `bl001-a.json` | **Editable locked project**: a byte copy of the chosen version |
| `renders/v1/`, `renders/v2/`, `renders/v3/` … | Each version's WAV, `.render.json`, `.analysis.json`, stems |
| `renders/final/` | `bl001-a.json` rendered with `--stems --format wav,mp3`: **75 s WAV master**, **MP3 listening copy**, **aligned stems**, `.render.json` (**provenance manifest**), `.analysis.json` (**audio analysis JSON**), `.mid` |
| `renders/final-repeat/` | The second fresh render with identical flags (gate 7) |
| `cues.json` | **Authored section cues** + hits + **15 s promo-cut specification** (`templates/cues.template.json`) |
| `production-log.md` | **Production and revision log**: the Composer v0.3 template, fully filled |
| `submission.json` | `templates/submission.template.json`, filled |

The final master's audio must equal the chosen version's master
(`cmp renders/final/bl001-a.wav renders/vN/bl001-a-vN.wav`). This holds because
audio does not depend on the project filename (verified).

### 11.2 Hook lab (B / B′)

`assets/` (unchanged), `bl001-b1.json` … `bl001-b3.json` (locked sketches,
`render.duration.seconds` 15) and their `-v1`/`-v2` snapshots, `renders/b1-v1/`,
`renders/b1-v2/`, `renders/b1/`, `renders/b1-repeat/` (and so on),
`sketches.md` (per sketch: three-line thesis
covering hook, groove and low end; BPM, key and meter; hook track IDs and groove
track IDs; the V1→V2 weakness and change; how it would grow into 75 s), and
`submission.json`. Every sketch passes gates 2–7 with frames 661,500.

### 11.3 Repeatability, duration, clipping and release safety

Gates 1–9 above, plus these release-only checks (Astra task E7, organizer
verified):

- **Rights packet** in `F-release/`: both LICENSE files, `approved-palette.json`,
  the provenance statement (`AUDIT.md` §2.2), the owner attestation, the
  contributor list (model IDs and settings, human decisions) and the resemblance
  review outcome.
- **Advisory, not a gate:** a dual-mono fold-down
  (`ffmpeg -i master.wav -af "pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1" -c:a pcm_s16le mono.wav`,
  then `analyze`) loses no more than ~1.5 LU against the stereo master, with the
  hook still audible. Measured references: GLASSHOUSE audition −0.09 LU, Orbital
  Foundry audition −1.03 LU. Do not use a single-channel `pan=mono` file: BS.1770
  counts channels, so it reads about 3 LU lower even for perfectly mono-safe
  audio. Integrated loudness between −18 and −12 LUFS is a reasonable release
  band; outside it, record the reason.

## 12. Video handoff and the 15-second promo cut

**No v0.8 CueSync is needed.** The handoff uses only current engine outputs:

- `master.wav` and the stems: authoritative clock, 3,307,500 frames.
  44,100 / 60 = **735 audio frames per video frame**, so 4,500 video frames
  exactly. Rule: `videoFrame = floor(audioFrame / 735)`. An event at audio frame
  f is drawn on the video frame that contains it.
- `cues.json`: sections and hits as project-absolute musical positions with
  engine-resolved `tick`, `frame`, `seconds` (= frame / 44100, 6 decimals) and
  `videoFrame`. Section ends are the next section's start; the last ends at
  3,307,500.
- `.render.json`: `samples.tracks[].triggers[].frame` is the exact onset of every
  hit, the same kind of data the GLASS//FIRE motion system consumed
  (`promo/glass-fire/SYNC_HANDOFF.md`).
- `roles` in `cues.json` map stems to visual roles (kick, bass, hook, perc,
  fx, atmos).

A future deterministic timeline export can emit the same (position, tick, frame)
triples, and the sidecar becomes its regression fixture. MP3 is never the
picture clock.

**15 s promo-cut specification** (the composer delivers it in `cues.json`; Astra
task E6 renders it only if Opus's brief asks):

- Exactly **15.000 s = 661,500 frames = 900 video frames**.
- `promo15.start` on a bar line inside the master; it contains the signature
  hook and the strongest payoff moment; identity within the first second.
- The rendered promo is an **engine-native edit**: `bl001-promo15.json`,
  derived from the locked project by re-placing existing clips and patterns
  only, with `render.duration.seconds` 15 and a composed final button.
  No new musical material, and no FFmpeg edit as a deliverable.
- Same gates as a master (frames 661,500), including the end boundary.
- The quick excerpt in section 6 is a judging device, not the promo deliverable.

## 13. Organizer validation checklist

Per submission, in order. Record each result in the run log.

- [ ] `SHA256SUMS` seal recorded; `submission.json` present and complete
- [ ] Engine pin and Composer package hash list verified (gate 1)
- [ ] `node bin/daemonv12.js validate <locked project> --json` → `ok: true`, no errors
- [ ] `tools/check-delivery.sh renders/final bl001-a approved-palette.json` → exit 0 (gates 2–6); sketches with `661500`
- [ ] Determinism diff empty (gate 7); final master equals chosen version master (`cmp`)
- [ ] All section 11 files present (gate 8)
- [ ] Lead: V1–V3 snapshot diffs match the log's named weaknesses (gate 9)
- [ ] `cues.json`: every cue re-resolves to the same frames with the `BRIEF.md` command; promo window = 661,500 frames inside the container
- [ ] Production log separates measurement, score inspection and human feedback, and claims no listening
- [ ] Blind copies made and verified (section 6); key sealed and its hash recorded
