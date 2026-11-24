/**
 * Second-generation prints for FERRYMAN TAKES FAKES V2. Each one exists because the composition needs a sound the
 * records do not contain; nothing here changes the engine.
 *
 *  ETERNAL DEACON   assets/v2/eternal-deacon.wav
 *    The half-time sections need a bass that holds for bars, and the Deacon only ever plucked one note (the LP's stop
 *    bar). This print plays his pluck, then splices eight periods of its sustain (F1, 43.6535 Hz) end to end with
 *    linear crossfades every four periods: identical content, phase-locked, so the sum stays level. The engine does
 *    the splicing (an ordinary sampler project, rate 1, exact copy path); the result is his note, never dying.
 *
 *  REVERSED SHEET   assets/v2/reversed.wav
 *    The engine has no reverse playback. Two slices of the LP print, frame order reversed bit-exact, laid end to end
 *    with silence between: the viewing-room bell (it inhales into its own strike) and the shout downbeat (identical
 *    bytes to V1's assets/derived/swell-reversed.wav). The map is in v2/prints.json.
 *
 * Cached: a print is rebuilt only when its inputs' hashes change.     node counterfeit-gold-opus/v2/prints.ts
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { formatPosition } from '../../src/timing/musical-time.ts';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '..'), REPO = resolve(ROOT, '..');
const CLI = join(REPO, 'bin', 'daemonv12.js'), RATE = 44100;
export const LP = 'assets/record/the-velvet-hearse--two-coins-for-the-ferryman.wav';
export const ETERNAL = 'assets/v2/eternal-deacon.wav', REVERSED = 'assets/v2/reversed.wav';
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const fileSha = (rel: string) => sha(readFileSync(join(ROOT, rel)));

interface Pcm { channels: number; frames: number; data: Int16Array }
export function readWav(path: string): Pcm {
  const b = readFileSync(path); let p = 12, channels = 0, data: Int16Array | null = null;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === 'fmt ') { channels = b.readUInt16LE(p + 10); if (b.readUInt16LE(p + 8) !== 1 || b.readUInt32LE(p + 12) !== RATE || b.readUInt16LE(p + 22) !== 16) throw new Error(`unsupported WAV ${path}`); }
    else if (id === 'data') data = new Int16Array(b.buffer.slice(b.byteOffset + p + 8, b.byteOffset + p + 8 + size));
    p += 8 + size + (size & 1);
  }
  if (!channels || !data) throw new Error(`incomplete WAV ${path}`);
  return { channels, frames: data.length / channels, data };
}
export function wavBytes(pcm: Pcm): Buffer {
  const out = Buffer.alloc(44 + pcm.data.length * 2), ch = pcm.channels;
  out.write('RIFF'); out.writeUInt32LE(out.length - 8, 4); out.write('WAVEfmt ', 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(ch, 22);
  out.writeUInt32LE(RATE, 24); out.writeUInt32LE(RATE * ch * 2, 28); out.writeUInt16LE(ch * 2, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(pcm.data.length * 2, 40);
  Buffer.from(pcm.data.buffer, pcm.data.byteOffset, pcm.data.byteLength).copy(out, 44);
  return out;
}

// ------------------------------------------------------------------------------------------------ eternal Deacon
/** The Deacon's pluck in the LP print (the rack's performed onset of his stop-bar F1). */
export const DEACON_ONSET = 53.8917;
const F1 = 440 * 2 ** ((29 - 69) / 12), PERIOD = 1 / F1, H = 4 * PERIOD, W = 2 * H, SPLICE_AT = 0.25, LENGTH = 6.0, PRE = 0.004;
const BPM = 300, TICK = 60 / (BPM * 960);
const r6 = (x: number) => +x.toFixed(6);
export function eternalProject() {
  const s0 = r6(DEACON_ONSET + SPLICE_AT), u1 = PRE + SPLICE_AT, notes: Record<string, unknown>[] = [];
  const at = (u: number) => formatPosition(Math.round(u / TICK), { numerator: 4, denominator: 4 });
  const half = Math.round(H / TICK);
  notes.push({ start: at(0), velocity: 1, offsetSeconds: r6(DEACON_ONSET - PRE), endSeconds: r6(s0 + W), gate: `${Math.round(u1 / TICK)}/3840`, envelope: { attackSeconds: 0.001, releaseSeconds: r6(H) } });
  for (let u = u1; u + W <= LENGTH - 0.05; u += H)
    notes.push({ start: at(u), velocity: 1, offsetSeconds: s0, endSeconds: r6(s0 + W), gate: `${half}/3840`, envelope: { attackSeconds: r6(H), releaseSeconds: r6(H) } });
  return {
    formatVersion: 1, title: 'ETERNAL DEACON (V2 print)',
    description: "The Deacon's one plucked F1 from the LP's stop bar, then eight periods of its sustain spliced end to end with phase-locked linear crossfades every four periods: his note, never dying.",
    bpm: BPM, timeSignature: '4/4', bars: Math.ceil(LENGTH / (4 * 60 / BPM)) + 1, seed: 1,
    render: { duration: { seconds: LENGTH }, tail: 'auto' },
    tracks: [{ id: 'deacon', description: 'one note, spliced', instrument: { type: 'sampler', sample: LP }, mix: { gainDb: 0 },
      clips: [{ bar: 1, pattern: 'held' }], patterns: [{ id: 'held', bars: Math.ceil(LENGTH / (4 * 60 / BPM)) + 1, notes }] }],
  };
}

// ------------------------------------------------------------------------------------------------ reversed sheet
const BEAT_LP = 0.573338;
export const REVERSED_SLICES = [
  { id: 'bell-reversed', from: 0, to: 2.42 * BEAT_LP, why: 'the viewing-room bell inhales into its own strike' },
  { id: 'swell-reversed', from: 55.037143, to: 55.957789, why: "the shout downbeat (bell, band, feral coins) swelling into itself; identical bytes to V1's derived swell" },
];
function reversedSheet() {
  const pcm = readWav(join(ROOT, LP)), ch = pcm.channels, gap = Math.round(0.25 * RATE), parts: Int16Array[] = [], map: Record<string, unknown>[] = [];
  let cursor = 0;
  for (const s of REVERSED_SLICES) {
    const a = Math.round(s.from * RATE), n = Math.round(s.to * RATE) - a, d = new Int16Array(n * ch);
    for (let i = 0; i < n; i++) for (let k = 0; k < ch; k++) d[(n - 1 - i) * ch + k] = pcm.data[(a + i) * ch + k]!;
    parts.push(d, new Int16Array(gap * ch));
    map.push({ id: s.id, why: s.why, sourceFrames: [a, a + n], sheetSeconds: [r6(cursor / RATE), r6((cursor + n) / RATE)], operation: 'frame order reversed, bit-exact; no gain, no fades' });
    cursor += n + gap;
  }
  const data = new Int16Array(parts.reduce((t, p) => t + p.length, 0)); let o = 0; for (const p of parts) { data.set(p, o); o += p.length; }
  return { bytes: wavBytes({ channels: ch, frames: data.length / ch, data }), map };
}

// ------------------------------------------------------------------------------------------------ build (cached)
if (import.meta.url === `file://${process.argv[1]}`) {
  const manifestPath = join(HERE, 'prints.json');
  const old = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
  const lpSha = fileSha(LP), project = eternalProject(), projectText = JSON.stringify(project, null, 1) + '\n', projectSha = sha(Buffer.from(projectText));
  mkdirSync(join(ROOT, 'assets', 'v2'), { recursive: true });
  let eternal = old.eternal;
  if (!eternal || eternal.inputs?.lp !== lpSha || eternal.inputs?.project !== projectSha || !existsSync(join(ROOT, ETERNAL)) || fileSha(ETERNAL) !== eternal.sha256) {
    const pf = join(ROOT, 'v2-print-eternal-deacon.json'); writeFileSync(pf, projectText);
    const out = join(ROOT, 'work', 'v2-print-eternal'); rmSync(out, { recursive: true, force: true });
    const r = JSON.parse(execFileSync(process.execPath, [CLI, 'render', pf, '--out-dir', out, '--format', 'wav', '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 }));
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    const bytes = readFileSync(join(out, 'v2-print-eternal-deacon.wav')); writeFileSync(join(ROOT, ETERNAL), bytes);
    eternal = { file: ETERNAL, project: 'v2-print-eternal-deacon.json', inputs: { lp: lpSha, project: projectSha }, sha256: sha(bytes), seconds: LENGTH,
      splice: { onsetSeconds: DEACON_ONSET, spliceAfterSeconds: SPLICE_AT, windowSeconds: r6(W), hopSeconds: r6(H), periodsPerHop: 4, pitchHz: r6(F1), voices: (project.tracks[0]!.patterns[0]!.notes as unknown[]).length } };
    console.log(`eternal Deacon printed: ${eternal.sha256.slice(0, 12)}, ${eternal.splice.voices} voices`);
  } else console.log('eternal Deacon: cached');
  const rev = reversedSheet(); writeFileSync(join(ROOT, REVERSED), rev.bytes);
  const reversed = { file: REVERSED, inputs: { lp: lpSha }, sha256: sha(rev.bytes), slices: rev.map };
  writeFileSync(manifestPath, JSON.stringify({ note: 'Second-generation prints for V2; see prints.ts. Hashes are SHA-256.', eternal, reversed }, null, 1) + '\n');
  console.log(`reversed sheet: ${reversed.sha256.slice(0, 12)}`);
}
