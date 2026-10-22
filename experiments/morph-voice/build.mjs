// Render the three authored performances, then use the unmodified 0.7 engine.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, createReadStream } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { renderFile } from './render.mjs';
import { integrate } from './integrate.mjs';
import { analyzeWav } from './wav.mjs';
import { runCommand } from '../../src/pipeline.ts';

const here = dirnameOf(import.meta.url), repo = resolve(here, '../..');
function dirnameOf(url) { return resolve(fileURLToPath(new URL('.', url))); }
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
function files(root) {
  return readdirSync(root, {withFileTypes: true}).flatMap(entry => entry.isDirectory()
    ? files(join(root, entry.name)) : [join(root, entry.name)]).sort();
}
async function fileHash(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
const git = (...args) => {
  const result = spawnSync('git', args, {cwd: repo, encoding: 'utf8'});
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
};

export async function build(output = join(here, 'renders')) {
  const root = resolve(output);
  for (const sub of ['demos', 'performances', 'analysis']) mkdirSync(join(root, sub), {recursive: true});
  const demos = ['the-transformation', 'the-performance', 'the-impossible-gesture'];
  const measurements = {};
  for (const name of demos) {
    const input = join(here, 'performances', `${name}.json`), wav = join(root, 'demos', `${name}.wav`);
    copyFileSync(input, join(root, 'performances', `${name}.json`));
    measurements[name] = renderFile(input, wav);
    console.log(`${name}: ${measurements[name].signal.frames} frames; ${measurements[name].wavSha256}`);
  }
  const cue = await integrate(root);
  measurements['morph-01-cue'] = {signal: analyzeWav(readFileSync(cue.master))};
  for (const stem of cue.stems) measurements[`stem-${stem.trackId}`] = {signal: analyzeWav(readFileSync(stem.wav))};
  json(join(root, 'analysis', 'measurements.json'), measurements);
  const engineAnalysis = {};
  for (const path of [...demos.map(name => join(root, 'demos', `${name}.wav`)), cue.master]) {
    const analyzed = await runCommand('analyze', path);
    if (analyzed.exitCode !== 0) throw new Error(JSON.stringify(analyzed.result));
    engineAnalysis[relative(root, path)] = analyzed.result.analysis;
  }
  json(join(root, 'analysis', 'loudness.json'), engineAnalysis);
  const toolchain = {node: process.version, platform: process.platform, architecture: process.arch,
    versions: process.versions, nodeBinarySha256: await fileHash(process.execPath)};
  const ffmpeg = process.env.DAEMONV12_FFMPEG || 'ffmpeg';
  const probe = spawnSync(ffmpeg, ['-version'], {encoding: 'utf8'});
  if (probe.status !== 0) throw new Error('Could not record configured FFmpeg');
  toolchain.ffmpeg = {version: probe.stdout.split('\n')[0],
    executableSha256: ffmpeg.includes('/') ? await fileHash(ffmpeg) : null};
  const sourcePaths = files(here).filter(path => !path.includes('/work/') && !path.includes('/renders/') &&
    !path.includes('/reports/') && !path.endsWith('.zip'));
  const sourceHashes = Object.fromEntries(sourcePaths.map(path => [relative(here,path),sha(readFileSync(path))]));
  const audioHashes = Object.fromEntries(files(root).filter(path => path.endsWith('.wav')).map(path => [relative(root,path),sha(readFileSync(path))]));
  const provenance = {experiment: 'DaemonV12 MORPH//01 — The Singing Machine', schemaVersion: 1,
    engine: {version:'0.7.0', baseCommit:'7dd67f1e3963b2fcbdbf1fc0aa8b1f926e8874b5',
      srcTree:git('rev-parse','7dd67f1:src'), mcpTree:git('rev-parse','7dd67f1:mcp')},
    context: {signalBranch:'feat/signal-lab-instruments', signalCommit:'0eea7e312fe7f2388b3341d330125c555199a26b',
      signalAudioUsed:false, prerecordedSpeechUsed:false, externalSoundAssetsUsed:false},
    toolchain, sourceHashes, audioHashes,
    deterministicScope:'PCM audio bytes under these exact sources, input files, Node binary/platform and FFmpeg build. Cost observations are not deterministic.',
    rights:'Experimental output; no licence grant or ownership attestation. SIGNAL rights unchanged. No publication or deployment.'};
  json(join(root, 'provenance.json'), provenance);
  const sums = files(root).filter(path => !['SHA256SUMS.txt'].includes(relative(root,path)))
    .map(path => `${sha(readFileSync(path))}  ${relative(root,path)}`).join('\n') + '\n';
  writeFileSync(join(root, 'SHA256SUMS.txt'), sums);
  console.log(`Cue: ${relative(root,cue.master)}; ${cue.stems.length} stems; exact 529200 frames. Output ${root}`);
  return {root, cue, measurements, provenance};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build(process.argv[2]);
