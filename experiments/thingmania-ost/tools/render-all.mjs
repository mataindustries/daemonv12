#!/usr/bin/env node
// Renders and checks the auditions with the DaemonV12 CLI, then copies the small,
// shareable results (MP3 previews, manifests, analysis, checks) next to each project.
// Large masters (WAV, stems, seamless loop) stay in the git-ignored renders/ directory.
//
//   node experiments/thingmania-ost/tools/render-all.mjs [audition-dir ...]
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWav, bandShares } from './inspect-palette.mjs';
import { encodeWav } from './dsp.mjs';

const EXP = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(EXP, '..', '..');
const CLI = join(REPO, 'bin', 'daemonv12.js');
const FFMPEG = process.env.DAEMONV12_FFMPEG || 'ffmpeg';
const AUDITIONS = { 'a-sock-slide': 'sock-slide', 'b-fridge-light': 'fridge-light', 'c-low-battery-choir': 'low-battery-choir' };

const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const db = (x) => (x > 0 ? Number((10 * Math.log10(x)).toFixed(2)) : null);

function daemon(args) {
  const out = execFileSync(process.execPath, [CLI, ...args, '--json'], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 });
  const j = JSON.parse(out);
  if (!j.ok) throw new Error(`${args.join(' ')}: ${JSON.stringify(j.errors)}`);
  return j;
}

// Integrated loudness (EBU R128) of an ffmpeg-filtered version of a WAV.
function measure(wav, filter) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', wav, '-af', `${filter ? filter + ',' : ''}ebur128`, '-f', 'null', '-'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  const m = /Integrated loudness:\s+I:\s+(-?[\d.]+|-inf) LUFS/.exec(r.stderr);
  return m && m[1] !== '-inf' ? Number(m[1]) : null;
}
const MONO = 'pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1';
// Phone-speaker proxy: no bass below ~300 Hz (4th-order high-pass) and summed to mono.
const PHONE = `highpass=f=300:poles=2,highpass=f=300:poles=2,${MONO}`;

function stereoStats([L, R]) {
  let ll = 0, rr = 0, lr = 0, mm = 0;
  for (let i = 0; i < L.length; i++) { ll += L[i] ** 2; rr += R[i] ** 2; lr += L[i] * R[i]; mm += ((L[i] + R[i]) / 2) ** 2; }
  return { correlation: Number((lr / Math.sqrt(ll * rr || 1)).toFixed(3)), monoFoldEnergyDb: db(mm / ((ll + rr) / 2 || 1)) };
}

// Difference energy below ~300 Hz (three one-pole lowpasses): separates sub-frame onset
// jitter, which is mostly high-frequency, from real musical differences between cycles.
function lowDiff(a, b) {
  const k = Math.exp(-2 * Math.PI * 300 / 44100);
  let y1 = 0, y2 = 0, y3 = 0, z1 = 0, z2 = 0, z3 = 0, d = 0, s = 0;
  for (let i = 0; i < a.length; i++) {
    y1 = (1 - k) * a[i] + k * y1; y2 = (1 - k) * y1 + k * y2; y3 = (1 - k) * y2 + k * y3;
    z1 = (1 - k) * b[i] + k * z1; z2 = (1 - k) * z1 + k * z2; z3 = (1 - k) * z2 + k * z3;
    d += (y3 - z3) ** 2; s += y3 ** 2;
  }
  return db(d / s);
}

// Loop evidence from the x4 render: cycles 2 and 3 should be the same audio if the loop is
// time-invariant (tails from the previous cycle included). Cycle 2 is then a seamless loop.
function loopEvidence(x4, exact, N) {
  const cyc = (k, c) => x4[c].subarray(k * N, (k + 1) * N);
  let maxDiff = 0, diffE = 0, sigE = 0;
  for (let c = 0; c < 2; c++) {
    const a = cyc(1, c), b = cyc(2, c);
    for (let i = 0; i < N; i++) { const d = a[i] - b[i]; maxDiff = Math.max(maxDiff, Math.abs(d)); diffE += d * d; sigE += a[i] * a[i]; }
  }
  // Exact (cold) render vs. steady state: what a naive loop of the 4-bar file loses.
  const steady = [cyc(1, 0), cyc(1, 1)];
  const win = Math.round(0.5 * 44100);
  let headDiff = 0, headSig = 0;
  for (let c = 0; c < 2; c++) for (let i = 0; i < win; i++) { headDiff += (exact[c][i] - steady[c][i]) ** 2; headSig += steady[c][i] ** 2; }
  // Wrap discontinuity: jump from last to first frame, versus typical adjacent-frame steps.
  const jump = (ch) => Math.max(...ch.map((x) => Math.abs(x[x.length - 1] - x[0])));
  let steps = 0;
  for (let c = 0; c < 2; c++) for (let i = 1; i < N; i++) steps += Math.abs(steady[c][i] - steady[c][i - 1]);
  const meanStep = steps / (2 * (N - 1));
  return {
    cycle2VsCycle3: { maxAbsDiff: Number(maxDiff.toFixed(6)), diffToSignalDb: db(diffE / sigE), identical: maxDiff === 0,
      below300HzDiffToSignalDb: lowDiff(cyc(1, 0), cyc(2, 0)) },
    naiveExactLoop: { wrapJump: Number(jump(exact).toFixed(5)), meanAdjacentStep: Number(meanStep.toFixed(5)),
      first500msMissingTailDb: db(headDiff / headSig) },
    // The same musical boundary heard continuously inside the x4 render (cycle 2 -> 3).
    seamlessLoop: { wrapJump: Number(jump(steady).toFixed(5)), meanAdjacentStep: Number(meanStep.toFixed(5)),
      continuousMaxStepNearSameBoundary: Number(Math.max(...x4.flatMap((x) => [-1, 0, 1, 2].map((o) => Math.abs(x[2 * N + o] - x[2 * N + o - 1])))).toFixed(5)) },
    framesPerCycleExact: null,
    steady,
  };
}

const only = process.argv.slice(2);
const summary = [];
for (const [dir, slug] of Object.entries(AUDITIONS)) {
  if (only.length && !only.includes(dir)) continue;
  const src = join(EXP, dir), out = join(EXP, 'renders', dir);
  rmSync(out, { recursive: true, force: true });
  const proj = join(src, `${slug}.json`), projX4 = join(src, `${slug}-x4.json`);

  const loop = daemon(['render', proj, '--out-dir', join(out, 'loop'), '--stems', '--format', 'wav,mp3']);
  const again = daemon(['render', proj, '--out-dir', join(out, 'loop-repeat'), '--stems', '--format', 'wav']);
  const x4 = daemon(['render', projX4, '--out-dir', join(out, 'x4'), '--format', 'wav,mp3']);

  const wav = resolve(REPO, loop.artifacts.wav), x4wav = resolve(REPO, x4.artifacts.wav);
  const manifest = JSON.parse(readFileSync(resolve(REPO, loop.artifacts.manifest), 'utf8'));
  const repeat = { master: sha(wav) === sha(resolve(REPO, again.artifacts.wav)),
    stems: loop.artifacts.stems.every((s, i) => sha(resolve(REPO, s.wav)) === sha(resolve(REPO, again.artifacts.stems[i].wav))) };

  const exact = readWav(wav), xs = readWav(x4wav);
  const N = exact[0].length;
  const ev = loopEvidence(xs, exact, N);
  // Cycles start on rounded frames, so onsets can land +/-1 frame apart between cycles.
  ev.framesPerCycleExact = Number((loop.summary.durationTicks * Math.round(60e6 / loop.summary.bpm) * 44100 / 960e6).toFixed(4));
  const seamless = join(out, `${slug}-loop-seamless.wav`);
  writeFileSync(seamless, encodeWav(ev.steady.map((c) => Float64Array.from(c, (v) => v * 32768 / 32767))));
  delete ev.steady;

  // Bar-by-bar section evidence from the composer plugin's read-only helper.
  const barSec = N / 4 / 44100;
  const secFile = join(out, 'sections.json');
  writeFileSync(secFile, JSON.stringify({ sections: [1, 2, 3, 4].map((b) => ({ name: `bar${b}`, start: Math.floor((b - 1) * barSec * 1e6) / 1e6, end: Math.floor(b * barSec * 1e6) / 1e6 })) }));
  const sections = JSON.parse(execFileSync(process.execPath, [join(REPO, 'plugins/daemonv12-composer/skills/daemonv12-composer/scripts/review-sections.mjs'), seamless, secFile], { encoding: 'utf8' }));

  const full = measure(wav), mono = measure(wav, MONO), phone = measure(wav, PHONE);
  const stems = loop.artifacts.stems.map((s) => {
    const p = resolve(REPO, s.wav);
    return { trackId: s.trackId, lufs: measure(p), phoneProxyLufs: measure(p, PHONE) };
  });
  const tracks = manifest.tracks ?? [];
  const checks = {
    audition: dir, project: `${slug}.json`, engineVersion: loop.engineVersion,
    duration: { frames: N, seconds: Number((N / 44100).toFixed(6)), bars: 4, bpm: loop.summary.bpm, timeSignature: loop.summary.timeSignature,
      expectedFrames: Math.round(loop.summary.durationSeconds * 44100), x4Frames: xs[0].length },
    clipping: { masterFullScaleSamples: loop.analysis.master.fullScaleSamples, masterClipping: loop.analysis.master.clipping,
      peakDbfs: loop.analysis.master.peakDbfs, truePeakDbfs: loop.analysis.master.truePeakDbfs,
      warnings: loop.warnings.map((w) => w.code), stagePreClipPeaks: JSON.stringify(manifest).match(/"preClipPeakDbfs":-?[\d.]+/g)?.length ?? 0 },
    loudness: { integratedLufs: loop.analysis.master.integratedLufs, loudnessRangeLu: loop.analysis.master.loudnessRangeLu, x4IntegratedLufs: x4.analysis.master.integratedLufs },
    mono: { ...stereoStats(exact), monoFoldLufs: mono, stereoLufs: full, monoFoldChangeLu: mono !== null && full !== null ? Number((mono - full).toFixed(2)) : null },
    phoneProxy: { method: 'two 2-pole high-passes at 300 Hz, then mono fold', lufs: phone, changeLu: phone !== null && full !== null ? Number((phone - full).toFixed(2)) : null,
      masterBandShares: bandShares(exact[0].map((v, i) => (v + exact[1][i]) / 2)), stems },
    loop: ev,
    determinism: { secondRenderIdentical: repeat },
    sections: sections.sections ?? sections,
    hashes: { masterWav: sha(wav), seamlessLoopWav: sha(seamless), x4Wav: sha(x4wav), project: sha(proj), x4Project: sha(projX4) },
  };

  const keep = join(src, 'analysis'), prev = join(src, 'previews');
  mkdirSync(keep, { recursive: true }); mkdirSync(prev, { recursive: true });
  copyFileSync(resolve(REPO, loop.artifacts.mp3), join(prev, `${slug}.mp3`));
  copyFileSync(resolve(REPO, x4.artifacts.mp3), join(prev, `${slug}-x4.mp3`));
  for (const [from, to] of [[loop.artifacts.manifest, `${slug}.render.json`], [loop.artifacts.analysis, `${slug}.analysis.json`],
    [x4.artifacts.manifest, `${slug}-x4.render.json`], [x4.artifacts.analysis, `${slug}-x4.analysis.json`]]) copyFileSync(resolve(REPO, from), join(keep, to));
  writeFileSync(join(keep, 'checks.json'), JSON.stringify(checks, null, 1) + '\n');
  summary.push({ dir, frames: N, lufs: checks.loudness.integratedLufs, tp: checks.clipping.truePeakDbfs, fullScale: checks.clipping.masterFullScaleSamples,
    warn: checks.clipping.warnings.join(',') || '-', corr: checks.mono.correlation, monoLu: checks.mono.monoFoldChangeLu, phoneLu: checks.phoneProxy.changeLu,
    cyc23: checks.loop.cycle2VsCycle3.diffToSignalDb, coldHeadDb: checks.loop.naiveExactLoop.first500msMissingTailDb, repeat: repeat.master && repeat.stems,
    stems: stems.map((s) => `${s.trackId} ${s.lufs}/${s.phoneProxyLufs}`).join(' | ') });
}
for (const s of summary) console.log(JSON.stringify(s));
