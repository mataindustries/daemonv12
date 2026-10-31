"""End-to-end check of the GPU-spend path on a CPU, at thumbnail size, without Colab.

Exercises, in order: no budget -> refused; no measurement -> refused; the one-frame timing test;
a keyed proof render charged to the ledger; rerun reuse; invalidation when a setting changes and
when a spec file changes; refusal when an estimate exceeds the budget; gate approval; a real
Workbench animatic MP4 with the soundtrack. Writes colab/e2e_local.json.

usage: LOWRIDER_BPY_PYTHON=/path/to/python-with-bpy python3 colab/e2e_local.py
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
os.environ.update(LOWRIDER_LOCAL="1", LOWRIDER_DRIVE=tempfile.mkdtemp(prefix="lowrider-e2e-"),
                  LOWRIDER_TEST_OVERRIDES=json.dumps({"gpuTest": {"resolution": [96, 160], "samples": 4},
                                                       "animatic": {"resolution": [180, 320], "first": 350, "last": 373}}))
sys.path.insert(0, str(HERE))
import pipeline as P  # noqa: E402

results = []


def step(name, ok, detail=""):
    results.append({"step": name, "ok": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'} {name}: {detail}", flush=True)


def expect_error(fn, text):
    try:
        fn()
    except P.PipelineError as e:
        return text in str(e)
    return False


P.mount_drive()
P.validate_inputs("crest")
FR, RES, SPP = [0, 400], (96, 160), 4
step("no budget: proof refuses for lack of a measurement", P.render("GATE03", FR, RES, SPP, confirm=False) is None)
step("no budget: GPU test refuses", expect_error(lambda: P.gpu_frame_test(confirm=True), "budget"))
P.set_budget(10, "e2e test")
meas = P.gpu_frame_test(confirm=True)
step("one-frame test measures build and per-frame time", meas and meas["secondsPerFrame"] > 0 and meas["buildSeconds"] > 0, json.dumps(meas))
out = P.render("GATE03", FR, RES, SPP, confirm=True)
pngs = sorted(p.name for p in Path(out).glob("frame_*.png"))
step("keyed proof render writes its frames", pngs == ["frame_0000.png", "frame_0400.png"], f"{out.name}: {pngs}")
b = P.budget_state()
step("render is charged to the ledger", b["spentMinutes"] > 0 and len(b["spent"]) == 2, f"spent {b['spentMinutes']} of {b['approvedMinutes']} min")
step("rerun reuses the same keyed frames", P.render("GATE03", FR, RES, SPP, confirm=True) == out)
k1 = P.render_key("crest", "GATE03", FR, RES, SPP, "CYCLES")
k2 = P.render_key("crest", "GATE03", FR, RES, SPP + 1, "CYCLES")
step("a settings change changes the key", k1 != k2)
tmp = Path(tempfile.mkdtemp(prefix="lowrider-key-"))
for d in ("blender", "colab", "visual", "review"):
    shutil.copytree(P.PROD / d, tmp / d, ignore=shutil.ignore_patterns("*.png", "*.wav", "*.mp3"))
k_copy = P.render_key("crest", "GATE03", FR, RES, SPP, "CYCLES", root=tmp)
spec = tmp / "visual" / "specs" / "palette.json"
spec.write_text(spec.read_text().replace("#5A0F1F", "#5A0F20"))
k_edit = P.render_key("crest", "GATE03", FR, RES, SPP, "CYCLES", root=tmp)
step("an identical copy keeps the key; a one-character spec edit changes it", k_copy == k1 and k_edit != k1)
P.set_budget(P.budget_state()["spentMinutes"] + 0.01, "e2e test")
step("an estimate over the remaining budget is refused", expect_error(lambda: P.render("GATE03", [0, 170, 330, 400, 560], RES, SPP, confirm=True), "exceeds the remaining approved budget"))
step("animatic refuses before GATE 03 approval", expect_error(lambda: P.animatic(confirm=True), "GATE 03 approval"))
P.set_budget(60, "e2e test")
P.approve("GATE03")
mp4 = P.animatic(confirm=True)
probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height:format=duration", "-of", "json", str(mp4)], capture_output=True, text=True)
info = json.loads(probe.stdout)
kinds = sorted(s["codec_type"] for s in info["streams"])
step("animatic MP4 has picture and soundtrack", kinds == ["audio", "video"], f"{mp4.name}: {info['format']['duration']} s, {[(s['codec_type'], s['codec_name']) for s in info['streams']]}")
(HERE / "e2e_local.json").write_text(json.dumps({"ok": all(r["ok"] for r in results), "steps": results, "status": P.budget_state()}, indent=1) + "\n")
sys.exit(0 if all(r["ok"] for r in results) else 1)
