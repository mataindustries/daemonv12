// The V12's mechanism as exact, periodic math, independent of rendering.
//
// A 60° V12: two banks of six cylinders at ±30° from vertical, one crank throw per cylinder
// pair with the two rods side by side (so the banks are staggered along the crank), throws at
// 0° / 240° / 120° / 120° / 240° / 0° like a straight six. Every cylinder reaches top dead centre
// when its crank pin lines up with its bank axis, which gives twelve even firings every 60° of
// crank over the 720° four-stroke cycle.
//
// World units (the engine is colossal; scale comes from the camera and the set): crank axis on
// z (front of the engine at +z), banks opening upward in the x–y plane.
import {BAR, LOOP, wrap} from '../timeline.ts';
import {TAU, smoothstep} from '../motion/periodic.ts';

export const GEO = {
  /** Crank throw radius (half the stroke). */
  r: 0.42,
  /** Connecting rod length, pin centre to pin centre. */
  l: 1.45,
  /** Piston radius (bore 0.80). */
  bore: 0.4,
  /** Piston height and wrist-pin height below the crown. */
  pistonH: 0.5,
  pinBelowCrown: 0.24,
  /** Cylinder pitch along the crank. */
  pitch: 1.05,
  /** Each rod sits this far either side of its throw centre; the banks are staggered by 2·stagger. */
  stagger: 0.12,
  /** Half-angle of the V. */
  bank: Math.PI / 6,
  /** Deck (cylinder head face) distance from the crank axis along the bank axis. */
  deck: 0.42 + 1.45 + 0.24 + 0.06,
} as const;

export const THROW_PHASE = [0, 240, 120, 120, 240, 0].map(d => (d * Math.PI) / 180);

export type Bank = 'R' | 'L';
export type Cylinder = {
  /** 1–12: 1–6 right bank front to rear, 7–12 left bank front to rear. */
  n: number;
  bank: Bank;
  throw: number;
  /** Signed bank angle from vertical (right bank +30°). */
  beta: number;
  /** Position along the crank. */
  z: number;
  /** Crank angle (0…4π) of this cylinder's firing top dead centre within the 720° cycle. */
  fireAt: number;
};

const throwZ = (k: number) => (2.5 - k) * GEO.pitch;

/**
 * Firing TDCs: right bank at 30° − φ, left at −30° − φ (mod 360°); each angle occurs for two
 * cylinders, one firing on the first revolution and one on the second, so firings fall every 60°.
 * Order 1-11-5-10-4-7-6-8-2-9-3-12.
 */
const FIRE_DEG: Record<number, number> = {1: 30, 11: 90, 5: 150, 10: 210, 4: 270, 7: 330, 6: 390, 8: 450, 2: 510, 9: 570, 3: 630, 12: 690};
export const FIRING_ORDER = Object.entries(FIRE_DEG)
  .sort((a, b) => a[1] - b[1])
  .map(([n]) => Number(n));

export const CYLINDERS: Cylinder[] = Array.from({length: 12}, (_, i) => {
  const n = i + 1;
  const bank: Bank = n <= 6 ? 'R' : 'L';
  const k = (n - 1) % 6;
  const beta = bank === 'R' ? GEO.bank : -GEO.bank;
  return {n, bank, throw: k, beta, z: throwZ(k) + (bank === 'R' ? GEO.stagger : -GEO.stagger), fireAt: (FIRE_DEG[n]! * Math.PI) / 180};
});

// ---------------------------------------------------------------------------------------------
// Crank cadence: one revolution per bar, plus exactly two extra revolutions inside OVERDRIVE
// (bars 5–6) as a smooth throttle blip: the revs build through bar 5 (the music's kick-out bar),
// peak at the downbeat of bar 6 (the payoff) and are back to idle by bar 7. Ten revolutions and
// five four-stroke cycles per loop, so crank, cams and firings are exactly periodic, with
// continuous angular velocity.

export const CRANK_REVS = 10;
const BLIP_START = 4 * BAR;
const BLIP_PEAK = 5 * BAR;
const BLIP_END = 6 * BAR;
const blipShape = (t: number) => smoothstep(BLIP_START, BLIP_PEAK, t) * (1 - smoothstep(BLIP_END - 0.37 * BAR, BLIP_END, t));

/** Extra revolutions accumulated by the throttle blip (0 before bar 5, exactly 2 after bar 6). */
const blipTable = (() => {
  const N = 15000;
  const table = new Float64Array(N + 1);
  let acc = 0;
  let prev = blipShape(0);
  for (let i = 1; i <= N; i++) {
    const s = blipShape((i / N) * LOOP);
    acc += ((prev + s) / 2) * (LOOP / N);
    table[i] = acc;
    prev = s;
  }
  const scale = 2 / acc; // in revolutions
  for (let i = 0; i <= N; i++) table[i]! *= scale;
  return {table, N, peak: scale};
})();

/** Crank angle in radians, unbounded (0 at t = 0, 10 revolutions at t = 15 s). */
export const crankAngle = (tIn: number) => {
  const t = wrap(tIn);
  const x = (t / LOOP) * blipTable.N;
  const i = Math.min(blipTable.N - 1, Math.floor(x));
  const extra = blipTable.table[i]! + (blipTable.table[i + 1]! - blipTable.table[i]!) * (x - i);
  return TAU * (t / BAR + extra);
};
/** Crank speed in revolutions per bar (1 at idle, ≈2.3 at the peak of OVERDRIVE). */
export const crankSpeed = (t: number) => 1 + blipTable.peak * BAR * blipShape(wrap(t));

// ---------------------------------------------------------------------------------------------
// Slider-crank geometry, in the cylinder's own plane.

export type PistonPose = {
  /** Wrist-pin distance from the crank axis along the bank axis. */
  pin: number;
  /** Crank-pin position in the x–y plane. */
  crankPin: readonly [number, number];
  /** Wrist-pin position in the x–y plane. */
  wristPin: readonly [number, number];
  /** Rod angle from the bank axis (radians). */
  rodAngle: number;
  /** 0 at top dead centre, 1 at bottom dead centre. */
  travel: number;
};

/**
 * Crank pin direction at crank angle θ for throw phase φ: measured from vertical toward +x
 * (the right bank), turning clockwise when seen from the front.
 */
export const crankPinAt = (theta: number, phase: number): readonly [number, number] => {
  const a = theta + phase;
  return [GEO.r * Math.sin(a), GEO.r * Math.cos(a)];
};

export const pistonPose = (cyl: Cylinder, theta: number): PistonPose => {
  const cp = crankPinAt(theta, THROW_PHASE[cyl.throw]!);
  const axis: [number, number] = [Math.sin(cyl.beta), Math.cos(cyl.beta)];
  // Components of the crank pin along and across the bank axis.
  const along = cp[0] * axis[0] + cp[1] * axis[1];
  const across = cp[0] * axis[1] - cp[1] * axis[0];
  const pin = along + Math.sqrt(GEO.l * GEO.l - across * across);
  const wristPin: [number, number] = [axis[0] * pin, axis[1] * pin];
  const rodAngle = Math.asin(across / GEO.l);
  const travel = (GEO.r + GEO.l - pin) / (2 * GEO.r);
  return {pin, crankPin: cp, wristPin, rodAngle, travel};
};

// ---------------------------------------------------------------------------------------------
// Four-stroke cycle: 0° firing TDC, 0–180 power, 180–360 exhaust, 360–540 intake, 540–720 compression.

/** Position of a cylinder in its 720° cycle, radians in [0, 4π). */
export const cyclePhase = (cyl: Cylinder, theta: number) => {
  const p = (theta - cyl.fireAt) % (2 * TAU);
  return p < 0 ? p + 2 * TAU : p;
};

const deg = (d: number) => (d * Math.PI) / 180;
/** Smooth cam-profile lift (0…1) over an opening window, zero outside it. */
const lobe = (p: number, open: number, close: number) => {
  if (p <= open || p >= close) return 0;
  const u = (p - open) / (close - open);
  const s = Math.sin(Math.PI * u);
  return s * s;
};
/** Exhaust valves: open 160° (before BDC), close 380° (after TDC, overlap). */
export const exhaustLift = (phase: number) => lobe(phase, deg(160), deg(380)) + lobe(phase + 2 * TAU, deg(160), deg(380));
/** Intake valves: open 340°, close 580°. */
export const intakeLift = (phase: number) => lobe(phase, deg(340), deg(580));
/** Cam angle (half crank speed). */
export const camAngle = (theta: number) => theta / 2;

/** Combustion light: a white-hot flash at ignition decaying through the power stroke (0…1). */
export const combustion = (phase: number) => {
  // Ignition a few degrees before TDC, peak just after.
  const p = phase < deg(700) ? phase : phase - 2 * TAU;
  if (p < deg(-14) || p > deg(200)) return 0;
  if (p < deg(4)) return smoothstep(deg(-14), deg(4), p);
  return Math.exp(-(p - deg(4)) / deg(48));
};
/** Spark: a short electric arc just before TDC (0…1). */
export const spark = (phase: number) => {
  const p = phase < deg(700) ? phase : phase - 2 * TAU;
  const c = deg(-9);
  const w = deg(5);
  return Math.exp(-(((p - c) / w) ** 2));
};
/** Exhaust gas leaving the port: a pulse that starts when the valve opens (0…1 position along the header, or −1). */
export const exhaustPulse = (phase: number) => {
  const p = phase;
  if (p < deg(165) || p > deg(500)) return -1;
  return (p - deg(165)) / (deg(500) - deg(165));
};
