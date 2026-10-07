import { createHash } from 'node:crypto';
import { resolveSoundfont, createDefaultRenderer, type AudioRenderer, type Soundfont } from './render/index.ts';
import { readFileSync, mkdirSync, rmSync, renameSync, writeFileSync, lstatSync, readdirSync, rmdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { ENGINE_VERSION } from './version.ts';
import { encodeSmf } from './midi/smf.ts';
import { capDiagnostics, exitCodeFor, diagnostic, type Diagnostic } from './diagnostics.ts';
import { loadProject, parseProjectText, type LoadResult } from './project/load.ts';
import { validateProject } from './project/validate.ts';
import type { Project } from './project/types.ts';
import { resolve } from './timing/resolve.ts';
import { ticksToSeconds } from './timing/musical-time.ts';
import type { Timeline } from './timing/timeline.ts';
import { loadKits, readAsset, outputInAssets } from './project/assets.ts';
import { type Kits } from './project/sample-schema.ts';
import { createAudioProcessor, analyzeWav, type AudioProcessor, type AudioAnalysis, decodePcm, type Pcm } from './render/index.ts';
import { renderSampledProject } from './sample-render.ts';
export interface Compilation {
  diagnostics: Diagnostic[]; omitted?: number; project: Project | null; timeline: Timeline | null; projectBytes?: Uint8Array;
  kits?: Kits; assets?: Map<string, {bytes:Buffer; pcm?:Pcm}>;
}
function compile(loaded: LoadResult, kits: Kits = new Map()): Compilation {
  if (loaded.diagnostics.length) return { diagnostics: loaded.diagnostics, project: null, timeline: null };
  const validated = validateProject(loaded.value, kits);
  const resolved = validated.project ? resolve(validated.project) : { timeline: null, diagnostics: [] };
  return { ...capDiagnostics([...validated.diagnostics, ...resolved.diagnostics]), project: validated.project,
    timeline: resolved.timeline, ...(loaded.bytes ? { projectBytes: loaded.bytes } : {}) };
}
export function compileProjectText(text: string, kits: Kits = new Map()): Compilation { return compile(parseProjectText(text), kits); }
export function compileProjectFile(path: string): Compilation {
  const loaded=loadProject(path);
  if (loaded.diagnostics.length || (loaded.value as {formatVersion?:unknown}|null)?.formatVersion !== 1) return compile(loaded);
  const kitData=loadKits(loaded.value,path);
  if (kitData.diagnostics.length) return {project:null,timeline:null,...capDiagnostics(kitData.diagnostics)};
  const compilation=compile(loaded,kitData.kits);
  if (!compilation.project || !compilation.timeline) return compilation;
  const assets=new Map<string,{bytes:Buffer;pcm?:Pcm}>(Array.from(kitData.files,([file,bytes])=>[file,{bytes}]));
  for (const [i,track] of compilation.project.tracks.entries()) {
    const instrument=track.instrument;
    const files=instrument.type==='sampler'?[instrument.sample]:instrument.type==='drumkit'?kitData.kits.get(instrument.kit)!.map(e=>e.sample):[];
    for(const file of files) {
      if(assets.get(file)?.pcm)continue;
      const at=`tracks[${i}].instrument`,read=readAsset(path,file,at);
      if(read.diagnostic)compilation.diagnostics.push(read.diagnostic);
      else {
        const decoded=decodePcm(read.bytes!);
        if(decoded.error) compilation.diagnostics.push(diagnostic('UNSUPPORTED_WAV',at,file,decoded.error));
        else assets.set(file,{bytes:read.bytes!,pcm:decoded.pcm!});
      }
    }
  }
  if(compilation.diagnostics.some(d=>d.severity==='error'))compilation.timeline=null;
  return {...compilation,kits:kitData.kits,assets,...capDiagnostics(compilation.diagnostics)};
}
export function summarize(project: Project, timeline: Timeline) {
  return { title: project.title, bars: project.bars, timeSignature: `${project.timeSignature.numerator}/${project.timeSignature.denominator}`,
    bpm: project.bpm, key: project.key?.text ?? null, tracks: timeline.tracks.length,
    notes: timeline.tracks.reduce((sum, track) => sum + track.notes.length, 0), durationTicks: timeline.endTick,
    durationSeconds: Number(ticksToSeconds(timeline.endTick, timeline.usPerQuarter).toFixed(6)) };
}

export type Command = 'validate' | 'midi' | 'render' | 'analyze';
export interface CommandOptions { outDir?: string; soundfont?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number; stems?: boolean; format?: 'wav' | 'mp3' | 'wav,mp3' }
export interface CommandResult {
  ok: boolean; command: Command | null; engineVersion: string; project: string | null;
  errors: Diagnostic[]; warnings: Diagnostic[]; summary: ReturnType<typeof summarize> | null;
  analysis?: AudioAnalysis | Record<string,unknown>;
  artifacts: { mp3?: string; analysis?: string; midi?: string; wav?: string; manifest?: string; stems?: { trackId: string; wav: string }[] }; manifest: Record<string, unknown> | null; omitted?: number;
}
export function resultFor(command: Command | null, path: string | null, diagnostics: Diagnostic[], summary: CommandResult['summary'] = null,
  omitted = 0): CommandResult {
  const capped = capDiagnostics(diagnostics);
  return { ok: !diagnostics.some(d=>d.severity==='error'), command, engineVersion: ENGINE_VERSION, project:path,
    errors:capped.diagnostics.filter(d=>d.severity==='error'), warnings:capped.diagnostics.filter(d=>d.severity==='warning'), summary,
    artifacts:{}, manifest:null, ...((omitted+(capped.omitted??0)) ? {omitted:omitted+(capped.omitted??0)} : {}) };
}
export function artifactPaths(projectPath: string, outDir: string) {
  const name = basename(projectPath).replace(/\.json$/i,'');
  return { midi:join(outDir,`${name}.mid`), wav:join(outDir,`${name}.wav`), manifest:join(outDir,`${name}.render.json`) };
}
function removeArtifacts(paths: string[]): Diagnostic[] {
  const diagnostics: Diagnostic[]=[];
  for (const path of paths) for (const file of [path,`${path}.tmp`]) {
    try { rmSync(file,{force:true}); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOTDIR') diagnostics.push(writeFailure(file,error));
    }
  }
  return diagnostics;
}
// IDs are already unique lowercase slugs. Escape Windows device basenames injectively;
// underscores cannot occur in a validated ID, so this never merges two identities.
export function stemFileName(trackId: string): string {
  return `${/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(trackId) ? '_' : ''}${trackId}.wav`;
}
function removeStems(directory: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  try {
    // Never follow a directory symlink or recursively delete an output-path collision.
    if (!lstatSync(directory).isDirectory()) return [writeFailure(directory, 'Expected a stem directory, not a file or symlink.')];
    for (const file of readdirSync(directory)) {
      if (!/^_?[a-z][a-z0-9-]*\.(wav|mid)(\.tmp)?$/.test(file)) continue;
      diagnostics.push(...removeArtifacts([join(directory, file)]));
    }
    rmdirSync(directory);
  } catch (error) {
    if (!['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) diagnostics.push(writeFailure(directory, error));
  }
  return diagnostics;
}
function writeFailure(path: string, error: unknown): Diagnostic {
  const d = diagnostic('OUTPUT_WRITE_FAILED','',path,'writable output path');
  d.message = `Cannot write or clean output ${JSON.stringify(path)}: ${error instanceof Error ? error.message : String(error)}`;
  return d;
}
function atomicWrite(path: string, data: string | Uint8Array): void {
  writeFileSync(`${path}.tmp`,data); renameSync(`${path}.tmp`,path);
}
export async function runCommand(command: Command, path: string, options: CommandOptions = {}): Promise<{ result: CommandResult; diagnostics: Diagnostic[]; exitCode: number; stack?: string }> {
  if(command==='analyze') {
    const basic=analyzeWav(path);const diagnostics:Diagnostic[]=[];
    let analysis:AudioAnalysis|undefined=basic.value;
    if(basic.diagnostic)diagnostics.push(basic.diagnostic);
    else {
      const probe=await createAudioProcessor({env:options.env??{},timeoutMs:options.timeoutMs});
      if(probe.diagnostic)diagnostics.push(probe.diagnostic);
      else {const loudness=await probe.value.loudness(path);if(loudness.diagnostic)diagnostics.push(loudness.diagnostic);else analysis={...basic.value,...loudness.value};}
    }
    const result=resultFor(command,path,diagnostics);
    if(result.ok)result.analysis=analysis;
    return {result,diagnostics,exitCode:exitCodeFor(diagnostics)};
  }
  const paths=artifactPaths(path,options.outDir??'renders');
  const mp3Path=paths.wav.replace(/\.wav$/,'.mp3'),analysisPath=paths.wav.replace(/\.wav$/,'.analysis.json');
  const stemDir=paths.wav.replace(/\.wav$/,'.stems');
  let protectedOutput=false;
  const cleanup=()=>protectedOutput?[writeFailure(options.outDir??'renders','Output must be outside the project assets directory.')]:[...removeArtifacts([...Object.values(paths),mp3Path,analysisPath]),...removeStems(stemDir)];
  let compilation: Compilation | undefined;
  let result = resultFor(command,path,[]);
  let stack: string | undefined;
  let diagnostics: Diagnostic[]=[];
  let failed=false;
  try {
    if(command!=='validate') {
      try { protectedOutput=outputInAssets(path,options.outDir??'renders'); }
      catch(error) { diagnostics.push(writeFailure(options.outDir??'renders',error));protectedOutput=true; }
    }
    compilation=compileProjectFile(path);
    diagnostics=[...compilation.diagnostics];
    result=resultFor(command,path,diagnostics,compilation.timeline?summarize(compilation.project!,compilation.timeline):null,compilation.omitted);
    failed=!compilation.timeline;
    if (!failed && command !== 'validate') {
      let soundfont: Soundfont | undefined;
      let renderer: AudioRenderer | undefined;
      let processor: AudioProcessor | undefined;
      const production=compilation.project!.master!==undefined || compilation.project!.tracks.some(t=>t.mix!==undefined || t.effects!==undefined);
      if(command==='render' && (production || options.format!==undefined)) {
        const probe=await createAudioProcessor({env:options.env??{},timeoutMs:options.timeoutMs});
        if(probe.diagnostic)diagnostics.push(probe.diagnostic);else processor=probe.value;
      }
      const hasSamples=compilation.timeline!.tracks.some(t=>t.instrument.type!=='gm');
      const hasGm=compilation.timeline!.tracks.some(t=>t.instrument.type==='gm');
      if (command === 'midi' && hasSamples) diagnostics.push({...diagnostic('SAMPLES_OMITTED','',undefined,'MIDI contains GM tracks only; use render for sampled audio'),severity:'warning'});
      if (command === 'render' && hasGm) {
        const sf = await resolveSoundfont({soundfont:options.soundfont,env:options.env??{}});
        if (sf.diagnostic) diagnostics.push(sf.diagnostic);
        else {
          soundfont=sf.value;
          const probe=await createDefaultRenderer({soundfont,env:options.env??{},timeoutMs:options.timeoutMs});
          if(probe.diagnostic)diagnostics.push(probe.diagnostic);else renderer=probe.value;
        }
      }
      diagnostics.push(...cleanup());
      if (!diagnostics.some(d=>d.severity==='error')) {
        let outputPath=options.outDir??'renders';
        try {
          mkdirSync(options.outDir??'renders',{recursive:true});
          const midi=encodeSmf(compilation.timeline!);
          outputPath=paths.midi;
          atomicWrite(paths.midi,midi);result.artifacts.midi=paths.midi;
          if(command === 'render' && (hasSamples || production)) {
            const sampled=await renderSampledProject({compilation,path,paths,stemDir,midi,stems:!!options.stems,renderer,soundfont,stemFileName,processor:production?processor:undefined});
            diagnostics.push(...sampled.diagnostics);
            if(sampled.manifest) {
              outputPath=paths.manifest;
              result.manifest=sampled.manifest;
              result.artifacts={...paths,...(options.stems?{stems:compilation.timeline!.tracks.map(t=>({trackId:t.id,wav:join(stemDir,stemFileName(t.id))}))}:{})};
            }
          } else if(renderer && soundfont) {
            const rendered=await renderer.render({midiPath:paths.midi,wavPath:paths.wav});
            if(!rendered.ok)diagnostics.push(rendered.diagnostic);
            else {
              outputPath=paths.wav;
              const wav=readFileSync(paths.wav);
              const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
              const summary=result.summary!;
              const manifest={
                engine:{name:'daemonv12',version:ENGINE_VERSION},
                project:{file:basename(path),sha256:hash(compilation.projectBytes!),formatVersion:1,seed:compilation.project!.seed},
                midi:{file:basename(paths.midi),sha256:hash(midi),bytes:midi.length,ppq:compilation.timeline!.ppq,durationTicks:summary.durationTicks,durationSeconds:summary.durationSeconds,notes:summary.notes},
                renderer:rendered.renderer,
                soundfont:{file:soundfont.file,sha256:soundfont.sha256,bytes:soundfont.bytes},
                wav:{file:basename(paths.wav),sha256:hash(wav),bytes:wav.length,frames:rendered.wav.frames,durationSeconds:Number((rendered.wav.frames/rendered.wav.sampleRate).toFixed(6))},
              };
              const stems = [];
              if (options.stems) {
                outputPath=stemDir;
                mkdirSync(stemDir);
                for (const track of compilation.timeline!.tracks) {
                  const file=stemFileName(track.id), wavPath=join(stemDir,file);
                  const midiPath=join(stemDir,file.replace(/\.wav$/,'.mid'));
                  const stemMidi=encodeSmf(compilation.timeline!,track.id);
                  outputPath=midiPath;
                  atomicWrite(midiPath,stemMidi);
                  const stem=await renderer.render({midiPath,wavPath});
                  if (!stem.ok) {
                    diagnostics.push({...stem.diagnostic,path:`tracks[${track.index}]`});
                    break;
                  }
                  const duration=ticksToSeconds(compilation.timeline!.endTick,compilation.timeline!.usPerQuarter);
                  if (stem.wav.frames < Math.ceil(duration*stem.wav.sampleRate)) {
                    diagnostics.push(diagnostic('RENDERER_FAILED',`tracks[${track.index}]`,stem.wav.frames,
                      `stem covering the complete ${duration} second musical timeline`));
                    break;
                  }
                  outputPath=wavPath;
                  const bytes=readFileSync(wavPath);
                  stems.push({trackId:track.id,trackIndex:track.index,
                    midi:{sha256:hash(stemMidi),bytes:stemMidi.length,notes:track.notes.length},
                    renderer:stem.renderer,
                    wav:{file:`${basename(stemDir)}/${file}`,sha256:hash(bytes),bytes:bytes.length,
                      ...stem.wav,durationSeconds:Number((stem.wav.frames/stem.wav.sampleRate).toFixed(6))}});
                  rmSync(midiPath);
                }
              }
              if (!diagnostics.some(d=>d.severity==='error')) {
                const completeManifest=options.stems?{...manifest,stems}:manifest;
                outputPath=paths.manifest;
                result.artifacts={...paths,...(options.stems?{stems:stems.map(stem=>({trackId:stem.trackId,wav:join(stemDir,stemFileName(stem.trackId))}))}:{})};result.manifest=completeManifest;
              }
            }
          }
          if(command==='render' && result.manifest && !diagnostics.some(d=>d.severity==='error')) {
            if(processor) {
              const analyze=async(file:string)=>{
                const basic=analyzeWav(file);if(basic.diagnostic){diagnostics.push(basic.diagnostic);return null;}
                const loudness=await processor.loudness(file);if(loudness.diagnostic){diagnostics.push(loudness.diagnostic);return null;}
                return {...basic.value,...loudness.value};
              };
              const master=await analyze(paths.wav),tracks=[];
              for(const stem of result.artifacts.stems??[]) {
                const analysis=await analyze(stem.wav);tracks.push({trackId:stem.trackId,analysis});
              }
              const report={master,tracks};
              result.manifest.audioTool=processor.identity;result.manifest.analysis=report;result.analysis=report;
              const processing=result.manifest.production as {tracks:{clippedSamples:number}[];master:{clippedSamples:number}}|undefined;
              if(master?.clipping || tracks.some(t=>t.analysis?.clipping) || processing?.master.clippedSamples || processing?.tracks.some(t=>t.clippedSamples))
                diagnostics.push({...diagnostic('AUDIO_CLIPPING','',undefined,'audio without overload','Reduce the affected track or master gain. See analysis and production clipping counts.'),severity:'warning'});
              if(options.format?.includes('mp3') && !diagnostics.some(d=>d.severity==='error')) {
                const exported=await processor.mp3(paths.wav,mp3Path);
                if(exported.diagnostic)diagnostics.push(exported.diagnostic);
                else {const bytes=readFileSync(mp3Path);result.manifest.mp3={file:basename(mp3Path),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,...exported.value};result.artifacts.mp3=mp3Path;}
              }
              if(!diagnostics.some(d=>d.severity==='error')) {outputPath=analysisPath;atomicWrite(analysisPath,JSON.stringify(report,null,2)+'\n');result.artifacts.analysis=analysisPath;}
            }
            if(!diagnostics.some(d=>d.severity==='error')) {outputPath=paths.manifest;atomicWrite(paths.manifest,JSON.stringify(result.manifest,null,2)+'\n');}
          }
        }
        catch(error) {
          // Only filesystem failures belong to the output error class. Bugs reach the outer handler.
          if (!/^E[A-Z]+$/.test((error as NodeJS.ErrnoException).code??'')) throw error;
          diagnostics.push(writeFailure(outputPath,error));
        }
      }
    }
  } catch(error) {
    diagnostics.push({code:'INTERNAL_ERROR',severity:'error',path:'',message:error instanceof Error?error.message:String(error)});
    stack=error instanceof Error?error.stack:undefined;
  }
  failed ||= diagnostics.some(d=>d.severity==='error');
  if (failed && command !== 'validate') diagnostics.push(...cleanup());
  const final=resultFor(command,path,diagnostics,result.summary,compilation?.omitted);
  final.ok=!failed;
  if (!failed) { final.artifacts=result.artifacts; final.manifest=result.manifest; if(result.analysis)final.analysis=result.analysis; }
  return {result:final,diagnostics:capDiagnostics(diagnostics).diagnostics,exitCode:Math.max(failed?1:0,exitCodeFor(diagnostics)),...(stack?{stack}:{})};
}
