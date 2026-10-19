# IGNITION 002 — THE INFINITE REACTOR: quality report

Render of 2026-10-19 · Remotion 4.0.534 · `node scripts/verify.ts` (evidence in `out/qa/`, not committed)

## Status: picture finished, music not yet attached

- **Audio not fetched.** The approved WAV (SHA-256 `6938bf3b…a80e1`) is on Google Drive. This
  build environment's network policy refused `drive.google.com`, `docs.google.com` and
  `drive.usercontent.google.com`, and the Google Drive connector was not connected. The approved
  audio could therefore not be fetched, analysed or muxed.
- **Placeholder sync data.** The picture is driven by the labelled 128 BPM grid placeholder
  (`src/sync/sync.json`, `"source": "grid"`), not by the track's measured hits. No substitute
  audio was made.
- **Picture-only master.** The rendered file is
  `IGNITION-002-INFINITE-REACTOR-15S-1080x1920.PICTURE-ONLY.mp4`. The final deliverable name is
  reserved for the version with the music.
- **No Drive upload.** Nothing was uploaded to Google Drive, for the same reason.

To finish, put the WAV in `public/audio/`, then run `npm run analyze && npm run render:master && npm run verify`.
That analyses the real transients, re-renders the picture against them, encodes AAC once from the
WAV, and runs the audio checks (offset, AAC fidelity, loop click). These checks are listed below
as **not run**.

## Measured (picture-only master)

| Check | Result |
|---|---|
| Codec / profile / pixel format | H.264 High, yuv420p, BT.709 tags |
| Resolution / frame rate | 1080×1920, 60/1 constant |
| Frames / duration | 900 frames, video 15.000000 s, file 15.000000 s |
| Size / bitrate | 28.87 MiB, 16.1 Mb/s (two-pass x264 from a ProRes HQ mezzanine) |
| Faststart | top-level boxes `ftyp moov free mdat` |
| Virtual frame 900 vs frame 0 | Frame 899 rendered at +1/60 s against frame 0: mean \|Δ\| = 0.0000 luma levels (identical) |
| Seam 899 → 0, decoded | Mean \|Δ\| 5.15 levels. Film median 1.29, p99 5.38, max 6.36. The other seven bar-line downbeats: 3.07–6.36. The loop point is a downbeat and changes like one. |
| Motion continuity at the seam | Second difference 5.43 / 5.78 at the seam frames; film median 1.82, p99 7.10 |
| Smooth drivers across the seam | Every spring, rotation, gimbal, clamp and drift sampled at 0.1 ms steps: no jump, no velocity kink (`tests/loop.test.ts`) |
| Three-cycle file | `IGNITION-002-loop-3x.mp4`: 2,700 frames, 45.000 s |
| Flashing | 0 flashes (≥ 10 % luminance rise and fall) in the full frame, each quadrant and the centre. Largest frame-to-frame mean-luma step: 5.4 levels (quadrants), 14.2 (centre). Mean luma ≈ 32/255. |
| Copy inside the platform-safe box (x 162–918, y 300–1460) | IGNITION x 176–903, y 337–415 · SECOND WIND x 188–891, y 474–505 · DAEMONV12 x 325–733, y 1420–1449 |
| Copy size | IGNITION 112 px, SECOND WIND 44 px, DAEMONV12 40 px |
| Visual response to driving hits | Core brightens on the hit frame for 32/32 kicks (median lag 0 frames). The hits are the grid placeholder, so this shows the picture follows its driver. It does not show sync with the track. |
| Unit tests | 19/19: loop continuity, motion primitives, analyser on a synthetic loop with known unequal hits, isolation |

**Not run (they need the approved WAV):**

- AAC stereo track present and 15.000 s;
- the muxed audio's offset against the WAV, which must be 0 samples;
- AAC fidelity;
- the WAV's own loop-point click check;
- real-transient analysis, and hence the actual music-to-picture sync;
- uploading to Google Drive.

## Checksums (SHA-256, this render)

```
bd76d76c5523bb11e0b74a96547915d1c2d41db3974706d0043720641498c548  IGNITION-002-INFINITE-REACTOR-15S-1080x1920.PICTURE-ONLY.mp4
b3c0a4a44d5229cd0d41fefb9112fa886ed8a5fdf53f3924cfb799389ec15987  IGNITION-002-INFINITE-REACTOR-POSTER-1080x1920.png
928ac920fcfef1f498285e12c61ff36153ee9946d25d9a4676362666050d6e7b  IGNITION-002-loop-3x.mp4
```

These change when the master is re-rendered with the music.

## Process

1. **First preview.** It showed four weaknesses: the lower third went dead, bars 1–4 were hard to
   tell apart, the core saturated into a white star in OPEN, and the rings read flat at t = 0.
2. **One improvement pass.** It made the following changes:
   - deeper base gimbal tilts, plus a visible gimbal opening in ACCELERATE;
   - a light ring down the tunnel on every kick, launched from behind the reactor so it ramps in;
   - brighter new pathways;
   - lower peak heat, glare and jets, with a higher bloom threshold;
   - a flatter camera pitch and a lighter lower vignette and scrim, so the tunnel floor reads.
3. **Final measurement fix.** Measuring the copy found IGNITION 6 px outside the safe box, so it
   went from 118 px to 112 px and the check was added to `verify.ts`.

## Acceptance questions

These are separated into what was measured and what needs a human.

1. **Is the first second visually unforgettable?**
   - Measured: frame 0 already shows the whole 3D mechanism in motion. Nothing fades or ramps in,
     and the first kick drives the core, the tunnel ring, the clamp LEDs and the ratchet.
   - *Whether it is unforgettable is a human judgement.*
2. **Does the motion feel inseparable from the music?**
   - **Not verified.** The picture follows the locked 128 BPM grid and the structure of the brief,
     but the track's real transients have not been analysed and the film has not been watched
     with the music.
   - The analyser is in place, tested on a synthetic loop, and the picture re-renders against its
     output with no code change.
3. **Does the core look like a complex mechanical system rather than a glowing circle?**
   - Measured by construction, there are independently moving parts:
     - a 32-plate stator that tilts and turns once;
     - a 64-tooth ratchet that ticks on kicks;
     - three counter-rotating segmented gyro rings on gimbals, which open, precess and close;
     - sixteen sliding clamps with LEDs;
     - a fixed housing, six mounts and a tunnel of bulkheads;
     - a plasma core with spinning filaments, dipole field lines and polar jets.
   - Everything is depth-sorted in true perspective and lit by the core. *The overall impression
     needs a human eye.*
4. **Does the payoff introduce a genuinely spectacular change?**
   - At 7.5 s all clamps slam back, a refraction shockwave rolls out, the stator tilts, the rings
     open into an armillary cage, jets erupt and the field expands by 1.6×. Bar 6 adds a 90°
     precession.
   - Visible in `phase-7.50s` and the poster. *Spectacle is subjective.*
5. **Are the graphics clear and attractive on an Android phone?**
   - **Not tested on a device.** Copy sizes and safe-box placement are measured above, and the
     H.264 High @ 4.2 / yuv420p / BT.709 file is phone-compatible.
   - Legibility under real platform overlays needs a device check.
6. **Does the video loop seamlessly, visually and musically?**
   - **Visually: verified** by the virtual-frame-900 identity, the decoded seam measurements, the
     continuity tests and the 3× file.
   - **Musically: not verified.** That needs the WAV.
7. **Is it compelling to watch three times consecutively?**
   - `IGNITION-002-loop-3x.mp4` exists for that review. *This is a human judgement, and best made
     with the music attached.*
