// Score-specific production session. Uses the existing rack and native renderer unchanged.
// From the repository root: node production/infinite-stairwell/sol-max/render.mjs NEW_DIRECTORY
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { normalizeScore, performanceJson } from '../../../studio-001/rack/score.ts';
import { renderScore, mixdown, peak } from '../../../studio-001/rack/render.ts';
import { wavBytes } from '../../../studio-001/rack/package.ts';
import { verifyFrozen, readFreeze } from '../../../studio-001/rack/frozen.ts';
import { registryDocument } from '../../../studio-001/rack/registry.ts';
import { beatFrame } from '../../../studio-001/rack/curves.ts';
import { runCommand } from '../../../src/pipeline.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const out = resolve(process.argv[2] || join(here, 'delivery'));
if (!out.startsWith(here + '/') || existsSync(out)) throw Error('Use a fresh directory inside sol-max.');
const hash = b => createHash('sha256').update(b).digest('hex');
const save = (path, value) => writeFileSync(join(out, path), JSON.stringify(value, null, 2) + '\n');
const bad = verifyFrozen();
if (bad.length) throw Error(bad.join('\n'));
const authored = JSON.parse(readFileSync(join(here, 'the-landing-remembers.score.json'), 'utf8'));
const score = normalizeScore(authored);
const frames = beatFrame(16, score.bpm);
if (score.bpm !== 96 || score.bars !== 4 || frames !== 441000) throw Error('Locked timing changed.');
const rendered = await renderScore(score, s => console.error(s));
const mixes = await mixdown(rendered);

// Circular overlap-add of the complete performance and ten seconds of natural tail.
// No crossfade, time stretch, endpoint fade, limiter, added synth, or replacement engine.
// All six stems use the identical modulo-441000 sample mapping.
const folded = new Map();
const tailEvidence = {};
for (const [id, channels] of [...mixes.stems, ['room', mixes.room]]) {
  const loop = [new Float64Array(frames), new Float64Array(frames)];
  let terminalPeak = 0, wrappedPeak = 0;
  for (let c = 0; c < 2; c++) for (let i = 0; i < channels[c].length; i++) {
    const v = channels[c][i];
    loop[c][i % frames] += v;
    if (i >= frames) wrappedPeak = Math.max(wrappedPeak, Math.abs(v));
    if (i >= channels[c].length - 441) terminalPeak = Math.max(terminalPeak, Math.abs(v));
  }
  tailEvidence[id] = { terminal10msPeakDbfs: terminalPeak ? 20 * Math.log10(terminalPeak) : null, wrappedPeakDbfs: wrappedPeak ? 20 * Math.log10(wrappedPeak) : null };
  folded.set(id, loop);
}
const sum = [new Float64Array(frames), new Float64Array(frames)];
for (const channels of folded.values()) for (let c = 0; c < 2; c++) for (let i = 0; i < frames; i++) sum[c][i] += channels[c][i];
// One common static gain preserves the composed dynamics and the stem sum.
const commonGain = Math.min(10 ** (-2.5 / 20) / peak(sum), 0.94 / Math.max(...[...folded.values()].map(peak)));
mkdirSync(join(out, 'assets'), { recursive: true });
mkdirSync(join(out, 'audio'), { recursive: true });
const assets = [];
for (const [id, channels] of folded) {
  const result = wavBytes(channels, commonGain);
  if (result.clipped) throw Error(`${id}: clipped source`);
  writeFileSync(join(out, 'assets', `${id}.wav`), result.bytes);
  assets.push({ id, file: `assets/${id}.wav`, frames, sampleRate: 44100, channels: 2, bitsPerSample: 16, sha256: hash(result.bytes) });
}
const project = {
  formatVersion: 1, title: 'THE LANDING REMEMBERS', bpm: 96, timeSignature: '4/4', key: 'D minor', bars: 4, seed: authored.seed,
  description: 'ENM STUDIO / INFINITE STAIRWELL. Four bars, ten seconds. Original Signature Rack performance; circular natural tails. Edit the adjacent note score and re-run render.mjs to regenerate these phrase assets.',
  render: { duration: { seconds: 10 }, tail: 'none' }, master: { gainDb: 0 },
  tracks: assets.map(a => ({ id: a.id, instrument: { type: 'sampler', sample: a.file }, mix: { gainDb: 0, pan: 0 },
    patterns: [{ id: 'loop', bars: 4, notes: [{ start: '1:1', velocity: 1 }] }], clips: [{ bar: 1, pattern: 'loop' }] }))
};
save('the-landing-remembers.json', project);
save('score.json', authored);
save('performance.json', performanceJson(score));
save('registry.json', registryDocument());
const engineCommit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
const generators = [
  ...readFreeze().files.filter(f => f.role === 'engine').map(f => f.path),
  'studio-001/rack/frozen.json', ...['types','curves','score','render','package','registry','instruments','frozen'].map(f => `studio-001/rack/${f}.ts`),
  'src/pipeline.ts', 'src/render/production.ts', 'src/render/playback.ts', 'src/render/analysis.ts', 'src/sample-render.ts', 'src/timing/musical-time.ts'
].map(file => ({ file, sha256: hash(readFileSync(join(repo, file))) }));
save('provenance.json', {
  title: authored.title, engineCommit, node: process.version,
  composerSkillSha256: hash(readFileSync(join(repo, 'plugins/daemonv12-composer/skills/daemonv12-composer/SKILL.md'))),
  scoreSha256: hash(readFileSync(join(here, 'the-landing-remembers.score.json'))),
  sessionSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  origin: 'Owner-original, approved DaemonV12 MUTATION 001 instruments. Numeric synthesis and seeded PRNGs only. No external audio, SoundFont, impulse response or preset.',
  licensing: 'Existing owner declaration is unchanged; no third-party audio and no new license grant.',
  soundfontUsed: false, frozenEnginesVerified: true, generators, assets,
  loop: { method: 'circular overlap-add of each Float64 rack stem including its natural tail', frames, renderedSourceFrames: rendered.frames, tailSeconds: score.tailSeconds, commonGainDb: 20 * Math.log10(commonGain), tailEvidence },
  master: { sourcePcmBits: 16, exportPcmBits: 16, gainDb: 0, effects: [], normalization: 'One static common gain before phrase quantization; float mix peak target -2.5 dBFS, stem ceiling 0.94.', dither: false },
  mp3: 'Native DaemonV12 listening copy; three-repeat copy encoded directly from three sample-exact WAV cycles. WAV owns the clock.'
});
const cues = score.sections.map(s => ({ name: s.id, musical: `${s.startBeat / 4 + 1}:1`, tick: s.startBeat * 960,
  sampleFrame: beatFrame(s.startBeat, score.bpm), seconds: beatFrame(s.startBeat, score.bpm) / 44100, videoFrame: s.startBeat * 15, development: s.development }));
cues.push({ name: 'loop-boundary', musical: '5:1', tick: 15360, sampleFrame: frames, seconds: 10, videoFrame: 240 });
save('cues.json', { bpm: 96, usPerQuarter: 625000, ticksPerQuarter: 960, fps: 24, framesPerBeat: 15, audioFramesPerChannel: frames, cues });
// Use the CLI's existing runCommand API. This also avoids nested Node launch restrictions
// in the managed execution sandbox. No renderer implementation is copied or changed.
const validation = await runCommand('validate', join(out, 'the-landing-remembers.json'), { env: process.env });
save('validation.json', validation.result);
if (validation.exitCode !== 0) throw Error(JSON.stringify(validation.diagnostics));
const result = await runCommand('render', join(out, 'the-landing-remembers.json'), { outDir: join(out, 'audio'), stems: true, format: 'wav,mp3', env: process.env });
save('render-result.json', result.result);
if (result.exitCode !== 0) throw Error(JSON.stringify(result.diagnostics));
const ffmpeg = process.env.DAEMONV12_FFMPEG || 'ffmpeg';
const repeat = spawnSync(ffmpeg, ['-hide_banner','-nostdin','-v','error','-i',join(out,'audio/the-landing-remembers.wav'),
  '-af','aloop=loop=2:size=441000,atrim=end_sample=1323000,asetpts=N/SR/TB','-codec:a','libmp3lame','-b:a','192k','-map_metadata','-1',
  '-fflags','+bitexact','-flags:a','+bitexact',join(out,'audio/the-landing-remembers-three-repeats.mp3')], {encoding:'utf8'});
if (repeat.status !== 0) throw Error(repeat.stderr);
console.log(JSON.stringify({ directory: relative(repo,out), frames, commonGainDb: 20*Math.log10(commonGain), tailEvidence, analysis: result.result.analysis?.master }, null, 2));
