/** Build every challenger project: render the union of instrument samples, write kits,
 * DaemonV12 projects and sync schedules.
 *
 *   node productions/permitpulse-maps-disagree/challenger/build.ts
 */
import { rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSamples, writeProject, type Score } from './build-lib.ts';
import { auditionA, auditionB } from './scores/auditions.ts';
import { challenger } from './scores/challenger.ts';

const here = dirname(fileURLToPath(import.meta.url));
const projectDir = join(here, 'project');
const scores: Score[] = [auditionA(), auditionB(), challenger('c1'), challenger('c2'), challenger('c3')];

rmSync(join(projectDir, 'assets/ppc'), { recursive: true, force: true });
mkdirSync(join(projectDir, 'assets/ppc'), { recursive: true });
const started = Date.now();
const catalog = renderSamples(projectDir, scores);
for (const score of scores) {
  const summary = writeProject(projectDir, score);
  console.log(`${score.id}: ${summary.tracks} tracks, ${summary.notes} notes, ${summary.bars} bars`);
}
const sources = ['build.ts', 'build-lib.ts', 'synth/dsp.ts', 'synth/instruments.ts', 'scores/auditions.ts', 'scores/challenger.ts']
  .map(path => ({ path, sha256: createHash('sha256').update(readFileSync(join(here, path))).digest('hex') }));
writeFileSync(join(here, 'catalog.json'), JSON.stringify({ pack: 'PermitPulse challenger (ppc)', note: 'Every sample is synthesized by synth/instruments.ts; no recordings or third-party audio.', sources, samples: catalog }, null, 1) + '\n');
console.log(`${catalog.length} samples rendered in ${((Date.now() - started) / 1000).toFixed(1)} s`);
