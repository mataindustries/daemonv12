#!/usr/bin/env python3
"""MORPH//04 arrangement checks on masters and stems. These are proxies, NOT listening results.

Usage:
  node experiments/morph-04/build.mjs --stems
  python3 experiments/morph-04/checks.py experiments/morph-04/audio OUT.json [NAME ...]

Per arrangement (master WAV, FLAC stems and the event map from build.mjs):
  global        loudness, true peak, PLR, band balance, phone-speaker drop, mono loss per band,
                infrasound, loop seam, onset crest (MORPH//03 analyze.py, unchanged)
  kickBass      sub band (< 100 Hz) of the kick vs the bass in the 50 ms after each kick, and how
                fast the bass sub returns (60-200 ms after the kick, vs. the 100 ms before it)
  articulations bass presence (300 Hz-4 kHz) vs. everything else in the 60 ms after each cable
                onset: can the slap, pop and zap be heard through the drums?
  transients    crest factor (15 ms) at drum onsets, pre-master stems vs. master: what mastering cost
  stereo        side/mid energy and L/R correlation per band; room share
  phone         each stem's loudness through the phone-speaker model, relative to the mix's
  pauses        level inside the planned stops vs. the loop's median 50 ms level
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "morph-03"))
from analyze import analyze, read_wav, phone, band, lufs_of  # noqa: E402

SR = 44100
DRUM_STEMS = ("kick", "snare", "perc", "toms", "ratchet")


def read_any(path):
    if str(path).endswith(".wav"):
        x, sr, _ = read_wav(path)
        return x
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, "<f4").astype(np.float64).reshape(-1, 2)


def db(v):
    return 20 * np.log10(v + 1e-12)


def rms(x):
    return np.sqrt(np.mean(x ** 2)) if len(x) else 0.0


def seg(x, t, dur):
    i = int(round(t * SR))
    return x[i:i + int(dur * SR)]


def kick_bass(stems, events):
    kick, bass = stems.get("kick"), stems.get("bass")
    if kick is None or bass is None:
        return None
    ks, bs = band(kick.mean(axis=1), SR, 0, 100), band(bass.mean(axis=1), SR, 0, 100)
    margins, recover = [], []
    for e in events:
        if e["part"] != "kick":
            continue
        t = e["time"]
        margins.append(db(rms(seg(ks, t, 0.05))) - db(rms(seg(bs, t, 0.05))))
        before = rms(seg(bs, max(0, t - 0.1), 0.1)) if t >= 0.1 else rms(bs[-int(0.1 * SR):])
        recover.append(db(rms(seg(bs, t + 0.06, 0.14))) - db(before))
    return {
        "kicks": len(margins),
        "kickOverBassSubMarginDb": {"median": round(float(np.median(margins)), 1), "min": round(float(np.min(margins)), 1)},
        "bassSubReturnDb": {"median": round(float(np.median(recover)), 1), "min": round(float(np.min(recover)), 1)},
    }


def articulations(stems, events):
    bass = stems.get("bass")
    others = sum(v for k, v in stems.items() if k not in ("bass",))
    if bass is None:
        return None
    b, o = band(bass.mean(axis=1), SR, 300, 4000), band(others.mean(axis=1), SR, 300, 4000)
    rows = []
    for e in events:
        if e["part"] != "cable bass" or e["event"] not in ("slap", "pluck"):
            continue  # ghosts are muted thumps by design
        m = db(rms(seg(b, e["time"], 0.06))) - db(rms(seg(o, e["time"], 0.06)))
        rows.append((round(float(m), 1), e["position"], e["event"], e.get("detail", "")))
    # the cable's own articulations: slaps (tension dive), pops, bends, re-tensions, vowels
    unique = [r for r in rows if r[2] == "slap" or r[3]]
    plain = [r for r in rows if r not in unique]
    stats = lambda rs: {"n": len(rs), "median": round(float(np.median([r[0] for r in rs])), 1), "min": round(float(min(r[0] for r in rs)), 1),
                        "below3dB": sum(r[0] < 3 for r in rs)} if rs else None
    return {"uniqueArticulationsDb": stats(unique), "plainPlucksDb": stats(plain), "worst": sorted(rows)[:5]}


def crest(x, t):
    s = seg(x, t, 0.015)
    return db(np.abs(s).max()) - db(rms(s)) if len(s) > 10 else np.nan


def transients(stems, master, events):
    pre = stems["premaster"].mean(axis=1)
    m = master.mean(axis=1)
    loss = [crest(pre, e["time"]) - crest(m, e["time"]) for e in events if e["part"] in ("kick", "snare")]
    loss = np.array([v for v in loss if np.isfinite(v)])
    return {"drumOnsets": len(loss), "crestLossDb": {"median": round(float(np.median(loss)), 2), "max": round(float(loss.max()), 2)}}


def stereo(master, stems):
    out = {}
    for name, lo, hi in [("low<150", 0, 150), ("mid150-2k", 150, 2000), ("high>2k", 2000, SR / 2)]:
        x = band(master, SR, lo, hi)
        L, R = x[:, 0], x[:, 1]
        M, S = (L + R) / 2, (L - R) / 2
        out[name] = {"sideOverMidDb": round(float(db(rms(S)) - db(rms(M))), 1),
                     "corr": round(float((L * R).sum() / np.sqrt((L ** 2).sum() * (R ** 2).sum() + 1e-20)), 3)}
    if "room" in stems:
        out["roomShareDb"] = round(float(db(rms(stems["room"])) - db(rms(stems["premaster"]))), 1)
    return out


def phone_parts(stems):
    ref = lufs_of(phone(stems["premaster"], SR), SR)
    res = {}
    for k, v in stems.items():
        if k == "premaster":
            continue
        try:
            res[k] = round(lufs_of(phone(v, SR), SR) - ref, 1)
        except Exception:  # silent stem
            res[k] = None
    return res


def pauses(master, events):
    m = master.mean(axis=1)
    hop = int(0.05 * SR)
    levels = np.array([db(rms(m[i:i + hop])) for i in range(0, len(m) - hop, hop)])
    med = float(np.median(levels))
    res = []
    for e in events:
        if not (e["event"].startswith("CHOKE") or e["event"].startswith("STOP")):
            continue
        end = float(e.get("end", e["time"] + 0.25))
        a = e["time"] + 0.03
        lv = db(rms(m[int(a * SR):int(end * SR)]))
        res.append({"at": e["position"], "event": e["event"], "levelVsMedianDb": round(float(lv - med), 1)})
    return res


def check(audio, name):
    master_path = audio / f"{name}.wav"
    events = json.loads((audio / "events" / f"{name}.json").read_text())
    sdir = audio / "stems" / name
    stems = {p.stem: read_any(p) for p in sorted(sdir.glob("*.flac"))}
    master = read_any(master_path)
    res = {"file": master_path.name, "global": analyze(master_path)}
    res["kickBass"] = kick_bass(stems, events)
    # the rooms are mostly the cable's own reflections; "others" = drums and partner cables
    res["articulations"] = articulations({k: v for k, v in stems.items() if k not in ("premaster", "room", "garage")}, events)
    res["transients"] = transients(stems, master, events)
    res["stereo"] = stereo(master, stems)
    res["phoneStemsVsMixLu"] = phone_parts(stems)
    res["pauses"] = pauses(master, events)
    return res


if __name__ == "__main__":
    audio, out = Path(sys.argv[1]), Path(sys.argv[2])
    names = sys.argv[3:] or sorted(p.stem for p in audio.glob("morph04-*.wav"))
    results = [check(audio, n) for n in names]
    out.write_text(json.dumps(results, indent=2, default=float) + "\n")
    for r in results:
        g = r["global"]
        print(r["file"], {k: g[k] for k in ("integratedLufs", "truePeakDbtp", "plrDb", "phoneLufsDrop", "onsetCrestDbMedian")}, g["bandBalancePct"])
        print("  seam", g["loopSeam"]["jumpVsLocalMedianStep"], " mono", {k: v["monoSumLossDb"] for k, v in g["mono"].items()}, " infra%", g["infrasonicPctBelow20Hz"])
        for k in ("kickBass", "articulations", "transients", "stereo", "phoneStemsVsMixLu", "pauses"):
            print(" ", k, r[k])
