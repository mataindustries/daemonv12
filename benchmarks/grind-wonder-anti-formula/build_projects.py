#!/usr/bin/env python3
"""GRIND Wonder Anti-Formula: three original 8-12s experiments (DaemonV12 sampler projects).
Sampler-only (no GM/FluidSynth). Pitch = playbackRate = 2^(semitones/12) from each sample's root.
Positions are written as BAR:BEAT+whole-note-fraction, gates as whole-note fractions."""
import json
from fractions import Fraction as F

def r(semi): return round(2 ** (semi / 12), 5)

def start(pos: F) -> str:
    """pos = beats from pattern start (0-based)."""
    bar = int(pos // 4) + 1
    inbar = pos - (bar - 1) * 4
    beat = int(inbar)
    off = (inbar - beat) / 4
    s = f"{bar}:{beat + 1}"
    if off: s += f"+{off.numerator}/{off.denominator}"
    return s

def gate(beats: F) -> str:
    g = F(beats) / 4
    return f"{g.numerator}/{g.denominator}"

def n(pos, vel, rate=None, g=None, glide_to=None, glide_beats=None, off=None, end=None, choke=None):
    d = {"start": start(F(pos)), "velocity": vel}
    if rate is not None: d["playbackRate"] = rate
    if g is not None:
        d["gate"] = gate(F(g)); d["envelope"] = {"attackSeconds": 0.003, "releaseSeconds": 0.03}; d["chokeGroup"] = choke or "x"
    if glide_to is not None: d["glide"] = {"to": glide_to, "duration": gate(F(glide_beats))}
    if off is not None: d["offsetSeconds"] = off
    if end is not None: d["endSeconds"] = end
    return d

def track(tid, sample, patterns, clips, gain=None, pan=None, fx=None):
    t = {"id": tid, "instrument": {"type": "sampler", "sample": sample},
         "clips": [{"bar": b, "pattern": p} for b, p in clips], "patterns": patterns}
    if gain is not None: t["mix"] = {"gainDb": gain, "pan": pan or 0}
    if fx: t["effects"] = fx
    return t

def pat(pid, bars, notes): return {"id": pid, "bars": bars, "notes": notes}
REV = [{"type": "reverb", "roomSize": 0.5, "decaySeconds": 1.6, "wet": 0.18}]
SAT = [{"type": "saturation", "driveDb": 6, "mix": 0.5}]

# ================= A - MACHINE FAILURE (132 BPM, 6 bars = 10.9s, rendered 10.4s, hard cut) ====
# Abyss root A1. A bass machine repeats a threat, detunes, skips inside its own sample,
# loses its kick, screams once, and dies descending - truncated mid-note by the render end.
A_bass_stable = [n(0, .95, r(0), 3), n(3, .9, r(0), F(1,2)), n(F(7,2), .85, r(12), F(1,2))]
A_bass_fault = [  # pitch sags a quarter-tone-ish (rates off-grid), source position jumps
    n(0, .95, 0.97, 2, choke="bass"), n(2, .9, 1.03, F(1,2), off=1.3, choke="bass"),
    n(F(5,2), .92, r(0), F(1,4), glide_to=0.82, glide_beats=F(1,2), off=2.7, choke="bass"),
    n(3, .8, r(-2), F(3,4), off=0.4, choke="bass")]
A_bass_collapse = [n(0, .9, r(-2), 1, choke="bass"), n(F(3,2), .8, r(-5), F(1,2), choke="bass"),
                   n(3, .85, r(-9), 6, glide_to=r(-17), glide_beats=4, choke="bass")]  # dies past render end
A = {"formatVersion": 1, "title": "A - MACHINE FAILURE (GRIND Anti-Formula)",
     "description": "Threatening bass machine losing control: stable ostinato, detune/source-skip faults, lost kick, one alarm, descending death truncated at 10.4s.",
     "bpm": 132, "timeSignature": "4/4", "key": "A minor", "bars": 6, "seed": 11,
     "render": {"duration": {"seconds": 10.4}, "tail": "none"}, "master": {"gainDb": -3, "effects": []},
     "tracks": [
        track("bass-machine", "assets/v12-signature/07-abyss.wav",
              [pat("stable", 1, A_bass_stable), pat("fault", 1, A_bass_fault), pat("collapse", 1, A_bass_collapse)],
              [(1, "stable"), (2, "stable"), (3, "fault"), (4, "fault"), (6, "collapse")], gain=-2, fx=SAT),
        track("reactor-grind", "assets/v12-signature/08-reactor.wav",
              [pat("grind", 1, [n(F(1,2), .5, r(0), F(1,4), choke="g"), n(F(3,2), .45, r(0), F(1,4), choke="g"), n(F(5,2), .5, r(7), F(1,4), choke="g")]),
               pat("grind-broken", 1, [n(F(1,3), .55, r(0), F(1,4), choke="g"), n(F(4,3), .5, r(-1), F(1,4), choke="g"), n(F(11,4), .6, r(0), F(1,8), glide_to=0.6, glide_beats=F(1,4), choke="g")])],
              [(2, "grind"), (3, "grind-broken"), (4, "grind-broken")], gain=-7, fx=SAT),
        track("kick", "assets/orbital-foundry/02-mechanical-kick.wav",
              [pat("four", 1, [n(0, .95), n(1, .9), n(2, .95), n(3, .9)]),
               pat("limp", 1, [n(0, .95), n(F(25,12), .9), n(F(7,2), .85)]),          # beat lands a triplet late, one kick missing
               pat("spasm", 1, [n(0, .95), n(F(1,8), .7, 1.3), n(F(19,8), .9), n(F(5,2), .75, 0.8)])],
              [(1, "four"), (2, "four"), (3, "limp"), (4, "spasm")], gain=-3),        # bars 5-6: no kick at all
        track("ticks", "assets/orbital-foundry/04-machine-tick.wav",
              [pat("t8", 1, [n(F(i,2), .45 + .05*(i % 2)) for i in range(8)]),
               pat("t-accel", 1, [n(F(i,3), .5) for i in range(6)] + [n(F(2)+F(i,4), .55) for i in range(8)]),
               pat("t-one", 1, [n(F(15,4), .6, 0.7)])],                               # after the failure: a single dying tick
              [(1, "t8"), (2, "t8"), (3, "t-accel"), (6, "t-one")], gain=-6, pan=-0.3),
        track("snare", "assets/orbital-foundry/05-industrial-snare.wav",
              [pat("s", 2, [n(F(9,4), .85), n(F(31,4), .95, 1.2)])],                  # only twice, never where expected
              [(2, "s")], gain=-4, pan=0.15),
        track("alarm", "assets/orbital-foundry/12-alarm-energy-pulse.wav",
              [pat("a", 1, [n(F(7,2), .7, 0.7, F(1,2), end=0.35, choke="al")]),
               pat("a2", 1, [n(F(1,2), .8, 1.41, F(1,4), end=0.2, choke="al")])],     # one low groan, one short scream after silence
              [(3, "a"), (5, "a2")], gain=-8, pan=0.3),
        track("clang", "assets/orbital-foundry/03-metallic-strike.wav",
              [pat("c", 1, [n(F(5,4), .65, 0.5, 2, choke="c")])], [(4, "c")], gain=-9, pan=-0.4, fx=REV),
        track("boom-floor", "assets/orbital-foundry/06-low-boom.wav",
              [pat("b", 1, [n(0, .8, 0.5, 3, choke="boom")])], [(5, "b")], gain=-5),  # bar 5: floor drops, kick gone
     ]}

# ================= B - DISPLACED GRAVITY (142 BPM, 6 bars = 10.1s, rendered 9.8s) ==============
# Hook (sub root C#): anticipates the downbeat from the previous beat's last eighth, stabs the
# flat-2, then dives a fifth-to-sub. It returns shifted +1/16, then -1/8 and truncated. Bar 4 is
# near-silence. Drums never land square: kick is late, snare is early, hats roll in triplets.
def hook(shift):
    s = F(shift)
    return [n(s+F(7,2), .95, r(0), F(1,2), choke="hook"),          # anticipation (prev beat, last 8th)
            n(s+4, .98, r(0), F(3,2), choke="hook"),               # the downbeat it promised, held
            n(s+F(23,4), .9, r(1), F(1,4), choke="hook"),          # flat-2 stab (D over C#)
            n(s+F(13,2), .95, r(7), F(3,4), glide_to=r(-5), glide_beats=F(3,4), choke="hook"),  # fifth dives below root
            n(s+F(31,4), .6, r(-2), F(1,8), choke="hook")]         # tiny aftershock
B = {"formatVersion": 1, "title": "B - DISPLACED GRAVITY (GRIND Anti-Formula)",
     "description": "Trap around displacement: an anticipating bass hook (root, flat-2 stab, fifth-to-sub dive) returns shifted +1/16 then -1/8 truncated; a near-silent bar; late kick, early snare.",
     "bpm": 142, "timeSignature": "4/4", "key": "C# minor", "bars": 6, "seed": 22,
     "render": {"duration": {"seconds": 9.8}, "tail": "none"}, "master": {"gainDb": 3, "effects": []},
     "tracks": [
        track("hook-sub", "assets/glasshouse/07-sub-cs.wav",
              [pat("h1", 2, hook(0)), pat("h2", 2, hook(F(1,4))[:3]), pat("dive", 1, [n(0, .95, r(7), F(3,4), glide_to=r(-5), glide_beats=F(3,4), choke="hook"), n(F(15,4), .6, r(-2), F(1,8), choke="hook")])],
              [(1, "h1"), (3, "h2"), (5, "dive")], gain=-3),
        track("hook-punch", "assets/glasshouse/06-bass-punch-cs.wav",
              [pat("p1", 2, hook(0)), pat("p2", 2, hook(F(1,4))[:3])], [(1, "p1"), (3, "p2")], gain=-9),
        track("kick-late", "assets/v12-signature/01-sub-hammer.wav",
              [pat("k", 2, [n(F(1,2), .95, 1, F(1,2), choke="k"), n(F(19,4), .9, 1, F(1,2), choke="k"), n(F(15,2), .85, 1, F(1,2), choke="k")]),
               pat("k2", 1, [n(F(1,4), .95, 1, F(1,2), choke="k"), n(F(11,4), .9, 1, F(1,2), choke="k")]), pat("k3", 1, [n(F(1,4), .95, 1, F(1,2), choke="k")])],
              [(1, "k"), (3, "k3"), (5, "k2")], gain=-4),
        track("snare-early", "assets/v12-signature/03-titanium-crack.wav",
              [pat("s", 2, [n(F(15,4), .9, 1, F(1,4), choke="s")]), pat("s2", 1, [n(F(31,16), .95, 1, F(1,4), choke="s")])],
              [(1, "s"), (3, "s"), (6, "s2")], gain=-6, pan=0.1),   # beat 3 pulled an eighth (then a 16th) early
        track("hats", "assets/v12-signature/05-ghost-tick.wav",
              [pat("hat", 2, [n(F(i,2), .4) for i in (1, 3, 6, 9, 12, 14)] + [n(F(13,3), .55), n(F(14,3), .5), n(F(5), .6)]),
               pat("hat-one", 1, [n(F(37,16), .5, 1.5)]), pat("hat3", 1, [n(F(1,2), .4), n(F(3,2), .4), n(F(8,3), .55), n(F(3), .5), n(F(10,3), .55)])],  # bar 4 silence: ONE hat, off-grid
              [(1, "hat"), (3, "hat3"), (4, "hat-one")], gain=-7, pan=-0.2),
        track("vox-whisper", "assets/glasshouse/04-ghost-vox.wav",
              [pat("v", 1, [n(F(5,2), .35, r(12), F(1,2), off=0.3, choke="v")])], [(4, "v")], gain=-12, pan=0.35, fx=REV),
        track("final-drop", "assets/glasshouse/03-glass-crush.wav",
              [pat("d", 1, [n(0, .9, r(0), 2, glide_to=r(-12), glide_beats=2, choke="d"),
                            n(F(15,4), .55, r(24), F(1,16), choke="d")])],  # last sound: one stray high tick after the drop
              [(6, "d")], gain=-6),
     ]}

# ================= C - IMPOSSIBLE ASCENT (96 BPM, 7 bars = 11.7s, rendered 11.2s) ===============
# Phantom root E5, Specter root A3. The phrase climbs E-F#-A-B and falls back three times; the
# wall (same low boom, same pitch) does not move. Attempts compress and strain (a flat-2 wrong
# note, a detuned double). Attempt 4 is one unbroken glide through the wall's pitch - then the
# wall itself is played, gliding DOWN, choked by an open E-B-F# chord. One glass E rings last.
C_phrase1 = [n(0, .8, r(0), 1, choke="ph"), n(1, .78, r(2), 1, choke="ph"), n(2, .82, r(5), 1, choke="ph"),
             n(3, .85, r(7), F(3,4), choke="ph"), n(F(15,4), .7, r(2), F(1,4), choke="ph")]  # climbs, falls back
C_phrase2 = [n(0, .82, r(0), F(1,2), choke="ph"), n(F(1,2), .8, r(2), F(1,2), choke="ph"), n(1, .8, r(1), F(1,4), choke="ph"),  # wrong note (F)
             n(F(5,4), .84, r(5), F(1,2), choke="ph"), n(F(7,4), .86, r(7), F(1,2), choke="ph"), n(F(9,4), .88, r(9), F(1,2), choke="ph"),
             n(F(11,4), .75, r(5), F(3,4), choke="ph")]
C_phrase3 = [n(0, .85, r(0), F(1,4), choke="ph"), n(F(1,4), .83, r(2), F(1,4), choke="ph"), n(F(1,2), .83, r(5), F(1,4), choke="ph"),
             n(F(3,4), .87, r(7), F(1,4), choke="ph"), n(1, .87, r(9), F(1,4), choke="ph"), n(F(5,4), .9, r(11), F(1,4), choke="ph"),
             n(F(3,2), .92, r(12), 1, glide_to=r(5), glide_beats=1, choke="ph")]  # reaches octave, dragged back down
C_break = [n(0, .9, r(0), 2, glide_to=r(7), glide_beats=2, choke="ph"),
           n(2, .95, r(7), 2, glide_to=r(12), glide_beats=2, choke="ph")]          # one unbroken climb E->B->E6
C = {"formatVersion": 1, "title": "C - IMPOSSIBLE ASCENT (GRIND Anti-Formula)",
     "description": "A phrase climbs and falls back three times against an unmoving low wall, compressing and straining; the fourth attempt glides unbroken through, the wall collapses downward, and an open chord + single glass note remain.",
     "bpm": 144, "timeSignature": "4/4", "key": "E minor", "bars": 7, "seed": 33,
     "render": {"duration": {"seconds": 11.8}, "tail": "none"}, "master": {"gainDb": 1, "effects": []},
     "tracks": [
        track("phrase", "assets/v12-signature/10-phantom.wav",
              [pat("p1", 1, C_phrase1), pat("p2", 1, C_phrase2), pat("p3", 1, C_phrase3), pat("p4", 1, C_break)],
              [(1, "p1"), (3, "p2"), (5, "p3"), (6, "p4")], gain=-4, fx=REV),
        track("phrase-shadow", "assets/v12-signature/13-specter.wav",  # joins from attempt 2, detuned: strain you can hear
              [pat("sh2", 1, [n(0, .4, 0.749, F(1,2), off=1.2, choke="sh"), n(1, .38, 0.771, F(1,2), off=1.2, choke="sh"), n(2, .4, 0.891, F(1,2), off=1.2, choke="sh")]),
               pat("sh4", 1, [n(0, .45, 0.749, 2, off=1.2, choke="sh"), n(2, .45, 1.122, 2, off=1.2, choke="sh")])],
              [(3, "sh2"), (6, "sh4")], gain=-8, pan=-0.15, fx=REV),
        track("signal-flecks", "assets/v12-signature/09-signal.wav",   # sparse high flecks, only while struggling
              [pat("f", 1, [n(F(3,4), .35, r(12), F(1,4), choke="f"), n(F(7,4), .33, r(14), F(1,4), choke="f"), n(F(13,4), .35, r(17), F(1,4), choke="f")])],
              [(3, "f"), (5, "f")], gain=-11, pan=0.3),
        track("wall", "assets/orbital-foundry/06-low-boom.wav",        # THE obstacle: identical every time...
              [pat("w", 1, [n(0, .95, 0.5, 3, choke="w")]),
               pat("w-fall", 1, [n(0, .95, 0.5, 2, glide_to=0.25, glide_beats=2, choke="w")])],  # ...until it falls
              [(2, "w"), (4, "w"), (7, "w-fall")], gain=-3),
        track("wall-kick", "assets/v12-signature/01-sub-hammer.wav",
              [pat("wk", 1, [n(0, .9, 1, F(1,2), choke="wk")])], [(2, "wk"), (4, "wk")], gain=-6),
        track("breakthrough-chord", "assets/v12-signature/12-afterglow.wav",  # E3+B3+E4 (from A3 root), chokes the falling wall by ear
              [pat("ch", 1, [n(0, .7, r(-5), 3, choke="ch"), n(0, .6, r(2), 3, choke="ch"), n(0, .6, r(7), 3, choke="ch")])],
              [(7, "ch")], gain=-6, pan=0.1, fx=REV),
        track("last-glass", "assets/glasshouse/01-glass-hit.wav",      # C#5 sample at +3 st = E: one note, left ringing
              [pat("g", 1, [n(F(7,2), .7, r(3), 1, choke="g")])], [(7, "g")], gain=-7, pan=-0.2, fx=REV),
     ]}

for name, proj in [("a-machine-failure", A), ("b-displaced-gravity", B), ("c-impossible-ascent", C)]:
    with open(f"{name}.json", "w") as f: json.dump(proj, f, indent=2)
    print(name, "ok")
