#!/usr/bin/env python3
"""THE CIRCUIT deterministic 2.5D macro animation / Pillow compositor.
Uses three CPU path-traced original geometry plates made by scene.py. No audio DSP.
Every visible musical accent is driven by mapping.json sample-frame events.
"""
from pathlib import Path
import argparse, json, math, subprocess, hashlib, multiprocessing
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
P=Path(__file__).resolve().parent
M=json.loads((P/'mapping.json').read_text())
EVENTS=[e for e in M['events'] if e['selected']]

def envelope(age,dur):
 if age<0 or age>dur:return 0.
 return (1-math.exp(-age/.012))*math.exp(-age/(dur*.40))

def state(frame):
 # A picture frame exposes [f/60,(f+1)/60). An event activates in the containing
 # frame, including events after that frame's nominal timestamp. No ceil delay.
 active=[]
 for e in EVENTS:
  if e['frame60']<=frame and e['system'] not in ['blackout','metadata']:
   age=max(1/600,(frame+1)/60-e['time'])
   if age<=e['duration']+(.35 if e['system']=='branch' else .0):active.append((e,age))
 return active

class Circuit:
 def __init__(self,width):
  self.w=width;self.h=round(width*16/9);self.size=(self.w,self.h)
  self.meta=json.loads((P/'work/scene.json').read_text());self.s=width/self.meta['width']
  self.layers={n:Image.open(P/f'work/{n}.png').convert('RGBA').resize(self.size,Image.Resampling.LANCZOS) for n in ['board','core','foreground']}
  # Macro optical finish: continuous focus falloff along the board, with the die
  # plane sharp and the raised near-lens cooling packages softened separately.
  im=self.layers['board'];yy=np.linspace(0,1,self.h)[:,None]
  focus=np.clip((np.abs(yy-.47)-.17)/.30,0,1)
  mask=Image.fromarray(np.repeat((focus*235).astype('uint8'),self.w,axis=1),'L')
  self.layers['board']=Image.composite(im.filter(ImageFilter.GaussianBlur(4.8*self.w/1080)),im,mask)
  self.layers['foreground']=self.layers['foreground'].filter(ImageFilter.GaussianBlur(3*self.w/1080))
  # Set outside the physical board to black using its calibrated planar boundary.
  # The lighting plate's gray World is a reflection source, never a visible backdrop.
  src=[];dst=[]
  for rt in self.meta['routes'][::7]:
   for world,screen in zip(rt['points'],rt['screen']):src.append(world[:2]);dst.append(screen)
  rows=[];rhs=[]
  for (x,y),(u,v) in zip(src,dst):
   rows.extend([[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]]);rhs.extend([u,v])
  H=np.r_[np.linalg.lstsq(np.array(rows),np.array(rhs),rcond=None)[0],1].reshape(3,3)
  corners=np.array([[-11.5,-15.5,1],[11.5,-15.5,1],[11.5,15.5,1],[-11.5,15.5,1]])@H.T
  polygon=[tuple(q[:2]/q[2]*self.s) for q in corners]
  mask=Image.new('L',self.size);ImageDraw.Draw(mask).polygon(polygon,fill=255)
  self.layers['board'].putalpha(mask)
  for n,factor in [('board',.58),('core',.54),('foreground',.58)]:
   plate=np.asarray(self.layers[n]).copy();plate[:,:,:3]=(plate[:,:,:3].astype(np.float32)*factor).astype('uint8')
   self.layers[n]=Image.fromarray(plate)
  self.routes=[]
  for r in self.meta['routes']:
   self.routes.append({'main':np.array(r['screen'])*self.s,'branch':np.array(r['branchScreen'])*self.s})
  self.tiles=[{**t,'p':np.array(t['screen'])*self.s} for t in self.meta['tiles']]
  for tile in self.tiles:
   ix,iy=tile['ix'],tile['iy']
   tx=next(q for q in self.tiles if q['ix']==(ix+1 if ix<5 else ix-1) and q['iy']==iy)
   ty=next(q for q in self.tiles if q['iy']==(iy+1 if iy<7 else iy-1) and q['ix']==ix)
   tile['vx']=(tx['p']-tile['p'])*(1 if ix<5 else -1)
   tile['vy']=(ty['p']-tile['p'])*(1 if iy<7 else -1)
  self.outline=np.array(self.meta['coreOutline'])*self.s
  yy,xx=np.mgrid[0:self.h,0:self.w];rr=((xx/self.w-.5)/.74)**2+((yy/self.h-.45)/.9)**2
  self.vignette=(1-.27*np.clip(rr,0,1)).astype(np.float32)[...,None]
  try:self.font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',round(40*self.w/1080));self.small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',round(16*self.w/1080))
  except OSError:self.font=ImageFont.load_default();self.small=self.font
 def matrix(self,t,z,kick=0):
  # Small virtual dolly: deterministic perspective drift, increasing magnification.
  # Three photographic planes at measured scene heights provide differential parallax.
  u=t/7.6;scale=1.055+.037*u+kick*.006
  shear=.006*(u-.5)
  dx=self.w*(-.007+.019*u)+z*self.w*.0035*(u-.5)
  dy=self.h*(.017-.023*u)+z*self.h*.004*(u-.5)
  return np.array([[scale,shear,dx+(1-scale)*self.w/2],[0,scale,dy+(1-scale)*self.h/2],[.000002*(u-.5)*1080/self.w,0,1.]])
 def warp(self,im,A):
  B=np.linalg.inv(A);B=B/B[2,2]
  return im.transform(self.size,Image.Transform.PERSPECTIVE,tuple(B.flatten()[:8]),Image.Resampling.BICUBIC)
 def pts(self,p,A):
  q=np.c_[p,np.ones(len(p))]@A.T;return [tuple(x) for x in (q[:,:2]/q[:,2:])]
 def segment(self,points,a,b):
  points=np.array(points);d=np.linalg.norm(np.diff(points,axis=0),axis=1);cum=np.r_[0,np.cumsum(d)];L=cum[-1]
  a=max(0,min(1,a))*L;b=max(0,min(1,b))*L
  if b<=a:return []
  out=[]
  for j,dist in enumerate(d):
   lo=max(a,cum[j]);hi=min(b,cum[j+1])
   if hi>lo:
    if not out:out.append(points[j]+(points[j+1]-points[j])*(lo-cum[j])/dist)
    out.append(points[j]+(points[j+1]-points[j])*(hi-cum[j])/dist)
  return out
 def frame(self,f):
  if f>=456:return Image.new('RGB',self.size)
  t=f/60;active=state(f);kick=sum(envelope(age,e['duration'])*e.get('velocity',1) for e,age in active if e['system']=='kick')
  A=self.matrix(t,.05);C=self.matrix(t,.6,kick);F=self.matrix(t,.8)
  base=Image.alpha_composite(Image.new('RGBA',self.size,(0,0,0,255)),self.warp(self.layers['board'],A))
  # Emission is split below and above the core, keeping route occlusion physical.
  glow=Image.new('RGB',self.size);D=ImageDraw.Draw(glow)
  energy=0
  for e,age in active:
   sys=e['system'];v=min(1.4,e.get('velocity',1));dur=e['duration'];n=e['ordinal']
   if sys=='cable':
    count=16 if e['sampleFrame']==0 else (3 if t<5.5 else 4)
    for j in range(count):
     ri=(e['route']%4)*14+(e['route']//4)*3+j
     if e['sampleFrame']==0:ri=(j%4)*14+(j//4)*3
     route=self.routes[ri%56]['main']
     speed=1+max(0,t-5.5)*.55
     pos=age/(dur*.94)*speed
     strength=min(1,envelope(age,dur)*2.5)*v
     # dim persistent energization reveals connected copper, not a global flash
     D.line(self.pts(route,A),fill=(0,int(22*strength),int(29*strength)),width=max(1,round(1.6*self.s)))
     trail=self.segment(route,pos-.22,pos)
     if trail:D.line(self.pts(trail,A),fill=(int(20*strength),int(140*strength),int(172*strength)),width=max(1,round(4.5*self.s)),joint='curve')
     head=self.segment(route,pos-.035,pos+.018)
     if head:D.line(self.pts(head,A),fill=(int(160*strength),int(235*strength),int(245*strength)),width=max(1,round(2*self.s)))
   elif sys=='branch':
    # A shared connected route reaches its junction before feeding two fine lanes.
    # Overload increases simultaneous topology and travel speed, not peak white.
    for j in range(2+(t>=5.5)+(t>=7.0)):
     ri=(e['route']*3+j*14)%56;r=self.routes[ri]
     duration=.52/(1+max(0,t-5.5)*1.3)
     pos=age/duration
     path=np.vstack([r['main'][:4],r['branch'][1:]])
     seg=self.segment(path,pos-.13,pos+.012)
     q=min(1,envelope(age,.65)*2)*v
     if seg:D.line(self.pts(seg,A),fill=(int(110*q),int(90*q),int(22*q)),width=max(1,round(2.6*self.s)))
     trunk=np.linalg.norm(np.diff(r['main'][:4],axis=0),axis=1).sum()
     full=np.linalg.norm(np.diff(path,axis=0),axis=1).sum()
     arm=np.linalg.norm(np.diff(r['main'][3:],axis=0),axis=1).sum()
     distance=pos*full-trunk
     if distance>0 and arm>0:
      seg=self.segment(r['main'][3:],(distance-.13*full)/arm,distance/arm)
      if seg:D.line(self.pts(seg,A),fill=(int(22*q),int(105*q),int(120*q)),width=max(1,round(1.6*self.s)))
  # Optical bloom plus a small local spill, generated from the actual route positions.
  base=self.addlight(base,glow,2.4)
  base=Image.alpha_composite(base,self.warp(self.layers['core'],C))
  top=Image.new('RGB',self.size);D=ImageDraw.Draw(top)
  if kick>.01:
   pts=self.pts(self.outline,C);q=min(1,kick*1.1)
   D.line(pts,fill=(int(24*q),int(78*q),int(88*q)),width=max(1,round(2.7*self.s)),joint='curve')
  for e,age in active:
   sys=e['system'];v=min(1.3,e.get('velocity',1));dur=e['duration'];n=e['ordinal']
   if sys=='beast':
    ev=envelope(age,max(.13,dur))*1.35
    syllable=e['event'].lower()
    sweep=min(1,age/max(.07,dur))
    # Each syllable opens a different bank of microscopic compute-tile apertures.
    # A scored syllable selects the aperture pattern, independent of audio loudness.
    for tile in self.tiles:
     ix,iy=tile['ix'],tile['iy'];phase=(ix*.63+iy*.43+n*.91)
     bank=(ix+iy+n)%3
     if syllable=='ka':shape=1 if (ix+n)%2==0 else .22
     elif syllable=='wom':shape=.45+.55*math.cos(iy*.32-sweep*2.4)**2
     elif 'glitch' in syllable:shape=1 if (ix+iy+int(age*60))%3 else .18
     else:shape=.22+.78*math.exp(-((ix-(sweep*7-1))/1.9)**2)
     strength=ev*shape*(.60+.40*math.sin(age*15+phase)**2)*(1 if bank!=0 else .35)
     strength=math.sqrt(max(0,strength))*1.4
     # Gates share the silicon die's two projected physical axes.
     vx,vy=tile['vx'],tile['vy'];p=tile['p']
     length=.29+strength*.045;off=.065+strength*.045
     col=(int(min(255,250*strength)),int(min(160,100*strength)),int(12*strength))
     for sign,fall in [(-1,1),(1,.6)]:
      pts=[p-vx*length+vy*off*sign,p+vx*length+vy*off*sign]
      if strength>.025:ImageDraw.Draw(base).line(self.pts(pts,C),fill=(6,12,12,255),width=max(2,round(7.0*self.s)))
      D.line(self.pts(pts,C),fill=tuple(int(v*fall) for v in col),width=max(1,round(4.0*self.s)))
   elif sys=='snare':
    q=min(1,envelope(age,dur)*1.8)*v
    for j in range(9):
     tile=self.tiles[(j+e['route'])*5%48];p=tile['p'];vx=tile['vx']
     D.line(self.pts([p-vx*.26,p+vx*.26],C),fill=(int(175*q),int(198*q),int(185*q)),width=max(1,round(2.6*self.s)))
  base=self.addlight(base,top,2.5)
  base=Image.alpha_composite(base,self.warp(self.layers['foreground'],F))
  ar=np.asarray(base.convert('RGB')).astype(np.float32)*self.vignette
  # Fixed deterministic film grain, mild enough not to obscure fabricated detail.
  rng=np.random.default_rng(6100+f);grain=rng.normal(0,.48,(self.h,self.w,1))
  ar=np.clip(ar+grain,0,255).astype('uint8');out=Image.fromarray(ar)
  d=ImageDraw.Draw(out);margin=round(self.w*.075)
  # Restrained editorial lockup; removed completely by the terminal blackout.
  alpha=min(1,t/.25) if f else .3
  d.text((margin,self.h*.867),'THE CIRCUIT',font=self.font,fill=(int(213*alpha),int(222*alpha),int(215*alpha)))
  d.text((margin,self.h*.905),'M O R P H   / /   C O M M E R C I A L  0 1',font=self.small,fill=(int(108*alpha),int(139*alpha),int(137*alpha)))
  d.line([(margin,self.h*.847),(margin+round(self.w*.09),self.h*.847)],fill=(90,150,155),width=max(1,round(self.w/1080)))
  return out
 def addlight(self,base,light,strength):
  # Work in exposure-like emission space; shoulder holds localized peaks below white.
  small=light.resize((self.w//2,self.h//2),Image.Resampling.BILINEAR)
  g1=small.filter(ImageFilter.GaussianBlur(3*self.w/1080)).resize(self.size,Image.Resampling.BILINEAR)
  g2=small.filter(ImageFilter.GaussianBlur(14*self.w/1080)).resize(self.size,Image.Resampling.BILINEAR)
  b=np.asarray(base).astype(np.float32);L=np.asarray(light).astype(np.float32)+np.asarray(g1)*.7+np.asarray(g2)*.9
  b[:,:,:3]=255-(255-b[:,:,:3])*np.exp(-L*strength/255)
  return Image.fromarray(np.clip(b,0,255).astype('uint8'))

_WORKER=None
def worker_init(width):
 global _WORKER
 _WORKER=Circuit(width)
def worker_frame(f):
 return f,_WORKER.frame(f).tobytes()

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--proof',action='store_true');ap.add_argument('--stills',action='store_true');ap.add_argument('--frame',type=int);ap.add_argument('--width',type=int,default=1080);ap.add_argument('--output',type=Path)
 a=ap.parse_args();out=a.output or P/'products';out.mkdir(parents=True,exist_ok=True)
 w=360 if a.proof else a.width;c=Circuit(w)
 if a.frame is not None:
  c.frame(a.frame).save(out/f'frame-{a.frame:03d}.png');return
 if a.stills:
  for f in [0,30,150,270,360,444,455,456]:c.frame(f).save(out/f'frame-{f:03d}.png')
  return
 # Proof samples the opening, the call/response and the overload, at 30fps. Three
 # short continuous excerpts use the identical scene/state function as the master.
 if a.proof:
  spans=[(0,72),(180,240),(396,480)];frames=[f for lo,hi in spans for f in range(lo,hi,2)];fps=30;name='circuit-motion-proof.mp4'
  af=';'.join(f'[0:a]atrim=start_sample={lo*735}:end_sample={hi*735},asetpts=PTS-STARTPTS[a{i}]' for i,(lo,hi) in enumerate(spans))
  af+=';'+''.join(f'[a{i}]' for i in range(3))+'concat=n=3:v=0:a=1[out]'
  ref=P/'work/proof-audio.wav';subprocess.run(['ffmpeg','-y','-v','error','-i',str(P/'audio/circuit-reference.wav'),'-filter_complex',af,'-map','[out]','-c:a','pcm_s24le',str(ref)],check=True)
 else:frames=list(range(480));fps=60;name='the-circuit.mp4';ref=P/'audio/circuit-reference.wav'
 cmd=['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{w}x{c.h}','-r',str(fps),'-i','pipe:0','-i',str(ref),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','slow','-crf','17','-pix_fmt','yuv420p','-threads','3','-c:a','aac','-b:a','256k','-ar','44100','-video_track_timescale','60000','-movflags','+faststart','-metadata','title=THE CIRCUIT | MORPH//COMMERCIAL 01',str(out/name)]
 proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
 hashes={}
 pool=None
 if a.proof:rendered=((f,c.frame(f).tobytes()) for f in frames)
 else:
  # Independent frames run on the three available CPU cores. imap preserves
  # exact picture ordering; frame state contains no accumulated simulation.
  pool=multiprocessing.get_context('fork').Pool(3,initializer=worker_init,initargs=(w,))
  rendered=pool.imap(worker_frame,frames,chunksize=1)
 for f,pixels in rendered:
  im=Image.frombytes('RGB',c.size,pixels);proc.stdin.write(pixels)
  if f in [0,30,150,270,360,444,455,456,479]:
   hashes[str(f)]=hashlib.sha256(im.tobytes()).hexdigest()
   if not a.proof:im.save(out/f'frame-{f:03d}.png')
  if f%30==0:print('FRAME',f,flush=True)
 if pool:pool.close();pool.join()
 proc.stdin.close()
 if proc.wait():raise SystemExit('FFmpeg failed')
 audit={'fps':fps,'width':w,'height':c.h,'frames':len(frames),'sourceFrames':frames,'frameHashesRGB':hashes,'events':[{'sourceIndex':e['sourceIndex'],'onsetFrame':e['frame60'],'firstActiveFrame':next((f for f in range(480) if any(q['sourceIndex']==e['sourceIndex'] for q,age in state(f))),None)} for e in EVENTS if e['system'] not in ['blackout','metadata']]}
 (out/('proof-audit.json' if a.proof else 'animation-audit.json')).write_text(json.dumps(audit,indent=2))
 print('DONE',out/name,flush=True)
if __name__=='__main__':main()
