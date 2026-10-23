// MORPH//02 physical voice: glottal pulse source + Kelly-Lochbaum vocal-tract waveguide
// with a nasal branch, consonant constrictions, turbulence, and a continuously variable
// throat size (the tract is stepped at a variable internal rate and resampled, so
// formants scale smoothly from child to giant while pitch stays an independent control).
import { SR, TAU, clamp, smooth, rng, bipolar, drift, Biquad } from './dsp.mjs';

export const N = 44;          // oral sections, glottis (0) -> lips (N-1)
const NOSE = 28, VELUM = 17;  // nasal sections; branch point in the oral tract
const BASE_RATE = 2 * SR;     // internal rate at size 1 (adult tract ~ 17 cm)

/** Diameter profile of the oral tract from articulatory parameters. */
export function tractShape({ tongueIndex = 20, tongueDiam = 1.5, lipDiam = 1.5, tipIndex = 36, tipDiam = 3, bodyScale = 1 }) {
  const d = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    let rest = i < 7 ? 0.6 + 0.13 * i : 1.5;                 // narrow larynx opening into the pharynx
    if (i >= 7 && i < 12) rest = 1.5 + 0.1 * Math.sin((i - 7) / 5 * Math.PI); // slight pharyngeal bulge
    let v = rest * bodyScale;
    // tongue body: raised-cosine bump that narrows the tract to tongueDiam at tongueIndex
    const u = (i - tongueIndex) / 9;
    if (i >= 7 && i < N - 3 && Math.abs(u) < 1) v = Math.min(v, v - (v - tongueDiam) * Math.cos(u * Math.PI / 2) ** 2);
    // tongue tip / teeth constriction for consonants
    const w = (i - tipIndex) / 2.2;
    if (Math.abs(w) < 1) v = Math.min(v, v - (v - tipDiam) * Math.cos(w * Math.PI / 2) ** 2);
    if (i >= N - 3) v = lipDiam + (i === N - 3 ? (v - lipDiam) * 0.4 : 0);
    d[i] = Math.max(0, v);
  }
  return d;
}

/** Kelly-Lochbaum pressure-wave tract with an N-port velum junction. */
export class Tract {
  constructor() {
    this.R = new Float64Array(N); this.L = new Float64Array(N);
    this.nR = new Float64Array(NOSE); this.nL = new Float64Array(NOSE);
    this.A = new Float64Array(N).fill(2.25); this.nA = new Float64Array(NOSE);
    for (let i = 0; i < NOSE; i++) { const d = i < 6 ? 0.4 + 0.12 * i : 1.0 - 0.012 * (i - 6); this.nA[i] = d * d; }
    this.velum = 0; this.lipLp = 0; this.glottalRefl = 0.75; this.lipRefl = -0.85; this.loss = 0.9993;
    this.newR = new Float64Array(N); this.newL = new Float64Array(N);
    this.newNR = new Float64Array(NOSE); this.newNL = new Float64Array(NOSE);
  }
  setDiameters(d) { for (let i = 0; i < N; i++) this.A[i] = Math.max(1e-5, d[i] * d[i]); }
  /** One step at the internal rate. noise: [{index, value}] turbulence injections. Returns radiated pressure. */
  step(glottal, noiseIndex = -1, noiseValue = 0) {
    const { R, L, A, newR, newL, nR, nL, nA, newNR, newNL } = this;
    newR[0] = this.glottalRefl * L[0] + glottal;
    // lips reflect low frequencies and radiate high ones: a one-pole on the reflected wave
    this.lipLp += 0.5 * (R[N - 1] - this.lipLp);
    newL[N - 1] = this.lipRefl * this.lipLp;
    for (let i = 1; i < N; i++) {
      if (i === VELUM && this.velum > 1e-4) {
        // three-port junction: left oral, right oral, nose
        const a1 = A[i - 1], a2 = A[i], a3 = this.velum;
        const pj = 2 * (a1 * R[i - 1] + a2 * L[i] + a3 * nL[0]) / (a1 + a2 + a3);
        newR[i] = pj - L[i]; newL[i - 1] = pj - R[i - 1]; newNR[0] = pj - nL[0];
      } else {
        const pj = 2 * (A[i - 1] * R[i - 1] + A[i] * L[i]) / (A[i - 1] + A[i]);
        newR[i] = pj - L[i]; newL[i - 1] = pj - R[i - 1];
      }
    }
    if (noiseIndex > 0 && noiseIndex < N - 1) { newR[noiseIndex] += noiseValue; newL[noiseIndex - 1] += noiseValue; }
    const loss = this.loss;
    for (let i = 0; i < N; i++) { R[i] = newR[i] * loss; L[i] = newL[i] * loss; }
    let nose = 0;
    if (this.velum > 1e-4) {
      newNL[NOSE - 1] = -0.85 * nR[NOSE - 1];
      for (let i = 1; i < NOSE; i++) {
        const pj = 2 * (nA[i - 1] * nR[i - 1] + nA[i] * nL[i]) / (nA[i - 1] + nA[i]);
        newNR[i] = pj - nL[i]; newNL[i - 1] = pj - nR[i - 1];
      }
      for (let i = 0; i < NOSE; i++) { nR[i] = newNR[i] * 0.999; nL[i] = newNL[i] * 0.999; }
      nose = nR[NOSE - 1] * nA[NOSE - 1];
    } else { nR.fill(0); nL.fill(0); }
    // radiated volume velocity ~ area x pressure wave at each opening
    return R[N - 1] * A[N - 1] / 2.25 + nose;
  }
}

// ---------------------------------------------------------------- phonemes
// Articulations calibrated against formant targets with calibrate-voice.mjs (size 1).
export const PHONEMES = {
  // vowels: tongueIndex, tongueDiam, lipDiam
  ee: { tongueIndex: 29, tongueDiam: 0.35, lipDiam: 1.0 },   // F1/F2 289/2163 (target 270/2290)
  ih: { tongueIndex: 27, tongueDiam: 0.55, lipDiam: 1.5 },   // 390/1964 (390/1990)
  eh: { tongueIndex: 28, tongueDiam: 1.2, lipDiam: 1.5 },    // 521/1746 (530/1840)
  ah: { tongueIndex: 10, tongueDiam: 0.45, lipDiam: 2.1 },   // 645/1138 (730/1090)
  uh: { tongueIndex: 11, tongueDiam: 0.55, lipDiam: 1.5 },   // 631/1188 (640/1190)
  oh: { tongueIndex: 15, tongueDiam: 0.45, lipDiam: 0.5 },   // 444/808 (450/800)
  oo: { tongueIndex: 25, tongueDiam: 0.35, lipDiam: 0.5 },   // 292/889 (300/870)
  // consonants
  mm: { tongueIndex: 18, tongueDiam: 1.2, lipDiam: 0, velum: 0.6 },
  nn: { tongueIndex: 25, tongueDiam: 1.0, lipDiam: 1.3, tipIndex: 36, tipDiam: 0, velum: 0.6 },
  ll: { tongueIndex: 24, tongueDiam: 1.2, lipDiam: 1.4, tipIndex: 38, tipDiam: 0.18 }, // 260/1280/2651
  hh: { aspiration: 1, voicing: 0 },
  dd: { tongueIndex: 25, tongueDiam: 1.0, lipDiam: 1.3, tipIndex: 36, tipDiam: 0 },
  ss: { tongueIndex: 26, tongueDiam: 0.9, lipDiam: 1.0, tipIndex: 39, tipDiam: 0.12, frication: 1, fricIndex: 40 },
};

/** Expand a phoneme sequence into articulator targets over time. seq: [{t, ph, glide}] */
export function articulation(seq) {
  const full = seq.map(({ t, ph, glide = 0.06, ...over }) => {
    const p = { tongueIndex: 20, tongueDiam: 1.5, lipDiam: 1.5, tipIndex: 36, tipDiam: 3, velum: 0, aspiration: 0, voicing: 1, frication: 0, fricIndex: 40, ...PHONEMES[ph], ...over };
    // /h/ takes its mouth shape from the following vowel
    return { t, glide, p, ph };
  });
  for (let k = 0; k < full.length; k++) if (full[k].ph === 'hh' && full[k + 1]) {
    const nxt = full[k + 1].p; Object.assign(full[k].p, { tongueIndex: nxt.tongueIndex, tongueDiam: nxt.tongueDiam, lipDiam: nxt.lipDiam });
  }
  const keys = Object.keys(full[0].p);
  return t => {
    let cur = full[0].p;
    for (let k = 1; k < full.length; k++) {
      const { t: tk, glide, p } = full[k];
      if (t < tk) break;
      const u = smooth((t - tk) / glide);
      if (u >= 1) { cur = p; continue; }
      const mix = {};
      for (const key of keys) mix[key] = cur[key] + (p[key] - cur[key]) * u;
      cur = mix;
    }
    return cur;
  };
}

/**
 * Render a voice. ctl(t) -> { f0, voicing, tenseness, aspiration, growl, jitter, shimmer, size,
 * metal, vibratoDepth (cents), vibratoRate } ; art(t) -> articulator targets (from articulation()).
 */
export function renderVoice({ seconds, seed = 1, ctl, art }) {
  const n = Math.round(seconds * SR), out = new Float64Array(n);
  const tract = new Tract(), r = rng(seed), noise = bipolar(rng(seed + 1)), slow = drift(seed + 2, 3.5), slower = drift(seed + 3, 0.8);
  const aaf1 = new Biquad('lp', 1000, 0.5412), aaf2 = new Biquad('lp', 1000, 1.3065);
  const fricFilter = new Biquad('bp', 5000, 1.2), aspFilter = new Biquad('hp', 600, 0.7), aspLow = new Biquad('lp', 2500, 0.7);
  let tilt = 0, tiltCoef = 0.5;
  let phase = 0, periodIndex = 0, amp = 1, vibPhase = 0, lastFlow = 0;
  let stepClock = 0, produced = 0;
  const hist = new Float64Array(8); // recent tract outputs (at internal rate)
  let c = ctl(0), a = art(0), rate = BASE_RATE;
  const step = () => {
    // glottal source (Rosenberg-style flow with tenseness-controlled open quotient)
    const oq = 0.85 - 0.4 * c.tenseness, to = oq * 0.62, tc = oq * 0.38;
    let flow = 0;
    if (phase < to) flow = 0.5 * (1 - Math.cos(Math.PI * phase / to));
    else if (phase < to + tc) flow = Math.cos(Math.PI / 2 * (phase - to) / tc);
    const dflow = (flow - lastFlow) * (tc * 2 / Math.PI) / Math.max(1e-6, phaseStep); // ~ -1 at closure
    lastFlow = flow;
    const voicing = c.voicing * a.voicing, aspiration = Math.max(c.aspiration, a.aspiration * c.voicing);
    const pulsedNoise = noise() * (0.3 + flow * voicing);
    const breath = aspLow.tick(aspFilter.tick(pulsedNoise)) * (0.04 + 0.5 * aspiration + 0.12 * (1 - c.tenseness));
    tilt += tiltCoef * (dflow - tilt); // LF-style return phase: closure is not a perfect step
    const glottal = (tilt * amp * voicing + breath * Math.max(aspiration, (1 - c.tenseness) * 0.25 * voicing)) * 0.35;
    phase += phaseStep * periodScale;
    if (phase >= 1) {
      phase -= 1; periodIndex++;
      // per-period perturbations: jitter, shimmer, and period-doubling growl
      const odd = periodIndex & 1, g = c.growl;
      periodScale = 1 / (1 + (r() * 2 - 1) * c.jitter + (odd ? 1 : -1) * 0.07 * g);
      amp = (1 + (r() * 2 - 1) * c.shimmer) * (odd ? 1 - 0.55 * g : 1) * (g > 0.6 && r() < (g - 0.6) * 0.5 ? 0.35 : 1);
    }
    // turbulence injected at a narrow constriction (fricatives)
    const fric = a.frication > 0.01 ? fricFilter.tick(noise()) * a.frication * 0.25 : 0;
    const y = tract.step(glottal, a.frication > 0.01 ? Math.round(a.fricIndex) : -1, fric);
    // the source is a flow derivative, which already includes lip radiation
    return y;
  };
  let phaseStep = 0, periodScale = 1;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if ((i & 31) === 0) {
      c = ctl(t); a = art(t);
      tract.setDiameters(tractShape(a));
      tract.velum = a.velum * a.velum;
      tract.loss = 0.9993 + 0.0006 * c.metal;
      tract.glottalRefl = 0.75 + 0.2 * c.metal; tract.lipRefl = -0.85 - 0.1 * c.metal;
      rate = BASE_RATE * c.size;
      tiltCoef = 1 - Math.exp(-TAU * (1300 + 6500 * c.tenseness ** 1.5) / rate);
      aspLow.set('lp', 5500 * SR / rate, 0.7); aspFilter.set('hp', 500 * SR / rate, 0.7); fricFilter.set('bp', 4500 * SR / rate, 1.2);
      const fc = Math.min(0.45 * SR, 0.45 * rate) / rate; // anti-alias for the resample to SR
      aaf1.set('lp', fc * SR, 0.5412); aaf2.set('lp', fc * SR, 1.3065);
    }
    // vibrato (sine + slow human drift) and the pitch of this output sample
    vibPhase += TAU * (c.vibratoRate ?? 5.5) / SR;
    const cents = (c.vibratoDepth ?? 0) * Math.sin(vibPhase) + 12 * slow() * (c.drift ?? 1) + 25 * slower() * (c.drift ?? 1);
    const f0 = c.f0 * 2 ** (cents / 1200);
    phaseStep = f0 / rate;
    // advance the tract enough internal steps for one output sample
    stepClock += rate / SR;
    while (produced < stepClock) {
      // filters here run at the internal rate; their cutoffs were rescaled above
      const v = aaf2.tick(aaf1.tick(step()));
      hist.copyWithin(0, 1); hist[7] = v; produced++;
    }
    // cubic interpolation at the fractional position of this output sample
    const frac = 1 - (produced - stepClock);
    const y0 = hist[4], y1 = hist[5], y2 = hist[6], y3 = hist[7];
    const c1 = 0.5 * (y2 - y0), c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3, c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
    out[i] = ((c3 * frac + c2) * frac + c1) * frac + y1;
  }
  return out;
}
