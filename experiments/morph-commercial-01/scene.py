"""Original procedural macro circuit. Blender 4.3+, CPU Cycles. No external assets.
Render fixed physical lighting into board/core/foreground photographic layers.
The small compositing camera move is a calibrated plane homography for each height.
"""
import bpy, math, random, json, sys, argparse
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
from pathlib import Path
P=Path(__file__).resolve().parent
ap=argparse.ArgumentParser();ap.add_argument('--width',type=int,default=1404);ap.add_argument('--samples',type=int,default=48)
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
r=random.Random(11062026)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
S=bpy.context.scene;S.render.engine='CYCLES';S.cycles.device='CPU';S.cycles.samples=a.samples
S.cycles.use_denoising=False;S.render.threads_mode='FIXED';S.render.threads=3
S.render.resolution_x=a.width;S.render.resolution_y=round(a.width*16/9);S.render.resolution_percentage=100
S.render.image_settings.file_format='PNG';S.render.image_settings.color_mode='RGBA';S.render.image_settings.color_depth='8'
S.view_settings.view_transform='AgX';S.view_settings.look='AgX - Medium High Contrast';S.view_settings.exposure=.65
S.world.color=(.045,.045,.045)
COL={}
for n in ['board','core','foreground']:
 c=bpy.data.collections.new(n);S.collection.children.link(c);COL[n]=c

def assign(o,grp):
 for c in list(o.users_collection):c.objects.unlink(o)
 COL[grp].objects.link(o)
 return o

def mat(n,color,metal=.0,rough=.35,noise=0):
 m=bpy.data.materials.new(n);m.diffuse_color=(*color,1);m.use_nodes=True
 N=m.node_tree.nodes;L=m.node_tree.links;bs=N.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
 if noise:
  tex=N.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=200;tex.inputs['Detail'].default_value=2
  bump=N.new('ShaderNodeBump');bump.inputs['Strength'].default_value=noise;bump.inputs['Distance'].default_value=.014;L.new(tex.outputs['Fac'],bump.inputs['Height']);L.new(bump.outputs['Normal'],bs.inputs['Normal'])
 return m
ceramic=mat('black silicon carbide / fine grain',(.018,.026,.029),.45,.3,.35)
black=mat('ceramic packages',(.016,.022,.025),.55,.23,.2)
copper=mat('brushed rose copper',(.48,.20,.075),.88,.26,.2)
gold=mat('gold plated contacts',(.66,.39,.15),.86,.23,.15)
silver=mat('satin nickel',(.42,.49,.5),.85,.22,.16)
die=mat('silicon die',(.025,.055,.061),.75,.18,.09)
etch=mat('etch / ink',(.28,.35,.34),.5,.45)
# Low-level embedded phosphor under the physical top-layer traces.
em=mat('unpowered cyan doped glass',(.015,.09,.1),.55,.2)
bs=em.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(.01,.35,.42,1);bs.inputs['Emission Strength'].default_value=.12

def box(n,p,sc,ma,bevel=.025,grp='board'):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.name=n;o.dimensions=sc;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(ma)
 if bevel:
  b=o.modifiers.new('machined edges','BEVEL');b.width=bevel;b.segments=2
  o.modifiers.new('weighted normals','WEIGHTED_NORMAL')
 return assign(o,grp)

def path(n,pts,width,ma,grp='board'):
 cu=bpy.data.curves.new(n,'CURVE');cu.dimensions='3D';cu.resolution_u=1;cu.bevel_depth=width;cu.resolution_u=1;cu.bevel_resolution=1
 sp=cu.splines.new('POLY');sp.points.add(len(pts)-1)
 for p,q in zip(sp.points,pts):p.co=(*q,1)
 o=bpy.data.objects.new(n,cu);COL[grp].objects.link(o);o.data.materials.append(ma);return o

def via(x,y,z=.028,rad=.085,grp='board'):
 bpy.ops.mesh.primitive_torus_add(major_radius=rad,minor_radius=rad*.22,major_segments=12,minor_segments=4,location=(x,y,z));o=bpy.context.object;o.data.materials.append(gold);assign(o,grp)

def text(n,body,p,size,ma,grp='board'):
 cu=bpy.data.curves.new(n,'FONT');cu.body=body;cu.size=size;cu.extrude=.001;cu.space_character=1.15
 o=bpy.data.objects.new(n,cu);COL[grp].objects.link(o);o.location=p;o.data.materials.append(ma)
 return o
box('continuous ceramic substrate',(0,0,-.19),(23,31,.35),ceramic,.12)
# Routed pin escape topology: each pulse path starts at a processor pad, then reaches a junction.
routes=[]
for side in range(4):
 for lane in range(14):
  d=(lane-6.5)*.228
  ext=4.5+(lane%4)*.42
  bend=.9+(lane%5)*.20
  if side==0:pts=[(-1.94,1+d,.05),(-2.32,1+d,.05),(-2.32-bend,1+d-bend,.05),(-ext,1+d-bend,.05),(-ext,-7.7+lane*.16,.05)]
  elif side==1:pts=[(1.94,1+d,.05),(2.32,1+d,.05),(2.32+bend,1+d+bend,.05),(ext,1+d+bend,.05),(ext,9.4-lane*.13,.05)]
  elif side==2:pts=[(d,-1.05,.05),(d,-1.5,.05),(d-bend,-1.5-bend,.05),(d-bend,-5-lane*.15,.05),(d-bend+.6,-5.6-lane*.15,.05)]
  else:pts=[(d,3.05,.05),(d,3.5,.05),(d+bend,3.5+bend,.05),(d+bend,7.8+lane*.16,.05),(d+bend-.6,8.4+lane*.16,.05)]
  idx=len(routes);path('etched copper route %02d'%idx,pts,.030,copper);path('glass signal channel %02d'%idx,[(x,y,z+.023) for x,y,z in pts],.009,em)
  x,y,z=pts[-1];via(x,y)
  # connected branch, fork after the third point
  anchor=pts[3];bx=anchor[0]+(.8 if side%2 else -.8);by=anchor[1]+(.75 if side<2 else -.75)
  branch=[anchor,(bx,by,.05),(bx+(1 if side%2 else -1)*.65,by,.05)]
  path('branch copper %02d'%idx,branch,.016,copper);via(*branch[-1][:2],rad=.055)
  routes.append({'id':idx,'points':pts,'branch':branch})
# Secondary routed regions: orderly bus lanes with right-angle 45-degree escapes.
for sign in [-1,1]:
 for j in range(30):
  y=-10+j*.68
  x=sign*(6.2+(j%4)*.14)
  path('outer bus',[(x,y,.022),(sign*8.4,y,.022),(sign*8.75,y+.35,.022),(sign*10,y+.35,.022)],.012,copper)
  via(sign*8.4,y,rad=.045)
# Passive islands (capacitors, resistors, small ICs), placed only outside escape corridor.
for i in range(130):
 x=r.choice([-1,1])*r.uniform(6.8,10.4);y=r.uniform(-12,13)
 sx=r.uniform(.15,.37);sy=r.uniform(.28,.65)
 box('SMD ceramic capacitor',(x,y,.11),(sx,sy,.19),black,.025)
 for s in [-1,1]:box('plated terminal',(x,y+s*sy*.39,.12),(sx+.016,sy*.20,.2),silver,.013)
 if i%2==0:text('reference',f'C{i+110}',(x+.25,y,.012),.09,etch)
# Smaller isolated satellites at corners of core; physical rather than a UI.
for x,y in [(-3.7,-3.6),(3.8,-3.4),(-4.3,5.8),(4.1,6.3),(-1.1,-8.4),(1.9,10.6)]:
 box('satellite ceramic package',(x,y,.22),(1.1,1.4,.38),black,.055)
 for j in range(7):
  for s in [-1,1]:box('satellite gullwing lead',(x+s*.62,y+(j-3)*.16,.08),(.24,.075,.1),silver,.009)
 text('satellite ID','M//'+str(int(abs(y)*11)),(x-.35,y,.42),.13,etch)
# Hero processor, distinct 3-dimensional heights for parallax.
box('floating processor carrier',(0,1,.23),(4.10,4.38,.40),black,.12,'core')
box('copper thermal frame',(0,1,.46),(3.82,4.10,.15),copper,.075,'core')
box('dark interposer',(0,1,.56),(3.53,3.81,.14),ceramic,.05,'core')
# ribbed perimeter, glinting pads and bond wires
for side in [-1,1]:
 for j in range(24):
  y=1+(j-11.5)*.156
  box('bond lead',(side*1.96,y,.25),(.38,.061,.12),gold,.013,'core')
  x=(j-11.5)*.146
  box('bond lead',(x,1+side*2.08,.25),(.059,.35,.12),gold,.012,'core')
for x in [-1.63,1.63]:
 for y in [-.72,2.72]:
  via(x,y,z=.66,rad=.092,grp='core')
  box('fastener inset',(x,y,.64),(.10,.017,.012),black,.004,'core')
# 6 x 8 computational tile modules with etched arrays, physically small silicon blocks.
tiles=[]
for ix in range(6):
 for iy in range(8):
  x=(ix-2.5)*.46;y=1+(iy-3.5)*.405
  box('silicon compute tile',(x,y,.68),(.411,.354,.12),die,.018,'core')
  box('tile copper cap',(x,y,.748),(.29,.25,.013),copper,.007,'core')
  for k in range(5):
   path('lithographic tile gate',[(x-.12,y-.09+k*.043,.759),(x+.12,y-.09+k*.043,.759)],.004,gold,'core')
  tiles.append({'x':x,'y':y,'z':.77,'ix':ix,'iy':iy})
# Dark vents in the thermal rails and tiny conductive bridges.
for s in [-1,1]:
 for j in range(26):box('thermal comb',(s*1.6,1+(j-12.5)*.12,.68),(.13,.04,.13),silver,.008,'core')
text('chip engraving','M O R P H',(-1.19,-.65,.64),.15,etch,'core')
text('chip engraving','C01 / NEUROMORPHIC',(-1.13,2.69,.65),.080,etch,'core')
# Fabrication evidence: plated survey marks, etched data and quiet calibration ticks.
for x,y in [(-3.1,-5),(3.3,-6.7),(-4.7,7.6)]:
 text('fabrication label','MATA  /  C01\nCu / SiC    0.7 nm', (x,y,.018),.13,etch)
 for j in range(8):path('fabrication graduation',[(x+j*.12,y-.2,.017),(x+j*.12,y-.27-(j%4==0)*.08,.017)],.007,etch)
# defocused foreground rail creates an occluding plane near the lens
for x in [-6.8,6.8]:
 box('foreground power package',(x,-7,.5),(1.3,3.4,.8),black,.1,'foreground')
 for j in range(14):box('foreground cooling rib',(x,-8.4+j*.21,.94),(1.45,.065,.14),silver,.018,'foreground')
# Studio lighting makes copper readable without a full-frame brightness pump.
def area(n,p,power,color,size,scale=1):
 bpy.ops.object.light_add(type='AREA',location=p);o=bpy.context.object;o.name=n;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,1,0))-o.location).to_track_quat('-Z','Y').to_euler()
area('cyan softbox',(-5,2,7),1500,(.24,.79,1),7)
area('warm grazing strip',(4,-1,5),1300,(1,.49,.20),6)
area('pale overhead',(0,6,10),1600,(.79,.9,1),5)
area('edge amber',(-7,-7,2),450,(1,.25,.065),4)
bpy.ops.object.camera_add(location=(6.0,-9.5,14.6));cam=bpy.context.object;cam.name='macro cinema camera';cam.rotation_euler=(Vector((0,.5,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=37;cam.data.sensor_width=36
S.camera=cam;cam.data.dof.use_dof=True;cam.data.dof.focus_distance=(cam.location-Vector((0,1,.6))).length;cam.data.dof.aperture_fstop=3.8
# Projection metadata for identical route alignment in the compositor.
bpy.context.view_layer.update()
def project(p):
 q=world_to_camera_view(S,cam,Vector(p));return [q.x*S.render.resolution_x,(1-q.y)*S.render.resolution_y]
meta={'width':S.render.resolution_x,'height':S.render.resolution_y,'seed':11062026,'camera':list(cam.location),'lensMm':cam.data.lens,'routes':routes,'tiles':tiles,'planes':{}}
for grp,z in [('board',.05),('core',.6),('foreground',.8)]:
 meta['planes'][grp]={'z':z,'quad':[project((x,y,z)) for x,y in [(-10,-12),(10,-12),(10,14),(-10,14)]]}
for route in meta['routes']:
 route['screen']=[project(p) for p in route['points']];route['branchScreen']=[project(p) for p in route['branch']]
for t in meta['tiles']:t['screen']=project((t['x'],t['y'],t['z']))
meta['coreOutline']=[project(p) for p in [(-1.88,-1.02,.60),(1.88,-1.02,.60),(1.88,3.02,.60),(-1.88,3.02,.60),(-1.88,-1.02,.60)]]
(P/'work').mkdir(exist_ok=True);(P/'work/scene.json').write_text(json.dumps(meta,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(P/'work/circuit.blend'))
for grp in ['board','core','foreground']:
 # Invisible objects still cast shadows and remain in glossy reflections.
 for g,c in COL.items():
  for o in c.objects:o.visible_camera=(g==grp)
 S.render.film_transparent=grp!='board'
 S.render.filepath=str(P/f'work/{grp}.png')
 bpy.ops.render.render(write_still=True)
 print('LAYER_DONE',grp,flush=True)
