"""Write ANGELES2099.ipynb from the cell sources below (so the notebook is reviewable and regenerable).

usage: python3 colab/make_notebook.py
"""
import json
from pathlib import Path

BOOT = '''import os, sys
_REPO = os.environ.get("LOWRIDER_REPO", "/content/daemonv12")
sys.path.insert(0, f"{_REPO}/productions/lowrider-2099/colab")
try:
    import pipeline as P
except ModuleNotFoundError:
    raise SystemExit("The project is not in this runtime yet. Run cell 1 (Get the project) first.")
'''

PIN = json.loads((Path(__file__).resolve().parent / "pin.json").read_text()) if (Path(__file__).resolve().parent / "pin.json").exists() else {"commit": ""}

CELLS = [
    ("md", """# ANGELES//2099 · Colab render pipeline

**Run order:** Runtime › Change runtime type › **T4 GPU**, then Runtime › **Run all**. Run all *never spends GPU time*: it fetches the pinned project, mounts Drive, installs the pinned Blender, checks the GPU and validates scene and soundtrack. Every GPU render waits for an owner-approved budget and for `CONFIRM = True` in its own cell.

**Safe to rerun:** every cell is self-contained (no variables carried between cells). Outputs are keyed by a hash of every input that changes pixels; after a disconnect, Run all again and finished work for unchanged inputs is reused, while work from changed inputs is never reused.

| Step | Cell | Needs |
|---|---|---|
| Budget | 6 | the owner types an approved number of GPU minutes |
| One-frame GPU test | 7 | budget; measures real build and per-frame time |
| GATE 03: five-frame proof | 8 | the measured timing; the padded estimate must fit the budget |
| GATE 04: Workbench animatic + soundtrack | 10 | owner approval of GATE 03 (cell 9) |
| GATE 05: final render | not in this notebook | owner approval of GATE 04 |
"""),
    ("code", """# 1 · Get the project: a sparse, shallow fetch of productions/lowrider-2099 at ONE immutable commit
import os, subprocess
REPO_URL = "https://github.com/mataindustries/daemonv12.git"
PIN_COMMIT = "%s"   # the exact source this notebook renders; written by make_notebook.py
REPO = os.environ.get("LOWRIDER_REPO", "/content/daemonv12")
if os.environ.get("LOWRIDER_LOCAL") != "1":
    def git(*a):
        subprocess.run(["git", "-C", REPO, *a], check=True)
    if not os.path.isdir(f"{REPO}/.git"):
        subprocess.run(["git", "init", "-q", REPO], check=True)
        git("remote", "add", "origin", REPO_URL)
        git("sparse-checkout", "set", "productions/lowrider-2099")
    git("fetch", "--depth", "1", "--filter=blob:none", "origin", PIN_COMMIT)
    git("checkout", "--force", "--detach", "FETCH_HEAD")
    head = subprocess.run(["git", "-C", REPO, "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    if head != PIN_COMMIT:
        raise SystemExit(f"Checked out {head}, expected {PIN_COMMIT}. Delete {REPO} (Runtime > Disconnect and delete runtime) and Run all again.")
commit = subprocess.run(["git", "-C", REPO, "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
print("Project:", REPO, "at commit", commit or "(not a git checkout)")
""" % PIN["commit"]),
    ("code", BOOT + """# 2 · Mount Google Drive: renders, reports, the Blender cache, the budget ledger and the gate log live there
P.mount_drive()
"""),
    ("code", BOOT + """# 3 · Install Blender 4.5.14 LTS (the pinned bpy wheel, SHA-256 checked, cached on Drive)
P.install_blender()
"""),
    ("code", BOOT + """# 4 · Check the GPU (T4 expected). Stops here, with instructions, if Cycles sees no CUDA/OptiX device
P.check_gpu()
"""),
    ("code", BOOT + """# 5 · Validate the soundtrack hash, the cue sheet and the generated scene (CPU only, renders nothing)
P.validate_inputs()
"""),
    ("code", BOOT + """# 6 · Owner only: approve a GPU budget in minutes. Every GPU render is charged against it.
APPROVED_GPU_MINUTES = 0      # e.g. 15 for the one-frame test plus the five-frame proof
APPROVER = ""                 # who approved it
P.set_budget(APPROVED_GPU_MINUTES, APPROVER)
"""),
    ("code", BOOT + """# 7 · One-frame GPU test: measures real scene-build and per-frame time on this GPU (uses <= 6 min)
CONFIRM = False
P.gpu_frame_test(confirm=CONFIRM)
"""),
    ("code", BOOT + """# 8 · GATE 03: the five proof frames (360x640). Refuses unless a measured estimate fits the budget.
CONFIRM = False
c = P.CONFIG["proof"]
P.render(c["gate"], c["frames"], tuple(c["resolution"]), c["samples"], confirm=CONFIRM)
"""),
    ("code", BOOT + """# 9 · Owner only: record approval of the five-frame proof (unlocks cell 10)
APPROVE_GATE03 = False
if APPROVE_GATE03:
    P.approve("GATE03")
else:
    print("GATE 03 not approved here. Review the frames in Drive/ANGELES2099/renders/GATE03 first.")
"""),
    ("code", BOOT + """# 10 · GATE 04: the whole piece as a Workbench animatic with the soundtrack (MP4 on Drive)
CONFIRM = False
P.animatic(confirm=CONFIRM)
"""),
    ("code", BOOT + """# 11 · Status: source commit, budget ledger, measured timings, gates, renders by input key
P.status()
"""),
]


def main():
    nb = {"nbformat": 4, "nbformat_minor": 5, "metadata": {"accelerator": "GPU", "colab": {"provenance": [], "gpuType": "T4"},
          "kernelspec": {"name": "python3", "display_name": "Python 3"}, "language_info": {"name": "python"}}, "cells": []}
    for i, (kind, src) in enumerate(CELLS):
        cell = {"cell_type": "markdown" if kind == "md" else "code", "metadata": {"id": f"cell{i}"}, "source": src.splitlines(keepends=True)}
        if kind == "code":
            cell.update({"execution_count": None, "outputs": []})
        nb["cells"].append(cell)
    out = Path(__file__).resolve().parent / "ANGELES2099.ipynb"
    out.write_text(json.dumps(nb, indent=1) + "\n")
    print("wrote", out)


if __name__ == "__main__":
    main()
