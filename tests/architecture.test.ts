import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ENGINE_VERSION } from '../src/version.ts';
import { capDiagnostics, diagnostic, didYouMean, exitCodeFor, formatDiagnosticHuman, formatPath, levenshtein } from '../src/diagnostics.ts';
test('architecture: deterministic core, renderer boundary, zero runtime dependencies', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.version, ENGINE_VERSION);
  assert.equal(pkg.dependencies, undefined);
  for (const file of readdirSync('src', { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.ts'))) {
    const text = readFileSync(`src/${file}`, 'utf8');
    assert.doesNotMatch(text, /from\s+['"][^'"]*(?:@modelcontextprotocol|\/mcp\/|\bzod\b)/);
    assert.doesNotMatch(text, /Math\.random|\bDate\b|performance\.now|process\.hrtime/);
    if (!file.startsWith('render/')) assert.doesNotMatch(text, /from\s+['"][^'"]*render\/(?!index\.ts)[^'"]+['"]/);
    if (/^(timing|midi)\/|^project\/(pitch|key|gm-programs|validate|sample-schema)/.test(file)) assert.doesNotMatch(text, /node:|process\.env/);
    if (file.startsWith('render/')) assert.doesNotMatch(text, /process\.env|from\s+['"][^'"]*(project|timing|midi)\//);
  }
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
