#!/usr/bin/env python3
"""MORPH//09 V2 — describe V1's and V2's motion with the same simple measures.

    python3 experiments/morph-09-v2/analyze.py --v2 experiments/morph-09-v2/delivery/<proof>.mp4

Each film is decoded to 135 × 240 grey (V1 is letterboxed to the same frame). Per second:
motion energy (mean absolute difference between adjacent pictures, 0-255) and mean luma.
Framing travel: the lowest correlation between any picture and picture 0. Descriptive only.
"""
import argparse
import json
import subprocess
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
W, H = 135, 240


def decode(path: Path) -> np.ndarray:
    vf = f'scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,format=gray'
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-vf', vf, '-f', 'rawvideo', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)


def describe(frames: np.ndarray) -> dict:
    diffs = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))
    luma = frames.mean(axis=(1, 2))
    f0 = frames[0].ravel() - frames[0].mean()
    corr = []
    for fr in frames:
        v = fr.ravel() - fr.mean()
        corr.append(float(f0 @ v / (np.linalg.norm(f0) * np.linalg.norm(v) + 1e-9)))
    seam = float(np.abs(frames[0] - frames[-1]).mean())
    return {'frames': len(frames),
            'motionEnergyPerSecond': [round(float(diffs[s * 60:(s + 1) * 60].mean()), 2) for s in range(8)],
            'meanLumaPerSecond': [round(float(luma[s * 60:(s + 1) * 60].mean()), 1) for s in range(8)],
            'lowestCorrelationWithFrame0': round(min(corr), 3),
            'loopSeamDifference': round(seam, 2), 'medianAdjacentDifference': round(float(np.median(diffs)), 2)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--v1', type=Path, default=ROOT / 'experiments/morph-09/review/overtone-preview.mp4')
    ap.add_argument('--v2', type=Path, required=True)
    ap.add_argument('--out', type=Path, default=HERE / 'delivery/motion-analysis.json')
    a = ap.parse_args()
    report = {'method': ' '.join(x.strip() for x in __doc__.strip().splitlines()[4:8]), 'v1': describe(decode(a.v1)), 'v2': describe(decode(a.v2))}
    a.out.write_text(json.dumps(report, indent=1) + '\n')
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
