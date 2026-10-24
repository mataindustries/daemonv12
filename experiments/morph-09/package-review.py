#!/usr/bin/env python3
"""Assemble review media only. No engine invocation, DSP, publishing or master render."""
from pathlib import Path
import subprocess,shutil,json,hashlib,sys
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'work/morph-09';DEST=ROOT/'experiments/morph-09/review'
DEST.mkdir(parents=True,exist_ok=True)
def run(*args):subprocess.run(list(map(str,args)),check=True)
audio=ROOT/'experiments/morph-08/candidates/overtone.wav'
if (DEST/'resonant-rotor.blend').exists():
 native=json.loads((WORK/'native-audit.json').read_text())
 assert native['sceneFileSha256']==hashlib.sha256((DEST/'resonant-rotor.blend').read_bytes()).hexdigest()
 assert all(x['packedWavExactlyMatchesApproved'] for x in native['packedSounds'])
frames=WORK/'motion-final'
assert {p.name for p in frames.glob('[0-9][0-9][0-9][0-9].png')}=={f'{i:04d}.png' for i in range(480)}
# Preserve approved PCM sample-for-sample in the primary low-resolution proof.
mov=DEST/'overtone-proof.mov';mp4=DEST/'overtone-preview.mp4'
run('ffmpeg','-v','error','-y','-framerate','60','-i',frames/'%04d.png','-i',audio,'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p','-c:a','copy','-frames:v','480','-movflags','+faststart',mov)
run('ffmpeg','-v','error','-y','-i',mov,'-map','0:v:0','-map','0:a:0','-c:v','copy','-c:a','aac','-b:a','256k','-movflags','+faststart',mp4)
run(sys.executable,ROOT/'experiments/morph-09/verify.py','--out',WORK,'--proof',mov)
for name in ['sync-audit.csv','loop-audit.json','sync-timeline.png','native-audit.json']:
 if (WORK/name).exists():shutil.copy2(WORK/name,DEST/name)
for name in ['overtone-0080.png','overtone-2250.png','overtone-6580.png']:
 shutil.copy2(WORK/'stills'/name,DEST/name)
fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font=ImageFont.truetype(fontpath,22);small=ImageFont.truetype(fontpath,15);big=ImageFont.truetype(fontpath,34)
# Three high-quality representative moments with room for a human to read them.
sheet=Image.new('RGB',(1320,710),'#0c1c22');dr=ImageDraw.Draw(sheet)
dr.text((28,20),'OVERTONE  /  THE MACHINE THAT MAKES MUSIC',font=big,fill='#e4d9c3')
for i,(name,label,detail) in enumerate([('overtone-0080.png','00.080 / ENGAGE','Brush impact and singing forks'),('overtone-2250.png','02.250 / HARMONIC VARIATION','Same gesture, new tuning'),('overtone-6580.png','06.580 / A1 LOCK','Contacts fuse; five lights converge')]):
 im=Image.open(DEST/name).convert('RGB');im.thumbnail((416,520));x=20+i*440;sheet.paste(im,(x,89))
 dr.text((x+5,623),label,font=font,fill='#dfba86');dr.text((x+5,659),detail,font=small,fill='#a8bcbc')
sheet.save(DEST/'contact-sheet.png')
# Inspect a real boundary sequence: no duplicated end frame is inserted into the movie.
seam=Image.new('RGB',(1320,625),'#0c1c22');dr=ImageDraw.Draw(seam)
dr.text((24,18),'LOOP BOUNDARY  /  THREE CONSECUTIVE PICTURES',font=big,fill='#e4d9c3')
for i,(f,label) in enumerate([(478,'7.966667 s'),(479,'7.983333 s'),(0,'8.000000 s → 0.000000 s')]):
 im=Image.open(frames/f'{f:04d}.png').convert('RGB');im.thumbnail((400,500));x=30+i*440;seam.paste(im,(x,79));dr.text((x,589),label,font=font,fill='#dfba86')
seam.save(DEST/'loop-boundary.png')
# Quantify the source pictures at the actual loop boundary relative to ordinary adjacent-frame changes.
import numpy as np
im=lambda n:np.asarray(Image.open(frames/f'{n:04d}.png').convert('RGB'),dtype=np.float32)
first,last,prev,second=im(0),im(479),im(478),im(1)
for file in ['opening.png','physical-endpoint.png']:
 if (WORK/'seam'/file).exists():shutil.copy2(WORK/'seam'/file,DEST/file)
image_metrics={'metric':'Mean absolute RGB difference in 8-bit values; images are consecutive times, not identical states.', '478_to_479':float(np.abs(prev-last).mean()),'479_to_0':float(np.abs(last-first).mean()),'0_to_1':float(np.abs(first-second).mean()),'noDuplicateClosingFrame':True}
if (WORK/'seam/opening.png').exists():
 pa=np.asarray(Image.open(WORK/'seam/opening.png').convert('RGB'),dtype=np.float32)
 pb=np.asarray(Image.open(WORK/'seam/physical-endpoint.png').convert('RGB'),dtype=np.float32)
 image_metrics['rawPhysicalEndpointVsOpeningMeanAbsoluteRgb']=float(np.abs(pa-pb).mean())
 image_metrics['physicalEndpointNote']='Nonrotor state held at its periodic boundary value; rotor advanced to the actual unwrapped t=8 endpoint, without orientation correction.'
(DEST/'image-boundary.json').write_text(json.dumps(image_metrics,indent=2)+'\n')
audit=json.loads((DEST/'loop-audit.json').read_text());media=audit['renderedProof']
html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MORPH//09 · OVERTONE creative review</title>
<style>body{margin:0;background:#09171c;color:#e7e9e1;font:16px/1.6 system-ui,sans-serif}main{max-width:1120px;margin:auto;padding:36px 24px 60px}h1{font-weight:450;font-size:clamp(28px,5vw,56px);line-height:1.1;letter-spacing:-.035em;margin:12px 0}h2{font-weight:450;font-size:24px;margin:38px 0 14px}.eyebrow{color:#d5aa78;letter-spacing:.18em;font-size:12px}.lede{max-width:720px;color:#b5c6c6;font-size:19px}.hero{display:grid;grid-template-columns:minmax(260px,384px) 1fr;gap:36px;align-items:center;margin:32px 0}video{width:100%;background:#071014;border-radius:10px}a{color:#dfba86;text-underline-offset:4px}img{width:100%;height:auto;border-radius:8px}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:14px;border-bottom:1px solid #2b3c3e;vertical-align:top}th{color:#d5aa78;font-weight:500}small,.quiet{color:#9fb3b3}.facts{display:flex;flex-wrap:wrap;gap:12px 24px;margin:22px 0}.facts span{border-top:1px solid #51615c;padding-top:8px}.links{display:flex;gap:12px 24px;flex-wrap:wrap}code{font-size:13px;overflow-wrap:anywhere}.approval{border:1px solid #6b5c43;border-radius:8px;padding:22px;margin-top:36px}@media(max-width:700px){.hero{grid-template-columns:1fr}video{max-width:384px;margin:auto}td,th{padding:9px}}</style>
<main><div class="eyebrow">MORPH // 09 — MOTION DESIGN PROOF</div><h1>The machine that makes music.</h1><p class="lede">OVERTONE becomes a precision electromagnetic instrument. One copper contact enters a ceramic brush; a metal fork answers. The same gesture becomes a groove, a weight, then a sustained pitch.</p>
<div class="facts"><span>8.000 seconds</span><span>384 × 480 · 60 fps</span><span>16 contacts · 5 resonators</span><span>Fixed camera</span></div>
<div class="hero"><video controls loop playsinline preload="metadata" poster="overtone-0080.png"><source src="overtone-preview.mp4" type="video/mp4"></video><div><h2>Watch with sound. Then watch again.</h2><p>The rotor uses the actual continuous motor telemetry. The band operates separate, visible parts of the mechanism: bass contracts the outer hoop; the sung hook bows the lower silver arch; kick, clap and hats articulate the hub and side fingers.</p><p>At the final A1 lock, the central collar closes and the five fork lights converge to ivory. Braking restores the opening rhythm while the instrument stays illuminated.</p><div class="links"><a href="overtone-proof.mov" download>PCM reference proof (.mov)</a><a href="overtone-preview.mp4" download>Viewing copy (.mp4)</a></div><p><small>The MOV retains the approved PCM samples exactly. MP4 uses AAC for convenient viewing.</small></p></div></div>
<h2>Three representative moments</h2><a href="contact-sheet.png"><img src="contact-sheet.png" alt="Three actual renders: initial contact, harmonic variation, final harmonic lock"></a>
<p class="links"><a href="overtone-0080.png">Engage still</a><a href="overtone-2250.png">Harmonic variation still</a><a href="overtone-6580.png">Pitch lock still</a></p>
<h2>Four bars, one behavior</h2><table><tr><th>0–2 s</th><td>Establish the swung contact–brush–fork response in Am7 immediately.</td></tr><tr><th>2–4 s</th><td>Repeat in Fmaj7. The tuning collars slide and the 3.5-second load grips before release.</td></tr><tr><th>4–6 s</th><td>Actual half-speed rotation creates a heavier, more deliberate pattern through Dm7 and E7.</td></tr><tr><th>6–8 s</th><td>Accelerate, fuse at 6.235 s, lock to A1 at 6.499 s, brake at 6.763 s and return to Am at 7.000 s.</td></tr></table>
<h2>Evidence of synchronization</h2><img src="sync-timeline.png" alt="Actual telemetry speed above six lanes of musical event triggers"><p>All 480 telemetry samples are preserved. The 52 exported contact events align with the brush crossing within 0.009°; 30 selected tine strikes excite the resonators. All 205 source event times are retained. Their maximum eligible-frame quantization is 16.395 ms; structural events describe the mechanism rather than each producing a separate impulse. No music is retimed.</p><p class="links"><a href="sync-audit.csv">Every event / CSV</a><a href="loop-audit.json">Numerical audit / JSON</a></p>
<h2>Continuity through the boundary</h2><img src="loop-boundary.png" alt="Final two frames followed by the opening frame, forming three consecutive pictures across the eight-second boundary"><p>Lighting, vibration and tuning include prior-cycle tails. There is no blackout or duplicated closing picture. The unmodified motor has a small physical residual: 0.0125866° of orientation and 0.0718% of speed. Rounded opening telemetry gives the renderer a 0.0124887° residual and a 0.0799% speed difference. Neither is corrected. The sixteen identical rotor features have no unique orientation marker. Raw mechanics are nearly periodic, rather than mathematically exact.</p><p class="quiet">During pitch fusion, an annular surrogate approximates exposure of repeated rotor features. Temporal motion-blur samples are not rendered in this lightweight proof. This is a creative motion proof, with three 768 × 960 stills; no full-resolution animation master has been rendered.</p>
<div class="approval"><div class="eyebrow">HUMAN CREATIVE REVIEW</div><p>Does the contact → vibration gesture read immediately? Does bar three feel heavier? Does the final convergence make the return satisfying?</p><p class="quiet">Paused here for creative approval. Nothing published. DaemonV12, the approved music, motor score and source telemetry are unchanged.</p></div>
<p class="quiet"><small>Source: mataindustries/daemonv12 · feat/morph-08-motor-groove · <code>dd705942faec535433b3b030c990e247261ce905</code><br>Work branch: <code>feat/morph-09-resonant-rotor</code></small></p></main></html>'''
if (DEST/'resonant-rotor.blend').exists():html=html.replace('<h2>Three representative moments</h2>','<p class="links"><a href="resonant-rotor.blend" download>Editable scene · baked 60 fps animation</a></p><h2>Three representative moments</h2>')
(DEST/'index.html').write_text(html)
manifest={'sourceCommit':'dd705942faec535433b3b030c990e247261ce905','branch':'feat/morph-09-resonant-rotor','status':'Awaiting human creative approval','files':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(DEST.iterdir()) if p.is_file() and p.name!='manifest.json'}}
(DEST/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'review':str(DEST),'media':media,'imageBoundary':image_metrics},indent=2))
