// Render MORPH//02 sketches: 24-bit masters, 16-bit engine-compatible copies, MP3 listening copies.
// Usage: node experiments/morph-02/build.mjs [a|b|c ...] [--out DIR]
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { writeWav, peakOf, lufs, scale, dbToGain } from './dsp.mjs';
import { renderPerformance } from '../morph-voice/synth.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SKETCHES = {
  a: ['a-the-machine-learns-to-sing', './a-machine-learns-to-sing.mjs'],
  b: ['b-the-alarm-that-breaks-reality', './b-alarm-breaks-reality.mjs'],
  c: ['c-the-impossible-instrument', './c-impossible-instrument.mjs'],
};
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const out = resolve(outIndex >= 0 ? args.splice(outIndex, 2)[1] : join(here, 'audio'));
const reference = args.includes('--reference');
const pick = args.filter(a => a !== '--reference').length ? args.filter(a => a !== '--reference') : Object.keys(SKETCHES);
mkdirSync(out, { recursive: true });
const sha = b => createHash('sha256').update(b).digest('hex');
for (const key of pick) {
  const [name, module] = SKETCHES[key];
  const started = process.hrtime.bigint();
  const { render } = await import(module);
  const { bus, meta } = render();
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  const wav = join(out, `${name}.wav`), wav16 = join(out, 'pcm16', `${name}.pcm16.wav`), mp3 = join(out, `${name}.mp3`);
  writeWav(wav, bus, 24);
  writeWav(wav16, bus, 16);
  const enc = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '256k', '-map_metadata', '-1', '-fflags', '+bitexact', mp3]);
  if (enc.status !== 0) console.warn(`mp3 encode failed for ${name}: ${enc.stderr}`);
  writeFileSync(join(out, `${name}.meta.json`), JSON.stringify({ ...meta, peak: peakOf(bus), wav24Sha256: sha(readFileSync(wav)), wav16Sha256: sha(readFileSync(wav16)), node: process.version }, null, 2) + '\n');
  console.log(`${name}: ${seconds.toFixed(1)} s render; ${JSON.stringify(meta)}`);
}

// A loudness-matched MORPH//01 listening reference (pure gain to -14 LUFS, no limiting), so an
// A/B against MORPH//02 is not won by level alone. The original MORPH//01 renderer is unchanged.
if (reference) {
  for (const name of ['the-performance', 'the-impossible-gesture']) {
    const perf = JSON.parse(readFileSync(join(here, '..', 'morph-voice', 'performances', `${name}.json`), 'utf8'));
    const { samples } = renderPerformance(perf);
    const bus = { L: Float64Array.from(samples), R: Float64Array.from(samples) };
    const gain = dbToGain(-14 - lufs(bus));
    scale(bus.L, gain); scale(bus.R, gain);
    if (peakOf(bus) >= 0.89) throw new Error('reference would need limiting; refusing');
    const wav = join(out, 'reference', `morph-01-${name}.lufs-14.wav`);
    writeWav(wav, bus, 16);
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '256k', '-map_metadata', '-1', wav.replace(/\.wav$/, '.mp3')]);
    console.log(`reference ${name}: gain ${(20 * Math.log10(gain)).toFixed(2)} dB, peak ${peakOf(bus).toFixed(3)}`);
  }
}
