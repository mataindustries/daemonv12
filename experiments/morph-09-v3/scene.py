"""MORPH//09 V3 — add the overload effects to V2's scene, changing nothing that V2 built.

    /opt/bpyenv/bin/python experiments/morph-09-v2/scene.py     # V2's scene, unchanged
    /opt/bpyenv/bin/python experiments/morph-09-v3/scene.py     # + effects → work/morph-09-v3/

Opens work/morph-09-v2/resonator.blend and adds: one plasma curve (core + halo) per arc
event, one particle per brake spark, one vapor volume over the visible caliper, an arc light
and a radiant-heat light. Every addition is hidden by render.py outside its effect window,
so pictures without effects are the V2 scene exactly.
"""
import json
import math
import sys
from pathlib import Path

import bpy  # noqa: I001  (bpy must load before bmesh in module builds)
import bmesh
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import effects as fx  # noqa: E402

V2_WORK = ROOT / 'work' / 'morph-09-v2'
OUT = ROOT / 'work' / 'morph-09-v3'

bpy.ops.wm.open_mainfile(filepath=str(V2_WORK / 'resonator.blend'))
S = bpy.context.scene
COLL = S.collection
META = json.loads((V2_WORK / 'resonator.json').read_text())
V3 = {'arcs': [], 'sparks': [], 'vapor': None, 'vaporNodes': {}, 'arcLight': None, 'heatLight': None}


# ------------------------------------------------------------------ materials
def _objcolor_emission(nt):
    oi = nt.nodes.new('ShaderNodeObjectInfo')
    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(oi.outputs['Color'], em.inputs['Color'])
    em.inputs['Strength'].default_value = 1.0
    return oi, em


def plasma_core(name):
    """Opaque emitter while lit, fully transparent when its keyed colour is black."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    oi, em = _objcolor_emission(nt)
    bw = nt.nodes.new('ShaderNodeRGBToBW')
    nt.links.new(oi.outputs['Color'], bw.inputs['Color'])
    k = nt.nodes.new('ShaderNodeMath')
    k.operation, k.use_clamp = 'MULTIPLY', True
    nt.links.new(bw.outputs['Val'], k.inputs[0])
    k.inputs[1].default_value = 400.0
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(k.outputs['Value'], mix.inputs['Fac'])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return m


def plasma_halo(name):
    """Additive glow: light added to whatever is behind, never an opaque surface."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    oi, em = _objcolor_emission(nt)
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    add = nt.nodes.new('ShaderNodeAddShader')
    nt.links.new(tr.outputs[0], add.inputs[0])
    nt.links.new(em.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], out.inputs['Surface'])
    return m


CORE = plasma_core('Plasma core')
HALO = plasma_halo('Plasma halo')
EMBER = plasma_core('Incandescent particle')


# ------------------------------------------------------------------ 1. plasma channels
def curve_object(name, paths, radius, mat, taper=True):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = 2
    cu.use_fill_caps = True
    for n, pts in enumerate(paths):
        sp = cu.splines.new('POLY')
        sp.points.add(len(pts) - 1)
        for i, (p, co) in enumerate(zip(sp.points, pts)):
            p.co = (*co, 1)
            s = i / (len(pts) - 1)
            if n == 0:       # main channel: thin at both attachments
                p.radius = 0.45 + 0.55 * math.sin(math.pi * s) if taper else 1.0
            else:            # branch: tapers to nothing in air
                p.radius = 0.75 * (1 - s) + 0.05
    o = bpy.data.objects.new(name, cu)
    COLL.objects.link(o)
    cu.materials.append(mat)
    o.color = (0, 0, 0, 1)
    o.hide_render = True
    return o


arcs = fx.arc_events()
for i, a in enumerate(arcs):
    paths = [a['main']] + a['branches']
    core = curve_object(f'Plasma core {i:02d}', paths, 0.0075, CORE)
    halo = curve_object(f'Plasma halo {i:02d}', paths, 0.06, HALO, taper=False)
    V3['arcs'].append({'core': core.name, 'halo': halo.name, 'frame': a['frame']})

lt = bpy.data.lights.new('Arc light', 'POINT')
lt.color, lt.energy, lt.shadow_soft_size = (0.74, 0.84, 1.0), 0.0, 0.06
lo = bpy.data.objects.new('Arc light', lt)
COLL.objects.link(lo)
lo.location = fx.polar(2.24, fx.ch.BRUSH_AZ + 14.0, fx.RISER_TOP + 0.10)
lo.hide_render = True
V3['arcLight'] = lo.name

# ------------------------------------------------------------------ 2. incandescent particles
for j, sp in enumerate(fx.spark_events()):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=0.028)
    me = bpy.data.meshes.new(f'Brake particle {j:02d}')
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(me.name, me)
    COLL.objects.link(o)
    me.materials.append(EMBER)
    o.color = (0, 0, 0, 1)
    o.hide_render = True
    o.location = sp['samples'][0][1:]
    o.cycles.motion_steps = 2
    V3['sparks'].append(o.name)

ht = bpy.data.lights.new('Radiant brake heat', 'POINT')
ht.color, ht.energy, ht.shadow_soft_size = (1.0, 0.36, 0.10), 0.0, 0.18
ho = bpy.data.objects.new('Radiant brake heat', ht)
COLL.objects.link(ho)
ho.location = fx.polar(2.88, fx.VISIBLE_CALIPER + 4.5, 0.74)   # hot pad face, under the plume
ho.hide_render = True
V3['heatLight'] = ho.name


# ------------------------------------------------------------------ 3. vapor volume
def vapor_material():
    m = bpy.data.materials.new('Brake vapor')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    vol = nt.nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Color'].default_value = (0.90, 0.91, 0.93, 1)
    vol.inputs['Anisotropy'].default_value = 0.45
    nt.links.new(vol.outputs[0], out.inputs['Volume'])
    vals = {}
    for key, v in (('age', 0.0), ('envelope', 0.0), ('front', 0.0)):
        n = nt.nodes.new('ShaderNodeValue')
        n.name = n.label = key
        n.outputs[0].default_value = v
        vals[key] = n.outputs[0]

    def M(op, a, b=None, clamp=False):
        n = nt.nodes.new('ShaderNodeMath')
        n.operation, n.use_clamp = op, clamp
        for idx, x in enumerate((a, b)):
            if x is None:
                continue
            if isinstance(x, (int, float)):
                n.inputs[idx].default_value = x
            else:
                nt.links.new(x, n.inputs[idx])
        return n.outputs[0]

    def SMOOTH(x, lo_, hi_):
        n = nt.nodes.new('ShaderNodeMapRange')
        n.interpolation_type = 'SMOOTHSTEP'
        nt.links.new(x, n.inputs['Value'])
        for k_, v_ in (('From Min', lo_), ('From Max', hi_)):
            if isinstance(v_, (int, float)):
                n.inputs[k_].default_value = v_
            else:
                nt.links.new(v_, n.inputs[k_])
        return n.outputs['Result']

    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs['Vector'])
    x, y, z = sep.outputs['X'], sep.outputs['Y'], sep.outputs['Z']
    age = vals['age']
    h = M('DIVIDE', z, 2.8)
    # The plume rises, sways, and leans with the rotor's windage: counter-clockwise, the
    # direction of rotation, i.e. along the tangent at the caliper (world-aligned domain).
    tx, ty = -math.sin(math.radians(fx.VISIBLE_CALIPER + 4.0)), math.cos(math.radians(fx.VISIBLE_CALIPER + 4.0))
    lean = M('MULTIPLY', M('POWER', h, 1.3), 0.95)
    sway_x = M('MULTIPLY', M('SINE', M('SUBTRACT', M('MULTIPLY', z, 2.3), M('MULTIPLY', age, 2.6))), 0.07)
    sway_y = M('MULTIPLY', M('SINE', M('ADD', M('MULTIPLY', z, 1.6), M('MULTIPLY', age, 1.9))), 0.07)
    xa = M('ADD', M('MULTIPLY', lean, tx), sway_x)
    ya = M('ADD', M('MULTIPLY', lean, ty), sway_y)
    dx, dy = M('SUBTRACT', x, xa), M('SUBTRACT', y, ya)
    rho2 = M('ADD', M('MULTIPLY', dx, dx), M('MULTIPLY', dy, dy))
    R = M('ADD', 0.07, M('MULTIPLY', h, 0.36))
    radial = M('EXPONENT', M('MULTIPLY', M('DIVIDE', rho2, M('MULTIPLY', R, R)), -1.0))
    base = SMOOTH(z, 0.0, 0.10)
    top = M('SUBTRACT', 1.0, SMOOTH(z, M('SUBTRACT', vals['front'], 0.35), vals['front']))
    fade = M('EXPONENT', M('MULTIPLY', z, -1.0 / 1.6))
    # Turbulence carried upward with the flow, evolving in time (4D noise, fixed pattern).
    adv = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(x, adv.inputs['X'])
    nt.links.new(y, adv.inputs['Y'])
    nt.links.new(M('SUBTRACT', z, M('MULTIPLY', age, 1.1)), adv.inputs['Z'])
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.noise_dimensions = '4D'
    nz.inputs['Scale'].default_value = 4.6
    nz.inputs['Detail'].default_value = 4.0
    nz.inputs['Roughness'].default_value = 0.6
    nz.inputs['Distortion'].default_value = 0.7
    nt.links.new(adv.outputs['Vector'], nz.inputs['Vector'])
    nt.links.new(M('MULTIPLY', age, 0.7), nz.inputs['W'])
    wisp = M('MULTIPLY', M('SUBTRACT', nz.outputs['Fac'], 0.40), 3.2, clamp=True)
    shape = M('MULTIPLY', M('MULTIPLY', radial, base), M('MULTIPLY', top, fade))
    dens = M('MULTIPLY', M('MULTIPLY', shape, wisp), M('MULTIPLY', vals['envelope'], 60.0))
    nt.links.new(dens, vol.inputs['Density'])
    return m


bm = bmesh.new()
_tx, _ty = -math.sin(math.radians(fx.VISIBLE_CALIPER + 4.0)), math.cos(math.radians(fx.VISIBLE_CALIPER + 4.0))
bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((0.45 * _tx, 0.45 * _ty, 1.4)) @ Matrix.Diagonal((2.4, 2.4, 2.8, 1)))
me = bpy.data.meshes.new('Brake vapor domain')
bm.to_mesh(me)
bm.free()
vo = bpy.data.objects.new('Brake vapor', me)
COLL.objects.link(vo)
vo.location = fx.VAPOR_BASE
vmat = vapor_material()
me.materials.append(vmat)
vo.hide_render = True
V3['vapor'] = vo.name
V3['vaporMaterial'] = vmat.name

META['v3'] = V3
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'resonator.json').write_text(json.dumps(META, indent=1) + '\n')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'resonator-v3.blend'), compress=True)
print('SCENE V3', OUT / 'resonator-v3.blend', len(V3['arcs']), 'arcs', len(V3['sparks']), 'particles')
