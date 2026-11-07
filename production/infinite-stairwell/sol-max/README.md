# THE LANDING REMEMBERS

ENM STUDIO // INFINITE STAIRWELL · SOL MAX

A four-bar, 96 BPM miniature for an architecture that almost remembers being human.

Hook: D–A–B♭–F, a rising fifth, a semitone of hesitation, a falling fourth.
Pacing: displaced mallet attacks and a slower vocal answer; no drum grid.
Foundation: one warm bass voice follows D–B♭–F♯–A.
Contrast: the struck melody disappears at five seconds.
Payoff: a close solo voice sings D–A–B–F♯; the remembered minor phrase becomes major.
Return: G–E–C♯ and an A pickup invite the opening D; the room continues across the boundary.

| Delivery | File |
|---|---|
| WAV master | [delivery/audio/the-landing-remembers.wav](delivery/audio/the-landing-remembers.wav) |
| Listening MP3 | [delivery/audio/the-landing-remembers.mp3](delivery/audio/the-landing-remembers.mp3) |
| Three continuous repeats | [delivery/audio/the-landing-remembers-three-repeats.mp3](delivery/audio/the-landing-remembers-three-repeats.mp3) |
| Six aligned stems | [delivery/audio/the-landing-remembers.stems/](delivery/audio/the-landing-remembers.stems/) |
| Editable note score | [the-landing-remembers.score.json](the-landing-remembers.score.json) |
| Native DaemonV12 mix project | [delivery/the-landing-remembers.json](delivery/the-landing-remembers.json) |
| QA and provenance | [QA.md](QA.md), [delivery/provenance.json](delivery/provenance.json) |

Edit the note score, then run from the repository root:

```bash
node production/infinite-stairwell/sol-max/render.mjs production/infinite-stairwell/sol-max/NEW_DIRECTORY
```

The session uses the existing Signature Rack and native DaemonV12 production renderer. Its only additional audio operation is circular overlap-add of the natural tails. Output paths must be fresh and inside this composition directory. The native project and its adjacent `assets/` also render independently with the standard DaemonV12 CLI. Its sampler phrases are editable in the mix; note edits use the score and re-bounce.

One composition and one balance correction. Finished; no merge or release.
