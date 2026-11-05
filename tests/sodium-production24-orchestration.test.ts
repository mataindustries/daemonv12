import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { renderVerifiedSodium } from '../scripts/sodium-production24.ts';

test('SODIUM orchestration refuses existing delivery, legacy and replay outputs before any writes', async t => {
  const tmp = mkdtempSync(join(tmpdir(), 'sodium-output-safety-'));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const log = join(tmp, 'verified.log'); writeFileSync(log, 'verified\n');
  for (const [index, suffix] of ['', '-legacy-pcm16', '-replay'].entries()) {
    const root = join(tmp, `delivery-${index}`), protectedOutput = root + suffix;
    mkdirSync(protectedOutput); writeFileSync(join(protectedOutput, 'historical.txt'), 'preserve me\n');
    await assert.rejects(renderVerifiedSodium('/unneeded-reference', root, log), /new output directory required/);
    assert.equal(readFileSync(join(protectedOutput, 'historical.txt'), 'utf8'), 'preserve me\n');
    if (suffix) assert.equal(existsSync(root), false);
  }
});
