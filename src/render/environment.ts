import { constants, accessSync, statSync } from 'node:fs';
import { delimiter, isAbsolute, join, resolve } from 'node:path';

// Resolve only for reporting. Probes still spawn the selected command directly,
// with the renderer's environment and without a shell.
export function executablePath(command: string, env: NodeJS.ProcessEnv): string | null {
  const hasPath = isAbsolute(command) || command.includes('/') || command.includes('\\');
  const candidates = hasPath ? [resolve(command)] : (env.PATH ?? '/usr/local/bin:/usr/bin:/bin').split(delimiter).map(dir => join(dir || '.', command));
  for (const candidate of candidates) {
    const variants = process.platform === 'win32' && !/\.[^/\\]+$/.test(candidate)
      ? [candidate, ...(env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';').map(ext => candidate + ext)] : [candidate];
    for (const path of variants) {
      try { if (statSync(path).isFile()) { accessSync(path, constants.X_OK); return resolve(path); } }
      catch { /* Try the next PATH entry. */ }
    }
  }
  return null;
}
