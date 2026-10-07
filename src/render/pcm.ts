import { readWavInfo } from './wav.ts';

export const PCM_RATE = 44100;
export interface Pcm { frames: number; channels: number; samples: Int16Array }
export function decodePcm(bytes: Uint8Array): { pcm?: Pcm; error?: string } {
  const parsed = readWavInfo(bytes);
  if (!parsed.ok) return { error: parsed.error };
  const info = parsed.info;
  if (info.formatTag !== 1 || ![1,2].includes(info.channels) || info.sampleRate !== PCM_RATE || info.bitsPerSample !== 16 || info.frames < 1)
    return { error: 'Expected RIFF/WAVE PCM signed 16-bit little-endian, mono or stereo, 44100 Hz, at least one frame. No resampling is performed.' };
  const buffer = Buffer.from(bytes), samples = new Int16Array(info.frames * info.channels);
  for (let i=0; i<samples.length; i++) samples[i]=buffer.readInt16LE(info.dataOffset+i*2);
  return { pcm:{frames:info.frames, channels:info.channels, samples} };
}
export function encodePcm(samples: Int16Array): Buffer {
  const dataBytes = samples.length*2, bytes = Buffer.alloc(44+dataBytes);
  bytes.write('RIFF'); bytes.writeUInt32LE(36+dataBytes,4); bytes.write('WAVEfmt ',8);
  bytes.writeUInt32LE(16,16); bytes.writeUInt16LE(1,20); bytes.writeUInt16LE(2,22);
  bytes.writeUInt32LE(PCM_RATE,24); bytes.writeUInt32LE(PCM_RATE*4,28);
  bytes.writeUInt16LE(4,32); bytes.writeUInt16LE(16,34); bytes.write('data',36); bytes.writeUInt32LE(dataBytes,40);
  for(let i=0;i<samples.length;i++) bytes.writeInt16LE(samples[i]!,44+i*2);
  return bytes;
}
export interface PcmTrigger { frame: number; velocity: number; pcm: Pcm }
// Integer per-voice quantization makes addition order-independent. Saturate once per output.
// Explicit resource limit keeps large valid musical timelines from exhausting the process.
export const MAX_PCM_FRAMES = PCM_RATE * 600;
export function mixPcm(triggers: PcmTrigger[], minimumFrames: number): { bytes: Buffer; frames: number; clippedSamples: number } {
  const frames = triggers.reduce((end,t)=>Math.max(end,t.frame+t.pcm.frames),minimumFrames);
  if (!Number.isSafeInteger(frames) || frames < 1 || frames > MAX_PCM_FRAMES) throw new RangeError('Sample rendering supports at most 600 seconds including tails.');
  const sum = new Float64Array(frames*2);
  for(const trigger of triggers) {
    const {pcm,frame,velocity} = trigger;
    for(let i=0;i<pcm.frames;i++) for(let c=0;c<2;c++) {
      const sample=pcm.samples[i*pcm.channels+(pcm.channels===1?0:c)]!;
      sum[(frame+i)*2+c]! += Math.round(sample*velocity);
    }
  }
  let clippedSamples=0;
  const samples=new Int16Array(sum.length);
  for(let i=0;i<sum.length;i++) {
    const value=sum[i]!;
    if(value < -32768 || value > 32767)clippedSamples++;
    samples[i]=Math.max(-32768,Math.min(32767,value));
  }
  return {bytes:encodePcm(samples),frames,clippedSamples};
}
export const pcmRenderer = {name:'daemonv12-pcm',version:'1',settings:{sampleRate:PCM_RATE,channels:2,bitsPerSample:16,velocity:'round(sample * velocity)',mix:'integer sum, saturate s16',resampling:false}};
