// STILL HERE build: score -> original assets -> DaemonV12 project -> validate -> engine render
// (stems, WAV) -> external loudness/true-peak stage -> MP3 listening copy -> cue sheet.
//   node experiments/still-here-score/build.mjs a v1       (from the repository root)
//   node experiments/still-here-score/build.mjs all v2
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeProject } from './src/project.mjs';
import { masterFile, mp3, loudness } from './src/master.mjs';
import { RATE, FPS, FRAMES, IGNITION_FRAME, pictureOfFrame } from './src/timing.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..', '..'), CLI = join(ROOT, 'bin', 'daemonv12.js');
export const TARGET_LUFS = -14, CEILING_DB = -1.2;
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const engine = (...args) => {
  try { return JSON.parse(execFileSync(process.execPath, [CLI, ...args, '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 })); }
  catch (e) { const r = (() => { try { return JSON.parse(e.stdout); } catch { return null; } })(); throw new Error(`daemonv12 ${args[0]} failed: ${JSON.stringify(r?.errors ?? r ?? e.message, null, 1).slice(0, 4000)}`); }
};

export async function build(concept, version) {
  const t0 = performance.now();
  const { score } = await import(`./scores/${concept}.mjs`);
  const spec = score(version);
  const out = join(HERE, concept, version), projDir = join(out, 'project'), renderDir = join(out, 'render');
  mkdirSync(out, { recursive: true });
  const { path, assets } = writeProject(projDir, spec);
  const tSynth = performance.now();
  const validation = engine('validate', path);
  if (!validation.ok) throw new Error(`validation failed: ${JSON.stringify(validation.errors, null, 1)}`);
  if (validation.warnings?.length) console.warn('validation warnings:', JSON.stringify(validation.warnings));
  rmSync(renderDir, { recursive: true, force: true });
  const render = engine('render', path, '--out-dir', renderDir, '--stems', '--format', 'wav');
  const engineWav = render.artifacts.wav, manifest = JSON.parse(readFileSync(render.artifacts.manifest, 'utf8'));
  const stemPaths = Object.fromEntries(render.artifacts.stems.map(s => [s.trackId, s.wav]));
  const tRender = performance.now();
  // the delivered master and its listening copy
  const wav = join(out, `${spec.name}.wav`), mp3Path = join(out, `${spec.name}.mp3`);
  const mastering = masterFile(engineWav, wav, { targetLufs: TARGET_LUFS, ceilingDb: CEILING_DB, silenceWindows: spec.silence ?? [] });
  mp3(wav, mp3Path);
  const analysis = engine('analyze', wav);
  // cue sheet: every authored sync point resolved by the engine's own tick -> frame function
  const cues = spec.cues.map(c => {
    const frame = spec.grid.frame(c.pos);
    return { cue: c.cue, position: spec.grid.position(c.pos), tick: spec.grid.tick(c.pos), sampleFrame: frame, seconds: +(frame / RATE).toFixed(6), frame60: pictureOfFrame(frame), what: c.what };
  });
  const ign = cues.find(c => c.cue === 'IGNITION');
  if (ign.sampleFrame !== IGNITION_FRAME || ign.frame60 !== 240) throw new Error(`ignition resolved to ${ign.sampleFrame}`);
  if (analysis.frames !== FRAMES && analysis.analysis?.frames !== FRAMES) {
    const frames = analysis.frames ?? analysis.analysis?.frames;
    if (frames !== FRAMES) throw new Error(`master has ${frames} frames, expected ${FRAMES}`);
  }
  const meta = {
    name: spec.name, title: spec.title, bpm: spec.bpm, key: spec.key, frames: FRAMES, seconds: FRAMES / RATE, frames60: FRAMES * FPS / RATE,
    ignition: { sampleFrame: IGNITION_FRAME, frame60: 240 },
    files: {
      master: { path: relative(HERE, wav), sha256: sha(wav) }, mp3: { path: relative(HERE, mp3Path), sha256: sha(mp3Path) },
      project: { path: relative(HERE, path), sha256: sha(path) }, engineMaster: { path: relative(HERE, engineWav), sha256: sha(engineWav) },
      stems: Object.fromEntries(Object.entries(stemPaths).map(([id, p]) => [id, sha(p)])),
      engineManifest: { path: relative(HERE, render.artifacts.manifest), sha256: sha(render.artifacts.manifest) },
      assets,
    },
    engine: {
      version: manifest.engine?.version ?? manifest.engineVersion ?? null,
      clippedSamples: Object.fromEntries((manifest.tracks ?? []).map(tr => [tr.id, tr.clippedSamples ?? tr.production?.clippedSamples ?? null])),
      master: manifest.master ?? null,
    },
    mastering, analysis: analysis.analysis ?? analysis, cues,
    timings: { synthSeconds: +((tSynth - t0) / 1000).toFixed(1), engineSeconds: +((tRender - tSynth) / 1000).toFixed(1), totalSeconds: +((performance.now() - t0) / 1000).toFixed(1) },
  };
  if (spec.tempoMap) {
    meta.tempoMap = { sections: spec.tempoMap, engine: { bpm: spec.bpm, timeSignature: spec.timeSignature, usPerQuarter: spec.grid.engineTempo },
      note: 'Experimental score-local tempo map carried by a fixed-tempo DaemonV12 project; every authored position is an integer engine tick.' };
    meta.eventMap = writeEventMap(spec, manifest, join(out, `${spec.name}.events`));
  }
  writeFileSync(join(out, `${spec.name}.meta.json`), JSON.stringify(meta, null, 2) + '\n');
  writeFileSync(join(out, `${spec.name}.cues.md`), cueTable(spec, cues));
  return meta;
}

/** Every engine trigger with its sample frame, 60 fps frame and tempo-map position (JSON + Markdown). */
function writeEventMap(spec, manifest, base) {
  const M = spec.grid, rows = [];
  for (const tr of manifest.samples.tracks) for (const e of tr.triggers) {
    const pos = M.posOfTick(e.tick), onGrid = Math.abs(pos * 4 - Math.round(pos * 4)) < 1e-9;
    if (onGrid && M.frame(Math.round(pos * 4) / 4) !== e.frame) throw new Error(`event map: ${tr.trackId} tick ${e.tick} frame mismatch`);
    rows.push({ seconds: +(e.frame / RATE).toFixed(6), sampleFrame: e.frame, frame60: pictureOfFrame(e.frame), track: tr.trackId,
      sound: e.file.split('/').pop().replace('.wav', ''), velocity: e.velocity, tick: e.tick,
      position: onGrid ? M.musical(Math.round(pos * 4) / 4) : `physics-timed (${(pos).toFixed(3)} sixteenths)`, bpm: M.bpmAt(Math.min(pos, M.totalSix - 1e-9)) });
  }
  rows.sort((a, b) => a.sampleFrame - b.sampleFrame || a.track.localeCompare(b.track));
  writeFileSync(`${base}.json`, JSON.stringify(rows, null, 1) + '\n');
  const md = rows.map(r => `| ${r.seconds.toFixed(4)} | ${r.sampleFrame} | ${r.frame60} | ${r.track} | ${r.sound} | ${r.velocity} | ${r.position} |`);
  writeFileSync(`${base}.md`, `# ${spec.title}: event map\n\nEvery trigger the engine rendered (from the render manifest). Sample frames are DaemonV12's own; the 60 fps frame is floor(sampleFrame × 60 / 44100).\n` +
    `Positions are in the experimental tempo map (${spec.tempoMap.map(s => `${s.bars} bars at ${s.bpm} BPM`).join(', then ')}); the engine project itself runs at a fixed ${spec.bpm} BPM in ${spec.timeSignature}.\n\n` +
    `| Seconds | Sample frame | 60 fps | Track | Sound | Velocity | Position |\n|---:|---:|---:|---|---|---:|---|\n${md.join('\n')}\n`);
  return { events: rows.length, json: `${base.split('/').pop()}.json`, markdown: `${base.split('/').pop()}.md` };
}

function cueTable(spec, cues) {
  const rows = cues.map(c => `| ${c.cue} | \`${c.position}\` | ${c.tick} | ${c.sampleFrame} | ${c.seconds.toFixed(3)} | ${c.frame60} | ${c.what} |`);
  const tempo = spec.tempoMap ? `Tempo map: ${spec.tempoMap.map(s => `${s.bars} bars at ${s.bpm} BPM`).join(', then ')} (engine project: fixed ${spec.bpm} BPM in ${spec.timeSignature})` : `${spec.bpm} BPM, 4/4`;
  return `# ${spec.title}: sync points\n\n${tempo}. Sample frames are DaemonV12's own tick → frame resolution (nearest frame, ties later);\n` +
    `the 60 fps frame is floor(sampleFrame × 60 / 44100). The file is ${FRAMES} frames (720 picture frames).\n\n` +
    `| Cue | Position | Tick | Sample frame | Seconds | 60 fps | What happens |\n|---|---|---:|---:|---:|---:|---|\n${rows.join('\n')}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [which = 'all', version = 'v1'] = process.argv.slice(2);
  for (const c of which === 'all' ? ['a', 'b'] : [which]) {
    const m = await build(c, version);
    const a = m.analysis;
    console.log(`${m.name}: ${m.frames} frames; LUFS ${m.mastering.measured.integratedLufs} TP ${m.mastering.measured.truePeakDbtp} (engine master ${m.mastering.engineMasterLufs} LUFS, limiter max ${m.mastering.limiterMaxDb} dB); ` +
      `analyze: ${a.integratedLufs ?? a.loudness?.integratedLufs} LUFS, ${a.truePeakDbfs ?? a.loudness?.truePeakDbfs} dBTP; ${m.timings.totalSeconds} s`);
  }
}
