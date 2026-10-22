import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { renderPerformance } from './synth.mjs';
import { encodeWav, analyzeWav } from './wav.mjs';

export function renderFile(inputPath, outputPath) {
  const input = readFileSync(inputPath), performance = JSON.parse(input);
  const started = process.hrtime.bigint(), cpu = process.cpuUsage();
  const rendered = renderPerformance(performance);
  const wallSeconds = Number(process.hrtime.bigint() - started) / 1e9;
  const used = process.cpuUsage(cpu), wav = encodeWav(rendered.samples, rendered.sampleRate);
  mkdirSync(dirname(outputPath), {recursive: true}); writeFileSync(outputPath, wav);
  const sha = value => createHash('sha256').update(value).digest('hex');
  return { title: performance.title, inputSha256: sha(input), wavSha256: sha(wav),
    signal: analyzeWav(wav), synthesis: rendered.stats,
    observedCost: {wallSeconds, cpuSeconds: (used.user + used.system) / 1e6,
      realTimeFactor: wallSeconds / performance.seconds, maxRssMiB: process.resourceUsage().maxRSS / 1024} };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output || process.argv.length !== 4) throw new Error('Usage: node experiments/morph-voice/render.mjs PERFORMANCE.json OUTPUT.wav');
  console.log(JSON.stringify(renderFile(resolve(input), resolve(output)), null, 2));
}
