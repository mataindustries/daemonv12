/** Read-only, offline QC for the V12 SIGNATURE pack. Unweighted measurements; no listening is implied.
 * node scripts/inspect-v12-signature.ts [pack directory] > verification.json
 * True peak: 4x windowed-sinc interpolation (32 taps per phase). Clicks: 1 ms energy above 12 kHz against the loudest
 * other frame within ±40 ms, outside each sound's designed attack. Pitch: autocorrelation track (median and spread in
 * cents) plus a 65536-point spectral peak. Low band: two-pole 150 Hz low-pass; phase lock: four-pole 80 Hz low-pass.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { load, pitch, spectrum } from './inspect-glasshouse.ts';
import { inspect } from './inspect-orbital-foundry.ts';
import { DEFAULT_OUTPUT } from './generate-v12-signature.ts';
const RATE = 44100;
const db = (v: number) => v > 0 ? Number((20 * Math.log10(v)).toFixed(2)) : -Infinity;

/** Inter-sample peak of one channel (linear), 4x oversampled. */
export function truePeak(x: Float64Array): number {
  const half = 16, kaiser = (r: number) => { const a = 8, i0 = (v: number) => { let s = 1, t = 1; for (let k = 1; k < 30; k++) { t *= (v / (2 * k)) ** 2; s += t; } return s; }; return i0(a * Math.sqrt(Math.max(0, 1 - r * r))) / i0(a); };
  const phases = [0.25, 0.5, 0.75].map(f => Float64Array.from({ length: 2 * half }, (_, j) => { const d = j - half + 1 - f; return (Math.sin(Math.PI * d) / (Math.PI * d)) * kaiser(d / half); }));
  let peak = 0;
  for (let i = 0; i < x.length; i++) {
    peak = Math.max(peak, Math.abs(x[i]!));
    for (const h of phases) { let s = 0; for (let j = 0; j < h.length; j++) { const m = i + j - half + 1; if (m >= 0 && m < x.length) s += h[j]! * x[m]!; } peak = Math.max(peak, Math.abs(s)); }
  }
  return peak;
}
function biquadLow(x: Float64Array, f: number): Float64Array {
  const w = 2 * Math.PI * f / RATE, c = Math.cos(w), alpha = Math.sin(w) / Math.SQRT2, a0 = 1 + alpha;
  const b0 = (1 - c) / 2 / a0, b1 = (1 - c) / a0, a1 = -2 * c / a0, a2 = (1 - alpha) / a0; let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x.map(v => { const y = b0 * v + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; return y; });
}
const highBand = (x: Float64Array, f: number) => { let y = x; for (let k = 0; k < 2; k++) { const low = biquadLow(y, f); y = y.map((v, i) => v - low[i]!); } return y; };
function correlation(a: Float64Array, b: Float64Array): number { let ab = 0, aa = 0, bb = 0; for (let i = 0; i < a.length; i++) { ab += a[i]! * b[i]!; aa += a[i]! ** 2; bb += b[i]! ** 2; } return aa && bb ? Number((ab / Math.sqrt(aa * bb)).toFixed(4)) : 1; }
const energy = (x: Float64Array) => x.reduce((s, v) => s + v * v, 0);

/** Largest 1 ms burst above 12 kHz relative to the loudest other frame within ±40 ms (dB), from `from` to `to` seconds.
 * Periodic waveform edges (an E1 saw resets every 24 ms) have equally loud neighbours; an isolated step does not. */
export function clickScore(x: Float64Array, from: number, to: number): { db: number; atSeconds: number } {
  const events = clickEvents(x, from, to, -Infinity), best = events.reduce((b, e) => e.db > b.db ? e : b, { db: -Infinity, atSeconds: 0 });
  return { db: Number(best.db.toFixed(2)), atSeconds: Number(best.atSeconds.toFixed(4)) };
}
/** Every 1 ms frame in [from, to) seconds whose burst ratio (as in clickScore) exceeds `thresholdDb`. */
export function clickEvents(x: Float64Array, from: number, to: number, thresholdDb: number): { db: number; atSeconds: number }[] {
  const hf = highBand(x, 12000), hop = 44, frames = Math.floor(x.length / hop), e = new Float64Array(frames), found: { db: number; atSeconds: number }[] = [];
  for (let j = 0; j < frames; j++) { let s = 0; for (let i = j * hop; i < (j + 1) * hop; i++) s += hf[i]! ** 2; e[j] = s / hop; }
  const floor = Math.max(energy(x) / x.length * 1e-7, 1e-7); // absolute floor: -70 dBFS power
  for (let j = Math.ceil(from * RATE / hop); j < Math.min(frames, Math.floor(to * RATE / hop)); j++) {
    const around: number[] = []; for (let k = Math.max(0, j - 40); k < Math.min(frames, j + 40); k++) if (Math.abs(k - j) > 1) around.push(e[k]!);
    const baseline = around.reduce((m, v) => Math.max(m, v), 0), ratio = 10 * Math.log10((e[j]! + floor) / (baseline + floor));
    if (ratio > thresholdDb) found.push({ db: Number(ratio.toFixed(2)), atSeconds: Number((j * hop / RATE).toFixed(4)) });
  }
  return found;
}
/** 5 ms RMS envelope in dB relative to its maximum, plus attack/decay landmarks. */
function envelope(x: Float64Array) {
  // 25 ms RMS windows every 5 ms: long enough that a 55 Hz cycle does not read as tremolo.
  const hop = Math.round(RATE * 0.005), width = Math.round(RATE * 0.025), env: number[] = [];
  for (let i = 0; i < x.length; i += hop) { let s = 0, n = 0; for (let j = Math.max(0, i - (width >> 1)); j < Math.min(x.length, i + (width >> 1)); j++) { s += x[j]! ** 2; n++; } env.push(Math.sqrt(s / Math.max(1, n))); }
  const max = Math.max(...env), rel = env.map(v => 20 * Math.log10(v / max + 1e-12)), peakAt = env.indexOf(max);
  const after = (level: number) => { const k = rel.findIndex((v, i) => i > peakAt && v < level); return k < 0 ? null : Number((k * 0.005).toFixed(3)); };
  const firstAbove = (level: number) => Number((rel.findIndex(v => v >= level) * 0.005).toFixed(3));
  const at = (fraction: number) => Number(rel[Math.min(rel.length - 1, Math.floor(rel.length * fraction))]!.toFixed(2));
  return { attackTo3dBSeconds: firstAbove(-3), peakSeconds: Number((peakAt * 0.005).toFixed(3)), decayTo20dBSeconds: after(-20), decayTo40dBSeconds: after(-40),
    levelDbAt: { '10%': at(0.1), '25%': at(0.25), '50%': at(0.5), '75%': at(0.75), '90%': at(0.9) } };
}
/** Autocorrelation pitch track (lag search within ±1 semitone of `expected`, parabolic refinement) over [from, to) seconds.
 * Returns median, 10th and 90th percentile deviation in cents; robust to vibrato, unlike a single spectral peak. */
export function pitchTrack(x: Float64Array, expected: number, from: number, to: number) {
  const lo = Math.floor(RATE / (expected * 2 ** (1 / 12))), hi = Math.ceil(RATE / (expected * 2 ** (-1 / 12))), width = Math.max(2048, 3 * hi), found: number[] = [];
  for (let start = Math.round(from * RATE); start + width + hi < Math.min(x.length, to * RATE); start += Math.round(width / 2)) {
    let e0 = 0; for (let i = start; i < start + width; i++) e0 += x[i]! ** 2; if (e0 < 1e-9) continue;
    const r = (lag: number) => { let s = 0, e1 = 0; for (let i = start; i < start + width; i++) { s += x[i]! * x[i + lag]!; e1 += x[i + lag]! ** 2; } return s / Math.sqrt(e0 * e1 + 1e-30); };
    let best = lo, bestR = -Infinity; const values = new Map<number, number>();
    for (let lag = lo - 1; lag <= hi + 1; lag++) { const v = r(lag); values.set(lag, v); if (lag >= lo && lag <= hi && v > bestR) { bestR = v; best = lag; } }
    const a = values.get(best - 1)!, b = bestR, c = values.get(best + 1)!, shift = 0.5 * (a - c) / (a - 2 * b + c || 1);
    if (bestR > 0.5) found.push(1200 * Math.log2(RATE / (best + shift) / expected));
  }
  found.sort((p, q) => p - q);
  const at = (f: number) => found.length ? Number(found[Math.min(found.length - 1, Math.floor(f * found.length))]!.toFixed(2)) : null;
  return { windows: found.length, medianCents: at(0.5), p10Cents: at(0.1), p90Cents: at(0.9) };
}
function centroid(x: Float64Array, start: number, length: number): number {
  const p = spectrum(x, start, length, 16384), w = RATE / 16384; let a = 0, b = 0; p.forEach((v, k) => { a += v * k * w; b += v; }); return Math.round(a / (b || 1));
}

export interface Expectation { fundamentalHz: number | null; attackSeconds?: number; tuningWindow?: [number, number] }
export function measure(path: string, expected: Expectation) {
  const basic = inspect(path), audio = load(path), channels = Array.from({ length: audio.channels }, (_, c) => audio.channel(c));
  const peaks = channels.map(truePeak), samplePeak = Math.max(...channels.map(c => c.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));
  const seconds = audio.frames / RATE, attack = expected.attackSeconds ?? 0.03;
  const click = clickScore(audio.mono, Math.min(seconds, attack + 0.01), Math.max(0, seconds - 0.05));
  const lows = channels.map(c => biquadLow(biquadLow(c, 150), 150));
  const stereo = audio.channels === 2 ? {
    correlation: basic.stereoCorrelation, lowBandCorrelation: correlation(lows[0]!, lows[1]!),
    // Mono fold-down: energy of (L+R)/2 relative to the mean channel energy; 0 dB means nothing cancels.
    monoFoldDownDb: Number((10 * Math.log10(energy(audio.mono) / ((energy(channels[0]!) + energy(channels[1]!)) / 2))).toFixed(2)),
    lowBandMonoFoldDownDb: Number((10 * Math.log10(energy(lows[0]!.map((v, i) => (v + lows[1]![i]!) / 2)) / ((energy(lows[0]!) + energy(lows[1]!)) / 2))).toFixed(2)),
  } : null;
  const [from, to] = expected.tuningWindow ?? [Math.min(0.15, seconds * 0.3), seconds * 0.9];
  const tuning = expected.fundamentalHz ? { ...pitchTrack(audio.mono, expected.fundamentalHz, from, to), spectralPeak: pitch(audio.mono, expected.fundamentalHz, Math.round(from * RATE), Math.round((to - from) * RATE)) } : null;
  const third = Math.floor(audio.frames / 3), cw = Math.min(third, 16384);
  return {
    file: path, seconds: Number(seconds.toFixed(6)), channels: audio.channels,
    samplePeakDbfs: db(samplePeak), truePeakDbfs: db(Math.max(...peaks)), rmsDbfs: basic.rmsDbfs, dc: Number(basic.dc.toExponential(3)), clippedSamples: basic.clippedSamples,
    endpoints: { firstFrameZero: channels.every(c => c[0] === 0), lastFrameZero: channels.every(c => c[c.length - 1] === 0) },
    clickDb: click.db, clickAtSeconds: click.atSeconds, envelope: envelope(audio.mono), tuning,
    centroidHz: { start: centroid(audio.mono, 0, cw), middle: centroid(audio.mono, third, cw), end: centroid(audio.mono, 2 * third, cw) },
    stereo, bandPowerPercent: basic.bandPowerPercent,
  };
}

/** Low-end lock: each A1 source against ABYSS once its pitch has settled (correlation below 80 Hz), and the
 * peak of the same-onset sum at velocity 1. Positive correlation near 1 means the fundamentals add instead of cancelling. */
export function lowLock(directory = DEFAULT_OUTPUT) {
  const file = (name: string) => load(join(directory, 'assets/v12-signature', name));
  // Fundamental only: four-pole 80 Hz low-pass, so a strong second harmonic (REACTOR's 110 Hz) cannot mask the phase.
  const abyss = file('07-abyss.wav').mono, low = (x: Float64Array) => biquadLow(biquadLow(x, 80), 80);
  const pair = (name: string, from: number, to: number) => {
    const other = file(name).mono, a = low(abyss).slice(Math.round(from * RATE), Math.round(to * RATE)), b = low(other).slice(Math.round(from * RATE), Math.round(to * RATE));
    let peak = 0; for (let i = 0; i < other.length; i++) peak = Math.max(peak, Math.abs(other[i]! + abyss[i]!));
    return { window: [from, to], fundamentalCorrelation: correlation(a, b), sumPeakDbfs: db(peak) };
  };
  return { 'sub-hammer': pair('01-sub-hammer.wav', 0.15, 0.6), 'iron-pulse': pair('02-iron-pulse.wav', 0.08, 0.3), 'reactor': pair('08-reactor.wav', 0.2, 4), 'convergence': pair('16-convergence.wav', 0.6, 3) };
}
const ATTACKS: Record<string, number> = { 'event-horizon': 1.7, 'afterglow': 0.35, 'specter': 0.35, 'ascension': 6, 'convergence': 0.1, 'phantom': 0.1, 'reactor': 0.1, 'abyss': 0.05 };
// Where each tuned sound is judged: after pitch drops and swells; the riser where it lands; the kicks on their bodies.
const TUNING_WINDOWS: Record<string, [number, number]> = { 'sub-hammer': [0.15, 0.6], 'iron-pulse': [0.07, 0.25], 'titanium-crack': [0.02, 0.15], 'convergence': [0.6, 2.5], 'ascension': [5.9, 6], 'chrome-strike': [0.3, 2] };
export function packReport(directory = DEFAULT_OUTPUT) {
  const catalog = JSON.parse(readFileSync(join(directory, 'v12-signature.catalog.json'), 'utf8'));
  return {
    method: 'True peak 4x windowed sinc; clicks = 1 ms >12 kHz energy vs the loudest other 1 ms frame within ±40 ms, after the designed attack; tuning in three sustain windows; 150 Hz two-pole low band; 8192-point band power (independent channels, unweighted).',
    lowLock: lowLock(directory),
    sounds: catalog.sounds.map((s: { id: string; file: string; fundamentalHz: number | null }) => ({ id: s.id, ...measure(join(directory, s.file), { fundamentalHz: s.id === 'ascension' ? 440 : s.fundamentalHz, attackSeconds: ATTACKS[s.id], tuningWindow: TUNING_WINDOWS[s.id] }) })),
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log(JSON.stringify(packReport(process.argv[2]), null, 2));
