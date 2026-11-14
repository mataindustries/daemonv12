# BOLLO coin instrument · 1.0.0

An opt-in, offline 44.1 kHz stereo instrument. All coin sound is numeric synthesis: no recordings, samples, impulses or external audio. Quarter-sized character is authored, **not calibrated quarter physics**. Owner listening review is pending.

```ts
import { renderCoin } from './coin.ts';
import { PRESETS } from './presets.ts';
import { bridgeWav } from '../../studio-001/v12-bridge/bridge.ts';
const { audio, plan, modes } = renderCoin({ ...PRESETS.bounce, seed: 252 });
// audio: [Float64Array, Float64Array], amplitude units; write bridgeWav(audio) as PCM24.
```

| Parameter | Range / default | Meaning |
|---|---|---|
| `motion` | face, edge, bounce, spin, roll / face | Mechanical regime |
| `velocity` | 0–1 / .8 | Incoming speed; zero is silent; bounce uses `v=4·velocity` m/s |
| `strike` | 0–1 / face 0, others .92 | Face → asymmetric edge excitation and longer ring |
| `hardness` | 0–1 / .88 | Shorter force pulse and brighter floor response |
| `spin` | 0–1 / .65 | Wobble rate, bounce orientation and residual settling motion |
| `damping` | 0–1 / .45 | Frequency-dependent modal loss |
| `material` | 0–1 / .55 | Dark/soft → bright/stiff spectral character |
| `size` | .7–1.4 / 1 | Relative radius; pitch scales as size⁻² at fixed thickness |
| `position` | −1–1 / 0 | Equal-power stereo position; movement stays within this range |
| `seed` | uint32 / 250 | Fixed mode splitting, contact angle and surface roughness |
| `restitution` | .25–.85 / .61 | Effective vertical restitution; no role in precession law |
| `motionSeconds` | .15–6 / spin 2.65, roll 2.2 | Spin/roll duration; bounce duration follows mechanics |

Presets: `face`, `edge`, `bounce`, `spin`, `roll`, `tightFace`, `rim`, `shortSpin`. Presets are input values, not frozen one-shot assets. Each trigger synthesizes the response from its parameters.

The finite-state machine validates transitions among rest, airborne, impact, bouncing, rolling and wobbling. Rest stops new mechanical excitation; the acoustic tail continues. `planCoin()` exposes every transition and contact in seconds and absolute nearest frames. A bounce alternates impact → bouncing → airborne → impact. Rolling and wobbling contacts remain in their respective continuous states.

In vertical bounce, `v[n+1]=e·v[n]`, `Δt[n]=2·e·v[n]/9.81`; therefore flight intervals shrink by `e` and kinetic energy by `e²`. The sequence ends below .055 m/s rebound or .012 s flight. Remaining tilt can enter a separate short wobble. Changing the seed cannot change gravity or these flight intervals.

For wobble progress `q`, `f(q)=min(95+65s, (7+7s)·(1.003/(1−q+.003))^.62)` Hz. Sample-grid phase integration schedules contacts. Strength decays as `(1−q)^.48·sqrt(f(0)/f(q))` with a smooth final 6% stop. Increasing rate never implies increasing mechanical energy. A weak final face contact represents flattening. This regularized law deliberately has no singularity. The exponent and duration are instrument choices, not a fitted dissipation law.

Rolling uses constant deceleration: `x(t)=v0·(t−t²/(2T))`, `θ=x/r`, `v=v0·(1−t/T)`. Seeded spatial rim roughness and tile seams every .21 m generate contacts. Continuous correlated friction and a 113-ridge design texture remain between those contacts; ridge count is a synthesis choice. Rolling slows down; the later wobble accelerates independently.

Twelve split inharmonic flexural modes receive angular projections of a unit-area half-sine force pulse. All contacts excite the same resonant memory. A face strike emphasizes the lowest pair and a short floor slap; edge strikes excite asymmetric modes. Stable complex poles use `r=exp(−1/(τ·44100))<1`; there is no feedback excitation or nonlinear waveshaper. Modes fade above 11 kHz and are disabled at 15 kHz; floor/rolling noise and the sum pass a sixth-order 6.5–11 kHz low-pass and a 35 Hz DC blocker. A 20 ms final taper ends at zero. Fixed gain preserves velocity/energy relationships; no per-hit normalization. The renderer rejects non-finite output and peaks ≥.95.

The model omits full rigid-body collision geometry, air loading, slip dynamics and calibrated plate modes. Surface hardness changes acoustics; restitution is independently set because those are not interchangeable material measurements. Acoustic ring-down is a fixed .75 s allocation after motion, with a tapered end. This is a deterministic offline instrument, not a real-time plug-in.

`renderCoinBridge()` in [bridge.ts](bridge.ts) accepts a score/2 with `instrument: "bollo-coin"` and a part-local `coin` object. [proof.score.json](proof.score.json) is the runnable integration example, including motifs, ordinary V12 kick/clap, direct notes and physical fills. The unchanged bridge resolves motifs, transforms, swing, humanization and absolute frames using a temporary existing sample part. Its entire temporary stem is replaced; none of that sample reaches the coin output. No registry or contract changes.

Note velocity multiplies incoming speed; MIDI pitch and nominal note duration do not tune or gate the physical coin. Each note derives a reproducible seed from its part seed and note index. Part gain and pan work normally. Coin room sends must be zero; unsupported continuous controls, slides, per-note params and gestures fail explicitly. Use part presets for different articulations. Acoustic output caps have a 5 ms release and are recorded in the manifest. Ordinary scores retain bit-identical bridge audio, stems and seed indices.

```sh
node instruments/bollo-coin/proof.ts /tmp/new-bollo-listening
node --test tests/bollo-coin.test.ts
```

The exporter refuses existing output directories. WAV is nearest-rounded PCM24 without dither. MP3 is 256 kbps and derived from those WAVs. Exact hashes apply to the recorded Node/V8 and codec build; cross-platform libm/codec byte identity is not promised. [Listening delivery](../../proofs/bollo-coin/README.md), [QA](../../proofs/bollo-coin/TECHNICAL_QA.md), [composition handoff](../../BOLLO_FABLE_HANDOFF.md).

Research informing the reduced model: [Moffatt, *Euler's disk and its finite-time singularity* (2000)](https://doi.org/10.1038/35009017) motivates accelerating precession; [*Rolling friction and energy dissipation in a spinning disc* (2014)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4123768/) discusses surface-dependent dissipation; [*Modeling manner of contact in the synthesis of impact sounds for perceptual research* (2011)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3155581/) describes modal impact synthesis and contact-force projection. These sources inform mechanisms; none supplies this instrument's quarter mode table or parameter calibration.
