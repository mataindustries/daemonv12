#!/usr/bin/env bash
# BANGER LAB 001 technical-validity gates for one DaemonV12 production render.
# Read-only. Needs Node 22.18+ and FFmpeg on PATH. Passing means "eligible to be
# judged"; it says nothing about musical quality.
#
# Usage: check-delivery.sh <render-dir> <name> <approved-palette.json> [frames]
#   <render-dir>  directory holding <name>.wav, <name>.render.json,
#                 <name>.analysis.json and <name>.stems/
#   [frames]      expected container length: 3307500 (75 s, default) or 661500 (15 s)
# Exit status 0 only if every gate passes.
set -uo pipefail
if (($# < 3)); then sed -n '2,10p' "$0"; exit 2; fi
R=$1 N=$2 PAL=$3 F=${4:-3307500}
status=0

node --input-type=module -e '
import {readFileSync,readdirSync} from "node:fs"; import {createHash} from "node:crypto";
const [R,N,PAL,F]=process.argv.slice(1), want=Number(F), out=[];
const j=f=>JSON.parse(readFileSync(f,"utf8")), sha=f=>createHash("sha256").update(readFileSync(f)).digest("hex");
const m=j(`${R}/${N}.render.json`), a=j(`${R}/${N}.analysis.json`), pal=j(PAL);
const ok=new Map(); for(const p of pal.packs){ok.set(p.kit.file,p.kit.sha256);for(const s of p.sounds)ok.set(s.file,s.sha256);}
const chk=(name,pass,detail="")=>out.push(`${pass?"PASS":"FAIL"} ${name}${detail?" — "+detail:""}`);
chk("engine 0.7.0",m.engine.version==="0.7.0",m.engine.version);
chk("production route with fixed container",m.timeline?.resultingFrames===want&&m.wav.frames===want&&a.master.frames===want,`${m.wav.frames} frames`);
chk("format 44100 Hz / 2 ch / 16-bit",a.master.sampleRate===44100&&a.master.channels===2&&a.master.bitsPerSample===16);
chk("master hash matches manifest",sha(`${R}/${N}.wav`)===m.wav.sha256);
const stems=readdirSync(`${R}/${N}.stems`).filter(f=>f.endsWith(".wav"));
chk("one stem per track",stems.length===m.samples.tracks.length&&a.tracks.length===stems.length,`${stems.length} stems`);
chk("stems aligned to master",a.tracks.every(t=>t.analysis.frames===want),a.tracks.map(t=>t.trackId+":"+t.analysis.frames).join(" "));
chk("stem hashes match manifest",m.stems.every(s=>sha(`${R}/${s.wav.file}`)===s.wav.sha256));
const clipped=[...m.production.tracks.map(t=>[t.trackId,t.clippedSamples]),["master",m.production.master.clippedSamples],["mix",m.mix.clippedSamples]].filter(([,c])=>c!==0);
chk("no clipping at any production stage",clipped.length===0,clipped.map(c=>c.join("=")).join(" "));
chk("no full-scale samples",a.master.fullScaleSamples===0,`${a.master.fullScaleSamples}`);
chk("true peak <= -1.0 dBTP",a.master.truePeakDbfs!==null&&a.master.truePeakDbfs<=-1,`${a.master.truePeakDbfs} dBTP; info: ${a.master.integratedLufs} LUFS, LRA ${a.master.loudnessRangeLu} LU`);
chk("no General MIDI",m.gmRenderer===null&&m.soundfont===null&&m.midi.notes===0);
const bad=m.samples.assets.filter(x=>ok.get(x.file)!==x.sha256);
chk("approved palette only (path + SHA-256)",bad.length===0,bad.map(x=>x.file).join(" ")||`${m.samples.assets.length} assets`);
console.log(out.join("\n")); if(out.some(l=>l.startsWith("FAIL")))process.exitCode=1;
' "$R" "$N" "$PAL" "$F" || status=1

# End boundary: the container hard-cuts anything still sounding. Final 441 frames
# (10 ms) must peak at or below -50 dBFS.
peak=$(ffmpeg -hide_banner -nostdin -i "$R/$N.wav" \
  -af "atrim=start_sample=$((F - 441)),astats=measure_perchannel=none:measure_overall=Peak_level" \
  -f null - 2>&1 | sed -n 's/.*Peak level dB: //p')
node -e '
const p=process.argv[1], v=p==="-inf"?-Infinity:Number(p);
console.log(`${v<=-50?"PASS":"FAIL"} end boundary: final 10 ms peak <= -50 dBFS — ${p||"unmeasured"} dBFS`);
if(!(v<=-50))process.exitCode=1;' -- "$peak" || status=1

exit $status
