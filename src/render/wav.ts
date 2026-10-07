import { readFileSync } from 'node:fs';
export interface WavInfo { formatTag: number; channels: number; sampleRate: number; bitsPerSample: number; dataOffset: number; dataBytes: number; frames: number }
export type WavResult = { ok: true; info: WavInfo } | { ok: false; error: string };
export function readWavInfo(input: Uint8Array | string): WavResult {
  let bytes: Buffer;
  try { bytes=typeof input==='string'?readFileSync(input):Buffer.from(input); }
  catch(error) {return {ok:false,error:`Cannot read WAV: ${error instanceof Error?error.message:String(error)}`};}
  const fail=(error:string):WavResult=>({ok:false,error});
  if(bytes.length<12 || bytes.toString('ascii',0,4)!=='RIFF' || bytes.toString('ascii',8,12)!=='WAVE')return fail('Missing RIFF/WAVE header.');
  const end=bytes.readUInt32LE(4)+8;
  if(end>bytes.length || end<12)return fail('Invalid RIFF size.');
  let fmt:{formatTag:number;channels:number;sampleRate:number;bitsPerSample:number;blockAlign:number;byteRate:number}|undefined;
  let data:{dataOffset:number;dataBytes:number}|undefined;
  let offset=12;
  while(offset<end) {
    if(offset+8>end)return fail('Truncated chunk header.');
    const name=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4),start=offset+8;
    if(start+size+(size%2)>end)return fail('Truncated WAV chunk.');
    if(name==='fmt ') {
      if(fmt || size<16)return fail('Invalid or duplicate fmt chunk.');
      fmt={formatTag:bytes.readUInt16LE(start),channels:bytes.readUInt16LE(start+2),sampleRate:bytes.readUInt32LE(start+4),byteRate:bytes.readUInt32LE(start+8),blockAlign:bytes.readUInt16LE(start+12),bitsPerSample:bytes.readUInt16LE(start+14)};
    } else if(name==='data') {
      if(data)return fail('Duplicate data chunk.');
      data={dataOffset:start,dataBytes:size};
    }
    offset=start+size+(size%2);
  }
  if(!fmt||!data)return fail('Missing fmt or data chunk.');
  if(!fmt.channels||!fmt.sampleRate||!fmt.bitsPerSample||!fmt.blockAlign)return fail('Invalid WAV format values.');
  if(fmt.blockAlign!==fmt.channels*fmt.bitsPerSample/8 || fmt.byteRate!==fmt.sampleRate*fmt.blockAlign || data.dataBytes%fmt.blockAlign!==0)return fail('Inconsistent PCM frame layout.');
  return {ok:true,info:{formatTag:fmt.formatTag,channels:fmt.channels,sampleRate:fmt.sampleRate,bitsPerSample:fmt.bitsPerSample,...data,frames:data.dataBytes/fmt.blockAlign}};
}
