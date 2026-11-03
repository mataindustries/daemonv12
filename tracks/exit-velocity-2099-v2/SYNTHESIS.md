# V2 procedural palette

`generate_assets_v2.py` is an original procedural redesign of the track's `generate_assets.py`, using oscillators and seeded noise; no recordings, samples, SoundFonts or external audio were used. The original material remains separate. Python with NumPy and SciPy writes mono/stereo 44.1 kHz PCM16 files compatible with the DaemonV12 sampler. Retained filenames, fundamental tunings and kit pitches make the original score reusable.

- The kick has a decaying pitch-swept membrane, a short independent noise attack and a warm overtone; the center sub has a small second harmonic and its own envelope.
- The clap combines a low pitched knuckle, four offset noise grains and a softer noise tail. Metallic hats and rim keep the playful counterpoint.
- The talking bass moves two formant bands over an F2 harmonic bank, with a short pitch gesture and bounded waveshaping. Its low end is high-passed so the separate mono F1 source owns the sub range.
- The recognizable F5 whistle has a breath transient, a stronger harmonic body and delayed vibrato. The descending pitches are authored in the score, not baked into the sample.
- The atmosphere uses independently detuned stereo oscillator banks and a falling synthesized motor rather than a stock riser.

Palettes A, B and C use distinct kick tuning, bass formant trajectories and motor envelope; the full treatments also require different score and mix choices. B is the starting full-length palette, not a claim that it sounds best.

From this workspace:

```sh
python generate_assets_v2.py --palette B --out assets
python generate_assets_v2.py --palette A --out assets/a
python generate_assets_v2.py --palette B --out assets/b
python generate_assets_v2.py --palette C --out assets/c
```

The RNG is fixed to seed 2099. An independent B synthesis run in this environment produced byte-identical files. Exact byte identity across Python, NumPy, SciPy and CPU versions is not guaranteed. Sample peak normalization alone does not prevent summation overload; inspect every track and master render manifest.

The first candidate renders used a softer kick transient. To reproduce that earlier asset set, add `--early-kick` to the corresponding palette invocation. An independent B run with that flag matched the pre-repair files byte for byte. The default strengthens the short beater after analysis showed the initial redesign's treble attack energy fell well below the source despite its larger low-frequency body.
