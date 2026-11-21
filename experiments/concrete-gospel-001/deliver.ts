/**
 * Copy a finished build into experiments/concrete-gospel-001/delivery/ (replaced on each run):
 *   concrete-gospel.wav / .mp3        master and phone copy
 *   stems/<track>.flac                the engine's 12 aligned stems, lossless (PCM verified identical to the WAVs)
 *   provenance/                       engine manifest + analysis, rack render manifest + expanded performance, qa.json
 *   SHA256SUMS                        every delivered file, plus the SHA-256 of each stem's original engine WAV
 *
 *   node experiments/concrete-gospel-001/build.ts && node experiments/concrete-gospel-001/deliver.ts
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), BUILD = join(HERE, 'build'), OUT = join(HERE, 'delivery'), R = join(BUILD, 'render');
const ffmpeg = process.env.DAEMONV12_FFMPEG || 'ffmpeg';
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const ff = (args: string[]) => { const r = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', ...args], { maxBuffer: 256 << 20 }); if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`); return r.stdout as Buffer; };
/** PCM payload of a canonical 44-byte-header engine WAV. */
const wavPcm = (file: string) => readFileSync(file).subarray(44);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'stems'), { recursive: true }); mkdirSync(join(OUT, 'provenance'), { recursive: true });
copyFileSync(join(R, 'concrete-gospel.wav'), join(OUT, 'concrete-gospel.wav'));
copyFileSync(join(R, 'concrete-gospel.mp3'), join(OUT, 'concrete-gospel.mp3'));
copyFileSync(join(R, 'concrete-gospel.render.json'), join(OUT, 'provenance', 'engine.render.json'));
copyFileSync(join(R, 'concrete-gospel.analysis.json'), join(OUT, 'provenance', 'engine.analysis.json'));
copyFileSync(join(BUILD, 'rack', 'render.json'), join(OUT, 'provenance', 'rack.render.json'));
copyFileSync(join(BUILD, 'rack', 'performance.json'), join(OUT, 'provenance', 'rack.performance.json'));
copyFileSync(join(BUILD, 'rack', 'SHA256SUMS'), join(OUT, 'provenance', 'rack.SHA256SUMS'));
// technical QA record from qa/measure.py, when it has been run on this build
if (existsSync(join(BUILD, 'qa.json'))) copyFileSync(join(BUILD, 'qa.json'), join(OUT, 'provenance', 'qa.json'));

const stemWavHashes: string[] = [];
for (const f of readdirSync(join(R, 'concrete-gospel.stems')).filter(x => x.endsWith('.wav')).sort()) {
  const wav = join(R, 'concrete-gospel.stems', f), flac = join(OUT, 'stems', f.replace(/\.wav$/, '.flac'));
  ff(['-y', '-i', wav, '-c:a', 'flac', '-compression_level', '8', '-map_metadata', '-1', '-fflags', '+bitexact', flac]);
  const back = ff(['-i', flac, '-f', 's16le', '-acodec', 'pcm_s16le', '-']);
  if (!back.equals(wavPcm(wav))) throw new Error(`${f}: FLAC does not decode to the engine PCM`);
  stemWavHashes.push(`${sha(readFileSync(wav))}  engine-wav/${f}`);
}
const files: string[] = [];
const walk = (d: string) => { for (const e of readdirSync(d).sort()) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else if (e !== 'SHA256SUMS') files.push(p); } };
walk(OUT);
writeFileSync(join(OUT, 'SHA256SUMS'), files.map(p => `${sha(readFileSync(p))}  ${relative(OUT, p)}`).join('\n') + '\n'
  + '# engine stem WAVs (as recorded in provenance/engine.render.json); each FLAC above decodes to identical PCM (ffmpeg -i stems/X.flac X.wav)\n'
  + stemWavHashes.join('\n') + '\n');
console.log(`delivered ${files.length} files to ${relative(process.cwd(), OUT)}`);
