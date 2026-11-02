"""Validate the pinned install and prove bpy works despite its known WHEEL tag defect.

No rendering or production scene changes. All unexpected pip findings remain fatal.
"""
import argparse
import importlib
import importlib.metadata as md
import json
import platform
import subprocess
import sys
import sysconfig
import zipfile
from email.parser import Parser
from pathlib import Path

from gate_a import BLENDER, PRODUCTION, PYTHON, SOURCE, git, verify_wheels, write_json

KNOWN_TAG = "cp39-cp39-manylinux_2_28_x86_64"
KNOWN_FINDING = "bpy 4.5.14 is not supported on this platform"


def dependency_versions(pins):
    # Use pip's bundled parser: no extra dependency or changed package pin is needed.
    from pip._vendor.packaging.requirements import Requirement
    from pip._vendor.packaging.specifiers import SpecifierSet

    versions = {}
    for pin in pins:
        dist = md.distribution(pin["name"])
        if dist.version != pin["version"]:
            raise RuntimeError(f"{pin['name']}: expected {pin['version']}, found {dist.version}")
        versions[pin["name"]] = dist.version
        requires_python = dist.metadata.get("Requires-Python")
        if requires_python and not SpecifierSet(requires_python).contains(platform.python_version()):
            raise RuntimeError(f"{pin['name']}: Requires-Python {requires_python}")
        for text in dist.requires or []:
            req = Requirement(text)
            if req.marker is None or req.marker.evaluate({"extra": ""}):
                installed = md.version(req.name)  # Missing active dependencies must raise.
                if not req.specifier.contains(installed, prereleases=True):
                    raise RuntimeError(f"{pin['name']}: {req}, found {installed}")
    return versions


def known_tag_defect(pin, wheel_metadata, supported):
    from pip._vendor.packaging.tags import parse_tag
    from pip._vendor.packaging.utils import parse_wheel_filename

    name, version, _, filename_tags = parse_wheel_filename(pin["file"])
    if name != "bpy" or str(version) != "4.5.14" or filename_tags.isdisjoint(supported):
        raise RuntimeError("The verified bpy wheel filename does not support this interpreter/platform")
    declared = Parser().parsestr(wheel_metadata).get_all("Tag", [])
    if not declared:
        raise RuntimeError("bpy WHEEL metadata has no tags")
    installed_tags = set().union(*(parse_tag(tag) for tag in declared))
    if installed_tags.isdisjoint(supported):
        if declared != [KNOWN_TAG]:
            raise RuntimeError(f"Unexpected unsupported bpy WHEEL tags: {declared}")
        return True
    return False


def validate_pip_result(result, proven_defect):
    # Retain pip's checks of the ENTIRE installed environment, not just our nine pins.
    # Never use '|| true' or suppress another missing/conflicting/unsupported package.
    if result.stderr.strip():
        raise RuntimeError("pip check diagnostic: " + result.stderr.strip())
    if result.returncode == 0:
        return
    if result.returncode == 1 and proven_defect and result.stdout.strip() == KNOWN_FINDING:
        return
    raise RuntimeError("Unexpected pip check failure: " + result.stdout.strip())


def cpu_smoke():
    import bpy

    if bpy.app.version != BLENDER:
        raise RuntimeError("Expected Blender 4.5.14, got " + bpy.app.version_string)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    bpy.ops.mesh.primitive_cube_add()
    bpy.context.evaluated_depsgraph_get().update()
    if scene.render.engine != "CYCLES" or scene.cycles.device != "CPU" or len(scene.objects) != 1:
        raise RuntimeError("Blender CPU scene initialization failed")
    return {"blender": bpy.app.version_string, "engine": scene.render.engine,
            "device": scene.cycles.device, "sceneObjects": len(scene.objects), "renderedFrames": 0}


def verify(source, wheel_dir, out):
    report = {"state": "failed", "python": platform.python_version(), "executable": sys.executable,
              "soabi": sysconfig.get_config_var("SOABI"), "machine": platform.machine(),
              "libc": list(platform.libc_ver()), "pipVersion": md.version("pip")}
    try:
        from pip._vendor.packaging.tags import sys_tags

        if sys.version_info[:3] != PYTHON or git(source, "rev-parse", "HEAD") != SOURCE:
            raise RuntimeError("Use exact Python 3.11.14 and approved production commit " + SOURCE)
        verify_wheels(source, wheel_dir)
        pins = json.loads((source / PRODUCTION / "colab/config.json").read_text())["pins"]["wheels"]
        supported = set(sys_tags())
        report["supportedTags"] = sorted(map(str, supported))
        bpy_pin = next(p for p in pins if p["name"] == "bpy")
        dist = md.distribution("bpy")
        wheel_metadata = dist.read_text("WHEEL")
        report.update(bpyWheel=bpy_pin["file"], bpyWheelSha256=bpy_pin["sha256"],
                      bpyWheelMetadata=wheel_metadata, bpyRequiresPython=dist.metadata.get("Requires-Python"))
        with zipfile.ZipFile(wheel_dir / bpy_pin["file"]) as wheel:
            original = wheel.read("bpy-4.5.14.dist-info/WHEEL").decode()
        if original != wheel_metadata:
            raise RuntimeError("Installed bpy WHEEL metadata differs from the verified archive")
        report["knownBpyTagDefect"] = known_tag_defect(bpy_pin, wheel_metadata, supported)
        report["versions"] = dependency_versions(pins)
        result = subprocess.run([sys.executable, "-m", "pip", "--no-cache-dir", "--disable-pip-version-check", "check"],
                                capture_output=True, text=True, timeout=60)
        report["pipCheck"] = {"returncode": result.returncode, "stdout": result.stdout, "stderr": result.stderr}
        validate_pip_result(result, report["knownBpyTagDefect"])
        for pin in pins:
            name = "Cython" if pin["name"] == "cython" else pin["name"].replace("-", "_")
            importlib.import_module(name)
        report["cpuSmoke"] = cpu_smoke()
        report["state"] = "passed"
    except Exception as exc:
        report["error"] = f"{type(exc).__name__}: {exc}"
        raise
    finally:
        write_json(out, report)
        print(json.dumps(report, indent=2), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--wheel-dir", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    verify(args.source, args.wheel_dir, args.out)
