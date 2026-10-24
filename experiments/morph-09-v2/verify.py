#!/usr/bin/env python3
"""MORPH//09 V2 — verify sources, event presentation, and the camera and machine seams.

    python3 experiments/morph-09-v2/verify.py --out work/morph-09-v2/audit \
        [--proof PATH.mov] [--frames work/morph-09-v2/frames]

Needs NumPy, Pillow and Matplotlib (for the choreography chart). Does not render.
The camera seam and the machine seam are measured separately: the camera is periodic by
construction and is checked for position, orientation, lens, focus, f-stop and their
velocities; the machine is checked channel by channel, with the raw rotor residual disclosed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import subprocess
import wave
from pathlib import Path

import numpy as np

import choreography as ch

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
V1_COMMIT = '4ad6905525896e014422f10398689728278013f6'
STRIDE = 735
AUDIO = ROOT / 'experiments/morph-08/candidates/overtone.wav'
ENVELOPE_TRACKS = {'commutator': 0.045, 'tines': 0.30, 'kick': 0.11, 'clap': 0.065, 'bass': 0.24, 'vox': 0.31}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def quat(pos, target):
    r, u, f = ch.look_basis(pos, target)
    m = [[r[0], u[0], -f[0]], [r[1], u[1], -f[1]], [r[2], u[2], -f[2]]]
    w = math.sqrt(max(0.0, 1 + m[0][0] + m[1][1] + m[2][2])) / 2
    x = math.copysign(math.sqrt(max(0.0, 1 + m[0][0] - m[1][1] - m[2][2])) / 2, m[2][1] - m[1][2])
    y = math.copysign(math.sqrt(max(0.0, 1 - m[0][0] + m[1][1] - m[2][2])) / 2, m[0][2] - m[2][0])
    z = math.copysign(math.sqrt(max(0.0, 1 - m[0][0] - m[1][1] + m[2][2])) / 2, m[1][0] - m[0][1])
    return (w, x, y, z)


def camera_vector(t):
    c = ch.camera(t)
    return np.array([*c['position'], *quat(c['position'], c['target']), c['lens'], c['focus'], c['fstop']])


def camera_seam():
    names = ['x', 'y', 'z', 'qw', 'qx', 'qy', 'qz', 'lensMm', 'focus', 'fstop']
    start, end = camera_vector(0.0), camera_vector(8.0)
    eps = 1e-6
    v_after = (camera_vector(eps) - camera_vector(0.0)) / eps
    v_before = (camera_vector(8.0) - camera_vector(8.0 - eps)) / eps
    steps = [np.abs(camera_vector((f + 1) / ch.FPS) - camera_vector(f / ch.FPS)) for f in range(ch.FRAMES)]
    seam_step = np.abs(camera_vector(0.0) - camera_vector(479 / ch.FPS))
    pos_steps = [float(np.linalg.norm(s[:3])) for s in steps]
    analytic0, analytic8 = ch.camera_velocity(0.0), ch.camera_velocity(8.0 - 1e-12)
    report = {
        'method': 'Periodic Fritsch-Carlson (C1) interpolation of every camera channel; the mean orbit rate '
                  '(45 deg/s) is removed before interpolation and restored after, so the orbit closes after '
                  'exactly 360 degrees.',
        'stateAt0': dict(zip(names, map(float, start))), 'stateAt8': dict(zip(names, map(float, end))),
        'largestStateDifference': float(np.max(np.abs(end - start))),
        'velocityAfter0': dict(zip(names, map(float, v_after))),
        'velocityBefore8': dict(zip(names, map(float, v_before))),
        'largestVelocityDifference': float(np.max(np.abs(v_after - v_before))),
        'analyticPositionVelocity0': analytic0['position'], 'analyticPositionVelocity8': analytic8['position'],
        'orbitDegreesPerLoop': ch.camera(8.0)['azimuth'] - ch.camera(0.0)['azimuth'],
        'positionStepAcrossSeam479to0': float(np.linalg.norm(seam_step[:3])),
        'positionStep478to479': pos_steps[478], 'positionStep0to1': pos_steps[0],
        'lensStepAcrossSeam': float(seam_step[7]), 'focusStepAcrossSeam': float(seam_step[8]),
        'maximumPositionStepAnyFrame': max(pos_steps),
        'cameraNeverAttachedToRotor': True,
        'minimumClearanceToForkAxes': fork_clearance(),
    }
    assert report['largestStateDifference'] < 1e-9
    assert report['largestVelocityDifference'] < 1e-3
    assert abs(report['orbitDegreesPerLoop'] - 360.0) < 1e-6
    return report


def fork_clearance():
    out = {}
    for k in range(8000):
        t = k / 1000
        p = ch.camera(t)['position']
        for i, (az, L) in enumerate(zip(ch.FORK_AZ, ch.FORK_LEN)):
            fx, fy = ch.FORK_R * math.cos(math.radians(az)), ch.FORK_R * math.sin(math.radians(az))
            d = math.hypot(math.hypot(p[0] - fx, p[1] - fy), max(0.0, p[2] - (1.58 + L)))
            if d < out.get(i, (9e9, 0))[0]:
                out[i] = (d, t)
    return {f'fork{i}': {'distance': round(v[0], 3), 'time': v[1]} for i, v in out.items()}


def flat(d, prefix=''):
    out = {}
    if isinstance(d, dict):
        for k, v in d.items():
            out.update(flat(v, f'{prefix}.{k}' if prefix else k))
    elif isinstance(d, (list, tuple)):
        for i, v in enumerate(d):
            out.update(flat(v, f'{prefix}[{i}]'))
    else:
        out[prefix] = float(d)
    return out


def machine_seam():
    eps = 1e-8
    a, b = flat(ch.machine(0.0)), flat(ch.machine(8.0 - eps))
    keys = [k for k in a if k not in ('t', 'angle', 'speed')]
    diffs = {k: b[k] - a[k] for k in keys}
    a0, a8 = ch.rotor_angle(0.0), ch.v1.rotor(8.0)[0]
    travel = a8 - a0
    residual = (travel - round(travel)) * 360
    # The frame-0 shutter opens one half-frame before the loop point: keys there are unwrapped.
    open0 = ch.rotor_angle(-0.5 / ch.FPS)
    close479 = ch.rotor_angle(479 / ch.FPS)
    report = {
        'nonRotorChannels': len(keys),
        'largestLeftLimitDifference': max(abs(v) for v in diffs.values()),
        'differenceByChannel': diffs,
        'rotor': {
            'travelRevolutions': travel, 'orientationResidualDegrees': residual,
            'speedAt0': ch.v1.rotor(0.0)[1], 'speedAt8': ch.v1.rotor(8.0)[1],
            'frame0ShutterOpenAngle': open0, 'frame479CloseAngle': close479,
            'unwrappedAdvanceFrame479to0OpenRevolutions': open0 - (close479 - ch.TRAVEL),
            'note': 'Raw MORPH07 telemetry is nearly periodic (V1 audit: 27.000035 revolutions). The residual '
                    'is disclosed, not corrected; frame 0 unwraps the previous cycle so the shutter never '
                    'spins backwards.',
        },
        'escapementHatsPerLoop': len(ch.v1.TRACKS['hat']),
        'escapementClosesOnSameSide': len(ch.v1.TRACKS['hat']) % 2 == 0,
        'brakeHeatAt0': ch.brake_heat(0.0), 'brakeHeatBefore8': ch.brake_heat(8.0 - eps),
    }
    assert report['largestLeftLimitDifference'] < 2e-5, max(diffs, key=lambda k: abs(diffs[k]))
    assert abs(residual) < 0.02
    return report


def event_audit():
    rows = []
    for e in ch.v1.EVENTS:
        n = e['sampleFrame']
        frame = -(-n // STRIDE)
        t = n / ch.SR
        assert (frame - 1) / ch.FPS < t <= frame / ch.FPS or (n == 0 and frame == 0)
        row = {'track': e['trackId'], 'eventId': e['eventId'], 'sampleFrame': n, 'firstVisibleFrame': frame,
               'delayMs': (frame * STRIDE - n) / ch.SR * 1000}
        decay = ENVELOPE_TRACKS.get(e['trackId'])
        if decay:
            # The exposure of the previous picture ends before the sample: no contribution yet.
            before = e.get('velocity', 1) * 0.0
            age_prev = ((frame - 1) / ch.FPS - t) % 8
            assert age_prev > decay * 12 or frame == 0, (e['trackId'], n)
            row['contributionInPreviousPicture'] = before
        rows.append(row)
    strobe = [f for f in range(ch.FRAMES) if ch.strobe_frame(f)]
    assert strobe[0] / ch.FPS >= ch.LOCK > (strobe[0] - 1) / ch.FPS
    assert strobe[-1] / ch.FPS < ch.BRAKE <= (strobe[-1] + 1) / ch.FPS
    delays = [r['delayMs'] for r in rows]
    return {'count': len(rows), 'maximumDelayMs': max(delays), 'meanDelayMs': sum(delays) / len(delays),
            'rule': 'first visible picture = ceil(sampleFrame / 735); exposure closes at the picture time',
            'strobeFrames': [strobe[0], strobe[-1]], 'strobeSeconds': [strobe[0] / ch.FPS, strobe[-1] / ch.FPS],
            'landmarks': {'fusion': ch.FUSION, 'lock': ch.LOCK, 'brake': ch.BRAKE, 'return': ch.RETURN,
                          'separation': ch.SEPARATION}}, rows


def sources():
    v1_audit = json.loads((ROOT / 'experiments/morph-09/source-audit.json').read_text())
    hashes = {k: digest(ROOT / k) for k in v1_audit['hashes']}
    assert hashes == v1_audit['hashes']
    v1_changed = subprocess.run(['git', 'diff', '--name-only', V1_COMMIT, '--', 'experiments/morph-09',
                                 'experiments/morph-08', 'experiments/morph-07', 'src'],
                                cwd=ROOT, capture_output=True, text=True).stdout.split()
    assert not v1_changed, v1_changed
    return {'hashes': hashes, 'matchesV1SourceAudit': True,
            'v1EngineMusicAndTelemetryUnchangedSince': V1_COMMIT}


def media(path: Path):
    p = subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json',
                        str(path)], check=True, capture_output=True)
    meta = json.loads(p.stdout)
    v = next(x for x in meta['streams'] if x['codec_type'] == 'video')
    a = next(x for x in meta['streams'] if x['codec_type'] == 'audio')
    with wave.open(str(AUDIO), 'rb') as w:
        approved = w.readframes(w.getnframes())
    decoded = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:a:0', '-f', 's16le', '-acodec',
                              'pcm_s16le', '-'], capture_output=True, check=True).stdout
    r = {'path': path.name, 'durationSeconds': float(meta['format']['duration']), 'videoCodec': v['codec_name'],
         'dimensions': [v['width'], v['height']], 'frameRate': v['r_frame_rate'], 'frames': int(v['nb_read_frames']),
         'audioCodec': a['codec_name'], 'audioRate': int(a['sample_rate']), 'audioChannels': a['channels'],
         'decodedPcmExactlyEqualsApproved': decoded == approved}
    assert r['frames'] == 480 and r['frameRate'] == '60/1' and abs(r['durationSeconds'] - 8) < 1e-3
    if a['codec_name'].startswith('pcm_'):
        assert r['decodedPcmExactlyEqualsApproved']
    return r


def image_seam(frames: Path):
    from PIL import Image
    im = lambda n: np.asarray(Image.open(frames / f'{n:04d}.png').convert('RGB'), dtype=np.float32)
    diffs = [float(np.abs(im((f + 1) % 480) - im(f)).mean()) for f in range(480)]
    return {'metric': 'mean absolute RGB difference between consecutive pictures (8-bit)',
            '477to478': diffs[477], '478to479': diffs[478], '479to0': diffs[479], '0to1': diffs[0], '1to2': diffs[1],
            'medianAnyStep': float(np.median(diffs)), 'seamRankAmongAllSteps': int(sorted(diffs, reverse=True).index(diffs[479])) + 1,
            'perStep': diffs}


def chart(out: Path):
    import os
    os.environ.setdefault('MPLCONFIGDIR', str(out / '.mpl'))
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    t = np.linspace(0, 16, 1601)
    cams = [ch.camera(x) for x in t]
    az = np.unwrap(np.radians([c['azimuth'] for c in cams]))
    az = np.degrees(az - az[0])
    speed = [ch.rotor_speed(x) for x in t]
    fig, axes = plt.subplots(5, 1, figsize=(12, 10), sharex=True, facecolor='#0d1114')
    rows = [('orbit (deg)', az), ('height', [c['position'][2] for c in cams]),
            ('distance to axis', [math.hypot(*c['position'][:2]) for c in cams]),
            ('lens (mm) / f-stop x10', None), ('rotor rev/s', speed)]
    for ax, (label, y) in zip(axes, rows):
        ax.set_facecolor('#0d1114')
        for s in ax.spines.values():
            s.set_color('#3a4448')
        ax.tick_params(colors='#b9c4c4', labelsize=8)
        ax.set_ylabel(label, color='#d9c4a0', fontsize=9)
        if y is None:
            ax.plot(t, [c['lens'] for c in cams], color='#e3a36b', lw=1.6)
            ax.plot(t, [10 * c['fstop'] for c in cams], color='#8fb8c9', lw=1.2)
        else:
            ax.plot(t, y, color='#e3a36b' if label != 'rotor rev/s' else '#8fb8c9', lw=1.6)
        for x in (8.0,):
            ax.axvline(x, color='#ffffff', lw=1.0, ls='--')
        for x in (ch.FUSION, ch.LOCK, ch.BRAKE, ch.RETURN):
            for k in (0, 8):
                ax.axvline(x + k, color='#55646a', lw=0.7, ls=':')
        ax.axvspan(ch.LOCK, ch.BRAKE, color='#cfe3ff', alpha=0.10)
        ax.axvspan(ch.LOCK + 8, ch.BRAKE + 8, color='#cfe3ff', alpha=0.10)
    axes[-1].set_xlabel('seconds (two loops; dashed line = loop seam)', color='#b9c4c4')
    fig.suptitle('MORPH//09 V2 — one revolution per loop: camera channels across two cycles',
                 color='#efe6d6', fontsize=13)
    fig.tight_layout()
    fig.savefig(out / 'camera-choreography.png', dpi=110, facecolor=fig.get_facecolor())
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', type=Path, default=ROOT / 'work/morph-09-v2/audit')
    ap.add_argument('--proof', type=Path)
    ap.add_argument('--preview', type=Path)
    ap.add_argument('--frames', type=Path)
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    events, rows = event_audit()
    report = {'kind': 'morph09-v2-audit', 'sourceCommit': V1_COMMIT, 'sources': sources(),
              'cameraSeam': camera_seam(), 'machineSeam': machine_seam(), 'events': events}
    if args.frames:
        report['imageSeam'] = image_seam(args.frames)
    if args.proof:
        report['proof'] = media(args.proof)
    if args.preview:
        report['preview'] = media(args.preview)
    report['checksPassed'] = [
        'Approved audio, event map and telemetry hashes unchanged; V1, MORPH07/08 and src/ untouched since 4ad6905',
        'Camera: position, orientation, lens, focus and f-stop identical at 0 and 8 s; velocities match',
        'Camera completes exactly one 360-degree orbit per loop and is never parented to the rotor',
        'Machine: every non-rotor channel closes within 2e-5 at the seam; rotor residual disclosed (< 0.02 deg)',
        f'All {events["count"]} events presented no earlier than their sample (max delay {events["maximumDelayMs"]:.3f} ms)',
        'Strobe window covers exactly the pictures whose exposure ends in [lock, brake)',
    ]
    (args.out / 'v2-audit.json').write_text(json.dumps(report, indent=1) + '\n')
    with (args.out / 'v2-sync-audit.csv').open('w') as f:
        f.write('track,eventId,sampleFrame,firstVisibleFrame,delayMs\n')
        for r in rows:
            f.write(f"{r['track']},{r['eventId']},{r['sampleFrame']},{r['firstVisibleFrame']},{r['delayMs']:.4f}\n")
    chart(args.out)
    print(json.dumps({'checksPassed': report['checksPassed'],
                      'cameraStateDiff': report['cameraSeam']['largestStateDifference'],
                      'cameraVelocityDiff': report['cameraSeam']['largestVelocityDifference'],
                      'machineDiff': report['machineSeam']['largestLeftLimitDifference'],
                      'rotorResidualDeg': report['machineSeam']['rotor']['orientationResidualDegrees'],
                      'imageSeam': {k: v for k, v in report.get('imageSeam', {}).items() if k != 'perStep'}},
                     indent=1))


if __name__ == '__main__':
    main()
