// Audio → PromoData. Pure functions over decoded PCM; the CLI lives in analyze-stems.ts.
//
// Envelopes: RMS per video frame (window 1/30 s centred on the frame), normalized to the
// track's loudest frame and compressed with exponent 0.65 so tails stay visible.
// Onsets: exact DaemonV12 sample triggers when a render manifest is given; otherwise
// detected from the stem (log-energy rise, peak-picked, refined to the first sample that
// crosses 25% of the local peak).
// Spectrum: 2048-point Hann FFT per video frame, 8 log bands, 60 dB range per band.
// Stops: master silences longer than a 1/16 note become stop markers.
import type {AutomationLane, Envelope, Marker, Onset, PromoData, SampleId, StemId} from '../../src/data/contract.ts';
import {SAMPLE_IDS, SCHEMA_ID, STEM_IDS} from '../../src/data/contract.ts';
import {ACTS} from '../../src/timeline/acts.ts';
import {DURATION_SECONDS, FPS, SECONDS_PER_BEAT} from '../../src/timeline/grid.ts';

export const ENVELOPE_RATE = FPS;
export const ENVELOPE_GAMMA = 0.65;
export const BAND_EDGES_HZ = [20, 60, 150, 400, 1000, 2500, 6000, 12000, 20000];
const round = (v: number, digits = 4) => Math.round(v * 10 ** digits) / 10 ** digits;

/** RMS per video frame, normalized and gamma-compressed, covering 0…24 s inclusive. */
export const envelopeOf = (samples: Float32Array, sampleRate: number): Envelope => {
  const count = ENVELOPE_RATE * DURATION_SECONDS + 1;
  const half = Math.round(sampleRate / (ENVELOPE_RATE * 2));
  const rms = new Float64Array(count);
  let max = 0;
  for (let i = 0; i < count; i++) {
    const centre = Math.round((i * sampleRate) / ENVELOPE_RATE);
    let sum = 0;
    let n = 0;
    for (let k = Math.max(0, centre - half); k < Math.min(samples.length, centre + half); k++) {
      sum += samples[k]! * samples[k]!;
      n++;
    }
    rms[i] = n ? Math.sqrt(sum / n) : 0;
    max = Math.max(max, rms[i]!);
  }
  return {rate: ENVELOPE_RATE, values: Array.from(rms, v => (max > 0 ? round(Math.pow(v / max, ENVELOPE_GAMMA)) : 0))};
};

export type DetectOptions = {
  /** Minimum rise in dB over ~9 ms to count as an onset. */
  riseDb?: number;
  /** Ignore material more than this many dB below the stem's loudest window. */
  floorDb?: number;
  /** Minimum gap between onsets in seconds. */
  minGap?: number;
};

/** Energy-rise onset detection, refined to sample accuracy. */
export const detectOnsets = (samples: Float32Array, sampleRate: number, {riseDb = 9, floorDb = 42, minGap = 0.035}: DetectOptions = {}): Onset[] => {
  const hop = 128;
  const win = 512;
  const frames = Math.max(0, Math.floor((samples.length - win) / hop));
  const logE = new Float64Array(frames);
  let maxLog = -Infinity;
  for (let n = 0; n < frames; n++) {
    let sum = 0;
    for (let k = n * hop; k < n * hop + win; k++) sum += samples[k]! * samples[k]!;
    logE[n] = 10 * Math.log10(sum / win + 1e-12);
    maxLog = Math.max(maxLog, logE[n]!);
  }
  const lag = 3;
  const flux = new Float64Array(frames);
  // Frames before the file start count as digital silence, so a hit on sample 0 is found.
  const before = (n: number) => (n < 0 ? -120 : logE[n]!);
  for (let n = 0; n < frames; n++) flux[n] = Math.max(0, logE[n]! - Math.min(before(n - lag), before(n - lag + 1)));
  const candidates: {sample: number; peak: number}[] = [];
  let lastSample = -Infinity;
  for (let n = 0; n < frames; n++) {
    const f = flux[n]!;
    if (f < riseDb || logE[n]! < maxLog - floorDb) continue;
    let isPeak = true;
    for (let k = Math.max(0, n - 4); k <= Math.min(frames - 1, n + 4); k++) if (flux[k]! > f || (flux[k] === f && k < n)) isPeak = false;
    if (!isPeak) continue;
    // Refine: first sample crossing 25% of the local peak, searching back from this frame.
    const from = Math.max(0, (n - lag - 1) * hop);
    const to = Math.min(samples.length, n * hop + win + Math.round(0.02 * sampleRate));
    let peak = 0;
    for (let k = from; k < to; k++) peak = Math.max(peak, Math.abs(samples[k]!));
    let onset = from;
    for (let k = from; k < to; k++) {
      if (Math.abs(samples[k]!) >= peak * 0.25) {
        onset = k;
        break;
      }
    }
    if (onset - lastSample < minGap * sampleRate) continue;
    candidates.push({sample: onset, peak});
    lastSample = onset;
  }
  const strongest = Math.max(1e-9, ...candidates.map(c => c.peak));
  return candidates
    .filter(c => c.sample / sampleRate < DURATION_SECONDS)
    .map(c => ({t: round(c.sample / sampleRate, 6), strength: round(Math.min(1, c.peak / strongest), 3)}));
};

// ------------------------------------------------------------------ spectrum

const fft = (re: Float64Array, im: Float64Array) => {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b]! * cr - im[b]! * ci;
        const ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
};

export const spectrumOf = (samples: Float32Array, sampleRate: number) => {
  const size = 2048;
  const count = ENVELOPE_RATE * DURATION_SECONDS + 1;
  const bands = BAND_EDGES_HZ.length - 1;
  const hann = Float64Array.from({length: size}, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
  const bandOf = new Int32Array(size / 2).fill(-1);
  for (let bin = 1; bin < size / 2; bin++) {
    const hz = (bin * sampleRate) / size;
    for (let b = 0; b < bands; b++) if (hz >= BAND_EDGES_HZ[b]! && hz < BAND_EDGES_HZ[b + 1]!) bandOf[bin] = b;
  }
  const db: number[][] = [];
  const bandMax = new Array<number>(bands).fill(-Infinity);
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let i = 0; i < count; i++) {
    const centre = Math.round((i * sampleRate) / ENVELOPE_RATE);
    for (let k = 0; k < size; k++) {
      const s = centre - size / 2 + k;
      re[k] = (s >= 0 && s < samples.length ? samples[s]! : 0) * hann[k]!;
      im[k] = 0;
    }
    fft(re, im);
    const energy = new Array<number>(bands).fill(0);
    for (let bin = 1; bin < size / 2; bin++) {
      const b = bandOf[bin]!;
      if (b >= 0) energy[b]! += re[bin]! * re[bin]! + im[bin]! * im[bin]!;
    }
    const row = energy.map(e => 10 * Math.log10(e + 1e-12));
    row.forEach((v, b) => (bandMax[b] = Math.max(bandMax[b]!, v)));
    db.push(row);
  }
  const values = db.map(row => row.map((v, b) => round(Math.min(1, Math.max(0, (v - (bandMax[b]! - 60)) / 60)), 3)));
  return {rate: ENVELOPE_RATE, bandEdgesHz: BAND_EDGES_HZ, values};
};

// ------------------------------------------------------------------ manifest triggers

export type RenderManifest = {
  samples?: {tracks?: {trackId: string; triggers: {file: string; tick: number; frame: number; velocity: number}[]}[]; assets?: {file: string; frames?: number; sampleRate?: number}[]};
};

const sampleIdOf = (file: string): SampleId | undefined => {
  const base = file.split('/').pop()!.replace(/\.wav$/i, '').replace(/^\d+-/, '');
  return (SAMPLE_IDS as readonly string[]).includes(base) ? (base as SampleId) : undefined;
};

/** Exact onsets from a DaemonV12 render manifest (frames at 44.1 kHz), merged per stem. */
export type TrackSelector = {tracks: string[]; samples?: string[]};

export const onsetsFromManifest = (manifest: RenderManifest, selector: TrackSelector, sampleRate = 44100): Onset[] => {
  const assets = new Map((manifest.samples?.assets ?? []).map(a => [a.file, a]));
  const triggers = (manifest.samples?.tracks ?? [])
    .filter(t => selector.tracks.includes(t.trackId))
    .flatMap(t => t.triggers)
    .filter(trigger => !selector.samples || selector.samples.some(s => trigger.file.includes(s)));
  const strongest = Math.max(1e-9, ...triggers.map(t => t.velocity));
  return triggers
    .map(trigger => {
      const onset: Onset = {t: round(trigger.frame / sampleRate, 6), strength: round(trigger.velocity / strongest, 3)};
      const sample = sampleIdOf(trigger.file);
      if (sample) onset.sample = sample;
      const frames = assets.get(trigger.file)?.frames;
      if (frames) onset.duration = round(frames / (assets.get(trigger.file)?.sampleRate ?? sampleRate), 6);
      return onset;
    })
    .filter(o => o.t < DURATION_SECONDS)
    .sort((a, b) => a.t - b.t);
};

// ------------------------------------------------------------------ structure

/** Locked sections plus silences found in the master. */
export const markersFrom = (master: Envelope, extra: Marker[] = []): Marker[] => {
  const markers: Marker[] = ACTS.map(a => ({t: a.from / FPS, kind: a.id.startsWith('drop') ? ('drop' as const) : ('section' as const), id: a.id, label: a.title}));
  const quiet = 0.04;
  const minimum = SECONDS_PER_BEAT / 4;
  let start = -1;
  let stops = 0;
  // Authored stops (structure.json) win over detected ones.
  const detect = !extra.some(m => m.kind === 'stop');
  for (let i = 0; detect && i <= master.values.length; i++) {
    const silent = i < master.values.length && master.values[i]! < quiet;
    if (silent && start < 0) start = i;
    if (!silent && start >= 0) {
      const t0 = start / master.rate;
      const t1 = i / master.rate;
      if (t1 - t0 >= minimum && t0 > 0.25 && t1 < DURATION_SECONDS - 0.25) {
        markers.push({t: round(t0, 6), kind: 'stop', id: `stop.${++stops}`, label: 'STOP', duration: round(t1 - t0, 6)});
      }
      start = -1;
    }
  }
  const ids = new Set(markers.map(m => m.id));
  for (const m of extra) if (!ids.has(m.id)) markers.push(m);
  return markers.sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));
};

export type AnalysisInput = {
  sampleRate: number;
  master: Float32Array;
  stems: Record<StemId, Float32Array>;
  /** Exact onsets per stem from a manifest; others are detected. */
  onsets?: Partial<Record<StemId, Onset[]>>;
  automation?: AutomationLane[];
  markers?: Marker[];
  source?: PromoData['source'];
};

export const analyze = (input: AnalysisInput): PromoData => {
  const masterEnvelope = envelopeOf(input.master, input.sampleRate);
  const stems = {} as PromoData['stems'];
  for (const id of STEM_IDS) {
    stems[id] = {
      envelope: envelopeOf(input.stems[id], input.sampleRate),
      onsets: input.onsets?.[id] ?? detectOnsets(input.stems[id], input.sampleRate, id === 'sub' ? {riseDb: 6, minGap: 0.06} : {}),
    };
  }
  return {
    schema: SCHEMA_ID,
    source: input.source ?? {kind: 'analysis', generator: 'scripts/analyze-stems.ts'},
    timing: {bpm: 160, beatsPerBar: 4, bars: 16, durationSeconds: DURATION_SECONDS},
    master: {envelope: masterEnvelope},
    stems,
    spectrum: spectrumOf(input.master, input.sampleRate),
    automation: input.automation ?? [],
    markers: markersFrom(masterEnvelope, input.markers),
  };
};
