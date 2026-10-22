// MORPH//02 B — THE ALARM THAT BREAKS REALITY
// A kitchen alarm hook (tresillo-grouped double beeps) commands colossal machinery,
// tears the room open, then becomes a four-on-the-floor groove built from
// household-sound archetypes: washer-drum kick, toaster-spring snare, alarm-clock-bell
// hats, fridge-hum bass, and the alarm itself as a talking lead.
// 120 BPM, E minor with a Phrygian "wrong note" (F). Every sound is synthesized here.
import {
  SR, TAU, mtof, smooth, stereo, rng, bipolar, drift, addAt, addPan, addStereo, dbToGain,
  SVF, filt, Osc, shape, tube, Delay, echo, reverb, modal, compress, limit, norm,
  duckCurve, monoBass, fadeTail, eqStereo, peakOf, lufs, scale, master,
} from './dsp.mjs';

export const BPM = 120;
const STEP = 60 / BPM / 4, BAR = STEP * 16, LENGTH = 11.4;
const at = (bar, step = 0) => bar * BAR + step * STEP;
const db = dbToGain;

// The hook: double beeps grouped 6+6+4 sixteenths (a tresillo of "beep-beep-boop").
// [step, midi, length in steps]. E E B | E E B | G F  — the F is the alarm's "wrong" note.
const CALL = [[0, 88, 0.55], [1, 88, 0.55], [3, 83, 1.2], [6, 88, 0.55], [7, 88, 0.55], [9, 83, 1.2], [12, 91, 1.6], [14, 89, 1.6]];
const ANSWER = [[0, 88, 0.55], [1, 88, 0.55], [3, 83, 1.2], [6, 88, 0.55], [7, 88, 0.55], [9, 83, 1.2], [12, 86, 0.9], [13, 84, 0.9], [14, 83, 1.8]];

// ---------------------------------------------------------------- sources (each returns peak ~1)
/** Piezo beeper: band-limited square through the fixed resonances of a plastic piezo housing. */
function piezo(midi, steps, { bend = 0 } = {}) {
  const dur = steps * STEP, n = Math.round((dur + 0.03) * SR), out = new Float64Array(n);
  const osc = new Osc(0.25), body = new SVF(3150, 7), shell = new SVF(5400, 3), f = mtof(midi);
  for (let i = 0; i < n; i++) {
    const t = i / SR, gate = smooth(t / 0.0012) * (1 - smooth((t - dur) / 0.003));
    const sq = osc.square(f * 2 ** (bend * t / 12), 0.5);
    body.tick(sq); shell.tick(sq);
    out[i] = (0.22 * sq + 0.9 * body.bp + 0.35 * shell.bp) * gate;
  }
  return norm(out);
}

/** Hydraulic press stamp: a falling thud, a steel-plate ring and a pneumatic exhale. */
function clank(seed, size = 1) {
  const n = Math.round(0.9 * SR), r = bipolar(rng(seed)), hit = new Float64Array(n), thud = new Float64Array(n), hiss = new Float64Array(n);
  for (let i = 0; i < 400; i++) hit[i] = r() * Math.exp(-i / 60);
  const plate = modal(hit, [97, 163, 241, 337, 452, 611, 787, 1043].map((f, k) => ({ f: f / size, t60: 0.35 - k * 0.03, gain: 1 / (1 + k * 0.4) })));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += TAU * (46 + 120 * Math.exp(-t / 0.025)) / SR;
    thud[i] = Math.sin(ph) * Math.exp(-t / 0.11) * smooth(t / 0.001);
  }
  const hp = new SVF(4200, 0.7);
  for (let i = 0; i < n; i++) { const t = i / SR - 0.07; hp.tick(r()); hiss[i] = t > 0 ? hp.hp * smooth(t / 0.03) * Math.exp(-t / 0.16) : 0; }
  norm(plate); norm(thud); norm(hiss);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = 0.55 * plate[i] + 0.9 * thud[i] + 0.16 * hiss[i];
  return norm(shape(out, tube, 1.6));
}

/** Pitched machine groan answering a long beep 4 octaves down: "BWOMM", with a power droop. */
function horn(midi, seconds, seed) {
  const n = Math.round((seconds + 0.35) * SR), out = new Float64Array(n);
  const f = mtof(midi - 48), o1 = new Osc(0), o2 = new Osc(0.37), lp = new SVF(200, 3), f1 = new SVF(300, 5), f2 = new SVF(700, 6), wob = drift(seed, 6);
  for (let i = 0; i < n; i++) {
    const t = i / SR, env = smooth(t / 0.012) * (1 - smooth((t - seconds) / 0.3));
    const droop = 1 - 0.09 * smooth((t - seconds * 0.6) / (seconds * 0.6 + 0.3));
    const p = f * droop * (1 + 0.05 * Math.exp(-t / 0.03)) * (1 + 0.003 * wob());
    const x = o1.saw(p) + 0.7 * o2.square(p, 0.45);
    lp.set(120 + 1900 * Math.exp(-t / 0.08), 2.4);
    const body = lp.tick(x);
    // mouth: "o" -> "m" closing formants give the groan its vocal edge
    const close = smooth(t / (seconds + 0.2));
    f1.set(520 - 260 * close, 5); f2.set(900 - 450 * close, 6);
    f1.tick(x); f2.tick(x);
    out[i] = (body + 0.5 * f1.bp + 0.25 * f2.bp) * env;
  }
  return norm(filt(shape(out, tube, 1.8), 'hp', 30, 0.7));
}

/** Kitchen-timer tick (plastic); with size > 1, a clock escapement the size of a building. */
function tick(size = 1, seed = 3) {
  const n = Math.round((0.06 + 0.3 * (size - 1)) * SR), x = new Float64Array(n), r = bipolar(rng(seed));
  for (let i = 0; i < 90; i++) x[i] = r() * Math.exp(-i / 18);
  const y = modal(x, [1830, 3120, 4410, 6230].map((f, k) => ({ f: f / size, t60: (0.025 + 0.01 * k) * size ** 1.5, gain: [1, 0.7, 0.45, 0.3][k] })));
  for (let i = 0; i < n; i++) y[i] = y[i] + x[i] * 0.4;
  return norm(y);
}

/** Washing-machine-drum kick: pitched body + tub thunk + click, oversampled drive. */
function kick(seed = 11) {
  const n = Math.round(0.6 * SR), body = new Float64Array(n), r = bipolar(rng(seed));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = 44 + 150 * Math.exp(-t / 0.03) + 26 * Math.exp(-t / 0.15);
    ph += TAU * f / SR;
    body[i] = Math.sin(ph) * (t < 0.03 ? 1 : Math.exp(-(t - 0.03) / 0.28)) * smooth(t / 0.0012);
  }
  const hot = norm(shape(body, Math.tanh, 1.7));
  const burst = new Float64Array(n);
  for (let i = 0; i < 260; i++) burst[i] = r() * Math.exp(-i / 40);
  const tub = norm(modal(burst, [{ f: 118, t60: 0.12, gain: 1 }, { f: 197, t60: 0.1, gain: 0.8 }, { f: 289, t60: 0.08, gain: 0.6 }, { f: 433, t60: 0.06, gain: 0.4 }]));
  const click = norm(filt(burst.slice(), 'hp', 2500, 0.7));
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = 1 * hot[i] + 0.22 * tub[i] + 0.12 * click[i];
  return norm(out);
}

/** Dispersive "toaster spring" (allpass chain in a short feedback loop) + layered clap + body. */
function springSnare(seed = 21) {
  const n = Math.round(0.6 * SR), r = bipolar(rng(seed));
  const spring = new Float64Array(n), stages = 48, a = -0.62, z = new Float64Array(stages), loop = new Delay(0.05);
  for (let i = 0; i < n; i++) {
    let x = (i < 4 ? 1 - i / 4 : 0) + 0.55 * loop.read(0.0213 * SR);
    for (let s = 0; s < stages; s++) { const y = a * x + z[s]; z[s] = x - a * y; x = y; }
    loop.write(x); spring[i] = x;
  }
  filt(spring, 'hp', 300, 0.7); filt(spring, 'lp', 7000, 0.7); norm(spring);
  const clap = new Float64Array(n), bp = new SVF(1350, 1.6);
  for (let i = 0; i < n; i++) {
    const t = i / SR; let env = 0;
    for (const o of [0, 0.009, 0.019, 0.031]) if (t >= o) env = Math.max(env, Math.exp(-(t - o) / (o === 0.031 ? 0.11 : 0.006)));
    bp.tick(r()); clap[i] = bp.bp * env;
  }
  norm(clap);
  const body = new Float64Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (185 + 60 * Math.exp(-t / 0.01)) / SR; body[i] = Math.sin(ph) * Math.exp(-t / 0.06); }
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = 0.45 * spring[i] + 1 * clap[i] + 0.35 * body[i];
  return norm(out);
}

/** Mechanical alarm-clock bell struck by its hammer: the hats. which=0/1 picks one of the two bells. */
function bellHat(which, decay = 1, seed = 31) {
  const n = Math.round((0.2 + 0.25 * decay) * SR), x = new Float64Array(n), r = bipolar(rng(seed));
  for (let i = 0; i < 60; i++) x[i] = r() * Math.exp(-i / 9);
  const f0 = which ? 3740 : 3290;
  const y = modal(x, [1, 1.47, 2.09, 2.56, 3.02].map((k, j) => ({ f: f0 * k, t60: (0.16 - j * 0.022) * decay, gain: [1, 0.6, 0.5, 0.35, 0.25][j] })));
  for (let i = 0; i < n; i++) y[i] += x[i] * 0.3;
  return norm(filt(y, 'hp', 2800, 0.7));
}

/** Fridge-hum bass: saw+square through an enveloped resonant low-pass, then tube drive. */
function fridgeBass(midi, steps, accent = 1, seed = 41) {
  const dur = steps * STEP, n = Math.round((dur + 0.1) * SR), out = new Float64Array(n);
  const f = mtof(midi), a = new Osc(0), b = new Osc(0.5), lp = new SVF(400, 1.2), w = drift(seed, 3);
  for (let i = 0; i < n; i++) {
    const t = i / SR, gate = smooth(t / 0.003) * (1 - smooth((t - dur) / 0.05));
    const ff = f * (1 + 0.002 * w());
    const x = 0.7 * a.saw(ff) + 0.5 * b.square(ff * 1.002, 0.5);
    lp.set(200 + 1700 * accent * Math.exp(-t / 0.06), 1.4);
    out[i] = lp.tick(x) * gate;
  }
  return norm(filt(shape(out, tube, 2.4), 'hp', 30, 0.7));
}

/** The alarm learns to talk: square lead through moving vowel formants (talk-box-like). */
const VOWEL = { ee: [270, 2290, 3010], ih: [390, 1990, 2550], eh: [530, 1840, 2480], ah: [730, 1090, 2440], oh: [570, 840, 2410], oo: [300, 870, 2240] };
function talker(midi, steps, from, to, seed = 51) {
  const dur = steps * STEP, n = Math.round((dur + 0.08) * SR), out = new Float64Array(n);
  const f = mtof(midi), o = new Osc(0), o2 = new Osc(0.3), fs = [0, 1, 2].map(() => new SVF(500, 8)), w = drift(seed, 5);
  const A = VOWEL[from], B = VOWEL[to];
  for (let i = 0; i < n; i++) {
    const t = i / SR, gate = smooth(t / 0.004) * (1 - smooth((t - dur) / 0.04)), m = smooth(t / Math.max(0.05, dur * 0.8));
    const pitch = f * 2 ** ((-0.6 * Math.exp(-t / 0.03) + 0.003 * w()) / 12);
    const x = 0.6 * o.square(pitch, 0.32) + 0.5 * o2.saw(pitch * 1.004);
    let y = 0;
    for (let k = 0; k < 3; k++) { fs[k].set(A[k] + (B[k] - A[k]) * m, [7, 10, 12][k]); fs[k].tick(x); y += fs[k].bp * [1, 0.8, 0.45][k]; }
    out[i] = (y + 0.05 * x) * gate;
  }
  return norm(out);
}

/** Off-beat chord stab, detuned saws through an enveloped low-pass. Stereo, peak ~1. */
function stab(chord, open = 1) {
  const n = Math.round(0.42 * SR), L = new Float64Array(n), R = new Float64Array(n);
  chord.forEach((midi, k) => {
    for (const [side, det] of [[L, -0.07], [R, 0.07]]) {
      const o = new Osc((k * 0.17 + det + 1) % 1), lp = new SVF(500, 1.6);
      for (let i = 0; i < n; i++) {
        const t = i / SR, env = smooth(t / 0.003) * Math.exp(-t / 0.11);
        lp.set(300 + 3800 * open * Math.exp(-t / 0.05), 1.6);
        side[i] += lp.tick(o.saw(mtof(midi + det))) * env;
      }
    }
  });
  const p = Math.max(peakOf({ L, R }), 1e-9); scale(L, 1 / p); scale(R, 1 / p);
  return { L, R };
}

/** Microwave "DING": inharmonic bell, plus a cosmic shadow three octaves down and a sub drop. */
function ding() {
  const n = Math.round(1.6 * SR), x = new Float64Array(n), r = bipolar(rng(61));
  for (let i = 0; i < 80; i++) x[i] = r() * Math.exp(-i / 12);
  const bell = norm(modal(x, [1, 2.76, 5.40, 8.93, 1.5, 3.9].map((k, j) => ({ f: 1318.5 * k, t60: [2.2, 1.4, 0.9, 0.5, 1.6, 1.0][j], gain: [1, 0.5, 0.3, 0.15, 0.25, 0.2][j] }))));
  const giant = norm(modal(x, [1, 2.76, 5.40, 8.93].map((k, j) => ({ f: 164.8 * k, t60: [3, 2.2, 1.5, 0.9][j], gain: [1, 0.5, 0.3, 0.15][j] }))));
  const out = new Float64Array(n); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += TAU * (36 + 70 * Math.exp(-t / 0.1)) / SR;
    out[i] = bell[i] * 0.5 + giant[i] * 0.7 + 0.8 * Math.sin(ph) * Math.exp(-t / 0.6) * smooth(t / 0.003);
  }
  return norm(out);
}

/** The drop's impact: an oversized press stamp, a noise wash and the alarm bell ringing out. */
function impact() {
  const n = Math.round(2.2 * SR), r = bipolar(rng(77)), wash = new Float64Array(n), lp = new SVF(9000, 0.7);
  for (let i = 0; i < n; i++) { const t = i / SR; lp.set(9000 * Math.exp(-t / 0.8) + 1500, 0.7); wash[i] = lp.tick(r()) * Math.exp(-t / 0.55) * smooth(t / 0.002); }
  const stamp = clank(78, 0.55), bell = bellHat(0, 9, 79), out = new Float64Array(n);
  norm(wash);
  for (let i = 0; i < n; i++) out[i] = 0.35 * wash[i] + (stamp[i] ?? 0) * 0.9 + (bell[i] ?? 0) * 0.25;
  return norm(out);
}

/** Repeat ever-shorter slices of a source with rising pitch: the hook glitches into the drop. */
function ratchet(source, sliceSteps, count, accel, rise) {
  const out = []; let t = 0, len = sliceSteps * STEP, pitch = 1;
  for (let k = 0; k < count; k++) {
    const n = Math.round(len * SR), seg = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const p = i * pitch, j = Math.floor(p), f = p - j;
      seg[i] = ((source[j] ?? 0) * (1 - f) + (source[j + 1] ?? 0) * f) * smooth(i / 40) * smooth((n - i) / 60);
    }
    out.push({ t, seg }); t += len; len *= accel; pitch *= 2 ** (rise / 12);
  }
  return out;
}

/** One-shots for the DaemonV12 kit integration (each mono, peak ~1). */
export const KIT = {
  'washer-kick': () => kick(11), 'toaster-snare': () => springSnare(21), 'bell-a': () => bellHat(0, 1, 31), 'bell-b': () => bellHat(1, 1, 32),
  'press-clank': () => clank(100), 'microwave-ding': () => ding(), 'kitchen-tick': () => tick(1, 5),
  'beep-e': () => piezo(88, 0.55), 'beep-b': () => piezo(83, 1.2), 'beep-g': () => piezo(91, 1.6), 'beep-f': () => piezo(89, 1.6),
};
export { CALL, ANSWER };

// ---------------------------------------------------------------- arrangement
export function render() {
  const n = Math.round(LENGTH * SR);
  const bus = name => (bus[name] ??= stereo(LENGTH));
  const kicks = [];
  const swing = 0.018, sw = s => (s % 2 ? swing : 0);
  const glitchAt = at(1, 12);

  // ---- Bar 1: the alarm alone in a small kitchen. Bar 2: every beep now moves machinery.
  for (const [bar, phrase] of [[0, CALL], [1, ANSWER]]) {
    phrase.forEach(([s, m, len], k) => {
      if (bar === 1 && s >= 12) return; // bar 2 ends in the glitch instead
      addPan(bus('beep'), piezo(m, len), at(bar, s), db(-10) * (s % 4 === 0 ? 1 : 0.85), 0.1);
      if (bar === 1) {
        if (len < 1) addPan(bus('machine'), clank(100 + k, 1 + (k % 2) * 0.25), at(bar, s) + 0.006, db(-9), k % 2 ? 0.3 : -0.3);
        else addPan(bus('machine'), horn(m, len * STEP + 0.2, 120 + k), at(bar, s) + 0.01, db(-7), 0);
      }
    });
    for (let s = 0; s < 16; s += 2) addPan(bus('kitchen'), tick(1, 5 + s), at(bar, s) + 0.003, db(bar ? -24 : -19), -0.35);
  }
  // A clock escapement the size of a building marks bar 2's beats.
  for (const s of [0, 4, 8]) addPan(bus('machine'), tick(5, 70 + s), at(1, s), db(-14), s === 4 ? 0.45 : -0.45);

  // ---- The glitch (3.5 -> 4.0 s): the G-F fragment ratchets upward; a toaster pops; reality inhales.
  const src = new Float64Array(Math.round(0.4 * SR));
  addAt(src, piezo(91, 1.6), 0); addAt(src, piezo(89, 1.6), STEP * 2);
  for (const { t, seg } of ratchet(src, 1, 12, 0.76, 1.4)) addPan(bus('beepWet'), seg, glitchAt + t, db(-10), Math.sin(t * 37) * 0.6);
  addPan(bus('drums'), springSnare(29), at(1, 15), db(-11), 0.1);
  addPan(bus('machine'), impact(), at(2), db(-8), 0);
  const swell = horn(76, 0.8, 9).reverse();
  addPan(bus('machine'), swell, at(2) - swell.length / SR + 0.01, db(-12), 0);

  // ---- Bars 3-5: the groove.
  const BASS = [
    [[0, 28, 1.5], [3, 40, 0.7], [6, 28, 1.2], [7, 40, 0.6], [9, 35, 1.0], [12, 31, 1.5], [14, 29, 1.6]],
    [[0, 28, 1.5], [3, 40, 0.7], [6, 28, 1.2], [7, 40, 0.6], [9, 35, 1.0], [12, 38, 0.9], [13, 36, 0.9], [14, 35, 1.8]],
    [[0, 28, 1.5], [3, 40, 0.7], [6, 28, 1.2], [7, 40, 0.6], [12, 31, 0.8], [14, 29, 1.4]],
  ];
  const TALK = [
    [[0, 76, 0.6, 'ee', 'ih'], [1, 76, 0.6, 'ee', 'ih'], [3, 71, 1.3, 'ah', 'oh'], [6, 76, 0.6, 'ee', 'ih'], [7, 76, 0.6, 'ee', 'ih'], [9, 71, 1.3, 'ah', 'oh'], [12, 79, 1.7, 'oh', 'ah'], [14, 77, 1.8, 'ah', 'oo']],
    [[0, 76, 0.6, 'ee', 'ih'], [1, 76, 0.6, 'ee', 'ih'], [3, 71, 1.3, 'ah', 'oh'], [6, 76, 0.6, 'ee', 'ih'], [7, 76, 0.6, 'ee', 'ih'], [9, 71, 1.3, 'ah', 'oh'], [12, 74, 0.9, 'eh', 'ah'], [13, 72, 0.9, 'ah', 'oh'], [14, 71, 2.0, 'oh', 'oo']],
  ];
  const chord = [52, 55, 59, 62, 66]; // E3 G3 B3 D4 F#4: Em9
  const hole = (b, s) => b === 4 && s >= 8 && s < 12; // the floor vanishes for beat 3 of bar 5
  for (let b = 2; b <= 4; b++) {
    for (let beat = 0; beat < 4; beat++) {
      const t = at(b, beat * 4);
      if (hole(b, beat * 4)) continue;
      addPan(bus('drums'), kick(11 + beat), t, db(beat === 0 ? -3 : -3.6), 0); kicks.push(t);
      if (beat % 2 === 1) addPan(bus('drums'), springSnare(20 + b * 4 + beat), t, db(-8), 0.06);
    }
    for (let s = 0; s < 16; s++) {
      if (hole(b, s)) continue;
      const accent = s % 4 === 2 ? 0 : s % 2 ? -5 : -8;
      addPan(bus('drums'), bellHat(s % 2, s % 4 === 2 ? 1.6 : 1, 300 + b * 16 + s), at(b, s) + sw(s), db(-19 + accent), s % 2 ? 0.45 : -0.3);
    }
    for (const [s, m, len] of BASS[b - 2]) {
      if (hole(b, s)) continue;
      addPan(bus('bass'), fridgeBass(m, len, s === 0 ? 1 : 0.8, 400 + s), at(b, s) + sw(s), db(s === 0 ? -6 : -7), 0);
    }
    for (const s of [2, 6, 10, 14]) {
      if (hole(b, s)) continue;
      addStereo(bus('music'), stab(chord, b === 2 ? 0.45 : 0.9), at(b, s) + swing * 0.5, db(-17));
    }
    for (const [s, m, len, from, to] of TALK[(b - 2) % 2]) {
      if (hole(b, s)) continue;
      addPan(bus('music'), talker(m, len, from, to, 500 + s), at(b, s) + sw(s), db(s % 4 === 0 ? -11 : -12.5), -0.08);
    }
    // the original beeper keeps ringing on top: the identity never leaves
    (b === 3 ? ANSWER : CALL).forEach(([s, m, len]) => {
      if (hole(b, s)) return;
      addPan(bus('beepWet'), piezo(m, len), at(b, s) + sw(s), db(-19), 0.35);
    });
  }
  // In the dropped beat of bar 5 the alarm is left alone, stuck on its wrong note, then sags.
  for (let k = 0; k < 4; k++) addPan(bus('beepWet'), piezo(89, 0.5, { bend: k === 3 ? -9 : 0 }), at(4, 8) + k * STEP, db(-11), (k - 1.5) * 0.3);
  // Final downbeat: the microwave DING that ends the world; then one tiny polite beep.
  const end = at(5);
  addPan(bus('machine'), ding(), end, db(-6), 0);
  addPan(bus('drums'), kick(99), end, db(-3), 0); kicks.push(end);
  addPan(bus('kitchen'), piezo(88, 0.9), end + 0.75, db(-16), 0.2);

  // ---------------------------------------------------------- mix
  const pump = duckCurve(n, kicks, { depth: 0.7, release: 0.11 });
  const pumpSoft = duckCurve(n, kicks, { depth: 0.35, release: 0.14 });
  for (let i = 0; i < n; i++) {
    bus('bass').L[i] *= pump[i]; bus('bass').R[i] *= pump[i];
    bus('music').L[i] *= pumpSoft[i]; bus('music').R[i] *= pumpSoft[i];
  }
  // Spaces: a tiny kitchen for the alarm; a vast hangar for everything the alarm controls.
  const roomIn = stereo(LENGTH), hallIn = stereo(LENGTH);
  addStereo(roomIn, bus('kitchen')); addStereo(roomIn, bus('beep'));
  addStereo(hallIn, bus('machine')); addStereo(hallIn, bus('beepWet'), 0, 0.8); addStereo(hallIn, bus('drums'), 0, 0.06);
  addStereo(hallIn, bus('music'), 0, 0.12);
  const room = reverb(roomIn, { size: 0.22, rt60: 0.35, hfRatio: 0.6, predelay: 0.002, lowCut: 250, seed: 2 });
  const hall = reverb(hallIn, { size: 2.6, rt60: 4.2, hfRatio: 0.45, predelay: 0.04, lowCut: 140, seed: 4 });
  const dly = echo(bus('music'), { left: STEP * 3, right: STEP * 4, feedback: 0.3, lp: 3500, hp: 500, pingpong: true });
  const mix = stereo(LENGTH);
  for (const name of ['kitchen', 'beep', 'beepWet', 'machine', 'drums', 'bass', 'music']) addStereo(mix, bus(name));
  addStereo(mix, room, 0, db(-6)); addStereo(mix, hall, 0, db(-7)); addStereo(mix, dly, 0, db(-15));
  monoBass(mix, 120);
  eqStereo(mix, [['hp', 25, 0.7, 0], ['peak', 300, 1.0, -1.5], ['hs', 9000, 0.7, 1.5]]);
  const gr = compress(mix, { threshold: -10, ratio: 2, attack: 0.02, release: 0.12, knee: 8 });
  const mastering = master(mix, { targetLufs: -14, ceilingDb: -1.2, release: 0.06 });
  fadeTail(mix, 0.08);
  return { bus: mix, meta: { bpm: BPM, bars: 5, seconds: LENGTH, compressorMaxDb: gr.reduce((a, b) => Math.max(a, b), 0), ...mastering } };
}
