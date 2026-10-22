// Render the MORPH//04 drum experiments: 24-bit WAV masters, MP3 listening copies (single and
// x4), automation lanes, an exact event map, and (with --stems) 24-bit FLAC stems.
// Usage: node experiments/morph-04/build.mjs [a|b ...] [--out DIR] [--stems]
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { writeWav, peakOf } from '../morph-03/dsp.mjs';
import { eventMapMarkdown } from './events.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const ARRANGEMENTS = {
  a: ['morph04-a-heavy', './a-heavy.mjs'],
  b: ['morph04-b-breaks', './b-breaks.mjs'],
};
const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, name === '--out' ? 2 : 1); return v ?? true; };
const outArg = flag('--out'), wantStems = flag('--stems');
const out = resolve(outArg && outArg !== true ? outArg : join(here, 'audio'));
const pick = args.length ? args : Object.keys(ARRANGEMENTS);
const sha = b => createHash('sha256').update(b).digest('hex');
const ffmpeg = (...a) => { const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...a]); if (r.status !== 0) console.warn(`ffmpeg ${a.join(' ')}: ${r.stderr}`); };
const mp3 = (src, dst, loops = 0) => ffmpeg(...(loops ? ['-stream_loop', String(loops)] : []), '-i', src, '-codec:a', 'libmp3lame', '-b:a', '256k', '-map_metadata', '-1', '-fflags', '+bitexact', dst);
mkdirSync(out, { recursive: true });

for (const key of pick) {
  const [name, module] = ARRANGEMENTS[key];
  const started = process.hrtime.bigint();
  const mod = await import(module);
  const { bus, meta } = mod.render();
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  const wav = join(out, `${name}.wav`);
  writeWav(wav, bus, 24);
  mp3(wav, join(out, `${name}.mp3`));
  // the WAV loops seamlessly; MP3 padding would leave a gap at a player's loop point, so the x4
  // copy repeats the seamless WAV four times before encoding
  mp3(wav, join(out, `${name}.x4.mp3`), 3);

  // automation: every function lane, sampled at 100 Hz over the loop
  const lanes = mod.automation(), rate = 100, frames = Math.round(meta.seconds * rate), dump = { rate, seconds: meta.seconds, lanes: {} };
  for (const [laneName, f] of Object.entries(lanes)) if (typeof f === 'function') dump.lanes[laneName] = Array.from({ length: frames }, (_, k) => +Number(f(k / rate)).toPrecision(5));
  mkdirSync(join(out, 'automation'), { recursive: true });
  writeFileSync(join(out, 'automation', `${name}.json`), JSON.stringify(dump) + '\n');

  // the exact event map (every scheduled event, from the same data the render uses)
  const events = mod.eventMap();
  mkdirSync(join(out, 'events'), { recursive: true });
  writeFileSync(join(out, 'events', `${name}.json`), JSON.stringify(events, null, 1) + '\n');
  writeFileSync(join(out, 'events', `${name}.md`), eventMapMarkdown(name, events, mod.SUMMARY));

  if (wantStems) {
    // stems are pre-master (before bus EQ, glue compression and mastering) and sum to the dry
    // mix; masterGainDb restores the master's level
    const { stems, premaster } = mod.render({ stems: true });
    const dir = join(out, 'stems', name);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const all = { ...stems, premaster };
    let maxPeak = 0;
    for (const b of Object.values(all)) maxPeak = Math.max(maxPeak, peakOf(b));
    const g = maxPeak > 0.99 ? 0.99 / maxPeak : 1; // one shared gain keeps the stems summable
    const files = {};
    for (const [stemName, b] of Object.entries(all)) {
      const tmp = join(dir, `${stemName}.wav`), flac = join(dir, `${stemName}.flac`);
      writeWav(tmp, g === 1 ? b : { L: b.L.map(v => v * g), R: b.R.map(v => v * g) }, 24);
      ffmpeg('-i', tmp, '-codec:a', 'flac', '-sample_fmt', 's32', '-bits_per_raw_sample', '24', '-map_metadata', '-1', '-fflags', '+bitexact', flac);
      rmSync(tmp);
      files[stemName] = `${stemName}.flac`;
    }
    writeFileSync(join(dir, 'stems.json'), JSON.stringify({
      note: 'Stems sum to "premaster" (the dry mix before bus EQ, glue compression and mastering). All files share one gain.',
      sharedGainDb: +(20 * Math.log10(g)).toFixed(3), masterGainDb: +(-14 - meta.preMasterLufs - 20 * Math.log10(g)).toFixed(3), files,
    }, null, 2) + '\n');
  }
  writeFileSync(join(out, `${name}.meta.json`), JSON.stringify({ ...meta, peak: peakOf(bus), wav24Sha256: sha(readFileSync(wav)), node: process.version }, null, 2) + '\n');
  console.log(`${name}: ${seconds.toFixed(1)} s; ${JSON.stringify(meta)}`);
}
