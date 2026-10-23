// Write experiments/morph-06/MANIFEST.json: the base it was built from, the tools, and the SHA-256
// of every source file and delivered artifact (A, B, C and the unchanged V3 reference).
// Usage: node experiments/morph-06/manifest.mjs   (after build.mjs, analyze06.py and event_changes.py)
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..', '..');
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const rel = p => relative(root, p);
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const sh = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: 'utf8' }).split('\n')[0].trim(); } catch { return null; } };

const SOURCES = [
  ...['record.mjs', 'beast.mjs', 'control.mjs', 'v3-levels.json', 'a.mjs', 'b.mjs', 'c.mjs', 'build.mjs', 'analyze06.py', 'event_changes.py', 'spectrograms.py', 'manifest.mjs'].map(f => join(here, f)),
  // reused read-only from earlier experiments
  ...['morph-05/v3.mjs', 'morph-05/checks.py', 'morph-03/cable.mjs', 'morph-03/dsp.mjs', 'morph-03/throat.mjs',
    'morph-03/household.mjs', 'morph-03/analyze.py', 'morph-04/kit.mjs', 'morph-04/perform.mjs', 'morph-04/events.mjs'].map(f => join(here, '..', f)),
];
const audio = join(here, 'audio');
const versions = {};
for (const v of ['a', 'b', 'c']) {
  const d = join(audio, v), meta = JSON.parse(readFileSync(join(d, `cable-beast-${v}.meta.json`), 'utf8'));
  const { CHANGES } = await import(`./${v}.mjs`);
  versions[v] = { title: meta.title, masterWav24Sha256: meta.wav24Sha256, frames: meta.frames, changes: CHANGES, files: Object.fromEntries(walk(d).map(p => [rel(p), sha(p)])) };
}
const v3 = join(here, '..', 'morph-05', 'audio', 'v3');
const v3levels = JSON.parse(readFileSync(join(here, 'v3-levels.json'), 'utf8')).levels;
const manifest = {
  title: 'CABLE//BEAST', experiment: 'MORPH//06', format: { sampleRate: 44100, channels: 2, masterBits: 24, bpm: 120, meter: '4/4', bars: 14, seconds: 28, frames: 1234800, fps: 60, pictureFrames: 1680 },
  baseCommit: '56f013be2ffa279bc191ce925451454b775a7e34',
  reference: {
    note: 'MORPH//05 V3, the approved master (the listening page\'s third version), unchanged on feat/morph-05-first-record',
    wav: { file: rel(join(v3, 'cable-beast-v3.wav')), sha256: sha(join(v3, 'cable-beast-v3.wav')) },
    mp3: { file: rel(join(v3, 'cable-beast-v3.mp3')), sha256: sha(join(v3, 'cable-beast-v3.mp3')) },
  },
  pinnedLevels: v3levels,
  tools: { node: process.version, ffmpeg: sh('ffmpeg', ['-version']), python: sh('python3', ['--version']) },
  reproduce: [
    'npm ci   # builds dist/ (DaemonV12 timing functions used by the event-map check)',
    'node experiments/morph-06/control.mjs',
    'node experiments/morph-06/build.mjs a b c --stems',
    'python3 experiments/morph-06/spectrograms.py',
    'python3 experiments/morph-06/analyze06.py experiments/morph-06/audio/comparison.json v3=experiments/morph-05/audio/v3 a=experiments/morph-06/audio/a b=experiments/morph-06/audio/b c=experiments/morph-06/audio/c',
    'python3 experiments/morph-06/event_changes.py experiments/morph-06/audio/EVENT-CHANGES.md experiments/morph-05/audio/v3/cable-beast-v3.events.json a=experiments/morph-06/audio/a/cable-beast-a.events.json b=experiments/morph-06/audio/b/cable-beast-b.events.json c=experiments/morph-06/audio/c/cable-beast-c.events.json',
    'node experiments/morph-06/manifest.mjs',
  ],
  controlTest: 'control.mjs: record.mjs + beast.mjs rendering the unchanged MORPH//05 V3 score reproduce the V3 master WAV bit-identically (the reference sha256 above), both as is and with the levels in v3-levels.json pinned',
  determinism: 'a, b and c rendered a second time into a fresh directory on this runtime: master WAVs and all 14 FLAC stems of each byte-identical',
  sources: Object.fromEntries(SOURCES.map(p => [rel(p), sha(p)])),
  analysis: Object.fromEntries([join(audio, 'comparison.json'), join(audio, 'EVENT-CHANGES.md'), ...walk(join(audio, 'spectrograms'))].map(p => [rel(p), sha(p)])),
  versions,
};
writeFileSync(join(here, 'MANIFEST.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(`MANIFEST.json: ${Object.keys(manifest.sources).length} sources, ${Object.values(versions).reduce((a, v) => a + Object.keys(v.files).length, 0)} version files`);
