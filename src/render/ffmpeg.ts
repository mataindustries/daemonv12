// The only module that knows FFmpeg executable selection, filters, flags and output syntax.
import { spawn } from 'node:child_process';
import { readFileSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { diagnostic, type Diagnostic, type Parsed } from '../diagnostics.ts';
import { MAX_PCM_FRAMES } from './pcm.ts';
import { executablePath } from './environment.ts';
import { validateEffect, type Effect } from '../audio-types.ts';
import { builtinEffect } from './dynamics.ts';
export type AudioEffect = Effect;
export interface AudioProcessor {
  identity: { name: string; version: string };
  effects(samples: Float64Array, effects: AudioEffect[], frameLimit?: number): Promise<Parsed<Float64Array>>;
  loudness(path: string): Promise<Parsed<{ integratedLufs: number | null; loudnessRangeLu: number | null; truePeakDbfs: number | null }>>;
  mp3(input: string, output: string): Promise<Parsed<{ codec: string; bitrateKbps: number }>>;
}
export function effectFilters(effects: AudioEffect[]): string {
  if (effects.length > 8) throw new RangeError('At most 8 effects.');
  return effects.map(effect => {
    validateEffect(effect);
    if (effect.type === 'highpass' || effect.type === 'lowpass') {
      return `${effect.type}=f=${effect.frequencyHz}:p=2:r=f64`;
    }
    if(effect.type==='delay')return `aecho=1:1:${effect.timeMs}:${effect.wet}`;
    if(effect.type==='compressor')return `acompressor=threshold=${10**(effect.thresholdDb/20)}:ratio=${effect.ratio}:attack=${effect.attackMs}:release=${effect.releaseMs}:makeup=${10**((effect.makeupGainDb??0)/20)}:knee=1:link=maximum:detection=rms`;
    throw new RangeError('Built-in effects do not have FFmpeg syntax.');
  }).join(',');
}
export function ffmpegCommand(env:NodeJS.ProcessEnv):string { return env.DAEMONV12_FFMPEG || 'ffmpeg'; }
function invocation(options: { env: NodeJS.ProcessEnv; timeoutMs?: number }) {
  const exe = ffmpegCommand(options.env);
  async function invoke(args: string[], input?: Buffer, limit = 65536): Promise<Parsed<{ stdout: Buffer; stderr: string }>> {
    return new Promise(resolveResult => {
      const child = spawn(exe, args, { env: options.env, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
      const chunks: Buffer[] = []; let bytes = 0, stderr = '', failure: string | undefined, missing = false;
      const timer = setTimeout(() => { failure = 'FFmpeg timed out.'; child.kill('SIGKILL'); }, options.timeoutMs ?? 120000);
      child.on('error', (error: NodeJS.ErrnoException) => { missing = error.code === 'ENOENT'; failure = error.message; });
      child.stdout.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > limit) { failure = 'FFmpeg output exceeds the audio resource limit.'; child.kill('SIGKILL'); } else chunks.push(chunk); });
      child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-16000); });
      child.stdin.on('error', () => { /* Early process exit is handled by close. */ });
      child.on('close', code => {
        clearTimeout(timer);
        if (failure || code !== 0) {
          const d = diagnostic(missing ? 'AUDIO_TOOL_NOT_FOUND' : 'AUDIO_PROCESSING_FAILED', '', { exitCode: code, reason: failure, stderr: stderr.slice(-2000) }, 'working FFmpeg with highpass, lowpass, aecho, loudnorm and libmp3lame', 'Install ffmpeg or set DAEMONV12_FFMPEG.');
          resolveResult({ diagnostic: d });
        } else resolveResult({ value: { stdout: Buffer.concat(chunks), stderr } });
      });
      child.stdin.end(input);
    });
  }
  return invoke;
}
async function ffmpegVersion(invoke:ReturnType<typeof invocation>):Promise<Parsed<string>> {
  const probe = await invoke(['-version']);
  if (probe.diagnostic) return probe;
  const version = /ffmpeg version ([^\s]+)/.exec(probe.value.stdout.toString())?.[1];
  if (!version) return { diagnostic: diagnostic('AUDIO_PROCESSING_FAILED', '', 'invalid version response', 'FFmpeg version') };
  return {value:version};
}
export async function inspectFfmpeg(options:{env:NodeJS.ProcessEnv;timeoutMs?:number}) {
  const invoke=invocation(options), command=ffmpegCommand(options.env);
  const version=await ffmpegVersion(invoke);
  if(version.diagnostic)return {command,path:executablePath(command,options.env),version:null,available:false,capabilities:{effects:false,mp3:false,loudnessAnalysis:false},diagnostic:version.diagnostic};
  const [filters,encoders]=await Promise.all([invoke(['-hide_banner','-filters'],undefined,1048576),invoke(['-hide_banner','-encoders'],undefined,1048576)]);
  const has=(text:string,name:string)=>new RegExp(`^\\s*[A-Z.]{3,6}\\s+${name}\\s`, 'm').test(text);
  const filterText=filters.value?.stdout.toString()??'',encoderText=encoders.value?.stdout.toString()??'';
  return {command,path:executablePath(command,options.env),version:version.value,available:true,
    capabilities:{effects:['highpass','lowpass','aecho','acompressor'].every(name=>has(filterText,name))&&has(encoderText,'pcm_f64le'),mp3:has(encoderText,'libmp3lame'),loudnessAnalysis:has(filterText,'loudnorm')},
    diagnostic:filters.diagnostic??encoders.diagnostic??null};
}
export async function createAudioProcessor(options: { env: NodeJS.ProcessEnv; timeoutMs?: number }): Promise<Parsed<AudioProcessor>> {
  const invoke=invocation(options),probe=await ffmpegVersion(invoke);
  if(probe.diagnostic)return probe;
  const version=probe.value;
  const base = ['-hide_banner', '-nostdin', '-nostats', '-threads', '1', '-filter_threads', '1'];
  return { value: {
    identity: { name: 'ffmpeg', version },
    async effects(samples, effects, frameLimit) {
      if (!effects.length) return { value: samples };
      async function processFfmpeg(samples:Float64Array,chain:AudioEffect[]):Promise<Parsed<Float64Array>> {
        const input = Buffer.alloc(samples.length * 8);
        for (let i = 0; i < samples.length; i++) input.writeDoubleLE(samples[i]! / 32768, i * 8);
        const filters=effectFilters(chain)+(frameLimit===undefined?'':`,atrim=end_sample=${frameLimit}`);
        const result = await invoke([...base, '-f', 'f64le', '-ar', '44100', '-ac', '2', '-i', 'pipe:0', '-af', filters, '-c:a', 'pcm_f64le', '-f', 'f64le', 'pipe:1'], input, MAX_PCM_FRAMES * 16);
        if (result.diagnostic) return result;
        const bytes = result.value.stdout;
        if (!bytes.length || bytes.length % 16) return { diagnostic: diagnostic('AUDIO_PROCESSING_FAILED', '', bytes.length, 'complete nonempty stereo float audio') };
        const output = new Float64Array(bytes.length / 8);
        for (let i = 0; i < output.length; i++) {
          output[i] = bytes.readDoubleLE(i * 8) * 32768;
          if (!Number.isFinite(output[i])) return { diagnostic: diagnostic('AUDIO_PROCESSING_FAILED', '', 'non-finite audio', 'finite processed samples') };
        }
        return { value: output };
      }
      try {
        if(effects.length>8)throw new RangeError('At most 8 effects.');
        let current=samples,chain:AudioEffect[]=[];
        for(const effect of effects) {
          validateEffect(effect);
          if(effect.type==='reverb'||effect.type==='saturation') {
            if(chain.length) {const result=await processFfmpeg(current,chain);if(result.diagnostic)return result;current=result.value;chain=[];}
            current=builtinEffect(current,effect,frameLimit??Infinity);
          } else chain.push(effect);
        }
        return chain.length?await processFfmpeg(current,chain):{value:current};
      } catch(error) {
        return {diagnostic:diagnostic('AUDIO_PROCESSING_FAILED','',String(error),'valid bounded effect chain')};
      }
    },
    async loudness(path) {
      const result = await invoke([...base, '-i', resolve(path), '-map', '0:a:0', '-af', 'loudnorm=print_format=json', '-f', 'null', '-']);
      if (result.diagnostic) return result;
      try {
        const text = result.value.stderr;
        const data = JSON.parse(text.slice(text.lastIndexOf('{'), text.lastIndexOf('}') + 1));
        const metric = (key: string): number | null => {
          const raw = data[key];
          if (raw === '-inf' || raw === 'inf') return null;
          if (typeof raw !== 'string' || raw.trim() === '' || !Number.isFinite(Number(raw))) throw new Error('Invalid metric');
          return Number(raw);
        };
        return { value: { integratedLufs: metric('input_i'), loudnessRangeLu: metric('input_lra'), truePeakDbfs: metric('input_tp') } };
      } catch { return { diagnostic: diagnostic('AUDIO_PROCESSING_FAILED', '', 'malformed loudness response', 'FFmpeg loudnorm input measurements') }; }
    },
    async mp3(input, output) {
      const tmp = output + '.tmp';
      const result = await invoke([...base, '-y', '-i', resolve(input), '-map', '0:a:0', '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100', '-ac', '2', '-f', 'mp3', resolve(tmp)]);
      let error: Diagnostic | undefined = result.diagnostic;
      if (!error) {
        try {
          const bytes = readFileSync(tmp);
          if (bytes.length < 100 || !(bytes.toString('ascii', 0, 3) === 'ID3' || (bytes[0] === 255 && (bytes[1]! & 224) === 224))) throw new Error('Missing or invalid MP3 output.');
          renameSync(tmp, output);
          return { value: { codec: 'libmp3lame', bitrateKbps: 192 } };
        } catch (e) { error = diagnostic('AUDIO_PROCESSING_FAILED', '', String(e), 'valid MP3 output'); }
      }
      rmSync(tmp, { force: true });
      return { diagnostic: error! };
    },
  } };
}
