"""Side-by-side QA table: v1 masters (experiments/lowrider-2099) vs v2 masters (music/v2/masters).

usage: python3 -I qa/compare.py   (from productions/lowrider-2099) -> prints and writes review/music/compare.json
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from qa import read, kick_punch, stereo_depth, brightness  # noqa: E402

ROOT = HERE.parent
V1 = ROOT.parent.parent / "experiments" / "lowrider-2099" / "audio"
rows = {}
for label, stem in [("A v1", "candidate-a-bounce"), ("B v1", "candidate-b-takeover")]:
    # re-measure v1 with the current tool so every column uses the same rules
    import subprocess
    out = ROOT / "review/music" / f"v1-{stem}.qa.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([sys.executable, "-I", str(HERE / "qa.py"), str(V1.parent / "renders" / stem), stem, "--master", str(V1 / f"{stem}.wav"), "--json", str(out)], check=True, capture_output=True)
    d = json.loads(out.read_text())
    x = read(V1 / f"{stem}.wav")
    d["master"]["stereoSideToMidDb"] = stereo_depth(x)
    d["master"].update(brightness(x))
    d["punchMaster"] = d["punch"]
    rows[label] = d
for name in ("crest", "hover"):
    d = json.loads((ROOT / "music/v2/masters" / f"{name}.qa.json").read_text())
    d["punchMaster"] = kick_punch(read(ROOT / "music/v2/masters" / f"{name}.wav"), read(ROOT / "music/v2/renders" / name / f"{name}.stems/kick.wav"))
    rows[f"{name.upper()} v2"] = d
table = {}
for k, d in rows.items():
    m = d["master"]
    table[k] = {
        "lufs": m["lufs"], "peakDbfs": m["peakDbfs"], "fullScaleSamples": m["fullScaleSamples"],
        "lrCorrelation": m["lrCorrelation"], "monoLoudnessChangeLu": m["monoLoudnessChangeLu"], "worstBandMonoLossDb": m["worstBandMonoLossDb"],
        "sideToMid600to2500Db": m["stereoSideToMidDb"]["600-2500"], "sideToMid2500to8000Db": m["stereoSideToMidDb"]["2500-8000"],
        "above8kPercent": m["above8kPercent"], "centroidHz": m["centroidHz"],
        "kickPunchMedianDb": d["punchMaster"]["punchDbMedian"], "kickPunchMinDb": d["punchMaster"]["punchDbMin"],
        "phone808MedianSmrDb": d["phone808"]["medianSmrDb"], "phone808P10SmrDb": d["phone808"]["p10SmrDb"],
        "phone808BandMedianSmrDb": d["phone808Band"]["medianSmrDb"], "phone808BandP10SmrDb": d["phone808Band"]["p10SmrDb"], "phoneSmr": d.get("phoneSmr"),
    }
cols = ["lufs", "peakDbfs", "lrCorrelation", "monoLoudnessChangeLu", "worstBandMonoLossDb", "sideToMid600to2500Db", "sideToMid2500to8000Db", "above8kPercent", "centroidHz", "kickPunchMedianDb", "kickPunchMinDb", "phone808MedianSmrDb", "phone808P10SmrDb", "phone808BandMedianSmrDb", "phone808BandP10SmrDb"]
print("metric".ljust(24) + "".join(k.rjust(11) for k in table))
for c in cols:
    print(c.ljust(24) + "".join(str(table[k][c]).rjust(11) for k in table))
out = ROOT / "review/music/compare.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(table, indent=1) + "\n")
