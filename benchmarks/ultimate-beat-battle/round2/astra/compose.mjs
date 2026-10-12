import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const version=Number(process.argv[2]||1);
const bpm=138, quarter=Math.round(60000000/bpm)/1e6, barSec=quarter*4;
function gcd(a,b){return b?gcd(b,a%b):a;}
function pos(bar,beat=0){const ticks=Math.round(beat*960),q=Math.floor(ticks/960),r=ticks%960,g=gcd(r,3840);return `${bar}:${q+1}`+(r?`+${r/g}/${3840/g}`:'');}
const rate=semi=>Number((2**(semi/12)).toFixed(9));
const tracks=[];
function tr(id,file,gain,effects=[],pan=0,kit=false){const t={id,instrument:kit?{type:'drumkit',kit:'assets/kit.json'}:{type:'sampler',sample:`assets/${file}.wav`},mix:{gainDb:gain,pan},effects,clips:[{bar:1,pattern:'score'}],patterns:[{id:'score',bars:16,notes:[]}]};tracks.push(t);return t;}
function hit(t,bar,beat,vel=.8,semi=0,extra={}){t.patterns[0].notes.push({start:pos(bar,beat),velocity:vel,...(semi?{playbackRate:rate(semi)}:{}),...extra});}
function drum(t,bar,beat,pitch,vel=.8,extra={}){hit(t,bar,beat,vel,0,{pitch,...extra});}
function lane(points){return points.map(([bar,beat,value,transition='linear'])=>({at:{musical:pos(bar,beat)},value,transition}));}
const hp=frequencyHz=>({type:'highpass',frequencyHz}),lp=frequencyHz=>({type:'lowpass',frequencyHz});
const reverb=(wet,decaySeconds=.45)=>({type:'reverb',roomSize:.36,decaySeconds,wet});
const delay=(wet,timeMs)=>({type:'delay',timeMs,wet});
const kick=tr('piston',null,-4,[hp(27)],0,true);
const clap=tr('clamp',null,-4,[hp(140),reverb(.07,.32)],0,true);
const hats=tr('dust-clock',null,-5,[hp(4800)],.16,true);
const rim=tr('crossbar',null,-5,[hp(450),delay(.10,quarter*750)],-.22,true);
const latch=tr('latch','latch-fs',-4,[hp(260),delay(.12,quarter*750)],-.08);
const wire=tr('wire-answer','wire-fs',-8,[hp(430),reverb(.16,.55)],.26);
const sub=tr('floor','sub-fs',-4,[lp(180)],0);
const throat=tr('throat','throat-fs',-9,[hp(125),lp(3200)],0);
const chords=tr('reed-room',null,-4,[hp(320),reverb(.14,.65)],0,true);
const halo=tr('suspended-steel','halo',-9,[hp(620)],0);
const inhale=tr('intake','latch-inhale',-7,[hp(420),reverb(.12,.4)],0);

// Establish pulse without a count-in. The backbeat stays legible under shifted accents.
for(let b=1;b<=16;b++){
  if(b===9||b===10)continue;
  const odd=b%2===1;
  const kp=odd?[0,1.75,2.5]:[0,.75,2.65];
  for(let i=0;i<kp.length;i++)drum(kick,b,kp[i],'kick',i===0?.92:.74);
  if(b>1)for(const beat of [1,3])drum(clap,b,beat,'clamp',beat===1?.78:.85);
  else drum(clap,b,3,'rim',.7);
  const grid=b<3?[.6,2.6,3.6]:[.6,1.25,1.6,2.6,3.25,3.6];
  for(let i=0;i<grid.length;i++)drum(hats,b,grid[i],i===grid.length-1&&b%2===0?'open-hat':'hat',i%3===0?.69:.39);
  if(b>=3){drum(hats,b,.25,'brush',.31);drum(hats,b,2.25,'brush',.28);}
  if(b%2===0)drum(rim,b,2.25,'rim',.61);
  if(b===6||b===8||b===14)drum(rim,b,3.75,'rim',.55);
}
// Hook: repeated latch, minor third, then a bent whole-step answer back to F#.
for(const b of [1,3,5,7,11,13,15]){
  hit(latch,b,0,.82);
  hit(latch,b,.75,.68);
  hit(latch,b,1.6,.77,3);
  hit(latch,b,2.5,.66,2,{glide:{to:1,duration:'1/8'}});
  if(b!==15){hit(wire,b+1,.6,.64,7);hit(latch,b+1,1.5,.6,3);hit(wire,b+1,3.35,.56,0);}
}
// Bass pulse and its FM upper articulation share note timing, but occupy different bands.
const roots={1:0,2:0,3:0,4:0,5:-4,6:-4,7:0,8:7,11:0,12:-4,13:5,14:7,15:0,16:0};
for(const [bs,root] of Object.entries(roots)){
  const b=+bs;
  const pattern=b<3?[.55,2.1]:b%2?[.55,2.1,3.5]:[.45,1.65,3.45];
  for(let j=0;j<pattern.length;j++){
    const semi=root+(b===8&&j===2?2:0);
    hit(sub,b,pattern[j],j===0?.84:.73,semi);
    if(b>=3)hit(throat,b,pattern[j],j===0?.66:.48,semi);
  }
}
// Harmony is a response, leaving the latch attacks clear.
for(const b of [2,4,6,8,11,12,13,14,15]){
  const pitch=[6,12].includes(b)?'chord-d9':b===13?'chord-b9':'chord-fs9';
  drum(chords,b,b>=11?.6:2.6,pitch,b>=11?.8:.57);
  if(b>=11&&b<=14)drum(chords,b,2.7,pitch,.54);
}
hit(halo,7,1,.56);hit(halo,9,.25,.66);hit(halo,13,1,.51);
hit(inhale,2,3,.52,0);hit(inhale,8,3,.62,0);hit(inhale,10,3,.8,0);
// Disruption: stretched latch with one dry crossbar retaining the remembered pulse.
hit(latch,9,0,.86,-12,{glide:{to:rate(-5),duration:'1/2'}});
drum(rim,9,2.6,'rim',.61);
hit(wire,10,.5,.72,-5,{glide:{to:rate(2),duration:'1/4'}});
drum(hats,10,2.6,'brush',.53);drum(rim,10,3.5,'rim',.61);
// Exit returns the dry identity and preserves the time under the last reply.
hit(latch,16,.6,.77,7);hit(latch,16,1.5,.69,3);hit(wire,16,2.6,.6,0);
hit(inhale,16,3.1,.48,7);
latch.automation={pan:lane([[1,0,-.08],[9,0,-.25],[10,0,.3],[11,0,-.16],[15,0,-.08]])};
wire.automation={pan:lane([[1,0,.26],[9,0,.26],[10,0,-.4],[11,0,.44],[15,0,.26]])};
chords.automation={gainDb:lane([[1,0,-4],[9,0,-8],[10,3,-8],[11,0,-4],[15,0,-5],[16,0,-7]])};
const project={formatVersion:1,title:'LATCH / RELEASE',description:'Original Round 2 collision: a struck latch becomes groove, unstable space, and a transformed return. 138 BPM; F# minor. All sources synthesized locally.',bpm,timeSignature:'4/4',key:'F# minor',bars:16,seed:0xa57a2026,render:{duration:{bars:16},tail:'none'},master:{gainDb:-2,effects:[hp(25)]},tracks};
if(version>=2){
  const notes=t=>t.patterns[0].notes;
  const clear=(t,b)=>t.patterns[0].notes=notes(t).filter(n=>!n.start.startsWith(b+':'));
  // Replies now have a voiced consonant and an intentionally empty slot around them.
  wire.instrument.sample='assets/wire-v2-fs.wav';
  wire.mix.gainDb=-5;wire.effects=[hp(210),reverb(.10,.4),delay(.10,quarter*500)];
  for(const b of [2,4,6,8,12,14]){
    clear(wire,b);clear(latch,b);
    hit(wire,b,.6,.82,7);hit(wire,b,1.45,.69,3);
    hit(latch,b,3.35,.52,0);
    hats.patterns[0].notes=notes(hats).filter(n=>![pos(b,.6),pos(b,1.6)].includes(n.start));
  }
  // Payoff is the familiar knock followed by a higher answer, not a repeated two-bar tile.
  clear(latch,11);clear(latch,13);
  for(const b of [11,13]){
    hit(latch,b,0,.88);hit(latch,b,.75,.70);
    hit(latch,b,1.6,.78,3);
    hit(wire,b,2.5,.83,b===11?7:10);
    hit(latch,b,3.35,.60,b===11?12:7);
  }
  for(const b of [12,14]){
    hit(throat,b,2.75,.75,b===12?-4:7,{glide:{to:rate(b===12?0:9),duration:'1/16'}});
    drum(rim,b,3.75,'rim',.64,{playbackRate:1.5});
  }
  chords.instrument.kit='assets/harmony-v2.json';chords.effects=[hp(190),reverb(.12,.58)];
  chords.automation={gainDb:lane([[1,0,-5],[7,0,-5],[9,0,-10],[10,3,-10],[11,0,-1],[14,3,-1],[15,0,-4],[16,0,-7]])};
  const reflect=tr('latch-reflection','latch-fs',-12,[hp(850),delay(.16,quarter*500)],.55);
  for(const b of [11,13]){hit(reflect,b,.75,.51,12);hit(reflect,b,3.35,.55,12);}
  reflect.automation={pan:lane([[1,0,.55],[11,0,.55],[12,0,-.55],[13,0,-.55],[14,0,.55]])};
  // Source-safe exit: all newly authored direct voices end inside the musical container.
  for(const t of [kick,clap,hats,rim,latch,wire,sub,throat,inhale])clear(t,16);
  drum(kick,16,0,'kick',.88);drum(kick,16,2.25,'kick',.7);
  drum(clap,16,1,'clamp',.73);
  drum(hats,16,.6,'hat',.51);drum(hats,16,1.6,'brush',.4);drum(hats,16,2.6,'hat',.43);
  hit(wire,16,.6,.77,7);hit(latch,16,1.5,.71,3);hit(latch,16,2.6,.61,0);
  hit(sub,16,.45,.81);hit(sub,16,2.7,.72);
  hit(throat,16,.45,.52);hit(throat,16,2.7,.44);
  hit(inhale,16,3.1,.48,7);
}
if(version>=3){
  const notes=t=>t.patterns[0].notes;
  const clear=(t,b)=>t.patterns[0].notes=notes(t).filter(n=>!n.start.startsWith(b+':'));
  // Shorter rate trajectories arrive while the pitched bodies still have energy.
  notes(latch).find(n=>n.start===pos(9,0)).glide.duration='1/8';
  notes(wire).find(n=>n.start===pos(10,.5)).glide.duration='1/8';
  // One deliberately late backbeat, followed by a false foothold and exposed air.
  drum(clap,9,1.5,'clamp',.58,{playbackRate:rate(-5)});
  drum(kick,9,2.5,'kick',.58);
  // The intake resolves just before the entrance, rather than bursting across its attack.
  for(const b of [8,10])notes(inhale).find(n=>n.start===pos(b,3)).playbackRate=rate(2);
  // A single broad reply per payoff bar clears the recognizable double knock.
  for(const b of [11,12,13,14]){
    clear(chords,b);
    const pitch=b===12?'chord-d9':b===13?'chord-b9':'chord-fs9';
    drum(chords,b,b%2?1.95:2.05,pitch,.84);
  }
  // D1 is longer after repitching. Phrase it into clear slots instead of allowing
  // its source tail to cross a kick; the brief D2 answer makes movement audible.
  for(const b of [5,6,12]){
    clear(sub,b);clear(throat,b);
    const phrase=b===5?[[.55,-4,.84],[2.85,-4,.76]]:[[.4,-4,.84],[1.3,8,.63],[3.1,-4,.76]];
    for(const [beat,semi,v] of phrase){hit(sub,b,beat,v,semi);hit(throat,b,beat,.60,semi);}
    if(b!==5){
      clear(kick,b);
      for(const [beat,v] of [[0,.92],[1.75,.74],[2.65,.74]])drum(kick,b,beat,'kick',v);
    }
  }
}
for(const t of tracks)t.patterns[0].notes.sort((a,b)=>{function tick(s){const m=s.match(/(\d+):(\d+)(?:\+(\d+)\/(\d+))?/);return (+m[1]-1)*3840+(+m[2]-1)*960+(m[3]?+m[3]*3840/+m[4]:0);}return tick(a.start)-tick(b.start);});
fs.writeFileSync(path.join(here,`project-v${version}.json`),JSON.stringify(project,null,2)+'\n');
console.log(JSON.stringify({version,seconds:barSec*16,tracks:tracks.length,events:tracks.reduce((s,t)=>s+t.patterns[0].notes.length,0)}));
