/** Full-song production proof. Run after create-headliner-stress.ts.
 * node scripts/verify-headliner-stress.ts [--existing-first] [--existing-replay] [--deliver]
 * Two independent continuous full renders; no separately reset audio sections are joined.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { compileProjectFile, runCommand } from '../src/pipeline.ts';
import { sampleTriggers } from '../src/sample-render.ts';
import { createAudioProcessor, decodePcm, extractWavFrames, fitFloat, gainPan, quantize, voiceCost, voiceFrames } from '../src/render/index.ts';
import { readWavInfo } from '../src/render/wav.ts';
import { createHeadlinerStress, SECTIONS, STRESS_FRAMES, STRESS_SECONDS } from './create-headliner-stress.ts';

const RATE = 44100, proof = 'proofs/forge003', workspace = 'work/headliner-stress', input = `${workspace}/input/headliner-stress.json`, audio = `${workspace}/audio`, replay = `${workspace}/replay`;
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
async function fileHash(file: string): Promise<string> { const h = createHash('sha256'); for await (const bytes of createReadStream(file)) h.update(bytes); return h.digest('hex'); }
const db = (amplitude: number) => amplitude > 0 ? Number((20 * Math.log10(amplitude)).toFixed(6)) : null;
const rounded = (n: number) => Number(n.toFixed(6));
function shape(bytes: Buffer) { const info = readWavInfo(bytes); assert.ok(info.ok); return info.info; }
/** Single-pass stereo/mono measures. Low band is two cascaded one-pole 150 Hz low-passes. */
export function stereoMetrics(bytes: Buffer) {
  const i = shape(bytes); assert.equal(i.channels, 2); assert.equal(i.bitsPerSample, 16);
  let ll = 0, rr = 0, lr = 0, mm = 0, peak = 0, fullScale = 0, dc = 0;
  let lowLL = 0, lowRR = 0, lowLR = 0, lowMM = 0, l1 = 0, l2 = 0, r1 = 0, r2 = 0;
  const c = 1 - Math.exp(-2 * Math.PI * 150 / RATE);
  for (let f = 0; f < i.frames; f++) {
    const l = bytes.readInt16LE(i.dataOffset + f * 4) / 32768, r = bytes.readInt16LE(i.dataOffset + f * 4 + 2) / 32768;
    ll += l * l; rr += r * r; lr += l * r; mm += ((l + r) / 2) ** 2; dc += l + r; peak = Math.max(peak, Math.abs(l), Math.abs(r));
    if (l === -1 || l === 32767 / 32768) fullScale++; if (r === -1 || r === 32767 / 32768) fullScale++;
    l1 += c * (l - l1); l2 += c * (l1 - l2); r1 += c * (r - r1); r2 += c * (r1 - r2);
    lowLL += l2 * l2; lowRR += r2 * r2; lowLR += l2 * r2; lowMM += ((l2 + r2) / 2) ** 2;
  }
  return { peakDbfs: db(peak), fullScaleSamples: fullScale, rmsDbfs: db(Math.sqrt((ll + rr) / (2 * i.frames))), dc: rounded(dc / (2 * i.frames)),
    correlation: rounded(lr / Math.sqrt(ll * rr)), monoFoldDownDb: db(Math.sqrt(mm / ((ll + rr) / 2))),
    lowBandCorrelation: rounded(lowLR / Math.sqrt(lowLL * lowRR)), lowBandMonoFoldDownDb: db(Math.sqrt(lowMM / ((lowLL + lowRR) / 2))),
    lowBandMethod: 'Two cascaded causal one-pole low-pass filters at 150 Hz, continuous from sample zero; unweighted energy/correlation, no perceptual pass implied.' };
}
function rangePeak(bytes: Buffer, from: number, end: number) { const i = shape(bytes); let peak = 0; for (let f = from; f < end; f++) for (let c = 0; c < 2; c++) peak = Math.max(peak, Math.abs(bytes.readInt16LE(i.dataOffset + f * 4 + c * 2)) / 32768); return db(peak); }
function frameDelta(bytes: Buffer, frame: number) { const i = shape(bytes); return [0, 1].map(c => bytes.readInt16LE(i.dataOffset + frame * 4 + c * 2) - bytes.readInt16LE(i.dataOffset + (frame - 1) * 4 + c * 2)); }

export async function verifyHeadlinerStress(existingFirst = false, deliver = false, existingReplay = false) {
  // Resume completed renders after an interrupted verification without rewriting their inputs.
  if (!existingFirst || !existsSync(input)) createHeadlinerStress();
  const c = compileProjectFile(input, { reuseVoices: true }); assert.deepEqual(c.diagnostics, []);
  const legacy = await runCommand('validate', input); assert.equal(legacy.exitCode, 1);
  assert.equal((legacy.result.errors[0]!.received as { metric: string }).metric, 'interpolationTaps');
  const manifestFile = join(audio, 'headliner-stress.render.json');
  let firstRenderSeconds: number | null = null;
  if (!existingFirst || !existsSync(manifestFile)) {
    const began = performance.now(), first = await runCommand('render', input, { reuseVoices: true, stems: true, format: 'wav,mp3', outDir: audio, env: process.env });
    assert.equal(first.exitCode, 0, JSON.stringify(first.result.errors)); firstRenderSeconds = rounded((performance.now() - began) / 1000);
  }
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  assert.equal(manifest.project.sha256, hash(readFileSync(input)), 'existing render must match generated project bytes');
  const wav = join(audio, 'headliner-stress.wav'), wavHash = await fileHash(wav);
  assert.equal(wavHash, manifest.wav.sha256, 'verify existing artifact against its manifest');
  let replaySeconds: number | null = null;
  if (!existingReplay || !existsSync(join(replay, 'headliner-stress.render.json'))) {
    const began = performance.now(), second = await runCommand('render', input, { reuseVoices: true, stems: true, format: 'wav,mp3', outDir: replay, env: process.env });
    replaySeconds = rounded((performance.now() - began) / 1000);
    assert.equal(second.exitCode, 0, JSON.stringify(second.result.errors));
  }
  const compared: { file: string; sha256: string }[] = [];
  for (const file of ['headliner-stress.wav', 'headliner-stress.mid', 'headliner-stress.render.json', 'headliner-stress.analysis.json', ...manifest.stems.map((s: any) => s.wav.file)]) {
    const a = await fileHash(join(audio, file)), b = await fileHash(join(replay, file));
    assert.equal(a, b, `independent replay: ${file}`); compared.push({ file, sha256: a });
  }
  const bytes = readFileSync(wav), info = shape(bytes); assert.equal(info.frames, STRESS_FRAMES); assert.equal(info.frames / RATE, STRESS_SECONDS);
  const processor = await createAudioProcessor({ env: process.env }); assert.ok(processor.value, JSON.stringify(processor.diagnostic));
  const stereo = stereoMetrics(bytes); assert.equal(stereo.fullScaleSamples, 0); assert.ok(stereo.lowBandCorrelation > 0.9, 'low-end mono correlation');
  assert.equal(manifest.production.master.clippedSamples, 0);
  assert.ok(manifest.production.tracks.every((t: any) => t.clippedSamples === 0), 'no clipping at track quantization');
  assert.ok(manifest.analysis.master.truePeakDbfs < -1, 'at least 1 dB measured true-peak headroom');
  const stems = [];
  // Reconstruct the master from exported post-track stems, preserving order and exact sample origin.
  // This compares every sample across all section boundaries with the continuous global render.
  const sum = new Float64Array(STRESS_FRAMES * 2);
  for (const stem of manifest.stems) {
    const path = join(audio, stem.wav.file), source = readFileSync(path), s = shape(source);
    assert.equal(s.frames, STRESS_FRAMES); assert.equal(s.sampleRate, RATE); assert.equal(s.channels, 2);
    assert.equal(await fileHash(path), stem.wav.sha256);
    for (let f = 0; f < STRESS_FRAMES * 2; f++) sum[f] += source.readInt16LE(s.dataOffset + f * 2);
    stems.push({ trackId: stem.trackId, frames: s.frames, sha256: stem.wav.sha256 });
  }
  const masterSettings = c.project!.master!, processed = await processor.value.effects(gainPan(sum, masterSettings.gainDb), masterSettings.effects!, STRESS_FRAMES);
  assert.ok(processed.value, JSON.stringify(processed.diagnostic));
  const reconstructed = quantize(fitFloat(processed.value, STRESS_FRAMES));
  assert.equal(hash(reconstructed.bytes), wavHash, 'exported stems reconstruct the global master sample for sample through continuous master FX');
  let uncachedTaps = 0, triggerCount = 0;
  const crossing = new Map<number, any[]>();
  for (const track of c.timeline!.tracks) for (const t of sampleTriggers(c, track, STRESS_FRAMES)) {
    triggerCount++;
    uncachedTaps += voiceCost(t.pcm, t.playback, STRESS_FRAMES - t.frame, t.articulation).work;
    const independentlyRounded = Number((BigInt(t.tick) * BigInt(c.timeline!.usPerQuarter) * 44100n + 480000000n) / 960000000n);
    assert.equal(t.frame, independentlyRounded, 'absolute nearest-frame event timing');
    const frames = Math.min(voiceFrames(t.pcm, t.playback, t.articulation), STRESS_FRAMES - t.frame);
    for (const section of SECTIONS.slice(1)) {
      const boundary = Math.round(section.startSeconds * RATE);
      if (t.frame < boundary && t.frame + frames > boundary) {
        const list = crossing.get(boundary) ?? []; list.push({ trackId: track.id, onsetFrame: t.frame, endFrameExclusive: t.frame + frames }); crossing.set(boundary, list);
      }
    }
  }
  assert.ok(uncachedTaps > 1000000000);
  const excerpts = join(workspace, 'transition-excerpts'); mkdirSync(excerpts, { recursive: true });
  const boundaries = [];
  for (const section of SECTIONS.slice(1)) {
    const frame = Math.round(section.startSeconds * RATE), span = Math.round(0.75 * RATE), file = `boundary-${section.startSeconds}s.wav`;
    writeFileSync(join(excerpts, file), extractWavFrames(bytes, frame - span, frame + span));
    assert.ok(crossing.get(frame)?.length, 'at least one existing dry voice crosses each section boundary');
    boundaries.push({ entering: section.name, seconds: section.startSeconds, frame, adjacentFrameDeltaPcm16: frameDelta(bytes, frame), peakIn20msDbfs: rangePeak(bytes, frame - 441, frame + 441), dryVoicesCrossing: crossing.get(frame),
      continuousEffects: c.project!.tracks.filter(t => t.effects?.some(e => e.type === 'delay' || e.type === 'reverb')).map(t => t.id), excerpt: `${excerpts}/${file}` });
  }
  const sections = [];
  for (const section of SECTIONS) {
    const sectionFile = join(workspace, 'section-analysis.wav');
    writeFileSync(sectionFile, extractWavFrames(bytes, Math.round(section.startSeconds * RATE), Math.round(section.endSeconds * RATE)));
    const loudness = await processor.value.loudness(sectionFile); assert.ok(loudness.value, JSON.stringify(loudness.diagnostic));
    sections.push({ ...section, ...loudness.value });
  }
  const report = {
    title: 'DAEMON FORGE 003: continuous 180-second production proof', sourceMainCommit: 'e2962cc1a443c841cd6ca7cb2cc56c5ebabf0e99',
    tools: { node: process.version, ffmpeg: processor.value.identity.version },
    project: { file: 'proofs/forge003/headliner-stress.project.json', sha256: manifest.project.sha256, tracks: c.timeline!.tracks.length, triggers: triggerCount, bars: 96, bpm: 128, frames: info.frames, seconds: info.frames / RATE },
    sourceCode: Object.fromEntries(['scripts/create-headliner-stress.ts', 'scripts/verify-headliner-stress.ts'].map(file => [file, hash(readFileSync(file))])),
    safety: { legacyDefaultRejectsInterpolationBudget: true, uncachedInterpolationTapEstimate: uncachedTaps, actualReuse: manifest.samples.reuse, noBudgetIncreaseOrBypass: true },
    determinism: { twoIndependentContinuousRendersIdentical: true, compared, mp3Compared: false, explanation: 'MP3 is a listening copy. WAV, every stem, MIDI, manifest and analysis repeat byte for byte. Cache lifetime is one render; a repeated full render recomputes unique voices.' },
    continuousTimeline: { assembly: 'No audio section concatenation. Full-length per-track buffers and all ordered effects run once from sample zero to frame 7,938,000; shared interpolation buffers contain no time-dependent track/master state.', reconstructedFromExportedStemsSha256: hash(reconstructed.bytes), reconstructionEqualsGlobalMasterEverySample: true, allTriggerFramesMatchIndependentBigIntRounding: true, alignedStems: stems },
    master: { wavSha256: wavHash, analysis: manifest.analysis.master, stereo, masterClippedSamples: manifest.production.master.clippedSamples, trackClippedSamples: manifest.production.tracks.map((t: any) => ({ trackId: t.trackId, clippedSamples: t.clippedSamples })),
      lastSecondPeakDbfs: rangePeak(bytes, STRESS_FRAMES - RATE, STRESS_FRAMES), last100msPeakDbfs: rangePeak(bytes, STRESS_FRAMES - 4410, STRESS_FRAMES), last10msPeakDbfs: rangePeak(bytes, STRESS_FRAMES - 441, STRESS_FRAMES), finalFramePcm16: Array.from(decodePcm(bytes).pcm!.samples.slice(-2)) },
    boundaries, sections,
    cost: { firstRenderSeconds, replayRenderSeconds: replaySeconds, verifierProcessMaxRssKiB: process.resourceUsage().maxRSS, memoryScope: 'Maximum resident set of the verifier Node process, including the independent replay render and all QC/reconstruction; FFmpeg child memory is excluded. Linux maxRSS is KiB.', timingAndMemoryAreHostSpecificAndNotPartOfDeterminismContract: true, outputBytes: manifest.wav.bytes, stemPcmBytes: manifest.stems.reduce((n: number, s: any) => n + s.wav.bytes, 0) },
    licensing: 'Owner-authorized internal technical proof using existing original Signature and MORPH assets unchanged. Their owner licensing declarations remain pending. No commercial clearance, publication or new license grant is asserted.',
    listening: 'Analytical verification only. No human listening session or subjective quality result is claimed. Transition excerpts are retained for listening review; low adjacent-frame deltas and quiet tails are technical evidence, not proof of a clean perceptual seam or release quality.',
    limitations: ['The original 15-track schema limit and 600-second render cap remain.', 'Repeated voice interpolation is shared only when all sample-generating parameters and rendered frame count match; novel sustained material can still exceed either original safety budget.', 'The existing production master/stems are PCM16. This file is not promoted to 24-bit by padding.', 'Full-duration arrays and exported stems still cost memory/disk; no streaming or persistent disk cache is implemented.', 'Intentional stress-range exceptions to pack recommendations: EVENT HORIZON reaches D2 and the mutated PHANTOM phrase reaches E6. Rates stay within supported engine bounds, but these choices are not a listening-approved extension of the recommended instrument range.'],
  };
  mkdirSync(proof, { recursive: true }); writeFileSync(join(proof, 'headliner-stress.verification.json'), JSON.stringify(report, null, 2) + '\n');
  if (deliver) { mkdirSync(join(proof, 'audio'), { recursive: true }); for (const suffix of ['wav', 'mp3', 'analysis.json', 'render.json']) copyFileSync(join(audio, `headliner-stress.${suffix}`), join(proof, 'audio', `headliner-stress.${suffix}`)); }
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await verifyHeadlinerStress(process.argv.includes('--existing-first'), process.argv.includes('--deliver'), process.argv.includes('--existing-replay'));
  process.stdout.write(JSON.stringify({ project: r.project, safety: r.safety, master: r.master, cost: r.cost, determinism: { identical: r.determinism.twoIndependentContinuousRendersIdentical, artifactsCompared: r.determinism.compared.length } }, null, 2) + '\n');
}
