// Instrument recipes for the three THING//MANIA auditions. Each returns channel arrays
// (Float64Array, -1..1) that make-sounds.mjs normalizes and writes as WAV.
import {
  SR, SVF, DCBlock, Osc, rng, buffer, fadeTail, expDecay, attack, sat, smoothstep, mixInto,
} from './dsp.mjs';

const TAU = Math.PI * 2;

// ---------- A: SOCK SLIDE ----------

// Saw/square through a two-stage resonant lowpass with a fast cutoff envelope: the "quack"
// lives at 300 Hz-2.5 kHz so the riff reads on phone speakers, not just subwoofers.
// The closing cutoff adds phase delay that bends pitch down ~7 cents while it sweeps
// (measured against a static filter), so the oscillator is pre-tuned `cents` sharp.
export function squelchBass(f, { dur = 0.62, seed = 1, cents = 7 } = {}) {
  const out = buffer(dur), osc = new Osc(0), f1 = new SVF(), f2 = new SVF(), dc = new DCBlock(25);
  const r = rng(seed), fo = f * 2 ** (cents / 1200);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR, p = osc.step(fo), dt = osc.dt;
    const x = 0.55 * Osc.saw(p, dt) + 0.35 * Osc.pulse(p, dt, 0.5) + 0.45 * Osc.sine(p) + 0.002 * r();
    const fc = 380 + 3.5 * f + (2600 + 12 * f) * expDecay(t, 0.075);
    const y = f2.run(f1.run(x, fc, 0.7), fc, 3.2);
    const amp = attack(t, 0.0015) * (0.82 + 0.18 * expDecay(t, 0.25));
    out[i] = dc.run(sat(y * amp, 2.2));
  }
  return [fadeTail(out, 0.015)];
}

// A pure whistle: sine with a scooped onset, delayed vibrato and pitch-tracking breath.
export function whistle(f, { dur = 0.9, seed = 2 } = {}) {
  const out = buffer(dur), r = rng(seed), tonal = new SVF(), air = new SVF();
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const vib = 16 * smoothstep((t - 0.16) / 0.22) * Math.sin(TAU * 5.4 * t);
    const fi = f * 2 ** ((vib - 35 * expDecay(t, 0.03)) / 1200);
    ph += fi / SR; if (ph >= 1) ph -= 1;
    const n = r();
    tonal.run(n, fi, 14);
    air.run(n, 2500, 0.7);
    const breathAir = air.hp * (0.05 + 0.12 * expDecay(t, 0.04));
    const env = smoothstep(t / 0.028) * (0.9 + 0.1 * expDecay(t, 0.3));
    out[i] = env * (0.9 * Math.sin(TAU * ph) + 0.035 * Math.sin(2 * TAU * ph) + 0.25 * tonal.bpn + 0.5 * breathAir);
  }
  return [fadeTail(out, 0.02)];
}

function clavVoice(f, t, st) {
  const p = st.osc.step(f), dt = st.osc.dt;
  const x = Osc.pulse(p, dt, 0.22) + 0.25 * Osc.saw(p, dt);
  const fc = 900 + 2 * f + 5200 * expDecay(t, 0.045);
  st.hp.run(st.lp.run(x, fc, 1.3), 160, 0.7);
  return st.hp.hp * attack(t, 0.0008) * expDecay(t, 0.11);
}
// Clavinet-like chord stab: bright pulse pluck, per-note filters, a pick click.
export function clavChord(freqs, { dur = 0.32, seed = 3, muted = false } = {}) {
  const out = buffer(dur), r = rng(seed), pick = new SVF();
  const st = freqs.map((_, k) => ({ osc: new Osc(k * 0.17), lp: new SVF(), hp: new SVF() }));
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let y = 0;
    for (let k = 0; k < freqs.length; k++) y += clavVoice(freqs[k], t, st[k]) * (muted ? expDecay(t, 0.012) : 1);
    pick.run(r(), muted ? 1800 : 3000, muted ? 2 : 1.2);
    y += pick.bpn * expDecay(t, muted ? 0.012 : 0.002) * (muted ? 0.9 : 0.3);
    out[i] = sat(y / freqs.length * 1.5, 1.2);
  }
  return [fadeTail(out, 0.01)];
}

export function punchKick({ dur = 0.5, seed = 4, base = 48, sweep = 110, tau = 0.28 } = {}) {
  const out = buffer(dur), r = rng(seed), click = new SVF();
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR, f = base + sweep * expDecay(t, 0.03);
    ph += f / SR;
    click.run(r(), 2000, 0.7);
    const body = Math.sin(TAU * ph) * attack(t, 0.003) * expDecay(t, tau);
    out[i] = sat(body * 1.1 + click.hp * 0.25 * expDecay(t, 0.002), 1.5);
  }
  return [fadeTail(out, 0.02)];
}

export function tightSnare({ dur = 0.35, seed = 5 } = {}) {
  const out = buffer(dur), r = rng(seed), hp = new SVF(), lp = new SVF();
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const tone = Math.sin(TAU * 190 * t) * expDecay(t, 0.06) + 0.5 * Math.sin(TAU * 340 * t) * expDecay(t, 0.04);
    hp.run(r(), 1500, 0.7);
    const noise = lp.run(hp.hp, 9000, 0.7) * attack(t, 0.001) * expDecay(t, 0.11);
    out[i] = sat(0.55 * tone + 0.75 * noise, 1.4);
  }
  return [fadeTail(out, 0.02)];
}

// Six detuned square partials into a high band: a metallic hat, closed or open.
export function metalHat({ dur = 0.12, tau = 0.035, seed = 6 } = {}) {
  const out = buffer(dur), r = rng(seed), bp = new SVF(), hp = new SVF(), nh = new SVF();
  const partials = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0].map((f) => f * 1.5);
  const ph = partials.map((_, k) => k * 0.13);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let m = 0;
    for (let k = 0; k < partials.length; k++) {
      ph[k] += partials[k] / SR; if (ph[k] >= 1) ph[k] -= 1;
      m += ph[k] < 0.5 ? 1 : -1;
    }
    bp.run(m / 6, 8500, 1.0);
    hp.run(bp.bpn, 7000, 0.7);
    nh.run(r(), 8000, 0.7);
    out[i] = (0.7 * hp.hp + 0.45 * nh.hp) * attack(t, 0.0005) * expDecay(t, tau);
  }
  return [fadeTail(out, 0.01)];
}

// ---------- B: FRIDGE LIGHT ----------

// FM bass (ratio-1 and ratio-2 modulators): a round body with a mid growl that carries on phones.
export function fmBass(f, { dur = 0.85, seed = 7 } = {}) {
  const out = buffer(dur), lp = new SVF(), dc = new DCBlock(22), r = rng(seed);
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    ph += f / SR; if (ph >= 1) ph -= 1;
    const th = TAU * ph, i1 = 1.2 + 1.5 * expDecay(t, 0.1), i2 = 0.6 + 0.8 * expDecay(t, 0.06);
    const x = Math.sin(th + i1 * Math.sin(th) + i2 * Math.sin(2 * th)) + 0.3 * Math.sin(th) + 0.001 * r();
    const amp = attack(t, 0.003) * (0.75 + 0.25 * expDecay(t, 0.2));
    out[i] = dc.run(lp.run(sat(x * amp, 2.2), 2200, 0.7));
  }
  return [fadeTail(out, 0.02)];
}

// FM electric-piano chord, rendered in stereo. Each note sits at its own pan and a slow
// shared autopan moves the image; L+R stays constant so the mono fold has no tremolo.
export function fmKeysChord(freqs, { dur = 1.4, seed = 8 } = {}) {
  const L = buffer(dur), R = buffer(dur), r = rng(seed);
  const pans = freqs.map((_, k) => (freqs.length === 1 ? 0 : -0.4 + 0.8 * k / (freqs.length - 1)));
  for (let k = 0; k < freqs.length; k++) {
    const f = freqs[k], decay = Math.max(0.6, 1.7 - f / 900);
    let ph = 0, tine = 0;
    for (let i = 0; i < L.length; i++) {
      const t = i / SR;
      ph += f / SR; if (ph >= 1) ph -= 1;
      tine += (14 * f) / SR; if (tine >= 1) tine -= 1;
      const th = TAU * ph, index = 0.25 + 1.1 * expDecay(t, 0.35);
      const y = (Math.sin(th + index * Math.sin(th)) + 0.12 * Math.sin(TAU * tine) * expDecay(t, 0.012))
        * attack(t, 0.002) * expDecay(t, decay) * (1 + 0.0005 * r());
      const p = Math.max(-1, Math.min(1, pans[k] + 0.18 * Math.sin(TAU * 3.8 * t + k)));
      L[i] += y * 0.5 * (1 - p);
      R[i] += y * 0.5 * (1 + p);
    }
  }
  return [fadeTail(L, 0.03), fadeTail(R, 0.03)];
}

// Inharmonic FM (3.5:1) glass bell over a sine body.
export function glassBell(f, { dur = 1.0 } = {}) {
  const out = buffer(dur);
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    ph += f / SR; if (ph >= 1) ph -= 1;
    const th = TAU * ph, index = 0.35 + 2.4 * expDecay(t, 0.12);
    out[i] = attack(t, 0.001) * (Math.sin(th + index * Math.sin(3.5 * th)) * expDecay(t, 0.55)
      + 0.25 * Math.sin(2 * th) * expDecay(t, 0.25));
  }
  return [fadeTail(out, 0.03)];
}

// A water drip: a sine that "plips" upward as the drop closes, decaying in ~50 ms.
export function drip(f, { dur = 0.16 } = {}) {
  const out = buffer(dur);
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR, fi = f * (1 + 1.3 * (1 - expDecay(t, 0.012)));
    ph += fi / SR; if (ph >= 1) ph -= 1;
    out[i] = Math.sin(TAU * ph) * attack(t, 0.0004) * expDecay(t, 0.045);
  }
  return [fadeTail(out, 0.01)];
}

// Knuckles on a cabinet door: noise burst exciting two wooden modes plus a low body.
export function cabinetKnock({ dur = 0.3, seed = 9 } = {}) {
  const out = buffer(dur), r = rng(seed), m1 = new SVF(), m2 = new SVF(), cl = new SVF();
  for (let i = 0; i < out.length; i++) {
    const t = i / SR, ex = r() * expDecay(t, 0.0015) + (i === 0 ? 1 : 0);
    m1.run(ex, 640, 10); m2.run(ex, 1510, 8); cl.run(r(), 3500, 0.8);
    out[i] = sat(1.6 * m1.bpn + 1.0 * m2.bpn + 0.6 * Math.sin(TAU * 190 * t) * expDecay(t, 0.03)
      + 0.25 * cl.hp * expDecay(t, 0.004), 1.3);
  }
  return [fadeTail(out, 0.02)];
}

export function shaker({ dur = 0.12, seed = 10, hpHz = 4500, a = 0.006, tau = 0.045 } = {}) {
  const out = buffer(dur), r = rng(seed), hp = new SVF();
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    hp.run(r(), hpHz, 0.8);
    const grain = 0.6 + 0.4 * Math.abs(r());
    out[i] = hp.hp * grain * smoothstep(t / a) * expDecay(Math.max(0, t - a), tau);
  }
  return [fadeTail(out, 0.01)];
}

// ---------- C: LOW BATTERY CHOIR ----------

// Formant tables: [frequency Hz, bandwidth Hz] for F1-F4.
export const VOWELS = {
  a: [[800, 80], [1150, 90], [2800, 120], [3500, 130]],
  o: [[450, 70], [800, 80], [2830, 100], [3500, 130]],
  u: [[325, 50], [700, 60], [2530, 170], [3500, 180]],
  i: [[270, 60], [2140, 90], [2950, 100], [3900, 120]],
  e: [[400, 60], [1700, 80], [2600, 120], [3500, 150]],
  uMale: [[300, 50], [870, 60], [2240, 110], [3000, 130]],
  // consonant loci used only as onset targets
  d: [[250, 60], [1700, 90], [2700, 120], [3500, 150]],
  b: [[220, 60], [900, 80], [2300, 120], [3300, 150]],
};
const lerp = (a, b, x) => a + (b - a) * x;
function formantsAt(from, to, x, scale) {
  return to.map(([F, B], j) => [lerp(from[j][0], F, x) * scale, lerp(from[j][1], B, x)]);
}
function cascadeGain(f, fm) {
  let g = 1;
  for (const [F, B] of fm) {
    const F2 = F * F;
    g *= F2 / Math.sqrt((F2 - f * f) ** 2 + (B * f) ** 2);
  }
  return g;
}

// Additive formant voice: coherent harmonics shaped by a moving formant cascade, so
// vowels glide ("y" = i->a, "w" = u->a, "d"/"b" = consonant locus->vowel) like a talking
// appliance rather than a sampled singer. Pitch has a scoop, jitter and delayed vibrato.
export function voice(f0, {
  dur = 0.6, vowel = 'a', onset = null, glide = 0.05, burst = null, tilt = 1.1, scale = 1,
  vibDepth = 20, vibRate = 5.6, vibDelay = 0.18, scoop = -35, breath = 0.04, detune = 0, seed = 11,
  ramp = 0.008, maxHz = 9000, sub = 0,
} = {}) {
  const out = buffer(dur), harm = buffer(dur), air = buffer(dur), cons = buffer(dur), env = buffer(dur);
  const r = rng(seed), bands = [new SVF(), new SVF(), new SVF()], bh = new SVF();
  const target = VOWELS[vowel], from = onset ? VOWELS[onset] : target;
  const block = 32, K = Math.max(1, Math.floor(maxHz / f0));
  const amps = new Float64Array(K + 1), next = new Float64Array(K + 1);
  let ph = 0, jit = 0, fm = from;
  const fill = (arr, t, f) => {
    fm = formantsAt(from, target, smoothstep(t / glide), scale);
    for (let k = 1; k <= K; k++) arr[k] = k * f < SR / 2 - 500 ? cascadeGain(k * f, fm) / k ** tilt : 0;
  };
  fill(amps, 0, f0);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    if (i % block === 0) {
      jit = 0.97 * jit + 0.6 * r();
      fill(next, t + block / SR, f0);
    }
    const x = (i % block) / block;
    const cents = detune + scoop * expDecay(t, 0.04) + jit + vibDepth * smoothstep((t - vibDelay) / 0.2) * Math.sin(TAU * vibRate * t);
    ph += f0 * 2 ** (cents / 1200) / SR; if (ph >= 1) ph -= 1;
    let y = sub * Math.sin(TAU * ph);
    for (let k = 1; k <= K; k++) {
      const a = amps[k] + (next[k] - amps[k]) * x;
      if (a !== 0) y += a * Math.sin(TAU * k * ph);
    }
    if (i % block === block - 1) amps.set(next);
    const n = r();
    let b = 0;
    for (let j = 0; j < 3; j++) { bands[j].run(n, fm[j][0], fm[j][0] / fm[j][1]); b += bands[j].bpn; }
    harm[i] = y; air[i] = b;
    env[i] = burst ? (t < 0.004 ? 0 : smoothstep((t - 0.004) / ramp)) : smoothstep(t / Math.max(ramp, 0.02));
    if (burst) {
      bh.run(n, burst === 'd' ? 3500 : 1000, 0.8);
      cons[i] = (burst === 'd' ? bh.hp : bh.lp) * expDecay(t, 0.004) * (t < 0.012 ? 1 : 0);
    }
  }
  // Calibrate parts independently: harmonics to unit peak, breath and consonant to unit RMS.
  let hp = 0, ar = 0, cr = 0;
  for (let i = 0; i < out.length; i++) { hp = Math.max(hp, Math.abs(harm[i])); ar += air[i] ** 2; cr += cons[i] ** 2; }
  ar = Math.sqrt(ar / out.length) || 1; cr = Math.sqrt(cr / Math.round(0.012 * SR)) || 1;
  for (let i = 0; i < out.length; i++) out[i] = env[i] * (harm[i] / hp + breath * air[i] / ar) + 0.35 * cons[i] / cr;
  return [fadeTail(out, 0.03)];
}

// Close-harmony choir chord: each part sung twice, detuned +/-7 cents, the copies leaning
// left and right so the chorus is width from different waveforms, not from pan alone.
export function choirChord(freqs, { dur = 1.0, vowel = 'u', onset = null, seed = 12 } = {}) {
  const L = buffer(dur), R = buffer(dur);
  freqs.forEach((f, k) => {
    for (const side of [-1, 1]) {
      const [v] = voice(f, { dur, vowel, onset, glide: 0.07, tilt: 1.35, vibDepth: 14, vibRate: 5.1 + 0.3 * k + 0.2 * side,
        vibDelay: 0.12, scoop: -20, breath: 0.03, detune: 7 * side, seed: seed + 17 * k + (side > 0 ? 5 : 0), ramp: 0.05 });
      mixInto(side < 0 ? L : R, v, 0.7);
      mixInto(side < 0 ? R : L, v, 0.3);
    }
  });
  return [L, R];
}

export function boxKick({ dur = 0.3, seed = 13 } = {}) {
  const out = buffer(dur), r = rng(seed), lp = new SVF(), box = new SVF();
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR, f = 52 + 43 * expDecay(t, 0.02);
    ph += f / SR;
    const n = r();
    lp.run(n, 900, 0.7); box.run(n * expDecay(t, 0.003), 240, 3);
    out[i] = sat(Math.sin(TAU * ph) * attack(t, 0.002) * expDecay(t, 0.16) + 0.5 * lp.lp * expDecay(t, 0.03) + 1.2 * box.bpn, 1.6);
  }
  return [fadeTail(out, 0.015)];
}

// Spoon on a pot lid: inharmonic metal modes plus a slap of noise.
export function potLid({ dur = 0.45, seed = 14 } = {}) {
  const out = buffer(dur), r = rng(seed), hp = new SVF(), slap = new SVF();
  const modes = [[512, 0.25, 0.5], [1187, 0.18, 0.45], [1740, 0.12, 0.35], [2600, 0.1, 0.3], [3310, 0.08, 0.25], [4485, 0.06, 0.2]];
  for (let i = 0; i < out.length; i++) {
    const t = i / SR, n = r();
    let m = 0;
    for (const [f, tau, a] of modes) m += a * Math.sin(TAU * f * t + f) * expDecay(t, tau);
    hp.run(n, 2000, 0.7); slap.run(n, 1200, 1.5);
    out[i] = sat(attack(t, 0.0005) * (0.55 * m + 0.6 * hp.hp * expDecay(t, 0.06) + 0.8 * slap.bpn * expDecay(t, 0.05)), 1.3);
  }
  return [fadeTail(out, 0.02)];
}

// Kitchen-timer ding: small-bell partials with a strike click.
export function timerDing(f, { dur = 1.0, seed = 15 } = {}) {
  const out = buffer(dur), r = rng(seed), cl = new SVF();
  const partials = [[1, 0.6, 1], [2.32, 0.35, 0.45], [4.25, 0.18, 0.25], [6.63, 0.1, 0.12]];
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let y = 0;
    for (const [m, tau, a] of partials) if (m * f < SR / 2 - 500) y += a * Math.sin(TAU * m * f * t) * expDecay(t, tau);
    cl.run(r(), 5000, 0.8);
    out[i] = attack(t, 0.0005) * y + 0.15 * cl.hp * expDecay(t, 0.002);
  }
  return [fadeTail(out, 0.03)];
}
