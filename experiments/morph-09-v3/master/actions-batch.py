#!/usr/bin/env python3
"""Plan/run/recover standard public-runner batches. No paid service is provisioned.

Pilot mode publishes only derived JPEG review plates and JSON on the production
branch. Raw PNGs stay outside Git. Production artifact upload requires an explicit
configured authorization and byte budget; the workflow is disabled until review.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
import platform
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
WORK = ROOT / 'work/morph-09-v3-master'
LOCKED = '9e8a03d2b5bfed15f8056970ca3b4cdb1c2cfbc7'
BRANCH = 'prod/morph-09-v3-1080p-master'
PILOT_PAIRS = [(0, 24), (242, 373), (389, 390), (396, 405), (406, 418), (433, 434), (472, 479)]
DETERMINISM = {0, 389, 396, 418, 479}
QUIET = {0, 372, 390, 405, 472, 479}


def load(path):
    return json.loads(Path(path).read_text())


def save(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, sort_keys=True, indent=2) + '\n')


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def config():
    c = load(HERE / 'config.json')
    assert c['sourceCommit'] == LOCKED
    assert (c['width'], c['height'], c['fps'], c['frameCount']) == (1080, 1920, 60, 480)
    assert c.get('actionMode', 'pilot') in ('pilot', 'production')
    assert c['threads'] in (2, 4), 'only the documented standard public runner CPU configuration is supported'
    return c


def plan(c):
    mode = c.get('actionMode', 'pilot')
    if mode == 'pilot':
        assert c.get('actionsPilotReviewGitAuthorized', False), 'pilot review commits have not been enabled after review'
        jobs = [{'id': f'p{i:02d}', 'mode': mode, 'frames': list(pair)} for i, pair in enumerate(PILOT_PAIRS)]
    else:
        assert c['samplingStatus'] == 'selected', 'representative sampling checks must finish first'
        assert c.get('actionsArtifactsAuthorized', False), 'verify free artifact headroom or obtain storage approval first'
        budget = int(c.get('actionsArtifactBudgetBytes', 0))
        assert budget > 0, 'set an authorized byte budget for this run'
        jobs = []
        for i, first in enumerate(range(0, 480, 30)):
            last = first + 29
            rerenders = ({first} if first else set()) | ({last} if last < 479 else set())
            rerenders |= {f for f in DETERMINISM if first <= f <= last}
            jobs.append({'id': f'b{i:02d}', 'mode': mode, 'first': first, 'last': last,
                         'frames': list(range(first, last + 1)), 'rerenders': sorted(rerenders),
                         'quiet': sorted(f for f in QUIET if first <= f <= last),
                         'artifactBudgetBytes': budget // 16})
    return {'include': [{'job': j} for j in jobs]}


def selected_job(c):
    requested = json.loads(os.environ.get('MORPH_JOB', '{}'))
    expected = next((row['job'] for row in plan(c)['include'] if row['job']['id'] == requested.get('id')), None)
    assert expected == requested, 'matrix job does not match the checked-in production plan'
    return expected


def run_command(label, command, env=None):
    logs = WORK / 'logs'
    logs.mkdir(parents=True, exist_ok=True)
    print(label + ': ' + ' '.join(map(str, command)), flush=True)
    with (logs / (label + '.log')).open('w') as stream:
        subprocess.run([str(x) for x in command], cwd=ROOT, env=env, stdout=stream, stderr=subprocess.STDOUT, check=True)


def render(label, frames, out, batch_id, samples=None, backend=None):
    if not frames:
        return
    command = [sys.executable, HERE / 'render.py', '--frames', ','.join(map(str, frames)),
               '--out', WORK / out, '--batch-id', batch_id, '--resume']
    if samples is not None:
        command += ['--samples', str(samples), '--allow-provisional']
    if backend:
        command += ['--backend', backend]
    run_command(label, command)


def runtime(c, job):
    WORK.mkdir(parents=True, exist_ok=True)
    assert sys.version_info[:2] == (3, 11), 'matching Python3.11 required'
    import bpy
    assert bpy.app.version_string == c['blenderVersion'] == '4.3.0'
    assert importlib.metadata.version('numpy') == '1.26.4'
    assert (os.cpu_count() or 0) >= c['threads'], 'insufficient CPU threads'
    disk = shutil.disk_usage(WORK)
    assert disk.free >= 4 * 1024**3, 'less than4GiB free after runtime installation'
    versions = {d.metadata['Name']: d.version for d in importlib.metadata.distributions()}
    info = {'job': job, 'pythonVersion': sys.version, 'blenderVersion': bpy.app.version_string,
            'platform': platform.platform(), 'machine': platform.machine(),
            'logicalCpus': os.cpu_count(), 'renderThreads': c['threads'],
            'diskFreeBeforeBytes': disk.free, 'installedPackages': versions,
            'pipelineCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
            'runnerLabel': 'ubuntu-24.04', 'computeClass': 'standard-public-free',
            'actionsRunId': os.environ.get('GITHUB_RUN_ID'), 'actionsRunAttempt': os.environ.get('GITHUB_RUN_ATTEMPT')}
    save(WORK / 'runtime.json', info)


def run_job(c, job):
    runtime(c, job)
    env = dict(os.environ, BLENDER_PY=sys.executable, PYTHON=sys.executable)
    run_command('prepare', ['bash', HERE / 'build.sh', '--prepare'], env)
    run_command('source-preflight', [sys.executable, HERE / 'verify.py', '--preflight', '--delivery', WORK / 'preflight'])
    run_id = os.environ.get('GITHUB_RUN_ID', 'local')
    attempt = os.environ.get('GITHUB_RUN_ATTEMPT', '1')
    base = f'actions-{run_id}-{attempt}-{job["id"]}'
    if job['mode'] == 'pilot':
        for samples in (32, 64):
            render(f'pilot{samples}', job['frames'], f'pilot{samples}', base + f'-s{samples}', samples=samples)
    else:
        render('production', job['frames'], 'frames', base)
        render('independent-controls', job['rerenders'], 'rerenders', base + '-independent')
        render('quiet-v3-controls', job['quiet'], 'quiet-v3', base + '-quiet-v3', backend='v3')


def pilot_reviews(c, job):
    """Derived review JPEGs/metrics only; none of the raw PNGs enters Git."""
    assert job['mode'] == 'pilot' and c.get('actionsPilotReviewGitAuthorized', False)
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont
    run_id = os.environ.get('GITHUB_RUN_ID', 'local')
    attempt = os.environ.get('GITHUB_RUN_ATTEMPT', '1')
    assert re.fullmatch(r'[0-9a-z-]+', run_id + '-' + attempt)
    out = HERE / 'pilot-review' / f'{run_id}-{attempt}' / job['id']
    out.mkdir(parents=True, exist_ok=True)
    font_path = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
    font = ImageFont.truetype(str(font_path), 28) if font_path.exists() else ImageFont.load_default(size=28)
    rows = []
    for frame in job['frames']:
        paths = [WORK / f'pilot{s}' / f'{frame:04d}.png' for s in (32, 64)]
        # A failed job can still publish its completed paired comparisons.
        if not all(p.is_file() and p.with_suffix('.json').is_file() for p in paths):
            continue
        ims = [Image.open(p).convert('RGB') for p in paths]
        assert all(im.size == (1080, 1920) for im in ims)
        data = [load(p.with_suffix('.json')) for p in paths]
        assert all(d['sourceCommit'] == LOCKED and d['frame'] == frame for d in data)
        assert data[0]['sourceDigest'] == data[1]['sourceDigest']
        differences = {k: [data[0]['settings'].get(k), data[1]['settings'].get(k)]
                       for k in set(data[0]['settings']) | set(data[1]['settings'])
                       if data[0]['settings'].get(k) != data[1]['settings'].get(k)}
        assert set(differences) == {'samples'}, f'comparison changed settings beyond sample count: {differences}'
        arrays = [np.asarray(im).astype(np.float32) for im in ims]
        delta = arrays[0] - arrays[1]
        full = Image.new('RGB', (2160, 2000), '#0b0e10')
        full.paste(ims[0], (0, 80)); full.paste(ims[1], (1080, 80))
        draw = ImageDraw.Draw(full)
        draw.text((20, 24), f'PICTURE {frame:04d} · 32 SAMPLES · native1080×1920', font=font, fill='#efd7b0')
        draw.text((1100, 24), f'PICTURE {frame:04d} · 64 SAMPLES · native1080×1920', font=font, fill='#efd7b0')
        full.save(out / f'frame-{frame:04d}-full.jpg', quality=95, subsampling=0)
        phone = Image.new('RGB', (580, 550), '#0b0e10')
        for i, im in enumerate(ims):
            phone.paste(im.resize((270, 480), Image.Resampling.LANCZOS), (10 + 290 * i, 60))
        draw = ImageDraw.Draw(phone)
        draw.text((12, 12), '32 samples', font=font, fill='#efd7b0')
        draw.text((302, 12), '64 samples', font=font, fill='#efd7b0')
        phone.save(out / f'frame-{frame:04d}-phone.jpg', quality=95, subsampling=0)
        sidecars = []
        for count, path in zip((32, 64), paths):
            target = out / f'samples-{count}' / f'{frame:04d}.json'
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path.with_suffix('.json'), target)
            sidecars.append({'samples': count, 'repositoryPath': str(target.relative_to(ROOT)),
                             'sha256': digest(target)})
        rows.append({'frame': frame, 'seconds': frame / 60, 'backend': data[0]['backend'],
                     'sourceDigest': data[0]['sourceDigest'], 'settingsDifferences': differences,
                     'meanAbsoluteRgb8Difference': float(np.abs(delta).mean()),
                     'rootMeanSquareRgb8Difference': float(np.sqrt(np.mean(delta**2))),
                     'maxAbsoluteRgb8Difference': int(np.max(np.abs(delta))),
                     'nativeResolution': [1080, 1920],
                     'rawRenderSidecars': sidecars,
                     'fullReview': {'repositoryPath': str((out / f'frame-{frame:04d}-full.jpg').relative_to(ROOT)),
                                    'sha256': digest(out / f'frame-{frame:04d}-full.jpg')},
                     'phoneReview': {'repositoryPath': str((out / f'frame-{frame:04d}-phone.jpg').relative_to(ROOT)),
                                     'sha256': digest(out / f'frame-{frame:04d}-phone.jpg')},
                     'samples': [{'samples': d['samples'], 'renderSeconds': d['renderSeconds'],
                                  'pngBytes': p.stat().st_size, 'fileSha256': digest(p),
                                  'pixelSha256': d['pixelSha256'], 'settingsDigest': d['settingsDigest']}
                                 for d, p in zip(data, paths)]})
    assert rows, 'no completed paired pilot comparison to publish'
    save(out / 'review.json', {'kind': 'morph09-full-resolution-sampling-review', 'job': job,
                              'sourceCommit': LOCKED, 'runtime': load(WORK / 'runtime.json'),
                              'sceneBuild': load(WORK / 'scene-build.json'), 'pictures': rows,
                              'rawFramesCommitted': False, 'sampleSelectionMade': False})
    for name in ('prepare', 'source-preflight', 'pilot32', 'pilot64'):
        path = WORK / 'logs' / (name + '.log')
        if path.exists():
            # Logs remain outside Git; only a concise status/hash is recorded.
            save(out / (name + '-log.json'), {'logSha256': digest(path), 'bytes': path.stat().st_size})
    relative = out.relative_to(ROOT)
    files = list(out.rglob('*'))
    total = sum(p.stat().st_size for p in files if p.is_file())
    assert total <= 20_000_000, 'pilot review exceeds its20MB per-job Git budget'
    assert all(p.suffix in ('.jpg', '.json') for p in files if p.is_file()), 'raw or unsupported pilot Git content'
    subprocess.run(['git', 'config', 'user.name', 'github-actions[bot]'], cwd=ROOT, check=True)
    subprocess.run(['git', 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], cwd=ROOT, check=True)
    subprocess.run(['git', 'add', '--', str(relative)], cwd=ROOT, check=True)
    staged = subprocess.check_output(['git', 'diff', '--cached', '--name-only'], cwd=ROOT, text=True).splitlines()
    assert staged and all(p.startswith(str(relative) + '/') and Path(p).suffix in ('.jpg', '.json') for p in staged)
    subprocess.run(['git', 'commit', '-m', f'production(morph09): sampling review {job["id"]} [skip ci]'], cwd=ROOT, check=True)
    # Unique job paths make concurrent review commits independent. Never force-push.
    for attempt_no in range(12):
        subprocess.run(['git', 'fetch', 'origin', BRANCH], cwd=ROOT, check=True)
        subprocess.run(['git', 'rebase', 'origin/' + BRANCH], cwd=ROOT, check=True)
        pushed = subprocess.run(['git', 'push', 'origin', 'HEAD:refs/heads/' + BRANCH], cwd=ROOT)
        if pushed.returncode == 0:
            print(f'Published {relative}: {total} bytes of derived JPEG/JSON review, zero raw PNGs', flush=True)
            return
    raise RuntimeError('review push lost repeated fast-forward races; raw pilot remains in job log/runtime')


def bundle(c, job):
    assert job['mode'] == 'production' and c.get('actionsArtifactsAuthorized', False)
    out = WORK / 'action-artifact'
    out.mkdir(parents=True, exist_ok=True)
    for folder in ('frames', 'rerenders', 'quiet-v3'):
        source = WORK / folder
        if not source.exists():
            continue
        for sidecar in sorted(source.glob('[0-9][0-9][0-9][0-9].json')):
            png = sidecar.with_suffix('.png')
            if not png.is_file():
                continue # Keep completed pairs; an interrupted partial is not an output picture.
            for path in (png, sidecar):
                target = out / folder / path.name
                target.parent.mkdir(parents=True, exist_ok=True)
                if not target.exists():
                    os.link(path, target)
    for source, target in ((WORK / 'logs', out / 'logs'), (WORK / 'preflight', out / 'preflight')):
        if source.exists():
            shutil.copytree(source, target, dirs_exist_ok=True)
    metadata = out / 'metadata'
    metadata.mkdir(exist_ok=True)
    for source in (WORK / 'scene-build.json', WORK / 'runtime.json', WORK / 'render-manifest.json',
                   HERE / 'source-hashes.json', HERE / 'config.json'):
        if source.exists():
            shutil.copy2(source, metadata / source.name)
    for old in ('artifact-inventory.json', 'SHA256SUMS'):
        (out / old).unlink(missing_ok=True)
    files = {str(p.relative_to(out)): p for p in sorted(out.rglob('*')) if p.is_file()}
    common_names = {'metadata/scene-build.json', 'metadata/runtime.json',
                    'metadata/source-hashes.json', 'metadata/config.json'}
    assert common_names <= set(files), 'missing standalone part provenance'
    common = [files[n] for n in sorted(common_names)]
    common_bytes = sum(p.stat().st_size for p in common)
    groups, used = [], set(common_names)
    # PNGs and their sidecars stay together, so each downloaded part is independently valid.
    for folder in ('frames', 'rerenders', 'quiet-v3'):
        for sidecar in sorted((out / folder).glob('[0-9][0-9][0-9][0-9].json')):
            png = sidecar.with_suffix('.png')
            assert png.is_file()
            groups.append([png, sidecar])
            used.update(str(p.relative_to(out)) for p in (png, sidecar))
    groups += [[files[n]] for n in sorted(set(files) - used)]
    limit, reserve = 30 * 1024**2, 128 * 1024
    parts, current, current_bytes = [], [], common_bytes
    for group in groups:
        size = sum(p.stat().st_size for p in group)
        assert common_bytes + size <= limit - reserve, 'one complete frame/log exceeds the downloadable part limit'
        if current and current_bytes + size > limit - reserve:
            parts.append(current)
            current, current_bytes = [], common_bytes
        current.extend(group)
        current_bytes += size
    if current:
        parts.append(current)
    assert 1 <= len(parts) <= 10, 'batch requires more than ten30MiB upload parts'
    destination = WORK / 'action-parts'
    if destination.exists():
        shutil.rmtree(destination)
    total = 0
    for index, group in enumerate(parts):
        part = destination / f'part{index:02d}'
        for source in common + group:
            target = part / source.relative_to(out)
            target.parent.mkdir(parents=True, exist_ok=True)
            os.link(source, target)
        payload = [p for p in sorted(part.rglob('*')) if p.is_file()]
        payload_bytes = sum(p.stat().st_size for p in payload)
        save(part / 'artifact-inventory.json', {'job': job, 'partIndex': index, 'partCount': len(parts),
             'downloadLimitBytes': limit, 'totalBytesBeforeInventory': payload_bytes,
             'artifactBudgetBytes': job['artifactBudgetBytes'],
             'files': {str(p.relative_to(part)): {'sha256': digest(p), 'bytes': p.stat().st_size} for p in payload}})
        inventory = [p for p in sorted(part.rglob('*')) if p.is_file()]
        (part / 'SHA256SUMS').write_text(''.join(f'{digest(p)}  {p.relative_to(part)}\n' for p in inventory))
        part_bytes = sum(p.stat().st_size for p in part.rglob('*') if p.is_file())
        assert part_bytes <= limit - 64 * 1024, 'part leaves insufficient ZIP metadata headroom'
        total += part_bytes
    budgeted = total + len(parts) * 64 * 1024 # Reserve ZIP headers in the storage budget too.
    assert budgeted <= job['artifactBudgetBytes'], f'{budgeted}budgeted bytes exceeds authorized total per-job artifact budget; nothing should upload'
    if os.environ.get('GITHUB_OUTPUT'):
        with Path(os.environ['GITHUB_OUTPUT']).open('a') as output:
            output.write(f'partCount={len(parts)}\n')
    print(f'{len(parts)} downloadable parts ready: {total}bytes under authorized job cap {job["artifactBudgetBytes"]}', flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('phase', choices=['plan', 'run', 'pilot-review', 'bundle'])
    a = ap.parse_args()
    c = config()
    if a.phase == 'plan':
        matrix = plan(c)
        value = json.dumps(matrix, separators=(',', ':'))
        print(value)
        if os.environ.get('GITHUB_OUTPUT'):
            with Path(os.environ['GITHUB_OUTPUT']).open('a') as output:
                output.write('matrix=' + value + '\nmode=' + c.get('actionMode', 'pilot') + '\n')
        return
    job = selected_job(c)
    {'run': run_job, 'pilot-review': pilot_reviews, 'bundle': bundle}[a.phase](c, job)


if __name__ == '__main__':
    main()
