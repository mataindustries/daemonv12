#!/usr/bin/env python3
"""Exact arrangement changes: events present in a version but not in MORPH//05 V3, and vice versa.
Usage: python3 experiments/morph-06/event_changes.py OUT.md V3_EVENTS.json NAME=EVENTS.json ..."""
import json
import sys
from pathlib import Path

KEYS = ("part", "event", "step", "pitch", "velocity", "detail", "lengthSteps")
BULK = {("ratchet", "repeat"), ("cable", "wind strike"), ("perc", "cable tick")}


def load(p):
    return json.loads(Path(p).read_text())["events"]


def key(r):
    return tuple(json.dumps(r.get(k), sort_keys=True) for k in KEYS)


def fmt(r):
    return f"| {r['sampleFrame'] / 44100:.4f} | {r['position']} | {r['sampleFrame']} | {r['frame60']} | {r['part']} | {r['event']} | {r.get('pitch') or ''} | {r.get('velocity') if r.get('velocity') is not None else ''} | {r.get('detail') or ''} |"


out, ref = Path(sys.argv[1]), load(sys.argv[2])
lines = ["# MORPH//06: exact event changes against MORPH//05 V3", "",
         "Every scheduled event that differs from V3, generated from the event maps the renders read.",
         "Time = sampleFrame / 44100; f60 = floor(sampleFrame x 60 / 44100). Ratchet repeats, wind strikes and",
         "cable ticks are counted rather than listed (their full lists are in each version's events.json).", ""]
for arg in sys.argv[3:]:
    name, p = arg.split("=", 1)
    ev = load(p)
    rk, vk = {key(r) for r in ref}, {key(r) for r in ev}
    removed = [r for r in ref if key(r) not in vk]
    added = [r for r in ev if key(r) not in rk]
    lines += [f"## {name.upper()}", ""]
    for title, rows in (("Removed (in V3, not here)", removed), ("Added or changed (here, not in V3)", added)):
        bulk = {}
        listed = [r for r in rows if (r["part"], r["event"]) not in BULK or bulk.setdefault((r["part"], r["event"]), []).append(r)]
        lines += [f"### {title}: {len(rows)} events", ""]
        for (part, event), rs in sorted(bulk.items()):
            lines.append(f"- {len(rs)} x {part} {event}, {rs[0]['sampleFrame'] / 44100:.3f}-{rs[-1]['sampleFrame'] / 44100:.3f} s")
        if bulk:
            lines.append("")
        if listed:
            lines += ["| Time (s) | Position | Sample | f60 | Part | Event | Pitch | Velocity | Detail |", "|---:|---|---:|---:|---|---|---|---:|---|"]
            lines += [fmt(r) for r in sorted(listed, key=lambda r: (r["sampleFrame"], r["part"]))]
        lines.append("")
out.write_text("\n".join(lines) + "\n")
print(out, sum(1 for l in lines if l.startswith("|")))
