#!/usr/bin/env python3
"""Independently verify THE CIRCUIT V2 motion proof.

    python3 verify.py --video delivery/the-circuit-v2-motion-proof.mp4 [--recheck work/recheck]

Reuses V1's container, pixel and event-map checks (imported read-only from
../morph-commercial-01/verify.py) and adds V2's: the unchanged audio and event map, the
frame-accurate onset of every visual response, exact black from frame 456, scope, and
(with --recheck) bit-identical re-renders. Writes delivery/verification.json and .md.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import subprocess
import sys
from fractions import Fraction
from pathlib import Path

from PIL import Image

import choreography as ch

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
V1_BRANCH_HEAD = '572caf9c6ae835e7f840f4163b73056e431bbf57'
_spec = importlib.util.spec_from_file_location('v1_verify', ch.V1 / 'verify.py')
v1 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(v1)
require = v1.require


def git(*args: str) -> str:
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()


def verify_sources() -> dict:
    require(ch.sha256(ch.MAPPING) == ch.MAPPING_SHA256, 'V1 event map changed')
    require(ch.sha256(ch.AUDIO) == ch.AUDIO_SHA256, 'V1 PCM reference changed')
    source = ROOT / 'experiments/morph-06/audio/b/cable-beast-b.wav'
    require(ch.sha256(source) == v1.SOURCE_SHA, 'Approved source master hash mismatch')
    _, source_pcm = v1.wav_payload(source)
    info, pcm = v1.wav_payload(ch.AUDIO)
    require(pcm == source_pcm[v1.OFFSET * 6:(v1.OFFSET + v1.LENGTH) * 6], 'Reference is not the exact source crop')
    require(not any(pcm[v1.CUT * 6:]), 'Reference tail is not exact digital silence')
    mapping = v1.verify_mapping(ch.MAPPING)
    return {'audio': {**info, 'sha256': ch.AUDIO_SHA256, 'bit_exact_crop_of_source_20_to_28_s': True},
            'event_map': {'sha256': ch.MAPPING_SHA256, 'source_events': mapping['source_event_count'],
                          'sample_offsets_and_picture_buckets_match': True}}


def verify_scope() -> dict:
    subprocess.run(['git', 'merge-base', '--is-ancestor', V1_BRANCH_HEAD, 'HEAD'], cwd=ROOT, check=True)
    changed = git('diff', '--name-only', V1_BRANCH_HEAD).splitlines()
    untracked = git('ls-files', '--others', '--exclude-standard').splitlines()
    outside = [p for p in changed + untracked if not p.startswith('experiments/morph-commercial-02/')]
    require(not outside, f'Files changed outside the V2 experiment: {outside}')
    v1_changes = git('diff', '--name-only', V1_BRANCH_HEAD, '--', 'experiments/morph-commercial-01')
    require(not v1_changes, 'V1 files changed')
    return {'base_commit': V1_BRANCH_HEAD, 'v1_files_unchanged': True,
            'changes_confined_to': 'experiments/morph-commercial-02/'}


def verify_sync(score: ch.Score) -> dict:
    rows, active, silent = [], 0, 0
    for e in score.events:
        src, f = e['sourceIndex'], e['frame60']
        roles = score.audit.get(src, [])
        names = [r['role'] for r in roles]
        visual = [n for n in names if n not in ('absorbed', 'coalesced', 'metadata', 'cut', 'glitch')]
        row = {'sourceIndex': src, 'part': e['part'], 'event': e['event'], 'sampleFrame': e['sampleFrame'],
               'frame60': f, 'roles': roles}
        if visual:
            before = score.response(src, f - 1) if f > 0 else 0.0
            at = score.response(src, f)
            require(before == 0.0 and at > 0.0, f'Event {src} is not first visible in frame {f}')
            row['firstVisibleFrame'] = f
            active += 1
        elif 'glitch' in names:
            require(ch.core_gain(score, f - 1) == 1.0 and ch.core_gain(score, f) != 1.0, 'Glitch onset frame')
            row['firstVisibleFrame'] = f
            active += 1
        else:
            silent += 1
        rows.append(row)
    require(len(rows) == 361, 'Event coverage changed')
    cut = [e for e in score.events if e['part'] == 'all']
    require(len(cut) == 1 and cut[0]['frame60'] == ch.CUT_FRAME, 'Cut frame is not 456')
    return {'events': len(rows), 'with_visual_response': active, 'without_separate_response': silent,
            'rule': 'response(frame60 - 1) == 0 and response(frame60) > 0 for every event with a visual role',
            'rows': rows}


def verify_video(video: Path) -> dict:
    container = v1.verify_mp4_container(video)
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-count_frames', '-show_streams',
                                                '-show_format', '-of', 'json', str(video)], text=True))
    vs = [s for s in probe['streams'] if s['codec_type'] == 'video']
    aus = [s for s in probe['streams'] if s['codec_type'] == 'audio']
    require(len(vs) == 1 and len(aus) == 1, 'Expected one video and one audio stream')
    v, a = vs[0], aus[0]
    require(v['codec_name'] == 'h264' and a['codec_name'] == 'aac', 'Expected H.264/AAC')
    require(Fraction(v['avg_frame_rate']) == ch.FPS and int(v['nb_read_frames']) == ch.FRAMES, 'Frame rate/count')
    require(Fraction(v['duration']) == 8 and Fraction(probe['format']['duration']) == 8, 'Duration is not 8 s')
    require(Fraction(v['start_time']) == 0 and Fraction(a['start_time']) == 0, 'Stream start offset')
    require(a['sample_rate'] == '44100' and a['channels'] == 2 and Fraction(a['duration']) == 8, 'Audio format')
    presented = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(video), '-map', '0:a:0', '-t', '8',
                                         '-f', 's24le', '-acodec', 'pcm_s24le', '-'])
    require(len(presented) // 6 == v1.LENGTH, 'AAC presentation is not 352,800 samples')
    pixels = v1.measure_video_pixels(video, v['width'], v['height'])
    rgb = v1.verify_rgb_black(video, v['width'], v['height'])
    return {'file': video.name, 'sha256': ch.sha256(video), 'width': v['width'], 'height': v['height'],
            'fps': v['avg_frame_rate'], 'frames': int(v['nb_read_frames']), 'seconds': 8,
            'video_codec': 'h264', 'audio_codec': 'aac', 'audio_presentation_samples': v1.LENGTH,
            'container': container, 'pixels': {k: pixels[k] for k in
                                               ('first_complete_black_frame', 'complete_black_frame_count',
                                                'all_pre_cut_frames_nonblack')},
            'terminal_rgb': rgb, 'luma_change': {k: v_ for k, v_ in pixels['luma_change_evidence'].items()
                                                 if k not in ('per_frame_mean_luma', 'adjacent_changes')}}


def verify_recheck(recheck: Path, frames: Path) -> dict:
    out = {}
    for png in sorted(recheck.glob('raw-*.png')):
        a = hashlib.sha256(Image.open(png).convert('RGB').tobytes()).hexdigest()
        b = hashlib.sha256(Image.open(frames / png.name).convert('RGB').tobytes()).hexdigest()
        require(a == b, f'Re-render differs: {png.name}')
        out[png.name] = a
    require(out, 'No re-rendered frames to compare')
    return {'re_rendered_frames_bit_identical': True, 'raw_rgb_sha256': out,
            'scope': 'Same machine, Blender build, thread count and settings; not a cross-platform claim.'}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--video', type=Path, default=HERE / 'delivery' / 'the-circuit-v2-motion-proof.mp4')
    ap.add_argument('--frames', type=Path, default=HERE / 'work' / 'frames')
    ap.add_argument('--recheck', type=Path)
    ap.add_argument('--output', type=Path, default=HERE / 'delivery')
    a = ap.parse_args()
    score = ch.load_score()
    report = {'status': 'PASS', 'sources': verify_sources(), 'scope': verify_scope(),
              'video': verify_video(a.video.resolve()), 'sync': verify_sync(score)}
    if a.recheck:
        report['determinism'] = verify_recheck(a.recheck, a.frames)
    a.output.mkdir(parents=True, exist_ok=True)
    (a.output / 'verification.json').write_text(json.dumps(report, indent=1) + '\n')
    vid, sync = report['video'], report['sync']
    lc = vid['luma_change']
    lines = [
        '# THE CIRCUIT V2 — motion proof verification', '',
        f"Status: PASS. Measured on `{vid['file']}` (SHA-256 `{vid['sha256']}`).", '',
        f"- H.264/AAC MP4, {vid['width']} × {vid['height']}, 60 fps, {vid['frames']} decoded frames, exactly 8.000 s; "
        'both streams start at 0; one fast-start MOOV; FFprobe reports no container warnings.',
        '- Audio: V1\'s 24-bit PCM reference, unchanged (SHA-256 checked), byte-identical to source samples '
        '882,000–1,234,799 of the approved B master; AAC presentation is exactly 352,800 samples.',
        f"- Event map: V1's mapping.json, unchanged; all {sync['events']} source events retained. "
        f"{sync['with_visual_response']} drive a visual response; each is zero in the frame before its sample's "
        'frame and visible in that frame. The rest are documented as absorbed, coalesced or metadata.',
        '- Frames 456–479: every RGB channel of every pixel is exactly zero; frames 0–455 are not black.',
        f"- Largest adjacent mean-luma step outside the blackout: {lc['largest_adjacent_absolute_mean_luma_step']:.2f} / 255; "
        f"at most {100 * lc['maximum_fraction_pixels_with_absolute_luma_change_over_80']:.2f}% of pixels change by "
        'more than 80 / 255 between adjacent frames (descriptive, not a flash-safety certification).',
        '- Tracked changes are confined to `experiments/morph-commercial-02/`; V1 files are unchanged.',
    ]
    if 'determinism' in report:
        n = len(report['determinism']['raw_rgb_sha256'])
        lines.append(f'- {n} frames re-rendered from scratch are bit-identical to the proof\'s raw frames '
                     '(same machine and settings).')
    (a.output / 'VERIFICATION.md').write_text('\n'.join(lines) + '\n')
    print(json.dumps({'status': 'PASS', 'video': vid['file'], 'events_with_response': sync['with_visual_response']}))


if __name__ == '__main__':
    try:
        main()
    except (AssertionError, FileNotFoundError, KeyError, subprocess.CalledProcessError) as exc:
        print(f'VERIFICATION FAILED: {exc}', file=sys.stderr)
        raise SystemExit(1)
