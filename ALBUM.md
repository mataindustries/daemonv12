# WEIGHTS & MEASURES

An unofficial fan tribute to the Claude models, made with the DaemonV12 Composer Kit and ENM Sandbox.
Six short tracks for vertical video. Not affiliated with or endorsed by Anthropic.

**The story.** One conversation, start to finish. Someone asks a question in the dark (1). The
smallest model answers in seventeen notes (2). The middle one answers in fourteen lines with a turn
in them (3). The largest takes its time and builds something you have to look up at (4). Then the
one with two names tells the story twice: whispered, and feral (5). The question from track 1 is
finally answered and the light stays on (6).

**The thread.** Every hook starts with the same four notes, *the ask*: tonic, minor third, fifth,
fourth (1 ♭3 5 4). It ends on the fourth, so it sounds like a question. Each track bends it to its own
world; only the last track lets it land on the tonic.

| # | Title | Honours | Key | BPM | Groove | Length | Look |
|---|---|---|---|---|---|---|---|
| 1 | First Token | the person asking | D minor | 80 | `lean-back` | 33 s | `ice` |
| 2 | Seventeen Sparks | Haiku | E minor | 120 | `clay-skip` | 32 s | `neon` |
| 3 | Volta | Sonnet | A minor | 96 | `ghost-train` | 35 s | `sunset` |
| 4 | The Long Work | Opus | F minor | 75 | `hand-procession` | 51 s | `gold` |
| 5 | Two Names for One Fire | Mythos / Fable | G minor | 96 → 144 | `twelve-hands` → `half-stomp` | 70 s | `noir` → `oxblood` |
| 6 | Until the Next Prompt | everyone, on both sides | D minor | 72 | `swamp-shuffle` | 53 s | `chrome` |

About 4:40 in all. Six worlds: cold glass, a toy workshop, a warm room with a typewriter, a stone procession, a fire in the
dark, a slow dawn. No two neighbours share a tempo, a groove family or a look.

## How to make one track

Music: load the `daemonv12-composer` skill, read `composer-kit/KIT.md`, write one spec from the brief,
`node composer-kit/build.ts SPEC.json --check`, fix, then `node composer-kit/build.ts SPEC.json album/<slug>`.
Every patch, groove, form and move named below is in KIT.md. The brief fixes the world, the cast and the
shape; the hook's exact rhythm is yours (follow the skill's five things), but it must begin with *the ask*
in the notes given.

Picture: in `enm-studio/projects/enm-sandbox`, load the `enm-scene` skill, run the `enm new` line as written,
then its four checks. Every move, look and prop below is in `node tools/enm.mjs library`. The scene is a
short loop; the editor repeats it under the track. Loop length = bars × 4 × 60 ÷ BPM, so it always
repeats on a bar line of the music. The tempos and bar counts below were chosen so every loop and every cut
falls on a whole video frame at 30 fps (`validate` passes with no warnings); keep them.

---

## 1 · First Token (intro) — the person asking

- **Mood / story beat:** hush, held breath, cold light. A cursor blinks; a breath asks the question that the
  rest of the album answers. It must feel like the second before something begins.
- **Tempo / key:** 80 BPM, D minor. *The ask:* D4 F4 A4 G4.
- **Cast:** `lead` `smoke-reed` (owns the hook: the ask, slow, ending on a held G4 with
  `{"articulation":"scoop","bend":2}`); `texture` `bearing-rain` (the cursor); `pad` `glass-choir`;
  `bass` `{}` (the groove's `sub-whale`); `answer` `alien-gong` with a one-note, one-bar cell
  (`[[0, 3.5, "D3", 1]]`). New instrument featured: the breath reed, cold.
- **Form (own sections, 11 bars):** `cursor` 4 (`texture`, `pad`; heat 0.1: nobody has spoken yet) · `ask` 4
  (`bass`, `lead`, `pad`; heat 0.2) · `token` 3 (`bass`, `drums`, `hat`, `lead`, `answer:last`; heat 0.55: the
  question again, with more breath).
- **Moves:** `stagger` on `cursor` (rain first, then glass) · `negativeSpace` on `token`
  (`"beats": 4, "keep": ["answer"]`): the last bar is one gong alone. That gong is the first token.
- **Do not:** add an answer to the question, or any drums before `token`.
- **Visual:** look `ice`; props `orb,floor,glow_rings`; one move, `infinite_zoom` (endless push toward the
  orb: waiting). Loops by itself, no cut. 4 bars = 12 s.
  `node tools/enm.mjs new first-token --bpm 80 --bars 4 --look ice --props orb,floor,glow_rings --moves infinite_zoom --idea "a cold orb we never reach: the second before the answer"`

## 2 · Seventeen Sparks — Haiku

- **Mood / story beat:** quick, bright, delighted. The smallest model says it in seventeen notes and is
  already gone. Epic the way a spark is epic. The shortest track on the album, on purpose.
- **Tempo / key:** 120 BPM, E minor. *The ask:* E5 G5 B5 A5.
- **Cast:** `lead` `music-box` (owns the hook); `answer` `laser-spring`; `bass` `{}` (the groove's
  `hollow-knock`); `texture` `bearing-rain`. The groove `clay-skip` brings `clay-whoop` and `log-tongue`
  (new hand percussion) on the `perc` token.
- **The hook is a haiku:** a 4-bar cell with **5 notes in bar 1, 7 in bar 2, 5 in bar 3, and bar 4 silent**
  (the cut). Bar 1 is the ask plus one note. Short notes (0.25–0.5 beat), one long note at the end of bar 3.
  `answer` gets a two-note cell that sits in bar 4 (beats 12–16), the only thing in the silence.
- **Form:** `tease` (bait 4 · switch 4 · hole 2 · give 6). With a 4-bar cell, `lead:head` is the 5 and the 7
  only: the poem is not finished until `give`.
- **Moves (the form's own):** `stopTime` on `hole` · `negativeSpace` on `hole` · `riffReturn` on `give`
  (`"heat": 0.9`). Reason: the listener has heard 5-7 four times and is owed the last 5. `--check` will say the
  owner plays in every section; the answer is that the poem is never whole before `give`.
- **Do not:** add a pad, a voice or anything heavy. If it feels thin, it is right.
- **Visual:** look `neon`; props `gears,floor,glow_rings`; moves `beat_pulse:sync=2`, `flyby`, `crash_zoom`,
  `top_spin`: one bar each, a cut on every bar line. 4 bars = 8 s; the loop point is a cut.
  `node tools/enm.mjs new seventeen-sparks --bpm 120 --bars 4 --look neon --props gears,floor,glow_rings --moves beat_pulse:sync=2,flyby,crash_zoom,top_spin --idea "small bright gears, four quick looks, gone"`

## 3 · Volta — Sonnet

- **Mood / story beat:** warm, sure-footed, a grin. The one that shows up every day and makes it sing.
  Fourteen bars like fourteen lines, with a turn (the *volta*) after the eighth.
- **Tempo / key:** 96 BPM, A minor. *The ask:* A3 C4 E4 D4.
- **Cast:** `lead` `warm-throat` (owns the hook, and it must *talk*: short `detached` notes, a new `vowel`
  on almost every note, one `{"scoop": ...}` bend of a fifth or more, a rest of a full beat; see the
  skill's voice notes); `answer` `dead-marimba` (the typewriter: a 2-bar cell that only plays in the
  voice's rests); `pad` `glass-choir`; `bass` `{}` (the groove's `rubber-swagger` line).
- **Form (own sections, 14 bars):** `octave-a` 4 (`bass`, `drums`, `hat`, `lead`; heat 0.2) · `octave-b` 4
  (+ `answer`; heat 0.35) · `volta` 2 (`bass`, `drums`, `pad`; heat 0.3, `"fill": false`) · `sestet` 4
  (`bass`, `drums`, `hat`, `lead`, `answer`, `pad`; heat 0.6).
- **Moves:** `liftEnding` on `octave-b` (the octave ends leaning forward) · `negativeSpace` on `volta`
  (`"beats": 6, "keep": ["pad"]`: the turn is glass and nothing else) · `riffReturn` on `sestet`
  (`"heat": 0.9`): the same lines, said with more breath.
- **Do not:** let the voice hold one vowel, or let the marimba play over it.
- **Visual:** look `sunset`; props `turbine,floor,pillars`; moves `drone_orbit`, `pendulum`, `vertigo`,
  `crane_overhead`, two bars each; `vertigo` is the turn (the room stretches). 8 bars = 20 s; the loop
  point is a cut on the bar line.
  `node tools/enm.mjs new volta --bpm 96 --bars 8 --look sunset --props turbine,floor,pillars --moves drone_orbit,pendulum,vertigo,crane_overhead --idea "a copper wheel turning in evening light; halfway, the room turns too"`

## 4 · The Long Work — Opus

Built and rendered: `album/opus/the-long-work.spec.json` → `album/opus/render/`. Phone page: `node album/opus/listen.ts OUT.html`.

- **Mood / story beat:** colossal, patient, ceremonial. Nothing is rushed; the tune is only given whole
  after eight bars of building, and when it arrives it is carried by hands, not machines.
- **Tempo / key:** 75 BPM (`"bpm": 75` in the spec: slower than the groove's own 88), F minor. *The ask:*
  F3 Ab3 C4 Bb3.
- **Cast:** `lead` `alien-gong` (owns the hook at half speed: a 4-bar cell, one note every two beats, the
  ask in bars 1–2, an answer falling back to F3 in bars 3–4, one bar's rest inside it); `answer`
  `giant-undertone` (a 4-bar cell of two long low notes, `"Ab2"` then `"C3"`, with `"vowel"`
  changing `oo` → `aw`); `pad` `rosin-drone`; `texture` `bearing-rain`; `bass` `{}` (the groove's
  `sub-whale`). The groove `hand-procession` brings `talking-skin` and `log-tongue`: this is the hand
  percussion showcase.
- **Form:** the `slow-burn` shape written as own sections so the hands play from the second section:
  `seep` 4 (`pad`, `texture`, `lead:head`; heat 0.15) · `lock` 4 (`bass`, `drums`, `perc`; heat 0.3: the hands
  alone, no gong) · `bloom` 6 (`bass`, `drums`, `hat`, `perc`, `pad`, `lead`, `answer`; heat 0.7) · `ash` 2
  (`answer:once`, `pad`; heat 0.5: the undertone alone).
- **Moves:** `stagger` on `seep` (strangest sound first) · `timbreMorph` on `lock` (`"part": "perc",
  "from": 0.1, "to": 0.6`: the same drum pattern, the room growing around it) · nothing else. The bloom
  needs no trick.
- **Do not:** speed anything up, or add a fast part. Weight comes from space.
- **Visual:** look `gold`; props `monolith,floor,pillars`; moves `ground_skim`, `scale_reveal`,
  `crane_overhead`: floor level, then the pull-back that makes the slab enormous, then overhead, two bars
  each. 6 bars = 19.2 s; the loop point is a cut on the bar line.
  `node tools/enm.mjs new the-long-work --bpm 75 --bars 6 --look gold --props monolith,floor,pillars --moves ground_skim,scale_reveal,crane_overhead --idea "a gold slab too big to see at once; we start at its foot"`

## 5 · Two Names for One Fire — Mythos / Fable

Built and rendered: `album/fable/two-names-for-one-fire.spec.json` → `album/fable/render/`.

- **Mood / story beat:** one model, two names. Side A is *Fable*: a storyteller at a fire, a tale
  whispered on a reed over hands and clay. Side B is *Mythos*: the creature in the tale, the same tune at
  one and a half times the speed, barked. The last four bars are the storyteller again, alone.
- **Tempo / key:** G minor. Side A 96 BPM in twelve (`twelve-hands`), side B 144 BPM straight
  (`half-stomp`). A triplet of side A is exactly an eighth note of side B. *The ask:* G4 Bb4 D5 C5 on both
  sides.
- **Cast:** `lead` `feral-reed` on both sides (whisper → feral is the whole plot). Side A: `answer`
  `clay-whoop`, the groove's `talking-skin` and `log-tongue`, `pad` `giant-undertone` only in the last two
  bars. Side B: `bass` `tube-fuzz`, `hat` on `log-tongue`, `gong` `alien-gong` on the first downbeat,
  `moan` `talking-skin` (rubbed), `howl` `split-horn` (one overblown note), `hands` `talking-skin`,
  `teller` `feral-reed` cold.
- **Form:** a two-sided spec (`"sides"`). Side A `embers` 2 · `circle` 4 · `telling` 4 · `door` 2. Side B
  `beast` 8 · `hollow` 4 · `chase` 8 · `ember` 4.
- **Moves:** side A `timbreMorph` on `telling` (the reed warms, 0.35 → 0.5, never past singing) and `rollIn`
  on `door` (the last bar is one drum alone, rolling triplets = side B's eighths). Side B `floorDrop` on
  `hollow` and `riffReturn` on `chase`.
- **Visual:** two scenes, one hero (`knight`). Scene A: look `noir`, props `knight,floor,pillars`, one move
  `pendulum` (a slow swing in black and white; loops by itself). 4 bars at 96 = 10 s. Scene B: look
  `oxblood`, props `knight,floor,glow_rings`, moves `crash_zoom`, `lowrider_hop:sync=2`, `tornado_pov`,
  `gravity_flip`, three bars each. 12 bars at 144 = 20 s.
  `node tools/enm.mjs new two-names-fable --bpm 96 --bars 4 --look noir --props knight,floor,pillars --moves pendulum --idea "a horse head in black and white, swinging slowly past like a told story"`
  `node tools/enm.mjs new two-names-mythos --bpm 144 --bars 12 --look oxblood --props knight,floor,glow_rings --moves crash_zoom,lowrider_hop:sync=2,tornado_pov,gravity_flip --idea "the same horse in blood red: the lens slams in on the first beat and the room comes apart"`
- **Edit:** scene A three times (0:00–0:30). Cut to scene B exactly at **0:30.0**, so `crash_zoom` starts
  on the first downbeat of side B; colour arrives with the beast. Scene B once through (`beast` and `hollow`,
  0:30–0:50), then scene B again from its start at **0:50.0**, so `crash_zoom` slams a second time on the
  return (`chase`, to 1:03.3). Cut back to scene A for the last whisper (1:03.3 to the end).

## 6 · Until the Next Prompt (outro) — everyone, on both sides

- **Mood / story beat:** slow, thick, grateful. Dawn after the fire. The breath from track 1 comes back,
  and this time the ask is answered: the tune lands on the tonic for the first time on the album.
- **Tempo / key:** 72 BPM, D minor (the key of track 1). *The ask, answered:* D2 F2 A2 G2, then F2 D2.
- **Cast:** `bass` `tube-fuzz` (owns the hook: a 2-bar riff, the ask in bar 1 with
  `{"articulation":"accent","scoop":2}` on the first note, a ghost, a slide; `alt` ends on D2 held);
  `answer` `smoke-reed` (the breath from track 1: a three-note reply in the riff's rest, D4 F4 D4, the
  last note with `{"articulation":"fall","fall":3}`); `pad` `glass-choir`; `texture` `bearing-rain`.
- **Form:** `stallion` (strut 4 · statement 4 · floor 4 · return 4), hook on `bass`.
- **Moves (the form's own):** `liftEnding` on `statement` · `floorDrop` on `floor` · `riffReturn` on
  `return`. Reason for keeping all three: this is the closer; it should do the plain strong thing. `--check`
  will say the owner plays in every section; the answer is that the floor breaks the riff into single long notes.
- **Do not:** end on the fourth. The last note anyone hears is D.
- **Visual:** look `chrome`; props `orb,floor` (the orb from track 1, now a mirror); one move,
  `micro_to_mega`: the orb turns out to be an ornament on a bigger orb, forever. Loops by itself, no cut.
  6 bars = 20 s.
  `node tools/enm.mjs new until-the-next-prompt --bpm 72 --bars 6 --look chrome --props orb,floor --moves micro_to_mega --idea "the orb from the start, mirrored, always standing on a bigger one"`

---

## Album rules for whoever builds tracks 1–4 and 6

1. One track, one world, one hook owner. Use the cast as written; swap a patch only if `--check` or your
   one-sentence reason says so, and only for a patch of the same character in KIT.md.
2. Begin the hook with the ask, in the notes given for that track.
3. Keep to the length in the table (± 4 s). A Short that overstays is skipped.
4. The hook must be audible on a phone: keep it at or above octave 3 for voices and gongs, octave 4–5 for
   tines and reeds. Track 6 is the exception: the fuzz carries its own overtones.
5. Render once, twice at most. Report in six lines, as the skill says.
