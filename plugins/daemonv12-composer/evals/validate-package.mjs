#!/usr/bin/env node
// Package integrity only: no musical-quality score or simulated host activation.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const evalDir = dirname(fileURLToPath(import.meta.url));
export const frozenBase = '56dbdff62bf78e70e898f0dbb49f8044cd561655';
export const pluginPrefix = 'plugins/daemonv12-composer/';

export function loadValidators(directory) {
  assert(directory, 'Set COMPOSER_VALIDATORS_DIR or pass --validators-dir; see evals/README.md.');
  const require = createRequire(resolve(directory, 'package.json'));
  return { Ajv: require('ajv/dist/2020.js').default, YAML: require('yaml') };
}

export function parseFrontmatter(text, YAML) {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  assert(match, 'Skill must start with closed YAML frontmatter.');
  const document = YAML.parseDocument(match[1], { uniqueKeys: true });
  assert.equal(document.errors.length, 0, document.errors.map(e => e.message).join('; '));
  const data = document.toJS();
  assert(data && typeof data === 'object' && !Array.isArray(data), 'Frontmatter must be a mapping.');
  assert.equal(data.name, 'daemonv12-composer', 'Skill name must match its directory.');
  assert.equal(typeof data.description, 'string', 'Description must be a string.');
  assert(data.description.trim().length > 0 && data.description.length <= 1024, 'Description must contain 1–1024 characters.');
  return data;
}

export function checkText(bytes, name) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  assert(text.endsWith('\n'), `${name}: missing final newline`);
  assert(!/\r/.test(text), `${name}: use LF newlines`);
  assert(!/[\t ]+$/m.test(text), `${name}: trailing whitespace`);
  if (name.endsWith('.md')) {
    let fence;
    for (const line of text.split('\n')) {
      const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (!match) continue;
      if (!fence) fence = { char: match[1][0], length: match[1].length };
      else if (match[1][0] === fence.char && match[1].length >= fence.length && !match[2].trim()) fence = undefined;
    }
    assert(!fence, `${name}: unclosed code fence`);
  }
  return text;
}

export function checkLinks(text, file, packageDir) {
  // Package prose uses inline Markdown links. Ignore fenced examples and URLs.
  const prose = text.replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1\s*$/gm, '');
  for (const match of prose.matchAll(/\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    let target = match[1].replace(/^<|>$/g, '');
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) continue;
    target = decodeURIComponent(target.split('#')[0]);
    const path = resolve(dirname(file), target);
    const local = relative(packageDir, path);
    assert(!isAbsolute(local) && local !== '..' && !local.startsWith('../'), `${file}: link escapes plugin: ${target}`);
    assert(existsSync(path), `${file}: broken local link: ${target}`);
  }
}

export function checkFixtureCases(fixture, kind) {
  assert.equal(fixture.schemaVersion, 1);
  assert.equal(fixture.status, 'planned', 'Fixtures must not claim an observed run.');
  assert(Array.isArray(fixture.cases) && fixture.cases.length > 0);
  const ids = new Set();
  const prompts = new Set();
  for (const item of fixture.cases) {
    assert.equal(typeof item.id, 'string');
    assert(item.id && !ids.has(item.id), 'Duplicate/empty case ID');
    ids.add(item.id);
    assert.equal(typeof item.prompt, 'string');
    assert(item.prompt.trim() && !prompts.has(item.prompt), 'Duplicate/empty prompt');
    prompts.add(item.prompt);
    if (kind === 'activation') {
      assert.equal(typeof item.shouldActivate, 'boolean');
      assert.equal(typeof item.reason, 'string');
      assert(item.reason.trim());
    } else {
      assert.equal(typeof item.name, 'string');
      for (const key of ['observations', 'acceptance', 'failureSignals']) {
        assert(Array.isArray(item[key]) && item[key].length > 0, `Missing ${key}`);
        assert(item[key].every(value => typeof value === 'string' && value.trim()), `Invalid ${key}`);
      }
    }
  }
  return ids;
}

export function checkIsolation(paths) {
  const outside = paths.filter(path => path && !path.startsWith(pluginPrefix));
  assert.equal(outside.length, 0, `Changes outside Composer: ${outside.join(', ')}`);
}

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

export function validatePackage({ validatorsDir, base = frozenBase } = {}) {
  const { Ajv, YAML } = loadValidators(validatorsDir || process.env.COMPOSER_VALIDATORS_DIR);
  const packageDir = resolve(evalDir, '..');
  const schema = JSON.parse(readFileSync(resolve(evalDir, 'fixtures/plugin.schema.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(resolve(packageDir, 'plugin.json'), 'utf8'));
  const validate = new Ajv({ strict: true, allErrors: true }).compile(schema);
  assert(validate(manifest), `Official schema: ${JSON.stringify(validate.errors)}`);
  assert.equal(manifest.name, 'daemonv12-composer');
  assert.equal(manifest.version, '0.2.0');
  const files = filesUnder(packageDir);
  for (const file of files) {
    if (!/\.(?:md|json|mjs)$/.test(file)) continue;
    const text = checkText(readFileSync(file), file);
    if (file.endsWith('.md')) checkLinks(text, file, packageDir);
    if (file.endsWith('/SKILL.md')) parseFrontmatter(text, YAML);
  }
  const activation = JSON.parse(readFileSync(resolve(evalDir, 'activation-cases.json'), 'utf8'));
  const behavior = JSON.parse(readFileSync(resolve(evalDir, 'behavioral-cases.json'), 'utf8'));
  const activationIds = checkFixtureCases(activation, 'activation');
  const behaviorIds = checkFixtureCases(behavior, 'behavior');
  assert.equal(activation.skill, manifest.name);
  assert.equal(activationIds.size, 16);
  assert.equal(activation.cases.filter(item => item.shouldActivate).length, 10);
  assert.deepEqual([...behaviorIds], Array.from({ length: 8 }, (_, i) => `B${i + 11}`));
  const evalPlan = readFileSync(resolve(evalDir, 'README.md'), 'utf8');
  const plannedIds = [...evalPlan.matchAll(/^\| (B\d+) /gm)].map(match => match[1]);
  assert.deepEqual(plannedIds, Array.from({ length: 18 }, (_, i) => `B${String(i + 1).padStart(2, '0')}`), 'Preserve B01–B10 and add B11–B18.');
  const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: packageDir, encoding: 'utf8' }).trim();
  const changed = execFileSync('git', ['diff', '--name-only', base, '--'], { cwd: repo, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  checkIsolation(changed);
  return { manifestSchema: schema.$id, version: manifest.version, packageFiles: files.length, activationFixtures: activationIds.size, behavioralCases: plannedIds.length, changedTrackedFiles: changed, engineIsolation: 'Composer-only tracked diff', base, limitations: 'Static package checks; no host activation, rendered behavior or human listening test.' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = {};
    for (let i = 2; i < process.argv.length; i += 2) {
      const key = { '--validators-dir': 'validatorsDir', '--base': 'base' }[process.argv[i]];
      assert(key && process.argv[i + 1], 'Usage: validate-package.mjs [--validators-dir DIR] [--base COMMIT]');
      options[key] = process.argv[i + 1];
    }
    console.log(JSON.stringify(validatePackage(options), null, 2));
  } catch (error) {
    console.error(`Composer package validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
