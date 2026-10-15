# BANGER LAB 001 · Shared brief

Contestant-facing. Every composer receives these identical bytes, plus
`approved-palette.json`, `templates/`, `tools/check-delivery.sh` (the same
technical gates the organizer runs) and their own role prompt. Do not rewrite
this file per model.

## The assignment

Make an **original electronic instrumental that a listener remembers after one
play and wants to hear again**. Dark, futuristic and hypnotic, with a
distinctive hook, a groove you feel in your body, strong bass, an arrangement
with a purpose, and a payoff that lands physically or emotionally. It should be
good enough that someone would want to license it for a game, trailer, ad or
creator video.

This is a music-first challenge. Nobody scores the JSON, the effect count, the
number of tracks or the length of the report. People score what they hear, blind
and at matched loudness.

## Locked parameters

| Parameter | Value |
|---|---|
| Final master | Exactly **75.000 s = 3,307,500 frames**, 44,100 Hz, stereo, signed 16-bit PCM WAV |
| How | `"render": {"duration": {"seconds": 75}, "tail": <your explicit choice>}` in the project. This also selects the production route, so stems are aligned. |
| Stems | `--stems`; every stem is exactly 3,307,500 frames and starts at frame 0 |
| Picture target | 60 fps, **4,500 video frames**. You do not make video. You deliver section cues (see below). 44,100 / 60 = 735 audio frames per video frame, exactly. |
| Engine | DaemonV12 **0.7.0**, commit `02438eda48506a94d10ad2756c6aafff8c5a9469`. Never modify it. |
| Workflow | DaemonV12 Composer **0.3.0** package, exported from commit `f913226e99496eca43b9da0fbcea68516bf9bbb8` (PR #23 merge). Use the copy you are given. The `plugins/` folder inside the engine checkout is the older v0.2 and must not be used. |
| Sounds | Only the **22 approved WAVs** in `assets/orbital-foundry/` and `assets/glasshouse/` (and their two `kit.json` files), byte-identical to `approved-palette.json`. |
| Not allowed | `"type": "gm"` instruments (FluidR3 GM is not rights-cleared). Any other WAV. Edited, reversed, bounced, resampled or otherwise derived WAVs. The `pulse-kit` and `v05` fixtures. |
| Listening copies | The organizer makes loudness-matched blind copies. Your canonical master is never altered. |

## Creative freedom

BPM, key, meter (one per project), structure, density, palette choices within the
approved sounds, and how hard or how dark: all yours. Possible lanes, not
prescriptions: dark techno or industrial, halftime bass, cinematic trap,
darkwave instrumental, minimal hypnotic, neuro at drum-and-bass tempo. Pick one,
fuse two, or ignore the list.

### Executive producer's notes (advice, not rules)

- **Write the hook before the production.** A real hook survives on one dry
  sound: a rhythm you could clap plus a short contour (3–6 notes), or one
  unmistakable timbral gesture. If it only works with reverb on, it is not the
  hook yet.
- **Hypnosis is repetition; memorability is mutation.** Let the hook return at
  least three times and change one thing each time (register, answer, rhythmic
  displacement, the space around it), never everything at once.
- **One low-end owner at a time.** In each section, decide whether the kick or
  the bass owns the downbeat. Tune the bass to your key, and keep it off the
  kick with gates, offsets or envelopes.
- **Payoffs are contrast, not pile-ups.** Take something away before the
  arrival (a beat of space, a thinned bar), then return with the hook
  transformed and the low end at full authority. Know where your single biggest
  moment is, and protect the bars before it.
- **Groove lives in timing and velocity.** Swing offsets (`+1/6` swings
  eighths; `+1/12` and `+5/24` swing sixteenths), accent patterns, ghost notes at
  low velocity, choke-grouped hats. Identical velocities on a straight grid sound
  like a test signal.
- **Darkness is harmony and register as much as sound.** Flat-second and
  flat-sixth colours, the tritone already in `alarm-energy-pulse` (D–A♭), a low
  drone under a bright, glassy hook.
- **The ending is part of the hook's memory.** An exit that points back to the
  opening gesture invites the replay.

## What listeners reward

Judges score eight things, with weights. Measurements are evidence for the
organizer, never a score.

| Criterion | Weight | The question a listener answers |
|---|---:|---|
| Memorability | 20 | Can I recall the hook tomorrow? Is it hummable, tappable or otherwise unmistakable? |
| Immediate identity | 15 | Within about five seconds, do I know this track and want the next bar? |
| Groove | 15 | Does my body move? Is the pulse confident, with push and pull rather than a grid? |
| Bass and percussion impact | 10 | Does the low end hit with authority, with the kick and bass working together? |
| Arrangement and payoff | 10 | Does it build, contrast and arrive somewhere that feels earned? |
| Emotional or physical response | 10 | Did I feel something: menace, lift, tension, release, adrenaline? |
| Replay appeal | 10 | When it ends, do I want it again? Does the ending invite the restart? |
| Production quality | 10 | Is it clean, controlled and release-ready, with nothing amateurish that breaks the spell? |

Lessons from earlier internal rounds: immediate identity can still feel awkward,
polished music can remain too safe, and more originality or loudness can
coexist with weak physical impact. Aim at the listener, not at the measurements.

## Hard rules

- **Original material.** Do not copy patterns, melodies, hooks or arrangements
  from repository examples (GHOST//SHIFT, GLASS//FIRE, the pack auditions, ONE
  SOUND, the Composer recipe fixtures), from historical rounds, or from any
  existing song. Learning a technique from them is fine; reusing their music is
  not.
- **No hard cut at 75 s.** The container crops whatever is still sounding,
  without a fade. The final 10 ms (441 frames) of the master must peak at or
  below **−50 dBFS**. Compose the ending to finish inside the container.
- **Clean gain staging.** Zero `clippedSamples` on every track and on the
  master, zero full-scale samples, and true peak at or below **−1.0 dBTP**.
  There is no limiter. Loudness is free, but matched listening removes any
  advantage from it.
- **Honesty.** Never claim to have heard the music. Label score inspection and
  measurements as what they are.

## Verified palette notes

- **Tuned sources** (GLASSHOUSE, A4 = 440 Hz): `glass-hit` C#5, `glass-reverse`
  C#5, `glass-crush` C#3, `ghost-vox` and `vox-chip` C#4, `bass-punch-cs` and
  `sub-cs` C#2 (69.30 Hz), `prism-impact` a C# minor chord. Orbital Foundry
  `alarm-energy-pulse` carries D4/A-flat4 tones, `sub-pulse` is 49 Hz and the
  `mechanical-kick` body is about 68 Hz. Do not infer tuning from a kit's MIDI
  mapping: it selects a hit, not a pitch.
- **Other keys** use `playbackRate = 2^(n/12)` (0.25–4). Pitch and length change
  together; there is no time-stretch.
- **Chords** are several sampler notes at the same `start` with different rates.
- **Longest sources:** `dark-drone` and `air-texture` 8 s, `tension-riser` 4 s,
  `cinematic-impact` 3.6 s, `low-boom` 2.4 s, `reverse-swell` 2 s,
  `prism-impact` 1.8 s, `metallic-strike` 1.65 s. `ghost-vox` is 0.95 s and
  `sub-cs` 0.857 s. There are no loop points: sustain by overlapping retriggers
  with `envelope` ramps and `chokeGroup` releases.
- **Render budget:** every voice at a rate other than 1, or with a glide, costs
  interpolation work. The project-wide limit is 1,000,000,000 kernel taps:
  roughly 319 s of performed voice output at rates ≤ 1, 160 s at rate 2 and
  81 s at rate 4, counted after gates and boundaries. Keep repeated workhorse
  sounds at rate 1 where you can. `validate` rejects an over-budget project
  before any render.

## 75-second grid math

The engine quantizes tempo to `round(60000000 / bpm)` microseconds per quarter.
A 4/4 bar line lands exactly on 75.000 s only at **80, 96, 128 and 160 BPM**
(25, 30, 40 and 50 bars). Any other tempo is fine: the container is still
exactly 75 s, but your last bar is partial. For example, 140 BPM gives
43.75 bars: bar 44 has only three beats inside the container, and the bar-45
downbeat would fall after the end. Compose the ending inside the container either
way.

## Section cues

Deliver `cues.json` (template: `templates/cues.template.json`): your section names
and project-absolute musical positions, resolved by the engine to ticks and
sample frames, with `videoFrame = floor(frame / 735)`. Include a **15-second
promo window**: a start position, exactly 661,500 frames (900 video frames), and
why this window sells the track. Resolve positions with the engine's own
functions, run from the engine checkout root:

```sh
node --input-type=module -e '
const E=process.cwd();
const {compileProjectFile}=await import(E+"/src/pipeline.ts");
const {parsePosition,ticksToFrames}=await import(E+"/src/timing/musical-time.ts");
const [file,...cues]=process.argv.slice(1), c=compileProjectFile(file);
if(!c.project||!c.timeline){console.error(JSON.stringify(c.diagnostics,null,1));process.exit(1);}
const p=c.project,t=c.timeline.usPerQuarter;
console.log(JSON.stringify(cues.map(s=>{const [name,position]=s.split("=");
 const r=parsePosition(position,p.timeSignature,p.bars+1);
 if(r.diagnostic)return {name,position,error:r.diagnostic.message};
 const frame=ticksToFrames(r.value,t);
 return {name,position,tick:r.value,frame,seconds:Number((frame/44100).toFixed(6)),videoFrame:Math.floor(frame/735),inContainer:frame<3307500};}),null,1));
' /path/to/your-project.json intro=1:1 drop=17:1
```

A cue at or after frame 3,307,500 lies outside the container: label it, do not
deliver it as a cue. The engine has no native marker export, so do not add
silent notes or fake automation just to create markers.
