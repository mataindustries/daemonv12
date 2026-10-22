# CABLE//BEAST production log (DaemonV12 Composer workflow)

**I could not listen.** The audio was perceived by nobody during production. The evidence below
falls into four kinds:
- **Human feedback:** supplied from MORPH//04.
- **Measurements:** `checks.py`, MORPH//03 `analyze.py`, spectrograms.
- **Score readings.**
- **Design intentions.**

Measurements locate faults and contrasts; they do not prove that a hook is memorable or that
a payoff feels big. Human listening is the authority.

- **Brief:** MORPH//05. A 28 s, 14-bar, 120 BPM record from the approved hybrid direction,
  for replay and a future synchronized film (60 fps).
- **Engine:** DaemonV12 0.7.0, branch `feat/morph-05-first-record` from
  `34e694f0c87a1bb3390ae868411a150f0d104f2f`. The engine is unchanged.
- **Composer:** `plugins/daemonv12-composer` (workflow and review principles).
- **Tools:**
  - Node v22.22.0, FFmpeg 6.1.1, Python 3.13 with numpy 2.5.3 and scipy 1.18.1.
  - No SoundFont: the sampler route needs none.
  - `doctor` reports FluidSynth missing, which is unused here.
- **Palette** (all original physical models, no third-party samples):
  - **Cable:** MORPH//03 Tempo String.
  - **Beast:** MORPH//03 Wobble Beast.
  - **Drums:** MORPH//04 membrane kick and snare, cable toms and ticks; MORPH//02 B's toaster
    spring, alarm bells and press clank.
- **Paths:** `audio/v1`, `audio/v2`, `audio/v3`; hashes are in `MANIFEST.json`.

## Musical thesis

- **Hook:** the CABLE CALL. SLAP (tension dive) · ghost · octave POP · G "ow", answered by
  F~E.
- **Rhythmic identity:** HEAVY's half-time weight; BREAKS' cable-clocked time for mutations
  and transitions.
- **Low end:** the cable's E1. The kick lands on slaps or in the gaps, and the subs duck
  under it.
- **Contrast:** exposed call, heavy groove, break, conversation, choke and a sung solo, payoff.
- **Payoff:** the two voices that answered each other share the hook, then play it in unison.
- **Ending:** the hook is cut off by the snap; reflections lead back to the opening slap.

## V1: the complete arc

The whole piece was rendered before any polishing (`v1.mjs`). Three weaknesses, from that
render:

**1. Unplanned silences at 7.5–7.75 s and 18.6–19.0 s.**
- **Evidence:** black gaps in the spectrogram; the envelope falls to −50 dB at 7.7 s. The choke
  (17.07–17.5 s) is the only silence the score intends.
- **Cause:** the Beast's first answer ends at 7.5 s, and the cable's run starts only at
  7.75 s. The solo ends at 18.6 s, and wind-up 2 starts at 19.0 s.
- **Intended change:** fill both with material that belongs to the transition.

**2. The payoff is no bigger than the first groove, and the Beast is buried in it.**
- **Evidence:**
  - Payoff (20–24 s) level is −13.9, against −13.2 for Heavy (4–6.5 s).
  - The Beast's unison WOM sits 14 dB under everything else.
  - Its wound-up "aah" sits 22 dB under.
- **Cause:** the cable and drums occupy the Beast's band, and nothing new arrives at the
  payoff.
- **Intended change:** give the Beast the lead, add width and a third, compressed
  transition before the unison.

**3. The Beast's solo is mostly sub.**
- **Evidence:** 82.5% of the solo's energy is below 120 Hz, with 4% at 500 Hz–2 kHz.
- **Cause:** the bowed source's sub is louder than the mouth.
- **Intended change:** take the sub down and bring the mouth up so the vowels carry the hook.

## V2: musical improvement

Edits in `v2.mjs` (`CHANGES`):
- **Bar 4 pickup:** break snare ghosts and a clank at 7.5–8 s.
- **Solo ending:** the solo's last note collapses into creak (the Beast's pitch slackens),
  and the creak is wound back into pitch with the cable at 19 s.
- **Rides:** the Beast solo sheds 6 dB of sub and gains 3 dB of mouth; the Beast is +4 to +6
  dB through the payoff.
- **Payoff:** the partner cable chirps 3 against 4 on the right.
- **Wind-up 3:** bar 12's run becomes a one-beat snap-and-wind with a drum ratchet.

**Results against V1:**
- The gaps are gone.
- The solo's sub share fell from 82.5% to 22.4%, and its 500 Hz–2 kHz share rose from 4% to 20%.
- The Beast came up: unison WOM from −14 to −6.9 dB; the wound-up "aah" from −22 to −5.9 dB.
- Payoff width (side vs mid, 20–26 s) went from −16.5 to −14.3 dB.

All kept. Three weaknesses, from V2's render:

**1. Beast bursts drive the master clip.**
- **Evidence:** the master soft clip reached 7.05 dB (V1 4.24) and the limiter 2.47 dB. The
  peaks are the Beast alone at 20.76 s and 24.38 s, 23 dB above its voice's RMS.
- **Cause:** "ka" → vowel releases. The physical throat's velar closure builds pressure and
  bursts.

**2. The payoff downbeat and the unison hook are masked.**
- **Evidence:** the slap at 20.0 s is only −1.7 dB over the rest in its band. In unison the
  Beast covers the cable's pop (−4.8 dB) and "ow" (−3.0 dB).
- **Cause:** the clank, the ratchet's tail and the Beast's wound-up voice all sit on the
  downbeat.

**3. The energy arc peaks in the wrong place.**
- **Evidence:**
  - Wind-up 1 (−11.8) is louder than the payoff (−14.0).
  - The break (−16.8) sags after the Beast's answer.
  - The first second is 88% sub (−4.0 LU on the phone model).

## V3: production refinement

Edits in `v3.mjs` (`CHANGES`):
- **Beast bursts:** soft-limited to 14 dB above its voice.
- **Beast yields to the cable:** −10 dB for 30 ms at every cable onset. Its wound-up voice
  lets go a 32nd before the payoff slap.
- **Payoff downbeat:** the ratchet ends on the downbeat, the clank is removed, and bells
  ring a 16th after the payoff and unison downbeats.
- **Balance:**
  - The bowed talk in wind-up 1 is −3 dB.
  - The slack chirps in the break are +3 dB, and break and payoff drums ride up.
  - The Beast sits wider (two mouths 9 ms apart) and 2 dB lower.
  - The solo returns to 0 dB so the negative space stays intimate.
- **Opening:** the cable alone; its upper band is +3 dB in bar 1.
- **Ticks:** an 8-sample round-robin, so the DaemonV12 sampler can reproduce them.
- **Ending:** a longer decay.

**Results against V2:**
- **Clipping:** soft clip 7.05 → 2.97 dB (active on 0.20% of samples); limiter 2.47 → 1.37 dB.
- **Payoff downbeat slap:** −1.7 → −0.7 dB. It remains the worst unique articulation, sharing
  its onset with the kick's beater.
- **Unison pop:** −4.8 dB → no longer among the worst four.
- **Phone-model drop:** V1 −4.0 → V3 −3.15 LU.
- **First second at 500 Hz–2 kHz:** 4.4% → 7.8%.
- **Solo-to-payoff climb:** about 5 dB (solo −17.2, payoff −12.8 over 20–26 s).

### Status

| | V1 | V2 | V3 |
|---|---:|---:|---:|
| Integrated loudness / true peak | −14.0 LUFS / −1.4 dBTP | −14.1 / −1.4 | −14.0 / −1.4 |
| Peak-to-loudness / loudness range | 12.6 dB / 3.9 LU | 12.7 / 4.1 | 12.6 / 3.1 |
| Master soft clip max / limiter max | 4.24 / 1.57 dB | 7.05 / 2.47 | 2.97 / 1.37 |
| Phone-speaker drop (HP 300 Hz) | −4.0 LU | −3.7 | −3.15 |
| Mono fold-down loss (low / mid / high) | 0.00 / 0.33 / 0.35 dB | 0.00 / 0.39 / 0.38 | 0.01 / 0.64 / 0.60 |
| Kick over bass sub, 50 ms (median / min) | 18.1 / 6.7 dB | 18.3 / 6.8 | 18.4 / 6.8 |
| Cable onsets over the rest, 300 Hz–4 kHz (median / min) | 22.7 / −1.2 dB | 14.3 / −4.8 | 16.7 / −2.3 |
| Drum crest lost in mastering (median / max) | −0.3 / 1.9 dB | −0.2 / 1.9 | −0.1 / 1.5 |
| Infrasound < 20 Hz | 0.0007% | 0.005% | 0.005% |

- **Technical state:**
  - Exact length: 1,234,800 frames. No clipped samples; true peak −1.4 dBTP.
  - The only intended silence is the choke: −76 dBFS (pre-master) from 17.07 to 17.3 s, then
    the Beast's inhale (−43 dBFS) before its solo.
  - Event frames match DaemonV12's `ticksToFrames` (341 on-grid events, 0 mismatches).
- **Remaining concerns:**
  - **Unison downbeat:** the Beast's WOM measures 5.6 dB under the cable and kick in the first
    120 ms. That is the price of the yield: the cable leads every onset.
  - **Macro dynamics:** LRA is lower than V1's (3.1 vs 3.9 LU). V3 contrasts sections more by
    texture (a solo with 13% sub and very wide; a 41 Hz tone; the choke) than by level.
  - **Ticks:** they sit about 15 dB under the snare in the payoff. That is my reading of "fast
    hats", and they may want more.

## Opening continuity (V3)

- **First 1 second:** a deliberate impression. The cable alone plays SLAP (with its dive and
  zap) · ghost · POP · "ow"; 500 Hz–2 kHz is 7.8% and phone drop −2.4 LU (V1: 4.4%, −4.0).
  - **Uncertainty:** without a kick under it, the very first slap might feel light on big
    systems.
- **First 3 seconds:** identity. The hook, the cable letting go (1.5 s) and the hook again with
  kick and ticks; 500 Hz–2 kHz is 25.6%.
- **First 5 seconds:** continuity. The groove at 4.0 s keeps the hook's rhythm and tempo, so
  the opening's promise is honoured, now in half time.

## Impact test (V3)

**Approach (wind-up 2, 19–20 s) → arrival (payoff, 20–23.5 s) → unison (24–26 s):**
- **Low end:** sub share 48% → 62% → 44%. The kick and the slap return together.
- **Attacks:** 2.0 → 5.7 → 4.0 onsets per second. The approach is a ratchet becoming a tone;
  the arrival has discrete hits.
- **Register:** the approach is mid-heavy (the Beast's growl, 35% at 500 Hz–2 kHz); the arrival
  spreads across all bands.
- **Stereo:** side vs mid −9.9 → −10.7 → −12.3 dB. The payoff is not wider than its own
  approach, because the wound-up Beast is already wide. Against Heavy (−19.3 dB) it is much
  wider.
- **Negative space:** the Beast lets go a 32nd before the payoff slap.
- **Consequence:** the hook changes owner (hocket), then becomes one voice (unison). That is a
  transformation, not added layers.

**Payoff against the first groove:** −13.3 vs −13.9 (level), −10.7 vs −19.3 dB (side vs mid),
with new material: the Beast, a second cable, toms, bells and spring.

## Final 3 seconds (V3)

- **25–26 s:** the unison hook ends with its 32nd run.
- **26.0 s:** the hook starts again with cable and Beast together.
- **26.5 s:** SNAP. A big snare with the cable crack inside it; the break, repeated once per
  round trip of the releasing cable, slows from 24 ms to 144 ms.
- **27.0 and 27.5 s:** quarter-note reflections, panned against a second cable.
- **Tail:** the last 50 ms before the boundary sit at −40 dB. A 40 ms fade guarantees a
  click-free edge; the music's last event is the 27.5 s reflection.
- **Ending to opening:** −32 dB (last 0.5 s) → −13.8 dB (first 0.5 s, the opening slap), a
  deliberate re-entry. The cut-off hook completes on replay.

## Translation robustness (proxies)

- **Headphones (depth):**
  - Side vs mid ranges from −19 dB (Heavy) to −5.7 dB (solo), by section.
  - The rooms sit 13–24 dB under the mix.
  - The width comes from different left/right content (two cables, two Beast mouths 9 ms
    apart, alternating ticks), not only from panning.
- **Car (crude cabin model, +8 dB shelf under 70 Hz):** the whole record gains only +0.9 LU,
  and sections gain −0.2 to +1.6 LU, so the low end is not overblown. The kick stays
  18.4 dB over the bass sub at its onsets (median).
- **Small speakers:** with nothing below 300 Hz, the record loses 3.15 LU. The hook's
  identity is in the 500 Hz–2 kHz band (zaps, pops, vowels).
- **Mono:** fold-down costs at most 0.64 dB (500 Hz–2 kHz band); the low end is mono.
- **Limits:** these are filters and band sums, not devices. Car, phone and headphone listening
  remain the judge.

## Risk Pass (proposed, not rendered)

| | |
|---|---|
| **Risk** | A micro-choke before the payoff: everything (wound-up tone, Beast, drums) stops for one 16th at 19.875 s, and the payoff slap lands on time at 20.0 s. It reuses the approved choke at a tenth of the length, as a gasp before the arrival. |
| **Upside** | Negative space immediately before impact. The payoff could feel larger without any added level. |
| **Downside** | It could cut the "pulled into pitch" sensation of wind-up 2 short, or sound like an edit. |
| **Cheapest test** | One score edit (a hole at 159–160 steps; the Beast's wind ends at 159) and one render, comparing the arrival's crest and the approach-to-arrival contrast with V3. |
| **Decision** | Left for the human checkpoint as the candidate "final creative pass". V3 stands without it. |

## Stop decision

- **Status:** V3 is the lock candidate.
- **Musical checks:** thesis legible in the score; intentional opening; the hook recurs in
  eleven guises; payoff transformed; ending leads to replay.
- **Technical checks:** no defects found by the checks.
- **Last two revisions:** both changed measured problems materially. V2 changed the music; V3
  changed dynamics and separation.
- **Beyond V3:** only the Risk Pass, which is speculative without ears. Stopping at the
  checkpoint as asked.

## Determinism

- **External render:**
  - V3 rendered twice into fresh directories: master WAV and all 14 FLAC stem files
    byte-identical.
  - V1 and V2 re-rendered to the same master hashes. V1's hash has not changed since its
    first render.
  - V2's final render differs from its first draft only by the change to linear-dB ride
    curves, made for DaemonV12 compatibility. Its analysis here is from the final render.
- **DaemonV12 project:** rendered twice; master and 13 stems byte-identical.
- **Hashes:** everything is in `MANIFEST.json`, which `manifest.mjs` regenerates.
