import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The nearest package.json named daemonv12: the checkout itself, or an installed
// package whose compiled modules live one level deeper, under dist/.
export function packageRoot(from: string = fileURLToPath(new URL('.', import.meta.url))): string {
  for (let dir = from; ; dir = dirname(dir)) {
    try { if ((JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { name?: unknown }).name === 'daemonv12') return dir; }
    catch { /* Keep looking toward the filesystem root. */ }
    if (dirname(dir) === dir) throw new Error(`No daemonv12 package.json above ${from}.`);
  }
}

export type InstallationMode = 'source' | 'package';
// A checkout carries TypeScript sources; an installed package carries only dist/.
export function installation(root: string = packageRoot()): { mode: InstallationMode; root: string } {
  return { mode: existsSync(join(root, 'src', 'cli', 'main.ts')) ? 'source' : 'package', root };
}
