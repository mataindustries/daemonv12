"""Failure/resume/storage contracts for the bounded Gate B workflow."""
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import gate_a as A
import gate_b as B
import gate_b_render as R
from test_gate_a import approved_settings


class RecoveryTests(unittest.TestCase):
    def test_aggregate_storage_reservation_blocks_before_render(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(B.artifact_budget, "remote_budget", return_value={"retainedBytes": 145_000_000}), \
                    self.assertRaisesRegex(RuntimeError, "256 MB"):
                B.budget(Path(tmp))
            with patch.object(B.artifact_budget, "remote_budget", return_value={"retainedBytes": 144_000_000}), \
                    patch.dict(B.os.environ, {"RESUME_RUN_ID": "", "RESUME_ATTEMPT": "1"}):
                B.budget(Path(tmp))
                self.assertEqual(json.loads((Path(tmp) / "storage.json").read_text())["gateBReserveBytes"], 256_000_000)

    def test_resume_rejects_different_pixels_or_settings(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            path = folder / "frame_0285.png"
            path.write_bytes(b"completed pixels")
            entry = {"frame": 285, "sha256": A.digest(path), "settings": approved_settings(), "fingerprint": "key"}
            self.assertTrue(R.cached(entry, folder, "key", [285, 286, 287, 288]))
            self.assertFalse(R.cached(entry, folder, "stale", [285, 286, 287, 288]))
            self.assertFalse(R.cached(dict(entry, settings=approved_settings(8)), folder, "key", [285]))
            path.write_bytes(b"damaged pixels")
            self.assertFalse(R.cached(entry, folder, "key", [285]))

    def test_artifact_cap_preserves_pngs_and_excludes_oversized_derivatives(self):
        with tempfile.TemporaryDirectory() as tmp:
            out, dest = Path(tmp) / "out", Path(tmp) / "publish"
            out.mkdir()
            for f in range(285, 289):
                (out / f"frame_{f:04d}.png").write_bytes(b"verified PNG pixels")
            (out / "review.mp4").write_bytes(b"x" * 2000)
            with patch.object(A, "png_header"), patch.object(B, "ARTIFACT_MAX", 1_001_000):
                with self.assertRaisesRegex(RuntimeError, "lossless frames were preserved"):
                    B.publish(out, dest)
                self.assertEqual(len(list(dest.glob("*.png"))), 4)
                self.assertFalse((dest / "review.mp4").exists())
                publication = json.loads((dest / "artifact-publication.json").read_text())
                self.assertEqual(publication["excludedDerivedFiles"], ["review.mp4"])
                self.assertLess(B.size(dest), 1_001_000)

    def test_interrupted_render_reuses_exact_completed_frames(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "source"
            config = source / A.PRODUCTION / "colab/config.json"
            config.parent.mkdir(parents=True)
            config.write_text(json.dumps({"pins": {"wheels": []}}))
            out = root / "first"
            out.mkdir()
            scene = types.SimpleNamespace()
            calls = []
            fail = [True]
            def renderer(data, frames, resolution, samples, out_dir):
                self.assertEqual(resolution, (1080, 1920))
                self.assertEqual(samples, 16)
                calls.extend(frames)
                if frames == [287] and fail[0]:
                    raise RuntimeError("interrupted")
                (Path(out_dir) / f"frame_{frames[0]:04d}.png").write_bytes(f"pixels {frames[0]}".encode())
            prod = types.SimpleNamespace(build=lambda candidate: {"scene": scene},
                                         validate=lambda data: {"ok": True, "checks": []},
                                         set_device=lambda *_: "CPU", render_frames=renderer)
            fake_bpy = types.SimpleNamespace(app=types.SimpleNamespace(version=(4, 5, 14)))
            with patch.dict(sys.modules, {"bpy": fake_bpy, "angeles2099": prod}), \
                    patch.object(A, "preflight", return_value={"renderFingerprint": "approved"}), \
                    patch.object(A, "git", return_value=""), \
                    patch.object(A, "settings_snapshot", return_value=approved_settings()), \
                    patch.object(A, "image_stats", return_value={"finite": True}):
                with self.assertRaisesRegex(RuntimeError, "interrupted"):
                    R.render(source, out, 0)
                self.assertEqual([e["frame"] for e in json.loads((out / "manifest.json").read_text())["frames"]], [285, 286])
                calls.clear()
                fail[0] = False
                resumed = root / "resumed"
                resumed.mkdir()
                report = R.render(source, resumed, 0, out)
                self.assertEqual(calls, [287, 288])
                self.assertEqual(sum(e["reused"] for e in report["frames"]), 2)
                calls.clear()
                final = root / "complete"
                final.mkdir()
                R.render(source, final, 0, resumed)
                self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main()
