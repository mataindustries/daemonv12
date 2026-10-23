// MORPH//04 cable performance and studio helpers.
// The MORPH//03 Cable Bass automation, generalised so any score can be played on the same
// instrument (the cable model and DSP kit are imported unchanged from experiments/morph-03).
//   score notes: [step, midi, kind, len, extras], steps are absolute 16ths from the loop start
//   extras:      hard, amp, stretch, pop (2 octave | 3 twelfth), bendTo, snapTo + snapAt,
//                vowel ('ow' | 'aa'), zap (onset dispersion depth)
import { SR, mtof, clamp, smooth, SVF, Biquad, filt, shape, split, norm, stereo, addPan, foldMono, foldLoop } from './dsp.mjs';
import { curve, zapLane } from './cable.mjs';

export const BPM = 120, BEAT = 0.5, S16 = 0.125, BARS = 4, SECONDS = 8, STEPS = 64;
export const at = step => step * S16;
export const hz = m => mtof(m);
export const E1 = 28, F1 = 29, G1 = 31, A1 = 33, Bb1 = 34, B1 = 35, D2 = 38, E2 = 40;
export const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const noteName = m => `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;

export const notesOf = score => score.map(([step, midi, kind, len, x = {}]) => ({ step, midi, kind, len, ...x }));

/**
 * Round-trip period lane. points: {t, period | hz, glide?, curve?} re-tension geometrically
 * (smoothstep by default, 'lin' = constant ratio per second, 'ease' = slow start); {t, dive: {to, rate, k}} releases
 * the tension: exponential at k per second, never faster than `rate` seconds of round trip per
 * second (above 1 the read point would run backwards), until the period reaches `to`.
 */
export function periodLane(points, restPeriod) {
  const ps = [...points].sort((a, b) => a.t - b.t);
  return t => {
    let p = restPeriod;
    for (const q of ps) {
      if (t < q.t) break;
      const dt = t - q.t;
      if (q.dive) {
        const { to, rate = 0.92, k = 0 } = q.dive, pc = k > 0 ? rate / k : 0;
        let v;
        if (k > 0 && p < pc) {
          const tc = Math.log(pc / p) / k;
          v = dt < tc ? p * Math.exp(k * dt) : pc + rate * (dt - tc);
        } else v = p + rate * dt * smooth(dt / 0.06 + 0.5);
        p = Math.min(to, v);
        continue;
      }
      const target = q.period ?? 1 / q.hz, gl = q.glide ?? 0.012;
      const u = gl > 0 ? clamp(dt / gl, 0, 1) : 1;
      // 'lin': constant ratio per second; 'ease': slow at first (a ratchet passes through
      // dotted eighths, eighths, 16ths and 32nds before it fuses into pitch); default smoothstep
      p = p * (target / p) ** (q.curve === 'lin' ? u : q.curve === 'ease' ? u * u : u * u * (3 - 2 * u));
    }
    return p;
  };
}

/** Re-tension points for every note: onsets (slaps snap tighter), bends, abrupt re-tensions. */
export function notePoints(notes) {
  const pts = [];
  for (const n of notes) {
    pts.push({ t: at(n.step) - 0.004, hz: hz(n.midi), glide: n.kind === 'slap' ? 0.004 : 0.012 });
    if (n.bendTo) pts.push({ t: at(n.step + 0.5), hz: hz(n.bendTo), glide: at(1.1), curve: 'lin' });
    if (n.snapTo) pts.push({ t: at(n.snapAt), hz: hz(n.snapTo), glide: 0.002 });
  }
  return pts;
}

/** Cable strike events for the notes. */
export function noteEvents(notes) {
  return notes.map(n => ({
    t: at(n.step), kind: n.kind, hard: n.hard ?? (n.kind === 'slap' ? 1 : 0.8),
    amp: n.amp ?? (n.kind === 'ghost' ? 0.6 : 1), pos: n.kind === 'slap' ? 0.08 : 0.2,
    ...(n.stretch !== undefined ? { stretch: n.stretch } : {}),
  }));
}

/**
 * Palm-mute lane: between a note's end and the next onset the hand rests on the cable (it keeps
 * a short thump); ghosts are half-muted; grabs [{from, to}] (steps) stop the cable dead.
 * Outside [from, to) (steps) the cable rings freely.
 */
export function muteLane(notes, { from = 0, to = STEPS, grabs = [] } = {}) {
  const ns = [...notes].sort((a, b) => a.step - b.step);
  return t => {
    for (const g of grabs) if (t >= at(g.from) && t < at(g.to)) return 0;
    if (t < at(from) - 0.01 || t >= at(to)) return 1;
    let m = 1;
    for (let k = 0; k < ns.length; k++) {
      const nt = ns[k], stop = at(nt.step + nt.len), nextOn = k + 1 < ns.length ? at(ns[k + 1].step) : at(to);
      if (t >= stop && t < nextOn - 0.003) m = Math.min(m, 0.5 + 0.5 * (1 - smooth((t - stop) / 0.01)));
      if (nt.kind === 'ghost' && t >= at(nt.step) && t < at(nt.step + nt.len)) m = Math.min(m, 0.62);
    }
    return m;
  };
}

/** Grab gain: the hand stops the loop's feedback (multiplies the gain lane). */
export function grabGain(grabs) {
  return t => {
    let g = 1;
    for (const gr of grabs) {
      const a = at(gr.from), b = at(gr.to);
      if (t >= a - 0.002 && t < b + 0.004) g = Math.min(g, 1 - 0.68 * smooth((t - a + 0.002) / 0.004) * (1 - smooth((t - b) / 0.004)));
    }
    return g;
  };
}

/** Flageolet touches right after a popped pluck. */
export function harmonicLanes(notes) {
  return {
    harmonic: t => {
      for (const nt of notes) if (nt.pop && t >= at(nt.step) + 0.006 && t < at(nt.step + nt.len)) return smooth((t - at(nt.step) - 0.006) / 0.012);
      return 0;
    },
    harmonicN: t => { for (const nt of notes) if (nt.pop && t >= at(nt.step) && t < at(nt.step + nt.len) + 0.05) return nt.pop; return 2; },
  };
}

/** The cable slaps its guide on accents (more on slaps, a touch on ghosts). */
export function buzzLane(notes, rest = () => 0.05) {
  return t => {
    for (const nt of notes) if (t >= at(nt.step) && t < at(nt.step + Math.min(nt.len, 1.2))) {
      const base = nt.kind === 'slap' ? 0.75 : nt.kind === 'ghost' ? 0.1 : 0.35;
      return base * (nt.accent ?? 1) * (1 - 0.6 * smooth((t - at(nt.step)) / at(1.2)));
    }
    return rest(t);
  };
}

/** Every note opens with a laser "zap" (deep dispersion), then settles into clean pitch. */
export function zapDisp(base, notes) {
  return zapLane(base, notes.map(nt => ({
    t: at(nt.step), depth: nt.zap ?? (nt.kind === 'slap' ? -0.6 : nt.kind === 'ghost' ? -0.2 : nt.len <= 0.5 ? -0.25 : -0.5),
  })));
}

/**
 * Band-pass "talk" (the MORPH//03 pickup): talk spans [{from, to, per}] are stepped "yow" shapes
 * (per = shapes per beat, cut-off leaps up and sags, each louder); vowel notes sweep a formant.
 */
export function talkFilter(x, notes, talk = []) {
  const y = new Float64Array(x.length), bp = new SVF(400, 4), vowels = { ow: [520, 900], aa: [750, 1150] };
  const cells = talk.flatMap(s => { const len = BEAT / s.per, out = []; for (let t = at(s.from), k = 0; t < at(s.to) - 1e-9; t += len, k++) out.push({ t, len, k, end: at(s.to) }); return out; });
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    let f = 0, amt = 0;
    const c = cells.findLast(cc => t >= cc.t && t < cc.end);
    if (c) { const u = (t - c.t) / c.len; f = 300 + (900 + 250 * c.k) * Math.exp(-u * 3.5); amt = 0.55 + 0.07 * c.k; }
    for (const n of notes) if (n.vowel && t >= at(n.step) && t < at(n.step + n.len + 0.5)) {
      const [lo, hi] = vowels[n.vowel], u = (t - at(n.step)) / at(n.len);
      f = n.vowel === 'aa' ? lo + (hi - lo) * smooth(u * 1.4) : hi - (hi - lo) * smooth(u); amt = 0.6;
    }
    if (amt > 0) { bp.set(f, 4); bp.tick(x[i]); y[i] = x[i] * (1 - amt) + bp.bp * amt * 2.6; }
    else { bp.tick(x[i]); y[i] = x[i]; }
  }
  return y;
}

/**
 * The MORPH//03 bass chain: a clean, honest sub (4th-order 30 Hz high-pass) and a driven,
 * talkative presence band (what phones hear), kept separate so the sub can make room for kicks.
 * Returns mono { sub, presence } at the gains the Cable Bass used (sub + presence = the bass).
 */
export function bassBands(x) {
  const { lo, hi } = split(x, 110);
  const hiDriven = shape(hi, v => 0.7 * Math.tanh(v) + 0.3 * Math.sin(v), 2.2);
  const presence = filt(filt(hiDriven.slice(), 'hp', 300, 0.7), 'peak', 1400, 0.9, 3);
  norm(lo, 1); norm(presence, 1);
  const sub = Float64Array.from(lo, v => 0.95 * Math.tanh(1.2 * v));
  new Biquad('hp', 30, 0.5412).run(sub); new Biquad('hp', 30, 1.3066).run(sub);
  for (let i = 0; i < presence.length; i++) presence[i] *= 0.55;
  return { sub, presence };
}

// ---------------------------------------------------------------- studio helpers
/** Add a one-shot into a mono buffer at time t with gain g. */
export function place(buf, x, t, g = 1) {
  const s = Math.round(t * SR);
  for (let i = 0; i < x.length && s + i < buf.length; i++) if (s + i >= 0) buf[s + i] += x[i] * g;
}

/** Duck a buffer under triggers (kick-led low end): depth, hold, release in seconds. */
export function duckUnder(x, times, { depth = 0.75, attack = 0.002, hold = 0.03, release = 0.07 } = {}) {
  const g = new Float64Array(x.length).fill(1);
  for (const t of times) {
    const s0 = Math.round((t - attack) * SR), len = Math.round((attack + hold + 6 * release) * SR);
    for (let i = 0; i < len; i++) {
      const k = s0 + i; if (k < 0 || k >= x.length) continue;
      const u = i / SR - attack, d = u < 0 ? smooth(1 + u / attack) : u < hold ? 1 : Math.exp(-(u - hold) / release);
      g[k] = Math.min(g[k], 1 - depth * d);
    }
  }
  for (let i = 0; i < x.length; i++) x[i] *= g[i];
  return g;
}

/** Gate a buffer shut over step spans [{from, to}] with short fades (stops, chokes). */
export function holes(spans, { fadeOut = 0.006, fadeIn = 0.004 } = {}) {
  return t => {
    let g = 1;
    for (const s of spans) {
      const a = at(s.from), b = at(s.to);
      g = Math.min(g, 1 - smooth((t - a) / fadeOut) * (1 - smooth((t - b + fadeIn) / fadeIn)));
    }
    return g;
  };
}
export function applyGain(x, fn) { for (let i = 0; i < x.length; i++) x[i] *= fn(i / SR); return x; }

/**
 * Ratchet: repeat a captured sound once per round trip of a cable (period lane), so the drums
 * follow the cable's tension: an accelerando fuses into a pitched tone, a dive slows it back into
 * rhythm. Slices start at `from`, each as long as the cable's period at that moment.
 * Returns { out, slices } (mono, full length).
 */
export function ratchet(capture, period, from, to, n, { gain = () => 1, fade = 0.0007 } = {}) {
  const out = new Float64Array(n), slices = [], f = Math.max(2, Math.round(fade * SR));
  let t = from;
  while (t < to - 1e-4) {
    const L = Math.min(period(t), to - t), s = Math.round(t * SR), len = Math.round(L * SR), g = gain(t);
    for (let i = 0; i < len && s + i < n && i < capture.length; i++) {
      const w = Math.min(1, i / f, (len - 1 - i) / f);
      out[s + i] += capture[i] * w * g;
    }
    slices.push({ t: +t.toFixed(4), length: +L.toFixed(4) });
    t += L;
  }
  return { out, slices };
}

/** Start times of successive round trips of a period lane between from and to (seconds). */
export function roundTrips(period, from, to) {
  const ts = [];
  for (let t = from; t < to - 1e-4; t += period(t)) ts.push(t);
  return ts;
}

/** Fold a mono stem to the loop and pan it into a stereo stem. */
export function stem(x, gain = 1, pan = 0) {
  const s = stereo(SECONDS);
  addPan(s, foldMono(x, SECONDS), 0, gain, pan);
  return s;
}

/**
 * A small mixer that keeps every source as its own stereo stem, so the stems sum exactly to the
 * dry mix. Sources are mono buffers placed with gain, pan and an optional delay (seconds).
 */
export class Mixer {
  constructor(seconds) { this.seconds = seconds; this.stems = {}; this.sends = stereo(seconds); }
  bus(name) { return (this.stems[name] ??= stereo(this.seconds)); }
  add(name, x, { gain = 1, pan = 0, delay = 0 } = {}) { addPan(this.bus(name), x, delay, gain, pan); return this; }
  send(x, { gain = 1, pan = 0 } = {}) { addPan(this.sends, x, 0, gain, pan); return this; }
  /** Fold every stem and the send bus to the loop length. */
  fold() {
    const stems = Object.fromEntries(Object.entries(this.stems).map(([k, b]) => [k, foldLoop(b, SECONDS)]));
    return { stems, send: foldLoop(this.sends, SECONDS) };
  }
}
