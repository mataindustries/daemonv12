/** Verify two independently rendered PCM24 directories without replacing either.
 * node scripts/verify-production24.ts <project.json> <first-dir> <replay-dir> <report.json> [--stress]
 * A replay must be rendered separately with render-production24.ts before verification.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileProjectFile } from '../src/pipeline.ts';
import { sampleTriggers } from '../src/sample-render.ts';
import { analyzePcm24, createAudioProcessor, voiceFrames } from '../src/render/index.ts';
import { readWavInfo } from '../src/render/wav.ts';

const RATE = 44100;
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const db = (x: number) => x > 0 ? Number((20 * Math.log10(x)).toFixed(6)) : null;
async function fileHash(path: string) {
  const digest = createHash('sha256');
  for await (const bytes of createReadStream(path)) digest.update(bytes);
  return digest.digest('hex');
}
function shape(bytes: Buffer) {
  const parsed = readWavInfo(bytes); assert.ok(parsed.ok);
  assert.equal(parsed.info.formatTag, 1); assert.equal(parsed.info.bitsPerSample, 24);
  assert.equal(parsed.info.channels, 2); assert.equal(parsed.info.sampleRate, RATE);
  return parsed.info;
}
function window(bytes: Buffer, start: number, end: number) {
  const info = shape(bytes); let peak = 0, energy = 0;
  assert.ok(start >= 0 && start < end && end <= info.frames);
  for (let frame = start; frame < end; frame++) for (let channel = 0; channel < 2; channel++) {
    const value = bytes.readIntLE(info.dataOffset + frame * 6 + channel * 3, 3) / 8388608;
    peak = Math.max(peak, Math.abs(value)); energy += value * value;
  }
  return { startFrame: start, endFrameExclusive: end, peakDbfs: db(peak), rmsDbfs: db(Math.sqrt(energy / ((end - start) * 2))) };
}
function lowBand(bytes: Buffer) {
  const info = shape(bytes), coefficient = 1 - Math.exp(-2 * Math.PI * 150 / RATE);
  let l1 = 0, l2 = 0, r1 = 0, r2 = 0, ll = 0, rr = 0, lr = 0, mm = 0;
  for (let frame = 0; frame < info.frames; frame++) {
    const l = bytes.readIntLE(info.dataOffset + frame * 6, 3) / 8388608;
    const r = bytes.readIntLE(info.dataOffset + frame * 6 + 3, 3) / 8388608;
    l1 += coefficient * (l - l1); l2 += coefficient * (l1 - l2);
    r1 += coefficient * (r - r1); r2 += coefficient * (r1 - r2);
    ll += l2 * l2; rr += r2 * r2; lr += l2 * r2; mm += ((l2 + r2) / 2) ** 2;
  }
  return { method: 'Two cascaded causal one-pole low-pass filters at 150 Hz from sample zero; an engineering mono proxy, not a perceptual test.',
    correlation: ll && rr ? Number((lr / Math.sqrt(ll * rr)).toFixed(6)) : null,
    monoFoldChangeDb: ll + rr ? db(Math.sqrt(mm / ((ll + rr) / 2))) : null };
}

export async function verifyProduction24(projectPath: string, firstDirectory: string, replayDirectory: string, stress = false) {
  assert.notEqual(resolve(firstDirectory), resolve(replayDirectory), 'independent render directories required');
  const name = basename(projectPath).replace(/\.json$/i, ''), manifestName = `${name}.24.render.json`;
  const manifests = [firstDirectory, replayDirectory].map(dir => JSON.parse(readFileSync(join(dir, manifestName), 'utf8')));
  const manifest = manifests[0]; assert.deepEqual(manifest, manifests[1], 'independent render manifests');
  assert.equal(manifest.kind, 'daemonv12-production24'); assert.equal(manifest.export.bitsPerSample, 24);
  assert.equal(manifest.project.sha256, hash(readFileSync(projectPath)), 'source project identity');
  const compilation = compileProjectFile(projectPath, { reuseVoices: Boolean(manifest.interpolationReuse) });
  assert.ok(compilation.timeline && compilation.project, JSON.stringify(compilation.diagnostics));
  assert.equal(compilation.diagnostics.filter(d => d.severity === 'error').length, 0);
  assert.equal(compilation.timeline.tracks.length, manifest.stems.length);
  for (const source of manifest.sources) assert.equal(hash(compilation.assets!.get(source.file)!.bytes), source.sha256, source.file);
  const compared: { file: string; sha256: string; frames?: number }[] = [];
  for (const item of [manifest.master, ...manifest.stems]) {
    const first = join(firstDirectory, item.file), replay = join(replayDirectory, item.file);
    const digest = await fileHash(first); assert.equal(digest, item.sha256, item.file);
    assert.equal(digest, await fileHash(replay), `independent replay: ${item.file}`);
    const bytes = readFileSync(first), info = shape(bytes); assert.equal(info.frames, manifest.master.frames, item.file);
    const measured = analyzePcm24(bytes);
    assert.equal(measured.fullScaleSamples, 0, `${item.file}: no full-scale samples`);
    assert.equal(item.clippedSamples, 0, `${item.file}: no pre-export clipping`);
    assert.equal(measured.frames, item.analysis.frames); assert.equal(measured.peakDbfs, item.analysis.peakDbfs);
    compared.push({ file: item.file, sha256: digest, frames: info.frames });
  }
  assert.equal(await fileHash(join(firstDirectory, manifestName)), await fileHash(join(replayDirectory, manifestName)));
  compared.push({ file: manifestName, sha256: await fileHash(join(firstDirectory, manifestName)) });
  const bytes = readFileSync(join(firstDirectory, manifest.master.file)), info = shape(bytes);
  const processor = await createAudioProcessor({ env: process.env }); assert.ok(processor.value, JSON.stringify(processor.diagnostic));
  const loudness = await processor.value.loudness(join(firstDirectory, manifest.master.file)); assert.ok(loudness.value, JSON.stringify(loudness.diagnostic));
  for (const [key, value] of Object.entries(loudness.value)) assert.equal(value, manifest.master.analysis[key], `rechecked ${key}`);
  const boundarySeconds = stress ? [15, 45, 60, 90, 105, 120, 165] : [];
  if (stress) { assert.equal(info.frames, 7938000); assert.equal(info.frames / RATE, 180); assert.equal(manifest.stems.length, 15); }
  const crossing = new Map<number, { trackId: string; onsetFrame: number; endFrameExclusive: number }[]>();
  let triggers = 0;
  for (const track of compilation.timeline.tracks) for (const trigger of sampleTriggers(compilation, track, info.frames)) {
    triggers++;
    const independentFrame: number = Number((BigInt(trigger.tick) * BigInt(compilation.timeline.usPerQuarter) * BigInt(RATE) + 480000000n) / 960000000n);
    assert.equal(trigger.frame, independentFrame, 'independent absolute event rounding');
    const end = Math.min(info.frames, trigger.frame + voiceFrames(trigger.pcm, trigger.playback, trigger.articulation));
    for (const seconds of boundarySeconds) if (trigger.frame < seconds * RATE && end > seconds * RATE) {
      const voices = crossing.get(seconds) ?? []; voices.push({ trackId: track.id, onsetFrame: trigger.frame, endFrameExclusive: end }); crossing.set(seconds, voices);
    }
  }
  const boundaries = boundarySeconds.map(seconds => {
    const frame = seconds * RATE; assert.ok(crossing.get(seconds)?.length, `sustained dry voice crosses ${seconds}s`);
    return { seconds, frame, region: window(bytes, frame - 441, frame + 441),
      adjacentFrameDeltaPcm24: [0, 1].map(c => bytes.readIntLE(info.dataOffset + frame * 6 + c * 3, 3) - bytes.readIntLE(info.dataOffset + (frame - 1) * 6 + c * 3, 3)),
      dryVoicesCrossing: crossing.get(seconds) };
  });
  const low = lowBand(bytes);
  if (stress) { assert.ok(low.correlation !== null && low.correlation > 0.9); assert.ok(manifest.master.analysis.truePeakDbfs < -1); }
  return {
    title: 'Independent PCM24 production replay verification', version: 1,
    project: { file: basename(projectPath), sha256: manifest.project.sha256, tracks: manifest.stems.length, triggers, frames: info.frames, seconds: info.frames / RATE },
    runtime: manifest.runtime, sourceCode: Object.fromEntries(['src/precision-render.ts', 'src/render/precision.ts', 'scripts/verify-production24.ts'].map(file => [file, hash(readFileSync(file))])),
    determinism: { twoIndependentRenderDirectoriesMatch: true, masterAndEveryStemAndManifestCompared: true, compared },
    timing: { everyResolvedTriggerMatchesIndependentBigIntRounding: true, allStemsCommonOriginAndExactMasterLength: true,
      method: 'Full-length continuous source scheduling, automation and ordered effects from sample zero; no section renders or concatenation. Both independently rendered directories compare every PCM byte.', boundaries },
    master: { ...manifest.master, lowBand: low,
      lastSecond: window(bytes, Math.max(0, info.frames - RATE), info.frames), last100ms: window(bytes, Math.max(0, info.frames - 4410), info.frames), last10ms: window(bytes, Math.max(0, info.frames - 441), info.frames),
      finalFramePcm24: [bytes.readIntLE(info.dataOffset + (info.frames - 1) * 6, 3), bytes.readIntLE(info.dataOffset + (info.frames - 1) * 6 + 3, 3)] },
    interpolationReuse: manifest.interpolationReuse ?? null,
    precision: 'PCM16 sources; original unrounded interpolation, velocity/envelope, gain, automation and effects retain Float64 detail until PCM24 export. Nonzero low bytes are diagnostic; the fractional-signal/reference-error tests establish mathematical precision, not audible improvement.',
    stemRelationship: 'Stems are post-track/pre-master PCM24 exports. Master sums original Float64 tracks before stem quantization; a sum of exported stems is not expected to reproduce the master byte for byte.',
    licensing: 'Original repository source assets used at the owner’s request. Existing Signature/MORPH and code licensing remain pending owner declaration; no commercial license grant or release approval is asserted.',
    listening: 'No human listening or subjective audio-quality claim. Boundary/tail/mono metrics and whole-file replay hashes provide technical evidence only.',
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [project, first, replay, reportFile, ...flags] = process.argv.slice(2);
  if (!project || !first || !replay || !reportFile || flags.some(flag => flag !== '--stress')) throw new Error('Usage: verify-production24.ts <project.json> <first-dir> <replay-dir> <report.json> [--stress]');
  const report = await verifyProduction24(project, first, replay, flags.includes('--stress'));
  mkdirSync(dirname(reportFile), { recursive: true }); writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ project: report.project, master: report.master, comparedArtifacts: report.determinism.compared.length }, null, 2) + '\n');
}
