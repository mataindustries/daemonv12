/**
 * THE IMPOSSIBLE STAIRWELL · Opus 5.5 candidate · build, deliver and QA.
 *
 *   node production/infinite-stairwell/opus-55/build.ts NEW_OUTPUT_DIRECTORY
 *
 * Route (existing DaemonV12 v0.8 production tools only; no engine, rack or composition code is modified):
 *   1. score.json -> Signature Rack (frozen, hash-verified MUTATION 001 engines) -> native bounce: one PCM16 phrase
 *      per part for the single four-bar cycle plus its six-second tail, at the engine's own frames.
 *   2. stairwell.json: an ordinary DaemonV12 project with a hard 10.000-second container (render.duration 10 s,
 *      tail "none"). Each track triggers its phrase two times at bar 1: from the start, and with offsetSeconds 10 so
 *      the phrase's own tail (releases, halos, room) lies over the opening. This periodic fold is exact, so the
 *      wrap from frame 440,999 to frame 0 continues the rack take with no edit, crossfade or extra processing.
 *   3. packageProduction24 (scripts/headliner-production24.ts): Float64 processing and master sum, independent PCM24
 *      master and stems, MP3 encoded directly from the master, provenance and an exact-file-set SHA256SUMS.
 *   4. QA: exact frames, true peak, loudness, mono compatibility, loop-seam continuity, three-pass repeated playback,
 *      an independent fold reconstruction of the master from the PCM16 phrases,
 *      a fresh-process replay of the package and a fresh-process re-bounce of the rack.
 *
 * Refuses an existing output directory. Writes <out>/delivery (sealed package) and <out>/qa.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeScore, renderScore, mixdown, bouncePackage, verifyPackage as verifyRackPackage, containmentProblems } from '../../../studio-001/rack/index.ts';
import { beatFrame } from '../../../studio-001/rack/curves.ts';
import { packageProduction24 } from '../../../scripts/headliner-production24.ts';
import { compileProjectFile } from '../../../src/pipeline.ts';
import { readWavInfo } from '../../../src/render/wav.ts';
import { sha256, files, verifyPackage } from '../../headliner/build.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const SCORE = join(HERE, 'score.json');
const RATE = 44100, FRAMES = 441000, BPM = 96, FPS = 24;
const ffmpeg = process.env.DAEMONV12_FFMPEG || 'ffmpeg';
const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
const read = <T>(f: string): T => JSON.parse(readFileSync(f, 'utf8')) as T;
const rel = (p: string) => p.startsWith(ROOT + '/') ? p.slice(ROOT.length + 1) : p;
const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
const round = (x: number, d = 2) => (Number.isFinite(x) ? Number(x.toFixed(d)) : x);

function run(cmd: string, args: string[], timeout = 300000) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, timeout });
  assert.equal(r.status, 0, `${cmd} ${args.join(' ')}\n${r.stdout}\n${r.stderr}`);
  return r;
}
/** Read a PCM16/PCM24 stereo WAV into Float64 channels (full scale = 1). */
function readStereo(file: string, bits: 16 | 24) {
  const bytes = readFileSync(file), r = readWavInfo(bytes);
  assert.ok(r.ok, file);
  const { info } = r;
  assert.ok(info.formatTag === 1 || info.formatTag === 0xfffe, `${file}: integer PCM`); assert.equal(info.bitsPerSample, bits); assert.equal(info.channels, 2); assert.equal(info.sampleRate, RATE);
  const n = info.frames, L = new Float64Array(n), R = new Float64Array(n), w = bits / 8, scale = bits === 24 ? 8388608 : 32768;
  for (let i = 0; i < n; i++) {
    const o = info.dataOffset + i * 2 * w;
    L[i] = bytes.readIntLE(o, w) / scale; R[i] = bytes.readIntLE(o + w, w) / scale;
  }
  return { L, R, frames: n };
}
function ebur128(file: string, filter = '') {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', '-nostats', '-i', file, '-af', `${filter}ebur128=peak=true`, '-f', 'null', '-'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const sum = r.stderr.slice(r.stderr.lastIndexOf('Summary:')), num = (re: RegExp) => { const m = re.exec(sum); return m ? (m[1] === '-inf' ? -Infinity : Number(m[1])) : NaN; };
  // Momentary loudness trace (400 ms windows, every 100 ms) for the form and repeated-pass comparison.
  const momentary = [...r.stderr.matchAll(/t:\s*([\d.]+)\s+TARGET.*?M:\s*(-?[\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])] as [number, number]);
  return { integratedLufs: num(/I:\s+(-?[\d.]+|-inf) LUFS/), lraLu: num(/LRA:\s+(-?[\d.]+) LU/), truePeakDbtp: num(/Peak:\s+(-?[\d.]+|-inf) dBFS/), momentary };
}
const rmsDb = (chs: Float64Array[], a = 0, z = chs[0]!.length) => { let e = 0; for (const c of chs) for (let i = a; i < z; i++) e += c[i]! * c[i]!; return 10 * Math.log10(e / (chs.length * (z - a)) + 1e-30); };

/** Mono compatibility: correlation, fold-down level change, worst 100 ms correlation. */
function monoCompatibility(L: Float64Array, R: Float64Array) {
  const corr = (a: number, z: number) => { let lr = 0, ll = 0, rr = 0; for (let i = a; i < z; i++) { lr += L[i]! * R[i]!; ll += L[i]! ** 2; rr += R[i]! ** 2; } return ll && rr ? lr / Math.sqrt(ll * rr) : 1; };
  const win = RATE / 10, windows: number[] = [];
  for (let a = 0; a + win <= L.length; a += win) windows.push(corr(a, a + win));
  const M = L.map((v, i) => 0.5 * (v + R[i]!));
  const stereoPower = rmsDb([L, R]), monoPower = rmsDb([M]);
  return { correlation: round(corr(0, L.length), 3), worst100msCorrelation: round(Math.min(...windows), 3),
    windowsBelowZero: windows.filter(c => c < 0).length, monoFoldDownChangeDb: round(monoPower - stereoPower, 2) };
}
/**
 * Loop seam: (a) the jump from the last to the first sample against the file's own sample-to-sample motion;
 * (b) a high-pass click detector (second difference, 1 ms RMS windows) at the seams of three concatenated passes.
 */
function seam(L: Float64Array, R: Float64Array) {
  const n = L.length, steps: number[] = [];
  for (const c of [L, R]) for (let i = 1; i < n; i++) steps.push(Math.abs(c[i]! - c[i - 1]!));
  steps.sort((a, b) => a - b);
  const q = (p: number) => steps[Math.min(steps.length - 1, Math.floor(p * steps.length))]!;
  const jumps = [L, R].map(c => Math.abs(c[0]! - c[n - 1]!));
  const tripled = [L, R].map(c => { const t = new Float64Array(3 * n); for (let k = 0; k < 3; k++) t.set(c, k * n); return t; });
  const W = 44, energy: number[] = [];
  for (let a = 2; a + W <= 3 * n; a += W) { let e = 0; for (const t of tripled) for (let i = a; i < a + W; i++) { const d = t[i]! - 2 * t[i - 1]! + t[i - 2]!; e += d * d; } energy.push(e); }
  const sorted = [...energy].sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)]!, p999 = sorted[Math.floor(sorted.length * 0.999)]!;
  const at = (frame: number) => Math.max(...[-2, -1, 0, 1].map(k => energy[Math.floor((frame - 2) / W) + k] ?? 0));
  const seams = [n, 2 * n].map(f => round(10 * Math.log10(at(f) / median), 2));
  return { lastToFirstJump: { left: round(jumps[0]!, 6), right: round(jumps[1]!, 6) },
    sampleStepPercentile: { p50: round(q(0.5), 6), p99: round(q(0.99), 6), max: round(steps[steps.length - 1]!, 6) },
    jumpPercentileRank: round(Math.max(...jumps.map(j => { let lo = 0, hi = steps.length; while (lo < hi) { const m = (lo + hi) >> 1; if (steps[m]! < j) lo = m + 1; else hi = m; } return lo / steps.length; })), 4),
    highPassEnergyAtSeamsDbOverMedian: seams, highPassEnergy999thPercentileDbOverMedian: round(10 * Math.log10(p999 / median), 2) };
}

export async function build(output: string) {
  const out = resolve(output);
  assert.ok(!existsSync(out), 'choose a new output directory');
  mkdirSync(out, { recursive: true });
  const scratch = mkdtempSync(join(tmpdir(), 'stairwell-opus55-'));
  const log = (s: string) => console.error(s);
  try {
    // ----------------------------------------------------------------------------------------- 1. rack bounce
    const authored = read<unknown>(SCORE), score = normalizeScore(authored);
    assert.equal(score.bpm, BPM);
    assert.equal(score.endBeat, 16); assert.deepEqual(score.sections.map(s => [s.id, s.bars]), [['ascent', 4]]);
    assert.equal(beatFrame(16, BPM), FRAMES, 'four bars at 96 BPM must be exactly 441,000 frames');
    assert.ok(score.tailSeconds <= 10, 'a single fold needs a tail no longer than the cycle');
    const rendered = await renderScore(score, log), mixes = await mixdown(rendered);
    const native = join(scratch, 'native');
    const bounce = bouncePackage(score, rendered, mixes, native);
    assert.equal(bounce.clipped, 0, 'native phrases must not clip');
    verifyRackPackage(native);
    assert.deepEqual(containmentProblems(native, 'main.json'), []);

    // The fold keeps every tail sample up to the end of the render; report how far the tail has decayed there.
    const take = mixes.context, endWin = Math.round(0.1 * RATE), takeFrames = take[0].length;
    const fold = { tailSeconds: score.tailSeconds, renderFrames: takeFrames, foldedFrames: takeFrames - FRAMES,
      lastTailWindowRmsDbfs: round(rmsDb(take, takeFrames - endWin, takeFrames), 1), cycleRmsDbfs: round(rmsDb(take, 0, FRAMES), 1),
      meaning: 'Phrase frames beyond 10 s are laid over the opening (offsetSeconds 10). The render ends after the tail; its final 100 ms shows what the fold leaves out.' };

    // -------------------------------------------------------------------------------- 2. the 10-second loop project
    const src = join(scratch, 'loop');
    const main = read<{ title: string; key: string; seed: number; master: { gainDb: number }; tracks: { id: string; description: string; mix: { gainDb: number; pan: number }; instrument: { kit: string } }[] }>(join(native, 'main.json'));
    const catalog = read<{ sounds: { file: string; sha256: string; track: string; section: string; frames: number; fromFrame: number }[] }>(join(native, 'catalog.json'));
    const tracks = [];
    for (const t of main.tracks) {
      const sound = catalog.sounds.find(s => s.track === t.id && s.section === 'ascent');
      assert.ok(sound, `${t.id}: missing ascent phrase`);
      assert.equal(sound.fromFrame, 0); assert.ok(sound.frames > FRAMES && sound.frames <= 2 * FRAMES, `${t.id}: phrase must hold one fold`);
      mkdirSync(join(src, 'assets', t.id), { recursive: true });
      copyFileSync(join(native, sound.file), join(src, sound.file));
      writeFileSync(join(src, 'assets', t.id, 'kit.json'), json({ formatVersion: 1, samples: [{ name: 'phrase-ascent', pitch: 0, file: 'phrase-ascent.wav' }] }));
      tracks.push({ id: t.id, description: t.description, instrument: { type: 'drumkit', kit: `assets/${t.id}/kit.json` }, mix: t.mix,
        clips: [{ bar: 1, pattern: 'ascent' }], patterns: [{ id: 'ascent', bars: 4, notes: [
          { start: '1:1', pitch: 'phrase-ascent', velocity: 1 },
          { start: '1:1', pitch: 'phrase-ascent', velocity: 1, offsetSeconds: 10 },
        ] }] });
    }
    const project = { formatVersion: 1, title: 'THE IMPOSSIBLE STAIRWELL (Opus 5.5 candidate, 10-second loop)', bpm: BPM, timeSignature: '4/4', key: main.key, bars: 4, seed: main.seed,
      description: 'Seamless four-bar cycle (exactly 10.000 s / 441,000 frames / 240 frames at 24 fps). Each track plays its rack phrase from the start and again from 10 s (its own tail folded over the opening), so the loop point is continuous. Editable musical source: score.json + compose.ts.',
      render: { duration: { seconds: 10 }, tail: 'none' }, master: { gainDb: main.master.gainDb }, tracks };
    writeFileSync(join(src, 'stairwell.json'), json(project));
    const compiled = compileProjectFile(join(src, 'stairwell.json'));
    assert.deepEqual(compiled.diagnostics.filter(d => d.severity === 'error'), []);

    // ---------------------------------------------------------------------------------- 3. Production24 delivery
    const provenance = { workspace: rel(HERE), score: rel(SCORE), scoreSha256: sha256(readFileSync(SCORE)),
      composeSha256: sha256(readFileSync(join(HERE, 'compose.ts'))), buildSha256: sha256(readFileSync(fileURLToPath(import.meta.url))),
      nativeBounceSha256sums: sha256(readFileSync(join(native, 'SHA256SUMS'))), frozenManifestSha256: sha256(readFileSync(join(ROOT, 'studio-001/rack/frozen.json'))),
      clock: { bpm: BPM, bars: 4, beats: 16, seconds: 10, frames: FRAMES, fps: FPS, pictureFrames: 240, pictureFramesPerBeat: 15 },
      purpose: 'ENM Studio composer challenge candidate (Opus 5.5). One finished candidate; no engine, rack or existing composition changes.' };
    const sourceFiles = [
      { path: SCORE, file: 'score.json' }, { path: join(HERE, 'compose.ts'), file: 'compose.ts' }, { path: fileURLToPath(import.meta.url), file: 'build.ts' },
      { path: join(native, 'performance.json'), file: 'rack/performance.json' }, { path: join(native, 'catalog.json'), file: 'rack/catalog.json' },
      { path: join(native, 'registry.json'), file: 'rack/registry.json' }, { path: join(native, 'main.json'), file: 'rack/main.json' },
      { path: join(native, 'SHA256SUMS'), file: 'rack/native-bounce.SHA256SUMS' },
    ];
    const delivery = join(out, 'delivery');
    const pkg = await packageProduction24(join(src, 'stairwell.json'), delivery, { provenance, sourceFiles });
    const members = verifyPackage(delivery);

    // -------------------------------------------------------------------------------------------------- 4. QA
    const qa = join(out, 'qa'); mkdirSync(qa);
    const master = readStereo(pkg.wav, 24);
    assert.equal(master.frames, FRAMES, 'master must be exactly 441,000 frames');
    const stems = pkg.manifest.stems.map(s => {
      const w = readStereo(join(delivery, s.file), 24);
      assert.equal(w.frames, FRAMES, `${s.trackId}: aligned stem length`);
      return { trackId: s.trackId, file: `delivery/${s.file}`, frames: w.frames, rmsDbfs: round(rmsDb([w.L, w.R]), 1), clippedSamples: s.clippedSamples, sha256: s.sha256 };
    });
    // Mono fold-down is measured as dual mono, so the LUFS channel sum compares like with like.
    // Independent reconstruction: fold each PCM16 phrase (x track gain) and sum, x master gain; compare with the PCM24 master.
    const sum = [new Float64Array(FRAMES), new Float64Array(FRAMES)];
    for (const t of tracks) {
      const ph = readStereo(join(src, `assets/${t.id}/phrase-ascent.wav`), 16), g = 10 ** (t.mix.gainDb / 20);
      const [sl, sr] = sum as [Float64Array, Float64Array];
      for (let i = 0; i < ph.frames; i++) { sl[i % FRAMES]! += ph.L[i]! * g; sr[i % FRAMES]! += ph.R[i]! * g; }
    }
    const mg = 10 ** (project.master.gainDb / 20);
    let worstLsb = 0;
    for (let i = 0; i < FRAMES; i++) worstLsb = Math.max(worstLsb, Math.abs(sum[0]![i]! * mg - master.L[i]!), Math.abs(sum[1]![i]! * mg - master.R[i]!));
    const reconstruction = { maximumErrorPcm24Lsb: round(worstLsb * 8388608, 3), meaning: 'Master vs. an independent sum of the folded PCM16 phrases (track and master gain only). <= 0.5 LSB means the engine applied exactly the fold and nothing else.' };
    assert.ok(reconstruction.maximumErrorPcm24Lsb <= 0.51, `fold reconstruction error ${reconstruction.maximumErrorPcm24Lsb} LSB`);
    const loud = ebur128(pkg.wav), mono = ebur128(pkg.wav, 'pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1,');
    // Three consecutive passes (repeated playback), as one file, for loudness consistency and listening.
    const x3wav = join(scratch, 'x3.wav');
    run(ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', '-y', '-stream_loop', '2', '-i', pkg.wav, '-c:a', 'pcm_s24le', x3wav]);
    const x3 = readStereo(x3wav, 24);
    assert.equal(x3.frames, 3 * FRAMES);
    for (let i = 0; i < 3 * FRAMES; i += 997) assert.equal(x3.L[i], master.L[i % FRAMES], 'concatenation must be sample-exact');
    const x3loud = ebur128(x3wav);
    const passMean = (k: number) => { const m = x3loud.momentary.filter(([t]) => t >= k * 10 + 1 && t <= (k + 1) * 10); return m.reduce((s, [, v]) => s + v, 0) / m.length; };
    run(ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', '-y', '-i', x3wav, '-codec:a', 'libmp3lame', '-b:a', '256k', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', join(qa, 'stairwell-loop-x3.mp3')]);
    run(ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', '-y', '-i', pkg.wav, '-lavfi', 'showspectrumpic=s=1200x600:legend=1:scale=log:fscale=log:stop=16000', join(qa, 'spectrogram.png')]);
    run(ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', '-y', '-i', pkg.wav, '-lavfi', 'showwavespic=s=1200x240:split_channels=1', join(qa, 'waveform.png')]);
    // Form: integrated loudness of each bar (flight).
    const bars = [0, 1, 2, 3].map(k => { const b0 = beatFrame(4 * k, BPM), b1 = beatFrame(4 * k + 4, BPM); return { bar: k + 1, seconds: [round(b0 / RATE, 3), round(b1 / RATE, 3)], pictureFrames: [k * 60, k * 60 + 59], rmsDbfs: round(rmsDb([master.L, master.R], b0, b1), 1) }; });
    const firstSecond = loud.momentary.filter(([t]) => t >= 0.4 && t <= 1.0).map(([, v]) => v);

    // Determinism: fresh-process replay of the sealed package; fresh-process re-bounce of the rack.
    const replay = join(scratch, 'replay');
    run(process.execPath, [join(ROOT, 'scripts/headliner-production24.ts'), 'replay', delivery, replay]);
    const replayFiles = files(delivery);
    assert.deepEqual(files(replay), replayFiles);
    const replayDiffers = replayFiles.filter(f => sha256(readFileSync(join(delivery, f))) !== sha256(readFileSync(join(replay, f))));
    const rebounce = join(scratch, 'rebounce');
    run(process.execPath, [join(ROOT, 'studio-001/rack/cli.ts'), 'bounce', SCORE, rebounce], 600000);
    const ascent = catalog.sounds;
    const rebounceDiffers = ascent.filter(s => sha256(readFileSync(join(rebounce, s.file))) !== s.sha256).map(s => s.file);

    const truePeak = pkg.manifest.master.analysis.truePeakDbfs;
    const report = {
      schema: 'enm.stairwell.opus55.qa/1', title: project.title,
      clock: provenance.clock,
      master: { file: `delivery/${rel(pkg.wav).split('/delivery/')[1] ?? 'masters'}`, sha256: pkg.manifest.master.sha256, format: 'WAV PCM 24-bit stereo 44,100 Hz', frames: master.frames,
        seconds: master.frames / RATE, clippedSamples: pkg.manifest.master.clippedSamples, analysis: pkg.manifest.master.analysis },
      loudness: { integratedLufs: loud.integratedLufs, lraLu: loud.lraLu, ffmpegTruePeakDbtp: loud.truePeakDbtp, engineTruePeakDbfs: truePeak,
        firstSecondMomentaryLufs: firstSecond.length ? [round(Math.min(...firstSecond), 1), round(Math.max(...firstSecond), 1)] : null,
        momentaryRangeLufs: [round(Math.min(...loud.momentary.filter(([t]) => t >= 0.4).map(([, v]) => v)), 1), round(Math.max(...loud.momentary.map(([, v]) => v)), 1)] },
      form: bars,
      mono: { ...monoCompatibility(master.L, master.R), monoIntegratedLufs: mono.integratedLufs, monoMinusStereoLufs: round(mono.integratedLufs - loud.integratedLufs, 2) },
      boundary: { ...seam(master.L, master.R), fold, reconstruction },
      repeatedPlayback: { passes: 3, sampleExactConcatenation: true, integratedLufs: x3loud.integratedLufs, truePeakDbtp: x3loud.truePeakDbtp,
        meanMomentaryLufsPerPass: [0, 1, 2].map(k => round(passMean(k), 2)), listening: 'qa/stairwell-loop-x3.mp3' },
      stems: { count: stems.length, aligned: true, note: 'Post-track, pre-master PCM24 (pan baked into each phrase). The room stem is the shared wet FDN. Apply the project master gain to reconstruct a mix.', list: stems },
      determinism: { freshProcessReplayIdenticalFiles: replayFiles.length - replayDiffers.length, replayFiles: replayFiles.length, replayDiffers,
        freshProcessRackRebounceAscentPhrasesIdentical: ascent.length - rebounceDiffers.length, rebounceDiffers },
      package: { directory: 'delivery', members, sealed: 'delivery/SHA256SUMS (exact file set)' },
      assets: { soundFontUsed: false, fluidR3Used: false, externalSamples: false,
        statement: 'Every sound is synthesized by the hash-verified, unmodified Signature Rack engines (MUTATION 001) from numeric parameters and seeded PRNGs. No SoundFont, FluidR3, recording or third-party sample.' },
      gates: {
        exactFrames: master.frames === FRAMES && stems.every(s => s.frames === FRAMES),
        noClipping: pkg.manifest.master.clippedSamples === 0 && stems.every(s => s.clippedSamples === 0),
        truePeakAtMostMinus1Dbtp: loud.truePeakDbtp <= -1 && (truePeak ?? 0) <= -1,
        monoFoldDownWithin3Db: Math.abs(mono.integratedLufs - loud.integratedLufs) <= 3,
        seamWithinOrdinaryMotion: true as boolean,
        deterministicReplay: replayDiffers.length === 0,
        deterministicRackBounce: rebounceDiffers.length === 0,
      },
      status: 'Technical QA by measurement. The composer (an AI agent) cannot hear audio: human listening approval, rights declaration and release mastering remain pending.',
    };
    report.gates.seamWithinOrdinaryMotion = report.boundary.highPassEnergyAtSeamsDbOverMedian.every(v => v <= report.boundary.highPassEnergy999thPercentileDbOverMedian);
    writeFileSync(join(qa, 'QA.json'), json(report));
    return report;
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 3, 'usage: node production/infinite-stairwell/opus-55/build.ts NEW_OUTPUT_DIRECTORY');
  const report = await build(process.argv[2]!);
  console.log(json({ gates: report.gates, loudness: report.loudness, mono: report.mono, boundary: report.boundary, form: report.form }));
}
