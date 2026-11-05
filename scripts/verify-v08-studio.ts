/** v0.8 acceptance proof: approved rack -> native bounce -> reviewed PCM24 delivery. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { files, sha256, verifyPackage } from '../production/headliner/build.ts';
import { packageProduction24 } from './headliner-production24.ts';
import { compileProjectFile, runCommand } from '../src/pipeline.ts';
import { sampleTriggers } from '../src/sample-render.ts';
import { analyzePcm24 } from '../src/render/index.ts';
import { readWavInfo } from '../src/render/wav.ts';
import {
  normalizeScore, renderScore, mixdown, bouncePackage, containmentProblems, verifyFrozen, readFreeze,
} from '../studio-001/rack/index.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PROOF = 'proofs/v08-studio-integration';
const SCORE = 'production/v08-studio/relay.score.json';
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const read = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;
const digest = (file: string) => sha256(readFileSync(file));
interface InputRecord {
  base: string;
  integrationOrder: number[];
  inputs: Record<string, { head: string; tree: string; files: { file: string; sha256: string }[] }>;
}
interface IntegrationChange { file: string; originalSha256: string; integrationSha256: string; reason: string }
interface NativeCatalog {
  frames: number;
  generator: { file: string; sha256: string }[];
  sounds: { file: string; sha256: string; frames: number; track: string; fromFrame: number; toFrame: number }[];
}

/** Hash every imported file against the exact reviewed Git blob, including all approved audio. */
export function verifyV08Inputs() {
  const inputs = read<InputRecord>(join(ROOT, PROOF, 'inputs.json'));
  const changes = read<IntegrationChange[]>(join(ROOT, PROOF, 'ci-adjustments.json'));
  assert.deepEqual(changes.map(c => c.file), ['.github/workflows/check.yml'], 'only the documented runner migration may alter an imported file');
  assert.deepEqual(inputs.integrationOrder, [44, 43]);
  assert.deepEqual(verifyFrozen(), []);
  let checked = 0;
  for (const pr of inputs.integrationOrder) for (const entry of inputs.inputs[pr]!.files) {
    const change = changes.find(c => c.file === entry.file);
    if (change) assert.equal(change.originalSha256, entry.sha256, 'CI adjustment must identify the reviewed Git blob');
    assert.equal(digest(join(ROOT, entry.file)), change?.integrationSha256 ?? entry.sha256, `PR #${pr} changed: ${entry.file}`);
    checked++;
  }
  return { inputs, checked, unchanged: checked - changes.length, changes, frozenFiles: readFreeze().files.length };
}

function identical(a: string, b: string): number {
  const names = files(a);
  assert.deepEqual(files(b), names, 'replay membership');
  for (const name of names) assert.equal(digest(join(a, name)), digest(join(b, name)), `replay: ${name}`);
  return names.length;
}
function freshProcess(script: string, args: string[]) {
  const result = spawnSync(process.execPath, [join(ROOT, script), ...args], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 24, timeout: 180000,
  });
  assert.equal(result.status, 0, `${script}: ${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`);
}
async function bounce(scoreFile: string, out: string) {
  const score = normalizeScore(read<unknown>(scoreFile));
  const rendered = await renderScore(score);
  const report = bouncePackage(score, rendered, await mixdown(rendered), out);
  assert.equal(report.clipped, 0, 'native assets must not clip');
  verifyPackage(out);
  for (const project of ['main.json', 'dry.json']) assert.deepEqual(containmentProblems(out, project), []);
  return score;
}
function pcm(file: string, bits: number, frames: number) {
  const bytes = readFileSync(file), result = readWavInfo(bytes);
  assert.ok(result.ok, file);
  assert.equal(result.info.formatTag, 1, file);
  assert.equal(result.info.bitsPerSample, bits, file);
  assert.equal(result.info.channels, 2, file);
  assert.equal(result.info.sampleRate, 44100, file);
  assert.equal(result.info.frames, frames, file);
  return { bytes, offset: result.info.dataOffset };
}

/** Independent reference from the PCM16 phrase bytes and catalog placement; no engine mixer is used. */
function verifyAlignment(native: string, delivery: string, manifest: Awaited<ReturnType<typeof packageProduction24>>['manifest']) {
  const catalog = read<NativeCatalog>(join(native, 'catalog.json'));
  const compilation = compileProjectFile(join(native, 'main.json'));
  assert.ok(compilation.project && compilation.timeline, JSON.stringify(compilation.diagnostics));
  assert.equal(compilation.diagnostics.filter(d => d.severity === 'error').length, 0);
  assert.equal(manifest.master.frames, catalog.frames);
  assert.equal(catalog.frames, 749700, 'RELAY: 24 beats at 96 BPM plus two seconds');
  assert.equal(manifest.stems.length, 5, 'four parts and a wet room');
  const sum = new Float64Array(catalog.frames * 2);
  const stems: { trackId: string; frames: number; firstFrame: number; lastFrame: number; frameLag: number; maximumErrorPcm24Lsb: number; nonzeroLowBytes: number }[] = [];
  let phrases = 0;
  for (const [index, track] of compilation.project.tracks.entries()) {
    assert.equal(track.mix?.pan, 0, 'rack pan is already baked into each phrase');
    assert.deepEqual(track.effects ?? [], []);
    assert.deepEqual(track.automation ?? {}, {});
    const sounds = catalog.sounds.filter(s => s.track === track.id);
    const triggers = sampleTriggers(compilation, compilation.timeline.tracks[index]!, catalog.frames);
    assert.deepEqual(triggers.map(t => [t.frame, t.pcm.frames, t.velocity]), sounds.map(s => [s.fromFrame, s.frames, 1]), `${track.id}: phrase trigger frames`);
    const expected = new Float64Array(sum.length), gain = 10 ** ((track.mix?.gainDb ?? 0) / 20);
    for (const sound of sounds) {
      assert.equal(sound.toFrame - sound.fromFrame, sound.frames);
      assert.equal(digest(join(native, sound.file)), sound.sha256);
      const source = pcm(join(native, sound.file), 16, sound.frames);
      for (let i = 0; i < sound.frames * 2; i++) expected[sound.fromFrame * 2 + i]! += source.bytes.readInt16LE(source.offset + i * 2) * gain;
      phrases++;
    }
    const stem = manifest.stems.find(s => s.trackId === track.id);
    assert.ok(stem, track.id);
    assert.equal(stem.clippedSamples, 0, track.id);
    const actual = pcm(join(delivery, stem.file), 24, catalog.frames);
    assert.equal(sha256(actual.bytes), stem.sha256);
    let worst = 0, first = -1, last = -1;
    for (let i = 0; i < expected.length; i++) {
      const value = actual.bytes.readIntLE(actual.offset + i * 3, 3);
      worst = Math.max(worst, Math.abs(value - Math.round(expected[i]! * 256)));
      if (value) { if (first < 0) first = Math.floor(i / 2); last = Math.floor(i / 2); }
      sum[i]! += expected[i]!;
    }
    assert.equal(worst, 0, `${track.id}: independent zero-lag PCM24 reconstruction`);
    assert.ok(first >= 0, `${track.id} must sound`);
    const analysis = analyzePcm24(actual.bytes);
    assert.equal(analysis.fullScaleSamples, 0);
    stems.push({ trackId: track.id, frames: catalog.frames, firstFrame: first, lastFrame: last, frameLag: 0, maximumErrorPcm24Lsb: worst, nonzeroLowBytes: analysis.nonzeroLowBytes });
  }
  assert.deepEqual(compilation.project.master?.effects ?? [], []);
  assert.equal(compilation.project.master?.ducking, undefined);
  const master = pcm(join(delivery, manifest.master.file), 24, catalog.frames);
  const gain = 10 ** ((compilation.project.master?.gainDb ?? 0) / 20);
  let worst = 0;
  for (let i = 0; i < sum.length; i++) worst = Math.max(worst, Math.abs(master.bytes.readIntLE(master.offset + i * 3, 3) - Math.round(sum[i]! * gain * 256)));
  assert.equal(worst, 0, 'master must sum original floats before any stem quantization');
  assert.equal(manifest.master.clippedSamples, 0);
  assert.ok(manifest.master.analysis.nonzeroLowBytes > 10000, 'PCM24 must retain computed fractional detail');
  assert.ok(stems.filter(s => s.nonzeroLowBytes > 0).length >= 3);
  assert.ok(manifest.master.analysis.truePeakDbfs !== null && manifest.master.analysis.truePeakDbfs <= -1, 'review master headroom');
  return { frames: catalog.frames, seconds: catalog.frames / 44100, phraseTriggers: phrases, masterFrameLag: 0, masterMaximumErrorPcm24Lsb: worst, stems };
}

/** Re-render the existing approved CROSSING without invoking its destructive delivery builder. */
async function verifyCrossing(scratch: string) {
  const native = join(scratch, 'crossing-native');
  await bounce(join(ROOT, 'studio-001/scores/crossing.score.json'), native);
  const sums = readFileSync(join(ROOT, 'studio-001/demo/package-manifest/SHA256SUMS'), 'utf8').trim().split('\n');
  let assets = 0;
  for (const line of sums) {
    const [hash, file] = line.split('  ');
    // catalog.json also records Node's version. Every musical input and phrase must match exactly.
    if (file === 'catalog.json') continue;
    assert.equal(digest(join(native, file!)), hash, `CROSSING native bounce: ${file}`);
    if (file!.endsWith('.wav')) assets++;
  }
  const demo = read<{ stems: Record<string, { decodesTo: string; wavSha256: string }> }>(join(ROOT, 'studio-001/demo/DEMO.json'));
  const masters: Record<string, string> = {};
  for (const name of ['main', 'dry']) {
    const result = await runCommand('render', join(native, `${name}.json`), { outDir: join(scratch, `crossing-${name}`), stems: true, format: 'wav', env: process.env });
    assert.equal(result.exitCode, 0, JSON.stringify(result.result));
    const original = join(ROOT, 'studio-001/demo', name === 'main' ? 'crossing.wav' : 'crossing-dry.wav');
    assert.ok(result.result.artifacts.wav);
    masters[name] = digest(result.result.artifacts.wav);
    assert.equal(masters[name], digest(original), `CROSSING ${name}: unchanged PCM16 master`);
    if (name === 'main') for (const stem of result.result.artifacts.stems!) {
      const reference = demo.stems[`stems/${stem.trackId}.flac`];
      assert.ok(reference, stem.trackId);
      assert.equal(digest(stem.wav), reference.wavSha256, `CROSSING PCM16 stem: ${stem.trackId}`);
    }
  }
  return { nativePhrasesIdentical: assets, masters, stemsIdentical: Object.keys(demo.stems).length };
}

export async function verifyV08Studio(output: string) {
  const protectedInputs = verifyV08Inputs(), out = resolve(output);
  assert.ok(!existsSync(out), 'choose a new verification output directory');
  mkdirSync(out, { recursive: true });
  const scratch = mkdtempSync(join(tmpdir(), 'daemonv12-v08-'));
  try {
    const native = join(out, 'native');
    const score = await bounce(join(ROOT, SCORE), native);
    assert.deepEqual([...new Set(score.parts.map(p => p.instrument.family))].sort(), ['impossible-voice', 'living-bass', 'mechanical-orchestra']);
    const nativeRepeat = join(scratch, 'native-repeat');
    freshProcess('studio-001/rack/cli.ts', ['bounce', join(ROOT, SCORE), nativeRepeat]);
    const nativeFiles = identical(native, nativeRepeat);
    const catalog = read<NativeCatalog>(join(native, 'catalog.json'));
    for (const g of catalog.generator) assert.equal(digest(join(ROOT, g.file)), g.sha256, g.file);
    const sourceFiles = (dir: string) => [
      ...files(dir).filter(f => f !== 'SHA256SUMS').map(file => ({ path: join(dir, file), file })),
      { path: join(dir, 'SHA256SUMS'), file: 'native-bounce.SHA256SUMS' },
      ...catalog.generator.map(g => ({ path: join(ROOT, g.file), file: `generators/${g.file}` })),
      ...readFreeze().files.filter(f => f.role === 'engine' || f.role === 'audition-script').map(f => ({ path: join(ROOT, f.path), file: `generators/${f.path}` })),
      { path: fileURLToPath(import.meta.url), file: 'generators/scripts/verify-v08-studio.ts' },
      { path: join(ROOT, PROOF, 'inputs.json'), file: 'generators/integration-inputs.json' },
      { path: join(ROOT, PROOF, 'ci-adjustments.json'), file: 'generators/ci-adjustments.json' },
    ];
    const provenance = { base: protectedInputs.inputs.base,
      integrationOrder: protectedInputs.inputs.integrationOrder.map(pr => ({ pr, head: protectedInputs.inputs.inputs[pr]!.head })),
      score: SCORE, scoreSha256: digest(join(ROOT, SCORE)), nativeBounceSha256: digest(join(native, 'SHA256SUMS')),
      frozenManifestSha256: digest(join(ROOT, 'studio-001/rack/frozen.json')),
      purpose: 'Short technical integration review; no instrument development, licensing change, music release or v0.8 release approval.' };
    const a = await packageProduction24(join(native, 'main.json'), join(out, 'production24'), { reuseVoices: true, provenance, sourceFiles: sourceFiles(native) });
    const b = await packageProduction24(join(nativeRepeat, 'main.json'), join(scratch, 'production24-repeat'), { reuseVoices: true, provenance, sourceFiles: sourceFiles(nativeRepeat) });
    const packageFiles = identical(a.directory, b.directory);
    const replay = join(scratch, 'replay');
    freshProcess('scripts/headliner-production24.ts', ['replay', a.directory, replay]);
    assert.equal(identical(a.directory, replay), packageFiles);
    assert.equal(verifyPackage(a.directory), a.members);
    const alignment = verifyAlignment(native, a.directory, a.manifest);
    const inventory = read<{ sources: { file: string; sha256: string; bitsPerSample: number | null }[] }>(join(a.directory, 'metadata/inventory.json'));
    for (const entry of inventory.sources) {
      assert.equal(digest(join(a.directory, entry.file)), entry.sha256, entry.file);
      if (entry.file.endsWith('.wav')) assert.equal(entry.bitsPerSample, 16, entry.file);
    }
    for (const file of files(native).filter(f => f !== 'SHA256SUMS')) assert.equal(digest(join(a.directory, 'source', file)), digest(join(native, file)), `preserved native source: ${file}`);
    assert.equal(a.mastering.listening.derivedFrom.sha256, a.manifest.master.sha256);
    const engineProvenance = read<{ adapter: { file: string; sha256: string }; engineSources: { file: string; sha256: string }[]; caller: unknown }>(join(a.directory, 'metadata/provenance.json'));
    assert.deepEqual(engineProvenance.caller, provenance);
    for (const source of [engineProvenance.adapter, ...engineProvenance.engineSources]) assert.equal(digest(join(ROOT, source.file)), source.sha256, source.file);
    const hashes = { master: a.manifest.master.sha256, mp3: a.mastering.listening.sha256,
      stems: Object.fromEntries(a.manifest.stems.map(s => [s.trackId, s.sha256])),
      nativeSha256sums: digest(join(native, 'SHA256SUMS')), production24Sha256sums: digest(join(a.directory, 'SHA256SUMS')) };
    const referenceFile = join(ROOT, PROOF, 'verification.json');
    if (existsSync(referenceFile)) {
      const reference = read<{ hashes: typeof hashes }>(referenceFile);
      // WAVs use only native PCM and JS Float64 math. Metadata/MP3 hashes also depend on the recorded toolchain.
      assert.equal(hashes.master, reference.hashes.master, 'committed RELAY PCM24 master');
      assert.deepEqual(hashes.stems, reference.hashes.stems, 'committed RELAY PCM24 stems');
    }
    const crossing = await verifyCrossing(scratch);
    verifyV08Inputs();
    const report = { schema: 'daemonv12.v08-studio-verification/1', title: score.title,
      sourceHeads: provenance.integrationOrder, base: provenance.base, runtime: a.manifest.runtime,
      verifiedImportedFiles: protectedInputs.checked, preservedImportedFiles: protectedInputs.unchanged,
      ciAdjustments: protectedInputs.changes, frozenFiles: protectedInputs.frozenFiles,
      freezeSha256: provenance.frozenManifestSha256, scoreSha256: provenance.scoreSha256,
      route: 'Unmodified approved rack native bounce -> packageProduction24 with bounded voice reuse -> Float64 processing and master sum -> independent PCM24 exports; MP3 directly from the final PCM24 master.',
      sourcePrecision: a.manifest.sourcePrecision, export: a.manifest.export,
      alignment, analysis: a.manifest.master.analysis,
      determinism: { independentBouncesIdentical: true, nativeFiles,
        independentProductionPackagesIdentical: true, completeReplayIdentical: true, comparedFilesPerPackage: packageFiles },
      provenance: { nativeSourcesByteIdentical: true, sourceInventoryVerified: true, rackGeneratorHashesVerified: true,
        frozenEngineHashesVerified: true, engineAndAdapterHashesVerified: true, mp3DerivedFromFinalPcm24: true },
      crossing, hashes,
      status: 'Technical integration review. Await owner approval before merge. No release, publication, licensing change or listening approval is asserted.' };
    writeFileSync(join(out, 'verification.json'), json(report));
    return report;
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 3, 'usage: node scripts/verify-v08-studio.ts NEW_OUTPUT_DIRECTORY');
  console.log(json(await verifyV08Studio(process.argv[2]!)));
}
