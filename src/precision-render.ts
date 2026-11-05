// Independent opt-in sampler production workflow. Existing CLI/MCP and project defaults do not enter here.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { compileProjectFile, stemFileName } from './pipeline.ts';
import { sampleTriggers, playbackBudget } from './sample-render.ts';
import { outputInAssets } from './project/assets.ts';
import { automatedGainPan, gainPan, fitFloat } from './render/production.ts';
import { sumFloatPrecise, quantize24, fitPcm24, analyzePcm24 } from './render/precision.ts';
import { createAudioProcessor, type AudioProcessor } from './render/ffmpeg.ts';
import { applyDucking } from './render/dynamics.ts';
import { MAX_PCM_FRAMES } from './render/pcm.ts';
import { renderPlan, automationFrames } from './timing/render-plan.ts';
import { ENGINE_VERSION } from './version.ts';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const identity = (file: string, bytes: Buffer) => ({ file, sha256: hash(bytes), bytes: bytes.length });

export async function renderProduction24(projectPath: string, outputDirectory: string,
  options: { env?: NodeJS.ProcessEnv; processor?: AudioProcessor } = {}) {
  const compilation = compileProjectFile(projectPath);
  const errors = compilation.diagnostics.filter(d => d.severity === 'error');
  if (errors.length || !compilation.project || !compilation.timeline) throw new Error(`Invalid project: ${JSON.stringify(errors)}`);
  const project = compilation.project, timeline = compilation.timeline;
  if (timeline.tracks.some(t => t.instrument.type === 'gm')) throw new Error('Production24 currently supports sampler/drumkit tracks only. GM output remains PCM16; use the existing render path.');
  const budget = playbackBudget(compilation, true);
  if (budget) throw new Error(`Sample-performance budget: ${JSON.stringify(budget)}`);
  const out = resolve(outputDirectory);
  if (existsSync(out)) throw new Error('Choose a new output directory; Production24 never replaces an existing render.');
  if (outputInAssets(projectPath, out)) throw new Error('Output cannot be inside source assets.');
  const created = options.processor ? { value: options.processor } : await createAudioProcessor({ env: options.env ?? process.env });
  if (!created.value) throw new Error(`FFmpeg unavailable: ${JSON.stringify(created.diagnostic)}`);
  const processor = created.value, plan = renderPlan(project), cap = plan.audioEndFrames ?? Infinity;
  if (plan.minimumFrames < 1 || plan.minimumFrames > MAX_PCM_FRAMES || (Number.isFinite(cap) && cap > MAX_PCM_FRAMES)) throw new RangeError('Production24 supports at most 600 seconds including tails.');
  mkdirSync(dirname(out), { recursive: true });
  const temporary = mkdtempSync(join(dirname(out), '.production24-'));
  try {
    let master: Float64Array = new Float64Array(plan.minimumFrames * 2);
    const tracks: { trackId: string; file: string; clippedSamples: number; preClipPeakDbfs: number | null; automation: object; effects: unknown }[] = [];
    for (const track of timeline.tracks) {
      const authored = project.tracks[track.index]!;
      const automation = { gainDb: automationFrames(authored.automation?.gainDb, project), pan: automationFrames(authored.automation?.pan, project) };
      const source = sumFloatPrecise(sampleTriggers(compilation, track, cap), plan.minimumFrames, cap);
      const processed = await processor.effects(automatedGainPan(source, authored.mix?.gainDb, authored.mix?.pan, automation), authored.effects ?? [], Number.isFinite(cap) ? cap : undefined);
      if (processed.diagnostic) throw new Error(`Track ${track.id}: ${JSON.stringify(processed.diagnostic)}`);
      const samples = processed.value.length / 2 > cap ? fitFloat(processed.value, cap) : processed.value;
      // The master receives the original float samples, before PCM24 stem quantization.
      if (samples.length > master.length) master = fitFloat(master, samples.length / 2);
      for (let i = 0; i < samples.length; i++) master[i]! += samples[i]!;
      const encoded = quantize24(samples), file = stemFileName(track.id);
      writeFileSync(join(temporary, file), encoded.bytes);
      tracks.push({ trackId: track.id, file, clippedSamples: encoded.clippedSamples, preClipPeakDbfs: encoded.preClipPeakDbfs, automation, effects: authored.effects ?? [] });
    }
    const processedMaster = await processor.effects(gainPan(master, project.master?.gainDb), project.master?.effects ?? [], Number.isFinite(cap) ? cap : undefined);
    if (processedMaster.diagnostic) throw new Error(`Master: ${JSON.stringify(processedMaster.diagnostic)}`);
    let final = processedMaster.value.length / 2 > cap ? fitFloat(processedMaster.value, cap) : processedMaster.value;
    if (plan.outputFrames !== null) final = fitFloat(final, plan.outputFrames);
    let ducking;
    if (project.master?.ducking) {
      const result = applyDucking(final, compilation.sidechain!.pcm, project.master.ducking);
      final = result.samples; ducking = result.metrics;
    }
    const encoded = quantize24(final), name = basename(projectPath).replace(/\.json$/i, ''), masterFile = `${name}.24.wav`;
    writeFileSync(join(temporary, masterFile), encoded.bytes);
    const loudness = await processor.loudness(join(temporary, masterFile));
    if (loudness.diagnostic) throw new Error(`Master analysis: ${JSON.stringify(loudness.diagnostic)}`);
    const stems = tracks.map(track => {
      const bytes = fitPcm24(readFileSync(join(temporary, track.file)), encoded.frames);
      writeFileSync(join(temporary, track.file), bytes);
      return { ...track, ...identity(track.file, bytes), analysis: analyzePcm24(bytes) };
    });
    const manifest = {
      kind: 'daemonv12-production24', version: 1, engine: { name: 'daemonv12', version: ENGINE_VERSION },
      project: { file: basename(projectPath), sha256: hash(compilation.projectBytes!) },
      runtime: { node: process.version, processor: processor.identity },
      signalPath: 'PCM16 source; unrounded Float64 interpolation/velocity/envelope, gain/pan automation and ordered track effects; Float64 sum, master gain/effects/ducking; single PCM24 quantization per export',
      sourcePrecision: 'Sources are PCM16. No lost source detail is recovered. Newly computed fractional processing detail is retained.',
      stems: stems.map(stem => ({ ...stem, precision: 'post-track, pre-master; each stem quantized independently to PCM24; master sums floats before this quantization' })),
      sources: [...compilation.assets!].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([file, asset]) => ({ ...identity(file, asset.bytes), bitsPerSample: asset.pcm ? 16 : null })),
      limits: { maximumSeconds: 600, interpolationTaps: 1_000_000_000, performedVoiceBytes: 134217728, tracks: 15 },
      export: { sampleRate: 44100, channels: 2, bitsPerSample: 24, dither: false, normalization: false },
      master: { ...identity(masterFile, encoded.bytes), frames: encoded.frames, clippedSamples: encoded.clippedSamples, preClipPeakDbfs: encoded.preClipPeakDbfs,
        analysis: { ...analyzePcm24(encoded.bytes), ...loudness.value }, ...(ducking ? { ducking } : {}) },
      warnings: [
        ...(encoded.clippedSamples ? ['Master overloaded before PCM24 export; reduce authored gain.'] : []),
        ...(tracks.some(t => t.clippedSamples) ? ['One or more exported stems overloaded; master float summation remains unclipped until its own export. Reduce authored track gains for usable stems.'] : []),
        'Metrics do not certify musical quality or mono translation. Human listening remains pending.',
      ],
    };
    writeFileSync(join(temporary, `${name}.24.render.json`), JSON.stringify(manifest, null, 2) + '\n');
    renameSync(temporary, out);
    return { directory: out, wav: join(out, masterFile), manifest };
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
}
