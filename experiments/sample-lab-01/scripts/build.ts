/** SAMPLE LAB 01 build: palette -> resample prints -> both candidates -> loop deliverables and checks.
 * Run from the repository root: node experiments/sample-lab-01/scripts/build.ts
 *
 * 1. Palette: copy the six CC0 sounds from examples/assets (SHA-256 checked against their pack catalogs) and regenerate
 *    the two new recordings with generate-sources.ts.
 * 2. Write every project JSON from its score script, render CRATE-01 and GLASS CHOIR, and store the prints as samples.
 * 3. Render each candidate as two identical cycles (8 bars) plus one bar of tail room, with aligned stems. The deliverable
 *    loop is the second cycle, frames [441000, 882000): it already carries the first cycle's wrapped tails, and nothing in
 *    it meets the render's end (where the engine forces releases), which is exactly what endless playback sounds like. A
 *    three-cycle render proves it: its second and third cycles, and the delivered loop, must match sample for sample.
 * 4. Write the loop WAV, an MP3, the cropped stems, a sample-accurate event map (DaemonV12 sync format), a groove chart and
 *    a checks report (format, duration, clipping, loudness, seam, stem alignment, opening).
 * Intermediate renders go to experiments/sample-lab-01/work/ (ignored by git). Needs Node 22.18+ and FFmpeg. */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildEventMap, serializeEventMap, type ScheduledEvent } from '../../../src/sync/index.ts';
import { generate } from './generate-sources.ts';
import { crate, CRATE_CHOPS } from './crate-01.ts';
import { dustyPocket, TRACK_EVENTS as DUSTY_EVENTS } from './dusty-pocket.ts';
import { cosmicCollage, glassChoir, TRACK_EVENTS as COSMIC_EVENTS } from './cosmic-collage.ts';
import { position, wrap, BAR, type Ev } from './score.ts';

const HERE = dirname(fileURLToPath(import.meta.url)), LAB = resolve(HERE, '..'), REPO = resolve(LAB, '..', '..');
const PROJECTS = join(LAB, 'projects'), WORK = join(LAB, 'work'), OUT = join(LAB, 'deliverables');
const PALETTE = join(PROJECTS, 'assets', 'palette'), RESAMPLED = join(PROJECTS, 'assets', 'resampled');
const CLI = join(REPO, 'bin', 'daemonv12.js');
const RATE = 44100, LOOP = 441000, BPM = 96, LOOP_TICKS = 4 * BAR, TICK_MS = 60000 / BPM / 960;

const sha256 = (bytes: Buffer | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const rel = (p: string) => relative(REPO, p);
const json = (p: string, v: unknown) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
const r2 = (x: number) => Math.round(x * 100) / 100;
const dbfs = (x: number) => x > 0 ? r2(20 * Math.log10(x)) : null;

// ---------------------------------------------------------------- PCM16 WAV I/O
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

// ---------------------------------------------------------------- engine and FFmpeg
function engine(args: string[]): any {
  try { return JSON.parse(execFileSync(process.execPath, [CLI, ...args, '--json'], { cwd: PROJECTS, encoding: 'utf8', maxBuffer: 1 << 28 })); }
  catch (e: any) { throw new Error(`daemonv12 ${args.join(' ')} failed:\n${e.stdout ?? e.message}`); }
}
function render(project: string, outDir: string, stems: boolean) {
  rmSync(outDir, { recursive: true, force: true });
  const r = engine(['render', project, '--out-dir', outDir, '--format', 'wav', ...(stems ? ['--stems'] : [])]);
  if (!r.ok || r.warnings.length) throw new Error(`render ${project}: ${JSON.stringify(r.errors ?? r.warnings)}`);
  const base = project.replace(/\.json$/, '');
  return { wav: join(outDir, `${base}.wav`), stems: join(outDir, `${base}.stems`), manifest: JSON.parse(readFileSync(join(outDir, `${base}.render.json`), 'utf8')) };
}
const ffmpeg = (args: string[]) => execFileSync('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', ...args], { maxBuffer: 1 << 28 });

// ---------------------------------------------------------------- 1. palette
const CC0 = [
  { file: 'ghost-vox.wav', pack: 'GLASSHOUSE', id: 'ghost-vox', from: 'examples/assets/glasshouse/04-ghost-vox.wav', catalog: 'examples/glasshouse.catalog.json' },
  { file: 'glass-hit.wav', pack: 'GLASSHOUSE', id: 'glass-hit', from: 'examples/assets/glasshouse/01-glass-hit.wav', catalog: 'examples/glasshouse.catalog.json' },
  { file: 'pixel-hat.wav', pack: 'GLASSHOUSE', id: 'pixel-hat', from: 'examples/assets/glasshouse/09-pixel-hat.wav', catalog: 'examples/glasshouse.catalog.json' },
  { file: 'air-texture.wav', pack: 'Orbital Foundry', id: 'air-texture', from: 'examples/assets/orbital-foundry/11-air-texture.wav', catalog: 'examples/orbital-foundry.catalog.json' },
  { file: 'mechanical-kick.wav', pack: 'Orbital Foundry', id: 'mechanical-kick', from: 'examples/assets/orbital-foundry/02-mechanical-kick.wav', catalog: 'examples/orbital-foundry.catalog.json' },
  { file: 'industrial-snare.wav', pack: 'Orbital Foundry', id: 'industrial-snare', from: 'examples/assets/orbital-foundry/05-industrial-snare.wav', catalog: 'examples/orbital-foundry.catalog.json' },
];
function palette() {
  mkdirSync(PALETTE, { recursive: true }); mkdirSync(RESAMPLED, { recursive: true });
  const out: Record<string, unknown>[] = [];
  for (const s of CC0) {
    const bytes = readFileSync(join(REPO, s.from)), entry = JSON.parse(readFileSync(join(REPO, s.catalog), 'utf8')).sounds.find((x: any) => x.id === s.id);
    if (!entry || entry.sha256 !== sha256(bytes)) throw new Error(`${s.from} does not match ${s.catalog}`);
    copyFileSync(join(REPO, s.from), join(PALETTE, s.file));
    out.push({ file: s.file, origin: 'cc0', pack: s.pack, catalogId: s.id, copiedFrom: s.from, catalog: s.catalog, sha256: entry.sha256, bytes: bytes.length });
  }
  const regen = join(WORK, 'regenerated-sources');
  const first = generate(PALETTE), second = generate(regen);
  for (const f of first.files) {
    const again = second.files.find(x => x.file === f.file)!;
    if (again.sha256 !== f.sha256) throw new Error(`${f.file} is not reproducible`);
    out.push({ file: f.file, origin: 'generated', generator: rel(join(HERE, 'generate-sources.ts')), sha256: f.sha256, bytes: f.bytes, regeneratedIdentically: true });
  }
  return out;
}

// ---------------------------------------------------------------- 2. resample prints
function prints() {
  const out: Record<string, unknown>[] = [];
  for (const [name, project] of [['crate-01', crate()], ['glass-choir', glassChoir()]] as const) {
    json(join(PROJECTS, `${name}.json`), project);
    const r = render(`${name}.json`, join(WORK, name), false), bytes = readFileSync(r.wav);
    copyFileSync(r.wav, join(RESAMPLED, `${name}.wav`));
    out.push({ file: `${name}.wav`, origin: 'resampled', project: rel(join(PROJECTS, `${name}.json`)), projectSha256: r.manifest.project.sha256,
      inputs: r.manifest.samples.assets.map((a: any) => ({ file: a.file, sha256: a.sha256 })), sha256: sha256(bytes), frames: readWav(r.wav).frames });
  }
  return out;
}

// ---------------------------------------------------------------- 3-4. candidates
interface Candidate { id: string; title: string; build: (cycles?: number) => any; events: Record<string, Ev[]> }
const CANDIDATES: Candidate[] = [
  { id: 'dusty-pocket', title: 'DUSTY POCKET', build: dustyPocket, events: DUSTY_EVENTS },
  { id: 'cosmic-collage', title: 'COSMIC COLLAGE', build: cosmicCollage, events: COSMIC_EVENTS },
];

function chopName(file: string, offset: number | undefined): string | undefined {
  if (!file.endsWith('crate-01.wav')) return undefined;
  const o = offset ?? 0;
  return Object.entries(CRATE_CHOPS).find(([, c]) => o >= c.offsetSeconds - 1e-9 && o < c.endSeconds)?.[0];
}

function eventMap(c: Candidate, manifest: any, projectFile: string) {
  const events: ScheduledEvent[] = [], rows: any[] = [];
  for (const track of manifest.samples.tracks) {
    const authored = (c.events[track.trackId] ?? []).map(e => ({ e, cycleTick: wrap(e.t, 4), used: false }));
    track.triggers.forEach((trig: any, index: number) => {
      if (trig.frame < LOOP || trig.frame >= 2 * LOOP) return;
      const cycleTick = trig.tick - LOOP_TICKS, match = authored.find(a => !a.used && a.cycleTick === cycleTick);
      if (!match) throw new Error(`${c.id}/${track.trackId}: no authored event at tick ${cycleTick}`);
      match.used = true;
      const nominal = match.e.nominal ?? match.e.t, offsetTicks = match.e.t - nominal;
      const source: Record<string, any> = {
        adapter: 'sample-lab-01/render-manifest-v1', project: projectFile, projectSha256: manifest.project.sha256, trackIndex: track.trackIndex, triggerIndex: index,
        tick: cycleTick, position: position(cycleTick), nominalPosition: position(wrap(nominal, 4)), humanOffsetTicks: offsetTicks, humanOffsetMs: r2(offsetTicks * TICK_MS),
        sample: trig.file,
      };
      const chop = chopName(trig.file, trig.playback?.offset?.seconds);
      if (chop) source.chop = chop;
      if (trig.playback) source.playback = { rate: trig.playback.rate, ...(trig.playback.offset ? { offsetSeconds: trig.playback.offset.seconds } : {}), ...(trig.playback.glide ? { glide: trig.playback.glide } : {}) };
      if (trig.articulation) source.articulation = { renderedFrames: trig.articulation.renderedFrames, ...(trig.articulation.gate ? { gate: trig.articulation.gate.duration } : {}), ...(trig.articulation.sourceEnd ? { endSeconds: trig.articulation.sourceEnd.seconds } : {}), ...(trig.articulation.chokeGroup ? { chokeGroup: trig.articulation.chokeGroup } : {}) };
      events.push({ sampleFrame: trig.frame, trackId: track.trackId, eventId: `${track.trackId}-${String(index).padStart(3, '0')}`, velocity: trig.velocity, visualRoles: [track.trackId], source });
      rows.push({ track: track.trackId, frame: trig.frame - LOOP, nominalFrame: Math.round(trig.frame - LOOP - offsetTicks * TICK_MS * RATE / 1000), offsetMs: source.humanOffsetMs, velocity: trig.velocity, position: source.position });
    });
    const unused = authored.filter(a => !a.used);
    if (unused.length) throw new Error(`${c.id}/${track.trackId}: ${unused.length} authored events not found in the second cycle`);
  }
  const map = buildEventMap(events, { sampleRate: RATE, fps: { numerator: 60, denominator: 1 }, clip: { startSampleFrame: LOOP, endSampleFrame: 2 * LOOP },
    source: { adapter: 'sample-lab-01/render-manifest-v1', candidate: c.id, project: projectFile, projectSha256: manifest.project.sha256,
      note: 'clipSampleFrame is the frame inside the delivered 441000-frame loop; sampleFrame is the frame in the two-cycle engine render.' } });
  return { map, rows };
}

function timingSummary(rows: any[]) {
  const by: Record<string, number[]> = {};
  for (const r of rows) (by[r.track] ??= []).push(r.offsetMs);
  return Object.fromEntries(Object.entries(by).map(([t, v]) => {
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    return [t, { events: v.length, meanMs: r2(mean), meanAbsMs: r2(v.reduce((a, b) => a + Math.abs(b), 0) / v.length),
      spreadMs: r2(Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length)), earliestMs: r2(Math.min(...v)), latestMs: r2(Math.max(...v)) }];
  }));
}

function grooveSvg(title: string, rows: any[], tracks: string[]): string {
  const W = 1200, left = 120, lane = 34, top = 46, H = top + lane * tracks.length + 40, x = (f: number) => left + (W - left - 20) * f / LOOP;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="monospace" font-size="11">`,
    `<rect width="${W}" height="${H}" fill="#101014"/>`, `<text x="12" y="22" fill="#eee" font-size="14">${title} — event map (loop frames 0–441000, 96 BPM)</text>`,
    `<text x="12" y="38" fill="#999">tick = authored grid position · dot = where it plays · blue early / orange late · size = velocity</text>`];
  for (let s = 0; s <= 64; s++) parts.push(`<line x1="${x(s * LOOP / 64).toFixed(1)}" x2="${x(s * LOOP / 64).toFixed(1)}" y1="${top}" y2="${top + lane * tracks.length}" stroke="${s % 16 ? s % 4 ? '#1c1c24' : '#2e2e3a' : '#5a5a6a'}"/>`);
  tracks.forEach((t, i) => {
    const y = top + lane * i + lane / 2, rs = rows.filter(r => r.track === t);
    parts.push(`<text x="12" y="${y + 4}" fill="#ccc">${t}</text>`);
    for (const r of rs) {
      const c = r.offsetMs < -1 ? '#4fb3ff' : r.offsetMs > 1 ? '#ff9b3d' : '#e8e8e8';
      parts.push(`<line x1="${x(r.nominalFrame).toFixed(1)}" x2="${x(r.nominalFrame).toFixed(1)}" y1="${y - 9}" y2="${y + 9}" stroke="#555"/>`,
        `<circle cx="${x(r.frame).toFixed(1)}" cy="${y}" r="${(2 + 5 * r.velocity).toFixed(1)}" fill="${c}" fill-opacity="0.85"><title>${t} ${r.position} ${r.offsetMs >= 0 ? '+' : ''}${r.offsetMs} ms v${r.velocity} frame ${r.frame}</title></circle>`);
    }
  });
  for (let b = 0; b < 4; b++) parts.push(`<text x="${x(b * LOOP / 4) + 3}" y="${H - 18}" fill="#888">bar ${b + 1}</text>`);
  parts.push('</svg>');
  return parts.join('\n') + '\n';
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
  const q = (p: number) => steps[Math.min(steps.length - 1, Math.floor(p * steps.length))]!;
  const worst = Math.max(...seamSteps), rank = steps.filter(s => s < worst).length / steps.length;
  const rms = (from: number, n: number) => { let s = 0; for (let i = from * ch; i < (from + n) * ch; i++) s += pcm.data[i]! ** 2; return dbfs(Math.sqrt(s / (n * ch)) / 32768); };
  return { seamStepLsb: seamSteps, interiorStepLsb: { median: q(0.5), p99: q(0.99), p999: q(0.999), max: steps[steps.length - 1] },
    seamStepPercentile: r2(100 * rank), last10msRmsDbfs: rms(pcm.frames - 441, 441), first10msRmsDbfs: rms(0, 441) };
}
/** Normalized cross-correlation of two interleaved stereo signals at frame lags -maxLag..maxLag; returns the best lag. */
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

function deliver(c: Candidate) {
  const projectFile = `${c.id}.json`, dir = join(OUT, c.id), stemDir = join(dir, 'stems');
  json(join(PROJECTS, projectFile), c.build(2));
  const two = render(projectFile, join(WORK, c.id, 'two-cycles'), true);
  const seamProject = `${c.id}.seam-check.json`;
  json(join(PROJECTS, seamProject), c.build(3));
  let three;
  try { three = render(seamProject, join(WORK, c.id, 'three-cycles'), true); } finally { rmSync(join(PROJECTS, seamProject)); }

  rmSync(dir, { recursive: true, force: true }); mkdirSync(stemDir, { recursive: true });
  const master2 = readWav(two.wav), master3 = readWav(three.wav), loop = crop(master2, LOOP, LOOP);
  if (master2.frames !== 2 * LOOP + LOOP / 4 || master3.frames !== 3 * LOOP + LOOP / 4) throw new Error(`${c.id}: unexpected render length`);
  const loopBytes = wavBytes(loop);
  writeFileSync(join(dir, `${c.id}.wav`), loopBytes);
  copyFileSync(join(WORK, c.id, 'two-cycles', `${c.id}.render.json`), join(dir, `${c.id}.render.json`));

  // stems, in project track order
  const tracks: string[] = c.build(2).tracks.map((t: any) => t.id);
  const stemReports = [], sum = new Float64Array(loop.data.length);
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

  // MP3 (320 kbps LAME with gapless header), decoded back to count frames
  const mp3 = join(dir, `${c.id}.mp3`);
  ffmpeg(['-y', '-i', join(dir, `${c.id}.wav`), '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '320k', mp3]);
  const decoded = ffmpeg(['-i', mp3, '-f', 's16le', '-ac', '2', '-ar', String(RATE), '-']).length / 4;

  const { map, rows } = eventMap(c, two.manifest, projectFile);
  writeFileSync(join(dir, `${c.id}.events.json`), serializeEventMap(map) + '\n');
  writeFileSync(join(dir, `${c.id}.groove.svg`), grooveSvg(c.title, rows, tracks));

  const analysis = engine(['analyze', join(dir, `${c.id}.wav`)]).analysis;
  const opening = rows.filter(r => r.frame < RATE / 2).sort((a, b) => a.frame - b.frame).map(r => `${r.track} ${r.position} (${r.frame})`);
  const mixed = new Float64Array(loop.data.length); loop.data.forEach((v, k) => { mixed[k] = v; });
  const production = two.manifest.production ?? {}, sumAlignment = bestLag(sum, mixed);
  return {
    candidate: c.id, title: c.title,
    loop: { file: `${c.id}.wav`, frames: loop.frames, seconds: loop.frames / RATE, sampleRate: RATE, channels: loop.channels, bitsPerSample: 16, sha256: sha256(loopBytes), sourceWindow: [LOOP, 2 * LOOP] },
    loudness: { integratedLufs: analysis.integratedLufs, truePeakDbfs: analysis.truePeakDbfs, loudnessRangeLu: analysis.loudnessRangeLu },
    clipping: { ...stats(loop), engine: { note: 'engine overload counts and pre-quantization peaks for the whole two-cycle render', master: { clippedSamples: production.master?.clippedSamples, preClipPeakDbfs: production.master?.preClipPeakDbfs },
      tracks: Object.fromEntries(production.tracks.map((t: any) => [t.trackId, { clippedSamples: t.clippedSamples, preClipPeakDbfs: t.preClipPeakDbfs }])) } },
    seam: { periodicity: { note: 'third vs second cycle of a three-cycle render, and delivered loop vs that second cycle', master: { ...maxDiff(crop(master3, LOOP, LOOP), crop(master3, 2 * LOOP, LOOP)), deliveredVsThreeCycle: maxDiff(loop, crop(master3, LOOP, LOOP)) }, stems: stemsPeriodic }, ...seam(loop) },
    stems: { count: stemReports.length, aligned: stemReports.every(s => s.frames === LOOP) && sumAlignment.lag === 0, sumVsMaster: sumAlignment,
      note: 'stems include track processing and exclude master gain, filters, compression and saturation; best cross-correlation lag of their sum against the master within +/-64 frames', files: stemReports },
    opening: { first500msRmsDbfs: stats(crop(loop, 0, RATE / 2)).rmsDbfs, loopRmsDbfs: stats(loop).rmsDbfs, eventsInFirst500ms: opening },
    timing: timingSummary(rows),
    mp3: { file: `${c.id}.mp3`, bitrateKbps: 320, decodedFrames: decoded, sha256: sha256(readFileSync(mp3)) },
    render: { engine: two.manifest.engine, project: rel(join(PROJECTS, projectFile)), projectSha256: two.manifest.project.sha256, twoCycleWavSha256: two.manifest.wav?.sha256 ?? null },
    events: { file: `${c.id}.events.json`, count: rows.length },
  };
}

/** Rights and provenance for every sound the candidates read. Evidence only; the owner decides licensing. */
const ROLES: Record<string, string> = {
  'keys-take.wav': 'felt electric-piano take; the harmonic content of the record', 'bass-db.wav': 'Moog-style bass note (Db2); both basslines',
  'ghost-vox.wav': 'synthetic "oh-ah" voice (C#4); backing group, hook voice, stutters', 'glass-hit.wav': 'glass strike (C#5); vibraphone doubling, hook octave, wooden knock',
  'pixel-hat.wav': 'closed hat, slowed', 'air-texture.wav': 'air bed; sliced into a shaker (A) and swells (B)',
  'mechanical-kick.wav': 'kick', 'industrial-snare.wav': 'snare, pitched down',
  'crate-01.wav': 'the shared source record both candidates chop', 'glass-choir.wav': 'candidate B hook instrument (voice + octave-down voice + glass)',
};
function sourcesManifest(paletteReport: any[], printReport: any[]) {
  const rights = (p: any) => p.origin === 'cc0'
    ? { license: 'CC0-1.0', basis: `${p.pack} pack LICENSE (CC0 1.0, commercial use without attribution); generated in this repository by its pack generator; SHA-256 matches ${p.catalog}`, status: 'cleared (owner attestation of the CC0 dedication recommended, see benchmarks/banger-lab-001/AUDIT.md)' }
    : p.origin === 'generated'
      ? { license: 'not yet declared (owner decision; CC0-1.0 proposed for consistency with the existing packs)', basis: 'original synthesis written for this experiment (generate-sources.ts): Node built-ins only, seeded, no input files, recordings, downloads or network; regenerated byte-identically in this build', status: 'original; no third-party material' }
      : { license: 'inherits its inputs (CC0-1.0 palette sounds and the two generated sources)', basis: `printed by the DaemonV12 engine from ${p.project}; every input is listed with its SHA-256`, status: 'derived only from the palette above' };
  return {
    lab: 'SAMPLE LAB 01', note: 'Every sound either candidate reads, with origin, hash and rights evidence. Not legal advice.',
    palette: paletteReport.map(p => ({ ...p, role: ROLES[p.file], rights: rights(p) })),
    resampled: printReport.map(p => ({ ...p, role: ROLES[p.file], rights: rights(p) })),
    excluded: [
      { source: 'MORPH v1 pack (examples/assets/morph-v1/)', reason: 'its README and docs/MORPH_SOUND_AUDIT.md state that no license grant is asserted and that rights must be decided before external distribution' },
      { source: 'FluidR3 GM SoundFont (gm instruments)', reason: 'excluded by the BANGER LAB 001 rights audit: public-domain sample sources unidentified' },
      { source: 'any commercial or third-party recording', reason: 'not used; no downloaded, sampled or uncleared audio exists anywhere in this lab' },
    ],
  };
}

function checksMarkdown(reports: any[], paletteReport: any[], printReport: any[]): string {
  const yes = (b: boolean) => b ? 'pass' : '**FAIL**';
  const lines = ['# SAMPLE LAB 01 · delivery checks', '', 'Generated by `scripts/build.ts` from the engine renders; the machine-readable report is `checks.json`.', '',
    '| Check | ' + reports.map(r => r.title).join(' | ') + ' |', '|---|' + reports.map(() => '---|').join('')];
  const row = (name: string, f: (r: any) => string) => lines.push(`| ${name} | ${reports.map(f).join(' | ')} |`);
  row('Loop length', r => `${r.loop.frames} frames = ${r.loop.seconds.toFixed(3)} s (${yes(r.loop.frames === LOOP)})`);
  row('Format', r => `${r.loop.sampleRate} Hz, ${r.loop.channels} ch, PCM16`);
  row('Integrated loudness', r => `${r.loudness.integratedLufs} LUFS`);
  row('True peak / sample peak', r => `${r.loudness.truePeakDbfs} dBTP / ${r.clipping.peakDbfs} dBFS`);
  row('Full-scale samples in loop', r => `${r.clipping.fullScaleSamples} (${yes(r.clipping.fullScaleSamples === 0)})`);
  row('Engine overloads (master, every track)', r => `${r.clipping.engine.master.clippedSamples} / ${Object.values(r.clipping.engine.tracks).reduce((a: number, t: any) => a + t.clippedSamples, 0)} (${yes(r.clipping.engine.master.clippedSamples === 0 && Object.values(r.clipping.engine.tracks).every((t: any) => t.clippedSamples === 0))})`);
  row('Periodicity: cycle 3 vs cycle 2 (master)', r => `max ${r.seam.periodicity.master.maxAbsDiffLsb} LSB, ${r.seam.periodicity.master.differingSamples} samples differ (${yes(r.seam.periodicity.master.maxAbsDiffLsb === 0)})`);
  row('Periodicity: delivered loop vs 3-cycle render', r => `max ${r.seam.periodicity.master.deliveredVsThreeCycle.maxAbsDiffLsb} LSB (${yes(r.seam.periodicity.master.deliveredVsThreeCycle.maxAbsDiffLsb === 0)})`);
  row('Periodicity: all stems', r => `max ${r.seam.periodicity.stems.maxAbsDiffLsb} LSB (${yes(r.seam.periodicity.stems.maxAbsDiffLsb === 0)})`);
  row('Seam step (last→first sample, L/R)', r => `${r.seam.seamStepLsb.join('/')} LSB; interior p99 ${r.seam.interiorStepLsb.p99} (p${r.seam.seamStepPercentile})`);
  row('Stems', r => `${r.stems.count} × ${LOOP} frames; sum vs master best lag ${r.stems.sumVsMaster.lag} (${yes(r.stems.aligned)})`);
  row('MP3 (320 kbps) decoded length', r => `${r.mp3.decodedFrames} frames (${yes(r.mp3.decodedFrames === LOOP)})`);
  row('Opening (first 0.5 s vs loop RMS)', r => `${r.opening.first500msRmsDbfs} vs ${r.opening.loopRmsDbfs} dBFS`);
  row('Event map', r => `${r.events.count} events`);
  lines.push('', 'The seam is proven by periodicity rather than by fades: the delivered loop is a window of a continuous render, and the next',
    'cycle of that render repeats it exactly, so the sample after the last frame of the loop is the loop\'s first frame. No crossfade,',
    'fade-in or fade-out is applied anywhere.', '', '## Human timing per instrument (ms from the authored grid position)', '');
  for (const r of reports) {
    lines.push(`**${r.title}**`, '', '| Track | Events | Mean | Mean abs | Spread | Earliest | Latest |', '|---|---:|---:|---:|---:|---:|---:|');
    for (const [t, v] of Object.entries(r.timing) as [string, any][]) lines.push(`| ${t} | ${v.events} | ${v.meanMs} | ${v.meanAbsMs} | ${v.spreadMs} | ${v.earliestMs} | ${v.latestMs} |`);
    lines.push('');
  }
  lines.push('## Sources', '', '| File | Origin | SHA-256 |', '|---|---|---|');
  for (const p of [...paletteReport, ...printReport]) lines.push(`| ${p.file} | ${p.origin === 'cc0' ? `CC0 (${p.pack})` : p.origin === 'generated' ? 'generated (regenerated identically)' : 'resampled print'} | \`${p.sha256}\` |`);
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------- run
mkdirSync(WORK, { recursive: true }); mkdirSync(OUT, { recursive: true });
const paletteReport = palette();
const printReport = prints();
const reports = CANDIDATES.map(deliver);
json(join(OUT, 'checks.json'), { lab: 'SAMPLE LAB 01', bpm: BPM, loopFrames: LOOP, palette: paletteReport, resampled: printReport, candidates: reports });
json(join(LAB, 'sources.manifest.json'), sourcesManifest(paletteReport, printReport));
writeFileSync(join(OUT, 'CHECKS.md'), checksMarkdown(reports, paletteReport, printReport));
for (const r of reports) {
  const pass = r.loop.frames === LOOP && r.stems.aligned && r.clipping.fullScaleSamples === 0 && r.seam.periodicity.master.maxAbsDiffLsb <= 1 && r.mp3.decodedFrames === LOOP;
  console.log(`${r.title.padEnd(15)} ${pass ? 'PASS' : 'CHECK'}  ${r.loudness.integratedLufs} LUFS  ${r.loudness.truePeakDbfs} dBTP  peak ${r.clipping.peakDbfs}  seam step ${r.seam.seamStepLsb.join('/')} LSB (p${r.seam.seamStepPercentile})  periodic max diff ${r.seam.periodicity.master.maxAbsDiffLsb}  mp3 frames ${r.mp3.decodedFrames}`);
}
console.log(`stems and reports in ${rel(OUT)}; sources ${readdirSync(PALETTE).length} palette + ${readdirSync(RESAMPLED).length} resampled`);
