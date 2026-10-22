/** MORPH//01 — an isolated offline, deterministic, sample-free voice. */
export const SAMPLE_RATE = 44100;
export const CONTROL_DEFAULTS = Object.freeze({
  morph: 0.5, vowel: 0.5, brightness: 0.55, grit: 0.35,
  vibratoRate: 5.2, vibratoDepth: 9, attack: 0.08, release: 0.18,
  glide: 0, gain: 0.7, pitchCents: 0,
});
export const CONTROL_RANGES = Object.freeze({
  morph: [0, 1], vowel: [0, 1], brightness: [0, 1], grit: [0, 1],
  vibratoRate: [0, 12], vibratoDepth: [0, 100], attack: [0.001, 3],
  release: [0.005, 3], glide: [0, 2], gain: [0, 1], pitchCents: [-2400, 2400],
});
export const CONTROL_NAMES = Object.freeze(Object.keys(CONTROL_DEFAULTS));
const TAU = Math.PI * 2, BLOCK = 32, HARMONICS = 64, MODES = 6;
const smoothstep = x => x * x * (3 - 2 * x);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const midiToHz = midi => 440 * 2 ** ((midi - 69) / 12);

function object(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${path}: expected an object`);
}
function closed(value, names, path) {
  object(value, path);
  for (const key of Object.keys(value)) if (!names.includes(key)) throw new TypeError(`${path}.${key}: unknown field`);
}
function number(value, min, max, path) {
  if (!Number.isFinite(value) || value < min || value > max) throw new RangeError(`${path}: expected finite number in [${min}, ${max}]`);
  return value;
}
function controls(input = {}, path = 'controls') {
  closed(input, CONTROL_NAMES, path);
  const result = {};
  for (const key of Object.keys(input)) result[key] = number(input[key], ...CONTROL_RANGES[key], `${path}.${key}`);
  return result;
}
function pitch(note, hzKey, midiKey, required, path) {
  const hasHz = Object.hasOwn(note, hzKey), hasMidi = Object.hasOwn(note, midiKey);
  if (hasHz && hasMidi || required && !hasHz && !hasMidi) throw new TypeError(`${path}: supply exactly one of ${hzKey} or ${midiKey}`);
  if (hasHz) return number(note[hzKey], 27.5, midiToHz(108), `${path}.${hzKey}`);
  if (hasMidi) return midiToHz(number(note[midiKey], 21, 108, `${path}.${midiKey}`));
  return undefined;
}

/** Validate a closed JSON description; return an independent normalized object. */
export function validatePerformance(input) {
  closed(input, ['formatVersion', 'title', 'seconds', 'seed', 'controls', 'notes', 'automation'], 'performance');
  if (input.formatVersion !== 1) throw new TypeError('formatVersion: expected 1');
  if (typeof input.title !== 'string' || input.title.length < 1 || input.title.length > 200) throw new TypeError('title: expected 1..200 characters');
  const seconds = number(input.seconds, 0.01, 30, 'seconds');
  const seed = number(input.seed, 0, 0xffffffff, 'seed');
  if (!Number.isInteger(seed)) throw new RangeError('seed: expected an unsigned 32-bit integer');
  const base = {...CONTROL_DEFAULTS, ...controls(input.controls)};
  const automation = {};
  if (input.automation !== undefined) {
    closed(input.automation, CONTROL_NAMES, 'automation');
    for (const [key, points] of Object.entries(input.automation)) {
      if (!Array.isArray(points) || points.length < 1 || points.length > 2048) throw new RangeError(`automation.${key}: expected 1..2048 points`);
      let previous = -1;
      automation[key] = points.map((point, i) => {
        const path = `automation.${key}[${i}]`;
        closed(point, ['at', 'value'], path);
        const at = number(point.at, 0, seconds, `${path}.at`);
        if (at <= previous) throw new RangeError(`${path}.at: timestamps must increase strictly`);
        previous = at;
        return {at, value: number(point.value, ...CONTROL_RANGES[key], `${path}.value`)};
      });
    }
  }
  if (!Array.isArray(input.notes) || input.notes.length < 1 || input.notes.length > 128) throw new RangeError('notes: expected 1..128 notes');
  const notes = input.notes.map((note, i) => {
    const path = `notes[${i}]`;
    closed(note, ['at', 'duration', 'midi', 'hz', 'velocity', 'glideFromMidi', 'glideFromHz', 'controls'], path);
    const at = number(note.at, 0, seconds - 1 / SAMPLE_RATE, `${path}.at`);
    const duration = number(note.duration, 1 / SAMPLE_RATE, seconds, `${path}.duration`);
    if (at + duration > seconds + 1e-9) throw new RangeError(`${path}.duration: gate extends beyond performance`);
    const hz = pitch(note, 'hz', 'midi', true, path);
    const from = pitch(note, 'glideFromHz', 'glideFromMidi', false, path);
    const velocity = note.velocity === undefined ? 0.8 : number(note.velocity, 0, 1, `${path}.velocity`);
    return {at, duration, hz, velocity, ...(from === undefined ? {} : {glideFromHz: from}), controls: controls(note.controls, `${path}.controls`)};
  });
  // Budget actual voices including their release tails, not just gate overlap.
  const boundaries = [];
  for (const note of notes) {
    const release = note.controls.release ?? curveValue(automation.release, note.at, base.release);
    boundaries.push({at: Math.round(note.at * SAMPLE_RATE), delta: 1});
    boundaries.push({at: Math.min(Math.round(seconds * SAMPLE_RATE), Math.round((note.at + note.duration + release) * SAMPLE_RATE)), delta: -1});
  }
  boundaries.sort((a, b) => a.at - b.at || a.delta - b.delta);
  let active = 0;
  for (const point of boundaries) if ((active += point.delta) > 8) throw new RangeError('notes: more than eight simultaneous voices including releases');
  return {formatVersion: 1, title: input.title, seconds, seed, controls: base, notes, automation};
}

/** C1-continuous, time-addressed curve. Before first point use the base value. */
function curveValue(points, t, fallback) {
  if (!points?.length || t < points[0].at) return fallback;
  let lo = 0, hi = points.length - 1;
  if (t >= points[hi].at) return points[hi].value;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].at <= t) lo = mid; else hi = mid;
  }
  const a = points[lo], b = points[hi];
  return a.value + (b.value - a.value) * smoothstep((t - a.at) / (b.at - a.at));
}
function evaluate(performance, note, key, t) {
  return note.controls[key] ?? curveValue(performance.automation[key], t, performance.controls[key]);
}
function prng(seed) {
  let state = seed >>> 0 || 0x6d2b79f5;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 2147483648 - 1;
  };
}
// Standard singing-vowel regions; the F1/F2/F3 positions stay in Hz when pitch moves.
const VOWELS = [[350, 850, 2400], [450, 1000, 2600], [800, 1150, 2900], [500, 1850, 2600], [300, 2200, 3000]];
function formants(vowel) {
  const p = vowel * 4, i = Math.min(3, Math.floor(p)), f = smoothstep(p - i);
  return VOWELS[i].map((v, k) => v + (VOWELS[i + 1][k] - v) * f);
}
function guard(frequency) {
  // A guard region reserves margin for slow AM/FM sidebands; not an ideal brickwall.
  return 1 - smoothstep(clamp((frequency - SAMPLE_RATE * 0.35) / (SAMPLE_RATE * 0.08), 0, 1));
}
function spectralCoefficients(c, hz, target) {
  const m = c.morph;
  const glass = 1 - smoothstep(clamp(m * 2, 0, 1));
  const machine = smoothstep(clamp(m * 2 - 1, 0, 1));
  const voice = 1 - glass - machine;
  const form = formants(c.vowel);
  const cutoff = 1800 + c.brightness ** 1.5 * 14000;
  let energy = 0;
  for (let h = 1; h <= HARMONICS; h++) {
    const f = hz * h;
    const bright = 1 / Math.sqrt(1 + (f / cutoff) ** 6);
    const glassBody = h ** (-2.05 + c.brightness * 0.35) * (h % 2 === 0 ? 0.87 : 1);
    // A parallel formant spectral filter applied to periodic harmonic excitation.
    let resonances = 0;
    for (let k = 0; k < 3; k++) {
      const width = [160, 230, 330][k] + form[k] * 0.035;
      resonances += [1.9, 2.8, 1.5][k] / (1 + ((f - form[k]) / width) ** 2);
    }
    const voiceBody = h ** -0.92 * (0.10 + resonances) * (h % 2 === 0 ? 0.92 : 1);
    // Finite Fourier model of saturated excitation: strengthened odd partials,
    // plus a bounded metallic resonance comb. No time-domain nonlinear alias products.
    const odd = h % 2 === 1 ? 1 + 0.8 * c.grit : 0.66 - 0.30 * c.grit;
    const comb = 0.72 + 0.28 * Math.cos(h * (1.1 + 2.3 * c.grit));
    // Exact Fourier expansion of P(x)=(15x-10x^3+3x^5)/8 for x=sin(phi):
    // P(sin phi)=75/64 sin(phi)+25/128 sin(3phi)+3/128 sin(5phi).
    // Its fundamental is accounted for in the body; grit adds the nonlinear overtones.
    const drive = (h === 3 ? 25 / 128 : h === 5 ? 3 / 128 : 0) * c.grit;
    const machineBody = h ** (-1.12 + 0.32 * c.brightness) * odd * comb + drive;
    let a = (glass * glassBody + voice * voiceBody + machine * machineBody) * bright * guard(f * 1.065);
    // Keep the common fundamental audible across spectral identities.
    if (h === 1) a += 0.48 * (1 - glass) + 0.14 * glass;
    target[h - 1] = a;
    energy += a * a;
  }
  const scale = 0.82 / Math.sqrt(Math.max(energy, 1e-12));
  for (let h = 0; h < HARMONICS; h++) target[h] *= scale;
  return {glass, voice, machine, form};
}
function makeBandpass() { return {s1: 0, s2: 0, g: 0, a1: 0, a2: 0, a3: 0}; }
function tuneBandpass(state, frequency) {
  const g = Math.tan(Math.PI * Math.min(7000, frequency) / SAMPLE_RATE), k = 1.3;
  state.g = g; state.a1 = 1 / (1 + g * (g + k)); state.a2 = g * state.a1; state.a3 = g * state.a2;
}
function bandpass(state, input) {
  const v3 = input - state.s2, v1 = state.a1 * state.s1 + state.a2 * v3;
  const v2 = state.s2 + state.a2 * state.s1 + state.a3 * v3;
  state.s1 = 2 * v1 - state.s1; state.s2 = 2 * v2 - state.s2;
  return v1;
}

/** Pure render. No files, dependencies, wall clock, random global state or audio device. */
export function renderPerformance(input) {
  const performance = validatePerformance(input);
  const frames = Math.round(performance.seconds * SAMPLE_RATE);
  const samples = new Float64Array(frames);
  let voiceFrames = 0, maximumPartialHz = 0;
  for (let ni = 0; ni < performance.notes.length; ni++) {
    const note = performance.notes[ni];
    const start = Math.round(note.at * SAMPLE_RATE), gate = Math.round((note.at + note.duration) * SAMPLE_RATE);
    const attack = Math.max(1, Math.round(evaluate(performance, note, 'attack', note.at) * SAMPLE_RATE));
    const release = Math.max(2, Math.round(evaluate(performance, note, 'release', note.at) * SAMPLE_RATE));
    const stop = Math.min(frames, gate + release);
    const glide = evaluate(performance, note, 'glide', note.at);
    const from = note.glideFromHz ?? note.hz;
    const noise = prng((performance.seed ^ Math.imul(ni + 1, 0x9e3779b1)) >>> 0);
    const phases = new Float64Array(MODES);
    for (let k = 0; k < MODES; k++) phases[k] = noise() * Math.PI;
    let phase = 0, vibratoPhase = 0, lowNoise = 0;
    const c = {};
    for (const key of CONTROL_NAMES) c[key] = evaluate(performance, note, key, note.at);
    const coeff = new Float64Array(HARMONICS), nextCoeff = new Float64Array(HARMONICS);
    const coeffStep = new Float64Array(HARMONICS);
    const filters = [makeBandpass(), makeBandpass(), makeBandpass()];
    let identity = spectralCoefficients(c, from * 2 ** (c.pitchCents / 1200), coeff);
    const modeGain = new Float64Array(MODES), modeDelta = new Float64Array(MODES), modeGainStep = new Float64Array(MODES), modeDeltaStep = new Float64Array(MODES);
    let oldGlass = identity.glass, oldVoice = identity.voice, oldMachine = identity.machine;
    const gateAmplitude = Math.sin(Math.min(1, Math.max(0, gate - start) / attack) * Math.PI / 2) ** 2;
    voiceFrames += stop - start;
    for (let blockStart = start; blockStart < stop; blockStart += BLOCK) {
      const count = Math.min(BLOCK, stop - blockStart), blockTime = (blockStart + count / 2) / SAMPLE_RATE;
      const smoothing = 1 - Math.exp(-count / (SAMPLE_RATE * 0.004));
      const before = {...c};
      for (const key of CONTROL_NAMES) c[key] += smoothing * (evaluate(performance, note, key, blockTime) - c[key]);
      const localMid = (blockStart + count / 2 - start) / SAMPLE_RATE;
      const glideFraction = glide > 0 ? smoothstep(clamp(localMid / glide, 0, 1)) : 1;
      const fundamental = from * (note.hz / from) ** glideFraction * 2 ** (c.pitchCents / 1200);
      identity = spectralCoefficients(c, fundamental, nextCoeff);
      for (let h = 0; h < HARMONICS; h++) {
        coeffStep[h] = (nextCoeff[h] - coeff[h]) / count;
        if (nextCoeff[h] > 1e-5) maximumPartialHz = Math.max(maximumPartialHz, fundamental * (h + 1));
      }
      for (let k = 0; k < 3; k++) tuneBandpass(filters[k], identity.form[k]);
      const modeBlend = smoothstep(clamp(c.morph, 0, 1));
      const glassRatios = [2.003, 2.756, 4.113, 5.404, 8.933, 12.61];
      const machineRatios = [1.414, 2.732, 3.91, 5.87, 8.23, 11.2];
      for (let k = 0; k < MODES; k++) {
        const ratio = glassRatios[k] + (machineRatios[k] - glassRatios[k]) * modeBlend * c.grit;
        // Slow evolving metallic beating follows its own continuously integrated phases.
        const evolution = 1 + identity.machine * c.grit * (0.003 + k * 0.0015) * Math.sin(localMid * (0.72 + 0.137 * k));
        const freq = fundamental * ratio * evolution;
        const ratioTarget = freq / fundamental;
        if (blockStart === start) modeDelta[k] = ratioTarget;
        modeDeltaStep[k] = (ratioTarget - modeDelta[k]) / count;
        const level = [0.11, 0.095, 0.072, 0.052, 0.035, 0.023][k];
        const bow = 0.55 + 0.45 * (1 - Math.exp(-localMid * (1.5 + 0.13 * k)));
        const metal = 0.55 + c.grit * (1.1 + 0.3 * Math.sin(localMid * (1.4 + k * 0.21)));
        const gain = level * (identity.glass * bow + identity.machine * metal) * guard(freq * 1.065);
        modeGainStep[k] = (gain - modeGain[k]) / count;
        if (gain > 1e-5) maximumPartialHz = Math.max(maximumPartialHz, freq);
      }
      for (let j = 0; j < count; j++) {
        const i = blockStart + j, local = (i - start) / SAMPLE_RATE, blend = (j + 1) / count;
        const cc = key => before[key] + (c[key] - before[key]) * blend;
        const vibratoRate = cc('vibratoRate'), vibratoDepth = cc('vibratoDepth');
        vibratoPhase += TAU * vibratoRate / SAMPLE_RATE;
        if (vibratoPhase >= TAU) vibratoPhase -= TAU;
        const delayedVibrato = smoothstep(clamp(local / 0.22, 0, 1));
        const glideFractionNow = glide > 0 ? smoothstep(clamp(local / glide, 0, 1)) : 1;
        const hz = from * (note.hz / from) ** glideFractionNow * 2 ** ((cc('pitchCents') + Math.sin(vibratoPhase) * vibratoDepth * delayedVibrato) / 1200);
        const delta = TAU * hz / SAMPLE_RATE;
        // All identities share this carrier. Morphing never resets oscillator phase.
        const sin = Math.sin(phase), cos = Math.cos(phase);
        let sh = sin, ch = cos, harmonic = 0;
        for (let h = 0; h < HARMONICS; h++) {
          coeff[h] += coeffStep[h];
          // Instantaneous guard also covers large pitch glides/pitchCents jumps
          // between control frames; coefficients cannot briefly cross Nyquist.
          const f = hz * (h + 1);
          const a = coeff[h] * (f > SAMPLE_RATE * 0.35 ? guard(f) : 1);
          harmonic += a * sh;
          const ns = sh * cos + ch * sin;
          ch = ch * cos - sh * sin; sh = ns;
        }
        phase += delta;
        if (phase >= TAU) phase -= TAU;
        let modal = 0;
        for (let k = 0; k < MODES; k++) {
          modeGain[k] += modeGainStep[k];
          modeDelta[k] += modeDeltaStep[k];
          const modalHz = hz * modeDelta[k];
          modal += modeGain[k] * guard(modalHz * 1.065) * Math.sin(phases[k]);
          phases[k] += delta * modeDelta[k];
          if (phases[k] >= TAU) phases[k] %= TAU;
        }
        const white = noise();
        lowNoise += 0.43 * (white - lowNoise);
        const breath = 0.70 * bandpass(filters[0], lowNoise) + 0.46 * bandpass(filters[1], lowNoise) + 0.25 * bandpass(filters[2], lowNoise);
        const voiceWeight = oldVoice + (identity.voice - oldVoice) * blend;
        const machineWeight = oldMachine + (identity.machine - oldMachine) * blend;
        const glassWeight = oldGlass + (identity.glass - oldGlass) * blend;
        const breathGain = voiceWeight * (0.075 + cc('brightness') * 0.035) + machineWeight * cc('grit') * 0.025;
        // Bow pressure is a slow <1 Hz amplitude motion, not a pitch wobble.
        const bowPressure = 1 - glassWeight * 0.035 * (1 + Math.sin(local * 5.3));
        let envelope = i < gate
          ? Math.sin(Math.min(1, (i - start) / attack) * Math.PI / 2) ** 2
          : gateAmplitude * Math.cos(clamp((i - gate) / Math.max(1, stop - gate - 1), 0, 1) * Math.PI / 2) ** 2;
        if (i === start || i === stop - 1) envelope = 0;
        // If the gate runs to the output boundary, taper the last 8 ms instead of chopping.
        envelope *= smoothstep(clamp((frames - 1 - i) / (SAMPLE_RATE * 0.008), 0, 1));
        samples[i] += (harmonic * bowPressure + modal + breath * breathGain) * envelope * note.velocity * cc('gain') * 0.30;
      }
      oldGlass = identity.glass; oldVoice = identity.voice; oldMachine = identity.machine;
    }
  }
  samples[0] = 0; samples[frames - 1] = 0;
  let peak = 0, sumSquares = 0, clippedSamples = 0;
  for (const value of samples) {
    if (!Number.isFinite(value)) throw new RangeError('DSP produced non-finite output');
    peak = Math.max(peak, Math.abs(value)); sumSquares += value * value;
    if (value < -1 || value > 32767 / 32768) clippedSamples++;
  }
  return {samples, sampleRate: SAMPLE_RATE, frames, stats: {
    peak, rms: Math.sqrt(sumSquares / frames), clippedSamples, voiceFrames,
    maximumPartialHz, harmonicLimit: HARMONICS, controlBlockFrames: BLOCK,
  }};
}
