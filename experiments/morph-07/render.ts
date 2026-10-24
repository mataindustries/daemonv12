/** Render both MORPH//07 candidates with their Sync Pack event maps.
 *   node experiments/morph-07/render.ts [out-dir] [--no-mp3]
 * WAV, event maps and telemetry need only Node. MP3 and loudness use the engine's
 * FFmpeg processor (libmp3lame 192 kb/s, 44.1 kHz stereo), the same path as `render --format mp3`.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildEventMap, serializeEventMap, type JsonValue } from '../../src/sync/index.ts';
import { createAudioProcessor } from '../../src/render/ffmpeg.ts';
import { encodeWav, master, perform, PICTURE_STRIDE, RATE, type Score } from './motor.ts';
import { scores } from './scores.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
export const generator = Object.fromEntries(['motor.ts', 'scores.ts', 'render.ts']
  .map(file => [`experiments/morph-07/${file}`, sha(readFileSync(join(here, file)))]));
export const FPS = { numerator: 60, denominator: 1 };

/** Everything except MP3/loudness: deterministic bytes from Node alone. */
export function renderCandidate(score: Score) {
  const performance = perform(score), mixed = master(performance, score);
  const wav = encodeWav(mixed.left, mixed.right);
  let clipped = 0, peak = 0, energy = 0, low = 0, lp = 0;
  for (let i = 0; i < mixed.left.length; i++) for (const x of [mixed.left[i]!, mixed.right[i]!]) {
    const s = Math.round(x * 32767); if (Math.abs(s) >= 32767) clipped++;
    peak = Math.max(peak, Math.abs(x)); energy += x * x; lp += 0.0142 * (x - lp); low += lp * lp; // ~100 Hz one-pole
  }
  const source = { experiment: 'MORPH//07 HARMONIC MOTOR', score: score.id, title: score.title, generator,
    wav: { file: `${score.id}.wav`, sha256: sha(wav) }, timing: 'sample frames from the rotor simulation and the 960 PPQ score clock' };
  const options = { sampleRate: RATE, fps: FPS, source, clip: { startSampleFrame: 0, endSampleFrame: score.frames } };
  const map = buildEventMap(performance.events, options);
  const events = serializeEventMap(map);
  // The same scheduled events as Sync CLI input: `daemonv12 sync <id>.schedule.json --out <map>`.
  const schedule = JSON.stringify({ ...options, events: performance.events }) + '\n';
  const t = performance.telemetry;
  const telemetry = JSON.stringify({ formatVersion: 1, kind: 'morph07-rotor-telemetry', note: 'Derived per 60 fps picture frame; the event map is authoritative.',
    sampleRate: RATE, fps: FPS, samplesPerPictureFrame: PICTURE_STRIDE, eventMapSha256: sha(events), gears: score.gears.map(g => g.name),
    columns: Object.fromEntries((['pictureFrame', 'sampleFrame', 'angle', 'speed', 'torque', 'load', 'gear', 'chassis', 'regime'] as const)
      .map(key => [key, t.map(row => row[key])])) }) + '\n';
  const counts: Record<string, number> = {};
  for (const e of map.events) counts[e.trackId] = (counts[e.trackId] ?? 0) + 1;
  const report: Record<string, JsonValue> = { title: score.title, frames: score.frames, seconds: score.frames / RATE, bpm: score.bpm, meter: score.meter, loop: score.loop,
    wav: { file: `${score.id}.wav`, sha256: sha(wav), bytes: wav.length, channels: 2, bitsPerSample: 16, clippedSamples: clipped,
      peakDbfs: Number((20 * Math.log10(peak)).toFixed(2)), rmsDbfs: Number((10 * Math.log10(energy / (2 * score.frames))).toFixed(2)),
      below100HzShare: Number((low / energy).toFixed(3)) },
    eventMap: { file: `${score.id}.events.json`, sha256: sha(events), events: map.events.length, tracks: counts },
    telemetry: { file: `${score.id}.telemetry.json`, sha256: sha(telemetry), pictureFrames: t.length }, synthesis: performance.stats };
  return { wav, events, telemetry, schedule, report, map };
}

export async function renderAll(destination: string, mp3 = true) {
  mkdirSync(destination, { recursive: true });
  const processor = mp3 ? await createAudioProcessor({ env: process.env }) : undefined;
  if (processor?.diagnostic) throw new Error(`MP3 needs FFmpeg with libmp3lame: ${processor.diagnostic.message}`);
  const candidates: Record<string, JsonValue> = {};
  for (const make of scores) {
    const score = make(), out = renderCandidate(score), wavPath = join(destination, `${score.id}.wav`);
    writeFileSync(wavPath, out.wav);
    writeFileSync(join(destination, `${score.id}.events.json`), out.events);
    writeFileSync(join(destination, `${score.id}.telemetry.json`), out.telemetry);
    writeFileSync(join(destination, `${score.id}.schedule.json`), out.schedule);
    if (processor?.value) {
      const mp3Path = join(destination, `${score.id}.mp3`), encoded = await processor.value.mp3(wavPath, mp3Path);
      if (encoded.diagnostic) throw new Error(encoded.diagnostic.message);
      const loudness = await processor.value.loudness(wavPath);
      out.report.mp3 = { file: `${score.id}.mp3`, sha256: sha(readFileSync(mp3Path)), codec: encoded.value.codec, bitrateKbps: encoded.value.bitrateKbps,
        sampleRate: RATE, channels: 2, encoder: processor.value.identity.version, note: 'Bytes depend on the FFmpeg/LAME build; the WAV is the reference.' };
      if (loudness.value) out.report.loudness = { ...loudness.value, measuredBy: 'ffmpeg loudnorm (input measurements)' };
    }
    candidates[score.id] = out.report;
  }
  const report = { experiment: 'MORPH//07 HARMONIC MOTOR', generator, sampleRate: RATE, fps: FPS, candidates };
  writeFileSync(join(destination, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), destination = resolve(args.find(a => !a.startsWith('--')) ?? join(here, '../../work/morph-07'));
  const report = await renderAll(destination, !args.includes('--no-mp3'));
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
