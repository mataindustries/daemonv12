# Benchmark source voices

Only six WAV sources, 189,014 bytes total. All are 44,100 Hz signed PCM16. No arranged loop, premixed music, downloaded audio or rendered GM phrase is hidden in a source.

`make_assets.py` creates three mono one-shots. NumPy's PCG64 generator starts at seed **601138** once; draws occur in the exact order in that file. Computation uses float64. Common finishing is a SciPy second-order Butterworth 24 Hz high-pass, an 18 ms quadratic endpoint taper, peak scaling and explicit `floor(x * 32767 + 0.5)` PCM rounding. No dither or metadata timestamps are used.

| Source | Length | Peak | Construction |
|---|---:|---:|---|
| rubber-reed-d4.wav | 0.460 s | −6 dBFS | D4, 293.665 Hz; 34 additive partials; falling 1850→730 Hz formant; restrained 2650 Hz formant; 2.5% pitch settle over 9 ms; 1.8 ms attack and 135 ms amplitude decay; seeded 6 ms breath transient. |
| pocket-bass-d2.wav | 0.580 s | −5 dBFS | D2, 73.416 Hz; sine plus partials 2–5 at .22/.11/.035/.015; 7% pitch settle over 14 ms; 3.5 ms attack and 220 ms decay. Harmonics decay faster than the fundamental. |
| heel-kick.wav | 0.240 s | −5 dBFS | Analytically integrated 149→49 Hz pitch fall with 20 ms time constant, 54 ms amplitude decay, a 185 Hz knock, and a seeded 2.4 ms click band-passed at 1.7–6 kHz. |

Three checked-in CC0 sounds are copied **without alteration** into this project's assets directory: GLASSHOUSE chrome-clap and pixel-hat, and Orbital Foundry machine-tick. Their original licenses are included. Copies are required because DaemonV12 resolves sources inside each project's own `assets/` directory and rejects escaping references. Original packs were not edited.

The project performs the sources with note rates, glides, offsets, velocity and production effects. Offset searches choose the minimum channel amplitude within ±1.8 ms of the intended source position. This retains deliberate percussion transients and substantially reduces unintended reed clicks; it is not a hidden fade or waveform edit.

Exact file hashes and machine-readable recipes: `assets-manifest.json`. Pinned generation environment: Python 3.12.14, NumPy 2.3.5, SciPy 1.17.0. Re-running the generator in this environment is verified byte-identical. Floating-point synthesis across unrelated library/CPU versions is not the portability contract; the supplied WAV hashes are authoritative.

Recreate these assets from the locked repository:

```bash
python benchmarks/ultimate-beat-battle/round1/astra/make_assets.py
```

This script writes only this submission's assets and asset manifest, never shipped packs.
