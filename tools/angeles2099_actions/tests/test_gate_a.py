"""Contracts, failure recovery and frame arithmetic; no Blender or network required."""
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import artifact_budget
import gate_a
import plan


def approved_settings(samples=16):
    return {"engine": "CYCLES", "device": "CPU", "resolution": [1080, 1920], "percentage": 100,
            "samples": samples, "denoising": True, "denoiser": "OPENIMAGEDENOISE",
            "denoisingGPU": False, "motionBlur": True, "shutter": 0.5, "fps": 24,
            "fpsBase": 1.0, "seed": 0, "adaptiveSampling": True, "adaptiveThreshold": 0.02,
            "viewTransform": "AgX", "motionBlurPosition": "CENTER"}


class PlanningTests(unittest.TestCase):
    def test_every_supported_partition_has_exact_order_and_coverage(self):
        for workers in range(8, 13):
            with self.subTest(workers=workers):
                chunks = plan.teaser_chunks(workers)
                frames = [f for c in chunks for f in range(c["first"], c["last"] + 1)]
                self.assertEqual(frames, list(range(285, 486)))
                self.assertEqual(len(chunks), workers)
                lengths = [c["count"] for c in chunks]
                self.assertLessEqual(max(lengths) - min(lengths), 1)
                self.assertEqual(chunks, plan.teaser_chunks(workers))

    def test_rejects_unapproved_worker_counts_and_types(self):
        for value in (0, 7, 13, 201, True, 8.0, "10"):
            with self.assertRaises(ValueError):
                plan.teaser_chunks(value)

    def test_exact_sync_and_no_film_resubmission(self):
        projection = plan.estimate(70, [85, 204, 145])
        self.assertEqual(projection["audioStartSeconds"], 11.875)
        self.assertEqual(projection["durationSeconds"], 8.375)
        self.assertEqual(projection["filmAdditionalFramesIfAllTeaserPNGsRetained"], 399)
        self.assertAlmostEqual(projection["runnerMinutesAtMean"], (700 + 201 * (434 / 3)) * 1.25 / 60)

    def test_no_projection_without_positive_measurements(self):
        for build, times in ((-1, [1]), (1, []), (1, [0]), (1, [-1])):
            with self.assertRaises(ValueError):
                plan.estimate(build, times)


class GuardTests(unittest.TestCase):
    def test_no_full_teaser_or_film_frames_exposed(self):
        for frame, samples in ((0, 16), (285, 16), (485, 16), (599, 16), (330, 128), (170, 8)):
            with self.assertRaises(ValueError):
                gate_a.render_path(frame, samples)

    def test_quality_cannot_silently_degrade(self):
        gate_a.assert_settings(approved_settings(), 16)
        for name, value in (("device", "GPU"), ("engine", "BLENDER_EEVEE_NEXT"),
                            ("resolution", [720, 1280]), ("percentage", 50), ("samples", 8),
                            ("motionBlur", False), ("shutter", 0.0), ("denoising", False),
                            ("fps", 30), ("denoisingGPU", True), ("motionBlurPosition", "END"),
                            ("adaptiveThreshold", 0.1)):
            with self.subTest(name=name), self.assertRaises(RuntimeError):
                gate_a.assert_settings(dict(approved_settings(), **{name: value}), 16)

    def test_storage_counts_all_pages_input_and_ignores_expired(self):
        result = artifact_budget.check_total([{"size_in_bytes": 100_000_000},
                                             {"size_in_bytes": 200_000_000},
                                             {"size_in_bytes": 999_000_000, "expired": True}])
        self.assertEqual(result["retainedBytes"], 300_000_000)
        with self.assertRaises(RuntimeError):
            artifact_budget.check_total([{"size_in_bytes": 340_000_000}])

    def test_source_commit_must_match_before_any_input_access(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(gate_a, "git", return_value="wrong"):
            with self.assertRaisesRegex(RuntimeError, "not approved commit"):
                gate_a.preflight(Path(tmp), Path(tmp) / "out")


class ResumeTests(unittest.TestCase):
    def test_cache_rejects_changed_inputs_corruption_and_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            path = root / gate_a.render_path(170, 16)
            path.parent.mkdir()
            path.write_bytes(b"completed output")
            entry = {"frame": 170, "samples": 16, "path": "samples16/frame_0170.png",
                     "seconds": 1.0, "renderFingerprint": "exact", "sha256": gate_a.digest(path)}
            self.assertTrue(gate_a.valid_resume(entry, root, "exact"))
            for changes in ({"renderFingerprint": "stale"}, {"sha256": "corrupt"},
                            {"path": "../frame_0170.png"}, {"seconds": -1}, {"seconds": float("nan")},
                            {"frame": 599}, {"samples": 8}):
                self.assertFalse(gate_a.valid_resume(dict(entry, **changes), root, "exact"))
            path.unlink()
            self.assertFalse(gate_a.valid_resume(entry, root, "exact"))
            other = root / "outside.png"
            other.write_bytes(b"completed output")
            path.symlink_to(other)
            self.assertFalse(gate_a.valid_resume(entry, root, "exact"))


class HarnessTests(unittest.TestCase):
    """Exercise real manifest/caching control flow with a deliberately synthetic renderer."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.source = self.root / "source"
        config = self.source / gate_a.PRODUCTION / "colab/config.json"
        config.parent.mkdir(parents=True)
        config.write_text(json.dumps({"pins": {"wheels": []}}))
        self.out = self.root / "first"
        self.out.mkdir()
        self.calls, self.build_calls = [], []
        self.scene = types.SimpleNamespace(cycles=types.SimpleNamespace(samples=16),
                                           render=types.SimpleNamespace(), camera=types.SimpleNamespace(name="approved-camera"))
        self.fail_at = None
        self.production = types.SimpleNamespace(
            build=self.build, validate=lambda _: {"ok": True, "checks": []},
            set_device=lambda *_: "CPU", render_frames=self.fake_render)
        self.bpy = types.SimpleNamespace(app=types.SimpleNamespace(version=(4, 5, 14), version_string="4.5.14 LTS"))
        self.patchers = [
            patch.dict(sys.modules, {"bpy": self.bpy, "angeles2099": self.production}),
            patch.object(gate_a, "preflight", side_effect=self.preflight),
            patch.object(gate_a, "git", return_value=""),
            patch.object(gate_a, "settings_snapshot", side_effect=lambda sc: approved_settings(sc.cycles.samples)),
            patch.object(gate_a, "image_stats", return_value={"finite": True}),
            patch.object(gate_a, "compare", return_value={"psnrLinearDb": 35, "meanAbsoluteErrorLinear": 0.01}),
        ]
        for p in self.patchers:
            p.start()

    def tearDown(self):
        for p in reversed(self.patchers):
            p.stop()
        self.tmp.cleanup()

    def preflight(self, *_):
        return {"schema": gate_a.SCHEMA, "sourceCommit": gate_a.SOURCE, "renderFingerprint": "exact",
                "runId": "synthetic", "attempt": "1", "python": "3.11.14",
                "host": {"cpu": "synthetic", "logicalCPUs": 4},
                "renders": [], "comparisons": [], "state": "preflight-passed"}

    def build(self, *args, **kwargs):
        self.build_calls.append((args, kwargs))
        return {"scene": self.scene}

    def fake_render(self, scene_data, frames, res, samples, out_dir):
        self.calls.append((frames, res, samples))
        if len(self.calls) == self.fail_at:
            raise RuntimeError("synthetic render failure")
        self.scene.cycles.samples = samples
        (Path(out_dir) / f"frame_{frames[0]:04d}.png").write_bytes(f"pixels {frames[0]} {samples}".encode())

    def run_harness(self, out=None, resume=None):
        out = out or self.out
        out.mkdir(exist_ok=True)
        gate_a.render(self.source, out, resume or self.root / "absent")
        return json.loads((out / "manifest.json").read_text())

    def test_smoke_is_bounded_and_builds_all_animation_keys(self):
        report = self.run_harness()
        self.assertEqual(self.build_calls, [(("crest",), {})])
        self.assertEqual([(f[0][0], f[2]) for f in self.calls],
                         [(170, 16), (330, 16), (470, 16), (170, 128), (470, 128)])
        self.assertTrue(all(c[1] == (1080, 1920) for c in self.calls))
        self.assertEqual(report["state"], "rendered-awaiting-visual-review")
        self.assertEqual(len(report["comparisons"]), 2)
        self.assertEqual(report["projection"]["frames"], 201)

    def test_successful_frames_survive_failure_and_only_missing_frames_render(self):
        self.fail_at = 3
        with self.assertRaisesRegex(RuntimeError, "synthetic render failure"):
            self.run_harness()
        saved = json.loads((self.out / "manifest.json").read_text())
        self.assertEqual(saved["state"], "failed")
        self.assertEqual([r["frame"] for r in saved["renders"]], [170, 330])
        self.calls.clear()
        self.fail_at = None
        report = self.run_harness(self.root / "resumed", self.out)
        self.assertEqual(len(self.calls), 3)
        self.assertEqual(sum(r["reused"] for r in report["renders"]), 2)

    def test_verified_completed_run_costs_no_more_renders(self):
        self.run_harness()
        self.calls.clear()
        report = self.run_harness(self.root / "resumed", self.out)
        self.assertEqual(self.calls, [])
        self.assertTrue(all(r["reused"] for r in report["renders"]))

    def test_corrupt_cached_frame_is_rendered_again(self):
        self.run_harness()
        (self.out / "samples16/frame_0330.png").write_bytes(b"corrupted")
        self.calls.clear()
        self.run_harness(self.root / "resumed", self.out)
        self.assertEqual(self.calls, [([330], (1080, 1920), 16)])

    def test_invalid_scene_stops_before_any_render(self):
        self.production.validate = lambda _: {"ok": False, "checks": [{"ok": False}]}
        with self.assertRaisesRegex(RuntimeError, "scene checks failed"):
            self.run_harness()
        self.assertEqual(self.calls, [])
        self.assertEqual(json.loads((self.out / "manifest.json").read_text())["state"], "failed")


if __name__ == "__main__":
    unittest.main()

