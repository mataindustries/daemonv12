---
name: daemonv12-composer
description: Compose a track or sketch with personality in DaemonV12 using the Composer Kit (palette, grooves, form moves, one-command builder). Use when asked to make, sketch, or improve music, a beat, a riff, a groove or a short track with DaemonV12. Do not use for engine implementation, README edits, pull-request reviews, or unrelated audio tasks.
---

# DaemonV12 Composer

You are making a short track (about 40 seconds) that someone would want to hear twice.
You cannot hear audio. Your taste lives in decisions you can defend in one sentence each.
The kit holds the sounds, the grooves and the form moves; you supply the world, the hook
and the reasons.

Work in the DaemonV12 checkout (the folder that contains `composer-kit/` and `studio-001/`).
Read `composer-kit/KIT.md` once: it is the whole catalogue (patches, grooves, forms, moves,
spec format). Do not read engine source, tests, or other branches. Do not edit `studio-001/`,
`src/` or `mcp/`. Budget: write one spec, check it, fix it, render once (twice at most).

## The path

### 1. Pick a world (one sentence, before any note)

A world is a place plus something wrong with it: *"a wind-up preacher: a typed wooden hook,
a bass that climbs in stairs, one human throat that argues back."* The sentence chooses your
sounds for you. Then pick:

- **One groove** from KIT.md by its *feel* line, not its name. The groove sets the tempo and swing.
  The owner's favourites are `half-stomp`, `gallop-hole` and `swamp-shuffle`: if your world
  can live on one of them, start there (see *Owner taste notes* below).
- **Three to five patches**: a bass, a hook owner, one answerer, and at most one pad and one
  texture. Take them from at least two different characters (rubbery / dirty / mechanical /
  glassy / broken / human). One sound should be a little ugly. If every patch is "nice", the
  track has no personality. The owner's loved sounds are `giant-undertone` (when a section
  needs weight) and `alien-gong`, `dead-marimba`, `laser-spring` (hooks and answers); check
  whether any of them fits your world before reaching for something else.
- **If a voice is in the cast** (`impossible-voice` family: `warm-throat`, `wounded-cry`,
  `hollow-whistle`, ...), decide now how it will *move*: it must not be one held vowel. See
  *Owner taste notes*.
- **A key**: any minor key from D to A sits well (`"G minor"`, `"D minor"`, `"E minor"`).

If the user gave a mood or genre, the world must serve it. If they gave nothing, choose
something specific and slightly odd; never "energetic electronic track".

### 2. Write the hook, owned by one instrument

The hook is one voice's `cell`: 1 or 2 bars that loop. `"hook": "bass"` or `"hook": "lead"`
names the owner. Exactly one instrument owns it. Everything else accompanies or answers.

Write the rhythm first, then the pitches:

1. Look at the groove's kick map in KIT.md. Put your strongest notes ON a kick or in a gap
   between kicks. Leave the snare beats alone.
2. A hook needs these five things. Count them:
   - one **accent** on or near beat 0 (the statement),
   - one **short or ghost** note (the wink that sets up the next accent),
   - one **long** note (at least 1 beat: where the sound gets to speak),
   - one **rest** of at least 1 beat (where the answer and the drums are heard),
   - one **late surprise** in the second half (a leap, a note outside the pattern, a slide, a held
     note where a short one is expected).
3. Pitches: use the minor pentatonic of the key (in G minor: G B♭ C D F) plus at most one
   colour note (E♭ or A). Three to five different pitches. End the cell away from the tonic,
   and give `alt` an ending that lands home (or the other way round): question, then answer.
4. Five to nine notes per bar at most. If it has more, it is a texture.
5. Stay in the owner's range (KIT.md table). Bass hooks: G1–G2 region. Leads: octave 4–5.

A bass-owned hook uses bass note options, which are most of its character:
`{"articulation":"accent","scoop":2}`, `"ghost"`, `"staccato"`, `{"slide":0.1}`,
`{"dive":4,"diveBeats":1}`. A hook played with no articulations is a MIDI file, not a riff.

If the hook owner or the answerer is a voice patch, write it as phrases, not sustained notes:
change the vowel, the note length, the register and the articulation as it goes (see
*Owner taste notes*).

### 3. Build four to six contrasting sections

Easiest: choose a `form` from KIT.md whose *when* line matches your hook. Otherwise write
`sections` yourself. Either way every section needs **one job** you can say in five words
("riff alone, cold", "floor drops, one cry", "riff returns as machine"). Rules:

- The first statement of the hook is nearly naked (hook + groove, no answers yet).
- Each neighbouring pair of sections differs in something you can name with one word:
  *density, pulse, register, owner, heat*. Do not use the same word twice in a row.
- One section is a **floor**: two or more bars with three parts or fewer.
- The hook is **absent or broken** somewhere, so that it can come back.
- `heat` is how far each patch has travelled on its journey (0 cold, 1 hot). Start cold
  (0.1–0.3). Save 0.8+ for one section.

### 4. Use one to three moves, each with a reason

Moves are in KIT.md with a "works when" and a "cheap when" line. For every move you use,
write the sentence "I use X in section Y because …". If your sentence matches the *cheap
when* line, delete the move. Three moves is the maximum; two is usually right. A form's
default moves are a good start: keep them unless you have a better reason.

### 5. Critique, then render once

```bash
node composer-kit/build.ts my.spec.json --check
```

This prints one row per section (parts, heat, notes per bar, hook yes/no) and a TASTE CHECK.
Go through the taste list below with that output in front of you. Fix the spec. Run
`--check` again. Only then:

```bash
node composer-kit/build.ts my.spec.json OUT_DIR
```

It writes `OUT_DIR/score.json` and `OUT_DIR/<title>.mp3`. Report in at most six lines: the
world sentence, the hook and its owner, the sections with their jobs, the moves with their
reasons, the file path, and the one thing you are least sure about. Then stop. Do not write a
README, a validation file, hashes, or a log. Do not run the test suite.

## Taste list (answer every line before rendering)

1. **World**: does every patch belong to the one-sentence world? Remove the one that does not.
2. **Hook has a shape**: accent, ghost/short, long note, rest, late surprise — all five present?
3. **Hook can be hummed**: 3–5 pitches, at most ~9 notes a bar, a clear highest note used once or twice.
4. **One owner**: is the hook's first statement exposed, with nothing else melodic competing?
5. **Kick and bass are one instrument**: do bass accents land with kicks or in the gaps? Is the snare left alone?
6. **Every boundary changes something**: name the one-word change for each pair of sections. No word twice in a row.
7. **There is a floor**: a section with three parts or fewer.
8. **The return is a return**: the hook comes back after an absence, in a hotter body or a new owner, and the *other* parts did not all get bigger too.
9. **Moves are earned**: three or fewer, each with a "because", none matching its "cheap when".
10. **Something is a little wrong on purpose**: one ugly sound, one displaced note, one silence that lasts too long. If nothing could annoy anybody, nothing will delight anybody.
11. **The ending is a decision**: a dive, a lone note, a cut. Not a fade, not "everything stops".
12. **TASTE CHECK warnings**: each one either fixed or answered with a reason.
13. **Owner favourites**: did you consider `giant-undertone` where a section needs weight,
    `alien-gong` / `dead-marimba` / `laser-spring` for the hook and answers, and one of
    `half-stomp` / `gallop-hole` / `swamp-shuffle` for the groove? Use each as its KIT.md line
    says. A favourite that does not belong to the world (item 1) still loses to the world.
14. **The voice moves**: if the track has a voice, count what changes in it: vowels, note
    lengths, register, articulation. One vowel held for most of the track fails. It sings
    phrases (a start, a stop, a rest), and somewhere it does one impossible thing: a huge pitch
    bend or a rhythmic, scat- or rap-like run. A held voice is fine for one section, not the track.

### Owner taste notes (Composer Kit v1 listening)

These are the owner's reactions after listening to the kit, not guesses.

**Loved**

- `giant-undertone`: menacing and massive. Use it when a section needs weight.
- `alien-gong`, `dead-marimba`, `laser-spring`: sound expensive and clean. Strong picks for
  hooks and answers.
- Grooves: `half-stomp`, `gallop-hole` and `swamp-shuffle` (the owner says "Swamp Groove") are
  the favourites.
- Sketch B on the listening page, "Reservoir Radio" (`composer-kit/sketches/sketch-s`): a
  really strong instrumental.

**Wanted more of**

- `impossible-voice` doing impossible things: extreme pitch bends (`scoop`, `slide`, `cry`,
  `fall`), and rhythmic, almost scat- or rap-like phrasing (short `detached` notes, a new
  `vowel` or `to` on each) instead of sustained vowels.

**Avoid**

- A voice that holds the same "ahh" for most of a track. Sketch B's vocal lost interest
  because it barely changed. The voice should move: vary vowels, rhythm, register and
  articulation, and give it phrases, not just pads.

## Why Chrome Stallion works (the bar to aim for)

Chrome Stallion is 16 bars in G minor at 98 BPM, swing 0.58: a warm bass riff alone, the
riff answered, the floor dropping to half-time, the same riff returning as a machine. It
is not good because of those ingredients. It is good because of these decisions, which you
can reuse on any material:

1. **The hook is the bass riff itself.** There is no melody "on top of" a backing; the groove
   and the tune are the same object, so the track is its hook from the first second.
   *Principle: give the hook to one instrument that could carry the track alone.*
2. **The riff is made of gestures, not pitches.** A scooped accent on one, a ghost note, a
   slide, a staccato step, then a late lift a sixth up that leans into the repeat. Played
   straight, the same pitches would be nothing. *Principle: articulation is content. Write
   the accent, the ghost, the long note, the rest and the late surprise.*
3. **Kick and bass are one instrument.** The kick lands on the riff's accent, then pushes just
   ahead of its second half; the snare owns the backbeat alone. Not four-on-the-floor: a kick
   pattern with a hole in it that the riff walks through. *Principle: lock or answer, never
   crowd.*
4. **No role is filled by a generic sound.** The hi-hat is a clock escapement. The answers are
   steel tines and a wordless cry. Each job is done by a sound with a face. *Principle: for
   each role ask "what is the least expected sound that can still do this job?"*
5. **Weird sounds, human feel.** The timbres are strange; the rhythm is swung and a few
   milliseconds loose, like a player. *Principle: be strange in one dimension at a time.
   Strange sound + solid groove is personality. Strange sound + strange rhythm is noise.*
6. **The first statement is naked.** Four bars of riff and drums, no answers. The answers only
   arrive once the riff is known, and only in its gaps. *Principle: one new thing per section,
   placed where the hook is resting.*
7. **Development is a lean, not a layer.** The second statement ends by climbing (iv, then V)
   and diving. Nothing was added; the phrase asks a question. *Principle: develop by changing
   where the phrase points, before adding parts.*
8. **Contrast is subtraction.** At bar 9 the pulse the body relied on is taken away: half-time,
   stop-time hits, held subs, one high cry alone. *Principle: the contrast section removes
   the most reliable thing and exposes one sound.*
9. **The return hits harder because only the body changed.** Same riff, same tempo, same
   drums — but the bass has travelled from warm to machine (folded, geared, growling) and
   exits with a five-semitone dive. The listener's memory of the warm riff is what makes the
   machine riff heavy. *Principle: return = known notes + new body. If everything gets bigger
   it is only louder.*
10. **Every section has one job, and it is short.** Four sections of four bars. Nothing is
    there to fill time. *Principle: if you cannot say a section's job in five words, cut it.*

Use these as principles. Do not reuse Chrome Stallion's riff, key, tempo or kick pattern.

## A worked example

World: *a wind-up preacher.* Groove `tresillo-clank` (three landing spots per bar, good for
call and answer). Hook owned by `lead` on `dead-marimba` (typed, wooden); `ratchet-servo`
bass (slides climb in stairs: the "wrong" sound); `warm-throat` as the human answer;
`rosin-drone` pad and `bearing-rain` for the empty section. Form `machine-first`: the hook
alone and cold → groove enters and a human sings the hook whole (`handOff`, because machine →
human changes what the tune means) → two bars of almost nothing (the floor) → machine and
voice split the hook (`callAnswer`, because their attacks are opposite) and the bass dives out.

```json
{
  "title": "Tin Saint", "key": "D minor", "groove": "tresillo-clank", "seed": 41,
  "world": "A wind-up preacher: a typed wooden hook, a servo bass that climbs in stairs, and one human throat that learns the tune and argues with it.",
  "form": "machine-first", "hook": "lead",
  "voices": {
    "bass": { "patch": "ratchet-servo" },
    "lead": { "patch": "dead-marimba", "gainDb": -4, "cell": { "bars": 2,
      "notes": [[0, 0.5, "D5", 0.9], [0.75, 0.25, "A4", 0.6], [1.5, 0.5, "C5", 0.85], [2.25, 0.25, "A4", 0.6], [3, 0.75, "F4", 0.8],
                [4.5, 0.5, "G4", 0.75], [5.25, 0.25, "A4", 0.7], [6, 1, "D4", 0.9]],
      "alt":   [[0, 0.5, "D5", 0.9], [0.75, 0.25, "A4", 0.6], [1.5, 0.5, "C5", 0.85], [2.25, 0.25, "A4", 0.6], [3, 0.75, "F4", 0.8],
                [4.5, 0.5, "G4", 0.75], [5.25, 0.25, "A4", 0.7], [6, 0.5, "C5", 0.8], [6.75, 0.75, "E5", 0.9]] } },
    "answer": { "patch": "warm-throat" },
    "pad": { "patch": "rosin-drone", "gainDb": -8 },
    "texture": { "patch": "bearing-rain" }
  }
}
```

Check of the hook: accent (D5 on beat 0, on the kick), short notes (the A4s), long note (D4,
one beat), rests (beat 3.75–4.5 and the whole last beat), late surprise (the first pass falls
to low D4; the `alt` pass climbs to E5 instead and does not resolve). Five pitches. The lead's
accents sit on the tresillo kicks at 0, 1.5 and 3.

## When something fails

- `unknown patch / groove / move / form`: the message lists the valid names. Use one of them.
- `"x" is not a voice`: a `play` token or move option names a voice that is not in `voices`.
- `score is invalid`: read the first problem line; it names the part and the beat. Usually a
  note outside its cell or a misspelled option. Fix the spec, not the kit.
- Do not work around an error by editing `composer-kit/`, the rack, or the engine.

## Not the default path

Release-grade engine productions (native projects, packs, stems, three serious versions,
evidence, risk pass, lock) are a separate, heavier workflow:
[engine production workflow](references/engine-production-workflow.md). Use it only when the
user explicitly asks for that. Do not run its verification, evidence or gate steps for a
kit sketch.
