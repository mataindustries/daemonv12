"""Assemble a CPU motion proof into reviewable files (no GPU, no Colab).

Takes the PNG frames written by `angeles2099.py --frames 0-599 --out-dir DIR` and the locked CREST
master, and writes into OUT:
  crest-motion-proof.mp4   all 600 frames with the master, scaled 2x for a phone screen
  loop-check.mp4           the last 2 s into the first 2 s, twice, with the audio stitched the same way
  contact.jpg              the key moments (drift, blimp shadow, Mouth Drop, slam, multiplane, loop)
  seam.json                how big the loop cut is compared with ordinary frame-to-frame change

usage: python3 blender/motion_proof.py FRAMES_DIR OUT_DIR [--audio music/v2/masters/crest.wav]
"""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

PROD = Path(__file__).resolve().parents[1]
FPS = 24
KEY = [(128, "drift: counter-flick"), (150, "drift: lean"), (180, "blimp shadow"), (229, "hop: pre-squat"), (233, "hop: top"),
       (300, "Mouth Drop: ah"), (320, "oh / oo: rolling"), (338, "mm: sealing"), (352, "breath"), (364, "slam: unwind"),
       (372, "slam: overshoot"), (420, "crane: multiplane"), (470, "megacity"), (500, "hero slide"), (590, "loop: hop"),
       (596, "loop: whip-in"), (599, "loop: last frame"), (0, "loop: first frame")]


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"{' '.join(cmd[:3])}... failed:\n{r.stderr[-800:]}")


def frame(d, f):
    return np.asarray(Image.open(d / f"frame_{f:04d}.png").convert("RGB")).astype(np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("frames")
    ap.add_argument("out")
    ap.add_argument("--audio", default=str(PROD / "music/v2/masters/crest.wav"))
    a = ap.parse_args()
    src, out = Path(a.frames), Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    n = len(list(src.glob("frame_*.png")))
    w, h = Image.open(src / "frame_0000.png").size
    scale = f"scale={w * 2}:{h * 2}:flags=lanczos"
    mp4 = out / "crest-motion-proof.mp4"
    run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", str(src / "frame_%04d.png"), "-i", a.audio,
         "-vf", scale, "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
         "-shortest", "-movflags", "+faststart", str(mp4)])
    # loop check: frames n-48..n-1 then 0..47, twice; audio 23-25 s then 0-2 s, twice
    lst = out / "loop-frames.txt"
    seq = (list(range(n - 48, n)) + list(range(0, 48))) * 2
    lst.write_text("".join(f"file '{(src / f'frame_{f:04d}.png').resolve()}'\nduration {1 / FPS:.6f}\n" for f in seq))
    dur = n / FPS
    run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-i", a.audio, "-filter_complex",
         f"[1:a]asplit=2[a1][a2];[a1]atrim={dur - 2}:{dur},asetpts=N/SR/TB,asplit=2[e1][e2];[a2]atrim=0:2,asetpts=N/SR/TB,asplit=2[s1][s2];"
         f"[e1][s1][e2][s2]concat=n=4:v=0:a=1[a];"
         f"[0:v]{scale},fps={FPS}[v]",
         "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
         "-movflags", "+faststart", str(out / "loop-check.mp4")])
    lst.unlink()
    # contact sheet
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
    cols = 6
    rows = (len(KEY) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (w + 4), rows * (h + 20)), (18, 15, 28))
    dr = ImageDraw.Draw(sheet)
    for i, (f, label) in enumerate(KEY):
        x, y = (i % cols) * (w + 4), (i // cols) * (h + 20)
        sheet.paste(Image.open(src / f"frame_{f:04d}.png").convert("RGB"), (x, y + 20))
        dr.text((x + 3, y + 3), f"f{f} {label}", fill=(236, 230, 242), font=font)
    sheet.save(out / "contact.jpg", quality=88)
    # the seam, measured: mean absolute change 599 -> 0 against ordinary consecutive frames
    diffs = []
    prev = frame(src, 0)
    for f in range(1, n):
        cur = frame(src, f)
        diffs.append(float(np.abs(cur - prev).mean()))
        prev = cur
    seam = float(np.abs(frame(src, 0) - frame(src, n - 1)).mean())
    d = np.array(diffs)
    rep = {"seamMeanAbsDiff": round(seam, 2), "consecutiveMedian": round(float(np.median(d)), 2), "consecutiveP90": round(float(np.percentile(d, 90)), 2),
           "consecutiveMax": round(float(d.max()), 2), "seamPercentile": round(float((d < seam).mean() * 100), 1),
           "lumaLastFirst": [round(float(frame(src, n - 1).mean()), 1), round(float(frame(src, 0).mean()), 1)],
           "note": "seamPercentile: the share of ordinary frame-to-frame changes in the piece that are smaller than the loop cut"}
    (out / "seam.json").write_text(json.dumps(rep, indent=1) + "\n")
    print(json.dumps(rep))
    print("wrote", mp4, out / "loop-check.mp4", out / "contact.jpg")


if __name__ == "__main__":
    main()
