"""Click/discontinuity screen: second difference of each stem vs a local (20 ms) RMS of the same
signal. A sample whose |d2| exceeds 12x the local d2 RMS and lies in a quiet-ish context is a
candidate click. Prints the strongest candidates per file with times. Analytical screen only."""
import glob, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from audiolib import *

def screen(path, top=4):
    x, _ = read_wav(path)
    m = mono(x)
    d2 = np.abs(np.diff(m, 2))
    w = int(0.02 * SR)
    k = np.ones(w) / w
    loc = np.sqrt(np.convolve(d2 ** 2, k, mode="same")) + 1e-9
    env = np.sqrt(np.convolve(m[1:-1] ** 2, k, mode="same")) + 1e-9
    ratio = d2 / loc
    cand = np.where((ratio > 12) & (d2 > 10 ** (-60 / 20)))[0]
    out = []
    last = -10 ** 9
    for i in cand[np.argsort(-ratio[cand])]:
        if any(abs(i - j) < SR * 0.05 for j, _ in out):
            continue
        out.append((i, ratio[i]))
        if len(out) >= top:
            break
    return [(round(i / SR, 3), round(float(r), 1), round(float(db(d2[i])), 1), round(float(db(env[i])), 1)) for i, r in sorted(out)]

d = sys.argv[1]
for f in [os.path.join(d, "project.wav")] + sorted(glob.glob(os.path.join(d, "project.stems", "*.wav"))):
    c = screen(f)
    print(f"{os.path.basename(f):14s}", c if c else "none")
