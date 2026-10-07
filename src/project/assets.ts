import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, resolve, relative, sep, posix } from 'node:path';
import { diagnostic, type Diagnostic } from '../diagnostics.ts';
import { assetPath, parseKit, type Kits } from './sample-schema.ts';

// Resolve existing ancestors too, so a symlinked output directory cannot overwrite assets.
export function outputInAssets(projectPath: string, outDir: string): boolean {
  function physical(path: string): string {
    try { return realpathSync(path); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const parent=dirname(path);
      if(parent===path)throw error;
      return resolve(physical(parent),relative(parent,path));
    }
  }
  const root=physical(resolve(dirname(projectPath),'assets')),output=physical(resolve(outDir));
  const rel=relative(root,output);
  return rel==='' || (rel!=='..' && !rel.startsWith(`..${sep}`) && !rel.startsWith(sep));
}

// The project directory is the trust root. Even a symlink named assets must stay inside it.
export function readAsset(projectPath: string, file: string, path: string): { bytes?: Buffer; diagnostic?: Diagnostic } {
  const parsed = assetPath(file, path);
  if (parsed.diagnostic) return { diagnostic: parsed.diagnostic };
  try {
    const projectRoot = realpathSync(dirname(projectPath));
    const root = resolve(projectRoot, 'assets'), target = resolve(projectRoot, file);
    const inside = (base: string, candidate: string) => { const rel = relative(base, candidate); return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !rel.startsWith(sep); };
    const realRoot = realpathSync(root), realTarget = realpathSync(target);
    if (!inside(projectRoot, realRoot) || (realRoot !== root && !inside(root, realRoot)) || !inside(realRoot, realTarget))
      return { diagnostic: diagnostic('INVALID_ASSET_PATH', path, file, 'asset whose real path stays under the project assets directory') };
    if (!statSync(realTarget).isFile()) return { diagnostic: diagnostic('ASSET_READ_FAILED', path, file, 'regular asset file') };
    return { bytes: readFileSync(realTarget) };
  } catch (error) {
    return { diagnostic: diagnostic((error as NodeJS.ErrnoException).code === 'ENOENT' ? 'ASSET_NOT_FOUND' : 'ASSET_READ_FAILED', path, file, 'readable file under project assets/') };
  }
}
export function loadKits(value: unknown, projectPath: string): { kits: Kits; files: Map<string, Buffer>; diagnostics: Diagnostic[] } {
  const kits: Kits = new Map(), files = new Map<string, Buffer>(), diagnostics: Diagnostic[] = [];
  const tracks = (value as {tracks?: unknown} | null)?.tracks;
  if (!Array.isArray(tracks)) return { kits, files, diagnostics };
  tracks.forEach((track, i) => {
    const instrument = track?.instrument;
    if (instrument?.type !== 'drumkit' || typeof instrument.kit !== 'string' || kits.has(instrument.kit)) return;
    const path = `tracks[${i}].instrument.kit`, file = instrument.kit;
    const read = readAsset(projectPath, file, path);
    if (read.diagnostic) { diagnostics.push(read.diagnostic); return; }
    let raw: unknown;
    try { raw = JSON.parse(read.bytes!.toString('utf8').replace(/^\uFEFF/, '')); }
    catch { diagnostics.push(diagnostic('INVALID_DRUMKIT', path, file, 'valid JSON drum kit')); return; }
    const parsed = parseKit(raw, path);
    diagnostics.push(...parsed.diagnostics);
    if (!parsed.diagnostics.length) {
      kits.set(file, parsed.entries.map(e => ({...e, sample:posix.join(posix.dirname(file), e.sample)})));
      files.set(file, read.bytes!);
    }
  });
  return { kits, files, diagnostics };
}
