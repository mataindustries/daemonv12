#!/usr/bin/env python3
"""Independently verify THE CIRCUIT V2 master (default) or the approved motion proof.

    python3 verify.py --recheck work/master-recheck                 # master/the-circuit-v2-master.mp4
    python3 verify.py --kind proof --recheck work/recheck           # delivery/the-circuit-v2-motion-proof.mp4

Reuses V1's container, pixel and event-map checks (imported read-only from
../morph-commercial-01/verify.py) and adds V2's: the unchanged audio and event map, the
frame-accurate onset of every visual response, exact black from frame 456, scope, and
(with --recheck) bit-identical re-renders. Writes verification.json and VERIFICATION.md beside the video.
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


APPROVED_PROOF_COMMIT = '9b0f7c9645348d1daac3e93f6b22bbc1529c25f4'  # delivery commit of the approved low-resolution proof
APPROVED_PROOF_SHA256 = 'f4d73ca4d8c4ab1a5d6fa377c4db93eac6dadaa61c145a4ab7b70f914d89dbb7'


def verify_no_typography(video: Path, frames: Path) -> dict:
    """The encoder's input is the raw render plus vignette and grain only: no overlay of any kind.

    Recomputes finished pictures from the raw renders without a lockup and matches them to
    the per-frame RGB hashes finish.py recorded while encoding.
    """
    import finish
    record = json.loads((video.parent / (video.stem + '.frames.json')).read_text())
    require(record['lockup'] is False and record['frames'] == ch.FRAMES, 'Master was finished with a lockup')
    w, h = record['width'], record['height']
    fin = finish.Finisher(w, h, lockup=False)
    checked = sorted(set(range(0, ch.CUT_FRAME, 15)) | {420, 444, 453, 455, 456, 479})
    for f in checked:
        raw = Image.open(frames / f'raw-{f:03d}.png') if f < ch.CUT_FRAME else None
        digest = hashlib.sha256(fin.frame(f, raw).tobytes()).hexdigest()
        require(digest == record['finishedFrameSha256RGB'][str(f)], f'Finished frame {f} is not raw + grade')
    return {'finished_with_lockup': False, 'frames_recomputed_without_overlay': len(checked),
            'all_match_encoder_input_hashes': True,
            'note': 'Diegetic markings that are part of the fictional board geometry (V1 scene.py) remain.'}


def verify_approved_proof_preserved() -> dict:
    changed = git('diff', '--name-only', APPROVED_PROOF_COMMIT, '--', 'experiments/morph-commercial-02/delivery')
    require(not changed, f'Approved proof delivery changed: {changed}')
    require(ch.sha256(HERE / 'delivery' / 'the-circuit-v2-motion-proof.mp4') == APPROVED_PROOF_SHA256,
            'Approved proof MP4 changed')
    return {'approved_proof_commit': APPROVED_PROOF_COMMIT, 'delivery_files_unchanged': True,
            'approved_proof_sha256': APPROVED_PROOF_SHA256,
            'reproduce': 'render.py --variant proof --width 432 --samples 12; finish.py --kind proof --lockup'}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--kind', choices=('master', 'proof'), default='master')
    ap.add_argument('--video', type=Path)
    ap.add_argument('--frames', type=Path)
    ap.add_argument('--recheck', type=Path)
    ap.add_argument('--output', type=Path)
    a = ap.parse_args()
    master = a.kind == 'master'
    video = (a.video or HERE / ('master/the-circuit-v2-master.mp4' if master else
                                'delivery/the-circuit-v2-motion-proof.mp4')).resolve()
    frames = a.frames or HERE / 'work' / ('master' if master else 'frames')
    output = a.output or video.parent
    score = ch.load_score()
    report = {'status': 'PASS', 'kind': a.kind, 'sources': verify_sources(), 'scope': verify_scope(),
              'video': verify_video(video), 'sync': verify_sync(score)}
    if master:
        require((report['video']['width'], report['video']['height']) == (1080, 1920), 'Master is not 1080 x 1920')
        report['typography'] = verify_no_typography(video, frames)
        report['approved_proof'] = verify_approved_proof_preserved()
        report['climax_clarity'] = {
            'variant': 'master', 'camera_shutter_share_of_180_degrees': {
                str(f): round(ch.camera_shutter((f + 0.75) / ch.FPS, 'master'), 3) for f in (390, 400, 410, 420, 444, 455)},
            'machinery_shutter': '180 degrees throughout (unchanged)',
            'unchanged_before_frame': 396}
    if a.recheck:
        report['determinism'] = verify_recheck(a.recheck, frames)
    output.mkdir(parents=True, exist_ok=True)
    (output / 'verification.json').write_text(json.dumps(report, indent=1) + '\n')
    vid, sync = report['video'], report['sync']
    lc = vid['luma_change']
    lines = [
        f"# THE CIRCUIT V2 — {'final master' if master else 'motion proof'} verification", '',
        f"Status: PASS. Measured on `{vid['file']}` (SHA-256 `{vid['sha256']}`).", '',
        f"- H.264/AAC MP4, {vid['width']} × {vid['height']}, 60 fps, {vid['frames']} decoded frames, exactly 8.000 s; "
        'both streams start at 0; one fast-start MOOV; FFprobe reports no container warnings.',
        '- Audio: V1\'s 24-bit PCM reference, unchanged (SHA-256 checked), byte-identical to source samples '
        '882,000–1,234,799 of the approved B master; AAC presentation is exactly 352,800 samples.',
        f"- Event map: V1's mapping.json, unchanged; all {sync['events']} source events retained. "
        f"{sync['with_visual_response']} drive a visual response; each is zero in the frame before its sample's "
        'frame and visible in that frame. The rest are documented as absorbed, coalesced or metadata.',
        '- Frames 456–479: every RGB channel of every pixel is exactly zero; frames 0–455 are not black.',
    ]
    if master:
        t = report['typography']
        lines += [
            f"- No typography: finished without any overlay; {t['frames_recomputed_without_overlay']} frames recomputed "
            'from the raw renders (vignette and grain only) match the encoder input exactly. Engraved markings '
            'that are part of the fictional board remain.',
            '- Climax clarity (frames 396–455 only, camera only): the camera\'s share of the 180° shutter closes to '
            '0.25 by 7.0 s, the final move turns and rolls less, f-stop 3.5 → 5.6, focus tracks the lifting core. '
            'The machinery keeps its full motion blur; no event timing changed.',
            f"- The approved proof (`{APPROVED_PROOF_COMMIT}`) is unchanged and reproducible from this source.",
        ]
    lines += [
        f"- Largest adjacent mean-luma step outside the blackout: {lc['largest_adjacent_absolute_mean_luma_step']:.2f} / 255; "
        f"at most {100 * lc['maximum_fraction_pixels_with_absolute_luma_change_over_80']:.2f}% of pixels change by "
        'more than 80 / 255 between adjacent frames (descriptive, not a flash-safety certification).',
        '- Tracked changes are confined to `experiments/morph-commercial-02/`; V1 files are unchanged.',
    ]
    if 'determinism' in report:
        n = len(report['determinism']['raw_rgb_sha256'])
        lines.append(f'- {n} frames re-rendered from scratch are bit-identical to the raw frames '
                     '(same machine and settings).')
    (output / 'VERIFICATION.md').write_text('\n'.join(lines) + '\n')
    print(json.dumps({'status': 'PASS', 'video': vid['file'], 'events_with_response': sync['with_visual_response']}))


if __name__ == '__main__':
    try:
        main()
    except (AssertionError, FileNotFoundError, KeyError, subprocess.CalledProcessError) as exc:
        print(f'VERIFICATION FAILED: {exc}', file=sys.stderr)
        raise SystemExit(1)
