#!/usr/bin/env bash
# Rootless, noninteractive Linux audio provisioning. No shell startup changes.
set -euo pipefail

fail() { printf 'bootstrap-audio-tools: %s\n' "$*" >&2; exit 1; }
usage() {
  cat <<'EOF'
Usage: ./scripts/bootstrap-audio-tools.sh [--prefix /absolute/user-writable/path]

Installs pinned FluidSynth, FFmpeg and FluidR3 GM under one user-owned prefix.
Default: ${XDG_DATA_HOME:-$HOME/.local/share}/daemonv12/audio-tools
Override: DAEMONV12_AUDIO_PREFIX or --prefix. Linux x86_64, glibc >= 2.28 only.
Prints exports and writes <prefix>/env.sh; never edits shell startup files.
Prerequisites: bash, curl, sha256sum, tar, xz, ar, getconf, realpath, coreutils.
EOF
}
prefix=${DAEMONV12_AUDIO_PREFIX:-${XDG_DATA_HOME:-${HOME:?HOME must be set}/.local/share}/daemonv12/audio-tools}
while (($#)); do
  case "$1" in
    --help|-h) usage; exit 0 ;;
    --prefix) (($# >= 2)) || fail '--prefix requires an absolute path.'; prefix=$2; shift 2 ;;
    *) fail "Unknown argument: $1. Use --help." ;;
  esac
done
[[ $(uname -s) == Linux && $(uname -m) == x86_64 ]] || fail 'Only Linux x86_64 is supported by the checked-in audio lock. Use system tools or sample-only rendering on other platforms.'
for tool in curl sha256sum tar xz ar getconf realpath mkdir mv chmod cmp cat rm rmdir grep dirname uname; do
  command -v "$tool" >/dev/null || fail "Missing prerequisite: $tool. Provide it in PATH; this script cannot install system packages. Sample-only rendering needs only Node."
done
glibc=$(getconf GNU_LIBC_VERSION 2>/dev/null) || fail 'A glibc-based Linux is required; musl/Alpine is unsupported.'
[[ $glibc == 'glibc '* ]] || fail 'A glibc-based Linux is required.'
IFS=. read -r glibc_major glibc_minor <<< "${glibc#glibc }"
((glibc_major > 2 || (glibc_major == 2 && glibc_minor >= 28))) || fail 'This runtime requires glibc >= 2.28. Use sample-only rendering or a newer Linux environment.'
[[ $prefix == /* ]] || fail 'The installation prefix must be absolute.'
prefix=$(realpath -m -- "$prefix")
case "$prefix/" in
  /|/usr/*|/etc/*|/bin/*|/sbin/*|/lib/*|/lib64/*|/var/*|/opt/*|/boot/*|/dev/*|/proc/*|/sys/*)
    fail "Refusing a system directory prefix: $prefix. Choose a directory under your home, workspace or /tmp." ;;
esac
[[ $prefix != / && $prefix != *$'\n'* ]] || fail 'Invalid installation prefix.'
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
lock="$script_dir/audio-tools-linux-64.lock"
[[ -r $lock ]] || fail "Missing checked-in package lock: $lock"
micromamba_version=2.3.2-0
micromamba_sha=ffc3cb8d52d4d6b354bdbb979c407719c485392b74e462cbd50811aa88e58f85
soundfont_sha=6f531493ac4e4d9772fd96b2488ea1790af81c196135fbdd25997da0781fc60e
soundfont_content_sha=74594e8f4250680adf590507a306655a299935343583256f3b722c48a1bc1cb0
mkdir -p -- "$prefix"
[[ -w $prefix ]] || fail "Prefix is not writable: $prefix"
mkdir -- "$prefix/.bootstrap-lock" 2>/dev/null || fail "Another bootstrap may be running. If a previous run was killed, remove $prefix/.bootstrap-lock after checking no bootstrap is active."
stage="$prefix/.bootstrap-stage"
trap 'rm -rf -- "$stage"; rmdir -- "$prefix/.bootstrap-lock"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
mkdir -p -- "$prefix/bin" "$prefix/downloads" "$prefix/soundfonts" "$stage"
export MAMBA_ROOT_PREFIX="$prefix/mamba"
export XDG_CACHE_HOME="$prefix/cache"
export TMPDIR="$stage"

verify() { printf '%s  %s\n' "$2" "$1" | sha256sum --check --status; }
download() {
  local url=$1 target=$2 checksum=$3
  if [[ -f $target ]] && verify "$target" "$checksum"; then return; fi
  printf 'Downloading %s\n' "$url" >&2
  curl --fail --location --silent --show-error --retry 3 --connect-timeout 20 --max-time 600 \
    --proto '=https' --proto-redir '=https' "$url" --output "$target.partial" || fail "Download failed: $url. Check network allowlists, proxy and CA trust. Rerun after fixing access."
  verify "$target.partial" "$checksum" || fail "SHA-256 mismatch for $url. Unverified bytes were not installed; remove $target.partial and retry."
  mv -- "$target.partial" "$target"
}
runtime="$prefix/runtime"
fingerprint=$(sha256sum "$lock")
fingerprint="${fingerprint%% *}:$micromamba_sha:$soundfont_sha"
marker="$prefix/.daemonv12-audio-lock"
if [[ -f $marker ]] && [[ $(cat "$marker") != "$fingerprint" ]]; then
  fail "This prefix contains a different audio lock. Choose a new --prefix to upgrade; existing tools were preserved."
fi
if [[ -d $runtime ]] && [[ ! -f $marker ]]; then
  fail "Existing unmanaged runtime at $runtime. Choose a new --prefix; this script will not overwrite it."
fi
if [[ ! -x $runtime/bin/fluidsynth || ! -x $runtime/bin/ffmpeg ]]; then
  download "https://github.com/mamba-org/micromamba-releases/releases/download/$micromamba_version/micromamba-linux-64" "$prefix/bin/micromamba" "$micromamba_sha"
  chmod u+x -- "$prefix/bin/micromamba"
  # Claim only this script's runtime so an interrupted install can be resumed.
  printf '%s\n' "$fingerprint" > "$marker"
  operation=create
  [[ ! -f $runtime/conda-meta/history ]] || operation=install
  "$prefix/bin/micromamba" --no-rc --no-env --root-prefix "$prefix/mamba" "$operation" --yes --prefix "$runtime" --file "$lock" --safety-checks enabled --extra-safety-checks \
    || fail 'Pinned runtime provisioning failed. No system packages were changed. Fix network/disk/CA errors above, then rerun with the same prefix.'
fi
sf="$prefix/soundfonts/FluidR3_GM.sf2"
if [[ ! -f $sf ]] || ! verify "$sf" "$soundfont_content_sha" || [[ ! -f $prefix/soundfonts/FluidR3-GM.copyright ]]; then
  deb="$prefix/downloads/fluid-soundfont-gm_3.1-5.3_all.deb"
  download 'https://deb.debian.org/debian/pool/main/f/fluid-soundfont/fluid-soundfont-gm_3.1-5.3_all.deb' "$deb" "$soundfont_sha"
  ar p "$deb" data.tar.xz | tar -xJ -C "$stage" \
    ./usr/share/sounds/sf2/FluidR3_GM.sf2 ./usr/share/doc/fluid-soundfont-gm/copyright \
    || fail 'Could not extract the verified Debian SoundFont package (ar/tar/xz required). No dpkg installation is performed.'
  verify "$stage/usr/share/sounds/sf2/FluidR3_GM.sf2" "$soundfont_content_sha" || fail 'Extracted SoundFont SHA-256 mismatch.'
  mv -- "$stage/usr/share/sounds/sf2/FluidR3_GM.sf2" "$sf"
  mv -- "$stage/usr/share/doc/fluid-soundfont-gm/copyright" "$prefix/soundfonts/FluidR3-GM.copyright"
fi
"$runtime/bin/fluidsynth" --version > "$stage/fluidsynth-version" 2>&1 || fail 'FluidSynth cannot start. Check glibc and shared-library errors; sample-only rendering remains available.'
"$runtime/bin/ffmpeg" -version > "$stage/ffmpeg-version" 2>&1 || fail 'FFmpeg cannot start. Check glibc and shared-library errors.'
grep -Eq 'version[[:space:]]+2\.3\.7([[:space:]]|$)' "$stage/fluidsynth-version" || fail 'Runtime FluidSynth differs from pinned 2.3.7. Use a new prefix or restore the locked runtime.'
grep -Eq '^ffmpeg version 6\.1\.1([[:space:]-]|$)' "$stage/ffmpeg-version" || fail 'Runtime FFmpeg differs from pinned 6.1.1. Use a new prefix or restore the locked runtime.'
"$runtime/bin/ffmpeg" -hide_banner -filters > "$stage/filters" 2>&1 || fail 'FFmpeg filter discovery failed.'
"$runtime/bin/ffmpeg" -hide_banner -encoders > "$stage/encoders" 2>&1 || fail 'FFmpeg encoder discovery failed.'
for filter in highpass lowpass aecho acompressor loudnorm; do
  grep -Eq "^[[:space:]]*[A-Z.]{3}[[:space:]]+$filter[[:space:]]" "$stage/filters" || fail "Pinned FFmpeg is missing $filter."
done
grep -Eq '^[[:space:]]*[A-Z.]{6}[[:space:]]+libmp3lame[[:space:]]' "$stage/encoders" || fail 'Pinned FFmpeg is missing libmp3lame.'
{
  printf 'export DAEMONV12_FLUIDSYNTH=%q\n' "$runtime/bin/fluidsynth"
  printf 'export DAEMONV12_SOUNDFONT=%q\n' "$sf"
  printf 'export DAEMONV12_FFMPEG=%q\n' "$runtime/bin/ffmpeg"
  printf 'export PATH=%q:"$PATH"\n' "$runtime/bin"
} > "$prefix/env.sh.tmp"
if [[ -f $prefix/env.sh ]] && cmp -s "$prefix/env.sh.tmp" "$prefix/env.sh"; then rm -- "$prefix/env.sh.tmp"; else mv -- "$prefix/env.sh.tmp" "$prefix/env.sh"; fi
printf '\nAudio tools ready in %s\n' "$prefix"
cat "$prefix/env.sh"
printf '\nApply to this shell: source %q\nPersist these absolute paths in your platform environment settings.\n' "$prefix/env.sh"
