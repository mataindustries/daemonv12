import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { STARTER_PROJECTS } from '../src/cli/init.ts';
import { ENGINE_VERSION } from '../src/version.ts';
import { capDiagnostics, diagnostic, didYouMean, exitCodeFor, formatDiagnosticHuman, formatPath, levenshtein } from '../src/diagnostics.ts';
test('architecture: deterministic core, renderer boundary, engine imports no npm packages', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.version, ENGINE_VERSION);
  // Runtime dependencies serve only the MCP adapter, exactly pinned; src/ imports none of them.
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['@modelcontextprotocol/server', 'zod']);
  for (const version of Object.values(pkg.dependencies)) assert.match(version as string, /^\d+\.\d+\.\d+$/);
  for (const file of readdirSync('src', { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.ts'))) {
    const text = readFileSync(`src/${file}`, 'utf8');
    assert.doesNotMatch(text, /from\s+['"][^'"]*(?:@modelcontextprotocol|\/mcp\/|\bzod\b)/);
    assert.doesNotMatch(text, /Math\.random|\bDate\b|performance\.now|process\.hrtime/);
    if (!file.startsWith('render/')) assert.doesNotMatch(text, /from\s+['"][^'"]*render\/(?!index\.ts)[^'"]+['"]/);
    if (/^(timing|midi)\/|^project\/(pitch|key|gm-programs|validate|sample-schema)/.test(file)) assert.doesNotMatch(text, /node:|process\.env/);
    if (file.startsWith('render/')) assert.doesNotMatch(text, /process\.env|from\s+['"][^'"]*(project|timing|midi)\//);
  }
});
test('package contract: two executables, no install scripts, explicit runtime allowlist', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.deepEqual(pkg.bin, { daemonv12: 'bin/daemonv12.js', 'daemonv12-mcp': 'bin/daemonv12-mcp.js' });
  for (const bin of Object.values(pkg.bin) as string[]) assert.match(readFileSync(bin, 'utf8'), /^#!\/usr\/bin\/env node\n/);
  for (const script of ['preinstall', 'install', 'postinstall']) assert.equal(pkg.scripts[script], undefined, script);
  for (const entry of pkg.files as string[]) assert.ok(entry === 'dist/' || existsSync(entry), entry);
  for (const project of STARTER_PROJECTS) assert.ok(pkg.files.includes(`examples/${project}`), project);
  assert.ok(pkg.files.includes('examples/README.md') && pkg.files.includes('examples/assets/'));
  assert.ok(!(pkg.files as string[]).some(entry => /^(src|mcp|tests|reports|renders|\.github|\.devcontainer)(\/|$)/.test(entry)));
});
test('diagnostics helpers and exit classes', () => {
  assert.equal(levenshtein('kitten', 'sitting'), 3);
  assert.equal(didYouMean('ab', ['ac', 'ad'], 1), 'ac');
  assert.equal(didYouMean('z', ['abc'], 1), undefined);
  assert.equal(formatPath('tracks[0]', 'my key'), 'tracks[0]["my key"]');
  assert.equal(formatPath('', 'bpm'), 'bpm');
  for (const [code, exit] of [['INVALID_PITCH', 1], ['USAGE_ERROR', 2], ['RENDERER_FAILED', 3], ['INTERNAL_ERROR', 4]] as const)
    assert.equal(exitCodeFor([diagnostic(code, '', null, 'valid')]), exit);
  const d = diagnostic('OUT_OF_RANGE', '', 4, '1', 'use 1');
  assert.match(formatDiagnosticHuman(d), /error\[OUT_OF_RANGE\] \(root\)/);
  assert.equal(capDiagnostics(Array(103).fill(d)).omitted, 3);
  assert.equal(capDiagnostics(Array(103).fill(d)).diagnostics.length, 100);
  assert.equal(exitCodeFor([{ ...d, severity: 'warning' }]), 0);
});
