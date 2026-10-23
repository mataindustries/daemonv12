// Writes MANIFEST.json: SHA-256 of every source and delivered file in this directory, plus the
// recorded hashes of the reproducible engine outputs that are not committed (engine masters,
// stems, V1 assets). Run after `build.mjs all v1` and `build.mjs all v2`.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '.'], { cwd: HERE, encoding: 'utf8' })
  .split('\n').filter(f => f && f !== 'MANIFEST.json').sort();
const files = Object.fromEntries(tracked.map(f => [f, { sha256: sha(join(HERE, f)), bytes: statSync(join(HERE, f)).size }]));
const versions = {};
for (const c of ['a', 'b']) for (const v of ['v1', 'v2']) {
  const m = JSON.parse(readFileSync(join(HERE, c, v, `still-here-${c}-${v}.meta.json`), 'utf8'));
  versions[`${c}-${v}`] = {
    title: m.title, frames: m.frames, ignition: m.ignition, integratedLufs: m.analysis.integratedLufs, truePeakDbtp: m.analysis.truePeakDbfs,
    master: m.files.master.sha256, mp3: m.files.mp3.sha256, project: m.files.project.sha256,
    engineMaster: m.files.engineMaster.sha256, engineStems: m.files.stems, assets: Object.fromEntries(m.files.assets.map(a => [a.path, a.sha256])),
  };
}
const manifest = {
  piece: 'STILL HERE: two 12-second candidates (A: PRECISION IGNITION, B: THE HUMAN SPARK), V1 and V2',
  base: { branch: 'main', commit: '7dd67f1e3963b2fcbdbf1fc0aa8b1f926e8874b5', engine: 'DaemonV12 0.7.0' },
  sources: {
    'feat/morph-02-sound-breakthrough': 'fb3bd49643f049eeb3d85d7e6360f34296519d79',
    'feat/morph-03-cable-breaks': '71afdb4d7856f1ab6613b52736db5f2282188348',
    'feat/morph-04-cable-beast': '34e694f0c87a1bb3390ae868411a150f0d104f2f',
    'feat/morph-06-overload': '2b6e533a021218d6940a8da5a7032c2abe58a3d9',
  },
  tools: { node: process.version, ffmpeg: execFileSync('ffmpeg', ['-version'], { encoding: 'utf8' }).split('\n')[0] },
  determinism: 'Rebuilding both V2s from source reproduced every asset, project, engine master and stem, delivered WAV and MP3 byte-for-byte on this runtime.',
  versions, files,
};
writeFileSync(join(HERE, 'MANIFEST.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(`MANIFEST.json: ${Object.keys(files).length} files, ${Object.keys(versions).length} versions`);
