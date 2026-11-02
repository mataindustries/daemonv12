"""Gate C only. Fixed teaser plan and verified, append-only prerelease PNG cache."""
import argparse
import hashlib
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path

import gate_a as A
import gate_b_media as M
import gate_b_render as B

FIRST, LAST = 285, 485
FALLBACK = 16_000_000
RESERVE = 240_000_000


def plan():
    chunks, first = [], FIRST
    while first <= LAST:
        limit = 7 if first < 420 else 12
        last = min(first + limit - 1, LAST, 419 if first < 420 else LAST)
        chunks.append({"index": len(chunks), "first": first, "last": last, "count": last-first+1,
                       "predictedSeconds": (last-first+1)*(252 if first < 420 else 124.4)})
        first = last + 1
    return chunks


def recipe(pre):
    return hashlib.sha256((pre["renderFingerprint"] + ":native-cycles16-cache-v1").encode()).hexdigest()


def publication_allowed():
    if (os.getenv("CACHE_PUBLICATION_APPROVED") != "true"
            or os.getenv("GITHUB_EVENT_NAME") != "workflow_dispatch"):
        raise RuntimeError("Public cache publication is disabled pending owner repository-variable approval")


def launch_allowed():
    if os.getenv("TEASER_LAUNCH_APPROVED") != "true":
        raise RuntimeError("Teaser launch is disabled pending owner approval")
    publication_allowed()


def gh(*args, check=True):
    r = subprocess.run(["gh", *map(str,args)], capture_output=True, text=True, timeout=180)
    if check and r.returncode:
        raise RuntimeError("GitHub cache operation failed: " + r.stderr[-1200:])
    return r


class Cache:
    def __init__(self, key, work):
        self.key, self.work, self.assets = key, work, {}
        work.mkdir(parents=True, exist_ok=True)

    def tag(self, frame):
        return f"angeles2099-cache-v1-{self.key[:16]}-{frame//200*200:03d}"

    def listing(self, frame, refresh=False):
        tag = self.tag(frame)
        if refresh or tag not in self.assets:
            release = gh("api", f"repos/{os.environ['GITHUB_REPOSITORY']}/releases/tags/{tag}", check=False)
            if release.returncode:
                if "404" not in release.stderr:
                    raise RuntimeError("Cannot read cache release: " + release.stderr[-1000:])
                self.assets[tag] = []
            else:
                meta = json.loads(release.stdout)
                if not meta["prerelease"] or meta["draft"]:
                    raise RuntimeError("Cache tag is not a published prerelease")
                pages = gh("api", "--paginate", "--slurp",
                           f"repos/{os.environ['GITHUB_REPOSITORY']}/releases/{meta['id']}/assets?per_page=100")
                self.assets[tag] = [a for page in json.loads(pages.stdout) for a in page]
        return self.assets[tag]

    def download(self, frame, name, expected, maximum):
        if not re.fullmatch(r"[a-zA-Z0-9_.-]+", name):
            raise RuntimeError("Unsafe cache asset name")
        matches = [a for a in self.listing(frame) if a["name"] == name]
        if len(matches) != 1 or matches[0]["size"] > maximum:
            raise RuntimeError("Missing/oversized cache asset")
        dest = self.work / name
        dest.unlink(missing_ok=True)
        url = f"https://github.com/{os.environ['GITHUB_REPOSITORY']}/releases/download/{urllib.parse.quote(self.tag(frame),safe='')}/{name}"
        with urllib.request.urlopen(url,timeout=90) as response, dest.open("wb") as output:
            total=0
            while data:=response.read(1048576):
                total+=len(data)
                if total>maximum:
                    raise RuntimeError("Download exceeded the admitted byte limit")
                output.write(data)
        if not dest.is_file() or dest.is_symlink() or dest.stat().st_size > maximum or A.digest(dest) != expected:
            raise RuntimeError("Downloaded cache asset checksum differs")
        return dest

    def get(self, frame, out, bpy):
        prefix = f"frame-{frame:04d}-{self.key}-"
        for asset in self.listing(frame):
            name = asset["name"]
            if not name.startswith(prefix) or not name.endswith(".json"):
                continue
            try:
                sha = name[len(prefix):-5]
                if not re.fullmatch("[0-9a-f]{64}", sha):
                    continue
                m = json.loads(self.download(frame,name,sha,100_000).read_text())
                validate_record(m, self.key, frame)
                path = self.download(frame,m["asset"],m["sha256"],B.PNG_MAX)
                if path.stat().st_size != m["bytes"]:
                    raise RuntimeError("Cache PNG size differs from manifest")
                A.image_stats(bpy,path)
                dest = out / f"frame_{frame:04d}.png"
                shutil.copy2(path,dest)
                return m
            except urllib.error.HTTPError as exc:
                if exc.code != 404:
                    raise  # An outage must not masquerade as a cache miss and spend CPU.
                print(f"Missing cache payload {name}",flush=True)
            except urllib.error.URLError:
                raise
            except (RuntimeError, ValueError, KeyError, OSError) as exc:
                print(f"Rejected cache candidate {name}: {exc}", flush=True)
        return None

    def put(self, record, png):
        publication_allowed()
        frame = record["frame"]
        if A.digest(png) != record["sha256"] or png.stat().st_size > B.PNG_MAX:
            raise RuntimeError("Refusing an invalid upload")
        tag = self.tag(frame)
        existing = self.listing(frame)
        if not existing:
            r = gh("release","view",tag,check=False)
            if r.returncode:
                created=gh("release","create",tag,"--target",os.environ["GITHUB_SHA"],"--prerelease","--latest=false",
                   "--title",tag,"--notes","Lossless ANGELES2099 project render cache; original PNGs and SHA-256 manifests.",check=False)
                if created.returncode:
                    gh("release","view",tag)  # Another worker may have created the same tag.
            self.listing(frame,True)
        # Append-only repair names: never overwrite or delete an accepted asset.
        name = f"png-{record['sha256']}-{os.environ['GITHUB_RUN_ID']}-{os.environ.get('GITHUB_RUN_ATTEMPT','1')}.png"
        local = self.work / name
        shutil.copy2(png,local)
        if not any(a["name"]==name for a in self.listing(frame)):
            gh("release","upload",tag,local)
            self.assets[tag].append({"name":name,"size":local.stat().st_size})
        self.download(frame,name,record["sha256"],B.PNG_MAX)
        record = dict(record,asset=name)
        payload = json.dumps(record,sort_keys=True,separators=(",",":")).encode()
        sha = hashlib.sha256(payload).hexdigest()
        manifest = self.work / f"frame-{frame:04d}-{self.key}-{sha}.json"
        manifest.write_bytes(payload)
        if len(self.listing(frame)) >= 900:
            raise RuntimeError("Cache release asset capacity exhausted; stop for owner review")
        if not any(a["name"]==manifest.name for a in self.listing(frame)):
            gh("release","upload",tag,manifest)
            self.assets[tag].append({"name":manifest.name,"size":manifest.stat().st_size})
        self.download(frame,manifest.name,sha,100_000)  # Commit marker published LAST and checked.
        return record


def validate_record(m, key, frame):
    if m.get("recipe") != key or m.get("sourceCommit") != A.SOURCE or m.get("frame") != frame:
        raise RuntimeError("Wrong cache recipe/source/frame identity")
    if not re.fullmatch("[0-9a-f]{64}",m.get("sha256","")) or not 0 < m.get("bytes",0) <= B.PNG_MAX:
        raise RuntimeError("Invalid native PNG hash/size")
    A.assert_settings(m["settings"],16)


def proof_frames(proofs, pre, frames, bpy):
    """Import only compatible A/B/fallback records; producer metadata never overrides expected inputs."""
    found = {}
    for path in proofs.rglob("manifest.json"):
        folder = path.parent
        try:
            m = json.loads(path.read_text())
            p = json.loads((folder/"preflight.json").read_text())
            if p.get("renderFingerprint") != pre["renderFingerprint"] or m.get("sourceCommit") != A.SOURCE:
                continue
            if m.get("gate") == "B":
                expected = B.key(pre)
                if m.get("fingerprint") != expected:
                    continue
                entries = [(e,folder/f"frame_{e['frame']:04d}.png") for e in m["frames"]]
            elif m.get("gate") == "C":
                if m.get("recipe") != recipe(pre):
                    continue
                entries = [(e,folder/f"frame_{e['frame']:04d}.png") for e in m["frames"]]
            else:
                if m.get("renderFingerprint") != pre["renderFingerprint"]:
                    continue
                entries = [(e,folder/e["path"]) for e in m.get("renders",[]) if e.get("samples")==16]
            for e,png in entries:
                f=e["frame"]
                if f not in frames:
                    continue
                A.assert_settings(e["settings"],16)
                if (png.name != f"frame_{f:04d}.png" or not png.is_file() or png.is_symlink() or not png.resolve().is_relative_to(folder.resolve())
                        or png.stat().st_size>B.PNG_MAX or A.digest(png)!=e["sha256"]):
                    continue
                A.image_stats(bpy,png)
                if f in found and found[f][1]["sha256"] != e["sha256"]:
                    raise RuntimeError("Conflicting compatible proof PNGs")
                found[f]=(png,e)
        except (KeyError,ValueError,OSError):
            continue
    return found


def worker(source,out,index,proofs):
    launch_allowed()
    import bpy
    if bpy.app.version != A.BLENDER:
        raise RuntimeError("Wrong Blender version")
    pre=A.preflight(source,out)
    key=recipe(pre)
    spec=plan()[index]
    frames=list(range(spec["first"],spec["last"]+1))
    cache=Cache(key,out/"transfer")
    report={"gate":"C","sourceCommit":A.SOURCE,"recipe":key,"chunk":spec,"frames":[],"durable":[],"state":"running"}
    pending=None
    deadline=time.monotonic()+65*60
    def interrupted(*_):
        raise InterruptedError("Interrupted; preserving the pending PNG")
    signal.signal(signal.SIGTERM,interrupted)
    try:
        imports=proof_frames(proofs,pre,frames,bpy)
        scene=None
        for f in frames:
            if time.monotonic()>deadline:
                raise InterruptedError("Render deadline reached; leaving publication time")
            png=out/f"frame_{f:04d}.png"
            entry=cache.get(f,out,bpy)
            if entry:
                report["frames"].append(entry);report["durable"].append(f)
                png.unlink()  # Remote bytes were just verified; keep fallback bounded.
                A.write_json(out/"manifest.json",report)
                continue
            if f in imports:
                original,old=imports[f]
                shutil.copy2(original,png)
                settings=old["settings"]
                origin={"imported":True,"producer":str(original.parent.name)}
            else:
                if scene is None:
                    sys.path.insert(0,str((source/A.PRODUCTION/"blender").resolve()))
                    import angeles2099 as production
                    scene=production.build("crest")
                    checks=production.validate(scene)
                    A.write_json(out/"scene-check.json",checks)
                    if not checks.get("ok"):
                        raise RuntimeError("Locked scene checks failed")
                    production.set_device(scene["scene"],"CPU")
                production.render_frames(scene,[f],A.RESOLUTION,16,out_dir=str(out))
                settings=A.settings_snapshot(scene["scene"])
                origin={"imported":False,"run":os.environ["GITHUB_RUN_ID"]}
            A.assert_settings(settings,16)
            A.image_stats(bpy,png)
            entry={"frame":f,"recipe":key,"sourceCommit":A.SOURCE,"sha256":A.digest(png),
                   "bytes":png.stat().st_size,"settings":settings,"origin":origin}
            validate_record(entry,key,f)
            pending=entry
            report["frames"].append(entry)
            A.write_json(out/"manifest.json",report)  # Pending checkpoint before network I/O.
            cache.put(entry,png)
            report["durable"].append(f)
            pending=None
            png.unlink()
            A.write_json(out/"manifest.json",report)
        report["state"]="complete"
        if A.git(source,"status","--porcelain","--untracked-files=all","--",str(A.PRODUCTION)):
            raise RuntimeError("Production source changed")
    except Exception as exc:
        report.update(state="failed",error=f"{type(exc).__name__}: {exc}")
        raise
    finally:
        A.write_json(out/"manifest.json",report)


def assemble(source,out):
    import bpy
    pre=A.preflight(source,out)
    key=recipe(pre)
    cache=Cache(key,out/"transfer")
    pngs=out/"pngs";pngs.mkdir(exist_ok=True)
    report={"gate":"C","passed":False,"sourceCommit":A.SOURCE,"recipe":key}
    try:
        records=[]
        for frame in range(FIRST,LAST+1):
            m=cache.get(frame,pngs,bpy)
            if not m:
                raise RuntimeError(f"Missing/corrupt lossless frame {frame}; resume render workers")
            records.append(m)
        paths=[];counts=[]
        for spec in plan():
            p=out/f"chunk-{spec['index']}.mp4"
            M.encode_chunk(pngs,spec["first"],spec["count"],p)
            paths.append(p);counts.append(spec["count"])
        video,boundaries=M.concat_chunks(paths,out/"video-only.mp4",counts)
        for b in boundaries:
            b["leftSourceFrame"]=FIRST+b["outputFrame"]-1
            b["rightSourceFrame"]=FIRST+b["outputFrame"]
        master=source/A.PRODUCTION/"review/music/crest.wav"
        ref=M.audio_reference(master,FIRST,201,out/"audio-reference.wav")
        final,audio=M.mux_and_check(out/"video-only.mp4",out/"audio-reference.wav",out/"teaser.mp4",201)
        if (out/"teaser.mp4").stat().st_size>48_000_000:
            raise RuntimeError("Review file exceeds artifact budget; quality was not reduced")
        report.update(passed=True,sourceFrames=list(range(FIRST,LAST+1)),decodedFrameCount=final["count"],
                      video=final,boundaries=boundaries,audioReference=ref,audioSynchronization=audio,
                      masterSha256=A.digest(master),losslessFrames=records,mp4Sha256=A.digest(out/"teaser.mp4"))
    except Exception as exc:
        report["error"]=f"{type(exc).__name__}: {exc}"
        raise
    finally:
        A.write_json(out/"qa.json",report)
        if (out/"teaser.mp4").is_file() and report["passed"]:
            (out/"checksums.sha256").write_text(f"{report['mp4Sha256']}  teaser.mp4\n{A.digest(out/'qa.json')}  qa.json\n")


def stage(out,dest,review=False):
    if dest.exists() and any(dest.iterdir()):
        raise RuntimeError("Artifact staging directory must be empty")
    dest.mkdir(parents=True,exist_ok=True)
    names=["manifest.json","preflight.json","scene-check.json","qa.json","checksums.sha256"]
    if review:
        names+=["teaser.mp4"]
    else:
        m=json.loads((out/"manifest.json").read_text()) if (out/"manifest.json").exists() else {}
        names += [f"frame_{e['frame']:04d}.png" for e in m.get("frames",[]) if e["frame"] not in m.get("durable",[])]
    for name in names:
        p=out/name
        if p.is_file() and not p.is_symlink():
            shutil.copy2(p,dest/name)
    limit=64_000_000 if review else FALLBACK
    if sum(p.stat().st_size for p in dest.iterdir())>limit-64_000:
        raise RuntimeError("Fallback artifact cap exceeded; refusing upload")
    A.write_json(dest/"publication.json",{"files":{p.name:A.digest(p) for p in dest.iterdir() if p.is_file()}})


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("command",choices=("admit","worker","assemble","stage"))
    ap.add_argument("--source",type=Path,default=Path("approved-source"))
    ap.add_argument("--out",type=Path,required=True)
    ap.add_argument("--proofs",type=Path,default=Path("proofs"))
    ap.add_argument("--index",type=int)
    ap.add_argument("--destination",type=Path)
    ap.add_argument("--review",action="store_true")
    args=ap.parse_args();args.out.mkdir(parents=True,exist_ok=True)
    if args.command=="admit":
        if os.getenv("WORKERS","8") not in ("8","10"):
            raise RuntimeError("Only eight or ten standard CPU workers are supported")
        requested=os.getenv("REQUEST_RENDER")=="true"
        if requested:
            launch_allowed()
            import artifact_budget
            used=artifact_budget.remote_budget()["retainedBytes"]
            if used+RESERVE>400_000_000:
                raise RuntimeError("Need 240 MB free under the 400 MB artifact working ceiling")
        matrix={"index":[p["index"] for p in plan()]}
        A.write_json(args.out/"plan.json",{"chunks":plan(),"workers":os.getenv("WORKERS","8"),
                     "renderRequested":requested,"publicationEnabled":False if not requested else True})
        if os.getenv("GITHUB_OUTPUT"):
            with open(os.environ["GITHUB_OUTPUT"],"a") as f:
                f.write("matrix="+json.dumps(matrix)+"\n")
                f.write("render="+str(requested).lower()+"\n")
        print(json.dumps(plan()))
    elif args.command=="worker":
        if args.index is None or not 0<=args.index<len(plan()):ap.error("Invalid fixed teaser chunk")
        worker(args.source,args.out,args.index,args.proofs)
    elif args.command=="assemble":
        assemble(args.source,args.out)
    else:
        if args.destination is None:ap.error("--destination required")
        stage(args.out,args.destination,args.review)


if __name__=="__main__":
    main()
