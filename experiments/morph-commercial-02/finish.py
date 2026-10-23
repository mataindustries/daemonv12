#!/usr/bin/env python3
"""THE CIRCUIT V2 — finish the motion proof: vignette, grain, lockup, exact black, mux.

    python3 finish.py --frames work/frames --output delivery/the-circuit-v2-motion-proof.mp4

Reads the raw Cycles frames raw-000.png ... raw-455.png. Frames 456-479 are written as
exact black without rendering. The audio track is V1's unchanged PCM reference (hash-checked)
encoded once to AAC for playback; no gain, trim, fade or other processing is applied.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

import choreography as ch

HERE = Path(__file__).resolve().parent
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
STILLS = [0, 105, 215, 240, 300, 390, 440, 455, 456]
SHEET = [0, 60, 105, 180, 215, 232, 240, 270, 330, 360, 390, 420, 440, 450, 455, 456]


class Finisher:
    def __init__(self, width: int, height: int, score: ch.Score):
        self.w, self.h, self.score = width, height, score
        yy, xx = np.mgrid[0:height, 0:width]
        rr = ((xx / width - 0.5) / 0.74) ** 2 + ((yy / height - 0.45) / 0.9) ** 2
        self.vignette = (1 - 0.27 * np.clip(rr, 0, 1)).astype(np.float32)[..., None]
        try:
            self.font = ImageFont.truetype(FONT, round(40 * width / 1080))
            self.small = ImageFont.truetype(FONT, round(16 * width / 1080))
        except OSError:
            self.font = self.small = ImageFont.load_default()

    def frame(self, f: int, raw: Image.Image | None) -> Image.Image:
        if f >= ch.CUT_FRAME:
            return Image.new('RGB', (self.w, self.h))
        ar = np.asarray(raw.convert('RGB')).astype(np.float32) * self.vignette
        grain = np.random.default_rng(6100 + f).normal(0, 0.48, (self.h, self.w, 1))
        out = Image.fromarray(np.clip(ar + grain, 0, 255).astype('uint8'))
        d = ImageDraw.Draw(out)
        margin = round(self.w * 0.075)
        t = f / ch.FPS
        alpha = min(1.0, t / 0.25) if f else 0.3
        d.text((margin, self.h * 0.867), 'THE CIRCUIT', font=self.font,
               fill=tuple(int(c * alpha) for c in (213, 222, 215)))
        d.text((margin, self.h * 0.905), 'M O R P H   / /   C O M M E R C I A L  0 1', font=self.small,
               fill=tuple(int(c * alpha) for c in (108, 139, 137)))
        d.line([(margin, self.h * 0.847), (margin + round(self.w * 0.09), self.h * 0.847)],
               fill=(90, 150, 155), width=max(1, round(self.w / 1080)))
        return out


def contact_sheet(images: dict, out: Path, video_sha: str) -> None:
    """Labelled 4 x 4 sheet of finished frames (the exact pixels sent to the encoder)."""
    tw, th, pad, top = 360, 640, 24, 110
    font = ImageFont.truetype(FONT, 30)
    small = ImageFont.truetype(FONT, 20)
    sheet = Image.new('RGB', (4 * tw + 5 * pad, top + 4 * (th + 56) + 70), (10, 13, 15))
    d = ImageDraw.Draw(sheet)
    d.text((pad, 24), 'THE CIRCUIT V2 — RING ENGINE MOTION PROOF', font=font, fill=(222, 228, 224))
    w, h = images[SHEET[0]].size
    d.text((pad, 66), f'FINISHED FRAMES  /  {w} × {h} PROOF  /  60 FPS  /  8.000 S  /  NOT THE MASTER',
           font=small, fill=(120, 150, 148))
    for i, f in enumerate(SHEET):
        x = pad + (i % 4) * (tw + pad)
        y = top + (i // 4) * (th + 56)
        sheet.paste(images[f].resize((tw, th), Image.Resampling.LANCZOS), (x, y))
        d.rectangle([x - 1, y - 1, x + tw, y + th], outline=(40, 52, 56))
        label = 'BLACKOUT' if f >= ch.CUT_FRAME else ch.shot_of(f).split(' ', 1)[1].upper()
        d.text((x, y + th + 10), f'F{f:03d}  /  {f / ch.FPS:.3f} s', font=small, fill=(200, 210, 205))
        d.text((x + tw - small.getlength(label), y + th + 10), label, font=small,
               fill=(214, 150, 70) if f >= ch.CUT_FRAME else (110, 160, 160))
    d.text((pad, sheet.height - 46), f'MP4 SHA-256 {video_sha}', font=small, fill=(90, 110, 110))
    sheet.save(out, quality=88)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--frames', type=Path, default=HERE / 'work' / 'frames')
    ap.add_argument('--output', type=Path, default=HERE / 'delivery' / 'the-circuit-v2-motion-proof.mp4')
    ap.add_argument('--stills', type=Path, default=None, help='directory for representative finished frames')
    ap.add_argument('--crf', type=int, default=18)
    a = ap.parse_args()
    score = ch.load_score()
    first = Image.open(a.frames / 'raw-000.png')
    w, h = first.size
    fin = Finisher(w, h, score)
    a.output.parent.mkdir(parents=True, exist_ok=True)
    cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}',
           '-r', str(ch.FPS), '-i', 'pipe:0', '-i', str(ch.AUDIO), '-map', '0:v:0', '-map', '1:a:0',
           '-c:v', 'libx264', '-preset', 'slow', '-crf', str(a.crf), '-pix_fmt', 'yuv420p',
           '-c:a', 'aac', '-b:a', '256k', '-ar', '44100', '-video_track_timescale', '60000',
           '-movflags', '+faststart', '-metadata', 'title=THE CIRCUIT V2 | ring engine motion proof',
           str(a.output)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    hashes, keep = {}, {}
    for f in range(ch.FRAMES):
        raw = Image.open(a.frames / f'raw-{f:03d}.png') if f < ch.CUT_FRAME else None
        im = fin.frame(f, raw)
        pixels = im.tobytes()
        proc.stdin.write(pixels)
        hashes[f] = hashlib.sha256(pixels).hexdigest()
        if f in SHEET:
            keep[f] = im
        if a.stills and f in STILLS:
            a.stills.mkdir(parents=True, exist_ok=True)
            im.save(a.stills / f'frame-{f:03d}.png')
    proc.stdin.close()
    if proc.wait():
        raise SystemExit('FFmpeg failed')
    (a.output.parent / (a.output.stem + '.frames.json')).write_text(json.dumps(
        {'width': w, 'height': h, 'fps': ch.FPS, 'frames': ch.FRAMES,
         'finishedFrameSha256RGB': {str(k): v for k, v in hashes.items()}}, indent=1) + '\n')
    contact_sheet(keep, a.output.parent / 'contact-sheet.jpg', ch.sha256(a.output))
    print('FINISHED', a.output)


if __name__ == '__main__':
    main()
