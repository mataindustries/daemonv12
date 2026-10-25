#!/usr/bin/env python3
"""Finish the locked MORPH//09 V3 master from 480 genuine 1080x1920 renders.

Only the approved V2 vignette is applied. The MOV preserves the original PCM stream;
the Android MP4 copies the same H.264 pictures and uses AAC for playback.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import subprocess
import wave
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
WORK = ROOT / 'work/morph-09-v3-master'
AUDIO = ROOT / 'experiments/morph-08/candidates/overtone.wav'
AUDIO_SHA256 = 'f771979966ce4b85ff96e44474f3259bf2da3f576a71bf0847af9d37e5b4111c'
SOURCE_COMMIT = '9e8a03d2b5bfed15f8056970ca3b4cdb1c2cfbc7'
NAME = 'morph-09-v3-critical-overload-1080p'
SIZE = (1080, 1920)
NAMES = [f'{f:04d}.png' for f in range(480)]
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
# Keep the approved proof's RGB-to-YUV matrix and declare it explicitly. Merely
# labelling its BT.601 YUV as BT.709 would change the copper on HD-only decoders.
# AgX's existing sRGB display output supplies the primaries and transfer labels;
# setparams labels those values without a transfer or gamut conversion.
VIDEO_FILTER = ('format=yuv420p,'
                'setparams=range=limited:color_primaries=bt709:'
                'color_trc=iec61966-2-1:colorspace=smpte170m,setsar=1')

spec = importlib.util.spec_from_file_location('approved_v2_finish', HERE.parent.parent / 'morph-09-v2/finish.py')
v2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v2)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def write_json(path: Path, data):
    part = path.with_name(path.name + '.part')
    part.write_text(json.dumps(data, indent=2, sort_keys=True) + '\n')
    os.replace(part, path)


def inventory(directory: Path):
    actual = {p.name for p in directory.iterdir() if p.suffix.lower() == '.png'}
    expected = set(NAMES)
    if actual != expected:
        raise ValueError(f'{directory}: missing {sorted(expected - actual)[:8]}, unexpected {sorted(actual - expected)[:8]}')
    rows = []
    for f, name in enumerate(NAMES):
        path = directory / name
        with Image.open(path) as im:
            im.load()
            if im.size != SIZE or im.format != 'PNG':
                raise ValueError(f'{path}: expected PNG {SIZE}, got {im.format} {im.size}')
        rows.append({'frame': f, 'file': name, 'sha256': sha256(path)})
    return rows


def run(*args):
    command = [str(x) for x in args]
    subprocess.run(command, check=True)
    return command


def thumb(path: Path, size):
    with Image.open(path) as im:
        return im.convert('RGB').resize(size, Image.Resampling.LANCZOS)


def font(size):
    try:
        return ImageFont.truetype(FONT, size)
    except OSError:
        return ImageFont.load_default(size=size)


def review_sheets(graded: Path, out: Path):
    chosen = [(0, 'OPENING'), (24, 'CONTACT'), (240, 'CROWN'), (373, 'FIRST ARC'),
              (389, 'PEAK ARC'), (396, 'A1 LOCK'), (406, 'BRAKE'), (418, 'VAPOR'),
              (433, 'VAPOR ENDS'), (450, 'RETURN'), (479, 'LAST PICTURE')]
    tw, th, gap, cols = 270, 480, 18, 4
    stride = th + 52
    rows = (len(chosen) + cols - 1) // cols
    sheet = Image.new('RGB', (gap + cols * (tw + gap), 76 + rows * stride + gap), '#0b0e10')
    draw = ImageDraw.Draw(sheet)
    draw.text((gap, 16), 'MORPH//09 V3 — CRITICAL OVERLOAD', font=font(25), fill='#efe3cc')
    draw.text((gap, 49), '1080 × 1920 · 60 fps · 480 pictures · 8.000 s · original OVERTONE', font=font(16), fill='#8fa3a6')
    for i, (f, label) in enumerate(chosen):
        x, y = gap + (i % cols) * (tw + gap), 76 + (i // cols) * stride
        sheet.paste(thumb(graded / NAMES[f], (tw, th)), (x, y))
        draw.text((x, y + th + 7), f'{f:04d} · {f / 60:.3f} s · {label}', font=font(14), fill='#e3a36b')
    sheet.save(out / 'contact-sheet.jpg', quality=94, subsampling=0)

    sequence = [477, 478, 479, 0, 1, 2]
    tw, th = 216, 384
    strip = Image.new('RGB', (gap + 6 * (tw + gap), th + 132), '#0b0e10')
    draw = ImageDraw.Draw(strip)
    draw.text((gap, 17), 'LOOP BOUNDARY — consecutive pictures across 479 → 0', font=font(23), fill='#efe3cc')
    draw.text((gap, 49), 'The last displayed picture is 7.983 s; no duplicate closing picture is inserted.', font=font(15), fill='#8fa3a6')
    for i, f in enumerate(sequence):
        x = gap + i * (tw + gap)
        strip.paste(thumb(graded / NAMES[f], (tw, th)), (x, 78))
        draw.text((x, th + 87), f'{f:04d} · {f / 60:.3f} s', font=font(16), fill='#e3a36b' if f in (479, 0) else '#b5c2c2')
    strip.save(out / 'loop-boundary.jpg', quality=94, subsampling=0)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--frames', type=Path, default=WORK / 'frames')
    ap.add_argument('--graded', type=Path, default=WORK / 'graded')
    ap.add_argument('--out', type=Path, default=HERE / 'delivery')
    ap.add_argument('--name', default=NAME)
    a = ap.parse_args()
    if a.frames.resolve() == a.graded.resolve():
        raise ValueError('The grading destination must be separate from the raw render frames.')
    if Path(a.name).name != a.name or a.name in ('', '.', '..'):
        raise ValueError('--name must be a filename stem')
    if sha256(AUDIO) != AUDIO_SHA256:
        raise ValueError('The original approved OVERTONE WAV does not match its locked SHA-256.')
    with wave.open(str(AUDIO), 'rb') as wav:
        audio_meta = {'channels': wav.getnchannels(), 'sampleRate': wav.getframerate(),
                      'sampleWidthBytes': wav.getsampwidth(), 'sampleFrames': wav.getnframes()}
        if wav.getnframes() != 8 * wav.getframerate():
            raise ValueError('Approved source audio is not exactly 8 seconds.')
    raw = inventory(a.frames)
    a.out.mkdir(parents=True, exist_ok=True)
    a.graded.mkdir(parents=True, exist_ok=True)
    unwanted = {p.name for p in a.graded.iterdir() if p.suffix.lower() == '.png'} - set(NAMES)
    if unwanted:
        raise ValueError(f'Unexpected PNG files in graded directory: {sorted(unwanted)[:8]}')
    state_path = a.graded / 'grade-state.json'
    try:
        previous = json.loads(state_path.read_text())
    except (OSError, ValueError):
        previous = {}
    grade_hash = sha256(Path(v2.__file__))
    if previous.get('approvedFinishSha256') != grade_hash:
        previous = {}
    state = {'approvedFinishSha256': grade_hash, 'frames': {}}
    frames = []
    for row in raw:
        name = row['file']
        old = previous.get('frames', {}).get(name, {})
        dst = a.graded / name
        cached = (old.get('rawSha256') == row['sha256'] and dst.exists()
                  and old.get('gradedSha256') == sha256(dst))
        if not cached:
            part = a.graded / f'.part-{name}'
            v2.grade(a.frames / name, part)
            os.replace(part, dst)
        graded_sha = sha256(dst)
        state['frames'][name] = {'rawSha256': row['sha256'], 'gradedSha256': graded_sha}
        frames.append({'frame': row['frame'], 'file': name, **state['frames'][name]})
        write_json(state_path, state)
    inventory(a.graded)
    mov = a.out / f'{a.name}.mov'
    mp4 = a.out / f'{a.name}.mp4'
    mov_part = a.out / f'.{a.name}.part.mov'
    mp4_part = a.out / f'.{a.name}.part.mp4'
    commands = []
    commands.append(run('ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-start_number', '0',
                        '-i', a.graded / '%04d.png', '-i', AUDIO, '-map', '0:v:0', '-map', '1:a:0',
                        '-vf', VIDEO_FILTER,
                        '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
                        '-profile:v', 'high', '-level:v', '4.2', '-tune', 'film', '-c:a', 'copy',
                        '-frames:v', '480', '-fps_mode', 'passthrough', '-video_track_timescale', '60000',
                        '-movflags', '+faststart', mov_part))
    os.replace(mov_part, mov)
    commands.append(run('ffmpeg', '-v', 'error', '-y', '-i', mov, '-map', '0:v:0', '-map', '0:a:0',
                        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', mp4_part))
    os.replace(mp4_part, mp4)
    review_sheets(a.graded, a.out)
    outputs = [mov, mp4, a.out / 'contact-sheet.jpg', a.out / 'loop-boundary.jpg']
    manifest = {'kind': 'morph09-v3-master-finish', 'sourceCommit': SOURCE_COMMIT,
                'audio': {'path': str(AUDIO.relative_to(ROOT)), 'sha256': AUDIO_SHA256, **audio_meta},
                'settings': {'dimensions': list(SIZE), 'frameRate': '60/1', 'frames': 480,
                             'durationSeconds': 8.0, 'vignette': 'unchanged V2 finish.grade',
                             'v2FinishSha256': grade_hash, 'h264Crf': 16, 'h264Preset': 'slow',
                             'h264Profile': 'high', 'h264Level': '4.2', 'pixelFormat': 'yuv420p',
                             'sampleAspectRatio': '1:1', 'displayAspectRatio': '9:16',
                             'colorRange': 'tv', 'colorSpace': 'smpte170m',
                             'colorPrimaries': 'bt709', 'colorTransfer': 'iec61966-2-1',
                             'rgbToYuvMatrix': 'unchanged approved proof BT.601 conversion; explicit metadata only',
                             'aacBitrate': '256k', 'videoCopiedFromMovToMp4': True,
                             'noVideoOverlays': True, 'noAudioDsp': True},
                'frames': frames, 'commands': commands,
                'ffmpegVersion': subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True, check=True).stdout.splitlines()[0],
                'outputs': {p.name: {'sha256': sha256(p), 'bytes': p.stat().st_size} for p in outputs}}
    write_json(a.out / 'finish-manifest.json', manifest)
    print(json.dumps({'finished': [str(p) for p in outputs], 'frames': len(frames)}, indent=2))


if __name__ == '__main__':
    main()
