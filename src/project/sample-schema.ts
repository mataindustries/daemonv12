import { diagnostic, type Diagnostic, type Parsed } from '../diagnostics.ts';
import { parsePitch } from './pitch.ts';

export interface KitEntry { name: string; pitch: number; sample: string }
export type Kits = Map<string, KitEntry[]>;
export function assetPath(value: unknown, path: string): Parsed<string> {
  if (typeof value !== 'string') return { diagnostic: diagnostic('WRONG_TYPE', path, value, 'project-relative assets/ path') };
  if (!/^assets\/(?:[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\/)*[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(value))
    return { diagnostic: diagnostic('INVALID_ASSET_PATH', path, value, 'relative path below assets/, with no dot segments, backslashes or absolute paths') };
  return { value };
}
export function parseKit(value: unknown, path: string): { entries: KitEntry[]; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [], entries: KitEntry[] = [];
  const fail = (at: string, received: unknown, expected: string) => diagnostics.push(diagnostic('INVALID_DRUMKIT', at, received, expected));
  if (!value || typeof value !== 'object' || Array.isArray(value)) { fail(path, value, 'kit object'); return { entries, diagnostics }; }
  const kit = value as Record<string, unknown>;
  for (const key of Object.keys(kit)) if (!['formatVersion', 'samples'].includes(key)) fail(`${path}.${key}`, kit[key], 'formatVersion or samples');
  if (kit.formatVersion !== 1) fail(`${path}.formatVersion`, kit.formatVersion, '1');
  if (!Array.isArray(kit.samples) || !kit.samples.length || kit.samples.length > 128) fail(`${path}.samples`, kit.samples, '1–128 sample mappings');
  else kit.samples.forEach((raw, i) => {
    const at = `${path}.samples[${i}]`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { fail(at, raw, 'name, pitch, file object'); return; }
    const entry = raw as Record<string, unknown>;
    for (const key of Object.keys(entry)) if (!['name', 'pitch', 'file'].includes(key)) fail(`${at}.${key}`, entry[key], 'name, pitch or file');
    const pitch = parsePitch(entry.pitch, `${at}.pitch`);
    if (pitch.diagnostic) diagnostics.push(pitch.diagnostic);
    if (typeof entry.name !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(entry.name)) fail(`${at}.name`, entry.name, 'kebab-case name, at most 32 characters');
    // Kit files are portable directories: paths are relative to the kit JSON itself.
    const file = assetPath(`assets/${String(entry.file)}`, `${at}.file`);
    if (typeof entry.file !== 'string' || file.diagnostic) fail(`${at}.file`, entry.file, 'relative sample path without dot segments');
    if (entries.some(e => e.name === entry.name || e.pitch === pitch.value)) fail(at, entry, 'unique name and pitch');
    if (!pitch.diagnostic && typeof entry.name === 'string' && typeof entry.file === 'string' && !file.diagnostic)
      entries.push({ name: entry.name, pitch: pitch.value, sample: entry.file });
  });
  return { entries, diagnostics };
}
