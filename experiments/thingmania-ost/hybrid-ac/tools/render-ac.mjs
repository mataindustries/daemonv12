#!/usr/bin/env node
// Validates, renders and checks the two hybrid auditions with the DaemonV12 CLI, renders the
// original SOCK SLIDE (and LOW BATTERY CHOIR) as untouched references, and writes the shareable
// results next to the projects:
//   previews/<slug>.mp3, previews/<slug>-x4.mp3      listening copies (x4 = loop four times)
//   loops/<slug>-loop-seamless.wav                   sample-exact seamless game loop
//   analysis/<slug>.{render,analysis}.json, <slug>-x4.*, <slug>.checks.json, comparison.json
// Masters, stems and repeat renders stay in the git-ignored renders/ directory.
//
//   node experiments/thingmania-ost/hybrid-ac/tools/render-ac.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWav, bandShares } from '../../tools/inspect-palette.mjs';
import { noteFreq } from '../../tools/dsp.mjs';
import * as A from './analysis-ac.mjs';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
const OST = join(HERE, '..');
const REPO = join(OST, '..', '..');
const CLI = join(REPO, 'bin', 'daemonv12.js');
const FFMPEG = process.env.DAEMONV12_FFMPEG || 'ffmpeg';
const RENDERS = join(HERE, 'renders');
const SR = 44100, BEAT = 0.565625, BAR = 4 * BEAT;

const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const rel = (p) => p.replace(REPO + '/', '');
const r = (x, d = 2) => (Number.isFinite(x) ? Number(x.toFixed(d)) : null);
const swingTicks = (s) => Math.floor(s / 4) * 960 + [0, 272, 480, 752][s % 4];
const at = (bar, step, ms = 0) => (bar - 1) * BAR + swingTicks(step) / 960 * BEAT + ms / 1000;

function daemon(args) {
  const out = execFileSync(process.execPath, [CLI, ...args, '--json'], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 });
  const j = JSON.parse(out);
  if (!j.ok) throw new Error(`${args.join(' ')}: ${JSON.stringify(j.errors)}`);
  return j;
}

// EBU R128 via FFmpeg: integrated loudness, and the 90th percentile of momentary loudness
// (how loud a part is while it plays, which integrated loudness hides for sparse parts).
const MONO = 'pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1';
const PHONE = `highpass=f=300:poles=2,highpass=f=300:poles=2,${MONO}`;
function loud(wav, filter) {
  const res = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-v', 'verbose', '-i', wav, '-af', `${filter ? filter + ',' : ''}ebur128=framelog=verbose`, '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (res.status !== 0) throw new Error(res.stderr);
  const m = /Integrated loudness:\s+I:\s+(-?[\d.]+|-inf) LUFS/.exec(res.stderr);
  const mom = [...res.stderr.matchAll(/ M:\s*(-?[\d.]+)/g)].map((x) => Number(x[1])).filter((x) => x > -60).sort((a, b) => a - b);
  return { integrated: m && m[1] !== '-inf' ? Number(m[1]) : null, p90Momentary: mom.length ? mom[Math.floor(mom.length * 0.9)] : null };
}

function width([L, R]) {
  let ll = 0, rr = 0, lr = 0, mid = 0, side = 0;
  for (let i = 0; i < L.length; i++) { ll += L[i] ** 2; rr += R[i] ** 2; lr += L[i] * R[i]; mid += ((L[i] + R[i]) / 2) ** 2; side += ((L[i] - R[i]) / 2) ** 2; }
  return { correlation: r(lr / Math.sqrt(ll * rr || 1), 3), sideEnergyFraction: r(side / (mid + side), 4) };
}
// Whole mix, and the musical layers above 300 Hz (bass and kick are centered by design).
const stereo = (ch) => ({ ...width(ch), above300Hz: width(ch.map(A.above300)) });

// The seamless loop is cycle 2 of the x4 render, cut on exact frames. Because every cycle starts
// on an integer frame (8 bars = 798,210 frames), cycle 2 already contains cycle 1's tails; if
// cycles 2 and 3 are bit-identical, looping the crop is exactly continuous playback.
function seamless(x4Wav, N, outPath) {
  const b = readFileSync(x4Wav);
  if (b.toString('ascii', 36, 40) !== 'data') throw new Error('unexpected WAV layout');
  const frameBytes = b.readUInt16LE(32), body = (k) => b.subarray(44 + k * N * frameBytes, 44 + (k + 1) * N * frameBytes);
  const c2 = body(1), c3 = body(2);
  const out = Buffer.alloc(44 + c2.length);
  b.copy(out, 0, 0, 44); out.writeUInt32LE(36 + c2.length, 4); out.writeUInt32LE(c2.length, 40); c2.copy(out, 44);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, out);
  return { cycle2EqualsCycle3: c2.equals(c3), bytes: out.length };
}

function loopEvidence(x4, exact, N) {
  const cyc = (k, c) => x4[c].subarray(k * N, (k + 1) * N), steady = [cyc(1, 0), cyc(1, 1)];
  const win = Math.round(0.5 * SR);
  let headDiff = 0, headSig = 0;
  for (let c = 0; c < 2; c++) for (let i = 0; i < win; i++) { headDiff += (exact[c][i] - steady[c][i]) ** 2; headSig += steady[c][i] ** 2; }
  const jump = (ch) => Math.max(...ch.map((x) => Math.abs(x[x.length - 1] - x[0])));
  let steps = 0;
  for (let c = 0; c < 2; c++) for (let i = 1; i < N; i++) steps += Math.abs(steady[c][i] - steady[c][i - 1]);
  return {
    seamlessWrapJump: r(jump(steady), 5), meanAdjacentStep: r(steps / (2 * (N - 1)), 5),
    continuousMaxStepNearSameBoundary: r(Math.max(...x4.flatMap((x) => [-1, 0, 1, 2].map((o) => Math.abs(x[2 * N + o] - x[2 * N + o - 1])))), 5),
    naiveExactLoopWrapJump: r(jump(exact), 5), naiveExactLoopFirst500msMissingTailDb: r(10 * Math.log10(headDiff / headSig)),
  };
}

// Render one project (loop with stems, repeat, x4) and gather everything both hybrids and the
// reference get measured on.
function study(dir, slug, { bars, repeat = true, probes = [] }) {
  const src = join(dir), out = join(RENDERS, slug);
  rmSync(out, { recursive: true, force: true });
  const proj = join(src, `${slug}.json`), projX4 = join(src, `${slug}-x4.json`);
  const validation = [proj, projX4].map((p) => { const v = daemon(['validate', p]); return { project: rel(p), ok: v.ok, warnings: (v.warnings ?? []).map((w) => w.code) }; });
  const loop = daemon(['render', proj, '--out-dir', join(out, 'loop'), '--stems', '--format', 'wav,mp3']);
  const again = repeat ? daemon(['render', proj, '--out-dir', join(out, 'loop-repeat'), '--stems', '--format', 'wav']) : null;
  const x4 = daemon(['render', projX4, '--out-dir', join(out, 'x4'), '--format', 'wav,mp3']);
  const wav = resolve(REPO, loop.artifacts.wav), x4wav = resolve(REPO, x4.artifacts.wav);
  const manifest = JSON.parse(readFileSync(resolve(REPO, loop.artifacts.manifest), 'utf8'));
  const project = JSON.parse(readFileSync(proj, 'utf8'));

  const exact = readWav(wav), xs = readWav(x4wav), N = exact[0].length;
  const loopPath = join(out, `${slug}-loop-seamless.wav`);
  const crop = seamless(x4wav, N, loopPath);
  const seamlessCh = readWav(loopPath), seamlessMono = A.toMono(seamlessCh);

  const stems = Object.fromEntries(loop.artifacts.stems.map((s) => [s.trackId, resolve(REPO, s.wav)]));
  const stemMono = Object.fromEntries(Object.entries(stems).map(([id, p]) => [id, A.toMono(readWav(p))]));
  const frames = Object.fromEntries(Object.entries(stemMono).map(([id, x]) => [id, A.bandFrames(x)]));
  const voices = ['voice', 'kettle', 'choir'].filter((id) => frames[id]);
  const whistles = Object.keys(frames).filter((id) => id.startsWith('whistle'));

  const full = loud(wav), mono = loud(wav, MONO), phone = loud(wav, PHONE);
  const stemLoud = Object.fromEntries(Object.entries(stems).map(([id, p]) => {
    const f = loud(p), ph = loud(p, PHONE);
    return [id, { integratedLufs: f.integrated, p90MomentaryLufs: f.p90Momentary, phoneIntegratedLufs: ph.integrated, phoneP90MomentaryLufs: ph.p90Momentary }];
  }));
  const comp = project.master.effects.find((e) => e.type === 'compressor');
  const stageClips = (manifest.production?.tracks ?? []).map((t) => ({ trackId: t.trackId, clippedSamples: t.clippedSamples, preClipPeakDbfs: t.preClipPeakDbfs }));

  const barSec = BAR, secFile = join(out, 'sections.json');
  writeFileSync(secFile, JSON.stringify({ sections: Array.from({ length: bars }, (_, b) => ({ name: `bar${b + 1}`, start: Math.floor(b * barSec * 1e6) / 1e6, end: Math.floor((b + 1) * barSec * 1e6) / 1e6 })) }));
  const sections = JSON.parse(execFileSync(process.execPath, [join(REPO, 'plugins/daemonv12-composer/skills/daemonv12-composer/scripts/review-sections.mjs'), loopPath, secFile], { encoding: 'utf8' }));

  const probeResults = probes.map((p) => {
    const x = stemMono[p.stem];
    if (p.tones) return { label: p.label, stem: p.stem, tonesDb: p.tones.map(([name, t]) => ({ at: name, seconds: r(t, 4),
      ...Object.fromEntries(p.notes.map((n) => [n, A.toneDb(x, t, noteFreq(n))])) })) };
    return { label: p.label, stem: p.stem, reference: p.ref, points: p.times.map((t) => A.probe(x, t, { lo: p.lo, hi: p.hi, ref: noteFreq(p.ref), win: p.win })) };
  });

  return {
    slug, project: rel(proj), x4Project: rel(projX4), engineVersion: loop.engineVersion, validation,
    duration: { frames: N, seconds: r(N / SR, 6), bars, bpm: loop.summary.bpm, timeSignature: loop.summary.timeSignature,
      expectedFrames: Math.round(loop.summary.durationSeconds * SR), x4Frames: xs[0].length },
    clipping: { masterFullScaleSamples: loop.analysis.master.fullScaleSamples, masterClipping: loop.analysis.master.clipping,
      peakDbfs: loop.analysis.master.peakDbfs, truePeakDbfs: loop.analysis.master.truePeakDbfs, x4TruePeakDbfs: x4.analysis.master.truePeakDbfs,
      x4FullScaleSamples: x4.analysis.master.fullScaleSamples, warnings: loop.warnings.map((w) => w.code), mixClippedSamples: manifest.mix?.clippedSamples ?? null,
      trackStages: stageClips },
    loudness: { integratedLufs: full.integrated, loudnessRangeLu: loop.analysis.master.loudnessRangeLu, p90MomentaryLufs: full.p90Momentary,
      x4IntegratedLufs: x4.analysis.master.integratedLufs },
    stereo: { ...stereo(exact), monoFoldLufs: mono.integrated, monoFoldChangeLu: r(mono.integrated - full.integrated, 2) },
    phoneProxy: { method: 'two 2-pole high-passes at 300 Hz, then mono fold', lufs: phone.integrated, changeLu: r(phone.integrated - full.integrated, 2),
      masterBandShares: bandShares(A.toMono(exact)) },
    stems: stemLoud,
    separation: {
      method: 'per 2048-sample frame and third-octave band (100 Hz-12.5 kHz) on mono stems; a part is active within 30 dB (conflict: 25 dB) of its loudest frame',
      whistleUnmasked: A.maskingReport(frames, whistles),
      appliancesUnmasked: voices.length ? A.maskingReport(frames, voices) : null,
      bassUnmasked: A.maskingReport(frames, ['bass', 'bass-grit']),
      whistleVsAppliances: voices.length ? A.conflictReport(frames, whistles, voices) : null,
      centroidHz: Object.fromEntries(Object.entries(frames).map(([id, f]) => [id, A.centroid(f)])),
    },
    masterCompressor: A.compressorActivity(A.toMono(exact), Object.values(stemMono), project.master.gainDb ?? 0, comp?.makeupGainDb ?? 0),
    loop: { ...loopEvidence(xs, exact, N), cycle2VsCycle3BitIdentical: crop.cycle2EqualsCycle3, seamlessWav: rel(loopPath) },
    variety: A.barVariety(seamlessMono, bars, BAR * SR, Array.from({ length: 16 }, (_, s) => swingTicks(s) / 960 * BEAT * SR)),
    determinism: again ? { master: sha(wav) === sha(resolve(REPO, again.artifacts.wav)),
      stems: loop.artifacts.stems.every((s, i) => sha(resolve(REPO, s.wav)) === sha(resolve(REPO, again.artifacts.stems[i].wav))) } : null,
    probes: probeResults,
    sections: sections.sections ?? sections,
    hashes: { masterWav: sha(wav), seamlessLoopWav: sha(loopPath), x4Wav: sha(x4wav), x4Mp3: sha(resolve(REPO, x4.artifacts.mp3)), project: sha(proj), x4Project: sha(projX4) },
    _files: { loop, x4, loopPath, manifest },
  };
}

// ---------- pitch probes: does each gesture happen where the score says? ----------
const ms = (bar, step, list) => list.map((m) => at(bar, step, m));
const PROBES = {
  'ac-01-groove-first': [
    { label: 'bar 3: DEE (A#4) rides the bass bend up to B', stem: 'voice', ref: 'A#4', lo: 380, hi: 600, win: 0.03, times: ms(3, 12, [5, 30, 60, 120]) },
    { label: 'bar 3: bass Bb1 -> B1 bend under it', stem: 'bass', ref: 'Bb1', lo: 45, hi: 80, win: 0.05, times: ms(3, 12, [0, 30, 60, 120]) },
    { label: 'bar 4: the whistle borrows the bend (A#5 -> B5)', stem: 'whistle', ref: 'A#5', lo: 800, hi: 1150, win: 0.03, times: ms(4, 8, [10, 60, 160, 300]) },
    { label: 'bar 5: kettle F4 -> F#4 a fourth under the DEE', stem: 'kettle', ref: 'F4', lo: 290, hi: 450, win: 0.03, times: ms(5, 12, [8, 120]) },
    { label: 'bar 6: tag at double speed into the hole (E4 G4 A#4 B4)', stem: 'voice', ref: 'E4', lo: 280, hi: 560, win: 0.03, times: [at(6, 8, 40), at(6, 9, 40), at(6, 10, 60), at(6, 12, 80)] },
    { label: 'bar 8: choir slip chord holds, then sags one semitone (G4 C5 D5 -> F#4 B4 C#5)', stem: 'choir',
      notes: ['G4', 'C5', 'D5', 'F#4', 'B4', 'C#5'], tones: [['hold', at(8, 9)], ['sag midpoint', at(8, 12, 250)], ['downbeat arrival', at(8, 15, 0)]] },
    { label: 'bar 8: bass F1 slides home to E1', stem: 'bass', ref: 'F1', lo: 36, hi: 50, win: 0.06, times: ms(8, 14, [5, 160]) },
  ],
  'ac-02-appliances-take-over': [
    { label: 'bar 3: DEE (A#4) held straight while the bass bends', stem: 'voice', ref: 'A#4', lo: 380, hi: 600, win: 0.03, times: ms(3, 12, [10, 120]) },
    { label: 'bars 5-6: 2+2+3 chant, E minor then the Lydian shape on A', stem: 'voice', ref: 'E4', lo: 280, hi: 720, win: 0.03,
      times: [at(5, 0, 50), at(5, 2, 50), at(5, 4, 50), at(5, 6, 50), at(5, 8, 150), at(5, 14, 50), at(6, 0, 50), at(6, 2, 50), at(6, 4, 50), at(6, 6, 150)] },
    { label: 'bar 7: breakdown tag, DEE bent with the bass', stem: 'voice', ref: 'A#4', lo: 380, hi: 600, win: 0.03, times: ms(7, 12, [5, 120]) },
    { label: 'bar 8: power failure, bass F1 sags 3 semitones', stem: 'bass', ref: 'F1', lo: 30, hi: 55, win: 0.08, times: ms(8, 8, [40, 300, 600, 800]) },
    { label: 'bar 8: power failure, lead D5 sags with it', stem: 'voice', ref: 'D5', lo: 430, hi: 650, win: 0.04, times: ms(8, 8, [60, 300, 600, 790]) },
    { label: 'bar 8: choir slip chord sags 3 semitones (G4 C5 D5 -> E4 A4 B4)', stem: 'choir',
      notes: ['G4', 'C5', 'D5', 'E4', 'A4', 'B4'], tones: [['onset', at(8, 8, 60)], ['end of sag', at(8, 13, 0)]] },
  ],
};

const summary = {};
// References: the original A and C, rendered from their untouched projects.
const ref = study(join(OST, 'a-sock-slide'), 'sock-slide', { bars: 4, repeat: false });
const refC = daemon(['render', join(OST, 'c-low-battery-choir', 'low-battery-choir.json'), '--out-dir', join(RENDERS, 'low-battery-choir'), '--format', 'wav']);
const recorded = (dir) => JSON.parse(readFileSync(join(OST, dir, 'analysis', 'checks.json'), 'utf8')).hashes.masterWav;
const git = (args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim();
const ORIGINALS = ['a-sock-slide', 'b-fridge-light', 'c-low-battery-choir', 'tools', 'README.md', '.gitignore'].map((p) => `experiments/thingmania-ost/${p}`);
const originals = {
  gitChangesUnderOriginals: git(['status', '--porcelain', '--', ...ORIGINALS]) || 'none',
  aMasterRerenderMatchesRecorded: ref.hashes.masterWav === recorded('a-sock-slide'),
  cMasterRerenderMatchesRecorded: sha(resolve(REPO, refC.artifacts.wav)) === recorded('c-low-battery-choir'),
  aMasterWav: ref.hashes.masterWav, cMasterWav: sha(resolve(REPO, refC.artifacts.wav)),
};

const keep = join(HERE, 'analysis'), prev = join(HERE, 'previews'), loops = join(HERE, 'loops');
for (const d of [keep, prev, loops]) mkdirSync(d, { recursive: true });
const results = {};
for (const slug of Object.keys(PROBES)) {
  const res = study(HERE, slug, { bars: 8, probes: PROBES[slug] });
  const { loop, x4, loopPath } = res._files;
  delete res._files;
  copyFileSync(resolve(REPO, loop.artifacts.mp3), join(prev, `${slug}.mp3`));
  copyFileSync(resolve(REPO, x4.artifacts.mp3), join(prev, `${slug}-x4.mp3`));
  copyFileSync(loopPath, join(loops, `${slug}-loop-seamless.wav`));
  res.loop.seamlessWav = rel(join(loops, `${slug}-loop-seamless.wav`));
  for (const [from, to] of [[loop.artifacts.manifest, `${slug}.render.json`], [loop.artifacts.analysis, `${slug}.analysis.json`],
    [x4.artifacts.manifest, `${slug}-x4.render.json`], [x4.artifacts.analysis, `${slug}-x4.analysis.json`]]) copyFileSync(resolve(REPO, from), join(keep, to));
  writeFileSync(join(keep, `${slug}.checks.json`), JSON.stringify(res, null, 1) + '\n');
  results[slug] = res;
}
delete ref._files;

// The foundation really is SOCK SLIDE: bars 1-2 of the bass, kick and snare stems compared with
// the original's stems (a margin of 1,500 frames before bar 3, where the arrangements diverge).
const foundation = {};
for (const slug of Object.keys(PROBES)) {
  const n = Math.round(2 * BAR * SR) - 1500;
  foundation[slug] = Object.fromEntries(['bass', 'kick', 'snare'].map((id) => {
    const a = readWav(join(RENDERS, 'sock-slide', 'loop', 'sock-slide.stems', `${id}.wav`)), b = readWav(join(RENDERS, slug, 'loop', `${slug}.stems`, `${id}.wav`));
    let max = 0;
    for (let c = 0; c < 2; c++) for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(a[c][i] - b[c][i]));
    return [id, { bars1to2MaxAbsDiffVsSockSlide: max, bitIdentical: max === 0 }];
  }));
}

// Side-by-side with the original SOCK SLIDE.
const row = (x) => ({
  loopSeconds: x.duration.seconds, bars: x.duration.bars, integratedLufs: x.loudness.integratedLufs, truePeakDbtp: x.clipping.truePeakDbfs,
  fullScaleSamples: x.clipping.masterFullScaleSamples, correlation: x.stereo.correlation, sideEnergyFraction: x.stereo.sideEnergyFraction,
  monoFoldChangeLu: x.stereo.monoFoldChangeLu, above300Hz: x.stereo.above300Hz, phoneChangeLu: x.phoneProxy.changeLu,
  p90MomentaryLufs: Object.fromEntries(['bass', 'bass-grit', 'whistle', 'whistle-dry', 'voice', 'kettle', 'choir', 'kick', 'snare', 'drum-crunch'].filter((id) => x.stems[id]).map((id) => [id, [x.stems[id].p90MomentaryLufs, x.stems[id].phoneP90MomentaryLufs]])),
  whistleUnmaskedShare: x.separation.whistleUnmasked?.unmaskedShare, appliancesUnmaskedShare: x.separation.appliancesUnmasked?.unmaskedShare ?? null,
  bassUnmaskedShare: x.separation.bassUnmasked?.unmaskedShare, whistleVsAppliances: x.separation.whistleVsAppliances,
  compressorGainReductionDb: x.masterCompressor.gainReductionDb, distinctBars: x.variety.distinctBars, meanBarCorrelation: x.variety.meanPairCorrelation,
  cycle2VsCycle3BitIdentical: x.loop.cycle2VsCycle3BitIdentical, seamlessWrapJump: x.loop.seamlessWrapJump, continuousStepSameBoundary: x.loop.continuousMaxStepNearSameBoundary,
});
const comparison = {
  note: 'Objective measurements only. p90MomentaryLufs pairs are [full range, phone proxy]. No listening was possible for the agent that produced this.',
  originals,
  foundation,
  'A sock-slide (reference)': row(ref),
  ...Object.fromEntries(Object.entries(results).map(([slug, x]) => [slug, row(x)])),
};
writeFileSync(join(keep, 'comparison.json'), JSON.stringify(comparison, null, 1) + '\n');
writeFileSync(join(keep, 'reference-sock-slide.checks.json'), JSON.stringify(ref, null, 1) + '\n');
console.log(JSON.stringify(comparison, null, 1));
