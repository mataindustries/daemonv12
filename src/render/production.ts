// Deterministic PCM production operations. Values use signed-16 sample units until export.
import { encodePcm, PCM_RATE, MAX_PCM_FRAMES, type Pcm, type PcmTrigger } from './pcm.ts';
export function gainAmplitude(db: number): number {
  if (!Number.isFinite(db) || db < -60 || db > 12) throw new RangeError('gainDb must be -60 through 12.');
  return 10 ** (db / 20);
}
// Linear stereo balance: center preserves both channels; extremes silence the opposite channel.
export function balance(pan: number): [number, number] {
  if (!Number.isFinite(pan) || pan < -1 || pan > 1) throw new RangeError('pan must be -1 through 1.');
  return [1 - Math.max(0, pan), 1 + Math.min(0, pan)];
}
export function gainPan(samples: Float64Array, gainDb = 0, pan = 0): Float64Array {
  const gain = gainAmplitude(gainDb), [left, right] = balance(pan);
  return samples.map((v, i) => v * gain * (i % 2 ? right : left));
}
export function sumFloat(triggers: PcmTrigger[], minimumFrames: number, maximumFrames = Infinity): Float64Array {
  const frames = Math.min(maximumFrames, triggers.reduce((end, t) => Math.max(end, t.frame + t.pcm.frames), minimumFrames));
  if (!Number.isSafeInteger(frames) || frames < 1 || frames > MAX_PCM_FRAMES) throw new RangeError('Production rendering supports at most 600 seconds including tails.');
  const sum = new Float64Array(frames * 2);
  for (const { pcm, frame, velocity } of triggers) {
    for (let i = 0; i < Math.min(pcm.frames, frames-frame); i++) for (let c = 0; c < 2; c++) {
      sum[(frame + i) * 2 + c]! += Math.round(pcm.samples[i * pcm.channels + (pcm.channels === 1 ? 0 : c)]! * velocity);
    }
  }
  return sum;
}
export interface FrameAutomationPoint { frame: number; value: number; transition: 'step' | 'linear' }
// A point's transition describes its outgoing segment. Before the first point use static mix;
// after the last, hold. A linear gain segment interpolates dB before converting to amplitude.
export function automatedGainPan(samples: Float64Array, gainDb = 0, pan = 0,
  automation: {gainDb?: FrameAutomationPoint[]; pan?: FrameAutomationPoint[]} = {}): Float64Array {
  function lane(points: FrameAutomationPoint[] | undefined, fallback: number) {
    let index=-1;
    return (frame:number) => {
      if(!points?.length)return fallback;
      while(index+1<points.length && points[index+1]!.frame<=frame)index++;
      if(index<0)return fallback;
      const point=points[index]!,next=points[index+1];
      return point.transition==='linear' && next ? point.value+(next.value-point.value)*(frame-point.frame)/(next.frame-point.frame) : point.value;
    };
  }
  if(!automation.gainDb && !automation.pan)return gainPan(samples,gainDb,pan);
  const gain=lane(automation.gainDb,gainDb),position=lane(automation.pan,pan),output=new Float64Array(samples.length);
  for(let frame=0;frame<samples.length/2;frame++) {
    const amplitude=gainAmplitude(gain(frame)),[left,right]=balance(position(frame));
    output[frame*2]=samples[frame*2]!*amplitude*left;
    output[frame*2+1]=samples[frame*2+1]!*amplitude*right;
  }
  return output;
}
export function fitFloat(samples:Float64Array,frames:number):Float64Array {
  if(!Number.isSafeInteger(frames)||frames<1||frames>MAX_PCM_FRAMES)throw new RangeError('Invalid production frame boundary.');
  if(samples.length===frames*2)return samples;
  const output=new Float64Array(frames*2);
  output.set(samples.subarray(0,frames*2));return output;
}
export function quantize(samples: Float64Array): { bytes: Buffer; frames: number; clippedSamples: number; preClipPeakDbfs: number | null } {
  let clippedSamples = 0, peak = 0;
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i]!;
    if (!Number.isFinite(v)) throw new RangeError('Non-finite processed audio.');
    const rounded = Math.round(v);
    if (rounded < -32768 || rounded > 32767) clippedSamples++;
    peak = Math.max(peak, Math.abs(v));
    pcm[i] = Math.max(-32768, Math.min(32767, rounded));
  }
  return { bytes: encodePcm(pcm), frames: samples.length / 2, clippedSamples, preClipPeakDbfs: dbfs(peak / 32768) };
}
export function dbfs(amplitude: number): number | null {
  return amplitude === 0 ? null : Number((20 * Math.log10(amplitude)).toFixed(6));
}
export function padPcm(pcm: Pcm, frames: number): Buffer {
  const samples = new Int16Array(frames * 2);
  samples.set(pcm.samples.subarray(0,frames*2));
  return encodePcm(samples);
}
export const productionRenderer = { name: 'daemonv12-production', version: '1', settings: {
  sampleRate: PCM_RATE, channels: 2, bitsPerSample: 16, panLaw: 'linear stereo balance; unity center',
  order: 'track gain, pan, ordered effects, s16 stems; sum, master gain, ordered effects, s16 master',
  normalization: false, dither: false,
} };
export const dynamicsRenderer = {name:'daemonv12-production',version:'2',settings:{
  ...productionRenderer.settings,
  order:'source and tail cap, track gain/pan automation, ordered track effects, tail cap, s16 track elements; sum, master gain, ordered master effects, tail cap and final trim/pad, VO ducking, s16 master; trim/pad pre-master stems to master frames',
  automation:'absolute values; step or outgoing linear segment; gain interpolated in dB; rounded sample positions',
  reverb:'schroeder-4-comb-2-allpass-v1; finite RT60 tail',saturation:'tanh-v1; no output compensation',
  ducking:'trailing 20ms channel-energy RMS; threshold gate; exponential reduction in dB; v1',
} };
