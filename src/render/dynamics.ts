import type { DuckingSettings, Effect } from '../audio-types.ts';
import { validateEffect } from '../audio-types.ts';
import { MAX_PCM_FRAMES, PCM_RATE, type Pcm } from './pcm.ts';

export function duckingEnvelope(reference: Pcm, frames: number, settings: DuckingSettings) {
  const {amountDb,thresholdDb,attackMs,releaseMs}=settings;
  for(const [value,min,max] of [[amountDb,0,36],[thresholdDb,-60,0],[attackMs,1,2000],[releaseMs,10,9000]] as const)
    if(!Number.isFinite(value)||value<min||value>max)throw new RangeError('Invalid ducking settings.');
  if(!Number.isSafeInteger(frames)||frames<1||frames>MAX_PCM_FRAMES)throw new RangeError('Invalid ducking duration.');
  const windowFrames=Math.round(PCM_RATE*0.02),ring=new Float64Array(windowFrames),reductionDb=new Float64Array(frames);
  const thresholdEnergy=10**(thresholdDb/10),attack=1-Math.exp(-1/(attackMs*PCM_RATE/1000)),release=1-Math.exp(-1/(releaseMs*PCM_RATE/1000));
  let energy=0,reduction=0,activeFrames=0,maximumReductionDb=0;
  for(let frame=0;frame<frames;frame++) {
    let current=0;
    if(frame<reference.frames)for(let c=0;c<reference.channels;c++)current+=(reference.samples[frame*reference.channels+c]!/32768)**2/reference.channels;
    const slot=frame%windowFrames;
    energy+=current-ring[slot]!;ring[slot]=current;
    const active=Math.max(0,energy)/windowFrames>=thresholdEnergy;
    if(active)activeFrames++;
    const target=active?amountDb:0;
    reduction+=(target-reduction)*(target>reduction?attack:release);
    reductionDb[frame]=reduction;maximumReductionDb=Math.max(maximumReductionDb,reduction);
  }
  return {reductionDb,metrics:{windowMs:20,activeFrames,maximumReductionDb:Number(maximumReductionDb.toFixed(6))}};
}
export function applyDucking(samples:Float64Array,reference:Pcm,settings:DuckingSettings) {
  const {reductionDb,metrics}=duckingEnvelope(reference,samples.length/2,settings);
  const output=new Float64Array(samples.length);
  for(let frame=0;frame<reductionDb.length;frame++) {
    const gain=10**(-reductionDb[frame]!/20);
    output[frame*2]=samples[frame*2]!*gain;output[frame*2+1]=samples[frame*2+1]!*gain;
  }
  return {samples:output,metrics};
}

export function builtinEffect(samples:Float64Array,effect:Extract<Effect,{type:'reverb'|'saturation'}>,frameLimit=Infinity):Float64Array {
  validateEffect(effect);
  if(effect.type==='saturation') {
    const drive=10**(effect.driveDb/20);
    return samples.map(v=>v*(1-effect.mix)+32767*Math.tanh(v/32768*drive)*effect.mix);
  }
  const frames=Math.min(frameLimit,samples.length/2+Math.ceil(effect.decaySeconds*PCM_RATE));
  if(frames>MAX_PCM_FRAMES)throw new RangeError('Reverb exceeds the 600 second production limit.');
  const output=new Float64Array(frames*2);
  // Four parallel feedback combs and two serial allpasses per channel. Fixed stereo
  // offsets decorrelate the room. Feedback reaches -60 dB after decaySeconds (RT60).
  for(let channel=0;channel<2;channel++) {
    const combs=[1116,1188,1277,1356].map(length=>{
      const frames=Math.round(length*(0.5+effect.roomSize))+channel*23;
      return {buffer:new Float64Array(frames),feedback:10**(-3*frames/(effect.decaySeconds*PCM_RATE)),index:0};
    });
    const allpasses=[225,76].map(length=>({buffer:new Float64Array(length+channel*7),index:0}));
    for(let frame=0;frame<frames;frame++) {
      const dry=frame<samples.length/2?samples[frame*2+channel]!:0;
      let wet=0;
      for(const comb of combs) {
        const delayed=comb.buffer[comb.index]!;
        comb.buffer[comb.index]=dry+delayed*comb.feedback;
        comb.index=(comb.index+1)%comb.buffer.length;wet+=delayed/4;
      }
      for(const allpass of allpasses) {
        const delayed=allpass.buffer[allpass.index]!,value=delayed-0.5*wet;
        allpass.buffer[allpass.index]=wet+0.5*value;allpass.index=(allpass.index+1)%allpass.buffer.length;wet=value;
      }
      output[frame*2+channel]=dry*(1-effect.wet)+wet*effect.wet;
    }
  }
  return output;
}
