/** Reproduce the locked composition through the reviewed opt-in production workflow. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { files, sealPackage, sha256, verifyPackage } from '../production/headliner/build.ts';
import { packageProduction24, replayProduction24, type Production24DeliveryOptions } from './headliner-production24.ts';
import { verifySodiumProduction24 } from './verify-sodium-production24.ts';
import { createAudioProcessor } from '../src/render/index.ts';
import { runCommand } from '../src/pipeline.ts';

export const SODIUM_REFERENCE = '6b1ab7b8f1602bd4e57244b16caee68d8876336f';
export const SODIUM_MASTER = '43da3fd7119f5add17ff9896e29d46123cdb1f214ea9fc8e7747513903f1e07d';
const PROJECT = 'fb9ca8ad10ca3029b0d873e6190760ba6e20019bb021744e2cf5b1e8de644edb';
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';

export function sodiumDeliveryOptions(originalRepository: string): Production24DeliveryOptions {
  const original = join(originalRepository, 'headliner-001');
  const status = spawnSync('git', ['-C', originalRepository, 'status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' });
  assert.equal(status.status, 0, status.stderr); assert.equal(status.stdout.trim(), '', 'reference tracked files must remain unchanged');
  assert.equal(sha256(readFileSync(join(original, 'project/sodium-hours.json'))), PROJECT);
  assert.equal(sha256(readFileSync(join(original, 'delivery/sodium-hours.wav'))), SODIUM_MASTER);
  assert.equal(sha256(readFileSync(join(original, 'project/sodium-hours.catalog.json'))), 'b03b3c7ed0ea04e245c99cbffa46b6593376df9b5cc5d5b399a97e6c3d1d7f9e');
  assert.equal(sha256(readFileSync(join(original, 'delivery/SHA256SUMS'))), 'a0a1671953a36e3473bd60985cad63a6263bf69446548162a7a09fe0c3f642ee');
  return { reuseVoices: true,
    provenance: { referenceCommit: SODIUM_REFERENCE, originalMasterSha256: SODIUM_MASTER,
      integrationHeads: { foundation42: '35c466a638bebd070da5773d732737e9769d2f1f',
        boundedReuse39: '39e56a9cab053382220dd3cb5a971a7d9369b522', precision41: '7e8c484cc7e8593d0d7f4b3f972dea3b234d5729' },
      compositionPolicy: 'Exact locked SODIUM HOURS project, canonical PCM16 sources and authored mastering. No regeneration or artistic edits.' },
    licenseFiles: [join(original, 'ASSETS_AND_LICENSES.md')],
    sourceFiles: ['project/sodium-hours.catalog.json', 'README.md', 'CREATIVE_LOG.md', 'PRODUCTION_NOTES.md',
      ...files(join(original, 'tools')).map(f => `tools/${f}`),
      'scripts/verify-delivery.sh'].map(file => ({ path: join(original, file), file: file.replace(/^project\//, '') })),
  };
}

/** Call only after the original verify-delivery.sh has completed successfully. */
export async function renderVerifiedSodium(originalRepository: string, output: string, originalVerificationLog: string) {
  assert.ok(readFileSync(originalVerificationLog, 'utf8').trimEnd().endsWith('verified'), 'canonical original verification must pass first');
  const root = resolve(output), original = join(originalRepository, 'headliner-001');
  for (const path of [root, root + '-legacy-pcm16', root + '-replay'])
    assert.ok(!existsSync(path), `new output directory required: ${path}`);
  const options = sodiumDeliveryOptions(originalRepository);
  mkdirSync(root, { recursive: true }); mkdirSync(join(root, 'original')); mkdirSync(join(root, 'verification'));
  copyFileSync(originalVerificationLog, join(root, 'verification/original-verification.log'));
  copyFileSync(join(original, 'delivery/sodium-hours.wav'), join(root, 'original/sodium-hours.pcm16.wav'));
  copyFileSync(join(original, 'delivery/sodium-hours.mp3'), join(root, 'original/sodium-hours.locked.mp3'));
  const processor = await createAudioProcessor({ env: process.env }); assert.ok(processor.value, JSON.stringify(processor.diagnostic));
  const encoded = await processor.value.mp3(join(root, 'original/sodium-hours.pcm16.wav'), join(root, 'original/sodium-hours.pcm16.mp3'));
  assert.ok(!encoded.diagnostic, JSON.stringify(encoded.diagnostic));
  console.log('Rendering unchanged legacy project with integration engine.');
  const legacy = await runCommand('render', join(original, 'project/sodium-hours.json'),
    { outDir: root + '-legacy-pcm16', stems: true, format: 'wav', env: process.env });
  assert.equal(legacy.exitCode, 0, JSON.stringify(legacy.result.errors));
  assert.equal(sha256(readFileSync(legacy.result.artifacts.wav!)), SODIUM_MASTER, 'integration legacy master must remain locked');
  const delivered = readFileSync(join(original, 'delivery/SHA256SUMS'), 'utf8');
  for (const stem of legacy.result.artifacts.stems!) {
    const expected = delivered.split('\n').find(line => line.endsWith(` stems/${stem.wav.split('/').at(-1)}`));
    assert.ok(expected, stem.trackId); assert.equal(sha256(readFileSync(stem.wav)), expected.slice(0, 64));
  }
  writeFileSync(join(root, 'verification/legacy-preservation.json'), json({ masterSha256: SODIUM_MASTER,
    integrationLegacyMasterAndAll15StemsMatchLockedDelivery: true }));
  console.log('Rendering PCM24 production package.');
  const candidate = await packageProduction24(join(original, 'project/sodium-hours.json'), join(root, 'production24'), options);
  console.log('Rendering independent complete-package replay.');
  await replayProduction24(candidate.directory, root + '-replay');
  const report = await verifySodiumProduction24(original, candidate.directory, root + '-replay');
  writeFileSync(join(root, 'verification/ab.json'), json(report));
  writeFileSync(join(root, 'verification/listening.json'), json({
    original: { file: 'original/sodium-hours.pcm16.mp3', derivedFromSha256: SODIUM_MASTER,
      sha256: sha256(readFileSync(join(root, 'original/sodium-hours.pcm16.mp3'))) },
    candidate: { ...candidate.mastering.listening, file: `production24/${candidate.mastering.listening.file}`,
      derivedFrom: { ...candidate.mastering.listening.derivedFrom, file: `production24/${candidate.mastering.listening.derivedFrom.file}` } },
    codec: encoded.value, processor: processor.value.identity,
    processing: 'Same encoder and settings; no added gain, normalization or loudness matching.' }));
  writeFileSync(join(root, 'REPRODUCE.txt'), 'See docs/PRODUCTION24_INTEGRATION.md in the integration checkout. Original verification precedes rendering. Full package replay is stored beside this delivery.\n');
  sealPackage(root); verifyPackage(root);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [reference, output] = process.argv.slice(2);
  assert.ok(reference && output && process.argv.length === 4,
    'usage: node scripts/sodium-production24.ts ORIGINAL_REPOSITORY NEW_DELIVERY');
  const git = spawnSync('git', ['-C', reference, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  assert.equal(git.status, 0, git.stderr); assert.equal(git.stdout.trim(), SODIUM_REFERENCE);
  const log = resolve(output) + '-original-verification.log';
  assert.ok(!existsSync(log), 'new verification log required');
  const verified = spawnSync('bash', [join(resolve(reference), 'headliner-001/scripts/verify-delivery.sh')], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: process.env });
  writeFileSync(log, verified.stdout + verified.stderr, { flag: 'wx' });
  assert.equal(verified.status, 0, `Original verification failed; see ${log}`);
  const result = await renderVerifiedSodium(resolve(reference), resolve(output), log);
  console.log(json({ directory: resolve(output), project: result.project, candidate: result.candidate.sha256 }));
}
