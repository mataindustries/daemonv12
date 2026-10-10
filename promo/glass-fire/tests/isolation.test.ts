// The promo must never leak into the DaemonV12 package: no shared dependencies, no
// inclusion in its type-check, build, tests or published files.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const promo = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(promo, '..', '..');
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

test('the DaemonV12 package does not depend on Remotion or React', () => {
  const pkg = json(join(root, 'package.json'));
  const deps = {...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies, ...pkg.optionalDependencies};
  for (const name of Object.keys(deps)) assert.ok(!/remotion|^react|fontsource/.test(name), `root depends on ${name}`);
  const lock = readFileSync(join(root, 'package-lock.json'), 'utf8');
  assert.ok(!/node_modules\/(remotion|@remotion\/|react\b|react-dom)/.test(lock), 'root lockfile resolves promo packages');
});

test('the DaemonV12 package never builds, checks, tests or ships the promo', () => {
  const pkg = json(join(root, 'package.json'));
  assert.ok(!(pkg.files as string[]).some(f => f.startsWith('promo')), 'promo is in published files');
  assert.ok(!JSON.stringify(pkg.workspaces ?? []).includes('promo'), 'promo is a root workspace');
  for (const config of ['tsconfig.json', 'tsconfig.build.json']) {
    const ts = json(join(root, config));
    assert.ok(!(ts.include as string[]).some(p => p.startsWith('promo')), `${config} includes promo`);
  }
  assert.match(pkg.scripts.test, /^node --test "tests\//, 'root tests stay under tests/');
});

test('the promo is a private, exactly pinned, self-contained package', () => {
  const pkg = json(join(promo, 'package.json'));
  assert.equal(pkg.private, true);
  assert.notEqual(pkg.name, 'daemonv12');
  for (const [name, version] of Object.entries({...pkg.dependencies, ...pkg.devDependencies})) {
    assert.match(String(version), /^\d+\.\d+\.\d+$/, `${name} is not pinned exactly`);
  }
  const remotion = Object.entries(pkg.dependencies as Record<string, string>).filter(([n]) => n === 'remotion' || n.startsWith('@remotion/'));
  assert.ok(remotion.length > 0);
  assert.equal(new Set(remotion.map(([, v]) => v)).size, 1, 'all Remotion packages share one version');
  json(join(promo, 'package-lock.json'));
});
