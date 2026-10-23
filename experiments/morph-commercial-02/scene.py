"""THE CIRCUIT V2 — scene: V1's procedural circuit, re-seated as the ring engine.

Runs V1's scene.py geometry unchanged (SHA-256 checked), stopping before its camera and
plate renders, then adds V2's moving parts:

- 48 carrier tiles (one shared mesh) on three nested loops of 24, 16 and 8 slots,
- linear-motor rails marking the loops, and the core spine,
- an amber core well beneath the inner loop,
- 56 signal ribbons on V1's routes, with an arc-length attribute for travelling pulses,
- a camera that render.py drives frame by frame from choreography.py.

Writes work/circuit-v2.blend and work/scene-v2.json (or into --work DIR). Blender 4.3, CPU Cycles:
    blender -b --python scene.py        or, with the bpy 4.3.0 module:  python3.11 scene.py
"""
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import choreography as ch  # noqa: E402

V1_SCENE = ch.V1 / 'scene.py'
V1_SCENE_SHA256 = '21900b159b18d94c826c4d83627bbdece18bc8f8d659e869d8edc90448d58c21'
MARKER = "bpy.ops.object.camera_add"


def run_v1_geometry() -> dict:
    source = V1_SCENE.read_bytes()
    assert hashlib.sha256(source).hexdigest() == V1_SCENE_SHA256, 'V1 scene.py changed'
    text = source.decode()
    head = text[:text.index(MARKER)]
    argv = sys.argv
    sys.argv = ['scene.py']
    namespace = {'__file__': str(V1_SCENE), '__name__': 'v1_scene'}
    try:
        exec(compile(head, str(V1_SCENE), 'exec'), namespace)
    finally:
        sys.argv = argv
    return namespace


V1 = run_v1_geometry()
S = bpy.context.scene
COL = V1['COL']

# --- remove what V2 replaces: the fixed die tiles and the static signal channels --------
for o in list(bpy.data.objects):
    if o.name.split('.')[0] in ('silicon compute tile', 'tile copper cap', 'lithographic tile gate',
                                'glass signal channel'):
        bpy.data.objects.remove(o, do_unlink=True)
for o in bpy.data.objects:
    if o.type == 'FONT' and o.data.body == 'M O R P H':
        o.location.y = -0.80  # clears the outer rail; still on the interposer


def emissive(name, base, metal, rough, gain=1.0):
    """Principled material whose emission colour is the object's colour (per-object light)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*base, 1)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    info = nodes.new('ShaderNodeObjectInfo')
    links.new(info.outputs['Color'], bsdf.inputs['Emission Color'])
    value = nodes.new('ShaderNodeValue')
    value.name = 'gain'
    value.outputs[0].default_value = gain
    links.new(value.outputs[0], bsdf.inputs['Emission Strength'])
    return m


window = emissive('carrier window / doped glass', (0.006, 0.014, 0.016), 0.0, 0.38)
window.node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value = 0.15
rail_glass = emissive('motor rail / doped glass', (0.02, 0.05, 0.055), 0.4, 0.2)
well = emissive('core well / amber phosphor', (0.03, 0.012, 0.004), 0.0, 0.45)
bell = emissive('fastener strike', (0.4, 0.45, 0.45), 0.8, 0.25)


def solid(parts, name, coll):
    """Join box parts (with V1's machined bevels applied) into a single mesh object."""
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    for c in list(o.users_collection):
        c.objects.unlink(o)
    COL[coll].objects.link(o)
    return o


box = V1['box']

# --- carrier prototype: V1 tile body, copper rim, doped-glass window, gold lithography ---
parts = [box('carrier body', (0, 0, 0), (0.411, 0.354, 0.12), V1['die'], 0.018, 'core')]
for dx, dy, sx, sy in [(0, 0.1125, 0.30, 0.035), (0, -0.1125, 0.30, 0.035),
                       (0.1325, 0, 0.035, 0.26), (-0.1325, 0, 0.035, 0.26)]:
    parts.append(box('carrier rim', (dx, dy, 0.068), (sx, sy, 0.016), V1['copper'], 0.004, 'core'))
parts.append(box('carrier window', (0, 0, 0.064), (0.232, 0.192, 0.012), window, 0.0, 'core'))
for k in range(5):
    parts.append(box('carrier gate', (0, -0.072 + k * 0.036, 0.0715), (0.22, 0.008, 0.004), V1['gold'], 0.0, 'core'))
proto = solid(parts, 'carrier prototype', 'core')
carrier_mesh = proto.data
bpy.data.objects.remove(proto, do_unlink=True)

rig = bpy.data.objects.new('core rig', None)
COL['core'].objects.link(rig)
for o in list(COL['core'].objects):
    if o is not rig:
        o.parent = rig

carriers = []
for r, path in enumerate(ch.RINGS):
    for k, cell in enumerate(path):
        o = bpy.data.objects.new(f'carrier r{r} k{k:02d}', carrier_mesh)
        COL['core'].objects.link(o)
        o.parent = rig
        x, y = ch.cell_xy(cell)
        o.location = (x, y, ch.TILE_Z)
        o.color = (0, 0, 0, 1)
        carriers.append(o.name)


def frame_rect(name, x0, x1, y0, y1, width=0.022):
    """A rectangular copper rail with a doped-glass strip, as one object."""
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    segs = [((cx, y0), (x1 - x0 + width, width)), ((cx, y1), (x1 - x0 + width, width)),
            ((x0, cy), (width, y1 - y0 - width)), ((x1, cy), (width, y1 - y0 - width))]
    parts = []
    for (x, y), (sx, sy) in segs:
        parts.append(box('rail copper', (x, y, 0.646), (sx, sy, 0.03), V1['copper'], 0.004, 'core'))
        gx, gy = (sx - 0.012, 0.010) if sx > sy else (0.010, sy - 0.012)
        parts.append(box('rail glass', (x, y, 0.6625), (gx, gy, 0.004), rail_glass, 0.0, 'core'))
    o = solid(parts, name, 'core')
    o.parent = rig
    o.color = (0, 0, 0, 1)
    return o.name


rails = [frame_rect('rail outer', -1.38, 1.38, -0.62, 2.62),
         frame_rect('rail middle', -0.92, 0.92, -0.215, 2.215),
         frame_rect('rail inner', -0.46, 0.46, 0.19, 1.81)]
spine_parts = [box('rail copper', (0, 1.0, 0.646), (0.022, 0.80, 0.03), V1['copper'], 0.004, 'core'),
               box('rail glass', (0, 1.0, 0.6625), (0.010, 0.78, 0.004), rail_glass, 0.0, 'core')]
spine = solid(spine_parts, 'rail spine', 'core')
spine.parent = rig
spine.color = (0, 0, 0, 1)
rails.append(spine.name)

bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 1.0, 0.6335))
well_obj = bpy.context.object
well_obj.name = 'core well'
well_obj.scale = (0.88, 1.58, 1)
well_obj.data.materials.append(well)
for c in list(well_obj.users_collection):
    c.objects.unlink(well_obj)
COL['core'].objects.link(well_obj)
well_obj.parent = rig
well_obj.color = (0, 0, 0, 1)

bells = []
for x in (-1.63, 1.63):
    for y in (-0.72, 2.72):
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.045, depth=0.012, location=(x, y, 0.703))
        b = bpy.context.object
        b.name = 'fastener strike'
        b.data.materials.append(bell)
        for c in list(b.users_collection):
            c.objects.unlink(b)
        COL['core'].objects.link(b)
        b.parent = rig
        b.color = (0, 0, 0, 1)
        bells.append(b.name)

# --- signal ribbons: V1 route polylines, arc length 0 at the processor pad, 1 at the via --
signal = bpy.data.materials.new('signal ribbon / doped glass')
signal.use_nodes = True
nodes, links = signal.node_tree.nodes, signal.node_tree.links
bsdf = nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value = (0.015, 0.09, 0.1, 1)
bsdf.inputs['Metallic'].default_value = 0.55
bsdf.inputs['Roughness'].default_value = 0.2
bsdf.inputs['Emission Color'].default_value = (0.02, 0.55, 1.0, 1)
arc = nodes.new('ShaderNodeAttribute')
arc.attribute_name = 'arc'


def math_node(op, a, b=None):
    n = nodes.new('ShaderNodeMath')
    n.operation = op
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            links.new(v, n.inputs[i])
    return n.outputs[0]


total = None
for i in range(6):
    p = nodes.new('ShaderNodeAttribute')
    p.attribute_type = 'OBJECT'
    p.attribute_name = f'p{i}'
    a = nodes.new('ShaderNodeAttribute')
    a.attribute_type = 'OBJECT'
    a.attribute_name = f'a{i}'
    d = math_node('MULTIPLY', math_node('SUBTRACT', arc.outputs['Fac'], p.outputs['Fac']),
                  math_node('SIGN', a.outputs['Fac']))            # d < 0 behind the head
    head = math_node('EXPONENT', math_node('MULTIPLY', math_node('POWER', math_node('DIVIDE', d, 0.03), 2.0), -1.0))
    tail = math_node('MULTIPLY', math_node('EXPONENT', math_node('DIVIDE', math_node('MINIMUM', d, 0.0), 0.07)),
                     math_node('LESS_THAN', d, 0.0))
    term = math_node('MULTIPLY', math_node('ADD', head, math_node('MULTIPLY', tail, 0.55)),
                     math_node('ABSOLUTE', a.outputs['Fac']))
    total = term if total is None else math_node('ADD', total, term)
gain = nodes.new('ShaderNodeValue')
gain.name = 'gain'
gain.outputs[0].default_value = 14.0
links.new(math_node('ADD', math_node('MULTIPLY', total, gain.outputs[0]), 0.12), bsdf.inputs['Emission Strength'])

ribbons = []
for route in V1['routes']:
    pts = [(x, y) for x, y, _ in route['points']]
    seg = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    length = sum(seg)
    cum = [0.0]
    for s_ in seg:
        cum.append(cum[-1] + s_)
    verts, arcs = [], []
    half = 0.015
    for i, (x, y) in enumerate(pts):
        dirs = []
        if i > 0:
            dirs.append((x - pts[i - 1][0], y - pts[i - 1][1]))
        if i < len(pts) - 1:
            dirs.append((pts[i + 1][0] - x, pts[i + 1][1] - y))
        nx = ny = 0.0
        for dx, dy in dirs:
            L = math.hypot(dx, dy)
            nx += -dy / L
            ny += dx / L
        L = math.hypot(nx, ny)
        nx, ny = nx / L, ny / L
        if len(dirs) == 2:  # mitre so the strip keeps its width through 45-degree bends
            dx, dy = dirs[0]
            L0 = math.hypot(dx, dy)
            cosang = max(0.5, abs(nx * (-dy / L0) + ny * (dx / L0)))
            nx, ny = nx / cosang, ny / cosang
        for side in (-1, 1):
            verts.append((x + side * half * nx, y + side * half * ny, 0.0815))
            arcs.append(cum[i] / length)
    faces = [(2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1) for i in range(len(pts) - 1)]  # normals up
    me = bpy.data.meshes.new(f'signal ribbon {route["id"]:02d}')
    me.from_pydata(verts, [], faces)
    attr = me.attributes.new('arc', 'FLOAT', 'POINT')
    attr.data.foreach_set('value', arcs)
    me.materials.append(signal)
    o = bpy.data.objects.new(f'signal ribbon {route["id"]:02d}', me)
    COL['board'].objects.link(o)
    for i in range(6):
        o[f'p{i}'] = 0.0
        o[f'a{i}'] = 0.0
    ribbons.append(o.name)

# --- camera, world, render settings -------------------------------------------------------
cam_data = bpy.data.cameras.new('V2 camera')
cam_data.sensor_width = 36
cam_data.lens = 38
cam_data.clip_start = 0.05
cam_data.clip_end = 200
cam_data.dof.use_dof = True
cam = bpy.data.objects.new('V2 camera', cam_data)
S.collection.objects.link(cam)
S.camera = cam
cam.rotation_mode = 'QUATERNION'

S.world.cycles_visibility.camera = False
S.render.film_transparent = False
S.render.use_motion_blur = True
S.render.motion_blur_shutter = 0.5
S.render.use_persistent_data = True
S.render.fps = ch.FPS
S.cycles.use_denoising = True
S.cycles.denoiser = 'OPENIMAGEDENOISE'
S.cycles.seed = 11062026
S.render.threads_mode = 'AUTO'
for o in bpy.data.objects:
    o.visible_camera = o.type != 'LIGHT'  # studio lights light the set; the lens never sees them

# Optical glare on scene-referred light, before the view transform (replaces V1's 2D bloom).
S.use_nodes = True
tree = S.node_tree
for n in list(tree.nodes):
    tree.nodes.remove(n)
layers = tree.nodes.new('CompositorNodeRLayers')
glare = tree.nodes.new('CompositorNodeGlare')
glare.glare_type = 'FOG_GLOW'
glare.quality = 'HIGH'
glare.threshold = 4.0
glare.size = 7
glare.mix = -0.75
composite = tree.nodes.new('CompositorNodeComposite')
tree.links.new(layers.outputs['Image'], glare.inputs['Image'])
tree.links.new(glare.outputs['Image'], composite.inputs['Image'])
S.render.use_compositing = True

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
work = Path(args[args.index('--work') + 1]) if '--work' in args else HERE / 'work'
work.mkdir(parents=True, exist_ok=True)
meta = {'v1SceneSha256': V1_SCENE_SHA256, 'carriers': carriers, 'rails': rails, 'well': well_obj.name,
        'bells': bells, 'ribbons': ribbons, 'rings': [[list(c) for c in p] for p in ch.RINGS],
        'blender': bpy.app.version_string}
(work / 'scene-v2.json').write_text(json.dumps(meta, indent=1) + '\n')
bpy.ops.wm.save_as_mainfile(filepath=str(work / 'circuit-v2.blend'))
print('SCENE_V2_DONE', len(bpy.data.objects), flush=True)
