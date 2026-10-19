// Transient and energy analysis of a seamless loop, locked to the known grid.
//
// The track is a 15 s loop at 128 BPM, so analysis treats the audio as circular: the last second
// is prepended before filtering, and t = 0 is heard as the continuation of the end, exactly as in
// playback. Three bands are separated with RBJ biquads (low < 120 Hz, mid 300–2500 Hz,
// high > 6 kHz). Each band gets a log-energy onset function at 2 ms hops; every sixteenth step
// of the grid is searched ±35 ms for its strongest transient. A transient is detected by its rise
// (dB over the preceding 8–16 ms); its strength is measured from its peak band level against the
// loudest hits of that band (24 dB range), so loud and soft hits are told apart, never assumed equal.
import {BAR, BEAT, DURATION_IN_FRAMES, FPS, LOOP, STEP, STEPS} from '../../src/timeline.ts';

type Coeffs = {b0: number; b1: number; b2: number; a1: number; a2: number};

const biquad = (type: 'lp' | 'hp', f0: number, sr: number, q = Math.SQRT1_2): Coeffs => {
  const w = (2 * Math.PI * f0) / sr;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const b = type === 'lp' ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2] : [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  return {b0: b[0]! / a0, b1: b[1]! / a0, b2: b[2]! / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0};
};

const filter = (x: Float32Array, c: Coeffs) => {
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = c.b0 * x[i]! + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1;
    x1 = x[i]!;
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
};

export const BANDS = ['low', 'mid', 'high', 'full'] as const;
export type BandName = (typeof BANDS)[number];

const percentile = (values: number[], p: number) => {
  const s = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
  if (s.length === 0) return 0;
  return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))]!;
};

const r4 = (v: number) => Math.round(v * 10000) / 10000;
const wrapT = (t: number) => ((t % LOOP) + LOOP) % LOOP;

export type StepHit = {step: number; t: number; value: number; level: number; s: number};

export type LoopAnalysis = {
  sampleRate: number;
  gridOffset: number;
  steps: Record<Exclude<BandName, 'full'>, StepHit[]>;
  kick: {t: number; s: number}[];
  snare: {t: number; s: number}[];
  hat: {t: number; s: number}[];
  accents: {t: number; s: number}[];
  offGrid: {t: number; value: number}[];
  frames: Record<BandName, number[]>;
  barsDb: number[];
};

export const analyzeLoop = (mono: Float32Array, sr: number): LoopAnalysis => {
  const pre = Math.min(sr, mono.length);
  const x = new Float32Array(pre + mono.length);
  x.set(mono.subarray(mono.length - pre), 0);
  x.set(mono, pre);
  const lp = (v: Float32Array, f: number) => filter(v, biquad('lp', f, sr));
  const hp = (v: Float32Array, f: number) => filter(v, biquad('hp', f, sr));
  const sig: Record<BandName, Float32Array> = {
    low: lp(lp(x, 120), 120),
    mid: lp(lp(hp(hp(x, 300), 300), 2500), 2500),
    high: hp(hp(x, 6000), 6000),
    full: x,
  };

  // Log energy at 2 ms hops over 10 ms windows, indexed by loop time.
  const hop = 0.002;
  const win = Math.round(sr * 0.01);
  const hops = Math.round(LOOP / hop);
  const energy = {} as Record<BandName, Float64Array>;
  for (const band of BANDS) {
    const s = sig[band];
    const e = new Float64Array(hops + 40);
    for (let h = -40; h < hops; h++) {
      const centre = pre + Math.round((h * hop) * sr);
      let acc = 0;
      for (let i = centre - (win >> 1); i < centre + (win >> 1); i++) {
        const v = s[Math.max(0, Math.min(s.length - 1, i))]!;
        acc += v * v;
      }
      e[h + 40] = 10 * Math.log10(acc / win + 1e-10);
    }
    energy[band] = e;
  }
  const E = (band: BandName, h: number) => energy[band][Math.max(0, Math.min(hops + 39, h + 40))]!;
  // Onset function: rise of log energy over the preceding 8–16 ms.
  const odf = {} as Record<BandName, Float64Array>;
  for (const band of BANDS) {
    const o = new Float64Array(hops);
    for (let h = 0; h < hops; h++) {
      let base = 0;
      for (let k = 4; k <= 8; k++) base += E(band, h - k);
      o[h] = Math.max(0, E(band, h) - base / 5);
    }
    odf[band] = o;
  }
  const O = (band: BandName, t: number) => odf[band][Math.round(wrapT(t) / hop) % hops]!;

  // Grid offset: the shift (±40 ms) that best aligns the low and full onsets with the beats.
  let gridOffset = 0;
  let best = -1;
  for (let ms = -40; ms <= 40; ms++) {
    let score = 0;
    for (let b = 0; b < LOOP / BEAT; b++) {
      for (let d = -2; d <= 2; d++) score += O('low', b * BEAT + ms / 1000 + d * hop) + 0.5 * O('full', b * BEAT + ms / 1000 + d * hop);
    }
    if (score > best) {
      best = score;
      gridOffset = ms / 1000;
    }
  }

  const steps = {low: [] as StepHit[], mid: [] as StepHit[], high: [] as StepHit[]};
  for (const band of ['low', 'mid', 'high'] as const) {
    for (let st = 0; st < STEPS; st++) {
      const c = st * STEP + gridOffset;
      let value = 0;
      let at = c;
      for (let d = -0.035; d <= 0.035 + 1e-9; d += hop) {
        const v = O(band, c + d);
        if (v > value) {
          value = v;
          at = c + d;
        }
      }
      // Peak level of the hit in the 60 ms after its onset.
      let level = -200;
      for (let d = 0; d <= 0.06; d += hop) level = Math.max(level, E(band, Math.round(wrapT(at + d) / hop)));
      // The onset function peaks a few ms into the attack.
      steps[band].push({step: st, t: wrapT(at - 0.004), value, level, s: 0});
    }
  }

  // A hit is a step whose rise clears both an absolute floor (dB) and a fraction of the band's
  // typical strong rise; its strength is its peak level within 24 dB of the band's loudest hits.
  const pick = (band: 'low' | 'mid' | 'high', rel: number, absDb: number) => {
    const riseRef = percentile(steps[band].map(h => h.value), 95);
    const hits = steps[band].filter(h => h.value >= absDb && h.value >= rel * riseRef);
    const top = percentile(hits.map(h => h.level), 95);
    for (const h of steps[band]) h.s = Math.max(0, Math.min(1, 1 - (top - h.level) / 24));
    return hits.map(h => ({t: r4(h.t), s: r4(Math.max(0.05, h.s))}));
  };
  const kick = pick('low', 0.35, 4);
  const snare = pick('mid', 0.4, 4);
  const hat = pick('high', 0.35, 3);

  // Accents: the strongest combined moments, broadband.
  const combined = Array.from({length: STEPS}, (_, st) => 0.45 * steps.low[st]!.s + 0.3 * steps.mid[st]!.s + 0.25 * steps.high[st]!.s);
  const cmax = Math.max(...combined) || 1;
  const accents = combined
    .map((v, st) => ({t: r4(wrapT(st * STEP + gridOffset)), s: r4(v / cmax)}))
    .filter(a => a.s >= 0.8)
    .sort((a, b) => b.s - a.s)
    .slice(0, 12)
    .sort((a, b) => a.t - b.t);

  // Strong onsets that do not sit near any sixteenth: syncopation the grid would miss.
  const offGrid: {t: number; value: number}[] = [];
  const fullRef = percentile(Array.from(odf.full), 99.5);
  for (let h = 1; h < hops - 1; h++) {
    const v = odf.full[h]!;
    if (v < 0.5 * fullRef || v < odf.full[h - 1]! || v < odf.full[h + 1]!) continue;
    const t = h * hop;
    const nearest = Math.round((t - gridOffset) / STEP) * STEP + gridOffset;
    if (Math.abs(t - nearest) > 0.035) offGrid.push({t: r4(t), value: r4(v)});
  }

  // Per video frame band levels, 0…1 over the top 36 dB of each band.
  const frames = {} as Record<BandName, number[]>;
  for (const band of BANDS) {
    const raw: number[] = [];
    for (let f = 0; f < DURATION_IN_FRAMES; f++) {
      const h0 = Math.round(f / FPS / hop);
      let acc = 0;
      for (let k = 0; k < 8; k++) acc += Math.pow(10, E(band, (h0 + k) % hops) / 10);
      raw.push(10 * Math.log10(acc / 8 + 1e-10));
    }
    const top = percentile(raw, 99);
    frames[band] = raw.map(v => r4(Math.max(0, Math.min(1, (v - (top - 36)) / 36))));
  }

  const barsDb: number[] = [];
  for (let b = 0; b < LOOP / BAR; b++) {
    let acc = 0;
    let n = 0;
    for (let i = pre + Math.round(b * BAR * sr); i < pre + Math.round((b + 1) * BAR * sr) && i < x.length; i++) {
      acc += x[i]! * x[i]!;
      n++;
    }
    barsDb.push(Math.round(10 * Math.log10(acc / Math.max(1, n) + 1e-12) * 10) / 10);
  }

  return {sampleRate: sr, gridOffset, steps, kick, snare, hat, accents, offGrid, frames, barsDb};
};

/** Sample-level continuity of the loop point: the jump from the last sample to the first. */
export const seamReport = (channels: Float32Array[], sr: number) =>
  channels.map(ch => {
    const n = ch.length;
    const deltas: number[] = [];
    for (let i = 1; i < n; i += 7) deltas.push(Math.abs(ch[i]! - ch[i - 1]!));
    const jump = Math.abs(ch[0]! - ch[n - 1]!);
    const rms = (from: number, to: number) => {
      let acc = 0;
      for (let i = from; i < to; i++) acc += ch[i]! * ch[i]!;
      return 10 * Math.log10(acc / (to - from) + 1e-12);
    };
    const w = Math.round(sr * 0.02);
    return {
      jump: r4(jump),
      medianStep: r4(percentile(deltas, 50)),
      p999Step: r4(percentile(deltas, 99.9)),
      tailDb: Math.round(rms(n - w, n) * 10) / 10,
      headDb: Math.round(rms(0, w) * 10) / 10,
    };
  });
