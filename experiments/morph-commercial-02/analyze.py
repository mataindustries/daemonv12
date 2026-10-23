#!/usr/bin/env python3
"""Measure picture motion of V1's master, the V2 proof and, optionally, the V12 loop.

    python3 analyze.py --v2 delivery/the-circuit-v2-motion-proof.mp4 [--reference v12.mp4]

Every film is decoded to 270 x 480 grayscale. Per second it reports mean luma, motion
energy (mean absolute difference between adjacent frames, 0-255) and how far the
composition travels (correlation of each frame with the film's first frame). It also
writes vertical kymographs: a centre strip of every frame, side by side over time, so
cuts, camera moves and rhythmic motion appear as visible structure. Descriptive only.
"""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
W, H = 270, 480


def decode(path: Path, limit: int | None = None) -> np.ndarray:
    cmd = ['ffmpeg', '-v', 'error', '-i', str(path), '-vf', f'scale={W}:{H}', '-pix_fmt', 'gray',
           '-f', 'rawvideo', '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    frames = np.frombuffer(raw, np.uint8).reshape(-1, H, W)
    return frames[:limit] if limit else frames


def ncc(a: np.ndarray, b: np.ndarray) -> float:
    a = a - a.mean()
    b = b - b.mean()
    return float((a * b).sum() / np.sqrt((a * a).sum() * (b * b).sum()))


def measure(frames: np.ndarray, fps: int = 60) -> dict:
    f = frames.astype(np.float32)
    luma = f.mean(axis=(1, 2))
    diff = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))
    seconds = []
    for s in range(int(np.ceil(len(f) / fps))):
        a, b = s * fps, min((s + 1) * fps, len(f))
        seconds.append({'second': s, 'meanLuma': round(float(luma[a:b].mean()), 2),
                        'motionEnergy': round(float(diff[a:max(a + 1, b - 1)].mean()), 3),
                        'correlationWithFirstFrame': round(ncc(f[0], f[min(b, len(f)) - 1]), 3)})
    return {'frames': len(f), 'meanMotionEnergy': round(float(diff.mean()), 3),
            'lumaRange': [round(float(luma.min()), 1), round(float(luma.max()), 1)],
            'minCorrelationWithFirstFrame': round(min(ncc(f[0], f[i]) for i in range(0, len(f), 6)), 3),
            'perSecond': seconds}


def kymograph(frames: np.ndarray) -> Image.Image:
    strip = frames[:, :, W // 2 - 35:W // 2 + 35].astype(np.float32).mean(axis=2).T
    return Image.fromarray(np.clip(strip * 1.6, 0, 255).astype(np.uint8)).resize((len(frames), H // 2))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--v1', type=Path, default=HERE.parent / 'morph-commercial-01' / 'delivery' / 'the-circuit.mp4')
    ap.add_argument('--v2', type=Path, required=True)
    ap.add_argument('--reference', type=Path, help='V12 Overdrive loop (not stored in the repository)')
    ap.add_argument('--output', type=Path, default=HERE / 'delivery')
    a = ap.parse_args()
    films = [('V1 THE CIRCUIT (master, frames 0-455)', a.v1, 456), ('V2 ring engine (proof, frames 0-455)', a.v2, 456)]
    if a.reference:
        films.append(('V12 Overdrive loop (reference, 15 s)', a.reference, None))
    report, rows = {}, []
    for label, path, limit in films:
        frames = decode(path, limit)
        report[label] = measure(frames)
        rows.append((label, kymograph(frames)))
    width = max(k.width for _, k in rows) + 20
    sheet = Image.new('RGB', (width, sum(k.height + 30 for _, k in rows) + 10), (12, 14, 16))
    d = ImageDraw.Draw(sheet)
    y = 10
    for label, k in rows:
        d.text((10, y), f'{label} - time runs left to right, one column per frame', fill=(200, 210, 205))
        sheet.paste(k.convert('RGB'), (10, y + 18))
        y += k.height + 30
    a.output.mkdir(parents=True, exist_ok=True)
    sheet.save(a.output / 'motion-kymographs.png')
    (a.output / 'motion-analysis.json').write_text(json.dumps(
        {'method': __doc__.strip().splitlines()[2:7], 'films': report}, indent=1) + '\n')
    for label in report:
        r = report[label]
        print(f"{label}: motion {r['meanMotionEnergy']}, luma {r['lumaRange']}, "
              f"min corr with first frame {r['minCorrelationWithFirstFrame']}")


if __name__ == '__main__':
    main()
