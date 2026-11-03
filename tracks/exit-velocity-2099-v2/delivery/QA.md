# EXIT VELOCITY // 2099 V2 — measured delivery QA

Final source: `renders/final-refined/final.wav`, 44.1 kHz / stereo / PCM16, 2,469,600 frames (56.000 s). Mastered with a fixed +6.1 dB gain and triangular dither to PCM16; no limiter or dynamic processing was added at the mastering stage. The WAV has the same sample rate and bit depth as the native engine output. The 320 kbps MP3 is encoded from that master. Source design, arrangement and mix changes occur before this gain stage.

Measurements below use FFmpeg 7.1.5's `ebur128=peak=true`; true peak is an estimate and values are rounded to 0.1 dB. The native DaemonV12 analysis uses a separate loudness implementation and reports slightly different values.

| Measurement | WAV | MP3, gapless decoded |
|---|---:|---:|
| Integrated loudness | −14.6 LUFS | −14.6 LUFS |
| True peak | −1.7 dBTP | −1.8 dBTP |
| Loudness range | 3.6 LU | 3.6 LU |
| Decoded duration | 56.000 s | 56.000 s |

The master WAV's sample peak is −2.00 dBFS; it has zero full-scale samples. Float-decoded MP3 sample peak is −1.96 dBFS, with zero samples at or above full scale. Native engine analysis reports zero full-scale samples on the master and all 12 stems. A gapless MP3 decode yields exactly 2,469,600 stereo frames; MP3 container duration reported by ffprobe includes encoder padding. Last 10 ms WAV RMS is −96.2 dBFS, with only dither-scale signal at the boundary. These checks do not prove an absence of every audible click.

The full-track L/R correlation is +0.993. Averaging L/R to mono changes broadband RMS by −0.015 dB relative to channel-averaged stereo RMS; after a fourth-order 120 Hz low-pass, side energy is 45.1 dB below mid energy. This indicates a very centered low end and little measured cancellation, not a subjective guarantee of mono balance. The lead stem's high-passed (>500 Hz, fourth order) RMS is −24.8 dBFS versus −23.1 dBFS broadband; this confirms substantial upper-frequency energy but does not establish phone-speaker audibility.

The 24.000–27.428 s pre-return window measures −31.37 dBFS RMS, and 27.428–30.857 s measures −14.41 dBFS RMS, a +16.96 dB change. This is a windowed level contrast, not proof of emotional impact.

`original-matched-27s.mp3` and `v2-matched-27s.mp3` contain the same 27.000–42.000 s source interval, including the return. Each decodes to 15.000 s and measures −18.0 LUFS integrated (rounded 0.1 LU) after fixed attenuation of −4.0 dB and −4.2 dB respectively, with 10 ms fade-in and 20 ms fade-out for excerpt boundaries. Decoded true peaks are −5.6 and −6.0 dBTP respectively. Loudness matching does not equalize spectral balance or perceived punch.

A fresh same-environment synthesis reproduced the B assets byte-for-byte; a separate DaemonV12 render reproduced the native final WAV and all 12 stems byte-for-byte.

No human listening is claimed. Technical measurements cannot decide the best treatment, confirm that the hook translates on a phone, or establish musical quality; those remain listening judgments.

Recreate the final master from the native render with:

```sh
ffmpeg -i /tmp/exit-velocity-v2-render/final.wav -af 'volume=6.1dB,aresample=osf=s16:dither_method=triangular' -c:a pcm_s16le /tmp/exit-velocity-v2-master.wav
ffmpeg -i /tmp/exit-velocity-v2-master.wav -codec:a libmp3lame -b:a 320k /tmp/exit-velocity-v2-master-320.mp3
```

Hash identity depends on the FFmpeg encoder and dithering implementation; compare audio and measurements when using another build. SHA-256 values for the delivered files are in `../SHA256SUMS.txt`.
