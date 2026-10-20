// V12 music analysis: harmonic/percussive separation by median filtering of the STFT, all
// circular over the 15 s loop, then grid-locked event detection per layer.
//
//   percussive 40–200 Hz   → kick        percussive 2–12 kHz → clap/snare   percussive 8–16 kHz → hats
//   harmonic 500–4000 Hz   → brass stabs (onsets) and brass phrases (sustained level)
//   harmonic 30–150 Hz     → bass envelope (separate from the kick transients)
//
// Ground truth for this track (three independent analyses, reconciled) is checked in
// tests/v12-audio.test.ts whenever the approved WAV is present.
import {BAR, BEAT, DURATION_IN_FRAMES, FPS, LOOP, STEP, STEPS} from '../../src/timeline.ts';

const N_FFT = 2048;
const HOP = 256;

/** In-place iterative radix-2 FFT. */
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

const median = (buf: Float64Array, n: number) => {
  // Insertion sort of a small window.
  for (let i = 1; i < n; i++) {
    const v = buf[i]!;
    let j = i - 1;
    while (j >= 0 && buf[j]! > v) {
      buf[j + 1] = buf[j]!;
      j--;
    }
    buf[j + 1] = v;
  }
  return buf[n >> 1]!;
};

export type Layers = {
  sr: number;
  hop: number;
  frames: number;
  /** dB per STFT frame for each layer. */
  db: Record<'kick' | 'clap' | 'hat' | 'brass' | 'bass' | 'full', Float64Array>;
};

/** Circular STFT + median-filter HPSS; returns per-frame layer energies in dB. */
export const separate = (mono: Float32Array, sr: number): Layers => {
  const n = mono.length;
  const frames = Math.round(n / HOP);
  const bins = N_FFT / 2 + 1;
  const mag = new Float64Array(frames * bins);
  const win = new Float64Array(N_FFT);
  for (let i = 0; i < N_FFT; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N_FFT);
  const re = new Float64Array(N_FFT);
  const im = new Float64Array(N_FFT);
  for (let f = 0; f < frames; f++) {
    const centre = f * HOP;
    for (let i = 0; i < N_FFT; i++) {
      const idx = (((centre - N_FFT / 2 + i) % n) + n) % n;
      re[i] = mono[idx]! * win[i]!;
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < bins; k++) mag[f * bins + k] = Math.hypot(re[k]!, im[k]!);
  }
  // Harmonic: median over ±8 frames (≈ 93 ms) per bin, circular in time.
  // Percussive: median over ±8 bins (≈ 370 Hz) per frame.
  const H = new Float64Array(frames * bins);
  const P = new Float64Array(frames * bins);
  const buf = new Float64Array(17);
  for (let f = 0; f < frames; f++) {
    for (let k = 0; k < bins; k++) {
      for (let d = -8; d <= 8; d++) buf[d + 8] = mag[(((f + d) % frames + frames) % frames) * bins + k]!;
      H[f * bins + k] = median(buf, 17);
      let c = 0;
      for (let d = -8; d <= 8; d++) {
        const kk = k + d;
        if (kk >= 0 && kk < bins) buf[c++] = mag[f * bins + kk]!;
      }
      P[f * bins + k] = median(buf, c);
    }
  }
  const hz = (k: number) => (k * sr) / N_FFT;
  const band = (lo: number, hi: number) => {
    const a = Math.max(1, Math.ceil((lo * N_FFT) / sr));
    const b = Math.min(bins - 1, Math.floor((hi * N_FFT) / sr));
    return [a, b] as const;
  };
  const layer = (which: 'H' | 'P' | 'X', lo: number, hi: number) => {
    const [a, b] = band(lo, hi);
    const out = new Float64Array(frames);
    for (let f = 0; f < frames; f++) {
      let e = 0;
      for (let k = a; k <= b; k++) {
        const s = mag[f * bins + k]!;
        const h = H[f * bins + k]!;
        const p = P[f * bins + k]!;
        const mask = which === 'X' ? 1 : which === 'H' ? (h * h) / (h * h + p * p + 1e-20) : (p * p) / (h * h + p * p + 1e-20);
        e += s * s * mask;
      }
      out[f] = 10 * Math.log10(e + 1e-12);
    }
    return out;
  };
  void hz;
  return {
    sr,
    hop: HOP,
    frames,
    db: {
      kick: layer('P', 40, 200),
      clap: layer('P', 2000, 12000),
      hat: layer('P', 8000, 16000),
      brass: layer('H', 500, 4000),
      bass: layer('H', 30, 150),
      full: layer('X', 30, 16000),
    },
  };
};

export type Event = {t: number; s: number; step: number; rise: number; level: number};

const r4 = (v: number) => Math.round(v * 10000) / 10000;
const wrapT = (t: number) => ((t % LOOP) + LOOP) % LOOP;

/**
 * Grid-locked onsets of one layer: for every sixteenth (±30 ms) the largest dB rise over the
 * preceding 12–30 ms; an event when the rise clears `minRise` dB and the peak level is within
 * `range` dB of the layer's loudest events. Strength is the peak's linear amplitude relative to
 * the loudest event, so loud and soft hits are told apart.
 */
export const gridOnsets = (L: Layers, key: keyof Layers['db'], minRise: number, range: number, offset = 0): Event[] => {
  const db = L.db[key];
  const dt = L.hop / L.sr;
  const at = (t: number) => db[((Math.round(wrapT(t) / dt) % L.frames) + L.frames) % L.frames]!;
  const cands: Event[] = [];
  for (let st = 0; st < STEPS; st++) {
    const g = st * STEP + offset;
    let best = -Infinity;
    let bestT = g;
    for (let d = -0.03; d <= 0.03 + 1e-9; d += dt) {
      let base = -Infinity;
      for (let b = 0.012; b <= 0.03; b += dt) base = Math.max(base, at(g + d - b));
      const rise = at(g + d) - base;
      if (rise > best) {
        best = rise;
        bestT = g + d;
      }
    }
    let level = -Infinity;
    for (let p = 0; p <= 0.045; p += dt) level = Math.max(level, at(bestT + p));
    cands.push({t: wrapT(bestT), s: 0, step: st, rise: best, level});
  }
  const top = Math.max(...cands.filter(c => c.rise >= minRise).map(c => c.level));
  return cands
    .filter(c => c.rise >= minRise && c.level >= top - range)
    .map(c => ({...c, t: r4(c.t), s: r4(Math.min(1, Math.max(0.05, Math.pow(10, (c.level - top) / 20)))), rise: r4(c.rise), level: r4(c.level)}));
};

/** Per video frame level of a layer, 0…1 over its top `range` dB, smoothed over `smooth` seconds. */
export const frameLevels = (L: Layers, key: keyof Layers['db'], range: number, smooth = 0.04) => {
  const db = L.db[key];
  const dt = L.hop / L.sr;
  const raw = Array.from({length: DURATION_IN_FRAMES}, (_, f) => {
    const t = f / FPS;
    let acc = 0;
    let c = 0;
    for (let s = -smooth / 2; s <= smooth / 2 + 1e-9; s += dt) {
      acc += Math.pow(10, db[((Math.round(wrapT(t + s) / dt) % L.frames) + L.frames) % L.frames]! / 10);
      c++;
    }
    return 10 * Math.log10(acc / c + 1e-12);
  });
  const top = [...raw].sort((a, b) => a - b)[Math.floor(raw.length * 0.99)]!;
  return raw.map(v => r4(Math.max(0, Math.min(1, (v - (top - range)) / range))));
};

/** Sustained brass: spans where the harmonic mid level stays near its top for at least `minLen` s. */
export const phrases = (levels: number[], threshold: number, minLen: number) => {
  const out: {start: number; end: number; s: number}[] = [];
  let start = -1;
  let acc = 0;
  for (let f = 0; f <= levels.length; f++) {
    const v = f < levels.length ? levels[f]! : 0;
    if (v >= threshold && start < 0) {
      start = f;
      acc = 0;
    }
    if (start >= 0) acc += v;
    if ((v < threshold || f === levels.length) && start >= 0) {
      const len = (f - start) / FPS;
      if (len >= minLen) out.push({start: r4(start / FPS), end: r4(Math.min(LOOP, f / FPS)), s: r4(Math.min(1, acc / (f - start)))});
      start = -1;
    }
  }
  return out;
};

const levelAt = (L: Layers, key: keyof Layers['db'], t: number) => {
  const dt = L.hop / L.sr;
  return L.db[key][((Math.round(wrapT(t) / dt) % L.frames) + L.frames) % L.frames]!;
};
/** Mean power (dB) of a layer over [a, b] seconds, circular. */
const meanDb = (L: Layers, key: keyof Layers['db'], a: number, b: number) => {
  const dt = L.hop / L.sr;
  let s = 0;
  let c = 0;
  for (let t = a; t <= b + 1e-9; t += dt) {
    s += Math.pow(10, levelAt(L, key, t) / 10);
    c++;
  }
  return 10 * Math.log10(s / c);
};

/**
 * Claps and snares, told apart from hats and brass attacks by their noise tail: mean percussive
 * 2–12 kHz power 30–80 ms after the sixteenth. Closed hats are gone within ~16 ms; claps and the
 * noise-snare fills still ring. Strength is linear amplitude relative to the loudest tail.
 */
export const tailHits = (L: Layers, withinDb: number): Event[] => {
  const rows = Array.from({length: STEPS}, (_, st) => ({st, body: meanDb(L, 'clap', st * STEP + 0.03, st * STEP + 0.08)}));
  const top = Math.max(...rows.map(r => r.body));
  return rows
    .filter(r => r.body >= top - withinDb)
    .map(r => ({t: r4(r.st * STEP), s: r4(Math.pow(10, (r.body - top) / 20)), step: r.st, rise: 0, level: r4(r.body)}));
};

/** Dropouts: spans where the whole mix collapses (per-frame loudness below `below` for ≥ `minLen` s). */
export const dropouts = (loudness: number[], below: number, minLen: number) => phrases(loudness.map(v => (v < below ? 1 : 0)), 0.5, minLen).map(({start, end}) => ({start, end, s: 1}));

/**
 * Structural accents, by explicit rules on the measured layers:
 *  - re-ignition: the first brass stab after each dropout;
 *  - payoff: the first on-beat kick after the longest stretch without on-beat kicks.
 * (No "loudest kick": an adversarial check found the groove kicks equal within a fraction of a dB.)
 */
export const structuralAccents = (kicks: Event[], brass: Event[], drops: {start: number; end: number}[]) => {
  const out: {t: number; s: number; why: string}[] = [];
  for (const d of drops) {
    const next = brass.filter(b => b.t >= d.end - 0.02).sort((a, b) => a.t - b.t)[0];
    if (next) out.push({t: next.t, s: 1, why: 're-ignition after dropout'});
  }
  const onBeat = kicks.filter(k => k.step % 4 === 0).sort((a, b) => a.step - b.step);
  let best = {gap: 0, t: -1};
  onBeat.forEach((k, i) => {
    const prev = onBeat[(i - 1 + onBeat.length) % onBeat.length]!;
    const gap = (k.step - prev.step + STEPS) % STEPS;
    if (gap > best.gap) best = {gap, t: k.t};
  });
  if (best.t >= 0) out.push({t: best.t, s: 1, why: 'payoff: on-beat kick returns'});
  return out.sort((a, b) => a.t - b.t);
};

/** Snap events onto their sixteenth (all onsets in this track sit within ±1 ms of the grid). */
export const snap = (events: Event[]) => events.map(e => ({...e, t: r4(e.step * STEP)}));

/** Merge phrases separated by less than `gap` seconds. */
export const mergePhrases = (ps: {start: number; end: number; s: number}[], gap: number) => {
  const out: {start: number; end: number; s: number}[] = [];
  for (const p of ps) {
    const last = out[out.length - 1];
    if (last && p.start - last.end < gap) {
      const la = last.end - last.start;
      const lb = p.end - p.start;
      last.s = r4((last.s * la + p.s * lb) / (la + lb));
      last.end = p.end;
    } else out.push({...p});
  }
  return out;
};

export const describe = (t: number) => `${Math.floor(t / BAR) + 1}:${Math.floor((t % BAR) / BEAT) + 1}:${Math.round((t % BEAT) / STEP) + 1}`;
