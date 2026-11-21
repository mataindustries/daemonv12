/**
 * Copy the finished BLACKOUT//ENGINE into experiments/blackout-engine-001/delivery/ (replaced on each run):
 *   blackout-engine.wav                 master: 44.1 kHz / 16-bit stereo, 1,323,000 frames = exactly 30.000 s
 *   blackout-engine.mp3                 phone copy: 192 kbps libmp3lame (the engine's own encode)
 *   stems/<track>.flac                  the engine's 13 aligned stems, lossless (each verified to decode to the engine PCM)
 *   provenance/                         engine manifest + analysis, rack manifest + expanded performance, one-shot
 *                                       catalogs, the QA records before and after the fix pass, the freeze check
 *   SHA256SUMS
 *
 *   node experiments/blackout-engine-001/build.ts pre-qa && node experiments/blackout-engine-001/build.ts
 *   python3 -I experiments/blackout-engine-001/qa/measure.py experiments/blackout-engine-001/build/pre-qa --json experiments/blackout-engine-001/build/pre-qa/qa.json
 *   python3 -I experiments/blackout-engine-001/qa/measure.py experiments/blackout-engine-001/build/final --json experiments/blackout-engine-001/build/final/qa.json
 *   node experiments/blackout-engine-001/deliver.ts
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ONE_SHOTS } from './compose.ts';

const HERE = dirname(fileURLToPath(import.meta.url)), REPO = resolve(HERE, '..', '..');
const FINAL = join(HERE, 'build', 'final'), PRE = join(HERE, 'build', 'pre-qa'), OUT = join(HERE, 'delivery'), R = join(FINAL, 'render');
const ffmpeg = process.env.DAEMONV12_FFMPEG || 'ffmpeg';
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const ff = (args: string[]) => { const r = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', ...args], { maxBuffer: 256 << 20 }); if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`); return r.stdout as Buffer; };
for (const f of [join(R, 'blackout-engine.wav'), join(FINAL, 'qa.json'), join(PRE, 'qa.json')]) if (!existsSync(f)) throw new Error(`missing ${relative(REPO, f)}: build both stages and run the QA script first (see the header)`);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'stems'), { recursive: true }); mkdirSync(join(OUT, 'provenance', 'oneshots'), { recursive: true });
copyFileSync(join(R, 'blackout-engine.wav'), join(OUT, 'blackout-engine.wav'));
copyFileSync(join(R, 'blackout-engine.mp3'), join(OUT, 'blackout-engine.mp3'));
copyFileSync(join(R, 'blackout-engine.render.json'), join(OUT, 'provenance', 'engine.render.json'));
copyFileSync(join(R, 'blackout-engine.analysis.json'), join(OUT, 'provenance', 'engine.analysis.json'));
copyFileSync(join(FINAL, 'rack', 'render.json'), join(OUT, 'provenance', 'rack.render.json'));
copyFileSync(join(FINAL, 'rack', 'performance.json'), join(OUT, 'provenance', 'rack.performance.json'));
copyFileSync(join(PRE, 'qa.json'), join(OUT, 'provenance', 'qa-before-fix-pass.json'));
copyFileSync(join(FINAL, 'qa.json'), join(OUT, 'provenance', 'qa-final.json'));
for (const [pkg] of ONE_SHOTS) copyFileSync(join(FINAL, 'oneshots', pkg, 'catalog.json'), join(OUT, 'provenance', 'oneshots', `${pkg}.catalog.json`));
// the approved engines the rack loaded are hash-checked against studio-001/rack/frozen.json
const freeze = spawnSync(process.execPath, ['studio-001/rack/cli.ts', 'freeze'], { cwd: REPO, encoding: 'utf8' });
if (freeze.status !== 0) throw new Error(`freeze check failed: ${freeze.stdout}${freeze.stderr}`);
writeFileSync(join(OUT, 'provenance', 'freeze-check.txt'), `$ node studio-001/rack/cli.ts freeze\n${freeze.stdout}${freeze.stderr}`);

const stemWav: string[] = [];
for (const f of readdirSync(join(R, 'blackout-engine.stems')).filter(x => x.endsWith('.wav')).sort()) {
  const wav = join(R, 'blackout-engine.stems', f), flac = join(OUT, 'stems', f.replace(/\.wav$/, '.flac'));
  ff(['-y', '-i', wav, '-c:a', 'flac', '-compression_level', '8', '-map_metadata', '-1', '-fflags', '+bitexact', flac]);
  if (!ff(['-i', flac, '-f', 's16le', '-acodec', 'pcm_s16le', '-']).equals(readFileSync(wav).subarray(44))) throw new Error(`${f}: FLAC does not decode to the engine PCM`);
  stemWav.push(`${sha(readFileSync(wav))}  engine-wav/${f}`);
}
const files: string[] = [];
const walk = (d: string) => { for (const e of readdirSync(d).sort()) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else if (e !== 'SHA256SUMS') files.push(p); } };
walk(OUT);
writeFileSync(join(OUT, 'SHA256SUMS'), files.map(p => `${sha(readFileSync(p))}  ${relative(OUT, p)}`).join('\n') + '\n'
  + '# engine stem WAVs (as recorded in provenance/engine.render.json); each FLAC above decodes to identical PCM (ffmpeg -i stems/X.flac X.wav)\n'
  + stemWav.join('\n') + '\n');
console.log(`delivered ${files.length} files to ${relative(process.cwd(), OUT)}`);
