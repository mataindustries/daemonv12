"""Derive metrics.json from project.json, the final render manifest/analysis and the determinism record.

    python3 tools/metrics.py --engine-commit <sha> --render-seconds <s> --iterations <n>
"""
import json, os, sys, collections

def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default

root = os.path.join(os.path.dirname(__file__), "..")
P = json.load(open(os.path.join(root, "project.json")))
M = json.load(open(os.path.join(root, "analysis", "render-manifest.json")))
A = json.load(open(os.path.join(root, "analysis", "engine-analysis.json")))
D = json.load(open(os.path.join(root, "analysis", "determinism.json")))

gm_notes = M["midi"]["notes"]
triggers = [t for tr in M["samples"]["tracks"] for t in tr["triggers"]]
performed = [t for t in triggers if "playback" in t]
rates = sorted({round(t["playback"]["rate"], 6) for t in performed})
glides = [t for t in performed if "glide" in t["playback"]]
offsets = [t for t in performed if "offset" in t["playback"]]
authored_events = sum(len(p["notes"]) * sum(1 for c in tr["clips"] if c["pattern"] == p["id"]) for tr in P["tracks"] for p in tr["patterns"])
lanes = points = 0
for tr in P["tracks"]:
    for lane in (tr.get("automation") or {}).values():
        lanes += 1
        points += len(lane)
effects = collections.Counter(e["type"] for tr in P["tracks"] for e in tr.get("effects", []))
effects.update(f"master:{e['type']}" for e in P.get("master", {}).get("effects", []))
wav = M["wav"]
ma = A["master"]
metrics = {
    "model": "Claude Opus 5.5",
    "configuration": "Max",
    "round": "Ultimate Beat Battle - Round 1 Open Class",
    "engineCommit": arg("--engine-commit"),
    "engineVersion": M["engine"]["version"],
    "title": P["title"],
    "bpm": P["bpm"],
    "key": P["key"],
    "timeSignature": P["timeSignature"],
    "bars": P["bars"],
    "authoredSeconds": M["midi"]["durationSeconds"],
    "renderedSeconds": wav["durationSeconds"],
    "seriousIterations": int(arg("--iterations", 0)),
    "tracks": len(P["tracks"]),
    "trackKinds": dict(collections.Counter(t["instrument"]["type"] for t in P["tracks"])),
    "authoredNoteEvents": authored_events,
    "expandedNotes": {"gmMidiNotes": gm_notes, "sampleTriggers": len(triggers), "total": gm_notes + len(triggers)},
    "sampleAssets": len(M["samples"]["assets"]),
    "samplePerformance": {"performedTriggers": len(performed), "distinctPlaybackRates": len(rates), "glides": len(glides), "sourceOffsets": len(offsets)},
    "automation": {"lanes": lanes, "points": points},
    "effects": dict(sorted(effects.items())),
    "effectInstances": sum(effects.values()),
    "stems": len(M["stems"]),
    "samplePeakDbfs": round(ma["peakDbfs"], 2),
    "truePeakDbtp": ma["truePeakDbfs"],
    "integratedLufs": ma["integratedLufs"],
    "loudnessRangeLu": ma["loudnessRangeLu"],
    "rmsDbfs": round(ma["rmsDbfs"], 2),
    "clippedSamples": {"master": M["production"]["master"]["clippedSamples"], "tracks": sum(t["clippedSamples"] for t in M["production"]["tracks"])},
    "projectJsonBytes": os.path.getsize(os.path.join(root, "project.json")),
    "finalWav": {"file": "project.wav", "sha256": wav["sha256"], "bytes": wav["bytes"], "frames": wav["frames"]},
    "finalMp3Sha256": next(r["sha256"] for r in D["files"] if r["file"] == "project.mp3"),
    "projectSha256": M["project"]["sha256"],
    "approxRenderSeconds": float(arg("--render-seconds", 0)),
    "deterministicRerender": {"allIdentical": D["allIdentical"], "filesCompared": len(D["files"])},
    "renderer": {"gm": f"fluidsynth {M['gmRenderer']['version']}", "soundfont": M["soundfont"]["file"], "ffmpeg": M["production"]["processor"]["version"], "node": M["production"]["runtime"]["version"]},
}
json.dump(metrics, open(os.path.join(root, "metrics.json"), "w"), indent=1)
print(json.dumps(metrics, indent=1))
