/**
 * Builds the DAEMON//STUDIO 001 demonstration CROSSING through the native DaemonV12 route and collects deliverables.
 *   node studio-001/demo/build.ts            (about 2 minutes; needs FFmpeg with libmp3lame)
 * 1. bounce studio-001/scores/crossing.score.json into a sealed package (studio-001/demo/build/package, not committed)
 * 2. bounce it again from a fresh process and require an identical SHA256SUMS (determinism)
 * 3. render main.json (all parts + context + room) and dry.json (instrument parts only) with the unchanged engine CLI,
 *    with stems; render main twice and require identical WAV, MP3 and stems
 * 4. copy deliverables: crossing.wav/.mp3 (main), crossing-dry.wav/.mp3, stems/*.flac (lossless, decode with FFmpeg),
 *    the package's text files (projects, kits, catalog, scores, SHA256SUMS) in package-manifest/, DEMO.json, SHA256SUMS
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, sha256 } from '../rack/frozen.ts';
import { loudness, ffmpegVersion } from '../rack/cli.ts';
import { packageFiles, verifyPackage } from '../rack/package.ts';

const here = dirname(fileURLToPath(import.meta.url)), build = join(here, 'build'), score = join(REPO_ROOT, 'studio-001', 'scores', 'crossing.score.json');
const run = (cmd: string, args: string[]) => {
  const r = spawnSync(cmd, args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
};
const hashDir = (d: string) => Object.fromEntries(readdirSync(d, { recursive: true, withFileTypes: true }).filter(e => e.isFile())
  .map(e => { const p = join(e.parentPath, e.name); return [p.slice(d.length + 1), sha256(readFileSync(p))]; }).sort());
if (!ffmpegVersion()) throw new Error('FFmpeg with libmp3lame is required');
rmSync(build, { recursive: true, force: true }); mkdirSync(build, { recursive: true });
const pkg = join(build, 'package'), pkg2 = join(build, 'package-repeat');
console.log('bounce 1'); run(process.execPath, ['studio-001/rack/cli.ts', 'bounce', score, pkg]);
console.log('bounce 2 (fresh process)'); run(process.execPath, ['studio-001/rack/cli.ts', 'bounce', score, pkg2]);
const sums = readFileSync(join(pkg, 'SHA256SUMS'), 'utf8');
if (sums !== readFileSync(join(pkg2, 'SHA256SUMS'), 'utf8')) throw new Error('the two bounces differ');
const engine = (project: string, out: string, stems: boolean) => run(process.execPath, ['bin/daemonv12.js', 'render', join(pkg, project), '--out-dir', out, ...(stems ? ['--stems'] : []), '--format', 'wav,mp3', '--json']);
console.log('engine render main x2, dry');
engine('main.json', join(build, 'main'), true); engine('main.json', join(build, 'main-repeat'), true); engine('dry.json', join(build, 'dry'), true);
const a = hashDir(join(build, 'main')), b = hashDir(join(build, 'main-repeat'));
const differing = Object.keys(a).filter(k => a[k] !== b[k] && !k.endsWith('.render.json'));
if (differing.length) throw new Error(`repeat engine renders differ: ${differing.join(', ')}`);

// ---------------------------------------------------------------- deliverables
for (const old of ['crossing.wav', 'crossing.mp3', 'crossing-dry.wav', 'crossing-dry.mp3', 'stems', 'package-manifest', 'DEMO.json', 'SHA256SUMS']) rmSync(join(here, old), { recursive: true, force: true });
cpSync(join(build, 'main', 'main.wav'), join(here, 'crossing.wav')); cpSync(join(build, 'main', 'main.mp3'), join(here, 'crossing.mp3'));
cpSync(join(build, 'dry', 'dry.wav'), join(here, 'crossing-dry.wav')); cpSync(join(build, 'dry', 'dry.mp3'), join(here, 'crossing-dry.mp3'));
mkdirSync(join(here, 'stems'));
const stems = readdirSync(join(build, 'main', 'main.stems')).filter(f => f.endsWith('.wav')).sort();
for (const f of stems) run(process.env.DAEMONV12_FFMPEG || 'ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-i', join(build, 'main', 'main.stems', f), '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', '-compression_level', '8', join(here, 'stems', f.replace(/\.wav$/, '.flac'))]);
mkdirSync(join(here, 'package-manifest'));
for (const f of packageFiles(pkg).filter(f => !f.endsWith('.wav'))) { mkdirSync(dirname(join(here, 'package-manifest', f)), { recursive: true }); cpSync(join(pkg, f), join(here, 'package-manifest', f)); }
const analyze = (f: string) => JSON.parse(run(process.execPath, ['bin/daemonv12.js', 'analyze', f, '--json'])) as { analysis?: Record<string, unknown> } & Record<string, unknown>;
const measured = (f: string) => { const a2 = analyze(f), r = (a2.analysis ?? a2) as Record<string, unknown>;
  return { r128: loudness(f), engine: { integratedLufs: r.integratedLufs, truePeakDbfs: r.truePeakDbfs, loudnessRangeLu: r.loudnessRangeLu, peakDbfs: r.peakDbfs, clipping: r.clipping, fullScaleSamples: r.fullScaleSamples, frames: r.frames, durationSeconds: r.durationSeconds } }; };
const catalog = JSON.parse(readFileSync(join(pkg, 'catalog.json'), 'utf8')) as Record<string, unknown>;
writeFileSync(join(here, 'DEMO.json'), JSON.stringify({
  schema: 'daemonv12.signature-rack.demo/1', title: 'CROSSING', score: 'studio-001/scores/crossing.score.json', scoreSha256: sha256(readFileSync(score)),
  route: 'rack bounce -> unchanged DaemonV12 0.7 engine CLI render (--stems --format wav,mp3)', engineBase: catalog.engineBase, node: process.version, ffmpeg: ffmpegVersion(),
  determinism: { bounceTwiceIdentical: true, engineRenderTwiceIdentical: true, comparedFiles: Object.keys(a).filter(k => !k.endsWith('.render.json')).length },
  files: {
    'crossing.wav': { role: 'main: all parts, context kick/snare and room (engine master)', ...measured(join(here, 'crossing.wav')) },
    'crossing-dry.wav': { role: 'dry: instrument parts only (no context drums, no room)', ...measured(join(here, 'crossing-dry.wav')) },
  },
  stems: Object.fromEntries(stems.map(f => [`stems/${f.replace(/\.wav$/, '.flac')}`, { decodesTo: f, wavSha256: sha256(readFileSync(join(build, 'main', 'main.stems', f))) }])),
  package: { files: verifyPackage(pkg), sha256sums: 'package-manifest/SHA256SUMS', note: 'phrase WAVs are not committed; `node studio-001/rack/cli.ts bounce studio-001/scores/crossing.score.json NEW` regenerates them byte for byte (listed in package-manifest/SHA256SUMS)' },
  license: 'PENDING OWNER DECLARATION: no license is granted.',
}, null, 2) + '\n');
// demo-level SHA256SUMS over the committed deliverables (package-manifest keeps its own)
writeFileSync(join(here, 'SHA256SUMS'), ['crossing.wav', 'crossing.mp3', 'crossing-dry.wav', 'crossing-dry.mp3', 'DEMO.json', ...stems.map(f => `stems/${f.replace(/\.wav$/, '.flac')}`)]
  .map(f => `${sha256(readFileSync(join(here, f)))}  ${f}\n`).join(''));
console.log(readFileSync(join(here, 'DEMO.json'), 'utf8'));
