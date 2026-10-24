/** Render the MORPH//08 MOTOR GROOVE candidates with aligned stems and Sync Pack event maps.
 *   node experiments/morph-08/render.ts [out-dir] [--no-mp3]
 * WAV, stems, maps and schedules need only Node: the motor is MORPH//07's instrument and
 * score, unchanged, and every other part is rendered by the engine's own sampler. MP3 and
 * the independent loudness check use the engine's FFmpeg processor, as in MORPH//07.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildEventMap, serializeEventMap, type JsonValue, type ScheduledEvent } from '../../src/sync/index.ts';
import { scheduledEventsFromTimeline } from '../../src/sync-timeline.ts';
import { compileProjectFile, runCommand } from '../../src/pipeline.ts';
import { decodePcm } from '../../src/render/index.ts';
import { createAudioProcessor } from '../../src/render/ffmpeg.ts';
import { encodeWav, perform, RATE } from '../morph-07/motor.ts';
import { hypnoticMotor } from '../morph-07/scores.ts';
import { arrangements, engineProject, motorGrid, motorStems, type Arrangement } from './arrangements.ts';
import { integratedLoudness, master, MASTER, truePeak } from './mix.ts';

const here = fileURLToPath(new URL('.', import.meta.url)), root = join(here, '../..');
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
export const generator = Object.fromEntries(['morph-07/motor.ts', 'morph-07/scores.ts', 'morph-08/arrangements.ts', 'morph-08/mix.ts', 'morph-08/render.ts']
  .map(file => [`experiments/${file}`, sha(readFileSync(join(root, 'experiments', file)))]));
export const FPS = { numerator: 60, denominator: 1 };
const db = (x: number) => Number((20 * Math.log10(x)).toFixed(2));
type Stereo = [Float64Array, Float64Array];

/** The HYPNOTIC MOTOR exactly as MORPH//07 renders it, with its ring-out wrapped onto the
 * start (as `master` does for the loop) and kept as five pre-master stems. */
export function renderMotor() {
  const score = hypnoticMotor(), performance = perform(score, { stems: true }), n = score.frames;
  const wrap = (x: Float64Array) => { const y = x.slice(0, n); for (let i = n; i < x.length; i++) y[(i - n) % n]! += x[i]!; return y; };
  const stems = Object.fromEntries(motorStems.map(name => [name, performance.stems![name].map(wrap) as Stereo])) as Record<typeof motorStems[number], Stereo>;
  return { score, frames: n, stems, events: performance.events, grid: motorGrid(performance.events) };
}
export type Motor = ReturnType<typeof renderMotor>;

/** Render the arrangement's engine project from a private staging copy of its assets. */
async function renderEngine(a: Arrangement, projectText: string) {
  const stage = mkdtempSync(join(tmpdir(), 'morph08-'));
  try {
    const project = join(stage, `${a.id}.json`);
    writeFileSync(project, projectText);
    for (const file of new Set(a.parts.map(p => p.sound.file))) {
      mkdirSync(dirname(join(stage, 'assets', file)), { recursive: true });
      copyFileSync(join(root, 'examples/assets', file), join(stage, 'assets', file));
    }
    const compilation = compileProjectFile(project);
    if (!compilation.timeline) throw new Error(`${a.id}: ${JSON.stringify(compilation.diagnostics)}`);
    const rendered = await runCommand('render', project, { outDir: join(stage, 'render'), stems: true, env: {} });
    if (rendered.exitCode !== 0) throw new Error(`${a.id}: ${JSON.stringify(rendered.result.errors)}`);
    const manifest = rendered.result.manifest as { mix: { clippedSamples: number }; samples: { tracks: { trackId: string; clippedSamples: number; triggers: { frame: number }[] }[]; assets: JsonValue[] };
      stems: { trackId: string; wav: { file: string } }[] };
    for (const t of manifest.samples.tracks) if (t.clippedSamples) throw new Error(`${a.id}/${t.trackId} clips inside the engine.`);
    const stems = Object.fromEntries(manifest.stems.map(s => [s.trackId, decodePcm(readFileSync(join(stage, 'render', s.wav.file))).pcm!]));
    const triggers = Object.fromEntries(manifest.samples.tracks.map(t => [t.trackId, t.triggers.map(x => x.frame)]));
    return { timeline: compilation.timeline, stems, triggers, assets: manifest.samples.assets };
  } finally { rmSync(stage, { recursive: true, force: true }); }
}

/** Kick-keyed gain: a 2 ms dip of `depthDb` that recovers along a squared ramp, wrapped
 * around the loop so the last kick's recovery continues into the first bar. */
function duckEnvelope(kicks: number[], frames: number, depthDb: number, releaseMs: number): Float64Array {
  const reduction = new Float64Array(frames), attack = Math.round(0.002 * RATE), release = Math.round(releaseMs * RATE / 1000);
  for (const k of kicks) for (let i = -attack; i < release; i++) {
    const x = i < 0 ? (i + attack) / attack : (1 - i / release) ** 2, j = ((k + i) % frames + frames) % frames;
    reduction[j] = Math.max(reduction[j]!, depthDb * x);
  }
  return reduction.map(r => 10 ** (-r / 20));
}

export async function renderCandidate(a: Arrangement, motor: Motor) {
  const n = motor.frames, projectText = JSON.stringify(engineProject(a, motor.grid.frames), null, 2) + '\n';
  const engine = await renderEngine(a, projectText);
  const duck = duckEnvelope(engine.triggers.kick ?? [], n, a.duck.depthDb, a.duck.releaseMs);
  const stems: Record<string, Stereo> = {};
  const add = (stem: string, l: Float64Array, r: Float64Array, gainDb: number, pan = 0, ducked = false) => {
    const target = stems[stem] ??= [new Float64Array(n), new Float64Array(n)];
    // DaemonV12's stereo balance (V0.3): pan only attenuates the opposite channel.
    const g = 10 ** (gainDb / 20), gl = g * (1 - Math.max(0, pan)), gr = g * (1 + Math.min(0, pan));
    for (let i = 0; i < n; i++) { const d = ducked ? duck[i]! : 1; target[0][i]! += gl * d * l[i]!; target[1][i]! += gr * d * r[i]!; }
  };
  // Motor bus: rebalance its stems, then MORPH//07's own master curve tanh(d·x/peak)/tanh(d).
  const bus: Stereo = [new Float64Array(n), new Float64Array(n)];
  for (const name of motorStems) {
    const g = 10 ** (a.motor.balance[name] / 20);
    for (const c of [0, 1]) for (let i = 0; i < n; i++) bus[c]![i]! += g * motor.stems[name][c]![i]!;
  }
  const d = motor.score.motor.drive, peak = Math.max(...bus.map(ch => ch.reduce((m, x) => Math.max(m, Math.abs(x)), 0)));
  add('motor', ...bus.map(ch => ch.map(x => Math.tanh(d * x / peak) / Math.tanh(d))) as Stereo, a.motor.level, 0, a.motor.duck);
  for (const part of a.parts) {
    const pcm = engine.stems[part.id]!, l = new Float64Array(n), r = new Float64Array(n);
    // Wrap sample tails past the loop end back onto the start.
    for (let i = 0; i < pcm.frames; i++) { l[i % n]! += pcm.samples[2 * i]! / 32768; r[i % n]! += pcm.samples[2 * i + 1]! / 32768; }
    add(part.stem, l, r, part.gainDb, part.pan, part.duck);
  }
  const mastered = master(stems, n);
  const wav = encodeWav(mastered.left, mastered.right);
  const stemWavs = Object.fromEntries(Object.entries(mastered.stems).map(([name, [l, r]]) => [name, encodeWav(l, r)]));

  // Sync Pack: the motor's own map events plus every sampler note, at authoritative frames.
  const projectSha = sha(projectText);
  const partRoles = Object.fromEntries(a.parts.map(p => [p.id, p.roles]));
  const arranged = scheduledEventsFromTimeline(engine.timeline, { arrangement: a.id, project: `${a.id}.project.json`, projectSha256: projectSha, adapter: 'daemonv12-resolved-timeline-v1' }, RATE, partRoles)
    .map(e => {
      const slot = a.parts.find(p => p.id === e.trackId)!.hits[Number(e.eventId)]!;
      const roles = [...e.visualRoles!, ...(e.velocity >= 0.85 ? ['accent'] : []), ...(motor.grid.locked[slot.slot] ? ['motor-locked'] : [])];
      return { ...e, visualRoles: roles, source: { ...e.source, slot: slot.slot, ...(slot.note ? { note: slot.note } : {}) } } as ScheduledEvent;
    });
  const events = [...motor.events, ...arranged];
  const source = { experiment: 'MORPH//08 MOTOR GROOVE', arrangement: a.id, title: a.title, generator, motor: 'MORPH//07 hypnotic-motor (unchanged)',
    wav: { file: `${a.id}.wav`, sha256: sha(wav) }, timing: 'motor events at simulation frames; sampler notes at their engine trigger frames (960 PPQ, locked to the motor contacts)' };
  const options = { sampleRate: RATE, fps: FPS, source, clip: { startSampleFrame: 0, endSampleFrame: n } };
  const map = buildEventMap(events, options), serialized = serializeEventMap(map);
  const schedule = JSON.stringify({ ...options, events }) + '\n';

  const counts: Record<string, number> = {};
  for (const e of map.events) counts[e.trackId] = (counts[e.trackId] ?? 0) + 1;
  const loudness = integratedLoudness(mastered.left, mastered.right);
  const report: Record<string, JsonValue> = {
    title: a.title, frames: n, seconds: n / RATE, bpm: 120, key: 'A minor', loop: true,
    wav: { file: `${a.id}.wav`, sha256: sha(wav), bytes: wav.length, channels: 2, bitsPerSample: 16, clippedSamples: mastered.clipped,
      peakDbfs: db(mastered.peak), truePeakDbtp: db(truePeak(mastered.left, mastered.right)), integratedLufs: Number(loudness.toFixed(2)) },
    master: { ...MASTER, preGainDb: db(mastered.gain), maxReductionDb: Number(mastered.maxReductionDb.toFixed(2)), samplesInKneePercent: Number(mastered.kneePercent.toFixed(3)) },
    stems: Object.fromEntries(Object.entries(stemWavs).map(([name, bytes]) => [name, { file: `${a.id}.stems/${name}.wav`, sha256: sha(bytes), clippedSamples: mastered.stemClipped[name]! }])),
    project: { file: `${a.id}.project.json`, sha256: projectSha, assets: engine.assets },
    eventMap: { file: `${a.id}.events.json`, sha256: sha(serialized), events: map.events.length, tracks: counts },
    mix: { motor: a.motor as unknown as JsonValue, duck: a.duck as unknown as JsonValue, parts: a.parts.map(p => ({ id: p.id, stem: p.stem, gainDb: p.gainDb, pan: p.pan ?? 0, sound: p.sound.file })) },
  };
  // The engine's own trigger frames and natural stem lengths, so tests can tie the map to the audio.
  const engineFrames = Object.fromEntries(Object.entries(engine.stems).map(([id, pcm]) => [id, pcm.frames]));
  return { wav, stemWavs, events: serialized, schedule, projectText, report, map, mastered, triggers: engine.triggers, engineFrames };
}

export async function renderAll(destination: string, mp3 = true) {
  mkdirSync(destination, { recursive: true });
  const processor = mp3 ? await createAudioProcessor({ env: process.env }) : undefined;
  if (processor?.diagnostic) throw new Error(`MP3 needs FFmpeg with libmp3lame: ${processor.diagnostic.message}`);
  const motor = renderMotor(), candidates: Record<string, JsonValue> = {};
  for (const a of arrangements) {
    const out = await renderCandidate(a, motor), wavPath = join(destination, `${a.id}.wav`);
    writeFileSync(wavPath, out.wav);
    mkdirSync(join(destination, `${a.id}.stems`), { recursive: true });
    for (const [name, bytes] of Object.entries(out.stemWavs)) writeFileSync(join(destination, `${a.id}.stems`, `${name}.wav`), bytes);
    writeFileSync(join(destination, `${a.id}.events.json`), out.events);
    writeFileSync(join(destination, `${a.id}.schedule.json`), out.schedule);
    writeFileSync(join(destination, `${a.id}.project.json`), out.projectText);
    if (processor?.value) {
      const mp3Path = join(destination, `${a.id}.mp3`), encoded = await processor.value.mp3(wavPath, mp3Path);
      if (encoded.diagnostic) throw new Error(encoded.diagnostic.message);
      const [wavLoudness, mp3Loudness] = [await processor.value.loudness(wavPath), await processor.value.loudness(mp3Path)];
      out.report.mp3 = { file: `${a.id}.mp3`, sha256: sha(readFileSync(mp3Path)), codec: encoded.value.codec, bitrateKbps: encoded.value.bitrateKbps,
        sampleRate: RATE, channels: 2, encoder: processor.value.identity.version, note: 'Bytes depend on the FFmpeg/LAME build; the WAV is the reference.' };
      out.report.ffmpegLoudness = { wav: wavLoudness.value ?? null, mp3: mp3Loudness.value ?? null, measuredBy: 'ffmpeg loudnorm (input measurements)' } as JsonValue;
    }
    candidates[a.id] = out.report;
  }
  const report = { experiment: 'MORPH//08 MOTOR GROOVE', generator, sampleRate: RATE, fps: FPS, targetLufs: MASTER.targetLufs, candidates };
  writeFileSync(join(destination, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), destination = resolve(args.find(a => !a.startsWith('--')) ?? join(root, 'work/morph-08'));
  const report = await renderAll(destination, !args.includes('--no-mp3'));
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
