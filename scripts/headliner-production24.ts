/** Optional HEADLINER delivery adapter. No project, CLI or MCP defaults change. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPackage, files, sealPackage, sha256, verifyPackage } from '../production/headliner/build.ts';
import { compileProjectFile } from '../src/pipeline.ts';
import { outputInAssets } from '../src/project/assets.ts';
import { renderProduction24 } from '../src/precision-render.ts';
import { createAudioProcessor, type AudioProcessor } from '../src/render/index.ts';

export interface Production24DeliveryOptions {
  reuseVoices?: boolean;
  env?: NodeJS.ProcessEnv;
  processor?: AudioProcessor;
  /** Facts supplied by the caller, such as a locked reference commit and original master hash. */
  provenance?: Record<string, unknown>;
  /** Existing rights documents are copied verbatim; supplying one does not grant new rights. */
  licenseFiles?: string[];
  /** Additional source/generator/catalog files, relative to the package's source/ directory. */
  sourceFiles?: { path: string; file: string }[];
}
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
function safeFile(file: string) {
  assert.match(file, /^[a-zA-Z0-9/_.-]+$/, 'portable delivery filename required');
  assert.ok(!file.startsWith('/') && !file.split('/').some(p => p === '..' || p === ''), 'relative delivery filename required');
}
function identity(file: string, bytes: Buffer) { return { file, sha256: sha256(bytes), bytes: bytes.length }; }
function engineIdentity() {
  const src = fileURLToPath(new URL('../src/', import.meta.url));
  return files(src).filter(f => f.endsWith('.ts')).map(f => identity(`src/${f}`, readFileSync(join(src, f))));
}

/**
 * Package an existing composition without rewriting a byte of its project or canonical assets.
 * Rendering and encoding happen in a fresh sibling directory, renamed only after verification.
 */
export async function packageProduction24(projectPath: string, output: string, options: Production24DeliveryOptions = {}) {
  const out = resolve(output), projectFile = basename(projectPath);
  safeFile(projectFile);
  assert.ok(!existsSync(out), 'choose a new output directory; existing deliveries are never replaced');
  assert.ok(!outputInAssets(projectPath, out), 'delivery cannot be inside source assets');
  const compiled = compileProjectFile(projectPath, { reuseVoices: options.reuseVoices });
  const errors = compiled.diagnostics.filter(d => d.severity === 'error');
  assert.ok(!errors.length && compiled.project && compiled.timeline && compiled.assets && compiled.projectBytes,
    `invalid project: ${JSON.stringify(errors)}`);
  const assets = compiled.assets;
  assert.ok(compiled.timeline.tracks.every(t => t.instrument.type !== 'gm'), 'Production24 supports sampler/drumkit tracks only');
  const created = options.processor ? { value: options.processor } : await createAudioProcessor({ env: options.env ?? process.env });
  if (!created.value) throw new Error(`FFmpeg unavailable: ${JSON.stringify(created.diagnostic)}`);
  const processor = created.value;
  mkdirSync(dirname(out), { recursive: true });
  const temporary = mkdtempSync(join(dirname(out), '.headliner-production24-'));
  const write = (file: string, bytes: Buffer | string | Uint8Array) => {
    safeFile(file); const path = join(temporary, file); mkdirSync(dirname(path), { recursive: true });
    if (existsSync(path)) assert.deepEqual(readFileSync(path), Buffer.from(bytes), `conflicting package member: ${file}`);
    else writeFileSync(path, bytes);
  };
  try {
    write(`source/${projectFile}`, compiled.projectBytes);
    for (const [file, asset] of compiled.assets) write(`source/${file}`, asset.bytes);
    if (compiled.sidechain) write(`source/${compiled.sidechain.file}`, compiled.sidechain.bytes);
    for (const source of options.sourceFiles ?? []) write(`source/${source.file}`, readFileSync(source.path));
    for (const path of options.licenseFiles ?? []) write(`metadata/licenses/${basename(path)}`, readFileSync(path));
    const rendered = await renderProduction24(join(temporary, 'source', projectFile), join(temporary, 'render'),
      { processor, reuseVoices: options.reuseVoices });
    const manifest = structuredClone(rendered.manifest);
    const masterFile = `masters/${basename(rendered.wav)}`;
    mkdirSync(join(temporary, 'masters')); mkdirSync(join(temporary, 'stems')); mkdirSync(join(temporary, 'listening'));
    renameSync(rendered.wav, join(temporary, masterFile));
    for (const stem of manifest.stems) {
      renameSync(join(temporary, 'render', stem.file), join(temporary, 'stems', stem.file));
      stem.file = `stems/${stem.file}`;
    }
    rmSync(join(temporary, 'render'), { recursive: true });
    manifest.master.file = masterFile;
    manifest.project.file = `source/${projectFile}`;
    for (const source of manifest.sources) source.file = `source/${source.file}`;
    if (manifest.sidechain) manifest.sidechain.file = `source/${manifest.sidechain.file}`;
    const mp3File = `listening/${projectFile.replace(/\.json$/i, '')}.24.mp3`;
    const encoded = await processor.mp3(join(temporary, masterFile), join(temporary, mp3File));
    if (encoded.diagnostic) throw new Error(`MP3 listening copy: ${JSON.stringify(encoded.diagnostic)}`);
    const listening = { ...identity(mp3File, readFileSync(join(temporary, mp3File))), ...encoded.value,
      derivedFrom: { file: masterFile, sha256: manifest.master.sha256 },
      processing: 'Encoding only; no normalization, extra mastering, gain change or PCM16 intermediate.' };
    write('metadata/render.json', json(manifest));
    const blockers = [
      ...(manifest.master.clippedSamples ? ['Master clips at PCM24 export.'] : []),
      ...(manifest.stems.some(s => s.clippedSamples) ? ['One or more PCM24 stems clip at export.'] : []),
      'Human listening approval remains pending.', 'Source, composition and generated-audio rights require owner review; no new license is granted.',
      'Release-specific mastering approval remains pending.',
    ];
    const mastering = {
      schema: 'daemonv12.headliner-production24-mastering/1',
      status: 'Technical production candidate; no subjective improvement or release approval asserted.',
      authoredMaster: compiled.project.master ?? {},
      authoredRender: compiled.project.render ?? null,
      authoredTracks: compiled.project.tracks.map(track => ({ trackId: track.id, mix: track.mix ?? {},
        effects: track.effects ?? [], automation: track.automation ?? {} })),
      additionalMastering: 'None; original project gain, ordered effects and ducking are preserved.',
      export: manifest.export, analysis: manifest.master.analysis,
      headroom: { samplePeakDbfs: manifest.master.analysis.peakDbfs,
        truePeakDbfs: manifest.master.analysis.truePeakDbfs,
        truePeakHeadroomDb: manifest.master.analysis.truePeakDbfs === null ? null : -manifest.master.analysis.truePeakDbfs },
      stems: 'Aligned post-track/pre-master PCM24; independently quantized. Summing exported stems does not reproduce the Float64-summed, master-processed WAV byte for byte.',
      sourcePrecision: manifest.sourcePrecision, listening, releaseBlockers: blockers,
    };
    write('metadata/mastering.json', json(mastering));
    write('metadata/provenance.json', json({ schema: 'daemonv12.headliner-production24-provenance/1',
      engine: manifest.engine, runtime: manifest.runtime,
      adapter: identity('scripts/headliner-production24.ts', readFileSync(fileURLToPath(import.meta.url))),
      engineSources: engineIdentity(),
      project: manifest.project,
      sourcePolicy: 'Canonical project and asset bytes copied unchanged; no arrangement, instrument, source generation or mastering parameters rewritten.',
      caller: options.provenance ?? {},
    }));
    const sourceEntries = files(join(temporary, 'source')).map(file => {
      const asset = assets.get(file);
      return { ...identity(`source/${file}`, readFileSync(join(temporary, 'source', file))),
        kind: file === projectFile ? 'project' : asset?.pcm || file === compiled.sidechain?.file ? 'canonical-pcm16-audio' : asset ? 'kit' : 'supplementary-source',
        bitsPerSample: asset?.pcm || file === compiled.sidechain?.file ? 16 : null,
        licenseStatus: 'No new grant; inspect supplied rights documents and obtain owner declaration where pending.' };
    });
    write('metadata/inventory.json', json({ schema: 'daemonv12.headliner-production24-inventory/1',
      sourcePrecision: manifest.sourcePrecision, sources: sourceEntries,
      rightsDocuments: files(join(temporary, 'metadata')).filter(f => f.startsWith('licenses/')).map(f =>
        identity(`metadata/${f}`, readFileSync(join(temporary, 'metadata', f)))),
      rightsStatus: 'Inventory and provenance only. Numerical synthesis, deterministic hashes and PCM24 encoding do not establish commercial permission.',
    }));
    write('REPRODUCE.txt', `Node 22.18+; FFmpeg with libmp3lame; use the exact engine source and toolchain recorded in metadata/provenance.json.\nVerify: node scripts/headliner.ts hashes PACKAGE\nRender the preserved project: node scripts/render-production24.ts PACKAGE/source/${projectFile} NEW_RENDER${options.reuseVoices ? ' --reuse-voices' : ''}\nReproduce the complete package: node scripts/headliner-production24.ts replay PACKAGE NEW_PACKAGE\nPCM16 sources remain PCM16 sources; Float64 processing preserves newly calculated fractions until independent PCM24 exports.\nMP3 is encoded directly from the final PCM24 master with no gain or normalization change.\nHuman listening, rights clearance and release-specific mastering remain pending.\n`);
    sealPackage(temporary); const members = verifyPackage(temporary);
    renameSync(temporary, out);
    return { directory: out, wav: join(out, masterFile), mp3: join(out, mp3File), manifest, mastering, members };
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true }); throw error;
  }
}

/** A sealed package contains the exact source/extras/rights/caller facts required for a replay. */
export async function replayProduction24(input: string, output: string, options: Pick<Production24DeliveryOptions, 'env' | 'processor'> = {}) {
  verifyPackage(input);
  const manifest = JSON.parse(readFileSync(join(input, 'metadata/render.json'), 'utf8')) as { project: { file: string }; interpolationReuse?: unknown };
  const inventory = JSON.parse(readFileSync(join(input, 'metadata/inventory.json'), 'utf8')) as { sources: { file: string }[]; rightsDocuments: { file: string }[] };
  const provenance = JSON.parse(readFileSync(join(input, 'metadata/provenance.json'), 'utf8')) as { caller: Record<string, unknown> };
  safeFile(manifest.project.file); assert.ok(manifest.project.file.startsWith('source/'));
  for (const entry of inventory.sources) { safeFile(entry.file); assert.ok(entry.file.startsWith('source/')); }
  for (const entry of inventory.rightsDocuments) { safeFile(entry.file); assert.ok(entry.file.startsWith('metadata/licenses/')); }
  return packageProduction24(join(input, manifest.project.file), output, { ...options,
    reuseVoices: manifest.interpolationReuse !== undefined, provenance: provenance.caller,
    sourceFiles: inventory.sources.map(entry => ({ path: join(input, entry.file), file: entry.file.slice('source/'.length) })),
    licenseFiles: inventory.rightsDocuments.map(entry => join(input, entry.file)),
  });
}

/** Connect the existing foundation score/package to PCM24 without changing its ordinary route. */
export async function packageStarterProduction24(score: string, output: string, options: Production24DeliveryOptions = {}) {
  const scratch = mkdtempSync(join(tmpdir(), 'headliner-production24-source-'));
  try {
    const source = buildPackage(score, join(scratch, 'source'));
    return await packageProduction24(join(source, 'main.json'), output, { ...options,
      sourceFiles: [...files(source).filter(f => f !== 'SHA256SUMS').map(file => ({ path: join(source, file), file })), ...(options.sourceFiles ?? [])] });
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, input, output, ...flags] = process.argv.slice(2);
  assert.ok(input && output && flags.every(f => f === '--reuse-voices'),
    'usage: headliner-production24.ts project PROJECT.json NEW_DIRECTORY [--reuse-voices] | starter SCORE.json NEW_DIRECTORY [--reuse-voices] | replay PACKAGE NEW_DIRECTORY');
  const options = { reuseVoices: flags.includes('--reuse-voices') };
  const result = command === 'project' ? await packageProduction24(input, output, options)
    : command === 'starter' ? await packageStarterProduction24(input, output, options)
      : command === 'replay' ? await replayProduction24(input, output) : assert.fail('unknown command');
  console.log(JSON.stringify({ directory: result.directory, members: result.members, master: result.manifest.master }, null, 2));
}
