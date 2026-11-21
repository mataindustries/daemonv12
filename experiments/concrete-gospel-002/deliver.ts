/**
 * Copy the finished V2 into experiments/concrete-gospel-002/delivery/ (replaced on each run):
 *   concrete-gospel-v2.wav / .mp3                  full V2 master and phone copy
 *   concrete-gospel-v1-vs-v2-drums-bass.mp3        the loudness-matched drum-and-bass A/B (bars 5-10, V1 then V2)
 *   stems/<track>.flac                             the engine's 12 aligned stems, lossless (PCM verified)
 *   provenance/                                    engine manifest + analysis, rack manifest + performance, one-shot
 *                                                  catalogs, A/B record, drum and mix QA for V1 and V2
 *   SHA256SUMS
 *
 *   node build.ts ab && node ab.ts && node build.ts full
 *   python3 -I qa/drums.py ...; python3 -I qa/checks.py ...   (see README)
 *   node experiments/concrete-gospel-002/deliver.ts
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ONE_SHOTS } from './compose.ts';

const HERE = dirname(fileURLToPath(import.meta.url)), BUILD = join(HERE, 'build', 'full'), OUT = join(HERE, 'delivery'), R = join(BUILD, 'render');
const ffmpeg = process.env.DAEMONV12_FFMPEG || 'ffmpeg';
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const ff = (args: string[]) => { const r = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', ...args], { maxBuffer: 256 << 20 }); if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`); return r.stdout as Buffer; };

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'stems'), { recursive: true }); mkdirSync(join(OUT, 'provenance', 'oneshots'), { recursive: true });
copyFileSync(join(R, 'concrete-gospel.wav'), join(OUT, 'concrete-gospel-v2.wav'));
copyFileSync(join(R, 'concrete-gospel.mp3'), join(OUT, 'concrete-gospel-v2.mp3'));
copyFileSync(join(HERE, 'ab', 'concrete-gospel-v1-vs-v2-drums-bass.mp3'), join(OUT, 'concrete-gospel-v1-vs-v2-drums-bass.mp3'));
copyFileSync(join(HERE, 'ab', 'ab.json'), join(OUT, 'provenance', 'ab.json'));
copyFileSync(join(R, 'concrete-gospel.render.json'), join(OUT, 'provenance', 'engine.render.json'));
copyFileSync(join(R, 'concrete-gospel.analysis.json'), join(OUT, 'provenance', 'engine.analysis.json'));
copyFileSync(join(BUILD, 'rack', 'render.json'), join(OUT, 'provenance', 'rack.render.json'));
copyFileSync(join(BUILD, 'rack', 'performance.json'), join(OUT, 'provenance', 'rack.performance.json'));
for (const [pkg] of ONE_SHOTS) copyFileSync(join(BUILD, 'oneshots', pkg, 'catalog.json'), join(OUT, 'provenance', 'oneshots', `${pkg}.catalog.json`));
for (const q of ['drums-v1.json', 'drums-v2.json', 'checks-v1.json', 'checks-v2.json']) {
  if (!existsSync(join(BUILD, q))) throw new Error(`run the QA scripts first: ${q} missing`);
  copyFileSync(join(BUILD, q), join(OUT, 'provenance', `qa-${q}`));
}
const stemWav: string[] = [];
for (const f of readdirSync(join(R, 'concrete-gospel.stems')).filter(x => x.endsWith('.wav')).sort()) {
  const wav = join(R, 'concrete-gospel.stems', f), flac = join(OUT, 'stems', f.replace(/\.wav$/, '.flac'));
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
