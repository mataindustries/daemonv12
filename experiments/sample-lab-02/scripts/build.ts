/** SAMPLE LAB 02 build: original sources -> offline generations -> engine prints -> three sketches -> deliverables.
 * Run from the repository root: node experiments/sample-lab-02/scripts/build.ts
 *
 * 1. Generation 0: write every original source recording twice (projects/assets/sources and work/) and fail unless the
 *    two runs match byte for byte.
 * 2. Offline generations (only what the engine cannot do): the reversed and the slow-motion stairwell take.
 * 3. Engine prints (resampling generations): MUG ÷4 and WHISTLE ÷4.
 * 4. Each sketch is rendered as two identical cycles plus one bar of tail room; the deliverable loop is the second
 *    cycle, which already carries the first cycle's wrapped tails. A three-cycle render proves the seam: its second and
 *    third cycles and the delivered loop must match sample for sample. (Technique reused from SAMPLE LAB 01.)
 * 5. Deliverables: loop WAV, a 320 kbps MP3 with ID3 tags, a four-cycle MP3 for players that leave a gap on repeat,
 *    the engine render manifest, checks.json / CHECKS.md and sources.manifest.json.
 * Intermediate renders go to experiments/sample-lab-02/work/ (ignored by git). Needs Node 22.18+ and FFmpeg. */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './dsp.ts';
import { generate, type SourceFile } from './generate-sources.ts';
import { derive, type Derivation } from './derive.ts';
import { ghostFrequency } from './ghost-frequency.ts';
import { objectOrchestra, mugQuarter } from './object-orchestra.ts';
import { timeFracture, whistleQuarter, SLOWMO_SPEC } from './time-fracture.ts';

const HERE = dirname(fileURLToPath(import.meta.url)), LAB = resolve(HERE, '..'), REPO = resolve(LAB, '..', '..');
const PROJECTS = join(LAB, 'projects'), ASSETS = join(PROJECTS, 'assets'), WORK = join(LAB, 'work'), OUT = join(LAB, 'deliverables');
const CLI = join(REPO, 'bin', 'daemonv12.js'), RATE = 44100;
const rel = (p: string) => relative(REPO, p);
const json = (p: string, v: unknown) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
const r2 = (x: number) => Math.round(x * 100) / 100;
const dbfs = (x: number) => x > 0 ? r2(20 * Math.log10(x)) : null;

// ---------------------------------------------------------------- PCM16 WAV I/O (as in SAMPLE LAB 01)
interface Pcm { channels: number; frames: number; data: Int16Array }
function readWav(path: string): Pcm {
  const b = readFileSync(path);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`not WAV: ${path}`);
  let p = 12, channels = 0, data: Int16Array | null = null;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === 'fmt ') {
      channels = b.readUInt16LE(p + 10);
      if (b.readUInt16LE(p + 8) !== 1 || b.readUInt32LE(p + 12) !== RATE || b.readUInt16LE(p + 22) !== 16) throw new Error(`unsupported WAV: ${path}`);
    } else if (id === 'data') data = new Int16Array(b.buffer.slice(b.byteOffset + p + 8, b.byteOffset + p + 8 + size));
    p += 8 + size + (size & 1);
  }
  if (!channels || !data) throw new Error(`incomplete WAV: ${path}`);
  return { channels, frames: data.length / channels, data };
}
function wavBytes(pcm: Pcm): Buffer {
  const bytes = Buffer.alloc(44 + pcm.data.length * 2), ch = pcm.channels;
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(ch, 22); bytes.writeUInt32LE(RATE, 24);
  bytes.writeUInt32LE(RATE * ch * 2, 28); bytes.writeUInt16LE(ch * 2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(pcm.data.length * 2, 40);
  Buffer.from(pcm.data.buffer, pcm.data.byteOffset, pcm.data.byteLength).copy(bytes, 44);
  return bytes;
}
const crop = (pcm: Pcm, start: number, frames: number): Pcm =>
  ({ channels: pcm.channels, frames, data: pcm.data.slice(start * pcm.channels, (start + frames) * pcm.channels) });
function repeat(pcm: Pcm, times: number): Pcm {
  const data = new Int16Array(pcm.data.length * times);
  for (let k = 0; k < times; k++) data.set(pcm.data, k * pcm.data.length);
  return { channels: pcm.channels, frames: pcm.frames * times, data };
}

// ---------------------------------------------------------------- engine and FFmpeg
function engine(args: string[]): any {
  try { return JSON.parse(execFileSync(process.execPath, [CLI, ...args, '--json'], { cwd: PROJECTS, encoding: 'utf8', maxBuffer: 1 << 28 })); }
  catch (e: any) { throw new Error(`daemonv12 ${args.join(' ')} failed:\n${e.stdout ?? e.message}`); }
}
function render(project: string, outDir: string) {
  rmSync(outDir, { recursive: true, force: true });
  const r = engine(['render', project, '--out-dir', outDir, '--format', 'wav']);
  if (!r.ok || r.warnings.length) throw new Error(`render ${project}: ${JSON.stringify(r.errors?.length ? r.errors : r.warnings)}`);
  const base = project.replace(/\.json$/, '');
  return { wav: join(outDir, `${base}.wav`), manifestPath: join(outDir, `${base}.render.json`), manifest: JSON.parse(readFileSync(join(outDir, `${base}.render.json`), 'utf8')) };
}
const ffmpeg = (args: string[]) => execFileSync('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', ...args], { maxBuffer: 1 << 28 });
function mp3(wav: string, out: string, tags: Record<string, string>) {
  ffmpeg(['-y', '-i', wav, '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '320k', '-id3v2_version', '3',
    ...Object.entries(tags).flatMap(([k, v]) => ['-metadata', `${k}=${v}`]), out]);
  return ffmpeg(['-i', out, '-f', 's16le', '-ac', '2', '-ar', String(RATE), '-']).length / 4;
}

// ---------------------------------------------------------------- 1. generation 0
function sources() {
  const dir = join(ASSETS, 'sources'), again = join(WORK, 'regenerated-sources');
  const first = generate(dir), second = generate(again);
  for (const f of first) if (second.find(x => x.file === f.file)?.sha256 !== f.sha256) throw new Error(`${f.file} is not reproducible`);
  return first.map(f => ({ ...f, path: rel(join(dir, f.file)), regeneratedIdentically: true }));
}

// ---------------------------------------------------------------- 2. offline generations
const DERIVED: { file: string; from: string; sketch: string; d: Derivation; why: string }[] = [
  { file: 'stairwell-reversed.wav', from: 'sources/stairwell.wav', sketch: 'time-fracture', d: { op: 'reverse' }, why: 'the engine has no reverse playback' },
  { file: 'stairwell-slowmo.wav', from: 'sources/stairwell.wav', sketch: 'time-fracture', d: { op: 'stretch', ...SLOWMO_SPEC, peakDbfs: -1 }, why: 'the engine has no pitch-preserving time stretch' },
];
function derived() {
  mkdirSync(join(ASSETS, 'derived'), { recursive: true }); mkdirSync(join(WORK, 'rederived'), { recursive: true });
  return DERIVED.map(x => {
    const a = derive(join(ASSETS, x.from), join(ASSETS, 'derived', x.file), x.d), b = derive(join(ASSETS, x.from), join(WORK, 'rederived', x.file), x.d);
    if (a.sha256 !== b.sha256) throw new Error(`${x.file} is not reproducible`);
    return { file: x.file, path: rel(join(ASSETS, 'derived', x.file)), sketch: x.sketch, input: { path: rel(join(ASSETS, x.from)), sha256: sha256(readFileSync(join(ASSETS, x.from))) },
      operation: x.d, why: x.why, sha256: a.sha256, frames: a.frames, regeneratedIdentically: true };
  });
}

// ---------------------------------------------------------------- 3. engine prints
const PRINTS = [
  { file: 'mug-quarter.wav', sketch: 'object-orchestra', project: mugQuarter() },
  { file: 'whistle-quarter.wav', sketch: 'time-fracture', project: whistleQuarter() },
];
function prints() {
  mkdirSync(join(ASSETS, 'prints'), { recursive: true });
  return PRINTS.map(p => {
    const name = p.file.replace(/\.wav$/, ''), projectFile = `${name}.json`;
    json(join(PROJECTS, projectFile), p.project);
    const r = render(projectFile, join(WORK, name));
    copyFileSync(r.wav, join(ASSETS, 'prints', p.file));
    const bytes = readFileSync(r.wav);
    return { file: p.file, path: rel(join(ASSETS, 'prints', p.file)), sketch: p.sketch, project: rel(join(PROJECTS, projectFile)), projectSha256: r.manifest.project.sha256,
      inputs: r.manifest.samples.assets.map((a: any) => ({ file: a.file, sha256: a.sha256 })), sha256: sha256(bytes), frames: readWav(r.wav).frames };
  });
}

// ---------------------------------------------------------------- 4-5. sketches
interface Sketch { id: string; title: string; n: number; build: (cycles?: number) => any; bars: number }
const SKETCHES: Sketch[] = [
  { id: 'ghost-frequency', title: 'GHOST FREQUENCY', n: 1, build: ghostFrequency, bars: 1 },
  { id: 'object-orchestra', title: 'OBJECT ORCHESTRA', n: 2, build: objectOrchestra, bars: 2 },
  { id: 'time-fracture', title: 'TIME FRACTURE', n: 3, build: timeFracture, bars: 1 },
];

function stats(pcm: Pcm) {
  let peak = 0, full = 0, sum = 0;
  for (const v of pcm.data) { const a = Math.abs(v); if (a > peak) peak = a; if (v >= 32767 || v <= -32768) full++; sum += v * v; }
  return { peakDbfs: dbfs(peak / 32768), rmsDbfs: dbfs(Math.sqrt(sum / pcm.data.length) / 32768), fullScaleSamples: full };
}
function maxDiff(a: Pcm, b: Pcm) {
  let max = 0, count = 0;
  for (let i = 0; i < a.data.length; i++) { const d = Math.abs(a.data[i]! - b.data[i]!); if (d) count++; if (d > max) max = d; }
  return { maxAbsDiffLsb: max, differingSamples: count };
}
function seam(pcm: Pcm) {
  const ch = pcm.channels, steps: number[] = [], seamSteps: number[] = [];
  for (let c = 0; c < ch; c++) {
    for (let i = 1; i < pcm.frames; i++) steps.push(Math.abs(pcm.data[i * ch + c]! - pcm.data[(i - 1) * ch + c]!));
    seamSteps.push(Math.abs(pcm.data[c]! - pcm.data[(pcm.frames - 1) * ch + c]!));
  }
  steps.sort((a, b) => a - b);
  const q = (p: number) => steps[Math.min(steps.length - 1, Math.floor(p * steps.length))]!;
  const worst = Math.max(...seamSteps);
  return { seamStepLsb: seamSteps, interiorStepLsb: { median: q(0.5), p99: q(0.99), max: steps[steps.length - 1] }, seamStepPercentile: r2(100 * steps.filter(s => s < worst).length / steps.length) };
}
function analyze(path: string) { return engine(['analyze', path]).analysis; }

function deliver(s: Sketch) {
  const projectFile = `${s.id}.json`, dir = join(OUT, s.id);
  json(join(PROJECTS, projectFile), s.build(2));
  const two = render(projectFile, join(WORK, s.id, 'two-cycles'));
  const seamProject = `${s.id}.seam-check.json`;
  json(join(PROJECTS, seamProject), s.build(3));
  let three;
  try { three = render(seamProject, join(WORK, s.id, 'three-cycles')); } finally { rmSync(join(PROJECTS, seamProject)); }

  const master2 = readWav(two.wav), master3 = readWav(three.wav), cycleFrames = master2.frames / (2 * s.bars + 1) * s.bars;
  if (!Number.isInteger(cycleFrames) || master3.frames !== 3 * cycleFrames + cycleFrames / s.bars) throw new Error(`${s.id}: unexpected render length`);
  const loop = crop(master2, cycleFrames, cycleFrames), loopBytes = wavBytes(loop);
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${s.id}.wav`), loopBytes);
  copyFileSync(two.manifestPath, join(dir, `${s.id}.render.json`));
  const x4 = join(WORK, s.id, `${s.id}-x4.wav`);
  writeFileSync(x4, wavBytes(repeat(loop, 4)));
  const tags = (title: string) => ({ title, artist: 'DaemonV12 SAMPLE LAB 02', album: 'THE IMPOSSIBLE CRATE (listening sketches)', track: `${s.n}/3`, comment: 'Original sounds generated in mataindustries/daemonv12; see experiments/sample-lab-02/SOURCES.md' });
  const decoded = mp3(join(dir, `${s.id}.wav`), join(dir, `${s.id}.mp3`), tags(s.title));
  const decodedX4 = mp3(x4, join(dir, `${s.id}-x4.mp3`), tags(`${s.title} (x4)`));

  const analysis = analyze(join(dir, `${s.id}.wav`)), production = two.manifest.production ?? {};
  const first = crop(loop, 0, RATE);
  return {
    sketch: s.id, title: s.title,
    loop: { file: `${s.id}.wav`, frames: loop.frames, seconds: r2(loop.frames / RATE * 1000) / 1000, sampleRate: RATE, channels: loop.channels, bitsPerSample: 16, sha256: sha256(loopBytes), sourceWindow: [cycleFrames, 2 * cycleFrames] },
    tempo: { bpm: s.build(2).bpm, timeSignature: s.build(2).timeSignature, barsPerCycle: s.bars },
    loudness: { integratedLufs: analysis.integratedLufs, truePeakDbfs: analysis.truePeakDbfs, loudnessRangeLu: analysis.loudnessRangeLu },
    clipping: { ...stats(loop), engine: { master: { clippedSamples: production.master?.clippedSamples, preClipPeakDbfs: production.master?.preClipPeakDbfs },
      tracks: Object.fromEntries((production.tracks ?? []).map((t: any) => [t.trackId, { clippedSamples: t.clippedSamples, preClipPeakDbfs: t.preClipPeakDbfs }])) } },
    seam: { periodicity: { cycle3VsCycle2: maxDiff(crop(master3, cycleFrames, cycleFrames), crop(master3, 2 * cycleFrames, cycleFrames)), deliveredVsThreeCycle: maxDiff(loop, crop(master3, cycleFrames, cycleFrames)) }, ...seam(loop) },
    opening: { firstSecondRmsDbfs: stats(first).rmsDbfs, loopRmsDbfs: stats(loop).rmsDbfs },
    mp3: { file: `${s.id}.mp3`, bitrateKbps: 320, decodedFrames: decoded, sha256: sha256(readFileSync(join(dir, `${s.id}.mp3`))) },
    mp3x4: { file: `${s.id}-x4.mp3`, cycles: 4, decodedFrames: decodedX4, sha256: sha256(readFileSync(join(dir, `${s.id}-x4.mp3`))) },
    render: { engine: two.manifest.engine, project: rel(join(PROJECTS, projectFile)), projectSha256: two.manifest.project.sha256,
      inputs: two.manifest.samples.assets.map((a: any) => ({ file: a.file, sha256: a.sha256 })) },
  };
}

function checksMarkdown(reports: any[]): string {
  const yes = (b: boolean) => b ? 'pass' : '**FAIL**';
  const lines = ['# SAMPLE LAB 02 · delivery checks', '', 'Generated by `scripts/build.ts` from the engine renders; the machine-readable report is `checks.json`.', '',
    '| Check | ' + reports.map(r => r.title).join(' | ') + ' |', '|---|' + reports.map(() => '---|').join('')];
  const row = (name: string, f: (r: any) => string) => lines.push(`| ${name} | ${reports.map(f).join(' | ')} |`);
  row('Tempo, meter', r => `${r.tempo.bpm} BPM, ${r.tempo.timeSignature} × ${r.tempo.barsPerCycle}`);
  row('Loop length', r => `${r.loop.frames} frames = ${r.loop.seconds.toFixed(3)} s`);
  row('Format', r => `${r.loop.sampleRate} Hz, ${r.loop.channels} ch, PCM16`);
  row('Integrated loudness', r => `${r.loudness.integratedLufs} LUFS`);
  row('True peak / sample peak', r => `${r.loudness.truePeakDbfs} dBTP / ${r.clipping.peakDbfs} dBFS (${yes(r.loudness.truePeakDbfs <= -1)})`);
  row('Full-scale samples in loop', r => `${r.clipping.fullScaleSamples} (${yes(r.clipping.fullScaleSamples === 0)})`);
  row('Engine overloads (master / tracks)', r => `${r.clipping.engine.master.clippedSamples} / ${Object.values(r.clipping.engine.tracks).reduce((a: number, t: any) => a + t.clippedSamples, 0)} (${yes(r.clipping.engine.master.clippedSamples === 0 && Object.values(r.clipping.engine.tracks).every((t: any) => t.clippedSamples === 0))})`);
  row('Periodicity: cycle 3 vs cycle 2', r => `max ${r.seam.periodicity.cycle3VsCycle2.maxAbsDiffLsb} LSB (${yes(r.seam.periodicity.cycle3VsCycle2.maxAbsDiffLsb === 0)})`);
  row('Periodicity: delivered loop vs 3-cycle render', r => `max ${r.seam.periodicity.deliveredVsThreeCycle.maxAbsDiffLsb} LSB (${yes(r.seam.periodicity.deliveredVsThreeCycle.maxAbsDiffLsb === 0)})`);
  row('Seam step (last→first sample, L/R)', r => `${r.seam.seamStepLsb.join('/')} LSB; interior p99 ${r.seam.interiorStepLsb.p99} (p${r.seam.seamStepPercentile})`);
  row('MP3 (320 kbps) decoded length', r => `${r.mp3.decodedFrames} frames (${yes(r.mp3.decodedFrames === r.loop.frames)})`);
  row('MP3 ×4 decoded length', r => `${r.mp3x4.decodedFrames} frames (${yes(r.mp3x4.decodedFrames === 4 * r.loop.frames)})`);
  row('First second vs loop RMS', r => `${r.opening.firstSecondRmsDbfs} vs ${r.opening.loopRmsDbfs} dBFS`);
  lines.push('', 'The seam is proven by periodicity rather than by fades: the delivered loop is a window of a continuous render, and the next',
    'cycle of that render repeats it exactly, so the sample after the last frame of the loop is the loop\'s first frame. No crossfade,',
    'fade-in or fade-out is applied anywhere. The ×4 MP3 is the same loop four times in a row, for players that pause between repeats.', '');
  return lines.join('\n') + '\n';
}

/** Rights and provenance for everything the sketches read. Evidence only; the owner decides licensing. */
function sourcesManifest(gen0: any[], gen1: any[], gen2: any[], reports: any[]) {
  const generators: Record<string, string> = {
    'intercept.wav': 'scripts/ghost-sources.ts (+ voice.ts)', 'hum.wav': 'scripts/ghost-sources.ts',
    'mug.wav': 'scripts/object-sources.ts', 'drips.wav': 'scripts/object-sources.ts', 'box.wav': 'scripts/object-sources.ts', 'book.wav': 'scripts/object-sources.ts', 'coin.wav': 'scripts/object-sources.ts',
    'stairwell.wav': 'scripts/whistle-source.ts',
  };
  return {
    lab: 'SAMPLE LAB 02 — THE IMPOSSIBLE CRATE', note: 'Every sound the three sketches read, with origin, generation and hash. Not legal advice.',
    rights: { license: 'not yet declared (owner decision; CC0-1.0 proposed for consistency with the existing packs)', basis: 'original synthesis and processing written for this lab; Node built-ins and the DaemonV12 engine only; no recordings, downloads, samples or third-party material of any kind', thirdPartyMaterial: 'none' },
    generation0: gen0.map(g => ({ ...g, origin: 'generated', generator: `experiments/sample-lab-02/${generators[g.file]}`, method: 'physical/acoustic model, seeded xorshift32; no microphone recording' })),
    offlineGenerations: gen1, enginePrints: gen2,
    sketches: reports.map(r => ({ sketch: r.sketch, project: r.render.project, projectSha256: r.render.projectSha256, inputs: r.render.inputs, loopSha256: r.loop.sha256 })),
    excluded: [
      { source: 'SAMPLE LAB 01 palette and the GLASSHOUSE / Orbital Foundry packs', reason: 'not needed: this lab starts from new recordings so each sketch has its own fingerprint' },
      { source: 'MORPH v1 pack, FluidR3 GM SoundFont', reason: 'rights undocumented (see SAMPLE LAB 01 SOURCES.md and the BANGER LAB 001 audit)' },
    ],
  };
}

// ---------------------------------------------------------------- run
mkdirSync(WORK, { recursive: true }); mkdirSync(OUT, { recursive: true });
const gen0: (SourceFile & { path: string })[] = sources();
const gen1 = derived();
const gen2 = prints();
const reports = SKETCHES.map(deliver);
json(join(OUT, 'checks.json'), { lab: 'SAMPLE LAB 02', sources: gen0, offlineGenerations: gen1, enginePrints: gen2, sketches: reports });
json(join(LAB, 'sources.manifest.json'), sourcesManifest(gen0, gen1, gen2, reports));
writeFileSync(join(OUT, 'CHECKS.md'), checksMarkdown(reports));
for (const r of reports) {
  const pass = r.clipping.fullScaleSamples === 0 && r.seam.periodicity.cycle3VsCycle2.maxAbsDiffLsb === 0 && r.seam.periodicity.deliveredVsThreeCycle.maxAbsDiffLsb === 0
    && r.mp3.decodedFrames === r.loop.frames && r.mp3x4.decodedFrames === 4 * r.loop.frames && r.loudness.truePeakDbfs <= -1;
  console.log(`${r.title.padEnd(17)} ${pass ? 'PASS' : 'CHECK'}  ${r.loop.seconds.toFixed(3)} s  ${r.loudness.integratedLufs} LUFS  ${r.loudness.truePeakDbfs} dBTP  seam ${r.seam.seamStepLsb.join('/')} LSB (p${r.seam.seamStepPercentile})  periodic ${r.seam.periodicity.cycle3VsCycle2.maxAbsDiffLsb}/${r.seam.periodicity.deliveredVsThreeCycle.maxAbsDiffLsb}  mp3 ${r.mp3.decodedFrames}/${r.mp3x4.decodedFrames}`);
}
console.log(`deliverables in ${rel(OUT)}`);
