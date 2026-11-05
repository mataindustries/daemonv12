# SODIUM HOURS: locked PCM16 versus Float64/PCM24 production

The exact locked composition rendered successfully through the integrated optional precision path. The original PCM16 master remains unchanged. An independent complete PCM24 package replay matched **all 221 package files byte for byte**, including the master, 15 aligned stems, listening MP3, copied sources, inventories and metadata. These are technical results; they do not establish a subjective improvement or release approval.

The [machine-readable A/B report](../proofs/production24-integration/sodium-hours.ab.json) records all measurements, section windows, source and output hashes. [Integration reproduction instructions](PRODUCTION24_INTEGRATION.md) describe the canonical restoration, verification and rendering commands.

## Preservation and measured results

The original `verify-delivery.sh` first restored all 163 canonical WAV sources from committed FLAC and verified their catalog hashes, checked the saved delivery, restored and verified 15 stems and the alternate, then reproduced the locked master and stem hashes. The integration engine's ordinary PCM16 route separately reproduced the same master and all 15 stems. The PCM24 project bytes match the locked project, retaining all arrangement, instrument, automation, gain and ordered mastering parameters: 70 bars, 15 tracks and 2,223 triggers. All trigger frames match independent absolute BigInt rounding.

Both masters are 44.1 kHz stereo, exactly **8,224,650 frames / 186.5 seconds**. All PCM24 stems begin at frame zero and have that same length.

| Measurement | Locked PCM16 | Float64 / PCM24 |
| --- | ---: | ---: |
| Integrated loudness | −11.35 LUFS | −11.35 LUFS |
| Loudness range | 6.2 LU | 6.2 LU |
| Measured true peak | −2.07 dBTP | −2.07 dBTP |
| True-peak headroom | 2.07 dB | 2.07 dB |
| Sample peak | −2.583658 dBFS | −2.583811 dBFS |
| RMS | −12.671715 dBFS | −12.671715 dBFS |
| Crest factor | 10.088057 dB | 10.087904 dB |
| Full-scale samples | 0 | 0 |
| Stereo correlation | 0.866878568 | 0.866878693 |
| Mono-fold RMS change | −0.299200 dB | −0.299200 dB |
| Low-band correlation | 0.996709836 | 0.996709846 |
| Low-band mono-fold RMS change | −0.007151 dB | −0.007151 dB |
| Adjacent-sample difference peak | −0.686168 dBFS | −0.686062 dBFS |
| Adjacent-sample difference RMS | −28.958776 dBFS | −28.958786 dBFS |

LUFS and true-peak values are rounded by FFmpeg's measurement output; equal displayed values do not imply identical signals. Adjacent-sample differences are an unweighted transient proxy, not a transient-quality score. Low-band figures use two cascaded causal one-pole 150 Hz low-pass filters, continuous from sample zero. Mono/phase measurements characterize these files without certifying playback on every system.

## Alignment, residual and continuity

The normalized cross-product peaks at **zero frames** in a −16…+16-frame lag search sampled every 32 frames. Full-length zero-lag correlation is **0.999999989**. The residual compares the candidate and original at the same sample index and full-scale amplitude, with no gain, delay or loudness fitting:

| Residual measurement | Result |
| --- | ---: |
| Peak | −72.353880 dBFS |
| RMS | −89.079711 dBFS |
| RMS relative to original | −76.407996 dB |
| Adjacent-sample difference peak | −68.799200 dBFS |
| Changed channel samples | 16,370,507 / 16,449,300 |

The precision path retains unrounded voice and track calculations through the master sum, so this residual includes changed rounding through the unchanged nonlinear/effect chain. It is not a pure final-export quantization-error measurement. Nonzero low bytes occur in 16,330,131 PCM24 channel samples; this is a diagnostic of detail below the PCM16 grid, not evidence that the PCM16 source assets gained resolution.

All eight authored section boundaries (bars 9, 17, 25, 33, 41, 49, 53 and 65) were measured with 20 ms windows and adjacent-frame deltas. Between five and 29 dry voices cross each boundary. Track and master effects process the complete continuous timeline; there is no reset-and-concatenate section assembly. No master or PCM24 stem overload was reported. Boundary measurements support technical continuity and retain listening-review locations; they do not certify perceptual seams.

The original's final second is exactly silent. PCM24 retains a low-level decaying tail in that window: **−98.217054 dBFS peak / −116.698213 dBFS RMS**. Both files' final 100 ms and final stereo frame are exactly silent. The longer measurable low-level tail is a consequence of the different processing precision; no tail length or effect setting was edited.

## Provenance and limits

Canonical reference commit: `6b1ab7b8f1602bd4e57244b16caee68d8876336f`. All 163 sound hashes and eight generator-file hashes were rechecked. The production package carries those unchanged PCM16 sources, kits, catalog, source tools and the existing source-license inventory. Node `v24.19.0` / FFmpeg `6.1.1` produced both PCM24 packages; byte reproduction is limited to the recorded toolchain. Listening copies use the same FFmpeg/libmp3lame settings, with the candidate MP3 derived from the final PCM24 master and no additional gain or normalization.

| Identity | SHA-256 |
| --- | --- |
| Locked PCM16 master | `43da3fd7119f5add17ff9896e29d46123cdb1f214ea9fc8e7747513903f1e07d` |
| PCM24 test master | `93e08083ba191cb32ff0c3526712e35970d44cb0ba7135df505e953b92645f1c` |
| Unchanged project | `fb9ca8ad10ca3029b0d873e6190760ba6e20019bb021744e2cf5b1e8de644edb` |
| Canonical catalog | `b03b3c7ed0ea04e245c99cbffa46b6593376df9b5cc5d5b399a97e6c3d1d7f9e` |
| A/B report | `520745a9d5c295ea19b6a5c95bce5bcebfeb420ca95c9b389000fe44c16f3aec` |

PCM24 stems are independently quantized post-track/pre-master exports. Their exported sum need not reproduce the master byte for byte because the master sums original Float64 tracks before master processing and export. No new dither, normalization or mastering decision was applied. PCM16 sources cannot recover lost source information; this workflow preserves newly calculated fractional processing detail.

Human listening, owner license declarations for the sounds/composition/code, and release approval remain pending. No commercial clearance, merge or publication is asserted.
