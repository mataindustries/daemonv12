/**
 * Native DaemonV12 delivery. `bouncePackage` cuts each part's continuous performance into one phrase per score
 * section at the engine's own frame positions and writes ordinary v0.7 projects (drumkit phrase triggers at rate 1,
 * velocity 1), so the engine's sum reproduces the rack's continuous take sample for sample. `bounceKit` writes a
 * native-pitch multisample kit (note-N names, as the HEADLINER foundation uses) at a fixed macro state.
 * Packages are sealed with an exact-file-set SHA256SUMS (missing, modified, unlisted, linked and special entries fail).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync, lstatSync, existsSync, realpathSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, REPO_ROOT, FREEZE_FILE } from './frozen.ts';
import { RATE, beatFrame, engineEndFrames, pitchName } from './curves.ts';
import { PACKAGE_SCHEMA, RACK_INTERFACE_VERSION, type PartPerformance } from './types.ts';
import { RACK_VERSION, getInstrument, registryDocument } from './registry.ts';
import { performanceJson, type NormalizedScore } from './score.ts';
import { placed, peak, type Mixes, type Rendered, type Stereo } from './render.ts';

/** DaemonV12 main commit these packages were validated against (same base as the HEADLINER foundation, PR #42). */
export const ENGINE_BASE = 'e2962cc1a443c841cd6ca7cb2cc56c5ebabf0e99';
const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';

/** Canonical PCM16 WAV (44-byte header). Returns the bytes and how many samples had to be clamped. */
export function wavBytes(chs: Float64Array[], gain = 1): { bytes: Buffer; clipped: number } {
  const ch = chs.length, n = chs[0]!.length, b = Buffer.alloc(44 + n * ch * 2); let clipped = 0;
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * ch * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(RATE, 24); b.writeUInt32LE(RATE * ch * 2, 28); b.writeUInt16LE(ch * 2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * ch * 2, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    let v = Math.round(chs[c]![i]! * gain * 32767);
    if (v > 32767 || v < -32768) { clipped++; v = v > 0 ? 32767 : -32768; }
    b.writeInt16LE(v, 44 + (i * ch + c) * 2);
  }
  return { bytes: b, clipped };
}
const silent = (chs: Float64Array[], a: number, z: number) => { for (const c of chs) for (let i = a; i < z; i++) if (Math.round(c[i]! * 32767) !== 0) return false; return true; };

/** Every regular file below `root` (sorted, '/'-separated); refuses links and special files. */
export function packageFiles(root: string): string[] {
  root = resolve(root);
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isSymbolicLink() || !(e.isFile() || e.isDirectory())) throw new Error(`package contains a link or special file: ${p.slice(root.length + 1)}`);
      if (e.isDirectory()) walk(p); else out.push(p.slice(root.length + 1).split(sep).join('/'));
    }
  };
  walk(root);
  return out.sort();
}
export function sealPackage(root: string) {
  writeFileSync(join(root, 'SHA256SUMS'), packageFiles(root).filter(f => f !== 'SHA256SUMS').map(f => `${sha256(readFileSync(join(root, f)))}  ${f}\n`).join(''));
}
/** Exact file-set verification. Throws on missing, modified, unlisted, linked or special files. */
export function verifyPackage(root: string): number {
  const lines = readFileSync(join(root, 'SHA256SUMS'), 'utf8').trim().split('\n'), listed: string[] = [];
  for (const line of lines) {
    const m = /^([a-f0-9]{64})  ([A-Za-z0-9/_.-]+)$/.exec(line);
    if (!m) throw new Error(`invalid SHA256SUMS line: ${line}`);
    const name = m[2]!;
    if (name.startsWith('/') || name.split('/').includes('..')) throw new Error(`unsafe path in SHA256SUMS: ${name}`);
    if (!existsSync(join(root, name))) throw new Error(`missing: ${name}`);
    if (sha256(readFileSync(join(root, name))) !== m[1]) throw new Error(`modified: ${name}`);
    listed.push(name);
  }
  const actual = packageFiles(root).filter(f => f !== 'SHA256SUMS'), extra = actual.filter(f => !listed.includes(f));
  if (extra.length) throw new Error(`unlisted: ${extra.join(', ')}`);
  return listed.length;
}
/** Asset containment: every kit and sample path stays inside the package root, with no links. Returns the problems. */
export function containmentProblems(root: string, project: string): string[] {
  const realRoot = realpathSync(root), bad: string[] = [];
  const inside = (rel: string) => {
    if (rel.startsWith('/') || rel.split('/').includes('..') || rel.includes('\\')) { bad.push(`unsafe relative path ${rel}`); return null; }
    const full = join(root, rel);
    if (!existsSync(full)) { bad.push(`missing ${rel}`); return null; }
    let cur = realRoot;
    for (const part of rel.split('/')) { cur = join(cur, part); if (lstatSync(cur).isSymbolicLink()) { bad.push(`link in ${rel}`); return null; } }
    if (!(realpathSync(full) + sep).startsWith(realRoot + sep)) { bad.push(`outside the package: ${rel}`); return null; }
    return full;
  };
  const proj = JSON.parse(readFileSync(join(root, project), 'utf8')) as { tracks: { instrument: { kit?: string } }[] };
  for (const t of proj.tracks) {
    const kitRel = t.instrument.kit; if (!kitRel) continue;
    const kit = inside(kitRel); if (!kit) continue;
    for (const s of (JSON.parse(readFileSync(kit, 'utf8')) as { samples: { file: string }[] }).samples) inside(`${dirname(kitRel)}/${s.file}`);
  }
  return bad;
}

function generatorHashes() {
  const here = dirname(fileURLToPath(import.meta.url));
  return [...readdirSync(here).filter(f => f.endsWith('.ts')).sort().map(f => ({ file: `studio-001/rack/${f}`, sha256: sha256(readFileSync(join(here, f))) })),
    { file: 'studio-001/rack/frozen.json', sha256: sha256(readFileSync(FREEZE_FILE)) }];
}
const PROVENANCE = 'Every sound is synthesized by the owner-approved MUTATION 001 engines (hash-verified, unmodified) and the HEADLINER 001 toolkit from numeric parameters and seeded PRNGs. No recordings, samples, SoundFonts, impulse responses, presets or third-party audio.';
const LICENSE = 'PENDING OWNER DECLARATION: no license is granted by this package.';
function freshDir(out: string) {
  const root = resolve(out);
  if (existsSync(root)) throw new Error(`refusing to write into an existing path: ${root}`);
  mkdirSync(root, { recursive: true });
  return root;
}

export interface BounceReport { root: string; tracks: { id: string; phrases: number; gainDb: number; assetGainDb: number; peak: number }[]; clipped: number }
/** Write a self-contained native DaemonV12 package for a rendered score. Refuses an existing output path. */
export function bouncePackage(score: NormalizedScore, rendered: Rendered, mixes: Mixes, out: string): BounceReport {
  const root = freshDir(out), write = (name: string, data: string | Buffer) => { mkdirSync(dirname(join(root, name)), { recursive: true }); writeFileSync(join(root, name), data); };
  const bounds = score.sections.map(sec => beatFrame(sec.startBeat, score.bpm));
  const sounds: Record<string, unknown>[] = [], report: BounceReport = { root, tracks: [], clipped: 0 };
  const bar1 = (beat: number) => beat / 4 + 1;
  const trackOf = (id: string, description: string, audio: Stereo, gainDb: number) => {
    const p = peak(audio), assetGain = p > 0.98 ? 0.98 / p : 1, assetGainDb = 20 * Math.log10(assetGain), samples: { name: string; pitch: number; file: string }[] = [];
    const trackGainDb = +(gainDb - assetGainDb).toFixed(4);
    if (trackGainDb > 12) throw new Error(`${id}: needs ${trackGainDb} dB of track gain (engine maximum +12): lower its level`);
    const clips: { bar: number; pattern: string }[] = [], patterns: { id: string; bars: number; notes: { start: string; pitch: string; velocity: number }[] }[] = [];
    score.sections.forEach((sec, k) => {
      const a = bounds[k]!, z = k + 1 < bounds.length ? bounds[k + 1]! : rendered.frames;
      if (silent(audio, a, z)) return;
      const name = `phrase-${sec.id}`, file = `assets/${id}/${name}.wav`, { bytes, clipped } = wavBytes([audio[0].slice(a, z), audio[1].slice(a, z)], assetGain);
      report.clipped += clipped; write(file, bytes);
      sounds.push({ file, sha256: sha256(bytes), frames: z - a, channels: 2, sampleRate: RATE, bitsPerSample: 16, track: id, section: sec.id, fromFrame: a, toFrame: z, assetGainDb: +assetGainDb.toFixed(4) });
      samples.push({ name, pitch: samples.length, file: `${name}.wav` });
      clips.push({ bar: bar1(sec.startBeat), pattern: sec.id });
      patterns.push({ id: sec.id, bars: sec.bars, notes: [{ start: '1:1', pitch: name, velocity: 1 }] });
    });
    report.tracks.push({ id, phrases: samples.length, gainDb: trackGainDb, assetGainDb: +assetGainDb.toFixed(4), peak: +p.toFixed(5) });
    if (!samples.length) return null;
    write(`assets/${id}/kit.json`, json({ formatVersion: 1, samples }));
    return { id, description, instrument: { type: 'drumkit', kit: `assets/${id}/kit.json` }, mix: { gainDb: trackGainDb, pan: 0 }, clips, patterns };
  };
  const partTracks = rendered.parts.map(rp => ({ rp, track: trackOf(rp.part.id, `${rp.part.instrument.name} (${rp.part.instrument.id} ${rp.part.instrument.version}), ${rp.part.instrument.macro.label}; pan baked into the stereo phrases.`, placed(rp, false), rp.part.gainDb) }));
  const room = trackOf('room', 'Wet-only room: FDN reverb of the per-part sends (post gain), rendered by the rack.', mixes.room, 0);
  const project = (name: string, tracks: unknown[]) => write(`${name}.json`, json({
    formatVersion: 1, title: `${score.title} (${name})`, bpm: score.bpm, timeSignature: '4/4', key: score.key.label, bars: score.bars, seed: score.seed,
    description: score.sections.map(s => `${s.id}${s.development ? `: ${s.development}` : ''}`).join('; ').slice(0, 2000),
    render: { tail: { seconds: score.tailSeconds } }, master: { gainDb: score.masterGainDb }, tracks,
  }));
  project('main', [...partTracks.map(x => x.track).filter(Boolean), ...(room ? [room] : [])]);
  project('dry', partTracks.filter(x => !x.rp.part.context).map(x => x.track).filter(Boolean));
  write('score.json', json(score.authored));
  write('performance.json', json(performanceJson(score)));
  write('registry.json', json(registryDocument()));
  write('catalog.json', json({
    schema: PACKAGE_SCHEMA, interfaceVersion: RACK_INTERFACE_VERSION, rackVersion: RACK_VERSION, engineBase: ENGINE_BASE, node: process.version,
    title: score.title, bpm: score.bpm, key: score.key.label, transpose: score.transpose, frames: rendered.frames, sections: score.sections,
    scoreSha256: sha256(Buffer.from(json(score.authored))), generator: generatorHashes(), frozenEngines: 'studio-001/rack/frozen.json',
    projects: { main: 'all parts, context parts and the room', dry: 'instrument parts only, no context parts, no room' },
    provenance: PROVENANCE, license: LICENSE, tracks: report.tracks, sounds,
  }));
  write('REPRODUCE.txt', [
    `DaemonV12 Signature Rack ${RACK_VERSION} package (interface ${RACK_INTERFACE_VERSION}). Engine base ${ENGINE_BASE}; Node 22.18+; FFmpeg with libmp3lame.`,
    'Verify:      node studio-001/rack/cli.ts verify PACKAGE',
    'Regenerate:  node studio-001/rack/cli.ts bounce PACKAGE/score.json NEW_PACKAGE' + (score.transpose ? ` --transpose ${score.transpose - (score.authored.transpose ?? 0)}` : '') + (score.bpm !== score.authored.bpm ? ` --bpm ${score.bpm}` : ''),
    'Render:      node bin/daemonv12.js render PACKAGE/main.json --out-dir NEW_RENDER --stems --format wav,mp3',
    '             (dry.json renders the instrument parts without context parts or room)',
    'Assets are canonical PCM16; phrases play at rate 1 and velocity 1, so the engine sum equals the rack take.', '',
  ].join('\n'));
  sealPackage(root);
  return report;
}

export interface KitOptions { pitches: number[]; velocity?: number; macro?: number; beats?: number; bpm?: number; articulation?: string; params?: Record<string, number | string>; controls?: Record<string, number>; tailSeconds?: number; seed?: number }
/** Native-pitch multisample kit (note-N) of one instrument at a fixed macro state, plus a short scale project. */
export async function bounceKit(instrumentId: string, out: string, o: KitOptions) {
  const inst = getInstrument(instrumentId);
  if (!inst) throw new Error(`unknown instrument ${instrumentId}`);
  if (!o.pitches.length || o.pitches.length > 128) throw new Error('kit: 1..128 pitches');
  for (const p of o.pitches) if (!Number.isInteger(p) || p < inst.range[0] || p > inst.range[1]) throw new Error(`kit: pitch ${p} outside ${inst.id} range ${inst.range.join('..')}`);
  const bpm = o.bpm ?? 120, beats = o.beats ?? 2, tail = o.tailSeconds ?? 1.5, bs = Math.round(60_000_000 / bpm) / 1_000_000, frames = engineEndFrames(beats, bpm, tail);
  const root = freshDir(out), slug = inst.id.replace(/\//g, '-'), samples: { name: string; pitch: number; file: string }[] = [], sounds: Record<string, unknown>[] = [];
  const write = (name: string, data: string | Buffer) => { mkdirSync(dirname(join(root, name)), { recursive: true }); writeFileSync(join(root, name), data); };
  for (const p of o.pitches) {
    const perf: PartPerformance = { notes: [{ beat: 0, beats, pitch: p, velocity: o.velocity ?? 0.8, ...(o.articulation ? { articulation: o.articulation } : {}), ...(o.params ? { params: o.params } : {}) }],
      macro: o.macro ?? 0, controls: o.controls ?? {}, offsets: {}, expression: 0.7, setup: { spread: 0 }, breaths: [], motion: [] };
    if (!inst.setup.some(s => s.name === 'spread')) perf.setup = {};
    const [l, r] = await inst.render(perf, { bpm, beatSeconds: bs, swing: 0.5, key: { tonic: ((p % 12) + 12) % 12, mode: 'minor', label: 'kit' }, seed: o.seed ?? 1, frames, partIndex: 0 });
    let end = l.length; while (end > 1 && Math.round(l[end - 1]! * 32767) === 0 && Math.round(r[end - 1]! * 32767) === 0) end--;
    const same = l.every((v, i) => v === r[i]), chs = same ? [l.slice(0, end)] : [l.slice(0, end), r.slice(0, end)], { bytes, clipped } = wavBytes(chs);
    if (clipped) throw new Error(`kit note ${p} clips (${clipped} samples): lower the velocity`);
    const name = `note-${p}`, file = `assets/${slug}/${name}.wav`; write(file, bytes);
    samples.push({ name, pitch: p, file: `${name}.wav` });
    sounds.push({ file, sha256: sha256(bytes), frames: end, channels: chs.length, sampleRate: RATE, bitsPerSample: 16, pitch: p, name: pitchName(p) });
  }
  write(`assets/${slug}/kit.json`, json({ formatVersion: 1, samples }));
  const bars = Math.ceil(o.pitches.length / 4) + 1;
  write('kit-demo.json', json({ formatVersion: 1, title: `${inst.name} kit (macro ${o.macro ?? 0})`, bpm, timeSignature: '4/4', key: 'C minor', bars, seed: 1,
    render: { tail: { seconds: tail } }, tracks: [{ id: slug.slice(0, 32), instrument: { type: 'drumkit', kit: `assets/${slug}/kit.json` }, clips: [{ bar: 1, pattern: 'scale' }],
      patterns: [{ id: 'scale', bars, notes: o.pitches.map((p, i) => ({ start: `${Math.floor(i / 4) + 1}:${(i % 4) + 1}`, pitch: `note-${p}`, velocity: 1 })) }] }] }));
  write('catalog.json', json({ schema: `${PACKAGE_SCHEMA}+kit`, interfaceVersion: RACK_INTERFACE_VERSION, rackVersion: RACK_VERSION, engineBase: ENGINE_BASE, node: process.version,
    instrument: { id: inst.id, version: inst.version, macro: inst.macro }, options: o, generator: generatorHashes(), provenance: PROVENANCE, license: LICENSE, sounds }));
  sealPackage(root);
  return { root, samples: samples.length };
}
export const repoRelative = (p: string) => resolve(p).startsWith(REPO_ROOT + sep) ? resolve(p).slice(REPO_ROOT.length + 1) : resolve(p);
