#!/usr/bin/env python3
"""Per-version evidence report: identical section windows for every version.

    python3 tools/report.py <render-dir> <out.json> [compare.json]

Master metrics per section come from analyze.window_metrics; stem RMS is the
whole-window RMS of each production stem (includes silence: compare like with like).
"""
import glob
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from analyze import load, window_metrics  # noqa: E402

SR = 44100
BAR = 240.0 / 134


def windows():
    w = [('first5s', 0.0, 5.0), ('signal b1-2', 0, 2 * BAR), ('shuffle b3-6', 2 * BAR, 6 * BAR),
         ('torque b7-8', 6 * BAR, 8 * BAR), ('stall b9', 8 * BAR, 9 * BAR),
         ('stall gap b9 beats3-4', 8.5 * BAR, 9 * BAR),
         ('payoff entry b10 beat1', 9 * BAR, 9.25 * BAR), ('payoff b10-13', 9 * BAR, 13 * BAR),
         ('converge b14-15', 13 * BAR, 15 * BAR), ('exit b16', 15 * BAR, 16 * BAR)]
    return w


def main():
    rdir, out = sys.argv[1], sys.argv[2]
    master = glob.glob(os.path.join(rdir, '*.wav'))[0]
    x = load(master)
    dur = len(x) / SR
    rows = []
    for name, a, b in windows() + [('last3s', dur - 3.0, dur)]:
        m = window_metrics(x[int(a * SR):int(b * SR)])
        rows.append({'name': name, 'start': round(a, 3), 'end': round(b, 3), **m})
    stems = {}
    for p in sorted(glob.glob(os.path.join(rdir, '*.stems', '*.wav'))):
        s = load(p)
        stems[os.path.basename(p)[:-4]] = {
            name: round(float(20 * np.log10(np.sqrt(np.mean(s[int(a * SR):int(b * SR)] ** 2)) + 1e-9)), 1)
            for name, a, b in windows()}
    rep = {'master': os.path.basename(master), 'durationSeconds': round(dur, 6), 'sections': rows, 'stemRmsDb': stems}
    with open(out, 'w') as f:
        json.dump(rep, f, indent=1)
        f.write('\n')
    prev = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else None
    print(f"{'section':24s} {'rms':>6s} {'crest':>6s} {'corr':>5s} {'S/M':>6s} {'flux':>5s} | sub  low lmid  mid upmd high")
    for i, r in enumerate(rows):
        b = r['bandDb']
        line = (f"{r['name']:24s} {r['rmsDbfs']:6.1f} {r['crestDb']:6.1f} {r['stereoCorrelation']:5.2f} "
                f"{r['sideToMidDb'] if r['sideToMidDb'] is not None else -99:6.1f} {r['transientFluxSum']:5.2f} | "
                + ' '.join(f"{b[k]:4.0f}" for k in ['sub', 'low', 'lowmid', 'mid', 'upmid', 'high']))
        if prev:
            p = prev['sections'][i]
            line += f"   (prev rms {p['rmsDbfs']:6.1f} upmid {p['bandDb']['upmid']:4.0f} corr {p['stereoCorrelation']:5.2f})"
        print(line)
    print('\nstem RMS dB by section')
    names = [w[0] for w in windows()]
    print(f"{'':8s}" + ''.join(f'{n[:9]:>10s}' for n in names))
    for k, v in stems.items():
        print(f'{k:8s}' + ''.join(f'{v[n]:10.1f}' for n in names))


if __name__ == '__main__':
    main()
