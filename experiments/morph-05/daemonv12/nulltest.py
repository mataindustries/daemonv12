#!/usr/bin/env python3
"""Compare the DaemonV12 render of CABLE//BEAST v3 with the external render it reproduces.

Usage: python3 experiments/morph-05/daemonv12/nulltest.py EXPORT_DIR RENDER_DIR OUT.json
  EXPORT_DIR  output of export.mjs (reference/premaster.wav and the reference drum stems)
  RENDER_DIR  output of `daemonv12 render ... --stems --format wav`

Reports, per native drum track and for the whole pre-master mix, the residual (DaemonV12 minus
external) relative to the external signal, and checks every native trigger frame resolved by the
engine against the external render's event frames.
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "morph-03"))
from analyze import read_wav  # noqa: E402


def db(v):
    return float(20 * np.log10(v + 1e-15))


FADES = []  # (start, end) seconds of the choke's fade edges, filled from the project's gain automation


def compare(a, b):
    n = min(len(a), len(b))
    r = a[:n] - b[:n]
    keep = np.ones(n, bool)
    for s, e in FADES:
        keep[int(s * 44100):int(e * 44100) + 1] = False
    sig = np.sqrt((b[:n] ** 2).mean())
    return {"frames": [len(a), len(b)], "residualVsSignalDb": round(db(np.sqrt((r ** 2).mean())) - db(sig), 1),
            "residualPeakDbfs": round(db(np.abs(r).max()), 1), "signalPeakDbfs": round(db(np.abs(b[:n]).max()), 1),
            "outsideChokeFades": {"residualVsSignalDb": round(db(np.sqrt((r[keep] ** 2).mean())) - db(sig), 1), "residualPeakDbfs": round(db(np.abs(r[keep]).max()), 1)}}


exp, ren, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
manifest = json.loads(next(ren.glob("*.render.json")).read_text())
project = json.loads(next(exp.glob("*.daemonv12.json")).read_text())
# the choke is a smoothstep fade in the external render and a linear-in-dB ramp to -60 dB in
# DaemonV12 gain automation: the two differ only inside those ramps (+-2 ms margin)
pts = next(t for t in project["tracks"] if t["id"] == "snare").get("automation", {}).get("gainDb", [])
for p, q in zip(pts, pts[1:]):
    if -60 in (p["value"], q["value"]) and p["value"] != q["value"]:
        FADES.append((p["at"]["seconds"] - 0.002, q["at"]["seconds"] + 0.002))
res = {"engine": manifest["engine"], "timeline": manifest["timeline"], "tracks": {}}
res["premaster"] = compare(read_wav(next(ren.glob("*.daemonv12.wav")))[0], read_wav(exp / "reference" / "premaster.wav")[0])
stems = ren / next(p.name for p in ren.iterdir() if p.name.endswith(".stems"))
for k in ["kick", "snare", "toms", "ticks", "metal"]:
    res["tracks"][k] = compare(read_wav(stems / f"{k}.wav")[0], read_wav(exp / "reference" / f"{k}.wav")[0])

# trigger frames: engine-resolved vs the external render's events (same steps, same rule)
ref = json.loads((exp / "reference" / "events.json").read_text())
want = {"kick": sorted(e["sampleFrame"] for e in ref if e["part"] == "kick"),
        "snare": sorted(e["sampleFrame"] for e in ref if e["part"] == "snare"),
        "toms": sorted(e["sampleFrame"] for e in ref if e["part"] == "toms"),
        "ticks": sorted(e["sampleFrame"] for e in ref if e["part"] == "perc" and e["event"] == "cable tick"),
        "metal": sorted(e["sampleFrame"] for e in ref if e["part"] == "perc" and e["event"] != "cable tick")}
res["triggers"] = {}
for t in manifest["samples"]["tracks"]:
    got = sorted(tr.get("frame", tr.get("startFrame")) for tr in t["triggers"])
    w = want.get(t["trackId"])
    if w is not None:
        res["triggers"][t["trackId"]] = {"count": [len(got), len(w)], "allFramesEqual": got == w,
                                         "maxFrameDifference": int(max((abs(a - b) for a, b in zip(got, w)), default=0))}
out.write_text(json.dumps(res, indent=1) + "\n")
print(json.dumps({k: res[k] for k in ("premaster", "tracks", "triggers")}, indent=1))
