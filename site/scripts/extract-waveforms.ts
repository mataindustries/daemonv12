// Extracts peak-envelope outlines from the repository's own sound-pack WAVs into
// src/data/waveforms.json. The site draws these real outlines (as the GLASS//FIRE promo
// does) instead of invented shapes. Run with `npm run waveforms` after a pack changes;
// the build never reads outside site/.
import {writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readWav} from './lib/wav.ts';

const site = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(site, '..', 'examples', 'assets');
const BUCKETS = 120;

const SOUNDS = {
  'glass-hit': 'glasshouse/01-glass-hit.wav',
  'glass-reverse': 'glasshouse/02-glass-reverse.wav',
  'ghost-vox': 'glasshouse/04-ghost-vox.wav',
  'prism-impact': 'glasshouse/10-prism-impact.wav',
  'mechanical-kick': 'orbital-foundry/02-mechanical-kick.wav',
  'cinematic-impact': 'orbital-foundry/07-cinematic-impact.wav',
  'tension-riser': 'orbital-foundry/08-tension-riser.wav',
  'dark-drone': 'orbital-foundry/10-dark-drone.wav',
} as const;

const round = (v: number) => Math.round(v * 1000) / 1000;

const out: Record<string, {file: string; seconds: number; env: number[]}> = {};
for (const [id, rel] of Object.entries(SOUNDS)) {
  const {samples, seconds} = readWav(join(assets, rel));
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  // Symmetric peak envelope per bucket: the outline reads cleanly at small sizes and
  // low-frequency cycles don't alias into a zigzag (as raw min/max would at 120 buckets).
  const env: number[] = [];
  for (let b = 0; b < BUCKETS; b++) {
    const i0 = Math.floor((b / BUCKETS) * samples.length);
    const i1 = Math.max(i0 + 1, Math.floor(((b + 1) / BUCKETS) * samples.length));
    let hi = 0;
    for (let i = i0; i < i1; i++) hi = Math.max(hi, Math.abs(samples[i] ?? 0));
    // Normalized to the sound's own peak so every outline fills its box.
    env.push(round(hi / peak));
  }
  out[id] = {file: `examples/assets/${rel}`, seconds: round(seconds), env};
}

writeFileSync(join(site, 'src', 'data', 'waveforms.json'), JSON.stringify(out) + '\n');
console.log(`wrote ${Object.keys(out).length} outlines × ${BUCKETS} buckets`);
