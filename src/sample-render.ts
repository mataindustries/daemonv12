// Sample-aware orchestration. Render modules receive PCM/frame requests, never projects.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync, rmSync, rmdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { decodePcm, mixPcm, pcmRenderer, PCM_RATE, MAX_PCM_FRAMES, type AudioProcessor, gainPan, sumFloat, quantize, padPcm, productionRenderer, type PcmTrigger, type AudioRenderer, type Soundfont } from './render/index.ts';
import { ticksToFrames, ticksToSeconds } from './timing/musical-time.ts';
import { encodeSmf } from './midi/smf.ts';
import { diagnostic, type Diagnostic } from './diagnostics.ts';
import { ENGINE_VERSION } from './version.ts';
import type { Compilation } from './pipeline.ts';

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
export async function renderSampledProject(request:Request):Promise<{manifest?:Record<string,unknown>;diagnostics:Diagnostic[]}> {
  const {compilation:c,path,paths,stemDir,midi,renderer,soundfont}=request;
  const production=!!request.processor;
  const processedTracks:Record<string,unknown>[]=[];
  const timeline=c.timeline!,diagnostics:Diagnostic[]=[],stems:Record<string,unknown>[]=[];
  const minimumFrames=ticksToFrames(timeline.endTick,timeline.usPerQuarter,PCM_RATE,true);
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
    const processed=await request.processor!.effects(gainPan(samples,track.mix?.gainDb,track.mix?.pan),track.effects??[]);
    if(processed.diagnostic) {diagnostics.push({...processed.diagnostic,path:`tracks[${index}]`});return null;}
    const output=quantize(processed.value);
    processedTracks.push({trackId:track.id,gainDb:track.mix?.gainDb??0,pan:track.mix?.pan??0,effects:track.effects??[],clippedSamples:output.clippedSamples,preClipPeakDbfs:output.preClipPeakDbfs});
    master.push({frame:0,velocity:1,pcm:decodePcm(output.bytes).pcm!});
    return output;
  }
  const sampleTracks:Record<string,unknown>[]=[];
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
        if(frames>MAX_PCM_FRAMES)return {diagnostics:[diagnostic('RENDERER_FAILED',`tracks[${track.index}]`,frames,'at most 600 seconds including tails')]};
        const processed=await processTrack(sumFloat([{frame:0,velocity:1,pcm:decodePcm(bytes).pcm!}],minimumFrames),track.index);
        if(!processed)return {diagnostics};
        bytes=processed.bytes;frames=processed.frames;write(wavPath,bytes);gmRenderer=rendered.renderer;
      }
      stems.push({trackId:track.id,trackIndex:track.index,midi:{sha256:hash(stemMidi),bytes:stemMidi.length,notes:track.notes.length},renderer:rendered.renderer,wav:wavIdentity(`${basename(stemDir)}/${file}`,bytes,frames)});
      rmSync(midiPath);continue;
    }
    const instrument=track.instrument;
    const triggers=track.notes.map(note=>{
      const file=instrument.type==='sampler'?instrument.sample:c.kits!.get(instrument.kit)!.find(e=>e.pitch===note.pitch)!.sample;
      return {file,tick:note.tick,frame:ticksToFrames(note.tick,timeline.usPerQuarter),velocity:note.velocity,pcm:c.assets!.get(file)!.pcm!};
    });
    if(triggers.some(t=>t.frame+t.pcm.frames>MAX_PCM_FRAMES))return {diagnostics:[diagnostic('RENDERER_FAILED',`tracks[${track.index}]`,undefined,'sample render of at most 600 seconds including tails')]};
    const mixed=production?await processTrack(sumFloat(triggers,minimumFrames),track.index):mixPcm(triggers,minimumFrames);
    if(!mixed)return {diagnostics};
    // The master sums the same quantized track PCM exported as stems. GM remains one
    // full-score FluidSynth render, preserving the V0.1 master/stem relationship.
    if(!production)master.push({frame:0,velocity:1,pcm:decodePcm(mixed.bytes).pcm!});
    const source={instrument,triggers:triggers.map(({file,tick,frame,velocity})=>({file,tick,frame,velocity})),clippedSamples:mixed.clippedSamples};
    sampleTracks.push({trackId:track.id,trackIndex:track.index,...source});
    if(request.stems || production) {
      write(wavPath,mixed.bytes);
      stems.push({trackId:track.id,trackIndex:track.index,sample:source,renderer:pcmRenderer,wav:wavIdentity(`${basename(stemDir)}/${file}`,mixed.bytes,mixed.frames)});
    }
  }
  if(master.some(t=>t.pcm.frames>MAX_PCM_FRAMES))return {diagnostics:[diagnostic('RENDERER_FAILED','',undefined,'sample render of at most 600 seconds including tails')]};
  let mixed;
  if(production) {
    const settings=c.project!.master;
    const output=await request.processor!.effects(gainPan(sumFloat(master,minimumFrames),settings?.gainDb),settings?.effects??[]);
    if(output.diagnostic)return {diagnostics:[output.diagnostic]};
    mixed=quantize(output.value);
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
    renderer:production?productionRenderer:pcmRenderer,gmRenderer,gmSource,
    soundfont:soundfont?{file:soundfont.file,sha256:soundfont.sha256,bytes:soundfont.bytes}:null,
    samples:{timing:'nearest frame, ties later; ceil project end; absolute tick * usPerQuarter * 44100 / 960000000',
      assets:Array.from(c.assets!).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([file,asset])=>({file,sha256:hash(asset.bytes),bytes:asset.bytes.length,...(asset.pcm?{frames:asset.pcm.frames,channels:asset.pcm.channels,sampleRate:PCM_RATE,bitsPerSample:16}:{kind:'drumkit'})})),tracks:sampleTracks},
    ...(production?{production:{processor:request.processor!.identity,tracks:processedTracks,master:{gainDb:c.project!.master?.gainDb??0,effects:c.project!.master?.effects??[],clippedSamples:mixed.clippedSamples,preClipPeakDbfs:'preClipPeakDbfs' in mixed?mixed.preClipPeakDbfs:null},stemAlignment:'zero-padded to master frames; post-track, pre-master processing'}}:{}),
    mix:{clippedSamples:mixed.clippedSamples,gm:production?'sum processed independent tracks':'full-score render',samples:'sum exported track PCM'},
    wav:wavIdentity(basename(paths.wav),mixed.bytes,mixed.frames),...(request.stems?{stems}:{}),
  }};
}
