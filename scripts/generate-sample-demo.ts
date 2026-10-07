// Original, deterministic development sounds. No recordings or external libraries.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { encodePcm } from '../src/render/index.ts';
const output=process.argv[2]??'examples';
const directory=`${output}/assets/pulse-kit`;
mkdirSync(directory,{recursive:true});
let state=0x12dae; // fixed xorshift seed, reset per fixture below
function noise() {state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/2147483648-1;}
function sample(name:string,seconds:number,voice:(t:number,n:number)=>number) {
  state=0x12dae;
  const frames=Math.round(seconds*44100),pcm=new Int16Array(frames*2);
  for(let i=0;i<frames;i++) {
    const t=i/44100,fade=Math.min(1,(frames-1-i)/441);
    const value=Math.round(Math.max(-1,Math.min(1,voice(t,noise())*fade))*32767);
    pcm[i*2]=value;pcm[i*2+1]=value;
  }
  writeFileSync(`${directory}/${name}.wav`,encodePcm(pcm));
}
sample('kick',0.32,(t,n)=>0.38*Math.sin(2*Math.PI*(48*t+85*0.018*(1-Math.exp(-t/0.018))))*Math.exp(-t*16)+0.035*n*Math.exp(-t*190));
sample('snare',0.22,(t,n)=>(0.21*n+0.09*Math.sin(2*Math.PI*185*t))*Math.exp(-t*24)*(1-Math.exp(-t*3000)));
let previous=0;
sample('hat',0.08,(t,n)=>{const high=n-previous;previous=n;return 0.095*high*Math.exp(-t*65);});
sample('impact',1.8,(t,n)=>(0.16*n+0.19*Math.sin(2*Math.PI*(38*t+12*0.15*(1-Math.exp(-t/0.15))))+0.04*Math.sin(2*Math.PI*91*t))*Math.exp(-t*3.8)*(1-Math.exp(-t*180)));
writeFileSync(`${directory}/kit.json`,JSON.stringify({formatVersion:1,samples:[{name:'kick',pitch:36,file:'kick.wav'},{name:'snare',pitch:38,file:'snare.wav'},{name:'hat',pitch:42,file:'hat.wav'}]},null,2)+'\n');
const original=JSON.parse(readFileSync('examples/demo.json','utf8'));
function drum(id:string,notes:unknown[]) {
  return {id,instrument:{type:'drumkit',kit:'assets/pulse-kit/kit.json'},clips:Array.from({length:8},(_,i)=>({bar:i+1,pattern:'groove'})),patterns:[{id:'groove',bars:1,notes}]};
}
const project={...original,title:'DaemonV12 Sample Pulse',description:'Original bass and piano with an eight-bar sampled backbeat and a cinematic impact in bar 8.',tracks:[
  drum('kick',[{start:'1:1',pitch:'kick',velocity:0.9},{start:'1:3',pitch:'kick',velocity:0.85}]),
  drum('snare',[{start:'1:2',pitch:'snare',velocity:0.8},{start:'1:4',pitch:'snare',velocity:0.9}]),
  drum('hats',Array.from({length:8},(_,i)=>({start:`1:${Math.floor(i/2)+1}${i%2?'+1/8':''}`,pitch:'hat',velocity:i%2?0.45:0.65}))),
  ...original.tracks,
  {id:'impact',instrument:{type:'sampler',sample:'assets/pulse-kit/impact.wav'},clips:[{bar:8,pattern:'accent'}],patterns:[{id:'accent',bars:1,notes:[{start:'1:1',velocity:0.75}]}]},
]};
writeFileSync(`${output}/sample-demo.json`,JSON.stringify(project,null,2)+'\n');
