import { spawn } from 'node:child_process';
import { rmSync, renameSync } from 'node:fs';
import { diagnostic, type Diagnostic, type Parsed } from '../diagnostics.ts';
import type { AudioRenderer, RendererOptions, RenderOutcome, RenderRequest } from './renderer.ts';
import { readWavInfo } from './wav.ts';
import { executablePath } from './environment.ts';
const settings = { sampleRate:44100, sampleFormat:'s16', channels:2, gain:0.5, reverb:false, chorus:false, cpuCores:1 };
const errorPattern=/error|panic|not a soundfont or midi file|no midi file specified/i;
export function buildArgs(soundfont: string, midi: string, tmp: string): string[] {
  return ['-n','-i','-F',tmp,'-T','wav','-O','s16','-r','44100','-g','0.5','-R','0','-C','0','-o','synth.cpu-cores=1',soundfont,midi];
}
interface ProcessResult { exitCode:number|null; stdout:string; stderr:string; error?:NodeJS.ErrnoException; timedOut:boolean; errorLine:boolean }
function invoke(exe:string,args:string[],env:NodeJS.ProcessEnv,timeout:number):Promise<ProcessResult> {
  return new Promise(resolve=>{
    const result:ProcessResult={exitCode:null,stdout:'',stderr:'',timedOut:false,errorLine:false};
    let child;
    try {child=spawn(exe,args,{env,shell:false,stdio:['ignore','pipe','pipe']});}
    catch(error){result.error=error as NodeJS.ErrnoException;resolve(result);return;}
    const timer=setTimeout(()=>{result.timedOut=true;child.kill('SIGKILL');},timeout);
    let tail='';
    child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    child.stdout.on('data',(s:string)=>{result.stdout=(result.stdout+s).slice(0,20000);});
    child.stderr.on('data',(s:string)=>{result.stderr=(result.stderr+s).slice(0,2000);result.errorLine ||= errorPattern.test(tail+s);tail=(tail+s).slice(-100);});
    child.on('error',(error:NodeJS.ErrnoException)=>{result.error=error;});
    child.on('close',code=>{clearTimeout(timer);result.exitCode=code;resolve(result);});
  });
}
function commandLine(exe:string,args:string[]):string {
  return [exe,...args].map(s=>`'${s.replaceAll("'", "'\\''")}'`).join(' ');
}
function failure(exe:string,args:string[],result:ProcessResult,reason:string):Diagnostic {
  const d=diagnostic('RENDERER_FAILED','',{exitCode:result.exitCode,stderr:result.stderr},'successful renderer with valid WAV output',commandLine(exe,args));
  d.message=reason;return d;
}
export function fluidSynthCommand(env:NodeJS.ProcessEnv):string { return env.DAEMONV12_FLUIDSYNTH || 'fluidsynth'; }
export async function probeFluidSynth(options:{env:NodeJS.ProcessEnv;probeTimeoutMs?:number}):Promise<Parsed<{command:string;path:string|null;version:string}>> {
  const exe=fluidSynthCommand(options.env);
  const probe=await invoke(exe,['--version'],options.env,options.probeTimeoutMs??10000);
  if(probe.error?.code==='ENOENT')return {diagnostic:diagnostic('RENDERER_NOT_FOUND','',exe,'installed renderer','Run ./scripts/bootstrap-audio-tools.sh on supported Linux, install fluidsynth with your OS package manager, or set DAEMONV12_FLUIDSYNTH.')};
  if(probe.error||probe.timedOut||probe.exitCode!==0)return {diagnostic:failure(exe,['--version'],probe,probe.timedOut?'Renderer probe timed out.':`Renderer probe failed: ${probe.error?.message??`exit ${probe.exitCode}`}.`)};
  const version=/version\s+(\d+\.\d+\.\d+)/i.exec(probe.stdout)?.[1]??'unknown';
  return {value:{command:exe,path:executablePath(exe,options.env),version}};
}
export async function createFluidSynthRenderer(options:RendererOptions):Promise<Parsed<AudioRenderer>> {
  const probe=await probeFluidSynth(options);
  if(probe.diagnostic)return probe;
  const exe=probe.value.command,version=probe.value.version;
  return {value:{name:'fluidsynth',async render(request:RenderRequest):Promise<RenderOutcome>{
    const tmp=request.wavPath+'.tmp',args=buildArgs(options.soundfont.path,request.midiPath,tmp);
    let result:ProcessResult={exitCode:null,stdout:'',stderr:'',timedOut:false,errorLine:false};
    let reason:string|undefined;
    try {
      rmSync(tmp,{force:true});rmSync(request.wavPath,{force:true});
      result=await invoke(exe,args,options.env,options.timeoutMs??120000);
      if(result.error)reason=`Renderer spawn failed: ${result.error.message}`;
      else if(result.timedOut)reason='Renderer timed out.';
      else if(result.exitCode!==0)reason=`Renderer exited with code ${result.exitCode}.`;
      else if(result.errorLine)reason='Renderer reported an error on stderr.';
      else {
        const wav=readWavInfo(tmp);
        if(!wav.ok)reason=`Missing or invalid renderer output: ${wav.error}`;
        else if(wav.info.formatTag!==1||wav.info.channels!==2||wav.info.sampleRate!==44100||wav.info.bitsPerSample!==16||wav.info.frames<1)reason='Renderer output must be PCM s16 stereo at 44100 Hz with at least one frame.';
        else {renameSync(tmp,request.wavPath);return {ok:true,renderer:{name:'fluidsynth',version,settings:{...settings}},wav:{frames:wav.info.frames,sampleRate:wav.info.sampleRate,channels:wav.info.channels,bitsPerSample:wav.info.bitsPerSample}};}
      }
    } catch(error) {reason=`Renderer output failed: ${error instanceof Error?error.message:String(error)}`;}
    for(const file of [tmp,request.wavPath])try{rmSync(file,{force:true});}catch(error){reason+=` Cleanup failed: ${error instanceof Error?error.message:String(error)}`;}
    return {ok:false,diagnostic:failure(exe,args,result,reason!)};
  }}};
}
