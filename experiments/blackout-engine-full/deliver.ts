/**
 * Copy the finished full-length BLACKOUT//ENGINE into experiments/blackout-engine-full/delivery/ (replaced on each run):
 *   blackout-engine-full.wav            master: 44.1 kHz / 16-bit stereo, 5,953,500 frames = exactly 2:15.000
 *   blackout-engine-full.mp3            listening copy: 192 kbps libmp3lame (the engine's own encode)
 *   stems/<track>.flac                  the engine's 14 aligned stems, lossless (each verified to decode to the engine PCM)
 *   provenance/                         engine manifest, analysis and validation; rack manifest and expanded performance;
 *                                       stem-group sums; one-shot catalogs; QA before and after the fix pass; the freeze
 *                                       check; the check that the approved 30-second package is unchanged
 *   SHA256SUMS
 *
 *   node experiments/blackout-engine-full/build.ts pre-qa && node experiments/blackout-engine-full/build.ts
 *   python3 -I experiments/blackout-engine-full/qa/measure.py experiments/blackout-engine-full/build/pre-qa --json experiments/blackout-engine-full/build/pre-qa/qa.json
 *   python3 -I experiments/blackout-engine-full/qa/measure.py experiments/blackout-engine-full/build/final --json experiments/blackout-engine-full/build/final/qa.json
 *   node experiments/blackout-engine-full/deliver.ts
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ONE_SHOTS } from './compose.ts';

const HERE = dirname(fileURLToPath(import.meta.url)), REPO = resolve(HERE, '..', '..'), NAME = 'blackout-engine-full';
const FINAL = join(HERE, 'build', 'final'), PRE = join(HERE, 'build', 'pre-qa'), OUT = join(HERE, 'delivery'), R = join(FINAL, 'render');
const ffmpeg = process.env.DAEMONV12_FFMPEG || 'ffmpeg';
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const ff = (args: string[]) => { const r = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', ...args], { maxBuffer: 512 << 20 }); if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`); return r.stdout as Buffer; };
for (const f of [join(R, `${NAME}.wav`), join(FINAL, 'qa.json'), join(PRE, 'qa.json')]) if (!existsSync(f)) throw new Error(`missing ${relative(REPO, f)}: build both stages and run the QA script first (see the header)`);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'stems'), { recursive: true }); mkdirSync(join(OUT, 'provenance', 'oneshots'), { recursive: true });
copyFileSync(join(R, `${NAME}.wav`), join(OUT, `${NAME}.wav`));
copyFileSync(join(R, `${NAME}.mp3`), join(OUT, `${NAME}.mp3`));
const P = (f: string) => join(OUT, 'provenance', f);
copyFileSync(join(R, `${NAME}.render.json`), P('engine.render.json'));
copyFileSync(join(R, `${NAME}.analysis.json`), P('engine.analysis.json'));
copyFileSync(join(FINAL, 'validate.json'), P('engine.validate.json'));
copyFileSync(join(FINAL, 'rack', 'render.json'), P('rack.render.json'));
copyFileSync(join(FINAL, 'rack', 'performance.json'), P('rack.performance.json'));
copyFileSync(join(FINAL, 'stem-groups.json'), P('stem-groups.json'));
copyFileSync(join(PRE, 'qa.json'), P('qa-before-fix-pass.json'));
copyFileSync(join(FINAL, 'qa.json'), P('qa-final.json'));
for (const [pkg] of ONE_SHOTS) copyFileSync(join(FINAL, 'oneshots', pkg, 'catalog.json'), P(join('oneshots', `${pkg}.catalog.json`)));
// the approved engines the rack loaded are hash-checked against studio-001/rack/frozen.json
const freeze = spawnSync(process.execPath, ['studio-001/rack/cli.ts', 'freeze'], { cwd: REPO, encoding: 'utf8' });
if (freeze.status !== 0) throw new Error(`freeze check failed: ${freeze.stdout}${freeze.stderr}`);
writeFileSync(P('freeze-check.txt'), `$ node studio-001/rack/cli.ts freeze\n${freeze.stdout}${freeze.stderr}`);
// the approved 30-second package: every file its SHA256SUMS lists still hashes the same, and git sees no change
const APPROVED = join(REPO, 'experiments', 'blackout-engine-001');
const lines = readFileSync(join(APPROVED, 'delivery', 'SHA256SUMS'), 'utf8').split('\n').filter(l => /^[0-9a-f]{64}  /.test(l) && !l.includes('engine-wav/'));
const bad = lines.filter(l => { const [h, f] = [l.slice(0, 64), l.slice(66)]; return sha(readFileSync(join(APPROVED, 'delivery', f))) !== h; });
if (bad.length) throw new Error(`approved 30-second delivery changed: ${bad.join(', ')}`);
const git = spawnSync('git', ['status', '--porcelain', '--', 'experiments/blackout-engine-001'], { cwd: REPO, encoding: 'utf8' });
if (git.status !== 0 || git.stdout.trim()) throw new Error(`approved 30-second directory is not clean in git: ${git.stdout}`);
const tree = spawnSync('git', ['rev-parse', 'HEAD:experiments/blackout-engine-001'], { cwd: REPO, encoding: 'utf8' }).stdout.trim();
writeFileSync(P('approved-30s-unchanged.txt'), `experiments/blackout-engine-001 (the approved 30-second master, source, stems and provenance)\n`
  + `all ${lines.length} files listed in its delivery/SHA256SUMS verify; git reports no change; tree ${tree}\n`);

const stemWav: string[] = [];
for (const f of readdirSync(join(R, `${NAME}.stems`)).filter(x => x.endsWith('.wav')).sort()) {
  const wav = join(R, `${NAME}.stems`, f), flac = join(OUT, 'stems', f.replace(/\.wav$/, '.flac'));
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
