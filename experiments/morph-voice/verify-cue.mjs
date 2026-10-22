import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeWav, analyzeWav } from './wav.mjs';

// Check the exported result independently of the engine's render-plan math.
export function verifyCue(outputRoot) {
  const root = resolve(outputRoot), cue = join(root, 'cue');
  const load = path => JSON.parse(readFileSync(path));
  const project = load(join(cue, 'morph-01-cue.json'));
  const result = load(join(cue, 'pipeline-result.json'));
  const map = load(join(cue, 'visual-events.json'));
  const performance = load(join(root, 'performances', 'the-performance.json'));
  assert.deepEqual(result.errors, []); assert.deepEqual(result.warnings, []);
  const masterPath = join(cue, result.artifacts.wav), master = decodeWav(readFileSync(masterPath));
  const stems = result.artifacts.stems.map(stem => decodeWav(readFileSync(join(cue, stem.wav))));
  assert.equal(stems.length, 5);
  for (const audio of [master, ...stems]) {
    assert.equal(audio.frames, 529200); assert.equal(audio.sampleRate, 44100); assert.equal(audio.channels, 2);
    assert.deepEqual([...audio.samples.slice(0, 2)], [0, 0]);
    assert.deepEqual([...audio.samples.slice(-2)], [0, 0]);
    assert.ok(audio.samples.every(value => value > -1 && value < 32767 / 32768));
  }
  assert.ok(!project.master.effects?.length, 'This reconstruction covers the cue master gain');
  const gain = 10 ** (project.master.gainDb / 20);
  let mismatch = 0;
  for (let i = 0; i < master.samples.length; i++) {
    let sum = 0;
    for (const stem of stems) sum += stem.samples[i] * 32768;
    if (Math.round(sum * gain) !== master.samples[i] * 32768) mismatch++;
  }
  assert.equal(mismatch, 0, 'Processed stem sum plus master gain must reconstruct cue');
  assert.equal(map.frames.length, 720); assert.equal(map.pictureEndExclusive, 720);
  assert.equal(map.audioEndExclusive, 529200);
  map.frames.forEach((frame, i) => {
    assert.equal(frame.pictureFrame, i); assert.equal(frame.audioFrame, Math.round(i * 44100 / 60));
    assert.equal(frame.audioEndExclusive, Math.round((i + 1) * 44100 / 60));
  });
  const notes = map.events.filter(event => event.kind === 'morph-note');
  assert.equal(notes.length, performance.notes.length);
  notes.forEach((event, i) => {
    const note = performance.notes[i];
    assert.equal(event.audioFrame, Math.round(note.at * 44100));
    assert.equal(event.pictureFrame, Math.round(note.at * 60));
    assert.equal(event.midi, note.midi);
  });
  const report = {passed:true, master:analyzeWav(readFileSync(masterPath)),
    stemCount:stems.length, stemReconstructionMismatchedChannelSamples:mismatch,
    comparedMasterChannelSamples:master.samples.length, pictureFrames:map.frames.length,
    audioEndExclusive:map.audioEndExclusive, sourceNoteEvents:notes.length,
    maximumPictureResidualSeconds:Math.max(...notes.map(event => Math.abs(event.pictureResidualSeconds))),
    pipelineWarnings:result.warnings};
  writeFileSync(join(root, 'analysis', 'cue-verification.json'), JSON.stringify(report,null,2)+'\n');
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] || resolve(fileURLToPath(new URL('./renders/',import.meta.url)));
  console.log(JSON.stringify(verifyCue(root),null,2));
}
