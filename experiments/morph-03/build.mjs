// Render MORPH//03 loops: 24-bit masters + MP3 listening copies + automation lanes (+ stems for analysis).
// Usage: node experiments/morph-03/build.mjs [1|2|3 ...] [--out DIR] [--stems]
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { writeWav, peakOf } from './dsp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const EXPERIMENTS = {
  1: ['morph03-1-cable-bass', './exp1-cable-bass.mjs'],
  2: ['morph03-2-wobble-beast', './exp2-wobble-beast.mjs'],
  3: ['morph03-3-the-groove', './exp3-the-groove.mjs'],
};
const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, name === '--out' ? 2 : 1); return v ?? true; };
const outArg = flag('--out'), wantStems = flag('--stems');
const out = resolve(outArg && outArg !== true ? outArg : join(here, 'audio'));
const pick = args.length ? args : Object.keys(EXPERIMENTS);
const sha = b => createHash('sha256').update(b).digest('hex');
mkdirSync(out, { recursive: true });
for (const key of pick) {
  const [name, module] = EXPERIMENTS[key];
  const started = process.hrtime.bigint();
  const mod = await import(module);
  const { bus, meta } = mod.render();
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  const wav = join(out, `${name}.wav`), mp3 = join(out, `${name}.mp3`);
  writeWav(wav, bus, 24);
  const enc = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '256k', '-map_metadata', '-1', '-fflags', '+bitexact', mp3]);
  if (enc.status !== 0) console.warn(`mp3 encode failed for ${name}: ${enc.stderr}`);
  // the WAV loops seamlessly; MP3 priming/padding would add a gap at a player's loop point,
  // so also give a 4x-repeated listening copy cut from the seamless WAV
  const x4 = join(out, `${name}.x4.mp3`);
  const enc4 = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-stream_loop', '3', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '256k', '-map_metadata', '-1', '-fflags', '+bitexact', x4]);
  if (enc4.status !== 0) console.warn(`x4 mp3 encode failed for ${name}: ${enc4.stderr}`);
  // parameter automation, sampled at 100 Hz, so every lane that shaped the sound is inspectable
  if (mod.automation) {
    const lanes = mod.automation(), rate = 100, frames = Math.round(meta.seconds * rate), dump = { rate, seconds: meta.seconds, lanes: {} };
    for (const [laneName, f] of Object.entries(lanes)) if (typeof f === 'function') dump.lanes[laneName] = Array.from({ length: frames }, (_, k) => +Number(f(k / rate)).toPrecision(5));
    mkdirSync(join(out, 'automation'), { recursive: true });
    writeFileSync(join(out, 'automation', `${name}.json`), JSON.stringify(dump) + '\n');
  }
  if (wantStems && mod.render.length >= 0) {
    const stems = mod.render({ stems: true });
    // analysis stems: scaled down only if a folded stem would exceed full scale (gain is reported)
    const stemGains = {};
    for (const [stemName, x] of Object.entries(stems)) {
      const bus = x instanceof Float64Array ? { L: x, R: x } : x && x.L instanceof Float64Array ? x : null;
      if (!bus) continue;
      const p = peakOf(bus), g = p > 0.99 ? 0.99 / p : 1;
      stemGains[stemName] = +g.toFixed(4);
      writeWav(join(out, 'stems', `${name}.${stemName}.wav`), g === 1 ? bus : { L: bus.L.map(v => v * g), R: bus.R.map(v => v * g) }, 24);
    }
    writeFileSync(join(out, 'stems', `${name}.gains.json`), JSON.stringify(stemGains) + '\n');
  }
  writeFileSync(join(out, `${name}.meta.json`), JSON.stringify({ ...meta, peak: peakOf(bus), wav24Sha256: sha(readFileSync(wav)), node: process.version }, null, 2) + '\n');
  console.log(`${name}: ${seconds.toFixed(1)} s; ${JSON.stringify(meta)}`);
}
