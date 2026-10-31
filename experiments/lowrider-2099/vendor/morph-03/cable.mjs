// MORPH//03 — THE TEMPO STRING, v2: a playable cable bass.
// Same physics as MORPH//02 C (the round trip of one delay loop IS the tension: long =
// rhythm of reflections, short = pitch; a dispersive allpass cascade turns every round
// trip into a "pew" chirp; a saturating loop gain bows it), plus articulations that a
// bass player would recognise and that only a cable can do:
//   stretch  - a hit displaces the cable and raises its tension in proportion to the force;
//              the extra tension relaxes as the displacement decays, so slaps dive into pitch
//              and settle in tune while soft plucks barely bend
//   buzz     - a one-sided contact barrier (the cable slapping its guide): upper harmonics
//              that read on phone speakers, louder the harder it is played
//   harmonic - a flageolet touch at 1/N of the length: odd harmonics die, the note pops up
//              an octave (N=2) or a twelfth (N=3) without retuning the cable
//   bow      - constant-force bowing: extra loop gain while the cable is below its stable
//              amplitude, so low bowed notes sustain and growl instead of dying
//   damp     - palm mute: the loss cut-off collapses (overtones die) while the loop gain dips
//              less, so a muted note keeps a short low thump
//   events   - pluck | slap | ghost | scrape | crack, each with hardness and pick position
import { SR, TAU, clamp, rng, bipolar, drift, Delay, DCBlock, SVF } from './dsp.mjs';

/** Phase delay (samples) of k first-order allpasses with coefficient a at frequency f. */
export function allpassDelay(a, f, k) {
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
const fn = v => (typeof v === 'function' ? v : () => v);

// Fractional tension added per unit of strike force (0.3 at full force ~ +4.5 semitones at onset)
const STRETCH = { pluck: 0.012, slap: 0.3, ghost: 0, scrape: 0.01, crack: 0.45 };
// Excitation shapes: [length seconds at hardness 0, at hardness 1, noise share]
const KIND = {
  pluck: [0.0036, 0.0006, 0.6], slap: [0.0012, 0.00025, 1.0], ghost: [0.006, 0.003, 0.3],
  scrape: [0.06, 0.04, 1.0], crack: [0.0004, 0.00015, 1.0],
};

/**
 * Render one cable. All controls may be numbers or functions of time (seconds).
 * Returns { out, energy } (mono Float64Arrays).
 */
export function cable({
  seconds, period, disp = -0.3, stages = 160, gain = 0.9, bright = 5000, damp = 1, drive = 1.6,
  buzz = 0, tension = 1, relax = 0.07, harmonic = 0, harmonicN = 2, bow = 0, pulse = 0, events = [], seed = 1,
}) {
  const ctl = { period: fn(period), disp: fn(disp), gain: fn(gain), bright: fn(bright), damp: fn(damp), drive: fn(drive),
    buzz: fn(buzz), tension: fn(tension), harmonic: fn(harmonic), harmonicN: fn(harmonicN), bow: fn(bow), pulse: fn(pulse) };
  const K = stages, n = Math.round(seconds * SR), out = new Float64Array(n), energy = new Float64Array(n);
  const line = new Delay(1.3), hist = new Delay(0.2), exHist = new Delay(1.3), z = new Float64Array(K);
  const r = bipolar(rng(seed)), dc = new DCBlock(5), wob = drift(seed + 5, 0.7), exc = new SVF(3000, 0.7);
  const ev = events.map(e => ({ kind: 'pluck', hard: 0.8, amp: 1, pos: 0, ...e, s: Math.round(e.t * SR) })).sort((a, b) => a.s - b.s);
  const active = [];
  let next = 0, lp = 0, E = 0, roundTrip = 0, Peff = 1, P = 1, a = 0, g = 0, c = 1, D = 2, dr = 1.6, bz = 0, h = 0, N = 2, bw = 0, hard = 0.8, pos = 0;
  let stretch = 0, tens = 1, aUse = 0, dStep = 0, aStep = 0;
  const eAlpha = 1 - Math.exp(-1 / (0.02 * SR)), relaxCoef = Math.exp(-1 / (relax * SR));
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if ((i & 15) === 0) {
      const dm = ctl.damp(t);
      P = ctl.period(t) * (1 + 0.0005 * wob()); tens = ctl.tension(t);
      // a palm mute kills the overtones fast and the fundamental slowly (it still thumps)
      a = ctl.disp(t); g = ctl.gain(t) * (0.6 + 0.4 * dm); dr = ctl.drive(t); bz = ctl.buzz(t); bw = ctl.bow(t);
      h = ctl.harmonic(t); N = ctl.harmonicN(t);
      c = clamp(1 - Math.exp(-TAU * ctl.bright(t) * (0.06 + 0.94 * dm ** 4) / SR), 0.02, 1);
    }
    while (next < ev.length && ev[next].s <= i) {
      const e = ev[next++];
      active.push({ ...e, age: 0 });
      stretch += e.stretch ?? STRETCH[e.kind] * e.amp * e.hard;
    }
    // the stretched cable is tighter: the effective round trip shortens, then relaxes
    stretch *= relaxCoef;
    if ((i & 15) === 0) {
      Peff = P / (1 + tens * stretch);
      const f0 = Math.min(1 / Peff, 2000), room = 0.85 * Peff * SR;
      // a short cable cannot disperse like a long one: keep the chain's delay inside the round trip
      let aEff = a, apd = allpassDelay(aEff, f0, K);
      while (apd > room && aEff < -0.005) { aEff *= 0.9; apd = allpassDelay(aEff, f0, K); }
      const Dtarget = Math.max(2, Peff * SR - apd - lossDelay(c, f0));
      // ramp delay and dispersion per sample across the whole control block: stepping them
      // would saw the read point back and forth (zipper tones at multiples of SR/16)
      if (i === 0) { D = Dtarget; aUse = aEff; }
      dStep = (Dtarget - D) / 16; aStep = (aEff - aUse) / 16;
    }
    D += dStep; aUse += aStep;
    roundTrip += 1 / (Peff * SR);
    if (roundTrip >= 1) { roundTrip -= 1; const amp = ctl.pulse(t); if (amp > 0.001) active.push({ kind: 'pluck', amp, hard: 0.75, pos: 0, age: 0 }); }
    // ---- excitation
    let x = 0;
    for (let k = active.length - 1; k >= 0; k--) {
      const p = active[k], [l0, l1, ns] = KIND[p.kind], len = Math.max(2, Math.round((l0 + (l1 - l0) * p.hard) * SR));
      if (p.age >= len) { active.splice(k, 1); continue; }
      const u = p.age / len;
      let shape = p.kind === 'scrape' ? Math.sin(Math.PI * u) * (0.3 + 0.7 * u) : Math.sin(Math.PI * u);
      x += p.amp * shape * ((1 - ns) + ns * (0.6 + 0.8 * r() * p.hard)) * (p.kind === 'crack' ? 4 : p.kind === 'slap' ? 1.8 : p.kind === 'ghost' ? 0.5 : 1);
      hard = p.kind === 'scrape' ? 0.3 + 0.7 * u : p.hard; pos = p.pos;
      p.age++;
    }
    exc.set(700 + 13000 * hard * hard, 0.7); exc.tick(x);
    let e = exc.lp * 3;
    exHist.write(e);
    // pick position: striking at a fraction `pos` of the length notches every 1/pos-th harmonic
    if (pos > 0) e -= exHist.read(Math.max(1, pos * Peff * SR));
    e += bw * 0.015 * r();
    // ---- the loop: delay -> dispersion -> loss -> harmonic touch -> saturation/contact -> DC
    let y = line.read(D) + e;
    for (let s = 0; s < K; s++) { const v = aUse * y + z[s]; z[s] = y - aUse * v; y = v; }
    lp += c * (y - lp);
    let v = lp;
    if (h > 0.001) { // flageolet: average of N copies one 1/N-period apart keeps only multiples of N
      let acc = v;
      for (let k = 1; k < N; k++) acc += hist.read(Math.max(1, k * Peff * SR / N));
      v = (1 - h) * v + h * acc / N;
    }
    hist.write(v);
    // a bow is a constant force: below its stable amplitude it feeds the cable extra gain
    const gBow = bw > 0 ? g * (1 + 0.12 * bw * Math.max(0, 1 - Math.sqrt(E) / 0.22)) : g;
    y = Math.tanh(v * gBow * dr) / dr;
    if (bz > 0.001) { // contact barrier: the cable slaps its guide on positive excursions
      const b = 0.42 * (1 - 0.8 * bz);
      if (y > b) y = b + (y - b) / (1 + 14 * bz * (y - b));
    }
    y = dc.tick(y);
    line.write(y);
    E += eAlpha * (y * y - E);
    out[i] = y; energy[i] = E;
  }
  return { out, energy };
}

// ---------------------------------------------------------------- score helpers
/** Breakpoint curve: [[t, value, shape?], ...]; shape 'lin' | 'exp' (geometric) | 'step' | 'in' | 'out' | default smoothstep. */
export function curve(points) {
  return t => {
    if (t <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      const [t1, v1, kind] = points[i], [t0, v0] = points[i - 1];
      if (t < t1) {
        let u = (t - t0) / (t1 - t0);
        if (kind === 'step') return v0;
        if (kind === 'exp') return v0 * (v1 / v0) ** u;
        u = kind === 'lin' ? u : kind === 'in' ? u * u * u : kind === 'out' ? 1 - (1 - u) ** 3 : u * u * (3 - 2 * u);
        return v0 + (v1 - v0) * u;
      }
    }
    return points[points.length - 1][1];
  };
}

/**
 * Tension lane for a note list: [{t, hz, glide?}] -> period(t). Glides move the tension
 * geometrically over `glide` seconds (default 12 ms re-tension). Before the first note the
 * cable sits at `restPeriod` (e.g. a quarter-note round trip). Optional rate limit keeps
 * slackening physical (the read point never runs backwards).
 */
export function tensionLane(notes, { restPeriod, glide = 0.012 } = {}) {
  const ns = [...notes].sort((a, b) => a.t - b.t);
  return t => {
    let p = restPeriod ?? 1 / ns[0].hz;
    for (const note of ns) {
      if (t < note.t) break;
      const target = note.period ?? 1 / note.hz, gl = note.glide ?? glide;
      const u = gl > 0 ? clamp((t - note.t) / gl, 0, 1) : 1;
      const shaped = note.curve === 'lin' ? u : u * u * (3 - 2 * u);
      p = p * (target / p) ** shaped;
    }
    return p;
  };
}

/**
 * "Zap": every note's onset drives the dispersion deep for a moment, so the attack is a laser
 * chirp and the body settles into a clean pitch. base may be a number or a lane.
 * onsets: [{t, depth}] (depth = extra allpass coefficient, e.g. -0.45).
 */
export function zapLane(base, onsets, { tau = 0.028 } = {}) {
  const b = fn(base), os = [...onsets].sort((x, y) => x.t - y.t);
  return t => {
    let extra = 0;
    for (const o of os) { if (o.t > t) break; const u = t - o.t; if (u < 6 * tau) extra = Math.min(extra, o.depth * Math.exp(-u / tau)); }
    return Math.max(-0.95, b(t) + extra);
  };
}
