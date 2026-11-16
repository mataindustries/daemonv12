/**
 * ORGANIC PERCUSSION · contact-driven bodies (tight -> cavernous).
 *
 * Nothing in the Signature Rack works like this. The rack's struck sounds are fixed excitations into modal bars or
 * one-shot drum patches; here a hand (a mass with soft, stiffening flesh) actually collides with a vibrating body:
 *
 *   hand:   M z'' = P - F - A z'          F = K c (1 + c/c0) + R (z' - u')       while c = z - u > 0   (A: the arm, if it stays)
 *   body:   q_n'' + 2 s_n q_n' + w_n(t)^2 q_n = phi_n(x) F / m_n               u = sum phi_n(x) q_n
 *
 * so contact time, brightness and loudness are consequences of how hard, where and with what the body is hit, a hand
 * that stays on the skin damps and sharpens it, and a hit lands on a body that is still moving from the last one
 * (repeated notes never repeat). Three more couplings make it breathe:
 *   - tension: the skin's pitch rises with its own vibration energy and with a squeeze (`press`, `bend`, slides);
 *   - air: an air cavity is a coupled oscillator under the skin / tongue, and IS the voice of the pot, where the
 *     playing hand opens and closes the hole (pitch whoops);
 *   - friction: a rubbing finger drives the skin through a stick-slip friction curve (a moan that follows the tension),
 *     and loose beads resting on the skin leave it and fall back (a buzz that dies when the skin calms down).
 * One body per written pitch lives for the whole part, panned across the stereo field. Deterministic: seeded only.
 */
import { RATE, curveAt, clamp } from '../studio-001/rack/curves.ts';
import type { ControlSpec, NoteEvent, PartPerformance, RenderContext } from '../studio-001/rack/types.ts';
import { LAB_VERSION, NOMINAL_RMS, controlAt, mulberry, num, rmsOf, spec, type LabInstrument } from './util.ts';

const DT = 1 / RATE, TAU = 2 * Math.PI, BLOCK = 32, C0 = 4e-4;
type Kind = 'skin' | 'log' | 'pot';
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** J_m(x) by its integral representation (midpoint rule; exact to rounding for the orders and arguments used here). */
function besselJ(m: number, x: number): number {
  let s = 0;
  for (let k = 0; k < 64; k++) { const t = Math.PI * (k + 0.5) / 64; s += Math.cos(m * t - x * Math.sin(t)); }
  return s / 64;
}
/** Zeros j(m, n) of J_m: the modes of an ideal circular membrane, row m = nodal diameters. */
const ZEROS: number[][] = [
  [2.4048, 5.5201, 8.6537, 11.7915, 14.9309, 18.0711], [3.8317, 7.0156, 10.1735, 13.3237, 16.4706], [5.1356, 8.4172, 11.6198, 14.796, 17.9598],
  [6.3802, 9.761, 13.0152, 16.2235], [7.5883, 11.0647, 14.3725, 17.616], [8.7715, 12.3386, 15.7002], [9.9361, 13.5893, 17.0038], [11.0864, 14.8213],
  [12.2251, 16.0378], [13.3543, 17.2412], [14.4755], [15.5898], [16.6983], [17.8014],
];
interface SkinMode { j: number; m: number; thin: number }
const SKIN_MODES: SkinMode[] = (() => {
  const list: SkinMode[] = [], high: SkinMode[] = [];
  ZEROS.forEach((row, m) => row.forEach(j => list.push({ j, m, thin: 1 })));
  // above the table: McMahon's asymptotic zeros, every fourth kept (a thinned but still inharmonic top for slaps)
  for (let m = 0; m <= 24; m++) for (let k = 2; k <= 12; k++) {
    const beta = (k + m / 2 - 0.25) * Math.PI, j = beta - (4 * m * m - 1) / (8 * beta);
    if (j > 18.2 && j < 31) high.push({ j, m, thin: 1.8 });
  }
  high.sort((x, y) => x.j - y.j);
  for (let i = 1; i < high.length; i += 4) list.push(high[i]!);
  return list.sort((x, y) => x.j - y.j);
})();

interface Hand {
  on: boolean; rub: boolean; z: number; vz: number; im: number; k: number; kcap: number; d: number; vs: number; press: number; hold: number; age: number; fp: number; snap: number; arm: number;
  w: Float64Array; wm: Float64Array; vb: number; nf: number; nfNow: number; veps: number; phase: number;
}
type Ev =
  | { f: number; t: 'hit'; pos: number; area: number; mass: number; k: number; d: number; v: number; hold: number; press: number; snap: number; arm: number }
  | { f: number; t: 'rub'; pos: number; len: number; vb: number; nf: number }
  | { f: number; t: 'air'; amp: number; ap0: number; ap1: number; tau: number }
  | { f: number; t: 'bend'; to: number; len: number };

class Body {
  readonly kind: Kind; readonly f0: number; readonly n: number;
  readonly ratio: Float64Array; readonly tens: Uint8Array; readonly im: Float64Array; readonly sig: Float64Array;
  readonly a: Float64Array; readonly b: Float64Array; readonly co: Float64Array; readonly si: Float64Array; readonly rr: Float64Array; readonly iw: Float64Array;
  readonly oL: Float64Array; readonly oR: Float64Array; readonly volI: number[] = []; readonly volW: number[] = [];
  readonly shape: (n: number, pos: number, area: number) => number;
  // air cavity (one coupled oscillator)
  ca = 0; cb = 0; cco = 1; csi = 0; crr = 0; ciw = 0; cim = 0; cOut = 0; kap = 0; cSig = 0;
  ap = 1; apTo = 1; apTau = 0.05; airAmp = 0; airT = 0; airLen = 1; airNoise = 0; nz = 0;
  // pitch travel in semitones from the home pitch
  bend = 0; bFrom = 0; bTo = 0; bT = 0; bLen = 0;
  // beads resting on the surface
  readonly nb = 14; readonly beadW: Float64Array[] = []; readonly beadZ = [0, 0]; readonly beadV = [0, 0]; readonly beadF = [0, 0]; buzz = 0;
  readonly hands: Hand[] = []; l = 0; r = 0; dsm = 0; awake = false; private readonly rnd: () => number;

  constructor(kind: Kind, f0: number, seed: number) {
    this.kind = kind; this.f0 = f0; this.rnd = mulberry(seed);
    const defs: { ratio: number; tens: number; mass: number; t60: number; oL: number; oR: number; vol: number }[] = [];
    if (kind === 'skin') {
      for (const md of SKIN_MODES) {
        const ratio = md.j / 2.4048, vol = md.m === 0 ? 2 * besselJ(1, md.j) / md.j / 0.4318 : 0;
        defs.push({ ratio, tens: 1, mass: 0.012, t60: 0.62 * Math.pow(ratio, -0.75) * (md.m === 0 ? 0.75 : 1), vol,
          oL: besselJ(md.m, md.j * 0.62) * Math.cos(md.m * 2.0) * md.thin * Math.sqrt(ratio), oR: besselJ(md.m, md.j * 0.55) * Math.cos(md.m * 4.3) * md.thin * Math.sqrt(ratio) });
      }
      this.shape = (n, pos, area) => { const md = SKIN_MODES[n]!; return besselJ(md.m, md.j * pos) * Math.exp(-0.5 * (md.j * area) ** 2) * md.thin; };
      this.cim = 1 / 0.012; this.cOut = 0.9;
    } else if (kind === 'log') {
      // a wooden tongue (clamped at pos 0, free at pos 1) over a box: constant-Q wood, box knocks at fixed formants
      const tongue = [1, 3.9, 6.27, 11.2, 17.55], q = [75, 30, 34, 24, 18], box = [310, 520, 815, 1240, 1900, 2750, 3900], bs = Math.pow(f0 / 147, 0.35);
      tongue.forEach((ratio, k) => defs.push({ ratio, tens: 1, mass: 0.02, t60: 6.9 * q[k]! / (Math.PI * f0 * ratio), vol: k === 0 ? 1 : 0.25 / (k + 1), oL: k === 0 ? 1 : k % 2 ? -2.4 : 2.2, oR: k === 0 ? 1 : k % 3 ? 2.3 : -2 }));
      box.forEach((f, k) => defs.push({ ratio: f * bs, tens: 0, mass: 0.04, t60: 6.9 * (13 + 2 * k) / (Math.PI * f * bs), vol: 0, oL: 2.4 * (k % 2 ? 1 : -0.8), oR: 2.4 * (k % 3 ? -0.9 : 1) }));
      this.shape = (n, pos, area) => n < 5 ? Math.sin((2 * n + 1) * Math.PI / 2 * pos) * Math.exp(-0.5 * (n * area * 3) ** 2) : (0.3 + 0.7 * (1 - pos) ** 2) * (n % 2 ? 1 : -0.8);
      this.cim = 1 / 0.02; this.cOut = 1.6;
    } else {
      // fired clay: short inharmonic wall modes; the air in the pot carries the pitch
      const wall = [455, 790, 1130, 1710, 2380, 3300, 4500], ws = Math.pow(f0 / 110, 0.3);
      wall.forEach((f, k) => defs.push({ ratio: f * ws, tens: 0, mass: 0.05, t60: 0.26 / (1 + 0.55 * k), vol: 0.25 * (k % 2 ? -1 : 1) / (k + 1), oL: k % 2 ? 3 : -2.7, oR: k % 3 ? -3 : 2.4 }));
      this.shape = (n, pos) => Math.cos(1.7 * n * pos + 0.5 * n) * (0.45 + 0.55 * pos);
      this.cim = 1 / 0.004; this.cOut = 1;
    }
    const n = this.n = defs.length;
    this.ratio = Float64Array.from(defs, d => d.ratio); this.tens = Uint8Array.from(defs, d => d.tens); this.im = Float64Array.from(defs, d => 1 / d.mass);
    this.sig = Float64Array.from(defs, d => 6.9 / d.t60); this.oL = Float64Array.from(defs, d => d.oL); this.oR = Float64Array.from(defs, d => d.oR);
    defs.forEach((d, i) => { if (d.vol !== 0) { this.volI.push(i); this.volW.push(d.vol); } });
    this.a = new Float64Array(n); this.b = new Float64Array(n); this.co = new Float64Array(n); this.si = new Float64Array(n); this.rr = new Float64Array(n); this.iw = new Float64Array(n);
    for (let h = 0; h < 2; h++) this.hands.push({ on: false, rub: false, z: 0, vz: 0, im: 1, k: 0, kcap: 0, d: 0, press: 0, hold: 0, age: 0, fp: 0, snap: 0, arm: 0, vs: 0.08, w: new Float64Array(n), wm: new Float64Array(n), vb: 0, nf: 0, nfNow: 0, veps: 0.01, phase: 0 });
    const nb = Math.min(this.nb, n);
    [[0.7, 1.1], [0.36, 3.9]].forEach(([pos, th]) => { const w = new Float64Array(nb); for (let k = 0; k < nb; k++) w[k] = kind === 'skin' ? besselJ(SKIN_MODES[k]!.m, SKIN_MODES[k]!.j * pos!) * Math.cos(SKIN_MODES[k]!.m * th!) : this.shape(k, pos!, 0.02); this.beadW.push(w); });
  }
  private weights(h: Hand, pos: number, area: number): number {
    let y = 0;
    for (let k = 0; k < this.n; k++) { const w = this.shape(k, pos, area); h.w[k] = w; h.wm[k] = w * this.im[k]! * DT; y += w * w * this.im[k]!; }
    return y;
  }
  private slot(): Hand { const h = this.hands.find(x => !x.on) ?? this.hands.reduce((p, c) => (c.age > p.age ? c : p)); h.on = true; h.age = 0; h.fp = 0; return h; }
  apply(e: Ev): void {
    this.awake = true;
    if (e.t === 'hit') {
      const h = this.slot(), y = this.weights(h, e.pos, e.area);
      let u = 0; for (let k = 0; k < this.n; k++) u += h.w[k]! * this.b[k]! * this.iw[k]!;
      h.rub = false; h.z = u; h.vz = e.v; h.im = 1 / e.mass; h.k = e.k; h.hold = e.hold; h.press = e.press; h.snap = e.snap; h.arm = e.arm;
      // stiffness and flesh damping are capped so the explicit contact loop stays well inside its stability limit
      h.kcap = 1.5e9 / (h.im + y); h.d = e.d * 0.5 / (DT * (h.im + y));
    } else if (e.t === 'rub') {
      const h = this.slot(), y = this.weights(h, e.pos, 0.16);
      h.rub = true; h.hold = e.len; h.vb = e.vb; h.nf = e.nf; h.nfNow = 0; h.phase = this.rnd() * TAU; h.vs = 0.02 + 0.25 * e.vb; h.veps = Math.max(0.012, 1.6 * e.nf * 0.9 * y * DT);
    } else if (e.t === 'air') { this.airAmp = e.amp; this.airT = 0; this.airLen = Math.round(0.006 * RATE); this.ap = e.ap0; this.apTo = e.ap1; this.apTau = e.tau; }
    else { this.bFrom = this.bend; this.bTo = e.to; this.bT = 0; this.bLen = Math.max(1, e.len); }
  }
  /** Control-rate update: tension (pitch travel, squeeze, energy), damping, cavity tuning and coupling, beads. */
  update(pressSt: number, glideSt: number, damp: number, coup: number, depth: number, wah: number, buzz: number, air: number): void {
    const { n, a, b } = this, tb = BLOCK * DT;
    if (this.bT < this.bLen) { this.bT = Math.min(this.bLen, this.bT + BLOCK); const x = this.bT / this.bLen; this.bend = this.bFrom + (this.bTo - this.bFrom) * x * x * (3 - 2 * x); }
    let e = 0; const top = Math.min(8, n);
    for (let k = 0; k < top; k++) if (this.tens[k]) e += a[k]! * a[k]! + b[k]! * b[k]!;
    // glideSt = semitones of upward tension at the energy of a strong open hit (measured: about 0.6 m2/s2 over the low modes)
    const g = Math.pow(2, clamp(this.bend + pressSt, -12, 14) / 12) * Math.sqrt(1 + (Math.pow(2, glideSt / 6) - 1) * Math.min(2.5, e / 0.6));
    this.ap += (this.apTo - this.ap) * (1 - Math.exp(-tb / this.apTau));
    const open = clamp(this.ap * (1 - 0.92 * wah), 0, 1);
    // Two coupled oscillators (fundamental + air) have closed-form eigenfrequencies; solve backwards so the upper one is
    // exactly the written pitch and the lower one is where the air should sit (an octave under a skin, a hair under a tongue).
    let wc = TAU * this.f0 * (1 - depth * (1 - open)), gm = 1, kc = 0;
    if (this.kind !== 'pot') {
      const B = this.kind === 'skin' ? 0.25 : (1 - coup) ** 2, S = 1 + B;
      kc = this.kind === 'skin' ? coup : Math.sqrt(0.8 * (1 - 4 * B / (S * S)));
      const root = Math.sqrt(Math.max(0, S * S - 4 * B / (1 - kc * kc)));
      gm = Math.sqrt((S + root) / 2); wc = TAU * this.f0 * Math.sqrt((S - root) / 2);
    } else kc = 0.04;
    const first = this.volI[0] ?? 0;
    for (let k = 0; k < n; k++) {
      const f = this.tens[k] ? this.f0 * this.ratio[k]! * g * (k === first ? gm : 1) : this.ratio[k]!, w = TAU * f * DT;
      if (w > 2.2) { this.co[k] = 0; this.si[k] = 0; this.rr[k] = 0; this.iw[k] = 0; }
      else { this.co[k] = Math.cos(w); this.si[k] = Math.sin(w); this.rr[k] = Math.exp(-this.sig[k]! * damp * DT); this.iw[k] = 1 / (TAU * f); }
    }
    this.cco = Math.cos(wc * DT); this.csi = Math.sin(wc * DT); this.ciw = 1 / wc;
    this.crr = Math.exp(-this.cSig * damp * (this.kind === 'pot' ? 1 + 2.5 * (1 - open) : 1) * DT);
    this.kap = kc * wc * (TAU * this.f0 * g * gm) / Math.sqrt(this.cim * this.im[first]!); // relative coupling: stable at any tension
    this.buzz = buzz; this.airNoise = air;
    for (const h of this.hands) if (h.on && h.rub) { // the rubbing finger never moves evenly
      h.phase += TAU * 5.3 * tb; h.age += BLOCK;
      const tgt = h.age < h.hold ? h.nf : 0; h.nfNow += (tgt - h.nfNow) * (1 - Math.exp(-tb / (tgt > 0 ? 0.012 : 0.03)));
      if (tgt === 0 && h.nfNow < 0.01 * h.nf) h.on = false;
    }
    let live = e + this.ca * this.ca + this.cb * this.cb;
    for (let k = top; k < n; k++) live += a[k]! * a[k]!;
    this.awake = live > 1e-13 || this.hands.some(h => h.on) || this.airT < this.airLen || this.bT < this.bLen || Math.abs(this.ap - this.apTo) > 1e-3;
  }
  step(): void {
    const { n, a, b, co, si, rr, iw } = this;
    let direct = 0;
    for (const h of this.hands) {
      if (!h.on) continue;
      const w = h.w; let u = 0, ud = 0, F = 0;
      for (let k = 0; k < n; k++) { const wk = w[k]!; u += wk * b[k]! * iw[k]!; ud += wk * a[k]!; }
      if (h.rub) { // stick-slip: friction falls as the finger starts to slide, so the skin is pumped at its own pitch
        const v = h.vb * (1 + 0.22 * Math.sin(h.phase)) - ud, av = Math.abs(v);
        F = h.nfNow * Math.tanh(v / h.veps) * (0.25 + 0.65 * Math.exp(-av / h.vs));
      } else {
        const c = h.z - u;
        if (c > 0) { F = Math.min(h.k * c * (1 + c / C0), h.kcap * c) + h.d * (h.vz - ud); if (F < 0) F = 0; }
        h.age++;
        const p = h.age < h.hold ? h.press : -(h.hold > 0 ? 60 : h.age > 440 ? 600 : 0) / h.im; // stay, lift, or get out of the way
        // a hand that stays is held by an arm: that is where the skin's energy goes
        h.vz += (p - F - (h.age < h.hold ? h.arm * h.vz : 0)) * h.im * DT; h.z += h.vz * DT;
        direct += (F - h.fp) * h.snap; h.fp = F;
        if (c <= 0 && h.vz < 0 && h.age >= h.hold) h.on = false;
      }
      if (F !== 0) { const wm = h.wm; for (let k = 0; k < n; k++) a[k] = a[k]! + F * wm[k]!; }
    }
    if (this.buzz > 0.01) for (let q = 0; q < 2; q++) { // a bead held against the surface by a weak spring: it leaves and lands
      const w = this.beadW[q]!, nb = w.length, bim = 1 / (0.0022 * this.buzz); let u = 0;
      for (let k = 0; k < nb; k++) u += w[k]! * b[k]! * iw[k]!;
      const c = u - this.beadZ[q]!, F = c > 0 ? Math.min(1.2e5 * c, 40) : 0;
      this.beadV[q] = (this.beadV[q]! + (F * bim - 260) * DT) * (F > 0 ? 0.985 : 1); this.beadZ[q] = this.beadZ[q]! + this.beadV[q]! * DT;
      const net = F - 260 / bim; // the surface already carries the resting bead: only the difference acts on it
      for (let k = 0; k < nb; k++) a[k] = a[k]! - net * w[k]! * this.im[k]! * DT;
      direct += (F - this.beadF[q]!) * 0.9; this.beadF[q] = F;
    }
    let l = 0, r = 0;
    if (this.cim > 0) {
      let Q = 0; const vi = this.volI, vw = this.volW, qc = this.cb * this.ciw;
      for (let i = 0; i < vi.length; i++) { const k = vi[i]!; Q += vw[i]! * b[k]! * iw[k]!; a[k] = a[k]! - this.kap * vw[i]! * qc * this.im[k]! * DT; }
      let f = -this.kap * Q;
      if (this.airT < this.airLen) { f += this.airAmp * Math.sin(Math.PI * this.airT / this.airLen); this.airT++; }
      const ca = this.ca + f * this.cim * DT, cb = this.cb;
      this.ca = this.crr * (this.cco * ca - this.csi * cb); this.cb = this.crr * (this.csi * ca + this.cco * cb);
      l = r = this.cOut * this.ca;
      if (this.airNoise > 0) { this.nz += 0.18 * ((this.rnd() * 2 - 1) - this.nz); const puff = this.airNoise * 0.5 * Math.abs(this.ca) * this.nz; l += puff; r += puff; }
    }
    const oL = this.oL, oR = this.oR;
    for (let k = 0; k < n; k++) {
      const ak = a[k]!, bk = b[k]!, c = co[k]!, s = si[k]!, d = rr[k]!, na = d * (c * ak - s * bk);
      a[k] = na; b[k] = d * (s * ak + c * bk); l += oL[k]! * na; r += oR[k]! * na;
    }
    this.dsm += 0.4 * (direct - this.dsm); // the smack of the contact itself
    this.l = l + 0.008 * this.dsm; this.r = r + 0.008 * this.dsm;
  }
}

// ---------------------------------------------------------------------------------------------- instruments
interface Stroke { pos: number; area: number; mass: number; k: number; d: number; v: number; hold: number; press: number; snap: number }
const HOLD_NOTE = -1;
const S = (pos: number, area: number, mass: number, k: number, d: number, v: number, hold = 0, press = 0, snap = 1): Stroke => ({ pos, area, mass, k, d, v, hold, press, snap });
interface Def {
  id: string; kind: Kind; name: string; description: string; range: [number, number]; gainDb: number; spread: number; refPitch: number; refArt: string;
  articulations: Record<string, string>; controls: ControlSpec[]; params: Record<string, string>;
  defaults: Record<string, (m: number) => number>; strokes: Record<string, Stroke>;
}
const C = { press: spec('press', -5, 12, 'squeeze on the skin in semitones (talking-drum bend); moves ringing notes too'),
  glide: spec('glide', 0, 4, 'tension glide: semitones a hard hit starts sharp before the skin settles'),
  damp: spec('damp', 0.3, 3, 'decay scale (1 = natural; lower rings longer)'),
  pos: spec('pos', -0.4, 0.4, 'moves every strike toward the centre/root (-) or the edge/tip (+)'),
  buzz: spec('buzz', 0, 1, 'beads resting on the surface: they rattle while it moves enough to throw them') };
const DEFS: Def[] = [
  { id: 'organic-percussion/skin', kind: 'skin', name: 'Hand skin', range: [36, 72], gainDb: -6, spread: 0.5, refPitch: 55, refArt: 'open',
    description: 'A skin over an open shell, played by hands that really collide with it: contact time, brightness and the pitch glide of the stretched skin all follow the hit. A hand that stays damps the note; a wet finger rubbed on the skin moans at the skin\'s own pitch. One drum per written pitch, all still ringing when the next hit lands.',
    articulations: { open: 'fingers bounce off: the ringing tone', bass: 'palm in the centre: low boom, long contact', slap: 'fingertips whip the edge and stay a moment: bright crack', mute: 'hand stays on the skin for the length of the note: dead, slightly sharp',
      tap: 'one fingertip, soft: ghost note', roll: 'finger roll for the length of the note (alternating fingers, swelling)', rub: 'wet finger rubbed for the length of the note: a friction moan that follows press/bend' },
    controls: [C.press, C.glide, C.damp, spec('shell', 0, 0.5, 'coupling to the air in the shell: a boom an octave under the tone'), C.buzz, C.pos],
    params: { bend: 'semitones squeezed over the length of the note (pitch travels while it rings or moans)', pos: 'strike position 0 centre .. 1 edge (replaces the articulation\'s own)' },
    defaults: { press: () => 0, glide: m => 0.3 + 1.7 * m, damp: m => 1.25 - 0.8 * m, shell: m => 0.14 + 0.26 * m, buzz: m => Math.max(0, m - 0.55) * 1.6, pos: () => 0 },
    strokes: { open: S(0.5, 0.035, 0.018, 4e5, 0.1, 1), bass: S(0.08, 0.16, 0.07, 7e4, 0.15, 0.9), slap: S(0.8, 0.03, 0.009, 7e5, 0.5, 1.25, 0.045, 1.2, 2.2), mute: S(0.45, 0.07, 0.03, 2e5, 0.9, 1, HOLD_NOTE, 3),
      tap: S(0.68, 0.025, 0.004, 4e5, 0.1, 0.7), roll: S(0.56, 0.03, 0.005, 4e5, 0.1, 0.75), rub: S(0.12, 0.11, 1, 0, 0, 1) } },
  { id: 'organic-percussion/log', kind: 'log', name: 'Hollow log', range: [36, 79], gainDb: -7, spread: 0.4, refPitch: 55, refArt: 'strike',
    description: 'A wooden tongue over a hollow box. The air inside is tuned a hair under the tongue, so every note is a slow doublet that wobbles as it dies; the box answers with dry knocks. Mallet mass and hardness decide the contact, not a filter.',
    articulations: { strike: 'soft mallet near the tip of the tongue: round hollow note', knuckle: 'hard small knock mid-tongue: bright tok', rim: 'on the box edge: dry wooden click, hardly any pitch',
      mute: 'mallet stays on the tongue for the length of the note: choked', scrape: 'stick dragged across the ridges for the length of the note, accelerating toward the tip' },
    controls: [spec('hollow', 0.002, 0.12, 'how far under the tongue the box air sits: speed of the hollow wobble (fraction of the pitch)'), C.damp, spec('hard', 0, 1, 'mallet hardness: felt .. bare wood'), C.pos, C.buzz],
    params: { pos: 'strike position 0 root .. 1 tip (replaces the articulation\'s own)' },
    defaults: { hollow: m => 0.012 + 0.05 * m, damp: m => 1.2 - 0.75 * m, hard: m => 0.62 - 0.3 * m, pos: () => 0, buzz: () => 0 },
    strokes: { strike: S(0.85, 0.12, 0.03, 1, 0.1, 1), knuckle: S(0.6, 0.05, 0.012, 8e5, 0.1, 1.1, 0, 0, 0.8), rim: S(0.03, 0.03, 0.01, 9e5, 0.1, 1.05, 0, 0, 0.8), mute: S(0.8, 0.1, 0.03, 1, 0.9, 1, HOLD_NOTE, 2.5),
      scrape: S(0.2, 0.03, 0.003, 6e5, 0.1, 1.2, 0, 0, 0.8) } },
  { id: 'organic-percussion/pot', kind: 'pot', name: 'Clay pot', range: [33, 67], gainDb: -5, spread: 0.3, refPitch: 45, refArt: 'whoop',
    description: 'A clay pot with a side hole. The written pitch is the air inside with the hole open; the playing hand covers and uncovers it, so notes whoop up, sag down or sit dead and low, and fingertips on the wall ring short clay modes over the air.',
    articulations: { whoop: 'palm hits the hole and bounces away: the pitch whoops up to the note', drop: 'hit open, then the hand closes the hole over the note: the pitch sags', palm: 'palm stays on the hole for the length of the note, then lets go: low dead thud and a small after-whoop',
      tap: 'fingertip on the belly: clay tick with a faint air note' },
    controls: [spec('wah', 0, 1, 'hand over the hole (0 open .. 1 covered): bends ringing air'), spec('depth', 0.1, 0.8, 'how far covering the hole lowers the pitch (fraction of the frequency)'), C.damp, spec('air', 0, 1, 'breath noise of the air rushing through the hole'), C.pos],
    params: { pos: 'tap position 0 neck .. 1 belly' },
    defaults: { wah: () => 0, depth: m => 0.3 + 0.35 * m, damp: m => 1.2 - 0.75 * m, air: m => 0.25 + 0.4 * m, pos: () => 0 },
    strokes: { whoop: S(0.12, 0.05, 0.02, 2e5, 0.15, 0.35), drop: S(0.12, 0.05, 0.02, 2e5, 0.15, 0.3), palm: S(0.12, 0.08, 0.04, 1e5, 0.9, 0.3, HOLD_NOTE, 2), tap: S(0.75, 0.02, 0.008, 8e5, 0.1, 1.8, 0, 0, 1.5) } },
];

interface Lanes { [name: string]: (beat: number) => number }
function simulate(def: Def, perf: PartPerformance, ctx: RenderContext, notes: NoteEvent[], seed: number): [Float64Array, Float64Array] {
  const frames = ctx.frames, bs = ctx.beatSeconds, L = new Float64Array(frames), R = new Float64Array(frames), rnd = mulberry(seed);
  const lane: Lanes = {}; for (const c of def.controls) lane[c.name] = controlAt(perf, c, def.defaults[c.name]!);
  const expr = (b: number) => curveAt(perf.expression, b), at = (name: string, beat: number, d = 0) => lane[name]?.(beat) ?? d;
  // one body per written pitch; a note with `slide` stays on the previous note's body and bends it there
  const bodies = new Map<number, { body: Body; ev: Ev[]; pitch: number }>();
  let last: { body: Body; ev: Ev[]; pitch: number } | undefined;
  notes.forEach((n, i) => {
    const key = Math.round(n.pitch * 100), frame = Math.round(n.beat * bs * RATE), len = Math.max(1, Math.round(n.beats * bs * RATE));
    let slot = n.slide !== undefined && last && Math.abs(n.pitch - last.pitch) <= 12 ? last : bodies.get(key);
    if (!slot) { slot = { body: new Body(def.kind, hz(n.pitch), seed + 17 * key), ev: [], pitch: n.pitch }; bodies.set(key, slot); }
    last = slot;
    const art = n.articulation && def.strokes[n.articulation] ? n.articulation : def.refArt, st = def.strokes[art]!;
    const vel = clamp(n.velocity * (0.55 + 0.65 * expr(n.beat)), 0, 1), v0 = 0.25 + 3.2 * Math.pow(vel, 1.6), hand = i % 2 ? 1.08 : 0.93;
    const pos = clamp(num(n.params?.pos, st.pos) + at('pos', n.beat) + 0.03 * (rnd() * 2 - 1), 0.02, 0.95);
    const travel = n.pitch - slot.pitch;
    if (travel !== 0) slot.ev.push({ f: frame, t: 'bend', to: travel, len: Math.round((n.slide ?? 0.01) * bs * RATE) });
    else if (slot.body.kind === 'skin') slot.ev.push({ f: frame, t: 'bend', to: 0, len: Math.round(0.004 * RATE) });
    if (typeof n.params?.bend === 'number') slot.ev.push({ f: frame + 1, t: 'bend', to: travel + n.params.bend, len });
    const hard = at('hard', n.beat, 0.5), k = st.k === 1 ? 5e4 * Math.pow(14, hard) : st.k;
    const hit = (f: number, v: number, p: number, s: Stroke = st): void => { slot!.ev.push({ f, t: 'hit', pos: p, area: s.area, mass: s.mass * hand, k: s.k === 1 ? k : s.k, d: s.d, v: v * s.v, hold: s.hold === HOLD_NOTE ? len : Math.round(s.hold * RATE), press: s.press, snap: s.snap, arm: s.hold === HOLD_NOTE ? 45 : 5 }); };
    if (art === 'rub') slot.ev.push({ f: frame, t: 'rub', pos, len, vb: 0.1 + 0.5 * vel, nf: 2.2 * (0.1 + 0.5 * vel) * 0.012 * TAU * hz(n.pitch) / 0.9 }); // enough grip to stick at this pitch
    else if (art === 'roll' || art === 'scrape') { // many small contacts: fingers in turn, or a stick over ridges
      const dur = n.beats * bs; let t = 0, j = 0;
      while (t < dur) {
        const x = t / dur, rate = art === 'roll' ? 21 + 5 * x : 26 + 44 * x * x, shape = art === 'roll' ? 0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, 0.15 + x)) : 0.5 + 0.5 * x;
        hit(frame + Math.round(t * RATE), v0 * shape * (0.85 + 0.3 * rnd()), art === 'roll' ? clamp(pos + (j % 2 ? 0.1 : 0), 0.02, 0.95) : clamp(0.15 + 0.75 * x + 0.04 * rnd(), 0.02, 0.95));
        t += (1 + 0.16 * (rnd() - 0.5)) / rate; j++;
      }
    } else if (def.kind === 'pot' && art !== 'tap') {
      const amp = 9 * v0;
      if (art === 'whoop') slot.ev.push({ f: frame, t: 'air', amp, ap0: 0.12, ap1: 1, tau: 0.035 + 0.06 * (1 - vel) });
      else if (art === 'drop') slot.ev.push({ f: frame, t: 'air', amp, ap0: 1, ap1: 0.08, tau: Math.max(0.05, 0.45 * n.beats * bs) });
      else { slot.ev.push({ f: frame, t: 'air', amp: amp * 0.9, ap0: 0.1, ap1: 0.06, tau: 0.05 }); slot.ev.push({ f: frame + len, t: 'air', amp: 0, ap0: 0.06, ap1: 1, tau: 0.04 }); }
      hit(frame, v0, pos);
    } else hit(frame, v0, pos);
  });
  const list = [...bodies.values()].sort((x, y) => x.pitch - y.pitch), spread = num(perf.setup.spread, def.spread);
  list.forEach((slot, bi) => {
    const pan = list.length === 1 ? 0 : spread * (2 * bi / (list.length - 1) - 1) * (bi % 2 ? 1 : 0.6), gl = Math.min(1, 1 - pan), gr = Math.min(1, 1 + pan), body = slot.body;
    const ev = slot.ev.sort((x, y) => x.f - y.f); let e = 0;
    body.cSig = 6.9 / (def.kind === 'pot' ? 0.5 : def.kind === 'log' ? 0.3 : 0.28);
    for (let i = Math.floor((ev[0]?.f ?? frames) / BLOCK) * BLOCK; i < frames; i += BLOCK) {
      const next = ev[e]?.f ?? Infinity;
      if (!body.awake && next >= i + BLOCK) { if (next === Infinity) break; i = Math.floor(next / BLOCK) * BLOCK - BLOCK; continue; }
      const beat = i * DT / bs;
      body.update(at('press', beat), def.kind === 'skin' ? at('glide', beat) : 0, at('damp', beat, 1), def.kind === 'skin' ? at('shell', beat) : at('hollow', beat, 0.02), at('depth', beat, 0.4), at('wah', beat), at('buzz', beat), def.kind === 'pot' ? at('air', beat) : 0);
      const end = Math.min(frames, i + BLOCK);
      for (let s = i; s < end; s++) {
        while (e < ev.length && ev[e]!.f <= s) body.apply(ev[e++]!);
        body.step(); L[s] = L[s]! + gl * body.l; R[s] = R[s]! + gr * body.r;
      }
    }
  });
  return [L, R];
}

const scale = new Map<string, number>();
function instrument(def: Def): LabInstrument {
  const blankPerf = (notes: NoteEvent[]): PartPerformance => ({ notes, macro: 0, controls: {}, offsets: {}, expression: 0.7, setup: {}, breaths: [], motion: [] });
  return {
    id: def.id, family: 'organic-percussion', name: def.name, version: `${LAB_VERSION}+timbre-lab`,
    macro: { id: 'tight-cavernous', label: 'tight → cavernous', from: 'tight', to: 'cavernous' },
    description: def.description, range: def.range, articulations: def.articulations, controls: def.controls,
    setup: [spec('seed', 0, 4294967295, 'random seed (hand positions, roll and scrape timing)'), spec('spread', 0, 1, `stereo spread of the bodies, low to high (default ${def.spread})`)],
    params: def.params, suggestedGainDb: def.gainDb,
    async render(perf, ctx) {
      let k = scale.get(def.id);
      if (k === undefined) { // calibrate once: the reference stroke at macro 0, velocity 0.8 is -20 dBFS RMS
        const ref = simulate(def, blankPerf([{ beat: 0, beats: 1, pitch: def.refPitch, velocity: 0.8, articulation: def.refArt }]), { ...ctx, beatSeconds: 0.5, frames: Math.round(0.4 * RATE) }, [{ beat: 0, beats: 1, pitch: def.refPitch, velocity: 0.8, articulation: def.refArt }], 1);
        k = NOMINAL_RMS / rmsOf(ref[0], 0, Math.round(0.3 * RATE)); scale.set(def.id, k);
      }
      const sorted = [...perf.notes].sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
      const [l, r] = simulate(def, perf, ctx, sorted, num(perf.setup.seed, ctx.seed + 101 * ctx.partIndex));
      for (let i = 0; i < l.length; i++) { l[i] = l[i]! * k; r[i] = r[i]! * k; }
      return [l, r];
    },
  };
}
export const ORGANIC_PERCUSSION: LabInstrument[] = DEFS.map(instrument);
