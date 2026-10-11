#!/bin/sh
# GLASS//FIRE web cut: turns the final 1080p60 promo master into the files the site serves.
#
#   npm run promo:web -- /path/to/glass-fire-1080p60.mp4 [poster-seconds]
#
# Writes public/media/glass-fire-720p60.mp4 and public/media/glass-fire-poster.jpg:
#   - H.264 High, 1280x720, source frame rate (60 fps), yuv420p, two-pass ~3.2 Mb/s
#     (about 10 MiB for 24 s), AAC 128 kb/s when the master has audio, +faststart;
#   - a 1280x720 JPEG poster. The default 23.3 s is the payoff card (bar 16, beat 2-4:
#     DAEMONV12 / GIVE AGENTS INSTRUMENTS.) before the cut to black at 23.625 s.
# Fails if the result exceeds Cloudflare Pages' 25 MiB per-file limit; warns above 12 MiB.
set -eu

src=${1:-}
poster_at=${2:-23.3}
if [ -z "$src" ] || [ ! -f "$src" ]; then
  echo "usage: npm run promo:web -- /path/to/glass-fire-1080p60.mp4 [poster-seconds]" >&2
  exit 2
fi
for tool in ffmpeg ffprobe; do
  command -v "$tool" >/dev/null 2>&1 || { echo "$tool is required" >&2; exit 2; }
done

here=$(cd "$(dirname "$0")/.." && pwd)
out="$here/public/media"
video="$out/glass-fire-720p60.mp4"
poster="$out/glass-fire-poster.jpg"
mkdir -p "$out"

probe() { ffprobe -v error -select_streams "$1" -show_entries "$2" -of default=nw=1:nk=1 "$src" | head -n 1; }
fps=$(probe v:0 stream=avg_frame_rate)
duration=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$src")
audio=$(probe a stream=codec_type)
echo "source: $src (${duration}s, ${fps} fps, audio: ${audio:-none})"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT INT TERM

vf="scale=1280:720:flags=lanczos,format=yuv420p"
x264="-c:v libx264 -preset slow -profile:v high -level:v 4.0 -b:v 3200k -maxrate 4500k -bufsize 9000k -g 120 -keyint_min 60"

# shellcheck disable=SC2086 # word splitting of $x264 is intended
ffmpeg -hide_banner -loglevel error -y -i "$src" -map 0:v:0 -vf "$vf" $x264 \
  -pass 1 -passlogfile "$tmp/x264" -an -f mp4 /dev/null

if [ -n "$audio" ]; then
  set -- -map 0:a:0 -c:a aac -b:a 128k -ac 2
else
  set -- -an
fi
# shellcheck disable=SC2086
ffmpeg -hide_banner -loglevel error -y -i "$src" -map 0:v:0 -vf "$vf" $x264 \
  -pass 2 -passlogfile "$tmp/x264" "$@" -movflags +faststart "$tmp/web.mp4"
mv "$tmp/web.mp4" "$video"

ffmpeg -hide_banner -loglevel error -y -ss "$poster_at" -i "$src" -frames:v 1 \
  -vf "scale=1280:720:flags=lanczos" -q:v 3 "$poster"

bytes=$(wc -c < "$video" | tr -d ' ')
mib=$(awk "BEGIN { printf \"%.2f\", $bytes / 1048576 }")
echo "wrote public/media/glass-fire-720p60.mp4 (${mib} MiB) and public/media/glass-fire-poster.jpg (frame at ${poster_at}s)"
if [ "$bytes" -gt 26214400 ]; then
  echo "error: over Cloudflare Pages' 25 MiB per-file limit" >&2
  exit 1
fi
if [ "$bytes" -gt 12582912 ]; then
  echo "warning: over the 12 MiB budget; lower -b:v in this script" >&2
fi
echo "check the poster, then: git add public/media && npm run build"
