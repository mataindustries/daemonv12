/** GLASSHOUSE — offline, original synthesis for modern electronic/bass music. No samples, recordings or runtime synth.
 * Run: node scripts/generate-glasshouse.ts [output project directory]
 * Float64 synthesis at 4x (176.4 kHz) -> 255-tap Kaiser-windowed sinc decimation -> DC high-pass
 * -> endpoint tapers -> peak headroom -> rounded PCM16, no dither.
 * One glass identity (GLASS) is struck, bloomed+reversed, transposed+crushed and refracted into a chord;
 * one voice identity (voice) is sung and sliced. The low pair shares an exact C#2 phase.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const RATE = 44100, OS = 4, FS = RATE * OS, TAU = 2 * Math.PI;
type Wave = Float64Array;
const sin = (cycles: number) => Math.sin(TAU * cycles);
const exp = (t: number, decay: number) => Math.exp(-t / decay);
const attack = (t: number, seconds: number) => t >= seconds ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * t / seconds);
const smooth = (x: number) => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
export const TUNING = { 'C#2': hz(37), 'C#3': hz(49), 'G#3': hz(56), 'C#4': hz(61), 'G#4': hz(68), 'C#5': hz(73), 'E5': hz(76), 'G#5': hz(80), 'C#6': hz(85), 'C#7': hz(97) };
const CS2 = TUNING['C#2'], CS3 = TUNING['C#3'], CS4 = TUNING['C#4'], CS5 = TUNING['C#5'];

// The parent identity. A harmonic core (1, 2, 4) fixes the pitch; free-free glass-bar modes (2.756, 5.404, 8.933, 13.34, 18.64)
// supply the glass. Each mode is split into a close pair whose beating gives the shimmer. Decays are relative to a body time.
export const GLASS = [
  { ratio: 1, amp: 0.85, decay: 1, beat: 0.35 },
  { ratio: 2, amp: 0.5, decay: 0.55, beat: 0.9 },
  { ratio: 2.756, amp: 0.32, decay: 0.35, beat: 2.3 },
  { ratio: 4, amp: 0.25, decay: 0.35, beat: 1.7 },
  { ratio: 5.404, amp: 0.3, decay: 0.25, beat: 3.9 },
  { ratio: 8.933, amp: 0.22, decay: 0.16, beat: 5.3 },
  { ratio: 13.34, amp: 0.14, decay: 0.1, beat: 7.1 },
  { ratio: 18.64, amp: 0.09, decay: 0.07, beat: 9.7 },
] as const;
/** The glass at fundamental phase `cycles`: `body` sets the decay, `sparkle` scales modes above the fourth harmonic,
 * `split` detunes each mode's partner (relative) so two channels beat differently. */
function glass(t: number, cycles: number, f0: number, body: number, sparkle = 1, split = 0): number {
  let sum = 0;
  for (const m of GLASS) {
    if (f0 * m.ratio > 18000) continue;
    const level = m.amp * exp(t, body * m.decay) * (m.ratio > 4 ? sparkle : 1);
    sum += level * (sin(m.ratio * cycles) + 0.35 * sin(m.ratio * cycles * (1 + split) + m.beat * t)) / 1.35;
  }
  return sum;
}

// Formant-shaped additive voice: [Hz, linear level, bandwidth Hz]. Synthetic soprano "oh" and "ah"; no recording or analysis.
const OH = [[450, 1, 110], [800, 0.35, 120], [2830, 0.18, 170], [3500, 0.12, 200], [4950, 0.05, 250]] as const;
const AH = [[800, 1, 120], [1150, 0.6, 130], [2800, 0.3, 170], [3500, 0.22, 200], [4950, 0.08, 250]] as const;
function formant(f: number, open: number): number {
  let sum = 0.0025 + 0.02 / (1 + ((f - 8000) / 3000) ** 2); // synthetic air band
  for (let k = 0; k < OH.length; k++) {
    const [f1, a1, b1] = OH[k]!, [f2, a2, b2] = AH[k]!;
    const center = f1 + (f2 - f1) * open, level = a1 + (a2 - a1) * open, width = b1 + (b2 - b1) * open;
    sum += level / (1 + ((f - center) / (width / 2)) ** 2);
  }
  return sum;
}
/** Harmonic levels for one control block: source tilt k^-0.7 (formant skirts supply the rest), formant envelope, optional bright onset. Harmonics stay below 17 kHz. */
function harmonics(f0: number, open: number, bright: number): Float64Array {
  return Float64Array.from({ length: Math.floor(17000 / f0) }, (_, j) => formant((j + 1) * f0, open) * (1 + bright * Math.min(1, j / 12)) / (j + 1) ** 0.7);
}

export const sounds = [
  { id: 'glass-hit', name: 'GLASS HIT', seconds: 1, channels: 1, peak: -6, pitch: 81, note: 'C#5', family: 'glass', derivedFrom: null, seed: 0x6c0101,
    role: 'Parent identity: bright tuned glass transient, sparkling 1.5–10 kHz halo over a pure C#5.', use: 'Exposed melodic hits, offbeat accents, call-and-response; velocity 0.45–0.9.',
    method: 'Eight split-pair glass modes (harmonic 1/2/4 core plus 2.756/5.404/8.933/13.34/18.64 bar modes) with ratio-dependent decay and a 1.2 ms band-limited strike.' },
  { id: 'glass-reverse', name: 'GLASS REVERSE', seconds: 37800 / RATE, channels: 2, peak: -7, pitch: null, note: 'C#5', family: 'glass', derivedFrom: 'glass-hit', seed: 0x6c0202,
    role: 'Suction into a boundary: the same glass, bloomed through stereo diffusion, then reversed.', use: 'Ends exactly at the target; start 37,800 frames (two beats at 140 BPM) earlier; velocity 0.5–0.85.',
    method: 'Glass identity with 0.2 s body plus noise excited through its own mode resonators, per-channel allpass diffusion, reversed in float before PCM; 5 ms boundary taper.' },
  { id: 'glass-crush', name: 'GLASS CRUSH', seconds: 0.42, channels: 1, peak: -6, pitch: 41, note: 'C#3', family: 'glass', derivedFrom: 'glass-hit', seed: 0x6c0303,
    role: 'The glass two octaves down, saturated and crushed into a dark tonal bass-call.', use: 'Rhythmic accents, bass-call answers on offbeats, layered under clap; velocity 0.5–0.9.',
    method: 'Glass identity at C#3 with a resample-length 0.3 s body and a 7-semitone falling onset; asymmetric tanh drive and 4.6-bit crush in parallel with the clean glass; closing resonant low-pass plus a falling 1.5 kHz to 650 Hz call resonance; all at 4x.' },
  { id: 'ghost-vox', name: 'GHOST VOX', seconds: 0.95, channels: 1, peak: -7, pitch: null, note: 'C#4', family: 'vox', derivedFrom: null, seed: 0x6c0404,
    role: 'Synthetic airy "oh-ah" vowel; vocal character without a singer.', use: 'Phrase starts and answers, half-bar holds; chop with vox-chip; velocity 0.5–0.9.',
    method: 'Additive harmonics shaped by morphing five-formant envelopes, pitch scoop, delayed vibrato, +8 cent double and glottal-pulsed breath noise through the same formants.' },
  { id: 'vox-chip', name: 'VOX CHIP', seconds: 0.085, channels: 1, peak: -7, pitch: 78, note: 'C#4', family: 'vox', derivedFrom: 'ghost-vox', seed: 0x6c0505,
    role: 'An 85 ms slice of the ghost-vox "ah" with a consonant-like attack.', use: '1/16 stutters and chops at up to 160 BPM; velocity accents 0.4–0.9.',
    method: 'The ghost-vox voice function evaluated at its open "ah" (no vibrato), brightened first period, 0.6 ms attack, 20 ms decay and a 4 ms formant-filtered burst.' },
  { id: 'bass-punch-cs', name: 'BASS PUNCH C#', seconds: 0.32, channels: 1, peak: -5, pitch: 36, note: 'C#2', family: 'low', derivedFrom: null, seed: 0x6c0606,
    role: 'Upper-bass attack: 277→69 Hz drop, C#2 harmonics through 1 kHz for small speakers, short body.', use: 'Layer with sub-cs at the same onset; kick role in half-time; velocity 0.6–1.',
    method: 'Exponential pitch drop with exactly two extra cycles (phase-locks to sub-cs), explicit decaying harmonics 2–8 through dynamic tanh drive, band-limited click.' },
  { id: 'sub-cs', name: 'SUB C#', seconds: 37800 / RATE, channels: 1, peak: -7, pitch: 35, note: 'C#2', family: 'low', derivedFrom: null, seed: 0x6c0707,
    role: 'Clean, stable 69.30 Hz sine body with controlled decay; no stereo or harmonics.', use: 'Same onset as bass-punch-cs; 37,800 frames = two beats at 140 BPM; space retriggers by a beat or more; velocity 0.6–1.',
    method: 'Zero-phase C#2 sine, 3 ms raised-cosine attack, 0.34 s exponential decay, 0.25 s cosine fade; identical phase to the settled bass-punch.' },
  { id: 'chrome-clap', name: 'CHROME CLAP', seconds: 0.36, channels: 2, peak: -5, pitch: 39, note: null, family: 'drums', derivedFrom: null, seed: 0x6c0808,
    role: 'Clap/snare hybrid: four uneven centered bursts, G#3 body, faint C#6 glass ring, mid/side tail.', use: 'Backbeat or half-time beat 3; ghost notes at 0.3–0.5; velocity 0.7–1.',
    method: 'Resonant band-passed noise bursts at 0/9.2/20.1/30.5 ms, 207.65 Hz pitched body, short glass identity at C#6 and a 75 ms tail with side-only decorrelation.' },
  { id: 'pixel-hat', name: 'PIXEL HAT', seconds: 0.055, channels: 1, peak: -7, pitch: 42, note: null, family: 'drums', derivedFrom: null, seed: 0x6c0909,
    role: 'Tight 6–12 kHz tick: high glass modes plus resonant noise; nothing below 2 kHz.', use: '1/16 and 1/32 grids with alternating velocities 0.35–0.8.',
    method: 'Glass identity modes at C#7 (2.756/4/5.404 ratios), two resonant noise bands at 8.4/11.5 kHz, 6.5 ms decay, four-pole 4.5 kHz high-pass.' },
  { id: 'prism-impact', name: 'PRISM IMPACT', seconds: 1.8, channels: 2, peak: -5, pitch: null, note: 'C#m', family: 'glass', derivedFrom: 'glass-hit', seed: 0x6c0a0a,
    role: 'Payoff: the glass refracted into a spread C# minor chord over a centered C#2 drop and soft air.', use: 'Final downbeat or section payoff; leave 1.8 s; velocity 0.7–1.',
    method: 'Six glass-identity tones (C#4 G#4 C#5 E5 G#5 C#6) with 3 ms dispersion, constant-power spread and allpass diffusion; mono 138→69 Hz boom, transient and closing air.' },
] as const;
export type GlasshouseSound = typeof sounds[number];

function noise(length: number, seed: number): Wave {
  let state = seed;
  return Float64Array.from({ length }, () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 2147483648 - 1;
  });
}
// One-pole filters, cascaded as needed.
function lowpass(input: Wave, cutoff: number, rate = FS): Wave {
  const a = 1 - Math.exp(-TAU * cutoff / rate); let y = 0;
  return input.map(x => (y += a * (x - y)));
}
function highpass(input: Wave, cutoff: number, rate = FS): Wave {
  const low = lowpass(input, cutoff, rate); return input.map((x, i) => x - low[i]!);
}
function band(input: Wave, low: number, high: number): Wave { return lowpass(lowpass(highpass(highpass(input, low), low), high), high); }
// RBJ band-pass with 0 dB peak gain.
function bandpass(input: Wave, center: number, q: number): Wave {
  const w = TAU * center / FS, alpha = Math.sin(w) / (2 * q), a0 = 1 + alpha;
  const b0 = alpha / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return input.map(x => { const y = b0 * (x - x2) - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; });
}
// Zero-delay-feedback state-variable filter with a time-varying cutoff (stable at every setting); low-pass or band-pass output.
function swept(input: Wave, cutoff: (t: number) => number, q: number, band = false): Wave {
  let s1 = 0, s2 = 0;
  return input.map((x, i) => {
    const g = Math.tan(Math.PI * cutoff(i / FS) / FS), a1 = 1 / (1 + g * (g + 1 / q)), a2 = g * a1, a3 = g * a2;
    const v3 = x - s2, v1 = a1 * s1 + a2 * v3, v2 = s2 + a2 * s1 + a3 * v3;
    s1 = 2 * v1 - s1; s2 = 2 * v2 - s2;
    return band ? v1 : v2;
  });
}
// Schroeder allpass chain: dense, colorless diffusion; channel-specific delays create width.
function diffuse(input: Wave, delaysMs: readonly number[], gain: number): Wave {
  let x = input;
  for (const ms of delaysMs) {
    const d = Math.round(ms * FS / 1000), y = new Float64Array(x.length);
    for (let i = 0; i < x.length; i++) y[i] = -gain * x[i]! + (x[i - d] ?? 0) + gain * (y[i - d] ?? 0);
    x = y;
  }
  return x;
}

// Kaiser-windowed sinc, beta 8.96 (about 90 dB stop band), -6 dB at 20.5 kHz; linear phase, centered so frame j is time j/44100.
const TAPS = 255, HALF = (TAPS - 1) / 2;
function besselI0(x: number): number { let sum = 1, term = 1; for (let k = 1; k <= 40; k++) { term *= (x / (2 * k)) ** 2; sum += term; } return sum; }
const FIR = (() => {
  const cutoff = 20500 / FS, beta = 8.96;
  const taps = Float64Array.from({ length: TAPS }, (_, n) => {
    const m = n - HALF, r = m / HALF;
    return (m === 0 ? 2 * cutoff : Math.sin(TAU * cutoff * m) / (Math.PI * m)) * besselI0(beta * Math.sqrt(1 - r * r)) / besselI0(beta);
  });
  const sum = taps.reduce((a, b) => a + b, 0); return taps.map(v => v / sum);
})();
function decimate(input: Wave, frames: number): Wave {
  return Float64Array.from({ length: frames }, (_, j) => {
    let acc = 0;
    for (let n = 0, k = j * OS - HALF; n < TAPS; n++, k++) if (k >= 0 && k < input.length) acc += FIR[n]! * input[k]!;
    return acc;
  });
}

// Per-sound synthesis at FS. Each returns one oversampled wave per channel.
type Voice = (n: number, seed: number) => Wave[];
const at = (n: number, f: (t: number, i: number) => number): Wave => Float64Array.from({ length: n }, (_, i) => f(i / FS, i));
const strike = (n: number, seed: number) => { const s = bandpass(highpass(noise(n, seed), 2000), 6500, 0.6); return at(n, (t, i) => s[i]! * exp(t, 0.0012)); };
// The vox identity: the same function sings ghost-vox and is sliced for vox-chip. Levels update every 16 samples (11 kHz).
function voice(n: number, seed: number, options: { t0: number; vibrato: boolean; scoop: boolean; bright: (t: number) => number; breath: number }): Wave {
  const out = new Float64Array(n), raw = noise(n, seed), pulse = new Float64Array(n), detune = 2 ** (8 / 1200);
  let phase = 0, double = 0, open = 0, levels: Wave = new Float64Array(0), doubled: Wave = levels;
  for (let i = 0; i < n; i++) {
    const t = i / FS, tv = t + options.t0;
    const cents = (options.scoop ? -40 * exp(t, 0.03) : 0) + (options.vibrato ? 16 * smooth((tv - 0.25) / 0.25) * Math.sin(TAU * 5.4 * tv) : 0);
    const f0 = CS4 * 2 ** (cents / 1200);
    if (i % 16 === 0) { open = smooth((tv - 0.02) / 0.22); levels = harmonics(f0, open, options.bright(t)); doubled = harmonics(f0 * detune, open, options.bright(t)); }
    let sum = 0;
    for (let k = 0; k < levels.length; k++) sum += levels[k]! * sin((k + 1) * phase);
    for (let k = 0; k < doubled.length; k++) sum += 0.35 * doubled[k]! * sin((k + 1) * double);
    out[i] = sum; pulse[i] = 0.55 + 0.45 * Math.max(0, Math.cos(TAU * phase));
    phase += f0 / FS; double += f0 * detune / FS;
  }
  // Breath: glottal-pulsed noise through the same formant centers (at the final opening), plus faint air.
  const pulsed = raw.map((x, i) => x * pulse[i]!), air = lowpass(highpass(highpass(raw, 3500), 3500), 12000);
  const breath = [0.9, 0.6, 0.25].map((level, k) => bandpass(pulsed, OH[k]![0] + (AH[k]![0] - OH[k]![0]) * open, 5 + k * 3).map(x => x * level));
  return out.map((x, i) => x + options.breath * (breath[0]![i]! + breath[1]![i]! + breath[2]![i]! + 0.7 * air[i]! * pulse[i]!));
}

const voices: Record<GlasshouseSound['id'], Voice> = {
  'glass-hit': (n, seed) => {
    const hit = strike(n, seed);
    return [at(n, (t, i) => attack(t, 0.00008) * glass(t, CS5 * t, CS5, 0.26) + 0.35 * hit[i]!)];
  },
  'glass-reverse': (n, seed) => {
    // Bloom forward (dry glass + noise rung through the glass's own modes), diffuse per channel, then reverse time.
    const excite = noise(n, seed), hit = strike(n, seed + 1);
    const resonant = GLASS.slice(0, 6).map((m, k) => bandpass(excite, CS5 * m.ratio, 40 + 10 * k).map(x => x * m.amp));
    const ring = at(n, (t, i) => resonant.reduce((s, r) => s + r[i]!, 0) * exp(t, 0.3));
    const dry = at(n, (t, i) => attack(t, 0.0002) * glass(t, CS5 * t, CS5, 0.2, 0.8) + 0.1 * hit[i]!);
    // The fundamental stays dry and centered (mono-safe); only the bloom above 900 Hz is diffused per channel.
    const center = dry.map((x, i) => x + 0.6 * ring[i]!);
    return [[7.3, 11.9, 17.1, 23.7], [8.1, 12.7, 18.3, 25.1]].map(delays => {
      const wet = highpass(highpass(diffuse(center, delays, 0.62), 900), 900);
      return center.map((x, i) => x + 0.7 * wet[i]!).reverse();
    });
  },
  'glass-crush': (n, seed) => {
    const tau = 0.012, hit = strike(n, seed), gate = (t: number) => attack(t, 0.0004) * (t < 0.11 ? 1 : exp(t - 0.11, 0.07));
    // Same glass, transposed two octaves with a longer (resample-like) body, a 1.5x falling onset (integrated phase) and extra fundamental.
    const body = at(n, (t, i) => {
      const cycles = CS3 * (t + 0.5 * tau * (1 - exp(t, tau)));
      return glass(t, cycles, CS3, 0.3, 1.4) + 0.3 * sin(cycles) * exp(t, 0.12) + 0.15 * hit[i]!;
    });
    // Drive and 4.6-bit crush act before the gate, so the grit does not switch off as the level falls.
    const driven = highpass(highpass(body.map(x => Math.tanh(5 * x + 0.2) - Math.tanh(0.2)), 50), 50);
    const crushed = driven.map((x, i) => gate(i / FS) * (0.4 * body[i]! + 0.4 * x + 0.25 * Math.round(x * 12) / 12));
    // A closing resonant low-pass for darkness plus a falling mid resonance (1.5 kHz -> 650 Hz) that makes it call.
    const call = swept(crushed, t => 650 + 850 * exp(t, 0.09), 3.5, true);
    return [lowpass(swept(crushed, t => 1900 + 5100 * exp(t, 0.1), 2.5).map((x, i) => x + 0.9 * call[i]!), 9000)];
  },
  'ghost-vox': (n, seed) => {
    const sung = voice(n, seed, { t0: 0, vibrato: true, scoop: true, bright: () => 0, breath: 0.3 });
    return [sung.map((x, i) => { const t = i / FS; return x * attack(t, 0.022) * exp(t, 2.5); })];
  },
  'vox-chip': (n, seed) => {
    // Slice of the same voice at its open "ah" (t0 0.35 s), plus a 4 ms consonant-like burst through F2/F3.
    const slice = voice(n, seed, { t0: 0.35, vibrato: false, scoop: false, bright: t => 1.2 * exp(t, 0.004), breath: 0.34 });
    const burst = noise(n, seed + 1), consonant = bandpass(bandpass(burst, 1150, 2), 2800, 1.5);
    return [slice.map((x, i) => { const t = i / FS; return attack(t, 0.0006) * (t < 0.018 ? 1 : exp(t - 0.018, 0.02)) * x + 0.5 * consonant[i]! * exp(t, 0.004); })];
  },
  'bass-punch-cs': (n, seed) => {
    // f(t) = C#2 * (1 + 3e^(-t/tau)), tau = 2/(3*C#2): exactly two extra cycles, so the settled body is in phase with sub-cs.
    const tau = 2 / (3 * CS2), click = band(noise(n, seed), 1500, 7000);
    return [at(n, (t, i) => {
      const cycles = CS2 * (t + 3 * tau * (1 - exp(t, tau)));
      const tone = sin(cycles) + 0.42 * sin(2 * cycles) * exp(t, 0.07) + 0.26 * sin(3 * cycles) * exp(t, 0.05) + 0.15 * sin(4 * cycles) * exp(t, 0.035)
        + 0.08 * sin(6 * cycles) * exp(t, 0.025) + 0.05 * sin(8 * cycles) * exp(t, 0.018);
      const drive = 1.2 + 2.8 * exp(t, 0.05);
      return attack(t, 0.0005) * exp(t, 0.11) * Math.tanh(drive * tone) / Math.tanh(drive) + 0.35 * click[i]! * exp(t, 0.0018);
    })];
  },
  'sub-cs': n => [at(n, t => attack(t, 0.003) * exp(t, 0.34) * sin(CS2 * t))],
  'chrome-clap': (n, seed) => {
    const common = noise(n, seed), sides = noise(n, seed + 1);
    const upper = bandpass(common, 2600, 1.5), sheen = highpass(highpass(common, 5000), 5000);
    const bursts = highpass(bandpass(common, 1350, 1.1).map((v, i) => v + 0.6 * upper[i]! + 0.35 * sheen[i]!), 600);
    const tail = band(common, 700, 9000), side = band(sides, 900, 9000);
    const shape = (t: number) => [0, 0.0092, 0.0201, 0.0305].reduce((s, start, k) =>
      t < start ? s : s + [0.85, 0.7, 0.8, 1][k]! * attack(t - start, 0.0003) * exp(t - start, [0.0025, 0.0028, 0.0032, 0.0045][k]!), 0);
    const tailShape = (t: number) => t < 0.0305 ? 0 : attack(t - 0.0305, 0.001) * exp(t - 0.0305, 0.075);
    const mid = at(n, (t, i) => {
      const body = 0.22 * sin(TUNING['G#3'] * (t + 0.3 * 0.008 * (1 - exp(t, 0.008)))) * exp(t, 0.045) + 0.1 * sin(336.4 * t) * exp(t, 0.02);
      return 2.4 * bursts[i]! * shape(t) + 0.8 * tail[i]! * tailShape(t) + attack(t, 0.0004) * body;
    });
    return [1, -1].map(sign => at(n, (t, i) =>
      mid[i]! + sign * 0.4 * side[i]! * tailShape(t) + 0.16 * attack(t, 0.0003) * glass(t, TUNING['C#6'] * t, TUNING['C#6'], 0.05, 1, sign * 0.004)));
  },
  'pixel-hat': (n, seed) => {
    const raw = noise(n, seed), upper = bandpass(raw, 11500, 2), grain = bandpass(raw, 8400, 1.2).map((x, i) => x + 0.6 * upper[i]!);
    const f = TUNING['C#7'];
    const tick = at(n, (t, i) => attack(t, 0.0001) * (0.9 * grain[i]! * exp(t, 0.0065)
      + 0.5 * exp(t, 0.004) * [2.756, 4, 5.404].reduce((s, r, k) => s + (sin(r * f * t) + 0.35 * sin((r * f + 7 + 4 * k) * t)) / (1 + k * 0.4), 0)));
    return [lowpass(highpass(highpass(highpass(highpass(tick, 4500), 4500), 4500), 4500), 15000)];
  },
  'prism-impact': (n, seed) => {
    // The glass refracted: chord tones disperse 3 ms apart and spread across the field; low end stays mono.
    const tones = [[TUNING['C#4'], 0, 0.8], [TUNING['G#4'], -0.35, 0.62], [TUNING['C#5'], 0.35, 0.55], [TUNING['E5'], -0.62, 0.5], [TUNING['G#5'], 0.62, 0.4], [TUNING['C#6'], 0, 0.3]] as const;
    const crack = band(noise(n, seed), 200, 9000), hit = strike(n, seed + 1);
    const airs = [noise(n, seed + 2), noise(n, seed + 3)].map(x => swept(highpass(highpass(x, 1500), 1500), t => 3000 + 11000 * exp(t, 0.5), 0.8));
    const boom = at(n, (t, i) => {
      const tau = 2 / CS2, cycles = CS2 * (t + tau * (1 - exp(t, tau))); // 138.6 -> 69.3 Hz with two extra cycles
      return attack(t, 0.001) * exp(t, 0.42) * 0.6 * (sin(cycles) + 0.2 * sin(2 * cycles) * exp(t, 0.15)) + 0.9 * crack[i]! * exp(t, 0.015) + 0.4 * hit[i]!;
    });
    return [[7.7, 12.1, 16.9, 23.3, 31.7], [8.3, 13.3, 18.1, 24.7, 33.1]].map((delays, side) => {
      const spread = at(n, t => tones.reduce((s, [f, pan, level], k) => {
        const dt = t - 0.003 * k, theta = (pan + 1) * Math.PI / 4;
        return dt < 0 ? s : s + level * (side === 0 ? Math.cos(theta) : Math.sin(theta)) * Math.SQRT2 * attack(dt, 0.0003) * glass(dt, f * dt, f, 0.65, 1, side === 0 ? -0.002 : 0.002);
      }, 0));
      const wet = highpass(highpass(diffuse(spread, delays, 0.6), 220), 220);
      return at(n, (t, i) => 0.8 * spread[i]! + 0.7 * wet[i]! + boom[i]! + 0.6 * airs[side]![i]! * attack(t, 0.004) * exp(t, 0.45));
    });
  },
};

// Post: DC/infrasonic high-pass at 44.1 kHz, then a 12-frame start ramp (or `fadeIn` seconds) and a `fadeOut`-second
// sine-squared end fade, so the first and last frames are exactly zero. glass-reverse fades in over its reversed tail.
const post: Record<GlasshouseSound['id'], { hp: number; fadeOut: number; fadeIn?: number }> = {
  'glass-hit': { hp: 120, fadeOut: 0.25 }, 'glass-reverse': { hp: 150, fadeOut: 0.005, fadeIn: 0.12 },
  'glass-crush': { hp: 40, fadeOut: 0.12 }, 'ghost-vox': { hp: 90, fadeOut: 0.27 }, 'vox-chip': { hp: 90, fadeOut: 0.02 },
  'bass-punch-cs': { hp: 12, fadeOut: 0.06 }, 'sub-cs': { hp: 12, fadeOut: 0.25 }, 'chrome-clap': { hp: 140, fadeOut: 0.1 },
  'pixel-hat': { hp: 1500, fadeOut: 0.02 }, 'prism-impact': { hp: 22, fadeOut: 0.45 },
};

export function synthesizeFloat(index: number): Wave[] {
  const spec = sounds[index]!, frames = Math.round(spec.seconds * RATE), p = post[spec.id];
  const waves = voices[spec.id](frames * OS, spec.seed).map(w => decimate(w, frames)).map(w => highpass(w, p.hp, RATE));
  return waves.map(w => w.map((x, i) => {
    const head = p.fadeIn ? Math.sin(Math.PI / 2 * Math.min(1, i / (p.fadeIn * RATE))) ** 2 : Math.min(1, i / 12);
    const tail = Math.sin(Math.PI / 2 * Math.min(1, (frames - 1 - i) / (p.fadeOut * RATE))) ** 2;
    return x * head * tail;
  }));
}
export function synthesize(index: number): Buffer {
  const spec = sounds[index]!, waves = synthesizeFloat(index), frames = waves[0]!.length;
  let peak = 0; for (const w of waves) for (const x of w) { if (!Number.isFinite(x)) throw new Error('Non-finite synthesis'); peak = Math.max(peak, Math.abs(x)); }
  const gain = Math.pow(10, spec.peak / 20) / peak;
  const bytes = Buffer.alloc(44 + frames * spec.channels * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(spec.channels, 22);
  bytes.writeUInt32LE(RATE, 24); bytes.writeUInt32LE(RATE * spec.channels * 2, 28); bytes.writeUInt16LE(spec.channels * 2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(bytes.length - 44, 40);
  for (let i = 0; i < frames; i++) for (let c = 0; c < spec.channels; c++) bytes.writeInt16LE(Math.round(waves[c]![i]! * gain * 32767), 44 + (i * spec.channels + c) * 2);
  return bytes;
}

export const fileName = (index: number) => `${String(index + 1).padStart(2, '0')}-${sounds[index]!.id}.wav`;
export function generatePack(output = 'examples'): void {
  const directory = join(output, 'assets/glasshouse'); mkdirSync(directory, { recursive: true });
  const entries = sounds.map((sound, i) => {
    const bytes = synthesize(i), file = fileName(i);
    writeFileSync(join(directory, file), bytes);
    return { ...sound, frames: Math.round(sound.seconds * RATE), seconds: Number(sound.seconds.toFixed(6)), fundamentalHz: sound.note && sound.note in TUNING ? Number(TUNING[sound.note as keyof typeof TUNING].toFixed(3)) : null,
      file: `assets/glasshouse/${file}`, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
  });
  writeFileSync(join(directory, 'kit.json'), JSON.stringify({ formatVersion: 1, samples: entries.filter(s => s.pitch !== null).map(s => ({ name: s.id, pitch: s.pitch, file: s.file.split('/').at(-1) })) }, null, 2) + '\n');
  // Metadata lives outside assets/: discovery treats every asset JSON as a kit.
  writeFileSync(join(output, 'glasshouse.catalog.json'), JSON.stringify({
    pack: 'GLASSHOUSE', version: 1, sampleRate: RATE, bitsPerSample: 16, key: 'C# minor', tuning: 'A4 = 440 Hz, equal temperament', referenceBpm: 140,
    provenance: 'All assets are generated in this repository. No third-party sample material is incorporated.', license: 'CC0-1.0', generator: 'scripts/generate-glasshouse.ts',
    families: {
      glass: { parent: 'glass-hit', transforms: { 'glass-reverse': 'bloomed through diffusion and time-reversed', 'glass-crush': 'transposed two octaves down, driven and crushed', 'prism-impact': 'refracted into a C# minor chord' }, modeRatios: GLASS.map(m => m.ratio) },
      vox: { parent: 'ghost-vox', transforms: { 'vox-chip': 'sliced from the open "ah" with a consonant-like attack' } },
      low: { layer: ['bass-punch-cs', 'sub-cs'], phase: 'bass-punch-cs settles in phase with sub-cs; trigger both on the same tick' },
    },
    sounds: entries,
  }, null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) generatePack(process.argv[2]);
