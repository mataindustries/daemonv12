/** SAMPLE LAB 02 / B — OBJECT ORCHESTRA: the source "recordings", one take per object, made by physical models.
 *
 * No microphone was available to this lab, so each object is built from its physics: modal resonators for rigid bodies
 * (mug, spoon, box, table, coin, bowl), Minnaert bubble chirps for water, contact-time-limited strikes for hands and
 * spoons, and a small kitchen for the room. Each take holds several performances (different strength, spot and
 * timing) like a real recording session; TAKES exports where each hit starts.
 *
 * mug.wav    A large ceramic mug struck with a teaspoon. Modes 1 : 2.40 : 4.27 : 6.55 … (the second partial is a minor
 *            tenth, like a bell's tierce), each split into a slowly beating doublet by the handle.
 * drips.wav  A dripping tap into a bowl of water: Minnaert bubbles that ring and chirp upwards, two plain splashes.
 * box.wav    A fist on a closed cardboard box: a tension-dropping panel boom, a slap and a paper rattle.
 * book.wav   A hardback book slapped flat on a wooden table: crack, squeezed-air whump, table body, page flutter.
 * coin.wav   A coin spun on the table until it falls: an accelerating rolling whirr (Euler's disk), then the clatter.
 * Seeded, Node only. */
import { RATE, TAU, frames, rng, noise, filter, bq, onePoleHigh, onePoleLow, mix, space, type Wave } from './dsp.ts';

export const MUG_HZ = 880;  // the mug's lowest mode (A5); a quarter-speed print puts it on A3, a second pass on A1

interface Mode { f: number; t60: number; a: number }
/** Drive a bank of decaying modes with an excitation signal. Each mode's impulse response is a·r^n·sin((n+1)ω). */
function modal(exc: Wave, modes: Mode[], n: number): Wave {
  const y = new Float64Array(n), x = new Float64Array(n);
  x.set(exc.subarray(0, Math.min(exc.length, n)));
  for (const m of modes) {
    if (m.f <= 0 || m.f >= 0.47 * RATE || m.a === 0) continue;
    const r = Math.exp(-6.9078 / (m.t60 * RATE)), w = TAU * m.f / RATE, c1 = 2 * r * Math.cos(w), c2 = -r * r, g = m.a * Math.sin(w);
    let y1 = 0, y2 = 0;
    for (let i = 0; i < n; i++) { const o = g * x[i]! + c1 * y1 + c2 * y2; y2 = y1; y1 = o; y[i]! += o; if (i > exc.length && Math.abs(o) < 1e-9 && Math.abs(y2) < 1e-9) break; }
  }
  return y;
}
/** A strike force pulse: half-sine of `ms` contact time with unit area (soft strikes are long, hard ones short). */
function strike(ms: number): Wave {
  const len = Math.max(2, Math.round(ms * RATE / 1000)), x = new Float64Array(len);
  for (let i = 0; i < len; i++) x[i] = Math.PI / (2 * len) * Math.sin(Math.PI * (i + 0.5) / len);
  return x;
}
function burst(rand: () => number, ms: number, decayMs: number, attackMs = 0.3): Wave {
  const len = frames(ms / 1000), x = noise(len, rand);
  for (let i = 0; i < len; i++) { const t = i / RATE * 1000; x[i]! *= Math.min(1, t / attackMs) * Math.exp(-t / decayMs); }
  return x;
}
/** The kitchen: a small, slightly live room; returns stereo with the dry source in the middle. */
function kitchen(dry: Wave, wet: number, seconds: number): [Wave, Wave] {
  const [l, r] = space(dry, { rt60: 0.42, size: 0.55, damping: 0.35, predelayMs: 1.5, early: [[2.1, 0.32, 0.18], [4.3, 0.16, 0.3], [6.9, 0.2, 0.14], [9.8, 0.1, 0.16]] }, 0.6);
  const n = frames(seconds), L = new Float64Array(n), R = new Float64Array(n);
  for (let i = 0; i < n; i++) { const d = dry[i] ?? 0; L[i] = d + wet * (l[i] ?? 0); R[i] = d + wet * (r[i] ?? 0); }
  return [L, R];
}
const vary = (rand: () => number, x: number, spread: number) => x * (1 + spread * (2 * rand() - 1));
/** Scale a component to unit peak, so each object's balance is set by explicit relative levels. */
function unit(x: Wave): Wave { let p = 0; for (const v of x) p = Math.max(p, Math.abs(v)); const y = new Float64Array(x.length); if (p > 0) for (let i = 0; i < x.length; i++) y[i] = x[i]! / p; return y; }
function sum(len: number, ...parts: [Wave, number][]): Wave { const y = new Float64Array(len); for (const [x, g] of parts) for (let i = 0; i < Math.min(len, x.length); i++) y[i]! += g * x[i]!; return y; }

// ---------------------------------------------------------------- mug and teaspoon
const MUG_MODES: [ratio: number, t60: number, a: number][] = [
  [1.0, 1.5, 1.0], [1.0034, 1.4, 0.55], [2.4, 0.95, 0.62], [2.409, 0.9, 0.4], [4.27, 0.55, 0.4], [4.288, 0.5, 0.26],
  [6.55, 0.32, 0.26], [9.24, 0.2, 0.18], [12.31, 0.12, 0.12], [15.8, 0.08, 0.08],
];
export function mugTake(seed = 0x0b1e_0001) {
  const rand = rng(seed), seconds = 7.4, n = frames(seconds), dry = new Float64Array(n);
  const hits = [{ at: 0.15, v: 1.0, ms: 0.14 }, { at: 1.95, v: 0.7, ms: 0.22 }, { at: 3.75, v: 0.9, ms: 0.12 }, { at: 5.55, v: 0.6, ms: 0.3 }];
  for (const h of hits) {
    const len = frames(1.8), exc = strike(h.ms);
    const modes = MUG_MODES.map(([ratio, t60, a]) => ({ f: MUG_HZ * ratio, t60: vary(rand, t60, 0.08), a: a * (0.55 + 0.45 * rand()) }));
    const body = modal(exc, modes, len);
    const spoon = modal(exc, [{ f: vary(rand, 3150, 0.03), t60: 0.06, a: 0.22 }, { f: vary(rand, 7420, 0.03), t60: 0.04, a: 0.14 }, { f: vary(rand, 11800, 0.03), t60: 0.025, a: 0.08 }], len);
    const table = modal(strike(1.2), [{ f: 178, t60: 0.05, a: 0.5 }, { f: 312, t60: 0.035, a: 0.3 }], len);
    const click = onePoleHigh(burst(rand, 2, 0.35, 0.05), 2500);
    mix(dry, sum(len, [unit(body), 1], [unit(spoon), 0.2], [unit(table), 0.07], [unit(click), 0.06]), frames(h.at), h.v);
  }
  return { channels: kitchen(dry, 0.12, seconds), hits: hits.map(h => h.at) };
}

// ---------------------------------------------------------------- dripping tap into a bowl
export function dripTake(seed = 0x0b1e_0002) {
  const rand = rng(seed), seconds = 6.6, n = frames(seconds), dry = new Float64Array(n);
  // Bubble resonance (Hz) of each drop, its upward chirp, its ring time; 0 means a splash without a bubble.
  const drops: [hz: number, chirp: number, ms: number][] = [
    [1180, 0.08, 26], [1570, 0.12, 22], [990, 0.06, 30], [0, 0, 0], [1330, 0.18, 20], [1760, 0.07, 24],
    [1050, 0.22, 18], [1420, 0.05, 28], [0, 0, 0], [2090, 0.1, 16], [1240, 0.07, 27], [1880, 0.15, 19],
  ];
  const gaps = [0.52, 0.47, 0.61, 0.44, 0.58, 0.5, 0.66, 0.43, 0.55, 0.49, 0.6];
  const at: number[] = [];
  let t = 0.2;
  drops.forEach(([f0, chirp, ms], k) => {
    at.push(t);
    const len = frames(0.35), x = new Float64Array(len);
    const splash = onePoleHigh(burst(rand, 6, f0 ? 0.6 : 1.8, 0.08), 2400);
    for (let i = 0; i < splash.length; i++) x[i]! += (f0 ? 0.08 : 0.3) * splash[i]!;
    if (f0) {
      let p = 0;
      const tau = ms / 1000, peakAmp = vary(rand, 0.55, 0.15);
      for (let i = 0; i < len; i++) {
        const s = i / RATE, f = f0 * (1 + chirp * (1 - Math.exp(-s / 0.009)));
        p += TAU * f / RATE;
        x[i]! += peakAmp * Math.min(1, s / 0.0006) * Math.exp(-s / tau) * (Math.sin(p) + 0.04 * Math.sin(2 * p));
      }
    }
    const bowl = modal(strike(0.5), [{ f: 1150, t60: 0.6, a: 0.05 }, { f: 2780, t60: 0.4, a: 0.03 }, { f: 4900, t60: 0.25, a: 0.02 }], len);
    for (let i = 0; i < len; i++) x[i]! += bowl[i]!;
    mix(dry, x, frames(t), vary(rand, 1, 0.12));
    t += gaps[k] ?? 0;
  });
  return { channels: kitchen(dry, 0.15, seconds), drops: drops.map(([f0, chirp], k) => ({ at: at[k]!, hz: f0, chirp })) };
}

// ---------------------------------------------------------------- fist on a cardboard box
export function boxTake(seed = 0x0b1e_0003) {
  const rand = rng(seed), seconds = 3.0, n = frames(seconds), dry = new Float64Array(n);
  const hits = [{ at: 0.15, v: 1.0, ms: 4.5 }, { at: 0.85, v: 0.78, ms: 5.5 }, { at: 1.55, v: 0.92, ms: 4.0 }, { at: 2.25, v: 0.66, ms: 6.0 }];
  for (const h of hits) {
    const len = frames(0.6), exc = strike(h.ms), boom = new Float64Array(len);
    // The lowest panel/air mode starts sharp (the panel is pushed tight) and relaxes over ~25 ms.
    const f0 = vary(rand, 82, 0.03);
    let p = 0;
    for (let i = 0; i < len; i++) { const s = i / RATE, f = f0 * (1 + 0.16 * Math.exp(-s / 0.025)); p += TAU * f / RATE; boom[i] = Math.sin(p) * Math.exp(-s / 0.075) * Math.min(1, s / 0.003); }
    const body = modal(exc, [{ f: 126, t60: 0.15, a: 0.55 }, { f: 191, t60: 0.11, a: 0.42 }, { f: 263, t60: 0.09, a: 0.3 }, { f: 418, t60: 0.06, a: 0.2 }, { f: 655, t60: 0.045, a: 0.14 }, { f: 1040, t60: 0.03, a: 0.08 }], len);
    const slap = onePoleLow(burst(rand, 14, 3.5, 0.6), 2500), rattle = filter(burst(rand, 45, 14, 2), bq.bandpass(1500, 0.9));
    mix(dry, sum(len, [boom, 1], [unit(body), 0.85], [unit(slap), 0.5], [unit(rattle), 0.12]), frames(h.at), h.v);
  }
  return { channels: kitchen(dry, 0.1, seconds), hits: hits.map(h => h.at) };
}

// ---------------------------------------------------------------- hardback book slapped on a table
export function bookTake(seed = 0x0b1e_0004) {
  const rand = rng(seed), seconds = 3.0, n = frames(seconds), dry = new Float64Array(n);
  const hits = [{ at: 0.15, v: 1.0 }, { at: 0.85, v: 0.8 }, { at: 1.55, v: 0.94 }, { at: 2.25, v: 0.7 }];
  for (const h of hits) {
    const len = frames(0.5);
    const crack = filter(burst(rand, 60, vary(rand, 16, 0.15), 0.25), bq.highpass(420), bq.peak(2600, 0.8, 6));
    const whump = filter(burst(rand, 60, 22, 2), bq.lowpass(380), bq.highpass(70));
    const table = modal(strike(1.6), [{ f: 145, t60: 0.09, a: 1 }, { f: 233, t60: 0.07, a: 0.8 }, { f: 377, t60: 0.05, a: 0.6 }, { f: 610, t60: 0.04, a: 0.4 }], len);
    const x = sum(len, [unit(crack), 1], [unit(whump), 0.45], [unit(table), 0.5]);
    for (const [ms, a] of [[15, 0.16], [23, 0.12], [34, 0.08], [47, 0.05]] as const) mix(x, filter(burst(rand, 4, 1.2, 0.1), bq.bandpass(4200, 1.2)), frames(vary(rand, ms, 0.2) / 1000), a);
    mix(dry, x, frames(h.at), h.v);
  }
  return { channels: kitchen(dry, 0.16, seconds), hits: hits.map(h => h.at) };
}

// ---------------------------------------------------------------- coin spun until it falls (Euler's disk)
export const COIN = { spinSeconds: 3.0, startAt: 0.1 };
export function coinTake(seed = 0x0b1e_0005) {
  const rand = rng(seed), seconds = 3.9, n = frames(seconds), dry = new Float64Array(n), T = COIN.spinSeconds, t0 = COIN.startAt;
  // Contact-point precession speeds up as the coin settles: omega = 5 / (1 - t/T)^0.9 Hz, capped at 125 Hz, so the
  // last 0.6 s accelerates from about 21 Hz to the cap: a slow wobble that tightens into a whirr.
  const omega = (t: number) => Math.min(125, 5 / Math.max(1e-6, 1 - t / T) ** 0.9);
  const roll = filter(noise(n, rand), bq.highpass(1500), bq.lowpass(7000));
  const ticks = new Float64Array(n);
  let phase = 0, last = 0;
  for (let i = frames(t0); i < n; i++) {
    const t = i / RATE - t0; if (t >= T) break;
    const w = omega(t), level = 0.15 + 0.85 * (t / T) ** 1.6;
    phase += w / RATE;
    const c = 0.5 + 0.5 * Math.cos(TAU * phase);
    dry[i]! += 0.05 * level * (0.25 + c ** 3) * roll[i]! * Math.min(1, t / 0.05);
    if (Math.floor(phase) > last) { last = Math.floor(phase); ticks[i] = level * vary(rand, 1, 0.25); }
  }
  // Each contact rings the coin (high modes) and nudges the table (low modes).
  const coinModes = [{ f: 5230, t60: 0.22, a: 0.12 }, { f: 8930, t60: 0.15, a: 0.09 }, { f: 12700, t60: 0.1, a: 0.06 }];
  const tableModes = [{ f: 310, t60: 0.05, a: 0.5 }, { f: 690, t60: 0.04, a: 0.35 }, { f: 1450, t60: 0.03, a: 0.25 }];
  const tickOut = modal(ticks, [...coinModes, ...tableModes], n);
  for (let i = 0; i < n; i++) dry[i]! += 0.5 * tickOut[i]!;
  // The fall: one flat clack, three quick bounces, a short ring, then stillness.
  const fall = frames(t0 + T);
  for (const [ms, a] of [[0, 1.0], [27, 0.55], [45, 0.3], [58, 0.16]] as const) {
    const len = frames(0.7), exc = new Float64Array(len); exc.set(strike(0.15));
    const hit = modal(exc, [{ f: 5230, t60: 0.5, a: 0.5 }, { f: 8930, t60: 0.35, a: 0.35 }, { f: 2260, t60: 0.3, a: 0.25 }, { f: 310, t60: 0.06, a: 1.2 }, { f: 690, t60: 0.05, a: 0.8 }, { f: 140, t60: 0.05, a: 0.9 }], len);
    mix(dry, hit, fall + frames(ms / 1000), a * 0.55);
  }
  return { channels: kitchen(dry, 0.14, seconds), fallAt: t0 + T };
}
