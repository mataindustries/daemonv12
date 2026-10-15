# Prompt B · Haiku 5.5 · Hook and groove laboratory

Organizer: start a fresh Haiku 5.5 session (record the exact model ID and the
settings) in its own isolated environment (`RULES.md` §3). Paste everything
inside the fence unchanged. For the optional controlled arm, give the
**identical** text to a fresh Sonnet 5.5 session with its own `/output`.

````text
ROLE
You are the hook-and-groove lab for BANGER LAB 001. Make THREE short, original,
self-contained sketches. Each one tests a different idea for a hook (the thing a
listener hums or taps tomorrow) locked to a groove (drums plus bass) that makes
a body move. Same brief as the full tracks: dark, futuristic, hypnotic, strong
bass. Humans judge the sketches blind at matched loudness. The best hook may be
developed into the final record. Music first; keep reports short.
DaemonV12 Composer v0.3 BENCHMARK MODE is ON, with this user constraint: sketches
replace the full V1-V3 workflow (disclose that in the log).

INPUTS (nothing else)
- /workspace/engine: DaemonV12 0.7.0 at 02438eda48506a94d10ad2756c6aafff8c5a9469.
  Read-only. Ignore its plugins/ folder (the old Composer v0.2).
- /input/composer: Composer v0.3.0. Read skills/daemonv12-composer/SKILL.md,
  references/daemonv12-production-notes.md and references/electronic-production.md.
  Read other references only if a specific question needs them.
- /input/brief: BRIEF.md (it overrides anything else on palette and rules),
  approved-palette.json, templates/, tools/check-delivery.sh.
- /output: your workspace AND your submission (assets/orbital-foundry/,
  assets/glasshouse/ and the catalogs are already there).
Isolation: do not look for, open or ask about any other contestant's work,
earlier round entries or organizer files. No network. Run commands from
/workspace/engine.

ENGINE REALITY (do not invent anything else)
- Instruments: "sampler" or "drumkit" only (NO "gm"). Sample notes: start,
  velocity, drumkit pitch (selects a hit), playbackRate 0.25-4 (pitch and length
  together), glide {to,duration}, offsetSeconds, endSeconds, gate,
  envelope {attackSeconds,releaseSeconds}, chokeGroup.
- Track mix {gainDb, pan}, effects (highpass, lowpass, delay one-tap, compressor,
  reverb, saturation), automation {gainDb, pan} only. Master gainDb and effects.
- NOT available: sample note duration or pitch, loops, reverse playback,
  time-stretch, filter/master automation, sidechain, EQ, limiter, swing field,
  tempo changes, GM.

EACH SKETCH
- Exactly 15.000 s: "render": {"duration": {"seconds": 15}, "tail": <explicit>}
  -> 661,500 frames. Identity within the first second; the hook appears in the
  first 4 seconds and returns with a consequence; a composed ending inside the
  container (final 10 ms peak <= -50 dBFS).
- Hook material on its own track(s); groove (kick, perc, bass) on separate
  tracks. List the track IDs in sketches.md so the hook could be moved into
  another project.
- Only the 22 approved WAVs, unchanged. Zero clippedSamples, zero full-scale
  samples, true peak <= -1.0 dBTP. Original material only.
- The three sketches must be DIFFERENT directions: change at least two of hook
  source (voice, glass, metal/alarm, bass-as-hook), tempo or feel, and rhythmic
  idea. Three variants of one idea is a failure.

PROCESS PER SKETCH (k = 1, 2, 3)
1. Three-line thesis: hook / groove / low end.
2. V1 = /output/bl001-bk-v1.json (bk = b1, b2 or b3):
   node bin/daemonv12.js validate /output/bl001-bk-v1.json --json
   node bin/daemonv12.js render /output/bl001-bk-v1.json --out-dir /output/renders/bk-v1 --stems --format wav --json
3. Name ONE musical weakness (time, evidence label, cause), make a MUSICAL change
   (not gain or effects only) in bl001-bk-v2.json, and render it to renders/bk-v2.
   An optional V3 is allowed under the same rule.
4. Lock: cp the chosen version to /output/bl001-bk.json (byte copy). Render it
   to renders/bk with --stems --format wav,mp3, and again, with the same flags,
   to renders/bk-repeat.
First do environment verification once: `git rev-parse HEAD`, `node --version`,
`node bin/daemonv12.js doctor --json`; stop and report if the commit or the
readiness flags (sampleOnly, productionEffects, mp3, loudnessAnalysis) differ.
Budget: <= 3 version renders per sketch (V1, V2, optional V3) plus the lock
render and its repeat; no new software; about 90 minutes.

SELF-CHECK PER SKETCH
- /input/brief/tools/check-delivery.sh /output/renders/bk bl001-bk /input/brief/approved-palette.json 661500   -> exit 0
- diff <(cd /output/renders/bk && sha256sum *.wav *.mid *.json *.stems/*.wav) <(cd /output/renders/bk-repeat && sha256sum *.wav *.mid *.json *.stems/*.wav)   -> empty

DELIVERABLES IN /output
assets/ (unchanged); bl001-b1.json, bl001-b2.json, bl001-b3.json plus their
-v1/-v2(/-v3) snapshots; renders/ for every version, lock and repeat;
sketches.md (per sketch: thesis; BPM, key and meter; hook track IDs; groove
track IDs; the V1->V2 weakness and change; two lines on how it grows into a
75 s track); submission.json (templates/submission.template.json, role
"B-hook-lab"; list all three sketches under final).

STOP
When all three sketches pass the self-check, or when blocked (record the
blocker). Final message: paths, one line per sketch on what the hook is, and
self-check results. Never claim to have heard the music.
````
