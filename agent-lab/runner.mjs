import { createHash, createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, renameSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { compileProjectFile, runCommand } from '../src/pipeline.ts';
import { createAudioProcessor, analyzeWav, decodePcm, encodePcm, resolveSoundfont } from '../src/render/index.ts';
import { executablePath } from '../src/render/environment.ts';
import { ticksToFrames } from '../src/timing/musical-time.ts';
import { definition, object, requireLab as check, LabError } from './schema.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const sha = file => hash(readFileSync(file));
const parseJson = bytes => JSON.parse(bytes.toString().replace(/^\uFEFF/, ''));
export const load = file => parseJson(readFileSync(file));
export const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
export function tree(dir) {
  return Object.fromEntries(readdirSync(dir).sort().flatMap(name => {
    const p = join(dir, name);
    return lstatSync(p).isDirectory() ? Object.entries(tree(p)).map(([k, v]) => [`${name}/${k}`, v]) : [[name, sha(p)]];
  }));
}
function fresh(path) {
  try { lstatSync(path); throw new LabError('OUTPUT_EXISTS', 'Output already exists.', 'Choose a fresh output path; prior results are never overwritten.'); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
}
function publishFile(file, value) {
  // Exclusive creation prevents replacing inputs, scores, symlinks or earlier reports.
  save(file, value);
}
function readExperiment(file) {
  const bytes = readFileSync(file), spec = definition(parseJson(bytes));
  const paths = [spec.source, ...spec.candidates.map(c => c.project)].map(p => realpathSync(resolve(dirname(file), p)));
  const compiled = paths.map(path => {
    const c = compileProjectFile(path);
    check(c.timeline && !c.diagnostics.some(d => d.severity === 'error'), 'PROJECT_INVALID', `Project failed existing engine validation: ${path}`, 'Repair the engine diagnostics before rerunning.', c.diagnostics);
    return c;
  });
  const canonical = x => JSON.stringify(x, function(k, v) {
    return v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(key => [key, v[key]])) : v;
  });
  check(new Set(compiled.slice(1).map(c => canonical(parseJson(Buffer.from(c.projectBytes))))).size === 3,
    'DUPLICATE_CANDIDATE', 'Candidates must contain distinct JSON projects.', 'Propose meaningful creative variations; formatting changes do not count.');
  return { spec, bytes, paths, compiled };
}
async function exec(exe, args) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(exe, args, { env: process.env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', bytes = 0, failure;
    const timer = setTimeout(() => { failure = 'Tool exceeded 120 seconds.'; child.kill('SIGKILL'); }, 120000);
    child.on('error', error => { failure = error.message; });
    child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > 8 * 1024 * 1024) { failure = 'Tool output exceeded 8 MiB.'; child.kill('SIGKILL'); } else stdout += chunk; });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-16000); });
    child.on('close', code => {
      clearTimeout(timer);
      if (failure || code !== 0) reject(new LabError('TOOL_FAILED', `Tool failed: ${exe}`, 'Install the required tool or select its executable using DAEMONV12_FFMPEG / DAEMONV12_FLUIDSYNTH.', failure || stderr));
      else resolveResult(stdout);
    });
  });
}
async function tool(command, args) {
  const path = executablePath(command, process.env);
  check(path, 'TOOL_MISSING', `Executable unavailable: ${command}`, 'Install it or set the corresponding DAEMONV12 environment variable.');
  return { sha256: sha(path), version: (await exec(path, args)).trim() };
}
async function fingerprint(compiled) {
  const gm = compiled.some(c => c.timeline.tracks.some(t => t.instrument.type === 'gm'));
  const sf = gm ? await resolveSoundfont({ env: process.env }) : null;
  check(!gm || sf.value, 'SOUNDFONT_MISSING', 'GM candidates need a SoundFont.', 'Set DAEMONV12_SOUNDFONT.', sf?.diagnostic);
  return { version: 1, engine: tree(join(root, 'src')), lab: Object.fromEntries(['runner.mjs', 'schema.mjs', 'cli.mjs'].map(f => [f, sha(join(root, 'agent-lab', f))])),
    node: { version: process.version, sha256: sha(process.execPath) }, platform: process.platform, arch: process.arch,
    ffmpeg: await tool(process.env.DAEMONV12_FFMPEG || 'ffmpeg', ['-version']),
    fluidsynth: gm ? await tool(process.env.DAEMONV12_FLUIDSYNTH || 'fluidsynth', ['--version']) : null,
    soundfont: sf?.value ? { sha256: sf.value.sha256, bytes: sf.value.bytes } : null,
    render: { stems: true, format: 'wav', sampleRate: 44100, channels: 2, bitsPerSample: 16 },
    matching: { method: 'static gain, no limiter, whole-track integrated LUFS', toleranceLu: 0.3, headroomMarginDb: 0.1 } };
}
export async function pin(experiment, lock) {
  fresh(lock);
  const inputs = readExperiment(experiment);
  publishFile(lock, await fingerprint(inputs.compiled));
  return { ok: true, command: 'pin', lockSha256: sha(lock) };
}
export function changes(before, after, path = '') {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (before && after && typeof before === 'object' && typeof after === 'object' && Array.isArray(before) === Array.isArray(after)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort().flatMap(k => changes(before[k], after[k], `${path}/${k.replaceAll('~', '~0').replaceAll('/', '~1')}`));
  }
  return [{ path: path || '/', ...(before !== undefined ? { before } : {}), ...(after !== undefined ? { after } : {}) }];
}
function permutation(seed) {
  const a = [0, 1, 2]; let counter = 0;
  for (let i = 2; i > 0; i--) {
    const n = i + 1, limit = Math.floor(0x100000000 / n) * n; let v;
    do { v = createHmac('sha256', seed).update(`agent-lab-v1:${counter++}`).digest().readUInt32BE(0); } while (v >= limit);
    const j = v % n; [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pcm(file) {
  const result = decodePcm(readFileSync(file));
  check(result.pcm?.channels === 2, 'INVALID_AUDIO', 'Expected stereo PCM16 at 44100 Hz.', 'Inspect the engine render.', result.error);
  return result.pcm;
}
function excerpt(input, output, window) {
  const p = pcm(input);
  writeFileSync(output, encodePcm(p.samples.slice(window.startFrame * 2, (window.startFrame + window.frames) * 2)), { flag: 'wx', mode: 0o600 });
}
async function measure(file, processor) {
  const basic = analyzeWav(file), loudness = await processor.loudness(file);
  check(basic.value && loudness.value, 'ANALYSIS_FAILED', 'Audio measurement failed.', 'Check PCM format and FFmpeg loudnorm support.', [basic.diagnostic, loudness.diagnostic].filter(Boolean));
  return { ...basic.value, ...loudness.value };
}
function clipping(manifest) {
  const counts = [];
  function visit(v, path = '') {
    if (!v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      if (k === 'clippedSamples' && x > 0) counts.push({ path: `${path}/${k}`, count: x });
      else visit(x, `${path}/${k}`);
    }
  }
  visit(manifest); return counts;
}
export function timing(compilation, render, spec) {
  const records = [], stems = new Map(render.artifacts.stems.map(s => [s.trackId, s.wav]));
  for (const c of spec.constraints) {
    if (c.kind === 'triggers') {
      const track = compilation.timeline.tracks.find(t => t.id === c.track);
      const actual = track?.notes.map(n => ticksToFrames(n.tick, compilation.timeline.usPerQuarter));
      check(JSON.stringify(actual) === JSON.stringify(c.frames), 'TIMING_FAILED', `Scheduled triggers changed on ${c.track}.`, 'Restore the declared track trigger list.', { constraint: c, actual });
      records.push({ ...c, actual, passed: true });
    } else {
      const file = c.track === '$master' ? render.artifacts.wav : stems.get(c.track);
      check(file, 'TIMING_FAILED', `Timing track missing: ${c.track}`, 'Restore the track or correct the constraint.');
      const p = pcm(file), peaks = [];
      for (let f = c.startFrame; f < c.endFrame; f++) peaks.push(Math.max(Math.abs(p.samples[f * 2]), Math.abs(p.samples[f * 2 + 1])));
      const peak = peaks.reduce((a, b) => Math.max(a, b), 0), db = peak ? 20 * Math.log10(peak / 32768) : null;
      if (c.kind === 'silence') {
        check(db === null || db <= c.maxPeakDbfs, 'TIMING_FAILED', `Silence constraint failed on ${c.track}.`, 'Remove sound from the declared quiet interval.', { constraint: c, peakDbfs: db });
        records.push({ ...c, peakDbfs: db, passed: true });
      } else {
        const onset = c.startFrame + peaks.findIndex(p => p >= peak * c.thresholdFraction && p > 0);
        check(db !== null && db >= c.minPeakDbfs && Math.abs(onset - c.expectedFrame) <= c.toleranceFrames,
          'TIMING_FAILED', `Measured onset failed on ${c.track}.`, 'Restore source offset, envelope, asset and trigger timing; inspect the isolated stem.', { constraint: c, measuredFrame: onset, peakDbfs: db });
        records.push({ ...c, measuredFrame: onset, peakDbfs: db, passed: true });
      }
    }
  }
  return records;
}
async function renderChecked(project, out, frames, processor) {
  const r = (await runCommand('render', project, { outDir: out, env: process.env, stems: true, format: 'wav' })).result;
  check(r.ok, 'RENDER_FAILED', 'Engine render failed.', 'Repair the engine diagnostics.', r.errors);
  const a = await measure(r.artifacts.wav, processor), clipped = clipping(r.manifest);
  check(a.frames === frames && r.artifacts.stems.every(s => pcm(s.wav).frames === frames), 'DURATION_FAILED', 'Master or stem duration differs from the declared exact frame count.', 'Set render.duration explicitly; do not trim results to hide a timing failure.', { expected: frames, actual: a.frames });
  check(!a.clipping && clipped.length === 0 && !r.warnings.some(w => w.code === 'AUDIO_CLIPPING'), 'CLIPPING', 'Engine clipping detected before loudness matching.', 'Lower candidate track/master gain and rerun; matching cannot repair clipping.', { analysis: a, clipped, warnings: r.warnings });
  return { render: r, analysis: a };
}
export async function run(experiment, lockFile, output) {
  const out = resolve(output); fresh(out);
  const inputs = readExperiment(experiment), { spec, compiled, paths } = inputs;
  const lockBytes = readFileSync(lockFile), expected = JSON.parse(lockBytes.toString());
  check(JSON.stringify(expected) === JSON.stringify(await fingerprint(compiled)), 'TOOLCHAIN_MISMATCH', 'Toolchain differs from the pin.', 'Restore the pinned engine, Node, tools and SoundFont; create a new pin only for an intentional new experiment.');
  const probe = await createAudioProcessor({ env: process.env });
  check(probe.value, 'TOOL_MISSING', 'FFmpeg is required.', 'Install FFmpeg or set DAEMONV12_FFMPEG.', probe.diagnostic);
  const processor = probe.value;
  const tracked = new Map([[realpathSync(experiment), hash(inputs.bytes)], [realpathSync(lockFile), hash(lockBytes)]]);
  const stage = mkdtempSync(join(dirname(out), '.agent-lab-'));
  try {
    mkdirSync(join(stage, 'private'), { mode: 0o700 }); mkdirSync(join(stage, 'public'), { mode: 0o700 });
    save(join(stage, 'private', 'experiment.json'), spec); save(join(stage, 'private', 'toolchain.json'), expected);
    const snapshots = [];
    for (let i = 0; i < compiled.length; i++) {
      const c = compiled[i], dir = join(stage, 'private', i === 0 ? 'source' : `candidate-${i}`);
      mkdirSync(dir, { mode: 0o700 });
      const project = join(dir, 'project.json');
      writeFileSync(project, c.projectBytes, { flag: 'wx', mode: 0o600 });
      tracked.set(paths[i], hash(c.projectBytes));
      const assets = new Map([...c.assets ?? []].map(([name, value]) => [name, value.bytes]));
      if (c.sidechain) assets.set(c.sidechain.file, c.sidechain.bytes);
      const assetHashes = {};
      for (const [name, bytes] of [...assets].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
        const dest = join(dir, name); mkdirSync(dirname(dest), { recursive: true, mode: 0o700 });
        writeFileSync(dest, bytes, { flag: 'wx', mode: 0o600 }); assetHashes[name] = hash(bytes);
        tracked.set(resolve(dirname(paths[i]), name), hash(bytes));
      }
      snapshots.push({ project, projectSha256: hash(c.projectBytes), assets: assetHashes });
    }
    save(join(stage, 'private', 'replay-experiment.json'), { ...spec, source: 'source/project.json',
      candidates: spec.candidates.map((c, i) => ({ ...c, project: `candidate-${i + 1}/project.json` })) });
    const entries = [];
    const sourceIdentity = { projectSha256: snapshots[0].projectSha256, assets: snapshots[0].assets };
    // Source is verified too; it is never a fourth judged entry.
    for (let i = 0; i < snapshots.length; i++) {
      const s = snapshots[i], dir = dirname(s.project), first = await renderChecked(s.project, join(dir, 'render'), spec.frames, processor);
      const checks = timing(compiled[i], first.render, spec);
      await renderChecked(s.project, join(dir, 'repeat'), spec.frames, processor);
      check(JSON.stringify(tree(join(dir, 'render'))) === JSON.stringify(tree(join(dir, 'repeat'))), 'NONDETERMINISTIC_RENDER', 'Repeated render artifacts differ.', 'Restore the pinned runtime; inspect engine/tool nondeterminism.');
      rmSync(join(dir, 'repeat'), { recursive: true });
      const windowFile = join(dir, 'window.wav'); excerpt(first.render.artifacts.wav, windowFile, spec.window);
      const record = { ...s, project: relative(stage, s.project), analysis: first.analysis, window: await measure(windowFile, processor), timing: checks,
        renderSha256: sha(first.render.artifacts.wav), renderArtifacts: tree(join(dir, 'render')), warnings: first.render.warnings };
      if (i === 0) save(join(stage, 'private', 'source-check.json'), record);
      else entries.push({ ...record, snapshotProject: record.project, ...spec.candidates[i - 1], assetChanges: changes(snapshots[0].assets, s.assets), changes: changes(parseJson(Buffer.from(compiled[0].projectBytes)), parseJson(Buffer.from(compiled[i].projectBytes))), input: first.render.artifacts.wav });

    }
    check(new Set(entries.map(e => e.renderSha256)).size === 3, 'IDENTICAL_RENDERS', 'Candidates render identical audio.', 'Propose audible variations rather than metadata-only changes.');
    for (const e of entries) check(Number.isFinite(e.analysis.integratedLufs) && Number.isFinite(e.analysis.truePeakDbfs), 'UNMEASURABLE_LOUDNESS', 'Silent or unmeasurable candidate.', 'Provide audible material long enough for integrated loudness measurement.');
    const requested = spec.loudness.targetLufs, ceiling = spec.loudness.ceilingDbtp;
    const target = Math.floor(10 * Math.min(requested, ...entries.map(e => e.analysis.integratedLufs + ceiling - Math.max(e.analysis.truePeakDbfs, e.window.truePeakDbfs ?? -Infinity) - 0.1))) / 10;
    check(target >= -60, 'LOUDNESS_TARGET_FAILED', 'Safe matching target falls below −60 LUFS.', 'Reduce crest factor through creative gain staging or choose different material. No limiter is applied.');
    const order = permutation(spec.seed), anonymous = [];
    for (const [j, i] of order.entries()) {
      const e = entries[i], label = 'ABC'[j], gainDb = target - e.analysis.integratedLufs, dest = join(stage, 'public', `${label}.wav`);
      const args = ['-hide_banner', '-nostdin', '-v', 'error', '-threads', '1', '-filter_threads', '1', '-i', e.input, '-map', '0:a:0', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', '-af', `volume=${gainDb}dB`, '-c:a', 'pcm_s16le'];
      await exec(process.env.DAEMONV12_FFMPEG || 'ffmpeg', [...args, dest]);
      const second = join(stage, 'private', `${label}-repeat.wav`);
      await exec(process.env.DAEMONV12_FFMPEG || 'ffmpeg', [...args, second]);
      check(sha(dest) === sha(second), 'NONDETERMINISTIC_COPY', 'Repeated listening copies differ.', 'Restore the pinned FFmpeg runtime.'); rmSync(second);
      const after = await measure(dest, processor);
      check(after.frames === spec.frames && !after.clipping && Number.isFinite(after.integratedLufs) && Number.isFinite(after.truePeakDbfs) &&
        Math.abs(after.integratedLufs - target) <= 0.3 && after.truePeakDbfs <= ceiling,
        'LOUDNESS_TARGET_FAILED', 'Listening copy failed measured loudness/headroom verification.', 'Adjust source gain staging or requested target; no limiting or failed match is concealed.', { label, target, ceiling, after });
      const window = join(stage, 'public', `${label}-window.wav`); excerpt(dest, window, spec.window);
      const windowAnalysis = await measure(window, processor);
      check(windowAnalysis.frames === spec.window.frames && !windowAnalysis.clipping &&
        (windowAnalysis.truePeakDbfs === null ? windowAnalysis.peakDbfs === null : windowAnalysis.truePeakDbfs <= ceiling),
        'LOUDNESS_TARGET_FAILED', 'Selected listening window failed peak headroom verification.', 'Choose a measurable window or lower the shared target; no limiting is applied.', { label, ceiling, windowAnalysis });
      anonymous.push({ label, ...Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'input')), gainDb,
        listening: { whole: after, window: windowAnalysis, sha256: sha(dest), windowSha256: sha(window) } });
    }
    const key = { version: 1, source: sourceIdentity, experimentSha256: hash(inputs.bytes), toolchainSha256: hash(lockBytes), seed: spec.seed,
      matching: { requestedTargetLufs: requested, effectiveTargetLufs: target, loweredForHeadroom: target < requested, ceilingDbtp: ceiling, limiterApplied: false },
      entries: anonymous };
    save(join(stage, 'private', 'blind-key.json'), key);
    const keySha256 = sha(join(stage, 'private', 'blind-key.json'));
    save(join(stage, 'public', 'listening.json'), { version: 1, labels: ['A', 'B', 'C'], sampleRate: 44100, frames: spec.frames, window: spec.window, keySha256,
      instructions: 'Judge the full tracks and/or the identical selected windows. Score each label 0–10; higher means preferred. Metrics do not determine musical quality. Keep the private folder and preparation session away from judges.' });
    save(join(stage, 'public', 'scores-template.json'), { version: 1, keySha256, judge: '', scores: { A: null, B: null, C: null }, notes: { A: '', B: '', C: '' } });
    for (const [path, before] of tracked) check(sha(path) === before, 'INPUT_CHANGED', 'An input changed during execution.', 'Restore immutable inputs and rerun into a fresh output.');
    save(join(stage, 'private', 'input-integrity.json'), { unchanged: true, inputs: [...tracked].map(([path, sha256]) => ({ path, sha256 })) });
    check(JSON.stringify(expected) === JSON.stringify(await fingerprint(compiled)), 'TOOLCHAIN_MISMATCH', 'Toolchain changed during execution.', 'Restore the pin and rerun.');
    fresh(out); renameSync(stage, out);
    return { ok: true, command: 'run', keySha256, labels: ['A', 'B', 'C'], requestedTargetLufs: requested, effectiveTargetLufs: target, loweredForHeadroom: target < requested, limiterApplied: false };
  } catch (e) { rmSync(stage, { recursive: true, force: true }); throw e; }
}
export function evaluate(bundle, scoreFile, reportFile) {
  fresh(reportFile);
  const publicDir = join(bundle, 'public'), listening = load(join(publicDir, 'listening.json'));
  const scoreBytes = readFileSync(scoreFile), scores = parseJson(scoreBytes);
  object(scores, ['version', 'keySha256', 'judge', 'scores', 'notes'], 'scores');
  object(scores.scores, ['A', 'B', 'C'], 'scores.scores'); object(scores.notes, ['A', 'B', 'C'], 'scores.notes');
  check(scores.version === 1 && scores.keySha256 === listening.keySha256 && typeof scores.judge === 'string' && scores.judge.trim() &&
    ['A', 'B', 'C'].every(k => Number.isFinite(scores.scores[k]) && scores.scores[k] >= 0 && scores.scores[k] <= 10 && typeof scores.notes[k] === 'string'),
    'SCORES_INCOMPLETE', 'Human scores are missing, invalid or belong to another experiment.', 'Fill judge, all three 0–10 scores and notes in a copy of scores-template.json. Do not inspect the key before scores are final.');
  // Identity key is read only after a complete bound score sheet passes validation.
  const keyFile = join(bundle, 'private', 'blind-key.json');
  check(sha(keyFile) === listening.keySha256, 'KEY_CHANGED', 'Blind key does not match the pre-judging commitment.', 'Restore the original key.');
  const key = load(keyFile);
  for (const e of key.entries) check(sha(join(publicDir, `${e.label}.wav`)) === e.listening.sha256 && sha(join(publicDir, `${e.label}-window.wav`)) === e.listening.windowSha256,
    'COPY_CHANGED', 'Judged audio differs from the committed listening copy.', 'Restore the original blind package and judge again.');
  const ranked = key.entries.map(e => ({ label: e.label, candidate: e.id, hypothesis: e.hypothesis, score: scores.scores[e.label], notes: scores.notes[e.label],
    projectSha256: e.projectSha256, changes: e.changes, assetChanges: e.assetChanges, whole: e.analysis, window: e.window, listening: e.listening, timing: e.timing })).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  const best = ranked[0].score, winners = ranked.filter(e => e.score === best).map(e => e.candidate);
  const report = { version: 1, keySha256: listening.keySha256, scoresSha256: hash(scoreBytes), source: key.source, experimentSha256: key.experimentSha256, toolchainSha256: key.toolchainSha256, judge: scores.judge, winners, tied: winners.length > 1,
    matching: key.matching, comparison: ranked, interpretation: 'Preference is determined only by these human scores. LUFS, RMS and spectral measurements cannot establish musical quality.' };
  publishFile(reportFile, report);
  return { ok: true, command: 'evaluate', winners, tied: winners.length > 1 };
}
