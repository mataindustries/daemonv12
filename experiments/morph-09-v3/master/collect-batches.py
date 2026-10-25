#!/usr/bin/env python3
"""Verify locally downloaded production artifact ZIPs and merge recoverable batches.

No downloads or remote operations. Existing destination bytes are never replaced
unless identical. Raw PNGs and batch records remain under the ignored work tree.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
WORK = ROOT / 'work/morph-09-v3-master'
LOCKED = '9e8a03d2b5bfed15f8056970ca3b4cdb1c2cfbc7'
KINDS = ('frames', 'rerenders', 'quiet-v3')
REQUIRED_RENDER_CHECKS = {0, 389, 396, 418, 479}
REQUIRED_QUIET = {0, 372, 390, 405, 472, 479}
MAX_ARCHIVE_BYTES = 512 * 1024**2
MAX_MEMBER_BYTES = 32 * 1024**2


def require(test, message):
    if not test:
        raise ValueError(message)


def load(path):
    return json.loads(Path(path).read_text())


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def canonical_digest(data):
    return hashlib.sha256(json.dumps(data, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def atomic_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name('.part-' + path.name)
    temporary.write_text(json.dumps(data, sort_keys=True, indent=2) + '\n')
    os.replace(temporary, path)


def allowed_file(name):
    if name in ('SHA256SUMS', 'artifact-inventory.json'):
        return True
    if re.fullmatch(r'(frames|rerenders|quiet-v3)/[0-9]{4}\.(png|json)', name):
        return True
    if re.fullmatch(r'logs/[a-z0-9-]+\.log', name):
        return True
    return name in {
        'metadata/scene-build.json', 'metadata/runtime.json',
        'metadata/render-manifest.json', 'metadata/source-hashes.json', 'metadata/config.json',
        'preflight/preflight-verification.json', 'preflight/preflight-verification.md',
        'preflight/master-sync-audit.csv',
    }


def unpack_verified(archive, staging):
    """Allowlist and verify every member before any destination batch is touched."""
    with zipfile.ZipFile(archive) as z:
        entries = z.infolist()
        names = [i.filename for i in entries]
        require(len(names) == len(set(names)), f'{archive.name}: duplicate ZIP member')
        require(sum(i.file_size for i in entries) <= MAX_ARCHIVE_BYTES,
                f'{archive.name}: unpacked batch exceeds512MiB')
        for info in entries:
            name = info.filename
            path = PurePosixPath(name)
            require(name and '\\' not in name and ':' not in name and not path.is_absolute()
                    and '..' not in path.parts and str(path) == name.rstrip('/'),
                    f'{archive.name}: unsafe ZIP path {name!r}')
            mode = info.external_attr >> 16
            require(stat.S_IFMT(mode) in (0, stat.S_IFREG, stat.S_IFDIR),
                    f'{archive.name}: symlink or special member {name}')
            if info.is_dir():
                require(path.parts[0] in (*KINDS, 'metadata', 'logs', 'preflight')
                        and len(path.parts) == 1, f'{archive.name}: unknown directory {name}')
                continue
            require(allowed_file(name), f'{archive.name}: unknown artifact file {name}')
            require(info.file_size <= MAX_MEMBER_BYTES, f'{archive.name}: oversized member {name}')
            target = staging.joinpath(*path.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            with z.open(info) as source, target.open('xb') as destination:
                shutil.copyfileobj(source, destination, length=1024 * 1024)
    files = {str(p.relative_to(staging)): p for p in staging.rglob('*') if p.is_file()}
    require('SHA256SUMS' in files and 'artifact-inventory.json' in files,
            f'{archive.name}: missing artifact checksums/inventory')
    checksums = {}
    for line in files['SHA256SUMS'].read_text().splitlines():
        match = re.fullmatch(r'([0-9a-f]{64})  (.+)', line)
        require(match is not None, f'{archive.name}: malformed SHA256SUMS line')
        sha, name = match.groups()
        require(name not in checksums and name in files and name != 'SHA256SUMS',
                f'{archive.name}: duplicated/unknown checksum path {name}')
        checksums[name] = sha
    require(set(checksums) == set(files) - {'SHA256SUMS'},
            f'{archive.name}: SHA256SUMS does not cover every artifact file')
    for name, expected in checksums.items():
        require(digest(files[name]) == expected, f'{archive.name}: checksum mismatch {name}')
    inventory = load(files['artifact-inventory.json'])
    listed = inventory.get('files', {})
    expected_files = set(files) - {'artifact-inventory.json', 'SHA256SUMS'}
    require(set(listed) == expected_files, f'{archive.name}: artifact inventory coverage differs')
    for name, record in listed.items():
        require(record.get('sha256') == checksums[name] and record.get('bytes') == files[name].stat().st_size,
                f'{archive.name}: artifact inventory mismatch {name}')
    require(inventory.get('totalBytesBeforeInventory') == sum(files[n].stat().st_size for n in expected_files),
            f'{archive.name}: artifact inventory byte total differs')
    budget = inventory.get('artifactBudgetBytes', 0)
    require(isinstance(budget, int) and sum(p.stat().st_size for p in files.values()) <= budget,
            f'{archive.name}: artifact exceeds its recorded authorized budget')
    if 'partIndex' in inventory or 'partCount' in inventory:
        require(type(inventory.get('partIndex')) is int and type(inventory.get('partCount')) is int
                and 1 <= inventory['partCount'] <= 10 and 0 <= inventory['partIndex'] < inventory['partCount'],
                f'{archive.name}: invalid multipart identity')
        require(inventory.get('downloadLimitBytes') == 30 * 1024**2
                and sum(p.stat().st_size for p in files.values()) < 30 * 1024**2,
                f'{archive.name}: part exceeds its30MiB download limit')
    return files, inventory


def record(directory, frame, kind, source_digest):
    png, sidecar = directory / f'{frame:04d}.png', directory / f'{frame:04d}.json'
    require(png.is_file() and sidecar.is_file(), f'{kind}: missing PNG/JSON pair at {frame}')
    row = load(sidecar)
    require(type(row.get('frame')) is int and row['frame'] == frame and 0 <= frame < 480,
            f'{sidecar}: invalid picture index')
    expected_backend = 'v3' if kind == 'quiet-v3' or 373 <= frame <= 389 or 406 <= frame <= 471 else 'v2'
    require(row.get('backend') == expected_backend, f'{sidecar}: incorrect scene routing')
    require(row.get('sourceCommit') == LOCKED and row.get('sourceDigest') == source_digest,
            f'{sidecar}: inconsistent locked-source provenance')
    require((row.get('width'), row.get('height')) == (1080, 1920), f'{sidecar}: wrong recorded resolution')
    require(row.get('fileSha256') == digest(png), f'{png}: frame checksum mismatch')
    with Image.open(png) as image:
        image.load()
        require(image.format == 'PNG' and image.mode == 'RGB' and image.size == (1080, 1920),
                f'{png}: expected native1080x1920 RGB PNG')
        require(row.get('pixelSha256') == hashlib.sha256(image.tobytes()).hexdigest(),
                f'{png}: decoded pixel checksum mismatch')
    settings = row.get('settings', {})
    require(row.get('settingsDigest') == canonical_digest(settings), f'{sidecar}: settings digest mismatch')
    require((settings.get('width'), settings.get('height'), settings.get('resolutionPercentage')) == (1080, 1920, 100)
            and settings.get('engine') == 'CYCLES' and settings.get('device') == 'CPU',
            f'{sidecar}: invalid production dimensions/engine')
    require(type(row.get('samples')) is int and row['samples'] > 0
            and row['samples'] == settings.get('samples'), f'{sidecar}: invalid samples')
    require(row.get('blenderVersion') == settings.get('blenderVersion') == '4.3.0', f'{sidecar}: wrong Blender version')
    require(row.get('fullTimelineBake') == settings.get('fullTimelineBake') == [0, 479]
            and isinstance(row.get('batchId'), str) and row['batchId'], f'{sidecar}: missing timeline/batch provenance')
    require(settings.get('rendererSha256') == digest(HERE / 'render.py'), f'{sidecar}: changed renderer')
    return row


def scan_frames(base, kind, source_digest):
    directory = base / kind
    if not directory.exists():
        return {}
    files = [p for p in directory.iterdir() if p.is_file()]
    require(all(re.fullmatch(r'[0-9]{4}\.(png|json)', p.name) for p in files),
            f'{directory}: unknown or unfinished frame file')
    pictures = {int(p.stem) for p in files}
    return {f: record(directory, f, kind, source_digest) for f in sorted(pictures)}


def consistent(rows):
    fingerprints = {(r['sourceCommit'], r['sourceDigest'], r['settingsDigest'], r['samples'], r['blenderVersion']) for r in rows}
    require(len(fingerprints) <= 1, 'Collected raw/control frames mix source, render settings, samples or Blender versions')


def collect_archive(archive, work, rows, source, source_digest):
    staging_parent = work / 'collection-staging'
    staging_parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='batch-', dir=staging_parent) as temporary:
        staging = Path(temporary)
        files, inventory = unpack_verified(archive, staging)
        job = inventory.get('job', {})
        require(job.get('mode') == 'production' and re.fullmatch(r'b[0-9]{2}', job.get('id', '')),
                f'{archive.name}: not a production batch')
        index = int(job['id'][1:])
        first, last = index * 30, index * 30 + 29
        require(0 <= index < 16 and job.get('first') == first and job.get('last') == last
                and job.get('frames') == list(range(first, last + 1)), f'{archive.name}: wrong batch range')
        expected_controls = ({first} if first else set()) | ({last} if last < 479 else set())
        expected_controls |= {f for f in REQUIRED_RENDER_CHECKS if first <= f <= last}
        require(job.get('rerenders') == sorted(expected_controls)
                and job.get('quiet') == sorted(f for f in REQUIRED_QUIET if first <= f <= last),
                f'{archive.name}: incorrect assigned deterministic/quiet controls')
        require(job.get('artifactBudgetBytes') == inventory.get('artifactBudgetBytes'),
                f'{archive.name}: job and part artifact budgets differ')
        needed = {'metadata/runtime.json', 'metadata/source-hashes.json', 'metadata/config.json', 'metadata/scene-build.json'}
        require(needed <= set(files), f'{archive.name}: missing source/runtime/scene metadata')
        runtime = load(files['metadata/runtime.json'])
        require(runtime.get('job') == job, f'{archive.name}: runtime and artifact job differ')
        require(load(files['metadata/source-hashes.json']) == source, f'{archive.name}: locked source manifest differs')
        scene = load(files['metadata/scene-build.json'])
        require(scene.get('sourceCommit') == LOCKED and scene.get('sourceDigest') == source_digest
                and scene.get('blenderVersion') == '4.3.0', f'{archive.name}: scene provenance differs')
        run_id, attempt = str(runtime.get('actionsRunId', '')), str(runtime.get('actionsRunAttempt', ''))
        require(run_id.isdigit() and attempt.isdigit(), f'{archive.name}: invalid Actions run identity')
        artifact_base = f'morph09-{run_id}-{attempt}-{job["id"]}'
        part_index, part_count = inventory.get('partIndex', 0), inventory.get('partCount', 1)
        artifact = artifact_base + (f'-part{part_index:02d}' if 'partIndex' in inventory else '')
        batch_dir = work / 'batches' / artifact
        incoming = {kind: scan_frames(staging, kind, source_digest) for kind in KINDS}
        for kind in KINDS:
            expected = set(job['frames'] if kind == 'frames' else job.get('rerenders' if kind == 'rerenders' else 'quiet', []))
            require(set(incoming[kind]) <= expected, f'{archive.name}: {kind} picture outside assigned batch/control set')
        consistent([r for group in rows.values() for r in group.values()] +
                   [r for group in incoming.values() for r in group.values()])
        receipt = {'artifact': artifact, 'artifactBase': artifact_base,
                   'partIndex': part_index, 'partCount': part_count,
                   'archiveFile': archive.name, 'archiveSha256': digest(archive), 'archiveBytes': archive.stat().st_size,
                   'sourceDigest': source_digest, 'job': job,
                   'pictures': {kind: sorted(incoming[kind]) for kind in KINDS}}
        receipt_path = batch_dir / 'collection.json'
        if receipt_path.exists():
            previous = load(receipt_path)
            require(previous['archiveSha256'] == receipt['archiveSha256'] and previous['pictures'] == receipt['pictures'],
                    f'{archive.name}: different ZIP claims an existing artifact identity')
        else:
            for previous_path in (work / 'batches').glob('*/collection.json'):
                previous = load(previous_path)
                for kind in KINDS:
                    require(not (set(previous['pictures'][kind]) & set(incoming[kind])),
                            f'{archive.name}: duplicate {kind} picture claimed by a different artifact')
        # Build all destination decisions before writing. Conflicts preserve both histories.
        copies = []
        for name, path in files.items():
            target = work / name if name.split('/')[0] in KINDS else batch_dir / name
            if target.exists():
                require(target.is_file() and digest(target) == digest(path),
                        f'{archive.name}: destination differs; refusing overwrite: {target}')
            else:
                copies.append((path, target))
        for path, target in copies:
            target.parent.mkdir(parents=True, exist_ok=True)
            # Same filesystem as staging; an exclusive hard link cannot overwrite a racing writer.
            require(not target.exists(), f'Concurrent destination writer detected: {target}')
            os.link(path, target)
        for kind in KINDS:
            rows[kind].update(incoming[kind])
        if not receipt_path.exists():
            atomic_json(receipt_path, receipt)
        return {'artifact': artifact, 'filesAdded': len(copies), 'pictures': receipt['pictures']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archives', type=Path, required=True, help='directory containing downloaded artifact ZIPs')
    parser.add_argument('--work', type=Path, default=WORK, help='ignored production work directory')
    parser.add_argument('--require-complete', action='store_true')
    args = parser.parse_args()
    archives = sorted(args.archives.glob('*.zip'))
    require(archives, f'No artifact ZIPs found in {args.archives}')
    args.work.mkdir(parents=True, exist_ok=True)
    source = load(HERE / 'source-hashes.json')
    require(source.get('sourceCommit') == LOCKED, 'collector source manifest is not pinned to the creative lock')
    source_digest = canonical_digest(source)
    rows = {kind: scan_frames(args.work, kind, source_digest) for kind in KINDS}
    consistent([r for group in rows.values() for r in group.values()])
    imported = [collect_archive(path, args.work, rows, source, source_digest) for path in archives]
    raw = [rows['frames'][f] for f in sorted(rows['frames'])]
    required_controls = set(REQUIRED_RENDER_CHECKS)
    for frame in range(479):
        if frame in rows['frames'] and frame + 1 in rows['frames']:
            if rows['frames'][frame]['batchId'] != rows['frames'][frame + 1]['batchId']:
                required_controls.update((frame, frame + 1))
    missing = {'frames': sorted(set(range(480)) - set(rows['frames'])),
               'rerenders': sorted(required_controls - set(rows['rerenders'])),
               'quiet-v3': sorted(REQUIRED_QUIET - set(rows['quiet-v3']))}
    parts = {}
    for receipt_path in (args.work / 'batches').glob('*/collection.json'):
        receipt = load(receipt_path)
        base = receipt.get('artifactBase', receipt['artifact'])
        found = parts.setdefault(base, {'count': receipt.get('partCount', 1), 'indices': set(), 'zipBytes': 0,
                                       'budget': receipt['job'].get('artifactBudgetBytes', 0)})
        require(found['count'] == receipt.get('partCount', 1), f'{base}: inconsistent declared part counts')
        found['indices'].add(receipt.get('partIndex', 0))
        found['zipBytes'] += receipt.get('archiveBytes', 0)
        require(found['zipBytes'] <= found['budget'], f'{base}: collected ZIP parts exceed their authorized batch budget')
    missing_parts = {name: sorted(set(range(info['count'])) - info['indices'])
                     for name, info in parts.items() if len(info['indices']) != info['count']}
    complete = not any(missing.values()) and not missing_parts
    first = raw[0] if raw else {}
    manifest = {'schemaVersion': 1, 'sourceCommit': LOCKED, 'sourceDigest': source_digest,
                'settingsDigest': first.get('settingsDigest'), 'settings': first.get('settings', {}), 'frames': raw}
    atomic_json(args.work / 'render-manifest.json', manifest)
    report = {'status': 'complete-collected-inputs' if complete else 'partial-collected-inputs',
              'verifiedMaster': False, 'sourceCommit': LOCKED, 'sourceDigest': source_digest,
              'counts': {kind: len(rows[kind]) for kind in KINDS}, 'missing': missing, 'missingParts': missing_parts,
              'archives': imported, 'manifest': str(args.work / 'render-manifest.json')}
    atomic_json(args.work / 'collection-report.json', report)
    print(json.dumps({k: v for k, v in report.items() if k != 'archives'}, indent=2))
    if args.require_complete:
        require(complete, 'Collection is incomplete; completed pictures were retained for a later resumed collection.')


if __name__ == '__main__':
    main()
