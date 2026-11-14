/** BOLLO coin instrument, v1. A reduced, uncalibrated disk/contact model; no sampled audio.
 * Mechanical scheduling and acoustic response are separate, reproducible functions.
 */
export const COIN_VERSION = '1.0.0';
export const SR = 44100;
export type Stereo = [Float64Array, Float64Array];
export type Motion = 'face' | 'edge' | 'bounce' | 'spin' | 'roll';
export type State = 'airborne' | 'impact' | 'bouncing' | 'rolling' | 'wobbling' | 'rest';
export interface CoinOptions {
  motion?: Motion;
  /** Normalized incoming speed; mapped to 0..4 m/s for vertical bounce scheduling. Zero is silent. */
  velocity?: number;
  /** 0 = face, 1 = edge. Motion selects the default, this can override it. */
  strike?: number;
  hardness?: number;
  spin?: number;
  damping?: number;
  /** 0 = dark/soft alloy, 1 = bright/stiff alloy. Character, not a metallurgical measurement. */
  material?: number;
  /** Relative radius; modal frequencies scale inversely with size squared at fixed thickness. */
  size?: number;
  position?: number;
  seed?: number;
  restitution?: number;
  /** Duration of spin/roll motion, independent of subsequent acoustic decay. */
  motionSeconds?: number;
}
export interface Contact {
  seconds: number; frame: number; regime: 'impact' | 'bounce' | 'wobble' | 'roll' | 'settle';
  strength: number; strike: number; angle: number; position: number;
}
export interface Transition { seconds: number; frame: number; state: State }
export interface CoinPlan {
  options: Required<CoinOptions>; contacts: Contact[]; transitions: Transition[];
  motionEndSeconds: number; seconds: number; frames: number;
  roll?: { start: number; seconds: number; speed: number; radius: number };
  wobble?: { start: number; seconds: number; startHz: number; maxHz: number; exponent: number };
}
const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const smooth = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };
const NEXT: Record<State, readonly State[]> = {
  rest: ['rest', 'airborne', 'impact', 'rolling'], airborne: ['impact'],
  impact: ['bouncing', 'wobbling', 'rest'], bouncing: ['airborne'],
  rolling: ['wobbling', 'rest'], wobbling: ['rest'],
};
export function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => { let t = (s = (s + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function coinOptions(input: CoinOptions = {}): Required<CoinOptions> {
  const motion = input.motion ?? 'face';
  if (!['face', 'edge', 'bounce', 'spin', 'roll'].includes(motion)) throw new RangeError('coin motion: face|edge|bounce|spin|roll');
  const p: Required<CoinOptions> = { motion, velocity: 0.8, strike: motion === 'face' ? 0 : 0.92,
    hardness: 0.88, spin: 0.65, damping: 0.45, material: 0.55, size: 1, position: 0,
    seed: 250, restitution: 0.61, motionSeconds: motion === 'roll' ? 2.2 : 2.65, ...input };
  for (const k of Object.keys(input)) if (!['motion', 'velocity', 'strike', 'hardness', 'spin', 'damping', 'material', 'size', 'position', 'seed', 'restitution', 'motionSeconds'].includes(k)) throw new RangeError(`coin: unknown option ${k}`);
  for (const k of ['velocity', 'strike', 'hardness', 'spin', 'damping', 'material'] as const)
    if (!Number.isFinite(p[k]) || p[k] < 0 || p[k] > 1) throw new RangeError(`coin ${k}: 0..1`);
  for (const [k, lo, hi] of [['size', 0.7, 1.4], ['position', -1, 1], ['restitution', 0.25, 0.85], ['motionSeconds', 0.15, 6]] as const)
    if (!Number.isFinite(p[k]) || p[k] < lo || p[k] > hi) throw new RangeError(`coin ${k}: ${lo}..${hi}`);
  if (!Number.isInteger(p.seed) || p.seed < 0 || p.seed > 0xffffffff) throw new RangeError('coin seed: uint32');
  return p;
}
/** Regularized finite-time acceleration. This is PRECESSION/contact rate, never bounce restitution.
 * The exponent is a sound-design approximation; dissipation exponents vary with surface and slip.
 */
export function wobbleHz(progress: number, spin: number): number {
  const q = clamp(progress), start = 7 + 7 * spin, cap = 95 + 65 * spin;
  return Math.min(cap, start * ((1 + 0.003) / (1 - q + 0.003)) ** 0.62);
}
export function planCoin(input: CoinOptions = {}): CoinPlan {
  const p = coinOptions(input), rng = random(p.seed), contacts: Contact[] = [], transitions: Transition[] = [];
  let current: State = 'rest';
  const state = (seconds: number, state: State) => {
    if (!NEXT[current].includes(state)) throw new Error(`coin FSM: illegal ${current} -> ${state}`);
    current = state; transitions.push({ seconds, frame: Math.round(seconds * SR), state });
  };
  const contact = (seconds: number, regime: Contact['regime'], strength: number, strike: number, angle: number, position = p.position) => {
    contacts.push({ seconds, frame: Math.round(seconds * SR), regime, strength, strike: clamp(strike), angle, position: clamp(position, -1, 1) });
  };
  let end = 0, roll: CoinPlan['roll'], wobble: CoinPlan['wobble'];
  const angular = rng() * 2 * Math.PI;
  if (p.velocity === 0) state(0, 'rest');
  else if (p.motion === 'face' || p.motion === 'edge') {
    state(0, 'airborne'); state(0, 'impact');
    contact(0, 'impact', p.velocity, p.strike, angular);
    end = 0.004; state(end, 'rest');
  } else if (p.motion === 'bounce') {
    let t = 0, v = 4 * p.velocity, angle = angular;
    state(0, 'airborne');
    for (let i = 0; i < 40; i++) {
      state(t, 'impact'); contact(t, 'bounce', v / 4, p.strike * (0.65 + 0.35 * Math.abs(Math.cos(angle))), angle);
      const rebound = v * p.restitution, flight = 2 * rebound / 9.81;
      if (rebound < 0.055 || flight < 0.012 || i === 39) break;
      state(t, 'bouncing'); state(t, 'airborne');
      t += flight; v = rebound; angle += 0.75 + p.spin * 2.3;
    }
    // Below the vertical-bounce threshold, a small remaining tilt may wobble independently.
    end = t + 0.018;
    if (p.spin > 0.05) {
      const duration = 0.18 + 0.58 * p.spin;
      wobble = { start: end, seconds: duration, startHz: wobbleHz(0, p.spin), maxHz: 95 + 65 * p.spin, exponent: 0.62 };
    }
  } else if (p.motion === 'spin') {
    state(0, 'impact'); contact(0, 'impact', p.velocity * 0.65, p.strike, angular);
    wobble = { start: 0.055, seconds: p.motionSeconds, startHz: wobbleHz(0, p.spin), maxHz: 95 + 65 * p.spin, exponent: 0.62 };
  } else {
    state(0, 'rolling');
    roll = { start: 0, seconds: p.motionSeconds, speed: 0.25 + 0.8 * p.velocity, radius: 0.01213 * p.size };
    // Constant rolling deceleration: x(t)=v0(t-t²/2T). Contacts follow travelled distance.
    const distance = roll.speed * roll.seconds / 2, spacing = 2 * Math.PI * roll.radius;
    for (let x = 0, k = 0; x < distance; k++) {
      const q = 1 - Math.sqrt(Math.max(0, 1 - x / distance)), t = q * roll.seconds;
      contact(t, 'roll', p.velocity * 0.13 * (1 - q) ** 1.2 * (0.75 + rng() * 0.5), 0.97, angular + k * 2.39996,
        p.position + 0.5 * (2 * q - 1));
      x += spacing * (0.68 + 0.64 * rng()); // fixed seeded rim/surface roughness
    }
    // Tile seams at fixed spatial intervals, not time-randomized clicks.
    for (let x = 0.21; x < distance; x += 0.21) {
      const q = 1 - Math.sqrt(1 - x / distance);
      contact(q * roll.seconds, 'roll', p.velocity * 0.32 * (1 - q), 0.85, angular + x / roll.radius, p.position + 0.5 * (2 * q - 1));
    }
    end = roll.seconds;
    if (p.spin > 0.05) wobble = { start: end, seconds: 0.16 + p.spin * 0.4, startHz: wobbleHz(0, p.spin), maxHz: 95 + 65 * p.spin, exponent: 0.62 };
  }
  if (wobble) {
    state(wobble.start, 'wobbling');
    // Integrate bounded precession phase on the output sample grid. One edge contact each turn.
    // Energy decreases even while contact rate increases: per-contact strength also scales as 1/sqrt(rate).
    let phase = 1;
    for (let i = 0, n = Math.round(wobble.seconds * SR); i < n; i++) {
      const q = i / n, hz = wobbleHz(q, p.spin);
      if (phase >= 1) {
        phase -= 1;
        const strength = p.velocity * (p.motion === 'bounce' ? 0.07 : p.motion === 'roll' ? 0.06 : 0.38)
          * (1 - q) ** 0.48 * Math.sqrt(wobble.startHz / hz) * (1 - smooth((q - 0.94) / 0.06));
        contact(wobble.start + i / SR, 'wobble', strength, 0.92 - 0.65 * q, angular + 2 * Math.PI * q * (2 + 4 * p.spin),
          p.position + 0.18 * (1 - q) * Math.sin(q * 2 * Math.PI * 3));
      }
      phase += hz / SR;
    }
    end = wobble.start + wobble.seconds;
    contact(end, 'settle', p.velocity * 0.024, 0.02, angular);
  }
  if (p.velocity > 0 && !['face', 'edge'].includes(p.motion)) state(end, 'rest');
  contacts.sort((a, b) => a.seconds - b.seconds);
  // Ring-down is acoustic; rest means no mechanical excitation. A fixed bounded tail is reproducible.
  const seconds = end + 0.75, frames = Math.round(seconds * SR);
  return { options: p, contacts, transitions, motionEndSeconds: end, seconds, frames, ...(roll ? { roll } : {}), ...(wobble ? { wobble } : {}) };
}

// Split, inharmonic flexural-mode pairs. Authored quarter-sized disk character, NOT measured eigenfrequencies.
const RATIOS = [1, 1.014, 1.627, 1.655, 2.117, 2.163, 2.69, 2.744, 3.37, 3.439, 4.13, 4.82];
const WEIGHTS = [1, 0.63, 0.73, 0.46, 0.56, 0.34, 0.38, 0.29, 0.26, 0.19, 0.15, 0.10];
export function coinModes(input: CoinOptions = {}) {
  const p = coinOptions(input), rng = random(p.seed ^ 0x434f494e), base = (2550 + 550 * p.material) / (p.size * p.size);
  return RATIOS.map((r, i) => {
    const hz = base * r * (1 + (rng() - 0.5) * 0.002);
    const tau = (0.025 + 0.11 * p.strike) * (1.25 - 0.75 * p.damping) * (0.8 + 0.35 * p.material) / (r ** 0.56);
    return { hz, tau, radius: Math.exp(-1 / (tau * SR)), weight: WEIGHTS[i]!, order: 2 + Math.floor(i / 2),
      enabled: hz < 15000, nyquistFade: 1 - smooth((hz - 11000) / 4000) };
  });
}
/** Linear Butterworth low-pass section; no saturator or feedback excitation. */
class Lowpass {
  b0: number; b1: number; b2: number; a1: number; a2: number; z1 = 0; z2 = 0;
  constructor(hz: number, q: number) {
    const w = 2 * Math.PI * hz / SR, c = Math.cos(w), a = Math.sin(w) / (2 * q), d = 1 + a;
    this.b0 = (1 - c) / (2 * d); this.b1 = 2 * this.b0; this.b2 = this.b0; this.a1 = -2 * c / d; this.a2 = (1 - a) / d;
  }
  tick(x: number) { const y = this.b0 * x + this.z1; this.z1 = this.b1 * x - this.a1 * y + this.z2; this.z2 = this.b2 * x - this.a2 * y; return y; }
}
export function renderCoin(input: CoinOptions = {}): { audio: Stereo; plan: CoinPlan; modes: ReturnType<typeof coinModes> } {
  const plan = planCoin(input), p = plan.options, modes = coinModes(p), n = plan.frames;
  const audio: Stereo = [new Float64Array(n), new Float64Array(n)];
  const force = modes.map(() => [new Float64Array(n), new Float64Array(n)] as Stereo);
  const rng = random(p.seed ^ 0x54494c45), floor = new Float64Array(n), positions = new Float64Array(n);
  for (const e of plan.contacts) {
    const width = Math.max(3, Math.round(SR * (0.00007 + 0.00038 * (1 - p.hardness)) * (1.2 - 0.45 * e.strike)));
    const gl = Math.cos((e.position + 1) * Math.PI / 4), gr = Math.sin((e.position + 1) * Math.PI / 4);
    for (let m = 0; m < modes.length; m++) {
      const mode = modes[m]!; if (!mode.enabled) continue;
      const asymmetry = m % 2 ? Math.sin(mode.order * e.angle + 0.4) : Math.cos(mode.order * e.angle);
      const coupling = (1 - e.strike) * (m < 2 ? 1 : 0.33) + e.strike * asymmetry;
      const amplitude = 0.22 * e.strength ** 1.25 * mode.weight * mode.nyquistFade * coupling;
      for (let j = 0; j < width && e.frame + j < n; j++) {
        // Unit-area smooth force pulse: hardness changes excitation spectrum, not total impulse.
        const f = Math.sin(Math.PI * (j + 0.5) / width) * Math.PI / (2 * width) * amplitude;
        force[m]![0][e.frame + j] = force[m]![0][e.frame + j]! + f * gl;
        force[m]![1][e.frame + j] = force[m]![1][e.frame + j]! + f * gr;
      }
    }
    // Short broadband floor slap, heavier for a face landing. No pitched bell-like floor body.
    const len = Math.round(SR * (0.003 + 0.003 * (1 - e.strike))), a = e.strength ** 1.2 * (0.12 + 0.19 * (1 - e.strike));
    for (let j = 0; j < len && e.frame + j < n; j++) {
      const at = e.frame + j, env = Math.sin(Math.PI * j / len) ** 2 * Math.exp(-j / (len * 0.2));
      const t = j / SR;
      const body = (0.48 * Math.sin(2 * Math.PI * 980 * t) + 0.3 * Math.sin(2 * Math.PI * 1760 * t))
        * Math.exp(-t / 0.0012) * smooth(t / 0.00012);
      floor[at] = floor[at]! + a * ((2 * rng() - 1) * env + body * (1 - 0.7 * e.strike));
      positions[at] = e.position;
    }
  }
  // Continuous rolling friction: correlated surface noise, amplitude tied to speed and reeded-rim phase.
  // This remains audible BETWEEN the distance-scheduled contacts.
  if (plan.roll) {
    const r = plan.roll; let rough = 0;
    for (let i = 0, count = Math.round(r.seconds * SR); i < count; i++) {
      const t = i / SR, q = t / r.seconds, speed = r.speed * (1 - q), angle = r.speed * (t - t * t / (2 * r.seconds)) / r.radius;
      rough += 0.32 * ((rng() * 2 - 1) - rough);
      // A 113-ridge design texture, smoothly attenuated before its spatial frequency reaches 12 kHz.
      const ridgeHz = 113 * speed / (2 * Math.PI * r.radius), aa = 1 - smooth((ridgeHz - 8000) / 4000);
      const texture = rough * (0.6 + 0.4 * Math.sin(angle * 5.13)) + 0.22 * aa * Math.sin(angle * 113);
      const f = texture * 0.026 * p.velocity * (speed / r.speed) ** 1.3 * smooth(q / 0.025) * (1 - smooth((q - 0.93) / 0.07));
      floor[i] = floor[i]! + f; positions[i] = clamp(p.position + 0.5 * (2 * q - 1), -1, 1);
      for (let m = 0; m < modes.length; m++) if (modes[m]!.enabled) {
        const strength = f * 0.003 * modes[m]!.weight * modes[m]!.nyquistFade * Math.cos(modes[m]!.order * angle);
        force[m]![0][i] = force[m]![0][i]! + strength * Math.cos((positions[i]! + 1) * Math.PI / 4);
        force[m]![1][i] = force[m]![1][i]! + strength * Math.sin((positions[i]! + 1) * Math.PI / 4);
      }
    }
  }
  for (let m = 0; m < modes.length; m++) {
    const mode = modes[m]!; if (!mode.enabled) continue;
    const w = 2 * Math.PI * mode.hz / SR, cr = mode.radius * Math.cos(w), ci = mode.radius * Math.sin(w);
    for (let c = 0; c < 2; c++) {
      let re = 0, im = 0;
      for (let i = 0; i < n; i++) {
        // A stable complex pole pair. r<1 always; all contacts share the same coin's resonant memory.
        const next = cr * re - ci * im;
        im = ci * re + cr * im + force[m]![c]![i]!; re = next;
        audio[c]![i] = audio[c]![i]! + re;
      }
    }
  }
  const cutoff = 6500 + 4500 * p.hardness, dcR = Math.exp(-2 * Math.PI * 35 / SR);
  for (let c = 0; c < 2; c++) {
    const filters = [0.51763809, 0.70710678, 1.93185165].map(q => new Lowpass(cutoff, q));
    let lastX = 0, lastY = 0;
    for (let i = 0; i < n; i++) {
      const theta = (positions[i]! + 1) * Math.PI / 4;
      let v = audio[c]![i]! + floor[i]! * (c === 0 ? Math.cos(theta) : Math.sin(theta));
      for (const f of filters) v = f.tick(v);
      const hp = v - lastX + dcR * lastY; lastX = v; lastY = hp;
      audio[c]![i] = hp * (1 - smooth((i - (n - 882)) / 881));
      if (!Number.isFinite(audio[c]![i])) throw new Error('coin: non-finite output');
    }
  }
  // Global fixed gain above, never per-hit normalization or nonlinear limiting. Fail loudly on regression.
  for (const ch of audio) for (const v of ch) if (Math.abs(v) >= 0.95) throw new Error('coin: safety headroom exceeded');
  return { audio, plan, modes };
}
