"""Installer regression checks. No Blender installation, scene or render is needed."""
import importlib.metadata as md
import subprocess
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import verify_install as install


class InstallTests(unittest.TestCase):
    def test_exact_proven_tag_defect_is_the_only_pip_exception(self):
        result = subprocess.CompletedProcess([], 1, install.KNOWN_FINDING + "\n", "")
        install.validate_pip_result(result, True)
        with self.assertRaises(RuntimeError):
            install.validate_pip_result(result, False)

    def test_pip_dependency_platform_and_tool_errors_remain_fatal(self):
        for code, stdout, stderr in (
                (1, install.KNOWN_FINDING + "\nrequests 2.34.2 requires urllib3, which is not installed.", ""),
                (1, "requests 2.34.2 has requirement urllib3<3, but you have urllib3 3.0", ""),
                (1, install.KNOWN_FINDING + "\nnumpy 1.26.4 is not supported on this platform", ""),
                (2, install.KNOWN_FINDING, ""),
                (1, install.KNOWN_FINDING, "Metadata read failure"),
                (0, "No broken requirements found.", "Unexpected diagnostic")):
            with self.subTest(code=code, stdout=stdout), self.assertRaises(RuntimeError):
                install.validate_pip_result(subprocess.CompletedProcess([], code, stdout, stderr), True)
        install.validate_pip_result(subprocess.CompletedProcess([], 0, "No broken requirements found.", ""), False)

    def test_filename_must_support_real_environment_despite_internal_cp39_tag(self):
        from pip._vendor.packaging.tags import parse_tag
        pin = {"file": "bpy-4.5.14-cp311-cp311-manylinux_2_28_x86_64.whl"}
        metadata = "Wheel-Version: 1.0\nTag: " + install.KNOWN_TAG + "\n"
        supported = parse_tag("cp311-cp311-manylinux_2_28_x86_64")
        self.assertTrue(install.known_tag_defect(pin, metadata, supported))
        with self.assertRaisesRegex(RuntimeError, "filename does not support"):
            install.known_tag_defect(pin, metadata, parse_tag("cp312-cp312-manylinux_2_28_x86_64"))
        with self.assertRaisesRegex(RuntimeError, "filename does not support"):
            install.known_tag_defect(pin, metadata, parse_tag("cp311-cp311-manylinux_2_28_aarch64"))

    def test_unknown_or_missing_installed_wheel_tags_are_fatal(self):
        from pip._vendor.packaging.tags import parse_tag
        pin = {"file": "bpy-4.5.14-cp311-cp311-manylinux_2_28_x86_64.whl"}
        supported = parse_tag("cp311-cp311-manylinux_2_28_x86_64")
        for metadata in ("Wheel-Version: 1.0\n", "Tag: cp310-cp310-manylinux_2_28_x86_64\n"):
            with self.assertRaises(RuntimeError):
                install.known_tag_defect(pin, metadata, supported)
        self.assertFalse(install.known_tag_defect(
            pin, "Tag: cp311-cp311-manylinux_2_28_x86_64\n", supported))

    def dist(self, version="4.5.14", requires=None, requires_python="==3.11.*"):
        return types.SimpleNamespace(version=version, requires=requires,
                                     metadata={"Requires-Python": requires_python})

    def test_exact_pins_and_active_dependency_specifiers_pass(self):
        with patch.object(install.md, "distribution", return_value=self.dist(requires=["numpy>=1.26,<2"])), \
                patch.object(install.md, "version", return_value="1.26.4"), \
                patch.object(install.platform, "python_version", return_value="3.11.14"):
            self.assertEqual(install.dependency_versions([{"name": "bpy", "version": "4.5.14"}]), {"bpy": "4.5.14"})

    def test_wrong_pinned_version_is_fatal(self):
        with patch.object(install.md, "distribution", return_value=self.dist(version="4.5.13")):
            with self.assertRaisesRegex(RuntimeError, "expected 4.5.14"):
                install.dependency_versions([{"name": "bpy", "version": "4.5.14"}])

    def test_missing_active_dependency_is_fatal(self):
        with patch.object(install.md, "distribution", return_value=self.dist(requires=["numpy"])), \
                patch.object(install.md, "version", side_effect=md.PackageNotFoundError("numpy")), \
                patch.object(install.platform, "python_version", return_value="3.11.14"):
            with self.assertRaises(md.PackageNotFoundError):
                install.dependency_versions([{"name": "bpy", "version": "4.5.14"}])

    def test_conflicting_active_dependency_is_fatal(self):
        with patch.object(install.md, "distribution", return_value=self.dist(requires=["numpy<2"])), \
                patch.object(install.md, "version", return_value="2.0.0"), \
                patch.object(install.platform, "python_version", return_value="3.11.14"):
            with self.assertRaisesRegex(RuntimeError, "numpy<2"):
                install.dependency_versions([{"name": "bpy", "version": "4.5.14"}])

    def test_requires_python_mismatch_is_fatal(self):
        with patch.object(install.md, "distribution", return_value=self.dist()), \
                patch.object(install.platform, "python_version", return_value="3.12.0"):
            with self.assertRaisesRegex(RuntimeError, "Requires-Python"):
                install.dependency_versions([{"name": "bpy", "version": "4.5.14"}])

    def test_inactive_optional_dependency_is_not_required(self):
        dist = self.dist(requires=['missing-extra; extra == "socks"'])
        with patch.object(install.md, "distribution", return_value=dist), \
                patch.object(install.md, "version") as version, \
                patch.object(install.platform, "python_version", return_value="3.11.14"):
            install.dependency_versions([{"name": "bpy", "version": "4.5.14"}])
            version.assert_not_called()

    def test_wrong_blender_build_is_fatal_before_scene_initialization(self):
        fake = types.SimpleNamespace(app=types.SimpleNamespace(version=(4, 5, 13), version_string="4.5.13"))
        with patch.dict(sys.modules, {"bpy": fake}), self.assertRaisesRegex(RuntimeError, "Expected Blender 4.5.14"):
            install.cpu_smoke()


if __name__ == "__main__":
    unittest.main()
