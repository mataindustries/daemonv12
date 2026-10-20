// Writes src/sync/sync.json, the only music data the film reads.
//
//   node scripts/analyze.ts                       # analyse public/audio/ignition-002-second-wind.wav
//   node scripts/analyze.ts --wav path/to/file.wav
//   node scripts/analyze.ts --grid                # labelled 128 BPM grid stand-in (no audio)
//   node scripts/analyze.ts --out src/v12/sync.json  # write another composition's sync data
//
// The WAV must match the approved SHA-256. A summary of the music's structure is printed and
// saved to out/audio-analysis.json for the quality report.
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {gridSync, assertSync, type SyncData} from '../src/sync/contract.ts';
import {BAR, BEAT, LOOP} from '../src/timeline.ts';
import {analyzeLoop, seamReport} from './lib/analyze.ts';
import {APPROVED_SHA256, approvedWavPath} from './lib/approved.ts';
import {decodeWav, mixdown} from './lib/wav.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {values} = parseArgs({
  options: {
    wav: {type: 'string', default: approvedWavPath(root)},
    grid: {type: 'boolean', default: false},
    out: {type: 'string', default: join(root, 'src', 'sync', 'sync.json')},
  },
});
const syncPath = resolve(values.out!);

const write = (data: SyncData) => writeFileSync(syncPath, JSON.stringify(assertSync(data)) + '\n');

if (values.grid) {
  write(gridSync());
  console.log(`${syncPath}\n  source: grid (placeholder; the approved WAV has not been analysed)`);
  process.exit(0);
}

const wavPath = resolve(values.wav!);
if (!existsSync(wavPath)) {
  console.error(`missing ${wavPath}\nPlace the approved WAV there (see README), or run with --grid for the placeholder.`);
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

const a = analyzeLoop(mixdown(pcm), pcm.sampleRate);
const data: SyncData = {
  version: 1,
  source: 'analysis',
  note: 'Measured from the approved WAV by scripts/analyze.ts.',
  audio: {file: 'ignition-002-second-wind.wav', sha256, sampleRate: pcm.sampleRate, channels: pcm.channels.length, bitsPerSample: pcm.bitsPerSample, frames: pcm.frames, seconds},
  bpm: 128,
  loopSeconds: LOOP,
  gridOffset: a.gridOffset,
  kick: a.kick,
  snare: a.snare,
  hat: a.hat,
  accents: a.accents,
  loudness: a.frames.full,
  low: a.frames.low,
  mid: a.frames.mid,
  high: a.frames.high,
};
write(data);

const pos = (t: number) => `${Math.floor(t / BAR) + 1}:${(Math.floor((t % BAR) / BEAT) + 1).toString()}+${(((t % BEAT) / (BEAT / 4)) | 0).toString()}/4`;
const seam = seamReport(pcm.channels, pcm.sampleRate);
const summary = {
  file: wavPath,
  sha256,
  sampleRate: pcm.sampleRate,
  channels: pcm.channels.length,
  bitsPerSample: pcm.bitsPerSample,
  seconds,
  gridOffsetMs: Math.round(a.gridOffset * 1000),
  barsDb: a.barsDb,
  counts: {kick: a.kick.length, snare: a.snare.length, hat: a.hat.length, offGrid: a.offGrid.length},
  kick: a.kick.map(h => `${pos(h.t)} ${h.s.toFixed(2)}`),
  snare: a.snare.map(h => `${pos(h.t)} ${h.s.toFixed(2)}`),
  accents: a.accents.map(h => `${pos(h.t)} ${h.s.toFixed(2)}`),
  offGrid: a.offGrid.slice(0, 20),
  seam,
};
mkdirSync(join(root, 'out'), {recursive: true});
writeFileSync(join(root, 'out', 'audio-analysis.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({...summary, kick: summary.kick.length, snare: summary.snare}, null, 2));
