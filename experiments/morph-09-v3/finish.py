#!/usr/bin/env python3
"""MORPH//09 V3 — assemble, grade and mux the proof; build the V2 comparison and review sheets.

    python3 experiments/morph-09-v3/finish.py

Pictures that carry an effect come from the V3 render; every other picture is V2's approved
render, which verify.py shows is pixel-identical to the V3 scene there. The grade and mux are
V2's (imported unchanged): same vignette, approved PCM in the .mov, AAC in the .mp4.
No on-screen text in any film; the review sheets carry labels.
"""
import argparse
import importlib.util
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
_spec = importlib.util.spec_from_file_location('v2finish', HERE.parent / 'morph-09-v2' / 'finish.py')
v2 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(v2)
WORK = ROOT / 'work' / 'morph-09-v3'
NAME = 'morph-09-v3-critical-overload'
COMPARE = [(375, '6.250 s', 'overload begins'), (389, '6.483 s', 'last picture before the lock'),
           (408, '6.800 s', 'brake: particles'), (418, '6.967 s', 'vapor at its peak'),
           (426, '7.100 s', 'leaving the brake'), (450, '7.500 s', 'return: no effect in view')]
DETAIL = [(385, (215, 280, 395, 440), 'arcs, 6.417 s'), (389, (215, 280, 395, 440), 'arcs, 6.483 s'),
          (412, (90, 340, 390, 640), 'particles, 6.867 s'), (418, (60, 300, 340, 560), 'vapor, 6.967 s')]
font = lambda s: ImageFont.truetype(v2.FONT, s)


def run(*a):
    subprocess.run([str(x) for x in a], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--v3', type=Path, default=WORK / 'frames')
    ap.add_argument('--v2', type=Path, default=ROOT / 'work/morph-09-v2/frames')
    ap.add_argument('--preview', type=Path, default=WORK / 'preview')
    ap.add_argument('--out', type=Path, default=HERE / 'delivery')
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)
    proof, graded, v2g = WORK / 'proof', WORK / 'proof-graded', WORK / 'v2-graded'
    for d in (proof, graded, v2g):
        d.mkdir(parents=True, exist_ok=True)
    source = {}
    for f in range(480):
        n = f'{f:04d}.png'
        src = a.v3 / n if (a.v3 / n).exists() else a.v2 / n
        source[f] = 'v3' if src.parent == a.v3 else 'v2'
        shutil.copyfile(src, proof / n)
        v2.grade(proof / n, graded / n)
    for f, *_ in COMPARE:
        v2.grade(a.v2 / f'{f:04d}.png', v2g / f'{f:04d}.png')
    mov, mp4 = a.out / f'{NAME}.mov', a.out / f'{NAME}.mp4'
    run('ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', graded / '%04d.png', '-i', v2.AUDIO,
        '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
        '-tune', 'film', '-c:a', 'copy', '-frames:v', '480', '-movflags', '+faststart', mov)
    run('ffmpeg', '-v', 'error', '-y', '-i', mov, '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', mp4)

    # V2 | V3 side by side, 6.0-8.0 s, with the matching two seconds of the approved audio.
    v2_film = HERE.parent / 'morph-09-v2' / 'delivery' / 'morph-09-v2-inside-the-resonator.mp4'
    run('ffmpeg', '-v', 'error', '-y', '-ss', '6', '-t', '2', '-i', v2_film, '-ss', '6', '-t', '2', '-i', mp4,
        '-filter_complex', '[0:v][1:v]hstack=inputs=2[v]', '-map', '[v]', '-map', '1:a:0',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
        '-movflags', '+faststart', a.out / 'v2-vs-v3-6-8s.mp4')

    # The lightweight effects preview (288 x 512), as first reviewed, with its two seconds of audio.
    if (a.preview / '0360.png').exists():
        run('ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-start_number', '360', '-i', a.preview / '%04d.png',
            '-ss', '6', '-t', '2', '-i', v2.AUDIO, '-map', '0:v:0', '-map', '1:a:0', '-frames:v', '120',
            '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
            '-movflags', '+faststart', a.out / 'vfx-preview-6-8s.mp4')

    # Comparison sheet: V2 above, V3 below, at the review times.
    tw, th = 216, 384
    sheet = Image.new('RGB', (24 + len(COMPARE) * (tw + 12), 2 * th + 170), '#0b0e10')
    d = ImageDraw.Draw(sheet)
    d.text((24, 16), 'MORPH//09  —  V2 (top) vs V3 CRITICAL OVERLOAD (bottom)', font=font(22), fill='#efe3cc')
    for i, (f, t, note) in enumerate(COMPARE):
        x = 24 + i * (tw + 12)
        sheet.paste(Image.open(v2g / f'{f:04d}.png').convert('RGB').resize((tw, th), Image.LANCZOS), (x, 56))
        sheet.paste(Image.open(graded / f'{f:04d}.png').convert('RGB').resize((tw, th), Image.LANCZOS), (x, 66 + th))
        d.text((x, 2 * th + 76), t, font=font(15), fill='#e3a36b')
        d.text((x, 2 * th + 98), note, font=font(12), fill='#b5c2c2')
        d.text((x, 2 * th + 118), f'picture {f} · {source[f]}', font=font(11), fill='#6f7f82')
    sheet.save(a.out / 'v2-v3-comparison.jpg', quality=92)

    # Detail sheet: each effect at 2x, V2 left of V3.
    rows = []
    for f, box, label in DETAIL:
        pair = [Image.open(p).convert('RGB').crop(box) for p in (a.v2 / f'{f:04d}.png', proof / f'{f:04d}.png')]
        k = 360 / pair[0].width
        rows.append(([im.resize((360, int(im.height * k)), Image.LANCZOS) for im in pair], label))
    H = sum(r[0][0].height + 34 for r in rows) + 60
    det = Image.new('RGB', (24 + 2 * 372, H), '#0b0e10')
    d = ImageDraw.Draw(det)
    d.text((24, 16), 'EFFECT DETAIL  —  V2 left · V3 right · 2x', font=font(20), fill='#efe3cc')
    y = 56
    for (left, right), label in rows:
        det.paste(left, (24, y))
        det.paste(right, (24 + 372, y))
        d.text((24, y + left.height + 6), label, font=font(13), fill='#e3a36b')
        y += left.height + 34
    det.save(a.out / 'effect-detail.jpg', quality=92)

    # Contact sheet of the V3 overload, and the untouched seam.
    frames = [(375, '6.250  ONSET'), (385, '6.417  RISING'), (389, '6.483  PEAK'), (396, '6.600  LOCK'),
              (409, '6.817  BRAKE'), (418, '6.967  VAPOR')]
    cs = Image.new('RGB', (24 + len(frames) * (tw + 12), th + 120), '#0b0e10')
    d = ImageDraw.Draw(cs)
    d.text((24, 16), 'MORPH//09 V3  —  CRITICAL OVERLOAD', font=font(22), fill='#efe3cc')
    for i, (f, label) in enumerate(frames):
        x = 24 + i * (tw + 12)
        cs.paste(Image.open(graded / f'{f:04d}.png').convert('RGB').resize((tw, th), Image.LANCZOS), (x, 56))
        d.text((x, th + 66), label, font=font(14), fill='#e3a36b' if f != 396 else '#cfe2ff')
    cs.save(a.out / 'contact-sheet.jpg', quality=92)
    seq = [(477, '7.950 s'), (478, '7.967 s'), (479, '7.983 s'), (0, '8.000 = 0.000 s'), (1, '0.017 s'), (2, '0.033 s')]
    strip = Image.new('RGB', (24 + len(seq) * (tw + 12), th + 120), '#0b0e10')
    d = ImageDraw.Draw(strip)
    d.text((24, 18), 'V3 LOOP BOUNDARY — six consecutive pictures', font=font(20), fill='#efe3cc')
    for i, (f, label) in enumerate(seq):
        x = 24 + i * (tw + 12)
        strip.paste(Image.open(graded / f'{f:04d}.png').convert('RGB').resize((tw, th), Image.LANCZOS), (x, 60))
        d.text((x, th + 70), f'picture {f} · {source[f]}', font=font(13), fill='#e3a36b' if f in (479, 0) else '#8fa3a6')
        d.text((x, th + 90), label, font=font(12), fill='#b5c2c2')
    strip.save(a.out / 'loop-boundary.jpg', quality=92)
    (a.out / 'picture-sources.txt').write_text(
        'Picture source for the assembled proof (v3 = rendered from the V3 scene; v2 = the approved V2 render,\n'
        'pixel-identical to the V3 scene where no effect is active; see v3-audit.json).\n' +
        ''.join(f'{f:04d} {s}\n' for f, s in source.items()))
    print('FINISHED', mov, mp4, sum(1 for s in source.values() if s == 'v3'), 'V3-rendered pictures')


if __name__ == '__main__':
    main()
