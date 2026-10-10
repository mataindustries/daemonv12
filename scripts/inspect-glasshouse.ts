/** Read-only, offline QC for GLASSHOUSE sources and audition. Unweighted power, not perceived loudness.
 * node scripts/inspect-glasshouse.ts [audition.wav] > renders/glasshouse/spectral.json
 * Tuning: Hann-windowed 65536-point FFT with parabolic peak interpolation, searched within ±1 semitone of the catalog note.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodePcm } from '../src/render/index.ts';
import { inspect } from './inspect-orbital-foundry.ts';
const RATE = 44100;

function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j]!, re[i]!]; [im[i], im[j]] = [im[j]!, im[i]!]; } }
  for (let size = 2; size <= n; size *= 2) for (let base = 0; base < n; base += size) for (let j = 0; j < size / 2; j++) {
    const a = -2 * Math.PI * j / size, c = Math.cos(a), s = Math.sin(a), k = base + j, h = k + size / 2;
    const tr = c * re[h]! - s * im[h]!, ti = s * re[h]! + c * im[h]!;
    re[h] = re[k]! - tr; im[h] = im[k]! - ti; re[k]! += tr; im[k]! += ti;
  }
}
export function load(path: string) {
  const decoded = decodePcm(readFileSync(path)); if (!decoded.pcm) throw new Error(decoded.error);
  const { samples, frames, channels } = decoded.pcm;
  const mono = Float64Array.from({ length: frames }, (_, i) => { let s = 0; for (let c = 0; c < channels; c++) s += samples[i * channels + c]!; return s / channels / 32768; });
  const channel = (c: number) => Float64Array.from({ length: frames }, (_, i) => samples[i * channels + c]! / 32768);
  return { frames, channels, mono, channel };
}
/** Power spectrum of a Hann-windowed segment, zero-padded to `size`. */
export function spectrum(x: Float64Array, start = 0, length = x.length - start, size = 65536): Float64Array {
  const re = new Float64Array(size), im = new Float64Array(size), n = Math.min(length, size, x.length - start);
  for (let i = 0; i < n; i++) re[i] = x[start + i]! * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / Math.max(1, n - 1)));
  fft(re, im);
  return Float64Array.from({ length: size / 2 + 1 }, (_, k) => re[k]! ** 2 + im[k]! ** 2);
}
const binHz = (size: number) => RATE / size;
/** Strongest spectral peak within ±1 semitone of `expected`, with parabolic interpolation on log power. */
export function pitch(x: Float64Array, expected: number, start = 0, length = x.length - start): { hz: number; cents: number } {
  const size = 65536, power = spectrum(x, start, length, size), w = binHz(size);
  const lo = Math.floor(expected * 2 ** (-1 / 12) / w), hi = Math.ceil(expected * 2 ** (1 / 12) / w);
  let best = lo; for (let k = lo; k <= hi; k++) if (power[k]! > power[best]!) best = k;
  const [a, b, c] = [power[best - 1]!, power[best]!, power[best + 1]!].map(v => Math.log(v + 1e-30)) as [number, number, number];
  const hz = (best + 0.5 * (a - c) / (a - 2 * b + c)) * w;
  return { hz: Number(hz.toFixed(3)), cents: Number((1200 * Math.log2(hz / expected)).toFixed(2)) };
}
/** Frequencies of the strongest local maxima (at least `separation` apart), strongest first. */
export function peaks(x: Float64Array, count: number, minHz = 40, separation = 0.04, start = 0, length = x.length - start): number[] {
  const size = 65536, power = spectrum(x, start, length, size), w = binHz(size), found: number[] = [];
  const order = Array.from({ length: power.length }, (_, k) => k).filter(k => k * w >= minHz && k * w < 19000 && power[k]! > power[k - 1]! && power[k]! >= power[k + 1]!).sort((a, b) => power[b]! - power[a]!);
  for (const k of order) { const f = k * w; if (found.every(g => Math.abs(Math.log(f / g)) > separation)) found.push(f); if (found.length === count) break; }
  return found.map(f => Number(f.toFixed(2)));
}
/** Log-energy profile over third-octave bands 100 Hz–16 kHz (mean removed), for timbre comparison. */
export function profile(x: Float64Array, start = 0, length = x.length - start): number[] {
  const size = 16384, power = spectrum(x, start, length, size), w = binHz(size), bands: number[] = [];
  for (let f = 100; f < 16000; f *= 2 ** (1 / 3)) { let e = 1e-12; for (let k = Math.ceil(f / w); k * w < f * 2 ** (1 / 3); k++) e += power[k]!; bands.push(10 * Math.log10(e)); }
  const mean = bands.reduce((a, b) => a + b, 0) / bands.length; return bands.map(b => b - mean);
}
export function similarity(a: number[], b: number[]): number {
  let ab = 0, aa = 0, bb = 0; a.forEach((v, i) => { ab += v * b[i]!; aa += v * v; bb += b[i]! ** 2; });
  return Number((ab / Math.sqrt(aa * bb)).toFixed(4));
}
/** 5 ms RMS envelope (dB relative to its own maximum). */
export function envelope(x: Float64Array, ms = 5): number[] {
  const hop = Math.round(RATE * ms / 1000), out: number[] = [];
  for (let i = 0; i < x.length; i += hop) { let s = 0, n = 0; for (let j = i; j < Math.min(x.length, i + hop); j++) { s += x[j]! ** 2; n++; } out.push(Math.sqrt(s / n)); }
  const max = Math.max(...out); return out.map(v => Number((20 * Math.log10(v / max + 1e-12)).toFixed(2)));
}
const centroid = (x: Float64Array) => { const p = spectrum(x, 0, x.length, 16384), w = binHz(16384); let a = 0, b = 0; p.forEach((v, k) => { a += v * k * w; b += v; }); return Math.round(a / b); };
function correlation(a: Float64Array, b: Float64Array): number { let ab = 0, aa = 0, bb = 0; for (let i = 0; i < a.length; i++) { ab += a[i]! * b[i]!; aa += a[i]! ** 2; bb += b[i]! ** 2; } return Number((ab / Math.sqrt(aa * bb)).toFixed(4)); }
function lowpass(x: Float64Array, hz: number) { const a = 1 - Math.exp(-2 * Math.PI * hz / RATE); let y1 = 0, y2 = 0; return x.map(v => { y1 += a * (v - y1); y2 += a * (y1 - y2); return y2; }); }

export function measure(path: string, expectedHz: number | null) {
  const basic = inspect(path), audio = load(path), env = envelope(audio.mono);
  const peakAt = env.indexOf(0), below40 = env.findIndex((v, i) => i > peakAt && v < -40);
  const tenth = Math.max(1, Math.floor(audio.frames / 10)), rms = (s: number) => { let e = 0; for (let i = s; i < s + tenth; i++) e += audio.mono[i]! ** 2; return 10 * Math.log10(e / tenth + 1e-20); };
  return {
    file: path, seconds: Number(basic.seconds.toFixed(6)), channels: basic.channels, peakDbfs: basic.peakDbfs, rmsDbfs: basic.rmsDbfs, dc: Number(basic.dc.toExponential(3)), clippedSamples: basic.clippedSamples,
    stereoCorrelation: basic.stereoCorrelation, lowBandCorrelation: audio.channels === 2 ? correlation(lowpass(audio.channel(0), 150), lowpass(audio.channel(1), 150)) : null,
    tuning: expectedHz ? pitch(audio.mono, expectedHz, 0, Math.min(audio.frames, Math.round(RATE * 0.5))) : null, centroidHz: centroid(audio.mono),
    envelopePeakMs: peakAt * 5, decayTo40dBMs: below40 < 0 ? null : below40 * 5, firstTenthDb: Number(rms(0).toFixed(2)), lastTenthDb: Number(rms(audio.frames - tenth).toFixed(2)),
    bandPowerPercent: basic.bandPowerPercent,
  };
}

/** Family evidence: shared glass mode ratios, shared vox spectral profile, and the low pair's coherent sum. */
export function families(directory = 'examples/assets/glasshouse') {
  const file = (name: string) => load(`${directory}/${name}`);
  const hit = file('01-glass-hit.wav'), reverse = file('02-glass-reverse.wav'), crush = file('03-glass-crush.wav');
  const ratios = (x: Float64Array, f0: number, start = 0, length = x.length) => peaks(x, 8, f0 * 0.8, 0.08, start, length).map(f => Number((f / f0).toFixed(3))).sort((a, b) => a - b);
  const vox = file('04-ghost-vox.wav'), chip = file('05-vox-chip.wav'), hat = file('09-pixel-hat.wav'), clap = file('08-chrome-clap.wav');
  const voxProfile = profile(vox.mono, Math.round(0.3 * RATE), Math.round(0.3 * RATE)), chipProfile = profile(chip.mono);
  const punch = file('06-bass-punch-cs.wav'), sub = file('07-sub-cs.wav');
  const sum = Float64Array.from(sub.mono, (v, i) => v + (punch.mono[i] ?? 0));
  const energy = (x: Float64Array, n: number) => { let e = 0; for (let i = 0; i < n; i++) e += x[i]! ** 2; return e; };
  const window = Math.round(0.25 * RATE);
  return {
    glassModeRatios: { hit: ratios(hit.mono, 554.365, 0, 16384), reverse: ratios(reverse.mono, 554.365, reverse.frames - 16384, 16384), crush: ratios(crush.mono, 138.591, 0, 8192) },
    voxProfileSimilarity: { chipToVox: similarity(chipProfile, voxProfile), hatToVox: similarity(profile(hat.mono), voxProfile), clapToVox: similarity(profile(clap.mono), voxProfile) },
    lowLayer: {
      peakDbfsAtUnity: Number((20 * Math.log10(Math.max(...sum.map(Math.abs)))).toFixed(3)),
      coherentGainDb: Number((10 * Math.log10(energy(sum, window) / (energy(sub.mono, window) + energy(punch.mono, window)))).toFixed(3)),
      punchToSubCorrelation: correlation(punch.mono.slice(Math.round(0.04 * RATE), window), sub.mono.slice(Math.round(0.04 * RATE), window)),
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const catalog = JSON.parse(readFileSync('examples/glasshouse.catalog.json', 'utf8'));
  const master = process.argv[2] ?? 'renders/glasshouse/glasshouse-audition.wav';
  console.log(JSON.stringify({
    method: '8192-point Hann band power (independent channels, unweighted, includes fades); 65536-point tuning FFT with parabolic interpolation; 5 ms RMS envelopes.',
    master: inspect(master), sources: catalog.sounds.map((s: { file: string; fundamentalHz: number | null }) => measure(`examples/${s.file}`, s.fundamentalHz)), families: families(),
  }, null, 2));
}
