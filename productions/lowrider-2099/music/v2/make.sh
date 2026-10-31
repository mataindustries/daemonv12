#!/bin/sh
# LOWRIDER//2099 v2, end to end: sounds -> Mouth Drop (two-pass) -> projects -> engine render
# (WAV + stems) -> master (24-bit WAV + 320k MP3) -> QA + spectrograms -> ../../review/music.
# Needs Node 22.18+ and FFmpeg; QA needs Python 3 with numpy, scipy, matplotlib.
set -e
cd "$(dirname "$0")"
ENGINE=../../../../bin/daemonv12.js
QA=../../qa
OUT=../../review/music
node build-assets.mjs
node arrange.mjs --prepass crest
node "$ENGINE" render crest.prepass.json --out-dir renders/crest-prepass > /dev/null
node build-mouth.mjs
node arrange.mjs
mkdir -p "$OUT"
for p in crest hover; do
  node "$ENGINE" validate "$p.json" > /dev/null
  node "$ENGINE" render "$p.json" --out-dir "renders/$p" --stems --format wav --json > "renders/$p.out.json"
  node master.mjs "$p"
  python3 -I "$QA/qa.py" "renders/$p" "$p" --master "masters/$p.wav" --json "masters/$p.qa.json" > /dev/null
  python3 -I "$QA/spectro.py" "masters/$p.wav" "masters/$p.spectrogram.png" 30 16000 "LOWRIDER//2099 v2 $p (master)"
  cp "masters/$p.mp3" "masters/$p.wav" "masters/$p.master.json" "masters/$p.qa.json" "masters/$p.spectrogram.png" "$OUT/"
  cp "renders/$p/$p.render.json" "$OUT/$p.render.json"
done
echo "v2 done: $OUT"
