// prepublishOnly: `npm publish` must be a deliberate release, never an accident.
// "private": true already makes npm refuse; this lists every remaining owner step at
// once (see docs/PUBLIC_BETA_RELEASE.md). A --dry-run only reports them.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINE_VERSION } from '../src/version.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string; private?: boolean; license?: string };
const problems: string[] = [];
if (pkg.private) problems.push('package.json is "private": true. Removing it is the final, deliberate step of the release checklist.');
if (!pkg.license) problems.push('package.json has no "license" field. Choosing the code license is the owner\'s decision.');
if (!['LICENSE', 'LICENSE.md', 'LICENSE.txt'].some(file => existsSync(join(root, file)))) problems.push('There is no LICENSE file at the repository root.');
if (pkg.version !== ENGINE_VERSION) problems.push(`package.json version ${pkg.version} differs from src/version.ts (${ENGINE_VERSION}).`);
if (!readFileSync(join(root, 'CHANGELOG.md'), 'utf8').includes(`\n## ${pkg.version}`)) problems.push(`CHANGELOG.md has no "## ${pkg.version}" section.`);
const status = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
if (status.status === 0 && status.stdout.trim()) problems.push('The git working tree has uncommitted changes; publish a committed, tagged state.');
if (process.env.DAEMONV12_RELEASE !== pkg.version) problems.push(`Set DAEMONV12_RELEASE=${pkg.version} to confirm that this exact version should be published.`);

if (problems.length) {
  const dryRun = process.env.npm_config_dry_run === 'true';
  process.stderr.write(`${dryRun ? 'Dry run: publishing would be refused' : 'Refusing to publish'} daemonv12 ${pkg.version}:\n${problems.map(problem => `  - ${problem}`).join('\n')}\nSee docs/PUBLIC_BETA_RELEASE.md.\n`);
  if (!dryRun) process.exitCode = 1;
}
