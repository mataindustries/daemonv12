// Sample-aware orchestration. Render modules receive PCM/frame requests, never projects.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync, rmSync, rmdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { decodePcm, mixPcm, pcmRenderer, PCM_RATE, MAX_PCM_FRAMES, type AudioProcessor, gainPan, automatedGainPan, fitFloat, applyDucking, sumFloat, quantize, padPcm, productionRenderer, dynamicsRenderer, voiceFrames, voiceCost, playbackRenderer, PLAYBACK_WORK_LIMIT, PLAYBACK_VOICE_BYTES_LIMIT, type PcmTrigger, type AudioRenderer, type Soundfont } from './render/index.ts';
import { formatDuration, ticksToFrames, ticksToSeconds } from './timing/musical-time.ts';
import { secondsToFrames } from './timing/wall-time.ts';
import { renderPlan, automationFrames } from './timing/render-plan.ts';
import { encodeSmf } from './midi/smf.ts';
import { diagnostic, type Diagnostic } from './diagnostics.ts';
import { ENGINE_VERSION } from './version.ts';
import type { Compilation } from './pipeline.ts';
import type { TimelineTrack } from './timing/timeline.ts';

interface Request {
  compilation: Compilation; path: string; paths: {midi:string;wav:string;manifest:string}; stemDir: string;
  processor?: AudioProcessor;
  midi: Uint8Array; stems: boolean; renderer?: AudioRenderer; soundfont?: Soundfont;
  stemFileName: (trackId:string)=>string;
}
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
function write(path:string,bytes:Uint8Array) { writeFileSync(`${path}.tmp`,bytes);renameSync(`${path}.tmp`,path); }
function wavIdentity(file:string,bytes:Buffer,frames:number) {
  return {file,sha256:hash(bytes),bytes:bytes.length,frames,sampleRate:PCM_RATE,channels:2,bitsPerSample:16,durationSeconds:Number((frames/PCM_RATE).toFixed(6))};
}
// A sample track's triggers: absolute frames and, for performed notes, playback and provenance.
function sampleTriggers(c:Compilation,track:TimelineTrack) {
  const instrument=track.instrument as Exclude<TimelineTrack['instrument'],{type:'gm'}>,timeline=c.timeline!;
  return track.notes.map(note=>{
    const file=instrument.type==='sampler'?instrument.sample:c.kits!.get(instrument.kit)!.find(e=>e.pitch===note.pitch)!.sample;
    const frame=ticksToFrames(note.tick,timeline.usPerQuarter),pcm=c.assets!.get(file)!.pcm!,authored=note.playback;
    if(!authored)return {file,tick:note.tick,frame,velocity:note.velocity,pcm};
    // A glide ends on the absolute frame of its musical end, like every other musical boundary.
    const glide=authored.glide&&{to:authored.glide.to,frames:ticksToFrames(note.tick+authored.glide.durationTicks,timeline.usPerQuarter)-frame};
    const playback={rate:authored.rate,offset:secondsToFrames(authored.offsetSeconds),...(glide?{glide}:{})};
    return {file,tick:note.tick,frame,velocity:note.velocity,pcm,playback,record:{rate:authored.rate,
      ...(authored.offsetSeconds?{offset:{seconds:authored.offsetSeconds,frames:playback.offset}}:{}),
      ...(glide?{glide:{to:glide.to,duration:formatDuration(authored.glide!.durationTicks),frames:glide.frames}}:{}),voiceFrames:voiceFrames(pcm,playback)}};
  });
}
// Sample-performance render budget from project and WAV metadata alone, checked at compilation
// so validate, render and MCP reject a pathological project before any audio work. It charges
// what rendering will do: interpolated voices only, cut at the production audio boundary.
// Accumulation stops just past the limit, far inside exact integer range.
export function playbackBudget(c:Compilation,production:boolean,limits={work:PLAYBACK_WORK_LIMIT,bytes:PLAYBACK_VOICE_BYTES_LIMIT}):Diagnostic|undefined {
  const cap=production?renderPlan(c.project!).audioEndFrames??Infinity:Infinity;
  const fail=(path:string,metric:string,received:unknown,message:string,expected:string,hint:string)=>{
    const d=diagnostic('OUT_OF_RANGE',path,{metric,...received as object},expected,hint);d.message=message;return d;
  };
  let taps=0;
  for(const track of c.timeline!.tracks) {
    if(track.instrument.type==='gm')continue;
    for(const t of sampleTriggers(c,track)) {
      const cost=voiceCost(t.pcm,t.playback,cap-t.frame);
      if(cost.bytes>limits.bytes)return fail(`tracks[${track.index}]`,'performedVoiceBytes',{bytes:cost.bytes,limit:limits.bytes,tick:t.tick,file:t.file},
        `The project exceeds the sample-performance render budget: one performed voice of ${t.file} would need a ${Math.ceil(cost.bytes/1048576)} MiB buffer; the limit is ${limits.bytes/1048576} MiB per voice.`,
        `performed voices of at most ${limits.bytes/1048576} MiB each (frames x channels x 8 bytes)`,
        'Shorten the voice: use a less extreme slow playbackRate, a later offsetSeconds, a shorter or mono source, or render.duration to end it sooner.');
      taps+=cost.work;
      if(taps>limits.work)return fail(`tracks[${track.index}]`,'interpolationTaps',{taps:`more than ${limits.work}`,limit:limits.work},
        `The project exceeds the sample-performance render budget: its transformed sample voices need more than ${limits.work.toLocaleString('en-US')} interpolation steps in total (the limit was crossed in this track).`,
        `transformed (rate other than 1, or gliding) sample voices totalling at most ${limits.work.toLocaleString('en-US')} interpolation steps`,
        'Reduce transformed playback: fewer simultaneous or overlapping performed notes and clips that repeat them, shorter sources or later offsets, rates nearer 1 (slow rates last longer, fast rates widen the filter), or render.duration to stop voices earlier. Notes at playbackRate 1 without glide cost nothing.');
    }
  }
  return undefined;
}
export async function renderSampledProject(request:Request):Promise<{manifest?:Record<string,unknown>;diagnostics:Diagnostic[]}> {
  const {compilation:c,path,paths,stemDir,midi,renderer,soundfont}=request;
  const production=!!request.processor;
  const project=c.project!,plan=renderPlan(project);
  const dynamics=project.render!==undefined || project.master?.ducking!==undefined || project.tracks.some(t=>t.automation!==undefined)
    || [...project.tracks.flatMap(t=>t.effects??[]),...project.master?.effects??[]].some(e=>['compressor','reverb','saturation'].includes(e.type));
  const processedTracks:Record<string,unknown>[]=[];
  const timeline=c.timeline!,diagnostics:Diagnostic[]=[],stems:Record<string,unknown>[]=[];
  const minimumFrames=production?plan.minimumFrames:ticksToFrames(timeline.endTick,timeline.usPerQuarter,PCM_RATE,true);
  const cap=plan.audioEndFrames??undefined;
  if(minimumFrames>MAX_PCM_FRAMES) return {diagnostics:[diagnostic('RENDERER_FAILED','',minimumFrames,'sample render of at most 600 seconds including tails')]};
  const master:PcmTrigger[]=[];
  let gmRenderer:unknown=null,gmSource:unknown=null;
  if(renderer && !production) {
    const rendered=await renderer.render({midiPath:paths.midi,wavPath:paths.wav});
    if(!rendered.ok)return {diagnostics:[rendered.diagnostic]};
    const bytes=readFileSync(paths.wav),decoded=decodePcm(bytes);
    if(!decoded.pcm || decoded.pcm.frames<minimumFrames)return {diagnostics:[diagnostic('RENDERER_FAILED','',paths.wav,'GM audio covering the full project timeline')]};
    master.push({frame:0,velocity:1,pcm:decoded.pcm});gmRenderer=rendered.renderer;
    gmSource={sha256:hash(bytes),bytes:bytes.length,frames:decoded.pcm.frames};
  }
  if(request.stems || production)mkdirSync(stemDir);
  async function processTrack(samples:Float64Array,index:number) {
    const track=c.project!.tracks[index]!;
    const automation={gainDb:automationFrames(track.automation?.gainDb,project),pan:automationFrames(track.automation?.pan,project)};
    const processed=await request.processor!.effects(automatedGainPan(samples,track.mix?.gainDb,track.mix?.pan,automation),track.effects??[],cap);
    if(processed.diagnostic) {diagnostics.push({...processed.diagnostic,path:`tracks[${index}]`});return null;}
    const output=quantize(cap!==undefined&&processed.value.length/2>cap?fitFloat(processed.value,cap):processed.value);
    processedTracks.push({trackId:track.id,gainDb:track.mix?.gainDb??0,pan:track.mix?.pan??0,effects:track.effects??[],...(track.automation?{automation:track.automation,resolvedAutomation:automation}:{}),clippedSamples:output.clippedSamples,preClipPeakDbfs:output.preClipPeakDbfs});
    master.push({frame:0,velocity:1,pcm:decodePcm(output.bytes).pcm!});
    return output;
  }
  const sampleTracks:Record<string,unknown>[]=[];
  let performed=false;
  for(const track of timeline.tracks) {
    const file=request.stemFileName(track.id),wavPath=join(stemDir,file);
    if(track.instrument.type==='gm') {
      if(!request.stems && !production)continue;
      const stemMidi=encodeSmf(timeline,track.id),midiPath=join(stemDir,file.replace(/\.wav$/,'.mid'));
      write(midiPath,stemMidi);
      const rendered=await renderer!.render({midiPath,wavPath});
      if(!rendered.ok)return {diagnostics:[{...rendered.diagnostic,path:`tracks[${track.index}]`}]};
      if(rendered.wav.frames<minimumFrames)return {diagnostics:[diagnostic('RENDERER_FAILED',`tracks[${track.index}]`,rendered.wav.frames,'stem covering the full timeline')]};
      let bytes:Buffer=readFileSync(wavPath),frames=rendered.wav.frames;
      if(production) {
        if(Math.min(frames,cap??Infinity)>MAX_PCM_FRAMES)return {diagnostics:[diagnostic('RENDERER_FAILED',`tracks[${track.index}]`,frames,'at most 600 seconds including tails')]};
        const processed=await processTrack(sumFloat([{frame:0,velocity:1,pcm:decodePcm(bytes).pcm!}],minimumFrames,cap),track.index);
        if(!processed)return {diagnostics};
        bytes=processed.bytes;frames=processed.frames;write(wavPath,bytes);gmRenderer=rendered.renderer;
      }
      stems.push({trackId:track.id,trackIndex:track.index,midi:{sha256:hash(stemMidi),bytes:stemMidi.length,notes:track.notes.length},renderer:rendered.renderer,wav:wavIdentity(`${basename(stemDir)}/${file}`,bytes,frames)});
      rmSync(midiPath);continue;
    }
    const instrument=track.instrument,triggers=sampleTriggers(c,track);
    if(triggers.some(t=>Math.min(t.frame+voiceFrames(t.pcm,t.playback),cap??Infinity)>MAX_PCM_FRAMES))return {diagnostics:[diagnostic('RENDERER_FAILED',`tracks[${track.index}]`,undefined,'sample render of at most 600 seconds including tails')]};
    performed||=triggers.some(t=>t.playback);
    const mixed=production?await processTrack(sumFloat(triggers,minimumFrames,cap),track.index):mixPcm(triggers,minimumFrames);
    if(!mixed)return {diagnostics};
    // The master sums the same quantized track PCM exported as stems. GM remains one
    // full-score FluidSynth render, preserving the V0.1 master/stem relationship.
    if(!production)master.push({frame:0,velocity:1,pcm:decodePcm(mixed.bytes).pcm!});
    const source={instrument,triggers:triggers.map(({file,tick,frame,velocity,record})=>({file,tick,frame,velocity,...(record?{playback:record}:{})})),clippedSamples:mixed.clippedSamples};
    sampleTracks.push({trackId:track.id,trackIndex:track.index,...source});
    if(request.stems || production) {
      write(wavPath,mixed.bytes);
      stems.push({trackId:track.id,trackIndex:track.index,sample:source,renderer:pcmRenderer,wav:wavIdentity(`${basename(stemDir)}/${file}`,mixed.bytes,mixed.frames)});
    }
  }
  if(master.some(t=>t.pcm.frames>MAX_PCM_FRAMES))return {diagnostics:[diagnostic('RENDERER_FAILED','',undefined,'sample render of at most 600 seconds including tails')]};
  let mixed,duckingProvenance:Record<string,unknown>|undefined;
  if(production) {
    const settings=c.project!.master;
    const output=await request.processor!.effects(gainPan(sumFloat(master,minimumFrames,cap),settings?.gainDb),settings?.effects??[],cap);
    if(output.diagnostic)return {diagnostics:[output.diagnostic]};
    let samples=cap!==undefined&&output.value.length/2>cap?fitFloat(output.value,cap):output.value;
    if(plan.outputFrames!==null)samples=fitFloat(samples,plan.outputFrames);
    if(settings?.ducking) {
      const reference=c.sidechain!,ducked=applyDucking(samples,reference.pcm,settings.ducking);
      samples=ducked.samples;
      duckingProvenance={...settings.ducking,reference:{file:reference.file,sha256:hash(reference.bytes),bytes:reference.bytes.length,frames:reference.pcm.frames,sampleRate:PCM_RATE,channels:reference.pcm.channels,bitsPerSample:16},...ducked.metrics,mixedIntoMaster:false};
    }
    mixed=quantize(samples);
    for(const stem of stems) {
      const wav=stem.wav as {file:string;frames:number};
      const file=request.stemFileName(stem.trackId as string),wavPath=join(stemDir,file);
      if(request.stems) {
        const bytes=padPcm(decodePcm(readFileSync(wavPath)).pcm!,mixed.frames);
        write(wavPath,bytes);stem.wav=wavIdentity(wav.file,bytes,mixed.frames);
      } else rmSync(wavPath);
    }
    if(!request.stems)rmdirSync(stemDir);
  } else mixed=mixPcm(master,minimumFrames);
  write(paths.wav,mixed.bytes);
  return {diagnostics,manifest:{
    engine:{name:'daemonv12',version:ENGINE_VERSION},
    project:{file:basename(path),sha256:hash(c.projectBytes!),formatVersion:1,seed:c.project!.seed},
    midi:{file:basename(paths.midi),sha256:hash(midi),bytes:midi.length,ppq:960,durationTicks:timeline.endTick,durationSeconds:Number(ticksToSeconds(timeline.endTick,timeline.usPerQuarter).toFixed(6)),notes:timeline.tracks.filter(t=>t.instrument.type==='gm').reduce((n,t)=>n+t.notes.length,0)},
    renderer:production?(dynamics?dynamicsRenderer:productionRenderer):pcmRenderer,gmRenderer,gmSource,
    soundfont:soundfont?{file:soundfont.file,sha256:soundfont.sha256,bytes:soundfont.bytes}:null,
    samples:{timing:dynamics?'nearest absolute trigger and fixed boundary, ties later; ceil minimum only without fixed boundary; tick * usPerQuarter * 44100 / 960000000':'nearest frame, ties later; ceil project end; absolute tick * usPerQuarter * 44100 / 960000000',
      assets:Array.from(c.assets!).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([file,asset])=>({file,sha256:hash(asset.bytes),bytes:asset.bytes.length,...(asset.pcm?{frames:asset.pcm.frames,channels:asset.pcm.channels,sampleRate:PCM_RATE,bitsPerSample:16}:{kind:'drumkit'})})),tracks:sampleTracks,
      ...(performed?{playback:playbackRenderer}:{})},
    ...(dynamics?{timeline:{authoredDurationTicks:timeline.endTick,authoredFrames:plan.authoredFrames,duration:project.render?.duration??'auto',tail:project.render?.tail??'auto',requestedFinalFrames:plan.outputFrames,audioEndFrames:plan.audioEndFrames,resultingFrames:mixed.frames,rounding:'nearest sample frame; ties later; combined musical timeline + explicit tail rounded once'}}:{}),
    ...(production?{production:{processor:request.processor!.identity,...(dynamics?{runtime:{name:'node',version:process.version}}:{}),tracks:processedTracks,master:{gainDb:c.project!.master?.gainDb??0,effects:c.project!.master?.effects??[],...(duckingProvenance?{ducking:duckingProvenance}:{}),clippedSamples:mixed.clippedSamples,preClipPeakDbfs:'preClipPeakDbfs' in mixed?mixed.preClipPeakDbfs:null},stemAlignment:dynamics?'trim/pad to master frames; post-track, pre-master gain/effects/ducking':'zero-padded to master frames; post-track, pre-master processing'}}:{}),
    mix:{clippedSamples:mixed.clippedSamples,gm:production?'sum processed independent tracks':'full-score render',samples:'sum exported track PCM'},
    wav:wavIdentity(basename(paths.wav),mixed.bytes,mixed.frames),...(request.stems?{stems}:{}),
  }};
}
