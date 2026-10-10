// Development-only reference click on the locked 160 BPM grid. Not music; never shipped.
//
//   npm run click   →  public/dev/click-160bpm.wav (24.000 s, 48 kHz, mono, quiet)
//
// Beats: short 1.6 kHz tick. Bar lines: 2.4 kHz. Act boundaries (bars 1, 3, 5, 9, 11, 15):
// 3.2 kHz accent. Render with --props='{"audio":"click"}' or pick it in Studio.
import {mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {ACTS} from '../src/timeline/acts.ts';
import {BARS, BEATS_PER_BAR, DURATION_SECONDS, SECONDS_PER_BEAT} from '../src/timeline/grid.ts';
import {writeWav16} from './lib/wav.ts';

export const CLICK_RATE = 48000;

export const buildClick = (rate = CLICK_RATE): Float32Array => {
  const out = new Float32Array(DURATION_SECONDS * rate);
  const actBars = new Set(ACTS.map(a => a.firstBar));
  for (let beat = 0; beat < BARS * BEATS_PER_BAR; beat++) {
    const bar = Math.floor(beat / BEATS_PER_BAR) + 1;
    const downbeat = beat % BEATS_PER_BAR === 0;
    const freq = downbeat && actBars.has(bar) ? 3200 : downbeat ? 2400 : 1600;
    const amp = downbeat ? 0.22 : 0.12;
    // beat · 0.375 s · rate is an exact integer at 48 kHz (18,000 samples per beat).
    const start = Math.round(beat * SECONDS_PER_BEAT * rate);
    const length = Math.round(0.012 * rate);
    for (let i = 0; i < length && start + i < out.length; i++) {
      out[start + i] = amp * Math.sin((2 * Math.PI * freq * i) / rate) * Math.exp(-i / (0.0025 * rate));
    }
  }
  return out;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'dev', 'click-160bpm.wav');
  mkdirSync(dirname(target), {recursive: true});
  writeWav16(target, [buildClick()], CLICK_RATE);
  console.log(`wrote ${target} (24.000 s, 48 kHz, 160 BPM reference click)`);
}
