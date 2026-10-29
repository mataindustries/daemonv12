/** SAMPLE LAB 02: write every original source recording (generation 0) of the three sketches.
 * Run: node experiments/sample-lab-02/scripts/generate-sources.ts [output directory]
 *
 * A  intercept.wav, hum.wav            (ghost-sources.ts)
 * B  mug.wav, drips.wav, box.wav, book.wav, coin.wav   (object-sources.ts)
 * C  stairwell.wav                     (whistle-source.ts)
 *
 * Every file is a pure function of the code: Node built-ins, fixed xorshift32 seeds, no input files, recordings,
 * downloads or network. Peaks are scaled to a fixed target and PCM16 is written with explicit rounding. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { scaleTo, sha256, wavBytes, type Wave } from './dsp.ts';
import { intercept, hum } from './ghost-sources.ts';
import { mugTake, dripTake, boxTake, bookTake, coinTake } from './object-sources.ts';
import { stairwellTake } from './whistle-source.ts';

export interface SourceFile { file: string; sketch: string; bytes: number; sha256: string; channels: number; seconds: number }
export function generate(outDir: string): SourceFile[] {
  mkdirSync(outDir, { recursive: true });
  const takes: [file: string, sketch: string, make: () => Wave[], peakDbfs: number][] = [
    ['intercept.wav', 'ghost-frequency', () => [intercept().wave], -1],
    ['hum.wav', 'ghost-frequency', () => [hum()], -3],
    ['mug.wav', 'object-orchestra', () => mugTake().channels, -1],
    ['drips.wav', 'object-orchestra', () => dripTake().channels, -1],
    ['box.wav', 'object-orchestra', () => boxTake().channels, -1],
    ['book.wav', 'object-orchestra', () => bookTake().channels, -1],
    ['coin.wav', 'object-orchestra', () => coinTake().channels, -1],
    ['stairwell.wav', 'time-fracture', () => stairwellTake().channels, -1],
  ];
  return takes.map(([file, sketch, make, target]) => {
    const channels = make();
    scaleTo(channels, target);
    const bytes = wavBytes(channels);
    writeFileSync(join(outDir, file), bytes);
    return { file, sketch, bytes: bytes.length, sha256: sha256(bytes), channels: channels.length, seconds: channels[0]!.length / 44100 };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'projects', 'assets', 'sources'));
  console.log(JSON.stringify({ outDir: out, files: generate(out) }, null, 2));
}
