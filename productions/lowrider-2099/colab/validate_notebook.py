"""Prove the Colab notebook has no hidden cross-cell state, and that a fresh Run all works.

1. Static: every name a code cell reads must be defined in that cell, imported in it, or a builtin.
   (The old notebook failed with `NameError: BASE is not defined`: a name from an earlier cell.)
2. Dynamic, local mode: each cell runs in its OWN new Python process (no shared memory), in order,
   twice (a reconnect). The GPU cell must fail with its recovery instruction (there is no GPU here);
   the gated render cells must render nothing while CONFIRM = False.

usage: LOWRIDER_BPY_PYTHON=/path/to/python-with-bpy python3 colab/validate_notebook.py
Writes colab/validation.json.
"""
import ast
import builtins
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
NB = json.loads((HERE / "ANGELES2099.ipynb").read_text())
REPO = HERE.parents[2]


def defined_and_used(src):
    tree = ast.parse(src)
    defined, used = set(dir(builtins)), set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            for a in node.names:
                defined.add((a.asname or a.name).split(".")[0])
        elif isinstance(node, (ast.FunctionDef, ast.ClassDef)):
            defined.add(node.name)
            defined.update(a.arg for a in node.args.args)
        elif isinstance(node, ast.Name):
            (defined if isinstance(node.ctx, (ast.Store, ast.Del)) else used).add(node.id)
        elif isinstance(node, ast.arg):
            defined.add(node.arg)
    return used - defined


def main():
    report = {"static": [], "runs": []}
    code = [("".join(c["source"])) for c in NB["cells"] if c["cell_type"] == "code"]
    ok = True
    for i, src in enumerate(code, 1):
        undefined = sorted(defined_and_used(src))
        report["static"].append({"cell": i, "undefinedNames": undefined})
        if undefined:
            ok = False
            print(f"STATIC FAIL cell {i}: uses names it does not define: {undefined}")
    if ok:
        print(f"STATIC PASS: all {len(code)} code cells define or import every name they use")

    drive = tempfile.mkdtemp(prefix="lowrider-drive-")
    env = dict(os.environ, LOWRIDER_LOCAL="1", LOWRIDER_REPO=str(REPO), LOWRIDER_DRIVE=drive)
    if not env.get("LOWRIDER_BPY_PYTHON"):
        sys.exit("Set LOWRIDER_BPY_PYTHON to a Python with bpy==4.5.14 for the dynamic check.")
    expect_fail = {4: "No CUDA/OptiX GPU"}            # cell 4 must refuse, with its fix, on a machine without a GPU
    for attempt in (1, 2):
        for i, src in enumerate(code, 1):
            r = subprocess.run([sys.executable, "-c", src], env=env, capture_output=True, text=True, timeout=3600, cwd=tempfile.gettempdir())
            out = (r.stdout + r.stderr).strip()
            want_fail = expect_fail.get(i)
            passed = (r.returncode != 0 and want_fail in out and "HOW TO FIX" in out) if want_fail else r.returncode == 0
            if i == 6:                                  # no budget typed in: nothing may render on a GPU
                passed = r.returncode == 0 and "No GPU budget approved" in out
            if i == 7:                                  # the GPU test is gated
                passed = r.returncode == 0 and "Not running the GPU test" in out
            if i == 8:                                  # the proof refuses without a measured timing
                passed = r.returncode == 0 and "Not rendering" in out and "No measured GPU timing" in out
            if i == 10:                                 # the animatic refuses without the owner's GATE 03 approval
                passed = r.returncode != 0 and "needs the owner's GATE 03 approval" in out and "HOW TO FIX" in out
            last = out.splitlines()[-1] if out else ""
            report["runs"].append({"attempt": attempt, "cell": i, "exit": r.returncode, "ok": passed, "last": last[-300:]})
            print(f"{'PASS' if passed else 'FAIL'} run {attempt} cell {i}: {last[-140:]}")
            ok = ok and passed
    rendered = list(Path(drive, "renders").rglob("*.png"))
    report["framesRendered"] = len(rendered)
    print(f"{'PASS' if not rendered else 'FAIL'}: Run all rendered {len(rendered)} frames (must be 0)")
    ok = ok and not rendered
    report["ok"] = ok
    (HERE / "validation.json").write_text(json.dumps(report, indent=1) + "\n")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
