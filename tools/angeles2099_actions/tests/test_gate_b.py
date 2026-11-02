"""Real FFmpeg integration on synthetic images/audio; never invokes the production renderer."""
import hashlib
import json
import math
import shutil
import struct
import sys
import tempfile
import unittest
import wave
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import gate_b_media as M
import gate_b_render as R
import gate_b as B


def png(path, frame, dimensions=(96, 160)):
    width, height = dimensions
    def chunk(kind, payload):
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload))
    rows = b"".join(b"\x00" + bytes(v for x in range(width)
                     for v in ((x * 3 + frame * 17) % 256, (y * 2 + frame * 7) % 256,
                               ((x + y + frame * 4) * 5) % 256)) for y in range(height))
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
                     + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b""))


def master(path, duration=14):
    # More than 12.375 s; changing chirp frequencies make wrong source offsets detectable.
    import numpy as np
    rate = 44100
    t = np.arange(duration * rate) / rate
    a = 0.24 * np.sin(2 * np.pi * (199 * t + 8 * t * t)) + 0.10 * np.sin(2 * np.pi * 631 * t)
    b = 0.18 * np.sin(2 * np.pi * (311 * t + 5 * t * t)) + a * 0.35
    samples = (np.stack((a, b), axis=1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as f:
        f.setparams((2, 2, rate, len(t), "NONE", "not compressed"))
        f.writeframes(samples.tobytes())


class MediaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
            raise RuntimeError("FFmpeg and ffprobe are required for Gate B integration tests")
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name)
        cls.pngs = cls.root / "pngs"
        cls.pngs.mkdir()
        for frame in range(285, 297):
            png(cls.pngs / f"frame_{frame:04d}.png", frame)
        cls.paths = []
        for i, spec in enumerate(R.CHUNKS):
            path = cls.root / f"chunk-{i}.mp4"
            M.encode_chunk(cls.pngs, spec["first"], 4, path, (96, 160))
            cls.paths.append(path)
        cls.output = cls.root / "joined"
        cls.output.mkdir()
        cls.video = cls.output / "video.mp4"
        cls.video_qa, cls.boundaries = M.concat_chunks(cls.paths, cls.video, [4, 4, 4], (96, 160))
        cls.audio_master = cls.root / "master.wav"
        master(cls.audio_master)
        cls.reference = cls.output / "reference.wav"
        cls.reference_qa = M.audio_reference(cls.audio_master, 285, 12, cls.reference)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_fixed_proof_is_three_contiguous_chunks_only(self):
        self.assertEqual([f for c in R.CHUNKS for f in range(c["first"], c["last"] + 1)], list(range(285, 297)))
        for bad in (-1, 3, True, "0"):
            with self.assertRaises(ValueError):
                R.chunk(bad)

    def test_real_concat_preserves_every_decoded_frame_and_two_boundaries(self):
        expected = [h for p in self.paths for h in M.video_qa(p, 4, (96, 160))["frameSha256"]]
        self.assertEqual(self.video_qa["frameSha256"], expected)
        self.assertEqual(self.video_qa["count"], 12)
        self.assertEqual(self.video_qa["duration"], "1/2")
        self.assertEqual([x["outputFrame"] for x in self.boundaries], [4, 8])

    def test_exact_offset_includes_half_of_a_44k1_source_sample(self):
        q = self.reference_qa
        self.assertEqual(q["sourceOffsetSeconds"], 11.875)
        self.assertEqual(q["startSample48k"], 570000)
        self.assertEqual(q["sampleCount"], 24000)
        self.assertTrue(q["independentOffsetVerified"])

    def test_real_aac_mux_retains_video_and_has_sample_accurate_sync(self):
        video, audio = M.mux_and_check(self.video, self.reference, self.output / "review.mp4", 12, (96, 160))
        self.assertEqual(video["frameSha256"], self.video_qa["frameSha256"])
        self.assertLessEqual(abs(audio["bestLagSamples48k"]), 1)
        self.assertGreater(audio["zeroLagCorrelation"], 0.98)
        self.assertLess(audio["tailPaddingSamples"], 1024)
        self.assertEqual(audio["expectedSamples"], 24000)

    def test_missing_or_extra_decoded_frame_is_rejected(self):
        with self.assertRaises(RuntimeError):
            M.video_qa(self.paths[0], 3, (96, 160))
        with self.assertRaises(RuntimeError):
            M.video_qa(self.paths[0], 5, (96, 160))

    def test_shifted_audio_is_rejected(self):
        import numpy as np
        expected = np.frombuffer(M.pcm(self.reference), dtype="<f4").reshape(-1, 2)
        delayed = np.concatenate((np.zeros((2000, 2)), expected[:-2000]))
        with self.assertRaisesRegex(RuntimeError, "synchronization"):
            M.alignment(expected, delayed)

    def test_wrong_source_audio_offset_is_rejected(self):
        import numpy as np
        wrong = self.output / "wrong.wav"
        M.audio_reference(self.audio_master, 286, 12, wrong)
        expected = np.frombuffer(M.pcm(self.reference), dtype="<f4").reshape(-1, 2)
        actual = np.frombuffer(M.pcm(wrong), dtype="<f4").reshape(-1, 2)
        with self.assertRaises(RuntimeError):
            M.alignment(expected, actual)

    def test_silence_cannot_establish_sync(self):
        import numpy as np
        silent = np.zeros((24000, 2))
        with self.assertRaises(RuntimeError):
            M.alignment(silent, silent)

    def test_corrupt_audio_is_rejected(self):
        import numpy as np
        corrupt = np.zeros((24000, 2))
        corrupt[0, 0] = float("nan")
        with self.assertRaisesRegex(RuntimeError, "Non-finite"):
            M.alignment(corrupt, corrupt)

    def test_mismatched_stream_resolution_is_rejected(self):
        with self.assertRaises(RuntimeError):
            M.video_qa(self.paths[0], 4, (1080, 1920))

    def test_production_resume_rejects_reordered_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            (folder / "manifest.json").write_text(json.dumps({
                "schema": 1, "gate": "B", "chunk": R.chunk(0), "sourceCommit": B.A.SOURCE,
                "fingerprint": "test", "frames": [{"frame": f} for f in [286, 285, 287, 288]]}))
            with self.assertRaisesRegex(RuntimeError, "frame order"):
                B.valid_manifest(folder, 0, "test")


if __name__ == "__main__":
    unittest.main()
