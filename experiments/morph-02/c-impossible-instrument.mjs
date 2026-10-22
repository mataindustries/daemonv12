// MORPH//02 C — THE IMPOSSIBLE INSTRUMENT: "THE TEMPO STRING"
// A steel cable so long that its fundamental IS the tempo. One strike returns as a
// rhythm of reflections; every round trip through a dispersive allpass cascade turns
// the reflection into a longer, darker "pew" chirp (high frequencies outrun low ones,
// as in real struck cables and springs). Tightening the cable shortens the loop: the
// rhythm accelerates through a ratchet into a pitch; bowed by a saturating feedback it
// becomes a bass that plays a riff. Released, the pitch decelerates back into the
// rhythm it came from. Rhythm and pitch are one physical control.
// 80 BPM, E minor. Two cables in 3:4 (quarter vs dotted-eighth) plus a far cable.
import {
  SR, TAU, mtof, clamp, smooth, stereo, rng, bipolar, drift, addPan, addStereo, dbToGain,
  SVF, filt, DCBlock, Delay, reverb, echo, modal, compress, limit, norm, monoBass, fadeTail, eqStereo, lufs, scale, master, shape, tube,
} from './dsp.mjs';

export const BPM = 80;
const BEAT = 60 / BPM, S16 = BEAT / 4, LENGTH = 12.0;
const db = dbToGain;

/** Phase delay (samples) of k first-order allpasses with coefficient a at frequency f. */
function allpassDelay(a, f, k) {
  const w = TAU * f / SR;
  const nr = a + Math.cos(w), ni = -Math.sin(w), dr = 1 + a * Math.cos(w), di = -a * Math.sin(w);
  let ph = Math.atan2(ni, nr) - Math.atan2(di, dr);
  if (ph > 0) ph -= TAU;
  return k * (-ph / w);
}
function lossDelay(c, f) { // one-pole y += c (x - y)
  const w = TAU * f / SR;
  return Math.atan2((1 - c) * Math.sin(w), 1 - (1 - c) * Math.cos(w)) / w;
}

/** Control curve through [t, value, shape?] points; log=true interpolates geometrically. */
function curve(points, log = false) {
  return t => {
    if (t <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      const [t1, v1, kind] = points[i], [t0, v0] = points[i - 1];
      if (t <= t1) {
        let u = (t - t0) / (t1 - t0);
        u = kind === 'lin' ? u : kind === 'in' ? u * u * u : kind === 'out' ? 1 - (1 - u) ** 3 : smooth(u);
        return log ? v0 * (v1 / v0) ** u : v0 + (v1 - v0) * u;
      }
    }
    return points[points.length - 1][1];
  };
}

/**
 * One cable: a delay loop whose round trip is `period(t)` seconds, with K dispersive allpasses,
 * a loss low-pass, a saturating loop gain (bowing when > 1), strikes, mutes, and optional
 * self-strikes synchronized to each round trip (`pulse(t)` amplitude) for the accelerando.
 */
function cable({ period, disp, gain, bright, bow = () => 0, damp = () => 1, pulse = () => 0, plucks, seed, stages: K = 160, drive = 1.6 }) {
  const n = Math.round(LENGTH * SR), out = new Float64Array(n);
  const line = new Delay(1.2), z = new Float64Array(K), r = bipolar(rng(seed)), dc = new DCBlock(10), wob = drift(seed + 5, 0.7);
  const ev = plucks.map(p => ({ ...p, s: Math.round(p.t * SR) })).sort((a, b) => a.s - b.s);
  const active = [], exc = new SVF(3000, 0.7);
  let next = 0, lp = 0, roundTrip = 0, P = 1, a = 0, g = 0, c = 1, D = 2, bw = 0, hard = 0.8;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if ((i & 15) === 0) {
      P = period(t) * (1 + 0.0006 * wob()); a = disp(t); g = gain(t) * damp(t); bw = bow(t);
      c = clamp(1 - Math.exp(-TAU * bright(t) / SR), 0.02, 1);
      const f0 = Math.min(1 / P, 2000);
      D = Math.max(2, P * SR - allpassDelay(a, f0, K) - lossDelay(c, f0));
    }
    while (next < ev.length && ev[next].s <= i) active.push({ ...ev[next++], age: 0 });
    roundTrip += 1 / (P * SR);
    if (roundTrip >= 1) { roundTrip -= 1; const amp = pulse(t); if (amp > 0.001) active.push({ amp, hard: 0.75, age: 0 }); }
    // strike: a short raised-cosine hammer plus scrape noise; hardness opens its tone filter
    let x = 0;
    for (let k = active.length - 1; k >= 0; k--) {
      const p = active[k], len = Math.round((0.0006 + 0.003 * (1 - p.hard)) * SR);
      if (p.age < len) { x += p.amp * Math.sin(Math.PI * p.age / len) * (0.6 + 0.8 * r() * p.hard); hard = p.hard; }
      else { active.splice(k, 1); continue; }
      p.age++;
    }
    exc.set(900 + 12000 * hard, 0.7); exc.tick(x);
    x = exc.lp * 3 + bw * 0.015 * r();
    // the strike enters at the dispersion input, so even the first arrival is a chirp
    let y = line.read(D) + x;
    for (let s = 0; s < K; s++) { const v = a * y + z[s]; z[s] = y - a * v; y = v; }
    lp += c * (y - lp);
    y = dc.tick(Math.tanh(lp * g * drive) / drive);
    line.write(y);
    out[i] = y;
  }
  return out;
}

/** A single tempo-string strike and its first reflections (quarter-note cable), for the kit integration. */
export function strike(seconds = 3) {
  const low = cable({ period: () => BEAT, disp: () => -0.86, gain: () => 0.84, bright: () => 6500, plucks: [{ t: 0, amp: 1, hard: 0.95 }], seed: 11, drive: 2.2 });
  return norm(low.subarray(0, Math.round(seconds * SR)).slice());
}

export function render({ stems = false } = {}) {
  const n = Math.round(LENGTH * SR);
  const E1 = mtof(28), B1 = mtof(35);
  const T_TIGHT = 3.0, T_PITCH = 4.5, T_RELEASE = 8.625, T_RHYTHM = 10.5; // on the beat grid for picture sync
  const QUARTER = BEAT, DOTTED = S16 * 3;

  // Bassline riff on the tightened low cable, 16ths from T_PITCH: [step, midi, length in 16ths]
  const RIFF = [[0, 28, 1.6], [2, 28, 0.7], [3, 40, 1.4], [5, 35, 1.6], [7, 38, 0.9], [8, 28, 1.6], [10, 31, 0.8], [11, 33, 0.8], [12, 34, 0.7], [13, 35, 1.8],
    [16, 28, 1.6], [18, 40, 0.7], [19, 38, 0.8], [20, 35, 1.4]];
  const riffAt = s => T_PITCH + s * S16;
  // glide: a fast log-ramp toward each new note (the cable is re-tensioned, not retuned)
  const steps = RIFF.map(([s, m]) => [riffAt(s) - 0.01, 1 / mtof(m)]);
  const glidePeriod = t => {
    let p = 1 / E1;
    for (const [ts, pk] of steps) { if (t < ts) break; p = p * (pk / p) ** smooth((t - ts) / 0.016); }
    return p;
  };
  // palm mutes between short notes give the riff its chug
  const mute = t => {
    if (t < riffAt(0) || t >= T_RELEASE - 0.05) return 1;
    let m = 1;
    for (let k = 0; k < RIFF.length; k++) {
      const [s, , len] = RIFF[k], start = riffAt(s), stop = start + len * S16, nextStart = k + 1 < RIFF.length ? riffAt(RIFF[k + 1][0]) : T_RELEASE;
      if (t >= stop && t < nextStart - 0.004) m = Math.min(m, 0.55 + 0.45 * (1 - smooth((t - stop) / 0.012)));
    }
    return m;
  };

  // ---- LOW CABLE: quarter-note round trip -> tightened to E1 -> riff -> released to a quarter again.
  const lowPeriod = t => {
    if (t < T_TIGHT) return QUARTER;
    if (t < T_PITCH) return curve([[T_TIGHT, QUARTER], [T_PITCH, 1 / E1, 'lin']], true)(t);
    if (t < T_RELEASE) return glidePeriod(t);
    if (t < T_RHYTHM) return curve([[T_RELEASE, 1 / mtof(35)], [T_RHYTHM, QUARTER, 'lin']], true)(t);
    return QUARTER;
  };
  const low = cable({
    period: lowPeriod,
    disp: curve([[0, -0.86], [T_TIGHT, -0.86], [T_PITCH, -0.2], [T_RELEASE, -0.2], [T_RHYTHM, -0.86]]),
    gain: curve([[0, 0.84], [T_TIGHT, 0.86], [T_TIGHT + 1.0, 0.98], [T_PITCH, 1.08], [T_RELEASE, 1.08], [T_RELEASE + 0.45, 0.9], [T_RHYTHM - 0.3, 0.8], [T_RHYTHM, 0.84]]),
    bright: curve([[0, 6500], [T_TIGHT, 6500], [T_PITCH, 3200], [T_RELEASE, 3600], [T_RHYTHM, 6500]]),
    bow: curve([[0, 0], [T_TIGHT + 0.8, 0], [T_PITCH, 1], [T_RELEASE, 1], [T_RELEASE + 0.35, 0]]),
    damp: mute,
    // self-strikes at every round trip while tightening/releasing: the audible accelerando
    pulse: curve([[0, 0], [T_TIGHT + 0.05, 0], [T_TIGHT + 0.4, 0.35], [T_PITCH - 0.15, 0.45], [T_PITCH + 0.05, 0], [T_RELEASE + 0.3, 0], [T_RELEASE + 0.55, 0.3], [T_RELEASE + 1.1, 0.5], [T_RHYTHM - 0.05, 0.6], [T_RHYTHM, 0]]),
    plucks: [
      { t: 0, amp: 1, hard: 0.95 }, { t: BEAT * 2 + S16 * 2, amp: 0.65, hard: 0.8 },
      { t: T_TIGHT, amp: 0.75, hard: 1 },
      ...RIFF.map(([s, m], k) => ({ t: riffAt(s), amp: [0.75, 0.4, 0.5, 0.45][k % 4], hard: 0.55 + 0.45 * ((m - 28) / 12) })),
      { t: T_RHYTHM, amp: 1, hard: 0.95 },
    ],
    seed: 11, drive: 2.2,
  });

  // ---- HIGH CABLE: dotted-eighth round trip (3:4 against the low cable); tightened to B2 (a fifth
  // above the bass octave), then it shadows the riff's downbeats an octave up; released with it.
  const hiPeriod = t => {
    if (t < T_TIGHT) return DOTTED;
    if (t < T_PITCH) return curve([[T_TIGHT, DOTTED], [T_PITCH, 1 / (B1 * 2), 'lin']], true)(t);
    if (t < T_RELEASE) return glidePeriod(t) / 2;
    if (t < T_RHYTHM) return curve([[T_RELEASE, 1 / (mtof(35) * 2)], [T_RHYTHM, DOTTED, 'lin']], true)(t);
    return DOTTED;
  };
  const high = cable({
    period: hiPeriod,
    disp: curve([[0, -0.9], [T_TIGHT, -0.9], [T_PITCH, -0.45], [T_RELEASE, -0.45], [T_RHYTHM, -0.9]]),
    gain: curve([[0, 0.82], [T_TIGHT, 0.85], [T_PITCH, 0.97], [T_RELEASE, 0.97], [T_RELEASE + 0.4, 0.7], [T_RHYTHM - 0.2, 0.7], [T_RHYTHM, 0.82]]),
    bright: curve([[0, 9000], [T_PITCH, 6000], [T_RELEASE, 6000], [T_RHYTHM, 9000]]),
    pulse: curve([[0, 0], [T_TIGHT + 0.2, 0], [T_TIGHT + 0.6, 0.18], [T_PITCH - 0.1, 0.3], [T_PITCH + 0.05, 0]]),
    plucks: [
      { t: S16 * 3, amp: 0.85, hard: 1 }, { t: BEAT * 2, amp: 0.55, hard: 0.9 },
      { t: T_TIGHT + S16 * 3, amp: 0.8, hard: 1 },
      ...RIFF.filter((_, k) => k % 2 === 0).map(([s]) => ({ t: riffAt(s) + 0.003, amp: 0.45, hard: 1 })),
      { t: T_RHYTHM + S16 * 3, amp: 0.8, hard: 1 },
    ],
    seed: 23, stages: 60,
  });

  // ---- FAR CABLE: never tightened. Keeps chirping reflections alive under the riff.
  const far = cable({
    period: () => DOTTED * 2, disp: () => -0.93, gain: () => 0.8, bright: () => 10000,
    plucks: [{ t: T_PITCH, amp: 0.8, hard: 1 }, { t: T_PITCH + BEAT * 2 + S16 * 3, amp: 0.6, hard: 1 }],
    seed: 37,
  });

  // ---- Anchor: where the cable is bolted to the canyon wall; it booms at every arrival (weight).
  const anchorIn = new Float64Array(n);
  for (let i = 0; i < n; i++) anchorIn[i] = low[i] + 0.7 * high[i];
  const anchor = modal(filt(anchorIn, 'lp', 300, 0.7), [
    { f: E1, t60: 0.45, gain: 1 }, { f: E1 * 1.5, t60: 0.3, gain: 0.45 }, { f: E1 * 2.31, t60: 0.22, gain: 0.25 },
  ], 'peak');
  const anchorGain = curve([[0, 1], [T_TIGHT + 0.9, 1], [T_PITCH, 0.35], [T_RELEASE, 0.35], [T_RHYTHM, 0.6]]);

  // ---- Level design: rhythm sections are not background; the bass is not a wall.
  norm(low); norm(high); norm(far); norm(anchor);
  const lowLevel = curve([[0, db(0)], [T_TIGHT, db(0)], [T_PITCH - 0.2, db(-2)], [T_PITCH + 0.1, db(-2)], [T_RELEASE, db(-2)], [T_RHYTHM, db(-3)], [LENGTH, db(-3)]]);
  const lowBus = new Float64Array(n), anchorBus = new Float64Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; lowBus[i] = low[i] * lowLevel(t); anchorBus[i] = anchor[i] * anchorGain(t); }
  // the bowed bass gets a touch of oversampled grit so it reads on small speakers
  const gritty = shape(lowBus, tube, 1.5);
  const mixBus = stereo(LENGTH), space = stereo(LENGTH);
  addPan(mixBus, gritty, 0, db(-3), -0.05);
  addPan(mixBus, high, 0, db(-6), 0.4);
  addPan(mixBus, far, 0, db(-11), -0.65);
  addPan(mixBus, anchorBus, 0, db(-4), 0);
  addPan(space, high, 0, db(-6), 0.6); addPan(space, far, 0, db(-8), -0.8); addPan(space, gritty, 0, db(-12), 0);
  // The canyon: a long dark space, and a wall reflection a dotted-eighth late.
  const canyon = reverb(space, { size: 3, rt60: 5.5, hfRatio: 0.4, predelay: 0.09, lowCut: 180, seed: 9 });
  const wall = echo(space, { left: DOTTED, right: DOTTED * 2, feedback: 0.25, lp: 3000, hp: 300, pingpong: true });
  const mix = stereo(LENGTH);
  addStereo(mix, mixBus); addStereo(mix, canyon, 0, db(-5)); addStereo(mix, wall, 0, db(-11));
  monoBass(mix, 110);
  eqStereo(mix, [['hp', 24, 0.7, 0], ['peak', 250, 0.9, -2], ['peak', 2800, 1, 1.5], ['hs', 7000, 0.7, 2]]);
  const gr = compress(mix, { threshold: -12, ratio: 2, attack: 0.02, release: 0.15, knee: 8 });
  const mastering = master(mix, { targetLufs: -15, ceilingDb: -1.2, release: 0.08 }); // sub-heavy: keep the limiter light
  fadeTail(mix, 0.15);
  if (stems) return { low, high, far, anchor };
  return { bus: mix, meta: { bpm: BPM, seconds: LENGTH, compressorMaxDb: gr.reduce((a, b) => Math.max(a, b), 0), ...mastering } };
}
