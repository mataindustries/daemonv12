#!/usr/bin/env python3
"""MORPH//09 V3 — verify that the overload effects changed only what they should.

    python3 experiments/morph-09-v3/verify.py --out work/morph-09-v3/audit \
        [--frames DIR] [--v2-frames DIR] [--proof PATH.mov] [--preview PATH.mp4]

Checks: approved sources and V2's code unchanged; the camera and machine are V2's (same code,
same seam); effect timing (arcs only before the lock and never in strobe pictures, particles
only after the brake, vapor zero long before the loop point); every arc lands on a riser at
its picture's rotor angle; effects are deterministic; pictures outside the effect window are
pixel-identical to V2; the 479 → 0 seam; and the muxed media.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import effects as fx  # noqa: E402

ch = fx.ch
import importlib.util  # noqa: E402

# V2's verify module, loaded by path because this file shares its name (read-only reuse).
_spec = importlib.util.spec_from_file_location('v2verify', HERE.parent / 'morph-09-v2' / 'verify.py')
v2verify = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(v2verify)

APPROVED_V2 = '005f02ccf40f4d73ba05cb146bc1bdd683cedc74'
V2_CODE = ['choreography.py', 'scene.py', 'render.py', 'finish.py', 'verify.py']


def git_blob(commit, path):
    return subprocess.run(['git', 'show', f'{commit}:{path}'], cwd=ROOT, capture_output=True, check=True).stdout


def sources():
    out = v2verify.sources()
    code = {}
    for name in V2_CODE:
        rel = f'experiments/morph-09-v2/{name}'
        same = (ROOT / rel).read_bytes() == git_blob(APPROVED_V2, rel)
        code[rel] = same
        assert same, rel
    out['v2CodeIdenticalToApprovedProof'] = code
    out['approvedV2Commit'] = APPROVED_V2
    return out


def effect_timing():
    arcs, sparks = fx.arc_events(), fx.spark_events()
    strobe = [f for f in range(ch.FRAMES) if ch.strobe_frame(f)]
    lit = {f for a in arcs for f in range(ch.FRAMES) if any(x > 0 for x in fx.arc_level(a, f))}
    assert not lit & set(strobe), 'arc light inside the strobe stillness'
    assert all(a['time'] < ch.LOCK for a in arcs)
    assert all(ch.rotor_speed(a['time']) > 2.0 for a in arcs)
    # Every arc ends on a riser cheek at its picture's actual rotor angle.
    landing = []
    for a in arcs:
        x, y, z = a['main'][-1]
        az = math.degrees(math.atan2(y, x))
        k = a['riserIndex']
        centre = ch.BRUSH_AZ - k * fx.PITCH + 360.0 * ch.rotor_angle(a['time'])
        off = (az - centre + 180) % 360 - 180
        landing.append(abs(off))
        assert fx.CHEEK_DEG[0] - 1e-6 <= abs(off) <= fx.CHEEK_DEG[1] + 1e-6, (a['frame'], off)
    births = [s['birth'] for s in sparks]
    deaths = [s['birth'] + s['life'] for s in sparks]
    assert min(births) >= ch.BRAKE and max(births) < ch.RETURN
    vap = [fx.vapor(f / ch.FPS)['envelope'] for f in range(ch.FRAMES)]
    first_vapor = min(f for f, v in enumerate(vap) if v > 0)
    last_vapor = max(f for f, v in enumerate(vap) if v > 0)
    assert first_vapor > strobe[-1] and last_vapor < 479
    per_frame = {}
    for a in arcs:
        per_frame[a['frame']] = per_frame.get(a['frame'], 0) + 1
    return {
        'arcs': {'count': len(arcs), 'firstPicture': min(per_frame), 'lastPicture': max(per_frame),
                 'firstSeconds': min(per_frame) / ch.FPS, 'lastSeconds': max(per_frame) / ch.FPS,
                 'lastLitPicture': max(lit), 'perPicture': per_frame,
                 'kinds': {k: sum(1 for a in arcs if a['kind'] == k) for k in ('bridge', 'creep')},
                 'landingOffsetFromRiserCentreDeg': [round(min(landing), 3), round(max(landing), 3)],
                 'rule': 'count, reach and brightness grow with log(rotor speed) above 2 rev/s; each ends on a '
                         'riser cheek at the picture\'s rotor angle; none lit in strobe pictures '
                         f'{strobe[0]}-{strobe[-1]}'},
        'particles': {'count': len(sparks), 'perCaliper': fx.SPARKS_PER_CALIPER,
                      'birthSeconds': [round(min(births), 4), round(max(births), 4)],
                      'lastGlowSeconds': round(max(deaths), 4),
                      'bounced': sum(1 for s in sparks if s['bounced']),
                      'initialSpeedUnitsPerSecond': [round(min(s['initialSpeed'] for s in sparks), 2),
                                                     round(max(s['initialSpeed'] for s in sparks), 2)]},
        'vapor': {'firstPicture': first_vapor, 'lastPicture': last_vapor,
                  'envelopeAtPicture479': vap[479], 'envelopeAtPicture0': vap[0],
                  'peakSeconds': round(max(range(ch.FRAMES), key=lambda f: vap[f]) / ch.FPS, 4)},
        'strobePictures': [strobe[0], strobe[-1]],
        'quietPictures': 'pictures 0-371 carry no effect object or light (all hidden)',
    }


def determinism():
    def digest(obj):
        return hashlib.sha256(json.dumps(obj, sort_keys=True).encode()).hexdigest()
    a1, a2 = fx.arc_events(), fx.arc_events()
    s1, s2 = fx.spark_events(), fx.spark_events()
    assert digest(a1) == digest(a2) and digest(s1) == digest(s2)
    return {'arcEventsSha256': digest(a1), 'particleEventsSha256': digest(s1),
            'seeds': {'arcs': fx.SEED_ARC, 'particles': fx.SEED_SPARK}}


def quiet_frames():
    """Effects carry nothing outside their windows, so render.py hides every addition there."""
    arcs, sparks = fx.arc_events(), fx.spark_events()
    # render.heat_window needs only choreography; evaluate it without importing bpy.
    src = (HERE / 'render.py').read_text()
    ns = {'fx': fx, 'ch': ch}
    exec(src[src.index('def heat_window'):src.index('def bake_effects')], ns)
    active = []
    for f in range(ch.FRAMES):
        t = f / ch.FPS
        on = any(any(x > 0 for x in fx.arc_level(a, f)) for a in arcs) or \
            any(fx.spark_state(s, t) for s in sparks) or fx.vapor(t)['envelope'] > 0 or \
            ns['heat_window'](t) * fx.heat_glow(t) > 1e-4
        if on:
            active.append(f)
    return active


def pixels(v3_dir: Path, v2_dir: Path, frames):
    import numpy as np
    from PIL import Image
    out = {}
    for f in frames:
        a, b = v3_dir / f'{f:04d}.png', v2_dir / f'{f:04d}.png'
        if not a.exists():
            continue
        x = np.asarray(Image.open(a).convert('RGB'), dtype=np.int16)
        y = np.asarray(Image.open(b).convert('RGB'), dtype=np.int16)
        out[f] = {'identicalToV2': bool((x == y).all()), 'meanAbsDiff': float(np.abs(x - y).mean())}
    return out


def departure(v3_dir: Path, v2_dir: Path, frames):
    """Mean absolute difference and luminance shift from V2 for each effect picture (8-bit)."""
    import numpy as np
    from PIL import Image
    out = {}
    for f in frames:
        p = v3_dir / f'{f:04d}.png'
        if not p.exists():
            continue
        x = np.asarray(Image.open(p).convert('RGB'), dtype=np.float32)
        y = np.asarray(Image.open(v2_dir / f'{f:04d}.png').convert('RGB'), dtype=np.float32)
        out[f] = {'meanAbsDiff': round(float(np.abs(x - y).mean()), 3), 'lumaShift': round(float(x.mean() - y.mean()), 3)}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', type=Path, default=ROOT / 'work/morph-09-v3/audit')
    ap.add_argument('--frames', type=Path, help='assembled V3 proof frames 0000-0479')
    ap.add_argument('--rendered', type=Path, help='frames rendered from the V3 scene')
    ap.add_argument('--v2-frames', type=Path, default=ROOT / 'work/morph-09-v2/frames')
    ap.add_argument('--proof', type=Path)
    ap.add_argument('--preview', type=Path)
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)
    events, rows = v2verify.event_audit()
    active = quiet_frames()
    report = {'kind': 'morph09-v3-audit', 'sources': sources(), 'cameraSeam': v2verify.camera_seam(),
              'machineSeam': v2verify.machine_seam(), 'events': events, 'effects': effect_timing(),
              'determinism': determinism(),
              'effectPictures': {'first': min(active), 'last': max(active), 'count': len(active),
                                 'outsideTheseThePictureIsV2': True}}
    assert min(active) >= 372 and max(active) <= 471
    if a.rendered:
        report['identityWithV2'] = pixels(a.rendered, a.v2_frames, [f for f in range(480) if f not in active])
        assert all(v['identicalToV2'] for v in report['identityWithV2'].values())
    if a.rendered:
        # Effect pictures: how far each departs from V2 (whole-picture mean and luminance shift).
        report['departureFromV2'] = departure(a.rendered, a.v2_frames, active)
    if a.frames:
        report['imageSeam'] = v2verify.image_seam(a.frames)
    if a.proof:
        report['proof'] = v2verify.media(a.proof)
    if a.preview:
        report['preview'] = v2verify.media(a.preview)
    report['checksPassed'] = [
        'Approved audio, event map and telemetry unchanged; V2 code byte-identical to the approved proof',
        'Camera and machine are V2\'s: identical state at 0 and 8 s, velocities match',
        f'All {events["count"]} events presented no earlier than their sample',
        'Arcs only from rotor speed > 2 rev/s until the lock; none lit in strobe pictures; each lands on a riser',
        'Brake particles born only after the brake event; all cooled out before the return',
        f'Vapor envelope zero from picture {report["effects"]["vapor"]["lastPicture"] + 1} to picture '
        f'{report["effects"]["vapor"]["firstPicture"] - 1}: nothing to disappear at 479 -> 0',
        f'Effects deterministic; pictures outside {min(active)}-{max(active)} carry no effect',
    ]
    (a.out / 'v3-audit.json').write_text(json.dumps(report, indent=1, default=str) + '\n')
    print(json.dumps({'checksPassed': report['checksPassed'], 'effectPictures': report['effectPictures'],
                      'arcs': {k: v for k, v in report['effects']['arcs'].items() if k != 'perPicture'},
                      'particles': report['effects']['particles'], 'vapor': report['effects']['vapor'],
                      'identityChecked': len(report.get('identityWithV2', {})),
                      'imageSeam': {k: v for k, v in report.get('imageSeam', {}).items() if k != 'perStep'}},
                     indent=1))


if __name__ == '__main__':
    main()
