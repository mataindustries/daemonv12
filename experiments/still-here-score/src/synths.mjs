// STILL HERE V3 palette: classic analog-style subtractive voices and electronic drums, kept
// deliberately small (textbook designs, not a synthesis research project). Built only from
// lib/dsp.mjs primitives (polyBLEP oscillators, TPT state-variable filters, 4x oversampled
// shaping). MORPH's physical instruments are used elsewhere only where they help the music.
import { SR, TAU, mtof, clamp, smooth, rng, bipolar, Osc, SVF, Biquad, shape, norm, Delay } from '../lib/dsp.mjs';
import { lanes, edges, peak } from './instruments.mjs';

const hp2 = (x, fc) => { new Biquad('hp', fc, 0.7071).run(x); return x; };
const joint = (L, R, to = 0.9) => { const k = to / peak(L, R); for (let i = 0; i < L.length; i++) { L[i] *= k; R[i] *= k; } return { L, R }; };

// ================================================================== drums
/** Electronic kick: a sine swept down from fStart to f0, a held punch, a click for small speakers, driven. */
export function eKick({ f0 = 52, fStart = 240, pitchTau = 0.034, decay = 0.42, hold = 0.014, click = 0.8, clickFreq = 3200, drive = 2, lowpass = 0, seed = 1 } = {}) {
  const n = Math.round((decay + 0.1) * SR), y = new Float64Array(n), r = bipolar(rng(seed)), hp = new SVF(1800, 0.7);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = f0 + (fStart - f0) * Math.exp(-t / pitchTau);
    ph += TAU * f / SR;
    let v = Math.sin(ph) * smooth(t / 0.0006) * (t < hold ? 1 : Math.exp(-(t - hold) / (decay / 4.6)));
    if (t < 0.012) { hp.tick(r()); v += click * (0.6 * hp.hp + 0.5 * Math.sin(TAU * clickFreq * t)) * (1 - t / 0.012) ** 1.5; } // beater click: what a phone hears
    y[i] = v;
  }
  const out = shape(norm(y), Math.tanh, drive);
  if (lowpass) { new Biquad('lp', lowpass, 0.6).run(out); new Biquad('lp', lowpass, 0.6).run(out); }
  hp2(out, 25);
  return norm(edges(out, 0.03, 0.0002), 0.95);
}

/** Hand clap: four band-passed noise bursts ~10 ms apart, then the room tail. */
export function eClap({ seed = 3, bursts = [0, 0.0095, 0.0195, 0.031], tail = 0.17, bp = 1250, q = 1.1, bright = 0.35 } = {}) {
  const n = Math.round((bursts[bursts.length - 1] + tail + 0.03) * SR), y = new Float64Array(n), r = bipolar(rng(seed));
  const f1 = new SVF(bp, q), f2 = new SVF(bp * 2.2, 1.4), hp = new SVF(3200, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let env = 0;
    bursts.forEach((o, k) => { if (t >= o) env = Math.max(env, smooth((t - o) / 0.0004) * Math.exp(-(t - o) / (k === bursts.length - 1 ? tail / 4.6 : 0.0032))); });
    const x = r(); f1.tick(x); f2.tick(x); hp.tick(x);
    y[i] = env * (f1.bp + 0.55 * f2.bp + bright * hp.hp);
  }
  return norm(edges(y, 0.02), 0.95);
}

/** Electronic snare: two pitched sines with a short drop plus band-limited noise. */
export function eSnare({ seed = 5, tone = [182, 334], toneDecay = 0.12, noiseDecay = 0.18, toneLevel = 0.55, noiseLevel = 0.85, drive = 1.4 } = {}) {
  const n = Math.round((Math.max(toneDecay, noiseDecay) + 0.05) * SR), y = new Float64Array(n), r = bipolar(rng(seed));
  const hp = new Biquad('hp', 1500, 0.7), lp = new Biquad('lp', 9500, 0.7), ph = tone.map(() => 0);
  for (let i = 0; i < n; i++) {
    const t = i / SR, drop = 1 + 0.45 * Math.exp(-t / 0.012), att = smooth(t / 0.0005);
    let s = 0;
    tone.forEach((f, k) => { ph[k] += TAU * f * drop / SR; s += Math.sin(ph[k]) * (k ? 0.6 : 1); });
    y[i] = att * (toneLevel * s * Math.exp(-t / (toneDecay / 4.6)) + noiseLevel * lp.tick(hp.tick(r())) * Math.exp(-t / (noiseDecay / 4.6)));
  }
  return norm(edges(shape(norm(y), Math.tanh, drive), 0.02), 0.95);
}

/** The backbeat: clap layered on the snare. */
export function backbeat({ seed = 3, clap = 0.75, snare = 0.8, tail = 0.17, snareOpts = {} } = {}) {
  const c = eClap({ seed, tail }), s = eSnare({ seed: seed + 2, ...snareOpts }), y = new Float64Array(Math.max(c.length, s.length));
  for (let i = 0; i < y.length; i++) y[i] = clap * (c[i] ?? 0) + snare * (s[i] ?? 0);
  return norm(y, 0.95);
}

const HAT_F = [205.3, 304.4, 369.6, 522.7, 540, 800];
/** 808-style metallic hat: six detuned squares, band-passed high, short (closed) or long (open). */
export function eHat({ seed = 7, decay = 0.045, tune = 1.6, noise = 0.25, center = 10500 } = {}) {
  const n = Math.round((decay + 0.02) * SR), y = new Float64Array(n), r = bipolar(rng(seed + 99)), ph = rng(seed);
  const oscs = HAT_F.map(f => ({ o: new Osc(ph()), f: f * tune })), bp = new SVF(center, 1.1), h1 = new Biquad('hp', 7000, 0.7), h2 = new Biquad('hp', 7000, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let s = 0;
    for (const v of oscs) s += v.o.square(v.f);
    bp.tick(s / 6 + noise * r());
    y[i] = h2.tick(h1.tick(bp.bp)) * smooth(t / 0.0004) * Math.exp(-t / (decay / 4.6));
  }
  return norm(edges(y, Math.min(0.01, decay * 0.3)), 0.9);
}

/** Shaker: high-passed noise with a soft 4 ms attack. */
export function eShaker({ seed = 9, decay = 0.07, hp = 5500 } = {}) {
  const n = Math.round((decay + 0.02) * SR), y = new Float64Array(n), r = bipolar(rng(seed)), f = new Biquad('hp', hp, 0.7), g = new Biquad('lp', 13000, 0.7);
  for (let i = 0; i < n; i++) { const t = i / SR; y[i] = g.tick(f.tick(r())) * smooth(t / 0.004) * Math.exp(-t / (decay / 4.6)); }
  return norm(edges(y, 0.01), 0.9);
}

/** Electronic crash: metallic squares and noise, different on each side, long decay. Stereo. */
export function eCrash({ seed = 11, seconds = 2.2, decay = 1.7, tune = 1.15 } = {}) {
  const n = Math.round(seconds * SR), out = {};
  for (const [c, ch] of [[0, 'L'], [1, 'R']]) {
    const ph = rng(seed + 31 * c), r = bipolar(rng(seed + 7 + c)), y = new Float64Array(n);
    const oscs = HAT_F.flatMap((f, k) => [0.993, 1.007].map(d => ({ o: new Osc(ph()), f: f * tune * d * (1 + 0.013 * k * (c ? 1 : -1)) })));
    const bp = new SVF(7000, 0.6), h = new Biquad('hp', 2800, 0.7), sh = new Biquad('hs', 9000, 0.7, -4);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let s = 0;
      for (const v of oscs) s += v.o.square(v.f);
      bp.tick(s / oscs.length + 0.6 * r());
      const env = smooth(t / 0.0008) * (0.35 * Math.exp(-t / 0.05) + 0.65 * Math.exp(-t / (decay / 4.6)));
      y[i] = sh.tick(h.tick(bp.bp)) * env;
    }
    out[ch] = edges(y, 0.15);
  }
  return joint(out.L, out.R);
}

/** Electronic tom: a sine with a pitch drop and a soft click. */
export function eTom(midi, { decay = 0.28, drop = 0.6, seed = 13 } = {}) {
  const f0 = mtof(midi), n = Math.round((decay + 0.05) * SR), y = new Float64Array(n), r = bipolar(rng(seed));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += TAU * f0 * (1 + drop * Math.exp(-t / 0.02)) / SR;
    y[i] = (Math.sin(ph) + (t < 0.004 ? 0.3 * r() * (1 - t / 0.004) : 0)) * smooth(t / 0.0006) * Math.exp(-t / (decay / 4.6));
  }
  return norm(edges(shape(y, Math.tanh, 1.3), 0.02), 0.9);
}

// ================================================================== subtractive synth
/**
 * A patch: { osc: [{ wave: 'saw'|'square'|'sine'|'tri', level, detune (cents), octave, pw }],
 *   unison, spread (cents), width (stereo detune, cents),
 *   filter: { cutoff, env (octaves), decay, sustain, release, keytrack, q, poles: 2|4 },
 *   amp: { a, d, s, r }, pitchEnv: { semis, decay }, vibrato: { rate, depth, delay }, drive, noise }.
 */
function voiceBank(midis, patch, ch, seed) {
  const r = rng(seed * 7919 + ch * 104729 + 13), uni = patch.unison ?? 1, spread = patch.spread ?? 0, width = patch.width ?? 0;
  const voices = [];
  for (const m of midis) for (const o of patch.osc) for (let u = 0; u < uni; u++) {
    const off = uni > 1 ? spread * (u / (uni - 1) - 0.5) * 2 : 0;
    voices.push({ osc: new Osc(r()), wave: o.wave, level: (o.level ?? 1) / Math.sqrt(uni), pw: o.pw ?? 0.5,
      ratio: 2 ** (((o.octave ?? 0) * 1200 + (o.detune ?? 0) + off + (ch ? width : -width)) / 1200), base: mtof(m) });
  }
  return voices;
}
const wave = (v, f) => (v.wave === 'saw' ? v.osc.saw(f) : v.wave === 'square' ? v.osc.square(f, v.pw) : v.wave === 'sine' ? v.osc.sine(f) : (() => { const p = v.osc.p; v.osc.sine(f); return 4 * Math.abs(p - 0.5) - 1; })());

/** One note or chord as a one-shot of `seconds`, released at `gate`. Returns { L, R } (or mono when patch.mono). */
export function synthNote({ midis, seconds, gate, patch, seed = 1 }) {
  const n = Math.round(seconds * SR), g = gate ?? seconds - (patch.amp.r ?? 0.1) - 0.01, F = patch.filter ?? {}, A = patch.amp;
  const out = {}, chans = patch.mono ? ['L'] : ['L', 'R'], key = mtof(midis[0]);
  for (const [c, ch] of chans.entries()) {
    const voices = voiceBank(midis, patch, c, seed), stages = Array.from({ length: (F.poles ?? 4) / 2 }, (_, k) => new SVF(1000, k ? 0.7 : F.q ?? 0.8));
    const nz = bipolar(rng(seed + 50 + c)), y = new Float64Array(n);
    let aRel = 0, fRel = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, gated = t < g;
      // envelopes: linear attack, exponential decay to sustain, exponential release from the level at the gate
      const aOn = t < A.a ? t / A.a : A.s + (1 - A.s) * Math.exp(-(t - A.a) / Math.max(1e-4, A.d / 4.6));
      if (gated) aRel = aOn;
      const amp = gated ? aOn : aRel * Math.exp(-(t - g) / Math.max(1e-4, (A.r ?? 0.1) / 4.6));
      const fOn = (F.sustain ?? 0) + (1 - (F.sustain ?? 0)) * Math.exp(-t / Math.max(1e-4, (F.decay ?? 0.2) / 4.6));
      if (gated) fRel = fOn;
      const fenv = gated ? fOn : fRel * Math.exp(-(t - g) / Math.max(1e-4, (F.release ?? A.r ?? 0.1) / 4.6));
      const pe = patch.pitchEnv ? 2 ** (patch.pitchEnv.semis * Math.exp(-t / patch.pitchEnv.decay) / 12) : 1;
      const vb = patch.vibrato ? 2 ** (patch.vibrato.depth * Math.sin(TAU * patch.vibrato.rate * t) * smooth((t - patch.vibrato.delay) / 0.25) / 1200) : 1;
      let s = 0;
      for (const v of voices) s += v.level * wave(v, v.base * v.ratio * pe * vb);
      if (patch.noise) s += patch.noise * nz();
      const fc = clamp((F.cutoff ?? 2000) * 2 ** ((F.env ?? 0) * fenv) * (key / 261.63) ** (F.keytrack ?? 0), 30, 18000);
      let x = s / Math.max(1, Math.sqrt(midis.length));
      for (const st of stages) { st.set(fc, st === stages[0] ? F.q ?? 0.8 : 0.7); x = st.tick(x); }
      y[i] = x * amp;
    }
    out[ch] = patch.drive ? shape(norm(y, 0.8), Math.tanh, patch.drive) : y; // drive hits a fixed level, chord or single note
    hp2(out[ch], patch.hp ?? 30);
    edges(out[ch], 0.008, 0.0003);
  }
  if (patch.mono) return norm(out.L, 0.9);
  return joint(out.L, out.R);
}

/** A legato monophonic performance (glides, delayed vibrato, filter re-triggered on detached notes). Returns { L, R }. */
export function synthLine({ seconds, notes, patch, seed = 1, glide = 0.05 }) {
  const n = Math.round(seconds * SR), F = patch.filter ?? {}, A = patch.amp;
  const { f0, amp } = lanes(n, notes, { attack: A.a, release: A.r ?? 0.12, glide, legatoGap: 0.03 });
  // filter envelope: full re-trigger on detached notes, partial on legato ones
  const fenv = new Float64Array(n), vib = new Float64Array(n), ns = [...notes].sort((a, b) => a.t - b.t);
  ns.forEach((nt, k) => {
    const s0 = Math.round(nt.t * SR), s1 = k + 1 < ns.length ? Math.round(ns[k + 1].t * SR) : n, legato = k > 0 && nt.t - (ns[k - 1].t + ns[k - 1].dur) < 0.03;
    const depth = legato ? 0.45 : 1, start = legato ? fenv[Math.max(0, s0 - 1)] : 0;
    for (let i = s0; i < s1; i++) {
      const u = (i - s0) / SR;
      fenv[i] = Math.max(start * Math.exp(-u / 0.08), (F.sustain ?? 0) + depth * (1 - (F.sustain ?? 0)) * Math.exp(-u / Math.max(1e-4, (F.decay ?? 0.3) / 4.6)));
      vib[i] = (nt.vib ?? patch.vibrato?.depth ?? 0) * smooth((u - (patch.vibrato?.delay ?? 0.2)) / 0.3);
    }
  });
  const out = {};
  for (const [c, ch] of ['L', 'R'].entries()) {
    const voices = voiceBank([60], patch, c, seed), stages = Array.from({ length: (F.poles ?? 4) / 2 }, (_, k) => new SVF(1000, k ? 0.7 : F.q ?? 0.8));
    const y = new Float64Array(n);
    let vp = c * 0.7;
    for (let i = 0; i < n; i++) {
      vp += TAU * (patch.vibrato?.rate ?? 5.5) / SR;
      const f = f0[i] * 2 ** (vib[i] * Math.sin(vp) / 1200);
      let s = 0;
      for (const v of voices) s += v.level * wave(v, f * v.ratio);
      const fc = clamp((F.cutoff ?? 2000) * 2 ** ((F.env ?? 0) * fenv[i]) * (f0[i] / 261.63) ** (F.keytrack ?? 0), 30, 18000);
      let x = s;
      for (const st of stages) { st.set(fc, st === stages[0] ? F.q ?? 0.8 : 0.7); x = st.tick(x); }
      y[i] = x * amp[i];
    }
    out[ch] = patch.drive ? shape(norm(y, 0.8), Math.tanh, patch.drive) : y;
    hp2(out[ch], patch.hp ?? 80);
  }
  // ensemble: a slowly modulated short delay per side gives a doubled, decorrelated image
  const dl = new Delay(0.05), dr = new Delay(0.05), w = patch.ensemble ?? 0.25;
  for (let i = 0; i < n; i++) {
    dl.write(out.L[i]); dr.write(out.R[i]);
    const ml = (0.012 + 0.002 * Math.sin(TAU * 0.53 * i / SR)) * SR, mr = (0.016 + 0.002 * Math.sin(TAU * 0.41 * i / SR + 1.1)) * SR;
    out.L[i] += w * dl.read(ml); out.R[i] += w * dr.read(mr);
  }
  return joint(out.L, out.R);
}

// ================================================================== patches
export const PATCH = {
  // warm punchy bass: saw + square an octave down, 24 dB low-pass snapping shut, mono
  bass: { mono: true, osc: [{ wave: 'saw', level: 0.85 }, { wave: 'square', level: 0.45, pw: 0.5, detune: -4 }, { wave: 'sine', level: 0.6 }],
    filter: { cutoff: 620, env: 2.0, decay: 0.2, sustain: 0.4, keytrack: 0.2, q: 1.05, poles: 4 }, amp: { a: 0.002, d: 0.3, s: 0.8, r: 0.035 }, drive: 2.4, hp: 30 },
  // P's lead: a resonant square/saw pluck-lead with a pitch blip on the attack (distinctive "pew")
  pluckLead: { osc: [{ wave: 'square', level: 0.6, pw: 0.42 }, { wave: 'saw', level: 0.6, detune: 7 }, { wave: 'saw', level: 0.45, detune: -9 }],
    width: 4, filter: { cutoff: 1100, env: 2.6, decay: 0.22, sustain: 0.3, keytrack: 0.6, q: 1.5, poles: 4 }, amp: { a: 0.003, d: 0.35, s: 0.55, r: 0.09 },
    pitchEnv: { semis: 0.7, decay: 0.012 }, drive: 1.5, hp: 120 },
  // L's soaring lead: two detuned saws and a pulse, open filter with a soft bloom, vibrato, ensemble
  soarLead: { osc: [{ wave: 'saw', level: 0.7, detune: -6 }, { wave: 'saw', level: 0.7, detune: 6 }, { wave: 'square', level: 0.35, pw: 0.3, octave: -1 }],
    width: 3, filter: { cutoff: 1500, env: 1.4, decay: 0.45, sustain: 0.35, keytrack: 0.5, q: 1.05, poles: 4 }, amp: { a: 0.012, d: 0.4, s: 0.85, r: 0.18 },
    vibrato: { rate: 5.6, depth: 16, delay: 0.22 }, drive: 1.3, hp: 140, ensemble: 0.3 },
  // arpeggio pluck: pulse + saw, fast filter decay
  arp: { osc: [{ wave: 'square', level: 0.6, pw: 0.28 }, { wave: 'saw', level: 0.5, detune: 5 }], width: 6,
    filter: { cutoff: 800, env: 3.0, decay: 0.15, sustain: 0.08, keytrack: 0.6, q: 1.25, poles: 4 }, amp: { a: 0.002, d: 0.16, s: 0.0, r: 0.06 }, drive: 1.3, hp: 180 },
  // chord stab: supersaw-lite, quick filter fall
  stab: { osc: [{ wave: 'saw', level: 0.7 }, { wave: 'saw', level: 0.7, detune: 12 }], unison: 2, spread: 14, width: 5,
    filter: { cutoff: 1100, env: 2.0, decay: 0.22, sustain: 0.3, keytrack: 0.3, q: 0.9, poles: 4 }, amp: { a: 0.003, d: 0.25, s: 0.5, r: 0.12 }, drive: 1.3, hp: 140 },
  // warm pad: slow attack, gently moving filter, wide
  pad: { osc: [{ wave: 'saw', level: 0.6, detune: -7 }, { wave: 'saw', level: 0.6, detune: 7 }, { wave: 'tri', level: 0.4, octave: 1 }], unison: 2, spread: 10, width: 8,
    filter: { cutoff: 900, env: 1.1, decay: 1.1, sustain: 0.4, keytrack: 0.2, q: 0.75, poles: 4 }, amp: { a: 0.09, d: 0.8, s: 0.8, r: 0.35 }, drive: 1.15, hp: 160 },
  // intro blips: a soft triangle with a downward pitch flick (the "robot answer")
  blip: { osc: [{ wave: 'tri', level: 1 }, { wave: 'sine', level: 0.6, octave: 1 }], width: 3,
    filter: { cutoff: 1800, env: 1.2, decay: 0.09, sustain: 0.3, q: 0.7, poles: 2 }, amp: { a: 0.002, d: 0.22, s: 0, r: 0.06 }, pitchEnv: { semis: 2, decay: 0.01 }, hp: 200 },
  // L's intro bell-pluck: warm (triangle + sine), not a music box
  bell: { osc: [{ wave: 'tri', level: 0.9 }, { wave: 'sine', level: 0.6 }, { wave: 'square', level: 0.12, octave: 1, pw: 0.5 }], width: 4,
    filter: { cutoff: 1300, env: 1.0, decay: 0.3, sustain: 0.25, keytrack: 0.4, q: 0.7, poles: 2 }, amp: { a: 0.004, d: 0.9, s: 0, r: 0.2 }, hp: 150 },
};
