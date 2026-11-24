/**
 * FERRYMAN TAKES FAKES · a beat made only from one printed record.
 *
 * Source: THE VELVET HEARSE, "Two Coins for the Ferryman" (1971, imaginary), printed once by the Signature Rack
 * (source/the-velvet-hearse--two-coins-for-the-ferryman.wav). Every sound in this production is read from that print
 * by the unchanged DaemonV12 sampler (slices, rates, glides, gates, envelopes, chokes), plus one bit-exact offline
 * derivation: a reversed slice, because the engine has no reverse playback. No new synthesis, no other samples.
 *
 * The record plays at 0.840896 of its speed: 104.65 BPM in F minor becomes 88 BPM in D minor, every record beat one
 * grid beat. The counterfeit: the record takes four bars to walk Fm9 -> Db -> Bbm9 -> Gb7#11; the beat cuts its first
 * two and a half beats straight into the last bar, so the ferryman's chord (now Eb7#11) arrives on the and-of-three,
 * and keeps arriving there, in every bar.
 *
 *   bars  1-2   THE FIND      the record as found, through the wall: two bars straight, a bell two octaves down,
 *                             then the two coins alone, dry
 *   bars  3-10  COUNTERFEIT   the re-cut loop, break drums, the Deacon's one low note as the bass; each pass ends
 *                             differently: Odile's sigh, the coins stuttering, "deh-dah deh-dah OH", a scat run
 *   bars 11-14  THE CROSSING  one 7/8 cycle rolling across 4/4 drums (it lands on the one again only after seven
 *                             bars, so it never does here); Odile's long fall; a reed bark; a toy laser
 *   bar  15     STOP          the record's two stabs, silence, the Deacon alone, a reversed bell into
 *   bars 16-19  THE SHOUT     the same counterfeit cut from the record's feral chorus: the overblown note, the
 *                             record's own claps on the backbeat, Odile's scat as a stutter
 *   bar  20     PAYMENT       the unresolved ferryman chord falling, two coins, the bell two octaves down, a breath
 *
 *   node counterfeit-gold-opus/beat/build.ts            (needs FFmpeg; writes the project, renders, delivers)
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { formatPosition } from '../../src/timing/musical-time.ts';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '..'), REPO = resolve(ROOT, '..');
const CLI = join(REPO, 'bin', 'daemonv12.js'), WORK = join(ROOT, 'work'), RATE = 44100;
export const TITLE = 'FERRYMAN TAKES FAKES', SLUG = 'ferryman-takes-fakes';
const BPM = 88, PPQ = 960, WHOLE = 4 * PPQ, BEAT_S = Math.round(60e6 / BPM) / 1e6, TICK_S = BEAT_S / PPQ, BARS = 20;
const dig = JSON.parse(readFileSync(join(HERE, 'chops.json'), 'utf8'));
const PRINT: string = dig.print, SWELL = 'assets/derived/swell-reversed.wav';
/** The record's beat onto this grid: pitch and tempo move together, as on a turntable. */
export const R = +(dig.recordBeatSeconds / BEAT_S).toFixed(6);
/** Rate for `n` semitones above the slowed record (D minor). */
const st = (n: number) => +(R * 2 ** (n / 12)).toFixed(6);
const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

// ------------------------------------------------------------------------------------------------ PCM16 and the one derivation
interface Pcm { channels: number; frames: number; data: Int16Array }
function readWav(path: string): Pcm {
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
function wavBytes(pcm: Pcm): Buffer {
  const out = Buffer.alloc(44 + pcm.data.length * 2), ch = pcm.channels;
  out.write('RIFF'); out.writeUInt32LE(out.length - 8, 4); out.write('WAVEfmt ', 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(ch, 22);
  out.writeUInt32LE(RATE, 24); out.writeUInt32LE(RATE * ch * 2, 28); out.writeUInt16LE(ch * 2, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(pcm.data.length * 2, 40);
  Buffer.from(pcm.data.buffer, pcm.data.byteOffset, pcm.data.byteLength).copy(out, 44);
  return out;
}
/** The shout's downbeat (bell, band, feral coins) with its frames in reverse order: it swells into its own attack. */
function deriveSwell() {
  const c = dig.chops['swell-src'], pcm = readWav(join(ROOT, PRINT)), ch = pcm.channels;
  const a = Math.round(c.offsetSeconds * RATE), n = Math.round(c.endSeconds * RATE) - a, data = new Int16Array(n * ch);
  for (let i = 0; i < n; i++) for (let k = 0; k < ch; k++) data[(n - 1 - i) * ch + k] = pcm.data[(a + i) * ch + k]!;
  mkdirSync(join(ROOT, dirname(SWELL)), { recursive: true });
  const bytes = wavBytes({ channels: ch, frames: n, data });
  writeFileSync(join(ROOT, SWELL), bytes);
  return { file: SWELL, from: PRINT, frames: [a, a + n], operation: 'frames in reverse order, bit-exact, no fades or gain', sha256: sha256(bytes), seconds: n / RATE };
}

// ------------------------------------------------------------------------------------------------ placing chops
type Track = 'record' | 'loop' | 'seven' | 'vox' | 'stabs' | 'bell' | 'fx' | 'kick' | 'snare' | 'hat' | 'perc' | 'bass';
interface Ev { track: Track; beat: number; chop: string; rate?: number; vel?: number; gate?: number; ms?: number; attack?: number; release?: number; choke?: string; glide?: [number, number] }
const events: Ev[] = [];
const put = (track: Track, beat: number, chop: string, o: Omit<Ev, 'track' | 'beat' | 'chop'> = {}) => { if (!dig.chops[chop] && chop !== 'swell') throw new Error(`no chop ${chop}`); events.push({ track, beat, chop, ...o }); };
let seed = 1971;
const rnd = () => { let t = (seed = (seed + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const jitter = (ms: number) => (rnd() * 2 - 1) * ms;

/** The sampler note for one event: the record's beat inside the chop lands on `beat` (plus `ms` of feel). */
function note(e: Ev, swell: { seconds: number }) {
  const rate = e.rate ?? R;
  let offset: number, end: number, lead: number;
  if (e.chop === 'swell') { offset = 0; end = +swell.seconds.toFixed(6); lead = swell.seconds; }      // lands at its end
  else { const c = dig.chops[e.chop]; offset = c.offsetSeconds; end = c.endSeconds; lead = c.leadSeconds; }
  const tick = Math.max(0, Math.round(e.beat * PPQ - lead / rate / TICK_S + (e.ms ?? 0) / 1000 / TICK_S));
  const n: Record<string, unknown> = { tick, velocity: +Math.min(1, Math.max(0.01, e.vel ?? 1)).toFixed(3) };
  if (Math.abs(rate - 1) > 1e-9) n.playbackRate = rate;
  if (offset > 0) n.offsetSeconds = offset;
  n.endSeconds = end;
  if (e.gate !== undefined) n.gate = `${Math.max(1, Math.round(e.gate * PPQ))}/${WHOLE}`;
  n.envelope = { attackSeconds: e.attack ?? 0.002, releaseSeconds: e.release ?? 0.012 };
  if (e.choke) n.chokeGroup = e.choke;
  if (e.glide) n.glide = { to: e.glide[0], duration: `${Math.max(1, Math.round(e.glide[1] * PPQ))}/${WHOLE}` };
  return n;
}

// ------------------------------------------------------------------------------------------------ the arrangement (grid beats)
const D = st(0), Eb = st(1), C = st(-2), G = st(5);
const KICK = 'kick-3', KICK2 = 'kick-4', SNARE = 'snare-2', GHOST = 'snare-0', HATS = ['snare-0', 'snare-2'];   // the hats are the break's snares above 6.5 kHz
const loopNote = { choke: 'loop', attack: 0.002, release: 0.014 };
const drum = { attack: 0.0005, release: 0.04 };
/** Refinement R1: the kick at its own speed (body on F1, shorter) so it knocks above the Deacon's D1 instead of sharing it. */
const kickHit = { ...drum, rate: 1 };
const hat = { attack: 0.0005, release: 0.015, rate: 1, gate: 0.11 };

// bars 1-2, THE FIND: the record as found, then two coins alone
put('bell', 0, 'bell', { rate: R / 2, gate: 5, release: 0.5, vel: 0.9 });
put('record', 0, 'intro-head', { gate: 7.5, release: 0.03 });
put('loop', 7.5, 'coins', { ...loopNote, gate: 0.5 });

// bars 3-10, COUNTERFEIT: four passes of the re-cut loop
const A1_KICK: [number, number, number][] = [[0, 1, 0], [1.75, 0.72, -6], [2.5, 0.95, -4], [4.75, 0.88, 0], [6.5, 0.92, -4]];
const BACKBEAT: [number, number, number][] = [[1, 0.95, 22], [3, 0.9, 26], [5, 0.95, 20], [7, 0.92, 28]];
for (let k = 0; k < 4; k++) {
  const L = 8 + 8 * k;
  put('loop', L, 'a-coins', { ...loopNote, gate: 2.5 });
  put('loop', L + 2.5, 'a-ferry', { ...loopNote, gate: 4 });
  if (k === 0) put('loop', L + 6.5, 'a-sigh', { ...loopNote, gate: 1.5, release: 0.03 });
  if (k === 1) for (const x of [6.5, 7, 7.5]) put('loop', L + x, 'coins', { ...loopNote, gate: 0.5, vel: x === 7.5 ? 1 : 0.85 });
  if (k === 2) { put('vox', L + 6.5, 'dedah', { gate: 0.5, choke: 'vox' }); put('vox', L + 7, 'dedah', { gate: 0.5, choke: 'vox' }); put('vox', L + 7.5, 'cry-oh', { gate: 0.75, choke: 'vox' }); }
  if (k === 3) put('vox', L + 6.5, 'scat', { gate: 1.5, choke: 'vox' });
  if (k >= 2) put('vox', L + 0.5, 'dedah', { gate: 0.5, choke: 'vox', vel: 0.8 });
  // Refinement R2: pass 3 is a floor until the and-of-three: no kick, bass or snare under the loop and the sung coins,
  // so the counterfeit chord lands with everything at once.
  const floor = (x: number) => k === 2 && x < 2.5;
  for (const [x, v, ms] of A1_KICK) if (!floor(x)) put('kick', L + x, KICK, { ...kickHit, gate: 0.45, vel: v, ms: ms + jitter(2) });
  if (k % 2) put('kick', L + 7.75, KICK2, { ...kickHit, gate: 0.3, vel: 0.5 });
  for (const [x, v, ms] of BACKBEAT) if (!floor(x)) put('snare', L + x, SNARE, { ...drum, rate: 0.94, gate: 0.6, release: 0.06, vel: v, ms: ms + jitter(3) });
  if (k >= 1) for (const x of [3.75, 6.25]) put('snare', L + x, GHOST, { ...drum, gate: 0.2, vel: 0.22, ms: 10 });
  for (let e = 0; e < 8; e++) put('hat', L + e + 0.5, HATS[e % 2]!, { ...hat, vel: 0.75 + jitter(0.08), ms: jitter(4) });
  for (const x of [2.75, 6.75]) put('hat', L + x, HATS[0]!, { ...hat, gate: 0.08, vel: 0.45, ms: 38 });
  if (k >= 1) { put('perc', L + 3.75, 'conga-open', { ...drum, gate: 0.4, vel: 0.6, ms: 12 }); put('perc', L + 7.25, 'conga-low', { ...drum, gate: 0.4, vel: 0.65, ms: 18 }); }
  if (k === 3) { put('perc', L + 7.5, 'conga-boom', { ...drum, gate: 0.3, vel: 0.7 }); put('perc', L + 7.75, 'conga-boom', { ...drum, gate: 0.3, vel: 0.6, ms: 30 }); }
  // the Deacon's one note, as the whole bass line
  const bass = { chop: 'deacon', choke: 'bass', attack: 0.003, release: 0.05 };
  if (!floor(0)) { put('bass', L, bass.chop, { ...bass, rate: D, gate: 1.4, vel: 1 }); put('bass', L + 1.75, bass.chop, { ...bass, rate: D, gate: 0.5, vel: 0.6, ms: -6 }); }
  put('bass', L + 2.5, bass.chop, { ...bass, rate: Eb, gate: 1.6, vel: 0.95, ms: -4 });
  put('bass', L + 4.75, bass.chop, { ...bass, rate: Eb, gate: 0.9, vel: 0.85 });
  put('bass', L + 6.5, bass.chop, { ...bass, rate: k === 3 ? G : D, gate: 0.9, vel: 0.9, ms: -4 });
  if (k < 3) put('bass', L + 7.5, bass.chop, { ...bass, rate: C, glide: [D, 0.125], gate: 0.45, vel: 0.6 });
}

// bars 11-14, THE CROSSING: a 7/8 cycle rolled across 4/4
for (const [i, b] of [40, 43.5, 47, 50.5, 54].entries()) put('seven', b, 'seven', { choke: 'seven', gate: b === 54 ? 2 : 3.5, release: 0.02, vel: i === 0 ? 1 : 0.92 });
for (let bar = 0; bar < 4; bar++) {
  const O = 40 + 4 * bar;
  put('kick', O, KICK, { ...kickHit, gate: 0.45, vel: 1 }); put('kick', O + 2.5, KICK, { ...kickHit, gate: 0.45, vel: 0.82, ms: -5 });
  put('snare', O + 2, SNARE, { ...drum, rate: 0.94, gate: 0.6, release: 0.06, vel: 0.95, ms: 24 + jitter(3) });
  for (let q = 0; q < 4; q++) put('hat', O + q, HATS[q % 2]!, { ...hat, vel: q ? 0.55 : 0.7 });
}
put('bass', 40, 'deacon', { rate: D, gate: 2, vel: 0.8, choke: 'bass', release: 0.08 });
put('bass', 48, 'deacon', { rate: D, gate: 2, vel: 0.72, choke: 'bass', release: 0.08 });
put('vox', 48, 'fall', { gate: 2.8, release: 0.08, vel: 0.95 });
put('fx', 53.5, 'bark', { gate: 1.3, release: 0.05, vel: 0.9 });
put('fx', 55, 'laser', { gate: 1, release: 0.03, vel: 0.9 });

// bar 15, STOP
put('stabs', 56, 'stab-1', { gate: 0.65, release: 0.06 }); put('stabs', 56.75, 'stab-2', { gate: 0.8, release: 0.1 });
put('kick', 56, KICK, { ...kickHit, gate: 0.45 }); put('kick', 56.75, KICK, { ...kickHit, gate: 0.45 });
put('bass', 56, 'deacon', { rate: D, gate: 0.5, choke: 'bass', release: 0.04 }); put('bass', 56.75, 'deacon', { rate: Eb, gate: 0.6, choke: 'bass', release: 0.04 });
put('bass', 58, 'deacon', { rate: D, gate: 1.3, choke: 'bass', release: 0.1, vel: 1 });
put('vox', 59, 'dedah', { gate: 0.5, choke: 'vox', vel: 0.9 });
put('fx', 60, 'swell', { rate: R, release: 0.004, attack: 0.02, vel: 0.85 });

// bars 16-19, THE SHOUT: the same cut, from the feral chorus
const A2_KICK: [number, number, number][] = [[0, 1, 0], [0.75, 0.6, -4], [2, 0.95, -3], [3.5, 0.75, -5], [4.5, 0.9, 0], [5.5, 0.7, -4], [6.5, 0.92, -3], [7.25, 0.55, 0]];
for (let k = 0; k < 2; k++) {
  const L = 60 + 8 * k;
  put('loop', L, 's-coins', { ...loopNote, gate: 2 });
  put('loop', L + 2, 's-ferry', { ...loopNote, gate: 4 });
  put('loop', L + 6, 's-ferry-tail', { ...loopNote, gate: 2 });
  put('vox', L + 0.5, 'dedah', { gate: 0.5, choke: 'vox', vel: 0.85 });
  if (k === 0) { put('vox', L + 5.25, 'cry-oh', { gate: 0.75, choke: 'vox', vel: 0.9 }); put('vox', L + 6, 'scat', { gate: 2, choke: 'vox' }); }
  else { put('vox', L + 6, 'scat', { gate: 1, choke: 'vox' }); put('vox', L + 7, 'scat', { gate: 1, choke: 'vox' }); }
  for (const [x, v, ms] of A2_KICK) put('kick', L + x, KICK, { ...kickHit, gate: 0.45, vel: v, ms: ms + jitter(2) });
  for (const [x, v, ms] of BACKBEAT) put('snare', L + x, SNARE, { ...drum, rate: 0.94, gate: 0.6, release: 0.06, vel: v, ms: ms + jitter(3) });
  for (const x of [2.75, 4.25, 6.25]) put('snare', L + x, GHOST, { ...drum, gate: 0.2, vel: 0.24, ms: 10 });
  for (let e = 0; e < 16; e++) put('hat', L + e * 0.5, HATS[e % 2]!, { ...hat, vel: e % 2 ? 0.78 : 0.45, ms: e % 2 ? jitter(4) : 0 });
  for (const [x, c, v] of [[1.75, 'conga-slap', 0.55], [3.75, 'conga-open', 0.6], [5.75, 'conga-slap', 0.55], [7.25, 'conga-low', 0.65], [7.5, 'conga-boom', 0.6]] as [number, string, number][])
    put('perc', L + x, c, { ...drum, gate: 0.35, vel: v, ms: 14 });
  const bass = { choke: 'bass', attack: 0.003, release: 0.05 };
  put('bass', L, 'deacon', { ...bass, rate: D, gate: 1.4, vel: 1 });
  put('bass', L + 1.5, 'deacon', { ...bass, rate: D, gate: 0.4, vel: 0.6 });
  put('bass', L + 2, 'deacon', { ...bass, rate: Eb, gate: 1.9, vel: 0.95, ms: -3 });
  put('bass', L + 4.5, 'deacon', { ...bass, rate: Eb, gate: 0.9, vel: 0.85 });
  put('bass', L + 5.5, 'deacon', { ...bass, rate: Eb, glide: [C, 0.25], gate: 0.6, vel: 0.7 });
  put('bass', L + 6.5, 'deacon', { ...bass, rate: Eb, gate: 0.9, vel: 0.9, ms: -3 });
  put('bass', L + 7.5, 'deacon', { ...bass, rate: C, glide: [D, 0.125], gate: 0.45, vel: 0.62 });
}

// bar 20, PAYMENT
put('stabs', 76, 'ferryman-end', { gate: 3.2, release: 0.2 });
put('kick', 76, KICK, { ...kickHit, gate: 0.6 });
put('bass', 76, 'deacon', { rate: Eb, glide: [st(-6), 1.5], gate: 1.6, choke: 'bass', release: 0.15 });
put('loop', 78, 'coins', { ...loopNote, gate: 0.5, vel: 0.95 });
put('bell', 79, 'bell', { rate: R / 2, gate: 5.5, release: 0.8, vel: 0.95 });
put('vox', 79.5, 'breath-out', { gate: 2, release: 0.3, attack: 0.05, vel: 1 });

// ------------------------------------------------------------------------------------------------ the project
const m = { numerator: 4, denominator: 4 };
const TRACKS: Record<Track, { description: string; sample: string; gainDb: number; pan?: number; effects: object[] }> = {
  record: { description: 'The record as found, two bars straight, heard through the wall of the viewing room.', sample: PRINT, gainDb: 0,
    effects: [{ type: 'highpass', frequencyHz: 320 }, { type: 'lowpass', frequencyHz: 2400 }, { type: 'saturation', driveDb: 6, mix: 0.35 }, { type: 'reverb', roomSize: 0.35, decaySeconds: 0.9, wet: 0.2 }] },
  loop: { description: 'The counterfeit: head-a bar 1 cut into bar 4 on the and-of-three; later the same cut from the feral shout chorus; the two coins.', sample: PRINT, gainDb: -2,
    effects: [{ type: 'highpass', frequencyHz: 170 }, { type: 'saturation', driveDb: 5, mix: 0.3 }, { type: 'compressor', thresholdDb: -20, ratio: 2.5, attackMs: 15, releaseMs: 120, makeupGainDb: 2 }] },
  seven: { description: 'One 7/8 cycle of the crossing, retriggered every three and a half beats across 4/4.', sample: PRINT, gainDb: -3,
    effects: [{ type: 'highpass', frequencyHz: 70 }, { type: 'lowpass', frequencyHz: 5500 }, { type: 'saturation', driveDb: 8, mix: 0.4 }] },
  vox: { description: 'Odile: the sung coins, a cry, the scat run, the long fall, the last breath.', sample: PRINT, gainDb: 5, pan: -0.08,
    effects: [{ type: 'highpass', frequencyHz: 300 }, { type: 'delay', timeMs: 511, wet: 0.2 }, { type: 'reverb', roomSize: 0.55, decaySeconds: 1.8, wet: 0.16 }] },
  stabs: { description: "The record's stop-time stabs and its unresolved last chord.", sample: PRINT, gainDb: -2,
    effects: [{ type: 'highpass', frequencyHz: 90 }, { type: 'saturation', driveDb: 6, mix: 0.35 }, { type: 'reverb', roomSize: 0.6, decaySeconds: 2.2, wet: 0.18 }] },
  bell: { description: 'The viewing-room bell, two octaves down.', sample: PRINT, gainDb: 3,
    effects: [{ type: 'highpass', frequencyHz: 28 }, { type: 'reverb', roomSize: 0.85, decaySeconds: 3.5, wet: 0.25 }] },
  fx: { description: 'A reed bark, the steel string chirping like a toy laser, and the shout downbeat reversed.', sample: PRINT, gainDb: -4, pan: 0.15,
    effects: [{ type: 'highpass', frequencyHz: 120 }, { type: 'reverb', roomSize: 0.6, decaySeconds: 2, wet: 0.2 }] },
  kick: { description: "Iggy's break kick (bar 2, beat 1) at its own speed, above the sub.", sample: PRINT, gainDb: 0,
    effects: [{ type: 'highpass', frequencyHz: 38 }, { type: 'lowpass', frequencyHz: 6500 }, { type: 'saturation', driveDb: 8, mix: 0.45 }, { type: 'compressor', thresholdDb: -16, ratio: 4, attackMs: 6, releaseMs: 90, makeupGainDb: 3 }] },
  snare: { description: "Iggy's break snare (bar 2, beat 2), laid back 20-28 ms.", sample: PRINT, gainDb: 0.5,
    effects: [{ type: 'highpass', frequencyHz: 150 }, { type: 'saturation', driveDb: 9, mix: 0.45 }, { type: 'compressor', thresholdDb: -18, ratio: 3, attackMs: 4, releaseMs: 120, makeupGainDb: 2 }, { type: 'reverb', roomSize: 0.3, decaySeconds: 0.7, wet: 0.08 }] },
  hat: { description: "Iggy's break snares with everything below 6.5 kHz taken away: the wires and the room, cut to a sixteenth.", sample: PRINT, gainDb: 6, pan: -0.2,
    effects: [{ type: 'highpass', frequencyHz: 6500 }, { type: 'lowpass', frequencyHz: 15000 }] },
  perc: { description: "The conga roll at the end of Iggy's break, one hand at a time.", sample: PRINT, gainDb: 7, pan: 0.35,
    effects: [{ type: 'highpass', frequencyHz: 140 }, { type: 'reverb', roomSize: 0.35, decaySeconds: 1, wet: 0.12 }] },
  bass: { description: "The Deacon's one lone low F from the stop bar, played at every pitch of the bass line.", sample: PRINT, gainDb: -4.5,
    effects: [{ type: 'lowpass', frequencyHz: 420 }, { type: 'saturation', driveDb: 10, mix: 0.45 }, { type: 'compressor', thresholdDb: -18, ratio: 3, attackMs: 10, releaseMs: 150, makeupGainDb: 2 }] },
};

export function project(swell: { seconds: number }) {
  const order = Object.keys(TRACKS) as Track[];
  return {
    formatVersion: 1, title: TITLE,
    description: 'A beat made only from one printed record: THE VELVET HEARSE, "Two Coins for the Ferryman" (1971, imaginary), slowed to 88 BPM in D minor, re-cut so the ferryman\'s chord comes early, with its own break, bass note, voice and bell. One reversed slice is derived offline.',
    bpm: BPM, timeSignature: '4/4', key: 'D minor', bars: BARS, seed: 1971,
    render: { duration: { seconds: 59.5 }, tail: 'auto' },
    master: { gainDb: -1.1, effects: [{ type: 'highpass', frequencyHz: 26 }, { type: 'compressor', thresholdDb: -14, ratio: 2.4, attackMs: 12, releaseMs: 160, makeupGainDb: 2.5 }, { type: 'saturation', driveDb: 2, mix: 0.2 }] },
    tracks: order.map(id => {
      const t = TRACKS[id], notes = events.filter(e => e.track === id).map(e => note(e, swell)).sort((a, b) => (a.tick as number) - (b.tick as number));
      return {
        id, description: t.description, instrument: { type: 'sampler', sample: id === 'fx' ? PRINT : t.sample },
        mix: { gainDb: t.gainDb, ...(t.pan ? { pan: t.pan } : {}) }, effects: t.effects, clips: [{ bar: 1, pattern: 'song' }],
        patterns: [{ id: 'song', bars: BARS, notes: notes.map(({ tick, ...rest }) => ({ start: formatPosition(tick as number, m), ...rest })) }],
      };
    }),
  };
}

// ------------------------------------------------------------------------------------------------ build
if (import.meta.url === `file://${process.argv[1]}`) {
  const swell = deriveSwell();
  const proj = project(swell);
  // the reversed swell lives in its own small file: move its events to a track that reads it
  const fx = proj.tracks.find(t => t.id === 'fx')!, swellNotes = events.filter(e => e.track === 'fx' && e.chop === 'swell').length;
  if (swellNotes) {
    const all = fx.patterns[0]!.notes, isSwell = (n: Record<string, unknown>) => n.endSeconds === +swell.seconds.toFixed(6) && n.offsetSeconds === undefined;
    fx.patterns[0]!.notes = all.filter(n => !isSwell(n));
    proj.tracks.push({ id: 'swell', description: 'The shout downbeat reversed (bit-exact offline): it swells into the return.', instrument: { type: 'sampler', sample: SWELL },
      mix: { gainDb: -5 }, effects: [{ type: 'highpass', frequencyHz: 90 }], clips: [{ bar: 1, pattern: 'song' }], patterns: [{ id: 'song', bars: BARS, notes: all.filter(isSwell) }] } as typeof fx);
  }
  const file = join(ROOT, `${SLUG}.json`);
  writeFileSync(file, JSON.stringify(proj, null, 1) + '\n');
  const tag = process.argv[2] ?? 'beat', out = join(WORK, tag);
  rmSync(out, { recursive: true, force: true });
  const t0 = Date.now();
  const res = JSON.parse(execFileSync(process.execPath, [CLI, 'render', file, '--out-dir', out, '--stems', '--format', 'wav,mp3', '--json'], { encoding: 'utf8', maxBuffer: 1 << 28 }));
  if (!res.ok) throw new Error(JSON.stringify(res.errors ?? res, null, 1));
  const manifest = JSON.parse(readFileSync(join(out, `${SLUG}.render.json`), 'utf8'));
  const an = JSON.parse(execFileSync(process.execPath, [CLI, 'analyze', join(out, `${SLUG}.wav`), '--json'], { encoding: 'utf8' })).analysis;
  console.log(`${TITLE}: ${relative(REPO, out)} in ${((Date.now() - t0) / 1000).toFixed(1)} s; ${an.durationSeconds ?? ''} s, ${an.integratedLufs} LUFS, ${an.truePeakDbfs} dBTP, LRA ${an.loudnessRangeLu}`);
  const prod = manifest.production ?? {};
  console.log(`master clipped ${prod.master?.clippedSamples} pre-clip peak ${prod.master?.preClipPeakDbfs}`);
  for (const t of prod.tracks ?? []) console.log(`  ${t.trackId.padEnd(7)} clipped ${String(t.clippedSamples).padStart(6)}  pre-clip peak ${t.preClipPeakDbfs}`);
  console.log(`events: ${events.length}; rate ${R}; swell ${swell.sha256.slice(0, 12)}`);
  if (res.warnings?.length) console.log('warnings:', JSON.stringify(res.warnings).slice(0, 800));
}
