import { constants, closeSync, fstatSync, fsyncSync, linkSync, lstatSync, mkdtempSync, openSync,
  readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

export const MAX_PROJECT_BYTES = 2 * 1024 * 1024;
export class ToolFailure extends Error {
  readonly code: string;
  readonly path: string;
  readonly hint: string;
  constructor(code: string, path: string, message: string, hint: string) {
    super(message); this.code = code; this.path = path; this.hint = hint;
  }
}
export function fail(code: string, path: string, message: string, hint: string): never {
  throw new ToolFailure(code, path, message, hint);
}
export const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');

// The operator owns this directory. Agent paths cannot cross links or select hidden files.
export class Workspace {
  readonly root: string;
  constructor(root: string) {
    this.root = realpathSync(resolve(root));
    if (!lstatSync(this.root).isDirectory()) throw new Error('Workspace must be a directory.');
  }
  path(input: string, kind: 'project' | 'artifact' | 'asset', missing = false): string {
    const parts = input.split('/');
    if (!parts.length || parts.some((p, i) => !(kind === 'artifact' && i === 0 && p === '.daemonv12-renders') &&
      !/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(p)))
      fail('PATH_UNSAFE', input, 'Use a relative path without dot segments, hidden components or separators other than /.', 'Choose a path beneath the configured workspace.');
    if (parts.some(p => ['node_modules', '.git'].includes(p)) ||
      (kind === 'project' && (parts.includes('assets') || !input.endsWith('.json'))) ||
      (kind === 'artifact' && parts[0] !== '.daemonv12-renders'))
      fail('PATH_UNSAFE', input, 'This path is outside the permitted project or render area.', 'Use project JSON outside assets, or an artifact path returned by render.');
    let target = this.root;
    for (const [i, part] of parts.entries()) {
      target = join(target, part);
      let stat;
      try { stat = lstatSync(target); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT' && missing && i === parts.length - 1) return target;
        throw error;
      }
      if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()) || (stat.isFile() && stat.nlink !== 1))
        fail('PATH_UNSAFE', input, 'Symlinks, hard-linked files and special files are not permitted.', 'Use ordinary files and directories inside the workspace.');
      if (i < parts.length - 1 && !stat.isDirectory()) fail('PATH_UNSAFE', input, 'A path ancestor is not a directory.', 'Choose an existing project directory.');
    }
    return target;
  }
  read(input: string, kind: 'project' | 'artifact', maxBytes = MAX_PROJECT_BYTES): Buffer {
    const path = this.path(input, kind);
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = fstatSync(fd);
      if (!stat.isFile() || stat.nlink !== 1) fail('PATH_UNSAFE', input, 'Expected an ordinary file.', 'Choose a project or artifact file.');
      if (stat.size > maxBytes) fail('RESOURCE_LIMIT', input, 'File exceeds the MCP read limit.', `Limit is ${maxBytes} bytes.`);
      return readFileSync(fd);
    } finally { closeSync(fd); }
  }
  publish(input: string, text: string, expected?: string): void {
    const path = this.path(input, 'project', true);
    if (Buffer.byteLength(text) > MAX_PROJECT_BYTES) fail('RESOURCE_LIMIT', input, 'Project exceeds the MCP size limit.', 'Keep project JSON below 2 MiB.');
    const tempDir = mkdtempSync(join(dirname(path), '.daemonv12-edit-'));
    const temp = join(tempDir, 'project.json');
    try {
      const fd = openSync(temp, 'wx', 0o600);
      try { writeFileSync(fd, text); fsyncSync(fd); } finally { closeSync(fd); }
      this.path(input, 'project', true);
      if (expected !== undefined) {
        if (hash(this.read(input, 'project')) !== expected) fail('PROJECT_CONFLICT', input, 'Project changed since it was read.', 'Read the current project and retry with its sha256.');
        renameSync(temp, path);
      } else {
        // link is atomic and fails if the destination already exists; rename would overwrite.
        linkSync(temp, path);
      }
    } finally { rmSync(tempDir, {recursive: true, force: true}); }
  }
}
