#!/bin/sh
# LOWRIDER//2099: rebuild every sound, write the projects, render through the stock DaemonV12
# engine (WAV + MP3 + stems + provenance), run the QA, and copy the deliverables into ./audio.
# Needs Node 22.18+ and FFmpeg. QA/spectrograms need Python 3 with numpy, scipy, matplotlib.
#   ./render.sh            everything
#   ./render.sh hook       one project (hook | candidate-a-bounce | candidate-b-takeover)
set -e
cd "$(dirname "$0")"
ENGINE=../../bin/daemonv12.js
PROJECTS=${1:-"hook candidate-a-bounce candidate-b-takeover"}

node build-assets.mjs
node make-projects.mjs
mkdir -p audio
for p in $PROJECTS; do
  node "$ENGINE" validate "$p.json"
  node "$ENGINE" render "$p.json" --out-dir "renders/$p" --stems --format wav,mp3 --json > "renders/$p.render-output.json"
  python3 -I tools/qa.py "renders/$p" "$p" --json "renders/$p/qa.json" > /dev/null
  python3 -I tools/spectro.py "renders/$p/$p.wav" "renders/$p/$p.spectrogram.png" 30 16000 "LOWRIDER//2099 $p"
  for f in "$p.wav" "$p.mp3" "$p.render.json" "$p.analysis.json" "$p.spectrogram.png"; do cp "renders/$p/$f" "audio/$f"; done
  cp "renders/$p/qa.json" "audio/$p.qa.json"
  echo "$p: $(sha256sum "audio/$p.wav" | cut -c1-16)  stems in renders/$p/$p.stems/"
done
