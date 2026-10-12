// Original benchmark-local mathematical one-shots. No recordings or external samples.
// Node built-ins only; fixed xorshift seeds; PCM16/44100; no runtime randomness.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url));
const out=process.argv[2]||path.join(here,'assets'); fs.mkdirSync(out,{recursive:true});
const SR=44100, TAU=2*Math.PI, F=440*2**((30-69)/12);
const catalog=[];
function noise(seed){let x=seed>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/2147483648-1;};}
function lp(x,hz){const a=1-Math.exp(-TAU*hz/SR);let s=0;return Float64Array.from(x,v=>(s+=a*(v-s)));}
function hp(x,hz){const lo=lp(x,hz);return Float64Array.from(x,(v,i)=>v-lo[i]);}
function mono(sec,fn){return Float64Array.from({length:Math.round(sec*SR)},(_,i)=>fn(i/SR,i));}
function write(name,channels,peak,recipe,tuning=null){
  if(channels instanceof Float64Array) channels=[channels];
  const n=channels[0].length;
  // Remove infrasonics and taper to exact zero at both endpoints.
  channels=channels.map(x=>hp(x,16));
  for(let c of channels)for(let i=0;i<n;i++) c[i]*=Math.min(1,i/(.0015*SR))*Math.min(1,(n-1-i)/(.018*SR));
  let max=0; for(const c of channels)for(const x of c)max=Math.max(max,Math.abs(x));
  const gain=10**(peak/20)/max, b=Buffer.alloc(44+n*channels.length*2);
  b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(channels.length,22);b.writeUInt32LE(SR,24);b.writeUInt32LE(SR*channels.length*2,28);b.writeUInt16LE(channels.length*2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);
  for(let i=0;i<n;i++)for(let ch=0;ch<channels.length;ch++)b.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(channels[ch][i]*gain*32767))),44+(i*channels.length+ch)*2);
  fs.writeFileSync(path.join(out,name+'.wav'),b);
  catalog.push({file:name+'.wav',frames:n,seconds:n/SR,channels:channels.length,peakTargetDbfs:peak,tuning,recipe,sha256:createHash('sha256').update(b).digest('hex')});
}
let rnd=noise(0xa57a2101);
write('kick',mono(.25,t=>{
  const phase=TAU*(49*t+100*.012*(1-Math.exp(-t/.012)));
  return Math.sin(phase)*Math.exp(-t/0.063)+.12*rnd()*Math.exp(-t/.003)+.085*Math.sin(TAU*1800*t)*Math.exp(-t/.0018);
}),-5,'Falling membrane 149→49 Hz; short tactile contact; 250 ms finite source');
rnd=noise(0xa57a2102);
let ns=hp(mono(.23,()=>rnd()),1050);
write('clamp',mono(.23,(t,i)=>{
  const clap=(Math.exp(-t/.021)+(t>.012?.65*Math.exp(-(t-.012)/.032):0)+(t>.024?.42*Math.exp(-(t-.024)/.047):0));
  return ns[i]*.65*clap+.43*Math.sin(TAU*188*t+1.5*Math.exp(-t/.009)*Math.sin(TAU*374*t))*Math.exp(-t/.044)+.14*Math.sin(TAU*1783*t)*Math.exp(-t/.023);
}),-7,'Three staggered pneumatic contacts, 188 Hz drum body, tuned steel overtone');
rnd=noise(0xa57a2103);
write('rim',mono(.105,t=>.65*Math.sin(TAU*820*t+2.3*Math.sin(TAU*1271*t))*Math.exp(-t/.012)+.25*rnd()*Math.exp(-t/.005)),-10,'Dry crossbar ping, 820/1271 Hz FM, short noise contact');
for(const [name,len,dec,seed] of [['hat',.085,.018,0xa57a2104],['open-hat',.23,.059,0xa57a2105],['brush',.12,.033,0xa57a2106]]){
  rnd=noise(seed); const n=hp(mono(len,()=>rnd()),name==='brush'?5100:7000);
  write(name,mono(len,(t,i)=>(.6*n[i]+.08*Math.sin(TAU*7311*t)*Math.sin(TAU*5109*t))*Math.exp(-t/dec)),-12,'High-passed seeded dust and metal partials; finite percussive envelope');
}
write('sub-fs',mono(.285,t=>{
  const e=(1-Math.exp(-t/.006))*Math.exp(-t/.15)*Math.min(1,(.285-t)/.05);
  return e*(Math.sin(TAU*F*t)+.14*Math.sin(TAU*2*F*t)+.045*Math.sin(TAU*3*F*t));
}),-6,'46.249303 Hz F#1; 285 ms finite bass with 6 ms attack and 50 ms release',30);
write('throat-fs',mono(.255,t=>{
  const f=F*2, m=1.4+3.2*Math.exp(-t/.07), p=TAU*f*t;
  return (1-Math.exp(-t/.003))*Math.exp(-t/.083)*(Math.sin(p+m*Math.sin(p*2))+.24*Math.sin(p*3+.8*Math.sin(p*5)));
}),-8,'F#2 harmonic FM throat; articulates bass rhythm above sub, no noise layer',42);
rnd=noise(0xa57a2107);
const latch=mono(.48,t=>{
  const p=TAU*F*8*(t+.0007*(1-Math.exp(-t/.018)));
  const attack=1-Math.exp(-t/.0011);
  return attack*(Math.sin(p+2.1*Math.exp(-t/.031)*Math.sin(p*3))*Math.exp(-t/.085)+.28*Math.sin(p*2.01)*Math.exp(-t/.046)+.17*Math.sin(p*5.013)*Math.exp(-t/.13)+.085*rnd()*Math.exp(-t/.003));
});
write('latch-fs',latch,-7,'F#4 struck spring: pitched body, fading harmonic FM and slightly inharmonic steel partials',66);
// A physically related reverse gesture, prepared as a local asset because playback has no reverse mode.
write('latch-inhale',Float64Array.from(latch).reverse(),-11,'Reversal of the original mathematical latch, endpoint tapered; transition preparation',66);
write('wire-fs',mono(.85,t=>{
  const p=TAU*F*8*t;
  return (1-Math.exp(-t/.012))*Math.exp(-t/.14)*(Math.sin(p)+.27*Math.sin(2*p)+.11*Math.sin(3*p)+.12*Math.sin(6.02*p));
}),-10,'F#4 wire harmonic answer with softer onset and longer gliding source',66);
function chord(name,notes){
  const sec=1.35;
  let channels=[0,1].map(ch=>mono(sec,t=>{
    const env=(1-Math.exp(-t/.009))*Math.exp(-t/.26)*Math.min(1,(sec-t)/.2);
    let v=0;for(let j=0;j<notes.length;j++){
      const f=440*2**((notes[j]-69)/12),detune=(ch?1:-1)*.0018;
      const p=TAU*f*(1+detune)*t+.018*Math.sin(TAU*.8*t+j);
      v+=(Math.sin(p)+.29*Math.sin(2*p)*Math.exp(-t/.12)+.10*Math.sin(4*p)*Math.exp(-t/.05))*(1-.09*j);
    }return v*env;
  }));
  write(name,channels,-12,'Original detuned struck reed chord; finite 1.35 s source; no embedded rhythm',notes);
}
chord('chord-fs9',[54,57,61,64,68]);
chord('chord-d9',[50,57,61,64,66]);
chord('chord-b9',[47,54,57,61,66]);
// V2 additions preserve all V1 source bytes. More projecting answers and voiced stereo reeds.
write('wire-v2-fs',mono(.41,t=>{
  const p=TAU*F*8*t;
  return (1-Math.exp(-t/.0025))*Math.exp(-t/.105)*(Math.sin(p+1.15*Math.exp(-t/.03)*Math.sin(2*p))+.56*Math.sin(2*p)+.29*Math.sin(3*p)+.13*Math.sin(5*p));
}),-8,'F#4 projecting reed-wire response: 2.5 ms attack, rich harmonic body, 410 ms shaped release',66);
function broadChord(name,notes){
  const sec=1.45;
  const cs=[0,1].map(ch=>mono(sec,t=>{
    let v=0;for(let j=0;j<notes.length;j++){
      const f=440*2**((notes[j]-69)/12),p=TAU*f*(1+(ch?1:-1)*.0021)*t;
      const env=(1-Math.exp(-t/.017))*Math.exp(-t/.42)*Math.min(1,(sec-t)/.2);
      const panWeight=((j+ch)%2===0)?1:.54;
      v+=panWeight*env*(Math.sin(p)+.5*Math.sin(2*p)*Math.exp(-t/.45)+.22*Math.sin(3*p)*Math.exp(-t/.23)+.09*Math.sin(5*p)*Math.exp(-t/.08));
    }return v;
  }));
  write(name,cs,-11,'Stereo voiced reed response: alternating note weights, mild detune, 420 ms body, no embedded sequence',notes);
}
broadChord('reed-fs9',[54,61,64,68,69]);
broadChord('reed-d9',[50,61,64,66,69]);
broadChord('reed-b9',[47,61,66,69,73]);
fs.writeFileSync(path.join(out,'harmony-v2.json'),JSON.stringify({formatVersion:1,samples:[['chord-fs9',60,'reed-fs9'],['chord-d9',62,'reed-d9'],['chord-b9',64,'reed-b9']].map(([name,pitch,file])=>({name,pitch,file:file+'.wav'}))},null,2)+'\n');
// Tension has the same hook pitch-class, an adjacent G# and an E, without low-frequency mass.
write('halo', [0,1].map(ch=>mono(2.2,t=>{
  const env=Math.sin(Math.PI*t/2.2)**1.4;
  return env*(.4*Math.sin(TAU*739.989*t+.5*ch)+.27*Math.sin(TAU*830.609*(1+ch*.0004)*t)+.2*Math.sin(TAU*1318.510*t+.23*Math.sin(TAU*2.1*t+ch)))*(1+.12*Math.sin(TAU*(3.7+ch*.3)*t));
})),-16,'F#5/G#5/E6 slowly breathed steel harmonics; midrange tension only',[78,80,88]);
const kit={formatVersion:1,samples:[['kick',36],['clamp',38],['rim',39],['hat',42],['open-hat',46],['brush',44],['chord-fs9',60],['chord-d9',62],['chord-b9',64]].map(([name,pitch])=>({name,pitch,file:name+'.wav'}))};
fs.writeFileSync(path.join(out,'kit.json'),JSON.stringify(kit,null,2)+'\n');
fs.writeFileSync(path.join(here,'asset-catalog.json'),JSON.stringify({origin:'Original mathematical synthesis for Round 2 Astra only',license:'CC0-1.0',sampleRate:SR,bitsPerSample:16,sounds:catalog},null,2)+'\n');
console.log(JSON.stringify({directory:out,sounds:catalog.length,bytes:catalog.reduce((s,x)=>s+44+x.frames*x.channels*2,0)}));
