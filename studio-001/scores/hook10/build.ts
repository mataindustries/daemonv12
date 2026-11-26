/**
 * HOOK//10 build: renders each benchmark score with the unchanged rack (score/2 scores are lowered first), folds the render's tail back onto its start
 * (a sample-exact loop without a crossfade), loudness-matches every version with one gain, and writes masters,
 * listening copies, the motif report and event map (score/2 only) and a manifest with the loop verification.
 *
 *   node studio-001/scores/hook10/build.ts NEW_DIR [id ...]        (needs FFmpeg with libmp3lame)
 *
 * Loop method: the piece is exactly LOOP frames long (4 bars at 96 BPM = 441,000 frames). The rack renders it once
 * with a tail (reverb, releases). The loop is  y[n] = x[n] + x[n + LOOP]  for n < LOOP: the tail is added to the
 * start. That is the steady state of the one-shot render retriggered every LOOP frames, so y repeated end to end
 * is continuous at the seam by construction. No crossfade, no time-stretch, no edit of the musical content.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performanceJson } from '../../rack/score.ts';
import { renderScore, mixdown, peak, type Stereo } from '../../rack/render.ts';
import { wavBytes } from '../../rack/package.ts';
import { sha256 } from '../../rack/frozen.ts';
import { beatFrame } from '../../rack/curves.ts';
import { loudness, ffmpegVersion } from '../../rack/cli.ts';
import { lowerScore, motifReport, motifEvents, hook10Gate, normalizeAnyScore, isMotifScore } from '../../motif/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
export const LOOP_FRAMES = 441_000, TARGET_LUFS = -16, CEILING_DBTP = -1;
export const VERSIONS: { id: string; file: string; label: string; condition: 'A' | 'B' }[] = [
  { id: 'A', file: 'hook10-a.score.json', label: 'A-existing-workflow', condition: 'A' },
  { id: 'B1', file: 'hook10-b1.score.json', label: 'B1-motif-development', condition: 'B' },
  { id: 'B2', file: 'hook10-b2.score.json', label: 'B2-motif-call-response', condition: 'B' },
  { id: 'B3', file: 'hook10-b3.score.json', label: 'B3-motif-mirror-broad', condition: 'B' },
];
const ffmpeg = process.env.DAEMONV12_FFMPEG || 'ffmpeg';
const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
function ff(args: string[]) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', '-y', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ')}: ${r.stderr}`);
}
const mp3 = (wav: string, out: string) => ff(['-i', wav, '-codec:a', 'libmp3lame', '-b:a', '256k', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', out]);
const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
const rmsOf = (chs: Float64Array[], a: number, z: number) => { let s = 0; for (const c of chs) for (let i = a; i < z; i++) s += c[i]! * c[i]!; return Math.sqrt(s / Math.max(1, chs.length * (z - a))); };

/** Fold everything after `loop` frames back onto the start. Requires a tail no longer than the loop. */
export function foldLoop(x: Stereo, loop: number): Stereo {
  if (x[0].length < loop || x[0].length > 2 * loop) throw new Error(`fold: the render has ${x[0].length} frames; expected ${loop}..${2 * loop}`);
  return x.map(c => { const y = c.slice(0, loop); for (let i = loop; i < c.length; i++) y[i - loop] = y[i - loop]! + c[i]!; return y; }) as Stereo;
}
const repeat = (y: Stereo, times: number): Stereo => y.map(c => { const out = new Float64Array(c.length * times); for (let k = 0; k < times; k++) out.set(c, k * c.length); return out; }) as Stereo;
const pcmOf = (wav: Buffer) => new Int16Array(wav.buffer, wav.byteOffset + 44, (wav.length - 44) / 2);

/**
 * Seam statistics on the delivered PCM16 samples. The wrap step (last frame to first frame) is compared with every
 * other frame-to-frame step in the file. The second difference is reported too, for information: the downbeat has
 * real note attacks on it, so its slope change is musical, exactly as at every other downbeat.
 */
export function seamCheck(wav: Buffer) {
  const pcm = pcmOf(wav), frames = pcm.length / 2, steps: number[] = [], bends: number[] = [];
  const at = (n: number, c: number) => pcm[2 * (((n % frames) + frames) % frames) + c]!;
  let seamStep = 0, seamBend = 0;
  for (let n = 0; n < frames; n++) for (let c = 0; c < 2; c++) {
    const step = Math.abs(at(n + 1, c) - at(n, c)), bend = Math.abs(at(n + 1, c) - 2 * at(n, c) + at(n - 1, c));
    if (n === frames - 1) seamStep = Math.max(seamStep, step); else steps.push(step);
    if (n === frames - 1 || n === 0) seamBend = Math.max(seamBend, bend); else bends.push(bend);
  }
  steps.sort((a, b) => a - b); bends.sort((a, b) => a - b);
  const q = (v: number[], f: number) => v[Math.min(v.length - 1, Math.floor(f * v.length))]!;
  const share = (v: number[], x: number) => { let lo = 0, hi = v.length; while (lo < hi) { const m = (lo + hi) >> 1; if (v[m]! < x) lo = m + 1; else hi = m; } return +(lo / v.length).toFixed(6); };
  return {
    frames, seamStepLsb: seamStep, seamBendLsb: seamBend,
    insideStepLsb: { median: q(steps, 0.5), p99: q(steps, 0.99), max: steps[steps.length - 1]! }, insideBendLsb: { median: q(bends, 0.5), p99: q(bends, 0.99), max: bends[bends.length - 1]! },
    seamStepPercentile: share(steps, seamStep), seamBendPercentile: share(bends, seamBend),
    pass: seamStep <= q(steps, 0.99),
  };
}

export async function buildVersion(v: (typeof VERSIONS)[number], out: string, log: (s: string) => void) {
  const authored = JSON.parse(readFileSync(join(here, v.file), 'utf8')) as { schema: string }, isV2 = isMotifScore(authored);
  const score = normalizeAnyScore(authored), rendered = await renderScore(score, log), mixes = await mixdown(rendered);
  if (beatFrame(score.endBeat, score.bpm) !== LOOP_FRAMES) throw new Error(`${v.id}: the score is ${beatFrame(score.endBeat, score.bpm)} frames, not ${LOOP_FRAMES} (4 bars at 96 BPM)`);
  const x = mixes.context, loop = foldLoop(x, LOOP_FRAMES), tailFrames = x[0].length - LOOP_FRAMES;
  // fold identity, and proof that the render's tail had decayed before the render ended (nothing was cut off)
  let foldError = 0;
  for (let c = 0; c < 2; c++) for (let n = 0; n < LOOP_FRAMES; n++) foldError = Math.max(foldError, Math.abs(loop[c]![n]! - (x[c]![n]! + (n < tailFrames ? x[c]![n + LOOP_FRAMES]! : 0))));
  const tailEndDb = db(rmsOf(x, x[0].length - 4410, x[0].length)), bodyDb = db(rmsOf(x, 0, LOOP_FRAMES));
  // The wrap joins x[LOOP-1] + x[end] to x[0] + x[LOOP]. x[LOOP-1] -> x[LOOP] is the render's own continuous signal,
  // so the only things the seam adds are the render's very first and very last samples. Both must be digital silence.
  const edge = (n: number) => Math.max(Math.abs(x[0][n]!), Math.abs(x[1][n]!));
  // one gain per version: loudness measured on three passes of the loop, then limited by the true-peak ceiling
  const dir = join(out, v.id); mkdirSync(dir, { recursive: true });
  const probe = join(dir, 'probe.wav'), probeGain = 0.5 / Math.max(1e-9, peak(loop));
  writeFileSync(probe, wavBytes(repeat(loop, 3), probeGain).bytes);
  const l0 = loudness(probe)!; spawnSync('rm', [probe]);
  const gain = probeGain * Math.min(Math.pow(10, (TARGET_LUFS - l0.lufs) / 20), Math.pow(10, (CEILING_DBTP - 0.1 - l0.truePeakDb) / 20));
  const name = `HOOK10-${v.label}`, master = wavBytes(loop, gain), x3 = wavBytes(repeat(loop, 3), gain);
  if (master.clipped || x3.clipped) throw new Error(`${v.id}: clipped samples in the master`);
  const files: Record<string, { sha256: string; bytes: number }> = {};
  const put = (file: string, data: Buffer | string) => { writeFileSync(join(out, file), data); const b = readFileSync(join(out, file)); files[file] = { sha256: sha256(b), bytes: b.length }; };
  // the three-pass WAV exists only to encode the listening MP3 and to measure loudness across the seam; it is three exact copies of the master
  put(`${name}.wav`, master.bytes); writeFileSync(join(dir, 'x3.wav'), x3.bytes);
  mp3(join(out, `${name}.wav`), join(out, `${name}.mp3`)); mp3(join(dir, 'x3.wav'), join(out, `${name}-loop-x3.mp3`));
  for (const f of [`${name}.mp3`, `${name}-loop-x3.mp3`]) { const b = readFileSync(join(out, f)); files[f] = { sha256: sha256(b), bytes: b.length }; }
  put(`${v.id}/score.json`, json(authored)); put(`${v.id}/performance.json`, json(performanceJson(score)));
  let gate: ReturnType<typeof hook10Gate> | undefined;
  if (isV2) {
    const lowered = lowerScore(authored), report = motifReport(authored, lowered);
    gate = hook10Gate(report);
    put(`${v.id}/score.lowered.json`, json(lowered.score)); put(`${v.id}/motif-report.json`, json(report)); put(`${v.id}/motif-events.json`, json(motifEvents(authored, lowered)));
  }
  const stems = [...mixes.stems].map(([id, st]) => ({ part: id, rmsDb: +db(rmsOf(st, 0, LOOP_FRAMES)).toFixed(2), peakDb: +db(peak(st)).toFixed(2) }));
  const measured = loudness(join(out, `${name}.wav`))!, measuredX3 = loudness(join(dir, 'x3.wav'))!, seam = seamCheck(master.bytes);
  spawnSync('rm', [join(dir, 'x3.wav')]);
  const x3pcm = pcmOf(x3.bytes), m = pcmOf(master.bytes); let x3Exact = true;
  for (let i = 0; i < x3pcm.length; i++) if (x3pcm[i] !== m[i % m.length]) { x3Exact = false; break; }
  const result = {
    id: v.id, condition: v.condition, title: score.title, schema: authored.schema, scoreFile: `studio-001/scores/hook10/${v.file}`, scoreSha256: sha256(readFileSync(join(here, v.file))),
    bpm: score.bpm, key: score.key.label, bars: score.bars, notes: Object.fromEntries(score.parts.map(pt => [pt.id, pt.perf.notes.length])),
    master: { file: `${name}.wav`, frames: seam.frames, seconds: seam.frames / 44100, sampleRate: 44100, bits: 16, channels: 2, gainDb: +db(gain).toFixed(3), loudness: measured, loudnessLoopX3: measuredX3, clipped: master.clipped },
    loop: {
      method: 'tail fold: y[n] = x[n] + x[n + 441000]; no crossfade', renderFrames: x[0].length, tailFrames, foldMaxAbsError: foldError,
      renderTailEndRmsDb: +tailEndDb.toFixed(1), bodyRmsDb: +bodyDb.toFixed(1), tailFullyDecayed: tailEndDb < bodyDb - 80,
      seamResidueLsb: { renderFirstSample: Math.round(edge(0) * gain * 32767), renderLastSample: Math.round(edge(x[0].length - 1) * gain * 32767) },
      loopX3IsThreeExactCopies: x3Exact, seam,
    },
    stems, ...(gate ? { gate } : {}),
    technicalGate: { frames441000: seam.frames === LOOP_FRAMES, noClipping: master.clipped === 0, truePeakAtMostMinus1: measured.truePeakDb <= CEILING_DBTP, seamContinuous: seam.pass && Math.round(edge(0) * gain * 32767) === 0 && Math.round(edge(x[0].length - 1) * gain * 32767) === 0, tailFullyDecayed: tailEndDb < bodyDb - 80,
      foldExact: foldError === 0, loopX3IsThreeExactCopies: x3Exact },
    files,
  };
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const [outArg, ...only] = process.argv.slice(2);
  if (!outArg) throw new Error('usage: node studio-001/scores/hook10/build.ts NEW_DIR [id ...]');
  const out = resolve(outArg);
  if (existsSync(out)) throw new Error(`refusing to write into an existing path: ${out}`);
  if (!ffmpegVersion()) throw new Error('FFmpeg with libmp3lame is required');
  mkdirSync(out, { recursive: true });
  const versions = [];
  for (const v of VERSIONS) {
    if ((only.length && !only.includes(v.id)) || !existsSync(join(here, v.file))) continue;
    console.error(`== ${v.id}`);
    versions.push(await buildVersion(v, out, s => console.error(`  ${s}`)));
  }
  const manifest = {
    schema: 'daemonv12.hook10.manifest/1', benchmark: 'HOOK//10', note: 'Plain measurements and symbolic structure checks. Nothing here says which version sounds better: that verdict is a human listening test.',
    targetLufs: TARGET_LUFS, ceilingDbtp: CEILING_DBTP, loopFrames: LOOP_FRAMES, node: process.version, ffmpeg: ffmpegVersion(), versions,
  };
  writeFileSync(join(out, 'MANIFEST.json'), json(manifest));
  const sums = versions.flatMap(v => Object.entries(v.files).map(([f, d]) => `${d.sha256}  ${f}`)).sort((a, b) => a.slice(66).localeCompare(b.slice(66)));
  writeFileSync(join(out, 'SHA256SUMS'), sums.join('\n') + '\n');
  for (const v of versions) console.log(`${v.id.padEnd(3)} ${v.master.loudness.lufs} LUFS  ${v.master.loudness.truePeakDb} dBTP  seam step ${v.loop.seam.seamStepLsb} LSB (p99 inside ${v.loop.seam.insideStepLsb.p99})  technical ${Object.values(v.technicalGate).every(Boolean) ? 'PASS' : 'FAIL'}${v.gate ? `  motif gate ${v.gate.pass ? 'PASS' : 'FAIL'}` : ''}`);
}
