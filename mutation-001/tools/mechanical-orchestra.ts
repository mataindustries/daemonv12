/**
 * MUTATION C · MECHANICAL ORCHESTRA. Playable, pitched physical machines. Each voice takes pitch, velocity, a morph
 * value (0 beautiful .. 1 strange) and its own articulation inputs, and returns one mono note.
 *
 *   malletBar  modal bar: mode ratios morph from a consonant tuned bar (1:4:10, vibraphone-style motor tremolo)
 *              through a free-free bar (1:2.756:5.404) to an alien gong set (1:1.493:2.41) with beating twin modes
 *   bowedBar   the same bar driven by friction: a stick-slip pulse train with rosin noise excites the modes;
 *              overpressure (`sub`) makes the slip skip periods (octave or twelfth subharmonics); `chatter` = stick noise
 *   spring     dispersive coil spring: delay loop + chain of first-order all-passes (low frequencies travel slower),
 *              tuned by compensating the chain's delay; morph raises the dispersion from a near-harmonic plucked steel
 *              string to a long chirping "laser" spring; `bend` = the twang of the attack
 *   tine       clamped steel tine (cantilever mode ratios 1:6.27:17.55) with a bridge-contact buzz (`buzz`) like a sitar
 *   tick       escapement tick (small high modes) or tock (lower modes), for the clockwork pulse
 * Original code; only the dsp.ts primitives. No samples or recordings.
 */
import { SR, TAU, Rng, SVF, OnePole, DelayLine, midiHz, clamp, smooth, edgeFade, dcBlock, type Wave } from './dsp.ts';

const n = (sec: number) => Math.round(sec * SR);
const logLerp = (a: number, b: number, x: number) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * x);

const TUNED = [1, 4, 10, 15.9, 21.1], FREE = [1, 2.756, 5.404, 8.933, 13.34], ALIEN = [1, 1.493, 2.41, 3.73, 6.13];
/** Bar mode ratios along the beautiful -> strange path. */
export function barRatios(m: number): number[] {
  return TUNED.map((_, k) => m < 0.5 ? logLerp(TUNED[k]!, FREE[k]!, smooth(m / 0.5)) : logLerp(FREE[k]!, ALIEN[k]!, smooth((m - 0.5) / 0.5)));
}

export interface BarOpts { damp?: number; hard?: number; seed?: number; len?: number; cents?: number }
export function malletBar(p: number, v: number, m: number, o: BarOpts = {}): Wave {
  const f0 = midiHz(p) * Math.pow(2, (o.cents ?? 0) / 1200), r = barRatios(m), rng = new Rng(o.seed ?? 1), damp = o.damp ?? 1;
  const tau0 = 1.5 * Math.pow(440 / f0, 0.45) * (1 + 1.3 * m) * damp;
  const N = n(o.len ?? Math.min(7, 4.6 * tau0 + 0.1)), y = new Float64Array(N);
  const hard = clamp((o.hard ?? 0.5) * (0.6 + 0.6 * v), 0, 1.2), fc = 900 + 7000 * hard;
  const AMP = [1, 0.5, 0.28, 0.14, 0.08], DEC = [1, 0.42, 0.24, 0.14, 0.09];
  const trem = 0.5 * (1 - smooth(m / 0.45)), beat = 1.1 * smooth((m - 0.4) / 0.6);
  for (let k = 0; k < 5; k++) {
    const f = f0 * r[k]!; if (f > 17000) continue;
    const a = AMP[k]! * v / Math.sqrt(1 + (f / fc) ** 4), dec = Math.exp(-1 / (tau0 * DEC[k]! * SR)), ph = rng.next() * TAU;
    const tw = beat * (0.4 + rng.next()), wTw = 0.6 * smooth((m - 0.4) / 0.6), norm = 1 / Math.sqrt(1 + wTw * wTw);
    let e = a * norm;
    for (let i = 0; i < N && e > 1e-6; i++) { const t = i / SR; y[i] += e * (Math.sin(TAU * f * t + ph) + wTw * Math.sin(TAU * (f + tw) * t + 1.7 * ph)); e *= dec; }
  }
  const click = new SVF().set(fc, 0.8);
  for (let i = 0; i < Math.min(N, n(0.004)); i++) { click.tick(rng.bi() * Math.exp(-i / (0.0008 * SR))); y[i] += click.bpn * 0.3 * hard * v; }
  if (trem > 0) for (let i = 0; i < N; i++) y[i] *= 1 - trem * 0.5 * (1 - Math.cos(TAU * 5.4 * i / SR));
  return edgeFade(y, 0.0003, 0.05);
}

export interface BowOpts { seed?: number; sub?: number; subN?: number; chatter?: number; attack?: number }
export function bowedBar(p: number, d: number, v: number, m: number, o: BowOpts = {}): Wave {
  const f0 = midiHz(p), r = barRatios(m), rng = new Rng(o.seed ?? 3), N = n(d + 1.4 * (1 + m));
  const tau0 = 2.0 * Math.pow(440 / f0, 0.3) * (1 + m);
  const res = r.map((rk, k) => ({ f: new SVF().set(f0 * rk, Math.PI * f0 * rk * tau0 * [1, 0.5, 0.3, 0.2, 0.15][k]!), g: [1, 0.55, 0.35, 0.22, 0.14][k]! }));
  const sub = o.sub ?? 0, subN = o.subN ?? 2, chatter = o.chatter ?? 0.05, attack = o.attack ?? 0.4;
  const hair = new SVF().set(2200 + 3000 * m, 0.6), y = new Float64Array(N);
  let ph = rng.next(), cnt = 0, pulse = 99, pAmp = 0;
  const comp = Math.pow(4.6, m); // measured: level falls ~13 dB from m=0 to m=1 without it
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const press = v * (t < d ? smooth(t / attack) * (0.86 + 0.14 * Math.sin(TAU * 0.6 * t)) : Math.max(0, 1 - (t - d) / 0.15));
    ph += f0 * (1 + chatter * 0.015 * rng.bi()) / SR;
    if (ph >= 1) { ph -= 1; cnt++; pAmp = press * (cnt % subN === 0 ? 1 : 1 - sub) * Math.max(0, 1 + chatter * 0.6 * rng.gauss()); pulse = 0; }
    const ex = (pulse < 16 ? pAmp * 0.5 * (1 - Math.cos(TAU * pulse / 16)) : 0) + press * rng.bi() * 0.02 * (1 + 4 * chatter); pulse++;
    let s = 0; for (const { f, g } of res) { f.tick(ex); s += f.bpn * g; }
    hair.tick(ex);
    y[i] = (s + hair.bp * 0.08) * comp;
  }
  return edgeFade(dcBlock(y, 30), 0.001, 0.1);
}

export interface SpringOpts { len?: number; seed?: number; bend?: number; t60?: number }
export function spring(p: number, v: number, m: number, o: SpringOpts = {}): Wave {
  // the loop is tuned so its 3rd partial sits exactly at 3 f0, keeping the low harmonics (which set the perceived pitch)
  // in tune while dispersion stretches the upper ones (spectrum of A1 at m=1: 55.2, 109.7, 164.9, 220.0, 275.2 Hz)
  const f0 = midiHz(p), rng = new Rng(o.seed ?? 5), a = -(0.42 + 0.3 * m), w0 = TAU * 3 * f0 / SR;
  const lpP = Math.exp(-TAU * (4500 + 2500 * (1 - m)) / SR);
  // phase delays (samples) at f0 of one all-pass stage and of the loop low-pass: the loop resonates exactly at f0
  const pdAp = -(Math.atan2(-Math.sin(w0), a + Math.cos(w0)) - Math.atan2(-a * Math.sin(w0), 1 + a * Math.cos(w0))) / w0;
  const pdLp = Math.atan2(lpP * Math.sin(w0), 1 - lpP * Math.cos(w0)) / w0;
  let M = Math.round(3 + 50 * m), D = 0;
  const loop = () => SR / f0 - 1 - M * pdAp - pdLp;
  for (D = loop(); D < 4 && M > 0; D = loop()) M--;
  const t60 = o.t60 ?? 1.3 * Math.pow(110 / f0, 0.25) * (1 + 0.8 * m), g = Math.pow(10, -3 / (t60 * f0));
  const N = n(o.len ?? Math.min(5, t60 + 0.2)), y = new Float64Array(N), line = new DelayLine(D + 8);
  const apY = new Float64Array(M), apX = new Float64Array(M), exLp = new OnePole(350 + 2200 * v), bend = o.bend ?? (0.02 + 0.08 * m);
  let lp = 0;
  for (let i = 0; i < N; i++) {
    // pluck: one smooth zero-mean cycle (a raw impulse came out of the loop as a ~28 dB-crest click) plus a noise breath
    const t = i / SR, ex = (t < 0.003 ? Math.sin(TAU * t / 0.003) * 0.35 : 0) * v + (t < 0.006 ? exLp.lp(rng.bi() * (1 - t / 0.006)) * v * 0.7 : 0);
    let s = line.read(D * (1 - bend * Math.exp(-t / 0.07)));
    for (let k = 0; k < M; k++) { const yk = a * s + apX[k]! - a * apY[k]!; apX[k] = s; apY[k] = yk; s = yk; }
    lp = (1 - lpP) * s + lpP * lp;
    line.write(lp * g + ex);
    y[i] = s;
  }
  return edgeFade(dcBlock(y, 25), 0.0003, 0.08);
}

export interface TineOpts { buzz?: number; seed?: number; cents?: number }
export function tine(p: number, v: number, o: TineOpts = {}): Wave {
  const f0 = midiHz(p) * Math.pow(2, (o.cents ?? 0) / 1200), rng = new Rng(o.seed ?? 7), buzz = o.buzz ?? 0;
  const R = [1, 6.27, 17.55, 34.39], A = [1, 0.3, 0.09, 0.035], T = [1, 0.28, 0.1, 0.05];
  const tau0 = 1.1 * Math.pow(523 / f0, 0.5), N = n(Math.min(4, 4 * tau0 + 0.1)), y = new Float64Array(N);
  for (let k = 0; k < 4; k++) {
    const f = f0 * R[k]!; if (f > 17000) continue;
    const dec = Math.exp(-1 / (tau0 * T[k]! * SR)), ph = rng.next() * TAU; let e = A[k]! * v;
    for (let i = 0; i < N && e > 1e-6; i++) { y[i] += e * Math.sin(TAU * f * i / SR + ph); e *= dec; }
  }
  if (buzz > 0) {
    const hp = new SVF().set(3400, 0.7), body = new SVF().set(f0 * 3.01, 3), envDec = Math.exp(-1 / (tau0 * SR));
    let env = v;
    for (let i = 0; i < N; i++) {
      const thr = env * (0.85 - 0.62 * buzz), x = y[i]!, ex = x - clamp(x, -thr, thr);
      hp.tick(rng.bi()); body.tick(ex);
      y[i] = (x + buzz * (ex * 2 + hp.hp * Math.abs(ex) * 5 + body.bpn * 0.6)) / (1 + 0.6 * buzz + 1.5 * buzz * buzz); env *= envDec;
    }
  }
  return edgeFade(y, 0.0002, 0.05);
}

export function tick(v: number, tock: boolean, seed: number): Wave {
  const rng = new Rng(seed), F = tock ? [880, 1312, 2468] : [3150, 4720, 7910], Tm = tock ? [0.05, 0.03, 0.014] : [0.012, 0.008, 0.005];
  const N = n(tock ? 0.25 : 0.06), y = new Float64Array(N), cl = new SVF().set(tock ? 2500 : 6000, 0.9);
  for (let k = 0; k < 3; k++) { const dec = Math.exp(-1 / (Tm[k]! * SR)), ph = rng.next() * TAU; let e = v * [1, 0.6, 0.35][k]! * (0.85 + 0.3 * rng.next()); for (let i = 0; i < N; i++) { y[i] += e * Math.sin(TAU * F[k]! * i / SR + ph); e *= dec; } }
  for (let i = 0; i < n(0.002); i++) { cl.tick(rng.bi() * (1 - i / n(0.002))); y[i] += cl.bpn * v * 0.6; }
  return edgeFade(y, 0.0001, 0.01);
}
