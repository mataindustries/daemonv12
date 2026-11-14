"""SOLECITO: NextCustomer original score (20 s, 105 BPM, D Dorian -> D major).

Writes assets/ (original instruments + bounced Living Bass) and solecito.json,
an ordinary DaemonV12 v0.7 project. Run from anywhere:

    python3 production/nextcustomer-solecito/compose.py
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from fractions import Fraction as F
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import instruments  # noqa: E402

BPM = 105
BARS = 9

# ---------------------------------------------------------------- helpers

def pos(bar: int, slot: float) -> str:
    """bar (1-based) + sixteenth slot (0-based, may be fractional) -> engine position."""
    beat = int(slot // 4)
    rem = F(slot).limit_denominator(64) - beat * 4
    s = f"{bar}:{beat + 1}"
    if rem:
        s += f"+{rem / 16}"
    return s


def frac(slots: float) -> str:
    f = F(slots).limit_denominator(64) / 16
    return f"{f.numerator}/{f.denominator}"


def note(bar, slot, name=None, vel=0.8, gate=None, attack=0.003, release=0.05, **extra):
    n = {"start": pos(bar, slot)}
    if name is not None:
        n["pitch"] = name
    n["velocity"] = round(vel, 3)
    if gate is not None:
        n["gate"] = frac(gate)
        n["envelope"] = {"attackSeconds": attack, "releaseSeconds": release}
    n.update(extra)
    return n


def nn(m: int) -> str:
    return f"note-{m}"


# Pitch-class sets per bar (for diatonic thirds under the hook)
DORIAN = {2, 4, 5, 7, 9, 11, 0}
HARM = {2, 4, 5, 7, 9, 10, 1}
MAJOR = {2, 4, 6, 7, 9, 11, 1}
SCALE = {1: DORIAN, 2: DORIAN, 3: DORIAN, 4: HARM, 8: MAJOR, 9: MAJOR}


def third_below(m: int, bar: int) -> int:
    sc = SCALE[bar]
    steps, x = 0, m
    while steps < 2:
        x -= 1
        if x % 12 in sc:
            steps += 1
    return x


# ---------------------------------------------------------------- the hook
# (bar, slot, length in sixteenths, midi, grace)
HOOK_A = [  # bar-relative slots; bar index 0 = Dm / 1 = G
    (0, 0, 3, 69, False), (0, 3, 3, 74, True), (0, 6, 2, 77, False), (0, 8, 2, 76, False),
    (0, 10, 2, 74, False), (0, 12, 3, 76, False), (0, 15, 1, 77, False),
    (1, 0, 3, 79, False), (1, 3, 1, 77, False), (1, 4, 2, 76, False), (1, 6, 2, 74, False),
    (1, 8, 4, 71, False), (1, 14, 1, 72, False), (1, 15, 1, 73, False),
]
HOOK_B = [  # Dm / A7: same opening, leap to A5, dominant answer ending on C#
    (0, 0, 3, 69, False), (0, 3, 3, 74, True), (0, 6, 2, 77, False), (0, 8, 2, 76, False),
    (0, 10, 2, 74, False), (0, 12, 4, 81, False),
    (1, 0, 3, 79, False), (1, 3, 3, 77, False), (1, 6, 2, 76, False), (1, 8, 6, 73, False),
]
PAYOFF = [  # D major: the hook brightened, then home
    (0, 0, 3, 69, False), (0, 3, 3, 74, True), (0, 6, 2, 78, False), (0, 8, 2, 76, False),
    (0, 10, 2, 74, False), (0, 12, 2, 71, False), (0, 14, 2, 73, False),
]

TRACKS: list[dict] = []
USED = {"accordion": set(), "whistle": set()}


def track(id_, desc, kit, notes, gain, pan=0.0, effects=None, automation=None):
    t = {
        "id": id_,
        "description": desc,
        "instrument": {"type": "drumkit", "kit": kit},
        "mix": {"gainDb": gain, "pan": pan},
        "patterns": [{"id": "take", "bars": BARS, "notes": sorted(notes, key=lambda n: (pos_key(n["start"]), n.get("pitch", "")))}],
        "clips": [{"bar": 1, "pattern": "take"}],
    }
    if effects:
        t["effects"] = effects
    if automation:
        t["automation"] = automation
    TRACKS.append(t)


def pos_key(p: str):
    bar, rest = p.split(":")
    beat, _, fr = rest.partition("+")
    return int(bar) * 64 + (int(beat) - 1) * 16 + (F(fr) * 16 if fr else 0)


def accordion_line(phrase, first_bar, vel=0.8, thirds=True, grace=True):
    out = []
    for b, s, d, m, g in phrase:
        bar = first_bar + b
        on = s
        if g and grace:
            out.append(note(bar, s, nn(m - 1), vel * 0.7, gate=0.5, release=0.01))
            USED["accordion"].add(m - 1)
            on = s + 0.5
            d = d - 0.5
        accent = 1.0 if s in (0, 6, 12) else 0.9
        out.append(note(bar, on, nn(m), vel * accent, gate=d - 0.25, release=0.06))
        USED["accordion"].add(m)
        if thirds:
            lo = 69 if m == 73 and bar in (1, 2, 3) else third_below(m, bar)
            out.append(note(bar, on, nn(lo), vel * accent * 0.82, gate=d - 0.25, release=0.06))
            USED["accordion"].add(lo)
    return out


# ---------------------------------------------------------------- accordion
radio = accordion_line(HOOK_A[:7], 1, vel=0.85)
main = accordion_line(HOOK_A[7:], 1, vel=0.85)  # bar 2 continues at full fidelity
main += accordion_line(HOOK_B, 3, vel=0.88)

# Build (bar 7): chromatic parallel-thirds climb into the break hit
climb = [(76, 73), (77, 74), (78, 75), (79, 76)]
for i, (hi, lo) in enumerate(climb):
    v = 0.7 + 0.07 * i
    main += [note(7, 8 + i, nn(hi), v, gate=0.75, release=0.02), note(7, 8 + i, nn(lo), v * 0.85, gate=0.75, release=0.02)]
    USED["accordion"].update([hi, lo])
for m in (73, 76, 79, 81):  # A7 hit
    main.append(note(7, 12, nn(m), 1.0, gate=1, release=0.08))
    USED["accordion"].add(m)

main += accordion_line(PAYOFF, 8, vel=0.82, thirds=True)
for m in (74, 78, 81):  # final D chord
    main.append(note(9, 0, nn(m), 0.95, gate=5, release=0.4))
    USED["accordion"].add(m)

# Offbeat comp: the cumbia "chucu"
CHORDS = {2: (67, 71, 74), 3: (65, 69, 74), 4: (64, 67, 73), 5: (65, 70, 74), 6: (67, 72, 76), 8: (66, 69, 74)}
comp = []
for bar, ch in CHORDS.items():
    slots = (6, 14) if bar in (2, 3, 4) else (2, 6, 10, 14)
    for s in slots:
        if bar == 8 and s >= 8:
            ch_now = (67, 71, 74)  # G over the second half of the payoff bar
        else:
            ch_now = ch
        v = 0.62 if s in (6, 14) else 0.5
        for m in ch_now:
            comp.append(note(bar, s, nn(m), v, gate=1, release=0.03))
            USED["accordion"].add(m)

# ---------------------------------------------------------------- whistle lead
lead = []


def lead_note(bar, slot, m, d, vel=0.85, slide_from=None, slide_len=1.0, release=0.12):
    n = note(bar, slot, nn(m), vel, gate=d, attack=0.004, release=release, chokeGroup="lead")
    if slide_from is not None:
        r = round(2 ** ((slide_from - m) / 12), 6)
        n["playbackRate"] = r
        n["glide"] = {"to": 1, "duration": frac(slide_len)}
    lead.append(n)
    USED["whistle"].add(m)


# B section: a call that climbs by step (F-D-F-G | G-E-G-A)
lead_note(5, 2, 77, 6, 0.85, slide_from=74, slide_len=1.5)
lead_note(5, 8, 74, 2, 0.72)
lead_note(5, 10, 77, 2, 0.78)
lead_note(5, 12, 79, 4, 0.85, slide_from=77, slide_len=1)
lead_note(6, 2, 79, 6, 0.85, slide_from=76, slide_len=1.5)
lead_note(6, 8, 76, 2, 0.72)
lead_note(6, 10, 79, 2, 0.78)
lead_note(6, 12, 81, 4, 0.9, slide_from=79, slide_len=1)
# Build: a Phrygian-dominant turn over the A pedal
lead_note(7, 0, 79, 2, 0.75)
lead_note(7, 2, 81, 2, 0.8)
lead_note(7, 4, 82, 2, 0.85)
lead_note(7, 6, 81, 2, 0.8, release=0.05)
# Payoff: the hook an octave up, in major
for b, s, d, m, g in PAYOFF:
    if g:
        lead_note(8 + b, s, m + 12, d, 0.92, slide_from=m + 10, slide_len=0.75)
    else:
        lead_note(8 + b, s, m + 12, d, 0.88 if s else 0.95)
lead_note(9, 0, 86, 6, 0.95, slide_from=85, slide_len=1, release=0.3)

# ---------------------------------------------------------------- brass (payoff only)
brass = [
    note(7, 12, "brass-a7", 0.9, gate=1, release=0.06),
    note(8, 0, "brass-d", 1.0, gate=3, release=0.08),
    note(8, 6, "brass-d", 0.85, gate=1.5, release=0.05),
    note(8, 8, "brass-g", 0.95, gate=3, release=0.08),
    note(8, 14, "brass-g", 0.8, gate=1, release=0.04),
    note(9, 0, "brass-d69", 1.0, gate=5, release=0.4),
]

# ---------------------------------------------------------------- percussion
kick, tarola, llam, congas, guiro, hand, fx = [], [], [], [], [], [], []
GROOVE_BARS = (2, 3, 4, 5, 6, 8)
for bar in GROOVE_BARS:
    kick += [note(bar, 0, "kick", 1.0), note(bar, 8, "kick", 0.92)]
    if bar in (3, 5, 8):
        kick.append(note(bar, 14, "kick", 0.5))
    tarola += [note(bar, 4, "tarola", 0.78), note(bar, 12, "tarola", 0.82)]
    if bar in (3, 5):
        tarola.append(note(bar, 7, "tarola-ghost", 0.3))
    for i, s in enumerate((2, 6, 10, 14)):
        llam.append(note(bar, s, "llamador-a" if i % 2 == 0 else "llamador-b", 0.72 if s in (6, 14) else 0.6))
    if bar >= 3:
        congas += [note(bar, 0, "conga-mute", 0.5), note(bar, 4, "conga-slap", 0.8), note(bar, 6, "conga-mute", 0.38),
                   note(bar, 8, "conga-mute", 0.45), note(bar, 12, "conga-open", 0.8)]
        congas.append(note(bar, 14, "tumba-open" if bar % 2 == 0 else "conga-open", 0.85 if bar % 2 == 0 else 0.7))
        if bar == 8:
            congas.append(note(bar, 10, "tumba-open", 0.75))
tarola += [note(4, 13, "tarola-ghost", 0.4), note(4, 14, "tarola-ghost", 0.55), note(4, 15, "tarola-ghost", 0.7)]
tarola += [note(6, 14, "tarola", 0.6), note(6, 15, "tarola", 0.75)]

# Guiro: long-short-short on every beat, the engine of the groove
for bar in (1, 2, 3, 4, 5, 6, 8):
    for beat in range(4):
        s = beat * 4
        accent = 1.0 if beat in (1, 3) else 0.85
        if bar == 1:
            accent *= 0.8
        guiro += [note(bar, s, "guiro-long-a" if beat % 2 == 0 else "guiro-long-b", 0.8 * accent),
                  note(bar, s + 2, "guiro-short-a" if beat % 2 == 0 else "guiro-short-c", 0.62 * accent),
                  note(bar, s + 3, "guiro-short-b", 0.7 * accent)]

# Build (bar 7): drums tighten into sixteenths, then one hit and a held breath
kick += [note(7, 0, "kick", 1.0), note(7, 4, "kick", 0.85), note(7, 8, "kick", 0.9), note(7, 12, "kick", 1.0)]
for i, s in enumerate((0, 2, 4, 6)):
    tarola.append(note(7, s, "tarola-ghost", 0.45 + 0.06 * i))
for i, s in enumerate((8, 9, 10, 11)):
    tarola.append(note(7, s, "tarola", 0.62 + 0.08 * i))
tarola.append(note(7, 12, "tarola", 1.0))
for i in range(12):
    guiro.append(note(7, i, "guiro-short-a" if i % 2 == 0 else "guiro-short-b", 0.45 + 0.04 * i))
congas += [note(7, 0, "tumba-open", 0.8), note(7, 4, "conga-slap", 0.75), note(7, 8, "conga-slap", 0.85), note(7, 10, "conga-slap", 0.9),
           note(7, 12, "conga-slap", 1.0)]
for bar in (5, 6, 7, 8):
    for s in range(16):
        if bar == 7 and s > 11:
            continue
        hand.append(note(bar, s, "shaker-accent" if s % 4 == 2 else "shaker", 0.55 if s % 4 == 2 else 0.35))
for s in (0, 4, 8, 12):
    hand.append(note(8, s, "campana", 0.85 if s in (0, 8) else 0.7))
hand.append(note(9, 0, "campana", 0.9))

# The button
kick.append(note(9, 0, "kick", 1.0))
tarola.append(note(9, 0, "tarola", 0.78))
guiro.append(note(9, 0, "guiro-long-a", 0.9))
congas.append(note(9, 0, "tumba-open", 0.72))

# FX
fx += [
    note(1, 0, "crackle", 0.8, gate=16, attack=0.05, release=0.25),
    note(2, 0, "crash-small", 0.55),
    note(7, 0, "riser", 0.75),
    note(8, 0, "crash", 0.9),
    note(8, 0, "sun-impact", 0.85),
    note(9, 0, "crash-small", 0.7),
]

# ---------------------------------------------------------------- tracks
REV_S = {"type": "reverb", "roomSize": 0.32, "decaySeconds": 0.8, "wet": 0.12}
track("kick", "Round tuned kick on 1 and 3 (cumbia boom).", "assets/perc/kit.json", kick, -11)
track("tarola", "Latin tarola backbeat, fills and the build roll.", "assets/perc/kit.json", tarola, -6.5, 0.05, [REV_S])
track("llamador", "Llamador: the offbeat answer drum.", "assets/perc/kit.json", llam, -9, -0.3)
track("congas", "Conga tumbao: mute, slap, open tones.", "assets/perc/kit.json", congas, -8.5, 0.3, [REV_S])
track("guiro", "Gourd guiro, long-short-short on every beat.", "assets/perc/kit.json", guiro, -4, 0.35)
track("hand", "Shaker (lift) and D/A campana (payoff).", "assets/perc/kit.json", hand, -12, -0.4, [REV_S])
track("bass", "DaemonV12 Living Bass, warm, cumbia tumbao (rack bounce, rate 1).", "assets/bass/kit.json",
      [{"start": "1:1", "pitch": "phrase-whole", "velocity": 1}], -1.5)
track("accordion-radio", "Bar 1 hook through a narrow 'sonidero radio' band.", "assets/accordion/kit.json", radio, -11, 0.1,
      [{"type": "highpass", "frequencyHz": 700}, {"type": "lowpass", "frequencyHz": 2600}, {"type": "saturation", "driveDb": 9, "mix": 0.55}])
track("accordion", "Musette accordion: hook in parallel thirds, build climb, payoff.", "assets/accordion/kit.json", main, -6, 0.12,
      [{"type": "lowpass", "frequencyHz": 6500}, {"type": "reverb", "roomSize": 0.38, "decaySeconds": 1.0, "wet": 0.14}])
track("accordion-comp", "Second accordion: offbeat chucu chords.", "assets/accordion/kit.json", comp, -10.5, -0.35,
      [{"type": "highpass", "frequencyHz": 260}, {"type": "lowpass", "frequencyHz": 6000}])
track("whistle", "G-funk whistle lead with slides: B-section call, payoff hook.", "assets/whistle/kit.json", lead, -13.5, -0.05,
      [{"type": "delay", "timeMs": 428.571, "wet": 0.2}, {"type": "reverb", "roomSize": 0.5, "decaySeconds": 1.5, "wet": 0.18}])
track("brass", "Synth brass: the break hit and the sunrise payoff.", "assets/brass/kit.json", brass, -6, 0.0,
      [{"type": "saturation", "driveDb": 4, "mix": 0.3}, {"type": "reverb", "roomSize": 0.45, "decaySeconds": 1.2, "wet": 0.16}])
track("fx", "Record crackle, crashes, build riser, D-tuned sun impact.", "assets/fx/kit.json", fx, -12)

PROJECT = {
    "formatVersion": 1,
    "title": "SOLECITO — NextCustomer original score",
    "description": "20-second cumbia-sonidera / East-LA soul fusion for the NextCustomer Short. D Dorian groove that brightens to D major at the payoff. Original synthesized accordion, whistle, brass and percussion; DaemonV12 Living Bass.",
    "bpm": BPM,
    "timeSignature": "4/4",
    "key": "D minor",
    "bars": BARS,
    "seed": 105,
    "render": {"duration": {"seconds": 20}, "tail": "none"},
    "master": {"gainDb": -1.3, "effects": [
        {"type": "compressor", "thresholdDb": -9, "ratio": 3, "attackMs": 6, "releaseMs": 110, "makeupGainDb": 2},
        {"type": "saturation", "driveDb": 2, "mix": 0.25},
    ]},
    "tracks": TRACKS,
}


def bounce_bass(assets: Path):
    dest = assets / "bass"
    if dest.exists():
        shutil.rmtree(dest)
    with tempfile.TemporaryDirectory() as tmp:
        pkg = Path(tmp) / "pkg"
        subprocess.run(["node", "studio-001/rack/cli.ts", "bounce", str(HERE / "score/bass.score.json"), str(pkg)],
                       cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
        shutil.copytree(pkg / "assets/bass", dest)
        shutil.copy(pkg / "performance.json", HERE / "score/bass.performance.json")


if __name__ == "__main__":
    assets = HERE / "assets"
    if "--score-only" not in sys.argv:
        instruments.build(assets, USED)
        bounce_bass(assets)
    (HERE / "solecito.json").write_text(json.dumps(PROJECT, indent=1, ensure_ascii=False) + "\n")
    print("tracks", len(TRACKS), "accordion notes", sorted(USED["accordion"]), "whistle", sorted(USED["whistle"]))
