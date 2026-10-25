#!/usr/bin/env python3
"""Production orchestration only. The approved creative checkout is never edited.

Checkpoints are immutable assets of a DRAFT release; this script never publishes it.
No Actions artifacts, caches, larger runners, or external compute are used.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import signal
import subprocess
import sys
import tarfile
import time
import urllib.parse
import urllib.request

SOURCE = "9e8a03d2b5bfed15f8056970ca3b4cdb1c2cfbc7"
REPO = "mataindustries/daemonv12"
TAG = "morph09-master-checkpoints-9e8a03d-32s-407b1f4a-v1"
BRANCH = "prod/morph-09-v3-1080p-master"
ROOT = Path(__file__).resolve().parents[2]
EXP = ROOT / "experiments/morph-09-v3/master"
WORK = ROOT / "work/morph-09-v3-master"
STORE = WORK / "checkpoints"
MASTER = EXP / "delivery"
CONFIG = json.loads((EXP / "config.json").read_text())
FROZEN = list(json.loads((EXP / "source-hashes.json").read_text())["hashes"])
SETTINGS = {k: CONFIG[k] for k in ("sourceCommit", "width", "height", "fps", "frameCount", "samples", "device", "blenderVersion", "threads")}
SETTINGS["rendererSha256"] = hashlib.sha256((EXP / "render.py").read_bytes()).hexdigest()
BASE = ["work/morph-09-v2/resonator.blend", "work/morph-09-v2/resonator.json",
        "work/morph-09-v3/resonator-v3.blend", "work/morph-09-v3/resonator.json", "work/morph-09-v3-master/scene-build.json"]
QUIET = {0,372,390,405,472,479}
RECHECK = {0,389,396,418,479}
RECOVERY_STARTS = {385,415}
sys.path.insert(0,str(EXP))
from recheck import compare as compare_recheck

def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def sha(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def write_json(path, value):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def run(args, *, cwd=ROOT, log=None, timeout=3600):
    print("RUN", " ".join(map(str, args)), flush=True)
    if log:
        Path(log).parent.mkdir(parents=True, exist_ok=True)
        try:
            with Path(log).open("ab") as stream:
                subprocess.run(list(map(str, args)), cwd=cwd, stdout=stream,
                               stderr=subprocess.STDOUT, check=True, timeout=timeout)
        except BaseException:
            # Blender's useful exception is otherwise hidden in a runner-local log.
            print(f"FAILED SUBPROCESS LOG TAIL: {log}", flush=True)
            print(Path(log).read_text(errors="replace")[-16000:], flush=True)
            raise
    else:
        subprocess.run(list(map(str, args)), cwd=cwd, check=True, timeout=timeout)


def capture(args, *, cwd=ROOT):
    return subprocess.check_output(list(map(str, args)), cwd=cwd)


def api(endpoint, *args):
    return json.loads(capture(["gh", "api", endpoint, *args]))


def release(optional=False):
    # /releases/tags/{tag} only resolves published releases. Authenticated list
    # includes drafts, whose temporary HTML URL can still use an untagged name.
    matches = []
    for page in range(1, 20):
        entries = api(f"repos/{REPO}/releases?per_page=100&page={page}")
        matches.extend(entry for entry in entries if entry["tag_name"] == TAG)
        if len(entries) < 100:
            break
    else:
        raise RuntimeError("Unexpectedly many releases while looking up draft checkpoints")
    require(len(matches) <= 1, "Duplicate checkpoint drafts require investigation")
    if not matches:
        if optional:
            return None
        raise RuntimeError("Missing draft checkpoint release")
    result = matches[0]
    require(result["draft"] is True, "Checkpoint release must remain DRAFT")
    require(result["tag_name"] == TAG and result["target_commitish"] == SOURCE,
            "Checkpoint release target differs from the approved source")
    return result


def assets():
    rel = release()
    # Paginate: chunk, recovery, batch and final assets can exceed the default page.
    out = {}
    for page in range(1, 20):
        entries = api(f"repos/{REPO}/releases/{rel['id']}/assets?per_page=100&page={page}")
        for entry in entries:
            require(entry["name"] not in out, "Duplicate release asset name")
            out[entry["name"]] = entry
        if len(entries) < 100:
            return out
    raise RuntimeError("Unexpectedly many release assets")


def download(entry, dest):
    release()  # Never rely on a cached draft-state observation.
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(dest.suffix + ".part")
    with part.open("wb") as stream:
        subprocess.run(["gh", "api", f"repos/{REPO}/releases/assets/{entry['id']}",
                        "-H", "Accept: application/octet-stream"], stdout=stream, check=True)
    require(part.stat().st_size == entry["size"], "Truncated checkpoint download")
    digest = entry.get("digest")
    if digest:
        require(digest == "sha256:" + sha(part), "Release asset digest mismatch")
    part.replace(dest)


def upload(path, known=None):
    path = Path(path)
    require(path.stat().st_size < 2 * 1024**3, "Release asset exceeds 2 GiB")
    current = known if known is not None else assets()
    require(path.name not in current, f"Refusing to overwrite durable checkpoint {path.name}")
    rel = release()
    # Address the release by ID, never by a draft's unpublished tag. Stream the
    # file directly to GitHub's documented uploads host; credentials stay in memory.
    url = (f"https://uploads.github.com/repos/{REPO}/releases/{rel['id']}/assets?name=" +
           urllib.parse.quote(path.name, safe=""))
    headers = {"Authorization": "Bearer " + os.environ["GH_TOKEN"],
               "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
               "Content-Type": "application/octet-stream", "Content-Length": str(path.stat().st_size),
               "User-Agent": "morph09-production"}
    with path.open("rb") as stream:
        request = urllib.request.Request(url, data=stream, headers=headers, method="POST")
        with urllib.request.urlopen(request, timeout=1800) as response:
            result = json.load(response)
    require(result["name"] == path.name and result["size"] == path.stat().st_size and
            result["state"] == "uploaded", "Checkpoint upload did not finish")
    if result.get("digest"):
        require(result["digest"] == "sha256:" + sha(path), "Uploaded checkpoint digest differs")
    print(f"UPLOADED {path.name} ({path.stat().st_size} bytes)", flush=True)
    release()


def source_hashes():
    return {p: sha(ROOT / p) for p in FROZEN}


def check_source():
    require(CONFIG['samplingStatus'] == 'selected' and SETTINGS['samples'] == 32, 'Sampling must be selected32')
    require((SETTINGS['width'],SETTINGS['height'],SETTINGS['fps'],SETTINGS['frameCount']) == (1080,1920,60,480), 'Wrong master target')
    require(capture(['git','rev-parse','HEAD']).decode().strip() == os.environ.get('GITHUB_SHA', capture(['git','rev-parse','HEAD']).decode().strip()), 'Pipeline checkout changed')
    for p in FROZEN:
        expected = capture(['git','show',f'{SOURCE}:{p}'])
        require(hashlib.sha256(expected).hexdigest() == sha(ROOT/p), f'Frozen source differs: {p}')
    STORE.mkdir(parents=True,exist_ok=True)
    return source_hashes()


def machine():
    return {"platform": platform.platform(), "python": platform.python_version(),
            "cpu": capture(["lscpu"]).decode(), "run_id": os.environ.get("GITHUB_RUN_ID"),
            "run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT"),
            "runner": os.environ.get("RUNNER_NAME"), "runner_arch": os.environ.get("RUNNER_ARCH")}


def image_record(path):
    from PIL import Image
    with Image.open(path) as im:
        require(im.size == (1080, 1920) and im.mode == "RGB", f"Wrong PNG format: {path}")
        rgb = hashlib.sha256(im.tobytes()).hexdigest()
    return {"sha256": sha(path), "rgb_sha256": rgb, "width": 1080, "height": 1920, "mode": "RGB"}


def pack(path, files, kind, extra=None):
    """Each archive authenticates its exact file bytes and frozen render provenance."""
    manifest = {"schema": 1, "kind": kind, "source_commit": SOURCE,
                "settings": SETTINGS, "source_sha256": source_hashes(),
                "files": {name: {"sha256": sha(file), "bytes": Path(file).stat().st_size}
                          for name, file in files.items()}, **(extra or {})}
    manifest_path = STORE / (Path(path).name + ".manifest.json")
    write_json(manifest_path, manifest)
    with tarfile.open(path, "w:gz", compresslevel=1) as archive:
        archive.add(manifest_path, arcname="manifest.json")
        for name, file in files.items():
            archive.add(file, arcname=name)
    return manifest


def unpack(path, dest, kind, allowed):
    dest = Path(dest)
    with tarfile.open(path, "r:gz") as archive:
        members = archive.getmembers()
        require(all(m.isfile() for m in members), "Checkpoint archive contains non-files")
        names = [m.name for m in members]
        require(len(names) == len(set(names)) and "manifest.json" in names, "Invalid archive entries")
        manifest = json.load(archive.extractfile("manifest.json"))
        require(manifest["source_commit"] == SOURCE and manifest["settings"] == SETTINGS,
                "Checkpoint render settings/source differ")
        require(manifest["source_sha256"] == source_hashes(), "Checkpoint frozen-source hashes differ")
        require(manifest["kind"] == kind, "Unexpected checkpoint type")
        require(set(names) == set(manifest["files"]) | {"manifest.json"}, "Archive file manifest mismatch")
        require(set(manifest["files"]) <= set(allowed), "Unexpected archive path")
        for name, record in manifest["files"].items():
            target = dest / name
            require(target.resolve().is_relative_to(dest.resolve()), "Unsafe archive path")
            target.parent.mkdir(parents=True, exist_ok=True)
            tmp = target.with_name(target.name + ".restore-part")
            with archive.extractfile(name) as src, tmp.open("wb") as dst:
                shutil.copyfileobj(src, dst)
            require(tmp.stat().st_size == record["bytes"] and sha(tmp) == record["sha256"],
                    f"Checkpoint file checksum differs: {name}")
            if target.exists():
                require(sha(target) == record["sha256"], f"Conflicting completed frame/file: {name}")
                tmp.unlink()
            else:
                tmp.replace(target)
    return manifest


def prepare():
    env = dict(os.environ, BLENDER_PY=sys.executable, PYTHON=sys.executable)
    subprocess.run(['bash', str(EXP/'build.sh'),'--prepare'],cwd=ROOT,env=env,check=True)


def restore_base(known):
    path=STORE/'scene-base.tar.gz'
    download(known[path.name],path)
    unpack(path,ROOT,'scene-base',set(BASE))


def preflight():
    check_source()
    require(api(f'repos/{REPO}')['private'] is False, 'Standard public-repository runners required')
    rel=release(optional=True)
    if rel is None:
        api(f'repos/{REPO}/releases','--method','POST','-f',f'tag_name={TAG}','-f',f'target_commitish={SOURCE}',
            '-F','draft=true','-F','prerelease=false','-f','name=MORPH09 private render checkpoints — DO NOT PUBLISH',
            '-f','body=Private draft checkpoints only. Never publish. No Actions artifacts or caches.')
    known=assets()
    expected={f'frames-{f:04d}-{f+4:04d}.tar.gz' for f in range(0,480,5)}
    missing=expected-set(known)
    require(missing <= {'frames-0385-0389.tar.gz','frames-0415-0419.tar.gz'},f'Incompatible missing checkpoints:{missing}')
    require('scene-base.tar.gz' in known,'Recovery requires existing immutable scene checkpoint')
    if 'scene-base.tar.gz' in known:
        restore_base(known)
    else:
        prepare()
        path=STORE/'scene-base.tar.gz';pack(path,{p:ROOT/p for p in BASE},'scene-base');upload(path,known)
    run([sys.executable,EXP/'verify.py','--preflight','--delivery',WORK/'preflight'])
    print('PREFLIGHT_PASS: locked source;32samples;draft-only checkpoints',flush=True)


def frames_for(batch):
    require(0<=batch<16,'Invalid batch')
    return list(range(batch*30,batch*30+30))


def controls(batch):
    fs=frames_for(batch)
    return ({fs[0],fs[-1]}|RECHECK)&set(fs)


def paths_for(fs):
    names={f'frames/{f:04d}.{ext}' for f in fs for ext in ('png','json')}
    names|={f'rerenders/{f:04d}.{ext}' for f in fs for ext in ('png','json')}
    names|={f'quiet-v3/{f:04d}.{ext}' for f in fs for ext in ('png','json')}
    return names


def render(fs,folder,batch,backend=None):
    args=[sys.executable,EXP/'render.py','--frames',','.join(map(str,sorted(fs))),'--out',WORK/folder,'--resume',
          '--batch-id',f'{folder}-b{batch:02d}']
    if backend: args+=['--backend',backend]
    if fs: run(args,log=STORE/f'{folder}-b{batch:02d}.log',timeout=15000)


def validate_chunk(fs,batch):
    for f in fs:
        row=json.loads((WORK/f'frames/{f:04d}.json').read_text())
        require(row['fileSha256']==sha(WORK/f'frames/{f:04d}.png'),'Raw hash mismatch')
        require(image_record(WORK/f'frames/{f:04d}.png')['rgb_sha256']==row['pixelSha256'],'Raw pixel mismatch')
        for folder,required in [('rerenders',controls(batch)),('quiet-v3',QUIET)]:
            if f in required:
                repeat=json.loads((WORK/f'{folder}/{f:04d}.json').read_text())
                require(image_record(WORK/f'{folder}/{f:04d}.png')['rgb_sha256']==repeat['pixelSha256'], 'Independent sidecar pixel hash differs')
                result=compare_recheck(WORK/f'frames/{f:04d}.png',WORK/f'{folder}/{f:04d}.png',f)
                require(result['passed'] if folder=='rerenders' else result['pixelIdentical'],f'Independent pixels differ:{f}:{folder}:{result}')
                require(repeat['settingsDigest']==row['settingsDigest'],'Control settings mismatch')


def diagnose_recovery(chunk,batch,known):
    """Retain measurements and actual pairs even if strict recovery fails."""
    report={'sourceCommit':SOURCE,'settings':SETTINGS,'chunk':chunk,'isolated':[], 'context':[]}
    required=set(chunk)&controls(batch)
    for f in sorted(required):
        report['isolated'].append(compare_recheck(WORK/f'frames/{f:04d}.png',WORK/f'rerenders/{f:04d}.png',f))
    needs_context=any(not r['passed'] for r in report['isolated'])
    if needs_context:
        (WORK/'isolated-recheck').mkdir(exist_ok=True)
        for f in required:
            for ext in ('png','json'):
                shutil.copy2(WORK/f'rerenders/{f:04d}.{ext}',WORK/f'isolated-recheck/{f:04d}.{ext}')
        render(chunk,'context-replay',batch)
        for f in chunk:
            result=compare_recheck(WORK/f'frames/{f:04d}.png',WORK/f'context-replay/{f:04d}.png',f)
            report['context'].append(result)
        if all(r['passed'] for r in report['context']):
            for f in required:
                for ext in ('png','json'):
                    shutil.copy2(WORK/f'context-replay/{f:04d}.{ext}',WORK/f'rerenders/{f:04d}.{ext}')
            report['classification']='render-history-sensitive; independent matching-context replay passed'
        else:
            report['classification']='unresolved scene/render difference; finishing blocked'
    else:
        report['classification']='exact or bounded one-LSB numerical variation; no changed geometry accepted'
    report['accepted']=all(r['passed'] for r in (report['context'] if needs_context else report['isolated']))
    report_path=STORE/f'recheck-{chunk[0]:04d}-run{os.environ["GITHUB_RUN_ID"]}-attempt{os.environ.get("GITHUB_RUN_ATTEMPT","1")}.json'
    write_json(report_path,report);print('RECHECK_MEASUREMENTS',json.dumps(report,sort_keys=True),flush=True)
    files={'report.json':report_path}
    for folder in ('frames','rerenders','isolated-recheck','context-replay'):
        for f in chunk:
            for ext in ('png','json'):
                path=WORK/f'{folder}/{f:04d}.{ext}'
                if path.is_file():files[f'{folder}/{f:04d}.{ext}']=path
    archive=report_path.with_suffix('.tar.gz');pack(archive,files,'recheck-diagnostic');upload(archive,known)
    require(report['accepted'],'Recovery differences exceed scoped quantization/context rule; private diagnostic preserved')


def render_batch(batch):
    check_source(); known=assets(); restore_base(known)
    fs=frames_for(batch)
    for first in range(fs[0],fs[-1]+1,5):
        chunk=list(range(first,first+5));name=f'frames-{first:04d}-{first+4:04d}.tar.gz';path=STORE/name
        if name in known:
            download(known[name],path);unpack(path,WORK,'frame-chunk',paths_for(chunk));validate_chunk(chunk,batch)
            print('RESUMED',name,flush=True);continue
        require(first in RECOVERY_STARTS, f'Recovery refuses to render any other missing chunk:{first}')
        render(chunk,'frames',batch)
        render(set(chunk)&controls(batch),'rerenders',batch)
        render(set(chunk)&QUIET,'quiet-v3',batch,'v3')
        diagnose_recovery(chunk,batch,known)
        validate_chunk(chunk,batch)
        files={p:WORK/p for p in paths_for(chunk) if (WORK/p).is_file()}
        pack(path,files,'frame-chunk',{'frames':chunk,'batch':batch,'machine':machine()});upload(path,known)
        print('CHECKPOINTED',name,flush=True)
    print('BATCH_PASS',batch,flush=True)


def finish():
    check_source();known=assets();restore_base(known)
    for batch in range(16):
        for first in range(batch*30,batch*30+30,5):
            fs=list(range(first,first+5));name=f'frames-{first:04d}-{first+4:04d}.tar.gz';require(name in known,f'Missing checkpoint:{name}')
            path=STORE/name;download(known[name],path);manifest=unpack(path,WORK,'frame-chunk',paths_for(fs))
            require(manifest['frames']==fs and manifest['batch']==batch,'Checkpoint frame coverage differs')
            validate_chunk(fs,batch)
            path.unlink()
    import importlib.util
    spec=importlib.util.spec_from_file_location('master_renderer',EXP/'render.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    module.update_manifest(WORK/'frames')
    MASTER.mkdir(exist_ok=True)
    shutil.copy2(EXP/'quality-evidence.json',MASTER/'quality-evidence.json')
    for crf in (16,17,18,19,20):
        run([sys.executable,EXP/'finish.py','--name','morph-09-v3-master','--crf',str(crf)],timeout=3600)
        if max((MASTER/'morph-09-v3-master.mp4').stat().st_size,(MASTER/'morph-09-v3-master.mov').stat().st_size)<95_000_000:
            break
    run([sys.executable,EXP/'verify.py','--name','morph-09-v3-master','--manifest',WORK/'render-manifest.json'],timeout=3600)
    report=json.loads((MASTER/'production-verification.json').read_text());require(report['status']=='verified-local-master','Full master verification failed')
    diagnostics=[]
    for name,entry in known.items():
        if not name.startswith('recheck-') or not name.endswith('.tar.gz'):continue
        path=STORE/name;download(entry,path)
        with tarfile.open(path,'r:gz') as archive:
            manifest=json.load(archive.extractfile('manifest.json'))
            require(manifest['source_commit']==SOURCE and manifest['settings']==SETTINGS and manifest['source_sha256']==source_hashes(),'Diagnostic provenance differs')
            payload=archive.extractfile('report.json').read()
            require(hashlib.sha256(payload).hexdigest()==manifest['files']['report.json']['sha256'],'Diagnostic report checksum differs')
            diagnostics.append({'asset':name,'measurements':json.loads(payload)})
        path.unlink()
    report['recoveryDiagnostics']=diagnostics
    report['status']='PASS';report['checkpointStorage']={'type':'DRAFT GitHub Release','tag':TAG,'releasePublished':False,'actionsArtifactsOrCache':False}
    write_json(MASTER/'production-verification.json',report)
    # A durable private bundle is retained before Git delivery.
    files={p.name:p for p in MASTER.iterdir() if p.is_file() and '.part' not in p.name}
    (MASTER/'SHA256SUMS').write_text(''.join(f'{sha(p)}  {n}\n' for n,p in sorted(files.items()) if n!='SHA256SUMS'))
    bundle=STORE/f'verified-master-{sha(MASTER/"morph-09-v3-master.mp4")[:12]}.tar.gz'
    pack(bundle,{p.name:p for p in MASTER.iterdir() if p.is_file()},'verified-master');upload(bundle,known)
    for p in MASTER.iterdir():
        require(p.stat().st_size<100_000_000,f'GitHub file-size blocker:{p.name}; verified master preserved in private draft {bundle.name}')
    run(['git','config','user.name','github-actions[bot]']);run(['git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com'])
    rel=str(MASTER.relative_to(ROOT))
    run(['git','add','--',rel]);run(['git','commit','-m','production(morph09): deliver verified1080p master [skip ci]'])
    run(['git','fetch','origin',BRANCH]);run(['git','rebase',f'origin/{BRANCH}']);run(['git','push','origin',f'HEAD:refs/heads/{BRANCH}'],timeout=1800)
    commit=capture(['git','rev-parse','HEAD']).decode().strip()
    retrieval={}
    for p in sorted(MASTER.iterdir()):
        if not p.is_file():continue
        url=f'https://raw.githubusercontent.com/{REPO}/{commit}/{rel}/{p.name}'
        # Anonymous public download, independent of the authenticated checkpoint API.
        for attempt in range(6):
            try:
                with urllib.request.urlopen(url,timeout=180) as response:
                    h=hashlib.sha256()
                    for data in iter(lambda:response.read(1024*1024),b''):h.update(data)
                require(h.hexdigest()==sha(p),f'Public checksum mismatch:{p.name}');break
            except Exception:
                if attempt==5:raise
                time.sleep(5)
        retrieval[p.name]={'url':url,'sha256':sha(p),'publicDownloadVerified':True}
    write_json(MASTER/'retrieval-verification.json',{'deliveryCommit':commit,'files':retrieval})
    report['publicDownloadVerified']=True;write_json(MASTER/'production-verification.json',report)
    (MASTER/'SHA256SUMS').write_text(''.join(f'{sha(p)}  {p.name}\n' for p in sorted(MASTER.iterdir()) if p.is_file() and p.name!='SHA256SUMS'))
    run(['git','add','--',rel]);run(['git','commit','-m','production(morph09): verify anonymous master downloads [skip ci]']);run(['git','push','origin',f'HEAD:refs/heads/{BRANCH}'])
    print('DELIVERY_PASS',f'https://raw.githubusercontent.com/{REPO}/{capture(["git","rev-parse","HEAD"]).decode().strip()}/{rel}/morph-09-v3-master.mp4',sha(MASTER/'morph-09-v3-master.mp4'),flush=True)
    release() # Assert checkpoints are still unpublished drafts.


def main():
    parser=argparse.ArgumentParser();parser.add_argument('command',choices=['preflight','render','finish']);parser.add_argument('--batch',type=int);args=parser.parse_args()
    if args.command=='render':render_batch(args.batch)
    else:globals()[args.command]()

if __name__=='__main__':main()
