import { diagnostic, didYouMean, formatPath, type Diagnostic, type Parsed } from '../diagnostics.ts';
import { durationSyntax, positionSyntax, parseDuration, parsePosition, parseTimeSignature, ticksPerBar, formatDuration, type TimeSignature } from '../timing/musical-time.ts';
import { parsePitch } from './pitch.ts';
import { parseKey, type Key } from './key.ts';
import { parseProgram } from './gm-programs.ts';
import type { Project } from './types.ts';
import { assetPath, type Kits } from './sample-schema.ts';

type ObjectValue = Record<string, unknown>;
type Kind = 'project' | 'track' | 'instrument' | 'clip' | 'pattern' | 'note';
type Rule = (value: unknown, path: string) => Parsed<unknown>;
interface Field { rule?: Rule; object?: Kind; array?: Kind; optional?: boolean; example: unknown }
const fields: Record<Kind, Record<string, Field>> = {
  project: { formatVersion:{rule:number(1,1,true),example:1}, title:{rule:string(200,true),example:'My project'}, description:{rule:string(2000),optional:true,example:''}, bpm:{rule:number(20,300),example:120}, timeSignature:{rule:parseTimeSignature,example:'4/4'}, key:{rule:parseKey,optional:true,example:'D minor'}, bars:{rule:number(1,1000,true),example:1}, seed:{rule:number(0,4294967295,true),optional:true,example:0}, tracks:{array:'track',example:[]} },
  track: { id:{rule:id,example:'lead'}, description:{rule:string(2000),optional:true,example:''}, instrument:{object:'instrument',example:{type:'gm',program:'acoustic_grand_piano'}}, clips:{array:'clip',example:[]}, patterns:{array:'pattern',example:[]} },
  instrument: { type:{rule:instrumentType,example:'gm'}, program:{rule:parseProgram,example:'acoustic_grand_piano'} },
  clip: { bar:{rule:number(1,Number.MAX_SAFE_INTEGER,true),example:1}, pattern:{rule:id,example:'one'} },
  pattern: { id:{rule:id,example:'one'}, description:{rule:string(2000),optional:true,example:''}, bars:{rule:number(1,1000,true),example:1}, notes:{array:'note',example:[]} },
  note: { start:{rule:positionSyntax,example:'1:1'}, pitch:{rule:parsePitch,example:'C4'}, duration:{rule:durationSyntax,example:'1/4'}, velocity:{rule:velocity,optional:true,example:0.8} },
};
const aliases: Record<Kind, Record<string,string>> = {
  project:{tempo:'bpm',time_signature:'timeSignature',timesig:'timeSignature',meter:'timeSignature',signature:'timeSignature',length:'bars',measures:'bars',numBars:'bars',name:'title',version:'formatVersion',schemaVersion:'formatVersion',format:'formatVersion',instruments:'tracks',parts:'tracks',patterns:'tracks[i].patterns',notes:'tracks[i].patterns[j].notes'},
  track:{name:'id',program:'instrument',patch:'instrument',sound:'instrument',preset:'instrument',notes:'patterns',arrangement:'clips',placements:'clips',sequence:'clips'},
  instrument:{kind:'type',preset:'program',patch:'program',name:'program',sound:'program'},
  clip:{start:'bar',at:'bar',position:'bar',measure:'bar',patternId:'pattern',ref:'pattern',id:'pattern',name:'pattern'},
  pattern:{name:'id',length:'bars',measures:'bars',events:'notes'},
  note:{at:'start',time:'start',position:'start',onset:'start',tick:'start',dur:'duration',length:'duration',len:'duration',value:'duration',vel:'velocity',volume:'velocity',dynamics:'velocity',note:'pitch',midi:'pitch',key:'pitch',pitches:'pitch',notes:'pitch'},
};
function number(min: number, max: number, integer = false): Rule {
  return (v,p) => typeof v !== 'number' || !Number.isFinite(v) || (integer && !Number.isInteger(v))
    ? { diagnostic:diagnostic('WRONG_TYPE',p,v,integer?'integer':'finite number') }
    : v < min || v > max ? { diagnostic:diagnostic('OUT_OF_RANGE',p,v,`${min} through ${max}`) } : {value:v};
}
function string(max: number, nonblank = false): Rule {
  return (v,p) => typeof v !== 'string' ? {diagnostic:diagnostic('WRONG_TYPE',p,v,'string')}
    : v.length > max || (nonblank && !v.trim()) ? {diagnostic:diagnostic('OUT_OF_RANGE',p,v,`${nonblank?'1':'0'}–${max} characters${nonblank?', not only whitespace':''}`)} : {value:v};
}
function id(v: unknown,p: string): Parsed<string> {
  if (typeof v !== 'string') return {diagnostic:diagnostic('WRONG_TYPE',p,v,'kebab-case id string')};
  if (!/^[a-z][a-z0-9-]*$/.test(v) || v.length > 32) return {diagnostic:diagnostic('INVALID_ID',p,v,'lowercase id, starting with a letter, at most 32 characters',`Use "${v.toLowerCase().replace(/[ _]+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/^[^a-z]+/,'').slice(0,32) || 'item'}".`)};
  return {value:v};
}
function instrumentType(v: unknown,p: string): Parsed<string> {
  return v === 'gm' || v === 'sampler' || v === 'drumkit' ? {value:v} : {diagnostic:diagnostic(typeof v === 'string'?'UNSUPPORTED_INSTRUMENT_TYPE':'WRONG_TYPE',p,v,'"gm", "sampler" or "drumkit"')};
}
function velocity(v: unknown,p: string): Parsed<unknown> {
  const result=number(Number.MIN_VALUE,1)(v,p);
  if (result.diagnostic && typeof v === 'number' && v > 1 && v <=127) result.diagnostic.hint=`MIDI-style velocity; use v/127 = ${(v/127).toFixed(2)}.`;
  return result;
}
function isObject(v: unknown): v is ObjectValue { return v !== null && typeof v === 'object' && !Array.isArray(v); }

export function validateProject(value: unknown, kits: Kits = new Map()): { project: Project | null; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[]=[];
  const parsed=new Map<string,unknown>();
  const order=new Map<string,number>();
  const objects: {kind:Kind; value:ObjectValue; path:string}[]=[];
  const add=(d:Diagnostic)=>diagnostics.push(d);
  const get=<T>(p:string):T|undefined=>parsed.get(p) as T|undefined;
  if (isObject(value) && Object.hasOwn(value,'formatVersion') && value.formatVersion !== 1)
    return {project:null,diagnostics:[diagnostic('UNSUPPORTED_FORMAT_VERSION','formatVersion',value.formatVersion,'1','This engine reads formatVersion 1.')]};
  function visit(v:unknown,kind:Kind,path:string):void {
    if(!order.has(path))order.set(path,order.size);
    if (!isObject(v)) { add(diagnostic('WRONG_TYPE',path,v,'object')); return; }
    parsed.set(path,v); objects.push({kind,value:v,path});
    const trackPath = /^(tracks\[\d+\])/.exec(path)?.[1];
    const instrument = get<ObjectValue>(`${trackPath}.instrument`);
    const type = kind === 'instrument' ? v.type : instrument?.type;
    let schema = fields[kind];
    if (kind === 'instrument' && (type === 'sampler' || type === 'drumkit')) schema = {
      type: fields.instrument.type!, [type === 'sampler' ? 'sample' : 'kit']: {rule:assetPath,example:type === 'sampler'?'assets/impact.wav':'assets/kit/kit.json'},
    };
    if (kind === 'note' && (type === 'sampler' || type === 'drumkit')) schema = {
      start:fields.note.start!, ...(type === 'drumkit' ? {pitch:{rule:(v:unknown,p:string):Parsed<unknown>=>{
        const entries=kits.get(instrument?.kit as string);
        const named=entries?.find(e=>e.name===v);
        const pitch=named?{value:named.pitch}:parsePitch(v,p);
        if (!entries) return {diagnostic:diagnostic('INVALID_DRUMKIT',p,instrument?.kit,'loaded valid drum kit')};
        return !pitch.diagnostic && entries.some(e=>e.pitch===pitch.value) ? pitch : {diagnostic:diagnostic('UNKNOWN_DRUM_HIT',p,v,`kit name or pitch: ${entries.map(e=>`${e.name} (${e.pitch})`).join(', ')}`)};
      },example:'kick'}} : {}), velocity:fields.note.velocity!,
    };
    for (const [name,field] of Object.entries(schema)) {
      const p=formatPath(path,name); order.set(p,order.size);
      if (!Object.hasOwn(v,name)) { if (!field.optional) add(diagnostic('MISSING_FIELD',p,undefined,`required ${name}`,`Add ${JSON.stringify(name)}: ${JSON.stringify(field.example)}.`)); continue; }
      const item=v[name];
      if (field.object) {visit(item,field.object,p);continue;}
      if (field.array) {
        if (!Array.isArray(item)) {add(diagnostic('WRONG_TYPE',p,item,'array'));continue;}
        parsed.set(p,item);
        if (name === 'tracks' && (item.length<1 || item.length>15)) add(diagnostic('OUT_OF_RANGE',p,item,'1–15 tracks'));
        item.forEach((child,i)=>visit(child,field.array!,formatPath(p,i))); continue;
      }
      if (kind==='note' && name==='pitch' && Array.isArray(item) && type !== 'drumkit') {
        if (!item.length) {add(diagnostic('OUT_OF_RANGE',p,item,'non-empty pitch array'));continue;}
        const pitches:number[]=[];
        item.forEach((pitch,i)=>{const q=formatPath(p,i);order.set(q,order.size);const r=parsePitch(pitch,q);if(r.diagnostic)add(r.diagnostic);else pitches.push(r.value);});
        if(pitches.length===item.length)parsed.set(p,pitches);continue;
      }
      const r=field.rule!(item,p);
      if(r.diagnostic)add(r.diagnostic);else parsed.set(p,kind==='note'&&name==='pitch'?[r.value]:r.value);
    }
    for(const name of Object.keys(v)) if(!Object.hasOwn(schema,name)) {
      const p=formatPath(path,name);order.set(p,order.size);
      const alias=Object.hasOwn(aliases[kind],name)?aliases[kind][name]:undefined;
      const candidate=alias ?? didYouMean(name,Object.keys(fields[kind]),2);
      let hint=candidate && (!alias || !Object.hasOwn(v,candidate))?`Use ${candidate}.`:undefined;
      if(hint && kind==='track' && candidate==='instrument')hint='Use instrument: {"type": "gm", "program": "acoustic_grand_piano"}.';
      if(hint && kind==='track' && name==='notes')hint='Notes live inside patterns; place patterns with clips.';
      add(diagnostic('UNKNOWN_FIELD',p,v[name],`allowed fields: ${Object.keys(schema).join(', ')}`,hint));
    }
  }
  visit(value,'project','');
  const meter=get<TimeSignature>('timeSignature');
  const projectBars=get<number>('bars');
  const firstIds=new Map<string,string>();
  for(const o of objects) {
    const p=o.path;
    if(o.kind==='track'||o.kind==='pattern') {
      const idValue=get<string>(`${p}.id`);
      const scope=o.kind==='track'?'tracks':p.slice(0,p.lastIndexOf('['));
      if(idValue!==undefined) {const key=`${scope}/${idValue}`,first=firstIds.get(key);if(first)add(diagnostic('DUPLICATE_ID',`${p}.id`,idValue,'unique id',`First occurrence: ${first}.`));else firstIds.set(key,`${p}.id`);}
    }
    if(o.kind==='track') {
      const clips=get<unknown[]>(`${p}.clips`),patterns=get<unknown[]>(`${p}.patterns`);
      if(clips?.length===0)add({ ...diagnostic('TRACK_EMPTY',`${p}.clips`,clips,'clips to play'),severity:'warning'});
      if(patterns && clips) {
        const candidates=patterns.flatMap((_,i)=>{const id=get<string>(`${p}.patterns[${i}].id`);return id===undefined?[]:[id];});
        clips.forEach((_,i)=>{
          const cp=`${p}.clips[${i}]`,ref=get<string>(`${cp}.pattern`),bar=get<number>(`${cp}.bar`);
          if(ref===undefined)return;
          const index=patterns.findIndex((_,j)=>get<string>(`${p}.patterns[${j}].id`)===ref);
          if(index<0) {const suggestion=didYouMean(ref,candidates,2);add(diagnostic('UNKNOWN_PATTERN',`${cp}.pattern`,ref,`one of: ${candidates.join(', ')}`,suggestion?`Use "${suggestion}".`:undefined));return;}
          const bars=get<number>(`${p}.patterns[${index}].bars`);
          if(meter && bar!==undefined && bars!==undefined && projectBars!==undefined && bar+bars-1>projectBars) add(diagnostic('CLIP_EXCEEDS_PROJECT',`${cp}.bar`,bar,'clip ending within project',`Increase bars to ${bar+bars-1} or move the clip.`));
        });
        patterns.forEach((_,i)=>{const pp=`${p}.patterns[${i}]`,id=get<string>(`${pp}.id`);if(id!==undefined && !clips.some((_,j)=>get<string>(`${p}.clips[${j}].pattern`)===id))add({...diagnostic('PATTERN_UNUSED',pp,id,'pattern referenced by a clip'),severity:'warning'});});
      }
    }
    if(o.kind==='note' && meter) {
      const pp=p.slice(0,p.lastIndexOf('.notes['));const bars=get<number>(`${pp}.bars`);
      let start:number|undefined,duration:number|undefined;
      if(parsed.has(`${p}.start`)) {const r=parsePosition(o.value.start,meter,bars??10000,`${p}.start`);if(r.diagnostic)add(r.diagnostic);else {start=r.value;parsed.set(`${p}.startTicks`,start);}}
      if(parsed.has(`${p}.duration`)) {const r=parseDuration(o.value.duration,`${p}.duration`);if(r.diagnostic)add(r.diagnostic);else {duration=r.value;parsed.set(`${p}.durationTicks`,duration);}}
      if(bars!==undefined && start!==undefined && duration!==undefined && start+duration>bars*ticksPerBar(meter))add(diagnostic('NOTE_EXCEEDS_PATTERN',`${p}.duration`,o.value.duration,'note ending within pattern',`Use at most "${formatDuration(bars*ticksPerBar(meter)-start)}" or lengthen the pattern.`));
    }
  }
  diagnostics.sort((a,b)=>(order.get(a.path)??0)-(order.get(b.path)??0));
  if(diagnostics.some(d=>d.severity==='error'))return {project:null,diagnostics};
  const read=<T>(p:string):T=>get<T>(p)!;
  const project:Project={formatVersion:1,title:read('title'),description:get<string>('description')??null,bpm:read('bpm'),timeSignature:meter!,key:get<Key>('key')??null,bars:projectBars!,seed:get<number>('seed')??0,
    tracks:read<unknown[]>('tracks').map((_,i)=>{
      const p=`tracks[${i}]`,raw=read<ObjectValue>(`${p}.instrument`);
      return {id:read<string>(`${p}.id`),description:get<string>(`${p}.description`)??null,instrument:raw.type === 'sampler' ? {type:'sampler',sample:raw.sample as string} : raw.type === 'drumkit' ? {type:'drumkit',kit:raw.kit as string} : {type:'gm',program:read<number>(`${p}.instrument.program`),programName:raw.program as string},
        clips:read<unknown[]>(`${p}.clips`).map((_,j)=>({bar:read<number>(`${p}.clips[${j}].bar`),pattern:read<string>(`${p}.clips[${j}].pattern`)})),
        patterns:read<unknown[]>(`${p}.patterns`).map((_,j)=>{const pp=`${p}.patterns[${j}]`;return {id:read<string>(`${pp}.id`),description:get<string>(`${pp}.description`)??null,bars:read<number>(`${pp}.bars`),notes:read<unknown[]>(`${pp}.notes`).map((_,k)=>{const np=`${pp}.notes[${k}]`;return {startTicks:read<number>(`${np}.startTicks`),durationTicks:get<number>(`${np}.durationTicks`)??0,pitches:get<number[]>(`${np}.pitch`)??[60],velocity:get<number>(`${np}.velocity`)??0.8};})};})};
    })};
  return {project,diagnostics};
}
