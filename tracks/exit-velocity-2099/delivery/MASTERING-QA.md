# EXIT VELOCITY // 2099 — mastering and QA

Frozen source: `v3.json`, SHA-256 `a50669f7c4eb2cc3ccb9a601f880b76b7dae9185618e2fa3ac92cdf6dfff8447`. DaemonV12 0.7.0, engine commit `23619d1575c6f0f5dd242f14907a4f390871492b`, Node v24.19.0, FFmpeg 6.1.1 (`/workspace/.daemonv12-audio/runtime/bin/ffmpeg`). The project uses sampled instruments and does not require FluidSynth or a SoundFont. The packaged WAV assets and `assets/kit.json` are required to reproduce it.

## Final files and measurements

- `exit-velocity-2099-master.wav`: 44.1 kHz, 16-bit PCM stereo; exactly 2,469,600 frames / 56.000 seconds; integrated −14.66 LUFS, sample peak −1.591 dBFS, estimated true peak −1.45 dBTP, LRA 3.6 LU, zero full-scale samples.
- `exit-velocity-2099-master-320.mp3`: 320 kbps stereo, estimated −14.68 LUFS / −1.58 dBTP; gapless decoding yields exactly 2,469,600 frames. Its MP3 container reports 56.032653 seconds because of encoder delay and padding.
- `exit-velocity-2099-highlight-15s.mp3`: 320 kbps stereo; from master frames 1,152,898 through 1,814,397 inclusive (26.142812–41.142812 seconds), with 20 ms fade-in and 200 ms fade-out. Gapless decoding yields exactly 661,500 frames / 15.000 seconds; estimated −14.44 LUFS / −1.59 dBTP. The MP3 container reports 15.046531 seconds including codec delay and padding.
- `exit-velocity-2099-stems.zip`: 12 production stems; each is 44.1 kHz, 16-bit stereo, 2,469,600 frames, aligned at the start. Archive integrity was verified with `unzip -t`. Stems include each track's gain, pan, automation and effects but exclude the native −3 dB master gain and the final +7 dB mastering gain. To approximate the delivered master from their sum, use the native master stage then the mastering gain; the native 16-bit intermediate quantization can produce small rounding differences.
- `../exit-velocity-2099-note-map.mid` is an explicitly approximate 12-part MIDI map. Its 768 note onsets and mapped pitches match the frozen project. It does not reproduce sampler timbres, glides, envelopes, choke behavior or mix and effects. The engine's own `renders/final/v3.mid` is conductor-only because the project contains no GM tracks.

All 12 native track stages and the native master report zero clipped samples; all exported stems and the mastered WAV report zero exact full-scale samples. Full-scale and true-peak measures are different checks. This does not establish that a source recording could never have been distorted before import.

The opening and final WAV frames are exact zero. The native tail's last nonzero frame is at 55.813673 seconds, leaving about 186 ms of exact silence; the final 20 ms before it peaks at −52.9 dBFS. This is a boundary proxy, not proof of musical replay quality. The opening, payoff and ending were measured and score-inspected; no human headphone, phone, car or speaker listening was performed.

## Processing and reproduction

No compressor or limiter is used. The final WAV is the native master raised by a constant 7.0 dB. Quantization to 16-bit PCM is the only additional waveform operation. The MP3s are encoded from this WAV. The following commands use the exact FFmpeg binary selected by the session. Run from `/workspace/daemonv12/tracks/exit-velocity-2099`; output paths may be changed to avoid overwriting the deliverables.

```sh
# Native engine render, including stems and native analysis/provenance.
node /workspace/daemonv12/bin/daemonv12.js validate v3.json --json
DAEMONV12_FFMPEG=/workspace/.daemonv12-audio/runtime/bin/ffmpeg node /workspace/daemonv12/bin/daemonv12.js render v3.json --out-dir /tmp/exit-velocity-repeat --stems --format wav --json

# Master; FFmpeg 6.1.1, fixed 7 dB gain, 16-bit WAV.
/workspace/.daemonv12-audio/runtime/bin/ffmpeg -hide_banner -nostdin -v error -y -i /tmp/exit-velocity-repeat/v3.wav -map 0:a:0 -map_metadata -1 -map_chapters -1 -af 'volume=7.0dB:precision=double' -c:a pcm_s16le -fflags +bitexact /tmp/exit-velocity-master.wav

# Full-length 320 kbps listening copy.
/workspace/.daemonv12-audio/runtime/bin/ffmpeg -hide_banner -nostdin -v error -y -i /tmp/exit-velocity-master.wav -map 0:a:0 -map_metadata -1 -map_chapters -1 -c:a libmp3lame -b:a 320k -fflags +bitexact /tmp/exit-velocity-master-320.mp3

# Exact 15-second highlight with short edit fades.
/workspace/.daemonv12-audio/runtime/bin/ffmpeg -hide_banner -nostdin -v error -y -i /tmp/exit-velocity-master.wav -map 0:a:0 -map_metadata -1 -map_chapters -1 -af 'atrim=start_sample=1152898:end_sample=1814398,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.02,afade=t=out:st=14.8:d=0.2' -c:a libmp3lame -b:a 320k -fflags +bitexact /tmp/exit-velocity-highlight-15s.mp3

# Master measurement; use only loudnorm's input values for MP3 measurements.
node /workspace/daemonv12/bin/daemonv12.js analyze /tmp/exit-velocity-master.wav --json
/workspace/.daemonv12-audio/runtime/bin/ffmpeg -hide_banner -nostdin -i /tmp/exit-velocity-master-320.mp3 -af loudnorm=print_format=json -f null -
```

The actual repeat render was written to a fresh directory and compared byte-for-byte against the locked native WAV, native MIDI, analysis, manifest, and all 12 named stems. All matched. Applying the gain command to the repeat WAV also matched the delivered master WAV byte-for-byte. This is a same-environment check; results can differ with different engine/audio-tool builds or inputs. MP3 bytes are outside the engine's repeatability guarantee. `SHA256SUMS.txt` records the input and deliverable hashes.
