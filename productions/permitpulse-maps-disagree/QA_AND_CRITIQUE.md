# Audio QA, version log and self-critique

Evidence types are kept separate. **Measured** means DaemonV12 analysis, FFmpeg or the
section-review helper. **Score inspection** means reading the generated project.
**Proxy** means a stand-in for listening, such as a band-limited "phone" filter.
**No human listening, phone, car or headphone test has been done.** The composer
(an AI agent) cannot hear the audio. Every musical judgment below is inferred from the
score, spectrograms, stem envelopes and measurements, and needs a human listen.

## Delivery QA (V3)

| Check | Result |
|---|---|
| Duration | Engine master exactly 1,234,800 frames @ 44.1 kHz; delivery exactly 1,344,000 frames @ 48 kHz = **28.000 s**. All 12 stems identical length, starting at frame 0 |
| Format | Delivery `pcm_s24le` 48 kHz stereo; engine canonical PCM16 44.1 kHz (engine limit; 24-bit is a container conversion) |
| Loudness | −15.74 LUFS (engine), **−15.6 LUFS** (48k/24); LRA 5.1–5.4 LU |
| True peak | −1.48 dBTP (engine); **−1.5 dBTP** (48k/24, FFmpeg ebur128 true peak); sample peak −1.51 dBFS |
| Clipping | 0 clipped samples on every track and on the master (manifest overload counters); 0 full-scale samples |
| Distortion | No track runs into overload; the hottest track pre-clip peak is −2.19 dBFS (pulse, by design, with soft `tanh` saturation) |
| Clicks | Boundaries: first sample 0 (engine) / −71 dBFS (48k resampler); last 50 ms below −48 dBFS, last sample −63 dBFS. The only high-slope events are designed transients (paper snap, bell, glint at the cut). At 13.667 every pre-cut voice is gated with an 8–12 ms release, and the heartbeat leak found in QA was fixed |
| DC offset | −66 dBFS (negligible) |
| Mono | L/R correlation 0.90 overall (0.72–0.95 per section); mono fold-down RMS only −0.22 dB below stereo, so no cancellation. Stereo samples share phases between channels by design |
| Bass translation | Sub band leads the glass motif's band by 3.8 dB in the hook (V1: 10.7 dB). The heartbeat carries saturated harmonics above 150 Hz. Phone proxy below |
| Sync | All 19 sync events land on their exact engine sample frames (0.000 ms error; the internal tempo-plateau point is within 0.18 ms). 30 fps proxy cuts at frames 410/522/543/630/645/708/714 match the score's frames |
| Determinism | Second render of the frozen V3 project into a fresh directory: master and all 12 stems **byte-identical** (master SHA-256 `e3461851ae9a9f6fdd560b1a3e18ca429fc78bb0cdd1e97b3f9a3357947741c1`) |
| Tails | Fades from 26.6 s; nothing overhangs 28.000; reverb and delay tails are cropped inside a container that has already faded to −60 dB |

### Section evidence (V3 master, measured)

| Section | RMS dBFS | sub | low-mid | mid | upper-mid | corr | phone-proxy RMS |
|---|---|---|---|---|---|---|---|
| hook 0–1.6 | −16.5 | −18.5 | −27.0 | −22.3 | −42.7 | 0.95 | −22.7 |
| confidence 1.6–5.5 | −16.4 | −18.0 | −23.9 | −25.1 | −42.0 | 0.94 | −24.7 |
| disagree 6.8–9.0 | −15.0 | −16.4 | −24.6 | −23.0 | −40.2 | 0.94 | −23.1 |
| camera 11.0–13.667 | **−14.4** | −16.1 | −22.9 | −21.9 | −37.1 | 0.92 | −21.7 |
| evidence cut 13.667–15 | −17.0 | −21.0 | −30.4 | −19.6 | −45.0 | 0.83 | −20.4 |
| brief 15–17.4 | −19.8 | −21.9 | −26.3 | −27.9 | −43.7 | 0.73 | −27.8 |
| card/verify 17.4–21 | −18.8 | −21.2 | −25.9 | −25.4 | −48.6 | 0.84 | −25.8 |
| NEVER GUESS 21–23.6 | **−14.8** | −16.7 | −24.0 | −21.4 | −39.4 | 0.90 | −21.7 |
| CTA 23.6–26 | −16.2 | −17.6 | −24.0 | −25.9 | −40.2 | 0.87 | −25.7 |
| tail 26–28 | −22.2 | −23.2 | −31.0 | −34.7 | −55.7 | 0.85 | −34.5 |

The phone proxy is a 280 Hz 4th-order high-pass, a 9 kHz low-pass and a mono fold-down.
It is a crude stand-in, not a phone. Through it the hook is carried by the glass motif
(glass stem −22.2 against master −22.7), and the heartbeat survives about 9 dB lower as harmonics.

## Version log

### V1: first complete render

−16.93 LUFS, −3.48 dBTP. Complete arc, every cue in place, 11 tracks, 241 events.
The first attempt failed validation on the engine's 1-billion-tap interpolation budget
because the pad was repitched to D3. Multi-sampling the pad, bass and heartbeat per
pitch (rate 1 costs nothing) fixed it before rendering.

**Three weaknesses (measured and score inspection):**
1. **No build into the cut.** Camera section RMS −15.2 dB against the hook's −15.7.
   The escapement ticks integrated to −51 LUFS (inaudible), so the "machine" never arrived.
   *Cause:* a constant bass bed and heartbeat dominated every section; percussion was too quiet.
2. **Bass-heavy, dull translation.** The sub band sat 7–11 dB above the glass motif's band in
   every section, and upper-mids reached only −46 dB. On a small speaker most of the energy disappears.
3. **The brand was not an arrival.** NEVER GUESS measured −16.4 dB RMS against the hook's −15.7,
   with the same width (corr 0.96). A sustained bass ran unbroken from 0 to 21 s, so the low
   end never breathed.

### V2: structural revision

−18.22 LUFS (master gain deliberately left low), −4.11 dBTP. Changes: the hook's low end
is the heartbeat alone and the bass ground enters when Map A seats (3.1). The camera
move gets an 8th-note analog bass ostinato that alternates the two grounds (per beat, then
per eighth, then 16ths). The evidence cut has no bass at all. Ticks are +5–6 dB with a
crescendo, and Map B's ratchet switches to triplets for the last two beats. A and B are
panned apart (−0.25 / +0.25). The brand gets a 7-voice D 6/9 and +2.5 dB pad.
Rebalance: bass −3, pulse −3, glass +2.5, bell +2.
*Result (relative to hook):* camera +2.3 dB, brand +1.4 dB, brief −3.5 dB; mid band now above
low-mid in the hook; width rose (corr 0.73–0.95).

**Three weaknesses:**
1. **The 6.8 clash arrived softly.** Map B's chord bloomed over 0.55 s, so the harmonic
   contradiction trailed the picture.
2. **Little presence above 2 kHz.** Upper-mids sat 15–20 dB below the low-mids; picture hits
   had no small-speaker definition.
3. **The brand was still slightly smaller than the camera climax** (−17.7 against −16.8), and the
   master sat at −18.2 LUFS.

### V3: production master

Changes: Map B sounds its F under its first note (the F/F# contradiction is
immediate at 6.800), and its chord starts past the bloom. An original *glint*
(D7/A7 crystalline accent; F/C at the disagreement) marks each picture hit. Glass and
bell are +1.5 dB from the brand cut, with the bell octave above GUESS raised. Mix pass:
where both heartbeats coincide, Map B's yields; the duplicated ratchet hit at beat 16
was removed; the bell is −2 dB at the cut and ticks +3 dB (phone proxy balance); master +6 dB.
**QA fix:** Map B's last heartbeat (13.5 s) rang about 1 s past the evidence cut at −27 dB;
the doubt-section heartbeats are now gated on the cut (after the cut the pulse stem reads −106 dB).

*Result:* −15.74 LUFS, −1.48 dBTP. Camera (−14.4) and NEVER GUESS (−14.8) are the two
peaks, the brief (−19.8) the valley. The cut is a texture change (mid band up, sub down,
lowMid −7.5 dB), not a loudness hit.

## Review steps (Composer skill 10–17)

- **Opening continuity.** The first second is deliberate: heartbeat + glass D–E–A + sub + glint,
  sample-aligned to frame 0, with the title's appearance (0.2) on the second note. Within three
  seconds the identity is complete: the unit landing (1.6) adds F# on beat 3 and the motif ends.
  By five seconds the same motif is restated with harmony when Map A seats (3.1/3.2), so the
  opening is the motif's first use, not a pasted logo.
- **Impact test.** The 6.8 arrival changes harmony (D → Bb ground), rhythm (off-beat entry,
  3 against 4), timbre (glass → metal) and colour (F against F#), without a volume jump
  (disagree RMS −15.0 against confidence −16.4). The cut trades density for clarity.
  NEVER GUESS follows 0.5 s of near-silence below the bass, so the low end, the widest chord
  and the motif's long note all arrive together.
- **Final 3 seconds.** The D 6/9 decays under a dB-linear fade; one distant lub-dub at 25.6.
  Replay check: the ending's heartbeat and tonic lead naturally into frame 0's heartbeat on D.
- **Translation proxy.** Mono-safe (see QA). Identity survives the band-limit through the glass motif.
  Width comes from different content (A left, B right, decorrelated pad and reverbs), not from
  phase tricks.
- **Risk pass.** *Proposal:* a "held breath" that stops all pre-cut material a 16th early
  (13.500) so the picture cut lands on silence. *Upside:* a more startling cut. *Downside:* at
  60 fps the music would stop 10 frames before the picture, which reads as a sync slip on the moment
  the brief singles out, and it truncates the F/F# trill that motivates the cut. *Decision:* not
  adopted, and not rendered; the synchronous hard stop already gives the contrast.
  A human A/B listen would be the only real evidence either way.
- **Stop decision.** V2 and V3 were each material improvements by measurement. Remaining ideas
  (below) need human listening to justify another version, so the score is locked at V3
  within the Composer skill's five-version budget.

## Honest self-critique (what a human should check first)

1. **Nobody has listened to it.** The arc, sync and translation are verified by
   measurement. Whether the motif is truly memorable, the glass is beautiful
   rather than synthetic, and the camera section thrilling rather than busy are
   open questions.
2. **Warm and dark by design, perhaps too dark.** Upper-mids (2–6 kHz) sit 15–20 dB below
   the low-mids, and the "air" band is almost empty. On bright systems this may read as soft
   rather than crisp. A brighter strike variant of the glass would be the cheapest fix.
3. **On phones the evidence-cut bell is the loudest moment** (proxy −20.4 against −21.7 for the
   brand), because the brand's extra weight lives below 280 Hz. If the brand must dominate on
   phones, raise the bell's octave at 21.5 or add upper partials to the brand chord.
4. **Motif density.** About 12 statements of D–E–A in 28 s, including a canon under the camera move.
   It is consequential repetition by design, but fatigue is a real risk; dropping the first
   canon pair (9.6 s glass, 10.3 s metal) is the first cut to try.
5. **The pad is almost always present** (3.2 s → end, with one breath at 21.0–21.5). The harmony keeps
   moving, but some listeners will hear a bed under the research brief.
6. **The proxy contains storyboard holds** (unit landing, plate seating and the amber trace animation are
   not animated in it). Hits at 1.600, 3.100 and 7.5–9.0 follow the brief's timestamps; when
   the 60 fps final exists, confirm the actual contact frames. Each is a one-line `CUES` edit.
7. **Engine limits disclosed.** DaemonV12 renders 44.1 kHz / 16-bit with no limiter or EQ.
   The 48 kHz / 24-bit master is a resampled container, not a higher-resolution render.
   Peak control comes from gain staging plus a gentle 2:1 master compressor.
8. **Originality.** Composed from scratch with no reference track or derivative material, and every
   sound synthesized in-repo. No formal similarity search has been run.
