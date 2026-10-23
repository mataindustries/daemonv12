// MORPH//06 Wobble Beast: experiments/morph-05/beast.mjs copied unchanged except that its two
// whole-performance normalisations (the bowed source before the fold distortion, and the mouth
// before its grit) can be pinned to a reference render's peaks with `levels`. Without pinning a
// louder phrase late in the record changes the drive, and so the sound, of every phrase before
// it. Without `levels` it renders exactly as MORPH//05; the measured peaks are returned.
// MORPH//05 Wobble Beast: the MORPH//03 instrument (experiments/morph-03/exp2-wobble-beast.mjs),
// made playable from a phrase list. Its vocal folds are a hard-bowed Tempo String (tension =
// pitch); its mouth is the MORPH//02 Kelly-Lochbaum throat; every wobble is a mouth shape in
// time, never an LFO. The signal chain is unchanged from MORPH//03: distort the folds, then the
// throat, light glue, a metal throat ring, and a clean sub that follows the mouth's openness.
import { SR, mtof, smooth, shape, split, filt, scale, combRes, crush } from '../morph-03/dsp.mjs';
import { cable, curve } from '../morph-03/cable.mjs';
import { throat, articulation, wobbles } from '../morph-03/throat.mjs';
import { at, periodLane } from '../morph-04/perform.mjs';

/** norm(x, 1) of MORPH//03 dsp.mjs, with the peak optionally pinned; records the measured peak in `measured[key]`. */
export function pinnedNorm(x, key, levels, measured) {
  let p = 0;
  for (const v of x) p = Math.max(p, Math.abs(v));
  measured[key] = p;
  const ref = levels?.[key] ?? p;
  return ref > 0 ? scale(x, 1 / ref) : x;
}

const hz = m => mtof(m);
// syllable -> mouth cell (MORPH//03 vocabulary). len is in seconds when the cell is built.
const SYLLABLES = {
  WOM: { from: 'ww', to: 'ah', open: 0.35, close: 0.5 },
  wa: { from: 'ww', to: 'ah', open: 0.2, close: 0.6 },
  ka: { from: 'kk', to: 'ah', open: 0.2, close: 0.5, end: 'kk' },
  YOI: { from: 'ee', to: 'oh', back: 'ee', open: 0.4, close: 0.4 },
  OW: { from: 'ah', to: 'oh', back: 'oo', open: 0.3, close: 0.6 },
  YOW: { from: 'ee', to: 'ah', back: 'ww', open: 0.3, close: 0.55 },
  ya: { from: 'ee', to: 'ah', open: 0.25, close: 0.6 },
  EEYOOW: { from: 'ee', to: 'oh', back: 'ww', open: 0.55, close: 0.35 },
  aah: { from: 'uh', to: 'ah', back: 'ah', open: 0.6, close: 0.3 },
};

/**
 * phrases: [{ name, anger (0..1), cells: [{ step, len (16ths), syl, midi, toMidi?, glide? (s), dive? }] }]
 * winds:   [{ from, to (steps), midi, restPeriod, collapse? }]: the Beast's source winds from slow pulses
 *          (vocal fry) into pitch together with the main cable; with `collapse` the held voice first
 *          falls apart into that creak (from `collapse` to `from`) instead of resting
 * levels:  pinned normalisation peaks { beastSource, beastMouth } (see the header)
 * Returns { sub, mid, art, openness, pitch, levels } (mono, `seconds` long; levels = the measured peaks).
 */
export function beast({ seconds, phrases, winds = [], glitches = [], gasps = [], seed = 77, levels = null }) {
  const measured = {};
  const n = Math.round(seconds * SR);
  const cells = phrases.flatMap(p => p.cells.map(c => ({ ...c, anger: p.anger ?? 0.4, phrase: p.name })));
  // ---- pitch: each syllable re-tensions the bowed cable; bends and dives are tension glides
  const pts = [];
  for (const c of cells) {
    pts.push({ t: at(c.step) - 0.004, hz: hz(c.midi), glide: 0.006 });
    if (c.toMidi !== undefined) pts.push({ t: at(c.step) + (c.dive ? 0.12 : at(c.len) * 0.35), hz: hz(c.toMidi), glide: c.glide ?? (c.dive ? 0.33 : at(c.len) * 0.5), curve: 'lin' });
  }
  for (const w of winds) {
    // slacken (while silent, or audibly: the voice collapses into creak), never faster than real
    // time (the read point must not run backwards)
    if (w.collapse !== undefined) pts.push({ t: at(w.collapse), period: w.restPeriod, glide: Math.min(at(w.from - w.collapse), 0.5), curve: 'lin' });
    else pts.push({ t: at(w.from) - 0.32, period: w.restPeriod, glide: 0.3, curve: 'lin' });
    pts.push({ t: at(w.from), period: 1 / hz(w.midi), glide: at(w.to - w.from), curve: 'ease' });
  }
  const pitch = periodLane(pts, 1 / hz(28));
  // ---- mouth: inhale before each phrase, lips closed between phrases
  const seq = [{ t: 0, ph: 'mm' }];
  for (const p of phrases) {
    const first = p.cells[0], last = p.cells[p.cells.length - 1];
    seq.push({ t: at(first.step) - 0.11, ph: 'hh', glide: 0.02 }, { t: at(first.step) - 0.02, ph: SYLLABLES[first.syl].from, glide: 0.01 });
    seq.push(...wobbles(p.cells.map(c => ({ t: at(c.step), len: at(c.len), ...SYLLABLES[c.syl] }))));
    seq.push({ t: at(last.step + last.len) - 0.01, ph: 'mm', glide: 0.03 });
  }
  for (const w of winds) {
    const a0 = w.collapse ?? w.from;
    if (w.collapse === undefined) seq.push({ t: at(w.from) - 0.06, ph: 'hh', glide: 0.02 });
    seq.push(...wobbles([{ t: at(a0), len: at(w.to - a0), ...SYLLABLES.aah }]), { t: at(w.to), ph: 'mm', glide: 0.03 });
  }
  for (const g of gasps) seq.push({ t: at(g), ph: 'hh', glide: 0.01 }, { t: at(g) + 0.18, ph: 'mm', glide: 0.05 });
  const art = articulation(seq);
  // ---- the source: bowed hard while speaking, resting otherwise
  const spans = [
    ...phrases.map(p => [at(p.cells[0].step), at(p.cells[p.cells.length - 1].step + p.cells[p.cells.length - 1].len)]),
    ...winds.map(w => [at(w.collapse ?? w.from), at(w.to)]),
  ];
  const speaking = t => spans.some(([a, b]) => t >= a - 0.01 && t < b);
  const angerAt = t => { let a = 0.4; for (const c of cells) if (t >= at(c.step) - 0.02) a = c.anger; return a; };
  const src = cable({
    seconds, period: pitch, disp: -0.16, stages: 120,
    gain: t => (speaking(t) ? 1.045 : 0.55), bright: 6500, drive: 2.8,
    buzz: t => 0.35 + 0.35 * angerAt(t), bow: t => (speaking(t) ? 1 : 0),
    damp: t => (cells.some(c => c.sputter && t > at(c.step) + 0.03 && t < at(c.step) + 0.065) ? 0.4 : 1),
    events: [
      ...phrases.map(p => ({ t: at(p.cells[0].step), hard: 0.9 + 0.1 * (p.anger ?? 0.4), amp: 1.2 + 0.1 * (p.anger ?? 0.4) })),
      ...winds.filter(w => w.collapse === undefined).map(w => ({ t: at(w.from), hard: 0.9, amp: 1.2 })),
    ],
    seed,
  }).out;
  // distort the vocal folds, not the mouth (formant motion stays legible)
  const folds = shape(pinnedNorm(src.slice(), 'beastSource', levels, measured), v => 0.6 * Math.tanh(v) + 0.4 * Math.sin(1.3 * v), 3.0);
  const mouth = throat(folds, { art, size: t => 0.85 - 0.07 * angerAt(t), metal: t => 0.6 + 0.35 * angerAt(t), breath: 0.9, seed: 5 });
  const { lo } = split(src, 100), { hi: mouthHi } = split(mouth, 100);
  // the sub follows the mouth: closed lips and chokes duck it, so the low end speaks the words
  const openness = new Float64Array(n);
  for (let i = 0, e = 0; i < n; i++) {
    const a = art(i / SR), o = a.voicing * Math.min(1, a.lipDiam / 1.2) * Math.min(1, 0.25 + a.tongueDiam) * (a.velum > 0.3 ? 0.5 : 1);
    e += (o - e) * 0.004; openness[i] = e;
  }
  const sub = Float64Array.from(lo, (v, i) => 0.95 * Math.tanh(1.3 * v) * (0.35 + 0.65 * openness[i]) * (speaking(i / SR) ? 1 : smooth(1 - (i / SR - lastEnd(spans, i / SR)) / 0.08)));
  pinnedNorm(mouthHi, 'beastMouth', levels, measured);
  const grit = shape(mouthHi, Math.tanh, 1.5);
  const ring = combRes(grit, t => (angerAt(t) > 0.6 ? 1 / hz(76) : 1 / hz(88)), 0.62, 0.25); // metal throat ring (E5 / E6)
  const mid = new Float64Array(n);
  for (let i = 0; i < n; i++) mid[i] = 0.85 * grit[i] + 0.22 * ring[i];
  filt(mid, 'hp', 120, 0.7); filt(mid, 'peak', 1100, 0.8, 3); filt(mid, 'peak', 2600, 1, 2.5);
  // broken moments: a beat-repeat of a 1/64 slice, bit-crushed (MORPH//03 bar 4)
  for (const g of glitches) {
    const g0 = Math.round(at(g.step) * SR), slice = Math.round(at(0.25) * SR), stut = mid.slice(g0, g0 + slice);
    for (let k = 1; k <= g.repeats; k++) for (let i = 0; i < slice; i++) {
      const j = g0 + k * slice + i, w = Math.min(1, i / 30, (slice - i) / 30);
      if (j < n) mid[j] = mid[j] * (1 - w) + stut[i] * w * (1 - 0.15 * k);
    }
    crush(mid, at(g.step), at(g.step) + (g.repeats + 1) * at(0.25) + 0.02, { bits: 4, hold: 5 });
  }
  return { sub, mid, art, openness, pitch: t => 1 / pitch(t), speaking, levels: measured };
}

function lastEnd(spans, t) {
  let e = -1e9;
  for (const [, b] of spans) if (b <= t && b > e) e = b;
  return e;
}

export const syllables = Object.keys(SYLLABLES);
export { curve };
