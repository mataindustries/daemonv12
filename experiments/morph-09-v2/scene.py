"""MORPH//09 V2 — build the resonator: geometry, materials, studio light and camera.

    /opt/bpyenv/bin/python experiments/morph-09-v2/scene.py            # bpy 4.3.0 module
    blender -b -P experiments/morph-09-v2/scene.py                      # or a Blender 4.3 binary

Writes work/morph-09-v2/resonator.blend and resonator.json (the names render.py animates).
Watch-scale construction: the commutator drum is 4.1 units across (think millimetres); the
camera works it like a macro lens. Nothing here moves: choreography.py and render.py do that.
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
import choreography as ch  # noqa: E402

OUT = ROOT / 'work' / 'morph-09-v2'
TAU = math.tau
rad = math.radians

# ------------------------------------------------------------------ reset
bpy.ops.wm.read_factory_settings(use_empty=True)
S = bpy.context.scene
COLL = S.collection
META = {'tines': [], 'riders': [], 'coils': [], 'forks': [], 'arms': [], 'pads': [], 'windings': [],
        'jaws': [], 'heat': [], 'rotorMeshes': []}


# ------------------------------------------------------------------ materials
def principled(name, base, metal=0.0, rough=0.3, aniso=0.0, aniso_rot=0.0, coat=0.0, film=0.0,
               film_ior=2.0, emit=None, transmission=0.0, ior=1.5, noise=0.0, radial=False, spec=0.5,
               sss=0.0, bands=0.0, glow=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bs = nt.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (*base, 1)
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Anisotropic'].default_value = aniso
    bs.inputs['Anisotropic Rotation'].default_value = aniso_rot
    bs.inputs['Coat Weight'].default_value = coat
    bs.inputs['Coat Roughness'].default_value = 0.04
    bs.inputs['Thin Film Thickness'].default_value = film
    bs.inputs['Thin Film IOR'].default_value = film_ior
    bs.inputs['Transmission Weight'].default_value = transmission
    bs.inputs['IOR'].default_value = ior
    bs.inputs['Specular IOR Level'].default_value = spec
    bs.inputs['Subsurface Weight'].default_value = sss
    bs.inputs['Subsurface Radius'].default_value = (0.08, 0.06, 0.04)
    if emit:
        bs.inputs['Emission Color'].default_value = (*emit, 1)
        bs.inputs['Emission Strength'].default_value = 0.0
    if glow:
        # Per-object light: render.py keys each object's colour; black is dark.
        oi = nt.nodes.new('ShaderNodeObjectInfo')
        nt.links.new(oi.outputs['Color'], bs.inputs['Emission Color'])
        bs.inputs['Emission Strength'].default_value = glow
    if aniso and radial:
        tg = nt.nodes.new('ShaderNodeTangent')
        tg.direction_type = 'RADIAL'
        tg.axis = 'Z'
        nt.links.new(tg.outputs['Tangent'], bs.inputs['Tangent'])
    if noise or bands:
        # Machining variation: fine noise in roughness, optional turned bands.
        tc = nt.nodes.new('ShaderNodeTexCoord')
        mr = nt.nodes.new('ShaderNodeMapRange')
        mr.inputs['To Min'].default_value = rough * (1 - noise)
        mr.inputs['To Max'].default_value = rough * (1 + noise)
        if bands:
            wv = nt.nodes.new('ShaderNodeTexWave')
            wv.wave_type = 'RINGS'
            wv.rings_direction = 'Z' if radial else 'SPHERICAL'
            wv.inputs['Scale'].default_value = bands
            wv.inputs['Distortion'].default_value = 0.6
            wv.inputs['Detail'].default_value = 1.0
            nt.links.new(tc.outputs['Object'], wv.inputs['Vector'])
            nt.links.new(wv.outputs['Fac'], mr.inputs['Value'])
        else:
            nz = nt.nodes.new('ShaderNodeTexNoise')
            nz.inputs['Scale'].default_value = 40.0
            nz.inputs['Detail'].default_value = 6.0
            nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
            nt.links.new(nz.outputs['Fac'], mr.inputs['Value'])
        nt.links.new(mr.outputs['Result'], bs.inputs['Roughness'])
    return m


def emissive(name, gain):
    """Pure emitter whose colour and intensity come from the keyed object colour."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    oi = nt.nodes.new('ShaderNodeObjectInfo')
    nt.links.new(oi.outputs['Color'], em.inputs['Color'])
    em.inputs['Strength'].default_value = gain
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    return m


def commutator_copper(name, z0, z1):
    """Machined copper bar with the darker, burnished track the brush wears into it."""
    m = principled(name, (0.80, 0.42, 0.27), 1.0, 0.18, 0.55, 0.25)
    nt = m.node_tree
    bs = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs['Vector'])
    lo = nt.nodes.new('ShaderNodeMapRange')
    hi = nt.nodes.new('ShaderNodeMapRange')
    for node, a, b in ((lo, z0 - 0.03, z0 + 0.03), (hi, z1 + 0.03, z1 - 0.03)):
        node.interpolation_type = 'SMOOTHSTEP'
        node.inputs['From Min'].default_value = a
        node.inputs['From Max'].default_value = b
        nt.links.new(sep.outputs['Z'], node.inputs['Value'])
    band = nt.nodes.new('ShaderNodeMath')
    band.operation = 'MULTIPLY'
    nt.links.new(lo.outputs['Result'], band.inputs[0])
    nt.links.new(hi.outputs['Result'], band.inputs[1])
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 3.0
    nz.inputs['Detail'].default_value = 3.0
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    rough = nt.nodes.new('ShaderNodeMapRange')
    rough.inputs['To Min'].default_value = 0.20
    rough.inputs['To Max'].default_value = 0.07
    nt.links.new(band.outputs['Value'], rough.inputs['Value'])
    nt.links.new(rough.outputs['Result'], bs.inputs['Roughness'])
    col = nt.nodes.new('ShaderNodeMix')
    col.data_type = 'RGBA'
    col.inputs['A'].default_value = (0.82, 0.44, 0.28, 1)
    col.inputs['B'].default_value = (0.55, 0.25, 0.14, 1)
    fac = nt.nodes.new('ShaderNodeMath')
    fac.operation = 'MULTIPLY'
    nt.links.new(band.outputs['Value'], fac.inputs[0])
    nt.links.new(nz.outputs['Fac'], fac.inputs[1])
    nt.links.new(fac.outputs['Value'], col.inputs['Factor'])
    nt.links.new(col.outputs['Result'], bs.inputs['Base Color'])
    return m


MAT = {
    'copper': principled('Machined copper', (0.80, 0.42, 0.27), 1.0, 0.16, 0.55, 0.25, noise=0.35),
    'bar': commutator_copper('Commutator bar copper', 0.78, 1.22),
    'copper_turned': principled('Turned copper flange', (0.83, 0.47, 0.32), 1.0, 0.20, 0.8, 0.0, radial=True, bands=55.0, noise=0.3),
    'winding': principled('Enamelled copper winding', (0.55, 0.20, 0.10), 1.0, 0.24, coat=0.6, noise=0.5),
    'drive': principled('Energised drive winding', (0.55, 0.20, 0.10), 1.0, 0.24, coat=0.6, noise=0.5, glow=1.0),
    'titanium': principled('Brushed grade-5 titanium', (0.56, 0.53, 0.50), 1.0, 0.24, 0.75, 0.0, radial=True, noise=0.25),
    'disc_rim': principled('Brake disc rim titanium', (0.56, 0.53, 0.50), 1.0, 0.24, 0.75, 0.0, radial=True, noise=0.25,
                           glow=1.0),
    'titanium_lin': principled('Linear-grained titanium', (0.56, 0.53, 0.50), 1.0, 0.22, 0.7, 0.0, noise=0.25),
    'gunmetal': principled('Gunmetal PVD deck', (0.075, 0.078, 0.085), 1.0, 0.30, 0.85, 0.0, radial=True, bands=7.0, noise=0.25),
    'steel': principled('Polished spring steel', (0.78, 0.78, 0.77), 1.0, 0.07),
    'fork': principled('Nickel-silver tine', (0.80, 0.78, 0.72), 1.0, 0.10, 0.45, 0.25, noise=0.3),
    'brass': principled('Gilded brass', (0.92, 0.70, 0.40), 1.0, 0.18, noise=0.2),
    'alumina': principled('Alumina ceramic', (0.80, 0.77, 0.70), 0.0, 0.38, coat=0.25, sss=0.12),
    'zirconia': principled('Black zirconia ceramic', (0.012, 0.012, 0.014), 0.0, 0.10, coat=1.0, spec=0.6),
    'mica': principled('Amber mica insulation', (0.10, 0.045, 0.018), 0.0, 0.22, coat=0.5),
    'graphite': principled('Copper-graphite brush', (0.06, 0.055, 0.052), 0.45, 0.42, noise=0.6),
    'blued': principled('Heat-blued screw steel', (0.55, 0.56, 0.60), 1.0, 0.12, film=290.0, film_ior=2.4),
    'ruby': principled('Synthetic ruby jewel', (0.85, 0.04, 0.08), 0.0, 0.0, transmission=1.0, ior=1.77),
    'floor': principled('Slate table', (0.006, 0.0065, 0.0075), 0.0, 0.62, spec=0.18, noise=0.4),
    'pad': principled('Sintered brake pad', (0.09, 0.07, 0.06), 0.4, 0.6, glow=1.0),
    'arc': emissive('Keyed emitter', 1.0),
    'engrave': principled('Engraved line', (0.30, 0.29, 0.28), 1.0, 0.45),
}


# ------------------------------------------------------------------ geometry helpers
def finish(name, bm, mat, parent=None, bevel=0.0, segments=3, smooth=True, loc=None, angle=35):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    o = bpy.data.objects.new(name, me)
    COLL.objects.link(o)
    me.materials.append(mat)
    if bevel:
        b = o.modifiers.new('Machined edge', 'BEVEL')
        b.width = bevel
        b.segments = segments
        b.limit_method = 'ANGLE'
        b.angle_limit = rad(angle)
        b.harden_normals = True
    if parent:
        o.parent = parent
    if loc:
        o.location = loc
    return o


def bm_cylinder(r, z0, z1, segs=96, r_top=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r,
                          radius2=r if r_top is None else r_top, depth=z1 - z0,
                          matrix=Matrix.Translation((0, 0, (z0 + z1) / 2)))
    return bm


def cylinder(name, r, z0, z1, mat, parent=None, segs=96, bevel=0.02, loc=None, r_top=None):
    return finish(name, bm_cylinder(r, z0, z1, segs, r_top), mat, parent, bevel, loc=loc)


def bm_box(center, size, rot_z=0.0):
    bm = bmesh.new()
    m = Matrix.Translation(center) @ Matrix.Rotation(rot_z, 4, 'Z') @ Matrix.Diagonal((*size, 1))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    return bm


def box(name, center, size, mat, parent=None, bevel=0.02, rot_z=0.0):
    return finish(name, bm_box(center, size, rot_z), mat, parent, bevel)


def bm_sector(r1, r2, z0, z1, a0, a1, segs=24):
    """Closed annular sector solid (angles in radians)."""
    bm = bmesh.new()
    full = abs(a1 - a0) >= TAU - 1e-9
    n = segs if full else segs + 1
    rings = []
    for z in (z0, z1):
        for r in (r1, r2):
            rings.append([bm.verts.new((r * math.cos(a0 + (a1 - a0) * i / segs),
                                        r * math.sin(a0 + (a1 - a0) * i / segs), z)) for i in range(n)])
    bi, bo, ti, to = rings
    for i in range(segs):
        j = (i + 1) % n
        bm.faces.new((bi[i], bi[j], bo[j], bo[i]))      # bottom
        bm.faces.new((ti[i], to[i], to[j], ti[j]))      # top
        bm.faces.new((bo[i], bo[j], to[j], to[i]))      # outer
        bm.faces.new((bi[i], ti[i], ti[j], bi[j]))      # inner
    if not full:
        bm.faces.new((bi[0], bo[0], to[0], ti[0]))
        k = n - 1
        bm.faces.new((bi[k], ti[k], to[k], bo[k]))
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def sector(name, r1, r2, z0, z1, a0, a1, mat, parent=None, segs=24, bevel=0.012):
    return finish(name, bm_sector(r1, r2, z0, z1, a0, a1, segs), mat, parent, bevel)


def sphere(name, r, center, mat, parent=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=r, matrix=Matrix.Translation(center))
    return finish(name, bm, mat, parent)


def tube(name, points, r, mat, parent=None, closed=False, res=4):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = r
    cu.bevel_resolution = res
    cu.use_fill_caps = True
    sp = cu.splines.new('NURBS')
    sp.points.add(len(points) - 1)
    for p, co in zip(sp.points, points):
        p.co = (*co, 1)
    sp.use_endpoint_u = True
    sp.order_u = 3
    sp.use_cyclic_u = closed
    sp.resolution_u = 12
    o = bpy.data.objects.new(name, cu)
    COLL.objects.link(o)
    cu.materials.append(mat)
    if parent:
        o.parent = parent
    return o


def empty(name, loc=(0, 0, 0), parent=None, rot=None):
    o = bpy.data.objects.new(name, None)
    COLL.objects.link(o)
    o.location = loc
    if rot is not None:
        o.rotation_euler = rot
    if parent:
        o.parent = parent
    return o


def polar(r, az_deg, z=0.0):
    a = rad(az_deg)
    return (r * math.cos(a), r * math.sin(a), z)


def screw(name, loc, r=0.1, parent=None, rot_z=0.0):
    h = cylinder(name, r, loc[2], loc[2] + 0.06, MAT['blued'], parent, 32, 0.012, )
    h.location = (loc[0], loc[1], 0)
    slot = box(name + ' slot', (loc[0], loc[1], loc[2] + 0.061), (r * 1.7, r * 0.22, 0.03), MAT['zirconia'], parent, 0.004, rot_z)
    return h, slot


# ------------------------------------------------------------------ table, deck, chapter ring
Z_FLY = (0.30, 0.46)          # flywheel / brake disc, under the drum
Z_BAR = (0.56, 1.44)          # commutator bars
BRUSH_Z = 1.00
floor = finish('Slate table', bm_box((0, 0, -0.62), (400, 400, 0.2)), MAT['floor'], bevel=0, smooth=False)
cylinder('Gunmetal deck', 6.7, -0.52, 0.0, MAT['gunmetal'], segs=192, bevel=0.07)
cylinder('Deck polished chamfer ring', 6.76, -0.50, -0.06, MAT['titanium'], segs=192, bevel=0.03)
finish('Black zirconia resonance plinth', bm_sector(4.25, 5.25, 0.0, 0.11, 0, TAU, 160), MAT['zirconia'], bevel=0.02)
finish('Chapter ring', bm_sector(2.95, 3.25, 0.0, 0.035, 0, TAU, 160), MAT['titanium_lin'], bevel=0.008)
for k in range(64):
    a = k * 360 / 64 + ch.BRUSH_AZ
    major = k % 4 == 0
    L = 0.17 if major else 0.08
    c = polar(3.23 - L / 2 - 0.02, a, 0.037)
    box('Chapter tick', c, (L, 0.016 if not major else 0.024, 0.006), MAT['engrave'], bevel=0.0, rot_z=rad(a))
cylinder('Lower bearing boss', 0.62, 0.0, 0.26, MAT['titanium'], segs=64, bevel=0.03)
cylinder('Lower jewel chaton', 0.26, 0.26, 0.31, MAT['brass'], segs=48, bevel=0.01)

# ------------------------------------------------------------------ rotor
suspension = empty('Axial kick suspension')
rotor = empty('Telemetry rotor', parent=suspension)
META['suspension'], META['rotor'] = suspension.name, rotor.name


def rotor_part(o):
    META['rotorMeshes'].append(o.name)
    return o


# Slotted brake disc: 24 windows make its speed legible until they smear.
rotor_part(finish('Brake disc web', bm_sector(0.55, 2.20, *Z_FLY, 0, TAU, 160), MAT['titanium'], rotor, 0.02))
disc_rim = rotor_part(finish('Brake disc rim', bm_sector(2.56, 2.80, *Z_FLY, 0, TAU, 160), MAT['disc_rim'], rotor, 0.02))
META['discRim'] = disc_rim.name
for k in range(24):
    a = k * 15.0
    rotor_part(sector('Brake disc rib', 2.18, 2.58, Z_FLY[0] + 0.02, Z_FLY[1] - 0.02, rad(a - 3.6), rad(a + 3.6),
                      MAT['titanium'], rotor, 4, 0.01))
rotor_part(finish('Copper drum seat', bm_sector(1.80, 2.16, Z_FLY[1], Z_FLY[1] + 0.08, 0, TAU, 128), MAT['copper_turned'], rotor, 0.015))
rotor_part(cylinder('Mica core', 1.87, Z_FLY[1], 1.52, MAT['mica'], rotor, 128, 0.01))
half = rad(360 / ch.CONTACTS) / 2
for k in range(ch.CONTACTS):
    a = rad(ch.BRUSH_AZ) - k * TAU / ch.CONTACTS        # contact k under the brush at angle k/16
    rotor_part(sector(f'Commutator bar {k:02d}', 1.80, ch.DRUM_R, *Z_BAR, a - half * 0.88, a + half * 0.88,
                      MAT['bar'], rotor, 14, 0.008))
    # Slotted riser: two cheeks with the armature wire soldered between them.
    for side in (-1, 1):
        c0 = a + side * half * 0.10
        rotor_part(sector(f'Riser cheek {k:02d}', 1.98, 2.24, Z_BAR[1] - 0.06, Z_BAR[1] + 0.07,
                          min(c0, c0 + side * half * 0.24), max(c0, c0 + side * half * 0.24), MAT['copper'], rotor, 4, 0.008))
    ca, sa = math.cos(a), math.sin(a)
    rotor_part(tube(f'Armature wire {k:02d}', [(0.62 * ca, 0.62 * sa, 1.60), (1.40 * ca, 1.40 * sa, 1.63),
                                              (1.95 * ca, 1.95 * sa, 1.60), (2.16 * ca, 2.16 * sa, Z_BAR[1] + 0.03)],
                    0.032, MAT['winding'], rotor, res=2))
rotor_part(finish('Titanium clamp ring', bm_sector(1.50, 1.93, 1.50, 1.555, 0, TAU, 128), MAT['titanium'], rotor, 0.015))
rotor_part(cylinder('Turned copper end plate', 1.50, 1.47, 1.53, MAT['copper_turned'], rotor, 128, 0.01))
rotor_part(cylinder('Polished arbor', 0.15, 0.20, 3.20, MAT['steel'], rotor, 48, 0.01))
# Spring governor, wound to read pitch (choreography.governor): three flyweights.
gov_z = 2.85
META['governor'] = {'restDeg': 22.0, 'travelDeg': 56.0, 'sleeveZ': 2.08, 'sleeveTravel': 0.42}
rotor_part(cylinder('Governor head', 0.25, gov_z - 0.07, gov_z + 0.07, MAT['brass'], rotor, 48, 0.015))
sleeve = cylinder('Governor sleeve', 0.23, -0.09, 0.09, MAT['brass'], rotor, 48, 0.015)
sleeve.location.z = META['governor']['sleeveZ']
META['sleeve'] = sleeve.name
rotor_part(sleeve)
for k in range(3):
    a = k * 120 + 30
    pivot = empty(f'Governor pivot {k}', polar(0.22, a, gov_z), rotor, rot=(0, 0, rad(a)))
    arm = empty(f'Governor arm {k}', parent=pivot)          # rotates about local Y (tangent)
    rotor_part(tube(f'Governor rod {k}', [(0, 0, 0), (0, 0, -0.46), (0, 0, -0.92)], 0.035, MAT['steel'], arm))
    rotor_part(sphere(f'Governor flyweight {k}', 0.19, (0, 0, -0.97), MAT['steel'], arm))
    META['arms'].append(arm.name)
rotor_part(cylinder('Cap jewel chaton', 0.24, 3.14, 3.30, MAT['brass'], rotor, 48, 0.02))
rotor_part(sphere('Cap ruby jewel', 0.13, (0, 0, 3.31), MAT['ruby'], rotor))

# ------------------------------------------------------------------ brush (fixed, recoils)
brush = empty('Brush recoil', polar(3.30, ch.BRUSH_AZ, BRUSH_Z), rot=(0, 0, rad(ch.BRUSH_AZ)))
META['brush'] = brush.name
# Local frame of the brush: +X radial outward, +Y tangential (rotor direction), +Z up.
# The brush face is worn to the drum radius, as a real brush beds in.
bb = bm_sector(ch.DRUM_R + 0.012, 2.70, -0.18, 0.18, rad(-4.3), rad(4.3), 8)
bmesh.ops.translate(bb, verts=bb.verts, vec=(-3.30, 0, 0))
finish('Copper-graphite brush', bb, MAT['graphite'], brush, 0.018)
box('Brush holder', (-0.40, 0, 0), (0.60, 0.42, 0.50), MAT['alumina'], brush, 0.05)
for sz in (-1, 1):
    box('Holder brass rail', (-0.40, 0, sz * 0.262), (0.64, 0.46, 0.04), MAT['brass'], brush, 0.012)
box('Titanium brush arm', (0.12, 0, 0.05), (0.62, 0.30, 0.26), MAT['titanium_lin'], brush, 0.05)
tube('Constant-force spring', [(-0.70, 0, 0.30), (-0.55, 0, 0.52), (-0.20, 0, 0.62), (0.15, 0, 0.45)], 0.03, MAT['blued'], brush)
tube('Braided shunt', [(-0.78, 0.17, 0.12), (-0.62, 0.42, 0.25), (-0.30, 0.55, 0.18), (0.05, 0.42, -0.18),
                        (0.30, 0.30, -0.42)], 0.04, MAT['copper'], brush)
arc_bm = bm_sector(ch.DRUM_R + 0.004, ch.DRUM_R + 0.016, -0.17, 0.17, rad(-4.6), rad(-4.1), 2)
bmesh.ops.translate(arc_bm, verts=arc_bm.verts, vec=(-3.30, 0, 0))
arc = finish('Commutation arc', arc_bm, MAT['arc'], brush)
META['arc'] = arc.name
cylinder('Brush pivot post', 0.34, 0.0, BRUSH_Z + 0.32, MAT['alumina'], segs=64, bevel=0.06, loc=polar(3.62, ch.BRUSH_AZ))
cylinder('Brush pivot cap', 0.36, BRUSH_Z + 0.32, BRUSH_Z + 0.41, MAT['zirconia'], segs=64, bevel=0.02, loc=polar(3.62, ch.BRUSH_AZ))
screw('Brush pivot screw', (*polar(3.62, ch.BRUSH_AZ)[:2], BRUSH_Z + 0.41), 0.12)

# ------------------------------------------------------------------ hat escapement (tick-tock)
esc_az = ch.BRUSH_AZ + 24
esc = empty('Hat escapement anchor', polar(3.05, esc_az, 1.16), rot=(0, 0, rad(esc_az + 180)))
META['pallet'] = esc.name
cylinder('Escapement arbor', 0.06, -1.16, 0.12, MAT['steel'], esc, 24, 0.0)
box('Anchor body', (0.30, 0, 0), (0.60, 0.10, 0.05), MAT['steel'], esc, 0.012)
for s in (-1, 1):
    box('Anchor arm', (0.62, s * 0.16, 0), (0.08, 0.36, 0.05), MAT['steel'], esc, 0.012)
    box('Ruby pallet stone', (0.70, s * 0.30, 0), (0.12, 0.05, 0.07), MAT['ruby'], esc, 0.006)
cylinder('Escapement cock', 0.16, 0.0, 1.06, MAT['titanium'], segs=48, bevel=0.03, loc=polar(3.05, esc_az))

# ------------------------------------------------------------------ clap jaws
box('Clap anvil', polar(3.30, ch.GAP_CLAP, 0.42), (0.30, 0.16, 0.84), MAT['alumina'], bevel=0.04, rot_z=rad(ch.GAP_CLAP))
for s in (-1, 1):
    j = empty(f'Clap jaw {s:+d}', polar(3.30, ch.GAP_CLAP, 0.0), rot=(0, 0, rad(ch.GAP_CLAP)))
    box('Jaw block', (0, s * 0.42, 0.44), (0.42, 0.30, 0.76), MAT['titanium_lin'], j, 0.05)
    box('Jaw copper face', (0, s * 0.27, 0.44), (0.34, 0.03, 0.60), MAT['copper'], j, 0.01)
    META['jaws'].append(j.name)

# ------------------------------------------------------------------ brake calipers on the disc rim
zc = sum(Z_FLY) / 2
for i, az in enumerate(ch.GAP_CALIPERS):
    cal = empty(f'Brake caliper {i}', (0, 0, 0), rot=(0, 0, rad(az)))
    box('Caliper yoke', (3.06, 0, zc), (0.44, 0.66, 0.74), MAT['zirconia'], cal, 0.06)
    w = box('Caliper winding', (3.06, 0, zc + 0.44), (0.38, 0.56, 0.16), MAT['drive'], cal, 0.04)
    META['windings'].append(w.name)
    for s in (-1, 1):
        pad = box(f'Brake pad {i}{s:+d}', (2.69, 0, zc + s * 0.14), (0.32, 0.40, 0.06), MAT['pad'], cal, 0.015)
        META['pads'].append(pad.name)
        box('Pad carrier', (2.86, 0, zc + s * 0.24), (0.52, 0.46, 0.12), MAT['zirconia'], cal, 0.03)

# ------------------------------------------------------------------ bass tension hoop
hoop = finish('Bass tension hoop', bm_sector(4.04, 4.13, 0.16, 0.27, 0, TAU, 192), MAT['steel'], bevel=0.02)
META['hoop'] = hoop.name
for k in range(10):
    a = k * 36 + 9
    cylinder('Hoop standoff', 0.07, 0.0, 0.18, MAT['alumina'], segs=24, bevel=0.01, loc=polar(4.085, a))

# ------------------------------------------------------------------ sung reed
reed_root = empty('Sung reed', polar(3.42, ch.GAP_REED, 0.0), rot=(0, 0, rad(ch.GAP_REED + 90)))
META['reed'] = reed_root.name
reed = empty('Sung reed bow', parent=reed_root)
pts = [(-1.15 + 2.3 * j / 16, 0.0, 0.42 + 0.38 * math.sin(math.pi * j / 16)) for j in range(17)]
tube('Silver reed', pts, 0.05, MAT['fork'], reed)
for s in (-1, 1):
    box('Reed mount', (s * 1.18, 0, 0.22), (0.24, 0.24, 0.44), MAT['alumina'], reed_root, 0.04)
META['reedBow'] = reed.name

# ------------------------------------------------------------------ five tuning forks
for i, (az, L) in enumerate(zip(ch.FORK_AZ, ch.FORK_LEN)):
    base = empty(f'Fork {i}', polar(ch.FORK_R, az, 0.0), rot=(0, 0, rad(az + 90)))
    META['forks'].append(base.name)
    # Local frame: +X tangential (tines side by side), +Y radial inward, +Z up.
    box('Alumina pedestal', (0, 0, 0.36), (1.55, 1.10, 0.50), MAT['alumina'], base, 0.10)
    box('Zirconia cap', (0, 0, 0.65), (1.38, 0.95, 0.08), MAT['zirconia'], base, 0.025)
    for s in (-1, 1):
        screw('Pedestal screw', (s * 0.56, -0.25, 0.69), 0.09, base)
    cylinder('Fork stem', 0.15, 0.69, 1.32, MAT['steel'], base, 32, 0.015)
    coil = cylinder(f'Drive coil {i}', 0.30, 0.78, 1.18, MAT['drive'], base, 48, 0.03)
    META['coils'].append(coil.name)
    for z in (0.76, 1.20):
        cylinder('Coil flange', 0.37, z - 0.03, z + 0.03, MAT['zirconia'], base, 48, 0.01)
    yoke_z = 1.44
    pts = [(-0.42, 0, yoke_z + 0.16), (-0.42, 0, yoke_z - 0.16), (0, 0, yoke_z - 0.27), (0.42, 0, yoke_z - 0.16),
           (0.42, 0, yoke_z + 0.16)]
    tube('Fork yoke', pts, 0.15, MAT['fork'], base)
    for s in (-1, 1):
        pivot = empty(f'Tine pivot {i}{s:+d}', (s * 0.42, 0, yoke_z + 0.14), base)
        box('Tine', (0, 0, L / 2), (0.28, 0.33, L), MAT['fork'], pivot, 0.11)
        rider = empty(f'Tuning rider {i}{s:+d}', parent=pivot)
        box('Rider', (0, 0, 0), (0.40, 0.45, 0.30), MAT['brass'], rider, 0.045)
        box('Rider screw', (s * 0.205, 0, 0), (0.035, 0.14, 0.14), MAT['blued'], rider, 0.012)
        META['tines'].append(pivot.name)
        META['riders'].append(rider.name)

# ------------------------------------------------------------------ light
world = bpy.data.worlds.new('Studio dark')
S.world = world
world.use_nodes = True
wn = world.node_tree
wn.nodes.clear()
w_out = wn.nodes.new('ShaderNodeOutputWorld')
w_lp = wn.nodes.new('ShaderNodeLightPath')
w_mix = wn.nodes.new('ShaderNodeMixShader')
w_cam = wn.nodes.new('ShaderNodeBackground')
w_cam.inputs['Color'].default_value = (0.0028, 0.0032, 0.0040, 1)
w_env = wn.nodes.new('ShaderNodeBackground')
w_tc = wn.nodes.new('ShaderNodeTexCoord')
w_sep = wn.nodes.new('ShaderNodeSeparateXYZ')
w_ramp = wn.nodes.new('ShaderNodeValToRGB')
cr = w_ramp.color_ramp
cr.elements[0].position, cr.elements[0].color = 0.0, (0.004, 0.004, 0.005, 1)
cr.elements[1].position, cr.elements[1].color = 1.0, (0.020, 0.024, 0.030, 1)
for pos, col in ((0.49, (0.004, 0.004, 0.005, 1)), (0.56, (0.10, 0.09, 0.08, 1)), (0.64, (0.14, 0.15, 0.16, 1)),
                 (0.78, (0.015, 0.018, 0.024, 1))):
    e = cr.elements.new(pos)
    e.color = col
w_map = wn.nodes.new('ShaderNodeMapRange')
w_map.inputs['From Min'].default_value = -1.0
w_map.inputs['From Max'].default_value = 1.0
wn.links.new(w_tc.outputs['Generated'], w_sep.inputs['Vector'])
wn.links.new(w_sep.outputs['Z'], w_map.inputs['Value'])
wn.links.new(w_map.outputs['Result'], w_ramp.inputs['Fac'])
wn.links.new(w_ramp.outputs['Color'], w_env.inputs['Color'])
wn.links.new(w_lp.outputs['Is Camera Ray'], w_mix.inputs['Fac'])
wn.links.new(w_env.outputs['Background'], w_mix.inputs[1])
wn.links.new(w_cam.outputs['Background'], w_mix.inputs[2])
wn.links.new(w_mix.outputs['Shader'], w_out.inputs['Surface'])


def area(name, loc, target, power, color, size, size_y=None, shape='RECTANGLE', spread=180):
    d = bpy.data.lights.new(name, 'AREA')
    d.energy, d.color, d.shape, d.size = power, color, shape, size
    if size_y:
        d.size_y = size_y
    d.spread = rad(spread)
    o = bpy.data.objects.new(name, d)
    COLL.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o


LIGHTS = {
    'key': area('Overhead softbox', (1.5, 3.0, 13.0), (0, 0, 0), 2600, (0.86, 0.92, 1.0), 9, 5),
    'rimA': area('Cool rim strip', (-9.5, 7.5, 3.6), (0, 0, 1.6), 1500, (0.62, 0.80, 1.0), 9, 1.2),
    'rimB': area('Warm rim strip', (9.0, 7.0, 3.0), (0, 0, 1.6), 1300, (1.0, 0.70, 0.45), 9, 1.2),
    'front': area('Low front fill', (-3.5, -11.0, 2.2), (0, 0, 1.2), 520, (0.95, 0.86, 0.78), 8, 3),
}
for n, o in LIGHTS.items():
    META.setdefault('lights', {})[n] = [o.name, o.data.energy]

arc_light = bpy.data.lights.new('Commutation arc light', 'POINT')
arc_light.shadow_soft_size = 0.14
arc_light.color = (1.0, 0.55, 0.25)
arc_light.energy = 0.0
ao = bpy.data.objects.new('Commutation arc light', arc_light)
COLL.objects.link(ao)
ao.location = polar(ch.DRUM_R + 0.06, ch.BRUSH_AZ - 5.4, BRUSH_Z)
META['arcLight'] = ao.name

META['strobe'], META['strobeTube'] = [], []
for i, az in enumerate(ch.FORK_AZ):
    # Each pedestal carries a xenon tube facing the rotor; one contact trigger fires all five.
    base = bpy.data.objects[f'Fork {i}']
    t = box(f'Xenon tube {i}', (0, 0.63, 0.40), (1.10, 0.10, 0.10), MAT['arc'], base, 0.04)
    box('Xenon reflector', (0, 0.575, 0.40), (1.25, 0.04, 0.30), MAT['steel'], base, 0.012)
    META['strobeTube'].append(t.name)
    d = bpy.data.lights.new(f'Lock strobe {i}', 'AREA')
    d.shape, d.size, d.size_y = 'RECTANGLE', 1.10, 0.10
    d.color, d.energy = (0.74, 0.87, 1.0), 0.0
    so = bpy.data.objects.new(d.name, d)
    COLL.objects.link(so)
    so.location = Vector(polar(ch.FORK_R - 0.72, az, 0.40))
    so.rotation_euler = (Vector((0, 0, 1.6)) - so.location).to_track_quat('-Z', 'Z').to_euler()
    META['strobe'].append(so.name)

coil_lights = []
for i, az in enumerate(ch.FORK_AZ):
    d = bpy.data.lights.new(f'Coil glow {i}', 'POINT')
    d.color, d.energy, d.shadow_soft_size = (1.0, 0.45, 0.16), 0.0, 0.15
    o = bpy.data.objects.new(d.name, d)
    COLL.objects.link(o)
    o.location = polar(ch.FORK_R - 0.75, az, 1.0)
    coil_lights.append(o.name)
META['coilLights'] = coil_lights

# ------------------------------------------------------------------ camera
cam_data = bpy.data.cameras.new('Macro camera')
cam_data.sensor_width = 36.0
cam_data.clip_start = 0.02
cam_data.clip_end = 400.0
cam_data.dof.use_dof = True
cam_data.dof.aperture_blades = 7
cam_data.dof.aperture_rotation = rad(12)
cam = bpy.data.objects.new('Macro camera', cam_data)
COLL.objects.link(cam)
S.camera = cam
cam.rotation_mode = 'QUATERNION'
META['camera'] = cam.name

# ------------------------------------------------------------------ render settings
S.render.engine = 'CYCLES'
S.cycles.device = 'CPU'
S.cycles.samples = 32
S.cycles.use_adaptive_sampling = True
S.cycles.adaptive_threshold = 0.04
S.cycles.use_denoising = True
S.cycles.denoiser = 'OPENIMAGEDENOISE'
S.cycles.max_bounces = 6
S.cycles.diffuse_bounces = 2
S.cycles.glossy_bounces = 3
S.cycles.transmission_bounces = 4
S.cycles.transparent_max_bounces = 4
S.cycles.caustics_reflective = False
S.cycles.caustics_refractive = False
S.cycles.sample_clamp_indirect = 6.0
S.cycles.blur_glossy = 0.6
S.render.use_motion_blur = True
S.render.motion_blur_shutter = ch.SHUTTER
S.render.motion_blur_position = 'END'
S.render.fps = ch.FPS
S.render.resolution_x, S.render.resolution_y = 432, 768
S.render.resolution_percentage = 100
S.render.image_settings.file_format = 'PNG'
S.render.image_settings.color_mode = 'RGB'
S.render.film_transparent = False
S.view_settings.view_transform = 'AgX'
S.view_settings.look = 'AgX - Base Contrast'
S.view_settings.exposure = 0.0
S.frame_start, S.frame_end = 1, ch.FRAMES

# Motion steps: the rotor turns up to 165 degrees inside one exposure at 55 rev/s.
for name in META['rotorMeshes']:
    o = bpy.data.objects[name]
    o.cycles.motion_steps = 3

# Optical finish in the compositor: restrained glare on genuine highlights only.
S.use_nodes = True
nt = S.node_tree
nt.nodes.clear()
rl = nt.nodes.new('CompositorNodeRLayers')
gl = nt.nodes.new('CompositorNodeGlare')
gl.glare_type = 'FOG_GLOW'
gl.quality = 'HIGH'
gl.threshold = 1.2
gl.size = 7
gl.mix = -0.72
comp = nt.nodes.new('CompositorNodeComposite')
nt.links.new(rl.outputs['Image'], gl.inputs['Image'])
nt.links.new(gl.outputs['Image'], comp.inputs['Image'])

# Keyed emitters start dark; every other object keeps the default white colour.
for o in bpy.data.objects:
    if o.type in ('MESH', 'CURVE') and any(m and m.name in ('Energised drive winding', 'Sintered brake pad',
                                                                'Keyed emitter', 'Brake disc rim titanium')
                                           for m in o.data.materials):
        o.color = (0, 0, 0, 1)

OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'resonator.json').write_text(json.dumps(META, indent=1) + '\n')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'resonator.blend'), compress=True)
print('SCENE', OUT / 'resonator.blend', len(bpy.data.objects), 'objects')
