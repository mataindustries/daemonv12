// Writes src/v12/sync.json for V12 OVERDRIVE from the approved WAV.
//
//   node scripts/analyze-v12.ts            # analyse public/audio/ignition-002-second-wind.wav
//
// Harmonic/percussive separation (scripts/lib/analyze-v12.ts) gives five layers: kick, clap,
// hats, brass and bass. A summary is printed and saved to out/v12/audio-analysis.json.
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {LOOP} from '../src/timeline.ts';
import {assertV12Sync, type V12Sync} from '../src/v12/sync.ts';
import {seamReport} from './lib/analyze.ts';
import {describe, dropouts, frameLevels, gridOnsets, mergePhrases, phrases, separate, snap, structuralAccents, tailHits} from './lib/analyze-v12.ts';
import {APPROVED_SHA256, approvedWavPath} from './lib/approved.ts';
import {decodeWav, mixdown} from './lib/wav.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {values} = parseArgs({options: {wav: {type: 'string', default: approvedWavPath(root)}, out: {type: 'string', default: join(root, 'src', 'v12', 'sync.json')}}});
const wavPath = resolve(values.wav!);
if (!existsSync(wavPath)) {
  console.error(`missing ${wavPath}: place the approved WAV there first.`);
  process.exit(1);
}
const bytes = readFileSync(wavPath);
const sha256 = createHash('sha256').update(bytes).digest('hex');
if (sha256 !== APPROVED_SHA256) {
  console.error(`${wavPath}\n  SHA-256 ${sha256}\n  expected ${APPROVED_SHA256}\nThis is not the approved master; refusing to analyse it.`);
  process.exit(1);
}
const pcm = decodeWav(bytes, wavPath);
const seconds = pcm.frames / pcm.sampleRate;
if (Math.abs(seconds - LOOP) > 0.001) {
  console.error(`${wavPath} is ${seconds.toFixed(6)} s; the film is locked to exactly ${LOOP} s.`);
  process.exit(1);
}

const L = separate(mixdown(pcm), pcm.sampleRate);
// The STFT window sees an onset ~20 ms early; every hit in this track sits on its sixteenth, so
// events are stamped with their exact grid time.
// Linear amplitude ratios: the groove kicks are nearly equal, and the film must not pretend otherwise.
const kick = snap(gridOnsets(L, 'kick', 6, 9));
const snare = tailHits(L, 6.5);
const hat = snap(gridOnsets(L, 'hat', 4, 18));
const brass = snap(gridOnsets(L, 'brass', 6, 9));
const brassLevel = frameLevels(L, 'brass', 30, 0.08);
const bass = frameLevels(L, 'bass', 30, 0.06);
const loudness = frameLevels(L, 'full', 36, 0.03);
const drops = dropouts(loudness, 0.3, 0.1);
const structural = structuralAccents(kick, brass, drops);
const accents = structural.map(({t, s}) => ({t, s}));

const data: V12Sync = {
  version: 1,
  source: 'analysis',
  note: 'Measured from the approved WAV by scripts/analyze-v12.ts (circular STFT, median-filter HPSS).',
  audio: {file: 'ignition-002-second-wind.wav', sha256, sampleRate: pcm.sampleRate, channels: pcm.channels.length, bitsPerSample: pcm.bitsPerSample, frames: pcm.frames, seconds},
  bpm: 128,
  loopSeconds: LOOP,
  gridOffset: 0,
  kick: kick.map(({t, s}) => ({t, s})),
  snare: snare.map(({t, s}) => ({t, s})),
  hat: hat.map(({t, s}) => ({t, s})),
  brass: brass.map(({t, s}) => ({t, s})),
  brassPhrases: mergePhrases(phrases(brassLevel, 0.8, 0.25), 0.25),
  accents,
  dropouts: drops,
  markers: {
    reignite: structural.find(a => a.why.startsWith('re-ignition'))?.t ?? 0,
    payoff: structural.find(a => a.why.startsWith('payoff'))?.t ?? 0,
  },
  bass,
  loudness,
};
writeFileSync(resolve(values.out!), JSON.stringify(assertV12Sync(data)) + '\n');

const summary = {
  file: wavPath,
  sha256,
  counts: {kick: kick.length, snare: snare.length, hat: hat.length, brass: brass.length, phrases: data.brassPhrases.length},
  kick: kick.map(e => `${describe(e.t)} ${e.s.toFixed(2)}`),
  snare: snare.map(e => `${describe(e.t)} ${e.s.toFixed(2)}`),
  brass: brass.map(e => `${describe(e.t)} ${e.s.toFixed(2)}`),
  brassPhrases: data.brassPhrases,
  accents: structural.map(e => `${describe(e.t)} ${e.s.toFixed(2)} ${e.why}`),
  dropouts: drops,
  bassPerBar: Array.from({length: 8}, (_, b) => Math.round((bass.slice(b * 112.5, (b + 1) * 112.5).reduce((p, q) => p + q, 0) / 112.5) * 100) / 100),
  loudnessPerBar: Array.from({length: 8}, (_, b) => Math.round((loudness.slice(b * 112.5, (b + 1) * 112.5).reduce((p, q) => p + q, 0) / 112.5) * 100) / 100),
  seam: seamReport(pcm.channels, pcm.sampleRate),
};
mkdirSync(join(root, 'out', 'v12'), {recursive: true});
writeFileSync(join(root, 'out', 'v12', 'audio-analysis.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 1));
