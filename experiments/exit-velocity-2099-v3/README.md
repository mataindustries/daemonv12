# EXIT VELOCITY // 2099 — V3

An original 54.59-second electronic instrumental at 116 BPM. The opening six-note rubber-pluck gesture alternates with a bass answer over F minor, E-flat, D-flat and C. At the turn, tuned percussion states the gesture before it moves down into the bass; a new high response takes its place. The 15-second highlight begins at 39.31 seconds and includes that turn and the payoff.

- [320 kbps MP3 master](EXIT-VELOCITY-2099-V3.mp3)
- [48 kHz, 24-bit stereo WAV master](EXIT-VELOCITY-2099-V3.wav)
- [15-second highlight](highlight-15s.mp3)
- [Rubber Signal sketch](sketches/01-rubber-signal.mp3) · [Glass Relay sketch](sketches/02-glass-relay.mp3) · [Moon Taxi sketch](sketches/03-moon-taxi.mp3)
- [Aligned 48 kHz stems](stem-delivery/)

The three sketches explore respectively syncopated elastic funk, a 3+3+2 metallic relay against a backbeat, and a swung 12/8 synthetic-reed groove. Rubber Signal was selected on the evidence of its compact melodic contour, call-and-response and potential for register transformation. This is a score-based creative judgment: the renders were not auditioned, and automated checks do not establish replay appeal.

All synthesis is original, from oscillators and seeded noise in `instruments.py`; no external samples are used. `compose.py` is the editable note-level score, arrangement, and mix; `sketches.py` makes the three exploratory renders. Five aligned stems are supplied as lossless FLAC before master-bus processing. The master uses FFmpeg loudness normalization with dynamic true-peak limiting; the stems will not sum to the mastered WAV without that processing.

## Reproduce

Requires Python 3 with NumPy and SciPy, plus FFmpeg with libmp3lame and FLAC. From this directory:

```sh
python sketches.py
python compose.py
python make_daemon_session.py
node ../../bin/daemonv12.js validate daemon-session.json
node ../../bin/daemonv12.js render daemon-session.json --stems --format wav --out-dir daemon-render
```

`compose.py` generates 48 kHz float WAV stems in `stems/`, a float premaster, the 24-bit WAV, MP3, and highlight. For the supplied lossless stem delivery, convert each generated float WAV with `ffmpeg -i stems/NAME.wav -c:a flac -sample_fmt s32 stem-delivery/NAME.flac`. `make_daemon_session.py` converts those generated stems to the engine's 44.1 kHz/16-bit sample format and creates a stem-based DaemonV12 interchange session. The Daemon session is not a note-level project and its render is not the final master; edit `compose.py` for the score. Generated `assets/`, `stems/`, `premaster.wav` and `daemon-render/` are excluded from the repository and can be regenerated.

## Verification

FFprobe: master MP3 320 kbps, stereo, 48 kHz; WAV 48 kHz, 24-bit stereo. FFmpeg EBU R128: −13.6 LUFS integrated, −1.5 dBTP (both WAV and encoded MP3). All synthesizers are deterministic; drum noise uses fixed seeds. These checks do not replace listening.
