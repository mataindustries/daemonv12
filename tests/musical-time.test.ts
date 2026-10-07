import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDuration, parsePosition, parseTimeSignature, formatDuration, formatPosition, ticksPerBar, ticksToSeconds, usPerQuarter } from '../src/timing/musical-time.ts';
const meter = (s: string) => { const p = parseTimeSignature(s); assert.ok(p.value); return p.value; };
test('all duration examples and hints, exact grid', () => {
  for (const [s, n] of Object.entries({ '1/4':960, '1/8':480, '3/8':1440, '1/1':3840, '2/1':7680, '1/12':320, '1/20':192, '1/256':15 })) assert.equal(parseDuration(s).value, n);
  for (const s of ['1/7', '1/512']) assert.equal(parseDuration(s).diagnostic?.code, 'OFF_GRID');
  for (const s of ['0/4', '01/4', '-1/4', '1/0', '1/04', '10000/1', '1/4 ', '0.25']) assert.equal(parseDuration(s).diagnostic?.code, 'INVALID_DURATION');
  for (const [s, hint] of Object.entries({ '4n':'1/4', '8t':'1/12', '4n.':'3/8', '1/4.':'3/8', '1':'1/1' })) assert.ok(parseDuration(s).diagnostic?.hint?.includes(hint));
  assert.equal(parseDuration(0.25).diagnostic?.code, 'WRONG_TYPE');
  assert.equal(formatDuration(1440), '3/8'); assert.equal(formatDuration(7680), '2/1');
  assert.equal(parseDuration('9999/1').value, 38396160);
});
test('all position examples, canonical errors and meter boundaries', () => {
  for (const [s, pos, ticks] of [['4/4','3:2+1/8',9120], ['3/4','2:3',4800], ['6/8','2:4',4320], ['6/8','1:1+1/16',240], ['7/8','1:7',2880], ['2/2','1:2',1920], ['2/2','1:1+1/4',960], ['4/4','1:1+1/12',320], ['4/4','1:1+1/6',640]] as const) assert.equal(parsePosition(pos,meter(s),4).value,ticks);
  for (const [s,pos,hint] of [['4/4','1:1+1/4','1:2'], ['4/4','1:5','2:1'], ['6/8','1:1+1/8','1:2']] as const) { const d=parsePosition(pos,meter(s),4).diagnostic; assert.equal(d?.code,'POSITION_OUT_OF_RANGE'); assert.ok(d?.hint?.includes(hint)); }
  for (const [ticks,s] of [[0,'1:1'],[1440,'1:2+1/8'],[640,'1:1+1/6'],[3840,'2:1']] as const) assert.equal(formatPosition(ticks,meter('4/4')),s);
  for (const s of ['0:1','1:0','01:1','1.2.1','1:1+0/4','1:1 ']) assert.equal(parsePosition(s,meter('4/4'),1).diagnostic?.code,'INVALID_POSITION');
  assert.equal(parsePosition('1:1+1/7',meter('4/4'),1).diagnostic?.code,'OFF_GRID');
  assert.equal(parsePosition('2:1',meter('4/4'),1).diagnostic?.code,'POSITION_OUT_OF_RANGE');
  for (const s of ['4/3','33/4','04/4','4:4','C','0/4']) assert.equal(parseTimeSignature(s).diagnostic?.code,'INVALID_TIME_SIGNATURE');
  assert.equal(ticksPerBar(meter('32/1'))*1000,122880000);
});
test('tempo and seconds reporting', () => {
  assert.deepEqual([96,120,110].map(usPerQuarter),[625000,500000,545455]);
  assert.equal(ticksToSeconds(30720,usPerQuarter(96)),20);
});
