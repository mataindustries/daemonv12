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
    """Real candy: a bright metallic flake base under a burgundy-TINTED clear coat. Light passing
    through the coat is coloured deep burgundy; light reflecting off it stays white, so highlights
    are clean and the colour is deep. (v1 tinted the base instead and read candy red.)"""
    m = material("CandyBurgundy", base=lin("#7A1426"), metallic=1.0, rough=0.34, coat=1.0, coat_rough=0.012)
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Coat Tint"].default_value = lin("#4A0A18")
    bsdf.inputs["Coat IOR"].default_value = 1.52
    tex = nt.nodes.new("ShaderNodeTexNoise"); tex.inputs["Scale"].default_value = 1400.0; tex.inputs["Detail"].default_value = 0.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = lin("#5A0F1F"); ramp.color_ramp.elements[1].color = lin("#A3203C")
    ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[1].position = 0.4, 0.8
    nt.links.new(tex.outputs["Fac"], ramp.inputs[0]); nt.links.new(ramp.outputs[0], bsdf.inputs["Base Color"])
    flake = nt.nodes.new("ShaderNodeBump"); flake.inputs["Strength"].default_value = 0.08   # sparkle under the coat only
    nt.links.new(tex.outputs["Fac"], flake.inputs["Height"]); nt.links.new(flake.outputs[0], bsdf.inputs["Normal"])
    return m


def build_materials():
    M = {}
    M["paint"] = candy_paint()
    M["chrome"] = material("Chrome", base=P("chrome"), metallic=1.0, rough=0.03)
    M["satin"] = material("SatinAlloy", base=lin("#8E8A99"), metallic=1.0, rough=0.22)
    M["chaparral"] = material("Chaparral", base=lin("#3C4128"), rough=0.95, haze=True)
    M["post"] = material("DelineatorPost", base=lin("#D8D4CC"), rough=0.5)
    M["landau"] = material("LandauVinyl", base=lin("#1E0A10"), rough=0.8)   # matte padded vinyl (a coat mirrored the strip light)
    M["gold"] = material("Gold", base=P("warmGold"), metallic=1.0, rough=0.16)
    M["glass"] = material("SmokedGlass", base=lin("#3A2E55"), rough=0.02, transmission=1.0, ior=1.45)
    M["interior"] = material("Oxblood", base=lin("#2A0A10"), rough=0.6)
    M["under"] = material("Undercarriage", base=lin("#141218"), metallic=0.6, rough=0.4)
    M["hover"] = emission_material("HoverField", P("hoverViolet"), 1.2)
    M["hovercore"] = emission_material("HoverCore", P("warmGold"), 2.0)
    M["headlight"] = emission_material("Headlight", lin("#FFE9CC"), 25.0)
    M["taillight"] = emission_material("Taillight", lin("#FF3424"), 4.5)        # 14 clipped to white: a tail lamp is red
    M["grille"] = emission_material("GrilleGlow", P("hoverViolet"), 3.0)
    M["reflector"] = emission_material("Reflector", P("warmGold"), 4.0)
    M["steel"] = material("Guardrail", base=lin("#9A98A0"), metallic=0.9, rough=0.35)
    M["road"] = road_material()
    M["rock"] = rock_material()
    M["basin"] = basin_material()
    M["tower"] = tower_material()
    M["blimp"] = blimp_material()
    M["traffic"] = emission_material("FlyingTraffic", lin("#FFF1D6"), 16.0, haze=True)
    M["trafficTail"] = emission_material("FlyingTrafficTail", lin("#FF8A3A"), 12.0, haze=True)
    M["gondola"] = emission_material("GondolaLights", P("windowWarm"), 6.0, haze=True)
    M["ocean"] = material("Pacific", base=lin("#120E22"), metallic=0.0, rough=0.06, haze=True)
    M["marine"] = marine_layer_material()
    M["crown"] = emission_material("CrownHalo", P("warmGold"), 1.6, haze=True)   # 7.0 clipped to white under the night exposure
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
    """San Gabriel granite: jointed blocks (dark recessed cracks from Voronoi cell edges), salt-and-
    pepper speckle up close, desert-varnish streaks running down, dry olive on gentle slopes.
    Light is warm, shadows violet-biased (palette graniteShadow)."""
    m = material("Granite", base=P("granite"), rough=0.82, haze=False)
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    L = nt.links.new
    tc = nt.nodes.new("ShaderNodeTexCoord")
    tone = nt.nodes.new("ShaderNodeTexNoise"); tone.inputs["Scale"].default_value = 0.12; tone.inputs["Detail"].default_value = 6.0
    L(tc.outputs["Object"], tone.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = lin("#6E6156"); ramp.color_ramp.elements[1].color = lin("#A39484")
    L(tone.outputs["Fac"], ramp.inputs[0])
    # joints: domain-warped Voronoi edges (irregular, thin, few) and a per-block tone shift.
    # (Unwarped, wide, dark edges read as crazy paving in the first pass.)
    warp = nt.nodes.new("ShaderNodeTexNoise"); warp.inputs["Scale"].default_value = 0.05; warp.inputs["Detail"].default_value = 3.0
    L(tc.outputs["Object"], warp.inputs["Vector"])
    wsc = nt.nodes.new("ShaderNodeVectorMath"); wsc.operation = "SCALE"; wsc.inputs["Scale"].default_value = 9.0
    L(warp.outputs["Color"], wsc.inputs[0])
    wv = nt.nodes.new("ShaderNodeVectorMath"); wv.operation = "ADD"; L(tc.outputs["Object"], wv.inputs[0]); L(wsc.outputs[0], wv.inputs[1])
    cracks = []
    for sc_, w_ in ((0.06, 0.012), (0.24, 0.02)):
        v = nt.nodes.new("ShaderNodeTexVoronoi"); v.feature = "DISTANCE_TO_EDGE"; v.inputs["Scale"].default_value = sc_
        v.inputs["Randomness"].default_value = 1.0
        L(wv.outputs[0], v.inputs["Vector"])
        mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["From Min"].default_value, mr.inputs["From Max"].default_value = 0.0, w_
        mr.inputs["To Min"].default_value = 0.35
        L(v.outputs["Distance"], mr.inputs["Value"])
        cracks.append(mr.outputs[0])
    jm = nt.nodes.new("ShaderNodeMath"); jm.operation = "MINIMUM"; L(cracks[0], jm.inputs[0]); L(cracks[1], jm.inputs[1])
    blk = nt.nodes.new("ShaderNodeTexVoronoi"); blk.inputs["Scale"].default_value = 0.06; L(wv.outputs[0], blk.inputs["Vector"])
    bt = nt.nodes.new("ShaderNodeMix"); bt.data_type = "RGBA"; bt.blend_type = "OVERLAY"; bt.inputs[0].default_value = 0.22
    L(ramp.outputs[0], bt.inputs[6]); L(blk.outputs["Color"], bt.inputs[7])
    crackcol = nt.nodes.new("ShaderNodeMix"); crackcol.data_type = "RGBA"; crackcol.inputs[6].default_value = P("graniteShadow")
    L(jm.outputs[0], crackcol.inputs[0]); L(bt.outputs[2], crackcol.inputs[7])
    # salt-and-pepper speckle (biotite, feldspar)
    sp = nt.nodes.new("ShaderNodeTexNoise"); sp.inputs["Scale"].default_value = 60.0; sp.inputs["Detail"].default_value = 2.0
    L(tc.outputs["Object"], sp.inputs["Vector"])
    spm = nt.nodes.new("ShaderNodeMapRange"); spm.inputs["From Min"].default_value, spm.inputs["From Max"].default_value = 0.35, 0.65
    spm.inputs["To Min"].default_value, spm.inputs["To Max"].default_value = 0.82, 1.12
    L(sp.outputs["Fac"], spm.inputs["Value"])
    speck = nt.nodes.new("ShaderNodeMix"); speck.data_type = "RGBA"; speck.blend_type = "MULTIPLY"; speck.inputs[0].default_value = 1.0
    L(crackcol.outputs[2], speck.inputs[6])
    spc = nt.nodes.new("ShaderNodeCombineColor"); L(spm.outputs[0], spc.inputs[0]); L(spm.outputs[0], spc.inputs[1]); L(spm.outputs[0], spc.inputs[2])
    L(spc.outputs[0], speck.inputs[7])
    # desert varnish: dark streaks stretched down the faces
    vm = nt.nodes.new("ShaderNodeMapping"); vm.inputs["Scale"].default_value = (0.35, 0.35, 0.04)
    L(tc.outputs["Object"], vm.inputs["Vector"])
    vn = nt.nodes.new("ShaderNodeTexNoise"); vn.inputs["Scale"].default_value = 1.2; vn.inputs["Detail"].default_value = 4.0
    L(vm.outputs[0], vn.inputs["Vector"])
    vr = nt.nodes.new("ShaderNodeMapRange"); vr.inputs["From Min"].default_value, vr.inputs["From Max"].default_value = 0.55, 0.75
    vr.inputs["To Max"].default_value = 0.55
    L(vn.outputs["Fac"], vr.inputs["Value"])
    varn = nt.nodes.new("ShaderNodeMix"); varn.data_type = "RGBA"; varn.inputs[7].default_value = lin("#3B2A26")
    L(vr.outputs[0], varn.inputs[0]); L(speck.outputs[2], varn.inputs[6])
    # dry olive chaparral tint on gentle slopes
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sepn = nt.nodes.new("ShaderNodeSeparateXYZ"); L(geo.outputs["Normal"], sepn.inputs[0])
    flat = nt.nodes.new("ShaderNodeMapRange")
    flat.inputs["From Min"].default_value, flat.inputs["From Max"].default_value = 0.8, 0.95
    flat.inputs["To Max"].default_value = 0.7
    L(sepn.outputs["Z"], flat.inputs["Value"])
    veg = nt.nodes.new("ShaderNodeMix"); veg.data_type = "RGBA"; veg.inputs[7].default_value = lin("#4A4C30")
    L(flat.outputs[0], veg.inputs[0]); L(varn.outputs[2], veg.inputs[6])
    L(veg.outputs[2], bsdf.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.45; bump.inputs["Distance"].default_value = 0.2
    L(jm.outputs[0], bump.inputs["Height"])
    bump2 = nt.nodes.new("ShaderNodeBump"); bump2.inputs["Strength"].default_value = 0.35
    L(sp.outputs["Fac"], bump2.inputs["Height"]); L(bump.outputs[0], bump2.inputs["Normal"])
    # medium relief: blocky facets (Voronoi F1 cells ~0.7 m) and rough knobs, so a cut face up close
    # reads as fractured granite rather than smooth plaster with drawn cracks
    fac = nt.nodes.new("ShaderNodeTexVoronoi"); fac.inputs["Scale"].default_value = 1.4; fac.inputs["Randomness"].default_value = 0.9
    L(wv.outputs[0], fac.inputs["Vector"])
    knob = nt.nodes.new("ShaderNodeTexNoise"); knob.inputs["Scale"].default_value = 2.2; knob.inputs["Detail"].default_value = 6.0; knob.inputs["Roughness"].default_value = 0.65
    L(tc.outputs["Object"], knob.inputs["Vector"])
    rel = nt.nodes.new("ShaderNodeMath"); rel.operation = "MULTIPLY_ADD"; rel.inputs[1].default_value = 0.6
    L(fac.outputs["Distance"], rel.inputs[0]); L(knob.outputs["Fac"], rel.inputs[2])
    bump3 = nt.nodes.new("ShaderNodeBump"); bump3.inputs["Strength"].default_value = 0.5; bump3.inputs["Distance"].default_value = 0.15
    L(rel.outputs[0], bump3.inputs["Height"]); L(bump2.outputs[0], bump3.inputs["Normal"])
    L(bump3.outputs[0], bsdf.inputs["Normal"])
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


# Screen-space budget: a 70 mm lens over 1280 px sees ~0.02 deg per pixel, 3.2 m at 9 km. A 4 m
# window grid sits at the Nyquist limit and aliased into a checkerboard in v1. Facade detail is
# now 16 m floor bands (4 storeys) and 9 m fins, and both fade to their average brightness as the
# pixel footprint grows: band-limited by design instead of by luck.
PIXEL_ANGLE = 0.00035          # radians per pixel at the reveal's 70 mm / 1280 px


def _lod_pattern(nt, coord, spacing, duty, dist, softness=0.12):
    """A soft periodic band along `coord` (spacing m, lit fraction `duty`) that fades to `duty`
    once one pixel covers more than ~a third of a period. Returns the output socket."""
    d = nt.nodes.new("ShaderNodeMath"); d.operation = "DIVIDE"; d.inputs[1].default_value = spacing
    nt.links.new(coord, d.inputs[0])
    f = nt.nodes.new("ShaderNodeMath"); f.operation = "FRACT"; nt.links.new(d.outputs[0], f.inputs[0])
    band = nt.nodes.new("ShaderNodeMapRange"); band.interpolation_type = "SMOOTHSTEP"
    band.inputs["From Min"].default_value, band.inputs["From Max"].default_value = duty + softness, duty - softness
    nt.links.new(f.outputs[0], band.inputs["Value"])
    fp = nt.nodes.new("ShaderNodeMath"); fp.operation = "MULTIPLY"; fp.inputs[1].default_value = PIXEL_ANGLE / spacing
    nt.links.new(dist, fp.inputs[0])
    fade = nt.nodes.new("ShaderNodeMapRange"); fade.interpolation_type = "SMOOTHSTEP"
    fade.inputs["From Min"].default_value, fade.inputs["From Max"].default_value = 0.12, 0.4
    nt.links.new(fp.outputs[0], fade.inputs["Value"])
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "FLOAT"
    mix.inputs[3].default_value = duty
    nt.links.new(fade.outputs[0], mix.inputs[0]); nt.links.new(band.outputs[0], mix.inputs[2])
    return mix.outputs[0]


def tower_material():
    """Dark sky-reflecting glass, warm floor bands between 9 m fins, lit irregularly band by band
    (an inhabited building, not a texture). One in five towers burns cooler. 'CityNight' scales it."""
    m = material("TowerGlass", base=lin("#1A1628"), metallic=0.92, rough=0.07)
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Object"], sep.inputs[0])
    xy = nt.nodes.new("ShaderNodeMath"); xy.operation = "ADD"; nt.links.new(sep.outputs["X"], xy.inputs[0]); nt.links.new(sep.outputs["Y"], xy.inputs[1])
    cam = nt.nodes.new("ShaderNodeCameraData")
    dist = cam.outputs["View Distance"]
    floors = _lod_pattern(nt, sep.outputs["Z"], 16.0, 0.58, dist)
    fins = _lod_pattern(nt, xy.outputs[0], 9.0, 0.8, dist)
    lit = nt.nodes.new("ShaderNodeMath"); lit.operation = "MULTIPLY"; nt.links.new(floors, lit.inputs[0]); nt.links.new(fins, lit.inputs[1])
    # which bands are occupied tonight: white noise per (band, tower cell); ~60 % lit
    band_id = nt.nodes.new("ShaderNodeMath"); band_id.operation = "DIVIDE"; band_id.inputs[1].default_value = 16.0
    nt.links.new(sep.outputs["Z"], band_id.inputs[0])
    bf = nt.nodes.new("ShaderNodeMath"); bf.operation = "FLOOR"; nt.links.new(band_id.outputs[0], bf.inputs[0])
    cell = nt.nodes.new("ShaderNodeMath"); cell.operation = "DIVIDE"; cell.inputs[1].default_value = 140.0
    nt.links.new(xy.outputs[0], cell.inputs[0])
    cf = nt.nodes.new("ShaderNodeMath"); cf.operation = "FLOOR"; nt.links.new(cell.outputs[0], cf.inputs[0])
    comb = nt.nodes.new("ShaderNodeCombineXYZ"); nt.links.new(bf.outputs[0], comb.inputs[0]); nt.links.new(cf.outputs[0], comb.inputs[1])
    wn = nt.nodes.new("ShaderNodeTexWhiteNoise"); wn.noise_dimensions = "3D"; nt.links.new(comb.outputs[0], wn.inputs["Vector"])
    occ = nt.nodes.new("ShaderNodeMapRange"); occ.inputs["From Min"].default_value, occ.inputs["From Max"].default_value = 0.35, 0.5
    occ.inputs["To Min"].default_value = 0.08
    nt.links.new(wn.outputs["Value"], occ.inputs["Value"])
    # the occupancy also fades to its mean with distance (it is a per-band pattern too)
    fp = nt.nodes.new("ShaderNodeMath"); fp.operation = "MULTIPLY"; fp.inputs[1].default_value = PIXEL_ANGLE / 16.0
    nt.links.new(dist, fp.inputs[0])
    of = nt.nodes.new("ShaderNodeMapRange"); of.interpolation_type = "SMOOTHSTEP"
    of.inputs["From Min"].default_value, of.inputs["From Max"].default_value = 0.12, 0.4
    nt.links.new(fp.outputs[0], of.inputs["Value"])
    occm = nt.nodes.new("ShaderNodeMix"); occm.data_type = "FLOAT"; occm.inputs[3].default_value = 0.62
    nt.links.new(of.outputs[0], occm.inputs[0]); nt.links.new(occ.outputs[0], occm.inputs[2])
    glow = nt.nodes.new("ShaderNodeMath"); glow.operation = "MULTIPLY"; nt.links.new(lit.outputs[0], glow.inputs[0]); nt.links.new(occm.outputs[0], glow.inputs[1])
    # one tower in five burns cooler (violet-white); chosen per 300 m cell so a tower is one colour
    tcell = nt.nodes.new("ShaderNodeVectorMath"); tcell.operation = "SNAP"; tcell.inputs[1].default_value = (300.0, 300.0, 1e6)
    nt.links.new(tc.outputs["Object"], tcell.inputs[0])
    twn = nt.nodes.new("ShaderNodeTexWhiteNoise"); twn.noise_dimensions = "3D"; nt.links.new(tcell.outputs[0], twn.inputs["Vector"])
    cool = nt.nodes.new("ShaderNodeMath"); cool.operation = "GREATER_THAN"; cool.inputs[1].default_value = 0.8
    nt.links.new(twn.outputs["Value"], cool.inputs[0])
    colmix = nt.nodes.new("ShaderNodeMix"); colmix.data_type = "RGBA"
    colmix.inputs[6].default_value = lin("#FFB45E"); colmix.inputs[7].default_value = P("windowCool")   # amber, so it survives AgX
    nt.links.new(cool.outputs[0], colmix.inputs[0])
    night = nt.nodes.new("ShaderNodeValue"); night.name = "CityNight"; night.outputs[0].default_value = 1.0
    st = nt.nodes.new("ShaderNodeMath"); st.operation = "MULTIPLY"; nt.links.new(glow.outputs[0], st.inputs[0]); nt.links.new(night.outputs[0], st.inputs[1])
    st2 = nt.nodes.new("ShaderNodeMath"); st2.operation = "MULTIPLY"; st2.inputs[1].default_value = 0.42; nt.links.new(st.outputs[0], st2.inputs[0])
    nt.links.new(colmix.outputs[2], bsdf.inputs["Emission Color"]); nt.links.new(st2.outputs[0], bsdf.inputs["Emission Strength"])
    add_haze(m)
    return m


def marine_layer_material():
    """The basin's evening marine layer: patchy translucent haze lit from below by the city
    (sodium-rose). Its glow follows 'CityNight'. No aerial-haze group: it is haze already."""
    m = bpy.data.materials.new("MarineLayer")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    out = nt.nodes["Material Output"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 1 / 4000.0; nz.inputs["Detail"].default_value = 5.0
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    dens = nt.nodes.new("ShaderNodeMapRange"); dens.inputs["From Min"].default_value, dens.inputs["From Max"].default_value = 0.4, 0.75
    dens.inputs["To Min"].default_value, dens.inputs["To Max"].default_value = 0.05, 0.42
    nt.links.new(nz.outputs["Fac"], dens.inputs["Value"])
    night = nt.nodes.new("ShaderNodeValue"); night.name = "CityNight"; night.outputs[0].default_value = 1.0
    st = nt.nodes.new("ShaderNodeMath"); st.operation = "MULTIPLY"; st.inputs[1].default_value = 0.55
    nt.links.new(night.outputs[0], st.inputs[0])
    em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = lin("#E58A6A")
    nt.links.new(st.outputs[0], em.inputs["Strength"])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(dens.outputs[0], mix.inputs[0]); nt.links.new(tr.outputs[0], mix.inputs[1]); nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
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
    em = nt.nodes.new("ShaderNodeMath"); em.operation = "MULTIPLY"; em.inputs[1].default_value = 1.3
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
def _arch(u, uc, half, ramp=0.012):
    """1 inside a squared wheel arch centred at uc (half-width `half` in u), 0 outside, short ramps."""
    d = abs(u - uc)
    return 1.0 - smooth((d - half) / ramp + 1.0) if d > half - ramp else 1.0


def body_profile(u):
    """Boxy formal hardtop: long straight lines, flat hood and deck, a power dome on the hood,
    squared ends, squared wheel arches. Returns half-width, top, bottom, dome height, arch lift."""
    b, wh = CAR["body"], CAR["wheels"]
    L = b["length"]
    w = b["width"] / 2 - 0.025 * (1 - smooth(u / 0.012)) - 0.02 * (1 - smooth((1 - u) / 0.012))
    top = b["hoodZ"] + (b["beltlineZ"] - b["hoodZ"]) * smooth((u - 0.30) / 0.08)
    top += (b["deckZ"] - b["beltlineZ"]) * smooth((u - 0.66) / 0.06)
    bot = b["rockerZ"] + 0.05 * (1 - smooth(u / 0.04)) + 0.06 * (1 - smooth((1 - u) / 0.05))
    pd = b["powerDome"]
    dome = pd["height"] * smooth((u - pd["fromU"]) / 0.03) * smooth((pd["toU"] - u) / 0.03)
    uf, ur = (L / 2 - wh["wheelbase"] / 2) / L, (L / 2 + wh["wheelbase"] / 2) / L
    half = wh["radius"] * 1.35 / L
    arch = max(_arch(u, uf, half), 0.8 * _arch(u, ur, half * 0.92))       # rear arch a little lower: part-skirted
    return w, top, bot, dome, arch


def body_section(u):
    """20-point faceted cross-section (closed loop) for the boxy body."""
    b = CAR["body"]
    w, top, bot, dome, arch = body_profile(u)
    hw = b["powerDome"]["halfWidth"]
    bot_out = bot + (b["archTopZ"] - bot) * arch
    right = [
        (0.0, top + dome), (hw, top + dome), (hw + 0.06, top + dome * 0.3), (w - 0.06, top), (w - 0.006, top - 0.05),
        (w + 0.012, b["bodyLineZ"]), (w, b["bodyLineZ"] - 0.07), (w - 0.02, min(bot_out + 0.05, b["bodyLineZ"] - 0.1)),
        (w - 0.07, min(bot_out, b["bodyLineZ"] - 0.12)), (0.58, bot),
    ]
    return right + [(0.0, bot - 0.005)] + [(-y, z) for y, z in reversed(right[1:])]


def faceted_loft(name, rings, mat, parent, bevel=0.012):
    nu, nv = len(rings), len(rings[0])
    verts = [p for ring in rings for p in ring]
    faces = [(i * nv + j, i * nv + (j + 1) % nv, (i + 1) * nv + (j + 1) % nv, (i + 1) * nv + j) for i in range(nu - 1) for j in range(nv)]
    faces.append(tuple(range(nv - 1, -1, -1)))                               # flat front face
    faces.append(tuple((nu - 1) * nv + j for j in range(nv)))                # flat, squared rear
    ob = mesh_object(name, verts, faces, mat, smooth_shade=True, parent=parent)
    bv = ob.modifiers.new("Bevel", "BEVEL")
    bv.width, bv.segments, bv.limit_method = bevel, 3, "ANGLE"
    bv.angle_limit = math.radians(28)
    try:
        bv.harden_normals = True                                             # flat panels, crisp rounded creases
    except AttributeError:
        pass
    return ob


def build_vehicle(M):
    b, g, wh, hv = CAR["body"], CAR["greenhouse"], CAR["wheels"], CAR["hover"]
    L, W = b["length"], b["width"]
    root = empty("CRESTLINE")                       # follows the road (location, heading, drift)
    chassis = empty("Chassis", parent=root)          # suspension: lift, pitch, roll
    us = sorted(set([i / 140 for i in range(141)]))
    rings = [[(L / 2 - u * L, y, z) for y, z in body_section(u)] for u in us]
    body = faceted_loft("Body", rings, M["paint"], chassis)
    body.data.materials.append(M["under"])
    for poly in body.data.polygons:                  # wheel-arch liners and the underside are dark
        if poly.normal.z < -0.5 or (abs(poly.center.y) < W / 2 - 0.05 and poly.center.z < b["archTopZ"] + 0.01 and abs(poly.normal.y) < 0.95 and poly.normal.z < 0.3):
            poly.material_index = 1
    # formal greenhouse: upright windshield, flat roof, formal C-pillar, small backlight, landau top
    gr = []
    NG = 40
    for i in range(NG):
        v = i / (NG - 1)
        u = g["fromU"] + v * (g["toU"] - g["fromU"])
        x = L / 2 - u * L
        rise = smooth((u - g["fromU"]) / (g["windshieldToU"] - g["fromU"])) * smooth((g["toU"] - u) / (g["toU"] - g["backlightFromU"]))
        base = body_profile(u)[1] - 0.005
        z = base + (g["roofZ"] - base) * rise
        wb = W / 2 - 0.05
        hw_ = wb + (g["roofHalfWidth"] - wb) * rise
        sec = [(0.0, z), (hw_ - 0.07, z), (hw_ - 0.005, z - 0.035), (wb, base), (0.0, base - 0.02)]
        sec = sec + [(-y, zz) for y, zz in reversed(sec[1:4])]
        gr.append([(x, y, zz) for y, zz in sec])
    gh = faceted_loft("Greenhouse", gr, M["glass"], chassis, bevel=0.008)
    for m_ in (M["paint"], M["landau"]):
        gh.data.materials.append(m_)
    ux = lambda X: (L / 2 - X) / L
    for poly in gh.data.polygons:
        u = ux(poly.center.x)
        roofish = poly.normal.z > 0.75
        if roofish:
            poly.material_index = 2 if u > g["landauFromU"] else 1
        elif u > g["backlightFromU"] - 0.01:
            poly.material_index = 0 if (abs(poly.center.y) < 0.5 and poly.normal.x < -0.4) else 2   # small backlight, vinyl C-pillars
        elif poly.center.z < b["beltlineZ"] + 0.02:
            poly.material_index = 1
    # chrome: massive bumpers with guards, rocker and beltline mouldings, body-line spear, drip rails
    for sgn, nm in ((1, "Front"), (-1, "Rear")):
        box(f"{nm}Bumper", (0.17, W + 0.06, 0.16), (sgn * (L / 2 + 0.07), 0, 0.37 if sgn > 0 else 0.4), M["chrome"], chassis, bevel=0.03)
        for gy in (-0.42, 0.42):
            box(f"{nm}Guard{gy}", (0.12, 0.09, 0.26), (sgn * (L / 2 + 0.13), gy, 0.39), M["chrome"], chassis, bevel=0.02)
    for side in (1, -1):
        # flush with the lower body and only between the arches (v2 first pass ran it through them: it read as a side pipe)
        ua, ub = 0.285, 0.722
        box(f"RockerTrim{side}", (L * (ub - ua), 0.02, 0.05), (L / 2 - L * (ua + ub) / 2, side * (W / 2 - 0.03), b["rockerZ"] + 0.055), M["chrome"], chassis, bevel=0.006)
        box(f"BeltTrim{side}", (L * (g["toU"] - g["fromU"]) + 0.4, 0.03, 0.022), (L / 2 - L * (g["fromU"] + g["toU"]) / 2, side * (W / 2 - 0.045), b["beltlineZ"] + 0.012), M["chrome"], chassis, bevel=0.006)
        spear = [(L / 2 - u * L, side * (body_profile(u)[0] + 0.02), b["bodyLineZ"] + 0.002) for u in np.linspace(0.03, 0.97, 40)]
        tube_curve(f"Spear{side}", spear, 0.008, M["chrome"], chassis)
        pin = [(L / 2 - u * L, side * (body_profile(u)[0] - 0.004), body_profile(u)[1] - 0.052) for u in np.linspace(0.02, 0.98, 40)]
        tube_curve(f"Pinstripe{side}", pin, 0.0035, M["gold"], chassis)
        drip = [(L / 2 - u * L, side * (g["roofHalfWidth"] - 0.002), g["roofZ"] - 0.03) for u in np.linspace(g["windshieldToU"], g["backlightFromU"], 12)]
        tube_curve(f"DripRail{side}", drip, 0.008, M["chrome"], chassis)
        sx_ = L / 2 - (g["backlightFromU"] + 0.035) * L                             # landau S-bar on the C-pillar
        sb = [(sx_ + 0.12 * math.cos(t) - 0.05 * t, side * (W / 2 - 0.035 - 0.08 * t / math.pi), 1.03 + 0.07 * math.sin(t)) for t in np.linspace(0, math.pi, 14)]
        tube_curve(f"LandauBar{side}", sb, 0.012, M["chrome"], chassis)
    # the face: wide egg-crate grille in a heavy chrome frame, quad rectangular lamps in bezels
    fx = L / 2 + 0.004
    box("GrilleRecess", (0.02, 1.16, 0.26), (fx - 0.02, 0, 0.6), M["under"], chassis)
    for (sy, sz, dy, dz) in ((0, 0.74, 1.22, 0.03), (0, 0.46, 1.22, 0.03), (0.6, 0.6, 0.03, 0.31), (-0.6, 0.6, 0.03, 0.31)):
        box(f"GrilleFrame{sy}{sz}", (0.05, dy, dz), (fx + 0.012, sy, sz), M["chrome"], chassis, bevel=0.006)
    for k in range(15):
        box(f"GrilleBar{k}", (0.035, 0.012, 0.26), (fx + 0.004, -0.56 + k * 0.08, 0.6), M["chrome"], chassis)
    for k in range(3):
        box(f"GrilleRail{k}", (0.035, 1.16, 0.01), (fx + 0.004, 0, 0.53 + k * 0.07), M["chrome"], chassis)
    for side in (1, -1):
        for j, yy in enumerate((0.70, 0.88)):
            box(f"LampBezel{side}{j}", (0.04, 0.16, 0.13), (fx + 0.008, side * yy, 0.64), M["chrome"], chassis, bevel=0.008)
            box(f"Lamp{side}{j}", (0.02, 0.12, 0.09), (fx + 0.022, side * yy, 0.64), M["headlight"], chassis)
    box("HoodCrest", (0.05, 0.03, 0.07), (L / 2 - 0.1, 0, b["hoodZ"] + b["powerDome"]["height"] + 0.035), M["gold"], chassis, bevel=0.008)
    # the squared tail: vertical lamp bars at the corners, a centre bar, chrome trunk surround
    rx = -L / 2 - 0.004
    for side in (1, -1):
        box(f"TailVert{side}", (0.03, 0.07, 0.34), (rx, side * (W / 2 - 0.06), 0.62), M["taillight"], chassis, bevel=0.005)
    box("TailCentre", (0.025, W * 0.62, 0.035), (rx, 0, 0.74), M["taillight"], chassis, bevel=0.005)
    box("TrunkTrim", (0.03, W * 0.9, 0.018), (rx - 0.004, 0, 0.82), M["chrome"], chassis, bevel=0.005)
    box("Undertray", (L * 0.9, W * 0.62, 0.04), (0, 0, b["rockerZ"] + 0.01), M["under"], chassis)
    # hover conversion, engineered: per corner a machined maglev module (satin housing, gold rim,
    # radial heat-sink fins, field coils glowing on the underside only) hung on a chrome hydraulic
    # actuator and satin A-arms; a stub axle carries the tiny wire wheel out in the arch.
    wheels, modules = [], []
    for sx in (1, -1):
        for sy in (1, -1):
            cx, cyw, cym = sx * wh["wheelbase"] / 2, sy * wh["track"] / 2, sy * hv["moduleInboardY"]
            wheel = empty(f"Wheel{sx}{sy}", parent=root, loc=(cx, cyw, wh["radius"] + 0.08))
            build_wire_wheel(wheel, M, sy)
            wheels.append(wheel)
            mod = empty(f"HoverModule{sx}{sy}", parent=chassis, loc=(cx, cym, 0.13))
            R, H = hv["housingRadius"], hv["housingHeight"]
            hv_, hf_ = [], []
            for k in range(32):
                a = 2 * math.pi * k / 32
                for rr, zz in ((R * 0.86, -H / 2), (R, -H / 4), (R, H / 4), (R * 0.9, H / 2)):
                    hv_.append((rr * math.cos(a), rr * math.sin(a), zz))
            for k in range(32):
                for j in range(3):
                    a0, a1 = k * 4 + j, ((k + 1) % 32) * 4 + j
                    hf_.append((a0, a1, a1 + 1, a0 + 1))
            hv_ += [(0, 0, H / 2), (0, 0, -H / 2)]
            hf_ += [(k * 4 + 3, ((k + 1) % 32) * 4 + 3, 128) for k in range(32)] + [(((k + 1) % 32) * 4, k * 4, 129) for k in range(32)]
            mesh_object(f"ModuleHousing{sx}{sy}", hv_, hf_, M["satin"], smooth_shade=True, parent=mod)
            mk_torus(f"ModuleRim{sx}{sy}", R + 0.004, 0.011, M["gold"], mod, segs=48, tsegs=8)
            for c, rc in enumerate((0.24, 0.17, 0.10)):
                coil = mk_torus(f"Coil{sx}{sy}{c}", rc, 0.007, M["hover"], mod, segs=48, tsegs=6)
                coil.location.z = -H / 2 - 0.004
            for k in range(18):
                a = 2 * math.pi * k / 18
                fin = box(f"Fin{sx}{sy}{k}", (0.11, 0.008, 0.035), (0.17 * math.cos(a), 0.17 * math.sin(a), H / 2 + 0.017), M["satin"], mod)
                fin.rotation_euler = (0, 0, a)
            top_z = 0.13 + H / 2
            tube_curve(f"ActuatorBody{sx}{sy}", [(cx, cym, top_z + 0.02), (cx, cym * 0.92, top_z + 0.11)], 0.034, M["chrome"], chassis)
            tube_curve(f"ActuatorRod{sx}{sy}", [(cx, cym * 0.92, top_z + 0.1), (cx, cym * 0.85, b["rockerZ"] + 0.02)], 0.016, M["chrome"], chassis)
            for dx in (-0.17, 0.17):
                tube_curve(f"Arm{sx}{sy}{dx}", [(cx + dx, cym, top_z - 0.01), (cx + dx * 0.5, sy * 0.2, b["rockerZ"] + 0.01)], 0.012, M["satin"], chassis)
            tube_curve(f"StubAxle{sx}{sy}", [(cx, cym + sy * R * 0.7, 0.16), (cx, cyw - sy * 0.03, wh["radius"] + 0.08)], 0.016, M["chrome"], chassis)
            pool = bpy.data.lights.new(f"FieldPool{sx}{sy}", "AREA"); pool.shape = "DISK"; pool.size = 0.5
            pool.color = P("hoverViolet")[:3]; pool.energy = 6
            po = bpy.data.objects.new(f"FieldPool{sx}{sy}", pool); bpy.context.scene.collection.objects.link(po)
            po.parent = mod; po.location = (0, 0, -H / 2 - 0.01); po.visible_camera = False
            modules.append(mod)
    lt = bpy.data.lights.new("Underglow", "AREA"); lt.shape = "RECTANGLE"; lt.size, lt.size_y = L * 0.7, W * 0.5
    lt.color = P("hoverViolet")[:3]; lt.energy = 8
    lo = bpy.data.objects.new("Underglow", lt); bpy.context.scene.collection.objects.link(lo)
    lo.parent = chassis; lo.location = (0, 0, b["rockerZ"] - 0.03)
    lo.visible_camera = False
    rig = build_light_rig(root)
    receivers = bpy.data.collections.new("CarReceivers")
    stack = [root]
    while stack:
        o = stack.pop()
        if o.type in ("MESH", "CURVE"):
            receivers.objects.link(o)
        stack.extend(o.children)
    for lt_ in rig.values():                         # light linking: the rig lights the car, never the road
        lt_.light_linking.receiver_collection = receivers
    return {"root": root, "chassis": chassis, "body": body, "wheels": wheels, "pods": modules, "underglow": lo, "rig": rig}


def build_light_rig(root):
    """Automotive-commercial light, motivated by the world: an overhead soft strip (the sky's
    brightest band) draws one long reflection along hood, roof and deck; a warm rim from the
    sunset's azimuth separates the silhouette from the background. Both follow the car's
    position but keep their world orientation, so the rim always comes from the sun's side.
    Invisible to camera rays, visible in reflections."""
    anchor = empty("LightRig")
    c = anchor.constraints.new("COPY_LOCATION"); c.target = root
    az = math.radians(WORLD["timeOfDay"]["sunAzimuthDeg"])
    sun_h = Vector((math.sin(az), math.cos(az), 0.0))
    lights = {}
    for name, shape, size, energy, color, loc in (
        ("Strip", "RECTANGLE", (7.5, 0.3), 380.0, "#E6E0FF", Vector((0, 0, 4.2))),   # 700 W turned the flat roof into a white slab
        ("Rim", "RECTANGLE", (4.0, 1.6), 2600.0, "#FFB27A", sun_h * 8.0 + Vector((0, 0, 1.4))),
        ("Kicker", "RECTANGLE", (3.0, 1.0), 500.0, "#B79CFF", -sun_h * 7.0 + Vector((0, 0, 0.6))),
    ):
        ld = bpy.data.lights.new(name, "AREA"); ld.shape = shape; ld.size, ld.size_y = size; ld.energy = energy
        ld.color = lin(color)[:3]
        ob = bpy.data.objects.new(name, ld); bpy.context.scene.collection.objects.link(ob)
        ob.parent = anchor; ob.location = loc
        ob.visible_camera = False
        tr = ob.constraints.new("TRACK_TO"); tr.target = root; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
        lights[name] = ob
    for nm in ("Strip", "Kicker"):                      # reflections only: they must not flood the road
        lights[nm].visible_diffuse = False
        lights[nm].visible_volume_scatter = False
    lights["Strip"].constraints.clear()                 # the strip lies flat along the car: it turns with it
    lights["Strip"].parent = root
    lights["Strip"].location = (0, 0, 4.2)
    lights["Strip"].rotation_euler = (0, 0, 0)
    sc = bpy.context.scene
    sc.frame_set(sc.frame_current)
    return lights


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


def _extended_road(c, reach=700.0, step=4.0):
    """The centreline every `step` m, continued straight past both ends by `reach` m, with tangents.
    Only for shaping terrain: the road itself still ends where it ends."""
    t = np.gradient(c, axis=0)
    t /= np.linalg.norm(t, axis=1, keepdims=True)
    k = np.arange(reach, 0, -step)[:, None]
    pre, post = c[0] - t[0] * k, c[-1] + t[-1] * k[::-1]
    pts = np.concatenate([pre, c[::int(step)], post])
    tan = np.concatenate([np.repeat(t[:1], len(pre), 0), t[::int(step)], np.repeat(t[-1:], len(post), 0)])
    return pts, tan


def soft_side_and_spur(px, py, c, u, tau=100.0):
    """Which side of the road a point is on (+1 mountain, -1 valley) and how much the road beside it
    heads at the basin (0..1), as softmin-weighted averages over the whole road. Within ~R of the
    road they equal the nearest-segment values; where two stretches of road disagree they blend
    over ~tau metres. (The nearest-segment versions jumped by 15-60 m along medial axes and made
    vertical fluted cliffs in the first v2 frames.)"""
    pts, tan = _extended_road(c)
    b = math.radians(WORLD["city"]["bearingFromRoadDeg"])
    spur_k = smooth_np((tan @ np.array([math.sin(b), math.cos(b)]) - 0.82) / 0.12)   # 1 where the road heads at the basin
    wsum = np.zeros(px.shape); side = np.zeros(px.shape); spur = np.zeros(px.shape)
    for (ax, ay), (tx, ty), sk in zip(pts, tan, spur_k):
        dx, dy = px - ax, py - ay
        dist = np.hypot(dx, dy)
        w = np.exp(-np.maximum(dist - u, 0.0) / tau)
        cross = tx * dy - ty * dx                                   # > 0 left of travel (valley)
        side += w * np.tanh(-2.0 * cross / (0.6 * dist + 2.0))
        spur += w * sk
        wsum += w
    return side / wsum, spur / wsum


def terrain_height(px, py, c, half):
    """Road cut into the flank: shoulder ditch, a granite cut slope on the mountain side, a steep
    fall on the valley side, ridges behind, all rolling down toward the basin to the south-west.
    Continuous everywhere: the side and spur fields are soft (see soft_side_and_spur)."""
    t0_, t1_ = (c[1] - c[0]) / np.linalg.norm(c[1] - c[0]), (c[-1] - c[-2]) / np.linalg.norm(c[-1] - c[-2])
    ext = np.concatenate([[c[0] - t0_ * 700.0], c, [c[-1] + t1_ * 700.0]])   # straight: one segment each way
    u = np.abs(signed_distance(px, py, ext))
    side, spur = soft_side_and_spur(px, py, c, u)
    n1 = fbm(px, py, 240.0, 6)
    n2 = fbm(px, py, 37.0, 3, SEED + 1)
    h = np.zeros(px.shape)
    # a 2.5 m flat shoulder before the cut: on a 2.5 m grid, a cut that started 0.8 m off the road
    # was interpolated up over the shoulder and through the road edge on curves
    dm = np.maximum(u - half - 2.5, 0.0)                                   # mountain side
    cut = np.minimum(dm, 9.0) * 1.6 + np.maximum(0, dm - 9.0) * 0.55       # 58 deg cut, then the flank
    mount = cut + 10 * n2 * np.minimum(1, dm / 6) + 120 * np.clip(n1 + 0.3, 0, None) * np.minimum(1, dm / 200)
    spur_fall = -(np.minimum(dm, 25.0) * 0.9 + np.maximum(0, dm - 25.0) * 0.5) + 5 * n2 * np.minimum(1, dm / 10)
    hm = mount * (1 - spur) + spur_fall * spur
    dv = np.maximum(u - half - 1.8, 0.0)                                   # valley side
    fall = -(np.minimum(dv, 25.0) * 1.1 + np.maximum(0, dv - 25.0) * 0.62)
    hv = fall + 6 * n2 * np.minimum(1, dv / 10) + 60 * n1 * np.minimum(1, dv / 300)
    k = (side + 1) / 2
    h = hm * k + hv * (1 - k)
    # the flat shoulder: on the mountain side up to half+2.5, on the valley side up to half+1.8
    flat = np.where(side > 0, u <= half + 2.5, u <= half + 1.8)
    return np.where(flat, -0.08, h)


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
    dist_ = np.abs(signed_distance(X.ravel(), Y.ravel(), c))
    relief = near.vertex_groups.new(name="relief")             # the ditch and shoulder stay flat
    wts = smooth_np((dist_ - half - 3.0) / 6.0)
    for w_ in np.unique(np.round(wts, 2)):
        idx = np.nonzero(np.round(wts, 2) == w_)[0].tolist()
        if w_ > 0:
            relief.add(idx, float(w_), "REPLACE")
    sub = near.modifiers.new("Detail", "SUBSURF"); sub.subdivision_type = "SIMPLE"; sub.levels = sub.render_levels = 1   # 1.25 m: relief, not drawn-on cracks
    tex = bpy.data.textures.new("GraniteCrags", "CLOUDS")
    tex.noise_scale, tex.noise_depth, tex.noise_basis = 4.0, 3, "ORIGINAL_PERLIN"   # Voronoi F1 made pyramids
    disp = near.modifiers.new("Crags", "DISPLACE"); disp.texture = tex; disp.strength = 1.4; disp.mid_level = 0.5
    disp.texture_coords = "GLOBAL"
    disp.vertex_group = "relief"
    joints = bpy.data.textures.new("GraniteJoints", "VORONOI")
    joints.noise_scale = 5.0
    joints.weight_1, joints.weight_2 = -1.0, 1.0                     # F2 - F1: high inside blocks, low at joints
    d2 = near.modifiers.new("Joints", "DISPLACE"); d2.texture = joints; d2.strength = 1.1; d2.mid_level = 0.3
    d2.texture_coords = "GLOBAL"
    d2.vertex_group = "relief"
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


def build_roadside(M, road):
    """Sparse dressing that gives scale without clutter: granite boulders at the cut toe and below
    the guardrail, low chaparral clumps on the slopes beyond 10 m, delineator posts with gold
    reflectors on the mountain side every 30 m."""
    rng = random.Random(SEED + 7)
    c, nrm, half = road["centerline"], road["normal"], road["half"]
    bv, bf, cv, cf, dv, df = [], [], [], [], [], []

    def rock(vl, fl, centre, size, squash, seed):
        r_ = random.Random(seed)
        b0 = len(vl)
        ico = [(0, 0, 1), (0.894, 0, 0.447), (0.276, 0.851, 0.447), (-0.724, 0.526, 0.447), (-0.724, -0.526, 0.447), (0.276, -0.851, 0.447),
               (0.724, 0.526, -0.447), (-0.276, 0.851, -0.447), (-0.894, 0, -0.447), (-0.276, -0.851, -0.447), (0.724, -0.526, -0.447), (0, 0, -1)]
        for (x, y, z) in ico:
            j = 0.75 + 0.5 * r_.random()
            vl.append((centre[0] + x * size * j, centre[1] + y * size * j * (0.8 + 0.4 * r_.random()), centre[2] + z * size * squash * j))
        tri = [(0, 1, 2), (0, 2, 3), (0, 3, 4), (0, 4, 5), (0, 5, 1), (1, 6, 2), (2, 7, 3), (3, 8, 4), (4, 9, 5), (5, 10, 1),
               (6, 7, 2), (7, 8, 3), (8, 9, 4), (9, 10, 5), (10, 6, 1), (11, 7, 6), (11, 8, 7), (11, 9, 8), (11, 10, 9), (11, 6, 10)]
        fl.extend(tuple(b0 + i for i in t) for t in tri)

    for i in range(20, len(c) - 20, 9):
        for side in (-1, 1):
            if rng.random() < 0.55:
                continue
            size = 0.3 + 1.6 * rng.random() ** 2
            d = (half + 1.2 + size + rng.random() * 2.0) * (-side)        # clear of the shoulder by its own radius
            p = c[i] + nrm[i] * d
            z = terrain_height(np.array([p[0]]), np.array([p[1]]), c, half)[0]
            rock(bv, bf, (p[0], p[1], z + 0.1), size, 0.55, rng.randint(0, 1 << 30))
    for i in range(0, len(c), 6):
        for side in (-1, 1):
            if rng.random() < 0.4:
                continue
            d = half + 10 + rng.random() * 70
            p = c[i] + nrm[i] * d * side
            z = terrain_height(np.array([p[0]]), np.array([p[1]]), c, half)[0]
            rock(cv, cf, (p[0], p[1], z + 0.2), 0.6 + rng.random() * 0.9, 0.45, rng.randint(0, 1 << 30))
    for i in range(0, len(c), 30):
        p = c[i] - nrm[i] * (half + 0.4)
        b0 = len(dv)
        for dz, w_ in ((0.0, 0.05), (1.0, 0.05)):
            dv += [(p[0] - w_, p[1] - w_, dz), (p[0] + w_, p[1] - w_, dz), (p[0] + w_, p[1] + w_, dz), (p[0] - w_, p[1] + w_, dz)]
        df += [(b0, b0 + 1, b0 + 5, b0 + 4), (b0 + 1, b0 + 2, b0 + 6, b0 + 5), (b0 + 2, b0 + 3, b0 + 7, b0 + 6), (b0 + 3, b0, b0 + 4, b0 + 7), (b0 + 4, b0 + 5, b0 + 6, b0 + 7)]
    boulders = mesh_object("Boulders", bv, bf, M["rock"], smooth_shade=True)
    add_subsurf(boulders, 1)
    brush = mesh_object("Chaparral", cv, cf, M["chaparral"], smooth_shade=True)
    posts = mesh_object("Delineators", dv, df, M["post"])
    rv, rf = [], []
    for i in range(0, len(c), 30):
        p = c[i] - nrm[i] * (half + 0.34)
        b0 = len(rv)
        rv += [(p[0] - 0.04, p[1], 0.82), (p[0] + 0.04, p[1], 0.82), (p[0] + 0.04, p[1], 0.92), (p[0] - 0.04, p[1], 0.92)]
        rf.append((b0, b0 + 1, b0 + 2, b0 + 3))
    mesh_object("DelineatorReflectors", rv, rf, M["reflector"])
    return {"boulders": boulders, "chaparral": brush, "posts": posts}


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

    spires_v, spires_f = [], []

    def ring_band(vlist, flist, x, y, zc, R, height, n=24):
        b0 = len(vlist)
        for k in range(n):
            a = 2 * math.pi * k / n
            for dz in (-height / 2, height / 2):
                vlist.append((x + R * math.cos(a), y + R * math.sin(a), zc + dz))
        flist.extend((b0 + 2 * k, b0 + 2 * ((k + 1) % n), b0 + 2 * ((k + 1) % n) + 1, b0 + 2 * k + 1) for k in range(n))

    def tower(x, y, h, w, crown=3):
        """Slender octagonal tower with three tapering setbacks. The crown is designed for its
        screen size (one pixel ~3 m at 9 km): a 0.06 h lantern of warm light, `crown` stacked gold
        halos at least 9 m tall, and a slim spire with a beacon."""
        tiers = [(0.0, 0.55, 1.0), (0.55, 0.82, 0.78), (0.82, 0.94, 0.58)]
        for z_a, z_b, sc_ in tiers:
            r0, r1 = w * sc_, w * sc_ * 0.93
            base = len(verts)
            for zz, rr in ((z0 + h * z_a, r0), (z0 + h * z_b, r1)):
                for k in range(8):
                    a = math.pi / 8 + k * math.pi / 4
                    verts.append((x + rr * math.cos(a), y + rr * math.sin(a), zz))
            faces.extend((base + k, base + (k + 1) % 8, base + 8 + (k + 1) % 8, base + 8 + k) for k in range(8))
            faces.append(tuple(base + 8 + k for k in range(8)))
        top = z0 + h * 0.94
        ring_band(crowns_v, crowns_f, x, y, top + h * 0.02, w * 0.42, h * 0.028)              # the lantern
        for i in range(crown):                                                                  # stacked halos
            ring_band(crowns_v, crowns_f, x, y, top - h * 0.05 - i * h * 0.035, w * (0.95 - 0.12 * i), max(9.0, h * 0.008))
        b0 = len(spires_v)                                                                      # spire
        for k in range(6):
            a = 2 * math.pi * k / 6
            spires_v.append((x + w * 0.1 * math.cos(a), y + w * 0.1 * math.sin(a), top + h * 0.06))
        spires_v.append((x, y, top + h * 0.16))
        spires_f.extend((b0 + k, b0 + (k + 1) % 6, b0 + 6) for k in range(6))
        ring_band(crowns_v, crowns_f, x, y, top + h * 0.155, w * 0.05, max(9.0, h * 0.006), n=8)  # beacon

    dt = C["downtown"]
    for _ in range(dt["megatowers"]):
        r, a = 2600 * math.sqrt(rng.random()), rng.uniform(0, 2 * math.pi)
        h = rng.uniform(*dt["heightRange"]) * (1 - 0.45 * r / 2600)
        tower(cc[0] + r * math.cos(a), cc[1] + r * math.sin(a), h, rng.uniform(80, 125))   # ~1:11, megatowers not candles
    for sat in C["satellites"]:
        for _ in range(sat["towers"]):
            r, a = 1500 * math.sqrt(rng.random()), rng.uniform(0, 2 * math.pi)
            tower(cc[0] + sat["offset"][0] + r * math.cos(a), cc[1] + sat["offset"][1] + r * math.sin(a), rng.uniform(*sat["heightRange"]), rng.uniform(55, 85), crown=1)
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
    spires = mesh_object("Spires", spires_v, spires_f, M["satin"])
    # depth layers beyond the city: a far ridge (the Santa Monicas' role), the Pacific, a marine layer
    bearing = math.radians(C["bearingFromRoadDeg"])
    fwd = np.array([math.sin(bearing), math.cos(bearing)]); side = np.array([fwd[1], -fwd[0]])
    rv, rf = [], []
    for row, (dist_, hmax) in enumerate(((C["distanceToDowntown"] + 11000, 820.0), (C["distanceToDowntown"] + 19000, 520.0))):
        b0 = len(rv)
        for i in range(161):
            t = (i - 80) / 80.0
            p_ = fwd * (dist_ + 2500 * t * t) + side * (t * 32000)
            hgt = hmax * (0.45 + 0.55 * (noise.noise(Vector((t * 7.0, row * 3.1, 0.0))) * 0.5 + 0.5)) * (1 - 0.6 * t * t)
            rv += [(p_[0], p_[1], z0 - 5), (p_[0], p_[1], z0 + hgt), (p_[0] + fwd[0] * 900, p_[1] + fwd[1] * 900, z0 + hgt * 0.6)]
        rf += [(b0 + 3 * i, b0 + 3 * i + 3, b0 + 3 * i + 4, b0 + 3 * i + 1) for i in range(160)]
        rf += [(b0 + 3 * i + 1, b0 + 3 * i + 4, b0 + 3 * i + 5, b0 + 3 * i + 2) for i in range(160)]
    ridges = mesh_object("FarRidges", rv, rf, M["rock"], smooth_shade=True)
    ocean = mesh_object("Pacific", [(-150000, -150000, z0 - 3), (150000, -150000, z0 - 3), (150000, 150000, z0 - 3), (-150000, 150000, z0 - 3)], [(0, 1, 2, 3)], M["ocean"])
    ml = mesh_object("MarineLayer", [(cc[0] - 36000, cc[1] - 30000, z0 + 150), (cc[0] + 36000, cc[1] - 30000, z0 + 150),
                                     (cc[0] + 36000, cc[1] + 30000, z0 + 150), (cc[0] - 36000, cc[1] + 30000, z0 + 150)], [(0, 1, 2, 3)], M["marine"])

    # blimps: luxury airships placed in the view corridor between the crest and downtown, broadside
    # to the road, each with a lit gondola and gold band lights. Never screens, never text.
    blimps = []
    Lb = C["blimps"]["length"]
    placements = [(2900, -650, 140), (4900, 820, 400), (6900, -1700, 60), (C["distanceToDowntown"], -9500, C["basinZ"] + 700), (C["distanceToDowntown"] + 3000, 6000, C["basinZ"] + 800)]
    for k, (d_, o_, alt) in enumerate(placements[:C["blimps"]["count"]]):
        pos = fwd * d_ + side * o_
        bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=1.0)
        ob = bpy.context.active_object
        ob.name = f"Blimp{k}"
        ob.scale = (Lb / 2, Lb / 9, Lb / 9)
        ob.location = (pos[0], pos[1], alt)
        ob.rotation_euler = (0, 0, math.atan2(side[1], side[0]) + math.radians(rng.uniform(-18, 18)))
        ob.data.materials.append(M["blimp"])
        for pl in ob.data.polygons:
            pl.use_smooth = True
        g = box(f"Gondola{k}", (Lb * 0.16, Lb * 0.035, Lb * 0.026), (0, 0, 0), M["gondola"])
        g.parent = ob; g.location = (0.05, 0, -1.08); g.scale = (2 / Lb * 1.0, 9 / Lb, 9 / Lb)
        for fi, (fy, fz, rot) in enumerate(((0, 1, 0), (0, -1, 0), (1, 0, math.pi / 2), (-1, 0, math.pi / 2))):
            fin = box(f"BlimpFin{k}{fi}", (Lb * 0.14, Lb * 0.008, Lb * 0.1), (0, 0, 0), M["blimp"])
            fin.parent = ob; fin.location = (-0.86, fy * 0.55, fz * 0.55); fin.scale = (2 / Lb, 9 / Lb, 9 / Lb)
            fin.rotation_euler = (rot, 0, 0)
        blimps.append(ob)

    # flying traffic: skyways over the boulevards (every 1.6 km) at three altitudes, as light trails;
    # white one way, amber the other; irregular gaps so it reads as traffic, not a pattern
    lanes = []
    lane_defs = []
    for k in range(C["flyingTraffic"]["lanes"]):
        along_x = k % 2 == 0
        off = (k // 2 - C["flyingTraffic"]["lanes"] // 4) * 1600.0
        alt = z0 + (220, 380, 540)[k % 3]
        lane_defs.append((along_x, off, alt))
    for k, (along_x, off, alt) in enumerate(lane_defs):
        for direction, mat in ((1, M["traffic"]), (-1, M["trafficTail"])):
            tv, tf = [], []
            s_ = -14000.0
            while s_ < 14000.0:
                L_, r_ = 22.0, 2.2
                x0, y0 = (cc[0] + s_, cc[1] + off + direction * 9) if along_x else (cc[0] + off + direction * 9, cc[1] + s_)
                dx, dy = (L_, 0) if along_x else (0, L_)
                b0 = len(tv)
                tv += [(x0, y0, alt - r_), (x0 + dx, y0 + dy, alt - r_), (x0 + dx, y0 + dy, alt + r_), (x0, y0, alt + r_),
                       (x0 - (r_ if not along_x else 0), y0 - (r_ if along_x else 0), alt), (x0 + dx - (r_ if not along_x else 0), y0 + dy - (r_ if along_x else 0), alt),
                       (x0 + dx + (r_ if not along_x else 0), y0 + dy + (r_ if along_x else 0), alt), (x0 + (r_ if not along_x else 0), y0 + (r_ if along_x else 0), alt)]
                tf += [(b0, b0 + 1, b0 + 2, b0 + 3), (b0 + 4, b0 + 5, b0 + 6, b0 + 7)]
                s_ += rng.choice((60.0, 90.0, 140.0, 260.0, 420.0))
            ob = mesh_object(f"Skyway{k}{'+' if direction > 0 else '-'}", tv, tf, mat)
            ob["along_x"] = along_x
            ob["direction"] = direction
            lanes.append(ob)
    # the commuter arc: a stream rising from downtown toward the crest, so the city reaches us
    arc_pts = []
    p0 = np.array([cc[0], cc[1], z0 + 450.0]); p2 = np.array([fwd[0] * 1600 + side[0] * -900, fwd[1] * 1600 + side[1] * -900, -160.0])
    p1 = (p0 + p2) / 2 + np.array([0, 0, 700.0])
    tv, tf = [], []
    for i in range(160):
        t = i / 159
        q = (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t * t * p2
        q2 = (1 - t - 0.002) ** 2 * p0 + 2 * (1 - t - 0.002) * (t + 0.002) * p1 + (t + 0.002) ** 2 * p2
        dvec = (q2 - q) / max(1e-6, np.linalg.norm(q2 - q)) * 16.0
        b0 = len(tv); r_ = 1.8
        tv += [tuple(q + [0, 0, -r_]), tuple(q + dvec + [0, 0, -r_]), tuple(q + dvec + [0, 0, r_]), tuple(q + [0, 0, r_])]
        tf.append((b0, b0 + 1, b0 + 2, b0 + 3))
    lanes.append(mesh_object("CommuterArc", tv, tf, M["traffic"]))
    return {"floor": floor, "towers": towers, "crowns": crowns, "spires": spires, "blimps": blimps, "lanes": lanes, "center": cc,
            "ridges": ridges, "ocean": ocean, "marine": ml}


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
    # Art direction over physics. A three-stop California gradient (horizon, rose, violet zenith),
    # glow lobes around the real sun direction, a warm horizon band brightest toward the sun, and
    # lit cirrus streaks. Every colour is keyframed with the time of day; Nishita adds only the disc.
    def node(kind, op=None, **inputs):
        n_ = nt.nodes.new(kind)
        if op:
            n_.operation = op
        for k_, v_ in inputs.items():
            n_.inputs[int(k_[1:])].default_value = v_
        return n_

    def rgb(name, hexc):
        r_ = nt.nodes.new("ShaderNodeRGB"); r_.name = name; r_.outputs[0].default_value = lin(hexc); return r_
    L = nt.links.new
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); L(tc.outputs["Generated"], sep.inputs[0])
    e = sep.outputs["Z"]
    hor, mid, zen = rgb("Horizon", "#FF9A5A"), rgb("Mid", "#E07A86"), rgb("Zenith", "#5A4A9C")
    r1 = nt.nodes.new("ShaderNodeMapRange"); r1.inputs["From Min"].default_value, r1.inputs["From Max"].default_value = 0.0, 0.14; L(e, r1.inputs["Value"])
    r2 = nt.nodes.new("ShaderNodeMapRange"); r2.inputs["From Min"].default_value, r2.inputs["From Max"].default_value = 0.12, 0.62; L(e, r2.inputs["Value"])
    g1 = nt.nodes.new("ShaderNodeMix"); g1.data_type = "RGBA"; L(r1.outputs[0], g1.inputs[0]); L(hor.outputs[0], g1.inputs[6]); L(mid.outputs[0], g1.inputs[7])
    g2 = nt.nodes.new("ShaderNodeMix"); g2.data_type = "RGBA"; L(r2.outputs[0], g2.inputs[0]); L(g1.outputs[2], g2.inputs[6]); L(zen.outputs[0], g2.inputs[7])
    sund = nt.nodes.new("ShaderNodeCombineXYZ"); sund.name = "SunDir"
    dot = nt.nodes.new("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"; L(tc.outputs["Generated"], dot.inputs[0]); L(sund.outputs[0], dot.inputs[1])
    pos = node("ShaderNodeMath", "MAXIMUM", i1=0.0); L(dot.outputs["Value"], pos.inputs[0])
    wide = node("ShaderNodeMath", "POWER", i1=5.0); L(pos.outputs[0], wide.inputs[0])
    tight = node("ShaderNodeMath", "POWER", i1=60.0); L(pos.outputs[0], tight.inputs[0])
    gw, gt = rgb("GlowWide", "#FF8A4C"), rgb("GlowTight", "#FFD08A")
    mw = nt.nodes.new("ShaderNodeMix"); mw.data_type = "RGBA"; mw.blend_type = "ADD"; L(wide.outputs[0], mw.inputs[0]); L(g2.outputs[2], mw.inputs[6]); L(gw.outputs[0], mw.inputs[7])
    mt = nt.nodes.new("ShaderNodeMix"); mt.data_type = "RGBA"; mt.blend_type = "ADD"; L(tight.outputs[0], mt.inputs[0]); L(mw.outputs[2], mt.inputs[6]); L(gt.outputs[0], mt.inputs[7])
    # horizon band: warm, brightest toward the sun
    bandm = nt.nodes.new("ShaderNodeMapRange"); bandm.interpolation_type = "SMOOTHSTEP"
    bandm.inputs["From Min"].default_value, bandm.inputs["From Max"].default_value = 0.08, -0.005; L(e, bandm.inputs["Value"])
    bw = node("ShaderNodeMath", "ADD", i1=0.3); L(wide.outputs[0], bw.inputs[0])
    bandf = node("ShaderNodeMath", "MULTIPLY"); L(bandm.outputs[0], bandf.inputs[0]); L(bw.outputs[0], bandf.inputs[1])
    bc = rgb("Band", "#FFB070")
    mb = nt.nodes.new("ShaderNodeMix"); mb.data_type = "RGBA"; mb.blend_type = "ADD"; L(bandf.outputs[0], mb.inputs[0]); L(mt.outputs[2], mb.inputs[6]); L(bc.outputs[0], mb.inputs[7])
    # cirrus: noise on a sky-plane projection, stretched into streaks, only 1-15 deg above the horizon
    ez = node("ShaderNodeMath", "ADD", i1=0.12); L(e, ez.inputs[0])
    px = node("ShaderNodeMath", "DIVIDE"); L(sep.outputs["X"], px.inputs[0]); L(ez.outputs[0], px.inputs[1])
    py_ = node("ShaderNodeMath", "DIVIDE"); L(sep.outputs["Y"], py_.inputs[0]); L(ez.outputs[0], py_.inputs[1])
    cv = nt.nodes.new("ShaderNodeCombineXYZ"); L(px.outputs[0], cv.inputs[0]); L(py_.outputs[0], cv.inputs[1])
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (0.5, 3.5, 1.0); mp.inputs["Rotation"].default_value = (0, 0, 0.5)
    L(cv.outputs[0], mp.inputs["Vector"])
    cn = nt.nodes.new("ShaderNodeTexNoise"); cn.inputs["Scale"].default_value = 1.6; cn.inputs["Detail"].default_value = 7.0; cn.inputs["Roughness"].default_value = 0.62
    L(mp.outputs[0], cn.inputs["Vector"])
    cm = nt.nodes.new("ShaderNodeMapRange"); cm.inputs["From Min"].default_value, cm.inputs["From Max"].default_value = 0.47, 0.66; L(cn.outputs["Fac"], cm.inputs["Value"])
    eb = nt.nodes.new("ShaderNodeMapRange"); eb.interpolation_type = "SMOOTHSTEP"; eb.inputs["From Min"].default_value, eb.inputs["From Max"].default_value = 0.015, 0.07; L(e, eb.inputs["Value"])
    et = nt.nodes.new("ShaderNodeMapRange"); et.interpolation_type = "SMOOTHSTEP"; et.inputs["From Min"].default_value, et.inputs["From Max"].default_value = 0.46, 0.2; L(e, et.inputs["Value"])
    cmask = node("ShaderNodeMath", "MULTIPLY"); L(cm.outputs[0], cmask.inputs[0]); L(eb.outputs[0], cmask.inputs[1])
    cmask2 = node("ShaderNodeMath", "MULTIPLY"); L(cmask.outputs[0], cmask2.inputs[0]); L(et.outputs[0], cmask2.inputs[1])
    cs = nt.nodes.new("ShaderNodeValue"); cs.name = "CloudStrength"; cs.outputs[0].default_value = 0.9
    cmask3 = node("ShaderNodeMath", "MULTIPLY"); L(cmask2.outputs[0], cmask3.inputs[0]); L(cs.outputs[0], cmask3.inputs[1])
    # lit toward the sun (peach, then afterglow rose), shaded away from it (rose-violet, then plum
    # silhouettes): the first v2 pass had one flat cloud colour and the clouds vanished into the sky
    cc_ = rgb("Cloud", "#FFB6A0")
    csh = rgb("CloudShade", "#B0607A")
    lp = node("ShaderNodeMath", "POWER", i1=2.5); L(pos.outputs[0], lp.inputs[0])
    cmix = nt.nodes.new("ShaderNodeMix"); cmix.data_type = "RGBA"; L(lp.outputs[0], cmix.inputs[0]); L(csh.outputs[0], cmix.inputs[6]); L(cc_.outputs[0], cmix.inputs[7])
    cl = nt.nodes.new("ShaderNodeMix"); cl.data_type = "RGBA"; L(cmask3.outputs[0], cl.inputs[0]); L(mb.outputs[2], cl.inputs[6]); L(cmix.outputs[2], cl.inputs[7])
    glow = nt.nodes.new("ShaderNodeMix"); glow.data_type = "RGBA"; glow.blend_type = "ADD"; glow.inputs[0].default_value = 0.03
    L(cl.outputs[2], glow.inputs[6]); L(sky.outputs[0], glow.inputs[7])
    L(glow.outputs[2], bg.inputs["Color"])
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
        for m in (bpy.data.materials["BasinGrid"], bpy.data.materials["TowerGlass"], bpy.data.materials["MarineLayer"]):
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
        az = math.radians(WORLD["timeOfDay"]["sunAzimuthDeg"]); er = math.radians(el)
        sd = wn["SunDir"]
        for i_, v_ in enumerate((math.sin(az) * math.cos(er), math.cos(az) * math.cos(er), math.sin(er))):
            sd.inputs[i_].default_value = v_
            sd.inputs[i_].keyframe_insert("default_value", frame=f)
        script = {"Horizon": ("#FF9A5A", "#8A3A5E", 1.0, 1.0), "Mid": ("#E07A86", "#4A2E66", 1.0, 1.0), "Zenith": ("#5A4A9C", "#1B1532", 1.0, 1.0),
                  "GlowWide": ("#FF8A4C", "#B0406A", 1.0, 0.45), "GlowTight": ("#FFD08A", "#FF9A6A", 1.6, 0.25),
                  "Band": ("#FFB070", "#C05070", 0.8, 0.45), "Cloud": ("#FFC2A0", "#C8607A", 1.0, 0.7),
                  "CloudShade": ("#B0607A", "#2E1E3E", 1.0, 1.0)}
        for name, (day, nite, kd, kn) in script.items():
            col = np.array(lin(day)) * kd * (1 - night) + np.array(lin(nite)) * kn * night
            wn[name].outputs[0].default_value = tuple(col[:3]) + (1.0,)
            wn[name].outputs[0].keyframe_insert("default_value", frame=f)
        wn["CloudStrength"].outputs[0].default_value = 0.95 - 0.2 * night
        wn["CloudStrength"].outputs[0].keyframe_insert("default_value", frame=f)


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
    """Skyways slide at 140 m/s along their own direction (the arc stays put: it is a stream)."""
    for ob in city["lanes"]:
        if "along_x" not in ob:
            continue
        for f in frames:
            d = 140.0 * f / fps * ob["direction"]
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


def keep_on_road(loc, margin=0.3):
    """Pull a ground-level camera back onto the asphalt/shoulder: on curves a car-relative offset can
    land inside the granite cut (S1 sat in the rock at frame 100 in the first pass)."""
    r = _road_for_sight
    d = signed_distance(np.array([loc.x]), np.array([loc.y]), r["centerline"])[0]
    lim = r["half"] + margin
    if abs(d) <= lim:
        return loc
    k = signed_distance.last_segment[0]
    n = r["normal"][k]                                    # left (valley) normal; d > 0 is the mountain side
    shift = (abs(d) - lim) * (1 if d > 0 else -1)
    return Vector((loc.x + n[0] * shift, loc.y + n[1] * shift, loc.z))


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
            if sh["id"] == "S1":      # ground-scraping: rear-right wheel and module, dolly out to a backlit rear 3/4
                k_ = smooth(u)
                wheel = Vector((-CAR["wheels"]["wheelbase"] / 2, -CAR["wheels"]["track"] / 2, 0.3))
                cam.location = keep_on_road(W(Vector((-2.55, -1.6, 0.2)).lerp(Vector((-7.2, -3.4, 0.55)), k_)))
                tgt = W(wheel.lerp(Vector((-0.9, 0.2, 2.0)), k_))          # tilts up: the car ends in the lower third, under the sky
                look_at(cam, tgt)
                cam.data.dof.focus_distance = (cam.location - tgt).length
            elif sh["id"] == "S2":    # low, wide front three-quarter, tracking from the opposite lane
                cam.location = W((3.8 - 0.8 * u, 5.6, 0.9))
                look_at(cam, W((-0.3, 0, 0.6)))
            elif sh["id"] == "S3":    # orbit 150 deg, rising
                a = math.radians(70 + 150 * smooth(u))
                cam.location = W((6.4 * math.cos(a), 6.4 * math.sin(a), 1.0 + 2.0 * smooth(u)))
                look_at(cam, W((0, 0, 0.6)))
            elif sh["id"] == "S4c":   # push into the front intake
                cam.location = W((7.5 - 4.05 * smooth(u * 1.1), 0.0, 0.62 - 0.14 * smooth(u)))   # ends 0.6 m off the grille
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
    build_roadside(M, road)
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
    # no camera may sit inside geometry: the centre ray must travel at least 0.5 m (S1 once sat in
    # the granite cut and SF1 rendered as a wall of rock)
    dg = bpy.context.evaluated_depsgraph_get()
    buried = []
    for sh in [s_ for s_ in SHOTS["shots"] if s_["id"] in S["cams"]]:
        cam = S["cams"][sh["id"]]
        for f in (sh["frames"][0], (sh["frames"][0] + sh["frames"][1]) // 2, sh["frames"][1] - 1):
            sc.frame_set(f)
            d = (cam.matrix_world.to_quaternion() @ Vector((0, 0, -1))).normalized()
            hit, loc, _n, _i, ob, _m = sc.ray_cast(dg, cam.matrix_world.translation, d)
            if hit and (loc - cam.matrix_world.translation).length < 0.5:
                buried.append((sh["id"], f, ob.name))
    check("no camera inside geometry", not buried, buried or "every centre ray clears 0.5 m")
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


CAR_SHEET = {   # car-local camera, car-local target, lens: a design sheet, not part of the shot plan
    "front34": ((5.8, 3.6, 1.05), (0.4, 0, 0.62), 35),
    "profile": ((0.0, 8.8, 0.7), (0.0, 0, 0.62), 50),
    "rear34": ((-5.9, 3.7, 1.2), (-0.4, 0, 0.62), 35),
    "module": ((2.75, 1.45, 0.05), (1.625, 0.6, 0.14), 35),
}


def render_car_sheet(S, out_dir, res, samples, frame=100):
    """Four views of CRESTLINE in the production scene at golden hour (guardrail and roadside props
    hidden so they do not cut across the car). Writes <view>.png into out_dir."""
    sc = S["scene"]
    for o in bpy.data.objects:
        if o.name.startswith(("GuardRail", "GuardPosts", "Reflectors", "Delineator", "Boulders", "Chaparral")):
            o.hide_render = True
    sc.timeline_markers.clear()
    sc.frame_set(frame)
    M = S["car"]["root"].matrix_world.copy()
    os.makedirs(out_dir, exist_ok=True)
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.cycles.samples = samples
    for name, (cl, tg, lens) in CAR_SHEET.items():
        cam = make_camera(f"Sheet_{name}", lens)
        cam.data.sensor_fit = "HORIZONTAL"; cam.data.sensor_width = 36.0
        cam.location = M @ Vector(cl)
        look_at(cam, M @ Vector(tg))
        sc.camera = cam
        sc.render.filepath = os.path.join(out_dir, f"{name}.png")
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        print(f"car sheet {name} in {time.time() - t0:.1f} s", flush=True)


def setup_animatic(S, res):
    """Workbench animatic: every material shows its palette colour, studio light, cavity for form,
    shot/frame/time burnt in. Heavy subdivision and displacement are skipped. A layout tool for
    timing and camera, not a look: Cycles stays for styleframes and finals."""
    sc = S["scene"]
    sc.render.engine = "BLENDER_WORKBENCH"
    sh = sc.display.shading
    sh.light, sh.color_type, sh.show_cavity, sh.show_shadows = "STUDIO", "MATERIAL", True, False
    sh.background_type = "WORLD"
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        nodes = m.node_tree.nodes
        col = None
        if "Principled BSDF" in nodes:
            pb = nodes["Principled BSDF"]
            col = pb.inputs["Emission Color"].default_value if pb.inputs["Emission Strength"].default_value > 0.5 and not pb.inputs["Emission Strength"].is_linked else pb.inputs["Base Color"].default_value
        elif "Emission" in nodes:
            col = nodes["Emission"].inputs["Color"].default_value
        if col is not None:
            m.diffuse_color = tuple(col)[:3] + (1.0,)
    for name, hexc in (("CandyBurgundy", "#7A1426"), ("Granite", "#8A7A6A"), ("BasinGrid", "#3A2A20"), ("TowerGlass", "#3A3050"), ("MarineLayer", "#E58A6A")):
        if name in bpy.data.materials:
            bpy.data.materials[name].diffuse_color = lin(hexc)
    sc.world.color = lin("#6A4A7A")[:3]
    for o in bpy.data.objects:
        for md in o.modifiers:
            if md.type in ("SUBSURF", "DISPLACE"):
                md.show_render = False
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.use_stamp = True
    for k in ("use_stamp_date", "use_stamp_render_time", "use_stamp_memory", "use_stamp_hostname", "use_stamp_filename", "use_stamp_scene", "use_stamp_lens", "use_stamp_time"):
        setattr(sc.render, k, False)
    sc.render.use_stamp_frame, sc.render.use_stamp_camera, sc.render.use_stamp_marker = True, True, True
    sc.render.stamp_font_size = 14


def render_animatic(S, out_dir, res, step=1):
    """PNG sequence of every `step`-th frame (one Workbench pass per frame)."""
    setup_animatic(S, res)
    sc = S["scene"]
    os.makedirs(out_dir, exist_ok=True)
    times = []
    for f in range(sc.frame_start, sc.frame_end + 1, step):
        sc.frame_set(f)
        sc.render.filepath = os.path.join(out_dir, f"frame_{f:04d}.png")
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        times.append(time.time() - t0)
        print(f"rendered frame {f} -> {sc.render.filepath} in {times[-1]:.2f} s", flush=True)
    return times


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
    ap.add_argument("--car-sheet", help="render the four-view CRESTLINE design sheet into this folder")
    ap.add_argument("--animatic", help="render the Workbench animatic PNG sequence into this folder")
    ap.add_argument("--step", type=int, default=1, help="animatic: every n-th frame")
    ap.add_argument("--first", type=int, help="animatic: first frame (default 0)")
    ap.add_argument("--last", type=int, help="animatic: last frame (default 599)")
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
    if a.animatic:
        if a.first is not None:
            S["scene"].frame_start = a.first
        if a.last is not None:
            S["scene"].frame_end = a.last
        t = render_animatic(S, a.animatic, res, a.step)
        print(f"animatic: {len(t)} frames, median {sorted(t)[len(t) // 2]:.2f} s/frame", flush=True)
        return 0
    if a.car_sheet:
        print("device:", set_device(S["scene"], a.device))
        render_car_sheet(S, a.car_sheet, res, a.samples)
        return 0
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
