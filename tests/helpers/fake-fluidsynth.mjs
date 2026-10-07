#!/usr/bin/env node
import { writeFileSync, readFileSync, appendFileSync } from 'node:fs';
const args=process.argv.slice(2);
let mode=process.env.FAKE_FLUIDSYNTH_MODE??'ok';
if(args.includes('--version')) {
  if(mode==='probe-fail'){process.stderr.write('probe failed\n');process.exitCode=1;}
  else if(mode==='probe-hang')setInterval(()=>{},1000);
  else process.stdout.write(mode==='unknown-version'?'custom renderer\n':'FluidSynth runtime version 9.9.9\n');
} else {
  const out=args[args.indexOf('-F')+1];
  if (process.env.FAKE_FAIL_OUTPUT && !out.endsWith('/'+process.env.FAKE_FAIL_OUTPUT+'.wav.tmp')) mode='ok';
  if (process.env.FAKE_MIDI_LOG) appendFileSync(process.env.FAKE_MIDI_LOG,JSON.stringify({out,midi:readFileSync(args.at(-1)).toString('hex')})+'\n');
  if(mode==='hang')setInterval(()=>{},1000);
  else if(mode==='exit-1'){process.stderr.write('failed\n');process.exitCode=1;}
  else if(mode==='no-output') { /* Mimic a false success without any file. */ }
  else if(mode==='bad-wav')writeFileSync(out,'not a wav');
  else {
    const frames=mode==='empty-wav'?0:Number(process.env.FAKE_FRAMES??4410),bytes=Buffer.alloc(44+frames*4);
    bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVE',8);
    bytes.write('fmt ',12);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(mode==='float-wav'?3:1,20);
    bytes.writeUInt16LE(2,22);bytes.writeUInt32LE(mode==='wrong-rate'?48000:44100,24);
    bytes.writeUInt32LE((mode==='wrong-rate'?48000:44100)*4,28);bytes.writeUInt16LE(4,32);bytes.writeUInt16LE(16,34);
    bytes.write('data',36);bytes.writeUInt32LE(frames*4,40);writeFileSync(out,bytes);
    if(mode==='silent-error')process.stderr.write("fluidsynth: error: fluid_is_soundfont(): fopen() failed: 'File does not exist.'\n");
    if(mode==='long-error')process.stderr.write('x'.repeat(3000)+'\npanic: bad synth\n');
  }
}
