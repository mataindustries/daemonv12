"""Full-resolution MORPH//09 V3 renderer; approved scene/baking code stays read-only.

blender -b --python experiments/morph-09-v3/master/render.py -- --frames 0-95 --resume
Pictures, key times, settings and source provenance are verified before resuming.
Every invocation bakes all 480 pictures before rendering its selected subset.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import sys
import time
import uuid
from pathlib import Path
from types import SimpleNamespace

import bpy
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
WORK = ROOT / 'work' / 'morph-09-v3-master'
SOURCE_COMMIT = '9e8a03d2b5bfed15f8056970ca3b4cdb1c2cfbc7'


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def atomic_json(path, value):
    path = Path(path)
    part = path.with_name('.part-' + path.name)
    part.write_text(json.dumps(value, indent=2, sort_keys=True) + '\n')
    os.replace(part, path)


def pixel_hash(path):
    with Image.open(path) as im:
        im.load()
        assert im.size == (1080, 1920), (str(path), im.size)
        assert im.mode == 'RGB', (str(path), im.mode)
        return hashlib.sha256(im.convert('RGB').tobytes()).hexdigest()


def parse_frames(spec):
    """Strict inclusive picture ranges, comma lists, optional positive range steps."""
    frames = []
    for token in spec.split(','):
        part, sep, stride = token.partition(':')
        step = int(stride) if sep else 1
        if step < 1:
            raise ValueError('frame step must be positive')
        if '-' in part:
            first, last = map(int, part.split('-'))
            if last < first:
                raise ValueError('descending frame range')
            frames.extend(range(first, last + 1, step))
        else:
            frames.append(int(part))
    if not frames or any(f < 0 or f >= 480 for f in frames):
        raise ValueError('picture indices must be inside 0..479')
    if len(set(frames)) != len(frames):
        raise ValueError('duplicate picture in requested frame list')
    return sorted(frames)


def load_v3():
    # Its unchanged loader exposes V2's unchanged bake/setup functions.
    spec = importlib.util.spec_from_file_location('approved_v3_render', HERE.parent / 'render.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def expected_backend(frame):
    return 'v3' if 373 <= frame <= 389 or 406 <= frame <= 471 else 'v2'


def source_provenance(path):
    source = json.loads(path.read_text())
    assert source['sourceCommit'] == SOURCE_COMMIT
    assert source['hashes'], 'empty source manifest'
    for rel, expected in source['hashes'].items():
        actual = sha(ROOT / rel)
        assert actual == expected, f'creative source changed: {rel}'
    return hashlib.sha256(canonical(source)).hexdigest()


def verify_scene_build(source_digest):
    manifest_path = WORK / 'scene-build.json'
    assert manifest_path.is_file(), 'run master/build.sh --prepare before rendering'
    manifest = json.loads(manifest_path.read_text())
    assert manifest['sourceDigest'] == source_digest, 'scene build predates the locked sources manifest'
    assert manifest['blenderVersion'] == bpy.app.version_string, 'scene build uses a different Blender version'
    for rel, expected in manifest['files'].items():
        assert sha(ROOT / rel) == expected, f'stale or changed scene: {rel}'


def settings(scene, config):
    c, r, v = scene.cycles, scene.render, scene.view_settings
    return {
        'width': r.resolution_x, 'height': r.resolution_y,
        'resolutionPercentage': r.resolution_percentage,
        'fps': r.fps, 'fpsBase': r.fps_base, 'engine': r.engine,
        'device': c.device, 'samples': c.samples,
        'adaptiveSampling': c.use_adaptive_sampling,
        'adaptiveThreshold': c.adaptive_threshold,
        'adaptiveMinSamples': c.adaptive_min_samples,
        'denoising': c.use_denoising, 'denoiser': c.denoiser,
        'denoisingInputPasses': c.denoising_input_passes,
        'denoisingPrefilter': c.denoising_prefilter,
        'denoisingUseGpu': c.denoising_use_gpu,
        'seed': c.seed, 'animatedSeed': c.use_animated_seed,
        'maxBounces': c.max_bounces, 'diffuseBounces': c.diffuse_bounces,
        'glossyBounces': c.glossy_bounces, 'transmissionBounces': c.transmission_bounces,
        'transparentMaxBounces': c.transparent_max_bounces,
        'causticsReflective': c.caustics_reflective,
        'causticsRefractive': c.caustics_refractive,
        'sampleClampIndirect': c.sample_clamp_indirect, 'blurGlossy': c.blur_glossy,
        'motionBlur': r.use_motion_blur, 'shutter': r.motion_blur_shutter,
        'shutterPosition': r.motion_blur_position,
        'viewTransform': v.view_transform, 'look': v.look,
        'exposure': v.exposure, 'gamma': v.gamma,
        'displayDevice': scene.display_settings.display_device,
        'imageFormat': r.image_settings.file_format,
        'colorMode': r.image_settings.color_mode,
        'colorDepth': r.image_settings.color_depth,
        'filmTransparent': r.film_transparent,
        'threadsMode': r.threads_mode, 'threads': r.threads,
        'blenderVersion': bpy.app.version_string,
        'fullTimelineBake': [0, 479],
        'rendererSha256': sha(Path(__file__)),
        'sourceCommit': config['sourceCommit'],
    }


def assert_lock(s):
    assert (s['width'], s['height'], s['resolutionPercentage']) == (1080, 1920, 100)
    assert s['fps'] == 60 and s['fpsBase'] == 1.0
    assert s['engine'] == 'CYCLES' and s['device'] == 'CPU'
    assert s['denoising'] and s['denoiser'] == 'OPENIMAGEDENOISE'
    assert s['motionBlur'] and s['shutter'] == 0.5 and s['shutterPosition'] == 'END'
    assert s['viewTransform'] == 'AgX' and s['look'] == 'AgX - Base Contrast'
    assert s['exposure'] == 0.0 and s['gamma'] == 1.0
    assert s['imageFormat'] == 'PNG' and s['colorMode'] == 'RGB' and s['colorDepth'] == '8'
    assert s['samples'] > 0


def verify_existing(path, record_path, expected):
    assert record_path.is_file(), f'PNG has no provenance record: {path}'
    row = json.loads(record_path.read_text())
    for key, value in expected.items():
        assert row.get(key) == value, f'incompatible resume provenance {path}: {key}'
    assert row['fileSha256'] == sha(path), f'corrupt existing PNG: {path}'
    assert row['pixelSha256'] == pixel_hash(path), f'corrupt existing pixels: {path}'
    return row


def update_manifest(out):
    rows = []
    for path in sorted(out.glob('[0-9][0-9][0-9][0-9].json')):
        row = json.loads(path.read_text())
        assert (out / f'{row["frame"]:04d}.png').is_file(), f'orphan provenance: {path}'
        rows.append(row)
    if not rows:
        return
    first = rows[0]
    for row in rows:
        for key in ('sourceCommit', 'sourceDigest', 'settingsDigest'):
            assert row[key] == first[key], f'mixed production provenance: {key}'
    atomic_json(out.parent / ('render-manifest.json' if out.name == 'frames' else out.name + '-manifest.json'), {
        'schemaVersion': 1, 'sourceCommit': SOURCE_COMMIT,
        'sourceDigest': first['sourceDigest'], 'settingsDigest': first['settingsDigest'],
        'settings': first['settings'], 'frames': rows,
    })


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--frames', default='0-479')
    parser.add_argument('--out', type=Path)
    parser.add_argument('--samples', type=int)
    parser.add_argument('--config', type=Path, default=HERE / 'config.json')
    parser.add_argument('--source-hashes', type=Path, default=HERE / 'source-hashes.json')
    parser.add_argument('--backend', choices=['auto', 'v2', 'v3'], default='auto')
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--allow-provisional', action='store_true', help='representative tests before sample selection')
    parser.add_argument('--batch-id', default='')
    args = parser.parse_args(argv)
    config = json.loads(args.config.read_text())
    assert config['sourceCommit'] == SOURCE_COMMIT
    assert (config['width'], config['height'], config['fps'], config['frameCount']) == (1080, 1920, 60, 480)
    assert bpy.app.version_string == config['blenderVersion'], 'use the matching approved bpy/Blender runtime'
    if config['samplingStatus'] != 'selected' and not args.allow_provisional:
        raise SystemExit('Sampling is provisional. Run representative checks with --allow-provisional, then record the selection in config.json.')
    if args.backend != 'auto' and args.out is None:
        raise SystemExit('Forced backend controls require a separate explicit --out directory.')
    args.out = args.out or WORK / 'frames'
    args.out.mkdir(parents=True, exist_ok=True)
    frames = parse_frames(args.frames)
    samples = args.samples if args.samples is not None else config['samples']
    assert samples > 0
    source_digest = source_provenance(args.source_hashes)
    verify_scene_build(source_digest)
    v3 = load_v3()
    # Confirm the route against approved procedural effect windows, not only hard-coded ranges.
    arcs, sparks = v3.fx.arc_events(), v3.fx.spark_events()
    for f in range(480):
        t = f / 60
        active = any(any(v > 0 for v in v3.fx.arc_level(a, f)) for a in arcs) or any(v3.fx.spark_state(p, t) for p in sparks) or v3.fx.vapor(t)['envelope'] > 0 or v3.heat_window(t) * v3.fx.heat_glow(t) > 1e-4
        assert active == (expected_backend(f) == 'v3'), f'route disagrees with effect timeline at {f}'
    batch_id = args.batch_id or uuid.uuid4().hex
    settings_digest = None
    timeline = list(range(480))
    for backend in ('v2', 'v3'):
        selected = [f for f in frames if (expected_backend(f) if args.backend == 'auto' else args.backend) == backend]
        if not selected:
            continue
        blend_dir = ROOT / 'work' / ('morph-09-v3' if backend == 'v3' else 'morph-09-v2')
        blend = blend_dir / ('resonator-v3.blend' if backend == 'v3' else 'resonator.blend')
        bpy.ops.wm.open_mainfile(filepath=str(blend))
        meta = json.loads((blend_dir / 'resonator.json').read_text())
        baked = v3.v2.bake(timeline, meta)
        if backend == 'v3':
            baked += v3.bake_effects(timeline, meta)
        v3.v2.setup(SimpleNamespace(width=1080, samples=samples), meta)
        scene = bpy.context.scene
        scene.render.threads_mode = 'FIXED'
        scene.render.threads = config['threads']
        state = settings(scene, config)
        assert_lock(state)
        digest = hashlib.sha256(canonical(state)).hexdigest()
        if settings_digest is not None:
            assert settings_digest == digest, 'V2 and V3 production settings differ'
        settings_digest = digest
        # Reject mixed histories before spending time rendering another picture.
        for old_record in args.out.glob('[0-9][0-9][0-9][0-9].json'):
            old = json.loads(old_record.read_text())
            assert old['sourceDigest'] == source_digest, f'incompatible source history: {old_record}'
            assert old['settingsDigest'] == digest, f'incompatible settings history: {old_record}'
        print(f'BAKED {baked} keys for ALL480, backend={backend}, requested={len(selected)} settings={digest}', flush=True)
        for frame in selected:
            path = args.out / f'{frame:04d}.png'
            record_path = args.out / f'{frame:04d}.json'
            expected = {
                'frame': frame, 'backend': backend, 'width': 1080, 'height': 1920,
                'samples': samples, 'sourceCommit': SOURCE_COMMIT,
                'sourceDigest': source_digest, 'settingsDigest': digest,
                'blenderVersion': bpy.app.version_string,
            }
            if path.exists():
                if not args.resume:
                    raise FileExistsError(f'{path}; use --resume to verify and retain it')
                verify_existing(path, record_path, expected)
                print(f'KEPT {frame:04d} verified provenance and PNG', flush=True)
                continue
            if record_path.exists():
                partial = args.out / f'.part-{frame:04d}.png'
                if args.resume and partial.is_file():
                    verify_existing(partial, record_path, expected)
                    os.replace(partial, path)
                    print(f'RECOVERED {frame:04d} verified completed partial render', flush=True)
                    continue
                raise RuntimeError(f'orphan provenance record without a recoverable PNG: {record_path}')
            scene.frame_set(frame + 1)
            partial = args.out / f'.part-{frame:04d}.png'
            scene.render.filepath = str(partial)
            started = time.monotonic()
            bpy.ops.render.render(write_still=True)
            elapsed = time.monotonic() - started
            px = pixel_hash(partial)
            record = dict(expected, schemaVersion=1, settings=state,
                          fileSha256=sha(partial), pixelSha256=px,
                          renderSeconds=elapsed, batchId=batch_id,
                          fullTimelineBake=[0, 479])
            # JSON first; a crash between the two renames leaves an orphan record that is rejected.
            atomic_json(record_path, record)
            os.replace(partial, path)
            update_manifest(args.out)
            print(f'FRAME {frame} backend={backend} samples={samples} {elapsed:.2f}s sha256={record["fileSha256"]}', flush=True)
    update_manifest(args.out)


if __name__ == '__main__':
    main()
