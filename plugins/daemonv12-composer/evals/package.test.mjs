import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkFixtureCases, checkIsolation, checkLinks, checkText, loadValidators, parseFrontmatter } from './validate-package.mjs';

const { Ajv, YAML } = loadValidators(process.env.COMPOSER_VALIDATORS_DIR);
const schema = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures/plugin.schema.json'), 'utf8'));
const validManifest = { $schema: schema.$id, name: 'daemonv12-composer', version: '0.3.0' };
const validate = new Ajv({ strict: true, allErrors: true }).compile(schema);

test('official schema accepts the manifest and rejects malformed nested fields', () => {
  assert(validate(validManifest));
  for (const changed of [
    { ...validManifest, name: 'unsafe--name' },
    { ...validManifest, name: 'bad..name' },
    { ...validManifest, version: 2 },
    { ...validManifest, invented: true },
    { ...validManifest, author: { name: 'Composer', invented: true } },
    { ...validManifest, keywords: ['music', 7] },
    { ...validManifest, extensions: { 'org.example': 'must be an object' } },
    { name: 'missing-schema' },
  ]) assert.equal(validate(changed), false, JSON.stringify(changed));
});

test('YAML frontmatter accepts scalar and folded descriptions; rejects invalid metadata', () => {
  assert.equal(parseFrontmatter('---\nname: daemonv12-composer\ndescription: Compose music.\n---\nBody\n', YAML).description, 'Compose music.');
  assert.equal(typeof parseFrontmatter('---\nname: daemonv12-composer\ndescription: >-\n  Compose music\n  with DaemonV12.\n---\n', YAML).description, 'string');
  for (const text of [
    'No frontmatter\n',
    '---\nname: daemonv12-composer\ndescription: Unclosed\n',
    '---\nname: other\ndescription: Compose.\n---\n',
    '---\nname: daemonv12-composer\ndescription: 42\n---\n',
    '---\nname: daemonv12-composer\nname: duplicate\ndescription: Compose.\n---\n',
    `---\nname: daemonv12-composer\ndescription: ${'x'.repeat(1025)}\n---\n`,
  ]) assert.throws(() => parseFrontmatter(text, YAML));
});

test('UTF-8, newline, whitespace and fence checks detect malformed package text', () => {
  assert.doesNotThrow(() => checkText(Buffer.from('Body\n```sh\ntrue\n```\n'), 'file.md'));
  assert.doesNotThrow(() => checkText(Buffer.from('~~~~\n```\n~~~~\n'), 'file.md'));
  for (const [data, name] of [
    [Buffer.from([0xff, 0x0a]), 'file.md'],
    [Buffer.from('no newline'), 'file.md'],
    [Buffer.from('trailing \n'), 'file.md'],
    [Buffer.from('CRLF\r\n'), 'file.md'],
    [Buffer.from('```sh\ntrue\n'), 'file.md'],
    [Buffer.from('````sh\ntrue\n```\n'), 'file.md'],
  ]) assert.throws(() => checkText(data, name));
});

test('local links exist and stay inside the distributed plugin', () => {
  const directory = mkdtempSync(join(tmpdir(), 'composer-links-'));
  try {
    writeFileSync(join(directory, 'target.md'), 'Target\n');
    const file = join(directory, 'source.md');
    checkLinks('[exists](target.md#anchor) [web](https://example.com) [local](#anchor)\n', file, directory);
    assert.throws(() => checkLinks('[missing](missing.md)\n', file, directory));
    assert.throws(() => checkLinks('[escape](../elsewhere.md)\n', file, directory));
    checkLinks('```md\n[example](missing.md)\n```\n', file, directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('eval fixture integrity rejects false run claims, duplicated cases and absent criteria', () => {
  const caseData = { id: 'one', prompt: 'Request', shouldActivate: true, reason: 'Composition' };
  const fixture = { schemaVersion: 1, status: 'planned', cases: [caseData] };
  assert.deepEqual([...checkFixtureCases(fixture, 'activation')], ['one']);
  assert.throws(() => checkFixtureCases({ ...fixture, status: 'passed' }, 'activation'));
  assert.throws(() => checkFixtureCases({ ...fixture, cases: [caseData, caseData] }, 'activation'));
  assert.throws(() => checkFixtureCases({ ...fixture, cases: [{ ...caseData, shouldActivate: 'true' }] }, 'activation'));
  assert.throws(() => checkFixtureCases(fixture, 'behavior'));
});

test('engine isolation rejects all tracked paths outside Composer', () => {
  checkIsolation(['plugins/daemonv12-composer/plugin.json', 'plugins/daemonv12-composer/evals/README.md']);
  for (const path of ['src/render/production.ts', 'tests/engine.test.ts', 'README.md', 'package.json', 'plugins/other/plugin.json']) {
    assert.throws(() => checkIsolation([path]), /Changes outside Composer/);
  }
});

test('package validator CLI executes through symlinks', t => {
  const directory = mkdtempSync(join(tmpdir(), 'composer-validator-cli-'));
  try {
    const script = fileURLToPath(new URL('./validate-package.mjs', import.meta.url));
    const link = join(directory, 'validate-package-link.mjs');
    try {
      symlinkSync(script, link, 'file');
    } catch (error) {
      if (!['EPERM', 'EACCES', 'ENOSYS', 'ENOTSUP'].includes(error.code)) throw error;
      t.skip(`File symlinks unavailable: ${error.code}`);
      return;
    }
    for (const flags of [[], ['--preserve-symlinks-main']]) {
      const result = spawnSync(process.execPath, [...flags, link, '--invalid'], { encoding: 'utf8' });
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.match(result.stderr, /Composer package validation failed: Usage:/);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
