import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePitch } from '../src/project/pitch.ts';
import { parseKey } from '../src/project/key.ts';
import { GM_PROGRAMS, GM_ALIASES, parseProgram } from '../src/project/gm-programs.ts';
test('pitch grammar, enharmonics and range', () => {
  for (const [p,n] of Object.entries({ C4:60,A4:69,'C-1':0,G9:127,Bb1:34,D2:38,'C#5':73,'B#3':60,Cb4:59,'E#4':65 })) assert.equal(parsePitch(p).value,n);
  for (let i=0;i<128;i++) assert.equal(parsePitch(i).value,i);
  for (const p of ['H#4','c4','C#','C10','G#9','Cb-1','60',-1,128,60.5,' C4']) assert.equal(parsePitch(p).diagnostic?.code,'INVALID_PITCH');
  for (const [p,h] of [['c4','C4'],['Db','Db4'],['F♯4','F#4'],['B♭3','Bb3'],['H4','B4']] as const) assert.ok(parsePitch(p).diagnostic?.hint?.includes(h));
  assert.equal(parsePitch(null).diagnostic?.code,'WRONG_TYPE');
});
test('all 30 signatures and helpful aliases', () => {
  const major='Cb Gb Db Ab Eb Bb F C G D A E B F# C#'.split(' ');
  const minor='Ab Eb Bb F C G D A E B F# C# G# D# A#'.split(' ');
  for (const [mode,tonics] of [['major',major],['minor',minor]] as const) tonics.forEach((tonic,i)=>assert.deepEqual(parseKey(`${tonic} ${mode}`).value,{text:`${tonic} ${mode}`,sharpsFlats:i-7,mode}));
  assert.ok(parseKey('D# major').diagnostic?.hint?.includes('Eb major'));
  for (const k of ['Dm','D min','d minor']) assert.ok(parseKey(k).diagnostic?.hint?.includes('D minor'));
  for (const k of ['D dorian','D minor ','C## major']) assert.equal(parseKey(k).diagnostic?.code,'INVALID_KEY');
});
test('complete GM table and aliases', () => {
  assert.equal(GM_PROGRAMS.length,128); assert.equal(new Set(GM_PROGRAMS).size,128);
  assert.equal(GM_PROGRAMS[33],'electric_bass_finger'); assert.equal(GM_PROGRAMS[127],'gunshot');
  GM_PROGRAMS.forEach((p,i)=>assert.equal(parseProgram(p).value,i));
  for (const [alias,name] of Object.entries(GM_ALIASES)) assert.ok(parseProgram(alias).diagnostic?.hint?.includes(name));
  assert.match(parseProgram(33).diagnostic!.hint!,/electric_bass_finger.*acoustic_bass/);
  assert.ok(parseProgram('acoustic_grand_pianoo').diagnostic?.hint?.includes('acoustic_grand_piano'));
});
