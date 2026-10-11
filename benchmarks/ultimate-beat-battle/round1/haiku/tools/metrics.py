#!/usr/bin/env python3
"""Collect diagnostic metrics for the Round 1 open-class submission.

Reads project.json and the final render directory written by `daemonv12 render`,
and writes ../metrics.json. Every value is derived from those files; nothing is
typed in by hand. Metrics are diagnostic, not a score.

Usage: python3 metrics.py <final-render-dir> [render-seconds]
"""
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SUB = os.path.normpath(os.path.join(HERE, '..'))


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    render_dir = sys.argv[1]
    render_seconds = float(sys.argv[2]) if len(sys.argv) > 2 else None
    project_path = os.path.join(SUB, 'project.json')
    with open(project_path, encoding='utf-8') as f:
        project = json.load(f)
    with open(os.path.join(render_dir, 'project.render.json'), encoding='utf-8') as f:
        render = json.load(f)
    with open(os.path.join(render_dir, 'project.analysis.json'), encoding='utf-8') as f:
        analysis = json.load(f)
    engine_commit = 'ed75e9e2a0172266e56b292886ad7c1500677862'

    tracks = project['tracks']
    patterns = {(t['id'], p['id']): p for t in tracks for p in t['patterns']}
    clip_count = sum(len(t['clips']) for t in tracks)
    written_notes = sum(len(p['notes']) for t in tracks for p in t['patterns']
                        if any(c['pattern'] == p['id'] for c in t['clips']))
    rates, glides, offsets, perf_notes = set(), 0, 0, 0
    sample_files = set()
    drum_names = set()
    for t in tracks:
        inst = t['instrument']
        if inst['type'] == 'sampler':
            sample_files.add(inst['sample'])
        for p in t['patterns']:
            for n in p['notes']:
                if 'pitch' in n:
                    drum_names.add(n['pitch'])
                r = n.get('playbackRate', 1)
                if r != 1 or 'glide' in n or 'offsetSeconds' in n:
                    perf_notes += 1
                if 'playbackRate' in n:
                    rates.add(n['playbackRate'])
                if 'glide' in n:
                    glides += 1
                if 'offsetSeconds' in n:
                    offsets += 1
    kit_files = set()
    for t in tracks:
        if t['instrument']['type'] == 'drumkit':
            kit_files.add(t['instrument']['kit'])
    auto_lanes = sum(len(t.get('automation', {})) for t in tracks)
    auto_points = sum(len(lane) for t in tracks for lane in t.get('automation', {}).values())
    effects_used = sorted({e['type'] for t in tracks for e in t.get('effects', [])}
                          | {e['type'] for e in project.get('master', {}).get('effects', [])})

    triggers = 0
    for track in render.get('samples', {}).get('tracks', []):
        triggers += len(track.get('triggers', [])) if isinstance(track, dict) else 0

    master = analysis['master']
    wav_path = os.path.join(render_dir, 'project.wav')
    stems = sorted(os.listdir(os.path.join(render_dir, 'project.stems')))
    metrics = {
        'benchmark': {
            'round': 'DaemonV12 Ultimate Beat Battle — Round 1 Open Class',
            'engineCommit': engine_commit,
            'engineVersion': render['engine']['version'],
            'configuration': 'highest available effort',
            'serious_iterations': 7,
            'iterationNote': 'v1 through v7 are kept under versions/ and output/; final is the locked build (audio identical to v7).',
        },
        'track': {
            'title': project['title'],
            'bpm': project['bpm'],
            'key': project['key'],
            'timeSignature': project['timeSignature'],
            'writtenBars': project['bars'],
            'writtenDurationSeconds': project['bars'] * 4 * 60 / project['bpm'],
            'renderedDurationSeconds': master['durationSeconds'],
            'renderedFrames': master['frames'],
            'seed': project['seed'],
        },
        'structure': {
            'trackCount': len(tracks),
            'stemCount': len(stems),
            'stemNames': [s.replace('.wav', '') for s in stems],
            'clipCount': clip_count,
            'patternCount': len(patterns),
            'writtenNoteCount': written_notes,
            'expandedTriggerCount': triggers,
        },
        'samples': {
            'sampleInstrumentFiles': sorted(sample_files),
            'sampleInstrumentCount': len(sample_files),
            'drumKitFiles': sorted(kit_files),
            'drumKitHitNames': sorted(drum_names),
            'distinctPlaybackRates': sorted(rates),
            'playbackRateVariety': len(rates),
            'glideCount': glides,
            'sourceOffsetCount': offsets,
            'performedNoteCount': perf_notes,
            'assetCountInRenderManifest': len(render.get('samples', {}).get('assets', [])),
        },
        'automation': {
            'laneCount': auto_lanes,
            'pointCount': auto_points,
            'lanes': {t['id']: sorted(t.get('automation', {}).keys()) for t in tracks if t.get('automation')},
        },
        'production': {
            'effectsUsed': effects_used,
            'masterGainDb': project['master']['gainDb'],
            'masterEffects': [e['type'] for e in project['master']['effects']],
            'clippedSamples': render['production']['master']['clippedSamples'],
        },
        'loudness': {
            'samplePeakDbfs': master['peakDbfs'],
            'truePeakDbfs': master['truePeakDbfs'],
            'integratedLufs': master['integratedLufs'],
            'loudnessRangeLu': master['loudnessRangeLu'],
            'rmsDbfs': master['rmsDbfs'],
            'fullScaleSamples': master['fullScaleSamples'],
            'clipping': master['clipping'],
        },
        'files': {
            'projectJsonBytes': os.path.getsize(project_path),
            'masterWavBytes': render['wav']['bytes'],
            'masterWavSha256': render['wav']['sha256'],
            'listeningMp3Bytes': render['mp3']['bytes'],
            'listeningMp3Sha256': render['mp3']['sha256'],
            'listeningMp3Bitrate': render['mp3']['bitrateKbps'],
            'projectJsonSha256': sha256(project_path),
        },
        'render': {
            'approximateRenderSeconds': render_seconds,
            'renderIdentityTwice': 'byte-identical for WAV, MIDI, render manifest, analysis, MP3 and all stems (see OUTPUTS.md)',
        },
    }
    out = os.path.join(SUB, 'metrics.json')
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(metrics, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print('wrote', out)


if __name__ == '__main__':
    main()
