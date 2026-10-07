import assert from 'node:assert/strict';
import { readWavInfo } from '../../src/render/wav.ts';
export function verifyDemoAudio(bytes: Buffer) {
  const parsed=readWavInfo(bytes);assert.ok(parsed.ok,parsed.ok?'':parsed.error);
  const info=parsed.info;
  assert.equal(info.formatTag,1);assert.equal(info.channels,2);assert.equal(info.sampleRate,44100);assert.equal(info.bitsPerSample,16);
  const duration=info.frames/info.sampleRate;assert.ok(duration>=20 && duration<=26,`duration ${duration}`);
  const rms=(start:number,end:number)=>{
    let square=0,count=0;
    for(let frame=Math.floor(start*info.sampleRate);frame<Math.min(info.frames,Math.floor(end*info.sampleRate));frame++)for(let channel=0;channel<2;channel++){
      const sample=bytes.readInt16LE(info.dataOffset+frame*4+channel*2);square+=(sample/32768)**2;count++;
    }
    return 20*Math.log10(Math.sqrt(square/count));
  };
  for(let offset=info.dataOffset;offset<info.dataOffset+info.dataBytes;offset+=2){const sample=bytes.readInt16LE(offset);assert.ok(sample>-32767 && sample<32767,`clipped sample ${sample}`);}
  const barRms=Array.from({length:8},(_,i)=>rms(i*2.5,(i+1)*2.5));for(const value of barRms)assert.ok(value>-45,`silent bar: ${value} dBFS`);
  const tailRms=duration>22?rms(22,duration):null;if(tailRms!==null)assert.ok(tailRms< -50,`tail ${tailRms} dBFS`);
  return {duration,frames:info.frames,barRms,tailRms};
}
