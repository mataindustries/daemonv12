"""Audit and package existing renders; never alters the engine or final audio."""
from pathlib import Path
from collections import Counter
import hashlib
import json
import platform
import shutil
import subprocess
import wave
import zipfile
import numpy as np
import scipy

ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[3]
FINAL=ROOT/'output/soft-teeth'
REPEAT=ROOT/'output/determinism'
LOCK='ed75e9e2a0172266e56b292886ad7c1500677862'

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text())
def write(name,value):(ROOT/name).write_text(json.dumps(value,indent=2)+'\n')
def git(*args):return subprocess.check_output(['git',*args],cwd=REPO,text=True).strip()

assert git('rev-parse','HEAD')==LOCK
assert git('diff','--name-only')==''
assert (ROOT/'project.json').read_bytes()==(ROOT/'v03.project.json').read_bytes()
assert sha(FINAL/'project.wav')==sha(ROOT/'output/v03/v03.project.wav')
project=read(ROOT/'project.json')
result=read(FINAL/'cli-result.json')
native=read(FINAL/'project.render.json')
analysis=read(FINAL/'project.analysis.json')
evidence=read(FINAL/'evidence.json')
assert result['ok'] and not result['errors'] and not result['warnings']
assert 25<=analysis['master']['durationSeconds']<=30
assert not analysis['master']['clipping']
assert native['production']['master']['clippedSamples']==0
assert all(t['clippedSamples']==0 for t in native['production']['tracks'])
assert all(t['analysis']['frames']==analysis['master']['frames'] for t in analysis['tracks'])

canonical=[FINAL/'project.wav',FINAL/'project.mid',FINAL/'project.analysis.json',FINAL/'project.render.json',*sorted((FINAL/'project.stems').glob('*.wav'))]
checks=[]
for p in canonical:
    q=REPEAT/p.relative_to(FINAL)
    same=p.read_bytes()==q.read_bytes()
    checks.append({'file':str(p.relative_to(FINAL)),'sha256':sha(p),'repeat_sha256':sha(q),'byte_identical':same})
    assert same
write('determinism.json',{'scope':'Same locked checkout, runtime, binaries, SoundFont and sources; independent complete CLI renders.','all_canonical_artifacts_byte_identical':True,
    'checks':checks,'mp3_also_byte_identical':(FINAL/'project.mp3').read_bytes()==(REPEAT/'project.mp3').read_bytes(),
    'mp3_note':'Observed equality only; MP3 is outside the engine deterministic guarantee.',
    'render_seconds':[read(FINAL/'render-time.json')['elapsed_seconds'],read(REPEAT/'render-time.json')['elapsed_seconds']]})

asset_manifest=read(ROOT/'assets-manifest.json')
for a in asset_manifest['sounds']:
    assert sha(ROOT/a['file'])==a['sha256']
    if 'source' in a:assert sha(REPO/a['source'])==a['sha256']

tracks=project['tracks']
all_notes=[n for t in tracks for pat in t['patterns'] for n in pat['notes']]
sample_notes=[n for t in tracks if t['instrument']['type']!='gm' for pat in t['patterns'] for n in pat['notes']]
effects=Counter(e['type'] for t in tracks for e in t.get('effects',[]))
effects.update(e['type'] for e in project['master'].get('effects',[]))
metrics={'engine_commit':LOCK,'engine_version':result['engineVersion'],'model':'GPT-6 Astra','reasoning_setting':'Max',
 'round':'Ultimate Beat Battle — Round 1 Open Class','track_title':project['title'],'bpm':project['bpm'],
 'key':'D minor, with Dorian colour','time_signature':'4/4','bars':16,
 'duration_seconds':analysis['master']['durationSeconds'],'authored_duration_seconds':result['summary']['durationSeconds'],
 'iteration_count':3,'track_count':len(tracks),'event_count':len(all_notes),
 'event_count_definition':'Authored note objects/triggers; no clip repeats in this score. A GM chord is one event.',
 'expanded_note_count':result['summary']['notes'],'sample_trigger_count':len(sample_notes),
 'gm_note_count':result['summary']['notes']-len(sample_notes),
 'sample_count':len(asset_manifest['sounds']),'custom_sample_count':3,'unaltered_shipped_sample_count':3,
 'automation_count':sum(len(t.get('automation',{})) for t in tracks),
 'automation_count_definition':'Independent track automation lanes.','automation_point_count':sum(len(lane) for t in tracks for lane in t.get('automation',{}).values()),
 'playback_rate_events':sum(n.get('playbackRate',1)!=1 for n in sample_notes),
 'glide_count':sum('glide' in n for n in sample_notes),'source_offset_count':sum('offsetSeconds' in n for n in sample_notes),
 'effect_usage':dict(effects),'stem_count':len(analysis['tracks']),
 'master_peak_dbfs':analysis['master']['peakDbfs'],'true_peak_dbtp':analysis['master']['truePeakDbfs'],
 'integrated_lufs':analysis['master']['integratedLufs'],'lra_lu':analysis['master']['loudnessRangeLu'],
 'master_rms_dbfs':analysis['master']['rmsDbfs'],'crest_db':evidence['crest_db'],
 'master_clipped_samples':0,'track_clipped_samples':0,'sample_rate':44100,'bits_per_sample':16,'channels':2,
 'project_json_bytes':(ROOT/'project.json').stat().st_size,'project_json_sha256':sha(ROOT/'project.json'),
 'deterministic_render_sha256':sha(FINAL/'project.wav'),'approximate_render_seconds':read(FINAL/'render-time.json')['elapsed_seconds'],
 'repeat_render_seconds':read(REPEAT/'render-time.json')['elapsed_seconds'],
 'second_render_byte_identical':True,'master_path':'output/soft-teeth/project.wav','mp3_path':'output/soft-teeth/project.mp3',
 'stems_directory':'output/soft-teeth/project.stems','native_manifest':'output/soft-teeth/project.render.json'}
write('metrics.json',metrics)
shutil.copyfile(FINAL/'project.analysis.json',ROOT/'analysis.json')
shutil.copyfile(FINAL/'evidence.json',ROOT/'analysis-evidence.json')
write('provenance.json',{'engine_commit':LOCK,'engine_version':result['engineVersion'],'native_manifest':'output/soft-teeth/project.render.json',
    'project_sha256':sha(ROOT/'project.json'),'master_sha256':sha(FINAL/'project.wav'),
    'runtime':native['production']['runtime'],'audio_tool':native['audioTool'],'gm_renderer':native['gmRenderer'],
    'soundfont':native['soundfont'],'python':platform.python_version(),'numpy':np.__version__,'scipy':scipy.__version__,
    'environment_script':'/workspace/.daemonv12-audio/env.sh','environment_script_sha256':sha(Path('/workspace/.daemonv12-audio/env.sh')),
    'headless_wrapper':'/tmp/daemonv12-fluidsynth-headless','headless_wrapper_sha256':sha(Path('/tmp/daemonv12-fluidsynth-headless')),
    'asset_manifest':'assets-manifest.json','asset_generation_verification':'asset-determinism.json',
    'render_verification':'determinism.json','final_audio_postprocessing':'None. WAV and MP3 are direct DaemonV12 CLI outputs.',
    'git_tracked_diff':git('diff','--name-only'),'git_status':git('status','--short'),
    'committed':False,'pushed':False})

hash_files=[ROOT/'project.json',FINAL/'project.wav',FINAL/'project.mp3',FINAL/'project.mid',FINAL/'project.render.json',FINAL/'project.analysis.json',
            *sorted((FINAL/'project.stems').glob('*.wav')),*sorted((ROOT/'assets').glob('*.wav'))]
(ROOT/'SHA256SUMS.txt').write_text(''.join(f'{sha(p)}  {p.relative_to(ROOT)}\n' for p in hash_files))

stem_roles={'heel':'Short mono kick, weight without a sustained boom.','chrome':'Pitched clap/backbeat with restrained room.',
 'needles':'Small swung high-frequency punctuation.','knuckles':'Opposing mechanical syncopations and a triplet tick fill.',
 'pocket':'Centered pitched bass; answers and spaces around the kick.','mouth':'Main rubber-reed melody, glides and final triplet.',
 'mutter':'Lower-register call-and-response.','velvet':'GM electric-piano voicings; the Bbmaj7 / G13 opening.',
 'afterimage':'Sparse, filtered reed reflections.'}
index=['# SOFT TEETH — output index','',
 '[Final WAV](output/soft-teeth/project.wav) · [Listening MP3](output/soft-teeth/project.mp3) · [Submission ZIP](output/soft-teeth-submission.zip)','',
 '[Project](project.json) · [Notes](NOTES.md) · [Metrics](metrics.json) · [SHA-256](SHA256SUMS.txt)','',
 '[Native render manifest](output/soft-teeth/project.render.json) · [Analysis](analysis.json) · [Evidence plot](output/soft-teeth/evidence.png) · [Detailed evidence](analysis-evidence.json) · [Determinism verification](determinism.json)','',
 '## Aligned production stems','',
 'Each stereo PCM16 WAV starts at frame zero and has 1,227,132 frames. Stems include track automation and effects, and exclude master gain/effects. Their unprocessed sum is not the mastered file.','',
 '| Stem | Role |','|---|---|']
for name,role in stem_roles.items():index.append(f'| [{name}](output/soft-teeth/project.stems/{name}.wav) | {role} |')
index += ['','## Iteration evidence','',
 '[Decisions](ITERATIONS.md) · [Measurements](iteration-comparison.json)','',
 'Optional gain-matched listening copies (approximately −21.5 LUFS each): [V01](output/comparison/v01-matched.mp3), [V02](output/comparison/v02-matched.mp3), [V03](output/comparison/v03-matched.mp3).','',
 'Large audio and render scratch files live exclusively under the locally ignored `output/` directory. The ZIP contains the final submission and small source files, not the earlier masters or duplicate verification render.','']
(ROOT/'OUTPUTS.md').write_text('\n'.join(index))

print(json.dumps(metrics,indent=2))
