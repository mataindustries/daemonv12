// MORPH//02 -> DaemonV12 0.7: export sketch sounds as PCM16 assets and sequence a NEW groove
// with them through the unmodified engine (drumkit + sampler + production mixer + stems).
// Usage (repo root, after `npm ci`): node experiments/morph-02/integrate.mjs
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { compileProjectFile, runCommand } from '../../src/pipeline.ts';
import { ENGINE_VERSION } from '../../src/version.ts';
import { SR, writeWav, smooth } from './dsp.mjs';
import { KIT, CALL } from './b-alarm-breaks-reality.mjs';
import { strike } from './c-impossible-instrument.mjs';
import { voiceOnly } from './a-machine-learns-to-sing.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, 'engine'), assets = join(root, 'assets');
const json = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const mono = (name, x, gain = 0.89) => {
  const v = Float64Array.from(x, s => s * gain);
  // zero first/last frames and a 3 ms fade-out so one-shots never end on a step
  const fade = Math.round(0.003 * SR);
  for (let i = 0; i < fade; i++) v[v.length - 1 - i] *= smooth(i / fade);
  v[0] = 0;
  writeWav(join(assets, `${name}.wav`), { L: v, R: v }, 16);
  return `${name}.wav`;
};

export async function integrate() {
  if (ENGINE_VERSION !== '0.7.0') throw new Error(`pinned to DaemonV12 0.7.0, got ${ENGINE_VERSION}`);
  rmSync(join(root, 'render'), { recursive: true, force: true });
  mkdirSync(assets, { recursive: true });
  // ---- assets
  const samples = Object.entries(KIT).map(([name, make], k) => ({ name, pitch: 36 + k, file: mono(name, make()) }));
  json(join(assets, 'household-machine-kit.json'), { formatVersion: 1, samples });
  mono('tempo-string-strike', strike(3), 0.8);
  mono('machine-voice', voiceOnly(), 0.85);

  // ---- a new 5-bar arrangement at 120 BPM (10 s), written for the engine, not copied from B
  const pos = (bar, step) => `${bar}:${Math.floor(step / 4) + 1}${step % 4 ? `+${step % 4}/16` : ''}`;
  const art = (release = 0.01) => ({ envelope: { attackSeconds: 0.001, releaseSeconds: release } });
  const beepName = { 88: 'beep-e', 83: 'beep-b', 91: 'beep-g', 89: 'beep-f' };
  const hook = [], drums = [], bells = [], clanks = [];
  for (let bar = 1; bar <= 4; bar++) {
    for (const [step, midi] of CALL) hook.push({ start: pos(bar, step), pitch: beepName[midi], velocity: bar < 3 ? 0.8 : 0.55, ...art(0.004) });
    if (bar >= 3) {
      for (let beat = 0; beat < 4; beat++) drums.push({ start: pos(bar, beat * 4), pitch: 'washer-kick', velocity: 0.95, gate: '1/4', ...art(0.02), chokeGroup: 'kick' });
      for (const beat of [1, 3]) drums.push({ start: pos(bar, beat * 4), pitch: 'toaster-snare', velocity: 0.7, ...art(0.03) });
      for (let step = 0; step < 16; step++) bells.push({ start: pos(bar, step), pitch: step % 2 ? 'bell-b' : 'bell-a', velocity: step % 4 === 2 ? 0.75 : 0.4, endSeconds: 0.25, ...art(0.006), chokeGroup: 'bells' });
    }
    if (bar >= 2) for (const step of [0, 6, 12]) clanks.push({ start: pos(bar, step), pitch: 'press-clank', velocity: bar === 2 ? 0.75 : 0.55, ...art(0.05) });
    for (let step = 0; step < 16; step += 2) if (bar <= 2) drums.push({ start: pos(bar, step), pitch: 'kitchen-tick', velocity: 0.45, ...art(0.004) });
  }
  drums.push({ start: '5:1', pitch: 'washer-kick', velocity: 1, ...art(0.05) });
  const kitTrack = (id, notes, gainDb, pan = 0) => ({ id, instrument: { type: 'drumkit', kit: 'assets/household-machine-kit.json' }, mix: { gainDb, pan },
    patterns: [{ id: 'all', bars: 5, notes }], clips: [{ bar: 1, pattern: 'all' }] });
  const project = {
    formatVersion: 1, title: 'MORPH 02 - Household Machine Kit',
    description: 'New engine-sequenced groove from MORPH//02 synthesized assets: the alarm hook on piezo one-shots, washer kick, toaster-spring snare, alarm-bell hats and press clanks; a tempo-string strike opens; the singing machine says hel-lo in bar 2 and HEL-LO in bar 4; a microwave ding ends it.',
    bpm: 120, timeSignature: '4/4', key: 'E minor', bars: 5, seed: 20261022,
    render: { duration: { seconds: 10 }, tail: 'none' }, master: { gainDb: -3 },
    tracks: [
      kitTrack('alarm-hook', hook, -6, 0.15),
      kitTrack('drums', drums, -6),
      kitTrack('bells', bells, -10, 0.3),
      kitTrack('press', clanks, -9, -0.2),
      { id: 'ding', instrument: { type: 'drumkit', kit: 'assets/household-machine-kit.json' }, mix: { gainDb: -6 },
        patterns: [{ id: 'end', bars: 1, notes: [{ start: '1:1', pitch: 'microwave-ding', velocity: 0.9 }] }], clips: [{ bar: 5, pattern: 'end' }] },
      { id: 'tempo-string', instrument: { type: 'sampler', sample: 'assets/tempo-string-strike.wav' }, mix: { gainDb: -8, pan: -0.3 },
        patterns: [{ id: 'strike', bars: 1, notes: [{ start: '1:1', velocity: 0.9 }] }], clips: [{ bar: 1, pattern: 'strike' }] },
      { id: 'machine-voice', instrument: { type: 'sampler', sample: 'assets/machine-voice.wav' }, mix: { gainDb: -4 },
        patterns: [{ id: 'phrases', bars: 4, notes: [
          // slices of one 12 s physical-voice performance: child "hel-lo" and monster "HEL-LO"
          { start: '1:1', velocity: 0.85, offsetSeconds: 1.3, endSeconds: 2.55, ...art(0.08) },
          { start: '3:1', velocity: 0.9, offsetSeconds: 7.95, endSeconds: 9.62, ...art(0.06) },
        ] }], clips: [{ bar: 2, pattern: 'phrases' }] },
    ],
  };
  const projectPath = join(root, 'morph-02-household-machine-kit.json');
  json(projectPath, project);
  const compiled = compileProjectFile(projectPath);
  const errors = compiled.diagnostics.filter(d => d.severity === 'error');
  if (errors.length) throw new Error(JSON.stringify(errors, null, 2));
  const rendered = await runCommand('render', projectPath, { outDir: join(root, 'render'), stems: true });
  if (rendered.exitCode !== 0) throw new Error(JSON.stringify(rendered.result, null, 2));
  const { artifacts, warnings = [] } = rendered.result;
  const mp3 = artifacts.wav.replace(/\.wav$/, '.mp3');
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', artifacts.wav, '-codec:a', 'libmp3lame', '-b:a', '256k', '-map_metadata', '-1', mp3]);
  const summary = { engine: ENGINE_VERSION, project: relative(here, projectPath), master: relative(here, artifacts.wav), mp3: relative(here, mp3),
    stems: artifacts.stems.map(s => relative(here, s.wav)), warnings, diagnostics: compiled.diagnostics.length };
  json(join(root, 'integration-summary.json'), summary);
  return summary;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) console.log(JSON.stringify(await integrate(), null, 2));
