// MORPH//01 audio enters the existing v0.7 sampler boundary as exported PCM.
// No engine extension is implied by this adapter.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileProjectFile, runCommand } from '../../src/pipeline.ts';
import { readWavInfo } from '../../src/render/wav.ts';
import { ENGINE_VERSION } from '../../src/version.ts';

const RATE = 44100, SECONDS = 12, FRAMES = RATE * SECONDS, FPS = 60;
const TAU = Math.PI * 2;
const json = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

function noise(seed) {
  let state = seed >>> 0;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 2147483648 - 1; };
}

// Backing sounds are newly synthesized for this experiment, never copied from
// SIGNAL, historical assets or a third party. They are deliberately restrained.
function writeMono(path, seconds, sampleAt) {
  const frames = Math.round(seconds * RATE), wav = Buffer.alloc(44 + frames * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(RATE, 24); wav.writeUInt32LE(RATE * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++) {
    const fade = Math.min(1, i / 88, (frames - 1 - i) / 220);
    const value = sampleAt(i / RATE, i) * Math.max(0, fade);
    if (!Number.isFinite(value) || Math.abs(value) > 0.98) throw new RangeError('Backing synthesis exceeds headroom');
    wav.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  writeFileSync(path, wav);
}

function backing(assets) {
  mkdirSync(assets, { recursive: true });
  const kickNoise = noise(0x4d4f5250);
  writeMono(join(assets, 'kick.wav'), 0.34, t => {
    // Integral of a 48 Hz carrier with an exponentially decaying pitch impulse.
    const phase = TAU * (48 * t + 72 * 0.018 * (1 - Math.exp(-t / 0.018)));
    return 0.67 * Math.sin(phase) * Math.exp(-t / 0.087) + 0.025 * kickNoise() * Math.exp(-t / 0.006);
  });
  const clapNoise = noise(0x53494e47);
  let clapPrevious = 0;
  writeMono(join(assets, 'clap.wav'), 0.19, t => {
    const n = clapNoise(), high = (n - clapPrevious) * 0.5; clapPrevious = n;
    const envelope = Math.exp(-t / 0.045) * (0.38 + 0.62 * Math.sin(TAU * 83 * t) ** 2);
    return high * envelope * 0.30 + 0.018 * Math.sin(TAU * 1340 * t) * Math.exp(-t / 0.02);
  });
  const tickNoise = noise(0x4d414348);
  let tickPrevious = 0;
  writeMono(join(assets, 'tick.wav'), 0.075, t => {
    const n = tickNoise(), high = (n - tickPrevious) * 0.5; tickPrevious = n;
    return (0.10 * high + 0.055 * Math.sin(TAU * 4261 * t) + 0.025 * Math.sin(TAU * 6289 * t)) * Math.exp(-t / 0.014);
  });
  for (const [name, midi] of [['sub-cs', 37], ['sub-a', 33], ['sub-gs', 32]]) {
    const hz = 440 * 2 ** ((midi - 69) / 12);
    writeMono(join(assets, `${name}.wav`), 1.78, t => {
      const attack = Math.min(1, t / 0.018), release = Math.min(1, (1.78 - t) / 0.18);
      return 0.30 * attack * release * Math.exp(-t / 3) * (Math.sin(TAU * hz * t) + 0.13 * Math.sin(TAU * hz * 2 * t));
    });
  }
  json(join(assets, 'rhythm-kit.json'), { formatVersion: 1, samples: [
    { name: 'kick', pitch: 36, file: 'kick.wav' },
    { name: 'clap', pitch: 38, file: 'clap.wav' },
    { name: 'tick', pitch: 42, file: 'tick.wav' },
  ] });
  json(join(assets, 'bass-kit.json'), { formatVersion: 1, samples: [
    { name: 'sub-cs', pitch: 37, file: 'sub-cs.wav' },
    { name: 'sub-a', pitch: 33, file: 'sub-a.wav' },
    { name: 'sub-gs', pitch: 32, file: 'sub-gs.wav' },
  ] });
}

function pos(seconds) {
  const eighth = Math.round(seconds * 4), bar = Math.floor(eighth / 8) + 1;
  return `${bar}:${Math.floor(eighth % 8 / 2) + 1}${eighth % 2 ? '+1/8' : ''}`;
}

const rhythmTrack = (id, notes, gainDb, pan = 0) => ({
  id, instrument: { type: 'drumkit', kit: 'assets/rhythm-kit.json' },
  mix: { gainDb, pan }, patterns: [{ id: 'cue', bars: 6, notes }], clips: [{ bar: 1, pattern: 'cue' }],
});

export function cueProject() {
  const kick = [], clap = [], tick = [];
  for (let bar = 0; bar < 6; bar++) {
    for (const offset of (bar % 2 ? [0, 1, 1.75] : [0, 1])) {
      kick.push({ start: pos(bar * 2 + offset), pitch: 'kick', velocity: offset === 1.75 ? 0.55 : 0.8,
        gate: '1/4', envelope: { attackSeconds: 0.002, releaseSeconds: 0.012 }, chokeGroup: 'kick' });
    }
    for (const offset of [0.5, 1.5]) clap.push({ start: pos(bar * 2 + offset), pitch: 'clap', velocity: bar === 0 ? 0.40 : 0.62,
      endSeconds: 0.19, envelope: { attackSeconds: 0.002, releaseSeconds: 0.012 } });
    for (const offset of (bar < 2 ? [0.25, 0.75, 1.25, 1.75] : [0.25, 0.5, 0.75, 1.25, 1.5, 1.75])) {
      tick.push({ start: pos(bar * 2 + offset), pitch: 'tick', velocity: offset % 0.5 ? 0.70 : 0.35,
        endSeconds: 0.075, envelope: { attackSeconds: 0.001, releaseSeconds: 0.005 } });
    }
  }
  return {
    formatVersion: 1, title: 'MORPH 01 - The Singing Machine',
    description: 'Six-bar science-fiction cue: a single evolving MORPH hook, a C-sharp/A/G-sharp bass arc and an asymmetric two-bar pulse. Newly synthesized backing. The v0.7 sampler plays the complete expressive performance at unity rate; timbre remains baked into that source.',
    bpm: 120, timeSignature: '4/4', key: 'C# minor', bars: 6, seed: 1297044048,
    render: { duration: { seconds: 12 }, tail: 'none' }, master: { gainDb: -1.5 },
    tracks: [
      { id: 'morph-voice', description: 'The expressive 12-second instrument performance at unity playback rate.',
        instrument: { type: 'sampler', sample: 'assets/morph-hook.wav' }, mix: { gainDb: -1 },
        patterns: [{ id: 'hook', bars: 6, notes: [{ start: '1:1', velocity: 0.92, playbackRate: 1,
          endSeconds: 12, gate: '6/1', envelope: { attackSeconds: 0.004, releaseSeconds: 0.06 } }] }],
        clips: [{ bar: 1, pattern: 'hook' }] },
      { id: 'sub', instrument: { type: 'drumkit', kit: 'assets/bass-kit.json' }, mix: { gainDb: -5 },
        patterns: [{ id: 'bass-arc', bars: 6, notes: ['sub-cs', 'sub-cs', 'sub-a', 'sub-a', 'sub-gs', 'sub-cs'].map((pitch, i) => ({
          start: `${i + 1}:1`, pitch, velocity: i === 5 ? 0.82 : 0.68, gate: '1/1',
          envelope: { attackSeconds: 0.006, releaseSeconds: 0.06 }, chokeGroup: 'sub',
        })) }], clips: [{ bar: 1, pattern: 'bass-arc' }] },
      rhythmTrack('kick', kick, -5), rhythmTrack('clap', clap, -5, -0.15),
      { ...rhythmTrack('clock', tick, -3, 0.22), automation: { pan: [
        { at: { seconds: 0 }, value: -0.42, transition: 'linear' },
        { at: { seconds: 4 }, value: 0.42, transition: 'linear' },
        { at: { seconds: 8 }, value: -0.42, transition: 'linear' },
        { at: { seconds: 12 }, value: 0.42 },
      ] } },
    ],
  };
}

export function syncMap(project = cueProject(), performance = null) {
  const events = [];
  for (let beat = 0; beat < 24; beat++) events.push({
    id: `beat-${String(beat + 1).padStart(2, '0')}`, atSeconds: beat / 2,
    pictureFrame: beat * 30, audioFrame: beat * 22050,
    kind: beat % 4 === 0 ? 'bar' : 'beat', bar: Math.floor(beat / 4) + 1, beat: beat % 4 + 1,
    action: beat % 4 === 0 ? 'Cut / impulse on the two-second structural downbeat.' : 'Small pulse on the quarter-note grid.',
  });
  // These marks describe the proposed picture movement. Note marks, when
  // supplied by the author, come from the same source performance JSON.
  for (const [atSeconds, id, action] of [
    [0, 'reveal', 'A suspended glass body resolves out of darkness.'],
    [4, 'contact', 'The machine appears to form a mouth; close camera movement.'],
    [8, 'instability', 'Metal surfaces distort while the pulse holds the scene together.'],
    [10, 'recognition', 'Return to the first visual motif for the final response.'],
    [11.5, 'release', 'Final half-second: let the object and voice settle.'],
  ]) events.push({ id, kind: 'picture-direction', atSeconds, pictureFrame: Math.round(atSeconds * FPS), audioFrame: Math.round(atSeconds * RATE), action });
  if (performance?.notes) for (let i = 0; i < performance.notes.length; i++) {
    const note = performance.notes[i], atSeconds = note.at;
    if (atSeconds >= 0 && atSeconds < SECONDS) events.push({ id: `morph-note-${i + 1}`, kind: 'morph-note', atSeconds,
      pictureFrame: Math.min(719, Math.round(atSeconds * FPS)), audioFrame: Math.round(atSeconds * RATE),
      ...(note.midi !== undefined ? { midi: note.midi } : { hz: note.hz }), velocity: note.velocity });
  }
  events.sort((a, b) => a.audioFrame - b.audioFrame || a.id.localeCompare(b.id));
  for (const event of events) {
    event.pictureAtSeconds = event.pictureFrame / FPS;
    event.pictureResidualSeconds = event.pictureAtSeconds - event.atSeconds;
    event.pictureResidualAudioFrames = event.pictureFrame * RATE / FPS - event.audioFrame;
  }
  return {
    formatVersion: 1, title: project.title, bpm: 120, seconds: SECONDS,
    sampleRate: RATE, audioFrames: FRAMES, audioEndExclusive: FRAMES,
    pictureFps: FPS, pictureFrames: 720, pictureEndExclusive: 720,
    mapping: 'Audio starts at frame 0. Each picture-frame onset maps to round(pictureFrame * 44100 / 60), ties later. Events retain source atSeconds and nearest audioFrame; pictureFrame is the nearest displayed picture frame (ties later, capped at 719). pictureResidualSeconds and pictureResidualAudioFrames report picture onset minus source event, so a positive value means the picture follows the audio. Picture index 720 is the exclusive endpoint, not a displayed frame.',
    frames: Array.from({ length: 720 }, (_, pictureFrame) => ({ pictureFrame, atSeconds: pictureFrame / FPS,
      audioFrame: Math.round(pictureFrame * RATE / FPS), audioEndExclusive: Math.round((pictureFrame + 1) * RATE / FPS),
      events: events.filter(event => event.pictureFrame === pictureFrame).map(event => event.id),
    })), events,
  };
}

export async function integrate(outputRoot, options = {}) {
  if (ENGINE_VERSION !== '0.7.0') throw new Error(`This integration demonstration pins DaemonV12 0.7.0, received ${ENGINE_VERSION}`);
  outputRoot = resolve(outputRoot);
  const root = join(outputRoot, 'cue'), assets = join(root, 'assets');
  mkdirSync(assets, { recursive: true });
  const source = join(outputRoot, 'demos', 'the-performance.wav');
  const sourceInfo = readWavInfo(source);
  if (!sourceInfo.ok || sourceInfo.info.frames !== FRAMES || sourceInfo.info.sampleRate !== RATE || sourceInfo.info.bitsPerSample !== 16 || sourceInfo.info.formatTag !== 1) {
    throw new Error('Integration needs the 12-second 44.1 kHz PCM16 MORPH performance');
  }
  copyFileSync(source, join(assets, 'morph-hook.wav')); backing(assets);
  const project = join(root, 'morph-01-cue.json'), definition = cueProject(); json(project, definition);
  const compilation = compileProjectFile(project);
  if (compilation.diagnostics.some(item => item.severity === 'error')) throw new Error(JSON.stringify(compilation.diagnostics));
  let performance = options.performance;
  const performancePath = join(outputRoot, 'performances', 'the-performance.json');
  if (!performance && existsSync(performancePath)) performance = performancePath;
  if (typeof performance === 'string') performance = JSON.parse(readFileSync(performance, 'utf8'));
  const events = join(root, 'visual-events.json'); json(events, syncMap(definition, performance));
  const rendered = await runCommand('render', project, { outDir: join(root, 'render'), stems: true });
  if (rendered.exitCode !== 0) throw new Error(JSON.stringify(rendered.result));
  json(join(root, 'pipeline-result.json'), { ...rendered.result, project: relative(root, project), artifacts: Object.fromEntries(Object.entries(rendered.result.artifacts).map(([key, value]) => [key,
    Array.isArray(value) ? value.map(stem => ({ ...stem, wav: relative(root, stem.wav) })) : relative(root, value),
  ])) });
  const { artifacts } = rendered.result;
  for (const path of [artifacts.wav, ...artifacts.stems.map(stem => stem.wav)]) {
    const info = readWavInfo(path);
    if (!info.ok || info.info.frames !== FRAMES || info.info.channels !== 2 || info.info.sampleRate !== RATE || info.info.bitsPerSample !== 16) throw new Error(`Unexpected cue/stem format: ${path}`);
  }
  return { project, master: artifacts.wav, stems: artifacts.stems, events, manifest: artifacts.manifest, analysis: artifacts.analysis,
    warnings: rendered.result.warnings };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputRoot = process.argv[2];
  if (!outputRoot) throw new Error('Usage: node experiments/morph-voice/integrate.mjs OUTPUT_ROOT');
  console.log(JSON.stringify(await integrate(outputRoot), null, 2));
}
