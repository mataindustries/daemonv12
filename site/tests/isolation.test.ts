// The site must never leak into the DaemonV12 package: no shared dependencies, no
// inclusion in its type-check, build, tests or published files.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const site = fileURLToPath(new URL('..', import.meta.url));
const root = join(site, '..');
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

test('the DaemonV12 package does not depend on the site toolchain', () => {
  const pkg = json(join(root, 'package.json'));
  const deps = {...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies, ...pkg.optionalDependencies};
  for (const name of Object.keys(deps)) assert.ok(!/^(vite|@vitejs\/|react|react-dom|playwright|@fontsource)/.test(name), `root depends on ${name}`);
  const lock = readFileSync(join(root, 'package-lock.json'), 'utf8');
  assert.ok(!/node_modules\/(vite|@vitejs\/|react|react-dom|playwright-core)"/.test(lock), 'root lockfile resolves site packages');
});

test('the DaemonV12 package never builds, checks, tests or ships the site', () => {
  const pkg = json(join(root, 'package.json'));
  assert.ok(!(pkg.files as string[]).some(f => f.startsWith('site')), 'site is in published files');
  assert.ok(!JSON.stringify(pkg.workspaces ?? []).includes('site'), 'site is a root workspace');
  for (const config of ['tsconfig.json', 'tsconfig.build.json']) {
    const ts = json(join(root, config));
    assert.ok(!(ts.include as string[]).some(p => p.startsWith('site')), `${config} includes site`);
  }
  assert.match(pkg.scripts.test, /^node --test "tests\//, 'root tests stay under tests/');
});

test('the site is a private, exactly pinned, self-contained package with no Stripe SDK', () => {
  const pkg = json(join(site, 'package.json'));
  assert.equal(pkg.private, true);
  assert.notEqual(pkg.name, 'daemonv12');
  assert.equal(pkg.scripts.build.startsWith('vite build'), true);
  for (const [name, version] of Object.entries({...pkg.dependencies, ...pkg.devDependencies})) {
    assert.match(String(version), /^\d+\.\d+\.\d+$/, `${name} is not pinned exactly`);
    assert.ok(!/stripe/i.test(name), `${name}: no payment SDKs`);
  }
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['react', 'react-dom'], 'only React, used at build time');
  json(join(site, 'package-lock.json'));
});
