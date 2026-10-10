// Compile the runtime TypeScript (src/, mcp/) to dist/ for installed packages.
// A source checkout runs its .ts files directly, but Node refuses to strip types
// under node_modules, so packed tarballs ship this JavaScript (see bin/launch.js).
// Through `npm pack` / `npm publish` every problem is fatal; during a plain
// `npm ci` in a checkout (--prepare) problems only warn, because a checkout never
// executes dist/.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const lenient = process.argv.includes('--prepare') && !['pack', 'publish'].includes(process.env.npm_command ?? '');

function failed(problem: string): void {
  rmSync(dist, { recursive: true, force: true });
  if (lenient) process.stderr.write(`daemonv12 build skipped: ${problem}\nSource checkouts run TypeScript directly; only packed tarballs need dist/.\n`);
  else { process.stderr.write(`daemonv12 build failed: ${problem}\n`); process.exitCode = 1; }
}

rmSync(dist, { recursive: true, force: true });
let tsc: string | undefined;
try {
  const manifest = createRequire(import.meta.url).resolve('typescript/package.json');
  tsc = join(dirname(manifest), (JSON.parse(readFileSync(manifest, 'utf8')) as { bin: { tsc: string } }).bin.tsc);
} catch { /* Reported below. */ }
if (!tsc) failed('TypeScript is not installed; run npm ci including development dependencies.');
else {
  const result = spawnSync(process.execPath, [tsc, '-p', join(root, 'tsconfig.build.json')], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) failed(`tsc exited ${result.status ?? result.signal}.\n${result.stdout}${result.stderr}`);
  else {
    const modules = readdirSync(dist, { recursive: true, encoding: 'utf8' }).filter(file => file.endsWith('.js')).map(file => join(dist, file));
    const unrewritten = modules.filter(file => /(?:from\s*|import\s*\(\s*|import\s+)['"]\.{1,2}\/[^'"]*\.ts['"]/.test(readFileSync(file, 'utf8')));
    const missing = ['src/cli/main.js', 'mcp/main.js'].filter(file => !existsSync(join(dist, file)));
    if (missing.length || unrewritten.length)
      failed(`missing entry points [${missing.join(', ')}]; unrewritten .ts imports in [${unrewritten.map(file => relative(root, file)).join(', ')}].`);
    else if (!lenient) process.stderr.write(`daemonv12 build: ${modules.length} JavaScript modules in dist/\n`);
  }
}
