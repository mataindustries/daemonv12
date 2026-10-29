/** SAMPLE LAB 03 build: approved SAMPLE LAB 02 recordings -> TAKE print -> MIRROR -> the MUTATION loop and deliverables.
 * Run from the repository root: node experiments/sample-lab-03/scripts/build.ts
 *
 * 1. Copy the approved SAMPLE LAB 02 recordings this lab reads (and its MUG ÷4 print) byte for byte, refusing to run
 *    unless each copy matches the SHA-256 in SAMPLE LAB 02's sources.manifest.json. SAMPLE LAB 02 is only read.
 * 2. Render TAKE (one bar of the band) with the engine; derive MIRROR offline: TAKE's first bar with its frames reversed,
 *    bit-exact (the engine has no reverse playback).
 * 3. Render the loop as two identical four-bar cycles plus one bar of tail room, with stems; the deliverable is the
 *    second cycle. A three-cycle render proves the seam: its second and third cycles and the delivered loop (master and
 *    every stem) must match sample for sample. (Technique reused from SAMPLE LAB 01/02.)
 * 4. Write the loop WAV, a 320 kbps MP3, a four-cycle MP3, aligned stems, a DaemonV12 event map, the render manifest,
 *    checks.json / CHECKS.md and sources.manifest.json. Intermediate renders go to work/ (ignored by git). */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildEventMap, serializeEventMap, type ScheduledEvent } from '../../../src/sync/index.ts';
import { takeProject, mutation, TRACK_EVENTS, regionOf, BPM } from './mutation.ts';

const HERE = dirname(fileURLToPath(import.meta.url)), LAB = resolve(HERE, '..'), REPO = resolve(LAB, '..', '..'), LAB02 = join(REPO, 'experiments', 'sample-lab-02');
const PROJECTS = join(LAB, 'projects'), ASSETS = join(PROJECTS, 'assets'), WORK = join(LAB, 'work'), OUT = join(LAB, 'deliverables');
const CLI = join(REPO, 'bin', 'daemonv12.js'), RATE = 44100, BAR = 2 * RATE, LOOP = 4 * BAR, ID = 'mutation', TITLE = 'MUTATION';
const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const rel = (p: string) => relative(REPO, p);
const json = (p: string, v: unknown) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
const r2 = (x: number) => Math.round(x * 100) / 100;
const dbfs = (x: number) => x > 0 ? r2(20 * Math.log10(x)) : null;

// ---------------------------------------------------------------- PCM16 WAV I/O (as in SAMPLE LAB 01/02)
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
function reversed(pcm: Pcm): Pcm {
  const ch = pcm.channels, data = new Int16Array(pcm.data.length);
  for (let i = 0; i < pcm.frames; i++) for (let k = 0; k < ch; k++) data[(pcm.frames - 1 - i) * ch + k] = pcm.data[i * ch + k]!;
  return { channels: ch, frames: pcm.frames, data };
}
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
function render(project: string, outDir: string, stems: boolean) {
  rmSync(outDir, { recursive: true, force: true });
  const r = engine(['render', project, '--out-dir', outDir, '--format', 'wav', ...(stems ? ['--stems'] : [])]);
  if (!r.ok || r.warnings.length) throw new Error(`render ${project}: ${JSON.stringify(r.errors?.length ? r.errors : r.warnings)}`);
  const base = project.replace(/\.json$/, '');
  return { wav: join(outDir, `${base}.wav`), stems: join(outDir, `${base}.stems`), manifestPath: join(outDir, `${base}.render.json`), manifest: JSON.parse(readFileSync(join(outDir, `${base}.render.json`), 'utf8')) };
}
const ffmpeg = (args: string[]) => execFileSync('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', ...args], { maxBuffer: 1 << 28 });
function mp3(wav: string, out: string, title: string) {
  ffmpeg(['-y', '-i', wav, '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '320k', '-id3v2_version', '3',
    '-metadata', `title=${title}`, '-metadata', 'artist=DaemonV12 SAMPLE LAB 03', '-metadata', 'album=OBJECT ORCHESTRA: MUTATION (candidate)',
    '-metadata', 'comment=Original sounds generated in mataindustries/daemonv12; see experiments/sample-lab-03/SOURCES.md', out]);
  return ffmpeg(['-i', out, '-f', 's16le', '-ac', '2', '-ar', String(RATE), '-']).length / 4;
}

// ---------------------------------------------------------------- 1. approved SAMPLE LAB 02 recordings
const IMPORTS = [
  { file: 'mug.wav', from: 'projects/assets/sources/mug.wav', to: 'sources', role: 'the mug at its own pitch in TAKE' },
  { file: 'drips.wav', from: 'projects/assets/sources/drips.wav', to: 'sources', role: 'the riff and the bounce in TAKE' },
  { file: 'box.wav', from: 'projects/assets/sources/box.wav', to: 'sources', role: 'kick' },
  { file: 'book.wav', from: 'projects/assets/sources/book.wav', to: 'sources', role: 'snare' },
  { file: 'coin.wav', from: 'projects/assets/sources/coin.wav', to: 'sources', role: 'the landing' },
  { file: 'mug-quarter.wav', from: 'projects/assets/prints/mug-quarter.wav', to: 'prints', role: 'MUG ÷4, played at quarter speed again in TAKE: the bass' },
];
function imports() {
  const manifest = JSON.parse(readFileSync(join(LAB02, 'sources.manifest.json'), 'utf8'));
  const approved = [...manifest.generation0, ...manifest.enginePrints] as { file: string; sha256: string }[];
  return IMPORTS.map(x => {
    const src = join(LAB02, x.from), bytes = readFileSync(src), want = approved.find(a => a.file === x.file)?.sha256;
    if (!want || want !== sha256(bytes)) throw new Error(`${rel(src)} does not match SAMPLE LAB 02's sources.manifest.json`);
    mkdirSync(join(ASSETS, x.to), { recursive: true });
    copyFileSync(src, join(ASSETS, x.to, x.file));
    return { file: x.file, path: rel(join(ASSETS, x.to, x.file)), copiedFrom: rel(src), sha256: want, role: x.role, verifiedAgainst: 'experiments/sample-lab-02/sources.manifest.json' };
  });
}

// ---------------------------------------------------------------- 2. TAKE and MIRROR
function takeAndMirror() {
  json(join(PROJECTS, 'take.json'), takeProject());
  const r = render('take.json', join(WORK, 'take'), false);
  copyFileSync(r.wav, join(ASSETS, 'prints', 'take.wav'));
  const takePcm = readWav(r.wav), mirror = wavBytes(reversed(crop(takePcm, 0, BAR)));
  mkdirSync(join(ASSETS, 'derived'), { recursive: true });
  writeFileSync(join(ASSETS, 'derived', 'mirror.wav'), mirror);
  const again = wavBytes(reversed(crop(readWav(join(ASSETS, 'prints', 'take.wav')), 0, BAR)));
  if (sha256(again) !== sha256(mirror)) throw new Error('mirror.wav is not reproducible');
  const takeSha = sha256(readFileSync(r.wav));
  return {
    take: { file: 'take.wav', path: rel(join(ASSETS, 'prints', 'take.wav')), project: rel(join(PROJECTS, 'take.json')), projectSha256: r.manifest.project.sha256,
      inputs: r.manifest.samples.assets.map((a: any) => ({ file: a.file, sha256: a.sha256 })), sha256: takeSha, frames: takePcm.frames },
    mirror: { file: 'mirror.wav', path: rel(join(ASSETS, 'derived', 'mirror.wav')), input: { file: 'take.wav', sha256: takeSha },
      operation: `frames 0-${BAR - 1} of take.wav in reverse order (bit-exact; no level change, no fades)`, why: 'the engine has no reverse playback', sha256: sha256(mirror), frames: BAR },
  };
}

// ---------------------------------------------------------------- 3-4. the loop
const TICK_MS = 60000 / BPM / 960;
function eventMap(manifest: any, projectFile: string) {
  const events: ScheduledEvent[] = [], rows: any[] = [];
  for (const track of manifest.samples.tracks) {
    const authored = (TRACK_EVENTS[track.trackId] ?? []).map(e => ({ e, used: false }));
    track.triggers.forEach((trig: any, index: number) => {
      if (trig.frame < LOOP || trig.frame >= 2 * LOOP) return;
      const cycleTick = trig.tick - 16 * 960;
      const match = authored.find(a => !a.used && ((a.e.t % (16 * 960)) + 16 * 960) % (16 * 960) === cycleTick);
      if (!match) throw new Error(`${track.trackId}: no authored event at tick ${cycleTick}`);
      match.used = true;
      const offsetTicks = match.e.t - match.e.nominal, rateNow = trig.playback?.rate ?? 1, offset = trig.playback?.offset?.seconds ?? 0;
      const source: Record<string, any> = {
        adapter: 'sample-lab-03/render-manifest-v1', trackIndex: track.trackIndex, triggerIndex: index, tick: cycleTick,
        position: `${Math.floor(cycleTick / 3840) + 1}:${Math.floor((cycleTick % 3840) / 960) + 1}+${cycleTick % 960}/960`,
        humanOffsetTicks: offsetTicks, humanOffsetMs: r2(offsetTicks * TICK_MS), sample: trig.file,
        ...(regionOf(track.trackId, offset, rateNow) ? { reads: regionOf(track.trackId, offset, rateNow) } : {}),
        playback: { rate: rateNow, offsetSeconds: offset, ...(trig.playback?.glide ? { glide: trig.playback.glide } : {}) },
        ...(trig.articulation ? { articulation: { renderedFrames: trig.articulation.renderedFrames, ...(trig.articulation.gate ? { gate: trig.articulation.gate.duration } : {}), ...(trig.articulation.chokeGroup ? { chokeGroup: trig.articulation.chokeGroup } : {}) } } : {}),
      };
      events.push({ sampleFrame: trig.frame, trackId: track.trackId, eventId: `${track.trackId}-${String(index).padStart(3, '0')}`, velocity: trig.velocity, visualRoles: [track.trackId], source });
      rows.push({ track: track.trackId, frame: trig.frame - LOOP, offsetMs: source.humanOffsetMs });
    });
    const unused = authored.filter(a => !a.used);
    if (unused.length) throw new Error(`${track.trackId}: ${unused.length} authored events missing from the second cycle`);
  }
  const map = buildEventMap(events, { sampleRate: RATE, fps: { numerator: 60, denominator: 1 }, clip: { startSampleFrame: LOOP, endSampleFrame: 2 * LOOP },
    source: { adapter: 'sample-lab-03/render-manifest-v1', loop: ID, project: projectFile, projectSha256: manifest.project.sha256,
      note: 'clipSampleFrame is the frame inside the delivered 352800-frame loop; sampleFrame is the frame in the two-cycle engine render.' } });
  return { map, rows };
}
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
  const worst = Math.max(...seamSteps);
  return { seamStepLsb: seamSteps, interiorStepLsb: { median: steps[Math.floor(steps.length / 2)], p99: steps[Math.floor(0.99 * steps.length)], max: steps[steps.length - 1] }, seamStepPercentile: r2(100 * steps.filter(s => s < worst).length / steps.length) };
}
function bestLag(a: Float64Array, b: Float64Array, maxLag = 64) {
  let best = { lag: 0, correlation: -Infinity }, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { aa += a[i]! ** 2; bb += b[i]! ** 2; }
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let ab = 0;
    for (let i = Math.max(0, -lag * 2); i < Math.min(a.length, b.length - lag * 2); i++) ab += a[i]! * b[i + lag * 2]!;
    const r = ab / Math.sqrt(aa * bb);
    if (r > best.correlation) best = { lag, correlation: Math.round(1e5 * r) / 1e5 };
  }
  return best;
}

function deliver() {
  const projectFile = `${ID}.json`, dir = join(OUT, ID), stemDir = join(dir, 'stems');
  json(join(PROJECTS, projectFile), mutation(2));
  const two = render(projectFile, join(WORK, 'two-cycles'), true);
  const seamProject = `${ID}.seam-check.json`;
  json(join(PROJECTS, seamProject), mutation(3));
  let three;
  try { three = render(seamProject, join(WORK, 'three-cycles'), true); } finally { rmSync(join(PROJECTS, seamProject)); }
  const master2 = readWav(two.wav), master3 = readWav(three.wav);
  if (master2.frames !== 2 * LOOP + BAR || master3.frames !== 3 * LOOP + BAR) throw new Error('unexpected render length');
  const loop = crop(master2, LOOP, LOOP), loopBytes = wavBytes(loop);
  rmSync(dir, { recursive: true, force: true }); mkdirSync(stemDir, { recursive: true });
  writeFileSync(join(dir, `${ID}.wav`), loopBytes);
  copyFileSync(two.manifestPath, join(dir, `${ID}.render.json`));

  const tracks: string[] = mutation(2).tracks.map(t => t.id), stemReports = [], sum = new Float64Array(loop.data.length);
  let stemsPeriodic = { maxAbsDiffLsb: 0, differingSamples: 0 };
  for (const [i, t] of tracks.entries()) {
    const s2 = readWav(join(two.stems, `${t}.wav`)), s3 = readWav(join(three.stems, `${t}.wav`)), stem = crop(s2, LOOP, LOOP);
    const bytes = wavBytes(stem), name = `${String(i + 1).padStart(2, '0')}-${t}.wav`;
    writeFileSync(join(stemDir, name), bytes);
    for (let k = 0; k < sum.length; k++) sum[k]! += stem.data[k]!;
    const d = maxDiff(crop(s3, LOOP, LOOP), crop(s3, 2 * LOOP, LOOP)), same = maxDiff(stem, crop(s3, LOOP, LOOP));
    stemsPeriodic = { maxAbsDiffLsb: Math.max(stemsPeriodic.maxAbsDiffLsb, d.maxAbsDiffLsb, same.maxAbsDiffLsb), differingSamples: stemsPeriodic.differingSamples + d.differingSamples + same.differingSamples };
    stemReports.push({ track: t, file: `stems/${name}`, frames: stem.frames, sha256: sha256(bytes), ...stats(stem) });
  }
  const x4 = join(WORK, `${ID}-x4.wav`);
  writeFileSync(x4, wavBytes(repeat(loop, 4)));
  const decoded = mp3(join(dir, `${ID}.wav`), join(dir, `${ID}.mp3`), TITLE), decodedX4 = mp3(x4, join(dir, `${ID}-x4.mp3`), `${TITLE} (x4)`);
  const { map, rows } = eventMap(two.manifest, projectFile);
  writeFileSync(join(dir, `${ID}.events.json`), serializeEventMap(map) + '\n');

  const analysis = engine(['analyze', join(dir, `${ID}.wav`)]).analysis, production = two.manifest.production ?? {};
  const mixed = new Float64Array(loop.data.length); loop.data.forEach((v, k) => { mixed[k] = v; });
  const sumAlignment = bestLag(sum, mixed);
  return {
    loop: ID, title: TITLE,
    file: { name: `${ID}.wav`, frames: loop.frames, seconds: loop.frames / RATE, sampleRate: RATE, channels: loop.channels, bitsPerSample: 16, sha256: sha256(loopBytes), sourceWindow: [LOOP, 2 * LOOP] },
    tempo: { bpm: BPM, timeSignature: '4/4', bars: 4 },
    loudness: { integratedLufs: analysis.integratedLufs, truePeakDbfs: analysis.truePeakDbfs, loudnessRangeLu: analysis.loudnessRangeLu },
    clipping: { ...stats(loop), engine: { master: { clippedSamples: production.master?.clippedSamples, preClipPeakDbfs: production.master?.preClipPeakDbfs },
      tracks: Object.fromEntries((production.tracks ?? []).map((t: any) => [t.trackId, { clippedSamples: t.clippedSamples, preClipPeakDbfs: t.preClipPeakDbfs }])) } },
    seam: { periodicity: { cycle3VsCycle2: maxDiff(crop(master3, LOOP, LOOP), crop(master3, 2 * LOOP, LOOP)), deliveredVsThreeCycle: maxDiff(loop, crop(master3, LOOP, LOOP)), stems: stemsPeriodic }, ...seam(loop) },
    stems: { count: stemReports.length, aligned: stemReports.every(s => s.frames === LOOP) && sumAlignment.lag === 0, sumVsMaster: sumAlignment,
      note: 'stems include track gain, pan and effects and exclude the master chain (gain, high-pass, compressor, saturation); best cross-correlation lag of their sum against the master within +/-64 frames', files: stemReports },
    bars: [0, 1, 2, 3].map(b => ({ bar: b + 1, rmsDbfs: stats(crop(loop, b * BAR, BAR)).rmsDbfs })),
    events: { file: `${ID}.events.json`, count: rows.length, perTrack: Object.fromEntries(tracks.map(t => [t, rows.filter(r => r.track === t).length])) },
    mp3: { file: `${ID}.mp3`, bitrateKbps: 320, decodedFrames: decoded, sha256: sha256(readFileSync(join(dir, `${ID}.mp3`))) },
    mp3x4: { file: `${ID}-x4.mp3`, cycles: 4, decodedFrames: decodedX4, sha256: sha256(readFileSync(join(dir, `${ID}-x4.mp3`))) },
    render: { engine: two.manifest.engine, project: rel(join(PROJECTS, projectFile)), projectSha256: two.manifest.project.sha256, inputs: two.manifest.samples.assets.map((a: any) => ({ file: a.file, sha256: a.sha256 })) },
  };
}

function checksMarkdown(r: any): string {
  const yes = (b: boolean) => b ? 'pass' : '**FAIL**';
  const p = r.seam.periodicity;
  return [
    '# SAMPLE LAB 03 · delivery checks', '', 'Generated by `scripts/build.ts` from the engine renders; the machine-readable report is `checks.json`.', '',
    '| Check | MUTATION |', '|---|---|',
    `| Tempo, meter, length | ${r.tempo.bpm} BPM, 4/4, ${r.tempo.bars} bars = ${r.file.frames} frames = ${r.file.seconds.toFixed(3)} s |`,
    `| Format | ${r.file.sampleRate} Hz, ${r.file.channels} ch, PCM16 |`,
    `| Integrated loudness | ${r.loudness.integratedLufs} LUFS (range ${r.loudness.loudnessRangeLu} LU) |`,
    `| True peak / sample peak | ${r.loudness.truePeakDbfs} dBTP / ${r.clipping.peakDbfs} dBFS (${yes(r.loudness.truePeakDbfs <= -1)}) |`,
    `| Full-scale samples | ${r.clipping.fullScaleSamples} (${yes(r.clipping.fullScaleSamples === 0)}) |`,
    `| Engine overloads (master / tracks) | ${r.clipping.engine.master.clippedSamples} / ${Object.values(r.clipping.engine.tracks).reduce((a: number, t: any) => a + t.clippedSamples, 0)} (${yes(r.clipping.engine.master.clippedSamples === 0 && Object.values(r.clipping.engine.tracks).every((t: any) => t.clippedSamples === 0))}) |`,
    `| Periodicity: cycle 3 vs cycle 2 (master) | max ${p.cycle3VsCycle2.maxAbsDiffLsb} LSB (${yes(p.cycle3VsCycle2.maxAbsDiffLsb === 0)}) |`,
    `| Periodicity: delivered loop vs 3-cycle render | max ${p.deliveredVsThreeCycle.maxAbsDiffLsb} LSB (${yes(p.deliveredVsThreeCycle.maxAbsDiffLsb === 0)}) |`,
    `| Periodicity: all stems | max ${p.stems.maxAbsDiffLsb} LSB (${yes(p.stems.maxAbsDiffLsb === 0)}) |`,
    `| Seam step (last→first sample, L/R) | ${r.seam.seamStepLsb.join('/')} LSB; interior p99 ${r.seam.interiorStepLsb.p99} (p${r.seam.seamStepPercentile}) |`,
    `| Stems | ${r.stems.count} × ${r.file.frames} frames; sum vs master best lag ${r.stems.sumVsMaster.lag} (${yes(r.stems.aligned)}) |`,
    `| Event map | ${r.events.count} events (${Object.entries(r.events.perTrack).map(([t, n]) => `${t} ${n}`).join(', ')}) |`,
    `| MP3 (320 kbps) / ×4 decoded length | ${r.mp3.decodedFrames} / ${r.mp3x4.decodedFrames} frames (${yes(r.mp3.decodedFrames === r.file.frames && r.mp3x4.decodedFrames === 4 * r.file.frames)}) |`,
    `| RMS per bar (1-4) | ${r.bars.map((b: any) => `${b.rmsDbfs}`).join(' / ')} dBFS |`,
    '', 'The seam is proven by periodicity, not by fades: the delivered loop is a window of a continuous render whose next cycle',
    'repeats it exactly. No crossfade, fade-in or fade-out is applied anywhere. The ×4 MP3 is the same loop four times in a row.', '',
  ].join('\n') + '\n';
}

// ---------------------------------------------------------------- run
mkdirSync(WORK, { recursive: true }); mkdirSync(OUT, { recursive: true });
const imported = imports();
const { take, mirror } = takeAndMirror();
const report = deliver();
json(join(OUT, 'checks.json'), { lab: 'SAMPLE LAB 03', imported, take, mirror, loop: report });
writeFileSync(join(OUT, 'CHECKS.md'), checksMarkdown(report));
json(join(LAB, 'sources.manifest.json'), {
  lab: 'SAMPLE LAB 03 — OBJECT ORCHESTRA: MUTATION', note: 'Every sound the loop reads, with origin, generation and hash. Not legal advice.',
  rights: { license: 'not yet declared (owner decision; CC0-1.0 proposed, as for SAMPLE LAB 02)', basis: 'approved SAMPLE LAB 02 recordings (original physical models) and generations made from them by the DaemonV12 engine and a bit-exact offline reverse', thirdPartyMaterial: 'none' },
  importedFromSampleLab02: imported, enginePrints: [take], offlineGenerations: [mirror],
  loop: { project: report.render.project, projectSha256: report.render.projectSha256, inputs: report.render.inputs, loopSha256: report.file.sha256 },
});
const pass = report.clipping.fullScaleSamples === 0 && report.seam.periodicity.cycle3VsCycle2.maxAbsDiffLsb === 0 && report.seam.periodicity.deliveredVsThreeCycle.maxAbsDiffLsb === 0
  && report.seam.periodicity.stems.maxAbsDiffLsb === 0 && report.stems.aligned && report.mp3.decodedFrames === LOOP && report.mp3x4.decodedFrames === 4 * LOOP && report.loudness.truePeakDbfs <= -1;
console.log(`${TITLE} ${pass ? 'PASS' : 'CHECK'}  ${report.file.seconds.toFixed(3)} s  ${report.loudness.integratedLufs} LUFS  ${report.loudness.truePeakDbfs} dBTP  seam ${report.seam.seamStepLsb.join('/')} LSB  periodic ${report.seam.periodicity.cycle3VsCycle2.maxAbsDiffLsb}/${report.seam.periodicity.deliveredVsThreeCycle.maxAbsDiffLsb}/${report.seam.periodicity.stems.maxAbsDiffLsb}  stems lag ${report.stems.sumVsMaster.lag}  events ${report.events.count}  bars ${report.bars.map((b: any) => b.rmsDbfs).join('/')} dBFS`);
console.log(`deliverables in ${rel(OUT)}`);
