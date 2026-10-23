#!/usr/bin/env python3
"""Independently verify THE CIRCUIT deliverables, using FFmpeg and the Python stdlib.

python3 experiments/morph-commercial-01/verify.py \
  --video experiments/morph-commercial-01/products/the-circuit.mp4
Only writes reports after measuring the supplied deliverable. No audio processing.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import importlib.util
import subprocess
import sys
import wave
from fractions import Fraction
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SOURCE_SHA = '1474f0d22e0e939acad1824a01b92d8264cb5b4e758623034e6c92c597c6c890'
SOURCE_COMMIT = '2b6e533a021218d6940a8da5a7032c2abe58a3d9'
OFFSET = 882000
LENGTH = 352800
CUT = 335160
FPS = 60
SPF = 735


def run(*args):
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def wav_payload(path):
    with wave.open(str(path), 'rb') as w:
        info = {'sample_rate': w.getframerate(), 'channels': w.getnchannels(),
                'sample_width_bytes': w.getsampwidth(), 'sample_frames': w.getnframes(),
                'compression': w.getcomptype()}
        pcm = w.readframes(w.getnframes())
    return info, pcm


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def read_exact(pipe, n):
    chunks = []
    while n:
        block = pipe.read(n)
        if not block:
            break
        chunks.append(block)
        n -= len(block)
    return b''.join(chunks)



def verify_mp4_container(video):
    """Walk top-level ISO BMFF boxes, rejecting duplicate MOOV/truncated layout.

    Decoding alone can tolerate malformed headers that mobile players reject.
    """
    file_size = video.stat().st_size
    offset = 0
    boxes = []
    with video.open('rb') as stream:
        while offset < file_size:
            stream.seek(offset)
            header = stream.read(8)
            require(len(header) == 8, f'Truncated MP4 box header at byte{offset}')
            size = int.from_bytes(header[:4], 'big')
            box_type = header[4:].decode('ascii', errors='replace')
            header_size = 8
            if size == 1:
                extended = stream.read(8)
                require(len(extended) == 8, 'Truncated MP4 extended box header')
                size = int.from_bytes(extended, 'big')
                header_size = 16
            elif size == 0:
                size = file_size - offset
            require(size >= header_size and offset + size <= file_size,
                    f'Invalid MP4 box{box_type!r} at byte{offset}: size{size}')
            boxes.append({'type': box_type, 'offset': offset, 'size': size})
            offset += size
    types = [box['type'] for box in boxes]
    require(offset == file_size, 'MP4 box layout does not consume exact file size')
    require(types.count('ftyp') == 1, 'Expected exactly one MP4 FTYP box')
    require(types.count('moov') == 1, 'Expected exactly one MP4 MOOV box')
    require(types.count('mdat') >= 1, 'MP4 MDAT box missing')
    require(types.index('moov') < types.index('mdat'), 'MP4 is missing fast-start metadata order')
    warning_probe = subprocess.run(['ffprobe', '-v', 'warning', '-show_entries',
        'format=duration', '-of', 'json', str(video)], capture_output=True, text=True, check=True)
    require(not warning_probe.stderr.strip(), f'FFprobe container warnings: {warning_probe.stderr.strip()}')
    return {'top_level_boxes': boxes, 'file_bytes': file_size,
            'exact_box_walk_to_eof': True, 'single_moov': True, 'faststart': True,
            'ffprobe_warning_output': warning_probe.stderr.strip()}


def measure_video_pixels(video, width, height):
    """Decode every pixel of every frame; black means RGB-equivalent luma zero."""
    command = ['ffmpeg', '-v', 'error', '-threads', '2', '-i', str(video),
               '-map', '0:v:0', '-an', '-pix_fmt', 'gray', '-f', 'rawvideo', '-']
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    per_frame = width * height
    maximums = []
    minimums = []
    hashes = {}
    mean_luma = []
    changes = []
    previous_pixels = None
    selected = {0, 60, 120, 240, 330, 420, 455, 456, 479}
    try:
        index = 0
        while True:
            pixels = read_exact(process.stdout, per_frame)
            if not pixels:
                break
            require(len(pixels) == per_frame, f'Truncated decoded video frame {index}')
            current = np.frombuffer(pixels, dtype=np.uint8)
            maximums.append(int(current.max()))
            minimums.append(int(current.min()))
            mean_luma.append(float(current.mean()))
            if previous_pixels is not None:
                difference = np.abs(current.astype(np.int16) - previous_pixels.astype(np.int16))
                changes.append({'to_frame': index,
                    'absolute_mean_luma_step': abs(mean_luma[-1] - mean_luma[-2]),
                    'fraction_pixels_changing_over_80': float(np.count_nonzero(difference > 80) / per_frame)})
            previous_pixels = current
            if index in selected:
                hashes[str(index)] = hashlib.sha256(pixels).hexdigest()
            index += 1
        stderr = process.stderr.read().decode()
        require(process.wait() == 0, f'FFmpeg pixel decoding failed: {stderr}')
    finally:
        if process.poll() is None:
            process.kill()
    require(len(maximums) == 480, f'Decoded {len(maximums)} frames, expected480')
    require(all(v == 0 for v in maximums[456:]), 'One or more terminal frames are not completely black')
    require(all(v > 0 for v in maximums[:456]), 'An unexpected complete blackout occurs before frame456')
    ordinary_changes = [c for c in changes if c['to_frame'] != 456]
    peak_mean = max(ordinary_changes, key=lambda c: c['absolute_mean_luma_step'])
    peak_area = max(ordinary_changes, key=lambda c: c['fraction_pixels_changing_over_80'])
    change_evidence = {
        'measure': 'Adjacent decoded full-range grayscale pictures; pixel values 0–255. Intentional blackout transition 455→456 excluded from maxima.',
        'largest_adjacent_absolute_mean_luma_step': peak_mean['absolute_mean_luma_step'],
        'largest_adjacent_absolute_mean_luma_step_normalized': peak_mean['absolute_mean_luma_step'] / 255,
        'largest_mean_luma_step_to_frame': peak_mean['to_frame'],
        'maximum_fraction_pixels_with_absolute_luma_change_over_80': peak_area['fraction_pixels_changing_over_80'],
        'maximum_changed_fraction_to_frame': peak_area['to_frame'],
        'per_frame_mean_luma': mean_luma,
        'adjacent_changes': changes,
        'limitation': 'Descriptive image-change measurements only; no formal flash-safety or accessibility compliance claim.'}
    return {'decoded_frames': len(maximums), 'first_complete_black_frame': 456,
            'complete_black_frame_count': 24, 'all_pre_cut_frames_nonblack': True,
            'gray_minimums': minimums, 'gray_maximums': maximums,
            'selected_decoded_gray_sha256': hashes,
            'luma_change_evidence': change_evidence,
            'method': 'Every pixel decoded to full-range grayscale; final24 frames have maximum0. Grayscale verifies complete darkness; optional RGB check follows.'}


def verify_rgb_black(video, width, height):
    """Inspect all RGB channels on all terminal pixels, not merely luminance."""
    command = ['ffmpeg', '-v', 'error', '-threads', '2', '-i', str(video),
               '-map', '0:v:0', '-vf', 'select=gte(n\\,456)', '-an',
               '-fps_mode', 'passthrough', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-']
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    size = width * height * 3
    count = 0
    try:
        while True:
            pixels = read_exact(process.stdout, size)
            if not pixels:
                break
            require(len(pixels) == size, 'Truncated RGB terminal frame')
            require(not any(pixels), f'Nonzero RGB pixel in terminal frame{456 + count}')
            count += 1
        stderr = process.stderr.read().decode()
        require(process.wait() == 0, f'RGB decoding failed: {stderr}')
    finally:
        if process.poll() is None:
            process.kill()
    require(count == 24, f'Expected24 terminal RGB frames, received{count}')
    return {'frames_checked': count, 'all_rgb_channels_zero': True}


def verify_mapping(mapping_path):
    source = json.loads((ROOT / 'experiments/morph-06/audio/b/cable-beast-b.events.json').read_text())
    expected = [(i, e) for i, e in enumerate(source['events'])
                if OFFSET <= e['sampleFrame'] < OFFSET + LENGTH]
    mapping = json.loads(mapping_path.read_text())
    events = mapping['events']
    require(len(expected) == 361, f'Unexpected source excerpt event count{len(expected)}')
    require(len(events) == len(expected), f'Mapping retains{len(events)} events, expected{len(expected)}')
    by_source = {}
    for e in events:
        index = e.get('sourceIndex', e.get('sourceEventIndex'))
        require(index is not None, 'Missing event source index')
        require(index not in by_source, f'Duplicate source event index{index}')
        by_source[index] = e
    selected_by_system = {}
    max_display_lead = 0
    for index, e in expected:
        require(index in by_source, f'Missing source event{index}')
        m = by_source[index]
        rel = e['sampleFrame'] - OFFSET
        require(m['sampleFrame'] == rel, f'Incorrect sample remapping at source{index}')
        require(m['frame60'] == rel // SPF, f'Incorrect picture-frame remapping at source{index}')
        require(abs(m['time'] - rel / 44100) < 1e-9, f'Incorrect time remapping at source{index}')
        require(m['part'] == e['part'] and m['event'] == e['event'], f'Event identity altered at source{index}')
        require(isinstance(m.get('selected'), bool), f'Missing selection flag at source{index}')
        require('system' in m, f'Missing visual system at source{index}')
        max_display_lead = max(max_display_lead, rel - m['frame60'] * SPF)
        if m['selected']:
            selected_by_system[m['system']] = selected_by_system.get(m['system'], 0) + 1
    return {'source_event_count': len(expected), 'mapped_event_count': len(events),
            'sample_offsets_and_picture_buckets_match': True,
            'source_start_sample_frame': OFFSET, 'source_end_sample_frame_exclusive': OFFSET + LENGTH,
            'source_start_picture_frame': 1200,
            'samples_per_picture_frame': SPF, 'selected_by_system': selected_by_system,
            'maximum_within_frame_event_offset_samples': max_display_lead,
            'mapping_sha256': sha(mapping_path),
            'frame_rule': 'floor((sourceSampleFrame -882000)/735); frame interval contains the original sample onset, never shifted to a different picture interval'}



def verify_animation_audit(audit_path, mapping_path):
    """Cross-check emitted onset audit against source-verified mapping and code state.

    Recompute selected image frames in a fresh Circuit instance and compare raw RGB
    SHA-256 values with the master render's recorded hashes and saved PNG pixels.
    This is a compositor spot-check, not a promise of cross-platform path-tracer bytes.
    """
    require(audit_path.is_file(), f'Missing master animation audit: {audit_path}')
    audit = json.loads(audit_path.read_text())
    require(audit['fps'] == 60 and audit['width'] == 1080 and audit['height'] == 1920,
            'Master animation audit format mismatch')
    require(audit['frames'] == 480 and audit['sourceFrames'] == list(range(480)),
            'Animation audit does not cover exactly frames0 through479')
    mapping = json.loads(mapping_path.read_text())
    expected = {e['sourceIndex']: e for e in mapping['events'] if e['selected']
                and e['system'] not in ('blackout', 'metadata')}
    observed = {e['sourceIndex']: e for e in audit['events']}
    require(len(observed) == len(audit['events']), 'Duplicate animation-audit source index')
    require(observed.keys() == expected.keys(), 'Animation onset audit event coverage mismatch')
    for index, e in expected.items():
        require(observed[index]['onsetFrame'] == e['frame60'],
                f'Audit onset frame differs from verified source at event{index}')
        require(observed[index]['firstActiveFrame'] == e['frame60'],
                f'Event{index} has a delayed or early visual-state activation')
    spec = importlib.util.spec_from_file_location('circuit_render_verification', HERE / 'render.py')
    renderer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(renderer)
    active_frames = {}
    for frame in range(480):
        for e, age in renderer.state(frame):
            active_frames.setdefault(e['sourceIndex'], frame)
    require(set(active_frames) == set(expected), 'Renderer state event coverage differs from mapping')
    for index, e in expected.items():
        require(active_frames[index] == e['frame60'],
                f'Independent state inspection found wrong first-active frame for{index}')
    circuit = renderer.Circuit(1080)
    spot_frames = [0, 150, 444, 455, 456]
    hashes = {}
    from PIL import Image
    for frame in spot_frames:
        rendered = circuit.frame(frame)
        digest = hashlib.sha256(rendered.tobytes()).hexdigest()
        require(audit['frameHashesRGB'].get(str(frame)) == digest,
                f'Fresh compositor render differs from master RGB hash at frame{frame}')
        still = audit_path.parent / f'frame-{frame:03d}.png'
        require(still.is_file(), f'Missing representative PNG: {still}')
        with Image.open(still) as im:
            require(hashlib.sha256(im.convert('RGB').tobytes()).hexdigest() == digest,
                    f'Saved representative PNG pixels differ at frame{frame}')
        hashes[str(frame)] = digest
    return {'selected_musical_events_checked': len(expected),
            'all_first_active_frames_match_source_containing_frame': True,
            'independently_recomputed_state_onsets': True,
            'audit_sha256': sha(audit_path),
            'determinism': {'measured': True, 'spot_frames': spot_frames,
                'fresh_compositor_raw_rgb_hashes_match_master': True,
                'saved_png_rgb_hashes_match': True, 'frame_sha256': hashes,
                'scope': 'Five frames recomposited from the same scene plates on this runtime; not a cross-platform Blender/path-tracer byte-equivalence claim.'}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--video', type=Path, default=HERE / 'products/the-circuit.mp4')
    parser.add_argument('--audio', type=Path, default=HERE / 'audio/circuit-reference.wav')
    parser.add_argument('--mapping', type=Path, default=HERE / 'mapping.json')
    parser.add_argument('--output', type=Path, default=HERE / 'products')
    args = parser.parse_args()
    video = args.video.resolve()
    require(video.is_file(), f'Rendered MP4 missing: {video}')
    container = verify_mp4_container(video)
    source = ROOT / 'experiments/morph-06/audio/b/cable-beast-b.wav'
    require(sha(source) == SOURCE_SHA, 'Approved source master hash mismatch')
    source_info, source_pcm = wav_payload(source)
    audio_info, audio_pcm = wav_payload(args.audio)
    require(audio_info == {'sample_rate': 44100, 'channels': 2, 'sample_width_bytes': 3,
                           'sample_frames': LENGTH, 'compression': 'NONE'},
            f'Unexpected reference audio format: {audio_info}')
    require(len(audio_pcm) == LENGTH * 6, 'Reference PCM payload length mismatch')
    require(audio_pcm == source_pcm[OFFSET * 6:(OFFSET + LENGTH) * 6], 'Reference PCM is not the exact approved master crop')
    require(not any(audio_pcm[CUT * 6:]), 'Reference tail is not exact digital silence')
    require(any(audio_pcm[(CUT - SPF) * 6:CUT * 6]), 'Unexpected silent final active audio frame')
    probe = json.loads(run('ffprobe', '-v', 'error', '-count_frames', '-show_streams',
                           '-show_format', '-of', 'json', str(video)))
    vs = [s for s in probe['streams'] if s['codec_type'] == 'video']
    aus = [s for s in probe['streams'] if s['codec_type'] == 'audio']
    require(len(vs) == 1 and len(aus) == 1, 'Expected one video and one audio stream')
    v, a = vs[0], aus[0]
    require(v['codec_name'] == 'h264', 'Playback copy is not H.264')
    require(a['codec_name'] == 'aac', 'Playback audio is not AAC')
    require((v['width'], v['height']) == (1080, 1920), 'Incorrect video dimensions')
    require(Fraction(v['r_frame_rate']) == FPS and Fraction(v['avg_frame_rate']) == FPS, 'Incorrect frame rate')
    require(int(v['nb_read_frames']) == 480, 'Video frame count is not480')
    require(Fraction(v['duration']) == 8 and Fraction(probe['format']['duration']) == 8, 'Incorrect video/container duration')
    require(Fraction(v['start_time']) == 0 and Fraction(a['start_time']) == 0, 'Audio/video start offset is nonzero')
    require(a['sample_rate'] == '44100' and a['channels'] == 2, 'Incorrect playback audio format')
    require(Fraction(a['duration']) == 8, 'AAC presentation duration is not8 seconds')
    require(Fraction(a['duration_ts']) * Fraction(a['time_base']) == 8, 'AAC presentation ticks do not represent exactly8 seconds')
    decoded_audio = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(video),
                        '-map', '0:a:0', '-vn', '-f', 's24le', '-acodec', 'pcm_s24le', '-'])
    decoded_count = len(decoded_audio) // 6
    presented_audio = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(video),
                        '-map', '0:a:0', '-vn', '-t', '8', '-f', 's24le', '-acodec', 'pcm_s24le', '-'])
    require(len(presented_audio) // 6 == LENGTH, 'AAC declared-duration decode does not contain352800 samples')
    # Comparing the base commit directly with the current working tree includes
    # committed experiment changes as well as any edits after the source commit.
    subprocess.run(['git', 'merge-base', '--is-ancestor', SOURCE_COMMIT, 'HEAD'], cwd=ROOT, check=True)
    changed = run('git', 'diff', '--name-only', SOURCE_COMMIT).splitlines()
    require(all(p.startswith('experiments/morph-commercial-01/') for p in changed), 'Tracked files changed outside the requested experiment')
    require(run('git', 'branch', '--show-current') == 'feat/morph-commercial-01-circuit', 'Incorrect feature branch')
    pixels = measure_video_pixels(video, v['width'], v['height'])
    rgb = verify_rgb_black(video, v['width'], v['height'])
    mapping = verify_mapping(args.mapping)
    animation = verify_animation_audit(video.parent / 'animation-audit.json', args.mapping)
    report = {
        'status': 'PASS', 'source_commit': SOURCE_COMMIT,
        'branch': 'feat/morph-commercial-01-circuit',
        'source_master_sha256': SOURCE_SHA,
        'reference_audio': {**audio_info, 'sha256': sha(args.audio), 'pcm_sha256': hashlib.sha256(audio_pcm).hexdigest(),
                            'bit_exact_source_crop': True, 'crop_start_seconds': 20, 'crop_end_seconds_exclusive': 28,
                            'silence_start_sample': CUT, 'silence_sample_frames': LENGTH - CUT},
        'playback': {'file': video.name, 'sha256': sha(video), 'video_codec': v['codec_name'],
                     'audio_codec': a['codec_name'], 'width': v['width'], 'height': v['height'],
                     'frames': int(v['nb_read_frames']), 'fps': v['avg_frame_rate'],
                     'container_duration_seconds': 8, 'video_start_seconds': 0, 'audio_start_seconds': 0,
                     'audio_presentation_sample_frames': LENGTH,
                     'untrimmed_aac_decode_sample_frames': decoded_count,
                     'declared_duration_decode_sample_frames': len(presented_audio) // 6,
                     'aac_padding_sample_frames_after_presentation': decoded_count - LENGTH,
                     'aac_note': 'AAC uses1024-sample coding blocks. The MP4 presentation duration is exactly8s; unconstrained decoder output may expose trailing encoder padding. PCM reference has no padding.'},
        'container_verification': container,
        'mapping': mapping, 'animation_onsets': {k: v for k, v in animation.items() if k != 'determinism'}, 'pixel_verification': {**pixels, 'terminal_rgb': rgb},
        'scope': {'tracked_files_outside_experiment_changed': False,
                  'engine_and_existing_scores_unchanged': True},
        'determinism': animation['determinism']
    }
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / 'verification.json').write_text(json.dumps(report, indent=2) + '\n')
    selected_total = sum(mapping['selected_by_system'].values())
    luma_change = pixels['luma_change_evidence']
    md = f'''# THE CIRCUIT — measured technical verification

Status: PASS. Measurements concern the rendered file `{video.name}`.

- H.264/AAC MP4, 1080 × 1920, 60 fps, 480 decoded picture frames, exactly 8.000 s. Both streams begin at presentation time 0.
- The MP4 has one fast-start MOOV box and a complete top-level box layout through the exact end of file. FFprobe reports no container warnings.
- The stereo 44.1 kHz, 24-bit PCM reference has 352,800 sample frames. Its payload is byte-identical to source sample frames 882,000–1,234,799, i.e. 20.000–28.000 s of the approved B WAV. No gain, limiting, recomposition or time stretching was applied.
- All 361 original events in the crop are retained in the mapping; sample offsets and zero-based 60 fps picture buckets match independently. {selected_total} entries drive selected visual systems. One picture interval is 735 audio sample frames.
- Source cutoff 27.600 s maps to excerpt 7.600 s / sample 335,160 / picture 456. Picture 455 remains visible. Every RGB channel of every pixel in pictures 456–479 is exactly zero. The corresponding 17,640 PCM sample frames are exactly silent.
- AAC presentation contains 352,800 sample frames. Unconstrained AAC decoding returned {decoded_count:,} frames; {decoded_count - LENGTH:,} trailing coding-padding frames fall outside the declared 8.000 s presentation. Use the PCM reference for lossless/sample-exact work.
- All {animation['selected_musical_events_checked']} selected non-blackout event onsets are independently checked against renderer state and its master animation audit; each first activates in its source onset's containing picture frame.
- Fresh compositor renders of pictures 0, 150, 444, 455 and 456 match the master render's raw RGB hashes and saved PNG pixels. This verifies deterministic compositing on this runtime with the same plates; it does not claim cross-platform path-tracer byte identity.
- Excluding the intentional blackout, the largest adjacent mean grayscale-luma step is {luma_change['largest_adjacent_absolute_mean_luma_step']:.3f} / 255. At most {100 * luma_change['maximum_fraction_pixels_with_absolute_luma_change_over_80']:.3f}% of pixels change by more than 80 / 255 between adjacent pictures. These describe image changes; they are not a formal flash-safety compliance assessment.
- Tracked changes are confined to `experiments/morph-commercial-01/`; existing scores and the DaemonV12 engine are unchanged.

Detailed measurements and file SHA-256 hashes are in `verification.json`.

## Synchronization

The visual clock uses the original event map's authoritative audio sample indices. Subtracting 882,000 remaps each event from the source master into the exact eight-second crop; dividing the resulting integer index by 735 and taking the floor identifies the 60 fps picture interval containing that sound. Distinct event classes address circuit surges, structural responses, processor articulation and branching signals, while rapid events are deliberately coalesced to preserve readable motion. The terminal source silence at sample 1,217,160 becomes excerpt sample 335,160 and picture 456, producing one hard blackout held through the final 24 frames.
'''
    (args.output / 'verification.md').write_text(md)
    print(json.dumps({'status': 'PASS', 'video': str(video), 'frames': 480,
                      'audio_frames': LENGTH, 'blackout_frame': 456,
                      'source_events': 361, 'report': str(args.output / 'verification.md')}, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (AssertionError, FileNotFoundError, KeyError, subprocess.CalledProcessError, wave.Error) as exc:
        print(f'VERIFICATION FAILED: {exc}', file=sys.stderr)
        raise SystemExit(1)
