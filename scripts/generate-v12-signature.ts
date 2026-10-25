/** V12 SIGNATURE PACK v1 — sixteen original, deterministic instruments for DaemonV12 v0.7 sampler and drum-kit tracks.
 * Run: node scripts/generate-v12-signature.ts [pack directory]   (default packs/v12-signature-v1)
 * Pure Float64 DSP from this file only: no recordings, downloads, SoundFonts, impulse responses or input files.
 * Each sound renders at 1x, 2x or 4x of 44.1 kHz -> 255-tap Kaiser-windowed sinc decimation -> one-pole DC high-pass
 * -> click-free endpoint tapers -> peak normalization -> rounded PCM16, no dither.
 * Shared identity: a phase-locked A1 low end, a minor-third CHROME bell mode set and a GHOST VOWEL formant set.
 * Home key A minor; every tonal source sits on A except PHANTOM (E5, the centre of its lead range).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const RATE = 44100, TAU = 2 * Math.PI;
type Wave = Float64Array;
export const PACK = { id: 'v12-signature', name: 'V12 SIGNATURE', version: '1.0.0', directory: 'assets/v12-signature' } as const;
export const DEFAULT_OUTPUT = 'packs/v12-signature-v1';
export const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
export const rate = (semitones: number) => Number((2 ** (semitones / 12)).toFixed(6));
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (midi: number) => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
const A1 = hz(33), A3 = hz(57), A4 = hz(69), E5 = hz(76);

const sin = (cycles: number) => Math.sin(TAU * cycles);
const exp = (t: number, tau: number) => Math.exp(-t / tau);
/** Raised-cosine rise from 0 at t <= 0 to 1 at t >= seconds. */
const rise = (t: number, seconds: number) => t <= 0 ? 0 : t >= seconds ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * t / seconds);
const smooth = (x: number) => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const cents = (c: number) => 2 ** (c / 1200);

/** The pack's metallic DNA: an ideal minor-third bell (hum, prime, tierce, quint, nominal) in equal temperament, then
 * eight inharmonic upper modes. `decay` is relative to a body time. Used by CHROME STRIKE, both hats, TITANIUM CRACK,
 * IRON PULSE's tick, ASCENSION's shimmer and CONVERGENCE's tail. */
export const CHROME = [
  { ratio: 0.5, amp: 0.5, decay: 1 }, { ratio: 1, amp: 0.8, decay: 0.75 }, { ratio: 2 ** (3 / 12), amp: 0.62, decay: 0.62 },
  { ratio: 2 ** (7 / 12), amp: 0.32, decay: 0.46 }, { ratio: 2, amp: 0.5, decay: 0.52 }, { ratio: 2.514, amp: 0.3, decay: 0.31 },
  { ratio: 2.662, amp: 0.25, decay: 0.27 }, { ratio: 3.011, amp: 0.22, decay: 0.21 }, { ratio: 4.071, amp: 0.17, decay: 0.15 },
  { ratio: 4.597, amp: 0.13, decay: 0.11 }, { ratio: 5.334, amp: 0.1, decay: 0.085 }, { ratio: 6.703, amp: 0.075, decay: 0.06 },
] as const;
/** The pack's vocal DNA: one dark "oh" and one open "ah" as [Hz, level, bandwidth Hz]. REACTOR growls through it,
 * PHANTOM is voiced by it and SPECTER sings it (with two more vowels). Synthetic; no recording or analysis. */
export const GHOST_VOWEL = {
  oh: [[420, 1, 80], [820, 0.55, 95], [2550, 0.14, 150], [3400, 0.07, 200]],
  ah: [[700, 1, 100], [1170, 0.72, 115], [2620, 0.26, 160], [3500, 0.13, 200]],
} as const;
const OO = [[320, 1, 70], [780, 0.3, 90], [2300, 0.08, 140], [3300, 0.05, 200]] as const;
const EH = [[540, 1, 90], [1760, 0.48, 120], [2560, 0.3, 160], [3500, 0.12, 200]] as const;

type Category = 'kick' | 'snare' | 'clap' | 'hat' | 'bass' | 'lead' | 'pad' | 'voice' | 'percussion' | 'transition' | 'impact';
interface Spec {
  id: string; name: string; category: Category; seconds: number; channels: 1 | 2; peak: number; os: 1 | 2 | 4;
  root: number | null; kitPitch: number | null; seed: number; family: string[];
  semitones: readonly [number, number]; role: string; use: string; articulation: string; method: string;
}
export const sounds = [
  { id: 'sub-hammer', name: 'SUB HAMMER', category: 'kick', seconds: 0.95, channels: 1, peak: -4, os: 4, root: 33, kitPitch: 36, seed: 0x12a101, family: ['low'],
    semitones: [-5, 3], role: 'Massive, tight, tuned kick: a 570 Hz strike falls to an A1 body that lands exactly in phase with ABYSS.',
    use: 'Four-on-the-floor or half-time downbeats; trigger with ABYSS on the same tick for one coherent low end; velocity 0.75–1.',
    articulation: 'Full tail for sparse grooves; gate "1/8" + releaseSeconds 0.04 for fast grooves; chokeGroup "kick" with IRON PULSE.',
    method: 'Two-stage exponential pitch drop with exactly four extra cycles (phase-locks to 55 Hz), biased tanh drive that relaxes after 50 ms, band-passed strike noise and a 1.85 kHz beater click; 4x oversampled.' },
  { id: 'iron-pulse', name: 'IRON PULSE', category: 'kick', seconds: 0.45, channels: 1, peak: -4, os: 4, root: 33, kitPitch: 35, seed: 0x12a202, family: ['low', 'chrome'],
    semitones: [-3, 5], role: 'Punchy, aggressive electronic kick: hard 1.3 kHz click, 150 Hz knock, short driven A1 body.',
    use: 'Driving drops and techno grooves; layer over SUB HAMMER (both phase-lock to A1) for weight plus punch; velocity 0.7–1.',
    articulation: 'Plays whole; for rolls use gate "1/32" + releaseSeconds 0.01; playbackRate 1.12–1.33 for a harder, shorter knock.',
    method: 'Pitch drop with exactly three extra cycles, 150 Hz knock mode, strong asymmetric drive plus a short wavefold, band-passed click and a CHROME-mode tick; 4x.' },
  { id: 'titanium-crack', name: 'TITANIUM CRACK', category: 'snare', seconds: 0.6, channels: 2, peak: -5, os: 4, root: 57, kitPitch: 38, seed: 0x12a303, family: ['chrome'],
    semitones: [-4, 4], role: 'Layered, impactful snare: A3 shell, two-stage wire noise, a hard crack and a short CHROME ring with side-only room.',
    use: 'Backbeats, half-time beat 3, rolls into drops (velocity ramps 0.35→1); stack with NEON CLAP for a wide drop snare.',
    articulation: 'Rolls: gate "1/32" + releaseSeconds 0.015; chokeGroup "snare" keeps fast rolls clean.',
    method: 'Pitch-dropping 220/351/470 Hz membrane modes, band-passed noise with fast and slow wire decays, high-passed crack, CHROME upper modes on A5, tanh glue, decorrelated diffused side tail.' },
  { id: 'neon-clap', name: 'NEON CLAP', category: 'clap', seconds: 0.65, channels: 2, peak: -5, os: 4, root: null, kitPitch: 39, seed: 0x12a404, family: ['neon'],
    semitones: [-5, 3], role: 'Bright, textured electronic clap: five panned bursts and a tail rung through an A5 comb (the neon buzz).',
    use: 'Beats 2 and 4, layered with TITANIUM CRACK, or alone in breakdowns; playbackRate 0.84–0.94 for a darker, bigger clap.',
    articulation: 'Plays whole; gate "1/16" + releaseSeconds 0.03 tightens it for fast patterns.',
    method: 'Band-passed noise bursts at 0/7.1/15.8/24.9/33.6 ms with constant-power pans, a feedback comb tuned to 882 Hz inside the tail, decorrelated side tail; 4x.' },
  { id: 'ghost-tick', name: 'GHOST TICK', category: 'hat', seconds: 0.12, channels: 1, peak: -7, os: 4, root: null, kitPitch: 42, seed: 0x12a505, family: ['chrome'],
    semitones: [-3, 5], role: 'Crisp, controlled closed hat: six square partials on CHROME ratios band-passed at 10 kHz, nothing below 5 kHz.',
    use: '1/16 grids with accent patterns (0.35/0.7), ghost notes at 0.2–0.3; shares chokeGroup "hats" with OPEN CIRCUIT.',
    articulation: 'Plays whole (90 ms audible); chokeGroup "hats" closes OPEN CIRCUIT.',
    method: 'Band-limited squares at 410 Hz x CHROME ratios, 10.2 kHz band-pass, four-pole 6.5 kHz high-pass, 12.5 kHz noise grain, two-stage 8.5/25 ms decay; 4x.' },
  { id: 'open-circuit', name: 'OPEN CIRCUIT', category: 'hat', seconds: 1, channels: 2, peak: -7, os: 4, root: null, kitPitch: 46, seed: 0x12a606, family: ['chrome'],
    semitones: [-3, 4], role: 'Expressive open hat: the same metal opening from 7.2 to 10.5 kHz with a long stereo shimmer.',
    use: 'Off-beat eighths in drops, one per bar in grooves; gate it musically, or let GHOST TICK choke it.',
    articulation: 'gate "1/8" + releaseSeconds 0.06 for a tight off-beat; chokeGroup "hats" with GHOST TICK.',
    method: 'GHOST TICK metal through a swept state-variable band-pass, per-channel noise, a 4.7 kHz ring-modulated sheen and a two-stage 20/280 ms decay; 4x.' },
  { id: 'abyss', name: 'ABYSS', category: 'bass', seconds: 8, channels: 1, peak: -5, os: 1, root: 33, kitPitch: null, seed: 0x12a707, family: ['low'],
    semitones: [-7, 9], role: 'Deep sustained sub-bass on A1 (55 Hz): clean sine body, 2nd–5th harmonic bloom at the onset, steady warm sustain.',
    use: 'Held roots and slow bass lines from E1 to F#2; pair with SUB HAMMER on shared onsets; duck it with gain automation under every kick.',
    articulation: 'gate = note length, envelope {attackSeconds 0.004, releaseSeconds 0.08}; offsetSeconds 0.12 skips the bloom for tied legato notes.',
    method: 'Additive sine with explicit sine-phase harmonics (bloom decays in 120 ms to −19/−26/−35 dB), slow 0.23 Hz second-harmonic breathing, 6 ms raised-cosine onset, 1.5 s end fade; zero start phase.' },
  { id: 'reactor', name: 'REACTOR', category: 'bass', seconds: 5.5, channels: 2, peak: -5, os: 4, root: 33, kitPitch: null, seed: 0x12a808, family: ['low', 'vowel'],
    semitones: [-7, 9], role: 'Aggressive, harmonically rich mid-bass on A1: driven saws plus FM growl through the ghost vowel, mono below 140 Hz.',
    use: 'Rolling 1/16 bass, off-beat stabs and held drop notes; alone it is a full bass, over ABYSS add a 90–120 Hz track high-pass.',
    articulation: 'Stabs: gate "1/16" + releaseSeconds 0.03; held: gate = note length, releaseSeconds 0.08; the first 60 ms are the bark.',
    method: 'Detuned band-limited saws, FM carrier with evolving index and a phase-locked A1 sine, tanh drive at 4x, oh→ah formant band-passes, resonant low-pass with a 20 ms bark and slow non-periodic breathing, mono crossover at 140 Hz.' },
  { id: 'signal', name: 'SIGNAL', category: 'lead', seconds: 4.5, channels: 2, peak: -6, os: 2, root: 69, kitPitch: null, seed: 0x12a909, family: ['digital'],
    semitones: [-12, 10], role: 'Hypnotic melodic synth on A4: a crisp digital pluck that keeps singing when held.',
    use: 'Arpeggios and ostinatos (A3–G5), call-and-response hooks, held notes up to 2.5 s at the top of its range.',
    articulation: 'Arps: gate "1/16" + releaseSeconds 0.04; held: gate = note length, releaseSeconds 0.15.',
    method: '1:2 FM with a decaying index, PWM pulse from two band-limited saws through an enveloped resonant low-pass, harmonic and inharmonic (4.21x) pings, ±3.5 cent stereo pair; 2x.' },
  { id: 'phantom', name: 'PHANTOM', category: 'lead', seconds: 6, channels: 2, peak: -6, os: 2, root: 76, kitPitch: null, seed: 0x12aa0a, family: ['vowel'],
    semitones: [-7, 8], role: 'Powerful, emotionally resonant lead on E5: seven-voice unison voiced by the ghost vowel; held notes bloom and grow vibrato.',
    use: 'The main hook from A4 to C6 (rates 0.67–1.59): short notes stay clean, notes over 0.5 s open up and sing.',
    articulation: 'gate = note length, envelope {attackSeconds 0.005, releaseSeconds 0.12}; slides by overlapping notes 1/32.',
    method: 'Seven band-limited saws (±19 cents, each drifting ±1.5 cents) with the centre three in both channels, sub-octave square, shared delayed 5.1 Hz vibrato, 1.4 s low-pass bloom with an attack bite, ghost-vowel formant peaks, soft drive, vowel-band breath noise; 2x.' },
  { id: 'event-horizon', name: 'EVENT HORIZON', category: 'pad', seconds: 10, channels: 2, peak: -7, os: 1, root: 45, kitPitch: null, seed: 0x12ab0b, family: ['space'],
    semitones: [-5, 7], role: 'Evolving, spacious open-fifth pad on A2 (A2 E3 A3 E4 A4): no third, so it fits minor and major chords.',
    use: 'Section beds and drones under any chord built on its root; swells in by 1.6 s; offsetSeconds 1.6 starts it at full level.',
    articulation: 'gate = section length, envelope {attackSeconds 0.3, releaseSeconds 1.2}.',
    method: '222 additive partials with independent slow amplitude LFOs, drift detune, a travelling log-frequency spectral bump and rotating constant-power pans (partials below 220 Hz centred), plus noise rung through chord-tone resonators.' },
  { id: 'afterglow', name: 'AFTERGLOW', category: 'pad', seconds: 8, channels: 2, peak: -7, os: 1, root: 57, kitPitch: null, seed: 0x12ac0c, family: ['warm'],
    semitones: [-9, 7], role: 'Warm, cinematic single-note pad on A3: analog-style ensemble for building chords.',
    use: 'Stack three or four notes from C3 to E4 for chords; 0.28 s attack plays on the beat; sustains full bars.',
    articulation: 'gate = chord length, envelope {attackSeconds 0.02, releaseSeconds 0.45}.',
    method: 'Six band-limited saws (±11 cents) with independent slow drift, triangle core, breathing two-pole low-pass, gentle tanh warmth; voices alternate L/R.' },
  { id: 'specter', name: 'SPECTER', category: 'voice', seconds: 6.5, channels: 2, peak: -7, os: 1, root: 57, kitPitch: null, seed: 0x12ad0d, family: ['vowel'],
    semitones: [-5, 7], role: 'Original synthetic vowel texture on A3: a three-voice androgynous choir that moves oo → oh → ah → oh → oo.',
    use: 'Held choir tones, chord tops, vowel chops (offsetSeconds 2.2–2.8 is the open "ah"), haunting intros.',
    articulation: 'gate = note length, envelope {attackSeconds 0.05, releaseSeconds 0.4}; chops: endSeconds + gate "1/8".',
    method: 'Additive glottal-tilt harmonics shaped by morphing four-formant envelopes (OO, ghost "oh"/"ah", EH), three detuned voices with independent delayed vibrato and formant scale, glottal-pulsed breath noise through the formants.' },
  { id: 'chrome-strike', name: 'CHROME STRIKE', category: 'percussion', seconds: 2.6, channels: 2, peak: -6, os: 1, root: 69, kitPitch: 53, seed: 0x12ae0e, family: ['chrome'],
    semitones: [-12, 7], role: 'Distinctive metallic accent: the CHROME minor-third bell struck on A4, shimmering in stereo.',
    use: 'Phrase-end accents, the opening identity hit, melodic bell figures (it is tuned: hum A3, prime A4, tierce C5).',
    articulation: 'Plays whole; gate "1/4" + releaseSeconds 0.25 for rhythmic bell figures.',
    method: 'Twelve CHROME modes with ratio-dependent decays and L/R split partners, strike-position weighting, band-passed strike noise and a 2.38 kHz FM anvil tick.' },
  { id: 'ascension', name: 'ASCENSION', category: 'transition', seconds: 6, channels: 2, peak: -6, os: 1, root: 69, kitPitch: null, seed: 0x12af0f, family: ['space', 'chrome'],
    semitones: [-2, 2], role: 'Musical tension riser: A–E fifths climbing exactly one octave to A4/E5, a rising noise sweep and accelerating flutter.',
    use: 'Ends at its last frame: place it 6 s before a downbeat, or use offsetSeconds (6 − build seconds) for shorter builds.',
    articulation: 'Plays whole; never gate it (the peak is the final frame).',
    method: 'Exponential one-octave glide on soft band-limited saws, swept state-variable band-pass noise (350 Hz → 9.7 kHz) with rising Q, CHROME shimmer, accelerating tremolo, widening side signal, 6 ms boundary taper.' },
  { id: 'convergence', name: 'CONVERGENCE', category: 'impact', seconds: 5, channels: 2, peak: -4, os: 2, root: 33, kitPitch: null, seed: 0x12b010, family: ['low', 'chrome'],
    semitones: [-3, 2], role: 'Powerful cinematic impact: A2→A1 sub drop (phase-locked), body thump, crack, an A minor stab and a long CHROME tail.',
    use: 'Section downbeats and finales; leave 3–5 s; pairs with ASCENSION ending on the same frame.',
    articulation: 'Plays whole; gate the tail with releaseSeconds 0.6 if the next section starts early.',
    method: 'Sub drop with exactly six extra cycles, band-passed noise thump, two-band crack, CHROME modes on A3 through per-channel allpass diffusion, low-passed A-minor saw stab, falling noise debris, mono below 140 Hz; 2x.' },
] as const satisfies readonly Spec[];
export type SignatureSound = typeof sounds[number];
export type SoundId = SignatureSound['id'];

// ---------- DSP primitives ----------
/** xorshift32 white noise in [-1, 1). */
function noise(length: number, seed: number): Wave {
  let state = seed >>> 0 || 1; const out = new Float64Array(length);
  for (let i = 0; i < length; i++) { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; out[i] = (state >>> 0) / 2147483648 - 1; }
  return out;
}
/** Deterministic parameter stream in [0, 1). */
function stream(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
}
function lowpass1(x: Wave, cutoff: number, fs: number): Wave {
  const a = 1 - Math.exp(-TAU * cutoff / fs), out = new Float64Array(x.length); let y = 0;
  for (let i = 0; i < x.length; i++) out[i] = (y += a * (x[i]! - y));
  return out;
}
function highpass1(x: Wave, cutoff: number, fs: number): Wave {
  const low = lowpass1(x, cutoff, fs), out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i]! - low[i]!;
  return out;
}
type BiquadKind = 'lowpass' | 'highpass' | 'bandpass' | 'peak';
/** RBJ cookbook biquad. Band-pass has 0 dB peak gain; `peak` is a bell with `gainDb`. */
function biquad(x: Wave, kind: BiquadKind, f: number, q: number, fs: number, gainDb = 0): Wave {
  const w = TAU * f / fs, c = Math.cos(w), alpha = Math.sin(w) / (2 * q), A = 10 ** (gainDb / 40);
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  if (kind === 'lowpass') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha; }
  else if (kind === 'highpass') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha; }
  else if (kind === 'bandpass') { b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha; }
  else { b0 = 1 + alpha * A; b1 = -2 * c; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * c; a2 = 1 - alpha / A; }
  const out = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]!, y = (b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = v; y2 = y1; y1 = y; out[i] = y;
  }
  return out;
}
const bandpass = (x: Wave, f: number, q: number, fs: number) => biquad(x, 'bandpass', f, q, fs);
const highpass = (x: Wave, f: number, fs: number, q = Math.SQRT1_2) => biquad(x, 'highpass', f, q, fs);
/** Zero-delay-feedback (TPT) state-variable filter with a per-sample cutoff; stable at every setting. */
function svf(x: Wave, cutoff: Wave, q: number | Wave, fs: number, mode: 'lp' | 'bp' | 'hp'): Wave {
  const out = new Float64Array(x.length); let s1 = 0, s2 = 0;
  for (let i = 0; i < x.length; i++) {
    const k = 1 / (typeof q === 'number' ? q : q[i]!), g = Math.tan(Math.PI * Math.min(cutoff[i]!, 0.45 * fs) / fs);
    const hp = (x[i]! - (k + g) * s1 - s2) / (1 + g * (k + g)), bp = g * hp + s1, lp = g * bp + s2;
    s1 = g * hp + bp; s2 = g * bp + lp;
    out[i] = mode === 'lp' ? lp : mode === 'bp' ? bp : hp;
  }
  return out;
}
/** Schroeder allpass chain: colourless diffusion; channel-specific delays create width. */
function diffuse(x: Wave, delaysMs: readonly number[], gain: number, fs: number): Wave {
  let input = x;
  for (const ms of delaysMs) {
    const d = Math.round(ms * fs / 1000), y = new Float64Array(input.length);
    for (let i = 0; i < input.length; i++) y[i] = -gain * input[i]! + (i >= d ? input[i - d]! + gain * y[i - d]! : 0);
    input = y;
  }
  return input;
}
/** Feedback comb: y[i] = x[i] + g * y[i - d]. */
function comb(x: Wave, delay: number, g: number): Wave {
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i]! + (i >= delay ? g * out[i - delay]! : 0);
  return out;
}
const fill = (n: number, fs: number, f: (t: number, i: number) => number): Wave => { const out = new Float64Array(n); for (let i = 0; i < n; i++) out[i] = f(i / fs, i); return out; };
const mix = (...parts: [number, Wave][]): Wave => { const out = new Float64Array(parts[0]![1].length); for (const [g, w] of parts) for (let i = 0; i < out.length; i++) out[i]! += g * w[i]!; return out; };
const scale = (x: Wave, f: (t: number, i: number) => number, fs: number): Wave => { const out = new Float64Array(x.length); for (let i = 0; i < x.length; i++) out[i] = x[i]! * f(i / fs, i); return out; };
/** Split at `cutoff` and keep the low band identical (mono) in every channel; the high band keeps its stereo. */
function monoLow(channels: Wave[], cutoff: number, fs: number): Wave[] {
  const lows = channels.map(c => biquad(biquad(c, 'lowpass', cutoff, Math.SQRT1_2, fs), 'lowpass', cutoff, Math.SQRT1_2, fs));
  return channels.map((c, k) => { const out = new Float64Array(c.length); for (let i = 0; i < c.length; i++) { let m = 0; for (const l of lows) m += l[i]!; out[i] = c[i]! - lows[k]![i]! + m / lows.length; } return out; });
}
/** Constant-power stereo gains for pan in [-1, 1]. */
const panGains = (pan: number): [number, number] => { const theta = (pan + 1) * Math.PI / 4; return [Math.cos(theta) * Math.SQRT2, Math.sin(theta) * Math.SQRT2]; };

// Band-limited single-cycle tables: harmonics are summed directly, so nothing above `limitHz / maxHz` ever exists.
const TABLE = 8192, tables = new Map<string, Wave>();
type Shape = 'saw' | 'square' | 'triangle';
function table(shape: Shape, harmonics: number): Wave {
  const key = `${shape}:${harmonics}`, cached = tables.get(key); if (cached) return cached;
  const out = new Float64Array(TABLE + 1);
  for (let k = 1; k <= harmonics; k++) {
    const amp = shape === 'saw' ? 1 / k : k % 2 === 0 ? 0 : shape === 'square' ? 1 / k : ((k - 1) / 2 % 2 === 0 ? 1 : -1) / (k * k);
    if (amp === 0) continue;
    for (let i = 0; i < TABLE; i++) out[i]! += amp * Math.sin(TAU * k * i / TABLE);
  }
  const norm = shape === 'saw' ? 2 / Math.PI : shape === 'square' ? 4 / Math.PI : 8 / (Math.PI * Math.PI);
  for (let i = 0; i < TABLE; i++) out[i]! *= norm;
  out[TABLE] = out[0]!; tables.set(key, out); return out;
}
const harmonicsFor = (maxHz: number, limitHz = 19000) => Math.max(1, Math.floor(limitHz / maxHz));
function read(tab: Wave, phase: number): number { const p = (phase - Math.floor(phase)) * TABLE, i = Math.floor(p), f = p - i; return tab[i]! + f * (tab[i + 1]! - tab[i]!); }
/** Oscillator from a per-sample frequency (Hz); returns the wave and leaves phases integrated exactly per sample. */
function oscillator(tab: Wave, freq: Wave, fs: number, phase0 = 0): Wave {
  const out = new Float64Array(freq.length); let phase = phase0;
  for (let i = 0; i < freq.length; i++) { out[i] = read(tab, phase); phase += freq[i]! / fs; if (phase >= 1) phase -= Math.floor(phase); }
  return out;
}

// Kaiser-windowed sinc (beta 8.96, about 90 dB stop band), -6 dB at 20.5 kHz; linear phase, centred so frame j is time j/44100.
const TAPS = 255, HALF = (TAPS - 1) / 2;
function besselI0(x: number): number { let sum = 1, term = 1; for (let k = 1; k <= 40; k++) { term *= (x / (2 * k)) ** 2; sum += term; } return sum; }
const firs = new Map<number, Wave>();
function fir(os: number): Wave {
  const cached = firs.get(os); if (cached) return cached;
  const cutoff = 20500 / (RATE * os), beta = 8.96, taps = new Float64Array(TAPS); let sum = 0;
  for (let n = 0; n < TAPS; n++) {
    const m = n - HALF, r = m / HALF;
    taps[n] = (m === 0 ? 2 * cutoff : Math.sin(TAU * cutoff * m) / (Math.PI * m)) * besselI0(beta * Math.sqrt(1 - r * r)) / besselI0(beta);
    sum += taps[n]!;
  }
  for (let n = 0; n < TAPS; n++) taps[n]! /= sum;
  firs.set(os, taps); return taps;
}
function decimate(input: Wave, frames: number, os: number): Wave {
  if (os === 1) return input.slice(0, frames);
  const h = fir(os), out = new Float64Array(frames);
  for (let j = 0; j < frames; j++) {
    let acc = 0; const base = j * os - HALF;
    const lo = Math.max(0, -base), hi = Math.min(TAPS, input.length - base);
    for (let n = lo; n < hi; n++) acc += h[n]! * input[base + n]!;
    out[j] = acc;
  }
  return out;
}

/** The CHROME bell at fundamental phase `cycles` (prime at f0). `body` scales decays, `bright` scales modes above the
 * nominal, `split` detunes each mode (Hz, signed per channel) so the two channels shimmer against each other. */
function chrome(t: number, f0: number, body: number, bright = 1, split = 0, lowest = 0, hum = 1): number {
  let sum = 0;
  for (let k = lowest; k < CHROME.length; k++) {
    const m = CHROME[k]!, f = f0 * m.ratio; if (f > 18000) continue;
    const detune = m.ratio <= 1 ? 0 : split * (0.4 + 0.35 * k);
    sum += m.amp * (m.ratio > 2 ? bright : m.ratio < 1 ? hum : 1) * exp(t, body * m.decay) * (1 + 0.25 * Math.sin(1.3 * k)) * Math.sin(TAU * (f + detune) * t);
  }
  return sum;
}
/** Sum of formant resonance curves at frequency f for a vowel table. */
function formantGain(f: number, vowel: readonly (readonly [number, number, number])[], scaleHz = 1): number {
  let sum = 0.002;
  for (const [center, level, width] of vowel) sum += level / (1 + ((f - center * scaleHz) / (width / 2)) ** 2);
  return sum;
}
function blendVowel(a: readonly (readonly [number, number, number])[], b: readonly (readonly [number, number, number])[], x: number): [number, number, number][] {
  return a.map((v, k) => { const w = b[k]!; return [v[0] + (w[0] - v[0]) * x, v[1] + (w[1] - v[1]) * x, v[2] + (w[2] - v[2]) * x] as [number, number, number]; });
}

// ---------- Voices ----------
interface Context { n: number; fs: number; seed: number }
type Voice = (c: Context) => Wave[];

const voices: Record<SoundId, Voice> = {
  'sub-hammer': ({ n, fs, seed }) => {
    // f(t) = A1 (1 + a e^(-t/t1) + b e^(-t/t2)): extra cycles A1 (a t1 + b t2) = 4 exactly, so the body is in phase with ABYSS.
    const t1 = 0.003, a = 8, t2 = 0.035, b = (4 / A1 - a * t1) / t2;
    const strike = bandpass(highpass(noise(n, seed), 1800, fs), 4200, 0.7, fs);
    return [fill(n, fs, (t, i) => {
      const cycles = A1 * (t + a * t1 * (1 - exp(t, t1)) + b * t2 * (1 - exp(t, t2)));
      const drive = 1.3 + 2.2 * exp(t, 0.05), bias = 0.12;
      const body = (Math.tanh(drive * (sin(cycles) + bias)) - Math.tanh(drive * bias)) / Math.tanh(drive);
      const amp = rise(t, 0.0002) * (t < 0.05 ? 1 : exp(t - 0.05, 0.3));
      return amp * body + 0.3 * strike[i]! * exp(t, 0.0016) + 0.16 * rise(t, 0.0001) * sin(1850 * t) * exp(t, 0.0018);
    })];
  },
  'iron-pulse': ({ n, fs, seed }) => {
    const t1 = 0.0015, a = 22, t2 = 0.022, b = (3 / A1 - a * t1) / t2; // three extra cycles: phase-locked to A1
    const click = bandpass(highpass(noise(n, seed), 3000, fs), 6000, 0.8, fs);
    return [fill(n, fs, (t, i) => {
      const cycles = A1 * (t + a * t1 * (1 - exp(t, t1)) + b * t2 * (1 - exp(t, t2)));
      const knock = sin(150 * t + 0.4 * 0.004 * 150 * (1 - exp(t, 0.004))) * exp(t, 0.025);
      const x = sin(cycles) + 0.38 * knock, drive = 2.4 + 5 * exp(t, 0.03), bias = 0.2;
      let y = (Math.tanh(drive * (x + bias)) - Math.tanh(drive * bias)) / Math.tanh(drive);
      y += 0.14 * Math.sin(3.2 * x) * exp(t, 0.02); // short wavefold edge on the attack
      const amp = rise(t, 0.00015) * (t < 0.025 ? 1 : exp(t - 0.025, 0.085));
      return amp * y + 0.34 * click[i]! * exp(t, 0.0009) + 0.1 * rise(t, 0.0001) * chrome(t, 1650, 0.004, 1, 0, 4);
    })];
  },
  'titanium-crack': ({ n, fs, seed }) => {
    const wires = noise(n, seed), crack = highpass(highpass(noise(n, seed + 1), 3500, fs), 3500, fs), room = noise(n, seed + 2);
    const wire = mix([1, bandpass(wires, 2200, 0.7, fs)], [0.8, bandpass(wires, 5600, 0.9, fs)], [0.35, highpass(highpass(wires, 9000, fs), 9000, fs)]);
    const mid = fill(n, fs, (t, i) => {
      const cycles = 220 * (t + 0.35 * 0.006 * (1 - exp(t, 0.006)));
      const shell = 0.45 * sin(cycles) * exp(t, 0.065) + 0.3 * sin(1.594 * cycles) * exp(t, 0.04) + 0.12 * sin(2.136 * cycles) * exp(t, 0.025);
      const wiresEnv = rise(t, 0.0004) * (0.6 * exp(t, 0.018) + 0.4 * exp(t, 0.14));
      const x = rise(t, 0.0003) * shell + 1.7 * wire[i]! * wiresEnv + 1.1 * crack[i]! * exp(t, 0.0016) + 0.2 * rise(t, 0.0001) * chrome(t, 880, 0.09, 1, 0, 4);
      return Math.tanh(1.8 * x) / Math.tanh(1.8);
    });
    const side = diffuse(scale(bandpass(highpass(room, 1500, fs), 4500, 0.5, fs), t => 0.32 * rise(t - 0.008, 0.004) * exp(Math.max(0, t - 0.008), 0.12), fs), [3.1, 5.3, 7.9], 0.55, fs);
    return [mix([1, mid], [1, side]), mix([1, mid], [-1, side])];
  },
  'neon-clap': ({ n, fs, seed }) => {
    const common = noise(n, seed), sides = noise(n, seed + 1);
    const burstSource = biquad(highpass(mix([1, bandpass(common, 1250, 1.3, fs)], [0.7, bandpass(common, 2700, 1.6, fs)], [0.2, highpass(common, 6000, fs)]), 500, fs), 'lowpass', 13000, Math.SQRT1_2, fs);
    const starts = [0, 0.0071, 0.0158, 0.0249, 0.0336], levels = [0.7, 0.85, 0.75, 0.9, 1], decays = [0.0024, 0.0026, 0.0028, 0.0031, 0.0042], pans = [-0.3, 0.25, -0.15, 0.3, 0];
    const last = starts[4]!, tailEnv = (t: number) => rise(t - last, 0.0008) * exp(Math.max(0, t - last), 0.12);
    const tailNoise = bandpass(highpass(common, 900, fs), 3000, 0.45, fs);
    const neon = highpass(comb(scale(tailNoise, tailEnv, fs), Math.round(fs / 880), 0.62), 1000, fs);
    const side = bandpass(highpass(sides, 1000, fs), 4000, 0.5, fs);
    return [0, 1].map(ch => fill(n, fs, (t, i) => {
      let bursts = 0;
      for (let k = 0; k < starts.length; k++) if (t >= starts[k]!) bursts += levels[k]! * panGains(pans[k]!)[ch]! * rise(t - starts[k]!, 0.00025) * exp(t - starts[k]!, decays[k]!);
      return 2.2 * burstSource[i]! * bursts + 0.75 * tailNoise[i]! * tailEnv(t) + 0.3 * neon[i]! + (ch ? -1 : 1) * 0.38 * side[i]! * tailEnv(t);
    }));
  },
  'ghost-tick': ({ n, fs, seed }) => [hatMetal(n, fs, seed, 0, 'closed')],
  'open-circuit': ({ n, fs, seed }) => [hatMetal(n, fs, seed, 0, 'open'), hatMetal(n, fs, seed, 1, 'open')],
  'abyss': ({ n, fs }) => [fill(n, fs, t => {
    const p = A1 * t, bloom = exp(t, 0.12), breathe = 1 + 0.18 * Math.sin(TAU * 0.23 * t);
    const x = sin(p) + (0.11 * breathe + 0.22 * bloom) * sin(2 * p) + (0.07 + 0.16 * bloom) * sin(3 * p) + (0.018 + 0.1 * bloom) * sin(4 * p) + 0.06 * bloom * sin(5 * p);
    return rise(t, 0.006) * (1 + 0.12 * exp(t, 0.15)) * exp(t, 24) * x;
  })],
  'reactor': ({ n, fs, seed }) => {
    const r = stream(seed), saw = table('saw', harmonicsFor(A1 * 1.02, 20000));
    const channels = [-1, 1].map(side => {
      const voicesCents = side < 0 ? [-9, 0, 5] : [-5, 0, 9];
      const saws = voicesCents.map((c, k) => oscillator(saw, new Float64Array(n).fill(A1 * cents(c)), fs, k === 1 ? 0 : r()));
      const body = fill(n, fs, (t, i) => {
        const p = A1 * t, index = 1.8 + 1.4 * rise(t, 0.03) * (0.6 + 0.4 * exp(t, 0.25)) + 0.45 * Math.sin(TAU * 0.29 * t + side);
        const fm = Math.sin(TAU * p + index * Math.sin(TAU * p));
        // At these indices the FM fundamental (J0 - J2) is negative, so the layer is inverted: its 55 Hz then adds in phase with ABYSS.
        const x = 0.62 * (saws[0]![i]! * 0.8 + saws[1]![i]! + saws[2]![i]! * 0.8) / 2.6 - 0.45 * fm + 0.12 * sin(p);
        return Math.tanh(4 * x) + 0.12 * Math.sin(5 * x) * (0.6 + 0.4 * Math.sin(TAU * 0.23 * t)); // drive plus a slow fold edge
      });
      const morph = fill(n, fs, t => Math.min(1, Math.max(0, 0.15 + 0.55 * smooth(t / 0.5) + 0.25 * Math.sin(TAU * 0.19 * t + 0.3 * side))));
      const f1 = morph.map(m => GHOST_VOWEL.oh[0][0] + (GHOST_VOWEL.ah[0][0] - GHOST_VOWEL.oh[0][0]) * m), f2 = morph.map(m => GHOST_VOWEL.oh[1][0] + (GHOST_VOWEL.ah[1][0] - GHOST_VOWEL.oh[1][0]) * m);
      const cutoff = fill(n, fs, t => 1900 + 3500 * (1 - exp(t, 0.006)) * exp(t, 0.06) + 520 * Math.sin(TAU * 0.27 * t + 1.1) + 300 * Math.sin(TAU * 0.13 * t + side));
      return mix([1, svf(body, cutoff, 1.25, fs, 'lp')], [0.9, svf(body, f1, 3.5, fs, 'bp')], [0.7, svf(body, f2, 4.5, fs, 'bp')], [0.35, bandpass(body, GHOST_VOWEL.ah[2][0], 3, fs)]);
    });
    return monoLow(channels.map(c => scale(c, t => rise(t, 0.002), fs)), 180, fs);
  },
  'signal': ({ n, fs, seed }) => {
    // A centred voice plus a quieter ±7 cent pair, one per side: width without mono cancellation.
    const r = stream(seed), saw = table('saw', harmonicsFor(A4 * 1.01, 20000));
    const layers = [0, -1, 1].map(side => {
      const f = A4 * cents(7 * side), freq = new Float64Array(n).fill(f), offset = r();
      const width = fill(n, fs, t => 0.5 + 0.13 * Math.sin(TAU * 0.37 * t + 0.9 * side));
      const a = oscillator(saw, freq, fs, offset), pulse = new Float64Array(n);
      for (let i = 0, phase = offset; i < n; i++) { pulse[i] = a[i]! - read(saw, phase + width[i]!); phase += f / fs; }
      const cutoff = fill(n, fs, t => 3200 + 6200 * exp(t, 0.07) + 1100 * exp(t, 0.9) + 400 * Math.sin(TAU * 0.29 * t + side));
      const filtered = svf(pulse, cutoff, 1.6, fs, 'lp');
      return fill(n, fs, (t, i) => {
        const p = f * t, index = 2.3 + 2 * exp(t, 0.05) + 0.25 * exp(t, 0.6);
        const fm = Math.sin(TAU * p + index * Math.sin(TAU * 2 * p));
        const ping = 0.22 * sin(3 * p) * exp(t, 0.035) + 0.08 * sin(4.21 * p) * exp(t, 0.018);
        const x = 0.45 * fm + 0.72 * filtered[i]! + ping;
        return rise(t, 0.0012) * (0.42 + 0.58 * exp(t, 0.22)) * exp(t, 9) * Math.tanh(1.4 * x) / Math.tanh(1.4);
      });
    });
    return [1, 2].map(k => mix([1, layers[0]!], [0.42, layers[k]!]));
  },
  'phantom': ({ n, fs, seed }) => {
    const r = stream(seed), detunes = [-19, -12, -5, 0, 5, 12, 19], levels = [0.7, 0.85, 1, 1, 1, 0.85, 0.7];
    const saw = table('saw', harmonicsFor(E5 * cents(45), 20000)), square = table('square', harmonicsFor(E5 / 2 * cents(30), 20000));
    // One shared vibrato: depth fades in after 0.45 s, so short notes stay clean and held notes sing.
    const pitch = fill(n, fs, t => E5 * cents(20 * smooth((t - 0.45) / 0.7) * Math.sin(TAU * 5.1 * t) + 3 * Math.sin(TAU * 0.7 * t)));
    // Each voice also drifts ±1.5 cents on its own slow cycle, so the unison never freezes into a static chorus.
    const unison = detunes.map((d, k) => { const drift = 0.09 + 0.17 * r(), phase = TAU * r();
      return oscillator(saw, fill(n, fs, (t, i) => pitch[i]! * cents(d + 1.5 * Math.sin(TAU * drift * t + phase))), fs, r()).map(v => v * levels[k]!); });
    const breath = [noise(n, seed + 1), noise(n, seed + 2)].map(x => mix([1, bandpass(x, GHOST_VOWEL.ah[1][0], 3, fs)], [0.8, bandpass(x, GHOST_VOWEL.ah[2][0], 2.5, fs)], [0.25, highpass(x, 6000, fs)]));
    const sub = oscillator(square, pitch.map(f => f / 2), fs, 0);
    const cutoff = fill(n, fs, t => 3000 + 6000 * smooth(t / 1.4) + 2500 * exp(t, 0.03));
    // The centre three voices sound in both channels; the outer pairs split (-12/+19 left, +12/-19 right).
    const assign = [[[2, 0.8], [3, 1], [4, 0.8], [1, 1], [6, 1]], [[2, 0.8], [3, 1], [4, 0.8], [5, 1], [0, 1]]] as const;
    const [ah1, ah2, ah3] = GHOST_VOWEL.ah;
    return assign.map(indices => {
      const sum = new Float64Array(n);
      for (const [k, g] of indices) for (let i = 0; i < n; i++) sum[i]! += g * unison[k]![i]!;
      for (let i = 0; i < n; i++) sum[i] = sum[i]! / 3.6 + 0.12 * sub[i]!;
      let voiced = svf(sum, cutoff, 0.8, fs, 'lp');
      for (const [f, gain, q] of [[ah1[0], 2, 1.6], [ah2[0], 3, 2], [ah3[0], 6, 1.6]] as const) voiced = biquad(voiced, 'peak', f, q, fs, gain);
      const air = breath[indices[4]![0] === 6 ? 0 : 1]!;
      return fill(n, fs, (t, i) => rise(t, 0.014) * (0.85 + 0.15 * smooth(t / 1.6)) * (Math.tanh(2 * voiced[i]!) / Math.tanh(2) + 0.035 * air[i]! * (0.6 + 0.4 * smooth(t / 1.4))));
    });
  },
  'event-horizon': ({ n, fs, seed }) => {
    const r = stream(seed), root = hz(45);
    const tones = [[1, 1], [2 ** (7 / 12), 0.7], [2, 0.6], [2 * 2 ** (7 / 12), 0.38], [4, 0.25]] as const;
    interface Partial { f: number; amp: number; lfo: number; lfoPhase: number; drift: number; driftPhase: number; spin: number; spinPhase: number; phase: number; centered: boolean }
    const partials: Partial[] = [];
    for (const [ratio, level] of tones) for (let k = 1; root * ratio * k <= 9000; k++) {
      const f = root * ratio * k;
      partials.push({ f, amp: level * k ** -1.1, lfo: 0.05 + 0.26 * r(), lfoPhase: TAU * r(), drift: 0.07 + 0.2 * r(), driftPhase: TAU * r(),
        spin: 0.03 + 0.09 * r(), spinPhase: TAU * r(), phase: f < 220 ? 0 : r(), centered: f < 220 });
    }
    const left = new Float64Array(n), right = new Float64Array(n), BLOCK = 64;
    for (const p of partials) {
      const depth = 0.0009 * p.f / (TAU * p.drift);
      for (let start = 0; start < n; start += BLOCK) {
        const gains = [start, Math.min(n, start + BLOCK)].map(i => {
          const t = i / fs, center = Math.log2(700) + 1.6 * Math.sin(TAU * 0.061 * t + 0.3) + 0.6 * Math.sin(TAU * 0.023 * t);
          const bump = 0.35 + 1.2 * Math.exp(-((Math.log2(p.f) - center) ** 2) / (2 * 0.8 * 0.8));
          const g = p.amp * bump * (1 + 0.35 * Math.sin(TAU * p.lfo * t + p.lfoPhase));
          const [gl, gr] = p.centered ? [1, 1] : panGains(0.7 * Math.sin(TAU * p.spin * t + p.spinPhase));
          return [g * gl, g * gr];
        });
        const [l0, r0] = gains[0]!, [l1, r1] = gains[1]!, end = Math.min(n, start + BLOCK), span = end - start;
        for (let i = start; i < end; i++) {
          const t = i / fs, w = (i - start) / span;
          const v = Math.sin(TAU * (p.phase + p.f * t + depth * (Math.cos(p.driftPhase) - Math.cos(TAU * p.drift * t + p.driftPhase))));
          left[i]! += (l0! + (l1! - l0!) * w) * v; right[i]! += (r0! + (r1! - r0!) * w) * v;
        }
      }
    }
    // Space dust: noise rung through chord-tone resonators, decorrelated per channel, plus faint air.
    const dust = [noise(n, seed + 1), noise(n, seed + 2)].map(x => mix(...[57, 64, 69, 76, 81, 88].map((m, k) => [0.5 / (1 + k * 0.4), bandpass(x, hz(m), 28, fs)] as [number, Wave]), [0.05, highpass(highpass(x, 5000, fs), 5000, fs)]));
    return [left, right].map((c, k) => fill(n, fs, (t, i) => rise(t, 1.6) * (0.92 + 0.08 * smooth(t / 6)) * (c[i]! / 6 + 0.9 * dust[k]![i]! * (0.6 + 0.4 * Math.sin(TAU * 0.09 * t + k)))));
  },
  'afterglow': ({ n, fs, seed }) => {
    const r = stream(seed), detunes = [-11, -6.5, -2.2, 2.2, 6.5, 11], saw = table('saw', harmonicsFor(A3 * cents(14), 12000));
    const tri = oscillator(table('triangle', harmonicsFor(A3, 16000)), new Float64Array(n).fill(A3), fs, 0);
    const ensemble = detunes.map(d => {
      const rateHz = 0.11 + 0.18 * r(), phase = TAU * r();
      return oscillator(saw, fill(n, fs, t => A3 * cents(d + 1.5 * Math.sin(TAU * rateHz * t + phase))), fs, r());
    });
    const cutoff = fill(n, fs, t => 1000 + 2100 * smooth(t / 0.7) + 380 * Math.sin(TAU * 0.17 * t + 0.4) + 200 * Math.sin(TAU * 0.071 * t));
    return [[0, 2, 3, 4], [1, 2, 3, 5]].map(indices => {
      const sum = fill(n, fs, (_, i) => indices.reduce((s, k) => s + ensemble[k]![i]!, 0) / 4 + 0.3 * tri[i]!);
      const warm = svf(sum, cutoff, 0.9, fs, 'lp');
      return fill(n, fs, (t, i) => Math.sin(Math.PI / 2 * Math.min(1, t / 0.28)) ** 2 * (0.9 + 0.1 * smooth(t / 1.2)) * exp(t, 30) * Math.tanh(1.3 * warm[i]!) / Math.tanh(1.3));
    });
  },
  'specter': ({ n, fs, seed }) => {
    // Vowel path: oo (0) -> oh (1) -> ah (2) -> eh (3), position v(t) rises to 2.2 at 2.6 s and returns by 5.2 s.
    const path = [OO, GHOST_VOWEL.oh, GHOST_VOWEL.ah, EH] as const;
    const vowelAt = (t: number, scaleHz: number) => {
      const v = 2.2 * (0.5 - 0.5 * Math.cos(TAU * Math.min(t, 5.2) / 5.2)), k = Math.min(2, Math.floor(v));
      return blendVowel(path[k]!, path[k + 1]!, v - k).map(([f, l, w]) => [f * scaleHz, l, w] as [number, number, number]);
    };
    const choir = [{ detune: 0, vib: 4.7, depth: 14, delay: 0.3, scaleHz: 1 }, { detune: 7, vib: 5.05, depth: 17, delay: 0.45, scaleHz: 1.04 }, { detune: -6, vib: 4.4, depth: 12, delay: 0.38, scaleHz: 0.97 }];
    const BLOCK = 32, breathNoise = [noise(n, seed + 1), noise(n, seed + 2)];
    const sung = choir.map(v => {
      const out = new Float64Array(n), glottal = new Float64Array(n); let phase = 0, levels = new Float64Array(0);
      for (let i = 0; i < n; i++) {
        const t = i / fs, f = A3 * cents(v.detune + v.depth * smooth((t - v.delay) / 0.8) * Math.sin(TAU * v.vib * t));
        if (i % BLOCK === 0) { const vowel = vowelAt(t, v.scaleHz), count = Math.floor(15000 / f); levels = new Float64Array(count); for (let k = 0; k < count; k++) levels[k] = formantGain((k + 1) * f, vowel) / (k + 1) ** 1.05; }
        let s = 0; for (let k = 0; k < levels.length; k++) s += levels[k]! * Math.sin(TAU * (k + 1) * phase);
        out[i] = s; glottal[i] = 0.5 + 0.5 * Math.max(0, Math.cos(TAU * phase)); phase += f / fs; if (phase >= 1) phase -= 1;
      }
      return { out, glottal };
    });
    // Breath through the moving first three formants of the lead voice, pulsed by its glottal phase.
    const centers = [0, 1, 2].map(() => new Float64Array(n));
    for (let i = 0; i < n; i++) { const vowel = vowelAt(i / fs, 1); for (let k = 0; k < 3; k++) centers[k]![i] = vowel[k]![0]; }
    return [0, 1].map(ch => {
      const pulsed = scale(breathNoise[ch]!, (_, i) => sung[0]!.glottal[i]!, fs);
      const breath = mix(...centers.map((c, k) => [[0.9, 0.55, 0.25][k]!, svf(pulsed, c, 6 + 3 * k, fs, 'bp')] as [number, Wave]));
      const air = highpass(highpass(breathNoise[ch]!, 4000, fs), 4000, fs);
      return fill(n, fs, (t, i) => rise(t, 0.3) * (sung[0]!.out[i]! + 0.6 * sung[ch + 1]!.out[i]! + 0.25 * sung[2 - ch]!.out[i]! + 0.32 * breath[i]! + 0.04 * air[i]! * sung[0]!.glottal[i]!));
    });
  },
  'chrome-strike': ({ n, fs, seed }) => {
    const hit = bandpass(highpass(noise(n, seed), 2000, fs), 5200, 0.8, fs);
    return [-1, 1].map(side => fill(n, fs, (t, i) => {
      const anvil = Math.sin(TAU * 2380 * t + 2.5 * exp(t, 0.002) * Math.sin(TAU * 3360 * t)) * exp(t, 0.003);
      // The same bell two octaves up, short: the sparkle above 3 kHz.
      return rise(t, 0.00005) * (chrome(t, A4, 1.8, 1.8, 0.5 * side, 0, 0.6) + 0.3 * chrome(t, 4 * A4, 0.3, 1, side, 4)) + 0.45 * hit[i]! * exp(t, 0.0012) + 0.3 * anvil;
    }));
  },
  'ascension': ({ n, fs, seed }) => {
    const T = n / fs, r = stream(seed), saw = table('saw', 8);
    const tones = [[hz(57), 1], [hz(64), 0.8], [hz(69), 0.7], [hz(76), 0.45]] as const; // A3 E4 A4 E5, rising one octave
    const glide = fill(n, fs, t => 2 ** (t / T)), climb = (f: number, t: number) => f * T / Math.LN2 * (2 ** (t / T) - 1); // integrated phase of f * 2^(t/T)
    // The pitched climb is centred (mono-safe); width comes only from the noise side signal and the shimmer.
    const climbing = new Float64Array(n);
    for (const [f, level] of tones) { const w = oscillator(saw, glide.map(g => g * f), fs, r()); for (let i = 0; i < n; i++) climbing[i]! += level * w[i]!; }
    const tonal = svf(climbing, fill(n, fs, t => 900 + 5200 * (t / T) ** 1.4), 0.9, fs, 'lp');
    const sweep = [noise(n, seed + 1), noise(n, seed + 2)].map(x => svf(x, fill(n, fs, t => 350 * 2 ** (4.8 * (t / T) ** 1.15)), fill(n, fs, t => 1.2 + 3.5 * t / T), fs, 'bp'));
    let flutter = 0; const trem = new Float64Array(n);
    for (let i = 0; i < n; i++) { const p = i / n; trem[i] = 1 - 0.6 * p ** 1.5 * (0.5 - 0.5 * Math.cos(TAU * flutter)); flutter += (3 + 21 * p * p) / fs; }
    const channels = [0, 1].map(ch => fill(n, fs, (t, i) => {
      const p = t / T, mid = (sweep[0]![i]! + sweep[1]![i]!) / 2, side = (sweep[0]![i]! - sweep[1]![i]!) / 2;
      let shimmer = 0; for (let k = 4; k < CHROME.length; k++) shimmer += CHROME[k]!.amp * sin(climb(hz(81) * CHROME[k]!.ratio * cents(ch ? 2 : -2), t));
      const level = 10 ** ((-30 + 30 * p ** 1.5) / 20);
      return level * trem[i]! * (1.6 * (0.3 + 0.7 * p) * tonal[i]! / 2.2 + 1.3 * (mid + (ch ? -1 : 1) * (0.15 + 0.45 * p) * side) + 0.12 * p ** 3 * shimmer);
    }));
    return channels.map(c => highpass(c, 150, fs));
  },
  'convergence': ({ n, fs, seed }) => {
    const tau = 6 / A1, crack = noise(n, seed), sizzle = highpass(highpass(noise(n, seed + 1), 5000, fs), 5000, fs);
    const crackBand = mix([1, bandpass(crack, 2500, 0.5, fs)], [0.5, highpass(crack, 6000, fs)]);
    const thump = bandpass(noise(n, seed + 2), 120, 1.2, fs), saw = table('saw', harmonicsFor(hz(69), 12000));
    const low = fill(n, fs, (t, i) => {
      const cycles = A1 * (t + tau * (1 - exp(t, tau))); // A2 -> A1 with exactly six extra cycles
      const sub = Math.tanh(1.6 * 0.9 * sin(cycles)) / Math.tanh(1.6) * rise(t, 0.0015) * exp(t, 1);
      return sub + 0.5 * thump[i]! * exp(t, 0.12) * 6 + 0.3 * sin(95 * t) * exp(t, 0.08) * rise(t, 0.0005);
    });
    const stab = [[hz(57), 0], [hz(60), -0.5], [hz(64), 0.5], [hz(69), 0]] as const; // A minor: A3 C4 E4 A4
    const stabs = stab.map(([f]) => svf(oscillator(saw, new Float64Array(n).fill(f), fs, 0.25), new Float64Array(n).fill(1800), 0.7, fs, 'lp'));
    const debris = [noise(n, seed + 3), noise(n, seed + 4)].map(x => svf(x, fill(n, fs, t => 1200 + 7800 * exp(t, 0.9)), 0.8, fs, 'lp'));
    const channels = [-1, 1].map((side, ch) => {
      const tail = fill(n, fs, t => rise(t, 0.0002) * (0.6 * chrome(t, A3, 3.2, 1.2, 0.5 * side, 0, 0.5) + 0.25 * chrome(t, 4 * A3, 0.5, 1, side, 4)));
      const spread = mix([0.8, tail], [0.55, highpass(diffuse(tail, ch ? [8.3, 13.7, 19.1, 27.3] : [7.7, 12.9, 18.1, 25.9], 0.6, fs), 400, fs)]);
      return fill(n, fs, (t, i) => {
        let chord = 0; for (let k = 0; k < stab.length; k++) chord += panGains(stab[k]![1])[ch]! * stabs[k]![i]!;
        const x = low[i]! + 1.3 * crackBand[i]! * exp(t, 0.006) + 0.5 * sizzle[i]! * exp(t, 0.09) + spread[i]! + 0.35 * chord * rise(t, 0.004) * exp(t, 0.8)
          + 0.35 * debris[ch]![i]! * rise(t - 0.05, 0.3) * exp(t, 1);
        return Math.tanh(1.5 * x) / Math.tanh(1.5);
      });
    });
    return monoLow(channels, 140, fs);
  },
};

/** Shared hat metal: band-limited squares on CHROME ratios, band-passed high; `open` sweeps the band and rings longer. */
function hatMetal(n: number, fs: number, seed: number, channel: number, kind: 'closed' | 'open'): Wave {
  const base = 410, ratios = [1, CHROME[2]!.ratio, CHROME[3]!.ratio, CHROME[5]!.ratio, CHROME[6]!.ratio, CHROME[7]!.ratio];
  const metal = new Float64Array(n);
  for (const [k, ratio] of ratios.entries()) {
    const f = base * ratio, w = oscillator(table('square', harmonicsFor(f, 0.45 * fs)), new Float64Array(n).fill(f), fs, k / 7);
    for (let i = 0; i < n; i++) metal[i]! += w[i]! / 6;
  }
  const grain = mix([0.6, bandpass(noise(n, seed), 12500, 0.9, fs)], [channel || kind === 'open' ? 0.8 : 0, bandpass(noise(n, seed + 17 + channel), 12500, 0.9, fs)]);
  if (kind === 'closed') {
    const shaped = highpass(highpass(bandpass(metal, 10200, 1.1, fs), 6500, fs), 6500, fs);
    return highpass(fill(n, fs, (t, i) => rise(t, 0.00015) * (0.8 * exp(t, 0.0085) + 0.2 * exp(t, 0.025)) * (2.4 * shaped[i]! + 0.6 * grain[i]!)), 5000, fs);
  }
  const center = fill(n, fs, t => 7200 + 3300 * (1 - exp(t, 0.12)));
  const swept = svf(highpass(highpass(metal, 6000, fs), 6000, fs), center, 1.4, fs, 'bp');
  const sheen = scale(bandpass(noise(n, seed + 31 + channel), 9000, 0.7, fs), t => Math.sin(TAU * 4700 * t), fs);
  return highpass(fill(n, fs, (t, i) => rise(t, 0.0004) * (0.45 * exp(t, 0.02) + 0.55 * exp(t, 0.28)) * (2.6 * swept[i]! + 0.55 * grain[i]! + 0.18 * sheen[i]!)), 5000, fs);
}

// Post at 44.1 kHz: DC/infrasonic one-pole high-pass, start ramp (12 frames or `fadeIn` s), sine-squared end fade (`fadeOut` s).
const post: Record<SoundId, { hp: number; fadeOut: number; fadeIn?: number }> = {
  'sub-hammer': { hp: 10, fadeOut: 0.25 }, 'iron-pulse': { hp: 24, fadeOut: 0.12 }, 'titanium-crack': { hp: 90, fadeOut: 0.18 }, 'neon-clap': { hp: 280, fadeOut: 0.2 },
  'ghost-tick': { hp: 3000, fadeOut: 0.03 }, 'open-circuit': { hp: 3000, fadeOut: 0.35 }, 'abyss': { hp: 10, fadeOut: 1.5 }, 'reactor': { hp: 10, fadeOut: 0.8 },
  'signal': { hp: 60, fadeOut: 0.6 }, 'phantom': { hp: 80, fadeOut: 0.8 }, 'event-horizon': { hp: 30, fadeOut: 2.2 }, 'afterglow': { hp: 50, fadeOut: 1.6 },
  'specter': { hp: 70, fadeOut: 1.2 }, 'chrome-strike': { hp: 100, fadeOut: 0.6 }, 'ascension': { hp: 120, fadeOut: 0.006, fadeIn: 0.5 }, 'convergence': { hp: 10, fadeOut: 1.2 },
};

export const frameCount = (index: number) => Math.round(sounds[index]!.seconds * RATE);
export function synthesizeFloat(index: number): Wave[] {
  const spec = sounds[index]!, frames = frameCount(index), p = post[spec.id];
  const waves = voices[spec.id]({ n: frames * spec.os + (spec.os > 1 ? TAPS : 0), fs: RATE * spec.os, seed: spec.seed });
  if (waves.length !== spec.channels) throw new Error(`${spec.id}: expected ${spec.channels} channels`);
  return waves.map(w => highpass1(decimate(w, frames, spec.os), p.hp, RATE)).map(w => w.map((x, i) => {
    const head = p.fadeIn ? Math.sin(Math.PI / 2 * Math.min(1, i / (p.fadeIn * RATE))) ** 2 : Math.min(1, i / 12);
    const tail = Math.sin(Math.PI / 2 * Math.min(1, (frames - 1 - i) / (p.fadeOut * RATE))) ** 2;
    return x * head * tail;
  }));
}
export function encode(waves: Wave[], peakDbfs: number): Buffer {
  const frames = waves[0]!.length, channels = waves.length; let peak = 0;
  for (const w of waves) for (const x of w) { if (!Number.isFinite(x)) throw new Error('Non-finite synthesis'); peak = Math.max(peak, Math.abs(x)); }
  const gain = 10 ** (peakDbfs / 20) / peak, bytes = Buffer.alloc(44 + frames * channels * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(channels, 22);
  bytes.writeUInt32LE(RATE, 24); bytes.writeUInt32LE(RATE * channels * 2, 28); bytes.writeUInt16LE(channels * 2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(bytes.length - 44, 40);
  for (let i = 0; i < frames; i++) for (let c = 0; c < channels; c++) bytes.writeInt16LE(Math.round(waves[c]![i]! * gain * 32767), 44 + (i * channels + c) * 2);
  return bytes;
}
export const synthesize = (index: number) => encode(synthesizeFloat(index), sounds[index]!.peak);
export const fileName = (index: number) => `${String(index + 1).padStart(2, '0')}-${sounds[index]!.id}.wav`;

/** Catalog entry: identity, tuning, playable range and the hash of the bytes just written. */
function describe(index: number, bytes: Buffer) {
  const s: Spec = sounds[index]!, frames = frameCount(index), [down, up] = s.semitones, root = s.root;
  return {
    index: index + 1, id: s.id, name: s.name, category: s.category, file: `${PACK.directory}/${fileName(index)}`, channels: s.channels, frames, seconds: Number((frames / RATE).toFixed(6)),
    peakDbfs: s.peak, rootNote: root === null ? null : noteName(root), rootMidi: root, fundamentalHz: root === null ? null : Number(hz(root).toFixed(3)), kitPitch: s.kitPitch,
    playback: { recommendedSemitones: [down, up], recommendedRates: [rate(down), rate(up)], recommendedNotes: root === null ? null : [noteName(root + down), noteName(root + up)],
      sourceSecondsAtLowestRate: Number((frames / RATE / rate(down)).toFixed(3)), sourceSecondsAtHighestRate: Number((frames / RATE / rate(up)).toFixed(3)), engineRates: [0.25, 4] },
    role: s.role, use: s.use, articulation: s.articulation, method: s.method, family: s.family, seed: s.seed, oversampling: s.os, post: post[sounds[index]!.id],
    sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
  };
}
export function catalog(entries: ReturnType<typeof describe>[]) {
  return {
    pack: PACK.name, id: PACK.id, version: PACK.version, engine: 'DaemonV12 0.7.0 (formatVersion 1); no engine change required', sampleRate: RATE, bitsPerSample: 16,
    homeKey: 'A minor', tuning: 'A4 = 440 Hz, equal temperament', generator: 'scripts/generate-v12-signature.ts',
    provenance: 'Every WAV is computed by scripts/generate-v12-signature.ts from numeric parameters and seeded xorshift32 noise. No recordings, downloaded samples, SoundFonts, impulse responses, loops or third-party audio are read or embedded.',
    license: 'pending owner declaration (see packs/v12-signature-v1/PROVENANCE.md)',
    rateTable: Object.fromEntries(Array.from({ length: 49 }, (_, k) => k - 24).map(st => [String(st), rate(st)])),
    rateRule: 'playbackRate = 2^(semitones/12) relative to rootNote; pitch and duration change together (v0.7 has no time-stretch), so a source lasts seconds / playbackRate.',
    identity: {
      lowEnd: 'SUB HAMMER (+4 cycles), IRON PULSE (+3), CONVERGENCE (+6) and REACTOR/ABYSS (zero phase) all settle on A1 = 55 Hz in phase: trigger any of them on the same tick and the fundamentals add instead of cancelling.',
      chrome: { description: 'Minor-third bell (hum, prime, tierce, quint, nominal) plus eight inharmonic upper modes.', ratios: CHROME.map(m => Number(m.ratio.toFixed(6))), usedBy: ['chrome-strike', 'ghost-tick', 'open-circuit', 'titanium-crack', 'iron-pulse', 'ascension', 'convergence'] },
      ghostVowel: { description: 'Shared synthetic "oh" and "ah" formants [Hz, level, bandwidth Hz].', ...GHOST_VOWEL, usedBy: ['reactor', 'phantom', 'specter'] },
    },
    kit: { file: `${PACK.directory}/kit.json`, chokeGroups: { kick: ['sub-hammer', 'iron-pulse'], snare: ['titanium-crack'], hats: ['ghost-tick', 'open-circuit'] } },
    sounds: entries,
  };
}
export function generatePack(output = DEFAULT_OUTPUT): void {
  const directory = join(output, PACK.directory); mkdirSync(directory, { recursive: true });
  const entries = sounds.map((_, i) => { const bytes = synthesize(i); writeFileSync(join(directory, fileName(i)), bytes); return describe(i, bytes); });
  writeFileSync(join(directory, 'kit.json'), JSON.stringify({ formatVersion: 1, samples: entries.filter(s => s.kitPitch !== null).map(s => ({ name: s.id, pitch: s.kitPitch, file: s.file.split('/').at(-1) })) }, null, 2) + '\n');
  // Metadata lives outside assets/: discovery treats every asset JSON as a kit.
  writeFileSync(join(output, 'v12-signature.catalog.json'), JSON.stringify(catalog(entries), null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) generatePack(process.argv[2]);
