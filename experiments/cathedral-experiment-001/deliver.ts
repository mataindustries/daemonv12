/**
 * Copy the finished experiment into experiments/cathedral-experiment-001/delivery/ (replaced on each run):
 *
 *   listening/   the three auditions, the V2 reference (same bars, same loudness) and the three dry examples: MP3 320 kbps
 *   lossless/    the same seven files as WAV, 44.1 kHz / 24-bit stereo (24-bit because a loudness-matching gain was
 *                applied to the engine's 16-bit output: nothing is re-dithered or truncated)
 *   provenance/  build manifest (every measurement and gain), QA before and after the fix pass, determinism record,
 *                freeze check, V2 backing verification, the instrument registry entries, source hashes, and the rack and
 *                engine manifests of every render (expanded performances: every note played, instrument versions)
 *   SHA256SUMS
 *
 *   PYTHON=... node experiments/cathedral-experiment-001/verify.ts && node experiments/cathedral-experiment-001/deliver.ts
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { HERE } from './backing.ts';
import { AUDITIONS, DRY } from './compose.ts';
import { instrumentsJson } from './instruments/docs.ts';

const BUILD = join(HERE, 'build'), OUT = join(HERE, 'delivery'), P = join(OUT, 'provenance');
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const need = ['manifest.json', 'qa-before-fix-pass.json', 'qa-final.json', 'determinism.json', 'freeze-check.txt', 'v2/verify.json'];
for (const f of need) if (!existsSync(join(BUILD, f))) throw new Error(`missing build/${f}: run verify.ts first`);
const manifest = JSON.parse(readFileSync(join(BUILD, 'manifest.json'), 'utf8')) as { stage: string; files: { id: string }[] };
if (!manifest.stage.startsWith('final')) throw new Error(`build/ holds the ${manifest.stage} build: run verify.ts (it ends with the final build)`);

/** Delivery names: what each file is, readable in a file list. */
const NAMES: Record<string, string> = {
  '0-v2-reference': '0-concrete-gospel-v2-reference-bars-5-16',
  '1-throne-volt': '1-throne-volt-analog-lead-over-v2',
  '2-cathedral-engine': '2-cathedral-engine-organ-over-v2',
  '3-heaven-mass': '3-heaven-mass-choir-over-v2-drums',
  'dry-throne-volt': 'dry-1-throne-volt',
  'dry-cathedral-engine': 'dry-2-cathedral-engine',
  'dry-heaven-mass': 'dry-3-heaven-mass',
};
rmSync(OUT, { recursive: true, force: true });
for (const d of ['listening', 'lossless', 'provenance/rack', 'provenance/engine']) mkdirSync(join(OUT, d), { recursive: true });
for (const f of manifest.files) {
  const name = NAMES[f.id]; if (!name) throw new Error(`no delivery name for ${f.id}`);
  copyFileSync(join(BUILD, 'listen', `${f.id}.mp3`), join(OUT, 'listening', `${name}.mp3`));
  copyFileSync(join(BUILD, 'listen', `${f.id}.wav`), join(OUT, 'lossless', `${name}.wav`));
}
copyFileSync(join(BUILD, 'manifest.json'), join(P, 'build-manifest.json'));
for (const f of ['qa-before-fix-pass.json', 'qa-final.json', 'determinism.json', 'freeze-check.txt']) copyFileSync(join(BUILD, f), join(P, f));
copyFileSync(join(BUILD, 'v2', 'verify.json'), join(P, 'v2-backing-verify.json'));
writeFileSync(join(P, 'instruments.registry.json'), JSON.stringify(instrumentsJson(), null, 1) + '\n');
for (const s of [...AUDITIONS.map(a => a.id), ...DRY.map(d => d.id)]) {
  copyFileSync(join(BUILD, 'rack', s, 'render.json'), join(P, 'rack', `${s}.render.json`));
  copyFileSync(join(BUILD, 'rack', s, 'performance.json'), join(P, 'rack', `${s}.performance.json`));
}
for (const a of AUDITIONS) {
  const r = join(BUILD, 'engine', a.id, 'render');
  copyFileSync(join(r, `${a.id}.render.json`), join(P, 'engine', `${a.id}.render.json`));
  copyFileSync(join(r, `${a.id}.analysis.json`), join(P, 'engine', `${a.id}.analysis.json`));
}
// every source file of the experiment (the instruments, the compositions, the pipeline, the QA, the vendored V2 sources)
const sources: string[] = [];
const walk = (d: string) => { for (const e of readdirSync(d).sort()) { const p = join(d, e); if (['build', 'delivery', '__pycache__'].includes(e)) continue; if (statSync(p).isDirectory()) walk(p); else sources.push(p); } };
walk(HERE);
writeFileSync(join(P, 'sources.SHA256SUMS'), sources.map(p => `${sha(readFileSync(p))}  ${relative(HERE, p)}`).join('\n') + '\n');
const files: string[] = [];
const walk2 = (d: string) => { for (const e of readdirSync(d).sort()) { const p = join(d, e); if (statSync(p).isDirectory()) walk2(p); else if (e !== 'SHA256SUMS') files.push(p); } };
walk2(OUT);
writeFileSync(join(OUT, 'SHA256SUMS'), files.map(p => `${sha(readFileSync(p))}  ${relative(OUT, p)}`).join('\n') + '\n');
console.log(`delivered ${files.length} files to ${relative(process.cwd(), OUT)}`);
