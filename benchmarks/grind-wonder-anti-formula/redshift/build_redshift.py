#!/usr/bin/env python3
"""REDSHIFT - one continuation (13.667 s) after Wonder's approved Gate 2 (../c-impossible-ascent-gate2.json, untouched).

THE BREAKTHROUGH CHANGES GRAVITY. Past the wall, everything falls into a heavier gravity: its clock runs at three
quarters (144 -> 108 BPM) and every sound plays at three-quarter rate (a fourth lower, longer envelopes), like
gravitational time dilation and redshift. Only the phrase that broke through keeps its own proper time: Wonder's p1,
note for note (same pitches, rates, gates, velocities, envelope), still at 144 BPM in E.

  Cycle 1 (bars 18-21 / world bars W1-W3)  two clocks: the unchanged phrase over the dilated world (3 against 4)
  Cycle 2 (bars 22-25 / world bars W4-W6)  LOCK: gravity captures the phrase's downbeat; the floor sings the phrase

Both clocks share one pulse: a 108 BPM sixteenth = a 144 BPM triplet eighth = 320 ticks (Gate 2's hat "stumble").
They agree on a downbeat every 6.667 s: 28.333 s, 35.0 s, 41.667 s.

Same 144 BPM, 4/4, 960 PPQ timeline as Gate 2. Bars 1-17 are deliberately empty so every tick of bars 18-25 lands on
the exact frame Gate 2's renderer would give it; mix_redshift.ts keeps frames from 28.0 s (Gate 2's last frame + 1).
Sampler only, Gate 2's own assets (../assets). Writes ../c-impossible-ascent-redshift.json and redshift/score/."""
import json, os, pathlib
from fractions import Fraction as F

HERE = pathlib.Path(__file__).resolve().parent
BPM, PPQ = 144, 960
BAR, BEAT = 4 * PPQ, PPQ             # 3840, 960 ticks
W16 = 320                            # one sixteenth of the 108 BPM world = one 144 BPM triplet eighth
WBAR = 16 * W16                      # 5120 ticks = 2.222 s
ORIGIN_BAR = 18                      # every pattern below starts at Gate 2's bar 18 (28.333 s)
PAT_BARS = 8                         # bars 18-25; the render ends on bar 26's downbeat (41.667 s)
RS = 0.749154                        # the redshift: -5 semitones (catalog rate table), i.e. three-quarter rate

def r(semi): return round(2 ** (semi / 12), 5)   # identical to Wonder's build_developed.py helper
def pos(t):
    """Pattern-relative tick -> 'bar:beat+n/d' (offset as a whole-note fraction on the 960-PPQ grid)."""
    assert 0 <= t < PAT_BARS * BAR, t
    bar, beat, rem = t // BAR + 1, (t % BAR) // BEAT + 1, t % BEAT
    s = f"{bar}:{beat}"
    if rem:
        fr = F(rem, BAR); s += f"+{fr.numerator}/{fr.denominator}"
    return s
def dur(ticks): fr = F(ticks, BAR); return f"{fr.numerator}/{fr.denominator}"
def W(wbar, s16): return (wbar - 1) * WBAR + round(s16 * W16)          # world bar 1..6, sixteenth 0..15
def note(t, vel, rate=None, gate=None, choke=None, release=0.03):
    d = {"start": pos(t), "velocity": vel}
    if rate is not None: d["playbackRate"] = rate
    if gate is not None:
        d["gate"] = dur(gate); d["envelope"] = {"attackSeconds": 0.003, "releaseSeconds": release}; d["chokeGroup"] = choke or "x"
    return d

# --- the phrase: Wonder's p1, verbatim (build_developed.py: p1), placed by absolute tick ---------------------------
P1 = [(0, .8, r(0), BEAT), (BEAT, .78, r(2), BEAT), (2 * BEAT, .82, r(5), BEAT), (3 * BEAT, .85, r(7), 3 * BEAT // 4),
      (15 * BEAT // 4, .7, r(2), BEAT // 4)]                            # E5 F#5 A5 B5, then the 16th fall-back F#5
def p1_at(t0, held_fallback=None):
    out = [note(t0 + dt, v, rt, g, "ph") for dt, v, rt, g in P1]
    if held_fallback: out[-1]["gate"] = dur(held_fallback)               # only the final statement: the fall-back lands
    return out

# --- the dilated world (rates x RS; 808/glass on equal-tempered B so the phrase in E stays in tune) ----------------
KICK, SNARE, CLAP, CLOCK, WALL, GLASS = RS, RS, RS, RS, round(0.5 * RS, 6), r(-2)   # E1 kick, E3 snare, B4 glass
B0, F1s, B1, C2s, E2, F2s = r(-10), r(-3), r(2), r(4), r(7), r(9)                   # Abyss/Reactor are rooted on A1

phrase, b808, kick, snare, clap, clock, wall, glass = [], [], [], [], [], [], [], []

# Cycle 1 - two clocks. The world is heavy and almost empty: wall + kick + 808 on its downbeat, snare on its beat 3,
# a steady clock on its four beats. The phrase enters on bar 18 (with the world) and bar 20 (on the world's snare).
# The 808 speaks Gate 2's 808 vocabulary redshifted: Gate 2's E1 floor / E2 pops / B1 become B0 / B1 / F#1.
for w in (1, 2, 3):
    kick.append(note(W(w, 0), .9, KICK, 2 * W16, "k"))
    b808.append(note(W(w, 0), .92, B0, 7 * W16, "b808"))                 # the new floor: a fourth under Gate 2's E1
    if w == 2: b808.append(note(W(w, 10), .86, F1s, 2 * W16, "b808"))
    b808.append(note(W(w, 14), .9, B1, 2 * W16, "b808"))                 # octave pop leading into the next world bar
    wall.append(note(W(w, 0), .95 if w == 1 else .88, WALL, 8 * W16, "w", release=0.3))
    snare.append(note(W(w, 8), .9, SNARE, 2 * W16, "s"))
    clap.append(note(W(w, 8), .5, CLAP, W16, "s"))
    for s16, v in ((0, .42), (4, .3), (8, .36), (12, .3)): clock.append(note(W(w, s16), v, CLOCK))
phrase += p1_at(0)                    # bar 18 = W1:0  (28.333 s) - same downbeat as the world
phrase += p1_at(2 * BAR)              # bar 20 = W2:8  (31.667 s) - lands on the world's snare
glass.append(note(W(1, 12), .45, GLASS, BEAT // 2, "g"))                 # 30.000 s: Wonder's last glass, a fourth lower

# Cycle 2 - LOCK (W4 = bar 22 = 35.0 s, where both downbeats agree again). Gravity captures the phrase's downbeat:
# each statement now starts on a world downbeat, but its notes keep proper time (every 3 world sixteenths). The floor
# (808 + kick) hits with every note, singing the phrase a fourth below.
LOCK = [(0, B1, .9), (3, C2s, .65), (6, E2, .8), (9, F2s, .7)]     # (sixteenth, 808 pitch, kick velocity)
for w in (4, 5, 6):
    t0 = W(w, 0)
    for i, (s16, rate, kv) in enumerate(LOCK):
        last = (w == 6 and i == 3)
        b808.append(note(W(w, s16), .92, B0 if last else rate, (W(7, 0) - W(w, s16) - 80) if last else 3 * W16, "b808"))
        kick.append(note(W(w, s16), kv, KICK, 2 * W16, "k"))
    snare.append(note(W(w, 8), .9, SNARE, 2 * W16, "s"))
    clap.append(note(W(w, 8), .5, CLAP, W16, "s"))
    for s16, v in ((0, .42), (4, .3), (8, .36), (12, .3)): clock.append(note(W(w, s16), v, CLOCK))
    if w == 4:
        phrase += p1_at(t0)                                              # the lock: phrase + floor together
        wall.append(note(t0, .9, WALL, 8 * W16, "w", release=0.3))
    if w == 5:                                                           # the phrase is silent: the world sings it
        for (dt, v, rt, g), gr in zip(P1[:4], (r(-2), r(0), r(3), r(5))):  # glass B4 C#5 E5 F#5 = p1 a fourth lower
            glass.append(note(t0 + dt, .75, gr, g, "g"))
    if w == 6:                                                           # last statement: the fall-back is held
        phrase += p1_at(t0, held_fallback=W(7, 0) - (t0 + 15 * BEAT // 4) - 80)
        wall.append(note(W(6, 9), .95, WALL, W(7, 0) - W(6, 9) - 80, "w", release=0.3))
        glass.append(note(W(6, 9), .4, GLASS, BEAT // 2, "g"))

SIG, ORB, GLA = "assets/v12-signature/", "assets/orbital-foundry/", "assets/glasshouse/"
def track(tid, sample, notes, description):
    return {"id": tid, "description": description, "instrument": {"type": "sampler", "sample": sample},
            "clips": [{"bar": ORIGIN_BAR, "pattern": tid}],
            "patterns": [{"id": tid, "bars": PAT_BARS, "notes": notes}]}

proj = {"formatVersion": 1, "title": "C - IMPOSSIBLE ASCENT: REDSHIFT (continuation after Gate 2)",
 "description": "13.667 s continuation of the approved Gate 2 (bars 18-25 on Gate 2's 144 BPM grid; bars 1-17 empty). "
  "The world plays at three-quarter time and rate (108 BPM, a fourth lower); the phrase keeps proper time (Wonder's p1, verbatim, 144 BPM). "
  "Cycle 1: two clocks. Cycle 2 (35.0 s): lock - the floor sings the phrase a fourth below.",
 "bpm": BPM, "timeSignature": "4/4", "key": "E minor", "bars": ORIGIN_BAR - 1 + PAT_BARS, "seed": 18,
 "render": {"duration": {"bars": ORIGIN_BAR - 1 + PAT_BARS}, "tail": "none"}, "master": {"gainDb": 0, "effects": []},
 "tracks": [
  track("phrase", SIG + "10-phantom.wav", phrase, "Proper time: Wonder's p1 verbatim (E5 F#5 A5 B5 / F#5) at 144 BPM"),
  track("bass808", SIG + "07-abyss.wav", b808, "Dilated floor in B; from 35.0 s sings p1 a fourth below"),
  track("bass808-grit", SIG + "08-reactor.wav", [dict(n) for n in b808], "Reactor layer of the same 808 part"),
  track("kick", SIG + "01-sub-hammer.wav", kick, "Sub Hammer at 3/4 rate (E1)"),
  track("snare", SIG + "03-titanium-crack.wav", snare, "Titanium Crack at 3/4 rate, world beat 3"),
  track("clap", SIG + "04-neon-clap.wav", clap, "Neon Clap at 3/4 rate, world beat 3"),
  track("clock", ORB + "04-machine-tick.wav", clock, "Gate 2's machine-tick clock, now steady on the 108 BPM beat"),
  track("wall", ORB + "06-low-boom.wav", wall, "Gate 2's wall at 3/4 of its rate (0.5 x 0.749)"),
  track("glass", GLA + "01-glass-hit.wav", glass, "Gate 2's glass, redshifted to B4; in W5 it carries p1 a fourth lower"),
 ]}
out = pathlib.Path(os.environ.get("REDSHIFT_PROJECT", HERE.parent / "c-impossible-ascent-redshift.json"))
out.write_text(json.dumps(proj, indent=2) + "\n")

# --- event map (combined-timeline seconds, extension seconds, both clocks) -----------------------------------------
SPB = F(60, BPM)
ORIGIN_T = (ORIGIN_BAR - 1) * BAR
def secs(abs_tick): return float(abs_tick * SPB / PPQ)
NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
ROOT = {"phrase": 76, "bass808": 33, "bass808-grit": 33, "kick": 33, "snare": 57, "glass": 73}
import math
def pitch(tid, rate):
    if tid not in ROOT: return f"rate {rate}"
    m = ROOT[tid] + 12 * math.log2(rate); k = round(m)
    return f"{NAMES[k % 12]}{k // 12 - 1}" + (f"{round((m - k) * 100):+d}c" if abs(m - k) > 0.005 else "")
def parse(s):
    b, rest = s.split(":"); bt, _, fr = rest.partition("+")
    t = (int(b) - 1) * BAR + (int(bt) - 1) * BEAT
    if fr: n, d = fr.split("/"); t += int(F(int(n), int(d)) * BAR)
    return t
def mixed(q):
    """2 -> '2', 7/3 -> '2+1/3' (a whole number plus a fraction, as positions are read)."""
    w = q.numerator // q.denominator; r = q - w
    return f"{w}" + (f"+{r.numerator}/{r.denominator}" if r else "")
events = []
for tr in proj["tracks"]:
    for n in tr["patterns"][0]["notes"]:
        rel = parse(n["start"]); a = ORIGIN_T + rel
        events.append({"seconds": round(secs(a), 6), "extensionSeconds": round(secs(a) - 28.0, 6), "tick": a,
                       "gate2Grid": f"bar {a // BAR + 1} beat {mixed(F(a % BAR, BEAT) + 1)}",
                       "worldGrid": f"W{rel // WBAR + 1} sixteenth {mixed(F(rel % WBAR, W16))}",
                       "track": tr["id"], "pitch": pitch(tr["id"], n.get("playbackRate", 1)), "velocity": n["velocity"],
                       "gate": n.get("gate"), "playbackRate": n.get("playbackRate", 1)})
events.sort(key=lambda e: (e["tick"], e["track"]))
sd = pathlib.Path(os.environ.get("REDSHIFT_SCORE_DIR", HERE / "score")); sd.mkdir(parents=True, exist_ok=True)
(sd / "redshift.events.json").write_text(json.dumps({"timeline": "combined (Gate 2 + REDSHIFT); extension starts at 28.0 s",
    "bpm": BPM, "ppq": PPQ, "worldBpm": 108, "redshiftRate": RS, "events": events}, indent=1) + "\n")
lines = ["| Combined s | Ext. s | Gate 2 grid (144) | World grid (108) | Track | Pitch / rate | Vel | Gate |", "|---:|---:|---|---|---|---|---:|---|"]
for e in events:
    lines.append(f"| {e['seconds']:.3f} | {e['extensionSeconds']:.3f} | {e['gate2Grid']} | {e['worldGrid']} | {e['track']} | {e['pitch']} | {e['velocity']} | {e['gate'] or '-'} |")
(sd / "redshift.events.md").write_text("# REDSHIFT - event map\n\nGenerated by `build_redshift.py`. Seconds are on the combined timeline "
    "(Gate 2's 28.0 s followed by the extension); `Ext. s` is time inside the standalone extension file.\n\n" + "\n".join(lines) + "\n")
print(f"wrote {out.name}: {len(events)} events, {sum(len(t['patterns'][0]['notes']) for t in proj['tracks'])} notes")
