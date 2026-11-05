// Prepare the independent legacy comparison using the configured audio toolchain,
// then run #44's unchanged comparator in --existing mode against the actual files.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

assert.equal(process.argv.length, 4, 'usage: node scripts/verify-v08-pcm16.mjs ARCHIVED_MAIN NEW_OUTPUT_PREFIX');
const baseline = resolve(process.argv[2]), prefix = resolve(process.argv[3]);
const root = fileURLToPath(new URL('../', import.meta.url));
for (const suffix of ['baseline', 'candidate', 'reuse']) assert.ok(!existsSync(`${prefix}-${suffix}`), 'choose a new output prefix');
assert.ok(!existsSync(`${prefix}-verification.json`), 'choose a new verification report');
const cases = ['examples/morph-sync-demo.json', 'examples/one-sound-after.json',
  'examples/ghost-shift.json', 'packs/v12-signature-v1/v12-signature-showcase.json'];
for (const [source, suffix, reuseVoices] of [[baseline, 'baseline', false], [root, 'candidate', false], [root, 'reuse', true]]) {
  const engine = await import(pathToFileURL(join(source, 'src/pipeline.ts')));
  for (const project of cases) {
    const result = await engine.runCommand('render', join(source, project), {
      outDir: join(`${prefix}-${suffix}`, basename(project, '.json')), stems: true, reuseVoices, env: process.env,
    });
    assert.equal(result.exitCode, 0, JSON.stringify(result.result.errors));
  }
}
const comparison = spawnSync(process.execPath, [join(root, 'scripts/verify-voice-reuse-legacy.mjs'), baseline, prefix, '--existing'],
  { encoding: 'utf8', maxBuffer: 1 << 24, timeout: 180000 });
assert.equal(comparison.status, 0, `${comparison.error?.message ?? ''}\n${comparison.stdout}\n${comparison.stderr}`);
const reportFile = `${prefix}-verification.json`, report = JSON.parse(readFileSync(reportFile, 'utf8'));
report.orchestration = { file: 'scripts/verify-v08-pcm16.mjs',
  sha256: createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
  toolchain: 'process.env forwarded explicitly to baseline, default and reuse renders; unchanged comparator re-hashes retained files with --existing.' };
writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
process.stdout.write(comparison.stdout);
