"""Gate C safety, cache integrity and exact teaser contract; no production rendering."""
import hashlib,json,os,sys,tempfile,unittest,io,types
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import gate_c as C
from test_gate_a import approved_settings

class GateCTests(unittest.TestCase):
    def test_exact_fixed_coverage_and_bounded_jobs(self):
        p=C.plan()
        self.assertEqual([f for c in p for f in range(c["first"],c["last"]+1)],list(range(285,486)))
        self.assertTrue(all(c["count"]<=12 and c["predictedSeconds"]<=1764 for c in p))
        self.assertEqual(len({c["index"] for c in p}),len(p))

    def test_publication_and_launch_default_disabled(self):
        with patch.dict(os.environ,{},clear=True):
            with self.assertRaises(RuntimeError):C.publication_allowed()
            with self.assertRaises(RuntimeError):C.launch_allowed()
        with patch.dict(os.environ,{"CACHE_PUBLICATION_APPROVED":"true","TEASER_LAUNCH_APPROVED":"true","GITHUB_EVENT_NAME":"push"}):
            with self.assertRaises(RuntimeError):C.launch_allowed()
        with patch.dict(os.environ,{"CACHE_PUBLICATION_APPROVED":"true","TEASER_LAUNCH_APPROVED":"true","GITHUB_EVENT_NAME":"workflow_dispatch"}):
            C.launch_allowed()

    def record(self):
        return {"frame":285,"recipe":"key","sourceCommit":C.A.SOURCE,"sha256":"a"*64,"bytes":100,"settings":approved_settings()}

    def test_cache_rejects_wrong_frame_source_quality_and_size(self):
        C.validate_record(self.record(),"key",285)
        for change in ({"frame":286},{"sourceCommit":"other"},{"recipe":"other"},{"bytes":10_000_000},{"sha256":"bad"},{"settings":approved_settings(128)}):
            with self.assertRaises(RuntimeError):C.validate_record(dict(self.record(),**change),"key",285)

    def test_corrupt_candidate_is_rejected_and_good_candidate_recovered(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);out=root/"out";out.mkdir()
            cache=C.Cache("key",root/"transfer")
            good=dict(self.record(),asset="png-good.png",sha256=hashlib.sha256(b"pixels").hexdigest(),bytes=6)
            raw=json.dumps(good).encode();sha=hashlib.sha256(raw).hexdigest()
            name=f"frame-0285-key-{sha}.json"
            manifest=root/name;manifest.write_bytes(raw)
            png=root/"png-good.png";png.write_bytes(b"pixels")
            assets=[{"name":"frame-0285-key-"+"b"*64+".json"},{"name":name}]
            def download(frame,n,*args):
                if "b"*64 in n:raise RuntimeError("checksum differs")
                return manifest if n==name else png
            with patch.object(cache,"listing",return_value=assets),patch.object(cache,"download",side_effect=download),patch.object(C,"image_stats"):
                result=cache.get(285,out,None)
                self.assertEqual(result["sha256"],good["sha256"])
                self.assertEqual((out/"frame_0285.png").read_bytes(),b"pixels")

    def test_manifest_commit_is_after_verified_png_and_gate_prevents_writes(self):
        with tempfile.TemporaryDirectory() as t:
            cache=C.Cache("key",Path(t)/"cache")
            png=Path(t)/"frame.png";png.write_bytes(b"pixels")
            record=dict(self.record(),sha256=C.A.digest(png),bytes=6)
            with patch.dict(os.environ,{},clear=True),patch.object(C,"gh") as api:
                with self.assertRaises(RuntimeError):cache.put(record,png)
                api.assert_not_called()

    def test_network_outage_does_not_become_a_render_cache_miss(self):
        with tempfile.TemporaryDirectory() as t:
            cache=C.Cache("key",Path(t)/"cache")
            name="frame-0285-key-"+"a"*64+".json"
            with patch.object(cache,"listing",return_value=[{"name":name}]), \
                    patch.object(cache,"download",side_effect=C.urllib.error.URLError("offline")):
                with self.assertRaises(C.urllib.error.URLError):cache.get(285,Path(t),None)

    def test_fallback_contains_only_unpublished_frame(self):
        with tempfile.TemporaryDirectory() as t:
            out=Path(t)/"out";out.mkdir();dest=Path(t)/"dest"
            (out/"manifest.json").write_text(json.dumps({"frames":[{"frame":285},{"frame":286}],"durable":[285]}))
            for f in (285,286):(out/f"frame_{f:04d}.png").write_bytes(b"pixels")
            C.stage(out,dest)
            self.assertFalse((dest/"frame_0285.png").exists())
            self.assertTrue((dest/"frame_0286.png").exists())

    def test_cache_sharding_supports_film_without_release_asset_overflow(self):
        with tempfile.TemporaryDirectory() as t:
            cache=C.Cache("key",Path(t))
            self.assertNotEqual(cache.tag(199),cache.tag(200))
            self.assertNotEqual(cache.tag(399),cache.tag(400))
            self.assertEqual(len({cache.tag(f) for f in range(600)}),3)

    def test_upload_commit_order_and_readback_corruption(self):
        for corrupt in (False,True):
            with self.subTest(corrupt=corrupt), tempfile.TemporaryDirectory() as t:
                root=Path(t);cache=C.Cache("key",root/"cache")
                cache.assets[cache.tag(285)]=[{"name":"existing","size":1}]
                png=root/"frame.png";png.write_bytes(b"pixels")
                record=dict(self.record(),sha256=C.A.digest(png),bytes=6)
                remote={};events=[]
                def api(*args,**kwargs):
                    self.assertEqual(args[:2],("release","upload"))
                    path=Path(args[-1]);remote[path.name]=path.read_bytes()
                    events.append("upload-json" if path.suffix==".json" else "upload-png")
                    return types.SimpleNamespace(returncode=0,stdout="",stderr="")
                def get(url,**kwargs):
                    name=url.rsplit("/",1)[-1]
                    events.append("verify-json" if name.endswith(".json") else "verify-png")
                    return io.BytesIO(b"corrupt" if corrupt else remote[name])
                with patch.object(C,"publication_allowed"),patch.object(C,"gh",side_effect=api), \
                        patch.object(C.urllib.request,"urlopen",side_effect=get), \
                        patch.dict(os.environ,{"GITHUB_RUN_ID":"1","GITHUB_RUN_ATTEMPT":"1","GITHUB_REPOSITORY":"o/r"}):
                    if corrupt:
                        with self.assertRaises(RuntimeError):cache.put(record,png)
                        self.assertEqual(events,["upload-png","verify-png"])
                    else:
                        first=cache.put(record,png)
                        self.assertEqual(events,["upload-png","verify-png","upload-json","verify-json"])
                        second=cache.put(dict(record,frame=286),png)
                        self.assertNotEqual(first["asset"],second["asset"])

    def test_recipe_is_frame_range_independent_but_inputs_sensitive(self):
        self.assertEqual(C.recipe({"renderFingerprint":"a"}),C.recipe({"renderFingerprint":"a"}))
        self.assertNotEqual(C.recipe({"renderFingerprint":"a"}),C.recipe({"renderFingerprint":"b"}))

    def test_proof_import_requires_exact_inputs_frame_identity_and_png_hash(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);(root/"samples16").mkdir()
            png=root/"samples16/frame_0330.png";png.write_bytes(b"original PNG")
            (root/"preflight.json").write_text(json.dumps({"renderFingerprint":"approved"}))
            entry={"frame":330,"samples":16,"path":"samples16/frame_0330.png",
                   "sha256":C.A.digest(png),"settings":approved_settings()}
            m={"gate":"A","sourceCommit":C.A.SOURCE,"renderFingerprint":"approved","renders":[entry]}
            (root/"manifest.json").write_text(json.dumps(m))
            with patch.object(C,"image_stats"):
                self.assertIn(330,C.proof_frames(root,{"renderFingerprint":"approved"},[330],None))
                self.assertFalse(C.proof_frames(root,{"renderFingerprint":"other"},[330],None))
                self.assertFalse(C.proof_frames(root,{"renderFingerprint":"approved"},[331],None))
                png.write_bytes(b"corrupted PNG")
                self.assertFalse(C.proof_frames(root,{"renderFingerprint":"approved"},[330],None))

    def test_locked_black_transition_is_preserved_without_accepting_other_blank_frames(self):
        import numpy as np
        black=np.zeros((2,2,3))
        for f in (334,345,359):C.check_pixels(black,f)
        for f in (285,333,360,485):
            with self.assertRaises(RuntimeError):C.check_pixels(black,f)
        with self.assertRaises(RuntimeError):C.check_pixels(np.ones((2,2,3)),350)
        with self.assertRaises(RuntimeError):C.check_pixels(np.full((2,2,3),float('nan')),350)

    def test_actual_201_frame_encode_concat_and_aac_timeline(self):
        from test_gate_b import master
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);paths=[]
            for i in range(3):
                p=root/f"c{i}.mp4"
                C.M.ffmpeg("-f","lavfi","-i",f"testsrc2=size=96x160:rate=24:duration=3",
                           "-frames:v",67,"-an",*C.M.ENCODE,p)
                paths.append(p)
            video,boundaries=C.M.concat_chunks(paths,root/"video.mp4",[67,67,67],(96,160))
            wav=root/"master.wav";master(wav,25)
            ref=C.M.audio_reference(wav,285,201,root/"ref.wav")
            final,audio=C.M.mux_and_check(root/"video.mp4",root/"ref.wav",root/"final.mp4",201,(96,160))
            self.assertEqual(final["count"],201)
            self.assertEqual(final["duration"],"67/8")
            self.assertEqual(final["frameSha256"],video["frameSha256"])
            self.assertEqual(ref["startSample48k"],570000)
            self.assertEqual(audio["expectedSamples"],402000)
            self.assertLessEqual(abs(audio["bestLagSamples48k"]),1)

if __name__=="__main__":unittest.main()
