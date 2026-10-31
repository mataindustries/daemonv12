"""ANGELES//2099: deterministic Blender scene generator (Blender 4.5 LTS).

Everything is procedural and seeded; the only inputs are the JSON specs in visual/specs and the cue
sheet in visual/sync. Runs as a Python module (`pip install bpy==4.5.14`) or inside Blender:

  python angeles2099.py --check [--cand crest]                   build + validate, no rendering
  python angeles2099.py --styleframe SF1 --res 540x960 --samples 96 --device CPU --out sf1.png
  python angeles2099.py --frames 0,170,330 --res 360x640 --samples 32 --device GPU --out-dir proof/
  python angeles2099.py --save-blend scene.blend
  blender -b -P angeles2099.py -- <same arguments>

No network, no downloads, no files written except the requested outputs.
"""
import argparse
import json
import math
import os
import random
import sys
import time

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector, noise

HERE = os.path.dirname(os.path.abspath(__file__))
PROD = os.path.dirname(HERE)
SPECS = os.path.join(PROD, "visual", "specs")
SYNC = os.path.join(PROD, "visual", "sync")
SEED = 2099


def load(name):
    with open(os.path.join(SPECS, name)) as f:
        return json.load(f)


PAL, CAR, WORLD, SHOTS = load("palette.json"), load("vehicle.json"), load("world.json"), load("shots.json")


def lin(hexcode, a=1.0):
    """sRGB hex -> linear RGBA (Blender colour sockets are linear)."""
    h = hexcode.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c) + (a,)


def P(name, a=1.0):
    return lin(PAL[name]["hex"], a)


def smooth(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


# ======================================================================================
# scene, render, colour
# ======================================================================================
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.render.engine = "CYCLES"
    sc.frame_start, sc.frame_end = 0, SHOTS["format"]["durationFrames"] - 1
    sc.render.fps = SHOTS["format"]["fps"]
    sc.view_settings.view_transform = "AgX"
    try:
        sc.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    cy = sc.cycles
    cy.seed = 0
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.02
    cy.max_bounces, cy.diffuse_bounces, cy.glossy_bounces, cy.transmission_bounces = 8, 3, 4, 6
    cy.caustics_reflective = cy.caustics_refractive = False
    cy.sample_clamp_indirect = 8.0
    cy.use_denoising = True
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_depth = "8"
    return sc


def set_device(sc, device):
    """CPU, or GPU with OptiX then CUDA. Returns a description; raises if GPU was demanded but absent."""
    if device == "CPU":
        sc.cycles.device = "CPU"
        return "CPU"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for backend in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = backend
            prefs.get_devices()
        except TypeError:
            continue
        gpus = [d for d in prefs.devices if d.type == backend]
        if gpus:
            for d in prefs.devices:
                d.use = d.type == backend
            sc.cycles.device = "GPU"
            return f"GPU {backend}: " + ", ".join(d.name for d in gpus)
    raise RuntimeError("GPU rendering requested but Cycles found no OptiX or CUDA device. "
                       "In Colab: Runtime > Change runtime type > T4 GPU, then rerun the GPU check cell.")


# ======================================================================================
# materials
# ======================================================================================
_haze_group = None


def haze_group():
    """Aerial perspective shared by every distant material: mix toward a haze emission by view
    distance. Its colour and distance are keyframed with the time of day (single source)."""
    global _haze_group
    if _haze_group:
        return _haze_group
    g = bpy.data.node_groups.new("AerialHaze", "ShaderNodeTree")
    g.interface.new_socket("Shader", in_out="INPUT", socket_type="NodeSocketShader")
    g.interface.new_socket("Shader", in_out="OUTPUT", socket_type="NodeSocketShader")
    n, l = g.nodes, g.links
    gi, go = n.new("NodeGroupInput"), n.new("NodeGroupOutput")
    cam = n.new("ShaderNodeCameraData")
    dist = n.new("ShaderNodeValue"); dist.name = "HazeDistance"; dist.outputs[0].default_value = 30000.0
    div = n.new("ShaderNodeMath"); div.operation = "DIVIDE"
    neg = n.new("ShaderNodeMath"); neg.operation = "MULTIPLY"; neg.inputs[1].default_value = -1.0
    ex = n.new("ShaderNodeMath"); ex.operation = "EXPONENT"
    inv = n.new("ShaderNodeMath"); inv.operation = "SUBTRACT"; inv.inputs[0].default_value = 1.0
    col = n.new("ShaderNodeRGB"); col.name = "HazeColor"; col.outputs[0].default_value = P("violetHaze")
    stren = n.new("ShaderNodeValue"); stren.name = "HazeStrength"; stren.outputs[0].default_value = 1.0
    em = n.new("ShaderNodeEmission")
    mix = n.new("ShaderNodeMixShader")
    l.new(cam.outputs["View Distance"], div.inputs[0]); l.new(dist.outputs[0], div.inputs[1])
    l.new(div.outputs[0], neg.inputs[0]); l.new(neg.outputs[0], ex.inputs[0]); l.new(ex.outputs[0], inv.inputs[1])
    l.new(col.outputs[0], em.inputs["Color"]); l.new(stren.outputs[0], em.inputs["Strength"])
    l.new(inv.outputs[0], mix.inputs[0]); l.new(gi.outputs[0], mix.inputs[1]); l.new(em.outputs[0], mix.inputs[2])
    l.new(mix.outputs[0], go.inputs[0])
    _haze_group = g
    return g


def material(name, haze=False, **p):
    """Principled material. p: base, metallic, rough, coat, emission, emission_strength, transmission, ior."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    out = nt.nodes["Material Output"]
    bsdf.inputs["Base Color"].default_value = p.get("base", (0.5, 0.5, 0.5, 1))
    bsdf.inputs["Metallic"].default_value = p.get("metallic", 0.0)
    bsdf.inputs["Roughness"].default_value = p.get("rough", 0.5)
    if "coat" in p:
        bsdf.inputs["Coat Weight"].default_value = p["coat"]
        bsdf.inputs["Coat Roughness"].default_value = p.get("coat_rough", 0.03)
    if "emission" in p:
        bsdf.inputs["Emission Color"].default_value = p["emission"]
        bsdf.inputs["Emission Strength"].default_value = p.get("emission_strength", 1.0)
    if "transmission" in p:
        bsdf.inputs["Transmission Weight"].default_value = p["transmission"]
        bsdf.inputs["IOR"].default_value = p.get("ior", 1.45)
    if haze:
        add_haze(m)
    return m


def add_haze(m):
    nt = m.node_tree
    out = nt.nodes["Material Output"]
    src = out.inputs["Surface"].links[0].from_socket
    grp = nt.nodes.new("ShaderNodeGroup"); grp.node_tree = haze_group()
    nt.links.new(src, grp.inputs[0]); nt.links.new(grp.outputs[0], out.inputs["Surface"])


def emission_material(name, color, strength, haze=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = color
    em.inputs["Strength"].default_value = strength
    nt.links.new(em.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    if haze:
        add_haze(m)
    return m


def candy_paint():
    m = material("CandyBurgundy", base=P("candyBurgundy"), metallic=0.3, rough=0.3, coat=1.0, coat_rough=0.02)
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    # metallic flake: a fine noise varies the base between burgundy and its flash colour
    tex = nt.nodes.new("ShaderNodeTexNoise"); tex.inputs["Scale"].default_value = 900.0; tex.inputs["Detail"].default_value = 1.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = P("candyBurgundy"); ramp.color_ramp.elements[1].color = P("candyBurgundyFlash")
    ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[1].position = 0.45, 0.75
    nt.links.new(tex.outputs["Fac"], ramp.inputs[0]); nt.links.new(ramp.outputs[0], bsdf.inputs["Base Color"])
    return m


def build_materials():
    M = {}
    M["paint"] = candy_paint()
    M["chrome"] = material("Chrome", base=P("chrome"), metallic=1.0, rough=0.045)
    M["gold"] = material("Gold", base=P("warmGold"), metallic=1.0, rough=0.16)
    M["glass"] = material("SmokedGlass", base=lin("#3A2E55"), rough=0.02, transmission=1.0, ior=1.45)
    M["interior"] = material("Oxblood", base=lin("#2A0A10"), rough=0.6)
    M["under"] = material("Undercarriage", base=lin("#141218"), metallic=0.6, rough=0.4)
    M["hover"] = emission_material("HoverField", P("hoverViolet"), 1.2)
    M["hovercore"] = emission_material("HoverCore", P("warmGold"), 2.0)
    M["headlight"] = emission_material("Headlight", lin("#FFE9CC"), 25.0)
    M["taillight"] = emission_material("Taillight", lin("#FF5A2A"), 14.0)
    M["grille"] = emission_material("GrilleGlow", P("hoverViolet"), 3.0)
    M["reflector"] = emission_material("Reflector", P("warmGold"), 4.0)
    M["steel"] = material("Guardrail", base=lin("#9A98A0"), metallic=0.9, rough=0.35)
    M["road"] = road_material()
    M["rock"] = rock_material()
    M["basin"] = basin_material()
    M["tower"] = tower_material()
    M["blimp"] = blimp_material()
    M["traffic"] = emission_material("FlyingTraffic", P("windowWarm"), 40.0, haze=True)
    M["crown"] = emission_material("CrownHalo", P("warmGold"), 30.0, haze=True)
    return M


def road_material():
    """Asphalt with the double yellow and white edge lines, from the road mesh's UV (u across, v along)."""
    m = material("Road", base=P("asphalt"), rough=0.78)
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    uv = nt.nodes.new("ShaderNodeUVMap")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(uv.outputs[0], sep.inputs[0])

    def band(lo, hi):
        a = nt.nodes.new("ShaderNodeMath"); a.operation = "GREATER_THAN"; a.inputs[1].default_value = lo
        b = nt.nodes.new("ShaderNodeMath"); b.operation = "LESS_THAN"; b.inputs[1].default_value = hi
        mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
        nt.links.new(sep.outputs["X"], a.inputs[0]); nt.links.new(sep.outputs["X"], b.inputs[0])
        nt.links.new(a.outputs[0], mul.inputs[0]); nt.links.new(b.outputs[0], mul.inputs[1])
        return mul.outputs[0]
    # road u: 0..1 across 8.6 m (two 3.7 m lanes + 0.6 m shoulders); lines 0.12 m wide
    W = 8.6
    yellow1, yellow2 = band(0.5 - 0.17 / W, 0.5 - 0.05 / W), band(0.5 + 0.05 / W, 0.5 + 0.17 / W)
    white1, white2 = band(0.6 / W, 0.72 / W), band(1 - 0.72 / W, 1 - 0.6 / W)
    addy = nt.nodes.new("ShaderNodeMath"); addy.operation = "ADD"
    nt.links.new(yellow1, addy.inputs[0]); nt.links.new(yellow2, addy.inputs[1])
    addw = nt.nodes.new("ShaderNodeMath"); addw.operation = "ADD"
    nt.links.new(white1, addw.inputs[0]); nt.links.new(white2, addw.inputs[1])
    tex = nt.nodes.new("ShaderNodeTexNoise"); tex.inputs["Scale"].default_value = 60.0
    grain = nt.nodes.new("ShaderNodeMix"); grain.data_type = "RGBA"
    grain.inputs[6].default_value = P("asphalt"); grain.inputs[7].default_value = lin("#3A3840")
    nt.links.new(tex.outputs["Fac"], grain.inputs[0])
    my = nt.nodes.new("ShaderNodeMix"); my.data_type = "RGBA"; my.inputs[7].default_value = P("laneYellow")
    nt.links.new(addy.outputs[0], my.inputs[0]); nt.links.new(grain.outputs[2], my.inputs[6])
    mw = nt.nodes.new("ShaderNodeMix"); mw.data_type = "RGBA"; mw.inputs[7].default_value = P("laneWhite")
    nt.links.new(addw.outputs[0], mw.inputs[0]); nt.links.new(my.outputs[2], mw.inputs[6])
    nt.links.new(mw.outputs[2], bsdf.inputs["Base Color"])
    return m


def rock_material():
    """San Gabriel granite: two-tone noise, violet-biased shadows, dry olive on gentle slopes."""
    m = material("Granite", base=P("granite"), rough=0.85, haze=False)
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    tex = nt.nodes.new("ShaderNodeTexNoise"); tex.inputs["Scale"].default_value = 0.35; tex.inputs["Detail"].default_value = 10.0
    tex.inputs["Roughness"].default_value = 0.65
    nt.links.new(tc.outputs["Object"], tex.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = P("graniteShadow"); ramp.color_ramp.elements[1].color = P("granite")
    nt.links.new(tex.outputs["Fac"], ramp.inputs[0])
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sepn = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(geo.outputs["Normal"], sepn.inputs[0])
    flat = nt.nodes.new("ShaderNodeMapRange")
    flat.inputs["From Min"].default_value, flat.inputs["From Max"].default_value = 0.75, 0.92
    nt.links.new(sepn.outputs["Z"], flat.inputs["Value"])
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.inputs[7].default_value = lin("#5B5A3C")
    nt.links.new(flat.outputs[0], mix.inputs[0]); nt.links.new(ramp.outputs[0], mix.inputs[6])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.85
    tex2 = nt.nodes.new("ShaderNodeTexNoise"); tex2.inputs["Scale"].default_value = 1.8; tex2.inputs["Detail"].default_value = 8.0
    nt.links.new(tc.outputs["Object"], tex2.inputs["Vector"]); nt.links.new(tex2.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], bsdf.inputs["Normal"])
    add_haze(m)
    return m


def basin_material():
    """The LA grid at night: dark ground, sodium street lines every 400 m (boulevards every 4th),
    and a sparkle of homes. Emission strength is keyframed with the time of day (node 'CityNight')."""
    m = bpy.data.materials.new("BasinGrid")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    out = nt.nodes["Material Output"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Object"], sep.inputs[0])
    sp = WORLD["city"]["grid"]["spacing"]

    def lines(axis, spacing, width):
        d = nt.nodes.new("ShaderNodeMath"); d.operation = "DIVIDE"; d.inputs[1].default_value = spacing
        f = nt.nodes.new("ShaderNodeMath"); f.operation = "PINGPONG"; f.inputs[1].default_value = 0.5
        lt = nt.nodes.new("ShaderNodeMath"); lt.operation = "LESS_THAN"; lt.inputs[1].default_value = width / spacing
        nt.links.new(sep.outputs[axis], d.inputs[0]); nt.links.new(d.outputs[0], f.inputs[0]); nt.links.new(f.outputs[0], lt.inputs[0])
        return lt.outputs[0]
    streets = nt.nodes.new("ShaderNodeMath"); streets.operation = "MAXIMUM"
    nt.links.new(lines("X", sp, 3.0), streets.inputs[0]); nt.links.new(lines("Y", sp, 3.0), streets.inputs[1])
    blvd = nt.nodes.new("ShaderNodeMath"); blvd.operation = "MAXIMUM"
    nt.links.new(lines("X", sp * 4, 7.0), blvd.inputs[0]); nt.links.new(lines("Y", sp * 4, 7.0), blvd.inputs[1])
    # neighbourhoods: a large-scale noise dims whole districts so the grid breathes like a real city
    dist = nt.nodes.new("ShaderNodeTexNoise"); dist.inputs["Scale"].default_value = 1 / 2500.0; dist.inputs["Detail"].default_value = 4.0
    nt.links.new(tc.outputs["Object"], dist.inputs["Vector"])
    dmr = nt.nodes.new("ShaderNodeMapRange"); dmr.inputs["From Min"].default_value, dmr.inputs["From Max"].default_value = 0.35, 0.7
    dmr.inputs["To Min"].default_value = 0.15
    nt.links.new(dist.outputs["Fac"], dmr.inputs["Value"])
    sd = nt.nodes.new("ShaderNodeMath"); sd.operation = "MULTIPLY"
    nt.links.new(streets.outputs[0], sd.inputs[0]); nt.links.new(dmr.outputs[0], sd.inputs[1])
    streets = sd
    vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 1 / 60.0
    nt.links.new(tc.outputs["Object"], vor.inputs["Vector"])
    homes = nt.nodes.new("ShaderNodeMath"); homes.operation = "LESS_THAN"; homes.inputs[1].default_value = 0.045
    nt.links.new(vor.outputs["Distance"], homes.inputs[0])
    hw = nt.nodes.new("ShaderNodeMath"); hw.operation = "MULTIPLY"; hw.inputs[1].default_value = 0.12
    nt.links.new(homes.outputs[0], hw.inputs[0])
    sw = nt.nodes.new("ShaderNodeMath"); sw.operation = "MULTIPLY"; sw.inputs[1].default_value = 0.55
    nt.links.new(streets.outputs[0], sw.inputs[0])
    bw = nt.nodes.new("ShaderNodeMath"); bw.operation = "MULTIPLY"; bw.inputs[1].default_value = 1.4
    nt.links.new(blvd.outputs[0], bw.inputs[0])
    a1 = nt.nodes.new("ShaderNodeMath"); a1.operation = "MAXIMUM"; nt.links.new(sw.outputs[0], a1.inputs[0]); nt.links.new(bw.outputs[0], a1.inputs[1])
    a2 = nt.nodes.new("ShaderNodeMath"); a2.operation = "MAXIMUM"; nt.links.new(a1.outputs[0], a2.inputs[0]); nt.links.new(hw.outputs[0], a2.inputs[1])
    night = nt.nodes.new("ShaderNodeValue"); night.name = "CityNight"; night.outputs[0].default_value = 1.0
    strength = nt.nodes.new("ShaderNodeMath"); strength.operation = "MULTIPLY"
    nt.links.new(a2.outputs[0], strength.inputs[0]); nt.links.new(night.outputs[0], strength.inputs[1])
    scale = nt.nodes.new("ShaderNodeMath"); scale.operation = "MULTIPLY"; scale.inputs[1].default_value = 9.0
    nt.links.new(strength.outputs[0], scale.inputs[0])
    em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = P("sodiumGrid")
    nt.links.new(scale.outputs[0], em.inputs["Strength"])
    ground = nt.nodes.new("ShaderNodeBsdfDiffuse"); ground.inputs["Color"].default_value = lin("#2A2430")
    add = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(ground.outputs[0], add.inputs[0]); nt.links.new(em.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], out.inputs["Surface"])
    add_haze(m)
    return m


def tower_material():
    """Megatower glass with lit windows: 4 m x 4 m cells on world (x+y, z); about half lit, one in
    four of those cool violet-white. Window glow is keyframed with the time of day ('CityNight')."""
    m = material("TowerGlass", base=P("towerGlass"), metallic=0.85, rough=0.1)
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Object"], sep.inputs[0])
    xy = nt.nodes.new("ShaderNodeMath"); xy.operation = "ADD"; nt.links.new(sep.outputs["X"], xy.inputs[0]); nt.links.new(sep.outputs["Y"], xy.inputs[1])
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    du = nt.nodes.new("ShaderNodeMath"); du.operation = "DIVIDE"; du.inputs[1].default_value = 4.0
    dv = nt.nodes.new("ShaderNodeMath"); dv.operation = "DIVIDE"; dv.inputs[1].default_value = 4.2
    nt.links.new(xy.outputs[0], du.inputs[0]); nt.links.new(sep.outputs["Z"], dv.inputs[0])
    fu = nt.nodes.new("ShaderNodeMath"); fu.operation = "FLOOR"; fv = nt.nodes.new("ShaderNodeMath"); fv.operation = "FLOOR"
    nt.links.new(du.outputs[0], fu.inputs[0]); nt.links.new(dv.outputs[0], fv.inputs[0])
    nt.links.new(fu.outputs[0], comb.inputs[0]); nt.links.new(fv.outputs[0], comb.inputs[1])
    wn = nt.nodes.new("ShaderNodeTexWhiteNoise"); wn.noise_dimensions = "3D"; nt.links.new(comb.outputs[0], wn.inputs["Vector"])
    lit = nt.nodes.new("ShaderNodeMath"); lit.operation = "GREATER_THAN"; lit.inputs[1].default_value = 0.62
    nt.links.new(wn.outputs["Value"], lit.inputs[0])
    # window frame: fractional part inside the cell
    fru = nt.nodes.new("ShaderNodeMath"); fru.operation = "FRACT"; nt.links.new(du.outputs[0], fru.inputs[0])
    frv = nt.nodes.new("ShaderNodeMath"); frv.operation = "FRACT"; nt.links.new(dv.outputs[0], frv.inputs[0])
    iu = nt.nodes.new("ShaderNodeMath"); iu.operation = "LESS_THAN"; iu.inputs[1].default_value = 0.78; nt.links.new(fru.outputs[0], iu.inputs[0])
    iv = nt.nodes.new("ShaderNodeMath"); iv.operation = "LESS_THAN"; iv.inputs[1].default_value = 0.62; nt.links.new(frv.outputs[0], iv.inputs[0])
    win = nt.nodes.new("ShaderNodeMath"); win.operation = "MULTIPLY"; nt.links.new(iu.outputs[0], win.inputs[0]); nt.links.new(iv.outputs[0], win.inputs[1])
    on = nt.nodes.new("ShaderNodeMath"); on.operation = "MULTIPLY"; nt.links.new(win.outputs[0], on.inputs[0]); nt.links.new(lit.outputs[0], on.inputs[1])
    cool = nt.nodes.new("ShaderNodeMath"); cool.operation = "GREATER_THAN"; cool.inputs[1].default_value = 0.88
    nt.links.new(wn.outputs["Value"], cool.inputs[0])
    colmix = nt.nodes.new("ShaderNodeMix"); colmix.data_type = "RGBA"
    colmix.inputs[6].default_value = P("windowWarm"); colmix.inputs[7].default_value = P("windowCool")
    nt.links.new(cool.outputs[0], colmix.inputs[0])
    night = nt.nodes.new("ShaderNodeValue"); night.name = "CityNight"; night.outputs[0].default_value = 1.0
    st = nt.nodes.new("ShaderNodeMath"); st.operation = "MULTIPLY"; nt.links.new(on.outputs[0], st.inputs[0]); nt.links.new(night.outputs[0], st.inputs[1])
    # 9.0 read as white ghosts at 14 km; the towers should be dark glass with a sparkle of windows
    st2 = nt.nodes.new("ShaderNodeMath"); st2.operation = "MULTIPLY"; st2.inputs[1].default_value = 1.4; nt.links.new(st.outputs[0], st2.inputs[0])
    nt.links.new(colmix.outputs[2], bsdf.inputs["Emission Color"]); nt.links.new(st2.outputs[0], bsdf.inputs["Emission Strength"])
    add_haze(m)
    return m


def blimp_material():
    """Pearl skin with warm gold bands and soft band lights (no screens, no text)."""
    m = material("BlimpSkin", base=lin("#E9E3EE"), metallic=0.2, rough=0.35)
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    wave = nt.nodes.new("ShaderNodeTexWave"); wave.wave_type = "BANDS"; wave.bands_direction = "X"
    wave.inputs["Scale"].default_value = 0.6; wave.inputs["Distortion"].default_value = 0.0
    nt.links.new(tc.outputs["Generated"], wave.inputs["Vector"])
    band = nt.nodes.new("ShaderNodeMath"); band.operation = "GREATER_THAN"; band.inputs[1].default_value = 0.93
    nt.links.new(wave.outputs["Fac"], band.inputs[0])
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
    mix.inputs[6].default_value = lin("#E9E3EE"); mix.inputs[7].default_value = P("warmGold")
    nt.links.new(band.outputs[0], mix.inputs[0]); nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    em = nt.nodes.new("ShaderNodeMath"); em.operation = "MULTIPLY"; em.inputs[1].default_value = 6.0
    nt.links.new(band.outputs[0], em.inputs[0])
    bsdf.inputs["Emission Color"].default_value = P("warmGold")
    nt.links.new(em.outputs[0], bsdf.inputs["Emission Strength"])
    add_haze(m)
    return m


# ======================================================================================
# geometry helpers
# ======================================================================================
def mesh_object(name, verts, faces, mat=None, smooth_shade=False, uvs=None, parent=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    if uvs is not None:
        uvl = me.uv_layers.new(name="UVMap")
        for poly in me.polygons:
            for li in poly.loop_indices:
                uvl.data[li].uv = uvs[me.loops[li].vertex_index]
    me.validate()
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    if mat:
        me.materials.append(mat)
    if smooth_shade:
        for p in me.polygons:
            p.use_smooth = True
    if parent:
        ob.parent = parent
    return ob


def empty(name, parent=None, loc=(0, 0, 0)):
    ob = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    if parent:
        ob.parent = parent
    return ob


def tube_curve(name, pts, radius, mat, parent=None, closed=False):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth, cu.bevel_resolution, cu.fill_mode = radius, 3, "FULL"
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p, c in zip(sp.points, pts):
        p.co = (c[0], c[1], c[2], 1.0)
    sp.use_cyclic_u = closed
    ob = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(ob)
    cu.materials.append(mat)
    if parent:
        ob.parent = parent
    return ob


def add_subsurf(ob, levels=2):
    mod = ob.modifiers.new("Subsurf", "SUBSURF")
    mod.levels = mod.render_levels = levels
    return mod


def box(name, size, loc, mat, parent=None, bevel=0.0):
    sx, sy, sz = [s / 2 for s in size]
    v = [(-sx, -sy, -sz), (sx, -sy, -sz), (sx, sy, -sz), (-sx, sy, -sz), (-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    ob = mesh_object(name, v, f, mat, parent=parent)
    ob.location = loc
    if bevel:
        m = ob.modifiers.new("Bevel", "BEVEL"); m.width = bevel; m.segments = 3
    return ob


# ======================================================================================
# the hero vehicle: CRESTLINE
# ======================================================================================
def body_profile(u):
    b = CAR["body"]
    W = b["width"] / 2
    w = W * (0.84 + 0.16 * smooth(u / 0.08)) * (0.90 + 0.10 * smooth((1 - u) / 0.06))
    if u > b["finFlare"]["fromU"]:
        w += b["finFlare"]["widthGain"] * smooth((u - b["finFlare"]["fromU"]) / 0.1)
    top = b["hoodZ"] + (b["beltlineZ"] - b["hoodZ"]) * smooth((u - 0.05) / 0.32)
    top -= 0.10 * (1 - smooth(u / 0.035)) + 0.06 * (1 - smooth((1 - u) / 0.03))
    bot = b["rockerZ"] + 0.10 * (1 - smooth(u / 0.07)) + 0.09 * (1 - smooth((1 - u) / 0.07))
    return w, top, bot


def section(w, top, bot, n, u, p=None, tumble=None, fin=0.0):
    b = CAR["body"]
    p = p or b["sectionExponent"]
    tumble = b["tumblehome"] if tumble is None else tumble
    zc, hz = (top + bot) / 2, (top - bot) / 2
    pts = []
    for k in range(n):
        th = 2 * math.pi * k / n
        c, s = math.cos(th), math.sin(th)
        y = w * math.copysign(abs(c) ** (2 / p), c)
        z = zc + hz * math.copysign(abs(s) ** (2 / p), s)
        h = (z - bot) / max(1e-6, top - bot)
        y *= 1 - tumble * h * h
        y *= 1 + 0.022 * math.exp(-((z - 0.62) / 0.06) ** 2)                 # the 60s side crease
        if fin and h > 0.7:
            z += fin * (abs(y) / w) ** 8                                       # rear fins rise at the corners
        pts.append((y, z))
    return pts


def loft(name, rings_xyz, mat, parent, cap=True):
    nu, nv = len(rings_xyz), len(rings_xyz[0])
    verts = [p for ring in rings_xyz for p in ring]
    faces = [(i * nv + j, i * nv + (j + 1) % nv, (i + 1) * nv + (j + 1) % nv, (i + 1) * nv + j) for i in range(nu - 1) for j in range(nv)]
    if cap:
        c0 = len(verts); verts.append(tuple(np.mean(rings_xyz[0], axis=0)))
        c1 = len(verts); verts.append(tuple(np.mean(rings_xyz[-1], axis=0)))
        faces += [(c0, (j + 1) % nv, j) for j in range(nv)]
        faces += [(c1, (nu - 1) * nv + j, (nu - 1) * nv + (j + 1) % nv) for j in range(nv)]
    ob = mesh_object(name, verts, faces, mat, smooth_shade=True, parent=parent)
    add_subsurf(ob, 2)
    return ob


def build_vehicle(M):
    b, g, wh, hv = CAR["body"], CAR["greenhouse"], CAR["wheels"], CAR["hover"]
    L = b["length"]
    root = empty("CRESTLINE")                       # follows the road (location, heading, drift)
    chassis = empty("Chassis", parent=root)          # suspension: lift, pitch, roll
    NU, NV = 56, 36
    rings = []
    for i in range(NU):
        u = i / (NU - 1)
        x = L / 2 - u * L
        w, top, bot = body_profile(u)
        fin = b["finFlare"]["zGain"] * smooth((u - b["finFlare"]["fromU"]) / 0.12)
        rings.append([(x, y, z) for y, z in section(w, top, bot, NV, u, fin=fin)])
    body = loft("Body", rings, M["paint"], chassis)
    # greenhouse: pillarless hardtop, glass sides, painted roof cap
    gr = []
    NG = 26
    for i in range(NG):
        v = i / (NG - 1)
        u = g["fromU"] + v * (g["toU"] - g["fromU"])
        x = L / 2 - u * L
        rise = smooth(v / (g["windshieldRunU"] / (g["toU"] - g["fromU"]))) * smooth((1 - v) / (g["backlightRunU"] / (g["toU"] - g["fromU"])))
        w0 = body_profile(u)[0] * (1 - b["tumblehome"]) - 0.02
        top = b["beltlineZ"] - 0.04 + (g["roofZ"] - b["beltlineZ"] + 0.04) * rise
        hw = w0 + (g["roofHalfWidth"] - w0) * rise
        gr.append([(x, y, z) for y, z in section(hw, top, b["beltlineZ"] - 0.06, NV, u, p=4.5, tumble=0.18)])
    gh = loft("Greenhouse", gr, M["glass"], chassis)
    gh.data.materials.append(M["paint"])
    for poly in gh.data.polygons:                    # roof cap and the band under the glass are paint
        if poly.center.z > g["roofZ"] - 0.07 or poly.center.z < b["beltlineZ"] - 0.02:
            poly.material_index = 1
    # chrome: side spears, rocker strips, bumpers; gold pinstripe on the beltline
    for side in (1, -1):
        spear, rocker, pin = [], [], []
        for i in range(60):
            u = 0.06 + 0.88 * i / 59
            x = L / 2 - u * L
            w, top, bot = body_profile(u)
            spear.append((x, side * (w * 1.022 + 0.004), 0.62))
            rocker.append((x, side * (w * (1 - b["tumblehome"] * 0.0) - 0.06), bot + 0.025))
            pin.append((x, side * (w * (1 - b["tumblehome"] * ((top - 0.04 - bot) / (top - bot)) ** 2) + 0.003), top - 0.045))
        tube_curve(f"Spear{side}", spear, 0.011, M["chrome"], chassis)
        tube_curve(f"Rocker{side}", rocker, 0.014, M["chrome"], chassis)
        tube_curve(f"Pinstripe{side}", pin, 0.004, M["gold"], chassis)
    for x, z, name in ((L / 2 + 0.035, 0.40, "FrontBumper"), (-L / 2 - 0.035, 0.42, "RearBumper")):
        pts = [(x - math.copysign(0.10 * (abs(t) ** 4), x), t * b["width"] / 2 * 0.95, z) for t in np.linspace(-1, 1, 24)]
        tube_curve(name, pts, 0.065, M["chrome"], chassis)
    # lights and grille
    for side in (1, -1):
        box(f"HeadBar{side}", (0.03, 0.42, 0.035), (L / 2 - 0.005, side * 0.58, 0.66), M["headlight"], chassis, bevel=0.01)
    box("TailBar", (0.03, b["width"] * 0.86, 0.045), (-L / 2 + 0.0, 0, 0.70), M["taillight"], chassis, bevel=0.01)
    box("GrilleGlow", (0.02, 1.2, 0.16), (L / 2 - 0.02, 0, 0.52), M["grille"], chassis)
    for k in range(5):
        box(f"GrilleBar{k}", (0.03, 1.24, 0.012), (L / 2 + 0.002, 0, 0.455 + k * 0.035), M["chrome"], chassis, bevel=0.004)
    box("Undertray", (L * 0.86, b["width"] * 0.82, 0.04), (0, 0, b["rockerZ"] + 0.02), M["under"], chassis)
    # tiny chrome wire wheels inside glowing hover rings, on visible struts
    wheels, rings_ob = [], []
    for sx in (1, -1):
        for sy in (1, -1):
            cx, cy = sx * wh["wheelbase"] / 2, sy * wh["track"] / 2
            wheel = empty(f"Wheel{sx}{sy}", parent=root, loc=(cx, cy, wh["radius"] + hv["rideHeight"] - 0.12))
            build_wire_wheel(wheel, M, sy)
            wheels.append(wheel)
            ring = empty(f"HoverPod{sx}{sy}", parent=root, loc=(cx, cy, 0.075))
            mk_torus(f"HoverRing{sx}{sy}", hv["ringRadius"], hv["ringTube"], M["hover"], ring)
            mk_torus(f"HoverCore{sx}{sy}", hv["ringRadius"] * 0.62, hv["ringTube"] * 0.6, M["hovercore"], ring)
            rings_ob.append(ring)
            for dx in (-0.16, 0.16):                 # A-arm struts from the undertray to the pod
                tube_curve(f"Strut{sx}{sy}{dx}", [(cx + dx, cy * 0.55, b["rockerZ"]), (cx + dx * 0.4, cy * 0.98, 0.16), (cx, cy, 0.09)], 0.012, M["chrome"], chassis)
    # underglow: an emissive keel and a violet area light onto the asphalt
    box("UnderglowKeel", (L * 0.7, 0.05, 0.02), (0, 0, b["rockerZ"] - 0.01), M["hover"], chassis)
    lt = bpy.data.lights.new("Underglow", "AREA"); lt.shape = "RECTANGLE"; lt.size, lt.size_y = L * 0.8, b["width"] * 0.8
    lt.color = P("hoverViolet")[:3]; lt.energy = 60
    lo = bpy.data.objects.new("Underglow", lt); bpy.context.scene.collection.objects.link(lo)
    lo.parent = chassis; lo.location = (0, 0, b["rockerZ"] - 0.03)
    lo.visible_camera = False                       # it lights the asphalt; the camera must not see the emitter
    return {"root": root, "chassis": chassis, "body": body, "wheels": wheels, "pods": rings_ob, "underglow": lo}


def mk_torus(name, R, r, mat, parent, segs=48, tsegs=12):
    verts, faces = [], []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        for j in range(tsegs):
            b = 2 * math.pi * j / tsegs
            verts.append(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b)))
    for i in range(segs):
        for j in range(tsegs):
            faces.append((i * tsegs + j, ((i + 1) % segs) * tsegs + j, ((i + 1) % segs) * tsegs + (j + 1) % tsegs, i * tsegs + (j + 1) % tsegs))
    return mesh_object(name, verts, faces, mat, smooth_shade=True, parent=parent)


def build_wire_wheel(parent, M, side):
    """A 0.22 m chrome wire wheel standing upright (axle along Y): rim, hub, spinner, 24 spokes."""
    wh = CAR["wheels"]
    R, W = wh["radius"], wh["width"]
    rim = mk_torus("Rim", R * 0.92, 0.022, M["chrome"], parent)
    rim.rotation_euler = (math.pi / 2, 0, 0)
    lip = mk_torus("RimLip", R * 0.97, 0.012, M["chrome"], parent)
    lip.rotation_euler = (math.pi / 2, 0, 0); lip.location = (0, side * W * 0.45, 0)
    hub = mk_torus("Hub", 0.035, 0.03, M["gold"], parent)
    hub.rotation_euler = (math.pi / 2, 0, 0); hub.location = (0, side * W * 0.3, 0)
    for k in range(wh["spokes"]):
        a = 2 * math.pi * k / wh["spokes"]
        off = (k % 2) * 0.5 - 0.25
        p0 = (0.04 * math.cos(a + 0.4), side * W * off * 0.6, 0.04 * math.sin(a + 0.4))
        p1 = ((R * 0.9) * math.cos(a), -side * W * off * 0.4, (R * 0.9) * math.sin(a))
        tube_curve(f"Spoke{k}", [p0, p1], 0.0035, M["chrome"], parent)
    for k in range(3):                              # three-bar knock-off spinner
        a = 2 * math.pi * k / 3
        tube_curve(f"Spinner{k}", [(0, side * W * 0.42, 0), (0.07 * math.cos(a), side * W * 0.42, 0.07 * math.sin(a))], 0.008, M["chrome"], parent)


# ======================================================================================
# the road and the mountain
# ======================================================================================
def road_centerline():
    """Angeles Crest sweepers. The road runs north-west along the flank, then a long left sweeper
    turns it toward the basin (compass ~225 deg) for the drop, where the crane looks along the road
    over the car to the skyline, then it turns back north-west for the hero slide."""
    def compass(s):
        base = 305.0 + 8.0 * math.sin(2 * math.pi * s / 180.0)
        toward = 80.0 * smooth((s - 270) / 120.0) * (1 - smooth((s - 545) / 120.0))
        return base - toward
    pts, x, y = [], 0.0, 0.0
    for s in range(0, 901):
        hdg = math.radians(90 - compass(s))           # compass -> maths angle from +X
        x += math.cos(hdg); y += math.sin(hdg)
        pts.append((x, y))
    a = np.array(pts)
    return a - a[450]                                  # the road's middle at the origin


def polyline_frames(c):
    t = np.gradient(c, axis=0)
    t /= np.linalg.norm(t, axis=1, keepdims=True)
    n = np.stack([-t[:, 1], t[:, 0]], axis=1)         # left normal (toward the valley)
    return t, n


def build_road(M):
    W = WORLD["road"]
    half = W["laneWidth"] * W["lanes"] / 2 + W["shoulder"]
    c = road_centerline()
    t, nrm = polyline_frames(c)
    verts, faces, uvs = [], [], []
    acr = 6
    for i, (p, n) in enumerate(zip(c, nrm)):
        for j in range(acr + 1):
            f = j / acr
            q = p + n * (half - 2 * half * f)
            verts.append((q[0], q[1], 0.0)); uvs.append((1 - f, i / 10))
    for i in range(len(c) - 1):
        for j in range(acr):
            a = i * (acr + 1) + j
            faces.append((a, a + 1, a + acr + 2, a + acr + 1))
    road = mesh_object("Road", verts, faces, M["road"], uvs=uvs)
    # guardrail on the valley side: a rail and posts, gold reflectors every 8 m
    off = half + 0.35
    rail = [(p[0] + n[0] * off, p[1] + n[1] * off, 0.62) for p, n in zip(c[::2], nrm[::2])]
    tube_curve("GuardRail", rail, 0.06, M["steel"])
    pv, pf = [], []
    for i in range(0, len(c), 2):
        q = c[i] + nrm[i] * off
        base = len(pv)
        for dx, dy in ((-0.05, -0.05), (0.05, -0.05), (0.05, 0.05), (-0.05, 0.05)):
            pv.append((q[0] + dx, q[1] + dy, -0.3)); pv.append((q[0] + dx, q[1] + dy, 0.7))
        pf += [(base + 0, base + 2, base + 3, base + 1), (base + 2, base + 4, base + 5, base + 3), (base + 4, base + 6, base + 7, base + 5), (base + 6, base + 0, base + 1, base + 7)]
    mesh_object("GuardPosts", pv, pf, M["steel"])
    rv, rf = [], []
    for i in range(0, len(c), int(W["guardrail"]["reflectorEvery"])):
        q = c[i] + nrm[i] * (off - 0.07)
        b0 = len(rv)
        rv += [(q[0] - t[i][0] * 0.05, q[1] - t[i][1] * 0.05, 0.58), (q[0] + t[i][0] * 0.05, q[1] + t[i][1] * 0.05, 0.58),
               (q[0] + t[i][0] * 0.05, q[1] + t[i][1] * 0.05, 0.68), (q[0] - t[i][0] * 0.05, q[1] - t[i][1] * 0.05, 0.68)]
        rf.append((b0, b0 + 1, b0 + 2, b0 + 3))
    mesh_object("Reflectors", rv, rf, M["reflector"])
    return {"road": road, "centerline": c, "tangent": t, "normal": nrm, "half": half}


def signed_distance(px, py, c):
    """Signed distance from points to the polyline: positive on the mountain (right) side."""
    best = np.full(px.shape, np.inf)
    sign = np.ones(px.shape)
    seg = np.zeros(px.shape, dtype=int)
    for k in range(0, len(c) - 1, 1):
        a, b = c[k], c[k + 1]
        ab = b - a
        apx, apy = px - a[0], py - a[1]
        tt = np.clip((apx * ab[0] + apy * ab[1]) / (ab @ ab), 0, 1)
        dx, dy = apx - tt * ab[0], apy - tt * ab[1]
        d = np.hypot(dx, dy)
        m = d < best
        best = np.where(m, d, best)
        seg = np.where(m, k, seg)
        cross = ab[0] * apy - ab[1] * apx
        sign = np.where(m, np.where(cross > 0, -1.0, 1.0), sign)   # left (valley) negative
    signed_distance.last_segment = seg
    return best * sign


def fbm(x, y, scale, octaves=5, seed=SEED):
    random.seed(seed)
    ox, oy = random.uniform(-1e4, 1e4), random.uniform(-1e4, 1e4)
    out = np.empty(x.shape)
    flat_x, flat_y = (x / scale + ox).ravel(), (y / scale + oy).ravel()
    vals = [noise.fractal(Vector((a, b, 0.0)), 0.6, 2.0, octaves) for a, b in zip(flat_x, flat_y)]
    out.ravel()[:] = vals
    return out


def terrain_height(px, py, c, half):
    """Road cut into the flank: shoulder ditch, a granite cut slope on the mountain side, a steep
    fall on the valley side, ridges behind, all rolling down toward the basin to the south-west."""
    d = signed_distance(px, py, c)
    seg = signed_distance.last_segment
    t = np.gradient(c, axis=0)
    t /= np.linalg.norm(t, axis=1, keepdims=True)
    b = math.radians(WORLD["city"]["bearingFromRoadDeg"])
    to_city = np.array([math.sin(b), math.cos(b)])
    spur = smooth_np((t[seg] @ to_city - 0.82) / 0.12)   # 1 where the road heads at the basin
    n1 = fbm(px, py, 240.0, 6)
    n2 = fbm(px, py, 37.0, 3, SEED + 1)
    h = np.zeros(px.shape)
    m = d > half + 0.8                                                     # mountain side
    dm = d - half - 0.8
    cut = np.minimum(dm, 9.0) * 1.6 + np.maximum(0, dm - 9.0) * 0.55       # 58 deg cut, then the flank
    mount = cut + 10 * n2 * np.minimum(1, dm / 6) + 120 * np.clip(n1 + 0.3, 0, None) * np.minimum(1, dm / 200)
    spur_fall = -(np.minimum(dm, 25.0) * 0.9 + np.maximum(0, dm - 25.0) * 0.5) + 5 * n2 * np.minimum(1, dm / 10)
    h = np.where(m, mount * (1 - spur) + spur_fall * spur, h)
    v = d < -(half + 0.8)                                                  # valley side
    dv = -d - half - 0.8
    fall = -(np.minimum(dv, 25.0) * 1.1 + np.maximum(0, dv - 25.0) * 0.62)
    h = np.where(v, fall + 6 * n2 * np.minimum(1, dv / 10) + 60 * n1 * np.minimum(1, dv / 300), h)
    h = np.where(~m & ~v, -0.08, h)
    return h


def build_terrain(M, road):
    c, half = road["centerline"], road["half"]
    # near field: 1.2 km square at 5 m
    N, S = 481, 1200.0                                   # 2.5 m: the cut slope must not facet up close
    xs = np.linspace(-S / 2, S / 2, N)
    X, Y = np.meshgrid(xs, xs)
    H = terrain_height(X, Y, c, half)
    verts = np.stack([X.ravel(), Y.ravel(), H.ravel()], axis=1)
    faces = [(i * N + j, i * N + j + 1, (i + 1) * N + j + 1, (i + 1) * N + j) for i in range(N - 1) for j in range(N - 1)]
    near = mesh_object("TerrainNear", verts, faces, M["rock"], smooth_shade=True)
    tex = bpy.data.textures.new("GraniteCrags", "CLOUDS")
    tex.noise_scale, tex.noise_depth, tex.noise_basis = 4.0, 3, "ORIGINAL_PERLIN"   # Voronoi F1 made pyramids
    disp = near.modifiers.new("Crags", "DISPLACE"); disp.texture = tex; disp.strength = 1.4; disp.mid_level = 0.5
    disp.texture_coords = "GLOBAL"
    disp.vertex_group = ""
    # far field: 34 km at 170 m, the near square cut out; falls into the basin floor to the south-west
    N2, S2 = 341, 34000.0                                 # 100 m; 170 m read as flat triangles behind the car
    xs2 = np.linspace(-S2 / 2, S2 / 2, N2)
    X2, Y2 = np.meshgrid(xs2, xs2)
    bearing = math.radians(WORLD["city"]["bearingFromRoadDeg"])
    toward = X2 * math.sin(bearing) + Y2 * math.cos(bearing)            # metres toward the city
    across = X2 * math.cos(bearing) - Y2 * math.sin(bearing)
    nf = fbm(X2, Y2, 3000.0, 5, SEED + 2)
    basin = WORLD["city"]["basinZ"]
    ridge = WORLD["terrain"]["ridgeHeight"]
    # mountains behind rise over ~1.5 km (an instant 500 m wall beside the road hid the city)
    H2 = np.where(toward < 0, -toward * 0.25 + ridge * 0.6 * np.clip(nf + 0.4, 0, None) * smooth_np(-toward / 1500.0), 0.0)
    # toward the city: a concave fall (steep below the road, flattening into the basin within ~3.5 km).
    # Ridges only off to the sides, so the San Gabriels frame the basin instead of hiding it.
    fall = basin * (1 - (1 - np.clip(toward / 3500.0, 0, 1)) ** 2.2)
    sides = 520 * np.clip(np.abs(across) / 9000.0 - 0.35, 0, None) * (1 - smooth_np(toward / 9000.0)) * np.clip(nf + 0.6, 0, None)
    H2 = np.where(toward >= 0, fall + sides + 40 * nf * (1 - smooth_np(toward / 1500.0)), H2)
    H2 = np.maximum(H2, basin - 5)
    verts2 = np.stack([X2.ravel(), Y2.ravel(), H2.ravel() - 1.0], axis=1)
    faces2 = []
    for i in range(N2 - 1):
        for j in range(N2 - 1):
            cx, cy = (xs2[j] + xs2[j + 1]) / 2, (xs2[i] + xs2[i + 1]) / 2
            if abs(cx) < S / 2 - 60 and abs(cy) < S / 2 - 60:
                continue
            faces2.append((i * N2 + j, i * N2 + j + 1, (i + 1) * N2 + j + 1, (i + 1) * N2 + j))
    far = mesh_object("TerrainFar", verts2, faces2, M["rock"], smooth_shade=True)
    add_subsurf(far, 1)
    tex2 = bpy.data.textures.new("RidgeCrags", "CLOUDS")
    tex2.noise_scale, tex2.noise_depth = 180.0, 4
    disp2 = far.modifiers.new("Crags", "DISPLACE"); disp2.texture = tex2; disp2.strength = 45.0; disp2.mid_level = 0.5
    disp2.texture_coords = "GLOBAL"
    return {"near": near, "far": far}


def smooth_np(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


# ======================================================================================
# the basin: grid, megatowers, blimps, flying traffic
# ======================================================================================
def city_center():
    b = math.radians(WORLD["city"]["bearingFromRoadDeg"])
    d = WORLD["city"]["distanceToDowntown"]
    return np.array([d * math.sin(b), d * math.cos(b)])


def build_city(M):
    C = WORLD["city"]
    z0 = C["basinZ"]
    cc = city_center()
    g = C["grid"]
    floor = mesh_object("BasinFloor", [(cc[0] - g["extentX"] / 2, cc[1] - g["extentY"] / 2, z0), (cc[0] + g["extentX"] / 2, cc[1] - g["extentY"] / 2, z0),
                                       (cc[0] + g["extentX"] / 2, cc[1] + g["extentY"] / 2, z0), (cc[0] - g["extentX"] / 2, cc[1] + g["extentY"] / 2, z0)],
                        [(0, 1, 2, 3)], M["basin"])
    rng = random.Random(SEED)
    verts, faces, crowns_v, crowns_f = [], [], [], []

    def tower(x, y, h, w):
        """Slender octagonal tower: three tapering setbacks, a slim spire base, a crown halo."""
        tiers = [(0.0, 0.55, 1.0), (0.55, 0.82, 0.78), (0.82, 1.0, 0.58)]
        for z_a, z_b, s in tiers:
            r0, r1 = w * s, w * s * 0.93
            base = len(verts)
            for zz, rr in ((z0 + h * z_a, r0), (z0 + h * z_b, r1)):
                for k in range(8):
                    a = math.pi / 8 + k * math.pi / 4
                    verts.append((x + rr * math.cos(a), y + rr * math.sin(a), zz))
            faces.extend((base + k, base + (k + 1) % 8, base + 8 + (k + 1) % 8, base + 8 + k) for k in range(8))
            faces.append(tuple(base + 8 + k for k in range(8)))
        top = z0 + h
        cb = len(crowns_v)
        for k in range(16):
            a = 2 * math.pi * k / 16
            for dz in (0.0, w * 0.06):
                crowns_v.append((x + w * 0.62 * math.cos(a), y + w * 0.62 * math.sin(a), top - h * 0.03 + dz))
        crowns_f.extend((cb + 2 * k, cb + 2 * ((k + 1) % 16), cb + 2 * ((k + 1) % 16) + 1, cb + 2 * k + 1) for k in range(16))

    dt = C["downtown"]
    for _ in range(dt["megatowers"]):
        r, a = 2600 * math.sqrt(rng.random()), rng.uniform(0, 2 * math.pi)
        h = rng.uniform(*dt["heightRange"]) * (1 - 0.45 * r / 2600)
        tower(cc[0] + r * math.cos(a), cc[1] + r * math.sin(a), h, rng.uniform(55, 95))
    for sat in C["satellites"]:
        for _ in range(sat["towers"]):
            r, a = 1500 * math.sqrt(rng.random()), rng.uniform(0, 2 * math.pi)
            tower(cc[0] + sat["offset"][0] + r * math.cos(a), cc[1] + sat["offset"][1] + r * math.sin(a), rng.uniform(*sat["heightRange"]), rng.uniform(40, 70))
    # mid-rise fabric: many low blocks on the grid, so the towers stand in a city, not a void
    for _ in range(1400):
        r, a = 9000 * math.sqrt(rng.random()), rng.uniform(0, 2 * math.pi)
        x, y = cc[0] + r * math.cos(a), cc[1] + r * math.sin(a)
        x, y = round(x / 400) * 400 + 200, round(y / 400) * 400 + 200
        h, w = rng.uniform(20, 120) * (1.6 - r / 9000), rng.uniform(15, 45)
        base = len(verts)
        for zz in (z0, z0 + h):
            verts.extend([(x - w, y - w, zz), (x + w, y - w, zz), (x + w, y + w, zz), (x - w, y + w, zz)])
        faces.extend([(base, base + 1, base + 5, base + 4), (base + 1, base + 2, base + 6, base + 5), (base + 2, base + 3, base + 7, base + 6), (base + 3, base, base + 4, base + 7), (base + 4, base + 5, base + 6, base + 7)])
    towers = mesh_object("Megatowers", verts, faces, M["tower"])
    crowns = mesh_object("CrownHalos", crowns_v, crowns_f, M["crown"])
    # blimps: pearl, gold bands, slow
    blimps = []
    for k in range(WORLD["city"]["blimps"]["count"]):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1.0)
        ob = bpy.context.active_object
        ob.name = f"Blimp{k}"
        Lb = C["blimps"]["length"]
        ob.scale = (Lb / 2, Lb / 9, Lb / 9)
        frac = 0.25 + 0.5 * k / max(1, C["blimps"]["count"] - 1)
        side = (rng.random() - 0.5) * 6000
        ob.location = (cc[0] * frac + side * 0.8, cc[1] * frac - side * 0.6, z0 + rng.uniform(*C["blimps"]["altitude"]))
        ob.rotation_euler = (0, 0, rng.uniform(0, math.pi))
        ob.data.materials.append(M["blimp"])
        for p in ob.data.polygons:
            p.use_smooth = True
        blimps.append(ob)
    # flying traffic: lanes along the grid, light dots every 70 m (animated by sliding the lane)
    lanes = []
    for k in range(C["flyingTraffic"]["lanes"]):
        alt = z0 + rng.uniform(*C["flyingTraffic"]["altitude"])
        along_x = k % 2 == 0
        off = (k - C["flyingTraffic"]["lanes"] / 2) * 1800
        tv, tf = [], []
        for i in range(-110, 111):
            s = i * 70.0
            x, y = (cc[0] + s, cc[1] + off) if along_x else (cc[0] + off, cc[1] + s)
            b0 = len(tv)
            r = 3.0
            tv += [(x - r, y, alt - r), (x + r, y, alt - r), (x + r, y, alt + r), (x - r, y, alt + r), (x, y - r, alt - r), (x, y + r, alt - r), (x, y + r, alt + r), (x, y - r, alt + r)]
            tf += [(b0, b0 + 1, b0 + 2, b0 + 3), (b0 + 4, b0 + 5, b0 + 6, b0 + 7)]
        ob = mesh_object(f"TrafficLane{k}", tv, tf, M["traffic"])
        ob["along_x"] = along_x
        lanes.append(ob)
    return {"floor": floor, "towers": towers, "crowns": crowns, "blimps": blimps, "lanes": lanes, "center": cc}


# ======================================================================================
# sky, sun, time of day
# ======================================================================================
def build_sky():
    w = bpy.data.worlds.new("Angeles")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes["Background"]
    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "NISHITA"
    sky.altitude = 1500.0
    sky.air_density, sky.dust_density, sky.ozone_density = 1.0, 0.6, 1.0
    sky.sun_rotation = math.radians(WORLD["timeOfDay"]["sunAzimuthDeg"] - 90)
    sky.sun_disc = True
    # art direction over physics: a palette gradient (horizon -> zenith, keyframed with the time of
    # day) carries the colour; the Nishita sky only adds the sun's glow. The physical sky alone read
    # as flat orange in 9:16 frames that mostly see the horizon.
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    rng_ = nt.nodes.new("ShaderNodeMapRange"); rng_.inputs["From Min"].default_value, rng_.inputs["From Max"].default_value = 0.0, 0.45
    nt.links.new(sep.outputs["Z"], rng_.inputs["Value"])
    hor = nt.nodes.new("ShaderNodeRGB"); hor.name = "Horizon"; hor.outputs[0].default_value = P("sunsetHorizon")
    zen = nt.nodes.new("ShaderNodeRGB"); zen.name = "Zenith"; zen.outputs[0].default_value = P("violetHaze")
    grad = nt.nodes.new("ShaderNodeMix"); grad.data_type = "RGBA"
    nt.links.new(rng_.outputs[0], grad.inputs[0]); nt.links.new(hor.outputs[0], grad.inputs[6]); nt.links.new(zen.outputs[0], grad.inputs[7])
    glow = nt.nodes.new("ShaderNodeMix"); glow.data_type = "RGBA"; glow.blend_type = "ADD"; glow.inputs[0].default_value = 0.05
    nt.links.new(grad.outputs[2], glow.inputs[6]); nt.links.new(sky.outputs[0], glow.inputs[7])
    nt.links.new(glow.outputs[2], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.0
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.angle = math.radians(1.2)
    so = bpy.data.objects.new("Sun", sun)
    bpy.context.scene.collection.objects.link(so)
    return {"world": w, "sky": sky, "sun": so}


def section_at(cues, frame):
    for s in cues["sections"]:
        if s["frames"][0] <= frame < s["frames"][1]:
            return s["name"]
    return cues["sections"][-1]["name"]


def tod_value(cues, frame, key):
    """Interpolate a per-section value smoothly across the cue sheet's sections."""
    table = WORLD["timeOfDay"]["sunElevationDegBySection"]
    pts = []
    for s in cues["sections"]:
        nm = s["name"].split("-")[0] if s["name"].startswith("transition") else s["name"]
        nm = "transition" if s["name"].startswith("transition") else nm
        pts.append(((s["frames"][0] + s["frames"][1]) / 2, table[nm]))
    xs, ys = zip(*pts)
    return float(np.interp(frame, xs, ys))


def animate_time_of_day(sky, cues, frames):
    sc = bpy.context.scene
    hz = haze_group().nodes
    for f in frames:
        el = tod_value(cues, f, "sun")
        sky["sky"].sun_elevation = math.radians(el)
        sky["sky"].keyframe_insert("sun_elevation", frame=f)
        sun = sky["sun"]
        sun.rotation_euler = (math.radians(90 - el), 0, math.radians(WORLD["timeOfDay"]["sunAzimuthDeg"] + 90))
        sun.keyframe_insert("rotation_euler", frame=f)
        sun.data.energy = 3.0 * smooth((el + 1.0) / 6.0)
        sun.data.color = lin("#FFC69A")[:3] if el < 6 else (1, 1, 1)
        sun.data.keyframe_insert("energy", frame=f)
        night = 1 - smooth((el + 1) / 5.0)                                 # 0 at golden hour, 1 after dusk
        for m in (bpy.data.materials["BasinGrid"], bpy.data.materials["TowerGlass"]):
            nd = m.node_tree.nodes["CityNight"].outputs[0]
            nd.default_value = 0.25 + 0.75 * night
            nd.keyframe_insert("default_value", frame=f)
        col = np.array(P("sunsetHorizon")) * (1 - night) + np.array(P("violetHaze")) * night
        hz["HazeColor"].outputs[0].default_value = tuple(col[:3]) + (1.0,)
        hz["HazeColor"].outputs[0].keyframe_insert("default_value", frame=f)
        hz["HazeStrength"].outputs[0].default_value = 0.9 * (1 - night) + 0.25 * night
        hz["HazeStrength"].outputs[0].keyframe_insert("default_value", frame=f)
        sc.view_settings.exposure = 0.0 + 1.2 * night
        sc.view_settings.keyframe_insert("exposure", frame=f)
        wn = bpy.context.scene.world.node_tree.nodes
        hcol = np.array(P("sunsetHorizon")) * (1 - night) + np.array(lin("#7A3458")) * night   # burgundy afterglow
        zcol = np.array(lin("#4F3C8C")) * (1 - night) + np.array(P("skyNight")) * night
        wn["Horizon"].outputs[0].default_value = tuple(hcol[:3]) + (1.0,)
        wn["Zenith"].outputs[0].default_value = tuple(zcol[:3]) + (1.0,)
        wn["Horizon"].outputs[0].keyframe_insert("default_value", frame=f)
        wn["Zenith"].outputs[0].keyframe_insert("default_value", frame=f)


# ======================================================================================
# animation: the car on the road, suspension and hover driven by the cue sheet
# ======================================================================================
def spring_track(frames, impulses, freq, damping, fps):
    """Sum of damped-spring responses: impulses [(frame, amplitude)] -> displacement per frame."""
    out = np.zeros(len(frames))
    w = 2 * math.pi * freq
    for f0, amp in impulses:
        t = (np.array(frames) - f0) / fps
        on = t >= 0
        out[on] += amp * np.exp(-damping * w * t[on]) * np.sin(w * t[on] + math.pi / 2) * (1 - np.exp(-t[on] * 60))
    return out


def animate_vehicle(car, road, cues, cand, frames):
    fps = cues["fps"]
    c, t = road["centerline"], road["tangent"]
    S = CAR["suspension"]
    # speed: steady 17 m/s; position along the road (metres from the road start)
    s0 = 140.0
    kicks = [(k["frame"], -S["kickCompress"] * k["strength"]) for k in cues["drivers"]["kick"]]
    events = cues["drivers"]["events"]
    slams = [(e["frame"], -S["slamDrop"]) for e in events if e["event"] == "slam"]
    hops = [e["frame"] for e in events if e["event"] == "hop"]
    lift = spring_track(frames, kicks + slams, S["spring"]["frequencyHz"], S["spring"]["damping"], fps)
    snares = [(e["frame"], 0.015 * e["strength"]) for e in cues["drivers"]["snareClap"]]
    roll = spring_track(frames, snares, 2.2, 0.3, fps)
    for i, f in enumerate(frames):
        s = s0 + 17.0 * f / fps
        k = int(min(len(c) - 2, max(0, s)))
        fr = s - k
        p = c[k] * (1 - fr) + c[k + 1] * fr
        hdg = math.atan2(t[k][1], t[k][0])
        p = p - road["normal"][k] * (WORLD["road"]["laneWidth"] / 2)          # right-hand lane (mountain side)
        sec = section_at(cues, f)
        drift = math.radians(12) * smooth((f - 130) / 30) * (1 - smooth((f - 225) / 15)) if sec == "pocket" else 0.0
        if sec == "pocket-out":
            drift = math.radians(28) * smooth((f - 485) / 25)               # the hero slide
        car["root"].location = (p[0], p[1], 0.0)
        car["root"].rotation_euler = (0, 0, hdg + drift)
        car["root"].keyframe_insert("location", frame=f)
        car["root"].keyframe_insert("rotation_euler", frame=f)
        hop = 0.0
        for hf in hops:
            hop += S["hopFrontLift"] * math.exp(-max(0, f - hf - 4) / 6.0) * smooth((f - hf + 2) / 4.0) if f >= hf - 2 else 0.0
        rise = 0.0
        if cand == "hover" and 240 <= f < 360:                              # the spin-up lifts the car on its rings
            rise = 0.6 * smooth((f - 250) / 90) * (1 - smooth((f - 352) / 6))
        car["chassis"].location = (0, 0, lift[i] + rise)
        car["chassis"].rotation_euler = (roll[i], -math.atan2(hop, CAR["wheels"]["wheelbase"]), 0)
        car["chassis"].keyframe_insert("location", frame=f)
        car["chassis"].keyframe_insert("rotation_euler", frame=f)
        for w in car["wheels"]:                                             # the wheels spin, carrying no weight
            w.rotation_euler = (0, 17.0 * f / fps / CAR["wheels"]["radius"], 0)
            w.keyframe_insert("rotation_euler", frame=f)
    # hover emitters pulse on 808 onsets
    hv = bpy.data.materials["HoverField"].node_tree.nodes["Emission"].inputs["Strength"]
    pulses = [(e["frame"], 1.0) for e in cues["drivers"]["sub808"]]
    env = np.zeros(len(frames))
    for f0, a in pulses:
        d = np.array(frames) - f0
        env += np.where(d >= 0, a * np.exp(-d / 5.0), 0)
    for i, f in enumerate(frames):
        hv.default_value = 0.8 + 2.4 * min(1.5, env[i])
        hv.keyframe_insert("default_value", frame=f)


def animate_traffic(city, frames, fps):
    for ob in city["lanes"]:
        for f in frames:                     # 140 m/s; dots repeat every 70 m, so the offset wraps
            d = (140.0 * f / fps) % 70.0
            ob.location = (d, 0, 0) if ob["along_x"] else (0, d, 0)
            ob.keyframe_insert("location", frame=f)


# ======================================================================================
# cameras (one per shot, switched by timeline markers)
# ======================================================================================
def make_camera(name, lens, dof=None):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.sensor_fit = "VERTICAL"
    cd.sensor_height = 24.0 * 16 / 9 * 0.75     # vertical full-frame-ish coverage for 9:16
    cd.clip_start, cd.clip_end = 0.05, 90000.0
    if dof:
        cd.dof.use_dof = True
        cd.dof.aperture_fstop, cd.dof.focus_distance = dof
    ob = bpy.data.objects.new(name, cd)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def look_at(cam, target, roll=0.0):
    d = Vector(target) - cam.location
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    cam.rotation_euler.rotate_axis("Z", roll)


def aim_framing(cam, subject, yaw_target, screen_y, screen_x=None):
    """Point the camera so its yaw faces yaw_target (a world point) and its pitch puts `subject`
    at screen height screen_y (0 bottom, 1 top), by bisection on pitch."""
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    d = Vector(yaw_target) - cam.location
    yaw = math.atan2(d.y, d.x)
    lo, hi = math.radians(-80), math.radians(40)
    for _ in range(40):
        mid = (lo + hi) / 2
        fwd = Vector((math.cos(yaw) * math.cos(mid), math.sin(yaw) * math.cos(mid), math.sin(mid)))
        cam.rotation_euler = fwd.to_track_quat("-Z", "Y").to_euler()
        bpy.context.view_layer.update()
        y = world_to_camera_view(sc, cam, Vector(subject)).y
        if y > screen_y:      # subject too high in frame: pitch up to push it down
            lo = mid
        else:
            hi = mid
    return cam.rotation_euler


_road_for_sight = {}


def clear_sight(loc, target, clearance=1.5, samples=40):
    """Raise a camera until every point on its sightline to target clears the terrain."""
    r = _road_for_sight
    loc = Vector(loc)
    for _ in range(200):
        ts = np.linspace(0.0, 0.92, samples)
        px = np.array([loc.x + (target.x - loc.x) * t for t in ts]); py = np.array([loc.y + (target.y - loc.y) * t for t in ts])
        pz = np.array([loc.z + (target.z - loc.z) * t for t in ts])
        h = terrain_height(px, py, r["centerline"], r["half"])
        if np.all(pz > h + clearance * (1 - ts * 0.8)):
            return loc
        loc.z += 1.0
    return loc


def car_frame(car, f):
    """World matrix of the car root at frame f (from its own keyframes)."""
    bpy.context.scene.frame_set(f)
    return car["root"].matrix_world.copy()


def build_cameras(car, city, road, cues, cand, frames):
    sc = bpy.context.scene
    cams = {}
    _road_for_sight.update(road)
    shots = [s for s in SHOTS["shots"] if s.get("candidate") in (None, cand)]
    for sh in shots:
        lens = {"S1": 24, "S2": 20, "S3": 28, "S4c": 35, "S4h": 35, "S5": 30, "S6": 85}[sh["id"]]
        dof = (2.8, 2.2) if sh["id"] == "S1" else None
        cam = make_camera(sh["id"], lens, dof)
        cams[sh["id"]] = cam
        f0, f1 = sh["frames"]
        mk = sc.timeline_markers.new(sh["id"], frame=f0); mk.camera = cam
        for f in range(f0, f1):
            if f not in frames:
                continue
            M = car_frame(car, f)
            u = (f - f0) / max(1, f1 - f0 - 1)
            def W(local):
                return M @ Vector(local)
            if sh["id"] == "S1":      # ground-scraping: front-left wheel, dolly back along the flank
                cam.location = W((2.9 - 4.6 * smooth(u), 1.55 + 1.7 * smooth(u), 0.18 + 0.25 * smooth(u)))
                look_at(cam, W((1.55 - 1.6 * smooth(u), 0.8 - 0.8 * smooth(u), 0.30 + 0.2 * smooth(u))))
                cam.data.dof.focus_distance = (cam.location - W((1.55 - 1.6 * smooth(u), 0.8, 0.3))).length
            elif sh["id"] == "S2":    # low, wide front three-quarter, tracking from the opposite lane
                cam.location = W((3.8 - 0.8 * u, 5.6, 0.9))
                look_at(cam, W((-0.3, 0, 0.6)))
            elif sh["id"] == "S3":    # orbit 150 deg, rising
                a = math.radians(70 + 150 * smooth(u))
                cam.location = W((6.4 * math.cos(a), 6.4 * math.sin(a), 1.0 + 2.0 * smooth(u)))
                look_at(cam, W((0, 0, 0.6)))
            elif sh["id"] == "S4c":   # push into the front intake
                cam.location = W((7.5 - 4.35 * smooth(u * 1.1), 0.0, 0.62 - 0.14 * smooth(u)))
                look_at(cam, W((2.0, 0, 0.52)))
            elif sh["id"] == "S4h":   # static low three-quarter while the car rises
                cam.location = W((5.2, 4.0, 0.35))
                look_at(cam, W((0, 0, 0.75)))
            elif sh["id"] == "S5":    # behind the car on the city straight: crane up, pull back, zoom 24 -> 70 mm
                lift = smooth(u)
                cam.data.lens = 24 + 46 * smooth((u - 0.15) / 0.75)
                cam.data.keyframe_insert("lens", frame=f)
                cam.location = W((-4.5 - 40 * lift, 1.2 + 1.0 * lift, 0.5 + 4.0 * lift))
                car_pt = W((0, 0, 0.6))
                city_pt = Vector((city["center"][0], city["center"][1], WORLD["city"]["basinZ"]))
                yaw_pt = car_pt + (car_pt - cam.location) * 50.0          # keep the car centred left-right
                aim_framing(cam, car_pt, yaw_pt, 0.42 - 0.17 * lift)
            elif sh["id"] == "S6":    # long lens from up the mountain side: the slide, the city behind
                if f == f0 or not cam.get("anchor"):
                    Ma = car_frame(car, min(599, f0 + 60))
                    cam["anchor"] = list(Ma @ Vector((10.0, -30.0, 6.0)))
                    bpy.context.scene.frame_set(f)
                cam.location = Vector(cam["anchor"])
                look_at(cam, W((0, 0, 0.55)))
            if sh["id"] in ("S2", "S5", "S6"):     # never inside the mountain, never behind a ridge
                before = cam.rotation_euler.copy()
                cam.location = clear_sight(cam.location, W((0, 0, 0.6)))
                if sh["id"] == "S5":
                    aim_framing(cam, W((0, 0, 0.6)), yaw_pt, 0.42 - 0.17 * lift)
                elif sh["id"] == "S6":
                    look_at(cam, W((0, 0, 0.55)))
                else:
                    look_at(cam, W((-0.3, 0, 0.6)))
            cam.keyframe_insert("location", frame=f)
            cam.keyframe_insert("rotation_euler", frame=f)
            if sh["id"] == "S1":
                cam.data.dof.keyframe_insert("focus_distance", frame=f)
    return cams


# ======================================================================================
# build, validate, render
# ======================================================================================
def build(cand="crest", frames=None, log=print):
    t0 = time.time()
    cues = json.load(open(os.path.join(SYNC, f"{cand}.cues.json")))
    frames = frames if frames is not None else list(range(cues["durationFrames"]))
    sc = reset_scene()
    M = build_materials()
    car = build_vehicle(M)
    road = build_road(M)
    terr = build_terrain(M, road)
    city = build_city(M)
    sky = build_sky()
    animate_vehicle(car, road, cues, cand, frames)
    animate_time_of_day(sky, cues, frames)
    animate_traffic(city, frames, cues["fps"])
    cams = build_cameras(car, city, road, cues, cand, frames)
    if cand == "crest":                       # black between the swallow's silence and the slam
        for f in frames:
            if 345 <= f < 360:
                sc.view_settings.exposure = -14.0
                sc.view_settings.keyframe_insert("exposure", frame=f)
    log(f"scene built for {cand} in {time.time() - t0:.1f} s: {len(bpy.data.objects)} objects, "
        f"{sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')} base polygons")
    return {"scene": sc, "cues": cues, "car": car, "road": road, "terrain": terr, "city": city, "sky": sky, "cams": cams}


def validate(S):
    """Checks that need no rendering. Returns a report; raises on hard failures."""
    from bpy_extras.object_utils import world_to_camera_view
    sc, car, cues = S["scene"], S["car"], S["cues"]
    rep = {"blender": bpy.app.version_string, "checks": []}

    def check(name, ok, detail):
        rep["checks"].append({"check": name, "ok": bool(ok), "detail": detail})
    body = car["body"]
    sc.frame_set(0)
    length = max(c[0] for c in body.bound_box) - min(c[0] for c in body.bound_box)     # in the car's own space
    check("vehicle length matches spec", abs(length - CAR["body"]["length"]) < 0.25, f"{length:.2f} m vs {CAR['body']['length']} m")
    check("cue sheet frames in range", all(0 <= k["frame"] < cues["durationFrames"] for k in cues["drivers"]["kick"]), f"{len(cues['drivers']['kick'])} kicks")
    check("one camera per shot, bound to markers", len(sc.timeline_markers) == len(S["cams"]), [m.name for m in sc.timeline_markers])
    # the car must be in frame at every shot's start, middle and end (CREST's black frames excepted)
    misses = []
    for sh in [s for s in SHOTS["shots"] if s["id"] in S["cams"]]:
        cam = S["cams"][sh["id"]]
        for f in (sh["frames"][0], (sh["frames"][0] + sh["frames"][1]) // 2, sh["frames"][1] - 1):
            sc.frame_set(f)
            p = world_to_camera_view(sc, cam, car["chassis"].matrix_world.translation)
            if not (0 <= p.x <= 1 and 0 <= p.y <= 1 and p.z > 0) and sh["id"] not in ("S4c",):
                misses.append((sh["id"], f, round(p.x, 2), round(p.y, 2)))
    check("car in frame at shot start/middle/end", not misses, misses or "all in frame")
    el = [math.degrees(S["sky"]["sky"].sun_elevation)]
    sc.frame_set(0); e0 = math.degrees(S["sky"]["sky"].sun_elevation)
    sc.frame_set(599); e1 = math.degrees(S["sky"]["sky"].sun_elevation)
    check("sunset to night across the piece", e0 > 2 and e1 < -4, f"sun {e0:.1f} deg -> {e1:.1f} deg")
    nan = any(not math.isfinite(v) for o in bpy.data.objects for v in o.location)
    check("no NaN transforms", not nan, "")
    rep["ok"] = all(c["ok"] for c in rep["checks"])
    return rep


def render_frames(S, frames, res, samples, out_dir=None, out=None, names=None):
    sc = S["scene"]
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.cycles.samples = samples
    done = []
    for i, f in enumerate(frames):
        sc.frame_set(f)
        path = out if out else os.path.join(out_dir, (names[i] if names else f"frame_{f:04d}") + ".png")
        sc.render.filepath = path
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        done.append({"frame": f, "path": path, "seconds": round(time.time() - t0, 1), "camera": sc.camera.name if sc.camera else None})
        print(f"rendered frame {f} -> {path} in {done[-1]['seconds']} s", flush=True)
    return done


def main(argv):
    ap = argparse.ArgumentParser(description="ANGELES//2099 scene generator")
    ap.add_argument("--cand", default="crest", choices=["crest", "hover"])
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--styleframe", choices=["SF1", "SF2", "SF3"])
    ap.add_argument("--frames", help="comma-separated frame numbers")
    ap.add_argument("--res", default="360x640")
    ap.add_argument("--samples", type=int, default=32)
    ap.add_argument("--device", default="CPU", choices=["CPU", "GPU"])
    ap.add_argument("--out")
    ap.add_argument("--out-dir")
    ap.add_argument("--save-blend")
    ap.add_argument("--report")
    a = ap.parse_args(argv)
    res = tuple(int(v) for v in a.res.split("x"))
    if a.styleframe:
        sf = next(s for s in SHOTS["styleframes"] if s["id"] == a.styleframe)
        frames = [sf["frame"]]
    elif a.frames:
        frames = [int(v) for v in a.frames.split(",")]
    else:
        frames = None
    # building animation for every frame is cheap; keys for only the requested frames would change interpolation
    S = build(a.cand)
    rep = validate(S)
    print(json.dumps(rep, indent=1))
    if a.report:
        with open(a.report, "w") as f:
            json.dump(rep, f, indent=1)
    if a.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(a.save_blend))
    if a.check or frames is None:
        return 0 if rep["ok"] else 1
    dev = set_device(S["scene"], a.device)
    print("device:", dev)
    if a.out_dir:
        os.makedirs(a.out_dir, exist_ok=True)
    render_frames(S, frames, res, a.samples, out_dir=a.out_dir, out=a.out if len(frames) == 1 else None)
    return 0


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    sys.exit(main(argv))
