#!/usr/bin/env python3
"""Verify the locked MORPH//09 V3 1080p master; never treats a preflight as delivery.

The original V2/V3 numerical audit functions are reused without changing them. Full
verification additionally requires all render sidecars, independent selected re-renders,
quiet V3 control renders, finished media and grading provenance.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.util
import json
import math
import os
import re
import struct
import subprocess
import sys
import wave
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
WORK = ROOT / 'work/morph-09-v3-master'
LOCKED = '9e8a03d2b5bfed15f8056970ca3b4cdb1c2cfbc7'
AUDIO = ROOT / 'experiments/morph-08/candidates/overtone.wav'
AUDIO_SHA = 'f771979966ce4b85ff96e44474f3259bf2da3f576a71bf0847af9d37e5b4111c'
NAME = 'morph-09-v3-critical-overload-1080p'
SIZE = (1080, 1920)
FRAMES = 480
NAMES = {f'{f:04d}.png' for f in range(FRAMES)}
EXPECTED_ACTIVE = set(range(373, 390)) | set(range(406, 472))
REQUIRED_RENDER_CHECKS = {0, 389, 396, 418, 479}
REQUIRED_QUIET_CONTROLS = {0, 372, 390, 405, 472, 479}

# The approved verifier imports choreography/effects by their original module names.
sys.path.insert(0, str(HERE.parent.parent / 'morph-09-v2'))
sys.path.insert(0, str(HERE.parent))
spec = importlib.util.spec_from_file_location('approved_v3_verify', HERE.parent / 'verify.py')
v3 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v3)
v2 = v3.v2verify


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def canonical_digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def write_json(path, value):
    part = path.with_name(path.name + '.part')
    part.write_text(json.dumps(value, indent=2, sort_keys=True, default=str) + '\n')
    os.replace(part, path)


def load(path):
    return json.loads(Path(path).read_text())


def image(path):
    with Image.open(path) as im:
        im.load()
        require(im.format == 'PNG' and im.size == SIZE,
                f'{path}: expected genuine 1080x1920 PNG, got {im.format} {im.size}')
        return np.asarray(im.convert('RGB'))


def source_checks(path):
    data = load(path)
    require(data.get('sourceCommit') == LOCKED, 'The source manifest is not pinned to the approved head.')
    hashes = data.get('hashes', {})
    required = {'experiments/morph-09/state.py', 'experiments/morph-09/endpoint.json',
                'experiments/morph-08/candidates/overtone.events.json',
                'experiments/morph-07/candidates/hypnotic-motor.telemetry.json'}
    required |= {f'experiments/morph-09-v2/{n}.py' for n in ('scene', 'render', 'choreography', 'finish', 'verify')}
    required |= {f'experiments/morph-09-v3/{n}.py' for n in ('scene', 'render', 'effects', 'finish', 'verify')}
    require(required <= set(hashes), f'Source hash manifest lacks: {sorted(required - set(hashes))}')
    actual = {p: digest(ROOT / p) for p in hashes}
    require(actual == hashes, 'At least one locked creative source differs from the approved commit.')
    require(digest(AUDIO) == AUDIO_SHA, 'Original OVERTONE WAV hash differs from the approved source.')
    actual[str(AUDIO.relative_to(ROOT))] = AUDIO_SHA
    return {'sourceCommit': LOCKED, 'sourceDigest': canonical_digest(data), 'hashes': actual,
            'allLockedInputsMatch': True}


def procedural_checks():
    events, rows = v2.event_audit()
    require(events['count'] == 205, f'Expected 205 synchronized events, got {events["count"]}.')
    active = set(v3.quiet_frames())
    require(active == EXPECTED_ACTIVE, 'Effect frame routing changed from the approved V3 timing.')
    effects = v3.effect_timing()
    deterministic = v3.determinism()
    require(deterministic['arcEventsSha256'] == '2bc965c02a219fa4acc26086663e4dd010f1297583ff709b74f8907b568c183e',
            'Arc event geometry/timing differs from the approved V3 proof.')
    require(deterministic['particleEventsSha256'] == '0dd27962a316a55a5c3a5ab0366c439d06b2ef4989bb2bfede1b7dfeeba692b7',
            'Spark event geometry/timing differs from the approved V3 proof.')
    return {'events': events, 'effects': effects, 'proceduralDeterminism': deterministic,
            'cameraSeam': v2.camera_seam(), 'machineSeam': v2.machine_seam(),
            'backendWindows': {'v3': ['373-389', '406-471'], 'v2': ['0-372', '390-405', '472-479']}}, rows


def production_settings(settings, production, label):
    """Independently enforce the recorded production lock, not just its digest."""
    exact = {
        'width': 1080, 'height': 1920, 'resolutionPercentage': 100,
        'fps': 60, 'fpsBase': 1.0, 'engine': 'CYCLES', 'device': 'CPU',
        'samples': production['samples'], 'adaptiveSampling': True,
        'denoising': True, 'denoiser': 'OPENIMAGEDENOISE',
        'seed': 0, 'animatedSeed': False,
        'maxBounces': 6, 'diffuseBounces': 2, 'glossyBounces': 3,
        'transmissionBounces': 4, 'transparentMaxBounces': 4,
        'causticsReflective': False, 'causticsRefractive': False,
        'motionBlur': True, 'shutter': 0.5, 'shutterPosition': 'END',
        'viewTransform': 'AgX', 'look': 'AgX - Base Contrast',
        'exposure': 0.0, 'gamma': 1.0, 'displayDevice': 'sRGB',
        'imageFormat': 'PNG', 'colorMode': 'RGB', 'colorDepth': '8',
        'filmTransparent': False, 'threadsMode': 'FIXED',
        'threads': production['threads'], 'blenderVersion': production['blenderVersion'],
        'fullTimelineBake': [0, 479], 'sourceCommit': LOCKED,
        'rendererSha256': digest(HERE / 'render.py'),
    }
    for key, expected in exact.items():
        require(settings.get(key) == expected,
                f'{label}: production setting {key} differs: {settings.get(key)!r} != {expected!r}.')
    for key, expected in {'adaptiveThreshold': 0.04, 'sampleClampIndirect': 6.0, 'blurGlossy': 0.6}.items():
        actual = settings.get(key)
        require(isinstance(actual, (int, float)) and math.isclose(actual, expected, rel_tol=0, abs_tol=1e-7),
                f'{label}: approved production setting {key} changed.')


def frame_inventory(directory, sources, manifest=None):
    production = load(HERE / 'config.json')
    require(production.get('samplingStatus') == 'selected', 'Production sampling has not been selected from full-resolution checks.')
    actual = {p.name for p in directory.iterdir() if p.suffix.lower() == '.png'}
    require(actual == NAMES, f'Raw inventory mismatch: missing {sorted(NAMES - actual)}, extra {sorted(actual - NAMES)}')
    partial = [p.name for p in directory.iterdir() if '.part' in p.name]
    require(not partial, f'Incomplete frame writes remain: {partial}')
    records, fingerprints, versions = [], set(), set()
    small = []
    for f in range(FRAMES):
        png = directory / f'{f:04d}.png'
        pixels = image(png)
        row = load(directory / f'{f:04d}.json')
        require(row.get('frame') == f, f'Wrong sidecar frame identity: {png}')
        require(row.get('sourceCommit') == LOCKED and row.get('sourceDigest') == sources['sourceDigest'],
                f'Wrong locked source provenance for frame {f}.')
        require(row.get('backend') == ('v3' if f in EXPECTED_ACTIVE else 'v2'),
                f'Wrong scene backend at frame {f}; strobe and heat-light windows must be preserved.')
        require((row.get('width'), row.get('height')) == SIZE, f'Wrong recorded dimensions at frame {f}.')
        require(row.get('fileSha256') == digest(png), f'Raw frame hash mismatch at {f}.')
        require(row.get('pixelSha256') == hashlib.sha256(pixels.tobytes()).hexdigest(), f'Pixel hash mismatch at {f}.')
        settings = row.get('settings', {})
        require(row.get('settingsDigest') == canonical_digest(settings), f'Settings digest mismatch at {f}.')
        production_settings(settings, production, f'Frame {f}')
        require(isinstance(row.get('samples'), int) and row['samples'] > 0, f'Invalid sample count at {f}.')
        require(row['samples'] == settings['samples'], f'Sidecar and renderer sample count differ at {f}.')
        require(row.get('fullTimelineBake') == [0, 479], f'Picture {f} was not baked with the complete timeline.')
        require(row.get('blenderVersion') == settings['blenderVersion'], f'Sidecar and renderer Blender version differ at {f}.')
        fingerprints.add(row['settingsDigest'])
        versions.add(row.get('blenderVersion'))
        require(row.get('batchId'), f'Missing recoverable batch identity for frame {f}.')
        records.append(row)
        small.append(np.asarray(Image.fromarray(pixels).resize((135, 240), Image.Resampling.LANCZOS)))
    require(len(fingerprints) == 1, 'Render settings differ between production frames/batches.')
    require(len(versions) == 1 and None not in versions, 'Blender version differs between production frames/batches.')
    require(len({r['samples'] for r in records}) == 1, 'Sample count differs between production frames.')
    require(records[0]['samples'] == production.get('samples'), 'Raw master sample count differs from selected production settings.')
    require(records[0]['blenderVersion'] == production.get('blenderVersion'), 'Raw master Blender version differs from selected production settings.')
    if manifest:
        aggregate = load(manifest)
        require(aggregate.get('sourceCommit') == LOCKED and aggregate.get('frames') == records,
                'Aggregate render manifest is inconsistent with frame sidecars.')
    return records, np.stack(small)


def immutable_review_file(local, commit, repository_path, expected_sha):
    require(isinstance(commit, str) and re.fullmatch(r'[0-9a-f]{40}', commit),
            'Remote pilot evidence requires a full immutable commit SHA.')
    require(isinstance(repository_path, str) and repository_path and not repository_path.startswith('/')
            and '..' not in Path(repository_path).parts, 'Invalid remote pilot repository path.')
    require(digest(local) == expected_sha, f'Fetched remote pilot evidence changed: {local}')
    blob = subprocess.run(['git', 'show', f'{commit}:{repository_path}'], cwd=ROOT,
                          capture_output=True, check=True).stdout
    require(hashlib.sha256(blob).hexdigest() == expected_sha,
            f'Remote pilot evidence does not match its immutable commit: {repository_path}')


def quality_checks(path, sources, production, raw):
    """Require an explicit visual review supported by actual full-resolution pilot renders.

    This is a human/operator review record, not an automated aesthetic judgment.
    Local PNGs are decoded directly. Remote pilots can instead supply their
    immutable committed renderer sidecars and derived review images, retaining raw
    PNGs outside Git. Selected pilot pixels must match the actual delivered raw
    picture. An alternative sample count can justify the cheaper production setting.
    """
    evidence = load(path)
    require(evidence.get('sourceCommit') == LOCKED, 'Quality review is not pinned to the locked creative source.')
    require(evidence.get('selectedSamples') == production['samples'], 'Quality review selected a different sample count.')
    for key in ('reviewer', 'reviewedAtUtc', 'samplingRationale'):
        require(isinstance(evidence.get(key), str) and evidence[key].strip(), f'Quality review lacks {key}.')
    require(evidence.get('reviewMethod') in ('operator-visual-review', 'human-visual-review'),
            'Quality review must explicitly identify an operator or human visual review.')
    reviewed = {}
    for entry in evidence.get('renders', []):
        remote = 'recordPath' in entry
        item = Path(entry['recordPath'] if remote else entry['path'])
        if not item.is_absolute():
            item = ROOT / item
        if remote:
            immutable_review_file(item, entry.get('evidenceCommit'), entry.get('recordRepositoryPath'),
                                  entry.get('recordSha256'))
            require(re.fullmatch(r'https://github\.com/mataindustries/daemonv12/actions/runs/[0-9]+',
                                 entry.get('workflowRunUrl', '')) is not None,
                    'Remote pilot evidence lacks its producing workflow run URL.')
            row = load(item)
            review_images = entry.get('reviewImages', [])
            require(review_images, f'Remote pilot lacks immutable derived visual review images: {item}')
            for review_image in review_images:
                picture = Path(review_image['path'])
                if not picture.is_absolute():
                    picture = ROOT / picture
                immutable_review_file(picture, entry['evidenceCommit'], review_image.get('repositoryPath'),
                                      review_image.get('sha256'))
                with Image.open(picture) as im:
                    im.load()
                    require(im.format in ('JPEG', 'PNG'), f'Invalid pilot review image: {picture}')
            pixel_sha = row.get('pixelSha256')
            file_sha = row.get('fileSha256')
            require(isinstance(pixel_sha, str) and re.fullmatch(r'[0-9a-f]{64}', pixel_sha),
                    f'Remote pilot record lacks a decoded raw pixel hash: {item}')
            require(isinstance(file_sha, str) and re.fullmatch(r'[0-9a-f]{64}', file_sha),
                    f'Remote pilot record lacks a raw PNG hash: {item}')
        else:
            pixels = image(item)
            row = load(item.with_suffix('.json'))
            pixel_sha = hashlib.sha256(pixels.tobytes()).hexdigest()
            file_sha = digest(item)
        frame = row.get('frame')
        require(isinstance(frame, int) and 0 <= frame < FRAMES, f'Invalid reviewed frame: {item}')
        require((row.get('width'), row.get('height')) == SIZE, f'Reviewed pilot was not recorded at full resolution: {item}')
        require(row.get('backend') == ('v3' if frame in EXPECTED_ACTIVE else 'v2'),
                f'Reviewed pilot used the wrong production scene at picture {frame}.')
        require(row.get('sourceDigest') == sources['sourceDigest'] and row.get('sourceCommit') == LOCKED,
                f'Quality pilot uses different creative sources: {item}')
        require(row.get('fileSha256') == entry.get('fileSha256') == file_sha,
                f'Quality pilot file hash does not match reviewed evidence: {item}')
        require(row.get('pixelSha256') == entry.get('pixelSha256') == pixel_sha,
                f'Quality pilot pixel hash does not match reviewed evidence: {item}')
        require(row.get('settingsDigest') == entry.get('settingsDigest') == canonical_digest(row.get('settings', {})),
                f'Quality pilot settings do not match reviewed evidence: {item}')
        samples = row.get('samples')
        require(isinstance(samples, int) and samples > 0, f'Invalid pilot samples: {item}')
        pilot_config = {**production, 'samples': samples}
        production_settings(row['settings'], pilot_config, f'Quality pilot {item}')
        require(row.get('blenderVersion') == row['settings']['blenderVersion'],
                f'Pilot sidecar and settings Blender versions differ: {item}')
        require(row.get('fullTimelineBake') == [0, 479], f'Incomplete pilot timeline bake: {item}')
        if samples == production['samples']:
            require(row['pixelSha256'] == raw[frame]['pixelSha256'],
                    f'Reviewed selected-sample pilot differs from the delivered raw picture: {item}')
        key = (frame, samples)
        require(key not in reviewed, f'Duplicate quality evidence for frame/sample pair: {key}')
        reviewed[key] = {'frame': frame, 'samples': samples, 'fileSha256': entry['fileSha256'],
                         'pixelSha256': entry['pixelSha256'], 'settingsDigest': entry['settingsDigest'],
                         'rawPixelsDecodedLocally': not remote}
        if remote:
            reviewed[key].update({k: entry[k] for k in ('evidenceCommit', 'recordRepositoryPath', 'workflowRunUrl', 'recordSha256', 'reviewImages')})
    selected = {f for f, samples in reviewed if samples == production['samples']}
    required_groups = {
        'copperAndCeramic': set(range(FRAMES)), 'focusAndMotionBlur': set(range(FRAMES)),
        'plasma': set(range(373, 390)), 'strobe': set(range(390, 406)),
        'sparksAndVapor': set(range(408, 423)), 'phoneSizeClarity': set(range(FRAMES)),
        'cameraReturn': set(range(434, 480)), 'loopBoundary': {479, 0},
    }
    visual = evidence.get('visualReview', {})
    for name, allowed in required_groups.items():
        review = visual.get(name, {})
        frames = set(review.get('frames', []))
        require(review.get('decision') == 'pass' and isinstance(review.get('notes'), str) and review['notes'].strip(),
                f'Quality review lacks explicit visual acceptance and notes for {name}.')
        require(frames and frames <= selected and frames <= allowed,
                f'Quality review {name} is not supported by appropriate selected-sample renders.')
        if name == 'loopBoundary':
            require(frames == {479, 0}, 'Visual loop review must include both pictures 479 and 0.')
    comparisons = evidence.get('sampleComparisons', [])
    require(comparisons, 'Sampling selection lacks a full-resolution sample-count comparison.')
    for comparison in comparisons:
        frame = comparison.get('frame')
        other = comparison.get('comparisonSamples', comparison.get('lowerSamples'))
        require(isinstance(other, int) and other > 0 and other != production['samples'],
                'Sample comparison needs a positive sample count different from the production count.')
        require((frame, other) in reviewed and (frame, production['samples']) in reviewed,
                f'Sample comparison at {frame} lacks both full-resolution renders.')
        require(isinstance(comparison.get('notes'), str) and comparison['notes'].strip(),
                f'Sample comparison at {frame} lacks the quality/cost decision.')
    return {'evidenceFile': path.name, 'evidenceSha256': digest(path),
            'reviewMethod': evidence['reviewMethod'], 'reviewer': evidence['reviewer'],
            'reviewedAtUtc': evidence['reviewedAtUtc'], 'selectedSamples': production['samples'],
            'samplingRationale': evidence['samplingRationale'], 'visualReview': visual,
            'sampleComparisons': comparisons, 'verifiedPilotRenders': list(reviewed.values()),
            'automatedAestheticJudgmentClaimed': False}


def finish_checks(raw, graded, delivery):
    meta = load(delivery / 'finish-manifest.json')
    require(meta.get('sourceCommit') == LOCKED, 'Finish manifest is not pinned to the approved head.')
    require(meta.get('audio', {}).get('sha256') == AUDIO_SHA, 'Finish did not use approved original audio.')
    require(meta.get('settings', {}).get('v2FinishSha256') == digest(ROOT / 'experiments/morph-09-v2/finish.py'),
            'Finish used a different grading implementation.')
    records = meta.get('frames', [])
    require(len(records) == FRAMES and [r.get('frame') for r in records] == list(range(FRAMES)),
            'Finish frame inventory/order differs from the raw master.')
    actual = {p.name for p in graded.iterdir() if p.suffix.lower() == '.png'}
    require(actual == NAMES, 'Graded frame inventory is incomplete or has unexpected pictures.')
    small, levels = [], []
    yy, xx = np.mgrid[:SIZE[1], :SIZE[0]].astype(np.float32)
    radius = np.hypot((xx - SIZE[0] / 2) / (SIZE[0] / 2), (yy - SIZE[1] / 2) / (SIZE[1] / 2)) / np.sqrt(2)
    vignette = (1.0 - 0.28 * np.clip(radius, 0, 1) ** 2.2)[..., None]
    for f, row in enumerate(records):
        name = f'{f:04d}.png'
        require(row.get('rawSha256') == raw[f]['fileSha256'], f'Finish raw provenance mismatch at {f}.')
        path = graded / name
        pixels = image(path)
        require(row.get('gradedSha256') == digest(path), f'Graded frame hash mismatch at {f}.')
        # Independent exact check of the approved normalized vignette at every picture.
        source = image(raw[f]['_path']) if '_path' in raw[f] else None
        if source is not None:
            expected = np.clip(source.astype(np.float32) * vignette + 0.5, 0, 255).astype(np.uint8)
            require(np.array_equal(expected, pixels), f'Finish changed the approved grade at picture {f}.')
        levels.append({'frame': f, 'blackFraction': float(np.all(pixels == 0, axis=2).mean()),
                       'whiteFraction': float(np.all(pixels == 255, axis=2).mean())})
        small.append(np.asarray(Image.fromarray(pixels).resize((135, 240), Image.Resampling.LANCZOS)))
    for name, row in meta.get('outputs', {}).items():
        require(digest(delivery / name) == row['sha256'], f'Finished delivery checksum mismatch: {name}')
    return meta, np.stack(small), levels


def rerender_checks(raw, directory, boundary_frames):
    available = {int(p.stem) for p in directory.glob('[0-9][0-9][0-9][0-9].png')}
    required = REQUIRED_RENDER_CHECKS | boundary_frames
    require(required <= available, f'Independent re-renders missing required checks: {sorted(required - available)}')
    out = []
    for f in sorted(available):
        require(0 <= f < FRAMES, f'Unexpected re-render frame {f}')
        path = directory / f'{f:04d}.png'
        pixels = image(path)
        pixel_sha = hashlib.sha256(pixels.tobytes()).hexdigest()
        require(pixel_sha == raw[f]['pixelSha256'], f'Independent re-render differs at picture {f}.')
        row = load(directory / f'{f:04d}.json')
        require(row.get('settingsDigest') == raw[f]['settingsDigest'], f'Re-render settings differ at picture {f}.')
        require(row.get('sourceDigest') == raw[f]['sourceDigest'], f'Re-render source differs at picture {f}.')
        require(row.get('backend') == raw[f]['backend'], f'Re-render backend differs at picture {f}.')
        require(row.get('batchId') != raw[f]['batchId'], f'Picture {f} was not independently re-rendered.')
        require(row.get('fileSha256') == digest(path), f'Re-render sidecar hash is invalid at picture {f}.')
        out.append({'frame': f, 'pixelSha256': pixel_sha, 'pixelIdentical': True,
                    'originalBatch': raw[f]['batchId'], 'rerenderBatch': row['batchId']})
    return out


def quiet_controls(raw, directory):
    available = {int(p.stem) for p in directory.glob('[0-9][0-9][0-9][0-9].png')}
    require(REQUIRED_QUIET_CONTROLS <= available,
            f'Quiet V3 controls missing: {sorted(REQUIRED_QUIET_CONTROLS - available)}')
    out = []
    for f in sorted(available):
        require(f not in EXPECTED_ACTIVE, f'Quiet control is in an active VFX window: {f}')
        png = directory / f'{f:04d}.png'
        pixels = image(png)
        require(hashlib.sha256(pixels.tobytes()).hexdigest() == raw[f]['pixelSha256'],
                f'Effect-free V3 picture {f} differs from full-resolution V2.')
        row = load(directory / f'{f:04d}.json')
        require(row.get('backend') == 'v3', f'Quiet control {f} was not rendered with the V3 scene.')
        require(row.get('settingsDigest') == raw[f]['settingsDigest'], f'Quiet V3 settings differ at {f}.')
        require(row.get('sourceDigest') == raw[f]['sourceDigest'], f'Quiet V3 source differs at {f}.')
        out.append({'frame': f, 'v3PixelIdenticalToV2': True})
    return out


def picture_continuity(raw, small):
    x = small.astype(np.float32)
    differences = np.abs(np.roll(x, -1, axis=0) - x).mean(axis=(1, 2, 3))
    boundaries = [f for f in range(FRAMES - 1) if raw[f]['batchId'] != raw[f + 1]['batchId']]
    local = [float(differences[f]) for f in (476, 477, 478, 0, 1, 2, 3)]
    percentile95 = float(np.percentile(differences[:-1], 95))
    local_limit = 1.25 * max(local) + 0.5
    seam = float(differences[-1])
    require(seam <= percentile95 and seam <= local_limit,
            f'Rendered loop boundary is anomalous (MAD {seam:.3f}, global95 {percentile95:.3f}, '
            f'local limit {local_limit:.3f}); visual investigation is required before certification.')
    return {'metric': 'mean absolute RGB difference at 135x240 (0-255 scale)',
            'perStep': differences.tolist(), 'seam479to0': float(differences[-1]),
            'seamRankAmongAllSteps': int(np.where(np.argsort(-differences) == 479)[0][0]) + 1,
            'neighboringLoopSteps': {str(f): float(differences[f]) for f in (477, 478, 479, 0, 1)},
            'loopAnomalyCheck': {'passed': True, 'global95thPercentile': percentile95,
                                 'maximumLocalStep': max(local), 'localLimit': local_limit,
                                 'rule': 'seam <= 95th percentile of other steps and <= 1.25*max seven nearby steps + 0.5',
                                 'visualReviewRequiredSeparately': True},
            'batches': len({r['batchId'] for r in raw}),
            'batchBoundaries': [{'left': f, 'right': f + 1, 'meanAbsDiff': float(differences[f]),
                                 'independentBoundaryRerendersRequired': [f, f + 1]} for f in boundaries]}, \
        {n for f in boundaries for n in (f, f + 1)}


def probe(path):
    p = subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-show_streams', '-show_format',
                        '-show_frames', '-show_entries',
                        'stream:format:frame=media_type,best_effort_timestamp_time,pkt_duration_time',
                        '-of', 'json', str(path)], capture_output=True, check=True)
    require(not p.stderr, f'ffprobe reported errors for {path}: {p.stderr.decode(errors="replace")}')
    return json.loads(p.stdout)


def container_atoms(path):
    """Read ISO BMFF top-level headers to verify the actual fast-start layout."""
    atoms = []
    total = path.stat().st_size
    with path.open('rb') as stream:
        offset = 0
        while offset < total:
            stream.seek(offset)
            header = stream.read(8)
            require(len(header) == 8, f'{path.name}: truncated container atom header.')
            size, kind = struct.unpack('>I4s', header)
            if size == 1:
                extended = stream.read(8)
                require(len(extended) == 8, f'{path.name}: truncated extended atom size.')
                size = struct.unpack('>Q', extended)[0]
            elif size == 0:
                size = total - offset
            require(size >= 8 and offset + size <= total, f'{path.name}: invalid container atom size.')
            atoms.append({'type': kind.decode('ascii', errors='replace'), 'offset': offset, 'bytes': size})
            offset += size
    types = [a['type'] for a in atoms]
    require('moov' in types and 'mdat' in types and types.index('moov') < types.index('mdat'),
            f'{path.name}: moov metadata does not precede media payload for Android download playback.')
    return atoms


def original_audio():
    with wave.open(str(AUDIO), 'rb') as wav:
        info = {'channels': wav.getnchannels(), 'sampleRate': wav.getframerate(),
                'sampleWidthBytes': wav.getsampwidth(), 'sampleFrames': wav.getnframes()}
        require(info['sampleWidthBytes'] == 2, 'Approved original audio is not signed 16-bit PCM.')
        pcm = wav.readframes(wav.getnframes())
    require(info['sampleFrames'] == info['sampleRate'] * 8, 'Approved audio does not contain exactly 8 seconds.')
    samples = np.frombuffer(pcm, dtype='<i2').astype(np.float32) / 32768.0
    require(float(np.abs(samples).max()) < 1, 'Original PCM clips.')
    return info, pcm, samples


def media(path, reference, audio_info, approved_pcm, approved_float, pcm_reference):
    atoms = container_atoms(path)
    metadata = probe(path)
    require(len(metadata['streams']) == 2, f'{path.name} must have exactly one video and one audio stream.')
    video = next(s for s in metadata['streams'] if s['codec_type'] == 'video')
    audio = next(s for s in metadata['streams'] if s['codec_type'] == 'audio')
    require(video['codec_name'] == 'h264' and video['pix_fmt'] == 'yuv420p', f'{path.name}: incompatible video codec/pixel format.')
    require(video.get('profile') == 'High' and int(video.get('level', 0)) <= 42, f'{path.name}: unexpected Android H.264 profile/level.')
    require((video['width'], video['height']) == SIZE, f'{path.name}: wrong display resolution.')
    require(video.get('sample_aspect_ratio') == '1:1' and video.get('display_aspect_ratio') == '9:16',
            f'{path.name}: Android display geometry is not explicitly square-pixel 9:16.')
    color_metadata = {'color_range': 'tv', 'color_space': 'smpte170m',
                      'color_primaries': 'bt709', 'color_transfer': 'iec61966-2-1'}
    require(all(video.get(key) == value for key, value in color_metadata.items()),
            f'{path.name}: color matrix/range/primaries/transfer differ from the proof-preserving finish.')
    require(video['r_frame_rate'] == '60/1' and video['avg_frame_rate'] == '60/1', f'{path.name}: not constant 60 fps.')
    require(int(video['nb_read_frames']) == FRAMES, f'{path.name}: not exactly 480 decodable pictures.')
    require(abs(float(metadata['format']['duration']) - 8.0) < 0.0001, f'{path.name}: container is not exactly 8 seconds.')
    require(abs(float(video.get('duration', 8)) - 8.0) < 0.0001, f'{path.name}: video is not exactly 8 seconds.')
    vf = [f for f in metadata['frames'] if f['media_type'] == 'video']
    require(len(vf) == FRAMES, f'{path.name}: displayed picture count differs.')
    pts = [float(f['best_effort_timestamp_time']) for f in vf]
    require(all(abs(t - f / 60) < 0.000002 for f, t in enumerate(pts)), f'{path.name}: duplicate/missing/nonuniform picture timestamps.')
    require(int(audio['sample_rate']) == audio_info['sampleRate'] and audio['channels'] == audio_info['channels'],
            f'{path.name}: audio rate/channels were altered.')
    require(abs(float(audio.get('duration', 8)) - 8.0) < 0.0001, f'{path.name}: audio stream duration is not eight seconds.')
    if pcm_reference:
        require(audio['codec_name'].startswith('pcm_'), 'The lossless-audio reference is not PCM.')
    else:
        require(audio['codec_name'] == 'aac', 'The Android viewing copy does not have AAC audio.')
    decoder = subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(path), '-map', '0:v:0',
                              '-vf', 'scale=135:240:flags=lanczos', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'],
                             capture_output=True, check=True)
    require(not decoder.stderr, f'{path.name}: video decode errors.')
    expected_bytes = FRAMES * 135 * 240 * 3
    require(len(decoder.stdout) == expected_bytes, f'{path.name}: decoded image buffer count differs.')
    decoded = np.frombuffer(decoder.stdout, np.uint8).reshape(FRAMES, 240, 135, 3).astype(np.float32)
    ref = reference.astype(np.float32)
    errors = np.abs(decoded - ref).mean(axis=(1, 2, 3))
    require(float(errors.max()) < 8.0, f'{path.name}: decoded pictures do not match the ordered graded sequence.')
    wrong = []
    for f in range(FRAMES):
        candidates = [n for n in (f - 1, f + 1) if 0 <= n < FRAMES]
        nearest = min(float(np.abs(decoded[f] - ref[n]).mean()) for n in candidates)
        if float(errors[f]) > nearest + 0.5:
            wrong.append(f)
    require(not wrong, f'{path.name}: likely reordered/missing pictures at {wrong}.')
    duplicates = []
    for f in range(FRAMES - 1):
        if np.array_equal(decoded[f], decoded[f + 1]) and float(np.abs(ref[f] - ref[f + 1]).mean()) > 0.5:
            duplicates.append(f)
    require(not duplicates, f'{path.name}: duplicated decoded pictures at {duplicates}.')
    audio_decode = subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(path), '-map', '0:a:0',
                                   '-c:a', 'pcm_s16le' if pcm_reference else 'pcm_f32le',
                                   '-f', 's16le' if pcm_reference else 'f32le', '-'], capture_output=True, check=True)
    require(not audio_decode.stderr, f'{path.name}: audio decode errors.')
    if pcm_reference:
        require(audio_decode.stdout == approved_pcm, 'Lossless reference PCM differs from original sample-for-sample.')
        audio_result = {'originalPcmSampleForSample': True, 'sha256': hashlib.sha256(audio_decode.stdout).hexdigest(),
                        'peak': float(np.abs(approved_float).max())}
    else:
        samples = np.frombuffer(audio_decode.stdout, dtype='<f4')
        require(len(samples) >= len(approved_float), 'AAC decode ended before the original audio.')
        require(len(samples) - len(approved_float) <= 1024 * audio_info['channels'], 'Excessive AAC tail/padding.')
        aligned = samples[:len(approved_float)]
        peak = float(np.abs(samples).max())
        require(math.isfinite(peak) and peak < 1.0, f'AAC decode clips: peak {peak}.')
        correlation = float(np.corrcoef(approved_float, aligned)[0, 1])
        require(correlation > 0.99, f'AAC waveform differs from the unchanged source (correlation {correlation}).')
        # A compensated AAC encode must remain aligned with the original event map.
        mono_ref = approved_float.reshape(-1, audio_info['channels']).mean(axis=1)
        mono_aac = aligned.reshape(-1, audio_info['channels']).mean(axis=1)
        lag_scores = {lag: float(np.dot(mono_ref[max(0, lag):len(mono_ref) + min(0, lag)],
                                       mono_aac[max(0, -lag):len(mono_aac) - max(0, lag)])) for lag in range(-8, 9)}
        best_lag = max(lag_scores, key=lag_scores.get)
        require(best_lag == 0, f'AAC has an uncompensated sample offset of {best_lag}.')
        audio_result = {'originalSourceSha256': AUDIO_SHA, 'decodedPeak': peak,
                        'correlationWithOriginal': correlation, 'bestOffsetSamplesWithinPlusMinus8': best_lag,
                        'decodedSampleFrames': len(samples) // audio_info['channels'],
                        'trailingDecoderPaddingSampleFrames': (len(samples) - len(approved_float)) // audio_info['channels']}
    return {'file': path.name, 'sha256': digest(path), 'bytes': path.stat().st_size,
            'dimensions': list(SIZE), 'frames': FRAMES, 'fps': '60/1', 'durationSeconds': 8.0,
            'sampleAspectRatio': video['sample_aspect_ratio'], 'displayAspectRatio': video['display_aspect_ratio'],
            'colorMetadata': color_metadata,
            'videoCodec': video['codec_name'], 'audioCodec': audio['codec_name'],
            'fastStartAtomLayout': atoms,
            'everyDisplayedTimestampVerified': True, 'completeDecodeWithoutErrors': True,
            'orderedSequenceMeanAbsError': float(errors.mean()), 'orderedSequenceMaxFrameMeanAbsError': float(errors.max()),
            'noUnexpectedDecodedDuplicates': True, 'audio': audio_result}


def checksum_file(delivery):
    paths = sorted(p for p in delivery.iterdir() if p.is_file() and p.name != 'SHA256SUMS' and '.part' not in p.name)
    (delivery / 'SHA256SUMS').write_text(''.join(f'{digest(p)}  {p.name}\n' for p in paths))


def markdown(report):
    status = 'VERIFIED LOCAL MASTER' if report['status'] == 'verified-local-master' else 'PREFLIGHT ONLY — master rendering and media verification pending'
    lines = [f'# MORPH//09 V3 — production verification', '', f'**{status}**', '',
             f'Creative source: `{LOCKED}`.', '',
             'The approved proof and historical files remain unchanged. Master scripts read the original scene, choreography, effects, event map, rotor telemetry and OVERTONE audio.', '',
             f'All {report["procedural"]["events"]["count"]} event presentation times pass the original sample-accurate audit. Electrical arcs, strobe, braking and vapor retain their approved windows.', '',
             'The camera closes with matching position, orientation, lens, focus and velocity. The unchanged telemetry retains its approved 0.01249° rotor residual; it was not corrected.', '']
    if report['status'] == 'verified-local-master':
        lines += ['480 genuine 1080 × 1920 Cycles renders, ordered at exactly 60 fps / 8.000 seconds, passed source, settings, file and decoded-pixel provenance checks.', '',
                  f'Production samples: {report["render"]["samples"]}; Blender: {report["render"]["blenderVersion"]}.', '',
                  f'Full-resolution visual quality and sample selection were reviewed by {report["qualityReview"]["reviewer"]} '
                  f'using {report["qualityReview"]["reviewMethod"]}. The linked quality evidence hashes every reviewed render '
                  'and records the sample comparison. This is an explicit visual review, not an automated aesthetic judgment.', '',
                  f'{len(report["independentRerenders"])} independently rendered pictures match exactly, including every recoverable batch boundary. Quiet V3 controls match the full-resolution V2 pictures exactly.', '',
                  'The approved V2 finish is verified pixel-for-pixel. Both containers decode completely; timestamps, picture order, audio duration and codecs pass. The MOV PCM equals the original samples exactly. The AAC copy has no detected sample offset or decoded clipping.', '',
                  'The picture seam passed a numerical anomaly check against nearby frames and the whole loop; '
                  'the 479 → 0 pictures also have explicit visual acceptance in the quality evidence. '
                  'Picture seam and batch metrics are recorded in production-verification.json. '
                  'Contact and loop sheets are review artifacts; the video contains no text overlays.', '',
                  'Public retrieval and Android device playback remain separate delivery checks. This report does not claim either until recorded by the delivery verification. No YouTube publication or deployment is part of this build.', '']
    else:
        lines += ['No full-resolution delivery, container, batch-boundary or public-download result is claimed by this preflight.', '']
    return '\n'.join(lines)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--preflight', action='store_true', help='Source/timeline audit only; never claims a finished master.')
    ap.add_argument('--frames', type=Path, default=WORK / 'frames')
    ap.add_argument('--graded', type=Path, default=WORK / 'graded')
    ap.add_argument('--delivery', '--out', type=Path, default=HERE / 'delivery')
    ap.add_argument('--source-hashes', type=Path, default=HERE / 'source-hashes.json')
    ap.add_argument('--manifest', type=Path)
    ap.add_argument('--rerenders', type=Path, default=WORK / 'rerenders')
    ap.add_argument('--quiet-v3', type=Path, default=WORK / 'quiet-v3')
    ap.add_argument('--quality-evidence', type=Path, help='Explicit visual/sample review; defaults to delivery/quality-evidence.json')
    ap.add_argument('--name', default=NAME)
    a = ap.parse_args()
    a.delivery.mkdir(parents=True, exist_ok=True)
    sources = source_checks(a.source_hashes)
    procedural, events = procedural_checks()
    report = {'kind': 'morph09-v3-1080p-production-verification',
              'status': 'preflight-only' if a.preflight else 'verified-local-master',
              'verifiedAtUtc': datetime.now(timezone.utc).isoformat(), 'sources': sources,
              'procedural': procedural, 'publicDownloadVerified': False, 'androidDevicePlaybackTested': False}
    if not a.preflight:
        raw, small = frame_inventory(a.frames, sources, a.manifest)
        report['qualityReview'] = quality_checks(a.quality_evidence or a.delivery / 'quality-evidence.json',
                                                 sources, load(HERE / 'config.json'), raw)
        continuity, boundaries = picture_continuity(raw, small)
        report['independentRerenders'] = rerender_checks(raw, a.rerenders, boundaries)
        report['quietV3Controls'] = quiet_controls(raw, a.quiet_v3)
        for row in raw:
            row['_path'] = str(a.frames / f'{row["frame"]:04d}.png')
        finish, graded_small, levels = finish_checks(raw, a.graded, a.delivery)
        audio_info, pcm, samples = original_audio()
        report['media'] = {ext: media(a.delivery / f'{a.name}.{ext}', graded_small, audio_info, pcm, samples, ext == 'mov')
                           for ext in ('mov', 'mp4')}
        report['render'] = {'dimensions': list(SIZE), 'frames': FRAMES, 'fps': 60, 'durationSeconds': 8.0,
                            'samples': raw[0]['samples'], 'settings': raw[0]['settings'],
                            'settingsDigest': raw[0]['settingsDigest'], 'blenderVersion': raw[0]['blenderVersion'],
                            'sourceAndPixelInventoryVerified': True}
        report['pictureContinuity'] = continuity
        report['finish'] = {'manifestSha256': digest(a.delivery / 'finish-manifest.json'),
                            'approvedVignetteVerifiedEveryPixel': True, 'pixelLevelDiagnostics': levels}
        report['checksPassed'] = ['locked_sources', '205_events', 'effect_windows', 'camera_return',
                                  'unchanged_machine_return', 'procedural_determinism', '480_full_resolution_renders',
                                  'documented_full_resolution_visual_review', 'justified_sampling_selection', 'rendered_loop_anomaly_check',
                                  'consistent_cycles_settings', 'recoverable_batch_continuity', 'selected_render_determinism',
                                  'quiet_v3_identity', 'approved_finish', 'ordered_media_timestamps', 'exact_eight_seconds',
                                  'pcm_identity', 'aac_alignment_and_peak', 'complete_container_decode']
    else:
        report['checksPassed'] = ['locked_sources', '205_events', 'effect_windows', 'camera_return',
                                  'unchanged_machine_return', 'procedural_determinism']
    stem = 'preflight-verification' if a.preflight else 'production-verification'
    write_json(a.delivery / f'{stem}.json', report)
    (a.delivery / f'{stem}.md').write_text(markdown(report) + '\n')
    with (a.delivery / 'master-sync-audit.csv').open('w', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=['track', 'eventId', 'sampleFrame', 'firstVisibleFrame', 'delayMs'], extrasaction='ignore')
        writer.writeheader()
        writer.writerows(events)
    if not a.preflight:
        checksum_file(a.delivery)
    print(json.dumps({'status': report['status'], 'checksPassed': report['checksPassed'],
                      'report': str(a.delivery / f'{stem}.json')}, indent=2))


if __name__ == '__main__':
    main()
