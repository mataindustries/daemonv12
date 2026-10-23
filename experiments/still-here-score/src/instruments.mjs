// STILL HERE instruments. Deliberately small: every physical core is a copied MORPH model
// (lib/, provenance in PROVENANCE.md); this file only adds performance lanes and four plain
// synthesis voices (tines, saw stabs, warm bass, strike plate). No engine code is involved.
import { SR, TAU, mtof, clamp, smooth, rng, bipolar, drift, Osc, SVF, Biquad, filt, shape, tube, modal, norm, split, reverb, Delay } from '../lib/dsp.mjs';
import { cable, curve } from '../lib/cable.mjs';
import { throat, articulation as throatArticulation } from '../lib/throat.mjs';
import { renderVoice, articulation as voiceArticulation } from '../lib/voice.mjs';
import { membrane, cableTick } from '../lib/kit.mjs';
import { clank } from '../lib/household.mjs';

/** Absolute peak over any number of channels (a loop: spreading long arrays overflows the stack). */
export const peak = (...chs) => { let p = 0; for (const x of chs) for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > p) p = a; } return p; };
const hp4 = (x, fc) => { new Biquad('hp', fc, 0.5412).run(x); new Biquad('hp', fc, 1.3066).run(x); return x; };
/** Fade the last `sec` seconds to zero and make sample 0 exactly zero (clean one-shot edges). */
export function edges(x, sec = 0.01, fadeIn = 0.0003) {
  const k = Math.min(x.length, Math.round(sec * SR)), a = Math.max(1, Math.round(fadeIn * SR));
  for (let i = 0; i < k; i++) x[x.length - 1 - i] *= smooth(i / k);
  for (let i = 0; i < a; i++) x[i] *= i / a;
  return x;
}

// ---------------------------------------------------------------- performance lanes
/**
 * Monophonic note list -> per-sample pitch (Hz) and amplitude arrays.
 * notes: [{ t, dur, midi, vel?, glide?, scoop?, attack?, release?, bend?: {to, at, time} }] (seconds).
 * Legato notes (gap < legatoGap) glide from the previous pitch; detached notes may scoop up.
 */
export function lanes(n, notes, { attack = 0.008, release = 0.06, glide = 0.035, legatoGap = 0.03, scoop = 0, scoopTime = 0.05 } = {}) {
  const f0 = new Float64Array(n), amp = new Float64Array(n), ns = [...notes].sort((a, b) => a.t - b.t);
  let prevHz = mtof(ns[0].midi), prevEnd = -1;
  for (let k = 0; k < ns.length; k++) {
    const nt = ns[k], hz = mtof(nt.midi), s0 = Math.round(nt.t * SR), s1 = k + 1 < ns.length ? Math.round(ns[k + 1].t * SR) : n;
    const legato = k > 0 && nt.t - prevEnd < legatoGap, g = nt.glide ?? (legato ? glide : 0), sc = nt.scoop ?? (legato ? 0 : scoop);
    if (k === 0) f0.fill(hz, 0, Math.min(n, s0));
    for (let i = s0; i < Math.min(s1, n); i++) {
      const u = (i - s0) / SR;
      let f = hz;
      if (g > 0 && u < g) f = prevHz * (hz / prevHz) ** smooth(u / g);
      else if (sc > 0 && u < scoopTime) f = hz * 2 ** (-sc / 1200 * (1 - smooth(u / scoopTime)));
      if (nt.bend && u >= nt.bend.at) f *= (mtof(nt.bend.to) / hz) ** smooth((u - nt.bend.at) / nt.bend.time);
      f0[i] = f;
    }
    const att = nt.attack ?? attack, rel = nt.release ?? release, vel = nt.vel ?? 1;
    for (let i = s0; i < Math.min(n, Math.round((nt.t + nt.dur + rel) * SR)); i++) {
      const u = (i - s0) / SR;
      let a = att > 0 ? smooth(u / att) : 1;
      if (u > nt.dur) a *= 1 - smooth((u - nt.dur) / rel);
      if (a * vel > amp[i]) amp[i] = a * vel;
    }
    prevHz = nt.bend ? mtof(nt.bend.to) : hz; prevEnd = nt.t + nt.dur;
  }
  return { f0, amp };
}

/** Vibrato depth (cents) that blooms after `delay` seconds into each note. */
function vibratoLane(n, notes, depth, delay = 0.14, rise = 0.25) {
  const v = new Float64Array(n);
  for (const nt of notes) {
    const s0 = Math.round(nt.t * SR), d = nt.vib ?? depth;
    for (let i = s0; i < Math.min(n, Math.round((nt.t + nt.dur + 0.1) * SR)); i++) v[i] = Math.max(v[i], d * smooth(((i - s0) / SR - delay) / rise));
  }
  return v;
}

// ---------------------------------------------------------------- talkbox (A's answer voice)
// A talk box drives a real mouth with an instrument. Here a band-limited saw/pulse drives the
// MORPH//03 Kelly-Lochbaum throat; every syllable is a mouth movement, not a filter sweep.
const SYL = {
  wa: (t, d) => [{ t, ph: 'ww', glide: 0.008 }, { t: t + 0.03, ph: 'ah', glide: Math.min(0.08, d * 0.4) }],
  ya: (t, d) => [{ t, ph: 'ee', glide: 0.008 }, { t: t + 0.03, ph: 'ah', glide: Math.min(0.07, d * 0.4) }],
  ow: (t, d) => [{ t, ph: 'ah', glide: 0.012 }, { t: t + d * 0.45, ph: 'oh', glide: d * 0.35 }],
  oh: (t) => [{ t, ph: 'uh', glide: 0.01 }, { t: t + 0.02, ph: 'oh', glide: 0.05 }],
  yeah: (t, d) => [{ t, ph: 'ee', glide: 0.008 }, { t: t + 0.04, ph: 'eh', glide: 0.05 }, { t: t + Math.min(0.16, d * 0.5), ph: 'ah', glide: 0.08 }],
  ah: (t) => [{ t, ph: 'ah', glide: 0.02 }],
  ee: (t) => [{ t, ph: 'ee', glide: 0.02 }],
  wee: (t, d) => [{ t, ph: 'ww', glide: 0.008 }, { t: t + 0.03, ph: 'ee', glide: Math.min(0.08, d * 0.4) }],
  yo: (t, d) => [{ t, ph: 'ee', glide: 0.008 }, { t: t + 0.03, ph: 'oh', glide: Math.min(0.08, d * 0.4) }],
  mm: (t) => [{ t, ph: 'mm', glide: 0.02 }],
  mmah: (t, d) => [{ t, ph: 'mm', glide: 0.01 }, { t: t + Math.min(0.06, d * 0.3), ph: 'ah', glide: 0.06 }],
};
export const talkboxSyllables = Object.keys(SYL);

export function talkbox({ seconds, notes, seed = 3, size = 1, metal = 0.12, breath = 0.25, vibrato = 14, pulse = 0.25, width = 0.3 }) {
  const n = Math.round(seconds * SR), { f0, amp } = lanes(n, notes, { attack: 0.006, release: 0.07, glide: 0.04 });
  const vib = vibratoLane(n, notes, vibrato), saw = new Osc(0.1), sq = new Osc(0.6), wob = drift(seed, 0.7), src = new Float64Array(n);
  let vp = 0;
  for (let i = 0; i < n; i++) {
    vp += TAU * 5.6 / SR;
    const f = f0[i] * 2 ** ((vib[i] * Math.sin(vp) + 3 * wob()) / 1200);
    src[i] = ((1 - pulse) * saw.saw(f) + pulse * sq.square(f, 0.32)) * amp[i];
  }
  const seq = [{ t: 0, ph: 'mm' }];
  for (const nt of notes) seq.push(...SYL[nt.syl ?? 'ah'](nt.t, nt.dur));
  const mouth = throat(src, { art: throatArticulation(seq), size: () => size, metal: () => metal, breath, seed });
  hp4(mouth, 110);
  const warm = shape(norm(mouth, 0.7), tube, 1.4);
  filt(warm, 'peak', 2600, 0.9, 2); filt(warm, 'hs', 7000, 0.7, -3);
  norm(warm, 0.9);
  // width from different content per side: two slowly modulated short delays (a doubled singer)
  const L = Float64Array.from(warm), R = Float64Array.from(warm), dl = new Delay(0.05), dr = new Delay(0.05);
  for (let i = 0; i < n; i++) {
    dl.write(warm[i]); dr.write(warm[i]);
    const ml = (0.011 + 0.0016 * Math.sin(TAU * 0.61 * i / SR)) * SR, mr = (0.017 + 0.0016 * Math.sin(TAU * 0.47 * i / SR + 1.3)) * SR;
    L[i] += width * dl.read(ml); R[i] += width * dr.read(mr);
  }
  const k = 0.9 / peak(L, R);
  for (let i = 0; i < n; i++) { L[i] *= k; R[i] *= k; }
  return { L, R, mono: warm, f0, amp };
}

// ---------------------------------------------------------------- sung voice (B's spark)
// The MORPH//02 glottal voice (jitter, shimmer, breath) through its calibrated throat.
export function singer({ seconds, notes, seed = 11, size = 0.9, tense = 0.5, aspiration = 0.07, vibrato = 22, driftAmt = 0.22, attack = 0.05, release = 0.14 }) {
  const n = Math.round(seconds * SR), { f0, amp } = lanes(n, notes, { attack, release, glide: 0.07, scoop: 30, scoopTime: 0.08 });
  const vib = vibratoLane(n, notes, vibrato, 0.2, 0.3), tens = new Float64Array(n);
  for (const nt of notes) for (let i = Math.round(nt.t * SR); i < Math.min(n, Math.round((nt.t + nt.dur + release) * SR)); i++) tens[i] = clamp(nt.tense ?? tense + 0.25 * ((nt.vel ?? 0.8) - 0.6), 0.1, 0.95);
  const idx = t => Math.min(n - 1, Math.max(0, Math.round(t * SR)));
  const ctl = t => {
    const i = idx(t);
    return { f0: f0[i], voicing: amp[i], tenseness: tens[i] || tense, aspiration: aspiration * Math.min(1, amp[i] * 1.5), growl: 0, jitter: 0.004, shimmer: 0.02,
      size, metal: 0, vibratoDepth: vib[i], vibratoRate: 5.3, drift: driftAmt };
  };
  const seq = [{ t: 0, ph: 'mm', glide: 0.02 }];
  for (const nt of notes) {
    if (nt.onset) seq.push({ t: Math.max(0, nt.t - 0.035), ph: nt.onset, glide: 0.015 });
    seq.push({ t: nt.t + (nt.onset ? 0.01 : 0), ph: nt.ph ?? 'ah', glide: nt.open ?? 0.06 });
    if (nt.to) seq.push({ t: nt.t + nt.dur * (nt.toAt ?? 0.5), ph: nt.to, glide: nt.dur * 0.4 });
  }
  const art = voiceArticulation(seq.sort((a, b) => a.t - b.t));
  const out = renderVoice({ seconds, seed, ctl, art });
  hp4(out, 90);
  return norm(out, 0.9);
}

// ---------------------------------------------------------------- tines (music box / glass)
/** A struck tine: fundamental plus the free bar's inharmonic modes (2.76, 5.40, 8.93), seconds long. */
export function tine(midi, { decay = 1.3, bright = 1, hard = 0.7, seed = 1, seconds } = {}) {
  const f = mtof(midi), n = Math.round((seconds ?? Math.min(3, decay * 1.3 + 0.05)) * SR), x = new Float64Array(n), r = bipolar(rng(seed));
  const L = Math.max(2, Math.round((0.0011 - 0.0008 * hard) * SR));
  for (let i = 0; i < L; i++) x[i] = Math.sin(Math.PI * i / L) * (0.75 + 0.25 * r());
  const y = modal(x, [
    { f, t60: decay, gain: 1 }, { f: f * 2.0, t60: decay * 0.4, gain: 0.05 },
    { f: f * 2.756, t60: decay * 0.2, gain: 0.3 * bright }, { f: f * 5.404, t60: decay * 0.09, gain: 0.14 * bright },
    { f: f * 8.933, t60: decay * 0.045, gain: 0.07 * bright },
  ]);
  return norm(edges(hp4(y, 80), 0.05), 0.9);
}

// ---------------------------------------------------------------- saw-ensemble stab ("brass")
/** Stereo chord stab: detuned saws per side through an enveloped low-pass, gently driven. */
export function sawStab(midis, { seconds = 0.8, attack = 0.004, hold = 0.05, decay = 0.3, sustain = 0.3, release = 0.12, gate, cutoff = [4200, 950], fTau = 0.11,
  q = 0.85, detune = 9, seed = 1, drive = 1.6, swell = 0 } = {}) {
  const n = Math.round(seconds * SR), r = rng(seed), g0 = gate ?? seconds - release - 0.01, out = {};
  for (const ch of ['L', 'R']) {
    const y = new Float64Array(n), oscs = midis.flatMap(m => [-1, 1].map(s => ({ o: new Osc(r()), f: mtof(m) * 2 ** ((s * detune + (ch === 'L' ? -2 : 2) + (r() - 0.5) * 3) / 1200) })));
    const lp = new SVF(cutoff[0], q), lp2 = new SVF(cutoff[0], 0.6);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let a = t < attack ? smooth(t / attack) : t < attack + hold ? 1 : sustain + (1 - sustain) * Math.exp(-(t - attack - hold) / decay);
      if (swell > 0) a *= smooth(t / swell);
      if (t > g0) a *= 1 - smooth((t - g0) / release);
      let s = 0;
      for (const v of oscs) s += v.o.saw(v.f);
      const fc = cutoff[1] + (cutoff[0] - cutoff[1]) * Math.exp(-t / fTau);
      lp.set(fc, q); lp2.set(fc * 1.4, 0.6);
      y[i] = lp2.tick(lp.tick(s / oscs.length)) * a;
    }
    out[ch] = shape(y, Math.tanh, drive);
  }
  hp4(out.L, 90); hp4(out.R, 90);
  const p = peak(out.L, out.R);
  for (const ch of ['L', 'R']) { for (let i = 0; i < n; i++) out[ch][i] *= 0.9 / p; edges(out[ch], 0.01); }
  return out;
}

// ---------------------------------------------------------------- warm bass (B)
/** Monophonic warm bass performance: sine fundamental + low-passed saw, legato glides. Returns { sub, body, f0 }. */
export function warmBass({ seconds, notes, seed = 5, cutoff = [1500, 380], fTau = 0.14, sawLevel = 0.55, drive = 1.5 }) {
  const n = Math.round(seconds * SR), { f0, amp } = lanes(n, notes, { attack: 0.004, release: 0.06, glide: 0.03 });
  const sine = new Osc(0), saw = new Osc(0.37), lp = new SVF(800, 0.9), y = new Float64Array(n), onsets = notes.map(nt => nt.t).sort((a, b) => a - b);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    while (k + 1 < onsets.length && t >= onsets[k + 1]) k++;
    const since = t - (onsets[k] ?? 0), fc = cutoff[1] + (cutoff[0] - cutoff[1]) * Math.exp(-Math.max(0, since) / fTau);
    lp.set(Math.max(60, fc), 0.9);
    y[i] = (sine.sine(f0[i]) + sawLevel * lp.tick(saw.saw(f0[i]))) * amp[i];
  }
  const driven = shape(norm(y, 0.8), tube, drive);
  hp4(driven, 28);
  const { lo, hi } = split(driven, 110);
  return { sub: lo, body: hi, f0, amp };
}

// ---------------------------------------------------------------- struck metal
/** A struck steel plate: dense inharmonic modes (different per side) plus a short sizzle. Stereo. */
export function strikePlate({ seconds = 2.2, seed = 9, base = 330, ring = 1.6, wash = 0.35, body = 0.5 } = {}) {
  const n = Math.round(seconds * SR), out = {};
  const hit = new Float64Array(n), rr = bipolar(rng(seed));
  for (let i = 1; i < 120; i++) hit[i] = rr() * Math.exp(-i / 22);
  const low = modal(hit, [{ f: base * 0.5, t60: 0.5, gain: 1 }, { f: base * 0.5 * 1.59, t60: 0.35, gain: 0.6 }]);
  norm(low);
  for (const [c, ch] of [[0, 'L'], [1, 'R']]) {
    const r = rng(seed + 101 * (c + 1)), modes = [];
    for (let k = 0; k < 40; k++) {
      const f = base * (1 + k * 0.63 + r() * 0.45) ** 1.32;
      if (f > 0.44 * SR) break;
      modes.push({ f, t60: clamp(ring * (480 / f) ** 0.35, 0.12, 3), gain: 1 / (1 + 0.12 * k) });
    }
    const y = norm(modal(hit, modes)), nz = bipolar(rng(seed + 7 + c)), hp = new SVF(3800, 0.7);
    for (let i = 0; i < n; i++) { const t = i / SR; hp.tick(nz()); y[i] += wash * hp.hp * Math.exp(-t / 0.28) * smooth(t / 0.001) + body * low[i]; }
    out[ch] = edges(hp4(y, 70), 0.2);
  }
  const p = peak(out.L, out.R);
  for (const ch of ['L', 'R']) for (let i = 0; i < n; i++) out[ch][i] *= 0.9 / p;
  return out;
}

// ---------------------------------------------------------------- machine sounds
/** A's press: the MORPH household clank tuned so its lowest plate mode sits on `tune` Hz, over a membrane thump an octave below. */
export function press({ seed = 3, tune = 110, thump = 0.8, plate = 0.65 } = {}) {
  const c = clank(seed, 97 / tune), m = membrane({ f0: tune / 2, lift: 6, liftTau: 0.02, decay: 0.24, hard: 0.55, centre: 0.9, beater: 2, seed });
  const n = Math.max(c.length, m.length), y = new Float64Array(n);
  norm(m);
  for (let i = 0; i < n; i++) y[i] = plate * (c[i] ?? 0) + thump * (m[i] ?? 0);
  return norm(edges(hp4(y, 32), 0.05), 0.9);
}

/** B's breathing press: a soft, deep membrane, a gear ring and a pneumatic exhale. */
export function breathPress({ seed = 7, tune = 73.42, exhale = 0.5, gear = 0.25, seconds = 0.9 } = {}) {
  const n = Math.round(seconds * SR), y = new Float64Array(n);
  const m = norm(membrane({ f0: tune, lift: 5, liftTau: 0.025, decay: 0.42, hard: 0.35, centre: 0.95, beater: 0.7, seconds, seed }));
  const hit = new Float64Array(n); hit[1] = 1; hit[2] = 0.5;
  const ring = norm(modal(hit, [{ f: tune * 4, t60: 0.5, gain: 1 }, { f: tune * 6.04, t60: 0.35, gain: 0.6 }, { f: tune * 9.1, t60: 0.2, gain: 0.35 }]));
  const nz = bipolar(rng(seed + 3)), bp = new SVF(1100, 0.8);
  for (let i = 0; i < n; i++) {
    const t = i / SR, e = smooth((t - 0.03) / 0.08) * Math.exp(-Math.max(0, t - 0.11) / 0.22);
    bp.tick(nz());
    y[i] = m[i] + gear * ring[i] + exhale * bp.bp * e;
  }
  return norm(edges(hp4(y, 30), 0.08), 0.9);
}

/** A tick-tock pair voice for the machine's light beats (a tiny tight cable, lower and softer than the hats). */
export const tock = (midi, seed) => cableTick({ midi, decay: 0.035, disp: -0.7, seed });

/** A short cable pluck at `midi`: the Tempo String as a crystalline arpeggio voice. */
export function cablePluck(midi, { decay = 0.16, disp = -0.4, bright = 9000, buzz = 0.08, hard = 0.85, seed = 21, stages = 64 } = {}) {
  const c = cable({
    seconds: decay * 2.2 + 0.05, period: 1 / mtof(midi), disp, stages, gain: 0.988, bright, drive: 1.5, buzz,
    damp: curve([[0, 1], [decay, 0.6], [decay * 2, 0.05]]), events: [{ t: 0, kind: 'pluck', hard, amp: 1, pos: 0.13 }], seed,
  }).out;
  return norm(edges(hp4(c, 140), 0.03), 0.9);
}

/** The MORPH FDN room as a separate stereo return for an external stem. */
export function room(L, R, opts) {
  const w = reverb({ L, R }, { size: 1, rt60: 1.6, hfRatio: 0.5, predelay: 0.02, diffusion: 0.7, mod: 0.6, lowCut: 180, ...opts }), k = 0.9 / peak(w.L, w.R);
  for (let i = 0; i < w.L.length; i++) { w.L[i] *= k; w.R[i] *= k; }
  return w;
}
export { hp4, curve };
