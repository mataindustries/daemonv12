import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import tonejs from '@tonejs/midi';
import { compileProjectFile } from '../src/pipeline.ts';
import { encodeSmf } from '../src/midi/smf.ts';
test('demo golden bytes, conductor, independent note parser',()=>{
 const c=compileProjectFile('examples/demo.json');assert.deepEqual(c.diagnostics,[]);
 const bytes=Buffer.from(encodeSmf(c.timeline!));assert.equal(bytes.length,911);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'32bf52317120de2c48a5cab8292a614724c63acf3940ffa84f24a5fcebd536dc');
 assert.equal(bytes.readUInt16BE(8),1);assert.equal(bytes.readUInt16BE(10),3);assert.equal(bytes.readUInt16BE(12),960);
 let offset=14,count=0;while(offset<bytes.length){assert.equal(bytes.toString('ascii',offset,offset+4),'MTrk');offset+=8+bytes.readUInt32BE(offset+4);count++;}assert.equal(count,3);assert.equal(offset,bytes.length);
 for(const h of ['ff580404021808','ff5902ff01','ff5103098968'])assert.ok(bytes.includes(Buffer.from(h,'hex')));
 const midi=new tonejs.Midi(bytes);assert.equal(midi.header.ppq,960);
 assert.deepEqual(midi.tracks.map(t=>[t.name,t.channel,t.instrument.number,t.notes.length,t.endOfTrackTicks]),[['bass',0,33,29,30720],['keys',1,0,60,30720]]);
 assert.equal(midi.durationTicks,30720);assert.equal(midi.duration,20);
 assert.deepEqual([midi.tracks[1]!.notes[0]!.name,midi.tracks[1]!.notes[0]!.ticks,midi.tracks[1]!.notes[0]!.velocity*127],['D4',0,114]);
});
