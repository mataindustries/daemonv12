// The only module that knows FFmpeg executable selection, filters, flags and output syntax.
import { spawn } from 'node:child_process';
import { readFileSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { diagnostic, type Diagnostic, type Parsed } from '../diagnostics.ts';
import { MAX_PCM_FRAMES } from './pcm.ts';
export type AudioEffect = { type: 'highpass' | 'lowpass'; frequencyHz: number } | { type: 'delay'; timeMs: number; wet: number };
export interface AudioProcessor {
  identity: { name: string; version: string };
  effects(samples: Float64Array, effects: AudioEffect[]): Promise<Parsed<Float64Array>>;
  loudness(path: string): Promise<Parsed<{ integratedLufs: number | null; loudnessRangeLu: number | null; truePeakDbfs: number | null }>>;
  mp3(input: string, output: string): Promise<Parsed<{ codec: string; bitrateKbps: number }>>;
}
export function effectFilters(effects: AudioEffect[]): string {
  if (effects.length > 8) throw new RangeError('At most 8 effects.');
  return effects.map(effect => {
    if (effect.type === 'highpass' || effect.type === 'lowpass') {
      if (!Number.isFinite(effect.frequencyHz) || effect.frequencyHz < 20 || effect.frequencyHz > 20000) throw new RangeError('Invalid filter frequency.');
      return `${effect.type}=f=${effect.frequencyHz}:p=2:r=f64`;
    }
    if (effect.type !== 'delay' || !Number.isFinite(effect.timeMs) || effect.timeMs < 1 || effect.timeMs > 2000 || !Number.isFinite(effect.wet) || effect.wet < 0 || effect.wet > 0.5) throw new RangeError('Invalid delay.');
    return `aecho=1:1:${effect.timeMs}:${effect.wet}`;
  }).join(',');
}
export async function createAudioProcessor(options: { env: NodeJS.ProcessEnv; timeoutMs?: number }): Promise<Parsed<AudioProcessor>> {
  const exe = options.env.DAEMONV12_FFMPEG || 'ffmpeg';
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
  const probe = await invoke(['-version']);
  if (probe.diagnostic) return probe;
  const version = /ffmpeg version ([^\s]+)/.exec(probe.value.stdout.toString())?.[1];
  if (!version) return { diagnostic: diagnostic('AUDIO_PROCESSING_FAILED', '', 'invalid version response', 'FFmpeg version') };
  const base = ['-hide_banner', '-nostdin', '-nostats', '-threads', '1', '-filter_threads', '1'];
  return { value: {
    identity: { name: 'ffmpeg', version },
    async effects(samples, effects) {
      if (!effects.length) return { value: samples };
      const input = Buffer.alloc(samples.length * 8);
      for (let i = 0; i < samples.length; i++) input.writeDoubleLE(samples[i]! / 32768, i * 8);
      const result = await invoke([...base, '-f', 'f64le', '-ar', '44100', '-ac', '2', '-i', 'pipe:0', '-af', effectFilters(effects), '-c:a', 'pcm_f64le', '-f', 'f64le', 'pipe:1'], input, MAX_PCM_FRAMES * 16);
      if (result.diagnostic) return result;
      const bytes = result.value.stdout;
      if (!bytes.length || bytes.length % 16) return { diagnostic: diagnostic('AUDIO_PROCESSING_FAILED', '', bytes.length, 'complete nonempty stereo float audio') };
      const output = new Float64Array(bytes.length / 8);
      for (let i = 0; i < output.length; i++) {
        output[i] = bytes.readDoubleLE(i * 8) * 32768;
        if (!Number.isFinite(output[i])) return { diagnostic: diagnostic('AUDIO_PROCESSING_FAILED', '', 'non-finite audio', 'finite processed samples') };
      }
      return { value: output };
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
