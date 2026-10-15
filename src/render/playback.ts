// Sample performance: one voice read from its source at a playback rate. Sees PCM and frame
// numbers only. Rate changes pitch and duration together; nothing here time-stretches.
import { playbackRateRange } from '../audio-types.ts';
import type { Pcm } from './pcm.ts';

// Offset is a whole source frame. A glide moves the rate linearly over `frames` output frames, then holds.
export interface VoicePlayback { rate: number; offset: number; glide?: { to: number; frames: number } }
// Source end is exclusive; stop starts release in output frames. All envelope times are
// output frames, independent of rate. Omission preserves the historical one-shot path.
export interface VoiceArticulation { end?: number; stop?: number; attack: number; release: number }
const ZERO_CROSSINGS = 32, TABLE_STEPS = 512, BETA = 8.5, CUTOFF = 0.92;

function validRate(rate: number): boolean { return Number.isFinite(rate) && rate >= playbackRateRange[0] && rate <= playbackRateRange[1]; }
function check(pcm: Pcm, playback: VoicePlayback): void {
  const { rate, offset, glide } = playback;
  if (!validRate(rate) || !Number.isSafeInteger(offset) || offset < 0 || offset >= pcm.frames
    || (glide && (!validRate(glide.to) || !Number.isSafeInteger(glide.frames) || glide.frames < 1)))
    throw new RangeError('Invalid sample playback.');
}
// Source read position of output frame n: the offset plus the closed-form integral of the rate.
// Each frame is computed independently, so no rounding accumulates along the voice.
export function playbackPosition(playback: VoicePlayback, n: number): number {
  const { rate, offset, glide } = playback;
  if (!glide) return offset + rate * n;
  if (n <= glide.frames) return offset + n * (rate + (glide.to - rate) * n / (2 * glide.frames));
  return offset + glide.frames * (rate + glide.to) / 2 + (n - glide.frames) * glide.to;
}
export function playbackRateAt(playback: VoicePlayback, n: number): number {
  const { rate, glide } = playback;
  return !glide ? rate : n < glide.frames ? rate + (glide.to - rate) * n / glide.frames : glide.to;
}
// A voice lasts until its read position reaches the source end: the first such frame is not played.
export function voiceFrames(pcm: Pcm, playback?: VoicePlayback, articulation?: VoiceArticulation): number {
  if (articulation) {
    const offset = playback?.offset ?? 0, end = articulation.end === undefined ? pcm.frames : articulation.end;
    if (!Number.isSafeInteger(end) || end <= offset || end > pcm.frames
      || !Number.isSafeInteger(articulation.attack) || articulation.attack < 0
      || !Number.isSafeInteger(articulation.release) || articulation.release < 0
      || (articulation.stop !== undefined && (!Number.isSafeInteger(articulation.stop) || articulation.stop < 0)))
      throw new RangeError('Invalid sample articulation.');
    const natural = voiceFrames({ ...pcm, frames: end }, playback);
    return Math.min(natural, articulation.stop === undefined ? Infinity : articulation.stop + articulation.release);
  }
  if (!playback) return pcm.frames;
  check(pcm, playback);
  const { rate, offset, glide } = playback, remaining = pcm.frames - offset;
  let n: number;
  if (!glide) n = Math.ceil(remaining / rate);
  else if (playbackPosition(playback, glide.frames) >= pcm.frames) {
    const slope = (glide.to - rate) / glide.frames;
    n = Math.ceil(2 * remaining / (rate + Math.sqrt(Math.max(0, rate * rate + 2 * slope * remaining))));
  } else n = glide.frames + Math.ceil((pcm.frames - playbackPosition(playback, glide.frames)) / glide.to);
  // The estimate only seeds the search; the exact position function decides the length.
  if (!Number.isSafeInteger(n) || n < 1) n = 1;
  while (n > 1 && playbackPosition(playback, n - 1) >= pcm.frames) n--;
  while (playbackPosition(playback, n) < pcm.frames) n++;
  return n;
}

// sin(pi x) and the Kaiser window from IEEE-754 basic arithmetic only: no platform math library
// enters the kernel, so performed voices are bit-identical across platforms and runtimes.
function sinPi(x: number): number {
  let r = x % 2, sign = 1;
  if (r >= 1) { r -= 1; sign = -1; }
  if (r > 0.5) r = 1 - r;
  const t = Math.PI * r, t2 = t * t;
  let term = t, sum = t;
  for (let k = 1; k <= 12; k++) { term *= -t2 / ((2 * k) * (2 * k + 1)); sum += term; }
  return sign * sum;
}
function besselI0Squared(z2: number): number {
  let sum = 1, term = 1;
  for (let k = 1; k <= 40; k++) { term *= z2 / (4 * k * k); sum += term; }
  return sum;
}
let table: Float64Array | undefined;
// One side of the windowed sinc, TABLE_STEPS entries per zero crossing; exact zeros at crossings.
function kernel(): Float64Array {
  if (table) return table;
  const last = ZERO_CROSSINGS * TABLE_STEPS, values = new Float64Array(last + 2), norm = besselI0Squared(BETA * BETA);
  for (let j = 0; j < last; j++) {
    const x = j / TABLE_STEPS, r = j / last;
    const sinc = j === 0 ? 1 : j % TABLE_STEPS === 0 ? 0 : sinPi(x) / (Math.PI * x);
    values[j] = sinc * besselI0Squared(BETA * BETA * (1 - r * r)) / norm;
  }
  return table = values;
}
// Band-limited interpolation at a fractional read position. The cutoff follows the instantaneous
// rate (CUTOFF x min(1, 1/rate) of the source Nyquist) to suppress aliasing when pitching up and
// imaging when pitching down. Weights are normalized for exact unity gain at DC. Outside the
// source the signal is silence. Values stay in signed-16 units, unrounded.
function interpolate(pcm: Pcm, playback: VoicePlayback, frames: number, articulation?: VoiceArticulation): Float64Array {
  const values = kernel(), last = ZERO_CROSSINGS * TABLE_STEPS, { channels, samples } = pcm;
  const output = new Float64Array(frames * channels);
  for (let n = 0; n < frames; n++) {
    const position = playbackPosition(playback, n), cutoff = CUTOFF * Math.min(1, 1 / playbackRateAt(playback, n));
    const span = ZERO_CROSSINGS / cutoff, step = cutoff * TABLE_STEPS;
    let weights = 0, left = 0, right = 0;
    for (let k = Math.ceil(position - span), end = Math.floor(position + span); k <= end; k++) {
      const u = Math.abs(k - position) * step, j = Math.floor(u);
      if (j >= last) continue;
      const weight = values[j]! + (values[j + 1]! - values[j]!) * (u - j);
      weights += weight;
      // An explicit slice isolates both edges. V0.6 offset-only voices retain their
      // neighboring interpolation taps, including samples preceding the offset.
      if (k < (articulation?.end === undefined ? 0 : playback.offset) || k >= (articulation?.end ?? pcm.frames)) continue;
      left += weight * samples[k * channels]!;
      if (channels === 2) right += weight * samples[k * 2 + 1]!;
    }
    output[n * channels] = left / weights;
    if (channels === 2) output[n * 2 + 1] = right / weights;
  }
  return output;
}
// Pre-flight cost of one voice as `interpolate` would perform it, at most `limit` frames.
// work: kernel taps evaluated, i.e. frames x taps per frame, with taps bounded by the fastest
// rate the voice reaches (pitching up widens the kernel). A second channel shares the weights
// and costs about 5% more, so work counts taps, not channels. bytes: the Float64 buffer
// allocated for the voice, frames x channels x 8. Unperformed voices and rate 1 without a glide
// read the source in place and cost neither.
export function voiceCost(pcm: Pcm, playback?: VoicePlayback, limit = Infinity, articulation?: VoiceArticulation): { work: number; bytes: number } {
  if (articulation) voiceFrames(pcm, playback, articulation);
  if (!playback || (playback.rate === 1 && !playback.glide)) return { work: 0, bytes: 0 };
  const frames = Math.max(0, Math.min(limit, voiceFrames(pcm, playback, articulation)));
  const fastest = Math.max(playback.rate, articulation ? playbackRateAt(playback, Math.max(0, frames - 1)) : playback.glide?.to ?? playback.rate);
  const taps = Math.ceil(2 * ZERO_CROSSINGS / (CUTOFF * Math.min(1, 1 / fastest))) + 1;
  return { work: frames * taps, bytes: frames * pcm.channels * 8 };
}
// Render budget for performed voices, checked before any audio work: one billion kernel taps
// (about 9 s of interpolation at the measured ~9 ns per tap) and 128 MiB per voice buffer.
export const PLAYBACK_WORK_LIMIT = 1_000_000_000, PLAYBACK_VOICE_BYTES_LIMIT = 128 * 1024 * 1024;
// The voice's source values in the source's channel layout, at most `limit` frames. Without
// playback this is the source itself; rate 1 without a glide copies source frames exactly.
export function voiceSamples(pcm: Pcm, playback?: VoicePlayback, limit = Infinity, articulation?: VoiceArticulation): Int16Array | Float64Array {
  if (!playback && !articulation) return pcm.samples;
  const frames = Math.max(0, Math.min(limit, voiceFrames(pcm, playback, articulation)));
  playback ??= { rate: 1, offset: 0 };
  if (playback.rate === 1 && !playback.glide) return pcm.samples.subarray(playback.offset * pcm.channels, (playback.offset + frames) * pcm.channels);
  return interpolate(pcm, playback, frames, articulation);
}
// Linear fades never amplify. Freeze an unfinished attack at gate release onset;
// compress overlapping ramps when source/output exhaustion preempts a release.
// The actual final frame is zero, including a production cap. Zero seconds
// deliberately disables that fade.
export function voiceGain(articulation: VoiceArticulation | undefined, n: number, frames: number): number {
  if (!articulation) return 1;
  const attack = (frame: number) => articulation.attack === 0 ? 1 : Math.min(1, frame / articulation.attack);
  if (articulation.release === 0) return attack(n);
  const start = Math.max(0, frames - articulation.release), span = frames - 1 - start;
  // If source exhaustion or an output cap makes the ramps overlap, fit both
  // fades into the available intervals. Retain the authored attack's level
  // at the compressed peak instead of boosting a short slice to unity gain.
  // A complete scheduled gate/choke release keeps its musical onset and level.
  if (start < articulation.attack && (articulation.stop === undefined || frames < articulation.stop + articulation.release)) {
    if (frames <= 2) return 0;
    if (articulation.stop === 0) return 0;
    const peakFrame = Math.min(articulation.stop ?? Infinity, Math.max(1, Math.min(frames - 2,
      Math.floor((frames - 1) * articulation.attack / (articulation.attack + Math.max(1, articulation.release - 1)) + 0.5))));
    const peak = attack(peakFrame);
    return n <= peakFrame ? peak * n / peakFrame : peak * (frames - 1 - n) / (frames - 1 - peakFrame);
  }
  if (n < start) return attack(n);
  return span <= 0 ? 0 : attack(start) * Math.max(0, (frames - 1 - n) / span);
}
export const articulationRenderer = { name: 'daemonv12-articulation', version: '1', settings: {
  source: 'exclusive source end; explicit slice silences interpolation taps outside [offset,end); V0.6 interpolation unchanged otherwise',
  envelope: 'linear output-frame attack from zero; a scheduled gate/choke release freezes attack gain at its onset; source/output exhaustion compresses overlapping fades proportionally, retaining the authored attack level at the peak and never delaying a gate; last rendered frame reaches zero; defaults 1ms attack, 5ms release; explicit zero disables a fade',
  stop: 'gate or earliest later same-track choke onset starts release; stop + release capped by source exhaustion and permitted audio boundary; no source extension',
  choke: 'track-local group; equal output-frame onsets coexist; each older voice uses its own release; a release already started is never restarted',
  rounding: 'seconds to exact microseconds then nearest frame, ties later; gate via difference of rounded absolute musical boundaries',
} };
export const playbackRenderer = { name: 'daemonv12-playback', version: '1', settings: {
  rate: `${playbackRateRange[0]} through ${playbackRateRange[1]}; pitch and duration change together; no time-stretching`,
  interpolation: `band-limited Kaiser-windowed sinc, ${ZERO_CROSSINGS} zero crossings per side, beta ${BETA}, ${TABLE_STEPS} table steps per crossing with linear table interpolation; cutoff ${CUTOFF} x min(1, 1/rate) of source Nyquist; weights normalized to unity DC gain; silence outside the source; kernel from IEEE-754 basic arithmetic`,
  glide: 'rate linear in output frames from playbackRate to glide.to over the glide frames, then held; read position is the closed-form integral per frame',
  offset: 'whole source frame: offsetSeconds as microseconds * 44100 / 1000000, nearest frame, ties later',
  exactPath: 'rate 1 without glide copies source frames from the offset; no interpolation',
  end: 'voice stops at the first output frame whose read position reaches the source length; no fades',
  velocity: 'round(value * velocity) per voice sample, as for unperformed voices',
} };
