// Build CABLE//BEAST versions: 24-bit WAV master, MP3 listening copy, 100 Hz automation, the
// exact event map (sample frames and 60 fps picture frames) and, with --stems, 24-bit FLAC
// stems aligned from frame zero.
// Usage: node experiments/morph-05/build.mjs [v1 v2 v3 ...] [--out DIR] [--stems]
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { writeWav, peakOf } from '../morph-03/dsp.mjs';
import { render, FRAMES, SECONDS } from './record.mjs';
// DaemonV12's own timing functions: every on-grid event frame is checked against the engine
import { ticksToFrames, usPerQuarter } from '../../dist/src/timing/musical-time.js';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, name === '--out' ? 2 : 1); return v ?? true; };
const outArg = flag('--out'), wantStems = flag('--stems');
const root = resolve(outArg && outArg !== true ? outArg : join(here, 'audio'));
const versions = args.length ? args : ['v1', 'v2', 'v3'];
const sha = b => createHash('sha256').update(b).digest('hex');
const ffmpeg = (...a) => { const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...a]); if (r.status !== 0) throw new Error(`ffmpeg ${a.join(' ')}: ${r.stderr}`); };

for (const v of versions) {
  const { score } = await import(`./${v}.mjs`);
  const started = process.hrtime.bigint();
  const res = render(score, { stems: !!wantStems });
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  if (res.bus.L.length !== FRAMES) throw new Error(`${v}: ${res.bus.L.length} frames, expected ${FRAMES}`);
  const dir = join(root, v), name = `cable-beast-${v}`;
  mkdirSync(dir, { recursive: true });
  const wav = join(dir, `${name}.wav`);
  writeWav(wav, res.bus, 24);
  ffmpeg('-i', wav, '-codec:a', 'libmp3lame', '-b:a', '256k', '-map_metadata', '-1', '-fflags', '+bitexact', join(dir, `${name}.mp3`));

  // automation lanes at 100 Hz (2800 frames) over the record
  const rate = 100, frames = SECONDS * rate, lanes = { rate, seconds: SECONDS, lanes: {} };
  for (const [k, f] of Object.entries(res.lanes)) lanes.lanes[k] = Array.from({ length: frames }, (_, i) => +Number(f(i / rate)).toPrecision(5));
  writeFileSync(join(dir, `${name}.automation.json`), JSON.stringify(lanes) + '\n');

  // engine cross-check: 960 PPQ, 240 ticks per 16th; an event is on the grid when its tick is an integer
  const tempo = usPerQuarter(120);
  if (ticksToFrames(14 * 3840, tempo) !== FRAMES) throw new Error('14 bars do not resolve to FRAMES');
  let onGrid = 0, mismatches = 0;
  for (const r of res.rows) {
    const tick = r.step * 240;
    if (Math.abs(tick - Math.round(tick)) > 1e-9) continue;
    r.tick = Math.round(tick); onGrid++;
    if (ticksToFrames(r.tick, tempo) !== r.sampleFrame) mismatches++;
  }
  if (mismatches) throw new Error(`${mismatches} event frames disagree with DaemonV12 ticksToFrames`);
  // the event map: sample frames are authoritative; frame60 = floor(sampleFrame * 60 / 44100)
  writeFileSync(join(dir, `${name}.events.json`), JSON.stringify({
    title: score.name, bpm: 120, meter: '4/4', bars: 14, sampleRate: 44100, frames: FRAMES, fps: 60, pictureFrames: SECONDS * 60,
    rules: { sampleFrame: 'floor(seconds * 44100 + 0.5): nearest frame, ties later (the DaemonV12 tick rule at 120 BPM)', frame60: 'floor(sampleFrame * 60 / 44100): the picture frame on screen when the event sounds', tick: '960 PPQ, only for events on the engine grid' },
    engineCheck: { function: 'dist/src/timing/musical-time.js ticksToFrames', tempoUsPerQuarter: tempo, onGridEvents: onGrid, mismatches, offGridEvents: res.rows.length - onGrid },
    events: res.rows,
  }, null, 1) + '\n');
  writeFileSync(join(dir, `${name}.events.md`), eventsMarkdown(score, res.rows));

  if (wantStems) {
    const sdir = join(dir, 'stems');
    rmSync(sdir, { recursive: true, force: true }); mkdirSync(sdir, { recursive: true });
    const all = { ...res.stems, premaster: res.premaster };
    let peak = 0;
    for (const b of Object.values(all)) peak = Math.max(peak, peakOf(b));
    const g = peak > 0.99 ? 0.99 / peak : 1, files = {};
    for (const [k, b] of Object.entries(all)) {
      if (b.L.length !== FRAMES) throw new Error(`stem ${k} has ${b.L.length} frames`);
      const tmp = join(sdir, `${k}.wav`), flac = join(sdir, `${k}.flac`);
      writeWav(tmp, g === 1 ? b : { L: b.L.map(x => x * g), R: b.R.map(x => x * g) }, 24);
      ffmpeg('-i', tmp, '-codec:a', 'flac', '-sample_fmt', 's32', '-bits_per_raw_sample', '24', '-map_metadata', '-1', '-fflags', '+bitexact', flac);
      rmSync(tmp);
      files[k] = { file: `${k}.flac`, sha256: sha(readFileSync(flac)) };
    }
    writeFileSync(join(sdir, 'stems.json'), JSON.stringify({
      note: 'Aligned from frame 0, each exactly 1,234,800 frames. Stems are pre-master and sum to "premaster" (before bus EQ, glue compression and mastering); all share one gain.',
      frames: FRAMES, sharedGainDb: +(20 * Math.log10(g)).toFixed(3), masterGainDb: +(res.meta.preMasterLufs !== undefined ? -14 - res.meta.preMasterLufs - 20 * Math.log10(g) : 0).toFixed(3), files,
    }, null, 2) + '\n');
  }
  const meta = { version: v, title: score.name, ...res.meta, renderSeconds: +seconds.toFixed(1), wav24Sha256: sha(readFileSync(wav)), node: process.version };
  writeFileSync(join(dir, `${name}.meta.json`), JSON.stringify(meta, null, 2) + '\n');
  console.log(`${v}: ${seconds.toFixed(1)} s, ${res.bus.L.length} frames, limiter ${res.meta.limiterMaxDb.toFixed(2)} dB, soft clip ${res.meta.softClipMaxReductionDb} dB, events ${onGrid} on grid (0 engine mismatches), ${res.rows.length - onGrid} off grid`);
}

function eventsMarkdown(score, rows) {
  const lines = [
    `# ${score.name}: event map`, '',
    '120 BPM, 4/4, 14 bars, 28 s = 1,234,800 frames at 44.1 kHz = 1,680 frames at 60 fps. Positions are bar.beat.16th;',
    '`sample` is the authoritative audio frame, `f60` the picture frame on screen when the event sounds.', '',
    '| Time (s) | Position | Sample | f60 | Part | Event | Pitch | Velocity | Detail |',
    '|---:|---|---:|---:|---|---|---|---:|---|',
    ...rows.filter(r => r.event !== 'repeat' && r.event !== 'wind strike' && r.event !== 'cable tick').map(r =>
      `| ${(r.sampleFrame / 44100).toFixed(4)} | ${r.position} | ${r.sampleFrame} | ${r.frame60} | ${r.part} | ${r.event} | ${r.pitch ?? ''} | ${r.velocity ?? ''} | ${r.detail ?? ''} |`),
    '', 'Ratchet repeats, wind strikes and cable ticks are listed in the JSON event map.',
  ];
  return lines.join('\n') + '\n';
}
