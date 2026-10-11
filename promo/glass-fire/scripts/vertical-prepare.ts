// Prepares the 15-second vertical cut from the final GLASS//FIRE delivery in public/sync/.
//
//   npm run vertical:prepare                       # reads public/sync/
//   npm run vertical:prepare -- --dir path/to/sync
//
// Writes, next to the inputs (git-ignored like the rest of public/sync/):
//   vertical-15s.wav            the edited master: ten whole bars, cut on bar lines (src/vertical/edit.ts)
//   vertical-extras.json        exact triggers, real automation, silences, GM programs, render report
//   vertical-15s.edit.json      the edit report printed below
//
// The audio is the final master's own samples: outside two 8 ms crossfades and a 2 ms fade-in,
// every output sample is byte-identical to the master sample it came from (checked below).
//
// Inputs: master.wav and master.render.json (required); project.json (the DaemonV12 project the
// manifest names, for GM programs) and master-gate.wav (the master ducking source, for exact
// silences) are optional and used only when their SHA-256 matches the manifest.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {SAMPLE_IDS, type AutomationLane, type SampleId, type StemId} from '../src/data/contract.ts';
import {pos, ticksToSeconds} from '../src/timeline/grid.ts';
import {EXTRAS_SCHEMA_ID, extrasSchema, type Trigger, type VerticalExtras} from '../src/vertical/data.ts';
import {CROSSFADE_SECONDS, EDIT, FADE_IN_SECONDS, SPANS, V_DURATION_SECONDS} from '../src/vertical/edit.ts';

const here = dirname(fileURLToPath(import.meta.url));
const {values} = parseArgs({options: {dir: {type: 'string', default: join(here, '..', 'public', 'sync')}}});
const dir = resolve(values.dir!);
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const db = (x: number) => (x <= 1e-12 ? -Infinity : 20 * Math.log10(x));
const fmt = (x: number, digits = 1) => (Number.isFinite(x) ? x.toFixed(digits) : '−∞');

// ------------------------------------------------------------------ PCM16 in and out

type Pcm16 = {sampleRate: number; channels: number; frames: number; data: Int16Array};

const readPcm16 = (path: string): Pcm16 => {
  const bytes = readFileSync(path);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => bytes.toString('ascii', o, o + 4);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error(`${path}: not a RIFF/WAVE file`);
  let offset = 12;
  let fmtChunk: {format: number; channels: number; sampleRate: number; bits: number} | null = null;
  while (offset + 8 <= bytes.length) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') fmtChunk = {format: view.getUint16(body, true), channels: view.getUint16(body + 2, true), sampleRate: view.getUint32(body + 4, true), bits: view.getUint16(body + 14, true)};
    if (id === 'data') {
      if (!fmtChunk || fmtChunk.format !== 1 || fmtChunk.bits !== 16) throw new Error(`${path}: expected 16-bit PCM (the DaemonV12 master format)`);
      const length = Math.min(size, bytes.length - body);
      const data = new Int16Array(length / 2);
      for (let i = 0; i < data.length; i++) data[i] = view.getInt16(body + i * 2, true);
      return {sampleRate: fmtChunk.sampleRate, channels: fmtChunk.channels, frames: data.length / fmtChunk.channels, data};
    }
    offset = body + size + (size % 2);
  }
  throw new Error(`${path}: missing data chunk`);
};

const encodePcm16 = (pcm: Pcm16): Uint8Array => {
  const blockAlign = pcm.channels * 2;
  const bytes = new Uint8Array(44 + pcm.data.length * 2);
  const view = new DataView(bytes.buffer);
  const write = (o: number, text: string) => [...text].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)));
  write(0, 'RIFF');
  view.setUint32(4, 36 + pcm.data.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, pcm.channels, true);
  view.setUint32(24, pcm.sampleRate, true);
  view.setUint32(28, pcm.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, pcm.data.length * 2, true);
  for (let i = 0; i < pcm.data.length; i++) view.setInt16(44 + i * 2, pcm.data[i]!, true);
  return bytes;
};

// ------------------------------------------------------------------ the audio edit

const masterPath = join(dir, 'master.wav');
const manifestPath = join(dir, 'master.render.json');
for (const path of [masterPath, manifestPath]) {
  if (!existsSync(path)) {
    console.error(`missing ${path}\nThe vertical cut is made from the final delivery; see SYNC_HANDOFF.md.`);
    process.exit(1);
  }
}
const masterBytes = readFileSync(masterPath);
const master = readPcm16(masterPath);
const SR = master.sampleRate;
const CH = master.channels;
if (master.frames < 24 * SR - 1) throw new Error(`master is ${(master.frames / SR).toFixed(6)} s; GLASS//FIRE is 24.000 s`);

const frameOf = (seconds: number) => {
  const f = seconds * SR;
  if (Math.abs(f - Math.round(f)) > 1e-6) throw new Error(`${seconds} s is not an integer sample frame at ${SR} Hz`);
  return Math.round(f);
};
const outFrames = frameOf(V_DURATION_SECONDS);
const out = new Int16Array(outFrames * CH);
/** For every output frame, the master frame it copies (identity check). */
const source = new Int32Array(outFrames);
for (const span of SPANS) {
  const o0 = frameOf(span.outStart);
  const s0 = frameOf(span.songStart);
  const n = frameOf(span.outEnd) - o0;
  out.set(master.data.subarray(s0 * CH, (s0 + n) * CH), o0 * CH);
  for (let k = 0; k < n; k++) source[o0 + k] = s0 + k;
}

const clamp16 = (v: number) => Math.max(-32768, Math.min(32767, Math.round(v)));
const modified = new Uint8Array(outFrames);
// Equal-power crossfades that END on each bar line: the incoming downbeat keeps its full transient,
// and the last few milliseconds of the outgoing bar hand over to the incoming bar's own pre-roll.
const N = Math.round(CROSSFADE_SECONDS * SR);
for (let i = 1; i < SPANS.length; i++) {
  const B = frameOf(SPANS[i]!.outStart);
  const inStart = frameOf(SPANS[i]!.songStart);
  for (let k = 0; k < N; k++) {
    const f = B - N + k;
    const theta = (Math.PI / 2) * ((k + 0.5) / N);
    for (let c = 0; c < CH; c++) {
      const a = out[f * CH + c]!;
      const b = master.data[(inStart - N + k) * CH + c]!;
      out[f * CH + c] = clamp16(a * Math.cos(theta) + b * Math.sin(theta));
    }
    modified[f] = 1;
  }
}
const F = Math.round(FADE_IN_SECONDS * SR);
for (let k = 0; k < F; k++) {
  const g = 0.5 - 0.5 * Math.cos(Math.PI * ((k + 0.5) / F));
  for (let c = 0; c < CH; c++) out[k * CH + c] = clamp16(out[k * CH + c]! * g);
  modified[k] = 1;
}

let identical = 0;
let mismatched = 0;
for (let f = 0; f < outFrames; f++) {
  let same = true;
  for (let c = 0; c < CH; c++) if (out[f * CH + c] !== master.data[source[f]! * CH + c]) same = false;
  if (modified[f]) continue;
  if (same) identical++;
  else mismatched++;
}
const editedFrames = modified.reduce((n, m) => n + m, 0);
if (mismatched > 0) throw new Error(`${mismatched} untouched frames differ from the master`);

// Seam check: largest sample-to-sample jump within ±5 ms of each cut, against the master's own
// distribution of jumps. A click would show up as a jump far above the music's normal range.
const jumps = (pcm: Int16Array, from: number, to: number) => {
  let max = 0;
  for (let f = Math.max(1, from); f < to; f++) for (let c = 0; c < CH; c++) max = Math.max(max, Math.abs(pcm[f * CH + c]! - pcm[(f - 1) * CH + c]!));
  return max;
};
const masterJumps: number[] = [];
for (let f = 1; f < master.frames; f += 7) for (let c = 0; c < CH; c++) masterJumps.push(Math.abs(master.data[f * CH + c]! - master.data[(f - 1) * CH + c]!));
masterJumps.sort((a, b) => a - b);
const p999 = masterJumps[Math.floor(masterJumps.length * 0.999)]!;
const rmsDb = (pcm: Int16Array, from: number, to: number) => {
  let acc = 0;
  let n = 0;
  for (let f = Math.max(0, from); f < to; f++) for (let c = 0; c < CH; c++) {
    const v = pcm[f * CH + c]! / 32768;
    acc += v * v;
    n++;
  }
  return db(Math.sqrt(acc / Math.max(1, n)));
};
const W5 = Math.round(0.005 * SR);
const W20 = Math.round(0.02 * SR);
const seams = SPANS.slice(1).map((span, i) => {
  const B = frameOf(span.outStart);
  const prev = SPANS[i]!;
  return {
    at: span.outStart,
    joins: `song bar ${prev.lastBar} → ${span.firstBar}`,
    maxJump: jumps(out, B - W5, B + W5),
    rmsBefore: rmsDb(out, B - W20, B),
    rmsAfter: rmsDb(out, B, B + W20),
    originalAfter: rmsDb(master.data, frameOf(span.songStart), frameOf(span.songStart) + W20),
    outgoingWouldContinue: rmsDb(master.data, frameOf(prev.songEnd), frameOf(prev.songEnd) + W20),
  };
});

const edited: Pcm16 = {sampleRate: SR, channels: CH, frames: outFrames, data: out};
const wavBytes = encodePcm16(edited);
const wavPath = join(dir, 'vertical-15s.wav');
writeFileSync(wavPath, wavBytes);

const ebur128 = (path: string) => {
  const run = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', path, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], {encoding: 'utf8'});
  if (run.error || run.status !== 0) return null;
  const summary = run.stderr.slice(run.stderr.lastIndexOf('Summary:'));
  const num = (re: RegExp) => Number(re.exec(summary)?.[1]);
  return {integratedLufs: num(/I:\s+(-?[\d.]+) LUFS/), loudnessRangeLu: num(/LRA:\s+(-?[\d.]+) LU/), truePeakDbfs: num(/Peak:\s+(-?[\d.]+) dBFS/)};
};
let peak = 0;
for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]!));
const clipped = out.reduce((n, v) => n + (v === 32767 || v === -32768 ? 1 : 0), 0);

// ------------------------------------------------------------------ extras from the manifest

type ManifestPoint = {at: {seconds?: number; musical?: string}; value: number; transition?: 'step' | 'linear'};
type Manifest = {
  project?: {file: string; sha256: string};
  wav?: {sha256: string};
  samples?: {assets?: {file: string; frames?: number; sampleRate?: number}[]; tracks?: {trackId: string; triggers: {file: string; frame: number; velocity: number}[]}[]};
  production?: {tracks?: {trackId: string; automation?: {gainDb?: ManifestPoint[]; pan?: ManifestPoint[]}}[]; master?: {ducking?: {reference?: {sha256?: string}}}};
  analysis?: {master?: {durationSeconds: number; integratedLufs: number; truePeakDbfs: number; loudnessRangeLu: number; fullScaleSamples?: number; sampleRate: number}};
  mix?: {clippedSamples?: number};
};
const manifestBytes = readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes.toString('utf8')) as Manifest;
const masterSha = sha(masterBytes);
if (manifest.wav?.sha256 && manifest.wav.sha256 !== masterSha) throw new Error(`master.wav (${masterSha.slice(0, 12)}…) is not the render the manifest describes (${manifest.wav.sha256.slice(0, 12)}…)`);

const ROLE: Record<SampleId, StemId> = {
  'glass-hit': 'glass',
  'glass-reverse': 'glass',
  'glass-crush': 'glass',
  'prism-impact': 'glass',
  'ghost-vox': 'vox',
  'vox-chip': 'vox',
  'bass-punch-cs': 'kick',
  'sub-cs': 'sub',
  'chrome-clap': 'clap',
  'pixel-hat': 'hat',
};
const sampleIdOf = (file: string): SampleId | undefined => {
  const base = file.split('/').pop()!.replace(/\.wav$/i, '').replace(/^\d+-/, '');
  return (SAMPLE_IDS as readonly string[]).includes(base) ? (base as SampleId) : undefined;
};
const assetSeconds = new Map((manifest.samples?.assets ?? []).map(a => [a.file, (a.frames ?? 0) / (a.sampleRate ?? SR)]));
const triggers: Trigger[] = [];
let unknownTriggers = 0;
for (const track of manifest.samples?.tracks ?? []) {
  for (const trigger of track.triggers) {
    const sample = sampleIdOf(trigger.file);
    const t = Math.round((trigger.frame / SR) * 1e6) / 1e6;
    if (!sample || t >= 24) {
      unknownTriggers++;
      continue;
    }
    triggers.push({t, track: track.trackId, sample, role: ROLE[sample], velocity: trigger.velocity, duration: Math.round((assetSeconds.get(trigger.file) || 0.05) * 1e6) / 1e6});
  }
}
triggers.sort((a, b) => a.t - b.t || a.track.localeCompare(b.track));

// DaemonV12 automation: `transition` describes the segment from a point to the next; missing means
// step (hold, then switch on the next point). The promo's lanes interpolate linearly, so a step
// becomes a held point plus a coincident new point.
const secondsOf = (at: ManifestPoint['at']) => (at.seconds !== undefined ? at.seconds : ticksToSeconds(pos(at.musical!)));
const linearize = (points: ManifestPoint[]) => {
  const out: {t: number; v: number}[] = [];
  points.forEach((p, i) => {
    const t = Math.min(24, Math.round(secondsOf(p.at) * 1e6) / 1e6);
    const prev = points[i - 1];
    if (prev && (prev.transition ?? 'step') === 'step') out.push({t, v: prev.value});
    out.push({t, v: p.value});
  });
  return out;
};
const TRACK_ROLE: Record<string, StemId> = {punch: 'kick', sub: 'sub', clap: 'clap', hat: 'hat', vox: 'vox', chip: 'vox'};
const automation: AutomationLane[] = [];
for (const track of manifest.production?.tracks ?? []) {
  const role = TRACK_ROLE[track.trackId] ?? 'glass';
  const name = track.trackId.toUpperCase().slice(0, 10);
  if (track.automation?.gainDb?.length) automation.push({id: `track.${track.trackId}.gain`, label: `${name} GAIN`, target: role, unit: 'dB', range: [-48, 6], points: linearize(track.automation.gainDb)});
  if (track.automation?.pan?.length) automation.push({id: `track.${track.trackId}.pan`, label: `${name} PAN`, target: role, unit: 'pan', range: [-1, 1], points: linearize(track.automation.pan)});
}

// Silences: the master gate's own control signal when supplied (exact), otherwise where the
// master itself drops below −45 dBFS for at least 20 ms.
const gatePath = join(dir, 'master-gate.wav');
const gateSha = existsSync(gatePath) ? sha(readFileSync(gatePath)) : undefined;
const gateMatches = gateSha !== undefined && gateSha === manifest.production?.master?.ducking?.reference?.sha256;
const gates: {t: number; duration: number}[] = [];
if (gateMatches) {
  const gate = readPcm16(gatePath);
  const threshold = 32768 * 10 ** (-40 / 20);
  let start = -1;
  for (let f = 0; f <= gate.frames; f++) {
    const on = f < gate.frames && Math.abs(gate.data[f * gate.channels]!) > threshold;
    if (on && start < 0) start = f;
    if (!on && start >= 0) {
      gates.push({t: Math.round((start / gate.sampleRate) * 1e6) / 1e6, duration: Math.round(((f - start) / gate.sampleRate) * 1e6) / 1e6});
      start = -1;
    }
  }
} else {
  const win = Math.round(0.001 * SR);
  let start = -1;
  for (let w = 0; w * win <= master.frames; w++) {
    const silent = w * win < master.frames && rmsDb(master.data, w * win, Math.min(master.frames, (w + 1) * win)) < -45;
    if (silent && start < 0) start = w;
    if (!silent && start >= 0) {
      if ((w - start) * win >= 0.02 * SR) gates.push({t: (start * win) / SR, duration: ((w - start) * win) / SR});
      start = -1;
    }
  }
}

// GM programs, read from the exact project the manifest names.
const projectPath = join(dir, 'project.json');
const projectSha = existsSync(projectPath) ? sha(readFileSync(projectPath)) : undefined;
const projectMatches = projectSha !== undefined && projectSha === manifest.project?.sha256;
const gm: VerticalExtras['gm'] = [];
if (projectMatches) {
  const gmSource = join(here, '..', '..', '..', 'src', 'project', 'gm-programs.ts');
  const names = existsSync(gmSource) ? [...(/GM_PROGRAMS[^=]*=\s*\[([\s\S]*?)\]/.exec(readFileSync(gmSource, 'utf8'))?.[1] ?? '').matchAll(/"([a-z0-9_]+)"/g)].map(m => m[1]!) : [];
  const project = JSON.parse(readFileSync(projectPath, 'utf8')) as {tracks: {id: string; instrument: {type: string; program?: string | number}}[]};
  for (const track of project.tracks) {
    if (track.instrument.type !== 'gm') continue;
    const program = typeof track.instrument.program === 'number' ? track.instrument.program : names.indexOf(String(track.instrument.program));
    if (program >= 0 && program < 128) gm.push({track: track.id, program, name: String(names[program] ?? track.instrument.program)});
  }
}

const analysis = manifest.analysis?.master;
const extras: VerticalExtras = extrasSchema.parse({
  schema: EXTRAS_SCHEMA_ID,
  source: {master: masterSha, manifest: sha(manifestBytes), ...(projectMatches ? {project: projectSha} : {}), ...(gateMatches ? {gate: gateSha} : {})},
  triggers,
  automation,
  gates,
  gm,
  render: analysis
    ? {
        durationSeconds: analysis.durationSeconds,
        integratedLufs: analysis.integratedLufs,
        truePeakDbfs: analysis.truePeakDbfs,
        loudnessRangeLu: analysis.loudnessRangeLu,
        clippedSamples: manifest.mix?.clippedSamples ?? analysis.fullScaleSamples ?? 0,
        tracks: manifest.production?.tracks?.length ?? manifest.samples?.tracks?.length ?? 0,
        sampleRate: analysis.sampleRate,
      }
    : null,
});
writeFileSync(join(dir, 'vertical-extras.json'), JSON.stringify(extras) + '\n');

// ------------------------------------------------------------------ report

const loudMaster = ebur128(masterPath);
const loudCut = ebur128(wavPath);
const report = {
  edit: SPANS.map(s => ({songBars: `${s.firstBar}–${s.lastBar}`, song: [s.songStart, s.songEnd], out: [s.outStart, s.outEnd]})),
  segments: EDIT,
  output: {file: 'vertical-15s.wav', sha256: sha(wavBytes), frames: outFrames, seconds: outFrames / SR, sampleRate: SR, channels: CH, bitsPerSample: 16},
  master: {sha256: masterSha, frames: master.frames},
  crossfade: {seconds: CROSSFADE_SECONDS, frames: N, shape: 'equal-power, ending on the bar line'},
  fadeIn: {seconds: FADE_IN_SECONDS, frames: F},
  identity: {identicalFrames: identical, editedFrames, totalFrames: outFrames},
  seams: seams.map(s => ({...s, masterJumpP999: p999})),
  levels: {samplePeakDbfs: db(peak / 32768), clippedSamples: clipped, master: loudMaster, cut: loudCut},
  extras: {triggers: triggers.length, unknownTriggers, automationLanes: automation.length, gates: gates.length, gatesFrom: gateMatches ? 'master-gate.wav (sha256 verified)' : 'detected from master.wav', gm, project: projectMatches ? 'project.json (sha256 verified)' : 'not supplied'},
};
writeFileSync(join(dir, 'vertical-15s.edit.json'), JSON.stringify(report, null, 1) + '\n');

console.log('GLASS//FIRE vertical cut');
for (const s of SPANS) console.log(`  song bars ${String(s.firstBar).padStart(2)}–${String(s.lastBar).padEnd(2)}  ${s.songStart.toFixed(3)}–${s.songEnd.toFixed(3)} s  →  out ${s.outStart.toFixed(3)}–${s.outEnd.toFixed(3)} s`);
console.log(`  ${wavPath}`);
console.log(`  ${outFrames} frames = ${(outFrames / SR).toFixed(6)} s · ${SR} Hz · ${CH} ch · 16-bit · sha256 ${report.output.sha256}`);
console.log(`  identical to the master: ${identical} of ${outFrames} frames; ${editedFrames} frames in fades (${N}-frame crossfades ×${SPANS.length - 1}, ${F}-frame fade-in)`);
for (const s of seams) {
  console.log(`  cut at ${s.at.toFixed(3)} s (${s.joins}): max jump ±5 ms ${s.maxJump} (master p99.9 ${p999}); RMS 20 ms before ${fmt(s.rmsBefore)} dB, after ${fmt(s.rmsAfter)} dB (original downbeat ${fmt(s.originalAfter)} dB; the dropped continuation would have been ${fmt(s.outgoingWouldContinue)} dB)`);
}
console.log(`  sample peak ${fmt(db(peak / 32768), 2)} dBFS · clipped samples ${clipped}`);
if (loudMaster && loudCut) console.log(`  loudness: master ${loudMaster.integratedLufs} LUFS / ${loudMaster.truePeakDbfs} dBTP · cut ${loudCut.integratedLufs} LUFS / ${loudCut.truePeakDbfs} dBTP, LRA ${loudCut.loudnessRangeLu} LU`);
else console.log('  loudness: ffmpeg not found, skipped');
console.log(`  extras: ${triggers.length} triggers (${unknownTriggers} without a GLASSHOUSE identity), ${automation.length} automation lanes, ${gates.length} silences (${report.extras.gatesFrom}), GM ${gm.map(g => `${g.name} #${g.program + 1}`).join(', ') || 'not supplied'}`);
