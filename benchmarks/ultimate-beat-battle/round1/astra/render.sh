#!/usr/bin/env bash
set -euo pipefail
source /workspace/.daemonv12-audio/env.sh
cat > /tmp/daemonv12-fluidsynth-headless <<'EOF'
#!/usr/bin/env bash
set -e

export SDL_AUDIODRIVER=dummy

REAL=/workspace/.daemonv12-audio/runtime/bin/fluidsynth

if [[ "${1:-}" == "--version" ]]; then
  exec "$REAL" --version
fi

exec "$REAL" \
  -a file \
  -o player.timing-source=sample \
  "$@"
EOF
chmod +x /tmp/daemonv12-fluidsynth-headless
export SDL_AUDIODRIVER=dummy
export DAEMONV12_FLUIDSYNTH=/tmp/daemonv12-fluidsynth-headless
export DAEMONV12_SOUNDFONT=/workspace/.daemonv12-audio/soundfonts/FluidR3_GM.sf2
export DAEMONV12_FFMPEG=/workspace/.daemonv12-audio/runtime/bin/ffmpeg
cd /workspace/daemonv12
test "$(git rev-parse HEAD)" = ed75e9e2a0172266e56b292886ad7c1500677862
exec node bin/daemonv12.js render "$@"
