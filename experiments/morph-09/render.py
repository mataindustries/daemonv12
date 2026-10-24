"""Blender 4.3 CPU motion-design proof. Run from repo root, see README."""
import bpy,bmesh,sys,math,os,json,argparse
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from state import state,rotor,TAU
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
p=argparse.ArgumentParser();p.add_argument('--times',default='.08,2.25,6.58');p.add_argument('--engine',choices=['cycles','eevee'],default='eevee');p.add_argument('--out',default='work/morph-09');p.add_argument('--mode',choices=['preview','stills','motion','bake','seam'],default='preview');p.add_argument('--start',type=int,default=0);p.add_argument('--end',type=int,default=479);p.add_argument('--samples',type=int,default=12);p.add_argument('--width',type=int,default=480);p.add_argument('--height',type=int,default=600);A=p.parse_args(args)
OUT=Path(A.out).resolve();OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for m in bpy.data.materials:bpy.data.materials.remove(m)
scene=bpy.context.scene
scene.render.engine='CYCLES' if A.engine=='cycles' else 'BLENDER_EEVEE_NEXT'
scene.eevee.taa_render_samples=A.samples
scene.cycles.samples=A.samples;scene.cycles.use_denoising=False
scene.cycles.max_bounces=5;scene.cycles.diffuse_bounces=2;scene.cycles.glossy_bounces=3
scene.render.resolution_x=A.width;scene.render.resolution_y=A.height;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.compression=15;scene.render.fps=60
scene.world.color=(.12,.12,.12)
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
scene.render.film_transparent=False
scene.view_settings.exposure=-.65

def mat(name,color,metal=0,rough=.3,emit=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
 bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=emit
 return m
teal=mat('Midnight enamel',(.026,.063,.069),.7,.32)
black=mat('Graphite ceramic',(.009,.016,.019),.15,.44)
steel=mat('Satin titanium',(.34,.43,.45),.88,.27)
silver=mat('Tuned nickel silver',(.63,.72,.72),.9,.22)
copper=mat('Machined warm copper',(.55,.235,.095),.88,.26)
brass=mat('Champagne brass',(.57,.40,.19),.85,.23)
ceramic=mat('Alumina brush',(.70,.73,.63),.1,.35)
ink=mat('Laser engraving',(.39,.55,.54),.4,.4)
lightmats=[mat('Resonator harmonic light '+str(i),(.4,.85,.77),.25,.25,.25) for i in range(5)]
warm=mat('Contact light',(.95,.46,.15),.2,.25,1)
voiceLight=mat('Vocal reed light',(.64,.79,.98),.3,.25,.6)
lockLight=mat('Convergence collar light',(.88,.72,.42),.3,.24,.1)

def finish(o,name,material,bevel=0,parent=None):
 o.name=name;o.data.materials.append(material)
 if bevel:
  b=o.modifiers.new('Soft machined edges','BEVEL');b.width=bevel;b.segments=3
  o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
 if parent:o.parent=parent
 return o

def cube(name,loc,size,material,bevel=.03,parent=None):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,material,bevel,parent)
def cyl(name,loc,r,depth,material,verts=96,parent=None):
 bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=loc);o=finish(bpy.context.object,name,material,.025,parent)
 for f in o.data.polygons:f.use_smooth=True
 return o

def ring(name,cx,cy,z,r1,r2,material,depth=.07,start=0,end=TAU,segments=128,parent=None):
 vs=[];fs=[]
 for zz in [z-depth/2,z+depth/2]:
  for r in [r1,r2]:
   for i in range(segments+1):
    a=start+(end-start)*i/segments;vs.append((cx+r*math.cos(a),cy+r*math.sin(a),zz))
 n=segments+1
 for i in range(segments):
  fs.extend([(i,i+1,n+i+1,n+i),(2*n+i,3*n+i,3*n+i+1,2*n+i+1),(i,2*n+i,2*n+i+1,i+1),(n+i,n+i+1,3*n+i+1,3*n+i)])

 if name!='Shutter average annulus':fs.extend([(0,n,3*n,2*n),(n-1,2*n-1,4*n-1,3*n-1)])
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();
 if name=='Shutter average annulus':
  bm=bmesh.new();bm.from_mesh(me);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bm.to_mesh(me);bm.free()
 o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);return finish(o,name,material,.014,parent)

def empty(name,loc):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;return o

def textobj(name,string,loc,size,material,align='LEFT'):
 cv=bpy.data.curves.new(name,'FONT');cv.body=string;cv.size=size;cv.align_x=align;cv.extrude=.0006;cv.space_character=1.15;o=bpy.data.objects.new(name,cv);bpy.context.collection.objects.link(o);o.location=loc;o.data.materials.append(material);return o

def curve(name,coords,matl,r=.025,parent=None):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.bevel_depth=r;cu.bevel_resolution=3;sp=cu.splines.new('POLY');sp.points.add(len(coords)-1)
 for p,co in zip(sp.points,coords):p.co=(*co,1)
 o=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(o);o.data.materials.append(matl)
 if parent:o.parent=parent
 return o
# Instrument bed, restrained hardware and perimeter engraving.
cube('Floating instrument body',(0,0,-.36),(7.3,9.8,.63),teal,.25)
cube('Inset deck',(0,0,-.005),(6.96,9.48,.13),black,.19)
for x in [-3.40,3.40]:
 cube('Frame rail',(x,0,.08),(.085,8.95,.13),brass,.025)
 for y in [-4.45,4.45]:
  cyl('Captive fastener',(x,y,.15),.11,.07,steel,32)
  cube('Screw slot',(x,y,.193),(.12,.018,.012),black,.003)
textobj('Brand','O V E R T O N E',(-2.93,4.45,.10),.235,silver)
textobj('Series','MORPH // 09',(-2.93,4.15,.10),.12,ink)
textobj('Caption','THE MACHINE THAT MAKES MUSIC',(-2.93,-4.36,.10),.13,silver)
textobj('Plate','16 CONTACTS   /   5 RESONATORS',(-2.93,-4.57,.10),.095,ink)
# Main rotor on axial suspension, with 16 identical features: no unique orientation mark.
CY=-1.15
cyl('Recessed motor well',(0,CY,.12),2.94,.14,teal)
ring('Outer bass tension hoop',0,CY,.29,2.72,2.84,silver)
bassHoop=bpy.context.collection.objects.get('Outer bass tension hoop')
ring('Stationary warm rim',0,CY,.31,2.52,2.57,copper)
for k in range(48):
 a=k*TAU/48;x,y=2.88*math.cos(a),CY+2.88*math.sin(a)
 o=cube('Stator calibration notch',(x,y,.26),(.055,.012,.018),ink,.002);o.rotation_euler.z=a
axial=empty('Axial kick suspension',(0,CY,.38))
rot=empty('True telemetry rotor',(0,0,0));rot.parent=axial
cyl('Rotor lower flywheel',(0,0,.025),2.45,.17,black,parent=rot)
ring('Inner brass race',0,0,.18,.68,.80,brass,parent=rot)
# Radial cutout impression: metallic spokes over a graphite flywheel.
for k in range(16):
 a=math.pi/2-k*TAU/16
 o=cube('Rotor spoke %02d'%k,(1.39*math.cos(a),1.39*math.sin(a),.13),(1.42,.22,.12),steel,.06,rot);o.rotation_euler.z=a
 ring('Copper commutator shoe %02d'%k,0,0,.25,1.99,2.40,copper,.19,a-.145,a+.145,12,rot)
 ring('Ivory contact edge %02d'%k,0,0,.36,2.29,2.34,ceramic,.025,a-.122,a+.122,8,rot)
# Shutter-integrated analytic equivalent of 16 repeated shoes at high speed.
blurParent=empty('Integrated rotor at rhythm to pitch',(0,0,0));blurParent.parent=axial
blurObjects=[]
blurSteel=mat('Exposure averaged steel and graphite',(.13,.18,.19),.55,.34)
for r1,r2,z,ma in [(1.98,2.41,.25,copper),(2.29,2.34,.36,ceramic),(.80,1.99,.17,blurSteel)]:
 o=ring('Shutter average annulus',0,0,z,r1,r2,ma,.08,parent=blurParent);blurObjects.append(o)
cyl('Central bearing',(0,0,.24),.67,.32,steel,parent=axial)
cyl('Bearing black inset',(0,0,.43),.44,.09,black,parent=axial)
ring('Final pitch collar',0,0,.50,.42,.50,brass,.09,parent=axial)
collar=bpy.context.collection.objects.get('Final pitch collar')
ring('Collar light',0,0,.557,.46,.475,lockLight,.015,parent=axial)
cyl('Bearing crown',(0,0,.53),.17,.10,copper,parent=axial)
# A single fixed ceramic brush rides the copper contacts at twelve o'clock.
brush=empty('Contact brush recoil',(0,CY+2.27,.73))
cube('Brush ceramic tongue',(0,0,0),(.38,.68,.16),ceramic,.055,brush)
cube('Brush copper shoe',(0,-.27,-.095),(.29,.20,.08),copper,.02,brush)
cube('Brush contact window',(0,-.21,.091),(.12,.13,.018),warm,.016,brush)
for x in [-.33,.33]:cube('Brush spring pivot',(x,CY+2.41,.53),(.17,.45,.25),brass,.04)
# Five graded tuning forks forming a crown; two real metal rails per resonator.
tineParents=[];clamps=[];edgeLights=[]
lengths=[2.15,2.55,2.85,2.45,1.95]
for i,(x,L) in enumerate(zip([-2.3,-1.15,0,1.15,2.3],lengths)):
 y=1.26
 cube('Resonator ceramic bed %d'%i,(x,y+.6,.16),(.78,1.0,.22),teal,.08)
 fork=empty('Tuned resonator %d'%i,(x,y,.43));tineParents.append(fork)
 # U-shaped bar with twin tongues and a cross-foot.
 cube('Resonator foot %d'%i,(0,.10,0),(.60,.28,.17),silver,.055,fork)
 for dx in [-.21,.21]:
  cube('Silver tine %d'%i,(dx,L/2,0),(.17,L,.17),silver,.06,fork)
  edge=cube('Harmonic filament %d'%i,(dx,L/2,.092),(.028,L-.16,.018),lightmats[i],.01,fork);edgeLights.append(edge)
 clamp=cube('Sliding tuning collar %d'%i,(x,y+.51,.57),(.73,.21,.13),brass,.035);clamps.append(clamp)
 for dx in [-.31,.31]:cyl('Collar rivet',(x+dx,y+.51,.66),.035,.025,black,24)
 textobj('Tine number %d'%i,'%02d'%(i+1),(x,y-.27,.22),.12,ink,'CENTER')
 # Physical trace links brush into each resonator; no detached particles.
 curve('Copper excitation trace %d'%i,[(0,1.22,.19),(x*.4,1.07,.19),(x,1.04,.19),(x,1.24,.23)],copper,.018)
# Separate bowed vocal reed below the motor, with two supports and a flexible crown.
for x in [-1.8,1.8]:cube('Vocal arch ceramic mount',(x,-3.91,.29),(.36,.25,.27),ceramic,.04)
reed=empty('Sung melody arch',(0,-3.91,.46))
coords=[(-1.8+3.6*j/48,.25*math.sin(math.pi*j/48),.12+.22*math.sin(math.pi*j/48)) for j in range(49)]
curve('Sung silver ribbon',coords,silver,.045,reed)
curve('Sung illuminated edge',[(x,y,z+.04) for x,y,z in coords],voiceLight,.015,reed)
# Clap jaws and hi-hat escapement fingers at either side: distinct readable motions.
jaws=[];hats=[]
for side in [-1,1]:
 x=side*3.03
 jaw=cube('Clap jaw',(x,-1.8,.45),(.35,.76,.26),steel,.07);jaws.append(jaw)
 for j in range(4):cube('Jaw fin',(x,-2.08+j*.18,.61),(.27,.06,.04),copper,.009)
 finger=cube('Hat escapement finger',(x,.03,.41),(.28,.58,.10),brass,.035);hats.append(finger)
# Brake caliper: explicit load and braking, not a decorative speed ramp.
calipers=[]
for side in [-1,1]:
 o=cube('Electromagnetic brake caliper',(side*2.82,-2.95,.44),(.48,.66,.30),teal,.07);calipers.append(o)
 cube('Brake winding',(side*2.82,-2.95,.62),(.34,.46,.07),copper,.025)
# Fixed studio lighting and camera; no animated camera or exposure.
cube('Studio background',(0,0,-.82),(200,200,.2),mat('Studio backdrop',(.008,.017,.022),.15,.4),.0)
def area(name,loc,power,color,size,target=(0,0,0),shape='DISK',size_y=None):
 d=bpy.data.lights.new(name,'AREA');d.use_shadow=(name=='Large cool softbox');d.energy=power;d.color=color;d.shape=shape;d.size=size
 if size_y is not None:d.size_y=size_y
 o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('Large cool softbox',(-4,2,9),1400,(.64,.83,1),7)
area('Warm edge strip',(4,-1,5),1000,(1,.70,.39),5,shape='RECTANGLE',size_y=1)
area('Top silver strip',(0,6,5),1200,(.82,.95,1),5,shape='RECTANGLE',size_y=1.4)
area('Low fill',(-4,-5,4),450,(.40,.75,.86),4)
bpy.ops.object.camera_add(location=(.6,-7.5,19.8));cam=bpy.context.object;cam.rotation_euler=(Vector((0,-.05,.1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=11.65;scene.camera=cam
# Glow restrained to emissive metal; no global pulsing of illumination.
scene.use_nodes=True;nt=scene.node_tree;nt.nodes.clear();r=nt.nodes.new('CompositorNodeRLayers');g=nt.nodes.new('CompositorNodeGlare');g.glare_type='FOG_GLOW';g.quality='MEDIUM';g.threshold=1.4;g.size=7;comp=nt.nodes.new('CompositorNodeComposite');nt.links.new(r.outputs['Image'],g.inputs['Image']);nt.links.new(g.outputs['Image'],comp.inputs['Image'])

def update(t):
 s=state(t);rot.rotation_euler.z=TAU*s['angle'];axial.location.z=.38-.095*s['kick']
 # At pitch, a shutter spans many identical contacts: use an annular exposure average.
 useblur=s['blur']>.5
 rot.hide_render=useblur;blurParent.hide_render=not useblur
 # hide_render does not inherit from empties, set mesh visibility explicitly.
 for o in rot.children:o.hide_render=useblur
 for o in blurObjects:o.hide_render=not useblur
 brush.rotation_euler.x=.08*s['brush'];brush.location.z=.73+.045*s['brush']
 warm.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=.8+3.0*min(1,s['brush'])
 bassHoop.scale=(1-.018*s['bass'],1-.018*s['bass'],1);bassHoop.location.y=CY*(1-bassHoop.scale.y)
 for i,(fork,clamp) in enumerate(zip(tineParents,clamps)):
  fork.rotation_euler.x=.018*s['flex'][i]+.009*s['lock']*math.sin(TAU*110*t)
  fork.rotation_euler.y=.055*s['flex'][i]
  clamp.location.y=1.26+.26+(.8*(110/max(55,s['clamps'][i])))
  bs=lightmats[i].node_tree.nodes['Principled BSDF'];k=s['lock']
  color=(.30+.65*k,.75+.13*k,.66-.02*k,1)
  bs.inputs['Emission Color'].default_value=color;bs.inputs['Emission Strength'].default_value=.35+3.2*min(1,s['tines'][i])+14*k
 reed.scale.z=1+.8*min(1.1,s['vox']);reed.scale.y=1+1.1*min(1.1,s['vox']);reed.rotation_euler.y=.018*s['vox']*(s['vox_note']-2)
 voiceLight.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=.3+3*min(1,s['vox'])
 for side,o,h in zip([-1,1],jaws,hats):o.location.x=side*(3.03-.12*s['clap']);h.rotation_euler.y=side*.20*s['hat']
 brake=max(s['load']/.9,1 if 6.762653<=s['t']<7 else 0)
 for side,o in zip([-1,1],calipers):o.location.x=side*(2.82-.12*min(1,brake))
 collar.scale.z=1-.35*s['lock'];lockLight.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=.2+5*s['lock']
 return s

if A.mode=='preview':
 for t in [.08,2.25,4.5,6.58]:
  update(t);scene.render.filepath=str(OUT/('preview-%04d.png'%round(t*1000)));bpy.ops.render.render(write_still=True)
elif A.mode=='seam':
 for label in ['opening','physical-endpoint']:
  update(0)
  if label=='physical-endpoint':rot.rotation_euler.z=TAU*rotor(8)[0]
  scene.render.filepath=str(OUT/(label+'.png'));bpy.ops.render.render(write_still=True)
elif A.mode=='stills':
 for t in map(float,A.times.split(',')):
  update(t);scene.render.filepath=str(OUT/('overtone-%04d.png'%round(t*1000)));bpy.ops.render.render(write_still=True)
elif A.mode=='motion':
 for f in range(A.start,A.end+1):
  update(f/60);scene.render.filepath=str(OUT/('%04d.png'%f));bpy.ops.render.render(write_still=True)
if A.mode=='bake':
 scene.frame_start=1;scene.frame_end=480
 animated=[rot,axial,brush,bassHoop,reed,collar]+tineParents+clamps+jaws+hats+calipers
 visibility=list(rot.children)+blurObjects
 for f in range(480):
  scene.frame_set(f+1);update(f/60)
  for o in animated:
   for prop in ['location','rotation_euler','scale']:o.keyframe_insert(data_path=prop,frame=f+1)
  for o in visibility:o.keyframe_insert(data_path='hide_render',frame=f+1)
  for ma in lightmats+[warm,voiceLight,lockLight]:
   bs=ma.node_tree.nodes['Principled BSDF']
   for field in ['Emission Strength','Emission Color']:bs.inputs[field].keyframe_insert(data_path='default_value',frame=f+1)
 for ob in animated+visibility:
  if ob.animation_data and ob.animation_data.action:
   for fc in ob.animation_data.action.fcurves:
    for kp in fc.keyframe_points:kp.interpolation='CONSTANT' if fc.data_path=='hide_render' else 'LINEAR'
 editor=scene.sequence_editor_create()
 editor.sequences.new_sound('OVERTONE — approved PCM',str(HERE.parent/'morph-08/candidates/overtone.wav'),channel=1,frame_start=1)
 scene.render.use_sequencer=False;scene.sync_mode='AUDIO_SYNC';bpy.ops.file.pack_all()
 scene.frame_set(1)
# Save the modeled source. Motion is evaluated by state.py; bake adds editable keyframes.

update(0);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'resonant-rotor.blend'),compress=True)
