# IGNITION 002 — V12 OVERDRIVE: Codex handoff

Your job is to **render, verify and package** the finished V12 film. The design is frozen.
Do not redesign the engine, the choreography, the camera or the typography, and do not touch
the soundtrack. If something looks wrong, document it for human review instead of changing it
(see “If something fails”).

## 1. Source

| | |
|---|---|
| Repository | `mataindustries/daemonv12` |
| Branch | `feature/ignition-002-v12-overdrive` (never merge it into `main`) |
| Frozen implementation | commit `0a615a7` (“fix(promo): clamp V12 HDR fireflies before bloom”) |
| This handoff | added in the commit after `0a615a7`; it changes only this file |
| Project folder | `promo/ignition-002/` (all commands below run from here) |
| Base | branched from `feature/ignition-002-vertical-video` at `b11b1ad` (V1, the Infinite Reactor, untouched) |

What the branch contains:

- **The composition.** `src/v12/` holds the `V12Overdrive` composition:
  - `V12Overdrive.tsx`, registered in `src/Root.tsx` under the folder “V12”
  - the engine in `Engine.tsx`
  - the hall, lights, camera and post in `Stage.tsx`
  - the music-to-motion mapping in `choreo.ts`
  - the crank, piston and valve maths in `kinematics.ts`
  - titles in `TitlesV12.tsx`
- **Music data.** `src/v12/sync.json` is measured from the approved WAV by `scripts/analyze-v12.ts`. It is committed; do not regenerate it.
- **Pipeline.** `scripts/render.ts`, `scripts/verify.ts` and `scripts/lib/deliverables.ts` select this film with `--film v12` and write to `out/v12/`. The V1 film's defaults and outputs are unchanged.
- **Tests.** `tests/v12-kinematics.test.ts`, `tests/v12-loop.test.ts` and `tests/v12-audio.test.ts`, alongside the V1 tests.

## 2. Status

**Done and verified at `0a615a7`:**

- `npm run check` passes:
  - `tsc` clean
  - `eslint src` clean
  - **32/32 tests pass, 0 fail, 0 skipped**. The audio ground-truth test ran because the approved WAV was present.
- Mechanism tests:
  - 12 cylinders on a 60° V
  - rod length and bore axis hold through the stroke
  - TDC at firing, 60° spacing
  - firing order 1-11-5-10-4-7-6-8-2-9-3-12
  - piston-to-head clearance
  - crank turns exactly 10 revolutions per loop
  - cams turn at half speed, valve lifts correct
- Loop tests:
  - every animated quantity is exactly periodic
  - virtual frame 900 equals frame 0
  - position and velocity are continuous at the seam
  - no seam step larger than the film's own steps
- Audio-analysis tests: they reproduce the reconciled ground truth.
  - 32 kicks; the claps
  - the full stop at 3.75–3.98 s
  - the re-ignition stab at 3.984 s
  - the payoff at 9.375 s
  - the bar-7 brass riff
  - the bass-free bars 3 and 5
- `src/v12/sync.json`:
  - `source: "analysis"`
  - `audio.sha256` = `6938bf3b8efd90d9c9818dc20689b71e408d9d22be1cab7e01da597da22a80e1`
  - 128 BPM, 15 s; markers `reignite 3.9844`, `payoff 9.375`
- A full **540×960 preview with the approved audio** rendered cleanly at commit `de3ca31`. It is local only and was never committed.
  - 900 frames, 60 fps, 15.000 s
  - AAC 44.1 kHz stereo; mean −18.3 dB, peak −1.7 dB
- Render cost reduced:
  - Draw calls went from 357 to 61 through instancing and baked static parts (`src/v12/instancing.tsx`).
  - The post chain now shades at device resolution, so previews really render at 540×960.
  - Software WebGL cost: about 1.4 s per frame at half scale and about 3.5 s per frame at full scale.

**Not yet done or unverified (your work):**

- The full-resolution master, the poster, `verify.ts --film v12`, the three-cycle loop file and the checksums have **never been produced for V12**.
- The `verify.ts --film v12` path has not run end to end. Its V12-specific thresholds (§6) are untested.
- The firefly clamp (`HDR_MAX = 6` in `src/v12/Stage.tsx`) was checked on frames 0, 520 and 572 only. The existing preview predates it, so render a fresh preview first (§4, step 1).
- The planned four-lens independent review (mechanism, music sync, loop seam, phone viewing) did not run because its agents hit a usage limit. The only creative review so far is the author's own inspection.

## 3. Required assets and environment

- **The approved WAV** (never committed; git-ignores `public/audio/*`):
  - path: `promo/ignition-002/public/audio/ignition-002-second-wind.wav`
  - SHA-256: `6938bf3b8efd90d9c9818dc20689b71e408d9d22be1cab7e01da597da22a80e1`
  - 44.1 kHz, 24-bit stereo, exactly 15.000 s (661,500 frames)
  - Get it from the project owner. Never re-encode, trim, normalise or regenerate it.
  - Check it with `sha256sum public/audio/ignition-002-second-wind.wav`.

  `render.ts` refuses to make a V12 master without this file: the film's `pictureOnlyAllowed` is `false`, because the brief forbids another silent final.
- **Node** ≥ 22.18 (runs `.ts` directly; this was built on 22.22.0).
- **ffmpeg/ffprobe** with libx264 and AAC (built with 6.1.1).
- `npm ci` in `promo/ignition-002`. Remotion is pinned to **4.0.534**, three to 0.185.1, @react-three/fiber to 9.7.0. Do not upgrade.
- **Chrome Headless Shell.** Remotion downloads it automatically. If the machine cannot download it, point Remotion at an existing build:
  `export REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell`
  (this container used `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`).
- **WebGL** runs in software (SwiftShader via `--gl=swangle`, set in `FILMS.v12.remotionFlags`), so it renders identically on any machine without a GPU. Keep it.
- **Disk:** about 1.5 GB free for the ProRes HQ mezzanine in `out/v12/work/`.

## 4. Commands

```bash
cd promo/ignition-002
npm ci
sha256sum public/audio/ignition-002-second-wind.wav   # must print 6938bf3b…a80e1
npm run check                                         # expect 32 pass, 0 fail

# 1. Preview, 540×960 with the approved audio (~25 min under software WebGL).
node scripts/render.ts preview --film v12
#    → out/v12/IGNITION-002-V12-OVERDRIVE-preview-540x960.mp4
#    Watch it once, especially bar 5 (6.6–9.4 s): there should be no grey haze (§7).

# 2. Master, 1080×1920 (~1 h under software WebGL): ProRes HQ mezzanine, two-pass x264,
#    AAC from the WAV, then the poster still at frame 572.
node scripts/render.ts master --film v12
#    → out/v12/IGNITION-002-V12-OVERDRIVE-15S.mp4
#    → out/v12/IGNITION-002-V12-OVERDRIVE-POSTER-1080x1920.png

# 3. Verification (renders 2–3 stills, builds the three-cycle file, writes the checksums).
node scripts/verify.ts --film v12
#    → out/v12/qa/verify.json, seam strip and phase screenshots in out/v12/qa/
#    → out/v12/qa/IGNITION-002-V12-OVERDRIVE-15S-loop-3x.mp4
#    → out/v12/SHA256SUMS.txt
```

`npm run render:master -- --film v12` and `npm run verify -- --film v12` are equivalent.
Without `--film`, the scripts operate on the V1 film. Do not run them that way.

If a frame times out (the default is 180 s per frame), rerun the same command. The render is deterministic.

## 5. Final export specification

The master is `out/v12/IGNITION-002-V12-OVERDRIVE-15S.mp4`:

- **Picture:**
  - H.264 High profile, level 4.2, yuv420p, BT.709, tv range
  - **1080×1920, 60 fps constant, exactly 900 frames, 15.000 s**
- **Sound:** AAC-LC stereo at 320 kb/s, muxed straight from the approved WAV. It starts at 0 and lasts 15.000 s.
- **Container:** MP4 with faststart (moov before mdat).
- **Size:** under 32 MiB (target video bitrate is 16 Mb/s, two-pass).
- **Loop:** the file plays as a seamless loop. Frame 899 → frame 0 is a downbeat.

## 6. Verification steps (what `verify.ts --film v12` checks)

Every line in `out/v12/qa/verify.json` must say `pass`.

**Technical:**
- codec, pixel format, 1080×1920, constant 60/1 fps
- exactly 900 frames
- video and file both 15.000 s
- under 32 MiB, faststart
- AAC stereo, 15.000 s, starting together with the picture

**Loop seam:**
- Virtual frame 900, rendered as frame 899 + 1/60 s, is identical to frame 0 (difference < 0.01).
- The 899 → 0 change is within the film's own 99th percentile of frame changes and comparable to the other bar-line downbeats.
- Motion continuity: the second difference at the seam stays within the 99th percentile.

**Audio:**
- The muxed AAC is cross-correlated with the approved WAV: **the offset must be 0 samples**. The SNR is reported.
- The WAV's own loop point has no click.

**Sync:** the picture in the V12 response region `[0.15, 0.28, 0.85, 0.78]` responds on the kick frame (median lag ≤ 1 frame).

**Safety:** at most 3 luminance flashes in any second, full frame and per quadrant.

**Copy:** IGNITION, SECOND WIND and DAEMONV12 sit inside the platform-safe box x 162–918, y 300–1460, measured on a copy-only still.

**By hand:**
- Play the three-cycle file twice on a phone-sized window and confirm there is no visible pop at 15 s or 30 s, in the camera, crank, glows, embers, titles or the sweep line under IGNITION.
- Confirm the music stays in sync by ear at the full stop (3.75 s), the re-ignition (3.98 s) and the payoff (9.375 s).

## 7. Known visual weaknesses (document; do not fix by redesign)

1. **Haze before the payoff.** Bar 5, frames ~500–565, low shot: spot-light glints on polished metal bloomed into a flat grey haze.
   - This is fixed at `0a615a7` by the firefly clamp, confirmed on frames 0, 520 and 572.
   - It is not yet confirmed across the whole film. The fresh preview (step 1) is the check.
   - If haze remains anywhere, report the frames. Lowering `HDR_MAX` to 3 removed it completely in testing, at the cost of slightly dimmer emissive glows. That trade-off is a human decision.
2. **FULL POWER side view, bars 3–4** (frames ~240–450, camera azimuth 50°): the engine overflows the frame horizontally and reads as a row of cylinders rather than a V. The V reads clearly in bars 1–2 and 7–8.
3. **Busy at phone size.** Many glints and glows compete with each other. Bloom lifts the blacks in the hottest moments. Titles are on screen throughout and overlap the headers in the low shots of bars 5–6.
4. **Unverified creative gate.** No independent reviewer has yet judged these quality-gate questions:
   - Does it immediately read as a V12?
   - Are all 12 pistons visible?
   - Is the payoff stronger than the opening?
   - Is it clear on a phone?

   The author's own view: yes for the V12 read in the front shots, for the coherent mechanism and for the music consequences; partly for phone clarity.
5. **Render speed.** Software WebGL makes a full-resolution frame take about 3.5 s. This is a cost, not a defect.

## 8. Deliverables

All under `promo/ignition-002/out/v12/` (git-ignored; never commit video, `out/` or the WAV):

- `IGNITION-002-V12-OVERDRIVE-15S.mp4`: the master, with audio
- `IGNITION-002-V12-OVERDRIVE-POSTER-1080x1920.png`: frame 572, just after the payoff
- `IGNITION-002-V12-OVERDRIVE-preview-540x960.mp4`: the preview, with audio
- `qa/IGNITION-002-V12-OVERDRIVE-15S-loop-3x.mp4`: the three-cycle loop test
- `qa/verify.json`, plus the seam strip and phase screenshots in `qa/`
- `SHA256SUMS.txt`: checksums of the delivered files
- A short technical verification report (a Markdown summary of `verify.json`, the by-hand checks and the open weaknesses from §7)
- Editable source: this branch at the commit you rendered from

Keep everything private. If a private Google Drive folder is available, upload the deliverables there and confirm each file downloads back with a matching SHA-256. It was not available in the build environment. Do not publish, post or merge.

## 9. Acceptance criteria

The handoff is complete when all of these hold:

1. `npm run check` passes on the rendered commit (32/32).
2. The WAV on disk matches `6938bf3b8efd90d9c9818dc20689b71e408d9d22be1cab7e01da597da22a80e1`, and `sync.json` references the same hash.
3. The master meets §5 exactly: 1080×1920, 60 fps, 900 frames, 15.000 s, AAC stereo from the approved WAV, faststart, under 32 MiB.
4. Every check in `out/v12/qa/verify.json` passes, including virtual frame 900 = frame 0 and an audio offset of 0 samples.
5. The three-cycle file plays 2,700 frames with no visible or audible seam.
6. All deliverables in §8 exist and their checksums are recorded.
7. A short report lists the results and any §7 weaknesses still visible. Delivery then stops for human review.

## If something fails

- **Pipeline or environment failure** (browser, ffmpeg, timeouts, disk): fix the environment and rerun. Changes to the scripts are acceptable only if they leave the picture unchanged.
- **A `verify.ts` check fails:**
  - Do not loosen a threshold or edit the film to pass it.
  - Record the failing line and its numbers in the report.
  - If the failure is in the check itself (for example, a V12 copy row band in `scripts/lib/deliverables.ts` that misses a title), fix the check and say so in the report.
- **A visual issue that needs design work:** document it with frame numbers and stop. The design is frozen for human review.
