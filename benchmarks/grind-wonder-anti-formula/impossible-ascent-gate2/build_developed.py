#!/usr/bin/env python3
"""Gate 2 development of C - IMPOSSIBLE ASCENT. Extends c-impossible-ascent.json (untouched):
its phrase patterns p1/p2/p3, wall, shadow and glide-breakthrough are reused verbatim in
Movement 1, ruptured in Movement 2, and transformed (not rewritten) in Movement 3.
144 BPM, 17 bars, rendered exactly 28.0 s. Sampler-only; final CRUSH mix is mix.ts."""
import json
from fractions import Fraction as F

def r(semi): return round(2 ** (semi / 12), 5)
def start(pos):
    pos = F(pos); bar = int(pos // 4) + 1; inbar = pos - (bar - 1) * 4; beat = int(inbar); off = (inbar - beat) / 4
    s = f"{bar}:{beat + 1}"
    if off: s += f"+{off.numerator}/{off.denominator}"
    return s
def gate(beats):
    g = F(beats) / 4; return f"{g.numerator}/{g.denominator}"
def n(pos, vel, rate=None, g=None, glide_to=None, glide_beats=None, off=None, end=None, choke=None):
    d = {"start": start(F(pos)), "velocity": vel}
    if rate is not None: d["playbackRate"] = rate
    if g is not None:
        d["gate"] = gate(F(g)); d["envelope"] = {"attackSeconds": 0.003, "releaseSeconds": 0.03}; d["chokeGroup"] = choke or "x"
    if glide_to is not None: d["glide"] = {"to": glide_to, "duration": gate(F(glide_beats))}
    if off is not None: d["offsetSeconds"] = off
    if end is not None: d["endSeconds"] = end
    return d
def pat(pid, bars, notes): return {"id": pid, "bars": bars, "notes": notes}
def track(tid, sample, patterns, clips):
    return {"id": tid, "instrument": {"type": "sampler", "sample": sample},
            "clips": [{"bar": b, "pattern": p} for b, p in clips], "patterns": patterns}

SIG = "assets/v12-signature/"; ORB = "assets/orbital-foundry/"; GLA = "assets/glasshouse/"
# NOTE: asset paths are relative to benchmarks/grind-wonder-anti-formula/ (parent) - see README.

# --- the original C phrase, verbatim (semitones from Phantom's E5 root) ---
p1 = [n(0,.8,r(0),1,choke="ph"), n(1,.78,r(2),1,choke="ph"), n(2,.82,r(5),1,choke="ph"), n(3,.85,r(7),F(3,4),choke="ph"), n(F(15,4),.7,r(2),F(1,4),choke="ph")]
p2 = [n(0,.82,r(0),F(1,2),choke="ph"), n(F(1,2),.8,r(2),F(1,2),choke="ph"), n(1,.8,r(1),F(1,4),choke="ph"), n(F(5,4),.84,r(5),F(1,2),choke="ph"), n(F(7,4),.86,r(7),F(1,2),choke="ph"), n(F(9,4),.88,r(9),F(1,2),choke="ph"), n(F(11,4),.75,r(5),F(3,4),choke="ph")]
p3 = [n(0,.85,r(0),F(1,4),choke="ph"), n(F(1,4),.83,r(2),F(1,4),choke="ph"), n(F(1,2),.83,r(5),F(1,4),choke="ph"), n(F(3,4),.87,r(7),F(1,4),choke="ph"), n(1,.87,r(9),F(1,4),choke="ph"), n(F(5,4),.9,r(11),F(1,4),choke="ph"), n(F(3,2),.92,r(12),1,glide_to=r(5),glide_beats=1,choke="ph")]
frag = [n(0,.75,r(0),F(1,2),choke="ph"), n(F(1,2),.7,r(2),F(1,4),choke="ph")]  # starts, then stops dead
rupt = [n(0,.72,r(-6),F(3,2),choke="ph"), n(F(3,2),.7,r(-4),F(1,2),choke="ph"), n(2,.74,r(-1),F(1,2),choke="ph"), n(F(5,2),.7,r(1),F(5,4),glide_to=r(-6),glide_beats=F(5,4),choke="ph")]  # motif dropped a tritone
t1 = [n(0,.88,r(0),F(3,2),choke="ph"), n(F(3,2),.85,r(2),1,choke="ph"), n(F(5,2),.88,r(5),F(3,2),choke="ph"), n(4,.9,r(7),F(3,2),choke="ph"), n(F(11,2),.88,r(9),1,choke="ph"), n(F(13,2),.92,r(12),F(3,2),choke="ph")]  # augmented, same contour
t2 = [n(0,.88,r(0),F(1,4),choke="ph"), n(F(1,4),.85,r(12),F(1,4),choke="ph"), n(F(1,2),.85,r(2),F(1,4),choke="ph"), n(F(3,4),.87,r(5),F(1,4),choke="ph"), n(1,.88,r(7),F(1,2),choke="ph"), n(F(3,2),.9,r(9),F(1,2),choke="ph"), n(2,.92,r(12),1,choke="ph"), n(3,.85,r(7),1,choke="ph")]  # compressed, octave pops, ends on B
t2b = [n(0,.85,r(12),F(3,2),choke="ph"), n(F(3,2),.82,r(9),1,choke="ph"), n(F(5,2),.85,r(7),F(3,2),choke="ph")]  # falls only to B: unresolved
glidebreak = [n(0,.9,r(0),2,glide_to=r(7),glide_beats=2,choke="ph"), n(2,.95,r(7),2,glide_to=r(12),glide_beats=2,choke="ph")]  # original breakthrough, kept
top = [n(0,.9,r(12),F(3,4),choke="ph")]

def bass808(pid, notes):  # (pos, semi-from-A1, gatebeats)
    return pat(pid, 2 if max(F(x[0]) for x in notes) >= 4 else 1,
               [n(p, .92, r(s), F(g), glide_to=(r(s-12) if i == len(notes)-1 and pid == "drop" else None), glide_beats=(F(g) if pid == "drop" else None), choke="b808") for i, (p, s, g) in enumerate(notes)])
b808a = [(0,-5,F(5,2)), (3,-5,F(1,2)), (F(7,2),7,F(1,4)), (4,2,1), (F(11,2),-5,F(1,2)), (F(25,4),-5,F(1,4)), (7,-5,F(3,4))]
b808b = [(0,-5,1), (F(3,2),-5,F(1,4)), (F(7,4),7,F(1,4)), (2,-5,F(3,2)), (4,2,1), (F(21,4),-5,F(1,4)), (F(11,2),-5,F(1,2)), (6,-5,F(5,4))]
b808c = [(0,-5,3), (4,-5,F(1,2)), (F(9,2),7,F(1,2)), (5,-5,F(5,2))]
fore  = [(0,-5,F(3,2)), (F(7,4),-5,F(1,2)), (F(7,2),-5,F(3,4))]
drop  = [(0,-5,F(13,10))]

proj = {"formatVersion": 1, "title": "C - IMPOSSIBLE ASCENT (Gate 2 development)",
 "description": "25-30s development of the Anti-Formula C sketch. M1 TRAPPED (bars 1-7): original attempts verbatim, darker. M2 SOMETHING BREAKS (8-10): tritone rupture, silence, dry 808. M3 BREAKTHROUGH (11-17): CRUSHed 808 trap (displaced, non-looping), transformed hook, original glide breakthrough.",
 "bpm": 144, "timeSignature": "4/4", "key": "E minor", "bars": 17, "seed": 34,
 "render": {"duration": {"seconds": 28.0}, "tail": "none"}, "master": {"gainDb": 0, "effects": []},
 "tracks": [
  track("phrase", SIG+"10-phantom.wav", [pat("p1",1,p1), pat("p2",1,p2), pat("p3",1,p3), pat("frag",1,frag), pat("rupt",1,rupt), pat("t1",2,t1), pat("t2",1,t2), pat("t2b",1,t2b), pat("glidebreak",1,glidebreak), pat("top",1,top)],
        [(1,"p1"),(3,"p2"),(5,"p3"),(7,"frag"),(8,"rupt"),(11,"t1"),(13,"t2"),(14,"t2b"),(15,"p1"),(16,"glidebreak"),(17,"top")]),
  track("shadow", SIG+"13-specter.wav", [pat("sh2",1,[n(0,.4,0.749,F(1,2),off=1.2,choke="sh"), n(1,.38,0.771,F(1,2),off=1.2,choke="sh"), n(2,.4,0.891,F(1,2),off=1.2,choke="sh")]),
        pat("shr",1,[n(0,.5,0.707,F(7,2),off=1.2,choke="sh")]), pat("sht",2,[n(0,.45,0.749,3,off=1.2,choke="sh"), n(4,.45,1.122,3,off=1.2,choke="sh")])],
        [(3,"sh2"),(8,"shr"),(11,"sht"),(13,"sht")]),
  track("chord", SIG+"12-afterglow.wav", [pat("ch",1,[n(0,.55,r(-5),3,choke="ch"), n(0,.5,r(2),3,choke="ch"), n(0,.5,r(7),3,choke="ch")])], [(11,"ch"),(13,"ch"),(15,"ch")]),
  track("wall", ORB+"06-low-boom.wav", [pat("w",1,[n(0,.95,0.5,3,choke="w")]), pat("w6",1,[n(0,.55,0.5,2,choke="w")]),
        pat("wr",1,[n(0,.95,0.5,1,glide_to=0.354,glide_beats=1,choke="w"), n(2,.85,0.42,1,choke="w")]), pat("wfall",1,[n(0,.9,0.5,F(13,10),glide_to=0.25,glide_beats=F(13,10),choke="w")])],
        [(2,"w"),(4,"w"),(6,"w6"),(8,"wr"),(17,"wfall")]),
  track("drone", SIG+"07-abyss.wav", [pat("de",1,[n(0,.5,r(-5),F(19,5),choke="dr")]), pat("deb",1,[n(0,.55,r(-6),F(19,5),choke="dr")]), pat("dshort",1,[n(0,.32,r(-5),F(3,2),choke="dr")])],
        [(1,"de"),(3,"de"),(5,"de"),(7,"de"),(8,"deb"),(11,"dshort"),(13,"dshort"),(15,"dshort")]),
  track("bass808", SIG+"07-abyss.wav", [bass808("fore",fore), bass808("b808a",b808a), bass808("b808b",b808b), bass808("b808c",b808c), bass808("drop",drop)], [(10,"fore"),(11,"b808a"),(13,"b808b"),(15,"b808c"),(17,"drop")]),
  track("bass808-grit", SIG+"08-reactor.wav", [bass808("fore",fore), bass808("b808a",b808a), bass808("b808b",b808b), bass808("b808c",b808c), bass808("drop",drop)], [(10,"fore"),(11,"b808a"),(13,"b808b"),(15,"b808c"),(17,"drop")]),
  track("kick", SIG+"01-sub-hammer.wav", [pat("kw",1,[n(0,.9,1,F(1,2),choke="k")]), pat("kr",1,[n(F(3,2),.9,1,F(1,2),choke="k")]), pat("kf",1,[n(0,.9,1,F(1,2),choke="k"), n(F(11,4),.85,1,F(1,2),choke="k")]),
        pat("ka",2,[n(0,.95,1,F(1,2),choke="k"), n(F(7,2),.9,1,F(1,2),choke="k"), n(F(17,4),.9,1,F(1,2),choke="k"), n(7,.85,1,F(1,2),choke="k")]),
        pat("kb",2,[n(0,.95,1,F(1,2),choke="k"), n(F(5,2),.9,1,F(1,2),choke="k"), n(F(15,4),.9,1,F(1,2),choke="k"), n(F(13,2),.85,1,F(1,2),choke="k")]),
        pat("kc",2,[n(0,.95,1,F(1,2),choke="k"), n(F(11,2),.9,1,F(1,2),choke="k")])],
        [(2,"kw"),(4,"kw"),(7,"kw"),(8,"kr"),(10,"kf"),(11,"ka"),(13,"kb"),(15,"kc"),(17,"kw")]),
  track("snare", SIG+"03-titanium-crack.wav", [pat("sr",1,[n(F(3,2),.9,1,F(1,4),choke="s")]),
        pat("sa",2,[n(2,.92,1,F(1,4),choke="s"), n(6,.9,1,F(1,4),choke="s"), n(F(27,4),.8,1,F(1,8),choke="s")]),
        pat("sb",2,[n(F(9,4),.92,1,F(1,4),choke="s"), n(F(11,2),.9,1,F(1,4),choke="s"), n(F(15,2),.85,1,F(1,4),choke="s")]),
        pat("sc",2,[n(2,.92,1,F(1,4),choke="s"), n(6,.9,1,F(1,4),choke="s")])],
        [(8,"sr"),(11,"sa"),(13,"sb"),(15,"sc")]),
  track("clap", SIG+"04-neon-clap.wav", [pat("sr",1,[n(F(3,2),.55,1,F(1,4),choke="s")]), pat("sa",2,[n(2,.55,1,F(1,4),choke="s"), n(6,.5,1,F(1,4),choke="s")]), pat("sb",2,[n(F(9,4),.55,1,F(1,4),choke="s"), n(F(11,2),.5,1,F(1,4),choke="s")]), pat("sc",2,[n(2,.55,1,F(1,4),choke="s"), n(6,.5,1,F(1,4),choke="s")])],
        [(8,"sr"),(11,"sa"),(13,"sb"),(15,"sc")]),
  track("hats", SIG+"05-ghost-tick.wav", [pat("ha",2,[n(F(1,2),.4), n(1,.35), n(F(3,2),.4), n(F(8,3),.5), n(3,.45), n(F(10,3),.5), n(F(9,2),.4), n(5,.35), n(F(20,3),.5), n(7,.55), n(F(22,3),.5), n(F(23,3),.55)]),
        pat("hb",2,[n(F(1,4),.45), n(F(1,2),.4), n(F(3,4),.45), n(2,.4), n(F(17,4),.5), n(F(9,2),.45), n(F(19,4),.5), n(5,.45), n(F(13,2),.4), n(7,.5)]),
        pat("hc",2,[n(F(1,2),.4), n(3,.35), n(F(9,2),.4), n(F(31,4),.55)])],
        [(11,"ha"),(13,"hb"),(15,"hc")]),
  track("ticks", ORB+"04-machine-tick.wav", [pat("tk",1,[n(F(1,3),.32,1.0), n(F(5,3),.26,1.2), n(F(7,3),.3,0.9), n(F(11,3),.22,1.4)]), pat("tk1",1,[n(F(15,4),.4,0.7)])],
        [(1,"tk"),(3,"tk"),(5,"tk"),(7,"tk"),(9,"tk1")]),
  track("glass", GLA+"01-glass-hit.wav", [pat("g9",1,[n(F(15,4),.35,r(3),F(1,2),choke="g")]), pat("g17",1,[n(2,.65,r(3),F(1,2),choke="g")])], [(9,"g9"),(17,"g17")]),
  track("clang", ORB+"03-metallic-strike.wav", [pat("cl",1,[n(F(1,4),.7,0.5,2,choke="c")])], [(8,"cl")]),
  track("flecks", SIG+"09-signal.wav", [pat("f",1,[n(F(3,4),.32,r(12),F(1,4),choke="f"), n(F(7,4),.3,r(14),F(1,4),choke="f"), n(F(13,4),.32,r(17),F(1,4),choke="f")])], [(3,"f"),(5,"f")]),
]}
import pathlib; _out = pathlib.Path(__file__).parent.parent / "c-impossible-ascent-gate2.json"
with open(_out, "w") as f: json.dump(proj, f, indent=2)
print("developed.json ok")
