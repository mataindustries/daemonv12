"""Pure planning helpers for a later, separately approved teaser workflow. No renderer."""
from fractions import Fraction
import math


def teaser_chunks(workers=10):
    """Contiguous, balanced inclusive ranges; frame 285 / 24 = 11.875 s."""
    if type(workers) is not int or not 8 <= workers <= 12:
        raise ValueError("Use 8-12 standard CPU workers only after measured approval")
    count, remainder = divmod(201, workers)
    first, chunks = 285, []
    for index in range(workers):
        length = count + (index < remainder)
        chunks.append({"index": index, "first": first, "last": first + length - 1, "count": length})
        first += length
    return chunks


def estimate(build_seconds, frame_seconds, workers=10):
    """Planning only; padded worker wall and total runner minutes, excluding setup."""
    if (not math.isfinite(build_seconds) or build_seconds < 0 or not frame_seconds
            or any(not math.isfinite(s) or s <= 0 for s in frame_seconds)):
        raise ValueError("Need positive measured frame times and a nonnegative build time")
    chunks = teaser_chunks(workers)
    mean, worst = sum(frame_seconds) / len(frame_seconds), max(frame_seconds)
    return {
        "workers": workers,
        "frames": 201,
        "durationSeconds": float(Fraction(201, 24)),
        "audioStartSeconds": float(Fraction(285, 24)),
        "runnerMinutesAtMean": (workers * build_seconds + 201 * mean) * 1.25 / 60,
        "renderWallMinutesAtWorst": (build_seconds + max(c["count"] for c in chunks) * worst) * 1.25 / 60,
        "filmAdditionalFramesIfAllTeaserPNGsRetained": 600 - 201,
        "note": "Illustrative projection from sparse frames; add install/queue time. No job is submitted.",
    }

