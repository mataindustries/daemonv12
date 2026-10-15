# Prompt C · Human organizer · Setup, blind listening and judging

For the person running BANGER LAB 001. Work top to bottom. Record every result,
decision and hash in `bl001-run/00-setup/run-log.md`. Section references point
to `RULES.md`.

## 0. Preflight (before any contestant starts)

Run in the reference environment (Linux x86_64, Node v22.22.0, FFmpeg
6.1.1-3ubuntu5).

```sh
# Engine pin: a plain clone (not a worktree, so git works inside a container
# that mounts only this folder), detached at v0.7.0, read-only for contestants
git clone https://github.com/mataindustries/daemonv12.git /workspace/engine
git -C /workspace/engine checkout --detach 02438eda48506a94d10ad2756c6aafff8c5a9469
git -C /workspace/engine status --porcelain            # must print nothing
git -C /workspace/engine diff --name-only 02438eda48506a94d10ad2756c6aafff8c5a9469 f913226e99496eca43b9da0fbcea68516bf9bbb8 -- . ':(exclude)plugins/daemonv12-composer'   # must print nothing

# Composer v0.3 package, exported separately
mkdir -p /input/composer
git -C /workspace/engine archive f913226e99496eca43b9da0fbcea68516bf9bbb8:plugins/daemonv12-composer | tar -x -C /input/composer
(cd /input/composer && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum) > bl001-run/00-setup/composer-package.sha256
sha256sum bl001-run/00-setup/composer-package.sha256    # audit value: d4c01d6f4dbb35eb6bc191c7c0586ea9dc40f450dc2249fd41f48574c84385d5 (27 files)

# Brief folder (from the benchmark-prep branch)
mkdir -p /input/brief && cp -R <branch>/benchmarks/banger-lab-001/{BRIEF.md,approved-palette.json,templates,tools} /input/brief/

cd /workspace/engine && node bin/daemonv12.js doctor --json   # readiness: sampleOnly, productionEffects, mp3, loudnessAnalysis all true
```

**Toolchain fingerprint.** Create a scratch workspace with
`node bin/daemonv12.js init /tmp/bl001-pre` and copy
`benchmarks/banger-lab-001/organizer/bl001-preflight.json` into it. Then render:

| Project | Command | Expected SHA-256 of the master WAV |
|---|---|---|
| `orbital-foundry-audition.json` | `render … --out-dir /tmp/bl001-pre/of --stems --format wav` | `c1dd6439d38b701efc897a3652716d3ea2ce5cdf3198845d3727a15f42d6fcee` |
| `glasshouse-audition.json` | `render … --out-dir /tmp/bl001-pre/gh --stems --format wav` | `fed0082960cb69d7cb58255c2a91b16eb30c42ba655fabdb12f742ad74b74773` |
| `bl001-preflight.json` | `render … --out-dir /tmp/bl001-pre/p --stems --format wav,mp3` | `d25f7d06139aa535e342891944d392a9cf015e413d24b28ae8c340e243a3bdea` |

Probe stems: drone `83f9ee32…`, kick `af77f72f…`, sub `58edcc23…`, vox
`ac776a36…`; `.render.json` `4e9c754f…` (keep the filename
`bl001-preflight.json`). `tools/check-delivery.sh /tmp/bl001-pre/p bl001-preflight approved-palette.json`
must PASS every gate **except** the end boundary, which fails on purpose
(−23.8 dBFS). Any hash mismatch means a different toolchain: fix it before
launch, or record it and treat this environment as the only valid one.

**Workspaces.** For each contestant:

```sh
node bin/daemonv12.js init /runs/<A|B|B2>/output
cd /runs/<A|B|B2>/output
rm -rf assets/pulse-kit assets/v05                                  # not in the palette
find . -maxdepth 1 -name '*.json' ! -name '*.catalog.json' -delete   # drop starter projects, keep the two catalogs
node -e 'const fs=require("fs"),c=require("crypto"),p=JSON.parse(fs.readFileSync(process.argv[1]));let n=0,bad=0;for(const k of p.packs)for(const f of [k.kit,...k.sounds]){n++;const h=c.createHash("sha256").update(fs.readFileSync(f.file)).digest("hex");if(h!==f.sha256){bad++;console.log("MISMATCH",f.file)}}console.log(bad?"FAIL":`PASS ${n} files`)' /input/brief/approved-palette.json
# must print "PASS 24 files"
```

Mount `/workspace/engine`, `/input/composer` and `/input/brief` read-only, and
`/runs/<id>/output` as that contestant's `/output`. One container or session per
contestant, with no access to other runs.

**Owner attestation.** Write and sign this line in the run log: "I, the owner of
mataindustries/daemonv12, authored or commissioned the Orbital Foundry and
GLASSHOUSE packs and their generators, and the CC0-1.0 dedications in their
LICENSE files are mine." Record the model IDs and settings for every session.

## 1. Launch

Paste prompt A (Sonnet 5.5) and prompt B (Haiku 5.5) into their sessions at the
same time. Optional controlled arm: prompt B, unchanged, in a fresh Sonnet 5.5
session (B2). Do not coach. Answer only environment questions, identically for
all. Note the start and stop times.

## 2. Receive, seal and gate

1. Copy each `/output` to `bl001-run/A-lead/`, `B-lab-haiku/` (and
   `B-lab-sonnet/`). Seal it (`RULES.md` §5) and record the seal hash.
2. Run the §13 checklist. A gate failure is recorded, not silently repaired.
   Musical judging can still include an invalid item, clearly marked as such
   for the reveal. It may not ship without a disclosed Astra repair.
3. Build the pools (§6): the **hook pool** is the lab sketches plus the lead's
   promo15 excerpt; the **version pool** is lead V1–V3 (and V4/V5). Make the
   loudness-matched blind copies with the exact §6 commands, verify them, and
   seal `private/blind-key.json`. If you will judge too, have an agent session
   make the copies and key without showing you the mapping.

## 3. Listening sessions (S1 hook pool, S2 version pool)

Give each listener `templates/scoresheet.csv`, the copies folder (WAV, plus MP3
for phones) and, for each session, a personal random order (shuffle the IDs per
listener; with three or more listeners, rotate the start item so each item opens
a session once).

Read aloud to listeners: *"These are anonymous instrumentals. Some are short
sketches, some are full tracks. Judge only what you hear. Do not look at
waveforms, file sizes or properties. Do not discuss until everyone has
submitted."*

1. **Calibrate:** play a practice item (any non-competing file processed to the
   same target, for example the GLASSHOUSE audition) and set a comfortable
   volume. Do not touch it again in this session.
2. **Pass 1, cold:** each item once, in order, no replay. Score Identity and
   Groove, and Y/N for "would replay". About 2 minutes for S1, 4–6 for S2.
3. **Pass 2, free:** replay anything, any order. Fill the whole rubric
   (`RULES.md` §7) with the best and weakest moment in seconds, would license or
   use (and where), resemblance to an existing song, and comments.
4. **Second device:** repeat pass 2 for at least the top two items on a phone
   speaker. Use the `device` column.
5. Collect the sheets. Hash them (`sha256sum scores/*.csv >> run-log.md`)
   before anyone opens the key.

## 4. Recall test (24 h later)

Without playing anything: "Which of yesterday's tracks do you still remember?
Hum, tap, sing or describe each one." Write each description down verbatim and
map it to an ID only afterwards. Recall rate per item = listeners who recalled
it / listeners.

## 5. Aggregate, decide, reveal

1. Per item: mean and median weighted score (Σ score × weight / 5), per-criterion
   means, recall rate, would-replay and would-license counts, resemblance flags,
   best and weakest moment clusters. Report n. No significance claims.
2. Apply the §8 decision rules: lead version (S2), hook promotion (S1),
   resemblance hold. Write `C-judging/summary.md`: tables, verbatim comments
   grouped by item, and the decisions with reasons.
3. Open the key. Add the identities to the summary. Controlled arm: report
   per-model mean, median and pairwise preference counts as "under these
   conditions". Version test: report whether V3 beat V1 and V2 for each listener.

## 6. Hand off to Opus, then Astra

- Start prompt D (Opus) with the files listed there. Read its revision brief.
  You approve, edit or reject each task, and record the decision in the log.
  "Lock as is" is a valid outcome.
- For each approved task, start a **fresh** Astra session with prompt E plus that
  one filled task card. Run tasks in the brief's order; each task's output is the
  next task's parent. Verify each task's acceptance yourself before the next one.

## 7. Confirmation (S3) and lock

1. Blind A/B of the final against the selected lead version, matched to one
   target, each listener hearing both orders (A–B, later B–A). Ask: "Which do you
   prefer? Did anything get worse?" Include the promo15 render if one was made.
2. Ship the final only if a majority prefer it and nobody reports a new defect.
   Otherwise ship the selected lead, or revert the failing task and re-confirm.
3. Run Astra task E7 (delivery packaging) on the shipping project. Verify the
   §13 checklist and the rights packet, seal `F-release/`, and record the final
   hashes.

You are done when `F-release/` is sealed, the run log records every decision,
and `C-judging/summary.md` reports the results with n and limits.
