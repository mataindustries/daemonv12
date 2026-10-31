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

CELLS = [
    ("md", """# ANGELES//2099 · Colab render pipeline

**Run order:** Runtime › Change runtime type › **T4 GPU**, then Runtime › **Run all**. Run all *never renders*: it fetches the project, mounts Drive, installs the pinned Blender, checks the GPU and validates the scene and soundtrack. Rendering happens only in the gated cells, and only after you set `CONFIRM = True` there.

**Safe to rerun:** every cell is self-contained (no variables carried between cells). After a disconnect, just Run all again; finished frames on Drive are kept and never re-rendered.

| Gate | Cell | Needs |
|---|---|---|
| GATE 03: five-frame proof | 6 | owner approval of the music (GATE 01) and styleframes (GATE 02), then `CONFIRM = True` |
| GATE 04: low-res motion preview | 8 | owner approval of GATE 03 (cell 7), then `CONFIRM = True` |
| GATE 05: final render | not in this notebook | owner approval of GATE 04 |
"""),
    ("code", '''# 1 · Get the project: a sparse, shallow clone of productions/lowrider-2099 only (not the whole repo)
import os, subprocess
REPO_URL = "https://github.com/mataindustries/daemonv12.git"
BRANCH = "claude/stoic-rubin-2kpv6u"
PIN_COMMIT = ""          # optional: a full commit SHA to render exactly that version
REPO = os.environ.get("LOWRIDER_REPO", "/content/daemonv12")
if os.environ.get("LOWRIDER_LOCAL") != "1":
    def git(*a):
        subprocess.run(["git", "-C", REPO, *a], check=True)
    if not os.path.isdir(f"{REPO}/.git"):
        subprocess.run(["git", "clone", "--filter=blob:none", "--no-checkout", "--depth", "1", "--branch", BRANCH, REPO_URL, REPO], check=True)
        git("sparse-checkout", "set", "productions/lowrider-2099")
    git("fetch", "--depth", "1", "origin", PIN_COMMIT or BRANCH)
    git("checkout", "--force", "FETCH_HEAD")
commit = subprocess.run(["git", "-C", REPO, "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
print("Project:", REPO, "at commit", commit or "(not a git checkout)")
'''),
    ("code", BOOT + '''# 2 · Mount Google Drive: renders, reports, the Blender cache and the gate log live there
P.mount_drive()
'''),
    ("code", BOOT + '''# 3 · Install Blender 4.5.14 LTS (the pinned bpy wheel, SHA-256 checked, cached on Drive)
P.install_blender()
'''),
    ("code", BOOT + '''# 4 · Check the GPU (T4 expected). Stops here, with instructions, if Cycles sees no CUDA/OptiX device
P.check_gpu()
'''),
    ("code", BOOT + '''# 5 · Validate the soundtrack hash, the cue sheet and the generated scene (CPU only, renders nothing)
P.validate_inputs()
'''),
    ("code", BOOT + '''# 6 · GATE 03: render the five proof frames (360x640). Prints the GPU budget first.
CONFIRM = False          # set True only after GATE 01 and GATE 02 are approved
c = P.CONFIG["proof"]
P.render(c["gate"], c["frames"], tuple(c["resolution"]), c["samples"], confirm=CONFIRM)
'''),
    ("code", BOOT + '''# 7 · Owner only: record approval of the five-frame proof (unlocks cell 8)
APPROVE_GATE03 = False
if APPROVE_GATE03:
    P.approve("GATE03")
else:
    print("GATE 03 not approved here. Review the frames in Drive/ANGELES2099/renders/GATE03 first.")
'''),
    ("code", BOOT + '''# 8 · GATE 04: low-resolution motion preview, every other frame (300 frames). Needs GATE 03 approval.
CONFIRM = False
c = P.CONFIG["preview"]
P.render(c["gate"], list(range(0, P.CONFIG["frames"], c["frameStep"])), tuple(c["resolution"]), c["samples"], confirm=CONFIRM)
'''),
    ("code", BOOT + '''# 9 · Status: what is on Drive, which gates are approved, measured render speed
P.status()
'''),
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
