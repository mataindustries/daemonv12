/** SAMPLE LAB 01: the two new source recordings in the shared palette.
 * Run: node experiments/sample-lab-01/scripts/generate-sources.ts [output directory]
 *
 * keys-take.wav  A felt electric-piano take: one player, four chords at 100 BPM (2.4 s each), rolled with human timing and
 *                velocity, through a suitcase tremolo, a small amp, a synthetic room and a gentle tape roll-off. It is the
 *                "record" the lab chops; it contains no bass register so its chops can be repitched against a separate bass.
 * bass-db.wav    One sustained Db2 note from two detuned band-limited saws and a band-limited sub-octave square through a driven four-pole ladder
 *                with a plucked filter envelope. The candidates play it with playbackRate, gate and glide.
 *
 * Original synthesis only: Node built-ins, float64, explicit xorshift32 seeds, no input files, recordings or network.
 * Endpoints are tapered to exact zero, peaks are scaled to a fixed target and PCM16 is written with explicit rounding.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const RATE = 44100, TAU = 2 * Math.PI;
type Wave = Float64Array;
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function xorshift32(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function onePoleLow(x: Wave, cutoff: number): Wave {
  const a = Math.exp(-TAU * cutoff / RATE), y = new Float64Array(x.length);
  let z = 0;
  for (let i = 0; i < x.length; i++) y[i] = z = (1 - a) * x[i]! + a * z;
  return y;
}
function onePoleHigh(x: Wave, cutoff: number): Wave {
  const low = onePoleLow(x, cutoff), y = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = x[i]! - low[i]!;
  return y;
}
function taper(x: Wave, inFrames: number, outFrames: number): void {
  for (let i = 0; i < inFrames; i++) x[i]! *= 0.5 - 0.5 * Math.cos(Math.PI * i / inFrames);
  for (let i = 0; i < outFrames; i++) x[x.length - 1 - i]! *= 0.5 - 0.5 * Math.cos(Math.PI * i / outFrames);
  x[0] = 0; x[x.length - 1] = 0;
}
function peak(...channels: Wave[]): number { let p = 0; for (const c of channels) for (const v of c) p = Math.max(p, Math.abs(v)); return p; }

// ---------------------------------------------------------------- felt electric piano
interface KeyNote { midi: number; at: number; hold: number; velocity: number }

/** One tine-and-pickup voice: a 1:1 FM body whose index follows velocity and decays (the bark), a short inharmonic tine
 * bell, an asymmetric pickup curve for the warm even harmonics, a two-stage decay and a damper release with a soft thump. */
function epVoice(note: KeyNote, rand: () => number, length: number): Wave {
  const out = new Float64Array(length), f = hz(note.midi) * 2 ** ((rand() - 0.5) * 4 / 1200), v = note.velocity;
  const start = Math.round(note.at * RATE), release = note.hold, register = Math.min(1.25, Math.max(0.55, (262 / f) ** 0.35));
  const longDecay = 2.8 * (220 / f) ** 0.45, phase = rand() * TAU, tinePhase = rand() * TAU;
  for (let i = start; i < length; i++) {
    const t = (i - start) / RATE;
    const att = t < 0.0025 ? 0.5 - 0.5 * Math.cos(Math.PI * t / 0.0025) : 1;
    const rel = t < release ? 1 : Math.exp(-(t - release) / 0.11);
    const env = att * rel * (0.5 * Math.exp(-t / 0.42) + 0.5 * Math.exp(-t / longDecay));
    if (env < 1e-5 && t > release) break;
    const index = register * (0.6 + 2.6 * v * v) * (0.22 + 0.78 * Math.exp(-t / 0.2));
    const body = Math.sin(TAU * f * t + phase + index * Math.sin(TAU * f * t + phase));
    const tine = (0.05 + 0.1 * v) * Math.exp(-t / 0.035) * Math.sin(TAU * f * 13.93 * t + tinePhase)
      + 0.06 * v * Math.exp(-t / 0.22) * Math.sin(TAU * f * 3.98 * t + tinePhase);
    const s = body + tine;
    out[i] = v * env * (s + 0.16 * v * s * s - 0.04 * s * s * s);
  }
  // Key thump at the strike and a smaller damper thump at release: dark, very short noise.
  const thump = (at: number, level: number) => {
    const s0 = start + Math.round(at * RATE);
    let z = 0;
    for (let i = 0; i < 0.03 * RATE && s0 + i < length; i++) {
      z = 0.92 * z + 0.08 * (rand() * 2 - 1);
      out[s0 + i]! += level * z * Math.exp(-i / (0.006 * RATE));
    }
  };
  thump(0, 0.18 * v); thump(release, 0.07 * v);
  return out;
}

/** A small, dark synthetic room: four mutually prime comb lines per channel feeding two allpasses, dry-dominant. */
function room(x: Wave, seconds: number, wet: number, stereoOffset: number): Wave {
  const combs = [1171, 1327, 1493, 1613].map(d => d + stereoOffset), aps = [389 + stereoOffset, 131];
  const y = new Float64Array(x.length), sum = new Float64Array(x.length);
  for (const d of combs) {
    const g = 10 ** (-3 * d / (seconds * RATE)), buf = new Float64Array(d);
    let p = 0, lp = 0;
    for (let i = 0; i < x.length; i++) {
      const o = buf[p]!; lp = 0.6 * o + 0.4 * lp;
      buf[p] = x[i]! + g * lp; p = (p + 1) % d; sum[i]! += o / combs.length;
    }
  }
  let s = sum;
  for (const d of aps) {
    const buf = new Float64Array(d), next = new Float64Array(x.length);
    let p = 0;
    for (let i = 0; i < x.length; i++) { const o = buf[p]!, input = s[i]! + 0.5 * o; buf[p] = input; next[i] = o - 0.5 * input; p = (p + 1) % d; }
    s = next;
  }
  for (let i = 0; i < x.length; i++) y[i] = x[i]! + wet * s[i]!;
  return y;
}

// The take: four chords one bar apart at 100 BPM (2.4 s). Close rootless voicings around F3-F4 with a sung-sounding top.
// Each chord is rolled bottom to top over 14-38 ms; the right hand lands a little after the left. One inner-voice move per
// chord gives later chops a different color from the attack.
export const KEYS_BPM = 100, KEYS_BAR = 2.4;
export const KEYS_CHORDS = [
  { name: 'Dbmaj9', at: 0.05, voicing: [53, 56, 60, 63, 68], move: { from: 68, to: 70, at: 1.2 } },      // F3 Ab3 C4 Eb4 Ab4; top Ab4 -> Bb4 (Db6/9)
  { name: 'Bbm9', at: 2.45, voicing: [56, 60, 61, 65, 68], move: { from: 61, to: 63, at: 1.25 } },       // Ab3 C4 Db4 F4 Ab4; Db4 -> Eb4 (sus color)
  { name: 'Ebm11', at: 4.85, voicing: [54, 58, 61, 65, 68], move: { from: 68, to: 66, at: 1.2 } },       // Gb3 Bb3 Db4 F4 Ab4; Ab4 -> Gb4
  { name: 'Gbmaj9', at: 7.25, voicing: [53, 56, 58, 61, 65], move: { from: 58, to: 60, at: 1.2 } },      // F3 Ab3 Bb3 Db4 F4; Bb3 -> C4 (Ab13sus color)
] as const;
export const KEYS_SECONDS = 11.0;

function keysTake(): { left: Wave; right: Wave; notes: KeyNote[] } {
  const rand = xorshift32(0x5a17_0001), length = Math.round(KEYS_SECONDS * RATE), notes: KeyNote[] = [];
  const velocities = [0.62, 0.7, 0.58, 0.66];
  KEYS_CHORDS.forEach((chord, c) => {
    const roll = 0.014 + 0.024 * rand(), base = velocities[c]!;
    chord.voicing.forEach((midi, k) => {
      const rightHand = k >= 2, at = chord.at + roll * k / (chord.voicing.length - 1) + (rightHand ? 0.006 : 0) + (rand() - 0.5) * 0.004;
      const top = k === chord.voicing.length - 1;
      const moved = midi === chord.move.from;
      notes.push({ midi, at, hold: moved ? chord.move.at - (at - chord.at) : 2.3 - (at - chord.at) + (rand() - 0.5) * 0.06,
        velocity: Math.min(0.95, base * (top ? 1.12 : rightHand ? 1 : 0.9) + (rand() - 0.5) * 0.08) });
    });
    const m = chord.move;
    notes.push({ midi: m.to, at: chord.at + m.at + 0.008, hold: 2.3 - m.at, velocity: base * 0.92 });
  });
  const mono = new Float64Array(length);
  for (const n of notes) { const v = epVoice(n, rand, length); for (let i = 0; i < length; i++) mono[i]! += v[i]!; }
  // Suitcase tremolo: a slow 4.4 Hz pan between the two speakers, then a mildly driven amp and the room.
  const left = new Float64Array(length), right = new Float64Array(length);
  for (let i = 0; i < length; i++) {
    const p = 0.16 * Math.sin(TAU * 4.4 * i / RATE + 0.7);
    const l = Math.tanh(1.5 * mono[i]! * (1 + p) * 0.35) / Math.tanh(1.5), r = Math.tanh(1.5 * mono[i]! * (1 - p) * 0.35) / Math.tanh(1.5);
    left[i] = l; right[i] = r;
  }
  const wetL = room(left, 1.3, 0.16, 0), wetR = room(right, 1.3, 0.16, 23);
  // Tape-like roll-off and DC/rumble cleanup.
  const outL = onePoleHigh(onePoleLow(onePoleLow(wetL, 9500), 12500), 70), outR = onePoleHigh(onePoleLow(onePoleLow(wetR, 9500), 12500), 70);
  return { left: outL, right: outR, notes };
}

// ---------------------------------------------------------------- Moog-style bass
export const BASS_MIDI = 37, BASS_SECONDS = 3.2; // Db2, 69.30 Hz

function bandLimitedSaw(f: number, t: number, phase: number): number {
  let s = 0;
  for (let k = 1; k * f < 16000; k++) s += Math.sin(k * (TAU * f * t + phase)) / k;
  return s * 0.55;
}
function bassNote(): Wave {
  const length = Math.round(BASS_SECONDS * RATE), f = hz(BASS_MIDI), rand = xorshift32(0x5a17_0002);
  const x = new Float64Array(length), p1 = rand() * TAU, p2 = rand() * TAU, p3 = rand() * TAU;
  for (let i = 0; i < length; i++) {
    const t = i / RATE;
    let sub = 0;
    for (let k = 1; k * f / 2 < 8000; k += 2) sub += Math.sin(k * (TAU * f / 2 * t + p3)) / k;
    x[i] = 0.5 * bandLimitedSaw(f * 2 ** (3 / 1200), t, p1) + 0.5 * bandLimitedSaw(f * 2 ** (-3 / 1200), t, p2) + 0.45 * sub;
  }
  // Four-pole ladder with per-stage tanh, run at 2x by linear upsampling; cutoff follows a plucked envelope.
  const y = new Float64Array(length), s = [0, 0, 0, 0], resonance = 0.36;
  for (let i = 0; i < length; i++) {
    const t = i / RATE, cutoff = 150 + 1700 * Math.exp(-t / 0.07) + 430 * Math.exp(-t / 1.2);
    const g = 1 - Math.exp(-TAU * cutoff / (RATE * 2));
    let out = 0;
    for (const input of [i ? 0.5 * (x[i]! + x[i - 1]!) : x[i]!, x[i]!]) {
      let u = Math.tanh(input * 0.9 - resonance * 4 * s[3]!);
      for (let k = 0; k < 4; k++) { s[k] = s[k]! + g * (Math.tanh(u) - Math.tanh(s[k]!)); u = s[k]!; }
      out = s[3]!;
    }
    const att = t < 0.004 ? 0.5 - 0.5 * Math.cos(Math.PI * t / 0.004) : 1;
    const amp = att * (0.78 + 0.22 * Math.exp(-t / 0.25)) * Math.exp(-t / 5.5);
    y[i] = Math.tanh(1.6 * out * amp) / Math.tanh(1.6);
  }
  return onePoleHigh(y, 22);
}

// ---------------------------------------------------------------- output
function wavBytes(channels: Wave[]): Buffer {
  const frames = channels[0]!.length, ch = channels.length, bytes = Buffer.alloc(44 + frames * ch * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(ch, 22); bytes.writeUInt32LE(RATE, 24);
  bytes.writeUInt32LE(RATE * ch * 2, 28); bytes.writeUInt16LE(ch * 2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(frames * ch * 2, 40);
  for (let i = 0; i < frames; i++) for (let c = 0; c < ch; c++) {
    const v = Math.max(-32768, Math.min(32767, Math.round(channels[c]![i]! * 32767)));
    bytes.writeInt16LE(v, 44 + (i * ch + c) * 2);
  }
  return bytes;
}
function scaleTo(channels: Wave[], dbfs: number): void {
  const k = 10 ** (dbfs / 20) / peak(...channels);
  for (const c of channels) for (let i = 0; i < c.length; i++) c[i]! *= k;
}

export function generate(outDir: string) {
  mkdirSync(outDir, { recursive: true });
  const keys = keysTake();
  for (const c of [keys.left, keys.right]) taper(c, 32, Math.round(0.4 * RATE));
  scaleTo([keys.left, keys.right], -3);
  const bass = bassNote();
  taper(bass, 24, Math.round(0.25 * RATE));
  scaleTo([bass], -4);
  const files = [
    { file: 'keys-take.wav', bytes: wavBytes([keys.left, keys.right]) },
    { file: 'bass-db.wav', bytes: wavBytes([bass]) },
  ];
  for (const f of files) writeFileSync(join(outDir, f.file), f.bytes);
  return { files: files.map(f => ({ file: f.file, bytes: f.bytes.length, sha256: createHash('sha256').update(f.bytes).digest('hex') })), keyNotes: keys.notes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const here = dirname(fileURLToPath(import.meta.url));
  const out = resolve(process.argv[2] ?? join(here, '..', 'projects', 'assets', 'palette'));
  const result = generate(out);
  console.log(JSON.stringify({ outDir: out, files: result.files }, null, 2));
}
