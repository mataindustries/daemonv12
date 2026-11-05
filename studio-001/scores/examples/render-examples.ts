/**
 * Renders the performance examples (rack direct route) and keeps MP3 listening copies, normalised to -16 LUFS
 * with a single gain each. The bass groove is also rendered from the same score at +5 semitones and 92 BPM.
 *   node studio-001/scores/examples/render-examples.ts      (needs FFmpeg)
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToDirectory } from '../../rack/cli.ts';
import { sha256 } from '../../rack/frozen.ts';

const here = dirname(fileURLToPath(import.meta.url)), build = join(here, '..', '..', 'demo', 'build', 'examples'), out = join(here, 'renders');
rmSync(build, { recursive: true, force: true }); rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const jobs: [string, string, { transpose?: number; bpm?: number }][] = [
  ['bass-groove', 'bass-groove', {}], ['bass-groove', 'bass-groove-a-minor-92bpm', { transpose: 5, bpm: 92 }],
  ['voice-duet', 'voice-duet', {}], ['clockwork', 'clockwork', {}],
];
const manifest: Record<string, unknown> = {};
for (const [score, name, o] of jobs) {
  const r = await renderToDirectory(join(here, `${score}.score.json`), join(build, name), { ...o, normalize: -16, log: s => console.error(`${name}: ${s}`) });
  cpSync(join(r.root, 'mix-context.mp3'), join(out, `${name}.mp3`));
  const ctx = (r.files as { file: string; loudness?: unknown; peak: number; clipped: number }[]).find(f => f.file === 'mix-context.wav')!;
  manifest[`${name}.mp3`] = { score: `studio-001/scores/examples/${score}.score.json`, ...o, seconds: +(r.frames / 44100).toFixed(3), contextWav: ctx, mp3Sha256: sha256(readFileSync(join(out, `${name}.mp3`))) };
}
writeFileSync(join(out, 'EXAMPLES.json'), JSON.stringify({ note: 'Listening copies of the rack direct render (context mix: all parts plus room), single-gain normalised to -16 LUFS. Plain measurements, not quality scores.', files: manifest }, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
