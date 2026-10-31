// THE MOUTH DROP, pass 2: take bar 6 of the rendered CREST prepass (the finished beat, every
// track, no master processing) and feed it through the MORPH//03 vocal tract (sounds.mjs
// mouthDrop). Writes assets/mouth/swallow.wav + kit.json for the final CREST project.
// Run after: node arrange.mjs --prepass crest && daemonv12 render crest.prepass.json --out-dir renders/crest-prepass
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { mouthDrop, readWav, writeWav, S16, SR } from './sounds.mjs';

const HERE = new URL('./', import.meta.url).pathname;
const BAR = 16 * S16, BAR_FRAMES = 110250; // exactly 110250 frames per bar at 96 BPM
const pre = readWav(readFileSync(HERE + 'renders/crest-prepass/crest.prepass.wav'));
const from = 5 * BAR_FRAMES;
const bus = { L: pre.L.slice(from), R: pre.R.slice(from) };
// beats: 1 open "ah", rounding through 2, sealed "mm" on 3 + 1/4, silence on 4, breath rising into the slam
const out = mouthDrop(bus, { bar: BAR, sealAt: 1.4, silenceAt: 12 * S16, breathFrom: 12.5 * S16 });
const path = HERE + 'assets/mouth/swallow.wav';
mkdirSync(HERE + 'assets/mouth', { recursive: true });
// written at the prepass's own scale (prepass master -6 dB; the final's mouth track adds it back)
writeWav(path, out.subarray(0, Math.round(BAR * SR)), null);
writeFileSync(HERE + 'assets/mouth/kit.json', JSON.stringify({ formatVersion: 1, samples: [{ name: 'swallow', pitch: 60, file: 'swallow.wav' }] }, null, 2) + '\n');
console.log('swallow.wav', createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16));
