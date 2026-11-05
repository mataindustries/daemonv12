/** Read-only SODIUM HOURS A/B and independent production-package replay verification. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileProjectFile } from '../src/pipeline.ts';
import { sampleTriggers } from '../src/sample-render.ts';
import type { Track } from '../src/project/types.ts';
import { createAudioProcessor, voiceFrames } from '../src/render/index.ts';
import { readWavInfo, type WavInfo } from '../src/render/wav.ts';
import { files, verifyPackage } from '../production/headliner/build.ts';

const RATE = 44100;
const REFERENCE_COMMIT = '6b1ab7b8f1602bd4e57244b16caee68d8876336f';
const LOCKED_MASTER = '43da3fd7119f5add17ff9896e29d46123cdb1f214ea9fc8e7747513903f1e07d';
const LOCKED_PROJECT = 'fb9ca8ad10ca3029b0d873e6190760ba6e20019bb021744e2cf5b1e8de644edb';
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const round = (value: number) => Number(value.toFixed(9));
const db = (value: number) => value > 0 ? round(20 * Math.log10(value)) : null;
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
async function fileHash(path: string) {
  const digest = createHash('sha256');
  for await (const bytes of createReadStream(path)) digest.update(bytes);
  return digest.digest('hex');
}
function shape(bytes: Buffer) {
  const parsed = readWavInfo(bytes); assert.ok(parsed.ok, parsed.ok ? undefined : parsed.error);
  const info = parsed.info;
  assert.equal(info.formatTag, 1); assert.equal(info.channels, 2); assert.equal(info.sampleRate, RATE);
  assert.ok(info.bitsPerSample === 16 || info.bitsPerSample === 24);
  return info;
}
function sample(bytes: Buffer, info: WavInfo, frame: number, channel: number) {
  const width = info.bitsPerSample / 8;
  return bytes.readIntLE(info.dataOffset + (frame * 2 + channel) * width, width) / 2 ** (info.bitsPerSample - 1);
}
function region(bytes: Buffer, info: WavInfo, from: number, to: number) {
  let peak = 0, energy = 0, differencePeak = 0;
  for (let frame = from; frame < to; frame++) for (let channel = 0; channel < 2; channel++) {
    const value = sample(bytes, info, frame, channel);
    peak = Math.max(peak, Math.abs(value)); energy += value * value;
    if (frame > from) differencePeak = Math.max(differencePeak, Math.abs(value - sample(bytes, info, frame - 1, channel)));
  }
  return { fromFrame: from, toFrameExclusive: to, peakDbfs: db(peak), rmsDbfs: db(Math.sqrt(energy / ((to - from) * 2))),
    firstDifferencePeakDbfs: db(differencePeak) };
}

/** Measures normalized PCM values at their existing sample origin, with no gain/time fitting. */
export function compareAudio(original: Buffer, candidate: Buffer) {
  const a = shape(original), b = shape(candidate);
  assert.equal(a.frames, b.frames, 'exact duration/sample alignment');
  const measure = () => ({ energy: 0, peak: 0, ll: 0, rr: 0, lr: 0, mono: 0, side: 0, lowLL: 0, lowRR: 0,
    lowLR: 0, lowMono: 0, l1: 0, l2: 0, r1: 0, r2: 0, fullScaleSamples: 0, nonzeroLowBytes: 0,
    transientEnergy: 0, transientPeak: 0, previousL: 0, previousR: 0 });
  const values = [measure(), measure()];
  const coefficient = 1 - Math.exp(-2 * Math.PI * 150 / RATE);
  let residualPeak = 0, residualEnergy = 0, cross = 0, changedSamples = 0, residualTransientPeak = 0;
  for (let frame = 0; frame < a.frames; frame++) {
    const pair = [original, candidate].map((bytes, i) => {
      const info = i === 0 ? a : b, m = values[i]!;
      const l = sample(bytes, info, frame, 0), r = sample(bytes, info, frame, 1);
      m.ll += l * l; m.rr += r * r; m.lr += l * r; m.mono += ((l + r) / 2) ** 2; m.side += ((l - r) / 2) ** 2;
      m.energy += l * l + r * r; m.peak = Math.max(m.peak, Math.abs(l), Math.abs(r));
      if (frame) { const dl = l - m.previousL, dr = r - m.previousR;
        m.transientEnergy += dl * dl + dr * dr; m.transientPeak = Math.max(m.transientPeak, Math.abs(dl), Math.abs(dr)); }
      m.previousL = l; m.previousR = r;
      const scale = 2 ** (info.bitsPerSample - 1);
      m.fullScaleSamples += Number(l === -1 || l === (scale - 1) / scale) + Number(r === -1 || r === (scale - 1) / scale);
      if (info.bitsPerSample === 24) for (let c = 0; c < 2; c++) if (bytes[info.dataOffset + frame * 6 + c * 3] !== 0) m.nonzeroLowBytes++;
      m.l1 += coefficient * (l - m.l1); m.l2 += coefficient * (m.l1 - m.l2);
      m.r1 += coefficient * (r - m.r1); m.r2 += coefficient * (m.r1 - m.r2);
      m.lowLL += m.l2 * m.l2; m.lowRR += m.r2 * m.r2; m.lowLR += m.l2 * m.r2; m.lowMono += ((m.l2 + m.r2) / 2) ** 2;
      return [l, r];
    });
    for (let c = 0; c < 2; c++) {
      const delta = pair[1]![c]! - pair[0]![c]!;
      residualPeak = Math.max(residualPeak, Math.abs(delta)); residualEnergy += delta * delta;
      if (delta !== 0) changedSamples++;
      cross += pair[0]![c]! * pair[1]![c]!;
      if (frame) { const before = sample(candidate, b, frame - 1, c) - sample(original, a, frame - 1, c);
        residualTransientPeak = Math.max(residualTransientPeak, Math.abs(delta - before)); }
    }
  }
  const metrics = values.map((m, i) => {
    const rms = Math.sqrt(m.energy / (a.frames * 2));
    return { bitsPerSample: i === 0 ? a.bitsPerSample : b.bitsPerSample, frames: a.frames, durationSeconds: a.frames / RATE,
      samplePeakDbfs: db(m.peak), sampleHeadroomDb: m.peak ? round(-20 * Math.log10(m.peak)) : null,
      rmsDbfs: db(rms), crestFactorDb: rms && m.peak ? round(20 * Math.log10(m.peak / rms)) : null,
      fullScaleSamples: m.fullScaleSamples, nonzeroLowBytes: i === 1 ? m.nonzeroLowBytes : undefined,
      stereoCorrelation: m.ll && m.rr ? round(m.lr / Math.sqrt(m.ll * m.rr)) : null,
      monoFoldChangeDb: m.energy ? db(Math.sqrt(m.mono / (m.energy / 2))) : null,
      sideToMidDb: m.mono ? db(Math.sqrt(m.side / m.mono)) : null,
      lowBand: { correlation: m.lowLL && m.lowRR ? round(m.lowLR / Math.sqrt(m.lowLL * m.lowRR)) : null,
        monoFoldChangeDb: m.lowLL + m.lowRR ? db(Math.sqrt(m.lowMono / ((m.lowLL + m.lowRR) / 2))) : null },
      transients: { method: 'Unweighted adjacent-sample first differences; a technical transient proxy.',
        peakDbfs: db(m.transientPeak), rmsDbfs: db(Math.sqrt(m.transientEnergy / (Math.max(1, a.frames - 1) * 2))) } };
  });
  // Small-lag search checks for an unintended sample offset without fitting the compared residual.
  const correlations = [];
  for (let lag = -16; lag <= 16; lag++) {
    let aa = 0, bb = 0, ab = 0;
    for (let frame = 16; frame < a.frames - 16; frame += 32) for (let c = 0; c < 2; c++) {
      const x = sample(original, a, frame, c), y = sample(candidate, b, frame + lag, c);
      aa += x * x; bb += y * y; ab += x * y;
    }
    correlations.push({ lagFrames: lag, correlation: aa && bb ? round(ab / Math.sqrt(aa * bb)) : null });
  }
  const best = [...correlations].sort((x, y) => (y.correlation ?? -Infinity) - (x.correlation ?? -Infinity) || Math.abs(x.lagFrames) - Math.abs(y.lagFrames))[0]!;
  return { original: metrics[0]!, candidate: metrics[1]!, alignment: { bestLagFrames: best.lagFrames,
    bestCorrelation: best.correlation, fullLengthZeroLagCorrelation: values[0]!.energy && values[1]!.energy ? round(cross / Math.sqrt(values[0]!.energy * values[1]!.energy)) : null,
    method: 'Normalized cross-product over both channels; lag search -16..16 frames sampled every 32 frames. Positive lag means candidate is delayed. No correction applied.', correlations },
    residual: { method: 'Candidate minus original at the same sample index and full-scale amplitude. No gain, delay, dither or mastering matching.',
      peakDbfs: db(residualPeak), rmsDbfs: db(Math.sqrt(residualEnergy / (a.frames * 2))),
      rmsRelativeToOriginalDb: values[0]!.energy ? db(Math.sqrt(residualEnergy / values[0]!.energy)) : null,
      changedSamples, totalSamples: a.frames * 2, adjacentDifferencePeakDbfs: db(residualTransientPeak) },
    lowBandMethod: 'Two cascaded causal one-pole 150 Hz low-pass filters, continuous from sample zero; a mono-compatibility proxy, not a perceptual test.' };
}

export async function verifySodiumProduction24(originalDirectory: string, firstDirectory: string, replayDirectory: string) {
  assert.notEqual(resolve(firstDirectory), resolve(replayDirectory), 'separate full renders required');
  verifyPackage(firstDirectory); verifyPackage(replayDirectory);
  const outputFiles = files(firstDirectory); assert.deepEqual(outputFiles, files(replayDirectory));
  const compared = [];
  for (const file of outputFiles) {
    const digest = await fileHash(join(firstDirectory, file));
    assert.equal(digest, await fileHash(join(replayDirectory, file)), `independent replay: ${file}`);
    compared.push({ file, sha256: digest });
  }
  const manifest = json(join(firstDirectory, 'metadata/render.json'));
  assert.equal(manifest.kind, 'daemonv12-production24'); assert.equal(manifest.export.bitsPerSample, 24);
  const originalProject = join(originalDirectory, 'project/sodium-hours.json');
  assert.equal(await fileHash(originalProject), LOCKED_PROJECT);
  assert.equal(await fileHash(join(firstDirectory, manifest.project.file)), LOCKED_PROJECT, 'unchanged arrangement and instrument/mix parameters');
  assert.equal(manifest.project.sha256, LOCKED_PROJECT);
  const originalWav = join(originalDirectory, 'delivery/sodium-hours.wav'), candidateWav = join(firstDirectory, manifest.master.file);
  assert.equal(await fileHash(originalWav), LOCKED_MASTER, 'original locked PCM16 master');
  assert.equal(await fileHash(candidateWav), manifest.master.sha256);
  const originalBytes = readFileSync(originalWav), candidateBytes = readFileSync(candidateWav);
  const a = shape(originalBytes), b = shape(candidateBytes);
  assert.equal(a.bitsPerSample, 16); assert.equal(b.bitsPerSample, 24);
  assert.equal(a.frames, 8224650); assert.equal(b.frames, a.frames);
  const analysis = compareAudio(originalBytes, candidateBytes);
  assert.equal(analysis.alignment.bestLagFrames, 0, 'no measurable master sample shift');
  assert.equal(analysis.original.fullScaleSamples, 0); assert.equal(analysis.candidate.fullScaleSamples, 0);
  assert.ok(analysis.candidate.nonzeroLowBytes! > 0, 'candidate contains precision below the PCM16 grid');
  assert.equal(manifest.master.clippedSamples, 0);
  const compilation = compileProjectFile(originalProject, { reuseVoices: Boolean(manifest.interpolationReuse) });
  assert.ok(compilation.project && compilation.timeline, JSON.stringify(compilation.diagnostics));
  assert.deepEqual(compilation.diagnostics.filter(d => d.severity === 'error'), []);
  const sourceHashes = [];
  const catalog = json(join(originalDirectory, 'project/sodium-hours.catalog.json'));
  for (const sound of catalog.sounds) {
    assert.equal(await fileHash(join(originalDirectory, 'project', sound.file)), sound.sha256, `restored canonical WAV: ${sound.file}`);
    assert.equal(await fileHash(join(firstDirectory, 'source', sound.file)), sound.sha256, `candidate source: ${sound.file}`);
    sourceHashes.push({ file: sound.file, sha256: sound.sha256, bitsPerSample: 16, frames: sound.frames, channels: sound.channels });
  }
  for (const source of manifest.sources) assert.equal(await fileHash(join(firstDirectory, source.file)), source.sha256, source.file);
  for (const generator of catalog.generator) assert.equal(await fileHash(join(originalDirectory, '..', generator.file)), generator.sha256);
  const stems = [];
  assert.equal(manifest.stems.length, compilation.timeline.tracks.length); assert.equal(manifest.stems.length, 15);
  for (const stem of manifest.stems) {
    const path = join(firstDirectory, stem.file), bytes = readFileSync(path), info = shape(bytes);
    assert.equal(info.bitsPerSample, 24); assert.equal(info.frames, b.frames); assert.equal(stem.clippedSamples, 0);
    assert.equal(await fileHash(path), stem.sha256);
    const authored: Track = compilation.project.tracks.find(t => t.id === stem.trackId)!;
    assert.deepEqual(stem.effects, authored.effects ?? [], 'authored ordered effects preserved');
    stems.push({ trackId: stem.trackId, file: stem.file, sha256: stem.sha256, frames: info.frames, originFrame: 0, clippedSamples: stem.clippedSamples });
  }
  const sectionClips = compilation.project.tracks[0]!.clips!;
  const boundaries = sectionClips.filter(clip => clip.bar > 1).map(clip => {
    const tick = (clip.bar - 1) * 3840;
    const frame = Number((BigInt(tick) * BigInt(compilation.timeline!.usPerQuarter) * 44100n + 480000000n) / 960000000n);
    return { enteringPattern: clip.pattern, bar: clip.bar, frame, seconds: frame / RATE,
      original: region(originalBytes, a, frame - 441, frame + 441), candidate: region(candidateBytes, b, frame - 441, frame + 441),
      adjacentDeltaDbfs: [originalBytes, candidateBytes].map((bytes, i) => [0, 1].map(c => db(Math.abs(sample(bytes, i ? b : a, frame, c) - sample(bytes, i ? b : a, frame - 1, c))))),
      dryVoicesCrossing: [] as { trackId: string; onsetFrame: number; endFrameExclusive: number }[] };
  });
  let triggers = 0;
  for (const track of compilation.timeline.tracks) {
    const scheduled: ReturnType<typeof sampleTriggers> = sampleTriggers(compilation, track, b.frames);
    for (const trigger of scheduled) {
    triggers++;
    const roundedFrame: number = Number((BigInt(trigger.tick) * BigInt(compilation.timeline.usPerQuarter) * 44100n + 480000000n) / 960000000n);
    assert.equal(trigger.frame, roundedFrame, 'independent absolute event rounding');
    const end = Math.min(b.frames, trigger.frame + voiceFrames(trigger.pcm, trigger.playback, trigger.articulation));
    for (const boundary of boundaries) if (trigger.frame < boundary.frame && end > boundary.frame)
      boundary.dryVoicesCrossing.push({ trackId: track.id, onsetFrame: trigger.frame, endFrameExclusive: end });
    }
  }
  const created = await createAudioProcessor({ env: process.env }); assert.ok(created.value, JSON.stringify(created.diagnostic));
  const loudness = [];
  for (const path of [originalWav, candidateWav]) {
    const measured = await created.value.loudness(path); assert.ok(measured.value, JSON.stringify(measured.diagnostic));
    loudness.push({ ...measured.value, truePeakHeadroomDb: measured.value.truePeakDbfs === null ? null : -measured.value.truePeakDbfs });
  }
  for (const [key, value] of Object.entries(loudness[1]!)) if (key !== 'truePeakHeadroomDb') assert.equal(value, manifest.master.analysis[key]);
  const tails = [originalBytes, candidateBytes].map((bytes, i) => {
    const info = i ? b : a;
    return { lastSecond: region(bytes, info, info.frames - RATE, info.frames), last100ms: region(bytes, info, info.frames - 4410, info.frames),
      finalFrameNormalized: [0, 1].map(c => sample(bytes, info, info.frames - 1, c)) };
  });
  // Recheck preservation after every analysis operation.
  assert.equal(await fileHash(originalWav), LOCKED_MASTER); assert.equal(await fileHash(originalProject), LOCKED_PROJECT);
  return { kind: 'daemonv12-sodium-hours-production24-ab', version: 1, referenceCommit: REFERENCE_COMMIT,
    project: { sha256: LOCKED_PROJECT, originalAndCandidateBytesIdentical: true, frames: b.frames, seconds: b.frames / RATE,
      tracks: stems.length, triggers, compositionChanges: false, sourceSounds: sourceHashes.length },
    original: { sha256: LOCKED_MASTER, unchangedBeforeAndAfter: true, ...analysis.original, loudness: loudness[0], tail: tails[0] },
    candidate: { sha256: manifest.master.sha256, ...analysis.candidate, loudness: loudness[1], tail: tails[1],
      signalPath: manifest.signalPath, export: manifest.export, masterClippedSamples: manifest.master.clippedSamples },
    comparison: { alignment: analysis.alignment, residual: analysis.residual, lowBandMethod: analysis.lowBandMethod,
      interpretation: 'Differences quantify changed rounding and float processing through the unchanged authored mix. Measurements do not establish a subjective improvement.' },
    timingAndContinuity: { everyTriggerMatchesIndependentBigIntRounding: true, allStemsAlignedFromSampleZero: true,
      method: 'One continuous full-length renderer invocation per track/master, from sample zero; no independently reset section assembly. Boundaries are authored first-track clip starts. Adjacent deltas and crossing sources are diagnostics, not a perceptual seam certification.',
      boundaries, masterEffects: compilation.project.master?.effects ?? [], masterGainDb: compilation.project.master?.gainDb ?? 0 },
    reproducibility: { independentFullPackagesMatch: true, artifactsCompared: compared.length, compared,
      scope: 'Byte equality on the recorded Node/FFmpeg/toolchain only. Original stored MP3 predates this toolchain; comparable listening copies are separately derived with the same encoder.' },
    stems, sourceHashes, runtime: { node: process.version, processor: created.value.identity, render: manifest.runtime },
    limitations: ['PCM16 sources retain their existing source resolution; newly calculated fractional detail survives to PCM24, but no lost source information is recovered.',
      'Nonzero PCM24 low bytes are a diagnostic, not proof of source resolution or audible benefit; separate known-fraction precision tests establish correct processing and quantization.',
      'Independently quantized post-track PCM24 stems need not sum byte for byte to the master, which sums original Float64 tracks before master processing.',
      'No normalization or new mastering decisions are applied. True-peak/LUFS figures describe the unchanged authored mastering settings.',
      'Cross-correlation, mono, boundary and transient measurements are engineering diagnostics. Human listening and release approval remain pending.',
      'Generated sounds, composition and code licenses remain pending owner declaration. No commercial clearance or publication is implied.'],
    evidence: { verifierSha256: sha(readFileSync(fileURLToPath(import.meta.url))), originalCatalogSha256: await fileHash(join(originalDirectory, 'project/sodium-hours.catalog.json')) } };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [original, first, replay, reportFile, ...flags] = process.argv.slice(2);
  assert.ok(original && first && replay && reportFile && flags.length === 0,
    'usage: verify-sodium-production24.ts ORIGINAL_HEADLINER PACKAGE REPLAY_PACKAGE REPORT.json');
  const report = await verifySodiumProduction24(original, first, replay);
  mkdirSync(dirname(reportFile), { recursive: true }); writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ project: report.project, original: report.original, candidate: report.candidate,
    residual: report.comparison.residual, replayArtifacts: report.reproducibility.artifactsCompared }, null, 2) + '\n');
}
