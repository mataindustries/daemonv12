/** WEST//GHOST 001 offline performance compiler; v0.7 projects are its portable playback format.
 * node scripts/generate-westghost.ts [pack-root]
 * node scripts/generate-westghost.ts --score your-score.json --out-dir work/your-performance
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SR, gravity, vandal, validatePerformance, type Performance } from './westghost-dsp.ts';
import { apparition, ironBloom } from './westghost-resonators.ts';
import { demonstrationScores, referencePerformances } from './westghost-scores.ts';
import { ticksToFrames, usPerQuarter } from '../src/timing/musical-time.ts';

export { validatePerformance } from './westghost-dsp.ts';
export type { Performance } from './westghost-dsp.ts';
export interface Event { step: number; performance: Performance }
export interface ScoreTrack { id: string; gainDb: number; pan?: number; events: Event[] }
export interface Score { id: string; title: string; description: string; bpm: number; bars: number; tracks: ScoreTrack[] }
export const DEFAULT_PACK = 'packs/westghost-001';
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const json = (file: string, value: unknown) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); };
export function synthesize(p: Performance): Float64Array {
  validatePerformance(p);
  const samples = ({ gravity, vandal, apparition, 'iron-bloom': ironBloom })[p.instrument](p);
  for (const x of samples) if (!Number.isFinite(x) || Math.abs(x) >= 0.95) throw new RangeError(`${p.instrument}: unstable or overloaded synthesis`);
  return samples;
}
export function monoWav(samples: Float64Array): Buffer {
  const out = Buffer.alloc(44 + samples.length * 2);
  out.write('RIFF'); out.writeUInt32LE(out.length - 8, 4); out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
  out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34);
  out.write('data', 36); out.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) out.writeInt16LE(Math.round(samples[i]! * 32767), 44 + i * 2);
  return out;
}
export function measure(samples: Float64Array) {
  let peak = 0, sum = 0, energy = 0, maxDifference = 0;
  for (let i = 0; i < samples.length; i++) { const x = samples[i]!; peak = Math.max(peak, Math.abs(x)); sum += x; energy += x * x; if (i) maxDifference = Math.max(maxDifference, Math.abs(x - samples[i - 1]!)); }
  return { frames: samples.length, seconds: samples.length / SR, peakDbfs: 20 * Math.log10(peak), rmsDbfs: 10 * Math.log10(energy / samples.length), dc: sum / samples.length, maxDifference, first: samples[0], last: samples.at(-1) };
}
function sourceHashes() {
  return Object.fromEntries(['generate-westghost.ts', 'westghost-dsp.ts', 'westghost-resonators.ts', 'westghost-scores.ts'].map(name => [name, hash(readFileSync(fileURLToPath(new URL(name, import.meta.url))))]));
}
const position = (step: number) => {
  const bar = Math.floor(step / 16) + 1, beat = Math.floor(step % 16 / 4) + 1, rem = step % 4;
  return `${bar}:${beat}${rem ? `+${rem === 2 ? '1/8' : `${rem}/16`}` : ''}`;
};
export function compileScore(score: Score, root: string) {
  if (typeof score.title !== 'string' || !score.title.trim() || score.title.length > 200 || typeof score.description !== 'string' || score.description.length > 2000) throw new RangeError('Score requires a nonempty title of at most 200 characters and a description of at most 2000 characters');
  if (!/^[a-z][a-z0-9-]{0,60}$/.test(score.id) || !Number.isInteger(score.bars) || score.bars < 1 || score.bars > 64 || !Number.isFinite(score.bpm) || score.bpm < 40 || score.bpm > 240 || !Array.isArray(score.tracks) || score.tracks.length < 1 || score.tracks.length > 15) throw new RangeError('Score requires a safe id, 1..64 bars, 40..240 BPM and 1..15 tracks');
  // Validate the complete score and its unique-source budget before writing anything.
  let totalFrames = 0;
  const tempo = usPerQuarter(score.bpm), outputFrames = ticksToFrames(score.bars * 3840, tempo);
  const ids = new Set<string>();
  for (const track of score.tracks) {
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(track.id) || ids.has(track.id) || !Number.isFinite(track.gainDb) || track.gainDb < -60 || track.gainDb > 0 || (track.pan !== undefined && (!Number.isFinite(track.pan) || Math.abs(track.pan) > 1)) || !Array.isArray(track.events) || track.events.length < 1 || track.events.length > 512) throw new RangeError('Track requires unique safe id, -60..0 dB, pan -1..1 and 1..512 events');
    ids.add(track.id);
    const unique = new Set<string>();
    for (const event of track.events) {
      if (!Number.isInteger(event.step) || event.step < 0 || event.step >= score.bars * 16) throw new RangeError('Event step must be a sixteenth index inside score');
      validatePerformance(event.performance);
      const duration = event.performance.gate + (event.performance.release ?? 0.4);
      if (Math.round(duration * SR) > outputFrames - ticksToFrames(event.step * 240, tempo)) throw new RangeError('Performance release exceeds score boundary; leave space or extend bars');
      const key = JSON.stringify(event.performance);
      if (!unique.has(key)) totalFrames += Math.round(duration * SR);
      unique.add(key);
    }
    if (unique.size > 128) throw new RangeError('At most 128 distinct performances per track; split the score');
  }
  if (totalFrames > 600 * SR) throw new RangeError('Score exceeds 600 seconds of unique synthesis; use documented intermediate scores');
  const tracks = [], assets: object[] = [], hashes = sourceHashes();
  for (const track of score.tracks) {
    const unique = new Map<string, { name: string; pitch: number; file: string }>();
    const notes: object[] = [];
    for (const event of track.events) {
      if (!Number.isInteger(event.step) || event.step < 0 || event.step >= score.bars * 16) throw new RangeError('Event step must be a sixteenth index inside score');
      validatePerformance(event.performance);
      const key = JSON.stringify(event.performance);
      let sample = unique.get(key);
      if (!sample) {
        if (unique.size >= 128) throw new RangeError('At most 128 distinct performances per track; split the score');
        const id = hash(key).slice(0, 16), file = `${track.id}-${id}.wav`, relative = `assets/westghost001/${score.id}/${file}`;
        sample = { name: `p-${id}`, pitch: unique.size, file }; unique.set(key, sample);
        const audio = synthesize(event.performance), bytes = monoWav(audio);
        mkdirSync(dirname(join(root, relative)), { recursive: true }); writeFileSync(join(root, relative), bytes);
        assets.push({ file: relative, sha256: hash(bytes), performance: event.performance, ...measure(audio) });
      }
      notes.push({ start: position(event.step), pitch: sample.name, velocity: 1 });
    }
    const kit = `assets/westghost001/${score.id}/${track.id}.kit.json`;
    json(join(root, kit), { formatVersion: 1, samples: [...unique.values()] });
    tracks.push({ id: track.id, description: 'Native pitch/duration performance; controls are frozen in the source score, with no rate shift.', instrument: { type: 'drumkit', kit }, mix: { gainDb: track.gainDb, ...(track.pan !== undefined ? { pan: track.pan } : {}) }, patterns: [{ id: 'performance', bars: score.bars, notes }], clips: [{ bar: 1, pattern: 'performance' }] });
  }
  const project = { formatVersion: 1, title: score.title, description: score.description, bpm: score.bpm, timeSignature: '4/4', bars: score.bars, seed: 12003, render: { duration: { bars: score.bars }, tail: 'none' }, tracks };
  json(join(root, `${score.id}.json`), project);
  json(join(root, `${score.id}.performance.json`), { ...score, generatorSources: hashes });
  json(join(root, `${score.id}.sources.json`), { schema: 'westghost001-native-performances-1', license: 'pending-owner-declaration', generatorSources: hashes, assets });
  return { project, assets };
}
export function generatePack(root = DEFAULT_PACK) {
  const sounds = [];
  for (const [id, performance] of Object.entries(referencePerformances)) {
    const samples = synthesize(performance), bytes = monoWav(samples), file = `assets/westghost001/${id}.wav`;
    mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), bytes);
    sounds.push({ id, file, sha256: hash(bytes), performance, ...measure(samples) });
  }
  json(join(root, 'westghost001.catalog.json'), { name: 'WEST//GHOST 001', version: '0.1.0', status: 'experimental independent performance instruments', license: 'pending-owner-declaration', sampleRate: SR, portableAssets: 'PCM16 mono; generation Float64, fixed gain, no per-note peak normalization', generatorSources: sourceHashes(), instruments: [
    { id: 'gravity', rangeMidi: [24, 60], articulations: ['sustain', 'impact'], method: 'phase-controlled clean sub plus pressure-driven soft harmonic waveshaping; continuous phase-integrated musical pitch path' },
    { id: 'vandal', rangeMidi: [28, 64], articulations: ['sustain', 'bite'], method: '2x oversampled FM/waveshaping, moving state variable filter, independent rhythmic amplitude and spectral modulation, 105 Hz low cut' },
    { id: 'apparition', rangeMidi: [48, 84], articulations: ['sustain', 'whisper'], method: 'continuous additive formant envelope, harmonic tilt, vowel trajectories, seeded breath and pressure; no recorded or modeled voice' },
    { id: 'iron-bloom', rangeMidi: [36, 84], articulations: ['strike', 'bow'], method: 'original spring/metal-inspired modal bank with hardness, dispersive pitch ratios, moving excitation and sustained bow articulation' },
  ], sounds });
  for (const score of demonstrationScores) compileScore(score, root);
  return sounds;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  if (args[0] === '--score') {
    if (args.length !== 4 || args[2] !== '--out-dir') throw new Error('Usage: --score score.json --out-dir output-directory');
    compileScore(JSON.parse(readFileSync(args[1]!, 'utf8')) as Score, resolve(args[3]!));
  } else {
    if (args.length > 1) throw new Error('Usage: node scripts/generate-westghost.ts [pack-root]');
    generatePack(resolve(args[0] ?? DEFAULT_PACK));
  }
  console.log('WEST//GHOST 001: native performances, v0.7 projects and provenance generated.');
}
