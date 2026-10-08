import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePcm, PCM_RATE, type Pcm } from '../src/render/index.ts';

export const VO_REGIONS = [[1.2,2.8],[4.4,5.8]] as const;
export function syntheticVoiceover(seconds=8):Pcm {
  const frames=Math.round(seconds*PCM_RATE),samples=new Int16Array(frames*2);
  for(let frame=0;frame<frames;frame++) {
    const t=frame/PCM_RATE,region=VO_REGIONS.find(([start,end])=>t>=start&&t<end);
    if(!region)continue;
    const elapsed=t-region[0],edge=Math.min(1,elapsed/0.015,(region[1]-t)/0.015);
    const syllable=0.65+0.35*Math.sin(2*Math.PI*3.7*elapsed)**2;
    const voice=Math.sin(2*Math.PI*173*t)+0.48*Math.sin(2*Math.PI*346*t)+0.22*Math.sin(2*Math.PI*1038*t);
    samples[frame*2]=samples[frame*2+1]=Math.round(6000*voice*syllable*edge);
  }
  return {frames,channels:2,samples};
}
export function v05DemoProject() {
  const sampler=(id:string,sample:string,notes:object[],extra:object)=>({id,instrument:{type:'sampler',sample:`assets/orbital-foundry/${sample}`},...extra,clips:[{bar:1,pattern:'cue'}],patterns:[{id:'cue',bars:4,notes}]});
  return {
    formatVersion:1,title:'Orbital Foundry — Narrated Systems',description:'V0.5 synthetic locked-picture acceptance cue; original Foundry sounds and fake VO activity, not the Shoot the Moon score.',
    bpm:120,timeSignature:'4/4',bars:4,seed:5,render:{duration:{seconds:8},tail:'auto'},
    master:{gainDb:5,ducking:{source:'assets/v05/synthetic-vo.wav',amountDb:12,thresholdDb:-35,attackMs:50,releaseMs:300}},
    tracks:[
      sampler('atmosphere','10-dark-drone.wav',[{start:'1:1',velocity:0.7},{start:'3:1',velocity:0.7}],{
        mix:{gainDb:-3,pan:0},effects:[{type:'highpass',frequencyHz:70},{type:'reverb',roomSize:0.6,decaySeconds:1.2,wet:0.18}],
        automation:{gainDb:[{at:{seconds:0},value:-8,transition:'linear'},{at:{seconds:0.7},value:-3},{at:{seconds:7},value:-3,transition:'linear'},{at:{seconds:8},value:-45}],pan:[{at:{musical:'1:1'},value:-0.35,transition:'linear'},{at:{musical:'3:1'},value:0.35,transition:'linear'},{at:{musical:'5:1'},value:0}]} }),
      {id:'machines',instrument:{type:'drumkit',kit:'assets/orbital-foundry/kit.json'},mix:{gainDb:-5,pan:0.15},
        effects:[{type:'saturation',driveDb:5,mix:0.25},{type:'compressor',thresholdDb:-17,ratio:3,attackMs:8,releaseMs:150}],
        automation:{gainDb:[{at:{seconds:0},value:-5},{at:{seconds:7},value:-5,transition:'linear'},{at:{seconds:8},value:-45}]},
        clips:[1,2,3,4].map(bar=>({bar,pattern:'pulse'})),patterns:[{id:'pulse',bars:1,notes:[{start:'1:1',pitch:'mechanical-kick',velocity:0.65},{start:'1:2',pitch:'machine-tick',velocity:0.55},{start:'1:3',pitch:'industrial-snare',velocity:0.5},{start:'1:4',pitch:'metallic-strike',velocity:0.4}]}]},
      sampler('energy','12-alarm-energy-pulse.wav',[{start:'1:1',velocity:0.55},{start:'2:1',velocity:0.55},{start:'3:1',velocity:0.55},{start:'4:1',velocity:0.5}],{
        mix:{gainDb:-6,pan:-0.25},effects:[{type:'lowpass',frequencyHz:6000},{type:'reverb',roomSize:0.4,decaySeconds:0.8,wet:0.12}],
        automation:{gainDb:[{at:{seconds:0},value:-6},{at:{seconds:7},value:-6,transition:'linear'},{at:{seconds:8},value:-45}]} }),
    ],
  };
}
export function v05LoopProject() {
  return {formatVersion:1,title:'Foundry — Four Bar Layer',bpm:100,timeSignature:'4/4',bars:4,render:{duration:{bars:4},tail:'none'},tracks:[
    {id:'pulse',instrument:{type:'drumkit',kit:'assets/orbital-foundry/kit.json'},mix:{gainDb:-7},clips:[1,2,3,4].map(bar=>({bar,pattern:'pulse'})),patterns:[{id:'pulse',bars:1,notes:[{start:'1:1',pitch:'sub-pulse',velocity:0.6},{start:'1:2',pitch:'machine-tick',velocity:0.5},{start:'1:3',pitch:'mechanical-kick',velocity:0.6},{start:'1:4',pitch:'industrial-snare',velocity:0.4}]}]},
    {id:'air',instrument:{type:'sampler',sample:'assets/orbital-foundry/11-air-texture.wav'},mix:{gainDb:-9},effects:[{type:'reverb',roomSize:0.7,decaySeconds:2,wet:0.25}],clips:[{bar:1,pattern:'layer'}],patterns:[{id:'layer',bars:4,notes:[{start:'1:1',velocity:0.4},{start:'4:4',velocity:0.4}]}]},
  ]};
}
export function generateV05Fixtures(root=resolve('examples')) {
  const assets=join(root,'assets/v05');mkdirSync(assets,{recursive:true});
  writeFileSync(join(assets,'synthetic-vo.wav'),encodePcm(syntheticVoiceover().samples));
  for(const [name,project] of [['v05-video-demo',v05DemoProject()],['v05-loop-demo',v05LoopProject()]] as const)
    writeFileSync(join(root,`${name}.json`),JSON.stringify(project,null,2)+'\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))generateV05Fixtures();
