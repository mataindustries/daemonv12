import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkFixtureCases, checkIsolation, checkLinks, checkText, frozenBase, loadValidators, parseFrontmatter, validatePackage } from './validate-package.mjs';

const { Ajv, YAML } = loadValidators(process.env.COMPOSER_VALIDATORS_DIR);
const schema = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures/plugin.schema.json'), 'utf8'));
const validManifest = { $schema: schema.$id, name: 'daemonv12-composer', version: '0.4.0' };
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
    '---\nname: daemonv12-composer\ndescription: "   "\n---\n',
    '---\nname: daemonv12-composer\ndescription: "   "\n',
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

test('v0.4 release instructions validate this branch against its stacked release base', () => {
  const instructions = readFileSync(new URL('./README.md', import.meta.url), 'utf8');
  const command = /^node plugins\/daemonv12-composer\/evals\/validate-package\.mjs --validators-dir \/tmp\/daemonv12-composer-validation-tools --base ([a-f0-9]{40})$/m.exec(instructions);
  assert(command, 'Document the complete release command with an explicit base.');
  assert.equal(command[1], '17468e7ee1df11b8cef361cf4e49601d5f671589');
  assert.equal(frozenBase, '56dbdff62bf78e70e898f0dbb49f8044cd561655');
  const result = validatePackage({ validatorsDir: process.env.COMPOSER_VALIDATORS_DIR, base: command[1] });
  assert.equal(result.base, command[1]);
  assert.equal(result.engineIsolation, 'Composer-only tracked diff');
});

test('plugin and direct skill copies retain local resources without a repository or Signature pack', () => {
  const directory = mkdtempSync(join(tmpdir(), 'composer-portable-'));
  const source = fileURLToPath(new URL('../', import.meta.url));
  try {
    for (const [from, name] of [[source, 'plugin'], [join(source, 'skills/daemonv12-composer'), 'skill']]) {
      const copy = join(directory, name);
      cpSync(from, copy, { recursive: true });
      function inspect(dir) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const path = join(dir, entry.name);
          if (entry.isDirectory()) inspect(path);
          else if (/\.(md|json|mjs|py)$/.test(path)) {
            const text = checkText(readFileSync(path), path);
            if (path.endsWith('.md')) checkLinks(text, path, copy);
            if (entry.name === 'SKILL.md') parseFrontmatter(text, YAML);
          }
        }
      }
      inspect(copy);
      const skill = name === 'skill' ? copy : join(copy, 'skills/daemonv12-composer');
      for (const reference of ['hook-first.md', 'signature-pack.md']) {
        assert(readFileSync(join(skill, 'references', reference)).length > 0);
      }
    }
    const manifest = JSON.parse(readFileSync(join(directory, 'plugin/plugin.json')));
    assert(validate(manifest));
    assert.equal(manifest.version, '0.4.0');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
