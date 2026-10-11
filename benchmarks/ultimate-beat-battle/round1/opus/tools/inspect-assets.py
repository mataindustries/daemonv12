"""QC for generated assets: duration, peak, pitch (YIN at mid-sustain), centroid, band shares."""
import glob, json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from audiolib import *

root = os.path.join(os.path.dirname(__file__), "..", "assets")
rows = []
for f in sorted(glob.glob(os.path.join(root, "opus-*", "*.wav"))):
    x, sr = read_wav(f)
    m = mono(x)
    peak = float(db(np.abs(x).max()))
    n = len(m)
    mid = m[int(n * 0.35): int(n * 0.35) + 4096] if n > 9000 else m[n // 4: n // 4 + 2048]
    f0, ap = pitch_yin(mid, fmin=30, fmax=1200)
    note, cents = hz_to_note(f0) if ap < 0.3 else (None, None)
    b = band_shares(x)
    rows.append(dict(file=os.path.relpath(f, root), sec=round(n / sr, 3), ch=x.shape[1], peak=round(peak, 2),
                     f0=round(f0, 1) if f0 and ap < 0.3 else None, note=note, cents=round(cents, 1) if cents is not None else None,
                     centroid=round(centroid(x)), low=round(100 * (b["30-60"] + b["60-120"]), 1),
                     mid=round(100 * (b["500-2000"]), 1), pres=round(100 * b["2000-6000"], 1), air=round(100 * (b["6000-12000"] + b["12000-22050"]), 1)))
for r in rows:
    print(f"{r['file']:28s} {r['sec']:5.3f}s ch{r['ch']} pk{r['peak']:6.1f} f0 {str(r['f0']):>7s} {str(r['note']):>4s} {str(r['cents']):>6s}c  cen {r['centroid']:5d}  <120 {r['low']:5.1f}% mid {r['mid']:5.1f}% 2-6k {r['pres']:5.1f}% >6k {r['air']:5.1f}%")
