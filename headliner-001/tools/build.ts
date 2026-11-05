/**
 * Build a HEADLINER 001 target: generate its original instrument kits and write the DaemonV12 project.
 *   node headliner-001/tools/build.ts <target> <outDir>
 * Targets: sketch-a | sketch-b | sketch-c | single. Output: <outDir>/<target>.json, <outDir>/assets/sodium/<kit>/*,
 * <outDir>/<target>.catalog.json (per-sound recipe, frames, SHA-256). Deterministic: no clock, no randomness
 * beyond seeded generators, no input files.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Song } from './song.ts';

const args = process.argv.slice(2), projectOnly = args.includes('--project-only'), [target, outDir] = args.filter(a => !a.startsWith('--'));
if (!target || !outDir) { console.error('usage: build.ts <sketch-a|sketch-b|sketch-c|single> <outDir>'); process.exit(2); }
const builders: Record<string, () => Promise<Song>> = {
  'sketch-a': async () => (await import('./sketch-a.ts')).buildSketchA(),
  'sketch-b': async () => (await import('./sketch-b.ts')).buildSketchB(),
  'sketch-c': async () => (await import('./sketch-c.ts')).buildSketchC(),
  'single': async () => (await import('./single.ts')).buildSingle(),
};
const make = builders[target];
if (!make) { console.error(`unknown target ${target}`); process.exit(2); }
const song = await make();
const { project, catalog } = song.write(outDir, target, 'assets/sodium', projectOnly);
const toolHashes = ['dsp.ts', 'instruments.ts', 'kits.ts', 'song.ts', 'theory.ts', 'hook.ts', `${target}.ts`, 'build.ts']
  .map(f => { try { return { file: `headliner-001/tools/${f}`, sha256: createHash('sha256').update(readFileSync(new URL(f, import.meta.url))).digest('hex') }; } catch { return null; } })
  .filter(Boolean);
writeFileSync(join(outDir, `${target}.catalog.json`), JSON.stringify({
  schema: 'headliner-001.catalog/1', target, title: song.title, bpm: song.bpm, bars: song.bars, key: song.key,
  provenance: 'Every WAV is synthesized by headliner-001/tools from numeric parameters and seeded PRNGs. No recordings, downloaded samples, SoundFonts, impulse responses, presets or third-party audio. Generated for this repository by an AI agent at the owner\'s request.',
  license: 'PENDING OWNER DECLARATION — no license is granted by this file.',
  generator: toolHashes, node: process.version, sounds: catalog,
}, null, 2) + '\n');
const bytes = catalog.reduce((a, c) => a + (c.bytes as number), 0);
console.log(`${project}: ${song.tracks.length} tracks, ${catalog.length} sounds, ${(bytes / 1048576).toFixed(1)} MiB of WAV`);
