/** Numerical listening-support checks. These do not establish perceptual quality. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderPerformance, validatePerformance, midiToHz } from './synth.mjs';
import { encodeWav, analyzeWav } from './wav.mjs';

const SR = 44100;
const hash = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);
const db = amplitude => amplitude > 0 ? 20 * Math.log10(amplitude) : null;

export function fixture(overrides = {}) {
  return {
    formatVersion: 1, title: 'Engineering probe', seconds: 1.6, seed: 132041,
    controls: { morph: 0.5, vowel: 0.5, brightness: 0.65, grit: 0.55,
      vibratoRate: 0, vibratoDepth: 0, attack: 0.04, release: 0.12,
      glide: 0, gain: 0.55 },
    notes: [{ at: 0, duration: 1.35, midi: 61, velocity: 0.8 }],
    automation: {}, ...overrides,
  };
}

export function signalMetrics(samples, start = 0, end = samples.length) {
  start = Math.max(0, Math.floor(start)); end = Math.min(samples.length, Math.floor(end));
  let sum = 0, power = 0, peak = 0, delta = 0, curvature = 0, nonFinite = 0;
  for (let i = start; i < end; i++) {
    const x = samples[i];
    if (!Number.isFinite(x)) nonFinite++;
    sum += x; power += x * x; peak = Math.max(peak, Math.abs(x));
    if (i > start) delta = Math.max(delta, Math.abs(x - samples[i - 1]));
    if (i > start + 1) curvature = Math.max(curvature, Math.abs(x - 2 * samples[i - 1] + samples[i - 2]));
  }
  const n = Math.max(1, end - start);
  return { frames: end - start, mean: sum / n, rms: Math.sqrt(power / n),
    rmsDbfs: db(Math.sqrt(power / n)), peak, peakDbfs: db(peak),
    maxFirstDifference: delta, maxSecondDifference: curvature, nonFinite };
}

/** Hann-windowed complex projection with oscillator recurrence; independent of synth. */
export function magnitudeAt(samples, hz, startSeconds = 0.3, seconds = 0.8) {
  const start = Math.round(startSeconds * SR), n = Math.min(Math.round(seconds * SR), samples.length - start);
  const theta = 2 * Math.PI * hz / SR, cs = Math.cos(theta), sn = Math.sin(theta);
  let c = 1, s = 0, re = 0, im = 0, weights = 0;
  for (let i = 0; i < n; i++) {
    const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
    const x = samples[start + i] * w;
    re += x * c; im += x * s; weights += w;
    const next = c * cs - s * sn;
    s = s * cs + c * sn; c = next;
  }
  return Math.hypot(re, im) * 2 / weights;
}

export function estimateFundamental(samples, expectedHz) {
  let bestHz = expectedHz, best = -Infinity;
  for (let k = -24; k <= 24; k++) {
    const hz = expectedHz + k * 0.25;
    const energy = magnitudeAt(samples, hz);
    if (energy > best) { best = energy; bestHz = hz; }
  }
  return { hz: bestHz, cents: 1200 * Math.log2(bestHz / expectedHz), magnitude: best };
}

function spectrum(samples, hz) {
  const bins = Array.from({ length: 24 }, (_, i) => magnitudeAt(samples, hz * (i + 1)));
  const norm = Math.hypot(...bins);
  return bins.map(x => x / norm);
}

function distance(a, b) { return Math.hypot(...a.map((x, i) => x - b[i])); }

function curvaturePercentile(samples, start, end, fraction = 0.999, excludeCenter = null) {
  const values = [];
  for (let i = Math.max(2, start); i < Math.min(samples.length, end); i++) {
    if (excludeCenter !== null && Math.abs(i - excludeCenter) <= 8) continue;
    values.push(Math.abs(samples[i] - 2 * samples[i - 1] + samples[i - 2]));
  }
  values.sort((a, b) => a - b);
  return values[Math.min(values.length - 1, Math.floor(values.length * fraction))] ?? 0;
}

export function checkDeterminism() {
  const p = fixture(), a = renderPerformance(p), b = renderPerformance(clone(p));
  const first = encodeWav(a.samples, a.sampleRate), repeat = encodeWav(b.samples, b.sampleRate);
  assert.deepEqual(first, repeat, 'same input must produce byte-identical PCM WAV');
  const other = renderPerformance({ ...p, seed: p.seed + 1 });
  assert.notEqual(hash(first), hash(encodeWav(other.samples, other.sampleRate)), 'breath/phase seed must be effective');
  return { passed: true, runtime: process.version, platform: process.platform,
    architecture: process.arch, sha256: hash(first), repeatedSha256: hash(repeat) };
}

export function checkPitchAndTimbre() {
  const expected = midiToHz(61), pitches = [], spectra = [];
  for (const morph of [0, 0.5, 1]) {
    const p = fixture(); p.controls.morph = morph;
    const { samples } = renderPerformance(p);
    const pitch = estimateFundamental(samples, expected);
    assert.ok(Math.abs(pitch.cents) <= 5, `morph=${morph} F0 drift ${pitch.cents} cents`);
    assert.ok(pitch.magnitude > 0.001, 'fundamental must remain present');
    pitches.push({ morph, ...pitch }); spectra.push(spectrum(samples, expected));
  }
  const morphDistances = [distance(spectra[0], spectra[1]), distance(spectra[1], spectra[2])];
  for (const d of morphDistances) assert.ok(d > 0.08, `morph must alter harmonic spectrum: ${d}`);
  const vowels = [];
  for (const vowel of [0, 1]) {
    const p = fixture(); p.controls.vowel = vowel;
    const { samples } = renderPerformance(p);
    const pitch = estimateFundamental(samples, expected);
    assert.ok(Math.abs(pitch.cents) <= 5, `vowel must preserve fundamental: ${pitch.cents}`);
    vowels.push({ vowel, pitch, spectrum: spectrum(samples, expected) });
  }
  const vowelDistance = distance(vowels[0].spectrum, vowels[1].spectrum);
  assert.ok(vowelDistance > 0.15, `vowel control must change spectrum: ${vowelDistance}`);
  const low = fixture(); low.notes[0].midi = 49;
  const lowPitch = estimateFundamental(renderPerformance(low).samples, midiToHz(49));
  assert.ok(Math.abs(lowPitch.cents) <= 5, 'pitch control must transpose fundamental independently');
  return { passed: true, estimator: 'Hann-windowed first-harmonic projection, 0.25 Hz search steps',
    morphPitch: pitches, morphSpectralDistances: morphDistances,
    vowelPitch: vowels.map(({ vowel, pitch }) => ({ vowel, ...pitch })),
    vowelSpectralDistance: vowelDistance, lowerOctavePitch: lowPitch,
    limitation: 'F0 presence and relative harmonic spectra are numerical evidence; these checks do not prove vowel intelligibility or perceived identity.' };
}

export function checkTransitions() {
  const controls = { ...fixture().controls, morph: 0, gain: 0.55 };
  const p = fixture({ seconds: 2.1, controls,
    notes: [{ at: 0, duration: 1.9, midi: 61, velocity: 0.8 }],
    automation: { morph: [{ at: 0, value: 0 }, ...Array.from({ length: 50 }, (_, i) => ({ at: 0.2 + i * 0.03, value: i % 2 }))] },
  });
  const { samples } = renderPerformance(p), whole = signalMetrics(samples);
  assert.equal(whole.nonFinite, 0); assert.ok(whole.peak < 1, 'rapid morph must not clip');
  // A click is broadband. Bound curvature as well as slope; the thresholds are
  // conservative engineering gates for this C#4 probe, not universal audibility limits.
  assert.ok(whole.maxFirstDifference < 2.5 * whole.rms, `large adjacent-sample discontinuity: ${whole.maxFirstDifference}`);
  assert.ok(whole.maxSecondDifference < 1.5 * whole.rms, `large curvature impulse: ${whole.maxSecondDifference}`);
  const curvature999 = curvaturePercentile(samples, 0, samples.length);
  assert.ok(whole.maxSecondDifference < curvature999 * 3 + 1e-8, 'isolated broadband curvature outlier');
  const knots = p.automation.morph.slice(1).map(point => {
    const frame = Math.round(point.at * SR);
    return { at: point.at, frame,
      local: signalMetrics(samples, frame - 8, frame + 9),
      neighborhood99Curvature: curvaturePercentile(samples, frame - 600, frame + 601, 0.99, frame) };
  });
  for (const knot of knots) assert.ok(knot.local.maxSecondDifference <= knot.neighborhood99Curvature * 3 + 1e-7,
    `automation knot at ${knot.at} has an isolated broadband residual`);
  const sustained = fixture({ seconds: 3.5,
    notes: [{ at: 0, duration: 3.25, midi: 61, velocity: 0.8 }],
    automation: { morph: [{ at: 0, value: 0 }, { at: 3.1, value: 1 }] },
  });
  const slow = renderPerformance(sustained).samples, slowMetrics = signalMetrics(slow);
  assert.ok(slowMetrics.peak < 1); assert.ok(slowMetrics.maxSecondDifference < 1.5 * slowMetrics.rms);
  return { passed: true, rapid: whole, rapidCurvature999: curvature999, slow: slowMetrics,
    maximumKnotCurvature: Math.max(...knots.map(x => x.local.maxSecondDifference)),
    rapidKnotCount: knots.length,
    interpretation: 'No oversized sample-step or curvature impulse was found in these normal/rapid control probes. Human listening remains required for clicks, zipper noise and musical smoothness.' };
}

export function checkAmplitudeAndWav() {
  const levels = [];
  for (let i = 0; i <= 10; i++) {
    const p = fixture(); p.controls.morph = i / 10;
    const { samples, sampleRate } = renderPerformance(p);
    const metrics = signalMetrics(samples, 0.3 * SR, 1.1 * SR);
    assert.equal(metrics.nonFinite, 0); assert.ok(metrics.peak < 0.98);
    const bytes = encodeWav(samples, sampleRate), wav = analyzeWav(bytes);
    // Independently inspect minimal RIFF fields and PCM endpoints, too.
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
    assert.equal(bytes.readUInt16LE(20), 1); assert.equal(bytes.readUInt16LE(22), 1);
    assert.equal(bytes.readUInt32LE(24), SR); assert.equal(bytes.readUInt16LE(34), 16);
    assert.equal(bytes.readUInt32LE(40), Math.round(p.seconds * SR) * 2);
    assert.equal(bytes.length, 44 + Math.round(p.seconds * SR) * 2);
    assert.equal(bytes.readInt16LE(44), 0); assert.equal(bytes.readInt16LE(bytes.length - 2), 0);
    levels.push({ morph: i / 10, ...metrics });
    assert.ok(wav, 'WAV analyzer must accept canonical encoding');
  }
  const spanDb = Math.max(...levels.map(x => x.rmsDbfs)) - Math.min(...levels.map(x => x.rmsDbfs));
  assert.ok(spanDb < 5, `unintended morph-level swing: ${spanDb} dB`);
  const quiet = fixture(); quiet.notes[0].velocity = 0.2;
  const loud = fixture(); loud.notes[0].velocity = 0.8;
  const a = signalMetrics(renderPerformance(quiet).samples, 0.3 * SR, 1.1 * SR);
  const b = signalMetrics(renderPerformance(loud).samples, 0.3 * SR, 1.1 * SR);
  const dynamicDb = b.rmsDbfs - a.rmsDbfs;
  assert.ok(dynamicDb > 8, 'loudness compensation must retain musical dynamics');
  return { passed: true, levels, sustainedRmsSpanDb: spanDb, velocityDynamicRangeDb: dynamicDb,
    format: { encoding: 'PCM signed16 little endian', sampleRate: SR, channels: 1, endpointZero: true } };
}

export function checkValidation() {
  assert.ok(validatePerformance(fixture()));
  const invalid = [
    p => { p.seconds = 31; }, p => { p.seconds = Infinity; },
    p => { p.seed = -1; }, p => { p.seed = 0.25; },
    p => { p.controls.morph = NaN; }, p => { p.controls.morph = 1.01; },
    p => { p.controls.vibratoDepth = 101; }, p => { p.controls.pitchCents = 2401; },
    p => { p.notes[0].hz = 100; }, p => { p.notes[0].at = -0.1; },
    p => { p.notes[0].duration = 0; }, p => { p.notes[0].midi = 200; },
    p => { p.notes = Array.from({ length: 129 }, () => clone(p.notes[0])); },
    p => { p.notes = Array.from({ length: 9 }, () => clone(p.notes[0])); },
    p => { p.automation.morph = [{ at: 0.2, value: 0 }, { at: 0.1, value: 1 }]; },
    p => { p.automation.morph = [{ at: 0.1, value: 0 }, { at: 0.1, value: 1 }]; },
    p => { p.automation.morph = [{ at: 0.1, value: Infinity }]; },
    p => { p.controls.unsupported = 1; }, p => { p.notes[0].surprise = true; },
  ];
  for (const [i, mutate] of invalid.entries()) {
    const p = fixture(); mutate(p);
    assert.throws(() => validatePerformance(p), `unsafe input ${i} accepted`);
  }
  return { passed: true, invalidCases: invalid.length,
    configuredBounds: { maximumSeconds: 30, maximumNotes: 128, maximumConcurrentVoicesIncludingRelease: 8 } };
}

export function checkResourceBounds() {
  const child = spawnSync(process.execPath,
    ['--max-old-space-size=128', fileURLToPath(import.meta.url), '--stress-child'],
    { encoding: 'utf8', timeout: 60000, maxBuffer: 32768 });
  assert.ifError(child.error);
  assert.equal(child.status, 0, `bounded stress renderer failed: ${child.error ?? child.stderr}`);
  const measured = JSON.parse(child.stdout);
  assert.ok(measured.wallSeconds < 60, 'stress render exceeded bounded wall budget');
  assert.ok(measured.maximumRssBytes < 384 * 1024 * 1024, 'stress RSS exceeded budget');
  assert.ok(measured.peak < 1, 'maximum supported polyphony must not clip at configured gain');
  return { passed: true, ...measured, enforcedChildHeapMiB: 128,
    childWallTimeoutSeconds: 60, measuredRssBudgetMiB: 384,
    limitation: 'Elapsed time and RSS are host measurements, not a realtime or cross-platform performance guarantee.' };
}

export function runVerification({ stress = true } = {}) {
  return { schemaVersion: 1, instrument: 'MORPH//01', runtime: process.version,
    platform: process.platform, architecture: process.arch,
    checks: { determinism: checkDeterminism(), pitchAndTimbre: checkPitchAndTimbre(),
      transitions: checkTransitions(), amplitudeAndWav: checkAmplitudeAndWav(),
      validation: checkValidation(), ...(stress ? { resources: checkResourceBounds() } : {}) },
    listeningRequired: true,
    perceptualClaim: 'No automated result establishes perceptual smoothness, vocal realism or musical quality.' };
}

if (process.argv[2] === '--stress-child') {
  const p = fixture({ seconds: 30, controls: { ...fixture().controls, morph: 0.9, gain: 0.38 },
    notes: Array.from({ length: 8 }, (_, i) => ({ at: 0, duration: 29.7, midi: 45 + i * 3, velocity: 0.45 })) });
  const start = performance.now(), cpuStart = process.cpuUsage();
  const rendered = renderPerformance(p), cpu = process.cpuUsage(cpuStart);
  console.log(JSON.stringify({ seconds: p.seconds, concurrentVoices: 8, frames: rendered.frames,
    wallSeconds: (performance.now() - start) / 1000, cpuSeconds: (cpu.user + cpu.system) / 1e6,
    maximumRssBytes: process.resourceUsage().maxRSS * 1024,
    peak: signalMetrics(rendered.samples).peak, pcmSha256: hash(encodeWav(rendered.samples, SR)) }));
} else if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(JSON.stringify(runVerification(), null, 2));
}
