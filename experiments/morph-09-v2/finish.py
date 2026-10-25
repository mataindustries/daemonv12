#!/usr/bin/env python3
"""MORPH//09 V2 — finish the proof: lens vignette, mux the approved audio, build review sheets.

    python3 experiments/morph-09-v2/finish.py --frames work/morph-09-v2/frames \
        --stills work/morph-09-v2/stills --out experiments/morph-09-v2/delivery

The PCM reference (.mov) carries OVERTONE's samples unchanged; the .mp4 is the AAC viewing
copy for phones. No DSP, retiming or music edits. Frames are graded identically, so the loop
seam is untouched by the finish.
"""
import argparse
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
AUDIO = ROOT / 'experiments/morph-08/candidates/overtone.wav'
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
STILLS = [  # (picture frame, label, what it shows)
    (24, '00.400  CONTACT', 'Bar 3 strikes the brush; fork 1, selected by it, rises behind'),
    (242, '04.033  THE CROWN', 'Half-time downbeat: the tallest fork rings'),
    (396, '06.600  A1 LOCK', 'Strobe: rotor, governor and five forks frozen'),
    (423, '07.050  BRAKE', 'The disc rim glows from the stop; the camera dives home'),
]


def vignette(shape, strength=0.28):
    h, w = shape[:2]
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.hypot((x - w / 2) / (w / 2), (y - h / 2) / (h / 2)) / np.sqrt(2)
    return (1.0 - strength * np.clip(r, 0, 1) ** 2.2)[..., None]


def grade(src: Path, dst: Path):
    im = np.asarray(Image.open(src).convert('RGB'), dtype=np.float32)
    out = np.clip(im * vignette(im.shape) + 0.5, 0, 255).astype(np.uint8)
    Image.fromarray(out).save(dst, compress_level=3)


def run(*a):
    subprocess.run([str(x) for x in a], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--frames', type=Path, default=ROOT / 'work/morph-09-v2/frames')
    ap.add_argument('--stills', type=Path, default=ROOT / 'work/morph-09-v2/stills')
    ap.add_argument('--out', type=Path, default=HERE / 'delivery')
    ap.add_argument('--name', default='morph-09-v2-inside-the-resonator')
    args = ap.parse_args()
    graded = args.frames.parent / (args.frames.name + '-graded')
    graded.mkdir(parents=True, exist_ok=True)
    args.out.mkdir(parents=True, exist_ok=True)
    names = [f'{f:04d}.png' for f in range(480)]
    missing = [n for n in names if not (args.frames / n).exists()]
    assert not missing, f'missing frames: {missing[:5]}…'
    for n in names:
        grade(args.frames / n, graded / n)
    mov = args.out / f'{args.name}.mov'
    mp4 = args.out / f'{args.name}.mp4'
    run('ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', graded / '%04d.png', '-i', AUDIO,
        '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
        '-tune', 'film', '-c:a', 'copy', '-frames:v', '480', '-movflags', '+faststart', mov)
    run('ffmpeg', '-v', 'error', '-y', '-i', mov, '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', mp4)

    font = lambda s: ImageFont.truetype(FONT, s)
    # Representative stills, graded like the film.
    sdir = args.out / 'stills'
    sdir.mkdir(exist_ok=True)
    tiles = []
    for frame, label, note in STILLS:
        src = args.stills / f'{frame:04d}.png'
        stem = f'still-{round(frame / 0.06):04d}'
        if src.exists():
            grade(src, sdir / f'{stem}.png')
            tiles.append((Image.open(sdir / f'{stem}.png').convert('RGB'), label, note))
    if tiles:
        tw, th = 360, 640
        sheet = Image.new('RGB', (24 + len(tiles) * (tw + 24), th + 170), '#0b0e10')
        d = ImageDraw.Draw(sheet)
        d.text((24, 22), 'MORPH//09 V2  —  INSIDE THE RESONATOR', font=font(28), fill='#efe3cc')
        d.text((24, 60), 'OVERTONE · one unbroken take · 8.000 s loop · representative stills', font=font(15), fill='#8fa3a6')
        for i, (im, label, note) in enumerate(tiles):
            x = 24 + i * (tw + 24)
            sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, 96))
            d.text((x, th + 108), label, font=font(17), fill='#e3a36b')
            d.text((x, th + 136), note, font=font(12), fill='#b5c2c2')
        sheet.save(args.out / 'contact-sheet.jpg', quality=92)

    # The real loop boundary: four consecutive pictures, no duplicated closing frame.
    seq = [(477, '7.950 s'), (478, '7.967 s'), (479, '7.983 s'), (0, '8.000 s = 0.000 s'), (1, '0.017 s'), (2, '0.033 s')]
    tw, th = 216, 384
    strip = Image.new('RGB', (24 + len(seq) * (tw + 12), th + 120), '#0b0e10')
    d = ImageDraw.Draw(strip)
    d.text((24, 18), 'LOOP BOUNDARY — six consecutive pictures across the seam', font=font(20), fill='#efe3cc')
    for i, (f, label) in enumerate(seq):
        x = 24 + i * (tw + 12)
        strip.paste(Image.open(graded / f'{f:04d}.png').convert('RGB').resize((tw, th), Image.LANCZOS), (x, 60))
        d.text((x, th + 70), f'frame {f}', font=font(13), fill='#e3a36b' if f in (479, 0) else '#8fa3a6')
        d.text((x, th + 90), label, font=font(12), fill='#b5c2c2')
    strip.save(args.out / 'loop-boundary.jpg', quality=92)
    print('FINISHED', mov, mp4)


if __name__ == '__main__':
    main()
