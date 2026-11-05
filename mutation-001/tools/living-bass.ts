/**
 * MUTATION A · LIVING BASS. A bass phrase rendered as one continuous performance whose timbre is a continuous
 * function of time, so a groove can turn from one instrument into another without a cut.
 *
 * Warm end: a West Coast complex oscillator (sine core, gentle 1:1 phase modulation, light sine folding) through
 * a vactrol-style low-pass gate, over a clean phase-locked sine sub; slides are damped "finger" springs.
 * Machine end: deep folding and phase modulation (1:1 edge, 1:2 sub-octave grind), a phase-locked sub-octave
 * "gear" chopper, asymmetric tube drive, a pitch-tracked harmonic selector that only lifts octaves and fifths,
 * modal metal "chassis" strikes, and servo slides that overshoot and ratchet through semitones with a click per
 * tooth. A tempo-synced modulation lane drives fold, sub-grind, gate opening, gear and harmonic selection.
 *
 * Independent inputs: pitch (per note, slides, scoops, dives), duration, articulation (accent, ghost, staccato,
 * legato slide), the `morph` macro, and every timbre dimension through `over` lanes. Mono, 44.1 kHz float.
 * Built only from the vendored HEADLINER 001 primitives in dsp.ts; no samples or external audio.
 */
import { SR, TAU, Rng, SVF, Biquad, midiHz, clamp, lerp, smooth, tube, decimate, dcBlock, edgeFade, type Wave } from './dsp.ts';
import type { Lane } from './score.ts';

export type Art = 'normal' | 'ghost' | 'accent' | 'stacc';
export interface BNote {
  /** onset and gate length in seconds, pitch in MIDI semitones (fractional allowed) */
  t: number; d: number; p: number;
  v?: number; art?: Art;
  /** seconds of physical travel from the sounding pitch: a legato slide, no new strike */
  slide?: number;
  /** semitones below the note to slide in from on a fresh strike */
  scoop?: number;
  /** semitones to dive over the last `diveSec` of the gate */
  dive?: number; diveSec?: number;
}

/** Timbre dimensions, 0..1. */
export interface BassTimbre {
  fold: number; pm: number; grind: number; gear: number; drive: number; bright: number; hold: number;
  chassis: number; ratchet: number; servo: number; motion: number; harm: number; body: number;
}
export type TimbreKey = keyof BassTimbre;
/** The default transformation path: one macro `m` (0 warm .. 1 machine) mapped to every dimension. */
export function bassMacro(m: number): BassTimbre {
  const s = (a: number, b: number) => smooth((m - a) / (b - a));
  return {
    fold: 0.12 + 0.88 * Math.pow(m, 1.25), // sine-folder gain: harmonic richness
    pm: 0.75 + 0.75 * m,                    // 1:1 phase-modulation index: saw-like edge
    grind: 1.15 * s(0.4, 1),               // 1:2 phase modulation: sub-octave grind
    gear: 0.7 * s(0.5, 1),                 // phase-locked sub-octave chopper depth
    drive: 0.1 + 0.9 * m,                  // asymmetric tube drive
    bright: 0.16 + 0.84 * Math.pow(m, 0.85), // low-pass-gate opening range
    hold: 0.42 + 0.42 * m,                  // gate opening while a note is held
    chassis: s(0.2, 0.85),                 // metal frame strikes and ratchet clicks
    ratchet: s(0.45, 0.85),                // slides step through semitones
    servo: s(0.3, 1),                      // 0 damped finger slide .. 1 overshooting servo
    motion: s(0.12, 0.6),                  // depth of the rhythmic modulation lane
    harm: s(0.3, 0.8),                     // octave/fifth harmonic selector
    body: 0.75 + 0.25 * m,                 // harmonic body level over the constant sub
  };
}

export interface BassOpts {
  morph: Lane;
  /** tempo-synced modulation in [0,1]; 1 when absent */
  motion?: Lane;
  /** per-dimension overrides; each replaces the macro's value */
  over?: Partial<Record<TimbreKey, Lane>>;
  /** harmonics the selector may lift (default octaves and fifths) */
  harmonics?: number[];
  seed?: number; tail?: number;
}

/** Inharmonic "chassis" modes: frequency Hz, decay s, level. */
const CHASSIS: [number, number, number][] = [
  [97.3, 0.34, 0.5], [231, 0.24, 1], [388, 0.17, 0.8], [611, 0.12, 0.65], [1043, 0.08, 0.5], [1718, 0.05, 0.38], [2893, 0.03, 0.28],
];

export function livingBass(notes: BNote[], o: BassOpts): Wave {
  const os = 4, fs = SR * os, seq = [...notes].sort((a, b) => a.t - b.t);
  const end = Math.max(...seq.map(x => x.t + x.d)) + (o.tail ?? 0.5), N = Math.round(end * fs);
  const y = new Float64Array(N), rng = new Rng(o.seed ?? 5), harmonics = o.harmonics ?? [2, 3, 4, 6];
  const lpg1 = new SVF(fs), lpg2 = new SVF(fs), sel = new SVF(fs), hp = new Biquad('hp', 50, 0.62, 0, fs), contact = new SVF(fs).set(3600, 0.9);
  const modes = CHASSIS.map(([f, tau, a]) => ({ w: TAU * f / fs, ph: TAU * rng.next(), dec: Math.exp(-1 / (tau * fs)), a, e: 0 }));
  const cr = 16, cSm = 1 - Math.exp(-cr / (0.004 * fs)), contactDec = Math.exp(-1 / (0.0015 * fs));
  let Phi = 0, p = seq[0]!.p, pv = 0, amp = 0, lev = 0, ni = -1, strikeAt = -1e9, strikeLev = 0;
  let wn = 150, zeta = 0.9, aUp = 0.01, aDn = 0.001, vel = 0.82, mrS = 1, selHz = 200, drift = 0, stepPrev = Math.round(p);
  let T = bassMacro(clamp(o.morph(0), 0, 1)), m = 0, contactE = 0, lDn = 0.001, dNorm = 1, f0 = midiHz(p);
  const lUp = 1 - Math.exp(-1 / (0.0015 * fs));
  for (let i = 0; i < N; i++) {
    const t = i / fs;
    // ---------------------------------------------------------------- note events
    while (ni + 1 < seq.length && t >= seq[ni + 1]!.t) {
      ni++;
      const nt = seq[ni]!, prev = seq[ni - 1];
      const legato = !!prev && !!nt.slide && prev.t + prev.d >= nt.t - 0.015;
      vel = nt.v ?? (nt.art === 'ghost' ? 0.5 : nt.art === 'accent' ? 1 : 0.82);
      if (legato) wn = 4.6 / Math.max(0.012, nt.slide!);
      else {
        // fresh strike: a plucked string starts a little sharp; a servo kicks past and settles
        p = nt.p - (nt.scoop ?? 0) + (nt.scoop ? 0 : 0.12 + 0.5 * T.servo); pv = 0;
        wn = 4.6 / (nt.scoop ? 0.075 : 0.03);
      }
      zeta = lerp(0.92, 0.5, T.servo);
      strikeAt = t; strikeLev = legato ? 0.45 : nt.art === 'ghost' ? 0.55 : nt.art === 'accent' ? 1 : 0.85;
      aUp = 1 - Math.exp(-1 / ((nt.art === 'stacc' || nt.art === 'accent' ? 0.0012 : 0.0035) * fs));
      aDn = 1 - Math.exp(-1 / ((nt.art === 'stacc' ? 0.016 : nt.art === 'ghost' ? 0.025 : 0.05) * fs));
      const hit = (legato ? 0.25 : 1) * vel * (nt.art === 'accent' ? 1.5 : nt.art === 'ghost' ? 0.4 : 1) * T.chassis;
      for (const md of modes) md.e = Math.min(1.2, md.e + hit * md.a * 0.5);
      contactE = Math.max(contactE, hit);
    }
    const nt = seq[Math.max(0, ni)]!, gate = ni >= 0 && t < nt.t + nt.d, tn = t - nt.t;
    // ---------------------------------------------------------------- control rate
    if (i % cr === 0) {
      m = clamp(o.morph(t), 0, 1); T = bassMacro(m);
      if (o.over) for (const k of Object.keys(o.over) as TimbreKey[]) T[k] = clamp(o.over[k]!(t), 0, 1.5);
      mrS += ((o.motion ? clamp(o.motion(t), 0, 1) : 1) - mrS) * cSm;
      drift = drift * 0.99995 + rng.bi() * 0.003;
      lDn = 1 - Math.exp(-1 / (0.05 * (1 + 4 * (1 - lev)) * fs)); // vactrol: the dimmer, the slower
      const mm = 1 - T.motion + T.motion * mrS;
      const fc = 30 + f0 * (2 + 4 * lev) + 7200 * T.bright * Math.pow(lev, 1.8);
      lpg1.set(fc, 0.72); lpg2.set(fc * 1.35, 0.6);
      const h = harmonics[Math.min(harmonics.length - 1, Math.floor(mm * 0.999 * harmonics.length))]!;
      selHz += (h * f0 - selHz) * cSm; sel.set(selHz, 6);
      const D = 1 + 7 * T.drive; dNorm = 1 / Math.tanh(0.75 * D);
      if (i % (cr * 4) === 0) hp.set('hp', 42 + 48 * T.drive, 0.62);
    }
    // ---------------------------------------------------------------- pitch: spring slide, dive, ratchet
    let target = nt.p;
    if (nt.dive && gate) { const ds = nt.diveSec ?? 0.3, t0 = nt.d - ds; if (tn > t0) target -= nt.dive * smooth((tn - t0) / ds); }
    pv += (wn * wn * (target - p) - 2 * zeta * wn * pv) / fs; p += pv / fs;
    const k = Math.round(p), fr = p - k, stair = k + 0.5 * Math.sign(fr) * Math.pow(Math.abs(2 * fr), 7);
    const pd = p + T.ratchet * (stair - p);
    if (k !== stepPrev) {
      stepPrev = k;
      if (Math.abs(pv) > 4) { const e = 0.35 * T.ratchet * T.chassis; for (let j = 2; j < modes.length; j++) modes[j]!.e = Math.min(1.2, modes[j]!.e + e * modes[j]!.a); contactE = Math.max(contactE, e); }
    }
    f0 = midiHz(pd) * (1 + 0.000578 * 4 * drift);
    Phi += f0 / fs;
    const ph = TAU * Phi;
    // ---------------------------------------------------------------- envelopes
    const aT = gate ? vel * (0.8 + 0.2 * Math.exp(-tn / 0.35)) : 0;
    amp += (aT - amp) * (aT > amp ? aUp : aDn);
    const mm = 1 - T.motion + T.motion * mrS;
    let lT = gate ? T.hold * (0.55 + 0.45 * vel) + T.motion * 0.4 * T.bright * mrS : 0;
    if (t - strikeAt < 0.004) lT = Math.max(lT, strikeLev);
    lev += (lT - lev) * (lT > lev ? lUp : lDn);
    // ---------------------------------------------------------------- voice
    const s = Math.sin(ph + T.pm * (0.6 + 0.4 * mm) * Math.sin(ph) + T.grind * mm * Math.sin(0.5 * ph));
    const v = Math.sin(0.5 * Math.PI * (1 + 5 * T.fold * (0.3 + 0.7 * mm)) * s);
    let b = lpg2.tick(lpg1.tick(v));
    sel.tick(b); b += T.harm * 0.9 * sel.bpn;
    b = tube(b, 1 + 7 * T.drive, 0.14) * dNorm;
    const gd = T.gear * (0.5 + 0.5 * mm);
    b *= 1 - gd + gd * (0.5 + 0.5 * Math.tanh(4 * Math.sin(0.5 * ph + 0.4)));
    const body = hp.tick(b);
    const sub = Math.tanh(1.15 * (Math.sin(ph) + 0.06 * Math.sin(2 * ph)));
    let ch = 0;
    for (const md of modes) { md.ph += md.w; if (md.ph > TAU) md.ph -= TAU; ch += md.e * Math.sin(md.ph); md.e *= md.dec; }
    contact.tick(rng.bi() * contactE); contactE *= contactDec;
    y[i] = amp * (sub * 0.68 * (1 - 0.1 * m) + body * T.body * 0.62 * (0.55 + 0.45 * lev)) + ch * 0.16 + contact.bpn * 0.35;
  }
  let out = dcBlock(decimate(y, os), 14);
  const lp = new Biquad('lp', 11500, 0.7), lo = new Biquad('hp', 24, 0.7);
  out = out.map(x => lp.tick(lo.tick(x)));
  return edgeFade(out, 0.0005, 0.08);
}
