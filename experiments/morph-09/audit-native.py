import bpy,json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[2];s=bpy.context.scene;r=bpy.data.objects['True telemetry rotor'];blend=root/'experiments/morph-09/review/resonant-rotor.blend'
source=root/'experiments/morph-08/candidates/overtone.wav'
curves=[{'property':fc.data_path,'axis':fc.array_index,'keys':len(fc.keyframe_points),'firstFrame':fc.keyframe_points[0].co.x,'lastFrame':fc.keyframe_points[-1].co.x} for fc in r.animation_data.action.fcurves]
sounds=[]
for x in s.sequence_editor.sequences_all:
 if x.type!='SOUND':continue
 packed=bytes(x.sound.packed_file.data) if x.sound.packed_file else b''
 sounds.append({'name':x.name,'frameStart':x.frame_start,'frameDuration':x.frame_final_duration,'packed':bool(x.sound.packed_file),'packedBytes':len(packed),'packedWavSha256':hashlib.sha256(packed).hexdigest() if packed else None,'sourceWavSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'packedWavExactlyMatchesApproved':packed==source.read_bytes()})
s.frame_set(1);first=float(r.rotation_euler.z);s.frame_set(480);last=float(r.rotation_euler.z)
f=s.camera.data.view_frame(scene=s)
report={'kind':'morph09-native-scene-audit','sceneFile':'experiments/morph-09/review/resonant-rotor.blend','sceneFileSha256':hashlib.sha256(blend.read_bytes()).hexdigest(),'blenderVersion':bpy.app.version_string,'openedSuccessfully':True,'renderWasPerformed':False,'frameRange':[s.frame_start,s.frame_end],'framesPerSecond':s.render.fps/s.render.fps_base,'dimensions':[s.render.resolution_x,s.render.resolution_y],'resolutionPercent':s.render.resolution_percentage,'camera':{'type':s.camera.data.type,'fixed':not bool(s.camera.animation_data or s.camera.data.animation_data),'verticalSpan':max(x.y for x in f)-min(x.y for x in f),'horizontalSpan':max(x.x for x in f)-min(x.x for x in f)},'rotorAnimationCurves':curves,'rotorAnglesRadians':{'frame1':first,'frame480':last},'packedSounds':sounds,'checksPassed':['Scene opens in Blender without rendering','Frame range 1–480 at 60 fps','Proof dimensions 384 × 480 at 100%','Rotor has 480 editable keys per transform channel','Camera has no animation','Approved WAV is packed byte-for-byte and spans all 480 frames']}
assert report['frameRange']==[1,480] and report['framesPerSecond']==60
assert report['dimensions']==[384,480] and report['resolutionPercent']==100
assert all(c['keys']==480 and c['firstFrame']==1 and c['lastFrame']==480 for c in curves)
assert report['camera']['fixed']
assert sounds and all(x['packedWavExactlyMatchesApproved'] and x['frameDuration']==480 and x['frameStart']==1 for x in sounds)
(root/'work/morph-09/native-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'nativeChecksPassed':report['checksPassed'],'packedAudioSha256':sounds[0]['packedWavSha256']},indent=2))
