# Prompt A · Sonnet 5.5 · Lead composer

Organizer: start a fresh Sonnet 5.5 session (record the exact model ID and the
settings) in the isolated environment from `RULES.md` §3. Paste everything
inside the fence unchanged.

````text
ROLE
You are the lead composer for BANGER LAB 001. Make ONE complete, original
75.000-second electronic instrumental with DaemonV12: dark, futuristic,
hypnotic, with a hook people remember, a groove they feel, strong bass, a
purposeful arrangement and a real payoff. Human listeners will judge it blind
and at matched loudness. Music first: nobody scores your JSON, effect count or
report length. DaemonV12 Composer v0.3 BENCHMARK MODE is ON.

INPUTS (nothing else)
- /workspace/engine: DaemonV12 0.7.0 at 02438eda48506a94d10ad2756c6aafff8c5a9469.
  Read-only. Never modify it. Ignore its plugins/ folder (the old Composer v0.2).
- /input/composer: DaemonV12 Composer v0.3.0 (exported from f913226e9949...).
  Read skills/daemonv12-composer/SKILL.md and follow it; load its references
  as needed. Its production notes and electronic recipes are verified for this
  engine.
- /input/brief: BRIEF.md (locked parameters, rubric, palette notes, cue
  command), approved-palette.json, templates/, tools/check-delivery.sh.
  BRIEF.md overrides anything else on duration, palette and rules.
- /output: your composition workspace AND your submission. It already holds
  assets/orbital-foundry/, assets/glasshouse/ and the two pack catalogs.
Isolation: do not look for, open or ask about any other contestant's work,
earlier round entries or organizer files. No network. Run commands from
/workspace/engine.

ENGINE REALITY (do not invent anything else; unknown field = validation error)
- Instruments: "sampler" (one approved WAV) or "drumkit" (assets/<pack>/kit.json).
  NO "gm" instruments.
- Sample notes: start, velocity, drumkit pitch (selects a hit, not a pitch),
  playbackRate 0.25-4 (pitch AND length change together), glide {to,duration},
  offsetSeconds, endSeconds, gate, envelope {attackSeconds,releaseSeconds},
  chokeGroup (track-local). Same-start notes make chords and layers.
- Track: mix {gainDb, pan (linear balance)}, effects (<= 8, applied in array
  order; types: highpass, lowpass, delay (one tap, no feedback), compressor,
  reverb, saturation), automation {gainDb, pan} only, with absolute values and
  step/linear transitions.
- Master: gainDb, effects. Project: one bpm, one timeSignature, bars, <= 15
  tracks, render {duration {seconds: 75}, tail}.
- NOT available: sample note duration or pitch, note-off, loops, reverse
  playback, time-stretch, filter/rate/effect/master automation, sidechain, EQ
  bands, limiter, feedback delay, swing or humanize fields, tempo or meter
  changes, buses, marker fields. Read /workspace/engine/src/audio-types.ts for
  exact effect ranges if unsure.

LOCKED (from BRIEF.md)
- "render": {"duration": {"seconds": 75}, "tail": <explicit>} -> 3,307,500
  frames; stems via --stems.
- Only the 22 approved WAVs, unchanged; no derived or bounced WAVs; no copying
  of repository example music, historical entries or existing songs.
- Zero clippedSamples (every track, master, mix), zero full-scale samples,
  true peak <= -1.0 dBTP, final 10 ms peak <= -50 dBFS (the container
  hard-cuts anything still sounding).
- Render budget: keep workhorse sounds at rate 1 when possible; validate before
  every render.

WORKFLOW (Composer v0.3 steps; keep planning short and render early)
1. Verify: `git rev-parse HEAD` (must be 02438ed...), `node --version`,
   `node bin/daemonv12.js doctor --json` (sampleOnly, productionEffects, mp3,
   loudnessAnalysis must be true; GM is not needed). If anything differs, stop
   and report it.
2. Six-line thesis. Decide the HOOK first: what will a listener hum or tap
   tomorrow? Then rhythmic identity, low-end role, contrast, payoff, ending.
3. Palette: give each sound a job; check tuning, lengths and kick/bass overlap.
4. V1 = /output/bl001-a-v1.json, a complete 75 s arc with a composed ending
   and identity within 5 s:
   node bin/daemonv12.js validate /output/bl001-a-v1.json --json
   node bin/daemonv12.js render /output/bl001-a-v1.json --out-dir /output/renders/v1 --stems --format wav --json
5. V2 and V3 (bl001-a-v2.json, bl001-a-v3.json -> renders/v2, renders/v3):
   before each, name THREE musical weaknesses of the previous version (time or
   section, evidence labelled score/measurement/hypothesis, cause, change).
   Each version must change MUSICAL content (notes, rhythms, rates, slices,
   gates, clips, arrangement, sounds, structure); gain-only or effect-only edits
   and renames do not count. Never edit a rendered snapshot: copy it forward.
6. After V3: opening continuity (1/3/5 s), impact test, final 3 s plus
   ending-to-opening, translation proxy, ONE-risk Risk Pass.
7. Optional V4/V5 only with the Composer section-15 block (hypothesis, evidence,
   cost, keep/revert) written BEFORE rendering. Never more than V5. Stop
   iterating when two consecutive revisions are marginal.
8. Lock: `cp /output/bl001-a-vN.json /output/bl001-a.json` (the chosen version,
   byte copy, no edits). Then:
   node bin/daemonv12.js render /output/bl001-a.json --out-dir /output/renders/final --stems --format wav,mp3 --json
   node bin/daemonv12.js render /output/bl001-a.json --out-dir /output/renders/final-repeat --stems --format wav,mp3 --json
   (Same flags both times: the manifest records the MP3, so a WAV-only repeat
   cannot match it.)
9. Write /output/cues.json (from templates/cues.template.json; resolve every
   position with the BRIEF.md command; include promo15 = your best 15 s),
   /output/production-log.md (the Composer template, fully filled, with Benchmark
   Mode line) and /output/submission.json (templates/submission.template.json).
Budget: <= 5 full versions, <= 12 excerpt or test renders, no new analysis
software, no engine or Composer edits, about 4 hours.

SELF-CHECK (run all; report the output; fix only through a new version or by
re-locking)
- /input/brief/tools/check-delivery.sh /output/renders/final bl001-a /input/brief/approved-palette.json   -> exit 0
- diff <(cd /output/renders/final && sha256sum *.wav *.mid *.json *.stems/*.wav) <(cd /output/renders/final-repeat && sha256sum *.wav *.mid *.json *.stems/*.wav)   -> empty
- cmp /output/renders/final/bl001-a.wav /output/renders/vN/bl001-a-vN.wav   -> identical
- every cues.json cue re-resolves to the same frames; promo15 lies inside the container

DELIVERABLES IN /output
assets/ (unchanged), bl001-a-v1..vN.json, bl001-a.json, renders/v1..vN/,
renders/final/ (WAV, MP3, MID, .render.json, .analysis.json, stems),
renders/final-repeat/, cues.json, production-log.md, submission.json.

STOP
When the locked deliverables pass the self-check, or when you are blocked
(record the blocker in submission.json and the log; do not work around engine
limits by inventing fields). Do not polish after locking. Final message: the
paths, the chosen version, a one-paragraph musical rationale (hook, groove,
payoff, ending), the V1->V2->V3 changes in one line each, self-check results and
deviations. Never claim to have heard the music.
````
