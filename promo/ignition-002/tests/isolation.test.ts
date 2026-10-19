// The video project must never leak into the DaemonV12 package, and its data must be valid.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';
import {assertSync, gridSync, type SyncData} from '../src/sync/contract.ts';

const project = join(import.meta.dirname, '..');
const root = join(project, '..', '..');
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

test('the DaemonV12 package does not depend on Remotion or React and never checks this project', () => {
  const pkg = json(join(root, 'package.json'));
  const deps = {...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies, ...pkg.optionalDependencies};
  for (const name of Object.keys(deps)) assert.ok(!/remotion|^react|fontsource/.test(name), `root depends on ${name}`);
  assert.ok(!(pkg.files as string[]).some(f => f.startsWith('promo')));
  for (const config of ['tsconfig.json', 'tsconfig.build.json']) assert.ok(!(json(join(root, config)).include as string[]).some(p => p.startsWith('promo')));
});

test('this project is private and exactly pinned to one Remotion version', () => {
  const pkg = json(join(project, 'package.json'));
  assert.equal(pkg.private, true);
  for (const [name, version] of Object.entries({...pkg.dependencies, ...pkg.devDependencies})) assert.match(String(version), /^\d+\.\d+\.\d+$/, name);
  const remotion = Object.entries({...pkg.dependencies, ...pkg.devDependencies} as Record<string, string>).filter(([n]) => n === 'remotion' || n.startsWith('@remotion/'));
  assert.equal(new Set(remotion.map(([, v]) => v)).size, 1);
});

test('the committed sync data is valid and says where it came from', () => {
  const data = assertSync(json(join(project, 'src', 'sync', 'sync.json')) as SyncData);
  assert.ok(data.source === 'analysis' || data.source === 'grid');
  if (data.source === 'analysis') assert.equal(data.audio?.sha256, '6938bf3b8efd90d9c9818dc20689b71e408d9d22be1cab7e01da597da22a80e1');
  assertSync(gridSync());
});
