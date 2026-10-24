/** MORPH v1: five frozen one-shots, not a new engine instrument.
 * Node-only regeneration: node scripts/generate-morph-pack.ts [examples-directory]
 * The narrow offline adaptations and source hashes are documented in MORPH_SOUND_AUDIT.md.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const RATE = 44100, TAU = 2 * Math.PI;
export const PACK_VERSION = '1.0.0';
export const sourceReferences = [
  { repository: 'mataindustries/daemonv12', revision: '2b6e533a021218d6940a8da5a7032c2abe58a3d9', path: 'experiments/morph-03/cable.mjs', sha256: '591ae70a37b96a99ed57bc73819f61d314f84e5512f83c9084a1291219c7fa19' },
  { repository: 'mataindustries/daemonv12', revision: '2b6e533a021218d6940a8da5a7032c2abe58a3d9', path: 'experiments/morph-03/dsp.mjs', sha256: 'd219f8cd93748889636fbb8037940c52d3b6651ffe1aeff1a07fc59c3a115258' },
  { repository: 'mataindustries/daemonv12', revision: '2b6e533a021218d6940a8da5a7032c2abe58a3d9', path: 'experiments/morph-06/beast.mjs', sha256: 'fa1b83049efbe2e92ff81ad63f42a8b6f8bf63512629dacca13ee1243f017806' },
  { repository: 'mataindustries/daemonv12', revision: '2b6e533a021218d6940a8da5a7032c2abe58a3d9', path: 'experiments/morph-04/perform.mjs', sha256: '727ca9556c112ec12be56e4a9d6e0f154671bd1eb37cf25bf4a1902a1826b123' },
] as const;

const cableParameters = { fundamentalHz: 55, dispersion: -0.22, stages: 32, brightnessHz: 5200, drive: 2.4, relaxSeconds: 0.07 };
export const sounds = [
  { id: 'cable-pluck', seconds: 0.65, peakDbfs: -10, seed: 31, pitch: 36, family: 'cable', parameters: { ...cableParameters, loopGain: 0.991, hardness: 0.65, stretch: 0.012, buzz: 0.05, excitationSeconds: 0.00165 }, method: 'Fractional-delay feedback, allpass dispersion, loss, tension relaxation and one-sided contact; one pluck.' },
  { id: 'cable-slap', seconds: 0.4, peakDbfs: -10, seed: 32, pitch: 38, family: 'cable', parameters: { ...cableParameters, loopGain: 0.975, hardness: 1, stretch: 0.3, buzz: 0.65, excitationSeconds: 0.00025 }, method: 'The same cable loop with harder excitation, stronger initial tension and contact, and shorter decay.' },
  { id: 'beast-wom', seconds: 0.65, peakDbfs: -12, seed: 77, pitch: null, family: 'beast', parameters: { fundamentalHz: 55, dispersion: -0.16, stages: 32, loopGain: 1.045, brightnessHz: 6500, drive: 2.8, hardness: 0.94, stretch: 0.012, buzz: 0.49, excitationSeconds: 0.00078, relaxSeconds: 0.07, bow: 1, foldDrive: 3, formantsClosedHz: [300, 750, 2100], formantsOpenHz: [700, 1200, 2600], mouthOpenSeconds: 0.13, mouthCloseSeconds: 0.325, formantQ: 4, ringHz: 1318.51, ringFeedback: 0.62, ringMix: 0.22, subMix: 0.2 }, method: 'Bowed cable folds and the original fold waveshaper, with a small three-resonator ww→ah→closed mouth approximation, metal ring and clean sub. Not the original Kelly–Lochbaum throat.' },
  { id: 'ratchet-open', seconds: 0.16, peakDbfs: -13, seed: 35, pitch: 46, family: 'ratchet', parameters: { captureSeconds: 0.4, bodyHz: 170, bodyDecaySeconds: 0.045, noiseDecaySeconds: 0.035, edgeFadeSeconds: 0.0007, source: 'cable-slap + seeded contact' }, method: 'A frozen first slice of a new cable/contact capture; triangular 0.7 ms edges follow the original ratchet. Schedule each repeat as a note.' },
  { id: 'ratchet-tight', seconds: 0.08, peakDbfs: -14, seed: 35, pitch: 42, family: 'ratchet', parameters: { captureSeconds: 0.4, bodyHz: 170, bodyDecaySeconds: 0.045, noiseDecaySeconds: 0.035, edgeFadeSeconds: 0.0007, source: 'cable-slap + seeded contact' }, method: 'The same capture, half the open slice length, with the same 0.7 ms edge rule; independently scheduled repeats remain visible in the event map.' },
] as const;
export type SoundId = typeof sounds[number]['id'];

// Same mulberry32 integer operations as MORPH//03 dsp.mjs; no global random state.
function noise(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2147483648 - 1;
  };
}
interface CableParameters { fundamentalHz: number; dispersion: number; stages: number; brightnessHz: number; drive: number; loopGain: number; hardness: number; stretch: number; buzz: number; excitationSeconds: number; relaxSeconds: number; bow?: number }
// A single stationary note extracts the cable loop, not its performance controller.
function cable(seconds: number, p: CableParameters, seed: number): Float64Array {
  const out = new Float64Array(Math.round(seconds * RATE)), line = new Float64Array(4096), z = new Float64Array(p.stages), random = noise(seed);
  const w = TAU * p.fundamentalHz / RATE, a = p.dispersion;
  const phase = Math.atan2(-Math.sin(w), a + Math.cos(w)) - Math.atan2(-a * Math.sin(w), 1 + a * Math.cos(w));
  const allpassDelay = p.stages * (-(phase > 0 ? phase - TAU : phase) / w);
  const c = 1 - Math.exp(-TAU * p.brightnessHz / RATE);
  const lossDelay = Math.atan2((1 - c) * Math.sin(w), 1 - (1 - c) * Math.cos(w)) / w;
  const excitationFrames = Math.max(2, Math.round(p.excitationSeconds * RATE));
  let lp = 0, energy = 0, previous = 0, dc = 0;
  const dcCoefficient = Math.exp(-TAU * 5 / RATE);
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE, tension = 1 + p.stretch * p.hardness * Math.exp(-t / p.relaxSeconds);
    const delay = Math.max(2, RATE / (p.fundamentalHz * tension) - allpassDelay - lossDelay);
    const read = (i - delay + line.length * 2) % line.length, index = Math.floor(read), fraction = read - index;
    let y = line[index]! * (1 - fraction) + line[(index + 1) % line.length]! * fraction;
    if (i < excitationFrames) y += Math.sin(Math.PI * i / excitationFrames) * (0.6 + 0.8 * random() * p.hardness);
    y += (p.bow ?? 0) * 0.015 * random();
    for (let k = 0; k < z.length; k++) { const v = a * y + z[k]!; z[k] = y - a * v; y = v; }
    lp += c * (y - lp);
    const gain = p.loopGain * (1 + (p.bow ?? 0) * 0.12 * Math.max(0, 1 - Math.sqrt(energy) / 0.22));
    y = Math.tanh(lp * gain * p.drive) / p.drive;
    const barrier = 0.42 * (1 - 0.8 * p.buzz);
    if (y > barrier) y = barrier + (y - barrier) / (1 + 14 * p.buzz * (y - barrier));
    dc = y - previous + dcCoefficient * dc; previous = y;
    line[i % line.length] = dc; out[i] = dc;
    energy += (dc * dc - energy) * (1 - Math.exp(-1 / (0.02 * RATE)));
  }
  return out;
}
function normalize(wave: Float64Array, peak = 1): Float64Array {
  let measured = 0; for (const x of wave) measured = Math.max(measured, Math.abs(x));
  if (!measured) throw new Error('Silent synthesis');
  return wave.map(x => x * peak / measured);
}
function beast(): Float64Array {
  const spec = sounds[2], p = spec.parameters, source = normalize(cable(spec.seconds, p, spec.seed));
  const folded = source.map(x => { const v = x * p.foldDrive; return 0.6 * Math.tanh(v) + 0.4 * Math.sin(1.3 * v); });
  const out = new Float64Array(source.length), y1 = [0, 0, 0], y2 = [0, 0, 0], ring = new Float64Array(Math.round(RATE / p.ringHz));
  let sub = 0, mouthPeak = 0;
  const mouth = new Float64Array(source.length);
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE, openness = Math.max(0, Math.min(1, t / p.mouthOpenSeconds, (spec.seconds - t) / p.mouthCloseSeconds));
    const smooth = openness * openness * (3 - 2 * openness);
    let value = 0;
    for (let k = 0; k < 3; k++) {
      const hz = p.formantsClosedHz[k]! + (p.formantsOpenHz[k]! - p.formantsClosedHz[k]!) * smooth;
      const radius = Math.exp(-Math.PI * hz / (p.formantQ * RATE));
      const y = folded[i]! * (1 - radius) + 2 * radius * Math.cos(TAU * hz / RATE) * y1[k]! - radius * radius * y2[k]!;
      y2[k] = y1[k]!; y1[k] = y; value += y * [1, 0.7, 0.4][k]!;
    }
    mouth[i] = value * (0.1 + 0.9 * smooth); mouthPeak = Math.max(mouthPeak, Math.abs(mouth[i]!));
  }
  // A frozen one-shot fixes its normalization reference; later composition notes cannot change it.
  for (let i = 0; i < out.length; i++) {
    const grit = Math.tanh(1.5 * mouth[i]! / mouthPeak), r = i % ring.length, previous = ring[r]!;
    ring[r] = grit + p.ringFeedback * previous;
    sub += (source[i]! - sub) * (1 - Math.exp(-TAU * 100 / RATE));
    out[i] = 0.85 * grit + p.ringMix * previous + p.subMix * sub;
  }
  return out;
}
function ratchet(seconds: number): Float64Array {
  const spec = sounds[3], p = spec.parameters, capture = cable(p.captureSeconds, sounds[1].parameters, sounds[1].seed), random = noise(spec.seed);
  for (let i = 0; i < capture.length; i++) {
    const t = i / RATE;
    capture[i]! += 0.35 * Math.sin(TAU * p.bodyHz * t) * Math.exp(-t / p.bodyDecaySeconds) + 0.4 * random() * Math.exp(-t / p.noiseDecaySeconds);
  }
  const slice = capture.slice(0, Math.round(seconds * RATE)), fade = Math.max(2, Math.round(p.edgeFadeSeconds * RATE));
  return slice.map((x, i) => x * Math.min(1, i / fade, (slice.length - 1 - i) / fade));
}
export function synthesizeSound(id: SoundId): Buffer {
  const spec = sounds.find(sound => sound.id === id);
  if (!spec) throw new RangeError(`Unknown MORPH v1 sound: ${id}`);
  const wave = spec.family === 'cable' ? cable(spec.seconds, spec.parameters as CableParameters, spec.seed) : spec.family === 'beast' ? beast() : ratchet(spec.seconds);
  // Fixed finite one-shots have 0.5 ms start / 6 ms end tapers, then a recorded peak target.
  const tapered = normalize(wave.map((x, i) => x * Math.min(1, i / 22, (wave.length - 1 - i) / 265)), 10 ** (spec.peakDbfs / 20));
  const bytes = Buffer.alloc(44 + tapered.length * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8); bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22); bytes.writeUInt32LE(RATE, 24); bytes.writeUInt32LE(RATE * 2, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(tapered.length * 2, 40);
  for (let i = 0; i < tapered.length; i++) {
    if (!Number.isFinite(tapered[i]!)) throw new Error('Nonfinite synthesis');
    bytes.writeInt16LE(Math.round(tapered[i]! * 32767), 44 + 2 * i);
  }
  return bytes;
}
export function generatePack(output = 'examples'): void {
  const directory = join(output, 'assets/morph-v1'); mkdirSync(directory, { recursive: true });
  const entries = sounds.map(sound => {
    const bytes = synthesizeSound(sound.id), file = `${sound.id}.wav`; writeFileSync(join(directory, file), bytes);
    return { ...sound, file: `assets/morph-v1/${file}`, frames: Math.round(sound.seconds * RATE), sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
  });
  writeFileSync(join(directory, 'kit.json'), JSON.stringify({ formatVersion: 1, samples: entries.filter(s => s.pitch !== null).map(s => ({ name: s.id, pitch: s.pitch, file: `${s.id}.wav` })) }, null, 2) + '\n');
  writeFileSync(join(output, 'morph-v1.catalog.json'), JSON.stringify({ pack: 'MORPH', version: PACK_VERSION, sampleRate: RATE, channels: 1, bitsPerSample: 16, generator: 'scripts/generate-morph-pack.ts', generatorSourceSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), provenance: 'New offline one-shots adapted from historical MORPH source; no historical render or film audio is sampled.', rights: 'Repository licensing has not been selected. No new license grant is asserted for historical source or these derived assets.', processing: { float: 'Float64', startTaperFrames: 22, endTaperFrames: 265, quantization: 'nearest PCM16, no dither', normalisation: 'one independently frozen peak reference per sound' }, sources: sourceReferences, sounds: entries }, null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) generatePack(process.argv[2]);
