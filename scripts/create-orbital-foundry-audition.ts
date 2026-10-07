/** Author the native 30-second pack audition. Audio always renders through DaemonV12. */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sounds } from './generate-orbital-foundry.ts';
const notes: {start:string;velocity:number;pitch?:string}[][]=sounds.map(()=>[]);
function hit(index:number,bar:number,beat=1,velocity=0.8,offset='') {
  notes[index]!.push({start:`${bar}:${beat}${offset}`,velocity,...(sounds[index]!.pitch!==null?{pitch:sounds[index]!.id}:{})});
}
// Fifteen bars at 120 BPM = 30 seconds. Deliberate last-bar atmosphere decay.
for(const [bar,beat] of [[1,1],[4,3],[8,1],[11,3]])hit(9,bar!,beat!,0.72);
for(const [bar,beat] of [[1,1],[4,3],[8,1],[12,1]])hit(10,bar!,beat!,0.68);
for(let b=2;b<=14;b++) {
  if(b===8) {hit(0,b,1,0.64);continue;}
  for(const beat of [1,2,3,4])hit(0,b,beat,beat%2?0.70:0.59,b>=4?'+1/8':'');
}
for(let b=3;b<=14;b++) {
  if(b===8) {hit(1,b,1,0.82);continue;}
  for(const beat of b<5?[1,3]:[1,2,3,4])hit(1,b,beat,beat===1?0.92:0.79);
  if(b===6||b===12)hit(1,b,4,0.58,'+1/8');
}
for(let b=4;b<=14;b++) {
  for(let step=0;step<16;step++) {
    if(b===8&&step>7)continue;
    if(b<6&&step%2)continue;
    const offset=['','+1/16','+1/8','+3/16'][step%4]!;
    hit(3,b,1+Math.floor(step/4),[0.72,0.36,0.58,0.42][step%4]!,offset);
  }
}
for(let b=5;b<=14;b++) {
  if(b===8)continue;
  hit(4,b,2,0.85);hit(4,b,4,0.93);
  if(b===7||b===13) {hit(4,b,4,0.43,'+1/8');hit(4,b,4,0.52,'+3/16');}
}
for(const [bar,beat] of [[4,4],[5,3],[6,4],[7,2],[9,3],[10,4],[11,2],[12,3],[13,4],[14,3]])hit(2,bar!,beat!,bar===14?0.65:0.76,'+1/8');
hit(5,2,1,0.64);hit(5,14,1,0.72);
hit(6,9,1,0.88);
hit(7,7,1,0.86); // 12–16 s, rising into bar 9
hit(8,8,1,0.80); // 14–16 s, same exact edit point
for(const b of [9,10,11,12,13]) {hit(11,b,2,0.77);if(b%2)hit(11,b,4,0.63);}
hit(11,14,2,0.60);
const gains=[-6,-3.5,0,1,-0.5,-5,-3,-4,-5,-5,0,-2];
const pans=[0,0,-0.24,0.32,0.08,0,0,0,0,0,0,-0.15];
const project={formatVersion:1,title:'ORBITAL FOUNDRY — Systems Under Load',description:'Thirty-second pack audition: orbital air, propulsion, assembly rhythm, launch tension, structural impact, energy conflict, controlled shutdown. All twelve sounds are original generated assets. Not a final score.',bpm:120,timeSignature:'4/4',key:'D minor',bars:15,seed:983041,master:{gainDb:0.3,effects:[]},tracks:sounds.map((s,i)=>({id:s.id,description:s.role,instrument:s.pitch!==null?{type:'drumkit',kit:'assets/orbital-foundry/kit.json'}:{type:'sampler',sample:`assets/orbital-foundry/${String(i+1).padStart(2,'0')}-${s.id}.wav`},mix:{gainDb:gains[i],pan:pans[i]},clips:[{bar:1,pattern:'audition'}],patterns:[{id:'audition',bars:15,notes:notes[i]}]}))};
writeFileSync(join(process.argv[2]??'examples','orbital-foundry-audition.json'),JSON.stringify(project,null,2)+'\n');
